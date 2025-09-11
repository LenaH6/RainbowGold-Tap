// ===== RainbowGold · World ID login (Nativo + MiniKit fallback) =====

// --- Config ---
const DEV_MODE = false;
const APP_ID   = window.WORLD_ID_APP_ID || "app_33bb8068826b85d4cd56d2ec2caba7cc";
const ACTION   = window.WORLD_ID_ACTION || "rainbowgold-login";
const API_BASE = (window.API_BASE || "").replace(/\/$/, "") || window.location.origin;

// --- UI refs ---
const btn       = document.getElementById("wldSignIn");
const splash    = document.getElementById("splash");
const stateEl   = document.getElementById("wldState");
const refillBtn = document.getElementById("refillBtn");

// --- UI helpers ---
function msg(t) {
  if (stateEl) { stateEl.textContent = t; stateEl.style.opacity = "1"; }
  console.log("🔔", t);
}
function unlock() {
  try {
    document.querySelectorAll("#coin,.btn-icon,.fab").forEach(el => el.style.pointerEvents = "");
    if (splash) { splash.classList.add("splash-hide"); setTimeout(() => splash.remove(), 450); }
  } catch {}
}

// --- Detección de World App ---
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

// --- Puente nativo (postMessage) ---
function nativeCall(type, params) {
  return new Promise((resolve, reject) => {
    const id = `${type}_${Date.now()}_${Math.random()}`;

    const onMessage = (ev) => {
      if (ev?.data?.id === id) {
        window.removeEventListener("message", onMessage);
        if (ev.data.error) reject(new Error(ev.data.error));
        else resolve(ev.data.result ?? ev.data); // por si viene sin .result
      }
    };
    window.addEventListener("message", onMessage);

    setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error(`${type} timeout`));
    }, 30_000);

    const message = { id, type, params };
    try {
      if (window.webkit?.messageHandlers?.worldapp) {
        window.webkit.messageHandlers.worldapp.postMessage(message);
      } else if (window.Android?.worldapp) {
        window.Android.worldapp.postMessage(JSON.stringify(message));
      } else {
        // iframe fallback
        window.parent?.postMessage(message, "*");
      }
    } catch (e) {
      window.removeEventListener("message", onMessage);
      reject(e);
    }
  });
}

// --- MiniKit (si está cargado y operativo) ---
async function tryMiniKitVerify() {
  const MK = window.MiniKit;
  if (!MK?.commandsAsync?.verify) return null;
  try {
    console.log("🧪 Intentando MiniKit.verify()");
    const res = await MK.commandsAsync.verify({
      action: ACTION,
      app_id: APP_ID,
      signal: "",                 // opcional
      verification_level: "orb"   // recomendado
    });
    return res;
  } catch (e) {
    console.warn("MiniKit.verify() falló:", e);
    return null;
  }
}

// --- Normalizador de respuesta World ID ---
function normalizeWorldId(res) {
  // Puede venir en distintas formas: {status, proof,...} o {result:{...}} o anidado
  let r = res?.result ?? res;
  if (!r || typeof r !== "object") return null;

  // Algunas implementaciones devuelven { status: "success", ... }
  if (r.status === "cancelled") return { cancelled: true };
  if (r.error) return { error: r.error };

  // A veces proof viene anidado: { proof: { proof: '0x...' } }
  const proof =
    typeof r.proof === "string" ? r.proof :
    typeof r.proof?.proof === "string" ? r.proof.proof :
    r.proof;

  const out = {
    proof,
    merkle_root: r.merkle_root || r.merkleRoot,
    nullifier_hash: r.nullifier_hash || r.nullifierHash,
    verification_level: r.verification_level || r.level || "orb"
  };

  if (out.proof && out.merkle_root && out.nullifier_hash) return out;
  return null;
}

