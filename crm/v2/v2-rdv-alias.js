/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Rattachements validés à la main

   La reconnaissance est refaite à chaque ouverture — rien n'est stocké
   des titres d'agenda. Sans cette table, corriger « Phie des javobins »
   serait à refaire chaque fois. On ne garde donc QUE la correspondance,
   et seulement pour les titres que le commercial a lui-même désignés.

   ⚠️ La table n'accorde pas le DELETE (vérifié : 42501). Défaire un
   rattachement l'archive ; le reposer le ressuscite.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  function sb() { return (V2.sb && V2.sb()) || null; }
  function uid() { return (V2.user && V2.user.id) || null; }
  // Appliquer cleAlias à une clé déjà normalisée la laisse inchangée :
  // l'appelant peut donc passer un titre brut OU une clé.
  function cle(titre) { return window.V2RECO ? window.V2RECO.cleAlias(titre) : ''; }

  V2.rdvAlias = {
    // Rend { cle: cip }. Ne rejette jamais : l'écran doit s'afficher même
    // si la table répond mal — il redemandera simplement les rattachements.
    charger: function () {
      var c = sb(), u = uid();
      if (!c || !u) return Promise.resolve({});
      return c.from('rdv_agenda_alias').select('cle, cip')
        .eq('user_id', u).eq('archive', false)
        .then(function (r) {
          var out = {};
          ((r && r.data) || []).forEach(function (l) { out[l.cle] = String(l.cip); });
          return out;
        })
        .catch(function () { return {}; });
    },

    poser: function (titre, cip) {
      var c = sb(), u = uid(), k = cle(titre);
      if (!c || !u || !k || !cip) return Promise.resolve(false);
      // Reposer un rattachement archivé doit le RESSUSCITER, sinon le
      // commercial corrigerait dans le vide. On tente la mise à jour
      // d'abord ; l'insertion ne sert que la première fois.
      return c.from('rdv_agenda_alias')
        .update({ cip: String(cip), archive: false })
        .eq('user_id', u).eq('cle', k)
        .select('id')
        .then(function (r) {
          if (r && r.data && r.data.length) return true;
          return c.from('rdv_agenda_alias')
            .insert({ user_id: u, cle: k, cip: String(cip) })
            .then(function (i) { return !(i && i.error); });
        })
        .catch(function () { return false; });
    },

    retirer: function (titre) {
      var c = sb(), u = uid(), k = cle(titre);
      if (!c || !u || !k) return Promise.resolve(false);
      return c.from('rdv_agenda_alias').update({ archive: true })
        .eq('user_id', u).eq('cle', k)
        .then(function (r) { return !(r && r.error); })
        .catch(function () { return false; });
    }
  };
})();
