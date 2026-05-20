// Dashboard parité UX/UI — charge les rapports JSON et affiche un score par bot.

const BOT_LABELS = {
  'token-bot':     { name: 'Token Bot',     icon: '🎨', desc: 'Variables CSS — collisions, manques, coverage' },
  'palette-bot':   { name: 'Palette Bot',   icon: '🌈', desc: 'Couleurs hardcodées hors tokens' },
  'typo-bot':      { name: 'Typo Bot',      icon: '✒️', desc: 'Familles, tailles, poids' },
  'spacing-bot':   { name: 'Spacing Bot',   icon: '📐', desc: 'Grille 8px, padding/margin/gap' },
  'component-bot': { name: 'Component Bot', icon: '🧩', desc: 'card, modal, kpi, badge, pill, btn' },
  'a11y-bot':      { name: 'A11y Bot',      icon: '♿', desc: 'ARIA, focus, skip-link, sr-only' },
  'nav-bot':       { name: 'Nav Bot',       icon: '🧭', desc: 'Sidebar, bottom-nav, tabs' },
  'radius-bot':    { name: 'Radius Bot',    icon: '🔘', desc: 'Échelle d\'arrondis' },
};

const scoreClass = s => s >= 85 ? 'good' : s >= 60 ? 'warn' : 'bad';
const fmtDate = iso => {
  try { return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
};

async function loadIndex() {
  try {
    const r = await fetch('reports/index.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch {
    return null;
  }
}

async function loadReport(botId) {
  try {
    const r = await fetch(`reports/${botId}.json`, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch {
    return null;
  }
}

function renderCard(entry) {
  const meta = BOT_LABELS[entry.id] || { name: entry.id, icon: '🤖', desc: '' };
  const card = document.createElement('div');
  card.className = 'bot-card';
  if (entry.status !== 'ok') card.classList.add('pending');

  const scoreHtml = entry.status === 'ok'
    ? `<span class="bot-score ${scoreClass(entry.score)}">${entry.score}/100</span>`
    : `<span class="bot-score pending">${entry.status === 'pending' ? 'À venir' : 'Erreur'}</span>`;

  card.innerHTML = `
    <div class="bot-card-head">
      <div class="bot-name">${meta.icon} ${meta.name}</div>
      ${scoreHtml}
    </div>
    <div class="bot-meta">${meta.desc}</div>
    ${entry.status === 'ok' ? `
      <div class="bot-meta" style="margin-top:8px">
        <strong>${entry.issueCount}</strong> divergence${entry.issueCount > 1 ? 's' : ''}
        · <span style="opacity:.7">maj ${fmtDate(entry.generatedAt)}</span>
      </div>` : ''}
  `;

  if (entry.status === 'ok') {
    card.addEventListener('click', () => showDetail(entry.id));
  }
  return card;
}

async function showDetail(botId) {
  const report = await loadReport(botId);
  const detail = document.getElementById('detail');
  if (!report) {
    detail.hidden = true;
    return;
  }
  detail.hidden = false;
  detail.innerHTML = '';

  const meta = BOT_LABELS[botId] || { name: botId, icon: '🤖' };
  const h2 = document.createElement('h2');
  h2.textContent = `${meta.icon} ${report.botName} — ${report.findings.length} divergence${report.findings.length > 1 ? 's' : ''}`;
  detail.appendChild(h2);

  const sub = document.createElement('div');
  sub.className = 'sub';
  const totals = Object.entries(report.summary.bySurface)
    .map(([k, v]) => `${k}: ${v.defined} déf · ${v.used} utilisés`)
    .join('  ·  ');
  sub.textContent = `${totals}  ·  généré ${fmtDate(report.generatedAt)}`;
  detail.appendChild(sub);

  for (const f of report.findings.slice(0, 100)) {
    const row = document.createElement('div');
    row.className = 'finding';
    const issues = [];
    if (f.issues.valueCollision) issues.push({ label: 'Collision de valeurs', bad: true });
    if (f.issues.partialCoverage) issues.push({ label: 'Coverage partielle' });
    if (f.issues.usedUndefined.length) issues.push({ label: `Utilisé sans déf : ${f.issues.usedUndefined.join(', ')}`, bad: true });
    if (f.issues.definedUnused.length) issues.push({ label: `Défini non utilisé : ${f.issues.definedUnused.join(', ')}` });

    row.innerHTML = `
      <div class="finding-token">${f.token}</div>
      <div class="finding-issues">
        ${issues.map(i => `<span class="issue-tag ${i.bad ? 'bad' : ''}">${i.label}</span>`).join('')}
      </div>
      ${Object.keys(f.values).length ? `
        <div class="finding-values">
          ${Object.entries(f.values).map(([s, v]) =>
            `<span class="surface">${s}</span><span class="value">${v}</span>`
          ).join('')}
        </div>` : ''}
    `;
    detail.appendChild(row);
  }
  if (report.findings.length > 100) {
    const more = document.createElement('div');
    more.className = 'sub';
    more.style.marginTop = '12px';
    more.textContent = `… et ${report.findings.length - 100} autres dans le JSON brut.`;
    detail.appendChild(more);
  }

  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function init() {
  const grid = document.getElementById('bots-grid');
  const meta = document.getElementById('topbar-meta');

  const index = await loadIndex();
  if (!index) {
    grid.innerHTML = `<div class="empty">
      Aucun rapport disponible.<br>
      Lance <code style="background:var(--b-bg2);padding:2px 8px;border-radius:6px">node bots/run-all.mjs</code> pour générer les rapports.
    </div>`;
    return;
  }

  meta.textContent = `Dernier audit : ${fmtDate(index.generatedAt)}`;
  grid.innerHTML = '';

  const order = ['token-bot', 'palette-bot', 'typo-bot', 'spacing-bot', 'component-bot', 'a11y-bot', 'nav-bot', 'radius-bot'];
  const sorted = [...index.bots].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  for (const b of sorted) {
    grid.appendChild(renderCard(b));
  }

  // Ouvre auto le premier bot OK
  const firstOk = sorted.find(b => b.status === 'ok');
  if (firstOk) showDetail(firstOk.id);
}

init();
