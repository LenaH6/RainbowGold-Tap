// ===== MiniKit World App Config =====
  const DEV_MODE = true; // <<<<<< PRODUCCIÓN (en revisión, dejar siempre en false)

  if (DEV_MODE) {
    window.VERIFIED = true;
    window.SESSION_TOKEN = "dev_test_token";
    setVerifiedUI?.(true);
    try { unlock?.(); } catch (_) {}
  }
 // ===== Carga dual del SDK (ESM + UMD) =====
  let MiniKit, VerificationLevel;

  try {
    // 1) intenta ESM (como ya tenías)
    const m = await import("https://cdn.jsdelivr.net/npm/@worldcoin/minikit-js@1.5.0/+esm");
    MiniKit = m?.MiniKit;
    VerificationLevel = m?.VerificationLevel;
  } catch (e) {
    console.warn("MiniKit ESM no cargó (ok si UMD está disponible):", e);
  }

  // 2) Fallback a UMD global si existe
  if (!MiniKit && (window.worldcoin || window.MiniKit)) {
    MiniKit = window.worldcoin || window.MiniKit;
    VerificationLevel = MiniKit?.VerificationLevel;
  }

  // === Configuración ===
  const ACTION_ID_LOGIN  = "rainbowgold_login"; // login con World ID
  const ACTION_ID_REFILL = "rainbowgold";       // refill
  const ACTION_ID_IDEAS  = "ideas";             // votos/sugerencias

  const MERCHANT = "0x91bf252c335f2540871dd02ef1476ae193a5bc8a"; // tu wallet
  const TOKEN    = "WLD";
  const AMOUNT   = priceRefill(); // dinámico

  // === Referencias UI ===
  const btn       = document.getElementById("wldSignIn"); // botón de login
  const splash    = document.getElementById("splash");
  const state     = document.getElementById("wldState");
  const refillBtn = document.getElementById("refillBtn"); // botón de refill
  const payIdeasBtn = document.getElementById("payIdeasBtn");

  // === Helpers UI ===
  function msg(t) {
    if (state) { state.textContent = t; state.style.opacity = "1"; }
  }
  function unlock() {
    document.querySelectorAll("#coin,.btn-icon,.fab").forEach(el => el.style.pointerEvents = "");
    if (splash) { splash.classList.add("splash-hide"); setTimeout(() => splash.remove(), 450); }
    try { playSnd("join", { volume: 0.9 }); } catch(_) {}
  }
  function hasMiniKit() {
    const sdk = MiniKit || window.worldcoin || window.MiniKit;
    const ok =
      !!sdk &&
      ((typeof sdk.isAvailable === "function" && sdk.isAvailable() === true) ||
       (typeof sdk.isInstalled === "function" && sdk.isInstalled() === true) ||
       (!!sdk.commandsAsync));
    return ok;
  }

  function requireMiniKit() {
    if (DEV_MODE) return true;
    const ok = hasMiniKit();
    if (!ok) alert("Ábrelo desde el QR del portal con el escáner de la World App (no navegador).");
    return ok;
  }


  // === Login con World ID ===
// === Login con World ID (sin timeout, con diagnóstico) ===
// startVerify moved to worldcoin-auth.js

  // login button handler moved to worldcoin-auth.js

  
  // === Login con World ID - DEV fallback ===
  export async function startVerify(){
    // En DEV, simulamos verificación para probar la UI sin backend / World App
    if (typeof window !== 'undefined') {
      window.VERIFIED = true;
      if (!window.SESSION_TOKEN) window.SESSION_TOKEN = "dev_test_token";
      try { setVerifiedUI?.(true); } catch(_) {}
      try { unlock?.(); } catch(_) {}
      alert("DEV MODE: verificación simulada ✓");
    }
  }

  // === Pago Refill ===
  async function payRefill() {
    if (!requireMiniKit()) return;
    if (!window.SESSION_TOKEN) { alert("Verifícate primero."); return; }

    if (DEV_MODE) {
      alert("✓ DEV: Pago simulado de 0.10 WLD");
      energy = capMax(); render();
      return;
    }

    try {
      const res = await MiniKit.commandsAsync.pay({
        to: MERCHANT,
        token: TOKEN,
        amount: AMOUNT,
        reference: crypto.randomUUID(),
        action: ACTION_ID_REFILL
      });

      if (res.status === "success") {
        let r = await fetch("https://rainbowgold-api.vercel.app/api/pay/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...res, token: window.SESSION_TOKEN, action: "rainbowgold" })

        });
        let data = await r.json();

        if (data.ok) {
          window.SESSION_TOKEN = data.token;
          wld   = +data.state.wld;
          rbgp  = +data.state.rbgp;
          energy = +data.state.energy;
          render();
          alert("✓ Pago realizado");
        } else {
          alert("Error: " + data.error);
        }
      } else {
        alert("Pago cancelado");
      }
    } catch (e) {
      console.error("Error en el pago:", e);
      alert("Error en el pago");
    }
  }
  if (refillBtn) refillBtn.onclick = ev => { ev.preventDefault(); payRefill(); };

  // === Pago Ideas (1 WLD) ===
  if (payIdeasBtn) payIdeasBtn.onclick = async ev => {
    ev.preventDefault();
    if (!requireMiniKit()) return;

    try {
      const res = await MiniKit.commandsAsync.pay({
        to: MERCHANT,
        token: "WLD",
        amount: "1",
        reference: crypto.randomUUID(),
        action: ACTION_ID_IDEAS
      });

      if (res.status === "success") {
        let r = await fetch("https://rainbowgold-api.vercel.app/api/pay/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(res)
        });
        let data = await r.json();

        if (data.ok) {
          window.SESSION_TOKEN = data.token;
          wld   = +data.state.wld;
          rbgp  = +data.state.rbgp;
          energy = +data.state.energy;
          render();
          alert("✓ Pago de idea realizado");
        } else {
          alert("Error: " + data.error);
        }
      } else {
        alert("Pago cancelado");
      }
    } catch (e) {
      console.error("Error en el pago de idea:", e);
      alert("Error en el pago de idea");
    }
  };