/**
 * RainbowGold-Tap: Worldcoin Integration (lib/worldcoin.js)
 * Maneja World ID, WLD payments, y WorldApp específicamente
 */

// === CONFIGURACIÓN WORLDCOIN ===
const WORLDCOIN_CONFIG = {
  // App credentials
  APP_ID: 'app_staging_c8e24bc1de7bc2c3d2b6de7d2e8cf922',
  ACTION_ID: 'rainbow-tap-login',
  
  // URLs y endpoints
  WORLD_APP_URL: 'https://simulator.worldcoin.org',
  WORLD_ID_URL: 'https://id.worldcoin.org',
  
  // Backend endpoints
  ENDPOINTS: {
    VERIFY: '/api/worldcoin/verify',
    PAYMENT_INTENT: '/api/worldcoin/payment-intent',
    PAYMENT_CONFIRM: '/api/worldcoin/payment-confirm',
    BALANCE: '/api/worldcoin/balance',
    TRANSACTIONS: '/api/worldcoin/transactions'
  },

  // WLD payment config
  PAYMENTS: {
    REFILL_COST: 0.1,        // 0.1 WLD por refill
    IDEAS_TICKET_COST: 1.0,  // 1 WLD por ticket de ideas
    MIN_BALANCE: 0.001,      // Balance mínimo para mostrar opciones
    DECIMALS: 18             // WLD decimals
  },

  // Timeouts y configuración
  VERIFICATION_TIMEOUT: 30000,
  PAYMENT_TIMEOUT: 45000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000,

  // Storage keys específicos
  STORAGE: {
    WORLD_USER: 'wc_world_user',
    WLD_BALANCE: 'wc_wld_balance',
    VERIFICATION_STATE: 'wc_verification_state',
    PAYMENT_HISTORY: 'wc_payment_history',
    LAST_BALANCE_CHECK: 'wc_last_balance_check'
  },

  // Mensajes para UI
  MESSAGES: {
    es: {
      connecting: 'Conectando con World ID...',
      verifying: 'Verificando tu identidad...',
      verified: 'Identidad verificada ✓',
      payment_preparing: 'Preparando pago...',
      payment_confirm: 'Confirma el pago en tu wallet',
      payment_success: 'Pago completado ✓',
      payment_failed: 'Error en el pago',
      insufficient_balance: 'Saldo WLD insuficiente',
      balance_loading: 'Consultando saldo...',
      balance_error: 'Error al consultar saldo'
    },
    en: {
      connecting: 'Connecting to World ID...',
      verifying: 'Verifying your identity...',
      verified: 'Identity verified ✓',
      payment_preparing: 'Preparing payment...',
      payment_confirm: 'Confirm payment in your wallet',
      payment_success: 'Payment completed ✓',
      payment_failed: 'Payment error',
      insufficient_balance: 'Insufficient WLD balance',
      balance_loading: 'Loading balance...',
      balance_error: 'Balance loading error'
    }
  }
};

// === ESTADO WORLDCOIN ===
let worldState = {
  isVerified: false,
  isVerifying: false,
  user: null,
  wldBalance: 0,
  lastBalanceCheck: 0,
  paymentInProgress: false,
  retryCount: 0,
  deviceType: 'unknown' // 'world-app', 'mobile', 'desktop'
};

// === DETECCIÓN DE ENTORNO ===
function detectEnvironment() {
  // World App
  if (window.worldcoin || 
      navigator.userAgent.includes('WorldApp') ||
      window.location.href.includes('worldcoin.org')) {
    worldState.deviceType = 'world-app';
    return 'world-app';
  }

  // Mobile browser
  if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    worldState.deviceType = 'mobile';
    return 'mobile';
  }

  // Desktop
  worldState.deviceType = 'desktop';
  return 'desktop';
}

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

function formatWLD(amount) {
  return parseFloat(amount).toFixed(3);
}

function generateNonce() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

function emitEvent(eventName, data = null) {
  const event = new CustomEvent(`worldcoin_${eventName}`, {
    detail: { ...data, worldState: { ...worldState } }
  });
  window.dispatchEvent(event);
}

