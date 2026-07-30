// Halo Intégral — anneau lumineux bleu IP + orange, canvas 2D, Safari-safe, zéro dépendance.
// export function init(container, opts) -> { destroy() }
export function init(container, opts = {}) {
  const BLUE = opts.blue || '#0057FF';
  const ORANGE = opts.orange || '#F39A1B';
  const INK = opts.ink || '#05070d';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = Math.min(1.5, window.devicePixelRatio || 1);
  let raf = 0, t = 0, running = true, visible = true;

  function resize() {
    const r = container.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    // fond
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);

    const cx = W * 0.58, cy = H * 0.5;
    const R = Math.min(W, H) * 0.34;
    const a = t * 0.0006;

    // halo lumineux additif
    ctx.globalCompositeOperation = 'lighter';

    // anneau : segments colorés bleu -> orange qui tournent
    const segs = 180, lw = R * 0.42;
    for (let i = 0; i < segs; i++) {
      const p = i / segs;
      const ang = p * Math.PI * 2 + a;
      // mélange bleu(0)->orange(0.5)->bleu(1) : deux pôles
      const mix = 0.5 - 0.5 * Math.cos(p * Math.PI * 2); // 0..1..0
      const col = lerpHex(BLUE, ORANGE, Math.pow(mix, 0.8));
      const x = cx + Math.cos(ang) * R;
      const y = cy + Math.sin(ang) * R * 0.92;
      const rad = lw * (0.5 + 0.5 * mix);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, hexA(col, 0.5));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
    }

    // coeur sombre (le trou du halo)
    const hole = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.95);
    hole.addColorStop(0, INK);
    hole.addColorStop(0.72, INK);
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = hole;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.95, 0, 7); ctx.fill();

    // léger grain de glow central
    ctx.globalCompositeOperation = 'lighter';
    const bloom = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 1.6);
    bloom.addColorStop(0, hexA(BLUE, 0.05));
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  function loop() {
    if (!running || !visible) return;
    t += 16;
    draw();
    raf = requestAnimationFrame(loop);
  }

  // helpers couleur
  function toRGB(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]; }
  function lerpHex(a, b, u) { const A = toRGB(a), B = toRGB(b); const r = Math.round(A[0]+(B[0]-A[0])*u), g = Math.round(A[1]+(B[1]-A[1])*u), bl = Math.round(A[2]+(B[2]-A[2])*u); return 'rgb(' + r + ',' + g + ',' + bl + ')'; }
  function hexA(rgbOrHex, alpha) { if (rgbOrHex.startsWith('rgb(')) return rgbOrHex.replace('rgb(', 'rgba(').replace(')', ',' + alpha + ')'); const c = toRGB(rgbOrHex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')'; }

  resize();
  draw();
  const io = ('IntersectionObserver' in window) ? new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && running && !reduce && !raf) loop(); }, { threshold: 0 }) : null;
  io && io.observe(container);
  let rt; const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { resize(); draw(); }, 150); };
  window.addEventListener('resize', onResize);
  const onVis = () => { if (document.hidden) { running = false; } else { running = true; if (!reduce && !raf) loop(); } };
  document.addEventListener('visibilitychange', onVis);

  if (!reduce) loop();

  return {
    destroy() {
      running = false; cancelAnimationFrame(raf); raf = 0;
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      io && io.disconnect(); clearTimeout(rt);
      canvas.remove();
    }
  };
}
export default init;
