// pages/api/nonce.js
import crypto from "node:crypto";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const nonce = crypto.randomBytes(16).toString("base64url");
  const maxAge = 10 * 60; // 10 minutos

  res.setHeader(
    "Set-Cookie",
    `siwe_nonce=${nonce}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`
  );

  return res.status(200).json({ nonce });
}
