# Rainbow Next App (Bootstrap)

Este proyecto convierte tu sitio estático de **RainbowGold Tap** en un frontend **Next.js** que:
- Sirve el juego original tal cual dentro de `/public/game/index.html` (se muestra con un `<iframe>` en `/`).
- Trae **NextAuth** instalado y listo (ruta `/api/auth/[...nextauth]`), sin proveedores aún.
- Está listo para que integremos **Sign in with World ID (Worldcoin)** después.

## Requisitos
- Node.js 18+

## Uso
```bash
npm install
npm run dev
# abre http://localhost:3000
```

Para ver proveedores de NextAuth (debe dar [] por ahora):
- http://localhost:3000/api/auth/providers

## Variables de entorno
Crea `.env.local` copiando de `.env.example` y cambia `NEXTAUTH_SECRET`.

Más adelante agregaremos:
```
WLD_CLIENT_ID=...
WLD_CLIENT_SECRET=...
```
cuando integremos Worldcoin.

## Estructura
- `/public/game/*` : tu sitio original (assets, css, js, snd, index.html, etc.)
- `/pages/index.tsx` : página Next.js que muestra el juego en un iframe
- `/pages/api/auth/[...nextauth].ts` : endpoint NextAuth (proveedores aún vacíos)

## Próximos pasos
1. Confirmar que el server corre y el juego se ve igual que antes.
2. Agregar proveedor **Worldcoin** en NextAuth.
3. (Opcional) Reemplazar el iframe por React components si quieres migrar el HTML a JSX poco a poco.

## World ID activado
- Ya está configurado el provider `worldcoin` en NextAuth.
- Prueba en local:
  - `npm run dev`
  - Abre `http://localhost:3000/api/auth/providers` y verás `worldcoin`.
  - En `http://localhost:3000` puedes iniciar sesión desde el botón "Entrar con World ID".
  - La ruta `/dashboard` está protegida (middleware).

## Callbacks que debes registrar en el Developer Portal
- Local: `http://localhost:3000/api/auth/callback/worldcoin`
- Producción: `https://TU-DOMINIO/api/auth/callback/worldcoin`

Asegúrate de que coincidan exactamente (incluyendo protocolo y path).