function getMessage(key, lang = 'es') {
  return WORLDCOIN_CONFIG.MESSAGES[lang]?.[key] || 
         WORLDCOIN_CONFIG.MESSAGES.es[key] || key;
}

// === WORLD ID VERIFICATION ===
async function initiateWorldIDVerification() {
  if (worldState.isVerifying) {
    console.warn('Verification already in progress');
    return worldState.user;
  }

  try {
    worldState.isVerifying = true;
    emitEvent('verification_start');

    const environment = detectEnvironment();
    console.log('Environment detected:', environment);

    let result;
    switch (environment) {
      case 'world-app':
        result = await verifyInWorldApp();
        break;
      case 'mobile':
        result = await verifyOnMobile();
        break;
      case 'desktop':
        result = await verifyOnDesktop();
        break;
      default:
        throw new Error('Unsupported environment');
    }

    return await processVerificationResult(result);

  } catch (error) {
    console.error('World ID verification error:', error);
    worldState.retryCount++;
    emitEvent('verification_error', { error: error.message });
    throw error;
  } finally {
    worldState.isVerifying = false;
  }
}

async function verifyInWorldApp() {
  // Verificación dentro de World App usando el bridge nativo
  if (!window.worldcoin) {
    throw new Error('World App bridge not available');
  }

  try {
    const result = await window.worldcoin.requestVerification({
      app_id: WORLDCOIN_CONFIG.APP_ID,
      action: WORLDCOIN_CONFIG.ACTION_ID,
      signal: generateNonce()
    });

    if (!result || !result.proof) {
      throw new Error('Invalid World ID proof received');
    }

    return result;
  } catch (error) {
    throw new Error(`World App verification failed: ${error.message}`);
  }
}

async function verifyOnMobile() {
  // Redirección a World App en móvil
  const verificationUrl = buildVerificationURL();
  
  // Guardar estado para el retorno
  setStorageItem('wc_verification_return_url', window.location.href);
  setStorageItem('wc_verification_nonce', generateNonce());
  
  // Intentar abrir World App primero
  const worldAppUrl = `worldcoin://verify?${new URLSearchParams({
    app_id: WORLDCOIN_CONFIG.APP_ID,
    action: WORLDCOIN_CONFIG.ACTION_ID,
    return_to: window.location.href
  })}`;

  // Intentar scheme de World App
  window.location.href = worldAppUrl;
  
  // Fallback a browser después de un delay
  setTimeout(() => {
    if (document.visibilityState === 'visible') {
      window.location.href = verificationUrl;
    }
  }, 2500);

  // Esta función no retorna - la verificación continúa en el callback
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Verification timeout'));
    }, WORLDCOIN_CONFIG.VERIFICATION_TIMEOUT);

    // Escuchar el retorno desde el callback
    window.addEventListener('worldcoin_verification_complete', (event) => {
      clearTimeout(timeout);
      if (event.detail.success) {
        resolve(event.detail.result);
      } else {
        reject(new Error(event.detail.error));
      }
    }, { once: true });
  });
}

async function verifyOnDesktop() {
  // Popup para desktop
  const verificationUrl = buildVerificationURL();
  
  const popup = window.open(
    verificationUrl,
    'world_id_verification',
    'width=400,height=600,scrollbars=yes,resizable=yes'
  );

  return new Promise((resolve, reject) => {
    if (!popup) {
      reject(new Error('Popup blocked'));
      return;
    }

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        reject(new Error('Verification popup was closed'));
      }
    }, 1000);

    const timeout = setTimeout(() => {
      clearInterval(checkClosed);
      if (!popup.closed) popup.close();
      reject(new Error('Verification timeout'));
    }, WORLDCOIN_CONFIG.VERIFICATION_TIMEOUT);

    // Escuchar mensaje del popup
    const messageHandler = (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'WORLD_ID_SUCCESS') {
        clearInterval(checkClosed);
        clearTimeout(timeout);
        window.removeEventListener('message', messageHandler);
        popup.close();
        resolve(event.data.payload);
      }
      
      if (event.data.type === 'WORLD_ID_ERROR') {
        clearInterval(checkClosed);
        clearTimeout(timeout);
        window.removeEventListener('message', messageHandler);
        popup.close();
        reject(new Error(event.data.error));
      }
    };

    window.addEventListener('message', messageHandler);
  });
}

