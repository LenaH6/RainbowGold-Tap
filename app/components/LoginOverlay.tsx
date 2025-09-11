'use client'

import { useEffect, useState, useMemo } from 'react'

declare global {
  interface Window { Game: any }
}

function useSession() {
  const [token, setToken] = useState<string>('')

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search)
    const t = qs.get('token')
    if (t) {
      try { localStorage.setItem('RJ_TOKEN', t) } catch {}
      setToken(t)
      const clean = window.location.origin + window.location.pathname
      window.history.replaceState({}, '', clean)
      return
    }
    const saved = localStorage.getItem('RJ_TOKEN') || ''
    if (saved) setToken(saved)
  }, [])

  return { token, setToken }
}

export default function LoginOverlay() {
  const { token } = useSession()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // si hay token y existe window.Game.start, inicia el juego y oculta overlay
    if (token && typeof window !== 'undefined') {
      const start = async () => {
        try {
          await window.Game?.start?.({ token })
          const ov = document.getElementById('overlay')
          if (ov) ov.style.display = 'none'
        } catch (e) {
          console.error('No se pudo iniciar el juego', e)
          alert('No se pudo iniciar el juego. Intenta nuevamente.')
        }
      }
      start()
    }
    setReady(true)
  }, [token])

  const authorizeUrl = useMemo(() => {
    const clientId = process.env.NEXT_PUBLIC_WORLD_ID_CLIENT_ID!
    const redirectUri = process.env.NEXT_PUBLIC_WORLD_ID_REDIRECT_URI!
    const state = (crypto?.randomUUID?.() || String(Date.now()))
    const nonce = (crypto?.randomUUID?.() || String(Math.random()))
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      state, nonce, prompt: 'consent'
    })
    return `https://id.worldcoin.org/authorize?${params.toString()}`
  }, [])

  if (!ready || token) return (
    <div id="overlay">
      <div className="card" style={{textAlign:'center'}}>
        <div className="badge">Cargando</div>
        <h1>RainbowJump</h1>
        <div className="sub">Verificando sesión…</div>
        <div className="note">Si ya estás verificado, el juego iniciará automáticamente.</div>
      </div>
    </div>
  )

  return (
    <div id="overlay">
      <div className="card" style={{textAlign:'center'}}>
        <div className="badge">Pantalla de carga</div>
        <h1>RainbowJump</h1>
        <div className="sub">Verifica tu identidad para comenzar</div>
        <a href={authorizeUrl} style={{textDecoration:'none'}}>
          <button className="btn btn-primary" style={{marginTop:12}}>Entrar con World ID</button>
        </a>
        <div className="note" style={{marginTop:8}}>Se abrirá la UI oficial de World ID</div>
      </div>
    </div>
  )
}
