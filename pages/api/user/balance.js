// pages/api/user/balance.js
import { jwtVerify } from 'jose';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verificar autenticación
    const token = req.cookies['auth-token'] || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // En producción, aquí consultarías el balance real de WLD desde la blockchain
    // usando la dirección de wallet del usuario (payload.address)
    
    // Por ahora, retornamos balances simulados
    const balances = {
      wld: parseFloat((Math.random() * 10 + 5).toFixed(2)), // 5-15 WLD simulado
      rbgp: 0, // Este se maneja localmente en el frontend
      address: payload.address,
      chainId: payload.chainId
    };

    res.status(200).json({
      success: true,
      balances,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Balance fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
}