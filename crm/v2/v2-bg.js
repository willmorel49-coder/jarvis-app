/* ═══════════════════════════════════════════════════════════════════
   CRM V2 · Fond WebGL interactif de l'ACCUEIL (aurora clair Intégral)
   Shader fbm léger (WebGL brut, sans dépendance), réactif à la souris.
   Garde-fous : prefers-reduced-motion + petits écrans + pas de WebGL →
   repli CSS statique. Monté uniquement sur l'accueil, s'auto-nettoie en
   quittant la page ou quand l'onglet est masqué. 100% client, zéro coût.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var V2 = window.V2 = window.V2 || {};
  var canvas = null, gl = null, raf = null, U = {}, t0 = 0, tLast = 0;
  var mx = 0.5, my = 0.55, tmx = 0.5, tmy = 0.55;
  var FRAME_MS = 1000 / 40;   // cap ~40 fps : fond lent, économise le GPU (shader warp plus lourd)
  var REDUCED = false;
  try { REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var FRAG = [
    'precision highp float;',
    'uniform float uT; uniform vec2 uR; uniform vec2 uM;',
    // hash + valeur-noise interpolé cubiquement
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}',
    // fbm 5 octaves + rotation par octave (casse l\'alignement en grille → flow plus organique)
    'float fbm(vec2 p){float v=0.0,a=0.55; mat2 r=mat2(0.80,0.60,-0.60,0.80);',
    ' for(int i=0;i<5;i++){v+=a*noise(p);p=r*p*1.92+vec2(1.7,9.2);a*=0.52;}return v;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uR.xy; vec2 p=uv; p.x*=uR.x/uR.y;',
    ' float t=uT*0.035; vec2 m=(uM-0.5);',
    // ── domain warping en cascade (2 niveaux) : q déforme r qui déforme le champ final ──
    ' vec2 q=vec2(fbm(p*1.25+vec2(0.0,t)+m*0.30), fbm(p*1.25+vec2(5.2,-t*0.8)));',
    ' vec2 r=vec2(fbm(p*1.6+1.7*q+vec2(1.7,9.2)+0.15*t), fbm(p*1.6+1.7*q+vec2(8.3,2.8)-0.12*t));',
    ' float f=fbm(p*1.5+2.4*r+0.6*t);',                 // nappe principale (flow noise)
    ' float o=fbm(p*1.15-0.5*t+1.3*r+q);',              // nappe orange, plus lente/large
    ' float warp=length(r);',                            // intensité du warp → rehausse les crêtes
    // ── palette claire premium ──
    ' vec3 base=vec3(0.984,0.988,0.996);',              // #FBFCFE
    ' vec3 blue=vec3(0.0,0.314,0.902);',               // #0050E6
    ' vec3 blueDeep=vec3(0.0,0.24,0.62);',             // teinte profonde pour le cœur des nappes
    ' vec3 orange=vec3(0.953,0.604,0.106);',           // #F39A1B
    ' vec3 col=base;',
    // nappe bleue principale (deux passes → variation de teinte selon le warp = profondeur)
    ' float mB=smoothstep(0.40,0.92,f+0.18*warp);',
    ' col=mix(col,blue,mB*0.16);',
    ' col=mix(col,blueDeep,smoothstep(0.62,1.0,f)*mB*0.07);',
    // nappe orange, apparaît surtout là où le bleu recule (complémentarité douce)
    ' float mO=smoothstep(0.55,1.0,o)*(1.0-mB*0.6);',
    ' col=mix(col,orange,mO*0.085);',
    // liseré lumineux sur les crêtes du warp → effet soyeux / iridescent très léger
    ' float rim=smoothstep(0.75,1.0,warp);',
    ' col+=blue*rim*0.03;',
    // halo bleu doux qui suit la souris (interactivité subtile)
    ' float d=distance(uv,uM); col=mix(col,blue,smoothstep(0.34,0.0,d)*0.05);',
    // léger vignettage clair pour recentrer le regard sur le contenu',
    ' float vig=smoothstep(1.25,0.35,length(uv-0.5)); col=mix(base,col,0.55+0.45*vig);',
    // grain film discret (anti-banding sur les dégradés)',
    ' float g=hash(gl_FragCoord.xy+fract(uT))-0.5; col+=g*0.012;',
    ' gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');
  var VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';

  function webglOK() { try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } }

  // ── repli CSS statique (mobile / reduced / pas de WebGL) ──
  function cssFallback() {
    if (document.getElementById('v2-bg-css')) return;
    var d = document.createElement('div'); d.id = 'v2-bg-css';
    d.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;background:' +
      'radial-gradient(45% 40% at 18% 12%,rgba(0,80,230,.07),transparent 60%),' +
      'radial-gradient(40% 38% at 85% 22%,rgba(243,154,27,.055),transparent 60%),' +
      'radial-gradient(50% 45% at 60% 100%,rgba(0,80,230,.05),transparent 60%),var(--paper,#FBFCFE)';
    document.body.insertBefore(d, document.body.firstChild);
  }

  function compile(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  function resize() {
    if (!canvas || !gl) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    var w = Math.floor(window.innerWidth * dpr), h = Math.floor(window.innerHeight * dpr);
    canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h);
    if (U.uR) gl.uniform2f(U.uR, w, h);
  }
  function onMove(e) { tmx = e.clientX / window.innerWidth; tmy = 1 - e.clientY / window.innerHeight; }
  function cleanup() {
    if (raf) cancelAnimationFrame(raf); raf = null;
    window.removeEventListener('mousemove', onMove); window.removeEventListener('resize', resize);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; gl = null; U = {};
  }
  function loop() {
    if (!V2.route || V2.route.name !== 'home') { cleanup(); return; }   // s'arrête en quittant l'accueil
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;                                          // pause si onglet masqué
    var now = performance.now();
    if (now - tLast < FRAME_MS) return;                                   // cap FPS
    tLast = now;
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    gl.uniform1f(U.uT, (now - t0) / 1000);
    gl.uniform2f(U.uM, mx, my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  V2.mountHomeBg = function (root) {
    // le contenu de l'accueil passe au-dessus du fond
    var wrap = root && root.querySelector('.v2-wrap'); if (wrap) { wrap.style.position = 'relative'; wrap.style.zIndex = '1'; }
    // garde-fous → repli CSS
    if (REDUCED || window.innerWidth < 640 || !webglOK()) { cssFallback(); return; }
    var old = document.getElementById('v2-bg-css'); if (old) old.remove();
    if (document.getElementById('v2-bg')) return;   // déjà monté
    canvas = document.createElement('canvas'); canvas.id = 'v2-bg'; canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block';
    document.body.insertBefore(canvas, document.body.firstChild);
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' })
      || canvas.getContext('experimental-webgl');
    if (!gl) { canvas.remove(); canvas = null; cssFallback(); return; }
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { cleanup(); cssFallback(); return; }
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    U.uT = gl.getUniformLocation(prog, 'uT'); U.uR = gl.getUniformLocation(prog, 'uR'); U.uM = gl.getUniformLocation(prog, 'uM');
    resize();
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('resize', resize);
    t0 = performance.now(); tLast = 0;
    loop();
  };

  function hideIfNotHome() {
    if (V2.route && V2.route.name !== 'home') {
      cleanup();
      var f = document.getElementById('v2-bg-css'); if (f) f.remove();
    }
  }

  // Monkey-patch : monte le fond après le rendu de l'accueil (sans toucher v2-app.js)
  function hook() {
    if (!V2.pages || !V2.pages.home || V2.pages.home._bgHooked) return false;
    var orig = V2.pages.home.render;
    V2.pages.home.render = function (root) { orig.call(this, root); try { V2.mountHomeBg(root); } catch (e) {} };
    V2.pages.home._bgHooked = true;
    // retire le fond quand on quitte l'accueil (WebGL ET repli CSS)
    if (V2.render && !V2.render._bgWrapped) {
      var r = V2.render;
      V2.render = function () { r.apply(this, arguments); try { hideIfNotHome(); } catch (e) {} };
      V2.render._bgWrapped = true;
    }
    return true;
  }
  if (!hook()) { var n = 0, iv = setInterval(function () { if (hook() || ++n > 40) clearInterval(iv); }, 100); }
})();
