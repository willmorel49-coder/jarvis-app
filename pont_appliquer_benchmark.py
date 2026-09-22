#!/usr/bin/python3
# -*- coding: utf-8 -*-
"""Range crm/benchmark-data.js sous les codes gardés du pont (un produit = un code, 22/09/2026).

Le fichier en ligne a été enrichi après generate_benchmark_v2.py (codes CIP ajoutés le 16/09) :
le régénérer effacerait cet enrichissement. On corrige donc le fichier EN PLACE, ligne par ligne,
sans toucher au reste : une fiche sous un ancien code passe sous le code gardé ; si une fiche
existe déjà sous le code gardé, les deux sont réunies (quantités additionnées, la fiche du code
gardé l'emporte pour le nom et les prix, Ameli pris là où il existe) et la ligne de l'ancienne
reste À SA PLACE avec un cip13 vide : le front recolle les conditions protégées (BENCH_COND)
PAR POSITION et refuse tout si le nombre de lignes change. Relançable sans effet."""
import os, re
from pont_codes import canon
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm', 'benchmark-data.js')
RX = re.compile(r'(\w+):("(?:[^"\\]|\\.)*"|\[[^\]]*\]|[^,}]+)')
lignes = open(F, encoding='utf-8').read().split('\n')
def champs(l):
    return dict(RX.findall(l))
def poser(l, nom, val):
    return re.sub(r'(?<=[{,])%s:(?:"(?:[^"\\]|\\.)*"|\[[^\]]*\]|[^,}]+)' % nom, '%s:%s' % (nom, val), l, count=1)
par_code = {}
for i, l in enumerate(lignes):
    m = re.search(r'cip13:"(\d+)"', l)
    if m and l.lstrip().startswith('{'):
        par_code.setdefault(m.group(1), []).append(i)
deplaces = reunis = 0; a_supprimer = set()
for c, idx in list(par_code.items()):
    k = canon(c)
    if k == c:
        continue
    for i in idx:
        deplaces += 1
        cible = [j for j in par_code.get(k, []) if j != i and j not in a_supprimer]
        if not cible:
            lignes[i] = poser(lignes[i], 'cip13', '"%s"' % k)
            par_code.setdefault(k, []).append(i)
            continue
        j = cible[0]; g, r = champs(lignes[j]), champs(lignes[i]); l = lignes[j]
        # le fichier enrichi n'a pas tous les champs du générateur : on ne réunit que ce qui existe
        for f in ('ip_qty', 'ip_ca'):
            if f in g and f in r:
                v = float(g[f]) + float(r[f]); l = poser(l, f, str(int(v)) if f == 'ip_qty' else '%.2f' % v)
        for f in ('ip_rank_qty', 'ip_rank_ca'):
            if f in g and f in r and int(float(r[f])) and (not int(float(g[f])) or int(float(r[f])) < int(float(g[f]))):
                l = poser(l, f, r[f])
        if float(g.get('prix_ht', 0)) == 0 and float(r.get('prix_ht', 0)) > 0:
            for f in ('prix_ht', 'prix_ip', 'remise_pct', 'offre_ip'):
                if f in g and f in r:
                    l = poser(l, f, r[f])
        if r.get('is_froid') == 'true':
            l = poser(l, 'is_froid', 'true')
        if g.get('has_ameli') != 'true' and r.get('has_ameli') == 'true':
            for f in ('has_ameli', 'ameli_months', 'ameli_jan26', 'rot_pharma_jan26', 'ameli_total', 'yoy_jan', 'atc2'):
                if f in g and f in r:
                    l = poser(l, f, r[f])
        if g.get('artnature') == '""' and r.get('artnature', '""') != '""':
            l = poser(l, 'artnature', r['artnature'])
        lignes[j] = l; lignes[i] = poser(lignes[i], 'cip13', '""'); a_supprimer.add(i); reunis += 1
out = lignes   # rien n'est supprimé (alignement des conditions par position)
open(F, 'w', encoding='utf-8').write('\n'.join(out))
print('benchmark : %d fiches rangées sous leur code gardé, dont %d réunies avec une fiche existante ; %d lignes → %d'
      % (deplaces, reunis, len(lignes), len(out)))
