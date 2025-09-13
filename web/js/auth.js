
// auth.js — World ID / OIDC login bridge for World App + web fallback
window.WLD = window.WLD || {};

(function(){
  const AUTH_PATHS = {
    login: "/auth/login",         // backend redirect to OIDC authorize
    callback: "/auth/callback"    // backend handles token exchange
  };

  // Abre la interfaz nativa de World App (OIDC) si está embebido; si no, usa popup
  function openLogin() {
    try {
      // Prioriza navegación directa (mejor en webview)
      window.location.href = AUTH_PATHS.login + "?returnTo=" + encodeURIComponent(location.href);
    } catch (_) {
      // Fallback a popup
      const w = 460, h = 720;
      const l = (screen.width-w)/2, t = (screen.height-h)/2;
      const popup = window.open(AUTH_PATHS.login, "wldLogin", `width=${w},height=${h},left=${l},top=${t}`);
      if (!popup) alert("Permite ventanas emergentes para continuar con el login.");
    }
  }

  // Escucha mensaje del backend (/auth/callback) y marca verificado
  window.addEventListener("message", (ev) => {
    if (!ev || !ev.data) return;
    if (ev.data.type === "wld:verified") {
      window.VERIFIED = true;
      try { if (typeof setVerifiedUI === "function") setVerifiedUI(true); } catch(_){}
      // Notificar UI/inbox si existe
      try { if (typeof pushInboxMessage === "function") pushInboxMessage("✅ Verificado con World ID"); } catch(_){}
    }
  });

  // API pública
  window.WLD.login = openLogin;
})();
