/**
 * Pega tu juego real aquí o en otro archivo importado.
 * Debes exponer: window.Game.start = async ({ token }) => { ... }
 * Monta tu canvas dentro del div #game-root.
 */
window.Game = window.Game || {};
(function(){
  const root = document.getElementById('game-root');
  function demo(){
    const el = document.createElement('div');
    el.style.color='white';
    el.style.textAlign='center';
    el.style.marginTop='40px';
    el.innerHTML = '🎮 <b>RainbowJump</b> listo. Reemplaza <code>public/js/game.js</code> con tu juego real.';
    root.appendChild(el);
  }
  window.Game.start = async ({ token }) => {
    // Opcional: valida token contra /api/session si quieres
    // const r = await fetch('/api/session', { headers: { Authorization: 'Bearer ' + token } })
    // if (!r.ok) throw new Error('Sesión inválida');
    demo();
  };
})();
