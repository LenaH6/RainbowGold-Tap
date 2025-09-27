/**
 * src/js/auth/siwe-handler.js - Manejador de Sign-In with Ethereum
 * Gestiona la autenticación SIWE y comunicación con backend
 */

// === CONFIGURACIÓN SIWE HANDLER ===
const SIWE_HANDLER_CONFIG = {
  // Endpoints del backend
  ENDPOINTS: {
    GET_NONCE: '/api/auth/siwe/nonce',
    VERIFY_SIWE: '/api/auth/siwe/verify',
    REFRESH_TOKEN: '/api/auth/siwe/refresh',
    LOGOUT: '/api/auth/siwe/logout'
  },

  // Configuración de mensajes SIWE
  SIWE_CONFIG: {
    DOMAIN: window.location.host,
    SCHEME: window.location.protocol.replace(':', ''),
    STATEMENT: 'Welcome to RainbowGold Tap! Sign in to access your game progress and WLD rewards.',
    VERSION: '1',
    CHAIN_ID: 1, // Ethereum mainnet
    RESOURCES: []
  },

  // Timeouts
  NONCE_TIMEOUT: 5 * 60 * 1000,      // 5 minutos
  SIGN_TIMEOUT: 2 * 60 * 1000,       // 2 minutos  
  VERIFY_TIMEOUT: 30 * 1000,         // 30 segundos
  
  // Estados
  STATES: {
    IDLE: 'idle',
    FETCHING_NONCE: 'fetching_nonce',
    WAITING_SIGNATURE: 'waiting_signature',
    VERIFYING: 'verifying',
    AUTHENTICATED: 'authenticated',
    ERROR: 'error'
  }
};

// === SIWE HANDLER CLASS ===
export class SIWEHandler extends EventTarget {
  constructor(options = {}) {
    super();
    
    this.options = {
      onStateChange: options.onStateChange || null,
      onError: options.onError || null,
      baseURL: options.baseURL || '',
      customEndpoints: options.customEndpoints || {}
    };

    this.state = {
      currentState: SIWE_HANDLER_CONFIG.STATES.IDLE,
      nonce: null,
      nonceExpiresAt: null,
      walletProvider: null,
      connectedAddress: null,
      lastError: null
    };
  }

  // === MÉTODOS PÚBLICOS ===

  /**
   * Inicia el proceso de autenticación SIWE
   */
  async authenticate(options = {}) {
    console.log('🔐 Iniciando autenticación SIWE...');
    
    try {
      this.setState(SIWE_HANDLER_CONFIG.STATES.FETCHING_NONCE);

      // Paso 1: Detectar y conectar wallet
      const wallet = await this.detectAndConnectWallet();
      if (!wallet.success) {
        throw new Error('Wallet connection failed: ' + wallet.error);
      }

      this.state.walletProvider = wallet.provider;
      this.state.connectedAddress = wallet.address;

      // Paso 2: Obtener nonce del backend
      const nonce = await this.fetchNonce();
      
      // Paso 3: Generar y firmar mensaje SIWE
      this.setState(SIWE_HANDLER_CONFIG.STATES.WAITING_SIGNATURE);
      const signature = await this.signSIWEMessage(nonce, options);
      
      // Paso 4: Verificar con backend
      this.setState(SIWE_HANDLER_CONFIG.STATES.VERIFYING);
      const verification = await this.verifySIWESignature(signature, options);
      
      if (verification.success) {
        this.setState(SIWE_HANDLER_CONFIG.STATES.AUTHENTICATED);
        
        console.log('✅ Autenticación SIWE completada');
        
        return {
          success: true,
          tokens: verification.tokens,
          user: verification.user,
          address: this.state.connectedAddress
        };
      } else {
        throw new Error('SIWE verification failed');
      }

    } catch (error) {
      console.error('❌ Error en autenticación SIWE:', error);
      this.setState(SIWE_HANDLER_CONFIG.STATES.ERROR);
      this.state.lastError = error;
      
      if (this.options.onError) {
        this.options.onError(error);
      }
      
      return {
        success: false,
        error: error.message || 'SIWE authentication failed'
      };
    }
  }

