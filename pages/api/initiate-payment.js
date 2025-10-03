// Updated handler for RainbowGold Tap
// This version ensures that the refill price supplied by the client is always respected,
// regardless of the `type` field. If no price is provided, it falls back to 1 WLD.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Destructure body parameters; `type` is kept for backwards compatibility
  const { type, refillPrice } = req.body || {};

  // Generate a unique ID to track this payment request
  const id = crypto.randomUUID().replace(/-/g, '');

  // Determine the amount in WLD. Default to 1 WLD (e.g. for idea tickets)
  let amountWLD = 1;

  // If the client provided a numeric refillPrice, use it directly.
  if (typeof refillPrice === 'number' && !isNaN(refillPrice)) {
    amountWLD = refillPrice;
  }

  // Respond with the payment reference ID and computed amount
  return res.status(200).json({ id, amountWLD });
}