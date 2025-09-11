export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import './globals.css'
import LoginOverlay from './components/LoginOverlay'

export default function Home() {
  return (
    <main>
      {/* Contenedor del juego */}
      <div id="game-root"></div>
      {/* Overlay de login (se oculta automáticamente tras verificar) */}
      <LoginOverlay />
    </main>
  )
}
