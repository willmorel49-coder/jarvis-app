#!/usr/bin/env python3
"""Le filet de la grande passe « conditions commerciales » (03/09/2026).

À lancer APRÈS toute régénération d'un des cinq fichiers publics ci-dessous —
et chaque générateur concerné l'appelle lui-même en dernière étape.

Ce qu'il fait, fichier par fichier :
  1. si le fichier public contient encore des colonnes sensibles (prix nets,
     remises, CA), il les DÉCOUPE : le public est réécrit sans elles, la table
     protégée est écrite à côté (couverte par .gitignore) ;
  2. si le fichier est déjà propre, il n'écrit RIEN (la table protégée
     existante, alignée sur la prod, n'est jamais écrasée par du vide) ;
  3. il se RELIT et sort en erreur si une colonne sensible subsiste.

Après un découpage, DÉPOSER les tables sur Supabase (seau donnees-protegees)
— voir la skill donnees-protegees-jarvis — et bumper le jeton V de v2-boot.js.
"""
import io, json, os, re, sys, datetime

BASE = os.path.dirname(os.path.abspath(__file__))
J = str(datetime.date.today())
AV = '// ⚠️ NE JAMAIS COMMITER. Servi par adresse signée (Supabase).\n'
fait = []

def ecrire(chemin, texte):
    io.open(os.path.join(BASE, chemin), 'w', encoding='utf-8').write(texte)

def benchmark():
    p = os.path.join(BASE, 'crm/benchmark-data.js')
    s = io.open(p, encoding='utf-8').read()
    if 'prix_ip:' not in s:
        return
    CH = re.compile(r',prix_ip:(-?[0-9.]+|null),remise_pct:(-?[0-9.]+|null),offre_ip:(-?[0-9.]+|null)')
    QT = re.compile(r',ip_qty:(-?[0-9.]+|null),ip_ca:(-?[0-9.]+|null)')
    rows, pub, n = [], [], 0
    for ln in s.split('\n'):
        if not ln.startswith('  {'):
            pub.append(ln); continue
        n += 1
        m1, m2 = CH.search(ln), QT.search(ln)
        v = [m1.group(1) if m1 else 'null', m1.group(2) if m1 else 'null',
             m1.group(3) if m1 else 'null', m2.group(1) if m2 else 'null',
             m2.group(2) if m2 else 'null']
        rows.append('[' + ','.join(v) + ']')
        pub.append(QT.sub('', CH.sub('', ln, 1), 1))
    ecrire('crm/benchmark-data.js', '\n'.join(pub))
    ecrire('bench-conditions.js',
           '// Intégral Pharma — benchmark, NOS CONDITIONS — %s\n%s'
           'window.BENCH_COND = {n:%d, rows:[%s]};\n' % (J, AV, n, ','.join(rows)))
    fait.append('benchmark (%d)' % n)

def prod_stats():
    p = os.path.join(BASE, 'crm/v2/prod-stats-data.js')
    s = io.open(p, encoding='utf-8').read()
    if '"net":' not in s and "'net':" not in s:
        return
    m = re.search(r'window\.PROD_STATS = (\[.*\]);', s, re.S)
    data = json.loads(m.group(1))
    rows = [[r.get('net'), r.get('rpct'), r.get('rota'), r.get('marge'), r.get('remise'), r.get('ca')] for r in data]
    pub = [{k: v for k, v in r.items() if k not in ('net', 'rpct', 'rota', 'marge', 'remise', 'ca')} for r in data]
    ecrire('crm/v2/prod-stats-data.js',
           s[:m.start()] + 'window.PROD_STATS = ' + json.dumps(pub, ensure_ascii=False) + ';\n')
    ecrire('prod-stats-conditions.js',
           '// Intégral Pharma — stats produit, CONDITIONS ET CHIFFRES — %s\n%s'
           'window.PROD_COND = {n:%d, rows:%s};\n' % (J, AV, len(rows), json.dumps(rows)))
    fait.append('prod-stats (%d)' % len(rows))

