/**
 * api/auth/siwe.js - Sign-In with Ethereum Integration
 * Maneja autenticación SIWE después de World ID verification
 */

import { verifyMessage } from 'ethers';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

// === CONFIGURACIÓN SIWE ===
const SIWE_CONFIG = {
  DOMAIN: process.env.DOMAIN || 'rainbowgold-tap.vercel.app',
  SCHEME: process.env.NODE_ENV === 'production' ? 'https' : 'http',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: '7d',
  NONCE_EXPIRES: 10 * 60 * 1000, // 10 minutos
  REQUIRED_CHAIN_ID: 1, // Ethereum Mainnet (cambiar según necesidad)
  
  // Mensajes SIWE template
  STATEMENT: 'Welcome to RainbowGold Tap! Sign in to access your game progress and WLD rewards.',
  VERSION: '1'
};

// Cache de nonces (en producción usar Redis)
const nonceCache = new Map();

// === UTILIDADES ===
function generateNonce() {
  return createHash('sha256')
    .update(Math.random().toString() + Date.now().toString())
    .digest('hex')
    .substring(0, 16);
}

function cleanExpiredNonces() {
  const now = Date.now();
  for (const [key, data] of nonceCache) {
    if (now > data.expires) {
      nonceCache.delete(key);
    }
  }
}

function validateSiweMessage(message) {
  const requiredFields = [
    'domain',
    'address', 
    'statement',
    'uri',
    'version',
    'chainId',
    'nonce',
    'issuedAt'
  ];
  
  for (const field of requiredFields) {
    if (!message[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Validaciones específicas
  if (message.domain !== SIWE_CONFIG.DOMAIN) {
    throw new Error('Invalid domain');
  }
  
  if (message.version !== SIWE_CONFIG.VERSION) {
    throw new Error('Invalid SIWE version');
  }
  
  if (message.chainId !== SIWE_CONFIG.REQUIRED_CHAIN_ID) {
    throw new Error('Invalid chain ID');
  }
  
  return true;
}

async function createJWT(address, worldIdHash = null) {
  const payload = {
    address: address.toLowerCase(),
    worldIdHash,
    type: 'siwe_auth',
    gameSession: true,
    permissions: ['play', 'payments', 'leaderboard'],
    iat: Math.floor(Date.now() / 1000)
  };
  
  return jwt.sign(payload, SIWE_CONFIG.JWT_SECRET, {
    expiresIn: SIWE_CONFIG.JWT_EXPIRES_IN,
    issuer: SIWE_CONFIG.DOMAIN,
    audience: 'rainbowgold-players'
  });
}

// === ENDPOINTS ===

/**
 * GET /api/auth/siwe/nonce
 * Genera nonce para SIWE
 */
export async function generateSiweNonce(req, res) {
  try {
    // Limpiar nonces expirados
    cleanExpiredNonces();
    
    const nonce = generateNonce();
    const expires = Date.now() + SIWE_CONFIG.NONCE_EXPIRES;
    
    // Almacenar nonce
    nonceCache.set(nonce, {
      expires,
      used: false,
      createdAt: Date.now()
    });
    
    res.json({
      success: true,
      nonce,
      expiresIn: SIWE_CONFIG.NONCE_EXPIRES / 1000, // segundos
      domain: SIWE_CONFIG.DOMAIN
    });
    
  } catch (error) {
    console.error('Nonce generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate nonce'
    });
  }
}

/**
 * POST /api/auth/siwe/verify
 * Verifica firma SIWE y crea sesión
 */
export async function verifySiwe(req, res) {
  try {
    const { message, signature, worldIdHash } = req.body;
    
    if (!message || !signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing message or signature'
      });
    }
    
    // Parsear mensaje SIWE
    let parsedMessage;
    try {
      parsedMessage = typeof message === 'string' ? 
        JSON.parse(message) : message;
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message format'
      });
    }
    
    // Validar estructura del mensaje
    validateSiweMessage(parsedMessage);
    
    // Verificar nonce
    const nonceData = nonceCache.get(parsedMessage.nonce);
    if (!nonceData) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired nonce'
      });
    }
    
    if (nonceData.used) {
      return res.status(400).json({
        success: false,
        error: 'Nonce already used'
      });
    }
    
    if (Date.now() > nonceData.expires) {
      nonceCache.delete(parsedMessage.nonce);
      return res.status(400).json({
        success: false,
        error: 'Nonce expired'
      });
    }
    
    // Reconstruir mensaje SIWE para verificación
    const siweMessage = buildSiweMessage(parsedMessage);
    
    // Verificar firma
    let recoveredAddress;
    try {
      recoveredAddress = verifyMessage(siweMessage, signature);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
    }
    
    // Verificar que la dirección coincida
    if (recoveredAddress.toLowerCase() !== parsedMessage.address.toLowerCase()) {
      return res.status(401).json({
        success: false,
        error: 'Address mismatch'
      });
    }
    
    // Marcar nonce como usado
    nonceData.used = true;
    
    // Crear JWT token
    const token = await createJWT(recoveredAddress, worldIdHash);
    
    // Guardar sesión en base de datos (si tienes)
    await saveUserSession(recoveredAddress, worldIdHash, req);
    
    res.json({
      success: true,
      token,
      address: recoveredAddress.toLowerCase(),
      expiresIn: SIWE_CONFIG.JWT_EXPIRES_IN,
      worldIdLinked: !!worldIdHash
    });
    
  } catch (error) {
    console.error('SIWE verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Verification failed'
    });
  }
}

