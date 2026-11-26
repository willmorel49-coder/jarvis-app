/* ════════════════════════════════════════════════════════════════
   CRM V2 · Comptes nommés (20/11/2026)
   Les listes de comptes de JARVIS, d'Escale et d'OPSO, sorties telles quelles de
   v2-boot.js et de v2-app.js (choix de Will, 20/11/2026 : « Les sortir à part »).
   Chargé AVANT v2-boot.js par crm/v2/index.html (JARVIS et Escale) et par
   opso/v2/index.html. Jamais par phirst/v2 : l'app de Phirst ne reçoit ni prénom
   ni adresse de l'équipe.
   Sans ce fichier, le socle lit des listes vides : aucun commercial Escale reconnu,
   personne n'entre dans l'espace OPSO, ni tuile du plan OPSO 2027, Tournées rangées
   dans « En développement ». Le verrou réel reste côté Supabase (jarvis_acces_opso,
   jarvis_acces_plan_opso) : ces listes décident de l'affichage et du renvoi.
   ════════════════════════════════════════════════════════════════ */
window.V2_COMPTES = {
  // 11/09/2026 — ESCALE PHARMA (Chilly-Mazarin, établissement du groupe) a son
  // propre espace (crm/v2/index.html?espace=escale depuis le 24/09) : le responsable Escale et ses quatre commerciaux. Le
  // périmètre, c'est LEURS officines (prénoms exacts des données de ventes).
  // Pas de colonne dédiée dans user_profiles (pas de DDL possible) : un compte
  // Escale se reconnaît à `commercial` ∈ cette liste, ou = 'Escale' (Alexandre).
  escale: ['Guy', 'Tiffany', 'Philippe', 'Germain'],
  // 30/09/2026 — seuls comptes admis dans l'espace OPSO (opso/v2). claude-test = compte des preuves.
  // 01/10/2026 — Will : « Pascale Prieto doit avoir accès à l'app OPSO » (direction régionale).
  // 13/10/2026 — Will : Arthur Le Houerou y entre avec son compte du CRM (même e-mail, même mot de passe).
  // 15/10/2026 — Will : Guy Bourdon y entre aussi, avec son compte du CRM.
  // 03/11/2026 — Will : Alexandre Morel a le même accès que lui, partout.
  opso: ['emmanuel.noblanc@normandiepharma.fr', 'william.morel@me.com', 'alexandre.morel@me.com', 'pascale.prieto@integralpharma.fr', 'arthur.lehouerou@integralpharma.fr', 'guy.bourdon@integralpharma.fr', 'claude-test@integralpharma.fr'],
  // 17/11/2026 — Will : « qu'on le voie moi et Pascale sur l'appli OPSO ». Plan du contrat OPSO 2027 (PDF interne) :
  // Will, Pascale, Alexandre (même accès que Will), claude-test (preuves). Ni Emmanuel (OPSO, le client), ni Arthur, ni Guy.
  // Le verrou réel est côté serveur (jarvis_acces_plan_opso, crm/v2/_sql/plan-opso-2027.sql) : cette liste ne fait qu'afficher la tuile.
  planOpso: ['william.morel@me.com', 'pascale.prieto@integralpharma.fr', 'alexandre.morel@me.com', 'claude-test@integralpharma.fr'],
  // 26/11/2026 — Will : « pour pascale et moi on doit pouvoir avoir ça pour les suivis groupement genre essentiel, opso etc. et y'a pascale et moi en contact groupement ».
  // Entrée « Groupements » du menu du compte (liens vers Essentiels Pharma et OPSO). Comme planOpso : cette liste ne fait qu'AFFICHER l'entrée ; le vrai verrou
  // est celui de chaque app côté serveur (jarvis_acces_essentiels, jarvis_acces_opso).
  contactsGroupement: ['william.morel@me.com', 'pascale.prieto@integralpharma.fr'],
  // 10/11/2026 (Will) — équipe OPS : Will, Alexandre Morel (même accès que Will), Arthur Lehouerou, Valérie Morlaix, Karine (KV).
  // Lu par v2-app.js (V2.tourneesEquipe).
  tournees: ['william.morel@me.com', 'alexandre.morel@me.com', 'arthur.lehouerou@integralpharma.fr', 'valerie.morlaix@integralpharma.fr', 'karine.vezzaro@integralpharma.fr']
};
