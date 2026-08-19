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

test('UNE seule proposition est offerte au commercial', () => {
  // 19/08/2026, Will : « une seule propo, ultra carre, pas besoin de
  // differents motifs ». Trois textes, c etaient trois occasions de diverger.
  const l = MOD.liste();
  assert.equal(l.length, 1, JSON.stringify(l));
  assert.equal(l[0].cle, 'routine');
});

test('les anciennes cles rendent quand meme le mail', () => {
  // Des jetons crees avant le 19/08 vivent encore 21 jours et portent
  // modele='bilan' ou 'offre'. Ils ne doivent pas tomber sur du vide.
  ['bilan', 'offre', 'inconnu'].forEach(k => {
    const r = MOD.rendre(k, CTX);
    assert.ok(r.corps.includes('Trois points au programme'), k);
    assert.ok(r.corps.includes(CTX.lien), k);
  });
});

test('les trois points sont ceux que Will a dictes, dans l ordre', () => {
  const c = MOD.rendre('routine', { ...CTX, ruptures_stock: 5 }).corps;
  assert.ok(c.includes('• Vos chiffres —'), c);
  assert.ok(c.includes('• Votre liste personnalisée —'), c);
  assert.ok(c.includes('• L’actualité du secteur —'), c);
  assert.ok(c.indexOf('Vos chiffres') < c.indexOf('Votre liste personnalisée'), c);
  assert.ok(c.indexOf('Votre liste personnalisée') < c.indexOf('L’actualité du secteur'), c);
});

