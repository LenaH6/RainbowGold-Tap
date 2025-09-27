/**
 * src/js/auth/auth-manager.js - Gestor Principal de Autenticación
 * Orquesta World ID + SIWE + gestión de sesión para WorldApp
 */

import { SIWEHandler } from './siwe-handler.js';
import { WorldcoinAuth } from './worldcoin-auth.js';

// === CONFIGURACIÓN AUTH MANAGER ===
const AUTH_MANAGER_CONFIG = {
  // Estados de autenticación
  STATES: {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    WORLD_ID_PENDING: 'world_id_pending',
    SIWE_PENDING: 'siwe_pending',
    AUTHENTICATED: 'authenticated',
    ERROR: 'error'
  },

  // Timeouts
  CONNECTION_TIMEOUT: 60000,    // 1 minuto
  AUTO_REFRESH_MARGIN: 5 * 60 * 1000, // 5 minutos antes de expirar
  HEARTBEAT_INTERVAL: 30000,    // 30 segundos

  // Storage keys
  STORAGE: {
    AUTH_STATE: 'auth_manager_state',
    LAST_CONNECTION: 'auth_last_connection',
    USER_PREFERENCES: 'auth_user_preferences'
  },

  // Eventos
  EVENTS: {
    STATE_CHANGE: 'auth_state_change',
    USER_AUTHENTICATED: 'user_authenticated',
    USER_DISCONNECTED: 'user_disconnected',
    ERROR: 'auth_error',
    REFRESH_SUCCESS: 'auth_refresh_success',
    HEARTBEAT: 'auth_heartbeat'
  }
};

// === AUTH MANAGER CLASS ===
class AuthManager extends EventTarget {
  constructor() {
    super();
    
    this.state = {
      currentState: AUTH_MANAGER_CONFIG.STATES.DISCONNECTED,
      isInitialized: false,
      user: null,
      tokens: null,
      worldIdData: null,
      walletAddress: null,
      connectionStartTime: null,
      lastHeartbeat: null
    };

    this.siweHandler = null;
    this.worldcoinAuth = null;
    this.refreshTimer = null;
    this.heartbeatTimer = null;
    this.connectionTimeout = null;

    this.init();
  }

  // === INICIALIZACIÓN ===
  async init() {
    console.log('🔐 Inicializando AuthManager...');
    
    try {
      // Inicializar handlers
      this.siweHandler = new SIWEHandler({
        onStateChange: (state) => this.handleSIWEStateChange(state),
        onError: (error) => this.handleError('SIWE', error)
      });

      this.worldcoinAuth = new WorldcoinAuth({
        onStateChange: (state) => this.handleWorldcoinStateChange(state),
        onError: (error) => this.handleError('Worldcoin', error)
      });

      // Cargar estado persistente
      await this.loadPersistedState();

      // Configurar auto-refresh si hay sesión activa
      if (this.state.tokens && this.isTokenValid()) {
        this.setupAutoRefresh();
      }

      // Iniciar heartbeat
      this.startHeartbeat();

      this.state.isInitialized = true;
      
      console.log('✅ AuthManager inicializado');
      this.emitStateChange();

    } catch (error) {
      console.error('❌ Error inicializando AuthManager:', error);
      this.setState(AUTH_MANAGER_CONFIG.STATES.ERROR);
      this.handleError('Init', error);
    }
  }

  // === MÉTODOS PÚBLICOS PRINCIPALES ===

  /**
   * Inicia el proceso de autenticación completo
   */
  async connect() {
    if (this.state.currentState === AUTH_MANAGER_CONFIG.STATES.CONNECTING) {
      console.log('⚠️ Conexión ya en progreso');
      return;
    }

    try {
      console.log('🚀 Iniciando proceso de autenticación...');
      
      this.setState(AUTH_MANAGER_CONFIG.STATES.CONNECTING);
      this.state.connectionStartTime = Date.now();
      
      // Timeout de seguridad
      this.connectionTimeout = setTimeout(() => {
        this.handleError('Timeout', new Error('Connection timeout'));
      }, AUTH_MANAGER_CONFIG.CONNECTION_TIMEOUT);

      // Paso 1: World ID Verification
      await this.authenticateWithWorldId();

    } catch (error) {
      console.error('❌ Error en connect():', error);
      this.handleError('Connection', error);
    }
  }

