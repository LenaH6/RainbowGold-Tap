// mk-hooks.js — MiniKit: SIWE + WLD Pay + arranque instantáneo + audio desbloqueado
(function () {
  // === Config ===
  const PAY_TO = "0x91bf252c335f2540871d0d2ef1476ae193a5bc8a"; // tesorería
  const MK = () => window.MiniKit || window.parent?.MiniKit;
  const isMini = () => !!(MK() && MK().isInstalled && MK().isInstalled());

  // === Utils ===
  // WLD 18 decimales
  function wldToDecimals(amountWLD) {
    const [i, f = ""] = String(amountWLD).split(".");
    const frac = (f + "000000000000000000").slice(0, 18);
    return (BigInt(i || "0") * (10n ** 18n) + BigInt(frac)).toString();
  }

  // ---------- Audio ----------
  let ENTER_SND = null;
  function unlockAudio() {
    try {
      // prepara <audio> join.mp3
      if (!ENTER_SND) {
        ENTER_SND = new Audio("/snd/join.mp3");
        ENTER_SND.preload = "auto";
        ENTER_SND.volume = 1.0;
      }
      // en algunos navegadores hace falta “resume” de AudioContext
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        if (!window.__rg_ac) window.__rg_ac = new AC();
        const resume = () => window.__rg_ac.resume().catch(()=>{});
        const once = () => { resume(); document.removeEventListener("pointerdown", once); document.removeEventListener("touchstart", once); };
        document.addEventListener("pointerdown", once, { once: true });
        document.addEventListener("touchstart", once, { once: true });
      }
    } catch {}
  }
  function playEnterSound() {
    try { if (ENTER_SND) ENTER_SND.play().catch(()=>{}); } catch {}
  }

  // ---------- Arranque del juego y limpiezas ----------
  function ensureGameReady() {
    try { document.body.dataset.logged = "1"; } catch {}
    // oculta splash si está visible
    try { const s = document.getElementById("splash"); if (s) s.style.display = "none"; } catch {}
    // apaga posibles backdrops/drawers que hayan quedado activos
    ["backdropUP","backdropIN","backdropID","backdropPF"].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.opacity = 0; el.style.pointerEvents = "none"; el.style.display = "none"; }
    });
    // intenta llamar tu bootstrap si existe
    try {
      const boot =
        window.rgStart ||
        window.initGame ||
        window.startGame ||
        window.boot ||
        window.attachGameHandlers;
      if (typeof boot === "function") boot();
    } catch {}
    // si tu juego escucha onCoinTap, cableamos por si acaso
    try {
      const coin = document.getElementById("coin");
      if (coin && !coin.__rgBound && typeof window.onCoinTap === "function") {
        coin.__rgBound = true;
        coin.addEventListener("pointerdown", (e) => window.onCoinTap(e));
      }
    } catch {}
  }

  // ---------- UI post-login (rápido) ----------
  function postLoginUI(addr) {
    try { localStorage.setItem("rg_siwe_ok", "1"); } catch {}
    try {
      const btn = document.getElementById("wldSignIn");
      if (btn && addr) btn.textContent = `Conectado: ${addr.slice(0,6)}…${addr.slice(-4)}`;
    } catch {}
    ensureGameReady();   // entra al juego YA (sin esperar red)
    playEnterSound();    // reproduce join.mp3
    try { typeof window.onLoginSuccess === "function" && window.onLoginSuccess(); } catch {}
  }

  // ---------- Restauración al abrir si ya había sesión ----------
  document.addEventListener("DOMContentLoaded", () => {
    unlockAudio();
    try {
      if (localStorage.getItem("rg_siwe_ok") === "1" && isMini()) {
        const addr = MK().walletAddress || "";
        postLoginUI(addr);
      }
    } catch {}
  });

  // ---------- Login (SIWE) — verificación en background ----------
  async function login() {
    const mk = MK(); if (!mk || !mk.isInstalled()) return false;
    try {
      const r = await fetch("/api/nonce");
      const { nonce } = await r.json();

      const { finalPayload } = await mk.commandsAsync.walletAuth({ nonce });
      if (finalPayload?.status === "success") {
        // 1) Pasa a juego al instante
        const addr = mk.walletAddress || finalPayload?.address || "";
        postLoginUI(addr);

        // 2) Verifica firma en backend sin bloquear UX
        fetch("/api/complete-siwe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: finalPayload, nonce }),
        }).catch(()=>{});

        return true;
      }
    } catch (e) { console.error("login error", e); }
    return false;
  }

  // ---------- Pagos en WLD ----------
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
        // confirmación/validación backend (con Portal si lo configuraste)
        fetch("/api/confirm-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: finalPayload }),
        }).catch(()=>{});
        try { typeof window[cbName] === "function" && window[cbName](); } catch {}
        return true;
      }
    } catch (e) { console.error("pay error", e); }
    return false;
  }

  // refill: +0.1% de la capacidad; precio por defecto configurable vía <html data-refill-wld="0.10">
  async function payRefill() {
    const priceWLD = Number(document.documentElement.dataset.refillWld || "0.10");
    const ok = await sendPayWLD({ description: "RainbowGold — Energy Refill", wldAmount: priceWLD }, "onEnergyRefilledCb");
    if (ok) {
      try { typeof window.onEnergyRefilled === "function" && window.onEnergyRefilled(0.001); } catch {}
    }
  }

  // booster (si lo usas): 0.25 WLD
  async function payBooster() {
    const ok = await sendPayWLD({ description: "RainbowGold — Booster", wldAmount: 0.25 }, "onBoosterPurchased");
    if (ok) { try { typeof window.onBoosterPurchased === "function" && window.onBoosterPurchased(); } catch {} }
  }

  // idea ticket: 1 WLD
  async function payIdeaTicket() {
    const ok = await sendPayWLD({ description: "RainbowGold — Idea Ticket", wldAmount: 1 }, "onIdeaTicketGranted");
    if (ok) { try { typeof window.onIdeaTicketGranted === "function" && window.onIdeaTicketGranted(1); } catch {} }
  }

  // API pública
  window.RainbowGold = { login, payRefill, payBooster, payIdeaTicket };

  // ---------- Compat con tu HTML legacy ----------
  (function setupLegacyWrapper(){
    // Respeta un Login() previo si lo tenías
    const legacy = typeof window.Login === "function" ? window.Login : null;
    window.Login = async function () {
      const ok = await window.RainbowGold?.login();
      try { typeof legacy === "function" && legacy(); } catch {}
      return ok;
    };
    // Aliases para tus onclick
    window.handleRefillPayment = () => window.RainbowGold?.payRefill();
    window.handleIdeaPayment   = () => window.RainbowGold?.payIdeaTicket();
  })();
})();
