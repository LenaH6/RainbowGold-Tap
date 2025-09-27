/**
 * api/auth/worldcoin.js - World ID Authentication & Verification
 * Maneja verificación de World ID proof y integración con World App
 */

import jwt from 'jsonwebtoken';
import { VerifyProofOptions } from '@worldcoin/idkit-core';

// === CONFIGURACIÓN WORLD ID ===
const WORLD_CONFIG = {
  // Configuración de la app
  APP_ID: process.env.WORLD_APP_ID || 'app_staging_c8e24bc1de7bc2c3d2b6de7d2e8cf922',
  ACTION_NAME: process.env.WORLD_ACTION || 'login',
  
  // URLs de verificación
  VERIFY_URL: process.env.NODE_ENV === 'production' 
    ? 'https://developer.worldcoin.org/api/v1/verify'
    : 'https://developer.worldcoin.org/api/v1/verify', // Usar mismo endpoint para staging
  
  // Configuración JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: '7d',
  
  // Configuración de verificación
  VERIFICATION: {
    TIMEOUT: 30000, // 30 segundos
    MAX_RETRIES: 3,
    REQUIRED_VERIFICATION_LEVEL: 'orb', // o 'phone'
    ALLOW_DEV_BYPASS: process.env.NODE_ENV === 'development'
  },
  
  // Cache de nullifiers para prevenir replay attacks
  NULLIFIER_CACHE_TTL: 24 * 60 * 60 * 1000, // 24 horas
  
  // Rate limiting
  RATE_LIMIT: {
    MAX_ATTEMPTS: 5,
    WINDOW_MS: 15 * 60 * 1000, // 15 minutos
    BLOCK_DURATION: 60 * 60 * 1000 // 1 hora
  }
};

// === CACHE Y ESTADO ===
const nullifierCache = new Map();
const rateLimitCache = new Map();
const verificationAttempts = new Map();

// === UTILIDADES ===
function cleanExpiredEntries() {
  const now = Date.now();
  
  // Limpiar nullifiers
  for (const [key, data] of nullifierCache) {
    if (now > data.expires) {
      nullifierCache.delete(key);
    }
  }
  
  // Limpiar rate limits
  for (const [key, data] of rateLimitCache) {
    if (now > data.resetTime) {
      rateLimitCache.delete(key);
    }
  }
}

function checkRateLimit(identifier) {
  const now = Date.now();
  const key = `rate_${identifier}`;
  
  let rateData = rateLimitCache.get(key);
  
  if (!rateData) {
    rateData = {
      count: 0,
      resetTime: now + WORLD_CONFIG.RATE_LIMIT.WINDOW_MS,
      blockedUntil: 0
    };
    rateLimitCache.set(key, rateData);
  }
  
  // Verificar si está bloqueado
  if (now < rateData.blockedUntil) {
    throw new Error('Rate limit exceeded. Try again later.');
  }
  
  // Reset si pasó la ventana
  if (now > rateData.resetTime) {
    rateData.count = 0;
    rateData.resetTime = now + WORLD_CONFIG.RATE_LIMIT.WINDOW_MS;
    rateData.blockedUntil = 0;
  }
  
  // Verificar límite
  if (rateData.count >= WORLD_CONFIG.RATE_LIMIT.MAX_ATTEMPTS) {
    rateData.blockedUntil = now + WORLD_CONFIG.RATE_LIMIT.BLOCK_DURATION;
    throw new Error('Too many verification attempts. Please try again later.');
  }
  
  rateData.count++;
  return true;
}

