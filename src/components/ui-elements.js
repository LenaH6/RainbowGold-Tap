/**
 * UI ELEMENTS COMPONENT - RainbowGold Tap
 * Labels flotantes, badges, tooltips, activity feed y elementos visuales
 */

// === FLOATING LABELS & POPUPS ===

/**
 * Crea un label flotante con animación personalizada
 * @param {string} text - Texto a mostrar
 * @param {number} x - Coordenada X (pantalla)
 * @param {number} y - Coordenada Y (pantalla)
 * @param {Object} options - Opciones de personalización
 */
function popLabel(text, x, y, options = {}) {
  const {
    fontSize = 36,
    dy = -120,
    duration = 1600,
    color = '#ff3030',
    weight = 900,
    shadow = '0 2px 10px rgba(0,0,0,.45)',
    spacing = '1px'
  } = options;

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  
  const el = document.createElement('div');
  el.textContent = text;
  
  // Positioning and styling
  el.style.position = 'fixed';
  el.style.left = clamp(x, 24, window.innerWidth - 24) + 'px';
  el.style.top = clamp(y, 24, window.innerHeight - 24) + 'px';
  el.style.transform = 'translate(-50%,-50%)';
  el.style.fontSize = fontSize + 'px';
  el.style.fontWeight = String(weight);
  el.style.color = color;
  el.style.textShadow = shadow;
  el.style.letterSpacing = spacing;
  el.style.pointerEvents = 'none';
  el.style.zIndex = '1002';
  el.style.willChange = 'transform, opacity';
  
  document.body.appendChild(el);

  // Animación suave de entrada, pausa y salida
  const animation = el.animate([
    { 
      transform: 'translate(-50%,-50%) scale(.92)', 
      opacity: 0 
    },
    { 
      transform: 'translate(-50%,-54%) scale(1.00)', 
      opacity: 1, 
      offset: 0.38 
    },
    { 
      transform: `translate(-50%, calc(-50% + ${dy}px)) scale(1.04)`, 
      opacity: 0 
    }
  ], {
    duration,
    easing: 'cubic-bezier(.18,.9,.22,1)'
  });
  
  animation.onfinish = () => el.remove();
  
  return el;
}

/**
 * Label de risa centrado
 * @param {number} x - Coordenada X
 * @param {number} y - Coordenada Y
 */
function popLaugh(x, y) {
  return popLabel('😂', x, y, { 
    fontSize: 40, 
    dy: -120, 
    duration: 2200, 
    color: '#fff' 
  });
}

/**
 * Efecto sparkle silencioso (solo visual, sin sonido)
 * @param {number} x - Coordenada X
 * @param {number} y - Coordenada Y
 */
function popSparkleSilent(x, y) {
  return popLabel('✨', x, y, { 
    fontSize: 28, 
    dy: -80, 
    duration: 1400, 
    color: '#ffd872' 
  });
}

/**
 * Sparkle con sonido (si está disponible)
 * @param {number} x - Coordenada X
 * @param {number} y - Coordenada Y
 */
function popSparkle(x, y) {
  // Efecto visual
  popSparkleSilent(x, y);
  
  // Sonido si está disponible
  try {
    if (typeof playSnd === 'function') {
      playSnd('nice', { volume: 0.95 });
    }
  } catch (_) {
    // Silencioso si no hay audio
  }
}

/**
 * Badge centrado en la moneda
 * @param {string} text - Texto del badge
 */
function popBadge(text) {
  const coin = document.getElementById('coin');
  if (!coin) return;
  
  const rect = coin.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2 - 20;
  
  return popLabel(text, cx, cy, { 
    fontSize: 36, 
    dy: -120,
    color: '#ffd872'
  });
}

// === GAIN NUMBERS (Floating +Values) ===

let lastGainEl = null;
const gainPool = [];

/**
 * Muestra número de ganancia flotante (+valor)
 * @param {number} x - Coordenada X de pantalla
 * @param {number} y - Coordenada Y de pantalla
 * @param {string} text - Texto a mostrar
 */
