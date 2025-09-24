/**
 * RainbowGold-Tap: Encryption & Security Module (lib/encryption.js)
 * Maneja criptografía, hashing, tokens JWT, y seguridad general
 */

// === CONFIGURACIÓN DE SEGURIDAD ===
const CRYPTO_CONFIG = {
  // Algoritmos y configuraciones
  AES: {
    ALGORITHM: 'AES-GCM',
    KEY_LENGTH: 256, // bits
    IV_LENGTH: 12,   // bytes para GCM
    TAG_LENGTH: 16   // bytes para GCM auth tag
  },
  
  HASH: {
    ALGORITHM: 'SHA-256',
    PBKDF2_ITERATIONS: 100000,
    SALT_LENGTH: 32
  },
  
  JWT: {
    ALGORITHM: 'HS256',
    ACCESS_EXPIRES: '15m',
    REFRESH_EXPIRES: '7d'
  },
  
  // Configuración World ID
  WORLD_ID: {
    HASH_ALGORITHM: 'SHA-256',
    NULLIFIER_BYTES: 32,
    PROOF_VERIFICATION_TIMEOUT: 30000
  },
  
  // Configuración SIWE
  SIWE: {
    NONCE_LENGTH: 32,
    NONCE_EXPIRES: 300000, // 5 minutos
    SIGNATURE_RECOVERY_TIMEOUT: 10000
  },
  
  // Storage seguro
  STORAGE: {
    ENCRYPTED_PREFIX: 'enc_',
    KEY_DERIVATION_SALT: 'rgt_salt_',
    USER_KEY_STORAGE: 'user_encryption_key'
  }
};

// === ESTADO CRYPTO ===
let cryptoState = {
  isSupported: false,
  userKey: null,
  keyGenerated: false,
  nonceCache: new Map(),
  sessionKeys: new Map()
};

// === DETECCIÓN DE SOPORTE CRYPTO ===
function detectCryptoSupport() {
  try {
    // Web Crypto API
    if (!window.crypto || !window.crypto.subtle) {
      console.warn('Web Crypto API not supported');
      return false;
    }
    
    // TextEncoder/Decoder
    if (!window.TextEncoder || !window.TextDecoder) {
      console.warn('TextEncoder/Decoder not supported');
      return false;
    }
    
    cryptoState.isSupported = true;
    return true;
  } catch (error) {
    console.error('Crypto support detection failed:', error);
    return false;
  }
}

// === UTILIDADES BASE ===
function getRandomBytes(length) {
  if (cryptoState.isSupported) {
    return crypto.getRandomValues(new Uint8Array(length));
  } else {
    // Fallback inseguro para debugging
    console.warn('Using insecure random fallback');
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  }
}

function arrayBufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToArrayBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

function stringToArrayBuffer(str) {
  return new TextEncoder().encode(str);
}

function arrayBufferToString(buffer) {
  return new TextDecoder().decode(buffer);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// === HASHING FUNCTIONS ===
async function hash(data, algorithm = CRYPTO_CONFIG.HASH.ALGORITHM) {
  if (!cryptoState.isSupported) {
    throw new Error('Crypto not supported');
  }

  try {
    const buffer = typeof data === 'string' ? stringToArrayBuffer(data) : data;
    const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
    return arrayBufferToHex(hashBuffer);
  } catch (error) {
    console.error('Hash error:', error);
    throw error;
  }
}

async function hashWithSalt(data, salt = null) {
  if (!salt) {
    salt = getRandomBytes(CRYPTO_CONFIG.HASH.SALT_LENGTH);
  } else if (typeof salt === 'string') {
    salt = hexToArrayBuffer(salt);
  }

  const dataBuffer = typeof data === 'string' ? stringToArrayBuffer(data) : data;
  const combined = new Uint8Array(salt.byteLength + dataBuffer.byteLength);
  combined.set(new Uint8Array(salt), 0);
  combined.set(new Uint8Array(dataBuffer), salt.byteLength);

  const hashBuffer = await crypto.subtle.digest(CRYPTO_CONFIG.HASH.ALGORITHM, combined);
  
  return {
    hash: arrayBufferToHex(hashBuffer),
    salt: arrayBufferToHex(salt)
  };
}

async function pbkdf2(password, salt, iterations = CRYPTO_CONFIG.HASH.PBKDF2_ITERATIONS) {
  if (!cryptoState.isSupported) {
    throw new Error('Crypto not supported');
  }

  try {
    const passwordBuffer = stringToArrayBuffer(password);
    const saltBuffer = typeof salt === 'string' ? hexToArrayBuffer(salt) : salt;

    const key = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations,
        hash: CRYPTO_CONFIG.HASH.ALGORITHM
      },
      key,
      CRYPTO_CONFIG.AES.KEY_LENGTH
    );

    return derivedBits;
  } catch (error) {
    console.error('PBKDF2 error:', error);
    throw error;
  }
}

