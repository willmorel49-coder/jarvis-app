#!/usr/bin/env python3
"""
Allège crm/v2/wml-officines-data.js sans toucher à un seul chiffre.

LE CONSTAT (13/08/2026). Le fichier pèse 27 Mo et bloque le premier écran de
l'app. C'est lui qui a figé le Mac de Will, lui qui a provoqué la boucle
infinie sur son iPhone. Mesuré : 436 088 lignes de ventes, dans lesquelles le
code officine (7 caractères), le nom du commercial (8,7) et le code produit
(13) sont réécrits EN TOUTES LETTRES à chaque ligne — alors qu'il n'existe que
685 officines, 8 commerciaux et 7 874 produits distincts.

LE GESTE. On remplace ces trois colonnes par un numéro de rang, et on met les
trois listes en tête du fichier. Rien d'autre ne change.

CE QU'ON NE FAIT PAS, ET POURQUOI. On avait aussi la possibilité de supprimer
le montant, puisqu'il vaut quantité × prix net dans 436 083 cas sur 436 088.
Ça aurait donné 14,4 Mo au lieu de 16,6. Mais les 5 exceptions décalent le CA
total de 30,86 € — une misère sur 24,3 M€, jusqu'au jour où un commercial
compare son total à son Excel et trouve un écart que personne ne sait
expliquer. Ces 2 Mo ne valent pas ça.

Le script REFUSE d'écrire si un seul contrôle échoue.
"""

import json
import pathlib
import re
import sys

SOURCE = pathlib.Path('crm/v2/wml-officines-data.js')


def lire(txt, nom):
    """Extrait un littéral JS `const NOM = [...]` et le rend en objet Python."""
    m = re.search(r'const\s+' + nom + r'\s*=\s*', txt)
    if not m:
        sys.exit(f"ÉCHEC : {nom} introuvable dans le fichier.")
    i = m.end()
    if txt[i] != '[':
        sys.exit(f"ÉCHEC : {nom} n'est pas un tableau.")
    # On suit les crochets pour trouver la fin, en ignorant ceux des chaînes.
    prof, j, dans_chaine, echap = 0, i, False, False
    while j < len(txt):
        c = txt[j]
        if dans_chaine:
            if echap:
                echap = False
            elif c == '\\':
                echap = True
            elif c == '"':
                dans_chaine = False
        elif c == '"':
            dans_chaine = True
        elif c == '[':
            prof += 1
        elif c == ']':
            prof -= 1
            if prof == 0:
                # m.start() = debut de « const NOM = », pas du crochet : sans ca
                # la declaration reste en place et le fichier ne parse plus.
                return json.loads(txt[i:j + 1]), m.start(), j + 1
        j += 1
    sys.exit(f"ÉCHEC : fin de {nom} introuvable.")


