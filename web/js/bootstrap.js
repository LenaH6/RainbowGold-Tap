// === Gate de entrada al juego tras verificación ===
function __enterGameGate(){
  try { if (typeof setVerifiedUI === 'function') setVerifiedUI(true); } catch(_){}
  var selectors = ['#loginOverlay', '#login', '.login-overlay', '.gate', '.auth-wall'];
  selectors.forEach(function(sel){
    try { var el = document.querySelector(sel); if (el) el.style.display='none'; } catch(_){}
  });
  var showSel = ['#game', '#game-root', '#app', '#root', 'canvas'];
  showSel.forEach(function(sel){
    try { var el = document.querySelector(sel); if (el) el.style.removeProperty('display'); } catch(_){}
  });
  var candidates = ['startGame','initGame','beginGame','bootGame','start','main','startRainbowGold','gameStart'];
  for (var i=0;i<candidates.length;i++){
    var fn = candidates[i];
    try { if (typeof window[fn] === 'function') { window[fn](); break; } } catch(_){}
  }
  try { var playBtn = document.querySelector('#play,#playBtn,.btn-play,[data-play]'); if (playBtn) playBtn.click(); } catch(_){}
  try { if (location.hash !== '#play') location.hash = '#play'; } catch(_){}
}
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
/* Auto-enter gate after verification */
(function(){
  try {
    var mark = (localStorage.getItem('wld_verified')==='1') || (sessionStorage.getItem('wld_verified')==='1') ||
               (/(?:\?|&)verified=1(?:&|$)/.test(location.search)) || (location.hash === '#play');
    if (mark) {
      __enterGameGate();
      try { localStorage.removeItem('wld_verified'); } catch(_){}
      try { sessionStorage.removeItem('wld_verified'); } catch(_){}
      try { document.cookie='wld_verified=; Max-Age=0; Path=/; SameSite=Lax'; } catch(_){}
    }
  } catch(_){}

  window.addEventListener('message', function(ev){
    if (ev && ev.data && ev.data.type === 'wld:verified') {
      __enterGameGate();
    }
  });
})();