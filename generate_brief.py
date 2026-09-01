#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
« L'édition du matin » — le rédacteur en chef de JARVIS.

Ne va chercher AUCUNE source lui-même : il lit ce que les autres robots ont déjà
déposé dans crm/v2/ chaque nuit, et il en fait UNE édition datée, hiérarchisée,
archivée. C'est la couche qui manquait : la donnée existait, personne ne la
rassemblait.

Ce qu'il fait, dans l'ordre :
  1. COLLECTE     — 11 fichiers déjà produits (presse, ANSM, JO, CEPS, HAS, EMA,
                    épidémio, urgences, rappels, veille concurrents).
  2. REGROUPE     — le même sujet raconté par USPO + FSPF + Google News devient
                    UNE entrée qui dit « 3 sources ».
  3. CLASSE       — un thème métier par entrée (marge, remboursement, générique,
                    rupture, sécurité, officine, concurrence, industrie).
  4. NOTE         — score d'importance pour un grossiste-répartiteur : autorité
                    de la source, poids du thème, fraîcheur, reprises, échéance.
  5. RÉDIGE       — « Les 5 qui comptent », chacune avec son angle métier.
                    100 % déterministe : rien n'est inventé, tout est extrait.
  6. MESURE       — « Le radar » : les signaux chiffrés du jour, tous mesurés.
  7. ARCHIVE      — une édition par jour, 120 jours, consultables et cherchables.

Sortie : crm/v2/brief-jour.json  +  crm/v2/brief-archive.json
Zéro clé, zéro dépendance (stdlib), zéro coût. Tourne dans GitHub Actions.

⚠️ Le dépôt est PUBLIC : ce fichier ne doit contenir QUE de l'information
   publique. Aucun prix Intégral, aucune remise, aucun abandon de marge, aucune
   donnée client. Le croisement avec le catalogue reste côté application.
"""
import json, os, re, sys, unicodedata
from datetime import datetime, timezone, date, timedelta

ROOT = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.join(ROOT, 'crm', 'v2')
OUT = os.path.join(V2, 'brief-jour.json')
ARCH = os.path.join(V2, 'brief-archive.json')

TODAY = date.today()
ARCHIVE_DAYS = 120        # ce que pharmalpha appelle « les archives »
FIL_DAYS = 21             # profondeur du fil complet (3 semaines glissantes)

# ───────────────────────────── petites fonctions ─────────────────────────────

def norm(s):
    """minuscules, sans accents, sans ponctuation — pour comparer des titres."""
    s = unicodedata.normalize('NFD', str(s or ''))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'\s+', ' ', re.sub(r"[^a-z0-9]+", ' ', s)).strip()


def clean(s):
    s = re.sub(r'<[^>]+>', ' ', str(s or ''))
    return re.sub(r'\s+', ' ', s).strip()


def load(name):
    """Lit un fichier de robot. Absent ou cassé = on continue sans lui."""
    p = os.path.join(V2, name)
    try:
        with open(p, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        sys.stderr.write('  (absent/illisible) %s : %s\n' % (name, e))
        return None


def iso_day(s):
    """'2026-09-01T09:12:01+00:00' | '01/09/2026' | '2026-09-01' -> '2026-09-01'"""
    s = str(s or '').strip()
    if not s:
        return ''
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        return m.group(0)
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})', s)
    if m:
        return '%s-%s-%s' % (m.group(3), m.group(2), m.group(1))
    return ''


def days_ago(d):
    d = iso_day(d)
    if not d:
        return 999
    try:
        return (TODAY - date(int(d[0:4]), int(d[5:7]), int(d[8:10]))).days
    except Exception:
        return 999


def days_until(d):
    return -days_ago(d)


def phrase(txt, limit=190):
    """Première phrase utile d'un résumé, coupée proprement."""
    t = clean(txt)
    t = re.sub(r"L[’']article .+ est apparu en premier sur .*$", '', t).strip()
    t = re.sub(r'\[…\]|\[\.\.\.\]', '…', t)
    if len(t) <= limit:
        return t
    cut = t[:limit]
    p = max(cut.rfind('. '), cut.rfind(' ; '))
    return (cut[:p + 1] if p > 60 else cut.rsplit(' ', 1)[0] + '…').strip()


