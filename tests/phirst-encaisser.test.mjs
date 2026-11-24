// Encaisser de Phirst V2 (24/11/2026) : la logique pure (phirst/v2/phirst-encaisser-pur.js), d'après la maquette validée par Will.
// Valeurs attendues écrites en dur d'après la maquette. Aucune lecture de fichier hors du dépôt (la CI en dépend).
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const req = createRequire(import.meta.url)
const E = req('../phirst/v2/phirst-encaisser-pur.js')

const AUJ = '2026-11-24'
const FIN = ' ', NB = ' '
const SIG = 'Yann Morel\nPhirst · 07 56 99 19 11'
const MARQUE = { interlocuteur: 'Yann Morel', marque: 'Phirst', tel: '07 56 99 19 11' }
const li = (o = {}) => ({ id: 'l1', volet: 'v1', type: 'acompte', libelle: '', montant: 1000, envoyeLe: null, echeance: null, faitLe: null, ...o })
const rel = (jour, o = {}) => ({ jour, canal: 'mail', ...o })
// une attente à partir d'une ligne ; o.dern = les dernières relances { id de la somme : { jour, canal } }
const att = (o = {}, auj = AUJ) => { const { dern, ...ligne } = o; return E.attentes([li(ligne)], auj, dern)[0] }
const atts = (lignes, dern, auj = AUJ) => E.attentes(lignes, auj, dern)
const msg = (a, ph = { nom: 'Pharmacie du Port', titulaire: '' }, sorte = 'agencement', sig = SIG) => E.message(a, ph, sorte, sig, AUJ)

describe('attentes', () => {
  test('devis sans réponse : 10 jours pile oui, 9 jours non', () => {
    const dix = atts([li({ type: 'devis', envoyeLe: '2026-11-14' })])
    assert.equal(dix.length, 1)
    assert.equal(dix[0].etat, 'sans_reponse')
    assert.equal(dix[0].j, 10)
    assert.equal(atts([li({ type: 'devis', envoyeLe: '2026-11-15' })]).length, 0)
  })
  test('devis sans date d’envoi ignoré ; devis accepté ignoré', () => {
    assert.equal(atts([li({ type: 'devis' })]).length, 0)
    assert.equal(atts([li({ type: 'devis', envoyeLe: '2026-01-01', faitLe: '2026-02-01' })]).length, 0)
  })
  test('retard = échéance strictement passée', () => {
    const r = att({ echeance: '2026-11-23' })
    assert.equal(r.etat, 'retard'); assert.equal(r.j, 1)
    const auj = att({ echeance: '2026-11-24' })
    assert.equal(auj.etat, 'attendu'); assert.equal(auj.j, 0)
    const dem = att({ echeance: '2026-11-27' })
    assert.equal(dem.etat, 'attendu'); assert.equal(dem.j, 3)
  })
  test('reçu ignoré ; attendu sans échéance (j = 0)', () => {
    assert.equal(atts([li({ echeance: '2026-01-01', faitLe: '2026-11-01' })]).length, 0)
    const a = att({})
    assert.equal(a.etat, 'attendu'); assert.equal(a.j, 0)
  })
  test('la dernière relance est attachée à l’attente', () => {
    const a = att({ id: 'x', echeance: '2026-11-01', dern: { x: { jour: '2026-11-20', canal: 'sms' } } })
    assert.deepEqual(a.r, { jour: '2026-11-20', canal: 'sms' })
    assert.equal(att({ echeance: '2026-11-01' }).r, null)
  })
})