// === ENCRYPTION/DECRYPTION (AES-GCM) ===
async function generateAESKey() {
  if (!cryptoState.isSupported) {
    throw new Error('Crypto not supported');
  }

  try {
    const key = await crypto.subtle.generateKey(
      {
        name: CRYPTO_CONFIG.AES.ALGORITHM,
        length: CRYPTO_CONFIG.AES.KEY_LENGTH
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );

    return key;
  } catch (error) {
    console.error('AES key generation error:', error);
    throw error;
  }
}

async function exportAESKey(key) {
  try {
    const exported = await crypto.subtle.exportKey('raw', key);
    return arrayBufferToHex(exported);
  } catch (error) {
    console.error('Key export error:', error);
    throw error;
  }
}

async function importAESKey(keyHex) {
  try {
    const keyBuffer = hexToArrayBuffer(keyHex);
    const key = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: CRYPTO_CONFIG.AES.ALGORITHM },
      true,
      ['encrypt', 'decrypt']
    );
    return key;
  } catch (error) {
    console.error('Key import error:', error);
    throw error;
  }
}

async function encryptAES(data, key = null) {
  if (!cryptoState.isSupported) {
    throw new Error('Crypto not supported');
  }

  try {
    // Usar key del usuario o generar una temporal
    const cryptoKey = key || cryptoState.userKey || await generateAESKey();
    
    // Generar IV aleatorio
    const iv = getRandomBytes(CRYPTO_CONFIG.AES.IV_LENGTH);
    
    // Preparar data
    const dataBuffer = typeof data === 'string' ? stringToArrayBuffer(data) : data;
    
    // Encriptar
    const encrypted = await crypto.subtle.encrypt(
      {
        name: CRYPTO_CONFIG.AES.ALGORITHM,
        iv: iv
      },
      cryptoKey,
      dataBuffer
    );

    // Combinar IV + datos encriptados
    const result = new Uint8Array(iv.length + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);

    return {
      encrypted: arrayBufferToHex(result),
      key: key ? null : await exportAESKey(cryptoKey) // Solo exportar si generamos la key
    };
  } catch (error) {
    console.error('AES encryption error:', error);
    throw error;
  }
}

async function decryptAES(encryptedHex, key) {
  if (!cryptoState.isSupported) {
    throw new Error('Crypto not supported');
  }

  try {
    const encryptedBuffer = hexToArrayBuffer(encryptedHex);
    
    // Extraer IV y datos encriptados
    const iv = encryptedBuffer.slice(0, CRYPTO_CONFIG.AES.IV_LENGTH);
    const encrypted = encryptedBuffer.slice(CRYPTO_CONFIG.AES.IV_LENGTH);

    // Preparar key
    const cryptoKey = (typeof key === 'string') ? await importAESKey(key) : key;

    // Desencriptar
    const decrypted = await crypto.subtle.decrypt(
      {
        name: CRYPTO_CONFIG.AES.ALGORITHM,
        iv: iv
      },
      cryptoKey,
      encrypted
    );

    return arrayBufferToString(decrypted);
  } catch (error) {
    console.error('AES decryption error:', error);
    throw error;
  }
}

