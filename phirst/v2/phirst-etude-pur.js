/* PHIRST · « L'étude de zone » d'une pharmacie (lot F, 25/11/2026) : logique PURE, sans page ni base, donc testable (tests/phirst-etude.test.mjs).
   Maquette choisie par Will : « 1 · Le dossier » (3 feuilles A4 + une feuille interne qui ne s'imprime jamais).
   Contrat des données : (donnees, sommes) tels que les range la base — `phirst_etudes.donnees` (lue par tous) et `phirst_etudes_sommes.donnees`
   (lue par Yann seulement). Règles tenues ici :
   - la vue téléprospectrice n'écrit AUCUN « € » : les lignes d'argent ne sont pas rendues (pas cachées, pas remplacées par un trou) ;
   - une donnée manquante (null) devient « — » ou la phrase disparaît : jamais « null », « NaN », « undefined », jamais 0 à la place d'un inconnu ;
   - « À surveiller » (titulaire de 60 ans ou plus ET seul) : feuille interne seulement ;
   - le quorum (art. L5125-4 du Code de la santé publique) est calculé ici, à partir de la population, du département et du nombre de pharmacies. */
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.PHIRST_ETUDE_PUR = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NB = '\u202f'; // espace fine insécable
  var RAYON_LISTE = 16;       // au-delà : les 16 plus proches + « et N autres »
  var DEP_SEUIL_HAUT = ['57', '67', '68', '973']; // première pharmacie dès 3 500 habitants (page de l'Ordre des pharmaciens ; Légifrance non relu)
  var SEUIL_BAS = 2500, SEUIL_HAUT = 3500, TRANCHE = 4500;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function nul(n) { return n === null || n === undefined || (typeof n === 'number' && !isFinite(n)) || n === ''; }
  function nombre(n, dec) {
    if (nul(n) || isNaN(Number(n))) return '—';
    return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).replace(/\s/g, NB);
  }
  function pct(n) { return nul(n) ? '—' : nombre(n, 1) + NB + '%'; }
  function signe(n) { return nul(n) ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + nombre(Math.abs(n), 1) + NB + '%'; }
  function euros(n) { return nul(n) ? '—' : (n < 0 ? '−' : '') + nombre(Math.abs(n)) + NB + '€'; }
  function plur(n, un, plusieurs, aucun) { return n === 0 && aucun ? aucun : n > 1 ? plusieurs : un; }
  function source(D, cle) { var s = D && D.sources && D.sources[cle]; return s ? esc(s.qui) + ' · ' + esc(s.annee) : ''; }

  /* « PHARMACIE DE LA HAIE VIGNÉ » → « Pharmacie de la Haie Vigné » */
  var PETITS = { de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, et: 1, sur: 1, en: 1, a: 1, aux: 1 };
  function joli(t) {
    return String(t == null ? '' : t).toLowerCase().split(' ').map(function (m, i) {
      if (i > 0 && PETITS[m]) return m;
      if (/^[ld][’']/.test(m)) return m.slice(0, 2) + m.charAt(2).toUpperCase() + m.slice(3);
      return m.split('-').map(function (b) { return b.charAt(0).toUpperCase() + b.slice(1); }).join('-');
    }).join(' ');
  }

  /* Quorum : 1re pharmacie dès 2 500 habitants (3 500 en 57, 67, 68 et 973), puis une de plus par tranche ENTIÈRE de 4 500. */
  function seuilPremiere(dep) { return DEP_SEUIL_HAUT.indexOf(String(dep == null ? '' : dep).trim()) >= 0 ? SEUIL_HAUT : SEUIL_BAS; }
  function quorum(pop, existantes, dep) {
    if (nul(pop) || isNaN(Number(pop))) return null;
    pop = Number(pop);
    var s = seuilPremiere(dep), autorisees = pop >= s ? 1 + Math.floor((pop - s) / TRANCHE) : 0;
    var prochain = s + autorisees * TRANCHE, ex = nul(existantes) ? null : Number(existantes);
    var verdict = autorisees === 0 || ex === null ? null : ex < autorisees ? 'sous-densité' : ex === autorisees ? 'conforme' : 'surdensité';
    return { premiere: s, autorisees: autorisees, existantes: ex, prochain_seuil: prochain, manque: prochain - pop, verdict: verdict };
  }
  function nbPharmacies(n) { return n === 0 ? 'aucune pharmacie' : n + ' ' + plur(n, 'pharmacie', 'pharmacies'); }
  function ordinal(rang) { return { 2: 'deuxième', 3: 'troisième', 4: 'quatrième', 5: 'cinquième' }[rang] || null; }
  function phraseQuorum(C, q) {
    if (!q) return '';
    var d = '<strong>' + nombre(C.pop_2023) + ' habitants</strong>', ex = q.existantes, nom = esc(C.nom || 'La commune');
    var h = nom + ' compte ' + d + (ex === null ? '' : ' et <strong>' + nbPharmacies(ex) + '</strong>') + '. ';
    if (q.autorisees === 0) {
      return h + 'C’est sous les ' + nombre(q.premiere) + ' habitants à partir desquels la loi autorise une première pharmacie : il manque ' + nombre(q.manque) + ' habitants.';
    }
    h += 'La loi en autorise ' + q.autorisees + (q.verdict ? ' : la commune est <strong>' + q.verdict + '</strong>' : '') + '. ';
    var o = ordinal(q.autorisees + 1);
    return h + (o ? 'Une ' + o + ' pharmacie' : 'Une pharmacie de plus') + ' ne deviendrait possible qu’à ' + nombre(q.prochain_seuil) + ' habitants.';
  }

  /* Pharmacies « à surveiller » : titulaire de 60 ans ou plus ET seul (repères internes). La pharmacie étudiée a sa propre rubrique (A). */
  function aSurveiller(D) {
    return ((D && D.pharmacies) || []).filter(function (p) { return !p.est_etudiee && p.criteres && p.criteres.titulaire_60_ou_plus && p.criteres.titulaire_seul; });
  }
  /* Les autres pharmacies dans la zone (5, 10 ou 15 minutes), les plus proches d'abord. */
  function concurrents(D, zone) {
    return ((D && D.pharmacies) || []).filter(function (p) { return !p.est_etudiee && p.zone <= zone; })
      .map(function (p, i) { return { p: p, i: i }; })
      .sort(function (a, b) { var x = nul(a.p.distance_km) ? 1e9 : a.p.distance_km, y = nul(b.p.distance_km) ? 1e9 : b.p.distance_km; return x - y || a.i - b.i; })
      .map(function (o) { return o.p; });
  }

  /* ── les morceaux ── */
  var TETE = '<div class="pe-lg pe-tete"><div class="pe-lib"></div><div class="pe-val">À 5 min</div><div class="pe-val">À 10 min</div><div class="pe-val">À 15 min</div></div>';
  function ligne(lib, s, vals) {
    return '<div class="pe-lg"><div class="pe-lib">' + lib + (s ? '<span class="pe-src">' + s + '</span>' : '') + '</div>' +
      vals.map(function (v) { return '<div class="pe-val">' + v + '</div>'; }).join('') + '</div>';
  }
  function zones(D) { var Z = (D && D.zones) || {}; return [Z['5'] || Z[5] || {}, Z['10'] || Z[10] || {}, Z['15'] || Z[15] || {}]; }
  function parZone(D, f) { return zones(D).map(f); }
  function habParPharmacie(z) { return nul(z.habitants) || !z.pharmacies_finess ? null : Math.round(z.habitants / z.pharmacies_finess); }

  function chapitre(n, titre, corps) { return '<div class="pe-chap"><div class="pe-chap-t"><span class="pe-chap-n">' + n + '</span><h2>' + titre + '</h2></div>' + corps + '</div>'; }
  function enTete(D, nom) {
    var P = D.pharmacie || {}, C = D.commune || {};
    return '<div class="pe-entete"><span><b>Étude de zone</b> · ' + esc(nom || P.nom) + (C.nom || P.commune ? ', ' + esc(C.nom || P.commune) : '') + '</span>' +
      (D.calcule_le ? '<span>Calculée le ' + esc(D.calcule_le) + '</span>' : '') + '</div>';
  }
  function pied(n) { return '<div class="pe-pied"><span>Phirst</span><span>' + n + ' / 3</span></div>'; }
  function lieu(P, C) {
    var h = esc(P.adresse || '');
    var ic = P.intercommunalite ? String(P.intercommunalite) : '';
    var cn = C.nom || P.commune;
    if (ic && cn) h += (h ? ' · ' : '') + (/^(Communauté|Métropole|Agglomération)/i.test(ic) ? esc(cn) + ' fait partie de la ' + esc(ic) : 'Intercommunalité : ' + esc(ic));
    return h;
  }

  /* Feuille 1 : la couverture, la carte, trois chiffres. */
  function feuille1(D) {
    var P = D.pharmacie || {}, z10 = zones(D)[1];
    var autres = z10.concurrents_finess;
    var l = '<div class="pe-legende"><span><i style="background:rgba(18,165,103,.30);box-shadow:inset 0 0 0 2px #1A3A2E"></i>5 min en voiture</span><span><i style="background:rgba(18,165,103,.16);box-shadow:inset 0 0 0 2px #2F8A5B"></i>10 min</span><span><i style="background:rgba(18,165,103,.08);box-shadow:inset 0 0 0 2px #7DB898"></i>15 min</span><span><i style="background:#fff;border-radius:50%;box-shadow:inset 0 0 0 2px #1A3A2E"></i>Autres pharmacies</span></div>';
    var cles = '<div class="pe-cles">' +
      '<div class="pe-cle"><div class="pe-v">' + nombre(z10.habitants) + '</div><div class="pe-l">habitants à moins de 10 minutes</div><span class="pe-src">' + source(D, 'carreaux') + '</span></div>' +
      '<div class="pe-cle"><div class="pe-v">' + nombre(autres) + '</div><div class="pe-l">' + (autres === 1 || autres === 0 ? 'autre pharmacie' : 'autres pharmacies') + ' à moins de 10 minutes</div><span class="pe-src">' + source(D, 'finess') + '</span></div>' +
      '<div class="pe-cle"><div class="pe-v">' + nombre(habParPharmacie(z10)) + '</div><div class="pe-l">habitants par pharmacie dans cette zone</div><span class="pe-src">' + source(D, 'carreaux') + ' et ' + source(D, 'finess') + '</span></div></div>';
    return '<section class="pe-feuille" aria-label="Couverture">' + enTete(D) + '<h1>' + esc(P.nom || 'Pharmacie') + '</h1><p class="pe-adresse">' + lieu(P, D.commune || {}) + '</p>' +
      '<div class="pe-carte" id="pe-carte" role="img" aria-label="Carte des zones à 5, 10 et 15 minutes en voiture autour de la pharmacie"></div>' + l +
      '<span class="pe-src">Temps de trajet : ' + source(D, 'isochrone') + ' · Fond de carte : Plan IGN · Pharmacies : ' + source(D, 'finess') + '</span>' + cles + pied(1) + '</section>';
  }

  /* Chapitre 01 : la commune et ses licences. */
  function chapitre01(D) {
    var C = D.commune || {}, Z = zones(D), z15 = Z[2], q = quorum(C.pop_2023, C.pharmacies, C.departement);
    var nom = esc(C.nom || 'La commune'), h = '';
    if (q) {
      var cible = q.prochain_seuil, haut = Math.min(100, C.pop_2023 / cible * 100);
      var rang = q.autorisees === 0 ? 'une première pharmacie' : (ordinal(q.autorisees + 1) ? 'une ' + ordinal(q.autorisees + 1) + ' pharmacie' : 'une pharmacie de plus');
      h += '<p class="pe-phrase">' + phraseQuorum(C, q) + '</p>' +
        '<div class="pe-quorum"><div class="pe-gros">' + nombre(C.pop_2023) + '</div><div><div class="pe-quorum-t">habitants sur les ' + nombre(cible) + ' qu’il faudrait pour ' + rang + '</div>' +
        '<div class="pe-jauge"><span style="width:' + haut.toFixed(1) + '%"></span>' + (q.autorisees > 0 ? '<em style="left:' + (q.premiere / cible * 100).toFixed(1) + '%" title="' + nombre(q.premiere) + ' habitants : 1re licence"></em>' : '') + '</div>' +
        '<span class="pe-src">Population municipale : ' + source(D, 'historique').replace('2015 et ', '') + ' · Règle : ' + esc(D.sources && D.sources.quorum ? D.sources.quorum.qui + ', ' + D.sources.quorum.quoi : 'Code de la santé publique, article L5125-4') + '</span></div></div>';
    } else if (!nul(C.pharmacies)) {
      h += '<p class="pe-phrase">' + nom + ' compte <strong>' + nbPharmacies(C.pharmacies) + '</strong>. Sa population n’est pas connue : la règle des licences ne peut pas être appliquée.</p>';
    }
    if (!nul(C.pop_2015) && !nul(C.pop_2023)) {
      h += '<p>Entre 2015 et 2023, la commune est passée de ' + nombre(C.pop_2015) + ' à ' + nombre(C.pop_2023) + ' habitants' + (nul(C.evolution_pct) ? '' : ' (' + signe(C.evolution_pct) + ')') + '.' +
        (nul(z15.evolution_pct) ? '' : ' Sur la même période, les communes à moins de 15 minutes ont ' + (z15.evolution_pct < 0 ? 'perdu ' : 'gagné ') + pct(Math.abs(z15.evolution_pct)) + ' d’habitants.') + '</p>' +
        '<span class="pe-src">' + source(D, 'historique') + '</span>';
    }
    return h ? chapitre('01', 'La commune et ses licences', h) : '';
  }

  /* Chapitre 02 : les habitants autour (la ligne « niveau de vie » n'existe que pour Yann). */
  function chapitre02(D, sommes, yann) {
    var c = source(D, 'carreaux'), g = TETE +
      ligne('Habitants', c, parZone(D, function (z) { return nombre(z.habitants); })) +
      ligne('dont 65 ans et plus', c, parZone(D, function (z) { return pct(z.part_65_plus); })) +
      ligne('dont 80 ans et plus', c, parZone(D, function (z) { return pct(z.part_80_plus); }));
    if (yann) g += ligne('Niveau de vie moyen par personne et par an', c, ['5', '10', '15'].map(function (k) { return euros(sommes && sommes.zones && sommes.zones[k] ? sommes.zones[k].niveau_vie_moyen : null); }));
    g += ligne('Ménages sous le seuil de pauvreté', c, parZone(D, function (z) { return pct(z.menages_pauvres); }));
    return chapitre('02', 'Les habitants autour', '<p>Comptés au carré de 200 mètres à l’intérieur de chaque zone, et non par commune entière : une grande ville voisine n’est comptée que pour ses quartiers réellement dans la zone.</p><div class="pe-grille">' + g + '</div>');
  }

  /* Chapitre 03 : les pharmacies autour ; la liste à 10 min peut être vide ou très longue. */
  function listeConcurrents(D) {
    var tous = concurrents(D, 10), n = tous.length;
    if (n === 0) return '<p class="pe-apres">Aucune autre pharmacie à moins de 10 minutes.</p>';
    var vus = tous.slice(0, RAYON_LISTE), reste = n - vus.length;
    var intro = n === 1 ? 'L’autre pharmacie à moins de 10 minutes :' : reste > 0 ? 'Les ' + RAYON_LISTE + ' plus proches parmi les ' + n + ' autres pharmacies à moins de 10 minutes :' : 'Les ' + n + ' autres pharmacies à moins de 10 minutes :';
    return '<p class="pe-apres">' + intro + '</p><ul class="pe-liste">' + vus.map(function (p) {
      return '<li><span>' + esc([joli(p.nom), joli(p.commune)].filter(function (x) { return x; }).join(' · ')) + '</span>' + (nul(p.distance_km) ? '' : '<span>' + nombre(p.distance_km, 1) + NB + 'km</span>') + '</li>';
    }).join('') + (reste > 0 ? '<li class="pe-reste"><span>et ' + reste + ' ' + plur(reste, 'autre', 'autres') + '</span></li>' : '') + '</ul>' +
      '<span class="pe-src">Distance à vol d’oiseau · ' + source(D, 'finess') + '</span>';
  }
  function chapitre03(D) {
    var g = TETE + ligne('Pharmacies, celle-ci comprise', source(D, 'finess'), parZone(D, function (z) { return nombre(z.pharmacies_finess); })) +
      ligne('Habitants par pharmacie', source(D, 'carreaux') + ' et ' + source(D, 'finess'), parZone(D, function (z) { return nombre(habParPharmacie(z)); }));
    return chapitre('03', 'Les pharmacies autour', '<div class="pe-grille">' + g + '</div>' + listeConcurrents(D));
  }
  function feuille2(D, sommes, yann) { return '<section class="pe-feuille" aria-label="Commune, habitants, pharmacies">' + enTete(D) + chapitre01(D) + chapitre02(D, sommes, yann) + chapitre03(D) + pied(2) + '</section>'; }

  /* Chapitre 04 : les médecins. */
  function chapitre04(D) {
    var C = D.commune || {}, h = '';
    if (!nul(C.apl)) {
      h += '<p class="pe-phrase">À ' + esc(C.nom || 'cet endroit') + ', un habitant a accès à <strong>' + nombre(C.apl, 1) + ' consultations</strong> de généraliste par an' +
        (nul(C.apl_france) ? '' : ', contre ' + nombre(C.apl_france, 1) + ' en moyenne en France') + '. On parle de désert médical sous 2,5.</p>';
    }
    h += '<div class="pe-grille">' + TETE +
      ligne('Médecins généralistes', source(D, 'bpe'), parZone(D, function (z) { return nombre(z.generalistes); })) +
      ligne('Accès aux généralistes (consultations par an et par habitant)', source(D, 'apl'), parZone(D, function (z) { return nombre(z.apl_moyen, 1); })) + '</div>';
    return chapitre('04', 'Les médecins', h);
  }

  /* Chapitre 05 : ce qui se construit. Les années viennent de la donnée ; l'année en cours est « partielle » si la source le dit (« jusqu’à septembre 2026 »). */
  function moisPartiel(D) {
    var s = D.sources && D.sources.sitadel ? String(D.sources.sitadel.annee || '') : '', m = /jusqu[’']à\s+([a-zéèêûîôàç]+)\s+(\d{4})/i.exec(s);
    return m ? { mois: m[1].toLowerCase(), annee: m[2] } : null;
  }
  function chapitre05(D) {
    var Z = zones(D), z15 = Z[2], z5 = Z[0], C = D.commune || {}, log = z15.logements || {}, h = '';
    var annees = Object.keys(log).sort(), part = moisPartiel(D);
    var vals = annees.map(function (a) { return log[a] ? log[a].autorises : null; });
    var max = Math.max.apply(null, vals.filter(function (v) { return !nul(v); }).concat([0]));
    if (annees.length && max > 0) {
      h += '<p>Logements autorisés chaque année dans les communes à moins de 15 minutes.' + (part ? ' En ' + part.annee + ', les chiffres s’arrêtent à ' + esc(part.mois) + '.' : '') + '</p>' +
        '<div class="pe-barres">' + annees.map(function (a, i) {
          var v = vals[i];
          return '<div' + (part && a === part.annee ? ' class="pe-partiel"' : '') + ' style="height:' + (nul(v) ? 3 : Math.max(3, v / max * 100)).toFixed(1) + '%"><b>' + nombre(v) + '</b></div>';
        }).join('') + '</div>' +
        '<div class="pe-annees">' + annees.map(function (a) { return '<span>' + esc(a) + (part && a === part.annee ? ' *' : '') + '</span>'; }).join('') + '</div>' +
        '<span class="pe-src">' + source(D, 'sitadel') + (part ? ' · * janvier à ' + esc(part.mois) : '') + '</span>';
      var l5 = z5.logements || {}, an = annees.filter(function (a) { return !(part && a === part.annee); }).pop(), x = an && l5[an];
      if (x && (!nul(x.autorises) || !nul(x.commences))) {
        h += '<p class="pe-apres">À ' + esc(C.nom || 'cet endroit') + ' même, en ' + esc(an) + ' : ' +
          [nul(x.autorises) ? '' : nombre(x.autorises) + ' ' + plur(x.autorises, 'logement autorisé', 'logements autorisés'), nul(x.commences) ? '' : nombre(x.commences) + ' ' + plur(x.commences, 'mis en chantier', 'mis en chantier')].filter(function (t) { return t; }).join(' et ') + '.</p>';
      }
    } else {
      h += '<p>Les logements autorisés autour de la pharmacie ne sont pas encore dans cette étude : ils s’ajouteront au prochain calcul.</p>';
    }
    h += '<div class="pe-grille">' + TETE +
      ligne('Commerces', source(D, 'bpe'), parZone(D, function (z) { return nombre(z.commerces); })) +
      ligne('dont supermarchés', source(D, 'bpe'), parZone(D, function (z) { return nombre(z.supermarches); })) +
      ligne('Services aux particuliers', source(D, 'bpe'), parZone(D, function (z) { return nombre(z.services); })) + '</div>';
    return chapitre('05', 'Ce qui se construit', h);
  }
  function chapitre06() {
    return chapitre('06', 'Ce que cette étude ne sait pas', '<ul class="pe-nsp"><li>Le nombre de passants devant la pharmacie : il faut un comptage sur place.</li><li>D’où viennent vos clients : votre logiciel le sait, avec votre accord.</li><li>La faisabilité juridique d’un transfert : elle se confirme avec un juriste ou l’ARS.</li></ul>');
  }
  function chapitre07(D) {
    var S = D.sources || {}, cles = Object.keys(S);
    if (!cles.length) return '';
    return chapitre('07', 'Les sources', '<ul class="pe-sources">' + cles.map(function (k) { var s = S[k] || {}; return '<li><b>' + esc(s.qui) + '</b> — ' + esc(s.quoi) + (s.annee ? ' (' + esc(s.annee) + ')' : '') + '</li>'; }).join('') + '</ul>');
  }
  function feuille3(D) { return '<section class="pe-feuille" aria-label="Médecins, constructions, limites, sources">' + enTete(D) + chapitre04(D) + chapitre05(D) + chapitre06() + chapitre07(D) + pied(3) + '</section>'; }

  /* ── feuille interne : jamais imprimée ── */
  function coche(t, non) { return '<span class="pe-coche' + (non ? ' pe-non' : '') + '">' + t + '</span>'; }
  function repereA(D, sommes, yann) {
    var P = D.pharmacie || {}, C = D.commune || {}, z15 = zones(D)[2];
    var moi = ((D.pharmacies || []).filter(function (p) { return p.est_etudiee; })[0]) || {};
    var annee = nul(P.naissance_gerant) ? null : 2026 - Number(P.naissance_gerant);
    var signes = [], n = 0, tot = 0, h = '';
    function ajoute(ok, texteOui, texteNon) { tot++; if (ok) n++; var t = ok ? texteOui : texteNon; if (t) signes.push(coche(t, !ok)); }
    if (!nul(C.pharmacies)) ajoute(C.pharmacies === 1, 'Seule dans sa commune', C.pharmacies > 1 ? 'Pas seule dans sa commune (' + C.pharmacies + ' pharmacies)' : '');
    else tot++;
    if (annee !== null) ajoute(annee >= 60, 'Titulaire né en ' + esc(P.naissance_gerant), 'Titulaire né en ' + esc(P.naissance_gerant));
    else tot++;
    var seul = typeof moi.titulaire_seul === 'boolean' ? moi.titulaire_seul : (nul(P.titulaires) ? null : P.titulaires === 1 && !(P.adjoints > 0));
    if (seul !== null) ajoute(seul, 'Titulaire seul à la pharmacie', 'Pas seul à la pharmacie'); else tot++;
    if (!nul(C.evolution_pct) && !nul(z15.evolution_pct)) ajoute(C.evolution_pct < 0 && z15.evolution_pct > 0, 'Sa commune perd des habitants pendant que la zone autour en gagne', '');
    else tot++;
    if (!nul(P.creation) && /^\d{4}$/.test(String(P.creation))) signes.push(coche('Société créée en ' + esc(P.creation) + ', il y a ' + (2026 - Number(P.creation)) + ' ans', true));
    h += '<div class="pe-signal"><h3>Ce qui ressort de sa fiche : ' + n + ' ' + plur(n, 'repère', 'repères') + ' sur ' + tot + '</h3>' + signes.join('') +
      '<span class="pe-src">' + (nul(P.titulaires) ? '' : esc(P.titulaires) + ' ' + plur(P.titulaires, 'titulaire', 'titulaires') + (nul(P.adjoints) ? '' : ' et ' + esc(P.adjoints) + ' ' + plur(P.adjoints, 'adjoint', 'adjoints')) + ' : ') + source(D, 'rpps') + ' · année de naissance : ' + source(D, 'entreprises') + '</span>';
    if (yann) {
      var s = sommes && sommes.pharmacie ? sommes.pharmacie : null;
      if (!s) h += '<p class="pe-somme">Les sommes n’ont pas pu être lues : rouvrez l’étude pour réessayer.</p>';
      else if (nul(s.ca) && nul(s.resultat)) h += '<p class="pe-somme">Aucun chiffre d’affaires lisible dans les comptes déposés.</p>';
      else h += '<p class="pe-somme">' + (nul(s.ca) ? '' : 'Chiffre d’affaires' + (nul(s.ca_annee) ? '' : ' ' + esc(s.ca_annee)) + ' : ' + euros(s.ca)) + (nul(s.ca) || nul(s.resultat) ? '' : ' · ') +
        (nul(s.resultat) ? '' : 'résultat' + (nul(s.resultat_annee) ? '' : ' ' + esc(s.resultat_annee)) + ' : ' + euros(s.resultat)) + '. C’est la dernière année déposée.</p>';
    }
    return chapitre('A', 'Pourquoi l’appeler', h + '</div>');
  }
  function reperesB(D, sommes, yann) {
    var surv = aSurveiller(D), tot = D.titulaire_seul_total, h = '<p>Titulaire de 60 ans ou plus <em>et</em> seul à la pharmacie : une reprise ou un regroupement est probable, donc un chantier.</p>';
    if (!nul(tot)) h += '<p>' + (tot === 0 ? 'Aucune officine' : 'Dans la zone à 15 minutes, ' + tot + ' ' + plur(tot, 'officine est', 'officines sont')) + (tot === 0 ? ' de la zone à 15 minutes n’est en titulaire seul.' : ' en titulaire seul.') + '</p>';
    if (!surv.length) h += '<div class="pe-signal"><p>Aucune pharmacie de la zone ne remplit ces deux critères.</p></div>';
    h += surv.map(function (p) {
      var perte = '';
      if (!nul(p.perte_annee)) {
        var r = yann && sommes && sommes.pharmacies && sommes.pharmacies[p.finess] ? sommes.pharmacies[p.finess].resultat : null;
        perte = coche('Perte en ' + esc(p.perte_annee) + (yann && !nul(r) ? ' : ' + euros(r) : ''));
      }
      return '<div class="pe-signal"><h3>' + esc([joli(p.nom), joli(p.commune)].filter(function (x) { return x; }).join(' · ')) + ' · à ' + esc(p.zone) + ' min</h3>' +
        (nul(p.naissance_plus_ancien) ? '' : coche('Né en ' + esc(p.naissance_plus_ancien))) + coche('Titulaire seul') + perte + (p.compte_publie === false ? coche('Aucun compte publié', true) : '') + '</div>';
    }).join('') + '<span class="pe-src">' + source(D, 'rpps') + ' · ' + source(D, 'entreprises') + '</span>';
    return chapitre('B', 'Dans la zone, à surveiller', h);
  }
  function precautionsC(D) {
    var Co = D.comptes || {}, li = [], ph = D.pharmacies || [];
    if (!nul(Co.ca_lisible) && !nul(Co.testees)) li.push('Chiffre d’affaires lisible pour ' + Co.ca_lisible + ' ' + plur(Co.ca_lisible, 'pharmacie', 'pharmacies') + ' sur ' + Co.testees + ' seulement : les autres le gardent confidentiel ou n’ont pas déposé de compte.');
    var fin = ph.filter(function (p) { return p.position_source === 'finess'; }).length;
    if (ph.length) li.push(fin === 0 ? 'Les positions des pharmacies viennent toutes de la base des équipements de l’INSEE, à une centaine de mètres près.' :
      'Les positions des pharmacies viennent de la base des équipements de l’INSEE, à une centaine de mètres près ; pour ' + fin + ' ' + plur(fin, 'pharmacie', 'pharmacies') + ', seule la position du fichier FINESS est connue, moins précise : un point peut être mal placé.');
    li.push('Les médecins généralistes sont comptés à l’adresse de leur cabinet, dans le contour exact de chaque zone.');
    return chapitre('C', 'À savoir avant d’y croire', '<ul class="pe-nsp">' + li.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>');
  }
  function feuilleInterne(D, sommes, yann) {
    var P = D.pharmacie || {};
    return '<section class="pe-feuille pe-interne" data-interne aria-label="Feuille interne"><div class="pe-entete"><span><b>' + (yann ? 'Pour Yann seulement' : 'Feuille interne') + '</b> · cette feuille ne s’imprime pas</span><span>' + esc(P.nom) + '</span></div>' +
      repereA(D, sommes, yann) + reperesB(D, sommes, yann) + precautionsC(D) + '</section>';
  }

  /* L'étude entière : 3 feuilles + la feuille interne. opts.yann = vrai seulement pour un membre (jamais la téléprospectrice). */
  function feuilles(D, sommes, opts) {
    D = D || {}; var yann = !!(opts && opts.yann);
    return feuille1(D) + feuille2(D, yann ? sommes : null, yann) + feuille3(D) + feuilleInterne(D, yann ? sommes : null, yann);
  }

  return { feuilles: feuilles, feuille1: feuille1, feuille2: feuille2, feuille3: feuille3, feuilleInterne: feuilleInterne,
    quorum: quorum, seuilPremiere: seuilPremiere, phraseQuorum: phraseQuorum, aSurveiller: aSurveiller, concurrents: concurrents,
    nombre: nombre, pct: pct, signe: signe, euros: euros, joli: joli, esc: esc, plur: plur, RAYON_LISTE: RAYON_LISTE };
});
