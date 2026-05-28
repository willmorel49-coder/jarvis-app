// Cockpit Parité UX/UI — orchestre hero, trend, plan d'action et bots.

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
const ORDER = ['token-bot','palette-bot','typo-bot','spacing-bot','component-bot','a11y-bot','nav-bot','radius-bot'];

const scoreClass = s => s >= 85 ? 'good' : s >= 60 ? 'warn' : 'bad';
const fmtDate = iso => { try { return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; } };
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function loadJson(path) {
  try { const r = await fetch(path, { cache: 'no-store' }); if (!r.ok) throw 0; return await r.json(); }
  catch { return null; }
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ── Hero ───────────────────────────────────────────
function renderHero(index, trend, plan) {
  const okBots = index.bots.filter(b => b.status === 'ok');
  const global = okBots.length ? Math.round(okBots.reduce((a, b) => a + b.score, 0) / okBots.length) : 0;
  const scoreEl = document.getElementById('global-score');
  scoreEl.textContent = global;
  scoreEl.className = 'hero-score-value ' + (global >= 85 ? '' : global >= 60 ? 'warn' : 'bad');

  // Trend delta
  const trendEl = document.getElementById('global-trend');
  if (trend && trend.length >= 2) {
    const delta = global - trend[trend.length - 2].globalScore;
    const arrow = delta > 0 ? `<span class="up">↗ +${delta} pts</span>` : delta < 0 ? `<span class="down">↘ ${delta} pts</span>` : `<span>= ${delta} pts</span>`;
    trendEl.innerHTML = `${arrow} vs run précédent`;
  } else {
    trendEl.textContent = 'Premier run — pas encore d\'historique';
  }

  // Trend chart SVG
  drawTrend(trend);

  // Plan d'action top 5
  const list = document.getElementById('action-list');
  list.innerHTML = '';
  const actions = (plan?.actions || []).slice(0, 5);
  if (!actions.length) {
    list.innerHTML = '<li class="action-meta" style="padding:8px 4px">Aucune action prioritaire — bravo.</li>';
  } else {
    for (let i = 0; i < actions.length; i++) {
      const a = actions[i];
      const m = BOT_LABELS[a.bot] || { icon: '🤖' };
      const li = document.createElement('li');
      li.className = 'action-item';
      li.innerHTML = `
        <span class="action-num">${i + 1}</span>
        <div>
          <div class="action-title">${esc(a.title)}</div>
          <div class="action-meta">${m.icon} ${esc(a.bot)} · impact ${a.impact}/3 · effort ${a.effort}/3</div>
        </div>
        <span class="action-meta">${a.score.toFixed(1)}</span>
      `;
      li.addEventListener('click', () => showDetail(a.bot));
      list.appendChild(li);
    }
  }
}

function drawTrend(trend) {
  const svg = document.getElementById('trend-svg');
  const meta = document.getElementById('trend-meta');
  if (!trend || trend.length < 2) {
    svg.innerHTML = '<text x="200" y="50" text-anchor="middle" fill="#8b94ac" font-size="11">Pas encore d\'historique — relance run-all.mjs plusieurs fois</text>';
    meta.textContent = '';
    return;
  }
  const W = 400, H = 80, PAD = 8;
  const pts = trend.slice(-30);
  const ys = pts.map(t => t.globalScore);
  const min = Math.min(...ys, 0), max = Math.max(...ys, 100);
  const range = max - min || 1;
  const stepX = (W - PAD * 2) / (pts.length - 1);
  const coords = pts.map((t, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((t.globalScore - min) / range) * (H - PAD * 2);
    return [x, y];
  });
  const line = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ',' + c[1].toFixed(1)).join(' ');
  const area = line + ` L${coords[coords.length-1][0].toFixed(1)},${H} L${coords[0][0].toFixed(1)},${H} Z`;
  svg.innerHTML = `
    <defs>
      <linearGradient id="trend-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#5b8def"/>
        <stop offset="100%" stop-color="#7c5cff"/>
      </linearGradient>
      <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7c5cff" stop-opacity=".25"/>
        <stop offset="100%" stop-color="#7c5cff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" class="area"/>
    <path d="${line}" class="line"/>
  `;
  meta.textContent = `${pts.length} runs · min ${Math.min(...ys)} · max ${Math.max(...ys)} · dernier ${ys[ys.length-1]}`;
}