describe('du, enRetard', () => {
  test('du : devis et reçu exclus, arrondi au centime', () => {
    const ls = [li({ id: 'a', montant: 0.1 }), li({ id: 'b', montant: 0.2 }), li({ id: 'c', type: 'devis', montant: 50000 }),
      li({ id: 'd', montant: 999, faitLe: '2026-11-01' }), li({ id: 'e', type: 'solde', montant: 1000 })]
    assert.equal(E.du(ls), 1000.3)
    assert.equal(E.du([li({ montant: 0.1 }), li({ montant: 0.2 })]), 0.3)
    assert.equal(E.du([]), 0); assert.equal(E.du(null), 0)
  })
  test('enRetard : somme des seuls retards', () => {
    const l = atts([li({ id: 'a', montant: 100, echeance: '2026-11-01' }), li({ id: 'b', montant: 200.5, echeance: '2026-11-02' }),
      li({ id: 'c', montant: 999, echeance: '2026-12-01' }), li({ id: 'd', type: 'devis', montant: 7777, envoyeLe: '2026-01-01' })])
    assert.equal(E.enRetard(l), 300.5)
    assert.equal(E.enRetard([]), 0)
  })
})

describe('relances, repos, notées, dernières', () => {
  test('ordre : à relancer d’abord, plus ancien d’abord, relancées récemment en dernier', () => {
    const ls = [li({ id: 'petit', echeance: '2026-11-20' }), li({ id: 'vieux', echeance: '2026-10-01' }), li({ id: 'repos', echeance: '2026-09-01' }),
      li({ id: 'devis', type: 'devis', envoyeLe: '2026-11-04' }), li({ id: 'futur', echeance: '2026-12-31' })]
    const r = E.relances(atts(ls, { repos: { jour: '2026-11-22', canal: 'mail' } }), AUJ)
    assert.deepEqual(r.map(a => a.l.id), ['vieux', 'devis', 'petit', 'repos'])
  })
  test('repos : relancée il y a 6 jours repose, il y a 7 jours de nouveau à faire', () => {
    const base = [li({ id: 'a', echeance: '2026-10-01' })]
    const six = atts(base, { a: { jour: '2026-11-18' } })
    assert.equal(E.recente(six[0], AUJ), true)
    assert.equal(E.aFaire(E.relances(six, AUJ), AUJ).length, 0)
    const sept = atts(base, { a: { jour: '2026-11-17' } })
    assert.equal(E.recente(sept[0], AUJ), false)
    assert.equal(E.aFaire(E.relances(sept, AUJ), AUJ).length, 1)
    assert.equal(E.recente(att({}), AUJ), false)
  })
  test('bientôt : attendus triés par échéance, sans échéance en dernier', () => {
    const l = atts([li({ id: 'z' }), li({ id: 'b', echeance: '2026-12-20' }), li({ id: 'a', echeance: '2026-12-01' }), li({ id: 'r', echeance: '2026-11-01' })])
    assert.deepEqual(E.bientot(l).map(a => a.l.id), ['a', 'b', 'z'])
  })
  test('notées : fenêtre de 7 jours, la plus récente d’abord', () => {
    const rs = [rel('2026-11-17', { id: 1 }), rel('2026-11-18', { id: 2 }), rel('2026-11-24', { id: 3 }), rel('2026-11-25', { id: 4 }), rel('2026-11-20', { id: 5 }), rel('pas', { id: 6 })]
    assert.deepEqual(E.notees(rs, AUJ).map(r => r.id), [3, 5, 2])
    assert.deepEqual(E.notees(null, AUJ), [])
  })
  test('dernières : le jour le plus récent gagne, à jour égal la dernière notée', () => {
    const d = E.dernieres([
      { somme_id: 's', jour: '2026-11-10', canal: 'mail', created_at: '2026-11-10T08:00:00Z' },
      { somme_id: 's', jour: '2026-11-20', canal: 'sms', created_at: '2026-11-20T08:00:00Z' },
      { somme_id: 's', jour: '2026-11-15', canal: 'mail', created_at: '2026-11-25T08:00:00Z' },
      { somme_id: 't', jour: '2026-11-12', canal: 'mail', created_at: '2026-11-12T08:00:00Z' },
      { somme_id: 't', jour: '2026-11-12', canal: 'sms', created_at: '2026-11-12T09:00:00Z' },
      { somme_id: null, jour: '2026-11-12' }, { somme_id: 'u', jour: 'x' }])
    assert.equal(d.s.jour, '2026-11-20'); assert.equal(d.s.canal, 'sms')
    assert.equal(d.t.canal, 'sms')
    assert.equal(Object.keys(d).length, 2)
    assert.deepEqual(E.dernieres(null), {})
  })
  test('ligneDe : lit une ligne de la base', () => {
    const l = E.ligneDe({ id: 'i', volet_id: 'v', type: 'zzz', libelle: '  Mobilier ', montant: '1200.456', envoye_le: '2026-11-01T10:00:00Z', echeance: 'n', fait_le: null })
    assert.deepEqual(l, { id: 'i', volet: 'v', type: 'autre', libelle: 'Mobilier', montant: 1200.46, envoyeLe: '2026-11-01', echeance: null, faitLe: null })
  })
})

