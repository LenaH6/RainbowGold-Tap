/**
 * I18N COMPONENT - RainbowGold Tap
 * Sistema de internacionalización ES/EN con detección automática
 */

// === I18N STATE ===
let currentLang = 'es'; // idioma por defecto
let translations = {};
let langChangeCallbacks = [];

// === TRANSLATIONS DATABASE ===
const TRANSLATIONS = {
  es: {
    // Splash & Auth
    signin_wld: 'Entrar con World ID',
    preparing_session: 'Preparando tu sesión',
    connecting_wld: 'Conectando con World ID',
    session_started: 'Sesión iniciada',
    connection_error: 'Error de conexión. Intenta de nuevo',
    
    // Main UI
    wld_balance: 'Saldo WLD:',
    coming_soon: 'Próximamente',
    
    // Drawers
    boosters_title: 'Impulsores',
    inbox_title: 'Buzón',
    profile_title: 'Perfil',
    ideas_title: 'Ideas',
    
    // Profile
    username_label: 'Nombre de usuario',
    username_placeholder: 'Tu nombre',
    language_label: 'Idioma',
    option_es: 'Español',
    option_en: 'Inglés',
    profile_rbgp_label: 'RBGp:',
    profile_rbg_label: 'RBG Balance:',
    profile_wld_label: 'WLD Balance:',
    claim_soon: 'Reclamar (Pronto)',
    
    // Ideas System
    ideas_pay_intro: '¡Sé parte de los desarrolladores y carrera con la comunidad PARTICIPA!',
    ideas_pay_btn: 'Comprar ticket',
    ideas_choose: 'Escoge una opción',
    vote: 'Votar✍️',
    suggest: 'Sugerencia💡',
    each_action_consumes: '*Cada acción consume 1 ticket',
    
    // Poll
    poll_title: '🏁 ¡EMPIEZA LA CARRERA!',
    poll_hint: 'TÚ ELIGES💊',
    opt_a: 'Comodidad/Seguridad🔵',
    opt_b: 'Cambio/Riesgo🔴',
    opt_c: 'Autotap 🤖',
    poll_close: 'Cerrar',
    
    // Suggest
    suggest_title: '¿Alguna idea?',
    suggest_hint: 'Máx. 400 caracteres.',
    placeholder_suggest: 'Escribe tu idea o mejora aquí…',
    send: 'Enviar',
    close: 'Cerrar',
    
    // Game Elements
    combo_x1: 'COMBO x1',
    combo_x2: 'COMBO x2',
    combo_x3: 'COMBO x3',
    combo_x4: 'COMBO x4',
    combo_x5: 'COMBO x5',
    frenzy: 'FRENZY',
    rainbow_race: 'RAINBOW RACE',
    rainbow_challenge: 'DESAFÍO ARCOÍRIS',
    
    // Time & Counters
    time_remaining: 'Tiempo restante:',
    ticket_expired: '⛔ Ticket vencido',
    energy_label: '⚡ Energía',
    
    // Actions & Buttons
    refill: 'Recargar',
    boosters: 'Impulsores',
    profile: 'Perfil',
    inbox: 'Buzón',
    ideas: 'Ideas',
    trophy: 'Trofeo',
    
    // Messages
    msg_welcome: '¡Bienvenido a RainbowGold!',
    msg_first_combo: '¡Primer combo desbloqueado!',
    msg_energy_low: 'Energía baja. Considera recargar.',
    msg_energy_empty: 'Sin energía. Recarga para continuar.',
    msg_frenzy_start: '¡FRENZY ACTIVADO!',
    msg_rainbow_start: '¡DESAFÍO ARCOÍRIS!',
    
    // Notifications
    notif_combo_up: 'Combo aumentado',
    notif_combo_lost: 'Combo perdido',
    notif_energy_refilled: 'Energía recargada',
    notif_ticket_purchased: 'Ticket comprado',
    notif_vote_submitted: 'Voto enviado',
    notif_idea_submitted: 'Idea enviada',
    
    // Errors
    error_insufficient_wld: 'WLD insuficiente',
    error_no_energy: 'Sin energía',
    error_network: 'Error de conexión',
    error_invalid_input: 'Entrada inválida',
    
    // Tutorial/Help
    help_tap_coin: 'Toca la moneda para ganar RBGp',
    help_hit_spots: 'Toca las manchas doradas para combos',
    help_combo_window: 'Completa los taps en la ventana de tiempo',
    help_energy_system: 'La energía se regenera automáticamente',
    help_refill_energy: 'Recarga energía con WLD',
    
    // Stats & Achievements
    stats_taps_total: 'Taps totales:',
    stats_combos_completed: 'Combos completados:',
    stats_frenzies_achieved: 'Frenzies logrados:',
    stats_rbgp_earned: 'RBGp ganados:',
    
    // Seasonal/Special
    season_winter: 'Temporada de Invierno',
    season_spring: 'Temporada de Primavera',
    season_summer: 'Temporada de Verano',
    season_autumn: 'Temporada de Otoño'
  },
  
  en: {
    // Splash & Auth
    signin_wld: 'Sign in with World ID',
    preparing_session: 'Preparing your session',
    connecting_wld: 'Connecting to World ID',
    session_started: 'Session started',
    connection_error: 'Connection error. Try again',
    
    // Main UI
    wld_balance: 'WLD Balance:',
    coming_soon: 'Coming soon',
    
    // Drawers
    boosters_title: 'Boosters',
    inbox_title: 'Inbox',
    profile_title: 'Profile',
    ideas_title: 'Ideas',
    
    // Profile
    username_label: 'Username',
    username_placeholder: 'Your name',
    language_label: 'Language',
    option_es: 'Spanish',
    option_en: 'English',
    profile_rbgp_label: 'RBGp:',
    profile_rbg_label: 'RBG Balance:',
    profile_wld_label: 'WLD Balance:',
    claim_soon: 'Claim (Soon)',
    
    // Ideas System
    ideas_pay_intro: 'Be part of the developers and race with the community PARTICIPATE!',
    ideas_pay_btn: 'Buy ticket',
    ideas_choose: 'Choose an option',
    vote: 'Vote✍️',
    suggest: 'Suggest💡',
    each_action_consumes: '*Each action consumes 1 ticket',
    
    // Poll
    poll_title: '🏁 THE RACE BEGINS!',
    poll_hint: 'YOU CHOOSE💊',
    opt_a: 'Comfort/Safety🔵',
    opt_b: 'Change/Risk🔴',
    opt_c: 'Autotap 🤖',
    poll_close: 'Close',
    
    // Suggest
    suggest_title: 'Any ideas?',
    suggest_hint: 'Max. 400 characters.',
    placeholder_suggest: 'Write your idea or improvement here…',
    send: 'Send',
    close: 'Close',
    
    // Game Elements
    combo_x1: 'COMBO x1',
    combo_x2: 'COMBO x2',
    combo_x3: 'COMBO x3',
    combo_x4: 'COMBO x4',
    combo_x5: 'COMBO x5',
    frenzy: 'FRENZY',
    rainbow_race: 'RAINBOW RACE',
    rainbow_challenge: 'RAINBOW CHALLENGE',
    
    // Time & Counters
    time_remaining: 'Time remaining:',
    ticket_expired: '⛔ Ticket expired',
    energy_label: '⚡ Energy',
    
    // Actions & Buttons
    refill: 'Refill',
    boosters: 'Boosters',
    profile: 'Profile',
    inbox: 'Inbox',
    ideas: 'Ideas',
    trophy: 'Trophy',
    
    // Messages
    msg_welcome: 'Welcome to RainbowGold!',
    msg_first_combo: 'First combo unlocked!',
    msg_energy_low: 'Energy low. Consider refilling.',
    msg_energy_empty: 'No energy. Refill to continue.',
    msg_frenzy_start: 'FRENZY ACTIVATED!',
    msg_rainbow_start: 'RAINBOW CHALLENGE!',
    
    // Notifications
    notif_combo_up: 'Combo increased',
    notif_combo_lost: 'Combo lost',
    notif_energy_refilled: 'Energy refilled',
    notif_ticket_purchased: 'Ticket purchased',
    notif_vote_submitted: 'Vote submitted',
    notif_idea_submitted: 'Idea submitted',
    
    // Errors
    error_insufficient_wld: 'Insufficient WLD',
    error_no_energy: 'No energy',
    error_network: 'Connection error',
    error_invalid_input: 'Invalid input',
    
    // Tutorial/Help
    help_tap_coin: 'Tap the coin to earn RBGp',
    help_hit_spots: 'Hit golden spots for combos',
    help_combo_window: 'Complete taps within time window',
    help_energy_system: 'Energy regenerates automatically',
    help_refill_energy: 'Refill energy with WLD',
    
    // Stats & Achievements
    stats_taps_total: 'Total taps:',
    stats_combos_completed: 'Combos completed:',
    stats_frenzies_achieved: 'Frenzies achieved:',
    stats_rbgp_earned: 'RBGp earned:',
    
    // Seasonal/Special
    season_winter: 'Winter Season',
    season_spring: 'Spring Season',
    season_summer: 'Summer Season',
    season_autumn: 'Autumn Season'
  }
};

