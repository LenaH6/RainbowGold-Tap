// ===== MiniKit World App Config - CORREGIDO =====
const DEV_MODE = false; // <<<<<< PRODUCCIÓN (en revisión, dejar siempre en false)

if (DEV_MODE) {
  window.VERIFIED = true;
  window.SESSION_TOKEN = "dev_test_token";
  setVerifiedUI?.(true);
  try { unlock?.(); } catch (_) {}
}

// ===== Configuración de constantes =====
const ACTION_ID_REFILL = "rainbowgold";
const ACTION_ID_IDEAS = "ideas";
const MERCHANT = "0x91bf252c335f2540871dd02ef1476ae193a5bc8a";
const TOKEN = "WLD";
const AMOUNT = priceRefill(); // dinámico

// ===== Referencias UI =====
const btn = document.getElementById("wldSignIn");
const splash = document.getElementById("splash");
const state = document.getElementById("wldState");
const refillBtn = document.getElementById("refillBtn");
const payIdeasBtn = document.getElementById("payIdeasBtn");

// ===== Helpers UI =====
function msg(t) {
  if (state) { 
    state.textContent = t; 
    state.style.opacity = "1"; 
  }
  console.log("MiniKit:", t);
}

function unlock() {
  document.querySelectorAll("#coin,.btn-icon,.fab").forEach(el => el.style.pointerEvents = "");
  if (splash) { 
    splash.classList.add("splash-hide"); 
    setTimeout(() => splash.remove(), 450); 
  }
  try { playSnd("join", { volume: 0.9 }); } catch(_) {}
}

// ===== Detección y carga de MiniKit =====
let MiniKit = null;
let isLoaded = false;

function initializeMiniKit() {
  // 1. Verificar si ya existe globalmente
  if (window.MiniKit) {
    MiniKit = window.MiniKit;
    console.log("✅ MiniKit found globally:", MiniKit);
    return true;
  }

  // 2. Verificar otras referencias globales
  if (window.worldcoin) {
    MiniKit = window.worldcoin;
    console.log("✅ MiniKit found as worldcoin:", MiniKit);
    return true;
  }

  return false;
}

function waitForMiniKit(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function check() {
      if (initializeMiniKit()) {
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        reject(new Error("MiniKit no se cargó en el tiempo esperado"));
        return;
      }
      
      setTimeout(check, 100);
    }
    
    check();
  });
}

function hasMiniKit() {
  if (DEV_MODE) return true;
  
  if (!MiniKit) {
    console.warn("❌ MiniKit no está disponible");
    return false;
  }

  // Verificar métodos disponibles
  console.log("🔍 MiniKit object:", MiniKit);
  console.log("🔍 MiniKit methods:", Object.keys(MiniKit));
  
  if (MiniKit.commands) {
    console.log("🔍 MiniKit.commands:", Object.keys(MiniKit.commands));
  }
  
  if (MiniKit.commandsAsync) {
    console.log("🔍 MiniKit.commandsAsync:", Object.keys(MiniKit.commandsAsync));
  }

  const hasCommands = MiniKit.commandsAsync || MiniKit.commands;
  return !!hasCommands;
}

function requireMiniKit() {
  if (DEV_MODE) return true;
  
  const ok = hasMiniKit();
  if (!ok) {
    msg("❌ Ábrelo desde World App (no navegador)");
    alert("Debes abrir esta aplicación desde el escáner QR de World App, no desde un navegador web.");
  }
  return ok;
}

