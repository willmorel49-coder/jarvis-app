#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
marge-clients.test.py — « Notre marge » par client : la cascade, les familles, le total, le découpage.

Pourquoi ce test existe : `marge-clients.js` donne à chaque commercial la marge estimée de SES clients, et rien
que des siens. Deux choses ne doivent jamais se tromper :
  1. le CALCUL : lue -> prix d'achat -> taux -> repli, un prix d'achat de 2026 n'étant jamais appliqué à une
     vente de 2027 ; les sept familles s'additionnent exactement au total ;
  2. le CLOISONNEMENT : le jeu d'un commercial ne contient ni la ligne ni même le code d'une officine d'un collègue.

Le test charge les VRAIES fonctions des fichiers livrés (pas une copie). Toutes les données sont INVENTÉES :
aucun chiffre réel, aucun laboratoire, aucun prix d'achat.
"""
import os
import sys
import importlib.util

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RACINE)
sys.dont_write_bytecode = True


def charger(nom, fichier):
    spec = importlib.util.spec_from_file_location(nom, os.path.join(RACINE, fichier))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


gm = charger('generate_marge_clients', 'generate_marge_clients.py')
dc = charger('decouper_par_commercial', 'decouper_par_commercial.py')

ECHECS = []


def check(nom, cond, detail=""):
    if cond:
        print("  ok   %s" % nom)
    else:
        print("  ÉCHEC %s  %s" % (nom, detail))
        ECHECS.append(nom)


def proche(a, b, tol=1e-6):
    return abs(a - b) <= tol


# ── données inventées ───────────────────────────────────────────────────────────────────────────
A, B, C = '1000001', '1000002', '1000003'          # produits inventés (CIP13 fictifs)
PROD = {'x1': '9990000000011', 'x2': '9990000000028', 'x3': '9990000000035', 'x4': '9990000000042',
        'gen': '9990000000059', 'nr': '9990000000066', 'fr': '9990000000073', 'prive': '9990000000080',
        'inconnu': '9990000000097', 'cher': '9990000000103', 'inter': '9990000000110'}


def G(cle, B=0.0, N=1.0, q=1.0, mt=0.0, off='o1', reg=2026, rb=True, froid=False, gen=False, su=False, pos=True, a_mt=False, net=None, qN=None):
    """Un groupe de lignes, dans l'ordre attendu : off, reg, cle, B, N, rb, froid, gen, su, pos, a_mt, q, net, qN, mt."""
    return (off, reg, cle, B, N, rb, froid, gen, su, pos, a_mt, q, q * N if net is None else net, q * N if qN is None else qN, mt)


def listes(**kw):
    base = dict(gen=[PROD['gen']], nr=[PROD['nr']], fr=[PROD['fr']], privee=[PROD['prive']], petit_su=0.05, petit_su_2027=0.0, labos=['LABOINVENTE'])
    base.update(kw)
    return gm.Listes(**base)


def cascade(L=None):
    c = gm.Cascade(L or listes())
    return c


# ═════════════════════════════ 1. le barème et le régime ═════════════════════════════
print("1. barème des grossistes et régime")
check("2026 : bascule 4,329 € et seuil brut 4,629 €", proche(gm.BAREME[2026]['bascule_pfht'], 4.329004, 1e-5) and proche(gm.BAREME[2026]['seuil_brut'], 4.629004, 1e-5))
check("2027 : bascule 3,1746 € et seuil brut 3,3946 € (recalculés, pas recopiés)",
      proche(gm.BAREME[2027]['bascule_pfht'], 3.174603, 1e-5) and proche(gm.BAREME[2027]['seuil_brut'], 3.394603, 1e-5))
check("pf 2026 : plancher 0,30 sous le seuil", proche(gm.pf(4.0, False, 2026), 3.70))
check("pf 2027 : plancher 0,22 sous le seuil", proche(gm.pf(3.0, False, 2027), 2.78))
check("pf : même brut, deux régimes, deux prix fabricant", gm.pf(4.0, False, 2026) != gm.pf(4.0, False, 2027))
check("pf : au-dessus du seuil, brut / 1,0693 (les deux régimes)", proche(gm.pf(106.93, False, 2026), 100.0) and proche(gm.pf(106.93, False, 2027), 100.0))
check("pf : au-delà de 501,4696 brut, brut - 32,4996 (inchangé en 2027)", proche(gm.pf(600.0, False, 2026), 567.5004) and proche(gm.pf(600.0, False, 2027), 567.5004))
check("pf froid 2026 : retire 0,63 avant le barème", proche(gm.pf(106.93 + 0.63, True, 2026), 100.0))
check("pf froid 2027 : retire 0,80 avant le barème", proche(gm.pf(106.93 + 0.80, True, 2027), 100.0))

