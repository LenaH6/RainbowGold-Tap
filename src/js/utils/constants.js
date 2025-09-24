/**
 * CONSTANTS - RainbowGold Tap
 * Configuración central del juego, valores editables y constantes del sistema
 */

// === GAME CORE CONSTANTS ===

/**
 * Base del sistema económico
 */
const GAME_ECONOMY = {
  POWER_BASE: 0.1000,           // RBGp base por tap
  BASE_CAP: 100,                // Capacidad base de energía
  BASE_REGEN_PER_SEC: 0.5,      // Regeneración por segundo
  GAIN_DECIMALS: 4              // Decimales en números flotantes
};

/**
 * Sistema de energía
 */
const ENERGY_SYSTEM = {
  LOW_THRESHOLD: 50,            // Umbral para energía "baja" (0-100)
  COOLDOWN_MS: 2000,            // Cooldown sin energía (ms)
  REFILL_PERCENTAGE: 0.001      // % del cap para precio refill (0.1%)
};

// === COMBO SYSTEM CONFIGURATION ===

/**
 * Bonificaciones por nivel de combo (% sobre POWER_BASE)
 */
const COMBO_BONUS = {
  1: 0.025,     // X1: +2.5%
  2: 0.030,     // X2: +3.0%
  3: 0.035,     // X3: +3.5%
  4: 0.040,     // X4: +4.0%
  5: 0.045      // X5: +4.5%
};

/**
 * Duración de ventanas de combo (ms)
 */
const COMBO_WINDOW_MS = {
  1: 700,       // X1: 0.7s
  2: 1200,      // X2: 1.2s
  3: 1600,      // X3: 1.6s
  4: 2000,      // X4: 2.0s
  5: 2400       // X5: 2.4s
};

/**
 * Ventanas completas necesarias para avanzar
 */
const COMBO_ADVANCE_REQ = {
  1: 3,         // X1 → X2: 3 ventanas
  2: 2,         // X2 → X3: 2 ventanas
  3: 2,         // X3 → X4: 2 ventanas
  4: 2          // X4 → X5: 2 ventanas
  // X5 → RAINBOW CHALLENGE (sin requisito numérico)
};

/**
 * Rangos de spawning por taps [min, max]
 */
const COMBO_SPAWN_TAPS = {
  1: [7, 12],   // X1: cada 7-12 taps
  2: [9, 14],   // X2: cada 9-14 taps
  3: [10, 15],  // X3: cada 10-15 taps
  4: [12, 18],  // X4: cada 12-18 taps
  5: [14, 20]   // X5: cada 14-20 taps
};

/**
 * Duración del Frenzy (ms)
 */
const FRENZY_DURATION_MS = 5500;

/**
 * Probabilidad de spawn de decoy (0-1)
 */
const DECOY_CHANCE = 0.25;

/**
 * Usar sistema de spawn por TAP (vs por tiempo)
 */
const USE_TAP_SPAWN = true;

// === RAINBOW CHALLENGE CONFIGURATION ===

/**
 * Configuración del desafío arcoíris
 */
const RAINBOW_CHALLENGE = {
  HITS_REQUIRED: 6,             // Toques necesarios para completar
  DECOY_CHANCE: 0.45,           // Probabilidad de distractor (0-1)
  APPEAR_MS: [2500, 3200],      // Tiempo visible de cada mancha [min, max]
  TOTAL_DURATION_MS: 12000,     // Tiempo máximo total del desafío
  FRENZY_BONUS: 0.05            // Bonus extra en Frenzy (5% sobre POWER_BASE)
};

// === HOTSPOT SYSTEM CONFIGURATION ===

/**
 * Configuración de aparición de manchas (modo tiempo)
 */
const HOTSPOT_TIMING = {
  SHOW_MS: 1600,                // Tiempo visible (ms)
  COOLDOWN_MIN_MS: 2800,        // Cooldown mínimo entre apariciones
  COOLDOWN_MAX_MS: 4400         // Cooldown máximo entre apariciones
};

/**
 * Rangos de aparición por nivel y tipo (ms)
 */
const HOTSPOT_APPEAR_MS = {
  1: [1600, 2400],      // X1
  2: [1400, 2000],      // X2
  3: [1100, 1600],      // X3
  4: [900, 1300],       // X4
  5: [700, 1000],       // X5
  decoy: [650, 900]     // Decoys
};

