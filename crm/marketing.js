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

  // ── LOGO IP OFFICIEL (inline SVG, source: crm/marketing-logo.svg) ─
  // Lettres "i" + "p" en capsules pharmaceutiques.
  // "i" en bleu marine #0B1F4D · "p" en doré #C9A961
  const IP_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28" width="48" height="28" role="img" aria-label="Integral Pharma">
    <g>
      <rect x="2" y="1.5" width="9" height="5.5" rx="2.75" fill="#0B1F4D"/>
      <rect x="2" y="8.5" width="9" height="18" rx="4.5" fill="#0B1F4D"/>
    </g>
    <g>
      <rect x="14" y="6.5" width="11" height="12" rx="5.5" fill="#C9A961"/>
      <rect x="17" y="9.5" width="5" height="6" rx="2.5" fill="#FFFFFF"/>
      <rect x="14" y="6.5" width="4" height="21" rx="2" fill="#C9A961"/>
    </g>
  </svg>`;

  function renderLogo(size) {
    const w = size || 56;
    const h = Math.round(w * 28 / 48);
    return IP_LOGO_SVG
      .replace('width="48"', 'width="' + w + '"')
      .replace('height="28"', 'height="' + h + '"');
  }

  // CSS @font-face DM Sans embarqué dans le HTML rendu avant export PDF.
  // html2pdf (html2canvas) prend en compte les fonts attachées au document
  // si elles sont chargées AVANT le rasterize → délai de 250 ms géré côté generatePDF.
  const PDF_FONT_CSS = `
    @font-face {
      font-family: 'DM Sans PDF';
      font-style: normal;
      font-weight: 400;
      font-display: block;
      src: url('https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZOIHQ.woff2') format('woff2');
    }
    @font-face {
      font-family: 'DM Sans PDF';
      font-style: normal;
      font-weight: 500;
      font-display: block;
      src: url('https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZ2IHQ.woff2') format('woff2');
    }
    @font-face {
      font-family: 'DM Sans PDF';
      font-style: normal;
      font-weight: 700;
      font-display: block;
      src: url('https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZaIHQ.woff2') format('woff2');
    }
    @font-face {
      font-family: 'DM Sans PDF';
      font-style: normal;
      font-weight: 900;
      font-display: block;
      src: url('https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZuIHQ.woff2') format('woff2');
    }
    #mk-pdf-target, #mk-pdf-target-tmp,
    #mk-pdf-target *, #mk-pdf-target-tmp * {
      font-family: 'DM Sans PDF', 'DM Sans', system-ui, -apple-system, sans-serif !important;
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
    }
  `;

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
      filter: b => /CETIRIZIN|LORATADIN|DESLORATADIN|FEXOFEN|EBASTINE|RUPATADINE|BILASTINE|MIZOLAST|AERIUS|TELFAST|XYZALL|WYSTAMM/i.test(b.designation) || b.atc2 === 'R06' },
    { id: 'solaire', name: 'Solaire & moustiques', months: [5,6,7,8], emoji: '☀️', color: 'amber',
      filter: b => /SOLAIRE|UVA|UVB|\bSPF\b|APRES-SOLEIL|APRES SOLEIL|COUP DE SOLEIL|MOUSTIQ|REPULSI|INSECT|PIQUR|BIAFINE|PHOTODERM/i.test(b.designation) },
    { id: 'immunite', name: 'Rentrée immunité', months: [9,10], emoji: '🛡️', color: 'sky',
      filter: b => /VITAM|MAGNES|PROBIO|DEFENSE|IMMUNI|\bZINC\b|GINSENG|GUARANA|ECHINAC|PROPOLIS|ACEROLA|GELEE ROYALE|OLIGO|BEROCCA|SUPRADYN|ELEVIT|CHOLECALCI/i.test(b.designation) },
    { id: 'grippe', name: 'Grippe & vaccins hiver', months: [10,11,12], emoji: '💉', color: 'navy',
      filter: b => /\bGRIPPE\b|INFLUVAC|VAXIGRIP|EFLUELDA|FLUARIX|OSELTAMIVIR|TAMIFLU|FERVEX/i.test(b.designation) },
    { id: 'rhume', name: 'Rhume & toux', months: [10,11,12,1,2], emoji: '🤧', color: 'lilac',
      filter: b => /RHUME|\bTOUX\b|RHINO|NASAL|PASTIL|FERVEX|HUMEX|ACTIFED|DOLIRHUME|STREPSIL|\bDRILL\b|ANGINEX|FLUIDIFI|EXPECTOR|VICKS|MAXILASE|HEXTRIL|HEXASPRAY/i.test(b.designation) },
    { id: 'gastro', name: 'Gastro hiver', months: [11,12,1,2], emoji: '🍵', color: 'forest',
      filter: b => /SMECTA|TIORFAN|LOPERAM|IMODIUM|DIOSMECTIT|ULTRA-LEVURE|SACCHAROMYC|VOGAL|MOTILIUM|ANTIDIARR|\bSRO\b|ADIARIL|DOMPERIDON|METOCLOPRAM/i.test(b.designation) },
  ];

  // Thèmes catégorie — transverses
  const CAT_THEMES = [
    { id: 'biosim',     name: 'Biosimilaires',          emoji: '🧬', color: 'mint',
      filter: b => b.artnature === 'biosimilaire' || /PELGRAZ|PELMEG|AMGEVITA|HYRIMOZ|HULIO|IDACIO|YUFLYMA|HUKYNDRA|LIBMYRIS|IMRALDI|AMSPARITY|RETACRIT|BINOCRIT|BENEPALI|ERELZI|NEPEXTO|NIVESTIM|ZARZIO|GRASUSTEK|STIMUFEND|STEQEYMA|UZPRUVO|WEZENLA|PYZCHIVA|RANIVISIO|XIMLUCI|BYOOVIZ|MOVYMIA|SONDELBAY|LIVOGIVA|EYDENZELT|PAVBLU|AFQLIR|BEMFOLA|OVALEAP|REMSIMA|INFLECTRA|TRUXIMA|RIXATHON|RUXIENCE|ONTRUZANT|KANJINTI|TRAZIMERA|HERZUMA|ZERCEPAC|ABEVMY|MVASI|ZIRABEV|AYBINTIO|EQUIDACENT/i.test(b.designation) },
    { id: 'cardio',     name: 'Génériques cardio',      emoji: '❤️', color: 'amber',
      filter: b => ['C09','C10','C07','C08','C03'].includes(b.atc2) },
    { id: 'diabete',    name: 'Génériques diabète',     emoji: '💧', color: 'forest',
      filter: b => b.atc2 === 'A10' && !/WEGOVY|MOUNJARO|OZEMPIC|SAXENDA|TRULICITY|VICTOZA|RYBELSUS|LANTUS|NOVORAPID|HUMALOG|TOUJEO|LEVEMIR|TRESIBA|ABASAGLAR|FIASP|INSULATARD|ACTRAPID|INSUMAN|HUMULIN|APIDRA|RYZODEG|XULTOPHY|SULIQUA/i.test(b.designation) },
    { id: 'glp1',       name: 'GLP-1 (Wegovy, Mounjaro…)', emoji: '⚡', color: 'sky',
      filter: b => /WEGOVY|MOUNJARO|OZEMPIC|SAXENDA|TRULICITY|VICTOZA|RYBELSUS/i.test(b.designation) },
    { id: 'insulines',  name: 'Diabète insulines',      emoji: '💉', color: 'sky',
      filter: b => /LANTUS|NOVORAPID|HUMALOG|TOUJEO|LEVEMIR|TRESIBA|ABASAGLAR|FIASP|INSULATARD|ACTRAPID|INSUMAN|HUMULIN|APIDRA|RYZODEG|XULTOPHY|SULIQUA|INSULINE/i.test(b.designation) },
    { id: 'anticoag',   name: 'Anti-coagulants',        emoji: '🩸', color: 'rose',
      filter: b => b.atc2 === 'B01' || /ELIQUIS|XARELTO|PRADAXA|LIXIANA|KARDEGIC|PLAVIX|EFFIENT|BRILIQUE|APIXABAN|RIVAROXABAN|DABIGATRAN|EDOXABAN|CLOPIDOGREL|PRASUGREL|TICAGRELOR|WARFARINE|COUMADINE|PREVISCAN|SINTROM|FLUINDIONE|ACENOCOUMAROL/i.test(b.designation) },
    { id: 'vaccins',    name: 'Vaccins',                emoji: '💉', color: 'navy',
      filter: b => /VACCIN|INFLUVAC|VAXIGRIP|EFLUELDA|GARDASIL|ENGERIX|REPEVAX|BOOSTRIX|INFANRIX|HEXYON|PRIORIX|PREVENAR|NIMENRIX|MENJUGATE|MENVEO|TICOVAC|HAVRIX|AVAXIM|TWINRIX|SHINGRIX|BEXSERO|TRUMENBA|ROTARIX|ROTATEQ|CAPVAXIVE|VAXNEUVANCE|VAXELIS|VARIVAX|VARILRIX|ABRYSVO|BEYFORTUS/i.test(b.designation) },
    { id: 'femme',      name: 'Santé féminine',         emoji: '🌸', color: 'rose',
      filter: b => b.atc2 === 'G03' || /OESTROGEN|PROGESTER|CONTRACEPTI|MENOPAUS|MENSTRU|OVULE/i.test(b.designation) },
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

  // ── PERSISTENCE (Supabase si connecte, fallback localStorage) ───────
  let _sheetsCache = null;
  let _supaClient = null;
  let _supaReady = false;
  let _supaUser = null;

  function getSupa() {
    if (_supaClient) return _supaClient;
    try {
      if (window.supabase && typeof window.supabase.createClient === 'function'
          && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        _supaClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        return _supaClient;
      }
    } catch (e) { /* silencieux */ }
    return null;
  }

  function lsLoad() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
  }
  function lsSave(sheets) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(sheets)); } catch (e) { /* quota */ }
  }

  function sheetToRow(s) {
    return {
      id: s.id,
      title: s.title,
      theme: s.theme,
      color: s.color,
      footer: s.footer,
      template: s.template || 'offre',
      products: s.products || [],
      created_at: s.created_at || new Date().toISOString(),
      updated_at: s.updated_at || new Date().toISOString(),
    };
  }

  function loadSheets() {
    if (_sheetsCache) return _sheetsCache.slice();
    _sheetsCache = lsLoad();
    return _sheetsCache.slice();
  }

  function saveSheets(sheets) {
    _sheetsCache = sheets.slice();
    if (!_supaUser) lsSave(_sheetsCache);
  }

  function upsertSheet(sheet) {
    const sheets = loadSheets();
    const idx = sheets.findIndex(s => s.id === sheet.id);
    sheet.updated_at = new Date().toISOString();
    if (idx >= 0) sheets[idx] = sheet;
    else { sheet.created_at = sheet.updated_at; sheets.unshift(sheet); }
    saveSheets(sheets);

    if (_supaUser) {
      const supa = getSupa();
      if (supa) {
        const row = sheetToRow(sheet);
        Promise.resolve().then(async () => {
          try {
            const { error } = await supa.from('marketing_sheets').upsert(row, { onConflict: 'id' });
            if (error) console.warn('[marketing] upsert error', error.message);
          } catch (e) { console.warn('[marketing] upsert exception', e); }
        });
      }
    }
    return sheet;
  }

  function deleteSheet(id) {
    saveSheets(loadSheets().filter(s => s.id !== id));
    if (_supaUser) {
      const supa = getSupa();
      if (supa) {
        Promise.resolve().then(async () => {
          try {
            const { error } = await supa.from('marketing_sheets').delete().eq('id', id);
            if (error) console.warn('[marketing] delete error', error.message);
          } catch (e) { console.warn('[marketing] delete exception', e); }
        });
      }
    }
  }

  async function initPersistence() {
    if (_supaReady) return;
    const supa = getSupa();
    if (!supa) {
      _supaReady = true;
      _sheetsCache = lsLoad();
      return;
    }

    let session = null;
    try {
      const sessionPromise = supa.auth.getSession();
      const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ data: { session: null }, _timeout: true }), 3000));
      const res = await Promise.race([sessionPromise, timeoutPromise]);
      session = res && res.data ? res.data.session : null;
    } catch (e) {
      console.warn('[marketing] getSession failed', e);
    }

    if (!session || !session.user) {
      _supaUser = null;
      _supaReady = true;
      _sheetsCache = lsLoad();
      return;
    }

    _supaUser = session.user;

    try {
      const localRaw = localStorage.getItem(LS_KEY);
      const localSheets = localRaw ? JSON.parse(localRaw) : [];
      if (Array.isArray(localSheets) && localSheets.length > 0) {
        const rows = localSheets.map(sheetToRow);
        const { error: migErr } = await supa.from('marketing_sheets').upsert(rows, { onConflict: 'id' });
        if (!migErr) {
          localStorage.removeItem(LS_KEY);
          console.log('[marketing] migrated ' + rows.length + ' sheets to Supabase');
        } else {
          console.warn('[marketing] migration error', migErr.message);
        }
      }
    } catch (e) {
      console.warn('[marketing] migration exception', e);
    }

    try {
      const { data, error } = await supa.from('marketing_sheets')
        .select('*').order('updated_at', { ascending: false });
      if (error) {
        console.warn('[marketing] load error, fallback localStorage', error.message);
        _sheetsCache = lsLoad();
      } else {
        _sheetsCache = Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.warn('[marketing] load exception', e);
      _sheetsCache = lsLoad();
    }

    _supaReady = true;

    try {
      const root = getRoot();
      if (root && typeof window.renderMarketing === 'function'
          && document.body.contains(root)) {
        window.renderMarketing();
      }
    } catch (e) { /* silencieux */ }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initPersistence(); });
  } else {
    setTimeout(() => { initPersistence(); }, 0);
  }

  function newSheet(themeId) {
    const t = getThemeById(themeId) || getThemeById('custom');
    return {
      id: 'mk_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
      title: t.id === 'custom' ? 'Nouvelle fiche' : t.name,
      theme: t.id,
      color: t.color,
      template: 'offre',
      footer: 'Tarif en vigueur ' + new Date().getFullYear(),
      products: themeProducts(t).slice(0, 12).map(snapshotProduct),
    };
  }

  // ── TEMPLATES DISPONIBLES ───────────────────────────────────
  const TEMPLATES = {
    offre: { name: 'Offre IP',          maxProducts: 12, defaultCount: 12 },
    memo:  { name: 'Mémo référentiel',  maxProducts: 25, defaultCount: 20 },
    focus: { name: 'Focus produit',     maxProducts: 3,  defaultCount: 1  },
  };

  function getTemplateId(sheet) {
    const t = (sheet && sheet.template) || 'offre';
    return TEMPLATES[t] ? t : 'offre';
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
                      <div class="mk-lib-prev-sub">${escapeAttr(s.title)}</div>
                      <div class="mk-lib-prev-rows">
                        ${(s.products||[]).slice(0,4).map(p => `<div class="mk-lib-prev-row">${escapeAttr((p.designation||'').slice(0,22))}…</div>`).join('')}
                      </div>
                    </div>
                    <div class="mk-lib-meta">
                      <div class="mk-lib-meta-top">
                        <div class="mk-lib-title">${escapeAttr(s.title)}</div>
                        <div class="mk-lib-date">${date}</div>
                      </div>
                      <div class="mk-lib-count">${(s.products||[]).length} produit${(s.products||[]).length>1?'s':''}</div>
                      <div class="mk-lib-actions">
                        <button class="mk-btn-mini" onclick="window.mkOpenSheet('${s.id}')">Éditer</button>
                        <button class="mk-btn-mini" onclick="window.mkPreviewSheetById('${s.id}')">Aperçu</button>
                        <button class="mk-btn-mini" onclick="window.mkShareSheet('${s.id}')">Partager</button>
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
              <label class="mk-label" style="margin-top:14px">Template</label>
              <select class="mk-input mk-select" id="sheet-template" onchange="window.mkUpdateTemplate(this.value)">
                <option value="offre" ${getTemplateId(s)==='offre'?'selected':''}>Offre IP (défaut)</option>
                <option value="memo" ${getTemplateId(s)==='memo'?'selected':''}>Mémo référentiel</option>
                <option value="focus" ${getTemplateId(s)==='focus'?'selected':''}>Focus produit</option>
              </select>
              <div class="mk-template-hint">${TEMPLATES[getTemplateId(s)].name} · max ${TEMPLATES[getTemplateId(s)].maxProducts} produits</div>
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
                      ${getTemplateId(s) === 'focus' ? `
                        <div class="mk-sel-focus-fields">
                          <textarea class="mk-input mk-textarea" placeholder="Accroche libre (1 phrase)"
                            oninput="window.mkUpdateFocusField(${i},'accroche',this.value)">${escapeAttr(p.accroche || '')}</textarea>
                          <input class="mk-input" placeholder="Argument clé (badge)"
                            value="${escapeAttr(p.argument || '')}"
                            oninput="window.mkUpdateFocusField(${i},'argument',this.value)" />
                        </div>
                      ` : ''}
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
  window.mkUpdateTemplate = function (k) {
    if (!TEMPLATES[k]) return;
    editingSheet.template = k;
    const cap = TEMPLATES[k].maxProducts;
    if (editingSheet.products.length > cap) {
      editingSheet.products = editingSheet.products.slice(0, cap);
      if (typeof window.showToast === 'function') {
        window.showToast('Template "' + TEMPLATES[k].name + '" : ' + cap + ' produits max — liste tronquée', 'info');
      }
    }
    // Init des champs spécifiques focus (accroche + argument clé)
    if (k === 'focus') {
      editingSheet.products.forEach(p => {
        if (typeof p.accroche !== 'string') p.accroche = '';
        if (typeof p.argument !== 'string') p.argument = '';
      });
    }
    renderEdit();
  };
  window.mkUpdateFocusField = function (i, field, val) {
    if (!editingSheet || !editingSheet.products[i]) return;
    editingSheet.products[i][field] = val;
  };

  window.mkToggleProduct = function (cip) {
    if (editingSheet.products.find(p => p.cip13 === cip)) return;
    const cap = TEMPLATES[getTemplateId(editingSheet)].maxProducts;
    if (editingSheet.products.length >= cap) {
      if (typeof window.showToast === 'function') {
        window.showToast('Limite atteinte : ' + cap + ' produits max pour ce template', 'info');
      }
      return;
    }
    const b = window.BENCHMARK.find(b => b.cip13 === cip);
    if (b) {
      const snap = snapshotProduct(b);
      if (getTemplateId(editingSheet) === 'focus') {
        snap.accroche = '';
        snap.argument = '';
      }
      editingSheet.products.push(snap);
    }
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
    const tpl = getTemplateId(sheet);
    if (tpl === 'memo')  return renderMemoTemplate(sheet, targetId);
    if (tpl === 'focus') return renderFocusTemplate(sheet, targetId);
    return renderOffreTemplate(sheet, targetId);
  }

  // ── TEMPLATE OFFRE IP (existant, factorisé) ─────────────────
  function renderOffreTemplate(sheet, targetId) {
    const cp = COLOR_PRESETS[sheet.color] || COLOR_PRESETS.navy;
    return `
      <div id="${targetId}" class="mk-pdf mk-pdf-offre" style="background:${cp.bg};color:${cp.accent}">
        <div class="mk-pdf-header">
          <div class="mk-pdf-logo">
            ${renderLogo(72)}
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

  // ── TEMPLATE MEMO (multi-colonnes dense, inspiré BIOSIM) ────
  function renderMemoTemplate(sheet, targetId) {
    function extractMarque(designation) {
      // Premier mot non numérique de la désignation
      const m = String(designation || '').match(/^([A-ZÉÈÊÀÂÎÔÛÇ&-]{2,})/i);
      return m ? m[1] : '';
    }
    function ecoPct(p) {
      if (!p.prix_ht || !p.prix_ip || p.prix_ht <= 0) return '—';
      const pct = ((p.prix_ht - p.prix_ip) / p.prix_ht) * 100;
      if (!isFinite(pct) || pct <= 0) return '—';
      return pct.toFixed(1).replace('.', ',') + ' %';
    }
    return `
      <div id="${targetId}" class="mk-pdf mk-pdf-memo">
        <div class="mk-memo-header">
          <div class="mk-memo-header-left">
            <div class="mk-memo-eyebrow">MÉMO RÉFÉRENTIEL</div>
            <div class="mk-memo-h1">${sheet.title || 'Sans titre'}</div>
            <div class="mk-memo-sub">${sheet.products.length} référence${sheet.products.length>1?'s':''} · ${new Date().toLocaleDateString('fr-FR', { month:'long', year:'numeric' })}</div>
          </div>
          <div class="mk-memo-logo">${renderLogo(64)}</div>
        </div>

        <div class="mk-memo-table-wrap">
          <table class="mk-memo-table">
            <thead>
              <tr>
                <th style="text-align:left">DÉSIGNATION</th>
                <th>MARQUE</th>
                <th>CIP13</th>
                <th>COND.</th>
                <th>PRIX HT</th>
                <th>PRIX IP</th>
                <th>ÉCO.</th>
              </tr>
            </thead>
            <tbody>
              ${sheet.products.map(p => `
                <tr>
                  <td class="mk-memo-desig">${p.designation || '—'}</td>
                  <td class="mk-memo-marque">${extractMarque(p.designation)}</td>
                  <td class="mk-memo-cip">${cipFormat(p.cip13)}</td>
                  <td class="mk-memo-cond">${p.conditionnement || '—'}</td>
                  <td class="mk-memo-price">${eur(p.prix_ht)}</td>
                  <td class="mk-memo-price-strong">${eur(p.prix_ip)}</td>
                  <td class="mk-memo-eco">${ecoPct(p)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="mk-memo-footer">
          <div class="mk-memo-footer-main">${sheet.footer || 'Tarif en vigueur ' + new Date().getFullYear()}</div>
          <div class="mk-memo-footer-warn">Document à usage interne · ne pas diffuser</div>
        </div>
      </div>
    `;
  }

  // ── TEMPLATE FOCUS (1-3 produits, look magazine) ────────────
  function renderFocusTemplate(sheet, targetId) {
    const cp = COLOR_PRESETS[sheet.color] || COLOR_PRESETS.navy;
    function extractMarque(designation) {
      const m = String(designation || '').match(/^([A-ZÉÈÊÀÂÎÔÛÇ&-]{2,})/i);
      return m ? m[1] : '';
    }
    function ecoEur(p) {
      if (!p.prix_ht || !p.prix_ip) return '—';
      const d = p.prix_ht - p.prix_ip;
      if (d <= 0) return '—';
      return '− ' + eur(d);
    }
    const placeholderSVG = (label) => `
      <svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="200" height="200" rx="18" fill="#F4F6FB"/>
        <rect x="40" y="58" width="120" height="84" rx="10" fill="#FFFFFF" stroke="#D9DFEC" stroke-width="2"/>
        <circle cx="78" cy="92" r="10" fill="#D9DFEC"/>
        <polyline points="56,140 96,108 124,128 156,98" fill="none" stroke="#D9DFEC" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="100" y="172" text-anchor="middle" font-family="DM Sans, sans-serif" font-size="11" font-weight="700" fill="#7888A8" letter-spacing="0.08em">${(label||'').slice(0,18).toUpperCase()}</text>
      </svg>
    `;
    return `
      <div id="${targetId}" class="mk-pdf mk-pdf-focus" style="background:${cp.bg};color:${cp.accent}">
        <div class="mk-focus-header">
          <div class="mk-focus-logo">${renderLogo(72)}</div>
          <div class="mk-focus-title">
            <div class="mk-focus-eyebrow">FOCUS PRODUIT</div>
            <div class="mk-focus-h1">${sheet.title || 'Sans titre'}</div>
          </div>
        </div>

        <div class="mk-focus-list">
          ${sheet.products.slice(0,3).map((p, i) => `
            <div class="mk-focus-card">
              <div class="mk-focus-visual">${placeholderSVG(p.designation)}</div>
              <div class="mk-focus-body">
                <div class="mk-focus-top">
                  <div class="mk-focus-name">${p.designation || '—'}</div>
                  <div class="mk-focus-marque">${extractMarque(p.designation)}</div>
                  <div class="mk-focus-cip">CIP13 · ${cipFormat(p.cip13)}</div>
                </div>
                ${p.accroche ? `<div class="mk-focus-accroche">${p.accroche}</div>` : ''}
                ${p.argument ? `<div class="mk-focus-argument" style="background:${cp.headerBg};color:${cp.headerFg}">${p.argument}</div>` : ''}
                <div class="mk-focus-prices">
                  <div class="mk-focus-price-old">${eur(p.prix_ht)}</div>
                  <div class="mk-focus-price-ip" style="color:${cp.headerBg}">${eur(p.prix_ip)}</div>
                  <div class="mk-focus-eco">Économie ${ecoEur(p)}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="mk-pdf-footer">${sheet.footer || ''}</div>
      </div>
    `;
  }

  // ── GÉNÉRATION PDF ──────────────────────────────────────────
  // Injecte une seule fois le <style> @font-face DM Sans dans <head>.
  // Cela permet à html2canvas / html2pdf de rasteriser avec la bonne typo.
  function ensurePdfFontStyle() {
    if (document.getElementById('mk-pdf-font-style')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'mk-pdf-font-style';
    styleEl.textContent = PDF_FONT_CSS;
    document.head.appendChild(styleEl);
  }

  async function generatePDF(sheet) {
    ensurePdfFontStyle();

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

    // html2pdf lazy load (retire du boot pour alleger le chargement)
    if (!window.html2pdf) {
      if (typeof window.ensureHtml2Pdf === 'function') {
        try { await window.ensureHtml2Pdf(); } catch (e) {}
      }
      if (!window.html2pdf) {
        alert('Lib html2pdf non chargée. Vérifie ta connexion internet.');
        if (cleanupTarget) target.parentElement.remove();
        return;
      }
    }

    // Laisse aux @font-face le temps de charger (woff2 Google Fonts)
    // avant que html2canvas ne rasterize le DOM.
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) { /* fallback */ }
    }
    await new Promise(r => setTimeout(r, 250));

    const filename = 'IP_' + (sheet.title || 'fiche').replace(/[^a-zA-Z0-9_-]+/g, '_') + '.pdf';

    const worker = window.html2pdf().set({
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.92 },
      html2canvas: {
        scale: 3,
        useCORS: true,
        letterRendering: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        allowTaint: false
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { mode: ['css', 'legacy'] }
    }).from(target);

    // outputPdf('blob') → on récupère le blob pour partage (mailto, WhatsApp)
    // tout en déclenchant manuellement le download via lien temporaire.
    worker.outputPdf('blob').then((blob) => {
      // Déclenche le download manuel (remplace le .save() supprimé)
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch (e) {
        console.error('[marketing] download trigger error', e);
      }
      if (cleanupTarget) target.parentElement.remove();
      if (typeof window.showToast === 'function') window.showToast('PDF généré ✓', 'success');
      // Toast de partage post-génération
      showShareToast(sheet, blob);
    }).catch(err => {
      console.error('[marketing] PDF error', err);
      if (cleanupTarget) target.parentElement.remove();
      alert('Erreur génération PDF : ' + err.message);
    });
  }

  // ── TOAST PARTAGE ───────────────────────────────────────────
  // Apparaît après génération PDF (ou clic "Partager" depuis biblio).
  // 3 actions : Email · WhatsApp · Copier lien.
  function shareUrlFor(sheet) {
    return 'https://willmorel49-coder.github.io/jarvis-app/crm/?sheet=' + encodeURIComponent(sheet.id);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // Fallback execCommand sur textarea temporaire
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('execCommand copy failed'));
      } catch (e) { reject(e); }
    });
  }

  // SVG icons (inline, 18px)
  const ICON_EMAIL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></svg>';
  const ICON_WHATSAPP = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20.5 3.5A11 11 0 0 0 3.6 17.3L2 22l4.8-1.6A11 11 0 1 0 20.5 3.5zM12 20a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-5.8c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2-1.3-.5-.5-.9-1.1-1.3-1.7-.1-.2 0-.4.1-.5l.4-.4c.1-.1.2-.3.2-.4 0-.1 0-.3-.1-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.7.7-1 1.5-1 2.5.1 1.2.5 2.3 1.3 3.3 1.4 2 3.1 3.4 5.2 4.2.4.2.7.3 1 .3.4.1.7.1 1 0 .6-.1 1.4-.6 1.6-1.2.2-.4.2-.8.1-1.2-.1-.1-.2-.2-.4-.3z"/></svg>';
  const ICON_LINK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';

  let _mkShareTimer = null;

  function dismissShareToast() {
    const el = document.getElementById('mk-share-toast');
    if (el) el.remove();
    if (_mkShareTimer) { clearTimeout(_mkShareTimer); _mkShareTimer = null; }
  }

  function showShareToast(sheet, pdfBlob) {
    if (!sheet) return;
    dismissShareToast();

    const title = sheet.title || 'Fiche IP';
    const shareUrl = shareUrlFor(sheet);

    const mailSubject = encodeURIComponent('Fiche Marketing Intégral Pharma - ' + title);
    const mailBody = encodeURIComponent(
      'Bonjour,\n\n' +
      'Je te partage notre fiche commerciale Intégral Pharma : ' + title + '.\n\n' +
      'Le PDF est dans tes Téléchargements — glisse-le en pièce jointe à cet email.\n\n' +
      'Lien de consultation : ' + shareUrl + '\n\n' +
      'Bonne journée,'
    );
    const mailHref = 'mailto:?subject=' + mailSubject + '&body=' + mailBody;

    const waText = encodeURIComponent(
      'Bonjour, je te partage notre fiche IP : ' + title + '. PDF dispo sur demande. ' + shareUrl
    );
    const waHref = 'https://wa.me/?text=' + waText;

    const toast = document.createElement('div');
    toast.id = 'mk-share-toast';
    toast.className = 'marketing-share-toast';
    toast.setAttribute('role', 'dialog');
    toast.setAttribute('aria-label', 'Partager la fiche');
    toast.innerHTML = `
      <button class="marketing-share-close" aria-label="Fermer" type="button">${ICON_CLOSE}</button>
      <div class="marketing-share-head">
        <div class="marketing-share-eyebrow">Fiche prête ✓</div>
        <div class="marketing-share-title">${escapeAttr(title)}</div>
        <div class="marketing-share-hint">Le PDF est dans tes Téléchargements. Partage-le :</div>
      </div>
      <div class="marketing-share-actions">
        <a class="marketing-share-action" href="${mailHref}" data-act="email">
          ${ICON_EMAIL}<span>Email</span>
        </a>
        <a class="marketing-share-action" href="${waHref}" target="_blank" rel="noopener" data-act="whatsapp">
          ${ICON_WHATSAPP}<span>WhatsApp</span>
        </a>
        <button class="marketing-share-action" type="button" data-act="copy">
          ${ICON_LINK}<span class="marketing-share-copy-label">Copier lien</span>
        </button>
      </div>
    `;

    document.body.appendChild(toast);

    // Handlers
    toast.querySelector('.marketing-share-close').addEventListener('click', dismissShareToast);

    const copyBtn = toast.querySelector('[data-act="copy"]');
    const copyLabel = copyBtn.querySelector('.marketing-share-copy-label');
    copyBtn.addEventListener('click', () => {
      copyToClipboard(shareUrl).then(() => {
        const prev = copyLabel.textContent;
        copyLabel.textContent = 'Lien copié ✓';
        copyBtn.classList.add('is-copied');
        setTimeout(() => {
          copyLabel.textContent = prev;
          copyBtn.classList.remove('is-copied');
        }, 1500);
      }).catch(err => {
        console.error('[marketing] copy error', err);
        copyLabel.textContent = 'Erreur copie';
      });
    });

    // Auto-dismiss après 12s
    _mkShareTimer = setTimeout(dismissShareToast, 12000);

    // Référence au blob (debug / extensions futures éventuelles)
    if (pdfBlob) toast._pdfBlob = pdfBlob;
  }

  // Exposition publique
  window.mkShareSheet = function (id) {
    const s = loadSheets().find(s => s.id === id);
    if (!s) return;
    showShareToast(s);
  };
  window.mkDismissShareToast = dismissShareToast;

})();