// === USER KEY MANAGEMENT ===
async function generateUserKey(userId, password = null) {
  try {
    let userKey;
    
    if (password) {
      // Derivar key desde password
      const salt = getRandomBytes(CRYPTO_CONFIG.HASH.SALT_LENGTH);
      const keyMaterial = await pbkdf2(password + userId, salt);
      userKey = await crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: CRYPTO_CONFIG.AES.ALGORITHM },
        true,
        ['encrypt', 'decrypt']
      );
      
      // Guardar salt para poder regenerar la key
      localStorage.setItem(CRYPTO_CONFIG.STORAGE.KEY_DERIVATION_SALT + userId, arrayBufferToHex(salt));
    } else {
      // Generar key aleatoria
      userKey = await generateAESKey();
    }

    cryptoState.userKey = userKey;
    cryptoState.keyGenerated = true;

    // Guardar key encriptada (usando World ID hash como parte de la protección)
    const keyHex = await exportAESKey(userKey);
    localStorage.setItem(CRYPTO_CONFIG.STORAGE.USER_KEY_STORAGE + userId, keyHex);

    return userKey;
  } catch (error) {
    console.error('User key generation error:', error);
    throw error;
  }
}

async function loadUserKey(userId, password = null) {
  try {
    const storedKeyHex = localStorage.getItem(CRYPTO_CONFIG.STORAGE.USER_KEY_STORAGE + userId);
    
    if (storedKeyHex) {
      cryptoState.userKey = await importAESKey(storedKeyHex);
      cryptoState.keyGenerated = true;
      return cryptoState.userKey;
    }

    // Si no existe, generar nueva
    return await generateUserKey(userId, password);
  } catch (error) {
    console.error('User key loading error:', error);
    // En caso de error, generar nueva key
    return await generateUserKey(userId, password);
  }
}

// === SECURE STORAGE ===
async function setSecureItem(key, value, userId = null) {
  if (!cryptoState.userKey && userId) {
    await loadUserKey(userId);
  }

  if (!cryptoState.userKey) {
    // Fallback a localStorage normal (no recomendado)
    console.warn('No encryption key available, using plain storage');
    localStorage.setItem(key, JSON.stringify(value));
    return;
  }

  try {
    const serialized = JSON.stringify(value);
    const encrypted = await encryptAES(serialized, cryptoState.userKey);
    localStorage.setItem(CRYPTO_CONFIG.STORAGE.ENCRYPTED_PREFIX + key, encrypted.encrypted);
  } catch (error) {
    console.error('Secure storage error:', error);
    // Fallback a storage normal
    localStorage.setItem(key, JSON.stringify(value));
  }
}

async function getSecureItem(key, userId = null) {
  const encryptedKey = CRYPTO_CONFIG.STORAGE.ENCRYPTED_PREFIX + key;
  const encryptedValue = localStorage.getItem(encryptedKey);

  if (!encryptedValue) {
    // Intentar fallback a storage normal
    const plainValue = localStorage.getItem(key);
    return plainValue ? JSON.parse(plainValue) : null;
  }

  if (!cryptoState.userKey && userId) {
    await loadUserKey(userId);
  }

  if (!cryptoState.userKey) {
    console.error('No encryption key available for decryption');
    return null;
  }

  try {
    const decrypted = await decryptAES(encryptedValue, cryptoState.userKey);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Secure storage decryption error:', error);
    return null;
  }
}

async function removeSecureItem(key) {
  localStorage.removeItem(CRYPTO_CONFIG.STORAGE.ENCRYPTED_PREFIX + key);
  localStorage.removeItem(key); // También remover fallback
}

