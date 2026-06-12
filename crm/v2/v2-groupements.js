/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Groupements" (pages.groupements)
   Intègre l'app de prospection groupements & pharmacies (carte Leaflet,
   autonome) créée à part, affichée en plein écran via iframe.
   Fichier : groupements.html (même dossier crm/v2/).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};

  if (!document.getElementById('v2-grp-css')) {
    var st = document.createElement('style'); st.id = 'v2-grp-css';
    st.textContent =
      '.grp-frame{width:100%;height:calc(100vh - 62px);border:0;display:block;background:#fff}' +
      '.grp-bar{display:flex;align-items:center;gap:10px;padding:8px 26px;background:var(--card);border-bottom:1px solid var(--line);font-size:12.5px;color:var(--muted)}' +
      '.grp-bar a{color:var(--ip-blue);font-weight:600;text-decoration:none}';
    document.head.appendChild(st);
  }

  V2.pages.groupements = {
    render: function (root) {
      root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
        '<div class="grp-bar">' + ICO('grid', 15, 2) +
          '<span>Prospection groupements &amp; pharmacies</span>' +
          '<a href="groupements.html" target="_blank" rel="noopener" style="margin-left:auto">Ouvrir en plein écran ↗</a>' +
        '</div>' +
        '<iframe class="grp-frame" src="groupements.html?v=20260612a" title="Prospection groupements"></iframe>';
    }
  };
})();
