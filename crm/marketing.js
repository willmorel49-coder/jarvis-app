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
  // PALETTES MARKETING 2026-2027 — Tendances + Neutres (les classiques IP
  // sont retires de l'UI mais gardent leur id pour retrocompat des sheets
  // sauvegardees, remappes vers leur equivalent tendance).
  // ── PALETTES PRO 2026-2027 (refondues par 3 agents experts + synthese DM) ──
  // 20 palettes : 10 tendances + 5 neutres premium + 5 signatures IP.
  // Inspirations : Aesop, Bioderma 2024, La Roche-Posay refresh, Eight Sleep,
  // Pantone Future Dusk / Butter Yellow, WGSN Beauty Insight S/S 2026.
  // Voir crm/marketing-design-system.js pour la source canonique.
  // Les ids alias legacy (navy/sky/mint/...) sont mappes intelligemment vers
  // leur meilleur equivalent pro pour preserver les sheets existantes.
  const COLOR_PRESETS = {
    // ─── Tendances 2026-2027 (10) ──────────────────────────────────
    'future-dusk-pharma':   { name: 'Future Dusk',         category: 'trend',   bg: '#F5F2EC', accent: '#2D2A4A', headerBg: '#4A4870', headerFg: '#F5F2EC', priceBg: '#2D2A4A', priceFg: '#FFD66B' },
    'transformative-teal':  { name: 'Teal Vitalité',       category: 'trend',   bg: '#F8FAF9', accent: '#0F5A4E', headerBg: '#16A085', headerFg: '#FFFFFF', priceBg: '#0F5A4E', priceFg: '#FFE8A3' },
    'butter-yellow-solaire':{ name: 'Butter Solaire',      category: 'trend',   bg: '#FFFCF2', accent: '#3D2817', headerBg: '#FFD66B', headerFg: '#3D2817', priceBg: '#3D2817', priceFg: '#FFD66B' },
    'sour-cherry-prestige': { name: 'Cherry Lacquer',      category: 'trend',   bg: '#FAF6F2', accent: '#5C1A24', headerBg: '#7A2433', headerFg: '#FAF6F2', priceBg: '#5C1A24', priceFg: '#F4B942' },
    'aura-indigo-tech':     { name: 'Aura Indigo Tech',    category: 'trend',   bg: '#F4F4F8', accent: '#1E1B4B', headerBg: '#2E2A6B', headerFg: '#F4F4F8', priceBg: '#1E1B4B', priceFg: '#A5F3FC' },
    'mocha-mousse-2025':    { name: 'Mocha Apothicaire',   category: 'trend',   bg: '#FAF5EC', accent: '#3A2A1F', headerBg: '#A47864', headerFg: '#FAF5EC', priceBg: '#3A2A1F', priceFg: '#F4B942' },
    'verdant-sage':         { name: 'Sage Botanique',      category: 'trend',   bg: '#F4F6F2', accent: '#2F4030', headerBg: '#7A9070', headerFg: '#F4F6F2', priceBg: '#2F4030', priceFg: '#FAF5EC' },
    'coral-warmth':         { name: 'Corail Officinal',    category: 'trend',   bg: '#FDF8F4', accent: '#7A2E1A', headerBg: '#E07856', headerFg: '#FDF8F4', priceBg: '#7A2E1A', priceFg: '#FDF8F4' },
    'raspberry-mat':        { name: 'Framboise Mate',      category: 'trend',   bg: '#FAF4F6', accent: '#4A1E2E', headerBg: '#9B3A5C', headerFg: '#FAF4F6', priceBg: '#4A1E2E', priceFg: '#FFD66B' },
    'ocean-deep':           { name: 'Océan Profond',       category: 'trend',   bg: '#F0F4F7', accent: '#0A2540', headerBg: '#1E3A5F', headerFg: '#F0F4F7', priceBg: '#0A2540', priceFg: '#FFD66B' },

    // ─── Neutres Premium (5) ───────────────────────────────────────
    'ivoire-vellum':        { name: 'Ivoire Vélin',        category: 'neutral', bg: '#F5F0E8', accent: '#1A1A1A', headerBg: '#2C2C2C', headerFg: '#F5F0E8', priceBg: '#1A1A1A', priceFg: '#FFD66B' },
    'glacial-white':        { name: 'Blanc Glacé',         category: 'neutral', bg: '#FAFBFC', accent: '#0A1628', headerBg: '#1B2A4E', headerFg: '#FAFBFC', priceBg: '#0A1628', priceFg: '#FAFBFC' },
    'champagne-mineral':    { name: 'Champagne Minéral',   category: 'neutral', bg: '#F4EFE3', accent: '#2B2118', headerBg: '#5C4A35', headerFg: '#F4EFE3', priceBg: '#2B2118', priceFg: '#D4A574' },
    'graphite-mat':         { name: 'Graphite Mat',        category: 'neutral', bg: '#1C1C1E', accent: '#F2EDE4', headerBg: '#2C2C2E', headerFg: '#F2EDE4', priceBg: '#F2EDE4', priceFg: '#1C1C1E' },
    'perle-grise':          { name: 'Perle Grise',         category: 'neutral', bg: '#EDEEF0', accent: '#1F2937', headerBg: '#374151', headerFg: '#EDEEF0', priceBg: '#1F2937', priceFg: '#FFD66B' },

    // ─── Signatures Intégral Pharma (5) ────────────────────────────
    'ip-signature-azure':   { name: 'IP Azur Signature',   category: 'signature', bg: '#F4F7FC', accent: '#0A1F4E', headerBg: '#1B2A4E', headerFg: '#F4F7FC', priceBg: '#0057FF', priceFg: '#FFFFFF' },
    'ip-encre-miel':        { name: 'IP Encre & Miel',     category: 'signature', bg: '#FAF6EE', accent: '#0A1F4E', headerBg: '#1B2A4E', headerFg: '#FAF6EE', priceBg: '#0A1F4E', priceFg: '#F4B942' },
    'ip-cherry-edition':    { name: 'IP Cherry Édition',   category: 'signature', bg: '#FAF4F4', accent: '#0A1F4E', headerBg: '#5C1A24', headerFg: '#FAF4F4', priceBg: '#5C1A24', priceFg: '#FFD66B' },
    'ip-sage-conseil':      { name: 'IP Sage Conseil',     category: 'signature', bg: '#F4F7F2', accent: '#1A2F1E', headerBg: '#2F4030', headerFg: '#F4F7F2', priceBg: '#1A2F1E', priceFg: '#F4B942' },
    'ip-graphite-prestige': { name: 'IP Graphite Prestige', category: 'signature', bg: '#1A1D2E', accent: '#F2EDE4', headerBg: '#2C3045', headerFg: '#F2EDE4', priceBg: '#F2EDE4', priceFg: '#0A1F4E' },

    // ─── Alias retrocompat (sheets existantes + SEASON_THEMES) ─────
    // Mapped intelligemment vers leur equivalent pro le plus proche.
    navy:       { name: 'Marine',  category: '_legacy', bg: '#F4F7FC', accent: '#0A1F4E', headerBg: '#1B2A4E', headerFg: '#F4F7FC', priceBg: '#0057FF', priceFg: '#FFFFFF' },
    sky:        { name: 'Ciel',    category: '_legacy', bg: '#F0F4F7', accent: '#0A2540', headerBg: '#1E3A5F', headerFg: '#F0F4F7', priceBg: '#0A2540', priceFg: '#FFD66B' },
    lilac:      { name: 'Lilas',   category: '_legacy', bg: '#F5F2EC', accent: '#2D2A4A', headerBg: '#4A4870', headerFg: '#F5F2EC', priceBg: '#2D2A4A', priceFg: '#FFD66B' },
    mint:       { name: 'Menthe',  category: '_legacy', bg: '#F4F6F2', accent: '#2F4030', headerBg: '#7A9070', headerFg: '#F4F6F2', priceBg: '#2F4030', priceFg: '#FAF5EC' },
    amber:      { name: 'Ambre',   category: '_legacy', bg: '#FFFCF2', accent: '#3D2817', headerBg: '#FFD66B', headerFg: '#3D2817', priceBg: '#3D2817', priceFg: '#FFD66B' },
    rose:       { name: 'Rose',    category: '_legacy', bg: '#FAF4F6', accent: '#4A1E2E', headerBg: '#9B3A5C', headerFg: '#FAF4F6', priceBg: '#4A1E2E', priceFg: '#FFD66B' },
    forest:     { name: 'Forêt',   category: '_legacy', bg: '#F4F7F2', accent: '#1A2F1E', headerBg: '#2F4030', headerFg: '#F4F7F2', priceBg: '#1A2F1E', priceFg: '#F4B942' },

    // ─── Aliases additionnels pour sheets templates existants ──────
    dusk:       { name: 'Future Dusk',       category: '_legacy', bg: '#F5F2EC', accent: '#2D2A4A', headerBg: '#4A4870', headerFg: '#F5F2EC', priceBg: '#2D2A4A', priceFg: '#FFD66B' },
    teal:       { name: 'Deep Teal',         category: '_legacy', bg: '#F8FAF9', accent: '#0F5A4E', headerBg: '#16A085', headerFg: '#FFFFFF', priceBg: '#0F5A4E', priceFg: '#FFE8A3' },
    cherry:     { name: 'Cherry Lacquer',    category: '_legacy', bg: '#FAF6F2', accent: '#5C1A24', headerBg: '#7A2433', headerFg: '#FAF6F2', priceBg: '#5C1A24', priceFg: '#F4B942' },
    sienna:     { name: 'Burnt Sienna',      category: '_legacy', bg: '#FDF8F4', accent: '#7A2E1A', headerBg: '#E07856', headerFg: '#FDF8F4', priceBg: '#7A2E1A', priceFg: '#FDF8F4' },
    sage:       { name: 'Sage Eucalyptus',   category: '_legacy', bg: '#F4F6F2', accent: '#2F4030', headerBg: '#7A9070', headerFg: '#F4F6F2', priceBg: '#2F4030', priceFg: '#FAF5EC' },
    vanilla:    { name: 'Vanilla Cream',     category: '_legacy', bg: '#FAF5EC', accent: '#3A2A1F', headerBg: '#A47864', headerFg: '#FAF5EC', priceBg: '#3A2A1F', priceFg: '#F4B942' },
    chartreuse: { name: 'Chartreuse',        category: '_legacy', bg: '#F8FAF9', accent: '#0F5A4E', headerBg: '#16A085', headerFg: '#FFFFFF', priceBg: '#0F5A4E', priceFg: '#FFE8A3' },
    slate:      { name: 'Slate Gold',        category: '_legacy', bg: '#1C1C1E', accent: '#F2EDE4', headerBg: '#2C2C2E', headerFg: '#F2EDE4', priceBg: '#F2EDE4', priceFg: '#1C1C1E' },
    plum:       { name: 'Mystic Plum',       category: '_legacy', bg: '#FAF4F6', accent: '#4A1E2E', headerBg: '#9B3A5C', headerFg: '#FAF4F6', priceBg: '#4A1E2E', priceFg: '#FFD66B' },
    terracotta: { name: 'Terracotta',        category: '_legacy', bg: '#FDF8F4', accent: '#7A2E1A', headerBg: '#E07856', headerFg: '#FDF8F4', priceBg: '#7A2E1A', priceFg: '#FDF8F4' },
    ice:        { name: 'Blanc glacé',       category: '_legacy', bg: '#FAFBFC', accent: '#0A1628', headerBg: '#1B2A4E', headerFg: '#FAFBFC', priceBg: '#0A1628', priceFg: '#FAFBFC' },
    pearl:      { name: 'Perle',             category: '_legacy', bg: '#F4EFE3', accent: '#2B2118', headerBg: '#5C4A35', headerFg: '#F4EFE3', priceBg: '#2B2118', priceFg: '#D4A574' },
    stone:      { name: 'Gris pierre',       category: '_legacy', bg: '#EDEEF0', accent: '#1F2937', headerBg: '#374151', headerFg: '#EDEEF0', priceBg: '#1F2937', priceFg: '#FFD66B' },
    charcoal:   { name: 'Noir mat',          category: '_legacy', bg: '#1C1C1E', accent: '#F2EDE4', headerBg: '#2C2C2E', headerFg: '#F2EDE4', priceBg: '#F2EDE4', priceFg: '#1C1C1E' },
    cream:      { name: 'Crème',             category: '_legacy', bg: '#F5F0E8', accent: '#1A1A1A', headerBg: '#2C2C2C', headerFg: '#F5F0E8', priceBg: '#1A1A1A', priceFg: '#FFD66B' },
    ivory:      { name: 'Ivoire',            category: '_legacy', bg: '#FAF6EE', accent: '#0A1F4E', headerBg: '#1B2A4E', headerFg: '#FAF6EE', priceBg: '#0A1F4E', priceFg: '#F4B942' },
  };

  // Thèmes saison — filtres + mois pertinents
  // Patterns elargis pour ramener 20-30 produits IP grossiste par theme :
  // codes ATC2 + listes labos/dosages + termes generiques pour viser TOUT le
  // catalogue medicament pertinent (pas juste les marques connues).
  const SEASON_THEMES = [
    { id: 'allergies', name: 'Allergies printemps', months: [3,4,5], emoji: '🌿', color: 'mint',
      filter: b => b.atc2 === 'R06' || b.atc2 === 'D04' || b.atc2 === 'R01'
        || /CETIRIZIN|LORATADIN|DESLORATADIN|FEXOFEN|EBASTINE|RUPATADINE|BILASTINE|MIZOLAST|AERIUS|TELFAST|XYZALL|WYSTAMM|ZYRTEC|VIRLIX|MEQUITAZ|PRIMALAN|POLARAMINE|CLARITYNE|DEXCHLORPHEN|HYDROXYZIN|ATARAX|KESTIN|XYZA|HISTA/i.test(b.designation) },
    { id: 'solaire', name: 'Été · brûlures, piqûres, hydratation', months: [5,6,7,8], emoji: '☀️', color: 'amber',
      // Été pharmacie : pas que solaire IP (peu present en grossiste) mais
      // tout ce que pharmacien dispense l'ete : brulures, piqures, allergies
      // cutanees, deshydratation, traveler kit, antalgiques + collyres + dermo
      filter: b => b.atc2 === 'D06' || b.atc2 === 'D07' || b.atc2 === 'D08'
        || b.atc2 === 'R03' || b.atc2 === 'S01'
        || /SOLAIRE|UVA|UVB|\bSPF\b|APRES.SOLEIL|COUP DE SOLEIL|MOUSTIQ|REPULSI|INSECT|PIQUR|BIAFINE|PHOTODERM|ANTHELIOS|CAPITAL SOLEIL|MEXORYL|CICAPLAST|CICALFATE|BEPANTHEN|DEXERYL|HOMEOPLASMIN|OCTOCRYL|TETRALYSAL|DIHYDRAL|HYDROCORT|DERMOCORT|CALMINE|APAISYL|EURAX|FENISTIL|BUTIX|ZINEXOL|DERMOSOIN|BURNESHIELD|DERMOFENAC|CETAVLON|BISEPTINE|HEXOMEDINE|CHLORHEXIDIN|MERCRYL|BETADINE|MERFENE|HEXAMIDINE|DAKIN|CYTEAL|EOSINE|MILIAN|TOUSEC|TROLAMINE|DOLOPRANE|HEMOCLAR|HIRUDOID|LIOTON|VOLTAREN|DICLOFENAC|KETOPROFEN|FLECTOR|FASTUM|ALGESAL|TRAUMEEL|ARNICA|NICOFLEX|ALGIPAN|BAUME ST BERN|PIOFAR|PRYSE|MITOSYL|NIVEA SUN|PHYTOSUN|PRORHINEL|RHINEDRINE|STERIMAR|PHYSIOMER|HUMER|PHYSIODOSE|SERUM PHYSIO|DACRYO|DACRYUM|DACRYNES|ALLERG|HISTA|PIRITON|CETIRIZ|LORATAD|DESLORATAD|FEXOFEN|EBASTINE|BILASTINE|MIZOLAST|RUPATADINE|XYZALL|AERIUS|TELFAST|VIRLIX|ZYRTEC|REACTINE|KESTIN|MEQUITAZ|PRIMALAN|POLARAMINE|ATARAX|HYDROXYZINE|PROCTOLOG|HEMOROIDE|SEDORRHOIDE|VEINOTONIQUE|DAFLON|GINKOR|VEINOPHYL|SMECTA|PHLOROGLUC|SPASFON|MEBEVERIN|DEBRIDAT|TUSSIPAX|TUSSIDANE|TOPLEXIL|CLARIX|EUVANOL|RHINOSPRAY|ATURGYL|DECONGEST|GIFRER|DOLIPRANE|EFFERALGAN|DAFALGAN|CLARADOL|PARACETAMOL|IBUPROFENE|ADVIL|NUROFEN|ANTARENE|UPFEN|OTOCALMINE|CERULYSE|OPHTHALMOSEPTONEX|CORICIDE|VERRUMAL|DURYL|MYCOSE|GYNO|ECONAZOLE|FLUCONAZOLE|MYCOSTER|PEVARYL|MYK|LAMISIL|TERBINAFIN|KETOCONAZOLE|CICATRICE|GEL ARNICA|CRYO|MAGNESIA|MICROLAX|NORMACOL|TRANSIPEG|FORLAX|MOVICOL|MUCIVITAL|DULCOLAX|JAMYLENE|HYDRA|ACTISOUF|GAVISCON|MAALOX|RENNIE|MOXYDAR|PHOSPHALUGEL|SARGENOR|MAGNE ?B6|VITASCORB|TOPLEXIL/i.test(b.designation) },
    { id: 'immunite', name: 'Rentrée immunité', months: [9,10], emoji: '🛡️', color: 'sky',
      filter: b => b.atc2 === 'A11' || b.atc2 === 'A12'
        || /VITAM|MAGNES|PROBIO|DEFENSE|IMMUNI|\bZINC\b|GINSENG|GUARANA|ECHINAC|PROPOLIS|ACEROLA|GELEE ROYALE|OLIGO|BEROCCA|SUPRADYN|ELEVIT|CHOLECALCI|VIT D|VIT C|VITAMINE D|VITAMINE C|ZYMA|UVEDOSE|STERO|ADRIGYL|CACIT|OROCAL|ORTHOSIPHON|FERRO|FERTIL|ALVITYL|JUVAMINE|FORCAPIL|MAGNESIUM|FERVEX|MERCALM|VITASCORBOL|FERROSTRAN|RHODIOLA|ASHWAGAND/i.test(b.designation) },
    { id: 'grippe', name: 'Grippe & vaccins hiver', months: [10,11,12], emoji: '💉', color: 'navy',
      filter: b => /\bGRIPPE\b|INFLUVAC|VAXIGRIP|EFLUELDA|FLUARIX|OSELTAMIVIR|TAMIFLU|FERVEX|HUMEX|DOLIPRANE|EFFERALGAN|DAFALGAN|CLARADOL|PARACETAMOL|IBUPROFENE|ADVIL|NUROFEN|ANTARENE|UPFEN|IBUFETUM|PROFENID|ASPIRINE|ASPEGIC|KARDEGIC|PYRACETIVITAMINE|RHINADVIL|RHINOFEBRAL|DOLIRHUME|ACTIFED|RHINURIA|EUPHYTOSE/i.test(b.designation) },
    { id: 'rhume', name: 'Rhume & toux', months: [10,11,12,1,2], emoji: '🤧', color: 'lilac',
      filter: b => /RHUME|\bTOUX\b|RHINO|NASAL|PASTIL|FERVEX|HUMEX|ACTIFED|DOLIRHUME|STREPSIL|\bDRILL\b|ANGINEX|FLUIDIFI|EXPECTOR|VICKS|MAXILASE|HEXTRIL|HEXASPRAY|TROPHIRES|CLARIX|TUSSIDANE|TOPLEXIL|HELICIDINE|BRONCHODERMINE|MUCOMYST|EXOMUC|FLUIMUCIL|BRONCHALENE|BISOLVON|MUCANE|SOLACY|STIMUKIL|EUCALYPTOL|MENTHE|EUCALYPT|EUVANOL|RHINEDRINE|PIVALONE|RHINOFLUIMUCIL|STERIMAR|PHYSIOMER|SINUSPAX|EUPHON|PHYTOXIL|VEGEBOM|BALSAMIQUE|PROPOLIS|PASTILLE|GORGE|EREVA|HEXALENT|COLLU|LYSOPAINE|ANGIPAX|SOLUTRICINE|HEXOMEDINE/i.test(b.designation) },
    { id: 'gastro', name: 'Gastro hiver', months: [11,12,1,2], emoji: '🍵', color: 'forest',
      filter: b => b.atc2 === 'A07'
        || /SMECTA|TIORFAN|LOPERAM|IMODIUM|DIOSMECTIT|ULTRA.LEVURE|SACCHAROMYC|VOGAL|MOTILIUM|ANTIDIARR|\bSRO\b|ADIARIL|DOMPERIDON|METOCLOPRAM|RACECADOTRIL|TIORFAST|DIARSED|ERCEFURYL|NIFUROXAZ|PANFUREX|LACTEOL|ESTROMINEUR|PHLOROGLUCINOL|SPASFON|MEBEVERINE|DUSPATALIN|BUSCOPAN|PRIMPERAN|MOTILYO|ZOPHREN|PRIMPERAN|VOGALIB|VOGALENE|ESOMEPRAZ|MAALOX|GAVISCON|RENNIE|GELOX|PHOSPHALUGEL|MOPRAL|INEXIUM|EUPANTOL|PARIET|LANSOPRAZ|RANITIDIN|FAMOTIDIN|CIMETIDIN|PEPSANE|XOLAAM|ROCGEL|RIOPAN|TOPAAL|DEBRIDAT|LIBRAX|LISOMUCIL|ANTIDIARRH|CHARBON ACTIF|BACILOR|FLORATIL|ENTEROGERMINA|BACILAC|PROBIOLIFE|ANTI.NAUSEE|REHYDR/i.test(b.designation) },
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
    // Ids composites de planning : '__month_N' (1..12) -> composite du mois N
    var compMatch = String(id || '').match(/^__month_(\d{1,2})$/);
    if (compMatch) return getCompositeThemeForMonth(parseInt(compMatch[1], 10));
    return SEASON_THEMES.find(t => t.id === id) || CAT_THEMES.find(t => t.id === id) || null;
  }

  function getCurrentSeasonTheme() {
    // Theme COMPOSITE = fusion de tous les themes actifs du mois courant.
    const m = new Date().getMonth() + 1;
    return getCompositeThemeForMonth(m);
  }

  // Filtre OFFILOG par theme saisonnier (parapharma uniquement, distinct du
  // canal grossiste IP). Patterns dedies axes parapharma OTC + cosmetique.
  function offilogFilterForTheme(themeId, designation, univers) {
    const txt = ((designation || '') + ' ' + (univers || '')).toLowerCase();
    if (themeId === 'allergies' || (themeId && themeId.indexOf('__month_') === 0 && /allerg/i.test(themeId))) {
      return /allerg|cetiriz|loratad|histamin|pollen|conjoncti/.test(txt);
    }
    if (themeId === 'solaire')   return /solair|spf|uva|uvb|sun |sun$|apres.soleil|moustiq|repuls|insec|piqur|biafine|photoderm|anti.moustique|anti.solaire/.test(txt);
    if (themeId === 'immunite')  return /vitamin|magnes|probio|defense|immuni|\bzinc\b|ginseng|guarana|echinac|propolis|acerola|gelee royale|oligo|berocca|supradyn|elevit|cholecal|complement|fer|spiruline|rhodiola|ashwagand/.test(txt);
    if (themeId === 'grippe')    return /grippe|antivir|vitamine c|paracetamol|ibuprofen|doliprane|advil|nurofen/.test(txt);
    if (themeId === 'rhume')     return /rhume|toux|rhino|nasal|pastil|fervex|humex|actifed|dolirhume|strepsil|drill|angin|fluidif|expector|vicks|maxilase|hextril|hexaspray|sterimar|physiomer|baume|propol|euvanol|spray nasal|sirop|gorge|pastille/.test(txt);
    if (themeId === 'gastro')    return /gastro|diarrh|smecta|tiorfan|loperam|imodium|ultra.levure|charbon|probiotique|electrolyt|adiaril|rehydr|antinauseu|nausee|crampe|spasm/.test(txt);
    return false;
  }

  // Theme composite OFFILOG : meme principe que getCompositeThemeForMonth
  // mais filter() chasse dans OFFILOG (canal parapharma).
  function getCompositeOffilogThemeForMonth(month) {
    const active = SEASON_THEMES.filter(t => t.months.includes(month));
    if (!active.length) return null;
    if (active.length === 1) {
      return {
        id: '__off_month_' + month,
        name: active[0].name,
        emoji: active[0].emoji,
        color: active[0].color,
        _themes: active,
      };
    }
    return {
      id: '__off_month_' + month,
      name: active.map(t => t.name).join(' + '),
      emoji: active[0].emoji,
      color: active[0].color,
      _themes: active,
    };
  }

  // Top OFFILOG saisonnier : filtre + tri par rang vente decroissant
  // (rang_vente = ranking OFFILOG officiel des ventes parapharma)
  let __offSeasonCache = null;
  function themeProductsOffilog(theme) {
    if (!window.OFFILOG) return [];
    if (!theme) return [];
    const cacheKey = theme.id;
    if (__offSeasonCache && __offSeasonCache[cacheKey]) return __offSeasonCache[cacheKey];
    const themes = theme._themes || [theme];
    const list = window.OFFILOG
      .filter(o => o.dans_offilog && o.prix_offilog > 0)
      .filter(o => themes.some(t => offilogFilterForTheme(t.id, o.produit, o.univers)));
    // Tri par rang_vente croissant (1 = meilleure vente). rang_vente null = mauvais rang.
    list.sort((a, b) => {
      const ra = a.rang_vente || 99999;
      const rb = b.rang_vente || 99999;
      if (ra !== rb) return ra - rb;
      // Fallback : prix_offilog desc (gros prix = plus de marge)
      return (b.prix_offilog || 0) - (a.prix_offilog || 0);
    });
    if (!__offSeasonCache) __offSeasonCache = {};
    __offSeasonCache[cacheKey] = list;
    return list;
  }

  // Planning OFFILOG : pour chaque mois, retourne le composite OFFILOG
  function getOffilogPlanning(monthsAhead) {
    const now = new Date();
    const out = [];
    for (let i = 0; i <= monthsAhead; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const month = d.getMonth() + 1;
      const theme = getCompositeOffilogThemeForMonth(month);
      out.push({
        offset: i,
        date: d,
        monthName: d.toLocaleDateString('fr-FR', { month: 'long' }),
        monthLabel: d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        theme: theme,
      });
    }
    return out;
  }

  // Construit un theme COMPOSITE pour un mois donne : fusion des regex de
  // TOUS les themes saisonniers actifs ce mois-la. Permet d'atteindre 20+
  // produits par mois meme quand un seul theme ne suffit pas.
  // Ex: novembre = grippe + rhume + gastro -> ~150 produits BENCHMARK matches.
  // Pitch fallback synthetique si MONTHLY_PITCH absent ou mois inconnu :
  // garantit qu'AUCUNE card mensuelle ne soit vide. Headline base sur les
  // themes saisonniers actifs + mois en clair.
  function synthFallbackPitch(month, activeThemes) {
    const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const mn = monthNames[month] || ('Mois ' + month);
    const themeName = activeThemes && activeThemes.length
      ? activeThemes.map(t => t.name).join(' + ')
      : 'Catalogue grossiste IP';
    return {
      headline: themeName,
      subhead: 'Top 30 produits du mois — secteur OPS+CPR+HP',
      eyebrow: 'PLANNING ' + mn.toUpperCase() + ' · CANAL GROSSISTE IP',
      pitch_short: 'Sélection priorisée par volume marché pour cibler tes meilleures ventes ' + mn.toLowerCase() + '.',
      cta_line: 'Composer la fiche du mois',
      accent_quote: '',
    };
  }

  function getCompositeThemeForMonth(month) {
    const active = SEASON_THEMES.filter(t => t.months.includes(month));
    // Pitch commercial mensuel (marketing-monthly-pitches.js).
    // Si fichier absent OU mois sans pitch defini -> fallback synthetique
    // pour ne JAMAIS avoir de card vide.
    let pitch = (typeof window.getMonthlyPitch === 'function')
      ? window.getMonthlyPitch(month)
      : null;
    if (!pitch) pitch = synthFallbackPitch(month, active);
    if (!active.length) {
      const base = SEASON_THEMES[0];
      return Object.assign({}, base, { _pitch: pitch, _month: month });
    }
    if (active.length === 1) {
      return Object.assign({}, active[0], { _pitch: pitch, _month: month });
    }
    // Composite : reutilise les filter() de chaque theme actif (OR logique)
    return {
      id: '__month_' + month,
      name: active.map(t => t.name).join(' + '),
      months: [month],
      emoji: active[0].emoji,
      color: active[0].color,
      _composite: true,
      _themes: active,
      _pitch: pitch,
      _month: month,
      filter: b => active.some(t => t.filter(b)),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PICKER SAISONNIER — modal pour composer la selection avant fiche
  // ═══════════════════════════════════════════════════════════════════════
  function getSeasonPickerProducts() {
    // Resout le theme + le pool de produits selon la source
    let theme = null;
    let products = [];
    if (seasonPickerSource === 'offilog') {
      // Theme OFFILOG : id de type '__off_month_X' ou theme natif
      var mOff = (seasonPickerThemeId || '').match(/^__off_month_(\d+)$/);
      if (mOff) {
        theme = getCompositeOffilogThemeForMonth(parseInt(mOff[1], 10));
      } else {
        // Fallback : theme SEASON natif transpose en parapharma
        theme = SEASON_THEMES.find(t => t.id === seasonPickerThemeId);
      }
      if (theme) products = themeProductsOffilog(theme);
    } else {
      theme = getThemeById(seasonPickerThemeId);
      if (theme) products = themeProducts(theme);
    }
    return { theme: theme, products: products };
  }

  function getProductKey(p) {
    // Cle unique pour set : EAN pour OFFILOG, cip13 pour BENCHMARK
    if (seasonPickerSource === 'offilog') return String(p.ean || '');
    return String(p.cip13 || p.artcode || '');
  }

  // Ouvre le picker. Si monthOffset fourni -> pre-coche le top 30 DEDUPLIQUE
  // (sinon top 30 du pool entier sans dedup).
  window.mkOpenSeasonPicker = function (themeId, source, monthOffset) {
    seasonPickerThemeId = themeId;
    seasonPickerSource = source || 'grossiste';
    seasonPickerSearch = '';
    seasonPickerOnlySelected = false;
    var ctx = getSeasonPickerProducts();
    var preselect = null;
    if (typeof monthOffset === 'number') {
      preselect = seasonPickerSource === 'offilog'
        ? getMonthTop30Offilog(monthOffset)
        : getMonthTop30Grossiste(monthOffset);
    }
    if (!preselect || !preselect.length) preselect = ctx.products.slice(0, 30);
    seasonPickerSelectedKeys = new Set(preselect.map(getProductKey));
    seasonPickerOpen = true;
    renderSeasonPicker();
    // Escape ferme le picker
    if (!window.__mkPickerEscBound) {
      window.__mkPickerEscBound = function (e) {
        if (e.key === 'Escape' && seasonPickerOpen) {
          e.stopPropagation();
          window.mkClosePicker();
        }
      };
      document.addEventListener('keydown', window.__mkPickerEscBound, true);
    }
  };

  window.mkClosePicker = function () {
    seasonPickerOpen = false;
    var el = document.getElementById('mk-season-picker');
    if (el) el.remove();
    if (window.__mkPickerEscBound) {
      document.removeEventListener('keydown', window.__mkPickerEscBound, true);
      window.__mkPickerEscBound = null;
    }
  };

  window.mkPickerToggle = function (key) {
    if (seasonPickerSelectedKeys.has(key)) seasonPickerSelectedKeys.delete(key);
    else seasonPickerSelectedKeys.add(key);
    renderSeasonPicker();
  };

  window.mkPickerSelectTop = function (n) {
    var ctx = getSeasonPickerProducts();
    seasonPickerSelectedKeys = new Set(ctx.products.slice(0, n).map(getProductKey));
    renderSeasonPicker();
  };
  // Restaure le top 30 deduplique du mois (defini lors de l'ouverture du picker)
  window.mkPickerResetDedup = function () {
    // On retrouve le mois via le themeId qui contient __month_N ou __off_month_N
    var mGr = (seasonPickerThemeId || '').match(/^__month_(\d+)$/);
    var mOff = (seasonPickerThemeId || '').match(/^__off_month_(\d+)$/);
    var offset = -1;
    var now = new Date().getMonth() + 1;
    if (mGr) { var t = parseInt(mGr[1], 10); offset = ((t - now) + 12) % 13; }
    if (mOff) { var t2 = parseInt(mOff[1], 10); offset = ((t2 - now) + 12) % 13; }
    if (offset < 0) return window.mkPickerSelectTop(30);
    var preset = seasonPickerSource === 'offilog'
      ? getMonthTop30Offilog(offset)
      : getMonthTop30Grossiste(offset);
    if (!preset.length) return window.mkPickerSelectTop(30);
    seasonPickerSelectedKeys = new Set(preset.map(getProductKey));
    renderSeasonPicker();
  };
  window.mkPickerClearAll = function () {
    seasonPickerSelectedKeys = new Set();
    renderSeasonPicker();
  };
  window.mkPickerSearch = function (q) {
    seasonPickerSearch = q;
    renderSeasonPicker();
    var el = document.querySelector('#mk-season-picker input.mk-picker-search');
    if (el) { el.focus(); el.setSelectionRange(q.length, q.length); }
  };
  window.mkPickerToggleOnlySelected = function () {
    seasonPickerOnlySelected = !seasonPickerOnlySelected;
    renderSeasonPicker();
  };

  window.mkPickerCreateSheet = function () {
    var ctx = getSeasonPickerProducts();
    if (!ctx.theme) return;
    var selectedKeys = seasonPickerSelectedKeys;
    if (!selectedKeys.size) {
      if (typeof window.showToast === 'function') window.showToast('Coche au moins 1 produit', 'info');
      return;
    }
    // Filtre et preserve l'ordre du pool original (tri volume secteur DESC)
    var picked = ctx.products.filter(p => selectedKeys.has(getProductKey(p)));
    var snap = picked.map(p => seasonPickerSource === 'offilog'
      ? snapshotOffilogProduct(p)
      : snapshotProduct(p));
    var titlePrefix = seasonPickerSource === 'offilog' ? 'OFFILOG ' : '';
    var color = seasonPickerSource === 'offilog' ? 'amber' : (ctx.theme.color || 'navy');

    // Pitch commercial mensuel (si dispo) → pre-remplit titre, footer,
    // accroche du 1er produit, et propose template focus si reco du preset.
    var pitch = ctx.theme && ctx.theme._pitch ? ctx.theme._pitch : null;
    var sheetTitle = titlePrefix + (pitch && pitch.headline ? pitch.headline : ctx.theme.name);
    var sheetFooter = pitch && pitch.cta_line
      ? pitch.cta_line
      : ('Tarifs ' + new Date().getFullYear());
    var template = 'offre';
    // Si le preset recommande implique un template focus, pre-rempli accroche/argument
    if (pitch && pitch.recommended_preset && window.MK_DESIGN_PRESETS && window.MK_DESIGN_PRESETS[pitch.recommended_preset]) {
      var preset = window.MK_DESIGN_PRESETS[pitch.recommended_preset];
      if (preset && preset.template) template = preset.template;
    }
    // Si template focus → on enrichit le 1er produit avec l'accent_quote
    if (template === 'focus' && pitch && snap.length > 0) {
      if (!snap[0].accroche && pitch.accent_quote) {
        snap[0].accroche = pitch.accent_quote;
      }
      if (!snap[0].argument && pitch.pitch_short) {
        snap[0].argument = pitch.pitch_short;
      }
    }
    editingSheet = {
      id: 'mk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: sheetTitle,
      theme: 'custom',
      color: color,
      footer: sheetFooter,
      template: template,
      products: snap,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    window.mkClosePicker();
    renderEdit();
    // Ouvre directement l'apercu live (sidebar gauche) plutot que de laisser
    // l'utilisateur cliquer "Apercu" : il arrive direct sur le doc editable.
    setTimeout(function () {
      if (typeof window.mkPreview === 'function') window.mkPreview();
    }, 60);
  };

  function renderSeasonPicker() {
    if (!seasonPickerOpen) return;
    var ctx = getSeasonPickerProducts();
    if (!ctx.theme) return;
    var allProducts = ctx.products;
    // Filtre recherche + only-selected
    var filtered = allProducts;
    var q = (seasonPickerSearch || '').toLowerCase().trim();
    if (q) {
      filtered = filtered.filter(p => {
        var name = String(p.designation || p.produit || '').toLowerCase();
        var code = String(p.cip13 || p.ean || p.artcode || '');
        return name.includes(q) || code.includes(q);
      });
    }
    if (seasonPickerOnlySelected) {
      filtered = filtered.filter(p => seasonPickerSelectedKeys.has(getProductKey(p)));
    }
    var selCount = seasonPickerSelectedKeys.size;
    var totalPool = allProducts.length;
    var totalQte = 0, totalCa = 0, totalPrix = 0;
    filtered.forEach(p => {
      if (seasonPickerSelectedKeys.has(getProductKey(p))) {
        totalQte += (p._sec_qte || 0);
        totalCa  += (p._sec_ca || 0);
        totalPrix += (p.prix_offilog || p.prix_ip || 0);
      }
    });
    var isOff = seasonPickerSource === 'offilog';
    var headerCol = isOff ? '#EA580C' : '#0057FF';
    var html = '\n      <div class="mk-modal mk-season-picker-modal">\n' +
      '        <div class="mk-modal-head">\n' +
      '          <div class="mk-modal-title">\n' +
      '            <span style="font-size:22px;margin-right:6px">' + (ctx.theme.emoji || '🎯') + '</span>\n' +
      '            ' + escapeAttr(ctx.theme.name) + '\n' +
      '            <span class="mk-picker-source-pill" style="background:' + headerCol + '">' + (isOff ? '🧴 OFFILOG' : '💊 GROSSISTE IP') + '</span>\n' +
      '          </div>\n' +
      '          <div class="mk-modal-actions">\n' +
      '            <button class="mk-btn" onclick="window.mkClosePicker()">Annuler</button>\n' +
      '            <button class="mk-btn mk-btn-primary" onclick="window.mkPickerCreateSheet()" ' + (selCount === 0 ? 'disabled' : '') + '>\n' +
      '              Créer la fiche · ' + selCount + ' produit' + (selCount > 1 ? 's' : '') + '\n' +
      '            </button>\n' +
      '          </div>\n' +
      '        </div>\n' +
      '        <div class="mk-picker-toolbar">\n' +
      '          <input type="text" class="mk-input mk-picker-search" placeholder="🔍 Recherche par nom ou code…" value="' + escapeAttr(seasonPickerSearch) + '" oninput="window.mkPickerSearch(this.value)" />\n' +
      '          <div class="mk-picker-quick">\n' +
      '            <button class="mk-btn-sm mk-btn-sm-primary" onclick="window.mkPickerResetDedup()">⭐ Top 30 sans doublon</button>\n' +
      '            <button class="mk-btn-sm" onclick="window.mkPickerSelectTop(30)">Top 30 pool</button>\n' +
      '            <button class="mk-btn-sm" onclick="window.mkPickerSelectTop(50)">Top 50</button>\n' +
      '            <button class="mk-btn-sm" onclick="window.mkPickerSelectTop(' + totalPool + ')">Tout cocher</button>\n' +
      '            <button class="mk-btn-sm" onclick="window.mkPickerClearAll()">Tout décocher</button>\n' +
      '            <button class="mk-btn-sm ' + (seasonPickerOnlySelected ? 'on' : '') + '" onclick="window.mkPickerToggleOnlySelected()">' + (seasonPickerOnlySelected ? '✓ Cochés seulement' : 'Voir cochés seulement') + '</button>\n' +
      '          </div>\n' +
      '        </div>\n' +
      '        <div class="mk-picker-stats">\n' +
      '          <div><b>' + selCount + '</b> / ' + totalPool + ' produits sélectionnés' + (q ? ' (' + filtered.length + ' filtrés)' : '') + '</div>\n' +
      (totalQte > 0 ? '          <div>Volume secteur cumulé : <b>' + totalQte.toLocaleString('fr-FR') + ' u</b></div>\n' : '') +
      (totalCa > 0 ? '          <div>CA secteur cumulé : <b>' + eur(totalCa) + '</b></div>\n' : '') +
      (isOff && totalPrix > 0 ? '          <div>Prix Offilog cumulé : <b>' + eur(totalPrix) + '</b></div>\n' : '') +
      '        </div>\n' +
      '        <div class="mk-modal-body mk-picker-body">\n' +
      '          <div class="mk-picker-list">\n' +
      renderPickerRows(filtered) +
      '          </div>\n' +
      (filtered.length === 0 ? '          <div class="mk-empty-search" style="padding:32px;text-align:center">Aucun produit ne correspond.</div>' : '') +
      '        </div>\n' +
      '      </div>\n    ';
    var existing = document.getElementById('mk-season-picker');
    if (existing) existing.outerHTML = html.replace('<div class="mk-modal mk-season-picker-modal">', '<div class="mk-modal mk-season-picker-modal" id="mk-season-picker">');
    else {
      var wrap = document.createElement('div');
      wrap.id = 'mk-season-picker';
      wrap.innerHTML = html;
      document.body.appendChild(wrap.firstElementChild);
      var firstChild = document.body.lastElementChild;
      if (firstChild) firstChild.id = 'mk-season-picker';
    }
  }

  function renderPickerRows(list) {
    return list.map(function (p, i) {
      var key = getProductKey(p);
      var checked = seasonPickerSelectedKeys.has(key);
      var name = String(p.designation || p.produit || '').replace(/&amp;/g, '&');
      var code = String(p.cip13 || p.ean || p.artcode || '');
      var prix = p.prix_offilog || p.prix_ip || 0;
      var prixHt = p.prix_ht || p.prix_maxi || 0;
      var secQte = p._sec_qte || 0;
      var img = p.img || '';
      var isOff = seasonPickerSource === 'offilog';
      var codeLabel = isOff ? 'EAN' : 'CIP';
      return '<label class="mk-picker-row ' + (checked ? 'on' : '') + '">' +
        '<input type="checkbox" ' + (checked ? 'checked' : '') + ' onchange="window.mkPickerToggle(\'' + key + '\')" />' +
        '<span class="mk-picker-thumb">' + (img ? '<img src="' + escapeAttr(img) + '" alt="" loading="lazy" width="44" height="44" onerror="this.style.display=&quot;none&quot;"/>' : '<span class="mk-picker-thumb-ph">💊</span>') + '</span>' +
        '<span class="mk-picker-info">' +
          '<span class="mk-picker-name">' + escapeAttr(name) + '</span>' +
          '<span class="mk-picker-meta">' +
            codeLabel + ' ' + escapeAttr(code) +
            (p.marque ? ' · ' + escapeAttr(p.marque) : '') +
            (p.univers ? ' · ' + escapeAttr(p.univers) : '') +
          '</span>' +
        '</span>' +
        '<span class="mk-picker-prices">' +
          (prixHt > 0 && prixHt !== prix ? '<span class="mk-picker-price-old">' + eur(prixHt) + '</span>' : '') +
          '<span class="mk-picker-price">' + eur(prix) + '</span>' +
        '</span>' +
        (secQte > 0 ? '<span class="mk-picker-qte">' + secQte.toLocaleString('fr-FR') + 'u</span>' : '<span class="mk-picker-qte mk-picker-qte-empty">—</span>') +
        '<span class="mk-picker-rank">#' + (i + 1) + '</span>' +
        '</label>';
    }).join('');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PLANNING TOP 30 DEDUPLIQUE — chaque mois recoit 30 produits distincts
  // des autres mois. Sinon faire des fiches mensuelles n'a pas de sens.
  // Algo greedy : on parcourt les mois dans l'ordre (mois courant prioritaire)
  // et chaque mois consomme les 30 premiers de son pool encore disponibles.
  // ═══════════════════════════════════════════════════════════════════════
  let __planning30CacheGr = null;
  let __planning30CacheOff = null;
  function invalidatePlanningCaches() { __planning30CacheGr = null; __planning30CacheOff = null; }

  function getPlanning30Grossiste(monthsAhead) {
    if (__planning30CacheGr) return __planning30CacheGr;
    const planning = getMonthPlanning(monthsAhead || 12);
    const seen = new Set();
    // Pool fallback = TOP BENCHMARK par ip_qty desc (vrais bestsellers IP
    // grossiste). Source robuste : BENCHMARK est obligatoirement charge sur
    // la page marketing, pas de dependance fragile a OPS_AGGREGATE.
    const salesIdx = (typeof buildSalesByEan === 'function') ? buildSalesByEan() : null;
    const fallbackPool = (window.BENCHMARK || [])
      .filter(b => b.prix_ip > 0 && b.cip13)
      .sort((a, b) => (b.ip_qty || 0) - (a.ip_qty || 0))
      .slice(0, 500)
      .map(b => {
        const sales = salesIdx ? (salesIdx.get(String(b.cip13)) || { qte: 0, ca: 0 }) : { qte: 0, ca: 0 };
        b._sec_qte = sales.qte;
        b._sec_ca = sales.ca;
        return b;
      });

    const out = planning.map(m => {
      const pool = themeProducts(m.theme);
      const unique = pool.filter(p => !seen.has(String(p.cip13)));
      let top30 = unique.slice(0, 30);
      let completedFromFallback = 0;
      if (top30.length < 30 && fallbackPool.length) {
        for (let i = 0; i < fallbackPool.length && top30.length < 30; i++) {
          const p = fallbackPool[i];
          const key = String(p.cip13);
          if (seen.has(key)) continue;
          if (top30.find(x => String(x.cip13) === key)) continue;
          top30.push(p);
          completedFromFallback++;
        }
      }
      top30.forEach(p => seen.add(String(p.cip13)));
      return Object.assign({}, m, {
        pool: pool,
        top30: top30,
        dedupRemoved: pool.length - unique.length,
        completedFromFallback: completedFromFallback,
      });
    });
    __planning30CacheGr = out;
    return out;
  }

  function getPlanning30Offilog(monthsAhead) {
    if (__planning30CacheOff) return __planning30CacheOff;
    const planning = getOffilogPlanning(monthsAhead || 12);
    const seen = new Set();
    // Pool fallback OFFILOG = top vendeurs parapharma global (rang_vente)
    const fallbackOff = (window.OFFILOG || [])
      .filter(o => o.dans_offilog && o.prix_offilog > 0)
      .sort((a, b) => (a.rang_vente || 99999) - (b.rang_vente || 99999));

    const out = planning.map(m => {
      const pool = m.theme ? themeProductsOffilog(m.theme) : [];
      const unique = pool.filter(o => !seen.has(String(o.ean)));
      let top30 = unique.slice(0, 30);
      let completedFromFallback = 0;
      if (top30.length < 30 && fallbackOff.length) {
        for (const o of fallbackOff) {
          if (top30.length >= 30) break;
          const key = String(o.ean);
          if (seen.has(key)) continue;
          if (top30.find(x => String(x.ean) === key)) continue;
          top30.push(o);
          completedFromFallback++;
        }
      }
      top30.forEach(o => seen.add(String(o.ean)));
      return Object.assign({}, m, {
        pool: pool,
        top30: top30,
        dedupRemoved: pool.length - unique.length,
        completedFromFallback: completedFromFallback,
      });
    });
    __planning30CacheOff = out;
    return out;
  }

  // Recupere le top 30 deduplique pour un offset mois donne (grossiste)
  function getMonthTop30Grossiste(offset) {
    const planning = getPlanning30Grossiste(12);
    return (planning[offset] && planning[offset].top30) || [];
  }
  function getMonthTop30Offilog(offset) {
    const planning = getPlanning30Offilog(12);
    return (planning[offset] && planning[offset].top30) || [];
  }

  // Planning prévisionnel : pour chaque mois (relatif 0..11), retourne le
  // theme COMPOSITE (fusion de tous les themes actifs ce mois-la).
  function getMonthPlanning(monthsAhead) {
    const now = new Date();
    const out = [];
    for (let i = 0; i <= monthsAhead; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const month = d.getMonth() + 1; // 1..12
      const theme = getCompositeThemeForMonth(month);
      out.push({
        offset: i,
        date: d,
        monthName: d.toLocaleDateString('fr-FR', { month: 'long' }),
        monthLabel: d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        theme: theme,
      });
    }
    return out;
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
      products: themeProducts(t).slice(0, 20).map(snapshotProduct),
    };
  }

  // ── TEMPLATES DISPONIBLES ───────────────────────────────────
  const TEMPLATES = {
    offre:     { name: 'Offre IP',          maxProducts: 500, defaultCount: 25, perPage: 14 },
    memo:      { name: 'Mémo référentiel',  maxProducts: 500, defaultCount: 25, perPage: 22 },
    focus:     { name: 'Focus produit',     maxProducts: 12,  defaultCount: 1,  perPage: 3  },
    bento:     { name: 'Bento (Apple)',     maxProducts: 120, defaultCount: 12, perPage: 9  },
  };

  function getTemplateId(sheet) {
    const t = (sheet && sheet.template) || 'offre';
    return TEMPLATES[t] ? t : 'offre';
  }

  // ── FILTRES PRODUITS ────────────────────────────────────────
  function themeProducts(theme) {
    // CANAL GROSSISTE IP UNIQUEMENT (BENCHMARK).
    // OFFILOG = parapharmacie direct labo (autre canal de vente, pas de mix).
    // Si tu veux faire une fiche OFFILOG, utilise le panel OFFILOG separe.
    if (!window.BENCHMARK) return [];
    const salesIdx = (typeof buildSalesByEan === 'function') ? buildSalesByEan() : null;
    if (theme.id === 'top') {
      return [...window.BENCHMARK]
        .filter(theme.filter)
        .sort((a,b) => (a.ip_rank_qty||999) - (b.ip_rank_qty||999));
    }
    const list = window.BENCHMARK
      .filter(b => b.prix_ip > 0)
      .filter(theme.filter)
      .map(b => {
        const sales = salesIdx ? (salesIdx.get(String(b.cip13)) || { qte: 0, ca: 0 }) : { qte: 0, ca: 0 };
        b._sec_qte = sales.qte;
        b._sec_ca = sales.ca;
        return b;
      });
    list.sort((a,b) => {
      if (b._sec_qte !== a._sec_qte) return b._sec_qte - a._sec_qte;
      return (b.ip_qty || 0) - (a.ip_qty || 0);
    });
    return list;
  }

  function snapshotProduct(b) {
    // Resout l'image OFFILOG par EAN/CIP7/nom — sinon les fiches PDF des
    // produits BENCHMARK grossiste n'ont jamais d'image (BENCHMARK ne porte
    // pas img). resolveImage est hoistee (function declaration).
    let resolved = '';
    try {
      if (typeof resolveImage === 'function') {
        resolved = resolveImage(b.cip13, b.designation) || '';
      }
    } catch (e) {}
    return {
      cip13: b.cip13 || '',
      designation: b.designation || '',
      conditionnement: extractConditionnement(b.designation || ''),
      prix_ht: Number(b.prix_ht || 0),
      prix_ip: Number(b.prix_ip || 0),
      ppht: Number(b.prix_ht || 0),
      offre_ip: Number(b.offre_ip || 0),
      remise_pct: Number(b.remise_pct || 0),
      img: resolved,
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

  // Memoize : la liste des univers OFFILOG ne change pas une fois OFFILOG charge,
  // pas la peine de reconstruire un Set + tri a chaque render (3 520 produits scannes).
  let __offilogUniversesCache = null;
  function getOfflogUniverses() {
    if (!window.OFFILOG) return [];
    if (__offilogUniversesCache) return __offilogUniversesCache;
    const set = new Set();
    window.OFFILOG.forEach(o => {
      const u = (o.univers || '').trim();
      if (u && u !== 'Non classé' && u !== '') set.add(u);
    });
    __offilogUniversesCache = Array.from(set).sort();
    return __offilogUniversesCache;
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
  let statsCatalogue = 'all';// 'all' | 'integral' | 'itp'
  let mkPage = 'grossiste';  // 'grossiste' (IP / canal grossiste) | 'offilog' (parapharma direct labo)
  // Picker saisonnier : selection composable avant creation de fiche.
  // On y voit TOUS les produits du theme (peut etre 245+), top 20 precoche,
  // l'utilisateur ajuste puis valide.
  let seasonPickerOpen = false;
  let seasonPickerThemeId = null;  // 'allergies', '__month_6', '__off_month_6', etc.
  let seasonPickerSource = 'grossiste'; // 'grossiste' (BENCHMARK) | 'offilog' (OFFILOG)
  let seasonPickerSelectedKeys = new Set();
  let seasonPickerSearch = '';
  let seasonPickerOnlySelected = false;
  let sagittaStatus = 'all'; // 'all' | 'ip_win' | 'ip_lose' | 'no_ip'
  let sagittaSearch = '';
  let sagittaSort   = 'volume'; // 'volume' | 'ecart_pct' | 'ecart_eur' | 'gain'
  let selectedSheetIds = new Set();  // selection multi-fiches pour export PDF combine

  // ── DEBOUNCE pour les inputs de recherche ──────────────────
  // Sans debounce, chaque keystroke declenchait un renderEdit() complet :
  // re-render Sagitta (jusqu'a 80 cards + images), OFFILOG grid (jusqu'a 40
  // tuiles + images), liste produit BENCHMARK (30 lignes). En tapant 8 lettres
  // -> 8 full re-renders en moins de 500 ms -> input laggy sur iPhone.
  // 180 ms = compromis "perception instantane" (sous 200 ms) et batching reel.
  function debounce(fn, wait) {
    let t = null;
    return function () {
      const ctx = this;
      const args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () { t = null; fn.apply(ctx, args); }, wait || 180);
    };
  }
  // Helper : restaure le focus + la position du curseur dans un input apres
  // un re-render complet du root (innerHTML rebuild). Cible le 1er input
  // matching selector. Utilise par les setters de recherche debouncees.
  function restoreFocus(selector, value) {
    const root = getRoot() || document;
    const el = root.querySelector(selector);
    if (!el) return;
    try {
      el.focus();
      const len = (value != null ? String(value) : (el.value || '')).length;
      if (typeof el.setSelectionRange === 'function') el.setSelectionRange(len, len);
    } catch (e) { /* old browsers */ }
  }

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

  // Filtre catalogue marketing (L'Integral mars 2026 ou Catalogue ITP juin 2026)
  // Permet a Will de voir UNIQUEMENT les top ventes secteur qui sont dans son
  // catalogue commercial actif -> argumentaire direct sur le PDF en main.
  function filterByCatalogue(list, cat) {
    if (!cat || cat === 'all') return list;
    if (cat === 'integral') {
      var codes = window.CATALOGUE_INTEGRAL_CODES;
      if (!codes) return list;
      return list.filter(function (p) {
        var ean = String(p.ean || '');
        var ac = String(p.artcode || '');
        // Match par EAN/CIP13 complet, CIP7 fin, ou artcode
        return codes.has(ean) || codes.has(ac)
          || (ean.length >= 7 && codes.has(ean.slice(-7)))
          || (ac.length >= 7 && codes.has(ac.slice(-7)));
      });
    }
    if (cat === 'itp') {
      var rx = window.CATALOGUE_ITP_REGEX;
      if (!rx) return list;
      return list.filter(function (p) {
        return rx.test(p.designation || '') || rx.test(p.marque || '');
      });
    }
    return list;
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
      source: 'ip',
      img: resolveImage(prod.ean || prod.artcode, prod.designation),
    };
    if (!editingSheet) {
      // Pas d'edition en cours -> cree une fiche custom et arrive sur l'editeur
      editingSheet = newSheet('custom');
      editingSheet.title = 'Fiche depuis top ventes';
      editingSheet.products = [snap];
      if (typeof celebrateFirstProduct === 'function') celebrateFirstProduct();
    } else {
      var cap = TEMPLATES[getTemplateId(editingSheet)].maxProducts;
      if (editingSheet.products.length >= cap) {
        if (typeof window.showToast === 'function') {
          window.showToast('Limite ' + cap + ' produits atteinte pour ce template', 'info');
        }
        return;
      }
      if (editingSheet.products.find(function (p) { return p.artcode === artcode || p.cip13 === snap.cip13; })) return;
      var wasEmpty = editingSheet.products.length === 0;
      editingSheet.products.push(snap);
      if (wasEmpty && typeof celebrateFirstProduct === 'function') celebrateFirstProduct();
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
  window.mkSetStatsCatalogue = function (id) {
    statsCatalogue = id;
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

  window.mkSetPage = function (id) {
    if (id !== 'grossiste' && id !== 'offilog') return;
    mkPage = id;
    window.renderMarketing();
    // Scroll en haut de la page apres switch de tab
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  };

  function renderPageTabs() {
    return `
      <div class="mk-pagetabs">
        <button class="mk-pagetab ${mkPage==='grossiste'?'on':''}" onclick="window.mkSetPage('grossiste')">
          <span class="mk-pagetab-emoji">💊</span>
          <div class="mk-pagetab-text">
            <div class="mk-pagetab-title">Grossiste IP</div>
            <div class="mk-pagetab-sub">Catalogue médicaments · CIP · marché OPS+CPR+HP</div>
          </div>
        </button>
        <button class="mk-pagetab ${mkPage==='offilog'?'on':''}" onclick="window.mkSetPage('offilog')">
          <span class="mk-pagetab-emoji">🧴</span>
          <div class="mk-pagetab-text">
            <div class="mk-pagetab-title">Parapharma OFFILOG</div>
            <div class="mk-pagetab-sub">Direct labo · EAN · 3 520 réfs + 2 242 images</div>
          </div>
        </button>
      </div>
    `;
  }

  window.renderMarketing = function () {
    const root = getRoot();
    if (!root) return;
    if (mkPage === 'offilog') {
      return renderMarketingOffilog(root);
    }
    return renderMarketingGrossiste(root);
  };

  function renderMarketingGrossiste(root) {
    const sheets = loadSheets();
    const suggested = getCurrentSeasonTheme();
    const ipOffers = getIpOffers();
    // Top 3 produits pathologies du mois (tries par volume secteur OPS+CPR+HP)
    const monthProds = themeProducts(suggested);
    const topMonth = monthProds.slice(0, 3);
    const totalSecQte = monthProds.reduce((s, b) => s + (b._sec_qte || 0), 0);
    const totalSecCa  = monthProds.reduce((s, b) => s + (b._sec_ca  || 0), 0);
    const monthName = new Date().toLocaleDateString('fr-FR', { month: 'long' });

    root.innerHTML = `
      <div class="mk-wrap">
        ${renderPageTabs()}
        <div class="mk-hero mk-hero-month">
          <div class="mk-hero-main">
            <div class="mk-hero-left">
              <div class="mk-hero-emoji">${suggested.emoji}</div>
              <div>
                <div class="mk-hero-eyebrow">${suggested._pitch && suggested._pitch.eyebrow ? escapeAttr(suggested._pitch.eyebrow) : ('Suggestion ' + monthName + ' · canal grossiste IP')}</div>
                ${suggested._pitch && suggested._pitch.headline ? `<div class="mk-hero-headline-pitch">${escapeAttr(suggested._pitch.headline)}</div>` : ''}
                <div class="mk-hero-title">${suggested.name}</div>
                <div class="mk-hero-sub">${suggested._pitch && suggested._pitch.pitch_short ? escapeAttr(suggested._pitch.pitch_short) : (monthProds.length + ' médicaments catalogue IP triés par volumes secteur OPS+CPR+HP décroissants')}</div>
                ${suggested._pitch && suggested._pitch.cta_line ? `<div class="mk-hero-cta-line" onclick="window.mkOpenSeasonPicker('${suggested.id}', 'grossiste')">${escapeAttr(suggested._pitch.cta_line)}</div>` : ''}
                ${suggested._pitch && suggested._pitch.accent_quote ? `<div class="mk-hero-quote">« ${escapeAttr(suggested._pitch.accent_quote)} »</div>` : ''}
              </div>
            </div>
            <button class="mk-btn mk-btn-primary" onclick="window.mkOpenSeasonPicker('${suggested.id}', 'grossiste')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Composer la fiche · ${monthProds.length} dispos
            </button>
          </div>
          ${topMonth.length && totalSecQte > 0 ? `
            <div class="mk-hero-stats">
              <div class="mk-hero-stat">
                <div class="mk-hero-stat-num">${totalSecQte.toLocaleString('fr-FR')}</div>
                <div class="mk-hero-stat-lbl">unités vendues secteur</div>
              </div>
              <div class="mk-hero-stat">
                <div class="mk-hero-stat-num">${eur(totalSecCa)}</div>
                <div class="mk-hero-stat-lbl">CA secteur cumulé</div>
              </div>
              <div class="mk-hero-top">
                <div class="mk-hero-top-lbl">Top vendeurs ${monthName}</div>
                <div class="mk-hero-top-list">
                  ${topMonth.map((b, i) => `
                    <div class="mk-hero-top-row">
                      <span class="mk-hero-top-rank">#${i+1}</span>
                      <span class="mk-hero-top-name" title="${escapeAttr(b.designation)}">${escapeAttr(b.designation.slice(0, 38))}${b.designation.length > 38 ? '…' : ''}</span>
                      <span class="mk-hero-top-qte">${(b._sec_qte || 0).toLocaleString('fr-FR')} u</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        ${(() => {
          // Planning DEDUPLIQUE : chaque mois recoit 30 produits distincts
          // (pas de doublons inter-mois, sinon fiches mensuelles inutiles).
          const planning = getPlanning30Grossiste(12);
          return `
            <div class="mk-section-planning">
              <div class="mk-section-head">
                <div>
                  <div class="mk-section-title">📅 Planning des suggestions · top 30 par mois <span class="mk-section-badge">SANS DOUBLON</span></div>
                  <div class="mk-section-sub">Mois courant + 12 à venir · top 30 PRODUITS DISTINCTS par mois (algo greedy) · click une card pour composer la fiche</div>
                </div>
              </div>
              <div class="mk-planning-grid">
                ${planning.map(m => {
                  const list = m.top30;
                  const top5 = list.slice(0, 5);
                  const totalQte30 = list.reduce((s, b) => s + (b._sec_qte || 0), 0);
                  const totalCa30  = list.reduce((s, b) => s + (b._sec_ca  || 0), 0);
                  const isNow = m.offset === 0;
                  const isNext = m.offset === 1;
                  const cardClass = isNow ? 'mk-month-card-now' : (isNext ? 'mk-month-card-next' : '');
                  const pinClass = isNow ? '' : (isNext ? 'mk-month-card-pin-next' : '');
                  const pinTxt = isNow ? 'CE MOIS' : (isNext ? 'MOIS +1' : (m.offset === 12 ? 'N+1' : ''));
                  return `
                    <div class="mk-month-card ${cardClass}"
                      title="Top 30 ${escapeAttr(m.theme.name)} pour ${escapeAttr(m.monthName)} (sans doublon)">
                      <div class="mk-month-card-eyebrow">
                        <span>${escapeAttr(m.monthLabel)}</span>
                        ${pinTxt ? `<span class="mk-month-card-pin ${pinClass}">${pinTxt}</span>` : ''}
                      </div>
                      <div class="mk-month-card-month">
                        <span class="mk-month-card-emoji">${m.theme.emoji}</span>
                        ${escapeAttr(m.monthName)}
                      </div>
                      <div class="mk-month-card-theme">${escapeAttr((m.theme._pitch && m.theme._pitch.headline) || m.theme.name)}</div>
                      ${m.theme._pitch && m.theme._pitch.pitch_short ? `<div class="mk-month-card-pitch">${escapeAttr(m.theme._pitch.pitch_short)}</div>` : ''}
                      <div class="mk-month-card-meta">${list.length} produits · ${totalQte30.toLocaleString('fr-FR')} u secteur (${eur(totalCa30)})${m.completedFromFallback > 0 ? ` · <span class="mk-card-fallback-tag">+${m.completedFromFallback} top vendeurs marché</span>` : ''}</div>
                      ${top5.length ? `
                        <div class="mk-month-card-top5">
                          ${top5.map((p, i) => `
                            <div class="mk-month-card-top5-row">
                              <span class="mk-month-card-top-rank">#${i+1}</span>
                              <span class="mk-month-card-top5-name" title="${escapeAttr(p.designation)}">${escapeAttr((p.designation || '').slice(0, 30))}${(p.designation || '').length > 30 ? '…' : ''}</span>
                              ${p._sec_qte > 0 ? `<span class="mk-month-card-top5-qte">${(p._sec_qte).toLocaleString('fr-FR')}u</span>` : ''}
                            </div>
                          `).join('')}
                          ${list.length > 5 ? `<div class="mk-month-card-more">+ ${list.length - 5} autres dans le top 30</div>` : ''}
                        </div>
                      ` : ''}
                      <button class="mk-month-card-cta" onclick="window.mkOpenSeasonPicker('${m.theme.id}', 'grossiste', ${m.offset})">
                        Composer la fiche · ${m.pool.length} dispos →
                      </button>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        })()}

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
          const trancheList = filterByTranche(baseList, statsTranche);
          const list = filterByCatalogue(trancheList, statsCatalogue);
          const top100 = list.slice(0, 100);
          const totalCa = top100.reduce(function (s, p) { return s + p.ca; }, 0);
          const integralCount = (window.CATALOGUE_INTEGRAL || []).length;
          const itpCount = (window.CATALOGUE_ITP_MARKETING || []).length;
          const cataloguePills = [
            { id: 'all',      label: 'Tous catalogues',  sub: '',                   icon: '📊' },
            { id: 'integral', label: 'L’Intégral',  sub: integralCount + ' refs · mars 2026', icon: '📘' },
            { id: 'itp',      label: 'Catalogue ITP',    sub: itpCount + ' refs · juin 2026',     icon: '📕' },
          ];
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
              <div class="mk-stats-filters-label">Catalogue commercial <span class="mk-stats-filters-hint">· focus sur tes PDF en main</span></div>
              <div class="mk-stats-pills mk-stats-pills-tranches">
                ${cataloguePills.map(t => `
                  <button class="mk-stats-pill mk-stats-pill-tranche mk-stats-pill-cat ${statsCatalogue===t.id?'on':''}"
                    onclick="window.mkSetStatsCatalogue('${t.id}')">
                    <span>${t.icon} ${escapeAttr(t.label)}</span>
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
                ${list.length === 0 ? `
                  <div class="mk-empty" style="padding:24px 18px;text-align:center;color:#64748B">
                    <span style="font-size:22px;display:block;margin-bottom:6px">🧭</span>
                    Aucune vente sur cette combinaison <b>famille × tranche</b>.<br>
                    <span style="font-size:11px;opacity:.7">Élargis la sélection (Top global, Tous prix) pour voir le marché complet</span>
                  </div>
                ` : ''}
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
              <span style="font-size:38px;display:block;margin-bottom:8px">📂</span>
              <b style="color:#0B1F4D;font-size:15px">Aucune fiche enregistrée</b><br>
              <span style="font-size:13px">Démarre depuis un <b>thème de saison</b>, une <b>catégorie thérapeutique</b>,
              le comparatif <b>Sagitta NR</b> ou une <b>sélection libre</b>.</span><br>
              <span style="font-size:11.5px;opacity:.7;display:block;margin-top:8px">Tout est sauvegardé automatiquement — Supabase si connecté, sinon localStorage</span>
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
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE OFFILOG — Parapharma direct labo (canal distinct du grossiste)
  // ═══════════════════════════════════════════════════════════════════════
  function renderMarketingOffilog(root) {
    if (!window.OFFILOG) {
      root.innerHTML = `
        <div class="mk-wrap">
          ${renderPageTabs()}
          <div class="mk-section" style="text-align:center;padding:60px 20px;color:#64748B">
            Chargement du catalogue OFFILOG… (3 520 références)
          </div>
        </div>
      `;
      return;
    }
    const monthIdx = new Date().getMonth() + 1;
    const suggestedOff = getCompositeOffilogThemeForMonth(monthIdx);
    const monthList = suggestedOff ? themeProductsOffilog(suggestedOff) : [];
    const top5 = monthList.slice(0, 5);
    const top20 = monthList.slice(0, 20);
    const totalTop20Off = top20.reduce((s, o) => s + (o.prix_offilog || 0), 0);
    const monthName = new Date().toLocaleDateString('fr-FR', { month: 'long' });
    const planning = getPlanning30Offilog(12);
    // Univers OFFILOG (Solaires, Capillaire, Dermo…) avec count
    const universes = {};
    window.OFFILOG.forEach(o => {
      if (!o.dans_offilog || !o.prix_offilog) return;
      const u = (o.univers || 'Autres').trim() || 'Autres';
      if (u === 'Non classé' || u === '') return;
      universes[u] = (universes[u] || 0) + 1;
    });
    const topUniverses = Object.entries(universes).sort((a, b) => b[1] - a[1]).slice(0, 8);

    root.innerHTML = `
      <div class="mk-wrap">
        ${renderPageTabs()}

        <div class="mk-hero mk-hero-month mk-hero-offilog">
          <div class="mk-hero-main">
            <div class="mk-hero-left">
              <div class="mk-hero-emoji">${suggestedOff ? suggestedOff.emoji : '🧴'}</div>
              <div>
                <div class="mk-hero-eyebrow">Parapharma OFFILOG · ${monthName}</div>
                <div class="mk-hero-title">${suggestedOff ? escapeAttr(suggestedOff.name) : 'Aucune saison active'}</div>
                <div class="mk-hero-sub">${monthList.length} références OFFILOG triées par <b>rang de vente parapharma</b> · top 20 = ${eur(totalTop20Off)} prix Offilog cumulé</div>
              </div>
            </div>
          </div>
          ${top5.length ? `
            <div class="mk-hero-stats">
              <div class="mk-hero-top" style="grid-column:1/-1">
                <div class="mk-hero-top-lbl">Top 5 parapharma ${monthName}</div>
                <div class="mk-hero-top-list">
                  ${top5.map((o, i) => `
                    <div class="mk-hero-top-row">
                      <span class="mk-hero-top-rank">#${i+1}</span>
                      <span class="mk-hero-top-name" title="${escapeAttr((o.produit||'').replace(/&amp;/g,'&'))}">${escapeAttr(((o.produit||'').replace(/&amp;/g,'&')).slice(0, 60))}</span>
                      <span class="mk-hero-top-qte">${eur(o.prix_offilog)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="mk-section-planning">
          <div class="mk-section-head">
            <div>
              <div class="mk-section-title">📅 Planning OFFILOG · top 30 parapharma par mois <span class="mk-section-badge">SANS DOUBLON</span></div>
              <div class="mk-section-sub">Mois courant + 12 à venir · top 30 produits parapharma DISTINCTS par mois · click pour composer la fiche</div>
            </div>
          </div>
          <div class="mk-planning-grid">
            ${planning.map(m => {
              const list = m.top30;
              const top5p = list.slice(0, 5);
              const isNow = m.offset === 0;
              const isNext = m.offset === 1;
              const cardClass = isNow ? 'mk-month-card-now' : (isNext ? 'mk-month-card-next' : '');
              const pinClass = isNow ? '' : (isNext ? 'mk-month-card-pin-next' : '');
              const pinTxt = isNow ? 'CE MOIS' : (isNext ? 'MOIS +1' : (m.offset === 12 ? 'N+1' : ''));
              if (!m.theme) {
                return `
                  <div class="mk-month-card ${cardClass}">
                    <div class="mk-month-card-eyebrow">
                      <span>${escapeAttr(m.monthLabel)}</span>
                      ${pinTxt ? `<span class="mk-month-card-pin ${pinClass}">${pinTxt}</span>` : ''}
                    </div>
                    <div class="mk-month-card-month">⚪ ${escapeAttr(m.monthName)}</div>
                    <div class="mk-month-card-theme">Hors saison parapharma</div>
                    <div class="mk-month-card-meta">Aucune patho saisonnière dominante</div>
                  </div>
                `;
              }
              return `
                <div class="mk-month-card ${cardClass}">
                  <div class="mk-month-card-eyebrow">
                    <span>${escapeAttr(m.monthLabel)}</span>
                    ${pinTxt ? `<span class="mk-month-card-pin ${pinClass}">${pinTxt}</span>` : ''}
                  </div>
                  <div class="mk-month-card-month">
                    <span class="mk-month-card-emoji">${m.theme.emoji}</span>
                    ${escapeAttr(m.monthName)}
                  </div>
                  <div class="mk-month-card-theme">${escapeAttr(m.theme.name)}</div>
                  <div class="mk-month-card-meta">${list.length} parapharma${m.completedFromFallback > 0 ? ` · <span class="mk-card-fallback-tag">+${m.completedFromFallback} top vendeurs OFFILOG</span>` : ''}</div>
                  ${top5p.length ? `
                    <div class="mk-month-card-top5">
                      ${top5p.map((o, i) => `
                        <div class="mk-month-card-top5-row">
                          <span class="mk-month-card-top-rank">#${i+1}</span>
                          <span class="mk-month-card-top5-name" title="${escapeAttr((o.produit||'').replace(/&amp;/g,'&'))}">${escapeAttr(((o.produit||'').replace(/&amp;/g,'&')).slice(0, 28))}${(o.produit||'').length > 28 ? '…' : ''}</span>
                          <span class="mk-month-card-top5-qte">${eur(o.prix_offilog)}</span>
                        </div>
                      `).join('')}
                      ${list.length > 5 ? `<div class="mk-month-card-more">+ ${list.length - 5} autres dans le top 30</div>` : ''}
                    </div>
                  ` : ''}
                  <button class="mk-month-card-cta" onclick="window.mkOpenSeasonPicker('${m.theme.id}', 'offilog', ${m.offset})">
                    Composer la fiche · ${m.pool.length} dispos →
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="mk-section">
          <div class="mk-section-head">
            <div>
              <div class="mk-section-title">📦 Top 20 OFFILOG par univers</div>
              <div class="mk-section-sub">Catégories parapharma classées par nombre de références</div>
            </div>
          </div>
          <div class="mk-off-univers-grid">
            ${topUniverses.map(([u, count]) => `
              <button class="mk-off-univers-card" onclick="window.mkStartOffilogUnivers('${escapeAttr(u).replace(/'/g, '&#39;')}')">
                <div class="mk-off-univers-name">${escapeAttr(u)}</div>
                <div class="mk-off-univers-count">${count} réfs</div>
                <div class="mk-off-univers-cta">Voir top 20 →</div>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // Cree une fiche OFFILOG depuis le planning d'un mois donne
  window.mkStartOffilogMonth = function (offset) {
    const d = new Date();
    d.setMonth(d.getMonth() + (offset || 0));
    const month = d.getMonth() + 1;
    const theme = getCompositeOffilogThemeForMonth(month);
    if (!theme) {
      if (typeof window.showToast === 'function') window.showToast('Aucune saison parapharma sur ce mois', 'info');
      return;
    }
    const list = themeProductsOffilog(theme).slice(0, 20);
    editingSheet = {
      id: 'mk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: 'OFFILOG ' + theme.name + ' — ' + d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      theme: 'custom',
      color: 'amber',
      footer: 'Tarifs OFFILOG ' + d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      template: 'offre',
      products: list.map(snapshotOffilogProduct),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    renderEdit();
  };

  // Cree une fiche OFFILOG depuis un univers (Solaires, Capillaire…)
  window.mkStartOffilogUnivers = function (univers) {
    if (!window.OFFILOG) return;
    const list = window.OFFILOG
      .filter(o => o.dans_offilog && o.prix_offilog > 0 && (o.univers || '').trim() === univers)
      .sort((a, b) => (a.rang_vente || 99999) - (b.rang_vente || 99999))
      .slice(0, 20);
    if (!list.length) {
      if (typeof window.showToast === 'function') window.showToast('Univers vide', 'info');
      return;
    }
    editingSheet = {
      id: 'mk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: 'OFFILOG · ' + univers,
      theme: 'custom',
      color: 'amber',
      footer: 'Tarifs OFFILOG ' + new Date().getFullYear(),
      template: 'offre',
      products: list.map(snapshotOffilogProduct),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    renderEdit();
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
  // ============================================================
  // REFONTE V2 — Foundation (Topbar + Rail + Canvas live)
  // Feature flag : window.MK_REFONTE_ENABLED ou URL ?refonte=1
  // ============================================================
  function isRefonteV2() {
    if (window.MK_REFONTE_ENABLED === true) return true;
    try {
      if (new URLSearchParams(location.search).get('refonte') === '1') {
        window.MK_REFONTE_ENABLED = true;
        return true;
      }
    } catch (e) {}
    return false;
  }
  window.mkIsRefonteV2 = isRefonteV2;

  function renderEdit() {
    if (isRefonteV2()) return renderEditV2();
    return renderEditV1();
  }
  function renderEditV1() {
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
              <label class="mk-label" style="margin-top:14px">Palette de couleur</label>
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
              <div class="mk-color-group">
                <div class="mk-color-group-label">Neutres <span class="mk-color-badge mk-color-badge-neutral">CLEAN</span></div>
                <div class="mk-color-row">
                  ${Object.entries(COLOR_PRESETS).filter(([,v]) => v.category === 'neutral').map(([k,v]) => `
                    <button class="mk-color ${s.color===k?'on':''}" title="${v.name}"
                      style="background:${v.bg};border-color:${v.accent}"
                      onclick="window.mkUpdateColor('${k}')"></button>
                  `).join('')}
                </div>
              </div>
              <label class="mk-label mk-toggle-label" style="margin-top:14px">
                <input type="checkbox" ${s.hideImages ? 'checked' : ''} onchange="window.mkUpdateHideImages(this.checked)" />
                <span>🚫 Masquer les images des produits</span>
              </label>
              <label class="mk-label" style="margin-top:14px">Template</label>
              <select class="mk-input mk-select" id="sheet-template" onchange="window.mkUpdateTemplate(this.value)">
                <option value="offre" ${getTemplateId(s)==='offre'?'selected':''}>📋 Offre IP (table)</option>
                <option value="memo" ${getTemplateId(s)==='memo'?'selected':''}>📑 Mémo référentiel</option>
                <option value="focus" ${getTemplateId(s)==='focus'?'selected':''}>🎯 Focus produit</option>
                <option value="bento" ${getTemplateId(s)==='bento'?'selected':''}>🧩 Bento (Apple)</option>
              </select>
              <div class="mk-template-hint">${TEMPLATES[getTemplateId(s)].name} · ${s.products.length} produit${s.products.length>1?'s':''} · PDF multi-pages auto</div>
              <label class="mk-label" style="margin-top:14px">Footer</label>
              <input class="mk-input" id="mk-footer" value="${escapeAttr(s.footer)}" oninput="window.mkUpdateFooter(this.value)" />
            </div>

            <!-- ═══ DESIGN SYSTEM 2026-2027 ═══ -->
            <div class="mk-card mk-card-ds">
              <div class="mk-card-title">✨ Design Pinterest 2026-2027</div>

              <label class="mk-label">Look prédéfini <span class="mk-label-hint">— 1 clic, tout est réglé</span></label>
              <div class="mk-ds-presets">
                ${Object.entries(window.MK_DESIGN_PRESETS || {}).map(([id, p]) => {
                  const g = (window.MK_GRADIENTS || {})[p.gradient];
                  const previewBg = g && g.preview ? g.preview : '#F2F2F7';
                  const isActive = isCurrentDesignPreset(s, p);
                  return `
                  <button class="mk-ds-preset ${isActive ? 'on' : ''}" onclick="window.mkApplyDesignPreset('${id}')" title="${escapeAttr(p.name)} · template ${escapeAttr(p.template)}">
                    <span class="mk-ds-preset-swatch" style="background:${previewBg}"></span>
                    <span class="mk-ds-preset-name">${escapeAttr(p.name)}</span>
                  </button>
                `;
                }).join('')}
              </div>

              <label class="mk-label" style="margin-top:14px">Gradient mesh</label>
              <div class="mk-ds-grad-row">
                ${Object.entries(window.MK_GRADIENTS || {}).map(([id, g]) => {
                  const isNone = id === 'none';
                  const bgStyle = isNone
                    ? 'background:repeating-linear-gradient(45deg,#FFFFFF,#FFFFFF 5px,#E5E7EB 5px,#E5E7EB 10px)'
                    : 'background:' + (g.preview || g.css || '#F2F2F7');
                  return `
                  <button class="mk-ds-grad ${(s.gradient || 'none') === id ? 'on' : ''}" title="${escapeAttr(g.name)}"
                    style="${bgStyle}"
                    aria-label="Gradient ${escapeAttr(g.name)}"
                    onclick="window.mkUpdateGradient('${id}')">${isNone ? '<span class="mk-ds-none-mark" aria-hidden="true">∅</span>' : ''}</button>
                `;
                }).join('')}
              </div>

              <label class="mk-label" style="margin-top:14px">Typographie</label>
              <div class="mk-ds-font-row">
                ${Object.entries(window.MK_FONT_PAIRS || {}).map(([id, f]) => {
                  const headingFamily = (f.heading && f.heading.family) || 'DM Sans';
                  const isOn = (s.fontPair || 'default') === id;
                  if (typeof window.mkLoadFontPair === 'function') {
                    try { window.mkLoadFontPair(id); } catch (e) {}
                  }
                  return `
                    <button class="mk-ds-font ${isOn ? 'on' : ''}" onclick="window.mkUpdateFontPair('${id}')" title="${escapeAttr(f.name)}">
                      <span class="mk-ds-font-aa" style="font-family:'${headingFamily}','DM Sans',sans-serif">Aa</span>
                      <span class="mk-ds-font-name">${escapeAttr(f.name)}</span>
                    </button>
                  `;
                }).join('')}
              </div>

              <label class="mk-label" style="margin-top:14px">Pattern (texture)</label>
              <div class="mk-ds-pat-row">
                ${Object.entries(window.MK_PATTERNS || {}).map(([id, p]) => {
                  const isNone = id === 'none';
                  return `
                  <button class="mk-ds-pat ${(s.pattern || 'none') === id ? 'on' : ''}" title="${escapeAttr(p.name)}"
                    style="background-image:${p.css || 'none'};background-color:#F2F2F7"
                    aria-label="Pattern ${escapeAttr(p.name)}"
                    onclick="window.mkUpdatePattern('${id}')">${isNone ? '<span class="mk-ds-none-mark" aria-hidden="true">∅</span>' : ''}</button>
                `;
                }).join('')}
              </div>

              <label class="mk-label" style="margin-top:14px">Sticker / badge</label>
              <div class="mk-ds-stk-row">
                ${Object.entries(window.MK_STICKERS || {}).map(([id, st]) => {
                  const isNone = id === 'none' || !st.svg;
                  const placeholder = '<svg viewBox="0 0 64 64" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-dasharray="4 4"/><path d="M14 14L50 50" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round"/></svg>';
                  const inner = isNone ? placeholder : st.svg;
                  return `
                    <button class="mk-ds-stk ${(s.sticker || 'none') === id ? 'on' : ''}" title="${escapeAttr(st.name)}"
                      aria-label="Sticker ${escapeAttr(st.name)}"
                      onclick="window.mkUpdateSticker('${id}')">${inner}</button>
                  `;
                }).join('')}
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
                <div class="mk-empty-search">
                  <span style="font-size:18px;display:block;margin-bottom:4px">🔍</span>
                  Aucun médicament IP ne correspond à <b>"${escapeAttr(productSearch)}"</b>.<br>
                  <span style="font-size:11px;opacity:.7">Essaie un nom de DCI (paracetamol, ibuprofene…) ou un CIP</span>
                </div>
              ` : `
                <div class="mk-empty-search">
                  <span style="font-size:18px;display:block;margin-bottom:4px">💊</span>
                  Tape 2 lettres pour chercher dans <b>${window.BENCHMARK ? (window.BENCHMARK.length || 0).toLocaleString('fr-FR') : '10 500'}</b> médicaments IP<br>
                  <span style="font-size:11px;opacity:.7">Nom commercial, DCI ou code CIP</span>
                </div>
              `}
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
                <div class="mk-empty-search mk-sel-empty">
                  <span style="font-size:28px;display:block;margin-bottom:6px">🛒</span>
                  <b style="color:#0B1F4D;font-size:14px">Ta fiche est vide</b><br>
                  Ajoute des produits depuis le <b>catalogue IP</b>, <b>OFFILOG parapharmacie</b>
                  ou directement depuis <b>Sagitta NR</b> ou <b>Top ventes secteur</b>.<br>
                  <span style="font-size:11px;opacity:.7;display:block;margin-top:6px">Tu pourras ensuite éditer chaque ligne et lancer l'aperçu live ✨</span>
                </div>
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
                        <button class="mk-btn-icon mk-img-search-btn" title="Trouver une image (Open Products / Google)" onclick="window.mkFindImages(${i})">🔍</button>
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

  // ── ÉCRAN ÉDITION V2 (Refonte Phase 1 Foundation) ──────────
  // Auto-save state machine simplifiée
  let __mkSaveState = 'saved';  // 'saved' | 'saving' | 'dirty' | 'error'
  let __mkLastSaveTime = Date.now();
  let __mkSaveTimer = null;

  function relativeTimeFr(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 5) return 'à l\'instant';
    if (s < 60) return 'il y a ' + s + 's';
    if (s < 3600) return 'il y a ' + Math.floor(s / 60) + 'min';
    return 'il y a ' + Math.floor(s / 3600) + 'h';
  }
  function mkSetSaveStatus(state) {
    __mkSaveState = state;
    if (state === 'saved') __mkLastSaveTime = Date.now();
    const el = document.getElementById('mk-edit-save-status');
    if (!el) return;
    el.dataset.state = state;
    if (state === 'saving') el.textContent = 'Enregistrement…';
    else if (state === 'error') el.textContent = 'Hors ligne — sauvegardé localement';
    else el.textContent = 'Enregistré ' + relativeTimeFr(__mkLastSaveTime);
  }
  // Refresh ticker (uniquement quand on est en V2 et état saved)
  setInterval(function () {
    if (__mkSaveState === 'saved' && document.getElementById('mk-edit-save-status')) {
      mkSetSaveStatus('saved');
    }
  }, 5000);

  function mkMutateSheetV2(patch) {
    if (!editingSheet) return;
    Object.assign(editingSheet, patch);
    mkSetSaveStatus('saving');
    if (__mkSaveTimer) clearTimeout(__mkSaveTimer);
    __mkSaveTimer = setTimeout(function () {
      try { upsertSheet(editingSheet); mkSetSaveStatus('saved'); }
      catch (e) { mkSetSaveStatus('error'); }
    }, 800);
  }
  window.mkUpdateTitleV2 = function (v) {
    mkMutateSheetV2({ title: v });
    refreshCanvasV2();
  };

  // Zoom canvas
  let __mkCanvasZoom = null; // null = auto-fit
  function mkComputeAutoZoomV2() {
    const wrap = document.querySelector('.mk-edit-canvas');
    if (!wrap) return 0.7;
    const wH = wrap.clientHeight - 48;
    const wW = wrap.clientWidth - 48;
    return Math.max(0.25, Math.min(1.4, Math.min(wH / 1123, wW / 794, 0.95)));
  }
  function mkApplyZoomV2() {
    const z = __mkCanvasZoom != null ? __mkCanvasZoom : mkComputeAutoZoomV2();
    const stage = document.getElementById('mk-canvas-stage-v2');
    if (stage) stage.style.setProperty('--mk-zoom', z.toFixed(3));
    const slider = document.getElementById('mk-canvas-zoom-slider');
    if (slider) slider.value = Math.round(z * 100);
    const lbl = document.getElementById('mk-canvas-zoom-label');
    if (lbl) lbl.textContent = Math.round(z * 100) + '%';
  }
  window.mkCanvasSetZoomV2 = function (pct) {
    __mkCanvasZoom = Math.max(0.25, Math.min(2.0, parseInt(pct, 10) / 100));
    mkApplyZoomV2();
  };
  window.mkCanvasResetZoomV2 = function () { __mkCanvasZoom = null; mkApplyZoomV2(); };

  function refreshCanvasV2() {
    const stage = document.getElementById('mk-canvas-stage-v2');
    if (stage && editingSheet) stage.innerHTML = renderSheetHTML(editingSheet, 'mk-pdf-target');
  }

  function renderEditV2() {
    const root = getRoot();
    if (!root || !editingSheet) return;
    root.innerHTML = `
      <div class="mk-edit-v2">
        <header class="mk-edit-topbar">
          <button class="mk-edit-back" aria-label="Retour bibliothèque" onclick="window.mkBackToLibrary()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div class="mk-edit-title-wrap">
            <input class="mk-edit-title-input" value="${escapeAttr(editingSheet.title || '')}"
              placeholder="Titre de la fiche" maxlength="80"
              oninput="window.mkUpdateTitleV2(this.value)" />
            <span class="mk-edit-save-status" id="mk-edit-save-status" data-state="saved">Enregistré à l'instant</span>
          </div>
          <div class="mk-edit-topbar-actions">
            <button class="mk-btn mk-btn-ghost" onclick="window.mkDuplicateCurrent()" aria-label="Dupliquer">Dupliquer</button>
            <button class="mk-btn mk-btn-primary" onclick="window.mkSaveAndDownload()">⬇ PDF</button>
          </div>
        </header>
        <div class="mk-edit-body">
          <aside class="mk-edit-rail" role="navigation">
            <button class="mk-rail-item" data-section="hub" onclick="window.mkBackToLibrary()" title="Hub" aria-label="Hub">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>
            </button>
            <div class="mk-rail-divider"></div>
            <button class="mk-rail-item is-active" data-section="editor" title="Éditer" aria-label="Éditer">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="mk-rail-item" data-section="theme" title="Thème" aria-label="Thème">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="7" cy="12" r="1.5"/><circle cx="12" cy="7" r="1.5"/><circle cx="17" cy="12" r="1.5"/><circle cx="12" cy="17" r="1.5"/></svg>
            </button>
            <button class="mk-rail-item" data-section="data" title="Données" aria-label="Données">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/></svg>
            </button>
            <div class="mk-rail-spacer"></div>
            <button class="mk-rail-item" data-section="help" title="Aide" aria-label="Aide" onclick="window.showShortcutsHelp && window.showShortcutsHelp()">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
            </button>
          </aside>
          <main class="mk-edit-canvas-wrap">
            <div class="mk-canvas-toolbar">
              <button class="mk-canvas-zoom-btn" onclick="window.mkCanvasResetZoomV2()">Ajuster</button>
              <button class="mk-canvas-zoom-btn" onclick="window.mkCanvasSetZoomV2(100)">100%</button>
              <button class="mk-canvas-zoom-btn" onclick="window.mkCanvasSetZoomV2(150)">150%</button>
              <input id="mk-canvas-zoom-slider" type="range" min="25" max="200" value="70" oninput="window.mkCanvasSetZoomV2(this.value)" class="mk-canvas-zoom-slider" />
              <span id="mk-canvas-zoom-label" class="mk-canvas-zoom-label">70%</span>
            </div>
            <div class="mk-edit-canvas">
              <div id="mk-canvas-stage-v2" class="mk-canvas-stage">
                ${renderSheetHTML(editingSheet, 'mk-pdf-target')}
              </div>
            </div>
          </main>
          <aside class="mk-edit-inspector">
            <div class="mk-inspector-placeholder">
              <div class="mk-inspector-ph-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
              </div>
              <div class="mk-inspector-ph-title">Inspector — Phase 2</div>
              <div class="mk-inspector-ph-sub">Apparence · Contenu · Données seront ici dans la prochaine livraison.</div>
              <button class="mk-btn mk-btn-ghost" onclick="window.MK_REFONTE_ENABLED=false;window.renderEdit&&window.renderEdit()">↩ Revenir à l'éditeur V1</button>
            </div>
          </aside>
        </div>
      </div>
    `;
    // Auto-fit zoom après mount
    requestAnimationFrame(mkApplyZoomV2);
    // Recalcule sur resize
    if (!window.__mkV2Resize) {
      window.__mkV2Resize = function () { if (__mkCanvasZoom == null) mkApplyZoomV2(); };
      window.addEventListener('resize', window.__mkV2Resize);
    }
  }
  window.renderEditV2 = renderEditV2;

  window.mkBackToLibrary = function () {
    editingSheet = null;
    window.renderMarketing();
  };
  window.mkDuplicateCurrent = function () {
    if (!editingSheet) return;
    const dup = JSON.parse(JSON.stringify(editingSheet));
    dup.id = 'mk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    dup.title = (dup.title || 'Fiche') + ' — Copie';
    dup.created_at = new Date().toISOString();
    dup.updated_at = new Date().toISOString();
    upsertSheet(dup);
    editingSheet = dup;
    renderEdit();
    if (typeof window.showToast === 'function') window.showToast('Fiche dupliquée ✓', 'success');
  };

  function escapeAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // Proxy CORS pour images externes (OFFILOG, Drakkars, Cap3000, Leclerc, etc.)
  // html2canvas refuse les images cross-origin "tainted" — on les passe via
  // images.weserv.nl (CDN gratuit, CORS friendly, cache + resize) ce qui
  // garantit que les images apparaissent dans le PDF ET sont allegees (jpg q88, 600px).
  function proxyImg(url) {
    if (!url) return '';
    const s = String(url);
    if (s.startsWith('data:')) return s;
    if (s.indexOf('images.weserv.nl') !== -1) return s;
    // weserv : passe URL sans protocole
    const clean = s.replace(/^https?:\/\//, '');
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(clean) + '&w=600&output=jpg&q=88';
  }

  // Attend que toutes les <img> d'un container aient charge (load ou error).
  // Permet a html2canvas de rendre les images proxifees correctement.
  function waitForImages(root, timeoutMs) {
    if (!root) return Promise.resolve();
    const imgs = Array.from(root.querySelectorAll('img'));
    if (!imgs.length) return Promise.resolve();
    const pending = imgs.filter(img => !(img.complete && img.naturalWidth > 0));
    if (!pending.length) return Promise.resolve();
    return new Promise(resolve => {
      let done = 0;
      const finish = () => {
        done++;
        if (done >= pending.length) resolve();
      };
      pending.forEach(img => {
        if (img.complete) return finish();
        img.addEventListener('load', finish, { once: true });
        img.addEventListener('error', finish, { once: true });
      });
      // Garde-fou
      setTimeout(resolve, timeoutMs || 6000);
    });
  }

  // ── COMPARATIF SAGITTA NR / LNR vs IP ───────────────────────
  // Memoize : CATALOGUE_IP + BENCHMARK ne changent pas en cours de session.
  // Construire l'index Map(>10500 entries) a chaque computeSagittaCompare etait
  // un cout substantiel (rappele a chaque keystroke dans la recherche Sagitta).
  let __sagittaIndexCache = null;
  function buildSagittaIndex() {
    if (__sagittaIndexCache) return __sagittaIndexCache;
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
    __sagittaIndexCache = ix;
    return ix;
  }

  // Normalise un nom de produit pour matching tolerant (Sagitta vs OFFILOG)
  function normName(s) {
    return String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  // Extrait les premiers tokens significatifs (marque + nom court)
  function nameKey(s) {
    const n = normName(s);
    return n.split(' ').slice(0, 4).join(' ');
  }

  let __imgIdxCache = null;
  function buildOffilogImageIndex() {
    // Index multi-cle pour maximiser les matches d'images :
    //  - par EAN13 complet
    //  - par CIP7 (7 derniers chiffres de l'EAN)
    //  - par nom normalise court (4 premiers tokens)
    if (__imgIdxCache) return __imgIdxCache;
    const byEan = new Map();
    const byCip7 = new Map();
    const byName = new Map();
    if (window.OFFILOG) {
      window.OFFILOG.forEach(o => {
        if (!o.img) return;
        if (o.ean) {
          const ean = String(o.ean);
          byEan.set(ean, o.img);
          // CIP7 = derniers 7 chiffres de l'EAN13 (norme parapharma)
          if (ean.length >= 7) byCip7.set(ean.slice(-7), o.img);
          if (ean.length >= 7) byCip7.set(ean.slice(0, 7), o.img);
        }
        const key = nameKey(o.produit);
        if (key && key.length > 6 && !byName.has(key)) byName.set(key, o.img);
      });
    }
    __imgIdxCache = { byEan, byCip7, byName };
    return __imgIdxCache;
  }

  // Resout l'image pour un produit Sagitta avec fallback multi-cle
  function resolveImage(cip13, name) {
    const ix = buildOffilogImageIndex();
    if (!cip13 && !name) return '';
    if (cip13) {
      const direct = ix.byEan.get(String(cip13));
      if (direct) return direct;
      const c7tail = ix.byCip7.get(String(cip13).slice(-7));
      if (c7tail) return c7tail;
    }
    if (name) {
      const key = nameKey(name);
      if (key.length > 6) {
        const byN = ix.byName.get(key);
        if (byN) return byN;
        // Tente avec 3 tokens seulement (marque + dosage parfois)
        const shortKey = key.split(' ').slice(0, 3).join(' ');
        if (shortKey !== key) {
          const byShort = ix.byName.get(shortKey);
          if (byShort) return byShort;
        }
      }
    }
    return '';
  }

  // Cumul ventes secteur OPS+CPR+HP indexe par EAN/CIP13 (pour tri volume)
  let __salesByEanCache = null;
  function buildSalesByEan() {
    if (__salesByEanCache) return __salesByEanCache;
    const ix = new Map();
    function add(src) {
      if (!src) return;
      for (const code in src) {
        const p = src[code];
        const ean = String(p.ean || '');
        if (!ean) continue;
        const cur = ix.get(ean) || { qte: 0, ca: 0 };
        cur.qte += (p.qte || 0);
        cur.ca  += (p.ca  || 0);
        ix.set(ean, cur);
      }
    }
    add(window.OPS_AGGREGATE);
    add(window.CPR_AGGREGATE);
    add(window.HP_AGGREGATE);
    __salesByEanCache = ix;
    return ix;
  }

  // Memoize : la comparaison Sagitta NE depend QUE de SAGITTA_SHORTLIST + indexes
  // (CATALOGUE_IP, BENCHMARK, AGGREGATES) tous figes une fois charges. Aucun
  // filtre interactif n'entre ici (le search/status sont appliques en aval).
  // Cache la totalite -> renderSagittaCompareSection() devient quasi-gratuit.
  let __sagittaCompareCache = null;
  function computeSagittaCompare() {
    if (!window.SAGITTA_SHORTLIST) return null;
    if (__sagittaCompareCache) return __sagittaCompareCache;
    const ipIdx = buildSagittaIndex();
    const salesIdx = buildSalesByEan();
    const list = window.SAGITTA_SHORTLIST.map(p => {
      const ip = ipIdx.get(String(p.cip13));
      // Resolution image multi-cle : EAN -> CIP7 -> nom normalise
      const img = resolveImage(p.cip13, p.name);
      const sales = salesIdx.get(String(p.cip13)) || { qte: 0, ca: 0 };
      const prix_ip = ip ? ip.prix_ip : null;
      const ecart_eur = (prix_ip != null && p.prix_sagitta != null) ? (prix_ip - p.prix_sagitta) : null;
      const ecart_pct = (prix_ip != null && p.prix_sagitta != null && p.prix_sagitta > 0)
        ? ((prix_ip - p.prix_sagitta) / p.prix_sagitta) * 100 : null;
      let status;
      if (!ip) status = 'no_ip';
      else if (ecart_eur == null) status = 'no_ip';
      else if (ecart_eur < -0.05) status = 'ip_win';
      else if (ecart_eur > 0.05) status = 'ip_lose';
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
        qte_sector: sales.qte,
        ca_sector: sales.ca,
      });
    });
    // Tri principal : VOLUME secteur OPS+CPR+HP decroissant
    // (les vrais gros vendeurs en haut, ceux qui rapportent vraiment du CA)
    // En fallback : ecart absolu pour separer les zero-ventes
    list.sort((a, b) => {
      if (b.qte_sector !== a.qte_sector) return b.qte_sector - a.qte_sector;
      return Math.abs(b.ecart_eur || 0) - Math.abs(a.ecart_eur || 0);
    });
    const stats = {
      total: list.length,
      ip_win: list.filter(p => p.status === 'ip_win').length,
      tie: list.filter(p => p.status === 'tie').length,
      ip_lose: list.filter(p => p.status === 'ip_lose').length,
      no_ip: list.filter(p => p.status === 'no_ip').length,
      gain_moyen: 0,
      total_qte: list.reduce((s, p) => s + p.qte_sector, 0),
      total_ca: list.reduce((s, p) => s + p.ca_sector, 0),
    };
    const wins = list.filter(p => p.status === 'ip_win' && p.ecart_pct != null);
    if (wins.length) {
      stats.gain_moyen = wins.reduce((s, p) => s + Math.abs(p.ecart_pct), 0) / wins.length;
    }
    __sagittaCompareCache = { list, stats };
    return __sagittaCompareCache;
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
    // Tri configurable (par défaut volume secteur)
    if (sagittaSort === 'ecart_pct') {
      list = list.slice().sort((a, b) => (Math.abs(b.ecart_pct || 0)) - (Math.abs(a.ecart_pct || 0)));
    } else if (sagittaSort === 'ecart_eur') {
      list = list.slice().sort((a, b) => (Math.abs(b.ecart_eur || 0)) - (Math.abs(a.ecart_eur || 0)));
    } else if (sagittaSort === 'gain') {
      // Trie les gagnants IP en premier, par CA secteur potentiel
      list = list.slice().sort((a, b) => {
        const av = (a.status === 'ip_win' ? 1 : 0) * (a.ca_sector || 0);
        const bv = (b.status === 'ip_win' ? 1 : 0) * (b.ca_sector || 0);
        return bv - av;
      });
    }
    // Mini-stats hero : combien de gagnants IP affichés et CA secteur cumulé
    const filteredWins = list.filter(p => p.status === 'ip_win');
    const heroWinsCount = filteredWins.length;
    const heroWinsCa = filteredWins.reduce((s, p) => s + (p.ca_sector || 0), 0);
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

        <div class="mk-sag-sortbar">
          <span class="mk-sag-sortbar-lbl">Trier par</span>
          <button class="mk-sag-sortpill ${sagittaSort==='volume'?'on':''}" onclick="window.mkSetSagittaSort('volume')" title="Volumes secteur OPS+CPR+HP décroissants">Volume secteur</button>
          <button class="mk-sag-sortpill ${sagittaSort==='ecart_pct'?'on':''}" onclick="window.mkSetSagittaSort('ecart_pct')" title="Écart en pourcentage le plus marqué">Écart %</button>
          <button class="mk-sag-sortpill ${sagittaSort==='ecart_eur'?'on':''}" onclick="window.mkSetSagittaSort('ecart_eur')" title="Écart en € le plus marqué">Écart €</button>
          <button class="mk-sag-sortpill ${sagittaSort==='gain'?'on':''}" onclick="window.mkSetSagittaSort('gain')" title="Gagnants IP avec le plus de potentiel CA">Potentiel gain</button>
          <div class="mk-sag-sortbar-meta" title="Gagnants IP visibles dans la sélection courante">
            <b>${heroWinsCount}</b> gagnant${heroWinsCount>1?'s':''} IP · <b>${eur(heroWinsCa)}</b> CA secteur
          </div>
        </div>

        <div class="mk-sag-grid">
          ${top.length === 0 ? `
            <div class="mk-sag-empty" style="grid-column:1/-1">
              <div class="mk-sag-empty-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <div class="mk-sag-empty-title">Aucun produit ne correspond</div>
              <div class="mk-sag-empty-sub">Essaie un autre filtre, ou tape un nom de produit, labo ou CIP.</div>
              ${(sagittaSearch || sagittaStatus !== 'all') ? `<button class="mk-sag-empty-reset" onclick="window.mkResetSagitta()">↺ Réinitialiser les filtres</button>` : ''}
            </div>
          ` : top.map((p, idx) => {
            const ip = p.prix_ip != null ? eur(p.prix_ip) : '—';
            const sag = p.prix_sagitta != null ? eur(p.prix_sagitta) : '—';
            const ecartCls = p.status === 'ip_win' ? 'mk-sag-ecart-win' : (p.status === 'ip_lose' ? 'mk-sag-ecart-lose' : '');
            const ecartTxt = p.ecart_pct != null
              ? `${p.ecart_pct > 0 ? '+' : ''}${p.ecart_pct.toFixed(0)}%`
              : '—';
            const ecartEur = p.ecart_eur != null
              ? `${p.ecart_eur > 0 ? '+' : ''}${p.ecart_eur.toFixed(2).replace('.', ',')} €`
              : '';
            const volQte = p.qte_sector > 0
              ? p.qte_sector.toLocaleString('fr-FR') + ' u'
              : '— vente sect.';
            const rank = idx + 1;
            return `
              <div class="mk-sag-card mk-sag-card-${p.status}">
                <div class="mk-sag-card-thumb">
                  ${p.img ? `<img src="${escapeAttr(p.img)}" alt="" loading="lazy" decoding="async" width="240" height="240" onerror="this.style.display='none';this.parentNode.classList.add('mk-sag-card-noimg')"/>` : '<span class="mk-sag-ph">💊</span>'}
                  <div class="mk-sag-card-rank">#${rank}</div>
                  ${p.qte_sector > 0 ? `<div class="mk-sag-card-vol" title="Ventes OPS+CPR+HP"><span class="mk-sag-card-vol-num">${volQte}</span><span class="mk-sag-card-vol-ca">${eur(p.ca_sector)}</span></div>` : ''}
                  ${statusBadge(p.status)}
                  ${p.prix_ip != null
                    ? `<button class="mk-sag-card-add" title="Ajouter à la fiche" onclick="window.mkAddSagittaProduct('${escapeAttr(p.cip13)}')">+</button>`
                    : ''}
                </div>
                <div class="mk-sag-card-body">
                  <div class="mk-sag-card-name">${escapeAttr(p.name)}</div>
                  <div class="mk-sag-card-meta">${escapeAttr(p.labo || '—')} · CIP ${escapeAttr(p.cip13)}</div>
                  <div class="mk-sag-card-prices">
                    <div class="mk-sag-card-price-blk">
                      <div class="mk-sag-card-price-lbl">Sagitta</div>
                      <div class="mk-sag-card-price-val">${sag}</div>
                      ${p.prix_barre ? `<div class="mk-sag-card-price-old">${eur(p.prix_barre)} · −${p.remise_pct || 0}%</div>` : ''}
                    </div>
                    <div class="mk-sag-card-price-blk mk-sag-card-price-ip">
                      <div class="mk-sag-card-price-lbl">IP</div>
                      <div class="mk-sag-card-price-val">${ip}</div>
                      ${p.prix_ip_ht ? `<div class="mk-sag-card-price-old">PPHT ${eur(p.prix_ip_ht)}</div>` : ''}
                    </div>
                  </div>
                  <div class="mk-sag-card-ecart ${ecartCls}">
                    <span class="mk-sag-card-ecart-pct">${ecartTxt}</span>
                    ${ecartEur ? `<span class="mk-sag-card-ecart-eur">${ecartEur}</span>` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        ${list.length > 80 ? `<div class="mk-sag-footer">Affichage limité à 80 sur ${list.length} résultats — affine ta recherche</div>` : `<div class="mk-sag-footer">${list.length} produit${list.length>1?'s':''} · tri ${sagittaSort === 'ecart_pct' ? 'par écart % décroissant' : sagittaSort === 'ecart_eur' ? 'par écart € décroissant' : sagittaSort === 'gain' ? 'par potentiel gain IP' : 'par volumes secteur OPS+CPR+HP'}</div>`}
      </div>
    `;
  }

  // Sagitta section vit dans renderMarketing() (page d'accueil) — pas renderEdit().
  // L'appel a renderEdit() etait un no-op silencieux (early-return si pas
  // d'editingSheet). On route vers renderMarketing() qui est le bon contexte.
  window.mkSetSagittaStatus = function (s) { sagittaStatus = s; window.renderMarketing(); };
  window.mkSetSagittaSort = function (s) {
    const ok = ['volume', 'ecart_pct', 'ecart_eur', 'gain'];
    sagittaSort = ok.indexOf(s) >= 0 ? s : 'volume';
    window.renderMarketing();
  };
  window.mkResetSagitta = function () {
    sagittaStatus = 'all';
    sagittaSearch = '';
    sagittaSort   = 'volume';
    window.renderMarketing();
  };
  // Debounce 180ms : evite un re-render complet sur chaque keystroke
  // (renderMarketing re-monte la section Top ventes 100 lignes + Sagitta 80 cards).
  const _doSagittaSearch = debounce(function (q) {
    sagittaSearch = q;
    window.renderMarketing();
    restoreFocus('input.mk-sag-search', q);
  }, 180);
  window.mkSetSagittaSearch = function (q) {
    // Maj immediate de la valeur stockee (pour l'apparence de l'input controle)
    sagittaSearch = q;
    _doSagittaSearch(q);
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
    // Recupere image (EAN/CIP7/nom) depuis l'index OFFILOG multi-source
    const found = resolveImage(cip, snap.designation);
    if (found) snap.img = found;
    const wasEmpty = editingSheet.products.length === 0;
    editingSheet.products.push(snap);
    if (typeof window.showToast === 'function') window.showToast('Ajouté à la fiche ✓', 'success');
    if (wasEmpty) celebrateFirstProduct();
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
              const img = o.img ? `<img src="${escapeAttr(o.img)}" alt="" loading="lazy" decoding="async" width="160" height="160" onerror="this.style.display='none';this.parentNode.classList.add('mk-off-noimg')"/>` : '';
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
          <div class="mk-empty-search">
            <span style="font-size:20px;display:block;margin-bottom:4px">🤔</span>
            Aucun produit parapharmacie ne correspond.<br>
            <span style="font-size:11px;opacity:.75">Essaie une marque (Mustela, Avène, La Roche-Posay…)</span>
          </div>
        ` : `
          <div class="mk-empty-search">
            <span style="font-size:20px;display:block;margin-bottom:4px">🌿</span>
            <b>Catalogue parapharmacie</b> — 3 520 références avec images<br>
            <span style="font-size:11px;opacity:.75">Tape 2 lettres ou clique un univers ci-dessus</span>
          </div>
        `}
      </div>
    `;
  }

  // Debounce 180ms : la grille OFFILOG (jusqu'a 40 tuiles + images) etait
  // re-rendue a chaque keystroke -> input laggy.
  const _doOffilogSearch = debounce(function (q) {
    offilogSearch = q;
    renderEdit();
    restoreFocus('input[placeholder^="Rechercher (nom, marque"]', q);
  }, 180);
  window.mkSetOffilogSearch = function (q) {
    offilogSearch = q;  // maj immediate pour input controle
    _doOffilogSearch(q);
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
    const wasEmpty = editingSheet.products.length === 0;
    editingSheet.products.push(snap);
    if (wasEmpty) celebrateFirstProduct();
    renderEdit();
  };

  // Debounce 180ms : la liste de resultats BENCHMARK (jusqu'a 30 lignes) etait
  // re-rendue + le selecteur de produits ajoutes a chaque keystroke.
  const _doProductSearch = debounce(function (q) {
    productSearch = q;
    renderEdit();
    restoreFocus('input[placeholder^="Recherc"]', q);
  }, 180);
  window.mkSetSearch = function (q) {
    productSearch = q;  // maj immediate pour input controle
    _doProductSearch(q);
  };

  window.mkUpdateTitle = function (v) { editingSheet.title = v; };
  window.mkUpdateFooter = function (v) { editingSheet.footer = v; };
  window.mkUpdateColor = function (k) { editingSheet.color = k; renderEdit(); };
  window.mkUpdateHideImages = function (hide) {
    editingSheet.hideImages = !!hide;
    editingSheet.updated_at = new Date().toISOString();
    renderEdit();
  };
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
      const wasEmpty = editingSheet.products.length === 0;
      const snap = snapshotProduct(b);
      // Recupere image automatiquement (OFFILOG par EAN/CIP/nom)
      snap.img = resolveImage(b.cip13, b.designation);
      if (getTemplateId(editingSheet) === 'focus') {
        snap.accroche = '';
        snap.argument = '';
      }
      editingSheet.products.push(snap);
      if (wasEmpty) celebrateFirstProduct();
    }
    renderEdit();
  };

  // Confetti CSS-only quand l'utilisateur ajoute son 1er produit dans une fiche vide.
  // Léger, accessible (respecte prefers-reduced-motion via CSS), zéro dépendance.
  function celebrateFirstProduct() {
    try {
      const wrap = document.createElement('div');
      wrap.className = 'mk-confetti';
      wrap.style.cssText = 'position:fixed;left:0;right:0;top:30%;height:0;z-index:9998;pointer-events:none';
      let inner = '';
      for (let i = 0; i < 10; i++) inner += '<i></i>';
      wrap.innerHTML = inner;
      document.body.appendChild(wrap);
      setTimeout(() => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 1500);
    } catch (e) { /* silencieux */ }
  }

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

  // ── APERÇU PDF (modal) avec édition live + mode plein ecran ─
  let __previewFullscreen = false;
  let __previewToolbarCollapsed = false;
  let __previewZoom = null; // null = auto-fit calcule

  function computePreviewAutoScale() {
    const vh = window.innerHeight || 800;
    const vw = window.innerWidth || 1200;
    const headH = 64;
    const padH = 48;
    const isMobile = vw < 900;
    const sidebarVisible = !__previewFullscreen && !__previewToolbarCollapsed;
    let availW, availH;
    if (isMobile) {
      const tbH = sidebarVisible ? Math.min(vh * 0.38, 320) : 0;
      availH = vh - headH - tbH - padH;
      availW = vw - 40;
    } else {
      const sbW = sidebarVisible ? 320 : 0;
      availH = vh - headH - padH;
      availW = vw - sbW - 60;
    }
    const scaleH = availH / 1123;
    const scaleW = availW / 794;
    const auto = Math.min(scaleH, scaleW, __previewFullscreen ? 1.0 : 0.95);
    return Math.max(0.30, Math.min(1.40, auto));
  }

  function applyPreviewZoom() {
    const render = document.getElementById('mk-preview-render');
    if (!render) return;
    const z = __previewZoom != null ? __previewZoom : computePreviewAutoScale();
    render.style.setProperty('--preview-scale', String(z.toFixed(3)));
    // Le wrapper a width/height calc(794*s, 1123*s) en CSS, donc le flexbox
    // parent centre proprement sans hack de margin negative.
    const lbl = document.getElementById('mk-zoom-label');
    if (lbl) lbl.textContent = Math.round(z * 100) + '%';
    const slider = document.getElementById('mk-zoom-slider');
    if (slider) slider.value = String(Math.round(z * 100));
  }

  window.mkPreviewSetZoom = function (pct) {
    const p = parseInt(pct, 10);
    if (isNaN(p)) return;
    __previewZoom = Math.max(0.30, Math.min(1.40, p / 100));
    applyPreviewZoom();
  };
  window.mkPreviewResetZoom = function () {
    __previewZoom = null;
    applyPreviewZoom();
  };

  function openPreview(sheet) {
    let modal = document.getElementById('mk-preview-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'mk-preview-modal';
    modal.className = 'mk-modal mk-preview-live' + (__previewFullscreen ? ' mk-preview-fullscreen' : '') + (__previewToolbarCollapsed ? ' mk-preview-toolbar-collapsed' : '');
    modal.innerHTML = `
      <div class="mk-modal-head">
        <div class="mk-modal-title">${__previewFullscreen ? 'Aperçu plein écran' : 'Aperçu — édition live'}</div>
        <div class="mk-modal-actions">
          <button class="mk-btn mk-btn-icon-only" title="${__previewToolbarCollapsed ? 'Afficher les contrôles' : 'Masquer les contrôles'}" onclick="window.mkTogglePreviewToolbar()">
            ${__previewToolbarCollapsed
              ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/></svg>'
              : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
            }
          </button>
          <button class="mk-btn mk-btn-icon-only" title="${__previewFullscreen ? 'Quitter plein écran (Echap)' : 'Plein écran'}" onclick="window.mkTogglePreviewFullscreen()">
            ${__previewFullscreen
              ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'
              : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>'
            }
          </button>
          <div class="mk-zoom-control" title="Zoom de l'aperçu">
            <button class="mk-zoom-btn" onclick="window.mkPreviewSetZoom((parseInt(document.getElementById('mk-zoom-slider').value)-10))" title="Dézoomer">−</button>
            <input id="mk-zoom-slider" type="range" min="30" max="140" value="62" oninput="window.mkPreviewSetZoom(this.value)" />
            <button class="mk-zoom-btn" onclick="window.mkPreviewSetZoom((parseInt(document.getElementById('mk-zoom-slider').value)+10))" title="Zoomer">+</button>
            <span id="mk-zoom-label" onclick="window.mkPreviewResetZoom()" title="Click pour auto-ajuster">62%</span>
          </div>
          <button class="mk-btn" onclick="window.mkClosePreview()">Fermer</button>
          <button class="mk-btn mk-btn-primary" onclick="window.mkDownloadFromPreview()">⬇ PDF</button>
        </div>
      </div>
      <div class="mk-preview-stage">
        ${renderPreviewToolbar(sheet)}
        <div class="mk-modal-body">
          <div id="mk-preview-render">${renderSheetHTML(sheet, 'mk-pdf-target')}</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    window._mkPreviewSheet = sheet;
    // Auto-fit le zoom apres mount (DOM disponible)
    requestAnimationFrame(applyPreviewZoom);
    // Recalcule auto-zoom sur resize fenetre
    if (!window.__mkPreviewResize) {
      window.__mkPreviewResize = function () {
        if (__previewZoom == null) applyPreviewZoom();
      };
      window.addEventListener('resize', window.__mkPreviewResize);
    }
    // Echap pour quitter le plein ecran (sinon fermer)
    if (!window.__mkPreviewEsc) {
      window.__mkPreviewEsc = function (e) {
        if (e.key !== 'Escape') return;
        const m = document.getElementById('mk-preview-modal');
        if (!m) return;
        if (__previewFullscreen) {
          __previewFullscreen = false;
          openPreview(window._mkPreviewSheet);
        } else {
          window.mkClosePreview();
        }
      };
      document.addEventListener('keydown', window.__mkPreviewEsc);
    }
  }

  window.mkTogglePreviewFullscreen = function () {
    __previewFullscreen = !__previewFullscreen;
    if (window._mkPreviewSheet) openPreview(window._mkPreviewSheet);
  };
  window.mkTogglePreviewToolbar = function () {
    __previewToolbarCollapsed = !__previewToolbarCollapsed;
    if (window._mkPreviewSheet) openPreview(window._mkPreviewSheet);
  };

  function refreshPreview() {
    const sheet = window._mkPreviewSheet;
    if (!sheet) return;
    const render = document.getElementById('mk-preview-render');
    if (render) render.innerHTML = renderSheetHTML(sheet, 'mk-pdf-target');
    const tb = document.getElementById('mk-preview-toolbar');
    if (tb) tb.outerHTML = renderPreviewToolbar(sheet);
    // Reapplique le zoom apres rerender (le style inline est preserve sur le
    // container mais on s'assure que le label/slider correspondent toujours)
    requestAnimationFrame(applyPreviewZoom);
  }

  function renderPreviewToolbar(sheet) {
    const tpl = getTemplateId(sheet);
    const gradients = window.MK_GRADIENTS || {};
    const fonts = window.MK_FONT_PAIRS || {};
    const stickers = window.MK_STICKERS || {};
    // Couleurs : tendances 2026-2027 + neutres (les classiques IP sont retires)
    const trends   = ['dusk','teal','cherry','sienna','sage','vanilla','chartreuse','slate','plum','terracotta'];
    const neutrals = ['ice','pearl','stone','charcoal','cream','ivory'];

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
      const headingFamily = (f.heading && f.heading.family) || 'DM Sans';
      const on = (sheet.fontPair || 'default') === id ? ' on' : '';
      return `<button class="mk-pv-font${on}" onclick="window.mkPreviewSetFont('${id}')" style="font-family:'${headingFamily}',sans-serif"><span class="mk-pv-font-h">Aa</span><span class="mk-pv-font-name">${escapeAttr(f.name)}</span></button>`;
    };

    const stkBtn = (id) => {
      const on = (sheet.sticker || 'none') === id ? ' on' : '';
      const stkObj = stickers[id];
      const svgRaw = stkObj && stkObj.svg ? stkObj.svg : '';
      const inner = (id === 'none' || !svgRaw)
        ? '<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="16" cy="16" r="13" fill="none" stroke="#94A3B8" stroke-width="2" stroke-dasharray="3 3"/><path d="M8 8L24 24" stroke="#94A3B8" stroke-width="2"/></svg>'
        : svgRaw;
      const label = (stkObj && stkObj.name) || 'Aucun';
      return `<button class="mk-pv-stk${on}" onclick="window.mkPreviewSetSticker('${id}')" title="${escapeAttr(label)}">${inner}</button>`;
    };

    // Dedupe — MK_GRADIENTS et MK_STICKERS contiennent déjà 'none' dans leur data
    const gradKeys = Object.keys(gradients);
    const stickerKeys = Object.keys(stickers);
    const gradIds = gradKeys.indexOf('none') >= 0 ? gradKeys : ['none'].concat(gradKeys);
    const fontIds = Object.keys(fonts);
    const stickerIds = stickerKeys.indexOf('none') >= 0 ? stickerKeys : ['none'].concat(stickerKeys);

    return `
      <div id="mk-preview-toolbar" class="mk-pv-tb">
        <div class="mk-pv-row">
          <span class="mk-pv-lbl">Template</span>
          <div class="mk-pv-scroll">
            ${tplBtn('offre',     'Offre',     '📋')}
            ${tplBtn('memo',      'Mémo',      '📑')}
            ${tplBtn('focus',     'Focus',     '🎯')}
            ${tplBtn('bento',     'Bento',     '🧩')}
          </div>
        </div>
        <div class="mk-pv-row">
          <span class="mk-pv-lbl">Tendances</span>
          <div class="mk-pv-scroll">
            ${trends.map(swatch).join('')}
          </div>
        </div>
        <div class="mk-pv-row">
          <span class="mk-pv-lbl">Neutres</span>
          <div class="mk-pv-scroll">
            ${neutrals.map(swatch).join('')}
          </div>
        </div>
        <div class="mk-pv-row">
          <span class="mk-pv-lbl">Images</span>
          <div class="mk-pv-scroll">
            <button class="mk-pv-tpl ${!sheet.hideImages ? 'on' : ''}" onclick="window.mkPreviewSetHideImages(false)">🖼️ Afficher</button>
            <button class="mk-pv-tpl ${sheet.hideImages ? 'on' : ''}" onclick="window.mkPreviewSetHideImages(true)">🚫 Masquer</button>
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
  window.mkPreviewSetHideImages = function (hide) {
    previewMutate(s => { s.hideImages = !!hide; });
  };

  window.mkDownloadFromPreview = function () {
    if (window._mkPreviewSheet) generatePDF(window._mkPreviewSheet);
  };

  // Détecte si un preset design correspond à l'état actuel de la fiche.
  // Sert à activer visuellement la pill "Look prédéfini" courante.
  function isCurrentDesignPreset(sheet, preset) {
    if (!sheet || !preset) return false;
    return (sheet.gradient || 'none') === preset.gradient
      && (sheet.fontPair || 'default') === preset.fontPair
      && (sheet.pattern || 'none') === preset.pattern
      && (sheet.template || 'offre') === preset.template;
  }

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

  // ── WCAG helpers (audit lisibilité texte/couleur fiches PDF) ────
  // Calcule la luminance relative WCAG 2.x d'une couleur hex.
  function wcagLum(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if (h.length !== 6) return 1;
    var r = parseInt(h.slice(0,2),16)/255;
    var g = parseInt(h.slice(2,4),16)/255;
    var b = parseInt(h.slice(4,6),16)/255;
    function ch(v){ return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }
    return 0.2126*ch(r) + 0.7152*ch(g) + 0.0722*ch(b);
  }
  function wcagRatio(hex1, hex2) {
    var L1 = wcagLum(hex1), L2 = wcagLum(hex2);
    if (L1 < L2) { var t = L1; L1 = L2; L2 = t; }
    return (L1 + 0.05) / (L2 + 0.05);
  }
  // Choisit la couleur la plus lisible parmi candidates pour un fond donné
  function pickBestFg(bgHex, candidates) {
    var best = candidates[0], bestR = 0;
    for (var i = 0; i < candidates.length; i++) {
      var r = wcagRatio(bgHex, candidates[i]);
      if (r > bestR) { bestR = r; best = candidates[i]; }
    }
    return best;
  }
  // Fiche à fond sombre ? Utilisé pour ajouter un outline blanc sur stickers
  function isDarkSheetBg(hex) {
    return wcagLum(hex || '#FFFFFF') < 0.18;
  }

  function renderSheetHTML(sheet, targetId) {
    const tpl = getTemplateId(sheet);
    if (tpl === 'memo')      return renderMemoTemplate(sheet, targetId);
    if (tpl === 'focus')     return renderFocusTemplate(sheet, targetId);
    if (tpl === 'bento')     return renderBentoTemplate(sheet, targetId);
    return renderOffreTemplate(sheet, targetId);
  }

  // ── TEMPLATE OFFRE IP (existant, factorisé) ─────────────────
  function renderOffreTemplate(sheet, targetId) {
    const cp = COLOR_PRESETS[sheet.color] || COLOR_PRESETS.navy;
    const font = designFont(sheet);
    const bg = designBg(sheet);
    const sticker = designSticker(sheet);
    const headingFamily = "'" + font.heading + "', 'DM Sans', sans-serif";
    const bodyFamily = "'" + font.body + "', 'DM Sans', sans-serif";
    const stickerCls = isDarkSheetBg(cp.bg) ? 'mk-tpl-sticker mk-tpl-sticker-on-dark' : 'mk-tpl-sticker';
    return `
      <div id="${targetId}" class="mk-pdf mk-pdf-offre" style="background:${bg || cp.bg};color:${cp.accent};font-family:${bodyFamily}">
        ${sticker ? `<div class="${stickerCls}">${sticker}</div>` : ''}
        <div class="mk-pdf-header">
          <div class="mk-pdf-logo">
            ${renderLogo(72)}
          </div>
          <div class="mk-pdf-title">
            <div class="mk-pdf-eyebrow">OFFRE IP</div>
            <div class="mk-pdf-h1" style="font-family:${headingFamily};font-weight:${font.hw};${font.italic ? 'font-style:italic' : ''}">${sheet.title || 'Sans titre'}</div>
          </div>
        </div>

        <div class="mk-pdf-table-wrap">
          <table class="mk-pdf-table">
            <thead>
              <tr style="background:${cp.headerBg};color:${cp.headerFg};font-family:${headingFamily}">
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
                    ${(p.img && !sheet.hideImages) ? `<span class="mk-cell-thumb"><img src="${escapeAttr(proxyImg(p.img))}" alt="" crossorigin="anonymous" onerror="this.style.display='none'"/></span>` : ''}
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
    const cp = COLOR_PRESETS[sheet.color] || COLOR_PRESETS.navy;
    const font = designFont(sheet);
    const bg = designBg(sheet);
    const sticker = designSticker(sheet);
    const headingFamily = "'" + font.heading + "', 'DM Sans', sans-serif";
    const bodyFamily = "'" + font.body + "', 'DM Sans', sans-serif";
    const stickerCls = isDarkSheetBg(cp.bg) ? 'mk-tpl-sticker mk-tpl-sticker-on-dark' : 'mk-tpl-sticker';
    return `
      <div id="${targetId}" class="mk-pdf mk-pdf-memo" style="${bg ? 'background:' + bg + ';' : ''}font-family:${bodyFamily}">
        ${sticker ? `<div class="${stickerCls}">${sticker}</div>` : ''}
        <div class="mk-memo-header" style="background:${cp.headerBg};color:${cp.headerFg};border-color:${cp.headerBg}">
          <div class="mk-memo-header-left">
            <div class="mk-memo-eyebrow">MÉMO RÉFÉRENTIEL</div>
            <div class="mk-memo-h1" style="font-family:${headingFamily};font-weight:${font.hw};${font.italic ? 'font-style:italic;' : ''}">${sheet.title || 'Sans titre'}</div>
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
                    ${(p.img && !sheet.hideImages) ? `<span class="mk-cell-thumb mk-cell-thumb-lg"><img src="${escapeAttr(proxyImg(p.img))}" alt="" crossorigin="anonymous" onerror="this.style.display='none'"/></span>` : ''}
                    <span class="mk-cell-name-text">${p.designation || '—'}</span>
                  </td>
                  <td class="mk-memo-marque">${p.marque || extractMarque(p.designation)}</td>
                  <td class="mk-memo-cip">${cipFormat(p.cip13)}</td>
                  <td class="mk-memo-cond">${p.conditionnement || '—'}</td>
                  <td class="mk-memo-price">${eur(p.prix_ht)}</td>
                  <td class="mk-memo-price-strong" style="background:${cp.priceBg};color:${cp.priceFg}">${eur(p.prix_ip)}</td>
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
    // WCAG : .mk-focus-price-ip est posé en TEXTE sur le bg de la carte (#FFFFFF).
    // On préfère cp.headerBg si ratio OK contre blanc, sinon cp.accent (toujours sombre).
    const focusPriceIpCol = wcagRatio('#FFFFFF', cp.headerBg) >= 4.5 ? cp.headerBg : cp.accent;
    // .mk-focus-argument est une pill colorée : on garde headerBg/headerFg (pair audit OK)
    const stickerFocus = designSticker(sheet);
    const stickerClsFocus = isDarkSheetBg(cp.bg) ? 'mk-tpl-sticker mk-tpl-sticker-on-dark' : 'mk-tpl-sticker';
    return `
      <div id="${targetId}" class="mk-pdf mk-pdf-focus" style="background:${cp.bg};color:${cp.accent}">
        ${stickerFocus ? `<div class="${stickerClsFocus}">${stickerFocus}</div>` : ''}
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
              <div class="mk-focus-visual">${(p.img && !sheet.hideImages) ? `<img src="${escapeAttr(proxyImg(p.img))}" alt="" crossorigin="anonymous" class="mk-focus-img" onerror="this.outerHTML='${(placeholderSVG(p.designation)+'').replace(/'/g,'&#39;')}'"/>` : placeholderSVG(p.designation)}</div>
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
                  <div class="mk-focus-price-ip" style="color:${focusPriceIpCol}">${eur(p.prix_ip)}</div>
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
    // Attend que toutes les images (proxy weserv compris) soient pretes.
    // Si erreur ou timeout 8s, on continue : le placeholder fallback gere.
    await waitForImages(target, 8000);
    await new Promise(r => setTimeout(r, 150));

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
  // TEMPLATE BENTO — Apple Bento Grid asymetrique (2-3 cols, tiles fluides)
  // ═══════════════════════════════════════════════════════════════════════
  function renderBentoTemplate(sheet, targetId) {
    const s = sheet;
    const cp = COLOR_PRESETS[s.color] || COLOR_PRESETS.navy;
    const font = designFont(s);
    const bg = designBg(s);
    const sticker = designSticker(s);
    const products = (s.products || []).slice(0, TEMPLATES.bento.maxProducts);
    // Detection auto fond sombre :
    //  1) gradient marqué "darkness:dark" dans MK_GRADIENTS
    //  2) palette dont le bg est sombre (luminance < 0.5)
    const gObj = (window.MK_GRADIENTS || {})[s.gradient || 'none'];
    const gradientIsDark = !!(gObj && gObj.darkness === 'dark');
    function isHexDark(hex) {
      if (!hex || typeof hex !== 'string') return false;
      const h = hex.replace('#','');
      if (h.length < 6) return false;
      const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
      const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
      return lum < 0.5;
    }
    const paletteIsDark = !gradientIsDark && !s.gradient && isHexDark(cp.bg);
    const hasLight = gradientIsDark || paletteIsDark;
    const textCol = hasLight ? '#FFFFFF' : (cp.accent || '#0B1F4D');
    const tileBg = hasLight ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.75)';
    const tileBorder = hasLight ? 'rgba(255,255,255,0.22)' : 'rgba(11,31,77,0.08)';

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
                ${(p.img && !sheet.hideImages) ? `<div class="mk-bento-tile-thumb"><img src="${escapeAttr(proxyImg(p.img))}" alt="" crossorigin="anonymous" onerror="this.parentNode.style.display='none'"/></div>` : ''}
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

  // ── RECHERCHE D'IMAGE PRODUIT (Edge Function product-image-search) ──────────
  // L'utilisateur clique sur la loupe d'une ligne produit. On appelle la
  // fonction serveur Supabase (cascade OpenProducts par EAN puis Google par nom),
  // on affiche une grille de vignettes, et SEULEMENT au clic "Utiliser" on
  // assigne p.img + re-render. Aucune image n'est stockée tant qu'il n'a pas
  // validé — conforme à la demande.
  function mkImgEnsureModal() {
    let modal = document.getElementById('mk-img-search-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'mk-img-search-modal';
    modal.className = 'mk-img-search-modal';
    modal.setAttribute('hidden', '');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'mk-img-search-title');
    modal.innerHTML = ''
      + '<div class="mk-img-search-backdrop" onclick="window.mkImgCloseModal()"></div>'
      + '<div class="mk-img-search-panel" role="document">'
      +   '<div class="mk-img-search-head">'
      +     '<div class="mk-img-search-title" id="mk-img-search-title">Choisir une image</div>'
      +     '<button class="mk-img-search-close" onclick="window.mkImgCloseModal()" aria-label="Fermer">✕</button>'
      +   '</div>'
      +   '<div class="mk-img-search-sub" id="mk-img-search-sub"></div>'
      +   '<div class="mk-img-search-body" id="mk-img-search-body">'
      +     '<div class="mk-img-search-loading">Recherche en cours…</div>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(modal);
    return modal;
  }

  function mkImgRenderState(state, payload) {
    const body = document.getElementById('mk-img-search-body');
    const sub = document.getElementById('mk-img-search-sub');
    if (!body) return;
    if (state === 'loading') {
      body.innerHTML = '<div class="mk-img-search-loading">Recherche en cours…</div>';
      if (sub) sub.textContent = payload && payload.label ? payload.label : '';
      return;
    }
    if (state === 'error') {
      body.innerHTML = '<div class="mk-img-search-error">'
        + escapeAttr(payload && payload.message ? payload.message : 'Erreur réseau')
        + '<div class="mk-img-search-hint">Vérifie que la fonction <code>product-image-search</code> est bien déployée sur Supabase.</div>'
        + '</div>';
      return;
    }
    if (state === 'empty') {
      body.innerHTML = '<div class="mk-img-search-empty">Aucune image trouvée. Essaie de modifier le nom du produit puis relance.</div>';
      return;
    }
    // state === 'results'
    const cands = (payload && payload.candidates) || [];
    const idx = payload && typeof payload.productIndex === 'number' ? payload.productIndex : -1;
    body.innerHTML = '<div class="mk-img-search-grid">'
      + cands.map(function (c, k) {
          const src = String(c.url || '').replace(/"/g, '&quot;');
          const srcThumb = 'https://images.weserv.nl/?url='
            + encodeURIComponent(String(c.url || '').replace(/^https?:\/\//, ''))
            + '&w=320&output=jpg&q=85';
          const badge = c.source === 'openproducts'
            ? '<span class="mk-img-badge mk-img-badge-op">OpenProducts</span>'
            : (c.source === 'google'
                ? '<span class="mk-img-badge mk-img-badge-gg">Google</span>'
                : '<span class="mk-img-badge">' + escapeAttr(c.source || '') + '</span>');
          const title = c.title ? '<div class="mk-img-card-title" title="' + escapeAttr(c.title) + '">' + escapeAttr(c.title) + '</div>' : '';
          return '<div class="mk-img-card">'
            + '<div class="mk-img-card-thumb">'
            +   '<img loading="lazy" src="' + srcThumb + '" onerror="this.style.opacity=.25;this.title=\'image inaccessible\'" />'
            +   badge
            + '</div>'
            + title
            + '<button class="mk-img-card-use" onclick="window.mkImgUse(' + idx + ',' + k + ')">Utiliser cette image</button>'
            + '</div>';
        }).join('')
      + '</div>';
    // Stocke la liste pour mkImgUse
    window.__mkImgLastCandidates = cands;
    window.__mkImgLastIndex = idx;
  }

  window.mkImgCloseModal = function () {
    const modal = document.getElementById('mk-img-search-modal');
    if (!modal) return;
    modal.setAttribute('hidden', '');
    if (modal.__escHandler) {
      document.removeEventListener('keydown', modal.__escHandler, true);
      modal.__escHandler = null;
    }
  };

  // Escape ferme le modal image search dès qu'il est visible
  function mkImgBindEscape() {
    const modal = document.getElementById('mk-img-search-modal');
    if (!modal || modal.__escHandler) return;
    modal.__escHandler = function (e) {
      if (e.key === 'Escape' && !modal.hasAttribute('hidden')) {
        e.stopPropagation();
        window.mkImgCloseModal();
      }
    };
    document.addEventListener('keydown', modal.__escHandler, true);
  }

  window.mkImgUse = function (productIndex, candIndex) {
    if (!editingSheet || !editingSheet.products[productIndex]) return;
    const cands = window.__mkImgLastCandidates || [];
    const c = cands[candIndex];
    if (!c || !c.url) return;
    editingSheet.products[productIndex].img = c.url;
    editingSheet.updated_at = new Date().toISOString();
    window.mkImgCloseModal();
    renderEdit();
    if (typeof window.showToast === 'function') {
      window.showToast('Image associée au produit ✓', 'success');
    }
  };

  window.mkFindImages = function (i) {
    if (!editingSheet || !editingSheet.products[i]) return;
    const p = editingSheet.products[i];
    const name = String(p.designation || '').trim();
    const cip13 = String(p.cip13 || '').trim();
    // Heuristique EAN : si le code n'est pas un CIP13 FR (13 chars commençant
    // par 3400) on l'envoie aussi en EAN — utile pour parapharma.
    const looksLikeCip = /^3400\d{9}$/.test(cip13);
    const ean = p.ean ? String(p.ean).trim() : (cip13 && !looksLikeCip ? cip13 : '');

    if (!name && !cip13 && !ean) {
      if (typeof window.showToast === 'function') {
        window.showToast('Pas assez d\'infos pour chercher (nom/CIP/EAN manquants)', 'info');
      }
      return;
    }

    mkImgEnsureModal();
    const modal = document.getElementById('mk-img-search-modal');
    modal.removeAttribute('hidden');
    mkImgBindEscape();
    mkImgRenderState('loading', { label: name || cip13 || ean });

    const base = (window.SUPABASE_URL || '').replace(/\/+$/, '');
    if (!base) {
      mkImgRenderState('error', { message: 'SUPABASE_URL non défini.' });
      return;
    }
    const params = new URLSearchParams();
    if (ean) params.set('ean', ean);
    if (cip13) params.set('cip13', cip13);
    if (name) params.set('name', name);
    const url = base + '/functions/v1/product-image-search?' + params.toString();

    const headers = { 'Accept': 'application/json' };
    if (window.SUPABASE_ANON_KEY) {
      headers['apikey'] = window.SUPABASE_ANON_KEY;
      headers['Authorization'] = 'Bearer ' + window.SUPABASE_ANON_KEY;
    }

    // Timeout client 12s
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 12000) : null;

    fetch(url, { method: 'GET', headers: headers, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        if (timer) clearTimeout(timer);
        if (!r.ok) {
          // 404 = function non déployée
          if (r.status === 404) {
            throw new Error('Fonction product-image-search non déployée sur Supabase (404).');
          }
          throw new Error('Erreur serveur (' + r.status + ')');
        }
        return r.json();
      })
      .then(function (data) {
        const cands = (data && Array.isArray(data.candidates)) ? data.candidates : [];
        if (!cands.length) {
          mkImgRenderState('empty');
          return;
        }
        mkImgRenderState('results', { candidates: cands, productIndex: i });
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        const msg = (err && err.message) ? err.message : 'Erreur réseau';
        mkImgRenderState('error', { message: msg });
        if (typeof window.showToast === 'function') {
          window.showToast('Recherche image : ' + msg, 'error');
        }
      });
  };

})();
