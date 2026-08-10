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
      'ORGANIZER;CN=' + ech(r.organisateur) + ':MAILTO:noreply@integralpharma.fr',
      'END:VEVENT',
      'END:VCALENDAR'
    ];
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
