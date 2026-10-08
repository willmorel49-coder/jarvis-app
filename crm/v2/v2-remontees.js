/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Remontées / améliorations équipe (V2.pages.remontees)
   Mur d'idées interne : chaque commercial poste une amélioration, vote
   pour celles des autres, suit leur avancement. Partagé via Supabase
   (table `improvements`) avec REPLI localStorage tant que la table n'existe
   pas → marche en local tout de suite, partage activé dès le SQL passé.
   Outil INTERNE (aucun prix, aucun abandon de marge) — gate non-OPSO.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  var TABLE = 'improvements', LS = 'jarvis_improvements_v1';
  var backend = 'local', items = [], sortBy = 'date';
  // La base n'accepte que nouveau / en cours / fait : « en cours » s'affiche « En réflexion » (12/09/2026).
  var STATUS = { nouveau: { l: 'Nouveau', c: 'var(--c-amber)' }, 'en cours': { l: 'En réflexion', c: 'var(--ip-blue)' }, fait: { l: 'Fait', c: 'var(--c-mint)' } };
  // Réponses de l'admin : une ligne de `profils`, data = { idIdée: { t, par, le } }. La base n'accepte que
  // des types existants : 'groupement' avec un nom qu'aucun groupement ne porte (jamais lu en bloc).
  var REP = { st: 'groupement', sid: '__remontees_reponses__' }, reponses = {};

  // Capture d'écran jointe à une idée (02/10/2026). Rangée dans `excel-imports` — le seul espace de fichiers
  // FERMÉ où un compte connecté peut écrire — sous remontees/<id de l'idée>.jpg : ni colonne ni table à créer.
  // Jamais un espace public : une capture du CRM peut montrer des conditions commerciales.
  var CAP = { seau: 'excel-imports', dossier: 'remontees', cote: 2000, maxOctets: 20 * 1048576 };
  var capBlob = null, capUrl = null, caps = {}, capsCle = '', capsLe = 0;

  function sb() { return (V2.sb && V2.sb()) || null; }
  // Toute image (capture collée, fichier, photo du téléphone) est réduite à 2 000 px et passée en JPEG.
  function capPreparer(f) {
    return new Promise(function (ok, ko) {
      if (!f || !/^image\//.test(f.type || '')) return ko(new Error('type'));
      if (f.size > CAP.maxOctets) return ko(new Error('poids'));
      var u = URL.createObjectURL(f), im = new Image();
      im.onload = function () {
        var k = Math.min(1, CAP.cote / Math.max(im.naturalWidth, im.naturalHeight, 1));
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(im.naturalWidth * k)); cv.height = Math.max(1, Math.round(im.naturalHeight * k));
        var x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
        x.drawImage(im, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(u);
        cv.toBlob(function (b) { if (b) ok(b); else ko(new Error('image')); }, 'image/jpeg', 0.85);
      };
      im.onerror = function () { URL.revokeObjectURL(u); ko(new Error('image')); };
      im.src = u;
    });
  }
  // Captures des idées affichées : une lecture du dossier, puis des liens temporaires (1 h) gardés tant que rien ne change.
  function loadCaps(c) {
    if (!c.storage) return Promise.resolve();
    return c.storage.from(CAP.seau).list(CAP.dossier, { limit: 1000 }).then(function (r) {
      if (r.error || !r.data) return;
      var connus = {}; items.forEach(function (it) { connus[it.id + '.jpg'] = 1; });
      var noms = r.data.filter(function (f) { return f.id && connus[f.name]; }).map(function (f) { return f.name; });
      var cle = noms.join('|');
      if (!noms.length) { caps = {}; capsCle = ''; return; }
      if (cle === capsCle && Date.now() - capsLe < 45 * 60000) return;
      return c.storage.from(CAP.seau).createSignedUrls(noms.map(function (n) { return CAP.dossier + '/' + n; }), 3600).then(function (s) {
        if (s.error || !s.data) return;
        var m = {};
        s.data.forEach(function (x, i) { if (x && x.signedUrl) m[noms[i].replace(/\.jpg$/, '')] = x.signedUrl; });
        caps = m; capsCle = cle; capsLe = Date.now();
      });
    }).catch(function () {});
  }
  function localAll() { try { var a = JSON.parse(localStorage.getItem(LS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function localWrite(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} }
  function newId() { return 'r' + Date.now() + Math.floor((window.performance && performance.now ? performance.now() : 0) % 1000); }
  function fromRow(r) {
    return { id: r.id, author: r.author_name || '—', body: r.body || '', status: r.status || 'nouveau',
             votes: r.votes || 0, created: r.created_at ? new Date(r.created_at).getTime() : Date.now() };
  }
  function sortList(a) {
    return a.slice().sort(function (x, y) { return sortBy === 'votes' ? (y.votes - x.votes) || (y.created - x.created) : (y.created - x.created); });
  }

  function loadItems() {
    var c = sb();
    if (c) {
      var rep = c.from('profils').select('data').eq('scope_type', REP.st).eq('scope_id', REP.sid).maybeSingle()
        .then(function (r) { if (!r.error) reponses = (r.data && r.data.data) || {}; }).catch(function () {});
      return Promise.all([rep, c.from(TABLE).select('*').order('created_at', { ascending: false })]).then(function (x) { return x[1]; })
        .then(function (r) {
          if (!r.error && r.data) { backend = 'supabase'; items = r.data.map(fromRow); return loadCaps(c).then(function () { return items; }); }
          backend = 'local'; items = localAll(); return items;
        }).catch(function () { backend = 'local'; items = localAll(); return items; });
    }
    backend = 'local'; items = localAll(); return Promise.resolve(items);
  }

  // ── POPUP « proposer une idée » (accessible partout via la topbar) ──
  V2.remonteeOpen = function () {
    if (!V2.user) { if (V2.toast) V2.toast('Connecte-toi pour proposer une idée'); return; }
    ensureCss();
    var ex = document.getElementById('v2-remonte-pop'); if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
    var o = document.createElement('div');
    o.id = 'v2-remonte-pop'; o.className = 'v2-rem-ov';
    o.innerHTML =
      '<div class="v2-rem-card" role="dialog" aria-label="Proposer une amélioration">' +
        '<div class="v2-rem-h"><span class="v2-rem-h-t">Une idée d\'amélioration&nbsp;?</span>' +
          '<button class="v2-rem-x" aria-label="Fermer" onclick="V2.remonteeClose()">&times;</button></div>' +
        '<div class="v2-rem-h-s">Bug, idée, manque… toute l\'équipe la verra.</div>' +
        '<textarea id="v2-rem-ta" class="v2-rem-ta" rows="4" placeholder="Ex : pouvoir filtrer les officines par groupement sur la carte…"></textarea>' +
        '<input type="file" id="v2-rem-file" accept="image/*" hidden>' +
        '<div id="v2-rem-cap" class="v2-rem-cap"></div>' +
        '<div class="v2-rem-foot"><span class="v2-rem-by">au nom de <b>' + esc(V2.user.name || '') + '</b></span>' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.remonteeSubmit(this)">Envoyer à l\'équipe</button></div>' +
      '</div>';
    o.addEventListener('click', function (e) { if (e.target === o) V2.remonteeClose(); });
    // capture : collée (⌘V), glissée sur la fenêtre, ou choisie par le bouton
    o.addEventListener('paste', function (e) {
      var f = imageDe(e.clipboardData); if (!f) return;
      e.preventDefault(); capPoser(f);
    });
    o.addEventListener('dragover', function (e) { e.preventDefault(); });
    o.addEventListener('drop', function (e) { e.preventDefault(); var f = imageDe(e.dataTransfer); if (f) capPoser(f); });
    document.body.appendChild(o);
    document.getElementById('v2-rem-file').addEventListener('change', function () { if (this.files && this.files[0]) capPoser(this.files[0]); this.value = ''; });
    capVider();
    requestAnimationFrame(function () { o.classList.add('show'); var t = document.getElementById('v2-rem-ta'); if (t) t.focus(); });
    document.addEventListener('keydown', escClose);
  };
  function escClose(e) { if (e.key === 'Escape') V2.remonteeClose(); }
  function imageDe(dt) {
    if (!dt) return null;
    var i, fs = dt.files || [], its = dt.items || [];
    for (i = 0; i < fs.length; i++) if (/^image\//.test(fs[i].type || '')) return fs[i];
    for (i = 0; i < its.length; i++) if (its[i].kind === 'file' && /^image\//.test(its[i].type || '')) return its[i].getAsFile();
    return null;
  }
  function capPoser(f) {
    capPreparer(f).then(function (b) {
      if (capUrl) URL.revokeObjectURL(capUrl);
      capBlob = b; capUrl = URL.createObjectURL(b); capDessiner();
    }).catch(function (e) {
      if (V2.toast) V2.toast(e && e.message === 'poids' ? 'Image trop lourde (20 Mo au plus)' : 'Cette image ne peut pas être lue', 'error');
    });
  }
  function capVider() { if (capUrl) URL.revokeObjectURL(capUrl); capBlob = null; capUrl = null; capDessiner(); }
  function capDessiner() {
    var z = document.getElementById('v2-rem-cap'); if (!z) return;
    z.innerHTML = capUrl
      ? '<div class="v2-rem-prev"><img src="' + capUrl + '" alt="Capture jointe"><span class="v2-rem-prev-t">Capture jointe</span>' +
        '<button type="button" class="v2-rem-prev-x" onclick="V2.remonteeCapClear()">Retirer</button></div>'
      : '<button type="button" class="v2-rem-join" onclick="V2.remonteeCapPick()">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 9"/></svg>' +
        'Joindre une capture d\'écran</button><span class="v2-rem-join-s">ou la coller ici (⌘V)</span>';
  }
  V2.remonteeCapPick = function () { var i = document.getElementById('v2-rem-file'); if (i) i.click(); };
  V2.remonteeCapClear = function () { capVider(); };
  // Agrandir la capture d'une idée de la liste
  V2.remonteeCapOpen = function (id) {
    if (!caps[id]) return;
    var o = document.createElement('div'); o.className = 'v2-rem-ov v2-rem-zoom';
    o.innerHTML = '<img src="' + esc(caps[id]) + '" alt="Capture d\'écran jointe à la remontée">';
    var fermer = function () { document.removeEventListener('keydown', touche); if (o.parentNode) o.parentNode.removeChild(o); };
    var touche = function (e) { if (e.key === 'Escape') fermer(); };
    o.addEventListener('click', fermer); document.addEventListener('keydown', touche);
    document.body.appendChild(o);
    requestAnimationFrame(function () { o.classList.add('show'); });
  };
  V2.remonteeClose = function () {
    document.removeEventListener('keydown', escClose);
    var o = document.getElementById('v2-remonte-pop'); if (!o) return;
    o.classList.remove('show'); setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 200);
    if (capUrl) URL.revokeObjectURL(capUrl); capBlob = null; capUrl = null;
  };
  V2.remonteeSubmit = function (btn) {
    var ta = document.getElementById('v2-rem-ta'); if (!ta) return;
    var body = (ta.value || '').trim();
    if (!body) { ta.focus(); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Envoi…'; }
    var c = sb();
    var done = function () {
      V2.remonteeClose();
      if (V2.toast) V2.toast('Idée envoyée à l\'équipe ✨');
      if (V2.route && V2.route.name === 'remontees') V2.render();
    };
    if (c) {
      // « Idée envoyée à l'équipe » ne doit pas s'afficher si l'idée n'est PAS partie.
      var img = capBlob;
      var repli = function () {
        saveLocalNew(body);
        if (V2.toast) V2.toast('Idée gardée sur cet ordinateur seulement — pas envoyée à l\'équipe' + (img ? ', capture non jointe' : ''), 'error');
        if (V2.route && V2.route.name === 'remontees') V2.render();
      };
      var q = c.from(TABLE).insert({ author_id: V2.user.id, author_name: V2.user.name || '', body: body, status: 'nouveau', votes: 0 });
      if (img) q = q.select('id').single();   // la capture porte l'identifiant de l'idée
      q.then(function (r) {
          if (r.error) { try { console.warn('[remontees]', r.error.message); } catch (e) {} repli(); return; }
          if (!img) return done();
          // l'idée est partie ; si la capture ne suit pas, on le dit au lieu d'annoncer un envoi complet
          var sansCap = function () {
            V2.remonteeClose();
            if (V2.toast) V2.toast('Idée envoyée, mais la capture n\'a pas pu être jointe', 'error');
            if (V2.route && V2.route.name === 'remontees') V2.render();
          };
          if (!c.storage || !r.data || !r.data.id) return sansCap();
          return c.storage.from(CAP.seau).upload(CAP.dossier + '/' + r.data.id + '.jpg', img, { contentType: 'image/jpeg', upsert: false })
            .then(function (u) { if (u.error) { try { console.warn('[remontees] capture', u.error.message); } catch (e) {} sansCap(); } else done(); })
            .catch(sansCap);
        }).catch(function () { repli(); });
    } else { saveLocalNew(body); done(); }
  };
  function saveLocalNew(body) {
    var a = localAll();
    a.unshift({ id: newId(), author: (V2.user && V2.user.name) || '—', body: body, status: 'nouveau', votes: 0, created: Date.now() });
    localWrite(a);
  }

  // ── VOTE + STATUT ──
  V2.remonteeVote = function (id) {
    var c = sb();
    if (backend === 'supabase' && c && String(id).indexOf('r') !== 0) {
      c.rpc('increment_improvement_votes', { imp_id: id }).then(function () { reload(); }).catch(function () { reload(); });
    } else {
      var a = localAll(); for (var i = 0; i < a.length; i++) if (a[i].id === id) { a[i].votes = (a[i].votes || 0) + 1; break; }
      localWrite(a); reload();
    }
  };
  V2.remonteeStatus = function (id) {
    var order = ['nouveau', 'en cours', 'fait'];
    var cur = null; for (var i = 0; i < items.length; i++) if (items[i].id === id) { cur = items[i].status; break; }
    var next = order[(order.indexOf(cur) + 1) % order.length];
    var c = sb();
    if (backend === 'supabase' && c && String(id).indexOf('r') !== 0) {
      c.from(TABLE).update({ status: next }).eq('id', id).then(function () { reload(); }).catch(function () { reload(); });
    } else {
      var a = localAll(); for (var k = 0; k < a.length; k++) if (a[k].id === id) { a[k].status = next; break; }
      localWrite(a); reload();
    }
  };
  // Réponse de l'admin, visible par toute l'équipe sous l'idée
  V2.remonteeReply = function (id) {
    var c = sb();
    if (!V2.user || V2.user.role !== 'admin') return;
    if (!(backend === 'supabase' && c)) { if (V2.toast) V2.toast('Réponse impossible hors connexion', 'error'); return; }
    var txt = window.prompt('Réponse visible par toute l\'équipe :', (reponses[id] && reponses[id].t) || '');
    if (txt === null) return;
    var ko = function () { if (V2.toast) V2.toast('Réponse non enregistrée', 'error'); reload(); };
    // relire la ligne juste avant d'écrire : ne pas écraser une réponse posée entre-temps ailleurs
    c.from('profils').select('data').eq('scope_type', REP.st).eq('scope_id', REP.sid).maybeSingle().then(function (r) {
      if (r.error) return ko();
      var data = (r.data && r.data.data) || {};
      if (txt.trim()) data[id] = { t: txt.trim(), par: V2.user.name || '', le: new Date().toISOString() }; else delete data[id];
      return c.from('profils').upsert({ scope_type: REP.st, scope_id: REP.sid, data: data, updated_by: V2.user.id, updated_by_name: V2.user.name || '', updated_at: new Date().toISOString() }, { onConflict: 'scope_type,scope_id' })
        .then(function (u) { if (u.error) ko(); else reload(); });
    }).catch(ko);
  };
  V2.remonteeSort = function (s) { sortBy = s; reload(); };
  function reload() { loadItems().then(function () { if (V2.route && V2.route.name === 'remontees') V2.render(); }); }

  // ── PAGE LISTE ──
  V2.pages.remontees = {
    needs: [],   // audité 11/09/2026 : aucune lecture du catalogue
    render: function (root) {
      ensureCss();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      root.innerHTML = top +
        '<div class="v2-wrap narrow">' +
          '<div class="v2-rem-hero"><h1>Remontées de l\'équipe</h1>' +
            '<p>Proposez une amélioration, votez pour celles des autres, suivez leur avancement.</p>' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.remonteeOpen()">' + (V2.ICO ? V2.ICO('plus', 15, 2) : '+') + ' Proposer une idée</button></div>' +
          '<div class="v2-rem-tools"><span class="v2-rem-count" id="v2-rem-count"></span>' +
            '<div class="v2-rem-seg"><button class="' + (sortBy === 'date' ? 'on' : '') + '" onclick="V2.remonteeSort(\'date\')">Récentes</button>' +
              '<button class="' + (sortBy === 'votes' ? 'on' : '') + '" onclick="V2.remonteeSort(\'votes\')">Populaires</button></div></div>' +
          '<div id="v2-rem-list" class="v2-rem-list"><div class="v2-rem-empty">Chargement…</div></div>' +
        '</div>';
      loadItems().then(function (list) {
        var box = document.getElementById('v2-rem-list'); if (!box) return;
        var cnt = document.getElementById('v2-rem-count');
        if (cnt) cnt.textContent = list.length + (list.length > 1 ? ' remontées' : ' remontée') + (backend === 'local' ? ' · sur cet appareil' : '');
        if (!list.length) { box.innerHTML = '<div class="v2-rem-empty">Aucune remontée pour l\'instant. Soyez le premier à proposer une idée&nbsp;!</div>'; return; }
        box.innerHTML = sortList(list).map(cardHtml).join('');
      });
    }
  };
  function cardHtml(it) {
    var st = STATUS[it.status] || STATUS.nouveau;
    var d = ''; try { d = new Date(it.created).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); } catch (e) {}
    var mine = V2.user && backend === 'local'; // en local tout est à soi ; en supabase l'auteur est déjà filtré par nom
    var rep = backend === 'supabase' ? reponses[it.id] : null;
    var admin = V2.user && V2.user.role === 'admin' && backend === 'supabase';
    return '<div class="v2-rem-item">' +
      '<button class="v2-rem-vote" onclick="V2.remonteeVote(\'' + esc(it.id) + '\')" title="Voter"><span class="v2-rem-up">▲</span><b>' + it.votes + '</b></button>' +
      '<div class="v2-rem-body"><div class="v2-rem-txt">' + esc(it.body).replace(/\n/g, '<br>') + '</div>' +
        (backend === 'supabase' && caps[it.id] ? '<button type="button" class="v2-rem-shot" onclick="V2.remonteeCapOpen(\'' + esc(it.id) + '\')" title="Agrandir la capture">' +
          '<img loading="lazy" src="' + esc(caps[it.id]) + '" alt="Capture d\'écran jointe"></button>' : '') +
        (rep && rep.t ? '<div class="v2-rem-rep"><b>' + esc(rep.par || 'Réponse') + '</b>' + esc(rep.t).replace(/\n/g, '<br>') + '</div>' : '') +
        '<div class="v2-rem-meta"><span>' + esc(it.author) + (d ? ' · ' + d : '') + '</span><span class="v2-rem-acts">' +
          (admin ? '<button class="v2-rem-repbtn" onclick="V2.remonteeReply(\'' + esc(it.id) + '\')">' + (rep && rep.t ? 'Modifier la réponse' : 'Répondre') + '</button>' : '') +
          '<button class="v2-rem-st" style="--stc:' + st.c + '" onclick="V2.remonteeStatus(\'' + esc(it.id) + '\')" title="Changer le statut">' + st.l + '</button>' +
        '</span></div></div></div>';
  }

  function ensureCss() {
    if (document.getElementById('v2-rem-css')) return;
    var s = document.createElement('style'); s.id = 'v2-rem-css';
    s.textContent = [
      '.v2-rem-hero{text-align:center;margin:8px 0 18px}',
      '.v2-rem-hero h1{font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.v2-rem-hero p{color:var(--muted);font-size:14px;max-width:46ch;margin:0 auto 16px;line-height:1.5}',
      '.v2-rem-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}',
      '.v2-rem-count{font-size:12.5px;color:var(--muted);font-weight:600}',
      '.v2-rem-seg{display:inline-flex;gap:2px;padding:3px;background:var(--card-2);border:1px solid var(--line);border-radius:10px}',
      '.v2-rem-seg button{border:none;background:none;padding:6px 12px;border-radius:7px;font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer}',
      '.v2-rem-seg button.on{background:var(--card);color:var(--ip-ink);box-shadow:var(--sh-1)}',
      '@media(max-width:640px){.v2-rem-seg button{min-height:44px}}',
      '.v2-rem-list{display:flex;flex-direction:column;gap:10px}',
      '.v2-rem-empty{padding:40px 20px;text-align:center;color:var(--muted);font-size:14px;background:var(--card-2);border:1px dashed var(--line-strong);border-radius:var(--r-md)}',
      '.v2-rem-item{display:flex;gap:13px;padding:14px 16px;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:var(--sh-1)}',
      '.v2-rem-vote{flex:none;display:flex;flex-direction:column;align-items:center;gap:1px;min-width:44px;border:1px solid var(--line);background:var(--card-2);border-radius:10px;padding:7px 0;cursor:pointer;color:var(--muted);transition:border-color .16s,color .16s,background .16s}',
      '.v2-rem-vote:hover{border-color:var(--ip-blue);color:var(--ip-blue);background:color-mix(in srgb,var(--ip-blue) 8%,var(--card))}',
      '.v2-rem-up{font-size:11px;line-height:1}',
      '.v2-rem-vote b{font-size:14px;font-variant-numeric:tabular-nums;color:var(--ip-ink)}',
      '.v2-rem-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:9px}',
      '.v2-rem-txt{font-size:14px;line-height:1.5;color:var(--ip-ink)}',
      '.v2-rem-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:var(--muted)}',
      '.v2-rem-rep{font-size:13.5px;line-height:1.5;color:var(--ip-ink);background:color-mix(in srgb,var(--c-mint) 9%,var(--card));border-left:3px solid var(--c-mint);border-radius:8px;padding:9px 12px}',
      '.v2-rem-rep b{display:block;font-size:11.5px;font-weight:800;color:var(--ip-ink);margin-bottom:2px}',
      '.v2-rem-acts{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}',
      '.v2-rem-repbtn{border:1px solid var(--line);background:var(--card-2);color:var(--ip-ink);font:inherit;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:var(--r-pill);cursor:pointer;min-height:28px}',
      '.v2-rem-st{border:1px solid color-mix(in srgb,var(--stc) 40%,var(--line));background:color-mix(in srgb,var(--stc) 12%,var(--card));color:var(--stc);font:inherit;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;padding:4px 10px;border-radius:var(--r-pill);cursor:pointer}',
      // popup
      '.v2-rem-ov{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(16,19,28,.5);opacity:0;transition:opacity .2s}',
      '.v2-rem-ov.show{opacity:1}',
      '.v2-rem-card{background:var(--card);border:1px solid var(--line);border-radius:20px;max-width:440px;width:100%;padding:22px 22px 18px;box-shadow:0 24px 60px rgba(16,19,28,.3);transform:translateY(8px);transition:transform .22s}',
      '.v2-rem-ov.show .v2-rem-card{transform:none}',
      '.v2-rem-h{display:flex;align-items:center;justify-content:space-between;gap:10px}',
      '.v2-rem-h-t{font-size:18px;font-weight:800;letter-spacing:-.02em;color:var(--ip-ink)}',
      '.v2-rem-x{border:none;background:none;font-size:26px;line-height:1;color:var(--muted);cursor:pointer;width:32px;height:32px;border-radius:8px}',
      '.v2-rem-x:hover{background:var(--card-2);color:var(--ip-ink)}',
      '.v2-rem-h-s{font-size:13px;color:var(--muted);margin:2px 0 14px}',
      '.v2-rem-ta{width:100%;box-sizing:border-box;border:1px solid var(--line-strong);border-radius:12px;padding:12px 14px;font:inherit;font-size:14px;color:var(--ip-ink);background:var(--card-2);resize:vertical;min-height:96px}',
      '.v2-rem-ta:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo,color-mix(in srgb,var(--ip-blue) 18%,transparent))}',
      '.v2-rem-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}',
      '.v2-rem-by{font-size:12px;color:var(--muted)}',
      // capture d'écran : zone du formulaire, vignette de la liste, agrandissement
      '.v2-rem-cap{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}',
      '.v2-rem-join{display:inline-flex;align-items:center;gap:7px;border:1px dashed var(--line-strong);background:var(--card-2);color:var(--ip-ink);font:inherit;font-size:13px;font-weight:700;padding:8px 12px;border-radius:10px;cursor:pointer;min-height:40px}',
      '.v2-rem-join:hover{border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.v2-rem-join-s{font-size:12px;color:var(--muted)}',
      '@media(max-width:640px){.v2-rem-join{min-height:44px}.v2-rem-join-s{display:none}}',
      '.v2-rem-prev{display:flex;align-items:center;gap:10px;width:100%;padding:6px;border:1px solid var(--line);border-radius:12px;background:var(--card-2)}',
      '.v2-rem-prev img{width:72px;height:54px;object-fit:cover;object-position:top left;border-radius:8px;border:1px solid var(--line);background:#fff}',
      '.v2-rem-prev-t{flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--ip-ink)}',
      '.v2-rem-prev-x{border:1px solid var(--line);background:var(--card);color:var(--ip-ink);font:inherit;font-size:12px;font-weight:700;padding:6px 12px;border-radius:var(--r-pill);cursor:pointer;min-height:32px}',
      '@media(max-width:640px){.v2-rem-prev-x{min-height:44px}}',
      '.v2-rem-shot{align-self:flex-start;display:block;max-width:100%;padding:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--card-2);cursor:zoom-in;line-height:0}',
      '.v2-rem-shot:hover{border-color:var(--ip-blue)}',
      '.v2-rem-shot img{display:block;max-width:100%;width:auto;height:auto;max-height:170px}',
      '.v2-rem-zoom{cursor:zoom-out;padding:16px}',
      '.v2-rem-zoom img{max-width:100%;max-height:100%;border-radius:10px;box-shadow:0 24px 60px rgba(16,19,28,.4);background:#fff}'
    ].join('');
    document.head.appendChild(s);
  }
})();
