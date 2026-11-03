---
description: Avance le jeton de cache ?v= aux 5 endroits d'un coup (règle du robot des stats) et vérifie qu'il n'en reste aucun
---
Poser le jeton de version avec le script, jamais à la main.

1. `git pull --rebase origin main` d'abord : le jeton se pose sur la dernière version, sinon conflit sur ces lignes avec la session qui a poussé entre-temps.
2. `python3 scripts/jeton.py` : il lit les jetons déjà servis (fichiers + historique de `sw.js`), choisit le suivant, le pose dans `crm/v2/index.html`, `opso/v2/index.html`, `sw.js`, `v2-boot.js`, `v2-carte.js`, puis relit les cinq. Code de sortie non nul = jeton mal posé : ne pas pousser.
3. `git diff --stat` : à part le travail en cours, seuls ces cinq fichiers ont bougé.
4. `git add` de ces fichiers un par un (la commande exacte est affichée), commit avec le travail ou `chore(cache): jeton <nouveau>`, push.
5. Après le push : `bash scripts/attendre-prod.sh <nouveau>` avant d'annoncer quoi que ce soit.

Contrôle seul, sans rien changer : `python3 scripts/jeton.py --verifier`.
Hors périmètre, à monter à la main : `rdv.html` (ROBOT.md §8), un `?v=` propre à un fichier de données (`pharmazon-data.js`…), `V2_DATAV`, `PROTEGE_VER` (skill `donnees-protegees-jarvis`).
