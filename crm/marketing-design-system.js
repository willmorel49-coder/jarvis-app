// marketing-design-system.js — Design system pro pour fiches marketing IP
// Inspire des tendances Pinterest 2026-2027 : Editorial, Bento, Brutalist,
// Glass morphism, Gradient mesh, Typography pairings, Stickers, Patterns.
//
// Expose :
//   window.MK_GRADIENTS   — 14 gradient meshes premium
//   window.MK_STICKERS    — 12 stickers/badges SVG inline
//   window.MK_PATTERNS    — 6 patterns SVG en background
//   window.MK_FONT_PAIRS  — 6 typo pairings via Google Fonts (lazy)
//   window.MK_DESIGN_PRESETS — combos preset complets (gradient + font + pattern)
//   window.mkLoadFontPair(id) — charge Google Fonts pour le pair selectionne

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // GRADIENT MESHES — backgrounds organiques 2026 (Pinterest, Apple, Linear)
  // Chaque gradient = CSS background-image multi-radial pour effet "mesh".
  // ─────────────────────────────────────────────────────────────────────────
  var GRADIENTS = {
    none: {
      name: 'Aucun',
      css: '',
      preview: '#F2F2F7',
    },
    aurora: {
      name: 'Aurora',
      css: 'radial-gradient(circle at 20% 20%, #FFB5D8 0%, transparent 45%), radial-gradient(circle at 80% 0%, #A8C7FA 0%, transparent 50%), radial-gradient(circle at 0% 80%, #B5EAEA 0%, transparent 60%), linear-gradient(135deg, #F5F0FF 0%, #FFF5F8 100%)',
      preview: 'linear-gradient(135deg, #FFB5D8, #A8C7FA, #B5EAEA)',
    },
    sunset: {
      name: 'Sunset',
      css: 'radial-gradient(ellipse at 30% 0%, #FFD6A0 0%, transparent 50%), radial-gradient(ellipse at 90% 30%, #FFB088 0%, transparent 55%), radial-gradient(ellipse at 10% 90%, #FF8E9B 0%, transparent 60%), linear-gradient(180deg, #FFF4E6 0%, #FFEDE0 100%)',
      preview: 'linear-gradient(135deg, #FFD6A0, #FF8E9B)',
    },
    ocean: {
      name: 'Ocean Deep',
      css: 'radial-gradient(circle at 20% 30%, #4A90E2 0%, transparent 50%), radial-gradient(circle at 80% 80%, #50E3C2 0%, transparent 50%), linear-gradient(135deg, #0A2540 0%, #1B3A5C 100%)',
      preview: 'linear-gradient(135deg, #0A2540, #50E3C2)',
    },
    mint: {
      name: 'Mint Fresh',
      css: 'radial-gradient(circle at 30% 20%, #B5EAEA 0%, transparent 50%), radial-gradient(circle at 80% 70%, #D4E6B5 0%, transparent 50%), linear-gradient(135deg, #F0F9F4 0%, #EAFAF1 100%)',
      preview: 'linear-gradient(135deg, #B5EAEA, #D4E6B5)',
    },
    cosmic: {
      name: 'Cosmic',
      css: 'radial-gradient(circle at 15% 15%, #6B46C1 0%, transparent 40%), radial-gradient(circle at 85% 75%, #EC4899 0%, transparent 45%), radial-gradient(circle at 50% 50%, #3B82F6 0%, transparent 35%), linear-gradient(135deg, #1E1B4B 0%, #581C87 100%)',
      preview: 'linear-gradient(135deg, #6B46C1, #EC4899)',
    },
    peach: {
      name: 'Peach Cream',
      css: 'radial-gradient(circle at 30% 30%, #FFD4B8 0%, transparent 50%), radial-gradient(circle at 80% 80%, #FFE5C2 0%, transparent 50%), linear-gradient(135deg, #FFF5EC 0%, #FFEEDA 100%)',
      preview: 'linear-gradient(135deg, #FFD4B8, #FFE5C2)',
    },
    arctic: {
      name: 'Arctic',
      css: 'radial-gradient(circle at 25% 25%, #DBEAFE 0%, transparent 50%), radial-gradient(circle at 75% 75%, #E0E7FF 0%, transparent 50%), linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%)',
      preview: 'linear-gradient(135deg, #DBEAFE, #E0E7FF)',
    },
    rose: {
      name: 'Rose Quartz',
      css: 'radial-gradient(circle at 30% 20%, #FBCFE8 0%, transparent 50%), radial-gradient(circle at 80% 70%, #FECACA 0%, transparent 50%), linear-gradient(135deg, #FDF2F8 0%, #FEF2F2 100%)',
      preview: 'linear-gradient(135deg, #FBCFE8, #FECACA)',
    },
    forest: {
      name: 'Forest Mist',
      css: 'radial-gradient(circle at 25% 30%, #86EFAC 0%, transparent 50%), radial-gradient(circle at 75% 80%, #6EE7B7 0%, transparent 50%), linear-gradient(135deg, #064E3B 0%, #065F46 100%)',
      preview: 'linear-gradient(135deg, #064E3B, #6EE7B7)',
    },
    canary: {
      name: 'Canary',
      css: 'radial-gradient(circle at 20% 20%, #FEF08A 0%, transparent 50%), radial-gradient(circle at 80% 80%, #FACC15 0%, transparent 50%), linear-gradient(135deg, #FEFCE8 0%, #FEF9C3 100%)',
      preview: 'linear-gradient(135deg, #FEF08A, #FACC15)',
    },
    midnight: {
      name: 'Midnight',
      css: 'radial-gradient(circle at 20% 20%, #1E40AF 0%, transparent 45%), radial-gradient(circle at 80% 80%, #6366F1 0%, transparent 45%), linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)',
      preview: 'linear-gradient(135deg, #0F172A, #6366F1)',
    },
    holographic: {
      name: 'Holographic',
      css: 'conic-gradient(from 230deg at 50% 50%, #FFB5D8 0deg, #C4B5FD 60deg, #A8C7FA 120deg, #B5EAEA 180deg, #D4E6B5 240deg, #FFE5C2 300deg, #FFB5D8 360deg)',
      preview: 'conic-gradient(from 230deg, #FFB5D8, #C4B5FD, #A8C7FA, #B5EAEA, #D4E6B5, #FFE5C2)',
    },
    noir: {
      name: 'Noir Gold',
      css: 'radial-gradient(circle at 30% 20%, #C9A961 0%, transparent 40%), linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)',
      preview: 'linear-gradient(135deg, #1A1A1A, #C9A961)',
    },
  };
  window.MK_GRADIENTS = GRADIENTS;

  // ─────────────────────────────────────────────────────────────────────────
  // STICKERS / BADGES — SVG inline, rotation aleatoire pour effet "colle"
  // ─────────────────────────────────────────────────────────────────────────
  function stickerSvg(text, bg, fg, shape) {
    var w = 110, h = 110;
    var bgEl = shape === 'star'
      ? '<polygon points="55,5 67,40 105,40 75,62 87,98 55,75 23,98 35,62 5,40 43,40" fill="' + bg + '"/>'
      : shape === 'burst'
      ? '<polygon points="55,3 60,20 75,8 70,28 90,18 80,38 100,38 84,52 100,68 80,68 90,88 70,78 75,98 60,86 55,103 50,86 35,98 40,78 20,88 30,68 10,68 26,52 10,38 30,38 20,18 40,28 35,8 50,20" fill="' + bg + '"/>'
      : shape === 'pill'
      ? '<rect x="5" y="35" width="100" height="40" rx="20" fill="' + bg + '"/>'
      : '<circle cx="55" cy="55" r="50" fill="' + bg + '"/>';
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;overflow:visible">'
      + bgEl
      + '<text x="55" y="60" text-anchor="middle" fill="' + fg + '" font-family="ui-sans-serif,system-ui,sans-serif" font-weight="900" font-size="' + (text.length > 6 ? 14 : 18) + '" letter-spacing="0.5">' + text + '</text>'
      + '</svg>';
  }
  var STICKERS = {
    none:       { name: 'Aucun',           svg: '' },
    new:        { name: 'NEW',             svg: stickerSvg('NEW',          '#0057FF', '#FFFFFF', 'circle') },
    exclu:      { name: 'EXCLU IP',        svg: stickerSvg('EXCLU IP',     '#FF3B30', '#FFFFFF', 'burst') },
    promo:      { name: 'PROMO',           svg: stickerSvg('PROMO',        '#FF9500', '#FFFFFF', 'star') },
    bestseller: { name: 'BEST SELLER',     svg: stickerSvg('TOP',          '#FFC500', '#0B1F4D', 'burst') },
    bio:        { name: 'BIO',             svg: stickerSvg('BIO',          '#34C759', '#FFFFFF', 'circle') },
    nouveau:    { name: 'NOUVEAU',         svg: stickerSvg('NOUVEAU',      '#7C3AED', '#FFFFFF', 'pill') },
    tendance:   { name: 'TENDANCE',        svg: stickerSvg('TENDANCE',     '#EC4899', '#FFFFFF', 'pill') },
    offre:      { name: 'OFFRE 2026',      svg: stickerSvg('2026',         '#0B1F4D', '#C9A961', 'star') },
    must:       { name: 'MUST HAVE',       svg: stickerSvg('MUST',         '#0F766E', '#FFFFFF', 'circle') },
    saison:     { name: 'SAISONNIER',      svg: stickerSvg('SAISON',       '#D97706', '#FFFFFF', 'burst') },
    medical:    { name: 'MÉDICAL',         svg: stickerSvg('MED',          '#DC2626', '#FFFFFF', 'circle') },
  };
  window.MK_STICKERS = STICKERS;

  // ─────────────────────────────────────────────────────────────────────────
  // PATTERNS SVG — overlays subtils en background pour texture
  // ─────────────────────────────────────────────────────────────────────────
  function patternUrl(svg) {
    return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
  }
  var PATTERNS = {
    none: { name: 'Aucun', css: '' },
    dots: {
      name: 'Dots',
      css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="2" cy="2" r="1.2" fill="rgba(11,31,77,0.10)"/></svg>'),
    },
    grid: {
      name: 'Grid',
      css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path d="M0 0L40 0M0 0L0 40" stroke="rgba(11,31,77,0.06)" stroke-width="1"/></svg>'),
    },
    lines: {
      name: 'Lines',
      css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30"><path d="M0 30L30 0" stroke="rgba(11,31,77,0.08)" stroke-width="1"/></svg>'),
    },
    waves: {
      name: 'Waves',
      css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><path d="M0 20Q20 0 40 20T80 20" stroke="rgba(11,31,77,0.10)" stroke-width="1.5" fill="none"/></svg>'),
    },
    noise: {
      name: 'Noise',
      css: patternUrl('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.04 0 0 0 0 0.12 0 0 0 0 0.30 0 0 0 0.15 0"/></filter><rect width="200" height="200" filter="url(#n)"/></svg>'),
    },
  };
  window.MK_PATTERNS = PATTERNS;

  // ─────────────────────────────────────────────────────────────────────────
  // TYPOGRAPHY PAIRINGS — combinaisons heading + body (Google Fonts)
  // ─────────────────────────────────────────────────────────────────────────
  var FONT_PAIRS = {
    default: {
      name: 'DM Sans (par défaut)',
      heading: { family: 'DM Sans', weight: 800 },
      body:    { family: 'DM Sans', weight: 500 },
      googleFamilies: [],
    },
    editorial: {
      name: 'Editorial · Playfair + Inter',
      heading: { family: 'Playfair Display', weight: 800, italic: false },
      body:    { family: 'Inter',             weight: 500 },
      googleFamilies: ['Playfair+Display:wght@700;800;900', 'Inter:wght@400;500;600;700'],
    },
    techno: {
      name: 'Techno · Space Grotesk + Mono',
      heading: { family: 'Space Grotesk', weight: 700 },
      body:    { family: 'JetBrains Mono', weight: 400 },
      googleFamilies: ['Space+Grotesk:wght@500;700', 'JetBrains+Mono:wght@400;500'],
    },
    luxe: {
      name: 'Luxe · Cormorant + Lato',
      heading: { family: 'Cormorant Garamond', weight: 700, italic: true },
      body:    { family: 'Lato',                weight: 400 },
      googleFamilies: ['Cormorant+Garamond:ital,wght@0,500;0,700;1,700', 'Lato:wght@400;700'],
    },
    bold: {
      name: 'Bold · Bricolage Grotesque',
      heading: { family: 'Bricolage Grotesque', weight: 800 },
      body:    { family: 'Inter',                weight: 400 },
      googleFamilies: ['Bricolage+Grotesque:wght@600;700;800', 'Inter:wght@400;500;600'],
    },
    serif: {
      name: 'Magazine · Fraunces + DM Sans',
      heading: { family: 'Fraunces', weight: 900 },
      body:    { family: 'DM Sans',  weight: 400 },
      googleFamilies: ['Fraunces:opsz,wght@9..144,700;9..144,900'],
    },
  };
  window.MK_FONT_PAIRS = FONT_PAIRS;

  // Lazy load Google Fonts pour un pair donne (idempotent)
  var loadedFontIds = {};
  window.mkLoadFontPair = function (pairId) {
    var pair = FONT_PAIRS[pairId];
    if (!pair || loadedFontIds[pairId]) return;
    if (!pair.googleFamilies || !pair.googleFamilies.length) {
      loadedFontIds[pairId] = true;
      return;
    }
    var href = 'https://fonts.googleapis.com/css2?'
      + pair.googleFamilies.map(function (f) { return 'family=' + f; }).join('&')
      + '&display=swap';
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    loadedFontIds[pairId] = true;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DESIGN PRESETS — combos pretes a l'emploi (gradient + fonts + pattern)
  // ─────────────────────────────────────────────────────────────────────────
  var DESIGN_PRESETS = {
    classic:    { name: 'Classique',      gradient: 'none',       fontPair: 'default',    pattern: 'none',  template: 'offre' },
    vogue:      { name: 'Vogue',          gradient: 'rose',       fontPair: 'editorial',  pattern: 'none',  template: 'editorial' },
    apple:      { name: 'Apple Bento',    gradient: 'arctic',     fontPair: 'default',    pattern: 'none',  template: 'bento' },
    luxe:       { name: 'Luxury',         gradient: 'noir',       fontPair: 'luxe',       pattern: 'noise', template: 'editorial' },
    sunset:     { name: 'Sunset Glow',    gradient: 'sunset',     fontPair: 'editorial',  pattern: 'none',  template: 'editorial' },
    tech:       { name: 'Tech 2026',      gradient: 'cosmic',     fontPair: 'techno',     pattern: 'grid',  template: 'bento' },
    holographic:{ name: 'Holographique',  gradient: 'holographic',fontPair: 'bold',       pattern: 'none',  template: 'editorial' },
    forest:     { name: 'Eco Forest',     gradient: 'forest',     fontPair: 'serif',      pattern: 'dots',  template: 'editorial' },
    pastel:     { name: 'Pastel Soft',    gradient: 'peach',      fontPair: 'editorial',  pattern: 'dots',  template: 'bento' },
    midnight:   { name: 'Midnight Pro',   gradient: 'midnight',   fontPair: 'bold',       pattern: 'grid',  template: 'editorial' },
  };
  window.MK_DESIGN_PRESETS = DESIGN_PRESETS;
})();