// ── Bot cards ──────────────────────────────────────
function renderCard(entry) {
  const meta = BOT_LABELS[entry.id] || { name: entry.id, icon: '🤖', desc: '' };
  const card = document.createElement('div');
  card.className = 'bot-card';
  card.dataset.botId = entry.id;
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
    ${entry.status === 'ok' ? `<div class="bot-meta" style="margin-top:8px"><strong>${entry.issueCount ?? 0}</strong> observation${(entry.issueCount ?? 0) > 1 ? 's' : ''} · maj ${fmtDate(entry.generatedAt)}</div>` : ''}
  `;
  if (entry.status === 'ok') card.addEventListener('click', () => showDetail(entry.id));
  return card;
}

// ── Detail ─────────────────────────────────────────
function renderFinding(f) {
  const sev = f.severity === 'warn' ? 'bad' : '';
  const title = f.label || f.type || 'Observation';
  let body = '';

  if (f.token) {
    body = `<div class="finding-token">${esc(f.token)}</div>`;
    if (f.values && Object.keys(f.values).length) {
      body += '<div class="finding-values">';
      for (const [s, v] of Object.entries(f.values)) body += `<span class="surface">${esc(s)}</span><span class="value">${esc(v)}</span>`;
      body += '</div>';
    }
  } else if (f.color) {
    body = `<div class="finding-token" style="display:flex;align-items:center;gap:8px">
      <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${esc(f.color)};border:1px solid rgba(255,255,255,.1)"></span>
      <code>${esc(f.color)}</code><span style="color:var(--b-text3);font-size:12px">×${f.total}</span>
    </div>
    <div class="finding-values" style="margin-top:6px">${Object.entries(f.surfaces || {}).map(([s, n]) => `<span class="surface">${esc(s)}</span><span class="value">${n} occ</span>`).join('')}</div>`;
  } else if (f.surface && f.sizes) {
    body = `<div class="finding-values">${f.sizes.slice(0, 8).map(x => `<span class="surface">${esc(x.size)}</span><span class="value">×${x.count}</span>`).join('')}</div>`;
  } else if (f.surface && f.offGridSamples) {
    body = `<div style="font-size:12px;color:var(--b-text3);margin-top:4px">${f.onGridCount} on-grid · ${f.offGridCount} off-grid</div>
    <div class="finding-values" style="margin-top:6px">${f.offGridSamples.map(x => `<span class="surface">${esc(x.value)}</span><span class="value">×${x.count}</span>`).join('')}</div>`;
  } else if (f.component) {
    body = `<div class="finding-token">${esc(f.component)}</div><div style="font-size:12px;color:var(--b-text3);margin-top:4px">${esc(f.desc || '')}</div>`;
    if (f.missingFrom) body += `<div class="finding-issues"><span class="issue-tag bad">manque dans : ${f.missingFrom.join(', ')}</span></div>`;
  } else if (f.check) {
    body = `<div class="finding-token">${esc(f.label)}</div>
    <div class="finding-values" style="margin-top:6px">${Object.entries(f.counts || {}).map(([s, n]) => `<span class="surface">${esc(s)}</span><span class="value">${n} occ</span>`).join('')}</div>`;
  } else if (f.radius) {
    body = `<div class="finding-token">border-radius: ${esc(f.radius)}</div><div style="font-size:12px;color:var(--b-text3);margin-top:4px">${esc(f.surface)} ×${f.count}</div>`;
  } else if (f.details) {
    body = `<div class="finding-values">${Object.entries(f.details).map(([s, v]) => `<span class="surface">${esc(s)}</span><span class="value">${esc(JSON.stringify(v))}</span>`).join('')}</div>`;
  }

  return `<div class="finding">
    <div class="finding-issues"><span class="issue-tag ${sev}">${esc(title)}</span></div>
    ${body}
  </div>`;
}

async function showDetail(botId) {
  document.querySelectorAll('.bot-card').forEach(c => c.classList.toggle('active', c.dataset.botId === botId));
  const report = await loadJson(`reports/${botId}.json`);
  const detail = document.getElementById('detail');
  if (!report) { detail.hidden = true; return; }
  detail.hidden = false;
  detail.innerHTML = '';

  const meta = BOT_LABELS[botId] || { name: botId, icon: '🤖' };
  const h2 = document.createElement('h2');
  h2.textContent = `${meta.icon} ${report.botName} — ${report.findings.length} observation${report.findings.length > 1 ? 's' : ''}`;
  detail.appendChild(h2);

  const sub = document.createElement('div');
  sub.className = 'sub';
  const bs = report.summary?.bySurface;
  sub.textContent = (bs ? Object.entries(bs).map(([k, v]) => `${k}: ${Object.entries(v).map(([kk, vv]) => `${kk} ${vv}`).join(' · ')}`).join('  |  ') : '') + `  ·  ${fmtDate(report.generatedAt)}`;
  detail.appendChild(sub);

  // Proposals
  if (report.proposals && report.proposals.length) {
    const safe = report.proposals.filter(p => p.safety === 'safe');
    const manual = report.proposals.filter(p => p.safety === 'manual');
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <h3 style="margin:20px 0 10px;font-size:14px;color:var(--b-text2)">🔧 Correctifs proposés</h3>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <span class="issue-tag" style="background:rgba(45,212,164,.15);color:var(--b-good)">${safe.length} safe</span>
        <span class="issue-tag">${manual.length} manuels</span>
      </div>
      ${safe.length ? `<div style="background:rgba(45,212,164,.06);border:1px solid rgba(45,212,164,.2);border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12px"><strong style="color:var(--b-good)">Auto-applicables :</strong> <code style="background:var(--b-bg);padding:2px 6px;border-radius:4px">node bots/apply-fixes.mjs --apply</code></div>` : ''}
      ${[...safe, ...manual].slice(0, 12).map(p => `
        <div class="finding">
          <div class="finding-issues">
            <span class="issue-tag" style="${p.safety === 'safe' ? 'background:rgba(45,212,164,.15);color:var(--b-good)' : ''}">${esc(p.safety)}</span>
            <span class="issue-tag">${esc(p.type)}</span>
            ${p.token ? `<code style="font-size:11px;color:var(--b-text2)">${esc(p.token)}</code>` : ''}
          </div>
          <div style="font-size:12px;color:var(--b-text2);margin-top:6px">${esc(p.rationale || p.suggestion || '')}</div>
          ${p.search && p.replace ? `<div style="font-family:ui-monospace,monospace;font-size:11px;margin-top:6px;color:var(--b-text3)">${esc(p.search)} → ${esc(p.replace)}</div>` : ''}
        </div>`).join('')}
    `;
    detail.appendChild(wrap);
  }

  const h3 = document.createElement('h3');
  h3.textContent = '🔍 Findings détaillés';
  h3.style.cssText = 'margin:24px 0 10px;font-size:14px;color:var(--b-text2)';
  detail.appendChild(h3);
  const list = document.createElement('div');
  list.innerHTML = report.findings.slice(0, 60).map(renderFinding).join('');
  detail.appendChild(list);

  detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Export ────────────────────────────────────────
