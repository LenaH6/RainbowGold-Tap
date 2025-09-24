/**
 * storage-backup-manager.js - Sistema de Persistencia y Respaldos RainbowGold
 * Gestiona localStorage, backups automáticos, sincronización y recuperación de datos
 */

// === CONFIGURACIÓN DE STORAGE ===
const STORAGE_CONFIG = {
  // Prefijos para organizar datos
  PREFIX: 'rbg_',
  BACKUP_PREFIX: 'rbg_backup_',
  TEMP_PREFIX: 'rbg_temp_',
  
  // Claves principales del juego
  KEYS: {
    // Datos principales
    WLD: 'wld',
    RBGP: 'rbgp', 
    ENERGY: 'energy',
    LAST_TS: 'last_ts',
    
    // Configuración usuario
    USERNAME: 'username',
    LANGUAGE: 'language',
    AUDIO_VOLUME: 'audio_volume',
    
    // Progreso del juego
    COMBO_LEVEL: 'combo_level',
    COMBO_PROGRESS: 'combo_progress',
    TOTAL_TAPS: 'total_taps',
    TOTAL_EARNED: 'total_earned',
    
    // Features desbloqueadas
    UNLOCKED_FEATURES: 'unlocked_features',
    ACHIEVEMENTS: 'achievements',
    
    // WorldApp específico
    WORLDCOIN_ADDRESS: 'wc_address',
    WORLDCOIN_PROFILE: 'wc_profile',
    SESSION_ID: 'session_id',
    LAST_SYNC: 'last_sync',
    
    // Ideas & Polls
    IDEAS_TICKETS: 'ideas_tickets',
    POLL_VOTES: 'poll_votes',
    SUGGESTIONS_SENT: 'suggestions_sent',
    
    // Metadata
    GAME_VERSION: 'game_version',
    INSTALL_DATE: 'install_date',
    LAST_PLAYED: 'last_played'
  },
  
  // Configuración de backups
  BACKUP: {
    MAX_BACKUPS: 5,           // Máximo de backups simultáneos
    AUTO_INTERVAL: 300000,    // Auto-backup cada 5 minutos (ms)
    CRITICAL_KEYS: [          // Claves críticas que siempre se respaldan
      'wld', 'rbgp', 'energy', 'combo_level', 'combo_progress'
    ]
  },
  
  // Configuración de sincronización
  SYNC: {
    ENABLED: true,
    ENDPOINT: null,           // Se configura desde fuera
    TIMEOUT: 10000,          // 10s timeout
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000        // 2s entre reintentos
  },
  
  // Configuración de compresión/encriptación
  COMPRESSION: {
    ENABLED: true,
    MIN_SIZE: 1024           // Comprimir solo si >1KB
  }
};

// === VALIDADORES DE DATOS ===
const DATA_VALIDATORS = {
  wld: (val) => typeof val === 'number' && val >= 0 && isFinite(val),
  rbgp: (val) => typeof val === 'number' && val >= 0 && isFinite(val),
  energy: (val) => typeof val === 'number' && val >= 0 && val <= 1000,
  combo_level: (val) => Number.isInteger(val) && val >= 0 && val <= 5,
  combo_progress: (val) => typeof val === 'object' && val !== null,
  username: (val) => typeof val === 'string' && val.length <= 50,
  language: (val) => ['es', 'en'].includes(val),
  audio_volume: (val) => typeof val === 'number' && val >= 0 && val <= 1
};

// === SISTEMA DE STORAGE PRINCIPAL ===
class StorageManager {
  constructor() {
    this.prefix = STORAGE_CONFIG.PREFIX;
    this.isAvailable = this.checkAvailability();
    this.listeners = new Map();
    this.lastBackup = 0;
    this.syncQueue = [];
    this.isSyncing = false;
    
    this.initializeStorage();
  }

  // === INICIALIZACIÓN ===
  checkAvailability() {
    try {
      const test = '__rbg_test__';
      localStorage.setItem(test, 'test');
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('⚠️ localStorage no disponible:', e);
      return false;
    }
  }

