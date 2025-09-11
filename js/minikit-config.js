// ===== MiniKit World App Config - REAL WORLD ID VERIFICATION =====

// ===== Referencias UI =====
const btn = document.getElementById("wldSignIn");
const splash = document.getElementById("splash");
const state = document.getElementById("wldState");
const refillBtn = document.getElementById("refillBtn");
const debugInfo = document.getElementById("debugInfo");

// ===== Helpers UI =====
function msg(t) {
  if (state) {
    state.textContent = t;
    state.style.opacity = "1";
  }
  console.log("🔔", t);
}

function debugLog(message) {
  console.log(message);
  if (window.DEBUG_MODE && debugInfo) {
    debugInfo.innerHTML += message + '<br>';
    debugInfo.scrollTop = debugInfo.scrollHeight;
  }
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
  
  debugLog(`🔍 UA: ${navigator.userAgent}`);
  debugLog(`📱 World App UA: ${isWorldAppUA}`);
  debugLog(`🔧 World App Props: ${hasProps}`);
  
  return isWorldAppUA || hasProps;
}

// ===== FUNCIÓN ROBUSTA PARA ESPERAR MINIKIT =====
function waitForMiniKit(maxAttempts = 50) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const checkMiniKit = () => {
      attempts++;
      
      if (attempts % 10 === 0) {
        debugLog(`🔍 Intento ${attempts}: Buscando MiniKit...`);
      }
      
      // Verificar múltiples formas en que MiniKit puede estar disponible
      const minikit = window.MiniKit || window.minikit || window.WorldCoin || window.worldcoin;
      
      if (minikit) {
        debugLog("✅ MiniKit encontrado!");
        debugLog(`📋 Tipo: ${typeof minikit}`);
        debugLog(`🔧 Métodos: ${Object.keys(minikit).join(', ')}`);
        
        // Verificar estructura
        const hasCommands = !!(minikit.commands || minikit.commandsAsync || minikit.verify);
        debugLog(`⚙️ Tiene comandos: ${hasCommands}`);
        
        if (hasCommands) {
          resolve(minikit);
          return;
        }
      }
      
      if (attempts >= maxAttempts) {
        debugLog("❌ MiniKit no disponible después de " + maxAttempts + " intentos");
        reject(new Error("MiniKit no disponible"));
        return;
      }
      
      setTimeout(checkMiniKit, 100);
    };
    
    checkMiniKit();
  });
}

// ===== Verificación con MiniKit REAL =====
export async function startVerify() {
  try {
    msg("🔍 Iniciando verificación con World ID...");
    debugLog("🚀 startVerify() llamado");

    const isWorldApp = detectWorldApp();
    debugLog(`🌍 ¿Es World App? ${isWorldApp}`);

    // SOLO usar mock si específicamente NO estamos en World App
    if (!isWorldApp) {
      debugLog("🧪 NO es World App - usando simulación para desarrollo");
      msg("🧪 Modo desarrollo - simulando World ID");
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockData = {
        status: "success",
        proof: `mock_proof_${Date.now()}`,
        merkle_root: `mock_merkle_${Date.now()}`,
        nullifier_hash: `nullifier_${Math.random().toString(36).substr(2, 16)}`,
        verification_level: "device"
      };
      
      return await sendVerificationToBackend(mockData, true);
    }

    // SI ESTAMOS EN WORLD APP, usar MiniKit REAL
    msg("🌍 World App detectada - usando World ID real");
    msg("⏳ Cargando MiniKit...");
    
    let MiniKit;
    try {
      MiniKit = await waitForMiniKit(50); // 5 segundos máximo
      debugLog("✅ MiniKit cargado correctamente");
    } catch (error) {
      debugLog("❌ Error cargando MiniKit: " + error.message);
      msg("❌ No se pudo cargar MiniKit - intenta recargar la app");
      throw new Error("MiniKit no disponible en World App");
    }

    msg("🔐 Abriendo verificación World ID...");
    debugLog("🎬 Iniciando cinemática de World ID");
    
    // Configuración de verificación REAL
    const verifyParams = {
      action: "rainbowgold-login", // Debe coincidir con tu configuración en World ID
      signal: "", // Opcional: datos adicionales
      verification_level: "orb" // "orb" para verificación completa, "device" para básica
    };
    
    debugLog("📤 Parámetros: " + JSON.stringify(verifyParams));

    // Usar el método correcto de MiniKit
    let verifyFunction;
    if (MiniKit.commandsAsync?.verify) {
      verifyFunction = MiniKit.commandsAsync.verify;
      debugLog("🔧 Usando commandsAsync.verify");
    } else if (MiniKit.commands?.verify) {
      verifyFunction = MiniKit.commands.verify;
      debugLog("🔧 Usando commands.verify");  
    } else if (typeof MiniKit.verify === 'function') {
      verifyFunction = MiniKit.verify;
      debugLog("🔧 Usando verify directo");
    } else {
      debugLog("❌ No se encontró función de verificación válida");
      debugLog("🔧 Métodos disponibles: " + Object.keys(MiniKit));
      throw new Error("MiniKit no tiene método de verificación");
    }

    try {
      debugLog("🎬 Ejecutando verificación World ID...");
      
      // AQUÍ SE MOSTRARÁ LA CINEMÁTICA DE WORLD ID
      const result = await verifyFunction(verifyParams);
      
      debugLog("📥 Resultado completo: " + JSON.stringify(result));
      
      // Manejar diferentes formatos de respuesta
      let payload = result;
      if (result.finalPayload) {
        payload = result.finalPayload;
        debugLog("📦 Usando finalPayload");
      }
      
      if (!payload || payload.status !== "success") {
        debugLog("❌ Verificación no exitosa: " + JSON.stringify(payload));
        if (payload?.status === "error") {
          msg("❌ Error: " + payload.message);
        } else {
          msg("❌ Verificación cancelada");
        }
        return;
      }
      
      debugLog("✅ Verificación World ID exitosa!");
      msg("✅ World ID verificado correctamente");
      
      return await sendVerificationToBackend(payload, false);
      
    } catch (verifyError) {
      debugLog("💥 Error en verificación World ID: " + verifyError.message);
      
      if (verifyError.message.includes("cancelled")) {
        msg("❌ Verificación cancelada por el usuario");
      } else if (verifyError.message.includes("timeout")) {
        msg("❌ Timeout - intenta de nuevo");  
      } else {
        msg("❌ Error en World ID: " + verifyError.message);
      }
      
      throw verifyError; // No hacer fallback en World App
    }

  } catch (error) {
    debugLog("💥 Error general en startVerify: " + error.message);
    console.error("❌ Error en verificación:", error);
    
    const m = String(error?.message || "Error inesperado");
    msg("❌ " + m);
    
    // En World App, mostrar error real - no simular
    if (detectWorldApp()) {
      throw error;
    }
  }
}

