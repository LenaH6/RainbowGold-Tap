// ===== MiniKit World App Config - SDK NATIVO =====
const DEV_MODE = false; // PRODUCCIÓN

// ===== Referencias UI =====
const btn = document.getElementById("wldSignIn");
const splash = document.getElementById("splash");
const state = document.getElementById("wldState");
const refillBtn = document.getElementById("refillBtn");

// ===== Variables globales =====
let isWorldApp = false;
let sdkReady = false;

// ===== Helpers UI =====
function msg(t) {
  if (state) { 
    state.textContent = t; 
    state.style.opacity = "1"; 
  }
  console.log("🔔", t);
}

function unlock() {
  document.querySelectorAll("#coin,.btn-icon,.fab").forEach(el => el.style.pointerEvents = "");
  if (splash) { 
    splash.classList.add("splash-hide"); 
    setTimeout(() => splash.remove(), 450); 
  }
  try { playSnd("join", { volume: 0.9 }); } catch(_) {}
}

// ===== Detección de World App =====
function detectWorldApp() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isWorldAppUA = userAgent.includes('worldapp') || 
                       userAgent.includes('world app') ||
                       userAgent.includes('worldcoin');
  
  // Verificar también por window properties específicas de World App
  const hasWorldAppProps = !!(window.worldapp || 
                             window.WorldApp || 
                             window.webkit?.messageHandlers?.worldapp ||
                             window.Android?.worldapp);
  
  console.log("🌍 World App Detection:", {
    userAgent: userAgent,
    isWorldAppUA,
    hasWorldAppProps,
    windowProperties: Object.keys(window).filter(k => k.toLowerCase().includes('world'))
  });
  
  return isWorldAppUA || hasWorldAppProps;
}

// ===== SDK Nativo de World App =====
function initializeNativeSDK() {
  console.log("🔍 Buscando SDK nativo...");
  
  // Métodos nativos de World App (sin MiniKit externo)
  const nativeMethods = {
    // Verificación World ID usando postMessage
    worldID: async (params) => {
      return new Promise((resolve, reject) => {
        const messageId = `worldid_${Date.now()}_${Math.random()}`;
        
        const messageHandler = (event) => {
          if (event.data?.id === messageId) {
            window.removeEventListener('message', messageHandler);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve(event.data.result);
            }
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Timeout después de 30 segundos
        setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          reject(new Error('World ID timeout'));
        }, 30000);
        
        // Enviar mensaje a World App
        const message = {
          id: messageId,
          type: 'worldID',
          params: params
        };
        
        // Intentar diferentes métodos de comunicación
        if (window.webkit?.messageHandlers?.worldapp) {
          window.webkit.messageHandlers.worldapp.postMessage(message);
        } else if (window.Android?.worldapp) {
          window.Android.worldapp.postMessage(JSON.stringify(message));
        } else {
          window.parent.postMessage(message, '*');
        }
      });
    },
    
    // Pago usando postMessage  
    pay: async (params) => {
      return new Promise((resolve, reject) => {
        const messageId = `pay_${Date.now()}_${Math.random()}`;
        
        const messageHandler = (event) => {
          if (event.data?.id === messageId) {
            window.removeEventListener('message', messageHandler);
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve(event.data.result);
            }
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          reject(new Error('Payment timeout'));
        }, 30000);
        
        const message = {
          id: messageId,
          type: 'pay',
          params: params
        };
        
        if (window.webkit?.messageHandlers?.worldapp) {
          window.webkit.messageHandlers.worldapp.postMessage(message);
        } else if (window.Android?.worldapp) {
          window.Android.worldapp.postMessage(JSON.stringify(message));
        } else {
          window.parent.postMessage(message, '*');
        }
      });
    }
  };
  
  return nativeMethods;
}

