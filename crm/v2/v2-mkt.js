/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Pilier "Marketing" (pages.marketing) — app JARVIS / Intégral
   Espace de travail Pauline + Will : fabriquer des SUPPORTS (flyers
   produits avec photos/prix/accroche) et des SÉLECTIONS À POUSSER
   (listes de produits du moment) — PARTAGÉ via Supabase (table
   marketing_items) avec repli localStorage si la table n'existe pas.
   Produits = meilleures ventes Offilog (photos). Aperçu + PDF.
   (NB : distinct du pilier OPSO v2-marketing.js, chargé seulement en opso/v2/)
   ── Satoshi · mode clair · zéro emoji (ICO) ──
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  var LS = 'v2_marketing';
  var TYPES = {
    support:   { label: 'Support', plural: 'Supports', accent: '#E0556E', sub: 'flyer produits à présenter' },
    selection: { label: 'Sélection', plural: 'Sélections à pousser', accent: '#1E9E6A', sub: 'liste de produits du moment' }
  };
  var STATUSES = [
    { k: 'brouillon', label: 'Brouillon', color: '#9AA1B2' },
    { k: 'a_envoyer', label: 'À envoyer', color: '#C7791A' },
    { k: 'envoye',    label: 'Envoyé',    color: '#1E9E6A' }
  ];
  function statusOf(k) { for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].k === k) return STATUSES[i]; return STATUSES[0]; }

  // ── Charte / personnalisation ──
  var ACCENTS = ['#0050E6', '#0034A0', '#E0556E', '#6D4FC4', '#1E9E6A', '#C7791A', '#00B5D8', '#10131C'];
  var BGS = ['#FFFFFF', '#FFFDF7', '#F2F7FF', '#F4F6FB', '#FBF5F7', '#F3FAF6'];
  function defaultTheme(type) {
    return { accent: type === 'selection' ? '#1E9E6A' : '#0050E6', bg: '#FFFFFF', showPrice: true, showRemise: true, showImg: true };
  }
  // ── Modèles (étape 1 de l'assistant guidé). La mise en page est fixée par le modèle :
  // dans l'aperçu, seules les zones prévues (titre, accroche, photo, nom, prix, mentions)
  // se modifient, jamais leur place. La clé vit dans theme.tpl (colonne theme existante).
  var MODELES = [
    { k: 'promo',     label: 'Promo de la semaine',  accent: '#0050E6', head: 'band',  desc: 'Bandeau de couleur, grand titre' },
    { k: 'nouveaute', label: 'Nouveauté',            accent: '#1E9E6A', head: 'band',  tag: 'Nouveau', desc: 'Bandeau et pastille « Nouveau »' },
    { k: 'selection', label: 'Sélection du mois',    accent: '#C7791A', head: 'slim',  desc: 'Filet de couleur, titre sombre' },
    { k: 'fiche',     label: 'Fiche produit simple', accent: '#6D4FC4', head: 'plain', desc: 'Sans bandeau, sobre' }
  ];
  function modele(it) {
    var k = it && it.theme && it.theme.tpl;
    for (var i = 0; i < MODELES.length; i++) if (MODELES[i].k === k) return MODELES[i];
    return MODELES[0];
  }
  // Attributs d'une zone modifiable de l'aperçu (rien en PDF ni dans l'aperçu plein écran)
  function zoneAttrs(edit, key, label, o) {
    o = o || {};
    if (!edit) return '';
    return ' data-zone="' + key + '"' + (o.i != null ? ' data-i="' + o.i + '"' : '') + ' data-label="' + esc(label) + '"' +
      (o.ph ? ' data-ph="' + esc(o.ph) + '"' : '') +
      ' class="mkt-zone' + (o.light ? ' mkt-zone-light' : '') + (o.click ? ' mkt-zone-photo' : '') + (o.quiet ? ' mkt-zone-quiet' : '') + '"' +
      (o.click ? ' tabindex="0"' : ' contenteditable="true" spellcheck="false"');
  }
  function darken(hex, f) {
    hex = String(hex || '#0050E6').replace('#', '');
    if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
    var n = parseInt(hex, 16); if (isNaN(n)) return '#0034A0';
    var r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  var items = null;          // null = pas encore chargé
  var backend = 'local';     // 'supabase' | 'local'
  var liKicked = false;      // posts LinkedIn chargés une seule fois (badge « à publier »)
  var editing = null;
  var replaceIdx = null;     // index du produit à remplacer quand le sélecteur s'ouvre depuis une photo de l'aperçu
  var pickSrc = 'cat';       // univers : 'cat' (tout le catalogue) | 'offilog' (parapharmacie) | 'mix' (nos sélections) — 'gros' reste accepté par addProduct pour les fiches existantes
  // Nombre de références annoncé AVANT que le fichier n'arrive (il pèse 1,5 Mo
  // et ne se charge qu'à la demande). Dès qu'il est là, c'est lui qui compte.
  var CAT_TOTAL_ATTENDU = 16305;
  var PICK_PAGE = 60;        // résultats par page du sélecteur
  var pickShown = PICK_PAGE; // nb de résultats affichés (« Voir 60 de plus »)
  var pickSel = {};          // produits cochés dans le sélecteur : clé → { src, key }
  var pickF = pickFiltresVides();   // facettes de l'univers courant, vidées au changement d'univers
  var pickCatCache = null;   // catalogue complet pré-trié + chaîne de recherche sans accents, construit une fois
  var pickOffCache = null;   // parapharmacie : rayon Offilog + chaîne de recherche, construit une fois
  var pickOpenOnRender = false;   // « Parcourir tous les produits » : ouvrir le sélecteur dès que l'éditeur est rendu
  var pickTimer = null;
  var pickSelFor = null;     // id de la fiche pour laquelle les coches ont été posées (fermer le sélecteur ne les perd pas)
  function pickFiltresVides() { return { rayon: 'all', fam: 'all', labo: '', stock: false, orayon: 'all', marque: '' }; }
  var catSrc = 'nrreal';   // Catalogues : 'nrreal' (ventes NR réelles) | 'nr' | 'integral' | 'itp' | 'best'
  var catQuery = '';        // recherche live dans le catalogue (nom / CIP)
  var catSel = [];     // panier : produits cochés (+) dans le catalogue grossiste
  var catRows = [];     // index plat des lignes affichées (pour les boutons +)
  // ── Documents PDF partagés (Supabase Storage, visibles par TOUS les comptes) ──
  var BUCKET = 'marketing-pdfs';
  var docs = null;       // null = pas chargé · [] = chargé
  var docsErr = null;    // message d'erreur (ex : bucket pas encore créé)
  var docsBusy = false;  // upload en cours
  // ── Prix + stock par établissement (fiches marketing par établissement) ──
  var mktEtab = '';         // '' = tous établissements · sinon code (CPR, HP, MSP, OPS, POS, SEP, SOP)
  var etabStockOnly = false;
  var catSortBy = 'pharma';   // 'pharma' = nb de pharmacies qui commandent · 'vol' = volume vendu
  var catPerCat = 5;          // nb de produits par catégorie affichés sur le document (0 = tous)

  // ════════════════════════════════════════════
  // STORE (Supabase partagé + repli local)
  // ════════════════════════════════════════════
  function sb() { return (V2.sb && V2.sb()) || null; }
  function localAll() { try { var a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function localWrite(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }
  function fromRow(r) {
    return { id: r.id, type: r.type || 'support', title: r.title || '', accroche: r.accroche || '', footer: r.footer || '',
             status: r.status || 'brouillon', products: r.products || [], theme: r.theme || null, owner: r.owner || '',
             updated: r.updated_at ? new Date(r.updated_at).getTime() : Date.now() };
  }
  function toRow(it) {
    return { id: it.id, type: it.type, title: it.title, accroche: it.accroche, footer: it.footer || '', status: it.status,
             products: it.products, theme: it.theme || null, owner: it.owner || (V2.user && V2.user.email) || '', updated_at: new Date().toISOString() };
  }
  // Rattrapage : jusqu'au 03/08/2026 la table `marketing_items` n'existait pas en base.
  // Tout ce que l'équipe créait tombait en repli local et n'était jamais partagé.
  // On remonte une fois ce qui manque au serveur, puis on vide le repli.
  function remonterRepliLocal(surServeur) {
    var c = sb(); if (!c) return Promise.resolve();
    var locaux = localAll(); if (!locaux.length) return Promise.resolve();
    var connus = {}; (surServeur || []).forEach(function (x) { connus[String(x.id)] = 1; });
    var manquants = locaux.filter(function (x) { return x && x.id && !connus[String(x.id)]; });
    if (!manquants.length) { localWrite([]); return Promise.resolve(); }
    return c.from('marketing_items').upsert(manquants.map(toRow)).then(function (r) {
      if (r.error) return;               // on garde le repli, rien n'est perdu
      localWrite([]);
      if (V2.toast) V2.toast(manquants.length + ' élément(s) marketing de cet ordinateur partagé(s) avec l\'équipe');
    }).catch(function () {});
  }

  function loadItems() {
    var c = sb();
    if (c) {
      return c.from('marketing_items').select('*').order('updated_at', { ascending: false })
        .then(function (r) {
          if (!r.error && r.data) {
            backend = 'supabase'; items = r.data.map(fromRow);
            remonterRepliLocal(items);
            return items;
          }
          backend = 'local'; items = localAll(); return items;
        }).catch(function () { backend = 'local'; items = localAll(); return items; });
    }
    backend = 'local'; items = localAll();
    return Promise.resolve(items);
  }
  function saveLocal(it) {
    var a = localAll(), i = -1;
    for (var k = 0; k < a.length; k++) if (a[k].id === it.id) { i = k; break; }
    if (i >= 0) a[i] = it; else a.unshift(it);
    localWrite(a); items = a;
  }
  function saveItem(it) {
    it.updated = Date.now();
    if (!it.owner) it.owner = (V2.user && V2.user.email) || '';
    var c = sb();
    if (backend === 'supabase' && c) {
      // Un repli silencieux fait croire que c'est partagé alors que ça reste sur ce poste.
      var repli = function () {
        saveLocal(it);
        if (V2.toast) V2.toast('Enregistré sur cet ordinateur seulement — pas partagé avec l\'équipe', 'error');
      };
      return c.from('marketing_items').upsert(toRow(it)).then(function (r) {
        if (r.error) { repli(); try { console.warn('[marketing]', r.error.message); } catch (e) {} }
        return loadItems();
      }).catch(function () { repli(); return Promise.resolve(items); });
    }
    saveLocal(it); return Promise.resolve(items);
  }
  function removeItem(id) {
    var c = sb();
    if (backend === 'supabase' && c) {
      return c.from('marketing_items').delete().eq('id', id).then(function () { return loadItems(); })
        .catch(function () { localWrite(localAll().filter(function (x) { return x.id !== id; })); return loadItems(); });
    }
    localWrite(localAll().filter(function (x) { return x.id !== id; }));
    items = localAll(); return Promise.resolve(items);
  }
  function newId() { return 'm' + Date.now() + Math.floor((window.performance && performance.now ? performance.now() : 0) % 1000); }

  // ── Store Documents PDF (Supabase Storage) ──
  function prettyName(n) { var i = String(n || '').indexOf('__'); return i >= 0 ? n.slice(i + 2) : n; }
  function fmtSize(b) { b = +b || 0; if (b < 1024) return b + ' o'; if (b < 1048576) return Math.round(b / 1024) + ' Ko'; return (b / 1048576).toFixed(1) + ' Mo'; }
  function sanitize(n) { return String(n || 'document.pdf').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'document.pdf'; }
  function loadDocs() {
    var c = sb();
    if (!c || !c.storage) { docs = []; docsErr = 'no-sb'; return Promise.resolve(); }
    return c.storage.from(BUCKET).list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
      .then(function (r) {
        if (r.error) { docs = []; docsErr = r.error.message || 'err'; return; }
        docsErr = null;
        docs = (r.data || []).filter(function (f) { return f.name && f.name !== '.emptyFolderPlaceholder'; }).map(function (f) {
          var meta = f.metadata || {};
          return { name: f.name, size: meta.size || 0, created: f.created_at || f.updated_at || null,
                   url: c.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl };
        });
      }).catch(function (e) { docs = []; docsErr = (e && e.message) || 'err'; });
  }

  // ── Store prix/stock par établissement (etab-prices-data.js → window.ETAB_PRICES) ──
  function ensureEtab(cb) {
    if (window.ETAB_PRICES) { cb(); return; }
    var s = document.createElement('script'); s.src = 'etab-prices-data.js?v=20260703d1';
    s.onload = function () { cb(); }; s.onerror = function () { cb(); };
    document.head.appendChild(s);
  }
  // Store ventes NR réelles (mkt-nr-data.js → window.MKT_NR), chargé à la demande
  var nrLoading = false;
  function ensureNr(cb) {
    if (window.MKT_NR) { cb(); return; }
    if (nrLoading) { setTimeout(function () { ensureNr(cb); }, 250); return; }
    nrLoading = true;
    // 03/09/2026 — les ventes NR réelles sont des chiffres réseau : le fichier
    // vit sur Supabase, chargé par adresse signée avec rangement local.
    V2.loadFiles(['mktnr']).then(function () { nrLoading = false; cb(); });
  }
  // SheetJS chargé à la demande (export Excel) — même lib que l'import (v2-audit)
  var xlsxLoading = false;
  function ensureXLSX(cb) {
    if (window.XLSX) { cb(true); return; }
    if (xlsxLoading) { setTimeout(function () { ensureXLSX(cb); }, 250); return; }
    xlsxLoading = true;
    var s = document.createElement('script');
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    s.onload = function () { xlsxLoading = false; cb(!!window.XLSX); };
    s.onerror = function () { xlsxLoading = false; cb(false); };
    document.head.appendChild(s);
  }

  // ══ TOP 50 PAR CATÉGORIE (Princeps + NR, hors génériques) ══
  function t50Bareme(pp) { if (pp <= 4.33) return 0.18; if (pp <= 468) return Math.round(pp * 0.0389 * 100) / 100; return 19.50; }
  // Construit les catégories : 3 familles princeps (PROD_STATS, top 50 par nb de
  // pharmacies qui commandent) + 3 catégories NR (MKT_NR, top 50 par volume vendu).
  function buildTop50() {
    var out = [];
    var PS = window.PROD_STATS || [];
    // Plus de petits prix (100) ; intermédiaire/cher restent à 50.
    [{ f: 'pr_low', cat: 'Princeps · petits prix', color: '#1E9E6A', cap: 100 },
     { f: 'pr_mid', cat: 'Princeps · intermédiaire', color: '#0050E6', cap: 50 },
     { f: 'pr_high', cat: 'Princeps · cher', color: '#C7791A', cap: 50 }].forEach(function (g) {
      var rows = PS.filter(function (r) { return r.f === g.f && r.ppht > 0; });
      rows.sort(function (a, b) { return (b.n || 0) - (a.n || 0) || (b.rota || 0) - (a.rota || 0); });
      rows = rows.slice(0, g.cap).map(function (r) {
        var pp = r.ppht;
        var net = (r.net > 0 && r.net < pp) ? r.net : Math.round((pp - t50Bareme(pp)) * 100) / 100;
        var rem = (pp > 0 && net > 0 && net < pp) ? Math.round((1 - net / pp) * 1000) / 10 : 0;
        return { d: r.d, cip: r.c, ppht: pp, net: net, remise: rem, signal: r.n || 0, kind: 'princeps' };
      });
      if (rows.length) out.push({ cat: g.cat, color: g.color, kind: 'princeps', rows: rows });
    });
    // Partie NR étoffée : 4 catégories, top 100 chacune (prix libre = net seul).
    var NR = window.MKT_NR, want = {
      'Médicaments conseil (OTC non remboursables)': '#E0556E', 'Dispositifs médicaux': '#7C3AED',
      'Parapharmacie': '#00B5D8', 'Autres non remboursables': '#C7791A'
    };
    if (NR && NR.cats) {
      NR.cats.forEach(function (c) {
        if (!want[c.cat]) return;
        var rows = (c.rows || []).slice(0, 100).map(function (r) {
          return { d: r.d, cip: r.cip, ppht: 0, net: r.p || 0, remise: 0, signal: r.vol || 0, kind: 'nr' };
        });
        if (rows.length) out.push({ cat: c.cat, color: want[c.cat], kind: 'nr', rows: rows });
      });
    }
    return out;
  }
  function t50Eur(v) { return (v ? (+v).toFixed(2).replace('.', ',') : '—') + (v ? ' €' : ''); }
  // Belle fiche PDF : sections par catégorie, colonnes PPHT → abandon → prix net.
  function top50Html(cats) {
    var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    var totalProd = cats.reduce(function (s, c) { return s + c.rows.length; }, 0);
    var secs = cats.map(function (c) {
      var isNr = c.kind === 'nr';
      var trs = c.rows.map(function (r, i) {
        var ppht = (r.remise > 0 && r.ppht > 0) ? '<span style="text-decoration:line-through;color:#B6BFCE">' + t50Eur(r.ppht) + '</span>' : '—';
        var rem = r.remise > 0 ? '−' + String(r.remise).replace('.', ',') + ' %' : '—';
        var sig = isNr ? (r.signal > 0 ? r.signal.toLocaleString('fr') : '—') : (r.signal + '<span style="color:#9AA1B2;font-weight:500">/621</span>');
        return '<tr style="border-bottom:1px solid #EEF1F6">' +
          '<td style="padding:3px 7px;color:#9AA1B2;font-size:9px;text-align:right">' + (i + 1) + '</td>' +
          '<td style="padding:3px 7px;font-size:10px;font-weight:600;color:#10131C;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc((r.d || '').slice(0, 44)) + '</td>' +
          '<td style="padding:3px 7px;font-family:monospace;font-size:8.5px;color:#737A8C;overflow:hidden;white-space:nowrap">' + esc(r.cip || '') + '</td>' +
          '<td style="padding:3px 7px;text-align:right;font-family:monospace;font-size:9.5px">' + ppht + '</td>' +
          '<td style="padding:3px 7px;text-align:right;font-family:monospace;font-size:11px;font-weight:800;color:#0050E6">' + t50Eur(r.net) + '</td>' +
          '<td style="padding:3px 7px;text-align:right;font-family:monospace;font-size:9.5px;font-weight:700;color:#10131C">' + sig + '</td>' +
          '</tr>';
      }).join('');
      return '<div style="margin-bottom:13px">' +
        '<div style="display:flex;align-items:center;gap:8px;padding:6px 11px;background:' + c.color + ';border-radius:6px 6px 0 0;page-break-after:avoid;page-break-inside:avoid">' +
          '<div style="font-size:11.5px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:.4px">' + esc(c.cat) + '</div>' +
          '<div style="font-size:9px;color:rgba(255,255,255,.85);margin-left:auto;font-weight:700">top ' + c.rows.length + '</div></div>' +
        '<table style="width:100%;border-collapse:collapse;table-layout:fixed;border:1px solid #ECEFF5;border-top:none">' +
          '<colgroup><col style="width:5%"><col style="width:38%"><col style="width:16%"><col style="width:13%"><col style="width:15%"><col style="width:13%"></colgroup>' +
          '<thead><tr style="background:#F7F9FC">' +
          ['#', 'Produit', 'CIP', 'PPHT', 'Prix net IP', (isNr ? 'Volume' : 'Pharmacies')].map(function (h, k) {
            return '<th style="padding:5px 7px;font-size:8px;text-transform:uppercase;letter-spacing:.04em;color:#9AA1B2;text-align:' + (k === 1 || k === 2 ? 'left' : 'right') + '">' + h + '</th>';
          }).join('') + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
    }).join('');
    return '<div style="width:794px;box-sizing:border-box;padding:26px 28px;font-family:Satoshi,Inter,system-ui,sans-serif;color:#10131C;background:#fff">' +
      '<div style="display:flex;align-items:center;gap:13px;border-bottom:2px solid #10131C;padding-bottom:13px;margin-bottom:15px">' +
        '<div style="width:42px;height:42px;border-radius:11px;background:linear-gradient(150deg,#0050E6,#0034A0);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:16px">IP</div>' +
        '<div style="flex:1"><div style="font-size:9px;color:#737A8C;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Intégral Pharma · catalogue</div>' +
          '<div style="font-size:19px;font-weight:800;letter-spacing:-.01em">Catalogue par catégorie — Princeps & Non remboursables</div>' +
          '<div style="font-size:10px;color:#737A8C">' + totalProd + ' produits · princeps classés par nb de pharmacies qui commandent · NR par volume vendu · prix net indicatif</div></div>' +
        '<div style="text-align:right;font-size:11px;font-weight:700;font-family:monospace">' + dateStr + '</div>' +
      '</div>' + secs +
      '<div style="margin-top:14px;padding-top:8px;border-top:1px solid #E5E9F2;font-size:8px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.04em">Intégral Pharma · document commercial · Prix nets HT indicatifs · NR/parapharmacie : prix libre</div>' +
    '</div>';
  }
  // renvoie [ppht, stock] pour un CIP dans l'établissement courant (ou combiné "Tous")
  function etabRec(cip) {
    var E = window.ETAB_PRICES; if (!E || cip == null || cip === '') return null;
    cip = String(cip);
    if (mktEtab && E.prices && E.prices[mktEtab]) return E.prices[mktEtab][cip] || null;
    return (E.all && E.all[cip]) || null;
  }

  // ════════════════════════════════════════════
  // DONNÉES PRODUITS (Offilog best-sellers + images)
  // ════════════════════════════════════════════
  var bestLoading = false, imgLoading = false;
  function ensureBest(cb) {
    if (window.OFFILOG_BEST) { cb(); return; }
    if (bestLoading) { setTimeout(function () { ensureBest(cb); }, 250); return; }
    bestLoading = true;
    // Les prix B2B ont quitté le fichier public : ils viennent en parallèle,
    // depuis le fichier protégé. Jeton bumpé, le fichier a changé de forme.
    if (V2.loadFiles) { try { V2.loadFiles(['offilogbestprix']).then(function () { if (V2.fusionnerPrixBest) V2.fusionnerPrixBest(); }); } catch (e) {} }
    var s = document.createElement('script'); s.src = 'offilog-bestsellers-data.js?v=20260903b';
    s.onload = function () { bestLoading = false; if (V2.fusionnerPrixBest) V2.fusionnerPrixBest(); cb(); }; s.onerror = function () { bestLoading = false; cb(); };
    document.head.appendChild(s);
  }
  function ensureImg(cb) {
    if (window.OFFILOG_IMG) { cb(); return; }
    if (imgLoading) { setTimeout(function () { ensureImg(cb); }, 250); return; }
    imgLoading = true;
    var s = document.createElement('script'); s.src = 'offilog-img-data.js?v=20260611a';
    s.onload = function () { imgLoading = false; cb(); }; s.onerror = function () { imgLoading = false; cb(); };
    document.head.appendChild(s);
  }
  // Proxy CORS pour le rendu PDF/canvas (les CDN n'envoient pas d'en-tête CORS).
  // Les images locales (pimg/) et data: passent direct (même origine = PDF-safe).
  function proxify(u) {
    if (!u) return '';
    if (!/^https?:\/\//.test(u)) return u;                 // relatif (pimg/) ou data:
    if (u.indexOf('images.weserv.nl') !== -1) return u;
    return 'https://images.weserv.nl/?url=ssl:' + u.replace(/^https?:\/\//, '') + '&w=240&output=jpg';
  }
  function prodImg(p, forPdf) {
    if (forPdf && window.OFFILOG_IMG && p.id && window.OFFILOG_IMG[p.id]) return proxify(window.OFFILOG_IMG[p.id]);
    return proxify(p.img || '');
  }
  function refPriceB(b) { var bp = V2.bestPrice(b); return (bp.ip != null) ? bp.ip : ((b.prix_ht != null && b.prix_ht > 0) ? b.prix_ht : 0); }

  // ════════════════════════════════════════════
  // VUE LISTE
  // ════════════════════════════════════════════
  // ── Sélection grossiste (mix L'Intégral + ITP + meilleures ventes) ──
  // Classé par NB DE PHARMACIES qui commandent (sortie réseau) — données bakées.
  var _mixFlat = null;
  function mixFlat() {
    if (_mixFlat) return _mixFlat;
    var M = window.MKT_MIX || {}, out = [], id = 0, seen = {};
    function push(group, cat, r) {
      // dédoublonnage : par CIP sinon par nom normalisé (1ère source = NR prioritaire)
      var nk = String(r.cip || '') || (r.d || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (nk && seen[nk]) return;
      if (nk) seen[nk] = 1;
      out.push({ id: id++, group: group, cat: cat, name: r.d, cip: r.cip || '', price: r.p || 0,
        remise: r.remise || 0, sortie: r.sortie || 0, vol: r.vol || 0, total: r.total || (M.total || 0),
        ppht: r.ppht || 0, marge: r.marge || 0 });
    }
    // tri par VOLUME vendu (puis sortie)
    (M.nr || []).forEach(function (c) { (c.rows || []).forEach(function (r) { push('nr', c.cat, r); }); });
    (M.rotations || []).forEach(function (c) { (c.rows || []).forEach(function (r) { push('rota', c.cat, r); }); });
    (M.bestsellers || []).forEach(function (c) { (c.rows || []).forEach(function (r) { push('best', c.cat, r); }); });
    (M.integral || []).forEach(function (c) { (c.rows || []).forEach(function (r) { push('integral', c.cat, r); }); });
    (M.itp || []).forEach(function (c) { (c.rows || []).forEach(function (r) { push('itp', c.cat, r); }); });
    out.sort(function (a, b) { return (b.vol - a.vol) || (b.sortie - a.sortie); });   // volume vendu puis nb pharmacies
    _mixFlat = out; return out;
  }

  function flyerPreviewHtml(it) {
    var prev = editing;
    editing = { id: it.id, type: it.type, title: it.title, accroche: it.accroche, footer: it.footer || '', status: it.status,
      products: it.products || [], theme: Object.assign(defaultTheme(it.type), it.theme || {}), owner: it.owner };
    var html = buildFlyerHtml(false, false);
    editing = prev;
    return html;
  }
  // Feuille d'exemple affichée quand il n'existe encore aucune création — mêmes
  // textes que la maquette « L'atelier » (modèle Promo de la semaine).
  function exampleSheetHtml() {
    var prev = editing;
    editing = { id: 'example', type: 'support', title: 'Sécheresse oculaire : trois collyres à mettre en avant',
      accroche: 'Les trois références hydratantes les plus demandées de la rentrée, disponibles sur tout le réseau.',
      footer: '', status: 'brouillon',
      products: [
        { src: 'custom', key: 'ex1', name: 'Thealose sol. opht. flacon 15 mL', brand: 'Théa', cip: '3662042005664', price: 8.34, remise: 0, ppht: 0, img: '', froid: false, cat: 'Yeux & ophtalmologie' },
        { src: 'custom', key: 'ex2', name: 'Hylo Confort collyre hydratant flacon 10 mL', brand: 'Ursapharm', cip: '3401040669580', price: 7.02, remise: 0, ppht: 0, img: '', froid: false, cat: 'Yeux & ophtalmologie' },
        { src: 'custom', key: 'ex3', name: 'Vismed Multi gouttes lubrifiantes flacon 15 mL', brand: 'Horus', cip: '4028694001468', price: 8.60, remise: 0, ppht: 0, img: '', froid: false, cat: 'Yeux & ophtalmologie' }
      ],
      theme: Object.assign(defaultTheme('support'), { tpl: 'promo' }), owner: '' };
    var html = buildFlyerHtml(false, false);
    editing = prev;
    return html;
  }

  // Puces du tiroir « Rayons » de l'accueil : les 7 plus gros rayons du catalogue s'il est
  // en mémoire, sinon les 7 premiers libellés du fichier des rayons. Au tout premier passage
  // rien n'est chargé : on demande le fichier des rayons (léger) et on regarnit le tiroir.
  function rayonsChips(catTotal) {
    var K = catCache(), html, n;
    if (K) {
      n = K.rayons.length;
      html = K.rayons.slice(0, 7).map(function (r) {
        return '<button class="mkt-chip" type="button" onclick="V2.mkt.createFromRayon(' + r.i + ')">' + esc(r.l) + ' <small>' + V2.fmtNum(r.n) + '</small></button>';
      }).join('');
    } else {
      var rLabels = (window.MKT_RAYONS && window.MKT_RAYONS.rayons) || [];
      n = rLabels.length;
      html = rLabels.slice(0, 7).map(function (l, i) {
        return '<button class="mkt-chip" type="button" onclick="V2.mkt.createFromRayon(' + i + ')">' + esc(l) + '</button>';
      }).join('');
      if (!rLabels.length && V2.loadFiles && !rayonsDemandes) {
        rayonsDemandes = true;
        V2.loadFiles(['mktrayons']).then(function () {
          var box = document.getElementById('mkt-rayons-chips'), hd = document.getElementById('mkt-rayons-n');
          if (!box) return;                       // on a quitté l'accueil entre-temps
          var r2 = rayonsChips(catTotal);
          box.innerHTML = r2.html;
          if (hd && r2.n) hd.innerHTML = '<span class="n">' + V2.fmtNum(r2.n) + '</span>';
        }, function () { rayonsDemandes = false; });
      }
    }
    html += '<button class="mkt-chip more" type="button" onclick="V2.mkt.createFromCatalogue()">Tous les rayons · ' + V2.fmtNum(catTotal) + ' réf.</button>';
    return { html: html, n: n };
  }
  var rayonsDemandes = false;
  function renderList(root) {
    if (!liKicked && V2.mktLinkedin && V2.mktLinkedin.loadPosts) { liKicked = true; V2.mktLinkedin.loadPosts().then(function () { if (V2.route && V2.route.name === 'marketing' && !V2.route.param) V2.render(); }); }
    var all = (items || []).slice().sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); });
    var shareNote = backend === 'supabase'
      ? '<span class="mkt-share ok">' + ICO('check', 14, 2) + ' Partagé avec Pauline</span>'
      : '<span class="mkt-share local">' + ICO('alert', 14, 2) + ' Enregistré sur cet appareil</span>';
    var catTotal = (window.CATALOGUE_COMPLET && window.CATALOGUE_COMPLET.rows && window.CATALOGUE_COMPLET.rows.length) || CAT_TOTAL_ATTENDU;

    // ── Tiroir « Modèles » : les 4 modèles, tuile = mini-feuille ──
    var modelsHtml = MODELES.map(function (m) {
      return '<button class="mkt-mtile" type="button" style="--m:' + m.accent + '" data-model="' + m.k + '" data-head="' + m.head + '" onclick="V2.mkt.createWith(\'' + m.k + '\')">' +
        '<b>' + esc(m.label) + '</b><small>' + esc(m.desc) + '</small></button>';
    }).join('');

    // ── Tiroir « Rayons » : les 7 plus gros, avec repli si le catalogue n'est pas encore chargé ──
    var ray = rayonsChips(catTotal), rayChips = ray.html, rayCount = ray.n;

    // ── La feuille sur le plan de travail : la dernière création, ou un exemple ──
    var mostRecent = all[0];
    var sheetHtml = mostRecent ? flyerPreviewHtml(mostRecent) : exampleSheetHtml();
    var sheetClick = mostRecent ? "V2.mkt.open('" + esc(mostRecent.id) + "')" : "V2.mkt.create('support')";

    // ── Créations récentes : éventail de mini-feuilles ──
    var recentHtml;
    if (all.length) {
      var fan = all.slice(0, 6).map(function (it) {
        var t = TYPES[it.type] || TYPES.support;
        var n = (it.products || []).length;
        var st = statusOf(it.status);
        var acc = (it.theme && it.theme.accent) || t.accent;
        var who = (it.owner || '').split('@')[0];
        return '<button class="mkt-mini" type="button" style="--m:' + acc + '" onclick="V2.mkt.open(\'' + esc(it.id) + '\')">' +
          '<i></i><b>' + (it.title ? esc(it.title) : 'Sans titre') + '</b>' +
          '<small>' + n + ' produit' + (n > 1 ? 's' : '') + ' · ' + esc(st.label) +
            (who ? '<br><span class="who"><em>' + esc(who.charAt(0).toUpperCase()) + '</em> ' + esc(who) + '</span>' : '') + '</small>' +
        '</button>';
      }).join('');
      recentHtml = '<div class="mkt-recent"><h2>Créations récentes' + (backend === 'supabase' ? ' · partagées avec Pauline' : '') + '</h2><div class="mkt-fan">' + fan + '</div></div>';
    } else {
      recentHtml = '<div class="mkt-recent"><div class="mkt-empty">Aucune création pour l\'instant — clique la feuille pour commencer.</div></div>';
    }

    // ── Tiroir « Le nouveau site » : bandeau de vignettes si présentes ──
    var mqStrip = '';
    if (window.MAQUETTES_SITE && window.MAQUETTES_SITE.length) {
      var mqL = window.MAQUETTES_SITE, mqShots = '';
      for (var mqi = 0; mqi < 3 && mqi < mqL.length; mqi++) {
        var mqA = mqL[mqi].apercu || ('../../site-integral/propositions/vignettes/' + mqL[mqi].id + '.jpg');
        mqShots += '<img src="' + mqA + '" loading="lazy" decoding="async" alt="">';
      }
      mqStrip = '<span class="mkt-mqstrip">' + mqShots + '</span>';
    }
    var liDue = (V2.mktLinkedin && V2.mktLinkedin.dueCount) ? V2.mktLinkedin.dueCount() : 0;

    root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
      '<main class="mkt-atelier"><div class="v2-wrap mkt-bench">' +

        '<div class="mkt-headline">' +
          '<div><h1>Une feuille vierge, et tout à portée de main.</h1>' +
            '<p>Tape directement dans la feuille. Les modèles, les rayons et les produits sont rangés dans les tiroirs autour. ' + shareNote + '</p></div>' +
          '<div class="mkt-hacts">' +
            '<button class="v2-btn v2-btn-ghost" type="button" onclick="V2.mkt.create(\'support\')">' + ICO('fiche', 17, 2) + 'Une fiche produit</button>' +
            '<button class="v2-btn v2-btn-primary" type="button" onclick="V2.mkt.create(\'selection\')">' + ICO('plus', 17, 2.4) + 'Une sélection de produits</button>' +
          '</div>' +
        '</div>' +

        '<aside class="mkt-rail" aria-label="Tiroirs de gauche">' +
          '<section class="mkt-drawer"><header>' + ICO('grid', 20, 1.8) + 'Modèles<span class="handle"></span></header>' +
            '<div class="body"><div class="mkt-models">' + modelsHtml + '</div></div></section>' +
          '<section class="mkt-drawer"><header>' + ICO('cat', 20, 1.8) + 'Rayons<span id="mkt-rayons-n">' + (rayCount ? '<span class="n">' + V2.fmtNum(rayCount) + '</span>' : '') + '</span></header>' +
            '<div class="body"><div class="mkt-chips" id="mkt-rayons-chips">' + rayChips + '</div></div></section>' +
        '</aside>' +

        '<section class="mkt-stage" aria-label="La feuille">' +
          '<div class="mkt-hint">' + ICO('spark', 14, 2) + 'La feuille est vivante : clique-la pour l\'ouvrir dans l\'atelier.</div>' +
          '<div class="mkt-sheetwrap" id="mkt-home-wrap">' +
            '<button class="mkt-sheet-home" type="button" id="mkt-home-btn" onclick="' + sheetClick + '" aria-label="Ouvrir la feuille">' +
              '<div class="mkt-home-holder" id="mkt-home-holder"><div class="mkt-home-sheet" id="mkt-home-sheet">' + sheetHtml + '</div></div>' +
            '</button>' +
          '</div>' +
          recentHtml +
        '</section>' +

        '<aside class="mkt-rail right" aria-label="Instruments">' +
          '<section class="mkt-drawer"><header>' + ICO('cat', 20, 1.8) + 'Catalogue<span class="handle"></span></header>' +
            '<div class="body">' +
              '<button class="mkt-tool" type="button" onclick="V2.go(\'marketing\',\'catalogues\')">' +
                '<span class="tico">' + ICO('grid', 20, 1.8) + '</span>' +
                '<span><b>Catalogue &amp; prix</b><span>' + V2.fmtNum(catTotal) + ' références, PPHT et stock par établissement. « Créer la liste » en un clic.</span></span>' +
                '<span class="arr">' + ICO('chev', 16, 2.2) + '</span></button>' +
              '<div class="mkt-tool" style="cursor:default">' +
                '<span class="tico pdf">' + ICO('download', 20, 1.8) + '</span>' +
                '<span><b>Catalogue par catégorie</b><span>Princeps petits prix · intermédiaire · cher + NR. PDF ou Excel.</span>' +
                  '<span style="display:flex;gap:8px;margin-top:8px"><button class="v2-btn v2-btn-ghost" style="min-height:36px" onclick="event.stopPropagation();V2.mkt.top50Pdf()">' + ICO('download', 14) + ' PDF</button>' +
                  '<button class="v2-btn v2-btn-ghost" style="min-height:36px" onclick="event.stopPropagation();V2.mkt.top50Xlsx()">' + ICO('download', 14) + ' Excel</button></span></span></div>' +
              '<div class="mkt-tool" style="cursor:default">' +
                '<span class="tico">' + ICO('pill', 20, 1.8) + '</span>' +
                '<span><b>Biosimilaires substituables</b><span>Fiche façon Teva prête à présenter.</span>' +
                  '<span style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
                    '<button class="v2-btn v2-btn-ghost" style="min-height:36px" onclick="event.stopPropagation();V2.ouvrirDocProtege(\'biosimSynthesePharma\')">' + ICO('download', 14) + ' Fiche PDF</button>' +
                    '<button class="v2-btn v2-btn-ghost" style="min-height:36px" onclick="event.stopPropagation();V2.ouvrirDocProtege(\'biosimDetailPharma\')">' + ICO('download', 14) + ' Toutes présentations</button>' +
                    (V2.pages && V2.pages.biosimilaires ? '<button class="v2-btn v2-btn-ghost" style="min-height:36px" onclick="event.stopPropagation();V2.go(\'biosimilaires\')">' + ICO('chev', 14, 2.2) + ' Ouvrir la base</button>' : '') +
                  '</span></span></div>' +
            '</div></section>' +
          '<section class="mkt-drawer"><header>' + ICO('cal', 20, 1.8) + 'Communication<span class="handle"></span></header>' +
            '<div class="body">' +
              '<button class="mkt-tool" type="button" onclick="V2.go(\'marketing\',\'linkedin\')">' +
                '<span class="tico">' + ICO('cal', 20, 1.8) + '</span>' +
                '<span><b>Rétroplanning LinkedIn' + (liDue > 0 ? ' <span class="mkt-badge">' + liDue + ' à publier</span>' : '') + '</b><span>Calendrier éditorial : anciens posts, prochains à préparer, publication en un clic.</span></span>' +
                '<span class="arr">' + ICO('chev', 16, 2.2) + '</span></button>' +
              '<button class="mkt-tool" type="button" onclick="V2.go(\'marketing\',\'docs\')">' +
                '<span class="tico">' + ICO('download', 20, 1.8) + '</span>' +
                '<span><b>Documents partagés</b><span>Catalogues, fiches et offres en PDF, visibles par tous les comptes.</span></span>' +
                '<span class="arr">' + ICO('chev', 16, 2.2) + '</span></button>' +
              '<button class="mkt-tool" type="button" onclick="V2.go(\'marketing\',\'propositions\')">' +
                '<span class="tico">' + ICO('cat', 20, 1.8) + '</span>' +
                '<span><b>Le nouveau site</b><span>Intégral Pharma, version unique — voir et noter.</span></span>' +
                '<span class="arr">' + ICO('chev', 16, 2.2) + '</span></button>' +
              mqStrip +
            '</div></section>' +
          '<details class="mkt-drawer mkt-more"><summary>' + ICO('cat', 20, 1.8) + 'Autres outils<span class="n">maquettes, supports</span><span class="mkt-more-chev">' + ICO('chev', 16, 2) + '</span></summary>' +
            '<div class="body">' +
              '<button class="mkt-tool" type="button" onclick="V2.go(\'marketing\',\'site\')">' +
                '<span class="tico">' + ICO('cat', 20, 1.8) + '</span>' +
                '<span><b>Le nouveau site, en plein écran</b><span>La version unique, servie telle qu\'elle sera en ligne.</span></span>' +
                '<span class="arr">' + ICO('chev', 16, 2.2) + '</span></button>' +
              '<button class="mkt-tool" type="button" onclick="V2.go(\'marketing\',\'fxbank\')">' +
                '<span class="tico">' + ICO('spark', 20, 1.8) + '</span>' +
                '<span><b>Banque d\'effets</b><span>Composants 3D / motion / design prêts à assembler.</span></span>' +
                '<span class="arr">' + ICO('chev', 16, 2.2) + '</span></button>' +
            '</div></details>' +
        '</aside>' +

        (backend === 'local'
          ? '<div class="mkt-setup" style="grid-column:1/-1">' + ICO('alert', 16, 2) + '<div><b>Activer le partage entre vous</b><br>' +
            'Pour l\'instant les supports sont enregistrés sur cet appareil. Pour que Pauline et toi voyiez les mêmes, il faut créer une table dans Supabase (une seule fois). Demande-moi le script SQL, il est prêt.</div></div>'
          : '') +
      '</div></main>';

    fitHomeSheet();
    if (!V2._mktHomeFitBound) { window.addEventListener('resize', fitHomeSheet); V2._mktHomeFitBound = true; }
    wireHomeTilt();

    if (V2.motion) {
      V2.motion.stagger(root.querySelectorAll('.mkt-mini'), { step: 45, y: 10 });
      var drawers = root.querySelectorAll('.mkt-drawer');
      for (var di = 0; di < drawers.length; di++) V2.motion.enter(drawers[di], { y: 8, delay: 40 * di });
    }
  }
  // ── Mise à l'échelle de la feuille d'accueil (même principe que fitSheet, id distincts) ──
  function fitHomeSheet() {
    var ho = document.getElementById('mkt-home-holder'), sh = document.getElementById('mkt-home-sheet');
    if (!ho || !sh) return;
    var avail = Math.min(ho.parentNode.clientWidth || 600, 600);
    var scale = Math.min(1, avail / 794);
    sh.style.transform = 'scale(' + scale + ')';
    var h = sh.firstChild ? sh.firstChild.offsetHeight : sh.offsetHeight;
    ho.style.width = (794 * scale) + 'px'; ho.style.height = (h * scale) + 'px';
  }
  // ── Inclinaison 3D de la feuille d'accueil sous le curseur (souris fine, hors reduced-motion) ──
  function wireHomeTilt() {
    var wrap = document.getElementById('mkt-home-wrap'); if (!wrap) return;
    if (!(window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    wrap.addEventListener('mousemove', function (e) {
      var r = wrap.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      wrap.style.setProperty('--ry', (-10 + x * 12).toFixed(2) + 'deg');
      wrap.style.setProperty('--rx', (6 - y * 9).toFixed(2) + 'deg');
    });
    wrap.addEventListener('mouseleave', function () { wrap.style.removeProperty('--rx'); wrap.style.removeProperty('--ry'); });
  }

  // ════════════════════════════════════════════
  // SITE VITRINE INTÉGRAL PHARMA (aperçu en iframe)
  // ════════════════════════════════════════════
  function renderSite(root) {
    root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) +
      '<div style="width:100%;height:calc(100vh - 66px);min-height:520px;background:#fff">' +
        '<iframe src="../../site-integral/site-2026/index.html?v=20260828c" title="Le nouveau site Intégral Pharma" loading="lazy" style="width:100%;height:100%;border:0;display:block"></iframe>' +
      '</div>';
  }

  // ════════════════════════════════════════════
  // PROPOSITIONS DE DIRECTION ARTISTIQUE (les 20 directions + les notes)
  // ════════════════════════════════════════════
  // L'écran n'est plus une galerie enfermée dans une iframe : c'est une vraie
  // page de l'app (`v2-maquettes.js`), avec la note sur 10 de chacun et la
  // moyenne partagée. On garde l'ancienne galerie en repli au cas où le
  // module ne serait pas chargé — mieux vaut une iframe qu'un écran blanc.
  function renderPropositions(root) {
    if (V2.maquettes && V2.maquettes.render) { V2.maquettes.render(root); return; }
    root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) +
      '<div style="width:100%;height:calc(100vh - 66px);min-height:520px;background:#FAFAF8">' +
        '<iframe src="../../site-integral/propositions/trionn/index.html?v=20260815a" title="La maquette du nouveau site" loading="lazy" style="width:100%;height:100%;border:0;display:block"></iframe>' +
      '</div>';
  }

  // ════════════════════════════════════════════
  // FX-BANK (banque d'effets — catalogue)
  // ════════════════════════════════════════════
  function renderFxBank(root) {
    root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) +
      '<div style="width:100%;height:calc(100vh - 66px);min-height:520px;background:#06080F">' +
        '<iframe src="../../site-integral/fx-bank/index.html?v=20260703d" title="FX-BANK — banque d\'effets" loading="lazy" style="width:100%;height:100%;border:0;display:block"></iframe>' +
      '</div>';
  }

  // ════════════════════════════════════════════
  // CATALOGUES GROSSISTE (L'Intégral + ITP + Top ventes)
  // ════════════════════════════════════════════
  function catImg(cip) {
    var M = window.MKT_IMG; if (!M || !cip) return '';
    return M[String(cip)] || '';
  }
  function updateCatBar() {
    var bar = document.getElementById('mkt-catbar'); if (!bar) return;
    var n = catSel.length;
    var lbl = document.getElementById('mkt-catbar-n');
    if (lbl) lbl.textContent = n + ' produit' + (n > 1 ? 's' : '') + ' sélectionné' + (n > 1 ? 's' : '');
    bar.classList.toggle('on', n > 0);
  }
  function renderCatalogues(root) {
    var M = window.MKT_MIX || {}, total = M.total || 0;
    var NR = window.MKT_NR || null;
    if (!NR) ensureNr(function () { if (V2.route && V2.route.name === 'marketing') V2.render(); });
    var srcs = [
      { k: 'nrreal', label: 'Ventes NR réelles', data: (NR && NR.cats) || [], pdf: null },
      { k: 'integral', label: 'L\'Intégral', data: M.integral || [], pdf: 'catalogue-integral.pdf' },
      { k: 'itp', label: 'ITP', data: M.itp || [], pdf: 'catalogue-itp.pdf' },
      { k: 'best', label: 'Top ventes (familles)', data: M.bestsellers || [], pdf: null },
      { k: 'nr', label: 'Catalogue NR (national)', data: M.nr || [], pdf: null },
    ];
    var cur = srcs.filter(function (s) { return s.k === catSrc; })[0] || srcs[0];
    var isNr = (cur.k === 'nrreal');
    var tabs = srcs.map(function (s) { return '<button class="mkt-srcbtn' + (s.k === catSrc ? ' on' : '') + '" onclick="V2.mkt.catSrc(\'' + s.k + '\')">' + esc(s.label) + '</button>'; }).join('');
    var offre = ' <span style="font-size:8.5px;font-weight:800;color:var(--c-amber);background:color-mix(in srgb,var(--c-amber) 14%,#fff);padding:1px 5px;border-radius:5px;text-transform:uppercase">offre</span>';
    catRows = [];
    var showStock = !!(window.ETAB_PRICES && mktEtab);   // colonne stock si un établissement précis est choisi
    var cats = cur.data.map(function (c) {
      var rowsArr = (c.rows || []).filter(function (r) {
        if (!(mktEtab && etabStockOnly)) return true;
        var er = etabRec(r.cip); return !!(er && er[1] > 0);
      });
      if (!rowsArr.length) return '';
      if (catSortBy === 'pharma') rowsArr.sort(function (a, b) { return (b.sortie || 0) - (a.sortie || 0) || (b.vol || 0) - (a.vol || 0); });
      var trs = rowsArr.map(function (r, i) {
        var er = etabRec(r.cip);
        var pval = (er && er[0] > 0) ? er[0] : r.p;
        var stock = er ? er[1] : null;
        var price = (pval > 0) ? V2.fmtEur(pval) : '—';
        var midCol = (cur.k === 'itp')
          ? '<td class="num" style="color:var(--c-mint);font-weight:700">' + (r.marge ? V2.fmtEur(r.marge) : '—') + '</td>'
          : isNr
          ? '<td class="num" style="font-weight:700;color:var(--ip-blue)">' + (r.ca > 0 ? V2.fmtEur(r.ca) : '—') + '</td>'
          : '<td class="num" style="font-weight:700">' + (r.sortie > 0 ? r.sortie + '<span style="color:var(--muted-2);font-weight:500">/' + total + '</span>' : '—') + '</td>';
        var volCol = '<td class="num" style="font-weight:800;color:var(--ip-ink)">' + (r.vol > 0 ? V2.fmtNum(r.vol) : '—') + '</td>';
        var stockCol = showStock ? '<td class="num" style="font-weight:800;color:' + (stock > 0 ? 'var(--c-mint)' : 'var(--c-rose)') + '">' + (stock != null ? V2.fmtNum(stock) : '—') + '</td>' : '';
        var fi = catRows.length;
        var pic = catImg(r.cip);
        catRows.push({ d: r.d, cip: r.cip, p: pval, stock: stock, froid: false, cat: c.cat, img: pic });
        var selKey = String(r.cip || r.d);
        var added = catSel.some(function (x) { return x.key === selKey; });
        var addBtn = '<td style="width:36px;text-align:center"><button class="mkt-catadd' + (added ? ' on' : '') + '" id="mkt-ca-' + fi + '" title="' + (added ? 'Retirer de ma sélection' : 'Ajouter à une fiche') + '" onclick="V2.mkt.catAdd(' + fi + ')">' + ICO(added ? 'check' : 'plus', 15, 2.4) + '</button></td>';
        var thumb = pic
          ? '<td style="width:46px"><span class="mkt-cat-thumb" style="background-image:url(' + esc(pic) + ')"></span></td>'
          : '<td style="width:46px"><span class="mkt-cat-thumb mkt-cat-thumb-ph">' + ICO('pill', 18, 1.5) + '</span></td>';
        return '<tr data-s="' + esc(((r.d || '') + ' ' + (r.cip || '')).toLowerCase()) + '">' +
          '<td class="num" style="color:var(--muted-2);width:28px;text-align:right;font-family:var(--mono)">' + (i + 1) + '</td>' +
          thumb +
          '<td><span class="mkt-cat-prod">' + esc(r.d) + '</span>' + (r.o ? offre : '') + '</td>' +
          '<td class="mono" style="color:var(--muted);font-size:12px">' + esc(r.cip || '—') + '</td>' +
          '<td class="num" style="color:var(--ip-blue);font-weight:700">' + price + '</td>' + midCol + volCol + stockCol + addBtn +
        '</tr>';
      }).join('');
      var midTh = (cur.k === 'itp') ? 'Marge/bte' : isNr ? 'CA vendu' : 'Sorties';
      var stockTh = showStock ? '<th class="num">Stock</th>' : '';
      var cn = String(c.cat).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return '<div class="v2-card" data-catcard="1" style="margin-bottom:14px;padding:16px 18px">' +
        '<div class="mkt-cathead"><div class="v2-card-t">' + esc(c.cat) + ' <span class="mkt-cat-count" style="color:var(--muted);font-weight:500">· ' + rowsArr.length + '</span></div>' +
          '<button class="mkt-catlist-btn" onclick="V2.mkt.catList(\'' + cn + '\')" title="Créer une liste avec les produits les plus commandés de cette catégorie">' + ICO('plus', 14, 2.2) + 'Créer la liste</button></div>' +
        '<div style="overflow-x:auto"><table class="v2-table"><thead><tr><th class="num">#</th><th></th><th>Produit</th><th>CIP</th><th class="num">Prix net</th><th class="num">' + midTh + '</th><th class="num">Volume vendu</th>' + stockTh + '<th></th></tr></thead><tbody>' + trs + '</tbody></table></div>' +
      '</div>';
    }).join('');
    if (!window.ETAB_PRICES) ensureEtab(function () { if (V2.route && V2.route.name === 'marketing') V2.render(); });
    var ETABS = (window.ETAB_PRICES && window.ETAB_PRICES.etabs) || [];
    var etabBtns = '<button class="mkt-etabchip' + (mktEtab === '' ? ' on' : '') + '" onclick="V2.mkt.catEtab(\'\')">Tous</button>' +
      ETABS.map(function (e) { return '<button class="mkt-etabchip' + (mktEtab === e.code ? ' on' : '') + '" onclick="V2.mkt.catEtab(\'' + e.code + '\')">' + esc(e.code) + '</button>'; }).join('');
    var etabBar = ETABS.length ? ('<div class="mkt-etabbar"><span class="mkt-etablbl">Établissement — prix &amp; stock à jour</span>' +
      '<div class="mkt-etabchips">' + etabBtns + '</div>' +
      (mktEtab ? '<label class="mkt-stocktgl"><input type="checkbox"' + (etabStockOnly ? ' checked' : '') + ' onchange="V2.mkt.catStockOnly(this.checked)"> En stock uniquement</label>' : '') +
      '</div>') : '';
    var sortBar = isNr ? '' : ('<div class="mkt-sortbar"><span class="mkt-sortlbl">Classer par</span>' +
      '<button class="mkt-etabchip' + (catSortBy === 'pharma' ? ' on' : '') + '" onclick="V2.mkt.catSort(\'pharma\')">Nb de pharmacies</button>' +
      '<button class="mkt-etabchip' + (catSortBy === 'vol' ? ' on' : '') + '" onclick="V2.mkt.catSort(\'vol\')">Volume vendu</button>' +
      '</div>');
    var PERCATS = [3, 5, 10, 15, 0];
    var perCatBar = '<div class="mkt-sortbar"><span class="mkt-sortlbl">Produits/catégorie sur le doc</span>' +
      PERCATS.map(function (n) { return '<button class="mkt-etabchip' + (catPerCat === n ? ' on' : '') + '" onclick="V2.mkt.catPerCat(' + n + ')">' + (n === 0 ? 'Tous' : n) + '</button>'; }).join('') +
      '</div>';
    var docLabel = 'Générer le doc — top ' + (catPerCat > 0 ? catPerCat : 'tous') + '/catégorie' + (mktEtab ? ' · ' + mktEtab : '');
    root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) +
      '<div class="v2-wrap">' +
        (V2.priceTabs ? V2.priceTabs('marketing:catalogues') : '') +
        '<div class="v2-page-title">Catalogue &amp; prix — grossiste</div>' +
        '<div class="v2-page-sub">' + (isNr
          ? 'Nos <b>vraies ventes hors-remboursable</b> (OTC, dispositifs, parapharmacie) classées par volume réellement vendu' + (NR && NR.meta ? ' sur ' + esc((NR.meta.etabs || []).join('/')) : '') + '. Choisis un établissement pour le prix &amp; le stock à jour, puis <b>« Créer la liste »</b> pour un catalogue vendeur.'
          : 'L\'Intégral (parapharma) &amp; ITP (pansements/DM) — ce qu\'on fait en tant que grossiste, classé par nombre de pharmacies qui commandent. Bouton <b>« Créer la liste »</b> par catégorie = sélection parfaite des produits les plus commandés.') + '</div>' +
        '<div class="mkt-top50">' +
          '<div class="mkt-top50-ic">' + ICO('grid', 20, 2) + '</div>' +
          '<div class="mkt-top50-txt"><div class="mkt-top50-t">Catalogue par catégorie</div>' +
            '<div class="mkt-top50-s">Princeps (petits prix : top 100 · intermédiaire · cher) + NR étoffé (OTC · dispositifs · parapharmacie · autres, top 100) — avec PPHT, abandon et prix net.</div></div>' +
          '<div class="mkt-top50-btns">' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.mkt.top50Pdf()">' + ICO('download', 15) + ' Fiche PDF</button>' +
            '<button class="v2-btn v2-btn-ghost" onclick="V2.mkt.top50Xlsx()">' + ICO('download', 15) + ' Excel</button>' +
          '</div>' +
        '</div>' +
        '<div class="mkt-pick-src" style="margin:16px 0 10px">' + tabs + '</div>' +
        etabBar +
        sortBar +
        perCatBar +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.mkt.catPdf(\'' + cur.k + '\')">' + ICO('download', 16) + esc(docLabel) + '</button>' +
          (cur.pdf ? '<a class="v2-btn v2-btn-ghost" href="' + cur.pdf + '" download>' + ICO('download', 16) + 'Catalogue ' + esc(cur.label) + ' d\'origine</a>' : '') +
        '</div>' +
        '<div class="mkt-search"><span class="mkt-search-ic">' + ICO('search', 16, 2) + '</span>' +
          '<input type="search" id="mkt-cat-search" placeholder="Rechercher un produit ou un CIP…" value="' + esc(catQuery) + '" oninput="V2.mkt.catFilter(this.value)">' +
          '<button class="mkt-search-x" onclick="V2.mkt.catFilter(\'\')" title="Effacer"' + (catQuery ? '' : ' style="display:none"') + '>' + ICO('close', 15, 2) + '</button>' +
        '</div>' +
        (cats || '<div class="v2-empty"><div class="v2-empty-d">Catalogue indisponible.</div></div>') +
        '<div id="mkt-cat-nores" class="v2-empty" style="display:none"><div class="v2-empty-d">Aucun produit ne correspond à ta recherche.</div></div>' +
        '<div class="mkt-catbar' + (catSel.length ? ' on' : '') + '" id="mkt-catbar">' +
          '<span id="mkt-catbar-n">' + catSel.length + ' produit' + (catSel.length > 1 ? 's' : '') + ' sélectionné' + (catSel.length > 1 ? 's' : '') + '</span>' +
          '<div style="display:flex;gap:8px">' +
            '<button class="v2-btn v2-btn-ghost" onclick="V2.mkt.catClear()">Vider</button>' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.mkt.catBuildFiche()">' + ICO('plus', 15) + 'Créer une fiche marketing</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    if (catQuery.trim() && V2.mkt && V2.mkt.catFilter) V2.mkt.catFilter(catQuery);
  }

  // ════════════════════════════════════════════
  // ÉDITEUR
  // ════════════════════════════════════════════
  function renderEditor(root, id) {
    if (id === 'new-support' || id === 'new-selection') {
      var ty = id === 'new-selection' ? 'selection' : 'support';
      if (!editing || editing._new !== ty) {
        editing = { id: newId(), type: ty, title: '', accroche: '', footer: '', status: 'brouillon', products: [],
          theme: Object.assign(defaultTheme(ty), { tpl: ty === 'selection' ? 'selection' : 'promo' }),
          owner: (V2.user && V2.user.email) || '', _new: ty };
      }
    } else {
      var ex = (items || []).filter(function (x) { return x.id === id; })[0];
      if (!ex) { V2.toast('Support introuvable', 'error'); V2.go('marketing'); return; }
      if (!editing || editing.id !== ex.id) {
        editing = { id: ex.id, type: ex.type, title: ex.title, accroche: ex.accroche, footer: ex.footer || '', status: ex.status,
                    products: (ex.products || []).map(function (p) { return Object.assign({}, p); }),
                    theme: Object.assign(defaultTheme(ex.type), ex.theme || {}), owner: ex.owner };
      }
    }
    var t = TYPES[editing.type] || TYPES.support;
    var n = editing.products.length;
    var statusChips = '<div class="mkt-seg" role="group" aria-label="Statut">' + STATUSES.map(function (s) {
      return '<button type="button" aria-pressed="' + (editing.status === s.k ? 'true' : 'false') + '" onclick="V2.mkt.setStatus(\'' + s.k + '\',this)">' + esc(s.label) + '</button>';
    }).join('') + '</div>';
    var prodHtml = n ? editing.products.map(prodRow).join('') : '<div class="mkt-empty" style="border:none">Aucun produit. Ajoute des références ci-dessous.</div>';
    var curTpl = (editing.theme && editing.theme.tpl) || 'promo';
    var modelsHtml = MODELES.map(function (m) {
      return '<button class="mkt-mtile" type="button" style="--m:' + m.accent + '" data-model="' + m.k + '" data-head="' + m.head + '" aria-pressed="' + (curTpl === m.k ? 'true' : 'false') + '" onclick="V2.mkt.setModele(\'' + m.k + '\')">' +
        '<b>' + esc(m.label) + '</b><small>' + esc(m.desc) + '</small></button>';
    }).join('');

    root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) +
      '<main class="mkt-atelier"><div class="v2-wrap mkt-bench">' +

        '<div class="mkt-headline">' +
          '<div><h1>' + (editing.title ? esc(editing.title) : 'Sans titre') + '</h1>' +
            '<p>Modèle choisi · tu personnalises · tu télécharges. Tout se fait sur la feuille.</p></div>' +
          '<div class="mkt-hacts">' +
            '<button class="v2-btn v2-btn-ghost" type="button" onclick="V2.mkt.openPicker()">' + ICO('plus', 17, 2.4) + 'Ajouter des produits</button>' +
            '<button class="v2-btn v2-btn-primary" type="button" onclick="V2.mkt.downloadPdf()">' + ICO('download', 17, 2) + 'Télécharger le PDF</button>' +
          '</div>' +
        '</div>' +

        '<aside class="mkt-rail" aria-label="Tiroirs de gauche">' +
          '<section class="mkt-drawer"><header>' + ICO('grid', 20, 1.8) + 'Modèles<span class="handle"></span></header>' +
            '<div class="body"><div class="mkt-models">' + modelsHtml + '</div></div></section>' +
          '<section class="mkt-drawer"><header>' + ICO('check', 20, 1.8) + 'Statut<span class="handle"></span></header>' +
            '<div class="body">' + statusChips + '<p class="desc" style="padding-top:10px">Partagée avec Pauline dès l\'enregistrement.</p></div></section>' +
          '<section class="mkt-drawer"><header>' + ICO('spark', 20, 1.8) + 'Affichage<span class="handle"></span></header>' +
            '<div class="body">' + personalizePanel() + '</div></section>' +
        '</aside>' +

        '<section class="mkt-stage" aria-label="La feuille">' +
          '<div class="mkt-toolbar"><div class="mkt-tbsteps"><b><i class="done">' + ICO('check', 12, 3) + '</i>Modèle</b><span>—</span><b><i>2</i>Personnaliser</b></div>' +
            '<div class="mkt-tbhint"><i></i>Aperçu en direct</div></div>' +
          '<div class="mkt-sheetwrap">' +
            '<div class="mkt-mscroll" id="mkt-mscroll"><div class="mkt-mholder" id="mkt-mholder"><div class="mkt-msheet" id="mkt-msheet"></div></div></div>' +
          '</div>' +
          '<section class="mkt-drawer" style="width:min(100%,600px)">' +
            '<header>' + ICO('cart', 20, 1.8) + 'Produits sur la feuille<span class="n" id="mkt-count">' + n + '</span></header>' +
            '<div class="body">' +
              '<div id="mkt-prodlist">' + prodHtml + '</div>' +
              catDatalist() +
              '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
                '<button class="v2-btn v2-btn-ghost" type="button" onclick="V2.mkt.openPicker()">' + ICO('plus', 16, 2.4) + 'Ajouter des produits</button>' +
                '<button class="v2-btn v2-btn-ghost" type="button" onclick="V2.mkt.addCustom()">' + ICO('plus', 16, 2) + 'Produit libre</button>' +
              '</div>' +
            '</div></section>' +
        '</section>' +

        '<aside class="mkt-rail right" aria-label="Instruments">' +
          '<section class="mkt-drawer"><header>' + ICO('fiche', 20, 1.8) + 'Texte<span class="handle"></span></header>' +
            '<div class="body">' +
              '<div class="mkt-field"><label for="mkt-title">Titre</label><input id="mkt-title" type="text" placeholder="Titre du ' + esc(t.label.toLowerCase()) + '…" value="' + esc(editing.title) + '" oninput="V2.mkt.setTitle(this.value)"></div>' +
              '<div class="mkt-field" style="margin-top:10px"><label for="mkt-accroche">Accroche</label><textarea id="mkt-accroche" rows="3" placeholder="Accroche / message (ex : Notre sélection solaires de l\'été)…" oninput="V2.mkt.setAccroche(this.value)">' + esc(editing.accroche || '') + '</textarea></div>' +
            '</div></section>' +
          '<section class="mkt-drawer"><header>' + ICO('check', 20, 1.8) + 'Actions<span class="handle"></span></header>' +
            '<div class="body" style="display:flex;flex-direction:column;gap:8px">' +
              '<button class="v2-btn v2-btn-ghost" type="button" onclick="V2.mkt.save()">' + ICO('check', 16, 2) + 'Enregistrer</button>' +
              '<button class="v2-btn v2-btn-primary" type="button" onclick="V2.mkt.downloadPdf()">' + ICO('download', 16, 2) + 'Télécharger le PDF</button>' +
              '<button class="v2-btn v2-btn-ghost mkt-del-a" type="button" onclick="V2.mkt.remove()">' + ICO('close', 16, 2) + 'Supprimer</button>' +
            '</div></section>' +
        '</aside>' +

      '</div></main>' + pickerMarkup();
    wirePicker();
    refreshPreview();
    if (!V2._mktFitBound) { window.addEventListener('resize', fitSheet); V2._mktFitBound = true; }
    if (pickOpenOnRender) { pickOpenOnRender = false; openPicker(); }
  }
  var CAT_SUGG = ['Antalgiques & douleur', 'ORL · Nez & gorge', 'Digestif & transit', 'Dermatologie', 'Circulation veineuse', 'Compléments & vitamines', 'Diabète & autosurveillance', 'Ophtalmologie', 'Pansements & cicatrisation', 'Hygiène · Bébé · Sérum phy', 'Sommeil · Stress', 'Sevrage tabac', 'Contraception & gynéco', 'Solaire', 'Minceur', 'Vétérinaire'];
  function catDatalist() {
    var seen = {}, opts = '';
    (editing && editing.products || []).forEach(function (p) {
      var c = (p.cat || '').trim();
      if (c && !seen[c]) { seen[c] = 1; opts += '<option value="' + esc(c) + '">'; }
    });
    CAT_SUGG.forEach(function (c) { if (!seen[c]) { seen[c] = 1; opts += '<option value="' + esc(c) + '">'; } });
    return '<datalist id="mkt-cats">' + opts + '</datalist>';
  }
  function prodRow(p, i) {
    var img = p.img
      ? '<span class="mkt-prow-img" style="background-image:url(' + esc(p.img) + ')"></span>'
      : '<span class="mkt-prow-img mkt-prow-pill">' + ICO('pill', 18, 1.6) + '</span>';
    var sub = p.cip ? ('CIP ' + esc(p.cip)) : (p.brand ? esc(p.brand) : (p.src === 'custom' ? 'produit libre' : (p.ean ? 'EAN ' + esc(p.ean) : '')));
    return '<div class="mkt-prow">' + img +
      '<div class="mkt-prow-main">' +
        '<input class="mkt-prow-namei" value="' + esc(p.name || '') + '" placeholder="Nom du produit" aria-label="Nom" oninput="V2.mkt.setProd(' + i + ',\'name\',this.value)">' +
        '<div class="mkt-prow-sub2">' +
          '<input class="mkt-prow-cati" list="mkt-cats" value="' + esc(p.cat || '') + '" placeholder="Catégorie…" aria-label="Catégorie" oninput="V2.mkt.setProd(' + i + ',\'cat\',this.value)">' +
          '<span class="mkt-prow-sub">' + (sub || 'produit libre') + (p.froid ? ' · FROID' : '') + '</span>' +
        '</div>' +
      '</div>' +
      '<label class="mkt-prow-f"><span>Prix €</span><input type="number" inputmode="decimal" step="0.01" min="0" value="' + (p.price != null && p.price !== 0 ? p.price : '') + '" aria-label="Prix" oninput="V2.mkt.setProd(' + i + ',\'price\',this.value)"></label>' +
      '<label class="mkt-prow-f"><span>Abandon %</span><input type="number" inputmode="decimal" step="0.1" min="0" value="' + (p.remise != null && p.remise !== 0 ? p.remise : '') + '" aria-label="Abandon de marge" oninput="V2.mkt.setProd(' + i + ',\'remise\',this.value)"></label>' +
      '<button class="mkt-prow-x" onclick="V2.mkt.removeProduct(' + i + ')" title="Retirer">' + ICO('close', 15, 2) + '</button>' +
    '</div>';
  }
  function refreshProducts() {
    var box = document.getElementById('mkt-prodlist'); if (!box) { V2.render(); return; }
    var n = editing.products.length;
    box.innerHTML = n ? editing.products.map(prodRow).join('') : '<div class="mkt-empty" style="border:none">Aucun produit. Ajoute des références ci-dessous.</div>';
    var c = document.getElementById('mkt-count'); if (c) c.textContent = n + ' produit' + (n > 1 ? 's' : '');
    refreshPreview();
  }

  // ── Sélecteur de produits : explorateur de catalogue, multi-sélection ──
  // Trois univers : tout le catalogue Intégral (16 305 références, chargé à
  // la demande avec ses rayons), la parapharmacie Offilog (rayon, marque),
  // nos sélections (top ventes, rotations, ITP…). Facettes à gauche,
  // résultats par 60, une coche par ligne, pied collant « Ajouter N produits ».
  // Ouvert depuis la photo de l'aperçu (replaceIdx) : un clic remplace et ferme.
  function sansAccent(x) {
    var v = String(x == null ? '' : x).toLowerCase();
    if (v.normalize) v = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return v;
  }
  function pickQuery() {
    var inp = document.getElementById('mkt-pick-input');
    var q = sansAccent(inp ? inp.value : '').trim();
    return q.length >= 2 ? q : '';
  }
  function rayonLibelle(i) {
    var R = window.MKT_RAYONS;
    return (R && R.rayons && typeof i === 'number' && i >= 0 && R.rayons[i]) || '';
  }
  // Catalogue complet : une seule passe — tri (réseau, stock, nom, comme
  // l'onglet Catalogue de l'écran Produits), rayon et chaîne de recherche sans
  // accents par ligne, comptes par rayon / famille / laboratoire. Filtrer
  // ensuite ne coûte qu'un parcours linéaire, à chaque frappe.
  function catCache() {
    if (pickCatCache) return pickCatCache;
    var C = (V2.produits && V2.produits.catalogueIndex) ? V2.produits.catalogueIndex() : null;
    if (!C) return null;
    var R = window.MKT_RAYONS, rows = [], nRay = {}, nFam = {}, nLab = {}, c, o, ri;
    for (c in C) {
      if (!Object.prototype.hasOwnProperty.call(C, c)) continue;
      o = C[c];
      ri = (R && R.cip && typeof R.cip[c] === 'number') ? R.cip[c] : -1;
      rows.push({ o: o, r: ri, s: sansAccent(o.d + ' ' + c + ' ' + o.mol + ' ' + o.labo) });
      nRay[ri] = (nRay[ri] || 0) + 1;
      if (o.f) nFam[o.f] = (nFam[o.f] || 0) + 1;
      if (o.labo) nLab[o.labo] = (nLab[o.labo] || 0) + 1;
    }
    rows.sort(function (a, b) {
      return (b.o.n - a.o.n) || (b.o.stock - a.o.stock) || String(a.o.d).localeCompare(String(b.o.d), 'fr');
    });
    var rayons = Object.keys(nRay).map(Number).filter(function (i) { return i >= 0; })
      .sort(function (a, b) { return nRay[b] - nRay[a]; })
      .map(function (i) { return { i: i, l: rayonLibelle(i), n: nRay[i] }; });
    var labos = Object.keys(nLab).sort(function (a, b) { return nLab[b] - nLab[a]; })
      .map(function (l) { return { l: l, n: nLab[l] }; });
    pickCatCache = { rows: rows, rayons: rayons, sansRayon: nRay[-1] || 0, fam: nFam, labos: labos, total: rows.length };
    return pickCatCache;
  }
  function pickCatRows(q) {
    var K = catCache(); if (!K) return [];
    var out = [], i, r, f = pickF;
    for (i = 0; i < K.rows.length; i++) {
      r = K.rows[i];
      if (f.rayon === 'none') { if (r.r >= 0) continue; }
      else if (f.rayon !== 'all' && String(r.r) !== f.rayon) continue;
      if (f.fam !== 'all' && r.o.f !== f.fam) continue;
      if (f.labo && r.o.labo !== f.labo) continue;
      if (f.stock && !(r.o.stock > 0)) continue;
      if (q && r.s.indexOf(q) < 0) continue;
      out.push(r);
    }
    return out;
  }
  // Parapharmacie : même principe, rayon Offilog (OFFILOG_CATS) et marque.
  function offCache() {
    if (pickOffCache) return pickOffCache;
    var O = window.OFFILOG_BEST; if (!O || !O.length) return null;
    var CATS = window.OFFILOG_CATS || {}, rows = [], nRay = {}, nMq = {}, i, b, ry;
    for (i = 0; i < O.length; i++) {
      b = O[i];
      ry = (b.id != null && CATS[String(b.id)]) || '';
      rows.push({ b: b, ry: ry, s: sansAccent((b.name || '') + ' ' + (b.brand || '') + ' ' + (b.ean || '')) });
      nRay[ry] = (nRay[ry] || 0) + 1;
      if (b.brand) nMq[b.brand] = (nMq[b.brand] || 0) + 1;
    }
    var rayons = Object.keys(nRay).filter(function (r) { return !!r; })
      .sort(function (a, b) { return nRay[b] - nRay[a]; })
      .map(function (r) { return { l: r, n: nRay[r] }; });
    var marques = Object.keys(nMq).sort(function (a, b) { return nMq[b] - nMq[a]; })
      .map(function (m) { return { l: m, n: nMq[m] }; });
    pickOffCache = { rows: rows, rayons: rayons, sansRayon: nRay[''] || 0, marques: marques, total: rows.length };
    return pickOffCache;
  }
  function offRows(q) {
    var K = offCache(); if (!K) return [];
    var out = [], i, r, f = pickF;
    for (i = 0; i < K.rows.length; i++) {
      r = K.rows[i];
      if (f.orayon === 'none') { if (r.ry) continue; }
      else if (f.orayon !== 'all' && r.ry !== f.orayon) continue;
      if (f.marque && r.b.brand !== f.marque) continue;
      if (q && r.s.indexOf(q) < 0) continue;
      out.push(r);
    }
    return out;
  }
  function mixRows(q) {
    var L = mixFlat(), out = [], i, b;
    for (i = 0; i < L.length; i++) {
      b = L[i];
      if (!q || sansAccent(b.name).indexOf(q) >= 0 || String(b.cip).indexOf(q) >= 0) out.push(b);
    }
    return out;
  }
  function pickRows(q) {
    return pickSrc === 'cat' ? pickCatRows(q) : (pickSrc === 'offilog' ? offRows(q) : mixRows(q));
  }
  // Clé d'un produit dans editing.products, selon l'univers (« déjà dans la fiche »).
  function pickKey(src, key) {
    return (src === 'cat' ? 'p' : (src === 'offilog' ? 'o' : (src === 'gros' ? 'g' : 'm'))) + key;
  }
  // L'objet produit de la fiche. Le catalogue passe par produitMkt : mêmes
  // règles de prix et d'abandon de marge que l'écran Produits, rayon en `cat`.
  function pickProduct(src, key) {
    if (src === 'cat') {
      return (V2.produits && V2.produits.produitMkt) ? V2.produits.produitMkt(String(key)) : null;
    }
    if (src === 'mix') {
      var L = mixFlat(), gm = null;
      for (var m = 0; m < L.length; m++) if (String(L[m].id) === String(key)) { gm = L[m]; break; }
      if (!gm) return null;
      return { src: 'mix', key: 'm' + gm.id, id: '', name: gm.name, brand: (gm.group === 'itp' ? 'ITP' : (gm.group === 'integral' ? 'L\'Intégral' : '')), ean: '', cip: gm.cip, price: gm.price, remise: gm.remise, ppht: gm.ppht || 0, img: '', froid: false, cat: gm.cat || '' };
    }
    if (src === 'offilog') {
      var O = window.OFFILOG_BEST || [], b = null;
      for (var i = 0; i < O.length; i++) if (String(O[i].id) === String(key)) { b = O[i]; break; }
      if (!b) return null;
      return { src: 'offilog', key: 'o' + b.id, id: b.id, name: b.name, brand: b.brand || '', ean: b.ean || '', cip: '', price: b.price || 0, remise: 0, ppht: 0, img: b.img || '', froid: false, cat: 'Parapharmacie' };
    }
    // 'gros' : plus proposé dans le sélecteur, gardé pour les fiches existantes
    var B = window.BENCHMARK || [], g = null;
    for (var j = 0; j < B.length; j++) if (String(B[j].cip13) === String(key)) { g = B[j]; break; }
    if (!g) return null;
    var _bpg = V2.bestPrice(g);
    return { src: 'gros', key: 'g' + g.cip13, id: '', name: g.designation, brand: '', ean: '', cip: String(g.cip13), price: _bpg.ip != null ? _bpg.ip : refPriceB(g), remise: _bpg.remise, ppht: _bpg.ht || 0, img: catImg(String(g.cip13)), froid: !!g.is_froid, cat: '' };
  }

  function pickerMarkup() {
    return '<div id="mkt-picker" class="mkt-pick-bd">' +
      '<div class="mkt-pick" onclick="event.stopPropagation()">' +
        '<span class="mkt-pick-grip" aria-hidden="true"></span>' +
        '<div class="mkt-pick-search">' + ICO('search', 21, 2) +
          '<input id="mkt-pick-input" placeholder="' + esc(pickPlaceholder()) + '" autocomplete="off">' +
          '<button class="mkt-prow-x" onclick="V2.mkt.closePicker()" aria-label="Fermer">' + ICO('close', 16, 2) + '</button></div>' +
        '<div class="mkt-pick-src" id="mkt-pick-src">' + pickTabs() + '</div>' +
        '<div class="mkt-pick-body">' +
          '<div class="mkt-pick-rail mkt-pick-strip" id="mkt-pick-rail"></div>' +
          '<div class="mkt-pick-main">' +
            '<div class="mkt-pick-bar">' +
              '<span class="mkt-pick-n mkt-pick-count" id="mkt-pick-n"></span>' +
              '<div class="mkt-pick-filters mkt-pick-strip" id="mkt-pick-filters"></div>' +
            '</div>' +
            '<div id="mkt-pick-list" class="mkt-pick-list"></div>' +
          '</div>' +
        '</div>' +
        '<div class="mkt-pick-foot" id="mkt-pick-foot"></div>' +
      '</div></div>';
  }
  function pickPlaceholder() {
    if (replaceIdx != null) return 'Choisir le produit de remplacement…';
    if (pickSrc === 'cat') return 'Rechercher (désignation, CIP, molécule, laboratoire)…';
    if (pickSrc === 'offilog') return 'Rechercher (nom, marque, EAN)…';
    return 'Rechercher (désignation, CIP)…';
  }
  function pickTabs() {
    var K = catCache(), O = offCache();
    function tab(k, label, n) {
      return '<button class="mkt-srcbtn' + (pickSrc === k ? ' on' : '') + '" data-src="' + k + '" onclick="V2.mkt.setPickSrc(\'' + k + '\')">' +
        label + (n ? '<i class="mkt-srcbtn-n"> (' + V2.fmtNum(n) + ')</i>' : '') + '</button>';
    }
    return tab('cat', 'Tous les produits', K ? K.total : CAT_TOTAL_ATTENDU) +
      tab('offilog', 'Parapharmacie', O ? O.total : 0) +
      tab('mix', 'Nos sélections', mixFlat().length);
  }
  // Chip de facette. Les valeurs passent par data-v (libellés avec
  // apostrophes ou esperluettes), jamais en argument inline.
  function pickChip(kind, v, label, n, on) {
    return '<button class="mkt-fchip' + (on ? ' on' : '') + '" data-v="' + esc(v) + '" onclick="V2.mkt.pickSet(\'' + kind + '\',this.getAttribute(\'data-v\'))">' +
      '<span>' + esc(label) + '</span><i>' + V2.fmtNum(n) + '</i></button>';
  }
  // Rail (bureau) / bande défilante (mobile) : LES RAYONS, rien d'autre.
  function pickRail() {
    var h = '', K, i, f = pickF;
    if (pickSrc === 'cat') {
      K = catCache(); if (!K) return '';
      h += '<div class="mkt-fac"><div class="mkt-fac-t">Rayon</div>' + pickChip('rayon', 'all', 'Tous les rayons', K.total, f.rayon === 'all');
      for (i = 0; i < K.rayons.length; i++) h += pickChip('rayon', String(K.rayons[i].i), K.rayons[i].l, K.rayons[i].n, f.rayon === String(K.rayons[i].i));
      if (K.sansRayon) h += pickChip('rayon', 'none', 'Sans rayon', K.sansRayon, f.rayon === 'none');
      h += '</div>';
    } else if (pickSrc === 'offilog') {
      K = offCache(); if (!K) return '';
      h += '<div class="mkt-fac"><div class="mkt-fac-t">Rayon Offilog</div>' + pickChip('orayon', 'all', 'Tous les rayons', K.total, f.orayon === 'all');
      for (i = 0; i < K.rayons.length; i++) h += pickChip('orayon', K.rayons[i].l, K.rayons[i].l, K.rayons[i].n, f.orayon === K.rayons[i].l);
      if (K.sansRayon) h += pickChip('orayon', 'none', 'Sans rayon', K.sansRayon, f.orayon === 'none');
      h += '</div>';
    }
    return h;
  }
  // Ligne compacte au-dessus des résultats, à côté du compteur : famille,
  // laboratoire, stock (catalogue) ; marque (parapharmacie).
  function pickFilters() {
    var h = '', K, i, f = pickF, FAMS, fk;
    if (pickSrc === 'cat') {
      K = catCache(); if (!K) return '';
      FAMS = (V2.produits && V2.produits.FAM) || {}; fk = Object.keys(FAMS);
      h += pickChip('fam', 'all', 'Toutes les familles', K.total, f.fam === 'all');
      for (i = 0; i < fk.length; i++) if (K.fam[fk[i]]) h += pickChip('fam', fk[i], FAMS[fk[i]].l, K.fam[fk[i]], f.fam === fk[i]);
      h += '<select class="mkt-fsel" id="mkt-pick-labo" aria-label="Laboratoire" onchange="V2.mkt.pickSet(\'labo\',this.value)"><option value="">Tous les laboratoires</option>';
      for (i = 0; i < K.labos.length; i++) h += '<option value="' + esc(K.labos[i].l) + '"' + (f.labo === K.labos[i].l ? ' selected' : '') + '>' + esc(K.labos[i].l) + ' (' + V2.fmtNum(K.labos[i].n) + ')</option>';
      h += '</select>';
      h += '<label class="mkt-fchk"><input type="checkbox" id="mkt-pick-stock"' + (f.stock ? ' checked' : '') + ' onchange="V2.mkt.pickSet(\'stock\',this.checked)"><span>En stock seulement</span></label>';
    } else if (pickSrc === 'offilog') {
      K = offCache(); if (!K) return '';
      h += '<select class="mkt-fsel" id="mkt-pick-marque" aria-label="Marque" onchange="V2.mkt.pickSet(\'marque\',this.value)"><option value="">Toutes les marques</option>';
      for (i = 0; i < K.marques.length; i++) h += '<option value="' + esc(K.marques[i].l) + '"' + (f.marque === K.marques[i].l ? ' selected' : '') + '>' + esc(K.marques[i].l) + ' (' + V2.fmtNum(K.marques[i].n) + ')</option>';
      h += '</select>';
    }
    return h;
  }
  function pickItemOpen(src, key, have, sk) {
    var k = pickKey(src, key);
    return '<div class="mkt-pick-item' + (have[k] ? ' added' : (pickSel[sk] ? ' sel' : '')) + '" onclick="V2.mkt.pickToggle(\'' + src + '\',\'' + esc(String(key)) + '\',this)">';
  }
  function pickItemClose() { return '<span class="mkt-pick-ck">' + ICO('check', 13, 3) + '</span></div>'; }
  function pickRowCat(r, have) {
    var o = r.o, cip = String(o.cip);
    var p = (V2.produits && V2.produits.produitMkt) ? V2.produits.produitMkt(cip) : null;
    var img = (window.MKT_IMG && window.MKT_IMG[cip]) || '';
    var sub = [o.labo, 'CIP ' + cip, rayonLibelle(r.r)].filter(function (x) { return !!x; }).join(' · ');
    return pickItemOpen('cat', cip, have, 'cat|' + cip) +
      (img ? '<span class="mkt-pick-img" style="background-image:url(' + esc(img) + ')"></span>' : '<span class="mkt-pick-ic">' + ICO('pill', 18, 1.7) + '</span>') +
      '<span class="mkt-pick-nm"><b>' + esc(o.d) + '</b><span>' + esc(sub) + '</span></span>' +
      (o.stock > 0 ? '' : '<span class="mkt-pick-rupt">rupture</span>') +
      '<span class="mkt-pick-pr mono">' + (p && p.price > 0 ? V2.fmtEur(p.price) : '') + '</span>' +
      pickItemClose();
  }
  function pickRowOff(r, have) {
    var b = r.b, id = String(b.id);
    var sub = [b.brand, r.ry].filter(function (x) { return !!x; }).join(' · ');
    return pickItemOpen('offilog', id, have, 'offilog|' + id) +
      (b.img ? '<span class="mkt-pick-img" style="background-image:url(' + esc(b.img) + ')"></span>' : '<span class="mkt-pick-img mkt-th-x"></span>') +
      '<span class="mkt-pick-nm"><b>' + esc(b.name) + '</b><span>' + esc(sub) + '</span></span>' +
      '<span class="mkt-pick-pr mono">' + (b.price > 0 ? V2.fmtEur(b.price) : '') + '</span>' +
      pickItemClose();
  }
  function pickRowMix(b, have) {
    var id = String(b.id);
    var tag = b.group === 'nr' ? 'NR / Para' : (b.group === 'rota' ? 'Top rotation France' : (b.group === 'best' ? 'Top ventes' : (b.group === 'itp' ? 'ITP' : 'L\'Intégral')));
    // chip à droite : VOLUME vendu en priorité, sinon marge (ITP)
    var chip = (b.vol > 0)
      ? '<span class="mkt-pick-sortie" title="volume vendu (unités)">' + V2.fmtNum(b.vol) + ' vendus</span>'
      : (b.group === 'itp' && b.marge > 0 ? '<span class="mkt-pick-sortie marge" title="marge par boîte">marge ' + V2.fmtEur(b.marge) + '</span>' : '');
    var subm = b.sortie > 0 ? ' · ' + b.sortie + '/' + b.total + ' pharm' : (b.cip ? ' · CIP ' + esc(b.cip) : ' · ' + esc(b.cat));
    return pickItemOpen('mix', id, have, 'mix|' + id) +
      '<span class="mkt-pick-ic">' + ICO('pill', 18, 1.7) + '</span>' +
      '<span class="mkt-pick-nm"><b>' + esc(b.name) + '</b><span>' + tag + subm + '</span></span>' +
      chip +
      '<span class="mkt-pick-pr mono">' + (b.price > 0 ? V2.fmtEur(b.price) : '') + '</span>' +
      pickItemClose();
  }
  function renderPickList() {
    var box = document.getElementById('mkt-pick-list'); if (!box || !editing) return;
    var cnt = document.getElementById('mkt-pick-n');
    if ((pickSrc === 'cat' && !catCache()) || (pickSrc === 'offilog' && !offCache())) {
      box.innerHTML = '<div class="mkt-empty" style="border:none">Le catalogue n\'a pas pu être chargé. Ferme le sélecteur et réessaie.</div>';
      if (cnt) cnt.textContent = '';
      pickFoot();
      return;
    }
    var q = pickQuery(), rows = pickRows(q), have = {}, html = '', i, n = rows.length, end = Math.min(n, pickShown);
    editing.products.forEach(function (p) { have[String(p.key)] = 1; });
    for (i = 0; i < end; i++) {
      html += pickSrc === 'cat' ? pickRowCat(rows[i], have) : (pickSrc === 'offilog' ? pickRowOff(rows[i], have) : pickRowMix(rows[i], have));
    }
    if (n > end) html += '<button class="v2-btn v2-btn-ghost mkt-pick-more" onclick="V2.mkt.pickMore()">Voir ' + Math.min(PICK_PAGE, n - end) + ' produits de plus</button>';
    var top = box.scrollTop;
    box.innerHTML = html || '<div class="mkt-empty" style="border:none">Aucun produit ne correspond à ces critères.</div>';
    box.scrollTop = pickShown > PICK_PAGE ? top : 0;
    if (cnt) cnt.textContent = V2.fmtNum(n) + ' produit' + (n > 1 ? 's' : '');
    pickFoot();
  }
  function pickFoot() {
    var foot = document.getElementById('mkt-pick-foot'); if (!foot) return;
    if (replaceIdx != null) {
      foot.innerHTML = '<span class="mkt-pick-nsel">Un clic sur un produit remplace celui de l\'aperçu.</span>' +
        '<button class="v2-btn v2-btn-ghost" onclick="V2.mkt.closePicker()">Fermer</button>';
      return;
    }
    var n = Object.keys(pickSel).length;
    foot.innerHTML =
      '<span class="mkt-pick-nsel">' + (n ? n + ' coché' + (n > 1 ? 's' : '') : 'Coche les produits à ajouter') + '</span>' +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.mkt.pickClearSel()"' + (n ? '' : ' disabled') + '>Tout décocher</button>' +
      '<button class="v2-btn v2-btn-primary" onclick="V2.mkt.pickAddSel()"' + (n ? '' : ' disabled') + '>' + ICO('plus', 16, 2) +
        'Ajouter ' + (n ? n + ' produit' + (n > 1 ? 's' : '') : 'les produits') + '</button>' +
      '<button class="v2-btn v2-btn-ghost" onclick="V2.mkt.closePicker()">Fermer</button>';
  }
  function renderPickAll() {
    var tabs = document.getElementById('mkt-pick-src'); if (tabs) tabs.innerHTML = pickTabs();
    var rail = document.getElementById('mkt-pick-rail');
    if (rail) { var top = rail.scrollTop; rail.innerHTML = pickRail(); rail.hidden = !rail.innerHTML; rail.scrollTop = top; }
    var flt = document.getElementById('mkt-pick-filters');
    if (flt) { var left = flt.scrollLeft; flt.innerHTML = pickFilters(); flt.hidden = !flt.innerHTML; flt.scrollLeft = left; }
    var inp = document.getElementById('mkt-pick-input'); if (inp) inp.placeholder = pickPlaceholder();
    renderPickList();
  }
  function wirePicker() {
    var bd = document.getElementById('mkt-picker'); if (!bd) return;
    bd.onclick = function () { closePicker(); };
    var inp = document.getElementById('mkt-pick-input');
    if (inp) {
      inp.addEventListener('input', function () {
        pickShown = PICK_PAGE;
        if (pickTimer) clearTimeout(pickTimer);
        pickTimer = setTimeout(renderPickList, 120);
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePicker(); });
    }
  }
  function pickSpinner(txt) {
    var box = document.getElementById('mkt-pick-list');
    if (box) box.innerHTML = '<div class="v2-loading" style="min-height:220px"><div class="v2-spinner"></div><div>' + esc(txt) + '</div></div>';
    var rail = document.getElementById('mkt-pick-rail'); if (rail) { rail.innerHTML = ''; rail.hidden = true; }
    var flt = document.getElementById('mkt-pick-filters'); if (flt) { flt.innerHTML = ''; flt.hidden = true; }
    var cnt = document.getElementById('mkt-pick-n'); if (cnt) cnt.textContent = '';
  }
  function ensureSrc(cb) {
    if (pickSrc === 'mix') { cb(); return; }   // window.MKT_MIX chargé via index.html
    if (pickSrc === 'offilog') {
      if (!window.OFFILOG_BEST || !window.OFFILOG_CATS) pickSpinner('La parapharmacie arrive…');
      ensureBest(function () {
        if (window.OFFILOG_CATS || !V2.loadFiles) { cb(); return; }
        V2.loadFiles(['offilogcats']).then(cb, cb);
      });
      return;
    }
    if (pickCatCache || (window.CATALOGUE_COMPLET && window.MKT_RAYONS) || !V2.loadFiles) { cb(); return; }
    pickSpinner('Les ' + V2.fmtNum(CAT_TOTAL_ATTENDU) + ' références arrivent (1,5 Mo, une seule fois)…');
    V2.loadFiles(['catcomplet', 'mktrayons']).then(cb, cb);
  }
  // idx (facultatif) : ouvert depuis la photo d'un produit de l'aperçu → le produit choisi REMPLACE celui-là
  function openPicker(idx) {
    replaceIdx = (typeof idx === 'number' && editing && editing.products[idx]) ? idx : null;
    // Les coches survivent à une fermeture (clic à côté du panneau) tant qu'on
    // reste sur la même fiche ; elles tombent en mode remplacement.
    if (replaceIdx != null || !editing || pickSelFor !== editing.id) pickSel = {};
    pickSelFor = editing ? editing.id : null;
    pickShown = PICK_PAGE;
    var bd = document.getElementById('mkt-picker'); if (!bd) return;
    bd.classList.add('open');
    // Le bouton flottant « + » de l'app (.v2-fab, z-index 9400) passerait
    // par-dessus le panneau et couvrirait « Fermer » sur iPhone.
    document.body.classList.add('mkt-picking');
    var inp = document.getElementById('mkt-pick-input');
    if (inp) { inp.value = ''; inp.placeholder = pickPlaceholder(); }
    ensureSrc(function () {
      renderPickAll();
      // Sur téléphone, le clavier couvrirait les rayons : pas de focus automatique.
      if (inp && window.innerWidth > 640) setTimeout(function () { inp.focus(); }, 60);
    });
  }
  function closePicker() {
    replaceIdx = null;
    document.body.classList.remove('mkt-picking');
    var bd = document.getElementById('mkt-picker'); if (bd) bd.classList.remove('open');
  }

  // ════════════════════════════════════════════
  // APERÇU + PDF (flyer)
  // ════════════════════════════════════════════
  // ── Un seul produit : une vraie fiche, pas un tableau d'une ligne ──
  // Demandé par Will : la fiche marketing doit marcher « pour un produit ou
  // plusieurs ». À N produits le tableau reste la bonne forme ; à un seul il
  // donne une feuille A4 vide avec une ligne au milieu. Ici la photo devient
  // grande, le prix devient l'objet de la page.
  function ficheProduitBody(p, acc, showPrice, showRemise, showImg, forPdf, edit) {
    var img = showImg ? prodImg(p, forPdf) : '';
    var ppht = p.ppht > 0 ? p.ppht
      : (p.remise > 0 && p.price > 0 ? Math.round(p.price / (1 - p.remise / 100) * 100) / 100 : 0);
    var pct = (ppht > 0 && p.price > 0 && p.price < ppht) ? Math.round((1 - p.price / ppht) * 1000) / 10 : 0;
    var visuel = img
      ? '<img crossorigin="anonymous" src="' + esc(img) + '" style="width:100%;height:100%;object-fit:contain">'
      : '<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#C6CEDC" stroke-width="1.4">' +
        '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L4 21"/></svg>';
    var ref = p.cip ? ('CIP ' + esc(p.cip)) : (p.ean ? ('EAN ' + esc(p.ean)) : '');
    var meta = [];
    if (p.brand) meta.push(esc(p.brand));
    if (p.cat) meta.push(esc(p.cat));
    if (p.froid) meta.push('Chaîne du froid');

    var lignesPrix = '';
    if (showPrice && ppht > 0 && pct > 0) {
      lignesPrix += '<div style="display:flex;justify-content:space-between;align-items:baseline;' +
        'padding:7px 0;border-bottom:1px solid #ECEFF5">' +
        '<span style="font-size:11.5px;color:#737A8C">Tarif grossiste (PPHT)</span>' +
        '<span style="font-family:monospace;font-size:14px;color:#9AA1B2;text-decoration:line-through">' +
        V2.fmtEur(ppht) + '</span></div>';
      if (showRemise) {
        lignesPrix += '<div style="display:flex;justify-content:space-between;align-items:baseline;' +
          'padding:7px 0;border-bottom:1px solid #ECEFF5">' +
          '<span style="font-size:11.5px;color:#737A8C">Abandon de marge Intégral</span>' +
          '<span style="font-family:monospace;font-size:14px;font-weight:700;color:#1E9E6A">−' +
          String(pct).replace('.', ',') + ' % · ' + V2.fmtEur(Math.round((ppht - p.price) * 100) / 100) +
          '</span></div>';
      }
    }
    var bloc = showPrice
      ? '<div style="margin-top:18px;background:#F7F9FC;border:1px solid #E2E7F0;border-radius:14px;padding:16px 18px">' +
          lignesPrix +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;padding-top:12px">' +
            '<span style="font-size:12.5px;font-weight:700;color:#10131C">Votre prix net HT</span>' +
            '<span style="font-family:monospace;font-size:34px;font-weight:800;letter-spacing:-.02em;color:' + acc + '"' + zoneAttrs(edit, 'price', 'Prix net HT', { i: 0, ph: '0,00 €' }) + '>' +
              (p.price > 0 ? V2.fmtEur(p.price) : (edit ? '' : '—')) + '</span>' +
          '</div></div>'
      : '';

    return '<div style="display:flex;gap:26px;align-items:flex-start;background:#fff;' +
        'border:1px solid #E2E7F0;border-radius:16px;padding:24px 26px">' +
        '<div style="flex:0 0 210px;height:210px;border-radius:12px;background:#FBFCFE;' +
          'border:1px solid #EEF1F7;display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box"' +
          zoneAttrs(edit, 'photo', 'Photo · cliquer pour changer', { i: 0, click: true }) + '>' +
          visuel + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:22px;font-weight:800;line-height:1.15;letter-spacing:-.01em;color:#10131C"' + zoneAttrs(edit, 'pname', 'Nom du produit', { i: 0, ph: 'Produit' }) + '>' +
            (edit ? esc(p.name || '') : esc(p.name || 'Produit')) + '</div>' +
          (meta.length ? '<div style="margin-top:7px;font-size:12.5px;color:#737A8C">' + meta.join(' · ') + '</div>' : '') +
          (ref ? '<div style="margin-top:5px;font-family:monospace;font-size:11.5px;color:#9AA1B2">' + ref + '</div>' : '') +
          bloc +
        '</div>' +
      '</div>';
  }

  // forPdf : images via proxy + jamais d'abandon de marge. edit : zones modifiables (aperçu de l'éditeur seulement).
  function buildFlyerHtml(forPdf, edit) {
    var it = editing;
    edit = !forPdf && edit === true;
    var md = modele(it), band = md.head === 'band';
    var t = TYPES[it.type] || TYPES.support;
    var title = (it.title && it.title.trim()) ? it.title.trim() : t.plural;
    var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    var th = it.theme || defaultTheme(it.type);
    var acc = th.accent || '#0050E6';
    var grad = 'linear-gradient(120deg,' + acc + ' 0%,' + darken(acc, 0.6) + ' 100%)';
    var bg = th.bg || '#FFFFFF';
    // À l'impression (PDF client) on ne communique JAMAIS l'abandon de marge, quel que soit le toggle.
    var showPrice = th.showPrice !== false, showRemise = (th.showRemise !== false) && !forPdf;
    var showImg = th.showImg !== false;
    var anyImg = showImg && (it.products || []).some(function (p) { return p.img; });
    var cols = (anyImg ? 1 : 0) + 3 + (showPrice ? 2 : 0) + (showRemise ? 1 : 0);
    function prodTr(p, n) {
      var img = prodImg(p, forPdf), idx = (it.products || []).indexOf(p);
      var ph = '<div style="width:34px;height:34px;border-radius:6px;background:#F1F4F9;display:flex;align-items:center;justify-content:center">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B6BFCE" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L4 21"/></svg></div>';
      var thumb = anyImg
        ? '<td style="padding:6px 8px;width:40px;text-align:center"' + zoneAttrs(edit, 'photo', 'Photo', { i: idx, click: true, quiet: true }) + '>' + (img ? '<img crossorigin="anonymous" src="' + esc(img) + '" style="width:34px;height:34px;object-fit:contain;border-radius:6px;background:#FBFCFE">' : ph) + '</td>'
        : '';
      var ref = p.cip ? esc(p.cip) : (p.ean ? esc(p.ean) : '—');
      // PPHT connu, sinon reconstitué depuis la remise portée par le produit. 0 = NR/prix libre → net seul.
      var ppht = p.ppht > 0 ? p.ppht : (p.remise > 0 && p.price > 0 ? Math.round(p.price / (1 - p.remise / 100) * 100) / 100 : 0);
      var pct = (ppht > 0 && p.price > 0 && p.price < ppht) ? Math.round((1 - p.price / ppht) * 1000) / 10 : 0;
      var pphtCell = pct > 0 ? '<span style="text-decoration:line-through;color:#B6BFCE">' + V2.fmtEur(ppht) + '</span>' : '—';
      var remCell = pct > 0 ? '−' + String(pct).replace('.', ',') + ' %' : '—';
      return '<tr style="border-bottom:1px solid #ECEFF5;page-break-inside:avoid">' + thumb +
        '<td style="padding:7px 10px;text-align:center;font-size:9px;color:#9AA1B2;font-family:monospace;width:24px">' + n + '</td>' +
        '<td style="padding:7px 10px;font-size:11.5px;font-weight:600;color:#10131C"><span' + zoneAttrs(edit, 'pname', 'Nom', { i: idx, quiet: true }) + '>' + esc(edit ? (p.name || '') : (p.name || '').slice(0, 62)) + '</span>' +
          (p.brand ? ' <span style="color:#9AA1B2;font-weight:500">· ' + esc(p.brand) + '</span>' : '') +
          (p.froid ? ' <span style="font-size:7.5px;color:#00B5D8;border:1px solid #b8edf7;border-radius:4px;padding:0 3px;vertical-align:middle">FROID</span>' : '') + '</td>' +
        '<td style="padding:7px 10px;font-family:monospace;font-size:10px;color:#737A8C">' + ref + '</td>' +
        (showPrice ? '<td style="padding:7px 10px;text-align:right;font-family:monospace;font-size:10.5px">' + pphtCell + '</td>' : '') +
        (showRemise ? '<td style="padding:7px 10px;text-align:right;font-family:monospace;font-size:10.5px;font-weight:700;color:' + (pct > 0 ? '#1E9E6A' : '#B6BFCE') + '">' + remCell + '</td>' : '') +
        (showPrice ? '<td style="padding:7px 10px;text-align:right;font-family:monospace;font-size:12.5px;font-weight:800;color:' + acc + '"><span' + zoneAttrs(edit, 'price', 'Prix net HT', { i: idx, quiet: true }) + '>' + (p.price > 0 ? V2.fmtEur(p.price) : (edit ? '' : '—')) + '</span></td>' : '') +
      '</tr>';
    }
    // regroupe par catégorie (ordre d'apparition) ; sous-titres si plusieurs catégories
    var order = [], gmap = {};
    (it.products || []).forEach(function (p) {
      var c = ((p.cat || '').trim()) || '—';
      if (!gmap[c]) { gmap[c] = []; order.push(c); }
      gmap[c].push(p);
    });
    var hasCats = order.length > 1 || (order.length === 1 && order[0] !== '—');
    var rows = '', nn = 0;
    order.forEach(function (c) {
      if (hasCats) {
        rows += '<tr><td colspan="' + cols + '" style="padding:10px 10px 5px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:' + acc + ';background:#F4F6FB;border-top:1px solid #E2E7F0">' +
          esc(c === '—' ? 'Autres' : c) + ' <span style="color:#9AA1B2;font-weight:600">· ' + gmap[c].length + '</span></td></tr>';
      }
      gmap[c].forEach(function (p) { nn++; rows += prodTr(p, nn); });
    });
    function thh(lbl, al) { return '<th style="padding:6px 10px;text-align:' + al + ';font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#9AA1B2">' + lbl + '</th>'; }
    var unSeul = (it.products || []).length === 1;
    var body = unSeul
      ? ficheProduitBody(it.products[0], acc, showPrice, showRemise, showImg, forPdf, edit)
      : rows
      ? '<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden">' +
          '<thead><tr style="background:#F7F9FC;border-bottom:1.5px solid #E2E7F0">' +
            (anyImg ? '<th></th>' : '') + thh('#', 'center') + thh('Produit', 'left') + thh('Réf (CIP/EAN)', 'left') +
            (showPrice ? thh('PPHT', 'right') : '') + (showRemise ? thh('Abandon', 'right') : '') + (showPrice ? thh('Net IP', 'right') : '') +
          '</tr></thead><tbody>' + rows + '</tbody></table>'
      : '<div style="text-align:center;color:#9AA1B2;font-size:13px;padding:40px">Aucun produit.</div>';
    var footDefaut = 'Prix nets HT indicatifs · ' + dateStr;
    var footer = (it.footer && it.footer.trim()) ? esc(it.footer.trim()) : esc(footDefaut);
    // ── En-tête selon le modèle : bandeau plein (band), filet de couleur (slim), sobre (plain) ──
    var ink = band ? '#fff' : '#10131C', mut = band ? 'rgba(255,255,255,.85)' : '#737A8C', accroCol = band ? 'rgba(255,255,255,.95)' : '#4A5164';
    var wrapStyle = band
      ? 'background:' + grad + ';border-radius:18px;padding:26px 30px;color:#fff;margin-bottom:22px;position:relative;overflow:hidden'
      : (md.head === 'slim'
        ? 'border-top:6px solid ' + acc + ';padding:18px 0 16px;margin-bottom:22px;border-bottom:1px solid #E2E7F0;position:relative'
        : 'padding:4px 0 18px;margin-bottom:22px;border-bottom:1px solid #E2E7F0;position:relative');
    var tagPill = md.tag
      ? '<span style="display:inline-block;margin-left:10px;padding:3px 9px;border-radius:999px;background:' + (band ? 'rgba(255,255,255,.22)' : acc) + ';color:#fff;font-size:10px;font-weight:800;letter-spacing:.1em;vertical-align:middle">' + esc(md.tag.toUpperCase()) + '</span>'
      : '';
    var accroHtml = edit
      ? '<div style="font-size:13.5px;color:' + accroCol + ';margin-top:9px;max-width:560px;min-height:17px"' + zoneAttrs(edit, 'accroche', 'Accroche', { light: band, ph: 'Accroche / message (facultatif)' }) + '>' + esc((it.accroche || '').trim()) + '</div>'
      : (it.accroche && it.accroche.trim() ? '<div style="font-size:13.5px;color:' + accroCol + ';margin-top:9px;max-width:560px">' + esc(it.accroche.trim()) + '</div>' : '');
    var nbTxt = (it.products || []).length + ' produit' + ((it.products || []).length > 1 ? 's' : '') + ' · ' + esc(dateStr);
    var header = '<div style="' + wrapStyle + '">' +
        (band ? '<div style="position:absolute;right:-30px;top:-30px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.12)"></div>' : '') +
        '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:' + (band ? 'rgba(255,255,255,.9)' : acc) + '">Intégral Pharma · ' + esc(t.label) + tagPill + '</div>' +
        '<div style="font-size:30px;font-weight:800;letter-spacing:-.02em;margin-top:8px;line-height:1.05;color:' + ink + ';min-height:32px"' + zoneAttrs(edit, 'title', 'Titre', { light: band, ph: t.plural }) + '>' + (edit ? esc(it.title || '') : esc(title)) + '</div>' +
        accroHtml +
        '<div style="font-size:12px;color:' + mut + ';margin-top:9px">' + nbTxt + '</div>' +
      '</div>';
    return '<div style="font-family:Satoshi,Inter,Arial,sans-serif;width:794px;box-sizing:border-box;padding:36px 38px;background:' + bg + ';color:#10131C;position:relative">' +
        header +
        '<div>' + body + '</div>' +
        '<div style="margin-top:26px;padding-top:14px;border-top:1px solid rgba(16,19,28,.1);display:flex;justify-content:space-between;gap:14px;font-size:9px;color:#737A8C;text-transform:uppercase;letter-spacing:.05em">' +
          '<span>Intégral Pharma · ' + esc(t.plural) + '</span><span style="text-align:right;min-width:140px"' + zoneAttrs(edit, 'footer', 'Mentions', { ph: footDefaut }) + '>' + (edit ? esc((it.footer || '').trim()) : footer) + '</span></div>' +
      '</div>';
  }
  // ── Panneau de personnalisation (charte) ──
  function personalizePanel() {
    var th = editing.theme || defaultTheme(editing.type);
    var accSw = ACCENTS.map(function (c) {
      return '<button class="mkt-sw mkt-sw-acc' + (th.accent === c ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '" onclick="V2.mkt.setAccent(\'' + c + '\')"></button>';
    }).join('');
    var bgSw = BGS.map(function (c) {
      return '<button class="mkt-sw mkt-sw-bg' + (th.bg === c ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '" onclick="V2.mkt.setBg(\'' + c + '\')"></button>';
    }).join('');
    return '<div class="mkt-chips">' +
        '<button class="mkt-tg' + (th.showPrice !== false ? ' on' : '') + '" onclick="V2.mkt.toggle(\'showPrice\',this)">Prix</button>' +
        '<button class="mkt-tg' + (th.showRemise !== false ? ' on' : '') + '" onclick="V2.mkt.toggle(\'showRemise\',this)">Abandon</button>' +
        '<button class="mkt-tg' + (th.showImg !== false ? ' on' : '') + '" onclick="V2.mkt.toggle(\'showImg\',this)">Photos</button>' +
      '</div>' +
      '<div class="mkt-sws" style="margin-top:10px">' + accSw +
        '<label class="mkt-sw mkt-sw-pick" title="Couleur libre"><input type="color" value="' + esc(th.accent) + '" oninput="V2.mkt.setAccent(this.value)"></label></div>' +
      '<div class="mkt-sws" style="margin-top:8px">' + bgSw +
        '<label class="mkt-sw mkt-sw-pick" title="Fond libre"><input type="color" value="' + esc(th.bg) + '" oninput="V2.mkt.setBg(this.value)"></label></div>' +
      '<div class="mkt-field" style="margin-top:12px"><label for="mkt-footer">Mentions en pied</label>' +
        '<input class="mkt-foot" id="mkt-footer" type="text" placeholder="ex : Offre valable jusqu\'au 31/07 · contact@integralpharma.fr" value="' + esc(editing.footer || '') + '" oninput="V2.mkt.setFooter(this.value)"></div>';
  }
  // aperçu live inline (toujours visible dans l'éditeur)
  function refreshPreview() {
    var sh = document.getElementById('mkt-msheet'); if (!sh || !editing) return;
    sh.innerHTML = buildFlyerHtml(false, true); // false = images via URL réseau (écran) · true = zones modifiables
    fitSheet();
    waitImages(sh, 6000).then(fitSheet);
    wireZones(sh);
  }
  // ── Zones modifiables de l'aperçu (assistant guidé) : on écrit dans `editing` sans
  // reconstruire l'aperçu (sinon le curseur saute), et on recopie dans le formulaire.
  function syncField(id, v) { var f = document.getElementById(id); if (f && f.value !== v) f.value = v; }
  function wireZones(sh) {
    // Téléphone : la feuille est réduite (transform:scale) et ses textes font moins de 16 px —
    // Safari iOS zoome et place mal le curseur au focus. On repasse à l'échelle 1 le temps de la saisie.
    if (!sh._zoneFocusWired) {
      sh._zoneFocusWired = true;
      sh.addEventListener('focusin', function (e) {
        if (window.innerWidth > 640 || !e.target.classList || !e.target.classList.contains('mkt-zone')) return;
        sh.style.transform = 'none';
        var ho = document.getElementById('mkt-mholder'); if (ho) { ho.style.width = '794px'; ho.style.height = 'auto'; }
        try { e.target.scrollIntoView({ block: 'center', inline: 'center' }); } catch (err) {}
      });
      sh.addEventListener('focusout', function (e) {
        if (window.innerWidth > 640 || !e.target.classList || !e.target.classList.contains('mkt-zone')) return;
        fitSheet();
      });
    }
    Array.prototype.forEach.call(sh.querySelectorAll('[data-zone]'), function (el) {
      var z = el.getAttribute('data-zone'), i = parseInt(el.getAttribute('data-i') || '0', 10);
      if (z === 'photo') {
        el.addEventListener('click', function () { openPicker(i); });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(i); } });
        return;
      }
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
      el.addEventListener('input', function () {
        if (z === 'price') return; // validé à la sortie du champ
        var v = (el.innerText || '').replace(/\s*\n+\s*/g, ' ').replace(/^\s+/, '');
        if (!v.trim() && el.innerHTML) el.innerHTML = ''; // vide « propre » pour que le texte d'aide réapparaisse
        if (z === 'title') { editing.title = v; syncField('mkt-title', v); }
        else if (z === 'accroche') { editing.accroche = v; syncField('mkt-accroche', v); }
        else if (z === 'footer') { editing.footer = v; syncField('mkt-footer', v); }
        else if (z === 'pname' && editing.products[i]) {
          editing.products[i].name = v;
          var inp = document.querySelectorAll('.mkt-prow-namei')[i]; if (inp && inp.value !== v) inp.value = v;
        }
        fitSheet();
      });
      if (z === 'price') el.addEventListener('blur', function () {
        var p = editing.products[i]; if (!p) return;
        var n = parseFloat((el.innerText || '').replace(/[^\d,.\-]/g, '').replace(',', '.'));
        p.price = isNaN(n) || n < 0 ? 0 : Math.round(n * 100) / 100;
        var inp = document.querySelectorAll('.mkt-prow-f input')[i * 2]; if (inp) inp.value = p.price || '';
        refreshPreview();
      });
    });
  }

  function previewMarkup() {
    return '<div id="mkt-modal" class="mkt-modal">' +
      '<div class="mkt-dialog" onclick="event.stopPropagation()">' +
        '<div class="mkt-mtop"><div class="mkt-mtt">' + ICO('grid', 17, 2) + ' Aperçu du support</div>' +
          '<button class="v2-btn v2-btn-primary" id="mkt-dl">' + ICO('download', 16, 2) + ' Télécharger le PDF</button>' +
          '<button class="mkt-mx" onclick="V2.mkt.closePreview()">' + ICO('close', 18, 2) + '</button></div>' +
        '<div class="mkt-mscroll" id="mkt-mscroll"><div class="mkt-mholder" id="mkt-mholder"><div class="mkt-msheet" id="mkt-msheet"></div></div></div>' +
      '</div></div>';
  }
  function fitSheet() {
    var sc = document.getElementById('mkt-mscroll'), ho = document.getElementById('mkt-mholder'), sh = document.getElementById('mkt-msheet');
    if (!sc || !ho || !sh) return;
    var avail = sc.clientWidth - 48; if (avail <= 0) return;
    var scale = Math.min(1, avail / 794);
    sh.style.transform = 'scale(' + scale + ')';
    var h = sh.firstChild ? sh.firstChild.offsetHeight : sh.offsetHeight;
    ho.style.width = (794 * scale) + 'px'; ho.style.height = (h * scale) + 'px';
  }
  function waitImages(node, timeout) {
    var imgs = Array.prototype.slice.call(node.querySelectorAll('img'));
    if (!imgs.length) return Promise.resolve();
    return new Promise(function (resolve) {
      var left = imgs.length, done = false;
      function fin() { if (!done) { done = true; resolve(); } }
      var to = setTimeout(fin, timeout || 9000);
      function tick() { if (--left <= 0) { clearTimeout(to); fin(); } }
      imgs.forEach(function (im) { if (im.complete && im.naturalWidth > 0) { tick(); return; } im.addEventListener('load', tick); im.addEventListener('error', tick); });
    });
  }

  // ════════════════════════════════════════════
  // API PUBLIQUE
  // ════════════════════════════════════════════
  V2.mkt = {
    create: function (type) { editing = null; V2.go('marketing', type === 'selection' ? 'new-selection' : 'new-support'); },
    // Une tuile du tiroir « Modèles », depuis l'accueil : crée directement un support sur ce modèle.
    createWith: function (k) {
      var m = null; for (var i = 0; i < MODELES.length; i++) if (MODELES[i].k === k) m = MODELES[i];
      editing = { id: newId(), type: 'support', title: '', accroche: '', footer: '', status: 'brouillon', products: [],
                  theme: Object.assign(defaultTheme('support'), { tpl: k || 'promo', accent: (m && m.accent) || undefined }),
                  owner: (V2.user && V2.user.email) || '', _new: 'support' };
      V2.go('marketing', 'new-support');
    },
    // Une chip « Rayons » de l'accueil : sélection neuve, sélecteur ouvert direct sur ce rayon.
    createFromRayon: function (i) {
      editing = { id: newId(), type: 'selection', title: '', accroche: '', footer: '', status: 'brouillon', products: [],
                  theme: defaultTheme('selection'), owner: (V2.user && V2.user.email) || '', _new: 'selection' };
      for (var j = 0; j < MODELES.length; j++) if (MODELES[j].k === 'selection') editing.theme.accent = MODELES[j].accent;
      editing.theme.tpl = 'selection';
      pickSrc = 'cat'; pickF = pickFiltresVides(); pickF.rayon = String(i); pickOpenOnRender = true;
      V2.go('marketing', 'new-selection');
    },
    open: function (id) { editing = null; V2.go('marketing', id); },
    // Changer de modèle depuis l'éditeur : la feuille bascule sur sa tranche, change de peau, revient.
    setModele: function (k) {
      if (!editing) return;
      var m = null; for (var i = 0; i < MODELES.length; i++) if (MODELES[i].k === k) m = MODELES[i];
      if (!m) return;
      editing.theme = editing.theme || defaultTheme(editing.type);
      if (editing.theme.tpl !== m.k) editing.theme.accent = m.accent; // la couleur suit le modèle, reste modifiable ensuite
      var apply = function () {
        editing.theme.tpl = k;
        Array.prototype.forEach.call(document.querySelectorAll('.mkt-mtile'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-model') === k ? 'true' : 'false'); });
        Array.prototype.forEach.call(document.querySelectorAll('.mkt-sw-acc'), function (el) { el.classList.toggle('on', el.getAttribute('data-c') === m.accent); });
        refreshPreview();
      };
      var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      var holder = document.getElementById('mkt-mholder');
      if (reduce || !holder || V2._mktTurning) { apply(); return; }
      V2._mktTurning = true;
      holder.classList.add('mkt-turn');
      setTimeout(function () { apply(); holder.classList.remove('mkt-turn'); setTimeout(function () { V2._mktTurning = false; }, 340); }, 330);
    },
    setProd: function (i, field, v) {
      if (!editing || !editing.products[i]) return;
      var p = editing.products[i];
      if (field === 'name') p.name = v;
      else if (field === 'price') p.price = (v === '' ? 0 : (parseFloat(String(v).replace(',', '.')) || 0));
      else if (field === 'remise') p.remise = (v === '' ? 0 : (parseFloat(String(v).replace(',', '.')) || 0));
      else if (field === 'cat') p.cat = v;
      refreshPreview();   // n'écrase pas la ligne en cours d'édition (pas de refreshProducts)
    },
    addCustom: function () {
      if (!editing) return;
      editing.products.push({ src: 'custom', key: 'c' + Date.now() + Math.round(Math.random() * 999),
        id: '', name: '', brand: '', ean: '', cip: '', price: 0, remise: 0, ppht: 0, img: '', froid: false });
      refreshProducts();
      setTimeout(function () { var inp = document.querySelectorAll('.mkt-prow-namei'); if (inp.length) inp[inp.length - 1].focus(); }, 40);
    },
    setTitle: function (v) { if (editing) { editing.title = v; refreshPreview(); } },
    setAccroche: function (v) { if (editing) { editing.accroche = v; refreshPreview(); } },
    setFooter: function (v) { if (editing) { editing.footer = v; refreshPreview(); } },
    setAccent: function (c) {
      if (!editing) return; editing.theme = editing.theme || defaultTheme(editing.type); editing.theme.accent = c;
      Array.prototype.forEach.call(document.querySelectorAll('.mkt-sw-acc'), function (el) { el.classList.toggle('on', el.getAttribute('data-c') === c); });
      refreshPreview();
    },
    setBg: function (c) {
      if (!editing) return; editing.theme = editing.theme || defaultTheme(editing.type); editing.theme.bg = c;
      Array.prototype.forEach.call(document.querySelectorAll('.mkt-sw-bg'), function (el) { el.classList.toggle('on', el.getAttribute('data-c') === c); });
      refreshPreview();
    },
    toggle: function (key, btn) {
      if (!editing) return; editing.theme = editing.theme || defaultTheme(editing.type);
      editing.theme[key] = editing.theme[key] === false ? true : false;
      if (btn) btn.classList.toggle('on', editing.theme[key] !== false);
      refreshPreview();
    },
    setStatus: function (k, btn) {
      if (!editing) return; editing.status = k;
      Array.prototype.forEach.call(document.querySelectorAll('.mkt-seg button'), function (b) { b.setAttribute('aria-pressed', 'false'); });
      if (btn) btn.setAttribute('aria-pressed', 'true');
    },
    catSrc: function (s) { catSrc = s; V2.render(); },
    catAdd: function (fi) {
      var row = catRows[fi]; if (!row) return;
      var key = String(row.cip || row.d);
      var at = -1; for (var i = 0; i < catSel.length; i++) { if (catSel[i].key === key) { at = i; break; } }
      if (at >= 0) catSel.splice(at, 1);
      else catSel.push({ src: 'cat', key: key, id: '', name: row.d, brand: '', ean: '', cip: row.cip ? String(row.cip) : '', price: row.p || 0, remise: 0, ppht: 0, img: row.img || '', froid: !!row.froid, cat: row.cat || '' });
      var on = at < 0;
      var btn = document.getElementById('mkt-ca-' + fi);
      if (btn) { btn.classList.toggle('on', on); btn.title = on ? 'Retirer de ma sélection' : 'Ajouter à une fiche'; btn.innerHTML = ICO(on ? 'check' : 'plus', 15, 2.4); }
      updateCatBar();
    },
    catClear: function () { catSel = []; V2.render(); },
    catBuildFiche: function () {
      if (!catSel.length) { V2.toast('Coche au moins un produit (+)', 'warn'); return; }
      editing = { id: newId(), type: 'selection', title: '', accroche: '', footer: '', status: 'brouillon',
                  products: catSel.map(function (p) { return Object.assign({}, p); }),
                  theme: defaultTheme('selection'), owner: (V2.user && V2.user.email) || '', _new: 'selection' };
      catSel = [];
      V2.go('marketing', 'new-selection');
    },
    catSort: function (mode) { catSortBy = (mode === 'vol') ? 'vol' : 'pharma'; V2.render(); },
    catPerCat: function (n) { catPerCat = (+n) || 0; V2.render(); },
    // Recherche live dans le catalogue : filtre le DOM (garde le focus, pas de re-render)
    catFilter: function (v) {
      catQuery = String(v == null ? '' : v);
      var q = catQuery.trim().toLowerCase();
      var input = document.getElementById('mkt-cat-search');
      if (input && input.value !== catQuery) input.value = catQuery;
      var x = document.querySelector('.mkt-search-x'); if (x) x.style.display = q ? '' : 'none';
      var cards = document.querySelectorAll('.v2-card[data-catcard]'), shownTot = 0;
      Array.prototype.forEach.call(cards, function (card) {
        var shown = 0, trs = card.querySelectorAll('tbody tr');
        Array.prototype.forEach.call(trs, function (tr) {
          var hit = !q || (tr.getAttribute('data-s') || '').indexOf(q) !== -1;
          tr.style.display = hit ? '' : 'none'; if (hit) shown++;
        });
        card.style.display = shown ? '' : 'none';
        var cnt = card.querySelector('.mkt-cat-count'); if (cnt) cnt.textContent = '· ' + shown;
        shownTot += shown;
      });
      var nores = document.getElementById('mkt-cat-nores'); if (nores) nores.style.display = (q && shownTot === 0) ? '' : 'none';
    },
    // Créer une sélection depuis un autre pilier (ex: le catalogue « Par produit »)
    newSelection: function (title, accroche, products) {
      editing = { id: newId(), type: 'selection', title: title || 'Sélection', accroche: accroche || '',
        footer: '', status: 'brouillon', products: (products || []).map(function (p) { return Object.assign({}, p); }),
        theme: defaultTheme('selection'), owner: (V2.user && V2.user.email) || '', _new: 'selection' };
      V2.go('marketing', 'new-selection');
    },
    // Liste parfaite d'une catégorie = produits les plus commandés (nb pharmacies), au prix de l'établissement choisi
    catList: function (catName) {
      var M = window.MKT_MIX || {};
      var srcMap = { nr: 'nr', integral: 'integral', itp: 'itp', best: 'bestsellers' };
      var data = (catSrc === 'nrreal') ? ((window.MKT_NR && window.MKT_NR.cats) || []) : (M[srcMap[catSrc] || 'nr'] || []);
      var c = null; for (var i = 0; i < data.length; i++) { if (data[i].cat === catName) { c = data[i]; break; } }
      if (!c) { V2.toast('Catégorie introuvable', 'warn'); return; }
      var rows = (c.rows || []).filter(function (r) {
        if (!(mktEtab && etabStockOnly)) return true;
        var er = etabRec(r.cip); return !!(er && er[1] > 0);
      });
      rows.sort(function (a, b) { return (b.sortie || 0) - (a.sortie || 0) || (b.vol || 0) - (a.vol || 0); });
      rows = rows.slice(0, 20);
      if (!rows.length) { V2.toast('Aucun produit en stock pour cette catégorie', 'warn'); return; }
      var products = rows.map(function (r) {
        var er = etabRec(r.cip); var price = (er && er[0] > 0) ? er[0] : (r.p || 0);
        return { src: 'cat', key: String(r.cip || r.d), id: '', name: r.d, brand: '', ean: '',
                 cip: r.cip ? String(r.cip) : '', price: price, remise: 0, ppht: 0, img: catImg(r.cip) || '', froid: false, cat: catName };
      });
      var suffix = mktEtab ? ' · ' + mktEtab : '';
      editing = { id: newId(), type: 'selection', title: catName + ' — top pharmacies' + suffix,
                  accroche: 'Les ' + products.length + ' produits « ' + catName + ' » les plus commandés par les pharmacies' + (mktEtab ? ' (prix ' + mktEtab + ')' : '') + '.',
                  footer: '', status: 'brouillon', products: products, theme: defaultTheme('selection'),
                  owner: (V2.user && V2.user.email) || '', _new: 'selection' };
      V2.go('marketing', 'new-selection');
    },
    catPdf: function (srcKey) {
      if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
      var M = window.MKT_MIX || {};
      var map = { nrreal: ['', 'Sélection hors-remboursable — nos meilleures ventes'], nr: ['nr', 'Catalogue NR — non remboursable & parapharmacie'], rota: ['rotations', 'Top rotations France'],
        integral: ['integral', 'Catalogue L\'Intégral'], itp: ['itp', 'Pansements & dispositifs ITP'], best: ['bestsellers', 'Top ventes par famille'] };
      var conf = map[srcKey] || map.nr;
      var data = (srcKey === 'nrreal') ? ((window.MKT_NR && window.MKT_NR.cats) || []) : (M[conf[0]] || []);
      if (!data.length) { V2.toast('Catalogue vide', 'warn'); return; }
      var isItp = (srcKey === 'itp');
      var byPharma = (catSortBy === 'pharma') && srcKey !== 'nrreal';   // NR réel : pas de « nb pharmacies », on classe par volume
      var perCat = catPerCat;   // 0 = tous
      var dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      var e2 = function (v) { return (v ? (+v).toFixed(2).replace('.', ',') : '—') + (v ? ' €' : ''); };
      V2.toast('Génération du PDF…');
      var secs = data.map(function (c) {
        var rows = (c.rows || []).filter(function (r) { if (!(mktEtab && etabStockOnly)) return true; var er = etabRec(r.cip); return !!(er && er[1] > 0); });
        rows = rows.slice();
        rows.sort(byPharma
          ? function (a, b) { return (b.sortie || 0) - (a.sortie || 0) || (b.vol || 0) - (a.vol || 0); }
          : function (a, b) { return (b.vol || 0) - (a.vol || 0); });
        if (perCat > 0) rows = rows.slice(0, perCat);
        if (!rows.length) return '';
        var trs = rows.map(function (r, i) {
          var er = etabRec(r.cip); var pv = (er && er[0] > 0) ? er[0] : r.p; var stk = er ? er[1] : null;
          var metric = isItp
            ? '<td style="padding:3px 6px;text-align:right;font-family:monospace;font-size:9.5px;color:#1E9E6A;font-weight:700">' + (r.marge ? e2(r.marge) : '—') + '</td>'
            : '<td style="padding:3px 6px;text-align:right;font-family:monospace;font-size:9.5px;font-weight:800">' + (byPharma ? ((r.sortie || 0) + '<span style="color:#9AA1B2;font-weight:500">/' + (r.total || M.total || '') + '</span>') : (r.vol > 0 ? r.vol.toLocaleString('fr') : '—')) + '</td>';
          var stockTd = mktEtab ? '<td style="padding:3px 6px;text-align:right;font-family:monospace;font-size:9.5px;font-weight:700;color:' + (stk > 0 ? '#1E9E6A' : '#E0556E') + '">' + (stk != null ? stk : '—') + '</td>' : '';
          return '<tr style="border-bottom:1px solid #EEF1F6">' +
            '<td style="padding:3px 6px;color:#9AA1B2;font-size:9px;text-align:right">' + (i + 1) + '</td>' +
            '<td style="padding:3px 6px;font-size:10px;font-weight:600;color:#10131C">' + esc((r.d || '').slice(0, 52)) + (r.o ? ' <span style="color:#C7791A;font-size:7px;font-weight:800">OFFRE</span>' : '') + '</td>' +
            '<td style="padding:3px 6px;font-family:monospace;font-size:8.5px;color:#737A8C">' + esc(r.cip || '') + '</td>' +
            '<td style="padding:3px 6px;text-align:right;font-family:monospace;font-size:10px;font-weight:700;color:#0050E6">' + e2(pv) + '</td>' + metric + stockTd +
            '</tr>';
        }).join('');
        var ths = ['#', 'Produit', 'CIP', 'Prix net', (isItp ? 'Marge/bte' : (byPharma ? 'Pharmacies' : 'Volume'))];
        if (mktEtab) ths.push('Stock');
        return '<div style="margin-bottom:13px;page-break-inside:avoid">' +
          '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:linear-gradient(90deg,#0050E622,transparent);border-left:4px solid #0050E6;border-radius:5px;margin-bottom:4px">' +
            '<div style="font-size:12px;font-weight:800;color:#10131C">' + esc(c.cat) + '</div>' +
            '<div style="font-size:9px;color:#737A8C">top ' + rows.length + '</div></div>' +
          '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:#F4F6FB">' +
            ths.map(function (h, k) {
              return '<th style="padding:4px 6px;font-size:8px;text-transform:uppercase;letter-spacing:.04em;color:#737A8C;text-align:' + (k < 3 ? 'left' : 'right') + '">' + h + '</th>';
            }).join('') + '</tr></thead><tbody>' + trs + '</tbody></table></div>';
      }).filter(Boolean).join('');
      if (!secs) { V2.toast('Aucun produit à afficher (essaie sans « en stock »)', 'warn'); return; }
      var subt = 'Top ' + (perCat > 0 ? perCat + ' ' : '') + 'par catégorie · classé par ' + (byPharma ? 'nb de pharmacies qui commandent' : 'volume vendu (5 mois)') + (mktEtab ? ' · prix &amp; stock ' + esc(mktEtab) : ' · prix net indicatif');
      var html = '<div style="padding:18px 22px;font-family:Satoshi,Inter,system-ui,sans-serif;color:#10131C">' +
        '<div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid #10131C;padding-bottom:12px;margin-bottom:14px">' +
          '<div style="width:40px;height:40px;border-radius:11px;background:linear-gradient(150deg,#0050E6,#0034A0);display:flex;align-items:center;justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 4.2v15.6M4.2 12h15.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></div>' +
          '<div style="flex:1"><div style="font-size:9px;color:#737A8C;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Intégral Pharma · sélection grossiste</div>' +
            '<div style="font-size:18px;font-weight:800">' + esc(conf[1]) + (mktEtab ? ' · ' + esc(mktEtab) : '') + '</div>' +
            '<div style="font-size:10px;color:#737A8C">' + subt + '</div></div>' +
          '<div style="text-align:right;font-size:11px;font-weight:700;font-family:monospace">' + dateStr + '</div>' +
        '</div>' + secs +
        '<div style="margin-top:14px;padding-top:8px;border-top:1px solid #E5E9F2;font-size:8px;color:#9AA1B2;text-transform:uppercase;letter-spacing:.04em">Intégral Pharma · document commercial · « Pharmacies » = nombre d\'officines du réseau qui commandent le produit' + (mktEtab ? ' · prix/stock établissement ' + esc(mktEtab) : '') + '</div>' +
      '</div>';
      window.ensureHtml2Pdf().then(function () { return (document.fonts && document.fonts.ready) ? document.fonts.ready : null; }).then(function () {
        var wrap = document.createElement('div'); wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff';
        wrap.innerHTML = html; document.body.appendChild(wrap);
        var fn = (conf[1].replace(/[^A-Za-z0-9]/g, '_')).slice(0, 40) + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
        window.html2pdf().from(wrap.firstChild).set({ filename: fn, margin: [8, 8, 10, 8], image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] } })
          .save().then(function () { if (wrap.parentNode) document.body.removeChild(wrap); V2.toast('Doc marketing téléchargé'); })
          .catch(function (e) { console.error(e); if (wrap.parentNode) document.body.removeChild(wrap); V2.toast('Erreur PDF', 'error'); });
      });
    },
    // ── Top 50 par catégorie : belle fiche PDF ──
    top50Pdf: function () {
      ensureNr(function () {
        var cats = buildTop50();
        if (!cats.length) { V2.toast('Catalogue en cours de chargement…', 'warn'); return; }
        if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
        V2.toast('Génération du PDF…');
        var html = top50Html(cats);
        window.ensureHtml2Pdf().then(function () { return (document.fonts && document.fonts.ready) ? document.fonts.ready : null; }).then(function () {
          var wrap = document.createElement('div'); wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff';
          wrap.innerHTML = html; document.body.appendChild(wrap);
          var fn = 'Catalogue-par-categorie-' + new Date().toISOString().slice(0, 10) + '.pdf';
          window.html2pdf().from(wrap.firstChild).set({ filename: fn, margin: [8, 8, 10, 8], image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] } })
            .save().then(function () { if (wrap.parentNode) document.body.removeChild(wrap); V2.toast('Fiche catalogue téléchargée'); })
            .catch(function (e) { console.error(e); if (wrap.parentNode) document.body.removeChild(wrap); V2.toast('Erreur PDF', 'error'); });
        });
      });
    },
    // ── Top 50 par catégorie : bel export Excel (1 onglet par catégorie) ──
    top50Xlsx: function () {
      ensureNr(function () {
        var cats = buildTop50();
        if (!cats.length) { V2.toast('Catalogue en cours de chargement…', 'warn'); return; }
        V2.toast('Génération de l\'Excel…');
        ensureXLSX(function (ok) {
          if (!ok || !window.XLSX) { V2.toast('Export Excel indisponible (hors ligne ?)', 'error'); return; }
          var used = {};
          function sheetName(name) {
            var n = String(name).replace(/[\[\]\:\*\?\/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28);
            var base = n; var i = 2; while (used[n.toLowerCase()]) { n = (base.slice(0, 25) + ' ' + i); i++; } used[n.toLowerCase()] = 1; return n;
          }
          var wb = XLSX.utils.book_new();
          cats.forEach(function (c) {
            var isNr = c.kind === 'nr';
            var head = ['#', 'Produit', 'CIP', 'PPHT (€)', 'Abandon (%)', 'Prix net IP (€)', (isNr ? 'Volume vendu' : 'Nb pharmacies')];
            var aoa = [['Intégral Pharma — Catalogue · ' + c.cat], [], head];
            c.rows.forEach(function (r, i) {
              aoa.push([
                i + 1, r.d, String(r.cip),
                (r.remise > 0 && r.ppht > 0) ? +r.ppht.toFixed(2) : '',
                r.remise > 0 ? r.remise : '',
                r.net ? +r.net.toFixed(2) : '',
                r.signal || 0
              ]);
            });
            var ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!cols'] = [{ wch: 4 }, { wch: 42 }, { wch: 15 }, { wch: 10 }, { wch: 11 }, { wch: 13 }, { wch: 13 }];
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
            XLSX.utils.book_append_sheet(wb, ws, sheetName(c.cat));
          });
          XLSX.writeFile(wb, 'Catalogue-par-categorie-' + new Date().toISOString().slice(0, 10) + '.xlsx');
          V2.toast('Excel catalogue téléchargé');
        });
      });
    },
    openPicker: function () { openPicker(); }, closePicker: closePicker,
    // « Parcourir tous les produits » (accueil Marketing) : une sélection neuve,
    // modèle déjà posé, et le sélecteur s'ouvre sur le catalogue entier dès le
    // rendu de l'éditeur.
    createFromCatalogue: function () {
      editing = { id: newId(), type: 'selection', title: '', accroche: '', footer: '', status: 'brouillon', products: [],
                  theme: defaultTheme('selection'), owner: (V2.user && V2.user.email) || '', _new: 'selection' };
      for (var i = 0; i < MODELES.length; i++) if (MODELES[i].k === 'selection') editing.theme.accent = MODELES[i].accent;
      editing.theme.tpl = 'selection';
      pickSrc = 'cat'; pickF = pickFiltresVides(); pickOpenOnRender = true;
      V2.go('marketing', 'new-selection');
    },
    setPickSrc: function (s) {
      if (s !== 'cat' && s !== 'offilog' && s !== 'mix') return;
      pickSrc = s;
      pickF = pickFiltresVides(); pickShown = PICK_PAGE;   // les facettes sont propres à chaque univers
      Array.prototype.forEach.call(document.querySelectorAll('#mkt-pick-src .mkt-srcbtn'), function (b) { b.classList.toggle('on', b.getAttribute('data-src') === s); });
      ensureSrc(renderPickAll);
    },
    // Une facette change : on repart à la première page, le rail se redessine (état des chips)
    pickSet: function (kind, v) {
      if (!Object.prototype.hasOwnProperty.call(pickF, kind)) return;
      pickF[kind] = (kind === 'stock') ? !!v : String(v == null ? '' : v);
      pickShown = PICK_PAGE;
      renderPickAll();
    },
    pickMore: function () { pickShown += PICK_PAGE; renderPickList(); },
    // Un clic coche / décoche. En mode remplacement (ouvert depuis la photo), il remplace et ferme.
    pickToggle: function (src, key, el) {
      if (!editing) return;
      if (replaceIdx != null) { V2.mkt.addProduct(src, key); return; }
      var k = pickKey(src, key);
      if (editing.products.some(function (x) { return String(x.key) === k; })) return;
      var sk = src + '|' + key;
      if (pickSel[sk]) delete pickSel[sk]; else pickSel[sk] = { src: src, key: key };
      if (el && el.classList) el.classList.toggle('sel', !!pickSel[sk]);
      pickFoot();
    },
    pickClearSel: function () {
      pickSel = {};
      Array.prototype.forEach.call(document.querySelectorAll('#mkt-pick-list .mkt-pick-item.sel'), function (el) { el.classList.remove('sel'); });
      pickFoot();
    },
    // Ajoute tous les produits cochés, puis UN seul rafraîchissement de l'aperçu.
    pickAddSel: function () {
      if (!editing) return;
      var keys = Object.keys(pickSel), n = 0, i, p;
      for (i = 0; i < keys.length; i++) {
        p = pickProduct(pickSel[keys[i]].src, pickSel[keys[i]].key);
        if (!p || editing.products.some(function (x) { return String(x.key) === String(p.key); })) continue;
        editing.products.push(p); n++;
      }
      pickSel = {};
      if (!n) { V2.toast('Aucun produit à ajouter', 'warn'); pickFoot(); return; }
      closePicker();
      refreshProducts();
      V2.toast(n + ' produit' + (n > 1 ? 's' : '') + ' ajouté' + (n > 1 ? 's' : ''));
    },
    addProduct: function (src, key) {
      if (!editing) return;
      var p = pickProduct(src, key);
      if (!p) return;
      if (editing.products.some(function (x) { return String(x.key) === String(p.key); })) { if (replaceIdx != null) V2.toast('Ce produit est déjà dans la fiche', 'warn'); return; }
      if (replaceIdx != null && editing.products[replaceIdx]) { editing.products[replaceIdx] = p; closePicker(); refreshProducts(); return; }
      editing.products.push(p); refreshProducts(); renderPickList();
    },
    removeProduct: function (i) { if (editing) { editing.products.splice(i, 1); refreshProducts(); } },
    save: function () {
      if (!editing) return;
      if (!editing.title || !editing.title.trim()) { editing.title = (TYPES[editing.type] || TYPES.support).plural + ' du ' + new Date().toLocaleDateString('fr-FR'); }
      var clean = { id: editing.id, type: editing.type, title: editing.title, accroche: editing.accroche, footer: editing.footer || '',
                    status: editing.status, theme: Object.assign({}, editing.theme || defaultTheme(editing.type)),
                    products: editing.products.map(function (p) { return Object.assign({}, p); }), owner: editing.owner };
      V2.toast('Enregistrement…');
      saveItem(clean).then(function () { V2.toast('Enregistré' + (backend === 'supabase' ? ' (partagé)' : '')); var tf = document.getElementById('mkt-title'); if (tf) tf.value = editing.title; });
    },
    remove: function () {
      if (!editing) return;
      if (!confirm('Supprimer ce support ?')) return;
      removeItem(editing.id).then(function () { V2.toast('Supprimé'); editing = null; V2.go('marketing'); });
    },
    preview: function () {
      if (!editing || !editing.products.length) { V2.toast('Ajoute au moins un produit', 'warn'); return; }
      ensureImg(function () {
        var bd = document.getElementById('mkt-modal'); if (!bd) return;
        bd.querySelector('#mkt-msheet').innerHTML = buildFlyerHtml(false);
        bd.querySelector('#mkt-dl').onclick = V2.mkt.downloadPdf;
        bd.classList.add('open');
        requestAnimationFrame(function () { requestAnimationFrame(fitSheet); });
        waitImages(bd.querySelector('#mkt-msheet'), 9000).then(fitSheet);
        if (!V2._mktFitBound) { window.addEventListener('resize', fitSheet); V2._mktFitBound = true; }
      });
    },
    closePreview: function () { var bd = document.getElementById('mkt-modal'); if (bd) bd.classList.remove('open'); },
    downloadPdf: function () {
      if (typeof window.ensureHtml2Pdf !== 'function') { V2.toast('Module PDF indisponible', 'error'); return; }
      var t = TYPES[editing.type] || TYPES.support;
      var title = (editing.title && editing.title.trim()) ? editing.title.trim() : t.plural;
      V2.toast('Génération du PDF…');
      ensureImg(function () {
        var html = buildFlyerHtml(true);
        window.ensureHtml2Pdf().then(function () { return (document.fonts && document.fonts.ready) ? document.fonts.ready : null; }).then(function () {
          var wrap = document.createElement('div');
          wrap.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff';
          wrap.innerHTML = html; document.body.appendChild(wrap);
          return waitImages(wrap, 12000).then(function () {
            var fn = (t.label + '-' + title).replace(/[^A-Za-z0-9-]/g, '_').slice(0, 50) + '-' + new Date().toISOString().slice(0, 10) + '.pdf';
            return window.html2pdf().from(wrap.firstChild).set({
              filename: fn, margin: 0, image: { type: 'jpeg', quality: 0.95 }, // la feuille (794 px = 210 mm) porte déjà ses marges : une marge en plus rognait le bord droit
              html2canvas: { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] }
            }).save().then(function () { if (wrap.parentNode) document.body.removeChild(wrap); V2.toast('PDF téléchargé'); });
          }).catch(function (e) { console.error(e); if (wrap.parentNode) document.body.removeChild(wrap); V2.toast('Erreur PDF', 'error'); });
        });
      });
    }
  };

  // ════════════════════════════════════════════
  // PAGE
  // ════════════════════════════════════════════
  // ════════════════════════════════════════════
  // DOCUMENTS PARTAGÉS (PDF) — Supabase Storage
  // ════════════════════════════════════════════
  function renderDocs(root) {
    if (docs === null) {
      root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) +
        '<div class="v2-loading"><div class="v2-spinner"></div><div>Ouverture des documents…</div></div>';
      loadDocs().then(function () { if (V2.route && V2.route.name === 'marketing') V2.render(); });
      return;
    }
    var list = docs.length ? docs.map(function (d) {
      var nm = String(d.name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return '<div class="mkt-doc">' +
        '<span class="mkt-doc-ic">' + ICO('cat', 20) + '</span>' +
        '<div class="mkt-doc-main"><div class="mkt-doc-n">' + esc(prettyName(d.name)) + '</div>' +
          '<div class="mkt-doc-m">' + fmtSize(d.size) + (d.created ? ' · ' + new Date(d.created).toLocaleDateString('fr-FR') : '') + '</div></div>' +
        '<a class="v2-btn v2-btn-ghost mkt-doc-open" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + ICO('download', 15) + 'Ouvrir</a>' +
        '<button class="mkt-doc-del" title="Supprimer pour tous" onclick="V2.mkt.docsDelete(\'' + nm + '\')">' + ICO('close', 16, 2) + '</button>' +
      '</div>';
    }).join('') : '<div class="mkt-empty">Aucun document pour le moment. Ajoute un PDF — il sera visible par tous les comptes.</div>';

    var setup = docsErr
      ? '<div class="mkt-setup">' + ICO('alert', 16, 2) + '<div><b>Stockage partagé à activer (une seule fois)</b><br>' +
        'Le dossier des PDF n\'est pas encore créé côté Supabase. Demande-moi le script, il est prêt — après ça, tout marche pour tous les comptes.</div></div>'
      : '';

    root.innerHTML = V2.topbar({ back: true, backTo: 'marketing', backLabel: 'Marketing' }) +
      '<div class="v2-wrap">' +
        '<div class="v2-page-title">Documents partagés</div>' +
        '<div class="v2-page-sub">Des PDF (catalogues, fiches, offres…) visibles par <b>tous les comptes</b>. Ajoute, ouvre, supprime.</div>' +
        '<div class="mkt-doc-bar">' +
          '<label class="v2-btn v2-btn-primary mkt-upl' + (docsBusy ? ' is-busy' : '') + '">' + ICO('plus', 16, 2) + (docsBusy ? 'Envoi en cours…' : 'Ajouter un PDF') +
            '<input type="file" accept="application/pdf,.pdf" multiple style="display:none"' + (docsBusy ? ' disabled' : '') + ' onchange="V2.mkt.docsUpload(this)"></label>' +
        '</div>' +
        setup +
        '<div class="mkt-doc-list">' + list + '</div>' +
      '</div>';
  }

  V2.pages.marketing = {
    render: function (root, param) {
      injectCss();
      if (items === null) {
        root.innerHTML = V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) +
          '<div class="v2-loading"><div class="v2-spinner"></div><div>Ouverture de l\'espace Marketing…</div></div>';
        loadItems().then(function () { V2.render(); });
        return;
      }
      if (param === 'catalogues') renderCatalogues(root);
      else if (param === 'site') renderSite(root);
      else if (param === 'propositions') renderPropositions(root);
      else if (param === 'fxbank') renderFxBank(root);
      else if (param === 'docs') renderDocs(root);
      else if (param === 'linkedin') { if (V2.mktLinkedin) V2.mktLinkedin.render(root); else root.innerHTML = ''; }
      else if (param) renderEditor(root, param); else renderList(root);
    }
  };
  V2.mktReload = function () { items = null; docs = null; };

  // ── Upload / suppression des PDF partagés ──
  V2.mkt = V2.mkt || {};
  V2.mkt.docsUpload = function (input) {
    var files = input && input.files ? [].slice.call(input.files) : [];
    var pdfs = files.filter(function (f) { return /\.pdf$/i.test(f.name) || f.type === 'application/pdf'; });
    if (!pdfs.length) { if (V2.toast) V2.toast('Choisis un fichier PDF.'); return; }
    var c = sb();
    if (!c || !c.storage) { if (V2.toast) V2.toast('Connexion requise.'); return; }
    docsBusy = true; if (V2.route && V2.route.name === 'marketing') V2.render();
    var chain = Promise.resolve(), failed = 0;
    pdfs.forEach(function (f) {
      chain = chain.then(function () {
        var key = Date.now() + '-' + Math.floor(Math.random() * 1000) + '__' + sanitize(f.name);
        return c.storage.from(BUCKET).upload(key, f, { contentType: 'application/pdf', upsert: false })
          .then(function (r) { if (r && r.error) failed++; });
      });
    });
    chain.then(function () { return loadDocs(); }).then(function () {
      docsBusy = false;
      if (V2.route && V2.route.name === 'marketing') V2.render();
      if (V2.toast) V2.toast(failed ? 'Envoi partiel (' + failed + ' échec).' : (pdfs.length > 1 ? 'PDF ajoutés.' : 'PDF ajouté.'));
    }).catch(function () {
      docsBusy = false;
      loadDocs().then(function () { if (V2.route && V2.route.name === 'marketing') V2.render(); });
      if (V2.toast) V2.toast('Échec de l\'envoi.');
    });
  };
  V2.mkt.catEtab = function (code) {
    mktEtab = code || '';
    if (!window.ETAB_PRICES) ensureEtab(function () { if (V2.route && V2.route.name === 'marketing') V2.render(); });
    if (V2.route && V2.route.name === 'marketing') V2.render();
  };
  V2.mkt.catStockOnly = function (on) { etabStockOnly = !!on; if (V2.route && V2.route.name === 'marketing') V2.render(); };
  V2.mkt.docsDelete = function (name) {
    var c = sb(); if (!c || !c.storage) return;
    var disp = prettyName(name);
    var go = function () {
      c.storage.from(BUCKET).remove([name]).then(function () { return loadDocs(); })
        .then(function () { if (V2.route && V2.route.name === 'marketing') V2.render(); if (V2.toast) V2.toast('Supprimé.'); })
        .catch(function () { if (V2.toast) V2.toast('Échec de la suppression.'); });
    };
    if (window.confirm('Supprimer « ' + disp + ' » ? Il disparaîtra pour tous les comptes.')) go();
  };

  // ════════════════════════════════════════════
  // CSS
  // ════════════════════════════════════════════
  function injectCss() {
    if (document.getElementById('v2-mkt-css')) return;
    var s = document.createElement('style'); s.id = 'v2-mkt-css';
    s.textContent = [
      '.mkt-share{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:6px 11px;border-radius:999px}',
      '.mkt-share.ok{color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 12%,#fff)}',
      '.mkt-share.local{color:var(--c-amber);background:color-mix(in srgb,var(--c-amber) 12%,#fff)}',
      '.mkt-badge{display:inline-block;vertical-align:middle;margin-left:7px;padding:2px 9px;border-radius:999px;background:#FF4D6D;color:#fff;font-size:11px;font-weight:800;letter-spacing:.01em}',
      '.mkt-cat-banner{display:flex;align-items:center;gap:14px;margin-top:14px;padding:16px 18px;background:linear-gradient(150deg,color-mix(in srgb,var(--c-cat) 8%,#fff),var(--card));border:1px solid color-mix(in srgb,var(--c-cat) 22%,var(--line));border-radius:var(--r-card);box-shadow:var(--sh-1);cursor:pointer;text-decoration:none;color:inherit;transition:.16s var(--ease)}',
      '.mkt-cat-banner:hover{box-shadow:var(--sh-2);transform:translateY(-1px)}',
      '.mkt-cat-ic{width:44px;height:44px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(150deg,var(--c-cat),#4d35a0)}',
      '.mkt-top50{display:flex;align-items:center;gap:14px;margin:14px 0 4px;padding:15px 18px;background:linear-gradient(135deg,color-mix(in srgb,var(--ip-blue) 8%,var(--card)),var(--card));border:1px solid color-mix(in srgb,var(--ip-blue) 22%,var(--line));border-radius:var(--r-card);box-shadow:var(--sh-1)}',
      '.mkt-top50-ic{width:42px;height:42px;flex-shrink:0;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(150deg,var(--ip-blue),#0034A0)}',
      '.mkt-top50-txt{flex:1;min-width:0}',
      '.mkt-top50-t{font-weight:800;font-size:15.5px;letter-spacing:-.01em;color:var(--ip-ink)}',
      '.mkt-top50-s{font-size:12px;color:var(--muted);margin-top:2px;line-height:1.4}',
      '.mkt-top50-btns{display:flex;gap:8px;flex-shrink:0}',
      '@media(max-width:640px){.mkt-top50{flex-wrap:wrap}.mkt-top50-btns{width:100%}.mkt-top50-btns .v2-btn{flex:1;justify-content:center}}',
      '.mkt-cat-t{display:block;font-weight:800;font-size:15.5px;letter-spacing:-.01em}',
      '.mkt-cat-s{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}',
      '.mkt-search{position:relative;display:flex;align-items:center;margin-bottom:14px}',
      '.mkt-search-ic{position:absolute;left:14px;color:var(--muted-2);display:inline-flex;pointer-events:none}',
      '.mkt-search input{flex:1;width:100%;box-sizing:border-box;padding:12px 40px;font-size:14.5px;font-family:var(--font);color:var(--ip-ink);background:var(--card);border:1px solid var(--line);border-radius:var(--r-pill);outline:none;transition:border-color .16s var(--ease),box-shadow .16s var(--ease)}',
      '.mkt-search input:focus{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '.mkt-search input::-webkit-search-decoration,.mkt-search input::-webkit-search-cancel-button{-webkit-appearance:none}',
      '.mkt-search-x{position:absolute;right:8px;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:none;background:transparent;color:var(--muted-2);cursor:pointer;border-radius:50%}',
      '.mkt-search-x:hover{background:color-mix(in srgb,var(--ip-blue) 10%,transparent);color:var(--ip-blue)}',
      '.mkt-more-chev{margin-left:auto;color:var(--muted-2);display:inline-flex;transition:transform .2s var(--ease)}',
      // ── Documents PDF partagés ──
      '.mkt-etabbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 16px;padding:12px 14px;background:color-mix(in srgb,var(--ip-blue) 5%,#fff);border:1px solid color-mix(in srgb,var(--ip-blue) 18%,var(--line));border-radius:12px}',
      '.mkt-etablbl{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--ip-blue)}',
      '.mkt-etabchips{display:flex;gap:6px;flex-wrap:wrap}',
      '.mkt-etabchip{border:1px solid var(--line-strong,#d7dbe6);background:#fff;border-radius:999px;padding:6px 13px;font-family:inherit;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:.12s}',
      '.mkt-etabchip:active{transform:scale(.96)}',
      '.mkt-etabchip.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.mkt-stocktgl{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--ip-ink);cursor:pointer;margin-left:auto}',
      '.mkt-stocktgl input{width:16px;height:16px;accent-color:var(--ip-blue)}',
      '.mkt-sortbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 16px}',
      '.mkt-sortlbl{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}',
      '.mkt-cathead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}',
      '.mkt-catlist-btn{display:inline-flex;align-items:center;gap:5px;border:1px solid color-mix(in srgb,var(--c-mint) 45%,var(--line));background:color-mix(in srgb,var(--c-mint) 10%,#fff);color:#0f7a52;border-radius:9px;padding:6px 11px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:.14s}',
      '.mkt-catlist-btn:hover{background:var(--c-mint);color:#fff;border-color:var(--c-mint)}',
      '.mkt-catlist-btn:active{transform:scale(.97)}',
      '.mkt-doc-bar{display:flex;gap:10px;margin:18px 0 6px;flex-wrap:wrap}',
      '.mkt-upl{position:relative;cursor:pointer}',
      '.mkt-upl input{position:absolute;inset:0;opacity:0;cursor:pointer}',
      '.mkt-upl.is-busy{opacity:.6;pointer-events:none}',
      '.mkt-doc-list{display:flex;flex-direction:column;gap:10px;margin-top:14px}',
      '.mkt-doc{display:flex;align-items:center;gap:13px;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh-1);padding:12px 14px}',
      '.mkt-doc-ic{width:40px;height:40px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(150deg,var(--c-rose,#E0556E),#b1304a)}',
      '.mkt-doc-main{flex:1;min-width:0}',
      '.mkt-doc-n{font-weight:700;font-size:14.5px;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mkt-doc-m{font-size:12px;color:var(--muted);margin-top:2px}',
      '.mkt-doc-open{flex-shrink:0;white-space:nowrap}',
      '.mkt-doc-del{flex-shrink:0;width:36px;height:36px;border-radius:10px;border:1px solid var(--line);background:#fff;color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}',
      '.mkt-doc-del:hover{color:#fff;background:var(--c-rose,#E0556E);border-color:var(--c-rose,#E0556E)}',
      '.mkt-cat-prod{font-weight:600;font-size:13.5px}',
      '.mkt-th-x{background:var(--card-2)}',
      '.mkt-empty{padding:24px 16px;text-align:center;color:var(--muted);font-size:13px;border:1px dashed var(--line);border-radius:14px;grid-column:1/-1}',
      '.mkt-setup{display:flex;gap:11px;align-items:flex-start;margin-top:26px;padding:15px 17px;border-radius:14px;background:color-mix(in srgb,var(--c-amber) 8%,#fff);border:1px solid color-mix(in srgb,var(--c-amber) 28%,transparent);font-size:13px;line-height:1.5;color:var(--ip-ink-2)}',
      '.mkt-setup svg{color:var(--c-amber);flex-shrink:0;margin-top:1px}',
      '.mkt-sws{display:flex;gap:6px;flex-wrap:wrap;align-items:center}',
      '.mkt-sw{width:26px;height:26px;border-radius:8px;border:2px solid var(--line);cursor:pointer;padding:0;transition:.14s var(--ease)}',
      '.mkt-sw.on{border-color:var(--ip-ink);box-shadow:0 0 0 2px #fff inset}',
      '.mkt-sw-bg{box-shadow:inset 0 0 0 1px rgba(16,19,28,.07)}',
      '.mkt-sw-pick{display:inline-flex;align-items:center;justify-content:center;overflow:hidden;background:conic-gradient(#f44,#fd0,#4d4,#0cf,#46f,#d4f,#f44)}',
      '.mkt-sw-pick input{opacity:0;width:130%;height:130%;cursor:pointer;border:none;padding:0}',
      '.mkt-tg{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:6px 15px;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer;transition:.16s var(--ease)}',
      '.mkt-tg.on{border-color:var(--c-opp);color:#fff;background:var(--c-opp)}',
      '.mkt-foot{flex:1;min-width:200px;font-family:var(--font);font-size:13px;color:var(--ip-ink);border:1px solid var(--line);border-radius:10px;padding:9px 12px;outline:none;background:var(--card)}',
      '.mkt-foot:focus{border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '.mkt-prow{display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid var(--line-2)}',
      '.mkt-prow:last-child{border-bottom:none}',
      '.mkt-prow-img{width:42px;height:42px;border-radius:9px;background:#F0F2F7 center/cover no-repeat;border:1px solid var(--line);flex-shrink:0}',
      '.mkt-prow-main{flex:1;min-width:0}',
      '.mkt-prow-namei{width:100%;border:1px solid transparent;background:transparent;border-radius:8px;padding:5px 7px;margin:-5px -7px 0;font-family:var(--font);font-size:13.5px;font-weight:600;color:var(--ip-ink)}',
      '.mkt-prow-namei:hover{border-color:var(--line)}',
      '.mkt-prow-namei:focus{outline:none;border-color:var(--ip-blue);background:#fff;box-shadow:0 0 0 3px var(--halo)}',
      '.mkt-prow-f{display:flex;flex-direction:column;gap:2px;flex-shrink:0;width:74px}',
      '.mkt-prow-f span{font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700}',
      '.mkt-prow-f input{width:100%;border:1px solid var(--line);border-radius:var(--r-control,9px);padding:6px 8px;font-family:var(--mono);font-size:12.5px;font-weight:700;color:var(--ip-ink);text-align:right;background:var(--card)}',
      '.mkt-prow-f input:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo)}',
      '@media(max-width:560px){.mkt-prow{flex-wrap:wrap}.mkt-prow-f{width:auto;flex:1}}',
      '.mkt-prow-name{font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mkt-prow-sub{font-size:11px;color:var(--muted);font-family:var(--mono)}',
      '.mkt-prow-sub2{display:flex;align-items:center;gap:8px;margin-top:3px;flex-wrap:wrap}',
      '.mkt-prow-cati{border:1px solid var(--line);background:var(--card);border-radius:7px;padding:3px 8px;font-family:var(--font);font-size:11px;font-weight:600;color:var(--ip-blue);max-width:200px}',
      '.mkt-prow-cati:hover{border-color:var(--ip-blue)}',
      '.mkt-prow-cati:focus{outline:none;border-color:var(--ip-blue);background:#fff;box-shadow:0 0 0 3px var(--halo)}',
      '.mkt-prow-cati::placeholder{color:var(--muted-2);font-weight:500}',
      '.mkt-prow-price{font-size:14px;font-weight:800;color:var(--ip-blue);flex-shrink:0}',
      '.mkt-prow-x{width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--muted-2);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.16s var(--ease)}',
      '.mkt-prow-x:hover{color:var(--c-rose);border-color:color-mix(in srgb,var(--c-rose) 40%,var(--line))}',
      // Sélecteur = explorateur de catalogue : rail de facettes à gauche,
      // résultats seuls défilent, pied collant. Plein écran sous 640 px.
      '.mkt-pick-bd{position:fixed;inset:0;z-index:210;background:rgba(16,19,28,0.55);display:flex;align-items:flex-start;justify-content:center;padding-top:8vh;opacity:0;pointer-events:none;transition:opacity .2s var(--ease)}',
      '.mkt-pick-bd.open{opacity:1;pointer-events:auto}',
      '.mkt-pick{width:min(980px,94vw);height:84vh;max-height:84vh;background:var(--card);border-radius:18px;box-shadow:var(--sh-pop);display:flex;flex-direction:column;overflow:hidden;transform:scale(.97);transition:transform .24s var(--ease)}',
      '.mkt-pick-bd.open .mkt-pick{transform:scale(1)}',
      '.mkt-pick-body{display:flex;flex:1;min-height:0}',
      '.mkt-pick-rail{width:220px;flex-shrink:0;overflow-y:auto;border-right:1px solid var(--line);padding:10px 10px 14px;background:var(--card-2)}',
      '.mkt-pick-rail[hidden]{display:none}',
      '.mkt-pick-main{flex:1;min-width:0;display:flex;flex-direction:column}',
      '.mkt-pick-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 14px 6px;border-bottom:1px solid var(--line)}',
      '.mkt-pick-n{flex-shrink:0;font-size:11.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}',
      '.mkt-pick-filters{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1;min-width:0}',
      '.mkt-pick-filters[hidden]{display:none}',
      '.mkt-pick-filters .mkt-fchip{width:auto;flex:0 0 auto;min-height:32px;padding:5px 10px;border-color:var(--line);background:var(--card);white-space:nowrap}',
      '.mkt-pick-filters .mkt-fchip.on{border-color:var(--ip-blue);background:var(--ip-blue)}',
      '.mkt-pick-filters .mkt-fsel{width:auto;max-width:220px;min-height:32px;padding:4px 8px}',
      '.mkt-pick-filters .mkt-fchk{min-height:32px;padding:0 4px}',
      'body.mkt-picking .v2-fab{display:none}',
      '.mkt-fac{margin-bottom:12px}',
      '.mkt-fac-t{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:6px 6px 4px}',
      '.mkt-fchip{display:flex;align-items:center;gap:8px;width:100%;min-height:34px;padding:6px 8px;border:1px solid transparent;border-radius:9px;background:none;font-family:var(--font);font-size:12.5px;font-weight:600;color:var(--ip-ink);text-align:left;cursor:pointer;transition:background .12s var(--ease),border-color .12s var(--ease)}',
      '.mkt-fchip span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mkt-fchip i{font-style:normal;font-family:var(--mono);font-size:10.5px;color:var(--muted);flex-shrink:0}',
      '.mkt-fchip:hover{background:var(--halo)}',
      '.mkt-fchip.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.mkt-fchip.on i{color:rgba(255,255,255,.8)}',
      '.mkt-fsel{width:100%;min-height:38px;padding:7px 8px;border:1px solid var(--line);border-radius:9px;background:var(--card);font-family:var(--font);font-size:13px;color:var(--ip-ink)}',
      '.mkt-fchk{display:flex;align-items:center;gap:8px;min-height:38px;padding:6px 8px;font-size:13px;font-weight:600;color:var(--ip-ink);cursor:pointer}',
      '.mkt-fchk input{width:18px;height:18px;accent-color:var(--ip-blue);margin:0}',
      '.mkt-pick-foot{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--line);background:var(--card)}',
      '.mkt-pick-nsel{flex:1;min-width:120px;font-size:13px;font-weight:600;color:var(--muted)}',
      '.mkt-pick-foot .v2-btn[disabled]{opacity:.45;cursor:default}',
      '.mkt-pick-more{width:100%;justify-content:center;margin:8px 0 4px}',
      '.mkt-pick-ck{width:24px;height:24px;border-radius:50%;border:1.5px solid var(--line);display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;transition:background .12s var(--ease),border-color .12s var(--ease)}',
      '.mkt-pick-item.sel{background:var(--halo)}',
      '.mkt-pick-item.sel .mkt-pick-ck{background:var(--ip-blue);border-color:var(--ip-blue)}',
      '.mkt-pick-item.added .mkt-pick-ck{display:none}',
      '.mkt-pick-rupt{flex-shrink:0;font-size:10.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:var(--c-rose);background:color-mix(in srgb,var(--c-rose) 12%,#fff);border-radius:999px;padding:3px 8px}',
      '@media(max-width:640px){.mkt-pick-bd{padding-top:0}.mkt-pick{width:100vw;height:100vh;height:100dvh;max-height:100vh;max-height:100dvh;border-radius:0}.mkt-pick-body{flex-direction:column}',
      '.mkt-pick-rail{width:auto;display:flex;flex-wrap:nowrap;align-items:center;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;border-right:none;border-bottom:1px solid var(--line);padding:8px 12px}',
      '.mkt-fac{display:contents}.mkt-fac-t{display:none}.mkt-fchip{width:auto;flex:0 0 auto;min-height:44px;white-space:nowrap;border-color:var(--line);background:var(--card)}',
      '.mkt-pick-bar{flex-direction:column;align-items:stretch;gap:4px;padding:6px 0 0;flex-wrap:nowrap}.mkt-pick-n{padding:0 12px}',
      '.mkt-pick-filters{flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;padding:4px 12px 8px}',
      '.mkt-pick-filters .mkt-fchip,.mkt-pick-filters .mkt-fchk{min-height:44px;flex:0 0 auto;white-space:nowrap}.mkt-pick-filters .mkt-fsel{min-height:44px;flex:0 0 auto;max-width:180px}',
      '.mkt-pick-list .mkt-pick-nm b{-webkit-line-clamp:2}',
      '.mkt-pick-item{min-height:44px}.mkt-pick-foot .v2-btn{min-height:var(--tap-min)}}',
      // Ligne de résultat : le NOM peut prendre deux lignes, la sous-ligne
      // « labo · CIP · rayon » reste sur une seule, coupée par « … ».
      '.mkt-pick-list .mkt-pick-nm b{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;overflow:hidden;line-height:1.25}',
      '.mkt-pick-list .mkt-pick-nm span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mkt-pick-search{display:flex;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid var(--line)}',
      '.mkt-pick-search svg{color:var(--ip-blue);flex-shrink:0}',
      '.mkt-pick-search input{border:none;outline:none;background:none;font-family:var(--font);font-size:16px;flex:1;color:var(--ip-ink)}',
      '.mkt-pick-src{display:flex;gap:6px;padding:10px 16px 4px}',
      '.mkt-srcbtn{flex:1;border:1px solid var(--line);background:var(--card);border-radius:10px;padding:8px 10px;font-family:var(--font);font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;transition:.16s var(--ease)}',
      '.mkt-srcbtn.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.mkt-cat-thumb{display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:9px;border:1px solid var(--line);background:#fff center/contain no-repeat;background-origin:content-box;padding:3px;box-shadow:0 1px 2px rgba(8,16,40,.05);flex-shrink:0}',
      '.mkt-cat-thumb-ph{background:var(--card-2);color:var(--muted-2);box-shadow:none}',
      '.mkt-catadd{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ip-blue);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.14s var(--ease)}',
      '.mkt-catadd:hover{border-color:var(--ip-blue);background:var(--halo)}',
      '.mkt-catadd.on{background:var(--ip-blue);border-color:var(--ip-blue);color:#fff}',
      '.mkt-catbar{position:sticky;bottom:14px;display:none;align-items:center;justify-content:space-between;gap:14px;margin-top:18px;padding:12px 16px;border-radius:14px;background:var(--ip-ink);color:#fff;box-shadow:0 12px 34px rgba(8,16,40,.28)}',
      '.mkt-catbar.on{display:flex}',
      '.mkt-catbar #mkt-catbar-n{font-weight:700;font-size:13.5px}',
      // Mobile : barre de sélection empilée (libellé au-dessus, 2 CTA pleine largeur) au lieu de déborder
      '@media(max-width:560px){.mkt-catbar{flex-direction:column;align-items:stretch;gap:10px}.mkt-catbar>div{width:100%}.mkt-catbar>div .v2-btn{flex:1;justify-content:center}}',
      // Mobile : les onglets d'univers deviennent une bande scrollable horizontalement (au lieu de se casser sur plusieurs lignes)
      '@media(max-width:640px){.mkt-pick-src{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:6px}.mkt-srcbtn{flex:0 0 auto;white-space:nowrap}}',
      // Dans le sélecteur, sous 640 px les trois univers tiennent sur la largeur : le compte disparaît (il reste dans le compteur de résultats).
      '.mkt-srcbtn-n{font-style:normal}',
      '@media(max-width:640px){#mkt-pick-src{overflow:visible;padding-bottom:4px}#mkt-pick-src .mkt-srcbtn{flex:1 1 0;min-width:0;padding:10px 6px;font-size:12px;overflow:hidden;text-overflow:ellipsis}#mkt-pick-src .mkt-srcbtn-n{display:none}}',
      '.mkt-pick-ic{width:40px;height:40px;border-radius:9px;background:var(--card-2);display:flex;align-items:center;justify-content:center;color:var(--ip-blue);flex-shrink:0}',
      '.mkt-prow-pill{display:flex;align-items:center;justify-content:center;color:var(--ip-blue);background:var(--card-2)}',
      '.mkt-pick-list{overflow-y:auto;padding:8px}',
      '.mkt-pick-item{display:flex;align-items:center;gap:12px;padding:8px 11px;border-radius:11px;cursor:pointer;transition:background .12s var(--ease),transform .12s var(--ease)}',
      '.mkt-pick-item:hover{background:var(--halo);transform:translateX(2px)}',
      '.mkt-pick-item.added{opacity:.5;pointer-events:none}',
      '.mkt-pick-item.added::after{content:"Dans la fiche";margin-left:auto;flex-shrink:0;font-size:10.5px;font-weight:800;letter-spacing:.03em;color:var(--c-opp);background:color-mix(in srgb,var(--c-opp) 14%,#fff);border-radius:999px;padding:3px 9px}',
      '.mkt-pick-img{width:40px;height:40px;border-radius:9px;background:#fff center/contain no-repeat;border:1px solid var(--line);flex-shrink:0}',
      '.mkt-pick-nm{flex:1;min-width:0}',
      '.mkt-pick-nm b{display:block;font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.mkt-pick-nm span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}',
      '.mkt-pick-pr{font-size:13px;font-weight:700;color:var(--c-mint);flex-shrink:0}',
      '.mkt-pick-sortie{flex-shrink:0;font-family:var(--mono);font-size:11px;font-weight:700;color:var(--ip-blue);background:var(--halo);border-radius:999px;padding:3px 8px;margin-right:2px;white-space:nowrap}',
      '.mkt-pick-sortie.marge{color:var(--c-mint);background:color-mix(in srgb,var(--c-mint) 12%,#fff)}',
      '.mkt-modal{position:fixed;inset:0;z-index:120;background:rgba(16,19,28,0.55);display:flex;align-items:flex-start;justify-content:center;padding:4vh 16px;opacity:0;pointer-events:none;transition:opacity .2s var(--ease)}',
      '.mkt-modal.open{opacity:1;pointer-events:auto}',
      '.mkt-dialog{width:min(900px,96vw);max-height:92vh;background:var(--card);border-radius:20px;box-shadow:var(--sh-pop);display:flex;flex-direction:column;overflow:hidden;transform:scale(.97);transition:transform .24s var(--ease)}',
      '.mkt-modal.open .mkt-dialog{transform:scale(1)}',
      '.mkt-mtop{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line);background:rgba(251,252,254,.85)}',
      '.mkt-mtt{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;flex:1}',
      '.mkt-mtt svg{color:var(--ip-blue)}',
      '.mkt-mx{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.16s var(--ease)}',
      '.mkt-mx:hover{color:var(--ip-ink);transform:rotate(90deg)}',
      '.mkt-mscroll{overflow-y:auto;overflow-x:hidden;padding:0;background:transparent;flex:1}',
      '.mkt-mholder{margin:0 auto;overflow:hidden;border-radius:8px;box-shadow:0 14px 44px rgba(16,19,28,.2)}',
      '.mkt-msheet{width:794px;transform-origin:top left;background:#fff}',
      // ── Assistant guidé : zones modifiables de l'aperçu ──
      '.mkt-zone{position:relative;outline:1.5px dashed rgba(16,19,28,.3);outline-offset:4px;border-radius:4px;cursor:text;transition:outline-color .15s}',
      '.mkt-zone:hover{outline-color:#0050E6}',
      '.mkt-zone:focus{outline:2px solid #0050E6;outline-offset:4px}',
      '.mkt-zone::before{content:attr(data-label);position:absolute;right:-6px;top:-13px;padding:2px 6px;border-radius:999px;background:#0050E6;color:#fff;font:800 8px/1.2 Inter,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;pointer-events:none;opacity:.9}',
      '.mkt-zone-light{outline-color:rgba(255,255,255,.55)}',
      '.mkt-zone-light:hover{outline-color:#fff}.mkt-zone-light:focus{outline-color:#fff}',
      '.mkt-zone-light::before{background:#fff;color:#10131C}',
      '.mkt-zone:empty::before{content:attr(data-ph);position:static;padding:0;border-radius:0;background:none;color:inherit;font:inherit;letter-spacing:inherit;text-transform:none;white-space:normal;opacity:.45}',
      '.mkt-zone-photo{cursor:pointer}',
      '.mkt-zone-photo:hover::after{content:"Changer de produit";position:absolute;left:0;right:0;bottom:0;padding:7px;text-align:center;background:rgba(16,19,28,.78);color:#fff;font:700 10px/1 Inter,Arial,sans-serif;border-radius:0 0 12px 12px;pointer-events:none}',
      '.mkt-zone-quiet{outline-color:transparent;display:inline-block;min-width:24px}',
      '.mkt-zone-quiet::before{display:none}',
      '.mkt-zone-quiet:hover::after{border-radius:0 0 6px 6px;padding:3px;font-size:8px}',
      // ── Accessibilité : respecter la préférence « moins d\'animations » ──
      // ═══ « L'atelier » — accueil et éditeur Marketing (direction validée 10/09/2026) ═══
      // Le fond verrière (ciel + halo) existe déjà : .v2-halo (v2-verriere.css), fixe,
      // derrière tout. Ici on ajoute seulement les travées de lumière qui tombent de
      // biais sur le plan de travail, sans repeindre le ciel par-dessus.
      '.mkt-atelier{position:relative}',
      '.mkt-atelier::before{content:"";position:absolute;left:0;right:0;top:0;height:440px;pointer-events:none;z-index:0;background:repeating-linear-gradient(104deg,rgba(255,255,255,0) 0px,rgba(255,255,255,0) 140px,rgba(255,255,255,.22) 140px,rgba(255,255,255,.4) 185px,rgba(255,255,255,.22) 230px,rgba(255,255,255,0) 232px,rgba(255,255,255,0) 360px)}',
      '.mkt-atelier::after{content:"";position:absolute;left:0;right:0;top:0;height:8px;pointer-events:none;z-index:0;background:repeating-linear-gradient(90deg,rgba(11,31,77,.08) 0 2px,transparent 2px 160px)}',
      '.mkt-bench{position:relative;z-index:1;padding-top:20px;display:grid;grid-template-columns:256px minmax(0,1fr) 296px;gap:24px;align-items:start}',
      '@media(max-width:1180px) and (min-width:960px){.mkt-bench{grid-template-columns:220px minmax(0,1fr) 260px;gap:18px}.mkt-models{grid-template-columns:1fr}}',
      '.mkt-headline{grid-column:1/-1;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:6px 4px 2px}',
      '.mkt-headline h1{font-size:28px;line-height:1.08;color:var(--ip-ink);letter-spacing:-.02em;font-weight:800}',
      '.mkt-headline p{color:var(--muted);font-size:14px;margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.mkt-hacts{display:flex;gap:10px;flex-wrap:wrap}',
      // ── Tiroirs (rails latéraux) ──
      '.mkt-rail{display:flex;flex-direction:column;gap:14px;position:sticky;top:84px}',
      '.mkt-drawer{background:var(--card);border-radius:var(--r-card);border:1px solid var(--line);position:relative;box-shadow:var(--sh-1);background-image:linear-gradient(180deg,var(--card) 0,var(--card) 60%,var(--card-2) 100%);overflow:hidden;transition:transform .22s var(--ease),box-shadow .22s var(--ease)}',
      '.mkt-drawer:hover{transform:translateY(-2px);box-shadow:var(--sh-2)}',
      '.mkt-drawer>header{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;font-weight:800;color:var(--ip-ink);font-size:14px;letter-spacing:-.01em}',
      '.mkt-drawer>header svg{color:var(--ip-blue);flex:none}',
      '.mkt-drawer>header .handle{margin-left:auto;width:34px;height:6px;border-radius:999px;background:linear-gradient(180deg,#DCE3F0,#B9C6DE)}',
      '.mkt-drawer>header .n{margin-left:auto;font-size:13px;text-align:right;font-weight:600;color:var(--muted)}',
      '.mkt-drawer .body{padding:0 12px 14px}',
      '.mkt-drawer .desc{color:var(--muted);font-size:13px;padding:0 4px}',
      '.mkt-more>summary{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;font-weight:800;color:var(--ip-ink);font-size:14px;letter-spacing:-.01em;cursor:pointer;list-style:none;-webkit-tap-highlight-color:transparent}',
      '.mkt-more>summary::-webkit-details-marker{display:none}',
      '.mkt-more>summary svg{color:var(--ip-blue);flex:none}',
      '.mkt-more>summary .n{margin-left:auto;font-size:12.5px;color:var(--muted);font-weight:600}',
      '.mkt-more[open]>summary{border-bottom:1px solid var(--line)}',
      '.mkt-more[open]>summary .mkt-more-chev{transform:rotate(90deg)}',
      // tuiles de modèles : chacune une mini-feuille
      '.mkt-models{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.mkt-mtile{--m:var(--ip-blue);min-height:92px;border-radius:12px;background:var(--card);border:1px solid var(--line);position:relative;padding:26px 10px 8px;text-align:left;display:flex;flex-direction:column;justify-content:flex-end;gap:4px;box-shadow:var(--sh-1);overflow:hidden;transition:transform .18s var(--ease),box-shadow .18s var(--ease),border-color .18s var(--ease);cursor:pointer}',
      '.mkt-mtile::before{content:"";position:absolute;left:0;right:0;top:0;height:12px;background:var(--m)}',
      '.mkt-mtile[data-head="slim"]::before{height:3px;top:8px;left:10px;right:10px;border-radius:2px}',
      '.mkt-mtile[data-head="plain"]::before{height:0}',
      '.mkt-mtile::after{content:"";position:absolute;left:10px;top:20px;width:60%;height:5px;border-radius:3px;background:rgba(16,19,28,.12)}',
      '.mkt-mtile[data-head="plain"]::after{top:10px;background:var(--m);opacity:.8}',
      '.mkt-mtile b{font-size:13px;color:var(--ip-ink);font-weight:700;letter-spacing:-.01em;line-height:1.2}',
      '.mkt-mtile small{font-size:12.5px;color:var(--muted)}',
      '.mkt-mtile:hover{transform:translateY(-2px)}',
      '.mkt-mtile[aria-pressed="true"]{border-color:var(--m);box-shadow:0 0 0 3px color-mix(in srgb,var(--m) 22%,transparent),var(--sh-2)}',
      // rayons (chips)
      '.mkt-chips{display:flex;flex-wrap:wrap;gap:6px}',
      '.mkt-chip{min-height:34px;padding:0 11px;border-radius:999px;border:1px solid var(--line);background:var(--card);font-size:13px;font-weight:600;color:var(--ip-ink);display:inline-flex;align-items:center;gap:6px;box-shadow:var(--sh-1);cursor:pointer;transition:border-color .16s var(--ease)}',
      '.mkt-chip small{color:var(--muted);font-weight:600;font-size:12.5px}',
      '.mkt-chip.more{border-style:dashed;color:var(--muted);background:none;box-shadow:none}',
      '.mkt-chip:hover{border-color:var(--ip-blue)}',
      // instruments (rail droit)
      '.mkt-tool{background:none;border:0;font-family:inherit;color:inherit;display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:var(--r-md);text-align:left;width:100%;transition:background .15s var(--ease);cursor:pointer}',
      '.mkt-tool:hover{background:var(--card-2)}',
      '.mkt-tool .tico{width:38px;height:38px;border-radius:10px;flex:none;display:grid;place-items:center;color:var(--ip-blue);background:linear-gradient(180deg,var(--halo),color-mix(in srgb,var(--ip-blue) 12%,#fff));box-shadow:var(--sh-1)}',
      '.mkt-tool .tico svg{width:20px;height:20px}',
      '.mkt-tool .tico.pdf{color:var(--ip-blue-d);background:linear-gradient(180deg,#fff,var(--card-2))}',
      '.mkt-tool b{display:block;font-size:14px;color:var(--ip-ink);font-weight:700;letter-spacing:-.01em}',
      '.mkt-tool span span{display:block;font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.35}',
      '.mkt-tool .arr{margin-left:auto;align-self:center;color:var(--muted);flex:none}',
      '.mkt-mqstrip{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin-top:8px;border-radius:8px;overflow:hidden;border:1px solid var(--line)}',
      '.mkt-mqstrip img{width:100%;height:52px;object-fit:cover;object-position:top center;display:block}',
      // ── La feuille sur le plan de travail ──
      '.mkt-stage{position:relative;perspective:1800px;perspective-origin:50% 30%;display:flex;flex-direction:column;align-items:center;gap:18px}',
      '.mkt-hint{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px}',
      '.mkt-hint svg{color:#1E9E6A}',
      '.mkt-sheetwrap{position:relative;width:min(100%,600px)}',
      '.mkt-sheetwrap::after{content:"";position:absolute;left:6%;right:-2%;bottom:-26px;height:60px;border-radius:50%;z-index:-1;background:radial-gradient(60% 100% at 50% 50%,rgba(11,31,77,.28),rgba(11,31,77,0) 70%)}',
      '#mkt-home-wrap{transform-style:preserve-3d;transform:rotateX(var(--rx,6deg)) rotateY(var(--ry,-10deg)) translateZ(0);transition:transform .6s var(--ease)}',
      '.mkt-sheet-home{position:relative;display:block;width:100%;border:0;background:none;padding:0;margin:0;cursor:pointer;text-align:left;border-radius:6px;box-shadow:0 1px 0 rgba(255,255,255,1) inset,0 0 0 1px rgba(11,31,77,.08),0 2px 3px rgba(11,31,77,.08),0 22px 40px -18px rgba(11,31,77,.45),0 60px 80px -40px rgba(11,31,77,.35);overflow:hidden}',
      '.mkt-home-holder{margin:0 auto;overflow:hidden}',
      '.mkt-home-sheet{width:794px;transform-origin:top left;background:#fff}',
      // créations récentes : éventail de mini-feuilles
      '.mkt-recent{width:min(100%,600px)}',
      '.mkt-recent h2{font-size:13px;color:var(--muted);font-weight:700;letter-spacing:.02em;text-transform:uppercase;margin:6px 0 10px}',
      '.mkt-fan{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}',
      '.mkt-mini{--m:var(--ip-blue);background:var(--card);border:0;border-radius:6px;min-height:120px;padding:12px;position:relative;text-align:left;box-shadow:0 1px 0 rgba(255,255,255,1) inset,0 0 0 1px rgba(11,31,77,.08),0 12px 22px -14px rgba(11,31,77,.5);background-image:linear-gradient(158deg,#fff 0,#fff 50%,var(--card-2) 100%);display:flex;flex-direction:column;gap:5px;transition:transform .22s var(--ease);cursor:pointer}',
      '.mkt-mini:nth-child(1){transform:rotate(-2deg)}.mkt-mini:nth-child(3){transform:rotate(2deg)}',
      '.mkt-mini:hover{transform:rotate(0) translateY(-4px)}',
      '.mkt-mini i{display:block;height:6px;border-radius:2px;background:var(--m)}',
      '.mkt-mini b{font-size:13px;color:var(--ip-ink);line-height:1.15;font-weight:700;letter-spacing:-.01em}',
      '.mkt-mini small{font-size:12px;color:var(--muted);margin-top:auto;line-height:1.3}',
      '.mkt-mini .who{display:inline-flex;align-items:center;gap:4px;margin-top:4px}',
      '.mkt-mini .who em{font-style:normal;width:18px;height:18px;border-radius:50%;background:#F5931C;color:#fff;font-size:11px;font-weight:800;display:grid;place-items:center}',
      // barre d'outils flottante de l'éditeur, posée au-dessus de la feuille
      '.mkt-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;width:min(100%,600px)}',
      '.mkt-tbsteps{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);margin-right:auto}',
      '.mkt-tbsteps b{display:inline-flex;align-items:center;gap:6px;color:var(--ip-ink);font-weight:700}',
      '.mkt-tbsteps b i{width:20px;height:20px;border-radius:50%;background:var(--ip-blue);color:#fff;font-style:normal;font-size:11px;display:grid;place-items:center;font-weight:800}',
      '.mkt-tbsteps b i.done{background:var(--halo);color:var(--ip-blue)}',
      '.mkt-tbhint{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:8px}',
      '.mkt-tbhint i{width:8px;height:8px;border-radius:50%;background:#1E9E6A;box-shadow:0 0 0 3px rgba(30,158,106,.18)}',
      // Statut (segmented) + champs texte du rail droit
      '.mkt-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--card)}',
      '.mkt-seg button{background:none;border:0;font-family:inherit;min-height:40px;padding:0 10px;white-space:nowrap;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer}',
      '.mkt-seg button[aria-pressed="true"]{background:var(--card-2);color:var(--ip-ink)}',
      '.mkt-field{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:600;color:var(--muted)}',
      '.mkt-field input,.mkt-field textarea{font:inherit;font-size:16px;font-weight:500;color:var(--ip-ink);min-height:44px;padding:9px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);width:100%}',
      '.mkt-field textarea{min-height:64px;resize:vertical}',
      '.mkt-del-a{color:var(--muted)}',
      '.mkt-del-a:hover{color:var(--c-rose);border-color:color-mix(in srgb,var(--c-rose) 40%,var(--line))}',
      // le retournement de la feuille au changement de modèle (sur le holder, jamais sur #mkt-msheet qui porte déjà transform:scale())
      '#mkt-mholder{transition:transform .32s cubic-bezier(.4,0,.2,1);transform-style:preserve-3d}',
      '#mkt-mholder.mkt-turn{transform:rotateY(-92deg)}',
      // ── Le sélecteur devient le tiroir du bas (d1) : plein-bas, poignée, coins arrondis en haut ──
      '.mkt-pick-bd{position:fixed;inset:0;z-index:210;background:rgba(16,19,28,.45);display:flex;align-items:flex-end;justify-content:center;opacity:0;visibility:hidden;transition:opacity .3s var(--ease)}',
      '.mkt-pick-bd.open{opacity:1;visibility:visible}',
      '.mkt-pick{position:relative;width:100%;max-width:1180px;height:min(78vh,720px);background:var(--card);border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 1px 0 rgba(255,255,255,1) inset,0 -2px 0 rgba(11,31,77,.04),0 -30px 60px -20px rgba(11,31,77,.45);transform:translateY(104%);transition:transform .5s var(--ease)}',
      '.mkt-pick-bd.open .mkt-pick{transform:translateY(0)}',
      '.mkt-pick-grip{position:absolute;top:8px;left:50%;width:48px;height:6px;margin-left:-24px;border-radius:999px;background:linear-gradient(180deg,#DCE3F0,#B9C6DE)}',
      '@media(max-width:959px){.mkt-pick{height:92vh;border-radius:18px 18px 0 0}.mkt-pick-rail.mkt-pick-strip{width:auto;display:flex;flex-wrap:nowrap;align-items:center;gap:6px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;border-right:none;border-bottom:1px solid var(--line);padding:8px 12px}.mkt-pick-rail.mkt-pick-strip .mkt-fac{display:contents}.mkt-pick-rail.mkt-pick-strip .mkt-fac-t{display:none}.mkt-pick-rail.mkt-pick-strip .mkt-fchip{width:auto;flex:0 0 auto;min-height:44px;white-space:nowrap}}',
      // ── Mobile 390 : les tiroirs deviennent des bandes, la feuille reste au centre ──
      '@media(max-width:959px){.mkt-bench{grid-template-columns:minmax(0,1fr);gap:16px}.mkt-headline h1{font-size:24px}.mkt-rail{position:static;flex-direction:row;overflow-x:auto;gap:10px;margin:0 -14px;padding:4px 14px 10px;scroll-snap-type:x proximity;scrollbar-width:none}.mkt-rail::-webkit-scrollbar{display:none}.mkt-rail .mkt-drawer{flex:0 0 82%;max-width:320px;scroll-snap-align:start}.mkt-rail.right .mkt-drawer{flex-basis:88%}.mkt-chip,.mkt-seg button{min-height:44px}.mkt-fan{gap:10px}}',
      '@media(prefers-reduced-motion:reduce){',
        '.mkt-pick,.mkt-dialog,.mkt-drawer,.mkt-mini,.mkt-mtile,.mkt-tool,.mkt-pick-item{transition:none!important}',
        '.mkt-drawer:hover,.mkt-mini:hover,.mkt-mtile:hover,.mkt-pick-item:hover{transform:none!important}',
        '.mkt-sheetwrap,#mkt-home-wrap,#mkt-mholder{transform:none!important}',
      '}',
    ].join('');
    document.head.appendChild(s);
  }
})();
