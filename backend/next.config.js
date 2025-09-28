/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Configuración para APIs solamente (sin páginas de frontend)
  trailingSlash: false,
  
  // Headers CORS para que tu frontend pueda llamar las APIs
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // En producción, cambia por tu dominio específico
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },

  // Variables de entorno públicas (si necesitas alguna)
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Configuración para Vercel
  experimental: {
    serverComponentsExternalPackages: ['@worldcoin/minikit-js']
  }
}

module.exports = nextConfig