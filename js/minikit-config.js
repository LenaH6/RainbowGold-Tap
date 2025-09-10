// ===== MiniKit World App Config =====
const DEV_MODE = false; // true = modo desarrollo sin verificar

// ===== Referencias UI =====
const btn = document.getElementById("wldSignIn");
const splash = document.getElementById("splash");
const state = document.getElementById("wldState");
const refillBtn = document.getElementById("refillBtn");

// ===== Helpers UI =====
function msg(t) {
  if (state) {
    state.textContent = t;
    state.style.opacity = "1";
  }
  console.log("🔔", t);
}

function unlock() {
  document.querySelectorAll("#coin,.btn-icon,.fab").forEach(el => {
    el.style.pointerEvents = "";
  });
  if (splash) {
    splash.classList.add("splash-hide");
    setTimeout(() => splash.remove(), 450);
  }
  try { playSnd && playSnd("join", { volume: 0.9 }); } catch (_) {}
}

// ===== Detección de World App =====
function detectWorldApp() {
  const ua = navigator.userAgent.toLowerCase();
  const isWorldAppUA = ua.includes("worldapp") || ua.includes("world app") || ua.includes("worldcoin");
  const hasProps = !!(window.worldapp || window.WorldApp || window.webkit?.messageHandlers?.worldapp || window.Android?.worldapp);
  return isWorldAppUA || hasProps;
}

// ===== Verificación con MiniKit (oficial) =====
export async function startVerify() {
  if (DEV_MODE) {
    window.VERIFIED = true;
    window.SESSION_TOKEN = "dev_test_token";
    try { setVerifiedUI?.(true); } catch (_) {}
    unlock();
    msg("✅ DEV MODE activado");
    return;
  }

  try {
    msg("Verificando entorno...");
    if (!detectWorldApp()) {
      msg("❌ Abre desde World App");
      alert("Abre esta miniapp dentro de World App con el QR (no en el navegador).");
      return;
    }

    // MiniKit desde CDN
    const { MiniKit, VerificationLevel } = window;
    if (!MiniKit) {
      msg("❌ MiniKit no cargó");
      throw new Error("MiniKit no está disponible en window");
    }

    msg("Iniciando verificación World ID...");
    // Cambia a VerificationLevel.Device si no usas Orb
    const { finalPayload } = await MiniKit.commandsAsync.verify({
      action: "rainbowgold-login",
      verification_level: VerificationLevel.Device
      // signal opcional
    });

    // Si usuario cancela, finalPayload puede venir undefined
    if (!finalPayload || finalPayload.status !== "success") {
      msg("❌ World ID cancelado o falló");
      console.log("verify result:", finalPayload);
      return;
    }

    msg("Verificando con servidor...");
    const { proof, merkle_root, nullifier_hash, verification_level } = finalPayload;

    const res = await fetch(`${window.API_BASE}/api/minikit/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rainbowgold-login",
        proof,
        merkle_root,
        nullifier_hash,
        verification_level
      })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("❌ Backend error:", res.status, text);
      msg(`❌ Server error: ${res.status}`);
      return;
    }

    const data = await res.json();
    console.log("✅ Backend response:", data);

    if (data.ok) {
      window.VERIFIED = true;
      window.SESSION_TOKEN = data.token;
      try { setVerifiedUI?.(true); } catch (_) {}
      unlock();
      msg("✅ ¡Verificado con World ID!");

      // Estado de juego opcional desde backend
      if (data.state) {
        try {
          window.wld   = +data.state.wld   || 0;
          window.rbgp  = +data.state.rbgp  || 0;
          window.energy= +data.state.energy|| 100;
          render?.();
        } catch (e) {
          console.warn("No se pudo aplicar estado del juego:", e);
        }
      }
    } else {
      msg("❌ Verificación rechazada: " + (data.error || "Error desconocido"));
      console.error("Verification failed:", data);
    }

  } catch (error) {
    console.error("❌ Error en verify:", error);
    const m = String(error?.message || "");
    if (m.includes("timeout")) msg("❌ Timeout - intenta de nuevo");
    else if (m.includes("cancel")) msg("❌ World ID cancelado");
    else msg("❌ " + (m || "Error inesperado"));
  }
}

// ===== Pago (deja tu flujo actual; ejemplo mínimo) =====
async function payRefill() {
  if (!detectWorldApp()) {
    alert("Esta función requiere abrir en World App.");
    return;
  }
  if (!window.SESSION_TOKEN) {
    alert("Primero verifica con World ID.");
    return;
  }

  try {
    msg("Procesando pago...");
    // Aquí puedes integrar MiniKit pago cuando lo expongan; por ahora usa tu backend
    const price = (window.priceRefill?.() || "0.10").toString();

    // Llama a tu endpoint de creación de pago si lo tienes (ejemplo)
    const create = await fetch(`${window.API_BASE}/api/minikit/pay/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: price, token: "WLD" })
    });
    const session = await create.json();

    if (!session?.ok) {
      msg("❌ No se pudo iniciar el pago");
      console.error("create pay:", session);
      return;
    }

    // …aquí iría el comando MiniKit de pago cuando corresponda…

    // Confirmación (mantengo tu flujo)
    const confirm = await fetch(`${window.API_BASE}/api/pay/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: window.SESSION_TOKEN, action: "rainbowgold" })
    });
    const confData = await confirm.json();

    if (confData.ok) {
      window.SESSION_TOKEN = confData.token;
      try {
        window.wld   = +confData.state?.wld   || 0;
        window.rbgp  = +confData.state?.rbgp  || 0;
        window.energy= +confData.state?.energy|| 100;
        render?.();
      } catch (e) {
        console.warn("No se pudo actualizar estado tras pago:", e);
      }
      msg("✅ ¡Pago completado!");
      alert("✅ Energía recargada exitosamente");
    } else {
      msg("❌ Error confirmando pago");
      alert("Error: " + (confData.error || "confirm failed"));
    }
  } catch (err) {
    console.error("❌ Payment error:", err);
    msg("❌ Error en pago");
    alert("Error: " + (err?.message || "unknown"));
  }
}

// ===== Event Listeners =====
if (btn) {
  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    btn.disabled = true;
    const original = btn.textContent;
    btn.style.opacity = "0.6";
    btn.textContent = "Conectando...";
    try { await startVerify(); }
    finally {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.textContent = original;
    }
  });
}

if (refillBtn) {
  refillBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    payRefill();
  });
}

// ===== Inicialización =====
document.addEventListener("DOMContentLoaded", () => {
  const isWA = detectWorldApp();
  if (isWA) msg("✅ World App detectada");
  else msg("❌ Abre desde World App");
  console.log("🔍 UA:", navigator.userAgent);
});
