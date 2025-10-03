// main.js — binds de botones/drawers + badge + perfil inputs
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id)=> document.getElementById(id);
  const on = (id, fn)=> { const el=$(id); if (el) el.addEventListener("click", fn); };

  // Drawers open/close helpers
  function open(code){
    const map={UP:['drawerUP','backdropUP'], IN:['drawerIN','backdropIN'], PF:['drawerPF','backdropPF'], ID:['drawerID','backdropID']};
    const [dr,bd]=map[code]||[]; const D=$(dr), B=$(bd);
    D?.classList.add('show'); B?.classList.add('show');
  }
  function close(code){
    const map={UP:['drawerUP','backdropUP'], IN:['drawerIN','backdropIN'], PF:['drawerPF','backdropPF'], ID:['drawerID','backdropID']};
    const [dr,bd]=map[code]||[]; const D=$(dr), B=$(bd);
    D?.classList.remove('show'); B?.classList.remove('show');
  }
  window.openDrawer = open; window.closeDrawer = close;

  on("profileBtn", ()=> open("PF"));
  on("inboxBtn",   ()=> { window.RainbowGold?.markInboxAllRead(); open("IN"); });
  on("openUp",     ()=> open("UP"));

  // Trophy tip
  const trophyBtn = $("trophyBtn"), trophyTip = $("trophyTip");
  if (trophyBtn && trophyTip) {
    trophyBtn.addEventListener("click", ()=>{
      const vis = (trophyTip.style.opacity!=="1");
      trophyTip.style.opacity = vis ? "1" : "0";
      trophyTip.style.pointerEvents = vis ? "auto" : "none";
      if (vis) setTimeout(()=>{ trophyTip.style.opacity="0";}, 1200);
    });
  }

  // Login + pagos
  on("wldSignIn",   ()=> window.RainbowGold?.login());
  on("refillBtn",   ()=> window.RainbowGold?.payRefill());
  on("payIdeasBtn", ()=> window.RainbowGold?.payIdeaTicket());
});
