export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionToken = req.cookies.session || req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const sessionData = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
    
    if (Date.now() > sessionData.expires) {
      return res.status(401).json({ error: 'Session expired' });
    }

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