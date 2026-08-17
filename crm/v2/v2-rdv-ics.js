/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Invitation agenda (V2ICS)
   Produit un .ics standard, lisible par Outlook, Gmail et Apple Calendrier.
   Heure « flottante » (sans fuseau) : les deux parties sont en France, et
   ça évite d'embarquer un bloc VTIMEZONE pour rien.
   Fichier PUR : aucun DOM, aucun réseau.
   ═══════════════════════════════════════════════════════════════════ */
(function (glob) {
  'use strict';
  var M = {};

  function ech(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  // Nombre d'octets UTF-8 d'un caractère, sans dépendre de Buffer (navigateur inclus).
  function octets(c) {
    return encodeURIComponent(c).replace(/%[0-9A-F]{2}/gi, 'x').length;
  }

  // RFC 5545 : 75 octets par ligne, les suivantes commencent par une espace.
  function plier(ligne) {
    var out = [], cur = '', n = 0;
    for (var i = 0; i < ligne.length; i++) {
      var c = ligne.charAt(i), taille = octets(c);
      if (n + taille > 75) { out.push(cur); cur = ' '; n = 1; }
      cur += c; n += taille;
    }
    out.push(cur);
    return out;
  }

  function stamp(date, heure) {
    return String(date).replace(/-/g, '') + 'T' + String(heure).replace(':', '') + '00';
  }
  function plusMinutes(heure, minutes) {
    var p = String(heure).split(':');
    var t = (+p[0]) * 60 + (+p[1]) + (+minutes || 0);
    var h = Math.floor(t / 60) % 24, m = t % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  M.build = function (rdv) {
    var r = rdv || {};
    var fin = plusMinutes(r.heure, r.duree_min || 45);
    var lignes = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//JARVIS//RDV//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + ech(r.uid),
      'DTSTAMP:' + stamp(r.date, r.heure),
      'DTSTART:' + stamp(r.date, r.heure),
      'DTEND:' + stamp(r.date, fin),
      'SUMMARY:' + ech(r.titre),
      'LOCATION:' + ech(r.lieu),
      'DESCRIPTION:' + ech(r.description),
      'ORGANIZER;CN=' + ech(r.organisateur) + ':MAILTO:noreply@integralpharma.fr'
    ];
    // Le lien de gestion, quand il y en a un. C'est la SEULE chose que le
    // pharmacien conserve : on n'a aucun service d'envoi, donc on ne peut rien
    // lui écrire. Son agenda devient sa confirmation, et il l'aura encore dans
    // trois mois. La propriété URL est affichée cliquable par la plupart des
    // agendas ; ceux qui l'ignorent montrent quand même la description.
    if (r.url) lignes.push('URL:' + ech(r.url));

    // ── Les rappels ─────────────────────────────────────────────
    // Le seul moyen GRATUIT de rappeler un rendez-vous à un pharmacien :
    // on n'a aucun service d'envoi, donc aucun mail, aucun SMS. Mais son
    // propre agenda sait sonner — il suffit de le lui demander dans le
    // fichier. Apple Calendar, Google Agenda et Outlook honorent VALARM.
    //
    // Deux rappels, et pas un seul : la veille pour qu'il puisse encore
    // déplacer (le lien de gestion est dans la description, juste à côté),
    // et une heure avant pour qu'il soit là. Un rappel unique la veille
    // s'oublie dans la journée ; un rappel unique à l'heure arrive trop
    // tard pour prévenir.
    if (r.rappels !== false) {
      [['-P1D', 'Rendez-vous demain'], ['-PT1H', 'Rendez-vous dans une heure']]
        .forEach(function (a) {
          lignes = lignes.concat([
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            'TRIGGER:' + a[0],
            'DESCRIPTION:' + ech(a[1] + ' — ' + (r.titre || 'Rendez-vous')),
            'END:VALARM'
          ]);
        });
    }

    lignes = lignes.concat([
      'END:VEVENT',
      'END:VCALENDAR'
    ]);
    var out = [];
    lignes.forEach(function (l) { out = out.concat(plier(l)); });
    return out.join('\r\n') + '\r\n';
  };

  M.dataUrl = function (texte) {
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(texte);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else glob.V2ICS = M;
})(typeof window !== 'undefined' ? window : this);
