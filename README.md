# RainbowGold Tap — Next.js Frontend (FIXED) — 2025-10-03T17:02:10.048194Z

• Conserva DOM/CSS/JS originales; corrige login → Wallet Auth (SIWE) y pagos (USDC) con MiniKit.
• Hooks expuestos: RainbowGold.login(), .payRefill(), .payBooster(), .payIdeaTicket().
• Autocableado si existen IDs: wldSignIn, buyRefill, buyBooster, buyIdeaTicket.

## Uso
npm i
npm run dev
# http://localhost:3000
