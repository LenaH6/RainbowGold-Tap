# RainbowGold (root)

## Local
1) npm install
2) cp api/.env.example api/.env  (rellena claves)
3) npm run dev
4) abre http://localhost:3000

## Vercel rápido
- Importa este repo/carpeta.
- Framework: "Other".
- Build Command: `npm install` (usará postinstall para /api).
- Output directory: (dejar vacío; es app Node).
- Env: agrega WLD_CLIENT_ID, WLD_CLIENT_SECRET, WLD_REDIRECT_URI.
