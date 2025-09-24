/**
 * RainbowGold-Tap: Authentication Manager
 * Maneja World ID (OIDC) + SIWE + estado de autenticación
 */

// === CONFIGURACIÓN ===
const AUTH_CONFIG = {
  APP_ID: 'app_staging_c8e24bc1de7bc2c3d2b6de7d2e8cf922', // Tu World App ID
  WORLD_APP_URL: 'https://simulator.worldcoin.org/id/app_staging_c8e24bc1de7bc2c3d2b6de7d2e8cf922',
  
  // Endpoints para tu backend
  ENDPOINTS: {
    VERIFY_WORLD: '/api/auth/verify-world',
    VERIFY_SIWE: '/api/auth/verify-siwe', 
    GET_NONCE: '/api/auth/nonce',
    REFRESH_TOKEN: '/api/auth/refresh'
  },
  
  // Storage keys para tokens y estado
  STORAGE: {
    ACCESS_TOKEN: 'wg_access_token',
    REFRESH_TOKEN: 'wg_refresh_token',
    WORLD_USER: 'wg_world_user',
    WALLET_ADDRESS: 'wg_wallet_address',
    SESSION_STATE: 'wg_session_state',
    LAST_AUTH: 'wg_last_auth'
  },
  
  // Timeouts y configuración
  TOKEN_REFRESH_MARGIN: 5 * 60 * 1000, // 5 min antes de expirar
  MAX_RETRY_ATTEMPTS: 3,
  SIWE_TIMEOUT: 30000, // 30s timeout para SIWE
  
  // Mensajes i18n básicos
  MESSAGES: {
    es: {
      connecting: 'Conectando con World ID...',
      signing: 'Firmando mensaje...',
      verifying: 'Verificando identidad...',
      success: 'Sesión iniciada correctamente',
      error: 'Error de autenticación',
      wallet_required: 'Wallet requerida',
      network_error: 'Error de conexión'
    },
    en: {
      connecting: 'Connecting to World ID...',
      signing: 'Signing message...',
      verifying: 'Verifying identity...',
      success: 'Successfully signed in',
      error: 'Authentication error', 
      wallet_required: 'Wallet required',
      network_error: 'Connection error'
    }
  }
};

// === ESTADO GLOBAL ===
let authState = {
  isAuthenticated: false,
  isAuthenticating: false,
  worldVerified: false,
  walletConnected: false,
  user: null,
  walletAddress: null,
  tokens: {
    access: null,
    refresh: null,
    expiresAt: null
  },
  retryCount: 0
};

// === UTILIDADES ===
function getStorageItem(key, defaultValue = null) {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch (e) {
    console.warn('Storage read error:', e);
    return defaultValue;
  }
}

function setStorageItem(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch (e) {
    console.warn('Storage write error:', e);
    return false;
  }
}

function removeStorageItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn('Storage remove error:', e);
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// === DETECCIÓN DE ENTORNO ===
function isWorldApp() {
  // Detecta si está corriendo dentro de World App
  return !!(
    window.navigator.userAgent.includes('WorldApp') ||
    window.worldcoin ||
    window.parent !== window ||
    window.location.href.includes('worldcoin.org')
  );
}

function isDesktopSimulator() {
  // Para testing en desktop con el simulador
  return !isWorldApp() && window.location.href.includes('simulator.worldcoin.org');
}

// === WORLD ID (OIDC) INTEGRATION ===
async function initiateWorldAuth() {
  try {
    authState.isAuthenticating = true;
    updateAuthStatus('connecting');

    // En World App: usar el bridge nativo
    if (isWorldApp()) {
      return await worldAppAuth();
    }
    
    // En desktop: redirigir al simulador
    if (isDesktopSimulator()) {
      return await desktopSimulatorAuth();
    }
    
    // Fallback: redirección manual
    return await redirectAuth();
    
  } catch (error) {
    console.error('World Auth error:', error);
    authState.retryCount++;
    throw error;
  }
}