describe('message : les quatre tons', () => {
  const ech = d => ({ echeance: d })
  test('petit rappel : retard de 7 jours ou moins', () => {
    const m = msg(att(ech('2026-11-17')))
    assert.equal(m.objet, 'Petit rappel — Pharmacie du Port')
    assert.match(m.texte, /Un petit rappel : /)
  })
  test('règlement en attente : plus de 7 jours, sans relance notée', () => {
    const m = msg(att(ech('2026-11-16')))
    assert.equal(m.objet, 'Règlement en attente — Pharmacie du Port')
    assert.match(m.texte, /Sauf erreur de ma part/)
  })
  test('deuxième relance seulement si une relance a été notée', () => {
    const m = msg(att({ ...ech('2026-11-10'), dern: { l1: { jour: '2026-11-15', canal: 'mail' } } }))
    assert.equal(m.objet, 'Deuxième relance — Pharmacie du Port')
    assert.match(m.texte, /Malgré mon précédent message, l’acompte de 1 000 € HT pour l’agencement de la Pharmacie du Port, attendu le 10 novembre, reste à régler, soit 14 jours de retard\./)
    assert.match(m.texte, /Merci de procéder au règlement dans les meilleurs délais, ou de m’appeler si un point bloque\./)
  })
  test('40 jours de retard sans relance notée : PAS « Deuxième relance »', () => {
    const m = msg(att(ech('2026-10-15')))
    assert.equal(m.objet, 'Règlement en attente — Pharmacie du Port')
    assert.doesNotMatch(m.objet + m.texte, /Deuxième relance|Malgré mon précédent message/)
  })
  test('devis sans réponse (agencement) : « du devis d’agencement », « envoyé le »', () => {
    const m = msg(att({ type: 'devis', envoyeLe: '2026-11-01' }), undefined, 'agencement')
    assert.equal(m.objet, 'Votre projet d’agencement — Pharmacie du Port')
    assert.match(m.texte, /au sujet du devis d’agencement de la Pharmacie du Port, envoyé le 1er novembre\. Avez-vous pu le regarder \?/)
    assert.match(m.texte, /Je peux passer vous présenter les dernières vues 3D/)
  })
  test('offre Riedl et PDA : « de l’offre pour … », « envoyée le »', () => {
    const r = msg(att({ type: 'devis', envoyeLe: '2026-11-01' }), undefined, 'riedl')
    assert.match(r.texte, /au sujet de l’offre pour le robot Riedl de la Pharmacie du Port, envoyée le 1er novembre\. Avez-vous pu la regarder \?/)
    assert.match(r.texte, /Je peux passer vous la présenter/)
    const p = msg(att({ type: 'devis', envoyeLe: '2026-11-01' }), undefined, 'pda')
    assert.equal(p.objet, 'Votre projet de préparation des doses — Pharmacie du Port')
    assert.match(p.texte, /de l’offre pour la machine de préparation des doses de la Pharmacie/)
  })
  test('le projet est nommé d’après le volet', () => {
    assert.match(msg(att(ech('2026-11-20')), undefined, 'transfert').texte, /pour le transfert de la Pharmacie du Port/)
    assert.match(msg(att(ech('2026-11-20')), undefined, 'riedl').texte, /pour le robot Riedl de la Pharmacie/)
    assert.match(msg(att(ech('2026-11-20')), undefined, 'inconnu').texte, /pour l’agencement de la Pharmacie/)
  })
  test('libellé repris avec son article ; libellé égal au mot : article + mot', () => {
    const a = msg(att({ libelle: 'Mobilier de comptoir', montant: 8000, ...ech('2026-11-20') })).texte
    assert.match(a, /le mobilier de comptoir, soit 8 000 € HT, pour l’agencement/)
    assert.match(msg(att({ libelle: 'Acompte', ...ech('2026-11-20') })).texte, /l’acompte de 1 000 € HT pour/)
    assert.match(msg(att({ libelle: 'Éclairage', ...ech('2026-11-20') })).texte, /l’éclairage, soit/)
    assert.match(msg(att({ type: 'autre', ...ech('2026-11-20') })).texte, /le règlement de 1 000/)
    assert.match(msg(att({ type: 'solde', ...ech('2026-11-20') })).texte, /le solde de 1 000/)
  })
  test('salutation : Mme → Madame, M. → Monsieur, sans titulaire → « Bonjour, »', () => {
    const a = att(ech('2026-11-20'))
    assert.ok(msg(a, { nom: 'Pharmacie X', titulaire: 'Mme Durand' }).texte.startsWith('Bonjour Madame Durand,\n\n'))
    assert.ok(msg(a, { nom: 'Pharmacie X', titulaire: 'M. Petit' }).texte.startsWith('Bonjour Monsieur Petit,\n\n'))
    assert.ok(msg(a, { nom: 'Pharmacie X', titulaire: '' }).texte.startsWith('Bonjour,\n\n'))
    assert.ok(msg(a, { nom: 'Pharmacie X' }).texte.startsWith('Bonjour,\n\n'))
    assert.equal(E.bonjour('Mme. Roux'), 'Bonjour Madame Roux,')
  })
  test('signature en fin de message ; sans signature, aucun résidu', () => {
    const a = att(ech('2026-11-20'))
    assert.ok(msg(a).texte.endsWith('\n\nBien cordialement,\nYann Morel\nPhirst · 07 56 99 19 11'))
    assert.ok(msg(a, undefined, 'agencement', '').texte.endsWith('\n\nBien cordialement,'))
  })
  test('années affichées seulement si différentes de l’année du jour', () => {
    assert.match(msg(att({ type: 'devis', envoyeLe: '2025-11-01' })).texte, /envoyé le 1er novembre 2025\./)
    assert.doesNotMatch(msg(att({ type: 'devis', envoyeLe: '2026-11-01' })).texte, /2026/)
    assert.match(msg(att(ech('2025-12-30'))).texte, /attendu le 30 décembre 2025,/)
    assert.equal(E.court('2026-11-01', AUJ), '1er nov.')
    assert.equal(E.court('2025-03-05', AUJ), '5 mars 2025')
    assert.equal(E.dateMsg('2027-01-02', AUJ), '2 janvier 2027')
  })
})

