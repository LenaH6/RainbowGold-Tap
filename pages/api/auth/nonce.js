// pages/api/auth/nonce.js
import { generateNonce } from "siwe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const nonce = generateNonce();
    res.status(200).json({ nonce });
  } catch (error) {
    console.error("Error generating nonce:", error);
    res.status(500).json({ error: "Failed to generate nonce" });
  }
}