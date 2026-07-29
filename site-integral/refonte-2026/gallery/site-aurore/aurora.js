/* ============================================================================
   Aurore IP — vendored, self-contained WebGL2 aurora background.
   Adapted from the open-source "react-bits" Aurora (OGL-based) component.
   The original GLSL vertex + fragment shaders are preserved verbatim; the
   OGL Renderer/Program/Mesh/Triangle/Color plumbing has been re-implemented
   as a tiny raw-WebGL2 layer so there is NO external dependency and NO CDN.
   ========================================================================== */
(function () {
  'use strict';

  // ---- exact vertex shader from the harvested component ---------------------
  var VERT = '#version 300 es\n' +
    'in vec2 position;\n' +
    'void main() {\n' +
    '  gl_Position = vec4(position, 0.0, 1.0);\n' +
    '}\n';

  // ---- exact fragment shader from the harvested component -------------------
  var FRAG = '#version 300 es\n' +
    'precision highp float;\n' +
    'uniform float uTime;\n' +
    'uniform float uAmplitude;\n' +
    'uniform vec3 uColorStops[3];\n' +
    'uniform vec2 uResolution;\n' +
    'uniform float uBlend;\n' +
    'out vec4 fragColor;\n' +
    'vec3 permute(vec3 x) {\n' +
    '  return mod(((x * 34.0) + 1.0) * x, 289.0);\n' +
    '}\n' +
    'float snoise(vec2 v){\n' +
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);\n' +
    '  vec2 i  = floor(v + dot(v, C.yy));\n' +
    '  vec2 x0 = v - i + dot(i, C.xx);\n' +
    '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n' +
    '  vec4 x12 = x0.xyxy + C.xxzz;\n' +
    '  x12.xy -= i1;\n' +
    '  i = mod(i, 289.0);\n' +
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));\n' +
    '  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);\n' +
    '  m = m * m;\n' +
    '  m = m * m;\n' +
    '  vec3 x = 2.0 * fract(p * C.www) - 1.0;\n' +
    '  vec3 h = abs(x) - 0.5;\n' +
    '  vec3 ox = floor(x + 0.5);\n' +
    '  vec3 a0 = x - ox;\n' +
    '  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);\n' +
    '  vec3 g;\n' +
    '  g.x  = a0.x  * x0.x  + h.x  * x0.y;\n' +
    '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;\n' +
    '  return 130.0 * dot(m, g);\n' +
    '}\n' +
    'struct ColorStop { vec3 color; float position; };\n' +
    '#define COLOR_RAMP(colors, factor, finalColor) {              \\\n' +
    '  int index = 0;                                            \\\n' +
    '  for (int i = 0; i < 2; i++) {                               \\\n' +
    '     ColorStop currentColor = colors[i];                    \\\n' +
    '     bool isInBetween = currentColor.position <= factor;    \\\n' +
    '     index = int(mix(float(index), float(i), float(isInBetween))); \\\n' +
    '  }                                                         \\\n' +
    '  ColorStop currentColor = colors[index];                   \\\n' +
    '  ColorStop nextColor = colors[index + 1];                  \\\n' +
    '  float range = nextColor.position - currentColor.position; \\\n' +
    '  float lerpFactor = (factor - currentColor.position) / range; \\\n' +
    '  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \\\n' +
    '}\n' +
    'void main() {\n' +
    '  vec2 uv = gl_FragCoord.xy / uResolution;\n' +
    '  ColorStop colors[3];\n' +
    '  colors[0] = ColorStop(uColorStops[0], 0.0);\n' +
    '  colors[1] = ColorStop(uColorStops[1], 0.5);\n' +
    '  colors[2] = ColorStop(uColorStops[2], 1.0);\n' +
    '  vec3 rampColor;\n' +
    '  COLOR_RAMP(colors, uv.x, rampColor);\n' +
    '  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;\n' +
    '  height = exp(height);\n' +
    '  height = (uv.y * 2.0 - height + 0.2);\n' +
    '  float intensity = 0.6 * height;\n' +
    '  float midPoint = 0.20;\n' +
    '  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);\n' +
    '  vec3 auroraColor = intensity * rampColor;\n' +
    '  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);\n' +
    '}\n';

  // hex "#rrggbb" -> [r,g,b] normalized 0..1 (mirrors ogl Color())
  function hexRGB(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    var n = parseInt(hex, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[aurora] shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  /**
   * mountAurora(container, options)
   *  options.colorStops : ['#hex','#hex','#hex']  (left → middle → right)
   *  options.amplitude  : number (flow strength)
   *  options.blend      : number (edge softness)
   *  options.speed      : number (time multiplier)
   * Returns a controller { destroy(), setStatic() } or null if unsupported.
   */
  window.mountAurora = function (container, options) {
    options = options || {};
    var colorStops = options.colorStops || ['#0057FF', '#0FB5B0', '#F39A1B'];
    var amplitude = options.amplitude != null ? options.amplitude : 1.0;
    var blend = options.blend != null ? options.blend : 0.5;
    var speed = options.speed != null ? options.speed : 1.0;

    var reduce = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: true
    });

    // ---- graceful fallback: no WebGL2 -> CSS aurora stays visible ----------
    if (!gl) {
      container.classList.add('aurora-fallback');
      return null;
    }

    canvas.style.cssText = 'display:block;width:100%;height:100%;background:transparent';
    container.appendChild(canvas);

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    var prog = gl.createProgram();
    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      container.classList.add('aurora-fallback');
      canvas.remove();
      return null;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[aurora] link error:', gl.getProgramInfoLog(prog));
      container.classList.add('aurora-fallback');
      canvas.remove();
      return null;
    }
    gl.useProgram(prog);

    // fullscreen triangle (covers clip space), single position attribute
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {
      time: gl.getUniformLocation(prog, 'uTime'),
      amp: gl.getUniformLocation(prog, 'uAmplitude'),
      stops: gl.getUniformLocation(prog, 'uColorStops'),
      res: gl.getUniformLocation(prog, 'uResolution'),
      blend: gl.getUniformLocation(prog, 'uBlend')
    };

    var flat = new Float32Array(9);
    function pushStops() {
      for (var i = 0; i < 3; i++) {
        var c = hexRGB(colorStops[i] || '#000000');
        flat[i * 3] = c[0]; flat[i * 3 + 1] = c[1]; flat[i * 3 + 2] = c[2];
      }
      gl.uniform3fv(U.stops, flat);
    }

    var W = 0, H = 0;
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2); // cap DPR at 2
      var w = container.offsetWidth || window.innerWidth;
      var h = container.offsetHeight || window.innerHeight;
      W = Math.max(1, Math.round(w * dpr));
      H = Math.max(1, Math.round(h * dpr));
      canvas.width = W; canvas.height = H;
      gl.viewport(0, 0, W, H);
      gl.uniform2f(U.res, W, H);
    }

    function draw(t) {
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniform1f(U.time, t);
      gl.uniform1f(U.amp, amplitude);
      gl.uniform1f(U.blend, blend);
      pushStops();
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();

    var raf = 0, running = true;
    function loop(now) {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      // original mapping: time = (t*0.01), uTime = time*speed*0.1
      draw(now * 0.01 * speed * 0.1);
    }

    if (reduce) {
      // respect reduced motion: paint one static, characteristic frame
      draw(9.2 * speed);
      running = false;
    } else {
      raf = requestAnimationFrame(loop);
    }

    // pause when the hero scrolls out of view (save GPU)
    if ('IntersectionObserver' in window && !reduce) {
      new IntersectionObserver(function (es) {
        var vis = es[0].isIntersecting;
        if (vis && !running) { running = true; raf = requestAnimationFrame(loop); }
        else if (!vis && running) { running = false; cancelAnimationFrame(raf); }
      }, { threshold: 0.01 }).observe(container);
    }

    return {
      destroy: function () {
        running = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        var ext = gl.getExtension('WEBGL_lose_context');
        if (ext) ext.loseContext();
        canvas.remove();
      }
    };
  };
})();
