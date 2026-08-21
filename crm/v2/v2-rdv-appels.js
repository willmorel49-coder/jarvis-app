/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Qui appeler (pages.rdvappels)

   POURQUOI CET ÉCRAN EXISTE, mesuré le 20/08/2026 et pas supposé :
   sur les 2 416 officines des 12 départements du secteur, **1 514 n'ont
   aucune adresse mail** — et **1 380 d'entre elles (91 %) ont un
   téléphone**. Elles étaient écartées de tout le module (campagne, envoi
   groupé, radar « Qui inviter »). Pas parce qu'on ne peut pas les joindre :
   parce que le module ne savait faire que du mail.

   Chercher les adresses manquantes en rend environ 150, au prix de beaucoup
   de lecture de sites web — OpenStreetMap ne couvre que ~6 % de ces
   départements, et il n'existe aucune source publique gratuite d'e-mails
   d'officines (vérifié sur data.gouv.fr). Leur ouvrir le téléphone en rend
   1 380. C'est le même travail, sur l'autre canal.

   ── CE QUI EST REPRIS À L'IDENTIQUE DU RADAR ──────────────────────
   Le classement, les raisons écrites, les prudences sur la date de visite,
   la période de comparaison des achats. Une officine sans adresse mail n'est
   pas moins urgente qu'une autre : seul le canal change. C'est pour ça que
   les deux listes sortent du MÊME calcul (V2.rdvRadar.calculer) et non d'un
   second moteur qui aurait dérivé au premier changement.

   ── CE QUE CET ÉCRAN N'EST PAS ────────────────────────────────────
   Un journal d'appels. On enregistre CE QUE L'APPEL A DONNÉ, en un mot, et
   rien d'autre : ni durée, ni compte rendu, ni qui a décroché. Ce qui s'est
   dit se note dans les notes de l'officine, là où l'équipe le lit déjà.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  // ⚠️ UN BOUTON QUI NE COMPOSE PAS EST PIRE QU'AUCUN BOUTON.
  // Vu à l'écran le 21/08 : « Appeler 241887551 » — neuf chiffres, le zéro
  // initial perdu quelque part entre le fichier clients et ici. Un pharmacien
  // ne décroche pas, et le commercial croit qu'il ne répond pas.
  // On remet la forme française : 0X XX XX XX XX.
  function telBrut(v) {
    var t = String(v || '').replace(/[^0-9+]/g, '');
    if (t.indexOf('+33') === 0) t = '0' + t.slice(3);
    else if (t.indexOf('0033') === 0) t = '0' + t.slice(4);
    // Neuf chiffres commençant par un indicatif valide : le zéro manque.
    if (/^[1-9][0-9]{8}$/.test(t)) t = '0' + t;
    return t;
  }
  // Lisible à l'œil, et surtout relisible AU TÉLÉPHONE quand on le dicte.
  function telLisible(v) {
    var t = telBrut(v);
    return /^0[0-9]{9}$/.test(t) ? t.replace(/(\d{2})(?=\d)/g, '$1 ').trim() : t;
  }

  // ⚠️ Valeur injectée DANS un onclick="…('ICI')" : elle traverse HTML puis
  // JavaScript. V2.esc seul ne suffit pas — il transforme ' en &#39;, que le
  // navigateur redécode AVANT que JS ne lise la chaîne, ce qui la referme.
  function escArg(s) {
    return esc(String(s == null ? '' : s).replace(/[\\'"<>&]/g, ''));
  }

  // Une journée d'appels, pas un annuaire. Vingt numéros, c'est déjà une
  // matinée au téléphone ; en afficher trois cents donnerait une liste qu'on
  // ferme sans en composer un seul.
  var PORTION = 20;

  var ETAT = { r: null, encours: {} };

  // ── Enregistrer ce que l'appel a donné ───────────────────────────
  V2.rdvAppels = {
    /**
     * @param cip   l'officine
     * @param issue 'rdv' | 'rappeler' | 'refus' | 'injoignable'
     */
    noter: function (cip, nom, issue) {
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi.'); return; }
      if (ETAT.encours[cip]) return;              // double tape sur mobile
      ETAT.encours[cip] = 1;

      // ⚠️ L'écran bouge tout de suite, l'enregistrement suit — même règle
      // que le secteur du jour. Un bouton qui reste mou pendant 200 ms se
      // reclique, et l'appel se noterait deux fois.
      retirerLigne(cip);

      c.from('rdv_appel').upsert(
        { user_id: u, cip: String(cip), issue: issue, appele_le: new Date().toISOString() },
        { onConflict: 'user_id,cip' }
      ).then(function (r) {
        delete ETAT.encours[cip];
        if (r && r.error) {
          V2.toast('Enregistrement impossible — l’appel n’est pas retenu.');
          V2.go('rdvappels');                     // on remontre la vérité
          return;
        }
        if (issue === 'refus') {
          // Un refus au téléphone vaut le STOP d'un mail : il s'adresse à la
          // maison, pas à la personne qui a appelé. Même fonction que
          // « ne plus solliciter » côté campagne.
          c.rpc('rdv_opposer', { p_cip: String(cip), p_motif: 'refus téléphone' })
            .then(function () {}, function () {});
          V2.toast((nom || 'Cette officine') + ' ne sera plus sollicitée, par personne dans l’équipe.');
        } else if (issue === 'rdv') {
          V2.toast('Note le rendez-vous pour qu’il bloque le créneau.');
        } else {
          V2.toast(issue === 'injoignable'
            ? 'Notée injoignable. Elle ne remontera pas avant trois semaines.'
            : 'À rappeler. Elle ne remontera pas avant trois semaines.');
        }
      }, function () {
        delete ETAT.encours[cip];
        V2.toast('Enregistrement impossible — l’appel n’est pas retenu.');
        V2.go('rdvappels');
      });
    },

    // Déplie les officines sans signal. Elles ne remontent pas d'elles-mêmes :
    // les afficher d'office noierait les cinq qui comptent.
    voirReste: function () {
      var z = document.getElementById('app-reste-liste');
      if (!z || !ETAT.r) return;
      if (z.innerHTML) { z.innerHTML = ''; return; }   // re-cliquer replie
      var lot = (ETAT.r.resteTel || []).slice(0, PORTION);
      z.innerHTML = '<div class="app-sec">' + lot.length + ' officines, par chiffre d’affaires</div>' +
        lot.map(function (o, i) { return ligne(o, i + 1); }).join('');
    },

    // « Il m'a donné un rendez-vous » : on note l'appel ET on ouvre l'écran
    // qui pose vraiment le créneau. Sans ce second geste, le rendez-vous
    // n'existerait nulle part et un pharmacien pourrait réserver par-dessus.
    rdvPris: function (cip, nom) {
      V2.rdvAppels.noter(cip, nom, 'rdv');
      // ⚠️ L'écran « Noter un rendez-vous » accepte déjà l'officine en
      // paramètre de route (`render(root, param)`) : inutile d'inventer une
      // variable globale de plus, elle aurait fini par diverger de celle que
      // la fiche officine utilise depuis toujours.
      setTimeout(function () { V2.go('rdvajout', String(cip)); }, 350);
    }
  };

  // Retire la ligne sans reconstruire l'écran : on est au téléphone, la page
  // ne doit pas sauter entre deux appels.
  function retirerLigne(cip) {
    var el = document.querySelector('.app-l[data-cip="' + String(cip).replace(/"/g, '') + '"]');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (ETAT.r && ETAT.r.appels) {
      ETAT.r.appels = ETAT.r.appels.filter(function (o) { return String(o.cip) !== String(cip); });
    }
    var z = document.getElementById('app-reste');
    if (z && ETAT.r) {
      var reste = ETAT.r.appels.length;
      z.textContent = reste
        ? reste + ' officine' + (reste > 1 ? 's' : '') + ' encore à appeler.'
        : 'Tu les as toutes passées. Reviens demain.';
    }
  }

  function css() {
    if (document.getElementById('v2-app-css')) return;
    var s = document.createElement('style'); s.id = 'v2-app-css';
    s.textContent = [
      '.app-hero{margin:8px 0 16px}',
      '.app-hero h1{font-size:clamp(24px,4vw,32px);font-weight:800;letter-spacing:-.03em;margin:0 0 6px}',
      '.app-hero p{color:var(--muted);font-size:14px;max-width:60ch;margin:0;line-height:1.55}',
      '.app-sec{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;',
      '  color:var(--muted);margin:22px 0 9px}',
      '.app-l{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);',
      '  padding:13px 14px;margin-bottom:9px}',
      '.app-n{display:block;font-size:15.5px;font-weight:700;letter-spacing:-.01em}',
      '.app-v{color:var(--muted);font-size:13px;margin:2px 0 0}',
      '.app-p{margin:7px 0 0;font-size:13.5px;line-height:1.5}',
      '.app-p span{display:block}',
      '.app-tag{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 7px;border-radius:6px;',
      '  background:var(--card-2);border:1px solid var(--line);color:var(--muted);margin-left:7px}',
      '.app-tel{display:inline-flex;align-items:center;justify-content:center;min-height:48px;',
      '  padding:0 18px;margin:11px 0 0;border-radius:11px;background:var(--ip-blue);color:#fff;',
      '  font-size:16px;font-weight:700;text-decoration:none;letter-spacing:.01em}',
      '.app-a{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}',
      '.app-a button{min-height:44px;padding:0 12px;border-radius:9px;border:1px solid var(--line);',
      '  background:var(--card-2);color:var(--fg);font:inherit;font-size:13px;font-weight:600;cursor:pointer}',
      '.app-a button.oui{border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.app-a button.non{border-color:#E0556E;color:#C7283D}',
      '.app-note{color:var(--muted);font-size:13px;line-height:1.55;margin:12px 0 0}',
      '.app-vide{color:var(--muted);font-size:14px;line-height:1.6;padding:16px 2px}'
    ].join('');
    document.head.appendChild(s);
  }

  function ligne(o, rang) {
    var tel = telBrut(o.tel);
    var n = String(o.nom || '').replace(/'/g, '');
    return '<div class="app-l" data-cip="' + escArg(o.cip) + '">' +
      '<span class="app-n">' + rang + '. ' + esc(o.nom) +
        (o.type === 'prospect' ? '<span class="app-tag">prospect</span>' : '') + '</span>' +
      '<p class="app-v">' + esc(o.ville) +
        (o.ca > 0 ? ' · ' + esc(V2.fmtEur ? V2.fmtEur(o.ca) : Math.round(o.ca) + ' €') +
          ' cette année' : '') + '</p>' +
      '<p class="app-p">' + o.raisons.map(function (t) {
        return '<span>· ' + esc(t) + '</span>';
      }).join('') + '</p>' +
      (tel ? '<a class="app-tel" href="tel:' + esc(tel) + '">Appeler ' +
             esc(telLisible(o.tel)) + '</a>' : '') +
      '<div class="app-a">' +
        '<button class="oui" onclick="V2.rdvAppels.rdvPris(\'' + escArg(o.cip) + '\',\'' + escArg(n) + '\')">' +
          'Rendez-vous pris</button>' +
        '<button onclick="V2.rdvAppels.noter(\'' + escArg(o.cip) + '\',\'' + escArg(n) + '\',\'rappeler\')">' +
          'À rappeler</button>' +
        '<button onclick="V2.rdvAppels.noter(\'' + escArg(o.cip) + '\',\'' + escArg(n) + '\',\'injoignable\')">' +
          'Personne</button>' +
        '<button class="non" onclick="V2.rdvAppels.noter(\'' + escArg(o.cip) + '\',\'' + escArg(n) + '\',\'refus\')">' +
          'Ne veut plus</button>' +
      '</div></div>';
  }

  // ── Celles qui n'ont AUCUN signal ────────────────────────────────
  // Mesuré le 21/08 : sur ~518 officines joignables au téléphone, 5 seulement
  // portaient un signal — les 513 autres sont des prospects sans achat, donc
  // sans chiffre, sans rupture et sans date de visite. Les écarter en silence
  // ferait passer une liste de 5 pour la couverture du secteur. On les compte,
  // on dit pourquoi elles n'ont pas de rang, et on les propose quand la liste
  // motivée est finie — c'est exactement là qu'elles servent.
  function resteTexte(r) {
    var n = (r.resteTel || []).length;
    if (!n) return '';
    return '<p class="app-note"><b>' + n + ' autre' + (n > 1 ? 's' : '') + ' officine' +
      (n > 1 ? 's' : '') + ' du secteur ' + (n > 1 ? 'ont' : 'a') + ' un téléphone ' +
      'mais aucun signal aujourd’hui</b> — ni retard de visite, ni baisse d’achats, ' +
      'ni rupture qu’on ait en stock. Ce sont surtout des prospects qui n’achètent ' +
      'rien chez nous : JARVIS n’a rien pour les classer, et il ne va pas inventer ' +
      'un ordre.</p>' +
      '<p style="margin:10px 0 0"><button class="v2-btn" style="min-height:44px" ' +
      'onclick="V2.rdvAppels.voirReste()">Les voir quand même (par chiffre d’affaires)</button></p>' +
      '<div id="app-reste-liste"></div>';
  }

  V2.pages.rdvappels = {
    render: function (root) {
      css();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';
      var hero = '<div class="app-hero"><h1>Qui appeler</h1>' +
        '<p>Les officines de ton secteur qui n’ont pas d’adresse mail mais ont un ' +
        'téléphone. Même classement que « Qui inviter » — seul le canal change. ' +
        'Chaque ligne dit pourquoi elle est là.</p></div>';

      root.innerHTML = top + '<div class="v2-wrap narrow">' + hero +
        '<p class="app-vide">Lecture de ton portefeuille…</p></div>';

      if (!V2.rdvRadar) {
        root.innerHTML = top + '<div class="v2-wrap narrow">' + hero +
          '<p class="app-vide">Indisponible sur cet écran.</p></div>';
        return;
      }

      V2.rdvRadar.calculer().then(function (r) {
        ETAT.r = r;
        var corps;
        if (r.sansCommercial) {
          corps = '<p class="app-vide">Ton compte n’est rattaché à aucun secteur. ' +
            'Sans ça, JARVIS ne sait pas quelles officines sont les tiennes.</p>';
        } else if (r.panne) {
          corps = '<p class="app-vide">Lecture impossible pour le moment. Réessaie dans un instant.</p>';
        } else if (!r.appels || !r.appels.length) {
          corps = '<p class="app-vide">Aucune officine ne porte de signal aujourd’hui. Soit elles ' +
            'ont toutes une adresse mail — et elles sont dans <a href="#" onclick="V2.go(\'rdvradar\');' +
            'return false">Qui inviter</a> — soit tu les as déjà eues ces trois dernières semaines.</p>' +
            resteTexte(r);
        } else {
          var lot = r.appels.slice(0, PORTION);
          corps = '<div class="app-sec">' + lot.length + ' appels, le plus urgent en haut</div>' +
            lot.map(function (o, i) { return ligne(o, i + 1); }).join('') +
            '<p class="app-note" id="app-reste">' + r.appels.length +
              ' officine' + (r.appels.length > 1 ? 's' : '') + ' encore à appeler.</p>' +
            (r.appels.length > PORTION
              ? '<p class="app-note">On s’arrête à ' + PORTION + ' par écran : vingt numéros, ' +
                'c’est déjà une matinée. Les suivantes remontent dès que celles-ci sont traitées.</p>'
              : '') +
            resteTexte(r) +
            '<p class="app-note">⚠️ Une officine notée ne remontera pas avant <b>trois semaines</b> — ' +
              'un téléphone qui sonne deux fois dans la semaine, un pharmacien s’en souvient. ' +
              'Et l’équipe entière voit tes appels : deux commerciaux sur le même département ' +
              'ne l’appelleront pas le même jour.</p>';
        }
        root.innerHTML = top + '<div class="v2-wrap narrow">' + hero + corps + '</div>';
      });
    }
  };
})();
