/* ══════════════════════════════════════════════════════════
   MARKETING · Générateur de documents
   Vanilla JS · charge CLIENTS, BENCHMARK, OFFILOG depuis le CRM
══════════════════════════════════════════════════════════ */

const state = {
  template: 'pharmacy-card',
  audience: 'commercial',
  context: {},
  options: { logo: true, footer: true, color: true },
};

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtEur = n => {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1000) return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' €';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n) + ' €';
};
const fmtInt = n => n == null || isNaN(n) ? '—' : new Intl.NumberFormat('fr-FR').format(n);
const fmtPct = n => n == null || isNaN(n) ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%';
const today = () => new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

// ── Données indexées ─────────────────────────────
const clientsByCip = new Map((window.CLIENTS || []).map(c => [c.cip, c]));
const benchByCip = new Map((window.BENCHMARK || []).map(b => [b.cip13, b]));
const offilogByCip = new Map((window.OFFILOG || []).map(o => [o.cip13 || o.ean, o]));

const categoryLabels = {
  pp: 'Princeps & génériques',
  mi: 'Médicaments d\'intérêt',
  mch: 'Marché chimique',
  pa: 'Parapharmacie',
  homeo: 'Homéopathie',
  vet: 'Vétérinaire',
  marche: 'Marché libre',
};

// ── Helpers de calcul ────────────────────────────
function topProductsForPharmacy(client, limit = 5) {
  // À défaut de données détaillées par pharmacie, on prend les top BENCHMARK
  // pondérés par "écart de rotation" — produits à fort impact que tout pharmacien fait
  const all = (window.BENCHMARK || [])
    .filter(b => b.has_ameli && b.ameli_jan26 > 0 && b.ip_ca > 0)
    .sort((a, b) => (b.ip_ca - a.ip_ca));
  return all.slice(0, limit);
}

function alertsForClient(client) {
  const alerts = [];
  if (!client) return alerts;
  if (client.ecodage) {
    alerts.push({ kind: 'warn', text: `Adhérent ${client.ecodage} — argumenter la valeur ajoutée IP vs groupement.` });
  }
  if ((client.ca2023 || 0) === 0 && (client.potentielGx || 0) > 100000) {
    alerts.push({ kind: 'warn', text: `Potentiel ${fmtEur(client.potentielGx)} non activé — aucune commande 2023.` });
  }
  if (client.pelgraz || client.pelmeg) {
    alerts.push({ kind: 'ok', text: `Engagement existant (${[client.pelgraz, client.pelmeg].filter(Boolean).join(' · ')}).` });
  }
  const ratio = (client.potentielGx || 0) > 0 ? (client.ca2023 || 0) / client.potentielGx : 0;
  if (ratio < 0.05 && (client.potentielGx || 0) > 50000) {
    alerts.push({ kind: 'warn', text: `Taux de pénétration < 5% — opportunité majeure d'élargissement de gamme.` });
  } else if (ratio > 0.3) {
    alerts.push({ kind: 'ok', text: `Taux de pénétration ${(ratio * 100).toFixed(0)}% — client engagé.` });
  }
  return alerts;
}

function productsByCategory(cat, limit = 12) {
  return (window.BENCHMARK || [])
    .filter(b => b.categorie === cat)
    .sort((a, b) => (b.ip_ca || 0) - (a.ip_ca || 0))
    .slice(0, limit);
}

