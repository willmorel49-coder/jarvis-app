/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Mon lien de réservation permanent (bloc de « Mes disponibilités »)

   Le commercial colle ce lien dans sa signature de mail. Une officine qui n'a
   reçu aucune campagne peut réserver toute seule, à n'importe quel moment.

   Différence avec un lien de campagne : celui-ci ne se consomme pas et ne
   connaît pas l'officine. C'est la page publique qui lui demande son nom et
   son code postal AVANT d'afficher le moindre créneau — sans quoi toute la
   cohérence géographique s'effondrerait.

   Le jeton est secret-mais-public, exactement comme le fait Calendly : il
   suffit à réserver, il ne donne accès à rien d'autre. Un bouton le remplace
   d'un clic si jamais il circule trop.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var esc = function (s) { return V2.esc ? V2.esc(s) : String(s == null ? '' : s); };

  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }

  function base() {
    // Même dossier que le CRM : /crm/v2/rdv.html
    var u = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    return u + 'rdv.html?c=';
  }

  function css() {
    if (document.getElementById('v2-lien-css')) return;
    var s = document.createElement('style'); s.id = 'v2-lien-css';
    s.textContent = [
      '.v2-lien-box{background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);padding:14px 16px}',
      '.v2-lien-url{display:block;width:100%;font:inherit;font-size:14px;padding:12px;min-height:44px;',
      '  border:1px solid var(--line);border-radius:10px;background:var(--card-2);color:inherit;',
      '  word-break:break-all;margin:10px 0}',
      '.v2-lien-acts{display:flex;flex-wrap:wrap;gap:8px}',
      '.v2-lien-acts .v2-btn{min-height:44px}',
      '.v2-lien-note{color:var(--muted);font-size:13px;line-height:1.55;margin:12px 0 0}',
      '.v2-lien-off{opacity:.55}'
    ].join('');
    document.head.appendChild(s);
  }

  V2.rdvLien = {
    // Lit le lien du commercial, et le crée à la première ouverture : personne
    // ne doit avoir à cliquer sur « générer » pour qu'un outil existe.
    charger: function () {
      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve(null);
      return c.from('rdv_lien_public').select('token, actif').eq('user_id', u).maybeSingle()
        .then(function (r) {
          if (r && r.data) return r.data;
          return c.from('rdv_lien_public').insert({ user_id: u })
            .select('token, actif').single()
            .then(function (r2) { return (r2 && r2.data) || null; })
            .catch(function () { return null; });
        })
        .catch(function () { return null; });
    },

    bloc: function (l) {
      css();
      if (!l) {
        return '<div class="v2-lien-box"><p class="v2-lien-note">' +
          'Ton lien de réservation n’a pas pu être chargé. Recharge la page.</p></div>';
      }
      var url = base() + l.token;
      return '<div class="v2-lien-box' + (l.actif ? '' : ' v2-lien-off') + '">' +
        '<p class="v2-lien-note" style="margin:0">' +
          (l.actif
            ? 'Colle-le dans ta signature de mail. Une officine peut réserver sans que tu lui aies rien envoyé.'
            : '<b>Ce lien est fermé</b> : personne ne peut réserver avec.') + '</p>' +
        '<input class="v2-lien-url" id="v2-lien-u" readonly value="' + esc(url) + '" ' +
          'onclick="this.select()" />' +
        '<div class="v2-lien-acts">' +
          '<button class="v2-btn v2-btn-primary" onclick="V2.rdvLien.copier()">Copier</button>' +
          '<button class="v2-btn" onclick="V2.rdvLien.basculer(' + (l.actif ? 'false' : 'true') + ')">' +
            (l.actif ? 'Fermer le lien' : 'Rouvrir le lien') + '</button>' +
          '<button class="v2-btn v2-btn-ghost" onclick="V2.rdvLien.remplacer()">Remplacer</button>' +
        '</div>' +
        '<p class="v2-lien-note">Ce lien suffit à réserver un créneau avec toi — il ne donne accès ' +
          'à rien d’autre. S’il circule trop, « Remplacer » en crée un nouveau et l’ancien cesse ' +
          'aussitôt de fonctionner.</p>' +
      '</div>';
    },

    copier: function () {
      var e = document.getElementById('v2-lien-u');
      if (!e) return;
      e.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (x) {}
      if (!ok && navigator.clipboard) {
        navigator.clipboard.writeText(e.value).then(function () { V2.toast('Lien copié.'); });
        return;
      }
      V2.toast(ok ? 'Lien copié.' : 'Sélectionne le lien et copie-le à la main.');
    },

    basculer: function (actif) {
      var c = sb(), u = uid();
      if (!c || !u) return;
      c.from('rdv_lien_public').update({ actif: actif }).eq('user_id', u).then(function (r) {
        V2.toast(r.error ? 'Impossible pour l’instant.'
                         : (actif ? 'Lien rouvert.' : 'Lien fermé.'));
        if (!r.error && V2.go) V2.go('rdvdispo');
      });
    },

    remplacer: function () {
      if (!window.confirm('Remplacer ton lien ? L’ancien cessera immédiatement de fonctionner, ' +
                          'y compris dans les mails déjà envoyés.')) return;
      var c = sb(), u = uid();
      if (!c || !u) return;
      // gen_random_uuid() côté base : on ne fabrique pas de jeton dans le navigateur.
      c.from('rdv_lien_public').delete().eq('user_id', u).then(function () {
        return c.from('rdv_lien_public').insert({ user_id: u });
      }).then(function () {
        V2.toast('Nouveau lien créé.');
        if (V2.go) V2.go('rdvdispo');
      }).catch(function () { V2.toast('Impossible pour l’instant.'); });
    }
  };
})();
