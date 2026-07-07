/* CRM V2 · Sous-module "Rétroplanning LinkedIn" (pages.marketing?linkedin)
   100% client-side. Supabase (V2.sb) primaire, repli localStorage. */
(function () {
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  function sb() { return (V2.sb && V2.sb()) || null; }

  // ── État de vue ──
  var view = 'cal';                 // 'cal' | 'list'
  var calRef = new Date();          // mois affiché (1er du mois)
  calRef.setDate(1);

  // ── Piliers éditoriaux (modifiable) ──
  var PILLARS = [
    { k: 'produit',     label: 'Produit',              color: '#0057FF' },
    { k: 'conseil',     label: 'Conseil officine',     color: '#00B37A' },
    { k: 'coulisses',   label: 'Coulisses / logistique', color: '#FFB020' },
    { k: 'recrutement', label: 'Recrutement',          color: '#FF4D6D' },
    { k: 'tempsfort',   label: 'Temps fort',           color: '#8B5CF6' }
  ];
  function pillar(k) { for (var i = 0; i < PILLARS.length; i++) if (PILLARS[i].k === k) return PILLARS[i]; return PILLARS[0]; }

  // ── Statuts ──
  var STATUSES = [
    { k: 'idee',      label: 'Idée',        icon: '💡' },
    { k: 'redaction', label: 'En rédaction', icon: '✍️' },
    { k: 'pret',      label: 'Prêt',        icon: '✅' },
    { k: 'publie',    label: 'Publié',      icon: '📢' }
  ];
  function statusOf(k) { for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].k === k) return STATUSES[i]; return STATUSES[0]; }

  // ── Rendu (placeholder pour la Task 1) ──
  function render(root) {
    root.innerHTML =
      (V2.topbar ? V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) : '') +
      '<div class="li-wrap"><h1 class="li-h1">Rétroplanning LinkedIn</h1>' +
      '<p class="li-empty">Module en cours de construction.</p></div>';
  }

  V2.mktLinkedin = { render: render, PILLARS: PILLARS, STATUSES: STATUSES, pillar: pillar, statusOf: statusOf };
  V2.li = V2.li || {};
})();