// ── Compositions selon cible (ton) ───────────────
const COPY = {
  'pharmacy-card': {
    commercial: {
      title: client => client?.nom || 'Pharmacie',
      eyebrow: 'Fiche de préparation visite',
      subtitle: client => [client?.adresse, client?.cp, client?.ville].filter(Boolean).join(' · '),
      sectionAlerts: 'Alertes & contexte',
      sectionProducts: 'Top opportunités produit',
      sectionFooter: client => `Préparé pour le RV commercial chez ${client?.nom || 'la pharmacie'}.`,
    },
    pharmacist: {
      title: client => `Bonjour, ${client?.nom || 'cher partenaire'}`,
      eyebrow: 'Synthèse de partenariat',
      subtitle: client => `Vue d'ensemble de notre collaboration au ${today()}`,
      sectionAlerts: 'Points clés',
      sectionProducts: 'Produits à fort potentiel pour votre officine',
      sectionFooter: () => `Document généré pour vous, à titre informatif et confidentiel.`,
    },
    marketing: {
      title: client => `${client?.nom || 'Pharmacie'} · Snapshot 2026`,
      eyebrow: 'Étude de cas client',
      subtitle: client => `${client?.ville || ''} · CIP ${client?.cip || '—'}`,
      sectionAlerts: 'Contexte marché',
      sectionProducts: 'Produits phares',
      sectionFooter: () => `Données 2023–2026 · Intégral Pharma`,
    },
  },
  'product-argument': {
    commercial: {
      title: cat => `Argumentaire ${categoryLabels[cat] || cat}`,
      eyebrow: 'Outil de visite commerciale',
      subtitle: () => `Top produits IP · données Ameli 13 mois · base 19 000 pharmacies`,
      sectionTable: 'Top 12 produits',
      sectionInsight: 'Argument de vente',
      sectionFooter: () => `Données mises à jour ${today()}. Usage interne — ne pas diffuser.`,
    },
    pharmacist: {
      title: cat => `Gamme ${categoryLabels[cat] || cat} — votre opportunité`,
      eyebrow: 'Recommandation Intégral Pharma',
      subtitle: () => `Sélection de produits à fort potentiel pour votre officine`,
      sectionTable: 'Sélection produits',
      sectionInsight: 'Pourquoi nous',
      sectionFooter: () => `Pour toute commande, contactez votre représentant Intégral Pharma.`,
    },
    marketing: {
      title: cat => `Le marché ${categoryLabels[cat] || cat} en 2026`,
      eyebrow: 'Insight marché',
      subtitle: () => `Données Ameli + Intégral Pharma · 13 mois roulants`,
      sectionTable: 'Best-sellers du segment',
      sectionInsight: 'Story',
      sectionFooter: () => `Données publiques Ameli + base Intégral Pharma`,
    },
  },
  'pharmacy-report': {
    commercial: {
      title: client => `Bilan ${client?.nom || 'pharmacie'}`,
      eyebrow: 'Compte-rendu interne',
      subtitle: client => `Analyse détaillée pour suivi commercial`,
      sectionKpis: 'Indicateurs clés',
      sectionInsight: 'Lecture commerciale',
      sectionFooter: () => `Document interne — suivi commercial Intégral Pharma`,
    },
    pharmacist: {
      title: client => `Votre bilan 2025 — ${client?.nom || ''}`,
      eyebrow: 'Bilan personnalisé Intégral Pharma',
      subtitle: () => `Préparé spécialement pour vous · ${today()}`,
      sectionKpis: 'Vos chiffres',
      sectionInsight: 'Notre lecture',
      sectionFooter: () => `Document personnel et confidentiel. Pour échanger : votre représentant Intégral Pharma.`,
    },
    marketing: {
      title: client => `Étude de cas · ${client?.nom || ''}`,
      eyebrow: 'Cas d\'école',
      subtitle: client => `Comment ${client?.ville || 'cette pharmacie'} a transformé son sourcing`,
      sectionKpis: 'En chiffres',
      sectionInsight: 'L\'histoire',
      sectionFooter: () => `Témoignage anonymisable · Communication Intégral Pharma`,
    },
  },
};

// ── Templates ────────────────────────────────────

