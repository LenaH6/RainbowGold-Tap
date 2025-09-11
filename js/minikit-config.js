// ===== RainbowGold · World ID login =====
// • Intenta Nativo (postMessage) primero
// • Si no, MiniKit.verify con carga diferida
// • Normaliza varias formas de respuesta (proof/root/nullifier)

const DEV_MODE = false;

const APP_ID   = (window.WORLD_ID_APP_ID || "app_33bb8068826b85d4cd56d2ec2caba7cc").trim();
const ACTION   = (window.WORLD_ID_ACTION || "rainbowgold-login").trim();
const API_BASE = ((window.API_BASE || "").replace(/\/$/, "")) || window.location.origin;

// === UI refs (opcionales; si faltan no pasa nada)
const btn       = document.getElementById("wldSignIn");
const splash    = document.getElementById("splash");
const stateEl   = document.getElementById("wldState");
const refillBtn = document.getElementById("refillBtn");

// ---------------- UI helpers ----------------
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

// --------------- Detección World App ---------------
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

// --------------- Bridge nativo (postMessage) ---------------
function nativeCall(type, params) {
  return new Promise((resolve, reject) => {
    const id = `${type}_${Date.now()}_${Math.random()}`;
    const onMessage = (ev) => {
      if (ev?.data?.id === id) {
        window.removeEventListener("message", onMessage);
        const payload = ev.data.result ?? ev.data;
        if (payload?.error) reject(new Error(payload.error));
        else resolve(payload);
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
        window.parent?.postMessage(message, "*");
      }
    } catch (e) {
      window.removeEventListener("message", onMessage);
      reject(e);
    }
  });
}

// --------------- MiniKit helpers ---------------
function loadMiniKitOnce() {
  return new Promise((resolve) => {
    if (window.MiniKit?.commandsAsync?.verify) return resolve(true);

    const urls = [
      "https://cdn.jsdelivr.net/npm/@worldcoin/minikit-js@1.6.0/dist/minikit.js",
      "https://unpkg.com/@worldcoin/minikit-js@1.6.0/dist/minikit.js"
    ];
    let idx = 0;

    function tryNext() {
      if (window.MiniKit?.commandsAsync?.verify) return resolve(true);
      if (idx >= urls.length) return resolve(false);
      const s = document.createElement("script");
      s.src = urls[idx++]; s.async = true;
      s.onload  = () => resolve(!!(window.MiniKit?.commandsAsync?.verify));
      s.onerror = () => tryNext();
      document.head.appendChild(s);
    }
    tryNext();
  });
}

async function miniKitVerify() {
  const MK = window.MiniKit;
  if (!MK?.commandsAsync?.verify) return null;
  try {
    console.log("🧪 MiniKit.verify()…");
    const res = await MK.commandsAsync.verify({
      action: ACTION,
      app_id: APP_ID,
      signal: "",
      verification_level: "orb"
    });
    return res;
  } catch (e) {
    console.warn("MiniKit.verify() falló:", e);
    return null;
  }
}

// --------------- Normalizador de respuestas ---------------
function normalizeWorldId(res) {
  // admite {result:{...}}, o {status,proof...}, o estructuras anidadas
  const r = res?.result ?? res;
  if (!r || typeof r !== "object") return null;

  if (r.status === "cancelled" || r.cancelled === true) return { cancelled: true };
  if (r.error) return { error: r.error };

  // Mapear posibles alias/camelCase
  const merkle_root =
    r.merkle_root ?? r.merkleRoot ?? r.root ?? r.verification_response?.merkle_root ?? r.verification_response?.merkleRoot;

  const nullifier_hash =
    r.nullifier_hash ?? r.nullifierHash ?? r.nullifier ?? r.verification_response?.nullifier_hash ?? r.verification_response?.nullifierHash;

  let proof =
    (typeof r.proof === "string" ? r.proof : null) ??
    (typeof r.proof?.proof === "string" ? r.proof.proof : null) ??
    (typeof r.verification_response?.proof === "string" ? r.verification_response.proof : null) ??
    (typeof r.verification_response?.proof?.proof === "string" ? r.verification_response.proof.proof : null);

  const verification_level =
    r.verification_level ?? r.level ?? r.credential_type ?? r.verification_response?.credential_type ?? "orb";

  const out = { proof, merkle_root, nullifier_hash, verification_level };

  if (out.proof && out.merkle_root && out.nullifier_hash) return out;
  return null;
}

// --------------- LOGIN principal ---------------
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

    let raw = null, norm = null, lastError = null;

    // 1) Intento Nativo
    try {
      raw = await nativeCall("worldID", { action: ACTION, app_id: APP_ID, verification_level: "orb" });
      console.log("📥 Native worldID raw:", raw);
      if (raw?.status === "cancelled" || raw?.cancelled === true) {
        msg("❌ World ID cancelado");
        return;
      }
      norm = normalizeWorldId(raw);
    } catch (e) {
      console.warn("native worldID falló:", e);
      lastError = e;
    }

    // 2) Si nativo no sirve, intentamos MiniKit (cargándolo si hace falta)
    if (!norm) {
      await loadMiniKitOnce();
      const mkRaw = await miniKitVerify();
      console.log("📥 MiniKit verify raw:", mkRaw);
      norm = normalizeWorldId(mkRaw);
    }

    if (!norm) {
      console.log("🧾 Respuestas crudas para debug:", { rawNative: raw, lastError, hasMiniKit: !!window.MiniKit });
      msg("❌ World ID cancelado o inválido");
      return;
    }

    // 3) Verificación en backend
    msg("Validando con backend…");

    const payload = {
      action: ACTION,
      proof: norm.proof,
      merkle_root: norm.merkle_root,
      nullifier_hash: norm.nullifier_hash,
      verification_level: norm.verification_level || "orb",
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
      alert(`Error verificación: ${data?.error || text || "invalid_proof"}`);
      return;
    }

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

// --------------- Pago opcional ---------------
async function payRefill() {
  if (!detectWorldApp()) { alert("Abre esta función desde World App."); return; }
  if (!window.SESSION_TOKEN) { alert("Primero verifica tu World ID."); return; }
  try {
    msg("Procesando pago…");
    const amount = (typeof window.priceRefill === "function" ? window.priceRefill() : "0.10") || "0.10";
    const payRaw = await nativeCall("pay", {
      to: "0x91bf252c335f2540871dd02ef1476ae193a5bc8a",
      token: "WLD",
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

// --------------- Listeners ---------------
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
