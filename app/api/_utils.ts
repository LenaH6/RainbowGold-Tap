import { cookies } from 'next/headers'

export function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Falta variable de entorno: ${name}`)
  return v
}

export function setSessionCookie(session: object) {
  cookies().set({
    name: 'rj_session',
    value: JSON.stringify(session),
    httpOnly: false,
    path: '/',
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 7
  })
}

export function clearSessionCookie() {
  cookies().set('rj_session', '', { httpOnly: false, path: '/', maxAge: 0 })
}
