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