export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { clearSessionCookie } from '../../_utils'
export async function GET(){ clearSessionCookie(); return NextResponse.redirect(new URL('/', process.env.APP_BASE_URL || 'http://localhost:3000')) }
