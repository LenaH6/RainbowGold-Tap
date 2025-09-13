
import 'dotenv/config';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Resolve WEB_DIR relative to this file by default
const WEB_DIR = process.env.WEB_DIR
  ? path.resolve(__dirname, process.env.WEB_DIR)
  : path.resolve(__dirname, '../web');

// Static frontend
app.use(express.static(WEB_DIR));

// === Helpers World ID OIDC ===
const OIDC = {
  authorize: 'https://id.worldcoin.org/authorize',
  token: 'https://id.worldcoin.org/token'
};

function randomStr(n=32){ return crypto.randomBytes(n).toString('hex'); }

// Inicia login → redirige a World ID authorize
app.get('/auth/login', (req, res) => {
  const client_id = process.env.WLD_CLIENT_ID || process.env.WORLD_ID_CLIENT_ID;
  const redirect_uri = process.env.WLD_REDIRECT_URI || process.env.WORLD_ID_REDIRECT_URI;
  const scope = process.env.WLD_SCOPE || 'openid';
  const state = randomStr(12);
  const returnTo = req.query.returnTo || '/';

  if (!client_id || !redirect_uri) {
    return res.status(500).send('Faltan WLD_CLIENT_ID o WLD_REDIRECT_URI en variables de entorno');
  }

  res.cookie('wld_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 10*60*1000 });
  res.cookie('wld_return', returnTo, { httpOnly: true, sameSite: 'lax', maxAge: 10*60*1000 });

  const url = new URL(OIDC.authorize);
  url.searchParams.set('client_id', client_id);
  url.searchParams.set('redirect_uri', redirect_uri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);

  res.redirect(url.toString());
});

// Callback → canjea el code por tokens y notifica al frontend
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const cookieState = req.cookies?.wld_state;
  const returnTo = req.cookies?.wld_return || '/';

  if (!code || !state || !cookieState || state !== cookieState) {
    return res.status(400).send('State inválido o falta code');
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
    const data = await r.json();
    ok = !!data?.access_token || !!data?.id_token;
  } catch (e) {
    console.error('Token exchange error', e);
  }

  res.send(`<!doctype html><html><body><script>
    try {
      if (${ok ? 'true' : 'false'}) {
        if (window.opener) {
          window.opener.postMessage({ type: 'wld:verified' }, '*');
          window.close();
        } else if (window.parent) {
          window.parent.postMessage({ type: 'wld:verified' }, '*');
          location.replace(${json.dumps(returnTo)});
        } else {
          location.replace(${json.dumps(returnTo)});
        }
      } else {
        if (window.opener) { window.opener.postMessage({ type: 'wld:error' }, '*'); }
        document.body.textContent = 'No se pudo verificar con World ID.';
      }
    } catch (_) { document.body.textContent = 'Error postMessage.'; }
  </script></body></html>`);
});

// Serve index.html for root and any non-API path (SPA-friendly)
app.get('/', (req, res) => {
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

// === Aliases de compatibilidad (NextAuth-like /api/auth/*) ===
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
app.get(/^\/(?!auth\/).*$/, (req, res) => {
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

// ✅ Export default app for @vercel/node (no app.listen here)
export default app;