# ───────────────────────────── thèmes métier ─────────────────────────────
# L'ordre compte : le premier motif qui matche gagne. Les thèmes qui touchent
# l'argent d'Intégral passent avant les thèmes cliniques.
#
# ⚠️ Leçon du 13/08/2026 (réforme de la marge grossiste, ratée par la veille) :
#    les mots-clés sont en vocabulaire JURIDIQUE autant que métier. Un arrêté qui
#    change la marge du grossiste s'intitule « prix et marges des médicaments
#    remboursables » — ni « grossiste », ni « répartiteur » dedans.
THEMES = [
    ('marge', re.compile(
        r'marge|grossist|r[ée]partit|distribution en gros|distributeur en gros|'
        r'remise|abattement|honorair|r[ée]mun[ée]ration|marge r[ée]glement|'
        r'prix et marges|d[ée]cote|coefficient|forfait par bo[iî]te|'
        r'plateforme logistique|co[uû]t de distribution', re.I)),
    ('remboursement', re.compile(
        r'rembours|d[ée]rembours|\bceps\b|\bp?lfss\b|\bpfhr\b|tiers payant|'
        r'taux de prise en charge|prix (de vente|public|fabricant|limite)|'
        r'baisses? de prix|hausses? de prix|prix publi|tarif forfaitaire|\btfr\b|s[ée]curit[ée] sociale|budget de la s[ée]cu|\bpub\b l[ée]gal|'
        r'\bcnam\b|assurance maladie|convention|avenant|\brosp\b|nomenclature', re.I)),
    ('generique', re.compile(
        r'g[ée]n[ée]riqu|biosimil|hybride|substitu|interchangeab|r[ée]pertoire|'
        r'\bbio[- ]?similaire|princeps|brevet|d[ée]ch[ée]ance', re.I)),
    ('rupture', re.compile(
        r'rupture|tension d.approvision|p[ée]nurie|contingent|quota|'
        r'approvisionnement|stock[ -]?out|indisponib|remise ? disposition|\bmitm\b|'
        r'disponibilit[ée] des (m[ée]dicaments|produits)|alertes? de disponibilit', re.I)),
    ('securite', re.compile(
        r'rappel de lot|retrait de lot|rappel|pharmacovigilance|d[ée]faut qualit|'
        r'alerte de s[ée]curit|contre[- ]indication|effet ind[ée]sirable|'
        r'restriction d.utilisation|suspension d.amm|police sanitaire|'
        r'retrait du produit|falsifi|contrefa|produits? dangereux', re.I)),
    ('concurrence', re.compile(
        r'\bocp\b|alliance healthcare|\bcerp\b|phoenix pharma|welcoop|'
        r'giphar|astera|\bcsrp\b|groupement|centrale d.achat|plateforme de distribution|'
        r'rachat|acquisition|fusion', re.I)),
    ('officine', re.compile(
        r'officin|pharmacien|comptoir|vaccinat|\btrod\b|d[ée]pistage|entretien pharma|'
        r'bilan partag|t[ée]l[ée]soin|t[ée]l[ée]consult|\bpda\b|garde|missions?|'
        r'ordonnance|d[ée]livrance|prescription|s[ée]rialisation|parapharma|'
        r'facturation|t[ée]l[ée]transmission|logiciel de gestion|conservation|p[ée]remption', re.I)),
    ('industrie', re.compile(
        r'laboratoire|industrie|usine|site de production|\bleem\b|\bamm\b|'
        r'essai clinique|\bema\b|\bhas\b|autorisation de mise sur le march', re.I)),
]

THEME_LABEL = {
    'marge':        'Marge & distribution',
    'remboursement': 'Prix & remboursement',
    'generique':    'Génériques & biosimilaires',
    'rupture':      'Ruptures & tensions',
    'securite':     'Sécurité & rappels',
    'concurrence':  'Concurrence & marché',
    'officine':     'Vie de l\'officine',
    'industrie':    'Industrie & autorisations',
    'autre':        'Autre',
}

# Ce que chaque thème veut dire pour un grossiste-répartiteur. C'est l'angle,
# pas un commentaire : une phrase fixe par thème, jamais une invention sur le fond.
THEME_ANGLE = {
    'marge':        'Touche la rémunération de la répartition — le cœur du modèle Intégral.',
    'remboursement': 'Change le prix ou la prise en charge : impact direct sur le chiffrage officine.',
    'generique':    'Ouvre ou ferme un marché substituable — donc un volume à aller chercher.',
    'rupture':      'Une molécule qui manque au comptoir, c\'est une commande à sécuriser.',
    'securite':     'À signaler aux officines avant qu\'elles ne l\'apprennent ailleurs.',
    'concurrence':  'Bouge le paysage de la répartition : à connaître avant un rendez-vous.',
    'officine':     'Change le quotidien de tes clients — matière à conversation au comptoir.',
    'industrie':    'Amont du circuit : ce qui arrivera en officine dans quelques mois.',
    'autre':        'Signalé par la veille du secteur.',
}

