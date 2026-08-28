#!/usr/bin/env node
// ============================================================================
// Poster « Biosimilaires substituables en officine » (façon fiche Teva, brandé
// Intégral). 2 mises en page × 2 versions = 4 PDF :
//   synthese : 1 prix par molécule (compact)      detail : toutes les présentations
//   interne  : PPHT + net IP + abandon (confidentiel)   pharmacien : PPHT seul
// Net IP = PPHT − abandon de marge Intégral.
// 28/08/2026 : molécules ET marques en ordre alphabétique ; les biosimilaires
// des labos partenaires portent le LOGO du labo (Teva / Zentiva / EG Labo) à la
// place de l'étoile. Logos lus dans crm/v2/logos/ et incorporés en data-URI,
// pour que le HTML (et donc le PDF) se suffise à lui-même.
// Sortie HTML → PDF via Chrome --print-to-pdf.
// ============================================================================
const fs = require("fs"), path = require("path");
const ROOT = __dirname;
const { meta, molecules } = require(path.join(ROOT, "biosimilaires-export.json"));

const NAVY = "#0F2A47", ORANGE = "#E8722B", GREEN = "#127A45";
const eur = (n) => n == null ? "—" : (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €";
const pct = (n) => n == null ? "" : "−" + String(n).replace(".", ",") + " %";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const alpha = (a, b) => a.localeCompare(b, "fr", { sensitivity: "base" });

// ── Logos des partenaires (data-URI) ──
const LOGO_FILES = { "Teva": "teva.svg", "Zentiva": "zentiva.svg", "EG Labo": "eg-labo.png" };
const LOGOS = {};
for (const [nom, f] of Object.entries(LOGO_FILES)) {
  const p = path.join(ROOT, "crm", "v2", "logos", f);
  const mime = f.endsWith(".svg") ? "image/svg+xml" : "image/png";
  LOGOS[nom] = "data:" + mime + ";base64," + fs.readFileSync(p).toString("base64");
}
const logo = (nom, h) => LOGOS[nom]
  ? '<img class="lg" src="' + LOGOS[nom] + '" alt="' + esc(nom) + '" style="height:' + h + 'px">'
  : "";

const chips = (m) => m.biosimilaires.slice().sort((a, b) => alpha(a.nom, b.nom)).map((b) =>
  b.partenaire && b.partenaire_labo
    ? '<span class="chip part">' + logo(b.partenaire_labo, 11) + esc(b.nom) + '</span>'
    : '<span class="chip">' + esc(b.nom) + '</span>').join("");

// prix « groupe biosimilaire » partagé (PPHT réglementé) d'une molécule
function groupBioPrice(m) {
  const freq = {};
  m.biosimilaires.forEach((b) => {
    if (b.prix_ppht_std == null) return;
    const k = b.prix_ppht_std.toFixed(2);
    freq[k] = freq[k] || { ppht: b.prix_ppht_std, net: b.prix_ip_std, ab: b.abandon_std, n: 0 };
    freq[k].n++;
  });
  return Object.values(freq).sort((a, b) => b.n - a.n || b.ppht - a.ppht)[0] || null;
}

const substituables = molecules.filter((m) => m.substituable).sort((a, b) => alpha(a.dci, b.dci));

const HEAD = (subtitle, confid) => `
  <div class="head">
    <div class="brand">int<span class="o">é</span>gral <span style="font-weight:600;opacity:.9">Pharma</span></div>
    <div class="htitle"><div class="t">Biosimilaires substituables en officine</div>
      <div class="s">${subtitle} · substitution autorisée en ville (arrêté du 10 avril 2026)</div></div>
  </div>${confid}`;
const moisFactures = (meta.prix_factures && meta.prix_factures.mois || []).map((ym) => {
  const [y, mo] = ym.split("-");
  return ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][+mo - 1] + " " + y;
});
const FOOT = (interne) => `<div class="foot">
    <span class="lgs"><b>Partenaires Intégral</b> ${["Teva", "Zentiva", "EG Labo"].map((n) => logo(n, 10)).join("")}</span> · ${interne
      ? 'PPHT = tarif grossiste HT · Net IP = votre prix après abandon de marge Intégral.'
      : 'PPHT = tarif grossiste HT · abandon de marge Intégral appliqué. Prix net sur demande à votre commercial.'}<br>
    Le PPHT est un tarif réglementé commun à tous les biosimilaires d'une même présentation. Prix indicatifs${moisFactures.length ? ", constatés sur les factures Intégral de " + esc(moisFactures[0]) + " à " + esc(moisFactures[moisFactures.length - 1]) : ""}.<br>
    Source : référentiel ANSM / Ameli / EMA × tarif &amp; ventes réseau Intégral · édité le ${esc(meta.genere_le)}.
  </div>`;
