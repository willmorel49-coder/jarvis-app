#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
« L'édition du matin » — le rédacteur en chef de JARVIS.

Il lit d'abord ce que les autres robots ont déjà déposé dans crm/v2/ pendant la
nuit — c'est la couche qui manquait : la donnée existait, personne ne la
rassemblait — puis il va chercher six flux gratuits ILLUSTRÉS, et il ouvre chaque
article retenu pour en tirer son image et vérifier qu'il est lisible en entier.

Ce qu'il fait, dans l'ordre :
  1. COLLECTE     — 11 fichiers déjà produits (presse, ANSM, JO, CEPS, HAS, EMA,
                    épidémio, urgences, rappels, veille concurrents) + 6 flux
                    gratuits illustrés lus directement.
  1 bis. LIT LES ARTICLES — ouvre les pages retenues : illustration déclarée par
                    le site (og:image), vrai chapeau, temps de lecture, et surtout
                    « est-ce lisible en entier ? ». Les murs payants sortent.
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
import json, os, re, sys, unicodedata, html, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, date, timedelta

ROOT = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.join(ROOT, 'crm', 'v2')
OUT = os.path.join(V2, 'brief-jour.json')
ARCH = os.path.join(V2, 'brief-archive.json')

TODAY = date.today()
ARCHIVE_DAYS = 120        # ce que pharmalpha appelle « les archives »
FIL_DAYS = 21             # profondeur du fil complet (3 semaines glissantes)
N_ENRICHI = 54            # articles dont on va vraiment lire la page (image + chapeau)

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Version/17.4 Safari/605.1.15')

# ── Sources GRATUITES et ILLUSTRÉES, ajoutées le 01/09/2026 ────────────────────
# Will : « que le contenu soit pris de plusieurs sources et notamment des gratuites
# qu'on puisse lire en entier ». Les sources cœur de métier (USPO, FSPF, Leem,
# Le Pharmacien de France, ANSM) sont gratuites et complètes mais n'ont AUCUNE image
# dans leur flux. Celles-ci en ont une sur chaque article — vérifié le 01/09/2026,
# 3 articles par source, image ET absence de mur mesurées une par une.
# Elles sont grand public : filtre de pertinence STRICT, sinon le magazine se remplit
# de « quoi manger pour protéger son cerveau ».
FLUX_ILLUSTRES = [
    ('Sciences et Avenir', 'https://www.sciencesetavenir.fr/sante/rss.xml'),
    ('20 Minutes santé',   'https://www.20minutes.fr/feeds/rss-sante.xml'),
    ('Futura Santé',       'https://www.futura-sciences.com/rss/sante/actualites.xml'),
    ('Santé Magazine',     'https://www.santemagazine.fr/rss'),
    ('Réseau CHU',         'https://www.reseau-chu.org/feed/'),
    ('France Info santé',  'https://www.francetvinfo.fr/sante.rss'),
    # ── seconde vague, mesurée le 01/09/2026 au soir : vivantes, libres, illustrées.
    # Will : « l'idée c'est vraiment d'aller sur des sources gratuites pour récupérer
    # un max de données partout. »
    ('Mutualité française', 'https://www.mutualite.fr/feed/'),
    ('Infirmiers.com',      'https://www.infirmiers.com/rss.xml'),
    ('Inserm',              'https://www.inserm.fr/feed/'),
    ('Top Santé',           'https://www.topsante.com/rss'),
    ('BFM santé',           'https://www.bfmtv.com/rss/sante/'),
    # libres mais SANS image — gardées pour la matière, pas pour l'illustration
    ('OMS Europe',          'https://www.who.int/rss-feeds/news-english.xml'),
    ('CNRS',                'https://www.cnrs.fr/fr/rss.xml'),
    # troisième vague, mesurée le 02/09/2026 (2 articles ouverts par source)
    ('Nile',                'https://www.nile-consulting.eu/feed/'),      # politique du médicament, accès au marché
    ('Allo Docteurs',       'https://www.allodocteurs.fr/rss.xml'),
    ('Silver Eco',          'https://www.silvereco.fr/feed'),            # grand âge, EHPAD
    ('ANSES',               'https://www.anses.fr/fr/rss.xml'),          # sécurité sanitaire (sans image)
]
# ⛔ Mesurées derrière un mur payant le 01/09 : Le Parisien, Le Généraliste.
#    Mortes ou introuvables : Ordre des pharmaciens, Vidal, HAS, Doctissimo,
#    Pourquoi Docteur, Egora, Univadis, APM, Hospimedia, TIC Santé (404/403).
# Ce qui intéresse VRAIMENT un grossiste-répartiteur dans de la presse grand public.
REL_STRICT = re.compile(
    r'pharmaci|officin|m[ée]dicament|g[ée]n[ée]riqu|biosimil|rupture|p[ée]nurie|'
    r'rembours|d[ée]rembours|ordonnance|prescri|vaccin|automédication|'
    r'\bansm\b|\bceps\b|\bhas\b|assurance maladie|s[ée]curit[ée] sociale|'
    r'laboratoire pharma|industrie pharma|comptoir|substitu|tiers payant', re.I)
# ⚠️ « médicament » suffit à faire entrer du magazine-santé : « la vérité sur le
# cholestérol », « ce probiotique qui… ». Registre bien-être et putaclic = dehors.
HORS_SUJET = re.compile(
    r'r[ée]gime|perdre du poids|minceur|astuce|recette|aliment|superaliment|'
    r'probiotique|complément alimentaire|bien-[êe]tre|sommeil r[ée]parateur|'
    r'vous ne (devinerez|saviez)|voici pourquoi|la v[ée]rit[ée] sur|'
    r'ce que r[ée]v[èe]le|faut-il vraiment|horoscope|beaut[ée]|peau|cheveux', re.I)
