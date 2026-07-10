#!/usr/bin/env node
// ============================================================================
// Génère les pages HTML du poster « Biosimilaires substituables en officine »
// (façon fiche Teva, brandé Intégral) en 2 versions :
//   - interne    : PPHT + net IP + % abandon + bandeau confidentiel
//   - pharmacien : PPHT + % abandon de marge Intégral (pas de net IP)
// Sortie : biosim-poster-interne.html / biosim-poster-pharmacien.html
// Le PDF est produit ensuite par Chrome --print-to-pdf.
// ============================================================================
const fs = require("fs"), path = require("path");
const ROOT = __dirname;
const { meta, molecules } = require(path.join(ROOT, "biosimilaires-export.json"));

const NAVY = "#0F2A47", BLUE = "#0057FF", ORANGE = "#E8722B", GREEN = "#127A45";
const eur = (n) => n == null ? "—" : (Math.round(n * 100) / 100).toFixed(2).replace(".", ",") + " €";
const pct = (n) => n == null ? "" : "−" + String(n).replace(".", ",") + " %";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// Prix « groupe biosimilaire » d'une molécule : le PPHT réglementé partagé
// (mode des présentations standard des biosimilaires).
function groupBioPrice(m) {
  const vals = m.biosimilaires.map((b) => b.prix_ppht_std).filter((v) => v != null);
  if (!vals.length) return null;
  const freq = {};
  m.biosimilaires.forEach((b) => {
    if (b.prix_ppht_std == null) return;
    const k = b.prix_ppht_std.toFixed(2);
    freq[k] = freq[k] || { ppht: b.prix_ppht_std, net: b.prix_ip_std, ab: b.abandon_std, n: 0 };
    freq[k].n++;
  });
  return Object.values(freq).sort((a, b) => b.n - a.n || b.ppht - a.ppht)[0];
}

const CANAL = { ville: "Officine (ville)", mixte: "Ville + hôpital", hopital: "Hôpital" };

function molRow(m, mode) {
  const ref = m.reference_enrich;
  const gp = groupBioPrice(m);
  const interne = mode === "interne";

  // prix de référence (princeps)
  const refPpht = ref.prix_ppht_std;
  const refPriceHtml = refPpht == null ? '<span class="np">tarif n.c.</span>'
    : '<span class="pp">' + eur(refPpht) + '</span> <span class="lbl">PPHT</span>'
      + (interne && ref.prix_ip_std != null ? '<br><span class="net">' + eur(ref.prix_ip_std) + '</span> <span class="lbl">net IP</span>' : '');

  // bandeau prix biosimilaire (partagé)
  let bioPriceHtml = '<span class="np">tarif n.c.</span>';
  if (gp) {
    if (interne) {
      bioPriceHtml = '<span class="pp">' + eur(gp.ppht) + '</span> <span class="lbl">PPHT</span> · '
        + '<span class="net">' + eur(gp.net) + '</span> <span class="lbl">net IP</span> '
        + '<span class="ab">' + pct(gp.ab) + '</span>';
    } else {
      bioPriceHtml = '<span class="pp">' + eur(gp.ppht) + '</span> <span class="lbl">PPHT</span> · '
        + '<span class="ab">abandon de marge ' + pct(gp.ab) + '</span>';
    }
  }

  const chips = m.biosimilaires.map((b) => {
    const part = b.partenaire ? ' part' : '';
    const star = b.partenaire ? '★ ' : '';
    return '<span class="chip' + part + '">' + star + esc(b.nom) + '</span>';
  }).join("");

  return '<tr>'
    + '<td class="c-sub"><div class="dci">' + esc(m.dci) + '</div>'
    + '<div class="atc">' + esc(m.atc) + '</div><div class="aire">' + esc(m.aire) + '</div></td>'
    + '<td class="c-ref"><div class="rnom">' + esc(m.reference) + '</div>'
    + '<div class="rlabo">' + esc(m.reference_labo) + '</div>'
    + '<div class="rprice">' + refPriceHtml + '</div></td>'
    + '<td class="c-bio"><div class="bioprice">' + bioPriceHtml + '</div>'
    + '<div class="chips">' + chips + '</div></td>'
    + '</tr>';
}

