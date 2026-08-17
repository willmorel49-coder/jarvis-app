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

  // Le lien permanent du commercial : réel, et sans effet de bord.
  function lienDemo() {
    var c = sb(), u = uid();
    if (!c || !u) return Promise.resolve('');
    return c.from('rdv_lien_public').select('slug, token').eq('user_id', u).maybeSingle()
      .then(function (r) {
        var d = (r && r.data) || null;
        if (!d) return '';
        var p = window.location.pathname.replace(/crm\/v2\/[^/]*$/, '');
        return d.slug ? (window.location.origin + p + 'rdv/' + d.slug)
                      : (V2.rdv.BASE_URL + '?c=' + d.token);
      })
      .catch(function () { return ''; });
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

      Promise.all([V2.rdvSources(), V2.rdvTelCharger(), lienDemo()]).then(function (res) {
        var lien = res[2] || '';
        var o = (pid && !groupe) ? V2.rdvInfo(pid) : null;
        var ctx = {
          contact: o ? o.contact : '',
          nom_officine: o ? o.nom : 'VOTRE OFFICINE',
          ville: o ? o.ville : '',
          ca_annee: pid ? V2.rdvCA(pid) : null,
          mois_derniere_visite: null,
          prenom_commercial: String((V2.user && V2.user.name) || '').split(' ')[0] || '',
          nom_complet_commercial: (V2.user && V2.user.name) || '',
          tel_commercial: V2.rdvTel || '',
          lien: lien,
          texte_libre: texteLibre || ''
        };
        var m = groupe ? window.V2MOD.rendreGroupe(modele || 'routine', ctx)
                       : window.V2MOD.rendre(modele || 'routine', ctx);
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
                    : (o ? '' : ' — ici avec une officine d’exemple')) + '. ' +
            'Le lien affiché est le tien, il fonctionne.' +
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
      var m = DERNIER.groupe ? window.V2MOD.rendreGroupeHtml(DERNIER.modele, DERNIER.ctx)
                             : window.V2MOD.rendreHtml(DERNIER.modele, DERNIER.ctx);
      var brut = (DERNIER.groupe ? window.V2MOD.rendreGroupe(DERNIER.modele, DERNIER.ctx)
                                 : window.V2MOD.rendre(DERNIER.modele, DERNIER.ctx)).corps;
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
      var m = DERNIER.groupe ? window.V2MOD.rendreGroupe(DERNIER.modele, DERNIER.ctx)
                             : window.V2MOD.rendre(DERNIER.modele, DERNIER.ctx);
      V2.rdv._ouvrir('mailto:' + encodeURIComponent(moi) +
        '?subject=' + encodeURIComponent('[TEST] ' + m.objet) +
        '&body=' + encodeURIComponent(m.corps));
      V2.toast('Test préparé vers ' + moi + '.');
    }
  };
})();
