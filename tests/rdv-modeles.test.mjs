import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MOD = require('../crm/v2/v2-rdv-modeles.js');

const CTX = {
  contact: 'Mme Tritsch', nom_officine: 'PHARMACIE RIVE SUD', ville: 'MURS ERIGNE',
  ca_annee: 43812, potentiel_gx: 423000, manque_a_gagne: 12000,
  mois_derniere_visite: 7, prenom_commercial: 'William', tel_commercial: '0600000000',
  lien: 'https://exemple.fr/rdv.html?t=abc', texte_libre: 'La gamme diabète arrive en septembre.'
};

test('trois modeles sont proposes', () => {
  const l = MOD.liste();
  assert.equal(l.length, 3);
  assert.deepEqual(l.map(m => m.cle).sort(), ['bilan', 'offre', 'routine']);
});

test('chaque modele produit un objet et un corps non vides', () => {
  MOD.liste().forEach(m => {
    const r = MOD.rendre(m.cle, CTX);
    assert.ok(r.objet.length > 5, `objet vide pour ${m.cle}`);
    assert.ok(r.corps.length > 50, `corps vide pour ${m.cle}`);
  });
});

test('le lien figure dans les trois modeles', () => {
  MOD.liste().forEach(m => {
    assert.ok(MOD.rendre(m.cle, CTX).corps.includes(CTX.lien), `lien absent de ${m.cle}`);
  });
});

test('la mention STOP figure dans les trois modeles', () => {
  MOD.liste().forEach(m => {
    assert.ok(/STOP/.test(MOD.rendre(m.cle, CTX).corps), `mention STOP absente de ${m.cle}`);
  });
});

test('objet + corps tiennent sous 1200 caracteres', () => {
  MOD.liste().forEach(m => {
    const r = MOD.rendre(m.cle, CTX);
    assert.ok(r.objet.length + r.corps.length <= 1200, `${m.cle} est trop long`);
  });
});

test('aucun modele ne sort de condition commerciale chiffree', () => {   // vocab-ok
  MOD.liste().forEach(m => {
    const c = MOD.rendre(m.cle, CTX).corps.toLowerCase();
    assert.equal(/remise/.test(c), false, `${m.cle} emploie le mot interdit`);   // vocab-ok
    assert.equal(/abandon de marge/.test(c), false, `${m.cle} chiffre l abandon de marge`);
    assert.equal(/\d+\s*%/.test(c), false, `${m.cle} contient un pourcentage`);
  });
});

test('le texte libre ne peut pas introduire un pourcentage en douce', () => {
  const r = MOD.rendre('offre', { ...CTX, texte_libre: 'Offre exceptionnelle : 12 % sur la gamme.' });
  assert.equal(/\d+\s*%/.test(r.corps), false, 'un pourcentage saisi a la main est passe dans le mail');
});

test('modele bilan : reprend le CA de l officine', () => {
  const r = MOD.rendre('bilan', CTX);
  assert.ok(r.corps.includes('43 812') || r.corps.includes('43812'), 'le CA doit apparaitre');
});

test('modele routine : reprend le nombre de mois', () => {
  assert.ok(MOD.rendre('routine', CTX).corps.includes('7'));
});

test('modele offre : reprend le texte libre', () => {
  assert.ok(MOD.rendre('offre', CTX).corps.includes('gamme diabète'));
});

test('champs manquants : pas de undefined dans le rendu', () => {
  MOD.liste().forEach(m => {
    const r = MOD.rendre(m.cle, { lien: 'x', prenom_commercial: 'W' });
    assert.equal(/undefined|null|NaN/.test(r.corps), false, `${m.cle} laisse passer un trou`);
    assert.equal(/undefined|null|NaN/.test(r.objet), false, `${m.cle} laisse passer un trou dans l objet`);
  });
});

test('cle inconnue : renvoie le modele routine plutot que de casser', () => {
  const r = MOD.rendre('nimportequoi', CTX);
  assert.ok(r.corps.length > 50);
});