function showGain(x, y, text) {
  const gain = document.getElementById('gain');
  if (!gain) return;
  
  // Posicionar fuera de la moneda para evitar recortes
  gain.style.position = 'fixed';
  gain.style.left = x + 'px';
  gain.style.top = (y - 70) + 'px';
  gain.style.zIndex = '1001';
  gain.style.opacity = '1';
  gain.textContent = text;

  // Cancelar animación anterior si existe
  try {
    if (gain.currentAnimation) {
      gain.currentAnimation.cancel();
    }
  } catch(e) {}

  // Nueva animación más lenta y suave
  const animation = gain.animate([
    { transform: 'translateY(0px)', opacity: 1 },
    { transform: 'translateY(-96px)', opacity: 0 }
  ], {
    duration: 2400,
    easing: 'cubic-bezier(.18,.9,.22,1)'
  });

  gain.currentAnimation = animation;

  // Limpieza automática
  animation.onfinish = () => {
    gain.style.opacity = '0';
    gain.textContent = '';
    gain.currentAnimation = null;
  };

  // Fallback de limpieza
  setTimeout(() => {
    if (!animation || animation.playState !== 'running') {
      gain.style.opacity = '0';
      gain.textContent = '';
    }
  }, 1900);
  
  // Tracking para posibles actualizaciones
  lastGainEl = gain;
}

/**
 * Spawn multiple gain numbers (alternative system)
 * @param {number} x - Coordenada X
 * @param {number} y - Coordenada Y  
 * @param {string} text - Texto
 */
function spawnGain(x, y, text) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.position = 'fixed';
  el.style.left = x + 'px';
  el.style.top = (y - 70) + 'px';
  el.style.fontSize = '18px';
  el.style.fontWeight = '900';
  el.style.color = '#fff';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '1001';
  el.style.textShadow = '0 2px 6px rgba(0,0,0,.55), 0 0 10px rgba(0,0,0,.35)';
  el.style.willChange = 'transform,opacity';
  
  document.body.appendChild(el);

  // Animación más lenta y alta
  const animation = el.animate([
    { transform: 'translateY(0)', opacity: 1 },
    { transform: 'translateY(-100px)', opacity: 0 }
  ], {
    duration: 3200,
    easing: 'cubic-bezier(.18,.9,.22,1)'
  });
  
  animation.onfinish = () => el.remove();

  // Pool management (máximo 10 elementos)
  gainPool.push(el);
  if (gainPool.length > 10) {
    const old = gainPool.shift();
    try { old.remove(); } catch(e) {}
  }
  
  lastGainEl = el;
}

// === ACTIVITY FEED (Vertical scrolling notices) ===

const noticeQueue = [];
let noticeRunning = false;

/**
 * Sincroniza el ancho del activity bar con la píldora
 */
function syncActivityWidth() {
  const pill = document.querySelector('.pill');
  const activityBar = document.querySelector('.topbar .activity-bar');
  
  if (!pill || !activityBar) return;
  
  function apply() {
    const width = Math.round(pill.getBoundingClientRect().width);
    document.documentElement.style.setProperty('--activityWidth', width + 'px');
  }
  
  apply();
  window.addEventListener('resize', apply);
  setTimeout(apply, 100); // Fallback delay
}

/**
 * Añade una notificación al feed público
 * @param {string} html - HTML del mensaje
 */
function postActivity(html) {
  const activityBar = document.querySelector('.topbar .activity-bar');
  if (!activityBar) return;
  
  noticeQueue.push(html);
  if (!noticeRunning) {
    runNextNotice();
  }
}

/**
 * Ejecuta la siguiente notificación en la cola
 */
function runNextNotice() {
  const activityBar = document.querySelector('.topbar .activity-bar');
  if (!activityBar) {
    noticeRunning = false;
    return;
  }
  
  const html = noticeQueue.shift();
  if (!html) {
    noticeRunning = false;
    return;
  }
  
  noticeRunning = true;

  // Limpiar contenido anterior
  activityBar.innerHTML = '';

  const el = document.createElement('div');
  el.className = 'activity-item';
  el.innerHTML = html;
  activityBar.appendChild(el);

  // Iniciar animación
  requestAnimationFrame(() => {
    el.classList.add('run');
  });

  // Limpiar cuando termine
  el.addEventListener('animationend', () => {
    el.remove();
    runNextNotice();
  }, { once: true });
}

// === TOOLTIPS ===

/**
 * Muestra tooltip del trofeo
 */
function showTrophyTip() {
  const tip = document.getElementById('trophyTip');
  if (tip) {
    tip.classList.add('show');
  }
}

