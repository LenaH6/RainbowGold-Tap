# RainbowJump - Exact Index (onefile)
Sirve tu **index.html original** tal cual, con botón `#wldSignIn` que ahora usa **OIDC**:
- `GET /api/auth/login` → redirige a la UI oficial de World ID.
- `GET /api/auth/callback/worldcoin` → canjea `code→token` y vuelve a `/index.html?token=...`.
- Un pequeño script en `<body>` detecta `?token`, marca `window.VERIFIED = true`, llama `unlock()` y limpia la URL.

## Variables en Vercel
WORLD_ID_CLIENT_ID=app_xxx
WORLD_ID_CLIENT_SECRET=sk_xxx
WORLD_ID_REDIRECT_URI=https://TU-DOMINIO.vercel.app/api/auth/callback/worldcoin