  /**
   * Desconecta al usuario
   */
  async disconnect() {
    console.log('🔌 Desconectando usuario...');
    
    try {
      // Limpiar timers
      this.clearTimers();

      // Notificar a handlers
      if (this.siweHandler) {
        await this.siweHandler.logout();
      }
      
      if (this.worldcoinAuth) {
        await this.worldcoinAuth.disconnect();
      }

      // Limpiar estado
      this.clearState();
      
      // Emitir eventos
      this.dispatchEvent(new CustomEvent(AUTH_MANAGER_CONFIG.EVENTS.USER_DISCONNECTED));
      this.setState(AUTH_MANAGER_CONFIG.STATES.DISCONNECTED);

      console.log('✅ Usuario desconectado');

    } catch (error) {
      console.error('❌ Error en disconnect():', error);
    }
  }

  /**
   * Refresca tokens automáticamente
   */
  async refreshAuthentication() {
    if (!this.state.tokens || !this.isRefreshable()) {
      console.log('⚠️ No hay tokens para refrescar');
      return false;
    }

    try {
      console.log('🔄 Refrescando autenticación...');
      
      const newTokens = await this.siweHandler.refreshToken(this.state.tokens.refresh);
      
      if (newTokens) {
        this.state.tokens = newTokens;
        await this.persistState();
        this.setupAutoRefresh();
        
        console.log('✅ Autenticación refrescada');
        this.dispatchEvent(new CustomEvent(AUTH_MANAGER_CONFIG.EVENTS.REFRESH_SUCCESS));
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Error refrescando autenticación:', error);
      this.handleError('Refresh', error);
      return false;
    }
  }

  // === GETTERS PÚBLICOS ===
  isConnected() {
    return this.state.currentState === AUTH_MANAGER_CONFIG.STATES.AUTHENTICATED;
  }

  isConnecting() {
    return this.state.currentState === AUTH_MANAGER_CONFIG.STATES.CONNECTING ||
           this.state.currentState === AUTH_MANAGER_CONFIG.STATES.WORLD_ID_PENDING ||
           this.state.currentState === AUTH_MANAGER_CONFIG.STATES.SIWE_PENDING;
  }

  getUser() {
    return this.state.user;
  }

  getWalletAddress() {
    return this.state.walletAddress;
  }

  getAccessToken() {
    return this.state.tokens?.access || null;
  }

  getAuthState() {
    return {
      state: this.state.currentState,
      isConnected: this.isConnected(),
      isConnecting: this.isConnecting(),
      user: this.state.user,
      walletAddress: this.state.walletAddress,
      worldIdVerified: !!this.state.worldIdData,
      lastHeartbeat: this.state.lastHeartbeat,
      connectionTime: this.state.connectionStartTime
    };
  }

  // === MÉTODOS PRIVADOS - FLUJO DE AUTENTICACIÓN ===

  async authenticateWithWorldId() {
    console.log('🌍 Paso 1: Autenticación World ID');
    this.setState(AUTH_MANAGER_CONFIG.STATES.WORLD_ID_PENDING);

    try {
      const worldIdResult = await this.worldcoinAuth.verify();
      
      if (worldIdResult.success) {
        this.state.worldIdData = worldIdResult.data;
        console.log('✅ World ID verificado');
        
        // Continuar con SIWE
        await this.authenticateWithSIWE();
      } else {
        throw new Error('World ID verification failed');
      }

    } catch (error) {
      console.error('❌ Error en World ID:', error);
      throw error;
    }
  }

  async authenticateWithSIWE() {
    console.log('🔐 Paso 2: Autenticación SIWE');
    this.setState(AUTH_MANAGER_CONFIG.STATES.SIWE_PENDING);

    try {
      const siweResult = await this.siweHandler.authenticate({
        worldIdHash: this.state.worldIdData?.nullifier_hash
      });

      if (siweResult.success) {
        this.state.tokens = siweResult.tokens;
        this.state.user = siweResult.user;
        this.state.walletAddress = siweResult.address;

        console.log('✅ SIWE completado');
        
        // Autenticación completa
        await this.completeAuthentication();
      } else {
        throw new Error('SIWE authentication failed');
      }

    } catch (error) {
      console.error('❌ Error en SIWE:', error);
      throw error;
    }
  }

  async completeAuthentication() {
    console.log('🎉 Completando autenticación...');
    
    try {
      // Limpiar timeout de conexión
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }

      // Persistir estado
      await this.persistState();

      // Configurar auto-refresh
      this.setupAutoRefresh();

      // Estado final
      this.setState(AUTH_MANAGER_CONFIG.STATES.AUTHENTICATED);
      
      // Emitir evento de éxito
      this.dispatchEvent(new CustomEvent(AUTH_MANAGER_CONFIG.EVENTS.USER_AUTHENTICATED, {
        detail: {
          user: this.state.user,
          walletAddress: this.state.walletAddress,
          worldIdData: this.state.worldIdData
        }
      }));

      const connectionTime = Date.now() - this.state.connectionStartTime;
      console.log(`✅ Autenticación completa en ${connectionTime}ms`);

    } catch (error) {
      console.error('❌ Error completando autenticación:', error);
      throw error;
    }
  }