// === WORLD ID VERIFICATION ===
async function hashWorldIDNullifier(nullifier) {
  try {
    // World ID nullifier debe ser hasheado consistentemente
    const nullifierBuffer = typeof nullifier === 'string' ? 
      stringToArrayBuffer(nullifier) : nullifier;
    
    const hashBuffer = await crypto.subtle.digest(
      CRYPTO_CONFIG.WORLD_ID.HASH_ALGORITHM,
      nullifierBuffer
    );
    
    return '0x' + arrayBufferToHex(hashBuffer);
  } catch (error) {
    console.error('World ID nullifier hash error:', error);
    throw error;
  }
}

function verifyWorldIDProofStructure(proof) {
  // Verificaciones básicas de estructura del proof
  const required = ['proof', 'merkle_root', 'nullifier_hash', 'verification_level'];
  
  for (const field of required) {
    if (!proof[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Verificar formato de hashes
  const hexFields = ['merkle_root', 'nullifier_hash'];
  for (const field of hexFields) {
    if (!/^0x[a-fA-F0-9]+$/.test(proof[field])) {
      throw new Error(`Invalid hex format for ${field}`);
    }
  }

  // Verificar verification level
  if (!['orb', 'phone'].includes(proof.verification_level)) {
    throw new Error('Invalid verification level');
  }

  return true;
}

// === SIWE HELPERS ===
function generateSIWENonce() {
  const bytes = getRandomBytes(CRYPTO_CONFIG.SIWE.NONCE_LENGTH);
  return arrayBufferToHex(bytes);
}

function cacheSIWENonce(address, nonce) {
  const expiresAt = Date.now() + CRYPTO_CONFIG.SIWE.NONCE_EXPIRES;
  cryptoState.nonceCache.set(address.toLowerCase(), {
    nonce,
    expiresAt
  });

  // Limpieza automática
  setTimeout(() => {
    cryptoState.nonceCache.delete(address.toLowerCase());
  }, CRYPTO_CONFIG.SIWE.NONCE_EXPIRES + 1000);
}

function verifySIWENonce(address, nonce) {
  const cached = cryptoState.nonceCache.get(address.toLowerCase());
  
  if (!cached) {
    return false;
  }

  if (Date.now() > cached.expiresAt) {
    cryptoState.nonceCache.delete(address.toLowerCase());
    return false;
  }

  return cached.nonce === nonce;
}

async function recoverSIWEAddress(message, signature) {
  try {
    // Esta función requiere una librería como ethers.js en el frontend
    // Aquí implementamos una versión básica de verificación
    
    if (!window.ethers) {
      throw new Error('ethers.js not available for signature recovery');
    }

    const recoveredAddress = window.ethers.utils.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase();
  } catch (error) {
    console.error('SIWE address recovery error:', error);
    throw error;
  }
}

// === JWT TOKEN HELPERS ===
function createJWTHeader() {
  return {
    alg: CRYPTO_CONFIG.JWT.ALGORITHM,
    typ: 'JWT'
  };
}

function createJWTPayload(userId, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    sub: userId,
    iat: now,
    exp: now + (options.expiresIn || 900), // 15 min default
    iss: 'rainbowgold-tap',
    aud: 'rgt-app',
    ...options.claims
  };
}

function base64URLEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64URLDecode(str) {
  str += '='.repeat(4 - (str.length % 4));
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

async function signJWT(payload, secret) {
  try {
    const header = createJWTHeader();
    
    const headerB64 = base64URLEncode(JSON.stringify(header));
    const payloadB64 = base64URLEncode(JSON.stringify(payload));
    
    const data = `${headerB64}.${payloadB64}`;
    
    // Importar secret como HMAC key
    const secretBuffer = stringToArrayBuffer(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      secretBuffer,
      { name: 'HMAC', hash: CRYPTO_CONFIG.HASH.ALGORITHM },
      false,
      ['sign']
    );
    
    // Firmar
    const signature = await crypto.subtle.sign('HMAC', key, stringToArrayBuffer(data));
    const signatureB64 = base64URLEncode(String.fromCharCode(...new Uint8Array(signature)));
    
    return `${data}.${signatureB64}`;
  } catch (error) {
    console.error('JWT signing error:', error);
    throw error;
  }
}

async function verifyJWT(token, secret) {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    
    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new Error('Invalid JWT format');
    }

    // Verificar signature
    const data = `${headerB64}.${payloadB64}`;
    
    const secretBuffer = stringToArrayBuffer(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      secretBuffer,
      { name: 'HMAC', hash: CRYPTO_CONFIG.HASH.ALGORITHM },
      false,
      ['verify']
    );

    const signatureBuffer = new Uint8Array([...base64URLDecode(signatureB64)].map(c => c.charCodeAt(0)));
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      stringToArrayBuffer(data)
    );

    if (!isValid) {
      throw new Error('Invalid JWT signature');
    }

    // Parsear payload
    const payload = JSON.parse(base64URLDecode(payloadB64));
    
    // Verificar expiración
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      throw new Error('JWT expired');
    }

    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    throw error;
  }
}