async function worldAppAuth() {
  // Autenticación dentro de World App
  if (!window.worldcoin) {
    throw new Error('World App bridge not available');
  }

  try {
    const result = await window.worldcoin.requestAuth({
      app_id: AUTH_CONFIG.APP_ID,
      action: 'login',
      signal: generateNonce()
    });

    return await processWorldResult(result);
  } catch (error) {
    throw new Error(`World App auth failed: ${error.message}`);
  }
}

async function desktopSimulatorAuth() {
  // Para testing en desktop
  const authUrl = buildAuthUrl();
  
  // Abrir popup para auth
  const popup = window.open(
    authUrl, 
    'world_auth',
    'width=400,height=600,scrollbars=yes,resizable=yes'
  );

  return new Promise((resolve, reject) => {
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        reject(new Error('Auth popup was closed'));
      }
    }, 1000);

    // Escuchar mensaje del popup
    const messageHandler = (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'WORLD_AUTH_SUCCESS') {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        popup.close();
        resolve(processWorldResult(event.data.payload));
      }
      
      if (event.data.type === 'WORLD_AUTH_ERROR') {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        popup.close();
        reject(new Error(event.data.error));
      }
    };

    window.addEventListener('message', messageHandler);
    
    // Timeout
    setTimeout(() => {
      clearInterval(checkClosed);
      window.removeEventListener('message', messageHandler);
      if (!popup.closed) popup.close();
      reject(new Error('Auth timeout'));
    }, 60000);
  });
}

async function redirectAuth() {
  // Redirección completa (fallback)
  const authUrl = buildAuthUrl();
  setStorageItem('auth_return_url', window.location.href);
  window.location.href = authUrl;
}

function buildAuthUrl() {
  const params = new URLSearchParams({
    app_id: AUTH_CONFIG.APP_ID,
    action: 'login',
    signal: generateNonce(),
    redirect_uri: window.location.origin + '/auth/callback'
  });
  
  return `${AUTH_CONFIG.WORLD_APP_URL}?${params}`;
}

async function processWorldResult(result) {
  if (!result || !result.proof) {
    throw new Error('Invalid World ID result');
  }

  updateAuthStatus('verifying');

  // Verificar con tu backend
  const verified = await verifyWorldProof(result);
  
  if (verified.success) {
    authState.worldVerified = true;
    authState.user = verified.user;
    
    // Guardar datos del usuario de World ID
    setStorageItem(AUTH_CONFIG.STORAGE.WORLD_USER, JSON.stringify(verified.user));
    
    // Continuar con SIWE si es necesario
    if (verified.requiresSIWE) {
      return await initiateSIWE();
    }
    
    // Completar autenticación
    return completeAuth(verified);
  }
  
  throw new Error('World ID verification failed');
}

