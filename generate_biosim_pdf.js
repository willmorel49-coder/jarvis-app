#!/usr/bin/env node
// ============================================================================
// Poster « Biosimilaires substituables en officine » (façon fiche Teva, brandé
// Intégral) — TOUTES les présentations avec PPHT + net IP (PPHT − abandon).
// 2 versions : interne (net IP + confidentiel) / pharmacien (PPHT + abandon %).
// Sortie HTML → PDF via Chrome --print-to-pdf.
// ============================================================================
const fs = require("fs"), path = require("path");
const ROOT = __dirname;
const { meta, molecules } = require(path.join(ROOT, "biosimilaires-export.json"));

const NAVY = "#0F2A47", ORANGE = "#E8722B", GREEN = "#127A45";
const eur = (n) => n == null ? "—" : (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €";
const pct = (n) => n == null ? "" : "−" + String(n).replace(".", ",") + " %";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function molCard(m, interne) {
  const chips = m.biosimilaires.map((b) =>
    '<span class="chip' + (b.partenaire ? ' part' : '') + '">' + (b.partenaire ? '★ ' : '') + esc(b.nom) + '</span>').join("");

  const rows = (m.presentations || []).map((p) => {
    const priceCells = interne
      ? '<td class="num">' + eur(p.ppht) + '</td><td class="num net">' + eur(p.net) + '</td><td class="num ab">' + pct(p.abandon) + '</td>'
      : '<td class="num">' + eur(p.ppht) + '</td><td class="num ab">' + pct(p.abandon) + '</td>';
    return '<tr><td class="form">' + esc(p.form) + '</td>' + priceCells + '</tr>';
  }).join("");

  const thPrice = interne
    ? '<th class="num">PPHT</th><th class="num">Net IP</th><th class="num">Abandon</th>'
    : '<th class="num">PPHT</th><th class="num">Abandon de marge</th>';

  const nForms = (m.presentations || []).length;
  return '<div class="card">'
    + '<div class="chead">'
    + '<div class="cleft"><span class="dci">' + esc(m.dci) + '</span> <span class="atc">' + esc(m.atc) + '</span>'
    + '<span class="aire">' + esc(m.aire) + '</span></div>'
    + '<div class="cright">Réf. <b>' + esc(m.reference) + '</b> · ' + esc(m.reference_labo)
    + ' &nbsp;·&nbsp; ' + nForms + ' présentation' + (nForms > 1 ? 's' : '') + '</div>'
    + '</div>'
    + '<div class="chips">' + chips + '</div>'
    + (rows ? '<table class="pres"><thead><tr><th>Présentation</th>' + thPrice + '</tr></thead><tbody>' + rows + '</tbody></table>'
            : '<div class="np">Présentations et prix non disponibles dans nos données.</div>')
    + '</div>';
}

function buildHtml(mode) {
  const interne = mode === "interne";
  const subs = molecules.filter((m) => m.substituable);
  const cards = subs.map((m) => molCard(m, interne)).join("");
  const partList = (meta.partenaires_ip || []).join(", ");
  const confid = interne ? '<div class="confid">CONFIDENTIEL · USAGE INTERNE — NE PAS REMETTRE AU PHARMACIEN</div>' : '';
  const legend = interne
    ? 'PPHT = tarif grossiste HT · Net IP = votre prix après abandon de marge Intégral · Abandon = remise consentie.'
    : 'PPHT = tarif grossiste HT · Abandon de marge Intégral appliqué. Prix net sur demande à votre commercial.';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
  @page { size: A4 portrait; margin: 11mm 9mm; }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { margin:0; font-family:-apple-system,"Segoe UI",Roboto,"DM Sans",Arial,sans-serif; color:${NAVY}; font-size:10px; }
  .head { background:${NAVY}; color:#fff; border-radius:11px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; }
  .brand { font-size:19px; font-weight:800; } .brand .o { color:${ORANGE}; }
  .htitle { text-align:right; } .htitle .t { font-size:15px; font-weight:800; } .htitle .s { font-size:9px; opacity:.85; margin-top:2px; }
  .confid { margin-top:7px; background:#FDECDD; color:#B8551A; border:1px solid ${ORANGE}; border-radius:8px; padding:5px 12px; font-weight:800; font-size:9.5px; text-align:center; letter-spacing:.03em; }
  .card { border:1px solid #E6EAF0; border-radius:11px; margin-top:9px; padding:9px 12px; page-break-inside:avoid; }
  .chead { display:flex; align-items:baseline; justify-content:space-between; gap:10px; border-bottom:1.5px solid #EEF1F5; padding-bottom:5px; }
  .dci { font-size:14px; font-weight:800; } .atc { font-family:monospace; font-size:9px; color:#8894A6; margin-left:4px; }
  .aire { font-size:9px; color:#5A6b80; margin-left:8px; }
  .cright { font-size:9.5px; color:#737A8C; } .cright b { color:${NAVY}; }
  .chips { display:flex; flex-wrap:wrap; gap:4px; margin:7px 0 4px; }
  .chip { background:#EEF2F7; color:${NAVY}; border-radius:6px; padding:2px 7px; font-size:9px; font-weight:600; }
  .chip.part { background:#FDECDD; color:${ORANGE}; font-weight:800; }
  table.pres { width:100%; border-collapse:collapse; margin-top:3px; }
  table.pres th { text-align:left; font-size:8px; text-transform:uppercase; letter-spacing:.04em; color:#8894A6; font-weight:800; padding:3px 8px; border-bottom:1px solid #EEF1F5; }
  table.pres td { padding:3px 8px; border-bottom:1px solid #F4F6FA; }
  table.pres .form { font-weight:600; }
  table.pres .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  th.num { text-align:right; }
  .net { color:${GREEN}; font-weight:800; } .ab { color:${ORANGE}; font-weight:700; }
  .np { font-size:9px; color:#B4BECC; font-style:italic; padding:4px 0; }
  .foot { margin-top:11px; font-size:8px; color:#8894A6; line-height:1.6; border-top:1px solid #E6EAF0; padding-top:7px; }
  .foot b { color:#5A6b80; }
</style></head><body>
  <div class="head">
    <div class="brand">int<span class="o">é</span>gral <span style="font-weight:600;opacity:.9">Pharma</span></div>
    <div class="htitle"><div class="t">Biosimilaires substituables en officine</div>
      <div class="s">Toutes les présentations · substitution autorisée en ville (arrêté du 10 avril 2026)</div></div>
  </div>
  ${confid}
  ${cards}
  <div class="foot">
    <b>★ Partenaire Intégral</b> (${esc(partList)}) · ${esc(legend)}<br>
    Prix indicatifs de la présentation, susceptibles d'évolution réglementaire. Le PPHT est un tarif réglementé commun à tous les biosimilaires d'une même présentation.<br>
    Source : référentiel ANSM / Ameli / EMA × tarif &amp; ventes réseau Intégral · édité le ${esc(meta.genere_le)}.
  </div>
</body></html>`;
}

for (const mode of ["interne", "pharmacien"]) {
  fs.writeFileSync(path.join(ROOT, "biosim-poster-" + mode + ".html"), buildHtml(mode));
  console.log("✓ biosim-poster-" + mode + ".html");
}
