// ===== MiniKit World App Config (VERSIÓN CORREGIDA PARA ES6) =====
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

// ===== FUNCIÓN PARA ESPERAR MINIKIT =====
function waitForMiniKit(maxAttempts = 100) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const checkMiniKit = () => {
      attempts++;
      console.log(`🔍 Intento ${attempts}: Buscando MiniKit...`);
      
      if (window.MiniKit) {
        console.log("✅ MiniKit encontrado:", window.MiniKit);
        console.log("📋 Métodos disponibles:", Object.keys(window.MiniKit));
        
        // Verificar estructura del objeto MiniKit
        const commands = window.MiniKit.commands || window.MiniKit.commandsAsync;
        console.log("🔧 Commands disponibles:", commands ? Object.keys(commands) : "No encontrados");
        
        resolve(window.MiniKit);
        return;
      }
      
      if (attempts >= maxAttempts) {
        console.error("❌ MiniKit no se cargó después de", maxAttempts, "intentos");
        reject(new Error("MiniKit no se cargó"));
        return;
      }
      
      setTimeout(checkMiniKit, 100); // Esperar 100ms entre intentos
    };
    
    checkMiniKit();
  });
}

// ===== Verificación con MiniKit (CORREGIDA PARA ES6) =====
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

    msg("Esperando MiniKit...");
    
    // ✅ ESPERAR A QUE MINIKIT SE CARGUE
    const MiniKit = await waitForMiniKit();
    
    console.log("🎯 MiniKit cargado correctamente:", {
      MiniKit: !!MiniKit,
      commands: !!MiniKit.commands,
      commandsAsync: !!MiniKit.commandsAsync
    });

    msg("Iniciando verificación World ID...");
    
    // Determinar qué comando usar (puede variar entre versiones)
    const verifyCommand = MiniKit.commands?.verify || MiniKit.commandsAsync?.verify || MiniKit.verify;
    
    if (!verifyCommand) {
      console.error("❌ Comando verify no encontrado. Métodos disponibles:", Object.keys(MiniKit));
      throw new Error("MiniKit.verify no está disponible");
    }
    
    console.log("🔧 Usando comando verify:", verifyCommand);
    
    // Configurar la verificación
    const verifyParams = {
      action: "rainbowgold-login",
      verification_level: "device" // Usar string en lugar de enum
    };
    
    console.log("📤 Parámetros de verificación:", verifyParams);
    
    // Ejecutar verificación
    let result;
    if (MiniKit.commandsAsync?.verify) {
      result = await MiniKit.commandsAsync.verify(verifyParams);
    } else if (MiniKit.commands?.verify) {
      result = await MiniKit.commands.verify(verifyParams);
    } else {
      result = await MiniKit.verify(verifyParams);
    }

    console.log("🔍 Resultado completo de verificación:", result);

    // Manejar diferentes formatos de respuesta
    let finalPayload;
    if (result?.finalPayload) {
      finalPayload = result.finalPayload;
    } else if (result?.status === "success") {
      finalPayload = result;
    } else {
      finalPayload = result;
    }

    // Verificar si la verificación fue exitosa
    if (!finalPayload || finalPayload.status !== "success") {
      msg("❌ World ID cancelado o falló");
      console.log("verify result details:", { result, finalPayload });
      return;
    }

    msg("Verificando con servidor...");
    const { proof, merkle_root, nullifier_hash, verification_level } = finalPayload;

    console.log("📤 Enviando al servidor:", {
      action: "rainbowgold-login",
      proof: proof ? "presente" : "ausente",
      merkle_root: merkle_root ? "presente" : "ausente",
      nullifier_hash: nullifier_hash ? nullifier_hash.substring(0, 10) + "..." : "ausente",
      verification_level: verification_level || "device"
    });

    const res = await fetch(`${window.API_BASE}/api/minikit/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rainbowgold-login",
        proof,
        merkle_root,
        nullifier_hash,
        verification_level: verification_level || "device"
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
    else if (m.includes("MiniKit no se cargó")) msg("❌ Error cargando MiniKit - recarga la página");
    else if (m.includes("User rejected")) msg("❌ Verificación cancelada por el usuario");
    else msg("❌ " + (m || "Error inesperado"));
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
    try { 
      await startVerify(); 
    } finally {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.textContent = original;
    }
  });
}

// ===== Pago =====
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
    const price = (window.priceRefill?.() || "0.10").toString();

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

if (refillBtn) {
  refillBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    payRefill();
  });
}

// ===== Inicialización mejorada =====
document.addEventListener("DOMContentLoaded", async () => {
  const isWA = detectWorldApp();
  if (isWA) {
    msg("✅ World App detectada");
    msg("Verificando MiniKit...");
    
    // Verificar MiniKit al cargar
    try {
      await waitForMiniKit(50); // 50 intentos = 5 segundos
      msg("✅ MiniKit cargado correctamente");
    } catch (error) {
      msg("⚠️ MiniKit no se cargó - recarga la página");
      console.error("MiniKit load error:", error);
    }
  } else {
    msg("❌ Abre desde World App");
  }
  console.log("🔍 UA:", navigator.userAgent);
});

// Exportar para uso global si es necesario
window.startVerify = startVerify;