import datetime
check("régime : ligne datée du 20/01/2027 = 2027", gm.regime_ligne(datetime.datetime(2027, 1, 20), 202701) == 2027)
check("régime : ligne datée du 19/01/2027 = 2026 (même fichier de janvier)", gm.regime_ligne(datetime.datetime(2027, 1, 19), 202701) == 2026)
check("régime : date en texte lue", gm.regime_ligne('2027-03-02', 202703) == 2027 and gm.regime_ligne('2026-12-31', 202612) == 2026)
check("régime : sans date, février 2027 = 2027, janvier 2027 = 2026, 2026 = 2026",
      gm.regime_ligne(None, 202702) == 2027 and gm.regime_ligne(None, 202701) == 2026 and gm.regime_ligne(None, 202609) == 2026)
check("régime : la date l'emporte sur le mois du fichier", gm.regime_ligne(datetime.datetime(2026, 12, 30), 202703) == 2026)

# ═════════════════════════════ 2. la cascade ═════════════════════════════
print("2. cascade lue -> prix d'achat -> taux -> repli")
c = cascade()
appris = G(PROD['x1'], B=5.0, N=5.0, q=10, mt=20.0, a_mt=True)      # 10 boîtes à 5 €, marge lue 20 € : prix d'achat 3 €
c.apprendre(appris, 202603)
# un 2e produit pour que les taux génériques et non remboursés existent
c.apprendre(G(PROD['x2'], B=5.0, N=5.0, q=10, mt=3.0, a_mt=True, gen=True), 202603)
c.apprendre(G(PROD['x3'], B=5.0, N=5.0, q=10, mt=2.0, a_mt=True, rb=False), 202603)
check("figer : les taux génériques et non remboursés existent", c.figer() and c.TG > 0 and c.TNR > 0)
m, src = c.marge(appris, 202603)
check("1. lue : la marge de la ligne, telle quelle", src == 'lue' and proche(m, 20.0))
cible = G(PROD['x1'], B=5.0, N=5.0, q=4)
m, src = c.marge(cible, 202603)
check("2. prix d'achat du MÊME mois au MÊME brut : 4 boîtes x (5 - 3) = 8", src == "prix d'achat" and proche(m, 8.0), (m, src))
m, src = c.marge(G(PROD['x1'], B=5.0, N=4.5, q=4), 202607)
check("3. autre mois, même brut : même prix d'achat 3 € -> 4 x (4,5 - 3) = 6", src == "prix d'achat" and proche(m, 6.0), (m, src))
m, src = c.marge(G(PROD['x1'], B=7.0, N=6.0, q=2), 202603)
check("4. autre brut : taux du produit (20 / 50 de son prix net) -> 12 x 0,4 = 4,8", src == 'taux du produit' and proche(m, 4.8), (m, src))
m, src = c.marge(G(PROD['inconnu'], B=106.93, N=110.0, q=2), 202603)
check("5. produit inconnu : repli barème = qN - q x pf(brut) = 220 - 2 x 100", src == 'repli' and proche(m, 20.0), (m, src))
m, src = c.marge(G(PROD['inconnu'], B=4.0, N=4.0, q=5, froid=False), 202603)
check("5b. repli, petit prix 2026 : 5 x (4 - 3,70) = 1,50", src == 'repli' and proche(m, 1.5), (m, src))

# le régime 2027 n'apprend rien de 2026
g27 = G(PROD['x1'], B=5.0, N=5.0, q=4, reg=2027)
m, src = c.marge(g27, 202703)
check("2027 n'applique PAS le prix d'achat appris en 2026 (repli, pas 'prix d'achat')", src == 'repli', (m, src))
m, src = c.marge(G(PROD['inconnu'], B=3.0, N=3.0, q=10, reg=2027), 202703)
check("2027 : 10 x (3,00 - (3,00 - 0,22)) = 2,20", src == 'repli' and proche(m, 2.2), (m, src))
m, src = c.marge(G(PROD['inconnu'], B=3.0, N=3.0, q=10, reg=2026), 202603)
check("2026 : mêmes boîtes, plancher 0,30 -> 3,00", src == 'repli' and proche(m, 3.0), (m, src))
c.apprendre(G(PROD['x4'], B=8.0, N=8.0, q=5, mt=10.0, a_mt=True, reg=2027), 202703)
m, src = c.marge(G(PROD['x4'], B=8.0, N=8.0, q=2, reg=2027), 202703)
check("2027 apprend de 2027 : (8 - (40-10)/5) x 2 = 4", src == "prix d'achat" and proche(m, 4.0), (m, src))
m, src = c.marge(G(PROD['x4'], B=8.0, N=8.0, q=2, reg=2026), 202603)
check("... et 2026 n'apprend pas de 2027", src == 'repli', (m, src))

# les replis particuliers
m, src = c.marge(G(PROD['gen'], B=5.0, N=5.0, q=3), 202603)
check("générique de la liste publique : marge 0", src == 'gen' and m == 0.0)
m, src = c.marge(G(PROD['inconnu'], B=5.0, N=5.0, q=10, gen=True), 202603)
check("générique par nature (hors liste) : taux appris", src == 'repli' and proche(m, 50.0 * c.TG))
m, src = c.marge(G(PROD['inconnu'], B=5.0, N=5.0, q=10, rb=False), 202603)
check("non remboursé : taux appris", src == 'repli' and proche(m, 50.0 * c.TNR))
m, src = c.marge(G(PROD['inconnu'], B=2.0, N=2.0, q=10, su=True), 202603)
check("laboratoire à contrat, petit prix 2026 : montant fixe par boîte", src == 'repli' and proche(m, 0.5), (m, src))
m, src = c.marge(G(PROD['inconnu'], B=2.0, N=2.0, q=10, su=True, reg=2027), 202703)
check("... et rien en 2027", src == 'repli' and proche(m, 0.0), (m, src))
m, src = c.marge(G(PROD['inconnu'], B=0.0, N=2.0, q=10), 202603)
check("sans prix brut : écran de secours", src == 'ecran', (m, src))