// === CORE I18N FUNCTIONS ===

/**
 * Inicializa el sistema de i18n
 */
function initI18n() {
  // Cargar idioma guardado o detectar automáticamente
  const savedLang = localStorage.getItem('wg_language');
  const browserLang = navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
  
  currentLang = savedLang || browserLang;
  translations = TRANSLATIONS[currentLang] || TRANSLATIONS.es;
  
  // Aplicar traducciones iniciales
  applyTranslations();
  
  // Configurar selector de idioma si existe
  setupLanguageSelector();
  
  console.log(`🌍 I18n initialized: ${currentLang}`);
}

/**
 * Cambia el idioma activo
 * @param {string} lang - Código de idioma ('es' o 'en')
 */
function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) {
    console.warn(`Language '${lang}' not supported`);
    return false;
  }
  
  if (currentLang === lang) {
    return true; // Ya está en ese idioma
  }
  
  currentLang = lang;
  translations = TRANSLATIONS[lang];
  
  // Guardar preferencia
  localStorage.setItem('wg_language', lang);
  
  // Aplicar cambios
  applyTranslations();
  
  // Notificar callbacks
  langChangeCallbacks.forEach(callback => {
    try {
      callback(lang);
    } catch (e) {
      console.error('Error in language change callback:', e);
    }
  });
  
  console.log(`🌍 Language changed to: ${lang}`);
  return true;
}

