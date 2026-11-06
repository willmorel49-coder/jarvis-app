#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
offilog-ventes.test.py — ventes Offilog par pharmacie (06/11/2026) : lecture du .xlsx mensuel, forme de `off`,
découpe par commercial. Lancer : python3 tests/offilog-ventes.test.py

Tout est INVENTÉ (CIP 9000001…, noms fictifs, réglage fictif : seuil 100, 7 par client) : aucune vraie
donnée, aucun vrai montant de prime. Les .xlsx sont fabriqués ici en bibliothèque standard (pas d'openpyxl).
"""
import importlib.util, io, json, os, re, sys, tempfile, time, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)


def charger(nom):
    spec = importlib.util.spec_from_file_location(nom, os.path.join(ROOT, nom + '.py'))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


# ── un .xlsx minimal (chaînes en ligne, nombres) ────────────────────────────────────────────────────
def col(i):
    return chr(65 + i)

def xlsx(chemin, feuilles):
    """feuilles = {nom: [[cellules]]}"""
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
    wb = '<workbook %s><sheets>%s</sheets></workbook>' % (ns, ''.join(
        '<sheet name="%s" sheetId="%d" r:id="rId%d"/>' % (n, i + 1, i + 1) for i, n in enumerate(feuilles)))
    rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">%s</Relationships>' % ''.join(
        '<Relationship Id="rId%d" Type="x" Target="worksheets/sheet%d.xml"/>' % (i + 1, i + 1) for i in range(len(feuilles)))
    with zipfile.ZipFile(chemin, 'w') as z:
        z.writestr('xl/workbook.xml', wb); z.writestr('xl/_rels/workbook.xml.rels', rels)
        for i, rows in enumerate(feuilles.values()):
            out = []
            for r, row in enumerate(rows):
                cs = []
                for c, v in enumerate(row):
                    ref = '%s%d' % (col(c), r + 1)
                    if v is None: continue
                    if isinstance(v, str):
                        cs.append('<c r="%s" t="inlineStr"><is><t>%s</t></is></c>' % (ref, v.replace('&', '&amp;')))
                    else:
                        cs.append('<c r="%s"><v>%s</v></c>' % (ref, v))
                out.append('<row r="%d">%s</row>' % (r + 1, ''.join(cs)))
            z.writestr('xl/worksheets/sheet%d.xml' % (i + 1), '<worksheet %s><sheetData>%s</sheetData></worksheet>' % (ns, ''.join(out)))

# série Excel : jour 1 = 1900-01-01 (avec le décalage 1900) ; 46266 = 2026-09-01 (vérifié contre datetime ci-dessous)
import datetime
serie = lambda a, m, j: (datetime.date(a, m, j) - datetime.date(1899, 12, 30)).days
assert serie(2026, 9, 1) == 46266

ENTETE = ['CIP', 'COMMERCIAL', 'NOM SOCIETE', 'NUM PIECE', 'DATE', 'MONTANT HT', 'MONTANT TTC']
SANS = ['CIP', 'NOM', 'NUM FACT', 'DATE', 'HT', 'TTC']
REG = {'seuil_ht': 100, 'montant_par_client': 7, 'premier_mois': '2026-09', 'dernier_mois': '2027-06',
       'partages': {'ANNE AAA / BEA BBB': 'BEA BBB'}, 'corrections_de_nom': {'CARLCCC': 'CARL CCC'},
       'noms_jarvis': {'ANNE AAA': 'Anne', 'BEA BBB': 'Béa', 'CARL CCC': 'Carl'}}

V = charger('offilog_ventes')

# ── 1. avoirs signés, mois par la DATE (pas par le nom de feuille), colonnes par leur NOM ───────────────
d1 = tempfile.mkdtemp()
xlsx(os.path.join(d1, 'ventes.xlsx'), {
    'Feuille quelconque': [ENTETE,
        [9000001, 'ANNE  aaa', 'PHARMACIE UN', 'FC_1', serie(2026, 9, 30), 300, 360],
        [9000001, 'ANNE AAA', 'PHARMACIE UN', 'AC_1', serie(2026, 9, 30), 50, -60],      # avoir : HT en POSITIF, TTC négatif
        [9000001, 'ANNE AAA', 'PHARMACIE UN', 'FC_2', serie(2026, 10, 1), 120, 144],     # le 1er octobre = octobre
        [9000002, 'CARLCCC', 'PHARMACIE DEUX', 'FC_3', serie(2026, 10, 15), 80, 96],
        [9000002, 'CARLCCC', 'PHARMACIE DEUX', 'AC_9', serie(2026, 10, 16), 10, 12]],     # avoir au TTC POSITIF = incohérence à compter
    'tcd': [['Étiquettes de lignes', 'Somme de MONTANT HT'], ['ANNE AAA', 99999]],        # tableau croisé : jamais lu
})
sortie, bilan = V.lire(d1, os.path.join(d1, 'absent.json'), parler=False)
assert sortie['vm'] == ['2026-09', '2026-10'], sortie['vm']
assert sortie['v']['9000001'] == [250.0, 120.0], sortie['v']                 # 300 - 50 ; 120
assert sortie['v']['9000002'] == [0, 70.0], sortie['v']                      # 80 - 10
assert 99999 not in [x for v in sortie['v'].values() for x in v]
assert bilan['incoherences_ttc'] == 1, bilan['incoherences_ttc']
assert bilan['fichiers'][0][1]['ignorees'] == ['tcd']

# ── 2. réglage absent : pas de `pr`, aucun nom rattaché à un commercial, le reste marche ───────────────
assert 'pr' not in sortie
assert sortie['va']['9000001'] == 'ANNE AAA'    # nom complet = « hors JARVIS » (visible du seul accès total)

# ── 3. noms : correction, partage, hors JARVIS, ligne avec commercial > sans commercial ───────────────
d3 = tempfile.mkdtemp()
json.dump(REG, open(os.path.join(d3, 'reglage-prime-offilog.json'), 'w'))
xlsx(os.path.join(d3, 'ventes.xlsx'), {
    'v': [ENTETE,
        [9000001, 'ANNE AAA', 'P UN', 'FC_1', serie(2026, 9, 3), 150, 180],
        [9000002, 'CARLCCC', 'P DEUX', 'FC_2', serie(2026, 9, 3), 150, 180],                       # correction de nom
        [9000003, 'ANNE AAA / BEA BBB', 'P TROIS', 'FC_3', serie(2026, 9, 3), 150, 180],            # partagé -> Béa
        [9000004, 'DENIS DDD', 'P QUATRE', 'FC_4', serie(2026, 9, 3), 150, 180]],                   # absent de noms_jarvis
    'sans': [SANS,
        [9000001, 'P UN', 'FC_5', serie(2026, 9, 4), 10, 12],                                       # sans commercial MAIS le CIP a un commercial
        [9000005, 'P CINQ', 'FC_6', serie(2026, 9, 4), 10, 12]],
})
s3, _ = V.lire(d3, parler=False)
assert s3['va'] == {'9000001': 'Anne', '9000002': 'Carl', '9000003': 'Béa', '9000004': 'DENIS DDD', '9000005': ''}, s3['va']
assert s3['pr'] == {'s': 100, 'p': 7, 'de': '2026-09', 'a': '2027-06'}, s3['pr']
assert s3['vn']['9000001'] == 'P UN'

# ── 4. dédoublonnage entre feuilles ET entre fichiers ; le fichier le plus récent l'emporte ────────────
d4 = tempfile.mkdtemp()
json.dump(REG, open(os.path.join(d4, 'reglage-prime-offilog.json'), 'w'))
xlsx(os.path.join(d4, 'a.xlsx'), {'v': [ENTETE, [9000001, 'ANNE AAA', 'P', 'FC_1', serie(2026, 9, 3), 100, 120]],
                                  'w': [ENTETE, [9000001, 'ANNE AAA', 'P', 'FC_1', serie(2026, 9, 3), 100, 120]]})   # même pièce, 2 feuilles
time.sleep(0.05)
xlsx(os.path.join(d4, 'b.xlsx'), {'v': [ENTETE, [9000001, 'ANNE AAA', 'P', 'FC_1', serie(2026, 9, 3), 100, 120],      # déjà vue dans a.xlsx
                                                [9000001, 'ANNE AAA', 'P', 'FC_2', serie(2026, 10, 3), 40, 48]]})
os.utime(os.path.join(d4, 'b.xlsx'), (time.time() + 5, time.time() + 5))
open(os.path.join(d4, '~$verrou.xlsx'), 'w').write('pas un classeur')             # verrou Excel : ignoré
s4, b4 = V.lire(d4, parler=False)
assert s4['v']['9000001'] == [100.0, 40.0], s4['v']                                # FC_1 comptée UNE fois
assert b4['doublons_fichiers'] == 1 and b4['conflits'] == 0, b4
# même pièce, montant corrigé dans le fichier suivant : le plus récent gagne, et on le compte
xlsx(os.path.join(d4, 'c.xlsx'), {'v': [ENTETE, [9000001, 'ANNE AAA', 'P', 'FC_1', serie(2026, 9, 3), 90, 108]]})
os.utime(os.path.join(d4, 'c.xlsx'), (time.time() + 10, time.time() + 10))
s4b, b4b = V.lire(d4, parler=False)
assert s4b['v']['9000001'] == [90.0, 40.0] and b4b['conflits'] == 1, (s4b['v'], b4b)

# ── 5. mois sans aucune vente au milieu : la liste des mois reste continue ─────────────────────────────
d5 = tempfile.mkdtemp()
xlsx(os.path.join(d5, 'x.xlsx'), {'v': [ENTETE, [9000001, 'A', 'P', 'FC_1', serie(2026, 11, 3), 10, 12], [9000001, 'A', 'P', 'FC_2', serie(2027, 1, 3), 10, 12]]})
s5, _ = V.lire(d5, parler=False)
assert s5['vm'] == ['2026-11', '2026-12', '2027-01'] and s5['v']['9000001'] == [10.0, 0, 10.0], s5

# ── 6. offilog_clients.ecrire : lecture vide = ventes d'avant gardées ; réglage absent = pas de pr ─────
oc = charger('offilog_clients')
oc.lire = lambda stats: {'d': ['2026-10-02'], 'm': {'9000001': [1, 0]}}
oc.lire_offre = lambda stats: {}
tmp = tempfile.mkdtemp(); oc.SORTIE = os.path.join(tmp, 'wml-offilog.json')
oc.ecrire('stats-bidon', d3)
a = json.load(open(oc.SORTIE))
assert a['v'] and a['vm'] == ['2026-09'] and a['pr']['s'] == 100 and a['d'] == ['2026-10-02'], a
vide = tempfile.mkdtemp()                                                   # dossier sans aucun classeur
oc.ecrire('stats-bidon', vide)
b = json.load(open(oc.SORTIE))
assert b['v'] == a['v'] and b['va'] == a['va'] and b['vn'] == a['vn'] and b['vm'] == a['vm'], 'une lecture vide a effacé les ventes'
assert 'pr' not in b, 'sans réglage, aucune prime ne doit rester'
xlsx(os.path.join(vide, 'ventes.xlsx'), {'v': [ENTETE, [9000001, 'ANNE AAA', 'P', 'FC_1', serie(2026, 9, 3), 10, 12]]})   # ventes mais pas de réglage
oc.ecrire('stats-bidon', vide)
c = json.load(open(oc.SORTIE))
assert c['v'] == {'9000001': [10.0]} and 'pr' not in c, c

# ── 7. suite_off : chaque jeu ne reçoit que ses pharmacies ─────────────────────────────────────────────
D = charger('decouper_par_commercial')
D.OFF_CA = {'d': ['2026-10-02'], 'm': {'1': [1, 0], '2': [1, 0], '3': [0, 0], '4': [1, 0]}, 'vm': ['2026-09', '2026-10'],
            'v': {'1': [10, 20], '2': [30, 40], '5': [50, 60], '6': [70, 80], '7': [1, 2], '8': [3, 4]},
            'va': {'1': 'Anne', '2': 'Béa', '5': 'Anne', '6': 'DENIS DDD', '7': '', '8': 'Béa'},
            'vn': {'1': 'P1', '2': 'P2', '5': 'P5', '6': 'P6', '7': 'P7', '8': 'P8'},
            'pr': {'s': 100, 'p': 7, 'de': '2026-09', 'a': '2027-06'}}
def parse(txt):
    return json.loads(txt[len(', off:'):]) if txt else None
# jeu d'Anne : officines 1 et 4 (mes_ca) ; le fichier lui attribue aussi 5 ; 2 (à Béa) n'est pas à elle
r = parse(D.suite_off({'1': [0, 0], '4': [0, 0]}, {'Anne'}))
assert set(r['v']) == {'1', '5'} and r['vm'] == ['2026-09', '2026-10'] and r['pr']['s'] == 100, r
assert r['va'] == {'1': 'Anne', '5': 'Anne'} and set(r['vn']) == {'1', '5'}
assert set(r['m']) == {'1', '4'}                                           # `m` : comportement d'avant
# une officine du jeu attribuée à quelqu'un d'autre (2 -> Béa) : ses chiffres vont (mes_ca), mais pas le nom de Béa
r = parse(D.suite_off({'1': [0, 0], '2': [0, 0]}, {'Anne'}))
assert r['v'].keys() == {'1', '2', '5'} and r['va']['2'] == '', r
# « hors JARVIS » et « sans commercial » ne vont jamais dans un jeu de commercial, sauf si l'officine est à lui (et alors sans nom)
r = parse(D.suite_off({'1': [0, 0]}, {'Anne'}))
assert '6' not in r['v'] and '7' not in r['v']
r = parse(D.suite_off({'6': [0, 0], '7': [0, 0]}, {'Anne'}))
assert r['va']['6'] == '' and r['va']['7'] == '' and 'DENIS DDD' not in json.dumps(r), r
# jeu OPSO (aucun `mes`) : AUCUNE des clés de ventes
r = parse(D.suite_off({'1': [0, 0]}))
assert not ({'v', 'va', 'vn', 'vm', 'pr'} & set(r)), r
# aucune vente dans la table : le jeu garde exactement la forme d'avant
D.OFF_CA = {'d': ['2026-10-02'], 'm': {'1': [1, 0]}}
assert parse(D.suite_off({'1': [0, 0]}, {'Anne'})) == {'d': ['2026-10-02'], 'm': {'1': [1, 0]}}

# ── 8. la table écrite par proteger_conditions.py est relue par la regex de decouper_par_commercial ─────
P = charger('proteger_conditions')
base = tempfile.mkdtemp(); os.makedirs(os.path.join(base, 'crm', 'v2'))
offs = [{'id': '1', 'name': 'P1', 'ca': 1200, 'potentiel': 3, 'comms': ['Anne']}, {'id': '2', 'name': 'P2', 'ca': 0, 'potentiel': 5, 'comms': ['Béa']}]
open(os.path.join(base, 'crm', 'v2', 'wml-officines-data.js'), 'w').write('const WML_OFFICINES = ' + json.dumps(offs) + ';\n')
off = {'d': ['2026-10-02'], 'm': {'1': [1, 0]}, 'b': {'1': [3, 0]}, 'bd': ['2026-10-02'],
       'vm': ['2026-09', '2026-10'], 'v': {'1': [10, 20.5]}, 'va': {'1': 'Anne'}, 'vn': {'1': 'P1'}, 'pr': {'s': 100, 'p': 7, 'de': '2026-09', 'a': '2027-06'}}
open(os.path.join(base, 'wml-offilog.json'), 'w').write(json.dumps(off, separators=(',', ':'), sort_keys=True))
P.BASE = base; P.fait.clear(); P.wml_officines()
ca = open(os.path.join(base, 'wml-officines-ca.js'), encoding='utf-8').read()
mo = D.RE_OFF_CA.search(ca)
assert mo, 'la regex de lecture ne relit plus la table écrite'
assert json.loads(mo.group(2)[6:]) == off, 'off relu différent de off écrit'
assert json.loads(mo.group(1)) == {'1': [1200, 3], '2': [0, 5]}

print('offilog-ventes : OK')