function tplPharmacyCard(ctx) {
  const client = clientsByCip.get(ctx.cip) || (window.CLIENTS || [])[0];
  if (!client) return '<div class="mk-empty">Aucun client disponible.</div>';
  const copy = COPY['pharmacy-card'][state.audience];
  const alerts = alertsForClient(client);
  const products = topProductsForPharmacy(client, 6);
  const taux = (client.potentielGx || 0) > 0 ? Math.round(((client.ca2023 || 0) / client.potentielGx) * 100) : 0;

  return `
    ${headerHtml(client.nom, copy.eyebrow, copy.subtitle(client))}

    <section class="doc-section">
      <h2 class="doc-section-title">Profil</h2>
      <div class="doc-card">
        <div class="doc-card-row"><span class="k">CIP</span><span class="v">${esc(client.cip)}</span></div>
        <div class="doc-card-row"><span class="k">Adresse</span><span class="v">${esc(client.adresse || '—')} · ${esc(client.cp || '')} ${esc(client.ville || '')}</span></div>
        ${client.email ? `<div class="doc-card-row"><span class="k">Email</span><span class="v">${esc(client.email)}</span></div>` : ''}
        ${client.tel ? `<div class="doc-card-row"><span class="k">Téléphone</span><span class="v">${esc(client.tel)}</span></div>` : ''}
        ${client.ecodage ? `<div class="doc-card-row"><span class="k">Groupement</span><span class="v">${esc(client.ecodage)}</span></div>` : ''}
      </div>
    </section>

    <section class="doc-section">
      <h2 class="doc-section-title">Indicateurs</h2>
      <div class="doc-kpis">
        <div class="doc-kpi">
          <div class="doc-kpi-label">Potentiel Gx</div>
          <div class="doc-kpi-value">${fmtEur(client.potentielGx)}</div>
          <div class="doc-kpi-meta">Marché total adressable</div>
        </div>
        <div class="doc-kpi">
          <div class="doc-kpi-label">CA 2023</div>
          <div class="doc-kpi-value">${fmtEur(client.ca2023)}</div>
          <div class="doc-kpi-meta">Réalisé Intégral Pharma</div>
        </div>
        <div class="doc-kpi">
          <div class="doc-kpi-label">Taux pénétration</div>
          <div class="doc-kpi-value">${taux}%</div>
          <div class="doc-kpi-meta">${taux < 5 ? 'Marge importante' : taux < 15 ? 'En progression' : 'Client engagé'}</div>
        </div>
      </div>
    </section>

    ${alerts.length ? `
    <section class="doc-section">
      <h2 class="doc-section-title">${copy.sectionAlerts}</h2>
      ${alerts.map(a => `<div class="doc-alert ${a.kind}">${esc(a.text)}</div>`).join('')}
    </section>` : ''}

    <section class="doc-section">
      <h2 class="doc-section-title">${copy.sectionProducts}</h2>
      <table class="doc-table">
        <thead>
          <tr><th>Produit</th><th>Cat.</th><th class="num">Prix IP</th><th class="num">Rot/pharma</th><th class="num">Évol.</th></tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td class="designation">${esc(p.designation)}</td>
              <td>${esc(p.categorie || '—')}</td>
              <td class="num">${fmtEur(p.prix_ip)}</td>
              <td class="num">${p.rot_pharma_jan26?.toFixed(1) || '—'}</td>
              <td class="num ${(p.yoy_jan || 0) > 0 ? 'win' : (p.yoy_jan || 0) < -5 ? 'lose' : ''}">${fmtPct(p.yoy_jan)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    ${state.audience === 'commercial' ? `
    <section class="doc-section">
      <h2 class="doc-section-title">Notes de visite</h2>
      <div class="doc-card" style="min-height:80px;background:repeating-linear-gradient(transparent,transparent 22px,var(--mk-border) 23px)">
        ${client.commentaire ? `<em style="color:var(--mk-ink2)">${esc(client.commentaire)}</em>` : ''}
      </div>
    </section>` : ''}

    ${footerHtml(copy.sectionFooter(client))}
  `;
}

