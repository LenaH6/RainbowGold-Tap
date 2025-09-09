import { startVerify } from './minikit-config.js';
// worldcoin-auth.js
// No se detectó automáticamente `startVerify` en minikit-config.js. Stub de unión del botón:
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('wldSignIn');
  if (!btn) return;
  if (typeof startVerify === 'function') {
    btn.addEventListener('click', () => startVerify());
  } else {
    btn.addEventListener('click', () => startVerify());
  }
});


function bindAuth(){
  const btn = document.getElementById('wldSignIn');
  if (!btn) { console.warn('[auth] No se encontró #wldSignIn'); return; }
  btn.addEventListener('click', (e) => {
    console.log('[auth] Click login');
    try { startVerify(); } catch(err){ console.error('[auth] startVerify error', err); }
  }, { once: false });
  console.log('[auth] Listo: listener en #wldSignIn');
}
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', bindAuth);
}else{
  bindAuth();
}
window.addEventListener('load', () => {
  if (!document.getElementById('wldSignIn')) return;
});
