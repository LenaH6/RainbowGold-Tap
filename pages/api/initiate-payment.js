export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { refillPrice } = req.body || {};
  const id = crypto.randomUUID().replace(/-/g, '');

  // Si quieres persistir reference en DB, hazlo aquí.
  // await db.save({ id, createdAt: Date.now(), expectedAmount: refillPrice })

  // Respetar precio enviado (con fallback)
  let amountWLD = 1;
  if (typeof refillPrice === 'number' && refillPrice > 0) {
    amountWLD = refillPrice;
  }

  return res.status(200).json({ id, amountWLD });
}
