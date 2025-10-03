// main.js — Binds por ID (tus IDs reales)
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };

  // Login + pagos: usa tus IDs reales del HTML
  on("wldSignIn", () => window.RainbowGold?.login());
  on("refillBtn", () => window.RainbowGold?.payRefill());
  on("payIdeasBtn", () => window.RainbowGold?.payIdeaTicket());

  // (Si usas boosters con botón propio, agrega su ID aquí)
  // on("buyBooster", () => window.RainbowGold?.payBooster());
});
