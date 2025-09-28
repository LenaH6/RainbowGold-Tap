// pages/api/payments/process.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ✅ UNIFIED AUTH: Usar mismo sistema que auth APIs
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

    const allowedTypes = ['refill', 'ticket', 'booster'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid payment type' });
    }

    // Precios fijos
    const prices = { refill: 0.10, ticket: 1.00, booster: 0.50 };
    const expectedAmount = prices[type];
    
    if (Math.abs(amount - expectedAmount) > 0.001) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    // Simular pago exitoso
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`Payment processed: ${amount} WLD from ${sessionData.address} for ${type}`);

    res.status(200).json({
      success: true,
      transactionId,
      amount,
      type,
      treasuryWallet: process.env.TREASURY_WALLET_ADDRESS,
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
    // ✅ UNIFIED AUTH: Usar mismo sistema que auth APIs
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
      wld: parseFloat((Math.random() * 10 + 5).toFixed(2)),
      rbgp: 0, 
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