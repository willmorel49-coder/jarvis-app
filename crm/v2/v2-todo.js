/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Ma liste — les choses à faire du commercial (V2.todo / V2.pages.todo)
   Demande de Will, 23/09/2026 : « une to do list : les demandes de rendez-vous
   à faire avec un mail type suite à un passage dans la pharmacie ; à la suite
   d'un rendez-vous, mail type et documents à joindre ; mail type d'ouverture
   de compte et document à joindre ; et une to do list sur d'autres choses à
   faire si besoin, avec la possibilité de cocher. »

   Quatre sortes de lignes, chacune avec son geste :
     rdv    → mail « suite à mon passage » avec le lien de prise de rendez-vous
     merci  → mail de remerciement (le modèle existant de v2-rdv-modeles) + pièces jointes
     compte → mail d'ouverture de compte + formulaire 2026 pré-coché dans « Transmettre »
     libre  → n'importe quoi d'autre, juste à cocher

   PERSONNELLE : une ligne `profils` par personne (data = { items: [...] }),
   même astuce que les réponses des remontées — la base n'accepte que des
   scope_type existants, donc 'groupement' avec un nom qu'aucun groupement ne
   porte, et jamais lu en bloc. Repli localStorage hors connexion.
   Le mail part de SA boîte (mailto:), JARVIS n'envoie rien à sa place ; les
   fichiers partent en pièces jointes via la fenêtre « Transmettre » existante.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };   // v2-icons.js expose window.ICO
  var LS = 'jarvis_todo_v1';

  var KINDS = {
    rdv:    { l: 'Demande de rendez-vous', s: 'suite à un passage à l\'officine', ico: 'cal',   mail: 'Écrire la demande de rendez-vous' },
    merci:  { l: 'Après le rendez-vous',   s: 'mot de remerciement + documents',  ico: 'check', mail: 'Écrire le mot de remerciement', docs: 'Joindre les documents' },
    compte: { l: 'Ouverture de compte',    s: 'mail + formulaire à joindre',      ico: 'fiche', mail: 'Écrire le mail d\'ouverture',   docs: 'Joindre le formulaire', presel: ['S:ouverture-compte-integral-pharma-2026.pdf'] },
    libre:  { l: 'Autre chose à faire',    s: '',                                  ico: 'list' }
  };
  var ORDER = ['rdv', 'merci', 'compte', 'libre'];

  var st = { items: null, backend: 'local', filtre: 'afaire', chargement: null, kind: 'rdv' };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function scope() { return { st: 'groupement', sid: '__todo_' + ((V2.user && V2.user.id) || 'local') + '__' }; }
  function lsKey() { return LS + ':' + ((V2.user && V2.user.id) || 'local'); }
  function localRead() { try { var a = JSON.parse(localStorage.getItem(lsKey()) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function localWrite(a) { try { localStorage.setItem(lsKey(), JSON.stringify(a)); } catch (e) {} }
  function sur(v) { return String(v == null ? '' : v).replace(/[^0-9A-Za-z_-]/g, ''); }
  function newId() { return 't' + Date.now() + Math.floor(Math.random() * 1000); }
  function nettoie(a) {
    return (Array.isArray(a) ? a : []).filter(function (x) { return x && sur(x.id) && KINDS[x.k]; }).map(function (x) {
      return { id: sur(x.id), k: x.k, pid: sur(x.pid), nom: String(x.nom || ''), mail: String(x.mail || ''),
               note: String(x.note || ''), pour: String(x.pour || ''), fait: !!x.fait, faitLe: x.faitLe || '', cree: x.cree || new Date().toISOString() };
    });
  }

  // ── Stockage ────────────────────────────────────────────────────
  function charger(force) {
    if (st.chargement && !force) return st.chargement;
    var c = sb(), s = scope();
    st.chargement = (c && V2.user ? c.from('profils').select('data').eq('scope_type', s.st).eq('scope_id', s.sid).maybeSingle()
      .then(function (r) {
        if (r.error) throw r.error;
        st.backend = 'supabase';
        st.items = nettoie(r.data && r.data.data && r.data.data.items);
        localWrite(st.items);
        return st.items;
      }).catch(function () { st.backend = 'local'; st.items = nettoie(localRead()); return st.items; })
      : Promise.resolve().then(function () { st.backend = 'local'; st.items = nettoie(localRead()); return st.items; }));
    return st.chargement;
  }
  // Relit la ligne juste avant d'écrire : l'iPhone et le Mac de la même personne
  // ne doivent pas s'écraser l'un l'autre. `fn` transforme la liste à jour.
  function ecrire(fn) {
    var c = sb(), s = scope();
    if (!(c && V2.user && st.backend === 'supabase')) {
      st.items = fn(nettoie(st.items || localRead())); localWrite(st.items);
      return Promise.resolve(true);
    }
    return c.from('profils').select('data').eq('scope_type', s.st).eq('scope_id', s.sid).maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      var items = fn(nettoie(r.data && r.data.data && r.data.data.items));
      return c.from('profils').upsert({ scope_type: s.st, scope_id: s.sid, data: { items: items }, updated_by: V2.user.id,
        updated_by_name: V2.user.name || '', updated_at: new Date().toISOString() }, { onConflict: 'scope_type,scope_id' })
        .then(function (u) { if (u.error) throw u.error; st.items = items; localWrite(items); return true; });
    }).catch(function () {
      // la base n'a pas répondu : on garde quand même sur cet appareil et on le dit
      st.items = fn(nettoie(st.items || localRead())); localWrite(st.items);
      if (V2.toast) V2.toast('Gardé sur cet appareil seulement — la base n\'a pas répondu', 'warn');
      return false;
    });
  }

  // ── Officines : nom, e-mail ─────────────────────────────────────
  function client(pid) { return (V2.pharmacies || []).find(function (p) { return String(p.id) === String(pid); }) || null; }
  function mailDe(it) {
    if (it.mail) return it.mail;
    var p = it.pid ? client(it.pid) : null;
    var m = p && p.email != null ? String(p.email).trim() : '';
    if (!m && it.pid && V2.rdvInfo) { try { m = String((V2.rdvInfo(it.pid) || {}).email || '').trim(); } catch (e) {} }
    return m;
  }
  function prenom() { return String((V2.user && V2.user.name) || '').split(' ')[0] || ''; }
  // Le nom de la société dans les mails, comme v2-rdv-modeles — pas V2_BRAND.name, qui est le nom de l'app.
  function marque() { return 'Intégral Pharma'; }
  function signature() {
    var t = String(V2.rdvTel || '').trim();
    return '\n\nCordialement,\n\n' + ((V2.user && V2.user.name) || prenom()) + '\n' + marque() + (t ? '\n' + t : '');
  }
  function dateFr(iso) {
    if (!iso) return '';
    var d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  // ── Les trois mails types ───────────────────────────────────────
  function mailRdv(it, lien) {
    var corps = 'Bonjour,\n\n' +
      'Merci pour l\'accueil qui m\'a été réservé lors de mon passage dans votre officine' +
      (it.cree ? ' le ' + dateFr(it.cree.slice(0, 10)) : '') + '.\n\n' +
      'Comme évoqué, je vous propose que nous prenions un moment ensemble. Trois points au programme :\n\n' +
      (it.pid && client(it.pid)
        ? '• Vos chiffres — votre activité avec ' + marque() + ' depuis le début de l\'année.\n' +
          '• Votre liste personnalisée — établie avant ma venue à partir de ce que vous commandez.\n'
        : '• Notre offre — les gammes et les références les plus commandées par les officines que nous livrons.\n' +
          '• Une liste personnalisée — préparée avant ma venue pour votre officine.\n') +
      '• L\'actualité du secteur — réglementation, approvisionnement, rémunération de l\'officine.\n\n' +
      (lien ? 'Vous choisissez la date et l\'heure qui vous conviennent :\n' + lien
            : 'Indiquez-moi simplement le jour et l\'heure qui vous arrangent, en réponse à ce mail ou par téléphone.') +
      signature();
    return { objet: 'Suite à mon passage dans votre officine', corps: corps };
  }
  function mailMerci(it, lien) {
    if (window.V2MOD && window.V2MOD.remerciement) {
      return window.V2MOD.remerciement({ nom_officine: it.nom, prenom_commercial: prenom(),
        nom_complet_commercial: (V2.user && V2.user.name) || '', tel_commercial: V2.rdvTel || '', lien: lien || '' });
    }
    return { objet: 'Merci pour votre accueil', corps: 'Bonjour,\n\nJe vous remercie pour le temps que vous m\'avez accordé.' +
      '\n\nSi une question vous revient, mon numéro figure ci-dessous.' + signature() };
  }
  function mailCompte(it) {
    var corps = 'Bonjour,\n\n' +
      'Comme convenu, vous trouverez ci-joint le formulaire d\'ouverture de compte ' + marque() + '.\n\n' +
      'Il suffit de le compléter, de le signer et de me le retourner en réponse à ce mail, avec les pièces indiquées sur le formulaire. ' +
      'Dès réception, votre compte est créé et vos premières commandes peuvent partir.\n\n' +
      'Je reste à votre disposition pour toute question.' + signature();
    return { objet: 'Ouverture de votre compte ' + marque(), corps: corps };
  }
  function ouvrirMail(dest, m) {
    var url = 'mailto:' + encodeURIComponent(dest || '') + '?subject=' + encodeURIComponent(m.objet) + '&body=' + encodeURIComponent(m.corps);
    if (V2.rdv && V2.rdv._ouvrir) V2.rdv._ouvrir(url); else window.location.href = url;
  }

  // ── API ─────────────────────────────────────────────────────────
  V2.todo = {
    charger: charger,
    ouverts: function () { return (st.items || []).filter(function (x) { return !x.fait; }); },

    // Petite fenêtre « Ajouter à ma liste » depuis une fiche officine (client ou prospect).
    // Sur une fiche prospect, le nom et l'e-mail sont ceux affichés à l'écran.
    menu: function (pid, mail) {
      ensureCss();
      pid = sur(pid);
      var p = client(pid), nom = p ? (p.name || '') : '';
      if (!p) {
        var nm = document.querySelector('.v2-prospect input[data-fk="nom"]'), em = document.querySelector('.v2-prospect input[data-fk="email"]');
        nom = (nm && nm.value || '').trim() || nom;
        mail = (em && em.value || '').trim() || mail || '';
      }
      var ex = document.getElementById('v2-todo-pop'); if (ex) ex.remove();
      var o = document.createElement('div');
      o.id = 'v2-todo-pop'; o.className = 'v2-todo-ov';
      o.innerHTML = '<div class="v2-todo-pop" role="dialog" aria-label="Ajouter à ma liste" onclick="event.stopPropagation()">' +
        '<div class="v2-todo-pop-h"><b>Ajouter à ma liste</b><span>' + esc(nom || 'cette officine') + '</span>' +
          '<button class="v2-todo-x" aria-label="Fermer" onclick="V2.todo.fermer()">&times;</button></div>' +
        ORDER.map(function (k) {
          return '<button class="v2-todo-choix" onclick="V2.todo.ajouterDepuis(\'' + esc(String(pid)) + '\',\'' + k + '\')">' +
            '<span class="v2-todo-ico">' + ICO(KINDS[k].ico, 16, 2) + '</span><span><b>' + esc(KINDS[k].l) + '</b>' +
            (KINDS[k].s ? '<small>' + esc(KINDS[k].s) + '</small>' : '') + '</span></button>';
        }).join('') +
        '</div>';
      o.onclick = V2.todo.fermer;
      o._nom = nom; o._mail = mail || '';
      document.body.appendChild(o);
    },
    fermer: function () { var ex = document.getElementById('v2-todo-pop'); if (ex) ex.remove(); },
    ajouterDepuis: function (pid, k) {
      var o = document.getElementById('v2-todo-pop');
      var nom = (o && o._nom) || '', mail = (o && o._mail) || '';
      V2.todo.fermer();
      var it = { id: newId(), k: k, pid: String(pid), nom: nom, mail: mail, note: '', pour: '', fait: false, faitLe: '', cree: new Date().toISOString() };
      st.filtre = 'afaire';   // la nouvelle ligne doit se voir en revenant sur Ma liste
      charger().then(function () { return ecrire(function (items) { return items.concat([it]); }); }).then(function () {
        if (V2.toast) V2.toast('Ajouté à ma liste : ' + KINDS[k].l + (nom ? ' · ' + nom : ''));
        if (V2.route && V2.route.name === 'home' && V2.render) V2.render();
        rendre();
      });
    },

    // Formulaire de la page
    choisir: function (k) { st.kind = k; rendre(); },
    ajouter: function () {
      var nomEl = document.getElementById('v2-todo-nom'), noteEl = document.getElementById('v2-todo-note'), pourEl = document.getElementById('v2-todo-pour');
      var nom = (nomEl && nomEl.value || '').trim(), note = (noteEl && noteEl.value || '').trim(), pour = (pourEl && pourEl.value || '').trim();
      if (!nom && !note) { if (V2.toast) V2.toast('Indiquer une officine ou une note', 'warn'); return; }
      var p = nom ? (V2.pharmacies || []).find(function (x) { return String(x.name || '').trim().toLowerCase() === nom.toLowerCase(); }) : null;
      var it = { id: newId(), k: st.kind, pid: p ? String(p.id) : '', nom: p ? p.name : nom, mail: '', note: note, pour: pour, fait: false, faitLe: '', cree: new Date().toISOString() };
      st.filtre = 'afaire';
      ecrire(function (items) { return items.concat([it]); }).then(function () {
        if (nomEl) nomEl.value = ''; if (noteEl) noteEl.value = ''; if (pourEl) pourEl.value = '';
        rendre();
      });
    },
    cocher: function (id, fait) {
      ecrire(function (items) {
        return items.map(function (x) { if (x.id === id) { x.fait = !!fait; x.faitLe = fait ? new Date().toISOString() : ''; } return x; });
      }).then(rendre);
    },
    retirer: function (id) {
      var it = (st.items || []).find(function (x) { return x.id === id; });
      if (!it || !it.fait) return;   // on ne retire qu'une ligne déjà cochée
      ecrire(function (items) { return items.filter(function (x) { return x.id !== id; }); }).then(rendre);
    },
    filtrer: function (f) { st.filtre = f; rendre(); },
    note: function (id, el) {
      var v = (el.value || '').trim();
      ecrire(function (items) { return items.map(function (x) { if (x.id === id) x.note = v; return x; }); });
    },

    // Gestes : le mail part de SA boîte ; les fichiers passent par « Transmettre »
    mail: function (id) {
      var it = (st.items || []).find(function (x) { return x.id === id; }); if (!it) return;
      var dest = mailDe(it);
      if (!dest && V2.toast) V2.toast('Pas d\'e-mail connu pour ' + (it.nom || 'cette officine') + ' — à compléter dans le mail', 'warn');
      if (it.k === 'compte') return ouvrirMail(dest, mailCompte(it));
      var lienP = (V2.rdvLien && V2.rdvLien.charger) ? V2.rdvLien.charger().then(function (l) {
        return (l && l.actif !== false && V2.rdvLien.url) ? V2.rdvLien.url(l) : '';
      }) : Promise.resolve('');
      Promise.resolve(lienP).catch(function () { return ''; }).then(function (lien) {
        ouvrirMail(dest, it.k === 'merci' ? mailMerci(it, lien || '') : mailRdv(it, lien || ''));
      });
    },
    docs: function (id) {
      var it = (st.items || []).find(function (x) { return x.id === id; }); if (!it) return;
      if (!it.pid) { if (V2.toast) V2.toast('Cette ligne n\'est rattachée à aucune officine', 'warn'); return; }
      if (!V2.pharmaTransmettre) return;
      V2.pharmaTransmettre(it.pid, KINDS[it.k].presel || null, { nom: it.nom, mail: mailDe(it) });
    },

    // Carte de l'accueil : mes lignes à faire (les plus urgentes d'abord), rien si la liste est vide.
    cardHtml: function () {
      if (st.items == null) {
        charger().then(function () { if (V2.route && V2.route.name === 'home' && V2.render) V2.render(); });
        return '';
      }
      var ouv = trier(V2.todo.ouverts()).slice(0, 6);
      // Liste vide : la carte reste là (23/09, Will ne la voyait pas), avec de quoi ajouter.
      if (!ouv.length) {
        return '<div class="v2-card" style="margin-bottom:16px;padding:14px 18px;display:flex;align-items:center;gap:12px">' +
          '<span style="flex:none;color:var(--ip-blue);display:inline-flex">' + ICO('list', 18, 2) + '</span>' +
          '<span style="flex:1;min-width:0"><b style="font-size:13px;font-weight:800;color:var(--ip-ink)">Ma liste</b>' +
            '<span style="display:block;font-size:12.5px;color:var(--ip-ink-2)">Rien à faire pour l\'instant.</span></span>' +
          '<button class="v2-btn v2-btn-ghost" style="flex:none" onclick="V2.go(\'todo\')">' + ICO('plus', 14, 2) + ' Ajouter</button></div>';
      }
      return '<div class="v2-card" style="margin-bottom:16px;padding:16px 18px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
          '<span style="font-size:13px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink)">À faire</span>' +
          '<a class="v2-card-link" onclick="V2.go(\'todo\')">Ma liste · ' + V2.todo.ouverts().length + '</a></div>' +
        ouv.map(function (it) {
          var b = badge(it);
          return '<a onclick="V2.go(\'todo\')" style="display:flex;align-items:center;gap:10px;padding:8px 0;text-decoration:none;color:inherit;cursor:pointer;border-top:1px solid var(--line);font-size:13.5px">' +
            '<span style="flex:none;color:var(--ip-blue);display:inline-flex">' + ICO(KINDS[it.k].ico, 15, 2) + '</span>' +
            '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b style="font-weight:700">' + esc(KINDS[it.k].l) + '</b>' +
              (it.nom ? ' · ' + esc(it.nom) : (it.note ? ' · ' + esc(it.note) : '')) + '</span>' +
            (b ? '<span style="flex:none;font-size:11px;font-weight:700;color:' + b.c + '">' + b.t + '</span>' : '') + '</a>';
        }).join('') + '</div>';
    }
  };

  function joursAvant(it) {
    if (!it.pour) return null;
    var d = new Date(it.pour + 'T00:00:00'); if (isNaN(d.getTime())) return null;
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  }
  function badge(it) {
    var j = joursAvant(it); if (j == null) return null;
    if (j < 0) return { c: 'var(--c-rose)', t: j === -1 ? 'Retard : hier' : 'Retard : J' + j };
    if (j === 0) return { c: 'var(--c-amber)', t: 'Aujourd\'hui' };
    return { c: 'var(--c-mint)', t: 'Dans ' + j + ' j' };
  }
  function trier(a) {
    return a.slice().sort(function (x, y) {
      var jx = joursAvant(x), jy = joursAvant(y);
      if (jx != null && jy != null && jx !== jy) return jx - jy;
      if ((jx != null) !== (jy != null)) return jx != null ? -1 : 1;
      return String(y.cree).localeCompare(String(x.cree));
    });
  }

  // ── PAGE ────────────────────────────────────────────────────────
  function rendre() { if (V2.route && V2.route.name === 'todo' && V2.render) V2.render(); }
  function ligne(it) {
    var K = KINDS[it.k], b = badge(it);
    var qui = it.nom ? (it.pid ? '<a class="v2-todo-off" onclick="V2.go(\'pharma\',\'' + esc(it.pid) + '\')">' + esc(it.nom) + '</a>' : '<span class="v2-todo-off">' + esc(it.nom) + '</span>') : '';
    var actes = it.fait ? '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.todo.retirer(\'' + it.id + '\')">Retirer de la liste</button>'
      : ((K.mail ? '<button class="v2-btn v2-btn-primary v2-todo-sm" onclick="V2.todo.mail(\'' + it.id + '\')">' + ICO('fiche', 14, 2) + esc(K.mail) + '</button>' : '') +
         (K.docs && it.pid ? '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.todo.docs(\'' + it.id + '\')">' + ICO('download', 14, 2) + esc(K.docs) + '</button>' : ''));
    return '<div class="v2-todo-it' + (it.fait ? ' is-fait' : '') + '">' +
      '<label class="v2-todo-chk"><input type="checkbox"' + (it.fait ? ' checked' : '') + ' onchange="V2.todo.cocher(\'' + it.id + '\',this.checked)" aria-label="' + (it.fait ? 'Remettre à faire' : 'Marquer comme fait') + '"><span></span></label>' +
      '<div class="v2-todo-c">' +
        '<div class="v2-todo-l1"><span class="v2-todo-k">' + ICO(K.ico, 14, 2) + esc(K.l) + '</span>' + qui +
          (b && !it.fait ? '<span class="v2-todo-b" style="color:' + b.c + '">' + b.t + '</span>' : '') +
          (it.fait && it.faitLe ? '<span class="v2-todo-b" style="color:var(--muted)">Fait le ' + esc(dateFr(it.faitLe.slice(0, 10))) + '</span>' : '') + '</div>' +
        // « Autre chose » : la note EST la tâche — affichée en entier, jamais coupée dans un champ
        (it.fait || (it.k === 'libre' && it.note) ? (it.note ? '<div class="v2-todo-n' + (it.k === 'libre' ? ' v2-todo-n-libre' : '') + '">' + esc(it.note) + '</div>' : '')
                 : '<input class="v2-todo-n-in" type="text" value="' + esc(it.note) + '" placeholder="Une précision ? (facultatif)" onchange="V2.todo.note(\'' + it.id + '\',this)">') +
        (actes ? '<div class="v2-todo-acts">' + actes + '</div>' : '') +
      '</div></div>';
  }

  V2.pages.todo = {
    needs: [],
    render: function (root) {
      ensureCss();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      if (st.items == null) {
        root.innerHTML = top + '<div class="v2-wrap narrow"><div class="v2-todo-hero"><h1>Ma liste</h1><p>Chargement…</p></div></div>';
        charger().then(rendre);
        return;
      }
      var ouv = trier(V2.todo.ouverts()), faits = (st.items || []).filter(function (x) { return x.fait; })
        .sort(function (a, b) { return String(b.faitLe).localeCompare(String(a.faitLe)); });
      var liste = st.filtre === 'fait' ? faits : ouv;
      var noms = (V2.pharmacies || []).map(function (p) { return '<option value="' + esc(p.name || '') + '">'; }).join('');
      root.innerHTML = top +
        '<div class="v2-wrap narrow">' +
          '<div class="v2-todo-hero"><h1>Ma liste</h1>' +
            '<p>Demandes de rendez-vous à envoyer, suites de rendez-vous, ouvertures de compte, et tout le reste. Personnelle : chacun voit la sienne.' +
            (st.backend === 'local' ? ' <b>Gardée sur cet appareil seulement.</b>' : '') + '</p></div>' +
          '<div class="v2-card v2-todo-add">' +
            '<div class="v2-todo-kinds">' + ORDER.map(function (k) {
              return '<button class="v2-todo-kind' + (st.kind === k ? ' is-on' : '') + '" onclick="V2.todo.choisir(\'' + k + '\')">' + ICO(KINDS[k].ico, 15, 2) + '<span>' + esc(KINDS[k].l) + '</span></button>';
            }).join('') + '</div>' +
            '<div class="v2-todo-form">' +
              '<label><span>Officine</span><input id="v2-todo-nom" list="v2-todo-noms" type="text" placeholder="Nom de l\'officine (ou rien)" autocomplete="off"><datalist id="v2-todo-noms">' + noms + '</datalist></label>' +
              '<label><span>Pour le</span><input id="v2-todo-pour" type="date"></label>' +
              '<label class="v2-todo-wide"><span>Note</span><input id="v2-todo-note" type="text" placeholder="' + (st.kind === 'libre' ? 'Ce qu\'il y a à faire' : 'Une précision (facultatif)') + '" onkeydown="if(event.key===\'Enter\')V2.todo.ajouter()"></label>' +
              '<button class="v2-btn v2-btn-primary" onclick="V2.todo.ajouter()">' + ICO('plus', 15, 2) + 'Ajouter</button>' +
            '</div>' +
            '<div class="v2-todo-hint">Depuis une fiche officine, le bouton « Ajouter à ma liste » remplit l\'officine et son e-mail tout seul.</div>' +
          '</div>' +
          '<div class="v2-todo-tools"><div class="v2-todo-seg">' +
            '<button class="' + (st.filtre !== 'fait' ? 'is-on' : '') + '" onclick="V2.todo.filtrer(\'afaire\')">À faire · ' + ouv.length + '</button>' +
            '<button class="' + (st.filtre === 'fait' ? 'is-on' : '') + '" onclick="V2.todo.filtrer(\'fait\')">Fait · ' + faits.length + '</button></div></div>' +
          (liste.length ? '<div class="v2-card v2-todo-list">' + liste.map(ligne).join('') + '</div>'
            : '<div class="v2-card v2-todo-empty">' + (st.filtre === 'fait' ? 'Rien de coché pour l\'instant.' : 'Rien à faire pour l\'instant — la liste est vide.') + '</div>') +
        '</div>';
    }
  };

  function ensureCss() {
    if (document.getElementById('v2-todo-css')) return;
    var s = document.createElement('style'); s.id = 'v2-todo-css';
    s.textContent = [
      '.v2-todo-hero{margin:8px 0 18px}',
      '.v2-todo-hero h1{font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.v2-todo-hero p{color:var(--muted);font-size:14px;max-width:60ch;margin:0;line-height:1.5}',
      '.v2-todo-add{padding:16px 18px;margin-bottom:16px}',
      '.v2-todo-kinds{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}',
      '.v2-todo-kind{display:flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:8px 10px;border:1px solid var(--line);border-radius:12px;background:var(--surf-sunken,#F4F6FA);font:inherit;font-size:12.5px;font-weight:700;color:var(--ip-ink);cursor:pointer;transition:background .15s var(--ease),border-color .15s var(--ease)}',
      '.v2-todo-kind.is-on{background:var(--halo,#E9F0FF);border-color:var(--ip-blue);color:var(--ip-blue);box-shadow:0 0 0 1px var(--ip-blue) inset}',
      '.v2-todo-form{display:grid;grid-template-columns:1fr 170px;gap:10px;align-items:end}',
      '.v2-todo-form label{display:flex;flex-direction:column;gap:4px;font-size:11.5px;font-weight:700;color:var(--muted);min-width:0}',
      '.v2-todo-form input{min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:16px;background:#fff;color:var(--ip-ink);width:100%;box-sizing:border-box}',
      '.v2-todo-form input:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo,#E9F0FF)}',
      '.v2-todo-wide{grid-column:1}',
      '.v2-todo-form .v2-btn{min-height:44px;justify-content:center}',
      '.v2-todo-hint{margin-top:10px;font-size:12.5px;color:var(--muted)}',
      '.v2-todo-tools{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}',
      '.v2-todo-seg{display:inline-flex;gap:2px;padding:3px;background:var(--surf-sunken,#F4F6FA);border:1px solid var(--line);border-radius:10px}',
      '.v2-todo-seg button{border:none;background:none;min-height:38px;padding:6px 14px;border-radius:7px;font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer}',
      '.v2-todo-seg button.is-on{background:#fff;color:var(--ip-ink);box-shadow:0 1px 3px rgba(15,20,32,.12)}',
      '.v2-todo-list{padding:4px 0}',
      '.v2-todo-empty{padding:28px 18px;text-align:center;color:var(--muted);font-size:14px}',
      '.v2-todo-it{display:flex;gap:12px;padding:14px 18px;border-top:1px solid var(--line)}',
      '.v2-todo-it:first-child{border-top:none}',
      '.v2-todo-it.is-fait .v2-todo-l1{opacity:.55;text-decoration:line-through}',
      '.v2-todo-chk{flex:none;width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;margin:-8px 0 0 -8px}',
      '.v2-todo-chk input{position:absolute;opacity:0;width:1px;height:1px}',
      '.v2-todo-chk span{width:24px;height:24px;border-radius:8px;border:2px solid var(--line-strong,#B8C0CF);background:#fff;display:inline-flex;align-items:center;justify-content:center;transition:background .15s var(--ease),border-color .15s var(--ease)}',
      '.v2-todo-chk input:checked+span{background:var(--ip-blue);border-color:var(--ip-blue)}',
      '.v2-todo-chk input:checked+span::after{content:"";width:6px;height:11px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:translateY(-1px) rotate(45deg)}',
      '.v2-todo-chk input:focus-visible+span{box-shadow:0 0 0 3px var(--halo,#E9F0FF)}',
      '.v2-todo-c{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}',
      '.v2-todo-l1{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:14px}',
      '.v2-todo-k{display:inline-flex;align-items:center;gap:6px;font-weight:800;color:var(--ip-ink);letter-spacing:-.01em}',
      '.v2-todo-k svg{color:var(--ip-blue)}',
      '.v2-todo-off{font-weight:600;color:var(--ip-blue);cursor:pointer;text-decoration:none}',
      '.v2-todo-b{font-size:11.5px;font-weight:700;margin-left:auto}',
      '.v2-todo-n{font-size:13.5px;color:var(--muted)}',
      '.v2-todo-n-libre{font-size:14px;color:var(--ip-ink);line-height:1.45;overflow-wrap:anywhere}',
      '.v2-todo-n-in{min-height:36px;padding:6px 10px;border:1px solid transparent;border-radius:8px;font:inherit;font-size:16px;background:transparent;color:var(--ip-ink);width:100%;box-sizing:border-box}',
      '.v2-todo-n-in:hover,.v2-todo-n-in:focus{border-color:var(--line);background:#fff;outline:none}',
      '.v2-todo-acts{display:flex;flex-wrap:wrap;gap:8px}',
      '.v2-todo-sm{min-height:40px;font-size:12.5px;padding:6px 12px}',
      '.v2-todo-ov{position:fixed;inset:0;z-index:130;background:rgba(16,19,28,.5);display:flex;align-items:center;justify-content:center;padding:16px}',
      '.v2-todo-pop{background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(15,20,32,.28);width:min(420px,100%);padding:8px;display:flex;flex-direction:column;gap:4px}',
      '.v2-todo-pop-h{display:flex;align-items:center;gap:8px;padding:10px 12px 6px;font-size:14px}',
      '.v2-todo-pop-h b{font-weight:800;letter-spacing:-.01em}',
      '.v2-todo-pop-h span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:12.5px}',
      '.v2-todo-x{flex:none;width:36px;height:36px;border:none;background:var(--surf-sunken,#F4F6FA);border-radius:50%;font-size:20px;line-height:1;cursor:pointer;color:var(--ip-ink)}',
      '.v2-todo-choix{display:flex;align-items:center;gap:12px;text-align:left;min-height:52px;padding:10px 12px;border:none;border-radius:12px;background:none;font:inherit;color:var(--ip-ink);cursor:pointer}',
      '.v2-todo-choix:hover,.v2-todo-choix:focus-visible{background:var(--halo,#E9F0FF);outline:none}',
      '.v2-todo-choix b{display:block;font-size:14px;font-weight:700}',
      '.v2-todo-choix small{display:block;font-size:12px;color:var(--muted)}',
      '.v2-todo-ico{flex:none;width:36px;height:36px;border-radius:10px;background:var(--halo,#E9F0FF);color:var(--ip-blue);display:inline-flex;align-items:center;justify-content:center}',
      '@media (max-width:760px){.v2-todo-kinds{grid-template-columns:1fr 1fr}.v2-todo-form{grid-template-columns:1fr}.v2-todo-wide{grid-column:auto}.v2-todo-b{margin-left:0}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