print("2b. écran de secours (règle publique du Pilotage)")
L = listes()
check("2026 petit prix : 0,12 la boîte", proche(gm.ecran(G(PROD['inconnu'], N=2.0, q=10), L), 1.2))
check("2027 sous 3,1746 : 0,088 la boîte", proche(gm.ecran(G(PROD['inconnu'], N=2.0, q=10, reg=2027), L), 0.88))
check("2027 de 3,1746 à 4,33 : 2,772 % du net", proche(gm.ecran(G(PROD['inconnu'], N=4.0, q=10, reg=2027), L), 40.0 * 0.02772))
check("entre 4,33 et 468 : 3,04 % du net", proche(gm.ecran(G(PROD['inconnu'], N=100.0, q=2), L), 200.0 * 0.0304))
check("au-dessus de 468 : 13 € la boîte", proche(gm.ecran(G(PROD['cher'], N=600.0, q=2), L), 26.0))
check("NR : net x (1 - 1/1,03)", proche(gm.ecran(G(PROD['nr'], N=10.0, q=2, rb=False), L), 20.0 * (1 - 1 / 1.03)))
check("froid : +0,63 (2026), +0,80 (2027)", proche(gm.ecran(G(PROD['fr'], N=100.0, q=2), L), 200.0 * 0.0304 + 1.26) and proche(gm.ecran(G(PROD['fr'], N=100.0, q=2, reg=2027), L), 200.0 * 0.0304 + 1.6))
check("liste privée sous 4,33 : montant fixe", proche(gm.ecran(G(PROD['prive'], N=2.0, q=10), L), 0.5) and proche(gm.ecran(G(PROD['prive'], N=2.0, q=10, reg=2027), L), 0.0))
check("liste privée absente : règle ordinaire", proche(gm.ecran(G(PROD['prive'], N=2.0, q=10), listes(privee=[])), 1.2))
check("générique de la liste : 0", gm.ecran(G(PROD['gen'], N=2.0, q=10), L) == 0.0)

# ═════════════════════════════ 3. les familles ═════════════════════════════
print("3. familles d'affichage (exclusives, par priorité)")
fam = lambda cle, N, reg=2026: gm.famille(cle, N, reg, L)
check("2026 : sous 4,33 = p (index 0), jamais p1 / p2", fam(PROD['x1'], 2.0) == 0 and fam(PROD['x1'], 3.0) == 0 and fam(PROD['x1'], 4.32) == 0)
check("2027 : sous 3,1746 = p1", fam(PROD['x1'], 3.17, 2027) == 1 and fam(PROD['x1'], 1.0, 2027) == 1)
check("2027 : 3,1746 à 4,33 exclu = p2", fam(PROD['x1'], 3.1746, 2027) == 2 and fam(PROD['x1'], 4.32, 2027) == 2)
check("4,33 à 468 exclu = i", fam(PROD['x1'], 4.33) == 3 and fam(PROD['x1'], 467.99, 2027) == 3)
check("468 et plus = c", fam(PROD['x1'], 468.0) == 4 and fam(PROD['x1'], 5000.0, 2027) == 4)
check("froid prime sur le prix", fam(PROD['fr'], 2.0) == 5 and fam(PROD['fr'], 900.0) == 5)
check("NR prime sur le froid et le prix", gm.famille(PROD['nr'], 2.0, 2026, L, rb=False) == 6)
check("générique (liste) prime sur tout : aucune famille, marge 0", fam(PROD['gen'], 2.0) is None)
L2 = listes(gen=[PROD['fr']])
check("un générique froid est générique, pas froid", gm.famille(PROD['fr'], 2.0, 2026, L2) is None)
check("non remboursé + froid : nr", gm.famille(PROD['fr'], 2.0, 2026, L, rb=False) == 6)
check("remboursé : pas nr", gm.famille(PROD['fr'], 2.0, 2026, L, rb=True) == 5)
check("liste des familles : p p1 p2 i c fr nr", gm.FAM == ['p', 'p1', 'p2', 'i', 'c', 'fr', 'nr'])

