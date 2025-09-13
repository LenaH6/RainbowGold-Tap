RainbowGold - parche ultra-preservado
=====================================

Qué es:
- Es TU index original (mismo contenido), con un bloque <script> agregado al final que:
  * Enlaza tu botón id="wldSignIn" a /api/auth/login (OIDC World ID)
  * Al volver, oculta el splash y llama unlock() si existe
  * Conecta la billetera (World Chain 0x1e0) y, si tu UI lo tiene, muestra balance WLD
  * Cablea botones IDEAS (1 WLD) y REFILL (0.1% de capacidad)

Dónde pegar variables en Vercel:
- WORLD_ID_CLIENT_ID=app_...
- WORLD_ID_CLIENT_SECRET=sk_...
- WORLD_ID_REDIRECT_URI=https://rainbowgold-app.vercel.app/api/auth/callback/worldcoin

Archivos incluidos:
- public/index.html (tu index + parche)
- app/api/auth/login/route.js
- app/api/auth/callback/worldcoin/route.js
- app/api/session/route.js

Si tu botón de login NO es id="wldSignIn":
- Edita public/index.html y cambia el selector en el bloque <!-- RG_PIN_PATCH -->
  (busca document.getElementById('wldSignIn')).