/**
 * Oculta tooltip del trofeo
 */
function hideTrophyTip() {
  const tip = document.getElementById('trophyTip');
  if (tip) {
    tip.classList.remove('show');
  }
}

/**
 * Inicializa tooltips
 */
function initTooltips() {
  const trophyBtn = document.getElementById('trophyBtn');
  
  if (trophyBtn) {
    trophyBtn.addEventListener('mouseenter', showTrophyTip);
    trophyBtn.addEventListener('mouseleave', hideTrophyTip);
    
    // Touch events para móviles
    trophyBtn.addEventListener('touchstart', showTrophyTip);
    trophyBtn.addEventListener('touchend', () => {
      setTimeout(hideTrophyTip, 2000);
    });
  }
}

// === BADGES & COUNTERS ===

/**
 * Actualiza el badge del inbox
 * @param {number} count - Número de mensajes
 */
function updateInboxBadge(count) {
  const badge = document.getElementById('inboxBadge');
  if (!badge) return;
  
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count.toString();
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

// === WINDOW TAG (Combo indicator) ===

/**
 * Muestra el tag de ventana con texto y color
 * @param {string} text - Texto a mostrar
 * @param {string} color - Color del texto (opcional)
 */
function tagShow(text, color) {
  const windowTag = document.getElementById('windowTag');
  if (!windowTag) return;
  
  windowTag.textContent = text;
  if (color) {
    windowTag.style.color = color;
  }
  
  windowTag.style.opacity = '1';
  windowTag.style.transform = 'scale(1.06)';
  
  // Volver al tamaño normal después de un momento
  setTimeout(() => {
    if (windowTag) {
      windowTag.style.transform = 'scale(1)';
    }
  }, 90);
}

/**
 * Oculta el tag de ventana
 */
function tagHide() {
  const windowTag = document.getElementById('windowTag');
  if (!windowTag) return;
  
  windowTag.style.opacity = '0';
  windowTag.style.transform = 'scale(.9)';
}

// === VISUAL EFFECTS ===

/**
 * Aplica efecto flash a la moneda
 */
function coinFlash() {
  const coin = document.getElementById('coin');
  if (!coin) return;
  
  coin.classList.add('flash');
  setTimeout(() => {
    coin.classList.remove('flash');
  }, 220);
}

/**
 * Aplicar efecto de vibración
 * @param {HTMLElement} element - Elemento a vibrar
 * @param {string} className - Clase CSS de vibración
 */
function applyVibration(element, className = 'vibeX') {
  if (!element) return;
  
  element.classList.add(className);
  
  // Auto-remover después de la animación
  setTimeout(() => {
    element.classList.remove(className);
  }, 2000);
}

// === UTILITIES ===

/**
 * Clamp value between min and max
 * @param {number} value - Valor a limitar
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Formatea número con decimales fijos
 * @param {number} num - Número a formatear
 * @param {number} decimals - Número de decimales
 * @returns {string}
 */
function formatNumber(num, decimals = 4) {
  return Number(num).toFixed(decimals);
}

/**
 * Actualiza el último elemento de ganancia con nuevo total
 * @param {number} total - Total a mostrar
 */
function setLastGainTotal(total) {
  if (lastGainEl) {
    lastGainEl.textContent = `+${formatNumber(total)}`;
  }
}

// === INITIALIZATION ===

/**
 * Inicializa todos los elementos de UI
 */
function initUIElements() {
  syncActivityWidth();
  initTooltips();
  
  // Re-sincronizar ancho en resize
  window.addEventListener('resize', syncActivityWidth);
}

// === EXPORT PARA USO GLOBAL ===
window.popLabel = popLabel;
window.popLaugh = popLaugh;
window.popSparkle = popSparkle;
window.popSparkleSilent = popSparkleSilent;
window.popBadge = popBadge;
window.showGain = showGain;
window.spawnGain = spawnGain;
window.postActivity = postActivity;
window.updateInboxBadge = updateInboxBadge;
window.tagShow = tagShow;
window.tagHide = tagHide;
window.coinFlash = coinFlash;
window.applyVibration = applyVibration;
window.setLastGainTotal = setLastGainTotal;
window.formatNumber = formatNumber;
window.clamp = clamp;

// === AUTO-INITIALIZATION ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUIElements);
} else {
  initUIElements();
}