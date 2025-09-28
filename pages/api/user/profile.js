// pages/api/user/profile.js

export default async function handler(req, res) {
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

    if (req.method === 'GET') {
      // Obtener perfil del usuario
      const profile = {
        address: sessionData.address,
        username: sessionData.username,
        nullifier_hash: sessionData.nullifier_hash,
        chainId: sessionData.chainId,
        verified: sessionData.verified,
        verifiedAt: sessionData.verifiedAt,
        
        // Estadísticas del juego (en producción, desde base de datos)
        stats: {
          totalTaps: 0,
          totalRBGp: 0,
          level: 1,
          achievements: [],
          joinedAt: sessionData.verifiedAt,
          lastActiveAt: new Date().toISOString()
        },
        
        // Configuraciones
        settings: {
          language: 'es',
          notifications: true,
          sound: true,
          vibration: true
        }
      };

      res.status(200).json({
        success: true,
        profile
      });

    } else if (req.method === 'PUT') {
      // Actualizar perfil del usuario
      const { username, settings } = req.body;

      // Validaciones básicas
      if (username && (username.length < 3 || username.length > 20)) {
        return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
      }

      // En producción, actualizar en base de datos
      const updatedProfile = {
        address: sessionData.address,
        username: username || sessionData.username,
        nullifier_hash: sessionData.nullifier_hash,
        chainId: sessionData.chainId,
        verified: sessionData.verified,
        verifiedAt: sessionData.verifiedAt,
        
        settings: {
          language: settings?.language || 'es',
          notifications: settings?.notifications !== undefined ? settings.notifications : true,
          sound: settings?.sound !== undefined ? settings.sound : true,
          vibration: settings?.vibration !== undefined ? settings.vibration : true
        }
      };

      // Si cambió el username, actualizar la sesión
      if (username && username !== sessionData.username) {
        const newSessionData = {
          ...sessionData,
          username: username
        };

        const newSessionToken = Buffer.from(JSON.stringify(newSessionData)).toString('base64');

        res.setHeader('Set-Cookie', [
          `session=${newSessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`
        ]);
      }

      console.log(`Profile updated for ${sessionData.address}: username=${username}`);

      res.status(200).json({
        success: true,
        profile: updatedProfile,
        message: 'Profile updated successfully'
      });

    } else if (req.method === 'DELETE') {
      // Eliminar cuenta (logout + limpieza)
      res.setHeader('Set-Cookie', [
        'session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'
      ]);

      // En producción, marcar cuenta como eliminada en base de datos
      console.log(`Account deletion requested for ${sessionData.address}`);

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Profile API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}