// pages/api/confirm-payment.js
function readCookie(req, name) {
  const str = req.headers.cookie || "";
  const map = Object.fromEntries(
    str.split(";").map(s => s.trim().split("=").map(decodeURIComponent)).filter(p => p[0])
  );
  return map[name];
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Acepta body como { payload } o como el payload directo
    const body = await req.body ? req.body : await new Promise(resolve => {
      let data = ""; req.on("data", c => data += c); req.on("end", () => resolve(JSON.parse(data||"{}")));
    });
    const payload = body?.payload ?? body;

    const APP_ID = process.env.WORLD_APP_ID;
    const API_KEY = process.env.DEV_PORTAL_API_KEY || process.env.WORLD_APP_SECRET;
    const TREASURY = (process.env.TREASURY_WALLET_ADDRESS || "").toLowerCase();

    if (!payload?.status || payload.status !== "success")
      throw new Error("Payment not successful");

    // 1) Cruzar referencia que creamos en /initiate-payment
    const referenceFromCookie = readCookie(req, "pay_ref");
    if (!referenceFromCookie || payload.reference !== referenceFromCookie)
      throw new Error("Reference mismatch");

    // 2) Validación básica local
    const to = payload?.response?.to || payload?.to;
    const tokens = payload?.response?.tokens || payload?.tokens || [];
    if (!to || !Array.isArray(tokens) || tokens.length === 0) throw new Error("Malformed tokens");
    const main = tokens[0];
    if (String(main.symbol).toUpperCase() !== "WLD") throw new Error("Token must be WLD");
    if (!/^\d+$/.test(String(main.token_amount))) throw new Error("Bad token_amount");
    if (TREASURY && to.toLowerCase() !== TREASURY) throw new Error("Receiver mismatch");

    // 3) Verificar con el Developer Portal (endpoint oficial)
    const txId =
      payload.transaction_id ||
      payload?.response?.transaction_id;
    if (!txId) throw new Error("Missing transaction_id");

    const url = `https://developer.worldcoin.org/api/v2/minikit/transaction/${txId}?app_id=${APP_ID}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
    if (!r.ok) throw new Error(`Portal ${r.status}`);
    const tx = await r.json();

    // Algunos docs devuelven 'status', otros 'transaction_status'; checamos ambos
    const status = tx.status || tx.transaction_status;
    const okStatus = status && status !== "failed";

    const sameRef = tx.reference === referenceFromCookie;
    const sameTo = !TREASURY || (tx.to || "").toLowerCase() === TREASURY;

    if (!(okStatus && sameRef && sameTo)) throw new Error("Portal verification failed");

    return res.status(200).json({ success: true, verified: true });
  } catch (e) {
    return res.status(400).json({ success: false, error: String(e?.message || e) });
  }
}
