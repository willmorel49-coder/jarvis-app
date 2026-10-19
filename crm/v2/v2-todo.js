/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Ma liste — les choses à faire du commercial (V2.todo / V2.pages.todo)
   Demande de Will, 23/09/2026 : « une to do list : les demandes de rendez-vous
   à faire avec un mail type suite à un passage dans la pharmacie ; à la suite
   d'un rendez-vous, mail type et documents à joindre ; mail type d'ouverture
   de compte et document à joindre ; et une to do list sur d'autres choses à
   faire si besoin, avec la possibilité de cocher. »

   Quatre sortes de lignes, chacune avec son geste :
     rdv    → mail « suite à mon passage » avec le lien de prise de rendez-vous
     merci  → mail de suite de rendez-vous (le modèle de Will, 23/09) + pièces jointes
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
  // 19/10/2026 — micro posé DANS le champ (V2.notes.champ, v2-notes.js) ; le champ reste tel quel si ce module n'est pas encore chargé ou si l'appareil n'a pas de dictée.
  function micChamp(h, t) { return (V2.notes && V2.notes.champ) ? V2.notes.champ(h, t) : h; }
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };   // v2-icons.js expose window.ICO
  var LS = 'jarvis_todo_v1';

  var KINDS = {
    rdv:    { l: 'Demande de rendez-vous', s: 'suite à un passage à l\'officine', ico: 'cal',   mail: 'Écrire la demande de rendez-vous' },
    merci:  { l: 'Après le rendez-vous',   s: 'mail de suite + documents',        ico: 'check', mail: 'Écrire le mail de suite', docs: 'Joindre les documents' },
    compte: { l: 'Ouverture de compte',    s: 'mail + formulaire à joindre',      ico: 'fiche', mail: 'Écrire le mail d\'ouverture',   docs: 'Joindre le formulaire', presel: ['S:ouverture-compte-integral-pharma-2026.pdf'] },
    libre:  { l: 'Autre chose à faire',    s: '',                                  ico: 'list' }
  };
  var ORDER = ['rdv', 'merci', 'compte', 'libre'];

  var st = { items: null, backend: 'local', filtre: 'afaire', chargement: null, kind: 'rdv', onglet: 'taches' };

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
               note: String(x.note || ''), pour: String(x.pour || ''), fait: !!x.fait, faitLe: x.faitLe || '', cree: x.cree || new Date().toISOString(),
               rep: x.rep && Object.prototype.hasOwnProperty.call(REP, x.rep) ? x.rep : '', ancre: isoOk(x.ancre) ? x.ancre : '', prec: isoOk(x.prec) ? x.prec : '', dernier: String(x.dernier || '') };
    });
  }

  // ── Rappels qui reviennent ──────────────────────────────────────
  // 16/10/2026, Will : « avoir la possibilité de mettre un rappel soit hebdo, mensuel,
  // choisir une date — exemple la pharmacie commande un Repatha toutes les semaines ».
  // Une ligne qui revient n'est jamais « faite » : la cocher la repousse à l'échéance
  // suivante (`pour`), comme les rappels du téléphone. `ancre` = la toute première date,
  // dont « chaque mois » garde le jour (31 → 30 novembre → 31 décembre).
  var REP = { '': 'Une fois', hebdo: 'Chaque semaine', mensuel: 'Chaque mois' };
  var SANS_DATE = 'Sans date : la ligne attend dans la to do list.';
  function isoOk(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
  function isoDe(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function aujIso() { return isoDe(new Date()); }
  function jourMois(it, iso) { return +String(isoOk(it.ancre) ? it.ancre : iso).slice(8, 10); }
  function suivante(it, iso) {
    var p = iso.split('-');
    if (it.rep === 'hebdo') return isoDe(new Date(+p[0], +p[1] - 1, +p[2] + 7));
    var fin = new Date(+p[0], +p[1] + 1, 0).getDate();   // dernier jour du mois suivant
    return isoDe(new Date(+p[0], +p[1], Math.min(jourMois(it, iso), fin)));
  }
  // La ligne revient-elle ce jour-là ? (l'agenda y pose les échéances à venir)
  function tombeLe(it, iso) {
    if (!it.rep || it.fait || !isoOk(it.pour) || !isoOk(iso) || iso < it.pour) return false;
    var a = iso.split('-'), b = it.pour.split('-');
    if (it.rep === 'hebdo') return Math.round((Date.UTC(+a[0], +a[1] - 1, +a[2]) - Date.UTC(+b[0], +b[1] - 1, +b[2])) / 864e5) % 7 === 0;
    return +a[2] === Math.min(jourMois(it, it.pour), new Date(+a[0], +a[1], 0).getDate());
  }
  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function phraseRep(rep, iso) {
    if (!isoOk(iso)) return '';
    var d = new Date(iso + 'T00:00:00');
    if (rep === 'hebdo') return 'Revient chaque ' + JOURS[d.getDay()] + '.';
    if (rep === 'mensuel') return 'Revient le ' + (d.getDate() === 1 ? '1er' : d.getDate()) + ' de chaque mois' + (d.getDate() > 28 ? ' (le dernier jour quand le mois est plus court)' : '') + '.';
    return 'Une seule fois, le ' + JOURS[d.getDay()] + ' ' + dateFr(iso) + '.';
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

  // ── Réglages des mails : l'accès test Offilog ───────────────────
  // Jamais dans le code (dépôt public) : UN accès commun à l'équipe (23/09, Will :
  // « il faut que ce soit dessus »), rangé dans une ligne `profils` à part, lue par
  // tous les comptes — la liste (items) n'est jamais touchée par ici.
  var LS_REG = 'jarvis_todo_reg_v1';
  function scopeReg() { return { st: 'groupement', sid: '__todoreg_equipe__' }; }
  function nettoieReg(o) { o = o || {}; return { offilogId: String(o.offilogId || '').trim(), offilogMdp: String(o.offilogMdp || '').trim() }; }
  function reglages() {
    if (!st.reg) {
      try { st.reg = nettoieReg(JSON.parse(localStorage.getItem(LS_REG + ':' + ((V2.user && V2.user.id) || 'local')) || '{}')); } catch (e) { st.reg = nettoieReg(); }
      var c = sb(), s = scopeReg();
      if (c && V2.user) c.from('profils').select('data').eq('scope_type', s.st).eq('scope_id', s.sid).maybeSingle().then(function (r) {
        if (r.error || !(r.data && r.data.data)) return;
        st.reg = nettoieReg(r.data.data);
        try { localStorage.setItem(LS_REG + ':' + V2.user.id, JSON.stringify(st.reg)); } catch (e) {}
        rendre();
      }, function () {});
    }
    return st.reg;
  }
  function ecrireReg(reg) {
    st.reg = nettoieReg(reg);
    try { localStorage.setItem(LS_REG + ':' + ((V2.user && V2.user.id) || 'local'), JSON.stringify(st.reg)); } catch (e) {}
    var c = sb(), s = scopeReg();
    if (!(c && V2.user)) return Promise.resolve(false);
    return c.from('profils').upsert({ scope_type: s.st, scope_id: s.sid, data: st.reg, updated_by: V2.user.id,
      updated_by_name: V2.user.name || '', updated_at: new Date().toISOString() }, { onConflict: 'scope_type,scope_id' })
      .then(function (u) { if (u.error) throw u.error; return true; }).catch(function () { return false; });
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
    return '\n\nBien cordialement,\n\n' + ((V2.user && V2.user.name) || prenom()) + '\n' + marque() + (t ? '\n' + t : '');
  }
  function dateFr(iso) {
    if (!iso) return '';
    var d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  // ── Les trois mails types ───────────────────────────────────────
  // 23/09, Will : « voilà le genre de mail que j'envoie […] il faut cette qualité-là
  // pour les 3 options ». Modèle = SON mail d'après rendez-vous : parties titrées
  // entre deux filets, puces courtes, rien d'inventé. Texte brut : c'est ce que
  // mailto: transporte, et ça s'affiche pareil dans toutes les messageries.
  // Rien de confidentiel en dur (dépôt public) : le franco de 300 € est affiché
  // sur offilog.fr, 30 jours est le délai légal par défaut ; le mot de passe du
  // compte test Offilog, lui, est rangé en base, commun à l'équipe (reglages).
  // 16 traits : au-delà, le filet passe à la ligne sur un écran d'iPhone.
  var FILET = '━━━━━━━━━━━━━━━━';
  function partie(n, titre) { return '\n\n' + FILET + '\n' + (n ? n + ' · ' : '') + titre + '\n' + FILET + '\n\n'; }
  var LIVRAISONS = '• Commandes via PharmaML, directement depuis votre LGO\n' +
    '• Livraisons le mardi et le vendredi\n\n' +
    'Heures limites de commande :\n' +
    '• avant lundi 12 h 30 → livraison mardi\n' +
    '• avant jeudi 12 h 30 → livraison vendredi\n\n' +
    '👉 En cas d\'urgence, vous pouvez ajouter des produits jusqu\'à 16 h en me contactant directement.';
  var FACTURATION = '• Facturation le 1er et le 15 du mois\n' +
    '• Règlement à 30 jours date de facture\n' +
    '• Factures et bons de livraison disponibles sur Digipharmacie';
  var PIECES_COMPTE = '• le document d\'ouverture, complété et signé ;\n• un RIB ;\n• un extrait Kbis.';

  function mailRdv(it, lien) {
    var dejaClient = !!(it.pid && client(it.pid));
    var corps = 'Bonjour,\n\n' +
      'Merci pour votre accueil lors de mon passage à la pharmacie' +
      (it.cree ? ' le ' + dateFr(it.cree.slice(0, 10)) : '') + '.\n\n' +
      'Comme évoqué, je vous propose que nous prenions un moment ensemble, à la date qui vous convient.' +
      partie(0, 'CE QUE JE VOUS PRÉSENTERAI') +
      (dejaClient
        ? '• votre activité avec ' + marque() + ' depuis le début de l\'année ;\n' +
          '• une sélection de références préparée à partir de vos commandes ;\n' +
          '• les opportunités prix du moment sur les familles que vous travaillez ;\n' +
          '• l\'actualité du secteur : réglementation, approvisionnement, rémunération de l\'officine.'
        : '• ' + marque() + ', grossiste complémentaire : ce que nous pouvons vous apporter en complément de votre grossiste principal ;\n' +
          '• une sélection de références préparée pour votre officine, parmi les meilleures ventes des pharmaciens ;\n' +
          '• notre fonctionnement : prix nets à la boîte sur facture, aucun minimum de commande, froid compris ;\n' +
          '• génériques et biosimilaires : nos laboratoires partenaires, avec remontée dès la première boîte.') +
      partie(0, 'CHOISIR VOTRE CRÉNEAU') +
      (lien ? 'Vous choisissez directement le jour et l\'heure qui vous conviennent :\n👉 ' + lien +
              '\n\nVous pouvez aussi me répondre simplement par mail ou par téléphone.'
            : 'Indiquez-moi simplement le jour et l\'heure qui vous arrangent, en réponse à ce mail ou par téléphone.') +
      '\n\nAu plaisir d\'échanger avec vous prochainement.' + signature();
    return { objet: 'Suite à mon passage à la pharmacie – proposition de rendez-vous', corps: corps };
  }
  function mailMerci(it) {
    var r = reglages(), id = r.offilogId || '[identifiant]', mdp = r.offilogMdp || '[mot de passe]';
    var corps = 'Bonjour,\n\n' +
      'Je vous remercie sincèrement pour le temps que vous m\'avez accordé lors de notre rendez-vous.\n\n' +
      'Comme convenu, vous trouverez en pièces jointes :\n\n' +
      '• un fichier Excel des meilleures opportunités, sélectionnées directement par les pharmaciens ;\n' +
      '• notre affiche « process », avec nos jours de livraison ;\n' +
      '• le document d\'ouverture de compte Offilog, si cela vous intéresse : franco à 300 €, sans adhésion, livraison sous 72 h à une semaine.' +
      partie(1, 'NOTRE POSITIONNEMENT') +
      marque() + ' intervient comme grossiste complémentaire. Notre rôle : vous apporter une solution simple, réactive et rentable, en complément de votre grossiste principal.\n\n' +
      'Vous pouvez nous solliciter :\n' +
      '• sur des références bien positionnées en prix ;\n' +
      '• en cas de manquants ;\n' +
      '• pour des recherches spécifiques ;\n' +
      '• pour optimiser la marge sur certaines familles de produits ;\n' +
      '• pour les besoins ponctuels du quotidien.' +
      partie(2, 'CONDITIONS COMMERCIALES') +
      'Un fonctionnement simple et transparent :\n' +
      '• aucun minimum de commande ;\n' +
      '• prix nets à la boîte, directement visibles sur facture ;\n' +
      '• aucune exclusion de produit, froid compris ;\n' +
      '• catalogue grossiste complet accessible.' +
      partie(3, 'TRANCHES D\'ABANDON DE MARGE') +
      'Notre politique tarifaire est structurée par tranches, de manière claire, à la boîte et sur facture, comme évoqué en rendez-vous.\n\n' +
      '→ Cette structure nous permet de rester compétitifs sur l\'intégralité du catalogue grossiste.' +
      partie(4, 'GÉNÉRIQUES & BIOSIMILAIRES') +
      'Laboratoires partenaires : Zentiva · EG Labo · Teva · Zydus\n\n' +
      'Les remontées de chiffres se font dès la première boîte, sans palier minimum. Cela vous permet :\n' +
      '• de sécuriser certains volumes ;\n' +
      '• de garder de la souplesse dans vos approvisionnements ;\n' +
      '• de travailler certaines références ponctuellement, selon vos besoins.\n\n' +
      'Nous sommes également bien positionnés sur les biosimilaires, avec une remontée laboratoire dans les mêmes conditions.' +
      partie(5, 'COMMANDES & LIVRAISONS') + LIVRAISONS +
      partie(6, 'FACTURATION & SUIVI') + FACTURATION + '\n\n' +
      'Nous attachons une importance particulière à la simplicité et à la lisibilité du suivi administratif pour l\'officine.' +
      partie(7, 'ACCÈS TEST OFFILOG') +
      'Pour consulter la plateforme avant toute création de compte :\n\n' +
      '👉 https://offilog.fr/\n' +
      'Identifiant : ' + id + '\n' +
      'Mot de passe : ' + mdp + '\n\n' +
      'Vous y trouverez notamment les meilleures ventes, les tarifs et les gammes disponibles.' +
      partie(8, 'OUVERTURE DE COMPTE') +
      'Comme évoqué ensemble, je reste disponible pour avancer sur l\'ouverture de compte quand vous le souhaiterez. Il suffira de me transmettre :\n\n' +
      PIECES_COMPTE + '\n\n' +
      'Je reste bien entendu disponible pour toute question ou pour faire un point ensemble, selon vos besoins.' + signature();
    return { objet: 'Suite à notre rendez-vous – documents et fonctionnement ' + marque(), corps: corps };
  }
  function mailCompte(it) {
    var corps = 'Bonjour,\n\n' +
      'Je vous remercie pour votre confiance.\n\n' +
      'Comme convenu, vous trouverez ci-joint le document d\'ouverture de compte ' + marque() + '.' +
      partie(1, 'POUR OUVRIR VOTRE COMPTE') +
      'Il suffit de me retourner, en réponse à ce mail :\n\n' +
      PIECES_COMPTE + '\n\n' +
      'Dès réception, je lance la création de votre compte et je vous confirme sa mise en place.' +
      partie(2, 'COMMANDES & LIVRAISONS') + LIVRAISONS +
      partie(3, 'FACTURATION & SUIVI') + FACTURATION +
      partie(4, 'RAPPEL DE NOTRE FONCTIONNEMENT') +
      '• aucun minimum de commande ;\n' +
      '• prix nets à la boîte, directement visibles sur facture ;\n' +
      '• aucune exclusion de produit, froid compris ;\n' +
      '• génériques et biosimilaires : remontées laboratoire dès la première boîte.\n\n' +
      'Je reste bien entendu disponible pour vous accompagner lors de vos premières commandes, ou pour toute question.' + signature();
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
    // Toutes les lignes (cochées comprises), lecture seule : « Mon agenda » (v2-agenda-vues.js) y pose les lignes datées (`pour`).
    tous: function () { return (st.items || []).slice(); },
    // Accueil (widget « To do list ») : les lignes à faire, les plus urgentes d'abord, et leur libellé (le même que la carte « À faire »).
    urgents: function () { return trier(V2.todo.ouverts()); },
    // « Autre chose » : la note EST la tâche — « Pharmacie du Port · Repatha », sans le mot de la sorte
    // (dans une case de l'agenda, « Autre chose à faire · … » cachait justement ce qu'il y a à faire).
    libelle: function (it) {
      if (it.k === 'libre' && (it.nom || it.note)) return [it.nom, it.note].filter(Boolean).join(' · ');
      return KINDS[it.k].l + (it.nom ? ' · ' + it.nom : (it.note ? ' · ' + it.note : ''));
    },

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
      // 16/10/2026 — le rythme se choisit ici aussi (même date, mêmes 3 rythmes que la fenêtre « Rappel ») ;
      // laissé sur « Une fois » sans date, l'ajout reste celui d'avant, en un geste.
      o.innerHTML = '<div class="v2-todo-pop v2-todo-mn-pop" role="dialog" aria-label="Ajouter à la to do list" onclick="event.stopPropagation()">' +
        '<div class="v2-todo-pop-h"><b>Ajouter à la to do list</b><span>' + esc(nom || 'cette officine') + '</span>' +
          '<button class="v2-todo-x" aria-label="Fermer" onclick="V2.todo.fermer()">&times;</button></div>' +
        '<div class="v2-todo-rp-b v2-todo-mn">' +
          '<div class="v2-todo-rp-seg" role="radiogroup" aria-label="Répéter">' + Object.keys(REP).map(function (k) {
            return '<label><input type="radio" name="v2-todo-rp-r" value="' + k + '"' + (k === '' ? ' checked' : '') + ' onchange="V2.todo.menuMaj()"><span>' + esc(REP[k]) + '</span></label>';
          }).join('') + '</div>' +
          '<label><span id="v2-todo-mn-dl">Le (facultatif)</span><input id="v2-todo-rp-d" type="date" onchange="V2.todo.menuMaj()"></label>' +
          '<p id="v2-todo-rp-p" class="v2-todo-rp-p">' + esc(SANS_DATE) + '</p>' +
          '<label><span>Note (facultatif)</span>' + micChamp('<input id="v2-todo-mn-note" type="text" placeholder="Ex. : commande de Repatha" autocomplete="off">', 'Dicter la note à la voix') + '</label>' +
          '<label class="v2-todo-mn-al" id="v2-todo-mn-alr" style="display:none"><input id="v2-todo-mn-al" type="checkbox"><span>Alerte sur mon téléphone, à 9 h</span></label>' +
        '</div>' +
        '<div class="v2-todo-mn-k">Choisir quoi ajouter</div>' +
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
    // Fenêtre de la fiche : qui revient sans date = à partir d'aujourd'hui ; l'alerte n'a de sens qu'avec une date.
    menuMaj: function () {
      var r = lireRappel(), dEl = document.getElementById('v2-todo-rp-d');
      if (r.rep && !r.d && dEl) { dEl.value = aujIso(); r.d = dEl.value; }
      var dl = document.getElementById('v2-todo-mn-dl'), p = document.getElementById('v2-todo-rp-p'), al = document.getElementById('v2-todo-mn-alr'), cb = document.getElementById('v2-todo-mn-al');
      if (dl) dl.textContent = r.rep ? 'Première fois le' : 'Le (facultatif)';
      if (p) p.textContent = r.d ? phraseRep(r.rep, r.d) : SANS_DATE;
      if (al) al.style.display = r.d ? '' : 'none';
      if (cb && !r.d) cb.checked = false;
    },
    fermer: function () { var ex = document.getElementById('v2-todo-pop'); if (ex) ex.remove(); },
    // 16/10/2026 — Bloc-notes : ajoute UNE ligne depuis une proposition du robot (sans fenêtre). Rend une promesse { true | false } :
    // true seulement si la ligne est bien dans la base (ou, hors connexion, dans l'appareil). `id` fixe = rejouer ne crée pas de doublon.
    ajouterLigne: function (o) {
      o = o || {};
      var k = KINDS[o.k] ? o.k : 'libre';
      var it = { id: sur(o.id) || newId(), k: k, pid: sur(o.pid), nom: String(o.nom || ''), mail: '', note: String(o.note || ''), pour: isoOk(o.pour) ? o.pour : '',
                 fait: false, faitLe: '', cree: new Date().toISOString(), rep: '', ancre: '' };
      return charger(true).then(function () {   // relue de force : un état « local » resté d'une lecture ratée plus tôt ne doit pas faire croire à une écriture partagée
        return ecrire(function (items) { return items.some(function (x) { return x.id === it.id; }) ? items : items.concat([it]); });
      }).then(function (ok) {
        if (ok && sb() && V2.user && st.backend !== 'supabase') ok = false;   // la liste n'a pas pu être lue en base : rien de partagé
        if (ok && V2.route && V2.route.name === 'home' && V2.render) V2.render();
        return !!ok;
      }, function () { return false; });
    },
    ajouterDepuis: function (pid, k) {
      var o = document.getElementById('v2-todo-pop');
      var nom = (o && o._nom) || '', mail = (o && o._mail) || '';
      var r = lireRappel(), noteEl = document.getElementById('v2-todo-mn-note'), alEl = document.getElementById('v2-todo-mn-al');
      if (r.rep && !r.d) r.d = aujIso();
      var it = { id: newId(), k: k, pid: String(pid), nom: nom, mail: mail, note: (noteEl && noteEl.value || '').trim(), pour: r.d, fait: false, faitLe: '', cree: new Date().toISOString(),
                 rep: r.rep, ancre: r.rep ? r.d : '' };
      // L'alerte part DANS le clic : Safari n'ouvre le fichier d'agenda que pendant un geste de l'utilisateur.
      if (alEl && alEl.checked && r.d) alerteTelephone(it, r.d, r.rep, it.ancre);
      V2.todo.fermer();
      st.filtre = 'afaire';   // la nouvelle ligne doit se voir en revenant sur Ma liste
      charger().then(function () { return ecrire(function (items) { return items.concat([it]); }); }).then(function () {
        if (V2.toast) V2.toast('Ajouté à la to do list : ' + KINDS[k].l + (nom ? ' · ' + nom : '') +
          (r.rep ? ' · ' + phraseRep(r.rep, r.d).replace(/\.$/, '').toLowerCase() : r.d ? ' · le ' + dateFr(r.d) : ''));
        if (V2.route && V2.route.name === 'home' && V2.render) V2.render();
        rendre();
      });
    },

    // Formulaire de la page
    choisir: function (k) { st.kind = k; rendre(); },
    ajouter: function () {
      var nomEl = document.getElementById('v2-todo-nom'), noteEl = document.getElementById('v2-todo-note'), pourEl = document.getElementById('v2-todo-pour'), repEl = document.getElementById('v2-todo-rep');
      var nom = (nomEl && nomEl.value || '').trim(), note = (noteEl && noteEl.value || '').trim(), pour = (pourEl && pourEl.value || '').trim(), rep = (repEl && REP[repEl.value] && repEl.value) || '';
      if (!nom && !note) { if (V2.toast) V2.toast('Indiquer une officine ou une note', 'warn'); return; }
      if (rep && !isoOk(pour)) pour = aujIso();   // qui revient sans date : à partir d'aujourd'hui
      var p = nom ? (V2.pharmacies || []).find(function (x) { return String(x.name || '').trim().toLowerCase() === nom.toLowerCase(); }) : null;
      var it = { id: newId(), k: st.kind, pid: p ? String(p.id) : '', nom: p ? p.name : nom, mail: '', note: note, pour: pour, fait: false, faitLe: '', cree: new Date().toISOString(),
                 rep: rep, ancre: rep ? pour : '' };
      st.filtre = 'afaire';
      ecrire(function (items) { return items.concat([it]); }).then(function () {
        if (nomEl) nomEl.value = ''; if (noteEl) noteEl.value = ''; if (pourEl) pourEl.value = ''; if (repEl) repEl.value = '';
        if (rep && V2.toast) V2.toast('Rappel ajouté · ' + phraseRep(rep, pour).replace(/\.$/, '').toLowerCase());
        rendre();
      });
    },
    cocher: function (id, fait) {
      var revient = false;
      ecrire(function (items) {
        return items.map(function (x) {
          if (x.id !== id) return x;
          // Une ligne qui revient : cochée = faite pour cette fois, elle repart à l'échéance
          // suivante après aujourd'hui (cochée en retard, elle ne reste pas dans le passé).
          if (x.rep && fait && isoOk(x.pour)) {
            var n = suivante(x, x.pour), a = aujIso();
            while (n <= a) n = suivante(x, n);
            x.prec = x.pour; x.pour = n; x.dernier = new Date().toISOString(); revient = n;
            return x;
          }
          x.fait = !!fait; x.faitLe = fait ? new Date().toISOString() : ''; return x;
        });
      }).then(function () {
        if (revient && V2.toast) V2.toast('C\'est noté. Prochain rappel : ' + JOURS[new Date(revient + 'T00:00:00').getDay()] + ' ' + dateFr(revient));
        rendre(); if (V2.todo.apresCoche) V2.todo.apresCoche();
      });
    },
    // Annule la dernière coche d'une ligne qui revient (le jour même) : elle retrouve son échéance.
    annulerFait: function (id) {
      ecrire(function (items) {
        return items.map(function (x) { if (x.id === id && isoOk(x.prec)) { x.pour = x.prec; x.prec = ''; x.dernier = ''; } return x; });
      }).then(function () { rendre(); if (V2.todo.apresCoche) V2.todo.apresCoche(); });
    },
    tombeLe: tombeLe,
    repLabel: function (it) { return it && it.rep ? REP[it.rep] : ''; },
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
      // 25/09, Will : « pouvoir tout modifier avant » → le mail s'ouvre d'abord dans « Préparer le mail ».
      var lienP = (V2.rdvLien && V2.rdvLien.charger) ? V2.rdvLien.charger().then(function (l) {
        return (l && l.actif !== false && V2.rdvLien.url) ? V2.rdvLien.url(l) : '';
      }) : Promise.resolve('');
      // Ma version du mail tout prêt, si j'en ai une : chargée avant d'écrire le texte.
      Promise.all([Promise.resolve(lienP).catch(function () { return ''; }), chargerMods()]).then(function (r) {
        st.lien = r[0] || st.lien || '';
        var m = it.k === 'libre' ? { objet: '', corps: 'Bonjour,\n\n' + signature().replace(/^\n\n/, '') } : texteDe(it.k, it);
        composer({ it: it, pid: it.pid, nom: it.nom, dest: dest, objet: m.objet, corps: m.corps,
          docs: docsDe(it.k), base: it.k === 'libre' ? '' : 'b:' + it.k });
      });
    },
    docs: function (id) {
      var it = (st.items || []).find(function (x) { return x.id === id; }); if (!it) return;
      if (!it.pid) { if (V2.toast) V2.toast('Cette ligne n\'est rattachée à aucune officine', 'warn'); return; }
      if (!V2.pharmaTransmettre) return;
      chargerMods().then(function () {
        var d = it.k === 'libre' ? [] : docsDe(it.k);
        V2.pharmaTransmettre(it.pid, d.length ? d : null, { nom: it.nom, mail: mailDe(it), texte: it.k === 'libre' ? null : texteDe(it.k, it) });
      });
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
          '<span style="flex:1;min-width:0"><b style="font-size:13px;font-weight:800;color:var(--ip-ink)">To do list</b>' +
            '<span style="display:block;font-size:12.5px;color:var(--ip-ink-2)">Rien à faire pour l\'instant.</span></span>' +
          '<button class="v2-btn v2-btn-ghost" style="flex:none" onclick="V2.go(\'todo\')">' + ICO('plus', 14, 2) + ' Ajouter</button></div>';
      }
      return '<div class="v2-card" style="margin-bottom:16px;padding:16px 18px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
          '<span style="font-size:13px;font-weight:800;letter-spacing:-.01em;color:var(--ip-ink)">À faire</span>' +
          '<a class="v2-card-link" onclick="V2.go(\'todo\')">To do list · ' + V2.todo.ouverts().length + '</a></div>' +
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
      : ((K.mail || it.nom ? '<button class="v2-btn v2-btn-primary v2-todo-sm" onclick="V2.todo.mail(\'' + it.id + '\')">' + ICO('fiche', 14, 2) + esc(K.mail || 'Écrire un mail') + '</button>' : '') +
         (K.docs && it.pid ? '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.todo.docs(\'' + it.id + '\')">' + ICO('download', 14, 2) + esc(K.docs) + '</button>' : '') +
         '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.todo.rappel(\'' + it.id + '\')">' + ICO('cal', 14, 2) + (it.pour || it.rep ? 'Modifier le rappel' : 'Ajouter un rappel') + '</button>');
    var der = it.rep && !it.fait && it.dernier && isoDe(new Date(it.dernier)) === aujIso() && isoOk(it.prec);
    return '<div class="v2-todo-it' + (it.fait ? ' is-fait' : '') + '">' +
      '<label class="v2-todo-chk"><input type="checkbox"' + (it.fait ? ' checked' : '') + ' onchange="V2.todo.cocher(\'' + it.id + '\',this.checked)" aria-label="' + (it.fait ? 'Remettre à faire' : it.rep ? 'Fait pour cette fois' : 'Marquer comme fait') + '"><span></span></label>' +
      '<div class="v2-todo-c">' +
        '<div class="v2-todo-l1"><span class="v2-todo-k">' + ICO(K.ico, 14, 2) + esc(K.l) + '</span>' + qui +
          (it.rep && !it.fait ? '<span class="v2-todo-rep">↻ ' + esc(REP[it.rep]) + '</span>' : '') +
          (b && !it.fait ? '<span class="v2-todo-b" style="color:' + b.c + '">' + b.t + (it.rep && b.t.indexOf('Dans') === 0 ? ' · ' + esc(dateFr(it.pour)) : '') + '</span>' : '') +
          (it.fait && it.faitLe ? '<span class="v2-todo-b" style="color:var(--muted)">Fait le ' + esc(dateFr(it.faitLe.slice(0, 10))) + '</span>' : '') + '</div>' +
        // « Autre chose » : la note EST la tâche — affichée en entier, jamais coupée dans un champ
        (it.fait || (it.k === 'libre' && it.note) ? (it.note ? '<div class="v2-todo-n' + (it.k === 'libre' ? ' v2-todo-n-libre' : '') + '">' + esc(it.note) + '</div>' : '')
                 : micChamp('<input class="v2-todo-n-in" type="text" value="' + esc(it.note) + '" placeholder="Une précision ? (facultatif)" onchange="V2.todo.note(\'' + it.id + '\',this)">', 'Dicter la précision à la voix')) +
        (der ? '<div class="v2-todo-der">' + ICO('check', 13, 2) + 'Fait aujourd\'hui <button onclick="V2.todo.annulerFait(\'' + it.id + '\')">Annuler</button></div>' : '') +
        (actes ? '<div class="v2-todo-acts">' + actes + '</div>' : '') +
      '</div></div>';
  }

  // ── Les mails tout prêts (23/09, Will : « avoir des exemples de mail aussi préfaits ») ──
  // Les MÊMES textes que ceux qui partent d'une ligne de la liste, lisibles d'avance,
  // à copier ou à ouvrir dans sa messagerie sans rien ajouter à la liste.
  var MODELES = [
    { k: 'rdv',    t: 'Demande de rendez-vous', s: 'après un passage à l\'officine' },
    { k: 'merci',  t: 'Après le rendez-vous',   s: 'remerciement, fonctionnement et documents' },
    { k: 'compte', t: 'Ouverture de compte',    s: 'le formulaire 2026 est à joindre' }
  ];
  function modele(k) { return texteDe(k); }
  function mailsPrets() {
    if (st.lien == null) {
      st.lien = '';
      var p = (V2.rdvLien && V2.rdvLien.charger) ? V2.rdvLien.charger() : null;
      if (p) Promise.resolve(p).then(function (l) { st.lien = (l && l.actif !== false && V2.rdvLien.url) ? V2.rdvLien.url(l) : ''; if (st.lien) rendre(); }).catch(function () {});
    }
    if (st.mods == null) chargerMods().then(rendre);
    // 25/09, Will : « chacun doit pouvoir avoir des modèles de base et pouvoir les modifier pour lui
    // et que pour lui » → mêmes 3 modèles au départ pour tous, « Ma version » rangée avec ses modèles.
    return '<div class="v2-todo-mh"><h2>Les mails tout prêts</h2><p>Les mêmes pour toute l\'équipe au départ. Vous pouvez les modifier à votre façon : votre version ne vaut que pour vous.</p></div>' +
      '<div class="v2-card v2-todo-list">' + MODELES.map(function (m) {
        var x = modele(m.k), mien = !!(st.bases || {})[m.k];
        return '<details class="v2-todo-mail"' + ((st.ouverts || {})[m.k] ? ' open' : '') + ' ontoggle="window.V2&&V2.todo.plier(\'' + m.k + '\',this.open)"><summary><span class="v2-todo-ico">' + ICO(KINDS[m.k].ico, 16, 2) + '</span>' +
          '<span class="v2-todo-mt"><b>' + esc(m.t) + (mien ? ' <em class="v2-todo-mien">Ma version</em>' : '') + '</b><small>' + esc(m.s) + '</small></span><span class="v2-todo-chev">' + ICO('chev', 16, 2) + '</span></summary>' +
          '<div class="v2-todo-mb">' + (m.k === 'merci' ? accesOffilog() : '') + '<div class="v2-todo-obj"><span>Objet</span>' + esc(x.objet) + '</div>' +
          '<pre class="v2-todo-corps">' + esc(x.corps) + '</pre>' +
          '<div class="v2-todo-acts"><button class="v2-btn v2-btn-primary v2-todo-sm" onclick="V2.todo.preparer(\'b:' + m.k + '\')">' + ICO('fiche', 14, 2) + 'Modifier et envoyer</button>' +
          '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.todo.editerBase(\'' + m.k + '\')">' + ICO('plus', 14, 2) + (mien ? 'Modifier ma version' : 'Modifier ce modèle pour moi') + '</button>' +
          (mien ? '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.todo.baseOrigine(\'' + m.k + '\')">Revenir au modèle d\'origine</button>' : '') +
          '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.todo.copierModele(\'' + m.k + '\')">' + ICO('check', 14, 2) + 'Copier le texte</button></div></div></details>';
      }).join('') + '</div>' + mesModeles();
  }
  // ── Mes modèles (25/09, Will : « pouvoir mettre nous-mêmes des modèles et les enregistrer ») ──
  function mesModeles() {
    if (st.mods == null) { chargerMods().then(rendre); }
    var a = st.mods || [];
    return '<div class="v2-todo-mh"><h2>Mes modèles</h2><p>Vos propres mails, avec leurs documents joints. Personnels : chacun a les siens.</p></div>' +
      '<div class="v2-card v2-todo-list">' +
        (st.mods == null ? '<div class="v2-todo-empty">Chargement…</div>'
          : a.length ? a.map(function (m) {
            return '<div class="v2-todo-mod"><span class="v2-todo-ico">' + ICO('fiche', 16, 2) + '</span>' +
              '<span class="v2-todo-mt"><b>' + esc(m.nom) + '</b><small>' + esc(m.objet || 'Sans objet') +
                (m.docs.length ? ' · ' + m.docs.length + ' document' + (m.docs.length > 1 ? 's' : '') + ' joint' + (m.docs.length > 1 ? 's' : '') : '') + '</small></span>' +
              '<span class="v2-todo-acts"><button class="v2-btn v2-btn-primary v2-todo-sm" onclick="V2.todo.preparer(\'m:' + m.id + '\')">Utiliser</button>' +
              '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.todo.editerModele(\'m:' + m.id + '\')">Modifier</button></span></div>';
          }).join('') : '<div class="v2-todo-empty">Aucun modèle pour l\'instant.</div>') +
        '<div class="v2-todo-mod-add"><button class="v2-btn v2-btn-ghost" onclick="V2.todo.editerModele(\'\')">' + ICO('plus', 15, 2) + 'Créer un modèle</button></div>' +
      '</div>';
  }
  // L'accès test Offilog cité dans le mail d'après rendez-vous, commun à toute l'équipe.
  function accesOffilog() {
    var r = reglages();
    return '<div class="v2-todo-reg"><b>Accès test Offilog cité dans ce mail</b>' +
      '<span>' + (r.offilogId && r.offilogMdp ? 'Déjà rempli dans le mail, pour toute l\'équipe. À modifier ici seulement si l\'accès change.' : 'À enregistrer une fois : il se remplira ensuite tout seul dans le mail, pour toute l\'équipe.') + '</span>' +
      '<div class="v2-todo-reg-f"><input id="v2-todo-oid" type="email" autocomplete="off" placeholder="Identifiant" value="' + esc(r.offilogId) + '">' +
      '<input id="v2-todo-omdp" type="text" autocomplete="off" placeholder="Mot de passe" value="' + esc(r.offilogMdp) + '">' +
      '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.todo.enregistrerOffilog()">Enregistrer</button></div></div>';
  }
  V2.todo.enregistrerOffilog = function () {
    var i = document.getElementById('v2-todo-oid'), m = document.getElementById('v2-todo-omdp');
    ecrireReg({ offilogId: i ? i.value : '', offilogMdp: m ? m.value : '' }).then(function (ok) {
      if (V2.toast) V2.toast(ok ? 'Accès Offilog enregistré' : 'Gardé sur cet appareil seulement — la base n\'a pas répondu', ok ? '' : 'warn');
      rendre();
    });
  };
  // ── Fenêtre « Rappel » d'une ligne : la date, et si elle revient ───────────────
  V2.todo.rappel = function (id) {
    var it = (st.items || []).find(function (x) { return x.id === id; }); if (!it) return;
    ensureCss();
    var ex = document.getElementById('v2-todo-pop'); if (ex) ex.remove();
    var o = document.createElement('div'); o.id = 'v2-todo-pop'; o.className = 'v2-todo-ov'; o.onclick = V2.todo.fermer;
    var d = isoOk(it.pour) ? it.pour : aujIso(), rep = it.rep || '';
    o.innerHTML = '<div class="v2-todo-pop v2-todo-rp" role="dialog" aria-label="Rappel" onclick="event.stopPropagation()">' +
      '<div class="v2-todo-pop-h"><b>Rappel</b><span>' + esc(V2.todo.libelle(it)) + '</span><button class="v2-todo-x" aria-label="Fermer" onclick="V2.todo.fermer()">&times;</button></div>' +
      '<div class="v2-todo-rp-b">' +
        '<label><span>' + (rep ? 'Prochaine fois le' : 'Le') + '</span><input id="v2-todo-rp-d" type="date" value="' + d + '" onchange="V2.todo.rappelMaj()"></label>' +
        '<div class="v2-todo-rp-seg" role="radiogroup" aria-label="Répéter">' + Object.keys(REP).map(function (k) {
          return '<label><input type="radio" name="v2-todo-rp-r" value="' + k + '"' + (k === rep ? ' checked' : '') + ' onchange="V2.todo.rappelMaj()"><span>' + esc(REP[k]) + '</span></label>';
        }).join('') + '</div>' +
        '<p id="v2-todo-rp-p" class="v2-todo-rp-p">' + esc(phraseRep(rep, d)) + '</p>' +
      '</div>' +
      '<div class="v2-tc-f">' +
        (it.pour || it.rep ? '<button class="v2-btn v2-btn-ghost v2-todo-sm v2-tc-sup" onclick="V2.todo.rappelOk(\'' + it.id + '\',\'retirer\')">Retirer le rappel</button>' : '') +
        '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.todo.rappelOk(\'' + it.id + '\',\'agenda\')">' + ICO('cal', 14, 2) + 'Enregistrer + alerte sur mon téléphone</button>' +
        '<button class="v2-btn v2-btn-primary" onclick="V2.todo.rappelOk(\'' + it.id + '\')">' + ICO('check', 15, 2) + 'Enregistrer</button>' +
      '</div>' +
      '<p class="v2-todo-rp-n">La ligne apparaît dans la to do list, sur l\'accueil et dans Mon agenda le jour venu. « Alerte sur mon téléphone » l\'ajoute en plus à l\'agenda de l\'iPhone ou du Mac, qui sonne à 9 h ce jour-là — à chaque fois s\'il revient.</p>' +
      '</div>';
    document.body.appendChild(o);
  };
  function lireRappel() {
    var dEl = document.getElementById('v2-todo-rp-d'), rEl = document.querySelector('input[name="v2-todo-rp-r"]:checked');
    return { d: dEl && isoOk(dEl.value) ? dEl.value : '', rep: rEl && rEl.value && Object.prototype.hasOwnProperty.call(REP, rEl.value) ? rEl.value : '' };
  }
  V2.todo.rappelMaj = function () {
    var r = lireRappel(), p = document.getElementById('v2-todo-rp-p');
    if (p) p.textContent = r.d ? phraseRep(r.rep, r.d) : 'Choisir une date.';
  };
  // L'agenda du téléphone sonne tout seul : un fichier .ics (le même module que les rendez-vous),
  // qui revient chaque semaine / chaque mois. Aucun service d'envoi, rien à payer.
  function alerteTelephone(it, d, rep, ancre) {
    if (!window.V2ICS) return;
    var j = +String(ancre || d).slice(8, 10);
    var rr = rep === 'hebdo' ? 'FREQ=WEEKLY'
      : rep === 'mensuel' ? (j > 28 ? 'FREQ=MONTHLY;BYMONTHDAY=' + [28, 29, 30, 31].filter(function (n) { return n <= j; }).join(',') + ';BYSETPOS=-1' : 'FREQ=MONTHLY;BYMONTHDAY=' + j) : '';
    var titre = V2.todo.libelle(it);
    var a = document.createElement('a');
    a.href = window.V2ICS.dataUrl(window.V2ICS.build({ uid: 'todo-' + it.id + '@jarvis', date: d, heure: '09:00', duree_min: 15, titre: titre, lieu: '',
      description: 'Rappel de ma to do list JARVIS.' + (it.note && it.k !== 'libre' ? '\n' + it.note : ''), organisateur: 'JARVIS', rrule: rr, alarmes: [['PT0M', 'Rappel']] }));
    a.download = 'rappel-' + sur(it.nom || it.note || 'jarvis').slice(0, 30) + '.ics';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  V2.todo.rappelOk = function (id, mode) {
    var it = (st.items || []).find(function (x) { return x.id === id; }); if (!it) return;
    var r = lireRappel();
    if (mode !== 'retirer' && !r.d) { if (V2.toast) V2.toast('Choisir une date', 'warn'); return; }
    // Même échéance, même rythme : on garde le jour d'origine (un « chaque mois » du 31 tombé un 30).
    var ancre = r.rep ? (r.rep === it.rep && r.d === it.pour && isoOk(it.ancre) ? it.ancre : r.d) : '';
    // L'alerte part DANS le clic : Safari n'ouvre le fichier d'agenda que pendant un geste de l'utilisateur.
    if (mode === 'agenda') alerteTelephone(it, r.d, r.rep, ancre);
    V2.todo.fermer();
    ecrire(function (items) {
      return items.map(function (x) {
        if (x.id !== id) return x;
        if (mode === 'retirer') { x.pour = ''; x.rep = ''; x.ancre = ''; x.prec = ''; x.dernier = ''; return x; }
        x.pour = r.d; x.rep = r.rep; x.ancre = ancre; x.prec = ''; x.dernier = '';
        return x;
      });
    }).then(function (ok) {
      if (V2.toast && ok) V2.toast(mode === 'retirer' ? 'Rappel retiré' : 'Rappel enregistré · ' + phraseRep(r.rep, r.d).replace(/\.$/, '').toLowerCase());
      rendre(); if (V2.todo.apresCoche) V2.todo.apresCoche();
    });
  };

  // Un modèle ouvert le reste quand la page se redessine (réglages arrivés de la base, enregistrement).
  V2.todo.plier = function (k, o) { st.ouverts = st.ouverts || {}; st.ouverts[k] = !!o; };

  // ── Stockage des modèles : une ligne `profils` à part par personne, comme la liste ──
  var LS_MOD = 'jarvis_todo_mod_v1';
  function scopeMod() { return { st: 'groupement', sid: '__todomod_' + ((V2.user && V2.user.id) || 'local') + '__' }; }
  function lsMod() { return LS_MOD + ':' + ((V2.user && V2.user.id) || 'local'); }
  function nettoieMods(a) {
    return (Array.isArray(a) ? a : []).filter(function (m) { return m && sur(m.id); }).map(function (m) {
      return { id: sur(m.id), nom: String(m.nom || 'Mon modèle').slice(0, 80), objet: String(m.objet || ''), corps: String(m.corps || ''),
               docs: (Array.isArray(m.docs) ? m.docs : []).map(String).filter(function (k) { return /^[SDMCP]:/.test(k); }) };
    });
  }
  // Ma version d'un mail tout prêt : { rdv|merci|compte: { objet, corps, docs } }, dans la même ligne.
  function nettoieBases(o) {
    var r = {}; o = o || {};
    MODELES.forEach(function (m) {
      var b = o[m.k]; if (!b || typeof b !== 'object' || !(b.objet || b.corps)) return;
      r[m.k] = { objet: String(b.objet || ''), corps: String(b.corps || ''),
                 docs: (Array.isArray(b.docs) ? b.docs : []).map(String).filter(function (k) { return /^[SDMCP]:/.test(k); }) };
    });
    return r;
  }
  function chargerMods() {
    if (st.modsP) return st.modsP;
    var c = sb(), s = scopeMod();
    var local = function () {
      try { st.mods = nettoieMods(JSON.parse(localStorage.getItem(lsMod()) || '[]')); } catch (e) { st.mods = []; }
      try { st.bases = nettoieBases(JSON.parse(localStorage.getItem(lsMod() + ':bases') || '{}')); } catch (e) { st.bases = {}; }
      return st.mods;
    };
    st.modsP = (c && V2.user) ? c.from('profils').select('data').eq('scope_type', s.st).eq('scope_id', s.sid).maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      var d = (r.data && r.data.data) || {};
      st.mods = nettoieMods(d.modeles); st.bases = nettoieBases(d.bases);
      try { localStorage.setItem(lsMod(), JSON.stringify(st.mods)); localStorage.setItem(lsMod() + ':bases', JSON.stringify(st.bases)); } catch (e) {}
      return st.mods;
    }).catch(local) : Promise.resolve().then(local);
    return st.modsP;
  }
  // Relit avant d'écrire (iPhone + Mac de la même personne), comme la liste.
  // `fn` transforme mes modèles, `fnB` mes versions des mails tout prêts (l'un ou l'autre peut manquer).
  function ecrireMods(fn, fnB) {
    var c = sb(), s = scopeMod();
    fn = fn || function (a) { return a; }; fnB = fnB || function (b) { return b; };
    var garde = function (a, b) {
      st.mods = a; st.bases = b;
      try { localStorage.setItem(lsMod(), JSON.stringify(a)); localStorage.setItem(lsMod() + ':bases', JSON.stringify(b)); } catch (e) {}
    };
    var local = function () { garde(nettoieMods(fn(nettoieMods(st.mods))), nettoieBases(fnB(nettoieBases(st.bases)))); return false; };
    if (!(c && V2.user)) return Promise.resolve(local());
    return c.from('profils').select('data').eq('scope_type', s.st).eq('scope_id', s.sid).maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      var d = (r.data && r.data.data) || {};
      var a = nettoieMods(fn(nettoieMods(d.modeles))), b = nettoieBases(fnB(nettoieBases(d.bases)));
      return c.from('profils').upsert({ scope_type: s.st, scope_id: s.sid, data: { modeles: a, bases: b }, updated_by: V2.user.id,
        updated_by_name: V2.user.name || '', updated_at: new Date().toISOString() }, { onConflict: 'scope_type,scope_id' })
        .then(function (u) { if (u.error) throw u.error; garde(a, b); return true; });
    }).catch(local);
  }

  // ── « Préparer le mail » : tout se modifie avant de partir ──────
  // c = { it, pid, nom, dest, objet, corps, docs:[clés], base: 'b:rdv' | 'm:<id>' | '', mode: 'envoi' | 'modele', modId }
  function origine(k, it) {
    it = it || { k: k, nom: '', pid: '', cree: new Date().toISOString() };
    return k === 'compte' ? mailCompte(it) : k === 'merci' ? mailMerci(it) : mailRdv(it, st.lien || '');
  }
  // Ma version garde des repères à la place du lien de rendez-vous et de l'accès Offilog :
  // s'ils changent, ma version suit. Repère sans valeur → le même [ ] que dans les mails d'origine.
  function jetons() {
    var r = reglages();
    return [['{lien}', st.lien || '', '[lien de prise de rendez-vous]'], ['{offilogId}', r.offilogId, '[identifiant]'], ['{offilogMdp}', r.offilogMdp, '[mot de passe]']];
  }
  function remplir(s) { return jetons().reduce(function (t, j) { return t.split(j[0]).join(j[1] || j[2]); }, String(s || '')); }
  function reperer(s) { return jetons().reduce(function (t, j) { return j[1] && j[1].length >= 6 ? t.split(j[1]).join(j[0]) : t; }, String(s || '')); }
  function texteDe(k, it) {
    var b = (st.bases || {})[k];
    return b ? { objet: remplir(b.objet), corps: remplir(b.corps) } : origine(k, it);
  }
  function docsDe(k) { var b = (st.bases || {})[k]; return (b ? b.docs : (KINDS[k] && KINDS[k].presel) || []).slice(); }
  function depuis(base, it) {
    if (base.indexOf('b:') === 0 && KINDS[base.slice(2)]) { var m = texteDe(base.slice(2), it); return { objet: m.objet, corps: m.corps, docs: docsDe(base.slice(2)), nom: MODELES.filter(function (x) { return x.k === base.slice(2); })[0].t }; }
    var x = (st.mods || []).filter(function (m) { return 'm:' + m.id === base; })[0];
    return x ? { objet: x.objet, corps: x.corps, docs: x.docs.slice(), nom: x.nom } : null;
  }
  function libDoc(k) { return V2.pharmaTxLabel ? V2.pharmaTxLabel(k) : k.slice(2); }
  function lireComp() {
    var c = st.comp; if (!c) return null;
    ['dest', 'objet', 'corps', 'nomMod'].forEach(function (f) { var el = document.getElementById('v2-tc-' + f); if (el) c[f] = el.value; });
    return c;
  }
  function composer(c) {
    ensureCss();
    c.mode = c.mode || 'envoi'; c.docs = c.docs || []; c.nomMod = c.nomMod || '';
    st.comp = c;
    chargerMods().then(function () { if (st.comp === c) dessinerComp(); });
    // Le nom d'une fiche Marketing jointe (clé M:) se lit dans la liste des fiches de l'équipe.
    if (V2.pharmaTxFiches) V2.pharmaTxFiches().then(function () { if (st.comp === c) dessinerComp(); });
    dessinerComp();
  }
  function dessinerComp() {
    var c = st.comp; if (!c) return;
    var o = document.getElementById('v2-todo-comp');
    if (!o) {
      o = document.createElement('div'); o.id = 'v2-todo-comp'; o.className = 'v2-todo-ov v2-todo-ov-comp';
      o.onclick = function () { V2.todo.fermerComp(); };
      document.body.appendChild(o);
      document.body.classList.add('v2-tc-on');
    }
    var modele = c.mode === 'modele', enBase = c.mode === 'base';
    var opts = '<option value="">' + (modele ? 'Partir d\'un mail existant…' : 'Changer de modèle…') + '</option>' +
      '<optgroup label="Les mails tout prêts">' + MODELES.map(function (m) { return '<option value="b:' + m.k + '">' + esc(m.t) + '</option>'; }).join('') + '</optgroup>' +
      ((st.mods || []).length ? '<optgroup label="Mes modèles">' + st.mods.map(function (m) { return '<option value="m:' + m.id + '">' + esc(m.nom) + '</option>'; }).join('') + '</optgroup>' : '');
    var docs = c.docs.length ? c.docs.map(function (k, i) {
      return '<span class="v2-tc-doc">' + ICO('fiche', 13, 2) + '<span>' + esc(libDoc(k)) + '</span><button aria-label="Retirer ce document" onclick="V2.todo.compRetirerDoc(' + i + ')">&times;</button></span>';
    }).join('') : '<span class="v2-tc-vide">Aucun document joint.</span>';
    var nDocs = c.docs.length;
    o.innerHTML = '<div class="v2-todo-pop v2-tc" role="dialog" aria-label="' + (enBase ? 'Ma version' : modele ? 'Mon modèle' : 'Préparer le mail') + '" onclick="event.stopPropagation()">' +
      '<div class="v2-todo-pop-h"><b>' + (enBase ? 'Ma version · ' + esc(c.nom) : modele ? (c.modId ? 'Modifier mon modèle' : 'Nouveau modèle') : 'Préparer le mail') + '</b>' +
        '<span>' + esc(enBase ? 'Ne vaut que pour vous' : modele ? '' : (c.nom || '')) + '</span><button class="v2-todo-x" aria-label="Fermer" onclick="V2.todo.fermerComp()">&times;</button></div>' +
      '<div class="v2-tc-b">' +
        (modele ? '<label><span>Nom du modèle</span>' + micChamp('<input id="v2-tc-nomMod" type="text" value="' + esc(c.nomMod) + '" placeholder="Ex. : Relance après salon">', 'Dicter le nom à la voix') + '</label>' : '') +
        (enBase ? '' : '<label><span>' + (modele ? 'Partir d\'un mail existant' : 'Modèle') + '</span><select id="v2-tc-base" onchange="V2.todo.compBase(this.value)">' + opts + '</select></label>') +
        (modele || enBase ? '' : '<label><span>À</span><input id="v2-tc-dest" type="email" autocomplete="off" value="' + esc(c.dest || '') + '" placeholder="Adresse du pharmacien (facultatif)"></label>') +
        '<label><span>Objet</span>' + micChamp('<input id="v2-tc-objet" type="text" value="' + esc(c.objet || '') + '">', 'Dicter l’objet à la voix') + '</label>' +
        '<label><span>Texte du mail</span>' + micChamp('<textarea id="v2-tc-corps" rows="14">' + esc(c.corps || '') + '</textarea>', 'Dicter le texte du mail à la voix') + '</label>' +
        '<div class="v2-tc-docs"><span class="v2-tc-lab">Documents joints</span><div class="v2-tc-chips">' + docs + '</div>' +
          '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.todo.compChoisirDocs()">' + ICO('plus', 14, 2) + 'Choisir dans la banque de fichiers</button></div>' +
        (!modele && c.garder ? '<div class="v2-tc-garde">' + micChamp('<input id="v2-tc-nomMod" type="text" value="' + esc(c.nomMod) + '" placeholder="Nom du modèle">', 'Dicter le nom à la voix') + '<button class="v2-btn v2-btn-primary v2-todo-sm" onclick="V2.todo.compEnregistrer()">Enregistrer</button></div>' : '') +
      '</div>' +
      '<div class="v2-tc-f">' +
        (enBase
          ? ((st.bases || {})[c.baseK] ? '<button class="v2-btn v2-btn-ghost v2-todo-sm v2-tc-sup" onclick="V2.todo.baseOrigine(\'' + c.baseK + '\')">Revenir au modèle d\'origine</button>' : '') +
            '<button class="v2-btn v2-btn-primary" onclick="V2.todo.compEnregistrer()">' + ICO('check', 15, 2) + 'Enregistrer ma version</button>'
        : modele
          ? (c.modId ? '<button class="v2-btn v2-btn-ghost v2-todo-sm v2-tc-sup" onclick="V2.todo.compSupprimer()">Supprimer ce modèle</button>' : '') +
            '<button class="v2-btn v2-btn-primary" onclick="V2.todo.compEnregistrer()">' + ICO('check', 15, 2) + 'Enregistrer le modèle</button>'
          : (c.garder ? '' : '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.todo.compGarder()">Enregistrer comme modèle</button>') +
            '<button class="v2-btn v2-btn-primary" onclick="V2.todo.compEnvoyer()">' + ICO(nDocs ? 'download' : 'fiche', 15, 2) +
              (nDocs ? 'Continuer avec ' + nDocs + ' document' + (nDocs > 1 ? 's' : '') : 'Ouvrir dans ma messagerie') + '</button>') +
      '</div></div>';
  }
  V2.todo.fermerComp = function () { st.comp = null; document.body.classList.remove('v2-tc-on'); var o = document.getElementById('v2-todo-comp'); if (o) o.remove(); };
  // Depuis la page : un mail tout prêt ou un de mes modèles, sans officine.
  V2.todo.preparer = function (base) {
    var run = function () { var d = depuis(base); if (d) composer({ pid: '', nom: '', dest: '', objet: d.objet, corps: d.corps, docs: d.docs, base: base }); };
    if (base.indexOf('m:') === 0) chargerMods().then(run); else run();
  };
  V2.todo.editerModele = function (base) {
    chargerMods().then(function () {
      var d = base ? depuis(base) : null, mine = base.indexOf('m:') === 0;
      composer({ mode: 'modele', modId: mine ? base.slice(2) : '', nomMod: d ? (mine ? d.nom : d.nom + ' (ma version)') : '',
        objet: d ? d.objet : '', corps: d ? d.corps : 'Bonjour,\n\n' + signature().replace(/^\n\n/, ''), docs: d ? d.docs : [], base: base });
    });
  };
  // Un mail tout prêt modifié pour moi seul (ligne `profils` personnelle, data.bases).
  V2.todo.editerBase = function (k) {
    if (!KINDS[k]) return;
    chargerMods().then(function () {
      var b = (st.bases || {})[k], m = b ? texteDe(k) : origine(k, { k: k, nom: '', pid: '', cree: '' });  // sans date : elle serait figée
      composer({ mode: 'base', baseK: k, nom: MODELES.filter(function (x) { return x.k === k; })[0].t, objet: m.objet, corps: m.corps, docs: docsDe(k), base: 'b:' + k });
    });
  };
  V2.todo.baseOrigine = function (k) {
    var nom = (MODELES.filter(function (x) { return x.k === k; })[0] || {}).t || '';
    if (!window.confirm('Revenir au modèle d\'origine « ' + nom + ' » ? Votre version sera effacée.')) return;
    ecrireMods(null, function (b) { delete b[k]; return b; }).then(function (ok) {
      if (V2.toast) V2.toast(ok ? 'Modèle d\'origine rétabli' : 'Rétabli sur cet appareil seulement — la base n\'a pas répondu', ok ? '' : 'warn');
      if (st.comp && st.comp.mode === 'base') V2.todo.fermerComp();
      rendre();
    });
  };
  V2.todo.compBase = function (base) {
    var c = lireComp(); if (!c || !base) return;
    var d = depuis(base, c.it); if (!d) return;
    if (c.corps && c.corps !== d.corps && !window.confirm('Remplacer le texte actuel par « ' + d.nom + ' » ?')) { dessinerComp(); return; }
    c.objet = d.objet; c.corps = d.corps; c.docs = d.docs; c.base = base;
    dessinerComp();
  };
  V2.todo.compRetirerDoc = function (i) { var c = lireComp(); if (!c) return; c.docs.splice(i, 1); dessinerComp(); };
  // La banque de fichiers = la fenêtre « Transmettre » (documents de l'app + bibliothèque de l'équipe),
  // en simple choix : chaque coche revient ici, « Valider le choix » ramène au mail.
  V2.todo.compChoisirDocs = function () {
    var c = lireComp(); if (!c || !V2.pharmaTransmettre) return;
    V2.pharmaTransmettre(c.mode === 'envoi' ? (c.pid || '') : '', c.docs, { nom: c.nom, mail: c.dest, texte: { objet: c.objet, corps: c.corps }, choixSeul: true,
      surChoix: function (keys) { if (st.comp === c) { c.docs = c.mode !== 'envoi' ? keys.filter(function (k) { return /^[SDMCP]:/.test(k); }) : keys; dessinerComp(); } } });
  };
  V2.todo.compGarder = function () { var c = lireComp(); if (!c) return; c.garder = true; dessinerComp(); var el = document.getElementById('v2-tc-nomMod'); if (el) el.focus(); };
  V2.todo.compEnregistrer = function () {
    var c = lireComp(); if (!c) return;
    if (c.mode === 'base') {
      var v = { objet: reperer(String(c.objet || '').trim()), corps: reperer(c.corps || ''), docs: c.docs.filter(function (k) { return /^[SDMCP]:/.test(k); }) };
      ecrireMods(null, function (b) { b[c.baseK] = v; return b; }).then(function (ok) {
        if (V2.toast) V2.toast(ok ? 'Votre version de « ' + c.nom + ' » est enregistrée' : 'Gardée sur cet appareil seulement — la base n\'a pas répondu', ok ? '' : 'warn');
        V2.todo.fermerComp(); rendre();
      });
      return;
    }
    var nom = String(c.nomMod || '').trim();
    if (!nom) { if (V2.toast) V2.toast('Donnez un nom au modèle', 'warn'); var el = document.getElementById('v2-tc-nomMod'); if (el) el.focus(); return; }
    var id = (c.mode === 'modele' && c.modId) || newId();
    var m = { id: id, nom: nom, objet: String(c.objet || '').trim(), corps: c.corps || '', docs: c.docs.filter(function (k) { return /^[SDMCP]:/.test(k); }) };
    ecrireMods(function (a) { return a.some(function (x) { return x.id === id; }) ? a.map(function (x) { return x.id === id ? m : x; }) : a.concat([m]); }).then(function (ok) {
      if (V2.toast) V2.toast(ok ? 'Modèle « ' + nom + ' » enregistré' : 'Modèle gardé sur cet appareil seulement — la base n\'a pas répondu', ok ? '' : 'warn');
      if (c.mode === 'modele') V2.todo.fermerComp(); else { c.garder = false; c.base = 'm:' + id; dessinerComp(); }
      rendre();
    });
  };
  V2.todo.compSupprimer = function () {
    var c = lireComp(); if (!c || !c.modId) return;
    if (!window.confirm('Supprimer le modèle « ' + (c.nomMod || '') + ' » ?')) return;
    ecrireMods(function (a) { return a.filter(function (x) { return x.id !== c.modId; }); }).then(function () { V2.todo.fermerComp(); rendre(); });
  };
  V2.todo.compEnvoyer = function () {
    var c = lireComp(); if (!c) return;
    var m = { objet: String(c.objet || '').trim(), corps: c.corps || '' }, dest = String(c.dest || '').trim();
    // Relances prospects (v2-relances.js) : la relance est notée au moment où le mail part vers la messagerie.
    if (c.surEnvoi) { var f = c.surEnvoi; c.surEnvoi = null; try { f(c); } catch (e) {} }
    if (!c.docs.length) { ouvrirMail(dest, m); return; }
    // Avec documents : la fenêtre « Transmettre » les prépare puis les envoie avec CE texte (Safari
    // n'ouvre la feuille de partage que dans un clic, d'où ses deux temps « Préparer » puis « Envoyer »).
    if (V2.pharmaTransmettre) V2.pharmaTransmettre(c.pid || '', c.docs, { nom: c.nom, mail: dest, texte: m,
      surChoix: function (keys) { if (st.comp === c) { c.docs = keys; dessinerComp(); } } });
  };
  // Pour v2-relances.js : la même fenêtre « Préparer le mail », la même signature, le même accès test Offilog.
  V2.todo.composerMail = function (c) { composer(c); };
  V2.todo.signature = function () { return signature(); };
  V2.todo.reglagesMail = function () { return reglages(); };
  // Onglets de la page : mes tâches, les relances prospects, les prospects chauds (16/10/2026).
  V2.todo.onglet = function (o) { st.onglet = o; if (o !== 'taches' && V2.relances && V2.relances.rafraichir) V2.relances.rafraichir(); rendre(); };
  V2.todo.copierModele = function (k) {
    var x = modele(k), t = 'Objet : ' + x.objet + '\n\n' + x.corps;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { if (V2.toast) V2.toast('Texte copié'); }, function () { window.prompt('Copiez ce texte :', t); });
    } else window.prompt('Copiez ce texte :', t);
  };

  V2.pages.todo = {
    needs: [],
    render: function (root) {
      ensureCss();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'home', backLabel: 'Accueil' }) : '';
      if (st.items == null) {
        root.innerHTML = top + '<div class="v2-wrap narrow"><div class="v2-todo-hero"><h1>To do list</h1><p>Chargement…</p></div></div>';
        charger().then(rendre);
        return;
      }
      var ouv = trier(V2.todo.ouverts()), faits = (st.items || []).filter(function (x) { return x.fait; })
        .sort(function (a, b) { return String(b.faitLe).localeCompare(String(a.faitLe)); });
      var liste = st.filtre === 'fait' ? faits : ouv;
      // 16/10, Will : « dans la to do list, un truc relance et un truc prospects chauds ».
      var R = V2.relances, ong = R ? st.onglet : 'taches', nR = R ? R.nbARelancer() : null, nC = R ? R.nbChauds() : null;
      var onglets = R ? '<div class="v2-todo-tabs" role="tablist">' + [['taches', 'Tâches', ouv.length], ['relances', 'À relancer', nR], ['chauds', 'Prospects chauds', nC]].map(function (o) {
        return '<button role="tab" aria-selected="' + (ong === o[0]) + '" class="' + (ong === o[0] ? 'is-on' : '') + '" onclick="V2.todo.onglet(\'' + o[0] + '\')">' + o[1] + (o[2] != null ? ' · ' + o[2] : '') + '</button>';
      }).join('') + '</div>' : '';
      if (ong !== 'taches') {
        root.innerHTML = top + '<div class="v2-wrap narrow"><div class="v2-todo-hero"><h1>To do list</h1></div>' + onglets + R.html(ong) + '</div>';
        return;
      }
      var noms = (V2.pharmacies || []).map(function (p) { return '<option value="' + esc(p.name || '') + '">'; }).join('');
      root.innerHTML = top +
        '<div class="v2-wrap narrow">' +
          '<div class="v2-todo-hero"><h1>To do list</h1>' +
            '<p>Demandes de rendez-vous à envoyer, suites de rendez-vous, ouvertures de compte, et tout le reste. Personnelle : chacun voit la sienne.' +
            (st.backend === 'local' ? ' <b>Gardée sur cet appareil seulement.</b>' : '') + '</p></div>' + onglets +
          '<div class="v2-card v2-todo-add">' +
            '<div class="v2-todo-kinds">' + ORDER.map(function (k) {
              return '<button class="v2-todo-kind' + (st.kind === k ? ' is-on' : '') + '" onclick="V2.todo.choisir(\'' + k + '\')">' + ICO(KINDS[k].ico, 15, 2) + '<span>' + esc(KINDS[k].l) + '</span></button>';
            }).join('') + '</div>' +
            '<div class="v2-todo-form">' +
              '<label><span>Officine</span><input id="v2-todo-nom" list="v2-todo-noms" type="text" placeholder="Nom de l\'officine (ou rien)" autocomplete="off"><datalist id="v2-todo-noms">' + noms + '</datalist></label>' +
              '<label><span>Pour le</span><input id="v2-todo-pour" type="date"></label>' +
              '<label><span>Répéter</span><select id="v2-todo-rep">' + Object.keys(REP).map(function (k) { return '<option value="' + k + '">' + esc(REP[k]) + '</option>'; }).join('') + '</select></label>' +
              '<label class="v2-todo-wide"><span>Note</span>' + micChamp('<input id="v2-todo-note" type="text" placeholder="' + (st.kind === 'libre' ? 'Ce qu\'il y a à faire' : 'Une précision (facultatif)') + '" onkeydown="if(event.key===\'Enter\')V2.todo.ajouter()">', 'Dicter la note à la voix') + '</label>' +
              '<button class="v2-btn v2-btn-primary" onclick="V2.todo.ajouter()">' + ICO('plus', 15, 2) + 'Ajouter</button>' +
            '</div>' +
            '<div class="v2-todo-hint">Depuis une fiche officine, le bouton « Ajouter à la to do list » remplit l\'officine et son e-mail tout seul. ' +
              '« Répéter » : la ligne revient chaque semaine ou chaque mois à partir de la date choisie (aujourd\'hui sinon) ; la cocher la repousse à la fois suivante.</div>' +
          '</div>' +
          '<div class="v2-todo-tools"><div class="v2-todo-seg">' +
            '<button class="' + (st.filtre !== 'fait' ? 'is-on' : '') + '" onclick="V2.todo.filtrer(\'afaire\')">À faire · ' + ouv.length + '</button>' +
            '<button class="' + (st.filtre === 'fait' ? 'is-on' : '') + '" onclick="V2.todo.filtrer(\'fait\')">Fait · ' + faits.length + '</button></div></div>' +
          (liste.length ? '<div class="v2-card v2-todo-list">' + liste.map(ligne).join('') + '</div>'
            : '<div class="v2-card v2-todo-empty">' + (st.filtre === 'fait' ? 'Rien de coché pour l\'instant.' : 'Rien à faire pour l\'instant — la liste est vide.') + '</div>') +
          mailsPrets() +
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
      '.v2-todo-form{display:grid;grid-template-columns:1fr 160px 160px;gap:10px;align-items:end}',
      '.v2-todo-form label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--muted);min-width:0}',
      '.v2-todo-form input{min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:16px;background:#fff;color:var(--ip-ink);width:100%;box-sizing:border-box}',
      '.v2-todo-form select{min-height:44px;padding:8px 32px 8px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:16px;color:var(--ip-ink);width:100%;box-sizing:border-box;-webkit-appearance:none;appearance:none;background:#fff url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%235B6475%27 stroke-width=%272%27%3E%3Cpath d=%27M4 6l4 4 4-4%27/%3E%3C/svg%3E") no-repeat right 10px center}',
      '.v2-todo-form input:focus,.v2-todo-form select:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo,#E9F0FF)}',
      '.v2-todo-wide{grid-column:1 / span 2}',
      '.v2-todo-form .v2-btn{min-height:44px;justify-content:center}',
      '.v2-todo-hint{margin-top:10px;font-size:12.5px;color:var(--muted)}',
      '.v2-todo-tools{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}',
      '.v2-todo-seg{display:inline-flex;gap:2px;padding:3px;background:var(--surf-sunken,#F4F6FA);border:1px solid var(--line);border-radius:10px}',
      '.v2-todo-seg button{border:none;background:none;min-height:38px;padding:6px 14px;border-radius:7px;font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer}',
      '.v2-todo-seg button.is-on{background:#fff;color:var(--ip-ink);box-shadow:0 1px 3px rgba(15,20,32,.12)}',
      '.v2-todo-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:3px;margin:0 0 16px;background:var(--surf-sunken,#F4F6FA);border:1px solid var(--line);border-radius:12px}',
      '.v2-todo-tabs button{border:none;background:none;min-height:44px;padding:6px 8px;border-radius:9px;font:inherit;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer;line-height:1.2}',
      '.v2-todo-tabs button.is-on{background:#fff;color:var(--ip-ink);box-shadow:0 1px 3px rgba(15,20,32,.12)}',
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
      '.v2-todo-b{font-size:12px;font-weight:700;margin-left:auto}',
      '.v2-todo-n{font-size:13.5px;color:var(--muted)}',
      '.v2-todo-n-libre{font-size:14px;color:var(--ip-ink);line-height:1.45;overflow-wrap:anywhere}',
      '.v2-todo-n-in{min-height:36px;padding:6px 10px;border:1px solid transparent;border-radius:8px;font:inherit;font-size:16px;background:transparent;color:var(--ip-ink);width:100%;box-sizing:border-box}',
      '.v2-todo-n-in:hover,.v2-todo-n-in:focus{border-color:var(--line);background:#fff;outline:none}',
      '.v2-todo-acts{display:flex;flex-wrap:wrap;gap:8px}',
      '.v2-todo-sm{min-height:40px;font-size:12.5px;padding:6px 12px}',
      // Cible tactile ≥44px au doigt (mobile seulement) — la souris n'a pas ce besoin.
      '@media(max-width:640px){.v2-todo-seg button{min-height:44px}.v2-todo-sm{min-height:44px;display:inline-flex;align-items:center}}',
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
      '.v2-todo-mh{margin:28px 0 10px}',
      '.v2-todo-mh h2{font-size:18px;font-weight:800;letter-spacing:-.02em;margin:0 0 4px;color:var(--ip-ink)}',
      '.v2-todo-mh p{margin:0;font-size:13.5px;color:var(--ip-ink-2)}',
      '.v2-todo-mail{border-top:1px solid var(--line)}',
      '.v2-todo-mail:first-child{border-top:none}',
      '.v2-todo-mail summary{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 18px;cursor:pointer;list-style:none}',
      '.v2-todo-mail summary::-webkit-details-marker{display:none}',
      '.v2-todo-mt{flex:1;min-width:0}',
      '.v2-todo-mt b{display:block;font-size:14px;font-weight:700;color:var(--ip-ink)}',
      '.v2-todo-mt small{display:block;font-size:12.5px;color:var(--ip-ink-2)}',
      '.v2-todo-chev{flex:none;color:var(--muted);display:inline-flex;transition:transform .2s var(--ease)}',
      '.v2-todo-mail[open] .v2-todo-chev{transform:rotate(90deg)}',
      '.v2-todo-mb{padding:0 18px 16px;display:flex;flex-direction:column;gap:10px}',
      '.v2-todo-reg{padding:12px 14px;border:1px dashed var(--line);border-radius:12px;display:flex;flex-direction:column;gap:4px}',
      '.v2-todo-reg b{font-size:13px;font-weight:800;color:var(--ip-ink)}',
      '.v2-todo-reg span{font-size:12.5px;color:var(--ip-ink-2)}',
      '.v2-todo-reg-f{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}',
      '.v2-todo-reg-f input{flex:1 1 160px;min-width:0;min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:16px;background:var(--card,#fff);color:var(--ip-ink)}',
      '.v2-todo-obj{font-size:14px;font-weight:700;color:var(--ip-ink)}',
      '.v2-todo-obj span{display:block;font-size:12px;font-weight:700;color:var(--ip-ink-2);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}',
      '.v2-todo-corps{margin:0;padding:14px 16px;background:var(--card-2,#F7F9FC);border:1px solid var(--line);border-radius:12px;font:inherit;font-size:14px;line-height:1.55;color:var(--ip-ink);white-space:pre-wrap;overflow-wrap:anywhere}',
      // Sous la fenêtre « Transmettre » (z-index 120), qui s'ouvre par-dessus pour choisir les fichiers
      '.v2-todo-ov-comp{z-index:110;align-items:flex-start;padding:4vh 16px;overflow-y:auto}',
      '.v2-tc{width:min(640px,100%);padding:8px 8px 12px}',
      '.v2-tc-b{display:flex;flex-direction:column;gap:12px;padding:6px 12px 4px}',
      '.v2-tc-b label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--ip-ink-2)}',
      '.v2-tc-b input,.v2-tc-b select,.v2-tc-b textarea,.v2-tc-garde input{min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:16px;font-weight:400;background:#fff;color:var(--ip-ink);width:100%;box-sizing:border-box}',
      // Le rond « + » de l'app (z-index 9400) passait par-dessus la fenêtre du mail
      'body.v2-tc-on .v2-fab{display:none}',
      '.v2-tc-b select{-webkit-appearance:none;appearance:none;padding-right:36px;background:#fff url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%235B6475%27 stroke-width=%272%27%3E%3Cpath d=%27M4 6l4 4 4-4%27/%3E%3C/svg%3E") no-repeat right 12px center}',
      '.v2-tc-b textarea{line-height:1.5;resize:vertical;min-height:240px}',
      '.v2-tc-b input:focus,.v2-tc-b select:focus,.v2-tc-b textarea:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo,#E9F0FF)}',
      '.v2-tc-docs{display:flex;flex-direction:column;gap:8px;align-items:flex-start}',
      '.v2-tc-lab{font-size:12px;font-weight:700;color:var(--ip-ink-2)}',
      '.v2-tc-chips{display:flex;flex-wrap:wrap;gap:6px}',
      '.v2-tc-doc{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:4px 4px 4px 10px;border-radius:999px;background:var(--halo,#E9F0FF);color:var(--ip-ink);font-size:13px;font-weight:600}',
      '.v2-tc-doc span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.v2-tc-doc svg{flex:none;color:var(--ip-blue)}',
      '.v2-tc-doc button{flex:none;width:32px;height:32px;border:none;border-radius:50%;background:none;font-size:18px;line-height:1;color:var(--ip-ink-2);cursor:pointer}',
      '.v2-tc-vide{font-size:13px;color:var(--ip-ink-2)}',
      '.v2-tc-garde{display:flex;gap:8px;align-items:center}',
      '.v2-tc-f{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:8px;padding:12px 12px 0;margin-top:8px;border-top:1px solid var(--line)}',
      '.v2-tc-f .v2-btn-primary{min-height:44px}',
      '.v2-tc-sup{margin-right:auto;color:var(--c-rose)}',
      '.v2-todo-mod{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;padding:12px 18px;border-top:1px solid var(--line)}',
      '.v2-todo-mod:first-child{border-top:none}',
      '.v2-todo-mod .v2-todo-mt{flex:1 1 200px}',
      '.v2-todo-mien{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:var(--halo,#E9F0FF);color:var(--ip-blue);font-size:12px;font-style:normal;font-weight:700;vertical-align:1px}',
      '.v2-todo-mod-add{padding:12px 18px;border-top:1px solid var(--line)}',
      // Rappels qui reviennent (16/10/2026)
      '.v2-todo-rep{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;background:var(--halo,#E9F0FF);color:var(--ip-blue);font-size:12px;font-weight:700}',
      '.v2-todo-der{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--ip-ink-2)}',
      '.v2-todo-der svg{color:var(--c-mint)}',
      '.v2-todo-der button{border:none;background:none;padding:6px 4px;min-height:32px;font:inherit;font-weight:700;color:var(--ip-blue);cursor:pointer;text-decoration:underline}',
      '.v2-todo-rp{width:min(480px,100%);padding:8px 8px 14px}',
      '.v2-todo-rp-b{display:flex;flex-direction:column;gap:12px;padding:6px 12px 4px}',
      '.v2-todo-rp-b>label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--ip-ink-2)}',
      '.v2-todo-rp-b input[type=date]{min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:16px;background:#fff;color:var(--ip-ink);width:100%;box-sizing:border-box}',
      '.v2-todo-rp-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:3px;background:var(--surf-sunken,#F4F6FA);border:1px solid var(--line);border-radius:12px}',
      '.v2-todo-rp-seg label{position:relative;display:flex}',
      '.v2-todo-rp-seg input{position:absolute;opacity:0;width:1px;height:1px}',
      '.v2-todo-rp-seg span{flex:1;display:flex;align-items:center;justify-content:center;text-align:center;min-height:44px;padding:4px 6px;border-radius:9px;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer;line-height:1.2}',
      '.v2-todo-rp-seg input:checked+span{background:#fff;color:var(--ip-ink);box-shadow:0 1px 3px rgba(15,20,32,.12)}',
      '.v2-todo-rp-seg input:focus-visible+span{box-shadow:0 0 0 3px var(--halo,#E9F0FF)}',
      '.v2-todo-rp-p{margin:0;font-size:14px;font-weight:600;color:var(--ip-ink)}',
      '.v2-todo-rp-n{margin:10px 12px 0;font-size:12.5px;line-height:1.45;color:var(--ip-ink-2)}',
      '.v2-todo-mn-pop{max-height:calc(100vh - 32px);overflow-y:auto}',
      '.v2-todo-mn{padding-bottom:8px}',
      '.v2-todo-mn input[type=text]{min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:16px;background:#fff;color:var(--ip-ink);width:100%;box-sizing:border-box}',
      '.v2-todo-rp-b>label.v2-todo-mn-al{flex-direction:row;align-items:center;gap:10px;min-height:44px;font-size:14px;font-weight:600;color:var(--ip-ink);cursor:pointer}',
      '.v2-todo-mn-al input{flex:none;width:20px;height:20px;margin:0;accent-color:var(--ip-blue)}',
      '.v2-todo-mn-k{margin:0 4px;padding:10px 8px 2px;border-top:1px solid var(--line);font-size:12px;font-weight:700;color:var(--ip-ink-2)}',
      // Sur téléphone, les trois boutons en pleine largeur, « Enregistrer » d'abord
      '@media(max-width:640px){.v2-todo-rp .v2-tc-f{flex-direction:column-reverse;align-items:stretch}.v2-todo-rp .v2-tc-f .v2-btn{justify-content:center}.v2-todo-rp .v2-tc-sup{margin-right:0}}',
      '@media (max-width:760px){.v2-todo-kinds{grid-template-columns:1fr 1fr}.v2-todo-form{grid-template-columns:1fr}.v2-todo-wide{grid-column:auto}.v2-todo-b{margin-left:0}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