def pharma_fr():
    p = os.path.join(BASE, 'crm/v2/pharma-fr-data.js')
    s = io.open(p, encoding='utf-8').read()
    m = re.search(r'window\.PHARMA_FR=(\{.*\});?\s*$', s, re.S)
    d = json.loads(m.group(1))
    pts = d.get('p') or []
    ca = {str(pt[13]): pt[12] for pt in pts if len(pt) > 13 and pt[12]}
    # 28/09/2026 — la SEGMENTATION commerciale (indice 4 : Client A/B/C, Non
    # défini, Prospect) dit qui sont nos clients et à quel palier. C'est de
    # l'intelligence commerciale, pas de l'open data : elle sort aussi.
    # Le fichier public met TOUS les points sur « Non défini » — mettre
    # « Prospect » serait affirmer quelque chose de faux sur 2 304 officines.
    # Le protégé ne porte QUE les non-prospects : l'absence VAUT « Prospect ».
    lab = d.get('seg') or []
    i_nd = lab.index('Non défini') if 'Non défini' in lab else None
    if i_nd is None:
        lab.append('Non défini'); i_nd = len(lab) - 1
    gardes = [l for l in lab if l != 'Prospect']
    ord_g = {l: i for i, l in enumerate(gardes)}
    # ⚠️ Le fichier DÉJÀ découpé porte « Non défini » partout : sans ce test, une
    # 2ᵉ passe prendrait ces 19 700 « Non défini » pour la segmentation à sortir
    # et écraserait la vraie table par du vide de sens. Mesuré le 28/09/2026.
    deja_propre = all(lab[pt[4]] == 'Non défini' for pt in pts if len(pt) > 4)
    seg = {} if deja_propre else {
        str(pt[13]): ord_g[lab[pt[4]]]
        for pt in pts if len(pt) > 13 and lab[pt[4]] != 'Prospect'}
    # 28/09/2026 — le COMMERCIAL AFFECTÉ (indice 5) : 604 officines nommées avec
    # le prénom de qui les suit. Ce n'est pas nos clients qu'il trahit — les 604
    # sont toutes « Non défini » côté segmentation — c'est NOTRE COUVERTURE
    # TERRAIN, département par département, prénom par prénom, sur un dépôt
    # public. Le protégé ne porte QUE les affectés : l'absence VAUT « pas de
    # commercial ». Le fichier public ne garde qu'un libellé vide, donc plus
    # aucun prénom de l'équipe.
    lcom = d.get('comm') or []
    gardes_c = [l for l in lcom if l]
    ord_c = {l: i for i, l in enumerate(gardes_c)}
    # ⚠️ Même garde-fou que la segmentation : le fichier DÉJÀ découpé n'a plus
    # que des libellés vides ; sans ce test une 2ᵉ passe écraserait la vraie
    # table par du vide. Ici la comprehension rend {} d'elle-même, le `if comm`
    # plus bas refuse alors d'écrire — mais on le dit, pour qui relira.
    comm = {str(pt[13]): ord_c[lcom[pt[5]]]
            for pt in pts if len(pt) > 13 and lcom[pt[5]]}
    if not ca and not seg and not comm:
        return
    for pt in pts:
        if len(pt) > 12: pt[12] = 0
        if len(pt) > 4: pt[4] = i_nd
        if len(pt) > 5: pt[5] = 0
    # Le libellé vide reste en tête pour que `comm[0]` rende '' chez les lecteurs
    # (v2-carte.js, v2-tournee.js, v2-carte-groupements.js) ; les prénoms partent.
    d['comm'] = ['']
    ecrire('crm/v2/pharma-fr-data.js',
           s[:m.start()] + 'window.PHARMA_FR=' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n')
    # ⚠️ N'écrire QUE la table qu'on vient réellement de découper. Le CA est
    # sorti depuis le 03/09 : réécrire pharma-fr-ca.js ici l'écraserait par du
    # vide alors que la prod lit l'ancienne — la panne que ce script évite.
    if ca:
        ecrire('pharma-fr-ca.js',
               '// Intégral Pharma — CA par pharmacie cliente — %s\n%s'
               'window.PHARMA_FR_CA = {n:%d, m:%s};\n' % (J, AV, len(ca), json.dumps(ca)))
    if seg:
        ecrire('pharma-fr-seg.js',
               '// Intégral Pharma — segmentation commerciale par officine — %s\n%s'
               '// `l` = libellés, `m` = id -> indice dans `l`. Un id ABSENT = Prospect.\n'
               'window.PHARMA_FR_SEG = {n:%d, l:%s, m:%s};\n'
               % (J, AV, len(seg), json.dumps(gardes, ensure_ascii=False), json.dumps(seg)))
    if comm:
        ecrire('pharma-fr-comm.js',
               '// Intégral Pharma — commercial affecté par officine — %s\n%s'
               '// `l` = prénoms, `m` = id -> indice dans `l`. Un id ABSENT = aucun commercial.\n'
               'window.PHARMA_FR_COMM = {n:%d, l:%s, m:%s};\n'
               % (J, AV, len(comm), json.dumps(gardes_c, ensure_ascii=False), json.dumps(comm)))
    fait.append('pharma-fr (%d CA, %d segments, %d commerciaux)' % (len(ca), len(seg), len(comm)))

def wml_officines():
    p = os.path.join(BASE, 'crm/v2/wml-officines-data.js')
    s = io.open(p, encoding='utf-8').read()
    m = re.search(r'const WML_OFFICINES = (\[.*?\]);', s, re.S)
    offs = json.loads(m.group(1))
    mca = {str(o['id']): [o.get('ca') or 0, o.get('potentiel')] for o in offs
           if (o.get('ca') or o.get('potentiel') is not None)}
    if not mca:
        return
    for o in offs:
        o['ca'] = 0; o['potentiel'] = None
    ecrire('crm/v2/wml-officines-data.js',
           s[:m.start(1)] + json.dumps(offs, ensure_ascii=False) + s[m.end(1):])
    ecrire('wml-officines-ca.js',
           '// Intégral Pharma — CA + potentiel par officine WML — %s\n%s'
           'window.WML_OFF_CA = {n:%d, m:%s};\n' % (J, AV, len(mca), json.dumps(mca)))
    fait.append('wml-officines (%d)' % len(mca))

def marketing_offers():
    """Les 154 prix nets IP des 8 offres marketing officielles (28/09/2026).

    Le fichier portait `ip:` (notre prix facturé) à côté du `ppht` public, et
    `remisePct()` juste au-dessus : l'abandon de marge se lisait sans effort.
    Seul `ip` sort — le PPHT reste public (décision de Will).
    """
    p = os.path.join(BASE, 'crm/marketing-offers.js')
    s = io.open(p, encoding='utf-8').read()
    CH = re.compile(r",\s*ip:\s*(-?[0-9.]+)")
    if not CH.search(s):
        return
    prix = {}
    for ln in s.split('\n'):
        m = CH.search(ln)
        if not m:
            continue
        k = re.search(r"cip13:\s*'([0-9]+)'", ln)
        if k:
            cle = k.group(1)
        else:
            k7 = re.search(r"cip7:\s*'([0-9]+)'", ln)
            if not k7:
                sys.exit('ARRET : prix IP sans CIP dans marketing-offers.js : ' + ln.strip())
            c = k7.group(1)
            # même règle que cip7to13() dans le fichier : préfixe 3400 + suffixe 0
            cle = c if len(c) == 13 else ('3400' + c + '0' if len(c) == 7 else c)
        prix[cle] = float(m.group(1))
    ecrire('crm/marketing-offers.js', CH.sub('', s))
    ecrire('mkt-ip-prix.js',
           '// Intégral Pharma — prix nets IP des offres marketing — %s\n%s'
           'window.MKT_IP_PRIX = {n:%d, m:%s};\n' % (J, AV, len(prix), json.dumps(prix)))
    fait.append('marketing-offers (%d prix)' % len(prix))

def biosimilaires():
    p = os.path.join(BASE, 'crm/v2/biosimilaires-data.js')
    s = io.open(p, encoding='utf-8').read()
    if re.search(r'"prix_ip":\s*[0-9]', s) is None:
        return
    ecrire('biosimilaires-complet.js',
           '// Intégral Pharma — biosimilaires COMPLET (avec nos prix facturés) — %s\n%s' % (J, AV)
           + s.replace('window.BIOSIMILAIRES', 'window.BIOSIMILAIRES_COMPLET', 1))
    m = re.search(r'window\.BIOSIMILAIRES\s*=\s*(\{.*\});', s, re.S)
    d = json.loads(m.group(1))
    def strip(o):
        if isinstance(o, dict):
            for k in [k for k in o if k in ('prix_ip', 'prix_ip_std')]:
                o[k] = None
            for v in o.values(): strip(v)
        elif isinstance(o, list):
            for v in o: strip(v)
    strip(d)
    ecrire('crm/v2/biosimilaires-data.js',
           s[:m.start()] + 'window.BIOSIMILAIRES = ' + json.dumps(d, ensure_ascii=False) + ';\n')
    fait.append('biosimilaires')

def controle_final():
    """Se relire : la seule preuve qui compte."""
    fautes = []
    for chemin, motifs in (
        ('crm/benchmark-data.js', ('prix_ip:', 'remise_pct:', 'offre_ip:', 'ip_qty:', 'ip_ca:')),
        ('crm/v2/prod-stats-data.js', ('"net":', '"rpct":', '"remise":', '"ca":', '"marge":')),
        ('crm/v2/biosimilaires-data.js', (re.compile(r'"prix_ip":\s*[0-9]'),)),
    ):
        s = io.open(os.path.join(BASE, chemin), encoding='utf-8').read()
        for mo in motifs:
            trouve = mo.search(s) if hasattr(mo, 'search') else (mo in s)
            if trouve:
                fautes.append('%s contient encore %s' % (chemin, getattr(mo, 'pattern', mo)))
    s = io.open(os.path.join(BASE, 'crm/v2/pharma-fr-data.js'), encoding='utf-8').read()
    d = json.loads(re.search(r'window\.PHARMA_FR=(\{.*\});?\s*$', s, re.S).group(1))
    if any(pt[12] for pt in d.get('p', []) if len(pt) > 12):
        fautes.append('pharma-fr-data.js porte encore des CA')
    if any(len(pt) > 4 and d['seg'][pt[4]] != 'Non défini' for pt in d.get('p', [])):
        fautes.append('pharma-fr-data.js porte encore la segmentation commerciale')
    if any(len(pt) > 5 and d['comm'][pt[5]] for pt in d.get('p', [])):
        fautes.append('pharma-fr-data.js porte encore le commercial affecté')
    if [l for l in d.get('comm', []) if l]:
        fautes.append('pharma-fr-data.js porte encore les prénoms des commerciaux')
    s = io.open(os.path.join(BASE, 'crm/marketing-offers.js'), encoding='utf-8').read()
    if re.search(r',\s*ip:\s*-?[0-9.]+', s):
        fautes.append('marketing-offers.js porte encore des prix nets IP')
    s = io.open(os.path.join(BASE, 'crm/v2/wml-officines-data.js'), encoding='utf-8').read()
    offs = json.loads(re.search(r'const WML_OFFICINES = (\[.*?\]);', s, re.S).group(1))
    if any(o.get('ca') for o in offs):
        fautes.append('wml-officines-data.js porte encore des CA')
    if fautes:
        for f in fautes: print('🔴 ' + f)
        sys.exit('ARRÊT : des conditions commerciales subsistent dans un fichier PUBLIC.')

if __name__ == '__main__':
    for fn in (benchmark, prod_stats, pharma_fr, wml_officines, biosimilaires,
               marketing_offers):
        fn()
    controle_final()
    if fait:
        print('découpé : ' + ' · '.join(fait))
        print('⚠️ DÉPOSER les tables sur Supabase (donnees-protegees) et bumper le jeton V de v2-boot.js.')
    else:
        print('✓ les six fichiers publics sont propres — rien à découper.')