function buildVerificationURL() {
  const params = new URLSearchParams({
    app_id: WORLDCOIN_CONFIG.APP_ID,
    action: WORLDCOIN_CONFIG.ACTION_ID,
    signal: generateNonce(),
    redirect_uri: `${window.location.origin}/worldcoin/callback`,
    response_type: 'code'
  });

  return `${WORLDCOIN_CONFIG.WORLD_ID_URL}/authorize?${params}`;
}

async function processVerificationResult(result) {
  try {
    emitEvent('verification_processing');

    // Verificar la prueba con el backend
    const verification = await verifyProofWithBackend(result);
    
    if (verification.success) {
      worldState.isVerified = true;
      worldState.user = verification.user;
      worldState.retryCount = 0;

      // Guardar datos del usuario
      setStorageItem(WORLDCOIN_CONFIG.STORAGE.WORLD_USER, JSON.stringify(verification.user));
      setStorageItem(WORLDCOIN_CONFIG.STORAGE.VERIFICATION_STATE, JSON.stringify({
        verified: true,
        timestamp: Date.now(),
        app_id: WORLDCOIN_CONFIG.APP_ID
      }));

      emitEvent('verification_success', { user: verification.user });

      // Consultar balance inicial
      setTimeout(() => updateWLDBalance(), 1000);

      return verification.user;
    } else {
      throw new Error('Backend verification failed: ' + verification.error);
    }
  } catch (error) {
    console.error('Verification processing error:', error);
    throw error;
  }
}

async function verifyProofWithBackend(proof) {
  try {
    const response = await fetch(WORLDCOIN_CONFIG.ENDPOINTS.VERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proof)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Backend verification error:', error);
    throw error;
  }
}

// === WLD BALANCE MANAGEMENT ===
async function updateWLDBalance(force = false) {
  const now = Date.now();
  const cacheTime = 60000; // 1 minuto de cache

  if (!force && (now - worldState.lastBalanceCheck) < cacheTime) {
    return worldState.wldBalance;
  }

  try {
    emitEvent('balance_loading');

    const token = window.Auth?.getToken?.();
    if (!token) {
      throw new Error('No auth token available');
    }

    const response = await fetch(WORLDCOIN_CONFIG.ENDPOINTS.BALANCE, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    worldState.wldBalance = parseFloat(data.balance || 0);
    worldState.lastBalanceCheck = now;

    // Guardar en localStorage
    setStorageItem(WORLDCOIN_CONFIG.STORAGE.WLD_BALANCE, worldState.wldBalance);
    setStorageItem(WORLDCOIN_CONFIG.STORAGE.LAST_BALANCE_CHECK, now);

    emitEvent('balance_updated', { balance: worldState.wldBalance });

    return worldState.wldBalance;
  } catch (error) {
    console.error('Balance update error:', error);
    emitEvent('balance_error', { error: error.message });
    
    // Fallback a localStorage
    const cached = parseFloat(getStorageItem(WORLDCOIN_CONFIG.STORAGE.WLD_BALANCE, '0'));
    worldState.wldBalance = cached;
    
    return cached;
  }
}

function getWLDBalance() {
  return worldState.wldBalance;
}

function hasSufficientBalance(amount) {
  return worldState.wldBalance >= amount;
}

// === WLD PAYMENTS ===
async function initiateWLDPayment(paymentType, amount, metadata = {}) {
  if (worldState.paymentInProgress) {
    throw new Error('Payment already in progress');
  }

  if (!worldState.isVerified) {
    throw new Error('World ID verification required');
  }

  if (!hasSufficientBalance(amount)) {
    throw new Error('Insufficient WLD balance');
  }

  try {
    worldState.paymentInProgress = true;
    emitEvent('payment_start', { type: paymentType, amount });

    // 1. Crear payment intent en el backend
    const paymentIntent = await createPaymentIntent({
      type: paymentType,
      amount,
      currency: 'WLD',
      metadata
    });

    // 2. Procesar pago según el entorno
    const environment = detectEnvironment();
    let paymentResult;

    switch (environment) {
      case 'world-app':
        paymentResult = await processPaymentInWorldApp(paymentIntent);
        break;
      case 'mobile':
      case 'desktop':
        paymentResult = await processPaymentInBrowser(paymentIntent);
        break;
      default:
        throw new Error('Unsupported payment environment');
    }

    // 3. Confirmar pago con el backend
    const confirmation = await confirmPayment(paymentIntent.id, paymentResult);

    if (confirmation.success) {
      // Actualizar balance local
      worldState.wldBalance -= amount;
      setStorageItem(WORLDCOIN_CONFIG.STORAGE.WLD_BALANCE, worldState.wldBalance);

      // Guardar en historial
      await savePaymentToHistory({
        id: confirmation.transaction_id,
        type: paymentType,
        amount,
        timestamp: Date.now(),
        status: 'completed'
      });

      emitEvent('payment_success', {
        type: paymentType,
        amount,
        transactionId: confirmation.transaction_id,
        newBalance: worldState.wldBalance
      });

      return confirmation;
    } else {
      throw new Error('Payment confirmation failed');
    }

  } catch (error) {
    console.error('Payment error:', error);
    emitEvent('payment_error', { 
      type: paymentType, 
      amount, 
      error: error.message 
    });
    throw error;
  } finally {
    worldState.paymentInProgress = false;
  }
}

async function createPaymentIntent(paymentData) {
  const token = window.Auth?.getToken?.();
  
  const response = await fetch(WORLDCOIN_CONFIG.ENDPOINTS.PAYMENT_INTENT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(paymentData)
  });

  if (!response.ok) {
    throw new Error(`Payment intent creation failed: ${response.status}`);
  }

  return await response.json();
}