async function exportMarkdown() {
  const md = await fetch('reports/report.md', { cache: 'no-store' });
  if (!md.ok) { toast('Rapport non disponible — lance node bots/run-all.mjs'); return; }
  const text = await md.text();
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `parite-ux-${new Date().toISOString().slice(0,10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Rapport téléchargé');
}

// ── Init ──────────────────────────────────────────
async function init() {
  const grid = document.getElementById('bots-grid');
  const topMeta = document.getElementById('topbar-meta');

  const [index, trend, plan] = await Promise.all([
    loadJson('reports/index.json'),
    loadJson('reports/trend.json'),
    loadJson('reports/action-plan.json'),
  ]);

  if (!index) {
    grid.innerHTML = `<div class="empty">Aucun rapport. Lance <code>node bots/run-all.mjs</code></div>`;
    return;
  }

  topMeta.textContent = `Dernier audit : ${fmtDate(index.generatedAt)}`;
  renderHero(index, trend, plan);

  const sorted = [...index.bots].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  grid.innerHTML = '';
  for (const b of sorted) grid.appendChild(renderCard(b));

  const firstOk = sorted.find(b => b.status === 'ok');
  if (firstOk) showDetail(firstOk.id);

  document.getElementById('btn-export').addEventListener('click', exportMarkdown);
}

init();
