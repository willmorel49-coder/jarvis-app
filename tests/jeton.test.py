#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
jeton.test.py — scripts/jeton.py avance le jeton ?v= partout, sans jamais reprendre un jeton servi.

Le 30/10/2026, cinq sessions ont posé à la main 20261030pot, potm, potom, car, gn : chacune
inventait son suffixe. Du 16 au 19/10/2026, 13 suffixes d'opso/v2/index.html sont restés figés
pendant 13 mises en ligne, parce que seules les lignes portant déjà le jeton du jour changeaient.
Ce test rejoue ces cas sur de vrais fichiers, dans un dossier temporaire, sans réseau ni git.
Lancer : python3 tests/jeton.test.py
"""
import importlib.util
import os
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('jeton', os.path.join(ROOT, 'scripts', 'jeton.py'))
J = importlib.util.module_from_spec(spec)
spec.loader.exec_module(J)

JOUR = '20261103'

# 1. La suite des lettres, celle du robot des stats
assert J.suivant(set(), JOUR) == '20261103a'
assert J.suivant({'20261102zz'}, JOUR) == '20261103a'              # hier ne compte pas
assert J.suivant({'20261103b'}, JOUR) == '20261103c'
assert J.suivant({'20261103z'}, JOUR) == '20261103za'
assert J.suivant({'20261103zz'}, JOUR) == '20261103zza'
# Le plus long l'emporte : jamais « c » après « cpx », même si « b » traîne encore quelque part
assert J.suivant({'20261103b', '20261103cpx'}, JOUR) == '20261103cpy'
assert J.suivant({'20261030pot', '20261030potm', '20261030potom', '20261030car', '20261030gn'},
                 '20261030') == '20261030poton'
assert J.suivant({'20261103A', '20261103_x', '20261103c1'}, JOUR) == '20261103a'  # hors format, ignorés
# Le résultat n'est jamais un jeton déjà servi
for servis in ({'20261103a'}, {'20261103y', '20261103za'}, {'20261103zzz', '20261103b'}):
    assert J.suivant(servis, JOUR) not in servis, servis

# 2. Historique de sw.js : les jetons retirés comptent autant que les ajoutés
diff = "-var VER = '20261103cpw';\n+var VER = '20261103cpx';\n var CACHE = 'jarvis-' + VER;\n"
assert J.jetons_du_diff(diff) == {'20261103cpw', '20261103cpx'}, J.jetons_du_diff(diff)

# 3. Les cinq fichiers, avec un opso/v2 resté en arrière comme du 16 au 19/10
FICHIERS = {
    'crm/v2/index.html': '<link href="v2.css?v=20261103b"><script src="v2-boot.js?v=20261103b"></script>',
    'opso/v2/index.html': '<script src="a.js?v=20261103b"></script><script src="b.js?v=20261016pla"></script>'
                          '<script src="c.js?v=20261008d"></script>',
    'crm/v2/sw.js': "var VER = '20261103b';\nvar CACHE = 'jarvis-' + VER;\n",
    'crm/v2/v2-boot.js': "var V = '?v=20261103b' + (window.V2_VER || '20260915g');\n"
                         "base + '?v=';\n    var V = '?v=20261103b';\n",
    'crm/v2/v2-carte.js': "  var CB = '?v=20261019pt';\n",
}


def dossier(fichiers):
    d = tempfile.mkdtemp()
    for rel, txt in fichiers.items():
        os.makedirs(os.path.dirname(os.path.join(d, rel)), exist_ok=True)
        J.ecrire(d, rel, txt)
    return d


d = dossier(FICHIERS)
assert J.ecarts(d, '20261103b') == ['crm/v2/v2-carte.js', 'opso/v2/index.html'], J.ecarts(d, '20261103b')
assert J.poser(d, '20261103c') == 2 + 3 + 1 + 2 + 1
assert J.ecarts(d, '20261103c') == []
assert '20261016pla' not in J.lire(d, 'opso/v2/index.html')
boot = J.lire(d, 'crm/v2/v2-boot.js')
assert "(window.V2_VER || '20260915g')" in boot and "base + '?v=';" in boot, boot  # le reste ne bouge pas

# 4. Une ligne de jeton disparue (fichier réécrit) : arrêt net, pas de jeton à moitié posé en silence
casse = dict(FICHIERS, **{'crm/v2/v2-carte.js': "var autre = 1;\n"})
d = dossier(casse)
try:
    J.poser(d, '20261103c')
    raise AssertionError('poser() aurait dû refuser')
except RuntimeError as e:
    assert 'crm/v2/v2-carte.js' in str(e), e

print('OK jeton.test.py')