async function processPaymentInWorldApp(paymentIntent) {
  if (!window.worldcoin) {
    throw new Error('World App bridge not available');
  }

  try {
    const result = await window.worldcoin.requestPayment({
      to: paymentIntent.recipient,
      amount: paymentIntent.amount.toString(),
      currency: 'WLD',
      reference: paymentIntent.id,
      description: paymentIntent.description
    });

    return result;
  } catch (error) {
    throw new Error(`World App payment failed: ${error.message}`);
  }
}

async function processPaymentInBrowser(paymentIntent) {
  // Para browser, usar WalletConnect o similar
  // Implementación simplificada - en producción usar WalletConnect
  
  if (!window.ethereum) {
    throw new Error('No wallet detected');
  }

  try {
    // Solicitar conexión de wallet
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    // Preparar transacción WLD
    const txParams = {
      to: paymentIntent.recipient,
      value: '0x0', // WLD es ERC-20, no ETH
      data: paymentIntent.transactionData,
      gas: paymentIntent.gasLimit,
      gasPrice: paymentIntent.gasPrice
    };

    // Enviar transacción
    const txHash = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [txParams]
    });

    return { transactionHash: txHash };
  } catch (error) {
    throw new Error(`Browser payment failed: ${error.message}`);
  }
}

async function confirmPayment(paymentIntentId, paymentResult) {
  const token = window.Auth?.getToken?.();
  
  const response = await fetch(WORLDCOIN_CONFIG.ENDPOINTS.PAYMENT_CONFIRM, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      payment_intent_id: paymentIntentId,
      payment_result: paymentResult
    })
  });

  if (!response.ok) {
    throw new Error(`Payment confirmation failed: ${response.status}`);
  }

  return await response.json();
}

// === PAYMENT HELPERS ===
async function payForRefill() {
  const cost = WORLDCOIN_CONFIG.PAYMENTS.REFILL_COST;
  
  return await initiateWLDPayment('refill', cost, {
    game_action: 'energy_refill',
    timestamp: Date.now()
  });
}

async function payForIdeasTicket() {
  const cost = WORLDCOIN_CONFIG.PAYMENTS.IDEAS_TICKET_COST;
  
  return await initiateWLDPayment('ideas_ticket', cost, {
    game_action: 'ideas_ticket',
    timestamp: Date.now()
  });
}

