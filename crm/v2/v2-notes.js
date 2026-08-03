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
  var _rec = null, _recBtn = null;
  function voiceSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  var MIC_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21M8.5 21h7"/></svg>';

  function sb() { return (V2.sb && V2.sb()) || null; }
  function localMap() { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } }
  function localFor(st, sid) { var a = localMap()[st + ':' + sid]; return Array.isArray(a) ? a : []; }
  function localSet(st, sid, arr) { var m = localMap(); m[st + ':' + sid] = arr; try { localStorage.setItem(LS, JSON.stringify(m)); } catch (e) {} }
  function newId() { return 'n' + Date.now() + Math.floor((window.performance && performance.now ? performance.now() : 0) % 1000); }
  function fromRow(r) { return { id: r.id, author: r.author_name || '—', authorId: r.author_id || '', body: r.body || '', created: r.created_at ? new Date(r.created_at).getTime() : Date.now() }; }

  function load(st, sid) {
    var c = sb();
    if (c) {
      return c.from(TABLE).select('*').eq('scope_type', st).eq('scope_id', String(sid)).order('created_at', { ascending: false })
        .then(function (r) {
          if (!r.error && r.data) return { backend: 'supabase', notes: r.data.map(fromRow) };
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
      return '<div class="v2-notes-box v2-card" id="' + id + '" data-st="' + esc(scopeType) + '" data-sid="' + esc(String(scopeId)) + '">' +
          '<div class="v2-notes-hd">' + (V2.ICO ? V2.ICO('spark', 16, 2) : '') + '<span>Note personnelle</span></div>' +
          '<div class="v2-notes-list"><div class="v2-notes-empty">Chargement…</div></div>' +
          '<div class="v2-notes-add">' +
            '<textarea class="v2-notes-ta" rows="2" placeholder="Ajouter une note personnelle…"></textarea>' +
            (voiceSupported() ? '<button type="button" class="v2-notes-mic" onclick="V2.notes.dictate(this)" title="Dicter la note à la voix" aria-label="Dicter à la voix">' + MIC_SVG + '</button>' : '') +
            '<button class="v2-btn v2-btn-primary v2-notes-btn" onclick="V2.notes.add(this)">Ajouter</button>' +
          '</div>' +
        '</div>';
    },

    // Dictée vocale (API navigateur native SpeechRecognition — zéro dépendance, zéro coût).
    // Toggle : 1er clic démarre l'écoute (fr-FR), 2e clic arrête. Le texte s'écrit dans la note.
    dictate: function (btn) {
      var box = btn.closest('.v2-notes-box'); if (!box) return;
      var ta = box.querySelector('.v2-notes-ta'); if (!ta) return;
      // déjà en écoute sur ce bouton → on arrête
      if (_rec && _recBtn === btn) { _rec._arretDemande = true; try { _rec.stop(); } catch (e) {} return; }
      if (_rec) { _rec._arretDemande = true; try { _rec.stop(); } catch (e) {} }
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { if (V2.toast) V2.toast('La dictée vocale n\'est pas disponible sur ce navigateur'); return; }

      // Ce qui était déjà écrit dans la note avant de commencer à dicter.
      var base = ta.value ? (ta.value.replace(/\s+$/, '') + ' ') : '';
      var acquis = '';        // tout ce qui a été définitivement reconnu depuis le début
      var affiche = '';       // dernier texte réellement montré à l'écran
      var arret = false;      // l'utilisateur a-t-il touché le micro pour arrêter ?
      var relances = 0;       // garde-fou : jamais de relance en boucle infinie

      // enCours = on est au milieu d'une phrase : on garde l'espace final qui sépare
      // les mots à venir. Sinon on nettoie, pour ne pas laisser d'espace qui traîne.
      function ecrire(txt, enCours) {
        affiche = txt.replace(/\s+/g, ' ').replace(/^\s/, '');
        if (!enCours) affiche = affiche.replace(/\s+$/, '');
        ta.value = affiche;
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
          // On RECONSTRUIT le texte depuis l'ensemble des résultats à chaque événement
          // (idempotent) au lieu d'accumuler avec += : sur mobile, resultIndex est peu
          // fiable et l'accumulation répétait la même phrase 4-5 fois.
          var fin = '', interim = '', dernierFin = '';
          for (var i = 0; i < e.results.length; i++) {
            var brut = e.results[i][0].transcript || '';
            if (e.results[i].isFinal) {
              var t = brut.trim();
              // Safari ré-émet parfois le MÊME segment final plusieurs fois → on saute les doublons consécutifs.
              if (t && t !== dernierFin) { fin += t + ' '; dernierFin = t; }
            } else { interim += brut; }
          }
          rec._fin = fin;
          rec._interim = interim;
          ecrire(base + acquis + fin + interim, !!interim);
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
          // Ce qui vient d'être reconnu est acquis pour de bon.
          // ⚠️ Safari coupe souvent SANS avoir marqué la phrase « définitive » : dans ce
          // cas on garde le texte provisoire, sinon la phrase disparaît à la relance.
          var capte = rec._fin || rec._interim || '';
          if (capte) { acquis = (acquis + capte.trim() + ' ').replace(/\s+/g, ' '); }

          // Safari (Mac et iPhone) arrête l'écoute tout seul après chaque phrase.
          // Tant que Karine n'a pas re-touché le micro, on relance : c'est ce qui
          // donnait l'impression que « le dictaphone ne marche pas ».
          if (!arret && !rec._arretDemande && relances < 60) {
            relances++;
            try { demarrer(false); return; } catch (e) {}
          }

          btn.classList.remove('rec'); btn.title = 'Dicter la note à la voix';
          _rec = null; _recBtn = null;

          // ⚠️ On ne VIDE JAMAIS la note. Avant, si aucun segment n'était marqué
          // « définitif », tout ce que Karine venait de dicter disparaissait à l'arrêt.
          var texte = (base + acquis).trim() || affiche.trim() || ta.value.trim();
          ta.value = texte;
          if (texte) { ta.focus(); }
          else if (V2.toast) V2.toast('Rien n\'a été entendu — vérifie le micro et réessaie', 'error');
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
      var done = function () { if (ta) ta.value = ''; if (V2.toast) V2.toast('Note ajoutée'); renderBox(box); };
      if (c) {
        // échec Supabase → NE PAS faire croire que c'est sauvé (avant : sauvé en local + « Note ajoutée » puis disparue au re-render qui relit Supabase)
        var fail = function () { btn.disabled = false; btn.textContent = 'Ajouter'; if (V2.toast) V2.toast('Note non enregistrée — réessaie', 'error'); };
        c.from(TABLE).insert({ scope_type: st, scope_id: String(sid), author_id: V2.user.id, author_name: V2.user.name || '', body: body })
          .then(function (r) { if (r.error) fail(); else done(); })
          .catch(function () { fail(); });
      } else { addLocal(st, sid, body); done(); }
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
          '<textarea class="v2-notes-ta v2-note-edit-ta" rows="3"></textarea>' +
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
      var fail = function () { btn.disabled = false; btn.textContent = 'Enregistrer'; if (V2.toast) V2.toast('Note non modifiée — réessaie', 'error'); };
      if (c && String(id).indexOf('n') !== 0) {
        c.from(TABLE).update({ body: body }).eq('id', id)
          .then(function (r) { if (r && r.error) fail(); else ok(); })
          .catch(function () { fail(); });
      } else {
        editLocal(st, sid, id, body); if (V2.toast) V2.toast('Note modifiée'); renderBox(box);
      }
    }
  };

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
        var mine = (res.backend === 'local') || (n.authorId && n.authorId === uid);
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
      '.v2-notes-add{display:flex;gap:9px;align-items:flex-end;margin-top:12px}',
      '.v2-notes-ta{flex:1;min-width:0;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:11px;padding:10px 12px;font:inherit;font-size:13.5px;color:var(--ip-ink);background:var(--card);resize:vertical;min-height:44px}',
      '.v2-notes-ta:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo,color-mix(in srgb,var(--ip-blue) 18%,transparent))}',
      '.v2-notes-btn{flex:none;white-space:nowrap}',
      // Bouton micro (dictée vocale) : repos = gris, écoute = rouge qui pulse
      '.v2-notes-mic{flex:none;width:44px;height:44px;border-radius:11px;border:1px solid var(--line-strong);background:var(--card);color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:color .16s var(--ease),border-color .16s var(--ease),background .16s var(--ease)}',
      '.v2-notes-mic:hover{color:var(--ip-blue);border-color:color-mix(in srgb,var(--ip-blue) 36%,var(--line))}',
      '.v2-notes-mic.rec{color:#fff;background:var(--c-rose,#FF4D6D);border-color:var(--c-rose,#FF4D6D);animation:v2micpulse 1.3s ease-in-out infinite}',
      '@keyframes v2micpulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--c-rose,#FF4D6D) 55%,transparent)}50%{box-shadow:0 0 0 6px color-mix(in srgb,var(--c-rose,#FF4D6D) 0%,transparent)}}',
      '@media(prefers-reduced-motion:reduce){.v2-notes-mic.rec{animation:none}}'
    ].join('');
    document.head.appendChild(s);
  }
})();