THEME_POIDS = {
    'marge': 30, 'remboursement': 24, 'generique': 20, 'rupture': 18,
    'concurrence': 18, 'officine': 12, 'securite': 12, 'industrie': 6, 'autre': 4,
}


# Le robot « veille concurrents » étiquette déjà ses articles : un article
# tagué OCP ou CERP est un article sur un concurrent direct, quel que soit son titre.
TAG_THEME = {'ocp': 'concurrence', 'cerp-rouen': 'concurrence', 'cerp-rrm': 'concurrence',
             'sagitta': 'concurrence', 'groupement': 'concurrence',
             'marge': 'marge', 'generique': 'generique', 'biosimilaire': 'generique'}


def theme_of(txt, tag=''):
    """Le texte d'abord (il est plus précis), l'étiquette du robot en repli."""
    for name, rx in THEMES:
        if rx.search(txt or ''):
            return name
    t = TAG_THEME.get((tag or '').lower())
    return t or 'autre'


# Autorité de la source : une source primaire (le texte lui-même) vaut plus
# qu'un article qui en parle.
SRC_POIDS = [
    (re.compile(r'journal officiel|l[ée]gifrance|\bjorf\b|dila', re.I), 42),
    (re.compile(r'\bceps\b|avis de prix', re.I),                        38),
    (re.compile(r'\bansm\b', re.I),                                     32),
    (re.compile(r'\bhas\b|transparence', re.I),                         28),
    (re.compile(r'\bema\b', re.I),                                      24),
    (re.compile(r'uspo|fspf|\bfsp\b|syndicat', re.I),                   24),
    (re.compile(r'leem|ordre national des pharmaciens|cnop', re.I),     22),
    (re.compile(r'ameli|cnam|assurance maladie|sant[ée] publique', re.I), 22),
    (re.compile(r'pharmacien de france|moniteur|quotidien du pharm', re.I), 16),
    (re.compile(r'sentinelles|sursaud|odiss', re.I),                    18),
    (re.compile(r'rappelconso|dgccrf', re.I),                           20),
]


def src_poids(src):
    for rx, p in SRC_POIDS:
        if rx.search(src or ''):
            return p
    return 10   # agrégateur (Google News) ou source inconnue


# ───────────────────────────── 1. COLLECTE ─────────────────────────────

