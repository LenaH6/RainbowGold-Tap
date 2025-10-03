// ===== RainbowGold — MiniKit BASE estable =====

// destino (whitelist en Developer Portal)
const PAY_TO = "0x91bf252c335f2540871d0d2ef1476ae193a5bc8a";

// Utilidad: WLD -> 18 decimales
function tokenToDecimals(amount) {
  const [i, f = ""] = String(amount).split(".");
  const frac = (f + "000000000000000000").slice(0, 18);
  return (BigInt(i || "0") * (10n ** 18n) + BigInt(frac)).toString();
}

// Espera cortita a MiniKit (máx 2s, retry cada 120ms)
async function waitMiniKit(maxMs = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    if (window.MiniKit && typeof window.MiniKit.commandsAsync?.walletAuth === "function") return true;
    await new Promise(r => setTimeout(r, 120));
  }
  return !!(window.MiniKit && typeof window.MiniKit.commandsAsync?.walletAuth === "function");
}

// ===== LOGIN / SIWE 7 días =====
async function doLogin() {
  const ok = await waitMiniKit(2000);
  if (!ok) {
    alert("Abre desde World App (o vuelve a intentar en 1–2s).");
    return;
  }
  const result = await window.MiniKit.commandsAsync.walletAuth({
    statement: "Inicia sesión en RainbowGold",
    expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  if (result?.finalPayload?.status === "success") {
    const addr = result.finalPayload.address;

    // (opcional) completa SIWE en backend; si no existe el endpoint, no rompas
    try {
      await fetch("/api/complete-siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: result.finalPayload.message,
          signature: result.finalPayload.signature
        })
      });
    } catch (e) { /* no-op */ }

    await hydrateProfile(addr);

    // arrancar juego si existe
    if (typeof window.__startGame === "function") window.__startGame();
  }
}

// click handler público
window.handleLogin = () => {
  doLogin().catch(err => {
    console.error("login error", err);
    alert("Falló el login.");
  });
};
// compat con HTML legacy
window.Login = window.handleLogin;

// ===== PAGOS =====
async function payWLD({ description, amountWLD }) {
  const ok = await waitMiniKit(2000);
  if (!ok) {
    alert("Abre desde World App (o vuelve a intentar en 1–2s).");
    return false;
  }

  // 1) reference + precio (respetado en server)
  const initRes = await fetch("/api/initiate-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ refillPrice: amountWLD }),
  });
  const initJson = await initRes.json();
  const reference = initJson.id;
  const serverAmount = initJson.amountWLD ?? amountWLD;

  // 2) Drawer nativo
  const payload = {
    reference,
    to: PAY_TO,
    tokens: [{ symbol: "WLD", token_amount: tokenToDecimals(serverAmount) }],
    description,
  };
  const { finalPayload } = await window.MiniKit.commandsAsync.pay(payload);

  // 3) Confirmación con Developer Portal
  if (finalPayload?.status === "success") {
    const confirm = await fetch("/api/confirm-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ payload: finalPayload }),
    });
    const out = await confirm.json();
    return !!out.success;
  }
  return false;
}

window.handleRefillPayment = async () => {
  const cap = Number(document.getElementById("energyMax")?.textContent || 100);
  const price = Math.max(0.1, cap * 0.001);
  const ok = await payWLD({ description: "RainbowGold — Energy Refill", amountWLD: price });
  if (ok) {
    if (typeof window.onEnergyRefilled === "function") window.onEnergyRefilled();
  } else {
    alert("Pago de refill no confirmado.");
  }
};

window.handleIdeaPayment = async () => {
  const ok = await payWLD({ description: "RainbowGold — Idea Ticket", amountWLD: 1 });
  if (ok) {
    const exp = Date.now() + 5 * 60 * 1000;
    if (typeof window.onIdeaTicketGranted === "function") window.onIdeaTicketGranted(exp);
  } else {
    alert("Pago de idea no confirmado.");
  }
};

// ===== PERFIL / BALANCE placeholder =====
async function hydrateProfile(address) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const userInput = document.getElementById("usernameInput");
  if (userInput) {
    userInput.value = short;
    userInput.disabled = true;
  }
  try {
    const r = await fetch("/api/profile", { credentials: "include" });
    const prof = await r.json();
    const topW = document.getElementById("balWLD");
    if (topW) topW.textContent = prof?.wldBalance ?? "--";
  } catch {
    const topW = document.getElementById("balWLD");
    if (topW) topW.textContent = "--";
  }
}
