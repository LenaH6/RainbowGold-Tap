// mk-hooks.js — MiniKit: SIWE + pagos en WLD (refill 0.1% capacidad, ideas 1 WLD)
(function () {
  // 👉 dirección de cobro
  const PAY_TO = "0x91bf252c335f2540871d0d2ef1476ae193a5bc8a";

  // 👉 utilidades MiniKit
  const MK = () => window.MiniKit || window.parent?.MiniKit;
  const isMini = () => !!(MK() && MK().isInstalled && MK().isInstalled());

  // 👉 conversión WLD a base units (18 decimales)
  function wldToDecimals(amountWLD) {
    // soporta enteros/decimales: "1", 1, 0.25, "0.25"
    const [i, f = ""] = String(amountWLD).split(".");
    const frac = (f + "000000000000000000").slice(0, 18); // pad a 18
    return (BigInt(i || "0") * (10n ** 18n) + BigInt(frac)).toString();
  }

  // ---------- Login (SIWE)
  async function login() {
    if (!isMini()) return console.warn("MiniKit no instalado (abre en World App).");
    try {
      const r = await fetch("/api/nonce");
      const { nonce } = await r.json();

      const { finalPayload } = await MK().commandsAsync.walletAuth({ nonce });
      if (finalPayload?.status === "success") {
        // Verificación SIWE server-side
        await fetch("/api/complete-siwe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: finalPayload, nonce }),
        });
        // feedback en botón
        const btn = document.getElementById("wldSignIn");
        if (btn && MK().walletAddress) {
          const a = MK().walletAddress;
          btn.textContent = `Conectado: ${a.slice(0, 6)}…${a.slice(-4)}`;
        }
      }
    } catch (e) {
      console.error("login error", e);
    }
  }

  // ---------- Helpers juego/energía
  function getEnergyCapacity() {
    // Si tu legacy expone esto global:
    if (typeof window.getEnergyCapacity === "function") {
      try { return Number(window.getEnergyCapacity()) || 0; } catch {}
    }
    // o si lo guardas en dataset:
    const el = document.getElementById("energyBar") || document.getElementById("energy");
    if (el && el.dataset.capacity) return Number(el.dataset.capacity) || 0;
    // fallback razonable
    return 1000;
  }

  function applyEnergyRefill(percent) {
    // Llama tu handler del juego si existe
    try { typeof window.onEnergyRefilled === "function" && window.onEnergyRefilled(percent); } catch {}
  }

  // ---------- Pagos (WLD)
  async function sendPayWLD({ description, wldAmount }) {
    if (!isMini()) return;
    try {
      // 1) referencia backend
      const res = await fetch("/api/initiate-payment", { method: "POST" });
      const { id } = await res.json();

      // 2) payload Pay (WLD)
      const payload = {
        reference: id,
        to: PAY_TO,
        tokens: [
          {
            symbol: "WLD", // 👈 WLD
            token_amount: wldToDecimals(wldAmount), // string BigInt con 18 decimales
          },
        ],
        description,
      };

      const { finalPayload } = await MK().commandsAsync.pay(payload);
      if (finalPayload?.status === "success") {
        // 3) confirmación optimista en backend (puedes integrar el Portal luego)
        await fetch("/api/confirm-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload: finalPayload }),
        });
        return true;
      }
    } catch (e) {
      console.error("pay error", e);
    }
    return false;
  }

  // Refill: repone 0.1% de la capacidad
  async function payRefill() {
    const capacity = getEnergyCapacity(); // p.ej. 1000
    const refillPercent = 0.001;          // 0.1%
    // 🧠 Precio en WLD: usa un valor seguro ≥ min transfer (~$0.10).
    // Por defecto 0.10 WLD (ajústalo si quieres con <html data-refill-wld="0.05">)
    const fromHTML = Number(document.documentElement.dataset.refillWld || "0.10");
    const ok = await sendPayWLD({
      description: `RainbowGold — Energy Refill (+${(refillPercent * 100).toFixed(3)}% of capacity ${capacity})`,
      wldAmount: fromHTML,
    });
    if (ok) applyEnergyRefill(refillPercent);
  }

  // Booster (si lo usas): por defecto 0.25 WLD
  async function payBooster() {
    const ok = await sendPayWLD({ description: "RainbowGold — Booster", wldAmount: 0.25 });
    if (ok) {
      try { typeof window.onBoosterPurchased === "function" && window.onBoosterPurchased(); } catch {}
    }
  }

  // Ticket de ideas: 1 WLD por ticket
  async function payIdeaTicket() {
    const ok = await sendPayWLD({ description: "RainbowGold — Idea Ticket", wldAmount: 1 });
    if (ok) {
      try { typeof window.onIdeaTicketGranted === "function" && window.onIdeaTicketGranted(1); } catch {}
    }
  }

  // Exporta API global para que tu legacy la invoque o para binds en main.js
  window.RainbowGold = { login, payRefill, payBooster, payIdeaTicket };
})();