def collecte():
    """Toutes les entrées candidates, normalisées au même format."""
    E = []           # entrées « éditoriales » (candidates au brief)
    lus = []         # noms des fichiers réellement lus
    ctx = {}         # données non-éditoriales (radar, sections dédiées)

    def add(titre, url, source, jour, resume='', kind='actu', extra=None):
        t = clean(titre)
        # L'ANSM colle la DCI entre crochets en fin de titre, la presse ajoute
        # son nom en queue (« … - Le Moniteur »). Ni l'un ni l'autre n'est du titre.
        t = re.sub(r'\s*[–—-]\s*\[[^\]]+\]\s*$', '', t)
        t = re.sub(r'\s*[–—|]\s*[^–—|]{3,28}$', '', t) if re.search(
            r'[–—|]\s*(le moniteur|le quotidien|vidal|pharma\s?365|ouest-?france|'
            r'sud ?ouest|les echos|capital|lib[ée]ration|le temps|voxlog)\S*\s*$', t, re.I) else t
        if not t:
            return
        e = {'t': t, 'u': url or '', 's': clean(source), 'd': iso_day(jour),
             'r': phrase(resume), 'k': kind}
        if extra:
            e.update(extra)
        E.append(e)

    # ── presse pro + ANSM RSS + rappels parapharma (generate_infos.py) ──
    d = load('infos-jour.json')
    if d:
        lus.append('infos-jour.json')
        for i in d.get('items', []):
            if i.get('cat') == 'ruptures':
                continue      # les ruptures ont leur propre source, plus riche
            add(i.get('titre'), i.get('url'), i.get('source'), i.get('date'), i.get('resume'))
        ctx['rappels_para'] = d.get('rappels', [])[:12]

    # ── veille secteur / concurrents (generate_grossistes_actu.py) ──
    d = load('grossistes-actu.json')
    if d:
        lus.append('grossistes-actu.json')
        for i in d.get('items', [])[:120]:
            # Les fiches produit « ANSM · Disponibilité » ne sont pas des articles :
            # elles ont leur propre rubrique, avec la date de retour et la substituabilité.
            if re.search(r'ansm.*disponibilit', i.get('source') or '', re.I):
                continue
            add(i.get('titre'), i.get('url'), i.get('source'), i.get('date'), i.get('resume'),
                extra={'tag': i.get('tag') or ''})

    # ── Journal officiel : ce qui touche les marges (generate_jo_marges.py) ──
    d = load('jo-marges.json')
    if d:
        lus.append('jo-marges.json')
        # ⚠️ Les textes du JO N'ENTRENT PAS dans le flux éditorial : ils ont leur
        # propre bloc « Ce qui touche tes marges », avec compte à rebours, et ils y
        # restent jusqu'à leur entrée en vigueur. Les mettre aussi dans « les 5 »
        # affichait le même arrêté trois fois sur la page. Une chose, un endroit.
        ctx['jo'] = d.get('items', [])

    # ── avis de prix CEPS au JO (generate_prix_futurs.py) ──
    d = load('prix-futurs.json')
    if d:
        lus.append('prix-futurs.json')
        ch = d.get('changes', [])
        ctx['prix_futurs'] = ch
        futures = [c for c in ch if c.get('date_effet') and days_until(c['date_effet']) >= 0]
        baisses = [c for c in futures if c.get('sens') == 'baisse']
        if baisses:
            proche = min(baisses, key=lambda c: days_until(c['date_effet']))
            add('%d baisse%s de prix publiée%s au Journal officiel, applicable%s à partir du %s'
                % (len(baisses), 's' if len(baisses) > 1 else '', 's' if len(baisses) > 1 else '',
                   's' if len(baisses) > 1 else '', fr_date(proche['date_effet'])),
                'https://www.legifrance.gouv.fr/jorf/jo', 'CEPS · Journal officiel',
                proche.get('date_publi') or TODAY.isoformat(),
                'Avis de prix du Comité économique des produits de santé. '
                + ', '.join(clean(c.get('d')) for c in baisses[:3]),
                kind='prix', extra={'effet': proche.get('date_effet') or ''})

    # ── baisses de prix déjà effectives dans la BDPM (generate_prix.py) ──
    d = load('prix.json')
    if d:
        lus.append('prix.json')
        ctx['prix'] = {'nDown': d.get('nDown', 0), 'nUp': d.get('nUp', 0),
                       'drops': (d.get('drops') or [])[:8], 'generated': d.get('generated')}
        n = d.get('nDown') or 0
        if n and days_ago(d.get('generated')) <= 2:
            add('%d prix public%s en baisse dans la base officielle des médicaments'
                % (n, 's' if n > 1 else ''),
                'https://base-donnees-publique.medicaments.gouv.fr/', 'BDPM · prix officiels',
                d.get('generated'),
                'Révision tarifaire constatée aujourd\'hui sur les prix publics.', kind='prix')

    # ── ruptures et tensions ANSM avec date de retour (generate_ansm_dispo.py) ──
    d = load('ansm-dispo.json')
    if d:
        lus.append('ansm-dispo.json')
        it = d.get('items', [])
        ctx['dispo'] = it
        neuves = [x for x in it if days_ago(x.get('since')) <= 1]
        ctx['ruptures_neuves'] = neuves[:20]
        if neuves:
            rup = [x for x in neuves if 'rupture' in norm(x.get('st'))]
            titre = ('%d nouvelle%s alerte%s de disponibilité signalée%s par l\'ANSM'
                     % (len(neuves), 's' if len(neuves) > 1 else '', 's' if len(neuves) > 1 else '',
                        's' if len(neuves) > 1 else ''))
            add(titre, 'https://ansm.sante.fr/disponibilites-des-produits-de-sante',
                'ANSM · Disponibilités', neuves[0].get('since'),
                ('Dont %d en rupture. ' % len(rup) if rup else '')
                + ', '.join(clean(x.get('dci') or x.get('spec')) for x in neuves[:4]),
                kind='rupture')

    # ── rappels de LOTS de médicaments (generate_rappels_lots.py) ──
    d = load('rappels-lots.json')
    if d:
        lus.append('rappels-lots.json')
        it = d.get('items', [])
        recents = [x for x in it if days_ago(x.get('d')) <= 7]
        ctx['rappels_lots'] = recents[:10]
        for x in recents[:6]:
            add('Rappel de lot · ' + clean(x.get('t')),
                x.get('u') or 'https://ansm.sante.fr/informations-de-securite',
                'ANSM · Rappel de lot', x.get('d'), x.get('motif'), kind='rappel')

    # ── avis HAS (remboursement) — mensuel (generate_has.py) ──
    d = load('has-avis.json')
    if d:
        lus.append('has-avis.json')
        it = d.get('items', [])
        neufs = [x for x in it if x.get('new') and days_ago(x.get('date')) <= 30]
        ctx['has'] = neufs[:10]

    # ── génériques et biosimilaires en approche (generate_ema_generiques.py) ──
    d = load('ema-generiques.json')
    if d:
        lus.append('ema-generiques.json')
        it = d.get('items', [])
        recents = [x for x in it if days_ago(x.get('opinion')) <= 45]
        ctx['ema'] = recents[:10]
        bios = [x for x in recents if x.get('type') == 'biosimilaire']
        if recents and days_ago(d.get('generated')) <= 7:
            add('%d générique%s ou biosimilaire%s en approche au niveau européen'
                % (len(recents), 's' if len(recents) > 1 else '', 's' if len(recents) > 1 else ''),
                'https://www.ema.europa.eu/en/medicines', 'EMA · avis favorables',
                d.get('generated'),
                'Avis favorables des 45 derniers jours%s : %s.'
                % (' dont %d biosimilaires' % len(bios) if bios else '',
                   ', '.join(clean(x.get('inn')) for x in recents[:5])),
                kind='ema')

    # ── demande : épidémiologie Sentinelles (generate_epidemio.py) ──
    d = load('epidemio.json')
    if d:
        lus.append('epidemio.json')
        ctx['epidemio'] = d.get('indicators', [])

    # ── demande : passages aux urgences par département (generate_odisse.py) ──
    d = load('odisse.json')
    if d:
        lus.append('odisse.json')
        ctx['odisse'] = d.get('pathologies', [])

    return E, ctx, lus


