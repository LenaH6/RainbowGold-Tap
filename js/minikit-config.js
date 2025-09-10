// ===== MiniKit World App Config - VERSIÓN FINAL =====
const DEV_MODE = false; // PRODUCCIÓN

// ===== Configuración =====
const ACTION_ID_REFILL = "rainbowgold";
const ACTION_ID_IDEAS = "ideas";
const MERCHANT = "0x91bf252c335f2540871dd02ef1476ae193a5bc8a";
const TOKEN = "WLD";

// ===== Referencias UI =====
const btn = document.getElementById("wldSignIn");
const splash = document.getElementById("splash");
const state = document.getElementById("wldState");
const refillBtn = document.getElementById("refillBtn");
const payIdeasBtn = document.getElementById("payIdeasBtn");

// ===== Variables globales =====
let MiniKit = null;
let sdkReady = false;

// ===== Helpers UI =====
function msg(t) {
  if (state) { 
    state.textContent = t; 
    state.style.opacity = "1"; 
  }
  console.log("🔔 MiniKit:", t);
}

function unlock() {
  document.querySelectorAll("#coin,.btn-icon,.fab").forEach(el => el.style.pointerEvents = "");
  if (splash) { 
    splash.classList.add("splash-hide"); 
    setTimeout(() => splash.remove(), 450); 
  }
  try { playSnd("join", { volume: 0.9 }); } catch(_) {}
}

// ===== SDK Management =====
function detectMiniKit() {
  // Buscar en diferentes ubicaciones
  const locations = [
    window.MiniKit,
    window.worldcoin,
    window.WorldCoin,
    window.minikit
  ];
  
  for (const location of locations) {
    if (location && typeof location === 'object') {
      console.log("✅ Found MiniKit at:", location);
      return location;
    }
  }
  
  return null;
}

function waitForSDK(maxAttempts = 50) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    function check() {
      attempts++;
      console.log(`🔍 Attempt ${attempts}: Checking for MiniKit...`);
      
      // Verificar si el script falló en cargar
      if (window.MINIKIT_LOAD_ERROR) {
        reject(new Error("MiniKit failed to load from all sources"));
        return;
      }
      
      // Buscar MiniKit
      const detected = detectMiniKit();
      if (detected) {
        MiniKit = detected;
        sdkReady = true;
        console.log("✅ SDK Ready! Available methods:", Object.keys(MiniKit));
        resolve(true);
        return;
      }
      
      // Si llegamos al máximo de intentos
      if (attempts >= maxAttempts) {
        reject(new Error("SDK not found after maximum attempts"));
        return;
      }
      
      // Reintentar en 200ms
      setTimeout(check, 200);
    }
    
    check();
  });
}

function requireMiniKit() {
  if (DEV_MODE) return true;
  
  if (!sdkReady || !MiniKit) {
    msg("❌ MiniKit no disponible");
    alert("Esta aplicación debe abrirse desde World App usando el escáner QR, no desde un navegador web.");
    return false;
  }
  
  return true;
}

// ===== Login con World ID =====
export async function startVerify() {
  if (DEV_MODE) {
    window.VERIFIED = true;
    window.SESSION_TOKEN = "dev_test_token";
    try { setVerifiedUI?.(true); } catch(_) {}
    try { unlock?.(); } catch(_) {}
    msg("DEV MODE: verificación simulada ✓");
    return;
  }

  try {
    msg("Esperando SDK de World App...");
    
    // Esperar a que el SDK esté listo
    await waitForSDK();
    
    if (!requireMiniKit()) {
      return;
    }

    msg("Iniciando World ID...");
    
    // Detectar qué método de World ID usar
    let worldIDMethod = null;
    
    if (MiniKit.commandsAsync?.worldID) {
      worldIDMethod = 'commandsAsync';
    } else if (MiniKit.commands?.worldID) {
      worldIDMethod = 'commands';
    } else if (MiniKit.worldID) {
      worldIDMethod = 'direct';
    } else {
      throw new Error("No World ID method found in MiniKit");
    }
    
    console.log(`🎯 Using World ID method: ${worldIDMethod}`);
    
    let response;
    
    switch (worldIDMethod) {
      case 'commandsAsync':
        response = await MiniKit.commandsAsync.worldID({
          action: "rainbowgold-login",
          app_id: "app_33bb8068826b85d4cd56d2ec2caba7cc",
          verification_level: "orb"
        });
        break;
        
      case 'commands':
        response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("World ID timeout")), 30000);
          
          MiniKit.commands.worldID({
            action: "rainbowgold-login",
            app_id: "app_33bb8068826b85d4cd56d2ec2caba7cc", 
            verification_level: "orb"
          }, (result) => {
            clearTimeout(timeout);
            resolve(result);
          });
        });
        break;
        
      case 'direct':
        response = await MiniKit.worldID({
          action: "rainbowgold-login",
          app_id: "app_33bb8068826b85d4cd56d2ec2caba7cc",
          verification_level: "orb"
        });
        break;
    }

    console.log("📱 World ID Response:", response);
    
    // Extraer payload según el formato de respuesta
    const payload = response.commandPayload || response.payload || response;
    
    if (payload.status === "success" || payload.success) {
      msg("Verificando con servidor...");
      
      const verificationData = {
        action: "rainbowgold-login",
        proof: payload.proof,
        merkle_root: payload.merkle_root,
        nullifier_hash: payload.nullifier_hash,
        verification_level: payload.verification_level || "orb"
      };
      
      console.log("📤 Sending to backend:", verificationData);
      
      const backendResponse = await fetch(`${window.API_BASE}/api/minikit/verify`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify(verificationData)
      });

      console.log("📥 Backend status:", backendResponse.status);
      
      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        console.error("❌ Backend error response:", errorText);
        msg(`❌ Server error: ${backendResponse.status}`);
        
        // Mostrar detalles del error si disponible
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            msg(`❌ ${errorJson.error}: ${errorJson.detail || ''}`);
          }
        } catch (e) {
          // Error text is not JSON, that's ok
        }
        return;
      }

      const data = await backendResponse.json();
      console.log("✅ Backend response:", data);
      
      if (data.ok) {
        window.VERIFIED = true;
        window.SESSION_TOKEN = data.token;
        
        try { setVerifiedUI?.(true); } catch(_) {}
        unlock();
        msg("✅ ¡Verificado con World ID!");
        
        // Cargar estado del usuario si existe
        if (data.state) {
          try {
            wld = +data.state.wld || 0;
            rbgp = +data.state.rbgp || 0;
            energy = +data.state.energy || 100;
            render?.();
          } catch (e) {
            console.warn("Could not update game state:", e);
          }
        }
      } else {
        msg("❌ Verificación rechazada: " + (data.error || "Error desconocido"));
        console.error("Verification failed:", data);
      }
    } else {
      msg("❌ World ID cancelado");
      console.log("World ID cancelled or failed:", payload);
    }
    
  } catch (error) {
    console.error("❌ Error completo en World ID:", error);
    msg("❌ Error: " + error.message);
    
    // Mostrar información específica según el tipo de error
    if (error.message.includes("not found")) {
      msg("❌ Función World ID no encontrada");
    } else if (error.message.includes("timeout")) {
      msg("❌ Timeout - intenta de nuevo");
    } else if (error.message.includes("network")) {
      msg("❌ Error de conexión");
    }
  }
}

