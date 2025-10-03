export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  try{
    const { payload, nonce } = req.body || {};
    const cookies = Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('=').map(decodeURIComponent)).filter(kv=>kv[0]));
    const cookieNonce = cookies['rg_nonce'];

    if (!nonce || !cookieNonce || nonce !== cookieNonce){
      return res.status(400).json({ ok:false, error:'Invalid nonce' });
    }
    if (!payload || payload.status !== 'success'){
      return res.status(400).json({ ok:false, error:'Invalid payload' });
    }
    const address = payload.address || '';
    const maxAge = 7 * 24 * 60 * 60; // 7 days
    const sessionValue = Buffer.from(JSON.stringify({ w: address, ts: Date.now() })).toString('base64url');
    res.setHeader('Set-Cookie', [
      `rg_session=${sessionValue}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=None; Secure`,
      `rg_nonce=; Path=/; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure`
    ]);
    return res.status(200).json({ ok:true, address });
  }catch(e){
    return res.status(500).json({ ok:false, error:'Server error' });
  }
}