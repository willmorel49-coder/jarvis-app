# Robot ANSM : une liste effondrée d'un coup ne remplace jamais celle de la veille (22/10/2026).
# Le 22/10, la page ANSM a rendu 0 signalement ; le fichier vide publié a laissé la CI rouge.
# Lancer : python3 tests/ansm-liste-vide.test.py
import importlib.util
import io
import json
import os
import sys
import tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("gad", os.path.join(ICI, "..", "generate_ansm_dispo.py"))
gad = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gad)

echecs = []


def verifie(nom, cond):
    print(("ok   " if cond else "ÉCHEC") + " " + nom)
    if not cond:
        echecs.append(nom)


# La règle seule
verifie("liste vide contre 299 la veille : suspecte", gad.liste_suspecte(0, 299))
verifie("40 contre 299 : suspecte (moins du cinquième)", gad.liste_suspecte(40, 299))
verifie("60 contre 299 : acceptée", not gad.liste_suspecte(60, 299))
verifie("299 contre 299 : acceptée", not gad.liste_suspecte(299, 299))
verifie("premier passage (veille 0) : accepté même vide", not gad.liste_suspecte(0, 0))
verifie("petite liste la veille (30) : la règle ne s'applique pas", not gad.liste_suspecte(0, 30))

# Le chemin réel : main() lit une page vide, s'arrête et ne touche ni au fichier du jour ni au journal
dossier = tempfile.mkdtemp()
out = os.path.join(dossier, "ansm-dispo.json")
veille = {"generated": "2026-10-21", "items": [{"st": "Rupture de stock", "spec": "X%d" % i} for i in range(299)]}
with io.open(out, "w", encoding="utf-8") as f:
    json.dump(veille, f)
avant = open(out, "rb").read()
gad.OUT = out
gad.fetch = lambda url: ""
gad.parse_list = lambda page: []
touche = []
gad.maj_histo = lambda *a, **k: touche.append("journal")
code = None
try:
    gad.main()
except SystemExit as e:
    code = e.code
verifie("main() s'arrête en erreur (le robot passe au rouge, rien n'est commité)", code == 1)
verifie("le fichier de la veille est intact", open(out, "rb").read() == avant)
verifie("le journal n'est pas touché", touche == [])

if echecs:
    print("\n%d échec(s)" % len(echecs))
    sys.exit(1)
print("\ntout est vert")
