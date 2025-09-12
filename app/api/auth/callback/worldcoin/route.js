export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
export async function GET(req) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/index.html?error=missing_code', url.origin))
  const clientId = process.env.WORLD_ID_CLIENT_ID
  const clientSecret = process.env.WORLD_ID_CLIENT_SECRET
  const redirectUri = process.env.WORLD_ID_REDIRECT_URI
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const tokenRes = await fetch('https://id.worldcoin.org/token', {
    method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded', 'Authorization':'Basic ' + basic },
    body: new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri: redirectUri })
  })
  if (!tokenRes.ok) return NextResponse.redirect(new URL('/index.html?error=token_exchange_failed', url.origin))
  const tokenJson = await tokenRes.json()
  // pedir userinfo para nombre
  let profile = {}
  if (tokenJson.access_token){
    try{
      const u = await fetch('https://id.worldcoin.org/userinfo', { headers: { Authorization: `Bearer ${tokenJson.access_token}` } })
      if (u.ok) profile = await u.json()
    }catch{}
  }
  // guarda sesión (cookie) con nombre (httponly)
  const res = NextResponse.redirect(new URL('/index.html', url.origin))
  const session = { name: profile.name || '', email: profile.email || '', sub: profile.sub || '' }
  res.cookies.set('rj_session', JSON.stringify(session), { httpOnly: true, sameSite:'lax', secure:true, path:'/', maxAge: 60*60*24*7 })
  // además coloca token en query para el bootstrap
  res.headers.set('Location', new URL('/index.html?token=' + encodeURIComponent(tokenJson.id_token || tokenJson.access_token || ''), url.origin))
  return res
}
