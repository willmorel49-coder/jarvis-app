// Iridescence — self-contained vanilla port of the ReactBits "Iridescence" WebGL background.
// Original: OGL + GLSL (ogl@^1.0.11). Rewritten for the Intégral Pharma preset picker.
// Only external dependency is the vendored ogl.mjs. No other resource, no console noise.

import { Renderer, Program, Mesh, Triangle } from '../../../vendor/ogl/ogl.mjs';

// ---- Shaders (GLSL preserved verbatim from the source component) --------------

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

uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;

varying vec2 vUv;

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

  uv += (uMouse - vec2(0.5)) * uAmplitude;

  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5 * uSpeed;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---- Helpers ------------------------------------------------------------------

// Accepts a base tint as [r,g,b] in 0..1, or a "#rrggbb" hex string, and returns
// a Float32Array [r,g,b]. Default leans IP blue (#0057FF) while keeping enough
// warmth in the red/green channels for the shader's orange (#F39A1B) highlights.
function toRGB(color) {
  if (typeof color === 'string') {
    let hex = color.trim().replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16);
    if (hex.length === 6 && !Number.isNaN(n)) {
      return new Float32Array([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
    }
  }
  if (Array.isArray(color) && color.length >= 3) {
    return new Float32Array([+color[0] || 0, +color[1] || 0, +color[2] || 0]);
  }
  // Brand default: cool blue base that still passes some warmth through the multiply.
  return new Float32Array([0.42, 0.60, 1.0]);
}

// ---- Public API ---------------------------------------------------------------

export function init(container, opts = {}) {
  if (!container) return { destroy() {} };

  const color = toRGB(opts.color);
  const speed = opts.speed != null ? +opts.speed : 1.0;
  const amplitude = opts.amplitude != null ? +opts.amplitude : 0.1;
  const mouseReact = opts.mouseReact !== false;

  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // DPR capped at 1.5 keeps Safari from choking on retina fill-rate.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  const renderer = new Renderer({ dpr, alpha: false });
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
      uTime: { value: 0 },
      uColor: { value: color },
      uResolution: { value: new Float32Array([1, 1, 1]) },
      uMouse: { value: new Float32Array([0.5, 0.5]) },
      uAmplitude: { value: amplitude },
      uSpeed: { value: speed },
    },
  });
  const mesh = new Mesh(gl, { geometry, program });

  const mouse = { x: 0.5, y: 0.5 };

  function resize() {
    const w = container.clientWidth || container.offsetWidth || 1;
    const h = container.clientHeight || container.offsetHeight || 1;
    renderer.setSize(w, h);
    const cw = gl.canvas.width;
    const ch = gl.canvas.height;
    const res = program.uniforms.uResolution.value;
    res[0] = cw;
    res[1] = ch;
    res[2] = ch !== 0 ? cw / ch : 1;
  }

  function renderFrame(tMs) {
    program.uniforms.uTime.value = tMs * 0.001;
    renderer.render({ scene: mesh });
  }

  // ---- Animation loop with visibility / intersection gating ------------------

  let rafId = 0;
  let running = false;
  let inView = true;
  let pageVisible = document.visibilityState !== 'hidden';
  let startTime = 0;

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    if (!startTime) startTime = now;
    renderFrame(now - startTime);
  }

  function start() {
    if (running || reduceMotion) return;
    if (!inView || !pageVisible) return;
    running = true;
    startTime = 0;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ---- Mouse ----------------------------------------------------------------

  function onMouseMove(e) {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    mouse.x = x;
    mouse.y = y;
    program.uniforms.uMouse.value[0] = x;
    program.uniforms.uMouse.value[1] = y;
    // Nudge a static frame so reduced-motion users still see mouse response.
    if (reduceMotion && !running) renderFrame(performance.now());
  }

  // ---- Debounced resize -----------------------------------------------------

  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (reduceMotion || !running) renderFrame(performance.now());
    }, 150);
  }

  // ---- Visibility (tab) -----------------------------------------------------

  function onVisibility() {
    pageVisible = document.visibilityState !== 'hidden';
    if (pageVisible) start();
    else stop();
  }

  // ---- IntersectionObserver (offscreen) -------------------------------------

  let io = null;
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(
      (entries) => {
        inView = entries.some((en) => en.isIntersecting);
        if (inView) start();
        else stop();
      },
      { threshold: 0 }
    );
    io.observe(container);
  }

  // ---- Wire up --------------------------------------------------------------

  container.appendChild(canvas);
  resize();

  window.addEventListener('resize', onResize, false);
  document.addEventListener('visibilitychange', onVisibility, false);
  if (mouseReact) container.addEventListener('mousemove', onMouseMove);

  if (reduceMotion) {
    // One static, representative frame — no loop.
    renderFrame(1600);
  } else {
    start();
  }

  // ---- Teardown -------------------------------------------------------------

  function destroy() {
    stop();
    clearTimeout(resizeTimer);
    window.removeEventListener('resize', onResize, false);
    document.removeEventListener('visibilitychange', onVisibility, false);
    if (mouseReact) container.removeEventListener('mousemove', onMouseMove);
    if (io) {
      io.disconnect();
      io = null;
    }
    if (canvas.parentNode === container) container.removeChild(canvas);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }

  return { destroy };
}