def fr_date(iso):
    MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
            'août', 'septembre', 'octobre', 'novembre', 'décembre']
    d = iso_day(iso)
    if not d:
        return iso or ''
    try:
        j = int(d[8:10])
        return '%s %s %s' % ('1er' if j == 1 else str(j), MOIS[int(d[5:7]) - 1], d[0:4])
    except Exception:
        return d


# ───────────────────────────── 2. REGROUPEMENT ─────────────────────────────

STOP = set('''le la les de des du un une et en au aux pour par sur dans avec sans
ce cette ces son sa ses leur leurs qui que quoi dont est sont a ont plus moins
vers chez nos notre vos votre il elle ils elles on se ne pas tout tous toute
toutes deux trois ans an nouveau nouvelle nouveaux nouvelles apres avant entre
selon face contre depuis lors alors ainsi encore aussi tres bien fait faire
etre avoir article lire suite'''.split())


def mots_cles(titre):
    """Le sac de mots significatifs d'un titre."""
    return set(m for m in norm(titre).split() if len(m) > 3 and m not in STOP)


def meme_sujet(a, b):
    """Deux titres parlent-ils du même sujet ?

    Un titre exact identique ne suffit pas : la presse reformule. « Tiers payant
    contre biosimilaires et hybrides 2026-34 » (FSPF), « Tiers payant contre
    biosimilaires : applicable au 1er septembre » (Vidal) et « Tiers payant et
    biosimilaires : 5 choses à savoir » (Le Moniteur) sont UN sujet.
    On compare donc le recouvrement des mots significatifs (Jaccard), avec un
    plancher en nombre absolu pour ne pas coller deux titres courts par hasard."""
    if not a or not b:
        return False
    inter = len(a & b)
    if inter < 2:
        return False
    jac = inter / float(len(a | b))
    return jac >= 0.42 or (inter >= 4 and jac >= 0.30)


def regroupe(entrees):
    """Un sujet = un cluster. Le représentant est l'entrée la plus autorisée."""
    groupes = []          # [(sac_de_mots, [entrées])]
    for e in entrees:
        sac = mots_cles(e['t'])
        place = False
        for g in groupes:
            if meme_sujet(sac, g[0]):
                g[1].append(e)
                # ⚠️ on n'élargit PAS le sac de mots du groupe : de proche en
                # proche, un groupe finirait par tout absorber. Le sujet reste
                # défini par le premier titre rencontré.
                place = True
                break
        if not place:
            groupes.append([sac, [e]])

    clusters = []
    for _sac, grp in groupes:
        # représentant : autorité de source, puis fraîcheur, puis résumé le plus fourni
        grp.sort(key=lambda e: (-src_poids(e['s']), days_ago(e['d']), -len(e.get('r') or '')))
        chef = dict(grp[0])
        srcs, vus = [], set()
        for e in grp:
            s = e['s']
            if s and s.lower() not in vus:
                vus.add(s.lower())
                srcs.append(s)
        chef['srcs'] = srcs
        chef['n_src'] = len(srcs)
        chef['liens'] = [{'s': e['s'], 'u': e['u']} for e in grp if e['u']][:4]
        # le résumé le plus informatif du groupe, même s'il vient d'une autre source
        best_r = max((e.get('r') or '' for e in grp), key=len)
        if len(best_r) > len(chef.get('r') or ''):
            chef['r'] = best_r
        # un « résumé » qui n'est que le titre recopié n'apporte rien (Google News)
        nt, nr = norm(chef['t']), norm(chef.get('r') or '')
        if nr and (nr.startswith(nt[:40]) or nt.startswith(nr[:40])):
            chef['r'] = ''
        chef['theme'] = theme_of(chef['t'] + ' ' + (chef.get('r') or ''), chef.get('tag') or '')
        clusters.append(chef)
    return clusters


