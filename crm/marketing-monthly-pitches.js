/* ═══════════════════════════════════════════════════════════════
   MARKETING — Pitches commerciaux mensuels Intégral Pharma
   ═══════════════════════════════════════════════════════════════
   Source unique pour les 12 fiches saisonnières grossiste B2B.
   Chaque mois = pitch pharma pro (headline, accroche, argumentaire
   expert pharmacien, CTA, citation, preset & sticker recommandés).

   Consommé par marketing.js dans :
     · renderMarketingGrossiste (hero du mois courant)
     · cards du planning 12 mois
     · mkPickerCreateSheet (pré-remplit titre / footer / accroche)

   Conforme charte 2026 : sérieux + peps dynamique, pas de criard.
   Vocabulaire pharma précis (ATC, principes actifs) mais accessible.
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // 12 mois × pitch complet pharma B2B.
  // Clé = '01'..'12' (2 digits, padded), pour matcher new Date().getMonth()+1.
  var MONTHLY_PITCH = {

    // ───────────────────────────────────────────────────────────────
    '01': {
      headline: 'Pic hiver — Grippe, rhume, gastro',
      subhead: 'Top vendeurs antalgiques + ORL pour réassorts post-fêtes',
      eyebrow: 'OFFRE GRANDS HIVERS · JANVIER',
      pitch_short: 'Janvier concentre 38 % du chiffre ORL annuel. Sécurise les stocks Doliprane, Humex, Smecta dès la première semaine.',
      pitch_long: 'Le pic épidémique grippal s\'installe entre semaine 2 et semaine 6. Les officines à fort flux observent +42 % sur l\'antalgique paracétamol et +27 % sur les antitussifs versus décembre. Tes patients reviennent post-fêtes avec gastro saisonnière (norovirus dominant) : Tiorfan, Smecta et SRO sont incontournables. Anticipe en réassort hebdo plutôt qu\'en stock fond pour préserver ton BFR.',
      cta_line: 'Commande avant le 15/01 — livraison J+2 garantie sur top 30 hiver',
      focus_categories: ['Antalgiques (Doliprane, Efferalgan, Dafalgan)', 'ORL & toux (Maxilase, Strepsils, Humex, Drill)', 'Gastro hiver (Smecta, Tiorfan, Imodium, SRO Adiaril)', 'Vitamine D (Uvédose, Zyma D, Adrigyl)'],
      competitive_angle: 'Vs Sagitta : 12 % de remise moyenne sur top 30 hiver IP, livraison J+2 vs J+3 grossiste classique',
      recommended_preset: 'tech-innovation',
      recommended_sticker: 'saison',
      accent_quote: 'Le titulaire qui rate les 3 premières semaines de janvier rate 18 % de son CA Q1 ORL.',
      target_pharmacist_profile: 'Titulaire 35-55 ans, officine urbaine ou périurbaine, flux patient hivernal soutenu, fort ticket ORL/antalgique',
      season_tags: ['grippe', 'rhume', 'gastro'],
    },

    // ───────────────────────────────────────────────────────────────
    '02': {
      headline: 'Hiver tenace — Rhume long & gastro persistante',
      subhead: 'Phase relais : antitussifs, immunité reprise & premiers boosters énergie',
      eyebrow: 'OFFRE HIVER LONG · FÉVRIER',
      pitch_short: 'Février = mois des rhumes traînants et des gastros familiales. Renforce ton rayon toux grasse + probiotiques pour la reprise immunitaire.',
      pitch_long: 'Statistiquement le mois le plus rude pour la sphère ORL après janvier : la toux grasse domine (mucolytiques Mucomyst, Fluimucil, Exomuc en hausse de 22 %). Tes patients fatigués cherchent un coup de fouet : magnésium, ginseng, propolis trouvent leur public. La gastro reste active jusqu\'en semaine 8. Pense aussi aux vitamines D en cure de relance — la carence hivernale culmine fin février.',
      cta_line: 'Profite du palier de remise +3 % sur commandes > 800 € HT avant le 20/02',
      focus_categories: ['Mucolytiques & expectorants (Exomuc, Fluimucil, Mucomyst)', 'Antitussifs (Toplexil, Tussidane, Hélicidine)', 'Magnésium & énergie (Magné B6, Berocca, Sargenor)', 'Probiotiques (Ultra-Levure, Lactéol, Bacilac)'],
      competitive_angle: 'Vs Welcoop : remise renforcée sur mucolytiques (gap concurrentiel typique 4-7 %)',
      recommended_preset: 'eight-sleep-pharma',
      recommended_sticker: 'saison',
      accent_quote: 'En février, le bon conseil mucolytique + probiotique = +14 € de panier moyen sur prescription respiratoire.',
      target_pharmacist_profile: 'Officine quartier familial, forte patientèle pédiatrique, prescriptions ORL longues > 7 jours',
      season_tags: ['rhume', 'gastro'],
    },

    // ───────────────────────────────────────────────────────────────
    '03': {
      headline: 'Allergies printemps — Démarrage R06',
      subhead: 'Antihistaminiques 2e génération : courbe pollinique démarre semaine 11',
      eyebrow: 'OFFRE PRÉ-POLLENS · MARS',
      pitch_short: 'Les pollens de bouleau, frêne et cyprès saturent l\'air dès mi-mars. Stock préventif Aerius, Xyzall, Telfast indispensable.',
      pitch_long: 'Le RNSA (Réseau National de Surveillance Aérobiologique) annonce un risque allergique élevé sur 65 départements dès la semaine 11. Les antihistaminiques H1 deuxième génération (desloratadine, fexofénadine, bilastine, cétirizine) représentent 78 % du marché OTC allergique printanier. Anticipe le rush : tes patients cherchent un conseil immédiat, sans ordonnance. Profite-en pour mettre en avant les collyres antiallergiques (Allergodil, Cromabak) et les lavages nasaux Stérimar isotoniques.',
      cta_line: 'Pack démarrage allergies — 25 références R06 à -8 % jusqu\'au 31/03',
      focus_categories: ['Antihistaminiques OTC (Aerius, Xyzall, Telfast, Wystamm, Kestin)', 'Collyres antiallergiques (Allergodil, Cromabak, Opticron)', 'Lavages nasaux (Stérimar, Physiomer, Humer)', 'Corticoïdes nasaux (Avamys, Nasonex génériques)'],
      competitive_angle: 'IP propose 5 génériques cétirizine + desloratadine en accord-cadre — marge moyenne +18 % vs princeps',
      recommended_preset: 'headspace-soin',
      recommended_sticker: 'recommande',
      accent_quote: 'Mars c\'est 4 semaines pour capter 60 % du CA antihistaminique annuel — la vitrine fait la différence.',
      target_pharmacist_profile: 'Officine zone pavillonnaire ou rurale, forte patientèle allergique récurrente, ticket conseil > 20 €',
      season_tags: ['allergies'],
    },

    // ───────────────────────────────────────────────────────────────
    '04': {
      headline: 'Allergies pleine charge + premiers solaires',
      subhead: 'Pollens graminées arrivent · démarrage rayon photoprotection',
      eyebrow: 'OFFRE PRINTEMPS PLEIN · AVRIL',
      pitch_short: 'Avril = double front : pic graminées (R06 +45 % vs mars) et démarrage solaire avant les ponts de mai.',
      pitch_long: 'Le rayon allergies atteint son maximum d\'activité semaines 15-17. Les patients commencent à acheter des solaires SPF50+ pour les premiers week-ends ensoleillés et les départs en Pâques. Les dermo-cosmétiques type Anthelios, Photoderm, Capital Soleil sortent du placard. C\'est aussi le bon moment pour pousser les associations antihistaminique + collyre + lavage nasal (cure complète 30 jours) — ticket moyen +24 € vs vente unique.',
      cta_line: 'Tarification croisée allergies + solaires — remise globale 10 % dès 600 € HT',
      focus_categories: ['Antihistaminiques cure 30j (Aerius, Bilaska, Wystamm)', 'Solaires SPF50+ visage & corps (Anthelios, Photoderm, Avène)', 'Après-soleil & apaisants (Cicalfate, Cicaplast, Biafine)', 'Cosmétiques sensibles (La Roche-Posay, Avène, Bioderma)'],
      competitive_angle: 'IP référence 14 SKU dermo-solaires hors quotas labo — disponibilité immédiate',
      recommended_preset: 'laroche-clinique',
      recommended_sticker: 'dermo',
      accent_quote: 'Le patient allergique d\'avril est aussi celui qui réservera son solaire en mai : croise les conseils.',
      target_pharmacist_profile: 'Officine touristique débutante saison, double rayon OTC + dermo-cosmétique, conseil croisé fort',
      season_tags: ['allergies', 'solaire'],
    },

    // ───────────────────────────────────────────────────────────────
    '05': {
      headline: 'Transition été — Allergies, solaires & maternité',
      subhead: 'Fête des mères + ponts de mai : croisement cosmétique & dermo-pédiatrie',
      eyebrow: 'OFFRE TRIPLE FRONT · MAI',
      pitch_short: 'Mai mixe pics allergiques finissants, solaires en accélération et opération fête des mères. Trois leviers de panier en parallèle.',
      pitch_long: 'Les ventes solaires triplent entre semaine 18 et semaine 22 (préparation week-ends Pentecôte + Ascension). La fête des mères (26 mai en 2026) crée une fenêtre cosmétique premium de 12 jours : Caudalie, Filorga, Nuxe sortent leurs coffrets. Côté pharmaco, l\'allergie ralentit mais la mycose vaginale apparaît avec les premières chaleurs (Gyno-Pevaryl, Lomexin). La pédiatrie démarre : Biafine, Bepanthen, Mitosyl post-vacances.',
      cta_line: 'Coffrets mère & maternité — packs prêts vitrine avant le 15/05',
      focus_categories: ['Solaires & après-soleil (Anthelios, Bioderma, Avène)', 'Cosmétiques cadeau (Caudalie, Nuxe, Filorga, Embryolisse)', 'Mycoses & intimité féminine (Gyno-Pevaryl, Lomexin, Saforelle)', 'Pédiatrie & maternité (Bepanthen, Biafine, Mitosyl)'],
      competitive_angle: 'Coffrets fête des mères IP livrés montés — gain temps merchandising 2h/semaine',
      recommended_preset: 'buly-apothicaire',
      recommended_sticker: 'limited',
      accent_quote: 'Mai, c\'est trois magasins en un : pharmacie, parfumerie, parapharmacie — joue les trois en simultané.',
      target_pharmacist_profile: 'Officine centre-ville ou résidentielle aisée, clientèle féminine 30-60 ans, forte saisonnalité ponts',
      season_tags: ['allergies', 'solaire'],
    },

    // ───────────────────────────────────────────────────────────────
    '06': {
      headline: 'Été démarre — Solaire, moustiques & énergie',
      subhead: 'Pic UV semaine 24 · démarrage répulsifs · cures magnésium voyage',
      eyebrow: 'OFFRE GRAND ÉTÉ · JUIN',
      pitch_short: 'Juin lance l\'opération été : SPF50+, anti-moustiques, brûlures, et le rayon voyage (gastro voyageur, désinfection plaies).',
      pitch_long: 'Le solstice du 21 juin coïncide avec le pic UV (indice 9-10 sur Méditerranée). Les patients préparent les vacances scolaires (sortie 5 juillet) : Pharmavoyage trousse complète. Anti-moustiques (Cinq sur Cinq, Insect Écran, Mousti-care) montent en flèche dès la semaine 23. La vitamine D ne s\'arrête PAS en été : 41 % des patients restent sous-dosés. Le magnésium + ginseng cartonnent en pré-départ vacances.',
      cta_line: 'Trousse pharmacie voyage — pack 18 réfs prêt à l\'emploi en vitrine',
      focus_categories: ['Solaires sport & enfant (Anthelios Dermo-Pediatrics, Photoderm KID)', 'Anti-moustiques & répulsifs (Insect Écran, Cinq sur Cinq, Mousticologne)', 'Brûlures & cicatrisation (Biafine, Cicalfate, Bepanthen)', 'Voyage & gastro (Tiorfan, Smecta, SRO Adiaril)', 'Vitalité départ (Magné B6, Berocca, Ginseng)'],
      competitive_angle: 'Trousse voyage IP packagée — gain 20 minutes de montage par client comptoir',
      recommended_preset: 'coral-warmth',
      recommended_sticker: 'saison',
      accent_quote: 'Le client qui part en vacances achète 6,3 produits en moyenne : la trousse complète, pas le tube isolé.',
      target_pharmacist_profile: 'Toutes officines, forte rotation OTC, mois pivot du chiffre annuel parapharmacie',
      season_tags: ['solaire'],
    },

    // ───────────────────────────────────────────────────────────────
    '07': {
      headline: 'Plein été — Voyage, brûlures & mycoses',
      subhead: 'Gastro voyageur, piqûres, brûlures soleil et chaleur',
      eyebrow: 'OFFRE PLEINE SAISON · JUILLET',
      pitch_short: 'Juillet = mois pivot. Coups de soleil, mycoses pieds, gastros voyageurs, piqûres : ton rayon urgence doit être plein.',
      pitch_long: 'La gastro du voyageur (E. coli entérotoxinogène) touche 30 à 50 % des Français partant en zone tropicale. Tiorfan + Smecta + SRO en pack voyage est un réflexe à pousser. Les coups de soleil amènent Biafine, Osmo Soft, Aloès. Le pied d\'athlète (Lamisil, Mycoster, Pevaryl) et les mycoses vaginales explosent avec la chaleur. Pense aux antalgiques de comptoir (Doliprane, Advil) pour les maux liés à la déshydratation.',
      cta_line: 'Réassort express été — livraison J+1 garantie sur top 20 urgence',
      focus_categories: ['Brûlures & coups de soleil (Biafine, Osmo Soft, Aloès)', 'Antifongiques cutanés & génitaux (Lamisil, Mycoster, Gyno-Pevaryl)', 'Piqûres & démangeaisons (Apaisyl, Eurax, Fenistil)', 'Antalgiques & déshydratation (Doliprane, Efferalgan, SRO)', 'Antiseptiques (Bétadine, Biseptine, Hexomédine)'],
      competitive_angle: 'Réassort J+1 IP sur juillet-août — vs J+2/J+3 grossistes classiques en pleine saison touristique',
      recommended_preset: 'butter-yellow-solaire',
      recommended_sticker: 'saison',
      accent_quote: 'L\'officine en station touristique fait 22 % de son CA annuel en juillet-août : la rupture stock = drame.',
      target_pharmacist_profile: 'Officine bord de mer / montagne / zone touristique, flux saisonnier × 3 vs hors saison',
      season_tags: ['solaire'],
    },

    // ───────────────────────────────────────────────────────────────
    '08': {
      headline: 'Été tardif + pré-rentrée immunité',
      subhead: 'Continuité solaires · démarrage vitamines, fer & probiotiques rentrée',
      eyebrow: 'OFFRE PRÉ-RENTRÉE · AOÛT',
      pitch_short: 'Août = double rythme : retour vacances + préparation rentrée. Les vitamines reviennent dès la semaine 33.',
      pitch_long: 'La deuxième quinzaine d\'août déclenche les achats anticipés rentrée : vitamines C, multivitamines enfant (Alvityl, Juvamine), fer (Tardyferon, Fumafer) et magnésium pour la fatigue post-vacances. Les probiotiques en cure de 30 jours (Lactibiane, Probiolog, Ergyphilus) trouvent leur public chez les parents qui anticipent les microbes de la rentrée scolaire. Le solaire reste actif jusqu\'à la semaine 36.',
      cta_line: 'Pack rentrée immunité — vitamines + probios + magnésium à -12 % avant 31/08',
      focus_categories: ['Multivitamines enfant & adulte (Alvityl, Juvamine, Supradyn)', 'Fer (Tardyferon, Fumafer, Ferrostrane)', 'Probiotiques (Lactibiane, Probiolog, Ergyphilus)', 'Magnésium fatigue (Magné B6, Sargenor, MAG 2)', 'Solaires fin saison (Anthelios, Avène)'],
      competitive_angle: 'IP propose 6 marques probiotiques en concurrence — flexibilité conseil unique sur marché',
      recommended_preset: 'verdant-sage',
      recommended_sticker: 'cure',
      accent_quote: 'La cure de 90 jours démarrée fin août vaut 3 ventes ponctuelles sur l\'automne — pousse la régularité.',
      target_pharmacist_profile: 'Officine famille, forte clientèle parents 30-50 ans, conseil cure complète actif',
      season_tags: ['immunite'],
    },

    // ───────────────────────────────────────────────────────────────
    '09': {
      headline: 'Rentrée immunité — Vitamines, fer & magnésium',
      subhead: 'Cures longue durée 90 jours · fatigue rentrée · démarrage défenses hiver',
      eyebrow: 'OFFRE GRANDE RENTRÉE · SEPTEMBRE',
      pitch_short: 'Septembre lance le marathon immunité avant l\'hiver. Cures 3 mois vitamines/fer/magnésium = cœur du conseil.',
      pitch_long: 'La rentrée scolaire et professionnelle déclenche le plus gros pic de fatigue de l\'année (cumul stress + raccourcissement jour + reprise microbienne). 64 % des patients > 35 ans présentent une carence en vitamine D fin septembre. Le fer est crucial chez la femme en âge de procréer (carence ~25 %). Pousse les cures longues — c\'est la saison où le pharmacien démontre sa valeur conseil face au e-commerce parapharma.',
      cta_line: 'Cures rentrée 90 jours — packs trio vitamines/fer/magnésium à prix coordonné',
      focus_categories: ['Vitamine D adulte (Uvédose, Zyma D, Adrigyl, Cholécalciférol)', 'Vitamine C (Vitascorbol, Acerola, Berocca)', 'Fer & anémie (Tardyferon, Fumafer, Ferrostrane)', 'Magnésium & énergie (Magné B6, MAG 2, Sargenor)', 'Probiotiques défenses (Lactibiane, Probiolog)'],
      competitive_angle: 'IP propose la gamme complémentaires alimentaires la plus large grossiste France (320 SKU)',
      recommended_preset: 'verdant-sage',
      recommended_sticker: 'cure',
      accent_quote: 'Septembre, c\'est le mois où le pharmacien re-démontre sa valeur conseil : cure 90j vs achat impulse.',
      target_pharmacist_profile: 'Toutes officines, mois plus haut volume conseil OTC de l\'année',
      season_tags: ['immunite'],
    },

    // ───────────────────────────────────────────────────────────────
    '10': {
      headline: 'Vaccination grippe + immunité plein régime',
      subhead: 'Campagne vaccinale ouverte semaine 41 · démarrage rhume saison',
      eyebrow: 'OFFRE VACCIN & IMMUNITÉ · OCTOBRE',
      pitch_short: 'Octobre = lancement campagne grippe (Influvac, Vaxigrip, Efluelda). 12 millions de patients ciblés en France.',
      pitch_long: 'La campagne vaccinale antigrippale 2026-2027 démarre le 12 octobre (sem 41). Tous les pharmaciens vaccinateurs (loi 2023) doivent être prêts logistiquement. Efluelda HD ciblant les > 65 ans représente 38 % des doses livrées. Parallèlement, les premiers rhumes apparaissent (semaine 42-43), pousse les défenses immunitaires (propolis, échinacée, vitamine D, zinc). Ton ratio vaccin réalisé + vente complémentaire mouchoirs/zinc/vit C = ticket moyen + 14 €.',
      cta_line: 'Pack vaccinateur complet — vaccins + mouchoirs + zinc + propolis pré-positionnés',
      focus_categories: ['Vaccins grippe (Influvac, Vaxigrip Tetra, Efluelda HD, Fluarix)', 'Défenses immunitaires (Échinacée, Propolis, Zinc, Vitamine D)', 'Premiers rhumes (Humex, Dolirhume, Actifed)', 'Antalgiques fébricule vaccinaux (Doliprane, Efferalgan)'],
      competitive_angle: 'IP sécurise les dotations vaccins haute densité Efluelda dès semaine 38 — pas de rupture vaccinale',
      recommended_preset: 'laroche-clinique',
      recommended_sticker: 'medical',
      accent_quote: 'Le pharmacien vaccinateur de 2026 fait +18 % de marge brute octobre vs non-vaccinateur.',
      target_pharmacist_profile: 'Pharmacien vaccinateur formé, officine zone âgée ou actifs, partenariat médecins traitants',
      season_tags: ['immunite', 'grippe'],
    },

    // ───────────────────────────────────────────────────────────────
    '11': {
      headline: 'Grippe + rhume + gastro hiver',
      subhead: 'Triple front : pic vaccinal, ORL, premières gastros saisonnières',
      eyebrow: 'OFFRE TRIPLE HIVER · NOVEMBRE',
      pitch_short: 'Novembre concentre les trois fronts hivernaux. C\'est le mois charnière avant le pic épidémique de janvier.',
      pitch_long: 'La courbe grippale démarre généralement semaine 47-48 selon Santé Publique France. Les rhumes saturent (Humex, Actifed, Dolirhume, Fervex, Rhinadvil sur ordonnance). Premières gastros saisonnières en collectivités (crèches, EHPAD). Ton stock anti-épidémique doit être à pleine capacité avant le Black Friday — sinon tu pousses tes clients vers Leclerc ou Internet pour les achats refuge. Black Friday = piège : ne casse pas les prix sur OTC stratégique.',
      cta_line: 'Réassort plein hiver — palier remise +5 % sur commandes > 1 500 € HT',
      focus_categories: ['Antitussifs (Toplexil, Tussidane, Drill, Strepsils)', 'Rhume complet (Humex, Actifed, Dolirhume, Fervex)', 'Antalgiques hiver (Doliprane, Efferalgan, Ibuprofène)', 'Gastro démarrage (Smecta, Tiorfan, Imodium)', 'Vitamine D & zinc (Uvédose, Granions Zinc)'],
      competitive_angle: 'IP référence 22 SKU exclusifs gamme hiver — pas de rupture concurrentielle programmée',
      recommended_preset: 'tech-innovation',
      recommended_sticker: 'bestseller',
      accent_quote: 'Le stock du 30 novembre détermine le CA de janvier — un mois en avance, pas une semaine.',
      target_pharmacist_profile: 'Toutes officines, gros volume OTC hiver, surveillance Black Friday concurrentiel',
      season_tags: ['grippe', 'rhume', 'gastro'],
    },

    // ───────────────────────────────────────────────────────────────
    '12': {
      headline: 'Pic grippe + Noël & offres exclu IP',
      subhead: 'Fin d\'année commerciale · pic épidémique · coffrets cadeaux premium',
      eyebrow: 'OFFRE FIN D\'ANNÉE · DÉCEMBRE',
      pitch_short: 'Décembre fusionne le pic grippal et l\'opération Noël premium. Mois pivot du résultat annuel officinal.',
      pitch_long: 'Le pic épidémique grippe culmine entre semaine 50 et 52. Tes patients sont fatigués, fébriles, et fréquentent l\'officine sous urgence. C\'est aussi la semaine du cadeau santé/bien-être : Caudalie, Vichy, Nuxe coffrets fêtes. Les offres exclusives IP fin d\'année (5 SKU partenariat labo) génèrent jusqu\'à +28 % de marge brute sur l\'opération. Ferme l\'année sur tes commandes stock avant le 22/12 pour tomber dans le bon exercice fiscal.',
      cta_line: 'Offres exclu IP fin d\'année — édition limitée jusqu\'au 22/12, livraison garantie',
      focus_categories: ['Vaccins & Tamiflu (Influvac, Vaxigrip, Oseltamivir)', 'Pic ORL (Humex, Dolirhume, Strepsils, Maxilase)', 'Antalgiques (Doliprane, Efferalgan)', 'Coffrets cadeaux premium (Caudalie, Vichy, Nuxe, Filorga)', 'Cures vitalité janvier (Magnésium, Ginseng, Vitamine C)'],
      competitive_angle: 'Offres exclu IP édition limitée Noël — réservées partenaires actifs, hors-marché grossiste',
      recommended_preset: 'cherry-noel',
      recommended_sticker: 'exclu-ip',
      accent_quote: 'Décembre, c\'est janvier qui se prépare : les commandes fin d\'année sécurisent ton démarrage Q1.',
      target_pharmacist_profile: 'Toutes officines, mois pivot résultat annuel, opération coffrets active',
      season_tags: ['grippe', 'rhume', 'gastro'],
    },

  };

  // Helper : récupère le pitch du mois (1..12, ou string '01'..'12').
  // Retourne null si le mois est invalide pour permettre fallback gracieux.
  function getMonthlyPitch(month) {
    if (month == null) return null;
    var n = typeof month === 'number' ? month : parseInt(String(month), 10);
    if (!isFinite(n) || n < 1 || n > 12) return null;
    var key = (n < 10 ? '0' : '') + n;
    return MONTHLY_PITCH[key] || null;
  }

  // Helper : pitch du mois courant.
  function getCurrentMonthlyPitch() {
    return getMonthlyPitch(new Date().getMonth() + 1);
  }

  // Expose globaux pour marketing.js
  window.MONTHLY_PITCH = MONTHLY_PITCH;
  window.getMonthlyPitch = getMonthlyPitch;
  window.getCurrentMonthlyPitch = getCurrentMonthlyPitch;

})();
