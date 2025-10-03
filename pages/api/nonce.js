export default function handler(req, res) {
  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const maxAge = 10 * 60; // 10 min
  res.setHeader('Set-Cookie', `rg_nonce=${encodeURIComponent(nonce)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=None; Secure`);
  res.status(200).json({ nonce });
}