function buildHtml(mode) {
  const interne = mode === "interne";
  const subs = molecules.filter((m) => m.substituable);
  const rows = subs.map((m) => molRow(m, mode)).join("");
  const partList = (meta.partenaires_ip || []).join(", ");

  const confidentiel = interne
    ? '<div class="confid">CONFIDENTIEL · USAGE INTERNE — NE PAS REMETTRE AU PHARMACIEN</div>'
    : '';

  const legendPrix = interne
    ? 'PPHT = tarif grossiste HT · net IP = votre prix après abandon de marge Intégral.'
    : 'PPHT = tarif grossiste HT · abandon de marge Intégral appliqué. Prix net sur demande à votre commercial.';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<style>
  @page { size: A4 portrait; margin: 12mm 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin:0; font-family:-apple-system,"Segoe UI",Roboto,"DM Sans",Helvetica,Arial,sans-serif; color:${NAVY}; font-size:10.5px; }
  .head { background:${NAVY}; color:#fff; border-radius:12px; padding:16px 20px; display:flex; align-items:center; justify-content:space-between; }
  .brand { font-size:20px; font-weight:800; letter-spacing:-.01em; }
  .brand .o { color:${ORANGE}; }
  .htitle { text-align:right; }
  .htitle .t { font-size:16px; font-weight:800; }
  .htitle .s { font-size:10px; opacity:.85; margin-top:2px; }
  .confid { margin-top:8px; background:#FDECDD; color:#B8551A; border:1px solid ${ORANGE}; border-radius:8px;
            padding:6px 12px; font-weight:800; font-size:10px; text-align:center; letter-spacing:.03em; }
  table { width:100%; border-collapse:separate; border-spacing:0 6px; margin-top:10px; }
  thead th { font-size:9px; text-transform:uppercase; letter-spacing:.05em; color:#8894A6; font-weight:800;
             text-align:left; padding:0 10px 2px; }
  tbody tr { page-break-inside:avoid; }
  td { background:#fff; border:1px solid #E6EAF0; vertical-align:top; padding:9px 11px; }
  td.c-sub { width:20%; border-right:0; border-radius:10px 0 0 10px; background:${NAVY}; color:#fff; }
  td.c-ref { width:27%; border-left:0; border-right:0; }
  td.c-bio { width:53%; border-left:0; border-radius:0 10px 10px 0; }
  .dci { font-size:12.5px; font-weight:800; }
  .atc { font-size:8.5px; opacity:.7; font-family:monospace; margin-top:1px; }
  .aire { font-size:9px; opacity:.9; margin-top:3px; }
  .rnom { font-weight:800; font-size:11.5px; }
  .rlabo { font-size:9px; color:#737A8C; margin-top:1px; }
  .rprice { margin-top:5px; line-height:1.5; }
  .pp { font-weight:800; color:${NAVY}; }
  .net { font-weight:800; color:${GREEN}; }
  .ab { font-weight:800; color:${ORANGE}; font-size:9.5px; }
  .lbl { font-size:8px; color:#8894A6; text-transform:uppercase; font-weight:700; }
  .np { color:#B4BECC; font-style:italic; font-size:9.5px; }
  .bioprice { background:#F4F7FE; border-radius:7px; padding:6px 9px; margin-bottom:6px; line-height:1.5; }
  .chips { display:flex; flex-wrap:wrap; gap:4px; }
  .chip { background:#EEF2F7; color:${NAVY}; border-radius:6px; padding:3px 8px; font-size:9.5px; font-weight:600; }
  .chip.part { background:#FDECDD; color:${ORANGE}; font-weight:800; }
  .foot { margin-top:12px; font-size:8.5px; color:#8894A6; line-height:1.6; border-top:1px solid #E6EAF0; padding-top:8px; }
  .foot b { color:#5A6b80; }
</style></head><body>
  <div class="head">
    <div class="brand">int<span class="o">é</span>gral <span style="font-weight:600;opacity:.9">Pharma</span></div>
    <div class="htitle"><div class="t">Biosimilaires substituables en officine</div>
      <div class="s">Liste de référence · substitution autorisée en ville (arrêté du 10 avril 2026)</div></div>
  </div>
  ${confidentiel}
  <table>
    <thead><tr><th>Substance active</th><th>Médicament de référence</th><th>Biosimilaires disponibles &amp; prix Intégral</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="foot">
    <b>★ Partenaire Intégral</b> (${esc(partList)}) · ${esc(legendPrix)}<br>
    Prix de la présentation standard, à titre indicatif — susceptibles d'évolution réglementaire. Le PPHT est un tarif réglementé commun à tous les biosimilaires d'une même présentation.<br>
    Source : référentiel ANSM / Ameli / EMA × tarif &amp; ventes réseau Intégral · édité le ${esc(meta.genere_le)}.
  </div>
</body></html>`;
}

for (const mode of ["interne", "pharmacien"]) {
  const out = path.join(ROOT, "biosim-poster-" + mode + ".html");
  fs.writeFileSync(out, buildHtml(mode));
  console.log("✓ " + path.basename(out));
}