const CONFID = '<div class="confid">CONFIDENTIEL · USAGE INTERNE — NE PAS REMETTRE AU PHARMACIEN</div>';

const CSS = `
  @page { size:A4 portrait; margin:9mm 9mm; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { margin:0; font-family:-apple-system,"Segoe UI",Roboto,"DM Sans",Arial,sans-serif; color:${NAVY}; font-size:10px; }
  .head { background:${NAVY}; color:#fff; border-radius:11px; padding:11px 18px; display:flex; align-items:center; justify-content:space-between; }
  .brand { font-size:19px; font-weight:800; } .brand .o { color:${ORANGE}; }
  .htitle { text-align:right; } .htitle .t { font-size:15px; font-weight:800; } .htitle .s { font-size:9px; opacity:.85; margin-top:2px; }
  .confid { margin-top:7px; background:#FDECDD; color:#B8551A; border:1px solid ${ORANGE}; border-radius:8px; padding:5px 12px; font-weight:800; font-size:9.5px; text-align:center; letter-spacing:.03em; }
  .net { color:${GREEN}; font-weight:800; } .ab { color:${ORANGE}; font-weight:700; }
  .chip { display:inline-flex; align-items:center; gap:5px; background:#EEF2F7; color:${NAVY}; border-radius:6px; padding:2px 7px; font-size:9px; font-weight:600; line-height:1.4; }
  .chip.part { background:#fff; border:1.2px solid ${ORANGE}; color:${NAVY}; font-weight:800; padding:1px 7px 1px 5px; }
  .chip .lg { display:block; width:auto; }
  .np { font-size:9px; color:#B4BECC; font-style:italic; }
  .foot { margin-top:8px; font-size:8px; color:#8894A6; line-height:1.5; border-top:1px solid #E6EAF0; padding-top:6px; }
  .foot b { color:#5A6b80; }
  .foot .lgs { display:inline-flex; align-items:center; gap:7px; vertical-align:middle; }
  .foot .lgs .lg { display:block; width:auto; }`;