MAX_GRAND_PUBLIC = 22   # la presse générale illustre, elle ne fait pas le journal

# ═══════════════════════════════════════════════════════════════════════════
# CE QU'ON NE DOIT JAMAIS RATER
# Will, 02/09/2026 : « il y a un article que je ne vois pas et pourtant ça devrait
# être l'un des plus importants, c'est la loi prévue pour la marge des grossistes en
# janvier 2027. On doit absolument pas passer à côté d'infos comme celle-là. Nos
# concurrents pareil, il faut qu'on soit au courant de leurs projets majeurs. »
#
# Deux familles d'information ne se noient PAS dans le fil : elles sont épinglées en
# tête, hors filtres, et une échéance y reste jusqu'à son entrée en vigueur.
#   1) ÉCHÉANCE — un texte officiel qui change l'argent d'Intégral (barème de marge,
#      remise, honoraire, TFR, clause de sauvegarde). Ce n'est pas une nouvelle du
#      jour, c'est une date qui arrive.
#   2) CONCURRENT — un répartiteur nommé + un mouvement structurant.
# ═══════════════════════════════════════════════════════════════════════════

# Les concurrents et voisins directs d'Intégral Pharma. Un nom seul ne suffit pas :
# il faut qu'il soit associé à un mouvement (voir MOUVEMENT).
CONCURRENTS = re.compile(
    r'\bocp\b|alliance healthcare|\bcerp\b|cerp rouen|cerp rrm|astera|'
    r'phoenix pharma|\bphoenix\b|sagitta|cophana|welcoop|giphar|\bcsrp\b|'
    r'\bocp r[ée]partition\b|teva sant[ée]|biogaran|viatris|sandoz|zentiva|arrow g[ée]n[ée]riques|'
    r'\beg labo\b|mylan|servier|sanofi|upsa|urgo|cooper|pierre fabre', re.I)
# Un mouvement structurant : ce qui engage l'entreprise, pas un communiqué de routine.
MOUVEMENT = re.compile(
    r'rachat|rach[èe]te|acquisition|acqui[eè]rt|fusion|fusionne|c[èe]de|cession|reprise|'
    r'ouvre|ouverture|inaugur|ferme|fermeture|d[ée]localis|restructur|plan social|'
    r'investi|investissement|lev[ée]e de fonds|entrep[oô]t|plateforme logistique|'
    r'nouveau site|partenariat|accord|alliance avec|s.associe|'
    r'nomination|nomm[ée]|directeur g[ée]n[ée]ral|pr[ée]sident|arriv[ée]e de|d[ée]part de|'
    r'r[ée]sultats annuels|chiffre d.affaires|perte|b[ée]n[ée]fice|redressement|liquidation|'
    r'strat[ée]gi|feuille de route|lance|lancement|d[ée]ploie|d[ée]ploiement|'
    r'renforce|renforcement|s.implante|implantation|se dote|'
    r'd[ée]veloppe|d[ée]veloppement|croissance|[ée]largit|[ée]tend|'
    r'nouvelle offre|nouveau service|cr[ée]e|cr[ée]ation|met en place|'
    r'contrat|march[ée] remport|appel d.offres', re.I)
# Ce qui touche l'ARGENT d'un grossiste-répartiteur dans un texte officiel.
ARGENT_IP = re.compile(
    r'marge|grossist|r[ée]partit|distribution en gros|remise|honorair|'
    r'prix et marges|tarif forfaitaire|\btfr\b|clause de sauvegarde|'
    r'plafond|coefficient|forfait par bo[iî]te|r[ée]mun[ée]ration', re.I)


# ═══ SANCTIONS & VIE DES SOCIÉTÉS ════════════════════════════════════════════
# Will, 02/09/2026 : « il faut qu'on soit au courant de tout, même des sanctions dont
# écopent certains grossistes ».
#
# ⚠️ LinkedIn a été écarté, et il faut le dire : pas de flux public, pas d'API gratuite,
#    et son règlement interdit l'aspiration. Un robot qui le scrape se fait bloquer en
#    quelques jours et nous met en tort. À la place, on va chercher les FAITS que les
#    publications LinkedIn ne font que commenter, à la source officielle :
#      · BODACC — les annonces légales : procédures collectives, ventes et cessions,
#        changements de dirigeants, radiations. Gratuit, sans clé, opendatasoft.
#      · ANSM — décisions de police sanitaire, suspensions, injonctions.
#      · la presse déjà collectée — condamnations, amendes, enquêtes.
#
# SIREN relevés le 02/09/2026 sur recherche-entreprises.api.gouv.fr (registre officiel).
# Pour en ajouter un : chercher le nom sur ce service et recopier le SIREN ici.
CONCURRENTS_SIREN = {
    # nom lisible                 SIREN        (nb d'annonces au registre, éprouvé le 02/09)
    'Phoenix OCP':                '582137436',   # 55
    'CERP':                       '493265284',   # 29  Cie d'exploitation et de répartition
    'Alliance Healthcare Répartition': '421218132',  # 33
    'Sagitta Pharma':             '534188941',   # 22
    'Welcoop Logistique':         '767800113',   # 30
    'Henry Schein France':        '390471985',   # 38
    'Air Liquide Santé France':   '379369465',   # 54
    'Centravet':                  '027250026',   # 39
}
# Les familles d'annonces qui disent quelque chose. « Dépôts des comptes » est du
# bruit annuel : on l'écarte.
BODACC_FAMILLES = {
    'Procédures collectives', 'Procédures de conciliation', 'Ventes et cessions',
    'Modifications diverses', 'Radiations', 'Créations',
}
BODACC_API = ('https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/'
              'datasets/annonces-commerciales/records')
