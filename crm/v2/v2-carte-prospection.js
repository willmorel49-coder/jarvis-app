/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · SUIVI DE PROSPECTION — verrou, suivi privé, liste de diffusion, calculs purs (26/10/2026) — réservé à Will
   ⚠️ 19/11/2026 : l'ÉCRAN du mode « Prospection » n'est plus sur La carte : il vit dans l'écran Tournées (v2-tournees-carte.js, #tournees/carte).
   Ce fichier ne garde que la logique (sans écran). Les passages ci-dessous sur « le bouton de La carte », le fichier privé
   `connexions-jarvis-prospection.js` et `V2.carteInterne` décrivent l'ancien montage : plus utilisés pour l'affichage.
   Will : « un VRAI outil de prospection dans JARVIS, sur la carte, pour lui seul :
   ne prospecter que des pharmacies cohérentes avec les tournées de livraison ».

   - VERROU : la RPC EXISTANTE jarvis_acces_connexions() (crm/v2/_sql/connexions.sql : Will + compte de preuve). Aucune
     nouvelle fonction ni table en base (décision du 26/10 : pas de SQL). Le bouton n'existe que sur un « oui » ;
     une erreur de la base vaut « non », jamais « oui ».
   - DONNÉES DES TOURNÉES (tracés, clientes, positions) : PAS dans le dépôt (public). Elles vivent dans un fichier du seau
     privé `donnees-protegees`, à sa RACINE, nommé `connexions-jarvis-prospection.js`. CE NOM EST VOULU : la fonction de la base
     jarvis_peut_lire_protege() réserve tout objet `connexions-jarvis%` à jarvis_acces_connexions() (branche placée en tête,
     connexions.sql) ; un autre nom serait lisible par tout compte connecté. Il était chargé par V2.loadFiles (clé « prospection »
     de v2-boot.js), SEULEMENT après le « oui » ci-dessus ; clé retirée le 19/11/2026 (plus rien ne le demande), le fichier reste dans le seau.
   - Prospects = officines de PHARMA_FR des 8 départements du secteur qui ne sont pas dans CLIENTS_ACTIFS
     (cliente de n'importe quel commercial). Distance au tracé le plus proche calculée ICI, dans le
     navigateur : projection plane locale, mêmes constantes que donnees.py (xy / d_seg / d_trace).
   - Couleurs du suivi = celles du mode « Suivi des prospects » de La carte (SUIVI_COL, v2-carte.js) :
     rouge ne pas y retourner > vert RDV à venir > gris déjà vue > bleu jamais vue.
   - « Mail envoyé » et « relance » : table `profils` existante (scope 'groupement', scope_id '__prospection_<id>__', même rangement
     que u2ScopeId() de v2-app.js). La relance crée aussi une
     ligne dans la To do existante (V2.todo.ajouterLigne). « Ne pas y retourner » = champ existant du Profil.
   - LISTE DE DIFFUSION (26/10/2026 soir) : champ `l` ('oui' = à ajouter, 'non' = à retirer) de la même ligne de suivi, écrit
     SEULEMENT quand le souhait diffère de l'état Outlook connu. Cet état vit dans une seconde ligne `profils`
     (scope_id '__prospection_outlook_<id>__', data = { maj, o: { cip: 'b' | 'a' | 'e:AAAA-MM-JJ' } }) écrite UNIQUEMENT par
     ~/prospection-tournees/diffusion/synchro.py ; l'app la LIT seulement. Le clic n'agit pas sur Outlook : les brouillons
     se mettent à jour quand Will le demande (synchro.py).
   - TOURNÉES OPS (05/11/2026) : le fichier privé porte aussi l'ordre de livraison (n° des arrêts), le tracé par la ROUTE, le transporteur,
     le commercial, la rentabilité de chaque cliente et de chaque tournée, et pour chaque prospect la tournée la plus proche (km sur la
     route), l'endroit où il s'insère (« entre le n° X et le n° Y ») et un détour estimé. Rien de chiffré dans le dépôt : tout vient du
     fichier privé. Un fichier sans ces champs (ancien format) s'affiche comme avant.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var V2 = glob.V2 = glob.V2 || {};
  var C = {};   // calcul pur (testé : tests/carte-prospection.test.mjs)

  // ── Géométrie : portage à l'identique de donnees.py (xy, d_pt, d_seg, d_trace) ──
  var LAT0 = 47.5 * Math.PI / 180;
  C.DEPTS = ['14', '35', '37', '44', '49', '50', '53', '72'];
  C.xy = function (lat, lng) { return [lng * 111.320 * Math.cos(LAT0), lat * 110.574]; };
  C.dPt = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  C.dSeg = function (p, a, b) {
    var vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy;
    var u = L === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L));
    return Math.hypot(p[0] - a[0] - u * vx, p[1] - a[1] - u * vy);
  };
  C.dTrace = function (p, tr) {
    if (tr.length < 2) return tr.length ? C.dPt(p, tr[0]) : Infinity;
    var m = Infinity;
    for (var i = 0; i < tr.length - 1; i++) { var d = C.dSeg(p, tr[i], tr[i + 1]); if (d < m) m = d; }
    return m;
  };
  // Tracés projetés une fois : { code: [[x,y]…] }
  C.projeter = function (tournees) {
    var out = {};
    Object.keys(tournees || {}).forEach(function (k) { out[k] = (tournees[k].trace || []).map(function (q) { return C.xy(q[0], q[1]); }); });
    return out;
  };
  // Tournée la plus proche d'un point et distance (km, 2 décimales comme `round(km, 2)` de donnees.py)
  C.plusProche = function (lat, lng, proj) {
    var p = C.xy(lat, lng), best = null, bk = Infinity;
    Object.keys(proj).forEach(function (k) { var d = C.dTrace(p, proj[k]); if (d < bk) { bk = d; best = k; } });
    return { code: best, km: Math.round(bk * 100) / 100 };
  };

  function cleCip(v) { return String(v == null ? '' : v).replace(/[^0-9A-Za-z_-]/g, ''); }
  C.cleCip = cleCip;
  function deptDe(cp) { cp = String(cp || '').replace(/\s/g, ''); return cp.length < 2 ? '' : (/^97/.test(cp) ? cp.slice(0, 3) : cp.slice(0, 2)); }
  function posOk(p) { return isFinite(p[0]) && isFinite(p[1]) && (p[0] !== 0 || p[1] !== 0); }

  // Prospects : PHARMA_FR (8 départements) moins CLIENTS_ACTIFS. `pts` = D.p, `actifs` = CLIENTS_ACTIFS.d (objet clé CIP).
  // Rend { liste (triée par distance), sansPosition }. Une officine sans coordonnées valides n'est pas comptée :
  // elle est dite à part (jamais « à 0 km »).
  C.prospects = function (pts, actifs, proj) {
    var liste = [], sansPosition = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], cip = cleCip(p[13]);
      if (!cip || C.DEPTS.indexOf(deptDe(p[8])) < 0) continue;
      if (Object.prototype.hasOwnProperty.call(actifs, cip)) continue;
      if (!posOk(p)) { sansPosition++; continue; }
      var r = C.plusProche(p[0], p[1], proj);
      liste.push({ i: i, cip: cip, nom: p[6] || '', ville: p[7] || '', cp: String(p[8] || ''), lat: p[0], lng: p[1], km: r.km, tournee: r.code });
    }
    liste.sort(function (a, b) { return a.km - b.km || (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0); });
    return { liste: liste, sansPosition: sansPosition };
  };
  // ── Tournées OPS : calcul pur (testé : tests/carte-tournees-ops.test.mjs) ──
  C.nouveauFormat = function (d) { return !!(d && d.prospects && d.prospects.length && (d.clientes || []).some(function (c) { return c.n != null; })); };
  // Prospects lus dans le fichier privé (colonnes : cip, lat, lng, tournée, km sur la route, après l'arrêt n°, avant l'arrêt n°, détour estimé, position fiable)
  // et rapprochés de PHARMA_FR par CIP (nom, ville). Une cliente d'un commercial (CLIENTS_ACTIFS) n'est jamais prospect.
  C.prospectsFichier = function (pts, lignes, actifs) {
    var index = {}, liste = [];
    for (var i = 0; i < pts.length; i++) index[cleCip(pts[i][13])] = i;
    (lignes || []).forEach(function (r) {
      var cip = cleCip(r[0]), i = index[cip];
      if (i == null || (actifs && Object.prototype.hasOwnProperty.call(actifs, cip))) return;
      if (!isFinite(r[1]) || !isFinite(r[2])) return;
      var p = pts[i];
      liste.push({ i: i, cip: cip, nom: p[6] || '', ville: p[7] || '', cp: String(p[8] || ''), lat: r[1], lng: r[2], tournee: r[3], km: r[4], avant: r[5], apres: r[6], detour: r[7], fiable: r[8] !== false });
    });
    liste.sort(function (a, b) { return a.km - b.km || (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0); });
    return { liste: liste, sansPosition: 0 };
  };
  C.eur = function (v) { return (v == null || !isFinite(v)) ? '—' : (Math.round(v) < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('fr-FR') + ' €'; };
  C.eur2 = function (v) { return (v == null || !isFinite(v)) ? '—' : (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; };
  C.nb1 = function (v) { return (v == null || !isFinite(v)) ? '—' : v.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };
  C.joursTournee = function (t) {
    if (t && t.jours && t.jours.length) return C.jours(t.jours);
    return t && t.jours_statut === 'a_confirmer' ? 'jours à confirmer' : 'jours à préciser';
  };
  // Codes à essayer, dans l'ordre, pour ouvrir la fiche d'un arrêt : d'abord sa fiche client (code de l'arrêt, ajoutée à
  // l'annuaire depuis WML_OFFICINES une fois connecté : elle porte ses ventes), puis la fiche reliée par nom + commune
  // (champ `fiche`, 06/11/2026) seulement si la première est introuvable. La reliée seule ouvrait un « Prospect » à 0 €.
  C.clesFiche = function (c) { var r = []; if (c && c.id) r.push(String(c.id)); if (c && c.fiche && String(c.fiche) !== r[0]) r.push(String(c.fiche)); return r; };
  // Où le prospect s'insère dans la tournée : phrase pour les chauffeurs.
  C.insertion = function (p) {
    if (!p || p.avant == null) return '';
    var lieu = p.avant === 0 ? 'entre le dépôt et le n° ' + p.apres : (p.apres == null ? 'après le n° ' + p.avant + ' (dernier arrêt), sur le retour' : 'entre le n° ' + p.avant + ' et le n° ' + p.apres);
    var det = p.detour == null ? '' : (p.detour < 1 ? ' · détour estimé : moins de 1 km' : ' · détour estimé ~' + Math.round(p.detour) + ' km');
    return lieu + ' de ' + p.tournee + det;
  };
  // 22 tournées : teintes espacées d'un angle d'or, deux niveaux de clarté (texte blanc lisible dans la pastille numérotée)
  C.couleurTournee = function (k) { return 'hsl(' + Math.round((k * 137.508) % 360) + ',68%,' + (k % 2 ? 33 : 40) + '%)'; };
  C.ordonnerTournees = function (T, tri) {
    var codes = Object.keys(T || {}).sort();
    if (tri === 'renta') codes.sort(function (a, b) { var x = T[a].rentabilite, y = T[b].rentabilite; return (x == null ? 1e12 : x) - (y == null ? 1e12 : y) || (a < b ? -1 : 1); });
    return codes;
  };
  C.dans = function (liste, rayon) { var n = 0; while (n < liste.length && liste[n].km <= rayon) n++; return n; };   // liste triée : nombre de prospects à ≤ rayon km

  // Couleur du suivi : MÊME priorité que suiviEtat() de v2-carte.js. S = { pret, rouge, rdv, vu (fonction cip → date | null) }.
  C.etat = function (cip, S) {
    if (!S || !S.pret) return 'attente';
    if (S.rouge && S.rouge[cip]) return 'rouge';
    if (S.rdv && S.rdv[cip]) return 'vert';
    if (S.vu && S.vu(cip)) return 'gris';
    return 'bleu';
  };

  // Dates (jour local, jamais UTC : « aujourd'hui » à 00 h 30 ne doit pas rendre hier)
  C.isoOk = function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); };
  C.aujourdhui = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  };
  C.fr = function (iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };
  var JOURS3 = { lundi: 'lun', mardi: 'mar', mercredi: 'mer', jeudi: 'jeu', vendredi: 'ven', samedi: 'sam', dimanche: 'dim' };
  C.jours = function (j) { return (j || []).map(function (x) { return JOURS3[x] || x; }).join(', '); };
  C.kmFr = function (km) { return (Math.round(km * 10) / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); };

  // ───────────────────────────────────────────────────────────────
  // État + accès (verrou) — sans DOM, testé
  // ───────────────────────────────────────────────────────────────
  var S = {
    ok: null,            // null = pas encore su · true / false = réponse de la base
    verif: null,         // promesse de la vérification (une seule par session de page)
    actif: false, charge: false, erreur: '', manque: [],
    donnees: null, proj: null, prospects: [], sansPosition: 0,
    rayon: 10, choisi: '', affiches: 60, vue: 'prospects', tri: 'code', tourneeSel: '',
    suiviCouleur: { pret: false }, prive: {}, priveOk: false, outlook: null
  };
  var RAYON_MAX = 50;

  function sb() { return (V2.sb && V2.sb()) || null; }
  C.etatInterne = S;

  // Le bouton n'existe que si la base répond OUI. Erreur, délai, pas de session : NON.
  C.verifier = function (force) {
    if (S.verif && !force) return S.verif;
    var c = sb();
    if (!c || !c.rpc || !V2.user) { S.ok = false; return Promise.resolve(false); }
    S.verif = Promise.resolve(c.rpc('jarvis_acces_connexions')).then(function (r) {
      S.ok = !!(r && !r.error && r.data === true);
      return S.ok;
    }, function () { S.ok = false; return false; });
    return S.verif;
  };
  C.ok = function () { return S.ok === true; };
  C.actif = function () { return S.actif && S.ok === true; };

  // Suivi (mail envoyé, relance) : UNE ligne `profils` par utilisateur, même rangement que u2ScopeId() (v2-app.js) :
  // scope_type 'groupement' (la base n'accepte que des types existants) + un scope_id qu'aucun groupement ne porte.
  // data = { s: { cip: { m: 'AAAA-MM-JJ', r: 'AAAA-MM-JJ', l: 'oui' | 'non' } } }.
  function scopeSuivi() { return '__prospection_' + ((V2.user && V2.user.id) || 'local') + '__'; }
  function versSuivi(data) {
    var out = {}, s = (data && data.s) || {};
    Object.keys(s).forEach(function (k) { out[k] = { mail: (s[k] && s[k].m) || '', relance: (s[k] && s[k].r) || '', liste: (s[k] && s[k].l) || '' }; });
    return out;
  }
  // État des brouillons Outlook : seconde ligne `profils`, écrite par synchro.py seulement. Rend { maj, o } ; null si la lecture a raté,
  // si la ligne n'existe pas encore ou si son contenu n'a pas la forme attendue (jamais lu comme « aucun brouillon »).
  function scopeOutlook() { return '__prospection_outlook_' + ((V2.user && V2.user.id) || 'local') + '__'; }
  C.lireEtatOutlook = function () {
    var c = sb();
    if (!c || !V2.user) return Promise.resolve(null);
    return Promise.resolve(c.from('profils').select('data').eq('scope_type', 'groupement').eq('scope_id', scopeOutlook()).maybeSingle())
      .then(function (r) {
        var d = r && !r.error && r.data && r.data.data;
        if (!d || !d.o || typeof d.o !== 'object' || Array.isArray(d.o)) return null;
        return { maj: String(d.maj || ''), o: d.o };
      }, function () { return null; });
  };
  // Liste de diffusion d'une officine. prive = { cip: { liste } } (suivi privé) ; outlook = { maj, o } ou null (non lu).
  // etat : pret (brouillon prêt) · hors (adresse connue, pas de brouillon) · envoye (mail de prospection parti) · sansmail · inconnu (Outlook non lu).
  // dans : ce que Will veut · attente : 'ajout' | 'retrait' quand son souhait diffère d'Outlook · le : jour d'envoi.
  C.diffusion = function (cip, prive, outlook) {
    if (!outlook || !outlook.o || typeof outlook.o !== 'object') return { etat: 'inconnu', dans: false, attente: '', le: '' };
    var code = Object.prototype.hasOwnProperty.call(outlook.o, cip) ? String(outlook.o[cip]) : '';
    var liste = (prive && prive[cip] && prive[cip].liste) || '';
    if (code === 'b') return { etat: 'pret', dans: liste !== 'non', attente: liste === 'non' ? 'retrait' : '', le: '' };
    if (code === 'a') return { etat: 'hors', dans: liste === 'oui', attente: liste === 'oui' ? 'ajout' : '', le: '' };
    if (/^e:\d{4}-\d{2}-\d{2}$/.test(code)) return { etat: 'envoye', dans: false, attente: '', le: code.slice(2) };
    return { etat: 'sansmail', dans: false, attente: '', le: '' };
  };
  // Valeur à écrire pour que Will « veuille » (ou non) la liste : '' (rien à écrire) quand son souhait égale l'état d'Outlook.
  // Rend null quand aucun geste n'est possible (envoyé, sans mail, Outlook non lu).
  C.valeurSouhait = function (etat, veut) {
    if (etat === 'pret') return veut ? '' : 'non';
    if (etat === 'hors') return veut ? 'oui' : '';
    return null;
  };
  // Chiffres de l'en-tête, CALCULÉS : n = pharmacies dans la liste (souhait compris), k = changements à reporter dans Outlook.
  C.compteDiffusion = function (prive, outlook) {
    var n = 0, k = 0;
    if (!outlook || !outlook.o) return { n: 0, k: 0, lu: false };
    Object.keys(outlook.o).forEach(function (cip) { var d = C.diffusion(cip, prive, outlook); if (d.dans) n++; if (d.attente) k++; });
    return { n: n, k: k, lu: true };
  };
  // Rend { cip: { mail, relance } } ; null si la lecture a raté (jamais « rien à signaler »).
  C.lireSuiviPrive = function () {
    var c = sb();
    if (!c || !V2.user) return Promise.resolve(null);
    return Promise.resolve(c.from('profils').select('data').eq('scope_type', 'groupement').eq('scope_id', scopeSuivi()).maybeSingle())
      .then(function (r) { return (!r || r.error) ? null : versSuivi(r.data && r.data.data); }, function () { return null; });
  };
  // Écrit UNE valeur : la ligne est relue juste avant (le Mac et l'iPhone ne s'écrasent pas), puis réécrite. Jamais de DELETE : '' = effacé.
  C.ecrireSuiviPrive = function (cip, colonne, valeur) {
    var c = sb();
    if (!c || !V2.user) return Promise.resolve(false);
    var champ = colonne === 'mail_envoye_le' ? 'm' : colonne === 'relance_le' ? 'r' : colonne === 'liste_souhait' ? 'l' : '';
    if (!champ) return Promise.resolve(false);
    if (champ === 'l' && valeur !== '' && valeur !== 'oui' && valeur !== 'non') return Promise.resolve(false);
    return Promise.resolve(c.from('profils').select('data').eq('scope_type', 'groupement').eq('scope_id', scopeSuivi()).maybeSingle()).then(function (r) {
      if (!r || r.error) return false;
      var data = (r.data && r.data.data) || {}, s = data.s || {};
      var e = s[cip] || {};
      if (valeur) e[champ] = valeur; else delete e[champ];
      if (e.m || e.r || e.l) s[cip] = e; else delete s[cip];
      return Promise.resolve(c.from('profils').upsert({ scope_type: 'groupement', scope_id: scopeSuivi(), data: { s: s }, updated_by: V2.user.id,
        updated_by_name: V2.user.name || '', updated_at: new Date().toISOString() }, { onConflict: 'scope_type,scope_id' })).then(function (u) { return !!(u && !u.error); });
    }, function () { return false; });
  };

  // 19/11/2026 — plus d'écran ici : le mode « Prospection » a déménagé dans l'écran Tournées (v2-tournees-carte.js), qui réutilise
  // ce fichier pour le verrou, le suivi privé, l'état Outlook et la liste de diffusion. La carte (La carte) n'en dépend plus.
  V2.carteProspection = C;
  C.calc = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
