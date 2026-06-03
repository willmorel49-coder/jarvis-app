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

  // ── LOGO IP OFFICIEL ──────────────────────────────────────────────
  // Source : crm/marketing-logo.avif (fourni par Will, charte IP officielle)
  // Fallback SVG inline pour navigateurs sans support AVIF (rare, Safari 16-).
  const IP_LOGO_FALLBACK_SVG = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28"><rect x="2" y="1.5" width="9" height="5.5" rx="2.75" fill="#0B1F4D"/><rect x="2" y="8.5" width="9" height="18" rx="4.5" fill="#0B1F4D"/><rect x="14" y="6.5" width="11" height="12" rx="5.5" fill="#C9A961"/><rect x="17" y="9.5" width="5" height="6" rx="2.5" fill="#FFFFFF"/><rect x="14" y="6.5" width="4" height="21" rx="2" fill="#C9A961"/></svg>')}`;

  function renderLogo(size) {
    const h = size || 56;
    // <picture> avec source AVIF et fallback SVG en img — supporte tous nav.
    // crossorigin omit : ressource same-origin GH Pages.
    return `<picture>
      <source srcset="marketing-logo.avif" type="image/avif">
      <img src="${IP_LOGO_FALLBACK_SVG}" alt="Integral Pharma" style="height:${h}px;width:auto;display:block;object-fit:contain" />
    </picture>`;
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
  // Categorie 'classic' = palette IP historique
  // Categorie 'trend'   = tendances design 2026-2027 (Future Dusk, Sage,
  //                       Cherry Lacquer, Burnt Sienna, Vanilla, Chartreuse…)
  const COLOR_PRESETS = {
    // ─── Classiques IP ─────────────────────────────────────────────
    navy:   { name: 'Marine',     category: 'classic', bg: '#DCE5FF', accent: '#1B2A78', headerBg: '#1B2A78', headerFg: '#FFFFFF', priceBg: '#1B2A78', priceFg: '#FFFFFF' },
    sky:    { name: 'Ciel',       category: 'classic', bg: '#BFDDE4', accent: '#0E4F66', headerBg: '#0E4F66', headerFg: '#FFFFFF', priceBg: '#BFDDE4', priceFg: '#0E4F66' },
    lilac:  { name: 'Lilas',      category: 'classic', bg: '#E0CDED', accent: '#5B2E80', headerBg: '#5B2E80', headerFg: '#FFFFFF', priceBg: '#E0CDED', priceFg: '#5B2E80' },
    mint:   { name: 'Menthe',     category: 'classic', bg: '#C8EAD8', accent: '#1F6B45', headerBg: '#1F6B45', headerFg: '#FFFFFF', priceBg: '#C8EAD8', priceFg: '#1F6B45' },
    amber:  { name: 'Ambre',      category: 'classic', bg: '#FFE9B8', accent: '#7A4B00', headerBg: '#7A4B00', headerFg: '#FFFFFF', priceBg: '#FFE9B8', priceFg: '#7A4B00' },
    rose:   { name: 'Rose',       category: 'classic', bg: '#F5C6C6', accent: '#7C2B3A', headerBg: '#7C2B3A', headerFg: '#FFFFFF', priceBg: '#F5C6C6', priceFg: '#7C2B3A' },
    forest: { name: 'Forêt',      category: 'classic', bg: '#BCDABF', accent: '#1C4E2A', headerBg: '#1C4E2A', headerFg: '#FFFFFF', priceBg: '#BCDABF', priceFg: '#1C4E2A' },

    // ─── Tendances 2026-2027 ───────────────────────────────────────
    dusk:       { name: 'Future Dusk',       category: 'trend', bg: '#D9D0EC', accent: '#2D1B69', headerBg: '#2D1B69', headerFg: '#FFFFFF', priceBg: '#D9D0EC', priceFg: '#2D1B69' },
    teal:       { name: 'Deep Teal',         category: 'trend', bg: '#B5DEDA', accent: '#0A4A45', headerBg: '#0A4A45', headerFg: '#FFFFFF', priceBg: '#0A4A45', priceFg: '#FFFFFF' },
    cherry:     { name: 'Cherry Lacquer',    category: 'trend', bg: '#F2C6CB', accent: '#8B0E25', headerBg: '#8B0E25', headerFg: '#FFFFFF', priceBg: '#8B0E25', priceFg: '#FFFFFF' },
    sienna:     { name: 'Burnt Sienna',      category: 'trend', bg: '#F0D2BD', accent: '#8B3A1B', headerBg: '#8B3A1B', headerFg: '#FFFFFF', priceBg: '#F0D2BD', priceFg: '#8B3A1B' },
    sage:       { name: 'Sage Eucalyptus',   category: 'trend', bg: '#D0DBC4', accent: '#3D5A3D', headerBg: '#3D5A3D', headerFg: '#FFFFFF', priceBg: '#D0DBC4', priceFg: '#3D5A3D' },
    vanilla:    { name: 'Vanilla Cream',     category: 'trend', bg: '#F5E8D0', accent: '#6B4E2F', headerBg: '#6B4E2F', headerFg: '#FFFFFF', priceBg: '#F5E8D0', priceFg: '#6B4E2F' },
    chartreuse: { name: 'Chartreuse',        category: 'trend', bg: '#E8F0B8', accent: '#4F5E0F', headerBg: '#4F5E0F', headerFg: '#FFFFFF', priceBg: '#E8F0B8', priceFg: '#4F5E0F' },
    slate:      { name: 'Slate Gold',        category: 'trend', bg: '#2A2D3A', accent: '#C9A961', headerBg: '#2A2D3A', headerFg: '#C9A961', priceBg: '#C9A961', priceFg: '#2A2D3A' },
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
    offre:     { name: 'Offre IP',          maxProducts: 500, defaultCount: 12, perPage: 14 },
    memo:      { name: 'Mémo référentiel',  maxProducts: 500, defaultCount: 20, perPage: 22 },
    focus:     { name: 'Focus produit',     maxProducts: 12,  defaultCount: 1,  perPage: 3  },
    editorial: { name: 'Editorial (Vogue)', maxProducts: 120, defaultCount: 3,  perPage: 7  },
    bento:     { name: 'Bento (Apple)',     maxProducts: 120, defaultCount: 6,  perPage: 9  },
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
      ppht: Number(b.prix_ht || 0),
      offre_ip: Number(b.offre_ip || 0),
      remise_pct: Number(b.remise_pct || 0),
      img: '',
      source: 'ip',
    };
  }

  function snapshotOffilogProduct(o) {
    const offiPrix = Number(o.prix_offilog || 0);
    const ppht = Number(o.prix_maxi || 0);
    return {
      cip13: String(o.ean || ''),     // pas de CIP13, on stocke l'EAN
      designation: String(o.produit || '').replace(/&amp;/g, '&'),
      conditionnement: '',
      prix_ht: ppht,
      ppht: ppht,
      prix_ip: offiPrix || ppht,      // par défaut prix_offilog (modifiable)
      offre_ip: 0,
      remise_pct: (ppht > 0 && offiPrix > 0) ? Math.max(0, ((ppht - offiPrix) / ppht) * 100) : 0,
      img: String(o.img || ''),
      source: 'offilog',
      marque: String(o.marque || ''),
      univers: String(o.univers || ''),
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

  function getOfflogUniverses() {
    if (!window.OFFILOG) return [];
    const set = new Set();
    window.OFFILOG.forEach(o => {
      const u = (o.univers || '').trim();
      if (u && u !== 'Non classé' && u !== '') set.add(u);
    });
    return Array.from(set).sort();
  }

  function searchOffilogProducts(q, univers) {
    if (!window.OFFILOG) return [];
    const needle = (q || '').toLowerCase().trim();
    const uniFilter = univers && univers !== 'all';
    let list = window.OFFILOG;
    if (needle.length < 2 && !uniFilter) return [];
    if (uniFilter) list = list.filter(o => (o.univers || '') === univers);
    if (needle) {
      list = list.filter(o =>
        (o.produit_norm || '').includes(needle) ||
        (o.marque || '').toLowerCase().includes(needle) ||
        String(o.ean || '').includes(needle)
      );
    }
    // Priorité : produits avec image + dans offilog
    list = list.slice().sort((a, b) => {
      const sa = (a.img ? 2 : 0) + (a.dans_offilog ? 1 : 0);
      const sb = (b.img ? 2 : 0) + (b.dans_offilog ? 1 : 0);
      return sb - sa;
    });
    return list.slice(0, 40);
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
  let offilogSearch = '';
  let offilogUnivers = 'all';
  let statsFamille = 'top';  // 'top' | 'Froid' | 'Biosimilaires' | 'Génériques' | 'Gén. partenaires' | 'Non remboursés' | 'Princeps'
  let statsTranche = 'all';  // 'all' | 'petit' (≤4.33€) | 'inter' (4.33-468€) | 'haut' (>468€)
  let sagittaStatus = 'all'; // 'all' | 'ip_win' | 'ip_lose' | 'no_ip'
  let sagittaSearch = '';
  let selectedSheetIds = new Set();  // selection multi-fiches pour export PDF combine

  // ── TOP VENTES OPS+CPR+HP par famille IP ───────────────────────────────
  // Fusion des 3 etablissements par artcode, classement par famille IP.
  // Permet a Will de voir ce qui cartonne dans le marche pharma (pas que
  // chez ses pharmas) pour choisir des produits a mettre en fiche marketing.
  function familleFromAttrsLocal(nature, afmcode, sousfamille) {
    var n = (nature || '').trim();
    var a = (afmcode || '').trim().toUpperCase();
    var sf = (sousfamille || '').toLowerCase();
    if (n === 'Biosimilaire') return 'Biosimilaires';
    if (sf.indexOf('froid') >= 0) return 'Froid';
    if (a && a !== 'REMBSS' && a !== '#N/A') return 'Non remboursés';
    if (n === 'Generique Partenaire') return 'Gén. partenaires';
    if (n === 'Generique') return 'Génériques';
    return 'Princeps';
  }
  var FAMILLES_IP = ['Froid', 'Biosimilaires', 'Génériques', 'Gén. partenaires', 'Non remboursés', 'Princeps'];
  var FAMILLE_TINTS = {
    'Froid': '#00B5D8', 'Biosimilaires': '#7C3AED', 'Génériques': '#94A3B8',
    'Gén. partenaires': '#14B86A', 'Non remboursés': '#FF9F1C', 'Princeps': '#0057FF',
  };
  var __topVentesCache = null;
  function computeTopVentesOpsCprHp() {
    if (__topVentesCache) return __topVentesCache;
    var ops = window.OPS_AGGREGATE || {};
    var cpr = window.CPR_AGGREGATE || {};
    var hp  = window.HP_AGGREGATE  || {};
    var fused = new Map();
    function add(src) {
      for (var code in src) {
        var p = src[code];
        var ca = p.ca || 0;
        var qte = p.qte || 0;
        var existing = fused.get(code);
        if (!existing) {
          existing = {
            artcode: code, ean: p.ean, designation: p.designation,
            marque: p.marque, nature: p.nature, sousfamille: p.sousfamille,
            collection: p.collection, afmcode: p.afmcode, ca: 0, qte: 0,
          };
          fused.set(code, existing);
        }
        existing.ca += ca;
        existing.qte += qte;
      }
    }
    add(ops); add(cpr); add(hp);
    var byFam = { 'Froid': [], 'Biosimilaires': [], 'Génériques': [],
                  'Gén. partenaires': [], 'Non remboursés': [], 'Princeps': [] };
    var all = [];
    fused.forEach(function (prod) {
      var fam = familleFromAttrsLocal(prod.nature, prod.afmcode, prod.sousfamille);
      prod.famille = fam;
      // Prix unitaire moyen secteur (ca/qte) -> permet classification tranche IP
      prod.prixUnit = prod.qte > 0 ? prod.ca / prod.qte : 0;
      // Tranches officielles IP : 'petit' <= 4.33 EUR · 'inter' 4.33-468 EUR · 'haut' >468 EUR
      prod.tranche = prod.prixUnit <= 4.33 ? 'petit' : (prod.prixUnit <= 468 ? 'inter' : 'haut');
      byFam[fam].push(prod);
      all.push(prod);
    });
    var sortFn = function (a, b) { return b.ca - a.ca; };
    for (var f in byFam) byFam[f].sort(sortFn);
    all.sort(sortFn);
    __topVentesCache = { byFamille: byFam, top: all };
    return __topVentesCache;
  }
  // Filtre tranche prix sur une liste pre-triee (preserve l'ordre CA)
  function filterByTranche(list, tranche) {
    if (!tranche || tranche === 'all') return list;
    return list.filter(function (p) { return p.tranche === tranche; });
  }

  // Ajoute un produit a la fiche en cours (ou cree une nouvelle fiche custom)
  // depuis la section stats. Va chercher le prix dans CATALOGUE_IP/BENCHMARK
  // si dispo, sinon laisse vide (Will renseignera manuellement).
  window.mkAddProductFromStats = function (artcode) {
    var ventes = computeTopVentesOpsCprHp();
    var prod = ventes.top.find(function (p) { return p.artcode === artcode; });
    if (!prod) return;
    // Cherche prix dans BENCHMARK
    var bench = (window.BENCHMARK || []).find(function (b) {
      return b.cip13 === prod.artcode || b.artcode === prod.artcode;
    });
    var snap = {
      artcode: prod.artcode,
      cip13: prod.ean || prod.artcode,
      ean: prod.ean,
      designation: prod.designation,
      marque: prod.marque,
      sousfamille: prod.sousfamille,
      atc2: bench ? bench.atc2 : '',
      ppht: bench ? bench.prix_ht : null,
      prix_ht: bench ? bench.prix_ht : null,
      prix_ip: bench ? bench.prix_ip : null,
      remise_pct: bench ? bench.remise_pct : null,
      offre_ip: bench ? bench.offre_ip : null,
      froid: bench ? bench.froid : prod.famille === 'Froid',
    };
    if (!editingSheet) {
      // Pas d'edition en cours -> cree une fiche custom et arrive sur l'editeur
      editingSheet = newSheet('custom');
      editingSheet.title = 'Fiche depuis top ventes';
      editingSheet.products = [snap];
    } else {
      var cap = TEMPLATES[getTemplateId(editingSheet)].maxProducts;
      if (editingSheet.products.length >= cap) {
        if (typeof window.showToast === 'function') {
          window.showToast('Limite ' + cap + ' produits atteinte pour ce template', 'info');
        }
        return;
      }
      if (editingSheet.products.find(function (p) { return p.artcode === artcode || p.cip13 === snap.cip13; })) return;
      editingSheet.products.push(snap);
    }
    renderEdit();
  };
  window.mkSetStatsFamille = function (id) {
    statsFamille = id;
    window.renderMarketing();
  };
  window.mkSetStatsTranche = function (id) {
    statsTranche = id;
    window.renderMarketing();
  };

  // ── OFFRES IP OFFICIELLES (depuis marketing-offers.js) ─────────────────
  function getIpOffers() {
    return Array.isArray(window.MARKETING_IP_OFFERS) ? window.MARKETING_IP_OFFERS : [];
  }
  window.mkStartFromOffer = function (offerId) {
    const offer = getIpOffers().find(o => o.id === offerId);
    if (!offer) return;
    // Pre-rempli newSheet avec les produits officiels
    editingSheet = {
      id: 'mk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: offer.title,
      theme: 'custom',
      color: offer.color || 'navy',
      footer: offer.footer || 'Tarif en vigueur 2026',
      template: offer.template || 'offre',
      products: (offer.products || []).slice(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    renderEdit();
  };

  window.renderMarketing = function () {
    const root = getRoot();
    if (!root) return;
    const sheets = loadSheets();
    const suggested = getCurrentSeasonTheme();
    const ipOffers = getIpOffers();

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

        ${ipOffers.length ? `
        <div class="mk-section mk-section-ip">
          <div class="mk-section-head">
            <div>
              <div class="mk-section-title">Offres IP officielles 2026</div>
              <div class="mk-section-sub">Fiches commerciales pré-remplies — clic = duplicate + édite</div>
            </div>
          </div>
          <div class="mk-ip-offers">
            ${ipOffers.map(o => {
              const cp = COLOR_PRESETS[o.color] || COLOR_PRESETS.navy;
              const n = (o.products || []).length;
              return `
                <button class="mk-ip-card" style="background:${cp.bg};color:${cp.accent}" onclick="window.mkStartFromOffer('${o.id}')">
                  <div class="mk-ip-card-eyebrow" style="color:${cp.headerBg}">OFFRE IP</div>
                  <div class="mk-ip-card-title">${escapeAttr(o.title.replace(/^OFFRE IP[\\s—-]*/i, ''))}</div>
                  <div class="mk-ip-card-sub">${escapeAttr(o.subtitle || '')}</div>
                  <div class="mk-ip-card-meta">${n} produit${n>1?'s':''} · ${escapeAttr(o.template)}</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}

        ${(window.OPS_AGGREGATE || window.CPR_AGGREGATE || window.HP_AGGREGATE) ? (function() {
          const ventes = computeTopVentesOpsCprHp();
          const famillePills = ['top'].concat(FAMILLES_IP);
          const tranchePills = [
            { id: 'all',   label: 'Toutes tranches',           sub: '' },
            { id: 'petit', label: 'Petit prix',                sub: '≤ 4,33 €' },
            { id: 'inter', label: 'Intermédiaire',             sub: '4,33 – 468 €' },
            { id: 'haut',  label: 'Haut prix',                 sub: '> 468 €' },
          ];
          const baseList = statsFamille === 'top' ? ventes.top : (ventes.byFamille[statsFamille] || []);
          const list = filterByTranche(baseList, statsTranche);
          const top100 = list.slice(0, 100);
          const totalCa = top100.reduce(function (s, p) { return s + p.ca; }, 0);
          return `
            <div class="mk-section mk-section-stats">
              <div class="mk-section-head">
                <div>
                  <div class="mk-section-title">📊 Top ventes secteur OPS + CPR + HP</div>
                  <div class="mk-section-sub">Choisis les produits qui cartonnent dans le marché pharma · click <b>+</b> pour ajouter à la fiche</div>
                </div>
              </div>
              <div class="mk-stats-filters-label">Famille IP</div>
              <div class="mk-stats-pills">
                ${famillePills.map(p => `
                  <button class="mk-stats-pill ${statsFamille===p?'on':''}"
                    style="${statsFamille===p && p!=='top' ? 'background:'+FAMILLE_TINTS[p]+';color:#fff;border-color:'+FAMILLE_TINTS[p]+';' : ''}"
                    onclick="window.mkSetStatsFamille('${p}')">${p === 'top' ? '⭐ Top global' : escapeAttr(p)}</button>
                `).join('')}
              </div>
              <div class="mk-stats-filters-label">Tranche prix IP <span class="mk-stats-filters-hint">· tarification officielle</span></div>
              <div class="mk-stats-pills mk-stats-pills-tranches">
                ${tranchePills.map(t => `
                  <button class="mk-stats-pill mk-stats-pill-tranche ${statsTranche===t.id?'on':''}"
                    onclick="window.mkSetStatsTranche('${t.id}')">
                    <span>${escapeAttr(t.label)}</span>
                    ${t.sub ? `<span class="mk-stats-pill-sub">${escapeAttr(t.sub)}</span>` : ''}
                  </button>
                `).join('')}
              </div>
              <div class="mk-stats-list mk-stats-list-scroll">
                ${top100.map((p, i) => {
                  const famColor = FAMILLE_TINTS[p.famille] || '#0057FF';
                  const trancheLabel = p.tranche === 'petit' ? '≤ 4,33€' : p.tranche === 'inter' ? '4,33 – 468€' : '> 468€';
                  return `
                    <div class="mk-stats-row">
                      <div class="mk-stats-rank" style="background:${famColor}">${i + 1}</div>
                      <div class="mk-stats-info">
                        <div class="mk-stats-name">${escapeAttr(p.designation)}</div>
                        <div class="mk-stats-meta">
                          <span style="color:${famColor};font-weight:700">${escapeAttr(p.famille)}</span>
                          <span>· ${escapeAttr(p.marque || '—')}</span>
                          <span>· CIP ${escapeAttr(p.artcode)}</span>
                          <span class="mk-stats-tranche-chip">${trancheLabel} · PU ${eur(p.prixUnit)}</span>
                        </div>
                      </div>
                      <div class="mk-stats-kpi">
                        <div class="mk-stats-ca">${eur(p.ca)}</div>
                        <div class="mk-stats-qte">${(p.qte || 0).toLocaleString('fr-FR')} u</div>
                      </div>
                      <button class="mk-stats-add" onclick="window.mkAddProductFromStats('${escapeAttr(p.artcode)}')" title="Ajouter à une fiche">+</button>
                    </div>
                  `;
                }).join('')}
                ${list.length === 0 ? `<div class="mk-empty" style="padding:20px;text-align:center;color:#8E8E93">Aucune vente dans cette combinaison famille / tranche</div>` : ''}
              </div>
              <div class="mk-stats-footer">${top100.length} produits affichés sur ${list.length} · CA secteur cumulé top 100 : <b>${eur(totalCa)}</b></div>
            </div>
          `;
        })() : `
          <div class="mk-section mk-section-stats">
            <div class="mk-section-head">
              <div>
                <div class="mk-section-title">📊 Top ventes secteur OPS + CPR + HP</div>
                <div class="mk-section-sub">Chargement des données ventes…</div>
              </div>
            </div>
          </div>
        `}

        ${renderSagittaCompareSection()}

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
                const checked = selectedSheetIds.has(s.id);
                return `
                  <div class="mk-lib-card ${checked ? 'is-selected' : ''}">
                    <label class="mk-lib-checkbox" title="Sélectionner pour export combiné">
                      <input type="checkbox" ${checked ? 'checked' : ''}
                        onclick="event.stopPropagation();window.mkToggleSelectSheet('${s.id}')" />
                      <span class="mk-lib-checkbox-box"></span>
                    </label>
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
            ${selectedSheetIds.size > 0 ? `
              <div class="mk-multi-bar" role="region" aria-label="Sélection multiple">
                <div class="mk-multi-bar-count">
                  <b>${selectedSheetIds.size}</b> fiche${selectedSheetIds.size>1?'s':''} sélectionnée${selectedSheetIds.size>1?'s':''}
                </div>
                <div class="mk-multi-bar-actions">
                  <button class="mk-btn mk-btn-ghost" onclick="window.mkClearSelection()">Désélectionner</button>
                  <button class="mk-btn mk-btn-primary" onclick="window.mkExportSelected()">
                    ⬇ Télécharger PDF combiné (${selectedSheetIds.size} page${selectedSheetIds.size>1?'s':''})
                  </button>
                </div>
              </div>
            ` : ''}
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

  // ─── Selection multiple fiches pour export PDF combine ────────────────
  window.mkToggleSelectSheet = function (id) {
    if (selectedSheetIds.has(id)) selectedSheetIds.delete(id);
    else selectedSheetIds.add(id);
    window.renderMarketing();
  };
  window.mkClearSelection = function () {
    selectedSheetIds.clear();
    window.renderMarketing();
  };
  // Export multi-fiches en 1 seul PDF (page-break entre chaque fiche)
  window.mkExportSelected = async function () {
    const sheets = loadSheets().filter(s => selectedSheetIds.has(s.id));
    if (!sheets.length) return;

    // Lazy-load html2pdf si pas encore charge
    if (!window.html2pdf) {
      if (typeof window.ensureHtml2Pdf === 'function') {
        try { await window.ensureHtml2Pdf(); } catch (e) {}
      }
      if (!window.html2pdf) {
        alert('Lib html2pdf non chargée. Vérifie ta connexion internet.');
        return;
      }
    }

    // Container offscreen avec toutes les fiches separees par page-break
    const wrap = document.createElement('div');
    wrap.id = 'mk-multi-pdf-wrap';
    wrap.style.cssText = 'position:fixed;top:-99999px;left:0;width:794px;background:#FFFFFF;font-family:"DM Sans",sans-serif';

    ensurePdfFontStyle();

    sheets.forEach((sheet, i) => {
      const page = document.createElement('div');
      page.className = 'mk-multi-pdf-page';
      page.style.cssText = (i > 0 ? 'page-break-before:always;break-before:page;' : '');
      page.innerHTML = renderSheetHTML(sheet, 'mk-pdf-target-multi-' + i);
      wrap.appendChild(page);
    });

    document.body.appendChild(wrap);

    // Laisse aux fonts le temps de se charger
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    await new Promise(r => setTimeout(r, 300));

    const filename = 'IP_Fiches_' + sheets.length + 'pages_' + new Date().toISOString().slice(0, 10) + '.pdf';

    try {
      await window.html2pdf().set({
        margin: 0,
        filename: filename,
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: {
          scale: 3, useCORS: true, letterRendering: true,
          logging: false, allowTaint: false, backgroundColor: '#FFFFFF'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        pagebreak: { mode: ['css', 'legacy'] }
      }).from(wrap).save();
    } catch (e) {
      console.warn('[mkExportSelected]', e);
      alert('Erreur lors de la génération du PDF combiné.');
    } finally {
      wrap.remove();
    }
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
              <div class="mk-color-group">
                <div class="mk-color-group-label">Classiques IP</div>
                <div class="mk-color-row">
                  ${Object.entries(COLOR_PRESETS).filter(([,v]) => v.category === 'classic').map(([k,v]) => `
                    <button class="mk-color ${s.color===k?'on':''}" title="${v.name}"
                      style="background:${v.bg};border-color:${v.accent}"
                      onclick="window.mkUpdateColor('${k}')"></button>
                  `).join('')}
                </div>
              </div>
              <div class="mk-color-group">
                <div class="mk-color-group-label">Tendances 2026–2027 <span class="mk-color-badge">NEW</span></div>
                <div class="mk-color-row">
                  ${Object.entries(COLOR_PRESETS).filter(([,v]) => v.category === 'trend').map(([k,v]) => `
                    <button class="mk-color ${s.color===k?'on':''}" title="${v.name}"
                      style="background:${v.bg};border-color:${v.accent}"
                      onclick="window.mkUpdateColor('${k}')"></button>
                  `).join('')}
                </div>
              </div>
              <label class="mk-label" style="margin-top:14px">Template</label>
              <select class="mk-input mk-select" id="sheet-template" onchange="window.mkUpdateTemplate(this.value)">
                <option value="offre" ${getTemplateId(s)==='offre'?'selected':''}>Offre IP (table)</option>
                <option value="memo" ${getTemplateId(s)==='memo'?'selected':''}>Mémo référentiel</option>
                <option value="focus" ${getTemplateId(s)==='focus'?'selected':''}>Focus produit</option>
                <option value="editorial" ${getTemplateId(s)==='editorial'?'selected':''}>📰 Editorial (Vogue)</option>
                <option value="bento" ${getTemplateId(s)==='bento'?'selected':''}>🍱 Bento (Apple)</option>
              </select>
              <div class="mk-template-hint">${TEMPLATES[getTemplateId(s)].name} · ${s.products.length} produit${s.products.length>1?'s':''} · PDF multi-pages auto</div>
              <label class="mk-label" style="margin-top:14px">Footer</label>
              <input class="mk-input" id="mk-footer" value="${escapeAttr(s.footer)}" oninput="window.mkUpdateFooter(this.value)" />
            </div>

            <!-- ═══ DESIGN SYSTEM 2026-2027 ═══ -->
            <div class="mk-card mk-card-ds">
              <div class="mk-card-title">✨ Design Pinterest 2026-2027</div>

              <label class="mk-label">Look prédéfini</label>
              <div class="mk-ds-presets">
                ${Object.entries(window.MK_DESIGN_PRESETS || {}).map(([id, p]) => `
                  <button class="mk-ds-preset" onclick="window.mkApplyDesignPreset('${id}')">${escapeAttr(p.name)}</button>
                `).join('')}
              </div>

              <label class="mk-label" style="margin-top:14px">Gradient mesh</label>
              <div class="mk-ds-grad-row">
                ${Object.entries(window.MK_GRADIENTS || {}).map(([id, g]) => `
                  <button class="mk-ds-grad ${(s.gradient || 'none') === id ? 'on' : ''}" title="${escapeAttr(g.name)}"
                    style="background:${g.preview || '#F2F2F7'}"
                    onclick="window.mkUpdateGradient('${id}')"></button>
                `).join('')}
              </div>

              <label class="mk-label" style="margin-top:14px">Typographie</label>
              <select class="mk-input mk-select" onchange="window.mkUpdateFontPair(this.value)">
                ${Object.entries(window.MK_FONT_PAIRS || {}).map(([id, f]) => `
                  <option value="${id}" ${(s.fontPair || 'default') === id ? 'selected' : ''}>${escapeAttr(f.name)}</option>
                `).join('')}
              </select>

              <label class="mk-label" style="margin-top:14px">Pattern (texture)</label>
              <div class="mk-ds-pat-row">
                ${Object.entries(window.MK_PATTERNS || {}).map(([id, p]) => `
                  <button class="mk-ds-pat ${(s.pattern || 'none') === id ? 'on' : ''}" title="${escapeAttr(p.name)}"
                    style="background-image:${p.css || 'none'};background-color:#F2F2F7"
                    onclick="window.mkUpdatePattern('${id}')">${id === 'none' ? '∅' : ''}</button>
                `).join('')}
              </div>

              <label class="mk-label" style="margin-top:14px">Sticker / badge</label>
              <div class="mk-ds-stk-row">
                ${Object.entries(window.MK_STICKERS || {}).map(([id, st]) => `
                  <button class="mk-ds-stk ${(s.sticker || 'none') === id ? 'on' : ''}" title="${escapeAttr(st.name)}"
                    onclick="window.mkUpdateSticker('${id}')">${st.svg || '<span class="mk-ds-none">∅</span>'}</button>
                `).join('')}
              </div>
            </div>

            <div class="mk-card">
              <div class="mk-card-title">Catalogue IP <span class="mk-card-sub">médicaments · CIP</span></div>
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

            ${renderOffilogPanel(s)}
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
                        <div class="mk-sel-name" contenteditable="true"
                          oninput="window.mkUpdateProduct(${i},'designation',this.textContent)"
                          title="Cliquer pour modifier le nom">${escapeAttr(p.designation || '')}</div>
                        <div class="mk-sel-meta">${cipFormat(p.cip13)}</div>
                      </div>
                      <div class="mk-sel-prices">
                        <div class="mk-sel-price-field">
                          <label>PPHT</label>
                          <input type="number" step="0.01" min="0" class="mk-input mk-price-input"
                            value="${p.ppht != null ? p.ppht : ''}"
                            oninput="window.mkUpdateProduct(${i},'ppht',this.value)"
                            placeholder="—" />
                        </div>
                        <div class="mk-sel-price-field mk-sel-price-ip">
                          <label>Prix IP</label>
                          <input type="number" step="0.01" min="0" class="mk-input mk-price-input mk-price-input-ip"
                            value="${p.prix_ip != null ? p.prix_ip : ''}"
                            oninput="window.mkUpdateProduct(${i},'prix_ip',this.value)"
                            placeholder="—" />
                        </div>
                      </div>
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

  // ── COMPARATIF SAGITTA NR / LNR vs IP ───────────────────────
  function buildSagittaIndex() {
    // Map CIP13 -> { prix_ip, designation, source }
    const ix = new Map();
    if (window.CATALOGUE_IP) {
      window.CATALOGUE_IP.forEach(c => {
        if (c.ean && c.prix_ip > 0) {
          ix.set(String(c.ean), {
            prix_ip: Number(c.prix_ip),
            prix_ht: Number(c.prix_ht || 0),
            designation: c.nom || '',
            categorie: c.categorie || '',
            source: 'catalogue',
          });
        }
      });
    }
    if (window.BENCHMARK) {
      window.BENCHMARK.forEach(b => {
        if (b.cip13 && b.prix_ip > 0 && !ix.has(String(b.cip13))) {
          ix.set(String(b.cip13), {
            prix_ip: Number(b.prix_ip),
            prix_ht: Number(b.prix_ht || 0),
            designation: b.designation || '',
            categorie: b.categorie || '',
            source: 'benchmark',
          });
        }
      });
    }
    return ix;
  }

  function buildOffilogImageIndex() {
    // Map EAN -> img URL pour visuels Sagitta
    const ix = new Map();
    if (window.OFFILOG) {
      window.OFFILOG.forEach(o => {
        if (o.ean && o.img) ix.set(String(o.ean), o.img);
      });
    }
    return ix;
  }

  function computeSagittaCompare() {
    if (!window.SAGITTA_SHORTLIST) return null;
    const ipIdx = buildSagittaIndex();
    const imgIdx = buildOffilogImageIndex();
    const list = window.SAGITTA_SHORTLIST.map(p => {
      const ip = ipIdx.get(String(p.cip13));
      const img = imgIdx.get(String(p.cip13)) || '';
      const prix_ip = ip ? ip.prix_ip : null;
      const ecart_eur = (prix_ip != null && p.prix_sagitta != null) ? (prix_ip - p.prix_sagitta) : null;
      const ecart_pct = (prix_ip != null && p.prix_sagitta != null && p.prix_sagitta > 0)
        ? ((prix_ip - p.prix_sagitta) / p.prix_sagitta) * 100 : null;
      let status;
      if (!ip) status = 'no_ip';
      else if (ecart_eur == null) status = 'no_ip';
      else if (ecart_eur < -0.05) status = 'ip_win';    // IP moins cher
      else if (ecart_eur > 0.05) status = 'ip_lose';    // IP plus cher
      else status = 'tie';
      return Object.assign({}, p, {
        prix_ip: prix_ip,
        prix_ip_ht: ip ? ip.prix_ht : null,
        designation_ip: ip ? ip.designation : '',
        categorie_ip: ip ? ip.categorie : '',
        ecart_eur: ecart_eur,
        ecart_pct: ecart_pct,
        status: status,
        img: img,
      });
    });
    // Tri : IP gagnant (plus gros ecart négatif) puis tie puis no_ip puis ip_lose
    const order = { ip_win: 0, tie: 1, no_ip: 2, ip_lose: 3 };
    list.sort((a, b) => {
      const oa = order[a.status], ob = order[b.status];
      if (oa !== ob) return oa - ob;
      if (a.status === 'ip_win' || a.status === 'ip_lose') {
        return (Math.abs(b.ecart_eur || 0) - Math.abs(a.ecart_eur || 0));
      }
      return 0;
    });
    // Stats globales
    const stats = {
      total: list.length,
      ip_win: list.filter(p => p.status === 'ip_win').length,
      tie: list.filter(p => p.status === 'tie').length,
      ip_lose: list.filter(p => p.status === 'ip_lose').length,
      no_ip: list.filter(p => p.status === 'no_ip').length,
      gain_moyen: 0,
    };
    const wins = list.filter(p => p.status === 'ip_win' && p.ecart_pct != null);
    if (wins.length) {
      stats.gain_moyen = wins.reduce((s, p) => s + Math.abs(p.ecart_pct), 0) / wins.length;
    }
    return { list, stats };
  }

  function renderSagittaCompareSection() {
    if (!window.SAGITTA_SHORTLIST) {
      return `
        <div class="mk-section mk-section-sagitta">
          <div class="mk-section-head">
            <div>
              <div class="mk-section-title">⚔️ Comparatif Sagitta SHORTLIST NR · IP</div>
              <div class="mk-section-sub">Chargement…</div>
            </div>
          </div>
        </div>
      `;
    }
    const data = computeSagittaCompare();
    if (!data) return '';
    const filters = [
      { id: 'all',     label: 'Tous',          count: data.stats.total,   tone: 'neutral' },
      { id: 'ip_win',  label: 'IP gagnant',    count: data.stats.ip_win,  tone: 'win' },
      { id: 'ip_lose', label: 'IP plus cher',  count: data.stats.ip_lose, tone: 'lose' },
      { id: 'no_ip',   label: 'Pas chez IP',   count: data.stats.no_ip,   tone: 'gray' },
    ];
    let list = data.list;
    if (sagittaStatus !== 'all') list = list.filter(p => p.status === sagittaStatus);
    if (sagittaSearch) {
      const q = sagittaSearch.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.labo || '').toLowerCase().includes(q) ||
        (p.cip13 || '').includes(q)
      );
    }
    const top = list.slice(0, 80);
    const statusBadge = (s) => {
      if (s === 'ip_win') return '<span class="mk-sag-badge mk-sag-win">✓ IP gagnant</span>';
      if (s === 'ip_lose') return '<span class="mk-sag-badge mk-sag-lose">⚠ IP + cher</span>';
      if (s === 'tie') return '<span class="mk-sag-badge mk-sag-tie">= Égalité</span>';
      return '<span class="mk-sag-badge mk-sag-no">— Pas réf.</span>';
    };
    return `
      <div class="mk-section mk-section-sagitta">
        <div class="mk-section-head">
          <div>
            <div class="mk-section-title">⚔️ Comparatif Sagitta SHORTLIST NR · IP</div>
            <div class="mk-section-sub">Mes prix IP face à la SHORT LIST NR-LNR Sagitta (Pharmarem · La Centrale Pharma)</div>
          </div>
        </div>

        <div class="mk-sag-stats-grid">
          <div class="mk-sag-stat mk-sag-stat-win">
            <div class="mk-sag-stat-num">${data.stats.ip_win}</div>
            <div class="mk-sag-stat-lbl">IP moins cher</div>
            <div class="mk-sag-stat-sub">${data.stats.gain_moyen.toFixed(1)}% d'écart moyen</div>
          </div>
          <div class="mk-sag-stat mk-sag-stat-tie">
            <div class="mk-sag-stat-num">${data.stats.tie}</div>
            <div class="mk-sag-stat-lbl">Égalité</div>
            <div class="mk-sag-stat-sub">±0,05 € près</div>
          </div>
          <div class="mk-sag-stat mk-sag-stat-lose">
            <div class="mk-sag-stat-num">${data.stats.ip_lose}</div>
            <div class="mk-sag-stat-lbl">Sagitta moins cher</div>
            <div class="mk-sag-stat-sub">à argumenter</div>
          </div>
          <div class="mk-sag-stat mk-sag-stat-no">
            <div class="mk-sag-stat-num">${data.stats.no_ip}</div>
            <div class="mk-sag-stat-lbl">Non référencés IP</div>
            <div class="mk-sag-stat-sub">opportunité</div>
          </div>
        </div>

        <div class="mk-sag-controls">
          <input class="mk-input mk-sag-search" placeholder="Rechercher produit, labo, CIP…"
            value="${escapeAttr(sagittaSearch)}"
            oninput="window.mkSetSagittaSearch(this.value)" />
          <div class="mk-sag-filters">
            ${filters.map(f => `
              <button class="mk-sag-pill mk-sag-pill-${f.tone} ${sagittaStatus===f.id?'on':''}"
                onclick="window.mkSetSagittaStatus('${f.id}')">${escapeAttr(f.label)} <span class="mk-sag-pill-count">${f.count}</span></button>
            `).join('')}
          </div>
        </div>

        <div class="mk-sag-list">
          ${top.length === 0 ? '<div class="mk-empty-search">Aucun résultat avec ce filtre.</div>' : top.map(p => {
            const ip = p.prix_ip != null ? eur(p.prix_ip) : '—';
            const sag = p.prix_sagitta != null ? eur(p.prix_sagitta) : '—';
            const ecart = p.ecart_eur != null
              ? `${p.ecart_eur > 0 ? '+' : ''}${p.ecart_eur.toFixed(2).replace('.', ',')} €${p.ecart_pct != null ? ` · ${p.ecart_pct > 0 ? '+' : ''}${p.ecart_pct.toFixed(1).replace('.', ',')}%` : ''}`
              : '—';
            const ecartCls = p.status === 'ip_win' ? 'mk-sag-ecart-win' : (p.status === 'ip_lose' ? 'mk-sag-ecart-lose' : '');
            return `
              <div class="mk-sag-row mk-sag-row-${p.status}">
                <div class="mk-sag-thumb">
                  ${p.img ? `<img src="${escapeAttr(p.img)}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : '<span class="mk-sag-ph">💊</span>'}
                </div>
                <div class="mk-sag-info">
                  <div class="mk-sag-name">${escapeAttr(p.name)}</div>
                  <div class="mk-sag-meta">
                    <span>${escapeAttr(p.labo || '—')}</span>
                    <span>· CIP ${escapeAttr(p.cip13)}</span>
                    ${p.categorie ? `<span>· ${escapeAttr(p.categorie)}</span>` : ''}
                  </div>
                  ${statusBadge(p.status)}
                </div>
                <div class="mk-sag-prices">
                  <div class="mk-sag-price-block">
                    <div class="mk-sag-price-lbl">Sagitta</div>
                    <div class="mk-sag-price-val">${sag}</div>
                    ${p.prix_barre ? `<div class="mk-sag-price-old">${eur(p.prix_barre)}</div>` : ''}
                    ${p.remise_pct ? `<div class="mk-sag-price-pct">−${p.remise_pct}%</div>` : ''}
                  </div>
                  <div class="mk-sag-price-block mk-sag-price-ip">
                    <div class="mk-sag-price-lbl">IP</div>
                    <div class="mk-sag-price-val">${ip}</div>
                  </div>
                  <div class="mk-sag-ecart ${ecartCls}">${ecart}</div>
                </div>
                ${p.prix_ip != null ? `<button class="mk-sag-add" title="Ajouter à une fiche" onclick="window.mkAddSagittaProduct('${escapeAttr(p.cip13)}')">+</button>` : '<div class="mk-sag-add mk-sag-add-disabled" title="Pas chez IP">·</div>'}
              </div>
            `;
          }).join('')}
        </div>
        ${list.length > 80 ? `<div class="mk-sag-footer">Affichage limité à 80 sur ${list.length} résultats — affine ta recherche</div>` : `<div class="mk-sag-footer">${list.length} produit${list.length>1?'s':''} affiché${list.length>1?'s':''}</div>`}
      </div>
    `;
  }

  window.mkSetSagittaStatus = function (s) { sagittaStatus = s; renderEdit(); };
  window.mkSetSagittaSearch = function (q) {
    sagittaSearch = q;
    renderEdit();
    const el = (getRoot() || document).querySelector('input.mk-sag-search');
    if (el) { el.focus(); el.setSelectionRange(q.length, q.length); }
  };
  window.mkAddSagittaProduct = function (cip) {
    // Ajoute à la fiche en édition (si présente) sinon prompt création
    if (!editingSheet) {
      if (typeof window.showToast === 'function') {
        window.showToast('Ouvre ou crée d\'abord une fiche pour ajouter ce produit', 'info');
      }
      return;
    }
    if (editingSheet.products.find(p => p.cip13 === cip)) {
      if (typeof window.showToast === 'function') window.showToast('Déjà dans la fiche', 'info');
      return;
    }
    // Cherche dans BENCHMARK d'abord (pour snapshot complet)
    let snap = null;
    if (window.BENCHMARK) {
      const b = window.BENCHMARK.find(x => String(x.cip13) === String(cip));
      if (b) snap = snapshotProduct(b);
    }
    if (!snap && window.CATALOGUE_IP) {
      const c = window.CATALOGUE_IP.find(x => String(x.ean) === String(cip));
      if (c) snap = {
        cip13: c.ean,
        designation: c.nom || '',
        conditionnement: '',
        prix_ht: Number(c.prix_ht || 0),
        ppht: Number(c.prix_ht || 0),
        prix_ip: Number(c.prix_ip || 0),
        offre_ip: 0,
        remise_pct: Number(c.remise_pct || 0),
        img: '', source: 'ip',
      };
    }
    if (!snap) {
      if (typeof window.showToast === 'function') window.showToast('Produit introuvable dans catalogue IP', 'error');
      return;
    }
    // Récupère image OFFILOG si dispo
    if (window.OFFILOG) {
      const o = window.OFFILOG.find(x => String(x.ean) === String(cip));
      if (o && o.img) snap.img = o.img;
    }
    editingSheet.products.push(snap);
    if (typeof window.showToast === 'function') window.showToast('Ajouté à la fiche ✓', 'success');
    renderEdit();
  };

  // ── PANEL OFFILOG (parapharmacie + images) ──────────────────
  function renderOffilogPanel(s) {
    if (!window.OFFILOG) {
      return `
        <div class="mk-card mk-card-offilog">
          <div class="mk-card-title">Catalogue OFFILOG <span class="mk-card-sub">parapharmacie · images</span></div>
          <div class="mk-empty-search">Chargement du catalogue OFFILOG…</div>
        </div>
      `;
    }
    const results = searchOffilogProducts(offilogSearch, offilogUnivers);
    const selectedEans = new Set((s.products || []).filter(p => p.source === 'offilog').map(p => p.cip13));
    const universes = getOfflogUniverses();
    return `
      <div class="mk-card mk-card-offilog">
        <div class="mk-card-title">Catalogue OFFILOG <span class="mk-card-sub">parapharmacie · images</span></div>
        <input class="mk-input" placeholder="Rechercher (nom, marque, EAN)…"
          value="${escapeAttr(offilogSearch)}"
          oninput="window.mkSetOffilogSearch(this.value)" />
        <div class="mk-off-filters">
          <button class="mk-off-pill ${offilogUnivers==='all'?'on':''}" onclick="window.mkSetOffilogUnivers('all')">Tous univers</button>
          ${universes.slice(0, 8).map(u => `
            <button class="mk-off-pill ${offilogUnivers===u?'on':''}" onclick="window.mkSetOffilogUnivers('${escapeAttr(u).replace(/'/g, '&#39;')}')">${escapeAttr(u)}</button>
          `).join('')}
        </div>
        ${results.length > 0 ? `
          <div class="mk-off-grid">
            ${results.map(o => {
              const isSel = selectedEans.has(String(o.ean));
              const prix = o.prix_offilog ? eur(o.prix_offilog) : '—';
              const prixMax = o.prix_maxi ? eur(o.prix_maxi) : '';
              const name = (o.produit || '').replace(/&amp;/g, '&');
              const img = o.img ? `<img src="${escapeAttr(o.img)}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.classList.add('mk-off-noimg')"/>` : '';
              return `
                <button class="mk-off-tile ${isSel?'on':''} ${o.img?'':'mk-off-noimg'}"
                  onclick="window.mkToggleOffilogProduct('${escapeAttr(String(o.ean))}')"
                  ${isSel?'disabled':''}
                  title="${escapeAttr(name)}">
                  <div class="mk-off-thumb">
                    ${img || '<span class="mk-off-ph">📦</span>'}
                    <div class="mk-off-badge">${isSel?'✓':'+'}</div>
                  </div>
                  <div class="mk-off-info">
                    <div class="mk-off-marque">${escapeAttr(o.marque || '—')}</div>
                    <div class="mk-off-name">${escapeAttr(name)}</div>
                    <div class="mk-off-prices">
                      <span class="mk-off-price-off">${prix}</span>
                      ${prixMax ? `<span class="mk-off-price-max">${prixMax}</span>` : ''}
                    </div>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
          <div class="mk-off-footer">${results.length} résultat${results.length>1?'s':''} ${offilogSearch ? `· "${escapeAttr(offilogSearch)}"` : ''}</div>
        ` : (offilogSearch.length >= 2 || offilogUnivers !== 'all') ? `
          <div class="mk-empty-search">Aucun produit trouvé</div>
        ` : `
          <div class="mk-empty-search">Tape 2 lettres ou choisis un univers.</div>
        `}
      </div>
    `;
  }

  window.mkSetOffilogSearch = function (q) {
    offilogSearch = q;
    renderEdit();
    const el = (getRoot() || document).querySelector('input[placeholder^="Rechercher (nom, marque"]');
    if (el) { el.focus(); el.setSelectionRange(q.length, q.length); }
  };
  window.mkSetOffilogUnivers = function (u) {
    offilogUnivers = u;
    renderEdit();
  };
  window.mkToggleOffilogProduct = function (ean) {
    if (!editingSheet || !window.OFFILOG) return;
    if (editingSheet.products.find(p => p.source === 'offilog' && p.cip13 === ean)) return;
    const cap = TEMPLATES[getTemplateId(editingSheet)].maxProducts;
    if (editingSheet.products.length >= cap) {
      if (typeof window.showToast === 'function') {
        window.showToast('Limite atteinte : ' + cap + ' produits max', 'info');
      }
      return;
    }
    const o = window.OFFILOG.find(x => String(x.ean) === String(ean));
    if (!o) return;
    const snap = snapshotOffilogProduct(o);
    if (getTemplateId(editingSheet) === 'focus') {
      snap.accroche = '';
      snap.argument = '';
    }
    editingSheet.products.push(snap);
    renderEdit();
  };

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

  // Edition en place des champs produit (designation / ppht / prix_ip).
  // Recalcule remise_pct si ppht et prix_ip sont coherents.
  window.mkUpdateProduct = function (i, field, val) {
    if (!editingSheet || !editingSheet.products[i]) return;
    const p = editingSheet.products[i];
    if (field === 'designation') {
      p.designation = String(val || '').trim();
    } else if (field === 'ppht' || field === 'prix_ip') {
      const num = parseFloat(String(val).replace(',', '.'));
      p[field] = isNaN(num) ? null : num;
      // Recalcule la remise quand on a les 2 valeurs
      if (p.ppht > 0 && p.prix_ip > 0) {
        p.remise_pct = Math.max(0, ((p.ppht - p.prix_ip) / p.ppht) * 100);
      } else {
        p.remise_pct = null;
      }
      // Aussi expose prix_ht (alias utilise dans certains templates de rendu)
      if (field === 'ppht') p.prix_ht = p.ppht;
    }
    editingSheet.updated_at = new Date().toISOString();
    // Ne re-render PAS pour ne pas perdre le focus pendant la saisie.
    // La preview sera repeinte au prochain renderEdit (changement de selection
    // ou tap apercu) — suffit pour le flow utilisateur.
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

  // ── APERÇU PDF (modal) avec édition live ────────────────────
  function openPreview(sheet) {
    let modal = document.getElementById('mk-preview-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'mk-preview-modal';
    modal.className = 'mk-modal mk-preview-live';
    modal.innerHTML = `
      <div class="mk-modal-head">
        <div class="mk-modal-title">Aperçu — édition live</div>
        <div class="mk-modal-actions">
          <button class="mk-btn" onclick="window.mkClosePreview()">Fermer</button>
          <button class="mk-btn mk-btn-primary" onclick="window.mkDownloadFromPreview()">⬇ Télécharger PDF</button>
        </div>
      </div>
      ${renderPreviewToolbar(sheet)}
      <div class="mk-modal-body">
        <div id="mk-preview-render">${renderSheetHTML(sheet, 'mk-pdf-target')}</div>
      </div>
    `;
    document.body.appendChild(modal);
    window._mkPreviewSheet = sheet;
  }

  function refreshPreview() {
    const sheet = window._mkPreviewSheet;
    if (!sheet) return;
    const render = document.getElementById('mk-preview-render');
    if (render) render.innerHTML = renderSheetHTML(sheet, 'mk-pdf-target');
    const tb = document.getElementById('mk-preview-toolbar');
    if (tb) tb.outerHTML = renderPreviewToolbar(sheet);
  }

  function renderPreviewToolbar(sheet) {
    const tpl = getTemplateId(sheet);
    const gradients = window.MK_GRADIENTS || {};
    const fonts = window.MK_FONT_PAIRS || {};
    const stickers = window.MK_STICKERS || {};
    // Couleurs : groupées classiques + tendances
    const classics = ['navy','sky','lilac','mint','amber','rose','forest'];
    const trends   = ['dusk','teal','cherry','sienna','sage','vanilla','chartreuse','slate'];

    const swatch = (k) => {
      const cp = COLOR_PRESETS[k]; if (!cp) return '';
      const on = sheet.color === k ? ' on' : '';
      return `<button class="mk-pv-swatch${on}" title="${escapeAttr(cp.name)}" style="background:${cp.headerBg};border-color:${cp.priceBg}" onclick="window.mkPreviewSetColor('${k}')"></button>`;
    };

    const tplBtn = (k, label, emo) => {
      const on = tpl === k ? ' on' : '';
      return `<button class="mk-pv-tpl${on}" onclick="window.mkPreviewSetTemplate('${k}')"><span class="mk-pv-tpl-emo">${emo}</span>${label}</button>`;
    };

    const gradBtn = (id) => {
      const g = gradients[id];
      const on = (sheet.gradient || 'none') === id ? ' on' : '';
      const style = (id === 'none')
        ? 'background:repeating-linear-gradient(45deg,#fff,#fff 5px,#e5e7eb 5px,#e5e7eb 10px)'
        : 'background:' + (g ? g.css : '#eee');
      return `<button class="mk-pv-grad${on}" title="${escapeAttr((g && g.name) || 'Aucun')}" style="${style}" onclick="window.mkPreviewSetGradient('${id}')"></button>`;
    };

    const fontBtn = (id) => {
      const f = fonts[id]; if (!f) return '';
      const on = (sheet.fontPair || 'inter-pair') === id ? ' on' : '';
      return `<button class="mk-pv-font${on}" onclick="window.mkPreviewSetFont('${id}')" style="font-family:'${f.heading}',sans-serif"><span class="mk-pv-font-h">Aa</span><span class="mk-pv-font-name">${escapeAttr(f.name)}</span></button>`;
    };

    const stkBtn = (id) => {
      const on = (sheet.sticker || 'none') === id ? ' on' : '';
      const svg = id === 'none' ? '<span style="opacity:.4">∅</span>' : (stickers[id] || '');
      return `<button class="mk-pv-stk${on}" onclick="window.mkPreviewSetSticker('${id}')">${svg}</button>`;
    };

    const gradIds = ['none'].concat(Object.keys(gradients));
    const fontIds = Object.keys(fonts);
    const stickerIds = ['none'].concat(Object.keys(stickers));

    return `
      <div id="mk-preview-toolbar" class="mk-pv-tb">
        <div class="mk-pv-row">
          <span class="mk-pv-lbl">Template</span>
          <div class="mk-pv-scroll">
            ${tplBtn('offre',     'Offre',     '📋')}
            ${tplBtn('memo',      'Mémo',      '📑')}
            ${tplBtn('focus',     'Focus',     '🎯')}
            ${tplBtn('editorial', 'Editorial', '📰')}
            ${tplBtn('bento',     'Bento',     '🧩')}
          </div>
        </div>
        <div class="mk-pv-row">
          <span class="mk-pv-lbl">Couleur</span>
          <div class="mk-pv-scroll">
            ${classics.map(swatch).join('')}
            <span class="mk-pv-sep"></span>
            ${trends.map(swatch).join('')}
          </div>
        </div>
        <div class="mk-pv-row">
          <span class="mk-pv-lbl">Fond mesh</span>
          <div class="mk-pv-scroll">
            ${gradIds.map(gradBtn).join('')}
          </div>
        </div>
        <div class="mk-pv-row">
          <span class="mk-pv-lbl">Typo</span>
          <div class="mk-pv-scroll">
            ${fontIds.map(fontBtn).join('')}
          </div>
        </div>
        <div class="mk-pv-row">
          <span class="mk-pv-lbl">Sticker</span>
          <div class="mk-pv-scroll">
            ${stickerIds.map(stkBtn).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function previewMutate(fn) {
    const sheet = window._mkPreviewSheet;
    if (!sheet) return;
    fn(sheet);
    sheet.updated_at = new Date().toISOString();
    upsertSheet(sheet);
    refreshPreview();
  }

  window.mkClosePreview = function () {
    const modal = document.getElementById('mk-preview-modal');
    if (modal) modal.remove();
    // Re-render l'éditeur en arrière-plan (changements via toolbar live)
    if (typeof renderEdit === 'function' && editingSheet) {
      try { renderEdit(); } catch (e) {}
    }
  };

  window.mkPreviewSetColor = function (k) {
    previewMutate(s => { s.color = k; });
  };
  window.mkPreviewSetTemplate = function (k) {
    if (!TEMPLATES[k]) return;
    previewMutate(s => {
      s.template = k;
      if (k === 'focus') {
        s.products.forEach(p => {
          if (typeof p.accroche !== 'string') p.accroche = '';
          if (typeof p.argument !== 'string') p.argument = '';
        });
      }
    });
  };
  window.mkPreviewSetGradient = function (id) {
    previewMutate(s => { s.gradient = id === 'none' ? null : id; });
  };
  window.mkPreviewSetFont = function (id) {
    if (typeof window.mkLoadFontPair === 'function') {
      try { window.mkLoadFontPair(id); } catch (e) {}
    }
    previewMutate(s => { s.fontPair = id; });
  };
  window.mkPreviewSetSticker = function (id) {
    previewMutate(s => { s.sticker = id === 'none' ? null : id; });
  };

  window.mkDownloadFromPreview = function () {
    if (window._mkPreviewSheet) generatePDF(window._mkPreviewSheet);
  };

  // ── RENDU FICHE (HTML utilisé pour PDF + preview) ───────────
  // ─── Helpers design system (gradient + font + pattern + sticker) ──
  function designBg(sheet) {
    var g = (window.MK_GRADIENTS || {})[sheet.gradient || 'none'];
    var p = (window.MK_PATTERNS  || {})[sheet.pattern  || 'none'];
    var bg = g && g.css ? g.css : '';
    var pat = p && p.css ? p.css : '';
    if (bg && pat) return pat + ', ' + bg;
    return bg || pat || '';
  }
  function designFont(sheet) {
    var fp = (window.MK_FONT_PAIRS || {})[sheet.fontPair || 'default'];
    if (!fp) return { heading: 'DM Sans', body: 'DM Sans', hw: 800, bw: 500 };
    // Lazy load les fonts custom si pas encore charges
    if (typeof window.mkLoadFontPair === 'function') window.mkLoadFontPair(sheet.fontPair || 'default');
    return {
      heading: fp.heading.family,
      body: fp.body.family,
      hw: fp.heading.weight,
      bw: fp.body.weight,
      italic: !!fp.heading.italic,
    };
  }
  function designSticker(sheet) {
    var s = (window.MK_STICKERS || {})[sheet.sticker || 'none'];
    return s && s.svg ? s.svg : '';
  }

  function renderSheetHTML(sheet, targetId) {
    const tpl = getTemplateId(sheet);
    if (tpl === 'memo')      return renderMemoTemplate(sheet, targetId);
    if (tpl === 'focus')     return renderFocusTemplate(sheet, targetId);
    if (tpl === 'editorial') return renderEditorialTemplate(sheet, targetId);
    if (tpl === 'bento')     return renderBentoTemplate(sheet, targetId);
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
                  <td class="mk-cell-name">
                    ${p.img ? `<span class="mk-cell-thumb"><img src="${escapeAttr(p.img)}" alt="" crossorigin="anonymous" onerror="this.style.display='none'"/></span>` : ''}
                    <span class="mk-cell-name-text">${p.designation}</span>
                  </td>
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
                  <td class="mk-memo-desig">
                    ${p.img ? `<span class="mk-cell-thumb mk-cell-thumb-lg"><img src="${escapeAttr(p.img)}" alt="" crossorigin="anonymous" onerror="this.style.display='none'"/></span>` : ''}
                    <span class="mk-cell-name-text">${p.designation || '—'}</span>
                  </td>
                  <td class="mk-memo-marque">${p.marque || extractMarque(p.designation)}</td>
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
          ${sheet.products.slice(0, TEMPLATES.focus.maxProducts).map((p, i) => `
            <div class="mk-focus-card">
              <div class="mk-focus-visual">${p.img ? `<img src="${escapeAttr(p.img)}" alt="" crossorigin="anonymous" class="mk-focus-img" onerror="this.outerHTML='${(placeholderSVG(p.designation)+'').replace(/'/g,'&#39;')}'"/>` : placeholderSVG(p.designation)}</div>
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

  // ═══════════════════════════════════════════════════════════════════════
  // TEMPLATE EDITORIAL — Vogue/magazine layout (gros serif + asymetrique)
  // ═══════════════════════════════════════════════════════════════════════
  function renderEditorialTemplate(sheet, targetId) {
    const s = sheet;
    const cp = COLOR_PRESETS[s.color] || COLOR_PRESETS.navy;
    const font = designFont(s);
    const bg = designBg(s);
    const sticker = designSticker(s);
    const fontFamily = "'" + font.heading + "', '" + font.body + "', serif";
    const products = (s.products || []).slice(0, TEMPLATES.editorial.maxProducts);
    const lead = products[0];
    const rest = products.slice(1);
    function padNum(n) { return n < 10 ? '0' + n : '' + n; }
    const hasLight = ['noir', 'cosmic', 'midnight', 'ocean', 'forest'].indexOf(s.gradient) >= 0;
    const textCol = hasLight ? '#FFFFFF' : '#0B1F4D';
    const subCol = hasLight ? 'rgba(255,255,255,0.78)' : 'rgba(11,31,77,0.65)';

    return `
      <div id="${targetId}" class="mk-pdf-target mk-pdf-editorial" style="background:${bg || cp.bg};color:${textCol};font-family:${fontFamily}">
        ${sticker ? `<div class="mk-ed-sticker">${sticker}</div>` : ''}
        <header class="mk-ed-header">
          <div class="mk-ed-logo">${renderLogo(56)}</div>
          <div class="mk-ed-eyebrow" style="color:${subCol}">— OFFRE INTÉGRAL PHARMA —</div>
        </header>
        <div class="mk-ed-title-wrap">
          <h1 class="mk-ed-title" style="font-family:'${font.heading}',serif;font-weight:${font.hw};${font.italic ? 'font-style:italic' : ''}">${escapeAttr(s.title)}</h1>
        </div>
        ${lead ? `
          <div class="mk-ed-lead ${lead.img ? 'mk-ed-lead-img' : ''}" style="border-color:${textCol === '#FFFFFF' ? 'rgba(255,255,255,0.22)' : 'rgba(11,31,77,0.15)'}">
            ${lead.img ? `<div class="mk-ed-lead-thumb"><img src="${escapeAttr(lead.img)}" alt="" crossorigin="anonymous" onerror="this.parentNode.style.display='none'"/></div>` : ''}
            <div class="mk-ed-lead-num" style="color:${subCol}">N°01</div>
            <div class="mk-ed-lead-name">${escapeAttr(lead.designation)}</div>
            <div class="mk-ed-lead-cip" style="color:${subCol}">${lead.source === 'offilog' ? 'EAN' : 'CIP'} ${escapeAttr(cipFormat(lead.cip13))}</div>
            <div class="mk-ed-lead-prices">
              ${lead.ppht ? `<div class="mk-ed-lead-ppht" style="color:${subCol}">PPHT ${eur(lead.ppht)}</div>` : ''}
              <div class="mk-ed-lead-ip" style="color:${textCol}">${eur(lead.prix_ip)}</div>
            </div>
          </div>
        ` : ''}
        ${rest.length ? `
          <div class="mk-ed-grid">
            ${rest.map((p, i) => `
              <div class="mk-ed-card ${p.img ? 'mk-ed-card-img' : ''}" style="border-color:${textCol === '#FFFFFF' ? 'rgba(255,255,255,0.18)' : 'rgba(11,31,77,0.12)'}">
                ${p.img ? `<div class="mk-ed-card-thumb"><img src="${escapeAttr(p.img)}" alt="" crossorigin="anonymous" onerror="this.parentNode.style.display='none'"/></div>` : ''}
                <div class="mk-ed-card-num" style="color:${subCol}">N°${padNum(i + 2)}</div>
                <div class="mk-ed-card-name">${escapeAttr(p.designation)}</div>
                <div class="mk-ed-card-cip" style="color:${subCol}">${p.source === 'offilog' ? 'EAN' : 'CIP'} ${escapeAttr(cipFormat(p.cip13))}</div>
                <div class="mk-ed-card-price">${eur(p.prix_ip)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <footer class="mk-ed-footer" style="color:${subCol};border-color:${textCol === '#FFFFFF' ? 'rgba(255,255,255,0.18)' : 'rgba(11,31,77,0.12)'}">
          <span>${escapeAttr(s.footer || 'Tarif en vigueur 2026')}</span>
          <span>— INTÉGRAL PHARMA —</span>
        </footer>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TEMPLATE BENTO — Apple Bento Grid asymetrique (2-3 cols, tiles fluides)
  // ═══════════════════════════════════════════════════════════════════════
  function renderBentoTemplate(sheet, targetId) {
    const s = sheet;
    const cp = COLOR_PRESETS[s.color] || COLOR_PRESETS.navy;
    const font = designFont(s);
    const bg = designBg(s);
    const sticker = designSticker(s);
    const products = (s.products || []).slice(0, TEMPLATES.bento.maxProducts);
    const hasLight = ['noir', 'cosmic', 'midnight', 'ocean', 'forest'].indexOf(s.gradient) >= 0;
    const textCol = hasLight ? '#FFFFFF' : '#0B1F4D';
    const tileBg = hasLight ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.75)';
    const tileBorder = hasLight ? 'rgba(255,255,255,0.20)' : 'rgba(11,31,77,0.08)';

    // Layout asymetrique : 9 cellules max, certaines doublees (col-span-2 / row-span-2)
    const cellLayouts = [
      'span 2 / span 2',  // tile 1 = grand
      'span 1 / span 1',
      'span 1 / span 1',
      'span 1 / span 2',  // tile 4 = haut
      'span 2 / span 1',  // tile 5 = large
      'span 1 / span 1',
      'span 1 / span 1',
      'span 2 / span 1',
      'span 1 / span 1',
    ];

    return `
      <div id="${targetId}" class="mk-pdf-target mk-pdf-bento" style="background:${bg || cp.bg};color:${textCol};font-family:'${font.body}',sans-serif">
        ${sticker ? `<div class="mk-bento-sticker">${sticker}</div>` : ''}
        <header class="mk-bento-header">
          <div class="mk-bento-logo">${renderLogo(48)}</div>
          <div>
            <div class="mk-bento-eyebrow" style="opacity:.7">OFFRE INTÉGRAL PHARMA</div>
            <h1 class="mk-bento-title" style="font-family:'${font.heading}',sans-serif;font-weight:${font.hw}">${escapeAttr(s.title)}</h1>
          </div>
        </header>
        <div class="mk-bento-grid">
          ${products.map((p, i) => {
            const big = i === 0;
            return `
              <div class="mk-bento-tile ${big ? 'mk-bento-tile-big' : ''} ${p.img ? 'mk-bento-tile-img' : ''}" style="background:${tileBg};border-color:${tileBorder};grid-area:${cellLayouts[i % cellLayouts.length]}">
                ${p.img ? `<div class="mk-bento-tile-thumb"><img src="${escapeAttr(p.img)}" alt="" crossorigin="anonymous" onerror="this.parentNode.style.display='none'"/></div>` : ''}
                <div class="mk-bento-num" style="opacity:.55">${String(i + 1).padStart(2, '0')}</div>
                <div class="mk-bento-name" style="font-family:'${font.heading}',sans-serif;font-weight:${font.hw}">${escapeAttr(p.designation)}</div>
                <div class="mk-bento-cip" style="opacity:.55">${p.source === 'offilog' ? 'EAN' : 'CIP'} ${escapeAttr(cipFormat(p.cip13))}</div>
                <div class="mk-bento-price-block">
                  ${p.ppht ? `<div class="mk-bento-ppht" style="opacity:.55">PPHT ${eur(p.ppht)}</div>` : ''}
                  <div class="mk-bento-ip">${eur(p.prix_ip)}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <footer class="mk-bento-footer" style="opacity:.55">
          ${escapeAttr(s.footer || 'Tarif en vigueur 2026')} · INTÉGRAL PHARMA
        </footer>
      </div>
    `;
  }

  // Handlers d'edition design system
  window.mkUpdateGradient = function (id) {
    if (!editingSheet) return;
    editingSheet.gradient = id;
    editingSheet.updated_at = new Date().toISOString();
    renderEdit();
  };
  window.mkUpdateFontPair = function (id) {
    if (!editingSheet) return;
    editingSheet.fontPair = id;
    editingSheet.updated_at = new Date().toISOString();
    if (typeof window.mkLoadFontPair === 'function') window.mkLoadFontPair(id);
    renderEdit();
  };
  window.mkUpdatePattern = function (id) {
    if (!editingSheet) return;
    editingSheet.pattern = id;
    editingSheet.updated_at = new Date().toISOString();
    renderEdit();
  };
  window.mkUpdateSticker = function (id) {
    if (!editingSheet) return;
    editingSheet.sticker = id;
    editingSheet.updated_at = new Date().toISOString();
    renderEdit();
  };
  window.mkApplyDesignPreset = function (presetId) {
    if (!editingSheet) return;
    const preset = (window.MK_DESIGN_PRESETS || {})[presetId];
    if (!preset) return;
    editingSheet.gradient = preset.gradient;
    editingSheet.fontPair = preset.fontPair;
    editingSheet.pattern = preset.pattern;
    editingSheet.template = preset.template;
    editingSheet.updated_at = new Date().toISOString();
    if (typeof window.mkLoadFontPair === 'function') window.mkLoadFontPair(preset.fontPair);
    renderEdit();
  };

})();