test('le mot d introduction entre avant les trois points', () => {
  const c = MOD.rendre('routine', { ...CTX, texte_libre: 'Nous référençons la gamme diabète.' }).corps;
  assert.ok(c.includes('Nous référençons la gamme diabète.'), c);
  assert.ok(c.indexOf('Nous référençons') < c.indexOf('Trois points au programme'), c);
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

test('la promesse de desinscription figure dans les trois modeles', () => {
  // Le mot « STOP » a disparu le 19/08 (registre de SMS publicitaire dans un
  // mail signe). La PROMESSE, elle, ne peut pas disparaitre : l ecran de suivi
  // l honore reellement, et chaque mail groupe la porte par ecrit.
  MOD.liste().forEach(m => {
    const c = MOD.rendre(m.cle, CTX).corps;
    assert.ok(/ne souhaitez plus recevoir/.test(c), `promesse absente de ${m.cle}`);
    assert.ok(!/STOP/.test(c), `« STOP » est revenu dans ${m.cle}`);
  });
  ['bilan', 'offre', 'routine'].forEach(k => {
    assert.ok(/ne souhaitez plus recevoir/.test(MOD.rendreGroupe(k, CTX).corps), k);
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
    const c = MOD.rendre(m.cle, CTX).corps + MOD.rendreGroupe(m.cle, CTX).corps;
    assert.ok(!/12\s?000/.test(c), `montant d abandon present dans ${m.cle}`);
    assert.ok(!/%/.test(c), `pourcentage present dans ${m.cle}`);
  });
});

test('on annonce NOTRE stock, jamais le nombre de tensions', () => {
  const c = MOD.rendre('routine', { ...CTX, ruptures_tension: 79, ruptures_stock: 50 }).corps;
  // 79 = ce qu elle achete et qui a ete signale un jour. 50 = ce que NOUS
  // avons. Seul le second est verifiable, et actionnable.
  assert.ok(!/79/.test(c), 'le nombre de tensions ne doit pas sortir : ' + c);
  assert.ok(c.includes('50 de vos références sont aujourd’hui signalées en tension'), c);
});

test('sans stock a annoncer, on promet la liste, pas un chiffre absent', () => {
  const c = MOD.rendre('routine', { ...CTX, ruptures_tension: 12, ruptures_stock: 0 }).corps;
  assert.ok(c.includes('Votre liste personnalisée — établie avant ma venue'), c);
  assert.ok(!/12 de vos références/.test(c), c);
  assert.ok(!/0 de vos références/.test(c), c);
});

test('l etiquette {{tension}} reste utilisable dans un modele personnel', () => {
  // Elle ne sert plus a la proposition livree, mais les modeles personnels
  // l offrent toujours : la retirer casserait ceux qui l utilisent deja.
  const mod = { nom: 'X', objet: 'O', corps: 'Voici {{tension}}.\n{{lien}}' };
  assert.ok(MOD.rendrePerso(mod, { ...CTX, ruptures_stock: 3 }).corps
    .includes('3 de vos références signalées en tension'));
  assert.ok(MOD.rendrePerso(mod, { ...CTX, ruptures_stock: 0 }).corps
    .includes('vos références signalées en tension par l’ANSM'));
});

test('le CA de l officine entre dans la proposition', () => {
  ['routine'].forEach(k => {
    const c = MOD.rendre(k, CTX).corps;
    assert.ok(c.includes('43 812 €'), `CA absent de ${k}`);
    assert.ok(c.includes('depuis le début de l’année'), k);
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
  // ⚠️ Remis en casse propre : les fichiers sont EN MAJUSCULES, et
  // « Un café, PHARMACIE RIVE SUD ? » criait « mail automatique ».
  assert.ok(r.objet.includes('Pharmacie Rive Sud'), r.objet);
  assert.ok(!/PHARMACIE/.test(r.objet + r.corps), r.objet);
  assert.ok(r.corps.includes('Mme Tritsch'), r.corps);
  assert.ok(r.corps.includes('7 mois'), r.corps);
  assert.ok(r.corps.includes('43 812 € depuis le début de l’année'), r.corps);
  assert.ok(r.corps.includes(CTX.lien), r.corps);
  assert.ok(!/\{\{/.test(r.corps + r.objet), 'etiquette non remplie');
});

test('signature et desinscription sont ajoutees, jamais oubliables', () => {
  const r = MOD.rendrePerso(PERSO, CTX);
  assert.ok(r.corps.includes('Cordialement,'), r.corps);
  assert.ok(r.corps.includes('Intégral Pharma'), r.corps);
  assert.ok(/ne souhaitez plus recevoir/.test(r.corps), r.corps);
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
  assert.ok(/ne souhaitez plus recevoir/.test(r.corps));
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
  assert.ok(!/ne souhaitez plus recevoir/.test(r.corps),
    'un remerciement n est pas une sollicitation');
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
  const ecrit = r.corps.split('Cordialement,')[0];
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
  assert.ok(r.corps.includes('43 812 € depuis le début de l’année.'), r.corps);
});


// ═══════════════════════════════════════════════════════════════════
//  19/08/2026 — « les mails ne sont pas assez pro » (Will)
// ═══════════════════════════════════════════════════════════════════

test('la duree annoncee est la duree REELLE, jamais un nombre en dur', () => {
  // Le modele bilan promettait « Quinze minutes suffisent » alors que le
  // creneau bloque vaut 45 min par defaut, et 60 pour certains commerciaux.
  MOD.liste().forEach(m => {
    const c45 = MOD.rendre(m.cle, { ...CTX, duree_min: 45 }).corps;
    const c60 = MOD.rendre(m.cle, { ...CTX, duree_min: 60 }).corps;
    assert.ok(c45.includes('Comptez 45 minutes'), `45 min absent de ${m.cle} : ` + c45);
    assert.ok(c60.includes('Comptez 60 minutes'), `60 min absent de ${m.cle}`);
    assert.ok(!/[Qq]uinze minutes/.test(c45), `« quinze minutes » est revenu dans ${m.cle}`);
  });
  // Sans reglage connu, on retombe sur le defaut du moteur — jamais sur 15.
  assert.ok(MOD.rendre('bilan', { ...CTX, duree_min: null }).corps.includes('Comptez 45 minutes'));
});

test('la duree vaut aussi pour l envoi groupe', () => {
  // Un seul expediteur : sa duree vaut pour tout le lot, contrairement au nom
  // de l officine et a ses chiffres.
  ['bilan', 'offre', 'routine'].forEach(k => {
    assert.ok(MOD.rendreGroupe(k, { ...CTX, duree_min: 60 }).corps.includes('Comptez 60 minutes'), k);
  });
});

test('les noms EN MAJUSCULES sont remis en casse propre', () => {
  const c = MOD.rendre('routine', { ...CTX, contact: 'JUSTINE ONILLON',
                                    nom_officine: 'PHARMACIE DU MAY' }).corps;
  assert.ok(c.startsWith('Bonjour Justine Onillon,'), c.slice(0, 60));
  assert.ok(!/ONILLON/.test(c), c.slice(0, 80));
});

test('un nom deja bien saisi n est PAS retouche', () => {
  // Abimer une vraie donnee pour « corriger » ce qui est deja correct serait pire.
  assert.equal(MOD.nomPropre('Mme Tritsch'), 'Mme Tritsch');
  assert.equal(MOD.nomPropre('de La Rochefoucauld'), 'de La Rochefoucauld');
  assert.equal(MOD.nomPropre(''), '');
  assert.equal(MOD.nomPropre(null), '');
});

test('les particules restent en bas de casse, les sigles en haut', () => {
  assert.equal(MOD.nomPropre('PHARMACIE DU MAY'), 'Pharmacie du May');
  assert.equal(MOD.nomPropre('PHARMACIE D\'ANJOU'), 'Pharmacie d\'Anjou');
  assert.equal(MOD.nomPropre('SELARL PHARMACIE DES HALLES'), 'SELARL Pharmacie des Halles');
  assert.equal(MOD.nomPropre('GICQUEL - DEROCHE'), 'Gicquel - Deroche');
  // Une particule en tete de nom garde sa majuscule.
  assert.equal(MOD.nomPropre('LA GRANDE PHARMACIE'), 'La Grande Pharmacie');
});

test('la fonction entre dans la signature — et rien n est invente sans elle', () => {
  // CTX n a pas de nom complet : la signature retombe sur le prenom, et c est
  // le comportement d origine — on verifie la FONCTION, pas le nom.
  const nom = { ...CTX, nom_complet_commercial: 'William Morel' };
  const avec = MOD.rendre('routine', { ...nom, fonction_commercial: 'Responsable de secteur' }).corps;
  assert.ok(/William Morel\nResponsable de secteur\nIntégral Pharma/.test(avec), avec);
  const sans = MOD.rendre('routine', nom).corps;
  assert.ok(/William Morel\nIntégral Pharma/.test(sans), sans);
  assert.ok(!/Responsable/.test(sans), sans);
});

test('plus aucun tic de mailing de masse', () => {
  const interdits = [/dix secondes/i, /tomber au mauvais moment/i, /Répondez STOP/i,
                     /Quinze minutes/i, /Bien à vous/];
  ['bilan', 'offre', 'routine'].forEach(k => {
    const un = MOD.rendre(k, CTX).corps;
    const gr = MOD.rendreGroupe(k, CTX).corps;
    interdits.forEach(rx => {
      assert.ok(!rx.test(un), `${rx} encore present dans ${k}`);
      assert.ok(!rx.test(gr), `${rx} encore present dans le groupe ${k}`);
    });
  });
});

test('l etiquette {{duree}} suit le reglage', () => {
  const mod = { nom: 'X', objet: 'O', corps: 'Comptez {{duree}}.\n{{lien}}' };
  assert.ok(MOD.rendrePerso(mod, { ...CTX, duree_min: 60 }).corps.includes('Comptez 60 minutes.'));
});
