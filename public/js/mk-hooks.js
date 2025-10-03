// ====== RainbowGold — Hooks con MiniKit v1.9.x ======

// Dirección de destino autorizada en tu Developer Portal
const PAY_TO = "0x91bf252c335f2540871d0d2ef1476ae193a5bc8a";

/** Espera a que MiniKit esté disponible (evita falsos "no instalado") */
async function waitForMiniKit(maxMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      if (window.MiniKit?.isInstalled?.()) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  return !!(window.MiniKit?.isInstalled?.());
}

// === Utilidades ===
function tokenToDecimals(amount) {
  const [i, f = ""] = String(amount).split(".");
  const frac = (f + "000000000000000000").slice(0, 18);
  return (BigInt(i || "0") * (10n ** 18n) + BigInt(frac)).toString();
}

// === LOGIN / SIWE ===
window.handleLogin = async function () {
  try {
    // NUEVO: espera a MiniKit
    const ready = await waitForMiniKit(5000);
    if (!ready) {
      const msg = [
        "Abre desde World App.",
        `Host: ${location.origin}`,
        "Si estás en World App, dale reintentar en 2s (MiniKit aún no estaba listo)."
      ].join("\n");
      alert(msg);
      return;
    }

    const result = await window.MiniKit.commandsAsync.walletAuth({
      statement: "Inicia sesión en RainbowGold",
      expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
    });

    if (result?.finalPayload?.status === "success") {
      const addr = result.finalPayload.address;

      // Completa SIWE en backend (opcional si ya lo tenías)
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
      } catch (e) {
        // si no tienes ese endpoint, no rompas el login visual
        console.warn("complete-siwe falló (opcional):", e);
      }

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

// Alias por compat: si el HTML tenía onclick="Login()"
window.Login = window.handleLogin;

// === PAGO GENÉRICO ===
async function payWLD({ description, amountWLD }) {
  try {
    const ready = await waitForMiniKit(5000);
    if (!ready) {
      alert("Abre desde World App (o reintenta en 2s)");
      return false;
    }

    // 1) Inicia en backend y obtén reference (respetando el precio indicado)
    const initRes = await fetch("/api/initiate-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refillPrice: amountWLD }),
    });
    const { id: reference, amountWLD: serverAmount } = await initRes.json();

    // 2) Drawer nativo de pago
    const payload = {
      reference,
      to: PAY_TO,
      tokens: [{ symbol: "WLD", token_amount: tokenToDecimals(serverAmount ?? amountWLD) }],
      description,
    };

    const { finalPayload } = await window.MiniKit.commandsAsync.pay(payload);

    // 3) Validar en backend
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
    userInput.disabled = true; // fijo (un móvil/un usuario)
  }

  // Balance WLD (placeholder; conecta a backend/portal si lo quieres real)
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
