# RainbowJump • Onefile (login + juego)

Todo en **un solo proyecto Next.js**:
- Pantalla de carga con botón **Entrar con World ID**.
- Tras verificar (OIDC), vuelve con `?token=...`, se **oculta el overlay** y se inicia el juego.
- Tu juego vive en **`public/js/game.js`** y usa **assets** en `public/assets` y `public/snd`.

## Variables de entorno (Vercel → Settings → Environment Variables)
Pégalos en **Production** y **Preview** y luego **Redeploy**:

WORLD_ID_CLIENT_ID=app_33bb8068826b85d4cd56d2ec2caba7cc
WORLD_ID_CLIENT_SECRET=<TU_SECRET_ROTADO>
WORLD_ID_REDIRECT_URI=https://TU-DOMINIO.vercel.app/api/auth/callback/worldcoin
APP_BASE_URL=https://TU-DOMINIO.vercel.app

NEXT_PUBLIC_WORLD_ID_CLIENT_ID=app_33bb8068826b85d4cd56d2ec2caba7cc
NEXT_PUBLIC_WORLD_ID_REDIRECT_URI=https://TU-DOMINIO.vercel.app/api/auth/callback/worldcoin

> En el Developer Portal, registra el Redirect EXACTO:  
> `https://TU-DOMINIO.vercel.app/api/auth/callback/worldcoin`

## Dónde pegar/editar tu juego
- Reemplaza la lógica dentro de **`public/js/game.js`** si necesitas.
- El motor debe montar su canvas en el **div `#game-root`**.
- Los sonidos/imagenes ya copiados desde tu ZIP están en:
  - `public/assets/img/*`
  - `public/snd/*`

## Estructura importante
app/
  api/
    auth/callback/worldcoin/route.ts  ← canjea code→token y redirige a `/?token=...`
    auth/logout/route.ts
    session/route.ts
  components/LoginOverlay.tsx         ← arma authorize y arranca el juego
  page.tsx                            ← contenedor del juego + overlay
  globals.css
public/
  js/game.js                          ← TU JUEGO (tap, energía, sonidos)
  assets/img/...                      ← imágenes
  snd/...                              ← sonidos

## Dev local (opcional)
- Crea `.env.local` con los mismos valores (pero usando `http://localhost:3000` para el redirect).
- `npm install`
- `npm run dev`
