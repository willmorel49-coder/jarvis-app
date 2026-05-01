/* ═══════════════════════════════════════════════════════
   INTÉGRAL PHARMA · Catalogue Grossiste — CRM Integration
   Données produits : catalogue-data.js (blob gzip+b64)
   Partage localStorage avec ip_app-8.html :
     ip_favs, ip_cart, ip_cmp
═══════════════════════════════════════════════════════ */

// ── DATA LOADER ─────────────────────────────────────────────────
async function catLd(b64) {
  const bin = atob(b64), by = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
  const ds = new DecompressionStream('gzip'), w = ds.writable.getWriter();
  w.write(by); w.close();
  const o = [], rd = ds.readable.getReader();
  while (true) { const { done, value } = await rd.read(); if (done) break; o.push(value); }
  const all = new Uint8Array(o.reduce((a, b) => a + b.length, 0));
  let p = 0; for (const c of o) { all.set(c, p); p += c.length; }
  return JSON.parse(new TextDecoder().decode(all));
}

// ── CONSTANTS ───────────────────────────────────────────────────
const CAT_PAGE = 25;
const COLD = ['OZEMPIC','TRULICITY','TOUJEO','LANTUS','NOVORAPID','TRESIBA','HUMALOG','ABASAGLAR','BAQSIMI','SHINGRIX','BEXSERO','REPEVAX','NIMENRIX','GARDASIL','PRIORIX','HEXYON','ROTARIX','VAXELIS','VAXNEUVANCE','PREVENAR','ENGERIX','HAVRIX','BOOSTRIX','TETRAVAC','PNEUMOVAX','BEYFORTUS','GRAZAX','ACARIZAX','MONOPROST','TIMOPTOL','GELTIM','CARTEOL LP','DIPROSTENE','UTROGESTAN','EYLEA','REPATHA','DESFERAL','FLUANXOL'];
const PC_COL = { pp: '#16a34a', mi: '#1e40af', ch: '#dc2626', nr: '#94a3b8' };

