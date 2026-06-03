/* ============================================================
   native-shell.js
   Bottom Tab Bar iOS-native + Sheet "Plus" pour CRM Intégral Pharma.
   - Vanilla JS pur, IIFE self-contained, zéro dépendance.
   - Inspiré Apple Wallet / Health / Mail.
   - Mode "classic" uniquement (masqué automatiquement en mode JARVIS).
   ============================================================ */
(function () {
  'use strict';

  // ----------------------------------------------------------
  // 1. Configuration
  // ----------------------------------------------------------

  // 5 tabs principaux (4 + "Plus")
  const PRIMARY_TABS = [
    { id: 'dashboard',  label: 'Pilotage',   icon: 'chart' },
    { id: 'pharmacies', label: 'Pharmacies', icon: 'pharma' },
    { id: 'benchmark',  label: 'Analyses',   icon: 'trend' },
    { id: 'marketing',  label: 'Marketing',  icon: 'doc' },
    { id: 'more',       label: 'Plus',       icon: 'more' },
  ];

  // Items du sheet "Plus" — regroupés par section
  const SHEET_GROUPS = [
    {
      label: 'Outils',
      items: [
        { id: 'produits',    label: 'Produits',              icon: 'grid',     tint: 'indigo' },
        { id: 'catalogue',   label: 'Catalogue IP',          icon: 'book',     tint: 'blue'   },
        { id: 'simulateur',  label: 'Simulateur panier',     icon: 'calc',     tint: 'green'  },
        { id: 'offilog',     label: 'Offilog — Parapharmacie', icon: 'leaf',   tint: 'orange' },
        { id: 'groupements', label: 'Suivi adhérents',       icon: 'people',   tint: 'purple' },
      ],
    },
  ];

  // Set des pages reconnues par le tab bar (pour syncActiveTab)
  // Quand on est sur une page "secondaire", on highlight "more".
  const PRIMARY_PAGE_IDS = new Set(PRIMARY_TABS.filter(t => t.id !== 'more').map(t => t.id));

  // ----------------------------------------------------------
  // 2. Icônes SVG inline (style SF Symbols, stroke 1.75-2 rounded)
  // ----------------------------------------------------------
  const ICONS = {
    // Tab bar icons (24x24, stroke currentColor)
    chart: '<svg viewBox="0 0 24 24"><rect x="3.5" y="13" width="3.5" height="7.5" rx="1"/><rect x="10.25" y="8.5" width="3.5" height="12" rx="1"/><rect x="17" y="4" width="3.5" height="16.5" rx="1"/></svg>',
    pharma: '<svg viewBox="0 0 24 24"><path d="M4 20.5V8a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v12.5"/><path d="M4 20.5h16"/><path d="M12 20.5V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16.5"/><path d="M15.5 9v4M13.5 11h4"/></svg>',
    trend: '<svg viewBox="0 0 24 24"><path d="M3.5 17 9 11.5l3.5 3.5L20 7"/><path d="M15 7h5v5"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="6" height="6" rx="1.2"/><rect x="14.5" y="3.5" width="6" height="6" rx="1.2"/><rect x="3.5" y="14.5" width="6" height="6" rx="1.2"/><rect x="14.5" y="14.5" width="6" height="6" rx="1.2"/></svg>',
    doc: '<svg viewBox="0 0 24 24"><path d="M5 3.5h8l5 5V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 5 20V4a.5.5 0 0 1 0-.5z"/><path d="M13 3.5V8a.5.5 0 0 0 .5.5H18"/><path d="M8.5 13h7M8.5 16h7M8.5 10h3"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',

    // Sheet item icons (18x18 within 28x28 colored tile, white stroke)
    book:   '<svg viewBox="0 0 24 24"><path d="M5 4.5h11a3 3 0 0 1 3 3v12.5H8a3 3 0 0 1-3-3z"/><path d="M8 20a3 3 0 0 1 0-6h11"/></svg>',
    calc:   '<svg viewBox="0 0 24 24"><rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8 8h8M8 13h2M12 13h2M16 13h.01M8 17h2M12 17h2M16 17h.01"/></svg>',
    leaf:   '<svg viewBox="0 0 24 24"><path d="M20 4c-9 0-15 5-15 12a4 4 0 0 0 4 4c7 0 12-6 12-15z"/><path d="M5 19 13 11"/></svg>',
    people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3 2.5-5.5 6-5.5s6 2.5 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c.6-2.5 2.5-4 4.5-4s2.5 1 2.5 2.5"/></svg>',
    gear:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    spark:  '<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>',
    chevron:'<svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"/></svg>',
  };

  // ----------------------------------------------------------
  // 3. Helpers
  // ----------------------------------------------------------
  function getMode() {
    return document.documentElement.getAttribute('data-mode') || 'classic';
  }

  function isClassicMode() {
    return getMode() === 'classic';
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2), attrs[k]);
        } else if (attrs[k] === false || attrs[k] == null) {
          // skip
        } else {
          node.setAttribute(k, attrs[k] === true ? '' : String(attrs[k]));
        }
      }
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c == null) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  // ----------------------------------------------------------
  // 4. Build Tab Bar
  // ----------------------------------------------------------
  function buildTabBar() {
    const bar = el('nav', {
      class: 'ns-tabbar',
      role: 'tablist',
      'aria-label': 'Navigation principale',
    });

    PRIMARY_TABS.forEach(tab => {
      const btn = el('button', {
        type: 'button',
        class: 'ns-tab',
        role: 'tab',
        'data-tab': tab.id,
        'aria-selected': 'false',
        'aria-label': tab.label,
      }, [
        el('span', { class: 'ns-tab-icon', html: ICONS[tab.icon] || '', 'aria-hidden': 'true' }),
        el('span', { class: 'ns-tab-label' }, tab.label),
      ]);

      btn.addEventListener('click', () => {
        if (tab.id === 'more') {
          openSheet();
        } else {
          closeSheet();
          if (typeof window.navigate === 'function') {
            window.navigate(tab.id);
          }
        }
      });

      bar.appendChild(btn);
    });

    return bar;
  }

  // ----------------------------------------------------------
  // 5. Build Sheet "Plus"
  // ----------------------------------------------------------
  function buildSheet() {
    const root = el('div', {
      class: 'ns-sheet-root',
      role: 'presentation',
      'aria-hidden': 'true',
    });

    const backdrop = el('div', { class: 'ns-sheet-backdrop' });
    backdrop.addEventListener('click', closeSheet);
    root.appendChild(backdrop);

    const sheet = el('div', {
      class: 'ns-sheet',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'ns-sheet-title',
    });

    const handle = el('div', {
      class: 'ns-sheet-handle',
      'aria-label': 'Faire glisser pour fermer',
      role: 'button',
      tabindex: '0',
    });
    sheet.appendChild(handle);

    const title = el('h2', {
      class: 'ns-sheet-title',
      id: 'ns-sheet-title',
    }, 'Plus');
    sheet.appendChild(title);

    SHEET_GROUPS.forEach(group => {
      if (group.label) {
        sheet.appendChild(el('div', { class: 'ns-sheet-group-label' }, group.label));
      }
      const groupEl = el('div', { class: 'ns-sheet-group', role: 'group' });

      group.items.forEach(item => {
        const btn = el('button', {
          type: 'button',
          class: 'ns-sheet-item',
          'data-target': item.id,
        }, [
          el('span', {
            class: 'ns-sheet-item-icon',
            'data-tint': item.tint || 'gray',
            html: ICONS[item.icon] || '',
            'aria-hidden': 'true',
          }),
          el('span', { class: 'ns-sheet-item-label' }, item.label),
          el('span', {
            class: 'ns-sheet-item-chevron',
            html: ICONS.chevron,
            'aria-hidden': 'true',
          }),
        ]);

        btn.addEventListener('click', () => onSheetItemClick(item));
        groupEl.appendChild(btn);
      });

      sheet.appendChild(groupEl);
    });

    root.appendChild(sheet);

    // Swipe-down sur handle
    attachSwipeToClose(handle, sheet);

    // Touch sur le sheet entier pour swipe-down depuis le top
    attachSwipeToClose(sheet, sheet, { thresholdY: 80, onlyFromTop: true });

    return root;
  }

  function onSheetItemClick(item) {
    closeSheet();
    if (typeof window.navigate === 'function') {
      window.navigate(item.id);
    }
  }

  // ----------------------------------------------------------
  // 6. Swipe-down to close (gesture iOS)
  // ----------------------------------------------------------
  function attachSwipeToClose(grip, sheetEl, opts) {
    opts = opts || {};
    const thresholdY = opts.thresholdY || 60;
    let startY = null;
    let startScrollTop = 0;
    let dy = 0;
    let dragging = false;

    function onStart(e) {
      const t = e.touches ? e.touches[0] : e;
      // Si "onlyFromTop", on n'enclenche le drag que si le sheet est scrollé en haut
      if (opts.onlyFromTop && sheetEl.scrollTop > 0) return;
      startY = t.clientY;
      startScrollTop = sheetEl.scrollTop;
      dy = 0;
      dragging = true;
      sheetEl.classList.add('is-dragging');
    }

    function onMove(e) {
      if (!dragging || startY == null) return;
      const t = e.touches ? e.touches[0] : e;
      dy = t.clientY - startY;
      if (dy < 0) dy = 0; // pas de drag vers le haut
      sheetEl.style.transform = `translateY(${dy}px)`;
      if (e.cancelable && dy > 4) e.preventDefault();
    }

    function onEnd() {
      if (!dragging) return;
      dragging = false;
      sheetEl.classList.remove('is-dragging');
      sheetEl.style.transform = '';
      if (dy > thresholdY) {
        closeSheet();
      }
      startY = null;
      dy = 0;
    }

    grip.addEventListener('touchstart', onStart, { passive: true });
    grip.addEventListener('touchmove', onMove, { passive: false });
    grip.addEventListener('touchend', onEnd);
    grip.addEventListener('touchcancel', onEnd);

    // Mouse fallback (desktop) — uniquement pour le handle
    if (grip.classList.contains('ns-sheet-handle')) {
      grip.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
    }
  }

  // ----------------------------------------------------------
  // 7. Open / close sheet
  // ----------------------------------------------------------
  let sheetRoot = null;
  let isSheetOpen = false;

  function openSheet() {
    if (!sheetRoot || isSheetOpen) return;
    isSheetOpen = true;
    sheetRoot.classList.add('is-open');
    sheetRoot.setAttribute('aria-hidden', 'false');
    // ESC pour fermer
    document.addEventListener('keydown', onKeyDown);
  }

  function closeSheet() {
    if (!sheetRoot || !isSheetOpen) return;
    isSheetOpen = false;
    sheetRoot.classList.remove('is-open');
    sheetRoot.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') closeSheet();
  }

  // ----------------------------------------------------------
  // 8. Sync état actif du tab bar avec la page courante
  // ----------------------------------------------------------
  let tabBarEl = null;

  function syncActiveTab(pageId) {
    if (!tabBarEl) return;
    const targetId = PRIMARY_PAGE_IDS.has(pageId) ? pageId : 'more';
    tabBarEl.querySelectorAll('.ns-tab').forEach(btn => {
      const isActive = btn.dataset.tab === targetId;
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  // Wrap window.navigate pour synchroniser à chaque changement de page.
  // Si navigate n'existe pas encore (script chargé avant app.js),
  // on retente au DOMContentLoaded.
  function wrapNavigate() {
    if (typeof window.navigate !== 'function') return false;
    if (window.navigate.__nsWrapped) return true;
    const orig = window.navigate;
    const wrapped = function (page) {
      const r = orig.apply(this, arguments);
      try { syncActiveTab(page); } catch (_) {}
      return r;
    };
    wrapped.__nsWrapped = true;
    window.navigate = wrapped;
    return true;
  }

  // Fallback : observer .nav-item.active si on n'a pas pu wrap
  function observeNavItems() {
    const sidebar = document.querySelector('nav.sidebar');
    if (!sidebar) return;
    const obs = new MutationObserver(() => {
      const active = sidebar.querySelector('.nav-item.active');
      if (active && active.dataset.page) {
        syncActiveTab(active.dataset.page);
      }
    });
    obs.observe(sidebar, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  // ----------------------------------------------------------
  // 9. Gestion du mode (classic / jarvis)
  // ----------------------------------------------------------
  function applyMode() {
    const classic = isClassicMode();
    if (classic) {
      document.body.classList.add('ns-active');
    } else {
      document.body.classList.remove('ns-active');
      closeSheet();
    }
  }

  function observeModeChanges() {
    const obs = new MutationObserver(applyMode);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-mode'],
    });
  }

  // ----------------------------------------------------------
  // 10. Init
  // ----------------------------------------------------------
  function init() {
    // Injection DOM
    tabBarEl = buildTabBar();
    sheetRoot = buildSheet();
    document.body.appendChild(tabBarEl);
    document.body.appendChild(sheetRoot);

    // Mode + observers
    applyMode();
    observeModeChanges();

    // Sync navigate
    const wrapped = wrapNavigate();
    if (!wrapped) {
      // navigate pas encore défini → on retente plusieurs fois
      let tries = 0;
      const iv = setInterval(() => {
        tries++;
        if (wrapNavigate() || tries > 50) clearInterval(iv);
      }, 100);
    }
    observeNavItems();

    // État initial : highlight la page actuellement active
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav && activeNav.dataset.page) {
      syncActiveTab(activeNav.dataset.page);
    } else {
      syncActiveTab('dashboard');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
