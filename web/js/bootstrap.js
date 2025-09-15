/*! RainbowGold bootstrap (dedup/idempotent) */
(function(){
  if (window.__RG_bootstrap_loaded) return;
  window.__RG_bootstrap_loaded = true;

  // Minimal touch CSS
  try{
    var st=document.createElement('style');
    st.textContent='html,body,#app,canvas{touch-action:manipulation;-webkit-tap-highlight-color:transparent}canvas{outline:none;-webkit-user-select:none;user-select:none}';
    document.head.appendChild(st);
  }catch(_){}

  // WLD login helper with safe returnTo (no query duplication)
  window.WLD = window.WLD || {};
  window.WLD.login = function(){
    try{
      var base = location.origin + location.pathname + '#play';
      location.href = '/auth/login?returnTo=' + encodeURIComponent(base);
    }catch(_){ location.href='/auth/login'; }
  };

  // Single-run gate
  function enterGameOnce(){
    if (window.__RG_gate_ran) return;
    window.__RG_gate_ran = true;
    try { if (typeof setVerifiedUI === 'function') setVerifiedUI(true); } catch(_){}
    try { var btn = document.getElementById('wldSignIn'); if (btn) { btn.disabled = true; btn.style.opacity='0.5'; } } catch(_){}
    // Call known starters
    var fns=['startRainbowGold','startGame','initGame','beginGame','bootGame','start','main','gameStart'];
    for (var i=0;i<fns.length;i++){ try{ if (typeof window[fns[i]]==='function'){ window[fns[i]](); break; } }catch(_){ } }
    // Click a likely Play button
    try{ var playBtn=document.querySelector('#play,#playBtn,.btn-play,[data-play]'); if (playBtn) playBtn.click(); }catch(_){}
    // Focus canvas
    try{ var cv=document.querySelector('canvas'); if (cv){ cv.focus(); cv.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window})); } }catch(_){}
  }

  // Verified mark utils (avoid loops)
  function isVerifiedMark(){
    try { if (new URLSearchParams(location.search).get('verified')==='1') return true; } catch(_){}
    try { if (localStorage.getItem('wld_verified')==='1') return true; } catch(_){}
    try { if (sessionStorage.getItem('wld_verified')==='1') return true; } catch(_){}
    return false;
  }
  function clearVerifiedMark(){
    try { localStorage.removeItem('wld_verified'); } catch(_){}
    try { sessionStorage.removeItem('wld_verified'); } catch(_){}
    try { document.cookie='wld_verified=; Max-Age=0; Path=/; SameSite=Lax'; } catch(_){}
    try { var u=new URL(location.href); if (u.searchParams.get('verified')==='1'){ u.searchParams.delete('verified'); history.replaceState(null,'',u.toString()); } } catch(_){}
  }

  // Touch→Mouse + audio resume (first touch)
  (function(){
    var resumed=false;
    function resumeAudio(){
      if (resumed) return; resumed=true;
      try{ if (window.audioCtx && typeof audioCtx.resume==='function') audioCtx.resume(); }catch(_){}
      try{ if (window.AudioContext){ var ctx=new AudioContext(); if (ctx.state==='suspended') ctx.resume(); } }catch(_){}
    }
    function mapTouchToMouse(el){
      function conv(type,t){ return new MouseEvent(type,{bubbles:true,cancelable:true,clientX:t.clientX,clientY:t.clientY}); }
      el.addEventListener('touchstart',function(e){ var t=e.changedTouches[0]; el.dispatchEvent(conv('mousedown',t)); resumeAudio(); },{passive:false});
      el.addEventListener('touchmove', function(e){ var t=e.changedTouches[0]; el.dispatchEvent(conv('mousemove',t)); },{passive:false});
      el.addEventListener('touchend',  function(e){ var t=e.changedTouches[0]; el.dispatchEvent(conv('mouseup',t));   },{passive:false});
    }
    document.addEventListener('DOMContentLoaded',function(){
      var c=document.querySelector('canvas'); if (c){ mapTouchToMouse(c); c.addEventListener('touchstart', resumeAudio, {passive:true}); }
      document.addEventListener('touchstart', resumeAudio, {once:true, passive:true});
    });
  })();

  // Wire login button once
  document.addEventListener('DOMContentLoaded', function(){
    var btn = document.getElementById('wldSignIn');
    if (btn) { btn.addEventListener('click', function(){ if (window.WLD && WLD.login) WLD.login(); }, { once:true }); }
    if (isVerifiedMark()) { enterGameOnce(); clearVerifiedMark(); }
  });

  // Popup/iframe message
  window.addEventListener('message', function(ev){ if (ev && ev.data && ev.data.type==='wld:verified'){ enterGameOnce(); } });

})();
