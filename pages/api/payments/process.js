// pages/api/payments/process.js
import { jwtVerify } from 'jose';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const { amount, type, description } = req.body;

    // Validar parámetros
    if (!amount || !type || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid payment parameters' });
    }

    // Tipos de pago permitidos
    const allowedTypes = ['refill', 'ticket', 'booster'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid payment type' });
    }

    // Precios fijos (en WLD)
    const prices = {
      refill: 0.10,    // Refill de energía
      ticket: 1.00,    // Ticket para Ideas
      booster: 0.50    // Boosters (futuro)
    };

    const expectedAmount = prices[type];
    if (Math.abs(amount - expectedAmount) > 0.001) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    // En producción, aquí harías:
    // 1. Verificar balance real del usuario en la blockchain
    // 2. Crear transacción hacia tu treasury wallet
    // 3. Esperar confirmación de la blockchain

    // Por ahora, simulamos el pago exitoso
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`Payment processed: ${amount} WLD from ${payload.address} for ${type}`);

    res.status(200).json({
      success: true,
      transactionId,
      amount,
      type,
      treasuryWallet: process.env.TREASURY_WALLET,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
}