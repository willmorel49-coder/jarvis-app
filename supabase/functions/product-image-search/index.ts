// product-image-search — Supabase Edge Function (Deno runtime)
//
// Recherche d'images produit pour le CRM Intégral Pharma.
// Appelée depuis crm/marketing.js (onglet Marketing) quand l'utilisateur clique
// "Trouver une image" sur une ligne produit sélectionnée.
//
// Cascade de sources (de la + fiable à la - fiable) :
//   1. EAN  → Open Products / Open Food Facts (gratuit, sans clé)
//   2. Nom  → Google Custom Search Images (clés GOOGLE_API_KEY + GOOGLE_CX)
//   3. CIP13 sans nom → on requête juste "<cip13> boite medicament" sur Google
//
// La fonction renvoie {candidates: [{url, source, title?}]} (max 8). Elle ne
// stocke rien : c'est l'UI qui décide quelle image utiliser.
//
// Déploiement :
//   supabase functions deploy product-image-search --project-ref iyvavhnlhxksokkerkos
//   supabase secrets set GOOGLE_API_KEY=xxx GOOGLE_CX=yyy --project-ref iyvavhnlhxksokkerkos

// deno-lint-ignore-file no-explicit-any

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

type Candidate = { url: string; source: string; title?: string };

const MAX_CANDIDATES = 8;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ── Source 1 : Open Products Facts / Open Food Facts (EAN) ──────────────
async function fetchOpenProducts(ean: string): Promise<Candidate[]> {
  const out: Candidate[] = [];
  // Open Products Facts couvre la parapharma/cosmétique
  // Open Food Facts couvre l'alimentaire/compléments (parfois redondant)
  const endpoints = [
    `https://world.openproductsfacts.org/api/v2/product/${encodeURIComponent(ean)}.json`,
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json`,
  ];
  for (const url of endpoints) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const p = data && data.product;
      if (!p) continue;
      const img =
        p.image_front_url ||
        p.image_url ||
        (p.selected_images &&
          (p.selected_images.front?.display?.fr ||
            p.selected_images.front?.display?.en));
      if (img && typeof img === "string") {
        out.push({
          url: img,
          source: "openproducts",
          title: p.product_name || p.generic_name || undefined,
        });
      }
    } catch (_e) {
      // Erreur réseau / timeout → on continue
    }
    if (out.length) break; // Premier hit suffit
  }
  return out;
}

// ── Source 2 : Google Custom Search Image API ───────────────────────────
async function fetchGoogleImages(query: string): Promise<Candidate[]> {
  const apiKey = Deno.env.get("GOOGLE_API_KEY");
  const cx = Deno.env.get("GOOGLE_CX");
  if (!apiKey || !cx) return [];
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "8");
  url.searchParams.set("safe", "active");
  url.searchParams.set("imgSize", "medium");
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url.toString(), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("google customsearch error", res.status, txt.slice(0, 200));
      return [];
    }
    const data = await res.json();
    const items: any[] = Array.isArray(data.items) ? data.items : [];
    return items
      .filter((it) => it && typeof it.link === "string")
      .map((it) => ({
        url: it.link as string,
        source: "google",
        title: typeof it.title === "string" ? it.title : undefined,
      }));
  } catch (e) {
    console.error("google fetch failed", e);
    return [];
  }
}

function dedupe(cands: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of cands) {
    if (!c || !c.url) continue;
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    out.push(c);
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const url = new URL(req.url);
  const ean = (url.searchParams.get("ean") || "").trim();
  const cip13 = (url.searchParams.get("cip13") || "").trim();
  const name = (url.searchParams.get("name") || "").trim();

  if (!ean && !cip13 && !name) {
    return json({ error: "missing_params", message: "ean, cip13 or name required" }, 400);
  }

  const candidates: Candidate[] = [];

  // 1) EAN → Open Products Facts
  if (ean) {
    try {
      const op = await fetchOpenProducts(ean);
      candidates.push(...op);
    } catch (e) {
      console.error("openproducts step failed", e);
    }
  }

  // 2) Si pas encore plein → Google Custom Search
  if (candidates.length < MAX_CANDIDATES) {
    // Construit la requête :
    //  - si on a un nom → "<nom> boite medicament"  (cip13 = pharma OTC)
    //  - sinon si cip13 seul → "<cip13> boite medicament"
    //  - sinon ean seul → "<ean> produit"
    let q = "";
    if (name) {
      q = cip13 ? `${name} boite medicament` : `${name} produit`;
    } else if (cip13) {
      q = `${cip13} boite medicament`;
    } else if (ean) {
      q = `${ean} produit`;
    }
    if (q) {
      try {
        const g = await fetchGoogleImages(q);
        candidates.push(...g);
      } catch (e) {
        console.error("google step failed", e);
      }
    }
  }

  const final = dedupe(candidates);
  return json({ candidates: final, query: { ean, cip13, name } });
});