/**
 * Obtiene una traducción por clave
 * @param {string} key - Clave de traducción
 * @param {Object} params - Parámetros para interpolación (opcional)
 * @returns {string} Texto traducido
 */
function t(key, params = {}) {
  let text = translations[key];
  
  if (!text) {
    console.warn(`Translation missing for key: '${key}' in language '${currentLang}'`);
    return key; // Fallback a la clave
  }
  
  // Interpolación simple de parámetros {variable}
  if (Object.keys(params).length > 0) {
    text = text.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey] !== undefined ? params[paramKey] : match;
    });
  }
  
  return text;
}

/**
 * Aplica todas las traducciones a elementos con data-i18n
 */
function applyTranslations() {
  // Elementos con data-i18n (texto)
  const textElements = document.querySelectorAll('[data-i18n]');
  textElements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = t(key);
    
    if (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button')) {
      el.value = translation;
    } else {
      el.textContent = translation;
    }
  });
  
  // Elementos con data-i18n-placeholder (placeholders)
  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
  placeholderElements.forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
  
  // Elementos con data-i18n-title (títulos/tooltips)
  const titleElements = document.querySelectorAll('[data-i18n-title]');
  titleElements.forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = t(key);
  });
  
  // Elementos con data-i18n-aria (accesibilidad)
  const ariaElements = document.querySelectorAll('[data-i18n-aria]');
  ariaElements.forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    el.setAttribute('aria-label', t(key));
  });
}

/**
 * Configura el selector de idioma en el perfil
 */
