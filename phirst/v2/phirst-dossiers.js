/* PHIRST · écran « Dossiers de projet » (23/11/2026) : un dossier par pharmacie, à volets (maquette choisie par Will).
   Tables : `dossiers` (la pharmacie, même identifiant que dans l'ancienne version), `dossier_volets` (un par sorte), `dossier_etapes`
   (une ligne par étape touchée), seau `dossiers` pour les documents. Toute la logique (étapes, retards, groupes, contrôles) est dans
   phirst-dossiers-pur.js, testée (tests/phirst-dossiers.test.mjs) ; ici : l'affichage et les écritures.
   Chaque geste écrit, puis met l'écran à jour avec la ligne RENDUE par la base : jamais de « réussi » avant la réponse. */
(function () {
  'use strict';
  var D = window.PHIRST_DOSSIERS_PUR, V2 = window.V2, X = window.PHIRST_ECRAN;
  if (!D || !V2 || !X) return;
  V2.pages = V2.pages || {};
  var PAS = 'Pas enregistré : réessayez dans un instant.';
  var COLS_PISTE = 'id,nom,ville,cp,departement,pharmacien,telephone,stage,source,robot_marque,dossier_id,created_at';
  var esc = X.esc;
  function sb() { return typeof V2.sb === 'function' ? V2.sb() : null; }

  var S = {
    racine: null, jeton: 0, telepro: false, roleConnu: false, ws: null, charge: false, erreur: false,
    dossiers: [], volets: [], etapes: [], pistes: [], rdvs: null, rdvEnCours: false, rdvErreur: false,
    vue: 'liste', dossierId: null, sorte: null, ouv: -1,
    nouveau: null, ajout: null, modif: null, etatForm: null, raison: '', raisonErr: '',
    flash: '', flashErr: false, flashProchain: '', occupe: false, debloques: [],
    brouillons: {}, mentions: {}, urls: {}, retirer: null, timers: {}, chaine: {},
    /* Chantiers (lot 1, 23/11) : lus pour le bloc « Le chantier » de l'étape Travaux ; une lecture ratée n'empêche pas les dossiers de s'afficher */
    chantiers: [], chArtisans: [], chTaches: [], chErreur: false, chOuvert: {}, cleVoulue: null
  };
  var CH = window.PHIRST_CHANTIERS_PUR;

  /* ── petites briques ── */
  function ico(n, t) {
    t = t || 20;
    var p = {
      retour: '<path d="M15 5l-7 7 7 7"/>', coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
      fleche: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>', tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>'
    }[n];
    return '<svg width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  function segs(l) { return l.segs.map(function (s) { return s.b ? '<b>' + esc(s.t) + '</b>' : esc(s.t); }).join(''); }
  function dis() { return S.occupe ? ' disabled' : ''; }
  function auj() { return D.aujourdhui(); }
  function pharmacies() { return D.pharmacies(S.dossiers, S.volets, S.etapes); }
  function pisteDe(dossierId) { return S.pistes.filter(function (p) { return p.dossier_id === dossierId; })[0] || null; }
  function phCourant() { return pharmacies().filter(function (p) { return p.dossier.id === S.dossierId; })[0] || null; }
  function voletCourant() {
    var ph = phCourant(); if (!ph) return null;
    return ph.volets.filter(function (v) { return v.sorte === S.sorte; })[0] || ph.volets[0] || null;
  }
  function indexProchaine(v) { var p = v && D.prochaineEtape(v); return p ? p.n - 1 : (v && v.etapes.length ? v.etapes.length - 1 : -1); }
  function cleBrouillon(v, e) { return v.id + '/' + e.k; }
  function dire(texte, err) { S.flash = texte; S.flashErr = !!err; }

  /* ── lecture ── */
  function toutLire(fabrique) {
    var tout = [];
    function page(n) {
      return fabrique().range(n * 1000, n * 1000 + 999).then(function (r) {
        if (r.error) throw new Error('lecture');
        tout = tout.concat(r.data || []);
        return (r.data || []).length === 1000 && n < 9 ? page(n + 1) : tout;
      });
    }
    return page(0);
  }
  function charger(garder) {
    var u = V2.user, tok = ++S.jeton, base = sb();
    if (!garder) { S.charge = false; S.erreur = false; }
    if (!u || !base) { S.erreur = true; dessiner(); return Promise.resolve(); }
    if (!garder) dessiner();
    return base.from('crm_members').select('workspace_id').eq('user_id', u.id).limit(1).maybeSingle().then(function (m) {
      var ws = m && !m.error && m.data && m.data.workspace_id;
      return Promise.all([
        base.from('dossiers').select('id,user_id,nom,ville,titulaire,statut,created_at').eq('user_id', u.id).order('created_at', { ascending: false }),
        toutLire(function () { return base.from('dossier_volets').select('*').order('id'); }),
        toutLire(function () { return base.from('dossier_etapes').select('*').order('id'); }),
        ws ? toutLire(function () { return base.from('crm_prospects').select(COLS_PISTE).eq('workspace_id', ws).order('id'); }) : Promise.resolve([]),
        CH ? Promise.all([
          toutLire(function () { return base.from('chantiers').select('*').order('id'); }),
          toutLire(function () { return base.from('chantier_artisans').select('id,chantier_id,nom,retire_le,created_at').order('id'); }),
          toutLire(function () { return base.from('chantier_taches').select('id,chantier_id,titre,artisan_id,prevue,fait,ordre,created_at').order('id'); })
        ]).then(null, function () { return null; }) : Promise.resolve([[], [], []])
      ]).then(function (x) {
        if (x[0].error) throw new Error('dossiers');
        if (tok !== S.jeton) return;
        S.ws = ws || null; S.dossiers = x[0].data || []; S.volets = x[1]; S.etapes = x[2]; S.pistes = x[3];
        S.chErreur = !x[4]; S.chantiers = x[4] ? x[4][0] : []; S.chArtisans = x[4] ? x[4][1] : []; S.chTaches = x[4] ? x[4][2] : [];
        S.charge = true; S.erreur = false; dessiner();
      });
    }).then(null, function () { if (tok === S.jeton) { S.erreur = true; dessiner(); } });
  }

  /* ── Idée 7 · « Ce qui bloque cette semaine » : le bloc de la liste et la chaîne des volets (calcul : phirst-dossiers-pur.js) ── */
  function lieuPh(ph) {
    var d = ph.dossier, p = pisteDe(d.id), ville = d.ville || (p && p.ville) || '';
    return ville ? ville + (p && p.departement ? ' (' + p.departement + ')' : '') : '';
  }
  function datesBloc(r) {
    var t = [];
    if (r.depuis) t.push('Depuis le ' + D.court(r.depuis) + (r.jours != null ? ' · ' + D.pl(r.jours, 'jour', 'jours') : ''));
    if (r.etape.prevue) t.push('prévue le ' + D.court(r.etape.prevue));
    return (t.length ? '<span>' + esc(t.join(' · ')) + '</span>' : '') + (r.retard > 0 ? ' <span class="ret">En retard de ' + D.pl(r.retard, 'jour', 'jours') + '</span>' : '');
  }
  function puces(liste) { return liste.map(function (a) { return '<i class="dz-pl">' + esc(a.t) + '</i>'; }).join(''); }
  function quiLigne(q) { return q.vous ? 'À faire par vous' : 'À faire bouger : <b>' + esc(q.qui) + '</b>'; }
  /* Le geste : appeler le pharmacien quand on a son numéro ; sinon ouvrir l'étape (date, notes, documents), où se note ce qui s'est dit. */
  function boutonGeste(ph, volet, etape, q, plein) {
    var p = pisteDe(ph.dossier.id), tel = q.qui === 'le pharmacien' && p && p.telephone ? String(p.telephone).replace(/[^\d+]/g, '') : '';
    var cl = 'dz-btn petit' + (plein ? ' plein' : '');
    if (tel) return '<a class="' + cl + '" href="tel:' + esc(tel) + '">' + ico('tel', 16) + esc(q.geste) + '</a>';
    return '<button type="button" class="' + cl + '" data-dz="voir-etape" data-id="' + esc(ph.dossier.id) + '" data-s="' + esc(volet.sorte) + '" data-k="' + esc(etape.k) + '">' + esc(q.geste) + '</button>';
  }
  function htmlSemaine(phs) {
    var L = D.retenues(phs, auj()), noms = [];
    L.forEach(function (r) { if (noms.indexOf(r.ph.dossier.id) < 0) noms.push(r.ph.dossier.id); });
    var T = D.titreSemaine(L.length, noms.length, phs.length);
    var h = '<section class="dz-sem" aria-labelledby="dz-sem-t"><div class="dz-sem-tete"><p class="dz-kicker">Cette semaine</p><h2 id="dz-sem-t">' + esc(T.titre) + '</h2><p class="dz-sem-p">' + esc(T.texte) + '</p></div>';
    if (L.length) {
      h += '<ol class="dz-sem-liste">';
      L.forEach(function (r) {
        var d = r.ph.dossier, lieu = lieuPh(r.ph);
        h += '<li class="dz-sem-l"><div class="dz-sem-ph"><a class="dz-sem-nom" href="#dossiers/' + encodeURIComponent(d.id) + '">' + esc(d.nom) + '</a>' + (lieu ? '<span>' + esc(lieu) + '</span>' : '') + '</div>' +
          '<div class="dz-sem-corps"><span class="dz-kicker">Volet ' + esc(r.volet.nom) + ' · étape ' + r.etape.n + ' sur ' + r.volet.etapes.length + '</span><b>' + esc(r.etape.t) + '</b>' +
          '<p class="dz-sem-dep">' + datesBloc(r) + '</p><p class="dz-sem-att"><span>Attend cette étape :</span>' + puces(r.attendent) + '</p></div>' +
          '<div class="dz-sem-act"><p class="dz-sem-qui">' + quiLigne(r.qui) + '</p>' + boutonGeste(r.ph, r.volet, r.etape, r.qui, true) +
          '<a class="dz-btn petit" href="#dossiers/' + encodeURIComponent(d.id + ':' + r.volet.sorte) + '">Ouvrir le dossier ' + ico('fleche', 16) + '</a></div></li>';
      });
      h += '</ol>';
    }
    S.debloques.slice(-2).forEach(function (t) { h += '<p class="dz-sem-ok">' + ico('coche', 18) + '<span>' + esc(t) + '</span></p>'; });
    return h + '<p class="dz-sem-note">Rien à saisir en plus : tout part des étapes déjà cochées.</p></section>';
  }
  /* Sur la carte d'une pharmacie : ce qui la retient cette semaine */
  function retenuCarte(ph) {
    return D.retenues([ph], auj()).map(function (r) {
      return '<p class="dz-retenu">Cette semaine · ' + esc(r.volet.nom) + ' : ' + (r.qui.vous ? 'une étape à faire par vous' : 'en attente ' + esc(D.deQui(r.qui.qui))) + '</p>';
    }).join('');
  }
  function htmlChaine(ph) {
    if (ph.volets.filter(function (v) { return v.etat === 'cours'; }).length < 2) return '';
    var c = D.chaineBloque(ph, auj()), V = c.volets, nb = c.nbBloque;
    var h = '<section class="dz-chaine" aria-labelledby="dz-ch-t"><div class="dz-ch-tete"><div><p class="dz-kicker">Ce qui bloque cette semaine</p>';
    if (nb) h += '<h2 id="dz-ch-t">' + (nb > 1 ? nb + ' étapes retiennent' : 'Une étape retient') + ' le reste du dossier</h2>';
    else h += '<h2 id="dz-ch-t">Chaque volet peut avancer sans attendre un autre</h2><p class="dz-ch-p">Cochez les étapes au fil de l’eau : dès qu’une étape en retiendra une autre, elle apparaîtra ici.</p>';
    h += '</div><p class="dz-ch-note">Rien à saisir en plus : tout part des étapes déjà cochées.</p></div><ol class="dz-ch-liste">';
    V.forEach(function (x, i) {
      var v = x.v, B = x.B;
      if (i > 0) {
        var prev = V[i - 1], act = c.cross.some(function (k) { return k.dy === prev.v && k.dx === v; });
        h += '<li class="dz-ch-lien' + (act ? ' act' : '') + '" aria-hidden="true"><span>' + ico('fleche', 20) + '</span></li>';
      }
      h += '<li class="dz-chn ' + x.statut + '"><div class="dz-chn-t"><b>' + esc(v.nom) + '</b><span>' + D.nbFaites(v) + '/' + v.etapes.length + '</span></div>' + friseMini(v);
      if (!B) { h += '<p class="dz-chn-m">Toutes les étapes sont faites.</p></li>'; return; }
      var q = D.quiDe(v.sorte, B.k);
      if (x.statut === 'bloque') {
        var r = x.ligne;
        h += '<p class="dz-chn-k">Étape qui retient le reste</p><h3>' + esc(B.t) + '</h3><p class="dz-chn-m">Étape ' + B.n + ' sur ' + v.etapes.length + '</p><p class="dz-chn-d">' + datesBloc(r) + '</p><p class="dz-chn-q">' + quiLigne(q) + '</p>' +
          (v.sorte === 'transfert' && B.k === 'reponse' ? '<p class="dz-chn-m">La réponse dépend du délai de réponse de l’ARS.</p>' : '') +
          '<div class="dz-chn-att"><span>Attend cette étape :</span>' + puces(r.attendent) + '</div>' +
          '<div class="dz-chn-act"><button class="dz-btn plein" type="button" data-dz="noter-bloque" data-v="' + esc(v.id) + '" data-k="' + esc(B.k) + '"' + dis() + '>' + ico('coche', 18) + esc(q.noter) + '</button>' + boutonGeste(ph, v, B, q, false) + '</div>';
      } else if (x.statut === 'attend') {
        var c0 = x.attendDe[0];
        h += '<p class="dz-chn-k">En attente</p><h3>' + esc(B.t) + '</h3><p class="dz-chn-m">Étape ' + B.n + ' sur ' + v.etapes.length + '</p><p class="dz-chn-w"><b>Attend :</b> ' + esc(c0.ey.c) + ' <span>(volet ' + esc(c0.dy.nom) + ')</span></p><p>' + esc(c0.regle) + '</p>';
      } else {
        var dl = D.ligneDate(B, auj());
        h += '<p class="dz-chn-k">Avance</p><h3>' + esc(B.t) + '</h3><p class="dz-chn-m">Étape ' + B.n + ' sur ' + v.etapes.length + ' · ' + (q.vous ? 'à faire par vous' : 'à faire bouger : ' + esc(q.qui)) + '</p><p class="dz-chn-d' + (dl.retard ? ' ret' : '') + '">' + esc(dl.texte) + '</p>';
        if (x.waiters.length) h += '<div class="dz-chn-att"><span>Libère ensuite :</span>' + puces(x.waiters.map(function (w) { return { t: D.nomAttend(w.dx, w.ex) }; })) + '</div>';
        x.plusLoin.forEach(function (k) { h += '<p class="dz-chn-w"><b>Plus loin :</b> ' + esc(D.nomAttend(k.dx, k.ex)) + ' attend ' + esc(String(k.ey.c).toLowerCase()) + ' <span>(volet ' + esc(k.dy.nom) + ')</span></p>'; });
      }
      h += '</li>';
    });
    h += '</ol>';
    if (c.regles.length) h += '<details class="dz-ch-regles"><summary>Pourquoi cet ordre ?<i class="dz-chev"></i></summary><ul>' + c.regles.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></details>';
    return h + '</section>';
  }
  /* « Noter la réponse » (etc.) : coche l'étape qui retient, puis dit ce que ça libère. La base répond avant toute phrase de réussite. */
  function noterBloque(voletId, cle) {
    var ph = phCourant(), v = ph && ph.volets.filter(function (x) { return x.id === voletId; })[0], e = v && v.etapes.filter(function (x) { return x.k === cle; })[0];
    if (!v || !e || e.faite) return;
    var libres = D.cequiSeDebloque(ph, voletId, cle, auj()), jour = auj();
    return geste(function () {
      return ecrireEtape(v, cle, { faite: jour }).then(function () {
        var t = D.phraseDebloque(ph.dossier.nom, e, libres || []);
        S.debloques.push(t); dire(t, false);
      });
    });
  }

  /* ── affichage : la liste ── */
  function infoPharmacie(ph) {
    var d = ph.dossier, p = pisteDe(d.id), ville = d.ville || (p && p.ville) || '', dep = p && p.departement ? ' (' + p.departement + ')' : '';
    var tit = d.titulaire || (p && p.pharmacien) || '';
    return { piste: p, ligne: [ville ? ville + dep : '', tit].filter(Boolean).join(' · ') };
  }
  function friseMini(v) {
    var pr = D.prochaineEtape(v), h = '<div class="dz-frise-c" aria-hidden="true">';
    v.etapes.forEach(function (e) { h += '<i class="' + (e.faite ? 'f' : (pr === e && v.etat === 'cours' ? 'c' : '')) + '"></i>'; });
    return h + '</div>';
  }
  function carte(ph) {
    var a = auj(), vs = ph.volets, u = D.urgent(vs, a), st = D.statutPharmacie(vs, a), inf = infoPharmacie(ph);
    var h = '<article class="dz-carte"><div class="dz-carte-h"><span class="dz-et">' + (vs.length ? D.pl(vs.length, 'volet', 'volets') : 'Aucun volet') + '</span>' +
      '<span class="dz-et' + (st.ton ? ' ' + st.ton : '') + '">' + esc(st.texte) + '</span></div>';
    h += '<h3>' + esc(ph.dossier.nom) + '</h3>' + (inf.ligne ? '<p class="dz-sous">' + esc(inf.ligne) + '</p>' : '');
    vs.forEach(function (v) { D.detailsVolet(v).forEach(function (l) { if (l.cle === 'regroupement') h += '<p class="dz-regrp">' + segs(l) + '</p>'; }); });
    if (vs.length) {
      h += '<div class="dz-volets">';
      vs.forEach(function (v) {
        h += '<div class="dz-volet' + (v.etat !== 'cours' || D.estTermine(v) ? ' off' : '') + '"><b>' + esc(v.nom) + (v.sorte === 'riedl' && D.remplacementDe(v.details) ? ' <span class="dz-nn">(remplacement)</span>' : '') + '</b>' +
          '<span class="dz-nn">' + D.nbFaites(v) + ' / ' + v.etapes.length + esc(D.suffixeVolet(v)) + '</span>' + friseMini(v) + '</div>';
      });
      h += '</div>';
    }
    if (u) {
      var dl = D.ligneDate(u.etape, a);
      h += '<div class="dz-proch"><span class="dz-kicker">Prochaine chose à faire · ' + esc(u.volet.nom) + '</span><b>' + esc(u.etape.t) + '</b><small class="' + (dl.retard ? 'ret' : '') + '">' + esc(dl.texte) + '</small></div>';
    } else if (!vs.length) {
      h += '<div class="dz-proch"><span class="dz-kicker">Aucun volet</span><small>Ouvrez le dossier pour choisir la première sorte de projet.</small></div>';
    } else {
      h += '<div class="dz-proch"><span class="dz-kicker">Aucune étape à faire</span><small>' + esc(D.texteSansProchaine(vs)) + '</small></div>';
    }
    h += retenuCarte(ph);
    return h + '<button type="button" class="dz-btn" data-dz="ouvrir" data-id="' + esc(ph.dossier.id) + '">Ouvrir le dossier ' + ico('fleche', 18) + '</button></article>';
  }
  function groupe(titre, n, html) { return '<section class="dz-groupe"><div class="dz-groupe-t"><h2>' + titre + '</h2><span>' + n + '</span></div><div class="dz-grille">' + html + '</div></section>'; }
  function repli(titre, n, html) { return '<details class="dz-repli"><summary>' + titre + ' <span class="dz-n">' + n + '</span><i class="dz-chev"></i></summary><div class="dz-repli-c"><div class="dz-grille">' + html + '</div></div></details>'; }
  function htmlListe() {
    var h = '', phs = pharmacies(), g = D.groupes(phs, auj());
    var compte = S.charge ? D.phraseCompte(g, phs.length, phs.reduce(function (n, p) { return n + p.volets.length; }, 0)) : '';
    h += '<div class="dz-tete"><div class="dz-tete-g"><h1>Dossiers de projet</h1><p>Vos dossiers, étape par étape : où en est chacun, et quelle est la prochaine chose à faire.</p><p class="dz-compte">' + esc(compte) + '</p></div>' +
      '<button class="dz-btn plein" type="button" data-dz="nouveau" data-f="nouveau"' + dis() + '>' + ico('plus', 18) + 'Nouveau dossier</button></div>';
    h += htmlFlash();
    if (S.vue === 'nouveau') h += htmlNouveau();
    if (!S.charge && !S.erreur) return h + '<div class="dz-vide"><p>Vos dossiers arrivent…</p></div>';
    if (S.erreur) return h + '<div class="dz-vide"><p>Vos dossiers ne se sont pas affichés.</p><p>Réessayez dans un instant.</p><button type="button" class="dz-btn plein" data-dz="reessayer">Réessayer</button></div>';
    if (!phs.length) return h + (S.vue === 'nouveau' ? '' : '<div class="dz-vide"><p>Vous n’avez pas encore de dossier.</p><p>Créez-en un pour suivre un projet, étape par étape.</p><button type="button" class="dz-btn plein" data-dz="nouveau">Nouveau dossier</button></div>');
    if (S.vue !== 'nouveau') h += htmlSemaine(phs);
    if (g.av.length) h += groupe('Ils avancent', D.pl(g.av.length, 'pharmacie', 'pharmacies'), g.av.map(carte).join(''));
    if (g.dem.length) h += groupe('À démarrer', D.pl(g.dem.length, 'pharmacie', 'pharmacies'), g.dem.map(carte).join(''));
    if (g.fin.length) h += repli('Terminés', D.pl(g.fin.length, 'pharmacie', 'pharmacies'), g.fin.map(carte).join(''));
    if (g.att.length) h += repli('En pause ou perdus', D.pl(g.att.length, 'pharmacie', 'pharmacies'), g.att.map(carte).join(''));
    return h;
  }
  function htmlFlash() { return S.flash ? '<p class="dz-flash' + (S.flashErr ? ' dz-err' : '') + '" role="status">' + esc(S.flash) + '</p>' : ''; }

  /* ── formulaires (nouveau dossier, ajout d'un volet, modification des détails) ── */
  function champTexte(m, k, libelle, valeur, o) {
    o = o || {};
    return '<div class="dz-champ"' + (o.si ? ' data-si="' + o.si + '"' : '') + '><label for="dz-' + m + '-' + k + '">' + libelle + '</label><input id="dz-' + m + '-' + k + '" type="' + (o.type || 'text') + '"' + (o.type === 'number' ? ' inputmode="numeric" min="0" step="1"' : '') +
      ' data-m="' + m + '" data-k="' + k + '" value="' + esc(valeur == null ? '' : valeur) + '" maxlength="200" autocomplete="off"' + dis() + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + '></div>';
  }
  /* Les détails d'une sorte. F = l'objet du formulaire (à plat). */
  function htmlDetails(m, sorte, F) {
    if (sorte === 'riedl') {
      return '<label class="dz-case"><input type="checkbox" data-m="' + m + '" data-k="remplace"' + (F.remplace ? ' checked' : '') + dis() + '>C’est le remplacement d’un robot</label>' +
        '<div data-si="remplace"' + (F.remplace ? '' : ' hidden') + '>' + champTexte(m, 'remplacement', 'Marque du robot à remplacer', F.remplacement, { ph: 'Par exemple : Omnicell' }) + '</div>';
    }
    if (sorte === 'transfert') {
      return '<p class="dz-note-p">Facultatif : si deux officines se regroupent.</p><div class="dz-champs">' +
        champTexte(m, 'regroupement', 'Seconde officine', F.regroupement, { ph: 'Pharmacie …' }) + champTexte(m, 'regroupementVille', 'Sa ville', F.regroupementVille) + '</div>';
    }
    if (sorte === 'pda') {
      return '<p class="dz-note-p">Facultatif : les EHPAD servis et le nombre de résidents.</p><div class="dz-champs">' +
        champTexte(m, 'ehpad', 'Nombre d’EHPAD', F.ehpad, { type: 'number' }) + champTexte(m, 'residents', 'Nombre de résidents', F.residents, { type: 'number' }) + '</div>';
    }
    return '';
  }
  var AIDE_SORTE = { transfert: 'Déménager l’officine', agencement: 'Refaire l’agencement', riedl: 'Robot de la pharmacie', pda: 'Préparation des doses (EHPAD)' };
  function htmlChoixSorte(m, sortes, courante) {
    return '<div class="dz-choix" role="group" aria-label="Sorte de projet">' + sortes.map(function (s) {
      return '<button type="button" class="dz-sorte" data-dz="sorte" data-m="' + m + '" data-s="' + s + '" aria-pressed="' + (courante === s) + '"' + dis() + '>' + esc(D.SORTES[s].nom) + '<small>' + esc(AIDE_SORTE[s]) + '</small></button>';
    }).join('') + '</div>';
  }
  function htmlPistes(F) {
    var l = D.pistesSansDossier(S.pistes, F.q), plus = l.length > 40 ? l.length - 40 : 0;
    if (!l.length) return '<li><p class="dz-vide-d">' + (F.q ? 'Aucune piste ne correspond.' : 'Toutes vos pistes ont déjà un dossier, ou aucune n’est ouverte.') + '</p></li>';
    return l.slice(0, 40).map(function (p) {
      return '<li><button type="button" class="dz-piste" data-dz="piste" data-id="' + esc(p.id) + '" aria-pressed="' + (F.pisteId === p.id) + '"><b>' + esc(p.nom) + '</b><small>' +
        esc([p.ville, p.pharmacien].filter(Boolean).join(' · ')) + '</small></button></li>';
    }).join('') + (plus ? '<li><p class="dz-vide-d">' + plus + ' autres : précisez votre recherche.</p></li>' : '');
  }
  function htmlNouveau() {
    var F = S.nouveau, h = '<section class="dz-panneau" aria-label="Nouveau dossier"><h2>Nouveau dossier</h2>';
    h += '<h3>1. La pharmacie</h3>';
    if (F.source === 'piste') {
      h += '<div class="dz-champ"><label for="dz-nouveau-q">Chercher dans vos pistes (nom ou ville)</label><input id="dz-nouveau-q" type="search" data-m="nouveau" data-k="q" value="' + esc(F.q) + '" autocomplete="off"' + dis() + '></div>' +
        '<ul class="dz-pistes" id="dz-pistes">' + htmlPistes(F) + '</ul>' +
        '<p class="dz-ou">ou</p><div><button type="button" class="dz-btn petit" data-dz="hors"' + dis() + '>Une pharmacie hors de vos pistes</button></div>';
    } else {
      h += '<div class="dz-champs">' + champTexte('nouveau', 'nom', 'Nom de la pharmacie (obligatoire)', F.nom) + champTexte('nouveau', 'ville', 'Ville', F.ville) + '</div>' +
        champTexte('nouveau', 'titulaire', 'Titulaire', F.titulaire) +
        '<div><button type="button" class="dz-btn petit" data-dz="dans-pistes"' + dis() + '>Choisir plutôt une de vos pistes</button></div>';
    }
    h += '<h3>2. Le premier volet</h3>' + htmlChoixSorte('nouveau', D.ORDRE, F.sorte);
    if (F.sorte) h += '<div class="dz-champ-d">' + htmlDetails('nouveau', F.sorte, F) + '</div>';
    h += '<p class="dz-erreur" role="alert">' + esc(F.erreur || '') + '</p>';
    h += '<div class="dz-act"><button type="button" class="dz-btn plein" data-dz="creer"' + dis() + '>' + ico('coche', 18) + 'Créer le dossier</button><button type="button" class="dz-btn" data-dz="annuler-nouveau"' + dis() + '>Annuler</button></div></section>';
    return h;
  }
  function htmlAjout(ph) {
    var F = S.ajout, sortes = D.sortesAbsentes(ph.volets);
    if (!sortes.length) return '';
    var h = '<section class="dz-panneau" aria-label="Ajouter un volet" style="margin-top:18px"><h2>Ajouter un volet</h2><p>Une autre sorte de projet pour cette pharmacie.</p>' + htmlChoixSorte('ajout', sortes, F.sorte);
    if (F.sorte) h += htmlDetails('ajout', F.sorte, F);
    h += '<p class="dz-erreur" role="alert">' + esc(F.erreur || '') + '</p><div class="dz-act"><button type="button" class="dz-btn plein" data-dz="ajout-ok"' + dis() + '>Ajouter le volet</button><button type="button" class="dz-btn" data-dz="ajout-non"' + dis() + '>Annuler</button></div></section>';
    return h;
  }

  /* ── affichage : la fiche ── */
  function friseFiche(v) {
    var pr = D.prochaineEtape(v), h = '<ol class="dz-frise" aria-label="Les étapes du volet">';
    v.etapes.forEach(function (e, i) {
      var cl = (e.faite ? 'f' : '') + (pr === e && v.etat === 'cours' ? ' c' : '') + (i === S.ouv ? ' ouv' : '');
      h += '<li class="' + cl + '"><button type="button" data-dz="etape-voir" data-i="' + i + '" aria-label="Étape ' + e.n + ' : ' + esc(e.t) + '"' + (i === S.ouv ? ' aria-current="step"' : '') + '><span class="dz-rond">' + (e.faite ? ico('coche', 20) : e.n) + '</span><span class="dz-lab">' + esc(e.c) + '</span></button></li>';
    });
    return h + '</ol>';
  }
  function carteProchaine(v) {
    var pr = D.prochaineEtape(v), volet = ' · volet ' + esc(v.nom);
    if (!pr) return '<div class="dz-prochaine"><div><p class="dz-kicker">Volet terminé' + volet + '</p><h2>Les ' + v.etapes.length + ' étapes sont faites</h2>' + (D.termineLe(v) ? '<p>Terminé le ' + esc(D.long(D.termineLe(v))) + '.</p>' : '') + '</div></div>';
    var dl = D.ligneDate(pr, auj());
    return '<div class="dz-prochaine"><div><p class="dz-kicker">Prochaine chose à faire' + volet + '</p><h2>' + esc(pr.t) + '</h2><p class="' + (dl.retard ? 'ret' : '') + '">Étape ' + pr.n + ' sur ' + v.etapes.length + ' · ' + esc(dl.texte) + '</p></div>' +
      '<button class="dz-btn plein" type="button" data-dz="etape-voir" data-i="' + (pr.n - 1) + '">Voir l’étape ' + ico('fleche', 18) + '</button></div>';
  }
  function htmlDocs(v, e, i) {
    var h = '<div id="dz-docs-' + i + '"><p class="dz-kicker" style="margin:0 0 8px">Documents</p>';
    if (!e.docs.length) h += '<p class="dz-vide-d">Aucun document pour l’instant.</p>';
    else {
      h += '<ul class="dz-docs">' + e.docs.map(function (x) {
        var url = S.urls[x.chemin] && S.urls[x.chemin].url, conf = S.retirer && S.retirer.i === i && S.retirer.chemin === x.chemin;
        var nom = url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + ico('doc', 18) + esc(x.nom) + '<span class="dz-sr"> (s’ouvre dans un nouvel onglet)</span></a>' : ico('doc', 18) + esc(x.nom);
        return '<li>' + nom + (x.taille ? '<small>' + esc(D.tailleLisible(x.taille)) + '</small>' : '') +
          (conf ? '<span class="dz-confirme">Retirer ce document ? <button type="button" class="dz-lien" data-dz="doc-oui"' + dis() + '>Oui</button><button type="button" class="dz-lien" data-dz="doc-non"' + dis() + '>Non</button></span>'
            : '<button type="button" class="dz-lien" data-dz="doc-retirer" data-i="' + i + '" data-c="' + esc(x.chemin) + '"' + dis() + '>Retirer</button>') + '</li>';
      }).join('') + '</ul>';
    }
    return h + '</div>';
  }
  function htmlEtape(v, e, i) {
    var pr = D.prochaineEtape(v), open = i === S.ouv, a = auj();
    var dl = e.faite ? { texte: 'Faite le ' + D.court(e.faite), retard: false } : D.ligneDate(e, a), r = D.retard(e, a);
    var key = cleBrouillon(v, e), mention = S.mentions[key];
    var h = '<li class="dz-et-l' + (open ? ' ouvert' : '') + (e.faite ? ' f-ok' : '') + (pr === e ? ' prochain-l' : '') + '"><button class="dz-et-h" type="button" data-dz="etape" data-i="' + i + '" data-f="et-' + i + '" aria-expanded="' + open + '" aria-controls="dz-ec-' + i + '">' +
      '<span class="dz-et-n">' + (e.faite ? ico('coche', 18) : e.n) + '</span><span class="dz-et-t">' + esc(e.t) + (e.facultative ? '<small>Étape facultative : remplacement d’un robot</small>' : '') + '</span>' +
      '<span class="dz-et-d' + (dl.retard ? ' ret' : '') + '">' + esc(dl.retard ? 'En retard de ' + D.pl(r, 'jour', 'jours') : dl.texte) + '</span><i class="dz-chev"></i></button>';
    if (open) {
      h += '<div class="dz-et-c" id="dz-ec-' + i + '">';
      if (e.facultative) h += '<p class="dz-facult">Cette étape n’est là que parce que le volet indique « Remplacement d’un robot » (' + esc(D.remplacementDe(v.details)) + '). Sans remplacement, le volet compte une étape de moins.</p>';
      h += '<dl class="dz-dates"><div><dt><label for="dz-p-' + i + '">Date prévue</label></dt><dd class="' + (dl.retard ? 'ret' : '') + '"><input id="dz-p-' + i + '" type="date" data-prevue="' + i + '" value="' + esc(e.prevue || '') + '"' + dis() + '>' + (dl.retard ? '<small> En retard</small>' : '') + '</dd></div>' +
        '<div><dt>' + (e.faite ? '<label for="dz-fd-' + i + '">Date faite</label>' : 'Date faite') + '</dt><dd>' + (e.faite ? '<input id="dz-fd-' + i + '" type="date" data-fdate="' + i + '" value="' + esc(e.faite) + '"' + dis() + '>' : 'Pas encore') + '</dd></div></dl>';
      var notes = S.brouillons[key] != null ? S.brouillons[key] : e.notes;
      h += '<div class="dz-champ"><label for="dz-nt-' + i + '">Notes</label><textarea id="dz-nt-' + i + '" data-notes="' + i + '" maxlength="8000" placeholder="Ajouter une note sur cette étape">' + esc(notes) + '</textarea>' +
        '<p class="dz-mention' + (mention && mention.err ? ' err' : '') + '" id="dz-mn-' + i + '" role="status">' + esc(mention ? mention.t : '') + '</p></div>';
      h += htmlDocs(v, e, i);
      h += '<div class="dz-act"><label class="dz-btn petit" for="dz-fi-' + i + '">' + ico('plus', 18) + 'Ajouter un document<input class="dz-sr" id="dz-fi-' + i + '" type="file" data-fichier="' + i + '"' + dis() + '></label></div>' +
        '<p class="dz-note-p">25 Mo au plus par fichier.</p>';
      var bloc = e.k === 'travaux' && CH && CH.aUnChantier(v.sorte), chv = bloc ? chantierDe(v) : null;
      if (bloc) h += htmlBlocChantier(v, e, chv);
      h += '<div class="dz-act">' + (e.faite ? '<button class="dz-btn" type="button" disabled>Étape faite</button><button class="dz-lien" type="button" data-dz="defaire" data-i="' + i + '"' + dis() + '>Remettre à faire</button>'
        : '<button class="dz-btn' + (bloc && !(chv && chv.recuLe) ? '' : ' plein') + '" type="button" data-dz="fait" data-i="' + i + '"' + dis() + '>' + ico('coche', 18) + 'Marquer comme faite</button>');
      var adr = v.sorte === 'agencement' && e.k === 'plan3d' ? D.adresse3D(window.V2_BRAND && window.V2_BRAND.ancienne3d, S.dossierId) : '';
      if (adr) h += '<a class="dz-btn" href="' + esc(adr) + '" target="_blank" rel="noopener noreferrer">Ouvrir la 3D<span class="dz-sr"> (s’ouvre dans un nouvel onglet)</span></a>';
      h += '</div></div>';
    }
    return h + '</li>';
  }
  /* ── le bloc « Le chantier » de l'étape Travaux (Agencement et Transfert seulement, choix de Will du 23/11) ── */
  function chantierDe(v) {
    var ch = S.chantiers.filter(function (c) { return c.volet_id === v.id; })[0];
    return ch ? CH.monterChantier(ch, S.chArtisans, S.chTaches) : null;
  }
  function htmlBlocChantier(v, e, c) {
    if (S.chErreur) return '<div class="cz-bloc"><p class="dz-kicker">Le chantier</p><p>Le chantier ne s’est pas affiché. Réessayez dans un instant.</p></div>';
    if (!c) {
      return '<div class="cz-bloc vide"><p class="dz-kicker">Le chantier</p><p>Aucun chantier n’est ouvert pour ce volet. Ouvrez-le ici pour suivre les tâches, les artisans, les photos et la date d’ouverture promise au pharmacien.</p>' +
        '<div class="dz-champ"><label for="dz-ouv-d">Date d’ouverture promise au pharmacien</label><input type="date" id="dz-ouv-d" data-ouv-d value="' + esc(S.ouvDate != null ? S.ouvDate : (e.prevue || '')) + '"' + dis() + '></div>' +
        '<label class="dz-case"><input type="checkbox" id="dz-ouv-dep" data-ouv-dep' + (S.ouvDepart === false ? '' : ' checked') + dis() + '><span>Commencer avec les ' + CH.DEPART.length + ' tâches habituelles (dépose, électricité, sol, peinture, mobilier, enseigne, nettoyage), à modifier ensuite</span></label>' +
        '<p class="dz-erreur" role="alert">' + esc(S.ouvErr || '') + '</p>' +
        '<div class="dz-act"><button class="dz-btn plein" type="button" data-dz="ouvrir-ch" data-f="ouvrir-ch"' + dis() + '>Ouvrir le chantier</button></div></div>';
    }
    var r = CH.resume(c, auj());
    return '<div class="cz-bloc"><div class="cz-bloc-t"><p class="dz-kicker">Le chantier</p><span class="dz-et ' + r.etat.ton + '">' + esc(r.etat.texte) + '</span></div>' +
      '<p><b>' + esc(r.avancee) + '</b> · ' + esc(r.ouverture) + '</p>' + (r.prochaine ? '<p class="cz-pet">' + esc(r.prochaine) + '</p>' : '') +
      (S.chOuvert[v.id] ? '<p class="cz-pet ok">Chantier ouvert à l’instant. Il apparaît aussi dans l’écran Chantiers.</p>' : '') +
      '<div class="dz-act"><button class="dz-btn plein" type="button" data-dz="voir-ch" data-id="' + esc(c.id) + '" data-f="voir-ch">Voir le chantier ' + ico('fleche', 18) + '</button></div></div>';
  }
  function ouvrirChantier() {
    var v = voletCourant(), base = sb(), u = V2.user; if (!v || !base || !u || !CH || !CH.aUnChantier(v.sorte) || chantierDe(v)) return;
    var champ = S.racine && S.racine.querySelector('[data-ouv-d]'), d = champ ? champ.value : (S.ouvDate || '');
    var dep = S.racine && S.racine.querySelector('[data-ouv-dep]'), depart = dep ? dep.checked : S.ouvDepart !== false;
    S.ouvDate = d; S.ouvDepart = depart;
    if (!D.estJour(d)) { S.ouvErr = 'Choisissez la date d’ouverture promise au pharmacien.'; dessiner(); var n = S.racine.querySelector('[data-ouv-d]'); if (n) { n.setAttribute('aria-invalid', 'true'); n.focus(); } return; }
    S.ouvErr = '';
    return geste(function () {
      return base.from('chantiers').insert({ volet_id: v.id, user_id: u.id, ouverture: d, debut: auj() }).select().single().then(function (r) {
        if (r.error || !r.data) throw new Error('chantier');
        S.chantiers.push(r.data); S.chOuvert[v.id] = true; S.ouvDate = null; S.ouvDepart = null;
        if (!depart) { dire('Chantier ouvert. Ajoutez les tâches et les artisans dans l’écran Chantiers.', false); return; }
        return base.from('chantier_taches').insert(CH.tachesDepart(r.data.id, u.id)).select().then(function (t) {
          if (t.error || !t.data) { dire('Le chantier est ouvert, mais les tâches habituelles n’ont pas pu être ajoutées : ajoutez-les dans « Les tâches ».', true); return; }
          S.chTaches = S.chTaches.concat(t.data);
          dire('Chantier ouvert avec les ' + t.data.length + ' tâches habituelles.', false);
        });
      });
    });
  }
  function htmlRdv(p) {
    var h = '<div class="dz-cote-c" id="dz-rdv"><h3>Prochain rendez-vous</h3>';
    if (!p) h += '<p>Aucun rendez-vous prévu dans l’agenda.</p>';
    else if (S.rdvErreur) h += '<p>L’agenda ne répond pas pour l’instant.</p>';
    else if (S.rdvs == null) h += '<p>Lecture de l’agenda…</p>';
    else {
      var r = D.prochainRdv(S.rdvs, p.id, D.maintenant());
      h += r ? '<p><b>' + esc(D.quandRdv(r)) + '</b></p>' + (r.objet || r.lieu ? '<p class="pet">' + esc([r.objet, r.lieu].filter(Boolean).join(' · ')) + '</p>' : '') : '<p>Aucun rendez-vous prévu dans l’agenda.</p>';
    }
    return h + '<button type="button" class="dz-lien" data-vers="agenda">Ouvrir l’agenda ' + ico('fleche', 16) + '</button></div>';
  }
  function htmlEtat(v) {
    var h, e = D.etatAffiche(v, auj()), n = D.nbFaites(v);
    if (v.etat === 'pause') h = '<div class="dz-cote-c pause"><h3>État : en pause</h3><p><b>En pause depuis le ' + esc(D.court(v.depuis)) + '.</b></p><p>Raison : ' + esc(v.raison) + '</p>';
    else if (v.etat === 'perdu') h = '<div class="dz-cote-c perdu"><h3>État : perdu</h3><p><b>Perdu le ' + esc(D.court(v.depuis)) + '.</b></p><p>Raison : ' + esc(v.raison) + '</p>';
    else if (e === 'termine') h = '<div class="dz-cote-c"><h3>État : terminé</h3><p><b>Terminé le ' + esc(D.court(D.termineLe(v))) + '.</b></p>';
    else h = '<div class="dz-cote-c"><h3>État : en cours</h3><p><b>' + n + ' étape' + (n > 1 ? 's' : '') + ' faite' + (n > 1 ? 's' : '') + ' sur ' + v.etapes.length + '.</b></p>' + (v.ouvert ? '<p class="pet">Volet ouvert le ' + esc(D.court(v.ouvert)) + '.</p>' : '');
    if (S.etatForm && e !== 'termine') {
      h += '<div class="dz-champ"><label for="dz-raison">Raison (obligatoire)</label><textarea id="dz-raison" data-raison maxlength="500">' + esc(S.raison) + '</textarea></div><p class="dz-erreur" role="alert">' + esc(S.raisonErr) + '</p>' +
        '<div class="dz-act"><button type="button" class="dz-btn plein" data-dz="etat-ok"' + dis() + '>' + (S.etatForm === 'pause' ? 'Confirmer la pause' : 'Confirmer : perdu') + '</button><button type="button" class="dz-btn" data-dz="etat-non"' + dis() + '>Annuler</button></div>';
    } else if (e !== 'termine') {
      h += '<div class="dz-act">';
      if (v.etat !== 'cours') h += '<button type="button" class="dz-btn" data-dz="reprendre"' + dis() + '>Reprendre</button>';
      if (v.etat !== 'pause' && v.etat !== 'perdu') h += '<button type="button" class="dz-btn" data-dz="forme-pause"' + dis() + '>Mettre en pause</button>';
      if (v.etat !== 'perdu') h += '<button type="button" class="dz-btn" data-dz="forme-perdu"' + dis() + '>Marquer comme perdu</button>';
      h += '</div>';
    }
    return h + '</div>';
  }
  function htmlCote(v, ph) {
    var p = pisteDe(ph.dossier.id), h = '<aside class="dz-cote" aria-label="Autour du dossier">';
    h += '<div class="dz-cote-c"><h3>Piste d’origine</h3>' + (p ? '<p>Piste ouverte le ' + esc(D.long(D.jourDeHorodatage(p.created_at))) + '.</p><button type="button" class="dz-lien" data-vers="appels">Voir sa fiche dans Appels ' + ico('fleche', 16) + '</button>'
      : '<p>Ce dossier n’a pas été créé à partir d’une piste.</p>') + '</div>';
    h += htmlRdv(p) + htmlEtat(v);
    return h + '</aside>';
  }
  function htmlModif(v) {
    var F = S.modif;
    return '<div class="dz-modif">' + htmlDetails('modif', v.sorte, F) + '<p class="dz-erreur" role="alert">' + esc(F.erreur || '') + '</p><div class="dz-act"><button type="button" class="dz-btn plein" data-dz="modif-ok"' + dis() + '>Enregistrer</button><button type="button" class="dz-btn" data-dz="modif-non"' + dis() + '>Annuler</button></div></div>';
  }
  function htmlFiche() {
    if (!S.charge && !S.erreur) return '<div class="dz-vide"><p>Votre dossier arrive…</p></div>';
    if (S.erreur) return '<div class="dz-vide"><p>Ce dossier ne s’est pas affiché.</p><p>Réessayez dans un instant.</p><button type="button" class="dz-btn plein" data-dz="reessayer">Réessayer</button> <button type="button" class="dz-btn" data-dz="liste">Tous les dossiers</button></div>';
    var ph = phCourant();
    if (!ph) return '<div class="dz-vide"><p>Ce dossier n’existe pas ou n’est plus à votre compte.</p><button type="button" class="dz-btn plein" data-dz="liste">Tous les dossiers</button></div>';
    var v = voletCourant(), vs = ph.volets, inf = infoPharmacie(ph), p = inf.piste, d = ph.dossier;
    var adr = p ? [p.cp, p.ville].filter(Boolean).join(' ') : (d.ville || '');
    var contact = [esc(adr), esc(d.titulaire || (p && p.pharmacien) || ''), p && p.telephone ? '<a href="tel:' + esc(String(p.telephone).replace(/[^\d+]/g, '')) + '">' + esc(D.telLisible(p.telephone)) + '</a>' : ''].filter(Boolean).join(' · ');
    var h = '<div class="dz-fil-ar"><button type="button" class="dz-lien" data-dz="liste">' + ico('retour', 16) + 'Tous les dossiers</button></div>';
    h += '<div class="dz-fiche-t dz-tete" style="margin-bottom:0"><div class="dz-tete-g"><p class="dz-kicker">Dossier de la pharmacie · ' + (vs.length ? D.pl(vs.length, 'volet', 'volets') : 'aucun volet') + '</p><h1>' + esc(d.nom) + '</h1>' +
      (contact ? '<p class="dz-sous-l">' + contact + '</p>' : '');
    vs.forEach(function (x) { D.detailsVolet(x).forEach(function (l) { if (l.cle === 'regroupement') h += '<p class="dz-aff"><span>Volet Transfert :</span> <span>' + segs(l) + '</span></p>'; }); });
    h += '<div class="dz-ong" role="tablist" aria-label="Volets du dossier">' + vs.map(function (x) {
      return '<button type="button" role="tab" class="' + (D.actif(x) ? '' : 'off') + '" aria-selected="' + (v === x || (v && x.sorte === v.sorte)) + '" data-dz="volet" data-s="' + x.sorte + '" data-f="tab-' + x.sorte + '">' + esc(x.nom) + ' <span>' + D.nbFaites(x) + '/' + x.etapes.length + '</span></button>';
    }).join('') + (D.sortesAbsentes(vs).length ? '<button type="button" class="dz-ajout" data-dz="ajout" data-f="ajout"' + dis() + '>' + ico('plus', 18) + 'Ajouter un volet</button>' : '') + '</div></div></div>';
    h += htmlFlash();
    if (S.ajout) h += htmlAjout(ph);
    if (!v) return h + '<div class="dz-vide" style="margin-top:18px"><p>Ce dossier n’a pas encore de volet.</p><p>Ajoutez la première sorte de projet avec « Ajouter un volet ».</p></div>';
    h += '<div role="tabpanel" aria-label="Volet ' + esc(v.nom) + '">';
    var dd = D.detailsVolet(v).filter(function (l) { return l.cle !== 'regroupement'; });
    var geste = D.gesteDetails(v.sorte, v.details);
    if (dd.length || geste) {
      h += '<div class="dz-aff" style="margin:14px 0 16px">' + dd.map(segs).join(' · ') + (geste ? ' <button type="button" class="dz-lien" data-dz="modif"' + dis() + '>' + esc(geste) + '</button>' : '') + '</div>';
      if (S.modif) h += htmlModif(v);
    }
    h += htmlChaine(ph);
    h += '<section class="dz-hero" aria-label="Avancée du volet">' + friseFiche(v) + carteProchaine(v) + '</section>';
    h += '<div class="dz-corps"><div><ol class="dz-etapes">' + v.etapes.map(function (e, i) { return htmlEtape(v, e, i); }).join('') + '</ol></div>' + htmlCote(v, ph) + '</div></div>';
    return h;
  }

  /* ── dessin ── */
  function reservee() {
    return '<section class="pa pa-attente" aria-label="Dossiers de projet">' + X.tete('Dossiers de projet', 'Chaque agencement, du premier relevé à la réception.') +
      '<div class="pa-vide"><p>Cet écran est réservé à Yann. Vos outils sont les Appels, l’Agenda et la Veille.</p><div class="pa-bs">' +
      '<button type="button" class="lg-gros" data-vers="appels">Ouvrir mes Appels</button><button type="button" class="pa-b" data-vers="agenda">Ouvrir l’Agenda</button></div></div></section>';
  }
  function dessiner() {
    var r = S.racine; if (!r || !V2.route || V2.route.name !== 'dossiers') return;
    var act = document.activeElement, cle = act && act.getAttribute ? act.getAttribute('data-f') : null;
    if (S.telepro) { r.innerHTML = X.cadre(reservee()); return; }
    if (!S.roleConnu) { r.innerHTML = X.cadre('<section class="pa dz" aria-label="Dossiers de projet"><div class="dz-vide"><p>Un instant…</p></div></section>'); return; }
    r.innerHTML = X.cadre('<section class="pa dz" aria-label="Dossiers de projet">' + (S.vue === 'fiche' ? htmlFiche() : htmlListe()) + '</section>');
    if (cle) { var n = r.querySelector('[data-f="' + cle + '"]'); if (n && n.focus) try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
    if (S.vue === 'fiche' && S.charge) { lireUrls(); chargerRdv(); }
  }
  /* Mises à jour ciblées (jamais de redessin pendant une frappe) */
  function majDocs(i) {
    var v = voletCourant(), e = v && v.etapes[i], n = document.getElementById('dz-docs-' + i);
    if (!e || !n) return;
    var t = document.createElement('div'); t.innerHTML = htmlDocs(v, e, i); n.replaceWith(t.firstChild);
  }
  function majRdv() {
    var ph = phCourant(), n = document.getElementById('dz-rdv'); if (!ph || !n) return;
    var t = document.createElement('div'); t.innerHTML = htmlRdv(pisteDe(ph.dossier.id)); n.replaceWith(t.firstChild);
  }
  function mention(i, key, t, err) {
    S.mentions[key] = { t: t, err: !!err };
    var n = document.getElementById('dz-mn-' + i); if (n) { n.textContent = t; n.className = 'dz-mention' + (err ? ' err' : ''); }
  }
  /* Liens de téléchargement de l'étape ouverte : demandés au moment de l'ouvrir, valables 10 minutes */
  function lireUrls() {
    var v = voletCourant(), base = sb(); if (!v || !base || S.ouv < 0 || !v.etapes[S.ouv]) return;
    var i = S.ouv, maintenant = Date.now();
    var manque = v.etapes[i].docs.map(function (x) { return x.chemin; }).filter(function (c) { return c && !(S.urls[c] && maintenant - S.urls[c].at < 540000); });
    if (!manque.length) return;
    base.storage.from('dossiers').createSignedUrls(manque, 600).then(function (r) {
      if (r.error || !r.data) throw new Error('liens');
      r.data.forEach(function (x) { if (x.signedUrl && x.path) S.urls[x.path] = { url: x.signedUrl, at: Date.now() }; });
      majDocs(i);
    }, function () {}).then(null, function () {});
  }
  function chargerRdv() {
    var ph = phCourant(), RDV = window.PHIRST_RDV, base = sb();
    if (!ph || !pisteDe(ph.dossier.id) || S.rdvs != null || S.rdvEnCours || !RDV || !base || !S.ws) { if (ph && pisteDe(ph.dossier.id) && S.rdvs == null && !S.rdvEnCours && (!RDV || !S.ws)) { S.rdvErreur = true; majRdv(); } return; }
    S.rdvEnCours = true;
    RDV.lire(base, S.ws).then(function (x) { S.rdvs = x.rdvs || []; S.rdvErreur = false; }, function () { S.rdvErreur = true; })
      .then(function () { S.rdvEnCours = false; majRdv(); });
  }

  /* ── écritures ── */
  function geste(fn) {
    if (S.occupe) return Promise.resolve();
    S.occupe = true; S.flash = ''; dessiner();
    return Promise.resolve().then(fn).then(null, function (e) { dire(e && e.message && e.dit ? e.message : PAS, true); })
      .then(function () { S.occupe = false; dessiner(); });
  }
  function echec(m) { var e = new Error(m); e.dit = true; return e; }
  function remplacer(liste, ligne) {
    var i = -1; liste.forEach(function (x, k) { if (x.id === ligne.id) i = k; });
    if (i >= 0) liste[i] = ligne; else liste.push(ligne);
  }
  function ecrireEtape(v, cle, champs) {
    var base = sb(), ligne = { volet_id: v.id, cle: cle, updated_at: new Date().toISOString() };
    Object.keys(champs).forEach(function (k) { ligne[k] = champs[k]; });
    return base.from('dossier_etapes').upsert(ligne, { onConflict: 'volet_id,cle' }).select().single().then(function (r) {
      if (r.error || !r.data) throw new Error('etape');
      remplacer(S.etapes, r.data); return r.data;
    });
  }
  function ecrireVolet(v, champs) {
    var base = sb(), ligne = { updated_at: new Date().toISOString() };
    Object.keys(champs).forEach(function (k) { ligne[k] = champs[k]; });
    return base.from('dossier_volets').update(ligne).eq('id', v.id).select().single().then(function (r) {
      if (r.error || !r.data) throw new Error('volet');
      remplacer(S.volets, r.data); return r.data;
    });
  }
  function sauverNotes(i) {
    var v = voletCourant(), e = v && v.etapes[i]; if (!e) return;
    var key = cleBrouillon(v, e), texte = S.brouillons[key];
    clearTimeout(S.timers[key]); delete S.timers[key];
    if (texte == null) return;
    if (texte === e.notes) { delete S.brouillons[key]; return; }
    var c = D.verifierNotes(texte); if (!c.ok) { mention(i, key, c.erreur, true); return; }
    S.chaine[key] = (S.chaine[key] || Promise.resolve()).then(function () {
      return ecrireEtape(v, e.k, { notes: texte }).then(function () {
        if (S.brouillons[key] === texte) delete S.brouillons[key];
        mention(i, key, 'Enregistré', false);
      }, function () { mention(i, key, PAS, true); });
    });
  }
  function marquer(i, faite) {
    var v = voletCourant(), e = v && v.etapes[i]; if (!v || !e) return;
    return geste(function () {
      return ecrireEtape(v, e.k, { faite: faite }).then(function () {
        var v2 = voletCourant(); S.ouv = indexProchaine(v2);
        dire(faite ? 'Étape marquée comme faite.' : 'Étape remise à faire.', false);
      });
    });
  }
  function changerDate(i, champ, val) {
    var v = voletCourant(), e = v && v.etapes[i]; if (!v || !e) return;
    if (val && !D.estJour(val)) return;
    if (champ === 'faite' && !val) { dire('Pour défaire une étape, utilisez « Remettre à faire ».', true); dessiner(); return; }
    var o = {}; o[champ] = val || null;
    return geste(function () { return ecrireEtape(v, e.k, o).then(function () { dire(champ === 'prevue' ? 'Date prévue enregistrée.' : 'Date faite enregistrée.', false); }); });
  }
  function envoyer(i, file) {
    var v = voletCourant(), e = v && v.etapes[i], base = sb(), u = V2.user; if (!v || !e || !base || !u) return;
    var key = cleBrouillon(v, e), m = D.verifierFichier(file, e.docs.length);
    if (m) { mention(i, key, m, true); return; }
    return geste(function () {
      var chemin = D.cheminDocument(u.id, S.dossierId, v.sorte, e.k, file.name, Date.now());
      return base.storage.from('dossiers').upload(chemin, file, { contentType: file.type || 'application/octet-stream', upsert: false }).then(function (r) {
        if (r.error) throw new Error('envoi');
        var doc = D.nouveauDoc(file.name, chemin, file.size, D.aujourdhui());
        return ecrireEtape(v, e.k, { docs: e.docs.concat([doc]) }).then(null, function (err) { try { base.storage.from('dossiers').remove([chemin]); } catch (x) {} throw err; });
      }).then(function () { dire('Document ajouté : ' + file.name + '.', false); });
    });
  }
  function retirerDoc() {
    var r = S.retirer, v = voletCourant(), e = v && v.etapes[r.i], base = sb(); if (!e) return;
    return geste(function () {
      var reste = e.docs.filter(function (x) { return x.chemin !== r.chemin; });
      return ecrireEtape(v, e.k, { docs: reste }).then(function () {
        S.retirer = null; dire('Document retiré.', false);
        try { base.storage.from('dossiers').remove([r.chemin]); } catch (x) {}
      });
    });
  }
  function changerEtat(etat) {
    var v = voletCourant(); if (!v) return;
    if (etat === 'cours') return geste(function () { return ecrireVolet(v, { etat: 'cours', raison: null, depuis: null }).then(function () { dire('Volet repris.', false); }); });
    var c = D.verifierRaison(S.raison);
    if (!c.ok) { S.raisonErr = c.erreur; dessiner(); return; }
    return geste(function () {
      return ecrireVolet(v, { etat: etat, raison: c.valeur, depuis: auj() }).then(function () { S.etatForm = null; S.raison = ''; S.raisonErr = ''; dire(etat === 'pause' ? 'Volet mis en pause.' : 'Volet marqué comme perdu.', false); });
    });
  }
  function ajouterVolet() {
    var F = S.ajout, ph = phCourant(), base = sb(); if (!F || !ph || !base) return;
    if (!F.sorte) { F.erreur = 'Choisissez la sorte du volet.'; dessiner(); return; }
    var det = D.verifierDetails(F.sorte, F); if (!det.ok) { F.erreur = det.erreur; dessiner(); return; }
    F.erreur = '';
    return geste(function () {
      return base.from('dossier_volets').insert({ dossier_id: ph.dossier.id, user_id: V2.user.id, sorte: F.sorte, details: det.details }).select().single().then(function (r) {
        if (r.error || !r.data) throw new Error('volet');
        S.volets.push(r.data); S.sorte = r.data.sorte; S.ajout = null; S.modif = null; S.etatForm = null;
        S.ouv = indexProchaine(voletCourant()); dire('Volet ajouté : ' + D.SORTES[r.data.sorte].nom + '.', false);
      });
    });
  }
  function modifierDetails() {
    var F = S.modif, v = voletCourant(); if (!F || !v) return;
    var det = D.verifierDetails(v.sorte, F); if (!det.ok) { F.erreur = det.erreur; dessiner(); return; }
    F.erreur = '';
    return geste(function () { return ecrireVolet(v, { details: det.details }).then(function () { S.modif = null; S.ouv = indexProchaine(voletCourant()); dire('Détails enregistrés.', false); }); });
  }
  function creer() {
    var F = S.nouveau, base = sb(), u = V2.user, piste = null, pharm; if (!F || !base || !u) return;
    if (F.source === 'piste') {
      piste = S.pistes.filter(function (p) { return p.id === F.pisteId; })[0];
      if (!piste) { F.erreur = 'Choisissez une piste, ou « Une pharmacie hors de vos pistes ».'; dessiner(); return; }
      pharm = D.pharmacieDePiste(piste);
      if (!pharm.nom) { F.erreur = 'Cette piste n’a pas de nom : choisissez « Une pharmacie hors de vos pistes ».'; dessiner(); return; }
    } else {
      var c = D.verifierPharmacie(F); if (!c.ok) { F.erreur = c.erreur; dessiner(); return; }
      pharm = c.valeur;
    }
    if (!F.sorte) { F.erreur = 'Choisissez la sorte du premier volet.'; dessiner(); return; }
    var det = D.verifierDetails(F.sorte, F); if (!det.ok) { F.erreur = det.erreur; dessiner(); return; }
    F.erreur = '';
    var dossier = null, dit = '';
    return geste(function () {
      return base.from('dossiers').insert({ user_id: u.id, nom: pharm.nom, ville: pharm.ville, titulaire: pharm.titulaire, statut: 'wip' }).select().single().then(function (r) {
        if (r.error || !r.data) throw new Error('dossier');
        dossier = r.data; S.dossiers.unshift(dossier);
        return base.from('dossier_volets').insert({ dossier_id: dossier.id, user_id: u.id, sorte: F.sorte, details: det.details }).select().single();
      }).then(function (r) {
        if (r.error || !r.data) { dit = 'Le dossier est créé, mais le premier volet n’a pas pu l’être : ajoutez-le avec « Ajouter un volet ».'; return null; }
        S.volets.push(r.data); return r.data;
      }).then(function (volet) {
        if (!piste) return volet;
        return base.from('crm_prospects').update({ dossier_id: dossier.id }).eq('id', piste.id).eq('workspace_id', S.ws).is('dossier_id', null).select('id').then(function (r) {
          if (r.error || !r.data || !r.data.length) dit = (dit ? dit + ' ' : '') + 'La piste n’a pas pu être reliée au dossier (elle l’est peut-être déjà à un autre).';
          else piste.dossier_id = dossier.id;
          return volet;
        });
      }).then(function (volet) {
        S.vue = 'fiche'; S.dossierId = dossier.id; S.sorte = volet ? volet.sorte : null; S.nouveau = null; S.ajout = null; S.modif = null; S.etatForm = null;
        S.ouv = volet ? indexProchaine(voletCourant()) : -1; S.rdvs = null; S.rdvErreur = false;
        dire(dit || 'Dossier créé.', !!dit);
        try { V2.route = { name: 'dossiers', param: dossier.id + (volet ? ':' + volet.sorte : '') }; location.hash = '#dossiers/' + encodeURIComponent(dossier.id + (volet ? ':' + volet.sorte : '')); } catch (e) {}
      }, function (err) {
        /* échec à la création du dossier lui-même : rien n'est resté d'à moitié affiché */
        if (dossier) S.dossiers = S.dossiers.filter(function (x) { return x.id !== dossier.id; });
        throw err;
      });
    });
  }

  /* ── gestes ── */
  function nouveauForm() { return { source: S.pistes.length ? 'piste' : 'hors', q: '', pisteId: null, nom: '', ville: '', titulaire: '', sorte: null, remplace: false, remplacement: '', regroupement: '', regroupementVille: '', ehpad: '', residents: '', erreur: '' }; }
  function formDe(v) {
    var d = v.details || {};
    return { remplace: !!D.remplacementDe(d), remplacement: D.remplacementDe(d), regroupement: d.regroupement || '', regroupementVille: d.regroupementVille || '', ehpad: d.ehpad != null ? String(d.ehpad) : '', residents: d.residents != null ? String(d.residents) : '', erreur: '' };
  }
  function choisirSorte(m, s) {
    var F = S[m]; if (!F) return;
    F.sorte = s; F.erreur = '';
    if (m === 'nouveau' && s === 'riedl' && !F.remplacement) {
      var p = F.source === 'piste' ? S.pistes.filter(function (x) { return x.id === F.pisteId; })[0] : null;
      if (p && p.robot_marque && String(p.robot_marque).trim()) { F.remplace = true; F.remplacement = String(p.robot_marque).trim().slice(0, 200); }
    }
    dessiner();
  }
  function ouvrirDossier(id, sorte) { S.flash = ''; V2.go('dossiers', sorte ? id + ':' + sorte : id); }
  function scrollerEtape() {
    var el = S.racine && S.racine.querySelector('.dz-et-l.ouvert');
    if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); } }
  }
  function clic(ev) {
    var vers = ev.target.closest('[data-vers]'); if (vers) { V2.go(vers.getAttribute('data-vers')); return; }
    var b = ev.target.closest('[data-dz]'); if (!b || b.disabled) return;
    var a = b.getAttribute('data-dz'), i = +b.getAttribute('data-i');
    if (a === 'reessayer') { charger(); return; }
    if (a === 'liste') { sauverNotes(S.ouv); V2.go('dossiers'); return; }
    if (a === 'ouvrir') { ouvrirDossier(b.getAttribute('data-id')); return; }
    if (a === 'nouveau') { S.nouveau = S.nouveau || nouveauForm(); S.vue = 'nouveau'; S.flash = ''; dessiner(); var q = S.racine.querySelector('.dz-panneau'); if (q && q.scrollIntoView) q.scrollIntoView({ block: 'nearest' }); return; }
    if (a === 'annuler-nouveau') { S.nouveau = null; S.vue = 'liste'; dessiner(); return; }
    if (a === 'hors') { S.nouveau.source = 'hors'; S.nouveau.erreur = ''; dessiner(); return; }
    if (a === 'dans-pistes') { S.nouveau.source = 'piste'; S.nouveau.erreur = ''; dessiner(); return; }
    if (a === 'piste') { S.nouveau.pisteId = b.getAttribute('data-id'); S.nouveau.erreur = ''; if (S.nouveau.sorte === 'riedl') choisirSorte('nouveau', 'riedl'); else dessiner(); return; }
    if (a === 'sorte') { choisirSorte(b.getAttribute('data-m'), b.getAttribute('data-s')); return; }
    if (a === 'creer') { creer(); return; }
    if (a === 'volet') { sauverNotes(S.ouv); S.sorte = b.getAttribute('data-s'); S.modif = null; S.etatForm = null; S.retirer = null; S.ouv = indexProchaine(voletCourant()); dessiner(); return; }
    if (a === 'ajout') { S.ajout = S.ajout ? null : { sorte: null, remplace: false, remplacement: '', regroupement: '', regroupementVille: '', ehpad: '', residents: '', erreur: '' }; dessiner(); return; }
    if (a === 'ajout-non') { S.ajout = null; dessiner(); return; }
    if (a === 'ajout-ok') { ajouterVolet(); return; }
    if (a === 'modif') { var v = voletCourant(); S.modif = S.modif ? null : (v ? formDe(v) : null); dessiner(); return; }
    if (a === 'modif-non') { S.modif = null; dessiner(); return; }
    if (a === 'modif-ok') { modifierDetails(); return; }
    if (a === 'etape') { sauverNotes(S.ouv); S.ouv = S.ouv === i ? -1 : i; S.retirer = null; dessiner(); return; }
    if (a === 'etape-voir') { sauverNotes(S.ouv); S.ouv = i; S.retirer = null; dessiner(); scrollerEtape(); return; }
    if (a === 'fait') { marquer(i, auj()); return; }
    if (a === 'defaire') { marquer(i, null); return; }
    if (a === 'doc-retirer') { S.retirer = { i: i, chemin: b.getAttribute('data-c') }; dessiner(); return; }
    if (a === 'doc-non') { S.retirer = null; dessiner(); return; }
    if (a === 'doc-oui') { retirerDoc(); return; }
    if (a === 'forme-pause' || a === 'forme-perdu') { S.etatForm = a === 'forme-pause' ? 'pause' : 'perdu'; S.raison = ''; S.raisonErr = ''; dessiner(); return; }
    if (a === 'etat-non') { S.etatForm = null; S.raison = ''; S.raisonErr = ''; dessiner(); return; }
    if (a === 'etat-ok') { changerEtat(S.etatForm); return; }
    if (a === 'reprendre') { changerEtat('cours'); return; }
    if (a === 'ouvrir-ch') { ouvrirChantier(); return; }
    if (a === 'noter-bloque') { sauverNotes(S.ouv); noterBloque(b.getAttribute('data-v'), b.getAttribute('data-k')); return; }
    if (a === 'voir-etape') { sauverNotes(S.ouv); S.flash = ''; V2.go('dossiers', b.getAttribute('data-id') + ':' + b.getAttribute('data-s') + ':' + b.getAttribute('data-k')); return; }
    if (a === 'voir-ch') { sauverNotes(S.ouv); V2.go('chantiers', b.getAttribute('data-id')); return; }
  }
  function saisie(ev) {
    var t = ev.target;
    if (t.hasAttribute('data-m')) {
      var F = S[t.getAttribute('data-m')], k = t.getAttribute('data-k'); if (!F) return;
      F[k] = t.type === 'checkbox' ? t.checked : t.value;
      if (k === 'remplace') { var z = t.closest('.dz-panneau,.dz-modif'); var si = z && z.querySelector('[data-si="remplace"]'); if (si) si.hidden = !t.checked; }
      if (k === 'q') { var ul = document.getElementById('dz-pistes'); if (ul) ul.innerHTML = htmlPistes(F); }
      return;
    }
    if (t.hasAttribute('data-raison')) { S.raison = t.value; return; }
    if (t.hasAttribute('data-notes') && ev.type === 'input') {
      var i = +t.getAttribute('data-notes'), v = voletCourant(), e = v && v.etapes[i]; if (!e) return;
      var key = cleBrouillon(v, e); S.brouillons[key] = t.value; S.mentions[key] = { t: '', err: false };
      var n = document.getElementById('dz-mn-' + i); if (n) n.textContent = '';
      clearTimeout(S.timers[key]); S.timers[key] = setTimeout(function () { sauverNotes(i); }, 1500);
    }
  }
  function change(ev) {
    var t = ev.target;
    if (t.hasAttribute('data-m')) { saisie(ev); return; }
    if (t.hasAttribute('data-prevue')) { changerDate(+t.getAttribute('data-prevue'), 'prevue', t.value); return; }
    if (t.hasAttribute('data-fdate')) { changerDate(+t.getAttribute('data-fdate'), 'faite', t.value); return; }
    if (t.hasAttribute('data-fichier')) { var f = t.files && t.files[0], i = +t.getAttribute('data-fichier'); t.value = ''; if (f) envoyer(i, f); }
  }
  function sortie(ev) { var t = ev.target; if (t.hasAttribute && t.hasAttribute('data-notes')) sauverNotes(+t.getAttribute('data-notes')); }

  /* ── entrée ── */
  V2.pages.dossiers = { needs: [], render: function (root) {
    var param = V2.route && V2.route.param ? String(V2.route.param) : '', bouts = param.split(':');
    var id = bouts[0] || '', sorte = bouts[1] || null;
    S.cleVoulue = bouts[2] && /^[a-z0-9]{2,16}$/.test(bouts[2]) ? bouts[2] : null; S.ouvDate = null; S.ouvDepart = null; S.ouvErr = ''; S.chOuvert = {};
    S.racine = root; S.flash = S.flashProchain; S.flashProchain = ''; S.flashErr = false; S.occupe = false;
    S.dossierId = id || null; S.vue = id ? 'fiche' : 'liste';
    if (id) { S.sorte = sorte && D.SORTES[sorte] ? sorte : null; S.ouv = -1; }
    S.nouveau = null; S.ajout = null; S.modif = null; S.etatForm = null; S.raison = ''; S.raisonErr = ''; S.retirer = null; S.rdvs = null; S.rdvErreur = false; S.rdvEnCours = false;
    if (!root.__dz) { root.__dz = true; root.addEventListener('click', clic); root.addEventListener('input', saisie); root.addEventListener('change', change); root.addEventListener('focusout', sortie); }
    var tok = ++S.jeton;
    function suite() {
      if (tok !== S.jeton) return;
      S.telepro = false;
      /* le premier volet et son étape ouverte, une fois les données lues */
      charger().then(function () {
        if (S.vue === 'fiche' && S.charge) {
          var v = voletCourant();
          if (v) {
            S.sorte = v.sorte;
            if (S.cleVoulue) v.etapes.forEach(function (e, k) { if (e.k === S.cleVoulue) S.ouv = k; });
            if (S.ouv < 0) S.ouv = indexProchaine(v);
            dessiner();
            if (S.cleVoulue) { S.cleVoulue = null; scrollerEtape(); }
          }
        }
      });
    }
    if (window.PHIRST_ROLE) {
      S.charge = false; S.erreur = false; S.telepro = false; S.roleConnu = false; dessiner();
      window.PHIRST_ROLE.estTelepro().then(function (t) {
        if (tok !== S.jeton || !V2.route || V2.route.name !== 'dossiers') return;
        S.roleConnu = true;
        if (t) { S.telepro = true; dessiner(); return; }
        suite();
      }, function () { S.roleConnu = true; suite(); });
    } else { S.roleConnu = true; suite(); }
  } };
})();
