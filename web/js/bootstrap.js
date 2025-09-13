
// bootstrap.js — conecta botones y orden de arranque
document.addEventListener("DOMContentLoaded", function(){
  const signBtn = document.getElementById("wldSignIn");
  if (signBtn) {
    signBtn.addEventListener("click", function(){
      if (window.WLD && typeof window.WLD.login === "function") {
        window.WLD.login();
      } else {
        console.warn("WLD.login no está disponible.");
      }
    });
  }

  // Estado inicial de UI no verificado
  try { if (typeof setVerifiedUI === "function") setVerifiedUI(false); } catch(_){}
});