# ───────────────────────────── 3. NOTATION ─────────────────────────────

RX_CHIFFRE = re.compile(r'\b\d+([.,]\d+)?\s?(%|€|euros?|millions?|milliards?)', re.I)


def note(c):
    """Score d'importance pour un grossiste-répartiteur. Tout est traçable."""
    pts, why = 0, []

    p = src_poids(c['s'])
    pts += p
    why.append(('source', p))

    p = THEME_POIDS.get(c['theme'], 4)
    pts += p
    why.append(('thème', p))

    j = days_ago(c['d'])
    p = 22 if j <= 0 else 12 if j == 1 else 5 if j <= 3 else 0 if j <= 7 else -8
    pts += p
    why.append(('fraîcheur', p))

    p = min(36, 9 * (c.get('n_src', 1) - 1))
    if p:
        pts += p
        why.append(('reprises', p))

    if RX_CHIFFRE.search(c['t'] + ' ' + (c.get('r') or '')):
        pts += 6
        why.append(('chiffré', 6))

    if c.get('effet'):
        d = days_until(c['effet'])
        if d is not None and 0 <= d <= 120:
            p = 14 if d <= 45 else 8
            pts += p
            why.append(('échéance', p))

    c['score'] = pts
    c['why'] = why
    return pts


# ───────────────────────────── 4. LES 5 QUI COMPTENT ─────────────────────────

def selection(clusters, n=5):
    """Le haut du panier, mais jamais 5 fois le même thème : on plafonne à 2 par
    thème tant qu'il reste de la diversité disponible."""
    tri = sorted(clusters, key=lambda c: (-c['score'], days_ago(c['d'])))
    retenus, compte = [], {}
    for c in tri:
        if len(retenus) >= n:
            break
        if compte.get(c['theme'], 0) >= 2:
            continue
        retenus.append(c)
        compte[c['theme']] = compte.get(c['theme'], 0) + 1
    # s'il n'y a pas assez de thèmes différents, on complète sans plafond
    if len(retenus) < n:
        for c in tri:
            if len(retenus) >= n:
                break
            if c not in retenus:
                retenus.append(c)
    return retenus


def redige(c):
    """Le bloc éditorial d'une entrée retenue. Rien d'inventé : le titre et le
    résumé viennent de la source, l'angle vient du thème, les faits sont extraits."""
    faits = []
    if c.get('effet'):
        d = days_until(c['effet'])
        if d == 0:
            faits.append("Applicable aujourd'hui")
        elif d > 0:
            faits.append('Applicable dans %d jour%s (%s)' % (d, 's' if d > 1 else '', fr_date(c['effet'])))
        else:
            faits.append('Applicable depuis le %s' % fr_date(c['effet']))
    if c.get('n_src', 1) > 1:
        faits.append('%d sources en parlent' % c['n_src'])
    m = RX_CHIFFRE.search(c['t'] + ' ' + (c.get('r') or ''))
    if m:
        faits.append(m.group(0).strip())
    return {
        't': c['t'],
        'r': c.get('r') or '',
        'u': c['u'],
        's': c['s'],
        'srcs': c.get('srcs', [])[:4],
        'liens': c.get('liens', []),
        'd': c['d'],
        'theme': c['theme'],
        'theme_l': THEME_LABEL.get(c['theme'], 'Autre'),
        'pour_toi': THEME_ANGLE.get(c['theme'], THEME_ANGLE['autre']),
        'faits': faits[:3],
        'score': c['score'],
    }


# ───────────────────────────── 5. LE RADAR ─────────────────────────────

