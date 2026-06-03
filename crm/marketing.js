/* ═══════════════════════════════════════════════════════════════
   MARKETING — Générateur de fiches commerciales IP
   ═══════════════════════════════════════════════════════════════
   Sélection produits depuis BENCHMARK → fiche PDF "Offre IP"
   PDF via html2pdf.js (CDN) — Persistence localStorage (V1)
   ═══════════════════════════════════════════════════════════════ */

(function () {

  // ── CONTAINER (par défaut #marketing-content, surcharge via mkSetContainer) ─
  // En mode JARVIS, la lens fournit son propre container — voir lens-marketing.js
  let _activeContainer = null;
  function getRoot() {
    return _activeContainer || document.getElementById('marketing-content');
  }
  window.mkSetContainer = function (el) { _activeContainer = el; };
  window.mkClearContainer = function () { _activeContainer = null; };

  // ── DONNÉES ─────────────────────────────────────────────────
  const LS_KEY = 'marketing.sheets.v1';

  // Presets couleurs (fond carte + accent texte + bandeau)
  const COLOR_PRESETS = {
    navy:   { name: 'Marine',   bg: '#DCE5FF', accent: '#1B2A78', headerBg: '#1B2A78', headerFg: '#FFFFFF', priceBg: '#1B2A78', priceFg: '#FFFFFF' },
    sky:    { name: 'Ciel',     bg: '#BFDDE4', accent: '#0E4F66', headerBg: '#0E4F66', headerFg: '#FFFFFF', priceBg: '#BFDDE4', priceFg: '#0E4F66' },
    lilac:  { name: 'Lilas',    bg: '#E0CDED', accent: '#5B2E80', headerBg: '#5B2E80', headerFg: '#FFFFFF', priceBg: '#E0CDED', priceFg: '#5B2E80' },
    mint:   { name: 'Menthe',   bg: '#C8EAD8', accent: '#1F6B45', headerBg: '#1F6B45', headerFg: '#FFFFFF', priceBg: '#C8EAD8', priceFg: '#1F6B45' },
    amber:  { name: 'Ambre',    bg: '#FFE9B8', accent: '#7A4B00', headerBg: '#7A4B00', headerFg: '#FFFFFF', priceBg: '#FFE9B8', priceFg: '#7A4B00' },
    rose:   { name: 'Rose',     bg: '#F5C6C6', accent: '#7C2B3A', headerBg: '#7C2B3A', headerFg: '#FFFFFF', priceBg: '#F5C6C6', priceFg: '#7C2B3A' },
    forest: { name: 'Forêt',    bg: '#BCDABF', accent: '#1C4E2A', headerBg: '#1C4E2A', headerFg: '#FFFFFF', priceBg: '#BCDABF', priceFg: '#1C4E2A' },
  };

  // Thèmes saison — filtres + mois pertinents
  const SEASON_THEMES = [
    { id: 'allergies', name: 'Allergies printemps', months: [3,4,5], emoji: '🌿', color: 'mint',
      filter: b => /CETIRIZIN|LORATADIN|DESLORATADIN|FEXOFEN|EBASTINE|RUPATADINE|BILASTINE|MIZOLAST|AERIUS|TELFAST|XYZALL|WYSTAMM/i.test(b.designation) || b.atc2 === 'R06' || b.atc2 === 'R01' },
    { id: 'solaire', name: 'Solaire & moustiques', months: [5,6,7,8], emoji: '☀️', color: 'amber',
      filter: b => /SOLAIRE|UVA|UVB|SPF|APRES-SOLEIL|COUP DE SOLEIL|MOUSTIQ|REPULSI|INSECT|PIQUR/i.test(b.designation) },
    { id: 'immunite', name: 'Rentrée immunité', months: [9,10], emoji: '🛡️', color: 'sky',
      filter: b => /VITAMINE|MAGNES|PROBIOT|DEFENSE|IMMUNI|ZINC|FER|GINSENG|GUARANA/i.test(b.designation) },
    { id: 'grippe', name: 'Grippe & vaccins hiver', months: [10,11,12], emoji: '💉', color: 'navy',
      filter: b => /VACCIN|GRIPPE|INFLUVAC|VAXIGRIP|EFLUELDA|FLUARIX|OSELTAMIVIR|TAMIFLU|PARACETAM|DOLIPRANE|EFFERALG/i.test(b.designation) },
    { id: 'rhume', name: 'Rhume & toux', months: [10,11,12,1,2], emoji: '🤧', color: 'lilac',
      filter: b => /RHUME|TOUX|RHINO|NASAL|PASTIL|FERVEX|HUMEX|ACTIFED|DOLIRHUME|STREPSIL|DRILL|ANGINEX|FLUIDIFI|EXPECTOR/i.test(b.designation) },
    { id: 'gastro', name: 'Gastro hiver', months: [11,12,1,2], emoji: '🍵', color: 'forest',
      filter: b => /SMECTA|TIORFAN|LOPERAM|IMODIUM|DIOSMECTIT|ULTRA-LEVURE|SACCHAROMYC|VOGAL|MOTILIUM|ANTIDIARR|SRO|ADIARIL/i.test(b.designation) },
  ];

  // Thèmes catégorie — transverses
  const CAT_THEMES = [
    { id: 'biosim',     name: 'Biosimilaires',          emoji: '🧬', color: 'mint',
      filter: b => b.artnature === 'biosimilaire' || b.atc2 === 'L04' || /PELGRAZ|PELMEG|AMGEVITA|HYRIMOZ|HULIO|IDACIO|YUFLYMA|HUKYNDRA|LIBMYRIS|IMRALDI|AMSPARITY|RETACRIT|BINOCRIT|BENEPALI|ERELZI|NEPEXTO|NIVESTIM|ZARZIO|GRASUSTEK|STIMUFEND|STEQEYMA|UZPRUVO|WEZENLA|PYZCHIVA|RANIVISIO|XIMLUCI|BYOOVIZ|MOVYMIA|SONDELBAY|LIVOGIVA|EYDENZELT|PAVBLU|AFQLIR|BEMFOLA|OVALEAP/i.test(b.designation) },
    { id: 'cardio',     name: 'Génériques cardio',      emoji: '❤️', color: 'amber',
      filter: b => ['C09','C10','C07','C08','C03'].includes(b.atc2) },
    { id: 'diabete',    name: 'Génériques diabète',     emoji: '💧', color: 'forest',
      filter: b => b.atc2 === 'A10' && !/WEGOVY|MOUNJARO|OZEMPIC|SAXENDA|TRULICITY|VICTOZA|RYBELSUS/i.test(b.designation) },
    { id: 'glp1',       name: 'GLP-1 (Wegovy, Mounjaro…)', emoji: '⚡', color: 'sky',
      filter: b => /WEGOVY|MOUNJARO|OZEMPIC|SAXENDA|TRULICITY|VICTOZA|RYBELSUS/i.test(b.designation) },
    { id: 'vaccins',    name: 'Vaccins',                emoji: '💉', color: 'navy',
      filter: b => /VACCIN|INFLUVAC|VAXIGRIP|EFLUELDA|GARDASIL|ENGERIX|REPEVAX|BOOSTRIX|INFANRIX|HEXYON|PRIORIX|PREVENAR|NIMENRIX|MENJUGATE|MENVEO|TICOVAC|HAVRIX|AVAXIM|TWINRIX|SHINGRIX|BEXSERO|TRUMENBA|ROTARIX|ROTATEQ|CAPVAXIVE|VAXNEUVANCE|VAXELIS|VARIVAX|VARILRIX|ABRYSVO|BEYFORTUS/i.test(b.designation) },
    { id: 'femme',      name: 'Santé féminine',         emoji: '🌸', color: 'rose',
      filter: b => b.atc2 === 'G03' || /OESTROGEN|PROGESTER|CONTRACEPTI|MENOPAUS|REGLE|MENSTRU|OVULE/i.test(b.designation) },
    { id: 'sildenafil', name: 'Sildénafil / Tadalafil', emoji: '🔵', color: 'lilac',
      filter: b => /SILDENAFIL|TADALAFIL|VARDENAFIL|VIAGRA|CIALIS|LEVITRA/i.test(b.designation) },
    { id: 'top',        name: 'Top rotations IP',       emoji: '🏆', color: 'navy',
      filter: b => b.ip_rank_qty && b.ip_rank_qty <= 50 },
    { id: 'custom',     name: 'Sélection libre',        emoji: '⚙️', color: 'navy',
      filter: () => false },
  ];

  function getThemeById(id) {
    return SEASON_THEMES.find(t => t.id === id) || CAT_THEMES.find(t => t.id === id) || null;
  }

  function getCurrentSeasonTheme() {
    const m = new Date().getMonth() + 1;
    return SEASON_THEMES.find(t => t.months.includes(m)) || SEASON_THEMES[0];
  }

  // ── PERSISTENCE (localStorage V1, Supabase plus tard) ───────
  function loadSheets() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
  }

  function saveSheets(sheets) {
    localStorage.setItem(LS_KEY, JSON.stringify(sheets));
  }

  function upsertSheet(sheet) {
    const sheets = loadSheets();
    const idx = sheets.findIndex(s => s.id === sheet.id);
    sheet.updated_at = new Date().toISOString();
    if (idx >= 0) sheets[idx] = sheet;
    else { sheet.created_at = sheet.updated_at; sheets.unshift(sheet); }
    saveSheets(sheets);
    return sheet;
  }

  function deleteSheet(id) {
    saveSheets(loadSheets().filter(s => s.id !== id));
  }

  function newSheet(themeId) {
    const t = getThemeById(themeId) || getThemeById('custom');
    return {
      id: 'mk_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      title: t.id === 'custom' ? 'Nouvelle fiche' : t.name,
      theme: t.id,
      color: t.color,
      footer: 'Tarif en vigueur ' + new Date().getFullYear(),
      products: themeProducts(t).slice(0, 12).map(snapshotProduct),
    };
  }

  // ── FILTRES PRODUITS ────────────────────────────────────────
  function themeProducts(theme) {
    if (!window.BENCHMARK) return [];
    if (theme.id === 'top') {
      return [...window.BENCHMARK]
        .filter(theme.filter)
        .sort((a,b) => (a.ip_rank_qty||999) - (b.ip_rank_qty||999));
    }
    return window.BENCHMARK
      .filter(b => b.prix_ip > 0)
      .filter(theme.filter)
      .sort((a,b) => (b.ip_qty||0) - (a.ip_qty||0));
  }

  function snapshotProduct(b) {
    return {
      cip13: b.cip13 || '',
      designation: b.designation || '',
      conditionnement: extractConditionnement(b.designation || ''),
      prix_ht: Number(b.prix_ht || 0),
      prix_ip: Number(b.prix_ip || 0),
      offre_ip: Number(b.offre_ip || 0),
      remise_pct: Number(b.remise_pct || 0),
    };
  }

  // Extrait le conditionnement (BT8, CPR BT30, FL 1, etc.) si présent
  function extractConditionnement(designation) {
    const m = designation.match(/(CPR|GELU|CAPS|SACH|FL|FP|FV|TB|BT|BUV|INJ|SRG|SIR|LYOT|POM|CR|GTT|SOL|SPR|AMP|FCT)[^,]*$/i);
    return m ? m[0].trim() : '';
  }

  function searchProducts(q) {
    if (!window.BENCHMARK || !q) return [];
    const needle = q.toLowerCase().trim();
    return window.BENCHMARK
      .filter(b => b.prix_ip > 0)
      .filter(b => b.designation.toLowerCase().includes(needle) || (b.cip13||'').includes(needle))
      .slice(0, 30);
  }

  // ── FORMATTERS ──────────────────────────────────────────────
  function eur(n) {
    if (!n || isNaN(n)) return '—';
    return Number(n).toFixed(2).replace('.', ',') + ' €';
  }

  function cipFormat(c) {
    if (!c) return '';
    const s = String(c);
    if (s.length === 13) return s.slice(0,4) + ' ' + s.slice(4,7) + ' ' + s.slice(7,10) + ' ' + s.slice(10);
    return s;
  }

  // ── RENDU ÉCRANS ────────────────────────────────────────────
  let editingSheet = null;
  let editTab = 'season';    // 'season' | 'cat' | 'custom'
  let productSearch = '';

  window.renderMarketing = function () {
    const root = getRoot();
    if (!root) return;
    const sheets = loadSheets();
    const suggested = getCurrentSeasonTheme();

    root.innerHTML = `
      <div class="mk-wrap">
        <div class="mk-hero">
          <div class="mk-hero-left">
            <div class="mk-hero-emoji">${suggested.emoji}</div>
            <div>
              <div class="mk-hero-eyebrow">Suggestion du mois</div>
              <div class="mk-hero-title">${suggested.name}</div>
              <div class="mk-hero-sub">${themeProducts(suggested).length} produits IP pertinents · prêt à éditer</div>
            </div>
          </div>
          <button class="mk-btn mk-btn-primary" onclick="window.mkStartEdit('${suggested.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Créer cette fiche
          </button>
        </div>

        <div class="mk-section">
          <div class="mk-section-head">
            <div class="mk-section-title">Démarrer depuis un thème</div>
          </div>
          <div class="mk-tabs">
            <button class="mk-tab ${editTab==='season'?'on':''}" onclick="window.mkSetTab('season')">📅 Saison</button>
            <button class="mk-tab ${editTab==='cat'?'on':''}" onclick="window.mkSetTab('cat')">💊 Catégorie</button>
          </div>
          <div class="mk-themes">
            ${(editTab==='season' ? SEASON_THEMES : CAT_THEMES).map(t => {
              const count = themeProducts(t).length;
              const cp = COLOR_PRESETS[t.color];
              return `
                <button class="mk-theme-card" style="background:${cp.bg};color:${cp.accent}" onclick="window.mkStartEdit('${t.id}')">
                  <div class="mk-theme-emoji">${t.emoji}</div>
                  <div class="mk-theme-name">${t.name}</div>
                  <div class="mk-theme-count">${count} produits</div>
                </button>
              `;
            }).join('')}
            <button class="mk-theme-card mk-theme-custom" onclick="window.mkStartEdit('custom')">
              <div class="mk-theme-emoji">⚙️</div>
              <div class="mk-theme-name">Sélection libre</div>
              <div class="mk-theme-count">Vide — tu choisis</div>
            </button>
          </div>
        </div>

        <div class="mk-section">
          <div class="mk-section-head">
            <div class="mk-section-title">Bibliothèque ${sheets.length ? '· ' + sheets.length : ''}</div>
          </div>
          ${sheets.length === 0 ? `
            <div class="mk-empty">
              Aucune fiche enregistrée pour l'instant.<br>
              Démarre depuis un thème ci-dessus.
            </div>
          ` : `
            <div class="mk-library">
              ${sheets.map(s => {
                const cp = COLOR_PRESETS[s.color] || COLOR_PRESETS.navy;
                const date = new Date(s.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
                return `
                  <div class="mk-lib-card">
                    <div class="mk-lib-preview" style="background:${cp.bg};color:${cp.accent}">
                      <div class="mk-lib-prev-title">OFFRE IP</div>
                      <div class="mk-lib-prev-sub">${s.title}</div>
                      <div class="mk-lib-prev-rows">
                        ${(s.products||[]).slice(0,4).map(p => `<div class="mk-lib-prev-row">${(p.designation||'').slice(0,22)}…</div>`).join('')}
                      </div>
                    </div>
                    <div class="mk-lib-meta">
                      <div class="mk-lib-meta-top">
                        <div class="mk-lib-title">${s.title}</div>
                        <div class="mk-lib-date">${date}</div>
                      </div>
                      <div class="mk-lib-count">${(s.products||[]).length} produit${(s.products||[]).length>1?'s':''}</div>
                      <div class="mk-lib-actions">
                        <button class="mk-btn-mini" onclick="window.mkOpenSheet('${s.id}')">Éditer</button>
                        <button class="mk-btn-mini" onclick="window.mkPreviewSheetById('${s.id}')">Aperçu</button>
                        <button class="mk-btn-mini mk-btn-danger" onclick="window.mkDeleteSheet('${s.id}')">✕</button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  };

  window.mkSetTab = function (tab) {
    editTab = tab;
    window.renderMarketing();
  };

  window.mkStartEdit = function (themeId) {
    editingSheet = newSheet(themeId);
    productSearch = '';
    renderEdit();
  };

  window.mkOpenSheet = function (id) {
    const s = loadSheets().find(s => s.id === id);
    if (!s) return;
    editingSheet = JSON.parse(JSON.stringify(s));
    productSearch = '';
    renderEdit();
  };

  window.mkPreviewSheetById = function (id) {
    const s = loadSheets().find(s => s.id === id);
    if (!s) return;
    openPreview(s);
  };

  window.mkDeleteSheet = function (id) {
    if (!confirm('Supprimer cette fiche ?')) return;
    deleteSheet(id);
    if (typeof window.showToast === 'function') window.showToast('Fiche supprimée', 'info');
    window.renderMarketing();
  };

  // ── ÉCRAN ÉDITION ───────────────────────────────────────────
  function renderEdit() {
    const root = getRoot();
    if (!root || !editingSheet) return;
    const s = editingSheet;
    const cp = COLOR_PRESETS[s.color] || COLOR_PRESETS.navy;
    const theme = getThemeById(s.theme);

    const searchResults = productSearch.length >= 2 ? searchProducts(productSearch) : [];
    const selectedCips = new Set(s.products.map(p => p.cip13));

    root.innerHTML = `
      <div class="mk-edit-wrap">
        <div class="mk-edit-head">
          <button class="mk-btn-back" onclick="window.renderMarketing()">← Bibliothèque</button>
          <div class="mk-edit-actions">
            <button class="mk-btn" onclick="window.mkPreview()">Aperçu</button>
            <button class="mk-btn mk-btn-primary" onclick="window.mkSaveAndDownload()">⬇ Télécharger PDF</button>
          </div>
        </div>

        <div class="mk-edit-grid">
          <!-- COLONNE GAUCHE : config -->
          <div class="mk-edit-col">
            <div class="mk-card">
              <div class="mk-card-title">Apparence</div>
              <label class="mk-label">Titre de la fiche</label>
              <input class="mk-input" id="mk-title" value="${escapeAttr(s.title)}" oninput="window.mkUpdateTitle(this.value)" />
              <label class="mk-label" style="margin-top:14px">Couleur</label>
              <div class="mk-color-row">
                ${Object.entries(COLOR_PRESETS).map(([k,v]) => `
                  <button class="mk-color ${s.color===k?'on':''}" title="${v.name}"
                    style="background:${v.bg};border-color:${v.accent}"
                    onclick="window.mkUpdateColor('${k}')"></button>
                `).join('')}
              </div>
              <label class="mk-label" style="margin-top:14px">Footer</label>
              <input class="mk-input" id="mk-footer" value="${escapeAttr(s.footer)}" oninput="window.mkUpdateFooter(this.value)" />
            </div>

            <div class="mk-card">
              <div class="mk-card-title">Ajouter des produits</div>
              <input class="mk-input" placeholder="Rechercher (nom ou CIP)…"
                value="${escapeAttr(productSearch)}"
                oninput="window.mkSetSearch(this.value)" />
              ${searchResults.length > 0 ? `
                <div class="mk-search-results">
                  ${searchResults.map(b => {
                    const isSel = selectedCips.has(b.cip13);
                    return `
                      <button class="mk-search-row ${isSel?'on':''}"
                        onclick="window.mkToggleProduct('${b.cip13}')"
                        ${isSel?'disabled':''}>
                        <div class="mk-search-name">${b.designation}</div>
                        <div class="mk-search-meta">${cipFormat(b.cip13)} · ${eur(b.prix_ip)}</div>
                        <div class="mk-search-add">${isSel?'✓':'+'}</div>
                      </button>
                    `;
                  }).join('')}
                </div>
              ` : productSearch.length >= 2 ? `
                <div class="mk-empty-search">Aucun produit trouvé</div>
              ` : ''}
            </div>
          </div>

          <!-- COLONNE DROITE : sélection + aperçu mini -->
          <div class="mk-edit-col mk-edit-col-main">
            <div class="mk-card">
              <div class="mk-card-title">
                Produits sélectionnés
                <span class="mk-count-badge">${s.products.length}</span>
              </div>
              ${s.products.length === 0 ? `
                <div class="mk-empty-search">Aucun produit. Ajoute via la recherche à gauche.</div>
              ` : `
                <div class="mk-selected-list">
                  ${s.products.map((p, i) => `
                    <div class="mk-sel-row">
                      <div class="mk-sel-rank">${i+1}</div>
                      <div class="mk-sel-info">
                        <div class="mk-sel-name">${p.designation}</div>
                        <div class="mk-sel-meta">${cipFormat(p.cip13)}</div>
                      </div>
                      <div class="mk-sel-price">${eur(p.prix_ip)}</div>
                      <div class="mk-sel-actions">
                        <button class="mk-btn-icon" title="Monter" onclick="window.mkMoveProduct(${i},-1)" ${i===0?'disabled':''}>↑</button>
                        <button class="mk-btn-icon" title="Descendre" onclick="window.mkMoveProduct(${i},1)" ${i===s.products.length-1?'disabled':''}>↓</button>
                        <button class="mk-btn-icon mk-btn-danger" title="Retirer" onclick="window.mkRemoveProduct(${i})">✕</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function escapeAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  window.mkSetSearch = function (q) {
    productSearch = q;
    renderEdit();
    // refocus search input
    const el = (getRoot() || document).querySelector('input[placeholder^="Recherc"]');
    if (el) { el.focus(); el.setSelectionRange(q.length, q.length); }
  };

  window.mkUpdateTitle = function (v) { editingSheet.title = v; };
  window.mkUpdateFooter = function (v) { editingSheet.footer = v; };
  window.mkUpdateColor = function (k) { editingSheet.color = k; renderEdit(); };

  window.mkToggleProduct = function (cip) {
    if (editingSheet.products.find(p => p.cip13 === cip)) return;
    const b = window.BENCHMARK.find(b => b.cip13 === cip);
    if (b) editingSheet.products.push(snapshotProduct(b));
    renderEdit();
  };

  window.mkRemoveProduct = function (i) {
    editingSheet.products.splice(i, 1);
    renderEdit();
  };

  window.mkMoveProduct = function (i, dir) {
    const j = i + dir;
    if (j < 0 || j >= editingSheet.products.length) return;
    const tmp = editingSheet.products[i];
    editingSheet.products[i] = editingSheet.products[j];
    editingSheet.products[j] = tmp;
    renderEdit();
  };

  window.mkPreview = function () {
    if (!editingSheet) return;
    upsertSheet(editingSheet); // auto-save à l'aperçu
    openPreview(editingSheet);
  };

  window.mkSaveAndDownload = function () {
    if (!editingSheet) return;
    upsertSheet(editingSheet);
    if (typeof window.showToast === 'function') window.showToast('Fiche enregistrée ✓', 'success');
    generatePDF(editingSheet);
  };

  // ── APERÇU PDF (modal) ──────────────────────────────────────
  function openPreview(sheet) {
    const cp = COLOR_PRESETS[sheet.color] || COLOR_PRESETS.navy;
    let modal = document.getElementById('mk-preview-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'mk-preview-modal';
    modal.className = 'mk-modal';
    modal.innerHTML = `
      <div class="mk-modal-head">
        <div class="mk-modal-title">Aperçu fiche</div>
        <div class="mk-modal-actions">
          <button class="mk-btn" onclick="window.mkClosePreview()">Fermer</button>
          <button class="mk-btn mk-btn-primary" onclick="window.mkDownloadFromPreview()">⬇ Télécharger PDF</button>
        </div>
      </div>
      <div class="mk-modal-body">
        ${renderSheetHTML(sheet, 'mk-pdf-target')}
      </div>
    `;
    document.body.appendChild(modal);
    window._mkPreviewSheet = sheet;
  }

  window.mkClosePreview = function () {
    const modal = document.getElementById('mk-preview-modal');
    if (modal) modal.remove();
  };

  window.mkDownloadFromPreview = function () {
    if (window._mkPreviewSheet) generatePDF(window._mkPreviewSheet);
  };

  // ── RENDU FICHE (HTML utilisé pour PDF + preview) ───────────
  function renderSheetHTML(sheet, targetId) {
    const cp = COLOR_PRESETS[sheet.color] || COLOR_PRESETS.navy;
    return `
      <div id="${targetId}" class="mk-pdf" style="background:${cp.bg};color:${cp.accent}">
        <div class="mk-pdf-header">
          <div class="mk-pdf-logo">
            <svg width="56" height="56" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="6" width="22" height="52" rx="3" fill="#1B2A78"/>
              <rect x="34" y="6" width="22" height="52" rx="3" fill="#F5A623"/>
              <text x="17" y="42" text-anchor="middle" fill="white" font-family="DM Sans, sans-serif" font-weight="900" font-size="22">i</text>
              <text x="45" y="42" text-anchor="middle" fill="white" font-family="DM Sans, sans-serif" font-weight="900" font-size="22">p</text>
            </svg>
          </div>
          <div class="mk-pdf-title">
            <div class="mk-pdf-eyebrow">OFFRE IP</div>
            <div class="mk-pdf-h1">${sheet.title || 'Sans titre'}</div>
          </div>
        </div>

        <div class="mk-pdf-table-wrap">
          <table class="mk-pdf-table">
            <thead>
              <tr style="background:${cp.headerBg};color:${cp.headerFg}">
                <th>CODE CIP</th>
                <th style="text-align:left">LIBELLÉ</th>
                <th>PPHT</th>
                <th>IP HT NET</th>
              </tr>
            </thead>
            <tbody>
              ${sheet.products.map(p => `
                <tr>
                  <td class="mk-cell-cip">${cipFormat(p.cip13)}</td>
                  <td class="mk-cell-name">${p.designation}</td>
                  <td class="mk-cell-price">${eur(p.prix_ht)}</td>
                  <td class="mk-cell-price-strong" style="background:${cp.priceBg};color:${cp.priceFg}">${eur(p.prix_ip)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="mk-pdf-footer">${sheet.footer || ''}</div>
      </div>
    `;
  }

  // ── GÉNÉRATION PDF ──────────────────────────────────────────
  function generatePDF(sheet) {
    // Si on est dans le modal aperçu, on prend directement le DOM existant
    let target = document.getElementById('mk-pdf-target');
    let cleanupTarget = false;

    if (!target) {
      // Render off-screen
      const wrap = document.createElement('div');
      wrap.style.position = 'fixed';
      wrap.style.left = '-9999px';
      wrap.style.top = '0';
      wrap.style.width = '794px'; // A4 width @ 96dpi
      wrap.innerHTML = renderSheetHTML(sheet, 'mk-pdf-target-tmp');
      document.body.appendChild(wrap);
      target = wrap.querySelector('#mk-pdf-target-tmp');
      cleanupTarget = true;
    }

    if (!window.html2pdf) {
      alert('Lib html2pdf non chargée. Vérifie l\'inclusion CDN.');
      if (cleanupTarget) target.parentElement.remove();
      return;
    }

    const filename = 'IP_' + (sheet.title || 'fiche').replace(/[^a-zA-Z0-9_-]+/g, '_') + '.pdf';

    window.html2pdf().set({
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: null },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    }).from(target).save().then(() => {
      if (cleanupTarget) target.parentElement.remove();
      if (typeof window.showToast === 'function') window.showToast('PDF généré ✓', 'success');
    }).catch(err => {
      console.error('[marketing] PDF error', err);
      if (cleanupTarget) target.parentElement.remove();
      alert('Erreur génération PDF : ' + err.message);
    });
  }

})();
