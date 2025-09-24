/**
 * SPLASH COMPONENT - RainbowGold Tap
 * Pantalla de carga inicial con autenticación World ID
 */

// === SPLASH STATE ===
let splashVisible = true;
let splashInitialized = false;

// === SPLASH ELEMENTS ===
const splash = document.getElementById('splash');
const wldSignIn = document.getElementById('wldSignIn');
const wldState = document.getElementById('wldState');

// === SPLASH MANAGEMENT ===

/**
 * Inicializa la pantalla de splash
 */
function initSplash() {
  if (splashInitialized) return;
  
  // Asegurar que el splash esté visible al inicio
  if (splash) {
    splash.classList.remove('splash--hide');
    splash.style.opacity = '1';
    splash.style.pointerEvents = 'auto';
    splashVisible = true;
  }
  
  // Inicializar botón de World ID
  initWorldIDButton();
  
  // Inicializar animación de puntos
  initLoadingDots();
  
  splashInitialized = true;
}

/**
 * Oculta el splash con animación suave
 */
function hideSplash() {
  if (!splash || !splashVisible) return;
  
  splash.classList.add('splash--hide');
  splashVisible = false;
  
  // Limpiar después de la animación
  setTimeout(() => {
    if (splash && !splashVisible) {
      splash.style.display = 'none';
      // Permitir que el resto de la app sea interactiva
      document.body.classList.remove('splash-active');
    }
  }, 400); // Duración de la transición CSS
}

/**
 * Muestra el splash (para debugging o re-autenticación)
 */
function showSplash() {
  if (!splash) return;
  
  splash.style.display = 'grid';
  splash.classList.remove('splash--hide');
  splash.style.opacity = '1';
  splash.style.pointerEvents = 'auto';
  splashVisible = true;
  document.body.classList.add('splash-active');
}

/**
 * Actualiza el estado del texto de carga
 * @param {string} text - Texto a mostrar
 * @param {boolean} showDots - Si mostrar animación de puntos
 */
function updateSplashState(text, showDots = true) {
  if (!wldState) return;
  
  const textSpan = wldState.querySelector('[data-i18n]');
  const dotsSpan = wldState.querySelector('.dots');
  
  if (textSpan) {
    textSpan.textContent = text;
  }
  
  if (dotsSpan) {
    dotsSpan.style.display = showDots ? 'inline-block' : 'none';
  }
  
  // Mostrar el estado con animación
  wldState.style.opacity = '1';
  wldState.style.transform = 'translateY(0)';
}

// === WORLD ID INTEGRATION ===

/**
 * Inicializa el botón de World ID
 */
function initWorldIDButton() {
  if (!wldSignIn) return;
  
  wldSignIn.addEventListener('click', handleWorldIDSignIn);
  
  // Estado inicial
  setWorldIDButtonState('ready');
}

/**
 * Maneja el click en el botón de World ID
 */
async function handleWorldIDSignIn() {
  try {
    setWorldIDButtonState('loading');
    updateSplashState('Conectando con World ID', true);
    
    // Simular autenticación (aquí integrarías con WorldApp)
    await simulateWorldIDAuth();
    
    setWorldIDButtonState('success');
    updateSplashState('Sesión iniciada', false);
    
    // Esperar un poco y ocultar splash
    setTimeout(() => {
      hideSplash();
      onSplashComplete();
    }, 1200);
    
  } catch (error) {
    console.error('Error en autenticación World ID:', error);
    setWorldIDButtonState('error');
    updateSplashState('Error de conexión. Intenta de nuevo', false);
    
    // Resetear después de 3 segundos
    setTimeout(() => {
      setWorldIDButtonState('ready');
      updateSplashState('Preparando tu sesión', true);
    }, 3000);
  }
}

/**
 * Simula el proceso de autenticación con World ID
 */
