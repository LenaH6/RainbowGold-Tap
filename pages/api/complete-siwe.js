import { verifySiweMessage } from "@worldcoin/minikit-js";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { payload, nonce } = req.body || {};
    const result = await verifySiweMessage(payload, nonce);
    return res.status(200).json({ status: "success", isValid: result.isValid });
  } catch (e) {
    return res.status(200).json({ status: "error", isValid: false, message: String(e?.message || e) });
  }
}