function tplProductArgument(ctx) {
  const cat = ctx.category || 'pp';
  const products = productsByCategory(cat, 12);
  const copy = COPY['product-argument'][state.audience];
  const totalCA = products.reduce((a, b) => a + (b.ip_ca || 0), 0);
  const totalQty = products.reduce((a, b) => a + (b.ip_qty || 0), 0);
  const avgYoy = products.filter(p => p.yoy_jan != null).reduce((a, b, _, arr) => a + b.yoy_jan / arr.length, 0);
  const referent = products.filter(p => p.artnature === 'referent').length;

  return `
    ${headerHtml(copy.title(cat), copy.eyebrow, copy.subtitle(cat))}

    <section class="doc-section">
      <h2 class="doc-section-title">Vue d'ensemble</h2>
      <div class="doc-kpis">
        <div class="doc-kpi">
          <div class="doc-kpi-label">CA top 12</div>
          <div class="doc-kpi-value">${fmtEur(totalCA)}</div>
          <div class="doc-kpi-meta">Cumul Intégral Pharma</div>
        </div>
        <div class="doc-kpi">
          <div class="doc-kpi-label">Volumes</div>
          <div class="doc-kpi-value">${fmtInt(totalQty)}</div>
          <div class="doc-kpi-meta">Unités vendues</div>
        </div>
        <div class="doc-kpi">
          <div class="doc-kpi-label">Évol. moyenne</div>
          <div class="doc-kpi-value">${fmtPct(avgYoy)}</div>
          <div class="doc-kpi-meta">${referent} produits référents IP</div>
        </div>
      </div>
    </section>

    <section class="doc-section">
      <h2 class="doc-section-title">${copy.sectionTable}</h2>
      <table class="doc-table">
        <thead>
          <tr>
            <th>Désignation</th>
            <th class="num">Prix HT</th>
            <th class="num">Prix IP</th>
            <th class="num">Remise</th>
            <th class="num">CA IP</th>
            <th class="num">Évol.</th>
          </tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td class="designation">
                ${esc(p.designation)}
                ${p.artnature === 'referent' ? '<span style="display:inline-block;margin-left:6px;font-size:9px;padding:1px 5px;background:var(--accent);color:white;border-radius:3px;font-weight:700;letter-spacing:.04em">RÉF</span>' : ''}
              </td>
              <td class="num">${fmtEur(p.prix_ht)}</td>
              <td class="num"><strong>${fmtEur(p.prix_ip)}</strong></td>
              <td class="num win">−${p.remise_pct?.toFixed(1) || '0'}%</td>
              <td class="num">${fmtEur(p.ip_ca)}</td>
              <td class="num ${(p.yoy_jan || 0) > 0 ? 'win' : (p.yoy_jan || 0) < -5 ? 'lose' : ''}">${fmtPct(p.yoy_jan)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <section class="doc-section">
      <h2 class="doc-section-title">${copy.sectionInsight}</h2>
      <div class="doc-quote">
        ${state.audience === 'pharmacist'
          ? `Sur ce segment, Intégral Pharma offre une remise moyenne de ${(products.reduce((a, b) => a + (b.remise_pct || 0), 0) / products.length).toFixed(1)}% sur les références à plus forte rotation. Une opportunité directe d'améliorer votre marge sans changer vos habitudes de prescription.`
          : state.audience === 'marketing'
          ? `${products.length} références sélectionnées sur ${categoryLabels[cat]}, ${fmtEur(totalCA)} de CA généré. ${referent} produits portent le statut « référent » dans la gamme.`
          : `Argument clé : remise moyenne ${(products.reduce((a, b) => a + (b.remise_pct || 0), 0) / products.length).toFixed(1)}% sur les top du segment, avec ${referent} référents IP. À mettre en avant chez les pharmaciens où la pénétration est faible.`}
      </div>
    </section>

    ${footerHtml(copy.sectionFooter())}
  `;
}

function tplPharmacyReport(ctx) {
  const client = clientsByCip.get(ctx.cip) || (window.CLIENTS || [])[0];
  if (!client) return '<div class="mk-empty">Aucun client disponible.</div>';
  const copy = COPY['pharmacy-report'][state.audience];
  const products = topProductsForPharmacy(client, 8);
  const taux = (client.potentielGx || 0) > 0 ? ((client.ca2023 || 0) / client.potentielGx) * 100 : 0;
  const benchAvg = 12; // approximation — taux moyen sur la base
  const positioning = taux > benchAvg ? 'au-dessus' : 'en deçà';
  const delta = (taux - benchAvg).toFixed(1);

  return `
    ${headerHtml(copy.title(client), copy.eyebrow, copy.subtitle(client))}

    <section class="doc-section">
      <h2 class="doc-section-title">${copy.sectionKpis}</h2>
      <div class="doc-kpis">
        <div class="doc-kpi">
          <div class="doc-kpi-label">Votre CA Intégral 2023</div>
          <div class="doc-kpi-value">${fmtEur(client.ca2023)}</div>
          <div class="doc-kpi-meta">Total réalisé</div>
        </div>
        <div class="doc-kpi">
          <div class="doc-kpi-label">Potentiel total</div>
          <div class="doc-kpi-value">${fmtEur(client.potentielGx)}</div>
          <div class="doc-kpi-meta">Marché adressable</div>
        </div>
        <div class="doc-kpi">
          <div class="doc-kpi-label">Vs benchmark secteur</div>
          <div class="doc-kpi-value" style="color:${taux > benchAvg ? 'var(--mk-mint)' : 'var(--mk-amber)'}">${delta > 0 ? '+' : ''}${delta} pts</div>
          <div class="doc-kpi-meta">${positioning} de la moyenne ${benchAvg}%</div>
        </div>
      </div>
    </section>

    <section class="doc-section">
      <h2 class="doc-section-title">${copy.sectionInsight}</h2>
      <div class="doc-quote">
        ${state.audience === 'pharmacist'
          ? `${esc(client.nom)} se positionne ${positioning} de la moyenne sectorielle (${benchAvg}%). ${taux < benchAvg ? 'Il existe une marge de progression claire — sélection ci-dessous des produits à intégrer prioritairement.' : 'Continuons à consolider cette dynamique avec les références à forte rotation ci-dessous.'}`
          : state.audience === 'marketing'
          ? `Une pharmacie de ${client.ville || ''} qui ${taux < benchAvg ? 'cherche à renforcer son sourcing IP' : 'a démultiplié sa rentabilité grâce à un sourcing intelligent'}.`
          : `Taux de pénétration ${taux.toFixed(1)}% (benchmark ${benchAvg}%). ${taux < 5 ? 'Marge énorme à activer.' : taux < benchAvg ? 'Cibler en priorité.' : 'Consolider.'}`}
      </div>
    </section>

    <section class="doc-section">
      <h2 class="doc-section-title">Plan d'action recommandé</h2>
      <table class="doc-table">
        <thead>
          <tr><th>#</th><th>Produit</th><th class="num">Prix IP</th><th class="num">Remise</th><th>Bénéfice</th></tr>
        </thead>
        <tbody>
          ${products.map((p, i) => `
            <tr>
              <td><strong>${i + 1}</strong></td>
              <td class="designation">${esc(p.designation)}</td>
              <td class="num">${fmtEur(p.prix_ip)}</td>
              <td class="num win">−${p.remise_pct?.toFixed(1) || '0'}%</td>
              <td style="font-size:11px;color:var(--mk-ink2)">${p.artnature === 'referent' ? 'Référent IP, forte rotation.' : (p.yoy_jan || 0) > 5 ? 'Forte croissance secteur.' : 'Rotation établie.'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    ${footerHtml(copy.sectionFooter())}
  `;
}

// ── HTML helpers ─────────────────────────────────
function headerHtml(title, eyebrow, subtitle) {
  if (!state.options.logo) {
    return `
      <div style="margin-bottom:22px">
        <div class="doc-eyebrow">${esc(eyebrow || '')}</div>
        <h1 class="doc-title">${esc(title || '')}</h1>
        <div class="doc-subtitle">${esc(subtitle || '')}</div>
      </div>`;
  }
  const brandName = state.audience === 'pharmacist' ? 'Intégral Pharma' : state.audience === 'marketing' ? 'IP' : 'Intégral Pharma';
  const brandSub = state.audience === 'pharmacist' ? 'Votre partenaire pharmaceutique' : 'Document commercial';
  return `
    <div class="doc-header">
      <div class="doc-brand">
        <div class="doc-brand-mark">IP</div>
        <div>
          <div class="doc-brand-name">${esc(brandName)}</div>
          <div class="doc-brand-sub">${esc(brandSub)}</div>
        </div>
      </div>
      <div class="doc-meta">
        <div class="doc-meta-key">${today()}</div>
        <div>Confidentiel</div>
      </div>
    </div>
    <div>
      <div class="doc-eyebrow">${esc(eyebrow || '')}</div>
      <h1 class="doc-title">${esc(title || '')}</h1>
      <div class="doc-subtitle">${esc(subtitle || '')}</div>
    </div>
  `;
}

function footerHtml(text) {
  if (!state.options.footer) return '';
  return `<footer class="doc-footer"><span>${esc(text)}</span><span>Intégral Pharma · ${today()}</span></footer>`;
}

// ── Rendu ────────────────────────────────────────
function render() {
  const paper = $('#mk-paper');
  paper.className = 'mk-paper aud-' + state.audience;
  if (!state.options.color) paper.classList.add('no-color');

  let html;
  if (state.template === 'pharmacy-card') html = tplPharmacyCard(state.context);
  else if (state.template === 'product-argument') html = tplProductArgument(state.context);
  else if (state.template === 'pharmacy-report') html = tplPharmacyReport(state.context);
  else html = '<div class="mk-empty">Template inconnu.</div>';

  paper.innerHTML = html;
}

// ── Sidebar : context picker dynamique ───────────
function renderContextZone() {
  const zone = $('#mk-context-zone');
  zone.innerHTML = '';

  if (state.template === 'pharmacy-card' || state.template === 'pharmacy-report') {
    const label = document.createElement('label');
    label.className = 'mk-label';
    label.textContent = 'Pharmacie cible';
    zone.appendChild(label);

    const search = document.createElement('input');
    search.className = 'mk-input';
    search.placeholder = 'Rechercher (nom, CIP, ville)…';
    zone.appendChild(search);

    const select = document.createElement('select');
    select.className = 'mk-select';
    select.size = 8;
    select.style.cssText = 'height:200px;font-size:12px';
    const populate = (q = '') => {
      const ql = q.toLowerCase();
      const filtered = (window.CLIENTS || [])
        .filter(c => !ql || `${c.nom} ${c.cip} ${c.ville}`.toLowerCase().includes(ql))
        .sort((a, b) => (b.potentielGx || 0) - (a.potentielGx || 0))
        .slice(0, 200);
      select.innerHTML = filtered.map(c => `<option value="${esc(c.cip)}" ${c.cip === state.context.cip ? 'selected' : ''}>${esc(c.nom)} · ${esc(c.ville || '')}</option>`).join('');
    };
    populate();
    if (!state.context.cip && (window.CLIENTS || [])[0]) {
      state.context.cip = window.CLIENTS[0].cip;
      select.value = state.context.cip;
    }
    select.addEventListener('change', () => { state.context.cip = select.value; render(); });
    search.addEventListener('input', () => populate(search.value));
    zone.appendChild(select);

    const info = document.createElement('div');
    info.className = 'mk-context-info';
    info.textContent = `${(window.CLIENTS || []).length} pharmacies disponibles. Triées par potentiel décroissant.`;
    zone.appendChild(info);
  } else if (state.template === 'product-argument') {
    const label = document.createElement('label');
    label.className = 'mk-label';
    label.textContent = 'Catégorie';
    zone.appendChild(label);

    const select = document.createElement('select');
    select.className = 'mk-select';
    const cats = [...new Set((window.BENCHMARK || []).map(b => b.categorie).filter(Boolean))].sort();
    select.innerHTML = cats.map(c => `<option value="${esc(c)}" ${c === state.context.category ? 'selected' : ''}>${esc(categoryLabels[c] || c)} (${(window.BENCHMARK || []).filter(b => b.categorie === c).length})</option>`).join('');
    if (!state.context.category) state.context.category = cats[0];
    select.value = state.context.category;
    select.addEventListener('change', () => { state.context.category = select.value; render(); });
    zone.appendChild(select);

    const info = document.createElement('div');
    info.className = 'mk-context-info';
    info.textContent = `${cats.length} catégories disponibles dans le benchmark Intégral Pharma.`;
    zone.appendChild(info);
  }
}

// ── Boot ─────────────────────────────────────────
function init() {
  // Template picker
  document.querySelectorAll('#mk-template-picker button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#mk-template-picker button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.template = btn.dataset.template;
      state.context = {};
      renderContextZone();
      render();
    });
  });

  // Audience picker
  document.querySelectorAll('#mk-audience-picker button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#mk-audience-picker button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.audience = btn.dataset.audience;
      render();
    });
  });

  // Options
  $('#mk-opt-logo').addEventListener('change', e => { state.options.logo = e.target.checked; render(); });
  $('#mk-opt-footer').addEventListener('change', e => { state.options.footer = e.target.checked; render(); });
  $('#mk-opt-color').addEventListener('change', e => { state.options.color = e.target.checked; render(); });

  // Boutons
  $('#mk-btn-print').addEventListener('click', () => window.print());
  $('#mk-btn-open').addEventListener('click', () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const css = Array.from(document.styleSheets).filter(s => s.href).map(s => `<link rel="stylesheet" href="${s.href}">`).join('\n');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">${css}<style>body{background:white}.mk-paper{box-shadow:none;border-radius:0;margin:0;padding:1.6cm}</style></head><body>${$('#mk-paper').outerHTML}</body></html>`);
    w.document.close();
  });
  $('#mk-btn-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#mk-paper').outerHTML);
      const btn = $('#mk-btn-copy');
      const orig = btn.textContent;
      btn.textContent = '✓ Copié';
      setTimeout(() => btn.textContent = orig, 1500);
    } catch {
      alert('Impossible de copier (autorise l\'accès au presse-papier).');
    }
  });

  renderContextZone();
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
