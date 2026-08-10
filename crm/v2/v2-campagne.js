/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Campagne de prise de RDV (pages.campagne)
   Trois étapes : le motif, la liste, puis la file d'attente d'envoi.
   Chaque mail part de la boîte du commercial : JARVIS le prépare, il
   relit et il envoie. C'est lui qui coche « envoyé » — JARVIS ne peut
   pas le savoir, et il vaut mieux le dire que le supposer.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };
  var ICO = window.ICO || function () { return ''; };

  var ETAT = { modele: 'routine', texte: '', file: [], i: 0, envoyes: 0, passes: 0 };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function root() { return document.getElementById('v2-root'); }

  function ensureCss() {
    if (document.getElementById('v2-camp-css')) return;
    var s = document.createElement('style'); s.id = 'v2-camp-css';
    s.textContent = [
      '.v2-camp-hero{margin:8px 0 18px}',
      '.v2-camp-hero h1{font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.v2-camp-hero p{color:var(--muted);font-size:14px;max-width:56ch;margin:0;line-height:1.5}',
      '.v2-camp-sec{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:24px 0 10px}',
      '.v2-camp-box{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:14px;margin-bottom:10px}',
      '.v2-camp-box label{display:block;font-weight:700;font-size:13px;margin:0 0 6px}',
      '.v2-camp-box label + p{color:var(--muted);font-size:12.5px;margin:-4px 0 8px}',
      '.v2-camp-box select,.v2-camp-box textarea,.v2-camp-box input{width:100%;font:inherit;font-size:16px;',
      '  min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;',
      '  background:var(--card-2);color:var(--ip-ink)}',
      '.v2-camp-box input.court{width:110px}',
      '.v2-camp-duo{display:flex;flex-wrap:wrap;gap:16px}',
      '.v2-camp-cpt{font-size:15px;font-weight:800;margin:0 0 4px}',
      '.v2-camp-barre{height:6px;background:var(--card-2);border:1px solid var(--line);border-radius:99px;overflow:hidden;margin:8px 0 16px}',
      '.v2-camp-barre i{display:block;height:100%;background:var(--ip-blue)}',
      '.v2-camp-cible{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:16px;margin-bottom:14px}',
      '.v2-camp-cible b{display:block;font-size:17px;letter-spacing:-.01em}',
      '.v2-camp-cible span{color:var(--muted);font-size:13.5px}',
      '.v2-camp-acts{display:flex;flex-wrap:wrap;gap:10px}',
      '.v2-camp-acts .v2-btn{min-height:48px}',
      '.v2-camp-note{color:var(--muted);font-size:13px;margin:14px 0 0;line-height:1.5}'
    ].join('');
    document.head.appendChild(s);
  }

  // Officines du commercial. Le CIP est l'id : c'est la clé de jointure avec
  // CLIENTS (e-mail, adresse) et avec la liste d'opposition.
  function candidates(opts, opposes) {
    var clients = window.CLIENTS || [];
    var mails = {};
    clients.forEach(function (c) { if (c.email) mails[String(c.cip)] = c.email; });
    return (V2.pharmacies || []).filter(function (p) {
      var cip = String(p.id);
      if (!mails[cip]) return false;                       // filtre obligatoire
      if (opposes.indexOf(cip) !== -1) return false;       // ne plus solliciter
      if (opts.dept && String(p.cp || '').slice(0, 2) !== opts.dept) return false;
      if (opts.caMax && (V2.rdvCA(cip) || 0) > opts.caMax) return false;
      return true;
    }).map(function (p) {
      return { cip: String(p.id), nom: p.name, ville: p.ville || '', email: mails[String(p.id)] };
    });
  }

  V2.campagne = {
    lancer: function () {
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi pour lancer une campagne.'); return; }
      ETAT.modele = val('cp-modele') || 'routine';
      ETAT.texte = val('cp-texte');
      if (ETAT.modele === 'offre' && window.V2MOD.texteRefuse(ETAT.texte)) {
        V2.toast('Retire le pourcentage : les conditions commerciales ne s’écrivent pas dans un mail.');
        return;
      }
      var opts = {
        dept: (val('cp-dept') || '').trim(),
        caMax: parseInt(val('cp-camax'), 10) || 0
      };
      var pret = window.CLIENTS ? Promise.resolve() : V2.loadFiles(['clients']);
      Promise.resolve(pret).then(function () {
        return c.from('rdv_opposition').select('cip').eq('user_id', u);
      }).then(function (r) {
        var opposes = ((r && r.data) || []).map(function (x) { return String(x.cip); });
        ETAT.file = candidates(opts, opposes);
        ETAT.i = 0; ETAT.envoyes = 0; ETAT.passes = 0;
        if (!ETAT.file.length) { V2.toast('Aucune officine ne correspond à ces filtres.'); return; }
        V2.campagne.afficherFile();
      }).catch(function () { V2.toast('Préparation de la liste impossible.'); });
    },

    afficherFile: function () {
      var r = root(); if (!r) return;
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';
      if (ETAT.i >= ETAT.file.length) {
        r.innerHTML = top + '<div class="v2-wrap narrow"><div class="v2-camp-hero">' +
          '<h1>Campagne terminée</h1><p><b>' + ETAT.envoyes + '</b> mail(s) envoyé(s) sur ' +
          ETAT.file.length + (ETAT.passes ? ' · ' + ETAT.passes + ' passée(s)' : '') + '.</p></div>' +
          '<div class="v2-camp-acts">' +
            '<button class="v2-btn v2-btn-primary" onclick="V2.go(\'rdv\')">Voir mes rendez-vous</button>' +
            '<button class="v2-btn" onclick="V2.go(\'campagne\')">Nouvelle campagne</button>' +
          '</div></div>';
        return;
      }
      var o = ETAT.file[ETAT.i];
      var pct = Math.round(ETAT.i / ETAT.file.length * 100);
      r.innerHTML = top + '<div class="v2-wrap narrow">' +
        '<p class="v2-camp-cpt">' + (ETAT.i + 1) + ' sur ' + ETAT.file.length + '</p>' +
        '<div class="v2-camp-barre"><i style="width:' + pct + '%"></i></div>' +
        '<div class="v2-camp-cible"><b>' + esc(o.nom) + '</b>' +
          '<span>' + esc(o.ville) + (o.ville ? ' · ' : '') + esc(o.email) + '</span></div>' +
        '<div class="v2-camp-acts">' +
          '<button class="v2-btn v2-btn-primary" id="cp-ouvrir" onclick="V2.campagne.ouvrir()">Ouvrir le mail</button>' +
          '<button class="v2-btn" onclick="V2.campagne.passer()">Passer</button>' +
        '</div>' +
        '<div class="v2-camp-acts" id="cp-apres" style="display:none;margin-top:12px">' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.campagne.marquerEnvoye()">Envoyé ' +
            ICO('check', 15) + ' → suivant</button>' +
        '</div>' +
        '<p class="v2-camp-note">Ta messagerie s’ouvre avec le mail prêt. Relis, envoie, reviens ici. ' +
          'JARVIS ne peut pas savoir si le mail est vraiment parti — c’est toi qui coches.</p>' +
      '</div>';
    },

    ouvrir: function () {
      var o = ETAT.file[ETAT.i];
      var b = document.getElementById('cp-ouvrir');
      if (b) { b.disabled = true; b.textContent = 'Préparation…'; }
      V2.rdv.preparerMail(o.cip, ETAT.modele, ETAT.texte, function (ok) {
        if (b) { b.disabled = false; b.textContent = 'Ouvrir le mail'; }
        if (!ok) return;
        var e = document.getElementById('cp-apres');
        if (e) e.style.display = '';
      });
    },

    marquerEnvoye: function () { ETAT.envoyes++; ETAT.i++; V2.campagne.afficherFile(); },
    passer: function () { ETAT.passes++; ETAT.i++; V2.campagne.afficherFile(); }
  };

  V2.pages.campagne = {
    render: function (r) {
      ensureCss();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';
      var mods = window.V2MOD.liste().map(function (m) {
        return '<option value="' + esc(m.cle) + '">' + esc(m.nom) + '</option>';
      }).join('');
      r.innerHTML = top + '<div class="v2-wrap narrow">' +
        '<div class="v2-camp-hero"><h1>Campagne de rendez-vous</h1>' +
          '<p>Le mail part de ta boîte, signé de ton nom. Tu relis, tu envoies. ' +
          'Compte 20 à 40 officines dans une session.</p></div>' +

        '<div class="v2-camp-sec">Le motif</div>' +
        '<div class="v2-camp-box">' +
          '<label for="cp-modele">Pourquoi tu leur écris</label>' +
          '<select id="cp-modele">' + mods + '</select>' +
          '<label for="cp-texte" style="margin-top:14px">Ton texte (modèle « nouveauté » uniquement)</label>' +
          '<p>Deux lignes, réutilisées pour toute la liste. Aucun pourcentage : ' +
            'les conditions commerciales ne s’écrivent pas dans un mail.</p>' +
          '<textarea id="cp-texte" rows="2" placeholder="Ex. La gamme diabète arrive en septembre."></textarea>' +
        '</div>' +

        '<div class="v2-camp-sec">La liste</div>' +
        '<div class="v2-camp-box"><div class="v2-camp-duo">' +
          '<div><label for="cp-dept">Département</label>' +
            '<input id="cp-dept" class="court" inputmode="numeric" maxlength="2" placeholder="tous" /></div>' +
          '<div><label for="cp-camax">CA maximum (€)</label>' +
            '<input id="cp-camax" class="court" type="number" min="0" step="1000" placeholder="aucun" /></div>' +
        '</div></div>' +

        '<div class="v2-camp-acts">' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.campagne.lancer()">Préparer la liste</button>' +
        '</div>' +
        '<p class="v2-camp-note">Les officines sans adresse mail et celles marquées ' +
          '« ne plus solliciter » sont écartées automatiquement.</p>' +
      '</div>';
    }
  };
})();
