/**
 * src/js/storage/user-sync.js - Sistema de Sincronización de Datos de Usuario
 * Maneja la sincronización entre localStorage y backend, resolución de conflictos
 */

import { Auth } from '../../lib/auth.js';

// === CONFIGURACIÓN DE SINCRONIZACIÓN ===
const SYNC_CONFIG = {
  // Endpoints del backend
  ENDPOINTS: {
    SYNC_DATA: '/api/user/sync',
    GET_PROGRESS: '/api/user/progress',
    BACKUP_DATA: '/api/user/backup',
    RESTORE_DATA: '/api/user/restore'
  },
  
  // Intervalos de sincronización
  INTERVALS: {
    AUTO_SYNC: 5 * 60 * 1000,     // 5 minutos
    FORCE_SYNC: 30 * 1000,        // 30 segundos tras cambio
    RETRY_DELAY: 10 * 1000,       // 10 segundos entre reintentos
    HEARTBEAT: 60 * 1000          // 1 minuto heartbeat
  },
  
  // Configuración de reintentos
  RETRY: {
    MAX_ATTEMPTS: 3,
    EXPONENTIAL_BACKOFF: true,
    BASE_DELAY: 1000              // 1 segundo base
  },
  
  // Datos que se sincronizan
  SYNC_KEYS: {
    // Progreso del juego
    GAME_PROGRESS: [
      'wld',
      'rbgp', 
      'energy',
      'last_ts',
      'total_taps',
      'highest_combo',
      'rainbow_completions',
      'total_playtime',
      'sessions_played'
    ],
    
    // Configuración de usuario
    USER_CONFIG: [
      'username',
      'language',
      'audio_enabled',
      'effects_enabled',
      'notifications_enabled'
    ],
    
    // Logros y estadísticas
    ACHIEVEMENTS: [
      'unlocked_achievements',
      'achievement_progress',
      'badges_earned',
      'milestones_reached'
    ],
    
    // Configuración del juego
    GAME_SETTINGS: [
      'difficulty_level',
      'auto_save_enabled',
      'cloud_sync_enabled',
      'backup_frequency'
    ]
  },
  
  // Estados de sincronización
  SYNC_STATES: {
    IDLE: 'idle',
    SYNCING: 'syncing',
    SUCCESS: 'success',
    CONFLICT: 'conflict',
    ERROR: 'error',
    OFFLINE: 'offline'
  },
  
  // Estrategias de resolución de conflictos
  CONFLICT_RESOLUTION: {
    CLIENT_WINS: 'client_wins',          // Cliente tiene prioridad
    SERVER_WINS: 'server_wins',          // Servidor tiene prioridad  
    LATEST_TIMESTAMP: 'latest_timestamp', // Más reciente gana
    MERGE_VALUES: 'merge_values',        // Combinar valores
    ASK_USER: 'ask_user'                 // Preguntar al usuario
  }
};

// === ESTADO GLOBAL ===
let syncState = {
  currentState: SYNC_CONFIG.SYNC_STATES.IDLE,
  isInitialized: false,
  isOnline: navigator.onLine,
  lastSyncTime: null,
  pendingChanges: new Set(),
  syncInProgress: false,
  retryCount: 0,
  conflictQueue: [],
  callbacks: {},
  
  // Timers
  autoSyncTimer: null,
  retryTimer: null,
  heartbeatTimer: null
};

