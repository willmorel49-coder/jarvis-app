#!/usr/bin/env python3
"""Ventes Offilog par pharmacie — fichier mensuel déposé dans ~/JARVIS/OFFILOG/ (06/11/2026).

Will dépose chaque mois un .xlsx. Les feuilles utiles portent une ligne d'en-tête avec CIP, une colonne
pièce (NUM PIECE / NUM FACT), DATE et HT (repérées PAR LEUR NOM, jamais par leur rang) ; tout le reste du
classeur (tableaux croisés dynamiques) est FAUX et n'est jamais lu. Le mois vient de la DATE (série Excel).

Règles arrêtées avec Will :
  - les avoirs (pièce qui commence par AC) sont en POSITIF dans la colonne HT : HT signé = -|HT| ;
    contrôle : le TTC est négatif, les incohérences sont comptées et imprimées ;
  - une pièce n'est comptée qu'une fois (clé = pièce + CIP), entre feuilles ET entre fichiers
    (le fichier le plus récent l'emporte) ;
  - une ligne avec commercial l'emporte sur « sans commercial » ;
  - noms : espaces réduits, majuscules ; `corrections_de_nom`, puis `partages`, puis `noms_jarvis` (nom
    complet -> prénom JARVIS) du réglage. Un nom absent de `noms_jarvis` = « hors JARVIS » : gardé sous
    son nom complet, jamais donné à un commercial ;
  - « sans commercial » dans le fichier -> le commercial JARVIS de la pharmacie (choix de Will du 06/11/2026),
    s'il y en a UN seul ; aucun ou plusieurs (pharmacie partagée) = reste « sans commercial », vu du seul
    accès total. `comms` = {CIP: commerciaux JARVIS}, fourni par generate_wml_v2.py.
Le réglage (seuil, montant, période de la prime, noms) vit HORS du dépôt : ~/JARVIS/OFFILOG/reglage-prime-offilog.json.
Rien de tout cela n'est écrit en dur ici.

Sortie (fusionnée dans l'objet `off` de wml-offilog.json par offilog_clients.py) :
  vm = mois couverts ["2026-09", …] · v = {TIRCODE: [HT net par mois de vm]} · va = {TIRCODE: prénom | nom hors JARVIS | ""}
  vn = {TIRCODE: nom de la pharmacie dans le fichier} · pr = {s, p, de, a} (absent sans réglage)
"""
import datetime, glob, io, json, os, re, sys, unicodedata

BASE = os.path.dirname(os.path.abspath(__file__))
if BASE not in sys.path:
    sys.path.insert(0, BASE)
import lire_xlsx  # noqa: E402

DOSSIER = os.environ.get('OFFILOG_DIR') or os.path.expanduser('~/JARVIS/OFFILOG')
REGLAGE = os.path.join(DOSSIER, 'reglage-prime-offilog.json')
EPOQUE = datetime.date(1899, 12, 30)


def _cle(code):
    try:
        return str(int(float(code)))
    except (TypeError, ValueError):
        m = re.match(r'\d+', str(code or ''))
        return m.group(0) if m else str(code or '').strip()


def _nom(s):
    """Espaces réduits, majuscules."""
    return ' '.join(str(s or '').split()).upper()


def _sans_accent(s):
    return ''.join(c for c in unicodedata.normalize('NFD', str(s or '')) if unicodedata.category(c) != 'Mn')


def _entete(cell):
    return ' '.join(_sans_accent(cell).upper().split())


def colonnes(ligne):
    """-> {'cip','piece','date','ht', 'ttc'?, 'com'?, 'nom'?} (rangs) si la ligne est un en-tête de ventes, sinon None."""
    h = [_entete(c) for c in ligne]
    out = {}
    for i, c in enumerate(h):
        if not c:
            continue
        if c in ('CIP', 'TIRCODE'):
            out.setdefault('cip', i)
        elif c.startswith('NUM') and ('PIECE' in c or 'FACT' in c):
            out.setdefault('piece', i)
        elif 'DATE' in c:
            out.setdefault('date', i)
        elif c.endswith('TTC'):
            out.setdefault('ttc', i)
        elif c.endswith('HT'):
            out.setdefault('ht', i)
        elif 'COMMERCIAL' in c:
            out.setdefault('com', i)
        elif c.startswith('NOM'):
            out.setdefault('nom', i)
    return out if all(k in out for k in ('cip', 'piece', 'date', 'ht')) else None


def _mois(d):
    """Série Excel (ou texte AAAA-MM-JJ / JJ/MM/AAAA) -> 'AAAA-MM' ; None si illisible."""
    if isinstance(d, (int, float)) and not isinstance(d, bool):
        try:
            return str(EPOQUE + datetime.timedelta(days=int(d)))[:7]
        except (OverflowError, ValueError):
            return None
    s = str(d or '').strip()
    m = re.match(r'(\d{4})-(\d{2})-\d{2}', s)
    if m:
        return m.group(1) + '-' + m.group(2)
    m = re.match(r'\d{2}/(\d{2})/(\d{4})', s)
    return m.group(2) + '-' + m.group(1) if m else None


