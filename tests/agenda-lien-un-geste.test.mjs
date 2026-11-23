// Mes disponibilités › « Mon agenda » par lien à coller (crm/v2/v2-rdv-agenda.js), maquette 2 « Un seul geste »
// choisie par Will le 23/11/2026. Le fichier est chargé tel quel dans node:vm, sur un faux DOM, une fausse session
// et une fausse fonction serveur qui note chaque appel. On éprouve le CHEMIN réel : presse-papiers → case → appel
// « brancher » → retour à l'écran. Marqueur positif d'abord à chaque fois.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../crm/v2/v2-rdv-agenda.js', import.meta.url), 'utf8');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

function element(id) {
  const ecoute = {};
  return {
    id, value: '', innerHTML: '', className: '', hidden: id === 'v2-ag-depli', attrs: {}, focused: false,
    addEventListener(t, f) { (ecoute[t] = ecoute[t] || []).push(f); },
    declencher(t) { (ecoute[t] || []).forEach((f) => f({})); },
    setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k] ?? null; },
    closest() { return null; }, focus() { this.focused = true; },
    classList: { toggle() {} }, set textContent(t) { this.innerHTML = String(t); }
  };
}

function monter({ email = 'exemple@integralpharma.fr', presse = null, refus = false, reponse = { ok: true, evenements_lus: 41, plages_gardees: 23 } } = {}) {
  const els = {}; ['v2-ag-url', 'v2-ag-res', 'v2-ag-guide', 'v2-ag-depli', 'v2-ag-ou', 'v2-ag-ti', 'v2-ag-box'].forEach((i) => { els[i] = element(i); });
  const appels = [], allers = [], toasts = [];
  const doc = {
    getElementById: (i) => els[i] || null, querySelector: () => null, querySelectorAll: () => [],
    createElement: () => ({ set textContent(t) {} }), head: { appendChild() {} }
  };
  const ctx = {
    console, Date, Math, JSON, String, Number, Array, Object, Promise, setTimeout, clearTimeout, RegExp,
    document: doc,
    navigator: { clipboard: { readText: () => (refus ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(presse)) } },
    fetch: (url, o) => { appels.push({ url, corps: JSON.parse(o.body) }); return Promise.resolve({ json: () => Promise.resolve(reponse) }); },
    SUPABASE_URL: 'https://exemple.supabase.co', SUPABASE_ANON_KEY: 'cle-publique',
    confirm: () => true
  };
  ctx.window = ctx;
  ctx.V2 = {
    user: { id: 'u-moi', email },
    sb: () => ({ auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'jeton' } } }) } }),
    go: (r) => allers.push(r), toast: (t) => toasts.push(t), pages: { rdvplanning: {} },
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { A: ctx.V2.rdvAgenda, els, appels, allers, toasts };
}

test('outil présélectionné : @integralpharma.fr → Outlook, gmail → Google, agenda branché → son hébergeur', () => {
  let m = monter();
  const h = m.A.bloc(null);
  assert.match(h, /Coller le lien de mon agenda/, 'marqueur positif : le gros bouton du geste unique');
  assert.match(h, /Branchez votre agenda Outlook/);
  assert.match(h, /data-m="outlook" class="on"/);
  assert.match(h, /choisi d’après votre adresse @integralpharma\.fr/);

  m = monter({ email: 'exemple@gmail.com' });
  assert.match(m.A.bloc(null), /Branchez votre agenda Google/);

  m = monter();
  const b = m.A.bloc({ hote: 'calendar.google.com', actif: true, dernier_ok: new Date().toISOString(), plages_gardees: 23 });
  assert.match(b, /Google Agenda branché/, 'état branché affiché');
  m.A.changer();
  assert.match(m.els['v2-ag-box'].innerHTML, /Branchez votre agenda Google/, '« Changer de lien » rouvre sur l’hébergeur déjà branché');
});

