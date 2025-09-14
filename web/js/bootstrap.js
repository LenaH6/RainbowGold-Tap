document.addEventListener('DOMContentLoaded',()=>{
  const b=document.getElementById('wldSignIn');
  if(b){ b.addEventListener('click',()=>window.WLD&&window.WLD.login&&window.WLD.login()); }
  try { if (typeof setVerifiedUI==='function') setVerifiedUI(false); } catch(_){}
  // Marca persistente para flujos full-redirect
  try {
    const ok = (localStorage.getItem('wld_verified')==='1') || (sessionStorage.getItem('wld_verified')==='1') || ((document.cookie||'').indexOf('wld_verified=1')!==-1);
    if (ok && typeof setVerifiedUI==='function') {
      setVerifiedUI(true);
      try { localStorage.removeItem('wld_verified'); } catch(_){}
      try { sessionStorage.removeItem('wld_verified'); } catch(_){}
      try { document.cookie='wld_verified=; Max-Age=0; Path=/; SameSite=Lax'; } catch(_){}
    }
  } catch(_){}
  // Soporte postMessage (popup)
  window.addEventListener('message',(ev)=>{ if(ev&&ev.data&&ev.data.type==='wld:verified'){ try{ if (typeof setVerifiedUI==='function') setVerifiedUI(true);}catch(_){}} });
});
// === Soft gate: solo oculta login conocidos y entra al juego ===
function __enterGameGateSoft(){
  try { if (typeof setVerifiedUI === 'function') setVerifiedUI(true); } catch(_){}
  // Ocultar solo overlays esperados (no 'start'/'splash' para no romper inputs)
  ['#loginOverlay','#login','.auth-wall','.gate'].forEach(function(sel){
    try { var el=document.querySelector(sel); if(el) el.style.display='none'; } catch(_){}
  });
  // Mostrar contenedores comunes
  ['#game','#game-root','#app','#root','canvas'].forEach(function(sel){
    try { var el=document.querySelector(sel); if(el) el.style.removeProperty('display'); } catch(_){}
  });
  // Intentar arrancar juego si existe alguna función clásica
  var fns=['startGame','initGame','beginGame','bootGame','start','main','startRainbowGold','gameStart'];
  for(var i=0;i<fns.length;i++){ try{ if(typeof window[fns[i]]==='function'){ window[fns[i]](); break; } }catch(_){}} 
  // Click a botón play conocido
  try{ var b=document.querySelector('#play,#playBtn,.btn-play,[data-play]'); if(b) b.click(); }catch(_){}
  try{ if(location.hash!=='#play') location.hash='#play'; }catch(_){}
}

// === Touch → Mouse bridge + Audio resume ===
(function(){
  var resumed=false;
  function resumeAudio(){
    if(resumed) return; resumed=true;
    try{ if(window.audioCtx && typeof audioCtx.resume==='function') audioCtx.resume(); }catch(_){}
    try{ if(window.AudioContext){ var ctx=new AudioContext(); if(ctx.state==='suspended') ctx.resume(); } }catch(_){}
  }
  function mapTouchToMouse(el){
    function conv(type,t){ return new MouseEvent(type,{bubbles:true,cancelable:true,clientX:t.clientX,clientY:t.clientY}); }
    el.addEventListener('touchstart',function(e){resumeAudio(); var t=e.changedTouches[0]; el.dispatchEvent(conv('mousedown',t)); },{passive:false});
    el.addEventListener('touchmove', function(e){var t=e.changedTouches[0]; el.dispatchEvent(conv('mousemove',t)); },{passive:false});
    el.addEventListener('touchend',  function(e){var t=e.changedTouches[0]; el.dispatchEvent(conv('mouseup',t));   },{passive:false});
  }
  document.addEventListener('DOMContentLoaded',function(){
    var c=document.querySelector('canvas');
    if(c){ mapTouchToMouse(c); c.addEventListener('touchstart', resumeAudio, {passive:true}); }
    document.addEventListener('touchstart', resumeAudio, {once:true, passive:true});
  });
})(); 

// === Asset debug HUD (muestra 404 de imágenes/sonidos) — visible con ?debug=1 ===
(function(){
  var debug = /[?&]debug=1/.test(location.search);
  if(!debug) return;
  var box = document.createElement('div');
  box.id='__assetHUD';
  box.style.cssText='position:fixed;bottom:10px;left:10px;max-width:80vw;max-height:45vh;overflow:auto;background:rgba(0,0,0,.7);color:#fff;padding:10px;border-radius:10px;font:12px/1.4 system-ui,Segoe UI,Arial;z-index:99999';
  box.innerHTML='<b>Assets:</b><br>';
  document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(box); });
  function log(msg){ var p=document.createElement('div'); p.textContent=msg; box.appendChild(p); }
  window.addEventListener('error', function(e){
    var t=e.target||{}; 
    if(t.tagName==='IMG' || t.tagName==='AUDIO' || t.tagName==='SOURCE' || t.tagName==='VIDEO'){
      log('ERROR: '+(t.tagName||'')+' → '+(t.src||t.currentSrc||t.href||'(sin src)'));
    }
  }, true);
})(); 