def radar(ctx):
    """Les signaux chiffrés du jour. Chaque chiffre est MESURÉ sur un fichier,
    jamais écrit en dur, et porte la source qui l'a produit."""
    R = []

    dispo = ctx.get('dispo') or []
    if dispo:
        neuves = ctx.get('ruptures_neuves') or []
        rup = [x for x in dispo if 'rupture' in norm(x.get('st'))]
        R.append({'k': 'ruptures', 'v': len(dispo), 'l': 'produits en rupture ou tension',
                  'sub': '%d en rupture franche · %d signalé%s depuis hier'
                         % (len(rup), len(neuves), 's' if len(neuves) > 1 else ''),
                  'src': 'ANSM', 'ton': 'rose'})
        subst = [x for x in dispo if x.get('subst')]
        if subst:
            R.append({'k': 'substituables', 'v': len(subst),
                      'l': 'ont une alternative possible',
                      'sub': 'Autant de conversations à avoir au comptoir',
                      'src': 'ANSM', 'ton': 'green'})
        # retours attendus dans les 60 jours
        retours = []
        for x in dispo:
            r = x.get('retour') or {}
            iso = r.get('iso') or ''
            if re.match(r'^\d{4}-\d{2}$', iso):
                fin = date(int(iso[0:4]), int(iso[5:7]), 28)
                if 0 <= (fin - TODAY).days <= 60:
                    retours.append(x)
        if retours:
            R.append({'k': 'retours', 'v': len(retours), 'l': 'retours annoncés sous 60 jours',
                      'sub': 'Le stock revient : anticiper la reprise de commande',
                      'src': 'ANSM', 'ton': 'blue'})

    pf = ctx.get('prix_futurs') or []
    fut = [c for c in pf if c.get('date_effet') and days_until(c['date_effet']) >= 0]
    if fut:
        proche = min(fut, key=lambda c: days_until(c['date_effet']))
        R.append({'k': 'prix', 'v': len(fut), 'l': 'changements de prix déjà publiés',
                  'sub': 'Le plus proche : %s' % fr_date(proche['date_effet']),
                  'src': 'CEPS · JO', 'ton': 'amber'})

    jo = ctx.get('jo') or []
    avenir = [t for t in jo if t.get('date_effet') and days_until(t['date_effet']) >= 0]
    if avenir:
        proche = min(avenir, key=lambda t: days_until(t['date_effet']))
        d = days_until(proche['date_effet'])
        R.append({'k': 'jo', 'v': d, 'l': 'avant la prochaine échéance',
                  'sub': clean(proche.get('titre'))[:90],
                  'src': 'Journal officiel', 'ton': 'amber', 'unite': 'j'})

    epi = ctx.get('epidemio') or []
    hausse = [i for i in epi if (i.get('trend') or 0) >= 20]
    if hausse:
        top = max(hausse, key=lambda i: i.get('trend') or 0)
        R.append({'k': 'demande', 'v': int(top['trend']), 'l': '%s en hausse' % (top.get('label') or 'pathologie'),
                  'sub': '%s cas / 100 000 hab. cette semaine' % top.get('inc100'),
                  'src': 'Réseau Sentinelles', 'ton': 'rose', 'unite': '%'})

    lots = ctx.get('rappels_lots') or []
    if lots:
        R.append({'k': 'rappels', 'v': len(lots), 'l': 'rappels de lots cette semaine',
                  'sub': 'À retirer du circuit et signaler aux officines',
                  'src': 'ANSM', 'ton': 'amber'})

    ema = ctx.get('ema') or []
    if ema:
        bios = len([x for x in ema if x.get('type') == 'biosimilaire'])
        R.append({'k': 'ema', 'v': len(ema), 'l': 'génériques/biosimilaires en approche',
                  'sub': '%d biosimilaire%s · marchés qui s\'ouvrent' % (bios, 's' if bios > 1 else '') if bios
                         else 'Avis européens favorables, 45 derniers jours',
                  'src': 'EMA', 'ton': 'green'})

    return R[:6]


# ───────────────────────────── 6. ARCHIVE ─────────────────────────────

