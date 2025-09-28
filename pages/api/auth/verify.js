// pages/api/auth/verify.js
import { SiweMessage } from "siwe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, signature, nullifier_hash, username } = req.body;

  if (!message || !signature || !nullifier_hash) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({ signature });

    if (!fields.success) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const userData = {
      address: siweMessage.address,
      chainId: siweMessage.chainId,
      nullifier_hash,
      username: username || `user_${siweMessage.address.slice(-6)}`,
      verified: true,
      verifiedAt: new Date().toISOString()
    };

    const sessionToken = Buffer.from(JSON.stringify({
      ...userData,
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000)
    })).toString('base64');

    res.setHeader('Set-Cookie', [
      `session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`
    ]);

    res.status(200).json({
      success: true,
      user: userData,
      sessionToken
    });

  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
}