// ===== Login con World ID =====
export async function startVerify() {
  if (DEV_MODE) {
    window.VERIFIED = true;
    window.SESSION_TOKEN = "dev_test_token";
    try { setVerifiedUI?.(true); } catch(_) {}
    try { unlock?.(); } catch(_) {}
    msg("✅ DEV MODE activado");
    return;
  }

  try {
    msg("Verificando entorno...");
    
    // Verificar que estamos en World App
    if (!detectWorldApp()) {
      msg("❌ Abre desde World App");
      alert("Esta aplicación debe abrirse desde World App usando el código QR, no desde un navegador web.");
      return;
    }
    
    msg("Inicializando World ID...");
    
    // Usar SDK nativo
    const nativeSDK = initializeNativeSDK();
    
    const worldIDParams = {
      action: "rainbowgold-login",
      app_id: "app_33bb8068826b85d4cd56d2ec2caba7cc",
      verification_level: "orb"
    };
    
    console.log("📤 Enviando World ID request:", worldIDParams);
    
    const response = await nativeSDK.worldID(worldIDParams);
    
    console.log("📥 World ID response:", response);
    
    if (response.status === "success" || response.success) {
      msg("Verificando con servidor...");
      
      const verificationData = {
        action: "rainbowgold-login",
        proof: response.proof,
        merkle_root: response.merkle_root,
        nullifier_hash: response.nullifier_hash,
        verification_level: response.verification_level || "orb"
      };
      
      console.log("📤 Enviando al backend:", verificationData);
      
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
        console.error("❌ Backend error:", errorText);
        msg(`❌ Server error: ${backendResponse.status}`);
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
        
        // Actualizar estado del juego
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
      msg("❌ World ID cancelado o falló");
      console.log("World ID cancelled:", response);
    }
    
  } catch (error) {
    console.error("❌ Error en World ID:", error);
    
    if (error.message.includes('timeout')) {
      msg("❌ Timeout - intenta de nuevo");
    } else if (error.message.includes('cancelled')) {
      msg("❌ World ID cancelado");
    } else {
      msg("❌ " + error.message);
    }
  }
}

// ===== Pago con SDK Nativo =====
async function payRefill() {
  if (!detectWorldApp()) {
    alert("Esta función requiere World App.");
    return;
  }
  
  if (!window.SESSION_TOKEN) { 
    alert("Debes verificarte primero con World ID."); 
    return; 
  }

  try {
    msg("Procesando pago...");
    
    const nativeSDK = initializeNativeSDK();
    
    const paymentParams = {
      to: "0x91bf252c335f2540871dd02ef1476ae193a5bc8a",
      token: "WLD",
      amount: priceRefill?.() || "0.10",
      reference: crypto.randomUUID(),
      action: "rainbowgold"
    };
    
    console.log("📤 Payment request:", paymentParams);
    
    const response = await nativeSDK.pay(paymentParams);
    
    console.log("📥 Payment response:", response);

    if (response.status === "success") {
      msg("Confirmando pago...");
      
      const confirmResponse = await fetch(`${window.API_BASE}/api/pay/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...response, 
          token: window.SESSION_TOKEN, 
          action: "rainbowgold"
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
          console.warn("Could not update game state:", e);
        }
        
        msg("✅ ¡Pago completado!");
        alert("✅ Energía recargada exitosamente");
      } else {
        msg("❌ Error confirmando pago");
        alert("Error: " + confirmData.error);
      }
    } else {
      msg("❌ Pago cancelado");
      alert("Pago cancelado");
    }
  } catch (error) {
    console.error("❌ Payment error:", error);
    msg("❌ Error en pago");
    alert("Error: " + error.message);
  }
}

// ===== Event Listeners =====
if (btn) {
  btn.onclick = async (ev) => {
    ev.preventDefault();
    
    btn.disabled = true;
    btn.style.opacity = "0.6";
    btn.textContent = "Conectando...";
    
    try {
      await startVerify();
    } catch (error) {
      console.error("Login error:", error);
      msg("❌ Error inesperado");
    } finally {
      btn.disabled = false;
      btn.style.opacity = "1";
      btn.textContent = "Entrar con World ID";
    }
  };
}

if (refillBtn) {
  refillBtn.onclick = (ev) => { 
    ev.preventDefault(); 
    payRefill(); 
  };
}

// ===== Inicialización =====
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Iniciando detección de World App...");
  
  isWorldApp = detectWorldApp();
  
  if (isWorldApp) {
    msg("✅ World App detectada");
    sdkReady = true;
  } else {
    msg("❌ Abre desde World App");
    console.log("❌ No se detectó World App");
  }
  
  console.log("🔍 Environment info:", {
    userAgent: navigator.userAgent,
    isWorldApp,
    windowKeys: Object.keys(window).filter(k => k.toLowerCase().includes('world')).slice(0, 5)
  });
});