BODACC_JOURS = 180        # une annonce légale est lente : on regarde six mois

# Une sanction, au sens large : ce qui coûte de l'argent ou l'autorisation d'exercer.
SANCTION = re.compile(
    r'sanction|amende|condamn|p[ée]nalit[ée]|injonction|mise en demeure|'
    r'suspension|suspendu|retrait d.(autorisation|agr[ée]ment)|interdiction|'
    r'police sanitaire|redressement judiciaire|liquidation judiciaire|sauvegarde|'
    r'perquisition|enqu[êe]te (pr[ée]liminaire|de la|ouverte)|poursuit|poursuivi|'
    r'tribunal|proc[èe]s|contentieux|manquement|non[- ]conformit[ée]|'
    r'rappel [àa] l.ordre|avertissement|blâme|radiation de l.ordre', re.I)


def bodacc(nom, siren):
    """Les annonces légales récentes d'une société. Rend [] au moindre pépin :
    ⚠️ une source qui ne répond pas ne doit jamais faire tomber l'édition."""
    limite = (TODAY - timedelta(days=BODACC_JOURS)).isoformat()
    try:
        u = (BODACC_API + '?where=' + urllib.parse.quote('registre like "%s"' % siren)
             + '&limit=20&order_by=dateparution%20desc')
        d = json.loads(http(u, 400000, 20))
    except Exception as e:
        sys.stderr.write('  (BODACC KO) %s : %s\n' % (nom, str(e)[:70]))
        return []
    out = []
    for r in d.get('results', []):
        fam = r.get('familleavis_lib') or ''
        dt = r.get('dateparution') or ''
        if fam not in BODACC_FAMILLES or dt < limite:
            continue
        detail = ''
        for cle in ('modificationsgenerales', 'depot', 'radiationaurcs', 'jugement', 'vente'):
            v = r.get(cle)
            if v:
                try:
                    v = json.loads(v) if isinstance(v, str) else v
                except Exception:
                    pass
                if isinstance(v, dict):
                    detail = clean(v.get('descriptif') or v.get('commentaire')
                                   or v.get('nature') or v.get('famille') or '')
                elif isinstance(v, str):
                    detail = clean(v)
                if detail:
                    break
        out.append({
            'nom': nom, 'societe': clean(str(r.get('commercant') or nom)),
            'famille': fam, 'date': dt, 'detail': detail,
            'ville': clean(str(r.get('ville') or '')),
            'url': 'https://www.bodacc.fr/pages/annonces-commerciales/?q=' + urllib.parse.quote(siren),
        })
    return out


# Un jugement qui compte, par opposition à la procédure courante (dépôt de créances,
# état des créances… : du bruit de greffe).
JUGEMENT_FORT = re.compile(
    r'ouverture d.une proc[ée]dure|liquidation judiciaire|redressement judiciaire|'
    r'plan de cession|conversion en liquidation|sauvegarde|cessation des paiements|'
    r'plan de redressement|clôture pour insuffisance', re.I)


def bodacc_secteur(n=8):
    """Qui, dans le circuit du médicament, est en difficulté ?
    C'est le signal le plus directement commercial de toute la veille : une officine
    en redressement, c'est un encours à surveiller ; un laboratoire en liquidation,
    c'est une rupture d'approvisionnement qui arrive."""
    limite = (TODAY - timedelta(days=75)).isoformat()
    out, vus = [], set()
    for mot, quoi in (('pharmacie', 'officine'), ('pharmaceutique', 'industrie'),
                      ('laboratoire', 'laboratoire')):
        w = ('familleavis_lib="Procédures collectives" and search(commercant,"%s") '
             'and dateparution>="%s"' % (mot, limite))
        try:
            d = json.loads(http(BODACC_API + '?where=' + urllib.parse.quote(w)
                                + '&limit=25&order_by=dateparution%20desc', 400000, 20))
        except Exception as e:
            sys.stderr.write('  (BODACC secteur KO) %s : %s\n' % (mot, str(e)[:60]))
            continue
        for r in d.get('results', []):
            j = r.get('jugement')
            try:
                j = json.loads(j) if isinstance(j, str) else (j or {})
            except Exception:
                j = {}
            nature = clean(j.get('nature') or j.get('famille') or '')
            if not JUGEMENT_FORT.search(nature):
                continue
            soc = clean(str(r.get('commercant') or ''))
            cle = norm(soc) + nature[:20]
            if not soc or cle in vus:
                continue
            vus.add(cle)
            out.append({'societe': soc, 'quoi': quoi, 'nature': nature,
                        'date': r.get('dateparution') or '',
                        'ville': clean(str(r.get('ville') or '')),
                        'url': 'https://www.bodacc.fr/pages/annonces-commerciales/?q='
                               + urllib.parse.quote(soc)})
    out.sort(key=lambda x: x['date'], reverse=True)
    return out[:n]


