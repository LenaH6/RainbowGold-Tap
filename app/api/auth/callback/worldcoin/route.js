export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export async function GET(req) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  
  if (!code) {
    return NextResponse.redirect(new URL('/?error=missing_code', url.origin))
  }

  const clientId = process.env.WORLD_ID_CLIENT_ID
  const clientSecret = process.env.WORLD_ID_CLIENT_SECRET
  const redirectUri = process.env.WORLD_ID_REDIRECT_URI
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  try {
    // Intercambiar código por tokens
    const tokenRes = await fetch('https://id.worldcoin.org/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded', 
        'Authorization': 'Basic ' + basic 
      },
      body: new URLSearchParams({ 
        grant_type: 'authorization_code', 
        code, 
        redirect_uri: redirectUri 
      })
    })

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', url.origin))
    }

    const tokenJson = await tokenRes.json()

    // Obtener información del usuario
    let profile = {}
    if (tokenJson.access_token) {
      try {
        const userInfoRes = await fetch('https://id.worldcoin.org/userinfo', { 
          headers: { 
            Authorization: `Bearer ${tokenJson.access_token}` 
          } 
        })
        
        if (userInfoRes.ok) {
          profile = await userInfoRes.json()
        }
      } catch (error) {
        console.error('Error fetching user info:', error)
      }
    }

    // Extraer datos del usuario
    const userData = {
      name: profile.name || profile.given_name || 'Usuario verificado',
      email: profile.email || '',
      sub: profile.sub || '',
      wallet: profile.wallet?.address || 
               (Array.isArray(profile.wallets) && profile.wallets[0]?.address) || '',
      verification: profile.verification_level || 
                   profile.verification?.level || 
                   'Verificado con World ID'
    }

    // Crear respuesta de redirección con token para mostrar modal de verificación
    const redirectUrl = new URL('/', url.origin)
    redirectUrl.searchParams.set('token', tokenJson.id_token || tokenJson.access_token || 'verified')

    const response = NextResponse.redirect(redirectUrl)
    
    // Guardar sesión en cookie
    response.cookies.set('rj_session', JSON.stringify(userData), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 días
    })

    return response

  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.redirect(new URL('/?error=callback_failed', url.origin))
  }
}