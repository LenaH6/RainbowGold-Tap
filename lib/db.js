/**
 * RainbowGold-Tap: Database Manager (lib/db.js)
 * Maneja sincronización entre localStorage y backend para WorldApp
 */

// === CONFIGURACIÓN ===
const DB_CONFIG = {
  // Endpoints del backend
  ENDPOINTS: {
    USER_PROFILE: '/api/user/profile',
    GAME_STATE: '/api/user/game-state',
    LEADERBOARD: '/api/leaderboard',
    IDEAS_VOTES: '/api/ideas/votes',
    IDEAS_SUGGESTIONS: '/api/ideas/suggestions',
    INBOX_MESSAGES: '/api/inbox/messages',
    TRANSACTIONS: '/api/transactions',
    PAYMENTS: '/api/payments',
    SYNC: '/api/sync'
  },

  // Configuración de sync
  SYNC_INTERVAL: 30000, // 30s entre syncs automáticos
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000, // 2s entre reintentos
  OFFLINE_THRESHOLD: 60000, // 1min sin conexión = modo offline
  
  // Batch limits para optimizar requests
  BATCH_SIZE: 50,
  MAX_PENDING_OPERATIONS: 100,

  // Cache TTL
  CACHE_TTL: {
    PROFILE: 5 * 60 * 1000,    // 5 min
    GAME_STATE: 1 * 60 * 1000, // 1 min  
    LEADERBOARD: 2 * 60 * 1000, // 2 min
    IDEAS: 10 * 60 * 1000      // 10 min
  },

  // Storage keys
  STORAGE: {
    QUEUE: 'db_operation_queue',
    LAST_SYNC: 'db_last_sync',
    CACHE_PREFIX: 'db_cache_'
  }
};

// === ESTADO GLOBAL ===
let dbState = {
  isOnline: navigator.onLine,
  isInitialized: false,
  isSyncing: false,
  lastSync: parseInt(localStorage.getItem(DB_CONFIG.STORAGE.LAST_SYNC) || '0'),
  pendingOperations: [],
  cache: new Map(),
  syncTimer: null,
  retryCount: 0
};

// === QUEUE DE OPERACIONES OFFLINE ===
class OperationQueue {
  constructor() {
    this.queue = this.loadQueue();
    this.isProcessing = false;
  }

  loadQueue() {
    try {
      const stored = localStorage.getItem(DB_CONFIG.STORAGE.QUEUE);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Error loading operation queue:', e);
      return [];
    }
  }

  saveQueue() {
    try {
      localStorage.setItem(DB_CONFIG.STORAGE.QUEUE, JSON.stringify(this.queue));
    } catch (e) {
      console.warn('Error saving operation queue:', e);
    }
  }

  add(operation) {
    if (this.queue.length >= DB_CONFIG.MAX_PENDING_OPERATIONS) {
      // Remover operaciones más antiguas si alcanzamos el límite
      this.queue.shift();
    }

    const op = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      type: operation.type,
      endpoint: operation.endpoint,
      method: operation.method || 'POST',
      data: operation.data,
      retryCount: 0,
      maxRetries: operation.maxRetries || 3,
      priority: operation.priority || 'normal' // high, normal, low
    };

    // Insertar según prioridad
    if (op.priority === 'high') {
      this.queue.unshift(op);
    } else {
      this.queue.push(op);
    }

    this.saveQueue();
    
    // Procesar inmediatamente si estamos online
    if (dbState.isOnline && !this.isProcessing) {
      this.process();
    }
    