def epingle_de(e):
    """Cette entrée doit-elle être épinglée, et à quel titre ?"""
    txt = (e.get('t') or '') + ' ' + (e.get('r') or '') + ' ' + (e.get('resume') or '')
    if e.get('k') == 'bodacc':
        return 'societe'
    if e.get('k') == 'pcl':
        return 'difficulte'
    if e.get('k') in ('jo', 'prix'):
        if ARGENT_IP.search(txt) or e.get('effet'):
            return 'echeance'
    # une sanction qui touche un acteur du circuit passe avant tout le reste
    if SANCTION.search(txt) and (CONCURRENTS.search(txt) or
                                 re.search(r'grossist|r[ée]partit|[ée]tablissement pharmaceutique|'
                                           r'laboratoire|officine|pharmaci', txt, re.I)):
        return 'sanction'
    if CONCURRENTS.search(txt) and MOUVEMENT.search(txt):
        return 'concurrent'
    return ''


# ── Sources dont le mur payant a été MESURÉ le 01/09/2026 ─────────────────────
# 3 articles ouverts par source. On les écarte parce qu'un lien qu'on ne peut pas
# lire ne sert à rien (Will). ⚠️ Nécessaire parce que la veille concurrents passe
# par Google News, dont les liens sont des redirections JavaScript : impossible d'y
# lire quoi que ce soit, donc impossible de mesurer le mur au moment de la lecture.
# Le nom de la source est alors le seul signal fiable.
SOURCES_MUR = [
    'leparisien.fr', 'le parisien',
    'lemoniteurdespharmacies.fr', 'le moniteur des pharmacies', 'pharmacien manager',
    'lequotidiendupharmacien.fr', 'le quotidien du pharmacien',
    'lequotidiendumedecin.fr', 'le quotidien du m',
    'legeneraliste.fr', 'le g\u00e9n\u00e9raliste',
    'destinationsante.com', 'destination sant',
    'lesechos.fr', 'les echos', 'lefigaro.fr', 'le figaro',
    'latribune.fr', 'la tribune', 'letemps.ch', 'le temps',
    'liberation.fr', 'lib\u00e9ration', 'mediapart',
]


def source_au_mur(src):
    n = norm(src)
    return any(norm(m) in n for m in SOURCES_MUR)


# ── Le mur payant se MESURE sur la page, il ne se devine pas au nom du site ────
# Calibré le 01/09/2026 sur deux cas dont la réponse était connue d'avance :
# USPO (gratuit, 10 581 car.) et Le Moniteur (payant, « Réservé aux abonnés »).
# ⚠️ La LONGUEUR ne prouve rien : un article FSPF complet fait 1 046 caractères.
#    Seul un marqueur explicite condamne.
MUR = re.compile(
    r'r[ée]serv[ée] aux abonn[ée]s|article r[ée]serv[ée]|cet article est r[ée]serv|'
    r'votre inscription nous permet de contr[oô]ler le contenu|'
    r'pour (lire|poursuivre) la (suite|lecture).{0,60}(abonn|inscri|compte)', re.I)
# Habillage : ces phrases ne sont pas de l'article, elles ne comptent pas dans sa longueur.
HABILLAGE = re.compile(
    r'votre inscription nous permet|r[ée]serv[ée] aux abonn|d[ée]j[aà] abonn|'
    r'abonnez[- ]vous|cr[ée]ez? (un|votre) compte|connectez[- ]vous pour|'
    r'acc[eè]s illimit|offre d.essai|newsletter|accepter les cookies|'
    r'g[ée]rer mes choix|politique de confidentialit|'
    # navigation, pas rédaction : fil d'Ariane, articles voisins, barre de partage
    r'^accueil\s*[»>]|\s[»>]\s.*\s[»>]\s|lire la suite|[àa] lire aussi|voir aussi|'
    r'sur le m[êe]me (sujet|th[èe]me)|partager (sur|cet)|copier le lien|'
    r'mettre en favori|tous les articles|articles? (li[ée]s|similaires)|'
    r'suivez[- ]nous|inscrivez[- ]vous|'
    r'cotisation|bulletin d.adh[ée]sion|demande d.adh[ée]sion|espace adh[ée]rent|'
    r'profiter pleinement de vos avantages|nous vous invitons [àa] proc[ée]der', re.I)


def http(url, n=400000, t=12):
    r = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    return urllib.request.urlopen(r, timeout=t).read()[:n]


def og_image(pg):
    """L'illustration que le site déclare lui-même pour le partage."""
    for rx in (r'<meta[^>]+property=["\']og:image(?::url)?["\'][^>]+content=["\']([^"\']+)',
               r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
               r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)'):
        m = re.search(rx, pg, re.I)
        if m:
            u = html.unescape(m.group(1)).strip()
            if u.startswith('//'):
                u = 'https:' + u
            if u.startswith('http') and not re.search(r'logo|placeholder|default|sprite|avatar', u, re.I):
                return u
    return ''


def paragraphes(pg):
    """Les vrais paragraphes de l'article, habillage retiré."""
    pg = re.sub(r'<(script|style|nav|header|footer|aside|form)[^>]*>.*?</\1>', ' ', pg, flags=re.S | re.I)
    out = []
    for p in re.findall(r'<p[^>]*>(.*?)</p>', pg, re.S | re.I):
        t = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', p))).strip()
        if len(t) > 80 and not HABILLAGE.search(t):
            out.append(t)
    return out


