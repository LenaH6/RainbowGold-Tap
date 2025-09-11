# RainbowJump Onefile (Frontend + Backend en un solo repo)

## Qué hace
- Pantalla de carga con botón **Entrar con World ID**.
- Abre la **UI oficial** (OIDC). Tras verificar, vuelve con `?token=...`.
- El cliente guarda el token y **arranca automáticamente el juego** (oculta el overlay).
- Backend Next.js recibe el **callback** y puede mantener una cookie de sesión (opcional para UI).

## Variables de entorno (Vercel → Project → Settings → Environment Variables)
- WORLD_ID_CLIENT_ID = app_xxxxx
- WORLD_ID_CLIENT_SECRET = sk_xxxxx
- WORLD_ID_REDIRECT_URI = https://TU-DOMINIO.vercel.app/api/auth/callback/worldcoin
- APP_BASE_URL = https://TU-DOMINIO.vercel.app
- NEXT_PUBLIC_WORLD_ID_CLIENT_ID = app_xxxxx
- NEXT_PUBLIC_WORLD_ID_REDIRECT_URI = https://TU-DOMINIO.vercel.app/api/auth/callback/worldcoin

> Si desarrollas en local, copia `.env.example` → `.env.local` y rellena con tus valores.

## Dónde pegar tu juego
- Reemplaza `public/js/game.js` con tu juego real.
- Debes exponer: `window.Game.start = async ({ token }) => { ... }`
- Monta canvas/engine en el elemento `#game-root`.

## Flujo
1. Home (`/`) muestra overlay.
2. Botón genera `authorize` URL (cliente) con `NEXT_PUBLIC_*`.
3. UI de World ID → callback `/api/auth/callback/worldcoin`.
4. El callback canjea `code→token`, pide `userinfo`, guarda cookie y 302 a `/?token=...`.
5. El overlay detecta el token, oculta y llama `window.Game.start({ token })`.

## Build/Deploy
- Next 14 + Node 18, `output: 'standalone'`.
- En Vercel, setea variables en **Production** y **Preview**. Luego **Redeploy**.