describe('message : textes complets mot pour mot (d’après la maquette)', () => {
  test('petit rappel, Mme, transfert', () => {
    const a = att({ montant: 4200, echeance: '2026-11-20' })
    const m = E.message(a, { nom: 'Pharmacie du Port', titulaire: 'Mme Durand' }, 'transfert', SIG, AUJ)
    assert.equal(m.objet, 'Petit rappel — Pharmacie du Port')
    assert.equal(m.texte, 'Bonjour Madame Durand,\n\nUn petit rappel : l’acompte de 4 200 € HT pour le transfert de la Pharmacie du Port, attendu le 20 novembre, ne nous est pas encore parvenu. Il s’est peut-être croisé avec ce message.\n\nBien cordialement,\nYann Morel\nPhirst · 07 56 99 19 11')
  })
  test('règlement en attente, libellé, sans titulaire, agencement', () => {
    const a = att({ type: 'solde', libelle: 'Solde mobilier', montant: 8000, echeance: '2026-11-10' })
    const m = E.message(a, { nom: 'Pharmacie Centrale', titulaire: '' }, 'agencement', SIG, AUJ)
    assert.equal(m.objet, 'Règlement en attente — Pharmacie Centrale')
    assert.equal(m.texte, 'Bonjour,\n\nSauf erreur de ma part, le solde mobilier, soit 8 000 € HT, pour l’agencement de la Pharmacie Centrale, attendu le 10 novembre, ne nous est pas encore parvenu.\n\nPourriez-vous me dire où en est le règlement ?\n\nBien cordialement,\nYann Morel\nPhirst · 07 56 99 19 11')
  })
  test('offre Riedl sans réponse, M., année différente', () => {
    const a = att({ type: 'devis', montant: 95000, envoyeLe: '2025-11-01' })
    const m = E.message(a, { nom: 'Pharmacie Centrale', titulaire: 'M. Petit' }, 'riedl', SIG, AUJ)
    assert.equal(m.objet, 'Votre projet de robot Riedl — Pharmacie Centrale')
    assert.equal(m.texte, 'Bonjour Monsieur Petit,\n\nJe reviens vers vous au sujet de l’offre pour le robot Riedl de la Pharmacie Centrale, envoyée le 1er novembre 2025. Avez-vous pu la regarder ?\n\nJe peux passer vous la présenter, ou ajuster ce qui doit l’être, si cela vous aide à décider.\n\nBien cordialement,\nYann Morel\nPhirst · 07 56 99 19 11')
  })
  test('deuxième relance (relance notée), sans signature', () => {
    const a = att({ type: 'solde', montant: 12600.5, echeance: '2026-10-15', dern: { l1: { jour: '2026-11-02', canal: 'sms' } } })
    const m = E.message(a, { nom: 'Pharmacie des Lilas', titulaire: 'Mme Roux' }, 'pda', '', AUJ)
    assert.equal(m.objet, 'Deuxième relance — Pharmacie des Lilas')
    assert.equal(m.texte, 'Bonjour Madame Roux,\n\nMalgré mon précédent message, le solde de 12 600,50 € HT pour la machine de préparation des doses de la Pharmacie des Lilas, attendu le 15 octobre, reste à régler, soit 40 jours de retard.\n\nMerci de procéder au règlement dans les meilleurs délais, ou de m’appeler si un point bloque.\n\nBien cordialement,')
  })
})

