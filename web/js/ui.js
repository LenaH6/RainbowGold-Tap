(function setupTrophyTip(){
  const btn = document.getElementById('trophyBtn');
  const tip = document.getElementById('trophyTip');
  if (!btn || !tip) return;

  let timer;
  btn.addEventListener('click', () => {
    tip.classList.add('show');     // aparece
    clearTimeout(timer);
    timer = setTimeout(() => {
      tip.classList.remove('show'); // se desvanece
    }, 1600); // 1.6s visible
  });
})();

// Listeners pasivos para scroll/touch → evita bloqueos
  ['touchstart','touchmove','touchend','wheel'].forEach(ev=>{
    window.addEventListener(ev, ()=>{}, {passive:true});
  });

  // Ráfagas de animación: usa rAF y siempre limpia
  const rafs = new Set();
  window.rafAdd = (id)=>rafs.add(id);
  window.rafClearAll = ()=>{
    for(const id of rafs) cancelAnimationFrame(id);
    rafs.clear();
  };
  // Cuando abras/cierres drawers o cambies de modo, llama rafClearAll()

// fuerza navegación dura al hacer clic en legales si no hay target="_blank"
  document.querySelectorAll('.legal-link').forEach(a => {
    a.addEventListener('click', (e) => {
      if (!a.target || a.target !== '_blank') {
        e.preventDefault();
        window.location.href = a.href; // navegación full-page
      }
    });
  });
