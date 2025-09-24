/**
 * RainbowGold-Tap: Local Storage Manager
 * Maneja toda la persistencia del juego de forma centralizada
 */

// === CONSTANTES DE STORAGE ===
const STORAGE_KEYS = {
  // Core game state
  WLD: 'wld',
  RBGP: 'rbgp', 
  ENERGY: 'energy',
  LAST_TS: 'last_ts',
  
  // User preferences
  USERNAME: 'wg_username',
  LANGUAGE: 'wg_language',
  
  // Combo system
  COMBO_LEVEL: 'combo_level',
  COMBO_PROGRESS: 'combo_progress',
  
  // Challenge state
  RAINBOW_COMPLETED: 'rainbow_completed',
  
  // Ideas system
  IDEAS_VOTES: 'wg_votes',
  IDEAS_SUGGESTIONS: 'wg_suggestions',
  
  // Inbox messages
  INBOX_MESSAGES: 'wg_inbox_messages',
  INBOX_UNREAD: 'wg_inbox_unread'
};

// === DEFAULTS ===
const DEFAULTS = {
  wld: 0,
  rbgp: 0,
  energy: 100, // BASE_CAP del juego
  username: '',
  language: 'es',
  combo_level: 0,
  combo_progress: {1:0, 2:0, 3:0, 4:0},
  votes: {A:0, B:0, C:0},
  suggestions: [],
  messages: [],
  unread_count: 0
};

// === CORE STORAGE FUNCTIONS ===

/**
 * Get item from localStorage with fallback
 */
function getStorageItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item !== null ? item : defaultValue;
  } catch (e) {
    console.warn(`Error reading localStorage key ${key}:`, e);
    return defaultValue;
  }
}

/**
 * Set item in localStorage safely
 */
function setStorageItem(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch (e) {
    console.warn(`Error writing localStorage key ${key}:`, e);
    return false;
  }
}

/**
 * Get JSON object from localStorage
 */
function getStorageJSON(key, defaultValue = {}) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.warn(`Error parsing JSON from localStorage key ${key}:`, e);
    return defaultValue;
  }
}

/**
 * Set JSON object in localStorage
 */
function setStorageJSON(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
    return true;
  } catch (e) {
    console.warn(`Error storing JSON to localStorage key ${key}:`, e);
    return false;
  }
}

// === GAME STATE MANAGEMENT ===

/**
 * Load core game state (WLD, RBGp, Energy)
 */
function loadGameState() {
  return {
    wld: parseFloat(getStorageItem(STORAGE_KEYS.WLD, DEFAULTS.wld)) || 0,
    rbgp: parseFloat(getStorageItem(STORAGE_KEYS.RBGP, DEFAULTS.rbgp)) || 0,
    energy: parseFloat(getStorageItem(STORAGE_KEYS.ENERGY, DEFAULTS.energy)) || 100,
    lastTs: parseInt(getStorageItem(STORAGE_KEYS.LAST_TS, Date.now())) || Date.now()
  };
}

/**
 * Save core game state
 */
function saveGameState(state) {
  const success = [
    setStorageItem(STORAGE_KEYS.WLD, state.wld || 0),
    setStorageItem(STORAGE_KEYS.RBGP, state.rbgp || 0), 
    setStorageItem(STORAGE_KEYS.ENERGY, state.energy || 0),
    setStorageItem(STORAGE_KEYS.LAST_TS, state.lastTs || Date.now())
  ].every(Boolean);
  
  return success;
}

/**
 * Update single game value (for frequent updates like tap gains)
 */
function updateGameValue(key, value) {
  if (!STORAGE_KEYS.hasOwnProperty(key.toUpperCase())) {
    console.warn(`Unknown game value key: ${key}`);
    return false;
  }
  return setStorageItem(STORAGE_KEYS[key.toUpperCase()], value);
}

// === ENERGY MANAGEMENT ===

/**
 * Lazy energy regeneration (extraído de tu lazyRegen())
 * Actualiza energía basada en tiempo transcurrido
 */
function regenEnergy(currentEnergy, lastTimestamp, regenPerSec = 0.5, maxCap = 100, noEnergyUntil = 0) {
  const now = Date.now();
  
  // Pausa regeneración si está en cooldown
  if (performance.now() < (noEnergyUntil || 0)) {
    // Reset timestamp para no acumular dt
    setStorageItem(STORAGE_KEYS.LAST_TS, now);
    return { energy: currentEnergy, lastTs: now };
  }

  const dt = (now - lastTimestamp) / 1000;
  const newEnergy = Math.min(maxCap, currentEnergy + regenPerSec * dt);
  
  // Save updated values
  setStorageItem(STORAGE_KEYS.ENERGY, newEnergy);
  setStorageItem(STORAGE_KEYS.LAST_TS, now);
  
  return { energy: newEnergy, lastTs: now };
}