def archive(edition):
    """Une édition par jour, 120 jours. Idempotent : relancer le robot le même
    jour remplace l'édition du jour, il n'en crée pas une deuxième.
    ⚠️ On ne supprime jamais une édition passée — seulement celles hors fenêtre."""
    try:
        with open(ARCH, 'r', encoding='utf-8') as f:
            old = json.load(f)
        jours = old.get('jours', [])
    except Exception:
        jours = []

    fiche = {
        'd': edition['jour'],
        'une': edition['une']['t'] if edition.get('une') else '',
        'une_u': edition['une']['u'] if edition.get('une') else '',
        'titres': [{'t': x['t'], 'u': x['u'], 'theme': x['theme'], 's': x['s']}
                   for x in edition.get('cinq', [])],
        'n': edition['compte']['retenues'],
        'themes': edition.get('themes_du_jour', {}),
    }
    jours = [j for j in jours if j.get('d') != fiche['d']]
    jours.append(fiche)
    jours.sort(key=lambda j: j.get('d') or '', reverse=True)
    limite = (TODAY - timedelta(days=ARCHIVE_DAYS)).isoformat()
    jours = [j for j in jours if (j.get('d') or '') >= limite][:ARCHIVE_DAYS]

    with open(ARCH, 'w', encoding='utf-8') as f:
        json.dump({'maj': datetime.now(timezone.utc).isoformat(),
                   'n': len(jours), 'jours': jours}, f, ensure_ascii=False, separators=(',', ':'))
    return len(jours)


# ───────────────────────────── assemblage ─────────────────────────────

def main():
    print('── L\'édition du matin · %s' % TODAY.isoformat())
    entrees, ctx, lus = collecte()
    print('   %d fichiers lus : %s' % (len(lus), ', '.join(lus)))
    print('   %d entrées collectées' % len(entrees))

    if not entrees:
        # Un contrôle qui échoue ne condamne rien : on garde l'édition d'hier
        # plutôt que d'écraser avec du vide.
        sys.stderr.write('AUCUNE entrée collectée — édition précédente conservée.\n')
        return 1

    clusters = regroupe(entrees)
    print('   %d sujets après regroupement' % len(clusters))
    for c in clusters:
        note(c)

    # Le fil complet : fenêtre glissante, les plus importants d'abord
    fil = [c for c in clusters if days_ago(c['d']) <= FIL_DAYS]
    fil.sort(key=lambda c: (-c['score'], days_ago(c['d'])))

    retenus = selection(fil or clusters, 5)
    cinq = [redige(c) for c in retenus]
    une = cinq[0] if cinq else None

    # Le fil, c'est « tout le reste » : ce qui est déjà en haut n'y est pas répété.
    haut = set(id(c) for c in retenus)
    fil = [c for c in fil if id(c) not in haut]

    themes_du_jour = {}
    for c in fil:
        if days_ago(c['d']) <= 1:
            themes_du_jour[c['theme']] = themes_du_jour.get(c['theme'], 0) + 1

    edition = {
        'jour': TODAY.isoformat(),
        'genere': datetime.now(timezone.utc).isoformat(),
        'une': une,
        'cinq': cinq,
        'radar': radar(ctx),
        'fil': [{
            't': c['t'], 'u': c['u'], 's': c['s'], 'd': c['d'],
            'r': (c.get('r') or '')[:160], 'theme': c['theme'],
            'theme_l': THEME_LABEL.get(c['theme'], 'Autre'),
            'n_src': c.get('n_src', 1), 'srcs': c.get('srcs', [])[:3],
            'neuf': 1 if days_ago(c['d']) <= 1 else 0,
        } for c in fil[:60]],
        'themes_du_jour': themes_du_jour,
        'themes_l': THEME_LABEL,
        # rubriques dédiées, servies telles quelles à l'écran
        'jo': ctx.get('jo', []),
        'rappels_lots': ctx.get('rappels_lots', []),
        'rappels_para': ctx.get('rappels_para', []),
        'ruptures_neuves': [{
            'spec': clean(x.get('spec')), 'dci': clean(x.get('dci')), 'st': x.get('st'),
            'dom': x.get('dom'), 'subst': x.get('subst'),
            'retour': (x.get('retour') or {}).get('raw') or '', 'since': x.get('since'),
        } for x in (ctx.get('ruptures_neuves') or [])[:14]],
        'ema': ctx.get('ema', []),
        'compte': {
            'fichiers': len(lus), 'sources_lues': lus,
            'entrees': len(entrees), 'sujets': len(clusters), 'retenues': len(fil),
        },
    }

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(edition, f, ensure_ascii=False, separators=(',', ':'))
    n = archive(edition)

    print('   ✔ %s écrit — la une : « %s »' % (os.path.basename(OUT),
          (une['t'][:70] + '…') if une and len(une['t']) > 70 else (une['t'] if une else '—')))
    print('   ✔ %d chiffres au radar · %d entrées au fil · archive : %d éditions'
          % (len(edition['radar']), len(edition['fil']), n))
    return 0


if __name__ == '__main__':
    sys.exit(main())