// ── TOP LISTE ───────────────────────────────────────────────────
// Top 30 références IP — partage l'ordre avec ip_app-8.html
const TOP_LISTE = [
  {cip:"3400935955838",name:"DOLIPRANE 1000MG CPR BT8",cat:"pp",ppht:1.06,net:0.88,remPct:16.98,remEur:0.18,offreIP:0.78,rot:30},
  {cip:"3400933095253",name:"GAVISCON BUV SUSP SACH10ML 24",cat:"pp",ppht:3.6,net:3.42,remPct:5.0,remEur:0.18,offreIP:null,rot:30},
  {cip:"3400941533969",name:"DOLIPRANE 1000MG GELU BT8",cat:"pp",ppht:1.06,net:0.88,remPct:16.98,remEur:0.18,offreIP:0.78,rot:30},
  {cip:"3400949605538",name:"IZALGI 500MG/25MG GELU BT16",cat:"pp",ppht:1.43,net:1.25,remPct:12.59,remEur:0.18,offreIP:null,rot:20},
  {cip:"3400930986080",name:"SPASFON CPR BT30",cat:"pp",ppht:1.93,net:1.75,remPct:9.33,remEur:0.18,offreIP:null,rot:20},
  {cip:"3400922385624",name:"HELICIDINE 10% S/S SIR FP250ML",cat:"pp",ppht:2.52,net:2.34,remPct:7.14,remEur:0.18,offreIP:null,rot:20},
  {cip:"3400935294227",name:"DOLIPRANE 1000MG CPR EFFV TB8",cat:"pp",ppht:1.06,net:0.88,remPct:16.98,remEur:0.18,offreIP:0.78,rot:20},
  {cip:"3400934744198",name:"KARDEGIC 75MG PDR SACH 30",cat:"pp",ppht:1.47,net:1.29,remPct:12.24,remEur:0.18,offreIP:1.19,rot:20},
  {cip:"3400934438738",name:"VENTOLINE 100MCG INH FL200DOS 1",cat:"pp",ppht:3.24,net:3.06,remPct:5.56,remEur:0.18,offreIP:null,rot:12},
  {cip:"3400935154958",name:"LAMALINE GELU BT16",cat:"pp",ppht:1.28,net:1.1,remPct:14.06,remEur:0.18,offreIP:null,rot:12},
  {cip:"3400934615467",name:"DOLIPRANE 2,4% BUV FV100ML 1",cat:"pp",ppht:1.26,net:1.08,remPct:14.29,remEur:0.18,offreIP:0.98,rot:12},
  {cip:"3400933254063",name:"METEOSPASMYL CAPS BT20",cat:"pp",ppht:2.36,net:2.18,remPct:7.63,remEur:0.18,offreIP:null,rot:12},
  {cip:"3400932905997",name:"DIFFU-K 600MG GELU BT40",cat:"pp",ppht:1.79,net:1.61,remPct:10.06,remEur:0.18,offreIP:null,rot:12},
  {cip:"3400937784214",name:"FLECTOR 1% GEL FL100G",cat:"pp",ppht:2.42,net:2.24,remPct:7.44,remEur:0.18,offreIP:null,rot:12},
  {cip:"3400934796708",name:"DACUDOSES OPHT UNIDOS10ML 24",cat:"pp",ppht:2.28,net:2.1,remPct:7.89,remEur:0.18,offreIP:null,rot:8},
  {cip:"3400932320189",name:"DOLIPRANE 500MG CPR BT16",cat:"pp",ppht:1.06,net:0.88,remPct:16.98,remEur:0.18,offreIP:0.78,rot:8},
  {cip:"3400927400209",name:"TANGANIL 500MG CPR BT30",cat:"pp",ppht:2.65,net:2.47,remPct:6.79,remEur:0.18,offreIP:null,rot:8},
  {cip:"3400931927501",name:"STAGID 700MG CPR BT30",cat:"pp",ppht:1.94,net:1.76,remPct:9.28,remEur:0.18,offreIP:null,rot:8},
  {cip:"3400930234983",name:"UVEDOSE 50000UI CAPS MOL BT4",cat:"pp",ppht:3.62,net:3.44,remPct:4.97,remEur:0.18,offreIP:null,rot:8},
  {cip:"3400930065891",name:"LEVOTHYROX 100MCG CPR BT30 EXC",cat:"pp",ppht:1.77,net:1.59,remPct:10.17,remEur:0.18,offreIP:null,rot:8},
  {cip:"3400936158832",name:"DAFALGAN 1000MG CPR BT8",cat:"pp",ppht:1.06,net:0.88,remPct:16.98,remEur:0.18,offreIP:0.78,rot:8},
  {cip:"3400933247379",name:"KARDEGIC 160MG PDR SACH 30",cat:"pp",ppht:1.47,net:1.29,remPct:12.24,remEur:0.18,offreIP:1.19,rot:8},
  {cip:"3400935291783",name:"EFFERALGANMED 1000MG C.EFFV T8",cat:"pp",ppht:1.06,net:0.88,remPct:16.98,remEur:0.18,offreIP:0.78,rot:8},
  {cip:"3400935887559",name:"SERESTA 10MG CPR BT30",cat:"pp",ppht:1.14,net:0.96,remPct:15.79,remEur:0.18,offreIP:null,rot:8},
  {cip:"3400936246980",name:"DOLIPRANE 1000MG BUV SACH 8",cat:"pp",ppht:1.06,net:0.88,remPct:16.98,remEur:0.18,offreIP:0.78,rot:8},
  {cip:"3400933313586",name:"AMLOR 5MG GELU BT30",cat:"pp",ppht:2.72,net:2.54,remPct:6.62,remEur:0.18,offreIP:null,rot:8},
  {cip:"3400932192946",name:"DUPHASTON 10MG CPR BT10",cat:"pp",ppht:2.49,net:2.31,remPct:7.23,remEur:0.18,offreIP:null,rot:8},
  {cip:"3400934507786",name:"DOLIPRANE 500MG GELU BT16",cat:"pp",ppht:1.06,net:0.88,remPct:16.98,remEur:0.18,offreIP:0.78,rot:8},
  {cip:"3400935528988",name:"IBUFETUM 5% GEL TB60G",cat:"pp",ppht:1.79,net:1.61,remPct:10.06,remEur:0.18,offreIP:null,rot:8},
  {cip:"3400932331536",name:"DOLIPRANE 500MG PDR SACH 12",cat:"pp",ppht:1.06,net:0.88,remPct:16.98,remEur:0.18,offreIP:0.78,rot:8},
];

// ── STATE ───────────────────────────────────────────────────────
// Même clés localStorage que ip_app-8 → les données sont partagées
let GA = [], GF = [], GP = 1;
let FAVS = JSON.parse(localStorage.getItem('ip_favs') || '[]');
let CART = JSON.parse(localStorage.getItem('ip_cart') || '{}');
let CMP  = JSON.parse(localStorage.getItem('ip_cmp')  || '[]');
let gFavOnly = false, gColdOnly = false;