test('l’adresse de l’agenda n’est jamais réaffichée, même si elle arrive avec la ligne', () => {
  const m = monter();
  const h = m.A.bloc({ hote: 'outlook.office365.com', url: 'https://outlook.office365.com/owa/calendar/SECRET-XYZ/calendar.ics', actif: true, dernier_ok: new Date().toISOString() });
  assert.match(h, /Outlook branché/, 'marqueur positif');
  assert.doesNotMatch(h, /SECRET-XYZ/);
});

test('mode d’emploi : lien direct vers les réglages, note « sur ordinateur » pour Google', () => {
  const m = monter();
  m.A.bloc(null); m.A.aide();
  const g = m.els['v2-ag-guide'].innerHTML;
  assert.match(g, /href="https:\/\/outlook\.office\.com\/calendar\/options\/calendar\/SharedCalendars"/);
  assert.match(g, /Peut voir quand je suis occupé/, 'Will, 23/11 : on garde « occupé » seul');
  assert.match(m.els['v2-ag-ti'].innerHTML, /Outlook/);
  m.A.aide('google');
  assert.match(m.els['v2-ag-guide'].innerHTML, /href="https:\/\/calendar\.google\.com\/calendar\/r\/settings"/);
  assert.match(m.els['v2-ag-guide'].innerHTML, /Sur ordinateur/);
  assert.match(m.els['v2-ag-ti'].innerHTML, /Google/, 'le titre suit l’outil choisi');
});

test('un toucher : le presse-papiers part tel quel en « brancher », une seule lecture, puis retour à l’écran', async () => {
  const lien = 'https://outlook.office365.com/owa/calendar/abc@integralpharma.fr/def/calendar.ics';
  const m = monter({ presse: '  ' + lien + '\n' });
  m.A.bloc(null);
  m.A.coller();
  await pause(20);
  assert.equal(m.appels.length, 1, 'un seul appel serveur');
  assert.equal(m.appels[0].corps.action, 'brancher');
  assert.equal(m.appels[0].corps.url, lien, 'lien nettoyé des espaces');
  assert.match(m.appels[0].url, /\/functions\/v1\/agenda$/);
  assert.deepEqual(m.allers, ['rdvdispo']);
  assert.deepEqual(m.toasts, ['Agenda connecté.']);
});

test('presse-papiers refusé ou vide : on invite à coller à la main, rien ne part', async () => {
  for (const o of [{ refus: true }, { presse: '' }]) {
    const m = monter(o);
    m.A.bloc(null); m.A.coller();
    await pause(20);
    assert.match(m.els['v2-ag-res'].innerHTML, /Collez le lien dans la case/);
    assert.equal(m.els['v2-ag-url'].focused, true);
    assert.equal(m.appels.length, 0);
  }
});

test('lien refusé par le serveur : la raison s’affiche en clair, on reste sur place', async () => {
  const m = monter({ presse: 'https://exemple.fr/agenda.ics', reponse: { ok: false, raison: 'hebergeur_inconnu' } });
  m.A.bloc(null); m.A.coller();
  await pause(20);
  assert.equal(m.appels.length, 1, 'marqueur positif : l’appel est bien parti');
  assert.match(m.els['v2-ag-res'].innerHTML, /ne vient pas d’un agenda Google, Outlook ou iCloud/);
  assert.equal(m.els['v2-ag-res'].className, 'v2-ag-res ko');
  assert.deepEqual(m.allers, []);
});

test('collé à la main dans la case : branché tout seul, une fois par lien', async () => {
  const m = monter();
  m.A.bloc(null);
  await pause(5);                                   // l'écoute se pose après l'affichage
  const e = m.els['v2-ag-url'];
  e.value = 'pas un lien'; e.declencher('input');
  await pause(420);
  assert.equal(m.appels.length, 0, 'du texte qui n’est pas un lien ne part pas');
  e.value = 'webcal://p01-caldav.icloud.com/published/2/abc'; e.declencher('paste'); e.declencher('input');
  await pause(420);
  assert.equal(m.appels.length, 1, 'un seul appel malgré deux évènements');
  assert.equal(m.appels[0].corps.action, 'brancher');
  e.declencher('input');
  await pause(420);
  assert.equal(m.appels.length, 1, 'même lien : pas de deuxième lecture');
});