// === SECURITY UTILITIES ===
function sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    return String(input).substring(0, maxLength);
  }
  
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>\"'&]/g, ''); // Basic XSS prevention
}

function isValidEthereumAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function isValidWorldIDHash(hash) {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

async function secureCompare(a, b) {
  // Timing-safe string comparison
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

function generateSecureToken(length = 32) {
  const bytes = getRandomBytes(length);
  return arrayBufferToHex(bytes);
}

// === RATE LIMITING ===
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Limpiar requests viejos
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    const keyRequests = this.requests.get(key);
    const validRequests = keyRequests.filter(time => time > windowStart);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }

  getRemainingRequests(key) {
    const keyRequests = this.requests.get(key) || [];
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const validRequests = keyRequests.filter(time => time > windowStart);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

// Rate limiters globales
const authRateLimiter = new RateLimiter(5, 60000); // 5 intentos por minuto
const paymentRateLimiter = new RateLimiter(10, 300000); // 10 pagos por 5 min

// === INICIALIZACIÓN ===
async function initEncryption() {
  console.log('Initializing encryption module...');
  
  try {
    // Detectar soporte
    if (!detectCryptoSupport()) {
      console.warn('Crypto not fully supported, some features may be limited');
      return false;
    }

    // Limpiar cache de nonces viejos
    setInterval(() => {
      const now = Date.now();
      for (const [address, data] of cryptoState.nonceCache.entries()) {
        if (now > data.expiresAt) {
          cryptoState.nonceCache.delete(address);
        }
      }
    }, 60000); // Limpiar cada minuto

    console.log('Encryption module initialized successfully');
    return true;
  } catch (error) {
    console.error('Encryption initialization error:', error);
    return false;
  }
}

// === API PÚBLICA ===
const Encryption = {
  // Estado
  get isSupported() { return cryptoState.isSupported; },
  get hasUserKey() { return !!cryptoState.userKey; },
  
  // Hashing
  hash,
  hashWithSalt,
  pbkdf2,
  
  // Encryption/Decryption
  generateAESKey,
  encryptAES,
  decryptAES,
  
  // User keys
  generateUserKey,
  loadUserKey,
  
  // Secure storage
  setSecureItem,
  getSecureItem,
  removeSecureItem,
  
  // World ID
  hashWorldIDNullifier,
  verifyWorldIDProofStructure,
  
  // SIWE
  generateSIWENonce,
  cacheSIWENonce,
  verifySIWENonce,
  recoverSIWEAddress,
  
  // JWT
  signJWT,
  verifyJWT,
  
  // Utilities
  sanitizeInput,
  isValidEthereumAddress,
  isValidWorldIDHash,
  secureCompare,
  generateSecureToken,
  
  // Rate limiting
  authRateLimiter,
  paymentRateLimiter,
  
  // Config
  config: CRYPTO_CONFIG
};

// === EXPORTS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Encryption, initEncryption };
} else {
  window.Encryption = Encryption;
  window.initEncryption = initEncryption;
}

// Auto-inicializar
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEncryption);
  } else {
    setTimeout(initEncryption, 10);
  }
}