const saveFavs = () => localStorage.setItem('ip_favs', JSON.stringify(FAVS));
const saveCart = () => localStorage.setItem('ip_cart', JSON.stringify(CART));
const saveCmp  = () => localStorage.setItem('ip_cmp',  JSON.stringify(CMP));

// ── FORMAT PRIX (2 décimales, différent du fmt CRM) ─────────────
const catFmt = v => v > 0 ? v.toLocaleString('fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '—';

// ── HELPERS ─────────────────────────────────────────────────────
function pcatR(r) {
  const p = r[3], h = r[5] > 0;
  if (!h) return 'nr';
  if (p <= 4.33) return 'pp';
  if (p <= 468) return 'mi';
  return 'ch';
}

function scoreBadge(sc) {
  if (sc >= 70) return `<span class="cat-score sc-hot">⚡ ${sc}</span>`;
  if (sc >= 40) return `<span class="cat-score sc-good"> ${sc}</span>`;
  if (sc >= 20) return `<span class="cat-score sc-med">${sc}</span>`;
  return '';
}

function catMkPag(n, cur, elId) {
  const tot = Math.ceil(n / CAT_PAGE), e = document.getElementById(elId);
  if (!e) return;
  if (tot <= 1) { e.innerHTML = ''; return; }
  let h = '', s = Math.max(1, cur - 3), end = Math.min(tot, s + 6);
  if (end - s < 6) s = Math.max(1, end - 6);
  if (s > 1) h += `<button onclick="gGoP(1)">«</button><button onclick="gGoP(${cur - 1})">‹</button>`;
  for (let i = s; i <= end; i++) h += `<button class="${i === cur ? 'cat-pag-on' : ''}" onclick="gGoP(${i})">${i}</button>`;
  if (end < tot) h += `<button onclick="gGoP(${cur + 1})">›</button><button onclick="gGoP(${tot})">»</button>`;
  h += `<span class="cat-pag-inf">${n.toLocaleString('fr')} produits</span>`;
  e.innerHTML = h;
}

// ── FAB & SHEETS ────────────────────────────────────────────────
function updateFab() {
  const n = Object.values(CART).reduce((a, v) => a + v.qty, 0);
  const fab   = document.getElementById('cat-cart-fab');
  const badge = document.getElementById('cat-cart-badge');
  if (fab)   fab.style.display  = n > 0 ? 'flex' : 'none';
  if (badge) badge.textContent  = n;
}

function openSheet(id) {
  if (id === 'panier') renderPanier();
  if (id === 'cmp')    renderCmp();
  const el = document.getElementById('cat-sh-' + id);
  if (el) el.classList.add('open');
}
function closeSheet(id) {
  const el = document.getElementById('cat-sh-' + id);
  if (el) el.classList.remove('open');
}

// ── FAVORIS ─────────────────────────────────────────────────────
function toggleFav(cip) {
  FAVS.includes(cip) ? FAVS = FAVS.filter(f => f !== cip) : FAVS.push(cip);
  saveFavs();
  gRen();
}

// ── PANIER ──────────────────────────────────────────────────────
function addToCart(cip, name, lab, ppht, net) {
  CART[cip] ? CART[cip].qty++ : CART[cip] = { qty: 1, name, lab, ppht, net };
  saveCart(); updateFab();
  const b = document.getElementById('cb-' + cip);
  if (b) { b.classList.add('cat-act-on'); setTimeout(() => b.classList.remove('cat-act-on'), 500); }
  const pb = document.getElementById('cat-pres-cart-btn');
  if (pb) { pb.textContent = '✅ Ajouté !'; setTimeout(() => { pb.textContent = '🛒 Ajouter au panier'; }, 1200); }
}
function rmFromCart(cip) { delete CART[cip]; saveCart(); updateFab(); renderPanier(); }
function changeQty(cip, d) {
  if (!CART[cip]) return;
  CART[cip].qty = Math.max(1, CART[cip].qty + d);
  saveCart(); renderPanier();
}
function clearCart() { CART = {}; saveCart(); updateFab(); renderPanier(); }
function shareCart() {
  const items = Object.values(CART); if (!items.length) return;
  const total = items.reduce((a, v) => a + (v.net || v.ppht) * v.qty, 0);
  const txt = '🛒 Commande Intégral Pharma\n\n'
    + items.map(v => `• ${v.name}\n  Qté: ${v.qty} × ${catFmt(v.net || v.ppht)} = ${catFmt((v.net || v.ppht) * v.qty)}`).join('\n')
    + `\n\n💶 TOTAL NET HT : ${catFmt(total)}`;
  navigator.share
    ? navigator.share({ text: txt })
    : navigator.clipboard.writeText(txt).then(() => showToast('Copié ✓', 'success'));
}

// ── COMPARATEUR ─────────────────────────────────────────────────
function toggleCmp(cip, name, lab, ppht, net, rPct, rVal, ip, sdispo) {
  if (CMP.includes(cip)) CMP = CMP.filter(c => c !== cip);
  else if (CMP.length < 3) CMP.push(cip);
  else { CMP.shift(); CMP.push(cip); }
  saveCmp(); gRen();
  if (CMP.length >= 2) openSheet('cmp');
}
function removeCmp(cip) { CMP = CMP.filter(c => c !== cip); saveCmp(); renderCmp(); gRen(); }

// ── MODE PRÉSENTATION ───────────────────────────────────────────
function openPres(cip) {
  const r = GA.find(d => d[0] === cip); if (!r) return;
  const [, name, lab, ppht, net, rPct, rVal, ip, tpl, sdispo, , , sc] = r;
  let body = '';
  body += `<div style="display:flex;justify-content:center;margin-bottom:16px">
    <div class="pres-score">Score potentiel <span class="pres-score-val">${sc}/100</span></div>
  </div>`;
  body += `<div class="pres-name">${name}</div>
    <div class="pres-lab">${lab}</div>
    <div class="pres-mol">${rPct > 0 ? 'REMBOURSÉ' : 'Non remboursé'}</div>`;
  body += `<div class="pres-price-block">
    <div class="pres-price-label">Prix HT public</div>
    <div class="pres-price-ht">${ppht.toFixed(2)} €</div>
    <div class="pres-price-unit">par unité</div>
  </div>`;
  if (rPct > 0) {
    body += `<div class="pres-remise">
      <div class="pres-rem-left">
        <div class="pres-rem-label">Remise Intégral Pharma</div>
        <div class="pres-rem-pct">−${rPct.toFixed(1)}%</div>
        <div class="pres-rem-eur">soit −${rVal.toFixed(2)} € / unité</div>
      </div>
      <div class="pres-rem-right">
        <div class="pres-rem-netlabel">Votre prix net HT</div>
        <div class="pres-rem-net">${net.toFixed(2)} €</div>
      </div>
    </div>`;
  }
  if (ip) {
    const diff = (ppht - ip).toFixed(2), pct = ((ppht - ip) / ppht * 100).toFixed(1);
    body += `<div class="pres-ip">
      <div>
        <div class="pres-ip-label">🟣 Offre IP Privilège</div>
        <div class="pres-ip-val">${ip.toFixed(2)} €</div>
        <div class="pres-ip-diff">−${pct}% vs prix public</div>
      </div>
      <div class="pres-ip-econ">
        <div class="pres-ip-econ-label">Économie / unité</div>
        <div class="pres-ip-econ-val">−${diff} €</div>
      </div>
    </div>`;
  }
  if (tpl) {
    const diff = (ppht - tpl).toFixed(2), pct = ((ppht - tpl) / ppht * 100).toFixed(1);
    body += `<div class="pres-tpl">
      <div>
        <div class="pres-tpl-label">🔴 Top Prix Libre</div>
        <div class="pres-tpl-val">${tpl.toFixed(2)} €</div>
        <div class="pres-tpl-diff">−${pct}% · économie −${diff} €</div>
      </div>
    </div>`;
  }
  const scStock = sdispo > 100 ? 'stock-ok' : sdispo > 0 ? 'stock-low' : 'stock-zero';
  body += `<div class="pres-infos">
    <div class="pres-info-block"><div class="pres-info-label">Stock dispo</div><div class="pres-info-val ${scStock}">${sdispo > 0 ? sdispo.toLocaleString('fr') : 'Rupture'}</div></div>
    <div class="pres-info-block"><div class="pres-info-label">CIP13</div><div class="pres-info-val" style="font-size:11px;font-family:monospace">${cip}</div></div>
    <div class="pres-info-block"><div class="pres-info-label">Score</div><div class="pres-info-val" style="color:#fbbf24">${sc}/100</div></div>
  </div>`;
  body += `<button class="pres-add-cart" id="cat-pres-cart-btn" onclick="event.stopPropagation();addToCart('${cip}','${name.replace(/'/g, "\\'")}','${lab}',${ppht},${net})">🛒 Ajouter au panier</button>`;
  document.getElementById('cat-pres-body').innerHTML = body;
  document.getElementById('cat-pres-overlay').classList.add('open');
}
function closePres() {
  document.getElementById('cat-pres-overlay').classList.remove('open');
}

// ── RENDER PANIER ───────────────────────────────────────────────
function renderPanier() {
  const items = Object.entries(CART);
  const el = document.getElementById('cat-panier-body');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="empty" style="padding:40px 0"><div class="empty-icon">🛒</div><div class="empty-title">Sélection vide</div><div class="empty-sub">Ajoutez des produits depuis le catalogue</div></div>';
    return;
  }
  const total = items.reduce((a, [, v]) => a + (v.net || v.ppht) * v.qty, 0);
  const econ  = items.reduce((a, [, v]) => a + (v.ppht - (v.net || v.ppht)) * v.qty, 0);
  let h = items.map(([cip, v]) => `
    <div class="cat-cart-item">
      <div class="cat-ci-info">
        <div class="cat-ci-name">${v.name}</div>
        <div class="cat-ci-lab">${v.lab} · ${catFmt(v.net || v.ppht)} / u.</div>
      </div>
      <div class="cat-qty">
        <button class="cat-qty-btn" onclick="changeQty('${cip}',-1)">−</button>
        <div class="cat-qty-num">${v.qty}</div>
        <button class="cat-qty-btn" onclick="changeQty('${cip}',1)">+</button>
      </div>
      <div class="cat-ci-price">${catFmt((v.net || v.ppht) * v.qty)}</div>
      <button class="cat-qty-btn" style="color:var(--rose);margin-left:4px" onclick="rmFromCart('${cip}')">✕</button>
    </div>`).join('');
  h += `<div class="cat-cart-total">
    <div>
      <div class="cat-ct-l">Total net HT</div>
      ${econ > 0.01 ? `<div style="font-size:11px;color:var(--mint);margin-top:3px">Économie ${catFmt(econ)}</div>` : ''}
    </div>
    <div class="cat-ct-v">${catFmt(total)}</div>
  </div>`;
  h += `<div class="cat-cart-btns">
    <button class="btn btn-ghost" onclick="shareCart()">📤 Partager</button>
    <button class="btn btn-ghost" style="color:var(--rose)" onclick="clearCart()">Vider</button>
  </div>`;
  el.innerHTML = h;
}