  // === MANEJO DE EVENTOS DE HANDLERS ===

  handleSIWEStateChange(siweState) {
    console.log('🔐 SIWE State Change:', siweState);
    // Lógica adicional según el estado de SIWE
  }

  handleWorldcoinStateChange(worldcoinState) {
    console.log('🌍 Worldcoin State Change:', worldcoinState);
    // Lógica adicional según el estado de Worldcoin
  }

  handleError(source, error) {
    console.error(`❌ Auth Error [${source}]:`, error);
    
    // Limpiar timers
    this.clearTimers();
    
    // Establecer estado de error
    this.setState(AUTH_MANAGER_CONFIG.STATES.ERROR);
    
    // Emitir evento de error
    this.dispatchEvent(new CustomEvent(AUTH_MANAGER_CONFIG.EVENTS.ERROR, {
      detail: {
        source,
        error: error.message || error,
        timestamp: Date.now()
      }
    }));
  }

  // === GESTIÓN DE ESTADO ===

  setState(newState) {
    const oldState = this.state.currentState;
    this.state.currentState = newState;
    
    console.log(`🔄 Auth State: ${oldState} → ${newState}`);
    this.emitStateChange();
  }

  emitStateChange() {
    this.dispatchEvent(new CustomEvent(AUTH_MANAGER_CONFIG.EVENTS.STATE_CHANGE, {
      detail: this.getAuthState()
    }));
  }

  clearState() {
    this.state.user = null;
    this.state.tokens = null;
    this.state.worldIdData = null;
    this.state.walletAddress = null;
    this.state.connectionStartTime = null;
    
    this.clearPersistedState();
  }

  // === PERSISTENCIA ===

