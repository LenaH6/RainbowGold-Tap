import Script from 'next/script'

export const metadata = {
  title: 'RainbowJump • Login + Juego',
  description: 'Miniapp: login World ID y juego.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body id="wrap">
        {children}
        <Script src="/js/game.js" strategy="afterInteractive" />
      </body>
    </html>
  )
}
