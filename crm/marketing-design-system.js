/* marketing-design-system.js — Design System Pharma 2026-2027 Premium
 *
 * Système refondu par 3 agents experts Opus + synthèse directeur marketing :
 *   - 20 palettes pharma (10 tendances 2026-27 + 5 neutres premium + 5 signatures IP)
 *   - 14 paires typo (signature/editorial/premium/modern/technique/classique)
 *   - 20 gradient meshes (light/medium/dark/holographic)
 *   - 20 stickers SVG inline (badges commerciaux pharma)
 *   - 12 patterns overlay
 *   - 8 design presets combos prêts à l'emploi
 *
 * Conformes WCAG AA. Optimisés print A4 + écran. Inspirations :
 *   Aesop · Bioderma 2024 · La Roche-Posay refresh · Eight Sleep · Headspace 2023
 *   Pierre Fabre digital · Pantone 2026 · WGSN Beauty Insight S/S 2026
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // 1. COLOR PRESETS — 20 palettes stratifiées pharma 2026-27
  // ═══════════════════════════════════════════════════════════════════════
  // Stratégie : chaque palette a un USE CASE commercial unique. Les chiffres prix
  // (priceBg/priceFg) sont WCAG AA minimum sur leur paire. Le bleu IP #0057FF
  // n'apparait JAMAIS en bg dominant. Les rouges virent burgundy/cherry/terracotta.
  var COLOR_PRESETS = {
    // ─── Tendances 2026-2027 (10) ──────────────────────────────────
    'future-dusk-pharma':   { name: 'Future Dusk',        category: 'trend',     mood: 'premium sérieux',       useCase: 'Biosimilaires premium · innovation laboratoires', bg:'#F5F2EC', accent:'#2D2A4A', headerBg:'#4A4870', headerFg:'#F5F2EC', priceBg:'#2D2A4A', priceFg:'#FFD66B', complementary:'#8B88A8', highlight:'#FFD66B' },
    'transformative-teal':  { name: 'Teal Vitalité',      category: 'trend',     mood: 'frais dynamique',       useCase: 'Nutrition · compléments · bien-être · minceur', bg:'#F8FAF9', accent:'#0F5A4E', headerBg:'#0E7C66', headerFg:'#FFFFFF', priceBg:'#0F5A4E', priceFg:'#FFE8A3', complementary:'#4F8276', highlight:'#C9421A' },
    'butter-yellow-solaire':{ name: 'Butter Solaire',     category: 'trend',     mood: 'chaleureux dynamique',  useCase: 'Été solaire · vitamine D · photoprotection', bg:'#FFFCF2', accent:'#3D2817', headerBg:'#FFD66B', headerFg:'#3D2817', priceBg:'#3D2817', priceFg:'#FFD66B', complementary:'#C49A4A', highlight:'#FF6B35' },
    'sour-cherry-prestige': { name: 'Cherry Lacquer',     category: 'trend',     mood: 'premium dynamique',     useCase: 'Prestige fin d’année · Black Friday · cosméto haut de gamme', bg:'#FAF6F2', accent:'#5C1A24', headerBg:'#7A2433', headerFg:'#FAF6F2', priceBg:'#5C1A24', priceFg:'#F4B942', complementary:'#B8956A', highlight:'#F4B942' },
    'aura-indigo-tech':     { name: 'Aura Indigo Tech',   category: 'trend',     mood: 'premium sérieux',       useCase: 'Dispositifs connectés · autotests · diabète · santé connectée', bg:'#F4F4F8', accent:'#1E1B4B', headerBg:'#2E2A6B', headerFg:'#F4F4F8', priceBg:'#1E1B4B', priceFg:'#A5F3FC', complementary:'#6366A8', highlight:'#A5F3FC' },
    'mocha-mousse-2025':    { name: 'Mocha Apothicaire',  category: 'trend',     mood: 'chaleureux premium',    useCase: 'Phytothérapie · médecine douce · parapharma naturelle · BIO', bg:'#FAF5EC', accent:'#3A2A1F', headerBg:'#6B4A38', headerFg:'#FAF5EC', priceBg:'#3A2A1F', priceFg:'#F4B942', complementary:'#7A5C49', highlight:'#3D6B2E' },
    'verdant-sage':         { name: 'Sage Botanique',     category: 'trend',     mood: 'frais sérieux',         useCase: 'Dermo-cosmétique sensibles · femmes enceintes · BIO', bg:'#F4F6F2', accent:'#2F4030', headerBg:'#4F6B47', headerFg:'#F4F6F2', priceBg:'#2F4030', priceFg:'#FAF5EC', complementary:'#6F8266', highlight:'#A77A47' },
    'coral-warmth':         { name: 'Corail Officinal',   category: 'trend',     mood: 'chaleureux dynamique',  useCase: 'Maternité-bébé · pédiatrie · anti-âge premières rides', bg:'#FDF8F4', accent:'#7A2E1A', headerBg:'#A0432A', headerFg:'#FDF8F4', priceBg:'#7A2E1A', priceFg:'#FDF8F4', complementary:'#BC6A50', highlight:'#1E3A5F' },
    'raspberry-mat':        { name: 'Framboise Mate',     category: 'trend',     mood: 'dynamique premium',     useCase: 'Santé féminine · ménopause · hygiène intime', bg:'#FAF4F6', accent:'#4A1E2E', headerBg:'#9B3A5C', headerFg:'#FAF4F6', priceBg:'#4A1E2E', priceFg:'#FFD66B', complementary:'#C77B96', highlight:'#16A085' },
    'ocean-deep':           { name: 'Océan Profond',      category: 'trend',     mood: 'sérieux frais',         useCase: 'Thalasso · sérum physio · gammes laboratoire générique', bg:'#F0F4F7', accent:'#0A2540', headerBg:'#1E3A5F', headerFg:'#F0F4F7', priceBg:'#0A2540', priceFg:'#FFD66B', complementary:'#5C7C9C', highlight:'#FF6B35' },

    // ─── Neutres Premium (5) ───────────────────────────────────────
    'ivoire-vellum':        { name: 'Ivoire Vélin',       category: 'neutral',   mood: 'premium sérieux',       useCase: 'Catalogue permanent · génériques référence · DM techniques', bg:'#F5F0E8', accent:'#1A1A1A', headerBg:'#2C2C2C', headerFg:'#F5F0E8', priceBg:'#1A1A1A', priceFg:'#FFD66B', complementary:'#8B7E68', highlight:'#0057FF' },
    'glacial-white':        { name: 'Blanc Glacé',        category: 'neutral',   mood: 'sérieux frais',         useCase: 'Fiches techniques DM · data-sheets posologie · RCP · ANSM', bg:'#FAFBFC', accent:'#0A1628', headerBg:'#1B2A4E', headerFg:'#FAFBFC', priceBg:'#0A1628', priceFg:'#FAFBFC', complementary:'#4A5A6A', highlight:'#0057FF' },
    'champagne-mineral':    { name: 'Champagne Minéral',  category: 'neutral',   mood: 'premium chaleureux',    useCase: 'Cosméto-pharma premium · anti-âge · sérums signature', bg:'#F4EFE3', accent:'#2B2118', headerBg:'#5C4A35', headerFg:'#F4EFE3', priceBg:'#2B2118', priceFg:'#D4A574', complementary:'#A89478', highlight:'#7A2E1A' },
    'graphite-mat':         { name: 'Graphite Mat',       category: 'neutral',   mood: 'premium sérieux',       useCase: 'Best-sellers · éditions limitées · gammes prestige · VIP', bg:'#1C1C1E', accent:'#F2EDE4', headerBg:'#2C2C2E', headerFg:'#F2EDE4', priceBg:'#F2EDE4', priceFg:'#1C1C1E', complementary:'#8B8680', highlight:'#FFD66B' },
    'perle-grise':          { name: 'Perle Grise',        category: 'neutral',   mood: 'frais sérieux',         useCase: 'Fiches dense data · grilles tarifaires multi-SKU · comparatives', bg:'#EDEEF0', accent:'#1F2937', headerBg:'#374151', headerFg:'#EDEEF0', priceBg:'#1F2937', priceFg:'#FFD66B', complementary:'#6B7280', highlight:'#FF6B35' },

    // ─── Signatures Intégral Pharma (5) ────────────────────────────
    'ip-signature-azure':   { name: 'IP Azur Signature',  category: 'signature', mood: 'premium dynamique',     useCase: 'Branding fort · garde catalogue IP · fiches signature commercial', bg:'#F4F7FC', accent:'#0A1F4E', headerBg:'#1B2A4E', headerFg:'#F4F7FC', priceBg:'#0057FF', priceFg:'#FFFFFF', complementary:'#5C7CC4', highlight:'#FFD66B' },
    'ip-encre-miel':        { name: 'IP Encre & Miel',    category: 'signature', mood: 'chaleureux premium',    useCase: 'Conseil officinal · formations · fidélité IP · livrets patient', bg:'#FAF6EE', accent:'#0A1F4E', headerBg:'#1B2A4E', headerFg:'#FAF6EE', priceBg:'#0A1F4E', priceFg:'#F4B942', complementary:'#B8956A', highlight:'#0057FF' },
    'ip-cherry-edition':    { name: 'IP Cherry Édition',  category: 'signature', mood: 'premium dynamique',     useCase: 'Promo trimestrielles · destockage · Black Friday · ventes flash', bg:'#FAF4F4', accent:'#0A1F4E', headerBg:'#5C1A24', headerFg:'#FAF4F4', priceBg:'#5C1A24', priceFg:'#FFD66B', complementary:'#0057FF', highlight:'#FFD66B' },
    'ip-sage-conseil':      { name: 'IP Sage Conseil',    category: 'signature', mood: 'frais sérieux',         useCase: 'Gammes BIO IP · phyto sélectionnée · accompagnement naturopathe', bg:'#F4F7F2', accent:'#1A2F1E', headerBg:'#2F4030', headerFg:'#F4F7F2', priceBg:'#1A2F1E', priceFg:'#F4B942', complementary:'#0057FF', highlight:'#D4A574' },
    'ip-graphite-prestige': { name: 'IP Graphite Prestige', category: 'signature', mood: 'premium sérieux',     useCase: 'Grands comptes · groupements · centrales d’achat · présentations direction', bg:'#1A1D2E', accent:'#F2EDE4', headerBg:'#2C3045', headerFg:'#F2EDE4', priceBg:'#F2EDE4', priceFg:'#0A1F4E', complementary:'#7BA8FF', highlight:'#FFD66B' },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 2. FONT PAIRS — 14 paires typo pharma premium 2026
  // ═══════════════════════════════════════════════════════════════════════
  // Variable fonts privilégiées. Tabular nums actifs sur body. Optical sizing
  // sur les serifs éditoriales. Min weight 400 en print (300/200 invisibles).
  var FONT_PAIRS = {
    'default': {
      name: 'DM Sans (système)',
      category: 'modern', mood: 'sérieux technique',
      heading: { family: 'DM Sans',          weight: 800, italic: false },
      body:    { family: 'DM Sans',          weight: 500, italic: false },
      googleFamilies: [],
    },
    'fraunces-inter': {
      name: 'Fraunces Editorial',
      category: 'signature', mood: 'luxe éditorial',
      heading: { family: 'Fraunces',         weight: 800, italic: false },
      body:    { family: 'Inter',            weight: 400, italic: false },
      googleFamilies: ['Fraunces:opsz,wght@9..144,700;9..144,800;9..144,900', 'Inter:wght@400;500;600;700'],
    },
    'newsreader-dm-sans': {
      name: 'Newsreader Memo',
      category: 'editorial', mood: 'sérieux chaleureux',
      heading: { family: 'Newsreader',       weight: 700, italic: false },
      body:    { family: 'DM Sans',          weight: 400, italic: false },
      googleFamilies: ['Newsreader:opsz,wght@6..72,600;6..72,700;6..72,800', 'DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700'],
    },
    'bricolage-public-sans': {
      name: 'Bricolage Modern',
      category: 'modern', mood: 'éclatant technique',
      heading: { family: 'Bricolage Grotesque', weight: 800, italic: false },
      body:    { family: 'Public Sans',      weight: 400, italic: false },
      googleFamilies: ['Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800', 'Public+Sans:wght@400;500;600;700'],
    },
    'cormorant-dm-sans': {
      name: 'Cormorant Pharmacie',
      category: 'premium', mood: 'luxe sérieux',
      heading: { family: 'Cormorant Garamond', weight: 600, italic: true },
      body:    { family: 'DM Sans',          weight: 400, italic: false },
      googleFamilies: ['Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600', 'DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700'],
    },
    'geist-mono': {
      name: 'Geist Tech',
      category: 'modern', mood: 'technique éclatant',
      heading: { family: 'Geist',            weight: 700, italic: false },
      body:    { family: 'Geist',            weight: 400, italic: false },
      googleFamilies: ['Geist:wght@400;500;600;700;800', 'Geist+Mono:wght@400;500;700'],
    },
    'instrument-jakarta': {
      name: 'Instrument Editorial',
      category: 'signature', mood: 'luxe éclatant',
      heading: { family: 'Instrument Serif', weight: 400, italic: false },
      body:    { family: 'Plus Jakarta Sans', weight: 400, italic: false },
      googleFamilies: ['Instrument+Serif:ital,wght@0,400;1,400', 'Plus+Jakarta+Sans:wght@400;500;600;700;800'],
    },
    'space-ibm-plex': {
      name: 'Space IBM Technical',
      category: 'technique', mood: 'technique sérieux',
      heading: { family: 'Space Grotesk',    weight: 700, italic: false },
      body:    { family: 'IBM Plex Sans',    weight: 400, italic: false },
      googleFamilies: ['Space+Grotesk:wght@400;500;600;700', 'IBM+Plex+Sans:wght@400;500;600;700'],
    },
    'playfair-inter': {
      name: 'Playfair Classique',
      category: 'premium', mood: 'luxe chaleureux',
      heading: { family: 'Playfair Display', weight: 700, italic: false },
      body:    { family: 'Inter',            weight: 400, italic: false },
      googleFamilies: ['Playfair+Display:ital,wght@0,700;0,800;1,700', 'Inter:wght@400;500;600;700'],
    },
    'manrope-mono': {
      name: 'Manrope Wellness',
      category: 'modern', mood: 'éclatant chaleureux',
      heading: { family: 'Manrope',          weight: 800, italic: false },
      body:    { family: 'Manrope',          weight: 500, italic: false },
      googleFamilies: ['Manrope:wght@400;500;600;700;800', 'IBM+Plex+Mono:wght@400;500'],
    },
    'eb-garamond-work': {
      name: 'EB Garamond Classique',
      category: 'classic', mood: 'sérieux chaleureux',
      heading: { family: 'EB Garamond',      weight: 700, italic: false },
      body:    { family: 'Work Sans',        weight: 400, italic: false },
      googleFamilies: ['EB+Garamond:ital,wght@0,600;0,700;1,500;1,700', 'Work+Sans:wght@400;500;600;700'],
    },
    'bricolage-system': {
      name: 'Bricolage Système Unique',
      category: 'modern', mood: 'éclatant signature',
      heading: { family: 'Bricolage Grotesque', weight: 800, italic: false },
      body:    { family: 'Bricolage Grotesque', weight: 500, italic: false },
      googleFamilies: ['Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800'],
    },
    'libre-caslon-inter': {
      name: 'Libre Caslon Apothecary',
      category: 'premium', mood: 'luxe chaleureux',
      heading: { family: 'Libre Caslon Display', weight: 400, italic: false },
      body:    { family: 'Inter',            weight: 400, italic: false },
      googleFamilies: ['Libre+Caslon+Display', 'Libre+Caslon+Text:ital,wght@0,400;0,700;1,400', 'Inter:wght@400;500;600;700'],
    },
    'syne-inter': {
      name: 'Syne Editorial Audacieux',
      category: 'signature', mood: 'éclatant signature',
      heading: { family: 'Syne',             weight: 800, italic: false },
      body:    { family: 'Inter',            weight: 400, italic: false },
      googleFamilies: ['Syne:wght@600;700;800', 'Inter:wght@400;500;600;700'],
    },
  };

  // Lazy load Google Fonts pour un pair donne (idempotent + display=swap)
  var loadedFontIds = {};
  function mkLoadFontPair(pairId) {
    var pair = FONT_PAIRS[pairId];
    if (!pair || loadedFontIds[pairId]) return;
    if (!pair.googleFamilies || !pair.googleFamilies.length) {
      loadedFontIds[pairId] = true; return;
    }
    var href = 'https://fonts.googleapis.com/css2?'
      + pair.googleFamilies.map(function (f) { return 'family=' + f; }).join('&')
      + '&display=swap';
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    loadedFontIds[pairId] = true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. GRADIENT MESHES — 20 fonds pharma 2026
  // ═══════════════════════════════════════════════════════════════════════
  var GRADIENTS = {
    'none': { name: 'Aucun', category: 'none', darkness: 'light', css: '', preview: '#F2F2F7' },

    // Light (8)
    'aurora-cream':     { name: 'Aurore Crémeuse',     category: 'light', darkness: 'light', mood: 'doux',
      css: 'radial-gradient(at 20% 30%, #FFE8D6 0%, transparent 50%), radial-gradient(at 80% 20%, #F4D9C6 0%, transparent 45%), radial-gradient(at 60% 80%, #E8D5C4 0%, transparent 55%), linear-gradient(135deg, #FAF3EC 0%, #F1E4D3 100%)',
      preview: 'linear-gradient(135deg, #FAF3EC, #F4D9C6, #E8D5C4)' },
    'morning-officine': { name: 'Matin Officine',      category: 'light', darkness: 'light', mood: 'frais',
      css: 'radial-gradient(at 30% 20%, #E8F1F8 0%, transparent 50%), radial-gradient(at 70% 70%, #DDE9E5 0%, transparent 55%), linear-gradient(180deg, #F7FAFB 0%, #EAF0F1 100%)',
      preview: 'linear-gradient(180deg, #F7FAFB, #DDE9E5)' },
    'sage-whisper':     { name: 'Murmure Sauge',       category: 'light', darkness: 'light', mood: 'apaisant',
      css: 'radial-gradient(at 25% 25%, #E4EDE3 0%, transparent 50%), radial-gradient(at 75% 60%, #D6E3D5 0%, transparent 50%), linear-gradient(135deg, #F0F4ED 0%, #DCE6D7 100%)',
      preview: 'linear-gradient(135deg, #F0F4ED, #D6E3D5)' },
    'porcelain-rose':   { name: 'Porcelaine Rosée',    category: 'light', darkness: 'light', mood: 'tendre',
      css: 'radial-gradient(at 20% 30%, #FBE7E3 0%, transparent 55%), radial-gradient(at 80% 70%, #F2D8D5 0%, transparent 50%), linear-gradient(150deg, #FDF3F1 0%, #EFD8D4 100%)',
      preview: 'linear-gradient(150deg, #FDF3F1, #F2D8D5)' },
    'linen-mist':       { name: 'Brume de Lin',        category: 'light', darkness: 'light', mood: 'neutre',
      css: 'radial-gradient(at 50% 30%, #F0EBE3 0%, transparent 60%), linear-gradient(180deg, #FAF7F2 0%, #ECE5DA 100%)',
      preview: 'linear-gradient(180deg, #FAF7F2, #ECE5DA)' },
    'lavender-clinic':  { name: 'Lavande Clinique',    category: 'light', darkness: 'medium', mood: 'raffiné',
      css: 'radial-gradient(at 30% 30%, #EDE7F2 0%, transparent 55%), radial-gradient(at 70% 70%, #DCD2E5 0%, transparent 50%), linear-gradient(135deg, #F4F0F8 0%, #D9CFE3 100%)',
      preview: 'linear-gradient(135deg, #F4F0F8, #DCD2E5)' },
    'iridescent-innovation': { name: 'Innovation Iridescente', category: 'holographic', darkness: 'light', mood: 'futuriste',
      css: 'radial-gradient(at 20% 30%, #C4E8E2 0%, transparent 50%), radial-gradient(at 50% 50%, #E2C4E8 0%, transparent 50%), radial-gradient(at 80% 70%, #C4D4E8 0%, transparent 50%), linear-gradient(135deg, #F0E8F4 0%, #D4E8E8 100%)',
      preview: 'linear-gradient(135deg, #C4E8E2, #E2C4E8, #C4D4E8)' },
    'duochrome-derma':  { name: 'Duochrome Derma',     category: 'holographic', darkness: 'light', mood: 'pointu',
      css: 'radial-gradient(at 30% 30%, #F2D6D6 0%, transparent 55%), radial-gradient(at 70% 70%, #D6E0F2 0%, transparent 55%), linear-gradient(135deg, #F8EAEA 0%, #DAE2F0 100%)',
      preview: 'linear-gradient(135deg, #F2D6D6, #D6E0F2)' },

    // Medium (5)
    'terracotta-glow':  { name: 'Lueur Terracotta',    category: 'medium', darkness: 'medium', mood: 'chaleureux',
      css: 'radial-gradient(at 25% 25%, #E8B89A 0%, transparent 50%), radial-gradient(at 75% 65%, #D89878 0%, transparent 55%), linear-gradient(135deg, #F0CBB0 0%, #C68660 100%)',
      preview: 'linear-gradient(135deg, #F0CBB0, #D89878, #C68660)' },
    'honey-amber':      { name: 'Ambre Miellé',        category: 'medium', darkness: 'medium', mood: 'premium',
      css: 'radial-gradient(at 30% 30%, #F0C77A 0%, transparent 50%), radial-gradient(at 70% 70%, #D9A857 0%, transparent 55%), linear-gradient(135deg, #F4D69A 0%, #B8852F 100%)',
      preview: 'linear-gradient(135deg, #F4D69A, #D9A857, #B8852F)' },
    'ocean-laboratoire':{ name: 'Océan Laboratoire',   category: 'medium', darkness: 'medium', mood: 'scientifique',
      css: 'radial-gradient(at 25% 30%, #A8C5D6 0%, transparent 50%), radial-gradient(at 75% 70%, #6F9BB5 0%, transparent 55%), linear-gradient(135deg, #C7DCE8 0%, #4A7894 100%)',
      preview: 'linear-gradient(135deg, #C7DCE8, #6F9BB5, #4A7894)' },
    'forest-apothecary':{ name: 'Forêt Apothicaire',   category: 'medium', darkness: 'medium', mood: 'naturel',
      css: 'radial-gradient(at 30% 25%, #A8BCA0 0%, transparent 50%), radial-gradient(at 70% 75%, #6B8268 0%, transparent 55%), linear-gradient(135deg, #C2D4BB 0%, #4A6248 100%)',
      preview: 'linear-gradient(135deg, #C2D4BB, #6B8268, #4A6248)' },
    'holographic-lab':  { name: 'Labo Holographique',  category: 'holographic', darkness: 'light', mood: 'tech',
      css: 'radial-gradient(at 25% 25%, #B8D4E8 0%, transparent 50%), radial-gradient(at 50% 60%, #D4C2E8 0%, transparent 45%), radial-gradient(at 75% 75%, #C2E8D8 0%, transparent 50%), linear-gradient(135deg, #E8F0F8 0%, #C8D4E0 100%)',
      preview: 'linear-gradient(135deg, #B8D4E8, #D4C2E8, #C2E8D8)' },

    // Dark (6)
    'cherry-lacquer':   { name: 'Laque Cerise',        category: 'dark',  darkness: 'dark',  mood: 'vibrant',
      css: 'radial-gradient(at 25% 25%, #C9484E 0%, transparent 50%), radial-gradient(at 75% 70%, #8E2E33 0%, transparent 55%), linear-gradient(135deg, #B53D43 0%, #5D1B1F 100%)',
      preview: 'linear-gradient(135deg, #C9484E, #8E2E33, #5D1B1F)' },
    'midnight-officine':{ name: 'Minuit Officine',     category: 'dark',  darkness: 'dark',  mood: 'élégant',
      css: 'radial-gradient(at 30% 30%, #2E3A4C 0%, transparent 55%), radial-gradient(at 70% 70%, #1A2230 0%, transparent 50%), linear-gradient(135deg, #3A4759 0%, #0E1520 100%)',
      preview: 'linear-gradient(135deg, #3A4759, #1A2230, #0E1520)' },
    'burgundy-velvet':  { name: 'Bordeaux Velours',    category: 'dark',  darkness: 'dark',  mood: 'luxueux',
      css: 'radial-gradient(at 25% 25%, #6B2A37 0%, transparent 55%), radial-gradient(at 75% 75%, #3E1620 0%, transparent 50%), linear-gradient(135deg, #5C2230 0%, #2A0F17 100%)',
      preview: 'linear-gradient(135deg, #5C2230, #3E1620, #2A0F17)' },
    'forest-deep':      { name: 'Forêt Profonde',      category: 'dark',  darkness: 'dark',  mood: 'ancré',
      css: 'radial-gradient(at 30% 25%, #2D4030 0%, transparent 55%), radial-gradient(at 70% 75%, #1A2A1D 0%, transparent 50%), linear-gradient(135deg, #243824 0%, #0E170F 100%)',
      preview: 'linear-gradient(135deg, #243824, #1A2A1D, #0E170F)' },
    'ink-pharma':       { name: 'Encre Pharma',        category: 'dark',  darkness: 'dark',  mood: 'sobre',
      css: 'radial-gradient(at 50% 30%, #2A3340 0%, transparent 60%), linear-gradient(180deg, #1E2530 0%, #0D1218 100%)',
      preview: 'linear-gradient(180deg, #2A3340, #0D1218)' },
    'aurora-night':     { name: 'Aurore Boréale',      category: 'dark',  darkness: 'dark',  mood: 'magique',
      css: 'radial-gradient(at 20% 30%, #3D5A7A 0%, transparent 55%), radial-gradient(at 50% 60%, #5A4A7A 0%, transparent 50%), radial-gradient(at 80% 80%, #4A7A6E 0%, transparent 55%), linear-gradient(135deg, #2A3A52 0%, #1A2030 100%)',
      preview: 'linear-gradient(135deg, #3D5A7A, #5A4A7A, #4A7A6E)' },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 4. STICKERS — 20 badges SVG commerciaux pharma
  // ═══════════════════════════════════════════════════════════════════════
  function svgWrap(inner) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' + inner + '</svg>'; }
  var STICKERS = {
    'none':       { name: 'Aucun',           svg: '' },
    'nouveau':    { name: 'NOUVEAU 2026',    svg: svgWrap('<path d="M60 8 L66 22 L82 14 L80 30 L96 30 L86 44 L102 50 L86 58 L96 72 L80 72 L82 88 L66 80 L60 96 L54 80 L38 88 L40 72 L24 72 L34 58 L18 50 L34 44 L24 30 L40 30 L38 14 L54 22 Z" fill="#C9484E"/><text x="60" y="58" font-family="Inter, sans-serif" font-size="14" font-weight="800" fill="#FFFFFF" text-anchor="middle">NOUVEAU</text><text x="60" y="72" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="#FFFFFF" text-anchor="middle" opacity="0.85">2026</text>') },
    'exclu-ip':   { name: 'EXCLU IP',        svg: svgWrap('<circle cx="60" cy="60" r="52" fill="#1A2230" stroke="#F0C77A" stroke-width="2"/><circle cx="60" cy="60" r="46" fill="none" stroke="#F0C77A" stroke-width="0.5" stroke-dasharray="2 3"/><text x="60" y="52" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="#F0C77A" text-anchor="middle" letter-spacing="2">OFFRE</text><text x="60" y="70" font-family="Inter, sans-serif" font-size="18" font-weight="800" fill="#F0C77A" text-anchor="middle">EXCLU</text><text x="60" y="84" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="#F0C77A" text-anchor="middle" letter-spacing="3">INTEGRAL</text>') },
    'promo-30':   { name: 'PROMO -30%',      svg: svgWrap('<circle cx="60" cy="60" r="50" fill="#C9484E"/><circle cx="60" cy="60" r="44" fill="none" stroke="#FFFFFF" stroke-width="1.5"/><text x="60" y="52" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">PROMO</text><text x="60" y="78" font-family="Inter, sans-serif" font-size="26" font-weight="900" fill="#FFFFFF" text-anchor="middle">-30%</text>') },
    'bio':        { name: 'BIO CERTIFIÉ',    svg: svgWrap('<path d="M60 10 Q72 18 82 18 Q92 28 92 38 Q102 50 102 60 Q102 72 92 82 Q82 92 72 92 Q60 102 48 92 Q38 92 28 82 Q18 72 18 60 Q18 50 28 38 Q38 28 48 18 Z" fill="#4A6248"/><path d="M50 55 Q60 45 70 55 Q70 65 60 70 Q50 65 50 55 Z M60 70 L60 80" fill="none" stroke="#F0F4ED" stroke-width="1.5"/><text x="60" y="62" font-family="Inter, sans-serif" font-size="22" font-weight="800" fill="#F0F4ED" text-anchor="middle">BIO</text><text x="60" y="78" font-family="Inter, sans-serif" font-size="7" font-weight="600" fill="#F0F4ED" text-anchor="middle" letter-spacing="1.5">CERTIFIE</text>') },
    'bestseller': { name: 'TOP BEST-SELLER', svg: svgWrap('<path d="M10 35 L95 35 L110 60 L95 85 L10 85 Z" fill="#D9A857"/><circle cx="22" cy="60" r="4" fill="#1A2230"/><text x="62" y="55" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="#1A2230" text-anchor="middle" letter-spacing="2">TOP</text><text x="62" y="72" font-family="Inter, sans-serif" font-size="13" font-weight="800" fill="#1A2230" text-anchor="middle">BEST-SELLER</text>') },
    'innovation': { name: 'INNOVATION 2026', svg: svgWrap('<defs><linearGradient id="innov-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3A4759"/><stop offset="100%" stop-color="#1A2230"/></linearGradient></defs><circle cx="60" cy="60" r="52" fill="url(#innov-grad)"/><circle cx="60" cy="60" r="46" fill="none" stroke="#C4E8E2" stroke-width="0.8" stroke-dasharray="1 2"/><path d="M60 30 L63 50 L78 50 L66 60 L70 78 L60 68 L50 78 L54 60 L42 50 L57 50 Z" fill="#C4E8E2" opacity="0.3"/><text x="60" y="65" font-family="Inter, sans-serif" font-size="12" font-weight="800" fill="#C4E8E2" text-anchor="middle" letter-spacing="1">INNOVATION</text><text x="60" y="80" font-family="Inter, sans-serif" font-size="7" font-weight="600" fill="#C4E8E2" text-anchor="middle" letter-spacing="2" opacity="0.8">2026</text>') },
    'saison':     { name: 'SAISON',          svg: svgWrap('<rect x="10" y="45" width="100" height="30" rx="15" fill="#E8B89A"/><circle cx="25" cy="60" r="5" fill="#5D1B1F"/><text x="70" y="65" font-family="Inter, sans-serif" font-size="13" font-weight="800" fill="#5D1B1F" text-anchor="middle" letter-spacing="2">SAISON</text>') },
    'eco':        { name: 'ÉCO-RESPONSABLE', svg: svgWrap('<circle cx="60" cy="60" r="48" fill="#6B8268"/><path d="M60 25 Q40 35 40 55 Q40 75 60 80 Q60 70 55 65 Q50 60 55 50 Q60 40 60 25 Z" fill="#F0F4ED" opacity="0.25"/><text x="60" y="58" font-family="Inter, sans-serif" font-size="20" font-weight="800" fill="#F0F4ED" text-anchor="middle">ECO</text><text x="60" y="75" font-family="Inter, sans-serif" font-size="7" font-weight="600" fill="#F0F4ED" text-anchor="middle" letter-spacing="2">RESPONSABLE</text>') },
    'recyclable': { name: 'RECYCLABLE',      svg: svgWrap('<circle cx="60" cy="60" r="50" fill="#F0F4ED" stroke="#4A6248" stroke-width="2"/><path d="M45 50 L55 40 L60 45 L50 55 Z M70 50 L75 60 L70 65 L60 55 Z M50 70 L60 75 L65 70 L60 60 Z" fill="#4A6248"/><text x="60" y="90" font-family="Inter, sans-serif" font-size="8" font-weight="700" fill="#4A6248" text-anchor="middle" letter-spacing="1.5">RECYCLABLE</text>') },
    'biosimilaire':{ name: 'BIOSIMILAIRE',   svg: svgWrap('<rect x="5" y="48" width="110" height="24" rx="12" fill="#4A7894"/><circle cx="18" cy="60" r="3" fill="#F7FAFB"/><circle cx="25" cy="60" r="2" fill="#F7FAFB" opacity="0.7"/><text x="70" y="65" font-family="Inter, sans-serif" font-size="11" font-weight="800" fill="#F7FAFB" text-anchor="middle" letter-spacing="1.5">BIOSIMILAIRE</text>') },
    'dermo':      { name: 'DERMO-COSMÉTIQUE',svg: svgWrap('<rect x="5" y="48" width="110" height="24" rx="12" fill="#FBE7E3" stroke="#6B2A37" stroke-width="1"/><text x="60" y="65" font-family="Inter, sans-serif" font-size="9" font-weight="800" fill="#6B2A37" text-anchor="middle" letter-spacing="1.5">DERMO-COSMETIQUE</text>') },
    'medical':    { name: 'DM CE',           svg: svgWrap('<path d="M5 40 L100 40 L115 60 L100 80 L5 80 Z" fill="#2E3A4C"/><rect x="15" y="53" width="14" height="14" fill="none" stroke="#F7FAFB" stroke-width="1.5"/><line x1="22" y1="55" x2="22" y2="65" stroke="#F7FAFB" stroke-width="1.5"/><line x1="17" y1="60" x2="27" y2="60" stroke="#F7FAFB" stroke-width="1.5"/><text x="68" y="58" font-family="Inter, sans-serif" font-size="8" font-weight="600" fill="#F7FAFB" text-anchor="middle" letter-spacing="1.5">DISPOSITIF</text><text x="68" y="70" font-family="Inter, sans-serif" font-size="11" font-weight="800" fill="#F7FAFB" text-anchor="middle" letter-spacing="1">MEDICAL</text>') },
    'partenaire': { name: 'PARTENAIRE OFFICIEL', svg: svgWrap('<circle cx="60" cy="60" r="54" fill="#1A2230"/><circle cx="60" cy="60" r="48" fill="none" stroke="#F0C77A" stroke-width="1.5"/><path d="M60 18 L62 26 L60 30 L58 26 Z M60 90 L62 94 L60 102 L58 94 Z M18 60 L26 58 L30 60 L26 62 Z M90 60 L94 58 L102 60 L94 62 Z" fill="#F0C77A"/><text x="60" y="55" font-family="Inter, sans-serif" font-size="9" font-weight="600" fill="#F0C77A" text-anchor="middle" letter-spacing="2">PARTENAIRE</text><text x="60" y="72" font-family="Inter, sans-serif" font-size="12" font-weight="800" fill="#F0C77A" text-anchor="middle" letter-spacing="1">OFFICIEL</text><text x="60" y="84" font-family="Inter, sans-serif" font-size="7" font-weight="500" fill="#F0C77A" text-anchor="middle" letter-spacing="3" opacity="0.7">2026</text>') },
    'limited':    { name: 'ÉDITION LIMITÉE', svg: svgWrap('<circle cx="60" cy="60" r="52" fill="#6B2A37"/><circle cx="60" cy="60" r="46" fill="none" stroke="#F0C77A" stroke-width="0.5"/><text x="60" y="52" font-family="Inter, sans-serif" font-size="8" font-weight="600" fill="#F0C77A" text-anchor="middle" letter-spacing="2">EDITION</text><text x="60" y="70" font-family="Inter, sans-serif" font-size="14" font-weight="800" fill="#F0C77A" text-anchor="middle" letter-spacing="1">LIMITEE</text><text x="60" y="82" font-family="Inter, sans-serif" font-size="7" font-weight="500" fill="#F0C77A" text-anchor="middle" letter-spacing="2" opacity="0.75">SERIE 01</text>') },
    'recommande': { name: 'CONSEIL RECOMMANDÉ', svg: svgWrap('<path d="M60 10 L70 25 L88 22 L86 40 L102 48 L88 60 L102 72 L86 80 L88 98 L70 95 L60 110 L50 95 L32 98 L34 80 L18 72 L32 60 L18 48 L34 40 L32 22 L50 25 Z" fill="#D9A857"/><text x="60" y="55" font-family="Inter, sans-serif" font-size="8" font-weight="600" fill="#1A2230" text-anchor="middle" letter-spacing="2">CONSEIL</text><text x="60" y="72" font-family="Inter, sans-serif" font-size="11" font-weight="800" fill="#1A2230" text-anchor="middle" letter-spacing="1">RECOMMANDE</text>') },
    'rupture':    { name: 'EN RUPTURE',      svg: svgWrap('<path d="M5 40 L100 40 L115 60 L100 80 L5 80 Z" fill="#2A0F17"/><circle cx="22" cy="60" r="5" fill="#F0C77A"/><circle cx="22" cy="60" r="2" fill="#2A0F17"/><text x="65" y="58" font-family="Inter, sans-serif" font-size="8" font-weight="600" fill="#F0C77A" text-anchor="middle" letter-spacing="2">EN</text><text x="65" y="72" font-family="Inter, sans-serif" font-size="14" font-weight="800" fill="#F0C77A" text-anchor="middle" letter-spacing="1">RUPTURE</text>') },
    'stock':      { name: 'EN STOCK',        svg: svgWrap('<rect x="10" y="48" width="100" height="24" rx="12" fill="#4A6248"/><circle cx="25" cy="60" r="4" fill="#F0F4ED"/><circle cx="25" cy="60" r="2" fill="#4A6248"/><text x="70" y="65" font-family="Inter, sans-serif" font-size="11" font-weight="800" fill="#F0F4ED" text-anchor="middle" letter-spacing="2">EN STOCK</text>') },
    'cure':       { name: 'CURE COMPLÈTE',   svg: svgWrap('<path d="M30 50 Q20 50 20 40 Q20 30 30 30 Q30 20 45 20 Q55 15 65 20 Q75 15 85 25 Q100 25 100 40 Q105 50 95 55 Q100 65 90 70 Q85 80 70 78 Q60 85 50 78 Q35 80 30 70 Q15 65 20 55 Q15 50 30 50 Z" fill="#F0CBB0"/><text x="60" y="48" font-family="Inter, sans-serif" font-size="10" font-weight="800" fill="#5D1B1F" text-anchor="middle" letter-spacing="1">CURE</text><text x="60" y="62" font-family="Inter, sans-serif" font-size="8" font-weight="600" fill="#5D1B1F" text-anchor="middle" letter-spacing="1">COMPLETE</text><text x="60" y="75" font-family="Inter, sans-serif" font-size="8" font-weight="800" fill="#5D1B1F" text-anchor="middle" letter-spacing="1">3 MOIS</text>') },
    'formation':  { name: 'FORMATION INCLUSE', svg: svgWrap('<path d="M5 40 L100 40 L115 60 L100 80 L5 80 Z" fill="#4A7894"/><path d="M18 55 L18 70 L28 70 L28 55 M16 55 L30 55 L23 50 Z" fill="#F7FAFB"/><text x="68" y="58" font-family="Inter, sans-serif" font-size="8" font-weight="600" fill="#F7FAFB" text-anchor="middle" letter-spacing="1.5">FORMATION</text><text x="68" y="70" font-family="Inter, sans-serif" font-size="10" font-weight="800" fill="#F7FAFB" text-anchor="middle" letter-spacing="1">INCLUSE</text>') },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 5. PATTERNS OVERLAY — 12 textures
  // ═══════════════════════════════════════════════════════════════════════
  function patternUrl(svg) { return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")'; }
  var PATTERNS = {
    'none':              { name: 'Aucun',           css: '' },
    'noise-paper':       { name: 'Grain Papier',    css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 0.2 0 0 0 0 0.15 0 0 0 0 0.1 0 0 0 0.04 0"/></filter><rect width="80" height="80" filter="url(#n)"/></svg>') },
    'dots-grid':         { name: 'Points Officine', css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="1" fill="#1A2230" fill-opacity="0.12"/></svg>') },
    'lines-horizontal':  { name: 'Lignes Posologie',css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="8"><line x1="0" y1="4" x2="40" y2="4" stroke="#1A2230" stroke-opacity="0.06" stroke-width="0.5"/></svg>') },
    'waves-soft':        { name: 'Vagues Apaisantes',css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><path d="M0 20 Q20 10 40 20 T80 20" fill="none" stroke="#6B8268" stroke-opacity="0.15" stroke-width="1"/><path d="M0 30 Q20 20 40 30 T80 30" fill="none" stroke="#6B8268" stroke-opacity="0.1" stroke-width="1"/></svg>') },
    'cross-apothecary':  { name: 'Croix Apothicaire',css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><g fill="#5D1B1F" fill-opacity="0.08"><rect x="18" y="10" width="4" height="20"/><rect x="10" y="18" width="20" height="4"/></g></svg>') },
    'organic-blob':      { name: 'Blobs Organiques', css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><path d="M40 30 Q60 20 75 35 Q85 55 70 70 Q50 80 35 65 Q25 45 40 30 Z" fill="#F0C77A" fill-opacity="0.12"/><path d="M85 80 Q100 75 105 90 Q105 105 90 105 Q75 100 80 88 Z" fill="#6B8268" fill-opacity="0.1"/></svg>') },
    'hexagon-mesh':      { name: 'Maille Hexagonale',css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="56" height="48"><g fill="none" stroke="#4A7894" stroke-opacity="0.12" stroke-width="0.6"><polygon points="14,4 28,4 35,16 28,28 14,28 7,16"/><polygon points="42,28 56,28 56,40 42,40 35,28"/></g></svg>') },
    'prescription-rx':   { name: 'Rx Calligraphique',css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><text x="10" y="40" font-family="Georgia, serif" font-size="28" font-style="italic" fill="#5D1B1F" fill-opacity="0.06">Rx</text><text x="45" y="65" font-family="Georgia, serif" font-size="20" font-style="italic" fill="#5D1B1F" fill-opacity="0.05">℞</text></svg>') },
    'confetti-soft':     { name: 'Confettis Doux',   css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect x="10" y="15" width="4" height="12" fill="#D9A857" fill-opacity="0.3" transform="rotate(20 12 21)"/><rect x="50" y="30" width="3" height="10" fill="#C9484E" fill-opacity="0.25" transform="rotate(-30 51 35)"/><rect x="25" y="55" width="3" height="8" fill="#6B8268" fill-opacity="0.3" transform="rotate(45 26 59)"/><rect x="65" y="65" width="4" height="10" fill="#4A7894" fill-opacity="0.25" transform="rotate(-15 67 70)"/></svg>') },
    'botanical-line':    { name: 'Botanique Filaire',css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><g fill="none" stroke="#4A6248" stroke-opacity="0.18" stroke-width="0.8"><path d="M10 40 Q40 35 70 40 Q90 42 110 38"/><ellipse cx="25" cy="36" rx="5" ry="2" transform="rotate(-20 25 36)"/><ellipse cx="45" cy="44" rx="5" ry="2" transform="rotate(20 45 44)"/><ellipse cx="65" cy="35" rx="5" ry="2" transform="rotate(-15 65 35)"/><ellipse cx="85" cy="44" rx="5" ry="2" transform="rotate(25 85 44)"/></g></svg>') },
    'checkered-fine':    { name: 'Damier Fin',       css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect x="0" y="0" width="10" height="10" fill="#1A2230" fill-opacity="0.03"/><rect x="10" y="10" width="10" height="10" fill="#1A2230" fill-opacity="0.03"/></svg>') },
    'pills-capsules':    { name: 'Gélules Stylisées',css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><g fill="#D9A857" fill-opacity="0.18"><rect x="15" y="20" width="20" height="8" rx="4" transform="rotate(30 25 24)"/><rect x="60" y="40" width="20" height="8" rx="4" transform="rotate(-20 70 44)"/><rect x="25" y="70" width="20" height="8" rx="4" transform="rotate(-45 35 74)"/></g><g fill="#C9484E" fill-opacity="0.15"><rect x="65" y="75" width="18" height="7" rx="3.5" transform="rotate(15 74 78)"/></g></svg>') },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // 6. DESIGN PRESETS — 12 combos cohérents prêts à l'emploi
  // ═══════════════════════════════════════════════════════════════════════
  // Chaque preset = palette + typo + gradient + pattern + sticker + template
  // Cohérence vérifiée par le directeur marketing (mapping A/B/C aligné).
  var DESIGN_PRESETS = {
    'classique':           { name: 'Classique IP',         color: 'ip-signature-azure',    fontPair: 'default',              gradient: 'none',               pattern: 'none',             sticker: 'none',         template: 'offre',  rationale: 'Le DM Sans système Intégral Pharma avec signature azure IP — fiable, sobre, polyvalent.' },
    'aesop-officine':      { name: 'Aesop Officine',       color: 'ivoire-vellum',         fontPair: 'cormorant-dm-sans',    gradient: 'linen-mist',         pattern: 'noise-paper',      sticker: 'bio',          template: 'focus',  rationale: 'Apothicaire premium pour Focus produit phyto/dermo BIO. Beige + serif italique + grain papier = artisanat.' },
    'laroche-clinique':    { name: 'La Roche Clinique',    color: 'glacial-white',         fontPair: 'bricolage-public-sans',gradient: 'morning-officine',   pattern: 'dots-grid',        sticker: 'dermo',        template: 'memo',   rationale: 'Mémo référentiel dermo-cosmétique. Bleu glacial + grotesque civic = clinique sans froideur.' },
    'headspace-soin':      { name: 'Headspace Soin',       color: 'coral-warmth',          fontPair: 'manrope-mono',         gradient: 'porcelain-rose',     pattern: 'organic-blob',     sticker: 'recommande',   template: 'focus',  rationale: 'Focus maternité/pédiatrie/anti-âge. Corail + grotesque ronde + blobs = chaleur tactile.' },
    'eight-sleep-pharma':  { name: 'Eight Sleep Sommeil',  color: 'aura-indigo-tech',      fontPair: 'bricolage-public-sans',gradient: 'aurora-night',       pattern: 'hexagon-mesh',     sticker: 'innovation',   template: 'bento',  rationale: 'Bento sommeil/mélatonine/neuro. Aurore nuit + maille moléculaire + INNOVATION = tech-premium.' },
    'buly-apothicaire':    { name: 'Buly Apothicaire',     color: 'champagne-mineral',     fontPair: 'newsreader-dm-sans',   gradient: 'aurora-cream',       pattern: 'cross-apothecary', sticker: 'limited',      template: 'focus',  rationale: 'Focus série limitée / coffrets fêtes. Champagne minéral + Newsreader + croix subtile = objet collection.' },
    'bento-promo':         { name: 'Bento Promo Vibrant',  color: 'mocha-mousse-2025',     fontPair: 'bricolage-public-sans',gradient: 'terracotta-glow',    pattern: 'confetti-soft',    sticker: 'promo-30',     template: 'bento',  rationale: 'Bento campagne promo multi-produits. Terracotta + confettis + -30% = peps sans criard.' },
    'labo-biosimilaire':   { name: 'Labo Biosimilaire',    color: 'ocean-deep',            fontPair: 'space-ibm-plex',       gradient: 'ocean-laboratoire',  pattern: 'hexagon-mesh',     sticker: 'biosimilaire', template: 'memo',   rationale: 'Mémo biosimilaires/hospitalier. Bleu labo + Space Grotesk + maille moléculaire = crédibilité scientifique.' },
    'exclu-ip-premium':    { name: 'Exclu IP Prestige',    color: 'ip-graphite-prestige',  fontPair: 'fraunces-inter',       gradient: 'midnight-officine',  pattern: 'checkered-fine',   sticker: 'exclu-ip',     template: 'bento',  rationale: 'Bento offre exclusive IP. Graphite + Fraunces + sceau EXCLU IP = concierge premium grand compte.' },
    'editorial-fraunces':  { name: 'Éditorial Magazine',   color: 'mocha-mousse-2025',     fontPair: 'fraunces-inter',       gradient: 'aurora-cream',       pattern: 'botanical-line',   sticker: 'recommande',   template: 'focus',  rationale: 'Focus magazine Fraunces hero. Mocha + branche olivier + CONSEIL = Aesop x Vogue pharma.' },
    'cherry-noel':         { name: 'Cherry Édition Noël',  color: 'ip-cherry-edition',     fontPair: 'instrument-jakarta',   gradient: 'cherry-lacquer',     pattern: 'confetti-soft',    sticker: 'limited',      template: 'bento',  rationale: 'Bento fêtes fin d’année. Cherry IP + Instrument Serif + confettis = festif premium IP.' },
    'tech-innovation':     { name: 'Tech Innovation 2026', color: 'aura-indigo-tech',      fontPair: 'geist-mono',           gradient: 'iridescent-innovation', pattern: 'hexagon-mesh',  sticker: 'innovation',   template: 'bento',  rationale: 'Bento lancement breakthrough. Indigo + Geist + iridescent + INNOVATION = R&D pharma tech.' },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // EXPORTS
  // ═══════════════════════════════════════════════════════════════════════
  window.COLOR_PRESETS_NEW = COLOR_PRESETS;  // alias pour migration douce
  window.MK_COLOR_PRESETS = COLOR_PRESETS;
  window.MK_FONT_PAIRS = FONT_PAIRS;
  window.MK_GRADIENTS = GRADIENTS;
  window.MK_STICKERS = STICKERS;
  window.MK_PATTERNS = PATTERNS;
  window.MK_DESIGN_PRESETS = DESIGN_PRESETS;
  window.mkLoadFontPair = mkLoadFontPair;
})();