async function verifyWorldProof(proof) {
  try {
    const response = await fetch(AUTH_CONFIG.ENDPOINTS.VERIFY_WORLD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proof)
    });

    if (!response.ok) {
      throw new Error(`Verification failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('World proof verification error:', error);
    throw error;
  }
}

// === SIWE (Sign-In with Ethereum) ===
async function initiateSIWE() {
  try {
    updateAuthStatus('signing');

    // Detectar wallet disponible
    const wallet = await detectWallet();
    if (!wallet) {
      throw new Error('No wallet detected');
    }

    // Conectar wallet
    const accounts = await wallet.request({ method: 'eth_requestAccounts' });
    const address = accounts[0];
    
    authState.walletAddress = address;
    authState.walletConnected = true;

    // Obtener nonce del servidor
    const nonce = await getNonce(address);
    
    // Generar mensaje SIWE
    const message = buildSIWEMessage(address, nonce);
    
    // Firmar mensaje
    const signature = await wallet.request({
      method: 'personal_sign',
      params: [message, address]
    });

    // Verificar firma con el servidor
    const verified = await verifySIWE({
      message,
      signature,
      address
    });

    if (verified.success) {
      setStorageItem(AUTH_CONFIG.STORAGE.WALLET_ADDRESS, address);
      return completeAuth(verified);
    }

    throw new Error('SIWE verification failed');

  } catch (error) {
    console.error('SIWE error:', error);
    throw error;
  }
}

async function detectWallet() {
  // Detectar MetaMask, WalletConnect, etc.
  if (window.ethereum) {
    return window.ethereum;
  }
  
  // Esperar un poco por si se está cargando
  await sleep(1000);
  
  if (window.ethereum) {
    return window.ethereum;
  }
  
  return null;
}

async function getNonce(address) {
  try {
    const response = await fetch(`${AUTH_CONFIG.ENDPOINTS.GET_NONCE}?address=${address}`);
    const data = await response.json();
    return data.nonce;
  } catch (error) {
    console.error('Get nonce error:', error);
    return generateNonce();
  }
}

function buildSIWEMessage(address, nonce) {
  const domain = window.location.host;
  const origin = window.location.origin;
  const timestamp = new Date().toISOString();

  return `${domain} wants you to sign in with your Ethereum account:
${address}

Welcome to RainbowGold-Tap! Please sign this message to verify your identity.

URI: ${origin}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${timestamp}`;
}

async function verifySIWE(payload) {
  try {
    const response = await fetch(AUTH_CONFIG.ENDPOINTS.VERIFY_SIWE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`SIWE verification failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('SIWE verification error:', error);
    throw error;
  }
}

// === GESTIÓN DE TOKENS ===
function completeAuth(authResult) {
  // Guardar tokens
  if (authResult.tokens) {
    authState.tokens.access = authResult.tokens.access_token;
    authState.tokens.refresh = authResult.tokens.refresh_token;
    authState.tokens.expiresAt = Date.now() + (authResult.tokens.expires_in * 1000);
    
    setStorageItem(AUTH_CONFIG.STORAGE.ACCESS_TOKEN, authState.tokens.access);
    setStorageItem(AUTH_CONFIG.STORAGE.REFRESH_TOKEN, authState.tokens.refresh);
  }

  // Actualizar estado
  authState.isAuthenticated = true;
  authState.isAuthenticating = false;
  authState.retryCount = 0;

  // Guardar estado de sesión
  const sessionState = {
    authenticated: true,
    timestamp: Date.now(),
    worldVerified: authState.worldVerified,
    walletConnected: authState.walletConnected
  };
  
  setStorageItem(AUTH_CONFIG.STORAGE.SESSION_STATE, JSON.stringify(sessionState));
  setStorageItem(AUTH_CONFIG.STORAGE.LAST_AUTH, Date.now());

  updateAuthStatus('success');
  
  return authState;
}

async function refreshTokens() {
  const refreshToken = getStorageItem(AUTH_CONFIG.STORAGE.REFRESH_TOKEN);
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch(AUTH_CONFIG.ENDPOINTS.REFRESH_TOKEN, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const result = await response.json();
    
    if (result.tokens) {
      authState.tokens.access = result.tokens.access_token;
      authState.tokens.expiresAt = Date.now() + (result.tokens.expires_in * 1000);
      
      setStorageItem(AUTH_CONFIG.STORAGE.ACCESS_TOKEN, authState.tokens.access);
    }

    return result;
  } catch (error) {
    console.error('Token refresh error:', error);
    // Si falla el refresh, limpiar sesión
    await signOut();
    throw error;
  }
}

function shouldRefreshToken() {
  if (!authState.tokens.expiresAt) return false;
  
  const timeUntilExpiry = authState.tokens.expiresAt - Date.now();
  return timeUntilExpiry <= AUTH_CONFIG.TOKEN_REFRESH_MARGIN;
}

