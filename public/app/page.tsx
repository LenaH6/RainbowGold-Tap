export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import './globals.css'
import LoginOverlay from './components/LoginOverlay'

export default function Home(){
  return (
    <main>
      <div id="game-root"></div>
      <LoginOverlay />
    </main>
  )
}
