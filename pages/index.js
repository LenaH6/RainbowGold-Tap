<!-- Asegúrate que el archivo real esté en public/js/mk-hooks.js, NO dentro de src -->

/* ====== RainbowGold — Hooks con MiniKit v1.9.x ====== */

/** Dirección destino (whitelist en Developer Portal) */
const PAY_TO = "0x91bf252c335f2540871d0d2ef1476ae193a5bc8a";

/** Utilidad: WLD -> 18 decimales string */
function tokenToDecimals(amount) {
  const [i, f = ""] = String(amount).split(".");
  const frac = (f + "000000000000000000").slice(0, 18);
  return (BigInt(i || "0") * (10n ** 18n) + BigInt(frac)).toString();
}

/** === LOGIN / SIWE (7 días) === */
window.handleLogin = async function () {
  try {
    if (!window.MiniKit?.isInstalled?.()) {
      alert("Abre desde World App");
      return;
    }

    const result = await window.MiniKit.commandsAsync.walletAuth({
      statement: "Inicia sesión en RainbowGold",
      expirationTime: new Date(Date.now() + 7 * 86400 * 1000).toISOString(), // 7 días
    });

    if (result?.finalPayload?.status === "success") {
      const addr = result.finalPayload.address;

      // Completa SIWE en tu backend (firma -> cookie 7 días)
      await fetch("/api/complete-siwe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: result.finalPayload.message,
          signature: result.finalPayload.signature
        })
      });

      await hydrateProfile(addr);
      // Arrancar juego si existe
      if (typeof window.__startGame === "function") window.__startGame();
    }
  } catch (err) {
    console.error("Error en login:", err);
    alert("Falló el login");
  }
};
// Alias por compatibilidad con HTML legacy
window.Login = window.handleLogin;

/** === Pago genérico (Ticket / Refill) === */
async function payWLD({ description, amountWLD }) {
  try {
    if (!window.MiniKit?.isInstalled?.()) {
      alert("Abre desde World App");
      return false;
    }

    // 1) Pide reference y precio final al servidor
    const initRes = await fetch("/api/initiate-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refillPrice: amountWLD }) // <- respeta precio
    });
    const { id: reference, amountWLD: serverAmount } = await initRes.json();

    // 2) Drawer nativo de pago
    const payload = {
      reference,
      to: PAY_TO,
      tokens: [{ symbol: "WLD", token_amount: tokenToDecimals(serverAmount) }],
      description,
    };

    const { finalPayload } = await window.MiniKit.commandsAsync.pay(payload);

    // 3) Confirmar con Developer Portal
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
  } catch (err) {
    console.error("Error en pago:", err);
    return false;
  }
}

/** === Botón Refill === */
window.handleRefillPayment = async () => {
  const cap = Number(document.getElementById("energyMax")?.textContent || 100);
  const price = Math.max(0.1, cap * 0.001); // 0.1% de la capacidad
  const ok = await payWLD({ description: "RainbowGold — Energy Refill", amountWLD: price });
  if (ok) {
    if (typeof window.onEnergyRefilled === "function") window.onEnergyRefilled();
  } else {
    alert("Pago de refill no confirmado.");
  }
};

/** === Botón Ideas === */
window.handleIdeaPayment = async () => {
  const ok = await payWLD({ description: "RainbowGold — Idea Ticket", amountWLD: 1 });
  if (ok) {
    const exp = Date.now() + 5 * 60 * 1000; // ticket 5 min
    if (typeof window.onIdeaTicketGranted === "function") window.onIdeaTicketGranted(exp);
  } else {
    alert("Pago de idea no confirmado.");
  }
};

/** === Perfil / Balance === */
async function hydrateProfile(address) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  // Nombre de usuario = dirección, fijo y deshabilitado
  const userInput = document.getElementById("usernameInput");
  if (userInput) {
    userInput.value = short;
    userInput.disabled = true;
  }

  // Balance WLD (placeholder con opción real vía backend)
  try {
    const r = await fetch("/api/profile", { credentials: "include" });
    const prof = await r.json(); // { wldBalance?: string }
    const topW = document.getElementById("balWLD");
    if (topW) topW.textContent = prof?.wldBalance ?? "--";
  } catch {
    const topW = document.getElementById("balWLD");
    if (topW) topW.textContent = "--";
  }
}