/**
 * Consume energy (for taps)
 */
function consumeEnergy(amount = 1) {
  const currentEnergy = parseFloat(getStorageItem(STORAGE_KEYS.ENERGY, 100));
  const newEnergy = Math.max(0, currentEnergy - amount);
  setStorageItem(STORAGE_KEYS.ENERGY, newEnergy);
  return newEnergy;
}

/**
 * Refill energy to max
 */
function refillEnergy(maxCap = 100) {
  setStorageItem(STORAGE_KEYS.ENERGY, maxCap);
  return maxCap;
}

// === USER PREFERENCES ===

/**
 * Load user preferences
 */
function loadUserPrefs() {
  return {
    username: getStorageItem(STORAGE_KEYS.USERNAME, DEFAULTS.username),
    language: getStorageItem(STORAGE_KEYS.LANGUAGE, DEFAULTS.language)
  };
}

/**
 * Save user preferences
 */
function saveUserPrefs(prefs) {
  const success = [
    setStorageItem(STORAGE_KEYS.USERNAME, prefs.username || ''),
    setStorageItem(STORAGE_KEYS.LANGUAGE, prefs.language || 'es')
  ].every(Boolean);
  
  return success;
}

// === COMBO SYSTEM ===

/**
 * Load combo progress
 */
function loadComboState() {
  return {
    level: parseInt(getStorageItem(STORAGE_KEYS.COMBO_LEVEL, 0)) || 0,
    progress: getStorageJSON(STORAGE_KEYS.COMBO_PROGRESS, DEFAULTS.combo_progress)
  };
}

/**
 * Save combo progress
 */
function saveComboState(level, progress) {
  const success = [
    setStorageItem(STORAGE_KEYS.COMBO_LEVEL, level || 0),
    setStorageJSON(STORAGE_KEYS.COMBO_PROGRESS, progress || DEFAULTS.combo_progress)
  ].every(Boolean);
  
  return success;
}

/**
 * Reset combo state (after frenzy or failure)
 */
function resetComboState() {
  return saveComboState(0, DEFAULTS.combo_progress);
}

// === CHALLENGE SYSTEM ===

/**
 * Mark rainbow challenge as completed
 */
function setRainbowCompleted(completed = true) {
  return setStorageItem(STORAGE_KEYS.RAINBOW_COMPLETED, completed ? '1' : '0');
}

/**
 * Check if rainbow challenge was completed
 */
function isRainbowCompleted() {
  return getStorageItem(STORAGE_KEYS.RAINBOW_COMPLETED, '0') === '1';
}

// === IDEAS SYSTEM ===

/**
 * Load voting results
 */
function loadVotes() {
  return getStorageJSON(STORAGE_KEYS.IDEAS_VOTES, DEFAULTS.votes);
}

/**
 * Save voting results
 */
function saveVotes(votes) {
  return setStorageJSON(STORAGE_KEYS.IDEAS_VOTES, votes || DEFAULTS.votes);
}

/**
 * Add a vote to option
 */
function addVote(option) {
  const votes = loadVotes();
  if (votes.hasOwnProperty(option)) {
    votes[option]++;
    return saveVotes(votes);
  }
  return false;
}

/**
 * Load user suggestions
 */
function loadSuggestions() {
  return getStorageJSON(STORAGE_KEYS.IDEAS_SUGGESTIONS, DEFAULTS.suggestions);
}

/**
 * Add new suggestion
 */
function addSuggestion(text, timestamp = null) {
  const suggestions = loadSuggestions();
  const suggestion = {
    id: Date.now(),
    text: text.trim(),
    timestamp: timestamp || new Date().toISOString(),
    status: 'pending'
  };
  
  suggestions.push(suggestion);
  return setStorageJSON(STORAGE_KEYS.IDEAS_SUGGESTIONS, suggestions);
}

// === INBOX SYSTEM ===

/**
 * Load inbox messages
 */
function loadMessages() {
  return getStorageJSON(STORAGE_KEYS.INBOX_MESSAGES, DEFAULTS.messages);
}

/**
 * Add new message to inbox
 */
function addMessage(message) {
  const messages = loadMessages();
  const msg = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    read: false,
    ...message
  };
  
  messages.unshift(msg); // Add to beginning
  
  // Keep only last 50 messages
  if (messages.length > 50) {
    messages.splice(50);
  }
  
  setStorageJSON(STORAGE_KEYS.INBOX_MESSAGES, messages);
  updateUnreadCount();
  
  return msg;
}