# ═════════════════════════════ 4. somme des familles = total ═════════════════════════════
print("4. total = somme exacte des 7 familles, après arrondi")
c4 = cascade()
c4.apprendre(G(PROD['x1'], B=5.0, N=5.0, q=10, mt=20.0, a_mt=True), 202603)
c4.apprendre(G(PROD['x2'], B=5.0, N=5.0, q=10, mt=3.0, a_mt=True, gen=True), 202603)
c4.apprendre(G(PROD['x3'], B=5.0, N=5.0, q=10, mt=2.0, a_mt=True, rb=False), 202603)
c4.figer()
lignes = {}
groupes = [
    G(PROD['x1'], B=5.0, N=5.0, q=3.33), G(PROD['x1'], B=5.0, N=5.0, q=1.1, off='o2'), G(PROD['inconnu'], B=106.93, N=110.7, q=2.37),
    G(PROD['fr'], B=9.0, N=8.77, q=1.0), G(PROD['nr'], B=9.0, N=8.77, q=1.0), G(PROD['gen'], B=3.0, N=2.0, q=7.0),
    G(PROD['cher'], B=700.0, N=600.0, q=1), G(PROD['inconnu'], B=2.0, N=2.0, q=7.7, reg=2027), G(PROD['inconnu'], B=3.5, N=3.6, q=3.3, reg=2027),
    G(PROD['inconnu'], B=0.0, N=0.77, q=3.3),
]
for g in groupes:
    gm.ajouter(lignes, ('Alice', g[0], 202603), g, 202603, c4, L)
c_idx, o_idx = {'Alice': 0}, {'o1': 0, 'o2': 1}
rows = gm.arrondir(lignes, c_idx, o_idx)
ok = all(abs(r[4] - round(sum(r[5:12]), 2)) < 1e-9 for r in rows)
check("tot == somme des 7 familles arrondies (chaque ligne)", ok and len(rows) == 2, rows)
check("chaque ligne a 13 colonnes", all(len(r) == 13 for r in rows))
check("le CA garde les génériques ; caGen = leur seule part", proche(rows[0][12], 14.0) and rows[0][3] > rows[0][12], rows[0])
check("un générique de la liste ne porte aucune marge (famille p inchangée par lui)", proche(sum(r[3] for r in rows), round(sum(g[12] for g in groupes), 2), 0.011))

# ═════════════════════════════ 5. format du fichier ═════════════════════════════
print("5. format du fichier")
complet = {'v': 1, 'fait': '2026-10-14', 'jusqua': '2026-09', 'mois': ['2026-%02d' % m for m in range(1, 10)],
           'reserves': {'2026-06': 'texte inventé'}, 'fam': gm.FAM,
           'c': ['Alice', 'Bruno', 'Chloé', 'Guy', 'Tiffany'], 'o': ['2000001', '2000002', '2000003', '2000004', '2000005', 'EX2000006'],
           'r': [
               # [ci, oi, ym, ca, tot, p, p1, p2, i, c, fr, nr, caGen]
               [0, 0, 202601, 100.0, 10.0, 1.0, 0, 0, 9.0, 0, 0, 0, 5.0],
               [0, 1, 202601, 200.0, 20.0, 20.0, 0, 0, 0, 0, 0, 0, 0],       # officine PARTAGÉE : Alice
               [1, 1, 202601, 300.0, 30.0, 30.0, 0, 0, 0, 0, 0, 0, 0],       # ... et Bruno
               [1, 2, 202601, 400.0, 40.0, 0, 0, 0, 40.0, 0, 0, 0, 0],       # Bruno seul
               [2, 3, 202602, 500.0, 50.0, 0, 0, 0, 0, 50.0, 0, 0, 0],       # Chloé seule
               [3, 4, 202602, 600.0, 60.0, 0, 0, 0, 0, 0, 60.0, 0, 0],       # Guy (Escale)
               [4, 5, 202602, 700.0, 70.0, 0, 0, 0, 0, 0, 0, 70.0, 0],       # Tiffany (Escale)
           ]}
texte = gm.formater(complet)
check("l'en-tête dit de ne jamais commiter", texte.startswith('// ⚠️ NE JAMAIS COMMITER. Servi par adresse signée (Supabase).\n'))
check("window.MARGE_CLIENTS (jamais const)", 'window.MARGE_CLIENTS = {v:1' in texte and 'const ' not in texte)
check("aller-retour formater / analyser sans perte", gm.analyser(texte) == complet)
vide = dict(complet, c=[], o=[], r=[])
check("un jeu vide se relit aussi", gm.analyser(gm.formater(vide)) == vide)
try:
    gm.analyser('n\'importe quoi')
    check("un fichier illisible est refusé", False)
except ValueError:
    check("un fichier illisible est refusé", True)

