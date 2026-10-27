/* ═══════════════════════════════════════════════════════════════════════════
   ÉCRAN « À RAPPELER CETTE SEMAINE » (V2.decrochageUI) — ce fichier DESSINE,
   v2-decrochage-moteur.js COMPTE. Trois endroits :
   - bloc() : en tête de l'onglet Clients de « Mes officines » (v2-pharma.js) ;
   - bandeau(pid, tel) : en tête de la fiche si l'officine est dans la liste ;
   - compte() : « N à rappeler » sur le bandeau Officines de l'accueil.

   ⚠️ AUCUN TEXTE RÉDIGÉ PAR UNE IA : chaque phrase est un gabarit rempli de
   chiffres, et les seuils affichés se LISENT dans V2.decrochage.REGLAGES.
   ⚠️ AUCUNE ÉCRITURE AUTOMATIQUE : seuls les trois gestes du commercial
   écrivent, et seulement dans la table decrochage_suivi (_sql/decrochage-suivi.sql).
   Tant que la table n'existe pas ou refuse l'écriture, le geste reste sur
   l'appareil (clé jarvis_decrochage_v1:<id du compte>) et repart à l'ouverture suivante —
   même motif que v2-visites.js. Rien n'est perdu.
   Hors OPSO et Escale (hors périmètre de cette version).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var TABLE = 'decrochage_suivi', LS = 'jarvis_decrochage_v1';
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var MOTIFS = [['fermeture_reprise', 'Fermeture ou reprise'], ['change_grossiste', 'A changé de grossiste'],
    ['saisonnier', 'Saisonnier'], ['deja_traite', 'Déjà traité'], ['autre', 'Autre']];
  var ATTENTION_JOURS = 45;   // ventes plus vieilles que ça : bandeau en couleur d'attention (§6.7)

  var serveur = null;   // lignes lues dans la table (null = pas encore lues ou table absente)
  var memo = null, version = 0, ouvert = false, motifDe = null;

  function D() { return V2.decrochage || null; }
  function esc(s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  // identifiant glissé dans un onclick : chiffres, lettres, tiret et souligné seulement
  function js(s) { return String(s == null ? '' : s).replace(/[^0-9A-Za-z_-]/g, ''); }
  function eur(n) { return V2.fmtEur ? V2.fmtEur(n) : Math.round(n) + ' €'; }
  function sb() { return (V2.sb && V2.sb()) || null; }
  function auj() {
    var d = new Date(), m = d.getMonth() + 1, j = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (j < 10 ? '0' : '') + j;
  }
  function moisNom(cle, court) { var p = String(cle).split('-'); return (court ? MOIS_C : MOIS)[+p[1] - 1] + (court ? '' : ' ' + p[0]); }
  function jjmm(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  function horsPerimetre() { var b = window.V2_BRAND || {}; return !!(b.opso || b.escale); }
  function commercial() { return V2.commFilter || (V2.user && V2.user.commercial) || ''; }
  function ventesChargees() { var p = V2.ventesProgres; return !(p && p.total && p.n < p.total); }

  // ── Les gestes : table d'abord, appareil en secours ──────────────────
  // Une clé PAR COMPTE : deux commerciaux sur le même appareil ne se mélangent pas — les
  // gestes de l'un ne partent jamais au nom de l'autre et ne masquent pas ses lignes.
  function cleLS() { return LS + ':' + ((V2.user && V2.user.id) || 'sans-compte'); }
  function locaux() { try { var a = JSON.parse(localStorage.getItem(cleLS()) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function locauxSet(a) { try { localStorage.setItem(cleLS(), JSON.stringify(a)); } catch (e) {} }
  function cleGeste(g) { return g.pharmacy_id + '|' + g.mois_ref; }
  function suivis() {
    var par = {};
    (serveur || []).concat(locaux()).forEach(function (g) {
      var k = cleGeste(g), p = par[k];
      if (!p || String(g.geste_le || '') > String(p.geste_le || '')) par[k] = g;
    });
    return Object.keys(par).map(function (k) { return par[k]; });
  }
  function envoyer(lignes, fin) {
    var c = sb(), u = V2.user && V2.user.id;
    if (!c || !u || !lignes.length) { if (fin) fin(false); return; }
    try {
      c.from(TABLE).upsert(lignes.map(function (g) {
        return { user_id: u, pharmacy_id: g.pharmacy_id, mois_ref: g.mois_ref, raison: g.raison, statut: g.statut,
          motif: g.motif || null, ecart_mensuel: g.ecart_mensuel, avant_mensuel: g.avant_mensuel, geste_le: g.geste_le };
      }), { onConflict: 'user_id,pharmacy_id,mois_ref' }).then(function (r) {
        var ok = !(r && r.error);
        if (ok) {
          var parties = {}; lignes.forEach(function (g) { parties[cleGeste(g) + g.geste_le] = 1; });
          locauxSet(locaux().filter(function (g) { return !parties[cleGeste(g) + g.geste_le]; }));
          serveur = (serveur || []).concat(lignes);
        }
        if (fin) fin(ok);
      }, function () { if (fin) fin(false); });
    } catch (e) { if (fin) fin(false); }
  }
  // À l'ouverture : lit SES gestes (la direction lit tout par la règle d'accès, on garde les siens),
  // puis renvoie ce qui attend sur l'appareil. Silencieux si la table n'existe pas encore.
  function charger() {
    var c = sb(), u = V2.user && V2.user.id;
    if (!c || !u || charger.fait) return;
    charger.fait = true;
    try {
      c.from(TABLE).select('pharmacy_id, mois_ref, raison, statut, motif, ecart_mensuel, avant_mensuel, geste_le')
        .eq('user_id', u).then(function (r) {
          if (!r || r.error || !r.data) return;
          serveur = r.data; version++;
          var att = locaux(); if (att.length) envoyer(att, function () { version++; rafraichir(); });
          rafraichir();
        }, function () {});
    } catch (e) {}
  }

  // ── Le calcul, mémorisé (l'accueil et la liste le demandent à chaque rendu) ──
  function calcul() {
    var M = D(), qui = commercial();
    if (!M || horsPerimetre() || !V2.user) return null;
    if (!qui) return { sansCommercial: true };
    if (!ventesChargees()) return { chargement: true };
    var j = auj(), cle = [V2.user.id, qui, j, version, (V2.sales || []).length].join('|');
    if (memo && memo.cle === cle && memo.ref === V2.sales) return memo.r;
    charger();
    var r = M.calculer({
      ventes: V2.sales || [], commercial: qui, aujourdhui: j,
      voit: V2.voitVentesDe ? function (pid) { return V2.voitVentesDe(pid); } : null,
      contacts: V2.visite && V2.visite.all ? V2.visite.all() : {},
      suivis: suivis(), reprises: window.REPRISES || {}
    });
    var noms = {}; (V2.pharmacies || []).forEach(function (p) { noms[String(p.id)] = p; });
    r.lignes.forEach(function (l) { l.p = noms[l.pid] || null; });
    memo = { cle: cle, ref: V2.sales, r: r };
    return r;
  }
  function ligneDe(pid) {
    var r = calcul(); if (!r || !r.lignes) return null;
    for (var i = 0; i < r.lignes.length; i++) if (r.lignes[i].pid === String(pid)) return r.lignes[i];
    return null;
  }

  // Habitudes interrompues (même règle que « Ne commande plus » de la fiche), pour les lignes affichées seulement.
  function habitudes(l) {
    if (l._hab !== undefined) return l._hab;
    l._hab = null;
    try {
      var v = V2.pharmaVentesDe ? V2.pharmaVentesDe(l.pid) : null;
      if (v && v.length && V2.briefOfficine && V2.briefOfficine.nePlusCommandes) {
        var n = V2.briefOfficine.nePlusCommandes(v);
        if (n && n.connu && n.lignes.length) l._hab = { n: n.lignes.length, fin: n.fin };
      }
    } catch (e) {}
    return l._hab;
  }

  // ── Les phrases (gabarits remplis de chiffres) ───────────────────────
  function regle() {
    var R = D().REGLAGES;
    return 'baisse d’au moins ' + Math.round(R.baissePct * 100) + '\u00A0% et ' + eur(R.baisseMinAvant) + ' sur trois mois';
  }
  function periodeTxt(r) {
    var a = r.periode.avant, b = r.periode.recent;
    return moisNom(b[0], true) + '-' + moisNom(b[1], true) + ' contre ' + moisNom(a[0], true) + '-' + moisNom(a[1], true);
  }
  function phrase(l, r) {
    var t = (l.raison === 'reprise' ? 'Changement de titulaire · ' : '') +
      '−' + eur(l.ecartMensuel) + ' par mois (' + periodeTxt(r) + ', −' + Math.round(l.pct * 100) + '\u00A0%)';
    var h = habitudes(l);
    if (h && h.fin) t += '\u00A0; ' + h.n + ' référence' + (h.n > 1 ? 's' : '') + ' habituelle' + (h.n > 1 ? 's' : '') + ' absente' + (h.n > 1 ? 's' : '') + ' en ' + moisNom(h.fin).split(' ')[0];
    return t;
  }
  function contactTxt(l) {
    var t = l.dernierContact ? 'Dernier contact : ' + jjmm(l.dernierContact) : 'Aucun contact noté';
    if (l.resultat && l.resultat.statut === 'toujours_en_baisse') t += ' · toujours en baisse depuis le geste';
    return t;
  }
  function fraicheur(r) {
    var p = String(r.moisRef).split('-'), fin = new Date(+p[0], +p[1], 0);
    var j = Math.round((Date.parse(auj()) - Date.parse(fin.getFullYear() + '-' + p[1] + '-' + String(fin.getDate()))) / 864e5);
    var t = 'Ventes jusqu’à fin ' + moisNom(r.moisRef);
    if (r.moisEcartes && r.moisEcartes.length) t += ' (' + r.moisEcartes.map(function (m) { return moisNom(m).split(' ')[0]; }).join(', ') + ' écarté' + (r.moisEcartes.length > 1 ? 's' : '') + ' : incomplet)';
    return '<p class="dr-date' + (j > ATTENTION_JOURS ? ' dr-vieux' : '') + '">' + esc(t) + '</p>';
  }

  // ── Le rendu ─────────────────────────────────────────────────────────
  function gestes(l) {
    var tel = l.p && l.p.tel != null ? String(l.p.tel).replace(/[^+0-9]/g, '') : '';
    if (motifDe === l.pid) {
      return '<div class="dr-motifs" role="group" aria-label="Pourquoi ce n’est pas pertinent">' +
        MOTIFS.map(function (m) { return '<button type="button" class="dr-g" onclick="V2.decrochageUI.geste(\'' + js(l.pid) + '\',\'pas_pertinent\',\'' + m[0] + '\')">' + esc(m[1]) + '</button>'; }).join('') +
        '<button type="button" class="dr-g dr-g-x" onclick="V2.decrochageUI.motifs(null)">Annuler</button></div>';
    }
    return '<div class="dr-gestes">' +
      (tel ? '<a class="dr-g dr-g-1" href="tel:' + esc(tel) + '" onclick="V2.decrochageUI.geste(\'' + js(l.pid) + '\',\'appelee\')">Appeler</a>' : '') +
      '<button type="button" class="dr-g" onclick="V2.decrochageUI.geste(\'' + js(l.pid) + '\',\'notee\')">Noter</button>' +
      '<button type="button" class="dr-g" onclick="V2.decrochageUI.motifs(\'' + js(l.pid) + '\')">Pas pertinent</button></div>';
  }
  function ligneHtml(l, r, i) {
    var p = l.p || {}, nom = p.name || ('Officine ' + l.pid);
    return '<li class="dr-l' + (i >= 3 ? ' dr-plus' : '') + '" data-pid="' + esc(l.pid) + '">' +
      '<div class="dr-l-t"><a class="dr-nom" href="#" onclick="event.preventDefault();V2.go(\'pharma\',\'' + js(l.pid) + '\')">' + esc(nom) + '</a>' +
      (p.ville ? '<span class="dr-ville">' + esc(p.ville) + '</span>' : '') +
      (l.etat === 'en_cours' ? '<span class="dr-tag">en cours</span>' : '') + '</div>' +
      '<p class="dr-ph">' + esc(phrase(l, r)) + '</p>' +
      '<p class="dr-ct">' + esc(contactTxt(l)) + '</p>' + gestes(l) + '</li>';
  }
  function corps(r) {
    if (r.sansCommercial) return '<p class="dr-vide">Choisissez un commercial dans le menu ci-dessus pour voir ses officines à rappeler.</p>';
    if (r.chargement) return '<p class="dr-vide">Chargement des ventes…</p>';
    if (!r.comparable) return '<p class="dr-vide">Liste suspendue : il manque des mois de ventes complets (' + r.moisComplets + ' sur ' + D().REGLAGES.moisMin + ').</p>';
    if (!r.lignes.length) return fraicheur(r) + '<p class="dr-vide">Aucune officine en ' + esc(regle()) + '.' +
      (r.masquees ? ' ' + r.masquees + ' écartée' + (r.masquees > 1 ? 's' : '') + ' (pas pertinent).' : '') + '</p>';
    var n = r.lignes.length, plus = n > 3;
    var pied = [];
    if (r.total > n) pied.push('Les ' + n + ' premières sur ' + r.total + ', par euros en jeu');
    if (r.masquees) pied.push(r.masquees + ' écartée' + (r.masquees > 1 ? 's' : '') + ' (pas pertinent)');
    if (r.revenues.length) pied.push(r.revenues.length + ' revenue' + (r.revenues.length > 1 ? 's' : '') + ' après votre geste');
    return fraicheur(r) + '<ol class="dr-liste">' + r.lignes.map(function (l, i) { return ligneHtml(l, r, i); }).join('') + '</ol>' +
      (plus ? '<button type="button" class="dr-voir" aria-expanded="' + ouvert + '" onclick="V2.decrochageUI.voir()">' + (ouvert ? 'Replier' : 'Voir les ' + n) + '</button>' : '') +
      (pied.length ? '<p class="dr-pied">' + esc(pied.join(' · ')) + '</p>' : '');
  }
  function bloc() {
    var r = calcul(); if (!r) return '';
    css();
    var nb = r.nbARappeler;
    return '<section class="v2-card dr' + (ouvert ? ' dr-ouvert' : '') + '" id="dr-bloc" aria-labelledby="dr-titre">' +
      '<div class="dr-tete"><h2 class="dr-titre" id="dr-titre">À rappeler cette semaine</h2>' +
      (typeof nb === 'number' && nb > 0 ? '<span class="dr-n">' + nb + '</span>' : '') + '</div>' +
      '<p class="dr-regle">Officines en ' + esc(regle()) + '.</p>' + corps(r) + '</section>';
  }
  function rafraichir() {
    var el = document.getElementById('dr-bloc');
    if (el) { var t = document.createElement('div'); t.innerHTML = bloc(); if (t.firstChild) el.parentNode.replaceChild(t.firstChild, el); }
    var b = document.getElementById('dr-bandeau');
    if (b) { var t2 = document.createElement('div'); t2.innerHTML = bandeau(b.getAttribute('data-pid')); b.parentNode.replaceChild(t2.firstChild || document.createTextNode(''), b); }
  }

  function bandeau(pid) {
    var l = ligneDe(pid), r = memo && memo.r;
    if (!l || !r) return '';
    css();
    return '<div class="dr-bandeau v2-card" id="dr-bandeau" data-pid="' + esc(l.pid) + '">' +
      '<div class="dr-l-t"><b class="dr-titre">À rappeler cette semaine</b>' + (l.etat === 'en_cours' ? '<span class="dr-tag">en cours</span>' : '') + '</div>' +
      '<p class="dr-ph">' + esc(phrase(l, r)) + '</p><p class="dr-ct">' + esc(contactTxt(l)) +
      ' · <a href="#" onclick="event.preventDefault();V2.decrochageUI.nePlus()">Ce qu’elle ne commande plus</a></p>' + gestes(l) + '</div>';
  }

  function geste(pid, statut, motif) {
    var l = ligneDe(pid), r = memo && memo.r;
    if (!l || !r) return;
    var g = { pharmacy_id: String(pid), mois_ref: r.moisRef, raison: l.raison, statut: statut, motif: motif || null,
      ecart_mensuel: Math.round(l.ecartMensuel), avant_mensuel: Math.round(l.avantMensuel), geste_le: new Date().toISOString() };
    locauxSet(locaux().filter(function (x) { return cleGeste(x) !== cleGeste(g); }).concat([g]));
    motifDe = null; version++;
    try { if (V2.mesurer) V2.mesurer('rappeler-' + statut, true); } catch (e) {}
    envoyer([g], function (ok) {
      if (!ok && V2.toast) V2.toast('Geste gardé sur cet appareil : il sera envoyé à la prochaine ouverture');
    });
    if (statut === 'notee') {
      V2.go('pharma', String(pid));
      setTimeout(function () { if (V2.pharmaL && V2.pharmaL.go) V2.pharmaL.go('notes'); }, 80);
      return;
    }
    rafraichir();
  }

  // ── Styles (pièces de l'app : variables du thème, aucun effet interdit sous Safari) ──
  function css() {
    if (document.getElementById('dr-css')) return;
    var s = document.createElement('style'); s.id = 'dr-css';
    s.textContent = [
      '.dr{padding:16px 16px 12px;margin:0 0 14px}',
      '.dr-tete{display:flex;align-items:center;gap:10px}',
      '.dr-titre{font-size:17px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink);margin:0}',
      '.dr-n{min-width:26px;height:26px;padding:0 8px;border-radius:var(--r-pill);background:var(--ip-blue);color:#fff;font-weight:800;font-size:14px;display:inline-flex;align-items:center;justify-content:center}',
      '.dr-regle,.dr-date,.dr-pied{font-size:13px;color:var(--muted);margin:4px 0 0}',
      '.dr-date.dr-vieux{color:var(--ip-ink);background:color-mix(in srgb,var(--warn) 22%,transparent);border-radius:var(--r-sm);padding:4px 8px;display:inline-block;font-weight:600}',
      '.dr-vide{font-size:14px;color:var(--ip-ink-2);margin:10px 0 4px}',
      '.dr-liste{list-style:none;margin:10px 0 0;padding:0}',
      '.dr-l{padding:12px 0;border-top:1px solid var(--line-strong)}',
      '.dr:not(.dr-ouvert) .dr-plus{display:none}',
      '.dr-l-t{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px}',
      '.dr-nom{font-weight:700;font-size:15px;color:var(--ip-ink);text-decoration:none;overflow-wrap:anywhere}',
      '.dr-nom:hover{text-decoration:underline}',
      '.dr-ville{font-size:13px;color:var(--muted)}',
      '.dr-tag{font-size:12px;font-weight:700;color:var(--ip-blue-d);background:var(--surf-sunken);border-radius:var(--r-pill);padding:2px 8px}',
      '.dr-ph{font-size:14px;color:var(--ip-ink);margin:4px 0 0;line-height:1.4}',
      '.dr-ct{font-size:13px;color:var(--muted);margin:2px 0 0}',
      '.dr-gestes,.dr-motifs{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '.dr-g{min-height:var(--tap-min);padding:0 14px;border-radius:var(--r-pill);border:1px solid var(--line-strong);background:var(--card);color:var(--ip-ink);font:inherit;font-size:14px;font-weight:600;display:inline-flex;align-items:center;text-decoration:none;cursor:pointer}',
      '.dr-g-1{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.dr-g-x{color:var(--muted)}',
      '.dr-g:focus-visible,.dr-voir:focus-visible,.dr-nom:focus-visible{outline:2px solid var(--ip-blue);outline-offset:2px}',
      '.dr-voir{margin-top:8px;min-height:var(--tap-min);width:100%;border:0;border-top:1px solid var(--line-strong);background:none;color:var(--ip-blue);font:inherit;font-size:14px;font-weight:700;cursor:pointer}',
      '.dr-bandeau{padding:14px 16px;margin:0 0 14px}',
      '.dr-bandeau .dr-titre{font-size:15px}',
      '.dr-bandeau .dr-ct a{color:var(--ip-blue)}',
      // Au doigt : le nom de l'officine (~20 px) et le lien du bandeau (~16 px)
      // s'agrandissent à 44 px sans bouger la mise en page (marge négative).
      '@media(max-width:640px){.dr-nom{display:inline-block;padding:12px 0;margin:-12px 0}' +
        '.dr-bandeau .dr-ct a{display:inline-block;padding:14px 0;margin:-14px 0}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  V2.decrochageUI = {
    bloc: bloc, bandeau: bandeau, geste: geste,
    // « N à rappeler » pour l'accueil : null tant que ce n'est pas calculable (jamais un faux 0).
    compte: function () { var r = calcul(); return r && r.comparable ? r.nbARappeler : null; },
    motifs: function (pid) { motifDe = pid; rafraichir(); },
    voir: function () { ouvert = !ouvert; rafraichir(); },
    nePlus: function () {
      if (V2.pharmaL && V2.pharmaL.go && document.getElementById('l8-v-neplus')) { V2.pharmaL.go('neplus'); return; }
      var el = document.querySelector('.pha-np'); if (el) el.scrollIntoView({ block: 'start' });
    },
    // pour les tests
    _raz: function () { serveur = null; memo = null; version++; ouvert = false; motifDe = null; charger.fait = false; }
  };
})();