// ===== Login con World ID - VERSIÓN CORREGIDA =====
export async function startVerify() {
  if (DEV_MODE) {
    if (typeof window !== 'undefined') {
      window.VERIFIED = true;
      if (!window.SESSION_TOKEN) window.SESSION_TOKEN = "dev_test_token";
      try { setVerifiedUI?.(true); } catch(_) {}
      try { unlock?.(); } catch(_) {}
      msg("DEV MODE: verificación simulada ✓");
    }
    return;
  }

  try {
    msg("Esperando MiniKit...");
    
    // Esperar a que MiniKit esté disponible
    await waitForMiniKit();
    
    if (!requireMiniKit()) {
      return;
    }

    msg("Iniciando verificación World ID...");

    // Intentar diferentes métodos según la versión del SDK
    let response;
    
    if (MiniKit.commandsAsync && MiniKit.commandsAsync.worldID) {
      // Método nuevo (v1.5+)
      response = await MiniKit.commandsAsync.worldID({
        action: "rainbowgold-login",
        app_id: "app_33bb8068826b85d4cd56d2ec2caba7cc",
        verification_level: "orb"
      });
    } else if (MiniKit.commands && MiniKit.commands.worldID) {
      // Método legacy
      response = await new Promise((resolve, reject) => {
        MiniKit.commands.worldID({
          action: "rainbowgold-login",
          app_id: "app_33bb8068826b85d4cd56d2ec2caba7cc",
          verification_level: "orb"
        }, (result) => {
          resolve(result);
        });
      });
    } else if (MiniKit.worldID) {
      // Método directo
      response = await MiniKit.worldID({
        action: "rainbowgold-login",
        app_id: "app_33bb8068826b85d4cd56d2ec2caba7cc",
        verification_level: "orb"
      });
    } else {
      throw new Error("No se encontró método worldID en MiniKit");
    }

    console.log("📱 World ID Response:", response);

    // Procesar respuesta
    const payload = response.commandPayload || response;
    
    if (payload.status === "success" || payload.success) {
      msg("Verificando con servidor...");
      
      const backendResponse = await fetch(`${window.API_BASE}/api/minikit/verify`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "rainbowgold-login",
          proof: payload.proof,
          merkle_root: payload.merkle_root,
          nullifier_hash: payload.nullifier_hash,
          verification_level: payload.verification_level
        })
      });

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        console.error("❌ Backend error:", errorText);
        msg(`❌ Error del servidor: ${backendResponse.status}`);
        return;
      }

      const data = await backendResponse.json();
      
      if (data.ok) {
        window.VERIFIED = true;
        window.SESSION_TOKEN = data.token;
        setVerifiedUI?.(true);
        unlock?.();
        msg("✅ Verificado con World ID");
        
        // Cargar estado del usuario si existe
        if (data.state) {
          wld = +data.state.wld || 0;
          rbgp = +data.state.rbgp || 0;
          energy = +data.state.energy || 100;
          render?.();
        }
      } else {
        msg("❌ Error en verificación: " + (data.error || "Desconocido"));
        console.error("Verification failed:", data);
      }
    } else {
      msg("❌ Verificación cancelada o fallida");
      console.log("Verification cancelled:", payload);
    }
  } catch (error) {
    console.error("❌ Error en World ID:", error);
    msg("❌ Error: " + error.message);
  }
}

// ===== Handler del botón de login =====
if (btn) {
  btn.onclick = async (ev) => {
    ev.preventDefault();
    
    btn.disabled = true;
    btn.style.opacity = "0.6";
    
    try {
      await startVerify();
    } catch (error) {
      console.error("Error en login:", error);
      msg("❌ Error inesperado: " + error.message);
    } finally {
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  };
}

// ===== Pago Refill =====
async function payRefill() {
  if (!requireMiniKit()) return;
  if (!window.SESSION_TOKEN) { 
    alert("Verifícate primero."); 
    return; 
  }

  if (DEV_MODE) {
    alert("✓ DEV: Pago simulado de 0.10 WLD");
    energy = capMax(); 
    render();
    return;
  }

  try {
    let response;
    
    if (MiniKit.commandsAsync && MiniKit.commandsAsync.pay) {
      response = await MiniKit.commandsAsync.pay({
        to: MERCHANT,
        token: TOKEN,
        amount: AMOUNT,
        reference: crypto.randomUUID(),
        action: ACTION_ID_REFILL
      });
    } else if (MiniKit.commands && MiniKit.commands.pay) {
      response = await new Promise((resolve) => {
        MiniKit.commands.pay({
          to: MERCHANT,
          token: TOKEN,
          amount: AMOUNT,
          reference: crypto.randomUUID(),
          action: ACTION_ID_REFILL
        }, resolve);
      });
    } else {
      throw new Error("Método de pago no disponible");
    }

    if (response.status === "success") {
      let r = await fetch(`${window.API_BASE}/api/pay/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...response, 
          token: window.SESSION_TOKEN, 
          action: "rainbowgold" 
        })
      });
      
      let data = await r.json();

      if (data.ok) {
        window.SESSION_TOKEN = data.token;
        wld = +data.state.wld;
        rbgp = +data.state.rbgp;
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
    alert("Error en el pago: " + e.message);
  }
}

if (refillBtn) {
  refillBtn.onclick = ev => { 
    ev.preventDefault(); 
    payRefill(); 
  };
}

// ===== Inicialización =====
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 Iniciando MiniKit...");
  
  // Intentar inicializar inmediatamente
  if (!initializeMiniKit()) {
    console.log("⏳ Esperando que MiniKit se cargue...");
    
    // Esperar un poco más para el script externo
    setTimeout(() => {
      if (initializeMiniKit()) {
        console.log("✅ MiniKit cargado después del timeout");
      } else {
        console.warn("❌ MiniKit no se pudo cargar");
        msg("❌ SDK no disponible");
      }
    }, 2000);
  }
});

// Detectar cuando el script externo se carga
window.addEventListener('load', () => {
  if (!isLoaded && initializeMiniKit()) {
    console.log("✅ MiniKit cargado en window.load");
    isLoaded = true;
  }
});