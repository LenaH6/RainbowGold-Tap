export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try{
    const { payload } = req.body || {};
    // Si configuras verificación server-side, hazla aquí con tus credenciales del portal.
    // Ejemplo (pseudo):
    // const r = await fetch(process.env.WORLD_PORTAL_VERIFY_URL, {
    //   method:'POST',
    //   headers:{ 'Authorization': `Bearer ${process.env.WORLD_PORTAL_API_KEY}`, 'Content-Type':'application/json' },
    //   body: JSON.stringify({ reference: payload.reference })
    // });
    // const data = await r.json();
    // if (!data?.ok) return res.status(400).json({ ok:false });
    return res.status(200).json({ ok:true });
  }catch(e){
    return res.status(500).json({ ok:false, error:'Server error' });
  }
}