# -*- coding: utf-8 -*-
"""Date d'effet d'un avis de prix CEPS (22/10/2026).

L'avis du JO du 06/10/2026 fixe la baisse d'ELIQUIS au 01/11/2026 dans la colonne « Date d'effet »
de chaque ligne. Le robot ne lisait que la phrase « à compter du <date> » : faute de la trouver, il
prenait la date de parution, et le panneau produit annonçait une baisse déjà en vigueur (et un
catalogue « en retard ») trois semaines trop tôt. Avis reconstitués sur la forme des vrais avis.
Lancer : python3 tests/prix-futurs-date-effet.test.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import generate_prix_futurs as G  # noqa: E402


def avis(date_publi, corps):
    return ('<TEXTE><DATE_PUBLI>%s</DATE_PUBLI><CONTENU><p>En application des conventions entre le comité '
            'économique des produits de santé et les sociétés X, les prix des spécialités pharmaceutiques '
            'visées ci-dessous sont :</p>%s</CONTENU></TEXTE>' % (date_publi, corps))


def lire(xml):
    out = []
    G.parse_avis(xml, {}, {'3400926784102': 58.95, '3400932905997': 2.10, '3400930034392': 430.37}, out, set())
    return {e['c']: e for e in out}


# 1. Colonne « Date d'effet » propre à chaque ligne (forme de l'avis du 06/10/2026)
r = lire(avis('2026-10-06',
              '<p>N° CIP Présentation PFHT PPTTC Date d\'effet</p>'
              '<p>34009 329 059 9 7 DIFFU-K 600 mg, gélules (B/40) (laboratoires TEOFARMA SRL) 1,52 € 2,01 € 15/11/2026</p>'
              '<p>34009 267 841 0 2 ELIQUIS 5 mg (apixaban), comprimés pelliculés (B/60) '
              '(laboratoires BRISTOL-MYERS SQUIBB) 24,30 € 28,30 € 01/11/2026</p>'))
assert r['3400926784102']['date_effet'] == '2026-11-01', r['3400926784102']
assert r['3400926784102']['date_publi'] == '2026-10-06'
assert (r['3400926784102']['pfht'], r['3400926784102']['ppttc'], r['3400926784102']['sens']) == (24.3, 28.3, 'baisse')
assert r['3400932905997']['date_effet'] == '2026-11-15', 'chaque ligne garde SA date'

# 2. « … à compter du quatrième jour suivant la publication » (forme de l'avis PRALUENT du 10/09/2026)
r = lire(avis('2026-09-10',
              '<p>34009 300 343 9 2 PRALUENT 150 mg (alirocumab), solution injectable en stylo pré-rempli (B/2) '
              '(laboratoires SANOFI WINTHROP INDUSTRIE) 318,78 € 366,12 €</p>'
              '<p>Le présent avis entre en vigueur à compter du quatrième jour suivant la publication au '
              'Journal officiel de la République française.</p>'))
assert r['3400930034392']['date_effet'] == '2026-09-14', r['3400930034392']

# 3. Inchangé : « à compter du 1er novembre 2026 » dans le texte, et à défaut la date de parution
r = lire(avis('2026-10-06', '<p>Prix applicables à compter du 1er novembre 2026.</p>'
              '<p>34009 267 841 0 2 ELIQUIS 5 mg (B/60) 24,30 € 28,30 €</p>'))
assert r['3400926784102']['date_effet'] == '2026-11-01'
r = lire(avis('2026-10-06', '<p>34009 267 841 0 2 ELIQUIS 5 mg (B/60) 24,30 € 28,30 €</p>'))
assert r['3400926784102']['date_effet'] == '2026-10-06'

print('OK prix-futurs-date-effet : 3 cas')
