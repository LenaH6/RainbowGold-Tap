// ===== MiniKit World App Config - VERIFICACIÓN WORLD ID REAL =====

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

// ===== Detección estricta de World App =====
function detectWorldApp() {
  const ua = navigator.userAgent.toLowerCase();
  const isWorldAppUA = ua.includes("worldapp") || ua.includes("world app") || ua.includes("worldcoin");
  
  // Detectar propiedades específicas de World App
  const hasWorldAppProps = !!(
    window.worldapp || 
    window.WorldApp || 
    window.webkit?.messageHandlers?.worldapp ||
    window.Android?.worldapp ||
    navigator.userAgent.includes("WorldApp")
  );
  
  debugLog(`🔍 User Agent: ${navigator.userAgent}`);
  debugLog(`📱 World App in UA: ${isWorldAppUA}`);
  debugLog(`🔧 World App props: ${hasWorldAppProps}`);
  
  return isWorldAppUA || hasWorldAppProps;
}

// ===== Esperar MiniKit con timeout estricto =====
function waitForMiniKit(maxWaitSeconds = 10) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = maxWaitSeconds * 10; // Check every 100ms
    
    const checkMiniKit = () => {
      attempts++;
      
      // Buscar MiniKit en diferentes ubicaciones
      const minikit = window.MiniKit || window.minikit || window.WorldCoin || window.worldcoin;
      
      if (minikit && typeof minikit === 'object') {
        debugLog("✅ MiniKit encontrado!");
        debugLog(`📋 MiniKit type: ${typeof minikit}`);
        debugLog(`🔧 MiniKit keys: ${Object.keys(minikit)}`);
        
        // Verificar que tenga funciones de verificación
        const hasVerify = !!(
          minikit.verify || 
          minikit.commands?.verify || 
          minikit.commandsAsync?.verify
        );
        
        if (hasVerify) {
          debugLog("✅ MiniKit con funciones de verificación encontrado");
          resolve(minikit);
          return;
        } else {
          debugLog("⚠️ MiniKit sin funciones de verificación");
        }
      }
      
      if (attempts % 50 === 0) { // Log every 5 seconds
        debugLog(`🔍 Esperando MiniKit... intento ${attempts}/${maxAttempts}`);
      }
      
      if (attempts >= maxAttempts) {
        debugLog("❌ MiniKit no disponible después de " + maxWaitSeconds + " segundos");
        reject(new Error("MiniKit no disponible"));
        return;
      }
      
      setTimeout(checkMiniKit, 100);
    };
    
    checkMiniKit();
  });
}