describe('signature, liens', () => {
  test('signature lue dans le réglage', () => {
    assert.equal(E.signature(MARQUE), SIG)
    assert.equal(E.signature({ interlocuteur: 'Yann Morel' }), 'Yann Morel')
    assert.equal(E.signature({ marque: 'Phirst', tel: '07 56 99 19 11' }), 'Phirst · 07 56 99 19 11')
    assert.equal(E.signature({}), ''); assert.equal(E.signature(null), ''); assert.equal(E.signature(undefined), '')
  })
  test('lienMail : encodage de l’objet et du texte', () => {
    assert.equal(E.lienMail('a@b.fr', 'Petit rappel — X', 'Bonjour,\n\n5 € & plus'),
      'mailto:a@b.fr?subject=Petit%20rappel%20%E2%80%94%20X&body=Bonjour%2C%0A%0A5%20%E2%82%AC%20%26%20plus')
    assert.equal(E.lienMail(null, 'a', 'b'), 'mailto:?subject=a&body=b')
  })
  test('lienSms : numéro nettoyé, trop court → vide', () => {
    assert.equal(E.lienSms('06 12 34 56 78', 'Bonjour é'), 'sms:0612345678?&body=Bonjour%20%C3%A9')
    assert.equal(E.lienSms('+33 6 12 34 56 78', 'x'), 'sms:+33612345678?&body=x')
    assert.equal(E.lienSms('02 61', 'x'), 'sms:?&body=x')
    assert.equal(E.lienSms('', 'x'), 'sms:?&body=x')
    assert.equal(E.telSms('06.12.34.56.78'), '0612345678')
  })
})