/**
 * POST /api/auth/siwe/refresh
 * Renueva token JWT
 */
export async function refreshSiweToken(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }
    
    const token = authHeader.substring(7);
    
    // Verificar token actual
    let decoded;
    try {
      decoded = jwt.verify(token, SIWE_CONFIG.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    
    // Crear nuevo token
    const newToken = await createJWT(decoded.address, decoded.worldIdHash);
    
    res.json({
      success: true,
      token: newToken,
      address: decoded.address,
      expiresIn: SIWE_CONFIG.JWT_EXPIRES_IN
    });
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token'
    });
  }
}

/**
 * POST /api/auth/siwe/logout  
 * Invalida sesión SIWE
 */
export async function logoutSiwe(req, res) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing authorization header'
      });
    }
    
    const token = authHeader.substring(7);
    
    // Verificar y obtener info del token
    let decoded;
    try {
      decoded = jwt.verify(token, SIWE_CONFIG.JWT_SECRET);
    } catch (error) {
      // Token inválido pero consideramos logout exitoso
      return res.json({
        success: true,
        message: 'Logged out successfully'
      });
    }
    
    // Invalidar sesión en base de datos
    await invalidateUserSession(decoded.address, token);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
}

// === UTILIDADES AUXILIARES ===

function buildSiweMessage(parsedMessage) {
  const {
    domain,
    address,
    statement,
    uri,
    version,
    chainId,
    nonce,
    issuedAt,
    expirationTime,
    notBefore,
    requestId,
    resources
  } = parsedMessage;
  
  let message = `${domain} wants you to sign in with your Ethereum account:\n`;
  message += `${address}\n\n`;
  
  if (statement) {
    message += `${statement}\n\n`;
  }
  
  message += `URI: ${uri}\n`;
  message += `Version: ${version}\n`;
  message += `Chain ID: ${chainId}\n`;
  message += `Nonce: ${nonce}\n`;
  message += `Issued At: ${issuedAt}`;
  
  if (expirationTime) {
    message += `\nExpiration Time: ${expirationTime}`;
  }
  
  if (notBefore) {
    message += `\nNot Before: ${notBefore}`;
  }
  
  if (requestId) {
    message += `\nRequest ID: ${requestId}`;
  }
  
  if (resources && resources.length > 0) {
    message += `\nResources:`;
    for (const resource of resources) {
      message += `\n- ${resource}`;
    }
  }
  
  return message;
}

async function saveUserSession(address, worldIdHash, req) {
  try {
    // Aquí guardarías la sesión en tu base de datos
    // Ejemplo con tu esquema:
    /*
    await db.user_sessions.create({
      address: address.toLowerCase(),
      world_id_hash: worldIdHash,
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      created_at: new Date(),
      last_active: new Date()
    });
    */
    console.log('Session saved for:', address);
  } catch (error) {
    console.error('Error saving session:', error);
  }
}

async function invalidateUserSession(address, token) {
  try {
    // Invalidar sesión en base de datos
    /*
    await db.user_sessions.update(
      { active: false, logout_at: new Date() },
      { where: { address: address.toLowerCase() } }
    );
    */
    console.log('Session invalidated for:', address);
  } catch (error) {
    console.error('Error invalidating session:', error);
  }
}

// === MIDDLEWARE ===
export function requireSiweAuth(req, res, next) {
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
      const decoded = jwt.verify(token, SIWE_CONFIG.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
}

// === EXPORTAR CONFIGURACIÓN ===
export const siweConfig = SIWE_CONFIG;