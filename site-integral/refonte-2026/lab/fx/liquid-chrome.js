// liquid-chrome.js — vanilla port of ReactBits "LiquidChrome" (OGL + GLSL)
// Self-contained ES module. Only external dependency: the vendored OGL build.
// Original shader math is preserved; the single baseColor is extended into a
// brand palette gradient (blue -> ink -> orange) via opts.colors.
import { Renderer, Program, Mesh, Triangle } from '../../../vendor/ogl/ogl.mjs';

// --- helpers ---------------------------------------------------------------
function hexToRGB(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const int = parseInt(h, 16);
  if (!isFinite(int)) return [0.1, 0.1, 0.1];
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

// Always produce exactly 3 stops (pad by repeating the last color).
function toThreeStops(colors) {
  const arr = (Array.isArray(colors) && colors.length ? colors : ['#0057FF', '#0a1830', '#F39A1B'])
    .map(hexToRGB);
  while (arr.length < 3) arr.push(arr[arr.length - 1]);
  return arr.slice(0, 3);
}

const VERTEX = `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// Core flow math kept identical to the source; uBaseColor replaced by a
// 3-stop palette (uColorA/B/C) blended along the flowing coordinate.
const FRAGMENT = `
  precision highp float;
  uniform float uTime;
  uniform vec3 uResolution;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uAmplitude;
  uniform float uFrequencyX;
  uniform float uFrequencyY;
  uniform vec2 uMouse;
  varying vec2 vUv;

  vec3 palette(float t) {
    t = clamp(t, 0.0, 1.0);
    return t < 0.5
      ? mix(uColorA, uColorB, t * 2.0)
      : mix(uColorB, uColorC, (t - 0.5) * 2.0);
  }

  vec4 renderImage(vec2 uvCoord) {
      vec2 fragCoord = uvCoord * uResolution.xy;
      vec2 uv = (2.0 * fragCoord - uResolution.xy) / min(uResolution.x, uResolution.y);

      for (float i = 1.0; i < 10.0; i++){
          uv.x += uAmplitude / i * cos(i * uFrequencyX * uv.y + uTime + uMouse.x * 3.14159);
          uv.y += uAmplitude / i * cos(i * uFrequencyY * uv.x + uTime + uMouse.y * 3.14159);
      }

      vec2 diff = (uvCoord - uMouse);
      float dist = length(diff);
      float falloff = exp(-dist * 20.0);
      float ripple = sin(10.0 * dist - uTime * 2.0) * 0.03;
      uv += (diff / (dist + 0.0001)) * ripple * falloff;

      float t = 0.5 + 0.5 * sin(uTime - uv.y - uv.x);
      vec3 baseColor = palette(t);
      vec3 color = baseColor / abs(sin(uTime - uv.y - uv.x));
      return vec4(color, 1.0);
  }

  void main() {
      vec4 col = vec4(0.0);
      int samples = 0;
      for (int i = -1; i <= 1; i++){
          for (int j = -1; j <= 1; j++){
              vec2 offset = vec2(float(i), float(j)) * (1.0 / min(uResolution.x, uResolution.y));
              col += renderImage(vUv + offset);
              samples++;
          }
      }
      gl_FragColor = col / float(samples);
  }
`;

/**
 * Mount the liquid-chrome background inside `container`.
 * @param {HTMLElement} container
 * @param {Object} [opts]
 * @param {string[]} [opts.colors]     hex tints (default brand blue->ink->orange)
 * @param {number}   [opts.speed]      time multiplier (default 0.2)
 * @param {number}   [opts.amplitude]  flow amplitude (default 0.3)
 * @param {number}   [opts.frequencyX]
 * @param {number}   [opts.frequencyY]
 * @param {boolean}  [opts.interactive] mouse/touch ripple (default true)
 * @returns {{ destroy: () => void }}
 */
export function init(container, opts = {}) {
  if (!container) return { destroy() {} };

  const speed = opts.speed != null ? opts.speed : 0.2;
  const amplitude = opts.amplitude != null ? opts.amplitude : 0.3;
  const frequencyX = opts.frequencyX != null ? opts.frequencyX : 3;
  const frequencyY = opts.frequencyY != null ? opts.frequencyY : 3;
  const interactive = opts.interactive !== false;
  const stops = toThreeStops(opts.colors);

  const reducedMotion =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Cap DPR for Safari stability / perf.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  const renderer = new Renderer({ antialias: true, dpr, alpha: false });
  const gl = renderer.gl;
  gl.clearColor(0, 0, 0, 1);

  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.inset = '0';

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex: VERTEX,
    fragment: FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uResolution: {
        value: new Float32Array([
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height,
        ]),
      },
      uColorA: { value: new Float32Array(stops[0]) },
      uColorB: { value: new Float32Array(stops[1]) },
      uColorC: { value: new Float32Array(stops[2]) },
      uAmplitude: { value: amplitude },
      uFrequencyX: { value: frequencyX },
      uFrequencyY: { value: frequencyY },
      uMouse: { value: new Float32Array([0, 0]) },
    },
  });
  const mesh = new Mesh(gl, { geometry, program });

  container.appendChild(canvas);

  // --- sizing --------------------------------------------------------------
  function resize() {
    const w = container.offsetWidth || container.clientWidth || 1;
    const h = container.offsetHeight || container.clientHeight || 1;
    renderer.setSize(w, h);
    const res = program.uniforms.uResolution.value;
    res[0] = gl.canvas.width;
    res[1] = gl.canvas.height;
    res[2] = gl.canvas.width / gl.canvas.height;
  }
  resize();

  function renderFrame() {
    renderer.render({ scene: mesh });
  }

  // --- animation loop with pause conditions --------------------------------
  let rafId = null;
  let running = false;
  let visible = true;
  let startTime = null;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (startTime == null) startTime = now;
    program.uniforms.uTime.value = (now - startTime) * 0.001 * speed;
    renderFrame();
  }

  function start() {
    if (running || reducedMotion) return;
    if (document.hidden || !visible) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // --- listeners -----------------------------------------------------------
  let resizeTimer = null;
  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (reducedMotion || !running) renderFrame(); // keep a fresh static frame
    }, 150);
  }
  window.addEventListener('resize', onResize);

  function onVisibility() {
    if (document.hidden) stop();
    else start();
  }
  document.addEventListener('visibilitychange', onVisibility);

  let io = null;
  if (typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible = e.isIntersecting;
        if (visible) start();
        else stop();
      },
      { threshold: 0 }
    );
    io.observe(container);
  }

  function updateMouse(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (clientX - rect.left) / rect.width;
    const y = 1 - (clientY - rect.top) / rect.height;
    const m = program.uniforms.uMouse.value;
    m[0] = x;
    m[1] = y;
    if (reducedMotion) renderFrame(); // reflect ripple even without loop
  }
  function onMouseMove(e) {
    updateMouse(e.clientX, e.clientY);
  }
  function onTouchMove(e) {
    if (e.touches && e.touches.length > 0) {
      updateMouse(e.touches[0].clientX, e.touches[0].clientY);
    }
  }
  if (interactive) {
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('touchmove', onTouchMove, { passive: true });
  }

  // --- initial paint -------------------------------------------------------
  if (reducedMotion) {
    program.uniforms.uTime.value = 0.35; // pleasant static phase
    renderFrame();
  } else {
    start();
  }

  // --- teardown ------------------------------------------------------------
  return {
    destroy() {
      stop();
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (io) io.disconnect();
      if (interactive) {
        container.removeEventListener('mousemove', onMouseMove);
        container.removeEventListener('touchmove', onTouchMove);
      }
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    },
  };
}

export default init;
