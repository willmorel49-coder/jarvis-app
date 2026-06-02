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

  // Logique famille produit (partagée entre client & secteur OPS)
  function familleFromAttrs(nature, afmcode, sousfamille) {
    const n = (nature || '').trim();
    const a = (afmcode || '').trim().toUpperCase();
    const sf = (sousfamille || '').toLowerCase();
    if (n === 'Biosimilaire') return 'Biosimilaires';
    if (sf.includes('froid')) return 'Froid';
    if (a && a !== 'REMBSS' && a !== '#N/A' && a !== '') return 'Non remboursés';
    if (n === 'Generique Partenaire') return 'Gén. partenaires';
    if (n === 'Generique') return 'Génériques';
    return 'Princeps';
  }
  function trancheFromPrix(prix) {
    if (prix <= 4.33) return 'petit';
    if (prix <= 468) return 'inter';
    return 'haut';
  }

  // Agrégat OPS Nantes par famille (mémoïsé)
  let __OPS_BY_FAMILLE = null;
  function getOpsMixByFamille() {
    if (__OPS_BY_FAMILLE) return __OPS_BY_FAMILLE;
    const agg = window.OPS_AGGREGATE || {};
    const fams = { 'Froid': 0, 'Biosimilaires': 0, 'Génériques': 0, 'Gén. partenaires': 0, 'Non remboursés': 0, 'Princeps': 0 };
    let total = 0;
    for (const code in agg) {
      const p = agg[code];
      const fam = familleFromAttrs(p.nature, p.afmcode, p.sousfamille);
      fams[fam] = (fams[fam] || 0) + (p.ca || 0);
      total += p.ca || 0;
    }
    __OPS_BY_FAMILLE = { fams, total };
    return __OPS_BY_FAMILLE;
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
        <div style="padding:10px 16px;font-size:11px;color:#64748B;background:#F2F6FF;font-weight:700;letter-spacing:1px;text-transform:uppercase;display:grid;grid-template-columns:1.6fr 0.8fr 0.6fr 0.9fr 0.7fr 0.7fr 30px;gap:12px;align-items:center;border-bottom:1px solid #E8EEFF">
          <span>Officine</span><span>Ville</span><span>CIP</span><span>Statut</span><span style="text-align:right">CA</span><span style="text-align:right">Potentiel</span><span></span>
        </div>
        ${top200.map(p => {
          const s = computeStatusClient(p);
          return `
            <div data-ph-cip="${escapeHtml(p.cip)}" style="padding:9px 16px;display:grid;grid-template-columns:1.6fr 0.8fr 0.6fr 0.9fr 0.7fr 0.7fr 30px;gap:12px;align-items:center;font-size:13px;border-bottom:1px solid #F2F6FF;cursor:pointer;transition:background .1s" onmouseover="this.style.background='#F8FAFF'" onmouseout="this.style.background=''">
              <span style="font-weight:600;color:#0B1F4D">${escapeHtml(p.nom)}</span>
              <span style="color:#64748B">${escapeHtml(p.ville || '—')}</span>
              <span style="font-family:monospace;font-size:11px;color:#94A3B8">${escapeHtml(p.cip || '—')}</span>
              <span><span style="background:${s.color}22;color:${s.color};padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700">${s.label}</span></span>
              <span style="text-align:right;font-variant-numeric:tabular-nums;font-weight:${(p.ca2023||0)>0?'800':'400'};color:${(p.ca2023||0)>0?'#14B86A':'#94A3B8'}">${(p.ca2023||0)>0?fmtEuro(p.ca2023):'—'}</span>
              <span style="text-align:right;font-variant-numeric:tabular-nums;color:#64748B">${(p.potentielGx||0)>0?fmtEuro(p.potentielGx):'—'}</span>
              <span style="text-align:right;color:#0057FF;font-size:14px">→</span>
            </div>
          `;
        }).join('')}
        ${list.length > 200 ? `<div style="padding:14px;text-align:center;color:#94A3B8;font-size:12px">+ ${fmtNum(list.length - 200)} autres officines (affine la recherche)</div>` : ''}
      `;
      // Click handlers on rows
      tbl.querySelectorAll('[data-ph-cip]').forEach(row => {
        row.addEventListener('click', () => renderPharmaDetail(row.dataset.phCip));
      });
    };
    renderTable();

    // Handlers
    const search = document.getElementById('ph-search');
    if (search) search.addEventListener('input', (e) => { phState.search = e.target.value.trim(); renderTable(); });
    document.querySelectorAll('[data-ph-filter]').forEach(btn => {
      btn.addEventListener('click', () => { phState.filter = btn.dataset.phFilter; renderPharmaciesV2(); });
    });
  }

  // ───────── DÉTAIL PHARMACIE (analyse complète) ──────────────────────────
  function renderPharmaDetail(cip) {
    const root = document.getElementById('pharma-content');
    if (!root) return;
    const all = window.CLIENTS || [];
    const p = all.find(x => x.cip === cip);
    if (!p) { root.innerHTML = `<div style="padding:40px;text-align:center;color:#94A3B8">Pharmacie introuvable</div>`; return; }

    const status = computeStatusClient(p);
    const monthly = window.SALES_BY_CLIENT_MONTH && window.SALES_BY_CLIENT_MONTH[cip];
    const detail = window.SALES_BY_CLIENT_DETAIL && window.SALES_BY_CLIENT_DETAIL[cip];
    const topProducts = window.CLIENT_PRODUCTS && window.CLIENT_PRODUCTS[cip];
    const totalCa = (window.CLIENT_PRODUCTS_TOTAL_CA && window.CLIENT_PRODUCTS_TOTAL_CA[cip]) || (topProducts ? topProducts.reduce((s, pp) => s + (pp.ca || 0), 0) : 0);

    // % du secteur
    const sectorCa = (window.SALES_TOTAL && window.SALES_TOTAL.ca) || 0;
    const pctSecteur = sectorCa > 0 ? (totalCa / sectorCa * 100) : 0;

    // Timeline
    const months = monthly ? Object.keys(monthly).sort() : [];
    const monthVals = months.map(m => monthly[m].ca);
    const monthMax = Math.max(...monthVals, 1);

    // Famille produit ventilation pour ce client
    const stockIdx = window.STOCK || {};
    const ventCells = {};
    const TRANCHES = [
      { key: 'petit', max: 4.33, label: 'Petit prix', sub: '0 – 4,33 €', remise: '0,18 € fixe' },
      { key: 'inter', max: 468, label: 'Intermédiaire', sub: '4,33 – 468 €', remise: '3,9 %' },
      { key: 'haut', max: Infinity, label: 'Haut prix', sub: '> 468 €', remise: '19,50 € fixe' },
    ];
    const FAMILLES = ['Froid', 'Biosimilaires', 'Génériques', 'Gén. partenaires', 'Non remboursés', 'Princeps'];
    for (const t of TRANCHES) {
      ventCells[t.key] = {};
      for (const f of FAMILLES) ventCells[t.key][f] = { ca: 0, qte: 0 };
    }
    const clientFamCa = { 'Froid': 0, 'Biosimilaires': 0, 'Génériques': 0, 'Gén. partenaires': 0, 'Non remboursés': 0, 'Princeps': 0 };
    let clientFamTotal = 0;
    const clientArtCodes = new Set();
    if (topProducts) {
      for (const prod of topProducts) {
        if (!prod.qte || prod.qte <= 0) continue;
        clientArtCodes.add(prod.artcode);
        const prixUnit = prod.ca / prod.qte;
        const trKey = trancheFromPrix(prixUnit);
        const stockMatch = stockIdx[prod.artcode];
        const nature = (stockMatch && stockMatch.nature) || '';
        const afmcode = (stockMatch && stockMatch.marque) || '';
        const sf = (stockMatch && stockMatch.sousfamille) || '';
        const fam = familleFromAttrs(nature, afmcode, sf);
        ventCells[trKey][fam].ca += prod.ca;
        ventCells[trKey][fam].qte += prod.qte;
        clientFamCa[fam] += prod.ca;
        clientFamTotal += prod.ca;
      }
    }

    // Comparatif vs secteur OPS Nantes
    const opsMix = getOpsMixByFamille();
    const opsAgg = window.OPS_AGGREGATE || {};

    // Top opportunités : top produits OPS Nantes que ce client n'achète pas (ou peu)
    const opportunites = [];
    for (const code in opsAgg) {
      if (clientArtCodes.has(code)) continue;
      const op = opsAgg[code];
      if (!op.ca || op.ca <= 0) continue;
      opportunites.push({ code, ...op });
    }
    opportunites.sort((a, b) => b.ca - a.ca);
    const topOpp = opportunites.slice(0, 12);

    // Logiciel d'officine
    const logiciel = p.logiciel || '';
    const enseigne = p.enseigne || '';
    const structure = p.structure || '';
    const contact = p.contact || '';
    const uga = p.uga || '';

    root.innerHTML = `
      <div style="padding:20px;max-width:1280px;margin:0 auto;font-family:'DM Sans',sans-serif">
        <!-- HEADER avec bouton retour -->
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap;gap:12px">
          <div style="flex:1;min-width:0">
            <button id="ph-back" style="background:none;border:none;color:#0057FF;font-size:12px;cursor:pointer;font-weight:700;font-family:inherit;padding:0 0 4px;letter-spacing:.5px">← Retour aux pharmacies</button>
            <h2 style="font-size:26px;font-weight:800;margin:4px 0 4px;letter-spacing:-.5px;color:#0B1F4D">${escapeHtml(p.nom)}</h2>
            <div style="font-size:13px;color:#64748B">${escapeHtml(p.adresse || '—')} · ${escapeHtml(p.cp || '')} ${escapeHtml(p.ville || '')}</div>
          </div>
          <span style="background:${status.color}22;color:${status.color};padding:6px 14px;border-radius:999px;font-size:13px;font-weight:700">${status.label}</span>
        </div>

        <!-- 4 KPI hero -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:18px">
          <div style="${styleCard()};background:linear-gradient(135deg,#0057FF,#5856D6);color:#fff;border:none">
            <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.7);font-weight:800">CA cumulé</div>
            <div style="font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;margin:4px 0">${fmtEuro(totalCa)}</div>
            <div style="font-size:11px;color:rgba(255,255,255,.7)">${pctSecteur.toFixed(2)}% du secteur</div>
          </div>
          ${miniKpi('Potentiel Gx', (p.potentielGx||0) > 0 ? fmtEuro(p.potentielGx) : '—', '#FF9F1C', 'Cible commerciale')}
          ${miniKpi('Réfs achetées', topProducts ? topProducts.length : 0, '#14B86A', 'Top produits')}
          ${miniKpi('Factures', detail ? detail.length : 0, '#5856D6', 'Lignes récentes')}
        </div>

        <!-- Métadonnées + Timeline mensuelle -->
        <div style="display:grid;grid-template-columns:300px 1fr;gap:14px;margin-bottom:18px">

          <div style="${styleCard()}">
            <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin-bottom:10px">Identité</div>
            ${row('CIP', p.cip)}
            ${p.email ? row('Email', `<a href="mailto:${escapeHtml(p.email)}" style="color:#0057FF;text-decoration:none">${escapeHtml(p.email)}</a>`) : ''}
            ${p.tel ? row('Tél', `<a href="tel:${escapeHtml(p.tel)}" style="color:#0057FF;text-decoration:none">${escapeHtml(p.tel)}</a>`) : ''}
            ${contact ? row('Contact', contact) : ''}
            ${enseigne ? row('Enseigne', enseigne) : ''}
            ${logiciel ? row('Logiciel', logiciel) : ''}
            ${structure ? row('Structure', structure) : ''}
            ${uga ? row('UGA', uga) : ''}
            ${p.ecodage ? row('Groupement', p.ecodage) : ''}
          </div>

          ${months.length ? `
          <div style="${styleCard()}">
            <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin-bottom:14px">Évolution mensuelle CA</div>
            <div style="display:grid;grid-template-columns:repeat(${months.length},1fr);gap:6px;align-items:end;height:120px">
              ${months.map(m => {
                const pct = Math.round((monthly[m].ca / monthMax) * 100);
                const noms = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
                const label = noms[parseInt(m.split('-')[1], 10) - 1] + ' ' + m.slice(2,4);
                return `
                  <div style="display:flex;flex-direction:column;align-items:center;gap:4px" title="${m} · ${fmtEuro(monthly[m].ca)} · ${fmtNum(monthly[m].qte)} u">
                    <div style="width:100%;height:80px;display:flex;align-items:flex-end">
                      <div style="width:100%;height:${pct}%;min-height:3px;background:linear-gradient(180deg,#0057FF,#5856D6);border-radius:4px 4px 0 0"></div>
                    </div>
                    <div style="font-size:10px;font-weight:700;font-variant-numeric:tabular-nums;color:#0B1F4D">${fmtEuro(monthly[m].ca)}</div>
                    <div style="font-size:9px;color:#94A3B8;text-transform:uppercase">${label}</div>
                  </div>`;
              }).join('')}
            </div>
          </div>
          ` : '<div style="' + styleCard() + ';color:#94A3B8;font-size:13px;text-align:center">Pas de facture sur la période</div>'}

        </div>

        <!-- Ventilation tranche × famille pour cette pharma -->
        ${topProducts ? buildVentilationHtml(ventCells, TRANCHES, FAMILLES) : ''}

        <!-- Mix produit · ce client vs secteur OPS Nantes -->
        ${clientFamTotal > 0 && opsMix.total > 0 ? buildMixVsOpsHtml(clientFamCa, clientFamTotal, opsMix.fams, opsMix.total, FAMILLES) : ''}

        <!-- Top opportunités OPS Nantes -->
        ${topOpp.length ? buildOpportunitesHtml(topOpp, opsMix.total) : ''}

        <!-- 2 colonnes : Top produits + Dernières factures -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:14px;margin-top:14px">

          ${topProducts && topProducts.length ? `
          <div style="${styleCard('padding:0')}">
            <div style="padding:12px 16px;background:#F2F6FF;border-bottom:1px solid #E8EEFF">
              <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Top ${Math.min(topProducts.length, 15)} produits achetés</div>
            </div>
            ${topProducts.slice(0, 15).map((prod, i) => `
              <div style="padding:9px 16px;display:grid;grid-template-columns:24px 1fr auto auto;gap:8px;align-items:center;font-size:12px;border-bottom:1px solid #F2F6FF">
                <span style="color:#94A3B8;font-weight:700">${i + 1}</span>
                <span style="font-weight:600;color:#0B1F4D">${escapeHtml(prod.designation)}</span>
                <span style="color:#94A3B8;font-size:11px">×${prod.qte}</span>
                <b style="color:#0057FF;font-variant-numeric:tabular-nums">${fmtEuro(prod.ca)}</b>
              </div>
            `).join('')}
          </div>
          ` : ''}

          ${detail && detail.length ? `
          <div style="${styleCard('padding:0')}">
            <div style="padding:12px 16px;background:#F2F6FF;border-bottom:1px solid #E8EEFF">
              <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">${detail.length} dernières factures</div>
            </div>
            ${detail.slice(0, 15).map(l => `
              <div style="padding:8px 16px;display:grid;grid-template-columns:70px 1fr auto auto;gap:8px;align-items:center;font-size:12px;border-bottom:1px solid #F2F6FF">
                <span style="color:#0057FF;font-weight:700;font-size:10px">${formatDateShort(l.date)}</span>
                <span style="color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(l.designation)}</span>
                <span style="color:#94A3B8;font-size:11px">×${l.qte}</span>
                <b style="color:#0B1F4D;font-variant-numeric:tabular-nums">${fmtEuro(l.ca)}</b>
              </div>
            `).join('')}
          </div>
          ` : ''}

        </div>

        ${p.commentaire ? `<div style="${styleCard('background:#FFFBEB;border-left:4px solid #FF9F1C')};margin-top:14px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7C2D12;font-weight:800;margin-bottom:4px">Commentaire CRM</div>${escapeHtml(p.commentaire)}</div>` : ''}
      </div>
    `;

    // Back button
    document.getElementById('ph-back').addEventListener('click', () => renderPharmaciesV2());
  }

  function row(label, val) {
    return `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;font-size:12.5px;border-bottom:1px solid #F2F6FF">
      <span style="color:#94A3B8;text-transform:uppercase;font-size:10px;letter-spacing:1px;font-weight:700">${label}</span>
      <span style="color:#0B1F4D;font-weight:600;text-align:right">${val}</span>
    </div>`;
  }

  function formatDateShort(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  function buildVentilationHtml(cells, tranches, familles) {
    const FAMILLE_COLORS = {
      'Froid': '#00B5D8', 'Biosimilaires': '#7C3AED', 'Génériques': '#94A3B8',
      'Gén. partenaires': '#14B86A', 'Non remboursés': '#FF9F1C', 'Princeps': '#0057FF',
    };
    let max = 0;
    for (const t of tranches) for (const f of familles) {
      if (cells[t.key][f].ca > max) max = cells[t.key][f].ca;
    }
    const colTot = {}, rowTot = {}; let total = 0;
    for (const t of tranches) {
      rowTot[t.key] = 0;
      for (const f of familles) {
        const v = cells[t.key][f].ca;
        rowTot[t.key] += v;
        colTot[f] = (colTot[f] || 0) + v;
        total += v;
      }
    }
    if (total === 0) return '';
    const rows = tranches.map(t => {
      const tds = familles.map(f => {
        const v = cells[t.key][f].ca;
        const intensity = max > 0 ? v / max : 0;
        const c = FAMILLE_COLORS[f] || '#0057FF';
        const fcRgb = hexToRgbLocal(c);
        const bg = v > 0 ? `rgba(${fcRgb.r}, ${fcRgb.g}, ${fcRgb.b}, ${0.06 + intensity * 0.35})` : 'transparent';
        return `<td style="padding:9px 10px;text-align:right;background:${bg};font-variant-numeric:tabular-nums;color:${intensity > 0.5 ? '#fff' : '#0B1F4D'};font-weight:${intensity > 0.4 ? '700' : '500'};border-right:1px solid #fff">${v > 0 ? fmtEuro(v) : '—'}</td>`;
      }).join('');
      return `<tr>
        <td style="padding:10px 14px;font-weight:700;color:#0B1F4D;background:#F2F6FF;border-right:2px solid #0057FF">
          <div>${t.label}</div>
          <div style="font-size:10px;color:#64748B;font-weight:600">${t.sub} · ${t.remise}</div>
        </td>${tds}
        <td style="padding:10px 10px;text-align:right;font-weight:800;background:#EAF2FF;color:#0B1F4D;font-variant-numeric:tabular-nums">${rowTot[t.key] > 0 ? fmtEuro(rowTot[t.key]) : '—'}</td>
      </tr>`;
    }).join('');
    const totalRow = familles.map(f => `<td style="padding:10px 10px;text-align:right;font-weight:800;background:#EAF2FF;color:#0B1F4D;font-variant-numeric:tabular-nums">${(colTot[f]||0) > 0 ? fmtEuro(colTot[f]) : '—'}</td>`).join('');
    return `
      <h3 style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:18px 0 10px">Ventilation tranche × famille (top produits client)</h3>
      <div style="${styleCard('padding:0;overflow:hidden')}">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:#0B1F4D;color:#fff">
                <th style="padding:10px 14px;text-align:left;font-size:10.5px;letter-spacing:1px;text-transform:uppercase">Tranche · remise</th>
                ${familles.map(f => `<th style="padding:10px 8px;text-align:right;font-size:10.5px;font-weight:700;border-left:1px solid rgba(255,255,255,.1)"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${FAMILLE_COLORS[f]};margin-right:4px"></span>${escapeHtml(f)}</th>`).join('')}
                <th style="padding:10px 10px;text-align:right;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;background:#1E3A5F">Total</th>
              </tr>
            </thead>
            <tbody>${rows}
              <tr style="background:#EAF2FF;border-top:2px solid #0057FF">
                <td style="padding:10px 14px;font-weight:800;color:#0B1F4D;text-transform:uppercase;font-size:10.5px;letter-spacing:1px">Total</td>
                ${totalRow}
                <td style="padding:10px 10px;text-align:right;font-weight:800;background:#0057FF;color:#fff;font-variant-numeric:tabular-nums;font-size:13px">${fmtEuro(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Mix famille : ce client vs secteur OPS Nantes — barres jumelées + écart
  function buildMixVsOpsHtml(clientFams, clientTotal, opsFams, opsTotal, familles) {
    const FAMILLE_COLORS = {
      'Froid': '#00B5D8', 'Biosimilaires': '#7C3AED', 'Génériques': '#94A3B8',
      'Gén. partenaires': '#14B86A', 'Non remboursés': '#FF9F1C', 'Princeps': '#0057FF',
    };
    const rows = familles.map(f => {
      const cPct = clientTotal > 0 ? (clientFams[f] || 0) / clientTotal * 100 : 0;
      const oPct = opsTotal > 0 ? (opsFams[f] || 0) / opsTotal * 100 : 0;
      const delta = cPct - oPct;
      const sign = delta > 0 ? '+' : '';
      const deltaColor = delta > 2 ? '#14B86A' : delta < -2 ? '#FF4D6D' : '#94A3B8';
      const deltaLabel = delta > 2 ? 'sur-indexé' : delta < -2 ? 'sous-indexé · opportunité' : 'aligné';
      const c = FAMILLE_COLORS[f] || '#0057FF';
      const maxPct = Math.max(cPct, oPct, 10);
      const cW = (cPct / maxPct) * 100;
      const oW = (oPct / maxPct) * 100;
      return `
        <div style="padding:12px 16px;border-bottom:1px solid #F2F6FF">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <div style="font-size:13px;font-weight:700;color:#0B1F4D;display:flex;align-items:center;gap:8px">
              <span style="width:10px;height:10px;border-radius:50%;background:${c}"></span>${escapeHtml(f)}
            </div>
            <div style="font-size:11px;font-weight:700;color:${deltaColor};letter-spacing:.5px;text-transform:uppercase">${sign}${delta.toFixed(1)} pts · ${deltaLabel}</div>
          </div>
          <div style="display:grid;grid-template-columns:60px 1fr 60px;gap:10px;align-items:center;margin-bottom:5px">
            <span style="font-size:10px;color:#64748B;font-weight:700;text-transform:uppercase">Client</span>
            <div style="height:14px;background:#F2F6FF;border-radius:4px;overflow:hidden"><div style="height:100%;width:${cW}%;background:${c};border-radius:4px;transition:width .4s"></div></div>
            <span style="font-size:12px;font-weight:800;color:#0B1F4D;font-variant-numeric:tabular-nums;text-align:right">${cPct.toFixed(1)}%</span>
          </div>
          <div style="display:grid;grid-template-columns:60px 1fr 60px;gap:10px;align-items:center">
            <span style="font-size:10px;color:#64748B;font-weight:700;text-transform:uppercase">OPS</span>
            <div style="height:10px;background:#F2F6FF;border-radius:4px;overflow:hidden"><div style="height:100%;width:${oW}%;background:repeating-linear-gradient(90deg,${c}88 0,${c}88 6px,${c}55 6px,${c}55 12px);border-radius:4px;transition:width .4s"></div></div>
            <span style="font-size:11px;font-weight:600;color:#64748B;font-variant-numeric:tabular-nums;text-align:right">${oPct.toFixed(1)}%</span>
          </div>
        </div>
      `;
    }).join('');
    return `
      <h3 style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:18px 0 10px">Mix produit · ce client vs secteur OPS Nantes</h3>
      <div style="${styleCard('padding:0')}">
        <div style="padding:10px 16px;background:#F2F6FF;border-bottom:1px solid #E8EEFF;display:flex;justify-content:space-between;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">
          <span>Famille IP</span><span>Comparatif % CA</span>
        </div>
        ${rows}
        <div style="padding:10px 16px;background:#FAFBFF;font-size:11px;color:#64748B;border-top:1px solid #E8EEFF;display:flex;gap:14px;flex-wrap:wrap">
          <span><b style="color:#0B1F4D">Sous-indexé</b> = potentiel non capté · piste de visite</span>
          <span><b style="color:#0B1F4D">Sur-indexé</b> = pharmacie déjà fidèle sur cette famille</span>
        </div>
      </div>
    `;
  }

  // Top opportunités : produits TOP OPS Nantes absents de ce client
  function buildOpportunitesHtml(opps, opsTotal) {
    const stockIdx = window.STOCK || {};
    const rows = opps.map((o, i) => {
      const fam = familleFromAttrs(o.nature, o.afmcode, o.sousfamille);
      const FAMILLE_COLORS = {
        'Froid': '#00B5D8', 'Biosimilaires': '#7C3AED', 'Génériques': '#94A3B8',
        'Gén. partenaires': '#14B86A', 'Non remboursés': '#FF9F1C', 'Princeps': '#0057FF',
      };
      const c = FAMILLE_COLORS[fam] || '#0057FF';
      const pctOps = opsTotal > 0 ? (o.ca / opsTotal * 100) : 0;
      return `
        <div style="padding:10px 16px;display:grid;grid-template-columns:28px 1fr 130px 110px 90px;gap:10px;align-items:center;font-size:12.5px;border-bottom:1px solid #F2F6FF">
          <span style="color:#94A3B8;font-weight:800;font-size:13px">${i + 1}</span>
          <div style="min-width:0">
            <div style="font-weight:700;color:#0B1F4D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(o.designation || o.code)}</div>
            <div style="font-size:10.5px;color:#94A3B8;margin-top:2px">${escapeHtml(o.marque || '—')}</div>
          </div>
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#0B1F4D;font-weight:600;background:${c}15;padding:4px 10px;border-radius:999px;width:fit-content"><span style="width:7px;height:7px;border-radius:50%;background:${c}"></span>${escapeHtml(fam)}</span>
          <div style="text-align:right">
            <b style="color:#0B1F4D;font-variant-numeric:tabular-nums">${fmtEuro(o.ca)}</b>
            <div style="font-size:10px;color:#94A3B8">${pctOps.toFixed(2)}% OPS</div>
          </div>
          <div style="text-align:right">
            <span style="color:#FF4D6D;font-weight:800;font-size:11px;letter-spacing:.5px;text-transform:uppercase">Absent</span>
            <div style="font-size:10px;color:#94A3B8">${fmtNum(o.qte || 0)} u secteur</div>
          </div>
        </div>
      `;
    }).join('');
    return `
      <h3 style="font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:18px 0 10px">Top opportunités · produits OPS Nantes absents de ce client</h3>
      <div style="${styleCard('padding:0')}">
        <div style="padding:10px 16px;background:#F2F6FF;border-bottom:1px solid #E8EEFF;display:grid;grid-template-columns:28px 1fr 130px 110px 90px;gap:10px;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">
          <span>#</span><span>Produit</span><span>Famille IP</span><span style="text-align:right">CA OPS</span><span style="text-align:right">Statut</span>
        </div>
        ${rows}
        <div style="padding:10px 16px;background:#FAFBFF;font-size:11px;color:#64748B;border-top:1px solid #E8EEFF">
          Ces produits tournent fort à l'OPS Nantes mais ne sont pas commandés ici → leviers prioritaires en visite.
        </div>
      </div>
    `;
  }

  function hexToRgbLocal(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 87, b: 255 };
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

  // ───────── BENCHMARK ────────────────────────────────────────────────────
  function renderBenchmarkV2() {
    const root = document.getElementById('bench-content');
    if (!root) return;
    const cat = window.CATALOGUE_IP || [];
    if (!cat.length) { root.innerHTML = `<div style="padding:40px;text-align:center;color:#94A3B8">Catalogue IP non chargé</div>`; return; }
    // Stats par catégorie
    const byCat = {};
    for (const p of cat) {
      const c = p.categorie || '(non classé)';
      if (!byCat[c]) byCat[c] = { count: 0, totalRemise: 0, totalPrixHt: 0, totalPrixIp: 0, froidCount: 0 };
      byCat[c].count++;
      byCat[c].totalRemise += p.remise_pct || 0;
      byCat[c].totalPrixHt += p.prix_ht || 0;
      byCat[c].totalPrixIp += p.prix_ip || 0;
      if (p.froid) byCat[c].froidCount++;
    }
    const cats = Object.entries(byCat).sort((a, b) => b[1].count - a[1].count);
    // Top 20 produits par remise
    const topRemise = [...cat].filter(p => p.remise_pct > 0).sort((a, b) => b.remise_pct - a.remise_pct).slice(0, 20);

    root.innerHTML = `
      <div style="padding:20px;max-width:1280px;margin:0 auto;font-family:'DM Sans',sans-serif">
        ${sectionHeader('Benchmark catalogue Intégral Pharma', `${fmtNum(cat.length)} produits référencés · prix HT / IP / remises`)}

        <!-- Stats catégories -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:20px">
          ${cats.map(([name, d]) => {
            const remMoy = d.count > 0 ? (d.totalRemise / d.count) : 0;
            const economMoy = d.count > 0 ? ((d.totalPrixHt - d.totalPrixIp) / d.count) : 0;
            return `
              <div style="${styleCard()}">
                <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800">${escapeHtml(name)}</div>
                <div style="font-size:24px;font-weight:800;color:#0B1F4D;margin:4px 0;font-variant-numeric:tabular-nums">${fmtNum(d.count)} <span style="font-size:11px;color:#94A3B8;font-weight:600">réf.</span></div>
                <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748B;margin-top:6px">
                  <span>Remise moy. <b style="color:#14B86A">${remMoy.toFixed(1)}%</b></span>
                  <span>Économie moy. <b style="color:#0057FF">${economMoy.toFixed(2)}€</b></span>
                </div>
                ${d.froidCount > 0 ? `<div style="font-size:10.5px;color:#94A3B8;margin-top:4px">❄️ ${d.froidCount} produits froid</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <h3 style="font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:24px 0 12px">Top 20 produits · remises les plus fortes</h3>
        <div style="${styleCard('padding:0')}">
          <div style="padding:10px 16px;background:#F2F6FF;font-size:11px;color:#64748B;font-weight:700;letter-spacing:1px;text-transform:uppercase;display:grid;grid-template-columns:30px 1fr 1fr 70px 70px 70px;gap:12px;border-bottom:1px solid #E8EEFF">
            <span>#</span><span>Produit</span><span>Catégorie</span><span style="text-align:right">Prix HT</span><span style="text-align:right">Prix IP</span><span style="text-align:right">Remise</span>
          </div>
          ${topRemise.map((p, i) => `
            <div style="padding:10px 16px;display:grid;grid-template-columns:30px 1fr 1fr 70px 70px 70px;gap:12px;font-size:12.5px;border-bottom:1px solid #F2F6FF;align-items:center">
              <span style="color:#94A3B8;font-weight:700">${i + 1}</span>
              <div>
                <div style="font-weight:700;color:#0B1F4D">${escapeHtml(p.nom)} ${p.froid ? '❄️' : ''}</div>
                <div style="font-size:10.5px;color:#94A3B8">${escapeHtml(p.marque || '—')} · ${escapeHtml(p.molecule || '—')}</div>
              </div>
              <span style="color:#64748B;font-size:11px">${escapeHtml(p.categorie || '—')}</span>
              <span style="text-align:right;text-decoration:line-through;color:#94A3B8;font-variant-numeric:tabular-nums">${p.prix_ht ? p.prix_ht.toFixed(2)+' €' : '—'}</span>
              <span style="text-align:right;font-weight:700;color:#0057FF;font-variant-numeric:tabular-nums">${p.prix_ip ? p.prix_ip.toFixed(2)+' €' : '—'}</span>
              <span style="text-align:right;font-weight:800;color:#14B86A;font-variant-numeric:tabular-nums">-${p.remise_pct.toFixed(1)}%</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ───────── SIMULATEUR (calcul gain switch) ──────────────────────────────
  function renderSimulatorV2() {
    const root = document.getElementById('simul-content');
    if (!root) return;
    const cat = window.CATALOGUE_IP || [];
    if (!cat.length) { root.innerHTML = `<div style="padding:40px;text-align:center;color:#94A3B8">Catalogue IP non chargé</div>`; return; }

    root.innerHTML = `
      <div style="padding:20px;max-width:980px;margin:0 auto;font-family:'DM Sans',sans-serif">
        ${sectionHeader('Simulateur panier · gain switch vers IP', 'Compare ton panier client vs catalogue Intégral Pharma')}

        <div style="${styleCard()};margin-bottom:14px">
          <label style="display:block;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin-bottom:8px">Recherche produit (EAN ou nom)</label>
          <input id="sim-search" type="search" placeholder="Ex: Dafalgan, 3400935..."
            style="width:100%;padding:11px 16px;border-radius:10px;border:1px solid #E8EEFF;font-size:14px;font-family:inherit;color:#0B1F4D">
          <div id="sim-results" style="margin-top:14px"></div>
        </div>

        <div style="${styleCard()};margin-bottom:14px">
          <h3 style="font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:0 0 12px">Panier simulé</h3>
          <div id="sim-cart" style="min-height:40px;color:#94A3B8;font-size:13px">Recherche puis ajoute des produits…</div>
        </div>

        <div id="sim-summary" style="${styleCard()};display:none">
          <h3 style="font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:0 0 12px">Bilan</h3>
          <div id="sim-summary-content"></div>
        </div>
      </div>
    `;

    const cart = [];
    const searchEl = document.getElementById('sim-search');
    const resultsEl = document.getElementById('sim-results');
    const cartEl = document.getElementById('sim-cart');
    const summaryEl = document.getElementById('sim-summary');
    const summaryContent = document.getElementById('sim-summary-content');

    const renderResults = (query) => {
      if (!query || query.length < 2) { resultsEl.innerHTML = ''; return; }
      const q = query.toLowerCase();
      const matches = cat.filter(p =>
        (p.nom || '').toLowerCase().includes(q) ||
        (p.ean || '').includes(q) ||
        (p.molecule || '').toLowerCase().includes(q)
      ).slice(0, 8);
      if (!matches.length) { resultsEl.innerHTML = '<div style="color:#94A3B8;font-size:12px;padding:8px">Aucun résultat</div>'; return; }
      resultsEl.innerHTML = matches.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-bottom:1px solid #F2F6FF;cursor:pointer" onclick="window.__simAdd && window.__simAdd('${p.ean}')" onmouseover="this.style.background='#F8FAFF'" onmouseout="this.style.background=''">
          <div>
            <div style="font-weight:700;color:#0B1F4D;font-size:13px">${escapeHtml(p.nom)}</div>
            <div style="font-size:10.5px;color:#94A3B8">${escapeHtml(p.marque || '')} · ${escapeHtml(p.molecule || '')} · ${escapeHtml(p.categorie || '')}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;color:#0057FF;font-size:14px">${p.prix_ip ? p.prix_ip.toFixed(2)+' €' : '—'}</div>
            ${p.remise_pct ? `<div style="font-size:10.5px;color:#14B86A;font-weight:700">-${p.remise_pct.toFixed(1)}%</div>` : ''}
          </div>
        </div>
      `).join('');
    };

    const renderCart = () => {
      if (!cart.length) { cartEl.innerHTML = '<div style="color:#94A3B8;font-size:13px">Recherche puis ajoute des produits…</div>'; summaryEl.style.display = 'none'; return; }
      cartEl.innerHTML = cart.map((item, i) => `
        <div style="display:grid;grid-template-columns:1fr 70px 100px 30px;gap:10px;padding:10px 0;border-bottom:1px solid #F2F6FF;align-items:center;font-size:13px">
          <div>
            <div style="font-weight:700;color:#0B1F4D">${escapeHtml(item.nom)}</div>
            <div style="font-size:10.5px;color:#94A3B8">${escapeHtml(item.categorie || '')} · ${item.prix_ht ? item.prix_ht.toFixed(2)+'€ HT → '+item.prix_ip.toFixed(2)+'€ IP' : ''}</div>
          </div>
          <input type="number" min="1" value="${item.qte}" data-cart-i="${i}" class="sim-qty" style="padding:6px 10px;border-radius:8px;border:1px solid #E8EEFF;font-size:13px;text-align:right">
          <span style="text-align:right;font-weight:700;color:#0057FF;font-variant-numeric:tabular-nums">${(item.qte * item.prix_ip).toFixed(2)} €</span>
          <button data-cart-rm="${i}" style="background:transparent;border:none;color:#F43F5E;font-size:18px;cursor:pointer">×</button>
        </div>
      `).join('');

      // Bilan
      const totalIp = cart.reduce((s, i) => s + i.qte * (i.prix_ip || 0), 0);
      const totalHt = cart.reduce((s, i) => s + i.qte * (i.prix_ht || 0), 0);
      const gain = totalHt - totalIp;
      const gainPct = totalHt > 0 ? (gain / totalHt) * 100 : 0;
      summaryEl.style.display = 'block';
      summaryContent.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
          <div style="${styleCard()}"><div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Total tarif HT</div><div style="font-size:24px;font-weight:800;color:#94A3B8;text-decoration:line-through;margin:4px 0">${fmtEuro(totalHt)}</div></div>
          <div style="${styleCard()};border-left:4px solid #0057FF"><div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748B;font-weight:800">Total IP</div><div style="font-size:24px;font-weight:800;color:#0057FF;margin:4px 0">${fmtEuro(totalIp)}</div></div>
          <div style="${styleCard()};border-left:4px solid #14B86A;background:#F0FDF4"><div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#14B86A;font-weight:800">Économie</div><div style="font-size:24px;font-weight:800;color:#14B86A;margin:4px 0">${fmtEuro(gain)} <span style="font-size:14px">(${gainPct.toFixed(1)}%)</span></div></div>
        </div>
      `;

      // Handlers cart
      document.querySelectorAll('.sim-qty').forEach(input => {
        input.addEventListener('input', (e) => {
          const i = parseInt(e.target.dataset.cartI, 10);
          cart[i].qte = Math.max(1, parseInt(e.target.value, 10) || 1);
          renderCart();
        });
      });
      document.querySelectorAll('[data-cart-rm]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          cart.splice(parseInt(e.target.dataset.cartRm, 10), 1);
          renderCart();
        });
      });
    };

    window.__simAdd = (ean) => {
      const p = cat.find(x => x.ean === ean);
      if (!p) return;
      const existing = cart.find(c => c.ean === ean);
      if (existing) existing.qte++;
      else cart.push({ ...p, qte: 1 });
      searchEl.value = '';
      resultsEl.innerHTML = '';
      renderCart();
    };

    searchEl.addEventListener('input', (e) => renderResults(e.target.value.trim()));
  }

  // ───────── OFFILOG (parapharmacie) ──────────────────────────────────────
  function renderOffilogV2() {
    const root = document.getElementById('offilog-content');
    if (!root) return;
    const products = window.OFFILOG || [];
    if (!products.length) { root.innerHTML = `<div style="padding:40px;text-align:center;color:#94A3B8">Offilog non chargé</div>`; return; }

    // Counts par marque (top 10)
    const byMarque = {};
    for (const p of products) {
      const m = p.marque || '(sans marque)';
      byMarque[m] = (byMarque[m] || 0) + 1;
    }
    const topMarques = Object.entries(byMarque).sort((a, b) => b[1] - a[1]).slice(0, 12);
    // 200 produits + comparateur
    const sample = products.slice(0, 200);

    root.innerHTML = `
      <div style="padding:20px;max-width:1280px;margin:0 auto;font-family:'DM Sans',sans-serif">
        ${sectionHeader('Offilog · Parapharmacie', `${fmtNum(products.length)} références · prix concurrents Leclerc / Drakkars / Cap3000`)}

        <h3 style="font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800;margin:0 0 12px">Top marques</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
          ${topMarques.map(([m, n]) => `
            <span style="background:#fff;border:1px solid #E8EEFF;padding:6px 12px;border-radius:999px;font-size:12px;color:#0B1F4D"><b>${escapeHtml(m)}</b> <span style="color:#94A3B8">${n}</span></span>
          `).join('')}
        </div>

        <div style="${styleCard()};margin-bottom:14px">
          <input id="off-search" type="search" placeholder="Recherche EAN / nom / marque…" style="width:100%;padding:9px 14px;border-radius:999px;border:1px solid #E8EEFF;font-size:14px;font-family:inherit;color:#0B1F4D">
        </div>

        <div id="off-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px"></div>
      </div>
    `;

    const renderOffGrid = (q) => {
      let list = products;
      if (q && q.length >= 2) {
        const qLow = q.toLowerCase();
        list = list.filter(p =>
          (p.produit || '').toLowerCase().includes(qLow) ||
          (p.marque || '').toLowerCase().includes(qLow) ||
          (p.ean || '').includes(qLow)
        );
      } else {
        list = sample;
      }
      list = list.slice(0, 200);
      document.getElementById('off-grid').innerHTML = list.map(p => `
        <div style="${styleCard('padding:14px')}">
          <div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#94A3B8;font-weight:700">${escapeHtml(p.marque || '—')}</div>
          <div style="font-size:13px;font-weight:700;color:#0B1F4D;margin:4px 0 8px;line-height:1.3;min-height:34px">${escapeHtml(p.produit || p.nom || '—')}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;font-variant-numeric:tabular-nums">
            <div><span style="color:#94A3B8">Achat IP</span><br><b style="color:#0057FF;font-size:14px">${p.prix_offilog ? p.prix_offilog.toFixed(2)+' €' : '—'}</b></div>
            ${p.prix_leclerc ? `<div><span style="color:#94A3B8">Leclerc</span><br><b style="color:#F43F5E">${p.prix_leclerc.toFixed(2)} €</b></div>` : ''}
            ${p.prix_drakkars ? `<div><span style="color:#94A3B8">Drakkars</span><br><b>${p.prix_drakkars.toFixed(2)} €</b></div>` : ''}
            ${p.prix_cap3000 ? `<div><span style="color:#94A3B8">Cap3000</span><br><b>${p.prix_cap3000.toFixed(2)} €</b></div>` : ''}
          </div>
        </div>
      `).join('');
    };
    renderOffGrid();
    document.getElementById('off-search').addEventListener('input', (e) => renderOffGrid(e.target.value.trim()));
  }

  // ───────── GROUPEMENTS ──────────────────────────────────────────────────
  function renderGroupementsV2() {
    const root = document.getElementById('groupements-content');
    if (!root) return;
    const all = window.CLIENTS || [];
    const byGr = {};
    for (const p of all) {
      const g = (p.ecodage || '').trim() || '(Indépendant)';
      if (!byGr[g]) byGr[g] = { count: 0, actifs: 0, ca: 0, pot: 0 };
      byGr[g].count++;
      if ((p.ca2023 || 0) > 0) { byGr[g].actifs++; byGr[g].ca += p.ca2023; }
      byGr[g].pot += p.potentielGx || 0;
    }
    const grs = Object.entries(byGr).sort((a, b) => b[1].count - a[1].count);

    root.innerHTML = `
      <div style="padding:20px;max-width:1280px;margin:0 auto;font-family:'DM Sans',sans-serif">
        ${sectionHeader('Suivi groupements', `${grs.length} groupements partenaires · ${fmtNum(all.length)} officines`)}
        <div style="${styleCard('padding:0')}">
          <div style="padding:10px 16px;background:#F2F6FF;font-size:11px;color:#64748B;font-weight:700;letter-spacing:1px;text-transform:uppercase;display:grid;grid-template-columns:1fr 0.8fr 0.8fr 0.8fr 0.8fr;gap:12px;border-bottom:1px solid #E8EEFF">
            <span>Groupement</span><span style="text-align:right">Officines</span><span style="text-align:right">Actifs</span><span style="text-align:right">CA</span><span style="text-align:right">Potentiel</span>
          </div>
          ${grs.map(([name, d]) => `
            <div style="padding:11px 16px;display:grid;grid-template-columns:1fr 0.8fr 0.8fr 0.8fr 0.8fr;gap:12px;font-size:13px;border-bottom:1px solid #F2F6FF;align-items:center">
              <span style="font-weight:700;color:#0B1F4D">${escapeHtml(name)}</span>
              <span style="text-align:right;font-variant-numeric:tabular-nums">${fmtNum(d.count)}</span>
              <span style="text-align:right;font-variant-numeric:tabular-nums;color:${d.actifs>0?'#14B86A':'#94A3B8'};font-weight:700">${fmtNum(d.actifs)}</span>
              <span style="text-align:right;font-variant-numeric:tabular-nums;color:${d.ca>0?'#0057FF':'#94A3B8'};font-weight:${d.ca>0?'700':'400'}">${d.ca>0?fmtEuro(d.ca):'—'}</span>
              <span style="text-align:right;font-variant-numeric:tabular-nums;color:#64748B">${d.pot>0?fmtEuro(d.pot):'—'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ───────── ADMIN (sources + version) ────────────────────────────────────
  function renderAdminV2() {
    const root = document.getElementById('admin-content');
    if (!root) return;
    const total = window.SALES_TOTAL;
    root.innerHTML = `
      <div style="padding:20px;max-width:980px;margin:0 auto;font-family:'DM Sans',sans-serif">
        ${sectionHeader('Administration', 'Sources de données et état du système')}

        <div style="${styleCard()};margin-bottom:14px;border-left:4px solid #14B86A">
          <div style="font-size:13px;font-weight:700;color:#0B1F4D;margin-bottom:6px">✓ Données natives chargées en mémoire</div>
          <div style="font-size:12px;color:#64748B;line-height:1.6">Aucun import manuel nécessaire — tous les Excel sources sont compilés en JS au push.</div>
        </div>

        ${total ? `
        <div style="${styleCard()};margin-bottom:14px">
          <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#64748B;font-weight:800">Période STATS détaillé</div>
          <div style="font-size:18px;font-weight:800;color:#0B1F4D;margin:4px 0">${total.premiere_date} → ${total.derniere_date}</div>
          <div style="font-size:12px;color:#64748B">${fmtNum(total.lignes)} lignes · ${fmtNum(total.factures)} factures · ${fmtEuro(total.ca)} CA cumulé · ${total.nb_clients} clients facturés</div>
        </div>
        ` : ''}

        <div style="${styleCard('padding:0')}">
          <div style="padding:14px 18px;border-bottom:1px solid #F2F6FF;display:grid;grid-template-columns:1fr auto;gap:12px"><div><div style="font-family:monospace;font-size:11px;color:#0057FF;font-weight:700">window.CLIENTS</div><div style="font-size:12px;color:#64748B">clients-data.js (BASE DE DONNÉE IP WM + WML)</div></div><div style="font-size:18px;font-weight:800;color:#0B1F4D">${fmtNum((window.CLIENTS||[]).length)}</div></div>
          <div style="padding:14px 18px;border-bottom:1px solid #F2F6FF;display:grid;grid-template-columns:1fr auto;gap:12px"><div><div style="font-family:monospace;font-size:11px;color:#0057FF;font-weight:700">window.PHARMACIES_GEO</div><div style="font-size:12px;color:#64748B">pharmacies-geo.js (api-adresse.data.gouv.fr)</div></div><div style="font-size:18px;font-weight:800;color:#0B1F4D">${fmtNum(Object.keys(window.PHARMACIES_GEO||{}).length)}</div></div>
          <div style="padding:14px 18px;border-bottom:1px solid #F2F6FF;display:grid;grid-template-columns:1fr auto;gap:12px"><div><div style="font-family:monospace;font-size:11px;color:#0057FF;font-weight:700">window.CATALOGUE_IP</div><div style="font-size:12px;color:#64748B">catalogue-ip.js (TOP IP DÉCROISSANT.xlsb)</div></div><div style="font-size:18px;font-weight:800;color:#0B1F4D">${fmtNum((window.CATALOGUE_IP||[]).length)}</div></div>
          <div style="padding:14px 18px;border-bottom:1px solid #F2F6FF;display:grid;grid-template-columns:1fr auto;gap:12px"><div><div style="font-family:monospace;font-size:11px;color:#0057FF;font-weight:700">window.CLIENT_PRODUCTS</div><div style="font-size:12px;color:#64748B">client-products.js (synthèse par article)</div></div><div style="font-size:18px;font-weight:800;color:#0B1F4D">${fmtNum(Object.keys(window.CLIENT_PRODUCTS||{}).length)}</div></div>
          <div style="padding:14px 18px;border-bottom:1px solid #F2F6FF;display:grid;grid-template-columns:1fr auto;gap:12px"><div><div style="font-family:monospace;font-size:11px;color:#0057FF;font-weight:700">window.STOCK</div><div style="font-size:12px;color:#64748B">stock.js (inventaire 01/06/2026)</div></div><div style="font-size:18px;font-weight:800;color:#0B1F4D">${fmtNum(Object.keys(window.STOCK||{}).length)}</div></div>
          <div style="padding:14px 18px;border-bottom:1px solid #F2F6FF;display:grid;grid-template-columns:1fr auto;gap:12px"><div><div style="font-family:monospace;font-size:11px;color:#0057FF;font-weight:700">window.SALES_BY_PRODUCT</div><div style="font-size:12px;color:#64748B">sales-detail.js (état détaillé STATS)</div></div><div style="font-size:18px;font-weight:800;color:#0B1F4D">${fmtNum(Object.keys(window.SALES_BY_PRODUCT||{}).length)}</div></div>
          <div style="padding:14px 18px;border-bottom:1px solid #F2F6FF;display:grid;grid-template-columns:1fr auto;gap:12px"><div><div style="font-family:monospace;font-size:11px;color:#0057FF;font-weight:700">window.OFFILOG</div><div style="font-size:12px;color:#64748B">offilog-data.js (parapharmacie)</div></div><div style="font-size:18px;font-weight:800;color:#0B1F4D">${fmtNum((window.OFFILOG||[]).length)}</div></div>
          <div style="padding:14px 18px;display:grid;grid-template-columns:1fr auto;gap:12px"><div><div style="font-family:monospace;font-size:11px;color:#0057FF;font-weight:700">window.BENCHMARK</div><div style="font-size:12px;color:#64748B">benchmark-data.js</div></div><div style="font-size:18px;font-weight:800;color:#0B1F4D">${fmtNum((window.BENCHMARK||[]).length)}</div></div>
        </div>

        <div style="${styleCard()};margin-top:14px;border-left:4px solid #5856D6">
          <div style="font-size:13px;font-weight:700;color:#0B1F4D;margin-bottom:6px">Workflow d'actualisation</div>
          <div style="font-size:12px;color:#64748B;line-height:1.8">
            <b>1.</b> Mettre à jour les Excel sources dans le dossier projet (STATS/, WML_*.xlsx)<br>
            <b>2.</b> Lancer le script Python correspondant (<code style="background:#F2F6FF;padding:1px 5px;border-radius:3px">sync_stats_clients.py</code>, <code style="background:#F2F6FF;padding:1px 5px;border-radius:3px">generate_sales_detail.py</code>, <code style="background:#F2F6FF;padding:1px 5px;border-radius:3px">geocode_pharmacies.py</code>)<br>
            <b>3.</b> <code style="background:#F2F6FF;padding:1px 5px;border-radius:3px">git push</code> → l'app reflète la nouvelle data dans la minute
          </div>
        </div>
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
    if (typeof window.renderBenchmark === 'function')  { window.renderBenchmark  = renderBenchmarkV2;  applied++; }
    if (typeof window.renderSimulator === 'function')  { window.renderSimulator  = renderSimulatorV2;  applied++; }
    if (typeof window.renderOffilog === 'function')    { window.renderOffilog    = renderOffilogV2;    applied++; }
    if (typeof window.renderGroupements === 'function'){ window.renderGroupements= renderGroupementsV2;applied++; }
    if (typeof window.renderAdmin === 'function')      { window.renderAdmin      = renderAdminV2;      applied++; }
    if (applied < 10) {
      setTimeout(applyOverrides, 100);
    } else {
      console.log('[classic-overrides] ' + applied + ' renders override appliqués');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyOverrides);
  } else {
    applyOverrides();
  }
})();
