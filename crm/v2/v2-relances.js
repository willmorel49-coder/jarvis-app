/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Relances prospects et prospects chauds (V2.relances)
   Demande de Will, 16/10/2026 : « un suivi de toutes les pharmacies à qui
   j'ai envoyé des mails, qui sont en prospect, que je n'ai pas en client,
   et un mail de relance intelligemment fait pour voir ce qu'il en est et
   les pousser à tester avec nous — dans la to do list, un truc relance et
   un truc prospects chauds. »

   D'OÙ VIENT LA LISTE — uniquement ce que JARVIS a vu passer, pour MOI :
     • les demandes de rendez-vous par lien (rdv_lien) et par envoi groupé (rdv_envoi) ;
     • les documents préparés dans « Transmettre » (trace dans `notes`) ;
     • les lignes « mail » de ma to do list (rendez-vous, après rendez-vous, ouverture de compte) ;
     • les pharmacies que j'ajoute à la main (mails partis hors de JARVIS).
   JARVIS ne lit pas la boîte mail : un mail écrit ailleurs ne se voit pas,
   d'où l'ajout à la main, et on le dit à l'écran.
   On retire : les clientes (V2.pharmacies, V2.promoted, carte réconciliée) et
   les officines qui ont demandé à ne plus être sollicitées (rdv_opposes).

   PERSONNEL, comme la to do list : une ligne `profils` par personne
   (scope `__relance_<uid>__`) garde les relances faites, les statuts et les
   ajouts à la main. Les relances partent de SA boîte, par la fenêtre
   « Préparer le mail » de la to do list ; JARVIS note la relance au clic
   sur « Ouvrir dans ma messagerie » (annulable le jour même).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = function (n, s, w) { return window.ICO ? window.ICO(n, s, w) : ''; };
  var LS = 'jarvis_relances_v1';
  var JOUR = 86400000;
  // Délai avant la relance suivante, selon le nombre de relances déjà faites (1re à J+7, puis +10, puis +14).
  var DELAIS = [7, 10, 14];
  var SEUIL_CHAUD = 3;

  var ORIGINES = {
    compte: { l: 'Formulaire d\'ouverture envoyé', rang: 6 },
    merci:  { l: 'Mail après le rendez-vous',      rang: 5 },
    docs:   { l: 'Documents envoyés',              rang: 4 },
    rdv:    { l: 'Demande de rendez-vous',         rang: 3 },
    lien:   { l: 'Invitation à prendre rendez-vous', rang: 2 },
    groupe: { l: 'Invitation groupée à prendre rendez-vous', rang: 1 },
    ajout:  { l: 'Mail envoyé (ajouté à la main)', rang: 0 }
  };

  var st = { calc: null, enCours: null, store: null, backend: 'local', voirEcartes: false, ko: [] };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function scope() { return { st: 'groupement', sid: '__relance_' + (uid() || 'local') + '__' }; }
  function lsKey() { return LS + ':' + (uid() || 'local'); }
  function rendre() { if (V2.route && V2.route.name === 'todo' && V2.render) V2.render(); }
  function auj() { var t = new Date(); t.setHours(0, 0, 0, 0); return t; }
  function dateFr(iso) {
    if (!iso) return '';
    var d = new Date(String(iso).length === 10 ? iso + 'T00:00:00' : iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }
  function jourDe(iso) { var d = new Date(iso); d.setHours(0, 0, 0, 0); return d; }
  function normMail(m) { return String(m || '').trim().toLowerCase(); }
  // Un identifiant d'officine finit dans un onclick : chiffres, lettres, _ et - seulement (comme sur() de la to do list).
  function sur(v) { return String(v == null ? '' : v).replace(/[^0-9A-Za-z_-]/g, '').slice(0, 40); }
  var RE_MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  function mailsDans(t) { return (String(t || '').match(RE_MAIL) || []).map(normMail); }

  // ── Mon carnet (relances faites, statuts, ajouts à la main) ─────
  function nettoie(o) {
    var s = (o && o.s && typeof o.s === 'object') ? o.s : {}, out = {};
    Object.keys(s).forEach(function (k) {
      var x = s[k] || {};
      out[k] = { r: (Array.isArray(x.r) ? x.r : []).filter(Boolean).map(String),
                 st: ['', 'chaud', 'repondu', 'non'].indexOf(x.st) >= 0 ? x.st : '',
                 aj: x.aj && typeof x.aj === 'object' ? { nom: String(x.aj.nom || ''), mail: normMail(x.aj.mail), pid: sur(x.aj.pid), d: String(x.aj.d || '') } : null };
    });
    return { s: out };
  }
  function lireStore() {
    var c = sb(), s = scope();
    if (!(c && uid())) { st.backend = 'local'; try { return Promise.resolve(nettoie(JSON.parse(localStorage.getItem(lsKey()) || '{}'))); } catch (e) { return Promise.resolve(nettoie()); } }
    return c.from('profils').select('data').eq('scope_type', s.st).eq('scope_id', s.sid).maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      st.backend = 'supabase';
      var o = nettoie(r.data && r.data.data);
      try { localStorage.setItem(lsKey(), JSON.stringify(o)); } catch (e) {}
      return o;
    }).catch(function () {
      st.backend = 'local';
      try { return nettoie(JSON.parse(localStorage.getItem(lsKey()) || '{}')); } catch (e) { return nettoie(); }
    });
  }
  // Relit juste avant d'écrire (l'iPhone et le Mac de la même personne ne s'écrasent pas).
  function ecrire(fn) {
    var c = sb(), s = scope();
    var local = function () {
      st.store = fn(nettoie(st.store));
      try { localStorage.setItem(lsKey(), JSON.stringify(st.store)); } catch (e) {}
    };
    if (!(c && uid() && st.backend === 'supabase')) { local(); return Promise.resolve(true); }
    return c.from('profils').select('data').eq('scope_type', s.st).eq('scope_id', s.sid).maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      var o = fn(nettoie(r.data && r.data.data));
      return c.from('profils').upsert({ scope_type: s.st, scope_id: s.sid, data: o, updated_by: uid(),
        updated_by_name: (V2.user && V2.user.name) || '', updated_at: new Date().toISOString() }, { onConflict: 'scope_type,scope_id' })
        .then(function (u) { if (u.error) throw u.error; st.store = o; try { localStorage.setItem(lsKey(), JSON.stringify(o)); } catch (e) {} return true; });
    }).catch(function () {
      local();
      if (V2.toast) V2.toast('Gardé sur cet appareil seulement — la base n\'a pas répondu', 'warn');
      return false;
    });
  }
  function fiche(o, cle) { o.s[cle] = o.s[cle] || { r: [], st: '', aj: null }; return o.s[cle]; }

  // ── Les officines : carte nationale, clientes, e-mails ──────────
  function carte() {
    return new Promise(function (ok) {
      if (!V2.ensurePharmaFr) return ok();
      var fini = false, t = setTimeout(function () { if (!fini) { fini = true; ok(); } }, 15000);
      V2.ensurePharmaFr(function () { if (!fini) { fini = true; clearTimeout(t); ok(); } });
    });
  }
  function index() {
    var D = window.PHARMA_FR, parId = {}, parMail = {};
    if (D && D.p) D.p.forEach(function (p) {
      var id = String(p[13] || ''); if (!id) return;
      parId[id] = p;
      var m = normMail(p[11]); if (m && !parMail[m]) parMail[m] = id;
    });
    var MC = window.MAILS_COMPLEMENT || {};
    Object.keys(MC).forEach(function (cip) { var m = normMail(MC[cip] && MC[cip].email); if (m && !parMail[m]) parMail[m] = String(cip); });
    var clients = {};
    (V2.pharmacies || []).forEach(function (p) {
      clients[String(p.id)] = p;
      var m = normMail(p.email); if (m) parMail[m] = String(p.id);   // l'e-mail d'une cliente gagne : elle doit sortir de la liste
    });
    return { D: D, parId: parId, parMail: parMail, clients: clients };
  }
  function estCliente(I, pid) {
    if (!pid) return false;
    if (I.clients[pid] || (V2.promoted || {})[pid]) return true;
    var p = I.parId[pid];
    // le segment brut de la carte est faux : on ne le croit qu'une fois réconcilié avec les ventes
    return !!(p && I.D && I.D._wmlRecon && /^Client/.test(String(I.D.seg[p[4]] || '')));
  }
  function infos(I, pid) {
    var r = {};
    if (pid && V2.rdvInfo) { try { r = V2.rdvInfo(pid) || {}; } catch (e) { r = {}; } }
    var p = pid ? I.parId[pid] : null;
    var grp = p && I.D && I.D.grp ? String(I.D.grp[p[3]] || '') : '';
    return { nom: (V2.nameOvr && V2.nameOvr[pid]) || r.nom || (p && p[6]) || '', ville: r.ville || (p && p[7]) || '',
             mail: normMail(r.email || (p && p[11])), tel: String(r.tel || r.portable || (p && p[9]) || ''), grp: grp && grp !== '—' ? grp : '' };
  }

  // ── Les envois que JARVIS a vus passer ──────────────────────────
  function requete(nom, p) {
    return Promise.resolve(p).then(function (r) { if (r && r.error) throw r.error; return (r && r.data) || []; })
      .catch(function () { st.ko.push(nom); return []; });
  }
  function lireEnvois() {
    var c = sb(), u = uid();
    if (!(c && u)) return Promise.resolve({ liens: [], groupes: [], notes: [], rdvs: [], stop: [] });
    return Promise.all([
      requete('invitations par lien', c.from('rdv_lien').select('cip, nom, ville, envoye_le, consomme_le, vues, vu_dernier_le').eq('user_id', u).not('envoye_le', 'is', null).order('envoye_le', { ascending: false }).limit(1000)),
      requete('envois groupés', c.from('rdv_envoi').select('envoye_le, rdv_envoi_dest(cip, nom, ville, email)').eq('user_id', u).not('envoye_le', 'is', null).order('envoye_le', { ascending: false }).limit(200)),
      requete('documents transmis', c.from('notes').select('scope_id, created_at').eq('scope_type', 'client').eq('author_id', u).like('body', 'Documents préparés pour envoi%').order('created_at', { ascending: false }).limit(1000)),
      requete('rendez-vous pris', c.from('rdv').select('cip, date, statut, cree_le').eq('user_id', u).limit(2000)),
      requete('refus de sollicitation', c.rpc('rdv_opposes'))
    ]).then(function (r) { return { liens: r[0], groupes: r[1], notes: r[2], rdvs: r[3], stop: r[4] }; });
  }

  // ── Le calcul : une ligne par officine contactée ────────────────
  // Lecture (base + carte nationale), puis construction de la liste à partir de ce qui a été lu.
  // Un changement de statut ne refait que la construction.
  function calculer() {
    if (st.enCours) return st.enCours;
    st.ko = [];
    st.enCours = Promise.all([carte(), lireEnvois(), lireStore(), V2.todo && V2.todo.charger ? V2.todo.charger().catch(function () { return []; }) : Promise.resolve([])])
      .then(function (r) { st.E = r[1]; st.store = r[2]; st.lu = Date.now(); st.enCours = null; return construire(); },
            function (e) { st.enCours = null; throw e; });
    return st.enCours;
  }
  function construire() {
        var E = st.E || {};
        var I = index(), par = {}, clientes = {}, stop = {};
        (E.stop || []).forEach(function (x) { stop[String(x && x.cip != null ? x.cip : x)] = true; });

        function cleDe(pid, mail, repli) {
          pid = sur(pid);
          if (!pid && mail && I.parMail[mail]) pid = sur(I.parMail[mail]);
          return pid ? { cle: pid, pid: pid } : (mail ? { cle: 'm:' + mail, pid: '' } : { cle: repli, pid: '' });
        }
        function contact(pid, mail, repli, c, nom) {
          var k = cleDe(pid, normMail(mail), repli); if (!k.cle) return;
          if (estCliente(I, k.pid)) { clientes[k.cle] = true; return; }
          if (k.pid && stop[k.pid]) return;
          var s = par[k.cle] = par[k.cle] || { cle: k.cle, pid: k.pid, nomVu: '', mailVu: '', contacts: [], signaux: [] };
          if (nom && !s.nomVu) s.nomVu = nom;
          if (mail && !s.mailVu) s.mailVu = normMail(mail);
          if (c) s.contacts.push(c);
          return s;
        }

        (E.liens || []).forEach(function (l) {
          var s = contact(l.cip, '', '', { d: l.envoye_le, t: 'lien' }, l.nom); if (!s) return;
          if (l.consomme_le) s.rdvPris = s.rdvPris || l.consomme_le;
          if (l.vues > 0) { s.vues = (s.vues || 0) + l.vues; s.vuLe = s.vuLe && s.vuLe > l.vu_dernier_le ? s.vuLe : l.vu_dernier_le; }
        });
        (E.groupes || []).forEach(function (g) {
          (g.rdv_envoi_dest || []).forEach(function (d) { contact(d.cip, d.email, '', { d: g.envoye_le, t: 'groupe' }, d.nom); });
        });
        (E.notes || []).forEach(function (n) { contact(n.scope_id, '', '', { d: n.created_at, t: 'docs' }); });
        ((V2.todo && V2.todo.tous && V2.todo.tous()) || []).forEach(function (it) {
          if (['rdv', 'merci', 'compte'].indexOf(it.k) < 0) return;
          var mail = normMail(it.mail) || mailsDans(it.note)[0] || '';
          contact(it.pid, mail, 't:' + it.id, { d: it.faitLe || it.cree, t: it.k, note: it.note, pasCoche: !it.fait }, it.nom);
        });
        Object.keys(st.store.s).forEach(function (k) {
          var a = st.store.s[k].aj; if (!a) return;
          var s = contact(a.pid, a.mail, k, { d: a.d || '', t: 'ajout' }, a.nom);
          if (s && s.cle !== k) s.cleAj = k;   // rangé sous une autre clé (adresse rattachée depuis à une fiche)
        });
        // un rendez-vous pris (même hors lien unique) : signal fort
        (E.rdvs || []).forEach(function (v) {
          if (v.statut === 'annule' || !par[String(v.cip)]) return;
          var s = par[String(v.cip)]; s.rdvPris = s.rdvPris || v.date || v.cree_le;
        });

        var t0 = auj(), lignes = [];
        Object.keys(par).forEach(function (cle) {
          var s = par[cle];
          s.cleStore = st.store.s[cle] || !s.cleAj ? cle : s.cleAj;
          var f = st.store.s[s.cleStore] || { r: [], st: '', aj: null };
          s.contacts = s.contacts.filter(function (c) { return c.d; }).sort(function (a, b) { return String(a.d).localeCompare(String(b.d)); });
          if (!s.contacts.length) return;
          var inf = infos(I, s.pid);
          s.nom = inf.nom || s.nomVu || (s.mailVu ? s.mailVu.split('@')[0] : 'Officine');
          s.ville = inf.ville; s.grp = inf.grp; s.tel = inf.tel; s.mail = inf.mail || s.mailVu;
          s.relances = f.r.slice().sort(); s.st = f.st; s.manuel = !!f.aj;
          s.notes = s.contacts.map(function (c) { return c.note; }).filter(Boolean);
          s.origine = s.contacts.reduce(function (m, c) { return ORIGINES[c.t].rang > ORIGINES[m.t].rang ? c : m; }, s.contacts[0]);
          s.premier = s.contacts[0].d;
          s.dernierMail = s.contacts[s.contacts.length - 1].d;
          var dernier = [s.dernierMail].concat(s.relances).sort().pop();
          s.dernier = dernier;
          s.prochaine = new Date(jourDe(dernier).getTime() + DELAIS[Math.min(s.relances.length, DELAIS.length - 1)] * JOUR);
          var jours = Math.round((s.prochaine - t0) / JOUR);
          s.dans = jours;
          s.etat = s.st === 'non' ? 'ecarte' : s.st === 'repondu' ? 'repondu' : jours > 0 ? 'attente' : s.relances.length >= 3 ? 'appeler' : 'due';
          // Ce qui rend un prospect « chaud » : des gestes de SA part, puis les miens qui l'engagent.
          var sig = [];
          if (s.st === 'chaud') sig.push({ t: 'Marqué chaud', p: 5 });
          if (s.st === 'repondu') sig.push({ t: 'A répondu', p: 3 });
          if (s.contacts.some(function (c) { return c.t === 'compte'; })) sig.push({ t: 'Formulaire d\'ouverture envoyé', p: 4 });
          if (s.rdvPris) sig.push({ t: 'Rendez-vous pris' + (dateFr(String(s.rdvPris).slice(0, 10)) ? ' · ' + dateFr(String(s.rdvPris).slice(0, 10)) : ''), p: 3 });
          else if (s.contacts.some(function (c) { return c.t === 'merci'; })) sig.push({ t: 'Rendez-vous fait', p: 3 });
          if (s.vues) sig.push({ t: 'A ouvert votre lien de rendez-vous' + (s.vues > 1 ? ' · ' + s.vues + ' fois' : ''), p: s.vues > 1 ? 3 : 2 });
          if (s.contacts.some(function (c) { return c.t === 'docs'; })) sig.push({ t: 'Documents envoyés', p: 1 });
          if ((t0 - jourDe(dernier)) / JOUR <= 10) sig.push({ t: 'Contact récent', p: 1 });
          s.signaux = sig;
          s.score = s.etat === 'ecarte' ? 0 : sig.reduce(function (n, x) { return n + x.p; }, 0);
          lignes.push(s);
        });
        lignes.forEach(function (s, i) { s.id = 'r' + i; });
        st.calc = { lignes: lignes, clientes: Object.keys(clientes).length, quand: st.lu || Date.now() };
        return st.calc;
  }
  function parId(id) { return st.calc ? st.calc.lignes.filter(function (s) { return s.id === id; })[0] : null; }
  function aRelancer() { return st.calc ? st.calc.lignes.filter(function (s) { return s.etat === 'due' || s.etat === 'appeler'; }) : []; }
  function chauds() { return st.calc ? st.calc.lignes.filter(function (s) { return s.etat !== 'ecarte' && s.score >= SEUIL_CHAUD; }) : []; }

  // ── Le mail de relance ──────────────────────────────────────────
  // Même facture que les mails tout prêts de Will (parties entre filets, puces courtes).
  // Règles de prospection : on parle d'Intégral Pharma et de l'officine, jamais des
  // autres grossistes ; « sans engagement » et « sans franco » toujours écrits ;
  // aucun montant ni taux de condition commerciale ; Offilog = « des produits à
  // l'unité, aux meilleurs prix ». Jamais « j'ai vu que vous avez ouvert le lien ».
  var FILET = '━━━━━━━━━━━━━━━━';
  function partie(titre) { return '\n\n' + FILET + '\n' + titre + '\n' + FILET + '\n\n'; }
  var ESSAI = '• sans engagement ;\n' +
    '• sans franco : aucun minimum de commande ;\n' +
    '• prix nets à la boîte, directement visibles sur facture ;\n' +
    '• froid compris, aucune exclusion de produit.\n\n' +
    'Vous comparez sur facture, puis vous décidez.';
  var ETAPES = '1. Vous m\'envoyez quelques références que vous commandez régulièrement : je vous retourne nos prix nets.\n' +
    '2. Si cela vous convient, l\'ouverture du compte est rapide : le document d\'ouverture, un RIB et un extrait Kbis.\n' +
    '3. Vous passez votre première commande via PharmaML, directement depuis votre LGO.';
  var PIECES = '• le document d\'ouverture, complété et signé ;\n• un RIB ;\n• un extrait Kbis.';
  function signature() { return V2.todo && V2.todo.signature ? V2.todo.signature() : '\n\nBien cordialement,\n\n' + ((V2.user && V2.user.name) || '') + '\nIntégral Pharma'; }
  function accesOffilog() { var r = (V2.todo && V2.todo.reglagesMail) ? V2.todo.reglagesMail() : {}; return { id: r.offilogId || '[identifiant]', mdp: r.offilogMdp || '[mot de passe]' }; }

  function mailRelance(s, lien) {
    var n = s.relances.length + 1, o = s.origine.t, quand = dateFr(String(s.dernierMail).slice(0, 10));
    var vu = o === 'merci' || o === 'docs' || !!s.rdvPris, compte = o === 'compte';
    var ouvre = 'Bonjour,\n\n', objet, corps;
    if (n >= 3) {
      objet = compte ? 'Votre ouverture de compte Intégral Pharma' : 'Intégral Pharma – je reste à votre disposition';
      corps = ouvre + 'Je ne souhaite pas vous encombrer : c\'est mon dernier message à ce sujet.\n\n' +
        'Si le moment n\'est pas le bon, je le comprends tout à fait. Je repasserai vous voir lors d\'une prochaine tournée.\n\n' +
        (compte ? 'Et si vous souhaitez ouvrir votre compte, il me suffit des trois documents habituels ; je peux aussi passer les récupérer à la pharmacie.'
                : 'Et si vous souhaitez faire un essai, un simple « oui » en réponse à ce mail suffit : sans engagement, sans franco, je m\'occupe du reste.');
    } else if (compte) {
      objet = n === 1 ? 'Votre ouverture de compte Intégral Pharma' : 'Ouverture de compte – je peux passer récupérer les documents';
      corps = ouvre + (n === 1
        ? 'Je reviens vers vous au sujet de l\'ouverture de votre compte' + (quand ? ', suite à mon mail du ' + quand : '') + '. Avez-vous pu réunir les documents ?\n\n' +
          'Pour rappel, il suffit de me retourner :\n\n' + PIECES + '\n\n' +
          'Dès réception, je lance la création de votre compte : vous pourrez passer une première commande d\'essai, sans engagement et sans franco.\n\n' +
          'Si un point vous retient, dites-le-moi : nous en parlons quand cela vous arrange.'
        : 'Je me permets un rappel au sujet de l\'ouverture de votre compte.\n\n' +
          'Si c\'est plus simple pour vous, je peux passer récupérer les documents à la pharmacie lors de ma prochaine tournée. Il me faut :\n\n' + PIECES + '\n\n' +
          'Votre première commande d\'essai reste sans engagement et sans franco.');
    } else if (n === 1) {
      objet = vu ? 'Suite à notre échange – et si nous faisions un premier essai ?'
        : o === 'rdv' ? 'Suite à mon passage à la pharmacie – un premier essai ?' : 'Intégral Pharma – et si nous faisions un premier essai ?';
      corps = ouvre +
        (vu ? 'Je reviens vers vous suite à ' + (o === 'docs' ? 'mon mail du ' + quand + ' et aux documents que je vous avais transmis' : 'notre rendez-vous' + (quand ? ' et à mon mail du ' + quand : '')) +
              '. Avez-vous eu le temps de les consulter ?\n\nLe meilleur moyen de vous faire une idée concrète : une première commande d\'essai, sur quelques références de votre choix.'
            : 'Je me permets de revenir vers vous' + (quand ? ' suite à mon mail du ' + quand : '') + (o === 'rdv' ? ', après mon passage à la pharmacie' : '') + '.\n\n' +
              'Je vous propose toujours un moment d\'échange, à la date qui vous convient. Et si vous préférez juger sur pièces, le plus simple est encore d\'essayer.') +
        partie('UN PREMIER ESSAI, SANS RISQUE') + ESSAI +
        partie('CONCRÈTEMENT') + ETAPES +
        (!vu && lien ? '\n\nPour choisir un créneau de rendez-vous :\n👉 ' + lien : '') +
        '\n\nJe peux aussi vous appeler quelques minutes, au moment qui vous arrange.';
    } else {
      var a = accesOffilog();
      objet = 'Une première commande d\'essai, sans engagement';
      corps = ouvre + 'Je me permets un rappel suite à mes précédents messages.\n\n' +
        'Pour vous faire un avis sans y passer de temps : notre plateforme Offilog, des produits à l\'unité, aux meilleurs prix. Vous pouvez la consulter avant toute création de compte :\n\n' +
        '👉 https://offilog.fr/\nIdentifiant : ' + a.id + '\nMot de passe : ' + a.mdp +
        partie('ET POUR LE CATALOGUE GROSSISTE') +
        'L\'essai reste ouvert : sans engagement, sans franco, prix nets à la boîte sur facture.\n\n' +
        'Un simple « oui » en réponse à ce mail suffit : je vous prépare une sélection de références pour votre officine, et je m\'occupe du reste.';
    }
    return { objet: objet, corps: corps + signature() };
  }

  // ── Gestes ──────────────────────────────────────────────────────
  function lienRdv() {
    if (!(V2.rdvLien && V2.rdvLien.charger)) return Promise.resolve('');
    return Promise.resolve(V2.rdvLien.charger()).then(function (l) { return (l && l.actif !== false && V2.rdvLien.url) ? V2.rdvLien.url(l) : ''; }).catch(function () { return ''; });
  }
  function noter(cle, fn) {
    // seuls mes statuts ont changé : on reconstruit la liste sans relire les envois
    return ecrire(function (o) { fn(fiche(o, cle), o); return o; }).then(function () { if (st.E) construire(); rendre(); });
  }
  V2.relances = {
    calculer: calculer,
    nbARelancer: function () { return st.calc ? aRelancer().length : null; },
    nbChauds: function () { return st.calc ? chauds().length : null; },
    // Exposé pour la sonde : le texte exact que propose la fenêtre.
    texte: function (id, lien) { var s = parId(id); return s ? mailRelance(s, lien || '') : null; },

    preparer: function (id) {
      var s = parId(id); if (!s || !(V2.todo && V2.todo.composerMail)) return;
      lienRdv().then(function (lien) {
        var m = mailRelance(s, lien), n = s.relances.length + 1;
        V2.todo.composerMail({ pid: s.pid, nom: s.nom + ' · relance ' + n, dest: s.mail || '', objet: m.objet, corps: m.corps, docs: [], base: '',
          surEnvoi: function (c) {
            // Sans pièce jointe, le mail est parti vers la messagerie : on referme pour montrer la liste à jour.
            // Avec pièces jointes, la fenêtre « Transmettre » prend le relais par-dessus : on n'y touche pas.
            if (!(c && c.docs && c.docs.length) && V2.todo.fermerComp) setTimeout(V2.todo.fermerComp, 0);
            noter(s.cleStore, function (f) { f.r.push(new Date().toISOString()); if (f.st === 'repondu') f.st = ''; })
              .then(function () { if (V2.toast) V2.toast('Relance notée : ' + s.nom); });
          } });
      });
    },
    annuler: function (id) {
      var s = parId(id); if (!s || !s.relances.length) return;
      var der = s.relances[s.relances.length - 1];
      noter(s.cleStore, function (f) { f.r = f.r.filter(function (x) { return x !== der; }); });
    },
    statut: function (id, v) {
      var s = parId(id); if (!s) return;
      noter(s.cleStore, function (f) { f.st = f.st === v ? '' : v; });
    },
    voirEcartes: function () { st.voirEcartes = !st.voirEcartes; rendre(); },
    // À l'ouverture d'un onglet : la to do list a pu bouger (ligne ajoutée, cochée) → on reconstruit ;
    // et au-delà de 5 minutes, on relit aussi les envois (app laissée ouverte dans Safari).
    rafraichir: function () {
      if (st.calc && Date.now() - st.calc.quand > 5 * 60000) { st.calc = null; return; }
      if (st.E && st.store) construire();
    },
    actualiser: function () { st.calc = null; rendre(); },

    // Ajout à la main : des adresses collées (une ou plusieurs) ou un nom par ligne.
    ajouter: function () {
      var ta = document.getElementById('v2-rl-colle'), dt = document.getElementById('v2-rl-date');
      var txt = (ta && ta.value || '').trim(), d = (dt && dt.value) || new Date().toISOString().slice(0, 10);
      if (!txt) { if (V2.toast) V2.toast('Collez au moins une adresse e-mail ou un nom d\'officine', 'warn'); return; }
      var I = index(), ajouts = [];
      txt.split(/\n+/).forEach(function (ligne) {
        var ms = mailsDans(ligne);
        if (ms.length) ms.forEach(function (m) { ajouts.push({ mail: m, pid: sur(I.parMail[m]), nom: '' }); });
        else if (ligne.trim()) ajouts.push({ mail: '', pid: '', nom: ligne.trim().slice(0, 120) });
      });
      var clientes = ajouts.filter(function (a) { return estCliente(I, a.pid); }).length;
      ecrire(function (o) {
        ajouts.forEach(function (a) {
          if (estCliente(I, a.pid)) return;
          var cle = a.pid || (a.mail ? 'm:' + a.mail : 'n:' + a.nom.toLowerCase().replace(/\s+/g, ' '));
          var f = fiche(o, cle);
          f.aj = { nom: a.nom, mail: a.mail, pid: a.pid, d: d };
        });
        return o;
      }).then(function () {
        if (ta) ta.value = '';
        if (V2.toast) V2.toast((ajouts.length - clientes) + ' officine' + (ajouts.length - clientes > 1 ? 's ajoutées' : ' ajoutée') + ' au suivi' +
          (clientes ? ' · ' + clientes + ' déjà cliente' + (clientes > 1 ? 's' : '') + ', laissée' + (clientes > 1 ? 's' : '') + ' de côté' : ''));
        if (st.E) construire(); rendre();
      });
    },

    // ── Les deux vues de la to do list ──
    html: function (vue) {
      ensureCss();
      if (!st.calc) {
        calculer().then(rendre, function () { st.erreur = true; rendre(); });
        return '<div class="v2-card v2-todo-empty">' + (st.erreur ? 'Le suivi n\'a pas pu être calculé. <button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.relances.actualiser()">Réessayer</button>' : 'Je rassemble vos envois…') + '</div>';
      }
      st.erreur = false;
      var C = st.calc, intro, liste, vide, nE = 0;
      if (vue === 'chauds') {
        liste = chauds().sort(function (a, b) { return b.score - a.score || String(b.dernier).localeCompare(String(a.dernier)); });
        intro = '<div class="v2-rl-intro"><p>Les prospects qui ont montré de l\'intérêt : rendez-vous pris ou fait, lien ouvert, formulaire d\'ouverture envoyé, réponse reçue. C\'est le moment de les pousser à tester.</p></div>';
        vide = 'Aucun prospect chaud pour l\'instant. Marquez « Chaud » un prospect de l\'onglet À relancer pour le retrouver ici.';
      } else {
        var actifs = C.lignes.filter(function (s) { return s.etat !== 'ecarte'; });
        var ord = { due: 0, appeler: 1, attente: 2, repondu: 3 };
        liste = (st.voirEcartes ? C.lignes.filter(function (s) { return s.etat === 'ecarte'; }) : actifs)
          .sort(function (a, b) { return (ord[a.etat] || 0) - (ord[b.etat] || 0) || a.dans - b.dans || String(a.nom).localeCompare(String(b.nom)); });
        var nD = aRelancer().length;
        nE = C.lignes.length - actifs.length;
        intro = '<div class="v2-rl-intro"><p>Toutes les pharmacies prospects à qui vous avez écrit depuis JARVIS, qui ne sont pas clientes. Première relance 7 jours après le mail, puis 10, puis 14 jours.</p>' +
          '<div class="v2-rl-kpis"><span><b>' + nD + '</b> à relancer maintenant</span><span><b>' + actifs.length + '</b> suivie' + (actifs.length > 1 ? 's' : '') + '</span>' +
            (C.clientes ? '<span><b>' + C.clientes + '</b> devenue' + (C.clientes > 1 ? 's' : '') + ' cliente' + (C.clientes > 1 ? 's' : '') + ', retirée' + (C.clientes > 1 ? 's' : '') + '</span>' : '') + '</div></div>';
        vide = st.voirEcartes ? 'Aucune officine écartée.' : 'Aucun envoi à un prospect trouvé pour l\'instant. Les mails préparés depuis JARVIS apparaîtront ici ; ceux écrits ailleurs s\'ajoutent ci-dessous.';
      }
      var ko = st.ko.length ? '<div class="v2-rl-ko">Certains envois n\'ont pas pu être relus (' + esc(st.ko.join(', ')) + ') : la liste peut être incomplète. <button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.relances.actualiser()">Relire</button></div>' : '';
      return intro + ko +
        (liste.length ? '<div class="v2-card v2-todo-list">' + liste.map(function (s) { return ligne(s, vue); }).join('') + '</div>' : '<div class="v2-card v2-todo-empty">' + vide + '</div>') +
        (vue === 'chauds' ? '' :
          (nE || st.voirEcartes ? '<div class="v2-rl-bas"><button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.relances.voirEcartes()">' + (st.voirEcartes ? 'Revenir au suivi' : 'Voir les officines écartées · ' + nE) + '</button></div>' : '') +
          ajoutHtml());
    }
  };

  function badge(s) {
    if (s.etat === 'ecarte') return { c: 'var(--muted)', t: 'Écartée' };
    if (s.etat === 'repondu') return { c: 'var(--c-mint)', t: 'A répondu' };
    if (s.etat === 'appeler') return { c: 'var(--c-rose)', t: s.relances.length + ' relances sans réponse · un appel ?' };
    if (s.etat === 'due') return { c: 'var(--c-amber)', t: s.relances.length ? 'Relance ' + (s.relances.length + 1) + ' à faire' : 'À relancer' };
    return { c: 'var(--muted)', t: 'Prochaine relance ' + (s.dans === 1 ? 'demain' : 'dans ' + s.dans + ' j') };
  }
  function ligne(s, vue) {
    var b = badge(s), id = s.id;
    var nom = s.pid ? '<a class="v2-todo-off" onclick="V2.go(\'pharma\',\'' + esc(s.pid) + '\')">' + esc(s.nom) + '</a>' : '<span class="v2-todo-off v2-rl-libre">' + esc(s.nom) + '</span>';
    var lieu = [s.ville, s.grp].filter(Boolean).join(' · ');
    var hist = ORIGINES[s.origine.t].l + ' · ' + dateFr(String(s.origine.d).slice(0, 10)) +
      (s.contacts.length > 1 ? ' · ' + s.contacts.length + ' envois' : '') +
      (s.origine.pasCoche ? ' (ligne de la to do list pas cochée : le mail est-il parti ?)' : '') +
      (s.relances.length ? ' · relancée ' + s.relances.length + ' fois, la dernière le ' + dateFr(s.relances[s.relances.length - 1].slice(0, 10)) : ' · pas encore relancée');
    var tel = String(s.tel || '').replace(/[^0-9+]/g, '');
    var auj0 = new Date().toISOString().slice(0, 10), relAuj = s.relances.length && s.relances[s.relances.length - 1].slice(0, 10) === auj0;
    var sig = (vue === 'chauds' ? s.signaux : s.signaux.filter(function (x) { return x.t !== 'Contact récent'; }))
      .map(function (x) { return '<span class="v2-rl-sig">' + esc(x.t) + '</span>'; }).join('');
    var actes = s.etat === 'ecarte'
      ? '<button class="v2-btn v2-btn-ghost v2-todo-sm" onclick="V2.relances.statut(\'' + id + '\',\'non\')">Remettre dans le suivi</button>'
      : '<button class="v2-btn ' + (s.etat === 'attente' || s.etat === 'repondu' ? 'v2-btn-ghost' : 'v2-btn-primary') + ' v2-todo-sm" onclick="V2.relances.preparer(\'' + id + '\')">' + ICO('fiche', 14, 2) + 'Préparer la relance' + (s.relances.length ? ' ' + (s.relances.length + 1) : '') + '</button>' +
        (tel ? '<a class="v2-btn v2-btn-ghost v2-todo-sm" href="tel:' + esc(tel) + '">Appeler</a>' : '') +
        (relAuj ? '<button class="v2-btn v2-btn-ghost v2-todo-sm v2-rl-annul" onclick="V2.relances.annuler(\'' + id + '\')">Annuler la relance du jour</button>' : '');
    // Les trois statuts tiennent sur une ligne, sous les deux gestes principaux.
    var statuts = s.etat === 'ecarte' ? '' : '<div class="v2-rl-sts" role="group" aria-label="Où en est cette officine">' +
        '<button class="' + (s.st === 'chaud' ? 'is-on' : '') + '" aria-pressed="' + (s.st === 'chaud') + '" onclick="V2.relances.statut(\'' + id + '\',\'chaud\')">' + ICO('spark', 13, 2) + 'Chaud</button>' +
        '<button class="' + (s.st === 'repondu' ? 'is-on' : '') + '" aria-pressed="' + (s.st === 'repondu') + '" onclick="V2.relances.statut(\'' + id + '\',\'repondu\')">' + ICO('check', 13, 2) + 'A répondu</button>' +
        '<button onclick="V2.relances.statut(\'' + id + '\',\'non\')">Pas intéressée</button></div>';
    return '<div class="v2-todo-it v2-rl-it" data-rl="' + id + '">' +
      '<span class="v2-todo-ico v2-rl-ico' + (s.score >= SEUIL_CHAUD && s.etat !== 'ecarte' ? ' is-chaud' : '') + '">' + ICO(s.score >= SEUIL_CHAUD ? 'spark' : 'cal', 16, 2) + '</span>' +
      '<div class="v2-todo-c">' +
        '<div class="v2-todo-l1">' + nom + (lieu ? '<span class="v2-rl-lieu">' + esc(lieu) + '</span>' : '') +
          '<span class="v2-todo-b" style="color:' + b.c + '">' + esc(b.t) + '</span></div>' +
        '<div class="v2-rl-hist">' + esc(hist) + (s.mail ? '' : ' · <b>aucune adresse e-mail connue</b>') + '</div>' +
        (s.notes.length ? '<div class="v2-todo-n">' + esc(s.notes.join(' · ')) + '</div>' : '') +
        (sig ? '<div class="v2-rl-sigs">' + sig + '</div>' : '') +
        '<div class="v2-todo-acts">' + actes + '</div>' + statuts +
      '</div></div>';
  }
  function ajoutHtml() {
    return '<details class="v2-card v2-rl-add"><summary><span class="v2-todo-ico">' + ICO('plus', 16, 2) + '</span><span class="v2-todo-mt"><b>Ajouter des pharmacies déjà contactées</b>' +
      '<small>Pour les mails écrits hors de JARVIS : JARVIS ne lit pas votre boîte mail.</small></span><span class="v2-todo-chev">' + ICO('chev', 16, 2) + '</span></summary>' +
      '<div class="v2-rl-add-b"><label><span>Adresses e-mail ou noms d\'officine</span><textarea id="v2-rl-colle" rows="4" placeholder="Collez une ou plusieurs adresses (même tout un bloc de destinataires), ou un nom d\'officine par ligne"></textarea></label>' +
      '<div class="v2-rl-add-f"><label><span>Date du mail</span><input id="v2-rl-date" type="date" value="' + new Date().toISOString().slice(0, 10) + '"></label>' +
      '<button class="v2-btn v2-btn-primary" onclick="V2.relances.ajouter()">' + ICO('plus', 15, 2) + 'Ajouter au suivi</button></div>' +
      '<p class="v2-todo-hint">Une adresse connue de JARVIS est rattachée à sa fiche ; une cliente est laissée de côté.</p></div></details>';
  }

  function ensureCss() {
    if (document.getElementById('v2-rl-css')) return;
    var s = document.createElement('style'); s.id = 'v2-rl-css';
    s.textContent = [
      '.v2-rl-intro{margin:0 0 14px}',
      '.v2-rl-intro p{margin:0;font-size:13.5px;color:var(--ip-ink-2);line-height:1.5;max-width:64ch}',
      '.v2-rl-kpis{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
      '.v2-rl-kpis span{padding:6px 12px;border-radius:999px;background:var(--surf-sunken,#F4F6FA);border:1px solid var(--line);font-size:12.5px;color:var(--ip-ink-2)}',
      '.v2-rl-kpis b{color:var(--ip-ink);font-weight:800}',
      '.v2-rl-ko{margin:0 0 12px;padding:10px 14px;border:1px dashed var(--c-amber);border-radius:12px;font-size:13px;color:var(--ip-ink);display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      '.v2-rl-ico{margin-top:-2px}',
      '.v2-rl-ico.is-chaud{background:#FFF3E0;color:#B45309}',
      '.v2-rl-libre{color:var(--ip-ink);cursor:default}',
      '.v2-rl-lieu{font-size:12.5px;color:var(--ip-ink-2)}',
      '.v2-rl-hist{font-size:13px;color:var(--ip-ink-2);line-height:1.45}',
      '.v2-rl-hist b{color:var(--c-rose);font-weight:700}',
      '.v2-rl-sigs{display:flex;flex-wrap:wrap;gap:6px}',
      '.v2-rl-sig{padding:3px 10px;border-radius:999px;background:#FFF3E0;color:#8A3B00;font-size:12px;font-weight:700}',
      '.v2-rl-it a.v2-btn{text-decoration:none}',
      '.v2-rl-sts{display:flex;flex-wrap:wrap;gap:6px}',
      '.v2-rl-sts button{display:inline-flex;align-items:center;gap:5px;min-height:36px;padding:4px 12px;border:1px solid var(--line);border-radius:999px;background:var(--card,#fff);font:inherit;font-size:12.5px;font-weight:700;color:var(--ip-ink-2);cursor:pointer}',
      '.v2-rl-sts button.is-on{background:#FFF3E0;border-color:#E8A15A;color:#8A3B00}',
      '.v2-rl-sts button:focus-visible{outline:none;box-shadow:0 0 0 3px var(--halo,#E9F0FF)}',
      '@media(max-width:640px){.v2-rl-sts button{min-height:44px}}',
      '.v2-rl-annul{color:var(--ip-ink-2)}',
      '.v2-rl-bas{margin:12px 0 0}',
      '.v2-rl-add{margin-top:16px;padding:0}',
      '.v2-rl-add summary{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 18px;cursor:pointer;list-style:none}',
      '.v2-rl-add summary::-webkit-details-marker{display:none}',
      '.v2-rl-add[open] .v2-todo-chev{transform:rotate(90deg)}',
      '.v2-rl-add-b{padding:0 18px 16px;display:flex;flex-direction:column;gap:10px}',
      '.v2-rl-add-b label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--ip-ink-2)}',
      '.v2-rl-add-b textarea,.v2-rl-add-b input{min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:16px;font-weight:400;background:#fff;color:var(--ip-ink);width:100%;box-sizing:border-box}',
      '.v2-rl-add-b textarea{line-height:1.5;resize:vertical}',
      '.v2-rl-add-b textarea:focus,.v2-rl-add-b input:focus{outline:none;border-color:var(--ip-blue);box-shadow:0 0 0 3px var(--halo,#E9F0FF)}',
      '.v2-rl-add-f{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}',
      '.v2-rl-add-f label{flex:0 1 200px}',
      '.v2-rl-add-f .v2-btn{min-height:44px}',
      '@media (max-width:640px){.v2-rl-it{gap:10px}.v2-rl-ico{display:none}.v2-rl-add-f label{flex:1 1 100%}}'
    ].join('\n');
    document.head.appendChild(s);
  }
})();