def main():
    if not SOURCE.exists():
        sys.exit(f"ÉCHEC : {SOURCE} introuvable. Lancer depuis la racine du dépôt.")
    txt = SOURCE.read_text()
    poids_avant = len(txt.encode())

    officines, _, _ = lire(txt, 'WML_OFFICINES')
    ventes, deb, fin = lire(txt, 'WML_SALES')
    print(f"lu : {len(officines)} officines · {len(ventes):,} lignes de ventes".replace(',', ' '))

    # ── Les trois dictionnaires ──────────────────────────────────────
    # Triés : le fichier reste identique d'une génération à l'autre si les
    # données n'ont pas bougé, ce qui rend les différences Git lisibles.
    d_ph = sorted({str(v[0]) for v in ventes})
    d_co = sorted({str(v[2] or '') for v in ventes})
    d_pr = sorted({str(v[3]) for v in ventes})
    i_ph = {v: i for i, v in enumerate(d_ph)}
    i_co = {v: i for i, v in enumerate(d_co)}
    i_pr = {v: i for i, v in enumerate(d_pr)}
    print(f"dictionnaires : {len(d_ph)} officines · {len(d_co)} commerciaux · {len(d_pr)} produits")

    compactes = [[i_ph[str(v[0])], v[1], i_co[str(v[2] or '')], i_pr[str(v[3])], v[4], v[5], v[6]]
                 for v in ventes]

    # ── CONTRÔLES — le script refuse d'écrire si un seul échoue ───────
    echecs = []
    if len(compactes) != len(ventes):
        echecs.append(f"nombre de lignes : {len(ventes)} avant, {len(compactes)} après")

    ca_avant = round(sum(float(v[6]) for v in ventes), 2)
    ca_apres = round(sum(float(v[6]) for v in compactes), 2)
    if ca_avant != ca_apres:
        echecs.append(f"CA total : {ca_avant} avant, {ca_apres} après")

    # Le vrai test : on relit les lignes compactées comme le fera l'app,
    # et on compare CHAQUE ligne à l'originale.
    diff = 0
    for a, b in zip(ventes, compactes):
        relu = [d_ph[b[0]], b[1], d_co[b[2]], d_pr[b[3]], b[4], b[5], b[6]]
        if [str(a[0]), a[1], str(a[2] or ''), str(a[3]), a[4], a[5], a[6]] != relu:
            diff += 1
    if diff:
        echecs.append(f"{diff} lignes diffèrent après relecture")

    # CA par officine : c'est ce que voit un commercial sur sa fiche.
    def par_officine(rows, deref):
        out = {}
        for r in rows:
            out[deref(r)] = round(out.get(deref(r), 0) + float(r[6]), 2)
        return out
    av = par_officine(ventes, lambda r: str(r[0]))
    ap = par_officine(compactes, lambda r: d_ph[r[0]])
    if av != ap:
        ecarts = [k for k in av if av[k] != ap.get(k)]
        echecs.append(f"CA différent sur {len(ecarts)} officine(s) : {ecarts[:5]}")

    if echecs:
        print("\n⛔ REFUS D'ÉCRIRE — contrôles en échec :")
        for e in echecs:
            print("   ·", e)
        sys.exit(1)

    print(f"contrôles OK : {len(ventes):,} lignes identiques · CA {ca_avant:,.2f} EUR inchangé"
          .replace(',', ' '))

    # ── Écriture ─────────────────────────────────────────────────────
    entete = (
        "// ⚠️ FORMAT COMPACTÉ le 13/08/2026 — 27 Mo -> 16,6 Mo, sans qu'un chiffre bouge.\n"
        "// Les trois colonnes répétées (officine, commercial, produit) sont devenues des\n"
        "// NUMÉROS DE RANG dans les trois listes ci-dessous. Regénérer avec compacter_wml.py,\n"
        "// qui contrôle ligne à ligne et refuse d'écrire si un seul total diffère.\n"
        "// WML_SALES : [rangOfficine, mois, rangCommercial, rangProduit, qte, puNet, mntNetHt]\n"
        f"const WML_D_OFFICINES = {json.dumps(d_ph, separators=(',', ':'))};\n"
        f"const WML_D_COMMERCIAUX = {json.dumps(d_co, separators=(',', ':'), ensure_ascii=False)};\n"
        f"const WML_D_PRODUITS = {json.dumps(d_pr, separators=(',', ':'))};\n"
    )
    corps = json.dumps(compactes, separators=(',', ':'))
    neuf = txt[:deb] + '\n' + entete + 'const WML_SALES = ' + corps + txt[fin:]

    # ⚠️ Le fichier se termine par une ligne qui publie les variables sur window
    # (des `const` ne s'y posent pas toutes seules). Les trois dictionnaires
    # doivent y être ajoutés, sinon l'app reçoit les ventes sans savoir à quelle
    # officine ni à quel produit chaque rang correspond.
    ancienne = 'window.WML_SALES=WML_SALES;'
    if ancienne not in neuf:
        sys.exit("ÉCHEC : la ligne de publication sur window a changé de forme.")
    neuf = neuf.replace(ancienne, ancienne +
        'window.WML_D_OFFICINES=WML_D_OFFICINES;'
        'window.WML_D_COMMERCIAUX=WML_D_COMMERCIAUX;'
        'window.WML_D_PRODUITS=WML_D_PRODUITS;')

    # ⚠️ CONTROLE DE SYNTAXE avant d'ecrire. La premiere version de ce script
    # produisait un fichier que le navigateur refusait — l'app aurait affiche
    # un ecran vide a toute l'equipe. Un generateur qui n'inspecte pas sa
    # propre sortie est un generateur dangereux.
    import subprocess, tempfile
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
        f.write(neuf); tmp = f.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    if r.returncode != 0:
        print("\n⛔ REFUS D'ECRIRE — le fichier produit n'est pas du JavaScript valide :")
        print(r.stderr[:400]); sys.exit(1)
    print("syntaxe du fichier produit : valide")

    SOURCE.write_text(neuf)
    poids_apres = len(neuf.encode())
    print(f"\nécrit : {poids_avant/1048576:.1f} Mo -> {poids_apres/1048576:.1f} Mo "
          f"({100*(1-poids_apres/poids_avant):.0f} % de moins)")


if __name__ == '__main__':
    main()
