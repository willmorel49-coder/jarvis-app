import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

// 26/11/2026 — Will : « voir qui a eu des rendez-vous depuis janvier 2026 et qui n'en a pas eu, pour avoir un suivi par
// pharma ». Choix cliqué : un appel n'est pas un rendez-vous, mais il est montré. Titres FICTIFS (aucun titre de son agenda).

const require = createRequire(import.meta.url);
const R = require('../crm/v2/v2-rdv-reco.js');
const lire = (f) => fs.readFileSync(new URL('../crm/v2/' + f, import.meta.url), 'utf8');

test('un rappel (appel, mail, vérification, commande) n’est pas une visite ; « Allez voir phie … » en est une', () => {
  const appels = ['Appeler phie du moulin', 'APPELER PHIE DES ESSAIS', 'Tel Prise de rdv Phie des tilleuls',
    'Call phie des sources verif facture', 'Pharmavie la prairie appeler', 'Rappeler Phie de la gare'];
  const taches = ['Faire mail Phie de la gare (prix)', 'Vérifie Repatha Phie du centre', 'Pas reçu Phie des landes',
    '1 Munjaro 2,5mg Phie des mares'];
  const visites = ['Allez voir phie du moulin', 'Allez Phie du centre Ville-A', 'Phie cœur de village', 'Pharmacie des landes',
    'PHIE ESSAIS /', 'Pharmcie des fougères', 'Phie du port (voir collègue réunion)'];
  for (const t of appels) assert.equal(R.rappel(t), 'appel', t);
  for (const t of taches) assert.equal(R.rappel(t), 'tache', t);
  for (const t of visites) assert.equal(R.rappel(t), '', t);
  assert.equal(R.rappel(''), '');
  assert.equal(R.rappel(null), '');
});

function isoLocal(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
const aujourdhui = isoLocal(new Date());
const anDernier = (() => { const d = new Date(new Date().getFullYear(), 0, 1); d.setDate(d.getDate() - 10); return isoLocal(d); })();
const attendre = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };

function ecran() {
  const from = () => {
    const o = { select() { return o; }, order() { return o; }, limit() { return o; }, maybeSingle() { return o; }, eq() { return o; }, gte() { return o; }, lte() { return o; }, lt() { return o; },
      then(ok, ko) { return Promise.resolve({ data: [], error: null }).then(ok, ko); } };
    return o;
  };
  const rpc = () => ({ then(ok, ko) { return Promise.resolve({ data: [], error: null }).then(ok, ko); } });
  const doc = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ appendChild() {} }), head: { appendChild() {} }, addEventListener() {} };
  const ctx = { console, Date, Math, JSON, String, Number, Array, Object, Promise, setTimeout, clearTimeout, RegExp, document: doc,
    navigator: { userAgent: 'node', platform: 'node', maxTouchPoints: 0 }, localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.PHARMA_FR = { p: [] };
  ctx.V2 = {
    user: { id: 'u', commercial: 'AAA' }, sb: () => ({ from, rpc }),
    pharmacies: [
      { id: '9500001', name: 'PHARMACIE DES ESSAIS', ville: 'VILLE-A', comms: ['AAA'] },    // visite notée dans l'agenda
      { id: '9500002', name: 'PHARMACIE DU BANC', ville: 'VILLE-B', comms: ['AAA'] },       // seulement un appel
      { id: '9500003', name: 'PHARMACIE DE LA SONDE', ville: 'VILLE-C', comms: ['AAA'] },   // vue l'an dernier seulement
      { id: '9500004', name: 'PHARMACIE DU TEMOIN', ville: 'VILLE-D', comms: ['AAA'] },     // « vu le … » coché
    ],
    todo: { tous: () => [], libelle: (t) => t.note, tombeLe: () => false }, rdv: { proposer() {} },
    rdvInfo: (k) => ({ email: k + '@exemple.invalid' }),
    rdvVuLe: () => null,
    visite: { all: () => ({ '9500004': aujourdhui }) },
    rdvAgenda: { relever: () => Promise.resolve(null), charger: () => Promise.resolve({ actif: true, hote: 'calendar.google.com', dernier_ok: new Date().toISOString() }) },
    rdvAlias: { charger: () => Promise.resolve({}) },
    planningIndex: () => ({ porte: [], nat: [] }),
    planningAppelerAgenda: () => Promise.resolve({ ok: true, evenements: [
      { date: aujourdhui, debut: '09:30:00', fin: '10:30:00', jour_entier: false, titre: 'Pharmacie des essais' },
      { date: aujourdhui, debut: '11:30:00', fin: '12:30:00', jour_entier: false, titre: 'Appeler phie du banc' },
      { date: anDernier, debut: '14:00:00', fin: '15:00:00', jour_entier: false, titre: 'Phie de la sonde' },
    ] }),
    ensurePharmaFr: (cb) => cb(),
    go() {},
  };
  vm.createContext(ctx);
  const ids = { essais: '9500001', banc: '9500002', sonde: '9500003' };
  ctx.V2RECO = {
    apparier: (t) => { const k = Object.keys(ids).find((x) => new RegExp(x, 'i').test(t)); return k ? { officine: { id: ids[k], name: 'X' }, etat: 'reconnu' } : {}; },
    rappel: R.rappel,
  };
  vm.runInContext(lire('v2-todo-mois.js'), ctx);
  return ctx.V2;
}

test('« Suivi depuis le 1er janvier » : vue cette année d’un côté, aucun rendez-vous de l’autre ; l’appel est signalé, pas compté', async () => {
  const V2 = ecran();
  V2.todoMois.html(); await attendre();
  const h = V2.todoMois.html();
  const an = aujourdhui.slice(0, 4);
  assert.match(h, new RegExp('<h2 class="tm-cht">Suivi depuis le 1<sup>er</sup> janvier ' + an + '</h2>'), 'marqueur : la section est là');
  assert.match(h, /<b>2<\/b> sur 4 ont eu un rendez-vous depuis janvier · <b>2<\/b> aucun \(1 avec seulement un appel ou un mail\)/);
  const sans = h.split('Aucun rendez-vous depuis janvier <b>')[1].split('Vues depuis janvier <b>')[0];
  const vues = h.split('Vues depuis janvier <b>')[1];
  assert.match(sans, /<b>Banc<\/b>/, 'seulement appelée : sans rendez-vous');
  assert.match(sans, /appelée le /, 'l’appel est montré');
  assert.match(sans, /<b>Sonde<\/b>/, 'vue l’an dernier seulement : sans rendez-vous cette année');
  assert.match(vues, /<b>Essais<\/b>/, 'visite de l’agenda');
  assert.match(vues, /<b>Temoin<\/b>/, '« vu le … » coché');
  assert.match(vues, /1 rendez-vous/);
  assert.doesNotMatch(vues, /Banc|Sonde/);
});

test('un appel à venir n’est pas un « rendez-vous posé »', async () => {
  const V2 = ecran();
  V2.todoMois.html(); await attendre();
  const h = V2.todoMois.html();
  assert.match(h, /<b>1<\/b> sur 4 ont un rendez-vous à venir · <b>3<\/b> sans rendez-vous/, 'seule la visite des Essais est posée');
});
