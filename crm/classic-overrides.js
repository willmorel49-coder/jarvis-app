// classic-overrides.js — Refonte des pages du mode classique avec les nouvelles data STATS.
// Override des render functions après chargement de app.js.
// Aucune modification de app.js (8700 lignes intactes).

(function () {
  // ───────── Helpers ──────────────────────────────────────────────────────
  function fmtEuro(n) {
    if (!n) return '0 €';
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
    if (abs >= 1000) return `${(n / 1000).toFixed(0)} k€`;
    return `${Math.round(n)} €`;
  }
  function fmtNum(n) { return Number(n || 0).toLocaleString('fr-FR'); }
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function computeStatusClient(p) {
    if ((p.ca2023 || 0) > 0) return { key: 'actif', label: 'Client actif', color: '#0057FF' };
    const hasGroupement = !!(p.gros1 || p.gros2 || (p.ecodage && String(p.ecodage).trim()));
    if (hasGroupement) return { key: 'groupement', label: 'Client groupement', color: '#5B8DEF' };
    if ((p.potentielGx || 0) > 0) return { key: 'hot', label: 'Prospect chaud', color: '#FF9F1C' };
    return { key: 'cold', label: 'Prospect froid', color: '#8E8E93' };
  }
  function sectionHeader(title, sub) {
    return `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#64748B;font-weight:700">${sub || ''}</div>
        <h2 style="font-size:26px;font-weight:800;margin:4px 0 0;letter-spacing:-.5px;color:#0B1F4D">${escapeHtml(title)}</h2>
      </div>
    `;
  }
  function styleCard(extra = '') {
    return `background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:16px 18px;box-shadow:0 2px 8px rgba(11,31,77,.04);${extra}`;
  }

  // ───────── PHARMACIES ───────────────────────────────────────────────────
  const phState = { search: '', filter: 'all' };
  function renderPharmaciesV2() {
    const root = document.getElementById('pharma-content');
    if (!root) return;
    const all = window.CLIENTS || [];
    const stats = { actif: 0, groupement: 0, hot: 0, cold: 0 };
    for (const p of all) stats[computeStatusClient(p).key]++;
    const total = all.length;

    root.innerHTML = `
      <div style="padding:20px;max-width:1280px;margin:0 auto;font-family:'DM Sans',sans-serif">
        ${sectionHeader('Pharmacies du secteur', `${fmtNum(total)} officines · 8 dpts (14·35·37·44·49·50·53·72)`)}

        <!-- KPI status -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">
          ${miniKpi('Clients actifs', stats.actif, '#0057FF', 'CA WML/STATS')}
          ${miniKpi('Clients groupement', stats.groupement, '#5B8DEF', 'Partenaires IP')}
          ${miniKpi('Prospects chauds', stats.hot, '#FF9F1C', 'Potentiel Gx > 0')}
          ${miniKpi('Prospects froids', stats.cold, '#8E8E93', 'Sans potentiel')}
        </div>

        <!-- Toolbar -->
        <div style="${styleCard()};margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input id="ph-search" type="search" placeholder="Recherche nom / ville / CIP…" value="${escapeHtml(phState.search)}"
            style="flex:1;min-width:220px;padding:9px 14px;border-radius:999px;border:1px solid #E8EEFF;font-size:14px;font-family:inherit;color:#0B1F4D">
          ${filterBtn('all', 'Tous', total)}
          ${filterBtn('actif', '🔵 Clients actifs', stats.actif)}
          ${filterBtn('groupement', '🔷 Groupement', stats.groupement)}
          ${filterBtn('hot', '🟠 Prospects', stats.hot)}
        </div>

        <!-- Table -->
        <div id="ph-table" style="${styleCard('padding:0;overflow:hidden')}"></div>
      </div>
    `;

    const renderTable = () => {
      let list = all;
      if (phState.filter !== 'all') {
        list = list.filter(p => computeStatusClient(p).key === phState.filter);
      }
      if (phState.search) {
        const q = phState.search.toLowerCase();
        list = list.filter(p =>
          (p.nom || '').toLowerCase().includes(q) ||
          (p.ville || '').toLowerCase().includes(q) ||
          (p.cip || '').toString().includes(q)
        );
      }
      // Tri par CA desc, puis Potentiel desc
      list.sort((a, b) => (b.ca2023 || 0) - (a.ca2023 || 0) || (b.potentielGx || 0) - (a.potentielGx || 0));
      const top200 = list.slice(0, 200);

      const tbl = document.getElementById('ph-table');
      if (!tbl) return;
      tbl.innerHTML = `
        <div style="padding:10px 16px;font-size:11px;color:#64748B;background:#F2F6FF;font-weight:700;letter-spacing:1px;text-transform:uppercase;display:grid;grid-template-columns:1.6fr 0.8fr 0.6fr 0.9fr 0.7fr 0.7fr;gap:12px;align-items:center;border-bottom:1px solid #E8EEFF">
          <span>Officine</span><span>Ville</span><span>CIP</span><span>Statut</span><span style="text-align:right">CA</span><span style="text-align:right">Potentiel</span>
        </div>
        ${top200.map(p => {
          const s = computeStatusClient(p);
          return `
            <div style="padding:9px 16px;display:grid;grid-template-columns:1.6fr 0.8fr 0.6fr 0.9fr 0.7fr 0.7fr;gap:12px;align-items:center;font-size:13px;border-bottom:1px solid #F2F6FF">
              <span style="font-weight:600;color:#0B1F4D">${escapeHtml(p.nom)}</span>
              <span style="color:#64748B">${escapeHtml(p.ville || '—')}</span>
              <span style="font-family:monospace;font-size:11px;color:#94A3B8">${escapeHtml(p.cip || '—')}</span>
              <span><span style="background:${s.color}22;color:${s.color};padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700">${s.label}</span></span>
              <span style="text-align:right;font-variant-numeric:tabular-nums;font-weight:${(p.ca2023||0)>0?'800':'400'};color:${(p.ca2023||0)>0?'#14B86A':'#94A3B8'}">${(p.ca2023||0)>0?fmtEuro(p.ca2023):'—'}</span>
              <span style="text-align:right;font-variant-numeric:tabular-nums;color:#64748B">${(p.potentielGx||0)>0?fmtEuro(p.potentielGx):'—'}</span>
            </div>
          `;
        }).join('')}
        ${list.length > 200 ? `<div style="padding:14px;text-align:center;color:#94A3B8;font-size:12px">+ ${fmtNum(list.length - 200)} autres officines (affine la recherche)</div>` : ''}
      `;
    };
    renderTable();

    // Handlers
    const search = document.getElementById('ph-search');
    if (search) search.addEventListener('input', (e) => { phState.search = e.target.value.trim(); renderTable(); });
    document.querySelectorAll('[data-ph-filter]').forEach(btn => {
      btn.addEventListener('click', () => { phState.filter = btn.dataset.phFilter; renderPharmaciesV2(); });
    });
  }
  function filterBtn(key, label, count) {
    const active = phState.filter === key;
    return `<button data-ph-filter="${key}" style="padding:8px 14px;border-radius:999px;border:1px solid ${active?'#0057FF':'#E8EEFF'};background:${active?'#0057FF':'#fff'};color:${active?'#fff':'#0B1F4D'};font-size:12px;font-weight:700;cursor:pointer">${label} <span style="opacity:.6">${fmtNum(count)}</span></button>`;
  }
  function miniKpi(label, value, color, sub) {
    return `<div style="${styleCard()};border-left:4px solid ${color}">
      <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800">${label}</div>
      <div style="font-size:24px;font-weight:800;color:#0B1F4D;font-variant-numeric:tabular-nums;margin:2px 0">${fmtNum(value)}</div>
      <div style="font-size:11px;color:#94A3B8">${sub}</div>
    </div>`;
  }

  // ───────── PRODUITS (Analyse Portefeuille) ──────────────────────────────
  const prodState = { search: '', sfFilter: 'all' };
  function renderProduitsV2() {
    const root = document.getElementById('prod-content');
    if (!root) return;
    const salesProd = window.SALES_BY_PRODUCT || {};
    const salesSF = window.SALES_BY_SOUSFAMILLE || {};
    const sfList = Object.keys(salesSF).sort((a, b) => salesSF[b].ca - salesSF[a].ca);

    root.innerHTML = `
      <div style="padding:20px;max-width:1280px;margin:0 auto;font-family:'DM Sans',sans-serif">
        ${sectionHeader('Analyse portefeuille produits', `${fmtNum(Object.keys(salesProd).length)} références facturées · STATS détaillé`)}

        <!-- Sous-familles -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px">
          ${sfList.map(sf => `
            <div style="${styleCard()};cursor:pointer" onclick="(window.__setProdSf||function(){})('${escapeHtml(sf)}')">
              <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800">${escapeHtml(sf)}</div>
              <div style="font-size:22px;font-weight:800;color:#0B1F4D;margin:2px 0;font-variant-numeric:tabular-nums">${fmtEuro(salesSF[sf].ca)}</div>
              <div style="font-size:11px;color:#94A3B8">${fmtNum(salesSF[sf].qte)} unités · ${fmtNum(salesSF[sf].lignes)} lignes</div>
            </div>
          `).join('')}
        </div>

        <!-- Toolbar -->
        <div style="${styleCard()};margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <input id="prod-search" type="search" placeholder="Recherche produit…" value="${escapeHtml(prodState.search)}"
            style="flex:1;min-width:220px;padding:9px 14px;border-radius:999px;border:1px solid #E8EEFF;font-size:14px;font-family:inherit;color:#0B1F4D">
          <select id="prod-sf" style="padding:9px 14px;border-radius:999px;border:1px solid #E8EEFF;font-size:13px;font-family:inherit">
            <option value="all">Toutes sous-familles</option>
            ${sfList.map(sf => `<option value="${escapeHtml(sf)}" ${prodState.sfFilter===sf?'selected':''}>${escapeHtml(sf)}</option>`).join('')}
          </select>
        </div>

        <div id="prod-table" style="${styleCard('padding:0;overflow:hidden')}"></div>
      </div>
    `;

    window.__setProdSf = (sf) => { prodState.sfFilter = sf; renderProduitsV2(); };

    const renderProdTable = () => {
      const all = Object.entries(salesProd).map(([artcode, p]) => ({ artcode, ...p }));
      let list = all;
      if (prodState.sfFilter !== 'all') list = list.filter(p => p.sousfamille === prodState.sfFilter);
      if (prodState.search) {
        const q = prodState.search.toLowerCase();
        list = list.filter(p => (p.designation || '').toLowerCase().includes(q) || (p.artcode || '').includes(q));
      }
      list.sort((a, b) => b.ca - a.ca);
      const top100 = list.slice(0, 100);
      const tbl = document.getElementById('prod-table');
      if (!tbl) return;
      tbl.innerHTML = `
        <div style="padding:10px 16px;font-size:11px;color:#64748B;background:#F2F6FF;font-weight:700;letter-spacing:1px;text-transform:uppercase;display:grid;grid-template-columns:30px 1fr 1fr 0.7fr 0.6fr 0.6fr;gap:12px;align-items:center;border-bottom:1px solid #E8EEFF">
          <span>#</span><span>Désignation</span><span>Sous-famille</span><span style="text-align:right">CA</span><span style="text-align:right">Qté</span><span style="text-align:right">Clients</span>
        </div>
        ${top100.map((p, i) => `
          <div style="padding:9px 16px;display:grid;grid-template-columns:30px 1fr 1fr 0.7fr 0.6fr 0.6fr;gap:12px;align-items:center;font-size:13px;border-bottom:1px solid #F2F6FF">
            <span style="color:#94A3B8;font-weight:700">${i + 1}</span>
            <span style="font-weight:600;color:#0B1F4D">${escapeHtml(p.designation)}</span>
            <span style="color:#64748B;font-size:12px">${escapeHtml(p.sousfamille || '—')}</span>
            <span style="text-align:right;color:#0057FF;font-weight:800;font-variant-numeric:tabular-nums">${fmtEuro(p.ca)}</span>
            <span style="text-align:right;color:#0B1F4D;font-variant-numeric:tabular-nums">${fmtNum(p.qte)}</span>
            <span style="text-align:right;color:#64748B;font-variant-numeric:tabular-nums">${p.nb_clients}</span>
          </div>
        `).join('')}
      `;
    };
    renderProdTable();
    const ps = document.getElementById('prod-search');
    if (ps) ps.addEventListener('input', (e) => { prodState.search = e.target.value.trim(); renderProdTable(); });
    const psf = document.getElementById('prod-sf');
    if (psf) psf.addEventListener('change', (e) => { prodState.sfFilter = e.target.value; renderProdTable(); });
  }

  // ───────── CATALOGUE IP ─────────────────────────────────────────────────
  const catState = { search: '', tab: 'Tous' };
  function renderCatalogueV2() {
    const root = document.getElementById('cat-content');
    if (!root) return;
    const all = window.CATALOGUE_IP || [];
    const cats = ['Tous', ...Array.from(new Set(all.map(p => p.categorie).filter(Boolean)))];

    root.innerHTML = `
      <div style="padding:20px;max-width:1280px;margin:0 auto;font-family:'DM Sans',sans-serif">
        ${sectionHeader('Catalogue Intégral Pharma', `${fmtNum(all.length)} produits · TOP IP DÉCROISSANT`)}

        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
          ${cats.map(c => {
            const count = c === 'Tous' ? all.length : all.filter(p => p.categorie === c).length;
            const active = catState.tab === c;
            return `<button data-cat-tab="${escapeHtml(c)}" style="padding:8px 16px;border-radius:999px;border:1px solid ${active?'#0057FF':'#E8EEFF'};background:${active?'#0057FF':'#fff'};color:${active?'#fff':'#0B1F4D'};font-size:13px;font-weight:700;cursor:pointer">${escapeHtml(c)} <span style="opacity:.6">${count}</span></button>`;
          }).join('')}
        </div>

        <div style="${styleCard()};margin-bottom:14px;display:flex;gap:10px">
          <input id="cat-search" type="search" placeholder="Recherche EAN / nom / molécule…" value="${escapeHtml(catState.search)}"
            style="flex:1;padding:9px 14px;border-radius:999px;border:1px solid #E8EEFF;font-size:14px;font-family:inherit;color:#0B1F4D">
        </div>

        <div id="cat-grid"></div>
      </div>
    `;

    const renderCatGrid = () => {
      let list = catState.tab === 'Tous' ? all : all.filter(p => p.categorie === catState.tab);
      if (catState.search) {
        const q = catState.search.toLowerCase();
        list = list.filter(p =>
          (p.nom || '').toLowerCase().includes(q) ||
          (p.molecule || '').toLowerCase().includes(q) ||
          (p.ean || '').includes(q) ||
          (p.marque || '').toLowerCase().includes(q)
        );
      }
      list.sort((a, b) => (b.prix_ip || 0) - (a.prix_ip || 0));
      const top200 = list.slice(0, 200);
      const grid = document.getElementById('cat-grid');
      if (!grid) return;
      grid.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
          ${top200.map(p => `
            <div style="${styleCard('padding:14px')}">
              <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#94A3B8;font-weight:700">${escapeHtml(p.marque || '—')} ${p.froid ? '· ❄️' : ''}</div>
              <div style="font-size:13px;font-weight:700;color:#0B1F4D;margin:4px 0;line-height:1.3;min-height:34px">${escapeHtml(p.nom)}</div>
              <div style="font-size:11px;color:#64748B;font-style:italic;margin-bottom:8px">${escapeHtml(p.molecule || '')}</div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;font-variant-numeric:tabular-nums">
                <span style="font-size:11px;color:#94A3B8;text-decoration:line-through">${p.prix_ht ? p.prix_ht.toFixed(2)+' €' : '—'}</span>
                <span style="font-size:18px;font-weight:800;color:#0057FF">${p.prix_ip ? p.prix_ip.toFixed(2)+' €' : '—'}</span>
              </div>
              ${p.remise_pct ? `<div style="margin-top:6px"><span style="background:#14B86A22;color:#14B86A;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">-${p.remise_pct.toFixed(1)}%</span></div>` : ''}
              <div style="font-size:10px;color:#94A3B8;margin-top:6px">EAN ${escapeHtml(p.ean)}</div>
            </div>
          `).join('')}
        </div>
        ${list.length > 200 ? `<div style="padding:14px;text-align:center;color:#94A3B8;font-size:12px">+ ${list.length - 200} autres (affine la recherche)</div>` : ''}
      `;
    };
    renderCatGrid();
    document.querySelectorAll('[data-cat-tab]').forEach(btn => {
      btn.addEventListener('click', () => { catState.tab = btn.dataset.catTab; renderCatalogueV2(); });
    });
    const cs = document.getElementById('cat-search');
    if (cs) cs.addEventListener('input', (e) => { catState.search = e.target.value.trim(); renderCatGrid(); });
  }

  // ───────── IMPORT (transformé en "Sources natives") ─────────────────────
  function renderImportV2() {
    const root = document.getElementById('import-content');
    if (!root) return;
    const sources = [
      { name: 'CLIENTS', count: (window.CLIENTS || []).length, src: 'clients-data.js (BASE DE DONNÉE IP WM + WML)' },
      { name: 'PHARMACIES_GEO', count: Object.keys(window.PHARMACIES_GEO || {}).length, src: 'pharmacies-geo.js (api-adresse.data.gouv.fr)' },
      { name: 'CATALOGUE_IP', count: (window.CATALOGUE_IP || []).length, src: 'catalogue-ip.js (TOP IP DÉCROISSANT.xlsb)' },
      { name: 'CLIENT_PRODUCTS', count: Object.keys(window.CLIENT_PRODUCTS || {}).length, src: 'client-products.js (Etat synthèse par article)' },
      { name: 'STOCK', count: Object.keys(window.STOCK || {}).length, src: 'stock.js (stock 01/06/2026)' },
      { name: 'SALES_BY_PRODUCT', count: Object.keys(window.SALES_BY_PRODUCT || {}).length, src: 'sales-detail.js (Etat détaillé STATS)' },
      { name: 'OFFILOG', count: (window.OFFILOG || []).length, src: 'offilog-data.js (parapharmacie)' },
      { name: 'BENCHMARK', count: (window.BENCHMARK || []).length, src: 'benchmark-data.js' },
    ];
    const total = window.SALES_TOTAL;
    root.innerHTML = `
      <div style="padding:20px;max-width:980px;margin:0 auto;font-family:'DM Sans',sans-serif">
        ${sectionHeader('Sources de données natives', 'Plus besoin d\'importer · tout est généré depuis les Excel du dossier projet')}

        <div style="${styleCard()};margin-bottom:16px;border-left:4px solid #14B86A">
          <div style="font-size:14px;font-weight:700;color:#0B1F4D;margin-bottom:6px">✓ Données chargées automatiquement</div>
          <div style="font-size:13px;color:#64748B;line-height:1.6">Les fichiers Excel du dossier <code style="background:#F2F6FF;padding:2px 6px;border-radius:4px;font-size:12px">/STATS/</code>, <code style="background:#F2F6FF;padding:2px 6px;border-radius:4px;font-size:12px">/WML_*.xlsx</code>, <code style="background:#F2F6FF;padding:2px 6px;border-radius:4px;font-size:12px">/BASE DE DONNÉE IP WM.xlsx</code> sont transformés en fichiers JS (.js) par des scripts Python. Le navigateur les charge instantanément sans manipulation côté UI.</div>
        </div>

        ${total ? `
        <div style="${styleCard()};margin-bottom:16px">
          <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800">Période couverte STATS détaillé</div>
          <div style="font-size:18px;font-weight:800;color:#0B1F4D;margin:4px 0">${total.premiere_date} → ${total.derniere_date}</div>
          <div style="font-size:12px;color:#64748B">${fmtNum(total.lignes)} lignes · ${fmtNum(total.factures)} factures · CA cumulé ${fmtEuro(total.ca)}</div>
        </div>
        ` : ''}

        <div style="${styleCard('padding:0')}">
          ${sources.map(s => `
            <div style="padding:14px 18px;border-bottom:1px solid #F2F6FF;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center">
              <div>
                <div style="font-family:monospace;font-size:11px;color:#0057FF;font-weight:700">window.${s.name}</div>
                <div style="font-size:12px;color:#64748B;margin-top:2px">${escapeHtml(s.src)}</div>
              </div>
              <div style="font-size:18px;font-weight:800;color:#0B1F4D;font-variant-numeric:tabular-nums">${fmtNum(s.count)}</div>
            </div>
          `).join('')}
        </div>

        <div style="${styleCard()};margin-top:16px;border-left:4px solid #FF9F1C">
          <div style="font-size:13px;font-weight:700;color:#0B1F4D;margin-bottom:4px">Pour actualiser les données</div>
          <div style="font-size:12px;color:#64748B;line-height:1.7">1. Mets à jour les Excel sources dans le dossier projet<br>2. Lance le script Python correspondant (<code>sync_stats_clients.py</code>, <code>generate_sales_detail.py</code>, <code>geocode_pharmacies.py</code>, etc.)<br>3. <code>git push</code> → l'app reflète la nouvelle data dans la minute</div>
        </div>
      </div>
    `;
  }

  // ───────── OBJECTIFS ────────────────────────────────────────────────────
  function renderObjectifsV2() {
    const root = document.getElementById('objectifs-content');
    if (!root) return;
    const months = window.SALES_BY_MONTH || {};
    const sorted = Object.keys(months).sort();
    if (!sorted.length) { root.innerHTML = `<div style="padding:40px;text-align:center;color:#94A3B8">Pas de données STATS</div>`; return; }
    const last = sorted[sorted.length - 1];
    const lastCa = months[last].ca;
    const objMensuel = 200000; // objectif fictif 200k€/mois — ajustable
    const objCumul = objMensuel * sorted.length;
    const cumulCa = sorted.reduce((s, m) => s + months[m].ca, 0);
    const pctMonth = Math.min(100, (lastCa / objMensuel) * 100);
    const pctCumul = Math.min(100, (cumulCa / objCumul) * 100);

    root.innerHTML = `
      <div style="padding:20px;max-width:980px;margin:0 auto;font-family:'DM Sans',sans-serif">
        ${sectionHeader('Objectifs commerciaux', `Période STATS · ${sorted.length} mois`)}

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:20px">
          <div style="${styleCard()}">
            <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800">Mois en cours · ${last}</div>
            <div style="font-size:28px;font-weight:800;color:#0B1F4D;font-variant-numeric:tabular-nums;margin:4px 0">${fmtEuro(lastCa)} <span style="font-size:14px;color:#94A3B8">/ ${fmtEuro(objMensuel)}</span></div>
            <div style="background:#F2F6FF;border-radius:999px;height:10px;overflow:hidden;margin-top:8px"><div style="background:linear-gradient(90deg,#0057FF,#5856D6);height:100%;width:${pctMonth}%"></div></div>
            <div style="font-size:11px;color:#64748B;margin-top:6px">${pctMonth.toFixed(0)}% de l'objectif</div>
          </div>
          <div style="${styleCard()}">
            <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800">Cumul ${sorted.length} mois</div>
            <div style="font-size:28px;font-weight:800;color:#0B1F4D;font-variant-numeric:tabular-nums;margin:4px 0">${fmtEuro(cumulCa)} <span style="font-size:14px;color:#94A3B8">/ ${fmtEuro(objCumul)}</span></div>
            <div style="background:#F2F6FF;border-radius:999px;height:10px;overflow:hidden;margin-top:8px"><div style="background:linear-gradient(90deg,#14B86A,#0057FF);height:100%;width:${pctCumul}%"></div></div>
            <div style="font-size:11px;color:#64748B;margin-top:6px">${pctCumul.toFixed(0)}% du cumulé</div>
          </div>
        </div>

        <h3 style="font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:24px 0 12px">Détail par mois</h3>
        <div style="${styleCard('padding:0')}">
          ${sorted.map(m => {
            const noms = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
            const lbl = noms[parseInt(m.split('-')[1], 10) - 1] + ' ' + m.split('-')[0];
            const pct = Math.min(100, (months[m].ca / objMensuel) * 100);
            const color = pct >= 100 ? '#14B86A' : pct >= 70 ? '#FF9F1C' : '#F43F5E';
            return `
              <div style="padding:12px 18px;display:grid;grid-template-columns:100px 1fr 100px 60px;gap:12px;align-items:center;border-bottom:1px solid #F2F6FF">
                <span style="font-weight:700;color:#0B1F4D">${lbl}</span>
                <div style="background:#F2F6FF;border-radius:999px;height:8px;overflow:hidden"><div style="background:${color};height:100%;width:${pct}%"></div></div>
                <span style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:#0B1F4D">${fmtEuro(months[m].ca)}</span>
                <span style="text-align:right;font-variant-numeric:tabular-nums;color:${color};font-weight:700;font-size:12px">${pct.toFixed(0)}%</span>
              </div>
            `;
          }).join('')}
        </div>

        <div style="font-size:11px;color:#94A3B8;margin-top:14px;text-align:center">Objectif mensuel par défaut : ${fmtEuro(objMensuel)} · à ajuster dans dashboard-v2.js si besoin</div>
      </div>
    `;
  }

  // ───────── Apply overrides ──────────────────────────────────────────────
  function applyOverrides() {
    let applied = 0;
    if (typeof window.renderPharmacies === 'function') { window.renderPharmacies = renderPharmaciesV2; applied++; }
    if (typeof window.renderProduits === 'function')   { window.renderProduits   = renderProduitsV2;   applied++; }
    if (typeof window.renderCatalogue === 'function')  { window.renderCatalogue  = renderCatalogueV2;  applied++; }
    if (typeof window.renderImport === 'function')     { window.renderImport     = renderImportV2;     applied++; }
    if (typeof window.renderObjectifs === 'function')  { window.renderObjectifs  = renderObjectifsV2;  applied++; }
    if (applied < 5) {
      setTimeout(applyOverrides, 100);
    } else {
      console.log('[classic-overrides] ' + applied + ' renders override appliqués (Pharmacies, Produits, Catalogue, Import, Objectifs)');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyOverrides);
  } else {
    applyOverrides();
  }
})();
