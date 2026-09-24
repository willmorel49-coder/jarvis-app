#!/usr/bin/env python3
"""Un jeu de ventes PAR COMMERCIAL — le vrai verrou de la confidentialité (24/09/2026).

POURQUOI
La DR (Pascale Prieto) : un commercial ne doit JAMAIS voir les ventes des officines
d'un collègue. Le 24/09 (temps 1) les écrans les masquaient, mais le téléphone
recevait encore TOUTES les ventes. Ici (temps 2), chaque commercial a son propre
dossier sur Supabase, et une règle d'accès (docs/supabase/ventes-par-commercial.sql)
l'empêche d'ouvrir celui des autres — ou les fichiers complets.

CE QU'IL Y A DANS UN JEU (crm/v2/ventes/<empreinte>/)
  wml-ventes-NN.js      · le détail de SES officines (mêmes lignes que le fichier complet)
                        · + le RESTE DU RÉSEAU en total par (mois, produit), sur une
                          officine fictive sans commercial (rang -1 → '') : « 0 » (rang -1)
                          hors Escale, « 0E » (rang -2) pour la part que garde l'espace Escale :
                          les sommes par produit restent exactes (décision de Will : les
                          agrégats par PRODUIT sur tout le réseau sont acceptés), aucune
                          officine d'un collègue n'y figure.
  wml-ventes-index.js   nombre de tranches + empreinte (rangement sur l'appareil) + les
                        repères réseau que le navigateur ne peut plus compter lui-même, par
                        espace (T = Intégral, E = Escale) : officines actives par mois (act),
                        sur la période (nph), rang de SES officines au CA (rg) sur (no).
  wml-officines-ca.js   CA + potentiel de SES officines seulement
  carte-detail.js       fiche de la carte : SES officines seulement

QUI A UN JEU
  · chaque prénom du dictionnaire des ventes (un compte créé demain marche tout de suite) ;
  · chaque valeur « commercial » d'un profil restreint (ex. « Céline+Inès+Valérie ») ;
  · « Escale » = les quatre commerciaux Escale.
Le dossier = 16 premiers caractères hexadécimaux du SHA-256 de la valeur EXACTE du
champ `commercial` du profil — calculé à l'identique par le navigateur (v2-boot.js)
et par la règle d'accès (SQL).

« Mes officines » = ses `comms` contiennent l'un des prénoms du jeu : même règle
que V2.estMonOfficine (v2-boot.js), sinon l'écran et les données divergent.

Usage : python3 decouper_par_commercial.py      (relançable, efface et réécrit crm/v2/ventes/)
Sortie ≠ 0 = jeu incomplet : NE PAS publier.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.join(BASE, 'crm', 'v2')
SORTIE = os.path.join(V2, 'ventes')
TAILLE_TRANCHE = 1_500_000
ESCALE_COMMS = ['Guy', 'Tiffany', 'Philippe', 'Germain']   # = V2.ESCALE_COMMS (v2-boot.js)
PROJET = 'iyvavhnlhxksokkerkos'
CLE = os.path.expanduser('~/.config/jarvis/service-role-key')

compact = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))


def dossier(commercial):
    return hashlib.sha256(commercial.encode('utf-8')).hexdigest()[:16]


def lire(chemin):
    with open(chemin, encoding='utf-8') as f:
        return f.read()


def ecrire(chemin, texte):
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, 'w', encoding='utf-8') as f:
        f.write(texte)


def declaration(texte, nom):
    m = re.search(r'^const ' + nom + r' = (.*);$', texte, re.M)
    if not m:
        sys.exit('ARRÊT : %s introuvable dans l\'en-tête' % nom)
    return json.loads(m.group(1))


def profils_restreints():
    """Valeurs `commercial` des profils restreints. Lecture seule (service_role).
    Illisible = on S'ARRÊTE : un jeu manquant, c'est un commercial sans aucun chiffre."""
    cle = open(CLE).read().strip()
    r = subprocess.run(
        ['curl', '-s', '--max-time', '30',
         'https://%s.supabase.co/rest/v1/user_profiles?select=commercial,voit_tous_commerciaux' % PROJET,
         '-H', 'apikey: ' + cle, '-H', 'Authorization: Bearer ' + cle],
        capture_output=True, text=True)
    try:
        lignes = json.loads(r.stdout)
        assert isinstance(lignes, list) and lignes
    except Exception:
        sys.exit('ARRÊT : profils Supabase illisibles (%s) — aucun jeu écrit' % r.stdout[:200])
    return sorted({(l.get('commercial') or '') for l in lignes
                   if (l.get('commercial') or '').strip() and not l.get('voit_tous_commerciaux')})


def comms_du_jeu(commercial):
    parts = [p.strip() for p in commercial.split('+') if p.strip()]
    if commercial == 'Escale':
        return set(ESCALE_COMMS)
    return set(parts)


def noms_produits():
    """Mêmes noms que la fiche de la carte (generate_wml_v2.py, load_benchmark_names)."""
    from pont_codes import rekey
    noms = {}
    txt = lire(os.path.join(BASE, 'crm', 'benchmark-data.js'))
    for m in re.finditer(r'designation:"([^"]*)"[^}]*?cip13:"(\d+)"', txt):
        noms[m.group(2)] = m.group(1)
    for l in open(os.path.join(V2, 'catalogue-complet-data.js'), encoding='utf-8'):
        m = re.match(r'\["(\d{8,14})","((?:[^"\\]|\\.)*)"', l)
        if m and m.group(1) not in noms and m.group(2):
            noms[m.group(1)] = json.loads('"' + m.group(2) + '"')
    return rekey(noms)


def tranches(lignes):
    out, cour, poids = [], [], 0
    for v in lignes:
        t = len(compact(v)) + 1
        if cour and poids + t > TAILLE_TRANCHE:
            out.append(cour); cour, poids = [], 0
        cour.append(v); poids += t
    if cour:
        out.append(cour)
    return out


def main():
    tete = lire(os.path.join(V2, 'wml-officines-data.js'))
    officines = declaration(tete, 'WML_OFFICINES')
    d_off = declaration(tete, 'WML_D_OFFICINES')
    d_com = declaration(tete, 'WML_D_COMMERCIAUX')
    n_tete = int(re.search(r'window\.WML_TRANCHES = (\d+);', tete).group(1))

    ventes = []
    for i in range(1, n_tete + 1):
        t = lire(os.path.join(V2, 'wml-ventes-%02d.js' % i))
        m = re.search(r'var c=(\[.*\]);for\(var i=0', t, re.S)
        if not m:
            sys.exit('ARRÊT : tranche %02d illisible' % i)
        ventes.extend(json.loads(m.group(1)))
    if not ventes or not isinstance(ventes[0][0], int):
        sys.exit('ARRÊT : ventes absentes ou pas au format compacté')

    comms_par_code = {}
    for o in officines:
        for k in (o.get('id'), o.get('code')):
            if k is not None:
                comms_par_code[re.sub(r'[^0-9]', '', str(k))] = set(o.get('comms') or [])
    comms_rang = [comms_par_code.get(re.sub(r'[^0-9]', '', str(c)), set()) for c in d_off]

    ca = lire(os.path.join(BASE, 'wml-officines-ca.js'))
    m_ca = re.search(r'window\.WML_OFF_CA = \{n:\d+, m:(\{.*\})\};', ca, re.S)
    off_ca = json.loads(m_ca.group(1)) if m_ca else sys.exit('ARRÊT : wml-officines-ca.js illisible')
    tete_ca = ca[:m_ca.start()]
    det = lire(os.path.join(V2, 'carte-detail.js'))
    m_det = re.search(r'window\.CARTE_DETAIL=(\{.*\});?\s*$', det, re.S)
    carte = json.loads(m_det.group(1)) if m_det else sys.exit('ARRÊT : carte-detail.js illisible')
    tete_det = det[:m_det.start()]

    # Ce que garde applyEscalePerimeter (v2-boot.js) : officine Escale ET commercial Escale.
    esc_off = [bool(c & set(ESCALE_COMMS)) for c in comms_rang]
    esc_com = [c in ESCALE_COMMS for c in d_com]
    garde_e = [esc_off[v[0]] and esc_com[v[2]] for v in ventes]

    def reperes(filtre):
        act, ca = {}, {}
        for v, ok in zip(ventes, filtre):
            if not ok:
                continue
            act.setdefault(v[1], set()).add(v[0])
            ca[v[0]] = ca.get(v[0], 0) + v[6]
        rang = sorted(ca, key=lambda r: -ca[r])
        # rang dans son groupement, parmi TOUTES les officines du groupement (même sans vente),
        # comme la fiche (v2-pharma.js) — groupement pris tel qu'écrit (la fiche le canonise).
        ca_code = {d_off[r]: v for r, v in ca.items()}
        grp = {}
        for o in officines:
            g = str(o.get('groupement') or '').strip()
            # espace Escale : ses officines seulement (applyEscalePerimeter)
            if g and g != '—' and (filtre is garde_t or set(o.get('comms') or []) & set(ESCALE_COMMS)):
                grp.setdefault(g, []).append(str(o.get('id')))
        rgg = {}
        for g, ids in grp.items():
            if len(ids) >= 2:
                tri = sorted(ids, key=lambda c: -ca_code.get(c, 0))
                for i, c in enumerate(tri):
                    rgg[c] = [i + 1, len(ids)]
        return {'act': {m: len(x) for m, x in act.items()}, 'nph': len(ca),
                'rg': {d_off[r]: i + 1 for i, r in enumerate(rang)}, 'no': len(rang), 'rgg': rgg}
    garde_t = [True] * len(ventes)
    rep_t = reperes(garde_t)
    rep_e = reperes(garde_e)

    jeux = sorted(set(d_com) | set(profils_restreints()) | {'Escale'})
    if os.path.isdir(SORTIE):
        shutil.rmtree(SORTIE)

    total_reseau = sum(v[6] for v in ventes)
    d_pro = declaration(tete, 'WML_D_PRODUITS')
    nb_mois = len(next(iter(carte.values()))['m'])
    noms = noms_produits()
    for commercial in jeux:
        mes = comms_du_jeu(commercial)
        # 25/09/2026 — officine PARTAGÉE entre deux commerciaux : seules SES lignes restent en détail ;
        # celles du collègue partent dans le reste du réseau (le Pilotage montrait les ventes du collègue).
        a_moi = [bool(comms_rang[v[0]] & mes) and d_com[v[2]] in mes for v in ventes]
        detail = [v for v, ok in zip(ventes, a_moi) if ok]
        reste = {}
        for i, (v, ok) in enumerate(zip(ventes, a_moi)):
            if ok:
                continue
            k = (v[1], v[3], -2 if garde_e[i] else -1)
            a = reste.get(k)
            if a is None:
                reste[k] = [v[4], v[6]]
            else:
                a[0] += v[4]; a[1] += v[6]
        agreges = [[faux, mois, -1, prod, round(q, 3), round(m / q, 4) if q else 0, round(m, 2)]
                   for (mois, prod, faux), (q, m) in sorted(reste.items())]
        lignes = detail + agreges
        # Contrôle : le réseau par produit est intact (à l'arrondi près).
        ecart = abs(sum(v[6] for v in lignes) - total_reseau)
        if ecart > 1 + 0.01 * len(agreges):
            sys.exit('ARRÊT : jeu %r, total réseau décalé de %.2f €' % (commercial, ecart))

        rep = os.path.join(SORTIE, dossier(commercial))
        tr = tranches(lignes)
        emp = hashlib.sha1()
        for i, t in enumerate(tr, 1):
            emp.update(compact(t).encode('utf-8'))
            ecrire(os.path.join(rep, 'wml-ventes-%02d.js' % i), (
                '// WML · ventes {}/{} — {} lignes (jeu d\'un commercial, 24/09/2026).\n'
                '(function(){{var a=window.WML_SALES||(window.WML_SALES=[]);'
                'var c={};for(var i=0;i<c.length;i++)a.push(c[i]);}})();\n'
            ).format(i, len(tr), len(t), compact(t)))
        mes_codes = {d_off[v[0]] for v in detail}
        index = {'n': len(tr), 'e': emp.hexdigest()[:12]}
        for cle, rp in (('T', rep_t), ('E', rep_e)):
            index[cle] = {'act': rp['act'], 'nph': rp['nph'], 'no': rp['no'],
                          'rg': {c: r for c, r in rp['rg'].items() if c in mes_codes},
                          'rgg': {c: r for c, r in rp['rgg'].items() if c in mes_codes}}
        ecrire(os.path.join(rep, 'wml-ventes-index.js'), 'window.WML_TRANCHES_JEU = %s;\n' % compact(index))
        mes_ca = {k: v for k, v in off_ca.items() if comms_par_code.get(k, set()) & mes}
        # officines partagées avec un collègue : CA et fiche de carte recalculés sur SES lignes
        a_lui = {}
        for v in detail:
            dd = a_lui.setdefault(re.sub(r'[^0-9]', '', str(d_off[v[0]])), {'m': [0] * nb_mois, 'prod': {}})
            if isinstance(v[1], int) and 1 <= v[1] <= nb_mois:
                dd['m'][v[1] - 1] += v[6]
            dd['prod'][d_pro[v[3]]] = dd['prod'].get(d_pro[v[3]], 0) + v[6]
        partagee = lambda k: bool(comms_par_code.get(re.sub(r'[^0-9]', '', k), set()) - mes)
        vide = {'m': [0] * nb_mois, 'prod': {}}
        for k in [k for k in mes_ca if partagee(k)]:
            mes_ca[k] = [round(sum(a_lui.get(k, vide)['m'])), mes_ca[k][1]]
        ecrire(os.path.join(rep, 'wml-officines-ca.js'),
               tete_ca + 'window.WML_OFF_CA = {n:%d, m:%s};\n' % (len(mes_ca), json.dumps(mes_ca)))
        mes_det = {k: v for k, v in carte.items() if comms_par_code.get(re.sub(r'[^0-9]', '', k), set()) & mes}
        for k in [k for k in mes_det if partagee(k)]:
            dd = a_lui.get(re.sub(r'[^0-9]', '', k), vide)
            top = sorted(dd['prod'].items(), key=lambda x: -x[1])[:6]
            mes_det[k] = {'m': [round(x) for x in dd['m']], 'top': [[noms.get(c, c), round(x)] for c, x in top if x > 0],
                          'np': len(dd['prod']), 'pot': mes_det[k].get('pot')}
        ecrire(os.path.join(rep, 'carte-detail.js'), tete_det + 'window.CARTE_DETAIL=' + compact(mes_det) + ';\n')
        print('  %-24s %s  %6d lignes à lui · %6d totaux réseau · %d tranche(s) · %d CA · %d fiches'
              % (commercial, dossier(commercial), len(detail), len(agreges), len(tr), len(mes_ca), len(mes_det)))
    print('%d jeux écrits dans crm/v2/ventes/' % len(jeux))


if __name__ == '__main__':
    main()