# ═════════════════════════════ 6. découpage par commercial ═════════════════════════════
print("6. découpage : un jeu ne contient rien d'un collègue")
jeu_a = dc.marge_clients_du_jeu(complet, dc.comms_du_jeu('Alice'))
pr_a = {jeu_a['c'][r[0]] for r in jeu_a['r']}
off_a = {jeu_a['o'][r[1]] for r in jeu_a['r']}
check("jeu 'Alice' : uniquement les lignes d'Alice", pr_a == {'Alice'} and len(jeu_a['r']) == 2, jeu_a)
check("jeu 'Alice' : listes c et o réduites à ce qu'elles utilisent", jeu_a['c'] == ['Alice'] and jeu_a['o'] == ['2000001', '2000002'], (jeu_a['c'], jeu_a['o']))
check("jeu 'Alice' : AUCUNE officine d'un collègue (2000003, 2000004, 2000005, EX2000006)", not (off_a & {'2000003', '2000004', '2000005', 'EX2000006'}))
check("jeu 'Alice' : l'officine partagée ne porte que SA ligne", sum(r[3] for r in jeu_a['r'] if jeu_a['o'][r[1]] == '2000002') == 200.0)
check("jeu 'Alice' : les rangs pointent sur les bonnes valeurs", all(0 <= r[0] < len(jeu_a['c']) and 0 <= r[1] < len(jeu_a['o']) for r in jeu_a['r']))
check("jeu 'Alice' : mêmes métadonnées", all(jeu_a[k] == complet[k] for k in ('v', 'fait', 'jusqua', 'mois', 'reserves', 'fam')))
txt_a = gm.formater(jeu_a)
check("jeu 'Alice' : le TEXTE écrit ne contient ni 'Bruno', ni 'Chloé', ni le code d'une officine d'un collègue",
      'Bruno' not in txt_a and 'Chloé' not in txt_a and '2000003' not in txt_a and '2000004' not in txt_a and 'EX2000006' not in txt_a)
jeu_b = dc.marge_clients_du_jeu(complet, dc.comms_du_jeu('Bruno'))
check("jeu 'Bruno' : ses 2 lignes, l'officine partagée avec SA seule ligne",
      len(jeu_b['r']) == 2 and sum(r[3] for r in jeu_b['r'] if jeu_b['o'][r[1]] == '2000002') == 300.0)

jeu_ab = dc.marge_clients_du_jeu(complet, dc.comms_du_jeu('Alice+Bruno'))
def aplati(j):
    return sorted((j['c'][r[0]], j['o'][r[1]], r[2], r[3], r[4]) for r in j['r'])
check("jeu 'Alice+Bruno' = union exacte des deux jeux", aplati(jeu_ab) == sorted(aplati(jeu_a) + aplati(jeu_b)))
check("jeu 'Alice+Bruno' : l'officine partagée y est avec les DEUX lignes", sum(r[3] for r in jeu_ab['r'] if jeu_ab['o'][r[1]] == '2000002') == 500.0)
check("jeu 'Alice+Bruno' : rien de Chloé ni d'Escale", {jeu_ab['c'][r[0]] for r in jeu_ab['r']} == {'Alice', 'Bruno'} and 'Chloé' not in jeu_ab['c'])
jeu_e = dc.marge_clients_du_jeu(complet, dc.comms_du_jeu('Escale'))
check("jeu 'Escale' : Guy et Tiffany seulement", {jeu_e['c'][r[0]] for r in jeu_e['r']} == {'Guy', 'Tiffany'} and jeu_e['o'] == ['2000005', 'EX2000006'])
somme_tot = lambda j: round(sum(r[4] for r in j['r']), 2)
check("la somme des jeux d'une partition = le fichier complet",
      round(sum(somme_tot(dc.marge_clients_du_jeu(complet, {p})) for p in complet['c']), 2) == somme_tot(complet))
check("un prénom inconnu n'a aucune ligne", dc.marge_clients_du_jeu(complet, {'Zoé'})['r'] == [] and dc.marge_clients_du_jeu(complet, {'Zoé'})['o'] == [])
copie = [list(r) for r in complet['r']]
dc.marge_clients_du_jeu(complet, {'Alice'})
check("la fonction ne modifie pas le fichier complet", complet['r'] == copie)

jeu_o = dc.marge_clients_du_jeu(complet, dc.comms_du_jeu('OPSO'))
check("jeu OPSO (aucun prénom de vente) : aucune ligne", jeu_o['r'] == [])
import inspect
check("jeu_opso() n'écrit aucun marge-clients.js", 'marge-clients' not in inspect.getsource(dc.jeu_opso))
check("la boucle des jeux écrit marge-clients.js", "'marge-clients.js'" in inspect.getsource(dc.main) and "mc_complet" in inspect.getsource(dc.main))

# fichier complet absent : on prévient, on n'écrit rien, on n'échoue pas
import tempfile
base0 = dc.BASE
dc.BASE = tempfile.mkdtemp()
try:
    check("marge-clients.js absent : lire_marge_clients() rend None sans échouer", dc.lire_marge_clients() is None)
    with open(os.path.join(dc.BASE, 'marge-clients.js'), 'w', encoding='utf-8') as f:
        f.write(texte)
    lu = dc.lire_marge_clients()
    check("marge-clients.js présent : relu à l'identique", lu == complet)
    with open(os.path.join(dc.BASE, 'marge-clients.js'), 'w', encoding='utf-8') as f:
        f.write('abîmé')
    check("marge-clients.js abîmé : None sans échouer", dc.lire_marge_clients() is None)
finally:
    dc.BASE = base0

# ── mois de remplacement (décision du 15/10/2026 : juin compté avec la marge par boîte de juillet) ──
A13, B13, C13 = '3400000000011', '3400000000028', '3400000000035'
R = gm.lire_remplacements([{'mois': '2026-06', 'par': '2026-07', 'motif': 'prix changé en cours de mois',
                            'produits': {'Produit A': [A13, B13], 'Produit C': [C13]}}])
