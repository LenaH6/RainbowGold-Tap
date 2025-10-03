export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try{
    const { payload } = req.body || {};
    // TODO: Verificación real en el portal (si configuras API key/endpoint)
    return res.status(200).json({ ok:true });
  }catch(e){
    return res.status(500).json({ ok:false, error:'Server error' });
  }
}