function setupLanguageSelector() {
  const langSelect = document.getElementById('langSelect');
  if (!langSelect) return;
  
  // Establecer valor actual
  langSelect.value = currentLang;
  
  // Listener para cambios
  langSelect.addEventListener('change', (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
  });
}

// === DYNAMIC TRANSLATIONS ===

/**
 * Traduce texto dinámico (no en el DOM)
 * @param {string} key - Clave de traducción
 * @param {Object} params - Parámetros opcionales
 * @returns {string}
 */
function translate(key, params = {}) {
  return t(key, params);
}

/**
 * Traduce y actualiza un elemento específico
 * @param {string|HTMLElement} elementOrId - Elemento o ID
 * @param {string} key - Clave de traducción
 * @param {Object} params - Parámetros opcionales
 */
function updateElementTranslation(elementOrId, key, params = {}) {
  const element = typeof elementOrId === 'string' 
    ? document.getElementById(elementOrId) 
    : elementOrId;
    
  if (!element) return;
  
  const translation = t(key, params);
  element.textContent = translation;
}

/**
 * Traduce placeholder de un elemento
 * @param {string|HTMLElement} elementOrId - Elemento o ID
 * @param {string} key - Clave de traducción
 */
function updatePlaceholderTranslation(elementOrId, key) {
  const element = typeof elementOrId === 'string' 
    ? document.getElementById(elementOrId) 
    : elementOrId;
    
  if (!element) return;
  
  element.placeholder = t(key);
}

// === UTILITIES ===

/**
 * Obtiene el idioma actual
 * @returns {string}
 */
function getCurrentLanguage() {
  return currentLang;
}

/**
 * Verifica si un idioma está soportado
 * @param {string} lang - Código de idioma
 * @returns {boolean}
 */
function isLanguageSupported(lang) {
  return !!TRANSLATIONS[lang];
}

/**
 * Obtiene la lista de idiomas soportados
 * @returns {string[]}
 */
function getSupportedLanguages() {
  return Object.keys(TRANSLATIONS);
}

/**
 * Registra callback para cambios de idioma
 * @param {function} callback - Función a ejecutar cuando cambie el idioma
 */
function onLanguageChange(callback) {
  if (typeof callback === 'function') {
    langChangeCallbacks.push(callback);
  }
}

/**
 * Formatea números según el idioma actual
 * @param {number} number - Número a formatear
 * @param {Object} options - Opciones de formato
 * @returns {string}
 */
function formatNumber(number, options = {}) {
  const locale = currentLang === 'es' ? 'es-ES' : 'en-US';
  
  try {
    return new Intl.NumberFormat(locale, options).format(number);
  } catch (e) {
    return number.toString();
  }
}

/**
 * Formatea fechas según el idioma actual
 * @param {Date} date - Fecha a formatear
 * @param {Object} options - Opciones de formato
 * @returns {string}
 */
function formatDate(date, options = {}) {
  const locale = currentLang === 'es' ? 'es-ES' : 'en-US';
  
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch (e) {
    return date.toString();
  }
}

// === REACTIVE UPDATES ===

/**
 * Observer para nuevos elementos con data-i18n
 */
function setupDOMObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Verificar el nodo mismo
          if (node.hasAttribute && node.hasAttribute('data-i18n')) {
            const key = node.getAttribute('data-i18n');
            node.textContent = t(key);
          }
          
          // Verificar descendientes
          const i18nElements = node.querySelectorAll('[data-i18n]');
          i18nElements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = t(key);
          });
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// === EXPORT PARA USO GLOBAL ===
window.initI18n = initI18n;
window.setLanguage = setLanguage;
window.t = t;
window.translate = translate;
window.updateElementTranslation = updateElementTranslation;
window.updatePlaceholderTranslation = updatePlaceholderTranslation;
window.getCurrentLanguage = getCurrentLanguage;
window.isLanguageSupported = isLanguageSupported;
window.getSupportedLanguages = getSupportedLanguages;
window.onLanguageChange = onLanguageChange;
window.formatNumber = formatNumber;
window.formatDate = formatDate;

// === AUTO-INITIALIZATION ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initI18n();
    setupDOMObserver();
  });
} else {
  initI18n();
  setupDOMObserver();
}