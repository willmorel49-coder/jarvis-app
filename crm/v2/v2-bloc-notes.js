/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Bloc-notes (V2.pages.blocnotes) — 16/10/2026
   Chaque commercial note au fil de la journée (écrit, dictée, ou note vocale). Le soir, un robot lit les notes et PROPOSE des
   mises à jour du CRM (compte rendu dans la ligne `bloc_notes`). Le commercial les APPLIQUE d'un geste, sous son identité,
   par les fonctions existantes du CRM : V2.notes.addAuto, V2.profil.poserPlusieurs / saveOverride, V2.todo.ajouterLigne.
   Règles : notes PRIVÉES (RLS), jamais de delete (on archive), rien n'est marqué « appliqué » avant que l'écriture soit relue
   en base, un enregistrement vocal n'est jamais perdu (IndexedDB tant qu'il n'est pas dans la base).
   Brouillons (avenant du 16/10 soir) : une note naît `brouillon`, privée ; le robot ne lit que `a_lire`. Le commercial l'envoie (ou la reprend) d'un geste.
   Rien n'est chargé au démarrage de l'app : l'écran n'interroge la base qu'à son ouverture.
   Contrat des données : voir le cahier des charges (compte_rendu, suites).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2; if (!V2) return;
  // 19/10/2026 — micro posé DANS le champ (V2.notes.champ, v2-notes.js) ; le champ reste tel quel si ce module n'est pas encore chargé ou si l'appareil n'a pas de dictée.
  function micChamp(h, t) { return (V2.notes && V2.notes.champ) ? V2.notes.champ(h, t) : h; }
  V2.pages = V2.pages || {};
  var TABLE = 'bloc_notes', BUCKET = 'notes-vocales', MAX_S = 300;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function isOpso() { return !!(window.V2_BRAND && window.V2_BRAND.opso); }
  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || ''; }
  function $(s, r) { return (r || document).querySelector(s); }
  function toast(m, v) { if (V2.toast) V2.toast(m, v); }
  function uuid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    var b = new Uint8Array(16);
    try { crypto.getRandomValues(b); } catch (e) { for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  // ——— Feuille de style (posée une fois, avec le module) ———
  (function () {
    if (document.getElementById('v2-bloc-notes-css')) return;
    var st = document.createElement('style'); st.id = 'v2-bloc-notes-css';
    st.textContent = [
      '.v2-wrap.bn-wrap{max-width:760px}',
      '.bn-tete h1{margin:0 0 4px;font-size:26px;letter-spacing:-.02em;color:var(--ip-ink)}',
      '.bn-tete p{margin:0 0 14px;font-size:14.5px;line-height:1.45;color:var(--ip-ink-2)}',
      'svg.bn-i{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}',
      '.bn-band{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:0 0 14px;padding:12px 14px;border-radius:var(--r-md);background:var(--halo);color:var(--ip-blue-d);font-size:15px;font-weight:700}',
      '.bn-band[hidden]{display:none}',
      '.bn-band span{flex:1 1 180px}',
      '.v2-card.bn-ecrire,.v2-card.bn-voix,.v2-card.bn-att{padding:16px;margin:0 0 14px}',
      '.bn-h{margin:0 0 10px;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}',
      '.bn-ta{display:block;width:100%;box-sizing:border-box;min-height:110px;padding:12px;border:1px solid var(--line-strong);border-radius:11px;font:inherit;font-size:16px;line-height:1.45;color:var(--ip-ink);background:var(--card);resize:vertical}',
      '.bn-ta:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '.bn-ligne{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:10px}',
      '.bn-ligne .v2-btn,.bn-b{min-height:44px}',
      '.bn-mic{flex:none;width:44px;height:44px;border-radius:11px;border:1px solid var(--line-strong);background:var(--card);color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}',
      '.bn-mic:hover{color:var(--ip-blue);border-color:var(--ip-blue)}',
      '.bn-mic.rec{color:#fff;background:var(--c-rose);border-color:var(--c-rose)}',
      '.bn-b{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 16px;border:1px solid var(--line-strong);border-radius:var(--r-btn);background:var(--card);font-family:var(--font);font-size:14.5px;font-weight:700;color:var(--ip-blue);cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.bn-b:hover{background:var(--card-2)}',
      '.bn-b[disabled]{color:var(--muted);cursor:default}',
      '.bn-b--rose{color:var(--c-rose-txt)}',
      '.bn-msg{margin:10px 0 0;font-size:14px;line-height:1.4;color:var(--ip-ink-2)}',
      '.bn-msg:empty{display:none}',
      '.bn-msg--ko{color:var(--c-rose-txt);font-weight:600}',
      '.bn-msg--ok{color:var(--c-mint-txt);font-weight:600}',
      '.bn-chrono{display:inline-flex;align-items:center;gap:8px;font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ip-ink)}',
      '.bn-point{width:12px;height:12px;border-radius:50%;background:var(--c-rose)}',
      '.bn-audio{display:block;width:100%;margin-top:10px}',
      '.bn-jour{margin:20px 2px 8px;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}',
      '.v2-card.bn-note{padding:14px 16px;margin:0 0 10px}',
      '.bn-top{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:13.5px;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.bn-top b{color:var(--ip-ink);font-weight:700}',
      '.bn-corps{margin:8px 0 0;font-size:15px;line-height:1.5;color:var(--ip-ink);overflow-wrap:anywhere;white-space:pre-wrap}',
      '.bn-etat{margin:8px 0 0;display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:600;color:var(--ip-ink-2)}',
      '.bn-etat svg{width:16px;height:16px}',
      '.bn-etat--ko{color:var(--c-rose-txt)}',
      '.bn-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '.bn-cr{margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}',
      '.bn-res{margin:0 0 10px;font-size:14.5px;line-height:1.45;color:var(--ip-ink);font-weight:600}',
      '.bn-act{padding:10px 12px;margin:0 0 8px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card-2)}',
      '.bn-act p{margin:0;font-size:14.5px;line-height:1.45;color:var(--ip-ink);overflow-wrap:anywhere}',
      '.bn-act ul{margin:4px 0 0;padding:0 0 0 18px;font-size:14.5px;line-height:1.5;color:var(--ip-ink)}',
      '.bn-act .bn-vu{color:var(--muted)}',
      '.bn-act .bn-fait{margin-top:6px;font-size:13.5px;font-weight:700;color:var(--c-mint-txt)}',
      '.bn-act .bn-ign{margin-top:6px;font-size:13.5px;font-weight:600;color:var(--muted)}',
      '.bn-act .bn-lien{display:inline-flex;align-items:center;min-height:44px;font-size:14px;font-weight:700;color:var(--ip-blue);text-decoration:none}',
      '.bn-inc{margin:0 0 8px;padding:10px 12px;border-radius:var(--r-md);background:#FBEFDC;color:var(--c-amber-txt);font-size:14px;line-height:1.45;font-weight:600;overflow-wrap:anywhere}',
      '.bn-etat--brouillon{color:var(--ip-blue-d)}.bn-vide{padding:22px 8px;text-align:center;font-size:14.5px;color:var(--muted)}',
      '@media (max-width:480px){.v2-wrap.bn-wrap{padding-left:16px;padding-right:16px}.bn-ligne .v2-btn{flex:1 1 auto}}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  // ——— Pictos (trait, comme le reste de l'app) ———
  var P = {
    mic: 'M9 4a3 3 0 016 0v6a3 3 0 01-6 0zM5.5 11a6.5 6.5 0 0013 0M12 17.5V21M8.5 21h7',
    stop: 'M7 7h10v10H7z',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    clock: 'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 7.5V12l3 2',
    alerte: 'M12 4l9 16H3zM12 10v4.5M12 17.5h.01',
    crayon: 'M4 20l1-4L16.5 4.5a2 2 0 013 3L8 19zM14.5 6.5l3 3'
  };
  function ic(n) { return '<svg class="bn-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + P[n] + '"/></svg>'; }

  // ——— Dates ———
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function p2(n) { return ('0' + n).slice(-2); }
  function cleJour(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function jourNum(d) { return d === 1 ? '1er' : String(d); }
  function dateLongue(iso) {   // « jeudi 30 octobre »
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); if (!m) return String(iso || '');
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return JOURS[d.getDay()] + ' ' + jourNum(d.getDate()) + ' ' + MOIS[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function jjmm(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] : ''; }
  function heure(ts) { var d = new Date(ts); return isNaN(d) ? '' : p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function libJour(ts) {
    var d = new Date(ts), n = new Date(), h = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1);
    if (cleJour(d) === cleJour(n)) return 'Aujourd’hui';
    if (cleJour(d) === cleJour(h)) return 'Hier';
    return dateLongue(cleJour(d));
  }
  function chrono(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + p2(s % 60); }

  // ——— État (en mémoire ; survit aux redessins du routeur) ———
  var S = { etat: 'attente', rows: [], erreur: '', edit: null, editTxt: '', vu: {}, ecrit: {}, occupe: {}, urls: {}, attente: [], etatEnvoi: {}, mem: {}, enSauvegarde: false, msg: {}, urlsAtt: [], msgNote: {}, envoiTout: false, minuteur: null };

  function actif() { return !!(V2.route && V2.route.name === 'blocnotes' && document.getElementById('bn-root')); }

  // ═══ Lecture des notes ═══
  function charger() {
    var c = sb();
    if (!c) { S.etat = 'echec'; S.erreur = 'La base n’est pas joignable pour l’instant.'; return Promise.resolve(); }
    S.etat = S.etat === 'pret' ? 'pret' : 'charge';
    return Promise.resolve(c.from(TABLE).select('*').eq('author_id', uid()).eq('archive', false).order('created_at', { ascending: false }).limit(300)).then(function (r) {
      if (!r || r.error || !Array.isArray(r.data)) throw new Error((r && r.error && r.error.message) || 'lecture');
      S.rows = r.data; S.etat = 'pret'; S.erreur = '';
    }).catch(function () {
      if (S.etat !== 'pret') { S.etat = 'echec'; S.erreur = 'Tes notes n’ont pas pu être lues. Vérifie ta connexion puis réessaie.'; }
      else toast('Les notes n’ont pas pu être relues', 'warn');
    }).then(function () {
      if (!actif()) return;
      dessinerListe(); planifier();
      // la base nationale des officines ne se charge que s'il y a des mises à jour à rattacher à une fiche
      if (S.rows.some(function (r) { return actionsDe(r).some(function (a) { return a.pf; }); }) && !window.PHARMA_FR && V2.ensurePharmaFr) {
        V2.ensurePharmaFr(function () { if (actif()) dessinerListe(); });
      }
    });
  }

  // ═══ Compte rendu du robot ═══
  function crDe(r) { var c = r && r.compte_rendu; return (c && typeof c === 'object' && !Array.isArray(c) && !c.erreur) ? c : null; }
  var TYPES = { note_fiche: 1, relance: 1, fiche: 1, profil: 1, todo: 1 };
  function actionsDe(r) {
    var c = crDe(r); if (!c || !Array.isArray(c.actions)) return [];
    return c.actions.filter(function (a) { return a && typeof a === 'object' && a.id != null && TYPES[a.type]; });
  }
  function suiteDe(r, a) { var s = r && r.suites; return (s && typeof s === 'object' && s[a.id]) || ''; }
  function besoinPf(a) { return a.type !== 'todo'; }

  // ── pf (identifiant de la base nationale PHARMA_FR, colonne 13) → pid de fiche ──
  // Un CLIENT a pour pid l'id de V2.pharmacies (WML) ; la fiche #pharma/<pid> le trouve par `V2.pharmacies.find(p.id === pid)` (v2-pharma.js, renderDetail).
  // Un PROSPECT n'est que dans PHARMA_FR : son pid est p[13] lui-même (renderProspectFiche → pharmaFrById). Même rapprochement que V2.reconcilePharma
  // (v2-app.js) : chiffres de l'id WML = p[13].
  function resoudrePf(pf) {
    pf = String(pf == null ? '' : pf).trim(); if (!pf) return null;
    var phs = V2.pharmacies || [], cl = null, i, D = window.PHARMA_FR, row = null;
    for (i = 0; i < phs.length; i++) if (String(phs[i].id) === pf) { cl = phs[i]; break; }
    if (!cl && /^[0-9]{4,}$/.test(pf)) for (i = 0; i < phs.length; i++) if (String(phs[i].id).replace(/[^0-9]/g, '') === pf) { cl = phs[i]; break; }
    if (D && D.p) for (i = 0; i < D.p.length; i++) if (String(D.p[i][13]) === pf) { row = D.p[i]; break; }
    if (cl) { var pid = String(cl.id); return { pid: pid, kind: 'client', nom: (V2.nameOvr && V2.nameOvr[pid]) || cl.name || '', ville: cl.ville || (row && row[7]) || '', row: row }; }
    if (row) return { pid: String(row[13]), kind: 'prospect', nom: (V2.nameOvr && V2.nameOvr[String(row[13])]) || row[6] || '', ville: row[7] || '', row: row };
    return null;
  }
  function cibleDe(a) { return besoinPf(a) ? resoudrePf(a.pf) : (a.pf ? resoudrePf(a.pf) : null); }
  // Tant que la base nationale n'est pas là, on ne peut pas dire « introuvable » : l'action reste proposée.
  function applicable(a) { return !besoinPf(a) || !!cibleDe(a) || !window.PHARMA_FR; }
  // Le nom montré est celui de la fiche qui sera réellement modifiée (pas celui que le robot a cru entendre) : une erreur de rattachement se voit avant d'appliquer.
  function nomOff(a, c) { return c && c.nom ? c.nom + (c.ville ? ' — ' + c.ville : '') : (String(a.officine || '') || 'cette officine'); }

  // ═══ Phrases claires ═══
  var CH_FICHE = { titulaire: 'Titulaire', groupement: 'Groupement', adresse: 'Adresse', tel: 'Téléphone', portable: 'Portable', email: 'E-mail', interlocuteur: 'Interlocuteur' };
  var CH_PROFIL = { gros1: 'Grossiste principal', gros2: 'Deuxième grossiste', gros3: 'Troisième grossiste', gros4: 'Quatrième grossiste', gen1: 'Génériqueur principal', gen2: 'Deuxième génériqueur', gen3: 'Troisième génériqueur', biosim: 'Biosimilaires', lgo: 'Logiciel', robot: 'Robot', tel_perso: 'Téléphone personnel', autre: 'Autre' };
  var K_TODO = { rdv: 'demande de rendez-vous', merci: 'mail de suite après rendez-vous', compte: 'ouverture de compte', libre: 'autre chose à faire' };
  function champsOk(a, table) {
    var o = {}, ch = a.champs && typeof a.champs === 'object' ? a.champs : {};
    Object.keys(table).forEach(function (k) { var v = ch[k]; if (v != null && String(v).trim() !== '') o[k] = String(v).trim(); });
    return o;
  }
  function phraseAction(row, a, c, key) {
    var off = esc(nomOff(a, c));
    if (a.type === 'note_fiche') return '<p>Ajouter cette note sur la fiche <b>' + off + '</b> : « ' + esc(a.texte || '') + ' »</p>';
    if (a.type === 'relance') return '<p>Prochaine relance le <b>' + esc(dateLongue(a.date)) + '</b> — ' + off + '</p>';
    if (a.type === 'fiche') {
      var ch = champsOk(a, CH_FICHE), vu = S.vu[key] || null;
      return '<p>Corriger la fiche <b>' + off + '</b> :</p><ul>' + Object.keys(ch).map(function (k) {
        var av = vu ? (vu[k] ? 'aujourd’hui : ' + esc(vu[k]) : 'aujourd’hui : non renseigné') : (a.avant && a.avant[k] ? 'aujourd’hui : ' + esc(a.avant[k]) : '');
        return '<li>' + CH_FICHE[k] + ' : <b>' + esc(ch[k]) + '</b>' + (av ? ' <span class="bn-vu">(' + av + ')</span>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    if (a.type === 'profil') {
      var pr = champsOk(a, CH_PROFIL);
      return '<p>Compléter le profil de <b>' + off + '</b> :</p><ul>' + Object.keys(pr).map(function (k) { return '<li>' + CH_PROFIL[k] + ' : <b>' + esc(pr[k]) + '</b></li>'; }).join('') + '</ul>';
    }
    // todo
    var qui = (c || a.officine) ? ' — ' + off : '';
    return '<p>À faire : <b>' + esc(K_TODO[a.k] || K_TODO.libre) + '</b>' + qui + (a.pour ? ' — le ' + esc(jjmm(a.pour)) : '') + (a.note ? ' (' + esc(a.note) + ')' : '') + '</p>';
  }

  // ═══ Écriture : lire / relire la base ═══
  function lireProfil(st, sid) {
    var c = sb(); if (!c) return Promise.resolve({ ok: true, data: {}, local: true });
    return Promise.resolve(c.from('profils').select('data').eq('scope_type', st).eq('scope_id', String(sid)).maybeSingle()).then(function (r) {
      if (!r || r.error) return { ok: false };
      return { ok: true, data: (r.data && r.data.data) || {} };
    }, function () { return { ok: false }; });
  }
  // Relit la ligne et compare : seule cette relecture permet d'écrire « appliqué ».
  function verifier(st, sid, attendu) {
    return lireProfil(st, sid).then(function (l) {
      if (!l.ok) return false;
      if (l.local) return true;
      return Object.keys(attendu).every(function (k) { return String(l.data[k] == null ? '' : l.data[k]) === String(attendu[k]); });
    });
  }
  function digits(s) { return String(s || '').replace(/[^0-9]/g, ''); }

  // Valeur actuelle d'un champ de fiche (saisie de l'équipe d'abord, puis la base de l'app).
  function valeursActuelles(c, champs) {
    return Promise.all([lireProfil('override', c.pid), lireProfil('client', c.pid)]).then(function (rs) {
      if (!rs[0].ok || !rs[1].ok) return null;
      var ov = rs[0].data, cl = rs[1].data, row = c.row, D = window.PHARMA_FR, out = {};
      var wml = (V2.pharmacies || []).filter(function (p) { return String(p.id) === c.pid; })[0] || {};
      Object.keys(champs).forEach(function (k) {
        var v = '';
        if (k === 'titulaire') v = ov.titulaire || (V2.titOvr && V2.titOvr[c.pid]) || cl.titulaire || (row && row[10]) || '';
        else if (k === 'groupement') v = ov.groupement || wml.groupement || (row && D && D.grp && D.grp[row[3]] !== '—' ? D.grp[row[3]] : '') || '';
        else if (k === 'tel') v = cl.tel || wml.tel || (row && row[9]) || '';
        else if (k === 'email') v = cl.email || (row && row[11]) || '';
        else v = cl[k] || '';
        out[k] = String(v || '');
      });
      return out;
    });
  }
  function chargerActuels(row, a) {
    var key = row.id + ':' + a.id, c = cibleDe(a); if (!c || S.vu[key] !== undefined || suiteDe(row, a)) return;
    S.vu[key] = null;
    valeursActuelles(c, champsOk(a, CH_FICHE)).then(function (v) { if (v) { S.vu[key] = v; if (actif()) dessinerListe(); } else delete S.vu[key]; });
  }

  // ═══ Appliquer UNE proposition ═══ → promesse { ok, msg }
  function ecrire(row, a, c) {
    var T = a.type;
    if (T === 'note_fiche') {
      var tx = String(a.texte || '').trim(); if (!tx) return Promise.resolve({ ok: false, msg: 'Le texte de la note est vide.' });
      if (!V2.notes || !V2.notes.addAuto) return Promise.resolve({ ok: false, msg: 'Les notes de fiche ne sont pas disponibles.' });
      return V2.notes.addAuto('client', c.pid, 'Bloc-notes du ' + jjmm(String(row.created_at).slice(0, 10)) + ' : ' + tx).then(function (ok) { return { ok: ok === true, msg: ok === true ? '' : 'La note n’a pas pu être ajoutée à la fiche.' }; });
    }
    if (T === 'relance') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a.date || ''))) return Promise.resolve({ ok: false, msg: 'La date de relance est illisible.' });
      return V2.profil.poserPlusieurs('client', c.pid, { relance_date: a.date }).then(function () { return verifier('client', c.pid, { relance_date: a.date }); })
        .then(function (ok) { return { ok: ok, msg: ok ? '' : 'La relance n’a pas pu être enregistrée.' }; }, function () { return { ok: false, msg: 'La fiche n’a pas pu être relue : rien n’a été changé.' }; });
    }
    if (T === 'profil') {
      var pr = champsOk(a, CH_PROFIL); if (!Object.keys(pr).length) return Promise.resolve({ ok: false, msg: 'Aucune information à enregistrer.' });
      return V2.profil.poserPlusieurs('client', c.pid, pr).then(function () { return verifier('client', c.pid, pr); })
        .then(function (ok) { return { ok: ok, msg: ok ? '' : 'Le profil n’a pas pu être enregistré.' }; }, function () { return { ok: false, msg: 'La fiche n’a pas pu être relue : rien n’a été changé.' }; });
    }
    if (T === 'fiche') return ecrireFiche(a, c);
    if (T === 'todo') {
      if (!V2.todo || !V2.todo.ajouterLigne) return Promise.resolve({ ok: false, msg: 'La to do list n’est pas disponible.' });
      var id = 'bn' + String(row.id).replace(/[^0-9A-Za-z]/g, '') + String(a.id).replace(/[^0-9A-Za-z]/g, '');
      return V2.todo.ajouterLigne({ id: id, k: a.k, pid: c ? c.pid : '', nom: (c && c.nom) || a.officine || '', note: a.note, pour: a.pour }).then(function (ok) { return { ok: ok === true, msg: ok === true ? '' : 'La ligne n’a pas pu être ajoutée à la to do list.' }; });
    }
    return Promise.resolve({ ok: false, msg: 'Cette proposition n’est pas reconnue.' });
  }
  // Même logique que V2.pharmaFiche.enregistrer (v2-pharma.js) : nom / titulaire / groupement → correction « override » ; le reste → saisie « client ».
  function ecrireFiche(a, c) {
    var ch = champsOk(a, CH_FICHE), ov = {}, pro = {};
    if (!Object.keys(ch).length) return Promise.resolve({ ok: false, msg: 'Aucune information à enregistrer.' });
    Object.keys(ch).forEach(function (k) {
      if (k === 'titulaire') { ov.titulaire = ch[k]; if (c.kind === 'prospect') pro.titulaire = ch[k]; }
      else if (k === 'groupement') { ov.groupement = ch[k]; if (c.kind === 'prospect') pro.groupement = ch[k]; }
      else pro[k] = ch[k];
    });
    var p1 = Object.keys(ov).length ? new Promise(function (ok) { V2.profil.saveOverride(c.pid, ov, ok); setTimeout(ok, 4000); }) : Promise.resolve();
    return p1.then(function () { return Object.keys(pro).length ? V2.profil.poserPlusieurs('client', c.pid, pro) : null; })
      .then(function () { return Promise.all([Object.keys(ov).length ? verifier('override', c.pid, ov) : true, Object.keys(pro).length ? verifier('client', c.pid, pro) : true]); })
      .then(function (r) {
        if (!(r[0] && r[1])) return { ok: false, msg: 'La fiche n’a pas pu être mise à jour.' };
        // l'affichage de l'app ne change qu'une fois l'écriture relue en base
        try {
          if (ov.titulaire) { V2.titOvr = V2.titOvr || {}; V2.titOvr[c.pid] = ov.titulaire; if (c.row && V2.pfPoser) V2.pfPoser(c.row, 10, ov.titulaire); }
          if (ov.groupement) {
            window.GRP_OVR = window.GRP_OVR || {}; window.GRP_OVR[digits(c.pid)] = ov.groupement;
            var D = window.PHARMA_FR; if (D && D.p && V2.reconcilePharma) { D._wmlRecon = false; V2.reconcilePharma(); }
          }
        } catch (e) {}
        return { ok: true, msg: '' };
      }, function () { return { ok: false, msg: 'La fiche n’a pas pu être relue : rien n’a été changé.' }; });
  }

  // Marque la proposition dans la ligne (colonne `suites`). Relit le résultat : une mise à jour refusée par la base ne touche 0 ligne SANS erreur.
  function marquer(row, aid, val) {
    var c = sb(); if (!c) return Promise.resolve(false);
    var suites = Object.assign({}, row.suites || {}); suites[aid] = val;
    return Promise.resolve(c.from(TABLE).update({ suites: suites }).eq('id', row.id).select('id')).then(function (r) {
      if (!r || r.error || !Array.isArray(r.data) || !r.data.length) return false;
      row.suites = suites; return true;
    }, function () { return false; });
  }

  function trouverRow(id) { for (var i = 0; i < S.rows.length; i++) if (S.rows[i].id === id) return S.rows[i]; return null; }
  function trouverAct(row, aid) { var l = actionsDe(row); for (var i = 0; i < l.length; i++) if (String(l[i].id) === String(aid)) return l[i]; return null; }

  // force = true : « Tout appliquer » (pas de confirmation des valeurs de fiche). Rend { ok, msg, attente }.
  function appliquerUne(row, a, force) {
    var key = row.id + ':' + a.id;
    if (S.occupe[key]) return Promise.resolve({ ok: false, msg: 'Déjà en cours.' });
    var c = cibleDe(a);
    if (besoinPf(a) && !c) return Promise.resolve({ ok: false, msg: 'Fiche introuvable : ' + (a.officine || 'officine') + '.' });
    S.occupe[key] = true; dessinerListe();
    var fin = function (r) { delete S.occupe[key]; if (actif()) dessinerListe(); return r; };
    var etape = Promise.resolve();
    if (a.type === 'fiche' && !force && !S.ecrit[key]) {   // la valeur actuelle est relue et MONTRÉE avant d'écrire
      etape = valeursActuelles(c, champsOk(a, CH_FICHE)).then(function (v) {
        if (!v) return { stop: 'La fiche n’a pas pu être relue : rien n’a été changé.' };
        var avant = S.vu[key];
        S.vu[key] = v;
        if (!avant || JSON.stringify(avant) !== JSON.stringify(v)) return { stop: 'Vérifie les valeurs actuelles affichées, puis appuie encore sur « Appliquer ».', neutre: true };
        return null;
      });
    }
    return etape.then(function (arret) {
      if (arret && arret.stop) return fin({ ok: false, msg: arret.stop, neutre: arret.neutre });
      var w = S.ecrit[key] ? Promise.resolve({ ok: true, msg: '' }) : ecrire(row, a, c);
      return w.then(function (r) {
        if (!r.ok) return fin(r);
        S.ecrit[key] = true;   // écrit en base : si le marquage échoue, on ne réécrit pas (pas de note en double)
        return marquer(row, a.id, 'applique').then(function (m) {
          if (m) delete S.ecrit[key];
          return fin(m ? { ok: true, msg: '' } : { ok: false, msg: 'La mise à jour est faite, mais elle n’a pas pu être notée dans le bloc-notes. Appuie encore sur « Appliquer ».' });
        });
      });
    }, function () { return fin({ ok: false, msg: 'Une erreur est survenue : rien n’a été marqué.' }); });
  }

  function ignorerUne(row, a) {
    var key = row.id + ':' + a.id;
    if (S.occupe[key]) return;
    S.occupe[key] = true; dessinerListe();
    marquer(row, a.id, 'ignore').then(function (m) {
      delete S.occupe[key];
      if (!m) toast('Impossible de noter ce choix : réessaie.', 'error');
      if (actif()) { dessinerListe(); }
    });
  }

  // Applique plusieurs propositions, UNE APRÈS L'AUTRE (deux écritures sur la même fiche se relisent l'une l'autre).
  function toutAppliquer(liste) {
    if (S.enSauvegarde || !liste.length) return;
    S.enSauvegarde = true; dessinerListe();
    var ok = 0, ko = 0, dernier = '';
    liste.reduce(function (p, it) {
      return p.then(function () { return appliquerUne(it.row, it.a, true).then(function (r) { if (r.ok) ok++; else { ko++; dernier = r.msg; } }); });
    }, Promise.resolve()).then(function () {
      S.enSauvegarde = false; if (actif()) dessinerListe();
      if (ko) toast(ok + ' mise' + (ok > 1 ? 's' : '') + ' à jour appliquée' + (ok > 1 ? 's' : '') + ', ' + ko + ' non appliquée' + (ko > 1 ? 's' : '') + ' — ' + esc(dernier), 'error');
      else toast(ok + ' mise' + (ok > 1 ? 's' : '') + ' à jour appliquée' + (ok > 1 ? 's' : ''));
    });
  }
  function enAttente(row) { return actionsDe(row).filter(function (a) { return !suiteDe(row, a) && applicable(a); }).map(function (a) { return { row: row, a: a }; }); }
  function toutesEnAttente() { var l = []; S.rows.forEach(function (r) { if (r.statut === 'lue') l = l.concat(enAttente(r)); }); return l; }

  // ═══ Dessin ═══
  function gabarit() {
    var dictee = (V2.notes && V2.notes.micPossible) ? V2.notes.micPossible() : !!(window.SpeechRecognition || window.webkitSpeechRecognition);   // 19/10/2026 : sur téléphone, dictée du clavier (v2-notes.js)
    return '<div class="v2-wrap v2-u bn-wrap" id="bn-root">' +
      '<div class="bn-tete"><h1>Bloc-notes</h1><p>Tes notes restent des brouillons, rien que pour toi. Quand tu veux, envoie-les au robot : il les lit le soir et te propose les mises à jour du CRM, que tu appliques d’un geste.</p></div>' +
      '<div class="bn-band" id="bn-bandeau-brouillons" hidden></div>' +
      '<div class="bn-band" id="bn-bandeau" hidden></div>' +
      '<div class="v2-card bn-ecrire" data-dictee="1"><div class="bn-h">Nouvelle note</div>' +
        '<textarea class="v2-notes-ta bn-ta" id="bn-ta" rows="4" placeholder="Vu la pharmacie du Port à Caen, nouveau titulaire…" aria-label="Texte de la note"></textarea>' +
        '<div class="bn-ligne">' +
          (dictee ? '<button type="button" class="bn-mic" data-bn="dicter" title="Dicter la note à la voix" aria-label="Dicter la note à la voix">' + ic('mic') + '</button>' : '') +
          '<button type="button" class="v2-btn v2-btn-primary" data-bn="enregistrer" id="bn-enr">Enregistrer la note</button>' +
        '</div><div class="bn-msg" id="bn-msg-ecrire" role="status" aria-live="polite"></div></div>' +
      '<div class="v2-card bn-voix"><div class="bn-h">Note vocale</div><div id="bn-voix"></div></div>' +
      '<div id="bn-attente"></div>' +
      '<div id="bn-liste"></div>' +
    '</div>';
  }

  function dessinerBandeau() {
    var b = document.getElementById('bn-bandeau'); if (!b) return;
    var l = toutesEnAttente();
    if (!l.length) { b.hidden = true; b.innerHTML = ''; return; }
    b.hidden = false;
    b.innerHTML = '<span>' + l.length + ' mise' + (l.length > 1 ? 's' : '') + ' à jour à valider</span>' +
      '<button type="button" class="v2-btn v2-btn-primary" data-bn="tout-global"' + (S.enSauvegarde ? ' disabled' : '') + '>' + (S.enSauvegarde ? 'En cours…' : 'Tout appliquer') + '</button>';
  }

  function brouillons() { return S.rows.filter(function (r) { return r.statut === 'brouillon'; }); }
  function dessinerBrouillons() {
    var b = document.getElementById('bn-bandeau-brouillons'); if (!b) return;
    var l = brouillons();
    if (!l.length) { b.hidden = true; b.innerHTML = ''; return; }
    b.hidden = false;
    b.innerHTML = '<span>' + l.length + ' brouillon' + (l.length > 1 ? 's' : '') + '</span>' +
      '<button type="button" class="v2-btn v2-btn-primary" data-bn="envoyer-tout"' + (S.envoiTout ? ' disabled' : '') + '>' + (S.envoiTout ? 'Envoi en cours…' : 'Envoyer tout au robot') + '</button>';
  }

  // Texte d'une note : écrite → body ; vocale → body (version corrigée par le commercial) s'il est rempli, sinon transcription (robot).
  function texteDe(r) { return String((r.kind === 'vocal' ? (r.body || r.transcription) : r.body) || ''); }
  function vocalSansTexte(r) { return r.kind === 'vocal' && !r.body && !r.transcription && r.statut !== 'lue' && r.statut !== 'erreur'; }

  function etatNote(r) {
    if (r.statut === 'brouillon') return '<div class="bn-etat bn-etat--brouillon">' + ic('crayon') + 'Brouillon — le robot ne le lit pas tant que tu ne l’envoies pas</div>';
    if (r.statut === 'a_lire') return '<div class="bn-etat">' + ic('clock') + 'Envoyée au robot — il la lira à son prochain passage, en soirée</div>';
    if (r.statut === 'lue') return '<div class="bn-etat">' + ic('check') + 'Lue par le robot' + (r.lu_le ? ' le ' + esc(dateLongue(cleJour(new Date(r.lu_le)))) + ' à ' + heure(r.lu_le) : '') + '</div>';
    if (r.statut === 'erreur') return '<div class="bn-etat bn-etat--ko">' + ic('alerte') + 'Le robot n’a pas pu la lire</div>';
    return '<div class="bn-etat">' + ic('clock') + 'Envoyée au robot — il la lira à son prochain passage, en soirée</div>';
  }

  function blocAction(row, a) {
    var key = row.id + ':' + a.id, s = suiteDe(row, a), c = cibleDe(a), occ = !!S.occupe[key] || S.enSauvegarde;
    if (a.type === 'fiche' && !s) chargerActuels(row, a);
    var h = '<div class="bn-act">' + phraseAction(row, a, c, key);
    if (s === 'applique') h += '<div class="bn-fait">' + ic('check').replace('class="bn-i"', 'class="bn-i" style="width:16px;height:16px;vertical-align:-3px"') + ' Appliqué</div>';
    else if (s === 'ignore') h += '<div class="bn-ign">Ignoré</div>';
    else if (besoinPf(a) && window.PHARMA_FR && !c) h += '<div class="bn-msg bn-msg--ko">Fiche introuvable : ' + esc(a.officine || 'officine') + '. Rien ne peut être appliqué pour cette ligne.</div>' +
      '<div class="bn-acts"><button type="button" class="bn-b" data-bn="ignorer" data-row="' + esc(row.id) + '" data-a="' + esc(a.id) + '">Ignorer</button></div>';
    else {
      h += '<div class="bn-acts"><button type="button" class="v2-btn v2-btn-primary" data-bn="appliquer" data-row="' + esc(row.id) + '" data-a="' + esc(a.id) + '"' + (occ ? ' disabled' : '') + '>' + (S.occupe[key] ? 'En cours…' : 'Appliquer') + '</button>' +
        '<button type="button" class="bn-b" data-bn="ignorer" data-row="' + esc(row.id) + '" data-a="' + esc(a.id) + '"' + (occ ? ' disabled' : '') + '>Ignorer</button>' +
        (c ? '<a class="bn-lien" href="#pharma/' + encodeURIComponent(c.pid) + '">Ouvrir la fiche</a>' : '') + '</div>';
      if (S.msg && S.msg[key]) h += '<div class="bn-msg ' + (S.msg[key].neutre ? '' : 'bn-msg--ko') + '" role="status">' + esc(S.msg[key].t) + '</div>';
    }
    return h + '</div>';
  }

  function blocCompteRendu(r) {
    var c = crDe(r); if (!c || r.statut !== 'lue') return '';
    var acts = actionsDe(r), att = enAttente(r), h = '<div class="bn-cr">';
    if (c.resume) h += '<p class="bn-res">' + esc(c.resume) + '</p>';
    if (att.length > 1) h += '<div class="bn-acts" style="margin:0 0 10px"><button type="button" class="v2-btn v2-btn-primary" data-bn="tout-note" data-row="' + esc(r.id) + '"' + (S.enSauvegarde ? ' disabled' : '') + '>Tout appliquer (' + att.length + ')</button></div>';
    if (!acts.length && !(Array.isArray(c.incertain) && c.incertain.length)) h += '<div class="bn-msg">Rien à mettre à jour dans cette note.</div>';
    h += acts.map(function (a) { return blocAction(r, a); }).join('');
    if (Array.isArray(c.incertain)) h += c.incertain.filter(Boolean).map(function (t) { return '<div class="bn-inc">Le robot n’a pas su à quelle officine rattacher : « ' + esc(t) + ' »</div>'; }).join('');
    return h + '</div>';
  }

  function blocNote(r) {
    var vocal = r.kind === 'vocal', ed = S.edit === r.id;
    var h = '<div class="v2-card bn-note" data-row="' + esc(r.id) + '"><div class="bn-top"><b>' + heure(r.created_at) + '</b><span>' + (vocal ? 'Note vocale' + (r.duree_s ? ' · ' + chrono(r.duree_s) : '') : 'Note écrite') + '</span></div>';
    if (ed) {
      h += micChamp('<textarea class="bn-ta" id="bn-edit-ta" rows="4" aria-label="Modifier la note"' + (vocal ? ' placeholder="Écris ou corrige le texte de cette note vocale"' : '') + '>' + esc(S.editTxt) + '</textarea>', 'Dicter la correction à la voix') +
        '<div class="bn-acts"><button type="button" class="v2-btn v2-btn-primary" data-bn="edit-ok" data-row="' + esc(r.id) + '">Enregistrer</button><button type="button" class="bn-b" data-bn="edit-non">Annuler</button></div>' +
        '<div class="bn-msg bn-msg--ko" id="bn-edit-msg" role="status"></div>';
    } else {
      var txt = texteDe(r);
      if (txt) h += '<div class="bn-corps">' + esc(txt) + '</div>';
      else if (vocal) h += '<div class="bn-corps" style="color:var(--muted)">' + (vocalSansTexte(r) ? 'Transcription en cours (quelques minutes, quand le Mac de l’agence est allumé)' : 'Aucun texte reconnu dans cet enregistrement.') + '</div>';
      if (vocal && r.audio_path) h += '<div class="bn-audio-zone">' + (S.urls[r.id] ? '<audio class="bn-audio" controls preload="metadata" src="' + esc(S.urls[r.id]) + '"></audio>' : '<div class="bn-acts"><button type="button" class="bn-b" data-bn="ecouter" data-row="' + esc(r.id) + '">' + ic('mic') + 'Écouter</button></div>') + '</div>';
      h += etatNote(r);
      h += blocCompteRendu(r);
      var occN = !!S.occupe['n:' + r.id];
      if (S.msgNote[r.id]) h += '<div class="bn-msg bn-msg--ko" role="status">' + esc(S.msgNote[r.id]) + '</div>';
      h += '<div class="bn-acts">' + (r.statut === 'brouillon' || r.statut === 'a_lire' ? '<button type="button" class="bn-b" data-bn="edit" data-row="' + esc(r.id) + '"' + (occN ? ' disabled' : '') + '>Modifier</button>' : '') +
        (r.statut === 'brouillon' ? '<button type="button" class="v2-btn v2-btn-primary" data-bn="envoyer" data-row="' + esc(r.id) + '"' + (occN || S.envoiTout ? ' disabled' : '') + '>' + (occN ? 'Envoi…' : 'Envoyer au robot') + '</button>' : '') +
        (r.statut === 'a_lire' ? '<button type="button" class="bn-b" data-bn="reprendre" data-row="' + esc(r.id) + '"' + (occN || S.envoiTout ? ' disabled' : '') + '>' + (occN ? 'Un instant…' : 'Reprendre') + '</button>' : '') +
        '<button type="button" class="bn-b bn-b--rose" data-bn="retirer" data-row="' + esc(r.id) + '">Retirer</button></div>';
    }
    return h + '</div>';
  }

  function dessinerListe() {
    dessinerBandeau(); dessinerBrouillons();
    var z = document.getElementById('bn-liste'); if (!z) return;
    // un champ en cours de modification garde son texte et son focus pendant un redessin
    var en = document.getElementById('bn-edit-ta'), hadFocus = en && document.activeElement === en;
    if (en) S.editTxt = en.value;
    if (S.etat === 'charge' || S.etat === 'attente') { z.innerHTML = '<div class="bn-vide">Chargement de tes notes…</div>'; return; }
    if (S.etat === 'echec') { z.innerHTML = '<div class="v2-card bn-note"><div class="bn-msg bn-msg--ko" style="margin:0">' + esc(S.erreur) + '</div><div class="bn-acts"><button type="button" class="v2-btn v2-btn-primary" data-bn="recharger">Réessayer</button></div></div>'; return; }
    if (!S.rows.length) { z.innerHTML = '<div class="bn-vide">Aucune note pour l’instant. Écris ou dicte la première ci-dessus.</div>'; return; }
    var h = '', dernier = '';
    S.rows.forEach(function (r) {
      var j = libJour(r.created_at);
      if (j !== dernier) { h += '<h2 class="bn-jour">' + esc(j) + '</h2>'; dernier = j; }
      h += blocNote(r);
    });
    z.innerHTML = h;
    var ne = document.getElementById('bn-edit-ta'); if (ne && hadFocus) { ne.focus(); }
  }

  // ═══ Note écrite ═══
  function enregistrerTexte(btn) {
    var ta = document.getElementById('bn-ta'), msg = document.getElementById('bn-msg-ecrire');
    var body = (ta && ta.value || '').trim();
    var dire = function (t, cl) { if (msg) { msg.className = 'bn-msg' + (cl ? ' bn-msg--' + cl : ''); msg.textContent = t; } };
    if (!body) { dire('Écris ou dicte quelque chose d’abord.', 'ko'); if (ta) ta.focus(); return; }
    var c = sb(); if (!c || !V2.user) { dire('Tu n’es pas connecté : la note n’est pas enregistrée.', 'ko'); return; }
    btn.disabled = true; dire('Enregistrement…');
    Promise.resolve(c.from(TABLE).insert({ author_id: V2.user.id, author_name: V2.user.name || '', kind: 'texte', body: body, statut: 'brouillon' }).select('id')).then(function (r) {
      if (!r || r.error || !Array.isArray(r.data) || !r.data.length) throw new Error('refus');
      if (ta && ta.value.trim() === body) ta.value = '';
      dire('Brouillon enregistré. Le robot ne le lira que si tu l’envoies.', 'ok');
      return charger();
    }).catch(function () { dire('La note n’est pas enregistrée (pas de réseau ?). Ton texte est gardé : réessaie.', 'ko'); })
      .then(function () { btn.disabled = false; });
  }

  function modifierTexte(id) {
    var ta = document.getElementById('bn-edit-ta'), m = document.getElementById('bn-edit-msg');
    var body = (ta && ta.value || '').trim(), c = sb();
    if (!body) { if (m) m.textContent = 'La note est vide.'; return; }
    if (!c) { if (m) m.textContent = 'La base n’est pas joignable.'; return; }
    Promise.resolve(c.from(TABLE).update({ body: body }).eq('id', id).in('statut', ['brouillon', 'a_lire']).select('id')).then(function (r) {
      if (!r || r.error || !Array.isArray(r.data) || !r.data.length) throw new Error('refus');
      var row = trouverRow(id); if (row) row.body = body;
      S.edit = null; dessinerListe(); toast('Note modifiée');
    }).catch(function () {
      var m2 = document.getElementById('bn-edit-msg'); if (m2) m2.textContent = 'La note n’a pas été modifiée (le robot l’a peut-être déjà lue). Réessaie.';
      charger();   // relecture : l'écran montre l'état réel de la note
    });
  }

  // ═══ Envoyer au robot / Reprendre ═══ — l'état n'est montré qu'après une réponse qui confirme UNE ligne modifiée (garde sur l'état d'origine)
  function changerEtat(id, de, vers) {
    var c = sb(); if (!c) return Promise.resolve(false);
    return Promise.resolve(c.from(TABLE).update({ statut: vers }).eq('id', id).eq('statut', de).select('id')).then(function (r) {
      if (!r || r.error || !Array.isArray(r.data) || r.data.length !== 1) return false;
      var row = trouverRow(id); if (row) row.statut = vers;
      return true;
    }, function () { return false; });
  }
  function envoyerNote(id, de, vers) {
    var cle = 'n:' + id; if (S.occupe[cle] || S.envoiTout) return;
    S.occupe[cle] = true; delete S.msgNote[id]; dessinerListe();
    changerEtat(id, de, vers).then(function (ok) {
      delete S.occupe[cle];
      if (ok) toast(vers === 'a_lire' ? 'Note envoyée au robot' : 'Note reprise : elle redevient un brouillon');
      else {
        S.msgNote[id] = vers === 'a_lire' ? 'La note n’a pas été envoyée. Réessaie si elle est toujours un brouillon.' : 'La note n’a pas pu être reprise (le robot l’a peut-être déjà lue). Voici son état à jour.';
        toast(S.msgNote[id], 'error');
        if (actif()) dessinerListe();
        return charger();   // relecture de la vraie situation
      }
      if (actif()) dessinerListe();
    });
  }
  // « Envoyer tout » : un seul geste, mais note par note (chaque envoi est gardé et relu). Le compte annoncé est celui de ce qui est vraiment parti.
  function envoyerTout() {
    if (S.envoiTout) return;
    var ids = brouillons().map(function (r) { return r.id; }); if (!ids.length) return;
    S.envoiTout = true; dessinerListe();
    var ok = 0, ko = 0;
    ids.reduce(function (p, id) { return p.then(function () { return changerEtat(id, 'brouillon', 'a_lire').then(function (b) { if (b) ok++; else ko++; }); }); }, Promise.resolve()).then(function () {
      S.envoiTout = false;
      var t = ok ? ok + ' note' + (ok > 1 ? 's' : '') + ' envoyée' + (ok > 1 ? 's' : '') + ' au robot' : '';
      if (ko) t += (t ? ', ' : '') + ko + ' non envoyée' + (ko > 1 ? 's' : '') + ' (' + 'regarde ' + (ko > 1 ? 'leur' : 'son') + ' état dans la liste' + ')';
      toast(t, ko ? 'error' : undefined);
      if (actif()) dessinerListe();
      if (ko) charger();   // relecture de la vraie situation
    });
  }

  // ═══ Relecture automatique tant qu'un vocal attend sa transcription (au plus toutes les 60 s, seulement écran affiché) ═══
  function planifier() {
    if (S.minuteur || !actif()) return;
    if (!S.rows.some(vocalSansTexte)) return;
    S.minuteur = setTimeout(function () {
      S.minuteur = null;
      if (!actif()) return;   // écran quitté : plus rien ne tourne
      if (S.edit) { planifier(); return; }
      charger();   // charger() replanifie si besoin
    }, 60000);
  }

  function retirer(id) {
    var c = sb(); if (!c) { toast('La base n’est pas joignable', 'error'); return; }
    Promise.resolve(c.from(TABLE).update({ archive: true }).eq('id', id).select('id')).then(function (r) {
      if (!r || r.error || !Array.isArray(r.data) || !r.data.length) throw new Error('refus');
      S.rows = S.rows.filter(function (x) { return x.id !== id; }); delete S.urls[id];
      if (actif()) dessinerListe(); toast('Note retirée');
    }).catch(function () { toast('La note n’a pas été retirée : réessaie.', 'error'); });
  }

  function ecouter(id) {
    var row = trouverRow(id), c = sb(); if (!row || !c || !row.audio_path) return;
    Promise.resolve(c.storage.from(BUCKET).createSignedUrl(row.audio_path, 3600)).then(function (r) {
      var u = r && r.data && (r.data.signedUrl || r.data.signedURL);
      if (!u || r.error) throw new Error('adresse');
      S.urls[id] = u; dessinerListe();
      var a = document.querySelector('.bn-note[data-row="' + id + '"] audio'); if (a) { try { var p = a.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    }).catch(function () { toast('L’enregistrement n’a pas pu être chargé : réessaie.', 'error'); });
  }

  // ═══ Note vocale ═══
  var R = { etat: 'repos', rec: null, stream: null, chunks: [], t0: 0, tick: null, entry: null, url: '', msg: '', msgCl: '' };
  function typeAudio() {
    var l = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
    try { if (window.MediaRecorder && MediaRecorder.isTypeSupported) for (var i = 0; i < l.length; i++) if (MediaRecorder.isTypeSupported(l[i])) return l[i]; } catch (e) {}
    return '';
  }
  function extDe(t) { return /mp4|m4a|aac/i.test(t || '') ? 'm4a' : 'webm'; }

  // — IndexedDB : l'enregistrement y est gardé dès qu'il existe, retiré seulement quand la base l'a bien reçu —
  function idb() {
    return new Promise(function (res, rej) {
      try {
        var q = indexedDB.open('jarvis-bloc-notes', 1);
        q.onupgradeneeded = function () { q.result.createObjectStore('envois', { keyPath: 'id' }); };
        q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); };
      } catch (e) { rej(e); }
    });
  }
  function idbOp(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('envois', mode), rq = fn(tx.objectStore('envois'));
        tx.oncomplete = function () { res(rq && rq.result); db.close(); }; tx.onerror = tx.onabort = function () { rej(tx.error); db.close(); };
      });
    });
  }
  // Les octets sont rangés en ArrayBuffer (pas en Blob) : c'est ce que tous les Safari acceptent, mode privé compris.
  function lireOctets(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer();
    return new Promise(function (ok, ko) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.onerror = function () { ko(fr.error); }; fr.readAsArrayBuffer(blob); });
  }
  function garder(e) {
    S.mem[e.id] = e;   // en mémoire tout de suite, dans IndexedDB dès que les octets sont lus
    return lireOctets(e.blob).then(function (buf) {
      var ligne = { id: e.id, uid: e.uid, buf: buf, type: e.type, ext: e.ext, duree: e.duree, cree: e.cree, nom: e.nom };
      return idbOp('readwrite', function (st) { return st.put(ligne); });
    }).then(function () { return true; }, function () { return false; });
  }
  function oublier(id) { delete S.mem[id]; return idbOp('readwrite', function (s) { return s.delete(id); }).catch(function () {}); }
  function toutesGardees() {
    return idbOp('readonly', function (s) { return s.getAll(); }).then(function (l) { return l || []; }, function () { return []; }).then(function (l) {
      l = l.map(function (x) { return S.mem[x.id] || { id: x.id, uid: x.uid, blob: new Blob([x.buf], { type: x.type }), type: x.type, ext: x.ext, duree: x.duree, cree: x.cree, nom: x.nom }; });
      var vu = {}; l.forEach(function (e) { vu[e.id] = 1; });
      Object.keys(S.mem).forEach(function (k) { if (!vu[k]) l.push(S.mem[k]); });
      return l.filter(function (e) { return e && e.uid === uid() && e.blob; }).sort(function (a, b) { return a.cree - b.cree; });
    });
  }

  function dessinerVoix() {
    var z = document.getElementById('bn-voix'); if (!z) return;
    var h = '';
    if (R.etat === 'repos') h = '<div class="bn-ligne" style="margin-top:0"><button type="button" class="v2-btn v2-btn-primary" data-bn="rec-start">' + ic('mic') + 'Note vocale</button><span class="bn-msg" style="margin:0">5 minutes au maximum</span></div>';
    else if (R.etat === 'micro') h = '<div class="bn-msg" style="margin:0">Autorise le micro si ton téléphone le demande…</div>';
    else if (R.etat === 'enreg') h = '<div class="bn-ligne" style="margin-top:0"><span class="bn-chrono"><span class="bn-point"></span><span id="bn-chrono">0:00</span></span><button type="button" class="v2-btn v2-btn-primary" data-bn="rec-stop">' + ic('stop') + 'Arrêter</button></div>';
    else if (R.etat === 'ecoute') h = '<div class="bn-msg" style="margin:0">Enregistrement de ' + chrono(R.entry.duree) + '. Écoute-le avant de l’envoyer.</div>' +
      '<audio class="bn-audio" controls preload="metadata" src="' + esc(R.url) + '"></audio>' +
      '<div class="bn-ligne"><button type="button" class="v2-btn v2-btn-primary" data-bn="rec-envoyer">Garder ce vocal</button><button type="button" class="bn-b" data-bn="rec-refaire">Recommencer</button></div>';
    else if (R.etat === 'envoi') h = '<div class="bn-msg" style="margin:0">Envoi en cours…</div><audio class="bn-audio" controls preload="metadata" src="' + esc(R.url) + '"></audio>';
    z.innerHTML = h + '<div class="bn-msg' + (R.msgCl ? ' bn-msg--' + R.msgCl : '') + '" id="bn-voix-msg" role="status" aria-live="polite">' + esc(R.msg) + '</div>';
  }
  function dire(t, cl) { R.msg = t || ''; R.msgCl = cl || ''; var m = document.getElementById('bn-voix-msg'); if (m) { m.className = 'bn-msg' + (cl ? ' bn-msg--' + cl : ''); m.textContent = R.msg; } }
  function libererFlux() { try { if (R.stream) R.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} R.stream = null; }
  function oublierUrl() { if (R.url) { try { URL.revokeObjectURL(R.url); } catch (e) {} } R.url = ''; }

  function demarrer() {
    if (R.etat !== 'repos') return;
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) { dire('Ce navigateur ne sait pas enregistrer la voix. Utilise le micro de dictée dans « Nouvelle note ».', 'ko'); return; }
    R.etat = 'micro'; dire(''); dessinerVoix();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var type = typeAudio(), rec;
      try { rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream); }
      catch (e) { stream.getTracks().forEach(function (t) { t.stop(); }); throw e; }
      R.stream = stream; R.rec = rec; R.chunks = []; R.type = rec.mimeType || type || 'audio/webm';
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) R.chunks.push(ev.data); };
      rec.onstop = function () { fini(); };
      rec.onerror = function () { dire('L’enregistrement a rencontré un problème.', 'ko'); };
      rec.start();
      R.t0 = Date.now(); R.etat = 'enreg'; dessinerVoix();
      R.tick = setInterval(function () {
        var s = (Date.now() - R.t0) / 1000, el = document.getElementById('bn-chrono'); if (el) el.textContent = chrono(s);
        if (s >= MAX_S) { dire('5 minutes atteintes : l’enregistrement s’est arrêté.'); arreter(); }
      }, 250);
    }).catch(function (e) {
      R.etat = 'repos'; dessinerVoix();
      var n = e && e.name;
      if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') dire('Le micro est refusé. Autorise le micro pour ce site (réglages du navigateur, ou Réglages > Safari > Microphone sur iPhone), puis recommence.', 'ko');
      else if (n === 'NotFoundError' || n === 'OverconstrainedError') dire('Aucun micro n’a été trouvé sur cet appareil.', 'ko');
      else dire('Le micro n’a pas pu être démarré. Réessaie.', 'ko');
    });
  }
  function arreter() {
    if (R.tick) { clearInterval(R.tick); R.tick = null; }
    if (R.rec && R.rec.state !== 'inactive') { try { R.rec.stop(); } catch (e) { fini(); } } else if (R.etat === 'enreg') fini();
  }
  function fini() {
    if (R.tick) { clearInterval(R.tick); R.tick = null; }
    libererFlux();
    if (R.etat !== 'enreg') return;
    var duree = Math.min(MAX_S, Math.max(1, Math.round((Date.now() - R.t0) / 1000)));
    var blob = new Blob(R.chunks, { type: R.type }); R.rec = null;
    if (!blob.size) { R.etat = 'repos'; dessinerVoix(); dire('Rien n’a été enregistré. Réessaie.', 'ko'); return; }
    var id = uuid();
    R.entry = { id: id, uid: uid(), blob: blob, type: R.type, ext: extDe(R.type), duree: duree, cree: Date.now(), nom: V2.user && V2.user.name || '' };
    garder(R.entry);   // gardé tout de suite : fermer l'écran ou perdre le réseau ne le perd pas
    oublierUrl(); R.url = URL.createObjectURL(blob);
    R.etat = 'ecoute'; dessinerVoix(); dessinerAttente();
  }
  function refaire() {
    if (R.entry) oublier(R.entry.id);
    oublierUrl(); R.entry = null; R.etat = 'repos'; dire(''); dessinerVoix(); dessinerAttente();
  }

  // Envoi : fichier d'abord, ligne ensuite (même id). Tout est rejouable sans doublon.
  function envoyerEntree(e) {
    if (S.etatEnvoi[e.id] && S.etatEnvoi[e.id].en) return Promise.resolve(false);
    var c = sb(); if (!c || !V2.user) return Promise.resolve(false);
    S.etatEnvoi[e.id] = { en: true }; dessinerAttente();
    var chemin = V2.user.id + '/' + e.id + '.' + e.ext;
    return Promise.resolve(c.storage.from(BUCKET).upload(chemin, e.blob, { contentType: e.type, upsert: false })).then(function (r) {
      var er = r && r.error;
      // un envoi précédent qui avait déjà déposé le fichier : on continue (rejouer ne doit pas échouer)
      if (er && !/exist|duplicate|409/i.test(String(er.message || '') + String(er.statusCode || '') + String(er.error || ''))) throw new Error('fichier');
      return c.from(TABLE).insert({ id: e.id, author_id: V2.user.id, author_name: e.nom || V2.user.name || '', kind: 'vocal', body: '', statut: 'brouillon', audio_path: chemin, audio_type: e.type, duree_s: e.duree }).select('id');
    }).then(function (r) {
      var er = r && r.error;
      if (er && !(String(er.code) === '23505' || /duplicate|already exists/i.test(String(er.message || '')))) throw new Error('ligne');
      if (!er && !(Array.isArray(r.data) && r.data.length)) throw new Error('ligne');
      return oublier(e.id).then(function () { return true; });
    }).then(function (ok) {
      delete S.etatEnvoi[e.id]; return ok;
    }, function () {
      S.etatEnvoi[e.id] = { en: false, ko: true }; return false;
    });
  }
  function envoyerCourant() {
    var e = R.entry; if (!e || R.etat !== 'ecoute') return;
    R.etat = 'envoi'; dire(''); dessinerVoix(); dessinerAttente();
    envoyerEntree(e).then(function (ok) {
      if (ok) {
        oublierUrl(); R.entry = null; R.etat = 'repos'; dessinerVoix(); dire('Note vocale enregistrée en brouillon. Le robot ne la lira que si tu l’envoies.', 'ok');
        dessinerAttente(); charger();
      } else {
        // l'enregistrement quitte le lecteur et passe dans « Pas encore envoyé » (gardé, avec « Renvoyer », et renvoyé tout seul à la prochaine ouverture)
        oublierUrl(); R.entry = null; R.etat = 'repos'; dessinerVoix();
        dire('Pas encore rangé dans tes notes (pas de réseau ?). Ton enregistrement est gardé sur cet appareil : il sera rangé à ta prochaine visite de cet écran, ou avec « Réessayer ».', 'ko');
        dessinerAttente();
      }
    });
  }

  // — Enregistrements gardés mais pas encore dans la base —
  function dessinerAttente() {
    var z = document.getElementById('bn-attente'); if (!z) return;
    toutesGardees().then(function (l) {
      z = document.getElementById('bn-attente'); if (!z) return;
      l = l.filter(function (e) { return !(R.entry && R.entry.id === e.id && (R.etat === 'ecoute' || R.etat === 'envoi')); });   // celui qu'on écoute est déjà dans la carte « Note vocale »
      S.attente = l;
      if (!l.length) { z.innerHTML = ''; return; }
      (S.urlsAtt || []).forEach(function (u) { try { URL.revokeObjectURL(u); } catch (x) {} }); S.urlsAtt = [];
      z.innerHTML = '<div class="v2-card bn-att"><div class="bn-h">Gardé sur cet appareil, pas encore dans tes notes</div>' + l.map(function (e) {
        var u = URL.createObjectURL(e.blob); S.urlsAtt.push(u);
        var s = S.etatEnvoi[e.id] || {};
        return '<div class="bn-act"><p>Note vocale du ' + esc(dateLongue(cleJour(new Date(e.cree)))) + ' à ' + heure(e.cree) + ' (' + chrono(e.duree) + ')</p>' +
          '<audio class="bn-audio" controls preload="metadata" src="' + esc(u) + '"></audio>' +
          '<div class="bn-msg ' + (s.ko ? 'bn-msg--ko' : '') + '">' + (s.en ? 'Envoi en cours…' : s.ko ? 'Pas envoyée : réseau indisponible. L’enregistrement est gardé.' : 'Gardé sur cet appareil, pas encore dans ton bloc-notes.') + '</div>' +
          '<div class="bn-acts"><button type="button" class="v2-btn v2-btn-primary" data-bn="renvoyer" data-id="' + esc(e.id) + '"' + (s.en ? ' disabled' : '') + '>Réessayer</button>' +
          '<button type="button" class="bn-b bn-b--rose" data-bn="suppr-att" data-id="' + esc(e.id) + '"' + (s.en ? ' disabled' : '') + '>Supprimer</button></div></div>';
      }).join('') + '</div>';
    });
  }
  function renvoyer(id) {
    var e = S.attente.filter(function (x) { return x.id === id; })[0]; if (!e) return;
    envoyerEntree(e).then(function (ok) {
      if (ok) { toast('Note vocale envoyée'); charger(); } else toast('Toujours pas envoyée : l’enregistrement est gardé.', 'error');
      dessinerAttente();
    });
  }
  // À l'ouverture de l'écran : renvoie ce qui était resté en attente (un par un).
  function renvoyerTout() {
    toutesGardees().then(function (l) {
      l = l.filter(function (e) { return !(R.entry && R.entry.id === e.id); });
      return l.reduce(function (p, e) { return p.then(function () { return envoyerEntree(e).then(function (ok) { if (ok) { toast('Une note vocale gardée a été envoyée'); } }); }); }, Promise.resolve());
    }).then(function () { if (actif()) { dessinerAttente(); charger(); } });
  }

  // ═══ Branchement des gestes (un seul écouteur, délégué) ═══
  function geste(ev) {
    var b = ev.target.closest && ev.target.closest('[data-bn]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-bn'), id = b.getAttribute('data-row'), aid = b.getAttribute('data-a');
    if (a === 'dicter') { if (V2.notes && V2.notes.dictate) V2.notes.dictate(b); }
    else if (a === 'enregistrer') enregistrerTexte(b);
    else if (a === 'rec-start') demarrer();
    else if (a === 'rec-stop') arreter();
    else if (a === 'rec-envoyer') envoyerCourant();
    else if (a === 'rec-refaire') refaire();
    else if (a === 'renvoyer') renvoyer(b.getAttribute('data-id'));
    else if (a === 'suppr-att') { var i2 = b.getAttribute('data-id'); if (window.confirm('Supprimer cet enregistrement qui n’a pas été envoyé ? Il sera perdu.')) oublier(i2).then(dessinerAttente); }
    else if (a === 'recharger') { S.etat = 'charge'; dessinerListe(); charger(); }
    else if (a === 'ecouter') ecouter(id);
    else if (a === 'retirer') retirer(id);
    else if (a === 'envoyer') envoyerNote(id, 'brouillon', 'a_lire');
    else if (a === 'reprendre') envoyerNote(id, 'a_lire', 'brouillon');
    else if (a === 'envoyer-tout') envoyerTout();
    else if (a === 'edit') { var r = trouverRow(id); if (r) { S.edit = id; S.editTxt = texteDe(r); dessinerListe(); var t = document.getElementById('bn-edit-ta'); if (t) t.focus(); } }
    else if (a === 'edit-non') { S.edit = null; dessinerListe(); }
    else if (a === 'edit-ok') modifierTexte(id);
    else if (a === 'appliquer' || a === 'ignorer') {
      var row = trouverRow(id), act = row && trouverAct(row, aid); if (!act) return;
      if (a === 'ignorer') { ignorerUne(row, act); return; }
      delete S.msg[id + ':' + aid];
      appliquerUne(row, act, false).then(function (r) {
        if (r.ok) toast('Mise à jour appliquée');
        else { S.msg[id + ':' + aid] = { t: r.msg, neutre: !!r.neutre }; if (actif()) dessinerListe(); if (!r.neutre) toast(esc(r.msg), 'error'); }
      });
    }
    else if (a === 'tout-note') { var rw = trouverRow(id); if (rw) toutAppliquer(enAttente(rw)); }
    else if (a === 'tout-global') toutAppliquer(toutesEnAttente());
  }

  // Quitter l'écran pendant un enregistrement : il s'arrête et reste gardé (rien n'est perdu).
  window.addEventListener('hashchange', function () {
    var n = (location.hash || '').replace(/^#/, '').split('/')[0];
    if (n !== 'blocnotes' && R.etat === 'enreg') arreter();
  });

  V2.pages.blocnotes = {
    needs: [],
    render: function (root) {
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      if (isOpso()) {
        root.innerHTML = top + '<div class="v2-wrap v2-u bn-wrap" id="bn-root"><div class="v2-card"><div class="v2-empty"><div class="v2-empty-t" style="font-size:16px;font-weight:700;color:var(--ip-ink)">Cet espace n’est pas ouvert pour votre compte.</div></div></div></div>';
        return;
      }
      root.innerHTML = top + gabarit();
      var r = document.getElementById('bn-root');
      r.addEventListener('click', geste);
      r.addEventListener('input', function (ev) { if (ev.target && ev.target.id === 'bn-edit-ta') S.editTxt = ev.target.value; });
      if (S.etat !== 'pret') S.etat = 'charge';   // un enregistrement en cours (R) continue : seul son affichage est refait
      if (S.minuteur) { clearTimeout(S.minuteur); S.minuteur = null; }
      dessinerVoix(); dessinerAttente(); dessinerListe();
      charger().then(function () { if (actif()) renvoyerTout(); });
    }
  };
})();