// === UTILIDADES ===
function generateSyncId() {
  return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function getTimestamp() {
  return new Date().toISOString();
}

function isDataKey(key) {
  const allKeys = [
    ...SYNC_CONFIG.SYNC_KEYS.GAME_PROGRESS,
    ...SYNC_CONFIG.SYNC_KEYS.USER_CONFIG,
    ...SYNC_CONFIG.SYNC_KEYS.ACHIEVEMENTS,
    ...SYNC_CONFIG.SYNC_KEYS.GAME_SETTINGS
  ];
  return allKeys.includes(key);
}

function getKeyCategory(key) {
  for (const [category, keys] of Object.entries(SYNC_CONFIG.SYNC_KEYS)) {
    if (keys.includes(key)) {
      return category.toLowerCase();
    }
  }
  return 'unknown';
}

// === DETECCIÓN DE CAMBIOS ===
class LocalStorageWatcher {
  constructor() {
    this.originalSetItem = localStorage.setItem;
    this.originalRemoveItem = localStorage.removeItem;
    this.setupInterception();
  }
  
  setupInterception() {
    // Interceptar setItem
    localStorage.setItem = (key, value) => {
      this.originalSetItem.call(localStorage, key, value);
      this.handleStorageChange(key, value, 'set');
    };
    
    // Interceptar removeItem
    localStorage.removeItem = (key) => {
      this.originalRemoveItem.call(localStorage, key);
      this.handleStorageChange(key, null, 'remove');
    };
  }
  
  handleStorageChange(key, value, operation) {
    if (isDataKey(key)) {
      markDataChanged(key);
      scheduleForcedSync();
    }
  }
  
  destroy() {
    localStorage.setItem = this.originalSetItem;
    localStorage.removeItem = this.originalRemoveItem;
  }
}

let storageWatcher = null;

// === GESTIÓN DE ESTADO ===
function setState(newState, data = null) {
  const oldState = syncState.currentState;
  syncState.currentState = newState;
  
  console.log(`🔄 Sync State: ${oldState} → ${newState}`);
  
  // Emitir evento
  emitSyncEvent('state_change', {
    oldState,
    newState,
    data,
    timestamp: getTimestamp()
  });
  
  // Callbacks
  if (syncState.callbacks.onStateChange) {
    syncState.callbacks.onStateChange(newState, oldState, data);
  }
}

function markDataChanged(key) {
  syncState.pendingChanges.add(key);
  localStorage.setItem(`${key}_modified_at`, getTimestamp());
  
  console.log(`📝 Data changed: ${key} (${syncState.pendingChanges.size} pending)`);
}

function clearPendingChanges() {
  syncState.pendingChanges.clear();
}

// === RECOLECCIÓN DE DATOS ===
function collectLocalData(keys = null) {
  const data = {
    game_progress: {},
    user_config: {},
    achievements: {},
    game_settings: {},
    metadata: {
      collected_at: getTimestamp(),
      sync_id: generateSyncId(),
      client_version: '1.0.0',
      user_agent: navigator.userAgent
    }
  };
  
  const keysToSync = keys || [
    ...SYNC_CONFIG.SYNC_KEYS.GAME_PROGRESS,
    ...SYNC_CONFIG.SYNC_KEYS.USER_CONFIG,
    ...SYNC_CONFIG.SYNC_KEYS.ACHIEVEMENTS,
    ...SYNC_CONFIG.SYNC_KEYS.GAME_SETTINGS
  ];
  
  keysToSync.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      const modifiedAt = localStorage.getItem(`${key}_modified_at`);
      const category = getKeyCategory(key);
      
      if (value !== null) {
        data[category][key] = {
          value: tryParseJSON(value),
          modified_at: modifiedAt || getTimestamp(),
          type: typeof tryParseJSON(value)
        };
      }
    } catch (error) {
      console.warn(`Failed to collect data for key ${key}:`, error);
    }
  });
  
  return data;
}

function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function applyServerData(serverData) {
  const applied = [];
  const errors = [];
  
  try {
    // Aplicar datos por categoría
    for (const [category, categoryData] of Object.entries(serverData)) {
      if (category === 'metadata') continue;
      
      for (const [key, keyData] of Object.entries(categoryData)) {
        try {
          const value = typeof keyData.value === 'object' ? 
            JSON.stringify(keyData.value) : 
            String(keyData.value);
          
          localStorage.setItem(key, value);
          localStorage.setItem(`${key}_modified_at`, keyData.modified_at);
          localStorage.setItem(`${key}_synced_at`, getTimestamp());
          
          applied.push(key);
        } catch (error) {
          errors.push({ key, error: error.message });
        }
      }
    }
    
    return { success: true, applied, errors };
  } catch (error) {
    return { success: false, error: error.message, applied, errors };
  }
}

