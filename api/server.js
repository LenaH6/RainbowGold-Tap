import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const WEB_DIR = path.resolve(__dirname, '../web');
app.use(express.static(WEB_DIR));

app.get('/health', (req,res)=>res.json({ ok:true, env:!!(process.env.WLD_CLIENT_ID||process.env.WORLD_ID_CLIENT_ID) }));

function b64url(buf){ return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function hmac(payload, secret){ const h=crypto.createHmac('sha256', secret); h.update(payload); return b64url(h.digest()); }
function mkState({ returnTo='/', ttlSec=1800 }){
  const secret = process.env.WLD_CLIENT_SECRET || process.env.WORLD_ID_CLIENT_SECRET || 'dev-secret';
  const data = { t: Date.now(), exp: Date.now() + ttlSec*1000, r: returnTo };
  const payload = b64url(Buffer.from(JSON.stringify(data)));
  return payload + '.' + hmac(payload, secret);
}
function readState(state){
  try{
    const [payload, sig] = String(state||'').split('.');
    const secret = process.env.WLD_CLIENT_SECRET || process.env.WORLD_ID_CLIENT_SECRET || 'dev-secret';
    if (!payload || !sig || sig !== hmac(payload, secret)) return null;
    const data = JSON.parse(Buffer.from(payload.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'));
    if (!data || !data.exp || Date.now() > (data.exp + 120000)) return null; // +2 min gracia
    return data;
  }catch{ return null; }
}

const OIDC = { authorize:'https://id.worldcoin.org/authorize', token:'https://id.worldcoin.org/token' };

app.get('/auth/login', (req,res)=>{
  const client_id = process.env.WLD_CLIENT_ID || process.env.WORLD_ID_CLIENT_ID;
  const redirect_uri = process.env.WLD_REDIRECT_URI || process.env.WORLD_ID_REDIRECT_URI;
  const scope = process.env.WLD_SCOPE || process.env.WORLD_ID_SCOPE || 'openid';
  const returnTo = req.query.returnTo || '/';

  if (!client_id || !redirect_uri) return res.status(500).send('Missing OIDC env');

  const state = mkState({ returnTo, ttlSec: 1800 });
  const u = new URL(OIDC.authorize);
  u.searchParams.set('client_id', client_id);
  u.searchParams.set('redirect_uri', redirect_uri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', scope);
  u.searchParams.set('state', state);
  res.redirect(u.toString());
});

app.get('/auth/callback', async (req,res)=>{
  const { code, state } = req.query;
  const data = readState(state);
  const returnTo = (data && data.r) || '/';

  if (!code || !data) return res.status(400).send('state inválido o falta code');

  const params = new URLSearchParams();
  params.set('grant_type', 'authorization_code');
  params.set('code', code);
  params.set('client_id', process.env.WLD_CLIENT_ID || process.env.WORLD_ID_CLIENT_ID || '');
  params.set('client_secret', process.env.WLD_CLIENT_SECRET || process.env.WORLD_ID_CLIENT_SECRET || '');
  params.set('redirect_uri', process.env.WLD_REDIRECT_URI || process.env.WORLD_ID_REDIRECT_URI || '');

  let ok = false;
  try{
    const r = await fetch(OIDC.token, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: params });
    const j = await r.json();
    ok = !!(j && (j.access_token || j.id_token));
  }catch(e){}

  const html = '<!doctype html><html><body><script>(function(){'
    + 'var ok=' + (ok ? 'true' : 'false') + ';'
    + 'var returnTo=' + JSON.stringify(returnTo) + ';'
    + 'if(ok){try{localStorage.setItem("wld_verified","1");}catch(e){}try{sessionStorage.setItem("wld_verified","1");}catch(e){}try{document.cookie="wld_verified=1; Max-Age=600; Path=/; SameSite=Lax";}catch(e){}}'
    + 'try{if(window.opener&&ok){window.opener.postMessage({type:"wld:verified"},"*");window.close();return;}}catch(e){}'
    + 'try{if(window.parent&&window.parent!==window&&ok){window.parent.postMessage({type:"wld:verified"},"*");}}catch(e){}'
    + 'var sep=(returnTo&&returnTo.indexOf("?")>-1)?"&":"?"; location.replace((returnTo||"/")+sep+"verified=1#play");'
    + '})();</script></body></html>';
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.send(html);
});

// Aliases NextAuth-style
app.get('/api/auth/login', (req,res)=>{ req.url = '/auth/login' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''); app._router.handle(req,res); });
app.get('/api/auth/callback/worldcoin', (req,res)=>{ req.url = '/auth/callback' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''); app._router.handle(req,res); });
app.get('/api/auth/callback', (req,res)=>{ req.url = '/auth/callback' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''); app._router.handle(req,res); });

// SPA fallback
import fs from 'fs';
app.get('/', (req,res)=>res.sendFile(path.join(WEB_DIR,'index.html')));
app.get(/^\/(?!auth\/|api\/auth\/).*/, (req,res)=>res.sendFile(path.join(WEB_DIR,'index.html')));

// Error middleware
app.use((err, req, res, next)=>{ console.error('[RainbowGold][Error]', err && err.stack || err); if(res.headersSent) return next(err); res.status(500).send('Internal error'); });

export default function handler(req,res){ return app(req,res); }
