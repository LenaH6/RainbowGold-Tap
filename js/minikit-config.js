// ===== RainbowGold · World ID login (Nativo + MiniKit + debug) =====

const DEV_MODE = false;

const APP_ID   = (window.WORLD_ID_APP_ID || "app_33bb8068826b85d4cd56d2ec2caba7cc").trim();
const ACTION   = (window.WORLD_ID_ACTION || "rainbowgold-login").trim();
const API_BASE = ((window.API_BASE || "").replace(/\/$/, "")) || window.location.origin;

// UI refs (opcionales)
const btn       = document.getElementById("wldSignIn");
const splash    = document.getElementById("splash");
const stateEl   = document.getElementById("wldState");
const refillBtn = document.getElementById("refillBtn");

// ---------- UI helpers ----------
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

// Debug overlay para ver objetos en pantalla (útil en móvil)
function debug(label, obj) {
  console.log(`🐞 ${label}:`, obj);
  const boxId = "__debug_box__";
  let box = document.getElementById(boxId);
  if (!box) {
    box = document.createElement("pre");
    box.id = boxId;
    box.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;max-height:45vh;overflow:auto;background:rgba(0,0,0,.6);color:#9ff;padding:8px;border:1px solid #0af;border-radius:10px;font:12px/1.35 monospace;z-index:99999;white-space:pre-wrap;";
    document.body.appendChild(box);
  }
  const text = typeof obj === "string" ? obj : safeString(obj);
  box.textContent = `${label}: ${text}\n\n` + (box.textContent || "").slice(0, 2000);
}
function safeString(v) {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

// ---------- Detección World App ----------
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

// ---------- Bridge nativo (postMessage) ----------
function nativeCall(type, params) {
  return new Promise((resolve, reject) => {
    const id = `${type}_${Date.now()}_${Math.random()}`;

    // Guardamos el último mensaje “parecido” por si el id no coincide
    let lastWorldIdLike = null;

    const looksLikeResult = (d) => {
      if (!d) return false;
      const r = d.result ?? d;
      return !!(
        r?.proof || r?.merkle_root || r?.merkleRoot || r?.nullifier_hash || r?.nullifierHash ||
        r?.verification_response || /worldid/i.test(String(r?.type || ""))
      );
    };

    const onMessage = (ev) => {
      const d = ev?.data;
      if (!d) return;

      // Log de todo lo que llegue que parezca del flujo
      if (looksLikeResult(d)) {
        lastWorldIdLike = d;
        debug("📩 message (candidate)", d);
      }

      // Coincidencia estricta por id / requestId
      if (d.id === id || d.requestId === id) {
        window.removeEventListener("message", onMessage);
        const payload = d.result ?? d;
        if (payload?.error) reject(new Error(payload.error));
        else resolve(payload);
      }
    };

    window.addEventListener("message", onMessage);

    const cleanupReject = (err) => {
      window.removeEventListener("message", onMessage);
      if (lastWorldIdLike) {
        // Si no llegó el id exacto, devolvemos el último candidato
        resolve(lastWorldIdLike);
      } else {
        reject(err);
      }
    };

    setTimeout(() => cleanupReject(new Error(`${type} timeout`)), 30_000);

    const message = { id, type, params };
    debug("📤 nativeCall -> worldapp.postMessage", message);

    try {
      if (window.webkit?.messageHandlers?.worldapp) {
        window.webkit.messageHandlers.worldapp.postMessage(message);
      } else if (window.Android?.worldapp) {
        window.Android.worldapp.postMessage(JSON.stringify(message));
      } else {
        window.parent?.postMessage(message, "*");
      }
    } catch (e) {
      cleanupReject(e);
    }
  });
}

// ---------- MiniKit helpers ----------
function loadMiniKitOnce() {
  return new Promise((resolve) => {
    if (window.MiniKit?.commandsAsync?.verify) return resolve(true);
    const urls = [
      "https://cdn.jsdelivr.net/npm/@worldcoin/minikit-js@1.6.0/dist/minikit.js",
      "https://unpkg.com/@worldcoin/minikit-js@1.6.0/dist/minikit.js"
    ];
    let i = 0;
    const tryNext = () => {
      if (window.MiniKit?.commandsAsync?.verify) return resolve(true);
      if (i >= urls.length) return resolve(false);
      const s = document.createElement("script");
      s.src = urls[i++]; s.async = true;
      s.onload  = () => resolve(!!(window.MiniKit?.commandsAsync?.verify));
      s.onerror = () => tryNext();
      document.head.appendChild(s);
    };
    tryNext();
  });
}
async function miniKitVerify(level) {
  const MK = window.MiniKit;
  if (!MK?.commandsAsync?.verify) return null;
  try {
    const res = await MK.commandsAsync.verify({
      action: ACTION,
      app_id: APP_ID,
      signal: "",
      verification_level: level
    });
    debug(`📥 MiniKit verify (${level}) raw`, res);
    return res;
  } catch (e) {
    console.warn("MiniKit.verify() falló:", e);
    return null;
  }
}

// ---------- Normalizador ----------
function normalizeWorldId(res) {
  const r = res?.result ?? res;
  if (!r || typeof r !== "object") return null;

  if (r.status === "cancelled" || r.status === "canceled" || r.cancelled === true) return { cancelled: true };
  if (r.error) return { error: r.error };

  const vr = r.verification_response || r.verificationResponse || r.response || r.data || r.payload || {};

  const merkle_root =
    r.merkle_root ?? r.merkleRoot ?? vr.merkle_root ?? vr.merkleRoot ?? r.root;

  const nullifier_hash =
    r.nullifier_hash ?? r.nullifierHash ?? vr.nullifier_hash ?? vr.nullifierHash ?? r.nullifier;

  let proof =
    (typeof r.proof === "string" ? r.proof : null) ??
    (typeof r.proof?.proof === "string" ? r.proof.proof : null) ??
    (typeof vr.proof === "string" ? vr.proof : null) ??
    (typeof vr.proof?.proof === "string" ? vr.proof.proof : null);

  const verification_level =
    r.verification_level ?? r.level ?? vr.verification_level ?? vr.level ?? "orb";

  const out = { proof, merkle_root, nullifier_hash, verification_level };
  return (out.proof && out.merkle_root && out.nullifier_hash) ? out : null;
}

// ---------- Flujo principal ----------
async function getWorldIdProof() {
  // Orden de intentos: Nativo orb → Nativo device → MiniKit orb → MiniKit device
  const levels = ["orb", "device"];

  // Intento nativo
  for (const lvl of levels) {
    try {
      debug("🚀 Native worldID request", { action: ACTION, app_id: APP_ID, lvl });
      const raw = await nativeCall("worldID", { action: ACTION, app_id: APP_ID, verification_level: lvl });
      debug(`📥 Native worldID (${lvl}) raw`, raw);
      if (raw?.status === "cancelled" || raw?.status === "canceled" || raw?.cancelled === true) {
        return { cancelled: true };
      }
      const norm = normalizeWorldId(raw);
      if (norm) return norm;
    } catch (e) {
      console.warn("native worldID error:", e);
    }
  }

  // Intento MiniKit
  await loadMiniKitOnce();
  if (window.MiniKit?.commandsAsync?.verify) {
    for (const lvl of levels) {
      const mk = await miniKitVerify(lvl);
      const norm = normalizeWorldId(mk);
      if (norm) return norm;
      if (mk?.status === "cancelled" || mk?.cancelled) return { cancelled: true };
    }
  }

  return null;
}

export async function startVerify() {
  if (DEV_MODE) {
    window.VERIFIED = true;
    window.SESSION_TOKEN = "dev_token";
    unlock(); msg("✅ DEV MODE"); return;
  }

  try {
    msg("Verificando entorno…");

    if (!detectWorldApp()) {
      msg("❌ Abre desde World App");
      alert("Abre esta miniapp desde World App (escaneando el QR).");
      return;
    }

    msg("Inicializando…");
    const proof = await getWorldIdProof();

    if (!proof) { msg("❌ World ID cancelado o inválido"); return; }
    if (proof.cancelled) { msg("❌ World ID cancelado"); return; }
    debug("✅ Proof normalizado", proof);

    msg("Validando con backend…");

    const res = await fetch(`${API_BASE}/api/minikit/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: ACTION,
        proof: proof.proof,
        merkle_root: proof.merkle_root,
        nullifier_hash: proof.nullifier_hash,
        verification_level: proof.verification_level || "orb",
      }),
    });

    const text = await res.text();
    let data = null; try { data = JSON.parse(text); } catch {}
    debug("📥 Backend response", { status: res.status, body: data || text });

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

// ------- Pago (opcional, igual que antes) -------
async function payRefill() {
  if (!window.SESSION_TOKEN) { alert("Primero verifica tu World ID."); return; }
  if (!detectWorldApp()) { alert("Abre esta función desde World App."); return; }

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
    debug("📥 Native pay raw", payRaw);

    if (!payRaw || payRaw.status !== "success") {
      msg("❌ Pago cancelado"); alert("Pago cancelado"); return;
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
      msg("✅ ¡Pago completado!"); alert("✅ Energía recargada");
    } else {
      msg("❌ Error confirmando pago"); alert("Error: " + (data.error || "unknown"));
    }
  } catch (e) {
    console.error("❌ Payment error:", e);
    msg("❌ Error en pago"); alert("Error: " + (e.message || e));
  }
}

// ------- Listeners -------
document.addEventListener("DOMContentLoaded", () => {
  if (detectWorldApp()) msg("✅ World App detectada"); else msg("❌ Abre desde World App");

  if (btn) {
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      btn.disabled = true; const prev = btn.textContent; btn.textContent = "Conectando…";
      try { await startVerify(); } finally { btn.disabled = false; btn.textContent = prev || "Entrar con World ID"; }
    });
  }
  if (refillBtn) {
    refillBtn.addEventListener("click", (ev) => { ev.preventDefault(); payRefill(); });
  }
});
