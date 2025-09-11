import Script from 'next/script'

export const metadata = {
  title: 'RainbowJump • Login + Juego',
  description: 'Miniapp de ejemplo: login World ID y arranque automático del juego.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body id="wrap">
        {children}
        {/* Carga el juego real */}
        <Script src="/js/game.js" strategy="afterInteractive" />
      </body>
    </html>
  )
}
