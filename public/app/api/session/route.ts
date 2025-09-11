export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
export async function GET(){ const raw = cookies().get('rj_session')?.value || ''; return NextResponse.json({ session: raw ? JSON.parse(raw): null }) }