def _num(x):
    return float(x) if isinstance(x, (int, float)) and not isinstance(x, bool) else None


def lire_fichier(chemin):
    """-> (lignes {(pièce, CIP): dict}, bilan). Une ligne : cip, com, nom, piece, mois, ht (signé), ttc."""
    classeur = lire_xlsx.lire(chemin)
    lignes, bilan = {}, {'feuilles': [], 'ignorees': [], 'lignes': 0, 'doublons': 0, 'illisibles': 0}
    for nom_feuille, rows in classeur.items():
        cols, debut = None, 0
        for i, r in enumerate(rows[:10]):
            cols = colonnes(r)
            if cols:
                debut = i + 1
                break
        if not cols:
            bilan['ignorees'].append(nom_feuille)
            continue
        bilan['feuilles'].append(nom_feuille)

        def at(r, k):
            j = cols.get(k)
            return r[j] if j is not None and j < len(r) else None
        for r in rows[debut:]:
            cip, piece, ht = at(r, 'cip'), str(at(r, 'piece') or '').strip(), _num(at(r, 'ht'))
            mois = _mois(at(r, 'date'))
            if not r or not str(cip or '').strip() or not piece or ht is None or mois is None:
                if r and any(c is not None for c in r):
                    bilan['illisibles'] += 1
                continue
            if not re.match(r'^\d+(\.0+)?$', str(cip).strip()):
                bilan['illisibles'] += 1
                continue
            avoir = piece.upper().startswith('AC')
            lig = {'cip': _cle(cip), 'com': _nom(at(r, 'com')), 'nom': ' '.join(str(at(r, 'nom') or '').split()),
                   'piece': piece, 'mois': mois, 'ht': round((-1 if avoir else 1) * abs(ht), 2), 'ttc': _num(at(r, 'ttc')),
                   'avoir': avoir}
            k = (piece, lig['cip'])
            if k in lignes:
                bilan['doublons'] += 1
                if not lig['com']:
                    lig['com'] = lignes[k]['com']
            lignes[k] = lig
            bilan['lignes'] += 1
    return lignes, bilan


def fichiers(dossier):
    """.xlsx du dossier, du plus ancien au plus récent ; `~$*.xlsx` (verrous Excel) et réglage ignorés."""
    out = [p for p in glob.glob(os.path.join(dossier, '*.xlsx')) if not os.path.basename(p).startswith('~$')]
    return sorted(out, key=lambda p: (os.path.getmtime(p), p))


def lire_reglage(chemin=None):
    """-> dict normalisé, ou None si le réglage est absent / illisible."""
    chemin = chemin or REGLAGE
    try:
        brut = json.loads(io.open(chemin, encoding='utf-8').read())
    except (IOError, OSError, ValueError):
        return None
    if not isinstance(brut, dict):
        return None
    norm = lambda d: {_nom(k): _nom(v) for k, v in (d or {}).items() if isinstance(d, dict)}
    return {'seuil': brut.get('seuil_ht'), 'montant': brut.get('montant_par_client'),
            'de': brut.get('premier_mois'), 'a': brut.get('dernier_mois'),
            'corrections': norm(brut.get('corrections_de_nom')), 'partages': norm(brut.get('partages')),
            'jarvis': {_nom(k): str(v).strip() for k, v in (brut.get('noms_jarvis') or {}).items()}}


def attribuer(nom, reglage):
    """Nom lu dans le fichier -> prénom JARVIS | nom complet « hors JARVIS » | '' (sans commercial)."""
    n = _nom(nom)
    if not n:
        return ''
    if reglage:
        n = reglage['corrections'].get(n, n)
        n = reglage['partages'].get(n, n)
        return reglage['jarvis'].get(n, n)
    return n   # sans réglage : aucun nom ne se rattache à un commercial -> « hors JARVIS », visible du seul accès total


