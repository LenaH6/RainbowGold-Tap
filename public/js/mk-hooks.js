// mk-hooks.js — MiniKit: SIWE + WLD Pay + arranque instantáneo + audio + fallback UI
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
  let playOnNextTouch = false;

  function ensureAudioObjects() {
    try {
      if (!ENTER_SND) {
        ENTER_SND = new Audio("/snd/join.mp3"); // tu archivo
        ENTER_SND.preload = "auto";
        ENTER_SND.volume = 1.0;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !window.__rg_ac) {
        window.__rg_ac = new AC();
      }
    } catch {}
  }

  function requestAudioUnlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const resume = () => { try { window.__rg_ac && window.__rg_ac.resume(); } catch {} };
    const tryPlay = () => {
      resume();
      if (playOnNextTouch && ENTER_SND) {
        ENTER_SND.play().catch(()=>{});
        playOnNextTouch = false;
      }
    };
    document.addEventListener("pointerdown", tryPlay, { once: true });
    document.addEventListener("touchstart", tryPlay, { once: true });
  }

  function queueEnterSound() {
    // No intentes reproducir inmediatamente (la vuelta del drawer SIWE no siempre cuenta como gesture)
    // Marca para reproducir en el PRIMER toque siguiente.
    playOnNextTouch = true;
  }

  // ---------- Arranque del juego / Fallbacks ----------
  function openDrawer(key) {
    const map = {
      UP:  { drawer: "drawerUP",  backdrop: "backdropUP" },
      IN:  { drawer: "drawerIN",  backdrop: "backdropIN" },
      ID:  { drawer: "drawerID",  backdrop: "backdropID" },
      PF:  { drawer: "drawerPF",  backdrop: "backdropPF" },
    };
    const m = map[key]; if (!m) return;
    const d = document.getElementById(m.drawer);
    const b = document.getElementById(m.backdrop);
    if (b) { b.style.display = "block"; b.style.opacity = 1; b.style.pointerEvents = "auto"; }
    if (d) { d.style.display = "block"; d.style.transform = "translateY(0)"; }
  }

  // define openDrawer global si no existía
  if (typeof window.openDrawer !== "function") window.openDrawer = openDrawer;

  function closeAllDrawers() {
    ["backdropUP","backdropIN","backdropID","backdropPF"].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.opacity = 0; el.style.pointerEvents = "none"; el.style.display = "none"; }
    });
    ["drawerUP","drawerIN","drawerID","drawerPF"].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.display = "none"; el.style.transform = ""; }
    });
  }

  // mk-hooks.js
function ensureGameReady(){
  // Oculta el splash y arranca el juego SIN tocar nada más
  const splash = document.getElementById('splash');
  const wldState = document.getElementById('wldState');
  if (splash) splash.style.display = 'none';
  if (wldState) wldState.style.display = 'none';

  // Llama al hook del juego si existe
  if (typeof window.__startGame === 'function') window.__startGame();
  // 👇 IMPORTANTE: no llamar bindCoinTap aquí (no existe / lo hace app-legacy)
}

  // ---------- UI post-login (rápido) ----------
  function postLoginUI(addr) {
    try { localStorage.setItem("rg_siwe_ok", "1"); } catch {}
    try {
      const btn = document.getElementById("wldSignIn");
      if (btn && addr) btn.textContent = `Conectado: ${addr.slice(0,6)}…${addr.slice(-4)}`;
    } catch {}
    ensureGameReady();      // entra al juego YA
    queueEnterSound();      // reproduce join.mp3 en el próximo toque
    try { typeof window.onLoginSuccess === "function" && window.onLoginSuccess(); } catch {}
  }

  // ---------- Restauración al abrir si ya había sesión ----------
  document.addEventListener("DOMContentLoaded", () => {
    ensureAudioObjects();
    requestAudioUnlock();
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
        const addr = mk.walletAddress || finalPayload?.address || "";
        postLoginUI(addr);

        // Verifica firma en backend sin bloquear UX
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

  // refill: +0.1% de la capacidad; precio configurable vía <html data-refill-wld="0.10">
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
    // Si no existe closeDrawer global, creamos uno compatible
    if (typeof window.closeDrawer !== "function") {
      window.closeDrawer = function (key) {
        // usa el mismo mapa que openDrawer
        const map = {
          UP:  { drawer: "drawerUP",  backdrop: "backdropUP" },
          IN:  { drawer: "drawerIN",  backdrop: "backdropIN" },
          ID:  { drawer: "drawerID",  backdrop: "backdropID" },
          PF:  { drawer: "drawerPF",  backdrop: "backdropPF" },
        };
        const m = map[key]; if (!m) return;
        const d = document.getElementById(m.drawer);
        const b = document.getElementById(m.backdrop);
        if (b) { b.style.opacity = 0; b.style.pointerEvents = "none"; b.style.display = "none"; }
        if (d) { d.style.display = "none"; d.style.transform = ""; }
      };
    }
  })();
})();
