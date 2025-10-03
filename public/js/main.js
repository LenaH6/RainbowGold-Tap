// main.js — autocablea por ID si existen en tu DOM
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const bind = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };

  bind("wldSignIn", () => window.RainbowGold?.login());
  bind("buyRefill", () => window.RainbowGold?.payRefill());
  bind("buyBooster", () => window.RainbowGold?.payBooster());
  bind("buyIdeaTicket", () => window.RainbowGold?.payIdeaTicket());
});
