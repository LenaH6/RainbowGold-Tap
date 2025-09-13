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
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded', 'Authorization':'Basic ' + basic },
    body: new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri: redirectUri })
  })
  if (!tokenRes.ok) return NextResponse.redirect(new URL('/index.html?error=token_exchange_failed', url.origin))
  const tokenJson = await tokenRes.json()

  let profile = {}
  if (tokenJson.access_token){
    try{
      const u = await fetch('https://id.worldcoin.org/userinfo', { headers: { Authorization: `Bearer ${tokenJson.access_token}` } })
      if (u.ok) profile = await u.json()
    }catch{}
  }

  const name = profile.name || ''
  const email = profile.email || ''
  const sub = profile.sub || ''
  const wallet = (profile.wallet && profile.wallet.address) || (Array.isArray(profile.wallets) && profile.wallets[0]?.address) || ''
  const verification = profile.verification_level || (profile.verification && profile.verification.level) || ''

  const front = new URL('/index.html', url.origin)
  front.searchParams.set('token', tokenJson.id_token || tokenJson.access_token || '')

  const res = NextResponse.redirect(front)
  res.cookies.set('rj_session', JSON.stringify({ name, email, sub, wallet, verification }), {
    httpOnly: true, sameSite:'lax', secure:true, path:'/', maxAge: 60*60*24*7
  })
  return res
}