function validateProofStructure(proof) {
  // Validar estructura básica del proof
  const requiredFields = [
    'proof',
    'merkle_root', 
    'nullifier_hash',
    'verification_level'
  ];
  
  for (const field of requiredFields) {
    if (!proof[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Validar formato de hashes
  if (!/^0x[a-fA-F0-9]{64}$/.test(proof.nullifier_hash)) {
    throw new Error('Invalid nullifier hash format');
  }
  
  if (!/^0x[a-fA-F0-9]{64}$/.test(proof.merkle_root)) {
    throw new Error('Invalid merkle root format');
  }
  
  // Validar verification level
  if (!['orb', 'phone'].includes(proof.verification_level)) {
    throw new Error('Invalid verification level');
  }
  
  // Verificar que cumple con los requisitos mínimos
  if (WORLD_CONFIG.VERIFICATION.REQUIRED_VERIFICATION_LEVEL === 'orb' && 
      proof.verification_level !== 'orb') {
    throw new Error('Orb verification required');
  }
  
  return true;
}

function isNullifierUsed(nullifierHash) {
  const cached = nullifierCache.get(nullifierHash);
  return cached && Date.now() < cached.expires;
}

function markNullifierUsed(nullifierHash, userId) {
  nullifierCache.set(nullifierHash, {
    userId,
    timestamp: Date.now(),
    expires: Date.now() + WORLD_CONFIG.NULLIFIER_CACHE_TTL
  });
}

async function createUserJWT(worldIdHash, verificationLevel, metadata = {}) {
  const payload = {
    worldIdHash,
    verificationLevel,
    type: 'world_id_auth',
    permissions: ['play', 'payments', 'leaderboard', 'ideas'],
    metadata,
    iat: Math.floor(Date.now() / 1000)
  };
  
  return jwt.sign(payload, WORLD_CONFIG.JWT_SECRET, {
    expiresIn: WORLD_CONFIG.JWT_EXPIRES_IN,
    issuer: 'rainbowgold-tap',
    audience: 'rgt-users'
  });
}

// === VERIFICACIÓN DE PROOF ===
async function verifyWithWorldcoin(proof) {
  try {
    const verifyPayload = {
      app_id: WORLD_CONFIG.APP_ID,
      action: WORLD_CONFIG.ACTION_NAME,
      signal: proof.signal || '',
      proof: proof.proof,
      nullifier_hash: proof.nullifier_hash,
      merkle_root: proof.merkle_root
    };

    const response = await fetch(WORLD_CONFIG.VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WORLDCOIN_API_KEY || ''}`
      },
      body: JSON.stringify(verifyPayload),
      signal: AbortSignal.timeout(WORLD_CONFIG.VERIFICATION.TIMEOUT)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Worldcoin verification failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Worldcoin responde con success: true/false
    if (!result.success) {
      throw new Error('Proof verification failed');
    }

    return {
      success: true,
      verification_level: proof.verification_level,
      verified_at: new Date().toISOString()
    };

  } catch (error) {
    console.error('Worldcoin verification error:', error);
    
    // En desarrollo, permitir bypass con un proof especial
    if (WORLD_CONFIG.VERIFICATION.ALLOW_DEV_BYPASS && 
        proof.nullifier_hash === '0xdev_bypass_nullifier_hash_for_testing_only_12345678901234567890') {
      console.warn('⚠️  DEV BYPASS: World ID verification skipped');
      return {
        success: true,
        verification_level: 'orb',
        verified_at: new Date().toISOString(),
        dev_bypass: true
      };
    }
    
    throw error;
  }
}

// === ENDPOINTS ===

/**
 * POST /api/auth/worldcoin/verify
 * Verificar proof de World ID y crear sesión
 */
export async function verifyWorldID(req, res) {
  try {
    cleanExpiredEntries();
    
    const { proof, signal, metadata = {} } = req.body;
    
    if (!proof) {
      return res.status(400).json({
        success: false,
        error: 'Proof is required'
      });
    }

    // Rate limiting por IP
    const clientIP = req.ip || req.connection.remoteAddress;
    checkRateLimit(clientIP);

    // Validar estructura del proof
    validateProofStructure(proof);

    // Verificar si el nullifier ya fue usado
    if (isNullifierUsed(proof.nullifier_hash)) {
      return res.status(400).json({
        success: false,
        error: 'This World ID has already been used'
      });
    }

    // Registrar intento de verificación
    const attemptKey = `${clientIP}_${proof.nullifier_hash}`;
    const attempts = verificationAttempts.get(attemptKey) || 0;
    
    if (attempts >= WORLD_CONFIG.VERIFICATION.MAX_RETRIES) {
      return res.status(429).json({
        success: false,
        error: 'Maximum verification attempts exceeded'
      });
    }

    verificationAttempts.set(attemptKey, attempts + 1);

    // Verificar proof con Worldcoin
    const verificationResult = await verifyWithWorldcoin({
      ...proof,
      signal
    });

    if (!verificationResult.success) {
      return res.status(401).json({
        success: false,
        error: 'World ID verification failed'
      });
    }

    // Crear o actualizar usuario en base de datos
    const user = await createOrUpdateUser(proof.nullifier_hash, {
      verification_level: verificationResult.verification_level,
      verified_at: verificationResult.verified_at,
      client_ip: clientIP,
      user_agent: req.get('User-Agent'),
      ...metadata
    });

    // Marcar nullifier como usado
    markNullifierUsed(proof.nullifier_hash, user.id);

    // Crear JWT token
    const token = await createUserJWT(
      proof.nullifier_hash, 
      verificationResult.verification_level,
      {
        user_id: user.id,
        client_ip: clientIP,
        dev_bypass: verificationResult.dev_bypass || false
      }
    );

    // Limpiar intentos exitosos
    verificationAttempts.delete(attemptKey);

    // Respuesta exitosa
    res.json({
      success: true,
      user: {
        id: user.id,
        world_id_hash: proof.nullifier_hash,
        verification_level: verificationResult.verification_level,
        created_at: user.created_at,
        is_new_user: user.is_new
      },
      token,
      expires_in: WORLD_CONFIG.JWT_EXPIRES_IN,
      requires_siwe: !user.ethereum_address, // Si necesita conectar wallet
      message: user.is_new ? 'Welcome to RainbowGold Tap!' : 'Welcome back!'
    });

  } catch (error) {
    console.error('World ID verification error:', error);
    
    // Errores específicos con códigos apropiados
    if (error.message.includes('Rate limit')) {
      return res.status(429).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('already been used')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }
    
    if (error.message.includes('verification failed')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid World ID proof'
      });
    }
    
    // Error genérico
    res.status(500).json({
      success: false,
      error: 'Verification process failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * GET /api/auth/worldcoin/status/:nullifier
 * Verificar estado de un World ID
 */
export async function getWorldIDStatus(req, res) {
  try {
    const { nullifier } = req.params;
    
    if (!/^0x[a-fA-F0-9]{64}$/.test(nullifier)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid nullifier format'
      });
    }

    const isUsed = isNullifierUsed(nullifier);
    const user = await findUserByWorldID(nullifier);

    res.json({
      success: true,
      nullifier,
      is_used: isUsed,
      user_exists: !!user,
      user_info: user ? {
        id: user.id,
        created_at: user.created_at,
        verification_level: user.world_verification_level,
        has_ethereum: !!user.ethereum_address
      } : null
    });

  } catch (error) {
    console.error('World ID status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check World ID status'
    });
  }
}

/**
 * POST /api/auth/worldcoin/revoke
 * Revocar acceso de un World ID (admin only)
 */
export async function revokeWorldID(req, res) {
  try {
    // Verificar permisos de admin (implementar según tu sistema)
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { nullifier, reason = 'Admin revocation' } = req.body;
    
    if (!nullifier) {
      return res.status(400).json({
        success: false,
        error: 'Nullifier is required'
      });
    }

    // Marcar como usado permanentemente
    markNullifierUsed(nullifier, 'REVOKED');
    
    // Desactivar usuario en base de datos
    await revokeUserAccess(nullifier, reason, req.user.id);

    res.json({
      success: true,
      message: 'World ID access revoked successfully',
      nullifier,
      reason,
      revoked_by: req.user.id,
      revoked_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('World ID revocation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke World ID'
    });
  }
}

/**
 * GET /api/auth/worldcoin/stats
 * Estadísticas de verificaciones (admin only)
 */
export async function getVerificationStats(req, res) {
  try {
    if (!req.user || !req.user.is_admin) {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const stats = await getWorldIDStats();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        cache_size: {
          nullifiers: nullifierCache.size,
          rate_limits: rateLimitCache.size,
          verification_attempts: verificationAttempts.size
        }
      }
    });

  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch verification stats'
    });
  }
}

// === FUNCIONES DE BASE DE DATOS ===
async function createOrUpdateUser(worldIdHash, verificationData) {
  try {
    /* Implementación con tu esquema de base de datos:
    
    const existingUser = await db.query(`
      SELECT id, created_at, ethereum_address 
      FROM users 
      WHERE world_id_hash = $1
    `, [worldIdHash]);
    
    if (existingUser.rows.length > 0) {
      // Usuario existente - actualizar datos de verificación
      await db.query(`
        UPDATE users 
        SET world_verification_level = $2,
            world_verified_at = $3,
            last_login_at = NOW(),
            last_activity_at = NOW()
        WHERE world_id_hash = $1
      `, [
        worldIdHash, 
        verificationData.verification_level, 
        verificationData.verified_at
      ]);
      
      return {
        ...existingUser.rows[0],
        is_new: false
      };
    } else {
      // Nuevo usuario
      const newUser = await db.query(`
        INSERT INTO users (
          world_id_hash,
          world_verification_level, 
          world_verified_at,
          world_verification_status,
          created_at,
          last_login_at,
          last_activity_at
        ) VALUES ($1, $2, $3, 'verified', NOW(), NOW(), NOW())
        RETURNING id, created_at, ethereum_address
      `, [
        worldIdHash,
        verificationData.verification_level,
        verificationData.verified_at
      ]);
      
      // Crear estado inicial del juego
      await db.query(`
        INSERT INTO user_game_state (user_id) VALUES ($1)
      `, [newUser.rows[0].id]);
      
      return {
        ...newUser.rows[0],
        is_new: true
      };
    }
    */
    
    // Mock para desarrollo
    console.log('Creating/updating user for World ID:', worldIdHash);
    return {
      id: `user_${worldIdHash.substring(2, 10)}`,
      created_at: new Date().toISOString(),
      ethereum_address: null,
      is_new: true
    };
    
  } catch (error) {
    console.error('Database error in createOrUpdateUser:', error);
    throw error;
  }
}

async function findUserByWorldID(worldIdHash) {
  try {
    /* Implementación real:
    const result = await db.query(`
      SELECT id, created_at, world_verification_level, ethereum_address
      FROM users 
      WHERE world_id_hash = $1 AND status = 'active'
    `, [worldIdHash]);
    
    return result.rows[0] || null;
    */
    
    // Mock para desarrollo
    if (nullifierCache.has(worldIdHash)) {
      return {
        id: 'mock_user_123',
        created_at: new Date().toISOString(),
        world_verification_level: 'orb',
        ethereum_address: null
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('Database error in findUserByWorldID:', error);
    throw error;
  }
}

async function revokeUserAccess(worldIdHash, reason, adminId) {
  try {
    /* Implementación real:
    await db.query(`
      UPDATE users 
      SET status = 'banned',
          updated_at = NOW()
      WHERE world_id_hash = $1
    `, [worldIdHash]);
    
    // Log de auditoría
    await db.query(`
      INSERT INTO admin_actions (admin_id, action_type, target_user_world_id, reason, created_at)
      VALUES ($1, 'revoke_world_id', $2, $3, NOW())
    `, [adminId, worldIdHash, reason]);
    */
    
    console.log(`Access revoked for ${worldIdHash} by admin ${adminId}: ${reason}`);
    
  } catch (error) {
    console.error('Database error in revokeUserAccess:', error);
    throw error;
  }
}

async function getWorldIDStats() {
  try {
    /* Implementación real:
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN world_verification_level = 'orb' THEN 1 END) as orb_verified,
        COUNT(CASE WHEN world_verification_level = 'phone' THEN 1 END) as phone_verified,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as new_users_24h,
        COUNT(CASE WHEN last_login_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as active_users_24h
      FROM users 
      WHERE world_verification_status = 'verified' AND status = 'active'
    `);
    
    return stats.rows[0];
    */
    
    // Mock para desarrollo
    return {
      total_users: 1234,
      orb_verified: 800,
      phone_verified: 434,
      new_users_24h: 45,
      active_users_24h: 234
    };
    
  } catch (error) {
    console.error('Database error in getWorldIDStats:', error);
    throw error;
  }
}

// === MIDDLEWARE ===
export function requireWorldIDAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, WORLD_CONFIG.JWT_SECRET);
      
      // Verificar que es un token de World ID
      if (decoded.type !== 'world_id_auth') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token type'
        });
      }
      
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    
  } catch (error) {
    console.error('World ID auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
}

// === CLEANUP AUTOMÁTICO ===
setInterval(cleanExpiredEntries, 5 * 60 * 1000); // Limpiar cada 5 minutos

// === EXPORTAR CONFIGURACIÓN ===
export const worldConfig = WORLD_CONFIG;