describe('eur, lireMontant', () => {
  test('eur : espace fine insécable des milliers, insécable avant €, centimes', () => {
    assert.equal(E.eur(12600), '12' + FIN + '600' + NB + '€')
    assert.equal(E.eur(1234567), '1' + FIN + '234' + FIN + '567' + NB + '€')
    assert.equal(E.eur(950), '950' + NB + '€')
    assert.equal(E.eur(0), '0' + NB + '€')
    assert.equal(E.eur(12600.5), '12' + FIN + '600,50' + NB + '€')
    assert.equal(E.eur(0.07), '0,07' + NB + '€')
  })
  test('lireMontant', () => {
    assert.equal(E.lireMontant('12 600'), 12600)
    assert.equal(E.lireMontant('12 600'), 12600)
    assert.equal(E.lireMontant('12600,5'), 12600.5)
    assert.equal(E.lireMontant('12 600 €'), 12600)
    assert.equal(E.lireMontant('12600.25'), 12600.25)
    assert.ok(Number.isNaN(E.lireMontant('')))
    assert.ok(Number.isNaN(E.lireMontant('abc')))
    assert.ok(Number.isNaN(E.lireMontant('1.234.5')))
    assert.ok(Number.isNaN(E.lireMontant('12,345')))
    assert.ok(Number.isNaN(E.lireMontant('-5')))
    assert.ok(Number.isNaN(E.lireMontant(null)))
  })
})

describe('verifier', () => {
  const ok = (o = {}) => ({ dossier: 'd1', volet: 'v1', type: 'acompte', montant: '12 600', libelle: '', envoyeLe: '', echeance: '2026-12-01', ...o })
  test('saisie correcte → valeur prête pour la base', () => {
    assert.deepEqual(E.verifier(ok()), { ok: true, valeur: { volet_id: 'v1', type: 'acompte', libelle: '', montant: 12600, envoye_le: null, echeance: '2026-12-01' } })
  })
  test('pharmacie, projet, type manquants : erreur sur le bon champ', () => {
    const p = E.verifier(ok({ dossier: '' })); assert.equal(p.ok, false); assert.equal(p.champ, 'ph'); assert.equal(p.erreur, 'Choisissez la pharmacie.')
    const v = E.verifier(ok({ volet: null })); assert.equal(v.champ, 'volet'); assert.equal(v.erreur, 'Choisissez le projet de cette pharmacie.')
    assert.equal(E.verifier(ok({ type: 'zzz' })).champ, 'type')
    assert.equal(E.verifier().champ, 'ph')
  })
  test('montant vide, 0, illisible, trop grand', () => {
    for (const m of ['', '0', '0,00', 'abc']) {
      const r = E.verifier(ok({ montant: m })); assert.equal(r.ok, false); assert.equal(r.champ, 'montant')
      assert.equal(r.erreur, 'Écrivez le montant hors taxes, par exemple 12 600.')
    }
    assert.equal(E.verifier(ok({ montant: '10 000 000' })).ok, true)
    const g = E.verifier(ok({ montant: '10 000 001' }))
    assert.equal(g.ok, false); assert.equal(g.champ, 'montant'); assert.equal(g.erreur, 'Ce montant semble trop grand : vérifiez-le.')
  })
  test('devis : échéance forcée à null', () => {
    const r = E.verifier(ok({ type: 'devis', echeance: '2026-12-01', envoyeLe: '2026-11-10' }))
    assert.equal(r.ok, true); assert.equal(r.valeur.echeance, null); assert.equal(r.valeur.envoye_le, '2026-11-10')
    assert.equal(E.verifier(ok({ type: 'devis', echeance: 'pas une date' })).ok, true)
  })
  test('dates fausses refusées', () => {
    assert.equal(E.verifier(ok({ envoyeLe: '2026-02-30' })).champ, 'env')
    assert.equal(E.verifier(ok({ echeance: '2026-13-01' })).champ, 'ech')
    assert.equal(E.verifier(ok({ echeance: '' })).valeur.echeance, null)
  })
  test('libellé : espaces nettoyés, coupé à 80 caractères', () => {
    assert.equal(E.verifier(ok({ libelle: '  Mobilier   de\n comptoir ' })).valeur.libelle, 'Mobilier de comptoir')
    assert.equal(E.verifier(ok({ libelle: 'x'.repeat(120) })).valeur.libelle.length, 80)
  })
})

