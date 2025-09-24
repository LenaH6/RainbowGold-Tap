/**
 * HELPERS COMPONENT - RainbowGold Tap
 * Funciones utilitarias, formateo, matemáticas y herramientas generales
 */

// === MATHEMATICAL UTILITIES ===

/**
 * Limita un valor entre un mínimo y máximo
 * @param {number} value - Valor a limitar
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Genera número aleatorio entre min y max (entero)
 * @param {number} min - Valor mínimo (incluido)
 * @param {number} max - Valor máximo (incluido)
 * @returns {number}
 */
function randInt(min, max) {
  return (min | 0) + Math.floor(Math.random() * ((max | 0) - (min | 0) + 1));
}

/**
 * Genera número aleatorio entre min y max (decimal)
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {number}
 */
function rand(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Interpola linealmente entre dos valores
 * @param {number} a - Valor inicial
 * @param {number} b - Valor final
 * @param {number} t - Factor de interpolación (0-1)
 * @returns {number}
 */
function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Mapea un valor de un rango a otro
 * @param {number} value - Valor a mapear
 * @param {number} inMin - Mínimo del rango original
 * @param {number} inMax - Máximo del rango original
 * @param {number} outMin - Mínimo del rango destino
 * @param {number} outMax - Máximo del rango destino
 * @returns {number}
 */
function map(value, inMin, inMax, outMin, outMax) {
  return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

/**
 * Redondea a un número específico de decimales
 * @param {number} value - Valor a redondear
 * @param {number} decimals - Número de decimales
 * @returns {number}
 */
function roundTo(value, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// === FORMATTING UTILITIES ===

/**
 * Formatea número con decimales fijos
 * @param {number} num - Número a formatear
 * @param {number} decimals - Número de decimales (default: 4)
 * @returns {string}
 */
function fmt(num, decimals = 4) {
  return Number(num).toFixed(decimals);
}

/**
 * Formatea números grandes con sufijos (K, M, B)
 * @param {number} num - Número a formatear
 * @param {number} decimals - Decimales a mostrar
 * @returns {string}
 */
function formatLargeNumber(num, decimals = 2) {
  if (num < 1000) return num.toFixed(decimals);
  if (num < 1000000) return (num / 1000).toFixed(decimals) + 'K';
  if (num < 1000000000) return (num / 1000000).toFixed(decimals) + 'M';
  return (num / 1000000000).toFixed(decimals) + 'B';
}

/**
 * Formatea porcentajes
 * @param {number} value - Valor (0-1)
 * @param {number} decimals - Decimales a mostrar
 * @returns {string}
 */
function formatPercent(value, decimals = 1) {
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Formatea tiempo en formato MM:SS
 * @param {number} seconds - Segundos totales
 * @returns {string}
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formatea tiempo relativo (hace X tiempo)
 * @param {Date|number} date - Fecha o timestamp
 * @returns {string}
 */
function formatTimeAgo(date) {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now - target;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) return 'hace un momento';
  if (diffMinutes < 60) return `hace ${diffMinutes}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return target.toLocaleDateString();
}

// === DOM UTILITIES ===

/**
 * Selector corto para querySelector
 * @param {string} selector - Selector CSS
 * @returns {Element|null}
 */
function $(selector) {
  return document.querySelector(selector);
}

/**
 * Selector corto para querySelectorAll
 * @param {string} selector - Selector CSS
 * @returns {NodeList}
 */
function $$(selector) {
  return document.querySelectorAll(selector);
}

/**
 * Crear elemento con atributos y contenido
 * @param {string} tag - Tag del elemento
 * @param {Object} attrs - Atributos del elemento
 * @param {string|Element} content - Contenido del elemento
 * @returns {Element}
 */
function createElement(tag, attrs = {}, content = '') {
  const el = document.createElement(tag);
  
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else {
      el.setAttribute(key, value);
    }
  });
  
  if (typeof content === 'string') {
    el.textContent = content;
  } else if (content instanceof Element) {
    el.appendChild(content);
  }
  
  return el;
}

/**
 * Verifica si elemento está visible en viewport
 * @param {Element} element - Elemento a verificar
 * @returns {boolean}
 */
function isElementVisible(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Obtiene posición del elemento relativo al viewport
 * @param {Element} element - Elemento
 * @returns {Object} {x, y, width, height}
 */
function getElementPosition(element) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2
  };
}

// === EVENT UTILITIES ===

/**
 * Debounce function para limitar frecuencia de ejecución
 * @param {Function} func - Función a debounce
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function}
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function para limitar ejecución
 * @param {Function} func - Función a throttle
 * @param {number} limit - Límite de tiempo en ms
 * @returns {Function}
 */
function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Ejecuta función cuando se cumpla una condición
 * @param {Function} condition - Función que retorna boolean
 * @param {Function} callback - Función a ejecutar
 * @param {number} interval - Intervalo de verificación en ms
 * @param {number} timeout - Timeout máximo en ms
 */
function waitFor(condition, callback, interval = 100, timeout = 5000) {
  const startTime = Date.now();
  
  function check() {
    if (condition()) {
      callback();
    } else if (Date.now() - startTime < timeout) {
      setTimeout(check, interval);
    }
  }
  
  check();
}

// === STORAGE UTILITIES ===

/**
 * Guarda datos en localStorage de forma segura
 * @param {string} key - Clave del storage
 * @param {*} value - Valor a guardar
 * @returns {boolean} Si se guardó exitosamente
 */
function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('Error saving to localStorage:', e);
    return false;
  }
}

/**
 * Carga datos del localStorage de forma segura
 * @param {string} key - Clave del storage
 * @param {*} defaultValue - Valor por defecto si no existe
 * @returns {*} Valor cargado o valor por defecto
 */
function loadFromStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.warn('Error loading from localStorage:', e);
    return defaultValue;
  }
}

/**
 * Elimina clave del localStorage
 * @param {string} key - Clave a eliminar
 * @returns {boolean} Si se eliminó exitosamente
 */
function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn('Error removing from localStorage:', e);
    return false;
  }
}

// === ASYNC UTILITIES ===

/**
 * Promesa que se resuelve después de X milisegundos
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry automático de función asíncrona
 * @param {Function} fn - Función a ejecutar
 * @param {number} retries - Número de reintentos
 * @param {number} delay - Delay entre reintentos
 * @returns {Promise}
 */
async function retry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await sleep(delay);
      return retry(fn, retries - 1, delay);
    }
    throw error;
  }
}

// === VALIDATION UTILITIES ===

/**
 * Verifica si un valor es número válido
 * @param {*} value - Valor a verificar
 * @returns {boolean}
 */
function isValidNumber(value) {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Verifica si una string es un email válido
 * @param {string} email - Email a verificar
 * @returns {boolean}
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Sanitiza string para uso seguro
 * @param {string} str - String a sanitizar
 * @returns {string}
 */
function sanitizeString(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Valida rango de número
 * @param {number} value - Valor a validar
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {boolean}
 */
function isInRange(value, min, max) {
  return isValidNumber(value) && value >= min && value <= max;
}

// === COLOR UTILITIES ===

/**
 * Convierte HEX a RGB
 * @param {string} hex - Color en formato HEX
 * @returns {Object} {r, g, b}
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convierte RGB a HEX
 * @param {number} r - Rojo (0-255)
 * @param {number} g - Verde (0-255)
 * @param {number} b - Azul (0-255)
 * @returns {string}
 */
function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Interpola entre dos colores
 * @param {string} color1 - Color inicial (HEX)
 * @param {string} color2 - Color final (HEX)
 * @param {number} factor - Factor de interpolación (0-1)
 * @returns {string} Color interpolado en HEX
 */
function lerpColor(color1, color2, factor) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  
  if (!c1 || !c2) return color1;
  
  const r = Math.round(lerp(c1.r, c2.r, factor));
  const g = Math.round(lerp(c1.g, c2.g, factor));
  const b = Math.round(lerp(c1.b, c2.b, factor));
  
  return rgbToHex(r, g, b);
}

// === DEVICE & BROWSER UTILITIES ===

/**
 * Detecta si es dispositivo móvil
 * @returns {boolean}
 */
function isMobile() {
  return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detecta si es Safari
 * @returns {boolean}
 */
function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * Detecta si soporta touch
 * @returns {boolean}
 */
function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Obtiene información del dispositivo
 * @returns {Object}
 */
function getDeviceInfo() {
  return {
    isMobile: isMobile(),
    isSafari: isSafari(),
    isTouch: isTouchDevice(),
    pixelRatio: window.devicePixelRatio || 1,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  };
}

// === GAME SPECIFIC UTILITIES ===

/**
 * Calcula distancia entre dos puntos
 * @param {number} x1 - X del punto 1
 * @param {number} y1 - Y del punto 1
 * @param {number} x2 - X del punto 2
 * @param {number} y2 - Y del punto 2
 * @returns {number}
 */
function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Verifica si un punto está dentro de un círculo
 * @param {number} pointX - X del punto
 * @param {number} pointY - Y del punto
 * @param {number} circleX - X del centro del círculo
 * @param {number} circleY - Y del centro del círculo
 * @param {number} radius - Radio del círculo
 * @returns {boolean}
 */
function isPointInCircle(pointX, pointY, circleX, circleY, radius) {
  return distance(pointX, pointY, circleX, circleY) <= radius;
}

/**
 * Genera posición aleatoria dentro de un área con margen
 * @param {number} width - Ancho del área
 * @param {number} height - Alto del área
 * @param {number} margin - Margen desde los bordes
 * @returns {Object} {x, y}
 */
function randomPositionInArea(width, height, margin = 0) {
  return {
    x: rand(margin, width - margin),
    y: rand(margin, height - margin)
  };
}

/**
 * Easing functions para animaciones
 */
const easing = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: t => t * t * t,
  easeOutCubic: t => (--t) * t * t + 1,
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
};

// === EXPORT PARA USO GLOBAL ===
window.clamp = clamp;
window.randInt = randInt;
window.rand = rand;
window.lerp = lerp;
window.map = map;
window.roundTo = roundTo;
window.fmt = fmt;
window.formatLargeNumber = formatLargeNumber;
window.formatPercent = formatPercent;
window.formatTime = formatTime;
window.formatTimeAgo = formatTimeAgo;
window.$ = $;
window.$$ = $$;
window.createElement = createElement;
window.isElementVisible = isElementVisible;
window.getElementPosition = getElementPosition;
window.debounce = debounce;
window.throttle = throttle;
window.waitFor = waitFor;
window.saveToStorage = saveToStorage;
window.loadFromStorage = loadFromStorage;
window.removeFromStorage = removeFromStorage;
window.sleep = sleep;
window.retry = retry;
window.isValidNumber = isValidNumber;
window.isValidEmail = isValidEmail;
window.sanitizeString = sanitizeString;
window.isInRange = isInRange;
window.hexToRgb = hexToRgb;
window.rgbToHex = rgbToHex;
window.lerpColor = lerpColor;
window.isMobile = isMobile;
window.isSafari = isSafari;
window.isTouchDevice = isTouchDevice;
window.getDeviceInfo = getDeviceInfo;
window.distance = distance;
window.isPointInCircle = isPointInCircle;
window.randomPositionInArea = randomPositionInArea;
window.easing = easing;

// === CONSOLE UTILITIES (Development) ===
if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
  /**
   * Log mejorado para desarrollo
   * @param {*} data - Datos a loggear
   * @param {string} type - Tipo de log
   */
  window.log = function(data, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] RBG:`;
    
    switch (type) {
      case 'error':
        console.error(prefix, data);
        break;
      case 'warn':
        console.warn(prefix, data);
        break;
      case 'success':
        console.log(`%c${prefix}`, 'color: #4CAF50', data);
        break;
      default:
        console.log(prefix, data);
    }
  };
  
  window.log('🛠 Helpers loaded - Development mode active', 'success');
}