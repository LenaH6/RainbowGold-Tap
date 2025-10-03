# RainbowGold Tap — Next.js Frontend (World App MiniApp Ready)

Frontend completo (Pages Router) listo para Vercel y para pruebas dentro de World App (modo test).

## Estructura
- pages/index.js          ← renderiza el DOM original del index.html
- pages/_app.js           ← importa estilos + MiniKitProvider
- pages/terminos.js
- pages/privacidad.js
- components/MiniKitProvider.js
- public/img, public/snd
- src/styles/app.css      ← CSS original
- src/app-legacy.js       ← JS original
- src/main.js             ← bootstrap

## Uso
npm i
npm run dev
# http://localhost:3000

## Deploy en Vercel
Conecta el repo y deploy. El entry es pages/index.js
