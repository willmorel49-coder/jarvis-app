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
    const salesProd = window.SALES_BY_PRODUCT || {};
    const catIp = (window.CATALOGUE_IP || []).length;
    const stockTotal = window.STOCK ? Object.values(window.STOCK).reduce((sum, r) => sum + (r.dispo || 0), 0) : 0;

    // Mensuel : tableau bar chart
    const months = Object.keys(salesMonth).sort();
    const monthValues = months.map(m => salesMonth[m].ca);
    const monthMax = Math.max(...monthValues, 1);

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

        <!-- VENTILATION TRANCHE × CATÉGORIE (officielle IP) -->
        <div id="ventilation-section" style="margin-top:32px"></div>

        <!-- FOOTER -->
        <div style="margin-top:32px;padding:12px;background:#EAF2FF;border-radius:10px;font-size:11px;color:#0B1F4D;text-align:center">
          Données natives : Etat détaillé STATS · ${salesTotal ? fmtNum(salesTotal.lignes) + ' lignes · ' + fmtNum(salesTotal.factures) + ' factures' : ''} · stock 01/06/2026 · catalogue IP ${fmtNum(catIp)} réf.
        </div>
      </div>
    `;

    // Monte la section Ventilation tranche × catégorie
    renderVentilation();
  }

  // ───────── VENTILATION TRANCHE × CATÉGORIE (officiel IP) ─────────────────
  // 3 tranches prix officielles Intégral Pharma + 6 familles produits
  const ventState = { metrique: 'CA' };

  // Tranches officielles avec règle de remise
  const TRANCHES_IP = [
    { key: 'petit', min: 0,      max: 4.33,     label: 'Petit prix',    sub: '0 – 4,33 €',   remiseType: 'fixe', remiseVal: 0.18,  remiseLabel: '0,18 € fixe / unité' },
    { key: 'inter', min: 4.33,   max: 468,      label: 'Intermédiaire', sub: '4,33 – 468 €', remiseType: 'pct',  remiseVal: 3.9,   remiseLabel: '3,9 % sur CA' },
    { key: 'haut',  min: 468,    max: Infinity, label: 'Haut prix',     sub: '> 468 €',      remiseType: 'fixe', remiseVal: 19.50, remiseLabel: '19,50 € fixe / unité' },
  ];

  // Famille produit (6 valeurs métier) — basée sur ARTNATURE + AFMCODE + ARTSOUSFAMILLE
  // Sources de vérité (depuis stock.js qui contient les vraies valeurs Intégral Pharma) :
  //   ARTNATURE   ∈ {Referent, Generique, Generique Partenaire, Biosimilaire, #N/A}
  //   AFMCODE     = REMBSS (remboursé) ou autre (PARA, MED010, MED021, DM, DM_20, HORSMED, AUTRE → NR)
  //   ARTSOUSFAMILLE = Froid / Ophtalmologie / Cond. Trimestriel / Exclu / #N/A
  function getFamilleIP(salesProd, stockMatch) {
    const nature = ((stockMatch && stockMatch.nature) || '').trim();
    const afmcode = ((stockMatch && stockMatch.marque) || '').trim().toUpperCase(); // "marque" dans stock.js = AFMCODE
    const sousfamilleStock = ((stockMatch && stockMatch.sousfamille) || '').trim();
    const sousfamilleSales = ((salesProd && salesProd.sousfamille) || '').trim();

    // Ordre de priorité (mutuellement exclusif)
    if (nature === 'Biosimilaire') return 'Biosimilaires';
    const sfCombined = (sousfamilleStock + ' ' + sousfamilleSales).toLowerCase();
    if (sfCombined.includes('froid')) return 'Froid';
    // Non remboursé : AFMCODE ≠ REMBSS (et présent, sinon on ne sait pas)
    if (afmcode && afmcode !== 'REMBSS' && afmcode !== '#N/A' && afmcode !== '') return 'Non remboursés';
    if (nature === 'Generique Partenaire') return 'Gén. partenaires';
    if (nature === 'Generique') return 'Génériques';
    if (nature === 'Referent') return 'Princeps';
    return 'Princeps'; // fallback (incluant #N/A nature qui sont majoritairement princeps remboursés)
  }

  function getProductPrixUnit(p) {
    if (!p.qte || p.qte <= 0) return null;
    return p.ca / p.qte;
  }

  function getTrancheIP(prix) {
    if (prix === null || prix === undefined || prix <= 0) return null;
    for (const t of TRANCHES_IP) {
      if (prix > t.min && prix <= t.max) return t;
    }
    return null;
  }

  function computeVentilation() {
    const products = Object.entries(window.SALES_BY_PRODUCT || {}).map(([artcode, p]) => ({ artcode, ...p }));
    // Index direct sur STOCK (artcode -> {nature, marque/afmcode, sousfamille, ...})
    const stockIdx = window.STOCK || {};
    const FAMILLES = ['Froid', 'Biosimilaires', 'Génériques', 'Gén. partenaires', 'Non remboursés', 'Princeps'];

    const cells = {};
    for (const t of TRANCHES_IP) {
      cells[t.key] = {};
      for (const f of FAMILLES) cells[t.key][f] = { ca: 0, qte: 0, marge: 0, lignes: 0, remise_theo: 0 };
    }

    for (const p of products) {
      const prix = getProductPrixUnit(p);
      const tr = getTrancheIP(prix);
      if (!tr) continue;
      const stockMatch = stockIdx[p.artcode] || null;
      const famille = getFamilleIP(p, stockMatch);
      const cell = cells[tr.key][famille];
      cell.ca += p.ca || 0;
      cell.qte += p.qte || 0;
      cell.marge += p.marge || 0;
      cell.lignes += 1;
      // Remise théorique selon tranche
      if (tr.remiseType === 'fixe') {
        cell.remise_theo += tr.remiseVal * (p.qte || 0);
      } else {
        cell.remise_theo += (tr.remiseVal / 100) * (p.ca || 0);
      }
    }

    return { cells, tranches: TRANCHES_IP, familles: FAMILLES };
  }

  function renderVentilation() {
    const root = document.getElementById('ventilation-section');
    if (!root) return;
    const { cells, tranches, familles } = computeVentilation();

    // Totaux
    const colTotals = {};
    const rowTotals = {};
    let grandTotal = 0;
    for (const t of tranches) {
      rowTotals[t.key] = 0;
      for (const f of familles) {
        const val = cells[t.key][f][metricField(ventState.metrique)] || 0;
        rowTotals[t.key] += val;
        colTotals[f] = (colTotals[f] || 0) + val;
        grandTotal += val;
      }
    }
    let maxCellVal = 0;
    for (const t of tranches) for (const f of familles) {
      const v = cells[t.key][f][metricField(ventState.metrique)] || 0;
      if (v > maxCellVal) maxCellVal = v;
    }

    // Couleurs famille
    const FAMILLE_COLORS = {
      'Froid': '#00B5D8',
      'Biosimilaires': '#7C3AED',
      'Génériques': '#94A3B8',
      'Gén. partenaires': '#14B86A',
      'Non remboursés': '#FF9F1C',
      'Princeps': '#0057FF',
    };

    // Body rows
    const bodyRows = tranches.map(t => {
      const rowCells = familles.map(f => {
        const cell = cells[t.key][f];
        const val = cell[metricField(ventState.metrique)] || 0;
        const intensity = maxCellVal > 0 ? val / maxCellVal : 0;
        const fc = FAMILLE_COLORS[f] || '#0057FF';
        const fcRgb = hexToRgb(fc);
        const bg = `rgba(${fcRgb.r}, ${fcRgb.g}, ${fcRgb.b}, ${0.04 + intensity * 0.35})`;
        const fmt = formatMetric(val, ventState.metrique);
        const sub = val > 0 && ventState.metrique === 'CA' ? `<div style="font-size:9.5px;color:${intensity > 0.5 ? 'rgba(255,255,255,.7)' : '#94A3B8'};font-weight:500">${fmtNum(cell.qte)} u · ${cell.lignes} réf</div>` : '';
        return `<td style="padding:10px 10px;text-align:right;background:${bg};font-variant-numeric:tabular-nums;border-right:1px solid #fff;font-weight:${intensity > 0.5 ? '700' : '500'};color:${intensity > 0.5 ? '#fff' : '#0B1F4D'}">${fmt}${sub}</td>`;
      }).join('');
      const remiseTheoVal = tranches.reduce((s, tr) => 0, 0) + (
        // Calcul remise théorique pour cette tranche (somme sur toutes familles, hors NR car prix libre)
        familles.reduce((s, f) => f === 'Non remboursés' ? s : s + (cells[t.key][f].remise_theo || 0), 0)
      );
      return `<tr>
        <td style="padding:11px 14px;font-weight:700;color:#0B1F4D;background:#F2F6FF;border-right:2px solid #0057FF">
          <div>${t.label}</div>
          <div style="font-size:10.5px;color:#64748B;font-weight:600">${t.sub}</div>
          <div style="font-size:10px;color:#0057FF;font-weight:700;margin-top:2px">${t.remiseLabel}</div>
        </td>
        ${rowCells}
        <td style="padding:11px 10px;text-align:right;font-weight:800;background:#EAF2FF;color:#0B1F4D;font-variant-numeric:tabular-nums">${formatMetric(rowTotals[t.key], ventState.metrique)}</td>
      </tr>`;
    }).join('');

    // Total row
    const totalRowHtml = familles.map(f => `<td style="padding:11px 10px;text-align:right;font-weight:800;background:#EAF2FF;color:#0B1F4D;font-variant-numeric:tabular-nums">${formatMetric(colTotals[f] || 0, ventState.metrique)}</td>`).join('');

    // Remise théorique totale
    let remiseTheoTotal = 0;
    for (const t of tranches) for (const f of familles) {
      if (f === 'Non remboursés') continue;
      remiseTheoTotal += cells[t.key][f].remise_theo || 0;
    }
    const caTotal = tranches.reduce((s, t) => s + familles.reduce((ss, f) => ss + cells[t.key][f].ca, 0), 0);
    const tauxRemiseTheo = caTotal > 0 ? (remiseTheoTotal / caTotal * 100) : 0;

    root.innerHTML = `
      <h3 style="font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:0 0 12px">🎯 Ventilation tranche prix × famille produit · grille officielle IP</h3>

      <!-- Sélecteur métrique uniquement -->
      <div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;padding:12px 16px;margin-bottom:14px;display:flex;gap:14px;flex-wrap:wrap;align-items:center;justify-content:space-between">
        <label style="font-size:12px;color:#64748B;font-weight:700">
          Métrique affichée
          <select id="vent-metric" style="margin-left:6px;padding:6px 10px;border-radius:8px;border:1px solid #E8EEFF;font-family:inherit;font-size:13px">
            <option value="CA" ${ventState.metrique==='CA'?'selected':''}>CA HT</option>
            <option value="QTE" ${ventState.metrique==='QTE'?'selected':''}>Quantité</option>
            <option value="LIGNES" ${ventState.metrique==='LIGNES'?'selected':''}>Nb références</option>
            <option value="REMISE_THEO" ${ventState.metrique==='REMISE_THEO'?'selected':''}>Remise théorique €</option>
          </select>
        </label>
        <div style="font-size:11px;color:#0B1F4D;background:#EAF2FF;padding:6px 12px;border-radius:8px"><b>Remise théorique cumulée :</b> ${fmtEuro(remiseTheoTotal)} <span style="opacity:.6">(${tauxRemiseTheo.toFixed(1)}% du CA · hors NR)</span></div>
      </div>

      <!-- Pivot table -->
      <div style="background:#fff;border:1px solid #E8EEFF;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(11,31,77,.04)">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead>
              <tr style="background:#0B1F4D;color:#fff">
                <th style="padding:11px 14px;text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase">Tranche prix · remise</th>
                ${familles.map(f => `<th style="padding:11px 10px;text-align:right;font-size:11px;letter-spacing:.5px;font-weight:700;border-left:1px solid rgba(255,255,255,.1)"><div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${FAMILLE_COLORS[f]};margin-right:6px"></div>${escapeHtml(f)}</th>`).join('')}
                <th style="padding:11px 10px;text-align:right;font-size:11px;letter-spacing:1px;text-transform:uppercase;background:#1E3A5F">Total</th>
              </tr>
            </thead>
            <tbody>
              ${bodyRows}
              <tr style="background:#EAF2FF;border-top:2px solid #0057FF">
                <td style="padding:11px 14px;font-weight:800;color:#0B1F4D;text-transform:uppercase;font-size:11px;letter-spacing:1px">Total</td>
                ${totalRowHtml}
                <td style="padding:11px 10px;text-align:right;font-weight:800;background:#0057FF;color:#fff;font-variant-numeric:tabular-nums;font-size:14px">${formatMetric(grandTotal, ventState.metrique)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Légende -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-top:14px">
        ${tranches.map(t => `
          <div style="background:#fff;border:1px solid #E8EEFF;border-left:4px solid #0057FF;border-radius:10px;padding:10px 14px">
            <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">${t.label}</div>
            <div style="font-size:13px;color:#0B1F4D;font-weight:700;margin:2px 0">${t.sub}</div>
            <div style="font-size:11.5px;color:#0057FF;font-weight:700">${t.remiseLabel}</div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:10px;padding:10px 14px;background:#FFF7ED;border-left:4px solid #FF9F1C;border-radius:10px;font-size:11.5px;color:#7C2D12">
        ⚠ <b>Non remboursés (NR)</b> : marge variable — pas de remise standard. Le pharmacien achète au prix IP (mark-up ×1,03 sur prix d'achat), puis applique un prix libre selon grossiste / direct labo.
      </div>
    `;

    const metric = document.getElementById('vent-metric');
    if (metric) metric.addEventListener('change', e => { ventState.metrique = e.target.value; renderVentilation(); });
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 87, b: 255 };
  }

  function metricField(m) {
    if (m === 'CA') return 'ca';
    if (m === 'QTE') return 'qte';
    if (m === 'LIGNES') return 'lignes';
    if (m === 'REMISE_THEO') return 'remise_theo';
    return 'ca';
  }
  function formatMetric(val, metrique) {
    if (val == null || val === 0) return metrique === 'CA' || metrique === 'REMISE_THEO' ? '—' : '0';
    if (metrique === 'CA' || metrique === 'REMISE_THEO') return fmtEuro(val);
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
