# RainbowJump — Index + Login World ID + Wallet
Sirve tu **index.html original**. Cambios mínimos:
- El botón `#wldSignIn` ahora usa **OIDC** (redirige a `/api/auth/login`).
- Al volver, se marca `window.VERIFIED = true`, se llama `unlock()`, se fija `username` con el nombre del perfil y se conecta la billetera.
- Se muestra un **wallet bar** arriba a la derecha con **address** y **WLD** (si configuras contrato).

## Variables en Vercel
WORLD_ID_CLIENT_ID=app_xxx
WORLD_ID_CLIENT_SECRET=sk_xxx
WORLD_ID_REDIRECT_URI=https://TU-DOMINIO.vercel.app/api/auth/callback/worldcoin

# Opcional para balance de WLD (Optimism):
# En la página puedes incluir <meta name="wld-contract" content="0x..."> o setear:
# NEXT_PUBLIC_WLD_CONTRACT=0x...
