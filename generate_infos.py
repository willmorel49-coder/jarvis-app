#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Veille « Infos du matin » — robot quotidien GRATUIT (tourne dans GitHub Actions).
Agrège des flux RSS publics officiels/pro et écrit crm/v2/infos-jour.json.
Aucune clé API, aucune dépendance (stdlib only). L'app CRM lit le JSON (même origine).

Sources :
  - ANSM disponibilité (ruptures/tensions MITM)  -> cat "ruptures" (+ DCI entre crochets)
  - ANSM actualités médicaments                  -> cat "reglementaire"
  - ANSM informations de sécurité médicaments     -> cat "securite"
  - Le Moniteur des pharmacies (RSS)              -> cat "profession"
"""
import urllib.request, urllib.parse, json, re, os, sys, html
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, date, timedelta

WINDOW_DAYS = 7   # on garde la semaine glissante

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'crm', 'v2', 'infos-jour.json')

FEEDS = [
    {'cat': 'ruptures',      'source': 'ANSM · Disponibilité', 'url': 'https://ansm.sante.fr/rss/disponibilite_produits_sante?produitsSante=medicaments', 'max': 40},
    {'cat': 'securite',      'source': 'ANSM · Sécurité',      'url': 'https://ansm.sante.fr/rss/informations_securite?produitsSante=medicaments', 'max': 20},
    {'cat': 'reglementaire', 'source': 'ANSM · Actualités',    'url': 'https://ansm.sante.fr/rss/actualites?produitsSante=medicaments', 'max': 20},
    {'cat': 'profession',    'source': 'Le Quotidien du Pharmacien', 'url': 'https://www.lequotidiendupharmacien.fr/rss.xml', 'max': 35, 'filter': True},
    {'cat': 'profession',    'source': 'Le Moniteur des pharmacies', 'url': 'https://www.lemoniteurdespharmacies.fr/feed/', 'max': 25, 'filter': True},
    {'cat': 'profession',    'source': 'FSPF',                 'url': 'https://www.fspf.fr/feed/', 'max': 10, 'filter': True},
    {'cat': 'profession',    'source': 'Le Pharmacien de France', 'url': 'https://www.lepharmaciendefrance.fr/feed', 'max': 10, 'filter': True},
    {'cat': 'reglementaire', 'source': 'Leem',                 'url': 'https://www.leem.org/rss.xml', 'max': 8, 'filter': True, 'strict': True},
]
# Flux écartés (presse médecins = trop de bruit clinique, faible valeur officine/grossiste) :
# Le Quotidien du Médecin, Le Généraliste, Egora, What's up Doc. La presse pharma pure couvre déjà
# remboursement / prix / génériques / ruptures / honoraires / distribution.

# Pertinence "cœur de métier officine" : on ne garde de la presse pro que ce qui touche
# directement le comptoir, la distribution et l'économie de l'officine.
REL = re.compile(
    r'pharmac|officin|comptoir|g[ée]n[ée]riqu|substitu|biosimil|rupture|tension|approvision|'
    r'rembours|d[ée]rembours|\bprix\b|honorair|convention|avenant|rosp|tarif|nomenclature|marge|'
    r'grossist|r[ée]partit|distribut|contingent|quota|d[ée]livr|ordonnance|prescript|s[ée]rialis|'
    r'vaccin|trod|d[ée]pist|entretien|bilan partag|t[ée]l[ée](soin|consult)|parapharma|'
    r'\bpda\b|lfss|ameli|cnam|ceps|\bhas\b|transparence|\bsmr\b|\basmr\b|m[ée]dicament|p[ée]nurie|'
    r'missions?|\bgarde\b|laboratoire|industrie pharma|stock|p[ée]remption', re.I)
# Filtre STRICT pour les sources non-officine (presse médecins, industrie) :
# on n'en garde QUE ce qui touche vraiment le médicament, l'officine ou la distribution.
REL_STRICT = re.compile(
    r'pharmac|officin|comptoir|grossist|r[ée]partit|distribut|g[ée]n[ée]riqu|biosimil|substitu|'
    r'rupture|tension|rembours|d[ée]rembours|honorair|\bmarge|d[ée]livr|ordonnance|prescript|'
    r'm[ée]dicament|s[ée]rialis|contingent|quota|parapharma|vaccin|\bprix\b du m', re.I)
def relevant(txt, strict=False):
    rx = REL_STRICT if strict else REL
    return bool(rx.search(txt or ''))
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    return urllib.request.urlopen(req, timeout=20).read()


def clean(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')          # retire le HTML éventuel
    s = html.unescape(s)                           # décode toutes les entités (&#8217; &rsquo; …)
    return re.sub(r'\s+', ' ', s).strip()


def parse_date(s):
    s = (s or '').strip()
    for fmt in ('%a, %d %b %Y %H:%M:%S %z', '%a, %d %b %Y %H:%M:%S %Z', '%Y-%m-%dT%H:%M:%S%z'):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            pass
    return None


def dci_of(title):
    # ANSM met la DCI entre crochets en fin de titre : "... – [héparine calcique]"
    m = re.findall(r'\[([^\]]+)\]', title or '')
    return clean(m[-1]).lower() if m else ''


def items_from(feed):
    out = []
    try:
        raw = fetch(feed['url'])
    except Exception as e:
        sys.stderr.write('FAIL %s : %s\n' % (feed['url'], e))
        return out
    # certains flux ajoutent un BOM ou une ligne vide avant <?xml -> on nettoie
    i = raw.find(b'<?xml')
    if i < 0:
        i = raw.find(b'<rss')
    if i < 0:
        i = raw.find(b'<')
    if i > 0:
        raw = raw[i:]
    try:
        root = ET.fromstring(raw)
    except Exception as e:
        sys.stderr.write('XML FAIL %s : %s\n' % (feed['url'], e))
        return out
    for it in root.iter('item'):
        t = it.findtext('title') or ''
        link = it.findtext('link') or ''
        pub = it.findtext('pubDate') or it.findtext('{http://purl.org/dc/elements/1.1/}date') or ''
        d = parse_date(pub)
        titre = clean(t)
        if not titre:
            continue
        # résumé : description, sinon content:encoded
        desc = it.findtext('description') or ''
        if not desc:
            enc = it.find('{http://purl.org/rss/1.0/modules/content/}encoded')
            desc = enc.text if (enc is not None and enc.text) else ''
        desc = clean(desc)
        row = {
            'cat': feed['cat'], 'source': feed['source'],
            'titre': titre, 'url': clean(link),
            'date': (d.astimezone(timezone.utc).isoformat() if d else ''),
        }
        if feed['cat'] == 'ruptures':
            dci = dci_of(t)
            if dci:
                row['dci'] = dci
                row['titre'] = re.sub(r'\s*[–-]\s*\[[^\]]+\]\s*$', '', titre).strip()  # libellé sans la DCI
            m = re.search(r'Statut\s*:\s*(.+?)\s*-\s*A partir', desc)        # ex "Tension d'approvisionnement"
            if m: row['statut'] = m.group(1).strip()
            md = re.search(r'A partir du\s*([0-9/]{8,10})', desc)
            if md: row['depuis'] = md.group(1)
        else:
            r = re.sub(r'^Ce que vous allez apprendre\s*:?\s*', '', desc)    # préfixe template Le Moniteur
            if re.match(r'^(Publié|Mis à jour|Statut)\b', r):                 # métadonnées ANSM seules = pas un résumé
                r = ''
            if len(r) > 320:
                r = r[:320].rsplit(' ', 1)[0] + '…'
            row['resume'] = r
        # filtre pertinence : large pour la presse officine, strict pour médecins/industrie
        if feed.get('filter') and not relevant(titre + ' ' + (row.get('resume') or ''), feed.get('strict')):
            continue
        out.append(row)
        if len(out) >= feed['max']:
            break
    return out


def keyof(it):
    return (it.get('url') or '').strip() or (it.get('source', '') + '|' + it.get('titre', ''))


def daystr(it, today):
    # jour de référence de l'item : sa date de publication sinon le jour où on l'a vu
    return (it.get('date') or '')[:10] or it.get('seen') or today


def deslug(url):
    seg = (url or '').rstrip('/').split('/')[-1].replace('-', ' ').strip()
    return ' '.join(w[:1].upper() + w[1:] for w in seg.split()) if seg else ''


def fetch_rappels(n=16):
    """API officielle RappelConso (data.economie.gouv.fr) — rappels parapharma/cosmétiques (hygiène-beauté)."""
    out = []
    url = ('https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records'
           '?limit=%d&order_by=date_publication%%20DESC&where=%s'
           % (n, urllib.parse.quote('categorie_produit="hygiène-beauté"')))
    try:
        data = json.loads(fetch(url))
    except Exception as e:
        sys.stderr.write('FAIL rappels : %s\n' % e); return out
    for r in (data.get('results') or []):
        img = r.get('liens_vers_les_images') or ''
        if isinstance(img, list): img = img[0] if img else ''
        img = str(img).split('|')[0].strip()
        out.append({
            'titre': clean(r.get('libelle') or r.get('modeles_ou_references') or r.get('marque_produit') or 'Rappel produit'),
            'marque': clean(r.get('marque_produit') or ''),
            'motif': clean(r.get('motif_rappel') or ''),
            'risque': clean(r.get('risques_encourus') or ''),
            'conduite': clean(r.get('conduites_a_tenir_par_le_consommateur') or '').replace('|', ' · '),
            'img': img,
            'url': (r.get('lien_vers_la_fiche_rappel') or '').strip(),
            'date': (r.get('date_publication') or '')[:10],
        })
    return out


def fetch_ruptures_live(n=40):
    """API BDPM/ANSM (bdpmgf.vedielaute.fr) — ruptures & tensions médicament EN COURS (état temps réel)."""
    out, total = [], 0
    try:
        d = json.loads(fetch('https://bdpmgf.vedielaute.fr/api/medicaments/disponibilite?limit=400'))
    except Exception as e:
        sys.stderr.write('FAIL ruptures API : %s\n' % e); return out, total
    rows = d.get('data') or []
    total = (d.get('pagination') or {}).get('total') or len(rows)
    def pdk(s):
        m = re.match(r'(\d{2})/(\d{2})/(\d{4})', s or '')
        return (m.group(3) + m.group(2) + m.group(1)) if m else ''
    rows = [r for r in rows if re.search(r'rupture|tension', (r.get('classement_remboursement') or ''), re.I)]
    rows.sort(key=lambda r: pdk(r.get('date_debut')), reverse=True)
    seen = {}
    for r in rows:
        nm = deslug(r.get('type_etat'))
        if not nm:
            continue
        key = re.split(r'\s\d', nm)[0].lower().strip()   # dédoublonne par nom (hors dosage/présentation)
        if key in seen:
            continue
        seen[key] = 1
        out.append({'titre': nm, 'statut': (r.get('classement_remboursement') or '').strip(),
                    'depuis': (r.get('date_debut') or '').strip(), 'url': (r.get('type_etat') or '').strip()})
        if len(out) >= n:
            break
    return out, total


def build_recap(items, rappels, rlive, rtotal, today):
    """Récap « brief » calculé — UNIQUEMENT l'info datée d'aujourd'hui (zéro dépendance)."""
    def short(t, n=92):
        t = (t or '').strip(); return t if len(t) <= n else t[:n].rsplit(' ', 1)[0] + '…'
    rupt = [i for i in items if i.get('cat') == 'ruptures' and i.get('today')]
    rap = [r for r in rappels if (r.get('date') or '')[:10] == today]
    actu = [i for i in items if i.get('today') and i.get('cat') != 'ruptures']
    lines = []
    if rupt:
        lines.append("• %d nouvelle%s rupture/tension — %s"
                     % (len(rupt), 's' if len(rupt) > 1 else '', short(rupt[0].get('titre', ''))))
    if rap:
        ex = rap[0]; m = (ex.get('marque') or '').strip(); rq = (ex.get('risque') or '').strip()
        det = m + (' — ' + rq if rq else '') if m else rq
        lines.append("• %d rappel%s parapharma du jour%s"
                     % (len(rap), 's' if len(rap) > 1 else '', (' (%s)' % det) if det else ''))
    if actu:
        lines.append("• Actu du jour — " + short(actu[0].get('titre', '')))
    if not lines:
        return {'text': "Rien de neuf à l'instant : aucune rupture, rappel ou actu datés d'aujourd'hui. La veille des 7 derniers jours est ci-dessous.", 'une': '', 'ai': False, 'empty': True}
    return {'text': '\n'.join(lines), 'une': '', 'ai': False}