    return op.id;
  }

  async process() {
    if (this.isProcessing || !dbState.isOnline || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && dbState.isOnline) {
        const operation = this.queue[0];
        
        try {
          await this.executeOperation(operation);
          this.queue.shift(); // Remover operación exitosa
          this.saveQueue();
        } catch (error) {
          console.warn('Operation failed:', operation.type, error);
          
          operation.retryCount++;
          if (operation.retryCount >= operation.maxRetries) {
            console.error('Max retries reached for operation:', operation);
            this.queue.shift(); // Remover operación fallida permanentemente
            this.saveQueue();
          } else {
            // Esperar antes del próximo intento
            await this.sleep(DB_CONFIG.RETRY_DELAY * operation.retryCount);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async executeOperation(operation) {
    const token = window.Auth?.getToken?.();
    
    const response = await fetch(operation.endpoint, {
      method: operation.method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: operation.data ? JSON.stringify(operation.data) : undefined
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  clear() {
    this.queue = [];
    this.saveQueue();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Instancia global de la queue
const operationQueue = new OperationQueue();

// === CACHE MANAGER ===
class CacheManager {
  static set(key, data, ttl = null) {
    const cacheKey = DB_CONFIG.STORAGE.CACHE_PREFIX + key;
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: ttl || DB_CONFIG.CACHE_TTL.PROFILE
    };
    
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      dbState.cache.set(key, cacheEntry);
    } catch (e) {
      console.warn('Cache write error:', e);
    }
  }

  static get(key) {
    // Primero verificar en memoria
    if (dbState.cache.has(key)) {
      const entry = dbState.cache.get(key);
      if (Date.now() - entry.timestamp < entry.ttl) {
        return entry.data;
      } else {
        dbState.cache.delete(key);
      }
    }

    // Verificar en localStorage
    try {
      const cacheKey = DB_CONFIG.STORAGE.CACHE_PREFIX + key;
      const stored = localStorage.getItem(cacheKey);
      
      if (stored) {
        const entry = JSON.parse(stored);
        if (Date.now() - entry.timestamp < entry.ttl) {
          dbState.cache.set(key, entry);
          return entry.data;
        } else {
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (e) {
      console.warn('Cache read error:', e);
    }

    return null;
  }

  static clear(pattern = null) {
    if (pattern) {
      // Limpiar entradas específicas
      const keys = Array.from(dbState.cache.keys()).filter(key => key.includes(pattern));
      keys.forEach(key => {
        dbState.cache.delete(key);
        localStorage.removeItem(DB_CONFIG.STORAGE.CACHE_PREFIX + key);
      });
    } else {
      // Limpiar todo el cache
      dbState.cache.clear();
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(DB_CONFIG.STORAGE.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    }
  }
}

// === NETWORK UTILS ===
async function makeRequest(endpoint, options = {}) {
  const token = window.Auth?.getToken?.();
  
  const config = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    ...options
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(endpoint, config);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

function isOnline() {
  return dbState.isOnline;
}

// === USER PROFILE ===
const UserProfile = {
  async get(useCache = true) {
    const cacheKey = 'user_profile';
    
    if (useCache) {
      const cached = CacheManager.get(cacheKey);
      if (cached) return cached;
    }

    if (!isOnline()) {
      // Fallback a localStorage si no hay cache
      return window.GameStorage?.loadUserPrefs?.() || null;
    }

    try {
      const profile = await makeRequest(DB_CONFIG.ENDPOINTS.USER_PROFILE);
      CacheManager.set(cacheKey, profile, DB_CONFIG.CACHE_TTL.PROFILE);
      return profile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return window.GameStorage?.loadUserPrefs?.() || null;
    }
  },

  async update(profileData, immediate = false) {
    // Actualizar localStorage inmediatamente
    if (window.GameStorage?.saveUserPrefs) {
      window.GameStorage.saveUserPrefs(profileData);
    }

    if (immediate && isOnline()) {
      try {
        const updated = await makeRequest(DB_CONFIG.ENDPOINTS.USER_PROFILE, {
          method: 'PUT',
          body: profileData
        });
        
        CacheManager.set('user_profile', updated);
        return updated;
      } catch (error) {
        console.error('Error updating profile:', error);
      }
    } else {
      // Agregar a queue para sync posterior
      operationQueue.add({
        type: 'update_profile',
        endpoint: DB_CONFIG.ENDPOINTS.USER_PROFILE,
        method: 'PUT',
        data: profileData,
        priority: 'normal'
      });
    }

    return profileData;
  }
};

// === GAME STATE ===
const GameState = {
  async get(useCache = true) {
    const cacheKey = 'game_state';
    
    if (useCache) {
      const cached = CacheManager.get(cacheKey);
      if (cached) return cached;
    }

    if (!isOnline()) {
      return window.GameStorage?.loadGameState?.() || null;
    }

    try {
      const gameState = await makeRequest(DB_CONFIG.ENDPOINTS.GAME_STATE);
      CacheManager.set(cacheKey, gameState, DB_CONFIG.CACHE_TTL.GAME_STATE);
      return gameState;
    } catch (error) {
      console.error('Error fetching game state:', error);
      return window.GameStorage?.loadGameState?.() || null;
    }
  },

  async save(gameData, immediate = false) {
    // Siempre guardar en localStorage
    if (window.GameStorage?.saveGameState) {
      window.GameStorage.saveGameState(gameData);
    }

    if (immediate && isOnline()) {
      try {
        const saved = await makeRequest(DB_CONFIG.ENDPOINTS.GAME_STATE, {
          method: 'POST',
          body: gameData
        });
        
        CacheManager.set('game_state', saved);
        return saved;
      } catch (error) {
        console.error('Error saving game state:', error);
      }
    } else {
      // Queue para sync posterior
      operationQueue.add({
        type: 'save_game_state',
        endpoint: DB_CONFIG.ENDPOINTS.GAME_STATE,
        method: 'POST',
        data: gameData,
        priority: 'high' // Game state tiene alta prioridad
      });
    }

    return gameData;
  }
};

// === TRANSACTIONS / PAYMENTS ===
const Transactions = {
  async create(transactionData) {
    // Las transacciones siempre son inmediatas y críticas
    if (!isOnline()) {
      throw new Error('Transactions require internet connection');
    }

    try {
      const transaction = await makeRequest(DB_CONFIG.ENDPOINTS.TRANSACTIONS, {
        method: 'POST',
        body: transactionData
      });

      // Actualizar balance local inmediatamente
      if (transaction.success && window.GameStorage) {
        const currentState = window.GameStorage.loadGameState();
        if (transactionData.type === 'refill' && transactionData.currency === 'WLD') {
          currentState.wld -= transactionData.amount;
          // La energía se actualiza en el juego
        }
        window.GameStorage.saveGameState(currentState);
      }

      return transaction;
    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    }
  },

  async getHistory(limit = 20) {
    const cacheKey = `transaction_history_${limit}`;
    const cached = CacheManager.get(cacheKey);
    
    if (cached) return cached;

    if (!isOnline()) {
      return []; // Sin historial offline
    }

    try {
      const history = await makeRequest(`${DB_CONFIG.ENDPOINTS.TRANSACTIONS}?limit=${limit}`);
      CacheManager.set(cacheKey, history, DB_CONFIG.CACHE_TTL.PROFILE);
      return history;
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      return [];
    }
  }
};

// === IDEAS SYSTEM ===
const Ideas = {
  async getVotes() {
    const cacheKey = 'ideas_votes';
    const cached = CacheManager.get(cacheKey);
    
    if (cached) return cached;

    if (!isOnline()) {
      return window.GameStorage?.loadVotes?.() || { A: 0, B: 0, C: 0 };
    }

    try {
      const votes = await makeRequest(DB_CONFIG.ENDPOINTS.IDEAS_VOTES);
      CacheManager.set(cacheKey, votes, DB_CONFIG.CACHE_TTL.IDEAS);
      return votes;
    } catch (error) {
      console.error('Error fetching votes:', error);
      return window.GameStorage?.loadVotes?.() || { A: 0, B: 0, C: 0 };
    }
  },

  async submitVote(option) {
    // Actualizar local primero
    if (window.GameStorage?.addVote) {
      window.GameStorage.addVote(option);
    }

    if (isOnline()) {
      try {
        const result = await makeRequest(DB_CONFIG.ENDPOINTS.IDEAS_VOTES, {
          method: 'POST',
          body: { option, timestamp: Date.now() }
        });
        
        CacheManager.clear('ideas_votes');
        return result;
      } catch (error) {
        console.error('Error submitting vote:', error);
      }
    } else {
      operationQueue.add({
        type: 'submit_vote',
        endpoint: DB_CONFIG.ENDPOINTS.IDEAS_VOTES,
        method: 'POST',
        data: { option, timestamp: Date.now() },
        priority: 'normal'
      });
    }
  },

  async submitSuggestion(text) {
    const suggestion = {
      text: text.trim(),
      timestamp: Date.now()
    };

    // Guardar local
    if (window.GameStorage?.addSuggestion) {
      window.GameStorage.addSuggestion(text);
    }

    if (isOnline()) {
      try {
        return await makeRequest(DB_CONFIG.ENDPOINTS.IDEAS_SUGGESTIONS, {
          method: 'POST',
          body: suggestion
        });
      } catch (error) {
        console.error('Error submitting suggestion:', error);
      }
    } else {
      operationQueue.add({
        type: 'submit_suggestion',
        endpoint: DB_CONFIG.ENDPOINTS.IDEAS_SUGGESTIONS,
        method: 'POST',
        data: suggestion,
        priority: 'normal'
      });
    }

    return suggestion;
  }
};

// === INBOX SYSTEM ===
const Inbox = {
  async getMessages() {
    const cacheKey = 'inbox_messages';
    const cached = CacheManager.get(cacheKey);
    
    if (cached) return cached;

    if (!isOnline()) {
      return window.GameStorage?.loadMessages?.() || [];
    }

    try {
      const messages = await makeRequest(DB_CONFIG.ENDPOINTS.INBOX_MESSAGES);
      CacheManager.set(cacheKey, messages, DB_CONFIG.CACHE_TTL.PROFILE);
      
      // Sincronizar con localStorage
      if (window.GameStorage && messages.length > 0) {
        // Actualizar mensajes locales (merge inteligente)
        const localMessages = window.GameStorage.loadMessages();
        const merged = this.mergeMessages(localMessages, messages);
        // Guardar merge en localStorage - implementar según necesidad
      }
      
      return messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return window.GameStorage?.loadMessages?.() || [];
    }
  },

  async markRead(messageId) {
    // Actualizar local primero
    if (window.GameStorage?.markMessageRead) {
      window.GameStorage.markMessageRead(messageId);
    }

    if (isOnline()) {
      try {
        await makeRequest(`${DB_CONFIG.ENDPOINTS.INBOX_MESSAGES}/${messageId}/read`, {
          method: 'PUT'
        });
        CacheManager.clear('inbox_messages');
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    } else {
      operationQueue.add({
        type: 'mark_message_read',
        endpoint: `${DB_CONFIG.ENDPOINTS.INBOX_MESSAGES}/${messageId}/read`,
        method: 'PUT',
        priority: 'low'
      });
    }
  },

  mergeMessages(local, remote) {
    // Implementar lógica de merge inteligente
    const merged = [...remote];
    
    local.forEach(localMsg => {
      if (!remote.find(remoteMsg => remoteMsg.id === localMsg.id)) {
        merged.push(localMsg);
      }
    });
    
    return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
};

// === LEADERBOARD ===
const Leaderboard = {
  async get(type = 'global', limit = 100) {
    const cacheKey = `leaderboard_${type}_${limit}`;
    const cached = CacheManager.get(cacheKey);
    
    if (cached) return cached;

    if (!isOnline()) {
      return []; // No leaderboard offline
    }

    try {
      const leaderboard = await makeRequest(`${DB_CONFIG.ENDPOINTS.LEADERBOARD}?type=${type}&limit=${limit}`);
      CacheManager.set(cacheKey, leaderboard, DB_CONFIG.CACHE_TTL.LEADERBOARD);
      return leaderboard;
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  }
};

// === SYNC MANAGER ===
const Sync = {
  async full() {
    if (dbState.isSyncing || !isOnline()) {
      return false;
    }

    dbState.isSyncing = true;
    
    try {
      // 1. Procesar queue de operaciones pendientes
      await operationQueue.process();
      
      // 2. Sync bidireccional con el servidor
      const localState = {
        gameState: window.GameStorage?.loadGameState?.(),
        userPrefs: window.GameStorage?.loadUserPrefs?.(),
        lastSync: dbState.lastSync
      };

      const syncResult = await makeRequest(DB_CONFIG.ENDPOINTS.SYNC, {
        method: 'POST',
        body: localState
      });

      // 3. Aplicar cambios del servidor
      if (syncResult.updates) {
        if (syncResult.updates.gameState && window.GameStorage?.saveGameState) {
          window.GameStorage.saveGameState(syncResult.updates.gameState);
        }
        
        if (syncResult.updates.messages && window.GameStorage) {
          syncResult.updates.messages.forEach(msg => {
            window.GameStorage.addMessage(msg);
          });
        }
      }

      // 4. Actualizar timestamp de sync
      dbState.lastSync = Date.now();
      localStorage.setItem(DB_CONFIG.STORAGE.LAST_SYNC, dbState.lastSync);
      
      // 5. Limpiar cache selectivamente
      CacheManager.clear('game_state');
      CacheManager.clear('user_profile');

      dbState.retryCount = 0;
      return true;

    } catch (error) {
      console.error('Sync error:', error);
      dbState.retryCount++;
      return false;
    } finally {
      dbState.isSyncing = false;
    }
  },

  startAutoSync() {
    if (dbState.syncTimer) {
      clearInterval(dbState.syncTimer);
    }

    dbState.syncTimer = setInterval(() => {
      if (isOnline() && !dbState.isSyncing) {
        this.full();
      }
    }, DB_CONFIG.SYNC_INTERVAL);
  },

  stopAutoSync() {
    if (dbState.syncTimer) {
      clearInterval(dbState.syncTimer);
      dbState.syncTimer = null;
    }
  }
};

// === EVENT LISTENERS ===
function setupEventListeners() {
  // Detectar cambios de conectividad
  window.addEventListener('online', () => {
    console.log('Connection restored');
    dbState.isOnline = true;
    dbState.retryCount = 0;
    
    // Procesar queue pendiente
    operationQueue.process();
    
    // Sync completo
    setTimeout(() => Sync.full(), 1000);
  });

  window.addEventListener('offline', () => {
    console.log('Connection lost');
    dbState.isOnline = false;
    Sync.stopAutoSync();
  });

  // Cleanup al cerrar
  window.addEventListener('beforeunload', () => {
    Sync.stopAutoSync();
  });

  // Sync cuando regresa el foco (tab switching)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isOnline() && !dbState.isSyncing) {
      // Sync si ha pasado más de 1 minuto
      if (Date.now() - dbState.lastSync > 60000) {
        Sync.full();
      }
    }
  });
}

// === INICIALIZACIÓN ===
async function initDB() {
  if (dbState.isInitialized) return;

  try {
    console.log('Initializing DB module...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Cargar cache en memoria
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(DB_CONFIG.STORAGE.CACHE_PREFIX)) {
        try {
          const cacheKey = key.replace(DB_CONFIG.STORAGE.CACHE_PREFIX, '');
          const entry = JSON.parse(localStorage.getItem(key));
          if (Date.now() - entry.timestamp < entry.ttl) {
            dbState.cache.set(cacheKey, entry);
          } else {
            localStorage.removeItem(key);
          }
        } catch (e) {
          localStorage.removeItem(key);
        }
      }
    });

    // Sync inicial si hay conexión
    if (isOnline()) {
      await Sync.full();
      Sync.startAutoSync();
    }

    dbState.isInitialized = true;
    console.log('DB module initialized successfully');

  } catch (error) {
    console.error('DB initialization error:', error);
  }
}

// === API PÚBLICA ===
const DB = {
  // Estado
  get isOnline() { return isOnline(); },
  get isSyncing() { return dbState.isSyncing; },
  get lastSync() { return dbState.lastSync; },
  get queueSize() { return operationQueue.queue.length; },

  // Módulos principales
  UserProfile,
  GameState,
  Transactions,
  Ideas,
  Inbox,
  Leaderboard,
  Sync,

  // Utilidades
  Cache: CacheManager,
  clearCache: () => CacheManager.clear(),
  
  // Métodos de conveniencia
  init: initDB,
  isInitialized: () => dbState.isInitialized
};

// === EXPORTS ===
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DB, initDB };
} else {
  window.DB = DB;
  window.initDB = initDB;
}

// Auto-inicializar después de Auth si está disponible
if (typeof window !== 'undefined') {
  const autoInit = () => {
    // Esperar a que Auth esté listo
    if (window.Auth?.isAuthenticated) {
      initDB();
    } else {
      // Escuchar el evento de auth
      window.addEventListener('auth_status_change', (event) => {
        if (event.detail.status === 'success' && !dbState.isInitialized) {
          initDB();
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    setTimeout(autoInit, 100);
  }
}