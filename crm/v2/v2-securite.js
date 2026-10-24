/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Sécurité (V2.securite) — 24/10/2026

   Will : un écran pour piloter lui-même la sécurité de l'app, visible de son seul compte.

   · Accès : RPC jarvis_acces_securite() (_sql/securite.sql), vrai pour le seul compte de Will.
     La ligne du menu du compte n'est posée que si la base répond oui. L'état n'est demandé
     (jarvis_securite_etat) qu'APRÈS ce oui ; sans le droit, l'écran dit « Écran réservé. » et rien d'autre.
   · ⚠️ LE DÉPÔT EST PUBLIC : ce fichier ne contient AUCUN constat, aucun point faible, aucun texte du plan
     d'action, aucun nom de personne. Il affiche ce que renvoie la base (constats, comptes, plan) et ce que dit
     l'API publique de GitHub (contrôles automatiques). Les seuls textes écrits ici sont des libellés génériques.
   · Même habillage que « Listing produits 2027 » (classes mp-*), une seule couleur d'accent, aucun opacity sur
     du texte, aucun effet interdit sous Safari.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var ICO = function (n, s, w) { return V2.ICO ? V2.ICO(n, s, w) : (window.ICO ? window.ICO(n, s, w) : ''); };

  // ── Réglages d'affichage ──────────────────────────────────────────
  var GH_API = 'https://api.github.com/repos/willmorel49-coder/jarvis-app/actions/runs';
  var GH_CI = 'CI (contrôle avant prod)', GH_RDV = 'Gardien de la prise de rendez-vous';
  var GH_ETAPE = 'Installer Playwright';
  var GH_CACHE_MS = 5 * 60 * 1000, GH_DELAI_MS = 9000, GH_SEUIL_S = 120;
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var ROLES = { admin: 'Administrateurs', commercial: 'Commerciaux', opso: 'Espace OPSO' };
  var STATUTS = {
    fait: ['Fait', 'g'], a_toi: ['À toi', 'a'], en_attente: ['En attente', 'b'],
    laisse: ['Laissé de côté', 'n'], chaque_mois: ['Chaque mois', 'b'], a_faire: ['À faire', 'a']
  };

  // ── État ──────────────────────────────────────────────────────────
  var acces = null, accesP = null, accesEchec = false;
  var etat = null, etatErreur = false, enCours = false;
  var gh = null, ghMem = null;
  var racine = null, ecouteurs = false;

  function sb() { return (V2.sb && V2.sb()) || null; }
  function moi() { return (V2.user && V2.user.id) || null; }
  function enRoute() { return !!(V2.route && V2.route.name === 'securite'); }

  // ── Accès : c'est la base qui répond, pas une liste écrite ici ────
  function verifier() {
    if (acces !== null) return Promise.resolve(acces);
    if (accesP) return accesP;
    var c = sb();
    if (!c || !moi()) return Promise.resolve(false);
    accesP = c.rpc('jarvis_acces_securite').then(function (r) {
      accesP = null;
      if (r && !r.error) { acces = (r.data === true); return acces; }
      return false;                   // échec de lecture : on redemandera, on ne conclut rien
    }).catch(function () { accesP = null; return false; });
    return accesP;
  }

  // ── Petits outils d'affichage ─────────────────────────────────────
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function heure(d) { return p2(d.getHours()) + ' h ' + p2(d.getMinutes()); }
  function dateLongue(v) {
    var d = v ? new Date(v) : null;
    if (!d || isNaN(d.getTime())) return '';
    return d.getDate() + (d.getDate() === 1 ? 'er' : '') + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear();
  }
  var MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function dateCourte(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    return m ? parseInt(m[3], 10) + ' ' + MOIS_C[parseInt(m[2], 10) - 1] : '';
  }
  function ilYa(v) {
    var s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
    if (isNaN(s)) return '';
    if (s < 90) return 'à l’instant';
    var m = Math.round(s / 60); if (m < 60) return 'il y a ' + m + ' min';
    var h = Math.round(m / 60); if (h < 36) return 'il y a ' + h + ' h';
    var j = Math.round(h / 24); return 'il y a ' + j + ' jours';
  }
  function duree(s) {
    s = Math.max(0, Math.round(s));
    if (s < 60) return s + ' s';
    return Math.floor(s / 60) + ' min ' + p2(s % 60) + ' s';
  }
  function minutes(s) { return (Math.round(s / 6) / 10).toString().replace('.', ',') + ' min'; }
  function nombre(v) { return String(v == null ? 0 : v); }

  // ── GitHub : API publique, sans jeton, depuis le navigateur ───────
  function ghLire() {
    var maintenant = Date.now();
    if (ghMem && maintenant - ghMem.t < GH_CACHE_MS) return Promise.resolve(ghMem.d);
    try {
      var s = JSON.parse(sessionStorage.getItem('sc-gh') || 'null');
      if (s && s.d && maintenant - s.t < GH_CACHE_MS) { ghMem = s; return Promise.resolve(s.d); }
    } catch (e) {}
    var delai = new Promise(function (ok) { setTimeout(function () { ok({ ok: false }); }, GH_DELAI_MS); });
    var lecture = fetch(GH_API + '?per_page=30', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (j) {
        var runs = (j && j.workflow_runs) || [];
        var finis = function (nom) { return runs.filter(function (r) { return r.name === nom && r.status === 'completed'; }); };
        var dernier = function (nom) {
          var l = finis(nom)[0]; if (!l) return null;
          var t0 = new Date(l.run_started_at || l.created_at).getTime(), t1 = new Date(l.updated_at).getTime();
          return { conclusion: l.conclusion, quand: l.updated_at, duree: (t1 - t0) / 1000 };
        };
        var d = { ok: true, ci: dernier(GH_CI), rdv: dernier(GH_RDV), etapes: null };
        var cinq = finis(GH_CI).slice(0, 5);
        return Promise.all(cinq.map(function (r) {
          return fetch(GH_API + '/' + r.id + '/jobs', { headers: { Accept: 'application/vnd.github+json' } })
            .then(function (x) { if (!x.ok) throw new Error('http'); return x.json(); })
            .then(function (jj) {
              var st = null;
              (jj.jobs || []).forEach(function (job) {
                (job.steps || []).forEach(function (e) {
                  if (!st && String(e.name).indexOf(GH_ETAPE) === 0 && e.started_at && e.completed_at) {
                    st = (new Date(e.completed_at).getTime() - new Date(e.started_at).getTime()) / 1000;
                  }
                });
              });
              return { quand: r.updated_at, s: st };
            });
        })).then(function (liste) { d.etapes = liste; return d; }, function () { return d; });
      })
      .catch(function () { return { ok: false }; });
    return Promise.race([lecture, delai]).then(function (d) {
      if (d && d.ok) { ghMem = { t: Date.now(), d: d }; try { sessionStorage.setItem('sc-gh', JSON.stringify(ghMem)); } catch (e) {} }
      return d;
    });
  }

  // ── Lecture de la base + GitHub ───────────────────────────────────
  function charger() {
    if (enCours) return;
    enCours = true; etatErreur = false;
    var c = sb();
    var base = c.rpc('jarvis_securite_etat').then(function (r) {
      if (r && !r.error && r.data) { etat = r.data; return; }
      etatErreur = true;
    }).catch(function () { etatErreur = true; });
    Promise.all([base, ghLire()]).then(function (res) {
      gh = res[1] || { ok: false };
      enCours = false;
      if (enRoute()) V2.render();
    });
  }

  // ── Verdict ───────────────────────────────────────────────────────
  function points() {
    var l = [];
    ((etat && etat.alertes) || []).forEach(function (a) { l.push(a.texte); });
    if (gh && gh.ok) {
      if (gh.ci && gh.ci.conclusion === 'failure') l.push('Le dernier contrôle avant mise en ligne est rouge');
      if (gh.rdv && gh.rdv.conclusion === 'failure') l.push('Le dernier contrôle de la prise de rendez-vous est rouge');
    }
    return l;
  }

  // ── Écrans ────────────────────────────────────────────────────────
  function top() { return (V2.topbar ? V2.topbar({ back: true, nom: 'Sécurité' }) : ''); }
  function message(root, titre, texte, bouton) {
    css();
    root.innerHTML = top() + '<div class="v2-wrap mp-wrap"><div class="mp-etat" data-etat="1"><div class="mp-lock">' + ICO('check', 26, 1.8) + '</div><h1 class="mp-et">' + esc(titre) + '</h1>' + (texte ? '<p>' + esc(texte) + '</p>' : '') + (bouton || '') + '</div></div>';
  }
  function chargement(root) { css(); root.innerHTML = top() + '<div class="v2-loading"><div class="v2-spinner"></div><div>Chargement…</div></div>'; }

  function enTete() {
    var lu = etat && etat.lu_a ? new Date(etat.lu_a) : new Date();
    return '<section class="mp-hero" data-sc="entete"><div class="mp-hero-t">' +
      '<div class="mp-eyebrow"><span class="dot"></span>Réservé à ton compte</div>' +
      '<h1 class="mp-h1">Sécurité</h1>' +
      '<p class="mp-sub" data-sc="lu">Lu en direct à ' + esc(heure(lu)) + '</p></div>' +
      '<div class="mp-hero-a"><button type="button" class="v2-btn v2-btn-primary sc-relire" data-sc-act="relire">Relire</button></div></section>';
  }

  function verdict() {
    var pts = points();
    var h = '<section class="mp-sec" data-sc="verdict"><div class="mp-card sc-verdict ' + (pts.length ? 'att' : 'ok') + '">' +
      '<div class="sc-vi" aria-hidden="true">' + ICO(pts.length ? 'alert' : 'check', 22, 2) + '</div><div class="sc-vt">' +
      '<h2 class="sc-v1" data-sc="verdict-texte">' + (pts.length ? pts.length + (pts.length > 1 ? ' points à regarder' : ' point à regarder') : 'Tout est en ordre') + '</h2>';
    if (pts.length) {
      h += '<ul class="sc-pts">';
      pts.forEach(function (t) { h += '<li>' + esc(t) + '</li>'; });
      h += '</ul>';
    }
    return h + '</div></div></section>';
  }

  function pastille(statut) {
    var s = STATUTS[statut] || [String(statut), 'n'];
    return '<span class="v2-chip ' + s[1] + (s[1] === 'n' ? ' sc-n' : '') + '" data-statut="' + esc(statut) + '">' + esc(s[0]) + '</span>';
  }
  function ligneAttente(p) {
    return '<div class="sc-row sc-att" data-num="' + esc(p.num) + '"><span class="sc-num">' + esc(p.num) + '</span>' +
      '<span class="sc-tx"><b>' + esc(p.titre) + '</b><span>' + esc(p.detail) + '</span></span>' +
      '<span class="sc-st">' + pastille(p.statut) + '</span></div>';
  }
  function attente() {
    var l = ((etat && etat.plan) || []).filter(function (p) { return p.statut === 'a_toi' || p.statut === 'chaque_mois'; });
    var h = '<section class="mp-sec" data-sc="attente"><div class="mp-sh"><h2>Ce qui t’attend</h2><span>Ce que toi seul peux faire, et ce qui revient chaque mois.</span></div><div class="mp-card">';
    if (!l.length) h += '<div class="mp-vide">Rien pour l’instant.</div>';
    l.forEach(function (p) { h += ligneAttente(p); });
    return h + '</div></section>';
  }

  function pastilleRun(r) {
    if (!r) return '<span class="v2-chip n sc-n">Aucun passage récent</span>';
    return r.conclusion === 'success' ? '<span class="v2-chip g">Vert</span>' :
      r.conclusion === 'failure' ? '<span class="v2-chip r">Rouge</span>' : '<span class="v2-chip n sc-n">Interrompu</span>';
  }
  function ligneRun(titre, r) {
    return '<div class="sc-row sc-run"><span class="sc-tx"><b>' + esc(titre) + '</b><span>' +
      (r ? 'Dernier passage ' + esc(ilYa(r.quand)) + ' · durée ' + esc(duree(r.duree)) : 'Rien dans les 30 derniers passages lus') + '</span></span>' +
      '<span class="sc-st">' + pastilleRun(r) + '</span></div>';
  }
  function barres() {
    var l = (gh.etapes || []).filter(function (e) { return e.s != null; });
    var h = '<div class="sc-bt"><b>Durée de l’installation du test de navigateur</b><span>Les 5 derniers passages · normal : moins de 2 min</span></div>';
    if (!l.length) return h + '<div class="mp-vide sc-vide">Durées illisibles pour l’instant.</div>';
    var max = Math.max(GH_SEUIL_S, Math.max.apply(null, l.map(function (e) { return e.s; })));
    h += '<div class="sc-bars">';
    l.forEach(function (e) {
      var lent = e.s >= GH_SEUIL_S;
      h += '<div class="sc-bar' + (lent ? ' lent' : '') + '"><span class="sc-bq">' + esc(ilYa(e.quand)) + '</span>' +
        '<span class="mp-bar"><i style="width:' + Math.max(2, Math.round(e.s / max * 100)) + '%;background:var(--c-froid)"></i></span>' +
        '<b class="sc-bv" data-s="' + Math.round(e.s) + '">' + esc(minutes(e.s)) + '</b></div>';
    });
    return h + '</div>';
  }
  function controles() {
    var h = '<section class="mp-sec" data-sc="controles"><div class="mp-sh"><h2>Contrôles automatiques</h2><span>Lus sur GitHub à chaque ouverture de cet écran.</span></div><div class="mp-card">';
    if (!gh || !gh.ok) {
      h += '<div class="mp-vide sc-calme" data-gh="illisible">Contrôles GitHub illisibles pour l’instant</div>';
    } else {
      h += ligneRun('Contrôle avant mise en ligne', gh.ci) + ligneRun('Gardien de la prise de rendez-vous', gh.rdv) + barres();
    }
    return h + '</div></section>';
  }

  function detailConstat(c) {
    var d = c.detail;
    if (!d || !d.length) return '';
    if (typeof d[0] === 'object') {
      return '<span class="sc-dt">' + d.map(function (x) { return esc(x.nom) + ' · ' + (x.public ? 'ouvert' : 'fermé'); }).join(' ; ') + '</span>';
    }
    return c.ok ? '' : '<span class="sc-dt">' + d.map(esc).join(', ') + '</span>';
  }
  function base() {
    var h = '<section class="mp-sec" data-sc="base"><div class="mp-sh"><h2>La base</h2><span>Ce que la base de données dit d’elle-même à l’instant.</span></div><div class="mp-card">';
    ((etat && etat.constats) || []).forEach(function (c) {
      h += '<div class="sc-row sc-cs" data-cle="' + esc(c.cle) + '"><span class="sc-tx"><b>' + esc(c.libelle) + '</b>' + detailConstat(c) + '</span>' +
        '<span class="sc-val"><b>' + esc(c.valeur) + '</b><small>attendu : ' + esc(c.attendu) + '</small></span>' +
        '<span class="sc-st"><span class="v2-chip ' + (c.ok ? 'g' : 'a') + '">' + (c.ok ? 'Ok' : 'À regarder') + '</span></span></div>';
    });
    return h + '</div></section>';
  }

  function kpi(titre, valeur, detail, couleur) {
    return '<div class="mp-kpi" style="--k:' + couleur + '"><div class="mp-kl">' + esc(titre) + '</div><div class="mp-kv">' + esc(valeur) + '</div><div class="mp-kd">' + detail + '</div></div>';
  }
  function comptes() {
    var c = (etat && etat.comptes) || {}, total = c.total || 0, roles = c.par_role || {};
    var rl = Object.keys(roles).sort(function (a, b) { return roles[b] - roles[a]; }).map(function (k) {
      return esc(ROLES[k] || k) + ' : ' + esc(roles[k]);
    }).join(' · ');
    var h = '<section class="mp-sec" data-sc="comptes"><div class="mp-sh"><h2>Les comptes</h2><span>Qui a un accès à l’app, et qui s’en sert.</span></div>';
    h += '<div class="mp-kpis">' +
      kpi('Comptes', nombre(total), rl || '&nbsp;', 'var(--ip-blue)') +
      kpi('Bloqués', nombre(c.bloques), 'Comptes dont l’accès est coupé.', 'var(--c-rose)') +
      kpi('Double authentification', nombre(c.double_auth) + ' / ' + nombre(total), 'Comptes qui l’ont activée.', 'var(--c-mint)') +
      kpi('Connectés ce mois-ci', nombre(c.connectes_30j), 'Connexion dans les 30 derniers jours.', 'var(--c-froid)') + '</div>';
    var ina = (etat && etat.inactifs) || [];
    h += '<div class="mp-sh sc-sh2"><h3 class="sc-h3">Comptes ouverts mais inutilisés depuis 90 jours</h3></div><div class="mp-card sc-ina">';
    if (!ina.length) h += '<div class="mp-vide">Aucun compte inutilisé.</div>';
    ina.forEach(function (a) {
      h += '<div class="sc-row sc-in"><span class="sc-tx"><b>' + esc(a.nom) + '</b></span><span class="sc-val"><b>' +
        (a.derniere_connexion ? esc(dateLongue(a.derniere_connexion)) : 'jamais connecté') + '</b><small>dernière connexion</small></span></div>';
    });
    return h + '</div><p class="mp-note">À bloquer si la personne n’en a plus besoin.</p></section>';
  }

  function plan() {
    var l = (etat && etat.plan) || [];
    var h = '<section class="mp-sec" data-sc="plan"><div class="mp-sh"><h2>Le plan d’action</h2><span>Où en est chaque point.</span></div><div class="mp-card">';
    if (!l.length) h += '<div class="mp-vide">Plan vide.</div>';
    l.forEach(function (p) {
      h += '<div class="sc-row sc-pl" data-num="' + esc(p.num) + '"><span class="sc-num">' + esc(p.num) + '</span>' +
        '<span class="sc-tx"><b>' + esc(p.titre) + '</b><span>' + esc(p.detail) + '</span></span>' +
        '<span class="sc-st">' + pastille(p.statut) + (p.date_maj ? '<small>' + esc(dateCourte(p.date_maj)) + '</small>' : '') + '</span></div>';
    });
    return h + '</div></section>';
  }

  function dessiner(root) {
    var y = window.pageYOffset || 0;
    root.innerHTML = top() + '<div class="v2-wrap mp-wrap" data-sc-page="1">' + enTete() + verdict() + attente() + controles() + base() + comptes() + plan() + '</div>';
    racine = root;
    try { if (V2.motion && V2.motion.pass) V2.motion.pass(); } catch (e) {}
    try { window.scrollTo(0, y); } catch (e) {}
  }

  function brancher() {
    if (ecouteurs) return; ecouteurs = true;
    document.addEventListener('click', function (e) {
      if (!enRoute()) return;
      var b = e.target.closest ? e.target.closest('[data-sc-act]') : null; if (!b) return;
      var a = b.getAttribute('data-sc-act');
      if (a === 'relire') { etat = null; etatErreur = false; if (racine) chargement(racine); charger(); }
      else if (a === 'reessayer') { accesEchec = false; etat = null; etatErreur = false; V2.render(); }
    });
  }

  V2.pages = V2.pages || {};
  V2.pages.securite = {
    needs: [],     // aucune donnée du catalogue : seul l'état de sécurité est lu, et seulement après le oui de la base
    render: function (root) {
      css(); racine = root; brancher();
      if (acces === null) {
        if (accesEchec) {
          message(root, 'Connexion impossible pour l’instant', 'L’écran n’a pas pu vérifier ton accès. Réessaie dans un instant.',
            '<button class="v2-btn v2-btn-primary" data-sc-act="reessayer">Réessayer</button>');
          return;
        }
        chargement(root);
        verifier().then(function () {
          if (acces === null) accesEchec = true;
          if (!enRoute()) return;
          V2.render();
        });
        return;
      }
      if (acces === false) { message(root, 'Écran réservé.', ''); return; }
      if (!etat) {
        if (etatErreur && !enCours) {
          message(root, 'Lecture impossible pour l’instant', 'La base n’a pas répondu. Réessaie dans un instant.',
            '<button class="v2-btn v2-btn-primary" data-sc-act="reessayer">Réessayer</button>');
          return;
        }
        chargement(root);
        charger();
        return;
      }
      dessiner(root);
    }
  };

  V2.securite = {
    acces: function () { return acces; }, verifier: verifier,
    // La ligne du menu du compte : posée seulement si la base dit oui.
    menu: function (m) {
      verifier().then(function (ok) {
        if (!ok || !m || !m.parentNode || m.querySelector('.sc-um')) return;
        var b = document.createElement('button');
        b.className = 'v2-um-item sc-um';
        b.innerHTML = ICO('check', 16, 2) + 'Sécurité';
        b.onclick = function () { if (m.parentNode && m.classList.contains('v2-usermenu')) m.parentNode.removeChild(m); V2.go('securite'); };
        var ref = m.querySelector('.ls-um') || m.querySelector('.mp-um');
        if (ref) { if (ref.nextSibling) ref.parentNode.insertBefore(b, ref.nextSibling); else ref.parentNode.appendChild(b); }
        else { var prem = m.querySelector('.v2-um-item'); if (prem) m.insertBefore(b, prem); else m.appendChild(b); }
      });
    }
  };

  // ── Habillage : celui de « Listing produits 2027 » (mp-*) + quelques pièces propres ──
  function css() {
    if (V2.margeproduits && V2.margeproduits.css) V2.margeproduits.css();
    if (document.getElementById('sc-css')) return;
    var s = document.createElement('style'); s.id = 'sc-css';
    s.textContent = [
      '.sc-um svg{color:var(--c-froid)}',
      '.sc-relire{min-height:48px;padding:0 22px}',
      '.sc-verdict{display:flex;gap:16px;align-items:flex-start;padding:20px 22px;border-left:4px solid var(--c-froid);background:radial-gradient(120% 140% at 0% 0%,color-mix(in srgb,var(--c-froid) 11%,#fff),#fff 60%)}',
      '.sc-verdict.att{border-left-color:var(--c-amber);background:radial-gradient(120% 140% at 0% 0%,color-mix(in srgb,var(--c-amber) 12%,#fff),#fff 60%)}',
      '.sc-vi{flex:none;width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#0A6C86;background:color-mix(in srgb,var(--c-froid) 14%,#fff);box-shadow:0 0 0 1px color-mix(in srgb,var(--c-froid) 28%,transparent) inset}',
      '.sc-verdict.att .sc-vi{color:var(--c-amber-txt);background:color-mix(in srgb,var(--c-amber) 15%,#fff);box-shadow:0 0 0 1px color-mix(in srgb,var(--c-amber) 28%,transparent) inset}',
      '.sc-vt{min-width:0}.sc-v1{font-size:26px;font-weight:800;letter-spacing:-.03em;line-height:1.15;margin:0}',
      '.sc-pts{margin:12px 0 0;padding-left:20px;font-size:14.5px;line-height:1.55;color:var(--ip-ink-2)}',
      '.sc-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,260px) 130px;align-items:center;gap:16px;padding:14px 22px;border-bottom:1px solid var(--line-2);font-size:14px}',
      '.sc-row:last-child{border-bottom:0}',
      '.sc-att,.sc-pl{grid-template-columns:30px minmax(0,1fr) 150px}',
      '.sc-run,.sc-in{grid-template-columns:minmax(0,1fr) 150px}',
      '.sc-in{grid-template-columns:minmax(0,1fr) minmax(0,220px)}',
      '.sc-num{font-family:var(--mono);font-weight:800;font-size:14px;color:var(--muted)}',
      '.sc-tx{min-width:0;display:flex;flex-direction:column;gap:3px}',
      '.sc-tx b{font-weight:700;overflow-wrap:anywhere}',
      '.sc-tx span,.sc-dt{font-size:13px;line-height:1.5;color:var(--muted);overflow-wrap:anywhere}',
      '.sc-val{display:flex;flex-direction:column;gap:2px;text-align:right;min-width:0}',
      '.sc-val b{font-family:var(--mono);font-weight:700;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
      '.sc-val small,.sc-st small{font-size:12px;color:var(--muted)}',
      '.sc-st{display:flex;flex-direction:column;align-items:flex-end;gap:4px}',
      '.v2-chip.n.sc-n{background:var(--surf-sunken);color:var(--ip-ink-2);box-shadow:0 0 0 1px var(--line-strong) inset}',
      '.sc-bt{display:flex;flex-direction:column;gap:3px;padding:16px 22px 6px;border-top:1px solid var(--line)}',
      '.sc-bt b{font-weight:700;font-size:14px}.sc-bt span{font-size:13px;color:var(--muted)}',
      '.sc-bars{display:grid;gap:8px;padding:8px 22px 18px}',
      '.sc-bar{display:grid;grid-template-columns:110px minmax(0,1fr) 92px;align-items:center;gap:12px;font-size:13px}',
      '.sc-bq{color:var(--muted);font-weight:600}',
      '.sc-bv{font-family:var(--mono);text-align:right;font-variant-numeric:tabular-nums}',
      '.sc-bar.lent .sc-bv{color:var(--c-amber-txt)}',
      '.sc-vide{padding:14px 22px 20px}.sc-calme{font-weight:600}',
      '.sc-sh2{margin-top:26px}.sc-h3{font-size:17px;font-weight:800;letter-spacing:-.02em;margin:0}',
      '@media(max-width:720px){',
      '.sc-v1{font-size:22px}.sc-verdict{padding:16px 16px}',
      '.sc-row{grid-template-columns:minmax(0,1fr) auto;padding:13px 16px;gap:8px 12px}',
      '.sc-row .sc-tx{grid-column:1/-1}',
      '.sc-row .sc-val{text-align:left;grid-column:1}',
      '.sc-row .sc-st{align-items:flex-end;grid-column:2}',
      '.sc-att,.sc-pl{grid-template-columns:24px minmax(0,1fr)}',
      '.sc-att .sc-num,.sc-pl .sc-num{grid-row:1/3}.sc-att .sc-tx,.sc-pl .sc-tx{grid-column:2}',
      '.sc-att .sc-st,.sc-pl .sc-st{grid-column:2;align-items:flex-start;flex-direction:row;gap:10px}',
      '.sc-in .sc-val{grid-column:1/-1}',
      '.sc-bar{grid-template-columns:84px minmax(0,1fr) 78px;gap:8px}',
      '.sc-bt,.sc-bars{padding-left:16px;padding-right:16px}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
