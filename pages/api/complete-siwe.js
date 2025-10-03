import { SiweMessage } from 'siwe';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { message, signature } = req.body;
    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({ signature });

    if (!fields.success) {
      return res.status(400).json({ error: 'Invalid SIWE signature' });
    }

    // Sesión 7 días
    res.setHeader('Set-Cookie',
      `rg_session=${encodeURIComponent(fields.data.address)}; Path=/; Max-Age=${7 * 24 * 60 * 60}; HttpOnly; SameSite=None; Secure`
    );

    res.status(200).json({ ok: true, address: fields.data.address });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed', details: err.message });
  }
}