  async loadPersistedState() {
    try {
      const storedState = localStorage.getItem(AUTH_MANAGER_CONFIG.STORAGE.AUTH_STATE);
      
      if (storedState) {
        const parsed = JSON.parse(storedState);
        
        // Validar que no esté expirado
        if (parsed.tokens && this.isTokenValid(parsed.tokens)) {
          this.state.tokens = parsed.tokens;
          this.state.user = parsed.user;
          this.state.walletAddress = parsed.walletAddress;
          this.state.worldIdData = parsed.worldIdData;
          
          console.log('📁 Estado persistente cargado');
          this.setState(AUTH_MANAGER_CONFIG.STATES.AUTHENTICATED);
          
          return true;
        } else {
          console.log('⚠️ Estado persistente expirado');
          this.clearPersistedState();
        }
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ Error cargando estado persistente:', error);
      this.clearPersistedState();
      return false;
    }
  }

  async persistState() {
    try {
      const stateToSave = {
        tokens: this.state.tokens,
        user: this.state.user,
        walletAddress: this.state.walletAddress,
        worldIdData: this.state.worldIdData,
        timestamp: Date.now()
      };
      
      localStorage.setItem(
        AUTH_MANAGER_CONFIG.STORAGE.AUTH_STATE, 
        JSON.stringify(stateToSave)
      );
      
      console.log('💾 Estado persistido');
      
    } catch (error) {
      console.error('❌ Error persistiendo estado:', error);
    }
  }

  clearPersistedState() {
    try {
      localStorage.removeItem(AUTH_MANAGER_CONFIG.STORAGE.AUTH_STATE);
      localStorage.removeItem(AUTH_MANAGER_CONFIG.STORAGE.LAST_CONNECTION);
    } catch (error) {
      console.error('❌ Error limpiando estado persistente:', error);
    }
  }

  // === VALIDACIONES DE TOKENS ===

  isTokenValid(tokens = null) {
    const tokensToCheck = tokens || this.state.tokens;
    
    if (!tokensToCheck || !tokensToCheck.access) {
      return false;
    }

    try {
      // Decodificar JWT básico para verificar expiración
      const payload = JSON.parse(atob(tokensToCheck.access.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      
      return payload.exp > now;
      
    } catch (error) {
      console.error('❌ Error validando token:', error);
      return false;
    }
  }

  isRefreshable() {
    if (!this.state.tokens || !this.state.tokens.refresh) {
      return false;
    }

    try {
      // Verificar si el refresh token no ha expirado
      const payload = JSON.parse(atob(this.state.tokens.refresh.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      
      return payload.exp > now;
      
    } catch (error) {
      console.error('❌ Error verificando refresh token:', error);
      return false;
    }
  }

  // === TIMERS Y AUTO-REFRESH ===

  setupAutoRefresh() {
    // Limpiar timer anterior
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.state.tokens || !this.isTokenValid()) {
      return;
    }

    try {
      // Calcular cuándo refrescar (5 min antes de expirar)
      const payload = JSON.parse(atob(this.state.tokens.access.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const refreshAt = expiresAt - AUTH_MANAGER_CONFIG.AUTO_REFRESH_MARGIN;
      const delay = Math.max(0, refreshAt - Date.now());

      console.log(`⏰ Auto-refresh programado en ${Math.round(delay / 1000)}s`);

      this.refreshTimer = setTimeout(async () => {
        await this.refreshAuthentication();
      }, delay);

    } catch (error) {
      console.error('❌ Error configurando auto-refresh:', error);
    }
  }

  startHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.state.lastHeartbeat = Date.now();
      
      if (this.isConnected()) {
        this.dispatchEvent(new CustomEvent(AUTH_MANAGER_CONFIG.EVENTS.HEARTBEAT, {
          detail: { timestamp: this.state.lastHeartbeat }
        }));
      }
    }, AUTH_MANAGER_CONFIG.HEARTBEAT_INTERVAL);
  }

  clearTimers() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  // === CLEANUP ===

  destroy() {
    console.log('🧹 Destruyendo AuthManager...');
    
    this.clearTimers();
    
    if (this.siweHandler) {
      this.siweHandler.destroy();
    }
    
    if (this.worldcoinAuth) {
      this.worldcoinAuth.destroy();
    }
    
    this.clearState();
  }
}

// === INSTANCIA SINGLETON ===
let authManagerInstance = null;

export function getAuthManager() {
  if (!authManagerInstance) {
    authManagerInstance = new AuthManager();
  }
  return authManagerInstance;
}

export function initAuthManager() {
  return getAuthManager();
}

// === EXPORTS ===
export { AuthManager, AUTH_MANAGER_CONFIG };
export default AuthManager;