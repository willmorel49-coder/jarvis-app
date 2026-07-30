// balatro.js — self-contained vanilla ES module port of the ReactBits "Balatro"
// OGL/GLSL plasma swirl. Recolored toward Intégral Pharma brand:
//   IP blue #0057FF + orange #F39A1B on a deep base.
// Only dependency: vendored ogl.mjs. No build step, no server, no console noise.
//
// Usage:
//   import { init } from './fx/balatro.js';
//   const fx = init(containerEl, { speed: 6, spinSpeed: 5 });
//   // ...later
//   fx.destroy();

import { Renderer, Program, Mesh, Triangle } from '../../../vendor/ogl/ogl.mjs';

// --- Brand palette (mapped to the shader's 3 color uniforms) -----------------
// color1 = dominant swirl, color2 = secondary swirl, color3 = deep base.
const BRAND = {
  color1: '#0057FF', // IP blue
  color2: '#F39A1B', // IP orange
  color3: '#0A1226'  // deep navy base
};

// --- GLSL (verbatim from source, unchanged) ----------------------------------
const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

#define PI 3.14159265359

uniform float iTime;
uniform vec3 iResolution;
uniform float uSpinRotation;
uniform float uSpinSpeed;
uniform vec2 uOffset;
uniform vec4 uColor1;
uniform vec4 uColor2;
uniform vec4 uColor3;
uniform float uContrast;
uniform float uLighting;
uniform float uSpinAmount;
uniform float uPixelFilter;
uniform float uSpinEase;
uniform bool uIsRotate;
uniform vec2 uMouse;

varying vec2 vUv;

vec4 effect(vec2 screenSize, vec2 screen_coords) {
    float pixel_size = length(screenSize.xy) / uPixelFilter;
    vec2 uv = (floor(screen_coords.xy * (1.0 / pixel_size)) * pixel_size - 0.5 * screenSize.xy) / length(screenSize.xy) - uOffset;
    float uv_len = length(uv);

    float speed = (uSpinRotation * uSpinEase * 0.2);
    if(uIsRotate){
       speed = iTime * speed;
    }
    speed += 302.2;

    float mouseInfluence = (uMouse.x * 2.0 - 1.0);
    speed += mouseInfluence * 0.1;

    float new_pixel_angle = atan(uv.y, uv.x) + speed - uSpinEase * 20.0 * (uSpinAmount * uv_len + (1.0 - uSpinAmount));
    vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0;
    uv = (vec2(uv_len * cos(new_pixel_angle) + mid.x, uv_len * sin(new_pixel_angle) + mid.y) - mid);

    uv *= 30.0;
    float baseSpeed = iTime * uSpinSpeed;
    speed = baseSpeed + mouseInfluence * 2.0;

    vec2 uv2 = vec2(uv.x + uv.y);

    for(int i = 0; i < 5; i++) {
        uv2 += sin(max(uv.x, uv.y)) + uv;
        uv += 0.5 * vec2(
            cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121),
            sin(uv2.x - 0.113 * speed)
        );
        uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
    }

    float contrast_mod = (0.25 * uContrast + 0.5 * uSpinAmount + 1.2);
    float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
    float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
    float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
    float c3p = 1.0 - min(1.0, c1p + c2p);
    float light = (uLighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + uLighting * max(c2p * 5.0 - 4.0, 0.0);

    return (0.3 / uContrast) * uColor1 + (1.0 - 0.3 / uContrast) * (uColor1 * c1p + uColor2 * c2p + vec4(c3p * uColor3.rgb, c3p * uColor1.a)) + light;
}

