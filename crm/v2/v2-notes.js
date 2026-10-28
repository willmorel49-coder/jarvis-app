/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Coin notes équipe (V2.notes)
   Notes partagées sur chaque fiche client ET chaque groupement, avec
   AUTEUR + date. Partagé via Supabase (table `notes`) + REPLI localStorage
   tant que la table n'existe pas → marche en local tout de suite.
   API : V2.notes.section(scopeType, scopeId) → HTML conteneur (état vide),
   puis V2.notes.hydrate() charge les conteneurs présents dans le DOM.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var TABLE = 'notes', LS = 'jarvis_notes_v1';
  // Dictée vocale (SpeechRecognition natif) : état courant + détection + icône micro
  var _rec = null, _recBtn = null, _enCours = null;
  // Colle le segment `b` après le texte `a` sans répéter ce que `a` contient déjà.
  // Sur iPhone un segment reprend souvent tout le début de la phrase (« bonjour »,
  // puis « bonjour madame ») : le recouvrement est retiré, on garde l'écriture de `b`.
  // Un recouvrement d'UN seul mot ne compte que si `a` tient en un mot, pour ne pas
  // manger un vrai mot répété (« très très »).
  function fusionner(a, b) {
    a = (a || '').trim(); b = (b || '').trim();
    if (!a) return b; if (!b) return a;
    var norme = function (m) { return m.toLowerCase().replace(/[^0-9a-zà-ÿœæ']/g, ''); };
    var ma = a.split(/\s+/), mb = b.split(/\s+/);
    var na = ma.map(norme), nb = mb.map(norme);
    // `b` est déjà à la fin de `a` → rien à ajouter
    if (nb.length <= na.length && na.slice(-nb.length).join(' ') === nb.join(' ')) return a;
    for (var k = Math.min(na.length, nb.length); k >= 1; k--) {
      if (k === 1 && na.length > 1) break;
      if (na.slice(-k).join(' ') === nb.slice(0, k).join(' ')) return ma.slice(0, ma.length - k).concat(mb).join(' ');
    }
    return a + ' ' + b;
  }
  // ⚠️ 19/10/2026 — sur iPhone, la reconnaissance vocale du navigateur N'EXISTE PAS dans l'app
  // posée sur l'écran d'accueil (WebKit bug 225298, « plus tard » depuis 2021), et dans Safari
  // elle répète ou perd des phrases (trois corrections, 08 et 09/2026). Sur téléphone et tablette,
  // le micro passe donc par la dictée du CLAVIER du téléphone : elle écrit elle-même dans la zone,
  // ponctuation comprise. La reconnaissance du navigateur ne reste que sur ordinateur.
  function surIOS() { var n = navigator; return /iP(hone|ad|od)/.test(n.userAgent || '') || (n.platform === 'MacIntel' && n.maxTouchPoints > 1); }
  function auClavier() { try { if (surIOS() || window.matchMedia('(hover: none) and (pointer: coarse)').matches) return true; } catch (e) {} return false; }
  function voiceSupported() { return auClavier() || !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  // Brouillons gardés sur l'appareil : un compte rendu dicté ne se perd pas si le téléphone
  // ferme l'app (appel, changement d'app). Effacés dès que la note est enregistrée.
  var LSB = 'jarvis_brouillons_v1';
  function cleB(k) { return ((V2.user && V2.user.id) || '') + '|' + k; }
  function brouillons() { try { return JSON.parse(localStorage.getItem(LSB) || '{}') || {}; } catch (e) { return {}; } }
  function brouillonLire(k) { var v = brouillons()[cleB(k)]; return typeof v === 'string' ? v : ''; }
  function brouillonPoser(k, v) {
    var m = brouillons(), c = cleB(k);
    if (v && String(v).trim()) m[c] = String(v); else delete m[c];
    try { localStorage.setItem(LSB, JSON.stringify(m)); } catch (e) {}
  }
  var MIC_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21M8.5 21h7"/></svg>';

  function sb() { return (V2.sb && V2.sb()) || null; }
  function localMap() { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } }
  function localFor(st, sid) { var a = localMap()[st + ':' + sid]; return Array.isArray(a) ? a : []; }
  function localSet(st, sid, arr) { var m = localMap(); m[st + ':' + sid] = arr; try { localStorage.setItem(LS, JSON.stringify(m)); } catch (e) {} }
  function newId() { return 'n' + Date.now() + Math.floor((window.performance && performance.now ? performance.now() : 0) % 1000); }
  function fromRow(r) { return { id: r.id, author: r.author_name || '—', authorId: r.author_id || '', body: r.body || '', created: r.created_at ? new Date(r.created_at).getTime() : Date.now() }; }

  // 28/10/2026 — notes écrites sans réseau, pas encore parties (V2.hl, v2-hors-ligne.js) :
  // montrées en tête, marquées « en attente d'envoi ».
  function avecAttente(notes, st, sid) {
    if (!V2.hl) return notes;
    var vues = {}; notes.forEach(function (n) { vues[n.id] = 1; });
    var att = V2.hl.enAttente(TABLE).filter(function (x) {
      return x.ligne.scope_type === st && x.ligne.scope_id === String(sid) && !vues[x.ligne.id];
    }).map(function (x) { var n = fromRow(x.ligne); n.attente = true; return n; }).reverse();
    return att.concat(notes);
  }
  function load(st, sid) {
    var c = sb();
    if (c) {
      return c.from(TABLE).select('*').eq('scope_type', st).eq('scope_id', String(sid)).order('created_at', { ascending: false })
        .then(function (r) {
          if (!r.error && r.data) return { backend: 'supabase', notes: avecAttente(r.data.map(fromRow), st, sid) };
          if (r.status === 0 && V2.hl) return { backend: 'supabase', notes: avecAttente([], st, sid) };
          return { backend: 'local', notes: localFor(st, sid) };
        }).catch(function () { return { backend: 'local', notes: localFor(st, sid) }; });
    }
    return Promise.resolve({ backend: 'local', notes: localFor(st, sid) });
  }

  V2.notes = {
    // conteneur (vide) posé dans le HTML de la fiche ; hydraté ensuite
    section: function (scopeType, scopeId) {
      ensureCss();
      var id = 'v2n-' + Math.random().toString(36).slice(2, 9);
      var cle = 'note:' + scopeType + ':' + scopeId;
      return '<div class="v2-notes-box v2-card" id="' + id + '" data-st="' + esc(scopeType) + '" data-sid="' + esc(String(scopeId)) + '">' +
          '<div class="v2-notes-hd">' + (V2.ICO ? V2.ICO('spark', 16, 2) : '') + '<span>Note personnelle</span></div>' +
          '<div class="v2-notes-list"><div class="v2-notes-empty">Chargement…</div></div>' +
          // 26/10/2026 — v2 : les 4 phrases toutes faites, au-dessus du champ (fiche officine seulement) ; un appui écrit la phrase DANS le champ
          (scopeType === 'client' ? '<div class="v2-notes-puces" role="group" aria-label="Phrases toutes faites">' +
            ['À rappeler', 'Commande en cours', 'Rendez-vous pris', 'Absent, repasser'].map(function (t) { return '<button type="button" class="v2-notes-puce" onclick="V2.notes.puce(this)">' + esc(t) + '</button>'; }).join('') + '</div>' : '') +
          '<div class="v2-notes-add">' +
            V2.notes.champ('<textarea class="v2-notes-ta" rows="2" placeholder="Ajouter une note personnelle…" oninput="V2.notes.garder(this)">' + esc(brouillonLire(cle)) + '</textarea>', 'Dicter la note à la voix') +   // 19/10/2026 : le micro passe DANS le coin du champ, comme partout
            '<button class="v2-btn v2-btn-primary v2-notes-btn" onclick="V2.notes.add(this)">Ajouter</button>' +
          '</div>' +
        '</div>';
    },

    // Bouton micro d'une zone d'écriture ; `cible` = sélecteur de la zone dans le même encadré.
    // `onmousedown` empêche le bouton de prendre le focus : le clavier déjà ouvert ne se referme pas.
    micro: function (cible, titre) {
      if (!voiceSupported()) return '';
      ensureCss();
      return '<button type="button" class="v2-notes-mic" data-cible="' + esc(cible) + '" onmousedown="event.preventDefault()" onclick="V2.notes.dictate(this)" title="' + esc(titre) + '" aria-label="' + esc(titre) + '">' + MIC_SVG + '</button>';
    },
    // 19/10/2026 — « un micro partout où l'on écrit du texte » : entoure UN champ (<textarea> ou <input>) du HTML
    // `champHtml` et pose le micro DANS son coin bas-droit (au milieu à droite pour une ligne). Rend le champ
    // inchangé si l'appareil n'a aucune dictée (rien ne bouge à l'écran). `[data-dictee]` : c'est là que
    // dictate() cherche le champ ; ne mettre qu'UN champ dictable dans l'enveloppe.
    champ: function (champHtml, titre) {
      var m = V2.notes.micro('textarea,input', titre || 'Dicter à la voix');
      if (!m) return champHtml;
      return '<span class="v2-mic-wrap' + (/^\s*<input/i.test(champHtml) ? ' v2-mic-1l' : '') + '" data-dictee>' + champHtml + m + '</span>';
    },
    micPossible: voiceSupported,
    brouillonLire: brouillonLire,
    brouillonPoser: brouillonPoser,
    // 26/10/2026 — v2 : écrit la phrase du bouton dans le champ de note (à la suite de ce qui y est déjà), curseur à la fin
    puce: function (btn) {
      var box = btn.closest('.v2-notes-box'); if (!box) return;
      var ta = box.querySelector('.v2-notes-ta'); if (!ta) return;
      var v = ta.value.replace(/\s+$/, '');
      ta.value = (v ? v + ' ' : '') + btn.textContent + ' ';
      V2.notes.garder(ta);
      try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
      try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
    },
    garder: function (ta) {
      var box = ta.closest('.v2-notes-box'); if (!box) return;
      brouillonPoser('note:' + box.getAttribute('data-st') + ':' + box.getAttribute('data-sid'), ta.value);
    },

    // Dictée vocale (API navigateur native SpeechRecognition — zéro dépendance, zéro coût).
    // Toggle : 1er clic démarre l'écoute (fr-FR), 2e clic arrête. Le texte s'écrit dans la note.
    dictate: function (btn) {
      var box = btn.closest('.v2-notes-box, [data-dictee]'); if (!box) return;   // 16/10/2026 : l'écran Bloc-notes marque sa zone d'écriture [data-dictee]
      var cible = btn.getAttribute('data-cible');
      var ta = (cible && box.querySelector(cible)) || box.querySelector('.v2-notes-ta'); if (!ta) return;
      if (auClavier()) { dicterAuClavier(ta); return; }
      // déjà en écoute sur ce bouton → on arrête
      // ⚠️ `_rec` n'est posé que dans `onstart`, qui arrive APRÈS `start()` : entre
      // deux relances il vaut brièvement null. Un appui du doigt pile dans ce
      // trou lançait une SECONDE chaîne d'écoute sans arrêter la première.
      // `_enCours` est posé tout de suite, il ne laisse plus ce trou ouvert.
      if (_enCours) {
        var memeBouton = (_recBtn === btn), dejaArretee = _enCours.arret;
        _enCours.arret = true;
        if (_rec) { _rec._arretDemande = true; try { _rec.stop(); } catch (e) {} }
        // Un 2e appui sur le MÊME micro = arrêt, et rien d'autre. Sauf si l'arrêt
        // avait déjà été demandé et que la chaîne n'est pas retombée (moteur mort) :
        // dans ce cas on repart, sinon le micro resterait bloqué pour de bon.
        if (memeBouton && !dejaArretee) return;
        _enCours = null;
      }
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { if (V2.toast) V2.toast('La dictée vocale n\'est pas disponible sur ce navigateur'); return; }

      // Ce qui était déjà écrit dans la note avant de commencer à dicter.
      var base = ta.value ? (ta.value.replace(/\s+$/, '') + ' ') : '';
      var acquis = '';        // tout ce qui a été définitivement reconnu depuis le début
      var affiche = '';       // dernier texte réellement montré à l'écran
      var arret = false;      // l'utilisateur a-t-il touché le micro pour arrêter ?
      var relances = 0;       // garde-fou : jamais de relance en boucle infinie
      var chaine = _enCours = { arret: false };   // cette dictée-ci, relances comprises
      _recBtn = btn;

      // enCours = on est au milieu d'une phrase : on garde l'espace final qui sépare
      // les mots à venir. Sinon on nettoie, pour ne pas laisser d'espace qui traîne.
      function ecrire(txt, enCours) {
        affiche = txt.replace(/\s+/g, ' ').replace(/^\s/, '');
        if (!enCours) affiche = affiche.replace(/\s+$/, '');
        ta.value = affiche; signaler(ta);
      }

      function demarrer(premier) {
        var rec = new SR();
        rec.lang = 'fr-FR';
        rec.interimResults = true;
        // Safari accepte `continuous` mais coupe quand même après une phrase :
        // c'est la relance automatique ci-dessous qui fait le vrai travail.
        try { rec.continuous = true; } catch (e) {}
        rec._fin = '';

        rec.onstart = function () {
          _rec = rec; _recBtn = btn;
          btn.classList.add('rec'); btn.title = 'Arrêter la dictée';
          if (premier && V2.toast) V2.toast('Dictée en cours — parle, puis re-touche le micro pour arrêter');
        };

        rec.onresult = function (e) {
          // Une session déjà close ne doit plus écrire : son texte est dans `acquis`.
          if (rec._fini) return;
          // On RECONSTRUIT le texte depuis l'ensemble des résultats à chaque événement
          // (idempotent) au lieu d'accumuler avec += : sur mobile, resultIndex est peu
          // fiable et l'accumulation répétait la même phrase 4-5 fois.
          // ⚠️ 30/09/2026 (remontée Karine, « en double voire triple ») : sur iPhone,
          // chaque segment répète TOUT le début de la phrase (« bonjour », « bonjour
          // madame », « bonjour madame Dupont »). Coller les segments bout à bout
          // écrivait la phrase 3 fois : `fusionner` ne garde que ce qui est nouveau.
          var fin = '', interim = '';
          for (var i = 0; i < e.results.length; i++) {
            var brut = (e.results[i][0].transcript || '').trim();
            if (!brut) continue;
            if (e.results[i].isFinal) fin = fusionner(fin, brut);
            else interim = fusionner(interim, brut);
          }
          // Le provisoire répète souvent la dernière phrase définitive : on ne la réécrit pas.
          var enCours = interim ? fusionner(fin, interim) : fin;
          rec._fin = fin;
          rec._interim = interim;
          ecrire(base + fusionner(acquis, enCours) + (interim ? ' ' : ''), !!interim);
        };

        rec.onerror = function (ev) {
          var err = ev && ev.error;
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            arret = true;   // inutile de relancer : c'est une autorisation refusée
            if (V2.toast) V2.toast('Micro refusé — autorise le microphone pour ce site dans les réglages du navigateur', 'error');
          } else if (err === 'audio-capture') {
            arret = true;
            if (V2.toast) V2.toast('Aucun micro détecté sur cet appareil', 'error');
          }
          // 'no-speech' et 'network' : on laisse la relance automatique retenter, sans alarmer.
        };

        rec.onend = function () {
          // ⚠️ 01/09/2026 — Safari émet `end` PLUSIEURS FOIS pour une même session
          // d'écoute (après une erreur, après un `stop()`, ou de lui-même). Sans ce
          // verrou, chaque `end` en trop rejouait tout le bloc : la phrase entendue
          // était ajoutée une deuxième fois ET une deuxième chaîne d'écoute était
          // lancée en parallèle sur la même zone de texte. Deux chaînes qui écrivent
          // au même endroit, c'est le commentaire recopié « plein de fois ».
          // Mesuré au banc d'essai : 3 phrases dictées -> chacune écrite 2 fois.
          if (rec._fini) return;
          rec._fini = true;

          // Ce qui vient d'être reconnu est acquis pour de bon.
          // ⚠️ Safari coupe souvent SANS avoir marqué la phrase « définitive » : dans ce
          // cas on garde le texte provisoire, sinon la phrase disparaît à la relance.
          var capte = rec._interim ? fusionner(rec._fin || '', rec._interim) : (rec._fin || '');
          // Deuxième filet : Safari peut re-livrer à la relance la fin (ou tout le début)
          // de l'audio précédent. `fusionner` n'ajoute que ce qui est vraiment nouveau.
          if (capte) { acquis = fusionner(acquis, capte) + ' '; }

          // Safari (Mac et iPhone) arrête l'écoute tout seul après chaque phrase.
          // Tant que Karine n'a pas re-touché le micro, on relance : c'est ce qui
          // donnait l'impression que « le dictaphone ne marche pas ».
          if (!arret && !chaine.arret && !rec._arretDemande && relances < 60) {
            relances++;
            try { demarrer(false); return; } catch (e) {}
          }

          btn.classList.remove('rec'); btn.title = 'Dicter la note à la voix';
          _rec = null;
          if (_enCours === chaine) { _enCours = null; _recBtn = null; }

          // ⚠️ On ne VIDE JAMAIS la note. Avant, si aucun segment n'était marqué
          // « définitif », tout ce que Karine venait de dicter disparaissait à l'arrêt.
          var texte = (base + acquis).trim() || affiche.trim() || ta.value.trim();
          ta.value = texte; signaler(ta);
          // 19/10/2026 — les champs qui enregistrent sur `change` (fiche officine, profil…) l'attendent
          // à la fin de la dictée, comme à la sortie d'un champ tapé au clavier.
          try { ta.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
          if (texte) { ta.focus(); }
          else if (V2.toast) V2.toast('Rien n\'a été entendu — vérifiez le micro et réessayez', 'error');
        };

        rec.start();
      }

      try { demarrer(true); } catch (e) { if (V2.toast) V2.toast('Impossible de démarrer la dictée', 'error'); }
    },

    // charge tous les conteneurs pas encore hydratés
    hydrate: function () {
      var boxes = document.querySelectorAll('.v2-notes-box:not([data-done])');
      Array.prototype.forEach.call(boxes, function (box) {
        box.setAttribute('data-done', '1');
        renderBox(box);
      });
    },

    add: function (btn) {
      var box = btn.closest('.v2-notes-box'); if (!box) return;
      if (!V2.user) { if (V2.toast) V2.toast('Connecte-toi pour ajouter une note'); return; }
      var ta = box.querySelector('.v2-notes-ta'); var body = (ta && ta.value || '').trim();
      if (!body) { if (ta) ta.focus(); return; }
      var st = box.getAttribute('data-st'), sid = box.getAttribute('data-sid');
      btn.disabled = true; btn.textContent = 'Ajout…';
      var c = sb();
      var done = function () { if (ta) ta.value = ''; brouillonPoser('note:' + st + ':' + sid, ''); if (V2.toast) V2.toast('Note ajoutée'); renderBox(box); };
      if (c) {
        // échec Supabase → NE PAS faire croire que c'est sauvé (avant : sauvé en local + « Note ajoutée » puis disparue au re-render qui relit Supabase)
        var fail = function () { btn.disabled = false; btn.textContent = 'Ajouter'; if (V2.toast) V2.toast('Note non enregistrée — réessayez', 'error'); };
        // 28/10/2026 — sans réseau : gardée sur l'appareil (avec son id et son heure), elle
        // part seule au retour du réseau. Si l'appareil refuse de la garder : échec dit.
        var garder = function () {
          var ligne = { id: V2.hl.nouvelId(), scope_type: st, scope_id: String(sid), author_id: V2.user.id,
                        author_name: V2.user.name || '', body: body, created_at: new Date().toISOString() };
          if (!V2.hl.differer({ table: TABLE, ligne: ligne, quoi: 'Une note' })) { fail(); return; }
          if (ta) ta.value = ''; brouillonPoser('note:' + st + ':' + sid, '');
          if (V2.toast) V2.toast('Note gardée sur l’appareil : elle partira au retour du réseau');
          renderBox(box);
        };
        if (V2.hl && V2.hl.sansReseau()) { garder(); return; }
        c.from(TABLE).insert({ scope_type: st, scope_id: String(sid), author_id: V2.user.id, author_name: V2.user.name || '', body: body })
          .then(function (r) { if (r.error && r.status === 0 && V2.hl) garder(); else if (r.error) fail(); else done(); })
          .catch(function () { fail(); });
      } else { addLocal(st, sid, body); done(); }
    },

    // Note écrite par l'app elle-même (ex. documents transmis depuis la fiche),
    // puis les encadrés de notes de ce client affichés à l'écran sont relus.
    addAuto: function (st, sid, body) {
      if (!V2.user || !body) return Promise.resolve(false);
      var c = sb();
      var redraw = function () {
        Array.prototype.forEach.call(document.querySelectorAll('.v2-notes-box'), function (box) {
          if (box.getAttribute('data-st') === st && box.getAttribute('data-sid') === String(sid)) renderBox(box);
        });
        return true;
      };
      if (!c) { addLocal(st, sid, body); return Promise.resolve(redraw()); }
      var garder = function () {   // 28/10/2026 — sans réseau : même boîte d'envoi que V2.notes.add
        var ok = V2.hl.differer({ table: TABLE, quoi: 'Une note', ligne: { id: V2.hl.nouvelId(), scope_type: st, scope_id: String(sid),
          author_id: V2.user.id, author_name: V2.user.name || '', body: body, created_at: new Date().toISOString() } });
        return ok ? redraw() : false;
      };
      if (V2.hl && V2.hl.sansReseau()) return Promise.resolve(garder());
      return c.from(TABLE).insert({ scope_type: st, scope_id: String(sid), author_id: V2.user.id, author_name: V2.user.name || '', body: body })
        .then(function (r) { return r.error ? (r.status === 0 && V2.hl ? garder() : false) : redraw(); }, function () { return false; });
    },

    remove: function (el) {
      var box = el.closest('.v2-notes-box'); if (!box) return;
      var id = el.getAttribute('data-id'); var st = box.getAttribute('data-st'), sid = box.getAttribute('data-sid');
      var c = sb();
      if (c && String(id).indexOf('n') !== 0) {
        c.from(TABLE).delete().eq('id', id).then(function () { renderBox(box); }).catch(function () { renderBox(box); });
      } else {
        localSet(st, sid, localFor(st, sid).filter(function (x) { return x.id !== id; }));
        renderBox(box);
      }
    },

    // Passe une note existante en édition (textarea pré-rempli + Enregistrer/Annuler).
    // N'est appelé que depuis le bouton ✎ posé sur les notes de l'utilisateur courant.
    edit: function (el) {
      var note = el.closest('.v2-note'); if (!note) return;
      var body = '';
      try { body = decodeURIComponent(note.getAttribute('data-raw') || ''); } catch (e) { body = ''; }
      note.classList.add('v2-note-editing');
      note.innerHTML = '<div class="v2-note-editform">' +
          V2.notes.champ('<textarea class="v2-notes-ta v2-note-edit-ta" rows="3"></textarea>', 'Dicter la correction à la voix') +
          '<div class="v2-note-edit-actions">' +
            '<button class="v2-btn v2-note-cancel" onclick="V2.notes.cancelEdit(this)">Annuler</button>' +
            '<button class="v2-btn v2-btn-primary v2-note-save" onclick="V2.notes.saveEdit(this)">Enregistrer</button>' +
          '</div>' +
        '</div>';
      var ta = note.querySelector('.v2-note-edit-ta');
      if (ta) { ta.value = body; ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    },

    // Annule l'édition : on ré-affiche la note telle qu'en base.
    cancelEdit: function (btn) {
      var box = btn.closest('.v2-notes-box'); if (box) renderBox(box);
    },

    // Enregistre le nouveau texte : UPDATE Supabase (par id) + repli localStorage, puis re-render.
    saveEdit: function (btn) {
      var note = btn.closest('.v2-note'); if (!note) return;
      var box = btn.closest('.v2-notes-box'); if (!box) return;
      var ta = note.querySelector('.v2-note-edit-ta');
      var body = (ta && ta.value || '').trim();
      if (!body) { if (ta) ta.focus(); return; }
      var id = note.getAttribute('data-id');
      var st = box.getAttribute('data-st'), sid = box.getAttribute('data-sid');
      btn.disabled = true; btn.textContent = 'Enregistrement…';
      var c = sb();
      var ok = function () { editLocal(st, sid, id, body); if (V2.toast) V2.toast('Note modifiée'); renderBox(box); };
      var fail = function () { btn.disabled = false; btn.textContent = 'Enregistrer'; if (V2.toast) V2.toast('Note non modifiée — réessayez', 'error'); };
      if (c && String(id).indexOf('n') !== 0) {
        // ⚠️ 05/10/2026 (remontée Matthieu, « la modification ne s'enregistre pas ») : la base
        // n'autorise sur une note que la lecture, l'ajout et le retrait. Une modification y est
        // refusée SANS erreur (0 ligne touchée) et l'écran annonçait quand même « Note modifiée ».
        // La note est donc réécrite à sa date d'origine, puis l'ancienne est retirée ; si ce
        // retrait échoue, la nouvelle repart pour ne pas laisser la note en double.
        var une = function (p) { return p.then(function (r) { if (!r || r.error || !r.data || !r.data.length) throw new Error('refus'); return r.data[0]; }); };
        une(c.from(TABLE).select('*').eq('id', id)).then(function (old) {
          return une(c.from(TABLE).insert({ scope_type: old.scope_type, scope_id: old.scope_id, author_id: V2.user.id, author_name: old.author_name, body: body, created_at: old.created_at }).select('id')).then(function (neuve) {
            return une(c.from(TABLE).delete().eq('id', id).select('id')).catch(function (e) {
              return c.from(TABLE).delete().eq('id', neuve.id).then(function () { throw e; }, function () { throw e; });
            });
          });
        }).then(ok, fail);
      } else {
        editLocal(st, sid, id, body); if (V2.toast) V2.toast('Note modifiée'); renderBox(box);
      }
    }
  };

  // Une écriture faite par le code ne déclenche pas `input` : on le déclenche, pour que la
  // zone garde son brouillon comme si la personne avait tapé le texte.
  function signaler(ta) { try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} }

  // Téléphone : le tap sur le micro ouvre le clavier sur la bonne zone (focus dans le geste,
  // sinon iOS ne l'ouvre pas), curseur en fin de texte, et une bulle posée juste au-dessus
  // du clavier montre où se trouve son micro. La bulle part dès que le texte arrive.
  var _aide = null;
  function dicterAuClavier(ta) {
    ensureCss();   // 19/10/2026 — le Bloc-notes a son propre bouton micro : sans cela la bulle n'avait AUCUN style (posée en bas de page, hors écran)
    ta.focus();
    try { var n = ta.value.length; ta.setSelectionRange(n, n); } catch (e) {}
    fermerAide();
    var ios = surIOS();
    var el = document.createElement('div');
    el.className = 'v2-dictee-aide'; el.setAttribute('role', 'status');
    el.innerHTML = '<div class="v2-da-l1"><span class="v2-da-key">' + MIC_SVG + '</span>' +
        '<span>Touchez le micro <b>' + (ios ? 'en bas du clavier' : 'du clavier') + '</b>, puis parlez.</span></div>' +
      '<div class="v2-da-l2">' + (ios ? 'Pas de micro ? Réglages › Général › Clavier › Dictée.' : 'Pas de micro ? Activez la saisie vocale dans les réglages du clavier.') + '</div>';
    document.body.appendChild(el);
    var vv = window.visualViewport;
    // 19/10/2026 — jamais SUR le champ : un champ collé en bas de l'écran (barre flottante d'Offilog) était caché
    // par la bulle. Elle passe alors au-dessus du champ, ou de toute sa barre fixe quand il est dans une barre basse.
    var barre = null;
    for (var p = ta.parentElement; p && p !== document.body; p = p.parentElement) {
      var pos = getComputedStyle(p).position;
      if (pos === 'fixed' || pos === 'sticky') { if (p.getBoundingClientRect().height < window.innerHeight * 0.4) barre = p; break; }
    }
    function placer() {
      var haut = vv ? vv.offsetTop + vv.height : window.innerHeight;
      var gauche = vv ? vv.offsetLeft : 0, large = vv ? vv.width : window.innerWidth;
      el.style.left = (gauche + 12) + 'px';
      el.style.width = Math.min(large - 24, 440) + 'px';
      // 19/10/2026 — jamais plus bas que l'écran (page défilée, feuille) : la bulle reste visible même si le repère du clavier est décalé
      var h = el.offsetHeight, top = Math.min(haut, window.innerHeight) - h - 14;
      var z = (barre || ta).getBoundingClientRect();
      if (top < z.bottom && top + h > z.top) top = z.top - h - 14;
      el.style.top = Math.max((vv ? vv.offsetTop : 0) + 8, top) + 'px';
    }
    function fin() { fermerAide(); }
    placer();
    if (vv) { vv.addEventListener('resize', placer); vv.addEventListener('scroll', placer); }
    window.addEventListener('scroll', placer, true);   // 19/10/2026 — page ou feuille (modale) qui défile : la bulle reste au-dessus du clavier
    ta.addEventListener('input', fin); ta.addEventListener('blur', fin);
    el.addEventListener('click', fin);
    var minuterie = setTimeout(fin, 20000);
    _aide = function () {
      clearTimeout(minuterie);
      if (vv) { vv.removeEventListener('resize', placer); vv.removeEventListener('scroll', placer); }
      window.removeEventListener('scroll', placer, true);
      ta.removeEventListener('input', fin); ta.removeEventListener('blur', fin);
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }
  function fermerAide() { if (_aide) { var f = _aide; _aide = null; f(); } }

  // ⚠️ 19/10/2026 — « le clavier se referme quand je touche le micro tout de suite après avoir ouvert la fiche ».
  // La fiche officine (comme l'accueil) se redessine 2 à 4 fois pendant ~2 s à l'arrivée des fichiers lus en
  // arrière-plan (V2.render() depuis les .then) : le champ qu'on vient de toucher est REMPLACÉ par un neuf,
  // le curseur part et le clavier se ferme. Tant qu'un champ dictable a le curseur (ou qu'une dictée
  // d'ordinateur écrit dedans), un redessin de la MÊME page venu de l'arrière-plan est mis de côté et rejoué
  // dès que le curseur quitte le champ. Un redessin causé par un geste (clic, Entrée : 600 ms) passe, comme
  // un changement de page.
  var _cleRendu = '', _geste = 0, _rendu = null, _enAttenteRendu = false, _minuteRendu = null;
  function champDictable() {
    var a = document.activeElement;
    return (a && /^(TEXTAREA|INPUT)$/.test(a.tagName) && a.closest && a.closest('.v2-mic-wrap, .v2-notes-box, [data-dictee]')) ? a : null;
  }
  function poserGardeRendu() {
    if (_rendu || !V2.render) return;
    _rendu = V2.render;
    V2.render = function () {
      var cle = V2.route ? V2.route.name + '|' + V2.route.param : '';
      if (cle === _cleRendu && Date.now() - _geste > 600 && (champDictable() || _enCours)) { _enAttenteRendu = true; return; }
      _enAttenteRendu = false; _cleRendu = cle;
      return _rendu.apply(this, arguments);
    };
    var geste = function (e) {
      var t = e.target;
      if (e.type === 'keydown' && e.key !== 'Enter') return;
      if (t && t.closest && t.closest('.v2-notes-mic, .bn-mic')) return;
      _geste = Date.now();
    };
    document.addEventListener('click', geste, true); document.addEventListener('keydown', geste, true); document.addEventListener('submit', geste, true);
    document.addEventListener('focusout', function () {
      if (!_enAttenteRendu) return;
      clearTimeout(_minuteRendu);
      _minuteRendu = setTimeout(function () { if (_enAttenteRendu && !champDictable() && !_enCours) V2.render(); }, 700);
    }, true);
  }
  poserGardeRendu();
  if (!_rendu) document.addEventListener('DOMContentLoaded', poserGardeRendu);

  function editLocal(st, sid, id, body) {
    var a = localFor(st, sid), changed = false;
    for (var i = 0; i < a.length; i++) { if (a[i].id === id) { a[i].body = body; changed = true; } }
    if (changed) localSet(st, sid, a);
  }

  function addLocal(st, sid, body) {
    var a = localFor(st, sid);
    a.unshift({ id: newId(), author: (V2.user && V2.user.name) || '—', authorId: (V2.user && V2.user.id) || '', body: body, created: Date.now() });
    localSet(st, sid, a);
  }

  function renderBox(box) {
    var st = box.getAttribute('data-st'), sid = box.getAttribute('data-sid');
    var list = box.querySelector('.v2-notes-list'); if (!list) return;
    var btn = box.querySelector('.v2-notes-btn'); if (btn) { btn.disabled = false; btn.textContent = 'Ajouter'; }
    load(st, sid).then(function (res) {
      var notes = res.notes;
      if (!notes.length) { list.innerHTML = '<div class="v2-notes-empty">Aucune note pour l\'instant.</div>'; return; }
      var uid = (V2.user && V2.user.id) || '__';
      list.innerHTML = notes.map(function (n) {
        var d = ''; try { d = new Date(n.created).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' }); } catch (e) {}
        if (n.attente) d += ' · en attente d’envoi';
        var mine = !n.attente && ((res.backend === 'local') || (n.authorId && n.authorId === uid));
        return '<div class="v2-note" data-id="' + esc(n.id) + '" data-raw="' + encodeURIComponent(n.body) + '">' +
          '<div class="v2-note-top"><span class="v2-note-au">' + esc(n.author) + '</span><span class="v2-note-dt">' + d + '</span>' +
            (mine ? '<button class="v2-note-edit" onclick="V2.notes.edit(this)" title="Modifier" aria-label="Modifier">✎</button>' +
                    '<button class="v2-note-x" data-id="' + esc(n.id) + '" onclick="V2.notes.remove(this)" title="Supprimer">&times;</button>' : '') + '</div>' +
          '<div class="v2-note-bd">' + esc(n.body).replace(/\n/g, '<br>') + '</div>' +
        '</div>';
      }).join('');
    });
  }

  function ensureCss() {
    if (document.getElementById('v2-notes-css')) return;
    var s = document.createElement('style'); s.id = 'v2-notes-css';
    s.textContent = [
      '.v2-notes-box{margin-top:16px;padding:16px 18px}',
      '.v2-notes-hd{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink);margin-bottom:12px}',
      '.v2-notes-hd svg{color:var(--ip-blue)}',
      '.v2-notes-list{display:flex;flex-direction:column;gap:9px;max-height:280px;overflow-y:auto}',
      '.v2-notes-empty{font-size:13px;color:var(--muted);padding:6px 0}',
      '.v2-note{background:var(--card-2);border:1px solid var(--line);border-radius:12px;padding:10px 12px}',
      '.v2-note-top{display:flex;align-items:center;gap:8px;margin-bottom:4px}',
      '.v2-note-au{font-size:12.5px;font-weight:700;color:var(--ip-ink)}',
      '.v2-note-dt{font-size:11.5px;color:var(--muted)}',
      '.v2-note-edit{margin-left:auto;border:none;background:none;color:var(--muted-2);font-size:13px;line-height:1;cursor:pointer;width:24px;height:24px;border-radius:6px}',
      '.v2-note-edit:hover{background:color-mix(in srgb,var(--ip-blue) 14%,transparent);color:var(--ip-blue)}',
      '.v2-note-x{margin-left:auto;border:none;background:none;color:var(--muted-2);font-size:18px;line-height:1;cursor:pointer;width:24px;height:24px;border-radius:6px}',
      '.v2-note-edit + .v2-note-x{margin-left:4px}',
      '.v2-note-x:hover{background:color-mix(in srgb,var(--c-rose) 14%,transparent);color:var(--c-rose)}',
      '.v2-note-bd{font-size:13.5px;line-height:1.5;color:var(--ip-ink)}',
      // Édition d'une note existante : textarea pré-rempli + actions Annuler/Enregistrer
      '.v2-note-editform{display:flex;flex-direction:column;gap:8px}',
      '.v2-note-edit-ta{width:100%;flex:none}',
      '.v2-note-edit-actions{display:flex;gap:8px;justify-content:flex-end}',
      '.v2-notes-puces{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
      '.v2-notes-puce{display:inline-flex;align-items:center;justify-content:center;min-height:var(--tap-min,44px);padding:0 14px;border-radius:var(--r-btn,12px);border:1px solid var(--line-strong);background:var(--card);font:inherit;font-weight:700;font-size:13px;color:var(--ip-ink);cursor:pointer;-webkit-tap-highlight-color:transparent}',
      '.v2-notes-puce:hover{border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.v2-notes-puce:focus-visible{outline:2px solid var(--ip-blue);outline-offset:2px}',
      '.v2-notes-add{display:flex;gap:9px;align-items:flex-end;margin-top:12px}',
      '.v2-notes-ta{flex:1;min-width:0;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:11px;padding:10px 12px;font:inherit;font-size:13.5px;color:var(--ip-ink);background:var(--card);resize:vertical;min-height:44px}',
      '.v2-notes-ta:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo,color-mix(in srgb,var(--ip-blue) 18%,transparent))}',
      '.v2-notes-btn{flex:none;white-space:nowrap}',
      // Bouton micro (dictée vocale) : repos = gris, écoute = rouge qui pulse
      '.v2-notes-mic{flex:none;width:44px;height:44px;border-radius:11px;border:1px solid var(--line-strong);background:var(--card);color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:color .16s var(--ease),border-color .16s var(--ease),background .16s var(--ease)}',
      '.v2-notes-mic:hover{color:var(--ip-blue);border-color:color-mix(in srgb,var(--ip-blue) 36%,var(--line))}',
      '.v2-notes-mic.rec{color:#fff;background:var(--c-rose,#FF4D6D);border-color:var(--c-rose,#FF4D6D);animation:v2micpulse 1.3s ease-in-out infinite}',
      '@keyframes v2micpulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--c-rose,#FF4D6D) 55%,transparent)}50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--c-rose,#FF4D6D) 0%,transparent)}}',
      '@media(prefers-reduced-motion:reduce){.v2-notes-mic.rec{animation:none}}',
      // 19/10/2026 — micro posé DANS le champ (V2.notes.champ) : coin bas-droit d'une zone, milieu droit d'une ligne.
      // Le texte ne passe jamais dessous (marge intérieure à droite) ; au téléphone la cible fait 44 px et la police 16 px (sinon iOS zoome).
      '.v2-mic-wrap{position:relative;display:block;min-width:0;flex:1 1 auto}',
      '.v2-mic-wrap>textarea,.v2-mic-wrap>input{width:100%;box-sizing:border-box;padding-right:44px!important}',
      '.v2-mic-wrap>textarea{display:block}',
      '.v2-mic-wrap>.v2-notes-mic{position:absolute;right:5px;bottom:5px;width:32px;height:32px;border-radius:9px;z-index:1}',
      '.v2-mic-1l>.v2-notes-mic{bottom:auto;top:50%;margin-top:-16px}',
      '.v2-mic-wrap>.v2-notes-mic:not(.rec){border-color:transparent;background:transparent}',
      '@media(hover:none) and (pointer:coarse),(max-width:640px){',
      '.v2-mic-wrap>textarea,.v2-mic-wrap>input,.v2-notes-ta{font-size:16px!important}',
      '.v2-mic-wrap>textarea,.v2-mic-wrap>input{padding-right:54px!important}',
      '.v2-mic-wrap>input{min-height:44px}',
      '.v2-mic-wrap>textarea{min-height:56px}',
      '.v2-mic-wrap>.v2-notes-mic{width:44px;height:44px;right:2px;bottom:2px}',
      '.v2-mic-1l>.v2-notes-mic{margin-top:-22px;bottom:auto}}',
      // Bulle de dictée au clavier (téléphone) : couleurs inversées du thème, flèche vers le micro du clavier
      '.v2-dictee-aide{position:fixed;z-index:10050;box-sizing:border-box;padding:12px 14px;border-radius:14px;background:var(--ip-ink,#0B1220);color:var(--card,#fff);box-shadow:0 14px 34px rgba(8,15,30,.32),0 2px 6px rgba(8,15,30,.18);animation:v2daIn .18s var(--ease,ease-out) both}',
      '.v2-dictee-aide::after{content:"";position:absolute;right:22px;bottom:-7px;width:14px;height:14px;background:inherit;transform:rotate(45deg);border-radius:2px}',
      '.v2-da-l1{display:flex;align-items:center;gap:10px;font-size:14.5px;line-height:1.35;font-weight:600}',
      '.v2-da-l1 b{font-weight:800}',
      '.v2-da-key{flex:none;width:34px;height:34px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--card,#fff) 16%,transparent);border:1px solid color-mix(in srgb,var(--card,#fff) 34%,transparent)}',
      '.v2-da-l2{margin-top:6px;padding-left:44px;font-size:12px;line-height:1.4;color:color-mix(in srgb,var(--card,#fff) 78%,var(--ip-ink,#0B1220))}',
      '@keyframes v2daIn{from{transform:translateY(6px)}to{transform:none}}',
      '@media(prefers-reduced-motion:reduce){.v2-dictee-aide{animation:none}}'
    ].join('');
    document.head.appendChild(s);
  }

  // 28/10/2026 — notes faites hors ligne parties : les encadrés affichés perdent leur « en attente ».
  window.addEventListener('v2-hl-envoye', function (e) {
    if (e.detail && e.detail.tables && e.detail.tables.indexOf(TABLE) < 0) return;
    Array.prototype.forEach.call(document.querySelectorAll('.v2-notes-box'), function (b) { try { renderBox(b); } catch (x) {} });
  });
})();