// ===== VERIFICACIÓN WORLD ID REAL =====
export async function startVerify() {
  try {
    msg("🔍 Iniciando verificación World ID...");
    debugLog("🚀 startVerify() llamado");

    const isWorldApp = detectWorldApp();
    debugLog(`🌍 ¿Es World App? ${isWorldApp}`);

    // SOLO usar desarrollo si NO está en World App
    if (!isWorldApp) {
      debugLog("🧪 NO es World App - modo desarrollo");
      msg("🧪 Modo desarrollo activo");
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Crear datos de desarrollo
      const mockData = {
        action: "rainbowgold-login",
        signal: "",
        payload: {
          proof: `dev_proof_${Date.now()}`,
          merkle_root: `dev_merkle_${Date.now()}`,
          nullifier_hash: `dev_nullifier_${Math.random().toString(36).substr(2, 16)}`,
          verification_level: "device"
        }
      };
      
      return await sendVerificationToBackend(mockData, true);
    }

    // ESTAMOS EN WORLD APP - USAR VERIFICACIÓN REAL
    msg("🌍 World App detectada - iniciando World ID real");
    debugLog("🌍 World App confirmada - procediendo con verificación real");
    
    msg("⏳ Cargando MiniKit...");
    let MiniKit;
    
    try {
      MiniKit = await waitForMiniKit(10);
      debugLog("✅ MiniKit cargado exitosamente");
    } catch (error) {
      debugLog("❌ Error cargando MiniKit: " + error.message);
      msg("❌ Error: MiniKit no disponible en World App");
      throw new Error("MiniKit no disponible - verifica que estés en World App actualizada");
    }

    // LANZAR LA VERIFICACIÓN REAL DE WORLD ID
    msg("🔐 Lanzando verificación World ID...");
    debugLog("🎬 LANZANDO INTERFAZ NATIVA DE WORLD ID");
    
    // Parámetros EXACTOS para World ID
    const verifyParams = {
      action: "rainbowgold-login", // Debe estar registrado en tu World ID app
      signal: "", // Datos adicionales opcionales
      verification_level: "orb" // "orb" para verificación completa
    };
    
    debugLog("📤 Parámetros World ID: " + JSON.stringify(verifyParams));
    debugLog("🎯 Llamando a MiniKit.verify() - DEBERÍA MOSTRAR INTERFAZ");

    // Determinar función de verificación disponible
    let verifyFunction = null;
    let methodUsed = "";
    
    if (MiniKit.commandsAsync?.verify) {
      verifyFunction = MiniKit.commandsAsync.verify;
      methodUsed = "commandsAsync.verify";
    } else if (MiniKit.commands?.verify) {
      verifyFunction = MiniKit.commands.verify;
      methodUsed = "commands.verify";
    } else if (typeof MiniKit.verify === 'function') {
      verifyFunction = MiniKit.verify;
      methodUsed = "verify";
    } else {
      debugLog("❌ NO HAY FUNCIÓN DE VERIFICACIÓN DISPONIBLE");
      debugLog("🔧 Métodos MiniKit disponibles: " + Object.keys(MiniKit));
      throw new Error("MiniKit no tiene método de verificación");
    }

    debugLog(`🔧 Usando método: MiniKit.${methodUsed}`);
    msg("🎬 Abriendo World ID...");

    try {
      debugLog("🚀 EJECUTANDO VERIFICACIÓN - INTERFAZ DEBERÍA APARECER AHORA");
      
      // ESTA LLAMADA DEBERÍA MOSTRAR LA INTERFAZ DE WORLD ID
      const result = await verifyFunction.call(MiniKit.commandsAsync || MiniKit.commands || MiniKit, verifyParams);
      
      debugLog("📥 Resultado de World ID: " + JSON.stringify(result));
      
      // Manejar respuesta
      let finalPayload = result;
      if (result.finalPayload) {
        finalPayload = result.finalPayload;
        debugLog("📦 Usando finalPayload");
      }
      
      // Verificar éxito
      if (!finalPayload) {
        debugLog("❌ Sin payload de respuesta");
        msg("❌ Sin respuesta de World ID");
        return;
      }
      
      if (finalPayload.status !== "success") {
        debugLog("❌ World ID no exitoso: " + JSON.stringify(finalPayload));
        
        if (finalPayload.status === "error") {
          msg("❌ Error: " + (finalPayload.message || "Verificación falló"));
        } else {
          msg("❌ Verificación cancelada o falló");
        }
        return;
      }
      
      debugLog("✅ WORLD ID VERIFICACIÓN EXITOSA!");
      msg("✅ World ID verificado correctamente");
      
      // Crear payload para backend
      const backendPayload = {
        action: verifyParams.action,
        signal: verifyParams.signal,
        payload: {
          proof: finalPayload.proof,
          merkle_root: finalPayload.merkle_root,
          nullifier_hash: finalPayload.nullifier_hash,
          verification_level: finalPayload.verification_level || "orb"
        }
      };
      
      return await sendVerificationToBackend(backendPayload, false);
      
    } catch (verifyError) {
      debugLog("💥 ERROR EN VERIFICACIÓN WORLD ID: " + verifyError.message);
      debugLog("🔍 Stack trace: " + verifyError.stack);
      
      if (verifyError.message.includes("cancelled") || verifyError.message.includes("canceled")) {
        msg("❌ Verificación cancelada por el usuario");
      } else if (verifyError.message.includes("timeout")) {
        msg("❌ Timeout - intenta de nuevo");
      } else if (verifyError.message.includes("not_verified")) {
        msg("❌ No verificado - necesitas verificar tu World ID");
      } else {
        msg("❌ Error World ID: " + verifyError.message);
      }
      
      // En World App, NO hacer fallback - mostrar error real
      throw verifyError;
    }

  } catch (error) {
    debugLog("💥 ERROR GENERAL: " + error.message);
    console.error("❌ Error en startVerify:", error);
    
    msg("❌ " + error.message);
    
    // NO hacer fallback en World App - mostrar error real
    if (detectWorldApp()) {
      throw error;
    }
  }
}

// ===== Enviar al backend =====
async function sendVerificationToBackend(payload, isDev = false) {
  try {
    msg(isDev ? "📤 Enviando datos de desarrollo..." : "📤 Validando con backend...");
    
    debugLog("📤 Payload al backend: " + JSON.stringify(payload));

    const res = await fetch(`${window.API_BASE}/api/verify`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    debugLog(`📥 Backend response: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      debugLog("❌ Backend error: " + text);
      throw new Error(`Backend error: ${res.status}`);
    }

    const data = await res.json();
    debugLog("✅ Backend success: " + JSON.stringify(data));

    if (data.ok && data.verified) {
      window.VERIFIED = true;
      window.SESSION_TOKEN = data.token;
      window.USER_ID = data.userId;
      
      // Aplicar estado del juego
      if (data.state) {
        try {
          window.wld = +data.state.wld || 0;
          window.rbgp = +data.state.rbgp || 0;
          window.energy = +data.state.energy || 100;
          debugLog("🎮 Estado aplicado");
        } catch (e) {
          debugLog("⚠️ Error aplicando estado: " + e.message);
        }
      }
      
      // UI updates
      try { 
        setVerifiedUI?.(true);
        render?.(); 
      } catch (_) {}
      
      unlock();
      msg(isDev ? "✅ Modo desarrollo listo" : "✅ ¡Verificado con World ID!");
      return true;
      
    } else {
      msg("❌ Backend rechazó: " + (data.error || "unknown"));
      return false;
    }

  } catch (error) {
    debugLog("💥 Backend error: " + error.message);
    msg("❌ Error backend: " + error.message);
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
      debugLog("💥 Click error: " + error.message);
    } finally {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.textContent = original;
    }
  });
}

// ===== Inicialización =====
document.addEventListener("DOMContentLoaded", async () => {
  debugLog("📱 MiniKit config iniciado");
  
  const isWA = detectWorldApp();
  if (isWA) {
    msg("🌍 World App - World ID real disponible");
  } else {
    msg("🧪 Navegador externo - modo desarrollo");
  }
});

// Export para uso global
window.startVerify = startVerify;