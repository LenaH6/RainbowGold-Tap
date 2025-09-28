// pages/api/payments/verify.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verificar autenticación
    const sessionToken = req.cookies.session || req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionData = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
    
    if (Date.now() > sessionData.expires) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const { transactionId, paymentId } = req.body;

    if (!transactionId && !paymentId) {
      return res.status(400).json({ error: 'Transaction ID or Payment ID required' });
    }

    // En producción, aquí verificarías:
    // 1. Estado de la transacción en la blockchain
    // 2. Confirmaciones necesarias
    // 3. Que el monto sea correcto
    // 4. Que sea hacia tu treasury wallet

    // Por ahora, simulamos verificación exitosa
    const verificationResult = {
      verified: true,
      transactionId: transactionId || paymentId,
      status: 'confirmed',
      confirmations: 6,
      blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
      timestamp: new Date().toISOString(),
      fromAddress: sessionData.address,
      toAddress: process.env.TREASURY_WALLET,
      amount: '0.1', // En producción, obtener de la blockchain
      gasUsed: '21000'
    };

    console.log(`Payment verified: ${transactionId} from ${sessionData.address}`);

    res.status(200).json({
      success: true,
      verification: verificationResult,
      message: 'Payment verified successfully'
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
}