// === PAYMENT HISTORY ===
async function savePaymentToHistory(payment) {
  try {
    const history = getPaymentHistory();
    history.unshift(payment);
    
    // Mantener solo los últimos 100 pagos
    if (history.length > 100) {
      history.splice(100);
    }
    
    setStorageItem(WORLDCOIN_CONFIG.STORAGE.PAYMENT_HISTORY, JSON.stringify(history));
  } catch (error) {
    console.warn('Error saving payment to history:', error);
  }
}

function getPaymentHistory() {
  try {
    const stored = getStorageItem(WORLDCOIN_CONFIG.STORAGE.PAYMENT_HISTORY, '[]');
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Error loading payment history:', error);
    return [];
  }
}

// === SESSION MANAGEMENT ===
function loadStoredWorldcoinState() {
  try {
    // Cargar usuario verificado
    const storedUser = getStorageItem(WORLDCOIN_CONFIG.STORAGE.WORLD_USER);
    if (storedUser) {
      worldState.user = JSON.parse(storedUser);
      worldState.isVerified = true;
    }

    // Cargar balance
    const storedBalance = getStorageItem(WORLDCOIN_CONFIG.STORAGE.WLD_BALANCE, '0');
    worldState.wldBalance = parseFloat(storedBalance);

    // Cargar timestamp de última verificación de balance
    const lastCheck = getStorageItem(WORLDCOIN_CONFIG.STORAGE.LAST_BALANCE_CHECK, '0');
    worldState.lastBalanceCheck = parseInt(lastCheck);

    return worldState.isVerified;
  } catch (error) {
    console.warn('Error loading stored Worldcoin state:', error);
    return false;
  }
}

function clearWorldcoinState() {
  // Limpiar estado en memoria
  worldState = {
    isVerified: false,
    isVerifying: false,
    user: null,
    wldBalance: 0,
    lastBalanceCheck: 0,
    paymentInProgress: false,
    retryCount: 0,
    deviceType: 'unknown'
  };

  // Limpiar localStorage
  Object.values(WORLDCOIN_CONFIG.STORAGE).forEach(key => {
    localStorage.removeItem(key);
  });
}

// === API PÚBLICA ===
const Worldcoin = {
  // Estado
  get isVerified() { return worldState.isVerified; },
  get isVerifying() { return worldState.isVerifying; },
  get user() { return worldState.user; },
  get wldBalance() { return worldState.wldBalance; },
  get paymentInProgress() { return worldState.paymentInProgress; },
  get environment() { return worldState.deviceType; },

  // Métodos principales
  verify: initiateWorldIDVerification,
  updateBalance: updateWLDBalance,
  
  // Pagos
  pay: initiateWLDPayment,
  payForRefill,
  payForIdeasTicket,
  hasBalance: hasSufficientBalance,
  
  // Utilidades
  getBalance: getWLDBalance,
  getPaymentHistory,
  formatBalance: formatWLD,
  
  // Estado de sesión
  loadStoredState: loadStoredWorldcoinState,
  clearState: clearWorldcoinState,
  
  // Eventos
  on: (event, callback) => window.addEventListener(`worldcoin_${event}`, callback),
  off: (event, callback) => window.removeEventListener(`worldcoin_${event}`, callback),
  
  // Config
  config: WORLDCOIN_CONFIG
};

// === INICIALIZACIÓN ===
function initWorldcoin() {
  console.log('Initializing Worldcoin module...');
  
  // Detectar entorno
  detectEnvironment();
  
  // Cargar estado almacenado
  loadStoredWorldcoinState();
  
  // Si hay usuario verificado, actualizar balance
  if (worldState.isVerified) {
    // Esperar un poco para no sobrecargar
    setTimeout(() => updateWLDBalance(), 2000);
  }
  
  emitEvent('initialized');
}

// === EXPORTS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Worldcoin, initWorldcoin };
} else {
  window.Worldcoin = Worldcoin;
  window.initWorldcoin = initWorldcoin;
}

// Auto-inicializar
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWorldcoin);
  } else {
    setTimeout(initWorldcoin, 50);
  }
}