// ── RENDER COMPARATEUR ──────────────────────────────────────────
function renderCmp() {
  const el = document.getElementById('cat-cmp-body'); if (!el) return;
  if (!CMP.length) {
    el.innerHTML = '<div class="empty" style="padding:40px 0"><div class="empty-icon">⚖️</div><div class="empty-title">Aucun produit</div><div class="empty-sub">Appuyez ⚖️ sur une fiche produit</div></div>';
    return;
  }
  const items   = CMP.map(cip => GA.find(r => r[0] === cip)).filter(Boolean);
  const bestNet = Math.min(...items.map(r => r[4] || r[3]));
  const bestSc  = Math.max(...items.map(r => r[12]));
  const bestRem = Math.max(...items.map(r => r[5]));
  let h = '<div class="cat-cmp-grid">';
  items.forEach(r => {
    const [cip, name, lab, ppht, net, rPct, rVal, ip, tpl, sdispo, , , sc] = r;
    const best = (net || ppht) === bestNet;
    h += `<div class="cat-cmp-wrap">
      <div class="cat-cmp-col${best ? ' cat-cmp-best' : ''}">
        ${best ? '<div class="cat-cmp-best-lbl">✓ Meilleur prix</div>' : ''}
        <div class="cat-cmp-name">${name}</div>
        <div class="cat-cmp-row"><span class="cat-cmp-k">Labo</span><span class="cat-cmp-v">${lab.slice(0, 16)}</span></div>
        <div class="cat-cmp-row"><span class="cat-cmp-k">Prix HT</span><span class="cat-cmp-v">${catFmt(ppht)}</span></div>
        <div class="cat-cmp-row"><span class="cat-cmp-k">Net</span><span class="cat-cmp-v${best ? ' cat-cmp-v-best' : ''}">${catFmt(net || ppht)}</span></div>
        <div class="cat-cmp-row"><span class="cat-cmp-k">Remise</span><span class="cat-cmp-v${rPct === bestRem && rPct > 0 ? ' cat-cmp-v-best' : ''}">${rPct > 0 ? '−' + rPct.toFixed(1) + '%' : '—'}</span></div>
        ${ip ? `<div class="cat-cmp-row"><span class="cat-cmp-k">IP</span><span class="cat-cmp-v" style="color:#a78bfa">${catFmt(ip)}</span></div>` : ''}
        <div class="cat-cmp-row"><span class="cat-cmp-k">Stock</span><span class="cat-cmp-v">${sdispo > 0 ? sdispo.toLocaleString('fr') : '⚠ 0'}</span></div>
        <div class="cat-cmp-row"><span class="cat-cmp-k">Score</span><span class="cat-cmp-v${sc === bestSc ? ' cat-cmp-v-best' : ''}">${sc}/100</span></div>
      </div>
      <button class="cat-cmp-del" onclick="removeCmp('${cip}')">✕</button>
    </div>`;
  });
  if (CMP.length < 3) h += '<div class="cat-cmp-add"><span>+</span><span>Ajouter</span></div>';
  h += '</div><p style="font-size:11px;color:var(--text3);text-align:center;padding:6px 0">Appuyez ⚖️ sur une fiche pour comparer</p>';
  el.innerHTML = h;
}