describe('resteDossier, étiquette, phrases', () => {
  test('resteDossier : reste dû, offre vs devis en attente, rien n’est dû, aucune somme', () => {
    assert.deepEqual(E.resteDossier([], ['agencement']), { zero: false, texte: 'aucune somme notée' })
    assert.deepEqual(E.resteDossier([li({ montant: 12600.5 })], ['agencement']), { zero: false, texte: 'reste 12' + FIN + '600,50' + NB + '€ HT' })
    const dv = [li({ type: 'devis', montant: 9000 })]
    assert.deepEqual(E.resteDossier(dv, ['agencement']), { zero: false, texte: 'devis en attente de réponse' })
    assert.deepEqual(E.resteDossier(dv, ['agencement', 'riedl']), { zero: false, texte: 'offre en attente de réponse' })
    assert.deepEqual(E.resteDossier(dv, ['pda']), { zero: false, texte: 'offre en attente de réponse' })
    assert.deepEqual(E.resteDossier([li({ faitLe: '2026-11-01' })], ['agencement']), { zero: true, texte: 'rien n’est dû' })
    assert.deepEqual(E.resteDossier([li({ type: 'devis', faitLe: '2026-11-01' })], []), { zero: true, texte: 'rien n’est dû' })
  })
  test('etiquette : retard, sans réponse, relancé', () => {
    assert.deepEqual(E.etiquette(att({ echeance: '2026-11-23' }), AUJ), { ton: 'rouge', texte: 'En retard · 1 jour' })
    assert.deepEqual(E.etiquette(att({ echeance: '2026-11-04' }), AUJ), { ton: 'rouge', texte: 'En retard · 20 jours' })
    assert.deepEqual(E.etiquette(att({ type: 'devis', envoyeLe: '2026-11-10' }), AUJ), { ton: 'orange', texte: 'Sans réponse · 14 jours' })
    const r = att({ echeance: '2026-11-04', dern: { l1: { jour: '2026-11-20', canal: 'mail' } } })
    assert.deepEqual(E.etiquette(r, AUJ), { ton: '', texte: 'Relancé le 20 nov.' })
    const v = att({ echeance: '2026-11-04', dern: { l1: { jour: '2026-11-10', canal: 'mail' } } })
    assert.equal(E.etiquette(v, AUJ).ton, 'rouge')
  })
  test('phraseBande : 0 ligne, relances à faire, tout relancé, personne en retard', () => {
    assert.match(E.phraseBande(0, [], AUJ), /^Quand vous envoyez un devis, un acompte ou un solde/)
    const un = E.relances(atts([li({ echeance: '2026-11-01' })]), AUJ)
    assert.match(E.phraseBande(3, un, AUJ), /^1 relance à faire\. Chaque message est déjà écrit/)
    const deux = E.relances(atts([li({ id: 'a', echeance: '2026-11-01' }), li({ id: 'b', echeance: '2026-11-02' })]), AUJ)
    assert.match(E.phraseBande(3, deux, AUJ), /^2 relances à faire\./)
    const tous = E.relances(atts([li({ id: 'a', echeance: '2026-11-01' })], { a: { jour: '2026-11-23' } }), AUJ)
    assert.equal(E.phraseBande(3, tous, AUJ), 'Tout est relancé cette semaine. Notez chaque paiement dès qu’il arrive.')
    assert.equal(E.phraseBande(3, [], AUJ), 'Personne n’est en retard. Notez chaque paiement dès qu’il arrive.')
  })
  test('phraseRelance et detailLigne', () => {
    assert.equal(E.phraseRelance(att({ libelle: 'solde', echeance: '2026-11-04' }), 'agencement', AUJ), 'Solde attendu depuis 20 jours, le 4 nov. Le message est déjà écrit.')
    assert.equal(E.phraseRelance(att({ type: 'devis', libelle: 'offre robot', envoyeLe: '2026-11-10' }), 'riedl', AUJ), 'Offre robot envoyée il y a 14 jours, sans réponse. Le message est déjà écrit.')
    // sans précision : un seul « envoyé » (la maquette écrivait « Devis envoyé envoyé ») ; offre pour Riedl et PDA
    assert.equal(E.phraseRelance(att({ type: 'devis', libelle: '', envoyeLe: '2026-11-10' }), 'agencement', AUJ), 'Devis envoyé il y a 14 jours, sans réponse. Le message est déjà écrit.')
    assert.equal(E.phraseRelance(att({ type: 'devis', libelle: '', envoyeLe: '2026-11-10' }), 'pda', AUJ), 'Offre envoyée il y a 14 jours, sans réponse. Le message est déjà écrit.')
    assert.equal(E.detailLigne(li({ faitLe: '2026-11-01' }), AUJ), 'Reçu le 1er nov.')
    assert.equal(E.detailLigne(li({ type: 'devis', faitLe: '2026-11-01' }), AUJ), 'Accepté le 1er nov.')
    assert.equal(E.detailLigne(li({}), AUJ), 'en attente')
    assert.equal(E.detailLigne(li({ envoyeLe: '2026-11-01', echeance: '2026-12-05' }), AUJ), 'envoyé le 1er nov. · à payer le 5 déc.')
  })
  test('dates : décaler, jours, longJour', () => {
    assert.equal(E.decaler('2026-11-24', -7), '2026-11-17')
    assert.equal(E.jours('2026-11-17', '2026-11-24'), 7)
    assert.equal(E.longJour('2026-11-24'), 'mardi 24 novembre 2026')
    // le numéro de la pharmacie s'affiche par paires, sans se couper (l'annuaire le donne collé : « 0297767802 »)
    // une adresse piégée n'ajoute aucun destinataire au brouillon
    assert.equal(E.adresseMail(' pre-lormeau@exemple.fr '), 'pre-lormeau@exemple.fr')
    assert.equal(E.adresseMail('a@b.fr?cc=autre@c.fr'), '')
    assert.equal(E.adresseMail('a@b.fr,autre@c.fr'), '')
    assert.ok(E.lienMail('a@b.fr?bcc=x@y.fr', 'Objet', 'Texte').startsWith('mailto:?subject='))
    assert.equal(E.telLisible('0297767802'), '02 97 76 78 02')
    assert.equal(E.telLisible('+33 6 12 34 56 78'), '+33 6 12 34 56 78')
    assert.equal(E.telLisible('12'), '12')
    assert.equal(E.telLisible(''), '')
    assert.equal(E.estJour('2026-02-30'), false)
    assert.equal(E.jourDe('2026-11-24T10:00:00Z'), '2026-11-24')
  })
})
