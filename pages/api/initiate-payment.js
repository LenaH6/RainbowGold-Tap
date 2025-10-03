export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { refillPrice } = req.body || {};
  const id = crypto.randomUUID().replace(/-/g, '');
  let amountWLD = 1;
  if (typeof refillPrice === 'number' && refillPrice > 0) {
    amountWLD = refillPrice;
  }
  return res.status(200).json({ id, amountWLD });
}