  initializeStorage() {
    if (!this.isAvailable) {
      console.error('❌ Storage no disponible - usando memoria temporal');
      this.fallbackStorage = new Map();
      return;
    }
    
    // Verificar versión y migrar si es necesario
    this.checkVersion();
    
    // Inicializar metadata si es primera vez
    this.initializeMetadata();
    
    // Limpiar datos temporales antiguos
    this.cleanupTempData();
    
    // Configurar auto-backup
    this.setupAutoBackup();
    
    console.log('✅ StorageManager inicializado');
  }

  checkVersion() {
    const currentVersion = '1.0.0'; // Tu versión actual
    const storedVersion = this.get('game_version');
    
    if (!storedVersion) {
      // Primera instalación
      this.set('game_version', currentVersion);
      this.set('install_date', Date.now());
    } else if (storedVersion !== currentVersion) {
      // Migración necesaria
      this.migrateData(storedVersion, currentVersion);
      this.set('game_version', currentVersion);
    }
  }

  initializeMetadata() {
    const now = Date.now();
    
    if (!this.get('install_date')) {
      this.set('install_date', now);
    }
    
    this.set('last_played', now);
  }

  cleanupTempData() {
    if (!this.isAvailable) return;
    
    const keys = Object.keys(localStorage);
    const tempPrefix = STORAGE_CONFIG.TEMP_PREFIX;
    const cutoff = Date.now() - 3600000; // 1 hora
    
    keys.forEach(key => {
      if (key.startsWith(tempPrefix)) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.timestamp < cutoff) {
            localStorage.removeItem(key);
          }
        } catch (e) {
          // Datos corruptos, eliminar
          localStorage.removeItem(key);
        }
      }
    });
  }

  // === API BÁSICA DE STORAGE ===
  
  /**
   * Obtiene un valor del storage
   * @param {string} key - Clave del dato
   * @param {*} defaultValue - Valor por defecto si no existe
   * @returns {*} Valor almacenado o default
   */
  get(key, defaultValue = null) {
    const fullKey = this.prefix + key;
    
    if (!this.isAvailable) {
      return this.fallbackStorage.get(fullKey) || defaultValue;
    }
    
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw === null) return defaultValue;
      
      const data = JSON.parse(raw);
      
      // Validar datos si hay validator
      if (DATA_VALIDATORS[key] && !DATA_VALIDATORS[key](data.value)) {
        console.warn(`⚠️ Dato inválido para ${key}:`, data.value);
        return defaultValue;
      }
      
      return data.value;
    } catch (e) {
      console.error(`❌ Error leyendo ${key}:`, e);
      return defaultValue;
    }
  }

  /**
   * Almacena un valor en el storage
   * @param {string} key - Clave del dato
   * @param {*} value - Valor a almacenar
   * @param {Object} options - Opciones adicionales
   * @returns {boolean} True si se almacenó correctamente
   */
  set(key, value, options = {}) {
    const {
      encrypt = false,
      compress = false,
      backup = true,
      notify = true
    } = options;
    
    // Validar dato si hay validator
    if (DATA_VALIDATORS[key] && !DATA_VALIDATORS[key](value)) {
      console.error(`❌ Dato inválido para ${key}:`, value);
      return false;
    }
    
    const fullKey = this.prefix + key;
    const timestamp = Date.now();
    
    const data = {
      value,
      timestamp,
      version: '1.0',
      ...(encrypt && { encrypted: true }),
      ...(compress && { compressed: true })
    };
    
    // Procesamiento de datos
    if (compress && this.shouldCompress(data)) {
      data.value = this.compressData(data.value);
      data.compressed = true;
    }
    
    if (encrypt) {
      data.value = this.encryptData(data.value);
      data.encrypted = true;
    }
    
    try {
      if (!this.isAvailable) {
        this.fallbackStorage.set(fullKey, data);
      } else {
        localStorage.setItem(fullKey, JSON.stringify(data));
      }
      
      // Backup automático para claves críticas
      if (backup && this.isCriticalKey(key)) {
        this.createBackup(key, value);
      }
      
      // Notificar cambios
      if (notify) {
        this.notifyChange(key, value);
      }
      
      // Agregar a cola de sincronización
      if (STORAGE_CONFIG.SYNC.ENABLED && this.isSyncableKey(key)) {
        this.addToSyncQueue(key, value);
      }
      
      return true;
    } catch (e) {
      console.error(`❌ Error almacenando ${key}:`, e);
      
      // Intentar limpiar espacio si está lleno
      if (e.name === 'QuotaExceededError') {
        this.cleanupStorage();
        // Reintentar una vez
        try {
          localStorage.setItem(fullKey, JSON.stringify(data));
          return true;
        } catch (e2) {
          console.error('❌ Error persistente de storage:', e2);
        }
      }
      
      return false;
    }
  }

  /**
   * Elimina un valor del storage
   * @param {string} key - Clave a eliminar
   * @returns {boolean} True si se eliminó
   */
  remove(key) {
    const fullKey = this.prefix + key;
    
    try {
      if (!this.isAvailable) {
        this.fallbackStorage.delete(fullKey);
      } else {
        localStorage.removeItem(fullKey);
      }
      
      this.notifyChange(key, null);
      return true;
    } catch (e) {
      console.error(`❌ Error eliminando ${key}:`, e);
      return false;
    }
  }

  /**
   * Verifica si existe una clave
   * @param {string} key - Clave a verificar
   * @returns {boolean} True si existe
   */
  has(key) {
    const fullKey = this.prefix + key;
    
    if (!this.isAvailable) {
      return this.fallbackStorage.has(fullKey);
    }
    
    return localStorage.getItem(fullKey) !== null;
  }

  // === SISTEMA DE BACKUPS ===
  
  /**
   * Crea un backup de los datos críticos
   * @param {string} key - Clave específica o null para backup completo
   * @param {*} value - Valor a respaldar
   */
  createBackup(key = null, value = null) {
    const timestamp = Date.now();
    const backupId = `backup_${timestamp}`;
    
    let backupData;
    
    if (key && value !== null) {
      // Backup de clave específica
      backupData = { [key]: value };
    } else {
      // Backup completo de claves críticas
      backupData = {};
      STORAGE_CONFIG.BACKUP.CRITICAL_KEYS.forEach(criticalKey => {
        const val = this.get(criticalKey);
        if (val !== null) {
          backupData[criticalKey] = val;
        }
      });
    }
    
    const backup = {
      id: backupId,
      timestamp,
      data: backupData,
      version: this.get('game_version', '1.0.0'),
      type: key ? 'partial' : 'full'
    };
    
    try {
      const backupKey = STORAGE_CONFIG.BACKUP_PREFIX + backupId;
      localStorage.setItem(backupKey, JSON.stringify(backup));
      
      // Limpiar backups antiguos
      this.cleanupOldBackups();
      this.lastBackup = timestamp;
      
      console.log(`💾 Backup creado: ${backupId}`);
      return backupId;
    } catch (e) {
      console.error('❌ Error creando backup:', e);
      return null;
    }
  }

  /**
   * Restaura datos desde un backup
   * @param {string} backupId - ID del backup a restaurar
   * @returns {boolean} True si se restauró correctamente
   */
  restoreBackup(backupId) {
    try {
      const backupKey = STORAGE_CONFIG.BACKUP_PREFIX + backupId;
      const backupRaw = localStorage.getItem(backupKey);
      
      if (!backupRaw) {
        console.error(`❌ Backup ${backupId} no encontrado`);
        return false;
      }
      
      const backup = JSON.parse(backupRaw);
      let restored = 0;
      
      // Restaurar cada clave del backup
      Object.entries(backup.data).forEach(([key, value]) => {
        if (this.set(key, value, { backup: false, notify: false })) {
          restored++;
        }
      });
      
      console.log(`✅ Backup restaurado: ${restored} claves de ${backupId}`);
      
      // Notificar restauración completa
      this.notifyRestore(backupId, restored);
      
      return true;
    } catch (e) {
      console.error(`❌ Error restaurando backup ${backupId}:`, e);
      return false;
    }
  }

  /**
   * Lista todos los backups disponibles
   * @returns {Array} Lista de backups
   */
  listBackups() {
    const backups = [];
    const prefix = STORAGE_CONFIG.BACKUP_PREFIX;
    
    if (!this.isAvailable) return backups;
    
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(prefix)) {
          try {
            const backup = JSON.parse(localStorage.getItem(key));
            backups.push({
              id: backup.id,
              timestamp: backup.timestamp,
              type: backup.type,
              version: backup.version,
              keyCount: Object.keys(backup.data).length,
              date: new Date(backup.timestamp).toLocaleString()
            });
          } catch (e) {
            console.warn(`⚠️ Backup corrupto: ${key}`);
          }
        }
      });
      
      // Ordenar por timestamp (más reciente primero)
      backups.sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
      console.error('❌ Error listando backups:', e);
    }
    
    return backups;
  }

  cleanupOldBackups() {
    const backups = this.listBackups();
    const maxBackups = STORAGE_CONFIG.BACKUP.MAX_BACKUPS;
    
    if (backups.length > maxBackups) {
      const toDelete = backups.slice(maxBackups);
      toDelete.forEach(backup => {
        try {
          localStorage.removeItem(STORAGE_CONFIG.BACKUP_PREFIX + backup.id);
          console.log(`🗑️ Backup antiguo eliminado: ${backup.id}`);
        } catch (e) {
          console.warn(`⚠️ Error eliminando backup ${backup.id}:`, e);
        }
      });
    }
  }

  setupAutoBackup() {
    if (!this.isAvailable) return;
    
    setInterval(() => {
      const now = Date.now();
      const interval = STORAGE_CONFIG.BACKUP.AUTO_INTERVAL;
      
      if (now - this.lastBackup > interval) {
        this.createBackup();
      }
    }, 60000); // Verificar cada minuto
  }

  // === SISTEMA DE SINCRONIZACIÓN ===
  
  /**
   * Sincroniza datos con servidor remoto
   * @param {boolean} force - Forzar sincronización aunque esté en progreso
   * @returns {Promise<boolean>} True si se sincronizó correctamente
   */
  async sync(force = false) {
    if (!STORAGE_CONFIG.SYNC.ENABLED || !STORAGE_CONFIG.SYNC.ENDPOINT) {
      return false;
    }
    
    if (this.isSyncing && !force) {
      console.log('🔄 Sincronización ya en progreso');
      return false;
    }
    
    this.isSyncing = true;
    
    try {
      // Obtener datos a sincronizar
      const syncData = this.prepareSyncData();
      
      // Enviar al servidor
      const response = await this.sendToServer(syncData);
      
      if (response.success) {
        // Actualizar timestamp de última sincronización
        this.set('last_sync', Date.now(), { backup: false });
        
        // Limpiar cola de sincronización
        this.syncQueue = [];
        
        console.log('✅ Sincronización completada');
        return true;
      } else {
        console.error('❌ Error en sincronización:', response.error);
        return false;
      }
    } catch (e) {
      console.error('❌ Error de sincronización:', e);
      return false;
    } finally {
      this.isSyncing = false;
    }
  }

  prepareSyncData() {
    const syncableKeys = Object.values(STORAGE_CONFIG.KEYS).filter(key => 
      this.isSyncableKey(key)
    );
    
    const data = {};
    syncableKeys.forEach(key => {
      const value = this.get(key);
      if (value !== null) {
        data[key] = value;
      }
    });
    
    return {
      userId: this.get('worldcoin_address'),
      timestamp: Date.now(),
      version: this.get('game_version'),
      data,
      checksum: this.calculateChecksum(data)
    };
  }

  async sendToServer(data) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STORAGE_CONFIG.SYNC.TIMEOUT);
    
    try {
      const response = await fetch(STORAGE_CONFIG.SYNC.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getSyncToken()}`
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  addToSyncQueue(key, value) {
    this.syncQueue.push({
      key,
      value,
      timestamp: Date.now()
    });
    
    // Auto-sync si hay muchos cambios pendientes
    if (this.syncQueue.length > 10) {
      this.sync();
    }
  }

  // === OPERACIONES MASIVAS ===
  
  /**
   * Exporta todos los datos del juego
   * @param {boolean} includeBackups - Incluir backups en la exportación
   * @returns {Object} Datos exportados
   */
  exportData(includeBackups = false) {
    const data = {
      metadata: {
        exportDate: Date.now(),
        version: this.get('game_version'),
        gameData: {}
      }
    };
    
    // Exportar datos principales
    Object.values(STORAGE_CONFIG.KEYS).forEach(key => {
      const value = this.get(key);
      if (value !== null) {
        data.metadata.gameData[key] = value;
      }
    });
    
    // Incluir backups si se solicita
    if (includeBackups) {
      data.backups = this.listBackups().map(backup => ({
        ...backup,
        data: this.getBackupData(backup.id)
      }));
    }
    
    return data;
  }

  /**
   * Importa datos del juego
   * @param {Object} importData - Datos a importar
   * @param {boolean} merge - Si hacer merge o reemplazar completamente
   * @returns {boolean} True si se importó correctamente
   */
  importData(importData, merge = true) {
    try {
      if (!importData.metadata || !importData.metadata.gameData) {
        throw new Error('Formato de importación inválido');
      }
      
      const gameData = importData.metadata.gameData;
      let imported = 0;
      
      // Crear backup antes de importar
      const backupId = this.createBackup();
      
      Object.entries(gameData).forEach(([key, value]) => {
        if (merge && this.has(key)) {
          // En modo merge, solo sobrescribir si el dato importado es más reciente
          // o si es un tipo específico que siempre se debe actualizar
          if (this.shouldOverwriteOnMerge(key, value)) {
            if (this.set(key, value, { backup: false })) {
              imported++;
            }
          }
        } else {
          // Importación completa
          if (this.set(key, value, { backup: false })) {
            imported++;
          }
        }
      });
      
      console.log(`✅ Datos importados: ${imported} claves`);
      console.log(`💾 Backup de seguridad: ${backupId}`);
      
      return true;
    } catch (e) {
      console.error('❌ Error importando datos:', e);
      return false;
    }
  }

  /**
   * Limpia completamente el storage
   * @param {boolean} keepBackups - Mantener backups
   * @returns {boolean} True si se limpió correctamente
   */
  clearAll(keepBackups = true) {
    if (!confirm('¿Estás seguro de que quieres borrar todos los datos del juego?')) {
      return false;
    }
    
    try {
      // Crear backup final antes de limpiar
      const finalBackup = this.createBackup();
      
      const prefix = this.prefix;
      const backupPrefix = STORAGE_CONFIG.BACKUP_PREFIX;
      
      if (this.isAvailable) {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(prefix)) {
            if (!keepBackups || !key.startsWith(backupPrefix)) {
              localStorage.removeItem(key);
            }
          }
        });
      } else {
        this.fallbackStorage.clear();
      }
      
      console.log(`✅ Storage limpiado. Backup final: ${finalBackup}`);
      return true;
    } catch (e) {
      console.error('❌ Error limpiando storage:', e);
      return false;
    }
  }

  // === UTILIDADES ===
  
  isCriticalKey(key) {
    return STORAGE_CONFIG.BACKUP.CRITICAL_KEYS.includes(key);
  }

  isSyncableKey(key) {
    // No sincronizar datos temporales o sensibles
    const nonSyncable = ['session_id', 'last_played', 'temp_data'];
    return !nonSyncable.includes(key);
  }

  shouldCompress(data) {
    if (!STORAGE_CONFIG.COMPRESSION.ENABLED) return false;
    const size = JSON.stringify(data).length;
    return size > STORAGE_CONFIG.COMPRESSION.MIN_SIZE;
  }

  compressData(data) {
    // Implementación simple de compresión
    // En producción podrías usar una librería como pako
    return JSON.stringify(data);
  }

  encryptData(data) {
    // Implementación básica - en producción usar crypto real
    return btoa(JSON.stringify(data));
  }

  decryptData(encryptedData) {
    try {
      return JSON.parse(atob(encryptedData));
    } catch (e) {
      console.error('❌ Error desencriptando datos:', e);
      return null;
    }
  }

  calculateChecksum(data) {
    // Checksum simple para verificar integridad
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32-bit
    }
    return hash.toString(16);
  }

  getSyncToken() {
    // Token de sincronización - en producción debería ser más seguro
    return this.get('session_id') || 'anonymous';
  }

  shouldOverwriteOnMerge(key, value) {
    // Lógica para determinar si sobrescribir en merge
    const alwaysOverwrite = ['last_sync', 'session_id'];
    return alwaysOverwrite.includes(key);
  }

  getBackupData(backupId) {
    try {
      const backupKey = STORAGE_CONFIG.BACKUP_PREFIX + backupId;
      const backupRaw = localStorage.getItem(backupKey);
      if (backupRaw) {
        return JSON.parse(backupRaw).data;
      }
    } catch (e) {
      console.error(`❌ Error obteniendo datos de backup ${backupId}:`, e);
    }
    return null;
  }

  cleanupStorage() {
    // Lógica para limpiar espacio cuando el storage está lleno
    console.log('🧹 Limpiando storage por falta de espacio...');
    
    // 1. Limpiar datos temporales
    this.cleanupTempData();
    
    // 2. Eliminar backups más antiguos
    const backups = this.listBackups();
    if (backups.length > 2) {
      const toDelete = backups.slice(2);
      toDelete.forEach(backup => {
        localStorage.removeItem(STORAGE_CONFIG.BACKUP_PREFIX + backup.id);
      });
    }
    
    // 3. Comprimir datos grandes si no están comprimidos
    // Implementar según necesidad
  }

  // === SISTEMA DE EVENTOS ===
  
  /**
   * Registra un listener para cambios en el storage
   * @param {string} key - Clave a observar
   * @param {Function} callback - Función callback
   */
  addEventListener(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
  }

  /**
   * Remueve un listener
   * @param {string} key - Clave
   * @param {Function} callback - Callback a remover
   */
  removeEventListener(key, callback) {
    if (this.listeners.has(key)) {
      const callbacks = this.listeners.get(key);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  notifyChange(key, newValue) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => {
        try {
          callback(newValue, key);
        } catch (e) {
          console.error(`❌ Error en listener de ${key}:`, e);
        }
      });
    }
  }

  notifyRestore(backupId, restoredCount) {
    const event = {
      type: 'restore',
      backupId,
      restoredCount,
      timestamp: Date.now()
    };
    
    // Notificar a listeners generales
    if (this.listeners.has('restore')) {
      this.listeners.get('restore').forEach(callback => {
        callback(event);
      });
    }
  }

  // === MIGRACIÓN DE DATOS ===
  
  migrateData(fromVersion, toVersion) {
    console.log(`🔄 Migrando datos de ${fromVersion} a ${toVersion}`);
    
    // Crear backup antes de migrar
    const migrationBackup = this.createBackup();
    console.log(`💾 Backup de migración: ${migrationBackup}`);
    
    // Implementar lógicas específicas de migración según versiones
    if (fromVersion === '0.9.0' && toVersion === '1.0.0') {
      this.migrateFrom090To100();
    }
    
    console.log('✅ Migración completada');
  }

  migrateFrom090To100() {
    // Ejemplo de migración específica
    // Renombrar claves, convertir formatos, etc.
    
    // Si había 'gold' ahora es 'rbgp'
    const oldGold = this.get('gold');
    if (oldGold !== null) {
      this.set('rbgp', oldGold);
      this.remove('gold');
    }
    
    // Convertir formato de achievements si cambió
    const oldAchievements = this.get('achievements');
    if (oldAchievements && Array.isArray(oldAchievements)) {
      const newFormat = {};
      oldAchievements.forEach(achievement => {
        newFormat[achievement] = { unlocked: true, date: Date.now() };
      });
      this.set('achievements', newFormat);
    }
  }

  // === API DE DIAGNÓSTICO ===
  
  /**
   * Obtiene información de diagnóstico del storage
   * @returns {Object} Información de diagnóstico
   */
  getDiagnostics() {
    const diagnostics = {
      available: this.isAvailable,
      usage: this.getStorageUsage(),
      health: this.checkStorageHealth(),
      backups: this.listBackups(),
      syncStatus: {
        enabled: STORAGE_CONFIG.SYNC.ENABLED,
        lastSync: this.get('last_sync'),
        queueLength: this.syncQueue.length,
        inProgress: this.isSyncing
      },
      keys: this.getAllKeys(),
      errors: this.getRecentErrors()
    };
    
    return diagnostics;
  }

  getStorageUsage() {
    if (!this.isAvailable) return { used: 0, available: 0, total: 0 };
    
    try {
      // Calcular espacio usado
      let used = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }
      
      // Estimar espacio total (aproximación)
      const total = 5 * 1024 * 1024; // 5MB típico
      const available = total - used;
      
      return {
        used,
        available,
        total,
        usedPercent: Math.round((used / total) * 100),
        usedMB: +(used / (1024 * 1024)).toFixed(2),
        availableMB: +(available / (1024 * 1024)).toFixed(2)
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  checkStorageHealth() {
    const health = {
      status: 'healthy',
      issues: [],
      score: 100
    };
    
    try {
      // Verificar disponibilidad
      if (!this.isAvailable) {
        health.issues.push('Storage no disponible');
        health.score -= 50;
        health.status = 'critical';
      }
      
      // Verificar espacio
      const usage = this.getStorageUsage();
      if (usage.usedPercent > 90) {
        health.issues.push(`Espacio crítico: ${usage.usedPercent}%`);
        health.score -= 30;
        health.status = 'warning';
      }
      
      // Verificar integridad de datos críticos
      const criticalKeys = STORAGE_CONFIG.BACKUP.CRITICAL_KEYS;
      const missing = criticalKeys.filter(key => !this.has(key));
      if (missing.length > 0) {
        health.issues.push(`Datos críticos faltantes: ${missing.join(', ')}`);
        health.score -= 20;
        health.status = health.status === 'healthy' ? 'warning' : health.status;
      }
      
      // Verificar backups
      const backups = this.listBackups();
      if (backups.length === 0) {
        health.issues.push('Sin backups disponibles');
        health.score -= 10;
        health.status = health.status === 'healthy' ? 'warning' : health.status;
      }
      
      // Verificar última sincronización
      const lastSync = this.get('last_sync');
      if (STORAGE_CONFIG.SYNC.ENABLED && (!lastSync || Date.now() - lastSync > 86400000)) {
        health.issues.push('Sincronización desactualizada');
        health.score -= 5;
      }
      
    } catch (e) {
      health.issues.push(`Error de diagnóstico: ${e.message}`);
      health.score = 0;
      health.status = 'critical';
    }
    
    return health;
  }

  getAllKeys() {
    const keys = {
      game: [],
      backups: [],
      temp: [],
      other: []
    };
    
    if (!this.isAvailable) {
      Array.from(this.fallbackStorage.keys()).forEach(key => {
        this.categorizeKey(key, keys);
      });
    } else {
      Object.keys(localStorage).forEach(key => {
        this.categorizeKey(key, keys);
      });
    }
    
    return keys;
  }

  categorizeKey(key, categories) {
    if (key.startsWith(this.prefix)) {
      if (key.startsWith(STORAGE_CONFIG.BACKUP_PREFIX)) {
        categories.backups.push(key);
      } else if (key.startsWith(STORAGE_CONFIG.TEMP_PREFIX)) {
        categories.temp.push(key);
      } else {
        categories.game.push(key);
      }
    } else {
      categories.other.push(key);
    }
  }

  getRecentErrors() {
    // En una implementación real, mantendrías un log de errores
    return [];
  }

  // === HERRAMIENTAS DE DESARROLLO ===
  
  /**
   * Resetea el storage para desarrollo/testing
   */
  devReset() {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') {
      console.warn('⚠️ devReset solo disponible en desarrollo');
      return false;
    }
    
    console.log('🔧 Reset de desarrollo');
    this.clearAll(false);
    this.initializeMetadata();
    return true;
  }

  /**
   * Genera datos de prueba para desarrollo
   */
  devGenerateTestData() {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') {
      console.warn('⚠️ devGenerateTestData solo disponible en desarrollo');
      return false;
    }
    
    console.log('🧪 Generando datos de prueba');
    
    // Datos básicos
    this.set('wld', 10.5);
    this.set('rbgp', 1234.5678);
    this.set('energy', 75);
    this.set('combo_level', 3);
    this.set('combo_progress', { 1: 5, 2: 3, 3: 1, 4: 0 });
    this.set('total_taps', 987);
    this.set('total_earned', 5432.1);
    
    // Configuración
    this.set('username', 'TestPlayer');
    this.set('language', 'es');
    this.set('audio_volume', 0.8);
    
    // Features y logros
    this.set('unlocked_features', ['combos', 'rainbow_challenge']);
    this.set('achievements', {
      first_combo: { unlocked: true, date: Date.now() - 86400000 },
      energy_master: { unlocked: false }
    });
    
    // Ideas & Polls
    this.set('poll_votes', { A: 10, B: 15, C: 8 });
    this.set('suggestions_sent', ['Mejor audio', 'Más colores']);
    
    console.log('✅ Datos de prueba generados');
    return true;
  }

  /**
   * Simula errores para testing
   */
  devSimulateError(errorType) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'development') {
      console.warn('⚠️ devSimulateError solo disponible en desarrollo');
      return false;
    }
    
    switch (errorType) {
      case 'quota':
        // Simular storage lleno
        this.isAvailable = false;
        setTimeout(() => { this.isAvailable = true; }, 5000);
        break;
      case 'corruption':
        // Corromper un dato
        if (this.isAvailable) {
          localStorage.setItem(this.prefix + 'rbgp', 'datos_corruptos');
        }
        break;
      case 'sync_failure':
        // Simular fallo de sincronización
        STORAGE_CONFIG.SYNC.ENDPOINT = 'https://invalid-endpoint.test';
        break;
    }
    
    console.log(`🧪 Error simulado: ${errorType}`);
    return true;
  }
}

// === INSTANCIA SINGLETON ===
let storageManagerInstance = null;

/**
 * Inicializa el sistema de storage
 * @param {Object} config - Configuración personalizada
 * @returns {StorageManager} Instancia del storage manager
 */
export function initStorageManager(config = {}) {
  if (!storageManagerInstance) {
    // Aplicar configuración personalizada
    Object.assign(STORAGE_CONFIG, config);
    storageManagerInstance = new StorageManager();
  }
  
  return storageManagerInstance;
}

/**
 * Obtiene la instancia actual del storage manager
 */
export function getStorageManager() {
  if (!storageManagerInstance) {
    console.warn('⚠️ StorageManager no inicializado, creando instancia por defecto');
    return initStorageManager();
  }
  return storageManagerInstance;
}

/**
 * API simplificada para uso rápido
 */
export const StorageAPI = {
  // Operaciones básicas
  get: (key, defaultValue) => getStorageManager().get(key, defaultValue),
  set: (key, value, options) => getStorageManager().set(key, value, options),
  remove: (key) => getStorageManager().remove(key),
  has: (key) => getStorageManager().has(key),
  
  // Backups
  createBackup: (key, value) => getStorageManager().createBackup(key, value),
  restoreBackup: (backupId) => getStorageManager().restoreBackup(backupId),
  listBackups: () => getStorageManager().listBackups(),
  
  // Sincronización
  sync: (force) => getStorageManager().sync(force),
  
  // Operaciones masivas
  exportData: (includeBackups) => getStorageManager().exportData(includeBackups),
  importData: (data, merge) => getStorageManager().importData(data, merge),
  clearAll: (keepBackups) => getStorageManager().clearAll(keepBackups),
  
  // Diagnóstico
  getDiagnostics: () => getStorageManager().getDiagnostics(),
  
  // Eventos
  addEventListener: (key, callback) => getStorageManager().addEventListener(key, callback),
  removeEventListener: (key, callback) => getStorageManager().removeEventListener(key, callback),
  
  // Desarrollo (solo en dev mode)
  dev: {
    reset: () => getStorageManager().devReset(),
    generateTestData: () => getStorageManager().devGenerateTestData(),
    simulateError: (type) => getStorageManager().devSimulateError(type)
  }
};

// === CONFIGURACIÓN EXPORTADA ===
export const STORAGE_SETTINGS = STORAGE_CONFIG;
export const DATA_VALIDATORS_EXPORT = DATA_VALIDATORS;

// === UTILIDADES PARA INTEGRACIÓN ===

/**
 * Wrapper para compatibilidad con localStorage directo
 */
export const LegacyStorageAPI = {
  getItem: (key) => StorageAPI.get(key),
  setItem: (key, value) => StorageAPI.set(key, value),
  removeItem: (key) => StorageAPI.remove(key),
  clear: () => StorageAPI.clearAll(false)
};

/**
 * Hook para React (si se usa en el futuro)
 */
export function useStorage(key, defaultValue = null) {
  const [value, setValue] = useState(StorageAPI.get(key, defaultValue));
  
  useEffect(() => {
    const callback = (newValue) => setValue(newValue);
    StorageAPI.addEventListener(key, callback);
    return () => StorageAPI.removeEventListener(key, callback);
  }, [key]);
  
  const setStorageValue = useCallback((newValue) => {
    StorageAPI.set(key, newValue);
  }, [key]);
  
  return [value, setStorageValue];
}

// === EXPORTACIÓN PRINCIPAL ===
export default {
  StorageManager,
  initStorageManager,
  getStorageManager,
  StorageAPI,
  LegacyStorageAPI,
  STORAGE_SETTINGS,
  DATA_VALIDATORS_EXPORT,
  useStorage
};