// ── FILTER / SORT / RENDER LISTE ────────────────────────────────
function gFilt() {
  const q  = document.getElementById('g-q');   if (!q) return;
  const pc = document.getElementById('g-pc');
  const qv = q.value.toLowerCase().trim();
  const pcv = pc ? pc.value : '';
  const clr = document.getElementById('g-clr');
  if (clr) clr.style.display = qv ? 'block' : 'none';
  GF = GA.filter(r => {
    const mq = !qv || (r[1] && r[1].toLowerCase().includes(qv)) || (r[0] && r[0].includes(qv)) || (r[2] && r[2].toLowerCase().includes(qv));
    const mc = !gColdOnly || COLD.some(k => (r[1] || '').toUpperCase().includes(k));
    return mq && (!pcv || pcatR(r) === pcv) && (!gFavOnly || FAVS.includes(r[0])) && mc;
  });
  GP = 1; gSrt();
}

function gClr() { const q = document.getElementById('g-q'); if (q) q.value = ''; gFilt(); }

function gToggleFav() {
  gFavOnly = !gFavOnly;
  document.getElementById('fc-fav').classList.toggle('cat-fc-on', gFavOnly);
  gFilt();
}

function gToggleCold() {
  gColdOnly = !gColdOnly;
  document.getElementById('fc-cold').classList.toggle('cat-fc-on', gColdOnly);
  gFilt();
}

