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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + basic
    },
    body: new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri: redirectUri })
  })
  if (!tokenRes.ok) return NextResponse.redirect(new URL('/index.html?error=token_exchange_failed', url.origin))
  const tokenJson = await tokenRes.json()
  const frontUrl = new URL('/index.html', url.origin)
  frontUrl.searchParams.set('token', tokenJson.id_token || tokenJson.access_token || '')
  return NextResponse.redirect(frontUrl)
}
