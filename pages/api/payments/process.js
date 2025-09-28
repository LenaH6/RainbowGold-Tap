// pages/api/payments/process.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ✅ UNIFIED AUTH: Usar mismo sistema que session.js
    const sessionToken = req.cookies.session || req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionData = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
    
    if (Date.now() > sessionData.expires) {
      return res.status(401).json({ error: 'Session expired' });
    }

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

    // Simulamos el pago exitoso
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`Payment processed: ${amount} WLD from ${sessionData.address} for ${type}`);

    res.status(200).json({
      success: true,
      transactionId,
      amount,
      type,
      treasuryWallet: '0x91bf252c335f2540871d0d2ef1476ae193a5bc8a',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
}

// pages/api/user/balance.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ✅ UNIFIED AUTH: Usar mismo sistema que session.js
    const sessionToken = req.cookies.session || req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionData = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
    
    if (Date.now() > sessionData.expires) {
      return res.status(401).json({ error: 'Session expired' });
    }

    // Balances simulados
    const balances = {
      wld: parseFloat((Math.random() * 10 + 5).toFixed(2)), // 5-15 WLD simulado
      rbgp: 0, // Este se maneja localmente en el frontend
      address: sessionData.address,
      chainId: sessionData.chainId
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