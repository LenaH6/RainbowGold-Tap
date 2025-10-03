// Requiere APP_ID y DEV_PORTAL_API_KEY
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { payload } = req.body || {};
    if (!payload || payload.status !== 'success') {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }
    const { transaction_id, reference } = payload;
    if (!transaction_id || !reference) {
      return res.status(400).json({ success: false, error: 'Missing transaction_id or reference' });
    }

    const url = `https://developer.worldcoin.org/api/v2/minikit/transaction/${encodeURIComponent(transaction_id)}?app_id=${encodeURIComponent(process.env.APP_ID)}`;
    const r = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.DEV_PORTAL_API_KEY}` },
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(500).json({ success: false, error: 'Portal query failed', details: txt });
    }

    const tx = await r.json();
    const ok =
      tx &&
      (tx.reference === reference || tx.referenceId === reference) &&
      tx.status !== 'failed';

    if (ok) {
      // Marca como pagado en DB si llevas contabilidad
      return res.status(200).json({ success: true, transaction: tx });
    } else {
      return res.status(200).json({ success: false, transaction: tx });
    }
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Server error', details: e.message });
  }
}