// === VISUAL CONFIGURATION ===

/**
 * Configuración visual de hotspots por skin
 */
const HOTSPOT_SKINS = {
  x1: { 
    colors: ['#FFD872', '#8a6b1f'], 
    coreRadius: 10, 
    glowRadius: 18 
  },
  x2: { 
    colors: ['#9CFF70', '#3f8f33'], 
    coreRadius: 9, 
    glowRadius: 16 
  },
  x3: { 
    colors: ['#6AE1FF', '#2b93b8'], 
    coreRadius: 8, 
    glowRadius: 14 
  },
  x4: { 
    colors: ['#D08BFF', '#7d3ca3'], 
    coreRadius: 7, 
    glowRadius: 12 
  },
  x5: { 
    colors: ['#FF6A6A', '#a83232'], 
    coreRadius: 6, 
    glowRadius: 10 
  },
  decoy: { 
    colors: ['#A0A6FF', '#4b4fa0'], 
    coreRadius: 9, 
    glowRadius: 14 
  },
  rainbow: { 
    colors: ['#7aa0ff', '#aa66ff'], 
    coreRadius: 9, 
    glowRadius: 16 
  }
};

/**
 * Colores de nivel para arcos y UI
 */
const LEVEL_COLORS = {
  1: '#FFD872',         // Dorado
  2: '#9CFF70',         // Verde
  3: '#6AE1FF',         // Azul cyan
  4: '#D08BFF',         // Morado
  5: '#FF6A6A'          // Rojo
};

// === PRICING CONFIGURATION ===

/**
 * Precios del sistema (en WLD)
 */
const PRICING = {
  IDEAS_TICKET: 1.0,            // Precio del ticket de ideas
  ENERGY_REFILL_MULTIPLIER: 0.001  // Multiplicador para refill (cap * multiplier)
};

// === ANIMATION TIMING ===

/**
 * Duraciones de animaciones (ms)
 */
const ANIMATION_DURATIONS = {
  GAIN_FLOAT: 2400,             // Duración números flotantes
  LABEL_POP: 1600,              // Duración labels tipo "X5"
  DRAWER_OPEN: 280,             // Duración apertura drawer
  SPLASH_HIDE: 360,             // Duración ocultar splash
  COIN_FLASH: 220,              // Duración flash moneda
  REFILL_PULSE: 1100,           // Duración pulso refill
  ACTIVITY_FLOW: 3200,          // Duración flow de actividad
  ARC_FLASH: 140                // Duración flash del arco
};

/**
 * Easing curves predefinidas
 */
const EASING_CURVES = {
  SMOOTH: 'cubic-bezier(.18,.9,.22,1)',
  BOUNCE: 'cubic-bezier(.25,1,.3,1)',
  SHARP: 'cubic-bezier(.22,1,.36,1)',
  ELASTIC: 'cubic-bezier(.68,-0.55,.265,1.55)'
};

// === AUDIO CONFIGURATION ===

/**
 * Configuración de audio
 */
const AUDIO_CONFIG = {
  MASTER_VOLUME: 1.0,           // Volumen maestro
  DEFAULT_VOLUME: 0.8,          // Volumen por defecto
  TICK_THROTTLE_MS: 45,         // Throttle para sonido tick
  CONTEXT_LATENCY: 'interactive' // Latencia del AudioContext
};

/**
 * Manifest de archivos de audio
 */
const AUDIO_MANIFEST = {
  nice: 'snd/nice.mp3',
  rainbow: 'snd/rainbow_race.mp3',
  freeze: 'snd/freeze.mp3',
  laugh: 'snd/laugh.mp3',
  slot: 'snd/slot_loop.mp3',
  tension: 'snd/tension_loop.mp3',
  tick: 'snd/tick.mp3',
  join: 'snd/join.mp3'
};

// === UI CONSTANTS ===

/**
 * Configuración de la interfaz
 */
const UI_CONFIG = {
  MAX_GAIN_POOL: 10,            // Máximo elementos en pool de ganancias
  INBOX_BADGE_MAX: 99,          // Máximo número en badge antes de "99+"
  ACTIVITY_QUEUE_MAX: 5,        // Máximo items en cola de actividad
  TOOLTIP_DELAY_MS: 2000,       // Delay para ocultar tooltips en touch
  DRAWER_ANIMATION_STEPS: 10    // Pasos de animación escalonada en drawers
};

/**
 * Breakpoints responsive
 */