function gSrt() {
  const sr = document.getElementById('g-sr'); if (!sr) return;
  const [k, d] = sr.value.split('-'), m = d === 'd' ? -1 : 1;
  GF.sort((a, b) =>
    k === 'desi' ? m * (a[1] || '').localeCompare(b[1] || '', 'fr') :
    k === 'ht'   ? m * (a[3] - b[3]) :
    k === 'sc'   ? m * (a[12] - b[12]) :
    k === 'ca'   ? m * ((a[11] || 0) - (b[11] || 0)) : 0);
  const n   = GF.length;
  const ip  = GF.filter(r => r[7]).length;
  const tpl = GF.filter(r => r[8]).length;
  const hot = GF.filter(r => r[12] >= 70).length;
  const st  = document.getElementById('g-st');
  if (st) st.textContent = n.toLocaleString('fr') + ' produit' + (n > 1 ? 's' : '');
  const pl = document.getElementById('g-pl');
  if (pl) pl.innerHTML = (hot ? `<span class="cat-spill sp-hot">⚡${hot}</span>` : '')
    + (ip  ? `<span class="cat-spill sp-ip">🟣${ip}</span>`  : '')
    + (tpl ? `<span class="cat-spill sp-tpl">🔴${tpl}</span>` : '');
  gRen();
}

