// Dashboard parité UX/UI — charge les rapports JSON et affiche un score par bot.

const BOT_LABELS = {
  'token-bot':     { name: 'Token Bot',     icon: '🎨', desc: 'Variables CSS — collisions, manques, coverage' },
  'palette-bot':   { name: 'Palette Bot',   icon: '🌈', desc: 'Couleurs hardcodées hors tokens' },
  'typo-bot':      { name: 'Typo Bot',      icon: '✒️', desc: 'Familles, tailles, poids' },
  'spacing-bot':   { name: 'Spacing Bot',   icon: '📐', desc: 'Grille 4px, padding/margin/gap' },
  'component-bot': { name: 'Component Bot', icon: '🧩', desc: 'card, modal, kpi, badge, pill, btn' },
  'a11y-bot':      { name: 'A11y Bot',      icon: '♿', desc: 'ARIA, focus, skip-link, sr-only' },
  'nav-bot':       { name: 'Nav Bot',       icon: '🧭', desc: 'Sidebar, bottom-nav, tabs' },
  'radius-bot':    { name: 'Radius Bot',    icon: '🔘', desc: 'Échelle d\'arrondis' },
};

const ORDER = ['token-bot', 'palette-bot', 'typo-bot', 'spacing-bot', 'component-bot', 'a11y-bot', 'nav-bot', 'radius-bot'];

