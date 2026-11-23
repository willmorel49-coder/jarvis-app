/* PHIRST · la page publique « La lettre » (24/11/2026) — logique PURE : aucun accès à la page ni à la base, donc testable dans node
   (tests/phirst-lettre.test.mjs). Ce fichier calcule TOUS les textes et fabrique le HTML ; lettre.js ne fait que lire la base,
   monter le HTML, et brancher les gestes (3D, avant / après, panneau).
   Maquette validée par Will le 23/11/2026 : ~/PHIRST/finalisation-2026-11-22/P-vitrine-variantes/v1/ (« 1 · La lettre », version p7).
   Dépend de phirst-dossiers-pur.js (SORTES, monterVolet) et de phirst-lettre-contenu.js (normaliser, jourLisible, quandLisible, m2). */
(function (racine) {
  'use strict';
  var DP = racine.PHIRST_DOSSIERS_PUR, L = racine.PHIRST_LETTRE;
  if (typeof require === 'function') {
    try { DP = DP || require('../phirst-dossiers-pur.js'); L = L || require('../phirst-lettre-contenu.js'); } catch (e) { /* le navigateur n'a pas `require` : les deux fichiers sont déjà chargés */ }
  }

  var JETON_RE = /^[A-Za-z0-9_-]{24,64}$/;
  var MC = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var ML = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var NOMBRES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'];
  /* les trois exemples de la partie « Ce que j’ai déjà fait » : photos et fiches À FOURNIR PAR YANN (décision de Will, 23/11/2026) */
  var REALISATIONS = [
    { sorte: 'Agencement', ou: 'Pharmacie à fournir', ville: 'Ville à fournir', annee: 'Année', surface: 'Surface', duree: 'Durée des travaux' },
    { sorte: 'Transfert', ou: 'Pharmacie à fournir', ville: 'Ville à fournir', annee: 'Année', surface: 'Surface', duree: 'Durée des travaux' },
    { sorte: 'Robot', ou: 'Pharmacie à fournir', ville: 'Ville à fournir', annee: 'Année', surface: 'Modèle', duree: 'Durée de la pose' }
  ];
  /* ce que le texte « Deux volets qui avancent ensemble… » dit de chaque sorte de volet */
  var DECRIT = {
    transfert: 'le transfert (le nouveau local, l’accord de l’ARS)',
    agencement: 'l’agencement (le plan, le mobilier, les travaux)',
    riedl: 'la robotique Riedl (la visite technique, l’offre, l’installation)',
    pda: 'la robotique PDA (l’étude, l’offre, l’installation)'
  };

  /* ───────── petits outils ───────── */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function txt(v) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''; }
  function maj1(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
  function min1(t) { t = String(t || ''); return t.charAt(0).toLowerCase() + t.slice(1); }
  /* typographie française, appliquée AUX TEXTES seulement (jamais à l'intérieur d'une balise : un attribut comme style="--p:50%" reste intact) */
  function typoTexte(s) { return String(s).replace(/ ([:;!?»·])/g, ' $1').replace(/« /g, '« '); }
  function typoHtml(h) { return String(h).split(/(<[^>]*>)/).map(function (p, i) { return i % 2 ? p : typoTexte(p); }).join(''); }
  function jetonDe(hash) { var j = String(hash == null ? '' : hash).replace(/^#/, ''); return JETON_RE.test(j) ? j : ''; }
  function prenomDe(marque) { return txt(marque && marque.interlocuteur).split(' ')[0] || ''; }
  function telHref(t) { var n = String(t || '').replace(/[^\d+]/g, ''); return n.replace(/\D/g, '').length >= 10 ? 'tel:' + n : ''; }
  function mailHref(m) { m = txt(m); return /^[^@\s<>"]+@[^@\s<>"]+$/.test(m) ? 'mailto:' + m : ''; }
  function ico(n, t) {
    t = t || 20;
    var p = {
      fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
      g: '<path d="m15 18-6-6 6-6"/>', d: '<path d="m9 18 6-6-6-6"/>', main: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1.5v-2a1.5 1.5 0 0 1 3 0V12m0-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.3 15a1.5 1.5 0 0 1 2.4-1.8L8 15"/>',
      ok: '<path d="m5 12 5 5 9-10"/>', photo: '<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
      cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'
    }[n] || '';
    return '<svg width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ───────── les mois ───────── */
  function ajouteMois(ym, n) { var a = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n; a += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return a + '-' + (m < 9 ? '0' : '') + (m + 1); }
  function moisLong(ym) { return maj1(ML[+ym.slice(5, 7) - 1]) + ' ' + ym.slice(0, 4); }

  /* ───────── l'échange avec la base ───────── */
  /* Lance `appel` (qui rend une promesse) et rend TOUJOURS une réponse dans le délai : { data, error } de la base, ou { muet:true } (délai dépassé),
     ou { erreur:true } (la promesse a échoué). Jamais d'exception : un contrôle qui rate ne dit rien de la chose contrôlée. */
  function lire(appel, ms) {
    return new Promise(function (resolve) {
      var fini = false, t = setTimeout(function () { if (!fini) { fini = true; resolve({ muet: true }); } }, ms);
      function rendre(v) { if (fini) return; fini = true; clearTimeout(t); resolve(v); }
      var p; try { p = Promise.resolve(appel()); } catch (e) { return rendre({ erreur: true }); }
      p.then(function (r) { rendre(r && typeof r === 'object' ? r : { erreur: true }); }, function () { rendre({ erreur: true }); });
    });
  }
  /* Ce que la page doit faire de la réponse de phirst_lettre : 'lettre' (la montrer), 'lien' (« ce lien n'est plus valable »), 'muet' (« la page met du temps »).
     Un jeton mal formé est un lien mort quoi que la base réponde ; sinon, seule une lettre nulle (réponse claire de la base) tue le lien. */
  function decider(jeton, res) {
    var marque = null, data = res && res.data;
    if (data && typeof data === 'object' && data.marque && typeof data.marque === 'object') marque = data.marque;
    if (!jeton) return { etat: 'lien', marque: marque };
    if (!res || res.muet || res.erreur || res.error || !data || typeof data !== 'object') return { etat: 'muet', marque: null };
    if (data.lettre === null) return { etat: 'lien', marque: marque };
    if (typeof data.lettre !== 'object' || Array.isArray(data.lettre)) return { etat: 'muet', marque: null };
    return { etat: 'lettre', marque: marque, reponse: data };
  }
  /* La réponse de phirst_lettre_demande → { ok:true } | { ok:false, raison:'tel'|'lien'|'trop'|'champs'|'reseau' } */
  function classerDemande(res) {
    if (!res || res.muet || res.erreur || res.error || !res.data || typeof res.data !== 'object') return { ok: false, raison: 'reseau' };
    if (res.data.ok === true) return { ok: true };
    var r = res.data.raison;
    return { ok: false, raison: r === 'tel' || r === 'lien' || r === 'trop' || r === 'champs' ? r : 'reseau' };
  }
  function messageDemande(raison, marque) {
    var pre = prenomDe(marque), tel = txt(marque && marque.tel), qui = pre && tel ? pre + ' au ' + tel : '';
    if (raison === 'tel') return 'Écrivez un numéro à dix chiffres, pour que ' + (pre || 'nous') + ' vous rappelle' + (pre ? '' : 'ions') + '.';
    if (raison === 'lien') return qui ? 'Ce lien n’est plus valable : appelez ' + qui + '.' : 'Ce lien n’est plus valable : contactez directement la personne qui vous l’a envoyé.';
    if (raison === 'trop') return qui ? 'Beaucoup de messages aujourd’hui : appelez directement ' + qui + '.' : 'Beaucoup de messages aujourd’hui : contactez directement la personne qui vous a envoyé cette page.';
    if (raison === 'champs') return 'Un des champs est trop long : raccourcissez-le, puis réessayez.';
    return 'Pas envoyé : la connexion a manqué. Réessayez, ou appelez directement.';
  }
  /* un numéro que la base acceptera : 30 caractères au plus, 10 à 15 chiffres */
  function telValide(t) { t = txt(t); return t.length <= 30 && t.replace(/\D/g, '').length >= 10 && t.replace(/\D/g, '').length <= 15; }

  /* ───────── le calcul de la page ───────── */
  function nomsVolets(vs) {
    return vs.map(function (v, i) { return i === 0 ? v.nom : min1(v.nom); }).join(', ').replace(/, ([^,]*)$/, vs.length > 1 ? ' et $1' : ', $1');
  }
  function nombreEnLettres(n) { return NOMBRES[n] || String(n); }
  function texteVolets(vs) {
    var d = vs.map(function (v) { return DECRIT[v.sorte] || min1(v.nom); });
    if (vs.length === 1) return 'Un volet, suivi pas à pas : ' + d[0] + '.';
    if (vs.length === 2) return 'Deux volets qui avancent ensemble : ' + d[0] + ' et ' + d[1] + '.';
    return maj1(nombreEnLettres(vs.length)) + ' volets qui avancent ensemble, chacun avec ses dates : ' + nomsVolets(vs).replace(/^./, function (c) { return c.toLowerCase(); }) + '.';
  }
  function modele(reponse, auj) {
    reponse = reponse && typeof reponse === 'object' ? reponse : {};
    var lt = reponse.lettre && typeof reponse.lettre === 'object' ? reponse.lettre : {};
    var marque = reponse.marque && typeof reponse.marque === 'object' ? reponse.marque : {};
    auj = DP.estJour(auj) ? auj : DP.aujourdhui();
    var annee = +auj.slice(0, 4), cur = auj.slice(0, 7);
    var c = L.normaliser(lt.contenu);

    /* les volets : ceux de la base (jamais « perdu »), dans l'ordre des sortes, montés comme dans l'app */
    var volets = (Array.isArray(lt.volets) ? lt.volets : []).filter(function (v) { return v && DP.SORTES[v.sorte] && v.etat !== 'perdu'; })
      .sort(function (a, b) { return DP.ORDRE.indexOf(a.sorte) - DP.ORDRE.indexOf(b.sorte); })
      .map(function (v) { return DP.monterVolet({ id: null, sorte: v.sorte, etat: v.etat, details: v.details, created_at: null }, Array.isArray(v.etapes) ? v.etapes : []); });

    var pharmacie = txt(lt.pharmacie), ville = txt(lt.ville);
    var m = { marque: { marque: txt(marque.marque), interlocuteur: txt(marque.interlocuteur), mail: txt(marque.mail), tel: txt(marque.tel) }, auj: auj,
      pharmacie: pharmacie, ville: ville, contenu: c, volets: volets };
    m.prenom = prenomDe(m.marque);

    /* le rendez-vous : la date de Yann, sinon celle de la 1re étape « 1er rendez-vous » faite */
    var rdv = c.rdv;
    if (!rdv) volets.some(function (v) { return v.etapes.some(function (e) { if (e.k === 'rdv' && e.faite) { rdv = e.faite; return true; } return false; }); });
    m.rdv = rdv; m.rdvLisible = rdv ? L.jourLisible(rdv, annee) : '';
    m.rdvFait = volets.some(function (v) { return v.etapes.some(function (e) { return e.k === 'rdv' && e.faite; }); });
    m.ligneVolets = volets.length ? nomsVolets(volets) : '';

    /* l'ouverture visée : le mois de la dernière étape du volet qui finit le plus tard */
    var fin = '';
    volets.forEach(function (v) { var e = v.etapes[v.etapes.length - 1], d = e && (e.faite || e.prevue); if (d && d > fin) fin = d; });
    m.ouverture = fin ? moisLong(fin.slice(0, 7)) : '';

    /* le calendrier : 13 mois */
    var faites = []; volets.forEach(function (v) { v.etapes.forEach(function (e) { if (e.faite) faites.push(e.faite); }); });
    faites.sort(); var debut = cur;
    if (faites.length) { var pm = faites[0].slice(0, 7); if (pm >= ajouteMois(cur, -3) && pm <= cur) debut = pm; }
    var mois = []; for (var i = 0; i < 13; i++) mois.push(ajouteMois(debut, i));
    m.mois = mois.map(function (x, k) { return { ym: x, court: MC[+x.slice(5, 7) - 1], an: k === 0 || x.slice(5) === '01', aa: x.slice(2, 4), now: x === cur }; });
    m.voies = volets.map(function (v) {
      return { nom: v.nom, cases: mois.map(function (x) {
        /* une étape qui porte le nom d'un autre volet a déjà sa propre ligne : on ne la répète pas ; sans aucune date, elle n'apparaît pas ; 2 au plus par case */
        var ici = v.etapes.filter(function (s) {
          var ym = s.faite ? s.faite.slice(0, 7) : s.prevue ? s.prevue.slice(0, 7) : '';
          return ym === x && !volets.some(function (o) { return o !== v && o.nom === s.c; });
        }).slice(0, 2);
        return { now: x === cur, points: ici.map(function (s) { return { c: s.c, f: !!s.faite }; }) };
      }) };
    });
    m.texteVolets = volets.length ? texteVolets(volets) : '';
    m.petitCal = 'Dates visées, à caler ensemble.' + (volets.some(function (v) { return v.sorte === 'transfert'; }) ? ' La réponse de l’ARS fixe le reste.' : '');
    var pied = [];
    if (m.rdvFait) pied.push('Le 1er rendez-vous est fait.');
    if (c.suite.t) pied.push('Prochaine étape : ' + min1(c.suite.t) + (c.suite.quand ? ', ' + L.quandLisible(c.suite.quand, annee) : '') + '.');
    m.piedCal = pied.join(' ');

    /* les plans : libellés lus dans les notes de Yann ; la surface et la cote disparaissent si elles manquent */
    var s = c.surfaces, p = c.postes, e = c.entree;
    m.plan = {
      aujourdhui: { surface: L.m2(s.aujourdhui), comptoir: p.aujourdhui ? 'Comptoir · ' + p.aujourdhui + ' poste' + (p.aujourdhui > 1 ? 's' : '') : 'Comptoir', entree: e.aujourdhui ? e.aujourdhui + ' — l’entrée' : 'L’entrée' },
      demain: { surface: L.m2(s.demain), comptoir: p.demain ? 'Comptoir · ' + p.demain + ' poste' + (p.demain > 1 ? 's' : '') : 'Comptoir', entree: e.demain ? e.demain + ' — l’entrée' : 'L’entrée' }
    };
    m.introVu = maj1(c.vu.length === 1 ? 'une' : nombreEnLettres(c.vu.length)) + (c.vu.length > 1 ? ' choses' : ' chose') + ', ' + (c.vu.length > 1 ? 'notées' : 'notée') + ' pendant la visite. ' +
      (c.vu.length > 1 ? 'Chacune est entourée' : 'Elle est entourée') + ' sur le plan de votre officine d’aujourd’hui' + (m.plan.aujourdhui.surface ? ' (' + m.plan.aujourdhui.surface + ')' : '') + '.';
    m.ideeDefaut = Math.min(1, c.propose.length - 1);

    /* la suite */
    var su = c.suite, jour = su.quand ? L.jourLisible(su.quand.slice(0, 10), annee) : '';
    m.suite = su.t ? { avec: true, titre: su.t, quand: su.quand ? maj1(L.quandLisible(su.quand, annee)) : '', detail: su.d,
        motifs: ['Je confirme ' + min1(su.t) + (jour ? ' du ' + jour : ''), 'Je préfère une autre date', 'J’ai une question avant'] }
      : { avec: false, titre: 'On en parle ?', quand: '', detail: 'Un mot, et ' + (m.prenom || 'on') + ' vous rappelle.', motifs: ['Je veux avancer', 'J’ai une question avant'] };

    /* les chapitres présents, numérotés dans l'ordre (01, 02…) : un chapitre sans matière disparaît et les numéros se resserrent */
    var chap = [];
    if (c.vu.length) chap.push({ cle: 'vu', titre: 'Ce que j’ai vu chez vous' });
    chap.push({ cle: 'propose', titre: 'Ce que je vous propose' });
    if (volets.length) chap.push({ cle: 'calendrier', titre: 'Le calendrier' });
    chap.push({ cle: 'realisations', titre: 'Ce que j’ai déjà fait' }, { cle: 'suite', titre: 'La suite' });
    chap.forEach(function (x, k) { x.n = k + 1; x.num = '0' + (k + 1); x.id = 'c' + (k + 1); });
    m.chapitres = chap;
    m.titre = pharmacie ? pharmacie + (m.marque.interlocuteur ? ' · préparée par ' + m.marque.interlocuteur : '') : 'Page préparée pour vous';
    m.pied = 'Page préparée pour ' + (/^pharmacie\b/i.test(pharmacie) ? 'la ' : '') + pharmacie + (m.marque.marque ? ' · ' + m.marque.marque : '');
    return m;
  }

  /* ───────── les dessins : plans, croquis, officine 3D, avant / après ───────── */
  function zoneSur(svg, zone) { return zone ? svg.replace('data-z="' + zone + '"', 'data-z="' + zone + '" class="on"') : svg; }
  function planAujourdhui(m, zone) {
    var a = m.plan.aujourdhui;
    return zoneSur('<svg class="plan" viewBox="0 0 800 520" role="img" aria-label="Plan de l’officine aujourd’hui' + (a.surface ? ', ' + esc(a.surface) : '') + '">' +
      '<g class="pl-zones">' +
      '<rect data-z="file" x="362" y="292" width="76" height="158" rx="14"/><rect data-z="para" x="78" y="78" width="190" height="168" rx="14"/>' +
      '<rect data-z="reserve" x="516" y="64" width="224" height="346" rx="14"/><rect data-z="confid" x="486" y="228" width="84" height="76" rx="14"/></g>' +
      '<g class="pl-mur"><path d="M60 460V60h680v400H440M360 460H60"/><path d="M560 60v170M560 230h180"/></g>' +
      '<g class="pl-vitre"><path d="M110 460h230M460 460h230"/><path d="M110 468h230M460 468h230"/></g>' +
      '<path class="pl-porte" d="M360 460a80 80 0 0 1 80 0"/>' +
      '<g class="pl-meuble"><rect x="96" y="96" width="34" height="132" rx="3"/><rect x="156" y="96" width="34" height="132" rx="3"/><rect x="216" y="96" width="34" height="132" rx="3"/>' +
      '<rect x="296" y="248" width="208" height="34" rx="4"/><rect x="584" y="84" width="130" height="24" rx="3"/><rect x="584" y="128" width="130" height="24" rx="3"/><rect x="584" y="172" width="130" height="24" rx="3"/></g>' +
      '<g class="pl-poste"><circle cx="340" cy="228" r="9"/><circle cx="400" cy="228" r="9"/><circle cx="460" cy="228" r="9"/></g>' +
      '<g class="pl-carton"><rect x="528" y="252" width="22" height="22"/><rect x="530" y="290" width="20" height="20"/><rect x="527" y="326" width="24" height="22"/><rect x="531" y="364" width="18" height="18"/></g>' +
      '<g class="pl-file"><circle cx="400" cy="306" r="7"/><circle cx="398" cy="332" r="7"/><circle cx="402" cy="358" r="7"/><circle cx="399" cy="384" r="7"/><circle cx="401" cy="410" r="7"/><circle cx="400" cy="436" r="7"/></g>' +
      '<g class="pl-txt"><text x="400" y="502" text-anchor="middle">' + esc(a.entree) + '</text><text x="173" y="270" text-anchor="middle">Parapharmacie</text><text x="400" y="204" text-anchor="middle">' + esc(a.comptoir) + '</text>' +
      '<text x="650" y="222" text-anchor="middle">Réserve</text><text x="650" y="300" text-anchor="middle">Couloir</text></g>' +
      (a.surface ? '<g class="pl-cote"><path d="M60 30h680M60 24v12M740 24v12"/><text x="400" y="22" text-anchor="middle">' + esc(a.surface) + '</text></g>' : '') + '</svg>', zone);
  }
  function planDemain(m, zone) {
    var d = m.plan.demain;
    return zoneSur('<svg class="plan" viewBox="0 0 800 520" role="img" aria-label="Plan proposé pour le nouveau local' + (d.surface ? ', ' + esc(d.surface) : '') + '">' +
      '<g class="pl-zones">' +
      '<rect data-z="entree" x="72" y="404" width="140" height="92" rx="14"/><rect data-z="comptoir" x="240" y="112" width="340" height="86" rx="14"/>' +
      '<rect data-z="para" x="214" y="352" width="530" height="96" rx="14"/><rect data-z="confid" x="596" y="48" width="160" height="186" rx="14"/>' +
      '<rect data-z="reserve" x="240" y="44" width="340" height="66" rx="14"/></g>' +
      '<g class="pl-mur"><path d="M90 480H40V40h720v440H200"/><path d="M240 112h340M580 40v72M600 40v190h160M600 190v40"/></g>' +
      '<g class="pl-vitre"><path d="M220 480h520M220 488h520"/><path d="M40 120v300M32 120v300"/></g>' +
      '<path class="pl-porte" d="M90 480a110 110 0 0 1 110 0"/>' +
      '<g class="pl-meuble"><rect x="256" y="150" width="308" height="34" rx="4"/>' +
      '<rect x="236" y="396" width="110" height="30" rx="3"/><rect x="372" y="396" width="110" height="30" rx="3"/><rect x="508" y="396" width="110" height="30" rx="3"/><rect x="644" y="396" width="86" height="30" rx="3"/>' +
      '<rect x="60" y="140" width="30" height="240" rx="3"/><rect x="636" y="96" width="84" height="54" rx="6"/></g>' +
      '<rect class="pl-robot" x="404" y="54" width="150" height="46" rx="6"/>' +
      '<g class="pl-poste"><circle cx="290" cy="134" r="9"/><circle cx="350" cy="134" r="9"/><circle cx="410" cy="134" r="9"/><circle cx="470" cy="134" r="9"/><circle cx="530" cy="134" r="9"/></g>' +
      '<path class="pl-chemin" d="M146 452C150 330 196 286 262 262S400 226 410 206"/>' +
      '<g class="pl-txt"><text x="146" y="512" text-anchor="middle">' + esc(d.entree) + '</text><text x="500" y="226" text-anchor="middle">' + esc(d.comptoir) + '</text>' +
      '<text x="480" y="378" text-anchor="middle">Parapharmacie en vitrine</text><text x="678" y="180" text-anchor="middle">Espace pour parler</text>' +
      '<text x="320" y="84" text-anchor="middle">Réserve</text><text x="479" y="82" text-anchor="middle" class="pl-pt">place d’un robot</text></g>' +
      (d.surface ? '<g class="pl-cote"><path d="M40 20h720M40 14v12M760 14v12"/><text x="400" y="12" text-anchor="middle">' + esc(d.surface) + '</text></g>' : '') + '</svg>', zone);
  }
  function croquis(quoi) {
    var h = '<svg class="croquis" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
      '<path d="M0 500 250 300h300l250 200M250 300V90h300v210M0 0l250 90M800 0 550 90"/>';
    if (quoi === 'avant') {
      h += '<path d="M290 300v-90h220v90M290 236h220"/><path d="M300 150h200M300 120h200" stroke-dasharray="4 8"/>' +
        '<path d="M80 470V250l120-50v230M110 300l60-25M110 350l60-25M110 400l60-25"/><path d="M700 470V250l-120-50v230"/>' +
        '<rect x="560" y="400" width="40" height="40"/><rect x="600" y="410" width="34" height="30"/><rect x="574" y="370" width="30" height="30"/>' +
        '<path d="M380 60v30M420 60v30"/><circle cx="400" cy="230" r="6"/><path d="M330 470h40M430 470h40M380 440h40"/>';
    } else {
      h += '<path d="M270 300v-60h260v60M270 262h260"/><path d="M290 130h220v80H290z"/><path d="M400 150v40M380 170h40"/>' +
        '<path d="M60 480V330l150-40v150M60 380l150-40M60 430l150-40"/><path d="M740 480V330l-150-40v150M740 380l-150-40M740 430l-150-40"/>' +
        '<path d="M290 40v40M350 40v50M410 40v40M470 40v50M530 40v40"/><circle cx="290" cy="84" r="5"/><circle cx="350" cy="94" r="5"/><circle cx="410" cy="84" r="5"/><circle cx="470" cy="94" r="5"/><circle cx="530" cy="84" r="5"/>';
    }
    return h + '</g></svg>';
  }
  function aFournir(t) { return '<span class="a-fournir">' + ico('photo', 16) + esc(t) + '</span>'; }
  var FINS = [['chene', 'Chêne', '#C9A173'], ['foret', 'Vert forêt', '#1F4A3A'], ['lin', 'Lin clair', '#E7DFCF'], ['sauge', 'Sauge', '#9DB39F']];
  function vue(f, k) { return 'vues/' + f + '-' + (k < 9 ? '0' : '') + (k + 1) + '.jpg'; }
  function html3d() {
    return '<div class="v3d" data-v3d tabindex="0" aria-roledescription="officine qu’on fait tourner" aria-label="Officine en 3D. Flèches gauche et droite pour tourner.">' +
      '<div class="v3d-scene"><img alt="Officine en 3D, finition Chêne, vue 6 sur 11" src="' + vue('chene', 5) + '" width="1200" height="640" draggable="false" decoding="async">' +
      '<button type="button" class="v3d-tour g" aria-label="Tourner vers la gauche">' + ico('g', 22) + '</button><button type="button" class="v3d-tour d" aria-label="Tourner vers la droite">' + ico('d', 22) + '</button>' +
      '<span class="v3d-consigne">' + ico('main', 18) + 'Glissez pour tourner</span></div>' +
      '<div class="v3d-fins" role="group" aria-label="Finition du mobilier"><span>Finition</span>' + FINS.map(function (f, k) {
        return '<button type="button" data-fin="' + f[0] + '" aria-pressed="' + (k === 0) + '" style="--sw:' + f[2] + '"><i></i>' + f[1] + '</button>';
      }).join('') + '</div></div>';
  }
  function htmlAA(n) {
    var r = REALISATIONS[n || 0] || REALISATIONS[0];
    return '<div class="aa" data-aa style="--p:50%">' +
      '<div class="aa-c aa-avant">' + croquis('avant') + '<span class="aa-et">Avant</span>' + aFournir('Photo à fournir') + '</div>' +
      '<div class="aa-c aa-apres">' + croquis('apres') + '<span class="aa-et">Après</span>' + aFournir('Photo à fournir') + '</div>' +
      '<div class="aa-poignee" aria-hidden="true"><i>' + ico('g', 18) + ico('d', 18) + '</i></div>' +
      '<input type="range" min="0" max="100" value="50" aria-label="Avant ou après : ' + esc(r.sorte) + ', ' + esc(r.ou) + '"></div>';
  }

  /* ───────── la page ───────── */
  function marqueHtml(m) { return '<span class="marque"><i>+</i>' + esc(m.marque.marque) + '</span>'; }
  function signe(m, cls) {
    var ini = m.marque.interlocuteur.split(' ').slice(0, 2).map(function (x) { return x.charAt(0).toUpperCase(); }).join('');
    return '<span class="portrait" aria-label="Portrait' + (m.prenom ? ' de ' + esc(m.prenom) : '') + ', photo à fournir">' + esc(ini) + '<small>photo à fournir</small></span>' +
      '<span><span class="nom">' + esc(m.marque.interlocuteur) + '</span><br><span class="role">' + cls + '</span></span>';
  }
  function titreHero(pharmacie) {
    /* deux lignes : les deux premiers mots, puis le reste ; les petits mots (la, le, du…) restent collés au mot qui suit */
    var mots = pharmacie.split(' '), l1 = mots.slice(0, 2).join(' '), reste = mots.slice(2);
    function colle(ws) { return ws.map(function (w, i) { return i < ws.length - 1 && /^(la|le|les|de|du|des|l’|d’)$/i.test(w) ? w + ' ' : w + (i < ws.length - 1 ? ' ' : ''); }).join(''); }
    return '<span class="l"><span>' + esc(l1) + '</span></span>' + (reste.length ? ' <span class="l"><span>' + esc(colle(reste)) + '</span></span>' : '');
  }
  function pageHtml(m) {
    var c = m.contenu, ct = { tel: m.marque.tel, mail: m.marque.mail }, tH = telHref(ct.tel), mH = mailHref(ct.mail);
    var num = {}; m.chapitres.forEach(function (x) { num[x.cle] = x; });
    var h = '';
    /* couverture */
    h += '<header class="couv"><div class="couv-lum" aria-hidden="true"></div><div class="couv-ombre" aria-hidden="true"></div>' +
      '<div class="col barre">' + marqueHtml(m) + (m.rdvLisible ? '<p>Après notre rendez-vous du ' + esc(m.rdvLisible) + '</p>' : '') + '</div>' +
      '<div class="col couv-corps"><div><p class="k pour">Préparé pour</p><h1 class="h1">' + titreHero(m.pharmacie) + '</h1>' +
      (m.ville || m.ligneVolets ? '<p class="ville">' + (m.ville ? '<b>' + esc(m.ville) + '</b>' + (m.ligneVolets ? ' · ' : '') : '') + esc(m.ligneVolets) + '</p>' : '') +
      (c.mot ? '<p class="mot">' + esc(c.mot) + '</p>' : '') +
      '<div class="signe">' + signe(m, 'votre seul interlocuteur, du plan à l’ouverture') + '</div></div>' +
      '<nav class="som" aria-label="Dans cette page"><p class="k">Dans cette page</p><ol>' +
      m.chapitres.map(function (x) { return '<li><a href="#' + x.id + '" data-vers="' + x.id + '">' + esc(x.titre) + '</a></li>'; }).join('') + '</ol></nav></div></header>';

    /* constats */
    if (num.vu) {
      var pa = planAujourdhui(m);
      h += '<section class="col ch" id="' + num.vu.id + '" tabindex="-1"><div class="ch-t r"><span class="ch-n">' + num.vu.num + '</span><div><h2>' + esc(num.vu.titre) + '</h2><p>' + esc(m.introVu) + '</p></div></div><div class="vus">' +
        c.vu.map(function (v, i) { return '<article class="vu r"><div class="plan-c">' + pa.replace('data-z="' + v.zone + '"', 'data-z="' + v.zone + '" class="on"') + '</div><div><h3><b>Constat ' + (i + 1) + '</b>' + esc(v.t) + '</h3>' + (v.d ? '<p>' + esc(v.d) + '</p>' : '') + '</div></article>'; }).join('') + '</div></section>';
    }
    /* propositions : le plan et les idées (s'il y en a), puis la 3D qui reste toujours */
    var p = m.plan;
    h += '<section class="col ch" id="' + num.propose.id + '" tabindex="-1"><div class="ch-t r"><span class="ch-n">' + num.propose.num + '</span><div><h2>' + esc(num.propose.titre) + '</h2><p>' +
      (c.propose.length ? 'Le nouveau local, réorganisé pour que chaque constat trouve sa réponse. Choisissez une idée : elle s’allume sur le plan.' : 'Voici le genre d’officine que je dessine. Faites-la tourner, changez le bois du mobilier.') + '</p></div></div>';
    if (c.propose.length) {
      var def = c.propose[m.ideeDefaut].zone;
      var surf = p.aujourdhui.surface && p.demain.surface ? '<span>Aujourd’hui</span><b>' + esc(p.aujourdhui.surface) + '</b><i>→</i><span>Demain</span><b class="n">' + esc(p.demain.surface) + '</b>'
        : p.demain.surface ? '<span>Demain</span><b class="n">' + esc(p.demain.surface) + '</b>' : p.aujourdhui.surface ? '<span>Aujourd’hui</span><b>' + esc(p.aujourdhui.surface) + '</b>' : '';
      h += '<div class="prop"><div class="prop-plan r">' + (surf ? '<p class="m2">' + surf + '</p>' : '') + '<div id="plan-d">' + planDemain(m, def) + '</div></div>' +
        '<ol class="idees r">' + c.propose.map(function (q, i) { return '<li><button type="button" data-z="' + q.zone + '" aria-pressed="' + (i === m.ideeDefaut) + '"><span><b>' + esc(q.t) + '</b>' + (q.d ? '<span>' + esc(q.d) + '</span>' : '') + '</span></button></li>'; }).join('') + '</ol></div>';
    }
    h += '<div class="vol"><div class="r"><h3>Et en volume, à quoi ça ressemble</h3><p>Faites tourner l’officine, changez le bois du mobilier. C’est le genre d’officine que Phirst dessine.</p><p class="note">' + ico('ok', 20) + '<span>Votre officine à vous se dessine après le relevé : vous la visiterez ici même, en 3D, avant de signer quoi que ce soit.</span></p></div><div class="vol-c r">' + html3d() + '</div></div></section>';

    /* calendrier */
    if (num.calendrier) {
      var nv = m.voies.length;
      h += '<section class="col ch" id="' + num.calendrier.id + '" tabindex="-1"><div class="ch-t r"><span class="ch-n">' + num.calendrier.num + '</span><div><h2>' + esc(num.calendrier.titre) + '</h2><p>' + esc(m.texteVolets) + '</p></div></div>' +
        '<div class="cal r"><div class="cal-h"><div><p class="k">Ouverture visée</p><p class="ouv">' + esc(m.ouverture || 'À caler ensemble') + '</p></div><p class="pet">' + esc(m.petitCal) + '</p></div>' +
        '<div class="regle" id="regle" style="--nv:' + nv + '"><span class="mo"></span>' + m.mois.map(function (x) {
          return '<span class="mo' + (x.an ? ' an' : '') + (x.now ? ' now' : '') + '">' + (x.now ? '<b>Vous êtes ici</b>' : '') + esc(x.court) + (x.an ? ' ' + x.aa : '') + '</span>';
        }).join('') + m.voies.map(function (v) {
          return '<div class="voie"><span class="nm">' + esc(v.nom) + '</span>' + v.cases.map(function (k) {
            return '<span class="cs' + (k.now ? ' now' : '') + '">' + k.points.map(function (q) { return '<span class="pt' + (q.f ? ' f' : '') + '"><i></i><span>' + esc(q.c) + '</span></span>'; }).join('') + '</span>';
          }).join('') + '</div>';
        }).join('') + '</div>' + (m.piedCal ? '<p class="cal-pied">' + esc(m.piedCal) + '</p>' : '') + '</div></section>';
    }

    /* réalisations */
    h += '<section class="col ch" id="' + num.realisations.id + '" tabindex="-1"><div class="ch-t r"><span class="ch-n">' + num.realisations.num + '</span><div><h2>' + esc(num.realisations.titre) + '</h2><p>Des officines que j’ai refaites, avant et après. Glissez la poignée.</p></div></div>' +
      '<div class="real"><div class="r" id="aa">' + htmlAA(0) + '</div><div class="onglets r">' + REALISATIONS.map(function (r, i) {
        return '<button type="button" data-real="' + i + '" aria-pressed="' + (i === 0) + '"><b>' + esc(r.sorte) + '</b><strong>' + esc(r.ou) + '</strong><span>' + esc(r.ville) + ' · ' + esc(r.annee) + ' · ' + esc(r.surface) + '</span></button>';
      }).join('') + '<div class="temoin"><q>Le mot du pharmacien, en deux phrases.</q><p>Témoignage à demander' + (m.prenom ? ' par ' + esc(m.prenom) : '') + '</p></div></div></div></section>';

    /* la suite */
    var su = m.suite;
    h += '<section class="col suite r" id="' + num.suite.id + '" tabindex="-1"><div class="suite-g"><div><p class="k">' + num.suite.num + ' · La suite</p><h2>' + esc(su.titre) + '</h2>' +
      (su.quand ? '<span class="quand">' + ico('cal', 22) + esc(su.quand) + '</span>' : '') + (su.detail ? '<p class="d">' + esc(su.detail) + '</p>' : '') +
      '<div class="btns">' + (su.avec ? '<button type="button" class="btn" data-projet>Ça me va ' + ico('fleche', 20) + '</button><button type="button" class="btn clair" data-projet="autre">Une autre date</button>'
        : '<button type="button" class="btn" data-projet>Être rappelé ' + ico('fleche', 20) + '</button>') + '</div></div>' +
      '<div class="carte"><div class="signe">' + signe(m, esc(m.marque.marque)) + '</div>' +
      (tH ? '<a href="' + esc(tH) + '">' + ico('tel', 22) + esc(ct.tel) + '</a>' : '') + (mH ? '<a href="' + esc(mH) + '">' + ico('mail', 22) + esc(ct.mail) + '</a>' : '') + '</div></div></section>' +
      '<footer class="col pied">' + esc(m.pied) + '</footer>';
    return typoHtml(h);
  }
  /* les trois états hors cas normal : même habillage (papier clair, Newsreader), rien de clignotant */
  function etatHtml(quoi, marque) {
    marque = marque && typeof marque === 'object' ? marque : {};
    var mq = { marque: txt(marque.marque), interlocuteur: txt(marque.interlocuteur), mail: txt(marque.mail), tel: txt(marque.tel) };
    var tH = telHref(mq.tel), mH = mailHref(mq.mail), h;
    if (quoi === 'lien') {
      h = '<h1 class="serif">Ce lien n’est plus valable.</h1>' +
        '<p>' + (mq.interlocuteur ? 'Pour recevoir un lien à jour, écrivez ou appelez ' + esc(mq.interlocuteur) + '.' : 'Pour en recevoir un nouveau, contactez la personne qui vous l’a envoyé.') + '</p>' +
        (tH || mH ? '<div class="carte">' + (tH ? '<a href="' + esc(tH) + '">' + ico('tel', 22) + esc(mq.tel) + '</a>' : '') + (mH ? '<a href="' + esc(mH) + '">' + ico('mail', 22) + esc(mq.mail) + '</a>' : '') + '</div>' : '');
    } else if (quoi === 'muet') {
      h = '<h1 class="serif">La page met un peu de temps à répondre.</h1><p>Rechargez-la dans une minute.</p>';
    } else {
      h = '<p class="etat-calme serif">Un instant, la page s’ouvre.</p>';
    }
    return typoHtml('<div class="etat"><div class="etat-c">' + (mq.marque && quoi === 'lien' ? '<p class="barre-etat">' + marqueHtml({ marque: mq }) + '</p>' : '') + h + '</div></div>');
  }

  /* ───────── le panneau « On avance ensemble ? » ───────── */
  function panneauHtml(m, motif) {
    var pre = m.prenom, t = m.marque.tel, tH = telHref(t), mH = mailHref(m.marque.mail);
    return '<div class="pf-tete"><div><p class="pf-k">' + esc(m.pharmacie) + (m.ville ? ' · ' + esc(m.ville) : '') + '</p><h2 id="pf-titre" tabindex="-1">On avance ensemble ?</h2></div><button type="button" class="pf-btn clair petit" data-fermer>Fermer</button></div>' +
      '<form novalidate><p class="pf-int">Un mot, et ' + esc(pre || 'on') + ' vous rappelle. Pas besoin de redire qui vous êtes : ' + (pre ? 'il' : 'on') + ' a votre dossier sous les yeux.</p>' +
      '<fieldset class="pf-champ"><legend>Ce que vous voulez</legend><div class="pf-motifs">' + m.suite.motifs.map(function (x) { return '<button type="button" data-motif="' + esc(x) + '" aria-pressed="' + (x === motif) + '">' + esc(x) + '</button>'; }).join('') + '</div></fieldset>' +
      '<div class="pf-deux"><div class="pf-champ"><label for="pf-nom">Votre nom</label><input id="pf-nom" autocomplete="name" maxlength="120"></div>' +
      '<div class="pf-champ"><label for="pf-tel">Téléphone</label><input id="pf-tel" type="tel" inputmode="tel" autocomplete="tel" required maxlength="30" aria-describedby="pf-tel-aide"><p class="aide" id="pf-tel-aide">Pour que ' + esc(pre || 'nous') + ' vous rappelle' + (pre ? '' : 'ions') + '.</p></div></div>' +
      '<div class="pf-champ"><label for="pf-mot">Un mot (facultatif)</label><textarea id="pf-mot" rows="3" maxlength="2000"></textarea></div>' +
      '<p class="pf-statut" id="pf-statut" role="alert" tabindex="-1" hidden></p>' +
      '<button type="submit" class="pf-btn" id="pf-envoyer">Envoyer' + (pre ? ' à ' + esc(pre) : '') + ico('fleche', 20) + '</button>' +
      (tH || mH ? '<div class="pf-ou"><p>Ou directement :</p>' + (tH ? '<a href="' + esc(tH) + '">' + ico('tel', 20) + esc(t) + '</a>' : '') + (mH ? '<a href="' + esc(mH) + '">' + ico('mail', 20) + esc(m.marque.mail) + '</a>' : '') + '</div>' : '') + '</form>';
  }
  function merciHtml(m, motif, tel) {
    var pre = m.prenom;
    return '<div class="pf-merci" role="status" tabindex="-1" id="pf-merci"><span class="pf-ok">' + ico('ok', 26) + '</span><h3>C’est envoyé' + (pre ? ' à ' + esc(pre) : '') + '.</h3><p>' + esc(motif) + '. ' + esc(pre || 'On') + ' vous rappelle au ' + esc(tel) + '.</p></div><button type="button" class="pf-btn clair" data-fermer>Fermer</button>';
  }

  var API = { JETON_RE: JETON_RE, REALISATIONS: REALISATIONS, jetonDe: jetonDe, lire: lire, decider: decider, classerDemande: classerDemande, messageDemande: messageDemande, telValide: telValide,
    modele: modele, pageHtml: pageHtml, etatHtml: etatHtml, panneauHtml: panneauHtml, merciHtml: merciHtml, htmlAA: htmlAA, planAujourdhui: planAujourdhui, planDemain: planDemain,
    typoHtml: typoHtml, typoTexte: typoTexte, esc: esc, prenomDe: prenomDe, vue: vue, FINS: FINS, nomsVolets: nomsVolets, texteVolets: texteVolets };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  racine.PHIRST_LETTRE_PUR = API;
})(typeof window !== 'undefined' ? window : globalThis);
