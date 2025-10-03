// ====== RainbowGold — Hooks con MiniKit v1.9.x ======

// Dirección de destino autorizada en tu Developer Portal
const PAY_TO = "0x91bf252c335f2540871d0d2ef1476ae193a5bc8a";

// === Utilidades ===
function tokenToDecimals(amount) {
  const [i, f = ""] = String(amount).split(".");
  const frac = (f + "000000000000000000").slice(0, 18);
  return (BigInt(i || "0") * (10n ** 18n) + BigInt(frac)).toString();
}

// === LOGIN / SIWE ===
window.handleLogin = async function () {
  try {
    if (!window.MiniKit?.isInstalled?.()) {
      alert("Abre desde World App");
      return;
    }

    const result = await window.MiniKit.commandsAsync.walletAuth({
      statement: "Inicia sesión en RainbowGold",
      expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
    });

    if (result?.finalPayload?.status === "success") {
      const addr = result.finalPayload.address;
      await hydrateProfile(addr);
      // Arrancar el juego (definido en app-legacy.js)
      if (typeof window.__startGame === "function") {
        window.__startGame();
      }
    }
  } catch (err) {
    console.error("Error en login:", err);
    alert("Falló el login");
  }
};

// Exponer alias "Login" para retrocompatibilidad con el HTML existente
window.Login = window.handleLogin;

// === PAGO GENÉRICO ===
async function payWLD({ description, amountWLD }) {
  try {
    if (!window.MiniKit?.isInstalled?.()) {
      alert("Abre desde World App");
      return false;
    }

    // 1) Inicia en backend y obtén reference (respetando el precio indicado)
    const initRes = await fetch("/api/initiate-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Enviamos refillPrice para que el backend devuelva exactamente este monto
      body: JSON.stringify({ refillPrice: amountWLD }),
    });
    const { id: reference } = await initRes.json();

    // 2) Drawer nativo de pago
    const payload = {
      reference,
      to: PAY_TO,
      tokens: [{ symbol: "WLD", token_amount: tokenToDecimals(amountWLD) }],
      description,
    };

    const { finalPayload } = await window.MiniKit.commandsAsync.pay(payload);

    // 3) Validar en backend
    if (finalPayload?.status === "success") {
      const confirm = await fetch("/api/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: finalPayload }),
      });
      const out = await confirm.json();
      return !!out.success;
    }
    return false;
  } catch (err) {
    console.error("Error en pago:", err);
    return false;
  }
}

// === RECHARGE / REFILL ===
window.handleRefillPayment = async () => {
  const cap = Number(document.getElementById("energyMax")?.textContent || 100);
  const price = Math.max(0.1, cap * 0.001); // 0.1% de la capacidad
  const ok = await payWLD({
    description: "RainbowGold — Energy Refill",
    amountWLD: price,
  });

  if (ok) {
    if (typeof window.onEnergyRefilled === "function") {
      window.onEnergyRefilled(); // definido en tu lógica de energía
    }
  } else {
    alert("Pago de refill no confirmado.");
  }
};

// === IDEAS ===
window.handleIdeaPayment = async () => {
  const ok = await payWLD({
    description: "RainbowGold — Idea Ticket",
    amountWLD: 1,
  });

  if (ok) {
    // ticket con expiración 5 min
    const exp = Date.now() + 5 * 60 * 1000;
    if (typeof window.onIdeaTicketGranted === "function") {
      window.onIdeaTicketGranted(exp); // definido en tu lógica de ideas
    }
  } else {
    alert("Pago de idea no confirmado.");
  }
};

// === PERFIL / BALANCES ===
async function hydrateProfile(address) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const userInput = document.getElementById("usernameInput");
  if (userInput) {
    userInput.value = short;
    userInput.disabled = true;
  }

  // TODO: sustituir por balance real desde tu backend / World App portal
  const profW = document.getElementById("profWLD");
  const topW = document.getElementById("balWLD");
  if (profW) profW.textContent = "--"; // placeholder
  if (topW) topW.textContent = "0.00"; // placeholder
}
