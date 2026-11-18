/* Socle : aides (formats, icônes, dessins SVG), composants communs, registre des écrans, routeur #, navigation,
   vue Intégral / pharmacien, feuille « Outils », menu « + ». Chaque écran s'inscrit dans J.ecrans['<nom>'] = { rendre(el, etat) }.
   Données : window.DONNEES (officines, fiche), window.DONNEES_V4 (pilotage, carte), window.DONNEES_V5 (le reste) — toutes fictives. */
(function () {
'use strict';
var J = window.J32 = {};
var D = window.DONNEES, V = window.DONNEES_V4, X = window.DONNEES_V5;
J.D = D; J.V = V; J.X = X; J.P = V.pilotage; J.C = V.carte; J.MOY = D.moyenneClients; J.OFF = D.officines;
/* ---------- corrections de données : ce qui est incohérent dans les données est redressé ici, au chargement, avant tout écran. ---------- */
(function corriger() {
  try {
    // 1 bis. Titres des outils sans article (« Mallette », « Marché », « QG », comme « Appro », « Tournées »).
    (X.enDeveloppement || []).forEach(function (d) { d.nom = String(d.nom).replace(/^(Le|La) (QG|marché|Mallette)$/, function (x, art, mot) { return mot.charAt(0).toUpperCase() + mot.slice(1); }); });
    ((X.concurrents && X.concurrents.sources) || []).forEach(function (s) { if (s.quoi) s.quoi = s.quoi.replace(/\s*\(fictifs?\)/, ''); });   // une seule mention « données fictives » : la ligne du haut
    if (X.concurrents && X.concurrents.avertissement) X.concurrents.avertissement = X.concurrents.avertissement.replace(/\s*Prix fictifs dans cette maquette\.?/, '');
    // 2. Objet d'un rendez-vous qui réécrivait un nombre déjà affiché ; « première visite » sur une officine déjà cliente.
    ((X.rdv && X.rdv.rendezVous) || []).forEach(function (r) { if (/^Présenter les \d+ produits du réseau$/.test(r.objet || '')) r.objet = 'Présenter les meilleures ventes du réseau';
      if (/^Première visite/.test(r.objet || '')) { var o = null; for (var i = 0; i < D.officines.length; i++) if (D.officines[i].id === r.officine) o = D.officines[i]; if (o && o.statut !== 'prospect') r.objet = 'Point sur les commandes du trimestre'; } });
    // 2 bis. « Vue il y a … » d'un rendez-vous : la dernière visite de la carte et du GPS (la même que les notes de la fiche).
    ((X.rdv && X.rdv.rendezVous) || []).forEach(function (r) { var G0 = window.DONNEES_GPS, g = G0 && G0.officines && G0.officines[r.officine], m = g && g.derniereVisite && /^il y a (.+)$/.exec(g.derniereVisiteTexte || ''); if (m) r.vuIlYa = m[1]; });
    // 3. Catalogue : nom, molécule, laboratoire et famille tirés au sort indépendamment (Doliprane vers rivaroxaban…) → un produit cohérent par famille.
    var CAT = {
      princeps: [['Doliprane 1000 mg, comprimés, boîte de 8', 'Laboratoire 1', 'paracétamol'], ['Kardegic 160 mg, sachets, boîte de 30', 'Laboratoire 1', 'acide acétylsalicylique'], ['Spasfon, comprimés, boîte de 30', 'Laboratoire 3', 'phloroglucinol'],
        ['Levothyrox 75 µg, comprimés, boîte de 30', 'Laboratoire 16', 'lévothyroxine'], ['Tahor 20 mg, comprimés, boîte de 28', 'Laboratoire 8', 'atorvastatine'], ['Amlor 5 mg, gélules, boîte de 30', 'Laboratoire 8', 'amlodipine'],
        ['Xarelto 20 mg, comprimés, boîte de 28', 'Laboratoire 12', 'rivaroxaban'], ['Eliquis 5 mg, comprimés, boîte de 60', 'Laboratoire 17', 'apixaban'], ['Ventoline 100 µg, suspension pour inhalation, flacon', 'Laboratoire 11', 'salbutamol'],
        ['Augmentin 1 g/125 mg, sachets, boîte de 8', 'Laboratoire 11', 'amoxicilline et acide clavulanique'], ['Lovenox 4 000 UI, seringues, boîte de 10', 'Laboratoire 1', 'énoxaparine']],
      generiques: [['Paracétamol 1 g, comprimés, boîte de 8', 'Laboratoire 6', 'paracétamol'], ['Atorvastatine 20 mg, comprimés, boîte de 28', 'Laboratoire 3', 'atorvastatine'], ['Amlodipine 5 mg, gélules, boîte de 30', 'Laboratoire 4', 'amlodipine'],
        ['Amoxicilline 1 g, comprimés, boîte de 6', 'Laboratoire 5', 'amoxicilline'], ['Oméprazole 20 mg, gélules, boîte de 28', 'Laboratoire 6', 'oméprazole'], ['Metformine 850 mg, comprimés, boîte de 90', 'Laboratoire 8', 'metformine'],
        ['Ramipril 5 mg, comprimés, boîte de 30', 'Laboratoire 3', 'ramipril'], ['Pantoprazole 40 mg, comprimés, boîte de 28', 'Laboratoire 5', 'pantoprazole'], ['Bisoprolol 5 mg, comprimés, boîte de 30', 'Laboratoire 4', 'bisoprolol']],
      biosimilaires: [['Amgevita 40 mg, stylos, boîte de 2', 'Laboratoire 18', 'adalimumab'], ['Hyrimoz 40 mg, stylos, boîte de 2', 'Laboratoire 9', 'adalimumab'], ['Inhixa 4 000 UI, seringues, boîte de 10', 'Laboratoire 19', 'énoxaparine'],
        ['Benepali 50 mg, stylos, boîte de 4', 'Laboratoire 20', 'étanercept'], ['Abasaglar 100 U/ml, stylos, boîte de 5', 'Laboratoire 21', 'insuline glargine']],
      nr: [['Daflon 1000 mg, comprimés, boîte de 30', 'Laboratoire 2', 'diosmine'], ['Voltarène Emulgel 1 %, gel, tube de 100 g', 'Laboratoire 22', 'diclofénac'], ['Imodium 2 mg, gélules, boîte de 12', 'Laboratoire 23', 'lopéramide'],
        ['Strepsils miel citron, pastilles, boîte de 24', 'Laboratoire 24', 'amylmétacrésol'], ['Fervex adultes, sachets, boîte de 8', 'Laboratoire 15', 'paracétamol, phéniramine et vitamine C']],
      froid: [['Humira 40 mg, stylos, boîte de 2', 'Laboratoire 25', 'adalimumab'], ['Lantus 100 U/ml, stylos, boîte de 5', 'Laboratoire 1', 'insuline glargine'], ['NovoRapid FlexPen 100 U/ml, boîte de 5', 'Laboratoire 26', 'insuline asparte'],
        ['Enbrel 50 mg, stylos, boîte de 4', 'Laboratoire 7', 'étanercept'], ['Ozempic 1 mg, stylo, boîte de 1', 'Laboratoire 26', 'sémaglutide']],
      para: [['Avène Eau thermale, spray de 300 ml', 'Laboratoire 27', ''], ['La Roche-Posay Cicaplast Baume B5, tube de 40 ml', 'Laboratoire 28', ''], ['Bioderma Sensibio H2O, flacon de 500 ml', 'Laboratoire 29', ''],
        ['Uriage Bariéderm Cica-crème, tube de 40 ml', 'Laboratoire 30', ''], ['Mustela Hydra Bébé, crème visage, 40 ml', 'Laboratoire 31', '']]
    };
    var vu = {}, LAB = {}, BRUT = ((X.produits && X.produits.lignes) || []).map(function (p) { return p.nom; });   // BRUT : noms d'origine, pour le § 3 ter
    var TOURS = new Map();   // palier de conditionnement de chaque ligne renommée (0 = le conditionnement de base), pour son prix (§ 6)
    ((X.produits && X.produits.lignes) || []).forEach(function (p) { var l = CAT[p.famille]; if (!l) return; var n = vu[p.famille] = (vu[p.famille] || 0) + 1, c = l[(n - 1) % l.length], tour = Math.floor((n - 1) / l.length);
      p.nom = !tour ? c[0] : /boîte de \d+$/.test(c[0]) ? c[0].replace(/boîte de (\d+)$/, function (x, q) { return 'boîte de ' + q * (tour + 1); }) : c[0] + ', lot de ' + (tour + 1); p.labo = c[1]; p.molecule = c[2] || 'sans molécule (parapharmacie)'; TOURS.set(p, tour); });
    Object.keys(CAT).forEach(function (f) { CAT[f].forEach(function (c) { LAB[c[0].split(/[ ,]/)[0]] = [c[0], c[1]]; }); });
    // les anciennes marques sans équivalent dans le catalogue redressé
    var REMPL = { Lamaline: 'Augmentin', Izalgi: 'Lovenox', 'Diffu-K': 'Daflon', Smecta: 'Imodium', Gaviscon: 'Strepsils' };
    var redresse = function (o, champNom) { var m = String(o[champNom] || '').split(/[ ,]/)[0]; if (REMPL[m]) m = REMPL[m]; var c = LAB[m]; if (c) { o[champNom] = c[0]; o.labo = c[1]; } };
    ((X.concurrents && X.concurrents.comparateur) || []).forEach(function (r) { redresse(r, 'produit'); });
    var RENOMMES = [];   // lignes d'Appro dont l'ancienne marque a pris le nom d'un produit déjà suivi (§ 11)
    if (X.appro) ['aujourdhui', 'anticiper'].forEach(function (k) { (X.appro[k] || []).forEach(function (r) { var m0 = String(r.produit || '').split(/[ ,]/)[0]; redresse(r, 'produit'); if (REMPL[m0]) RENOMMES.push(r); }); });
    // 3 ter. JARVIS GPS : un « produit à lui proposer » tiré du catalogue prend le nom redressé de la MÊME ligne (la fiche GPS et le Catalogue disent la même chose) ;
    //        les meilleures ventes du réseau (DONNEES.fiche, « Princeps · petits prix ») restent celles de la fiche complète.
    var GPS = window.DONNEES_GPS, NOUV = {}, RES = {};
    ((X.produits && X.produits.lignes) || []).forEach(function (p, i) { if (BRUT[i] && BRUT[i] !== p.nom) NOUV[BRUT[i]] = p.nom; });
    ((D.fiche && D.fiche.aProposer && D.fiche.aProposer.reseau && D.fiche.aProposer.reseau.premiers) || []).forEach(function (r) { RES[r.nom] = 1; });
    if (GPS && GPS.officines) Object.keys(GPS.officines).forEach(function (id) { (GPS.officines[id].aProposer || []).forEach(function (a) { if (!RES[a.nom] && NOUV[a.nom]) a.nom = NOUV[a.nom]; }); });
    // le marché cite le Xarelto du catalogue : même CIP partout
    if (X.marche && X.marche.reference) { var ref = X.marche.reference, px = (X.produits.lignes || []).filter(function (p) { return p.nom === ref.nom || p.nom.split(',')[0] === String(ref.nom).split(',')[0]; })[0]; if (px) { ref.cip = px.cip; ref.nom = px.nom; ref.labo = px.labo; } }
    // 4. Offilog : le rayon et la marque suivent le nom du produit (plus d'« eau nettoyante bébé » au rayon Cheveux) ; doublons exacts départagés.
    var RAY = [[/^Baume lèvres|^Sérum/, 'Soin du visage', 'Dermaline'], [/^Crème mains|^Lait corps/, 'Soin du corps', 'Novaskin'], [/^Brosse à dents/, 'Hygiène', 'Pureté'], [/bébé/i, 'Bébé', 'Bébénature'],
      [/^Spray solaire/, 'Solaire', 'Solaria'], [/^Magnésium/, 'Compléments', 'Vitalis'], [/^Shampooing/, 'Cheveux', 'Capillea'], [/^Dentifrice/, 'Bucco-dentaire', 'Dentalia']];
    //    Un doublon de nom prend un vrai autre produit de son rayon (plus de « · format N »).
    var VAR = { 'Bébé': ['Liniment oléo-calcaire bébé 500 ml', 'Gel lavant bébé 500 ml', 'Crème pour le change 100 ml', 'Lait de toilette bébé 400 ml', 'Eau micellaire bébé 300 ml', 'Crème hydratante bébé 200 ml', 'Huile de massage bébé 100 ml', 'Lingettes bébé, paquet de 70', 'Sérum physiologique, 30 unidoses'],
      'Solaire': ['Lait solaire SPF 50 250 ml', 'Crème solaire visage SPF 50 50 ml', 'Spray solaire enfant SPF 50+ 200 ml', 'Brume solaire SPF 30 150 ml', 'Stick solaire SPF 50 9 g', 'Gel après-soleil 200 ml', 'Huile solaire SPF 30 150 ml', 'Lait après-soleil 400 ml', 'Fluide solaire teinté SPF 50 50 ml'],
      'Soin du visage': ['Crème hydratante visage 50 ml', 'Contour des yeux 15 ml', 'Eau micellaire 400 ml', 'Masque hydratant 75 ml', 'Crème de nuit 50 ml', 'Gel nettoyant visage 200 ml', 'Sérum acide hyaluronique 30 ml', 'Baume réparateur 40 ml', 'Crème apaisante peaux sensibles 40 ml'],
      'Soin du corps': ['Crème pieds 100 ml', 'Gel douche surgras 500 ml', 'Baume corps relipidant 400 ml', 'Huile sèche 100 ml', 'Crème mains réparatrice 50 ml', 'Déodorant 48 h 50 ml', 'Lait corps hydratant 400 ml', 'Exfoliant corps 200 ml', 'Crème anti-vergetures 150 ml'],
      'Hygiène': ['Brosse à dents extra-souple', 'Brossettes interdentaires, boîte de 6', 'Fil dentaire 50 m', 'Brosse à dents enfant', 'Recharge brosse électrique, lot de 2', 'Gel hydroalcoolique 100 ml'],
      'Compléments': ['Vitamine D3 en gouttes 20 ml', 'Fer et vitamine C, 30 gélules', 'Mélatonine 1 mg, 60 comprimés', 'Probiotiques, 30 gélules', 'Oméga 3, 60 capsules', 'Zinc et sélénium, 60 comprimés', 'Vitamine C 1000 mg, 20 comprimés'],
      'Cheveux': ['Après-shampooing 200 ml', 'Shampooing antipelliculaire 200 ml', 'Masque cheveux 150 ml', 'Lotion antichute 100 ml', 'Shampooing sec 150 ml'],
      'Bucco-dentaire': ['Dentifrice blancheur 75 ml', 'Bain de bouche 500 ml', 'Dentifrice enfant 50 ml', 'Dentifrice dents sensibles 75 ml', 'Gel gingival 15 ml', 'Spray buccal 15 ml'] };
    var OP = (X.offilog && X.offilog.produits) || [], BASE = {}, PRIS = {}, dbl = 2;
    OP.forEach(function (p) { for (var i = 0; i < RAY.length; i++) if (RAY[i][0].test(p.nom)) { p.rayon = RAY[i][1]; p.marque = RAY[i][2]; break; }
      p.nom = String(p.nom).replace(/ · format \d+$/, ''); BASE[p.nom] = 1; });
    OP.forEach(function (p) { if (!PRIS[p.nom]) { PRIS[p.nom] = 1; return; } var l = VAR[p.rayon] || [], n = '';
      for (var i = 0; i < l.length && !n; i++) if (!PRIS[l[i]] && !BASE[l[i]]) n = l[i];
      p.nom = n || p.nom + ' · format ' + (dbl++); PRIS[p.nom] = 1; });
    // 5. Le secteur de la commerciale est son portefeuille du GPS : l'accueil, la liste des officines et les logiciels disent les mêmes nombres.
    try { var GP = window.DONNEES_GPS, MES = GP && GP.officines ? Object.keys(GP.officines).map(function (k) { return GP.officines[k]; }).filter(function (o) { return o.mien; }) : [];
      if (MES.length && D.secteur) { var nCl = MES.filter(function (o) { return o.categorie === 'client'; }).length; D.secteur.nbOfficines = MES.length; D.secteur.nbClientes = nCl; D.secteur.nbProspects = MES.length - nCl;
        if (X.lgo && X.lgo.logiciels) { var PL = {}; MES.forEach(function (o) { if (o.logiciel) PL[o.logiciel] = (PL[o.logiciel] || 0) + 1; });
          var vusL = X.lgo.logiciels.reduce(function (s, l) { return s + (PL[l.nom] || 0); }, 0), t0 = X.lgo.total || 1;
          X.lgo.logiciels.forEach(function (l) { l.n = vusL ? (PL[l.nom] || 0) : Math.round(l.n * MES.length / t0); });
          X.lgo.total = MES.length; X.lgo.connus = X.lgo.logiciels.reduce(function (s, l) { return s + l.n; }, 0); X.lgo.sans = Math.max(0, X.lgo.total - X.lgo.connus); } } } catch (e5) {}
    // 6. Prix net du catalogue : un prix crédible par produit, le même dans les 7 établissements ; les produits du comparateur de Concurrents y gardent
    //    le prix « Nous » ; un plus grand conditionnement coûte plus que le petit (× 1,85 par palier).
    try { var PRIX = { Doliprane: 1.6, Kardegic: 2.9, Spasfon: 2.4, Levothyrox: 3.9, Tahor: 12.4, Amlor: 6.1, Xarelto: 58, Eliquis: 61, Ventoline: 9.4, Augmentin: 3.1, Lovenox: 4.2,
        Paracétamol: 1.2, Atorvastatine: 5.9, Amlodipine: 2.6, Amoxicilline: 2.1, Oméprazole: 3.4, Metformine: 4.8, Ramipril: 2.9, Pantoprazole: 3.7, Bisoprolol: 2.5,
        Amgevita: 545, Hyrimoz: 540, Inhixa: 27.5, Benepali: 690, Abasaglar: 38.5, Daflon: 5.8, Voltarène: 7.9, Imodium: 4.9, Strepsils: 5.4, Fervex: 4.6,
        Humira: 780, Lantus: 45, NovoRapid: 39, Enbrel: 860, Ozempic: 79.8, Avène: 10.9, La: 8.9, Bioderma: 13.9, Uriage: 9.5, Mustela: 11.9 };
      ((X.concurrents && X.concurrents.comparateur) || []).forEach(function (r) { if (r.nous > 0) PRIX[String(r.produit || '').split(/[ ,]/)[0]] = r.nous; });
      ((X.produits && X.produits.lignes) || []).forEach(function (p) { var ref = PRIX[String(p.nom).split(/[ ,]/)[0]]; if (!ref || !p.prix || !TOURS.has(p)) return;
        var v = Math.round(ref * (1 + 0.85 * TOURS.get(p)) * 100) / 100; p.prix = p.prix.map(function () { return v; }); }); } catch (e6) {}
    // 7. « Opportunité » : un produit très acheté en France (200 premiers) que nos clients commandent moins que la moyenne.
    try { var PM = X.produits && X.produits.partMoyenne; if (PM) X.produits.lignes.forEach(function (p) { p.opportunite = p.rangFrance <= 200 && p.part < PM; }); } catch (e7) {}
    // 8. Documents : aucune date après le jour de la maquette (17/11/2026) ; une fiche d'ouverture de compte se range dans « Intégral » ; un barème n'est pas une page web de plusieurs Mo.
    try { var DOS = (X.documents && X.documents.dossiers) || [], INTG = DOS.filter(function (d) { return d.nom === 'Intégral'; })[0];
      DOS.forEach(function (d) { (d.docs || []).forEach(function (x) { var q = String(x.date || '').split('/'); if (q.length === 3 && +q[2] * 10000 + +q[1] * 100 + +q[0] > 20261117) { var j = new Date(+q[2], +q[1] - 1, +q[0] - 15); x.date = j.getDate() + '/' + (j.getMonth() + 1) + '/' + j.getFullYear(); }
        if ((x.type === 'Page web' || x.type === 'Texte') && /^(Barème|Plaquette|Catalogue|Tarif|Conditions)/.test(x.nom || '')) x.type = 'PDF'; }); });
      if (INTG) DOS.forEach(function (d) { if (d === INTG) return; var garde = []; (d.docs || []).forEach(function (x) { (/^Fiche d’ouverture de compte/.test(x.nom || '') ? INTG.docs : garde).push(x); }); d.docs = garde; }); } catch (e8) {}
    // 9. Aucun rendez-vous passé un dimanche : la visite du 15/11 est celle du jeudi 12/11 que cite la To do.
    try { ((X.rdv && X.rdv.passes) || []).forEach(function (p) { var d = new Date(p.date + 'T12:00:00Z'); if (d.getUTCDay() === 0) { d.setUTCDate(d.getUTCDate() - 3); p.date = d.toISOString().slice(0, 10); } }); } catch (e9) {}
    // 10. Relance, prospect chaud, ouverture de compte et créneau à proposer portent sur de vrais prospects ; « Sans réponse » = lien envoyé il y a plus de 7 jours (comme la To do).
    try { var T6 = X.todo, R6 = X.rdv, ST = {}; D.officines.forEach(function (o) { ST[o.id] = o.statut; });
      if (T6 && R6 && ST.of036 === 'prospect' && ST.of037 === 'prospect' && ST.of039 === 'prospect' && ST.of040 === 'prospect') {
        if (T6.relances && T6.relances[0] && ST[T6.relances[0].officine] !== 'prospect') T6.relances[0].officine = 'of039';
        if (T6.chauds && T6.chauds[0] && ST[T6.chauds[0].officine] !== 'prospect') T6.chauds[0].officine = 'of037';
        (T6.taches || []).forEach(function (t) { if (t.id === 't4' && t.genre === 'compte' && ST[t.officine] !== 'prospect') t.officine = 'of036'; if (t.id === 't6' && ST[t.officine] !== 'prospect') t.officine = 'of040'; });
        (R6.rendezVous || []).forEach(function (r) { if (/^Ouverture de compte/.test(r.objet || '') && ST[r.officine] !== 'prospect') r.objet = 'Présenter le listing mis à jour'; });
        var SR = (T6.relances || []).filter(function (r) { return r.jours > 7; }).map(function (r) { return r.officine; });
        if (SR.length && ST.of006 === 'cliente' && ST.of008 === 'cliente') { R6.sansReponse = SR; R6.enAttente = [{ officine: 'of006', envoye: '14/11/2026' }, { officine: 'of008', envoye: '16/11/2026' }]; } } } catch (e10) {}
    // 11. Appro : un produit n'a qu'une ligne (l'ancienne marque renommée s'efface devant le produit déjà suivi) ; l'état, le stock et la date s'accordent ;
    //     le stock « toutes plateformes » est la somme du stock des 7 établissements du catalogue.
    try { if (X.appro && X.appro.aujourdhui) { var cle = function (r) { return String(r.produit || '').split(',')[0]; }, nb = {};
        X.appro.aujourdhui.forEach(function (r) { nb[cle(r)] = (nb[cle(r)] || 0) + 1; });
        X.appro.aujourdhui = X.appro.aujourdhui.filter(function (r) { return !(nb[cle(r)] > 1 && RENOMMES.indexOf(r) >= 0); });
        var vuA = {}; X.appro.aujourdhui = X.appro.aujourdhui.filter(function (r) { if (vuA[cle(r)]) return false; vuA[cle(r)] = 1; return true; });
        X.appro.aujourdhui.forEach(function (r) { if (r.etat === 'Retour prévu' && r.retour === 'inconnu') r.retour = 'mi-décembre';
          var l = ((X.produits && X.produits.lignes) || []).filter(function (p) { return p.nom === r.produit; })[0];
          if (l && l.stock && l.stock.map) { if (r.etat === 'Rupture' || r.etat === 'Retour prévu') l.stock = l.stock.map(function () { return 0; }); else if (r.etat === 'Tension') l.stock = l.stock.map(function (v) { return Math.min(v, 12); });
            r.stock = l.stock.reduce(function (a, b) { return a + b; }, 0); } else if (r.etat === 'Rupture') r.stock = 0;
          if (r.etat === 'Tension' && !r.stock) r.stock = 6; });
        if (X.appro.anticiper) { var vuN = {}; X.appro.anticiper = X.appro.anticiper.filter(function (r) { if (vuA[cle(r)] || vuN[cle(r)]) return false; vuN[cle(r)] = 1; return true; }); } } } catch (e11) {}
    // 12. Offilog : des codes EAN-13 valides (préfixe 3401, clé de contrôle calculée), plus de suite de zéros.
    try { ((X.offilog && X.offilog.produits) || []).forEach(function (p, i) { var b = '3401' + String(40817259 + i * 7351).slice(0, 8), s = 0; for (var k = 0; k < 12; k++) s += +b[k] * (k % 2 ? 3 : 1); p.ean = b + ((10 - s % 10) % 10); }); } catch (e12) {}
    // 13. Concurrents : une vraie source sous chaque fait (pas le mot de la pastille) ; dates sur deux chiffres.
    try { var SRCF = ['Site du concurrent', 'Relevé automatique du catalogue', 'Courrier aux officines'], nf0 = 0;
      ((X.concurrents && X.concurrents.actus) || []).forEach(function (a) { if (a.source === 'Fait vérifié') a.source = SRCF[Math.min(nf0++, SRCF.length - 1)]; });
      ((X.concurrents && X.concurrents.sources) || []).forEach(function (s) { s.releve = String(s.releve || '').replace(/^(\d)\//, '0$1/'); }); } catch (e13) {}
    // 14. Pilotage : un mois en cours n'a pas été « transmis en entier ».
    try { if (V.pilotage && /^Novembre 2026 incomplet/.test(V.pilotage.noteMoisIncomplet || '')) V.pilotage.noteMoisIncomplet = 'Novembre 2026 en cours : 3 secteurs sur 8 ont déjà envoyé leurs premières ventes du mois. Ses chiffres et leur écart avec le mois d’avant sont partiels : à comparer avec prudence.'; } catch (e14) {}
    // 15. Fiche : le Top 10 est trié par montant ; QG : l'export Excel des tournées existe déjà, l'idée « prévue » est celle des rendez-vous.
    try { if (D.fiche && D.fiche.top10) D.fiche.top10.sort(function (a, b) { return b.montant - a.montant; });
      ((X.qg && X.qg.remontees) || []).forEach(function (r) { if (r.titre === 'Export Excel des tournées') r.titre = 'Export Excel des rendez-vous'; }); } catch (e15) {}
  } catch (err) { /* une correction qui échoue ne doit jamais empêcher l'appli de démarrer */ }
})();
J.RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
var RM = J.RM;
var $ = J.$ = function (s, r) { return (r || document).querySelector(s); };
var $$ = J.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var nf = J.nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
var nf1 = J.nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
var nf2 = J.nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
var eur = J.eur = function (n) { return nf.format(Math.round(n)) + '\u00a0€'; };   // espace insécable : « € » ne part jamais seul à la ligne
J.eur2 = function (n) { return nf2.format(n) + '\u00a0€'; };
J.eurM = function (n) { return Math.abs(n) >= 1e6 ? nf2.format(n / 1e6) + '\u00a0M€' : eur(n); };
J.kfmt = function (g) { return g >= 1e6 ? nf1.format(g / 1e6).replace(',0', '') + ' M€' : g >= 1000 ? nf.format(g / 1000) + ' k€' : g + ' €'; };
var esc = J.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
J.signe = function (p) { return (p > 0 ? '+' : p < 0 ? '−' : '') + nf.format(Math.abs(Math.round(p))) + '\u00a0%'; };
/* typographie commune : guillemets avec espaces fines insécables, unité collée à son nombre */
J.guil = function (t) { return '«\u202f' + t + '\u202f»'; };
J.unite = function (n, u) { return n + '\u00a0' + u; };
J.gros = function (txt) { var m = String(txt).match(/^(.*?)(\s?(?:€|M€|k€|%))$/); return m ? esc(m[1]) + '<small>' + esc(m[2].trim()) + '</small>' : esc(txt); };
J.dateFr = function (d) { return d ? d.split('-').reverse().join('/') : '—'; };
J.maj = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
J.ordre = function (n, masc) { return n + (n === 1 ? (masc ? 'er' : 're') : 'e'); };   // J.ordre(1) « 1re » (officine), J.ordre(1, true) « 1er » (produit, rang)
J.ini = function (n) { return String(n).replace(/^(PHARMACIE|PHIE)\s+(DU|DE LA|DE|DES|D’|DE L’)?\s*/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || 'P'; };
var PETITS = ['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'en', 'et', 'd’', 'l’', 'aux', 'au'];
J.joli = function (n) { var cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1); };
  return String(n).toLowerCase().replace(/'/g, '’').split(' ').map(function (t, k) { if (k > 0 && PETITS.indexOf(t) >= 0) return t;
    return t.split('-').map(function (s, q) { if (q > 0 && PETITS.indexOf(s) >= 0) return s; var ap = s.indexOf('’'); return ap > 0 && ap < 3 ? s.slice(0, ap + 1) + cap(s.slice(ap + 1)) : cap(s); }).join('-'); }).join(' '); };
var MOIS_LONG = { 'janv.': 'janvier', 'févr.': 'février', 'mars': 'mars', 'avr.': 'avril', 'mai': 'mai', 'juin': 'juin', 'juil.': 'juillet', 'août': 'août', 'sept.': 'septembre', 'oct.': 'octobre', 'nov.': 'novembre', 'déc.': 'décembre' };
J.ml = function (l) { return MOIS_LONG[l] || l; };
/* ---------- icônes (SVG en ligne, trait 1,9) ---------- */
var ICO = J.ICO = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>', pharma: '<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', pin: '<path d="M12 21s-6-5.6-6-10.5A6 6 0 0 1 18 10.5C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
  infos: '<path d="M4 5h12v14H4zM16 9h4v10h-4M7 9h6M7 13h6M7 17h4"/>', box: '<path d="M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9"/>',
  grille: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
  down: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.2l2.7 2.7L16 9.5"/>', coche: '<path d="M5 12.5l4.5 4.5L19 7"/>', bell: '<path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6 8-6s7 1.5 8 6"/>', haut: '<path d="M7 17L17 7M9 7h8v8"/>', bas: '<path d="M7 7l10 10M17 9v8H9"/>',
  chev: '<path d="M9 6l6 6-6 6"/>', chevb: '<path d="M6 9l6 6 6-6"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', back: '<path d="M15 6l-6 6 6 6"/>',
  note: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5"/>', cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
  doc: '<path d="M6 3h9l4 4v14H6zM14 3v5h5"/>', send: '<path d="M4 12l16-8-6 16-3-7z"/>', euro: '<path d="M17 6.5a6 6 0 1 0 0 11M5 10h8M5 14h8"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  edit: '<path d="M4 20h4l11-11-4-4L4 16zM13 7l4 4"/>', net: '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
  group: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5M16 15c2.6 0 4.4 1.3 5 4"/>', screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
  tasks: '<path d="M4 6l2 2 3-3M4 14l2 2 3-3M12 7h8M12 15h8"/>', clip: '<path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.2 17.2a1.7 1.7 0 0 1-2.4-2.4L14.5 7"/>',
  more: '<path d="M5 12h.01M12 12h.01M19 12h.01"/>', filtre: '<path d="M4 6h16M7 12h10M10 18h4"/>', layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  locate: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pill: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M9 9l6 6"/>', star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', son: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM5 19l.7 2 .7-2 2-.7-2-.7-.7-2-.7 2-2 .7z"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-.8 2-1.8 0-.6-.3-1-.3-1.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
  folder: '<path d="M3 6h6l2 2h10v11H3z"/>', table: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M9 10v9M15 10v9"/>', share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.3 10.8l7.4-3.6M8.3 13.2l7.4 3.6"/>'
};
var icoSvg = J.icoSvg = function (k, c) { return '<svg viewBox="0 0 24 24" aria-hidden="true"' + (c ? ' style="stroke:' + c + '"' : '') + '>' + (ICO[k] || ICO.more) + '</svg>'; };
J.ico = function (k, c) { return '<span class="ico">' + icoSvg(k, c) + '</span>'; };
J.poseIcones = function (r) { $$('[data-ico]', r).forEach(function (e) { if (!e.firstChild) e.innerHTML = icoSvg(e.getAttribute('data-ico')); }); };
J.toast = function (t) { var e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(J.toast.t); J.toast.t = setTimeout(function () { e.hidden = true; }, 2600); };
J.compter = function (el, fin, fmt, dur) {
  if (!isFinite(fin)) fin = 0;
  if (RM || !el) { if (el) el.innerHTML = fmt(fin); return; }
  var t0 = null; dur = dur || 900;
  function pas(t) { if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.innerHTML = fmt(fin * e); if (k < 1) requestAnimationFrame(pas); else el.innerHTML = fmt(fin); }
  requestAnimationFrame(pas);
};
/* états : mot + icône, la couleur ne sert que l'icône */
var ETAT = J.ETAT = { cliente: ['check', 'var(--e-bien)', 'Cliente'], rappel: ['bell', 'var(--e-attention)', 'À rappeler'], prospect: ['user', 'var(--e-neutre)', 'Prospect'], aucune: ['user', 'var(--e-neutre)', 'Aucune vente'], baisse: ['bas', 'var(--e-alerte)', 'Baisse'] };
J.etatHtml = function (k, txt) { var e = ETAT[k] || ETAT.prospect; return '<span class="etat"><span class="ico">' + icoSvg(e[0], e[1]) + '</span>' + (txt || e[2]) + '</span>'; };
J.evoHtml = function (p, suite) { return '<span class="evo"><span class="ico">' + icoSvg(p < 0 ? 'bas' : 'haut', p < 0 ? 'var(--e-alerte)' : 'var(--e-bien)') + '</span><b class="num">' + J.signe(p) + '</b>' + (suite ? ' <span class="sub" style="display:inline">' + esc(suite) + '</span>' : '') + '</span>'; };
/* ---------- modèle : officines et fiche dérivée (la 1re officine = DONNEES.fiche, les autres proportionnelles) ---------- */
var OFF = J.OFF, F0 = D.fiche;
J.offById = function (id) { for (var i = 0; i < OFF.length; i++) if (OFF[i].id === id) return OFF[i]; return null; };
J.pointById = function (id) { for (var i = 0; i < J.C.points.length; i++) if (J.C.points[i].id === id) return J.C.points[i]; return null; };
J.etatOff = function (o) { return o.statut === 'prospect' ? 'prospect' : o.aRappeler ? 'rappel' : 'cliente'; };
J.nomOff = function (id) { var o = J.offById(id); return o ? J.joli(o.nom) : id; };
/* JARVIS GPS : une officine du portefeuille qui n'est pas dans le relevé (les 40) a aussi sa fiche complète, dérivée comme celle des autres (J.ficheDe) à partir de son point de
   la carte et des données GPS (téléphone, logiciel, adresse du GPS : la fiche complète dit la même chose que la fiche latérale). J.offById reste « du relevé seulement » ;
   J.offFiche dit « a une fiche complète ». Sans données GPS, J.offVirt rend null et rien ne change. */
var VIRT = {};
J.offVirt = function (id) {
  if (VIRT[id] !== undefined) return VIRT[id];
  var G = window.DONNEES_GPS, p = J.pointById(id), g = G && G.officines && G.officines[id], o = null;
  if (p && g && g.mien) {
    o = { id: id, nom: p.nom, ville: p.ville, cp: p.cp, titulaire: p.titulaire, groupement: p.groupement, statut: g.categorie === 'client' ? 'cliente' : 'prospect', ca: p.ca || 0, caParMois: (p.caParMois || []).slice(),
      margeNous: g.montants ? g.montants.margeNous : 0, margePharmacien: F0 && F0.ca ? Math.round((p.ca || 0) * F0.margePharmacien / F0.ca) : 0, abandonMarge: g.montants ? g.montants.abandonMarge : 0, aRappeler: g.sousStatut === 'à rappeler', clientOffilog: !!g.clientOffilog, derniereCommande: null, score: 0, baisse3mois: null,
      virtuelle: true, identite: { telephone: p.telephone || '', logiciel: g.logiciel || '' } };
    if (g.adresse) o.identite.adresse = g.adresse;
  }
  return (VIRT[id] = o);
};
J.offFiche = function (id) { return J.offById(id) || J.offVirt(id); };
/* le suivi que dit la fiche complète (notes, tâches, prochain rendez-vous) : celui du GPS quand l'officine y est, pour que la fiche latérale et la fiche complète ne se contredisent pas
   (sinon toutes les fiches dérivées reprennent les notes et le rendez-vous du modèle de la première officine). Rend null sans données GPS ou hors portefeuille. */
J.suiviGps = function (id) {
  var G = window.DONNEES_GPS, g = G && G.officines && G.officines[id]; if (!g || !g.mien) return null;
  var plus = function (n) { var d = new Date(G.aujourdhui + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  var bas = function (t) { t = String(t || '').replace(/\.\s*$/, ''); return t.charAt(0).toLowerCase() + t.slice(1); };
  var notes = [], taches = [];
  if (g.dernierContact && g.dernierContact.type !== 'visite') notes.push({ date: g.dernierContact.date, texte: (g.dernierContact.type === 'appel' ? 'Appel' : 'Courriel') + ' au titulaire.' });
  if (g.derniereVisite) notes.push({ date: g.derniereVisite, texte: 'Visite à l’officine.' });
  notes.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  if (g.aVisiter && g.motifVisite) taches.push({ texte: 'À visiter : ' + bas(g.motifVisite) + '.', echeance: plus(7), fait: false });
  if (g.aRelancer && g.motifRelance) taches.push({ texte: (/^À rappeler\s*:/i.test(g.motifRelance) ? 'Rappeler : ' + bas(g.motifRelance.replace(/^À rappeler\s*:\s*/i, '')) : 'Relancer : ' + bas(g.motifRelance)) + '.', echeance: plus(2), fait: false });
  (g.opportunites || []).slice(0, 1).forEach(function (t) { taches.push({ texte: 'Opportunité : ' + bas(t.titre) + '.', echeance: plus(14), fait: false }); });
  var r = g.prochainRendezVous;
  return { notes: notes.slice(0, 3), taches: taches, prochainRendezVous: r ? { date: r.date, heure: r.heure, lieu: 'À l’officine', objet: 'Rendez-vous planifié' } : null };
};
J.ficheDe = function (id) {
  var o = J.offFiche(id), F = F0; if (!o) return F;
  if (id === F.id) return F;
  var k = o.ca ? o.ca / F.ca : 0, kn = F.margeNous ? o.margeNous / F.margeNous : 0, kp = F.margePharmacien ? o.margePharmacien / F.margePharmacien : 0;
  var cm = o.caParMois, last = cm[cm.length - 1], prev = cm[cm.length - 2] || 0;
  var base = JSON.parse(JSON.stringify(F)), num = parseInt(id.replace(/\D/g, ''), 10);
  base.id = o.id; base.nom = o.nom; base.statut = o.statut; base.ca = o.ca; base.margeNous = o.margeNous; base.margePharmacien = o.margePharmacien;
  base.caParMois = cm; base.margeNousParMois = F.margeNousParMois.map(function (v) { return Math.round(v * kn); });
  base.margePharmacienParMois = F.margePharmacienParMois.map(function (v) { return Math.round(v * kp); });
  base.dernierMois = { libelle: F.dernierMois.libelle, ca: last, evolutionSurMoisPrecedent: prev ? Math.round((last - prev) / prev * 100) : 0 };
  base.produitsDifferentsAchetes = Math.round(F.produitsDifferentsAchetes * Math.sqrt(k || .01));
  base.categories.forEach(function (c) { c.montant = Math.round(c.montant * k); });
  base.top10 = (F.top10 || []).map(function (p) { return { nom: p.nom, famille: p.famille, quantite: Math.max(1, Math.round(p.quantite * k)), montant: Math.round(p.montant * k) }; }).sort(function (a, b) { return b.montant - a.montant; });   // à l'échelle de l'officine, trié
  if (o.statut === 'prospect' && base.nePlusCommande) base.nePlusCommande = [];
  var meilleurs = OFF.filter(function (x) { return x.statut !== 'prospect' && x.ca > o.ca; }).length, nFr = (F.rang && F.rang.surFrance) || 0;   // nombre d'officines actives : celui des données
  base.rang = { france: o.statut === 'prospect' ? 0 : Math.max(1, Math.round(nFr * (meilleurs / 39) * .5) + 1), surFrance: nFr, groupement: 1 + meilleurs % 9, surGroupement: (F.rang && F.rang.surGroupement) || 0 };
  base.identite.titulaires = o.titulaire; base.identite.groupement = o.groupement; base.identite.ville = o.ville; base.identite.cp = o.cp;
  base.identite.cip = '2' + (300000 + num * 137).toString().slice(0, 6);
  base.identite.adresse = [(num * 7) % 80 + 1, ['avenue de la Gare', 'rue de la République', 'place du Marché', 'boulevard des Lices', 'chemin des Oliviers'][num % 5]].join(' ');
  base.identite.aSavoir = num % 4 === 0 ? 'Titulaire proche de la retraite (62 ans ou plus).' : ''; var nT = String(o.titulaire || '').split(' et ').length; base.identite.nbPharmaciens = nT + ' titulaire' + (nT > 1 ? 's' : '') + ' et ' + (num % 5) + ' adjoint' + (num % 5 > 1 ? 's' : '');   // autant de titulaires que de noms
  base.identite.logiciel = ['Logiciel A', 'Logiciel B', 'Logiciel C', 'Logiciel D', 'Logiciel E'][num % 5]; base.identite.grossistePrincipal = ['Grossiste 4', 'Grossiste 2', 'Grossiste 6', 'Intégral Pharma'][num % 4];
  base.identite.telephone = '04 00 ' + ('00' + (10 + num)).slice(-2) + ' 45 78'; base.identite.portable = '06 00 ' + ('00' + (20 + num)).slice(-2) + ' 33 44'; base.identite.fax = ''; base.identite.email = 'contact@' + (J.joli(o.nom).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id) + '.example';
  base.aProposer.groupeAchat.groupement = o.groupement; base.aProposer.groupeAchat.nbProduits = 300 + (num * 17) % 300;
  if (o.identite) Object.keys(o.identite).forEach(function (k) { base.identite[k] = o.identite[k]; });   // officine hors relevé : ce que dit le GPS
  var sg = J.suiviGps(id); if (sg) { base.notes = sg.notes; base.taches = sg.taches; base.prochainRendezVous = sg.prochainRendezVous; }   // notes, tâches et rendez-vous : ceux du GPS
  base.clienteDepuis = String(2012 + num % 12);
  return base;
};
J.S = { vue: 'integral', off: OFF[0].id, q: '' };   // état partagé (vue, officine courante, recherche globale) ; chaque écran garde le sien dans J.S.<nom>
J.T = function (vous, elle) { return J.S.vue === 'pharmacien' ? vous : elle; };
})();
/* ====================================================================================================================
   DESSINS SVG : mini-courbe, deux courbes, anneau, courbe de fiche à moyenne étiquetée, colonnes sans axes ; redessinés à la largeur réelle.
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, esc = J.esc, $ = J.$, $$ = J.$$;
function lisse(pts) { var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (var i = 0; i < pts.length - 1; i++) { var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 0.18, lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
    var c1y = Math.max(lo, Math.min(hi, p1[1] + (p2[1] - p0[1]) * t)), c2y = Math.max(lo, Math.min(hi, p2[1] - (p3[1] - p1[1]) * t));
    d += 'C' + (p1[0] + (p2[0] - p0[0]) * t).toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + (p2[0] - (p3[0] - p1[0]) * t).toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1); }
  return d; }
J.lisse = lisse;
J.spark = function (vals, moy, w, h, couleur, opts) { opts = opts || {}; if (!vals.length || !vals.every(isFinite)) return '';
  var tous = vals.concat(moy ? [moy] : []), max = Math.max.apply(null, tous), min = Math.min.apply(null, tous), pad = 4; if (max === min) max = min + 1;
  var X = function (i) { return pad + i * (w - 2 * pad) / Math.max(1, vals.length - 1); }, Y = function (v) { return h - pad - (v - min) * (h - 2 * pad) / (max - min); };
  var d = lisse(vals.map(function (v, i) { return [X(i), Y(v)]; }));
  var s = '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(opts.aria || 'Courbe') + '">';
  if (moy) s += '<line x1="' + pad + '" x2="' + (w - pad) + '" y1="' + Y(moy).toFixed(1) + '" y2="' + Y(moy).toFixed(1) + '" stroke="var(--c-moyenne)" stroke-width="1.2" stroke-dasharray="3 3"/>';
  s += '<path d="' + d + 'L' + X(vals.length - 1).toFixed(1) + ' ' + (h - pad) + 'L' + X(0).toFixed(1) + ' ' + (h - pad) + 'Z" fill="' + couleur + '" fill-opacity=".09"/>';
  s += '<path class="trace" d="' + d + '" fill="none" stroke="' + couleur + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>';
  return s + '<circle cx="' + X(vals.length - 1).toFixed(1) + '" cy="' + Y(vals[vals.length - 1]).toFixed(1) + '" r="3.2" fill="#fff" stroke="' + couleur + '" stroke-width="2"/></svg>'; };
J.spark2 = function (a, b, w, h, ca) { if (!a.every(isFinite) || !b.every(isFinite)) return '';
  var all = a.concat(b), max = Math.max.apply(null, all), min = Math.min.apply(null, all), pad = 5; if (max === min) max = min + 1;
  var X = function (i) { return pad + i * (w - 2 * pad) / (a.length - 1); }, Y = function (v) { return h - pad - (v - min) * (h - 2 * pad) / (max - min); }, p = function (arr) { return lisse(arr.map(function (v, i) { return [X(i), Y(v)]; })); };
  return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="Évolution"><path d="' + p(b) + '" fill="none" stroke="var(--c-moyenne)" stroke-width="1.6" stroke-dasharray="4 3"/>' +
    '<path d="' + p(a) + 'L' + X(a.length - 1).toFixed(1) + ' ' + (h - pad) + 'L' + X(0).toFixed(1) + ' ' + (h - pad) + 'Z" fill="' + ca + '" fill-opacity=".09"/><path class="trace" pathLength="1" d="' + p(a) + '" fill="none" stroke="' + ca + '" stroke-width="2.2" stroke-linecap="round"/>' +
    '<circle cx="' + X(a.length - 1).toFixed(1) + '" cy="' + Y(a[a.length - 1]).toFixed(1) + '" r="3.4" fill="#fff" stroke="' + ca + '" stroke-width="2"/></svg>'; };
J.anneau = function (score, t, col) { t = t || 34; var r = t / 2 - 4, c = 2 * Math.PI * r, m = t / 2;
  return '<svg class="anneau" viewBox="0 0 ' + t + ' ' + t + '" width="' + t + '" height="' + t + '" aria-hidden="true"><circle cx="' + m + '" cy="' + m + '" r="' + r + '" fill="none" stroke="var(--enc-5)" stroke-width="4"/><circle class="arc" cx="' + m + '" cy="' + m + '" r="' + r + '" fill="none" stroke="' + (col || 'var(--c-ca)') + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + (c * score / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 ' + m + ' ' + m + ')"/></svg>'; };
J.niceStep = function (max) { var raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
J.courbe = function (cfg, w) { var fAxe = cfg.fmtAxe || function (g) { return J.nf.format(g) + '\u00a0€'; };   // axe en euros entiers (plus de « k€ ») ; cfg.fmtAxe pour une autre unité
  var h = cfg.h || (w < 520 ? 240 : 300), L = 46, R = 14, T = 26, B = 32, n = cfg.labels.length, a = cfg.a.vals, b = cfg.b ? cfg.b.vals : null;
  if (!a.every(isFinite) || (b && !b.every(isFinite))) return '';
  var tous = a.concat(b || [], cfg.repere ? [cfg.repere.v] : [], [1]), max = Math.max.apply(null, tous), pas = J.niceStep(max), top = Math.ceil(max * 1.04 / pas) * pas;
  L = Math.max(46, Math.round(String(fAxe(top)).length * 7.6) + 14);
  var iw = w - L - R, ih = h - T - B, X = function (i) { return L + (i + .5) * iw / n; }, Y = function (v) { return T + ih - v / top * ih; };
  var s = '<svg class="courbe" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(cfg.aria || 'Courbe') + '">';
  for (var g = 0; g <= top + 1; g += pas) s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + Y(g).toFixed(1) + '" y2="' + Y(g).toFixed(1) + '" stroke="var(--filet)" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (Y(g) + 4.5).toFixed(1) + '" font-size="13" text-anchor="end" fill="var(--enc-3)">' + esc(fAxe(g)) + '</text>';
  var pa = a.map(function (v, i) { return [X(i), Y(v)]; }), da = lisse(pa), id = cfg.id || '';
  s += '<defs><linearGradient id="gA' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + cfg.a.col + '" stop-opacity=".20"/><stop offset="1" stop-color="' + cfg.a.col + '" stop-opacity="0"/></linearGradient></defs>';
  s += '<path d="' + da + 'L' + X(n - 1).toFixed(1) + ' ' + (T + ih) + 'L' + X(0).toFixed(1) + ' ' + (T + ih) + 'Z" fill="url(#gA' + id + ')"/>';
  if (cfg.repere) { var yr = Y(cfg.repere.v); s += '<line x1="' + L + '" x2="' + (w - R) + '" y1="' + yr.toFixed(1) + '" y2="' + yr.toFixed(1) + '" stroke="var(--c-moyenne)" stroke-width="1.5" stroke-dasharray="6 4"/><text x="' + (L + 6) + '" y="' + (yr - 7).toFixed(1) + '" font-size="13" font-weight="600" text-anchor="start" fill="var(--enc-2)" stroke="#fff" stroke-width="4" paint-order="stroke">' + esc(cfg.repere.txt) + '</text>'; }
  if (b) s += '<path class="trace" pathLength="1" d="' + lisse(b.map(function (v, i) { return [X(i), Y(v)]; })) + '" fill="none" stroke="' + cfg.b.col + '" stroke-width="2.4" stroke-linecap="round"/>';
  s += '<path class="trace" pathLength="1" d="' + da + '" fill="none" stroke="' + cfg.a.col + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  var rec = a.indexOf(Math.max.apply(null, a)), last = n - 1;
  (cfg.points || [rec, last]).forEach(function (i, k) { if (k && i === rec) return; var anc = i > n - 3 ? 'end' : i < 2 ? 'start' : 'middle', yy = pa[i][1] - 13;
    s += '<circle cx="' + pa[i][0].toFixed(1) + '" cy="' + pa[i][1].toFixed(1) + '" r="5" fill="#fff" stroke="' + cfg.a.col + '" stroke-width="2.5"/><text x="' + pa[i][0].toFixed(1) + '" y="' + Math.max(14, yy).toFixed(1) + '" font-size="13" font-weight="700" text-anchor="' + anc + '" fill="var(--enc-1)" stroke="#fff" stroke-width="4" paint-order="stroke">' + (i === rec ? 'Record ' : '') + cfg.fmt(a[i]) + '</text>'; });
  cfg.labels.forEach(function (l, i) { s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 9) + '" font-size="13" text-anchor="middle" fill="var(--enc-3)">' + esc(l) + '</text>'; });
  s += '<line class="marque-lue" x1="0" x2="0" y1="' + T + '" y2="' + (T + ih) + '" stroke="var(--enc-4)" stroke-width="1" style="display:none"/>';
  cfg.labels.forEach(function (l, i) { s += '<g class="zone" data-i="' + i + '" data-x="' + X(i).toFixed(1) + '"><rect x="' + (X(i) - iw / n / 2).toFixed(1) + '" y="' + T + '" width="' + (iw / n).toFixed(1) + '" height="' + ih + '" fill="transparent"/></g>'; });
  return s + '</svg>'; };
J.colonnes = function (cfg, w) { var h = cfg.h || 190, T = 12, B = 30, n = cfg.vals.length; if (!cfg.vals.every(isFinite)) return '';
  var max = Math.max.apply(null, cfg.vals.concat([1])), ih = h - T - B, iw = w - 4, bw = Math.min(40, iw / n * .62), X = function (i) { return 2 + (i + .5) * iw / n; }, Y = function (v) { return T + ih - Math.max(6, v / max * ih); };
  var s = '<svg class="colonnes" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(cfg.aria || 'Colonnes') + '"><line x1="2" x2="' + (w - 2) + '" y1="' + (T + ih) + '" y2="' + (T + ih) + '" stroke="var(--filet)" stroke-width="1.5"/>';
  cfg.vals.forEach(function (v, i) { var sel = !cfg.sel || cfg.sel.indexOf(i) >= 0, inc = cfg.incompl && cfg.incompl.indexOf(i) >= 0, y = Y(v), hh = T + ih - y, col = sel ? cfg.couleur : '#C9D3E6';
    s += '<rect class="bar" x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hh.toFixed(1) + '" rx="7" ' + (inc ? 'fill="#fff" stroke="' + col + '" stroke-width="1.8" stroke-dasharray="4 3"' : 'fill="' + col + '"') + ' style="transform-origin:' + X(i).toFixed(1) + 'px ' + (T + ih) + 'px;animation-delay:' + (i * 40) + 'ms"/>';
    s += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 9) + '" font-size="13" text-anchor="middle" fill="' + (sel ? 'var(--enc-1)' : 'var(--enc-3)') + '" font-weight="' + (sel ? 600 : 400) + '">' + esc(cfg.labels[i]) + '</text>';
    s += '<g class="zone" data-i="' + i + '" data-x="' + X(i).toFixed(1) + '"><rect x="' + (X(i) - iw / n / 2).toFixed(1) + '" y="0" width="' + (iw / n).toFixed(1) + '" height="' + h + '" fill="transparent"/></g>'; });
  return s + '</svg>'; };
var REG = [];
J.dessine = function (box, fn, apres) { if (!box) return; REG = REG.filter(function (r) { return document.body.contains(r.box) && r.box !== box; }); var item = { box: box, fn: fn, apres: apres }; REG.push(item); J.trace(item); };
J.trace = function (item) { var w = Math.floor(item.box.clientWidth); if (w < 40) { var nb = (item.n = (item.n || 0) + 1); if (nb < 6) setTimeout(function () { J.trace(item); }, 120); return; } item.box.innerHTML = item.fn(w); item.w = w; if (item.apres) item.apres(item.box); };
var tm = null; window.addEventListener('resize', function () { clearTimeout(tm); tm = setTimeout(function () { REG.forEach(function (r) { if (document.body.contains(r.box) && r.box.clientWidth && Math.abs(r.box.clientWidth - (r.w || 0)) > 4) J.trace(r); }); }, 160); });
J.lie = function (box, textes, lecteur) { function f(g) { var i = +g.getAttribute('data-i'); if (lecteur) lecteur.innerHTML = textes[i]; $$('.zone', box).forEach(function (z) { z.classList.toggle('lu', z === g); }); var m = $('.marque-lue', box); if (m) { var x = g.getAttribute('data-x'); m.setAttribute('x1', x); m.setAttribute('x2', x); m.style.display = ''; } }
  $$('.zone', box).forEach(function (g) { g.addEventListener('mouseenter', function () { f(g); }); g.addEventListener('click', function () { f(g); }); g.addEventListener('touchstart', function () { f(g); }, { passive: true }); }); };
})();
/* ====================================================================================================================
   COMPOSANTS COMMUNS du mélange : bandeau « recherche d'abord », carte d'identité, clé-valeur, tableau, carte à grand chiffre, bouton rond, vues d'Officines, écran en préparation.
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, esc = J.esc;
J.bandeau = function (o) {
  var rech = '';
  if (o.recherche) rech = typeof o.recherche === 'string' ? o.recherche : '<label class="rech-g">' + J.ico('search') + '<input id="' + esc(o.recherche.id || 'rech-ecran') + '" type="search" placeholder="' + esc(o.recherche.placeholder || 'Rechercher') + '" aria-label="' + esc(o.recherche.aria || o.recherche.placeholder || 'Rechercher') + '" value="' + esc(o.recherche.valeur || '') + '" autocomplete="off"></label>';
  return '<header class="bandeau' + (o.croix ? ' avec-croix' : '') + (o.actions ? ' avec-act' : '') + (o.deborde ? ' deborde' : '') + (o.classe ? ' ' + o.classe : '') + '">' + (o.croix ? '<div class="croix" aria-hidden="true"><i></i><i></i></div>' : '') +
    '<div class="ban-tete"><div>' + (o.eyebrow ? '<p class="eyebrow">' + o.eyebrow + '</p>' : '') + (o.titre ? '<h1>' + o.titre + '</h1>' : '') + (o.lede ? '<p class="lede">' + o.lede + '</p>' : '') + '</div>' + (o.actions ? '<div class="ban-act">' + o.actions + '</div>' : '') + '</div>' + rech + (o.sous ? '<div class="ban-sous">' + o.sous + '</div>' : '') + (o.bas ? '<div class="ban-bas">' + o.bas + '</div>' : '') + '</header>';
};
J.kv = function (lignes, classe) { return '<dl class="kv' + (classe ? ' ' + classe : '') + '">' + lignes.filter(function (l) { return l && l[1] !== '' && l[1] != null; }).map(function (l) {
  return '<div' + (l[2] ? ' data-interne' : '') + '><dt>' + l[0] + '</dt><dd>' + l[1] + (l[3] ? '<button type="button" class="cp" aria-label="Copier" title="Copier"><span class="ico">' + J.icoSvg('copy') + '</span></button>' : '') + '</dd></div>'; }).join('') + '</dl>'; };
J.identite = function (o) {
  var hn = o.niveau || 'h1';   // o.niveau : 'h2' quand la page a déjà son titre ; o.mois.interne : bloc du mois masqué en vue pharmacien ; o.etroite : colonne seule
  return '<section class="carte ident' + (o.etroite ? ' ident-etroite' : '') + (o.classe ? ' ' + o.classe : '') + '" aria-label="Identité"><div class="ident-nom"><' + hn + ' class="ident-titre">' + o.nom + '</' + hn + '>' + (o.meta ? '<div class="ident-meta">' + o.meta + '</div>' : '') +
    (o.mois ? '<div class="ident-mois"' + (o.mois.interne ? ' data-interne' : '') + '><span class="lib">' + o.mois.lib + '</span><b class="num">' + o.mois.val + '</b>' + (o.mois.evo || '') + '</div>' : '') + (o.bas || '') + '</div>' +
    '<div class="ident-kv">' + J.kv(o.lignes || []) + '</div>' + (o.actions ? '<div class="ident-act">' + o.actions + '</div>' : '') + '</section>';
};
J.tableau = function (o) {
  var th = o.cols.map(function (c) { return '<th' + (c.num ? ' class="num"' : '') + (c.interne ? ' data-interne' : '') + (c.cls ? ' class="' + c.cls + '"' : '') + '>' + c.t + (c.st ? '<span class="st">' + c.st + '</span>' : '') + '</th>'; }).join('');
  var tr = o.rows.map(function (r) { var cells = r.cells || r; return '<tr' + (r.attrs || '') + '>' + cells.map(function (c, i) { var col = o.cols[i] || {}; return '<td' + (col.num ? ' class="num"' : '') + (col.interne ? ' data-interne' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('');
  return '<div class="tabl-wrap"><table class="tabl' + (o.classe ? ' ' + o.classe : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table></div>';
};
J.stat = function (o) {
  return '<div class="stat' + (o.classe ? ' ' + o.classe : '') + '"' + (o.interne ? ' data-interne' : '') + (o.i != null ? ' style="--i:' + o.i + '"' : '') + '><div class="lib">' + (o.puce ? '<span class="puce" style="background:' + o.puce + '"></span>' : '') + o.lib + '</div>' +
    '<div class="val num">' + o.val + (o.unite ? ' <small>' + o.unite + '</small>' : '') + '</div>' + (o.note ? '<p class="note">' + o.note + '</p>' : '') + (o.spark || o.evo ? '<div class="bas">' + (o.spark || '') + (o.evo || '') + '</div>' : '') + '</div>';
};
J.rond = function (ico, txt, stub, plein, extra) { return '<button type="button" class="rond-act' + (plein ? ' plein' : '') + '"' + (stub ? ' data-stub="' + esc(stub) + '"' : '') + (extra || '') + '><span class="rond"><span class="ico">' + (String(ico).charAt(0) === '<' ? ico : J.icoSvg(ico)) + '</span></span>' + txt + '</button>'; };
J.fois = function (val, moy) { var r = val / moy; return moy > 0 && val > 0 ? '<span class="fois">' + (r < 0.05 ? 'moins de 0,1 × la moyenne' : '× ' + (r >= 10 ? J.nf.format(r) : J.nf1.format(r)) + ' la moyenne') + '</span>' : ''; };
J.vuesOfficines = function (active) {
  return '<div class="vues" role="group" aria-label="Vues des officines">' + [['liste', 'pharma', 'Officines', 'Officines'], ['groupements', 'group', 'Groupements', 'Groupes'], ['listes', 'list', 'Mes listes', 'Listes'], ['carte-secteur', 'pin', 'Carte secteur', 'Secteur']].map(function (v) {
    return '<a href="#' + v[0] + '"' + (v[0] === active ? ' class="on" aria-current="page"' : '') + ' aria-label="' + v[2] + '">' + J.ico(v[1]) + '<span class="v-lg">' + v[2] + '</span><span class="v-ct" aria-hidden="true">' + v[3] + '</span></a>'; }).join('') + '</div>';
};
/* Vue pharmacien d'un outil purement interne (Pilotage, cartes) : la tête du bandeau reste, tout le reste est masqué, un avis dit pourquoi.
   Posé par le routeur après le rendu ; un écran peut l'appeler lui-même après un ré-affichage partiel. */
J.outilInterne = function (el, nom) {
  var page = el.querySelector('.page') || el, ban = page.querySelector('.bandeau'); if (!ban) return;
  J.$$('.lede,.ban-act,.rech-g,.ban-sous,.ban-bas', ban).forEach(function (e) { e.setAttribute('data-interne', ''); });
  Array.prototype.forEach.call(page.children, function (c) { if (c !== ban && !c.classList.contains('vp-avis')) c.setAttribute('data-interne', ''); });
  if (!page.querySelector('.vp-avis')) ban.insertAdjacentHTML('afterend', '<p class="note vp vp-avis">' + J.ico('lock') + '<span>' + esc(nom) + ' est un outil interne : rien à montrer au pharmacien dans cette vue.</span><button type="button" class="pil" data-vue="integral">Revenir à la vue Intégral</button></p>');
};
/* Vue pharmacien d'un écran mixte : un avis seulement (les blocs internes portent déjà data-interne). */
J.avisVue = function (el, txt) {
  var page = el.querySelector('.page') || el, ban = page.querySelector('.bandeau'); if (!ban || page.querySelector('.vp-avis')) return;
  ban.insertAdjacentHTML('afterend', '<p class="note vp vp-avis">' + J.ico('lock') + '<span>' + txt + '</span><button type="button" class="pil" data-vue="integral">Revenir à la vue Intégral</button></p>');
};
J.prep = function (e, el) {
  el.innerHTML = '<div class="prep"><section class="carte"><p class="eyebrow">' + (e.fam === 'dev' ? 'En développement · en préparation' : 'Écran en préparation') + '</p><h1>' + esc(e.nom) + '</h1><p class="lede">' + esc(e.ph || '') + '</p>' +
    (e.blocs && e.blocs.length ? '<ul>' + e.blocs.map(function (b) { return '<li>' + J.ico('coche') + esc(b) + '</li>'; }).join('') + '</ul>' : '') +
    '<p class="note">' + (e.fam === 'dev' ? 'Cet outil existe dans JARVIS (« ces outils marchent, mais ils ne sont pas encore au point »). ' : '') + 'Cet écran n’est pas dessiné dans cette maquette.</p></section></div>';
};
})();
/* ====================================================================================================================
   REGISTRE DES ÉCRANS, ROUTEUR #, NAVIGATION, VUE INTÉGRAL / PHARMACIEN, FEUILLE « OUTILS », MENU « + », RECHERCHE ⌘K, DÉMARRAGE.
   Adresses : #<nom> (écran) et #<nom>-<suite> (sous-état : detail, fiche, pharmacien…) ; #liste par défaut.
   ==================================================================================================================== */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, X = J.X;
var PREP = {
  accueil: ['Salut, date et « Reprendre : dernière fiche ouverte »', 'À la une (une nouveauté, datée)', 'Officines en grand : officines actives, « Mon secteur » face à la moyenne du réseau, « N à rappeler »', 'Infos du matin, To do cochable, Groupements, Offilog', 'Rangée compacte : Catalogue, Pilotage, Marketing, La carte, Documents', 'Widgets réglables : À relancer, Ma semaine, Ma tournée, Ruptures'],
  infos: ['En-tête bleu : date, « Infos du jour », phrase calculée, « Copier le brief »', 'Pastilles-filtres avec leurs vrais nombres', 'Trois portes : Votre secteur (carte des départements), En France, Tout le reste', 'Volet de détail d’une info (source, date)', 'Le fil du jour', 'Les matins d’avant · La fraîcheur des sources'],
  todo: ['En-tête : date, « To do list », phrase calculée, « + Ajouter une tâche »', 'Bande de trois chiffres : aujourd’hui, à venir, faites', 'Onglets Tâches · Prospects à relancer · Prospects chauds', 'Groupes En retard ou aujourd’hui · À venir · Sans date', 'Les mails tout prêts (3 modèles) et Mes modèles', 'Feuille d’ajout : genre, officine, note dictée, date'],
  pilotage: ['Bandeau : secteur regardé, phrase-réponse, 4 périodes, note de mois incomplet', 'Chiffre d’affaires en grand, période d’avant, colonnes sans axes', 'Notre marge · Marge pharmacien générée · Officines actives · Panier moyen · Molécules', 'Par client, face à la moyenne du réseau (5 lignes)', 'Voir tout le détail : notre marge par famille et par commercial, répartitions, top 10, gisement, pharmacies en baisse'],
  carte: ['Carte plein cadre, recherche, compteur, Tout / Clients / Prospects, Commercial, Groupement', 'Plus de filtres, pastilles de filtres et « Tout effacer »', 'Légende qui change avec la couleur, Points / Bulles, Zones par département', 'Volet de l’officine : 3 chiffres, chiffre d’affaires par mois, produits phares, actions', 'Liste, Excel, Ma tournée (frise horaire, dépôt de départ), Potentiel du secteur'],
  'carte-secteur': ['Les quatre vues d’Officines, menu Commercial, compteur d’officines localisées', 'Carte du secteur : un rond par officine, taille et teinte selon le chiffre d’affaires', 'Légende à cinq paliers', 'Bulle au clic : nom, ville, groupement, chiffre d’affaires, « Ouvrir la fiche → »'],
  produits: ['Bandeau : « Nom, CIP, molécule, laboratoire… », compteur, catalogue des 7 établissements', 'Que voulez-vous faire ? (trois portes)', 'Familles, Opportunités seulement, En stock, top France, tri', 'Tableau des produits : prix net des 7 établissements, stock, rang France, nos ventes, notre part', 'Panneau d’un produit, sélection → PDF / Excel', 'Vues Client, Groupement, Prospect, Catalogue, Achats'],
  biosimilaires: ['Titre, phrase, 5 téléchargements (interne / pharmacien)', 'Quatre grands chiffres : molécules, biosimilaires, substituables, référencés', 'Filtres : recherche, aire, Ville / Hôpital, Substituables, Partenaires, Chez Intégral', 'Une carte par molécule (fiche d’identité dépliable)', 'Légende et source'],
  lgo: ['Colonne : titre, phrase, Mes pharmacies / Tout le réseau, « N au logiciel connu », barre de répartition', 'Liste des logiciels (compteur, barre), À compléter, PharmaML', 'Zone de droite : éditeur, « Mode d’emploi » PDF', 'Onglets Pharmacies · Pas-à-pas · Fichiers · Se former'],
  marketing: ['En-tête « Marketing » et phrase', 'Quatre portes : Supports officine, Documents partagés, Le nouveau site, LinkedIn', 'Repères (dont « Les nouvelles maquettes de JARVIS »)', 'Supports officine : Mes fiches, Commencer, Prêts à présenter, Partir d’un rayon', 'LinkedIn : le plan de la semaine'],
  documents: ['Titre, pastille « Accès restreint », recherche', 'Étagères par dossier : grossistes, groupes d’achat, laboratoires', 'Vignettes typées : PDF, Excel, CSV, Image, Texte, Page web', 'Ouvrir, retirer, documents retirés'],
  offilog: ['En-tête : la centrale parapharmacie, phrase calculée, médiane sous le prix catalogue', 'Que voulez-vous faire ? Trouver un produit · Le catalogue Offilog · Comparer nos prix', 'Rayons et meilleures ventes (rang, mouvement)', 'Liste d’aujourd’hui en grille, inspecteur d’un produit (prix des plateformes)', 'Barre de sélection, Comment commander'],
  rdv: ['Titre : « N à venir · N cette semaine · N en attente »', 'Bande des jours (3 semaines), la journée choisie avec l’agenda', 'Rendez-vous passés à qualifier', 'Inviter une officine · Noter un RDV · ··· (Planning, Suivi, Radar, Disponibilités, Mes modèles, Appels)', 'À rappeler, En attente, Sans réponse'],
  concurrents: ['Une barre, cinq onglets : Carte, Annuaire, Prix, Actualité, Liens', 'Carte des implantations (une couleur par groupe), fiche d’un acteur', 'Comparateur de prix : un produit par ligne, une colonne par concurrent (prix fictifs)', 'Actualité : faits vérifiés et presse', 'Liens : qui détient qui'],
  groupements: ['Les quatre vues d’Officines, recherche, tri Activité / Nom', 'Une ligne par groupement : initiale, officines, actives, chiffre d’affaires', 'Page d’un groupement : membres, liste d’achats idéale par catégorie', 'Tableau : produit, CIP, prix net, abandon de marge, part des officines, sélection PDF'],
  listes: ['Les quatre vues d’Officines, « Nouvelle liste »', 'Une ligne par liste : pharmacies, actives, chiffre d’affaires', 'Détail : Ajouter des pharmacies, PDF, Excel, Partager, Renommer, Supprimer', 'Membres et liste d’achats idéale']
};
var E = function (k, nav, nom, ph, fam, ico, fichier) { return { k: k, nav: nav, nom: nom, ph: ph, fam: fam, ico: ico, fichier: fichier || k, blocs: PREP[k] || [] }; };
J.ECRANS = [
  E('accueil', 'accueil', 'Accueil', 'JARVIS GPS : votre territoire vivant', 'rail', 'home'),
  E('liste', 'officines', 'Officines', 'La fiche de chaque client et prospect', 'accueil', 'pharma', 'officines'),
  E('fiche', 'officines', 'Fiche d’une officine', '', 'cache', 'pharma', 'officines'),
  E('groupements', 'officines', 'Groupements', 'Ce que commandent les adhérents de chaque groupe d’achat', 'cache', 'group'),
  E('listes', 'officines', 'Mes listes', 'Des pharmacies que vous regroupez vous-même', 'cache', 'list'),
  E('carte-secteur', 'officines', 'Carte secteur', 'La carte de votre secteur', 'cache', 'pin', 'carte'),
  E('produits', 'outils', 'Catalogue produits', 'Prix et stock des 7 établissements', 'accueil', 'box'),
  E('pilotage', 'pilotage', 'Pilotage', 'Chiffre d’affaires, marge et objectifs', 'accueil', 'chart'),
  E('marketing', 'outils', 'Marketing', 'Supports, sélections, LinkedIn', 'accueil', 'palette'),
  E('infos', 'infos', 'JARVIS DAILY', 'Le brief du marché officinal', 'accueil', 'infos'),
  E('carte', 'carte', 'La carte', 'Clients, prospects et votre tournée', 'accueil', 'pin'),
  E('todo', 'outils', 'To do list', 'Rendez-vous à demander, remerciements, ouvertures', 'accueil', 'tasks'),
  E('offilog', 'offilog', 'Offilog', 'La centrale parapharmacie', 'accueil', 'box'),
  E('documents', 'outils', 'Documents', 'Tarifs, conditions et catalogues, rangés par dossier', 'accueil', 'folder'),
  E('rdv', 'outils', 'Rendez-vous', 'Demander et suivre vos rendez-vous', 'direct', 'cal'),
  E('biosimilaires', 'outils', 'Biosimilaires', 'Les biosimilaires et leurs références', 'direct', 'pill'),
  E('concurrents', 'outils', 'Concurrents', 'Ce que font les autres', 'direct', 'truck'),
  E('lgo', 'outils', 'Logiciels officine', 'Importer le catalogue dans chaque logiciel', 'direct', 'screen')
];
var ICO_DEV = { appro: 'box', blocnotes: 'note', qg: 'chat', marche: 'chart', 'carte-groupements': 'pin', mallette: 'doc', tournees: 'route' };
X.enDeveloppement.forEach(function (d) { J.ECRANS.push({ k: d.k, nav: 'outils', nom: d.nom, ph: d.ph, fam: 'dev', ico: ICO_DEV[d.k] || 'more', blocs: d.blocs, fichier: d.k }); });
var BY = J.BY = {}; J.ECRANS.forEach(function (e) { BY[e.k] = e; });
var INTERNE = { pilotage: 'Pilotage', carte: 'La carte', 'carte-secteur': 'La carte du secteur' };   // outils sans rien à montrer au pharmacien
J.ecrans = {};   // rempli par les ecran-*.js : J.ecrans['liste'] = { rendre: function (el, etat) {} }
J.courant = { ecran: 'liste', suite: '' };
/* l'écran de l'adresse vide : celui de <html data-defaut="…"> ; sans l'attribut, « liste ». */
var RAC = function (a) { var r = document.documentElement; return r && r.getAttribute ? r.getAttribute(a) : null; };
J.defaut = (function () { var d = RAC('data-defaut'); return d && BY[d] ? d : 'liste'; })();
J.marque = 'm' + (RAC('data-m') || '32') + ' ' + (RAC('data-ref') || 'Pappers + JARVIS');
J.resoudre = function (h) {
  if (!h) h = J.defaut; else if (h === 'officines' || h === 'officines-liste') h = 'liste';
  if (BY[h]) return { ecran: h, suite: '' };
  var p = h.split('-');
  for (var i = p.length - 1; i >= 1; i--) { var base = p.slice(0, i).join('-'); if (BY[base]) return { ecran: base, suite: p.slice(i).join('-') }; }
  return { ecran: J.defaut, suite: '', inconnue: true };   // adresse inconnue : l'écran par défaut, et le message du routeur
};
J.route = function () {
  var h = (location.hash || '').slice(1), r = J.resoudre(h), e = BY[r.ecran], el = $('#ecran-' + r.ecran), avant = J.courant && J.courant.hash;
  J.courant = { ecran: r.ecran, suite: r.suite, hash: h };
  $$('[data-ecran]').forEach(function (s) { s.hidden = s !== el; });
  document.body.setAttribute('data-ecran-actif', r.ecran);
  $$('[data-nav]').forEach(function (a) { var on = a.getAttribute('data-nav') === e.nav; a.classList.toggle('on', on); if (on && a.tagName === 'A') a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  var ret = $('.b-ret'); ret.hidden = (r.ecran === 'liste' || r.ecran === 'accueil') && !r.suite;
  J.outils(false); J.menuPlus(false);
  if (r.suite !== 'detail' && h !== avant) window.scrollTo(0, 0);   // un ré-affichage sur la même adresse (bascule de vue, filtre) garde la position
  var ec = J.ecrans[r.ecran];
  if (ec && ec.rendre) ec.rendre(el, { suite: r.suite, hash: h, vue: J.S.vue }); else J.prep(e, el);
  if (INTERNE[r.ecran]) J.outilInterne(el, INTERNE[r.ecran]);
  if (r.ecran === 'produits' && !r.suite) J.avisVue(el, 'Vue pharmacien : les prix nets, les stocks et nos ventes sont masqués ; seule la sélection en PDF se remet au pharmacien.');
  J.poseIcones(el);
  document.title = (e.nom || 'JARVIS') + ' — ' + J.marque;
  if (r.inconnue && h) J.toast('Cette adresse n’existe pas : ' + (r.ecran === 'liste' ? 'voici la liste des officines.' : r.ecran === 'accueil' ? 'voici l’accueil, JARVIS GPS.' : 'voici « ' + e.nom + ' ».'));
};
J.aller = function (h) { if (location.hash === '#' + h) J.route(); else location.hash = '#' + h; };
J.retour = function () { var c = J.courant; if (c.ecran === 'fiche') J.aller(J.S.ficheDepuis || 'liste'); else if (c.suite) J.aller(c.ecran); else J.aller('accueil'); };   // ficheDepuis : posé par le GPS seulement (J.ouvrirFiche)
J.setVue = function (v) { J.S.vue = v; document.body.setAttribute('data-vue', v); if (J.courant.ecran === 'fiche') J.aller(v === 'pharmacien' ? 'fiche-pharmacien' : 'fiche'); else J.route(); };
/* feuille « Outils » : trois familles (Sur la page d'accueil · Outils · En développement) */
J.outils = function (ouvrir) {
  var o = $('#outils'), v = $('#voile'), b = $$('[data-outils]');
  if (!ouvrir) { o.hidden = true; v.hidden = true; b.forEach(function (x) { x.setAttribute('aria-expanded', 'false'); }); return; }
  var fam = function (f) { return J.ECRANS.filter(function (e) { return e.fam === f; }); };
  var ligne = function (e) { return '<a class="ol' + (e.k === J.courant.ecran ? ' on' : '') + '" href="#' + e.k + '"><span class="ti">' + J.ico(e.ico) + '</span><span><b>' + esc(e.nom) + '</b><span class="sub">' + esc(e.ph) + '</span></span><span class="ico chev">' + J.icoSvg('chev') + '</span></a>'; };
  var sh = function (t, n) { return '<div class="sh">' + t + ' <span class="n">' + n + '</span></div>'; };
  // Un outil « en développement » déjà DESSINÉ (J.ecrans[k] existe) passe dans « Outils » : la mention « En développement » ne reste que pour les écrans en préparation.
  var A = fam('accueil'), D = fam('direct').concat(fam('dev').filter(function (e) { return !!J.ecrans[e.k]; })), V = fam('dev').filter(function (e) { return !J.ecrans[e.k]; });
  o.innerHTML = '<div class="outils-h"><h2>Tous les outils</h2><button type="button" class="b-rond" data-outils-fermer aria-label="Fermer">' + J.ico('close') + '</button></div>' +
    '<div class="sh">Espace</div><div class="seg" role="group" aria-label="Espace"><button type="button" aria-pressed="true">Intégral</button><button type="button" aria-pressed="false" data-stub="L’espace Escale n’est pas dessiné dans cette maquette.">Escale</button></div>' +
    sh('Sur la page d’accueil', A.length) + A.map(ligne).join('') + sh('Outils', D.length) + D.map(ligne).join('') +
    '<details><summary>' + sh('En développement', V.length + 1) + '</summary><p class="dev-note">Ces outils marchent, mais ils ne sont pas encore au point.</p>' + V.map(ligne).join('') +
    '<button type="button" class="ol" data-stub="JARVIS Academy s’ouvre dans un nouvel onglet dans l’appli réelle (lien externe, non suivi dans cette maquette : aucune ressource extérieure)."><span class="ti">' + J.ico('spark') + '</span><span><b>JARVIS Academy</b><span class="sub">Se former à l’outil, pas à pas · nouvel onglet</span></span><span class="ico chev">' + J.icoSvg('ext') + '</span></button></details>';
  o.hidden = false; v.hidden = false; b.forEach(function (x) { x.setAttribute('aria-expanded', 'true'); });
  var f = $('[data-outils-fermer]', o); if (f) f.focus();
};
J.menuPlus = function (ouvrir) {
  var m = $('#menu-plus'), b = $('.b-plus');   // le « + » de la barre du haut seulement (un écran peut avoir son propre data-plus)
  if (!ouvrir) { m.hidden = true; if (b) b.setAttribute('aria-expanded', 'false'); return; }
  m.innerHTML = [['cal', 'Noter un rendez-vous', '', 'rdv'], ['tasks', 'Ajouter une tâche', '', 'todo'], ['user', 'Créer un prospect', 'La création d’un prospect n’est pas dessinée.'], ['bulb', 'Proposer un outil', 'La remontée d’une idée n’est pas dessinée.']]
    .map(function (x) { return '<button type="button" role="menuitem"' + (x[3] ? ' data-plus-aller="' + x[3] + '"' : ' data-stub="' + x[2] + '"') + '>' + J.ico(x[0]) + x[1] + '</button>'; }).join('');
  var r = b.getBoundingClientRect(); m.style.top = Math.round(r.bottom + 8) + 'px'; m.style.right = Math.max(12, Math.round(window.innerWidth - r.right)) + 'px';
  m.hidden = false; b.setAttribute('aria-expanded', 'true');
};
J.rechercheGlobale = function (q) { J.S.q = q; if (J.courant.ecran !== 'liste') J.aller('liste'); else if (J.ecrans.liste && J.ecrans.liste.filtrer) J.ecrans.liste.filtrer(); };
J.demarrer = function () {
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var s = t.closest('[data-stub]'); if (s) { e.preventDefault(); J.toast(s.getAttribute('data-stub')); return; }
    if (t.closest('[data-action="retour"]')) { e.preventDefault(); J.retour(); return; }
    // le <body> porte aussi data-vue (état de la vue) : ce n'est pas une bascule ; sans ce test, tout clic de l'appli était annulé et l'écran re-rendu
    var v = t.closest('[data-vue]'); if (v && v !== document.body) { e.preventDefault(); J.setVue(v.getAttribute('data-vue')); return; }
    if (t.closest('[data-outils]')) { e.preventDefault(); J.outils($('#outils').hidden); return; }
    if (t.closest('[data-outils-fermer]') || t.closest('#voile')) { J.outils(false); return; }
    if (t.closest('.b-plus[data-plus]')) { e.preventDefault(); J.menuPlus($('#menu-plus').hidden); return; }
    var pa = t.closest('[data-plus-aller]'); if (pa) { var cible = pa.getAttribute('data-plus-aller'); J.menuPlus(false); J.aller(cible);
      if (cible === 'todo') setTimeout(function () { var b = $('#ecran-todo [data-ajouter]'); if (b && !$('#ecran-todo').hidden) b.click(); }, 80);   // la feuille « Ajouter une tâche » s'ouvre
      return; }
    if (t.closest('[data-compte]')) { J.toast('Mon compte : Claire Tessier · Intégral / Escale · Déconnexion (non dessiné).'); return; }
    if (!t.closest('#menu-plus')) J.menuPlus(false);
    var cp = t.closest('.cp'); if (cp) { e.preventDefault(); J.toast('Copié : ' + cp.parentNode.textContent.trim()); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { J.outils(false); J.menuPlus(false); }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); $('#rech-globale').focus(); }
  });
  $('#rech-globale').addEventListener('input', function (e) { J.rechercheGlobale(e.target.value); });
  window.addEventListener('hashchange', J.route);
  J.poseIcones(document); J.route();
};
})();
