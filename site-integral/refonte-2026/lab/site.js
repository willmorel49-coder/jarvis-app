/* ============================================================
   Intégral — site vitrine · comportement partagé (3 pages)
   Fond 3D · curseur gélule · nav · reveal · compteurs · ripple
   ============================================================ */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover:hover) and (pointer:fine)').matches && !reduce;

/* ---------- FOND LIVE (3 fonds retenus) ---------- */
const bg = document.getElementById('bg');
const FONDS = {
  iridescence:{name:'Iridescence', mod:'./fx/iridescence.js', opts:{color:'#0057FF'}},
  'dark-veil':{name:'Dark Veil', mod:'./fx/dark-veil.js', opts:{hue:210,tint:0.6}},
  halo:{name:'Halo Intégral', halo:true},
};
let cur=null;
async function mountFond(id){
  if(cur){ try{cur.destroy();}catch(e){} cur=null; }
  if(bg) bg.innerHTML='';
  const f=FONDS[id]||FONDS.iridescence;
  document.querySelectorAll('.fondsw button').forEach(b=>b.classList.toggle('on',b.dataset.f===id));
  try{
    if(f.halo){ const m=await import('./fx/halo-integral.js'); cur=m.init(bg,{}); }
    else { const m=await import(f.mod); cur=m.init(bg, f.opts||{}); }
  }catch(e){ if(bg) bg.style.background='radial-gradient(120% 120% at 30% 20%,#0057FF33,#05070d)'; }
}
if(bg){
  const sw=document.createElement('div'); sw.className='fondsw';
  sw.innerHTML='<span class="lb">FOND</span>'+Object.entries(FONDS).map(([id,f])=>`<button data-f="${id}">${f.name}</button>`).join('');
  document.body.appendChild(sw);
  sw.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>mountFond(b.dataset.f)));
  const def = document.body.dataset.fond && FONDS[document.body.dataset.fond] ? document.body.dataset.fond : 'iridescence';
  mountFond(def);
}

/* ---------- TITRE : mots décalés (si #h1 + GSAP présents) ---------- */
const h1=document.getElementById('h1');
if(h1 && window.gsap && window.SplitText && !reduce){
  gsap.registerPlugin(SplitText);
  window.addEventListener('load',()=>requestAnimationFrame(()=>{
    try{ const split=new SplitText(h1,{type:'words'}); gsap.from(split.words,{y:36,opacity:0,duration:.7,stagger:.05,ease:'power3.out'}); }catch(e){}
  }));
}

/* ---------- NAV au scroll ---------- */
const nav=document.getElementById('nav');
if(nav) addEventListener('scroll',()=>nav.classList.toggle('scr',scrollY>40),{passive:true});

/* ---------- REVEAL au scroll ---------- */
const io=new IntersectionObserver((es)=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }),{threshold:.16});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

/* ---------- COMPTEURS ---------- */
const cio=new IntersectionObserver((es)=>es.forEach(e=>{ if(!e.isIntersecting)return; const el=e.target; const to=+el.dataset.count,suf=el.dataset.suf||''; const st=performance.now(); (function a(n){let p=Math.min(1,(n-st)/1200);el.textContent=Math.round(to*(1-Math.pow(1-p,3))).toLocaleString('fr-FR')+suf;if(p<1)requestAnimationFrame(a);})(st); cio.unobserve(el); }),{threshold:.6});
document.querySelectorAll('[data-count]').forEach(el=>cio.observe(el));

/* ---------- MICRO : ripple au clic ---------- */
document.querySelectorAll('.btn, .card, .gal a, .ag').forEach(el=>{
  el.addEventListener('click',e=>{
    const r=el.getBoundingClientRect(), d=Math.max(r.width,r.height);
    const rp=document.createElement('span'); rp.className='ripple';
    rp.style.width=rp.style.height=d+'px'; rp.style.left=(e.clientX-r.left-d/2)+'px'; rp.style.top=(e.clientY-r.top-d/2)+'px';
    if(getComputedStyle(el).position==='static') el.style.position='relative';
    el.appendChild(rp); setTimeout(()=>rp.remove(),600);
  });
});

/* ---------- CURSEUR : gélule 3D + traînée ---------- */
if(fine){
  let mx=innerWidth/2,my=innerHeight/2, lastx=mx,lasty=my;
  addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;});
  const N=6, pills=[];
  for(let i=0;i<N;i++){
    const el=document.createElement('div'); el.className='pill'; el.innerHTML='<div class="body"><span class="glare"></span></div>';
    el.style.opacity=(1-i/N*0.82).toFixed(2); document.body.appendChild(el);
    pills.push({el, x:mx, y:my, ang:-18, s:(1-i/N*0.7)});
  }
  (function raf(){
    let px=mx,py=my;
    const vx=mx-lastx, vy=my-lasty; const moving=Math.hypot(vx,vy)>0.7;
    const target = moving ? Math.atan2(vy,vx)*180/Math.PI : -18;
    lastx=mx; lasty=my;
    pills.forEach((o,i)=>{
      o.x+=(px-o.x)*0.42; o.y+=(py-o.y)*0.42;
      let d=target-o.ang; d=((d+180)%360+360)%360-180;
      o.ang+=d*(i===0?0.28:0.2);
      o.el.style.transform=`translate(${o.x}px,${o.y}px) rotate(${o.ang}deg) scale(${o.s})`;
      px=o.x; py=o.y;
    });
    requestAnimationFrame(raf);
  })();
} else { document.body.classList.remove('cur-none'); }
