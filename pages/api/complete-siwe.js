export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try {
    const { message, signature } = req.body || {};
    if (!message || !signature) return res.status(400).json({ error: 'Missing params' });
    // Aquí podrías verificar el SIWE en backend si deseas.
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
