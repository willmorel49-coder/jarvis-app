/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Aperçu du mail, et envoi d'un test à soi-même (V2.rdvApercu)

   Deux manques signalés par Will le 12/08/2026 : on envoyait à l'aveugle,
   et on ne pouvait pas se l'envoyer à soi d'abord.

   L'aperçu utilise le LIEN PERMANENT du commercial — un vrai lien, qui
   fonctionne. Il ne crée donc aucun jeton jetable : regarder son mail ne
   doit pas laisser de trace dans la base.

   Le test, lui, part vraiment : même modèle, même lien, mais adressé au
   commercial. C'est le seul moyen de voir ce que verra le pharmacien, dans
   sa propre messagerie, avec sa propre signature.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }

  function css() {
    if (document.getElementById('v2-ap-css')) return;
    var s = document.createElement('style'); s.id = 'v2-ap-css';
    s.textContent = [
      '.v2-ap{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden}',
      '.v2-ap-obj{padding:12px 16px;border-bottom:1px solid var(--line);background:var(--card-2);font-size:14px}',
      '.v2-ap-obj b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.06em;',
      '  color:var(--muted);margin-bottom:3px}',
      // Le corps est affiché tel qu'il partira : même police, mêmes retours à
      // la ligne. Un aperçu « joli mais différent » ne sert à rien.
      '.v2-ap-corps{padding:18px 16px;font-size:15px;line-height:1.65;white-space:pre-wrap;',
      '  word-break:break-word}',
      '.v2-ap-corps a{color:var(--ip-blue)}',
      '.v2-ap-acts{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 16px}',
      '.v2-ap-acts .v2-btn{min-height:44px}',
      '.v2-ap-note{color:var(--muted);font-size:13px;line-height:1.55;margin:10px 0 0}'
    ].join('');
    document.head.appendChild(s);
  }

  var DERNIER = null;   // le dernier aperçu calculé, pour la copie mise en forme

  // Un seul aiguillage vers le moteur : motif standard ou modèle personnel.
  // Il est doublé de son repli `window.V2MOD` pour que l'aperçu continue de
  // marcher si le module des modèles personnels n'est pas chargé.
  function rendre(cle, ctx, groupe) {
    if (V2.rdvModeleRendre) return V2.rdvModeleRendre(cle, ctx, !!groupe);
    return groupe ? window.V2MOD.rendreGroupe(cle, ctx) : window.V2MOD.rendre(cle, ctx);
  }
  function rendreHtml(cle, ctx, groupe) {
    if (V2.rdvModeleRendreHtml) return V2.rdvModeleRendreHtml(cle, ctx, !!groupe);
    return groupe ? window.V2MOD.rendreGroupeHtml(cle, ctx) : window.V2MOD.rendreHtml(cle, ctx);
  }

  // Le lien permanent du commercial : réel, et sans effet de bord.
  // Le lien permanent vit dans v2-rdv.js — une seule adresse construite à un
  // seul endroit. Le repli garde l'aperçu fonctionnel si l'ordre de chargement
  // change un jour.
  function lienDemo() {
    if (V2.rdvLienPermanent) return V2.rdvLienPermanent();
    return Promise.resolve('');
  }

  V2.rdvApercu = {
    /**
     * Calcule et affiche l'aperçu dans l'élément #<cible>.
     * pid facultatif : sans lui, on montre un exemple neutre plutôt que rien.
     * groupe : aperçu du mail en COPIE CACHÉE — même corps pour tout le lot,
     *   donc ni nom de contact ni chiffres. Le pid est alors ignoré : montrer
     *   les chiffres d'une officine sur un mail qui part à 25 serait faux.
     */
    montrer: function (cible, modele, texteLibre, pid, groupe) {
      css();
      var z = document.getElementById(cible);
      if (!z) return;
      z.innerHTML = '<div class="v2-ap"><div class="v2-ap-corps">Préparation de l’aperçu…</div></div>';

      Promise.all([V2.rdvSources(), V2.rdvTelCharger(), lienDemo(), V2.rdvVuCharger()])
        .then(function (res) {
        var lien = res[2] || '';
        // ⚠️ L'aperçu doit composer le mail par le MÊME chemin que l'envoi,
        // sinon il ne prouve rien. D'où V2.rdvContexte des deux côtés — et
        // c'est aussi ce qui fait entrer ici les mois et les ruptures.
        var ctx = (pid && !groupe)
          ? V2.rdvContexte(pid, { lien: lien, texte_libre: texteLibre || '' })
          : {
              contact: '', nom_officine: 'VOTRE OFFICINE', ville: '',
              ca_annee: null, mois_derniere_visite: null,
              ruptures_tension: 0, ruptures_stock: 0,
              prenom_commercial: String((V2.user && V2.user.name) || '').split(' ')[0] || '',
              nom_complet_commercial: (V2.user && V2.user.name) || '',
              fonction_commercial: V2.rdvFonction || '',
              tel_commercial: V2.rdvTel || '',
              duree_min: V2.rdvDuree || 45,
              lien: lien, texte_libre: texteLibre || ''
            };
        var m = rendre(modele || 'routine', ctx, !!groupe);
        // Un modèle personnel nominatif refusé en groupé : on le DIT, au lieu
        // d'afficher un aperçu vide qui passerait pour une panne.
        if (m && m.refus === 'nominatif') {
          z.innerHTML = '<div class="v2-ap"><div class="v2-ap-corps">' +
            'Ce modèle nomme ou chiffre l’officine ({{' + esc(m.etiquettes.join('}}, {{')) +
            '}}). En envoi groupé, un seul texte part vers 25 officines : il serait ' +
            'faux pour 24 d’entre elles.<br><br>Choisis un motif standard, ou passe ' +
            'en envoi « un par un ».</div></div>';
          return;
        }
        DERNIER = { ctx: ctx, modele: modele || 'routine', objet: m.objet, groupe: !!groupe };

        // Le lien est rendu cliquable dans l'aperçu, le reste est échappé :
        // le nom d'une officine vient d'un fichier, pas de nous.
        var corps = esc(m.corps);
        if (lien) {
          corps = corps.split(esc(lien)).join(
            '<a href="' + esc(lien) + '" target="_blank" rel="noopener">' + esc(lien) + '</a>');
        }

        z.innerHTML =
          '<div class="v2-ap">' +
            '<div class="v2-ap-obj"><b>Objet</b>' + esc(m.objet) + '</div>' +
            '<div class="v2-ap-corps">' + corps + '</div>' +
            '<div class="v2-ap-acts">' +
              '<button class="v2-btn" onclick="V2.rdvApercu.copierHtml()">Copier le mail mis en forme</button>' +
              '<button class="v2-btn" onclick="V2.rdvApercu.tester()">M’envoyer un test</button>' +
            '</div>' +
          '</div>' +
          '<p class="v2-ap-note">C’est exactement ce que recevra le pharmacien' +
            (groupe ? ' — le même corps pour tout le lot, sans nom ni chiffres, ' +
                      'puisqu’un mail en copie cachée part vers 25 officines à la fois'
                    : (pid ? '' : ' — ici avec une officine d’exemple')) + '. ' +
            // ⚠️ Sans lien permanent créé, l'aperçu n'en montre aucun — et
            // annoncer « le lien affiché est le tien » serait alors faux. Le
            // vrai envoi, lui, fabrique un jeton par officine : il aura
            // toujours son lien. On dit exactement ça.
            (lien
              ? 'Le lien affiché est le tien, il fonctionne.'
              : '<b>Tu n’as pas encore de lien permanent</b>, l’aperçu en est donc dépourvu. ' +
                'Les mails envoyés un par un porteront quand même leur lien — ' +
                'il est créé pour chaque officine. Pour l’envoi groupé, en revanche, ' +
                'crée-le dans « Mes dispos ».') +
            (m.avertissement ? '<br><b>' + esc(m.avertissement) + '</b>' : '') + '</p>' +
          '<p class="v2-ap-note"><b>Mis en forme</b> : ta messagerie n’accepte que du texte brut ' +
            'quand JARVIS l’ouvre pour toi. Pour un mail avec un vrai bouton, clique ' +
            '« Copier le mail mis en forme », puis colle dans Outlook.</p>';
      }).catch(function () {
        z.innerHTML = '<div class="v2-ap"><div class="v2-ap-corps">Aperçu indisponible.</div></div>';
      });
    },

    // Met la version mise en forme dans le presse-papier. On écrit à la fois
    // le HTML et le texte : si la messagerie n'accepte pas le premier, elle
    // colle le second au lieu de coller du code.
    copierHtml: function () {
      if (!DERNIER) { V2.toast('Ouvre d’abord l’aperçu.'); return; }
      var m = rendreHtml(DERNIER.modele, DERNIER.ctx, DERNIER.groupe);
      var brut = rendre(DERNIER.modele, DERNIER.ctx, DERNIER.groupe).corps;
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        navigator.clipboard.write([new window.ClipboardItem({
          'text/html': new Blob([m.html], { type: 'text/html' }),
          'text/plain': new Blob([brut], { type: 'text/plain' })
        })]).then(function () {
          V2.toast('Mail copié. Colle-le dans Outlook : la mise en forme suit.');
        }).catch(function () { V2.toast('Copie refusée par le navigateur.'); });
        return;
      }
      // Repli : sans presse-papier riche, on copie au moins le texte.
      if (navigator.clipboard) {
        navigator.clipboard.writeText(brut).then(function () {
          V2.toast('Mail copié en texte (ce navigateur ne gère pas la mise en forme).');
        });
        return;
      }
      V2.toast('Copie impossible sur ce navigateur.');
    },

    // Le test part vraiment, vers l'adresse du commercial connecté.
    tester: function () {
      if (!DERNIER) { V2.toast('Ouvre d’abord l’aperçu.'); return; }
      var moi = (V2.user && V2.user.email) || '';
      if (!moi) { V2.toast('Adresse inconnue pour ton compte.'); return; }
      var m = rendre(DERNIER.modele, DERNIER.ctx, DERNIER.groupe);
      V2.rdv._ouvrir('mailto:' + encodeURIComponent(moi) +
        '?subject=' + encodeURIComponent('[TEST] ' + m.objet) +
        '&body=' + encodeURIComponent(m.corps));
      V2.toast('Test préparé vers ' + moi + '.');
    }
  };
})();
