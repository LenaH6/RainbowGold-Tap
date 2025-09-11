// ===== MiniKit / World App Bridge (SIN MOCK) =====

// === Config ===
const DEV_MODE = false; // pon true solo para pruebas locales
const APP_ID   = window.WORLD_ID_APP_ID || "app_33bb8068826b85d4cd56d2ec2caba7cc";
const ACTION   = window.WORLD_ID_ACTION || "rainbowgold-login";
const API_BASE = (window.API_BASE || "").replace(/\/$/, "") || window.location.origin;

// === UI refs (si no existen en tu HTML no pasa nada)
const btn     = document.getElementById("wldSignIn");
const splash  = document.getElementById("splash");
const stateEl = document.getElementById("wldState");
const refillBtn = document.getElementById("refillBtn");

// === Helpers UI
function msg(t) {
  if (stateEl) {
    stateEl.textContent = t;
    stateEl.style.opacity = "1";
  }
  console.log("🔔", t);
}

function unlock() {
  try {
    document.querySelectorAll("#coin,.btn-icon,.fab").forEach(el => el.style.pointerEvents = "");
    if (splash) {
      splash.classList.add("splash-hide");
      setTimeout(() => splash.remove(), 450);
    }
  } catch {}
}

// === Detección de World App real (no UA solamente)
function detectWorldApp() {
  const ua = (navigator.userAgent || "").toLowerCase();
  const inUA = ua.includes("worldapp") || ua.includes("world app") || ua.includes("worldcoin");
  const hasProps = !!(
    window.worldapp ||
    window.WorldApp ||
    window.webkit?.messageHandlers?.worldapp ||
    window.Android?.worldapp
  );
  console.log("🌍 WorldApp detect:", { inUA, hasProps, ua: navigator.userAgent });
  return inUA || hasProps;
}

// === Puente nativo (postMessage) para World ID y pagos
function nativeCall(type, params) {
  return new Promise((resolve, reject) => {
    const id = `${type}_${Date.now()}_${Math.random()}`;

    const onMessage = (ev) => {
      // World App devuelve { id, result?, error? }
      if (ev?.data?.id === id) {
        window.removeEventListener("message", onMessage);
        if (ev.data.error) reject(new Error(ev.data.error));
        else resolve(ev.data.result);
      }
    };

    window.addEventListener("message", onMessage);

    // Timeout de seguridad
    setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error(`${type} timeout`));
    }, 30_000);

    const message = { id, type, params };

    // iOS
    if (window.webkit?.messageHandlers?.worldapp) {
      try { window.webkit.messageHandlers.worldapp.postMessage(message); }
      catch (e) { reject(e); }
      return;
    }

    // Android
    if (window.Android?.worldapp) {
      try { window.Android.worldapp.postMessage(JSON.stringify(message)); }
      catch (e) { reject(e); }
      return;
    }

    // Fallback (iframe)
    window.parent?.postMessage(message, "*");
  });
}

// === PUBLIC: iniciar verificación World ID
export async function startVerify() {
  if (DEV_MODE) {
    window.VERIFIED = true;
    window.SESSION_TOKEN = "dev_token";
    unlock();
    msg("✅ DEV MODE");
    return;
  }

  try {
    msg("Verificando entorno…");

    // Debe abrirse desde World App
    if (!detectWorldApp()) {
      msg("❌ Abre desde World App");
      alert("Abre esta miniapp desde World App (escaneando el QR), no desde un navegador.");
      return;
    }

    msg("Inicializando World ID…");

    // 1) Pedimos prueba al puente nativo (NO MOCK)
    const worldIdRes = await nativeCall("worldID", {
      action: ACTION,
      app_id: APP_ID,
      verification_level: "orb"
    });

    console.log("📥 World ID response:", worldIdRes);

    if (!worldIdRes || (!worldIdRes.proof && !worldIdRes.merkle_root)) {
      msg("❌ World ID cancelado o inválido");
      return;
    }

    // 2) Verificamos con nuestro backend
    msg("Validando con backend…");

    const payload = {
      action: ACTION,
      proof: worldIdRes.proof,
      merkle_root: worldIdRes.merkle_root,
      nullifier_hash: worldIdRes.nullifier_hash,
      verification_level: worldIdRes.verification_level || "orb"
    };

    console.log("📤 Payload al backend /api/minikit/verify:", payload);

    const res = await fetch(`${API_BASE}/api/minikit/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* puede venir texto */ }

    console.log("📥 Backend status:", res.status, "body:", text);

    if (!res.ok || !data?.ok) {
      msg(`❌ Backend ${res.status}: ${(data?.error || text || "invalid_proof")}`);
      alert(`Error de verificación: ${data?.error || text || "invalid_proof"}`);
      return;
    }

    // 3) Éxito → guardamos token y desbloqueamos
    window.VERIFIED = true;
    window.SESSION_TOKEN = data.token;
    try {
      if (data.state) {
        window.wld   = +data.state.wld   || 0;
        window.rbgp  = +data.state.rbgp  || 0;
        window.energy= +data.state.energy|| 100;
        window.render?.();
      }
    } catch {}
    unlock();
    msg("✅ ¡Verificado con World ID!");
  } catch (err) {
    console.error("❌ Error en World ID:", err);
    if (String(err.message || "").includes("timeout")) msg("❌ Timeout - intenta de nuevo");
    else msg(`❌ ${err.message || "Error inesperado"}`);
  }
}

// === Pago (opcional) usando el mismo puente nativo
async function payRefill() {
  if (!detectWorldApp()) { alert("Abre esta función desde World App."); return; }
  if (!window.SESSION_TOKEN) { alert("Primero verifica tu World ID."); return; }

  try {
    msg("Procesando pago…");

    const amount = (typeof window.priceRefill === "function" ? window.priceRefill() : "0.10") || "0.10";

    const payRes = await nativeCall("pay", {
      to:   "0x91bf252c335f2540871dd02ef1476ae193a5bc8a",
      token:"WLD",
      amount,
      reference: crypto.randomUUID(),
      action: "rainbowgold"
    });

    if (!payRes || payRes.status !== "success") {
      msg("❌ Pago cancelado");
      alert("Pago cancelado");
      return;
    }

    // Confirmación en backend
    const r = await fetch(`${API_BASE}/api/pay/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payRes,
        token: window.SESSION_TOKEN,
        action: "rainbowgold"
      })
    });

    const data = await r.json().catch(() => ({}));
    if (data.ok) {
      window.SESSION_TOKEN = data.token || window.SESSION_TOKEN;
      try {
        window.wld   = +data.state?.wld   || 0;
        window.rbgp  = +data.state?.rbgp  || 0;
        window.energy= +data.state?.energy|| 100;
        window.render?.();
      } catch {}
      msg("✅ ¡Pago completado!");
      alert("✅ Energía recargada");
    } else {
      msg("❌ Error confirmando pago");
      alert("Error: " + (data.error || "unknown"));
    }
  } catch (e) {
    console.error("❌ Payment error:", e);
    msg("❌ Error en pago");
    alert("Error: " + (e.message || e));
  }
}

// === Listeners
document.addEventListener("DOMContentLoaded", () => {
  // Estado inicial
  if (detectWorldApp()) msg("✅ World App detectada");
  else msg("❌ Abre desde World App");

  if (btn) {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "Conectando…";
      try { await startVerify(); }
      finally {
        btn.disabled = false;
        btn.textContent = prev || "Entrar con World ID";
      }
    });
  }

  if (refillBtn) {
    refillBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      payRefill();
    });
  }
});