test('le mail tient dans la limite de longueur d un mailto', () => {
  MOD.liste().forEach(m => {
    const r = MOD.rendre(m.cle, CTX);
    const url = 'mailto:' + encodeURIComponent('contact@pharmacie-exemple.fr') +
      '?subject=' + encodeURIComponent(r.objet) + '&body=' + encodeURIComponent(r.corps);
    assert.ok(url.length <= 1800, `${m.cle} depasse la limite Outlook : ${url.length}`);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  19/08/2026 — personnalisation réelle + modèles personnels
// ═══════════════════════════════════════════════════════════════════

test('l abandon de marge ne sort JAMAIS chiffre dans un mail', () => {
  // CTX porte manque_a_gagne: 12000. Le modele bilan avait un emplacement
  // pour l ecrire. Un mail est un document remis au pharmacien : aucune
  // condition commerciale chiffree ne s y imprime.
  MOD.liste().forEach(m => {
    const c = MOD.rendre(m.cle, CTX).corps;
    assert.ok(!/12\s?000/.test(c), `montant d abandon present dans ${m.cle}`);
    assert.ok(!/recuperer\s*$/i.test(c), 'phrase tronquee');
  });
  assert.ok(MOD.rendre('bilan', CTX).corps.includes('sans changer vos habitudes'));
});

test('on annonce NOTRE stock, jamais « vos 79 references sont en tension »', () => {
  const ctx = { ...CTX, ruptures_tension: 79, ruptures_stock: 50 };
  const c = MOD.rendre('routine', ctx).corps;
  // Le fichier ANSM est une liste de SIGNALEMENTS sur ~18 mois : « sont en
  // tension » serait faux, et un pharmacien le verrait.
  assert.ok(!/79/.test(c), 'le nombre de tensions ne doit pas sortir : ' + c);
  assert.ok(!/sont en tension/.test(c), c);
  assert.ok(c.includes('nous avons en stock, à ce jour, 50 références'), c);
  assert.ok(c.includes('liste de tension de l’ANSM'), c);
});

test('sans stock a annoncer, on retombe sur la phrase generique', () => {
  // Annoncer un probleme sans solution ne sert personne.
  const c = MOD.rendre('routine', { ...CTX, ruptures_tension: 12, ruptures_stock: 0 }).corps;
  assert.ok(c.includes('les références en tension que nous avons en stock'), c);
  assert.ok(!/12 référence/.test(c), c);
  const g = MOD.rendre('routine', CTX).corps;
  assert.ok(g.includes('les références en tension que nous avons en stock'), g);
  assert.ok(!/\b0 référence/.test(g));
});

test('singulier correct pour une seule reference en stock', () => {
  const c = MOD.rendre('routine', { ...CTX, ruptures_tension: 4, ruptures_stock: 1 }).corps;
  assert.ok(c.includes('1 référence que vous achetez et qui figure sur'), c);
});

test('le CA de l officine entre dans routine et offre', () => {
  ['routine', 'offre'].forEach(k => {
    const c = MOD.rendre(k, CTX).corps;
    assert.ok(c.includes('43 812 €'), `CA absent de ${k}`);
    assert.ok(c.includes('cette année'), k);
  });
});

test('les modeles GROUPES restent muets sur les chiffres', () => {
  // Un seul corps part vers 25 officines en copie cachee : un chiffre y
  // serait faux pour 24 d entre elles.
  const ctx = { ...CTX, ruptures_tension: 3, ruptures_stock: 2 };
  ['bilan', 'offre', 'routine'].forEach(k => {
    const c = MOD.rendreGroupe(k, ctx).corps;
    assert.ok(!c.includes('43 812'), `CA present dans le groupe ${k}`);
    assert.ok(!c.includes('3 références'), `ruptures presentes dans le groupe ${k}`);
    assert.ok(!c.includes('Mme Tritsch'), `contact nomme dans le groupe ${k}`);
  });
});

// ── Modèles personnels ────────────────────────────────────────────
const PERSO = {
  nom: 'Mon relationnel',
  objet: 'Un café, {{officine}} ?',
  corps: 'Bonjour {{contact}},\n\nÇa fait {{mois}} qu’on ne s’est pas vus, et vous ' +
         'faites {{ca}} avec nous cette année.\n\nOn se cale ça ?\n{{lien}}'
};

test('un modele personnel remplit toutes ses etiquettes', () => {
  const r = MOD.rendrePerso(PERSO, CTX);
  assert.ok(r.objet.includes('PHARMACIE RIVE SUD'), r.objet);
  assert.ok(r.corps.includes('Mme Tritsch'), r.corps);
  assert.ok(r.corps.includes('7 mois'), r.corps);
  assert.ok(r.corps.includes('43 812 €'), r.corps);
  assert.ok(r.corps.includes(CTX.lien), r.corps);
  assert.ok(!/\{\{/.test(r.corps + r.objet), 'etiquette non remplie');
});

test('signature et mention STOP sont ajoutees, jamais oubliables', () => {
  const r = MOD.rendrePerso(PERSO, CTX);
  assert.ok(r.corps.includes('Intégral Pharma'), r.corps);
  assert.ok(/STOP/.test(r.corps), r.corps);
});

test('un modele personnel sans {{lien}} recoit quand meme le lien', () => {
  const sansLien = { ...PERSO, corps: 'Bonjour, on se voit ?' };
  const r = MOD.rendrePerso(sansLien, CTX);
  assert.ok(r.corps.includes(CTX.lien), r.corps);
  assert.ok(MOD.persoValider(sansLien).avertissements.some(a => a.includes('{{lien}}')));
});

test('officine sans titulaire : pas de « Bonjour , »', () => {
  const r = MOD.rendrePerso(PERSO, { ...CTX, contact: '' });
  assert.ok(!/Bonjour\s+,/.test(r.corps), r.corps);
  assert.ok(r.corps.startsWith('Bonjour,'), r.corps);
});

test('jamais de « undefined » ni d etiquette vide dans un modele personnel', () => {
  const r = MOD.rendrePerso(PERSO, { lien: 'https://x.fr/r' });
  assert.ok(!/undefined|NaN|\{\{/.test(r.corps + r.objet), r.corps);
  assert.ok(r.corps.includes('un moment'), r.corps);   // repli de {{mois}}
});

test('en envoi GROUPE, un modele qui nomme l officine est REFUSE', () => {
  const r = MOD.rendrePerso(PERSO, CTX, { groupe: true });
  assert.equal(r.refus, 'nominatif');
  assert.ok(r.etiquettes.includes('officine'));
  assert.ok(r.etiquettes.includes('ca'));
  assert.equal(r.corps, undefined, 'un refus ne doit produire aucun corps');
});

test('en envoi GROUPE, un modele neutre passe', () => {
  const neutre = { nom: 'Neutre', objet: 'Je passe dans votre secteur',
                   corps: 'Bonjour,\n\nJe passe bientôt. Choisissez :\n{{lien}}' };
  const r = MOD.rendrePerso(neutre, CTX, { groupe: true });
  assert.equal(r.refus, undefined);
  assert.ok(r.corps.includes(CTX.lien));
  assert.ok(/STOP/.test(r.corps));
});

test('un pourcentage dans un modele personnel est refuse a l enregistrement', () => {
  const v = MOD.persoValider({ ...PERSO, corps: PERSO.corps + '\nOn vous rend 3,89 % de plus.' });
  assert.equal(v.ok, false);
  assert.ok(v.erreurs.some(e => e.includes('pourcentage')), v.erreurs.join(' | '));
});

test('une etiquette inventee est signalee, pas ignoree', () => {
  const v = MOD.persoValider({ ...PERSO, corps: 'Bonjour {{patron}}, {{lien}}' });
  assert.equal(v.ok, false);
  assert.ok(v.erreurs.some(e => e.includes('{{patron}}')), v.erreurs.join(' | '));
});

test('un modele personnel valide passe la validation', () => {
  const v = MOD.persoValider(PERSO);
  assert.equal(v.ok, true, v.erreurs.join(' | '));
  assert.ok(v.nominatives.length > 0);
});

test('le rendu HTML d un modele personnel garde le refus groupe', () => {
  assert.equal(MOD.rendrePersoHtml(PERSO, CTX, { groupe: true }).refus, 'nominatif');
  assert.ok(MOD.rendrePersoHtml(PERSO, CTX).html.includes('<a href='));
});

// ── Le mot d après-visite ─────────────────────────────────────────
test('le remerciement est court, signe, et sans mention STOP', () => {
  const r = MOD.remerciement({ ...CTX, date_visite: 'mardi 12 août' });
  assert.ok(r.corps.includes('Mme Tritsch'), r.corps);
  assert.ok(r.corps.includes('mardi 12 août'), r.corps);
  assert.ok(r.corps.includes('Intégral Pharma'), r.corps);
  assert.ok(!/STOP/.test(r.corps), 'un remerciement n est pas une sollicitation');
  assert.ok(r.corps.length < 700, `trop long : ${r.corps.length}`);
});

test('le remerciement ne laisse passer aucun pourcentage', () => {
  const r = MOD.remerciement({ ...CTX, texte_libre: 'Je vous rends 3,89 % de plus.' });
  assert.ok(!/3,89/.test(r.corps), r.corps);
  assert.ok(r.avertissement.includes('pourcentage'));
});

test('le remerciement porte le lien pour reprendre un rendez-vous', () => {
  assert.ok(MOD.remerciement(CTX).corps.includes(CTX.lien));
});

test('une etiquette vide ne laisse ni tiret ni deux-points orphelins', () => {
  const mod = { nom: 'X', objet: 'Test',
                corps: 'Bonjour {{contact}},\n\n• ce que vous faites avec nous — {{ca}}\n• {{tension}}\n{{lien}}' };
  const r = MOD.rendrePerso(mod, { lien: 'https://x.fr/r' });
  const ecrit = r.corps.split('Bien à vous,')[0];
  assert.ok(!/[—–:-]\s*$/m.test(ecrit), 'separateur orphelin : ' + ecrit);
  assert.ok(!/cette année/.test(r.corps), 'phrase amputee : ' + r.corps);
  assert.ok(r.corps.startsWith('Bonjour,'), r.corps);
});

test('les deux-points francais gardent leur espace', () => {
  // « vous: » au lieu de « vous : » dans un mail signe se remarque.
  MOD.liste().forEach(m => {
    const c = MOD.rendre(m.cle, CTX).corps.replace(/https?:\/\/\S+/g, '');
    assert.ok(!/[a-zé]:/.test(c), `deux-points colles dans ${m.cle} : ` + c);
  });
  const r = MOD.rendrePerso({ nom: 'X', objet: 'O', corps: 'Trois choses à voir :\n• une\n{{lien}}' },
                            { lien: 'https://x.fr/r' });
  assert.ok(r.corps.includes('à voir :'), r.corps);
});

test('{{ca}} porte sa propre phrase', () => {
  const r = MOD.rendrePerso({ nom: 'X', objet: 'O', corps: 'Vous faites {{ca}}.\n{{lien}}' }, CTX);
  assert.ok(r.corps.includes('43 812 € cette année.'), r.corps);
});
