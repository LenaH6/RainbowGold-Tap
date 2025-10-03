export default function handler(req, res) {
  const nonce = Math.random().toString(36).slice(2, 10);
  res.status(200).json({ nonce });
}