// ===== Event Handlers =====
if (btn) {
  btn.onclick = async (ev) => {
    ev.preventDefault();
    
    // Deshabilitar botón
    btn.disabled = true;
    btn.style.opacity = "0.6";
    btn.textContent = "Conectando...";
    
    try {
      await startVerify();
    } catch (error) {
      console.error("Login error:", error);
      msg("❌ Error inesperado");
    } finally {
      // Rehabilitar botón
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.textContent = "Entrar con World ID";
    }
  };
}

// ===== Payment Functions =====
async function payRefill() {
  if (!requireMiniKit()) return;
  if (!window.SESSION_TOKEN) { 
    alert("Debes verificarte primero con World ID."); 
    return; 
  }

  if (DEV_MODE) {
    alert("✓ DEV: Pago simulado de 0.10 WLD");
    energy = capMax?.() || 100;
    render?.();
    return;
  }

  try {
    msg("Procesando pago...");
    
    const paymentData = {
      to: MERCHANT,
      token: TOKEN,
      amount: priceRefill?.() || "0.10",
      reference: crypto.randomUUID(),
      action: ACTION_ID_REFILL
    };
    
    let response;
    
    if (MiniKit.commandsAsync?.pay) {
      response = await MiniKit.commandsAsync.pay(paymentData);
    } else if (MiniKit.commands?.pay) {
      response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Payment timeout")), 30000);
        MiniKit.commands.pay(paymentData, (result) => {
          clearTimeout(timeout);
          resolve(result);
        });
      });
    } else {
      throw new Error("Payment method not available");
    }

    if (response.status === "success") {
      msg("Confirmando pago...");
      
      const confirmResponse = await fetch(`${window.API_BASE}/api/pay/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...response, 
          token: window.SESSION_TOKEN, 
          action: ACTION_ID_REFILL
        })
      });
      
      const confirmData = await confirmResponse.json();

      if (confirmData.ok) {
        window.SESSION_TOKEN = confirmData.token;
        
        // Actualizar estado del juego
        try {
          wld = +confirmData.state?.wld || 0;
          rbgp = +confirmData.state?.rbgp || 0;
          energy = +confirmData.state?.energy || 100;
          render?.();
        } catch (e) {
          console.warn("Could not update game state after payment:", e);
        }
        
        msg("✅ ¡Pago completado!");
        alert("✅ Energía recargada exitosamente");
      } else {
        msg("❌ Error confirmando pago");
        alert("Error confirmando el pago: " + confirmData.error);
      }
    } else {
      msg("❌ Pago cancelado");
      alert("Pago cancelado por el usuario");
    }
  } catch (error) {
    console.error("Payment error:", error);
    msg("❌ Error en pago");
    alert("Error procesando el pago: " + error.message);
  }
}

// ===== Event Listeners =====
if (refillBtn) {
  refillBtn.onclick = (ev) => { 
    ev.preventDefault(); 
    payRefill(); 
  };
}

// ===== Inicialización =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 Inicializando MiniKit configuration...");
  
  if (DEV_MODE) {
    msg("🔧 Modo desarrollador activado");
    return;
  }
  
  // Mostrar estado de carga
  msg("Cargando SDK...");
  
  try {
    // Esperar un momento para que los scripts se carguen
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Intentar detectar MiniKit
    await waitForSDK();
    msg("✅ SDK listo");
    
  } catch (error) {
    console.error("❌ Error inicializando SDK:", error);
    msg("❌ " + error.message);
    
    // Mostrar botón de retry después de 3 segundos
    setTimeout(() => {
      if (!sdkReady) {
        msg("❌ Abre desde World App");
      }
    }, 3000);
  }
});

// ===== Debug Info =====
window.addEventListener('load', () => {
  console.log("🔍 Window load complete. SDK status:", {
    sdkReady,
    miniKitFound: !!MiniKit,
    loadError: window.MINIKIT_LOAD_ERROR,
    miniKitLoaded: window.MINIKIT_LOADED
  });
});