check("remplacement lu : juin -> juillet, trois codes, deux produits",
      list(R) == [202606] and R[202606]['par'] == 202607 and R[202606]['cips'] == {A13: 'Produit A', B13: 'Produit A', C13: 'Produit C'})
check("mention tirée du réglage : produits, mois de remplacement, motif",
      R[202606]['texte'] == 'Produit A et Produit C comptés avec leur marge par boîte de juillet (prix changé en cours de mois)', R[202606]['texte'])
check("mention : un seul produit au singulier ; autre année = année écrite",
      gm.mention(['Produit A'], 202612, 202701) == 'Produit A compté avec sa marge par boîte de janvier 2027')
for nom, mauvais in (("mois mal écrit", {'mois': '2026-6', 'par': '2026-07', 'produits': {'A': [A13]}}),
                     ("code produit trop court", {'mois': '2026-06', 'par': '2026-07', 'produits': {'A': ['3400']}}),
                     ("produit sans code", {'mois': '2026-06', 'par': '2026-07', 'produits': {'A': []}}),
                     ("mois remplacé par lui-même", {'mois': '2026-06', 'par': '2026-06', 'produits': {'A': [A13]}})):
    try:
        gm.lire_remplacements([mauvais])
        check("réglage refusé : " + nom, False)
    except Exception:
        check("réglage refusé : " + nom, True)
check("aucun remplacement dans le réglage : rien", gm.lire_remplacements(None) == {})
T = ({A13: {100.0: [50.0, 10.0], 120.0: [36.0, 3.0]}}, {'Produit A': {100.0: [60.0, 12.0], 90.0: [8.0, 2.0]}})
check("par boîte : même code au même brut d'abord (50 / 10)", gm.par_boite(T, A13, 'Produit A', 100.0) == (5.0, 'code même brut'))
check("par boîte : code absent ce mois-là -> même produit au même brut (60 / 12)", gm.par_boite(T, B13, 'Produit A', 100.0) == (5.0, 'produit même brut'))
check("par boîte : le même brut sur un autre code passe avant le brut proche du même code (8 / 2)", gm.par_boite(T, A13, 'Produit A', 90.0) == (4.0, 'produit même brut'))
check("par boîte : brut inconnu -> brut le plus proche du même code (36 / 3)", gm.par_boite(T, A13, 'Produit A', 118.0) == (12.0, 'code brut proche'))
check("par boîte : produit non vendu ce mois-là -> rien (cascade ordinaire)", gm.par_boite(T, C13, 'Produit C', 100.0) == (None, None))
lg, c = {}, cascade()
src, m = gm.ajouter(lg, ('Alice', 'o1', 202606), G(A13, B=100.0, N=90.0, q=3), 202606, c, c.L, marge=15.0)
check("marge imposée : comptée telle quelle, dans la famille du prix net de juin", src == 'mois de remplacement' and m == 15.0 and lg[('Alice', 'o1', 202606)][3] == 15.0)

# ── baisses de prix (décision du 15/10/2026 : une baisse de prix ne compte jamais dans la marge d'un commercial) ──
def om_(*l):
    """(régime, code, ym, brut, marge par boîte, boîtes, net par boîte) -> Cascade.OM."""
    return {(r, c, ym, B): [mb * q, q, nb * q] for r, c, ym, B, mb, q, nb in l}
V = {(2026, A13): {202605: {100.0: 50}, 202606: {90.0: 40, 100.0: 5}, 202607: {90.0: 45}}}
OMb = om_((2026, A13, 202605, 100.0, 4.0, 10, 100.0), (2026, A13, 202606, 90.0, -6.0, 10, 90.0), (2026, A13, 202607, 90.0, 3.5, 10, 90.0))
check("baisse : brut plus bas et marge effondrée -> mois touché, référence = mois suivant",
      gm.detecter_baisses(OMb, V) == {202606: {A13: (202607, None, 100.0)}}, gm.detecter_baisses(OMb, V))
check("baisse sans perte (marge normale au nouveau prix) : rien",
      gm.detecter_baisses(om_((2026, A13, 202605, 100.0, 4.0, 10, 100.0), (2026, A13, 202606, 90.0, 3.4, 10, 90.0), (2026, A13, 202607, 90.0, 3.5, 10, 90.0)), V) == {})
check("hausse de prix (brut plus haut) : rien",
      gm.detecter_baisses(om_((2026, A13, 202605, 80.0, 4.0, 10, 80.0), (2026, A13, 202606, 90.0, -6.0, 10, 90.0), (2026, A13, 202607, 90.0, 3.5, 10, 90.0)),
                          {(2026, A13): {202605: {80.0: 50}, 202606: {90.0: 40}, 202607: {90.0: 45}}}) == {})
check("baisse de 0,5 % seulement : rien (seuil 1 %)",
      gm.detecter_baisses(om_((2026, A13, 202605, 100.0, 4.0, 10, 100.0), (2026, A13, 202606, 99.5, -6.0, 10, 99.5), (2026, A13, 202607, 99.5, 3.5, 10, 99.5)),
                          {(2026, A13): {202605: {100.0: 50}, 202606: {99.5: 40}, 202607: {99.5: 45}}}) == {})
