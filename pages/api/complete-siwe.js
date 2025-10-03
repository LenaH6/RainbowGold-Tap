// pages/api/complete-siwe.js
import { verifySiweMessage } from "@worldcoin/minikit-js";

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
    const { payload, nonce } = req.body || {};
    const cookieNonce = readCookie(req, "siwe_nonce");
    if (!payload || !nonce) return res.status(400).json({ error: "Missing payload/nonce" });
    if (!cookieNonce || cookieNonce !== nonce) return res.status(400).json({ error: "Bad nonce" });

    // Verifica la firma SIWE (Wallet Authentication)
    const result = await verifySiweMessage(payload, nonce);

    if (!result?.isValid) return res.status(401).json({ status: "invalid" });

    // Opcional: cookie de sesión mínima (marca logueado)
    res.setHeader(
      "Set-Cookie",
      `siwe_ok=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}; Secure`
    );

    return res.status(200).json({ status: "success", isValid: true });
  } catch (e) {
    return res.status(500).json({ status: "error", message: String(e?.message || e) });
  }
}
