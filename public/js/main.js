// main.js — Binds por ID (tus botones reales)
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };

  on("wldSignIn",   () => window.RainbowGold?.login());
  on("refillBtn",   () => window.RainbowGold?.payRefill());
  on("payIdeasBtn", () => window.RainbowGold?.payIdeaTicket());
  // Si tienes booster con ID propio, actívalo:
  // on("buyBooster",  () => window.RainbowGold?.payBooster());
});
