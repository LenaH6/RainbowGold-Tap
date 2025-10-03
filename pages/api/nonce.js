export default async function handler(req, res) {
  res.status(200).json({ nonce: Math.random().toString(36).slice(2) });
}
