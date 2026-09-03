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
    if not ca:
        return
    for pt in pts:
        if len(pt) > 12: pt[12] = 0
    ecrire('crm/v2/pharma-fr-data.js',
           s[:m.start()] + 'window.PHARMA_FR=' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n')
    ecrire('pharma-fr-ca.js',
           '// Intégral Pharma — CA par pharmacie cliente — %s\n%s'
           'window.PHARMA_FR_CA = {n:%d, m:%s};\n' % (J, AV, len(ca), json.dumps(ca)))
    fait.append('pharma-fr (%d CA)' % len(ca))

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
    s = io.open(os.path.join(BASE, 'crm/v2/wml-officines-data.js'), encoding='utf-8').read()
    offs = json.loads(re.search(r'const WML_OFFICINES = (\[.*?\]);', s, re.S).group(1))
    if any(o.get('ca') for o in offs):
        fautes.append('wml-officines-data.js porte encore des CA')
    if fautes:
        for f in fautes: print('🔴 ' + f)
        sys.exit('ARRÊT : des conditions commerciales subsistent dans un fichier PUBLIC.')

if __name__ == '__main__':
    for fn in (benchmark, prod_stats, pharma_fr, wml_officines, biosimilaires):
        fn()
    controle_final()
    if fait:
        print('découpé : ' + ' · '.join(fait))
        print('⚠️ DÉPOSER les tables sur Supabase (donnees-protegees) et bumper le jeton V de v2-boot.js.')
    else:
        print('✓ les cinq fichiers publics sont propres — rien à découper.')
