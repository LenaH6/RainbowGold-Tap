// pages/api/initiate-payment.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { type, refillPrice } = req.body || {};
  const id = crypto.randomUUID().replace(/-/g, '');

  // 💾 OPCIONAL: guarda `id` y el tipo en tu DB para verificar luego (payload.reference debe coincidir)
  // await db.save({ id, type, createdAt: Date.now(), expectedAmount: ... })

  // Si quieres devolver el precio dinámico desde server:
  let amountWLD = 1; // ideas por defecto
  if (type === 'refill') {
    amountWLD = typeof refillPrice === 'number' ? refillPrice : 0.1; // 0.1 WLD por defecto
  }

  return res.status(200).json({ id, amountWLD });
}
