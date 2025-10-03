// main.js — Binds de botones y drawers, sin tocar tu lógica del juego
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };

  // Funciones robustas para drawers (apoya varias clases que usas: open/show/drawer--open)
  function openDrawerPair(drawerId, backdropId) {
    const D = $(drawerId), B = $(backdropId);
    if (B) { B.classList.add("show"); B.classList.add("backdrop--show"); B.style.display = "block"; B.style.pointerEvents = "auto"; B.style.opacity = 1; }
    if (D) { D.classList.add("open"); D.classList.add("show"); D.classList.add("drawer--open"); D.style.opacity = 1; D.style.transform = "translateX(0)"; }
    // si tienes tu propia función, la respetamos
    try { typeof window.openDrawer === "function" && window.openDrawer(drawerId); } catch {}
  }
  function closeDrawerPair(drawerId, backdropId) {
    const D = $(drawerId), B = $(backdropId);
    if (B) { B.classList.remove("show","backdrop--show"); B.style.pointerEvents = "none"; B.style.opacity = 0; setTimeout(()=>{ B.style.display="none"; }, 200); }
    if (D) { D.classList.remove("open","show","drawer--open"); D.style.opacity = ""; D.style.transform = ""; }
    try { typeof window.closeDrawer === "function" && window.closeDrawer(drawerId); } catch {}
  }

  // Binds de iconos (usamos tus IDs reales)
  on("profileBtn", () => openDrawerPair("drawerPF", "backdropPF"));
  on("inboxBtn",   () => openDrawerPair("drawerIN", "backdropIN"));
  on("openUp",     () => openDrawerPair("drawerUP", "backdropUP"));

  // Cerrar con la X de cada drawer si existe
  ["PF","IN","UP","ID"].forEach(k => {
    const closeBtn = document.querySelector(`#drawer${k} .close`);
    if (closeBtn) closeBtn.addEventListener("click", () => closeDrawerPair(`drawer${k}`, `backdrop${k}`));
  });

  // Trophy tip (tu “Próximamente”)
  const trophyBtn = $("trophyBtn");
  const trophyTip = $("trophyTip");
  if (trophyBtn && trophyTip) {
    let vis = false;
    trophyBtn.addEventListener("click", () => {
      vis = !vis;
      trophyTip.style.opacity = vis ? 1 : 0;
      trophyTip.style.pointerEvents = vis ? "auto" : "none";
    });
  }

  // Botones de acciones
  on("wldSignIn",   () => window.RainbowGold?.login());
  on("refillBtn",   () => window.RainbowGold?.payRefill());
  on("payIdeasBtn", () => window.RainbowGold?.payIdeaTicket());
  // Si agregas boosters con IDs: boosterX2Btn/boosterX3Btn/boosterAutoBtn
  // on("boosterX2Btn",   () => window.RainbowGold?.payBooster());
});