void main() {
    vec2 uv = vUv * iResolution.xy;
    gl_FragColor = effect(iResolution.xy, uv);
}
`;

// --- helpers -----------------------------------------------------------------
function hexToVec4(hex) {
  let s = String(hex).replace('#', '');
  let r = 0, g = 0, b = 0, a = 1;
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (s.length === 6 || s.length === 8) {
    r = parseInt(s.slice(0, 2), 16) / 255;
    g = parseInt(s.slice(2, 4), 16) / 255;
    b = parseInt(s.slice(4, 6), 16) / 255;
    if (s.length === 8) a = parseInt(s.slice(6, 8), 16) / 255;
  }
  return [r, g, b, a];
}

/**
 * Mount the Balatro plasma into `container` (fills it completely).
 * @param {HTMLElement} container
 * @param {Object} [opts]
 * @param {{color1?:string,color2?:string,color3?:string}} [opts.colors]  brand hex overrides
 * @param {number} [opts.speed]      plasma flow speed (uSpinSpeed), default 6
 * @param {number} [opts.spinSpeed]  swirl rotation speed (uSpinRotation), default -2
 * @param {number} [opts.spinRotation] alias for spinSpeed
 * @param {boolean} [opts.mouseInteraction] default true
 * @returns {{destroy: () => void}}
 */
export function init(container, opts = {}) {
  if (!container) throw new Error('balatro: container is required');

  const colors = Object.assign({}, BRAND, opts.colors || {});
  const spinSpeed = opts.speed != null ? opts.speed : 6.0;
  const spinRotation = opts.spinSpeed != null ? opts.spinSpeed
                     : (opts.spinRotation != null ? opts.spinRotation : -2.0);
  const mouseInteraction = opts.mouseInteraction !== false;

  const reduceMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // DPR capped at 1.5 for Safari GPU safety.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  const renderer = new Renderer({ dpr, alpha: false, antialias: false });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 1);

  const canvas = gl.canvas;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: [1, 1, 1] },
      uSpinRotation: { value: spinRotation },
      uSpinSpeed: { value: spinSpeed },
      uOffset: { value: opts.offset || [0.0, 0.0] },
      uColor1: { value: hexToVec4(colors.color1) },
      uColor2: { value: hexToVec4(colors.color2) },
      uColor3: { value: hexToVec4(colors.color3) },
      uContrast: { value: opts.contrast != null ? opts.contrast : 3.5 },
      uLighting: { value: opts.lighting != null ? opts.lighting : 0.4 },
      uSpinAmount: { value: opts.spinAmount != null ? opts.spinAmount : 0.25 },
      uPixelFilter: { value: opts.pixelFilter != null ? opts.pixelFilter : 745.0 },
      uSpinEase: { value: 1.0 },
      uIsRotate: { value: !!opts.isRotate },
      uMouse: { value: [0.5, 0.5] }
    }
  });

  const mesh = new Mesh(gl, { geometry, program });
  container.appendChild(canvas);

  // --- sizing ---------------------------------------------------------------
  function resize() {
    const w = container.clientWidth || container.offsetWidth || 1;
    const h = container.clientHeight || container.offsetHeight || 1;
    renderer.setSize(w, h);
    program.uniforms.iResolution.value = [
      gl.canvas.width,
      gl.canvas.height,
      gl.canvas.width / gl.canvas.height
    ];
    if (paused) renderer.render({ scene: mesh });
  }

  // --- render loop ----------------------------------------------------------
  let rafId = 0;
  let paused = true;      // start paused; observers/visibility flip it on
  let running = false;
  let startTime = 0;
  let elapsed = 0;        // accumulated seconds, survives pause/resume

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    elapsed = (now - startTime) * 0.001;
    program.uniforms.iTime.value = elapsed;
    renderer.render({ scene: mesh });
  }

  function play() {
    if (running || reduceMotion) return;
    running = true;
    paused = false;
    startTime = performance.now() - elapsed * 1000;
    rafId = requestAnimationFrame(frame);
  }

  function pause() {
    if (!running) return;
    running = false;
    paused = true;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // --- visibility / viewport gating ----------------------------------------
  let inView = true;
  let docVisible = !document.hidden;

  function evaluate() {
    if (reduceMotion) return;
    if (inView && docVisible) play();
    else pause();
  }

  let io = null;
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver((entries) => {
      inView = entries.some((e) => e.isIntersecting);
      evaluate();
    }, { threshold: 0 });
    io.observe(container);
  }

  function onVisibility() {
    docVisible = !document.hidden;
    evaluate();
  }
  document.addEventListener('visibilitychange', onVisibility);

  // --- debounced resize -----------------------------------------------------
  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  }
  window.addEventListener('resize', onResize);

  let ro = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => onResize());
    ro.observe(container);
  }

  // --- mouse ----------------------------------------------------------------
  function onMouseMove(e) {
    if (!mouseInteraction) return;
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    program.uniforms.uMouse.value = [x, y];
  }
  if (mouseInteraction) container.addEventListener('mousemove', onMouseMove);

  // --- boot -----------------------------------------------------------------
  resize();
  if (reduceMotion) {
    // Static single frame, no animation.
    program.uniforms.iTime.value = 8.0; // arbitrary pleasant offset
    renderer.render({ scene: mesh });
  } else {
    evaluate();
  }

  // --- teardown -------------------------------------------------------------
  let destroyed = false;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    pause();
    clearTimeout(resizeTimer);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    if (mouseInteraction) container.removeEventListener('mousemove', onMouseMove);
    if (io) { io.disconnect(); io = null; }
    if (ro) { ro.disconnect(); ro = null; }
    if (canvas.parentNode === container) container.removeChild(canvas);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }

  return { destroy };
}

export default { init };