function gRen() {
  const el = document.getElementById('g-lst'); if (!el) return;
  const sl = GF.slice((GP - 1) * CAT_PAGE, GP * CAT_PAGE);
  if (!sl.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">💊</div><div class="empty-title">Aucun résultat</div><div class="empty-sub">Modifiez votre recherche ou les filtres</div></div>';
    document.getElementById('g-pg').innerHTML = '';
    return;
  }
  el.innerHTML = sl.map((r, i) => {
    const [cip, name, lab, ppht, net, rPct, rVal, ip, tpl, sdispo, , , sc] = r;
    const pc      = pcatR(r);
    const cold    = COLD.some(k => name.toUpperCase().includes(k));
    const isFav   = FAVS.includes(cip);
    const inCart  = !!CART[cip];
    const inCmp   = CMP.includes(cip);
    let tags = `<span class="cat-tag ${rPct > 0 ? 'tag-r' : 'tag-nr'}">${rPct > 0 ? 'Remboursé' : 'NR'}</span>`;
    if (cold) tags += `<span class="cat-tag tag-cold">❄ Froid</span>`;
    if (ip)   tags += `<span class="cat-tag tag-ip">IP</span>`;
    if (tpl)  tags += `<span class="cat-tag tag-tpl">TPL</span>`;
    let strips = '';
    if (rPct > 0) strips += `<div class="cat-strip cat-strip-rem">Remise ${rPct.toFixed(1)}% → <strong>${catFmt(net)}</strong></div>`;
    if (ip) {
      const diff = (ppht - ip).toFixed(2), pct = ((ppht - ip) / ppht * 100).toFixed(1);
      strips += `<div class="cat-strip cat-strip-ip">🟣 IP Privilège : <strong>${catFmt(ip)}</strong> <span>−${pct}% · −${diff} €/u.</span></div>`;
    }
    if (tpl) {
      const diff = (ppht - tpl).toFixed(2), pct = ((ppht - tpl) / ppht * 100).toFixed(1);
      strips += `<div class="cat-strip cat-strip-tpl">🔴 Prix libre : <strong>${catFmt(tpl)}</strong> <span>−${pct}%</span></div>`;
    }
    return `<div class="gcard" style="animation-delay:${i * .015}s" onclick="openPres('${cip}')">
      <div class="gcard-accent" style="background:${PC_COL[pc]}"></div>
      <div class="gcard-body">
        <div class="gcard-top">
          <div class="gcard-name">${name}</div>
          <div class="gcard-ht">${catFmt(ppht)}</div>
        </div>
        <div class="gcard-meta">
          <span class="gcard-lab">${lab}</span>
          ${tags}${scoreBadge(sc)}
        </div>
        <div class="gcard-actions">
          <button class="cat-act ${isFav ? 'cat-act-on' : ''}" onclick="event.stopPropagation();toggleFav('${cip}')" title="Favori">⭐</button>
          <button class="cat-act ${inCart ? 'cat-act-on' : ''}" id="cb-${cip}" onclick="event.stopPropagation();addToCart('${cip}','${name.replace(/'/g, "\\'")}','${lab}',${ppht},${net})" title="Panier">🛒</button>
          <button class="cat-act ${inCmp ? 'cat-act-on' : ''}" onclick="event.stopPropagation();toggleCmp('${cip}','${name.replace(/'/g, "\\'")}','${lab}',${ppht},${net},${rPct},${rVal},${ip || 0},${sdispo})" title="Comparer">⚖️</button>
        </div>
      </div>
      ${strips ? `<div class="gcard-strips">${strips}</div>` : ''}
    </div>`;
  }).join('');
  catMkPag(GF.length, GP, 'g-pg');
}

function gGoP(p) {
  GP = p; gRen();
  const scroll = document.getElementById('g-scroll');
  if (scroll) scroll.scrollTo(0, 0);
}

// ── TOP LISTE WIDGET ────────────────────────────────────────────
function catRenderTopListe(container) {
  if (!container || !GA.length) return;
  const pp = TOP_LISTE.filter(p => p.cat === 'pp').slice(0, 10);
  if (!pp.length) { container.innerHTML = ''; return; }
  let h = `<div class="card fade-up" style="margin-bottom:20px">
    <div class="card-header">
      <div><div class="card-title">⚡ Top Ventes · Petit Prix</div><div class="card-subtitle">${pp.length} références IP recommandées</div></div>
      <button class="btn btn-primary btn-sm" onclick="catLoadTopToCart()">🛒 Tout charger</button>
    </div>
    <div class="card-body" style="padding:0">`;
  pp.forEach((p, i) => {
    const net    = p.offreIP || p.net;
    const gainU  = p.ppht > net ? (p.ppht - net).toFixed(2) : null;
    const gainAn = gainU ? (gainU * p.rot * 12).toFixed(0) : null;
    h += `<div class="stat-row" style="padding:10px 18px;cursor:pointer" onclick="openPres('${p.cip}')">
      <div class="stat-row-rank">${i < 3 ? ['🥇','🥈','🥉'][i] : `<div class="rank rank-n">${i + 1}</div>`}</div>
      <div class="stat-row-info">
        <div class="stat-row-name">${p.name}</div>
        <div class="stat-row-sub">${catFmt(net)} net · ${p.rot} u./mois${gainAn ? ` · +${parseInt(gainAn).toLocaleString('fr')} €/an` : ''}</div>
      </div>
      <div class="stat-row-val">${catFmt(p.ppht)}</div>
    </div>`;
  });
  h += '</div></div>';
  container.innerHTML = h;
}

