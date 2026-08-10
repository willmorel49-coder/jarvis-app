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
