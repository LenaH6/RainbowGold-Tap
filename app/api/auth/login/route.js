export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
export async function GET() {
  const clientId = process.env.WORLD_ID_CLIENT_ID
  const redirectUri = process.env.WORLD_ID_REDIRECT_URI
  const state = Math.random().toString(36).slice(2)
  const nonce = Math.random().toString(36).slice(2)
  const params = new URLSearchParams({ response_type:'code', client_id:clientId, redirect_uri:redirectUri, scope:'openid profile email', state, nonce, prompt:'consent' })
  return NextResponse.redirect('https://id.worldcoin.org/authorize?' + params.toString())
}
