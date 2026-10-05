/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Prochain rendez-vous, sur la fiche officine (V2.rdvPrepa)
   05/10/2026 — remontée de Matthieu : « sur chaque officine un espace RDV :
   préparer ses RDV en notant les points à aborder, puis noter son compte rendu ».
   AVANT : une liste de points à aborder, cochés au fil de la visite.
   APRÈS : le compte rendu, rangé dans les notes de l'officine avec les points
   cochés ; les points non cochés restent pour la fois suivante.
   Aucune table nouvelle : les points vivent dans la fiche partagée de l'officine
   (V2.profil, champ `rdv_points`), le compte rendu est une note (V2.notes.addAuto).
   API : V2.rdvPrepa.section(pid) → HTML, puis V2.rdvPrepa.hydrate().
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var CLE = 'rdv_points', MAX_NOTE = 4000;
  var _pts = {};        // pid → points chargés [{ t, ok }]
  var _brouillon = {};  // pid → compte rendu en cours de saisie (survit à un nouveau rendu de la fiche)

  function pret() { return !!(V2.profil && V2.profil.charger && V2.profil.poser && V2.notes && V2.notes.addAuto); }
  function ecrire(pid) { return V2.profil.poser('client', pid, CLE, _pts[pid].length ? _pts[pid] : null); }
  function boite(el) { return el.closest('.v2-rp-box'); }
  function pidDe(el) { var b = boite(el); return b ? b.getAttribute('data-pid') : ''; }

  function listeHtml(pid) {
    var pts = _pts[pid] || [];
    if (!pts.length) return '<div class="v2-notes-empty">Aucun point noté pour l\'instant.</div>';
    return pts.map(function (p, i) {
      return '<div class="v2-rp-pt' + (p.ok ? ' ok' : '') + '">' +
        '<label><input type="checkbox"' + (p.ok ? ' checked' : '') + ' onchange="V2.rdvPrepa.cocher(this,' + i + ')"><span>' + esc(p.t) + '</span></label>' +
        '<button type="button" class="v2-note-x" onclick="V2.rdvPrepa.retirer(this,' + i + ')" title="Retirer ce point" aria-label="Retirer ce point">&times;</button>' +
      '</div>';
    }).join('');
  }
  function dessiner(box) {
    var pid = box.getAttribute('data-pid'), l = box.querySelector('.v2-rp-list');
    if (l) l.innerHTML = listeHtml(pid);
  }
  // Un échec d'enregistrement se dit : on ne laisse pas croire qu'un point est gardé.
  function garder(box, avant) {
    var pid = box.getAttribute('data-pid');
    dessiner(box);
    return ecrire(pid).catch(function () {
      _pts[pid] = avant; dessiner(box);
      if (V2.toast) V2.toast('Point non enregistré — réessayez', 'error');
    });
  }

  V2.rdvPrepa = {
    section: function (pid) {
      if (!pret()) return '';
      ensureCss();
      pid = String(pid);
      return '<div class="v2-rp-box v2-notes-box v2-card" data-pid="' + esc(pid) + '">' +
          '<div class="v2-notes-hd">' + (V2.ICO ? V2.ICO('cal', 16, 2) : '') + '<span>Prochain rendez-vous</span></div>' +
          '<div class="v2-rp-l">Points à aborder</div>' +
          '<div class="v2-rp-list"><div class="v2-notes-empty">Chargement…</div></div>' +
          '<div class="v2-notes-add">' +
            '<input type="text" class="v2-notes-ta v2-rp-in" maxlength="300" placeholder="Ajouter un point à aborder…" aria-label="Ajouter un point à aborder" onkeydown="if(event.key===\'Enter\'){event.preventDefault();V2.rdvPrepa.ajouter(this)}">' +
            '<button type="button" class="v2-btn v2-btn-ghost v2-notes-btn" onclick="V2.rdvPrepa.ajouter(this)">Ajouter</button>' +
          '</div>' +
          '<div class="v2-rp-l v2-rp-l2">Compte rendu</div>' +
          '<textarea class="v2-notes-ta v2-rp-cr" rows="3" placeholder="Après le rendez-vous : ce qui a été dit, la suite à donner…" aria-label="Compte rendu du rendez-vous" oninput="V2.rdvPrepa.saisir(this)">' + esc(_brouillon[pid] || '') + '</textarea>' +
          '<div class="v2-rp-pied">' +
            '<span class="v2-rp-aide">Les points cochés sont rangés avec le compte rendu dans les notes ; les autres restent pour la fois suivante.</span>' +
            '<button type="button" class="v2-btn v2-btn-primary v2-rp-ok" onclick="V2.rdvPrepa.enregistrer(this)">Enregistrer le compte rendu</button>' +
          '</div>' +
        '</div>';
    },

    hydrate: function () {
      var boxes = document.querySelectorAll('.v2-rp-box:not([data-done])');
      Array.prototype.forEach.call(boxes, function (box) {
        box.setAttribute('data-done', '1');
        var pid = box.getAttribute('data-pid');
        V2.profil.charger('client', pid).then(function (d) {
          _pts[pid] = (Array.isArray(d[CLE]) ? d[CLE] : []).filter(function (p) { return p && p.t; }).map(function (p) { return { t: String(p.t), ok: !!p.ok }; });
          dessiner(box);
        }).catch(function () {
          // Liste illisible : on n'affiche pas une liste vide, un ajout écraserait les points déjà notés.
          var l = box.querySelector('.v2-rp-list'); if (l && !_pts[pid]) l.innerHTML = '<div class="v2-notes-empty">Points indisponibles pour l\'instant.</div>'; else dessiner(box);
        });
      });
    },

    saisir: function (ta) { _brouillon[pidDe(ta)] = ta.value; },

    ajouter: function (el) {
      var box = boite(el); if (!box) return;
      var pid = box.getAttribute('data-pid'), inp = box.querySelector('.v2-rp-in');
      var t = (inp && inp.value || '').replace(/\s+/g, ' ').trim();
      if (!_pts[pid]) { if (V2.toast) V2.toast('Points indisponibles pour l\'instant — réessayez', 'error'); return; }
      if (!t) { if (inp) inp.focus(); return; }
      var avant = _pts[pid].slice();
      _pts[pid] = avant.concat([{ t: t, ok: false }]);
      inp.value = ''; inp.focus();
      garder(box, avant);
    },

    cocher: function (el, i) {
      var box = boite(el); if (!box) return;
      var pid = box.getAttribute('data-pid'); if (!_pts[pid] || !_pts[pid][i]) return;
      var avant = _pts[pid].map(function (p) { return { t: p.t, ok: p.ok }; });
      _pts[pid][i].ok = !!el.checked;
      garder(box, avant);
    },

    retirer: function (el, i) {
      var box = boite(el); if (!box) return;
      var pid = box.getAttribute('data-pid'); if (!_pts[pid] || !_pts[pid][i]) return;
      var avant = _pts[pid].slice();
      _pts[pid] = avant.filter(function (p, k) { return k !== i; });
      garder(box, avant);
    },

    // Le compte rendu part dans les notes de l'officine (daté, signé, modifiable comme toute note),
    // avec les points cochés. Les points ne sont retirés de la liste qu'une fois la note enregistrée.
    enregistrer: function (btn) {
      var box = boite(btn); if (!box) return;
      var pid = box.getAttribute('data-pid'), ta = box.querySelector('.v2-rp-cr');
      var cr = (ta && ta.value || '').trim(), pts = _pts[pid] || [];
      var faits = pts.filter(function (p) { return p.ok; });
      if (!cr && !faits.length) { if (V2.toast) V2.toast('Écrivez le compte rendu ou cochez les points abordés'); if (ta) ta.focus(); return; }
      var body = 'Compte rendu de rendez-vous' +
        (faits.length ? '\nPoints abordés :\n' + faits.map(function (p) { return '• ' + p.t; }).join('\n') : '') +
        (cr ? '\n' + cr : '');
      if (body.length > MAX_NOTE) { if (V2.toast) V2.toast('Compte rendu trop long (' + body.length + ' caractères, ' + MAX_NOTE + ' au plus)', 'error'); return; }
      btn.disabled = true; btn.textContent = 'Enregistrement…';
      var fin = function () { btn.disabled = false; btn.textContent = 'Enregistrer le compte rendu'; };
      V2.notes.addAuto('client', pid, body).then(function (ok) {
        fin();
        if (!ok) { if (V2.toast) V2.toast('Compte rendu non enregistré — réessayez', 'error'); return; }
        if (ta) ta.value = ''; delete _brouillon[pid];
        // Seuls les points rangés dans la note partent : un point ajouté ou coché pendant l'enregistrement reste.
        var avant = (_pts[pid] || []).slice();
        _pts[pid] = avant.filter(function (p) { return faits.indexOf(p) < 0; });
        garder(box, avant);
        if (V2.toast) V2.toast('Compte rendu rangé dans les notes de l\'officine');
      }, function () { fin(); if (V2.toast) V2.toast('Compte rendu non enregistré — réessayez', 'error'); });
    }
  };

  function ensureCss() {
    if (document.getElementById('v2-rp-css')) return;
    var s = document.createElement('style'); s.id = 'v2-rp-css';
    s.textContent = [
      '.v2-rp-l{font-size:12px;font-weight:700;color:var(--muted);margin:0 0 8px}',
      '.v2-rp-l2{margin-top:18px}',
      '.v2-rp-list{display:flex;flex-direction:column;gap:6px}',
      '.v2-rp-pt{display:flex;align-items:center;gap:8px;background:var(--card-2);border:1px solid var(--line);border-radius:12px;padding:4px 6px 4px 12px}',
      '.v2-rp-pt label{flex:1;min-width:0;display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;font-size:13.5px;line-height:1.4;color:var(--ip-ink)}',
      '.v2-rp-pt input{flex:none;width:18px;height:18px;accent-color:var(--ip-blue)}',
      '.v2-rp-pt.ok span{text-decoration:line-through;color:var(--muted)}',
      '.v2-rp-pt .v2-note-x{flex:none;margin-left:0;width:44px;height:44px}',
      '.v2-rp-in{min-height:44px;resize:none}',
      '.v2-rp-cr{display:block;width:100%}',
      '.v2-rp-pied{display:flex;align-items:center;gap:12px;margin-top:10px}',
      '.v2-rp-aide{flex:1;min-width:0;font-size:12px;line-height:1.4;color:var(--muted)}',
      '.v2-rp-ok{flex:none;white-space:nowrap}',
      '@media(max-width:560px){.v2-rp-pied{flex-direction:column;align-items:stretch}}'
    ].join('');
    document.head.appendChild(s);
  }
})();
