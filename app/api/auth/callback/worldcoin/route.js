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
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded','Authorization':'Basic '+basic },
    body:new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri:redirectUri })
  })
  if (!tokenRes.ok) return NextResponse.redirect(new URL('/index.html?error=token_exchange_failed', url.origin))

  const tokenJson = await tokenRes.json()

  // (opcional) nombre/email
  let profile = {}
  if (tokenJson.access_token){
    try{
      const u = await fetch('https://id.worldcoin.org/userinfo', { headers:{ Authorization:`Bearer ${tokenJson.access_token}` }})
      if (u.ok) profile = await u.json()
    }catch{}
  }

  // Redirige con ?token para que el overlay se oculte sí o sí
  const front = new URL('/index.html', url.origin)
  front.searchParams.set('token', tokenJson.id_token || tokenJson.access_token || '')

  const res = NextResponse.redirect(front)
  // Cookie de sesión con el nombre
  res.cookies.set('rj_session', JSON.stringify({
    name: profile.name || '', email: profile.email || '', sub: profile.sub || ''
  }), { httpOnly:true, sameSite:'lax', secure:true, path:'/', maxAge:60*60*24*7 })
  return res
}
