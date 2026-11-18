/* Logiciels officine (#lgo, #lgo-detail). Deux colonnes sur ordinateur : à gauche « qui utilise quoi » (grand chiffre des
   pharmacies au logiciel connu, anneau, barre empilée une teinte par logiciel, liste des logiciels avec barre et compteur, sans pharmacie, à compléter,
   PharmaML) ; à droite le logiciel choisi en carte d'identité (éditeur, part du secteur, mode d'emploi en bouton plein) puis les onglets
   Vos officines · Pas-à-pas · Fichiers · Se former. Téléphone : la liste, puis le détail (#lgo-detail) avec Retour.
   Données : DONNEES_V5.lgo + DONNEES.officines (fictives). INTERNE : ce qui est commercial (comptes, parts, états, liste des pharmacies, export) porte
   data-interne ; le mode d'emploi, le pas-à-pas et les fichiers restent visibles face au pharmacien. */
(function () {
'use strict';
var J = window.J32, $ = J.$, $$ = J.$$, esc = J.esc, nf = J.nf, X = J.X.lgo, D = J.D;
var G = J.S.lgo = { sel: X.logiciels[0].s, onglet: 'pharmacies', q: '', qLog: '', qph: '' };
var STUB = function (q) { return 'Le geste « ' + q + ' » n’est pas dessiné dans cette maquette.'; };
var ICO_ET = ['screen', 'folder', 'table', 'check', 'send', 'net'];
var FORMER = [['Importer le catalogue Intégral dans {n}, pas à pas', 'fiche de l’équipe', 'doc'], ['Vidéo : l’import des prix nets dans {n}', 'vidéo de l’équipe', 'screen'], ['Questions fréquentes sur l’import du catalogue', 'fiche de l’équipe', 'bulb'], ['Mettre à jour le catalogue après un changement de tarif', 'fiche de l’équipe', 'doc']];   // la donnée ne porte qu'un compte : titres fictifs plausibles, tirés de cette liste
var PAR_LOG = {}; J.OFF.forEach(function (o) { var l = J.ficheDe(o.id).identite.logiciel || ''; (PAR_LOG[l] = PAR_LOG[l] || []).push(o); });
var AVEC = X.logiciels.filter(function (l) { return l.n > 0; }), SANS = X.logiciels.filter(function (l) { return !l.n; });
var COUL = {}; X.logiciels.forEach(function (l, i) { COUL[l.s] = 'var(--cat-' + ((i % 8) + 1) + ')'; });
function cleAutre(nom) { return 'autre-' + nom.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
function item(k) {
  var i, l;
  for (i = 0; i < X.logiciels.length; i++) if (X.logiciels[i].s === k) { l = X.logiciels[i]; return { type: 'log', k: k, nom: l.nom, editeur: l.editeur, n: l.n, etapes: l.etapes || [], fichiers: l.fichiers || [], former: l.former || 0, rang: AVEC.indexOf(l) + 1 }; }
  if (k === 'ac') return { type: 'ac', k: k, nom: 'Logiciel à compléter', editeur: '', n: X.sans, etapes: [], fichiers: [], former: 0 };
  if (k === 'pml') return { type: 'pml', k: k, nom: X.pml.nom, editeur: '', n: 0, etapes: X.pml.etapes || [], fichiers: [], former: 0 };
  for (i = 0; i < X.autres.length; i++) if (cleAutre(X.autres[i]) === k) return { type: 'autre', k: k, nom: X.autres[i], editeur: '', n: 0, etapes: [], fichiers: [], former: 0 };
  return null;
}
function etroit() { return window.innerWidth < 900; }
function offsDe(it) { return it.type === 'log' ? (PAR_LOG[it.nom] || []) : it.type === 'ac' ? (PAR_LOG[''] || []) : []; }
/* ---------- colonne de gauche : qui utilise quoi ---------- */
function rangee(k, nom, sous, n, coul, barre) {
  return '<button type="button" class="lg-row' + (G.sel === k ? ' on' : '') + '" data-lg="' + k + '" aria-pressed="' + (G.sel === k) + '"><span class="puce' + (coul ? '' : ' lg-pvide') + '"' + (coul ? ' style="background:' + coul + '"' : '') + '></span>' +
    '<span class="lg-rt"><b>' + esc(nom) + '</b><span class="sub">' + esc(sous) + '</span></span>' + (n != null ? '<span class="lg-rb" data-interne>' + (barre != null ? '<span class="bar12"><i style="width:' + barre + '%;--lg-t:' + coul + '"></i></span>' : '') + '<b class="num">' + nf.format(n) + '</b></span>' : '') + '<span class="ico chev">' + J.icoSvg('chev') + '</span></button>';
}
function gauche() {
  var q = G.qLog.toLowerCase(), pct = X.total ? Math.round(X.connus / X.total * 100) : 0, max = AVEC[0] ? AVEC[0].n : 1;
  var ok = function (nom, ed) { return !q || (nom + ' ' + (ed || '')).toLowerCase().indexOf(q) >= 0; };
  var pile = AVEC.map(function (l) { return '<i style="flex:' + l.n + ';background:' + COUL[l.s] + '" title="' + esc(l.nom) + ' : ' + nf.format(l.n) + ' pharmacies"></i>'; }).join('') + (X.sans ? '<i class="ac" style="flex:' + X.sans + '" title="À compléter : ' + nf.format(X.sans) + ' pharmacies"></i>' : '');
  var avec = AVEC.filter(function (l) { return ok(l.nom, l.editeur); }), sans = SANS.filter(function (l) { return ok(l.nom, l.editeur); }), autres = X.autres.filter(function (a) { return ok(a, ''); });
  return '<section class="carte lg-repart entre" aria-label="Qui utilise quoi">' +
    '<div class="tete"><div><h2>Qui utilise quoi</h2><p class="st">' + J.T('les logiciels officine, et le mode d’emploi de chacun', 'vos pharmacies, logiciel par logiciel · la part hachurée reste à renseigner') + '</p></div></div>' +
    '<div class="lg-stat" data-interne><div><span class="lib">Pharmacies au logiciel connu</span><div class="lg-grand num" id="lg-n">' + nf.format(X.connus) + '</div><p class="note">sur ' + nf.format(X.total) + ' pharmacies de votre secteur</p></div><div class="lg-ann">' + J.anneau(pct, 64) + '<b class="num">' + pct + ' %</b></div></div>' +
    '<div class="lg-pile" role="img" aria-label="Répartition des pharmacies par logiciel" data-interne>' + pile + '</div>' +
    '<div class="lg-lh"><span>Logiciel · éditeur</span><span data-interne>Pharmacies</span></div>' +
    (avec.length ? avec.map(function (l) { return rangee(l.s, l.nom, l.editeur, l.n, COUL[l.s], Math.round(l.n / max * 100)); }).join('') : '<p class="note lg-vide">Aucun logiciel ne répond à « ' + esc(G.qLog) + ' ».</p>') +
    (sans.length || autres.length ? '<h3 class="lg-sh" data-interne>Sans pharmacie pour l’instant</h3>' + sans.map(function (l) { return rangee(l.s, l.nom, l.editeur + ' · mode d’emploi prêt', null, COUL[l.s]); }).join('') + autres.map(function (a) { return rangee(cleAutre(a), a, 'mode d’emploi à écrire', null, null); }).join('') : '') +
    (ok('À compléter logiciel inconnu', '') ? '<div data-interne><h3 class="lg-sh">À compléter</h3>' + rangee('ac', 'Logiciel inconnu, à renseigner', 'saisie par l’équipe, depuis la fiche de l’officine', X.sans, null) + '</div>' : '') +
    (ok(X.pml.nom + ' commun', '') ? '<h3 class="lg-sh">Commun à tous les logiciels</h3>' + rangee('pml', X.pml.nom, 'le canal par lequel la pharmacie envoie ses commandes', null, null) : '') + '</section>';
}
/* ---------- zone de droite : le logiciel choisi (carte d'identité + onglets) ---------- */
function identite(it) {
  var pct = it.type === 'log' && X.total ? Math.round(it.n / X.total * 100) : 0;
  var meta = it.type === 'log' ? (it.n ? '<span class="etat" data-interne>' + J.ico('star', 'var(--e-bien)') + (it.rang === 1 ? '1er' : it.rang + 'e') + ' logiciel de votre secteur</span>' : '<span class="etat" data-interne>' + J.ico('user', 'var(--e-neutre)') + 'Sans pharmacie pour l’instant</span>') + (it.etapes.length ? '<span class="etat">' + J.ico('check', 'var(--e-bien)') + 'Mode d’emploi prêt</span>' : '<span class="etat">' + J.ico('edit', 'var(--e-attention)') + 'Mode d’emploi à écrire</span>')
    : it.type === 'ac' ? '<span class="etat">' + J.ico('edit', 'var(--e-attention)') + 'À renseigner par l’équipe</span>' : it.type === 'pml' ? '<span class="etat">' + J.ico('net', 'var(--e-neutre)') + 'Commun à tous les logiciels</span>' : '<span class="etat">' + J.ico('user', 'var(--e-neutre)') + 'Sans pharmacie pour l’instant</span>';
  var lignes = it.type === 'log' ? [['Éditeur', esc(it.editeur)], ['Part de votre secteur', it.n ? (etroit() ? nf.format(it.n) + ' pharmacies · ' + pct + ' %' : pct + ' % des pharmacies') : 'aucune pharmacie connue pour l’instant', 1], ['Mode d’emploi', it.etapes.length ? 'PDF prêt à envoyer · le pas-à-pas est ci-dessous' : 'à écrire'], ['Fichiers du catalogue', it.fichiers.length ? 'au format ' + esc(it.nom) + ' et en Excel' : 'à préparer'], ['Canal de commande', esc(X.pml.nom) + ', commun à tous les logiciels']]
    : it.type === 'ac' ? [['Pharmacies concernées', 'la part hachurée de la barre, à gauche'], ['Comment compléter', 'depuis la fiche de l’officine : Modifier, puis Logiciel'], ['Pourquoi', 'sans logiciel connu, pas de catalogue au bon format pour elle']]
    : it.type === 'pml' ? [['Rôle', esc(X.pml.s)], ['Pour qui', 'toutes les pharmacies, quel que soit leur logiciel'], ['Mode d’emploi', 'le pas-à-pas est ci-dessous']]
    : [['Pharmacies', 'aucune dans votre secteur pour l’instant'], ['Mode d’emploi', 'à écrire dès la première pharmacie']];
  var actions = it.type === 'log' ? '<div class="ronds lg-ronds">' + J.rond('send', 'Envoyer', STUB('Envoyer le mode d’emploi à une pharmacie')) + J.rond('down', 'Excel', STUB('Télécharger la liste des pharmacies en Excel'), 0, ' data-interne') + J.rond('bulb', 'Signaler', STUB('Signaler une étape à corriger')) + '</div>' +
      '<button class="pil plein" type="button" data-stub="' + STUB('Ouvrir le mode d’emploi ' + it.nom + ' (PDF)') + '">' + J.ico('doc') + 'Mode d’emploi ' + esc(it.nom) + '</button>' +
      '<button class="pil contour" type="button" data-stub="' + STUB('Préparer le catalogue au format ' + it.nom) + '">' + J.ico('box') + 'Catalogue au format ' + esc(it.nom) + '</button>'
    : it.type === 'ac' ? '<button class="pil plein" type="button" data-stub="' + STUB('Renseigner un logiciel') + '">' + J.ico('edit') + 'Renseigner un logiciel</button>'
    : it.type === 'pml' ? '<button class="pil plein" type="button" data-stub="' + STUB('Ouvrir le mode d’emploi PharmaML (PDF)') + '">' + J.ico('doc') + 'Mode d’emploi ' + esc(it.nom) + '</button>'
    : '<button class="pil contour" type="button" data-stub="' + STUB('Écrire le mode d’emploi') + '">' + J.ico('edit') + 'Écrire le mode d’emploi</button>';
  return J.identite({ classe: 'lg-ident', nom: esc(it.nom), meta: meta, lignes: lignes, actions: actions });
}
function onglets(it) {
  var offs = offsDe(it), T = [], pv = J.S.vue === 'pharmacien';
  if (it.type === 'log' || it.type === 'ac') T.push(['pharmacies', 'Vos officines', offs.length || '', 1]);
  if (it.etapes.length) T.push(['etapes', 'Pas-à-pas', it.etapes.length + ' étapes']);
  if (it.fichiers.length) T.push(['fichiers', 'Fichiers', it.fichiers.length]);
  if (it.type === 'log') T.push(['former', 'Se former', it.former || '']);
  var V = T.filter(function (t) { return !(t[3] && pv); });   // en vue pharmacien, l'onglet interne (masqué par la feuille de style commune) ne peut pas rester l'onglet ouvert
  if (!V.length) return '';
  if (!V.some(function (t) { return t[0] === G.onglet; })) G.onglet = V[0][0];
  return '<div class="seg lg-onglets" role="group" aria-label="Onglets du logiciel">' + T.map(function (t) { return '<button type="button" data-onglet="' + t[0] + '" aria-pressed="' + (G.onglet === t[0]) + '"' + (t[3] ? ' data-interne' : '') + '>' + t[1] + (t[2] !== '' ? ' <span class="cnt">' + t[2] + '</span>' : '') + '</button>'; }).join('') + '</div>';
}
function listePh(it) {
  var offs = offsDe(it), q = G.qph.toLowerCase(), l = offs.filter(function (o) { return !q || (o.nom + ' ' + o.ville + ' ' + o.cp).toLowerCase().indexOf(q) >= 0; });
  if (!l.length) return '<p class="note lg-vide">' + (offs.length ? 'Aucune pharmacie ne répond à « ' + esc(G.qph) + ' ».' : it.type === 'ac' ? 'Toutes vos officines ont un logiciel renseigné : les pharmacies à compléter sont ailleurs dans le secteur.' : 'Aucune de vos officines suivies n’utilise ce logiciel pour l’instant : les autres pharmacies du secteur sont comptées dans la liste des logiciels.') + '</p>';
  return '<div class="lg-phl">' + l.map(function (o) { return '<button type="button" class="lg-ph" data-off="' + o.id + '"><span class="lg-av" aria-hidden="true">' + esc(J.ini(o.nom)) + '</span><span class="lg-pht"><b>' + esc(J.joli(o.nom)) + '</b><span class="sub">' + esc(o.ville) + ' · ' + o.cp + (o.groupement !== 'Sans groupement' ? ' · ' + esc(o.groupement) : '') + '</span></span>' + J.etatHtml(J.etatOff(o)) + '<span class="ico chev">' + J.icoSvg('chev') + '</span></button>'; }).join('') + '</div><p class="note">Vos officines sur ce logiciel · un clic ouvre la fiche.</p>';
}
function panneau(it) {
  if (G.onglet === 'pharmacies') return '<label class="filtre lg-ph-q">' + J.ico('search') + '<input id="lg-qph" type="search" placeholder="Nom, ville, code postal…" aria-label="Rechercher une pharmacie de ce logiciel" value="' + esc(G.qph) + '" autocomplete="off"></label><div id="lg-phl">' + listePh(it) + '</div>';
  if (G.onglet === 'etapes') return '<ol class="lg-etapes">' + it.etapes.map(function (e, i) { return '<li class="lg-etape" style="--i:' + i + '"><span class="lg-num num">' + (i + 1) + '</span><span class="rond gris">' + J.ico(ICO_ET[i % ICO_ET.length]) + '</span><b>' + esc(e) + '</b></li>'; }).join('') + '</ol><p class="note">Les étapes d’import du catalogue Intégral dans ' + esc(it.nom) + ', dans l’ordre · chaque étape est illustrée dans le PDF du mode d’emploi.</p>';
  if (G.onglet === 'fichiers') return '<div class="lg-fich">' + it.fichiers.map(function (f) { return '<div class="lg-f"><span class="rond gris">' + J.ico('folder') + '</span><span class="lg-ft"><b>' + esc(f) + '</b><span class="sub">deux formats : celui de ' + esc(it.nom) + ', et Excel</span></span><span class="lg-fb"><button type="button" class="pil" data-stub="' + STUB('Télécharger « ' + f + ' » au format ' + it.nom) + '">' + J.ico('down') + 'Format ' + esc(it.nom) + '</button><button type="button" class="pil" data-stub="' + STUB('Télécharger « ' + f + ' » en Excel') + '">' + J.ico('table') + 'Excel</button></span></div>'; }).join('') + '</div><p class="note">Le catalogue Intégral à la taille voulue, prêt à importer.</p>';
  if (G.onglet === 'former') return it.former ? '<ul class="lg-ress">' + Array.apply(null, Array(it.former)).map(function (_, i) { var f = FORMER[i % FORMER.length], t = f[0].replace('{n}', it.nom); return '<li><span class="rond gris">' + J.ico(f[2]) + '</span><span class="lg-ft"><b>' + esc(t) + '</b><span class="sub">' + f[1] + '</span></span><button type="button" class="pil" data-stub="' + STUB('Ouvrir « ' + t + ' »') + '">Ouvrir</button></li>'; }).join('') + '</ul><p class="note">Les ressources de l’équipe pour ' + esc(it.nom) + '.</p>'
    : '<p class="note lg-vide">Aucune ressource pour se former à ' + esc(it.nom) + ' pour l’instant.</p><button type="button" class="chip" data-stub="' + STUB('Proposer une ressource') + '">' + J.ico('plus') + 'Proposer une ressource</button>';
  return '';
}
function droite(it) { var og = onglets(it); return identite(it) + (og ? og + '<section class="carte lg-panel"' + (G.onglet === 'pharmacies' ? ' data-interne' : '') + '>' + panneau(it) + '</section>' : it.type === 'autre' ? '<section class="carte lg-panel"><p class="note">Ce logiciel n’a encore ni pharmacie dans votre secteur ni mode d’emploi : la ligne existe pour qu’il ne soit pas oublié.</p></section>' : ''); }
function brancherOffs(r) { $$('[data-off]', r).forEach(function (b) { b.onclick = function () { if (J.ouvrirFiche) J.ouvrirFiche(b.getAttribute('data-off')); }; }); }
function brancherDroite(d) {
  $$('[data-onglet]', d).forEach(function (b) { b.onclick = function () { G.onglet = b.getAttribute('data-onglet'); rendreDroite(d); }; });
  var qp = $('#lg-qph', d); if (qp) qp.oninput = function (e) { G.qph = e.target.value; var box = $('#lg-phl', d); if (box) { box.innerHTML = listePh(item(G.sel)); J.poseIcones(box); brancherOffs(box); } };
  brancherOffs(d);
}
function degrader(d) { if (etroit() || !d) return; var h = $('.lg-ident h1', d); if (!h) return; var h2 = document.createElement('h2'); h2.innerHTML = h.innerHTML; h.parentNode.replaceChild(h2, h); }   // à côté du bandeau titré, la page garde un seul h1 (J.identite en pose toujours un)
function rendreDroite(d) { var it = item(G.sel) || item(X.logiciels[0].s); d.innerHTML = droite(it); degrader(d); J.poseIcones(d); brancherDroite(d); }
function brancherGauche(el) {
  $$('[data-lg]', el).forEach(function (b) { b.onclick = function () { G.sel = b.getAttribute('data-lg'); G.qph = ''; if (etroit()) { J.aller('lgo-detail'); return; }
    $$('[data-lg]', el).forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); rendreDroite($('#lg-droite', el)); }; });
}
J.ecrans.lgo = {
  rendre: function (el, etat) {
    var it = item(G.sel); if (!it) { G.sel = X.logiciels[0].s; it = item(G.sel); }
    var pe = etroit();
    if (etat.suite === 'detail' && pe) {
      el.innerHTML = '<div class="page">' + J.bandeau({ classe: 'lg-ban', deborde: true, eyebrow: 'Logiciel officine · ' + esc(it.nom) + ' · catalogue Intégral', recherche: '<div class="lg-outils"><button type="button" class="pil clair" data-action="retour">' + J.ico('back') + 'Logiciels</button></div>' }) +
        '<div class="sous-bandeau lg-droite" id="lg-droite">' + droite(it) + '</div></div>';
      window.scrollTo(0, 0); J.poseIcones(el); brancherDroite($('#lg-droite', el)); return;
    }
    el.innerHTML = '<div class="page">' + J.bandeau({ croix: true, eyebrow: 'Logiciels officine · <span data-interne>secteur de ' + esc(D.secteur.commerciale) + ' · </span>catalogue Intégral', titre: 'Logiciels officine',
      lede: 'Le <b>catalogue Intégral</b>, prêt à importer dans le logiciel de chaque pharmacie : le <b>mode d’emploi</b>, les fichiers à sa taille, et les pharmacies qui l’utilisent.',
      recherche: { id: 'lg-q', placeholder: 'Logiciel, éditeur, pharmacie…', aria: 'Rechercher un logiciel, un éditeur ou une pharmacie', valeur: G.q },
      bas: J.S.vue === 'pharmacien' ? '' : '<span class="lbl" data-interne>Compter :</span><div class="seg" role="group" aria-label="Périmètre" data-interne><button type="button" aria-pressed="true">Mes pharmacies</button><button type="button" aria-pressed="false" data-stub="Le réseau entier n’est pas dessiné dans cette maquette : seules vos pharmacies sont comptées.">Tout le réseau</button></div>' }) +
      '<div class="lg-deux"><div class="lg-gauche" id="lg-gauche">' + gauche() + '</div>' + (pe ? '' : '<div class="lg-droite" id="lg-droite">' + droite(it) + '</div>') + '</div></div>';
    if (!pe) degrader($('#lg-droite', el)); J.poseIcones(el); brancherGauche(el); if (!pe) brancherDroite($('#lg-droite', el));
    $('#lg-q', el).oninput = function (e) {
      G.q = e.target.value; var q = G.q.toLowerCase(), logs = X.logiciels.filter(function (l) { return (l.nom + ' ' + l.editeur).toLowerCase().indexOf(q) >= 0; });
      var hit = q.length >= 3 && !logs.length ? J.OFF.filter(function (o) { return (o.nom + ' ' + o.ville).toLowerCase().indexOf(q) >= 0; })[0] : null;
      G.qLog = hit ? '' : G.q;
      if (hit) { var ln = J.ficheDe(hit.id).identite.logiciel, L = X.logiciels.filter(function (l) { return l.nom === ln; })[0]; if (L) { G.sel = L.s; G.onglet = 'pharmacies'; G.qph = G.q; if (!etroit()) rendreDroite($('#lg-droite', el)); } }
      var g = $('#lg-gauche', el); g.innerHTML = gauche(); J.poseIcones(g); brancherGauche(el);
    };
  }
};
var etait = etroit(), tm = null;
window.addEventListener('resize', function () { clearTimeout(tm); tm = setTimeout(function () { var e = etroit(); if (e !== etait) { etait = e; if (J.courant.ecran === 'lgo') J.route(); } }, 200); });
})();
