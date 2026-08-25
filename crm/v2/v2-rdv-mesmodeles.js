/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Mes modèles de mail (pages.rdvmodeles)

   Les trois motifs livrés — bilan / nouveauté / routine — sont écrits une
   fois pour huit personnes. Celui qui n'aime pas le texte n'avait qu'une
   sortie : ne pas se servir du module. Ici chacun écrit les siens.

   Trois choix qui tiennent tout le reste :

   1. ON NE PART JAMAIS D'UNE PAGE BLANCHE. Chaque nouveau modèle démarre
      d'un motif existant, déjà rempli. Écrire un mail commercial devant un
      cadre vide, ce n'est pas la même tâche que le retoucher.

   2. LA SIGNATURE ET LA MENTION STOP NE S'ÉCRIVENT PAS ICI. Le moteur les
      ajoute. La mention STOP est une promesse que l'écran de suivi honore
      réellement — elle ne peut pas dépendre de ce qu'un auteur pense à
      recopier. La signature, elle, ne contient que des faits.

   3. UN MODÈLE QUI NOMME L'OFFICINE NE PART PAS EN COPIE CACHÉE. L'écran
      le dit à l'écriture, et le moteur le refuse à l'envoi : un corps
      unique vers 25 officines serait faux pour 24 d'entre elles.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  V2.pages = V2.pages || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }

  var TABLE = 'rdv_modele';
  var _cache = null;          // [{id, nom, objet, corps}] — les miens, non archivés
  var _promesse = null;
  var EDIT = null;            // le modèle en cours d'édition

  // Officine d'exemple pour l'aperçu de l'éditeur. Volontairement fictive :
  // on montre la MÉCANIQUE des étiquettes, pas les chiffres d'un client — et
  // ça évite d'attendre le chargement des ventes pour afficher un aperçu.
  var DEMO = {
    contact: 'M. Dupont', nom_officine: 'PHARMACIE DU MARCHÉ', ville: 'Angers',
    ca_annee: 43812, mois_derniere_visite: 7,
    ruptures_tension: 3, ruptures_stock: 2,
    lien: 'https://prendre-rendez-vous.vercel.app/rdv/exemple'
  };

  function ctxDemo() {
    var d = {}, k;
    for (k in DEMO) if (DEMO.hasOwnProperty(k)) d[k] = DEMO[k];
    d.prenom_commercial = String((V2.user && V2.user.name) || '').split(' ')[0] || 'Prénom';
    d.nom_complet_commercial = (V2.user && V2.user.name) || 'Prénom Nom';
    d.tel_commercial = V2.rdvTel || '';
    return d;
  }

  // ── Lecture / écriture ────────────────────────────────────────────
  // Chargé une fois par session. `V2.rdv.preparerMail` attend cette promesse
  // avant de composer un mail : sans le cache, un « perso:… » ne se résoudrait
  // pas et le mail partirait en « routine » sans que personne le voie.
  V2.rdvModeles = {
    charger: function (force) {
      if (_promesse && !force) return _promesse;
      var c = sb(), u = uid();
      if (!c || !u) { _cache = []; _promesse = Promise.resolve([]); return _promesse; }
      _promesse = c.from(TABLE).select('id, nom, objet, corps')
        .eq('user_id', u).eq('archive', false).order('maj_le', { ascending: false })
        .then(function (r) {
          // ⚠️ Une erreur ne devient PAS une liste vide silencieuse : le repli
          // garde le cache précédent s'il existe. Un écran qui perd les
          // modèles de quelqu'un sans rien dire lui fait croire qu'ils sont
          // effacés — et il les réécrit.
          if (r && r.error) { _cache = _cache || []; return _cache; }
          _cache = ((r && r.data) || []).map(function (m) {
            return { id: String(m.id), nom: m.nom || '', objet: m.objet || '', corps: m.corps || '' };
          });
          return _cache;
        }, function () { _cache = _cache || []; return _cache; });
      return _promesse;
    },

    liste: function () { return _cache || []; },

    trouver: function (id) {
      var l = _cache || [], i;
      for (i = 0; i < l.length; i++) if (l[i].id === String(id)) return l[i];
      return null;
    },

    // Un modèle nomme-t-il ou chiffre-t-il l'officine ? C'est ce qui décide
    // s'il peut servir en copie cachée.
    nominatif: function (m) {
      return window.V2MOD.persoEtiquettes(String(m.objet) + '\n' + String(m.corps))
        .some(function (e) { return window.V2MOD.etiquetteNominative(e); });
    },

    // Les options <option> à ajouter au sélecteur de motif de la campagne.
    // En mode groupé, un modèle nominatif est affiché mais DÉSACTIVÉ, avec
    // la raison écrite dans son libellé : le cacher laisserait croire à une
    // perte, et le laisser cliquable produirait un mail refusé plus loin.
    options: function (groupe) {
      var l = _cache || [];
      if (!l.length) return '';
      return '<optgroup label="Mes modèles">' + l.map(function (m) {
        var no = groupe && V2.rdvModeles.nominatif(m);
        return '<option value="perso:' + esc(m.id) + '"' + (no ? ' disabled' : '') + '>' +
          esc(m.nom) + (no ? ' — impossible en copie cachée' : '') + '</option>';
      }).join('') + '</optgroup>';
    }
  };

  // ── L'aiguillage, utilisé par l'envoi ET par l'aperçu ─────────────
  // Un seul endroit décide « motif livré ou modèle personnel ». Les deux
  // chemins doivent produire exactement le même mail, sinon l'aperçu ne
  // prouve plus rien — c'est la famille de pannes du 13/08.
  function estPerso(cle) { return String(cle || '').indexOf('perso:') === 0; }
  function idDe(cle) { return String(cle || '').slice(6); }

  V2.rdvModeleRendre = function (cle, ctx, groupe) {
    if (estPerso(cle)) {
      var m = V2.rdvModeles.trouver(idDe(cle));
      if (m) return window.V2MOD.rendrePerso(m, ctx, { groupe: !!groupe });
      // Modèle archivé entre-temps, ou cache non chargé : on le DIT et on
      // retombe sur le motif de base plutôt que d'envoyer un mail vide.
      if (V2.toast) V2.toast('Ce modèle personnel est introuvable — motif « routine » utilisé.');
    }
    return groupe ? window.V2MOD.rendreGroupe(cle, ctx) : window.V2MOD.rendre(cle, ctx);
  };

  V2.rdvModeleRendreHtml = function (cle, ctx, groupe) {
    if (estPerso(cle)) {
      var m = V2.rdvModeles.trouver(idDe(cle));
      if (m) return window.V2MOD.rendrePersoHtml(m, ctx, { groupe: !!groupe });
    }
    return groupe ? window.V2MOD.rendreGroupeHtml(cle, ctx) : window.V2MOD.rendreHtml(cle, ctx);
  };

  // Le libellé lisible d'un motif, pour les écrans qui l'affichent.
  V2.rdvModeleNom = function (cle) {
    if (estPerso(cle)) {
      var m = V2.rdvModeles.trouver(idDe(cle));
      return m ? m.nom : 'Modèle personnel';
    }
    var l = window.V2MOD.liste(), i;
    for (i = 0; i < l.length; i++) if (l[i].cle === cle) return l[i].nom;
    return 'Routine';
  };

  // ── Écran ─────────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('v2-mm-css')) return;
    var s = document.createElement('style'); s.id = 'v2-mm-css';
    s.textContent = [
      '.mm-sec{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;',
      '  color:var(--muted);margin:22px 0 9px}',
      '.mm-box{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:15px}',
      '.mm-item{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);',
      '  padding:13px 15px;margin-bottom:9px}',
      '.mm-item b{display:block;font-size:16px;letter-spacing:-.01em}',
      '.mm-item .mm-obj{color:var(--muted);font-size:13.5px;margin:3px 0 0}',
      '.mm-item .mm-ext{color:var(--muted);font-size:13px;margin:8px 0 0;line-height:1.5;',
      '  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.mm-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:11px}',
      '.mm-acts .v2-btn{min-height:44px}',
      '.mm-vide{color:var(--muted);font-size:14px;padding:14px 2px;line-height:1.55}',
      '.mm-box label{display:block;font-size:12.5px;font-weight:700;margin:0 0 5px}',
      '.mm-box input,.mm-box textarea{width:100%;box-sizing:border-box;font:inherit;font-size:16px;',
      '  padding:11px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card-2);',
      '  color:var(--fg);min-height:44px}',
      '.mm-box textarea{line-height:1.6;resize:vertical}',
      '.mm-etiq{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0 0}',
      '.mm-etiq button{min-height:36px;padding:0 11px;border-radius:9px;border:1px solid var(--line);',
      '  background:var(--card-2);color:var(--fg);font:inherit;font-size:12.5px;cursor:pointer}',
      '.mm-etiq button:hover{border-color:var(--ip-blue);color:var(--ip-blue)}',
      '.mm-aide{color:var(--muted);font-size:12.5px;line-height:1.55;margin:8px 0 0}',
      '.mm-err{color:#C7283D;font-size:13.5px;line-height:1.55;margin:10px 0 0}',
      '.mm-avert{color:#8A5A12;font-size:13.5px;line-height:1.55;margin:10px 0 0}',
      '.mm-ap{background:var(--card-2);border:1px solid var(--line);border-radius:var(--r-md);',
      '  padding:15px;white-space:pre-wrap;font-size:14px;line-height:1.6;word-break:break-word}',
      '.mm-ap-obj{font-weight:700;border-bottom:1px solid var(--line);padding-bottom:9px;margin-bottom:11px}'
    ].join('');
    document.head.appendChild(s);
  }

  function apercu() {
    var z = document.getElementById('mm-apercu');
    if (!z || !EDIT) return;
    var m = window.V2MOD.rendrePerso(
      { nom: EDIT.nom, objet: v('mm-objet'), corps: v('mm-corps') }, ctxDemo());
    z.innerHTML = '<div class="mm-ap"><div class="mm-ap-obj">' + esc(m.objet || '(objet vide)') +
      '</div>' + esc(m.corps) + '</div>';

    var val = window.V2MOD.persoValider({ nom: v('mm-nom'), objet: v('mm-objet'), corps: v('mm-corps') });
    var e = document.getElementById('mm-etat');
    if (e) {
      e.innerHTML =
        (val.erreurs.length ? '<p class="mm-err">' + val.erreurs.map(esc).join('<br>') + '</p>' : '') +
        (val.avertissements.length ? '<p class="mm-avert">' + val.avertissements.map(esc).join('<br>') + '</p>' : '');
    }
  }

  function v(id) { var e = document.getElementById(id); return e ? e.value : ''; }

  V2.rdvModelesUI = {
    // Insère une étiquette à l'endroit du curseur, pas à la fin : on écrit
    // « Bonjour {{contact}}, » au milieu d'une phrase, jamais en bout de texte.
    inserer: function (cle) {
      var t = document.getElementById('mm-corps');
      if (!t) return;
      var jeton = '{{' + cle + '}}';
      var a = t.selectionStart, b = t.selectionEnd;
      if (typeof a === 'number') {
        t.value = t.value.slice(0, a) + jeton + t.value.slice(b);
        t.selectionStart = t.selectionEnd = a + jeton.length;
      } else { t.value += jeton; }
      t.focus();
      apercu();
    },

    saisie: apercu,

    nouveau: function (base) {
      // « Partir de rien » : le seul cas où le cadre est vide. Il reste
      // proposé — quelqu'un qui a déjà son texte en tête n'a pas à effacer
      // le mien avant d'écrire le sien.
      if (base === 'vide') {
        EDIT = { id: null, nom: '', objet: '',
                 corps: 'Bonjour {{contact}},\n\n\n\n{{lien}}' };
        V2.go('rdvmodeles');
        return;
      }
      // Sinon : jamais de page blanche, on part d'un motif livré déjà écrit.
      var src = window.V2MOD.rendre(base || 'routine', {
        contact: '{{contact}}', nom_officine: '{{officine}}', ville: '{{ville}}',
        mois_derniere_visite: null, lien: '{{lien}}',
        texte_libre: 'J’ai du nouveau à vous présenter.'
      });
      // Le moteur ajoute signature et mention STOP à l'envoi : on les retire
      // du point de départ, sinon elles se retrouveraient en double.
      var corps = String(src.corps).split('\n\nBien à vous,')[0];
      // ⚠️ Le motif rendu sans données retombe sur ses phrases passe-partout
      // (« chiffres à l'appui », « un moment »). Les remettre en étiquettes est
      // tout l'intérêt de partir d'un motif existant : le point de départ doit
      // MONTRER la mécanique, sinon personne ne devine qu'elle existe.
      corps = corps
        .replace('Cela fait un moment que nous ne nous sommes pas vus.',
                 'Cela fait {{mois}} que nous ne nous sommes pas vus.')
        // « cette année » est DANS la valeur de {{ca}} : l'étiquette doit finir
        // la ligne, sinon une officine sans chiffre laisse « — cette année ».
        .replace('ce que vous faites déjà avec nous, chiffres à l’appui',
                 'ce que vous faites déjà avec nous — {{ca}}')
        .replace('les références en tension que nous avons en stock', '{{tension}}');
      EDIT = { id: null, nom: '', objet: src.objet, corps: corps };
      V2.go('rdvmodeles');
    },

    modifier: function (id) {
      var m = V2.rdvModeles.trouver(id);
      if (!m) { V2.toast('Modèle introuvable.'); return; }
      EDIT = { id: m.id, nom: m.nom, objet: m.objet, corps: m.corps };
      V2.go('rdvmodeles');
    },

    dupliquer: function (id) {
      var m = V2.rdvModeles.trouver(id);
      if (!m) { V2.toast('Modèle introuvable.'); return; }
      EDIT = { id: null, nom: m.nom + ' (copie)', objet: m.objet, corps: m.corps };
      V2.go('rdvmodeles');
    },

    annuler: function () { EDIT = null; V2.go('rdvmodeles'); },

    // ⚠️ Archiver, jamais supprimer : les envois passés citent ce modèle,
    // et le hook `garde-donnees` refuse tout DELETE. La table n'accorde
    // d'ailleurs pas le droit à l'application.
    archiver: function (id, nom) {
      var c = sb(), u = uid();
      if (!c || !u) return;
      c.from(TABLE).update({ archive: true }).eq('id', id).eq('user_id', u)
        .then(function (r) {
          if (r && r.error) { V2.toast('Archivage impossible.'); return; }
          V2.toast('« ' + (nom || 'Modèle') + ' » retiré de tes motifs.');
          V2.rdvModeles.charger(true).then(function () { V2.go('rdvmodeles'); });
        });
    },

    enregistrer: function () {
      var c = sb(), u = uid();
      if (!c || !u) { V2.toast('Connecte-toi.'); return; }
      var mod = { nom: v('mm-nom').trim(), objet: v('mm-objet').trim(), corps: v('mm-corps').trim() };
      var val = window.V2MOD.persoValider(mod);
      if (!val.ok) { V2.toast(val.erreurs[0]); apercu(); return; }

      var b = document.getElementById('mm-save');
      if (b) { b.disabled = true; b.textContent = 'Enregistrement…'; }
      function rate(msg) {
        if (b) { b.disabled = false; b.textContent = 'Enregistrer'; }
        V2.toast(msg || 'Enregistrement impossible.');
      }
      var q = (EDIT && EDIT.id)
        ? c.from(TABLE).update(mod).eq('id', EDIT.id).eq('user_id', u).select('id').single()
        : c.from(TABLE).insert({ user_id: u, nom: mod.nom, objet: mod.objet, corps: mod.corps })
            .select('id').single();
      q.then(function (r) {
        if (!r || r.error || !r.data) { rate(); return; }
        EDIT = null;
        V2.rdvModeles.charger(true).then(function () {
          V2.toast('Modèle enregistré. Il est dans la liste des motifs de ta campagne.');
          V2.go('rdvmodeles');
        });
      }, function () { rate(); });
    }
  };

  function editeur() {
    var e = EDIT || { id: null, nom: '', objet: '', corps: '' };
    var chips = window.V2MOD.ETIQUETTES.map(function (t) {
      return '<button type="button" title="' + esc(t.quoi) +
        '" onclick="V2.rdvModelesUI.inserer(\'' + esc(t.cle) + '\')">{{' + esc(t.cle) + '}}</button>';
    }).join('');
    var tableau = window.V2MOD.ETIQUETTES.map(function (t) {
      return '<b>{{' + esc(t.cle) + '}}</b> — ' + esc(t.quoi) +
        (window.V2MOD.etiquetteNominative(t.cle) ? ' · propre à l’officine' : '');
    }).join('<br>');

    return '<div class="mm-sec">' + (e.id ? 'Modifier le modèle' : 'Nouveau modèle') + '</div>' +
      '<div class="mm-box">' +
        '<label for="mm-nom">Le nom (pour toi seul)</label>' +
        '<input id="mm-nom" maxlength="80" value="' + esc(e.nom) + '" ' +
          'oninput="V2.rdvModelesUI.saisie()" placeholder="Ex. Mon relationnel" />' +

        '<label for="mm-objet" style="margin-top:14px">L’objet du mail</label>' +
        '<input id="mm-objet" maxlength="300" value="' + esc(e.objet) + '" ' +
          'oninput="V2.rdvModelesUI.saisie()" />' +

        '<label for="mm-corps" style="margin-top:14px">Le message</label>' +
        '<textarea id="mm-corps" rows="14" oninput="V2.rdvModelesUI.saisie()">' +
          esc(e.corps) + '</textarea>' +
        '<div class="mm-etiq">' + chips + '</div>' +
        '<p class="mm-aide">Clique une étiquette pour l’insérer où est ton curseur.<br>' + tableau + '</p>' +
        '<p class="mm-aide"><b>N’écris ni ta signature ni la mention STOP</b> : JARVIS les ' +
          'ajoute tout seul, à la fin, pour tous les modèles.</p>' +
        '<div id="mm-etat"></div>' +
        '<div class="mm-acts">' +
          '<button class="v2-btn v2-btn-primary" id="mm-save" ' +
            'onclick="V2.rdvModelesUI.enregistrer()">Enregistrer</button>' +
          '<button class="v2-btn v2-btn-ghost" onclick="V2.rdvModelesUI.annuler()">Annuler</button>' +
        '</div>' +
      '</div>' +

      '<div class="mm-sec">Ce que reçoit le pharmacien</div>' +
      '<div id="mm-apercu"></div>' +
      '<p class="mm-aide">Aperçu sur une officine d’exemple — Pharmacie du Marché, ' +
        '43 812 € cette année, vue il y a 7 mois. Dans la campagne, ce sont les vrais ' +
        'chiffres de l’officine visée qui remplaceront les étiquettes.</p>';
  }

  function liste() {
    var l = V2.rdvModeles.liste();
    // Construit depuis la liste réelle des motifs livrés : depuis le 19/08 il
    // n'y en a qu'un, et trois boutons écrits en dur auraient survécu au
    // changement en proposant deux modèles qui n'existent plus.
    var depart = window.V2MOD.liste().map(function (n) {
      return '<button class="v2-btn" onclick="V2.rdvModelesUI.nouveau(\'' + esc(n.cle) + '\')">' +
        'Partir de « ' + esc(n.nom) + ' »</button>';
    }).join('');

    return '<div class="mm-sec">Mes modèles</div>' +
      (l.length
        ? l.map(function (m) {
            var n = String(m.nom).replace(/'/g, '');
            return '<div class="mm-item"><b>' + esc(m.nom) + '</b>' +
              '<p class="mm-obj">Objet : ' + esc(m.objet) + '</p>' +
              '<p class="mm-ext">' + esc(m.corps) + '</p>' +
              '<div class="mm-acts">' +
                '<button class="v2-btn" onclick="V2.rdvModelesUI.modifier(\'' + esc(m.id) + '\')">Modifier</button>' +
                '<button class="v2-btn" onclick="V2.rdvModelesUI.dupliquer(\'' + esc(m.id) + '\')">Dupliquer</button>' +
                '<button class="v2-btn v2-btn-ghost" onclick="V2.rdvModelesUI.archiver(\'' + esc(m.id) +
                  '\',\'' + esc(n) + '\')">Retirer</button>' +
              '</div></div>';
          }).join('')
        : '<p class="mm-vide">Tu n’as pas encore de modèle à toi. Les trois motifs livrés ' +
          'restent disponibles — commence par en retoucher un, c’est plus rapide que ' +
          'd’écrire devant une page blanche.</p>') +

      '<div class="mm-sec">En écrire un</div>' +
      '<div class="mm-box"><div class="mm-acts">' + depart +
        '<button class="v2-btn v2-btn-ghost" onclick="V2.rdvModelesUI.nouveau(\'vide\')">Partir de rien</button>' +
      '</div></div>';
  }

  V2.pages.rdvmodeles = {
    render: function (root) {
      css();
      var top = V2.topbar ? V2.topbar({ back: true, backTo: 'rdv', backLabel: 'Rendez-vous' }) : '';
      var hero = '<div class="v2-rdv-cap"><h1>Mes modèles</h1>' +
        '<p>Tes mots à toi. Les étiquettes entre accolades sont remplacées par les ' +
        'informations de l’officine au moment de l’envoi : son nom, son titulaire, ' +
        'ce qu’elle fait avec nous, depuis combien de temps tu ne l’as pas vue.</p></div>';

      root.innerHTML = top + '<div class="v2-wrap narrow">' + hero +
        '<p class="mm-vide">Chargement…</p></div>';

      Promise.all([V2.rdvModeles.charger(true), V2.rdvTelCharger ? V2.rdvTelCharger() : null])
        .then(function () {
          root.innerHTML = top + '<div class="v2-wrap narrow">' + hero +
            (EDIT ? editeur() : liste()) + '</div>';
          if (EDIT) apercu();
        });
    }
  };
})();
