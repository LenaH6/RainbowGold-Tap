export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const id = 'ref_' + Math.random().toString(36).slice(2, 10);
  res.status(200).json({ id });
}