// ===== Enviar verificación al backend =====
async function sendVerificationToBackend(payload, isMock = false) {
  try {
    msg(isMock ? "📤 Enviando simulación..." : "📤 Validando World ID...");
    
    // Estructura correcta para el backend
    const requestData = {
      action: "rainbowgold-login",
      signal: payload.signal || "",
      payload: {
        proof: payload.proof,
        merkle_root: payload.merkle_root,
        nullifier_hash: payload.nullifier_hash,
        verification_level: payload.verification_level || "device"
      }
    };
    
    debugLog("📤 Enviando al backend: " + JSON.stringify(requestData));

    const res = await fetch(`${window.API_BASE}/api/verify`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(requestData)
    });

    debugLog(`📥 Backend respuesta: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      debugLog("❌ Error del backend: " + text);
      throw new Error(`Backend error: ${res.status} - ${text}`);
    }

    const data = await res.json();
    debugLog("✅ Backend response: " + JSON.stringify(data));

    if (data.ok && data.verified) {
      window.VERIFIED = true;
      window.SESSION_TOKEN = data.token;
      window.USER_ID = data.userId;
      
      msg("✅ ¡Sesión iniciada correctamente!");
      
      // Aplicar estado del juego
      if (data.state) {
        try {
          window.wld = +data.state.wld || 0;
          window.rbgp = +data.state.rbgp || 0;
          window.energy = +data.state.energy || 100;
          debugLog("🎮 Estado actualizado del backend");
        } catch (e) {
          debugLog("⚠️ Error aplicando estado: " + e.message);
        }
      }
      
      // Actualizar UI
      try { 
        setVerifiedUI?.(true);
        render?.(); 
      } catch (_) {}
      
      unlock();
      return true;
      
    } else {
      debugLog("❌ Backend rechazó verificación: " + data.error);
      msg("❌ Verificación rechazada: " + data.error);
      return false;
    }

  } catch (error) {
    debugLog("💥 Error backend: " + error.message);
    msg("❌ Error de conexión: " + error.message);
    return false;
  }
}

// ===== Event Listeners =====
if (btn) {
  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    btn.disabled = true;
    const original = btn.textContent;
    btn.style.opacity = "0.6";
    btn.textContent = "Verificando...";
    
    try { 
      await startVerify(); 
    } catch (error) {
      debugLog("💥 Error en click: " + error.message);
    } finally {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.textContent = original;
    }
  });
}

// ===== Inicialización =====
document.addEventListener("DOMContentLoaded", async () => {
  debugLog("📱 MiniKit config cargado");
  debugLog("🔍 User Agent: " + navigator.userAgent);
  
  const isWA = detectWorldApp();
  if (isWA) {
    msg("🌍 World App detectada - World ID real disponible");
  } else {
    msg("🧪 Navegador externo - modo desarrollo");
  }
  
  // Verificar MiniKit
  setTimeout(() => {
    if (window.MiniKit) {
      debugLog("✅ MiniKit disponible globalmente");
      msg("✅ MiniKit listo para World ID");
    } else if (isWA) {
      debugLog("⚠️ World App detectada pero MiniKit no disponible");
      msg("⚠️ Recarga la app si hay problemas");
    } else {
      debugLog("ℹ️ MiniKit no necesario fuera de World App");
    }
  }, 1500);
});

// ===== Pago con MiniKit =====
async function payRefill() {
  if (!window.SESSION_TOKEN) {
    msg("❌ Primero verifica con World ID");
    return;
  }

  if (!detectWorldApp()) {
    alert("🧪 Pago simulado (solo disponible en World App)");
    return;
  }

  try {
    msg("💳 Procesando pago con World ID...");
    
    // Implementar pago real con MiniKit aquí
    const MiniKit = window.MiniKit;
    if (MiniKit?.commandsAsync?.pay) {
      // Usar MiniKit para pagos reales
      const payResult = await MiniKit.commandsAsync.pay({
        to: "0x...", // Tu dirección de recepción  
        tokens: [
          {
            symbol: "WLD",
            token_amount: "0.1" // Cantidad a pagar
          }
        ]
      });
      
      if (payResult.status === "success") {
        msg("✅ ¡Pago completado!");
      }
    }
    
  } catch (err) {
    debugLog("💥 Payment error: " + err.message);
    msg("❌ Error en pago: " + err.message);
  }
}

if (refillBtn) {
  refillBtn.addEventListener("click", payRefill);
}

// Exportar para uso global
window.startVerify = startVerify;