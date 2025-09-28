// pages/api/auth/session.js

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const sessionToken = req.cookies.session || req.headers.authorization?.replace('Bearer ', '');
      
      if (!sessionToken) {
        return res.status(401).json({ authenticated: false });
      }

      const sessionData = JSON.parse(Buffer.from(sessionToken, 'base64').toString());
      
      if (Date.now() > sessionData.expires) {
        return res.status(401).json({ authenticated: false, expired: true });
      }

      res.status(200).json({
        authenticated: true,
        user: {
          address: sessionData.address,
          username: sessionData.username,
          nullifier_hash: sessionData.nullifier_hash,
          chainId: sessionData.chainId
        }
      });

    } catch (error) {
      console.error("Session verification error:", error);
      res.status(401).json({ authenticated: false });
    }
  } 
  else if (req.method === "DELETE") {
    res.setHeader('Set-Cookie', [
      'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
    ]);
    res.status(200).json({ success: true, message: "Logged out" });
  } 
  else {
    res.status(405).json({ error: "Method not allowed" });
  }
}