// ── Mise en page SYNTHÈSE (1 prix / molécule) ──
function synthese(mode) {
  const interne = mode === "interne";
  const rows = substituables.map((m) => {
    const r = m.reference_enrich, gp = groupBioPrice(m);
    const refP = r.prix_ppht_std == null ? '<span class="np">n.c.</span>'
      : '<b>' + eur(r.prix_ppht_std) + '</b> <span class="u">PPHT</span>' + (interne && r.prix_ip_std != null ? '<br><span class="net">' + eur(r.prix_ip_std) + '</span> <span class="u">net IP</span>' : '');
    let bioP = '<span class="np">n.c.</span>';
    if (gp) bioP = interne
      ? '<b>' + eur(gp.ppht) + '</b> <span class="u">PPHT</span> · <span class="net">' + eur(gp.net) + '</span> <span class="u">net IP</span> <span class="ab">' + pct(gp.ab) + '</span>'
      // 24/08/2026 — le taux d'abandon ne s'imprime PLUS sur la version pharmacien.
      // Regle non negociable : on montre les conditions a l'ecran en rendez-vous,
      // jamais sur un document remis au pharmacien ni sur un support public. Or ce
      // PDF etait les deux a la fois -- il partait avec les commerciaux ET il etait
      // telechargeable depuis le depot public (11 taux imprimes, mesures le 24/08).
      // Le bas de page dit deja « prix net sur demande a votre commercial ».
      : '<b>' + eur(gp.ppht) + '</b> <span class="u">PPHT</span>';
    return '<tr><td class="sub"><div class="dci">' + esc(m.dci) + '</div><div class="atc">' + esc(m.atc) + '</div><div class="aire">' + esc(m.aire) + '</div></td>'
      + '<td class="ref"><div class="rn">' + esc(m.reference) + '</div><div class="rl">' + esc(m.reference_labo) + '</div><div class="rp">' + refP + '</div></td>'
      + '<td class="bio"><div class="bp">' + bioP + '</div><div class="cc">' + chips(m) + '</div></td></tr>';
  }).join("");
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${CSS}
  table { width:100%; border-collapse:separate; border-spacing:0 4px; margin-top:6px; }
  thead th { font-size:8.5px; text-transform:uppercase; letter-spacing:.05em; color:#8894A6; font-weight:800; text-align:left; padding:0 10px 1px; }
  td { background:#fff; border:1px solid #E6EAF0; vertical-align:top; padding:5px 10px; }
  td.sub { width:20%; border-right:0; border-radius:10px 0 0 10px; background:${NAVY}; color:#fff; }
  td.ref { width:28%; border-left:0; border-right:0; } td.bio { width:52%; border-left:0; border-radius:0 10px 10px 0; }
  .dci { font-size:12px; font-weight:800; } .atc { font-family:monospace; font-size:8px; opacity:.7; } .aire { font-size:8.5px; opacity:.9; margin-top:2px; }
  .rn { font-weight:800; font-size:11px; } .rl { font-size:8.5px; color:#737A8C; } .rp { margin-top:4px; line-height:1.5; }
  .u { font-size:7.5px; color:#8894A6; text-transform:uppercase; font-weight:700; }
  .bp { background:#F4F7FE; border-radius:7px; padding:4px 9px; margin-bottom:4px; line-height:1.45; }
  .cc { display:flex; flex-wrap:wrap; gap:4px; }
  tbody tr { page-break-inside:avoid; }
</style></head><body>${HEAD("Synthèse", interne ? CONFID : "")}
  <table><thead><tr><th>Substance active</th><th>Médicament de référence</th><th>Biosimilaires &amp; prix Intégral</th></tr></thead>
  <tbody>${rows}</tbody></table>${FOOT(interne)}</body></html>`;
}

// ── Mise en page DÉTAIL (toutes les présentations) ──
function detail(mode) {
  const interne = mode === "interne";
  const cards = substituables.map((m) => {
    // 24/08/2026 — colonne « Abandon de marge » retiree de la version pharmacien
    // (voir le commentaire dans synthese()). 98 taux etaient imprimes sur les
    // 3 pages du PDF public. La version interne, elle, garde tout.
    const th = interne ? '<th class="num">PPHT</th><th class="num">Net IP</th><th class="num">Abandon</th>' : '<th class="num">PPHT</th>';
    const rows = (m.presentations || []).map((p) => {
      const c = interne ? '<td class="num">' + eur(p.ppht) + '</td><td class="num net">' + eur(p.net) + '</td><td class="num ab">' + pct(p.abandon) + '</td>'
        : '<td class="num">' + eur(p.ppht) + '</td>';
      return '<tr><td class="form">' + esc(p.form) + '</td>' + c + '</tr>';
    }).join("");
    const n = (m.presentations || []).length;
    return '<div class="card"><div class="chead"><div><span class="dci">' + esc(m.dci) + '</span> <span class="atc">' + esc(m.atc) + '</span> <span class="aire">' + esc(m.aire) + '</span></div>'
      + '<div class="cright">Réf. <b>' + esc(m.reference) + '</b> · ' + esc(m.reference_labo) + ' · ' + n + ' présentation' + (n > 1 ? 's' : '') + '</div></div>'
      + '<div class="cc">' + chips(m) + '</div>'
      + (rows ? '<table class="pres"><thead><tr><th>Présentation</th>' + th + '</tr></thead><tbody>' + rows + '</tbody></table>' : '<div class="np">Prix non disponibles.</div>') + '</div>';
  }).join("");
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>${CSS}
  .card { border:1px solid #E6EAF0; border-radius:11px; margin-top:9px; padding:9px 12px; page-break-inside:avoid; }
  .chead { display:flex; align-items:baseline; justify-content:space-between; gap:10px; border-bottom:1.5px solid #EEF1F5; padding-bottom:5px; }
  .dci { font-size:13.5px; font-weight:800; } .atc { font-family:monospace; font-size:9px; color:#8894A6; } .aire { font-size:9px; color:#5A6b80; margin-left:6px; }
  .cright { font-size:9.5px; color:#737A8C; } .cright b { color:${NAVY}; }
  .cc { display:flex; flex-wrap:wrap; gap:4px; margin:6px 0 4px; }
  table.pres { width:100%; border-collapse:collapse; margin-top:3px; }
  table.pres th { text-align:left; font-size:8px; text-transform:uppercase; letter-spacing:.04em; color:#8894A6; font-weight:800; padding:3px 8px; border-bottom:1px solid #EEF1F5; }
  table.pres td { padding:3px 8px; border-bottom:1px solid #F4F6FA; } table.pres .form { font-weight:600; }
  .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; } th.num { text-align:right; }
</style></head><body>${HEAD("Toutes les présentations", interne ? CONFID : "")}${cards}${FOOT(interne)}</body></html>`;
}

const LAYOUTS = { synthese, detail };
for (const layout of ["synthese", "detail"]) {
  for (const mode of ["interne", "pharmacien"]) {
    const f = "biosim-poster-" + layout + "-" + mode + ".html";
    fs.writeFileSync(path.join(ROOT, f), LAYOUTS[layout](mode));
    console.log("✓ " + f);
  }
}
