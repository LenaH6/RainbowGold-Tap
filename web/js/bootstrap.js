// === Debug/Status banner ===
function __rgBanner(msg, hold){
  try {
    var b = document.getElementById('__rgBanner');
    if (!b) {
      b = document.createElement('div');
      b.id='__rgBanner';
      b.style.position='fixed'; b.style.top='10px'; b.style.right='10px';
      b.style.zIndex='99999'; b.style.padding='10px 14px';
      b.style.borderRadius='12px'; b.style.fontFamily='system-ui,Segoe UI,Arial';
      b.style.boxShadow='0 6px 18px rgba(0,0,0,.15)';
      b.style.background='#16a34a'; b.style.color='white';
      document.body.appendChild(b);
    }
    b.textContent = msg || 'Listo';
    if (!hold && !/[?&]debug=1/.test(location.search)) {
      setTimeout(()=>{ try{b.remove();}catch(_){ b.style.display='none'; } }, 2500);
    }
  } catch(_){}
}

// === Gate de entrada al juego tras verificación (agresivo) ===
function __enterGameGate(){
  __rgBanner('Verificado ✅ entrando al juego...', false);
  try { if (typeof setVerifiedUI === 'function') setVerifiedUI(true); } catch(_){}

  // Ocultar overlays comunes
  var hideWords = ['login','auth','gate','welcome','start','splash'];
  try {
    var nodes = Array.from(document.querySelectorAll('body *'));
    nodes.forEach(function(el){
      var id = (el.id||'').toLowerCase();
      var cls = (el.className||'').toString().toLowerCase();
      for (var i=0;i<hideWords.length;i++){
        if (id.includes(hideWords[i]) || cls.includes(hideWords[i])) {
          el.style.display='none';
          break;
        }
      }
    });
  } catch(_){}

  // Mostrar contenedores de juego
  var showWords = ['game','canvas','root','app','play'];
  try {
    var nodes2 = Array.from(document.querySelectorAll('body *'));
    nodes2.forEach(function(el){
      var id = (el.id||'').toLowerCase();
      var cls = (el.className||'').toString().toLowerCase();
      for (var i=0;i<showWords.length;i++){
        if (id.includes(showWords[i]) || cls.includes(showWords[i]) || el.tagName==='CANVAS') {
          el.style.removeProperty('display');
          el.style.visibility='';
          break;
        }
      }
    });
  } catch(_){}

  // Intentar invocar funciones típicas de arranque
  var candidates = ['startGame','initGame','beginGame','bootGame','start','main','startRainbowGold','gameStart'];
  for (var i=0;i<candidates.length;i++){
    try { if (typeof window[candidates[i]] === 'function') { window[candidates[i]](); __rgBanner('Inicio: '+candidates[i]); break; } } catch(_){}
  }

  // Click a botones Play/Jugar
  try {
    var btns = Array.from(document.querySelectorAll('button, a, [role="button"], [data-play]'));
    for (var j=0;j<btns.length;j++){
      var t = (btns[j].innerText||btns[j].textContent||'').trim().toLowerCase();
      if (btns[j].id==='play' || btns[j].id==='playBtn' || btns[j].className.toString().toLowerCase().includes('btn-play') ||
          /play|jugar|start|comenzar/.test(t) || btns[j].hasAttribute('data-play')) {
        btns[j].click();
        __rgBanner('Click en botón Play');
        break;
      }
    }
  } catch(_){}

  // Foco/click al canvas si existe (para iniciar audio/loop)
  try {
    var cv = document.querySelector('canvas');
    if (cv){
      cv.focus();
      var ev = new MouseEvent('click', { bubbles:true, cancelable:true, view:window });
      cv.dispatchEvent(ev);
      __rgBanner('Canvas activado');
    }
  } catch(_){}

  // Asegurar hash #play
  try { if (location.hash !== '#play') location.hash = '#play'; } catch(_){}
}

// Poll 2s por si el juego monta tarde
function __pollEnter(){
  var tries = 6;
  var iv = setInterval(function(){
    tries--;
    __enterGameGate();
    if (tries<=0) clearInterval(iv);
  }, 400);
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
/* Auto-enter gate after verification (v2) */
(function(){
  var mark = false;
  try {
    mark = (localStorage.getItem('wld_verified')==='1') || (sessionStorage.getItem('wld_verified')==='1') ||
           (/(?:\?|&)verified=1(?:&|$)/.test(location.search)) || (location.hash === '#play');
  } catch(_){}
  if (mark) {
    __enterGameGate();
    __pollEnter();
    try { localStorage.removeItem('wld_verified'); } catch(_){}
    try { sessionStorage.removeItem('wld_verified'); } catch(_){}
    try { document.cookie='wld_verified=; Max-Age=0; Path=/; SameSite=Lax'; } catch(_){}
  }
  window.addEventListener('message', function(ev){
    if (ev && ev.data && ev.data.type === 'wld:verified') {
      __enterGameGate();
      __pollEnter();
    }
  });
})();