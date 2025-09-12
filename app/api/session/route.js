export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
export async function GET(req){
  const cookie = req.headers.get('cookie') || ''
  const m = cookie.match(/(?:^|;\s*)rj_session=([^;]+)/)
  let session = null
  if (m){
    try{ session = JSON.parse(decodeURIComponent(m[1])) }catch{}
  }
  return NextResponse.json({ session })
}
