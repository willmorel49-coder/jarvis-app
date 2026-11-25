/* Capteur d'erreurs de crm/v2/index.html (table js_erreur), 25/11/2026.
   Mesuré en production : un VISITEUR n'a plus le droit d'écrire dans js_erreur (« permission denied »),
   un compte CONNECTÉ si. Le capteur envoyait toujours avec la clé publique, donc en visiteur :
   plus aucune erreur enregistrée depuis le 13/08. Il doit présenter le jeton de la session.
   Le code exécuté est celui de la page livrée, découpé entre deux repères — jamais recopié.
   Lancer : node --test tests/capteur-erreurs-session.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const PAGE = readFileSync(new URL('../crm/v2/index.html', import.meta.url), 'utf8');

function bloc(debut, fin) {
  const i = PAGE.indexOf(debut);
  assert.ok(i >= 0, 'repère introuvable : ' + debut);
  const j = PAGE.indexOf(fin, i);
  assert.ok(j > i, 'repère de fin introuvable : ' + fin);
  return PAGE.slice(i, j);
}

const CODE = bloc('var __erreurEnvoyee = 0;', "window.addEventListener('error'");

function monter(session) {
  const envois = [];
  const sb = { String, JSON, Promise };
  sb.window = sb;
  sb.__BUILD = 'essai';
  sb.SUPABASE_URL = 'https://exemple.supabase.co';
  sb.SUPABASE_ANON_KEY = 'cle-publique';
  sb.navigator = { userAgent: 'essai', standalone: false };
  sb.matchMedia = () => ({ matches: false });
  sb.fetch = (url, o) => { envois.push({ url, o }); return Promise.resolve({ status: 201 }); };
  if (session !== undefined) {
    sb.V2 = {
      user: session ? { id: 'u1' } : null,
      sb: () => ({ auth: { getSession: () => Promise.resolve({ data: { session } }) } })
    };
  }
  vm.runInNewContext(CODE + '\nwindow.__signaler = __signaler;', sb);
  return { sb, envois };
}
const laisserFinir = () => new Promise((r) => setTimeout(r, 0));

test('connecté : l’erreur part avec le jeton de la session, pas avec la clé publique', async () => {
  const { sb, envois } = monter({ access_token: 'jeton-utilisateur' });
  sb.__signaler('Boum', 'pharma', 'pile');
  await laisserFinir();
  assert.equal(envois.length, 1);
  assert.equal(envois[0].url, 'https://exemple.supabase.co/rest/v1/js_erreur');
  assert.equal(envois[0].o.headers.Authorization, 'Bearer jeton-utilisateur');
  assert.equal(envois[0].o.headers.apikey, 'cle-publique');
  const corps = JSON.parse(envois[0].o.body);
  assert.equal(corps.message, '[essai] Boum');
  assert.equal(corps.ecran, 'pharma');
  assert.equal(corps.connecte, true);
});

test('sans session : rien n’est envoyé (la base refuserait un visiteur)', async () => {
  const { sb, envois } = monter(null);
  sb.__signaler('Boum', 'home', '');
  await laisserFinir();
  assert.equal(envois.length, 0);
});

test('client pas encore prêt : rien n’est envoyé, et l’envoi n’est pas décompté', async () => {
  const { sb, envois } = monter(undefined);
  sb.__signaler('Boum', 'home', '');
  await laisserFinir();
  assert.equal(envois.length, 0);
  sb.V2 = { user: { id: 'u1' }, sb: () => ({ auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'j' } } }) } }) };
  for (let i = 0; i < 5; i++) sb.__signaler('Boum ' + i, 'home', '');
  await laisserFinir();
  assert.equal(envois.length, 3, 'jamais plus de 3 envois, et les essais sans client ne comptent pas');
});

/* 25/11/2026 : chaque rapport commence par [__BUILD], « pour savoir QUELLE version a produit un rapport ».
   Écrit en dur le 14/08 ('20260814a'), il n'a jamais suivi le jeton : la page en était à 20261125p, et le seul
   rapport reçu ce jour-là disait encore [20260814a]. L'étiquette doit être le jeton que la page sert. */
test('l’étiquette des rapports est le jeton servi par la page, pas une date figée', () => {
  const ligne = PAGE.match(/var __BUILD = [^\n]*;/);
  assert.ok(ligne, 'ligne de __BUILD introuvable');
  const sb = {};
  vm.runInNewContext(ligne[0] + '\nthis.lu = __BUILD;', sb);
  const SW = readFileSync(new URL('../crm/v2/sw.js', import.meta.url), 'utf8');
  const ver = SW.match(/var VER\s*=\s*'([^']*)'/)[1];
  assert.equal(sb.lu, ver, 'étiquette ' + sb.lu + ' ≠ jeton de la page ' + ver);
});