/**
 * Mark message as read
 */
function markMessageRead(messageId) {
  const messages = loadMessages();
  const msg = messages.find(m => m.id === messageId);
  
  if (msg && !msg.read) {
    msg.read = true;
    setStorageJSON(STORAGE_KEYS.INBOX_MESSAGES, messages);
    updateUnreadCount();
    return true;
  }
  
  return false;
}

/**
 * Mark all messages as read
 */
function markAllMessagesRead() {
  const messages = loadMessages();
  let changed = false;
  
  messages.forEach(msg => {
    if (!msg.read) {
      msg.read = true;
      changed = true;
    }
  });
  
  if (changed) {
    setStorageJSON(STORAGE_KEYS.INBOX_MESSAGES, messages);
    updateUnreadCount();
  }
  
  return changed;
}

/**
 * Update unread message count
 */
function updateUnreadCount() {
  const messages = loadMessages();
  const unreadCount = messages.filter(m => !m.read).length;
  setStorageItem(STORAGE_KEYS.INBOX_UNREAD, unreadCount);
  return unreadCount;
}

/**
 * Get unread message count
 */
function getUnreadCount() {
  return parseInt(getStorageItem(STORAGE_KEYS.INBOX_UNREAD, 0)) || 0;
}

// === UTILITY FUNCTIONS ===

/**
 * Clear all game data (reset)
 */
function clearGameData() {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (e) {
    console.error('Error clearing game data:', e);
    return false;
  }
}

/**
 * Export all game data for backup
 */
function exportGameData() {
  const data = {};
  
  Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
    const value = localStorage.getItem(key);
    if (value !== null) {
      data[name] = value;
    }
  });
  
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    data
  };
}

/**
 * Import game data from backup
 */
function importGameData(backup) {
  try {
    if (!backup.data || !backup.version) {
      throw new Error('Invalid backup format');
    }
    
    Object.entries(backup.data).forEach(([name, value]) => {
      const key = STORAGE_KEYS[name];
      if (key) {
        localStorage.setItem(key, value);
      }
    });
    
    return true;
  } catch (e) {
    console.error('Error importing game data:', e);
    return false;
  }
}

/**
 * Get storage usage info
 */
function getStorageInfo() {
  const used = JSON.stringify(localStorage).length;
  const quota = 1024 * 1024 * 5; // ~5MB typical limit
  
  return {
    used,
    quota,
    percentage: Math.round((used / quota) * 100),
    available: quota - used
  };
}

// === EXPORTS ===
// Para uso como módulo ES6 o en el contexto global

if (typeof module !== 'undefined' && module.exports) {
  // Node.js / CommonJS
  module.exports = {
    // Core functions
    loadGameState,
    saveGameState,
    updateGameValue,
    
    // Energy management
    regenEnergy,
    consumeEnergy,
    refillEnergy,
    
    // User preferences
    loadUserPrefs,
    saveUserPrefs,
    
    // Combo system
    loadComboState,
    saveComboState,
    resetComboState,
    
    // Challenge system
    setRainbowCompleted,
    isRainbowCompleted,
    
    // Ideas system
    loadVotes,
    saveVotes,
    addVote,
    loadSuggestions,
    addSuggestion,
    
    // Inbox system
    loadMessages,
    addMessage,
    markMessageRead,
    markAllMessagesRead,
    getUnreadCount,
    
    // Utility
    clearGameData,
    exportGameData,
    importGameData,
    getStorageInfo,
    
    // Constants
    STORAGE_KEYS,
    DEFAULTS
  };
} else {
  // Browser / Global scope
  window.GameStorage = {
    // Core functions
    loadGameState,
    saveGameState,
    updateGameValue,
    
    // Energy management
    regenEnergy,
    consumeEnergy,
    refillEnergy,
    
    // User preferences
    loadUserPrefs,
    saveUserPrefs,
    
    // Combo system
    loadComboState,
    saveComboState,
    resetComboState,
    
    // Challenge system
    setRainbowCompleted,
    isRainbowCompleted,
    
    // Ideas system
    loadVotes,
    saveVotes,
    addVote,
    loadSuggestions,
    addSuggestion,
    
    // Inbox system
    loadMessages,
    addMessage,
    markMessageRead,
    markAllMessagesRead,
    getUnreadCount,
    
    // Utility
    clearGameData,
    exportGameData,
    importGameData,
    getStorageInfo,
    
    // Constants
    STORAGE_KEYS,
    DEFAULTS
  };
}