# ── Ce qui fait qu'une phrase mérite d'être retenue ──────────────────────────
# Will (02/09/2026) : « qu'on puisse synthétiser l'info importante rapidement ».
# On ne génère pas de texte : on CHOISIT, dans l'article lui-même, les phrases qui
# portent l'information. Déterministe, gratuit, et rien n'est inventé.
PORTEUSE = re.compile(
    r'marge|grossist|r[ée]partit|rembours|d[ée]rembours|prix|tarif|honorair|'
    r'g[ée]n[ée]riqu|biosimil|substitu|rupture|tension|p[ée]nurie|officin|pharmaci|'
    r'\bansm\b|\bceps\b|\bhas\b|\bcnam\b|assurance maladie|arr[êe]t[ée]|d[ée]cret|'
    r'entr(e|era) en vigueur|[àa] compter du|d[èe]s le|obligat|interdi|autoris|'
    r'plafond|seuil|baisse|hausse|augment|[ée]conomie|budget|patient|d[ée]livr', re.I)
BAVARDE = re.compile(
    r'^(en effet|par ailleurs|de plus|enfin|ainsi|c\'est pourquoi|autrement dit|'
    r'rappelons|pour rappel|selon lui|selon elle|il a ajout|elle a ajout)', re.I)
RX_NOMBRE = re.compile(r'\b\d+([.,]\d+)?\s?(%|€|euros?|millions?|milliards?|jours?|mois|ans?)\b', re.I)


def phrases(txt):
    """Découpe en phrases, sans casser sur les abréviations courantes."""
    t = re.sub(r'\b(M|Mme|Dr|Pr|art|cf|ex|n°|etc)\.', lambda m: m.group(1) + '§', txt)
    out = []
    for ph in re.split(r'(?<=[.!?])\s+(?=[A-ZÀÂÉÈÊÎÔÙÜÇ«"])', t):
        ph = ph.replace('§', '.').strip()
        if ph:
            out.append(ph)
    return out


def resume_extractif(paras, n=3, titre=''):
    """Les n phrases qui portent le plus d'information, dans l'ordre du texte.
    ⚠️ Ce sont des CITATIONS de l'article, jamais sa republication : on en garde
       trois phrases, l'article complet reste chez son éditeur."""
    mots_titre = set(m for m in norm(titre).split() if len(m) > 4 and m not in STOP)
    ph = []
    for i, para in enumerate(paras[:12]):
        for j, x in enumerate(phrases(para)):
            if HABILLAGE.search(x):
                continue
            # la phrase parle-t-elle du sujet ? (mot du titre) ou du métier ?
            mots = set(norm(x).split())
            if not (mots & mots_titre) and not PORTEUSE.search(x):
                continue
            ph.append((len(ph), x))
    if not ph:
        return []
    notes = []
    for rang, x in ph:
        n_car = len(x)
        pts = 0
        pts += max(0, 12 - rang * 1.4)                      # le haut de l'article porte l'essentiel
        pts += 9 if PORTEUSE.search(x) else 0               # vocabulaire qui compte pour Intégral
        pts += 7 if RX_NOMBRE.search(x) else 0              # une phrase chiffrée dit quelque chose
        pts += 5 if 80 <= n_car <= 240 else (-6 if n_car < 60 or n_car > 330 else 0)
        pts -= 8 if BAVARDE.match(x) else 0                 # phrase de liaison, pas d'information
        pts -= 6 if x.count('"') + x.count('«') else 0      # citation de personne : rarement le fait
        notes.append((pts, rang, x))
    notes.sort(key=lambda t: -t[0])
    gardees = sorted(notes[:n], key=lambda t: t[1])         # on rétablit l'ordre du texte
    return [phrase(x, 260) for _, _, x in gardees]


def chiffres_cles(paras, n=3):
    """Les nombres qui comptent, avec le bout de phrase qui les explique."""
    vus, out = set(), []
    for para in paras[:10]:
        for m in RX_NOMBRE.finditer(para):
            val = re.sub(r'\s+', ' ', m.group(0)).strip()
            if val.lower() in vus:
                continue
            deb = max(0, m.start() - 70)
            ctx = para[deb:m.end() + 70]
            ctx = ctx[ctx.find(' ') + 1:] if deb else ctx           # on ne coupe pas un mot
            vus.add(val.lower())
            out.append({'v': val, 'c': phrase(ctx, 120)})
            if len(out) >= n:
                return out
    return out


def lire_article(url, titre=''):
    """Va lire la page. Rend l'image, le chapeau, la longueur et le verdict mur.
    ⚠️ Un échec ne condamne RIEN : on rend verif=0 et l'article est gardé."""
    try:
        pg = http(url).decode('utf-8', 'ignore')
    except Exception:
        return {'verif': 0}
    ps = paragraphes(pg)
    n = sum(len(p) for p in ps)
    return {
        'verif': 1,
        'img': og_image(pg),
        'car': n,
        'mn': max(1, int(round(n / 1400.0))),      # ~250 mots/min
        'chapeau': phrase(ps[0], 300) if ps else '',
        'points': resume_extractif(ps, 3, titre),   # les 3 phrases qui portent l'info
        'chiffres': chiffres_cles(ps),             # les nombres, avec leur contexte
        'mur': 1 if MUR.search(pg) else 0,
    }


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
    # RFC-822, le format de tous les flux RSS : « Tue, 01 Sep 2026 14:31:32 +0200 »
    m = re.search(r'(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})', s, re.I)
    if m:
        MOIS = {'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12}
        return '%s-%02d-%02d' % (m.group(3), MOIS[m.group(2)[:3].lower()], int(m.group(1)))
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
    # filet de dernier recours : ça parle de soin ou de traitement, mais ni de prix,
    # ni de marge, ni de rupture. C'est de la culture métier, pas du fourre-tout.
    ('sante', re.compile(
        r'm[ée]dicament|traitement|patient|maladie|sant[ée]|soin|th[ée]rapie|'
        r'vaccin|d[ée]pistage|[ée]pid[ée]mi|virus|cancer|diab[èe]te|molécule', re.I)),
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
    'sante':        'Santé & traitements',
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
    'sante':        'De quoi parler au comptoir — la culture métier qui fait la différence.',
    'autre':        'Signalé par la veille du secteur.',
}

