/**
 * src/js/auth/worldcoin-auth.js - Frontend Worldcoin Authentication
 * Maneja la integración con World ID desde el lado del cliente
 */

// === CONFIGURACIÓN WORLDCOIN ===
const WORLDCOIN_CONFIG = {
  // Configuración de la app
  APP_ID: 'app_staging_c8e24bc1de7bc2c3d2b6de7d2e8cf922',
  ACTION: 'login',
  
  // URLs del ecosistema Worldcoin
  URLS: {
    WORLD_APP: 'https://simulator.worldcoin.org',
    BRIDGE: 'https://bridge.worldcoin.org',
    API: 'https://developer.worldcoin.org/api/v1',
    SIMULATOR: 'https://simulator.worldcoin.org/id'
  },
  
  // Configuración de verificación
  VERIFICATION: {
    LEVEL: 'orb', // orb | device
    INCLUDE_CREDENTIAL: true,
    INCLUDE_MERKLE_PROOF: true,
    ACTION_DESCRIPTION: 'Sign in to RainbowGold Tap'
  },
  
  // Timeouts y reintentos
  TIMEOUTS: {
    POPUP: 60000,           // 60s
    BRIDGE_RESPONSE: 30000, // 30s
    POLLING: 1000           // 1s
  },
  
  // Estados de autenticación
  STATES: {
    IDLE: 'idle',
    CONNECTING: 'connecting',
    WAITING_USER: 'waiting_user',
    VERIFYING: 'verifying',
    SUCCESS: 'success',
    ERROR: 'error',
    CANCELLED: 'cancelled'
  }
};

// === ESTADO GLOBAL ===
let worldcoinState = {
  currentState: WORLDCOIN_CONFIG.STATES.IDLE,
  isInitialized: false,
  popup: null,
  bridgeId: null,
  verificationResult: null,
  error: null,
  callbacks: {}
};

// === DETECCIÓN DE ENTORNO ===
function getEnvironment() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isWorldApp = userAgent.includes('worldapp') || 
                     window.worldcoin || 
                     window.parent !== window;
  
  return {
    isWorldApp,
    isMobile: /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent),
    isDesktop: !(/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)),
    supportsPopups: !isWorldApp,
    protocol: window.location.protocol,
    origin: window.location.origin
  };
}