// --- LOGIN principal ---
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

    if (!detectWorldApp()) {
      msg("❌ Abre desde World App");
      alert("Abre esta miniapp desde World App (escaneando el QR).");
      return;
    }

    msg("Inicializando World ID…");

    // 1) Intento Nativo
    let raw = null, norm = null, lastError = null;

    try {
      raw = await nativeCall("worldID", {
        action: ACTION,
        app_id: APP_ID,
        verification_level: "orb"
      });
      console.log("📥 Native worldID raw:", raw);
      if (raw?.status === "cancelled") {
        return msg("❌ World ID cancelado");
      }
      norm = normalizeWorldId(raw);
    } catch (e) {
      console.warn("native worldID falló:", e);
      lastError = e;
    }

    // 2) Si nativo no dio datos útiles, probamos MiniKit si existe
    if (!norm) {
      const mk = await tryMiniKitVerify();
      console.log("📥 MiniKit verify raw:", mk);
      norm = normalizeWorldId(mk);
    }

    if (!norm) {
      console.log("🧾 Respuestas crudas para debug:", { rawNative: raw, lastError });
      msg("❌ World ID cancelado o inválido");
      return;
    }

    // 3) Verificación en tu backend
    msg("Validando con backend…");

    const payload = {
      action: ACTION,
      proof: norm.proof,
      merkle_root: norm.merkle_root,
      nullifier_hash: norm.nullifier_hash,
      verification_level: norm.verification_level
    };

    console.log("📤 Payload /api/minikit/verify:", payload);

    const res = await fetch(`${API_BASE}/api/minikit/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    console.log("📥 Backend status:", res.status, "body:", text);

    if (!res.ok || !data?.ok) {
      msg(`❌ Backend ${res.status}: ${data?.error || text || "invalid_proof"}`);
      alert(`Error de verificación: ${data?.error || text || "invalid_proof"}`);
      return;
    }

    // 4) OK → sesión
    window.VERIFIED = true;
    window.SESSION_TOKEN = data.token;

    try {
      if (data.state) {
        window.wld    = +data.state.wld    || 0;
        window.rbgp   = +data.state.rbgp   || 0;
        window.energy = +data.state.energy || 100;
        window.render?.();
      }
    } catch {}

    unlock();
    msg("✅ ¡Verificado con World ID!");
  } catch (err) {
    console.error("❌ Error en World ID:", err);
    const m = String(err?.message || err || "");
    if (m.includes("timeout")) msg("❌ Timeout - intenta de nuevo");
    else msg(`❌ ${m || "Error inesperado"}`);
  }
}

// --- Pago opcional (mismo puente nativo) ---
async function payRefill() {
  if (!detectWorldApp()) { alert("Abre esta función desde World App."); return; }
  if (!window.SESSION_TOKEN) { alert("Primero verifica tu World ID."); return; }

  try {
    msg("Procesando pago…");

    const amount = (typeof window.priceRefill === "function" ? window.priceRefill() : "0.10") || "0.10";
    const payRaw = await nativeCall("pay", {
      to:   "0x91bf252c335f2540871dd02ef1476ae193a5bc8a",
      token:"WLD",
      amount,
      reference: crypto.randomUUID(),
      action: "rainbowgold"
    });
    console.log("📥 Native pay raw:", payRaw);

    if (!payRaw || payRaw.status !== "success") {
      msg("❌ Pago cancelado");
      alert("Pago cancelado");
      return;
    }

    const r = await fetch(`${API_BASE}/api/pay/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payRaw, token: window.SESSION_TOKEN, action: "rainbowgold" })
    });

    const data = await r.json().catch(() => ({}));
    if (data.ok) {
      window.SESSION_TOKEN = data.token || window.SESSION_TOKEN;
      try {
        window.wld    = +data.state?.wld    || 0;
        window.rbgp   = +data.state?.rbgp   || 0;
        window.energy = +data.state?.energy || 100;
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

// --- Listeners ---
document.addEventListener("DOMContentLoaded", () => {
  if (detectWorldApp()) msg("✅ World App detectada"); else msg("❌ Abre desde World App");

  if (btn) {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "Conectando…";
      try { await startVerify(); }
      finally { btn.disabled = false; btn.textContent = prev || "Entrar con World ID"; }
    });
  }
  if (refillBtn) {
    refillBtn.addEventListener("click", (ev) => { ev.preventDefault(); payRefill(); });
  }
});
