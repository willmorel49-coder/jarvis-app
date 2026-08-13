/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Les vingt directions du nouveau site (V2.maquettes)

   Chacun ouvre les maquettes en vrai — pas une capture, la page qui
   défile et qui répond — et lui met une note sur 10. La moyenne se
   partage via Supabase (table `maquette_notes`, une ligne par personne
   et par maquette) avec REPLI localStorage : si la table n'existe pas
   ou si on n'est pas connecté, la note reste sur l'appareil et rien ne
   casse.

   Les pages elles-mêmes vivent dans site-integral/propositions/nouvelles/,
   servies par GitHub Pages comme le reste de l'app — même origine, donc
   l'iframe fonctionne sans bricolage.

   Outil INTERNE. Les maquettes ne portent aucune condition commerciale :
   c'est vérifié à la génération (tools/verifier.py) et au contrôle avant
   publication, pas ici.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return V2.ICO ? V2.ICO(n, s, w) : ''; };

  var TABLE = 'maquette_notes', LS = 'jarvis_maquette_notes_v1';
  var BASE = '../../site-integral/propositions/nouvelles/';
  var backend = 'local';
  var notes = [];            // toutes les notes, tous auteurs confondus
  var tri = 'note';          // 'note' | 'numero'
  var charge = false;

  function sb() { return (V2.sb && V2.sb()) || null; }
  function liste() { return window.MAQUETTES_SITE || []; }
  function moi() { return (V2.user && V2.user.id) || null; }

  function localAll() {
    try { var a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function localWrite(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }

  // ── Chargement ────────────────────────────────────────────────────
  // ⚠️ `charge` ne passe à true QUE si la lecture partagée a réussi. Sinon on
  // réessaie au prochain affichage : sans ça, un seul échec au démarrage
  // (réseau, session pas encore prête) enfermait tout le monde en mode
  // « sur cet appareil » pour le reste de la session, sans le savoir.
  function charger() {
    var c = sb();
    if (c) {
      // `archive = false` : une note retirée sort des moyennes mais reste en
      // base. Sur cette app on regarde, on ne supprime pas — une ligne effacée
      // par erreur ne se rattrape pas.
      return c.from(TABLE).select('*').eq('archive', false)
        .then(function (r) {
          if (!r.error && r.data) {
            backend = 'supabase';
            notes = r.data.map(function (x) {
              return { maquette: x.maquette, auteur: x.auteur_id, nom: x.auteur_nom || '', note: x.note, avis: x.avis || '' };
            });
            charge = true;
            remonterLesLocales();
          } else { backend = 'local'; notes = localAll(); }
          return notes;
        })
        .catch(function () { backend = 'local'; notes = localAll(); return notes; });
    }
    backend = 'local'; notes = localAll();
    return Promise.resolve(notes);
  }

  // Les notes mises hors connexion ne doivent pas rester orphelines : dès que
  // le partage répond, on les remonte une fois, puis on vide le stock local.
  function remonterLesLocales() {
    var a = localAll(), c = sb(), u = moi();
    if (!a.length || !c || !u) return;
    var lot = a.map(function (x) {
      return { maquette: x.maquette, auteur_id: u, auteur_nom: (V2.user && V2.user.name) || '',
               note: x.note, archive: false, maj: new Date().toISOString() };
    });
    c.from(TABLE).upsert(lot, { onConflict: 'maquette,auteur_id' })
      .then(function (r) {
        if (r && r.error) return;            // on garde le local : rien n'est perdu
        localWrite([]);
        if (V2.toast) V2.toast(lot.length + ' note' + (lot.length > 1 ? 's' : '') + ' de cet appareil partagée' + (lot.length > 1 ? 's' : '') + ' avec l\'équipe');
        charger().then(redessiner);
      })
      .catch(function () {});
  }

  // ── Calculs ───────────────────────────────────────────────────────
  function pour(id) {
    var out = [];
    for (var i = 0; i < notes.length; i++) if (notes[i].maquette === id) out.push(notes[i]);
    return out;
  }
  function moyenne(id) {
    var a = pour(id); if (!a.length) return null;
    var s = 0; for (var i = 0; i < a.length; i++) s += a[i].note;
    return s / a.length;
  }
  function maNote(id) {
    var u = moi(), a = pour(id);
    for (var i = 0; i < a.length; i++) {
      // Hors connexion, toutes les notes locales sont les miennes.
      if (backend === 'local' || a[i].auteur === u) return a[i].note;
    }
    return null;
  }
  function triees() {
    var a = liste().slice();
    if (tri === 'numero') return a.sort(function (x, y) { return x.n - y.n; });
    return a.sort(function (x, y) {
      var mx = moyenne(x.id), my = moyenne(y.id);
      // Les non notées passent après les notées, sans se mélanger à elles.
      if (mx == null && my == null) return x.n - y.n;
      if (mx == null) return 1;
      if (my == null) return -1;
      return (my - mx) || (pour(y.id).length - pour(x.id).length) || (x.n - y.n);
    });
  }

  // ── Noter ─────────────────────────────────────────────────────────
  V2.maquetteNoter = function (id, n) {
    n = parseInt(n, 10); if (!(n >= 1 && n <= 10)) return;
    var c = sb(), u = moi();
    if (backend === 'supabase' && c && u) {
      c.from(TABLE).upsert({
        maquette: id, auteur_id: u, auteur_nom: (V2.user && V2.user.name) || '',
        // Reposer une note ré-active la ligne : sans ça, quelqu'un dont la note
        // a été archivée noterait dans le vide, sans jamais le voir.
        note: n, archive: false, maj: new Date().toISOString()
      }, { onConflict: 'maquette,auteur_id' })
        .then(function (r) {
          if (r && r.error) { if (V2.toast) V2.toast('Note non enregistrée — réessaie'); return; }
          if (V2.toast) V2.toast('Noté ' + n + '/10 — partagé avec l\'équipe');
          recharger();
        })
        .catch(function () { if (V2.toast) V2.toast('Note non enregistrée — réessaie'); });
      return;
    }
    // Repli : la note reste sur cet appareil.
    var a = localAll(), vu = false;
    for (var i = 0; i < a.length; i++) if (a[i].maquette === id) { a[i].note = n; vu = true; break; }
    if (!vu) a.push({ maquette: id, auteur: u || 'local', nom: (V2.user && V2.user.name) || '', note: n, avis: '' });
    localWrite(a); notes = a;
    if (V2.toast) V2.toast('Noté ' + n + '/10 — sur cet appareil');
    redessiner();
  };
  V2.maquetteTri = function (t) { tri = t; redessiner(); };

  function recharger() { charger().then(redessiner); }
  function redessiner() {
    // Le plein écran est posé sur le <body>, pas dans la page : le re-rendu de
    // l'écran ne le touche pas. Sans ça, on tape 8 en plein écran et rien ne
    // s'allume — on croit que le clic n'a pas pris.
    var ov = document.getElementById('mq-ov');
    if (ov) {
      var boite = ov.querySelector('.mq-ov-note');
      var id = ov.getAttribute('data-maquette');
      if (boite && id) boite.innerHTML = notesHtml(id, true);
    }
    if (V2.route && V2.route.name === 'marketing' && V2.route.param === 'propositions') V2.render();
  }

  // ── Ouvrir une maquette en grand ──────────────────────────────────
  V2.maquetteOuvrir = function (id) {
    var m = null, l = liste();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) m = l[i];
    if (!m) return;
    var ov = document.createElement('div');
    ov.className = 'mq-ov'; ov.id = 'mq-ov';
    ov.setAttribute('data-maquette', id);
    ov.innerHTML =
      '<div class="mq-ov-bar">' +
        '<button class="mq-ov-x" onclick="V2.maquetteFermer()" aria-label="Fermer">' + ICO('chev', 18, 2) + ' Retour</button>' +
        '<div class="mq-ov-t"><b>' + m.n + ' · ' + esc(m.palette) + '</b><span>' + esc(m.accroche) + ' · ' + esc(m.defile) + '</span></div>' +
        '<a class="mq-ov-out" href="' + BASE + id + '.html" target="_blank" rel="noopener">Plein écran</a>' +
      '</div>' +
      '<iframe class="mq-ov-f" src="' + BASE + id + '.html" title="Maquette ' + m.n + '"></iframe>' +
      '<div class="mq-ov-note">' + notesHtml(id, true) + '</div>';
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () { ov.classList.add('show'); });
  };
  V2.maquetteFermer = function () {
    var ov = document.getElementById('mq-ov'); if (!ov) return;
    document.body.style.overflow = '';
    ov.classList.remove('show');
    setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); redessiner(); }, 200);
  };

  // ── Morceaux d'interface ──────────────────────────────────────────
  function notesHtml(id, compact) {
    var mienne = maNote(id), b = [];
    for (var n = 1; n <= 10; n++) {
      b.push('<button class="mq-n' + (mienne === n ? ' on' : '') + '" ' +
             'onclick="event.stopPropagation();V2.maquetteNoter(\'' + id + '\',' + n + ')" ' +
             'aria-label="Noter ' + n + ' sur 10">' + n + '</button>');
    }
    return '<div class="mq-notes' + (compact ? ' mq-notes-c' : '') + '">' +
             '<span class="mq-notes-l">' + (mienne ? 'Ta note · ' + mienne + '/10' : 'Ta note') + '</span>' +
             '<div class="mq-nrow">' + b.join('') + '</div>' +
           '</div>';
  }

  function badge(id) {
    var m = moyenne(id), k = pour(id).length;
    if (m == null) return '<span class="mq-badge mq-badge-off">pas encore notée</span>';
    var cl = m >= 8 ? 'hi' : (m >= 6 ? 'mid' : 'lo');
    return '<span class="mq-badge mq-badge-' + cl + '"><b>' + (Math.round(m * 10) / 10).toFixed(1) + '</b>/10' +
           '<i>' + k + ' avis</i></span>';
  }

  function carte(m, rang) {
    var med = rang <= 3 && moyenne(m.id) != null ? '<span class="mq-rank mq-rank-' + rang + '">' + rang + '</span>' : '';
    return '<div class="mq-card">' +
      '<button class="mq-shot" onclick="V2.maquetteOuvrir(\'' + m.id + '\')" aria-label="Ouvrir la maquette ' + m.n + '">' +
        med +
        '<img src="' + BASE + 'vignettes/' + m.id + '.jpg" loading="lazy" decoding="async" width="1280" height="960" alt="Aperçu de la maquette ' + m.n + '">' +
        '<span class="mq-open">Ouvrir</span>' +
      '</button>' +
      '<div class="mq-body">' +
        '<div class="mq-head"><b>' + m.n + ' · ' + esc(m.palette) + '</b>' + badge(m.id) + '</div>' +
        '<div class="mq-tags">' +
          '<span>' + esc(m.accroche) + '</span>' +
          '<span>Défilé · ' + esc(m.defile) + '</span>' +
          '<span>Mouvement · ' + esc(m.mouvement) + '</span>' +
          '<span>3D · ' + esc(m.troisd) + '</span>' +
        '</div>' +
        notesHtml(m.id, false) +
      '</div>' +
    '</div>';
  }

  function podium() {
    var a = triees(), top = [];
    for (var i = 0; i < a.length && top.length < 3; i++) if (moyenne(a[i].id) != null) top.push(a[i]);
    if (top.length < 3) return '';   // un classement à deux n'apprend rien
    return '<div class="mq-podium"><div class="mq-podium-t">En tête pour l\'instant</div><div class="mq-podium-r">' +
      top.map(function (m, i) {
        return '<button class="mq-pod" onclick="V2.maquetteOuvrir(\'' + m.id + '\')">' +
          '<span class="mq-rank mq-rank-' + (i + 1) + '">' + (i + 1) + '</span>' +
          '<img src="' + BASE + 'vignettes/' + m.id + '.jpg" loading="lazy" alt="">' +
          '<span class="mq-pod-t"><b>' + m.n + ' · ' + esc(m.palette) + '</b>' +
          '<i>' + (Math.round(moyenne(m.id) * 10) / 10).toFixed(1) + '/10 · ' + pour(m.id).length + ' avis</i></span>' +
        '</button>';
      }).join('') + '</div></div>';
  }

  // ── L'écran ───────────────────────────────────────────────────────
  V2.maquettes = {
    render: function (root) {
      css();
      var l = liste();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '';
      if (!l.length) {
        root.innerHTML = top + '<div class="v2-wrap narrow"><div class="mq-vide">' +
          'La liste des maquettes n\'a pas pu être chargée.</div></div>';
        return;
      }
      function dessiner() {
        var a = triees();
        var partage = backend === 'supabase'
          ? 'Les notes sont partagées : tout le monde voit la même moyenne.'
          : 'Tes notes restent sur cet appareil (connecte-toi pour les partager).';
        root.innerHTML = top +
          '<div class="v2-wrap narrow mq-wrap">' +
            '<div class="mq-hero">' +
              '<div class="v2-page-title">Le nouveau site — ' + l.length + ' directions</div>' +
              '<p>Ouvre-les en vrai : elles défilent et elles répondent, ce ne sont pas des images. ' +
              'Chacune a <b>une</b> accroche, <b>un</b> défilé, <b>un</b> mouvement et <b>un</b> geste 3D — ' +
              'jamais plusieurs empilés. Mets une note sur 10 à celles que tu retiens.</p>' +
              '<span class="mq-share">' + partage + '</span>' +
            '</div>' +
            podium() +
            '<div class="mq-tools">' +
              '<span class="mq-count">' + notees() + ' notée' + (notees() > 1 ? 's' : '') + ' sur ' + l.length + '</span>' +
              '<div class="mq-seg">' +
                '<button class="' + (tri === 'note' ? 'on' : '') + '" onclick="V2.maquetteTri(\'note\')">Les mieux notées</button>' +
                '<button class="' + (tri === 'numero' ? 'on' : '') + '" onclick="V2.maquetteTri(\'numero\')">Dans l\'ordre</button>' +
              '</div>' +
            '</div>' +
            '<div class="mq-grid">' + a.map(function (m, i) { return carte(m, i + 1); }).join('') + '</div>' +
          '</div>';
        if (V2.motion) V2.motion.stagger(root.querySelectorAll('.mq-card'), { step: 35, y: 10 });
      }
      if (charge) dessiner(); else { dessiner(); charger().then(dessiner); }
    }
  };

  function notees() {
    var n = 0, l = liste();
    for (var i = 0; i < l.length; i++) if (moyenne(l[i].id) != null) n++;
    return n;
  }

  // ── Habillage ─────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('mq-css')) return;
    var s = document.createElement('style'); s.id = 'mq-css';
    s.textContent = [
      '.mq-hero{margin:6px 0 18px}',
      '.mq-hero p{color:var(--muted);font-size:14px;line-height:1.55;margin:8px 0 10px;max-width:62ch}',
      '.mq-hero b{color:var(--ip-ink);font-weight:700}',
      '.mq-share{display:inline-block;font-size:12px;color:var(--muted);background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-pill);padding:5px 12px}',
      '.mq-vide{padding:40px 20px;text-align:center;color:var(--muted);background:var(--card-2);border:1px dashed var(--line-strong);border-radius:var(--r-md)}',
      // classement
      '.mq-podium{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:14px 15px;margin-bottom:16px;box-shadow:var(--sh-1)}',
      '.mq-podium-t{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:11px}',
      '.mq-podium-r{display:grid;gap:9px}',
      '@media(min-width:760px){.mq-podium-r{grid-template-columns:repeat(3,1fr)}}',
      '.mq-pod{display:flex;align-items:center;gap:10px;padding:8px;border:1px solid var(--line);background:var(--card-2);border-radius:12px;cursor:pointer;text-align:left;font:inherit;min-height:44px}',
      '.mq-pod img{width:64px;height:48px;object-fit:cover;object-position:top center;border-radius:7px;flex:none;background:var(--line)}',
      '.mq-pod-t{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.mq-pod-t b{font-size:13px;color:var(--ip-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mq-pod-t i{font-style:normal;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.mq-rank{position:absolute;top:8px;left:8px;z-index:2;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;color:#fff;background:var(--ip-ink);box-shadow:0 2px 6px rgba(16,19,28,.3)}',
      '.mq-pod .mq-rank{position:static;flex:none;box-shadow:none}',
      '.mq-rank-1{background:#C7791A}.mq-rank-2{background:#7C8698}.mq-rank-3{background:#9A6B3F}',
      // barre d'outils
      '.mq-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}',
      '.mq-count{font-size:12.5px;color:var(--muted);font-weight:600}',
      '.mq-seg{display:inline-flex;gap:2px;padding:3px;background:var(--card-2);border:1px solid var(--line);border-radius:10px}',
      '.mq-seg button{border:none;background:none;padding:8px 12px;border-radius:7px;font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;min-height:38px}',
      '.mq-seg button.on{background:var(--card);color:var(--ip-ink);box-shadow:var(--sh-1)}',
      // cartes
      '.mq-grid{display:grid;gap:14px}',
      '@media(min-width:820px){.mq-grid{grid-template-columns:1fr 1fr}}',
      '.mq-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden;box-shadow:var(--sh-1)}',
      '.mq-shot{position:relative;display:block;width:100%;padding:0;border:0;border-bottom:1px solid var(--line);background:var(--card-2);cursor:pointer;line-height:0}',
      '.mq-shot img{width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;object-position:top center;display:block}',
      '.mq-open{position:absolute;right:10px;bottom:10px;background:var(--ip-ink);color:#fff;font-size:11.5px;font-weight:700;letter-spacing:.02em;padding:7px 13px;border-radius:var(--r-pill);line-height:1;opacity:.92}',
      '.mq-body{padding:13px 14px 14px}',
      '.mq-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}',
      '.mq-head b{font-size:14px;color:var(--ip-ink);letter-spacing:-.01em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mq-badge{flex:none;display:inline-flex;align-items:baseline;gap:3px;font-size:11px;color:var(--muted);border:1px solid var(--line);background:var(--card-2);border-radius:var(--r-pill);padding:4px 10px}',
      '.mq-badge b{font-size:14px;font-weight:800;font-variant-numeric:tabular-nums}',
      '.mq-badge i{font-style:normal;font-size:10.5px;opacity:.8;margin-left:3px}',
      '.mq-badge-hi{border-color:color-mix(in srgb,var(--c-mint) 45%,var(--line));background:color-mix(in srgb,var(--c-mint) 10%,var(--card))}',
      '.mq-badge-hi b{color:#0F7A52}',
      '.mq-badge-mid b{color:var(--ip-ink)}',
      '.mq-badge-lo{border-color:color-mix(in srgb,var(--c-rose) 35%,var(--line))}',
      '.mq-badge-lo b{color:#C7283D}',
      '.mq-badge-off{font-size:10.5px;letter-spacing:.02em}',
      '.mq-tags{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}',
      '.mq-tags span{font-size:11px;color:var(--muted);background:var(--card-2);border:1px solid var(--line);border-radius:6px;padding:3px 8px}',
      // la note sur 10
      '.mq-notes-l{display:block;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:6px}',
      '.mq-nrow{display:flex;flex-wrap:wrap;gap:5px}',
      // 5 par rangée sur téléphone, 10 en grand : la cible reste ≥ 44 px de haut
      '.mq-n{flex:1 1 calc(20% - 5px);min-width:44px;min-height:44px;border:1px solid var(--line);background:var(--card-2);border-radius:9px;font:inherit;font-size:13.5px;font-weight:700;color:var(--ip-ink);cursor:pointer;font-variant-numeric:tabular-nums;transition:background .14s,border-color .14s,color .14s}',
      '@media(min-width:520px){.mq-n{flex:1 1 calc(10% - 5px)}}',
      '.mq-n:hover{border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.mq-n.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      // plein écran
      '.mq-ov{position:fixed;inset:0;z-index:10001;display:flex;flex-direction:column;background:var(--paper);opacity:0;transition:opacity .2s}',
      '.mq-ov.show{opacity:1}',
      '.mq-ov-bar{flex:none;display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--card);border-bottom:1px solid var(--line)}',
      '.mq-ov-x{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);background:var(--card-2);border-radius:10px;padding:0 12px;min-height:40px;font:inherit;font-size:13px;font-weight:700;color:var(--ip-ink);cursor:pointer}',
      '.mq-ov-x svg{transform:rotate(180deg)}',
      '.mq-ov-t{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}',
      '.mq-ov-t b{font-size:13px;color:var(--ip-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mq-ov-t span{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mq-ov-out{flex:none;font-size:12px;font-weight:700;color:var(--ip-blue);text-decoration:none;padding:0 10px;min-height:40px;display:inline-flex;align-items:center}',
      '.mq-ov-f{flex:1;width:100%;border:0;background:#fff;display:block}',
      '.mq-ov-note{flex:none;padding:11px 13px calc(11px + env(safe-area-inset-bottom));background:var(--card);border-top:1px solid var(--line)}',
      '.mq-notes-c .mq-notes-l{margin-bottom:5px}'
    ].join('');
    document.head.appendChild(s);
  }
})();