// === DETECCIÓN DE CONFLICTOS ===
function detectConflicts(localData, serverData) {
  const conflicts = [];
  
  for (const [category, categoryData] of Object.entries(localData)) {
    if (category === 'metadata' || !serverData[category]) continue;
    
    for (const [key, localKeyData] of Object.entries(categoryData)) {
      const serverKeyData = serverData[category][key];
      
      if (!serverKeyData) continue;
      
      // Comparar timestamps
      const localTime = new Date(localKeyData.modified_at);
      const serverTime = new Date(serverKeyData.modified_at);
      
      // Comparar valores
      const localValue = JSON.stringify(localKeyData.value);
      const serverValue = JSON.stringify(serverKeyData.value);
      
      if (localValue !== serverValue) {
        conflicts.push({
          key,
          category,
          local: {
            value: localKeyData.value,
            modified_at: localKeyData.modified_at,
            timestamp: localTime
          },
          server: {
            value: serverKeyData.value,
            modified_at: serverKeyData.modified_at,
            timestamp: serverTime
          },
          time_diff: Math.abs(localTime.getTime() - serverTime.getTime()),
          resolution_strategy: getConflictResolutionStrategy(key, localKeyData, serverKeyData)
        });
      }
    }
  }
  
  return conflicts;
}

function getConflictResolutionStrategy(key, localData, serverData) {
  // Estrategias específicas por tipo de dato
  const progressKeys = SYNC_CONFIG.SYNC_KEYS.GAME_PROGRESS;
  const configKeys = SYNC_CONFIG.SYNC_KEYS.USER_CONFIG;
  
  if (progressKeys.includes(key)) {
    // Para progreso del juego, usar el valor más alto (no perder progreso)
    if (typeof localData.value === 'number' && typeof serverData.value === 'number') {
      return SYNC_CONFIG.CONFLICT_RESOLUTION.MERGE_VALUES;
    }
    return SYNC_CONFIG.CONFLICT_RESOLUTION.LATEST_TIMESTAMP;
  }
  
  if (configKeys.includes(key)) {
    // Para configuración, usar timestamp más reciente
    return SYNC_CONFIG.CONFLICT_RESOLUTION.LATEST_TIMESTAMP;
  }
  
  // Por defecto, timestamp más reciente
  return SYNC_CONFIG.CONFLICT_RESOLUTION.LATEST_TIMESTAMP;
}

async function resolveConflicts(conflicts) {
  const resolved = [];
  const unresolved = [];
  
  for (const conflict of conflicts) {
    try {
      const resolution = await resolveConflict(conflict);
      if (resolution.success) {
        resolved.push({ ...conflict, resolution });
      } else {
        unresolved.push(conflict);
      }
    } catch (error) {
      console.error(`Failed to resolve conflict for ${conflict.key}:`, error);
      unresolved.push(conflict);
    }
  }
  
  return { resolved, unresolved };
}

async function resolveConflict(conflict) {
  const { key, local, server, resolution_strategy } = conflict;
  
  switch (resolution_strategy) {
    case SYNC_CONFIG.CONFLICT_RESOLUTION.CLIENT_WINS:
      return { success: true, chosen: 'local', value: local.value };
      
    case SYNC_CONFIG.CONFLICT_RESOLUTION.SERVER_WINS:
      localStorage.setItem(key, typeof server.value === 'object' ? 
        JSON.stringify(server.value) : String(server.value));
      return { success: true, chosen: 'server', value: server.value };
      
    case SYNC_CONFIG.CONFLICT_RESOLUTION.LATEST_TIMESTAMP:
      if (local.timestamp > server.timestamp) {
        return { success: true, chosen: 'local', value: local.value };
      } else {
        localStorage.setItem(key, typeof server.value === 'object' ? 
          JSON.stringify(server.value) : String(server.value));
        return { success: true, chosen: 'server', value: server.value };
      }
      
    case SYNC_CONFIG.CONFLICT_RESOLUTION.MERGE_VALUES:
      const merged = await mergeValues(key, local.value, server.value);
      localStorage.setItem(key, typeof merged === 'object' ? 
        JSON.stringify(merged) : String(merged));
      return { success: true, chosen: 'merged', value: merged };
      
    case SYNC_CONFIG.CONFLICT_RESOLUTION.ASK_USER:
      // Añadir a cola para resolver manualmente
      syncState.conflictQueue.push(conflict);
      return { success: false, reason: 'user_input_required' };
      
    default:
      return { success: false, reason: 'unknown_strategy' };
  }
}

