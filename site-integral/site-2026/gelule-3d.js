/* La gélule du logo en 3D, dans l'ouverture : moitié orange, moitié argent.
   Elle tourne doucement, suit la souris, et pivote avec le défilement.
   Figée en mouvement réduit, en pause hors écran. Three.js r128 (cdnjs). */
(function () {
  var toile = document.getElementById("gelule3d");
  if (!toile || !window.THREE) return;
  var T = window.THREE;
  var calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var rendu;
  try { rendu = new T.WebGLRenderer({ canvas: toile, antialias: true, alpha: true }); }
  catch (e) { toile.style.display = "none"; return; }
  rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rendu.outputEncoding = T.sRGBEncoding;

  var scene = new T.Scene();
  var cam = new T.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 0, 9);

  // Profil d'une demi-gélule : cylindre + dôme, tourné autour de l'axe Y.
  var R = 0.72, L = 1.05, pts = [];
  pts.push(new T.Vector2(0.0001, 0));
  pts.push(new T.Vector2(R, 0));
  pts.push(new T.Vector2(R, L));
  for (var i = 1; i <= 24; i++) {
    var a = (i / 24) * Math.PI / 2;
    pts.push(new T.Vector2(Math.max(R * Math.cos(a), 0.0001), L + R * Math.sin(a)));
  }
  var forme = new T.LatheGeometry(pts, 96);

  var orange = new T.MeshPhysicalMaterial({ color: 0xF39A1B, roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12 });
  var argent = new T.MeshPhysicalMaterial({ color: 0xE3E8EF, roughness: 0.22, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08 });

  orange.color.convertSRGBToLinear(); argent.color.convertSRGBToLinear();
  var gelule = new T.Group();
  var haut = new T.Mesh(forme, argent);
  var bas = new T.Mesh(forme, orange); bas.rotation.x = Math.PI;
  // la jointure : un anneau à peine plus large, comme sur une vraie gélule
  var bague = new T.Mesh(new T.CylinderGeometry(R * 1.012, R * 1.012, 0.06, 96, 1, true), argent);
  gelule.add(haut, bas, bague);
  gelule.rotation.z = -0.72;
  scene.add(gelule);

  // Lumière : une clé chaude en haut à gauche, un contre-jour bleu, un fond doux.
  scene.add(new T.HemisphereLight(0xffffff, 0x1b2a4a, 0.55));
  var cle = new T.DirectionalLight(0xfff1dc, 1.6); cle.position.set(-3, 4, 5); scene.add(cle);
  var contre = new T.DirectionalLight(0x6f9cff, 1.1); contre.position.set(4, -1, -3); scene.add(contre);
  var eclat = new T.PointLight(0xffffff, 0.9, 20); eclat.position.set(2, 2, 4); scene.add(eclat);

  function taille() {
    var w = toile.clientWidth, h = toile.clientHeight;
    if (!w || !h) return;
    rendu.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  taille();
  window.addEventListener("resize", taille);

  var visee = { x: 0, y: 0 }, lisse = { x: 0, y: 0 };
  if (window.matchMedia("(hover:hover)").matches) {
    window.addEventListener("mousemove", function (e) {
      visee.x = (e.clientX / window.innerWidth - 0.5);
      visee.y = (e.clientY / window.innerHeight - 0.5);
    }, { passive: true });
  }

  var visible = true, t0 = performance.now();
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !calme) boucle(); }).observe(toile);
  }

  function dessine(t) {
    var s = Math.min(window.scrollY / window.innerHeight, 1.2);
    lisse.x += (visee.x - lisse.x) * 0.06;
    lisse.y += (visee.y - lisse.y) * 0.06;
    gelule.rotation.y = t * 0.00035 + s * 2.4 + lisse.x * 0.8;
    gelule.rotation.x = 0.25 + lisse.y * 0.5 + s * 0.4;
    gelule.position.y = Math.sin(t * 0.0011) * 0.12 - s * 0.6;
    rendu.render(scene, cam);
  }
  var enCours = false;
  function boucle() {
    if (enCours) return; enCours = true;
    (function f() {
      if (!visible) { enCours = false; return; }
      dessine(performance.now() - t0);
      requestAnimationFrame(f);
    })();
  }
  if (calme) { dessine(1800); window.addEventListener("resize", function () { dessine(1800); }); }
  else boucle();
})();
