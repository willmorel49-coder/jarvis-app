/* Gélule 3D du logo (variante choisie par data-logo3d="1|2|3" sur <html>).
   Au repos, c'est l'image d'origine. Pendant l'animation, un calque de planche la recouvre (même boîte), puis disparaît. */
(function(){
  var v=document.documentElement.getAttribute("data-logo3d");
  if(!/^[123]$/.test(v)) return;
  var mm=window.matchMedia("(prefers-reduced-motion: reduce)");
  var s=document.currentScript, base=s?s.src.replace(/site-2026\/[^\/]*$/,"assets/logo3d/"):"../assets/logo3d/";
  var img=document.querySelector(".barre__gelule"); if(!img||mm.matches) return;
  var lien=img.closest("a")||img.parentNode, cal=null, pret=false, visible=true;
  function pose(){
    var a=img.getBoundingClientRect(), b=lien.getBoundingClientRect();
    cal.style.cssText="background-image:url("+base+"l"+v+"-p.webp);left:"+(a.left-b.left)+"px;top:"+(a.top-b.top)+"px;width:"+a.width+"px;height:"+a.height+"px";
  }
  function fin(){ cal.classList.remove("g3d-joue"); img.style.visibility=""; }
  function jouer(){
    if(!pret||mm.matches||(v==="2"&&(document.hidden||!visible))) return;
    pose(); img.style.visibility="hidden";
    cal.classList.remove("g3d-joue"); void cal.offsetWidth; cal.classList.add("g3d-joue");
  }
  var pre=new Image();
  pre.onload=function(){
    if(getComputedStyle(lien).position==="static") lien.style.position="relative";
    cal=document.createElement("span"); cal.className="g3d g3d-calque g3d-v"+v; cal.setAttribute("aria-hidden","true"); lien.appendChild(cal);
    pret=true;
    if(v!=="2") cal.addEventListener("animationend",function(e){ if(e.animationName==="g3dY") fin(); });
    jouer();
  };
  pre.src=base+"l"+v+"-p.webp";
  if(v!=="2"){ lien.addEventListener("mouseenter",jouer); lien.addEventListener("focus",jouer); }
  else {
    var maj=function(){ if(!pret) return; if(document.hidden||!visible) fin(); else if(!cal.classList.contains("g3d-joue")) jouer(); };
    document.addEventListener("visibilitychange",maj);
    if("IntersectionObserver" in window) new IntersectionObserver(function(e){ visible=e[0].isIntersecting; maj(); }).observe(img);
  }
  var onmm=function(){ if(pret&&mm.matches) fin(); };
  if(mm.addEventListener) mm.addEventListener("change",onmm);
})();