const scoreClass = s => s >= 85 ? 'good' : s >= 60 ? 'warn' : 'bad';
const fmtDate = iso => {
  try { return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
};
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function loadJson(path) {
  try {
    const r = await fetch(path, { cache: 'no-store' });
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
      <div class="bot-name">${meta.icon} ${esc(meta.name)}</div>
      ${scoreHtml}
    </div>
    <div class="bot-meta">${esc(meta.desc)}</div>
    ${entry.status === 'ok' ? `
      <div class="bot-meta" style="margin-top:8px">
        <strong>${entry.issueCount ?? 0}</strong> observation${(entry.issueCount ?? 0) > 1 ? 's' : ''}
        · <span style="opacity:.7">maj ${fmtDate(entry.generatedAt)}</span>
      </div>` : ''}
  `;

  if (entry.status === 'ok') {
    card.addEventListener('click', () => showDetail(entry.id));
  }
  return card;
}

// ── Renderers spécifiques par bot ──

function renderFindingGeneric(f) {
  const sev = f.severity === 'warn' ? 'bad' : f.severity === 'info' ? '' : '';
  const title = f.label || f.type || 'Observation';
  let body = '';

  // Mapping spécifique du payload pertinent par bot
  if (f.token) {
    body = `<div class="finding-token">${esc(f.token)}</div>`;
    if (f.values && Object.keys(f.values).length) {
      body += '<div class="finding-values">';
      for (const [s, v] of Object.entries(f.values)) {
        body += `<span class="surface">${esc(s)}</span><span class="value">${esc(v)}</span>`;
      }
      body += '</div>';
    }
  } else if (f.color) {
    body = `<div class="finding-token" style="display:flex;align-items:center;gap:8px">
      <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${esc(f.color)};border:1px solid rgba(255,255,255,.1)"></span>
      <code>${esc(f.color)}</code>
      <span style="color:var(--b-text3);font-size:12px">×${f.total}</span>
    </div>
    <div class="finding-values" style="margin-top:6px">
      ${Object.entries(f.surfaces || {}).map(([s, n]) => `<span class="surface">${esc(s)}</span><span class="value">${n} occ</span>`).join('')}
    </div>`;
  } else if (f.surface && f.sizes) {
    body = `<div class="finding-values">${f.sizes.slice(0, 8).map(x => `<span class="surface">${esc(x.size)}</span><span class="value">×${x.count}</span>`).join('')}</div>`;
  } else if (f.surface && f.offGridSamples) {
    body = `<div style="font-size:12px;color:var(--b-text3);margin-top:4px">${f.onGridCount} on-grid · ${f.offGridCount} off-grid</div>
    <div class="finding-values" style="margin-top:6px">${f.offGridSamples.map(x => `<span class="surface">${esc(x.value)}</span><span class="value">×${x.count}</span>`).join('')}</div>`;
  } else if (f.component) {
    body = `<div class="finding-token">${esc(f.component)}</div>
    <div style="font-size:12px;color:var(--b-text3);margin-top:4px">${esc(f.desc || '')}</div>`;
    if (f.missingFrom) {
      body += `<div class="finding-issues"><span class="issue-tag bad">manque dans : ${f.missingFrom.join(', ')}</span></div>`;
    }
  } else if (f.check) {
    body = `<div class="finding-token">${esc(f.label)}</div>
    <div class="finding-values" style="margin-top:6px">${Object.entries(f.counts || {}).map(([s, n]) => `<span class="surface">${esc(s)}</span><span class="value">${n} occ</span>`).join('')}</div>`;
  } else if (f.radius) {
    body = `<div class="finding-token">border-radius: ${esc(f.radius)}</div>
    <div style="font-size:12px;color:var(--b-text3);margin-top:4px">${esc(f.surface)} ×${f.count}</div>`;
  } else if (f.details) {
    body = `<div class="finding-values">${Object.entries(f.details).map(([s, v]) => `<span class="surface">${esc(s)}</span><span class="value">${esc(JSON.stringify(v))}</span>`).join('')}</div>`;
  }

  return `<div class="finding">
    <div class="finding-issues">
      <span class="issue-tag ${sev}">${esc(title)}</span>
    </div>
    ${body}
  </div>`;
}

async function showDetail(botId) {
  const report = await loadJson(`reports/${botId}.json`);
  const detail = document.getElementById('detail');
  if (!report) {
    detail.hidden = true;
    return;
  }
  detail.hidden = false;
  detail.innerHTML = '';

  const meta = BOT_LABELS[botId] || { name: botId, icon: '🤖' };
  const h2 = document.createElement('h2');
  h2.textContent = `${meta.icon} ${report.botName} — ${report.findings.length} observation${report.findings.length > 1 ? 's' : ''}`;
  detail.appendChild(h2);

  const sub = document.createElement('div');
  sub.className = 'sub';
  const summary = report.summary || {};
  const bySurfaceStr = summary.bySurface
    ? Object.entries(summary.bySurface).map(([k, v]) => {
        const vals = Object.entries(v).map(([kk, vv]) => `${kk}: ${vv}`).join(' · ');
        return `${k} → ${vals}`;
      }).join(' | ')
    : '';
  sub.textContent = `${bySurfaceStr}  ·  généré ${fmtDate(report.generatedAt)}`;
  detail.appendChild(sub);

  // Section proposals (fixes)
  if (report.proposals && report.proposals.length) {
    const propWrap = document.createElement('div');
    propWrap.className = 'proposals';
    const safe = report.proposals.filter(p => p.safety === 'safe');
    const manual = report.proposals.filter(p => p.safety === 'manual');
    propWrap.innerHTML = `
      <h3 style="margin:20px 0 10px;font-size:14px;color:var(--b-text2)">🔧 Propositions de correctifs</h3>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <span class="issue-tag" style="background:rgba(16,185,129,.15);color:var(--b-good)">${safe.length} safe</span>
        <span class="issue-tag">${manual.length} manuels</span>
      </div>
      ${safe.length ? `
        <div style="background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:12px">
          <strong style="color:var(--b-good)">Auto-appliquables :</strong>
          <code style="background:var(--b-bg);padding:2px 6px;border-radius:4px;margin-left:4px">node bots/apply-fixes.mjs --apply</code>
        </div>` : ''}
      ${[...safe, ...manual].slice(0, 20).map(p => `
        <div class="finding">
          <div class="finding-issues">
            <span class="issue-tag ${p.safety === 'safe' ? '' : 'bad'}" style="${p.safety === 'safe' ? 'background:rgba(16,185,129,.15);color:var(--b-good)' : ''}">${esc(p.safety)}</span>
            <span class="issue-tag">${esc(p.type)}</span>
            ${p.token ? `<code style="font-size:11px;color:var(--b-text2)">${esc(p.token)}</code>` : ''}
          </div>
          <div style="font-size:12px;color:var(--b-text2);margin-top:6px">${esc(p.rationale || p.suggestion || '')}</div>
          ${p.search && p.replace ? `<div style="font-family:ui-monospace,monospace;font-size:11px;margin-top:6px;color:var(--b-text3)">${esc(p.search)} → ${esc(p.replace)}</div>` : ''}
        </div>
      `).join('')}
    `;
    detail.appendChild(propWrap);
  }

  const findingsHeader = document.createElement('h3');
  findingsHeader.textContent = '🔍 Findings détaillés';
  findingsHeader.style.cssText = 'margin:24px 0 10px;font-size:14px;color:var(--b-text2)';
  detail.appendChild(findingsHeader);

  const list = document.createElement('div');
  list.innerHTML = report.findings.slice(0, 80).map(renderFindingGeneric).join('');
  detail.appendChild(list);

  if (report.findings.length > 80) {
    const more = document.createElement('div');
    more.className = 'sub';
    more.style.marginTop = '12px';
    more.textContent = `… et ${report.findings.length - 80} autres dans le JSON brut (bots/reports/${botId}.json).`;
    detail.appendChild(more);
  }

  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function init() {
  const grid = document.getElementById('bots-grid');
  const meta = document.getElementById('topbar-meta');

  const index = await loadJson('reports/index.json');
  if (!index) {
    grid.innerHTML = `<div class="empty">
      Aucun rapport disponible.<br>
      Lance <code>node bots/run-all.mjs</code> pour générer les rapports.
    </div>`;
    return;
  }

  meta.textContent = `Dernier audit : ${fmtDate(index.generatedAt)}`;
  grid.innerHTML = '';

  const sorted = [...index.bots].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  for (const b of sorted) {
    grid.appendChild(renderCard(b));
  }

  // Score global moyen
  const okBots = sorted.filter(b => b.status === 'ok');
  if (okBots.length) {
    const avg = Math.round(okBots.reduce((a, b) => a + b.score, 0) / okBots.length);
    meta.textContent += `  ·  score global ${avg}/100`;
  }

  const firstOk = sorted.find(b => b.status === 'ok');
  if (firstOk) showDetail(firstOk.id);
}

init();
