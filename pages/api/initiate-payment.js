// pages/api/initiate-payment.js
import crypto from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const id = "rg_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);

  // Guarda la reference en cookie (10 min) para cruzarla en confirm-payment
  res.setHeader(
    "Set-Cookie",
    `pay_ref=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${10 * 60}; Secure`
  );

  return res.status(200).json({ id });
}