async function mergeValues(key, localValue, serverValue) {
  // Estrategias de merge específicas por tipo de dato
  
  if (typeof localValue === 'number' && typeof serverValue === 'number') {
    // Para números, usar el mayor (no perder progreso)
    const progressKeys = ['wld', 'rbgp', 'total_taps', 'highest_combo', 'rainbow_completions'];
    if (progressKeys.includes(key)) {
      return Math.max(localValue, serverValue);
    }
    // Para otros números, promediar
    return (localValue + serverValue) / 2;
  }
  
  if (Array.isArray(localValue) && Array.isArray(serverValue)) {
    // Combinar arrays eliminando duplicados
    return [...new Set([...localValue, ...serverValue])];
  }
  
  if (typeof localValue === 'object' && typeof serverValue === 'object') {
    // Merge de objetos
    return { ...serverValue, ...localValue };
  }
  
  // Para strings y otros, usar el más reciente (ya manejado por timestamp)
  return localValue;
}

// === SINCRONIZACIÓN CON BACKEND ===
async function syncWithServer(forceSync = false) {
  if (syncState.syncInProgress && !forceSync) {
    console.log('🔄 Sync already in progress, skipping');
    return { success: false, reason: 'sync_in_progress' };
  }
  
  if (!syncState.isOnline) {
    setState(SYNC_CONFIG.SYNC_STATES.OFFLINE);
    return { success: false, reason: 'offline' };
  }
  
  if (!Auth.isAuthenticated) {
    return { success: false, reason: 'not_authenticated' };
  }
  
  syncState.syncInProgress = true;
  setState(SYNC_CONFIG.SYNC_STATES.SYNCING);
  
  try {
    // Recolectar datos locales
    const localData = collectLocalData();
    const hasChanges = syncState.pendingChanges.size > 0 || forceSync;
    
    // Hacer request al servidor
    const response = await fetch(SYNC_CONFIG.ENDPOINTS.SYNC_DATA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Auth.getToken()}`
      },
      body: JSON.stringify({
        local_data: localData,
        has_changes: hasChanges,
        last_sync: syncState.lastSyncTime,
        sync_id: localData.metadata.sync_id,
        force_sync: forceSync
      })
    });
    
    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Sync failed');
    }
    
    // Procesar respuesta del servidor
    return await processSyncResponse(result, localData);
    
  } catch (error) {
    console.error('Sync error:', error);
    syncState.retryCount++;
    setState(SYNC_CONFIG.SYNC_STATES.ERROR, { error: error.message });
    
    // Programar retry si no se excedió el límite
    if (syncState.retryCount < SYNC_CONFIG.RETRY.MAX_ATTEMPTS) {
      scheduleRetry();
    }
    
    return { success: false, error: error.message };
  } finally {
    syncState.syncInProgress = false;
  }
}

async function processSyncResponse(serverResponse, localData) {
  const { 
    server_data, 
    conflicts_detected = false, 
    sync_timestamp, 
    message 
  } = serverResponse;
  
  let conflicts = [];
  
  if (conflicts_detected && server_data) {
    // Detectar y resolver conflictos
    conflicts = detectConflicts(localData, server_data);
    
    if (conflicts.length > 0) {
      setState(SYNC_CONFIG.SYNC_STATES.CONFLICT, { conflicts });
      
      const resolution = await resolveConflicts(conflicts);
      
      if (resolution.unresolved.length > 0) {
        return {
          success: false,
          conflicts: resolution.unresolved,
          resolved: resolution.resolved,
          reason: 'unresolved_conflicts'
        };
      }
    }
  }
  
  // Aplicar datos del servidor si los hay
  if (server_data) {
    const applyResult = applyServerData(server_data);
    if (!applyResult.success) {
      throw new Error(`Failed to apply server data: ${applyResult.error}`);
    }
  }
  
  // Actualizar estado de sincronización
  syncState.lastSyncTime = sync_timestamp || getTimestamp();
  syncState.retryCount = 0;
  clearPendingChanges();
  
  setState(SYNC_CONFIG.SYNC_STATES.SUCCESS);
  
  // Guardar timestamp de última sincronización
  localStorage.setItem('last_sync_time', syncState.lastSyncTime);
  
  emitSyncEvent('sync_completed', {
    conflicts_resolved: conflicts.length,
    data_applied: !!server_data,
    message
  });
  
  return {
    success: true,
    conflicts_resolved: conflicts.length,
    sync_timestamp: syncState.lastSyncTime,
    message
  };
}

// === PROGRAMACIÓN DE SINCRONIZACIONES ===
function startAutoSync() {
  if (syncState.autoSyncTimer) {
    clearInterval(syncState.autoSyncTimer);
  }
  
  syncState.autoSyncTimer = setInterval(() => {
    if (syncState.isOnline && Auth.isAuthenticated) {
      syncWithServer(false);
    }
  }, SYNC_CONFIG.INTERVALS.AUTO_SYNC);
  
  console.log('🔄 Auto-sync started');
}

function stopAutoSync() {
  if (syncState.autoSyncTimer) {
    clearInterval(syncState.autoSyncTimer);
    syncState.autoSyncTimer = null;
    console.log('🔄 Auto-sync stopped');
  }
}

function scheduleForcedSync() {
  // Cancelar sync forzado anterior si existe
  if (syncState.forceSyncTimer) {
    clearTimeout(syncState.forceSyncTimer);
  }
  
  // Programar nuevo sync forzado
  syncState.forceSyncTimer = setTimeout(() => {
    if (syncState.pendingChanges.size > 0) {
      console.log('🚀 Forced sync triggered by data changes');
      syncWithServer(true);
    }
  }, SYNC_CONFIG.INTERVALS.FORCE_SYNC);
}

function scheduleRetry() {
  if (syncState.retryTimer) {
    clearTimeout(syncState.retryTimer);
  }
  
  const delay = SYNC_CONFIG.RETRY.EXPONENTIAL_BACKOFF ? 
    SYNC_CONFIG.RETRY.BASE_DELAY * Math.pow(2, syncState.retryCount - 1) :
    SYNC_CONFIG.RETRY.RETRY_DELAY;
  
  syncState.retryTimer = setTimeout(() => {
    console.log(`🔄 Retrying sync (attempt ${syncState.retryCount + 1})`);
    syncWithServer(false);
  }, delay);
}

// === HEARTBEAT Y CONEXIÓN ===
function startHeartbeat() {
  if (syncState.heartbeatTimer) {
    clearInterval(syncState.heartbeatTimer);
  }
  
  syncState.heartbeatTimer = setInterval(async () => {
    if (!Auth.isAuthenticated) return;
    
    try {
      const response = await fetch('/api/user/heartbeat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Auth.getToken()}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.sync_required) {
          console.log('💓 Heartbeat indicates sync required');
          syncWithServer(false);
        }
      }
    } catch (error) {
      console.warn('Heartbeat failed:', error);
    }
  }, SYNC_CONFIG.INTERVALS.HEARTBEAT);
}

function stopHeartbeat() {
  if (syncState.heartbeatTimer) {
    clearInterval(syncState.heartbeatTimer);
    syncState.heartbeatTimer = null;
  }
}

// === EVENTOS Y UTILIDADES ===
function emitSyncEvent(eventType, data) {
  const event = new CustomEvent(`user_sync_${eventType}`, {
    detail: { ...data, timestamp: getTimestamp() }
  });
  window.dispatchEvent(event);
}

function setupEventListeners() {
  // Detectar cambios de conectividad
  window.addEventListener('online', () => {
    syncState.isOnline = true;
    console.log('🌐 Back online - resuming sync');
    setState(SYNC_CONFIG.SYNC_STATES.IDLE);
    syncWithServer(false);
  });
  
  window.addEventListener('offline', () => {
    syncState.isOnline = false;
    console.log('📴 Gone offline - pausing sync');
    setState(SYNC_CONFIG.SYNC_STATES.OFFLINE);
  });
  
  // Sync cuando se enfoca la ventana
  window.addEventListener('focus', () => {
    if (syncState.isOnline && Auth.isAuthenticated) {
      const timeSinceLastSync = Date.now() - (new Date(syncState.lastSyncTime || 0).getTime());
      if (timeSinceLastSync > SYNC_CONFIG.INTERVALS.AUTO_SYNC) {
        console.log('👁️ Window focused - checking for sync');
        syncWithServer(false);
      }
    }
  });
  
  // Sync antes de cerrar ventana
  window.addEventListener('beforeunload', (event) => {
    if (syncState.pendingChanges.size > 0) {
      // Intentar sync síncrono de emergencia
      navigator.sendBeacon(SYNC_CONFIG.ENDPOINTS.SYNC_DATA, JSON.stringify({
        local_data: collectLocalData(Array.from(syncState.pendingChanges)),
        emergency_sync: true
      }));
    }
  });
}

// === API PÚBLICA ===

/**
 * Inicializa el sistema de sincronización
 */
export function initUserSync(options = {}) {
  if (syncState.isInitialized) {
    console.warn('⚠️ User sync already initialized');
    return getSyncState();
  }
  
  // Configurar callbacks
  syncState.callbacks = {
    onStateChange: options.onStateChange || null,
    onConflict: options.onConflict || null,
    onError: options.onError || null,
    onSuccess: options.onSuccess || null
  };
  
  // Configurar watchers
  storageWatcher = new LocalStorageWatcher();
  
  // Configurar event listeners
  setupEventListeners();
  
  // Cargar último tiempo de sync
  const lastSync = localStorage.getItem('last_sync_time');
  if (lastSync) {
    syncState.lastSyncTime = lastSync;
  }
  
  // Iniciar servicios automáticos
  startAutoSync();
  startHeartbeat();
  
  syncState.isInitialized = true;
  setState(SYNC_CONFIG.SYNC_STATES.IDLE);
  
  console.log('🔄 User sync initialized');
  
  // Sync inicial si está autenticado
  if (Auth.isAuthenticated) {
    setTimeout(() => syncWithServer(false), 1000);
  }
  
  return getSyncState();
}

/**
 * Fuerza sincronización inmediata
 */
export async function forceSyncNow() {
  console.log('🚀 Force sync requested');
  return await syncWithServer(true);
}

/**
 * Obtiene estado actual de sincronización
 */
export function getSyncState() {
  return {
    state: syncState.currentState,
    isInitialized: syncState.isInitialized,
    isOnline: syncState.isOnline,
    lastSyncTime: syncState.lastSyncTime,
    pendingChanges: Array.from(syncState.pendingChanges),
    syncInProgress: syncState.syncInProgress,
    retryCount: syncState.retryCount,
    hasConflicts: syncState.conflictQueue.length > 0,
    conflictCount: syncState.conflictQueue.length
  };
}

/**
 * Marca manualmente datos como modificados para próximo sync
 */
export function markDataForSync(keys) {
  const keyArray = Array.isArray(keys) ? keys : [keys];
  keyArray.forEach(key => {
    if (isDataKey(key)) {
      markDataChanged(key);
    }
  });
  scheduleForcedSync();
}

/**
 * Resuelve conflictos pendientes manualmente
 */
export async function resolveConflictManually(conflictId, resolution) {
  const conflict = syncState.conflictQueue.find(c => c.id === conflictId);
  if (!conflict) {
    throw new Error('Conflict not found');
  }
  
  const resolved = await resolveConflict({ ...conflict, resolution_strategy: resolution });
  
  if (resolved.success) {
    syncState.conflictQueue = syncState.conflictQueue.filter(c => c.id !== conflictId);
    emitSyncEvent('conflict_resolved', { conflictId, resolution: resolved });
  }
  
  return resolved;
}

/**
 * Obtiene conflictos pendientes
 */
export function getPendingConflicts() {
  return [...syncState.conflictQueue];
}

/**
 * Habilita/deshabilita auto-sync
 */
export function setAutoSyncEnabled(enabled) {
  if (enabled) {
    startAutoSync();
  } else {
    stopAutoSync();
  }
  
  localStorage.setItem('auto_sync_enabled', String(enabled));
}

/**
 * Limpia todos los datos locales
 */
export function clearLocalData() {
  const allKeys = [
    ...SYNC_CONFIG.SYNC_KEYS.GAME_PROGRESS,
    ...SYNC_CONFIG.SYNC_KEYS.USER_CONFIG,
    ...SYNC_CONFIG.SYNC_KEYS.ACHIEVEMENTS,
    ...SYNC_CONFIG.SYNC_KEYS.GAME_SETTINGS
  ];
  
  allKeys.forEach(key => {
    localStorage.removeItem(key);
    localStorage.removeItem(`${key}_modified_at`);
    localStorage.removeItem(`${key}_synced_at`);
  });
  
  clearPendingChanges();
  localStorage.removeItem('last_sync_time');
  
  console.log('🧹 Local data cleared');
  emitSyncEvent('data_cleared', { keys_cleared: allKeys.length });
}

/**
 * Exporta datos locales para backup
 */
export function exportLocalData() {
  const data = collectLocalData();
  const backup = {
    ...data,
    exported_at: getTimestamp(),
    version: '1.0.0'
  };
  
  return backup;
}

/**
 * Importa datos de backup
 */
export function importLocalData(backupData) {
  try {
    const result = applyServerData(backupData);
    
    if (result.success) {
      markDataForSync(result.applied);
      emitSyncEvent('data_imported', { keys_imported: result.applied.length });
    }
    
    return result;
  } catch (error) {
    console.error('Import failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Registra callback para eventos de sync
 */
export function onSyncEvent(eventType, callback) {
  const handler = (event) => callback(event.detail);
  window.addEventListener(`user_sync_${eventType}`, handler);
  
  return () => {
    window.removeEventListener(`user_sync_${eventType}`, handler);
  };
}

/**
 * Información de debug
 */
export function getDebugInfo() {
  return {
    state: syncState,
    config: SYNC_CONFIG,
    localData: collectLocalData(),
    isOnline: navigator.onLine,
    authState: Auth.getState?.() || 'unknown'
  };
}

/**
 * Destruye el sistema de sincronización
 */
export function destroyUserSync() {
  console.log('🧹 Destroying user sync...');
  
  stopAutoSync();
  stopHeartbeat();
  
  // Limpiar timers
  if (syncState.retryTimer) {
    clearTimeout(syncState.retryTimer);
  }
  if (syncState.forceSyncTimer) {
    clearTimeout(syncState.forceSyncTimer);
  }
  
  // Destruir watcher
  if (storageWatcher) {
    storageWatcher.destroy();
    storageWatcher = null;
  }
  
  // Reset estado
  syncState = {
    currentState: SYNC_CONFIG.SYNC_STATES.IDLE,
    isInitialized: false,
    isOnline: navigator.onLine,
    lastSyncTime: null,
    pendingChanges: new Set(),
    syncInProgress: false,
    retryCount: 0,
    conflictQueue: [],
    callbacks: {},
    autoSyncTimer: null,
    retryTimer: null,
    heartbeatTimer: null
  };
  
  console.log('✅ User sync destroyed');
}

// === EXPORTACIÓN POR DEFECTO ===
export default {
  // Inicialización
  init: initUserSync,
  destroy: destroyUserSync,
  
  // Sincronización
  forceSync: forceSyncNow,
  markForSync: markDataForSync,
  
  // Estado
  getState: getSyncState,
  isOnline: () => syncState.isOnline,
  hasPendingChanges: () => syncState.pendingChanges.size > 0,
  
  // Configuración
  setAutoSyncEnabled,
  
  // Conflictos
  getPendingConflicts,
  resolveConflict: resolveConflictManually,
  
  // Datos
  exportData: exportLocalData,
  importData: importLocalData,
  clearData: clearLocalData,
  
  // Eventos
  onEvent: onSyncEvent,
  
  // Debug
  debug: getDebugInfo,
  
  // Constantes
  STATES: SYNC_CONFIG.SYNC_STATES,
  CONFIG: SYNC_CONFIG
};

// === AUTO-INICIALIZACIÓN ===
// Auto-inicializar cuando el DOM esté listo si hay auth disponible
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Esperar un poco para que Auth se inicialice
    setTimeout(() => {
      if (Auth?.isAuthenticated) {
        console.log('🔄 Auto-initializing user sync');
        initUserSync();
      }
    }, 2000);
  });
  
  // También inicializar cuando se complete la autenticación
  window.addEventListener('auth_status_change', (event) => {
    if (event.detail.status === 'success' && !syncState.isInitialized) {
      console.log('🔄 Initializing user sync after auth success');
      setTimeout(() => initUserSync(), 1000);
    }
  });
}