  /**
   * Refresca el token de autenticación
   */
  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('No refresh token provided');
    }

    try {
      console.log('🔄 Refrescando token SIWE...');

      const response = await this.makeRequest(
        SIWE_HANDLER_CONFIG.ENDPOINTS.REFRESH_TOKEN,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${refreshToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.success) {
        console.log('✅ Token SIWE refrescado');
        return response.tokens;
      } else {
        throw new Error(response.error || 'Token refresh failed');
      }

    } catch (error) {
      console.error('❌ Error refrescando token SIWE:', error);
      throw error;
    }
  }

  /**
   * Cierra sesión
   */
  async logout(accessToken = null) {
    try {
      console.log('🚪 Cerrando sesión SIWE...');

      if (accessToken) {
        await this.makeRequest(
          SIWE_HANDLER_CONFIG.ENDPOINTS.LOGOUT,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      // Limpiar estado local
      this.clearState();
      this.setState(SIWE_HANDLER_CONFIG.STATES.IDLE);

      console.log('✅ Sesión SIWE cerrada');

    } catch (error) {
      console.error('❌ Error cerrando sesión SIWE:', error);
    }
  }

  // === MÉTODOS PRIVADOS ===

  async detectAndConnectWallet() {
    try {
      console.log('👛 Detectando wallet...');

      // Verificar si hay un provider disponible
      let provider = null;
      
      // Ethereum provider (MetaMask, etc.)
      if (window.ethereum) {
        provider = window.ethereum;
        console.log('✅ Ethereum provider detectado');
      }
      // WalletConnect u otros providers
      else if (window.web3) {
        provider = window.web3.currentProvider;
        console.log('✅ Web3 provider detectado');
      }
      // World App embedded wallet
      else if (window.worldcoin?.ethereum) {
        provider = window.worldcoin.ethereum;
        console.log('✅ World App wallet detectado');
      }
      else {
        throw new Error('No wallet provider found');
      }

      // Solicitar conexión
      const accounts = await provider.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts available');
      }

      const address = accounts[0];
      console.log('✅ Wallet conectada:', address);

      return {
        success: true,
        provider,
        address: address.toLowerCase()
      };

    } catch (error) {
      console.error('❌ Error conectando wallet:', error);
      
      return {
        success: false,
        error: error.message || 'Wallet connection failed'
      };
    }
  }

  async fetchNonce() {
    try {
      console.log('🎲 Obteniendo nonce...');

      const response = await this.makeRequest(
        SIWE_HANDLER_CONFIG.ENDPOINTS.GET_NONCE,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        },
        SIWE_HANDLER_CONFIG.NONCE_TIMEOUT
      );

      if (response.success && response.nonce) {
        this.state.nonce = response.nonce;
        this.state.nonceExpiresAt = Date.now() + (response.expiresIn * 1000);
        
        console.log('✅ Nonce obtenido:', response.nonce);
        return response.nonce;
      } else {
        throw new Error(response.error || 'Failed to fetch nonce');
      }

    } catch (error) {
      console.error('❌ Error obteniendo nonce:', error);
      throw error;
    }
  }

  async signSIWEMessage(nonce, options = {}) {
    try {
      console.log('✍️ Firmando mensaje SIWE...');

      // Construir mensaje SIWE
      const message = this.buildSIWEMessage({
        address: this.state.connectedAddress,
        nonce,
        worldIdHash: options.worldIdHash
      });

      console.log('📝 Mensaje SIWE generado:', message);

      // Firmar mensaje
      const signature = await this.state.walletProvider.request({
        method: 'personal_sign',
        params: [message, this.state.connectedAddress]
      });

      console.log('✅ Mensaje firmado');

      return {
        message,
        signature,
        address: this.state.connectedAddress
      };

    } catch (error) {
      console.error('❌ Error firmando mensaje:', error);
      
      if (error.code === 4001) {
        throw new Error('User rejected signature request');
      } else {
        throw new Error('Failed to sign SIWE message: ' + error.message);
      }
    }
  }

  async verifySIWESignature(signatureData, options = {}) {
    try {
      console.log('🔍 Verificando firma SIWE...');

      const payload = {
        message: signatureData.message,
        signature: signatureData.signature,
        address: signatureData.address,
        worldIdHash: options.worldIdHash
      };

      const response = await this.makeRequest(
        SIWE_HANDLER_CONFIG.ENDPOINTS.VERIFY_SIWE,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        },
        SIWE_HANDLER_CONFIG.VERIFY_TIMEOUT
      );

      if (response.success) {
        console.log('✅ Firma SIWE verificada');
        return response;
      } else {
        throw new Error(response.error || 'SIWE verification failed');
      }

    } catch (error) {
      console.error('❌ Error verificando firma SIWE:', error);
      throw error;
    }
  }

  buildSIWEMessage(params) {
    const {
      address,
      nonce,
      worldIdHash = null
    } = params;

    const now = new Date();
    const expirationTime = new Date(now.getTime() + SIWE_HANDLER_CONFIG.SIGN_TIMEOUT);

    // Construir mensaje SIWE estándar
    let message = `${SIWE_HANDLER_CONFIG.SIWE_CONFIG.DOMAIN} wants you to sign in with your Ethereum account:\n`;
    message += `${address}\n\n`;
    message += `${SIWE_HANDLER_CONFIG.SIWE_CONFIG.STATEMENT}\n\n`;
    message += `URI: ${SIWE_HANDLER_CONFIG.SIWE_CONFIG.SCHEME}://${SIWE_HANDLER_CONFIG.SIWE_CONFIG.DOMAIN}\n`;
    message += `Version: ${SIWE_HANDLER_CONFIG.SIWE_CONFIG.VERSION}\n`;
    message += `Chain ID: ${SIWE_HANDLER_CONFIG.SIWE_CONFIG.CHAIN_ID}\n`;
    message += `Nonce: ${nonce}\n`;
    message += `Issued At: ${now.toISOString()}\n`;
    message += `Expiration Time: ${expirationTime.toISOString()}`;

    // Añadir World ID hash si está disponible
    if (worldIdHash) {
      message += `\nRequest ID: ${worldIdHash}`;
    }

    // Añadir recursos si están configurados
    if (SIWE_HANDLER_CONFIG.SIWE_CONFIG.RESOURCES.length > 0) {
      message += `\nResources:`;
      for (const resource of SIWE_HANDLER_CONFIG.SIWE_CONFIG.RESOURCES) {
        message += `\n- ${resource}`;
      }
    }

    return message;
  }

  // === UTILIDADES DE RED ===

  async makeRequest(endpoint, options = {}, timeout = 10000) {
    const fullURL = this.buildURL(endpoint);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(fullURL, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      console.error(`❌ Request failed [${endpoint}]:`, error);
      throw error;
    }
  }

  buildURL(endpoint) {
    const baseURL = this.options.baseURL || window.location.origin;
    const customEndpoint = this.options.customEndpoints[endpoint];
    
    const finalEndpoint = customEndpoint || endpoint;
    
    return baseURL + finalEndpoint;
  }

  // === GESTIÓN DE ESTADO ===

  setState(newState) {
    const oldState = this.state.currentState;
    this.state.currentState = newState;
    
    console.log(`🔄 SIWE State: ${oldState} → ${newState}`);
    
    if (this.options.onStateChange) {
      this.options.onStateChange(newState);
    }

    this.dispatchEvent(new CustomEvent('statechange', {
      detail: {
        oldState,
        newState,
        timestamp: Date.now()
      }
    }));
  }

  clearState() {
    this.state.nonce = null;
    this.state.nonceExpiresAt = null;
    this.state.walletProvider = null;
    this.state.connectedAddress = null;
    this.state.lastError = null;
  }

  // === GETTERS PÚBLICOS ===

  getCurrentState() {
    return this.state.currentState;
  }

  getConnectedAddress() {
    return this.state.connectedAddress;
  }

  isAuthenticated() {
    return this.state.currentState === SIWE_HANDLER_CONFIG.STATES.AUTHENTICATED;
  }

  hasValidNonce() {
    return this.state.nonce && 
           this.state.nonceExpiresAt && 
           Date.now() < this.state.nonceExpiresAt;
  }

  getLastError() {
    return this.state.lastError;
  }

  // === VALIDACIONES ===

  validateChainId(chainId) {
    return chainId === SIWE_HANDLER_CONFIG.SIWE_CONFIG.CHAIN_ID;
  }

  async getCurrentChainId() {
    if (!this.state.walletProvider) {
      return null;
    }

    try {
      const chainId = await this.state.walletProvider.request({
        method: 'eth_chainId'
      });
      
      return parseInt(chainId, 16);
    } catch (error) {
      console.error('❌ Error obteniendo chainId:', error);
      return null;
    }
  }

  async ensureCorrectChain() {
    try {
      const currentChainId = await this.getCurrentChainId();
      
      if (!this.validateChainId(currentChainId)) {
        console.log(`🔄 Cambiando a chain ${SIWE_HANDLER_CONFIG.SIWE_CONFIG.CHAIN_ID}...`);
        
        try {
          await this.state.walletProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{
              chainId: `0x${SIWE_HANDLER_CONFIG.SIWE_CONFIG.CHAIN_ID.toString(16)}`
            }]
          });
          
          console.log('✅ Chain cambiado exitosamente');
          return true;
          
        } catch (switchError) {
          if (switchError.code === 4902) {
            throw new Error('Please add Ethereum mainnet to your wallet');
          }
          throw switchError;
        }
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Error verificando chain:', error);
      throw new Error('Chain validation failed: ' + error.message);
    }
  }

  // === EVENTOS DE WALLET ===

  setupWalletListeners() {
    if (!this.state.walletProvider) return;

    // Cambio de cuentas
    this.state.walletProvider.on('accountsChanged', (accounts) => {
      console.log('👛 Accounts changed:', accounts);
      
      if (accounts.length === 0) {
        console.log('👛 Wallet desconectado');
        this.clearState();
        this.setState(SIWE_HANDLER_CONFIG.STATES.IDLE);
      } else if (accounts[0].toLowerCase() !== this.state.connectedAddress) {
        console.log('👛 Cuenta cambiada');
        this.state.connectedAddress = accounts[0].toLowerCase();
      }
    });

    // Cambio de chain
    this.state.walletProvider.on('chainChanged', (chainId) => {
      console.log('🔗 Chain changed:', chainId);
      
      const newChainId = parseInt(chainId, 16);
      if (!this.validateChainId(newChainId)) {
        console.warn('⚠️ Chain no soportada:', newChainId);
      }
    });

    // Conexión/desconexión
    this.state.walletProvider.on('connect', (connectInfo) => {
      console.log('👛 Wallet conectado:', connectInfo);
    });

    this.state.walletProvider.on('disconnect', (error) => {
      console.log('👛 Wallet desconectado:', error);
      this.clearState();
      this.setState(SIWE_HANDLER_CONFIG.STATES.IDLE);
    });
  }

  removeWalletListeners() {
    if (!this.state.walletProvider || !this.state.walletProvider.removeAllListeners) return;

    try {
      this.state.walletProvider.removeAllListeners('accountsChanged');
      this.state.walletProvider.removeAllListeners('chainChanged');
      this.state.walletProvider.removeAllListeners('connect');
      this.state.walletProvider.removeAllListeners('disconnect');
    } catch (error) {
      console.warn('⚠️ Error removiendo listeners:', error);
    }
  }

  // === UTILIDADES DE DEBUG ===

  getDebugInfo() {
    return {
      state: this.state.currentState,
      hasNonce: !!this.state.nonce,
      nonceExpiresAt: this.state.nonceExpiresAt,
      connectedAddress: this.state.connectedAddress,
      hasWalletProvider: !!this.state.walletProvider,
      lastError: this.state.lastError?.message || null,
      config: SIWE_HANDLER_CONFIG
    };
  }

  // === CLEANUP ===

  destroy() {
    console.log('🧹 Destruyendo SIWEHandler...');
    
    this.removeWalletListeners();
    this.clearState();
    this.setState(SIWE_HANDLER_CONFIG.STATES.IDLE);
  }
}

// === UTILIDADES EXPORTADAS ===

export function createSIWEMessage(params) {
  const handler = new SIWEHandler();
  return handler.buildSIWEMessage(params);
}

export function validateSIWEMessage(message, expectedParams) {
  try {
    // Validación básica del formato SIWE
    const lines = message.split('\n');
    
    if (lines.length < 8) return false;
    
    const addressLine = lines[1];
    const domainLine = lines[0];
    
    return addressLine.match(/^0x[a-fA-F0-9]{40}$/) && 
           domainLine.includes(expectedParams.domain);
           
  } catch (error) {
    console.error('❌ Error validando mensaje SIWE:', error);
    return false;
  }
}

// === EXPORTS ===
export { SIWE_HANDLER_CONFIG };
export default SIWEHandler;