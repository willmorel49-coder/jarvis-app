/* ═══════════════════════════════════════════════════════════════════
   APPLE VTABLE — Virtual scrolling vanilla JS (zéro dépendance)
   ─────────────────────────────────────────────────────────────────────
   But : afficher 10 000+ lignes sans saturer le DOM.
   Ne monte dans le DOM que les ~30-50 lignes effectivement visibles
   + un buffer haut/bas pour éviter les flashs au scroll.

   API : window.appleCreateVTable({ ... }) → handle
   Voir bloc Demo en bas du fichier pour usage rapide.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─── Helpers ────────────────────────────────────────────────────
  function readRowHeightFromCSS() {
    var raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--row-h').trim();
    var n = parseFloat(raw);
    return (n && isFinite(n)) ? n : 44;
  }

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─── Factory principale ────────────────────────────────────────
  function createVTable(opts) {
    if (!opts || !opts.container) {
      throw new Error('appleCreateVTable: container requis');
    }
    if (typeof opts.renderRow !== 'function') {
      throw new Error('appleCreateVTable: renderRow (fn) requis');
    }

    var container   = opts.container;
    var items       = Array.isArray(opts.items) ? opts.items : [];
    var renderRow   = opts.renderRow;
    var rowHeightIn = opts.rowHeight != null ? opts.rowHeight : 'auto';
    var bufferRows  = (typeof opts.bufferRows === 'number') ? opts.bufferRows : 10;
    var headerHTML  = (typeof opts.header === 'string') ? opts.header : null;
    var emptyHTML   = (typeof opts.emptyState === 'string') ? opts.emptyState : null;
    var onRowClick  = (typeof opts.onRowClick === 'function') ? opts.onRowClick : null;

    var rowHeight = (rowHeightIn === 'auto') ? readRowHeightFromCSS() : Number(rowHeightIn) || 44;

    // ─── DOM structure ─────────────────────────────────────────────
    var root = document.createElement('div');
    root.className = 'a-vtable';
    root.setAttribute('role', 'grid');
    root.setAttribute('aria-rowcount', String(items.length));

    var headerEl = null;
    if (headerHTML) {
      headerEl = document.createElement('div');
      headerEl.className = 'a-vtable-header';
      headerEl.setAttribute('role', 'row');
      headerEl.innerHTML = headerHTML;
      root.appendChild(headerEl);
    }

    var viewport = document.createElement('div');
    viewport.className = 'a-vtable-viewport';
    viewport.setAttribute('role', 'rowgroup');
    root.appendChild(viewport);

    var spacer = document.createElement('div');
    spacer.className = 'a-vtable-spacer';
    viewport.appendChild(spacer);

    var win = document.createElement('div');
    win.className = 'a-vtable-window';
    spacer.appendChild(win);

    var emptyEl = null;

    // Wipe + mount
    container.innerHTML = '';
    container.appendChild(root);

    // ─── State interne ─────────────────────────────────────────────
    var rafId = 0;
    var lastStart = -1;
    var lastEnd = -1;
    var visibleStart = 0;
    var visibleEnd = 0;
    var destroyed = false;

    function showEmpty() {
      if (emptyEl) return;
      emptyEl = document.createElement('div');
      emptyEl.className = 'a-vtable-empty';
      emptyEl.innerHTML = emptyHTML || 'Aucune donnée';
      // Replace viewport content
      viewport.style.display = 'none';
      root.appendChild(emptyEl);
    }

    function hideEmpty() {
      if (!emptyEl) return;
      emptyEl.remove();
      emptyEl = null;
      viewport.style.display = '';
    }

    function recalcSpacer() {
      spacer.style.height = (items.length * rowHeight) + 'px';
    }

    // ─── Render fenêtre visible ────────────────────────────────────
    function render(force) {
      if (destroyed) return;
      if (!items.length) {
        showEmpty();
        win.innerHTML = '';
        lastStart = lastEnd = -1;
        return;
      }
      hideEmpty();

      var vpHeight = viewport.clientHeight || 0;
      var scrollTop = viewport.scrollTop || 0;

      var start = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferRows);
      var visibleCount = Math.ceil(vpHeight / rowHeight) + bufferRows * 2;
      var end = Math.min(items.length, start + visibleCount);

      visibleStart = start;
      visibleEnd = end;

      if (!force && start === lastStart && end === lastEnd) return;
      lastStart = start;
      lastEnd = end;

      // Build HTML en batch (1 reflow)
      var html = '';
      for (var i = start; i < end; i++) {
        var item = items[i];
        var inner;
        try {
          inner = renderRow(item, i);
        } catch (err) {
          console.error('[vtable] renderRow err idx=' + i, err);
          inner = '<div style="color:#FF3B30">Erreur ligne ' + i + '</div>';
        }
        html += '<div class="a-vtable-row" role="row" '
          + 'data-idx="' + i + '" '
          + 'aria-rowindex="' + (i + 1) + '" '
          + 'tabindex="-1">'
          + inner
          + '</div>';
      }

      win.innerHTML = html;
      win.style.transform = 'translateY(' + (start * rowHeight) + 'px)';
    }

    function scheduleRender(force) {
      if (rafId) return;
      rafId = requestAnimationFrame(function () {
        rafId = 0;
        render(force);
      });
    }

    // ─── Listeners ─────────────────────────────────────────────────
    function onScroll() { scheduleRender(false); }
    viewport.addEventListener('scroll', onScroll, { passive: true });

    // Click delegation
    function onClick(e) {
      if (!onRowClick) return;
      var row = e.target.closest ? e.target.closest('.a-vtable-row') : null;
      if (!row || !win.contains(row)) return;
      var idx = parseInt(row.getAttribute('data-idx'), 10);
      if (isNaN(idx) || idx < 0 || idx >= items.length) return;
      onRowClick(items[idx], idx, e);
    }
    win.addEventListener('click', onClick);

    // ResizeObserver → resize fenêtre / viewport
    var ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(function () { scheduleRender(true); });
      ro.observe(viewport);
    } else {
      window.addEventListener('resize', function () { scheduleRender(true); });
    }

    // MutationObserver → density change (root[data-density])
    var mo = null;
    if (typeof MutationObserver !== 'undefined') {
      mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type === 'attributes' && (m.attributeName === 'data-density' || m.attributeName === 'data-theme')) {
            if (rowHeightIn === 'auto') {
              var newRH = readRowHeightFromCSS();
              if (newRH !== rowHeight) {
                rowHeight = newRH;
                recalcSpacer();
                scheduleRender(true);
              }
            }
            return;
          }
        }
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-density', 'data-theme'] });
    }

    // ─── Boot ──────────────────────────────────────────────────────
    recalcSpacer();
    scheduleRender(true);

    // ─── API publique ──────────────────────────────────────────────
    return {
      update: function (newItems) {
        items = Array.isArray(newItems) ? newItems : [];
        root.setAttribute('aria-rowcount', String(items.length));
        viewport.scrollTop = 0;
        lastStart = lastEnd = -1;
        recalcSpacer();
        scheduleRender(true);
      },
      refresh: function () {
        lastStart = lastEnd = -1;
        scheduleRender(true);
      },
      scrollTo: function (index) {
        if (!items.length) return;
        var i = Math.max(0, Math.min(items.length - 1, index | 0));
        viewport.scrollTop = i * rowHeight;
        scheduleRender(false);
      },
      getVisibleRange: function () {
        return { start: visibleStart, end: visibleEnd };
      },
      getItems: function () { return items; },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        viewport.removeEventListener('scroll', onScroll);
        win.removeEventListener('click', onClick);
        if (ro) { try { ro.disconnect(); } catch (e) {} }
        if (mo) { try { mo.disconnect(); } catch (e) {} }
        if (container.contains(root)) container.removeChild(root);
      },
    };
  }

  // ─── Expose global ─────────────────────────────────────────────
  window.appleCreateVTable = createVTable;

  // Petit helper export pour debug
  window.__appleVTable = { createVTable: createVTable, readRowHeightFromCSS: readRowHeightFromCSS };

  /* ─────────────────────────────────────────────────────────────────
     Demo (à activer manuellement avec window.appleVtableDemo()) :

  window.appleVtableDemo = function () {
    var items = Array.from({length: 10000}, function (_, i) {
      return { id: i, name: 'Produit ' + i, prix: (Math.random() * 100).toFixed(2) };
    });
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:100px;right:20px;width:500px;height:500px;background:#fff;border:1px solid #ccc;border-radius:8px;z-index:9999';
    document.body.appendChild(div);
    return window.appleCreateVTable({
      container: div,
      items: items,
      rowHeight: 44,
      header: '<div style="display:flex;width:100%"><div style="flex:1">Nom</div><div style="width:80px">Prix</div></div>',
      renderRow: function (item, i) {
        return '<div style="display:flex;width:100%">'
          + '<div style="flex:1">' + item.name + '</div>'
          + '<div style="width:80px">' + item.prix + '€</div>'
          + '</div>';
      },
      onRowClick: function (item) { console.log('click', item); },
    });
  };
  ───────────────────────────────────────────────────────────────── */
})();