def ai_recap(items, rappels, rlive, rtotal):
    """Synthèse IA via Gemini (palier gratuit) si GEMINI_API_KEY présent côté robot. Repli silencieux sinon."""
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        return None
    actu = [i.get('titre', '') for i in items if i.get('today') and i.get('cat') != 'ruptures'][:8]
    rap = ['%s — %s (%s)' % (r.get('titre', ''), r.get('risque', ''), r.get('marque', '')) for r in rappels[:5]]
    rup = ['%s [%s]' % (r.get('titre', ''), r.get('statut', '')) for r in rlive[:8]]
    prompt = ("Tu es l'assistant de veille d'un commercial grossiste pharma (Intégral Pharma) et de ses pharmaciens d'officine. "
              "À partir des données du jour ci-dessous, rédige un récap ULTRA court en français : 3 puces maximum, style télégraphique, "
              "sans phrase d'introduction, centré sur ce qui est ACTIONNABLE au comptoir (ce qu'il faut retirer, surveiller, pousser). "
              "Commence chaque puce par « • ».\n\n"
              "Ruptures/tensions suivies par l'ANSM : %d. Les plus récentes : %s\n"
              "Rappels parapharma (RappelConso) : %s\n"
              "Actu métier du jour : %s" % (rtotal, ' | '.join(rup), ' | '.join(rap), ' | '.join(actu)))
    body = json.dumps({'contents': [{'parts': [{'text': prompt}]}],
                       'generationConfig': {'temperature': 0.3, 'maxOutputTokens': 320}}).encode('utf-8')
    url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=' + key
    try:
        req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
        resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
        txt = html.unescape(resp['candidates'][0]['content']['parts'][0]['text']).strip()   # garde les retours à la ligne (puces)
        return {'text': txt, 'une': '', 'ai': True} if txt else None
    except Exception as e:
        sys.stderr.write('AI recap FAIL : %s\n' % e)
        return None