check("code déjà dans un mois de remplacement du réglage : le réglage garde la main",
      gm.detecter_baisses(OMb, V, {202606: {A13}}) == {})
Vd = {(2026, A13): {202605: {100.0: 50}, 202606: {90.0: 40}}}
OMd = om_((2026, A13, 202605, 100.0, 4.0, 10, 100.0), (2026, A13, 202606, 90.0, -6.0, 10, 90.0))
r_d = gm.detecter_baisses(OMd, Vd)
check("baisse du dernier mois lu : pas de mois suivant -> taux d'avant la baisse (4 / 100)",
      list(r_d) == [202606] and r_d[202606][A13][0] is None and proche(r_d[202606][A13][1], 0.04), r_d)
Vc = {(2026, A13): {202605: {100.0: 50}, 202606: {90.0: 40}, 202607: {80.0: 40}, 202608: {80.0: 40}}}
OMc = om_((2026, A13, 202605, 100.0, 4.0, 10, 100.0), (2026, A13, 202606, 90.0, -6.0, 10, 90.0),
          (2026, A13, 202607, 80.0, -5.0, 10, 80.0), (2026, A13, 202608, 80.0, 3.0, 10, 80.0))
check("deux baisses de suite : la référence saute le mois lui-même touché",
      gm.detecter_baisses(OMc, Vc) == {202606: {A13: (202608, None, 100.0)}, 202607: {A13: (202608, None, 90.0)}}, gm.detecter_baisses(OMc, Vc))
check("régimes séparés : une vente de 2027 n'est jamais comparée à 2026",
      gm.detecter_baisses(om_((2026, A13, 202612, 100.0, 4.0, 10, 100.0), (2027, A13, 202701, 90.0, -6.0, 10, 90.0), (2027, A13, 202702, 90.0, 3.5, 10, 90.0)),
                          {(2026, A13): {202612: {100.0: 50}}, (2027, A13): {202701: {90.0: 40}, 202702: {90.0: 40}}}) == {})
check("baisse : référence vendue à un autre brut -> même taux de marge (2,70 à 90 € contre 3 × 90 / 80 = 3,375 attendus : perte)",
      gm.detecter_baisses(om_((2026, A13, 202605, 100.0, 4.0, 10, 100.0), (2026, A13, 202606, 90.0, 2.7, 10, 90.0), (2026, A13, 202607, 80.0, 3.0, 10, 80.0)),
                          {(2026, A13): {202605: {100.0: 50}, 202606: {90.0: 40}, 202607: {80.0: 45}}}) == {202606: {A13: (202607, None, 100.0)}})
Tb = ({A13: {90.0: [35.0, 10.0]}}, {A13: {90.0: [35.0, 10.0]}})
info = (202607, None, 100.0)
check("boîtes au prix baissé : marge par boîte du mois de référence au même brut (4 × 3,5)",
      gm.marge_baisse(G(A13, B=90.0, N=88.0, q=4), info, {202607: Tb}, -24.0) == (14.0, 'code même brut'))
r_b = gm.marge_baisse(G(A13, B=80.0, N=78.0, q=2), info, {202607: Tb}, -10.0)
check("boîtes à un brut absent du mois de référence : même taux de marge (2 × 3,5 × 80 / 90)",
      proche(r_b[0], 2 * 3.5 * 80 / 90) and r_b[1] == 'code brut proche', r_b)
check("la règle ne fait jamais baisser une marge : ordinaire 20 € > 14 € -> rien d'imposé",
      gm.marge_baisse(G(A13, B=90.0, N=88.0, q=4), info, {202607: Tb}, 20.0) == (None, 'marge ordinaire déjà au niveau'))
check("dernier mois lu : taux d'avant la baisse × net (0,04 × 10 × 90)",
      gm.marge_baisse(G(A13, B=90.0, N=90.0, q=10), (None, 0.04, 100.0), {}, -5.0)[0] == 0.04 * 900)
check("code non vendu au mois de référence : cascade ordinaire",
      gm.marge_baisse(G(B13, B=90.0, N=88.0, q=4), info, {202607: Tb}, -24.0) == (None, None))
check("mention : un produit, référence connue (élision « d'août »)",
      gm.texte_baisses({A13: (202608, None)}, 202607) == "1 produit dont le prix a baissé compté avec sa marge par boîte d'août : la perte sur le stock n'est pas comptée",
      gm.texte_baisses({A13: (202608, None)}, 202607))
check("mention : en plus d'un mois de remplacement = « autres »",
      gm.texte_baisses({A13: (202607, None), B13: (202607, None)}, 202606, autres=True) == "2 autres produits dont le prix a baissé comptés avec leur marge par boîte de juillet : la perte sur le stock n'est pas comptée")
check("mention : dernier mois lu = en attendant le mois suivant (décembre -> janvier 2027)",
      gm.texte_baisses({A13: (None, 0.04)}, 202612) == "1 produit dont le prix a baissé compté avec sa marge d'avant la baisse, en attendant les ventes de janvier 2027 : la perte sur le stock n'est pas comptée",
      gm.texte_baisses({A13: (None, 0.04)}, 202612))

