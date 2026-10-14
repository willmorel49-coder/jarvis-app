#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Marge « Notre marge » par client x mois x famille — fichier PROTEGE `marge-clients.js` (14/10/2026).

CE QUE FAIT CE SCRIPT
Relit les tableurs de ventes (STATS/<CODE>_MM_AAAA.xlsx + STATS/hors-perimetre/) et estime, pour
chaque officine et chaque mois, la marge que l'entreprise garde, rangee par famille d'affichage
(p, p1, p2, i, c, fr, nr). Une seule estimation : celle de la direction.

LE PRINCIPE (une cascade, du plus sur au moins sur)
La direction compte la marge ligne par ligne (prix net moins son prix d'achat). Son prix d'achat n'est
lisible que sur une partie des lignes (colonne MARGETHEORIQUE) ; il est appris sur ces lignes puis
applique aux autres :
  1. lue            : la marge est dans la ligne ;
  2. prix d'achat   : appris sur le MEME produit, le MEME mois, au MEME prix brut ;
  3. prix d'achat   : appris sur le meme produit au meme prix brut, tous mois ;
  4. taux du produit: marge / prix net appris sur le produit ;
  5. repli          : generique et non rembourse = taux appris ; petit prix d'un laboratoire a
                      contrat = montant fixe ; sinon prix net moins prix fabricant retrouve depuis
                      le prix brut (bareme des grossistes, loi) ; sans prix brut : regle du Pilotage.
Les niveaux 2 a 4 sont appris PAR REGIME (2026 / 2027) : un prix d'achat de 2026 n'est jamais applique
a une vente de 2027 (reforme du 20/01/2027, arrete du 3 aout 2026).

CE QUI NE VIT PAS DANS LE DEPOT
Rien de prive ici : ni prix d'achat, ni taux appris, ni laboratoire, ni montant de la regle privee.
Les parametres prives sont dans ~/.config/jarvis/marge-direction-prive.json (illisible = code 3, rien
n'est ecrit). Le bareme des grossistes est une loi : il reste dans le code.

SORTIE (gitignoree, JAMAIS commitee) : marge-clients.js a la racine du depot.
  window.MARGE_CLIENTS = {v:1, fait, jusqua, mois, reserves, fam, c:[prenoms], o:[pharmacyId],
                          r:[[ci, oi, ym, ca, tot, p, p1, p2, i, c, fr, nr, caGen], ...]}
  ca = CA net HT de toutes les lignes (generiques compris) ; caGen = la part generique de ce CA
  (marge 0) ; tot = somme exacte des 7 familles apres arrondi au centime.
decouper_par_commercial.py en tire un fichier par jeu de commercial.

Usage : /usr/bin/python3 generate_marge_clients.py
Codes de sortie : 0 ok · 2 entree introuvable · 3 reglage prive illisible · 4 rien a apprendre ·
5 ecriture non verifiee.
"""
import ast
import datetime
import glob
import gzip
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import warnings
from collections import defaultdict
from multiprocessing import Pool

warnings.filterwarnings('ignore')
sys.dont_write_bytecode = True

BASE = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(BASE, 'marge-clients.js')
PRIVE = os.environ.get('JARVIS_MARGE_DIRECTION_PRIVE') or os.path.expanduser('~/.config/jarvis/marge-direction-prive.json')
CACHE = os.path.expanduser('~/.cache/jarvis-marge-clients')
ENTETE = '// ⚠️ NE JAMAIS COMMITER. Servi par adresse signée (Supabase).'
VERSION_CACHE = 'g2'

# ── Barème des grossistes (la LOI, publique) ───────────────────────────────────────────────────
# Prix grossiste (« brut », PGHT) = prix fabricant (PFHT) + max(plancher, 6,93 % du PFHT), la part
# proportionnelle étant plafonnée à 32,4996 € (6,93 % de 468,97 €). Le forfait froid s'ajoute au brut.
# Réforme du 20/01/2027 (arrêté du 03/08/2026) : plancher 0,30 -> 0,22 €, forfait froid 0,63 -> 0,80 €.
TAUX_GROSSISTE = 0.0693
PFHT_PLAFOND = 468.97
PLAFOND_PROPORTIONNEL = 32.4996                        # = 6,93 % de 468,97 €, arrondi comme le bareme
BRUT_PLAFOND = PFHT_PLAFOND + PLAFOND_PROPORTIONNEL    # 501,4696 : au-dela, brut - 32,4996
BAREME = {
    2026: {'plancher': 0.30, 'froid': 0.63},
    2027: {'plancher': 0.22, 'froid': 0.80},
}
for _r in BAREME.values():
    # Le plancher l'emporte tant que 6,93 % du PFHT lui reste inférieur : bascule du PFHT = plancher / 6,93 %
    # (2026 : 4,329 €, 2027 : 3,1746 €) ; en brut, la bascule est « bascule + plancher » (2026 : 4,629 €,
    # 2027 : 3,3946 €). Calculé, jamais recopié : changer le plancher recalcule les deux bornes.
    _r['bascule_pfht'] = _r['plancher'] / TAUX_GROSSISTE
    _r['seuil_brut'] = _r['bascule_pfht'] + _r['plancher']

# ── Règle publique du Pilotage (v2-pilotage.js, MARGE) : sert quand on ne connait pas le prix brut ──
PETIT, TAUX_INTER, CHER, COEF_NR = 0.12, 0.0304, 13.0, 1.03
PALIER_PETIT, PALIER_CHER = 4.33, 468.0
# 4e tranche de 2027 (Pilotage, marge_2027) : < 3,1746 € -> 0,088 €/boîte ; 3,1746 à 4,33 € -> 2,772 % du net.
BASCULE_2027, PETIT_2027, TAUX_ENTRE_2027 = 3.1746, 0.088, 0.02772
DEBUT_2027 = (2027, 1, 20)    # jour d'entrée en vigueur : une ligne datée à partir de là est du régime 2027
MOIS_2027 = 202702            # sans date de ligne : tout mois à partir de février 2027

FAM = ['p', 'p1', 'p2', 'i', 'c', 'fr', 'nr']
SOURCES_ENV = ('SOURCES', 'RATTACHEES', 'AVOIRS_EN_POSITIF', 'MOIS_LUS')


# ══════════════════════════════════════════════ fonctions pures (testées) ════════════════════════
def sa(v):
    """Minuscules sans accents, pour comparer des libellés."""
    return ''.join(c for c in unicodedata.normalize('NFD', str(v or '').strip().lower()) if unicodedata.category(c) != 'Mn')


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def cip13(v):
    if v is None:
        return ''
    s = str(v).strip()
    if s.endswith('.0'):
        s = s[:-2]
    return re.sub(r'\D', '', s)


def regime_ligne(date, ym):
    """2027 si la ligne est datée (PCVDATEEFFET) à partir du 20/01/2027 ; une ligne datée avant reste 2026 ;
    sans date lisible, on regarde le mois du fichier (février 2027 et après)."""
    if hasattr(date, 'year'):
        t = (date.year, date.month, date.day)
    else:
        m = re.match(r'\s*(\d{4})-(\d{2})-(\d{2})', str(date or ''))
        t = tuple(int(x) for x in m.groups()) if m else None
    if t:
        return 2027 if t >= DEBUT_2027 else 2026
    return 2027 if ym >= MOIS_2027 else 2026


def pf(B, froid, regime):
    """Prix fabricant retrouvé depuis le prix brut (barème des grossistes du régime), forfait froid retiré."""
    p = BAREME[regime]
    b = B - (p['froid'] if froid else 0.0)
    if b <= p['seuil_brut']:
        return b - p['plancher']
    if b <= BRUT_PLAFOND:
        return b / (1 + TAUX_GROSSISTE)
    return b - PLAFOND_PROPORTIONNEL


class Listes:
    """Listes de produits (CIP13) et montants. Rien d'autre n'entre dans le calcul."""

    def __init__(self, gen=(), nr=(), fr=(), privee=(), petit_su=0.0, petit_su_2027=0.0, labos=()):
        self.gen, self.nr, self.fr, self.privee = set(gen), set(nr), set(fr), set(privee)
        self.petit_su, self.petit_su_2027 = float(petit_su), float(petit_su_2027)
        self.labos = tuple(x.upper() for x in labos)

    def petit(self, regime):
        return self.petit_su_2027 if regime == 2027 else self.petit_su


def famille(cip, N, regime, L, rb=True):
    """Famille d'affichage EXCLUSIVE, par priorité : générique (None, marge 0) > nr > fr > prix net unitaire.
    « Non remboursé » = la ligne (ou le catalogue) n'est pas remboursable à TVA 2,1 % : même critère que la cascade
    de la direction (la liste Sagitta n'est plus dans le dépôt, 14/10/2026)."""
    if cip in L.gen:
        return None
    if not rb:
        return 6
    if cip in L.fr:
        return 5
    if N < PALIER_PETIT:
        if regime == 2027:
            return 1 if N < BASCULE_2027 else 2
        return 0
    return 3 if N < PALIER_CHER else 4


def ecran(g, L):
    """Repli quand le prix brut est inconnu (0) : règle publique du Pilotage, datée, + liste privée (montant fixe)."""
    off, reg, cle, B, N, rb, froid, gen, su, pos, a_mt, q, net, qN, mt = g
    cip = '' if cle.startswith('#') else cle
    if cip in L.gen:
        return 0.0
    if not rb:
        m = net * (1 - 1 / COEF_NR)
    elif N < PALIER_PETIT:
        if cip in L.privee:
            m = q * L.petit(reg)
        elif reg == 2027:
            m = q * PETIT_2027 if N < BASCULE_2027 else net * TAUX_ENTRE_2027
        else:
            m = q * PETIT
    elif N < PALIER_CHER:
        m = net * TAUX_INTER
    else:
        m = q * CHER
    if cip in L.fr:
        m += q * BAREME[reg]['froid']
    return m


class Cascade:
    """Prix d'achat de la direction, appris ligne à ligne puis appliqué aux autres lignes, par régime."""

    def __init__(self, L):
        self.L = L
        self.OM, self.OB, self.OC = {}, {}, {}   # (régime, produit, mois, brut) · (régime, produit, brut) · (régime, produit) -> [marge, boîtes, q×net]
        self.cat = {'gen': [0.0, 0.0], 'nr': [0.0, 0.0], 'bar': [0.0, 0.0]}
        self.TG = self.TNR = 0.0
        self.lignes_connues = 0

    def apprendre(self, g, ym):
        off, reg, cle, B, N, rb, froid, gen, su, pos, a_mt, q, net, qN, mt = g
        if not a_mt:
            return
        self.lignes_connues += 1
        k = 'gen' if gen else 'nr' if not rb else 'bar'
        self.cat[k][0] += mt
        self.cat[k][1] += net
        if not pos or not q:
            return
        for d, key in ((self.OM, (reg, cle, ym, B)), (self.OB, (reg, cle, B)), (self.OC, (reg, cle))):
            x = d.get(key)
            if x is None:
                x = d[key] = [0.0, 0.0, 0.0]
            x[0] += mt
            x[1] += q
            x[2] += qN

    def figer(self):
        """Taux appris des génériques et des non remboursés (repli). Faux = rien à apprendre."""
        if not self.cat['gen'][1] or not self.cat['nr'][1]:
            return False
        self.TG = self.cat['gen'][0] / self.cat['gen'][1]
        self.TNR = self.cat['nr'][0] / self.cat['nr'][1]
        return True

    @staticmethod
    def _somme(d, key):
        v = d.get(key)
        return v if v and v[1] > 0 and v[2] > 0 else None

    def marge(self, g, ym):
        """(marge, provenance) d'un groupe de lignes. Provenance : lue · prix d'achat · taux du produit · repli · ecran."""
        L = self.L
        off, reg, cle, B, N, rb, froid, gen, su, pos, a_mt, q, net, qN, mt = g
        cip = '' if cle.startswith('#') else cle
        if cip in L.gen:
            return 0.0, 'gen'
        if a_mt:
            return mt, 'lue'
        for d, key in ((self.OM, (reg, cle, ym, B)), (self.OB, (reg, cle, B))):
            s = self._somme(d, key)
            if s:
                return qN - q * (s[2] - s[0]) / s[1], "prix d'achat"
        s = self._somme(self.OC, (reg, cle))
        if s:
            return net * s[0] / s[2], 'taux du produit'
        if gen:
            return net * self.TG, 'repli'
        if not rb:
            return net * self.TNR, 'repli'
        if su and N < PALIER_PETIT:
            return q * L.petit(reg), 'repli'
        if B:
            return qN - q * pf(B, froid, reg), 'repli'
        return ecran(g, L), 'ecran'


def ajouter(lignes, cle, g, ym, cascade, L):
    """Ajoute un groupe de lignes à l'agrégat `lignes[(prénom, officine, ym)]` = 7 familles + ca + caGen.
    Rend la provenance de la marge (pour la mesure)."""
    off, reg, cle_p, B, N, rb, froid, gen, su, pos, a_mt, q, net, qN, mt = g
    cip = '' if cle_p.startswith('#') else cle_p
    x = lignes.get(cle)
    if x is None:
        x = lignes[cle] = [0.0] * 9      # 0..6 familles · 7 = ca · 8 = caGen
    x[7] += net
    f = famille(cip, N, reg, L, rb)
    if f is None:
        x[8] += net
        return 'gen', 0.0
    m, src = cascade.marge(g, ym)
    x[f] += m
    return src, m


def arrondir(lignes, c_idx, o_idx):
    """Lignes de sortie : [ci, oi, ym, ca, tot, p, p1, p2, i, c, fr, nr, caGen], montants au centime, tot = somme des 7 familles ARRONDIES."""
    out = []
    for (prenom, officine, ym), x in lignes.items():
        fam = [round(v, 2) for v in x[:7]]
        tot = round(sum(fam), 2)
        ca, cag = round(x[7], 2), round(x[8], 2)
        if ca == 0 and tot == 0 and cag == 0 and not any(fam):
            continue
        out.append([c_idx[prenom], o_idx[officine], ym, ca, tot] + fam + [cag])
    out.sort(key=lambda r: (r[0], r[1], r[2]))
    return out


# ───────────────────────────────────────────── format du fichier ─────────────────────────────────
def formater(d):
    """Texte du fichier. Une clé par ligne : `analyser` (ici et dans decouper_par_commercial) le relit sans moteur JS."""
    j = lambda v: json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    lignes = [ENTETE, "window.MARGE_CLIENTS = {v:%d, fait:'%s', jusqua:'%s'," % (d['v'], d['fait'], d['jusqua']),
              'mois:%s,' % j(d['mois']), 'reserves:%s,' % j(d['reserves']), 'fam:%s,' % j(d['fam']),
              'c:%s,' % j(d['c']), 'o:%s,' % j(d['o']), 'r:[']
    lignes.append(',\n'.join(j(r) for r in d['r']))
    lignes.append(']};')
    return '\n'.join(lignes) + '\n'


def analyser(texte):
    """Inverse de `formater`. Lève ValueError si le fichier n'a pas la forme attendue."""
    L = texte.split('\n')
    try:
        i = next(k for k, l in enumerate(L) if l.startswith('window.MARGE_CLIENTS = {v:'))
        m = re.match(r"window\.MARGE_CLIENTS = \{v:(\d+), fait:'([^']*)', jusqua:'([^']*)',$", L[i])
        d = {'v': int(m.group(1)), 'fait': m.group(2), 'jusqua': m.group(3)}
        for k, cle in enumerate(('mois', 'reserves', 'fam', 'c', 'o'), 1):
            assert L[i + k].startswith(cle + ':') and L[i + k].endswith(',')
            d[cle] = json.loads(L[i + k][len(cle) + 1:-1])
        assert L[i + 6] == 'r:['
        fin = next(k for k in range(len(L) - 1, i, -1) if L[k] == ']};')
        corps = L[i + 7:fin]
        d['r'] = [json.loads(l.rstrip(',')) for l in corps if l.strip()]
    except (StopIteration, AssertionError, AttributeError, IndexError, json.JSONDecodeError) as e:
        raise ValueError('marge-clients.js illisible (%s)' % e)
    return d


# ═══════════════════════════════════════════ entrées (disque) ════════════════════════════════════
def lire_prive():
    """Réglage privé, ou None s'il est illisible."""
    try:
        r = json.load(open(PRIVE, encoding='utf-8'))
        labos = [str(x) for x in r['laboratoires_contenant']]
        petit = float(r['petit_par_boite'])
        petit27 = float(r.get('petit_par_boite_2027', petit))
        res = {str(k): str(v) for k, v in (r.get('reserves') or {}).items()}
        assert labos and petit >= 0 and petit27 >= 0
        return {'labos': labos, 'petit': petit, 'petit_2027': petit27, 'reserves': res}
    except Exception:
        return None


def lire_wml_v2(chemin):
    """SOURCES, RATTACHEES, avoirs et mois lus (couples (année, mois)) DANS generate_wml_v2.py (non importable) : jamais de copie qui diverge."""
    src = open(chemin, encoding='utf-8').read()
    out = {}
    for node in ast.parse(src).body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name) \
                and node.targets[0].id in SOURCES_ENV:
            if node.targets[0].id == 'MOIS_LUS':   # une compréhension de liste : pas un littéral, on l'évalue sans rien d'autre que range
                out['MOIS_LUS'] = eval(compile(ast.Expression(node.value), chemin, 'eval'), {'__builtins__': {'range': range}})
            else:
                out[node.targets[0].id] = ast.literal_eval(node.value)
    manque = [k for k in SOURCES_ENV if k not in out]
    if manque:
        raise ValueError('generate_wml_v2.py : %s introuvable' % ', '.join(manque))
    return out


def lire_js_liste(chemin, variable, cle=None):
    """Liste de CIP13 d'un `window.<variable> = ...;` (liste directe, ou objet {cle:[...]})."""
    t = '\n'.join(l for l in open(chemin, encoding='utf-8').read().split('\n') if not l.lstrip().startswith('//'))   # commentaires de ligne
    t = t[t.index('window.' + variable):]
    t = t[t.index('=') + 1:].strip()
    debut = t.index('{' if cle else '[')
    v = json.JSONDecoder().raw_decode(t[debut:])[0]
    return v[cle] if cle else v


def premier_existant(*chemins):
    for c in chemins:
        if c and os.path.exists(c):
            return c
    return None


def lire_catalogue(stats):
    """Catalogue produit : CIP13 -> (sous-famille, nature, laboratoire, afmcode). Source : STATS/stock POS.xlsx, puis
    le plus ancien tarif en complément. Valeurs #N/A ou vides = None."""
    import openpyxl
    cat = {}
    sources = [os.path.join(stats, 'stock POS.xlsx'), os.path.join(stats, 'stock et prix 22 06 2026.xlsx')]
    utilises = []
    for p in sources:
        if not os.path.exists(p):
            continue
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
        it = wb.active.iter_rows(values_only=True)
        h = [str(x).strip().lower() if x is not None else '' for x in next(it)]
        need = ('artcodebarre', 'artsousfamille', 'artnature', 'artcollection', 'afmcode')
        if any(n not in h for n in need):
            wb.close()
            continue
        ix = [h.index(n) for n in need]
        n0 = len(cat)
        for r in it:
            c = cip13(r[ix[0]] if ix[0] < len(r) else None)
            if not c or c in cat:
                continue
            vals = []
            for i in ix[1:]:
                v = r[i] if i < len(r) else None
                vals.append(None if v is None or str(v).strip() in ('', '#N/A') else str(v).strip())
            cat[c] = tuple(vals)
        wb.close()
        utilises.append('%s (+%d)' % (os.path.basename(p), len(cat) - n0))
    return cat, utilises


def signature_fichiers(*chemins):
    return '|'.join('%s:%s:%d' % (os.path.basename(c), os.stat(c).st_size, int(os.stat(c).st_mtime)) for c in chemins if c and os.path.exists(c))


# ══════════════════════════════════════════ lecture des tableurs (workers) ═══════════════════════
_G = {}


def _init_worker(chemin_cat, labos, avoirs):
    with open(chemin_cat, encoding='utf-8') as f:
        _G['cat'] = {k: tuple(v) for k, v in json.load(f).items()}
    _G['labos'] = tuple(labos)
    _G['avoirs'] = set(avoirs)


def lire_fichier(tache):
    """Un tableur -> fichier de cache (groupes de lignes, JSON compressé). Rend (chemin du cache, nb de lignes lues)."""
    comm, prefix, chemin, garder, ym, sig = tache
    st = os.stat(chemin)
    nom = '%s_%d_%s_%d_%d_%s.json.gz' % (prefix, ym, hashlib.md5((chemin + '|' + ','.join(garder or [])).encode()).hexdigest()[:8],
                                          st.st_size, int(st.st_mtime), sig)
    fc = os.path.join(CACHE, nom)
    if os.path.exists(fc):
        return fc, -1
    import openpyxl
    from pont_officines import code_officine
    cat, labos, avoirs = _G['cat'], _G['labos'], _G['avoirs']
    wb = openpyxl.load_workbook(chemin, read_only=True, data_only=True)
    it = wb.active.iter_rows(values_only=True)
    h = [str(x).strip() if x is not None else '' for x in next(it)]
    hi = {k: i for i, k in enumerate(h)}

    def c(r, k):
        i = hi.get(k)
        return r[i] if (i is not None and i < len(r)) else None
    G = {}
    n = 0
    for r in it:
        tir = c(r, 'TIRCODE')
        if tir is None:
            continue
        try:
            code = str(int(float(tir)))
        except (TypeError, ValueError):
            code = str(tir).strip()
        code, _ancien = code_officine(code)      # comme generate_wml_v2 : une pharmacie = une fiche
        if not code or (garder is not None and code not in garder):
            continue
        q, B, N, net = num(c(r, 'PLVQTE')), num(c(r, 'PLVPUBRUT')), num(c(r, 'PLVPUNET')), num(c(r, 'PLVMNTNETHT'))
        if prefix in avoirs and str(c(r, 'PCVNUM') or '').startswith('AC'):
            q, net = -q, -net                     # avoirs Escale, comme generate_wml_v2
        cip = cip13(c(r, 'ARTCODEBARRE'))
        k = cat.get(cip) or (None, None, None, None)
        afm = c(r, 'AFMCODE') if 'AFMCODE' in hi else k[3]
        t = c(r, 'TVATAUX')
        t = round(t, 4) if isinstance(t, (int, float)) else None
        remb = str(afm or '').strip() == 'REMBSS'
        rb = remb and (t is None or abs(t - 0.021) < 1e-6)
        froid = sa(c(r, 'ARTSOUSFAMILLE') or k[0]) == 'froid'
        gen = 'generique' in sa(c(r, 'ARTNATURE') or k[1])
        lab = str(c(r, 'ARTCOLLECTION') or k[2] or '').upper()
        su = any(x in lab for x in labos)
        mt = c(r, 'MARGETHEORIQUE')
        a_mt = isinstance(mt, (int, float))
        reg = regime_ligne(c(r, 'PCVDATEEFFET'), ym)
        d = str(c(r, 'PLVDESIGNATION') or '').strip()
        cle = cip or '#' + d[:40]
        key = (code, reg, cle, round(B, 4), round(N, 4), int(rb), int(froid), int(gen), int(su), int(q >= 0), int(a_mt))
        x = G.get(key)
        if x is None:
            x = G[key] = [0.0, 0.0, 0.0, 0.0]
        x[0] += q
        x[1] += net
        x[2] += q * N
        if a_mt:
            x[3] += mt
        n += 1
    wb.close()
    out = [list(k) + [round(v, 6) for v in x] for k, x in G.items()]
    tmp = fc + '.tmp'
    with gzip.open(tmp, 'wt', encoding='utf-8', compresslevel=1) as f:
        json.dump(out, f, separators=(',', ':'))
    os.replace(tmp, fc)
    return fc, n


def charger_groupes(chemin):
    """Groupes d'un fichier de cache -> tuples (off, reg, cle, B, N, rb, froid, gen, su, pos, a_mt, q, net, qN, mt)."""
    with gzip.open(chemin, 'rt', encoding='utf-8') as f:
        rows = json.load(f)
    return [(r[0], r[1], r[2], r[3], r[4], bool(r[5]), bool(r[6]), bool(r[7]), bool(r[8]), bool(r[9]), bool(r[10]),
             r[11], r[12], r[13], r[14]) for r in rows]


# ═══════════════════════════════════════════════ principal ═══════════════════════════════════════
def main():
    t0 = time.time()
    prive = lire_prive()
    if prive is None:
        print('ARRÊT : réglage privé illisible (%s) — rien n\'est écrit.' % PRIVE)
        return 3
    try:
        env = lire_wml_v2(os.path.join(BASE, 'generate_wml_v2.py'))
    except (OSError, ValueError, SyntaxError) as e:
        print('ARRÊT :', e)
        return 2
    stats = premier_existant(os.path.join(BASE, 'STATS'), os.path.expanduser('~/JARVIS/APP-atelier/STATS'))
    crm = os.path.join(BASE, 'crm')
    p_gen = premier_existant(os.path.join(crm, 'v2', 'marge-regles-data.js'))
    p_fr = premier_existant(os.path.join(crm, 'v2', 'froid-data.js'))
    p_pr = premier_existant(os.path.join(crm, 'v2', 'marge-regles-prive.js'), os.path.expanduser('~/JARVIS/APP-atelier/crm/v2/marge-regles-prive.js'))
    manque = [n for n, p in (('STATS', stats), ('marge-regles-data.js', p_gen), ('froid-data.js', p_fr)) if not p]
    if manque:
        print('ARRÊT : introuvable :', ', '.join(manque))
        return 2
    gen = lire_js_liste(p_gen, 'MARGE_REGLES', 'generiques')
    fr = lire_js_liste(p_fr, 'FROID_CIPS')
    nr = set()   # non remboursé = critère de la ligne (rb), voir famille()
    privee = []
    if p_pr:
        try:
            privee = (lire_js_liste(p_pr, 'MARGE_REGLES_PRIVE', 'petitReduit') or {}).get('cips') or []
        except (ValueError, KeyError, AttributeError):
            privee = []
    if not (gen and fr):
        print('ARRÊT : une liste de produits est vide (génériques %d · froid %d)' % (len(gen), len(fr)))
        return 2
    L = Listes(gen, nr, fr, privee, prive['petit'], prive['petit_2027'], prive['labos'])
    print('Listes : %d génériques · %d froid · liste privée %s' % (len(L.gen), len(L.fr), ('%d' % len(L.privee)) if privee else 'absente'))

    # ── quels tableurs : exactement ceux de generate_wml_v2 ──
    mois_lus = env['MOIS_LUS']
    rattachees = {k: tuple(v) for k, v in env['RATTACHEES'].items()}
    lectures = [(comm, prefix, stats, None) for comm, prefix in env['SOURCES']]
    for comm, prefix in sorted(set(rattachees.values())):
        lectures.append((comm, prefix, os.path.join(stats, 'hors-perimetre'), sorted(k for k, v in rattachees.items() if v == (comm, prefix))))
    cat, utilises = lire_catalogue(stats)
    if not cat:
        print('ARRÊT : catalogue produit illisible dans', stats)
        return 2
    print('Catalogue : %d produits (%s)' % (len(cat), ' ; '.join(utilises)))
    os.makedirs(CACHE, exist_ok=True)
    chemin_cat = os.path.join(CACHE, 'catalogue.json')
    sig_cat = signature_fichiers(os.path.join(stats, 'stock POS.xlsx'), os.path.join(stats, 'stock et prix 22 06 2026.xlsx'))
    sig = hashlib.md5((VERSION_CACHE + sig_cat + ' '.join(utilises) + '|'.join(L.labos) + '|' + str(DEBUT_2027) + str(MOIS_2027)).encode()).hexdigest()[:8]
    with open(chemin_cat, 'w', encoding='utf-8') as f:
        json.dump(cat, f, ensure_ascii=False)
    taches = []
    for comm, prefix, dossier, garder in lectures:
        for annee, mois in mois_lus:
            p = os.path.join(dossier, '%s_%02d_%d.xlsx' % (prefix, mois, annee))
            if garder is not None and not os.path.exists(p):
                p = os.path.join(stats, os.path.basename(p))
            if os.path.exists(p):
                taches.append((comm, prefix, p, garder, annee * 100 + mois, sig))
    if not taches:
        print('ARRÊT : aucun tableur de ventes lu dans', stats)
        return 2
    print('%d tableurs · cache %s' % (len(taches), CACHE), flush=True)
    chemins = []
    nouveaux = 0
    with Pool(4, initializer=_init_worker, initargs=(chemin_cat, L.labos, env['AVOIRS_EN_POSITIF'])) as pool:
        for i, (fc, n) in enumerate(pool.imap(lire_fichier, taches), 1):
            chemins.append(fc)
            nouveaux += n >= 0
            if i % 25 == 0:
                print('  %d/%d (%.0f s)' % (i, len(taches), time.time() - t0), flush=True)
    meta = [(t[0], t[4]) for t in taches]       # (prénom, ym) de chaque fichier, dans l'ordre
    print('Lecture : %d fichiers lus pour de bon, %d repris du cache (%.0f s)' % (nouveaux, len(taches) - nouveaux, time.time() - t0), flush=True)

    # ── passe 1 : apprendre les prix d'achat ; passe 2 : estimer ──
    cascade = Cascade(L)
    nb_lignes = 0
    for fc, (comm, ym) in zip(chemins, meta):
        for g in charger_groupes(fc):
            cascade.apprendre(g, ym)
            nb_lignes += 1
    if not cascade.figer():
        print('ARRÊT : aucune ligne avec la marge de la direction (MARGETHEORIQUE) — rien à apprendre.')
        return 4
    print('Apprentissage : %d groupes · %d portent la marge de la direction · %d prix produit-mois-brut · %d produit-brut · %d produit (%.0f s)'
          % (nb_lignes, cascade.lignes_connues, len(cascade.OM), len(cascade.OB), len(cascade.OC), time.time() - t0), flush=True)
    lignes = {}
    prov = defaultdict(float)
    for fc, (comm, ym) in zip(chemins, meta):
        for g in charger_groupes(fc):
            src, m = ajouter(lignes, (comm, g[0], ym), g, ym, cascade, L)
            if src != 'gen':
                prov[src] += m
    prenoms = sorted({k[0] for k in lignes})
    officines = sorted({k[1] for k in lignes})
    c_idx = {p: i for i, p in enumerate(prenoms)}
    o_idx = {o: i for i, o in enumerate(officines)}
    rows = arrondir(lignes, c_idx, o_idx)
    if not rows:
        print('ARRÊT : 0 ligne — rien n\'est écrit.')
        return 5
    mois_txt = ['%d-%02d' % (a, m) for a, m in mois_lus]
    ym_max = max(m[1] for m in meta)
    d = {'v': 1, 'fait': datetime.date.today().isoformat(), 'jusqua': '%d-%02d' % (ym_max // 100, ym_max % 100), 'mois': mois_txt,
         'reserves': prive['reserves'], 'fam': FAM, 'c': prenoms, 'o': officines, 'r': rows}
    for r in rows:
        assert abs(sum(r[5:12]) - r[4]) < 0.005, 'tot != somme des familles'

    # ── écriture atomique + relecture + node --check ──
    texte = formater(d)
    tmp = os.path.join(BASE, 'marge-clients.nouveau.js')
    try:
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(texte)
        if subprocess.run(['node', '--check', tmp], capture_output=True).returncode != 0:
            print('ARRÊT : node --check refuse le fichier — rien n\'est remplacé.')
            return 5
        rel = analyser(open(tmp, encoding='utf-8').read())
        if rel != d:
            print('ARRÊT : la relecture ne redonne pas ce qui a été écrit — rien n\'est remplacé.')
            return 5
        os.replace(tmp, SORTIE)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    # cache : on garde seulement ce que cette passe a utilisé
    gardes = set(chemins) | {chemin_cat}
    for f in glob.glob(os.path.join(CACHE, '*.json.gz')) + glob.glob(os.path.join(CACHE, '*.tmp')):
        if f not in gardes:
            os.remove(f)
    tp = sum(prov.values())
    print('OK %s · %d lignes · %d clients (prénoms) · %d officines · %.1f Mo · %.0f s'
          % (SORTIE, len(rows), len(prenoms), len(officines), os.path.getsize(SORTIE) / 1e6, time.time() - t0))
    print('Provenance de la marge : ' + ' · '.join('%s %.3f %%' % (k, 100 * v / tp) for k, v in sorted(prov.items(), key=lambda kv: -kv[1])) if tp else 'Provenance : rien')
    return 0


if __name__ == '__main__':
    sys.exit(main())