async function simulateWorldIDAuth() {
  // Simular latencia de red
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Aquí irían las llamadas reales a WorldApp/SIWE
  // Por ahora simulamos éxito
  if (Math.random() > 0.1) { // 90% éxito
    return { success: true, address: '0x123...abc' };
  } else {
    throw new Error('Autenticación fallida');
  }
}

/**
 * Actualiza el estado visual del botón World ID
 * @param {string} state - Estado: 'ready', 'loading', 'success', 'error'
 */
function setWorldIDButtonState(state) {
  if (!wldSignIn) return;
  
  // Limpiar clases previas
  wldSignIn.classList.remove('btn-loading', 'btn-success', 'btn-error');
  wldSignIn.disabled = false;
  
  switch (state) {
    case 'loading':
      wldSignIn.classList.add('btn-loading');
      wldSignIn.disabled = true;
      wldSignIn.textContent = 'Conectando...';
      break;
      
    case 'success':
      wldSignIn.classList.add('btn-success');
      wldSignIn.disabled = true;
      wldSignIn.textContent = '✓ Conectado';
      break;
      
    case 'error':
      wldSignIn.classList.add('btn-error');
      wldSignIn.textContent = '✗ Error - Reintentar';
      break;
      
    case 'ready':
    default:
      wldSignIn.textContent = 'Entrar con World ID';
      break;
  }
}

// === LOADING DOTS ANIMATION ===

/**
 * Inicializa la animación de puntos de carga
 */
function initLoadingDots() {
  const dotsContainer = document.querySelector('.dots');
  if (!dotsContainer) return;
  
  // Crear spans para los puntos si no existen
  if (!dotsContainer.children.length) {
    for (let i = 0; i < 3; i++) {
      const span = document.createElement('span');
      span.textContent = '.';
      dotsContainer.appendChild(span);
    }
  }
}

// === SPLASH COMPLETION ===

/**
 * Se ejecuta cuando el splash se completa
 */
function onSplashComplete() {
  // Notificar al resto de la aplicación
  document.dispatchEvent(new CustomEvent('splash:complete'));
  
  // Inicializar resto de la app si es necesario
  if (typeof initApp === 'function') {
    initApp();
  }
  
  // Play sonido de bienvenida si está disponible
  if (typeof playSnd === 'function') {
    playSnd('join', { volume: 0.8 });
  }
}

// === UTILITIES ===

/**
 * Verifica si el splash está visible
 * @returns {boolean}
 */
function isSplashVisible() {
  return splashVisible;
}

/**
 * Fuerza el cierre del splash (para debugging)
 */
function forceSplashClose() {
  hideSplash();
  onSplashComplete();
}

/**
 * Resetea el splash al estado inicial
 */
function resetSplash() {
  if (!splash) return;
  
  setWorldIDButtonState('ready');
  updateSplashState('Preparando tu sesión', true);
  showSplash();
}

// === AUTO-INITIALIZATION ===

/**
 * Auto-inicialización cuando el DOM esté listo
 */
function autoInitSplash() {
  initSplash();
  
  // Mostrar hint después de un momento
  setTimeout(() => {
    if (wldState && splashVisible) {
      wldState.style.opacity = '1';
      wldState.style.transform = 'translateY(0)';
    }
  }, 800);
}

// === EXPORT PARA USO GLOBAL ===
window.initSplash = initSplash;
window.hideSplash = hideSplash;
window.showSplash = showSplash;
window.updateSplashState = updateSplashState;
window.setWorldIDButtonState = setWorldIDButtonState;
window.isSplashVisible = isSplashVisible;
window.forceSplashClose = forceSplashClose;
window.resetSplash = resetSplash;
window.onSplashComplete = onSplashComplete;

// === INITIALIZATION ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInitSplash);
} else {
  autoInitSplash();
}

// === DESARROLLO: Shortcuts para testing ===
if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
  // Ctrl+S = Skip splash (solo en desarrollo)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's' && splashVisible) {
      e.preventDefault();
      console.log('🚀 Skipping splash (dev mode)');
      forceSplashClose();
    }
  });
}