# JARVIS · crm/jarvis/

Shell visuel du CRM Intégral Pharma : carte + orb + sheet. Voir spec : `docs/superpowers/specs/2026-05-25-jarvis-territoire-agent-design.md`.

## État Phase 1
- `main.js` — bootstrap, monte les composants au load Google Maps
- `map.js` — wrapper Google Maps (style Limpide)
- `pins.js` — rendu pins pharmacies (AdvancedMarkerElement)
- `orb.js` — composant Orb (animation CSS)
- `sheet.js` — sheet glass statique
- `greeting.js` — brief matinal règle-based
- `pharmacy-status.js` — logique statut (active/visited/warm/alert/prospect)

## Prochaines phases
- Phase 2 : drag sheet, états orb (listening/speaking), morph fiche pharmacie
- Phase 3 : lentille Journal + Google Calendar OAuth
- Phase 4 : lentille Catalogue
- Phase 5-6 : lentille RDV + page publique booking
- Phase 7 : lentille Pilotage
- Phase 8 : IA réelle (Claude API)
- Phase 9 : mode voix (Web Speech API)
- Phase 10 : import KML

## Clé Google Maps
Définie dans `crm/index.html` ligne du script Maps. Restrictions HTTP referrer : `*.github.io/*` + `localhost/*` + `file:///*`.