def main():
    today = date.today().isoformat()
    cutoff = (date.today() - timedelta(days=WINDOW_DAYS - 1)).isoformat()

    # 1) reprendre l'existant (accumulation semaine glissante)
    merged = {}
    try:
        old = json.load(open(OUT, encoding='utf-8'))
        for it in old.get('items', []):
            merged[keyof(it)] = it
    except Exception:
        pass

    # 2) fusionner les nouveautés (garde la 1ère date de découverte = "seen")
    fresh = 0
    for f in FEEDS:
        for it in items_from(f):
            k = keyof(it)
            if k in merged:
                it['seen'] = merged[k].get('seen') or daystr(merged[k], today)
            else:
                it['seen'] = (it.get('date') or '')[:10] or today
                fresh += 1
            merged[k] = it

    # 3) fenêtre 7 jours + drapeau "aujourd'hui"
    items = []
    for it in merged.values():
        d = daystr(it, today)
        if d < cutoff:
            continue
        it['day'] = d
        it['today'] = (d == today)
        items.append(it)

    # 4) tri : aujourd'hui d'abord, puis catégorie, puis date décroissante
    order = {'ruptures': 0, 'securite': 1, 'reglementaire': 2, 'profession': 3}
    items.sort(key=lambda r: (0 if r['today'] else 1, order.get(r['cat'], 9), _neg(r.get('date') or r['day'])))

    # 5) sources API (gratuites) : rappels parapharma + ruptures médicament en direct
    rappels = fetch_rappels()
    ruptures_live, ruptures_total = fetch_ruptures_live()
    recap = ai_recap(items, rappels, ruptures_live, ruptures_total) or build_recap(items, rappels, ruptures_live, ruptures_total, today)

    payload = {
        'day': today,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'window_days': WINDOW_DAYS,
        'count': len(items),
        'count_today': sum(1 for i in items if i['today']),
        'sources': [f['source'] for f in FEEDS] + ['RappelConso (DGCCRF)', 'ANSM · Disponibilités (BDPM)'],
        'items': items,
        'recap': recap,
        'rappels': rappels,
        'ruptures_live': ruptures_live,
        'ruptures_total': ruptures_total,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(',', ':'))
    n_rupt = sum(1 for i in items if i['cat'] == 'ruptures')
    print('OK %d infos / %dj (%d auj., %d ruptures RSS) · %d rappels · %d/%d ruptures live · recap=%s -> %s'
          % (len(items), WINDOW_DAYS, payload['count_today'], n_rupt, len(rappels), len(ruptures_live), ruptures_total,
             ('IA' if recap.get('ai') else 'calculé'), OUT))


def _neg(iso):
    # tri par date décroissante via clé ascendante
    return '' if not iso else ''.join(str(255 - ord(c)) for c in iso[:19])


if __name__ == '__main__':
    main()