def _mois_continus(mois):
    a, b = min(mois), max(mois)
    out, y, m = [], int(a[:4]), int(a[5:])
    while '%04d-%02d' % (y, m) <= b:
        out.append('%04d-%02d' % (y, m))
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def construire(lignes, reglage, comms=None, bilan=None):
    """lignes {(pièce, CIP): ligne} -> {vm, v, va, vn[, pr]} ; {} si aucune ligne.
    comms {CIP: commerciaux JARVIS} : rattache une pharmacie « sans commercial » à son commercial JARVIS s'il est seul."""
    if not lignes:
        return {}
    vm = _mois_continus({x['mois'] for x in lignes.values()})
    rang = {m: i for i, m in enumerate(vm)}
    tot, dernier = {}, {}
    for x in lignes.values():
        t = tot.setdefault(x['cip'], [0.0] * len(vm))
        t[rang[x['mois']]] += x['ht']
        # attribution = la ligne la plus récente qui porte un commercial (à défaut, la plus récente) ; nom idem
        cle = (bool(x['com']), x['mois'], x['piece'])
        if x['cip'] not in dernier or cle > dernier[x['cip']][0]:
            dernier[x['cip']] = (cle, x)
    zero = lambda f: 0 if abs(f) < 0.005 else round(f, 2)
    va = {k: attribuer(dernier[k][1]['com'], reglage) for k in sorted(tot)}
    sans = [k for k in va if not va[k]]
    for k in sans:
        cs = sorted((comms or {}).get(k) or ())
        if len(cs) == 1:
            va[k] = cs[0]
    if bilan is not None:
        bilan['sans_commercial'] = len(sans)
        bilan['rattachees_jarvis'] = sum(1 for k in sans if va[k])
    out = {'vm': vm,
           'v': {k: [zero(f) for f in t] for k, t in sorted(tot.items())},
           'va': va,
           'vn': {k: dernier[k][1]['nom'] for k in sorted(tot) if dernier[k][1]['nom']}}
    return out


def prime(reglage):
    """{s, p, de, a} lu dans le réglage ; None s'il manque une valeur."""
    if not reglage:
        return None
    s, p, de, a = reglage['seuil'], reglage['montant'], reglage['de'], reglage['a']
    ok = isinstance(s, (int, float)) and isinstance(p, (int, float)) and re.match(r'^\d{4}-\d{2}$', str(de or '')) and re.match(r'^\d{4}-\d{2}$', str(a or ''))
    return {'s': s, 'p': p, 'de': de, 'a': a} if ok else None


def lire(dossier=None, chemin_reglage=None, parler=True, comms=None):
    """Tout le dossier -> (dict à fusionner dans `off`, bilan). Dict vide si aucune vente lisible."""
    dossier = dossier or DOSSIER
    reglage = lire_reglage(chemin_reglage if chemin_reglage else os.path.join(dossier, 'reglage-prime-offilog.json'))
    toutes, bilan = {}, {'fichiers': [], 'doublons_fichiers': 0, 'conflits': 0, 'incoherences_ttc': 0, 'reglage': bool(reglage)}
    for p in fichiers(dossier):
        try:
            lignes, b = lire_fichier(p)
        except Exception as e:   # un classeur illisible ne condamne pas les autres, ni la table d'avant
            print('  [ventes] 🔴 illisible, ignoré : %s (%s)' % (os.path.basename(p), e))
            continue
        bilan['fichiers'].append((os.path.basename(p), b))
        for k, x in lignes.items():
            if k in toutes:
                bilan['doublons_fichiers'] += 1
                if abs(toutes[k]['ht'] - x['ht']) > 0.004:
                    bilan['conflits'] += 1
                if not x['com']:
                    x['com'] = toutes[k]['com']
            toutes[k] = x   # le fichier le plus récent l'emporte
    bilan['incoherences_ttc'] = sum(1 for x in toutes.values() if x['ttc'] is not None and (x['ttc'] < 0) != x['avoir'])
    bilan['lignes'] = len(toutes)
    out = construire(toutes, reglage, comms, bilan)
    pr = prime(reglage)
    if out and pr:
        out['pr'] = pr
    if parler:
        for nom, b in bilan['fichiers']:
            print('  [ventes] %s : feuilles lues %s · ignorées %d · %d lignes · %d doublons · %d illisibles'
                  % (nom, b['feuilles'], len(b['ignorees']), b['lignes'], b['doublons'], b['illisibles']))
        if out:
            print('  [ventes] %d pièces · %d pharmacies · mois %s · TTC incohérent avec le signe : %d · doublons entre fichiers : %d (dont montant différent : %d)'
                  % (len(toutes), len(out['v']), ', '.join(out['vm']), bilan['incoherences_ttc'], bilan['doublons_fichiers'], bilan['conflits']))
            print('  [ventes] sans commercial dans le fichier : %d pharmacies, dont %d rattachées à leur commercial JARVIS%s'
                  % (bilan['sans_commercial'], bilan['rattachees_jarvis'], '' if comms else ' (commerciaux JARVIS non fournis)'))
            if not reglage:
                print('  [ventes] réglage absent : aucune prime, aucun nom rattaché à un commercial (tout est « hors JARVIS »)')
        else:
            print('  [ventes] 🔴 aucune vente lue dans %s : ventes de la table d\'avant conservées' % dossier)
    return out, bilan


if __name__ == '__main__':
    r, _ = lire(sys.argv[1] if len(sys.argv) > 1 else None)
    print(json.dumps(r, separators=(',', ':'))[:300])
