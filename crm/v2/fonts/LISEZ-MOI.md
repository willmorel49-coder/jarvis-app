# Polices du CRM

## Ce qui est ici : Inter (police de secours)

`inter-latin.woff2` · `inter-latin-ext.woff2` — Inter, variable, poids 300 à 900,
sous-ensembles latin et latin étendu (Google Fonts v20, non modifiés).

Licence : **SIL Open Font License 1.1** — texte intégral et mention de copyright
dans `INTER-OFL.txt`, conservé ici comme la licence l'exige.
Elle autorise explicitement l'hébergement et la redistribution.

Ces fichiers ne sont téléchargés par le navigateur **que s'il en a besoin**,
c'est-à-dire uniquement quand Satoshi n'a pas pu être chargé.

## Ce qui n'est PAS ici, et pourquoi : Satoshi

Satoshi est la police principale du CRM. Elle **doit** rester servie par l'API
Fontshare. Sa licence (ITF Free Font License v1.0, §02 « Limitations of Usage »)
l'interdit explicitement :

> You are not allowed to transmit the Font Software over the Internet in font
> serving or for font replacement by means of technologies such as but not
> limited to EOT, Cufon, sIFR or similar technologies that may be developed in
> the future **without the prior written consent of the Licensor**.

Le même paragraphe interdit par ailleurs de « uploading them in a public server ».
Or `jarvis-app` est un dépôt public.

**Ne jamais déposer de fichier Satoshi ici.** Pour l'auto-héberger, il faudrait
d'abord obtenir un accord écrit de l'Indian Type Foundry.

## Vérifier que le secours fonctionne

```bash
node /Users/williammorel/JARVIS/verif-ecran/verif-police.js <url>
```

Le script coupe Fontshare et contrôle que la page retombe sur Inter servi depuis
notre propre serveur — et qu'aucun fichier Satoshi n'est servi par nos soins.