THEME_POIDS = {
    'marge': 30, 'remboursement': 24, 'generique': 20, 'rupture': 18,
    'concurrence': 18, 'officine': 12, 'securite': 12, 'industrie': 6,
    'sante': 5, 'autre': 4,
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
        # ⚠️ Le 01/09 ces textes étaient EXCLUS du flux : ils avaient leur bloc à eux.
        # Ce bloc a été retiré le 02/09 — et l'arrêté qui fait passer la marge grossiste
        # à 0,22 € au 20/01/2027 a disparu de l'écran avec lui. Ils reviennent donc dans
        # la collecte, et leur place est le bandeau épinglé, pas le fil.
        ctx['jo'] = d.get('items', [])
        for t in ctx['jo']:
            add(t.get('titre'), t.get('url'), 'Journal officiel', t.get('jo'),
                t.get('resume') or ' · '.join(t.get('motifs') or []),
                kind='jo', extra={'effet': t.get('date_effet') or ''})

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

    # ── Flux gratuits et ILLUSTRÉS (lus directement ici) ──────────────────────
    # Ils apportent ce que les sources syndicales n'ont pas : une image par article.
    # Presse grand public → filtre STRICT, on ne garde que ce qui touche le médicament,
    # l'officine ou le remboursement.
    n_ill = 0
    for source, url in FLUX_ILLUSTRES:
        try:
            raw = http(url, 300000)
            i = raw.find(b'<?xml')
            if i < 0:
                i = max(raw.find(b'<rss'), raw.find(b'<feed'))
            root = ET.fromstring(raw[i:] if i > 0 else raw)
            NS = {'a': 'http://www.w3.org/2005/Atom'}
            for it in (root.findall('.//item') or root.findall('.//a:entry', NS))[:25]:
                g = lambda t: (it.find(t).text if it.find(t) is not None else '')
                titre = clean(g('title') or g('{http://www.w3.org/2005/Atom}title'))
                desc = clean(g('description') or g('{http://purl.org/rss/1.0/modules/content/}encoded'))
                if not REL_STRICT.search(titre + ' ' + desc):
                    continue
                if HORS_SUJET.search(titre):
                    continue
                if n_ill >= MAX_GRAND_PUBLIC:
                    break
                lien = (g('link') or '').strip()
                if not lien:
                    a = it.find('a:link', NS)
                    lien = a.get('href') if a is not None else ''
                add(titre, lien, source, g('pubDate') or g('published') or g('a:updated'), desc)
                n_ill += 1
            lus.append(source)
        except Exception as e:
            sys.stderr.write('  (flux illustré KO) %s : %s\n' % (source, str(e)[:70]))
    if n_ill:
        print('   %d articles illustrés retenus sur les %d flux grand public'
              % (n_ill, len(FLUX_ILLUSTRES)))

    # ── BODACC : la vie légale des concurrents ────────────────────────────────
    # Ce que LinkedIn commente, le registre le dit avant, et sans filtre.
    vies = []
    try:
        with ThreadPoolExecutor(max_workers=6) as ex:
            for lot in ex.map(lambda kv: bodacc(kv[0], kv[1]), CONCURRENTS_SIREN.items()):
                vies.extend(lot)
        vies.sort(key=lambda v: v['date'], reverse=True)
        ctx['societes'] = vies[:12]
        lus.append('BODACC')
        for v in vies[:12]:
            add('%s · %s' % (v['societe'], v['famille']), v['url'], 'BODACC · annonces légales',
                v['date'], v['detail'] or v['famille'], kind='bodacc',
                extra={'societe_de': v['nom']})
        print('   %d annonce%s légale%s sur %d concurrents suivis (BODACC, %d derniers jours)'
              % (len(vies), 's' if len(vies) > 1 else '', 's' if len(vies) > 1 else '',
                 len(CONCURRENTS_SIREN), BODACC_JOURS))
    except Exception as e:
        sys.stderr.write('  (BODACC global KO) %s\n' % str(e)[:80])

    # ── Qui, dans le circuit, est en difficulté ? ─────────────────────────────
    try:
        diff = bodacc_secteur()
        ctx['difficultes'] = diff
        for v in diff:
            add('%s — %s' % (v['societe'], v['nature']), v['url'],
                'BODACC · procédure collective', v['date'],
                'Jugement publié au BODACC%s.' % (' · ' + v['ville'] if v['ville'] else ''),
                kind='pcl', extra={'quoi': v['quoi']})
        if diff:
            lus.append('BODACC procédures')
            print('   %d procédure%s collective%s dans le circuit du médicament (75 derniers jours)'
                  % (len(diff), 's' if len(diff) > 1 else '', 's' if len(diff) > 1 else ''))
    except Exception as e:
        sys.stderr.write('  (BODACC secteur global KO) %s\n' % str(e)[:80])

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
        # une épingle posée sur N'IMPORTE quelle entrée du groupe vaut pour le groupe
        for e in grp:
            m = epingle_de(e)
            if m:
                chef['epingle'] = m
                if e.get('effet') and not chef.get('effet'):
                    chef['effet'] = e['effet']
                if e.get('paywall'):
                    chef['paywall'] = 1
                break
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

    if c.get('verif') and not c.get('mur'):
        p = 6 + (6 if c.get('img') else 0) + (4 if (c.get('car') or 0) >= 2500 else 0)
        pts += p
        why.append(('lisible en entier', p))

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
        # le chapeau LU sur la page vaut mieux que le résumé du flux, souvent tronqué
        'r': c.get('chapeau') or c.get('r') or '',
        'img': c.get('img', ''),
        'mn': c.get('mn', 0),
        'points': c.get('points', []),
        'chiffres': c.get('chiffres', []),
        'entier': 1 if (c.get('verif') and not c.get('mur')) else 0,
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

    # ⚠️ ARBITRAGE, 02/09/2026. Une source payante est écartée du mur : un lien qu'on
    # ne peut pas lire n'y sert à rien. MAIS pour une échéance réglementaire ou un
    # mouvement de concurrent, **savoir que ça existe prime sur pouvoir tout lire** —
    # « Astera renforce son offre » venait du Moniteur et disparaissait en silence.
    # Ces entrées-là restent, marquées « accès abonné », et vont au bandeau épinglé.
    avant = len(entrees)
    gardees, payantes_epinglees = [], 0
    for e in entrees:
        if not source_au_mur(e['s']):
            gardees.append(e)
        elif epingle_de(e):
            e['paywall'] = 1
            gardees.append(e)
            payantes_epinglees += 1
    entrees = gardees
    if len(entrees) < avant:
        print('   %d entrées écartées : source derrière un mur payant (mesuré)%s'
              % (avant - len(entrees),
                 ' — %d gardée(s) car épinglée(s)' % payantes_epinglees if payantes_epinglees else ''))

    clusters = regroupe(entrees)
    print('   %d sujets après regroupement' % len(clusters))
    for c in clusters:
        note(c)

    # Le fil complet : fenêtre glissante, les plus importants d'abord
    fil = [c for c in clusters if days_ago(c['d']) <= FIL_DAYS]
    fil.sort(key=lambda c: (-c['score'], days_ago(c['d'])))

    # ── ON VA LIRE LES ARTICLES ────────────────────────────────────────────────
    # Jusqu'ici on ne connaissait d'un article que ce que son flux voulait bien
    # dire. On ouvre maintenant la page elle-même : l'illustration que le site
    # déclare, le vrai chapeau, le temps de lecture — et surtout la réponse à la
    # question de Will : « est-ce qu'on peut le lire en entier ? »
    a_lire = [c for c in fil[:N_ENRICHI]
              if c.get('u', '').startswith('http') and 'news.google.com' not in c['u']
              and not c.get('paywall')]
    if a_lire:
        with ThreadPoolExecutor(max_workers=8) as ex:
            for c, r in zip(a_lire, ex.map(lambda x: lire_article(x['u'], x.get('t', '')), a_lire)):
                c.update(r)
        # ⚠️ Beaucoup de sites déclarent leur LOGO en og:image faute d'illustration
        # (USPO le fait sur tous ses articles). Résultat à l'écran : le même visuel
        # répété six fois, ce qui fait plus pauvre que pas d'image du tout.
        # Règle : une image vue sur 3 articles ou plus n'illustre rien, c'est un logo.
        vues = {}
        for c in a_lire:
            if c.get('img'):
                vues[c['img']] = vues.get(c['img'], 0) + 1
        logos = set(u for u, n in vues.items() if n >= 3)
        if logos:
            n_l = 0
            for c in a_lire:
                if c.get('img') in logos:
                    c['img'] = ''
                    n_l += 1
            print('   %d images écartées : le même visuel sur %d articles = un logo, pas une illustration'
                  % (n_l, max(vues[u] for u in logos)))

        lus_ok = [c for c in a_lire if c.get('verif')]
        avec_img = [c for c in lus_ok if c.get('img')]
        murs = [c for c in lus_ok if c.get('mur')]
        print('   %d articles ouverts · %d illustrés · %d derrière un mur payant'
              % (len(lus_ok), len(avec_img), len(murs)))
        # Un mur PROUVÉ sort du magazine : un lien qu'on ne peut pas lire ne sert
        # à rien (Will, 01/09/2026). ⚠️ Une lecture qui ÉCHOUE ne condamne pas :
        # verif=0 reste dans le fil, simplement sans image.
        fil = [c for c in fil if not c.get('mur')]
        # ⚠️ On renote APRÈS avoir lu : la prime « lisible en entier » n'existe
        # qu'une fois la page ouverte. Sans ce second passage, elle ne comptait
        # jamais — les notes étaient déjà figées.
        for c in fil:
            note(c)
        fil.sort(key=lambda c: (-c['score'], days_ago(c['d'])))

    # Une entrée sans page à ouvrir (agrégat ANSM, EMA, avis CEPS, lien Google News)
    # a quand même un texte : on le découpe pour qu'elle ne reste pas muette.
    for c in fil:
        if not c.get('points') and (c.get('r') or ''):
            c['points'] = [phrase(x, 260) for x in phrases(c['r'])[:3] if len(x) > 40]

    retenus = selection(fil or clusters, 5)
    cinq = [redige(c) for c in retenus]
    une = cinq[0] if cinq else None

    # Le fil, c'est « tout le reste » : ce qui est déjà en haut n'y est pas répété.
    haut = set(id(c) for c in retenus)
    fil = [c for c in fil if id(c) not in haut]

    # ═══ CE QU'ON NE DOIT JAMAIS RATER ═══════════════════════════════════════
    # Les épingles ne suivent PAS la fenêtre de 21 jours : une échéance reste tant
    # qu'elle n'est pas entrée en vigueur, même si le texte est paru il y a 3 mois.
    epingles = []
    for c in clusters:
        m = c.get('epingle')
        if not m:
            continue
        if m == 'echeance':
            eff = c.get('effet') or ''
            j = days_until(eff) if eff else None
            # on garde : ce qui arrive, et ce qui vient tout juste de s'appliquer
            if eff and j is not None and j < -30:
                continue
            if not eff and days_ago(c['d']) > 120:
                continue
            c['jours'] = j
        elif m in ('societe', 'difficulte'):
            if days_ago(c['d']) > BODACC_JOURS:
                continue
            c['jours'] = None
        else:
            if days_ago(c['d']) > 30:      # un mouvement concurrent vieux d'un mois n'est plus un signal
                continue
            c['jours'] = None
        epingles.append(c)
    # échéances d'abord (la plus proche en tête), puis les concurrents, les plus frais devant
    ORDRE_EP = {'echeance': 0, 'sanction': 1, 'societe': 2, 'difficulte': 3, 'concurrent': 4}

    def rang_ep(c):
        j = c.get('jours')
        if c['epingle'] != 'echeance':
            return (2 + ORDRE_EP.get(c['epingle'], 3), days_ago(c['d']), 0)
        if j is not None and j >= 0:
            return (0, j, 0)            # ce qui arrive, le plus proche d'abord
        return (1, -(j or 0), 0)        # ce qui vient de s'appliquer, le plus récent d'abord
    epingles.sort(key=rang_ep)
    epingles = epingles[:10]
    print('   %d information%s épinglée%s : %s'
          % (len(epingles), 's' if len(epingles) > 1 else '', 's' if len(epingles) > 1 else '',
             ' | '.join('%s %s' % (c['epingle'], c['t'][:38]) for c in epingles) or '—'))

    # ⚠️ LE GARDE-FOU. Le 02/09/2026, l'arrêté de la marge grossiste au 20/01/2027 a
    # disparu de l'écran sans que rien ne le signale. Désormais : toute échéance encore
    # à venir dans jo-marges.json DOIT se retrouver épinglée, sinon le robot échoue.
    attendues = [t for t in (ctx.get('jo') or [])
                 if t.get('date_effet') and days_until(t['date_effet']) >= 0]
    titres_ep = ' | '.join(norm(c['t']) for c in epingles)
    manquantes = [t for t in attendues if norm(t['titre'])[:60] not in titres_ep]
    if manquantes:
        sys.stderr.write('ÉCHÉANCE PERDUE — %d texte(s) du JO encore à venir ne sont pas épinglés :\n'
                         % len(manquantes))
        for t in manquantes:
            sys.stderr.write('  · %s (effet %s)\n' % (t['titre'][:90], t['date_effet']))
        return 2

    themes_du_jour = {}
    for c in fil:
        if days_ago(c['d']) <= 1:
            themes_du_jour[c['theme']] = themes_du_jour.get(c['theme'], 0) + 1

    edition = {
        # l'ordre d'affichage des rubriques : de ce qui touche l'argent d'Intégral
        # au plus culturel. Trier par volume mettrait « Autre » en tête.
        'themes_ordre': ['marge', 'remboursement', 'generique', 'rupture', 'concurrence',
                         'officine', 'securite', 'industrie', 'sante', 'autre'],
        'jour': TODAY.isoformat(),
        'genere': datetime.now(timezone.utc).isoformat(),
        'une': une,
        'cinq': cinq,
        'radar': radar(ctx),
        'epingles': [{
            't': c['t'], 'u': c['u'], 's': c['s'], 'd': c['d'],
            'r': (c.get('chapeau') or c.get('r') or '')[:240],
            'motif': c['epingle'], 'effet': c.get('effet') or '', 'jours': c.get('jours'),
            'societe': c.get('societe_de') or '',
            'theme': c['theme'], 'theme_l': THEME_LABEL.get(c['theme'], 'Autre'),
            'points': c.get('points', []), 'chiffres': c.get('chiffres', []),
            'srcs': c.get('srcs', [])[:3], 'n_src': c.get('n_src', 1),
            'img': c.get('img', ''), 'mn': c.get('mn', 0),
            'paywall': 1 if c.get('paywall') else 0,
            'pour_toi': THEME_ANGLE.get(c['theme'], THEME_ANGLE['autre']),
        } for c in epingles],
        'fil': [{
            't': c['t'], 'u': c['u'], 's': c['s'], 'd': c['d'],
            'r': (c.get('chapeau') or c.get('r') or '')[:200], 'theme': c['theme'],
            'theme_l': THEME_LABEL.get(c['theme'], 'Autre'),
            'n_src': c.get('n_src', 1), 'srcs': c.get('srcs', [])[:3],
            'neuf': 1 if days_ago(c['d']) <= 1 else 0,
            'img': c.get('img', ''), 'mn': c.get('mn', 0), 'entier': 1 if (c.get('verif') and not c.get('mur')) else 0,
            'points': c.get('points', []), 'chiffres': c.get('chiffres', []),
        } for c in fil[:60] if not c.get('epingle')],
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