const BREAKPOINTS = {
  MOBILE: 768,                  // Ancho máximo para móvil
  SMALL_MOBILE: 480,            // Móviles pequeños
  NARROW: 360                   // Pantallas muy estrechas
};

// === DEVELOPMENT CONFIGURATION ===

/**
 * Configuración de desarrollo
 */
const DEV_CONFIG = {
  ENABLE_LOGGING: true,         // Habilitar logs en desarrollo
  SKIP_SPLASH_SHORTCUT: 'KeyS', // Tecla para saltar splash (Ctrl+S)
  SHOW_DEBUG_INFO: false,       // Mostrar info de debug
  MOCK_WORLDID: true           // Usar mock de WorldID en desarrollo
};

// === STORAGE KEYS ===

/**
 * Claves de localStorage
 */
const STORAGE_KEYS = {
  WLD_BALANCE: 'wld',
  RBGP_BALANCE: 'rbgp',
  ENERGY: 'energy',
  LAST_TIMESTAMP: 'last_ts',
  LANGUAGE: 'wg_language',
  USERNAME: 'wg_username',
  VOTES: 'wg_votes',
  SETTINGS: 'wg_settings',
  STATS: 'wg_stats'
};

// === VALIDATION CONSTANTS ===

/**
 * Límites de validación
 */
const VALIDATION_LIMITS = {
  USERNAME_MIN_LENGTH: 2,
  USERNAME_MAX_LENGTH: 20,
  SUGGESTION_MAX_CHARS: 400,
  IDEAS_TICKET_TIMEOUT_MS: 300000, // 5 minutos
  MAX_ENERGY_REFILLS_PER_HOUR: 10
};

// === SEASONAL/EVENT CONSTANTS ===

/**
 * Configuración de eventos especiales
 */
const SEASONAL_CONFIG = {
  WINTER_MULTIPLIER: 1.1,       // Multiplicador de invierno (+10%)
  HOLIDAY_BONUS_DAYS: [25, 1],  // Días con bonus (dic 25, ene 1)
  EVENT_DURATION_DAYS: 7,       // Duración típica de eventos
  SPECIAL_HOTSPOT_CHANCE: 0.05  // Probabilidad de hotspots especiales
};

// === WORLD ID / AUTHENTICATION ===

/**
 * Configuración de WorldID y autenticación
 */
const AUTH_CONFIG = {
  WORLDID_APP_ID: 'app_staging_YOUR_APP_ID', // Reemplazar con tu App ID
  SIWE_DOMAIN: 'rainbowgold.app',            // Tu dominio
  SESSION_TIMEOUT_MS: 86400000,              // 24 horas
  AUTO_REFRESH_BEFORE_MS: 3600000           // Refresh 1 hora antes de expirar
};

// === PERFORMANCE CONSTANTS ===

/**
 * Configuración de performance
 */
const PERFORMANCE_CONFIG = {
  RAF_BUDGET_MS: 16,            // Budget por frame (60fps)
  IDLE_CALLBACK_TIMEOUT_MS: 1500, // Timeout para requestIdleCallback
  MAX_CONCURRENT_ANIMATIONS: 5, // Máximo animaciones simultáneas
  THROTTLE_RESIZE_MS: 250,      // Throttle para eventos de resize
  DEBOUNCE_INPUT_MS: 300        // Debounce para inputs de usuario
};

// === FEATURE FLAGS ===

/**
 * Flags para habilitar/deshabilitar funcionalidades
 */
const FEATURE_FLAGS = {
  ENABLE_IDEAS_SYSTEM: true,
  ENABLE_POLLS: true,
  ENABLE_SUGGESTIONS: true,
  ENABLE_LEADERBOARD: false,    // Próximamente
  ENABLE_ACHIEVEMENTS: false,   // Próximamente
  ENABLE_SOCIAL_FEATURES: false, // Próximamente
  ENABLE_NFT_REWARDS: false,    // Futuro
  ENABLE_ANALYTICS: true
};

// === EXPORT INDIVIDUAL CONSTANTS ===

// Para compatibilidad con código existente que usa variables directas
window.POWER_BASE = GAME_ECONOMY.POWER_BASE;
window.BASE_CAP = GAME_ECONOMY.BASE_CAP;
window.BASE_REGEN_PER_SEC = GAME_ECONOMY.BASE_REGEN_PER_SEC;
window.GAIN_DECIMALS = GAME_ECONOMY.GAIN_DECIMALS;

