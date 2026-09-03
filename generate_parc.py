#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
« Le parc bouge » — qui ouvre, qui ferme, qui change de main.

FINESS publie chaque jour l'état complet des établissements de santé, avec un
JOURNAL D'ÉVÈNEMENTS daté. On y trouve, pour les 24 026 officines de France :
  · code 037 — changement de titulaire  → un compte à reconquérir
  · code 005 — fermeture                 → un client qui disparaît
  · code 036 — ouverture                 → un prospect qui apparaît
  · dateFermeture dans le futur          → un client qui ferme dans N jours

Source : data.gouv.fr, jeu « FINESS - Structures », Licence Ouverte 2.0 (lov2) —
donc republiable. Gratuit, sans clé.

⚠️ POURQUOI CE ROBOT EST SÉPARÉ ET HEBDOMADAIRE
   Le fichier fait 48 Mo compressés, 715 Mo décompressés, et son analyse demande
   ~1,5 Go de mémoire et 17 secondes. Hors de question de le tirer chaque matin
   dans le robot de l'édition. Il écrit ici un résumé de quelques dizaines de Ko
   que « L'édition du matin » lit ensuite, comme elle lit les autres robots.

⚠️ LE PIÈGE QUI REND CE FICHIER TRAÎTRE
   `dateEnregistrement` ne vaut RIEN : FINESS a réenregistré la totalité de ses
   fiches en juillet 2026. Mesuré : 24 026 « ouvertures » le même jour, soit
   exactement le nombre d'officines du pays. C'est une migration, pas l'actualité.
   **Seul `dateEvenement` porte la vraie date.** Avec elle : 405 ouvertures et
   39 fermetures sur 90 jours — des chiffres qui ont un sens.

Sortie : crm/v2/parc-mouvements.json
"""
import json, os, sys, gzip, urllib.request
from datetime import date, timedelta, datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'crm', 'v2', 'parc-mouvements.json')
JEU = 'https://www.data.gouv.fr/api/1/datasets/finess-structures-1/'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Version/17.4 Safari/605.1.15')
CAT_OFFICINE = '620'
JOURS = {'037': 120, '005': 90, '036': 30}      # une fenêtre par nature d'évènement
PLAFOND = 40                                     # par nature


def http(u, t=240):
    return urllib.request.urlopen(
        urllib.request.Request(u, headers={'User-Agent': UA}), timeout=t).read()


def url_du_jour():
    """L'adresse du fichier change chaque jour : on la demande au catalogue."""
    d = json.loads(http(JEU, 40))
    cands = [r for r in d.get('resources', [])
             if 'journalier' in ((r.get('title') or '') + (r.get('url') or '')).lower()]
    if not cands:
        cands = [r for r in d.get('resources', []) if (r.get('format') or '') == 'json.gz']
    cands.sort(key=lambda r: r.get('last_modified') or '', reverse=True)
    if not cands:
        raise RuntimeError('aucune ressource FINESS exploitable')
    return cands[0]['url'], (cands[0].get('last_modified') or '')[:10]


def ville(ege):
    ad = (ege.get('adresse') or [{}])[0]
    return {'insee': str(ad.get('cogCommune') or ''),
            'voie': ' '.join(x for x in [str(ad.get('numeroVoie') or ''),
                                         str(ad.get('libelleVoie') or '')] if x).strip()}


def main():
    auj = date.today()
    print('── Le parc bouge · %s' % auj.isoformat())
    try:
        url, maj = url_du_jour()
    except Exception as e:
        sys.stderr.write('catalogue FINESS injoignable : %s\n' % e)
        return 1
    print('   fichier du %s' % maj)
    brut = http(url)
    print('   %.1f Mo téléchargés' % (len(brut) / 1048576))
    d = json.loads(gzip.decompress(brut))
    del brut

    mvt = {c: [] for c in JOURS}
    ferme_a_venir, n_off = [], 0
    for p in d.get('pmej', []):
        offs = [e for e in (p.get('ege') or [])
                if str(e.get('categorieentiteGeographiqueExercice')) == CAT_OFFICINE]
        if not offs:
            continue
        n_off += len(offs)
        # le changement de titulaire est porté par l'ENTITÉ JURIDIQUE, pas par l'officine
        ev_pm = p.get('evenement') or []
        for ege in offs:
            g = ege.get('informationsGeneralesEGE') or {}
            fiche = {
                'nom': (g.get('nomEgeCourt') or '').strip(),
                'finess': g.get('numFinessEge') or '',
                'licence': g.get('numeroReferenceExterne') or '',
                'siret': g.get('siret') or '',
            }
            fiche.update(ville(ege))
            f = g.get('dateFermeture')
            if f and f >= auj.isoformat():
                ferme_a_venir.append(dict(fiche, date=f,
                                          jours=(date(int(f[:4]), int(f[5:7]), int(f[8:10])) - auj).days))
            for ev in list(ege.get('evenement') or []) + ev_pm:
                c = str(ev.get('codeEvenement') or '')
                if c not in JOURS:
                    continue
                # ⚠️ dateEvenement, JAMAIS dateEnregistrement (cf. l'en-tête)
                dt = (ev.get('dateEvenement') or '')[:10]
                if not dt or dt > auj.isoformat():
                    continue
                if dt < (auj - timedelta(days=JOURS[c])).isoformat():
                    continue
                mvt[c].append(dict(fiche, date=dt))

    for c in mvt:
        vus, net = set(), []
        for x in sorted(mvt[c], key=lambda y: y['date'], reverse=True):
            k = (x['finess'], x['date'])
            if k in vus:
                continue
            vus.add(k)
            net.append(x)
        mvt[c] = net[:PLAFOND]
    ferme_a_venir.sort(key=lambda x: x['date'])

    res = {
        'generated': datetime.now(timezone.utc).isoformat(),
        'jour': auj.isoformat(),
        'source': 'FINESS Structures (data.gouv.fr) · Licence Ouverte 2.0',
        'fichier': maj,
        'officines': n_off,
        'titulaires': mvt['037'],      # changement de main
        'fermetures': mvt['005'],
        'ouvertures': mvt['036'],
        'ferme_bientot': ferme_a_venir[:20],
        'fenetres': JOURS,
    }
    if not (res['titulaires'] or res['fermetures'] or res['ouvertures'] or res['ferme_bientot']):
        sys.stderr.write('AUCUN mouvement trouvé — fichier précédent conservé.\n')
        return 2
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(res, fh, ensure_ascii=False, separators=(',', ':'))
    print('   ✔ %d officines · %d changements de titulaire (%d j) · %d fermetures (%d j) · '
          '%d ouvertures (%d j) · %d fermetures annoncées'
          % (n_off, len(res['titulaires']), JOURS['037'], len(res['fermetures']), JOURS['005'],
             len(res['ouvertures']), JOURS['036'], len(res['ferme_bientot'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
