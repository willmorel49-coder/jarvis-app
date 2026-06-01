// dashboard-v2.js — Refonte du dashboard classique avec les nouvelles data STATS.
// Override de window.renderDashboard après chargement de app.js.
// Source : window.CLIENTS, window.SALES_TOTAL, window.SALES_BY_MONTH, window.SALES_BY_SOUSFAMILLE, window.SALES_BY_PRODUCT, window.SALES_BY_CLIENT_MONTH, window.CATALOGUE_IP, window.STOCK.

(function () {
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

  function computeStats() {
    const clients = window.CLIENTS || [];
    let clientsActifs = 0, clientsPassifs = 0, prospectsHot = 0, prospectsCold = 0, totalCa = 0;
    const top10Clients = [];
    for (const p of clients) {
      const ca = p.ca2023 || 0;
      const hasGroupement = !!(p.gros1 || p.gros2 || (p.ecodage && String(p.ecodage).trim()));
      if (ca > 0) { clientsActifs++; totalCa += ca; top10Clients.push({ ...p, ca }); }
      else if (hasGroupement) clientsPassifs++;
      else if ((p.potentielGx || 0) > 0) prospectsHot++;
      else prospectsCold++;
    }
    top10Clients.sort((a, b) => b.ca - a.ca);
    return {
      total: clients.length,
      clientsActifs, clientsPassifs, prospectsHot, prospectsCold, totalCa,
      top10Clients: top10Clients.slice(0, 10),
    };
  }

  function renderDashboardV2() {
    const root = document.getElementById('dash-content');
    if (!root) return;
    const s = computeStats();
    const salesTotal = window.SALES_TOTAL || null;
    const salesMonth = window.SALES_BY_MONTH || {};
    const salesSF = window.SALES_BY_SOUSFAMILLE || {};
    const salesProd = window.SALES_BY_PRODUCT || {};
    const catIp = (window.CATALOGUE_IP || []).length;
    const stockTotal = window.STOCK ? Object.values(window.STOCK).reduce((sum, r) => sum + (r.dispo || 0), 0) : 0;

    // Mensuel : tableau bar chart
    const months = Object.keys(salesMonth).sort();
    const monthValues = months.map(m => salesMonth[m].ca);
    const monthMax = Math.max(...monthValues, 1);

    // Sous-familles
    const sfList = Object.entries(salesSF).sort((a, b) => b[1].ca - a[1].ca);

    // Top 10 produits
    const topProd = Object.entries(salesProd).sort((a, b) => b[1].ca - a[1].ca).slice(0, 10);

    root.innerHTML = `
      <div style="padding:20px;max-width:1280px;margin:0 auto;font-family:'DM Sans',sans-serif;color:#0B1F4D">

        <!-- HEADER -->
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#64748B;font-weight:700">Vue secteur · STATS Intégral Pharma</div>
            <h2 style="font-size:26px;font-weight:800;margin:4px 0 0;letter-spacing:-.5px">Tableau de bord</h2>
            ${salesTotal ? `<div style="font-size:13px;color:#64748B;margin-top:4px">Période ${salesTotal.premiere_date} → ${salesTotal.derniere_date} · ${fmtNum(salesTotal.lignes)} lignes · ${fmtNum(salesTotal.factures)} factures</div>` : ''}
          </div>
        </div>

        <!-- 6 KPI CARDS -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px">
          ${kpiCard('CA secteur', fmtEuro(salesTotal ? salesTotal.ca : s.totalCa), 'Cumulé sur la période', true)}
          ${kpiCard('Clients actifs', s.clientsActifs, 'Ont facturé')}
          ${kpiCard('Clients groupement', s.clientsPassifs, 'Membres partenaire')}
          ${kpiCard('Prospects chauds', s.prospectsHot, 'Potentiel Gx connu')}
          ${kpiCard('Catalogue IP', fmtNum(catIp), 'Produits référencés')}
          ${kpiCard('Stock dispo', fmtNum(stockTotal), 'Unités en stock')}
        </div>

        <!-- ÉVOLUTION MENSUELLE -->
        ${months.length ? `
        <h3 style="font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:28px 0 12px">Évolution mensuelle · CA secteur</h3>
        <div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:16px 18px;box-shadow:0 2px 8px rgba(11,31,77,.04)">
          <div style="display:grid;grid-template-columns:repeat(${months.length},1fr);gap:8px;align-items:end;height:160px">
            ${months.map(m => {
              const pct = Math.round((salesMonth[m].ca / monthMax) * 100);
              const noms = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
              const label = noms[parseInt(m.split('-')[1], 10) - 1] + ' ' + m.slice(2, 4);
              return `
                <div style="display:flex;flex-direction:column;align-items:center;gap:6px" title="${m} · ${fmtEuro(salesMonth[m].ca)} · ${fmtNum(salesMonth[m].lignes)} lignes">
                  <div style="width:100%;height:100px;display:flex;align-items:flex-end">
                    <div style="width:100%;height:${pct}%;min-height:4px;background:linear-gradient(180deg,#0057FF,#5856D6);border-radius:6px 6px 0 0"></div>
                  </div>
                  <div style="font-size:11px;font-weight:700;font-variant-numeric:tabular-nums">${fmtEuro(salesMonth[m].ca)}</div>
                  <div style="font-size:10px;color:#64748B;letter-spacing:.5px;text-transform:uppercase;font-weight:700">${label}</div>
                </div>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- 2 COLONNES : TOP 10 CLIENTS + TOP 10 PRODUITS -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:18px;margin-top:24px">
          <div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:16px 18px">
            <h3 style="font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:0 0 12px">Top 10 clients · CA réel</h3>
            ${s.top10Clients.length ? s.top10Clients.map((c, i) => `
              <div style="display:grid;grid-template-columns:24px 1fr auto;gap:10px;padding:8px 0;border-bottom:1px solid #F2F6FF;font-size:13px;align-items:center">
                <span style="color:#94A3B8;font-weight:700">${i + 1}</span>
                <div>
                  <div style="font-weight:700;color:#0B1F4D">${escapeHtml(c.nom)}</div>
                  <div style="font-size:11px;color:#64748B">${escapeHtml(c.ville || '—')} · ${escapeHtml(c.ecodage || 'Indé')}</div>
                </div>
                <span style="color:#14B86A;font-weight:800;font-variant-numeric:tabular-nums">${fmtEuro(c.ca)}</span>
              </div>
            `).join('') : '<div style="padding:20px;text-align:center;color:#94A3B8">Aucun client actif</div>'}
          </div>

          <div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:16px 18px">
            <h3 style="font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:0 0 12px">Top 10 produits · secteur</h3>
            ${topProd.length ? topProd.map(([artcode, p], i) => `
              <div style="display:grid;grid-template-columns:24px 1fr auto;gap:10px;padding:8px 0;border-bottom:1px solid #F2F6FF;font-size:12.5px;align-items:center">
                <span style="color:#94A3B8;font-weight:700">${i + 1}</span>
                <div>
                  <div style="font-weight:700;color:#0B1F4D;font-size:12px">${escapeHtml(p.designation)}</div>
                  <div style="font-size:10.5px;color:#64748B">${escapeHtml(p.sousfamille || '—')} · ${fmtNum(p.qte)} unités · ${p.nb_clients} clients</div>
                </div>
                <span style="color:#0057FF;font-weight:800;font-variant-numeric:tabular-nums;font-size:12px">${fmtEuro(p.ca)}</span>
              </div>
            `).join('') : '<div style="padding:20px;text-align:center;color:#94A3B8">Aucun produit</div>'}
          </div>
        </div>

        <!-- VENTILATION TRANCHE × CATÉGORIE -->
        <div id="ventilation-section" style="margin-top:32px"></div>

        <!-- SOUS-FAMILLES -->
        ${sfList.length ? `
        <h3 style="font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:28px 0 12px">Mix sous-familles · CA réel facturé</h3>
        <div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:16px 18px">
          ${(() => {
            const sfMax = Math.max(...sfList.map(([_, d]) => d.ca), 1);
            const sfTotal = sfList.reduce((s, [_, d]) => s + d.ca, 0);
            return sfList.map(([name, d]) => {
              const pct = Math.round((d.ca / sfMax) * 100);
              const ratio = sfTotal > 0 ? ((d.ca / sfTotal) * 100).toFixed(1) : '0';
              return `
                <div style="display:grid;grid-template-columns:140px 1fr 130px;gap:14px;align-items:center;padding:6px 0;font-size:13px">
                  <span style="font-weight:700;color:#0B1F4D">${escapeHtml(name)}</span>
                  <div style="background:#F2F6FF;border-radius:999px;height:10px;overflow:hidden">
                    <div style="background:linear-gradient(90deg,#0057FF,#A855F7);height:100%;width:${pct}%"></div>
                  </div>
                  <span style="font-variant-numeric:tabular-nums;color:#0B1F4D;font-weight:700;text-align:right">${fmtEuro(d.ca)} <span style="opacity:.5">· ${ratio}%</span></span>
                </div>`;
            }).join('');
          })()}
        </div>` : ''}

        <!-- FOOTER -->
        <div style="margin-top:32px;padding:12px;background:#EAF2FF;border-radius:10px;font-size:11px;color:#0B1F4D;text-align:center">
          Données natives : Etat détaillé STATS · ${salesTotal ? fmtNum(salesTotal.lignes) + ' lignes · ' + fmtNum(salesTotal.factures) + ' factures' : ''} · stock 01/06/2026 · catalogue IP ${fmtNum(catIp)} réf.
        </div>
      </div>
    `;

    // Monte la section Ventilation tranche × catégorie
    renderVentilation();
  }

  // ───────── VENTILATION TRANCHE × CATÉGORIE ───────────────────────────────
  const ventState = {
    metrique: 'CA',
    axe: 'sousfamille',
    tranches: 4,
    catFilter: 'all',
  };

  function getProductPrixUnit(p) {
    if (!p.qte || p.qte <= 0) return null;
    return p.ca / p.qte;
  }

  function buildTrancheBins(n) {
    // Bins prédéfinis (cohérents avec le Streamlit) puis adaptatifs
    if (n === 3) return { bins: [-Infinity, 10, 500, Infinity], labels: ['< 10 €', '10–500 €', '> 500 €'] };
    if (n === 4) return { bins: [-Infinity, 4.63, 501.47, 1532.5, Infinity], labels: ['< 4,63 €', '4,63–501 €', '501–1500 €', '> 1500 €'] };
    if (n === 5) return { bins: [-Infinity, 4.63, 50, 501.47, 1500, Infinity], labels: ['< 4,63 €', '4,63–50 €', '50–501 €', '501–1500 €', '> 1500 €'] };
    if (n === 6) return { bins: [-Infinity, 4.63, 20, 100, 501.47, 1500, Infinity], labels: ['< 4,63 €', '4,63–20 €', '20–100 €', '100–501 €', '501–1500 €', '> 1500 €'] };
    return { bins: [-Infinity, 4.63, 501.47, 1532.5, Infinity], labels: ['< 4,63 €', '4,63–501 €', '501–1500 €', '> 1500 €'] };
  }

  function getTrancheIdx(prix, bins) {
    if (prix === null || prix === undefined) return -1;
    for (let i = 0; i < bins.length - 1; i++) {
      if (prix > bins[i] && prix <= bins[i + 1]) return i;
    }
    return -1;
  }

  function computeVentilation() {
    const products = Object.entries(window.SALES_BY_PRODUCT || {}).map(([artcode, p]) => ({ artcode, ...p }));
    const { bins, labels } = buildTrancheBins(ventState.tranches);

    // Map vers tranche + catégorie
    const cells = {}; // {tranche: {cat: {ca, qte, marge, lignes, clients_set}}}
    const allCats = new Set();

    for (const p of products) {
      const prix = getProductPrixUnit(p);
      const trIdx = getTrancheIdx(prix, bins);
      if (trIdx < 0) continue;
      const trLabel = labels[trIdx];

      let cat;
      if (ventState.axe === 'sousfamille') {
        cat = p.sousfamille || '(non renseigné)';
      } else if (ventState.axe === 'segment') {
        // Segment métier dérivé : Froid si sousfamille=Froid, sinon Ophtalmologie, sinon Cond. Trim, sinon Autre
        const sf = (p.sousfamille || '').toLowerCase();
        if (sf.includes('froid')) cat = 'Froid';
        else if (sf.includes('ophtalmo')) cat = 'Ophtalmologie';
        else if (sf.includes('cond')) cat = 'Cond. Trimestriel';
        else if (sf.includes('exclu')) cat = 'Exclu';
        else cat = 'Autres';
      } else {
        cat = p.sousfamille || '(non renseigné)';
      }
      allCats.add(cat);

      if (!cells[trLabel]) cells[trLabel] = {};
      if (!cells[trLabel][cat]) cells[trLabel][cat] = { ca: 0, qte: 0, marge: 0, lignes: 0 };
      cells[trLabel][cat].ca += p.ca || 0;
      cells[trLabel][cat].qte += p.qte || 0;
      cells[trLabel][cat].marge += p.marge || 0;
      cells[trLabel][cat].lignes += 1;
    }

    // Tri colonnes par CA total desc
    const catList = Array.from(allCats);
    catList.sort((a, b) => {
      const caA = labels.reduce((s, t) => s + ((cells[t] && cells[t][a]) ? cells[t][a].ca : 0), 0);
      const caB = labels.reduce((s, t) => s + ((cells[t] && cells[t][b]) ? cells[t][b].ca : 0), 0);
      return caB - caA;
    });

    return { cells, labels, catList };
  }

  function renderVentilation() {
    const root = document.getElementById('ventilation-section');
    if (!root) return;
    const { cells, labels, catList } = computeVentilation();

    // Calcul totaux
    const colTotals = {};
    const rowTotals = {};
    let grandTotal = 0;
    for (const tr of labels) {
      rowTotals[tr] = 0;
      for (const cat of catList) {
        const cell = cells[tr] && cells[tr][cat];
        const val = cell ? cell[metricField(ventState.metrique)] : 0;
        rowTotals[tr] += val;
        colTotals[cat] = (colTotals[cat] || 0) + val;
        grandTotal += val;
      }
    }
    // Trouve max cellule pour heatmap
    let maxCellVal = 0;
    for (const tr of labels) for (const cat of catList) {
      const v = cells[tr] && cells[tr][cat] ? cells[tr][cat][metricField(ventState.metrique)] : 0;
      if (v > maxCellVal) maxCellVal = v;
    }

    const cellsHtml = labels.map(tr => {
      const rowCells = catList.map(cat => {
        const cell = cells[tr] && cells[tr][cat];
        const val = cell ? cell[metricField(ventState.metrique)] : 0;
        const intensity = maxCellVal > 0 ? val / maxCellVal : 0;
        const bg = `rgba(0, 87, 255, ${0.04 + intensity * 0.35})`;
        const fmt = formatMetric(val, ventState.metrique);
        return `<td style="padding:9px 10px;text-align:right;background:${bg};font-variant-numeric:tabular-nums;border-right:1px solid #fff;font-weight:${intensity > 0.5 ? '700' : '500'};color:${intensity > 0.5 ? '#fff' : '#0B1F4D'}">${fmt}</td>`;
      }).join('');
      const totalFmt = formatMetric(rowTotals[tr], ventState.metrique);
      return `<tr><td style="padding:9px 12px;font-weight:700;color:#0B1F4D;background:#F2F6FF;border-right:2px solid #0057FF">${tr}</td>${rowCells}<td style="padding:9px 10px;text-align:right;font-weight:800;background:#EAF2FF;color:#0B1F4D;font-variant-numeric:tabular-nums">${totalFmt}</td></tr>`;
    }).join('');

    const totalRowHtml = catList.map(cat => `<td style="padding:9px 10px;text-align:right;font-weight:800;background:#EAF2FF;color:#0B1F4D;font-variant-numeric:tabular-nums">${formatMetric(colTotals[cat] || 0, ventState.metrique)}</td>`).join('');

    root.innerHTML = `
      <h3 style="font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:0 0 12px">🎯 Ventilation tranche prix × catégorie</h3>

      <!-- Sélecteurs -->
      <div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:14px 16px;margin-bottom:14px;display:flex;gap:14px;flex-wrap:wrap;align-items:center">
        <label style="font-size:12px;color:#64748B;font-weight:700">
          Métrique
          <select id="vent-metric" style="margin-left:6px;padding:6px 10px;border-radius:8px;border:1px solid #E8EEFF;font-family:inherit;font-size:13px">
            <option value="CA" ${ventState.metrique==='CA'?'selected':''}>CA HT</option>
            <option value="QTE" ${ventState.metrique==='QTE'?'selected':''}>Quantité</option>
            <option value="LIGNES" ${ventState.metrique==='LIGNES'?'selected':''}>Nb références</option>
          </select>
        </label>
        <label style="font-size:12px;color:#64748B;font-weight:700">
          Axe catégorie
          <select id="vent-axe" style="margin-left:6px;padding:6px 10px;border-radius:8px;border:1px solid #E8EEFF;font-family:inherit;font-size:13px">
            <option value="sousfamille" ${ventState.axe==='sousfamille'?'selected':''}>Sous-famille</option>
            <option value="segment" ${ventState.axe==='segment'?'selected':''}>Segment métier</option>
          </select>
        </label>
        <label style="font-size:12px;color:#64748B;font-weight:700">
          Tranches
          <select id="vent-tranches" style="margin-left:6px;padding:6px 10px;border-radius:8px;border:1px solid #E8EEFF;font-family:inherit;font-size:13px">
            <option value="3" ${ventState.tranches===3?'selected':''}>3 tranches</option>
            <option value="4" ${ventState.tranches===4?'selected':''}>4 tranches</option>
            <option value="5" ${ventState.tranches===5?'selected':''}>5 tranches</option>
            <option value="6" ${ventState.tranches===6?'selected':''}>6 tranches</option>
          </select>
        </label>
      </div>

      <!-- Pivot table -->
      <div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(11,31,77,.04)">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead>
              <tr style="background:#0B1F4D;color:#fff">
                <th style="padding:11px 12px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase">Tranche</th>
                ${catList.map(c => `<th style="padding:11px 10px;text-align:right;font-size:11px;letter-spacing:.5px;font-weight:700;border-left:1px solid rgba(255,255,255,.1)">${escapeHtml(c)}</th>`).join('')}
                <th style="padding:11px 10px;text-align:right;font-size:11px;letter-spacing:1px;text-transform:uppercase;background:#1E3A5F">Total</th>
              </tr>
            </thead>
            <tbody>
              ${cellsHtml}
              <tr style="background:#EAF2FF;border-top:2px solid #0057FF">
                <td style="padding:11px 12px;font-weight:800;color:#0B1F4D;text-transform:uppercase;font-size:11px;letter-spacing:1px">Total</td>
                ${totalRowHtml}
                <td style="padding:11px 10px;text-align:right;font-weight:800;background:#0057FF;color:#fff;font-variant-numeric:tabular-nums;font-size:14px">${formatMetric(grandTotal, ventState.metrique)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style="font-size:11px;color:#94A3B8;margin-top:8px;text-align:center">
        💡 Heatmap : intensité bleue ∝ valeur cellule · Tri colonnes par total décroissant · Cross-check : total cellules = total tranche du tableau Abandon
      </div>
    `;

    // Handlers
    const metric = document.getElementById('vent-metric');
    const axe = document.getElementById('vent-axe');
    const tranches = document.getElementById('vent-tranches');
    if (metric) metric.addEventListener('change', e => { ventState.metrique = e.target.value; renderVentilation(); });
    if (axe) axe.addEventListener('change', e => { ventState.axe = e.target.value; renderVentilation(); });
    if (tranches) tranches.addEventListener('change', e => { ventState.tranches = parseInt(e.target.value, 10); renderVentilation(); });
  }

  function metricField(m) {
    if (m === 'CA') return 'ca';
    if (m === 'QTE') return 'qte';
    if (m === 'LIGNES') return 'lignes';
    return 'ca';
  }
  function formatMetric(val, metrique) {
    if (val == null) return '—';
    if (metrique === 'CA') return fmtEuro(val);
    if (metrique === 'QTE') return fmtNum(Math.round(val));
    if (metrique === 'LIGNES') return fmtNum(val);
    return fmtNum(val);
  }

  function kpiCard(label, value, sub, hero) {
    const bg = hero ? 'background:linear-gradient(135deg,#0057FF,#5856D6);color:#fff;border:none' : 'background:#fff;border:1px solid #E8EEFF';
    const labelColor = hero ? 'rgba(255,255,255,.7)' : '#64748B';
    const subColor = hero ? 'rgba(255,255,255,.7)' : '#94A3B8';
    return `
      <div style="${bg};border-radius:14px;padding:16px 18px">
        <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${labelColor};font-weight:800">${label}</div>
        <div style="font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;margin:4px 0 2px;letter-spacing:-.5px">${value}</div>
        <div style="font-size:11px;color:${subColor}">${sub}</div>
      </div>
    `;
  }

  // Override l'ancienne fonction renderDashboard.
  // function declarations top-level créent une propriété sur window, donc on peut écraser.
  function applyOverride() {
    if (typeof window.renderDashboard === 'function') {
      window.renderDashboard = renderDashboardV2;
      console.log('[dashboard-v2] override renderDashboard appliqué');
    } else {
      // app.js pas encore chargé, on retry après defer
      setTimeout(applyOverride, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyOverride);
  } else {
    applyOverride();
  }
})();
