
import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const WEB_DIR = process.env.WEB_DIR
  ? path.resolve(__dirname, process.env.WEB_DIR)
  : path.resolve(__dirname, '../web');
app.use(express.static(WEB_DIR));

const OIDC = {
  authorize: 'https://id.worldcoin.org/authorize',
  token: 'https://id.worldcoin.org/token'
};

function b64url(buf){ return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function hmacSign(payload, secret){
  const h = crypto.createHmac('sha256', secret);
  h.update(payload);
  return b64url(h.digest());
}
function createState({ returnTo='/', ttlSec=600 }){
  const secret = process.env.WLD_CLIENT_SECRET || process.env.WORLD_ID_CLIENT_SECRET || 'dev-secret';
  const data = { t: Date.now(), exp: Date.now() + ttlSec*1000, r: returnTo };
  const payload = b64url(Buffer.from(JSON.stringify(data)));
  const sig = hmacSign(payload, secret);
  return `${payload}.${sig}`;
}
function verifyState(state){
  try{
    const [payload, sig] = String(state || '').split('.');
    if (!payload || !sig) return null;
    const secret = process.env.WLD_CLIENT_SECRET || process.env.WORLD_ID_CLIENT_SECRET || 'dev-secret';
    const expected = hmacSign(payload, secret);
    if (sig !== expected) return null;
    const data = JSON.parse(Buffer.from(payload.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'));
    if (!data || !data.exp || Date.now() > data.exp) return null;
    return data;
  }catch(_){ return null; }
}

// === Login: redirige a World ID authorize (STATE sin cookies) ===
app.get('/auth/login', (req, res) => {
  const client_id = process.env.WLD_CLIENT_ID || process.env.WORLD_ID_CLIENT_ID;
  const redirect_uri = process.env.WLD_REDIRECT_URI || process.env.WORLD_ID_REDIRECT_URI;
  const scope = process.env.WLD_SCOPE || process.env.WORLD_ID_SCOPE || 'openid';
  const returnTo = req.query.returnTo || '/';

  if (!client_id || !redirect_uri) {
    return res.status(500).send('Faltan WLD/WORLD_ID client_id o redirect_uri');
  }

  const state = createState({ returnTo, ttlSec: 600 });
  const url = new URL(OIDC.authorize);
  url.searchParams.set('client_id', client_id);
  url.searchParams.set('redirect_uri', redirect_uri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  res.redirect(url.toString());
});

// === Callback: canjea code y valida STATE sin cookies ===
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const data = verifyState(state);
  const returnTo = (data && data.r) || '/';

  if (!code || !data) {
    return res.status(400).send('state inválido o falta code');
  }

  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('client_id', process.env.WLD_CLIENT_ID || process.env.WORLD_ID_CLIENT_ID || '');
  body.set('client_secret', process.env.WLD_CLIENT_SECRET || process.env.WORLD_ID_CLIENT_SECRET || '');
  body.set('redirect_uri', process.env.WLD_REDIRECT_URI || process.env.WORLD_ID_REDIRECT_URI || '');

  let ok = false;
  try {
    const r = await fetch(OIDC.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const j = await r.json();
    ok = !!j?.access_token || !!j?.id_token;
  } catch (e) {
    console.error('Token exchange error', e);
  }

  res.send(`<!doctype html><html><body><script>
    try {
      if (${ok ? 'true' : 'false'}) {
        if (window.opener) {
          window.opener.postMessage({ type:'wld:verified' }, '*');
          window.close();
        } else if (window.parent) {
          window.parent.postMessage({ type:'wld:verified' }, '*');
          location.replace(${json.dumps(returnTo)});
        } else {
          location.replace(${json.dumps(returnTo)});
        }
      } else {
        if (window.opener) { window.opener.postMessage({ type:'wld:error' }, '*'); }
        document.body.textContent = 'No se pudo verificar con World ID.';
      }
    } catch(_) { document.body.textContent = 'Error postMessage.'; }
  </script></body></html>`);
});

// Aliases compatibles con /api/auth/* (NextAuth-like)
app.get('/api/auth/login', (req, res) => {
  req.url = '/auth/login' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  app._router.handle(req, res);
});
app.get('/api/auth/callback/worldcoin', (req, res) => {
  req.url = '/auth/callback' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  app._router.handle(req, res);
});
app.get('/api/auth/callback', (req, res) => {
  req.url = '/auth/callback' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
  app._router.handle(req, res);
});

// Root & SPA fallback
app.get('/', (req, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));
app.get(/^\/(?!auth\/|api\/auth\/).*$/, (req, res) => res.sendFile(path.join(WEB_DIR, 'index.html')));

// Export para @vercel/node
export default app;
