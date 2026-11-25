/* ═══════════════════════════════════════════════════════════════════════
   BRIEF DE L'OFFICINE — « Aujourd'hui », sur la fiche officine : une ligne de
   résumé APRÈS les chiffres + un bouton bleu « Voir le brief du jour » à droite des onglets, qui ouvrent le
   panneau latéral (maquette C du 22/09/2026). Point rouge tant qu'il y a un
   rappel de lots « À retirer ».
   Phase 1 de la recherche IA × officine (17/09/2026) : vu par le commercial.

   Croise les signaux publics du jour avec les achats de CETTE officine :
     - ruptures / tensions / arrêts / remises à disposition (ansm-dispo.json)
     - baisses et hausses de prix à venir (prix-futurs.json, avis CEPS au JO)
     - rappels de lots (rappels-lots.json)
     - produit habituel non commandé le dernier mois connu (ventes)
     - princeps encore acheté alors qu'un générique existe (generiques-bdpm.json)
     - annonces légales des pharmacies de sa ville, puis de son département (bodacc-secteur.json)
   24/11/2026 (Will) — « Infos du jour » : ce qui la touche (ses achats) puis ce qui se passe
   autour d'elle (ventes, fermetures, procédures de pharmacies). Les échéances réglementaires
   (les mêmes sur toutes les fiches) sont retirées ; elles restent dans l'écran Infos du matin.
   Le bouton de la fiche ouvre le panneau en UN clic (avant : bouton → fenêtre → ligne → panneau).
   7 points maximum, ce qui est propre à CETTE officine d'abord (08/10/2026) :
   rappels de lots, achats interrompus, puis 3 ruptures au plus (les autres repliées),
   puis les prix qui changent (24/11/2026, Will : les ruptures avant les prix ; une baisse
   de moins de 5 % part directement dans la liste repliée), puis les opportunités. Aucun modèle de langue :
   chaque ligne sort d'une règle écrite ici, avec sa source et sa date.

   V2.briefOfficine.calculer(entree) est une fonction PURE (testée dans
   tests/brief-officine.test.mjs, y compris sur les vrais fichiers du jour).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};

  var MAX_POINTS = 7;
  var FRAIS_MAX_J = 2;            // les trois robots tournent chaque jour
  var RAPPEL_RECENT_J = 90;       // un rappel plus ancien n'est plus « du jour »
  var REMISE_RECENTE_J = 14;      // « de nouveau disponible » : seulement si c'est récent
  var PRINCEPS_MIN_BOITES = 10;   // en dessous, l'opportunité ne vaut pas une ligne
  var PRINCEPS_MAX_LIGNES = 2;
  var HABITUDE_MAX_LIGNES = 3;
  var RECENT_MOIS = 3;    // au-delà, la liste noie les vraies alertes
  // 08/10/2026 — mesuré sur les 2 011 officines : 73 % des points affichés étaient des ruptures ou
  // tensions NATIONALES, les mêmes d'une fiche à l'autre, et « Ses achats » finissait replié derrière.
  // Donc : ce qui lui est propre d'abord, et 3 ruptures au plus (les siennes par volume), le reste replié.
  // 24/11/2026 (Will) — les ruptures avant les prix : à l'officine 2003659, 3 baisses (dont −0,6 %) prenaient les places
  // du haut et ses 29 ruptures étaient toutes repliées.
  var ORDRE = ['À retirer', 'Ses achats', 'Va manquer', 'Change bientôt', 'Revient', 'Opportunité'];
  var BAISSE_PETITE = 0.05;       // une baisse de moins de 5 % (ancien_ttc → ppttc) : repliée, sans « écouler son stock »
  var RUPTURES_MAX = 3;
  // 25/11/2026 (Will) — une rupture ou une tension que l'ANSM n'a pas mise à jour depuis plus d'un an n'est pas une info du jour
  // (Skiacol, fiche du 07/11/2023, parmi les 7 en tête de l'officine 2003659 ; 33 sur 186 dans le fichier du 24/11/2026) :
  // repliée (toujours imprimée), son ancienneté dans le titre.
  var ANSM_ANCIENNE_J = 365;
  var SECTEUR_FAMILLES = { cession: 'Vente', fermeture: 'Fermeture', procedure: 'Procédure' };   // choix de Will (24/11/2026) : ventes, fermetures, procédures
  var SECTEUR_MAX_LIGNES = 5;     // par niveau (sa ville, puis son département) ; le reste est compté

  var STATUTS = {
    'Rupture de stock': { urgence: 3, titre: 'En rupture', etat: 'en rupture' },
    "Tension d'approvisionnement": { urgence: 2, titre: 'En tension', etat: 'en tension' },
    'Arrêt de commercialisation': { urgence: 2, titre: 'Arrêt de commercialisation', etat: 'commercialisation arrêtée' },
    'Remise à disposition': { urgence: 1, titre: 'De nouveau disponible' }
  };
  var MOIS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  function jours(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }
  function moisFr(ym) { var p = String(ym || '').split('-'); return p.length < 2 ? String(ym || '') : MOIS_FR[+p[1] - 1] + ' ' + p[0]; }
  function dateFr(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length < 3 ? String(iso || '') : p[2] + '/' + p[1] + '/' + p[0]; }
  function isoDeFr(fr) { var p = String(fr || '').split('/'); return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : ''; }
  function pluriel(n, mot) { n = Math.round(n); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') + ' ' + mot + (n > 1 ? 's' : ''); }
  function nomCourt(spec) { return String(spec || '').split(' – [')[0].split(', ')[0]; }

  // 24/11/2026 (Will) — un nom de produit s'écrit d'UNE façon dans tout le panneau, sur le modèle des fiches de l'ANSM
  // (« Clopidogrel Zentiva 75 mg ») : nom, laboratoire, dosage ; la forme et la boîte (« CPR BT28 ») sont retirées.
  // Avant : « Clopidogrel Zentiva 75 mg » (ANSM), « Prednisolone ztl 20mg c.disp20 » (catalogue), « RIVAROXABAN ZEN 20MG CPR BT28 » (JO).
  // Une abréviation de laboratoire n'est développée que si elle est sûre : chacune ci-dessous a été recoupée CIP par CIP
  // avec les fiches ANSM et le laboratoire des avis du JO (24/11/2026, aucun contre-exemple). Les autres (ZTL…) restent telles quelles.
  var LABOS = { ZEN: 'Zentiva', ZENTIVA: 'Zentiva', BGA: 'Biogaran', BIOGARAN: 'Biogaran', TVC: 'Teva', TEVA: 'Teva', VIA: 'Viatris', VIATRIS: 'Viatris',
    ZYD: 'Zydus', ZYDUS: 'Zydus', SDZ: 'Sandoz', SANDOZ: 'Sandoz', EG: 'EG', ARROW: 'Arrow', MYLAN: 'Mylan', CRISTERS: 'Cristers', BIOGALENIQUE: 'Biogalénique' };
  // « µ » mis en majuscule devient la lettre grecque « Μ » (U+039C) : sans cette clé, « 1000 undefined/2 ml » (production, 25/11/2026).
  var UNITES = { MG: 'mg', G: 'g', MCG: 'µg', 'µG': 'µg', '\u039CG': 'µg', MUI: 'MUI', UI: 'UI', U: 'U', ML: 'ml', H: 'h', '%': '%' };
  var MOTS_MINUSCULES = { A: 1, 'À': 1, AU: 1, AUX: 1, DE: 1, DU: 1, DES: 1, ET: 1, EN: 1, LA: 1, LE: 1, LES: 1, OU: 1, PAR: 1, POUR: 1, SUR: 1 };
  // Forme ou boîte dans un libellé court (catalogue, JO) : on coupe là.
  // 25/11/2026 — « OPHT UNIDOS10ML 24 » (Dacudoses, officine 2281324) restait écrit tel quel : voie et unidoses coupées aussi.
  var FORME = /^(CPR|CP|CPS|COMP|GELU|GEL|GLE|CAPS|INJ|SOL|BUV|SACH|SUPPO?|PDR|CREME|POM|SIROP|COLLY|AMP|FL|FLAC|TUBE|SRG|STY|SUSP|LYOPH|OPHT|GTT|UNIDOS\S*|UNID\d*|TB\d+\S*|B\d+DU|BT\d*|BTE\d*|C\.\S*|CPR\d+\w*|CP\d+|GELU\d+|CPS\d+|FL\d+\S*)$/;
  // « 20MG », « 10MG/10MG », « 100U/ML », « 100/6MCG », « 50MCG/H », « mg/mL » → « 20 mg », « 10 mg/10 mg », « 100 U/ml »… ;
  // '' si ce n'est pas un dosage. Écrit de la même façon quelle que soit la source.
  function dosage(t) {
    var parts = String(t).split('/'), unite = false, ok = true;
    var out = parts.map(function (x, i) {
      var m = (i ? /^(\d+(?:[.,]\d+)?)?(MG|G|MCG|µG|MUI|UI|U|ML|H|%)?$/i : /^(\d+(?:[.,]\d+)?)?(MG|G|MCG|µG|MUI|UI|U|ML|%)?$/i).exec(x);
      if (!m || (!m[1] && !m[2])) { ok = false; return ''; }
      if (m[2]) unite = true;
      return (m[1] || '') + (m[2] ? (m[1] ? ' ' : '') + UNITES[m[2].toUpperCase()] : '');
    });
    return ok && unite ? out.join('/') : '';
  }
  // 25/11/2026 (Will) — accents repris d'une source officielle, jamais devinés : le catalogue et le JO écrivent en capitales sans
  // accent (« Ketoprofene Zentiva LP » contre « Kétoprofène Pharmy II » à l'ANSM). Un mot prend les accents que l'ANSM lui donne
  // dans un NOM de produit ou de molécule (pas dans la forme : « granulés » aurait accentué les granules d'homéopathie), s'il a
  // 5 lettres au moins, une seule écriture à l'ANSM, et un accent ailleurs qu'un « é » final (« charbon activé » aurait donné
  // « Masque Pro Activé »). ACCENTS_RELEVES = le relevé du 25/11/2026 (44 mots, 404 libellés du catalogue et du JO) : un mot
  // garde son accent le jour où sa fiche ANSM disparaît (paracétamol ne le perd pas quand sa rupture finit).
  var ACCENTS_RELEVES = ('rispéridone paracétamol aténolol quétiapine montélukast acébutolol diclofénac furosémide ondansétron duloxétine ' +
    'fluoxétine vérapamil kétoprofène bétaméthasone ioméron aprépitant ténofovir palipéridone diazépam célestène magnésium néosynéphrine ' +
    'métoprolol tranxène gardénal lévonorgestrel téralithe dépakote caféine méthotrexate guêpe oxybuprocaïne nifédipine héparine adrénaline ' +
    'synacthène mytélase dexaméthasone tibéral névirapine méthylphénidate tétracaïne propafénone acétate').split(' ');
  function sansAccent(w) { return String(w).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function nomDeFiche(t) { return String(t || '').split(' – ')[0].split(', ')[0]; }   // « Izalgi 500 mg/25 mg, gélule – [...] » → le nom
  // textes = noms de produits et de molécules de l'ANSM → { mot sans accent : mot accentué }
  function dicoAccents(textes) {
    var formes = {}, dico = {};
    textes.forEach(function (t) {
      (String(t || '').match(/[a-zà-öø-ÿ]+/gi) || []).forEach(function (w) {
        if (w.length < 5) return;
        var k = sansAccent(w), f = formes[k] || (formes[k] = {});
        f[w.toLowerCase()] = 1;
      });
    });
    Object.keys(formes).forEach(function (k) {
      var f = Object.keys(formes[k]);
      if (f.length !== 1 || f[0] === k) return;                                    // deux écritures à l'ANSM, ou aucun accent
      if (f[0].slice(0, -1) === k.slice(0, -1) && f[0].slice(-1) === 'é') return;  // seul accent : un « é » final (activé)
      dico[k] = f[0];
    });
    ACCENTS_RELEVES.forEach(function (w) { dico[sansAccent(w)] = w; });
    return dico;
  }
  var ACCENTS_DEFAUT = dicoAccents([]);
  function accentuer(n, dico) {
    return n.replace(/[A-Za-z]{5,}/g, function (w, i, s) {
      if (/[a-zà-öø-ÿ]/i.test(s.charAt(i - 1) + s.charAt(i + w.length))) return w;   // morceau d'un mot déjà accentué
      var a = dico[w.toLowerCase()];
      if (!a) return w;
      if (w === w.toLowerCase()) return a;
      return w === w.charAt(0) + w.slice(1).toLowerCase() ? a.charAt(0).toUpperCase() + a.slice(1) : w;   // tout en capitales : un sigle, gardé
    });
  }
  function nomProduit(texte, accents) {
    // Libellé court du JO où le laboratoire est collé au dosage : « EZETIMIB/ATOR.ZEN10/20MG » → « EZETIMIB/ATOR. ZEN 10/20MG ».
    var brut = nomCourt(texte)
      // 25/11/2026 — l'ANSM écrit « 0,5 pour cent », « 100 unités/ ml », « L.P. » ; le JO et le catalogue « 0,5% », « 100U/ML », « LP » : une seule façon.
      .replace(/(\d)\s*pour\s+cent\b/gi, '$1 %').replace(/(\d)\s*unités\s*\/\s*ml\b/gi, '$1 U/ml').replace(/(^|\s)L\.P\.(?=\s|$)/g, '$1LP')
      .replace(/\.([A-Z]{2,3})(\d)/g, '. $1 $2').replace(/\.([A-Z]{2,3})(?=\s|$)/g, '. $1')
      // sigle ou laboratoire collé au dosage dans le catalogue : « LP75MG », « ZEN0,5MG », « DEL.1000MCG » → séparés
      // (pas un volume seul après un point : « SRG.BACK.1ML », « A.2ML » sont la boîte, coupée plus bas)
      .replace(/\b(LP|ZEN|BGA|TVC|VIA|ZYD|SDZ|EG)(\d)/g, '$1 $2').replace(/([A-Z])\.(\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)*(?:MG|MCG|G|UI|MUI|U|%))/g, '$1. $2');
    var mots = brut.replace(/\s+/g, ' ').trim().split(' '), garde = [], dernierDosage = -1;
    for (var i = 0; i < mots.length; i++) {
      // écrit en capitales : aucune minuscule, ou une seule perdue dans 4 capitales et plus (« v-HUBEI/BLEU », catalogue)
      var t = mots[i], up = (t.match(/[A-ZÀ-Ý]/g) || []).length, lo = (t.match(/[a-zà-ÿ]/g) || []).length, maj = up > 0 && (lo === 0 || (up >= 4 && lo <= 1));
      if (maj && i > 0 && FORME.test(t)) break;                     // « CPR BT28 », « GELU », « C.DISP20 »
      var d = dosage(t);
      if (d) { garde.push(d); dernierDosage = garde.length; continue; }
      if (!maj) { garde.push(t); continue; }                        // écrit en minuscules à la source : gardé tel quel
      var colle = /^(\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)*(?:MG|MCG|G|ML|UI|U|%)(?:\/(?:ML|H))?)(\S+)$/i.exec(t);
      if (colle && dosage(colle[1])) { garde.push(dosage(colle[1])); dernierDosage = garde.length; break; }   // « 100/6MCG120D1+C » : dosage, puis la boîte
      if (LABOS[t]) garde.push(LABOS[t]);
      else if (MOTS_MINUSCULES[t]) garde.push(t.toLowerCase());
      else if (/^(?:[A-Z]{1,3}|(?:[A-Z]\.){1,3}|[A-Z]\d{1,3})$/.test(t)) garde.push(t);   // « LP », « NPH », « ZTL », « L.P. », « B12 » : sigle gardé
      else garde.push(t.toLowerCase());
    }
    if (dernierDosage > 0) garde = garde.slice(0, dernierDosage);   // après le dosage : forme ou mode de libération
    var n = accentuer(garde.join(' '), accents || ACCENTS_DEFAUT);
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
  }

  // 25/11/2026 (Will) — la boîte lue dans le libellé brut (« CPR30 », « BT90 », « B28DU », « S.30 », « GELU 30 », « UNIDOS10ML 24 ») ;
  // '' si on ne la lit pas. Ne sert qu'à départager deux lignes au même nom (boîte de 30 et boîte de 90).
  function boite(texte) {
    var t = String(texte || '').replace(/\s+-\s+.*$/, '').trim(), m, der = '';
    var re = /(?:^|\s)(?:(?:CPR|CPS|CP|GELU|GLE|GEL|BTE|BT|FL|AMP|SACH)(\d+)(?:DU)?|B(\d+)DU|S\.(\d+))(?=\s|$)/g;
    while ((m = re.exec(t))) der = m[1] || m[2] || m[3];
    if (!der && (m = /\s(\d+)$/.exec(t))) der = m[1];
    return +der > 0 ? String(+der) : '';
  }
  // Prix toujours à deux chiffres après la virgule : le fichier du JO écrit 19.6 pour 19,60 € (25 changements sur 110, 25/11/2026).
  function prixFr(v) { var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n.toFixed(2).replace('.', ',') : String(v); }

  // Achats de l'officine regroupés par CIP13 : total, mois vus, dernier mois.
  function indexAchats(ventes) {
    var idx = {};
    for (var i = 0; i < ventes.length; i++) {
      var v = ventes[i], c = String(v.cip || '');
      if (c.length !== 13 || !v.qte) continue;
      var a = idx[c] || (idx[c] = { qte: 0, mois: {}, dernier: '' });
      a.qte += v.qte;                       // les retours (quantités négatives) se déduisent
      if (v.qte > 0) {
        a.mois[v.mois] = 1;
        if (v.mois > a.dernier) a.dernier = v.mois;
      }
    }
    Object.keys(idx).forEach(function (c) { if (idx[c].qte <= 0 || !idx[c].dernier) delete idx[c]; });
    return idx;
  }
  function achatsDe(idx, cips) {
    var r = { qte: 0, dernier: '' };
    for (var i = 0; i < (cips || []).length; i++) {
      var a = idx[cips[i]];
      if (!a) continue;
      r.qte += a.qte;
      if (a.dernier > r.dernier) r.dernier = a.dernier;
    }
    return r;
  }

  // Produits habituels absents du dernier mois connu (mc = mois couverts, triés).
  // Le dernier mois est celui où TOUS les fichiers de ses commerciaux existent
  // (sinon un fichier plus court inventerait une absence). Il faut aussi
  // qu'elle ait commandé autre chose ce mois-là : sinon on ne sait rien.
  // → { fin, avant:[6 mois précédents au plus], connu:bool, cips:[…par volume décroissant] }
  function interrompus(idx, mc) {
    var fin = mc[mc.length - 1] || '', avant = mc.slice(-7, -1), aCommandeFin = false;
    Object.keys(idx).forEach(function (c) { if (idx[c].mois[fin]) aCommandeFin = true; });
    var connu = !!fin && avant.length >= 4 && aCommandeFin;
    return { fin: fin, avant: avant, connu: connu, cips: !connu ? [] : Object.keys(idx).filter(function (c) {
      var a = idx[c];
      return !a.mois[fin] && avant.filter(function (m) { return a.mois[m]; }).length >= 4;
    }).sort(function (x, y) { return idx[y].qte - idx[x].qte; }) };
  }

  // Département d'un code postal : même convention que v2-infos.js (sctDepDeCP) et que le champ du Bodacc.
  function depDeCP(cp) {
    cp = String(cp || '').trim();
    if (!/^\d{5}$/.test(cp)) return '';
    if (cp.slice(0, 2) === '20') return parseInt(cp, 10) < 20200 ? '2A' : '2B';
    if (/^97[1234]|^976/.test(cp)) return cp.slice(0, 3);
    return cp.slice(0, 2);
  }
  function villeCle(v) {
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\bSTE\b/g, 'SAINTE').replace(/\bST\b/g, 'SAINT').trim();
  }
  function joli(s) {
    return String(s || '').toLowerCase().replace(/(^|[\s'’(-])([a-zà-ÿ])/g, function (m, a, c) { return a + c.toUpperCase(); })
      .replace(/\b(Selarl|Selas|Sarl|Snc|Spfpl|Spfplas|Sas|Eurl|Sa)\b/g, function (m) { return m.toUpperCase(); });
  }
  // FONCTION PURE. secteur = bodacc-secteur.json ({ maj, ev:[{ id, d, f, nom, ville, cp, dep, depNom, detail, url }] }) ;
  // officine = { ville, cp }. Seules les ventes, fermetures et procédures. Sa ville d'abord (même code postal ou même nom
  // de ville dans le même département), puis le reste de son département ; les plus récentes d'abord.
  // → { connu:bool, ville:'', dep:'', depNom:'', dansVille:[…], dansDep:[…], autresDep:n, depuis:'AAAA-MM-JJ' }
  function autourDElle(secteur, officine) {
    var o = officine || {}, dep = depDeCP(o.cp), vc = villeCle(o.ville);
    var r = { connu: !!(secteur && secteur.ev && dep), ville: joli(o.ville), dep: dep, depNom: '', dansVille: [], dansDep: [], autresDep: 0, depuis: '' };
    if (!r.connu) return r;
    var evs = secteur.ev.filter(function (x) { return x && SECTEUR_FAMILLES[x.f] && String(x.dep || depDeCP(x.cp)) === dep; })
      .sort(function (x, y) { return x.d < y.d ? 1 : x.d > y.d ? -1 : 0; });
    secteur.ev.forEach(function (x) { if (x && x.d && (!r.depuis || x.d < r.depuis)) r.depuis = x.d; });
    var ligne = function (x) {
      return { famille: SECTEUR_FAMILLES[x.f], titre: joli(x.nom), detail: String(x.detail || ''), ville: joli(x.ville), date: x.d || '',
        url: /^https:\/\//.test(String(x.url || '')) ? x.url : '' };
    };
    var dep2 = [];
    evs.forEach(function (x) {
      if (!r.depNom && x.depNom) r.depNom = x.depNom;
      var memeVille = (o.cp && x.cp && String(x.cp) === String(o.cp)) || (vc && villeCle(x.ville) === vc);
      (memeVille ? r.dansVille : dep2).push(ligne(x));
    });
    r.dansVille = r.dansVille.slice(0, SECTEUR_MAX_LIGNES);
    r.dansDep = dep2.slice(0, SECTEUR_MAX_LIGNES);
    r.autresDep = Math.max(0, dep2.length - SECTEUR_MAX_LIGNES);
    return r;
  }

  /* entree = {
       aujourdhui: 'AAAA-MM-JJ',
       ventes: [{cip, mois:'AAAA-MM', qte}],     // TOUS commerciaux de l'officine
       moisCouverts: ['AAAA-MM', …],               // mois où le fichier de l'officine existe
       ansm, prixFuturs, rappels, generiques,      // JSON des robots, ou null si non lus
       secteur,                                     // bodacc-secteur.json, ou null
       officine: { ville, cp },                     // pour « Autour d'elle »
       stockSites: function (cip) → [{site, q}],   // facultatif
       nom: function (cip) → libellé                // facultatif
     }
     → { points:[…≤7], autres:[…], autour:{…}, sources:[…], achatsConnus:bool } */
  function calculer(e) {
    var auj = e.aujourdhui;
    var idx = indexAchats(e.ventes || []);
    var nbMois = Math.max(1, (e.moisCouverts || []).length);
    var nomBrut = e.nom || function () { return ''; };
    var noms = [];
    ((e.ansm && e.ansm.items) || []).forEach(function (it) { noms.push(nomDeFiche(it.spec), it.dci || ''); });
    ((e.rappels && e.rappels.items) || []).forEach(function (r) { noms.push(nomDeFiche(r.t)); });
    var accents = dicoAccents(noms);
    var np = function (t) { return nomProduit(t, accents); };
    var nom = function (c) { return np(nomBrut(c)); };
    var stockSites = e.stockSites || function () { return []; };
    var pts = [];
    var mc = (e.moisCouverts || []).slice().sort();
    var fin = mc[mc.length - 1];
    // Ruptures et prix : seulement ce qu'elle a commandé dans ses 3 derniers mois connus
    // (un produit abandonné depuis février n'a rien à faire devant ses achats courants).
    var recent = mc[Math.max(0, mc.length - RECENT_MOIS)] || '';

    // 1. Disponibilité (ANSM)
    ((e.ansm && e.ansm.items) || []).forEach(function (it) {
      var s = STATUTS[it.st];
      if (!s || !it.cips || !it.cips.length) return;
      if (it.st === 'Remise à disposition' && !(it.since && jours(it.since, auj) <= REMISE_RECENTE_J)) return;
      var a = achatsDe(idx, it.cips);
      if (!a.qte || a.dernier < recent) return;
      var parMois = Math.max(1, Math.round(a.qte / nbMois));
      // 24/11/2026 — sans « (dernière commande : …) » : seuls ses achats des 3 derniers mois passent ce filtre.
      var detail = ['Elle en achète environ ' + pluriel(parMois, 'boîte') + ' par mois.'];
      var majIso = isoDeFr(it.maj);
      var ancienne = it.st !== 'Remise à disposition' && !!majIso && jours(majIso, auj) > ANSM_ANCIENNE_J;
      var depuis = ancienne ? moisFr(String(it.since || majIso).slice(0, 7)) : '';
      if (it.st !== 'Remise à disposition') {
        // 24/11/2026 — la date seule : la phrase qui suit (« Un délai de quelques jours à plusieurs semaines peut être néc ») est
        // la même partout et arrive coupée du fichier de l'ANSM.
        if (it.retour && it.retour.raw) detail.push('Retour annoncé : ' + String(it.retour.raw).split(/\.\s/)[0].replace(/\.$/, '') + '.');
        var sites = [];
        it.cips.forEach(function (c) { stockSites(c).forEach(function (x) { if (x.q > 0) sites.push(x); }); });
        if (sites.length) {
          var tot = sites.reduce(function (t, x) { return t + x.q; }, 0);
          var noms = sites.map(function (x) { return x.site; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; });
          // 25/11/2026 — au-delà de 3 sites, le total seul : « sur CPR, HP, MSP, OPS, POS, SEP, SOP » puis « sur 7 de nos sites »
          // faisaient encore passer le point à 5 lignes (Izalgi, officine 2003659).
          detail.push('Chez nous : ' + pluriel(tot, 'boîte') + (noms.length > 3 ? '' : ' sur ' + noms.join(', ')) + '.');
        }
      }
      pts.push({
        rubrique: it.st === 'Remise à disposition' ? 'Revient' : 'Va manquer',
        urgence: s.urgence, volume: a.qte,
        titre: s.titre + (depuis ? ' depuis ' + depuis : '') + ' : ' + np(it.spec),
        brut: it.spec,
        detail: detail.join(' '),
        replie: ancienne,
        cips: it.cips, etat: s.etat ? s.etat + (depuis ? ' depuis ' + depuis : '') : '',
        action: it.st === 'Remise à disposition' ? 'Lui signaler qu\'elle peut recommander.' : 'La prévenir avant qu\'elle le découvre au comptoir.',
        pourquoi: 'ANSM · ' + dateFr(isoDeFr(it.maj) || e.ansm.generated),   // « (rupture de stock…) et présent dans ses achats » redisait le titre
        source: 'ansm', date: isoDeFr(it.maj) || (e.ansm.generated || '')
      });
    });

    // 2. Prix qui changent (avis CEPS au JO), seulement si l'effet est à venir
    ((e.prixFuturs && e.prixFuturs.changes) || []).forEach(function (ch) {
      if (ch.sens !== 'baisse' && ch.sens !== 'hausse') return;
      if (!ch.date_effet || ch.date_effet < auj) return;
      var a = achatsDe(idx, [String(ch.c)]);
      if (!a.qte || a.dernier < recent) return;
      var dans = jours(auj, ch.date_effet);
      var ancien = parseFloat(String(ch.ancien_ttc || '').replace(',', '.')), nouveau = parseFloat(String(ch.ppttc || '').replace(',', '.'));
      var ecart = ancien > 0 && nouveau > 0 ? (nouveau - ancien) / ancien : null;   // ancien prix inconnu : traitement d'avant
      var petite = ch.sens === 'baisse' && ecart !== null && -ecart < BAISSE_PETITE;
      var prix = (ch.ancien_ttc ? prixFr(ch.ancien_ttc) + ' € → ' : '') + prixFr(ch.ppttc) + ' € TTC' +
        (ecart !== null ? ' (' + (ecart < 0 ? '−' : '+') + String(Math.abs(Math.round(ecart * 1000) / 10)).replace('.', ',') + ' %)' : '');
      pts.push({
        rubrique: 'Change bientôt',
        urgence: dans <= 7 ? 3 : 2, volume: a.qte,
        // 25/11/2026 (Will) — « Baisse le … » : « Baisse de prix le … : Ezetimib/ator. Zentiva 10/20 mg, boîte de 30 » faisait passer le point à 5 lignes
        titre: (ch.sens === 'baisse' ? 'Baisse' : 'Hausse') + ' le ' + dateFr(ch.date_effet) + ' : ' + (np(ch.d) || nom(ch.c)),
        brut: ch.d || nomBrut(ch.c),
        // 25/11/2026 (Will) — « · 27 boîtes achetées. » au lieu de « . Elle en a acheté 27 boîtes. » : la phrase tient sur une ligne
        // (les « Ezetimib/ator. Zentiva 10/20 mg, boîte de 30 » de l'officine 2003659 restaient à 5 lignes avec « Baisse le … »).
        detail: 'Prix public ' + prix + ' · ' + pluriel(a.qte, 'boîte') + (a.qte > 1 ? ' achetées.' : ' achetée.'),
        // 24/11/2026 (Will) — une baisse de moins de 5 % : repliée d'office, et pas de conseil d'écouler le stock pour quelques centimes.
        action: petite ? '' : ch.sens === 'baisse' ? 'Lui conseiller d\'écouler son stock avant le ' + dateFr(ch.date_effet) + '.' : 'Lui signaler la hausse avant sa prochaine commande.',
        replie: petite,
        pourquoi: 'Journal officiel du ' + dateFr(ch.date_publi),
        source: 'prix', date: ch.date_publi || ''
      });
    });

    // 3. Rappels de lots récents sur un produit qu'elle a acheté
    ((e.rappels && e.rappels.items) || []).forEach(function (r) {
      if (!r.d || jours(r.d, auj) > RAPPEL_RECENT_J || !r.cips || !r.cips.length) return;
      var a = achatsDe(idx, r.cips);
      if (!a.qte) return;
      // Les lots qui expirent le même mois sont regroupés : « 4P0202A, 4P0201A (exp. 12/2026) ».
      var parExp = [], lots = [];
      (r.lots || []).forEach(function (l) {
        var g = parExp.filter(function (x) { return x.exp === (l.exp || ''); })[0];
        if (!g) parExp.push(g = { exp: l.exp || '', n: [] });
        g.n.push(l.n);
      });
      parExp.forEach(function (g) { lots.push(g.n.join(', ') + (g.exp ? ' (exp. ' + g.exp + ')' : '')); });
      pts.push({
        rubrique: 'À retirer',
        urgence: 4, volume: a.qte,
        titre: 'Rappel de lots : ' + np(r.t),
        brut: r.t,
        detail: (lots.length ? 'Lots ' + lots.join(', ') + ' · ' : '') + pluriel(a.qte, 'boîte') + (a.qte > 1 ? ' achetées.' : ' achetée.'),
        action: 'Lui demander de vérifier ses lots en rayon.',
        pourquoi: 'ANSM · ' + dateFr(r.d),
        source: 'rappels', date: r.d
      });
    });

    // 4. Produit habituel absent du dernier mois connu (règle : interrompus()).
    var inter = interrompus(idx, mc), avant = inter.avant;
    inter.cips.filter(function (c) { return nom(c); }).slice(0, HABITUDE_MAX_LIGNES).forEach(function (c) {
      var a = idx[c], n = nom(c);
      var vus = avant.filter(function (m) { return a.mois[m]; }).length;
      pts.push({
        rubrique: 'Ses achats',
        urgence: 1, volume: a.qte,
        titre: 'Pas commandé en ' + moisFr(fin) + ' : ' + n,
        brut: nomBrut(c),
        detail: 'Commandé ' + vus + ' mois sur les ' + avant.length + ' précédents (' + pluriel(a.qte, 'boîte') + ' au total).',
        action: 'Lui demander si elle l\'achète ailleurs.',
        pourquoi: '',   // 24/11/2026 — « Habitude d'achat interrompue. » redisait la pastille et le titre ; ses achats ne sont pas une source publique
        source: 'ventes', date: '', cip: c
      });
    });
    // 25/11/2026 (Will) — produit qu'elle n'a pas commandé ET que l'ANSM signale (Izalgi 500 mg/25 mg, officine 2281324 : deux lignes) :
    // UNE ligne qui dit les deux, la rupture ou la tension expliquant sans doute l'arrêt. Le point ANSM s'efface, sa source passe
    // dans la ligne. Ses faits (retour annoncé, notre stock) n'y sont PAS : la ligne passait à 6 lignes (sonde du 25/11, 2281324).
    pts.filter(function (p) { return p.rubrique === 'Ses achats'; }).forEach(function (p) {
      var q = pts.filter(function (x) { return x.rubrique === 'Va manquer' && x.cips.indexOf(p.cip) >= 0; })[0];
      if (!q) return;
      p.titre += ', ' + q.etat;
      p.pourquoi = q.pourquoi; p.source = q.source; p.date = q.date;
      pts.splice(pts.indexOf(q), 1);
    });

    // 5. Princeps encore acheté alors qu'un générique existe
    var princeps = {};
    ((e.generiques && e.generiques.princepsWithGeneric) || []).forEach(function (c) { princeps[c] = 1; });
    Object.keys(idx).filter(function (c) { return princeps[c] && idx[c].qte >= PRINCEPS_MIN_BOITES && nom(c); })
      .sort(function (x, y) { return idx[y].qte - idx[x].qte; })
      .slice(0, PRINCEPS_MAX_LIGNES)
      .forEach(function (c) {
        pts.push({
          rubrique: 'Opportunité',
          urgence: 0, volume: idx[c].qte,
          titre: 'Princeps acheté alors qu\'un générique existe : ' + nom(c),
          brut: nomBrut(c),
          detail: pluriel(idx[c].qte, 'boîte') + ' sur la période.',
          action: 'Lui proposer le générique.',
          pourquoi: 'Répertoire des génériques' + (e.generiques.generated ? ' · ' + dateFr(e.generiques.generated) : ''),
          source: 'generiques', date: (e.generiques.generated || '')
        });
      });

    // 6. Autour d'elle : annonces légales (Bodacc) des pharmacies de sa ville, puis du reste de son département
    var autour = autourDElle(e.secteur, e.officine);

    // 25/11/2026 (Will) — boîte de 30 et boîte de 90 donnaient deux lignes au même titre avec deux prix (Liptruzet 10 mg/10 mg,
    // Ezetimib/ator. Zentiva 10/10 mg à l'officine 2003659). La boîte n'est écrite QUE dans ce cas, et seulement si elle départage.
    var memeTitre = {};
    pts.forEach(function (p) { (memeTitre[p.titre] = memeTitre[p.titre] || []).push(p); });
    Object.keys(memeTitre).forEach(function (t) {
      var g = memeTitre[t], b = g.map(function (p) { return boite(p.brut); });
      if (g.length < 2 || b.filter(function (x, i) { return x && b.indexOf(x) === i; }).length < 2) return;
      g.forEach(function (p, i) { if (b[i]) p.titre += ', boîte de ' + b[i]; });
    });
    pts.forEach(function (p) { delete p.brut; delete p.cips; delete p.cip; delete p.etat; });

    // Ordre des rubriques (ORDRE) ; dans une rubrique, l'urgence puis SON volume — les ruptures, elles,
    // par son volume seul : une tension sur 50 boîtes par mois la gêne plus qu'une rupture sur 2.
    var rang = {}; ORDRE.forEach(function (r, i) { rang[r] = i; });
    pts.sort(function (x, y) {
      // les ruptures anciennes (ANSM_ANCIENNE_J) après les récentes : elles ne prennent aucune des 3 places
      return (rang[x.rubrique] - rang[y.rubrique]) || (x.rubrique === 'Va manquer' ? (x.replie ? 1 : 0) - (y.replie ? 1 : 0) : y.urgence - x.urgence) || (y.volume - x.volume);
    });
    var tete = [], ruptRepliees = [], nbRupt = 0;
    pts.forEach(function (p) { if (p.rubrique === 'Va manquer' && (p.replie || ++nbRupt > RUPTURES_MAX)) ruptRepliees.push(p); else if (!p.replie) tete.push(p); });
    var enTete = tete.slice(0, MAX_POINTS);
    // le reste replié garde l'ordre des rubriques : ce qui dépasse les 7 places et les petites baisses
    var reste = pts.filter(function (p) { return ruptRepliees.indexOf(p) < 0 && enTete.indexOf(p) < 0; });

    var sources = [
      { cle: 'ansm', nom: 'Ruptures ANSM', json: e.ansm, max: FRAIS_MAX_J },
      { cle: 'prix', nom: 'Prix au JO', json: e.prixFuturs, max: FRAIS_MAX_J },
      { cle: 'rappels', nom: 'Rappels de lots', json: e.rappels, max: FRAIS_MAX_J },
      // 25/11/2026 (Will) — 35 jours : la BDPM publie environ une fois par mois et le robot passe le 2 (generiques-bdpm.yml) ;
      // avec 9 jours, le panneau écrivait « en retard » du 12 à la fin de chaque mois alors que tout tournait.
      { cle: 'generiques', nom: 'Répertoire des génériques', json: e.generiques, max: 35 },
      { cle: 'secteur', nom: 'Annonces légales', json: e.secteur, max: FRAIS_MAX_J }
    ].map(function (s) {
      if (!s.json) return { cle: s.cle, nom: s.nom, lue: false, date: '', aJour: false };
      var d = String(s.json.generated || s.json.maj || '').slice(0, 10);
      return { cle: s.cle, nom: s.nom, lue: true, date: d, aJour: !!d && jours(d, auj) <= s.max };
    });

    return {
      points: enTete,
      autres: ruptRepliees.concat(reste),
      autour: autour,
      sources: sources,
      achatsConnus: Object.keys(idx).length > 0,
      periode: mc.length ? moisFr(mc[0]) + ' – ' + moisFr(fin) : ''
    };
  }

  // ─────────────────────── Couche écran ───────────────────────
  var RUB_COULEUR = { 'À retirer': '#C2410C', 'Va manquer': '#B91C1C', 'Change bientôt': '#1D4ED8', 'Revient': '#047857', 'Ses achats': '#6D28D9', 'Opportunité': '#0F766E' };
  var _json = {};          // fichier → promesse (une lecture par jour et par session)
  var _dernierMois = null; // commercial → dernier mois présent dans son fichier
  var _dernierMoisRef = null;

  function lire(f) {
    if (!_json[f]) {
      var jour = new Date().toISOString().slice(0, 10);
      _json[f] = fetch(f + '?d=' + jour, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return _json[f];
  }

  function cleMois(s) { return (s.year || '') + '-' + ('0' + s.month).slice(-2); }

  function dernierMoisParCommercial() {
    if (_dernierMois && _dernierMoisRef === V2.sales) return _dernierMois;
    _dernierMois = {};
    var S = V2.sales || [];
    for (var i = 0; i < S.length; i++) {
      var c = S[i].commercial || '';
      var m = cleMois(S[i]);
      if (!_dernierMois[c] || m > _dernierMois[c]) _dernierMois[c] = m;
    }
    _dernierMoisRef = V2.sales;
    return _dernierMois;
  }

  function moisCouverts(ventes) {
    var der = dernierMoisParCommercial(), fin = '', vus = {};
    ventes.forEach(function (s) {
      vus[cleMois(s)] = 1;
      var d = der[s.commercial || ''] || '';
      if (d && (!fin || d < fin)) fin = d;
    });
    return Object.keys(vus).filter(function (m) { return !fin || m <= fin; }).sort();
  }

  // 25/11/2026 (Will) — un relevé de stock de plus de 30 jours ne compte plus : « Chez nous : 57 971 boîtes » (Izalgi) additionnait six
  // sites relevés du 15 au 21/09 (OPS, seul relevé du 05/11, était passé de 7 184 à 823). Un chiffre faux trompe plus qu'une absence.
  // Un site sans date de relevé ne compte pas non plus : son chiffre ne se vérifie pas.
  var STOCK_FRAIS_J = 30;
  function releveFrais(d) { return !!d && jours(d, new Date().toISOString().slice(0, 10)) <= STOCK_FRAIS_J; }
  function stockSites(cip) {
    var EP = window.ETAB_PRICES && window.ETAB_PRICES.prices;
    if (EP) {
      var dates = window.ETAB_PRICES.siteDates || {}, out = [];
      Object.keys(EP).forEach(function (site) { var v = EP[site][cip]; if (v && v[1] > 0 && releveFrais(dates[site])) out.push({ site: site, q: v[1] }); });
      return out;
    }
    // stock-data.js : un total tous sites, sans le détail par site → montré seulement si TOUS les relevés sont frais
    var S = window.STOCK_IP, q = S && S.data && S.data[cip], sd = (S && S.meta && S.meta.siteDates) || {};
    var frais = Object.keys(sd).length > 0 && Object.keys(sd).every(function (x) { return releveFrais(sd[x]); });
    return q > 0 && frais ? [{ site: 'nos sites', q: q }] : [];
  }

  // Mémorisé seulement si le catalogue est là : mémoriser un catalogue pas encore arrivé (chargé en
  // différé) viderait « Ses achats » et « Opportunité » pour toute la session (08/10/2026).
  var _noms = null, _nomsDe = null;
  function nom(cip) {
    var B = window.BENCHMARK;
    if (!B || !B.length) return '';
    if (!_noms || _nomsDe !== B) {
      _noms = {}; _nomsDe = B;
      B.forEach(function (b) { if (b.cip13 && b.designation) _noms[String(b.cip13)] = b.designation; });
    }
    return _noms[cip] || '';   // le libellé tel quel : calculer() l'écrit avec nomProduit, comme les autres sources (24/11/2026)
  }

  function esc(s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); }

  // 24/11/2026 (Will) — alléger : à gauche la pastille et, dessous (place libre), la source officielle et sa date ;
  // à droite le titre, les faits, l'action. La ligne qui redisait la pastille ou le titre est retirée.
  function ligneHtml(p) {
    var c = RUB_COULEUR[p.rubrique] || '#475569';
    var src = p.pourquoi ? p.pourquoi + (p.date && p.pourquoi.indexOf(dateFr(p.date)) < 0 ? ' · relevé du ' + dateFr(p.date) : '') : '';
    return '<li class="bo-pt">' +
      '<div class="bo-g"><span class="bo-rub" style="--c:' + c + '">' + esc(p.rubrique) + '</span>' + (src ? '<small class="bo-qui">' + esc(src) + '</small>' : '') + '</div>' +
      '<div class="bo-tx"><b>' + esc(p.titre) + '</b>' +
        '<span>' + esc(p.detail) + '</span>' +
        (p.action ? '<span class="bo-act">→ ' + esc(p.action) + '</span>' : '') +
      '</div></li>';
  }

  // Résumé en une ligne : « 1 rappel de lots · 3 achats interrompus · 6 ruptures ou tensions ».
  // Les échéances réglementaires n'y sont plus (08/10/2026) : les mêmes sur toutes les fiches pendant des mois.
  // Le point rouge reste tant qu'il y a quelque chose « À retirer » (rappel de lots).
  // 24/11/2026 — chaque sorte porte SON nom : « 21 autres points » en haut contre « 18 autres points » replié en bas
  // (les 3 « Change bientôt » affichés en tête comptaient dans les 21). « autres » ne sert plus qu'aux listes repliées.
  var RESUME_NOMS = [
    ['À retirer', function (n) { return '<em>' + pluriel(n, 'rappel') + ' de lots</em>'; }],
    ['Ses achats', function (n) { return n + (n > 1 ? ' achats interrompus' : ' achat interrompu'); }],
    ['Change bientôt', function (n) { return n + (n > 1 ? ' prix qui changent' : ' prix qui change'); }],
    ['Va manquer', function (n) { return n + (n > 1 ? ' ruptures ou tensions' : ' rupture ou tension'); }],
    ['Revient', function (n) { return n + (n > 1 ? ' produits de nouveau disponibles' : ' produit de nouveau disponible'); }],
    ['Opportunité', function (n) { return n + (n > 1 ? ' génériques à proposer' : ' générique à proposer'); }]
  ];
  function resume(r) {
    var tous = r.points.concat(r.autres);
    var compte = function (rub) { return tous.filter(function (p) { return p.rubrique === rub; }).length; };
    var rappels = compte('À retirer'), nommes = 0, morceaux = [];
    RESUME_NOMS.forEach(function (x) { var n = compte(x[0]); nommes += n; if (n) morceaux.push(x[1](n)); });
    if (tous.length > nommes) morceaux.push(pluriel(tous.length - nommes, 'point') + ' d\'une autre sorte');   // rubrique future non nommée ici
    return { rappels: rappels, nb: r.points.length, replies: r.autres.length, rouge: rappels > 0,
      html: morceaux.length ? '<span class="bo-sum">' + morceaux.join('<span>·</span>') + '</span>' : '' };
  }

  // « Autour d'elle » : sa ville, puis son département (ventes, fermetures, procédures de pharmacies, annonces légales).
  function autourHtml(a) {
    if (!a || !a.connu) return '<h4 class="bo-part">Autour d\'elle</h4><p class="bo-vide">Annonces légales de son secteur indisponibles (code postal inconnu ou fichier non lu).</p>';
    var li = function (x) {
      return '<li class="bo-pt"><span class="bo-rub" style="--c:#475569">' + esc(x.famille) + '</span><div class="bo-tx"><b>' + esc(x.titre) + '</b>' +
        '<span>' + esc(x.detail) + (x.ville ? ' · ' + esc(x.ville) : '') + '</span>' +
        '<small>Annonce légale du ' + esc(dateFr(x.date)) + (x.url ? ' · <a href="' + esc(x.url) + '" target="_blank" rel="noopener">voir l\'annonce</a>' : '') + '</small></div></li>';
    };
    var bloc = function (titre, liste, vide) {
      return '<div class="bo-aut"><h5>' + esc(titre) + '</h5>' + (liste.length ? '<ol class="bo-liste">' + liste.map(li).join('') + '</ol>' : '<p class="bo-vide">' + esc(vide) + '</p>') + '</div>';
    };
    var depLib = a.depNom ? a.depNom + ' (' + a.dep + ')' : 'département ' + a.dep;
    var depuis = a.depuis ? ' depuis le ' + dateFr(a.depuis) : '';
    return '<h4 class="bo-part">Autour d\'elle</h4>' +
      bloc('Dans sa ville' + (a.ville ? ' · ' + a.ville : ''), a.dansVille, 'Aucune vente, fermeture ni procédure de pharmacie dans sa ville' + depuis + '.') +
      bloc('Dans son département · ' + depLib, a.dansDep, 'Aucune autre vente, fermeture ni procédure de pharmacie dans son département' + depuis + '.') +
      (a.autresDep ? '<p class="bo-src">… et ' + pluriel(a.autresDep, 'autre annonce') + ' dans le département.</p>' : '');
  }

  function corpsHtml(r) {
    var nonLues = r.sources.filter(function (s) { return !s.lue; });
    var corps;
    if (!r.achatsConnus) {
      corps = '<p class="bo-vide">Aucun achat connu pour cette officine sur la période : le brief n\'a rien à croiser.</p>';
    } else if (!r.points.length && !r.autres.length) {
      corps = '<p class="bo-vide">' + (nonLues.length
        ? 'Rien d\'urgent dans les sources lues. ' + pluriel(nonLues.length, 'source') + ' n\'' + (nonLues.length > 1 ? 'ont' : 'a') + ' pas pu être lue' + (nonLues.length > 1 ? 's' : '') + ' : à revoir plus tard.'
        : 'Rien d\'urgent aujourd\'hui pour cette officine.') + '</p>';
    } else {
      var rupt = r.autres.filter(function (p) { return p.rubrique === 'Va manquer'; });
      var reste = r.autres.filter(function (p) { return p.rubrique !== 'Va manquer'; });
      // 24/11/2026 — « autres » seulement si une rupture est déjà affichée au-dessus (« 29 autres ruptures » sans aucune en tête)
      var ruptEnTete = r.points.some(function (p) { return p.rubrique === 'Va manquer'; });
      var replie = function (liste, un, plusieurs) {
        return liste.length ? '<details class="bo-plus"><summary>' + liste.length + (liste.length > 1 ? plusieurs : un) + '</summary><ol class="bo-liste">' + liste.map(ligneHtml).join('') + '</ol></details>' : '';
      };
      var resteEnTete = r.points.some(function (p) { return p.rubrique !== 'Va manquer'; });
      corps = (r.points.length ? '<ol class="bo-liste">' + r.points.map(ligneHtml).join('') + '</ol>' : '<p class="bo-vide">Rien d\'urgent aujourd\'hui pour cette officine.</p>') +
        replie(rupt, ruptEnTete ? ' autre rupture ou tension' : ' rupture ou tension', ruptEnTete ? ' autres ruptures ou tensions' : ' ruptures ou tensions') +
        replie(reste, resteEnTete ? ' autre point' : ' point', resteEnTete ? ' autres points' : ' points');
    }
    corps = '<h4 class="bo-part">Ce qui la touche</h4>' + corps + autourHtml(r.autour);
    var src = r.sources.map(function (s) {
      var etat = !s.lue ? 'non lue' : (s.aJour ? dateFr(s.date) : dateFr(s.date) + ', en retard');
      return '<span class="' + (s.lue && s.aJour ? '' : 'bo-ko') + '">' + esc(s.nom) + ' (' + esc(etat) + ')</span>';
    }).join(' · ');
    return corps + '<div class="bo-src">Sources : ' + src + (r.periode ? ' · Ses achats (' + esc(r.periode) + ')' : '') + '</div>';
  }

  // La ligne posée dans la fiche, APRÈS les chiffres : résumé + point rouge + « Voir ».
  function rendre(r) {
    var s = resume(r);
    var sousTitre = s.nb ? ' · ' + pluriel(s.nb, 'point') : '';
    return '<button type="button" class="bo-ligne" onclick="V2.briefOfficine.ouvrir()">' +
      '<span class="bo-dot' + (s.rouge ? '' : ' vu') + '"></span><b>Aujourd\'hui</b>' +
      (s.html || '<span class="bo-sum">' + (r.achatsConnus ? 'rien d\'urgent pour cette officine' : 'aucun achat connu sur la période') + '</span>') +
      '<span class="bo-voir">Ouvrir le brief' + sousTitre + CHEVRON + '</span></button>';
  }

  var CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  // Le panneau latéral (maquette C, choix de Will le 22/09/2026) : il glisse depuis la droite et laisse
  // les chiffres visibles à côté ; sur iPhone il monte depuis le bas. Accroché à <body> : .v2-wrap porte un transform
  // (animation d'entrée) qui rendrait un position:fixed relatif à la page.
  // papier = true : sur la feuille, les listes repliées sont imprimées dépliées — « repliés » y serait faux (25/11/2026).
  function sousTitre(s, papier) {
    var rep = function (n) { return n + (papier ? '' : n > 1 ? ' repliés' : ' replié') + ' plus bas'; };
    if (s.nb && s.replies) return pluriel(s.nb, 'point') + ' en tête, ' + rep(s.replies);
    if (s.nb) return pluriel(s.nb, 'point');
    return s.replies ? (s.replies > 1 ? s.replies + ' points' : '1 point') + (papier ? '' : s.replies > 1 ? ' repliés' : ' replié') + ' plus bas' : '';
  }
  // lieu = { nom, cip } de l'officine : en tête de la feuille imprimée seulement (la date s'y écrit au moment d'imprimer)
  function fenetreHtml(r, lieu) {
    var s = resume(r);
    var qui = [lieu && lieu.nom, lieu && lieu.cip ? 'CIP ' + lieu.cip : ''].filter(Boolean).map(esc);
    return '<div class="bo-win" role="dialog" aria-modal="true" aria-labelledby="bo-win-t">' +
      '<div class="bo-win-h"><p class="bo-feuille">' + qui.concat(['<span class="bo-feuille-date"></span>']).join(' · ') + '</p>' +
        '<h3 id="bo-win-t">Infos du jour</h3>' + s.html +
        '<button type="button" class="bo-x" aria-label="Fermer" onclick="V2.briefOfficine.fermer()">×</button>' +
        // 24/11/2026 (Will) — raccourci : « ce qui la touche… autour d'elle » redisait les deux titres du panneau.
        // Reste le compte, vérifiable : en tête + repliés = la somme des nombres au-dessus.
        (sousTitre(s) ? '<span class="pha-sub">' + sousTitre(s) + '</span><span class="pha-sub bo-papier">' + sousTitre(s, true) + '</span>' : '') + '</div>' +
      '<div class="bo-win-b">' + corpsHtml(r) + '</div>' +
      '<div class="bo-win-f">' +   // 24/11/2026 (Will) : phrase « Se rouvre avec le bouton… » supprimée
        (r.points.length ? '<button type="button" class="v2-btn bo-imp" onclick="V2.briefOfficine.imprimer()">Imprimer pour l\'équipe</button>' : '') +
        '<button type="button" class="v2-btn dark" onclick="V2.briefOfficine.fermer()">Fermer</button></div>' +
    '</div>';
  }

  // Le bouton « Voir le brief du jour · 7 » à droite des onglets Analyse / Audit marge.
  // Bleu plein + verbe : les commerciaux ne voyaient pas qu'une pastille blanche « Aujourd'hui » se cliquait (Will, 22/09/2026).
  function boutonHtml(s) {
    if (!s) return ICONE + 'Infos du jour en préparation…';
    return ICONE + 'Voir les infos du jour' +
      (s.nb ? ' <span class="n">' + s.nb + '</span>' : '') +
      (s.rouge ? '<span class="bo-dot" aria-label="rappel de lot à traiter"></span>' : '') + CHEVRON;
  }
  var ICONE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12.5h5"/></svg>';

  var STYLE = '.bo-liste{list-style:none;margin:6px 0 0;padding:0;display:grid;gap:10px}' +
    '.bo-pt{display:flex;gap:12px;align-items:flex-start}' +
    /* 24/11/2026 (Will) — largeur FIXE commune, prise sur la plus longue (« Change bientôt », ~108 px mesurés sous WebKit) :
       avec min-width 96 px, ses titres commençaient ~12 px plus à droite que ceux des autres pastilles. */
    '.bo-g{flex:0 0 116px;width:116px;display:grid;gap:4px;justify-items:start}' +
    '.bo-rub{flex:0 0 116px;box-sizing:border-box;width:116px;white-space:nowrap;font-size:12px;font-weight:700;letter-spacing:.02em;color:var(--c);border:1px solid var(--c);border-radius:999px;padding:2px 8px;text-align:center}' +
    '.bo-qui{font-size:11px;line-height:1.35;color:var(--v2-muted,#64748b)}' +
    '.bo-tx{display:grid;gap:2px;font-size:13px;line-height:1.4;min-width:0}' +
    '.bo-tx b{font-weight:600}.bo-act{font-weight:500}.bo-tx small{color:var(--v2-muted,#64748b);font-size:12px}' +
    '.bo-vide{margin:8px 0 0;font-size:13.5px}' +
    '.bo-plus{margin-top:10px}.bo-plus summary{cursor:pointer;font-size:12.5px;font-weight:600}' +
    '.bo-part{margin:16px 0 6px;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--ip-ink-2,#334155)}' +
    '.bo-part:first-child{margin-top:4px}' +
    '.bo-aut{margin-top:8px}.bo-aut h5{margin:0;font-size:13.5px;font-weight:700}.bo-aut .bo-vide{margin-top:4px;color:var(--v2-muted,#64748b)}' +
    '.bo-aut a{color:inherit}' +
    '.bo-src{margin-top:12px;font-size:12px;color:var(--v2-muted,#64748b)}.bo-ko{color:#B45309;font-weight:600}' +
    '@media (max-width:520px){.bo-pt{flex-direction:column;gap:4px}.bo-rub{flex:none;width:auto}.bo-g{flex:none;width:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap}}' +
    '.bo-imp{font-size:12px;padding:4px 10px}' +
    /* résumé + point rouge */
    '.bo-sum{display:inline-flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--ip-ink-2,#334155)}' +
    '.bo-sum em{font-style:normal;color:#C7283D;font-weight:700}' +
    '.bo-dot{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:#E0556E;display:inline-block;box-shadow:0 0 0 3px rgba(224,85,110,.18)}' +
    '.bo-dot.vu{background:#B7BCC9;box-shadow:none}' +
    /* la ligne dans la fiche, après les chiffres */
    '#brief-off{padding:0}' +
    '.bo-ligne{display:flex;align-items:center;gap:10px;flex-wrap:wrap;width:100%;padding:12px 18px;border:0;background:transparent;font-family:inherit;text-align:left;cursor:pointer;color:inherit}' +
    '.bo-ligne:hover{background:var(--card-2,#f6f7fa)}' +
    '.bo-ligne b{font-size:14px;font-weight:800;letter-spacing:-.01em}' +
    '.bo-voir{margin-left:auto;display:inline-flex;align-items:center;gap:4px;padding:7px 12px;border-radius:999px;background:var(--ip-blue,#0050E6);color:#fff;font-weight:700;font-size:12.5px;white-space:nowrap}' +
    '.bo-ligne:hover .bo-voir{background:var(--ip-blue-d,#0034A0)}' +
    /* le bouton à droite des onglets */
    '.bo-open{position:relative;display:inline-flex;align-items:center;gap:8px;padding:9px 16px 9px 14px;border-radius:999px;border:0;background:var(--ip-blue,#0050E6);font-family:inherit;font-weight:700;font-size:13.5px;color:#fff;cursor:pointer;box-shadow:0 6px 16px -6px rgba(0,80,230,.55);min-height:var(--tap-min,44px);transition:background .15s,transform .15s}' +
    '.bo-open .n{background:#fff;color:var(--ip-blue,#0050E6);border-radius:999px;padding:1px 8px;font-size:13px;font-weight:800}' +
    '.bo-open .bo-dot{position:absolute;top:-3px;right:-3px;width:11px;height:11px;border:2px solid #fff;box-shadow:none;animation:bo-pouls 1.6s ease-in-out infinite}' +
    '@keyframes bo-pouls{0%,100%{transform:scale(1)}50%{transform:scale(1.35)}}' +
    '@media (prefers-reduced-motion:reduce){.bo-open .bo-dot{animation:none}}' +
    '.bo-open:hover{background:var(--ip-blue-d,#0034A0)}.bo-open:active{transform:translateY(1px)}' +
    '.bo-open:disabled{background:var(--card-2,#eef0f4);color:var(--ip-ink-2,#334155);box-shadow:none;cursor:default}' +
    '@media (max-width:640px){.bo-open{flex:1;justify-content:center}}' +
    '.ph-fiche-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0 16px}' +
    '.ph-fiche-line .ph-fiche-tabs{margin:0 !important}.ph-fiche-line .bo-spacer{flex:1}' +
    /* le panneau latéral */
    /* 9450 : au-dessus du rond « + » (.v2-fab, 9400) qui cachait « Fermer » sur iPhone, sous les barres d'alerte (9500+) */
    '.bo-ov{position:fixed;inset:0;background:rgba(16,19,28,.22);z-index:9450;display:none;align-items:stretch;justify-content:flex-end;padding:0}' +
    '.bo-ov.on{display:flex}' +
    '.bo-win{background:var(--card,#fff);box-shadow:-12px 0 40px -12px rgba(16,19,28,.35);width:min(520px,100%);height:100%;display:flex;flex-direction:column;overflow:hidden;color:var(--ip-ink,#10131C);animation:bo-glisse .22s ease}' +
    '@keyframes bo-glisse{from{transform:translateX(24px);opacity:.6}to{transform:none;opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){.bo-win{animation:none}}' +
    '.bo-win-h{position:relative;display:flex;align-items:center;gap:10px;padding:16px 56px 12px 20px;border-bottom:1px solid var(--line,#e2e8f0);flex-wrap:wrap}' +
    '.bo-win-h h3{margin:0;font-size:16px;font-weight:800;letter-spacing:-.01em}' +
    '.bo-win-h .pha-sub{flex:1 1 100%}' +
    '.bo-x{position:absolute;right:14px;top:12px;width:34px;height:34px;border-radius:50%;border:1px solid var(--line-strong,#cbd2dd);background:var(--card-2,#f6f7fa);display:inline-flex;align-items:center;justify-content:center;font-size:18px;line-height:1;cursor:pointer;color:inherit}' +
    '.bo-win-b{flex:1;overflow:auto;padding:12px 20px 16px;-webkit-overflow-scrolling:touch}' +
    '.bo-win-f{display:flex;gap:8px;padding:12px 20px;border-top:1px solid var(--line,#e2e8f0);background:var(--card-2,#f6f7fa);align-items:center;justify-content:flex-end;flex-wrap:wrap}' +
    '@media (max-width:640px){.bo-ov{align-items:flex-end}.bo-win{width:100%;height:88vh;border-radius:var(--r-card,16px) var(--r-card,16px) 0 0;box-shadow:0 -12px 40px -12px rgba(16,19,28,.35)}@keyframes bo-glisse{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}.bo-voir{margin-left:0;flex-basis:100%}}' +
    '.bo-win-h .bo-feuille,.bo-win-h .bo-papier{display:none}' +
    /* 25/11/2026 (Will) — la feuille : `visibility:hidden` sur la fiche lui gardait sa place (1 page utile puis 4 à 5 blanches).
       Tout ce qui n'est pas le panneau est retiré de la page ; nom, CIP et date en tête ; les listes repliées imprimées. */
    '@media print{body.bo-imprime{overflow:visible !important;background:#fff}body.bo-imprime>*:not(#bo-ov){display:none !important}' +
    'body.bo-imprime #bo-ov{position:static;display:block;padding:0;background:#fff}' +
    'body.bo-imprime .bo-win{display:block;height:auto;max-height:none;overflow:visible;box-shadow:none;border-radius:0;width:100%;animation:none}' +
    'body.bo-imprime .bo-win-h{padding:0 0 10px}body.bo-imprime .bo-win-b{overflow:visible;padding:8px 0 0}' +
    'body.bo-imprime .bo-win-h .bo-feuille{display:block;flex:1 1 100%;margin:0 0 4px;font-size:13px;font-weight:700}' +
    'body.bo-imprime .bo-win-h>.pha-sub{display:none}body.bo-imprime .bo-win-h>.bo-papier{display:block}' +
    'body.bo-imprime .bo-imp,body.bo-imprime .bo-x,body.bo-imprime .bo-win-f{display:none}' +
    'body.bo-imprime .bo-plus summary{list-style:none;cursor:auto}body.bo-imprime .bo-plus summary::-webkit-details-marker{display:none}' +
    'body.bo-imprime .bo-pt{break-inside:avoid}}';

  function imprimer() {
    var ov = document.getElementById('bo-ov');
    // une liste <details> fermée ne s'imprime pas, même affichée : ouverte le temps de l'impression, refermée après
    var fermees = ov ? [].slice.call(ov.querySelectorAll('details.bo-plus:not([open])')) : [];
    fermees.forEach(function (d) { d.open = true; });
    var date = ov && ov.querySelector('.bo-feuille-date');
    if (date) date.textContent = 'imprimé le ' + new Date().toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
    document.body.classList.add('bo-imprime');
    var fin = function () {
      document.body.classList.remove('bo-imprime');
      fermees.forEach(function (d) { d.open = false; });
      window.removeEventListener('afterprint', fin);
    };
    window.addEventListener('afterprint', fin);
    window.print();
  }

  // Stock par site : même fichier et même adresse que l'écran Comptoir (cache partagé).
  var _etab = null;
  function chargerStockSites() {
    if (window.ETAB_PRICES) return Promise.resolve();
    if (!_etab) {
      _etab = new Promise(function (ok) {
        var sc = document.createElement('script');
        sc.src = 'etab-prices-data.js?v=' + (window.__APPRO_V || '20260922o');
        sc.async = true;
        sc.onload = sc.onerror = function () { ok(); };
        document.head.appendChild(sc);
      });
    }
    return _etab;
  }

  // ── Fenêtre : un seul #bo-ov sur <body>, recréé à chaque fiche, fermé si l'écran change.
  function overlay() {
    var ov = document.getElementById('bo-ov');
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'bo-ov'; ov.className = 'bo-ov';
      ov.addEventListener('click', function (e) { if (e.target === ov) fermer(); });
      document.body.appendChild(ov);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('on')) fermer(); });
      window.addEventListener('hashchange', fermer);
    }
    return ov;
  }
  function ouvrir() {
    var ov = document.getElementById('bo-ov');
    if (!ov || !ov.firstChild) return;   // aucune fiche hydratée : rien à ouvrir
    ov.classList.add('on'); document.body.style.overflow = 'hidden';
    var x = ov.querySelector('.bo-x'); if (x) x.focus({ preventScroll: true });
  }
  function fermer() {
    var ov = document.getElementById('bo-ov');
    if (!ov) return;
    ov.classList.remove('on'); document.body.style.overflow = '';
  }

  function attenteHtml() {
    return '<div class="bo-win" role="dialog" aria-modal="true" aria-labelledby="bo-win-t" aria-busy="true">' +
      '<div class="bo-win-h"><h3 id="bo-win-t">Infos du jour</h3>' +
        '<button type="button" class="bo-x" aria-label="Fermer" onclick="V2.briefOfficine.fermer()">×</button></div>' +
      '<div class="bo-win-b"><p class="bo-vide">Infos du jour en préparation…</p></div></div>';
  }

  // lieu = { ville, cp } de l'officine (rubrique « Autour d'elle »), + { nom, cip } pour la feuille imprimée (25/11/2026)
  function hydrate(pid, ventesOfficine, lieu) {
    var el = document.getElementById('brief-off');
    if (!el) return;
    if (!document.getElementById('bo-style')) {
      var st = document.createElement('style'); st.id = 'bo-style'; st.textContent = STYLE; document.head.appendChild(st);
    }
    // La fiche se re-dessine parfois après coup (ex. fichier « argument » qui arrive et fait
    // apparaître l'onglet Audit) : sur la MÊME officine, la fenêtre reste ouverte et son contenu
    // est remplacé quand le brief est prêt ; sur une autre officine, on ferme et on vide.
    var ov = overlay();
    // 24/11/2026 — un seul clic : tant que le calcul n'est pas fini, le panneau s'ouvre sur « en préparation » et se remplit tout seul.
    if (ov.getAttribute('data-pid') !== String(pid)) { fermer(); ov.innerHTML = attenteHtml(); ov.setAttribute('data-pid', String(pid)); }
    Promise.all(['ansm-dispo.json', 'prix-futurs.json', 'rappels-lots.json', 'generiques-bdpm.json', 'bodacc-secteur.json'].map(lire).concat([chargerStockSites()])).then(function (j) {
      var cible = document.getElementById('brief-off');
      if (!cible || cible.getAttribute('data-pid') !== String(pid)) return;   // l'écran a changé entre-temps
      var r = calculer({
        aujourdhui: new Date().toISOString().slice(0, 10),
        ventes: ventesOfficine.map(function (s) { return { cip: String(s.artCode || ''), mois: cleMois(s), qte: s.qte || 0 }; }),
        moisCouverts: moisCouverts(ventesOfficine),
        ansm: j[0], prixFuturs: j[1], rappels: j[2], generiques: j[3], secteur: j[4], officine: lieu || {},
        stockSites: stockSites, nom: nom
      });
      cible.innerHTML = rendre(r);
      var o2 = overlay(); o2.innerHTML = fenetreHtml(r, lieu);
      if (o2.classList.contains('on')) { var x = o2.querySelector('.bo-x'); if (x) x.focus({ preventScroll: true }); }
      var btn = document.getElementById('bo-open');
      if (btn) { btn.innerHTML = boutonHtml(resume(r)); btn.disabled = false; }
    });
  }

  // Pour la vue « Ne commande plus » de la fiche (remontée de Florent, 07/10/2026) : la MÊME règle que
  // la rubrique « Ses achats », sans la limite de 3 lignes. ventesOfficine = toutes ses ventes, tous commerciaux.
  // → { fin, avant, connu, lignes:[{cip, qte, mois:{'AAAA-MM':1}, dernier}] }
  function nePlusCommandes(ventesOfficine) {
    var idx = indexAchats(ventesOfficine.map(function (s) { return { cip: String(s.artCode || ''), mois: cleMois(s), qte: s.qte || 0 }; }));
    var r = interrompus(idx, moisCouverts(ventesOfficine));
    return { fin: r.fin, avant: r.avant, connu: r.connu,
      lignes: r.cips.map(function (c) { return { cip: c, qte: idx[c].qte, mois: idx[c].mois, dernier: idx[c].dernier }; }) };
  }

  // HTML du bouton posé par la fiche à droite des onglets (rempli quand le brief est prêt).
  function bouton() {
    return '<button type="button" class="bo-open" id="bo-open" disabled onclick="V2.briefOfficine.ouvrir()">' + boutonHtml(null) + '</button>';
  }

  V2.briefOfficine = { calculer: calculer, autourDElle: autourDElle, nomProduit: nomProduit, hydrate: hydrate, imprimer: imprimer, ouvrir: ouvrir, fermer: fermer, bouton: bouton, nePlusCommandes: nePlusCommandes, moisFr: moisFr };
})();