window.BONUS = COMBO_BONUS;
window.WINDOW_MS = COMBO_WINDOW_MS;
window.ADV_REQ = COMBO_ADVANCE_REQ;
window.SPAWN_TAPS = COMBO_SPAWN_TAPS;
window.FRENZY_MS = FRENZY_DURATION_MS;
window.DECOY_CHANCE = DECOY_CHANCE;
window.USE_TAP_SPAWN = USE_TAP_SPAWN;

window.RAINBOW = RAINBOW_CHALLENGE;
window.LOW_ENERGY_THRESHOLD = ENERGY_SYSTEM.LOW_THRESHOLD;
window.APPEAR_MS = HOTSPOT_APPEAR_MS;
window.HOT_SHOW_MS = HOTSPOT_TIMING.SHOW_MS;
window.HOT_CD_MIN = HOTSPOT_TIMING.COOLDOWN_MIN_MS;
window.HOT_CD_MAX = HOTSPOT_TIMING.COOLDOWN_MAX_MS;

// === EXPORT GROUPED CONSTANTS ===

window.GAME_CONSTANTS = {
  GAME_ECONOMY,
  ENERGY_SYSTEM,
  COMBO_BONUS,
  COMBO_WINDOW_MS,
  COMBO_ADVANCE_REQ,
  COMBO_SPAWN_TAPS,
  FRENZY_DURATION_MS,
  DECOY_CHANCE,
  USE_TAP_SPAWN,
  RAINBOW_CHALLENGE,
  HOTSPOT_TIMING,
  HOTSPOT_APPEAR_MS,
  HOTSPOT_SKINS,
  LEVEL_COLORS,
  PRICING,
  ANIMATION_DURATIONS,
  EASING_CURVES,
  AUDIO_CONFIG,
  AUDIO_MANIFEST,
  UI_CONFIG,
  BREAKPOINTS,
  DEV_CONFIG,
  STORAGE_KEYS,
  VALIDATION_LIMITS,
  SEASONAL_CONFIG,
  AUTH_CONFIG,
  PERFORMANCE_CONFIG,
  FEATURE_FLAGS
};

// === CONFIGURATION HELPERS ===

/**
 * Obtiene configuración por ambiente
 * @param {string} env - 'development' | 'staging' | 'production'
 * @returns {Object}
 */
function getConfigForEnvironment(env) {
  const baseConfig = { ...GAME_CONSTANTS };
  
  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        DEV_CONFIG: {
          ...DEV_CONFIG,
          ENABLE_LOGGING: true,
          SHOW_DEBUG_INFO: true,
          MOCK_WORLDID: true
        }
      };
      
    case 'staging':
      return {
        ...baseConfig,
        AUTH_CONFIG: {
          ...AUTH_CONFIG,
          WORLDID_APP_ID: 'app_staging_YOUR_STAGING_ID'
        }
      };
      
    case 'production':
      return {
        ...baseConfig,
        DEV_CONFIG: {
          ...DEV_CONFIG,
          ENABLE_LOGGING: false,
          SHOW_DEBUG_INFO: false,
          MOCK_WORLDID: false
        },
        AUTH_CONFIG: {
          ...AUTH_CONFIG,
          WORLDID_APP_ID: 'app_YOUR_PRODUCTION_ID'
        }
      };
      
    default:
      return baseConfig;
  }
}

/**
 * Valida configuración crítica
 * @returns {boolean}
 */
function validateConfig() {
  const critical = [
    GAME_ECONOMY.POWER_BASE > 0,
    COMBO_BONUS[1] > 0,
    RAINBOW_CHALLENGE.HITS_REQUIRED > 0,
    FRENZY_DURATION_MS > 0
  ];
  
  return critical.every(Boolean);
}

// Export helpers
window.getConfigForEnvironment = getConfigForEnvironment;
window.validateConfig = validateConfig;

// === CONSOLE INFO ===
if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
  console.log('⚙️ Game constants loaded');
  console.log('🎮 Economy:', GAME_ECONOMY);
  console.log('🌈 Combo System:', { COMBO_BONUS, COMBO_WINDOW_MS });
  console.log('✨ Rainbow Challenge:', RAINBOW_CHALLENGE);
  
  if (!validateConfig()) {
    console.warn('⚠️ Configuration validation failed!');
  }
}