document.addEventListener("DOMContentLoaded", () => {
  try { typeof applyLang === "function" && applyLang(); } catch {}
  try { typeof updateRefillCue === "function" && updateRefillCue(); } catch {}
});