// === GENERACIÓN DE PARÁMETROS ===
function generateSignal() {
  // Signal único para esta sesión de autenticación
  return `${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

function generateNonce() {
  // Nonce criptográficamente seguro
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// === CONSTRUCCIÓN DE URLs ===
function buildAuthURL(params = {}) {
  const env = getEnvironment();
  const baseUrl = env.isWorldApp ? 
    `${WORLDCOIN_CONFIG.URLS.WORLD_APP}/verify` :
    `${WORLDCOIN_CONFIG.URLS.SIMULATOR}/${WORLDCOIN_CONFIG.APP_ID}`;
  
  const authParams = {
    app_id: WORLDCOIN_CONFIG.APP_ID,
    action: params.action || WORLDCOIN_CONFIG.ACTION,
    signal: params.signal || generateSignal(),
    verification_level: WORLDCOIN_CONFIG.VERIFICATION.LEVEL,
    ...params
  };
  
  const urlParams = new URLSearchParams(authParams);
  return `${baseUrl}?${urlParams}`;
}

function buildCallbackURL() {
  return `${window.location.origin}/auth/worldcoin-callback`;
}

// === MANEJO DE POPUP ===
async function openWorldcoinPopup(authUrl) {
  const env = getEnvironment();
  
  if (!env.supportsPopups) {
    throw new Error('Popups not supported in this environment');
  }
  
  const popupFeatures = [
    'width=400',
    'height=600', 
    'left=' + (window.screenX + (window.outerWidth - 400) / 2),
    'top=' + (window.screenY + (window.outerHeight - 600) / 2),
    'toolbar=no',
    'menubar=no',
    'scrollbars=yes',
    'resizable=yes',
    'status=no'
  ].join(',');
  
  const popup = window.open(authUrl, 'worldcoin_auth', popupFeatures);
  
  if (!popup || popup.closed) {
    throw new Error('Failed to open authentication popup');
  }
  
  return popup;
}

function monitorPopup(popup) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Authentication timeout'));
    }, WORLDCOIN_CONFIG.TIMEOUTS.POPUP);
    
    const pollTimer = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error('Authentication popup was closed'));
      }
    }, WORLDCOIN_CONFIG.TIMEOUTS.POLLING);
    
    const cleanup = () => {
      clearTimeout(timeout);
      clearInterval(pollTimer);
      window.removeEventListener('message', messageHandler);
      if (!popup.closed) {
        popup.close();
      }
    };
    
    const messageHandler = (event) => {
      // Validar origen del mensaje
      if (event.origin !== WORLDCOIN_CONFIG.URLS.WORLD_APP && 
          event.origin !== WORLDCOIN_CONFIG.URLS.SIMULATOR &&
          event.origin !== window.location.origin) {
        return;
      }
      
      if (event.data.type === 'worldcoin_auth_success') {
        cleanup();
        resolve(event.data.payload);
      } else if (event.data.type === 'worldcoin_auth_error') {
        cleanup();
        reject(new Error(event.data.error || 'Authentication failed'));
      }
    };
    
    window.addEventListener('message', messageHandler);
  });
}

// === INTEGRACIÓN WORLD APP NATIVA ===
async function authenticateWorldApp(params = {}) {
  if (!window.worldcoin) {
    throw new Error('World App bridge not available');
  }
  
  const authParams = {
    app_id: WORLDCOIN_CONFIG.APP_ID,
    action: params.action || WORLDCOIN_CONFIG.ACTION,
    signal: params.signal || generateSignal(),
    verification_level: WORLDCOIN_CONFIG.VERIFICATION.LEVEL,
    action_description: WORLDCOIN_CONFIG.VERIFICATION.ACTION_DESCRIPTION
  };
  
  try {
    const result = await window.worldcoin.request({
      method: 'worldcoin_verify',
      params: authParams
    });
    
    if (!result || !result.proof) {
      throw new Error('Invalid verification result');
    }
    
    return result;
  } catch (error) {
    throw new Error(`World App authentication failed: ${error.message}`);
  }
}

// === AUTENTICACIÓN POPUP/WEB ===
async function authenticateWebPopup(params = {}) {
  const authUrl = buildAuthURL({
    ...params,
    redirect_uri: buildCallbackURL()
  });
  
  const popup = await openWorldcoinPopup(authUrl);
  worldcoinState.popup = popup;
  
  try {
    const result = await monitorPopup(popup);
    return result;
  } finally {
    worldcoinState.popup = null;
  }
}

// === VERIFICACIÓN DEL RESULTADO ===
async function verifyWorldcoinProof(proof) {
  try {
    const response = await fetch('/api/auth/worldcoin/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        proof: proof.proof,
        merkle_root: proof.merkle_root,
        nullifier_hash: proof.nullifier_hash,
        verification_level: proof.verification_level,
        action: WORLDCOIN_CONFIG.ACTION,
        signal: proof.signal
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Verification failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Verification failed');
    }
    
    return result;
  } catch (error) {
    console.error('Proof verification error:', error);
    throw error;
  }
}

// === API PRINCIPAL ===

/**
 * Inicializa el sistema de autenticación Worldcoin
 */
export function initWorldcoinAuth(callbacks = {}) {
  worldcoinState.callbacks = {
    onStateChange: callbacks.onStateChange || (() => {}),
    onSuccess: callbacks.onSuccess || (() => {}),
    onError: callbacks.onError || (() => {}),
    onCancel: callbacks.onCancel || (() => {})
  };
  
  worldcoinState.isInitialized = true;
  
  console.log('🌍 Worldcoin Auth initialized');
  
  return {
    isSupported: checkWorldcoinSupport(),
    environment: getEnvironment(),
    config: WORLDCOIN_CONFIG
  };
}

/**
 * Verifica si Worldcoin es soportado en el entorno actual
 */
export function checkWorldcoinSupport() {
  const env = getEnvironment();
  
  return {
    supported: true, // Siempre soportado via popup
    native: !!window.worldcoin,
    popup: env.supportsPopups,
    mobile: env.isMobile,
    worldApp: env.isWorldApp
  };
}

/**
 * Autentica usuario con World ID
 */
export async function authenticateWithWorldcoin(options = {}) {
  if (!worldcoinState.isInitialized) {
    throw new Error('Worldcoin auth not initialized');
  }
  
  const params = {
    action: options.action || WORLDCOIN_CONFIG.ACTION,
    signal: options.signal || generateSignal(),
    verification_level: options.verificationLevel || WORLDCOIN_CONFIG.VERIFICATION.LEVEL
  };
  
  try {
    // Cambiar estado
    setState(WORLDCOIN_CONFIG.STATES.CONNECTING);
    
    const env = getEnvironment();
    let authResult;
    
    // Elegir método de autenticación
    if (env.isWorldApp && window.worldcoin) {
      console.log('🌍 Using World App native authentication');
      authResult = await authenticateWorldApp(params);
    } else if (env.supportsPopups) {
      console.log('🌍 Using popup authentication');
      setState(WORLDCOIN_CONFIG.STATES.WAITING_USER);
      authResult = await authenticateWebPopup(params);
    } else {
      throw new Error('No suitable authentication method available');
    }
    
    if (!authResult || !authResult.proof) {
      throw new Error('Authentication failed: No proof received');
    }
    
    // Verificar proof con el backend
    setState(WORLDCOIN_CONFIG.STATES.VERIFYING);
    const verification = await verifyWorldcoinProof(authResult);
    
    if (!verification.success) {
      throw new Error('Proof verification failed');
    }
    
    // Éxito
    worldcoinState.verificationResult = verification;
    setState(WORLDCOIN_CONFIG.STATES.SUCCESS);
    
    worldcoinState.callbacks.onSuccess({
      proof: authResult,
      verification: verification,
      user: verification.user
    });
    
    return {
      success: true,
      proof: authResult,
      verification: verification,
      user: verification.user
    };
    
  } catch (error) {
    console.error('Worldcoin authentication error:', error);
    
    worldcoinState.error = error.message;
    setState(WORLDCOIN_CONFIG.STATES.ERROR);
    
    worldcoinState.callbacks.onError(error);
    
    throw error;
  }
}

/**
 * Cancela autenticación en curso
 */
export function cancelAuthentication() {
  if (worldcoinState.popup && !worldcoinState.popup.closed) {
    worldcoinState.popup.close();
  }
  
  setState(WORLDCOIN_CONFIG.STATES.CANCELLED);
  worldcoinState.callbacks.onCancel();
}

/**
 * Obtiene el estado actual de la autenticación
 */
export function getAuthState() {
  return {
    state: worldcoinState.currentState,
    isInitialized: worldcoinState.isInitialized,
    hasActiveSession: worldcoinState.currentState === WORLDCOIN_CONFIG.STATES.SUCCESS,
    verificationResult: worldcoinState.verificationResult,
    error: worldcoinState.error
  };
}

/**
 * Resetea el estado de autenticación
 */
export function resetAuthState() {
  worldcoinState.currentState = WORLDCOIN_CONFIG.STATES.IDLE;
  worldcoinState.verificationResult = null;
  worldcoinState.error = null;
  worldcoinState.bridgeId = null;
  
  if (worldcoinState.popup && !worldcoinState.popup.closed) {
    worldcoinState.popup.close();
  }
  worldcoinState.popup = null;
}

// === UTILIDADES INTERNAS ===
function setState(newState) {
  const oldState = worldcoinState.currentState;
  worldcoinState.currentState = newState;
  
  console.log(`🌍 Worldcoin Auth: ${oldState} → ${newState}`);
  
  worldcoinState.callbacks.onStateChange({
    oldState,
    newState,
    timestamp: Date.now()
  });
}

// === MANEJO DE CALLBACK ===
/**
 * Procesa callback de autenticación (para redirect flow)
 */
export function handleAuthCallback(urlParams) {
  try {
    const params = new URLSearchParams(urlParams);
    
    if (params.get('error')) {
      throw new Error(params.get('error_description') || params.get('error'));
    }
    
    const proof = {
      proof: params.get('proof'),
      merkle_root: params.get('merkle_root'),
      nullifier_hash: params.get('nullifier_hash'),
      verification_level: params.get('verification_level'),
      action: params.get('action'),
      signal: params.get('signal')
    };
    
    // Enviar resultado al parent window
    if (window.opener) {
      window.opener.postMessage({
        type: 'worldcoin_auth_success',
        payload: proof
      }, window.location.origin);
      
      window.close();
    }
    
    return proof;
    
  } catch (error) {
    console.error('Callback handling error:', error);
    
    if (window.opener) {
      window.opener.postMessage({
        type: 'worldcoin_auth_error',
        error: error.message
      }, window.location.origin);
      
      window.close();
    }
    
    throw error;
  }
}

// === EVENTOS Y UTILIDADES ===

/**
 * Registra event listeners para callbacks externos
 */
export function onAuthStateChange(callback) {
  const handler = (event) => {
    if (event.type === 'worldcoin_state_change') {
      callback(event.detail);
    }
  };
  
  window.addEventListener('worldcoin_state_change', handler);
  
  return () => {
    window.removeEventListener('worldcoin_state_change', handler);
  };
}

/**
 * Verifica si hay una sesión válida guardada
 */
export function hasValidSession() {
  try {
    const stored = localStorage.getItem('worldcoin_session');
    if (!stored) return false;
    
    const session = JSON.parse(stored);
    const now = Date.now();
    
    return session.expires_at > now && session.verification;
  } catch (error) {
    return false;
  }
}

/**
 * Guarda sesión de autenticación
 */
export function saveSession(verification, expiresInMs = 24 * 60 * 60 * 1000) {
  try {
    const session = {
      verification,
      created_at: Date.now(),
      expires_at: Date.now() + expiresInMs
    };
    
    localStorage.setItem('worldcoin_session', JSON.stringify(session));
    return true;
  } catch (error) {
    console.warn('Failed to save session:', error);
    return false;
  }
}

/**
 * Carga sesión guardada
 */
export function loadSession() {
  try {
    const stored = localStorage.getItem('worldcoin_session');
    if (!stored) return null;
    
    const session = JSON.parse(stored);
    
    if (session.expires_at <= Date.now()) {
      clearSession();
      return null;
    }
    
    return session;
  } catch (error) {
    clearSession();
    return null;
  }
}

/**
 * Limpia sesión guardada
 */
export function clearSession() {
  try {
    localStorage.removeItem('worldcoin_session');
    return true;
  } catch (error) {
    console.warn('Failed to clear session:', error);
    return false;
  }
}

// === DEBUGGING ===
/**
 * Información de debug
 */
export function getDebugInfo() {
  return {
    state: worldcoinState,
    environment: getEnvironment(),
    support: checkWorldcoinSupport(),
    config: WORLDCOIN_CONFIG,
    session: hasValidSession() ? 'valid' : 'invalid'
  };
}

// === EXPORTACIÓN POR DEFECTO ===
export default {
  // Inicialización
  init: initWorldcoinAuth,
  checkSupport: checkWorldcoinSupport,
  
  // Autenticación
  authenticate: authenticateWithWorldcoin,
  cancel: cancelAuthentication,
  
  // Estado
  getState: getAuthState,
  reset: resetAuthState,
  
  // Callback handling
  handleCallback: handleAuthCallback,
  
  // Sesión
  hasValidSession,
  saveSession,
  loadSession,
  clearSession,
  
  // Eventos
  onStateChange: onAuthStateChange,
  
  // Debug
  debug: getDebugInfo,
  
  // Constantes
  STATES: WORLDCOIN_CONFIG.STATES,
  CONFIG: WORLDCOIN_CONFIG
};

// === AUTO-INICIALIZACIÓN EN CALLBACK PAGES ===
// Si estamos en una página de callback, procesarla automáticamente
if (typeof window !== 'undefined' && window.location.search.includes('proof=')) {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      handleAuthCallback(window.location.search);
    } catch (error) {
      console.error('Auto callback handling failed:', error);
    }
  });
}