# ═════════════════════════════ 8. rentabilité : jours de commande et coût d'une livraison (28/10/2026) ═════════════════════════════
print("8. rentabilité : jours, moyenne de tous les clients, coût d'une livraison")
J = gm.jours_par_mois([('2000002', '2026-01-05'), ('2000002', '2026-01-05'),   # même jour vu par Alice ET Bruno = UN jour
                       ('2000002', '2026-01-19'), ('2000001', '2026-02-02'), ['2000001', '2026-02-03'],
                       ('INTER', '2026-01-05'), ('2269223', '2026-04-30'), ('2269223', '2026-04-29'), ('2000003', 'None')])
check("jours : dates DISTINCTES par officine-mois, INTER, jour anormal et date illisible écartés",
      J == {('2000002', 202601): 2, ('2000001', 202602): 2, ('2269223', 202604): 1}, J)
liv = {'v': 1, 'fait': '2026-10-28', 'jusqua': '2026-02', 'mois': ['2026-01', '2026-02'], 'reserves': {}, 'fam': gm.FAM,
       'c': ['Alice', 'Bruno'], 'o': ['2000001', '2000002', '2000003'],
       'r': [[0, 0, 202601, 500.0, 100.0, 0, 0, 0, 100.0, 0, 0, 0, 0, 0],
             [0, 0, 202602, 500.0, 300.0, 0, 0, 0, 300.0, 0, 0, 0, 0, 4],
             [0, 1, 202601, 200.0, 50.0, 50.0, 0, 0, 0, 0, 0, 0, 0, 2],     # officine PARTAGÉE : même valeur de jours
             [1, 1, 202601, 200.0, 30.0, 30.0, 0, 0, 0, 0, 0, 0, 0, 2],     # sur la ligne de chaque commercial
             [1, 2, 202601, 100.0, 10.0, 10.0, 0, 0, 0, 0, 0, 0, 0, 0]]}    # aucun jour : hors moyenne
vus = {(liv['o'][r[1]], r[2]): r[13] for r in liv['r']}
moy = gm.moyenne_livraison(liv, vus, 20.0)
# 2000001 : 400 € · 4 jours sur 1 mois -> jm 4 · 100 €/jour · (400-80)/1 = 320 ; 2000002 : 80 € · 2 jours sur 1 mois -> 2 · 40 · 40
check("moyenne : officine moyenne de tous les clients (jours max par mois, jamais la somme des deux commerciaux)",
      moy == {'n': 2, 'jm': 3.0, 'parJour': 70.0, 'renta': 180.0}, moy)
check("moyenne : aucune officine avec des jours = None", gm.moyenne_livraison(liv, {}, 20.0) is None)
check("arrondi de la page (Math.round) et non arrondi au pair", gm.arrondi_js(0.125) == 0.13 and round(0.125, 2) == 0.12)
liv['livraison'] = {'cout': 20.0, 'moy': moy}
t_liv = gm.formater(liv)
check("la ligne livraison est écrite entre o: et r:[", "o:[\"2000001\",\"2000002\",\"2000003\"],\nlivraison:{" in t_liv and "},\nr:[" in t_liv)
check("aller-retour formater / analyser avec livraison et jours", gm.analyser(t_liv) == liv)
check("un fichier d'avant le 28/10/2026 (sans livraison) se relit toujours", 'livraison' not in gm.analyser(gm.formater(complet)))
jl_a = dc.marge_clients_du_jeu(liv, dc.comms_du_jeu('Bruno'))
check("découpage : le jeu de Bruno garde la moyenne de TOUS les clients, recopiée telle quelle", jl_a['livraison'] == liv['livraison'] and len(jl_a['o']) == 2)
check("découpage : la valeur jours voyage avec la ligne", sorted(r[13] for r in jl_a['r']) == [0, 2])
check("découpage : sans livraison dans le fichier complet, aucune clé inventée", 'livraison' not in dc.marge_clients_du_jeu(complet, {'Alice'}))
import json
import tempfile
prive_ok = {'laboratoires_contenant': ['X'], 'petit_par_boite': 0.1}
def prive_avec(**kw):
    f = tempfile.NamedTemporaryFile('w', suffix='.json', delete=False)
    json.dump(dict(prive_ok, **kw), f)
    f.close()
    gm.PRIVE, ancien = f.name, gm.PRIVE
    try:
        return gm.lire_prive()
    finally:
        gm.PRIVE = ancien
        os.remove(f.name)
check("réglage privé : cout_livraison lu", prive_avec(cout_livraison=20)['cout_livraison'] == 20.0)
check("réglage privé : coût absent = None (pas de bloc), le reste du réglage reste lisible", prive_avec()['cout_livraison'] is None and prive_avec()['petit'] == 0.1)
check("réglage privé : coût illisible ou nul = None, jamais une valeur par défaut",
      all(prive_avec(cout_livraison=v)['cout_livraison'] is None for v in ('20', None, True, 0, -5)))

print()
if ECHECS:
    print("ÉCHECS (%d) : %s" % (len(ECHECS), ", ".join(ECHECS)))
    sys.exit(1)
print("Tous les tests passent.")