// === GESTIÓN DE SESIÓN ===
async function loadStoredSession() {
  try {
    const sessionState = getStorageItem(AUTH_CONFIG.STORAGE.SESSION_STATE);
    const accessToken = getStorageItem(AUTH_CONFIG.STORAGE.ACCESS_TOKEN);
    const worldUser = getStorageItem(AUTH_CONFIG.STORAGE.WORLD_USER);
    const walletAddress = getStorageItem(AUTH_CONFIG.STORAGE.WALLET_ADDRESS);

    if (sessionState && accessToken) {
      const session = JSON.parse(sessionState);
      
      authState.isAuthenticated = session.authenticated;
      authState.worldVerified = session.worldVerified;
      authState.walletConnected = session.walletConnected;
      authState.tokens.access = accessToken;
      
      if (worldUser) {
        authState.user = JSON.parse(worldUser);
      }
      
      if (walletAddress) {
        authState.walletAddress = walletAddress;
      }

      // Verificar si necesita refresh
      if (shouldRefreshToken()) {
        await refreshTokens();
      }

      return authState;
    }
  } catch (error) {
    console.warn('Error loading stored session:', error);
    await clearStoredSession();
  }

  return null;
}

async function clearStoredSession() {
  // Limpiar localStorage
  Object.values(AUTH_CONFIG.STORAGE).forEach(key => {
    removeStorageItem(key);
  });

  // Reset estado
  authState = {
    isAuthenticated: false,
    isAuthenticating: false,
    worldVerified: false,
    walletConnected: false,
    user: null,
    walletAddress: null,
    tokens: { access: null, refresh: null, expiresAt: null },
    retryCount: 0
  };
}

async function signOut() {
  try {
    // Notificar al servidor (opcional)
    if (authState.tokens.access) {
      fetch('/api/auth/signout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.tokens.access}`
        }
      }).catch(() => {}); // No importa si falla
    }
  } finally {
    await clearStoredSession();
    updateAuthStatus('signed_out');
  }
}

// === UTILIDADES ===
function generateNonce() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function updateAuthStatus(status, data = null) {
  // Emitir evento para que la UI pueda reaccionar
  const event = new CustomEvent('auth_status_change', {
    detail: { status, data, authState: { ...authState } }
  });
  
  window.dispatchEvent(event);
}

function getMessage(key, lang = 'es') {
  return AUTH_CONFIG.MESSAGES[lang]?.[key] || AUTH_CONFIG.MESSAGES.es[key] || key;
}

// === API PÚBLICA ===
const Auth = {
  // Estado
  get isAuthenticated() { return authState.isAuthenticated; },
  get isAuthenticating() { return authState.isAuthenticating; },
  get user() { return authState.user; },
  get walletAddress() { return authState.walletAddress; },
  get worldVerified() { return authState.worldVerified; },
  
  // Métodos principales
  signIn: initiateWorldAuth,
  signOut,
  
  // Sesión
  loadSession: loadStoredSession,
  refreshTokens,
  
  // Utilidades
  getToken: () => authState.tokens.access,
  isWorldApp,
  
  // Eventos
  on: (event, callback) => window.addEventListener(`auth_${event}`, callback),
  off: (event, callback) => window.removeEventListener(`auth_${event}`, callback)
};

// === INICIALIZACIÓN ===
async function initAuth() {
  try {
    // Intentar cargar sesión existente
    await loadStoredSession();
    
    // Auto-refresh tokens si es necesario
    if (authState.isAuthenticated && shouldRefreshToken()) {
      await refreshTokens();
    }
    
    updateAuthStatus('initialized');
    
  } catch (error) {
    console.warn('Auth initialization warning:', error);
    await clearStoredSession();
    updateAuthStatus('initialization_failed', error);
  }
}

// === EXPORTS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Auth, initAuth, AUTH_CONFIG };
} else {
  window.Auth = Auth;
  window.initAuth = initAuth;
  
  // Auto-inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }
}