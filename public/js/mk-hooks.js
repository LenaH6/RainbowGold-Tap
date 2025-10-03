// mk-hooks.js — MiniKit: SIWE + pagos WLD + UI post-login estable
(function () {
  const PAY_TO = "0x91bf252c335f2540871d0d2ef1476ae193a5bc8a";
  const MK = () => window.MiniKit || window.parent?.MiniKit;
  const isMini = () => !!(MK() && MK().isInstalled && MK().isInstalled());

  // ---- utils WLD (18 decimales)
  function wldToDecimals(amountWLD) {
    const [i, f = ""] = String(amountWLD).split(".");
    const frac = (f + "000000000000000000").slice(0, 18);
    return (BigInt(i || "0") * (10n ** 18n) + BigInt(frac)).toString();
  }

  // ---------- UI helpers (<<< NUEVO)
  function postLoginUI(addr) {
    // marca sesión en localStorage (cookie HttpOnly no es legible desde JS)
    try { localStorage.setItem("rg_siwe_ok", "1"); } catch {}
    // cambia texto del botón
    try {
      const btn = document.getElementById("wldSignIn");
      if (btn && addr) btn.textContent = `Conectado: ${addr.slice(0,6)}…${addr.slice(-4)}`;
    } catch {}
    // esconde el splash si existe
    try {
      const s = document.getElementById("splash");
      if (s) s.style.display = "none";
    } catch {}
    // bandera para estilos/JS propios
    try { document.body.dataset.logged = "1"; } catch {}
    // avisa a tu juego si tiene hooks
    try { typeof window.onLoginSuccess === "function" && window.onLoginSuccess(); } catch {}
  }

  // restaura sesión al abrir (<<< NUEVO)
  document.addEventListener("DOMContentLoaded", () => {
    try {
      const ok = localStorage.getItem("rg_siwe_ok") === "1";
      if (ok && isMini()) {
        const addr = MK().walletAddress || "";
        postLoginUI(addr);
      }
    } catch {}
  });

  // ---------- Login (SIWE)
  async function login() {
    if (!isMini()) return console.warn("MiniKit no instalado (abre en World App).");
    try {
      // nonce desde backend (cookie HttpOnly ‘siwe_nonce’)
      const r = await fetch("/api/nonce");
      const { nonce } = await r.json();

      // drawer SIWE
      const { finalPayload } = await MK().commandsAsync.walletAuth({ nonce });
      if (finalPayload?.status === "success") {
        // verifica firma en backend (usa verifySiweMessage)
        await fetch("/api/complete-siwe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: finalPayload, nonce }),
        });

        // UI “logueado”
        const addr = MK().walletAddress || finalPayload?.address || "";
        postLoginUI(addr);
        return true;
      }
    } catch (e) {
      console.error("login error", e);
    }
    return false;
  }

  // ---------- Pagos (WLD) — (sin cambios de lógica)
  function usdcToBaseUnits(amount) { return String(Math.floor(amount * 1e6)); } // por si lo usas luego
  async function sendPayWLD({ description, wldAmount }, cbName) {
    if (!isMini()) return;
    try {
      const res = await fetch("/api/initiate-payment", { method: "POST" });
      const { id } = await res.json();
      const payload = {
        reference: id,
        to: PAY_TO,
        tokens: [{ symbol: "WLD", token_amount: wldToDecimals(wldAmount) }],
        description,
      };
      const { finalPayload } = await MK().commandsAsync.pay(payload);
      if (finalPayload?.status === "success") {
        await fetch("/api/confirm-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: finalPayload }),
        });
        try { typeof window[cbName] === "function" && window[cbName](); } catch {}
        return true;
      }
    } catch (e) { console.error("pay error", e); }
    return false;
  }

  // refill: +0.1% capacidad
  async function payRefill() {
    const priceWLD = Number(document.documentElement.dataset.refillWld || "0.10"); // editable vía <html data-refill-wld="0.10">
    const ok = await sendPayWLD({ description: "RainbowGold — Energy Refill", wldAmount: priceWLD }, "onEnergyRefilledCb");
    if (ok) {
      try { typeof window.onEnergyRefilled === "function" ? window.onEnergyRefilled(0.001) : null; } catch {}
    }
  }
  async function payBooster() {
    const ok = await sendPayWLD({ description: "RainbowGold — Booster", wldAmount: 0.25 }, "onBoosterPurchased");
    if (ok) { try { typeof window.onBoosterPurchased === "function" && window.onBoosterPurchased(); } catch {} }
  }
  async function payIdeaTicket() {
    const ok = await sendPayWLD({ description: "RainbowGold — Idea Ticket", wldAmount: 1 }, "onIdeaTicketGranted");
    if (ok) { try { typeof window.onIdeaTicketGranted === "function" && window.onIdeaTicketGranted(1); } catch {} }
  }

  // API pública
  window.RainbowGold = { login, payRefill, payBooster, payIdeaTicket };

  // ---------- Compat con tu HTML legacy (<<< NUEVO wrapper que respeta tu función original)
  (function setupLegacyLoginWrapper() {
    const legacy = typeof window.Login === "function" ? window.Login : null;
    window.Login = async function () {
      const ok = await window.RainbowGold?.login();
      // si tenías un Login viejo que movía la UI, lo ejecutamos también
      try { typeof legacy === "function" && legacy(); } catch {}
      return ok;
    };
    // también por si usas los otros nombres en el HTML
    window.handleRefillPayment = () => window.RainbowGold?.payRefill();
    window.handleIdeaPayment   = () => window.RainbowGold?.payIdeaTicket();
  })();
})();