function catLoadTopToCart() {
  if (!confirm(`Charger ${TOP_LISTE.length} références dans le panier ?`)) return;
  TOP_LISTE.forEach(p => {
    const r   = GA.find(d => d[0] === p.cip);
    const lab = r ? r[2] : '';
    const net = p.offreIP || p.net;
    CART[p.cip] = { qty: p.rot, name: p.name, lab, ppht: p.ppht, net };
  });
  saveCart(); updateFab();
  openSheet('panier');
}

// ── MAIN PAGE RENDER ────────────────────────────────────────────
let catInit = false;

function renderCatalogue() {
  const el = document.getElementById('cat-content');
  if (!el) return;
  if (catInit) {
    if (GA.length) {
      catRenderTopListe(document.getElementById('cat-top-liste'));
      gFilt();
    }
    return;
  }
  el.innerHTML = `
    <div class="cat-head">
      <div class="search-wrap" style="margin-bottom:10px">
        <span class="search-icon">🔍</span>
        <input id="g-q" type="text" placeholder="Nom, CIP13, laboratoire…"
          oninput="gFilt()" autocomplete="off" autocorrect="off" autocapitalize="off"
          ${GA.length ? '' : 'disabled'}>
        <button id="g-clr" style="display:none;background:none;border:none;color:var(--text3);cursor:pointer;font-size:18px;padding:0 8px;line-height:1" onclick="gClr()">✕</button>
      </div>
      <div class="cat-filter-row">
        <button class="cat-fchip" id="fc-fav" onclick="gToggleFav()">⭐ Favoris</button>
        <button class="cat-fchip" id="fc-cold" onclick="gToggleCold()">❄️ Froid</button>
        <select class="cat-fsel" id="g-pc" onchange="gFilt()" ${GA.length ? '' : 'disabled'}>
          <option value="">Toutes catégories</option>
          <option value="pp">🟢 Petit prix</option>
          <option value="mi">🔵 Intermédiaire</option>
          <option value="ch">🔴 Cher</option>
          <option value="nr">⚪ NR</option>
        </select>
        <select class="cat-fsel" id="g-sr" onchange="gSrt()" ${GA.length ? '' : 'disabled'}>
          <option value="sc-d">⚡ Score</option>
          <option value="ca-d">📈 CA ↓</option>
          <option value="ht-a">Prix ↑</option>
          <option value="ht-d">Prix ↓</option>
          <option value="desi-a">A → Z</option>
        </select>
      </div>
      <div class="cat-status-row">
        <span id="g-st">${GA.length ? GA.length.toLocaleString('fr') + ' produits' : 'Chargement du catalogue…'}</span>
        <div id="g-pl"></div>
      </div>
    </div>
    <div class="cat-body" id="g-scroll">
      <div id="cat-top-liste"></div>
      <div id="g-lst"></div>
      <div id="g-pg" class="cat-pag"></div>
    </div>
  `;
  catInit = true;
  if (GA.length) {
    catRenderTopListe(document.getElementById('cat-top-liste'));
    gSrt();
  }
}

// ── LOAD DATA ───────────────────────────────────────────────────
catLd(window.CAT_DATA_BLOB).then(d => {
  GA = d; GF = [...d];
  updateFab();
  const q = document.getElementById('g-q'); if (q) q.disabled = false;
  ['g-pc', 'g-sr'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; });
  const st = document.getElementById('g-st'); if (st) st.textContent = d.length.toLocaleString('fr') + ' produits';
  catRenderTopListe(document.getElementById('cat-top-liste') || document.createElement('div'));
  gSrt();
}).catch(e => {
  console.error('Catalogue data load failed:', e);
});
