/**
 * animations.js - Motor de Animaciones RainbowGold Tap
 * Extrae todas las funciones de animación del index.html monolítico
 */

// === CONFIGURACIÓN DE ANIMACIONES ===
const ANIM_CONFIG = {
  GAIN_DECIMALS: 4,
  GAIN_FADE_DURATION: 2400,
  LABEL_DURATION: 1600,
  SPARKLE_DURATION: 1200,
  RIPPLE_DURATION: 500,
  FLASH_DURATION: 140,
  COMBO_SCALE_DURATION: 90
};

// === POOL DE ELEMENTOS PARA RENDIMIENTO ===
let lastGainEl = null;
const gainPool = [];
let gainAnim = null;

// === HELPERS PRINCIPALES ===
const fmt = (n) => Number(n).toFixed(ANIM_CONFIG.GAIN_DECIMALS);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function setLastGainTotal(tot) { 
  if (lastGainEl) lastGainEl.textContent = `+${fmt(tot)}`; 
}

// === ANIMACIONES DE GANANCIA FLOTANTE ===

/**
 * Muestra ganancia flotante principal (reutilizable)
 * @param {number} x - coordenada X pantalla
 * @param {number} y - coordenada Y pantalla  
 * @param {string} text - texto a mostrar
 */
function showGain(x, y, text) {
  const gain = document.getElementById('gain');
  if (!gain) return;

  gain.style.position = 'fixed';
  gain.style.left = x + 'px';
  gain.style.top = (y - 70) + 'px';
  gain.style.zIndex = '1001';
  gain.style.opacity = '1';
  gain.textContent = text;

  try { 
    if (gainAnim) gainAnim.cancel(); 
  } catch(e) {}

  gainAnim = gain.animate([
    { transform: 'translateY(0px)', opacity: 1 },
    { transform: 'translateY(-96px)', opacity: 0 }
  ], { 
    duration: ANIM_CONFIG.GAIN_FADE_DURATION, 
    easing: 'cubic-bezier(.18,.9,.22,1)' 
  });

  gainAnim.onfinish = () => { 
    gain.style.opacity = '0'; 
    gain.textContent = ''; 
  };

  setTimeout(() => {
    if (!gainAnim || gainAnim.playState !== 'running') {
      gain.style.opacity = '0';
      gain.textContent = '';
    }
  }, 1900);
}

/**
 * Spawn múltiples ganancias flotantes (para spam de clicks)
 * @param {number} x - coordenada X pantalla
 * @param {number} y - coordenada Y pantalla
 * @param {string} text - texto a mostrar
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

  const anim = el.animate([
    { transform: 'translateY(0)', opacity: 1 },
    { transform: 'translateY(-100px)', opacity: 0 }
  ], { 
    duration: 3200, 
    easing: 'cubic-bezier(.18,.9,.22,1)' 
  });

  anim.onfinish = () => el.remove();
  lastGainEl = el;

  // Limita elementos en pantalla (performance)
  gainPool.push(el);
  if (gainPool.length > 10) {
    const old = gainPool.shift();
    try { old.remove(); } catch(e) {}
  }
}

// === LABELS Y STICKERS FLOTANTES ===

/**
 * Popup label animado con opciones personalizables
 * @param {string} text - texto del label
 * @param {number} x - coordenada X pantalla
 * @param {number} y - coordenada Y pantalla
 * @param {Object} opt - opciones {fontSize, dy, duration, color, weight}
 */
function popLabel(text, x, y, opt = {}) {
  const {
    fontSize = 36,
    dy = -120,
    duration = ANIM_CONFIG.LABEL_DURATION,
    color = '#ff3030',
    weight = 900
  } = opt;

  const el = document.createElement('div');
  el.textContent = text;
  el.style.position = 'fixed';
  el.style.left = clamp(x, 24, window.innerWidth - 24) + 'px';
  el.style.top = clamp(y, 24, window.innerHeight - 24) + 'px';
  el.style.transform = 'translate(-50%,-50%)';
  el.style.fontSize = fontSize + 'px';
  el.style.fontWeight = String(weight);
  el.style.color = color;
  el.style.textShadow = '0 2px 10px rgba(0,0,0,.45)';
  el.style.letterSpacing = '1px';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '1002';
  document.body.appendChild(el);

  const anim = el.animate([
    { transform: 'translate(-50%,-50%) scale(.92)', opacity: 0 },
    { transform: 'translate(-50%,-54%) scale(1.00)', opacity: 1, offset: .38 },
    { transform: `translate(-50%, calc(-50% + ${dy}px)) scale(1.04)`, opacity: 0 }
  ], { 
    duration, 
    easing: 'cubic-bezier(.18,.9,.22,1)' 
  });

  anim.onfinish = () => el.remove();
}

/**
 * Popup de risa para fails/decoys
 */
function popLaugh(x, y) {
  popLabel('😂', x, y, { 
    fontSize: 40, 
    dy: -120, 
    duration: 2200, 
    color: '#fff' 
  });
}

/**
 * Popup badge centrado en la moneda
 */
function popBadge(text) {
  const coin = document.getElementById('coin');
  if (!coin) return;
  
  const r = coin.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2 - 20;
  popLabel(text, cx, cy, { fontSize: 36, dy: -120 });
}

/**
 * Sparkle silencioso (solo visual, sin audio)
 */
function popSparkleSilent(x, y) {
  popLabel('✨', x, y, { 
    fontSize: 28, 
    dy: -80, 
    duration: ANIM_CONFIG.SPARKLE_DURATION, 
    color: '#ffd872' 
  });
}

/**
 * Sparkle completo (con audio)
 */
function popSparkle(x, y) {
  try {
    if (typeof playSnd === 'function') {
      playSnd('nice', { volume: 0.95 });
    }
  } catch (_) {}
  // Sin visual - solo audio en tu implementación actual
}

// === ANIMACIONES DE MONEDA ===

/**
 * Flash de moneda en combos/éxitos
 */
function createCoinFlash() {
  const coin = document.getElementById('coin');
  if (!coin) return;
  
  coin.classList.add('flash');
  setTimeout(() => {
    coin.classList.remove('flash');
  }, ANIM_CONFIG.FLASH_DURATION + 80);
}

/**
 * Animación de tap de moneda (escala)
 */
function animateCoinTap() {
  const coin = document.getElementById('coin');
  if (!coin) return;
  
  coin.style.transform = 'scale(.98)';
  setTimeout(() => {
    coin.style.transform = 'scale(1)';
  }, 80);
}

/**
 * Efecto ripple en tap
 */
function createRippleEffect(x, y) {
  const fx = document.getElementById('fx');
  if (!fx) return;
  
  const ctx = fx.getContext('2d');
  if (!ctx) return;
  
  const rect = fx.getBoundingClientRect();
  const rippleX = x - rect.left;
  const rippleY = y - rect.top;
  
  let radius = 0;
  const maxRadius = 80;
  const startTime = performance.now();
  
  function animateRipple(time) {
    const elapsed = time - startTime;
    const progress = elapsed / ANIM_CONFIG.RIPPLE_DURATION;
    
    if (progress >= 1) return;
    
    ctx.clearRect(0, 0, fx.width, fx.height);
    
    radius = maxRadius * progress;
    const alpha = 0.3 * (1 - progress);
    
    ctx.beginPath();
    ctx.arc(rippleX, rippleY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = `rgba(255, 216, 114, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    requestAnimationFrame(animateRipple);
  }
  
  requestAnimationFrame(animateRipple);
}

// === ANIMACIONES DE COMBO/VENTANA ===

/**
 * Animación del multiplicador de combo (badge)
 */
function animateComboMultiplier(level) {
  const comboBadge = document.getElementById('comboBadge');
  if (!comboBadge) return;
  
  comboBadge.style.transform = 'scale(1.06)';
  setTimeout(() => {
    comboBadge.style.transform = 'scale(1)';
  }, ANIM_CONFIG.COMBO_SCALE_DURATION);
}

/**
 * Flash del arco de ventana
 */
function arcFlash() {
  const windowArc = document.getElementById('windowArc');
  const windowArcCircle = windowArc?.querySelector('circle');
  
  if (!windowArc || !windowArcCircle) return;
  
  const prevDash = windowArcCircle.getAttribute('stroke-dasharray') || '360 360';
  const prevWidth = windowArcCircle.getAttribute('stroke-width') || '4';
  
  windowArcCircle.setAttribute('stroke-dasharray', '360 360');
  windowArcCircle.setAttribute('stroke-width', '6');
  windowArc.style.opacity = '1';
  
  setTimeout(() => {
    windowArcCircle.setAttribute('stroke-dasharray', prevDash);
    windowArcCircle.setAttribute('stroke-width', prevWidth);
  }, ANIM_CONFIG.FLASH_DURATION);
}

/**
 * Actualiza progreso del arco de ventana
 */
function arcUpdateProgress(level, progress) {
  const windowArc = document.getElementById('windowArc');
  const windowArcCircle = windowArc?.querySelector('circle');
  
  if (!windowArcCircle) return;
  
  const deg = Math.round((level / 6) * 360);
  const offset = Math.min(deg, deg * progress);
  
  windowArcCircle.setAttribute('stroke-dasharray', `${deg} 360`);
  windowArcCircle.setAttribute('stroke-dashoffset', String(offset));
  windowArc.style.opacity = '1';
}

/**
 * Mostrar segmento del arco
 */
function arcShowSegment(deg, level) {
  const windowArc = document.getElementById('windowArc');
  const windowArcCircle = windowArc?.querySelector('circle');
  
  if (!windowArc || !windowArcCircle) return;
  
  // Configurar colores según nivel
  setHaloArcColors(level);
  
  windowArcCircle.style.stroke = 'url(#haloArc)';
  windowArcCircle.setAttribute('stroke-width', '7');
  windowArcCircle.setAttribute('stroke-linecap', 'round');
  windowArcCircle.setAttribute('filter', 'url(#arcGlow)');
  windowArcCircle.setAttribute('stroke-dasharray', `${deg} 360`);
  windowArcCircle.setAttribute('stroke-dashoffset', '0');
  
  windowArc.style.opacity = '1';
}

/**
 * Ocultar arco
 */
function arcHide() {
  const windowArc = document.getElementById('windowArc');
  if (windowArc) windowArc.style.opacity = '0';
}

// === ANIMACIONES DE FRENZY ===

/**
 * Inicia animación del arco de Frenzy
 */
function startFrenzyArc() {
  const windowArc = document.getElementById('windowArc');
  const windowArcCircle = windowArc?.querySelector('circle');
  
  if (!windowArc || !windowArcCircle) return;
  
  windowArcCircle.style.stroke = 'url(#frenzy777)';
  windowArcCircle.setAttribute('stroke-dasharray', '360 360');
  windowArcCircle.setAttribute('stroke-dashoffset', '0');
  windowArc.style.opacity = '1';
  
  const t0 = performance.now();
  const FRENZY_MS = 5500; // desde tu configuración
  
  function tick() {
    const now = performance.now();
    const elapsed = Math.min(FRENZY_MS, now - t0);
    const offset = 360 * (elapsed / FRENZY_MS);
    
    windowArcCircle.setAttribute('stroke-dashoffset', String(offset));
    
    if (now < window.combo?.frenzyUntil || 0) {
      requestAnimationFrame(tick);
    } else {
      arcHide();
    }
  }
  
  requestAnimationFrame(tick);
}

// === ANIMACIONES DE DESAFÍO ARCOÍRIS ===

/**
 * Inicia animación del arco del desafío arcoíris
 */
function startChallengeArc() {
  const windowArc = document.getElementById('windowArc');
  const windowArcCircle = windowArc?.querySelector('circle');
  
  if (!windowArc || !windowArcCircle) return;
  
  windowArcCircle.style.stroke = 'url(#frenzy777)';
  windowArcCircle.setAttribute('stroke-dasharray', '360 360');
  windowArc.style.opacity = '1';
  
  const t0 = performance.now();
  
  function tick() {
    const now = performance.now();
    const offset = (now - t0) * 0.15;
    
    windowArcCircle.setAttribute('stroke-dashoffset', String(offset % 360));
    
    if (window.challenge?.active) {
      window.challenge.arcRaf = requestAnimationFrame(tick);
    } else {
      arcHide();
    }
  }
  
  if (window.challenge) {
    window.challenge.arcRaf = requestAnimationFrame(tick);
  }
}

/**
 * Para animación del arco del desafío
 */
function stopChallengeArc() {
  if (window.challenge?.arcRaf) {
    cancelAnimationFrame(window.challenge.arcRaf);
  }
  arcHide();
}

// === ANIMACIONES DE HOTSPOT ===

/**
 * Animación de aparición de hotspot
 */
function animateHotspotAppearance() {
  const hot = document.getElementById('hot');
  if (!hot) return;
  
  hot.style.transform = 'scale(0.8)';
  hot.style.opacity = '0';
  
  requestAnimationFrame(() => {
    hot.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    hot.style.transform = 'scale(1)';
    hot.style.opacity = '1';
  });
  
  setTimeout(() => {
    hot.style.transition = '';
  }, 300);
}

/**
 * Pulso de hotspot para indicar interactividad
 */
function pulseHotspot() {
  const hot = document.getElementById('hot');
  if (!hot) return;
  
  hot.style.animation = 'hotspotPulse 1s ease-in-out infinite';
}

/**
 * Para pulso de hotspot
 */
function stopHotspotPulse() {
  const hot = document.getElementById('hot');
  if (hot) hot.style.animation = '';
}

// === ANIMACIONES DE ENERGÍA ===

/**
 * Animación de deplección de energía
 */
function animateEnergyDepletion(currentEnergy, maxEnergy) {
  const energyFill = document.getElementById('energyFill');
  if (!energyFill) return;
  
  const percentage = Math.max(0, (currentEnergy / maxEnergy) * 100);
  energyFill.style.width = percentage + '%';
  
  // Cambiar color según nivel de energía
  if (percentage <= 20) {
    energyFill.style.background = 'linear-gradient(90deg, #ff4444, #ff6666)';
  } else if (percentage <= 50) {
    energyFill.style.background = 'linear-gradient(90deg, #ffaa44, #ffbb66)';
  } else {
    energyFill.style.background = 'linear-gradient(90deg, #7c5cff, #bdb3ff)';
  }
}

/**
 * Shake animación para energy baja/refill
 */
function shakeElement(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  element.classList.add('shake');
  setTimeout(() => {
    element.classList.remove('shake');
  }, 250);
}

// === ANIMACIONES DE DECOY ===

/**
 * Animación especial para decoys (señuelos)
 */
function createDecoyAnimation() {
  const hot = document.getElementById('hot');
  if (!hot) return;
  
  // Efecto de "falso oro" que se desvanece
  hot.style.filter = 'hue-rotate(180deg) saturate(0.3)';
  
  setTimeout(() => {
    hot.style.filter = '';
  }, 200);
}

// === UTILITARIOS DE CONFIGURACIÓN DE COLORES ===

/**
 * Configura colores del gradiente del arco según nivel
 */
function setHaloArcColors(level) {
  const ARC_SKIN = {
    1: { c1: '#FFD872', c2: '#8a6b1f' },
    2: { c1: '#9CFF70', c2: '#3f8f33' },
    3: { c1: '#6AE1FF', c2: '#2b93b8' },
    4: { c1: '#D08BFF', c2: '#7d3ca3' },
    5: { c1: '#FF6A6A', c2: '#a83232' }
  };
  
  const g = document.querySelector('#windowArc #haloArc');
  if (!g) return;
  
  const stops = g.querySelectorAll('stop');
  const skin = ARC_SKIN[level] || ARC_SKIN[1];
  
  if (stops[1]) stops[1].setAttribute('stop-color', skin.c1);
  if (stops[2]) stops[2].setAttribute('stop-color', skin.c2);
}

// === ANIMACIONES DE TAG/VENTANA ===

/**
 * Muestra tag de ventana con animación
 */
function tagShow(text, color) {
  const windowTag = document.getElementById('windowTag');
  if (!windowTag) return;
  
  windowTag.textContent = text;
  if (color) windowTag.style.color = color;
  windowTag.style.opacity = '1';
  windowTag.style.transform = 'scale(1.06)';
  
  setTimeout(() => {
    windowTag.style.transform = 'scale(1)';
  }, ANIM_CONFIG.COMBO_SCALE_DURATION);
}

/**
 * Oculta tag de ventana
 */
function tagHide() {
  const windowTag = document.getElementById('windowTag');
  if (!windowTag) return;
  
  windowTag.style.opacity = '0';
  windowTag.style.transform = 'scale(.9)';
}

// === SISTEMA DE ANIMACIÓN DE INCREMENTO DE PUNTUACIÓN ===

/**
 * Anima incremento de puntuación en tiempo real
 */
function animateScoreIncrease(element, oldValue, newValue, duration = 800) {
  if (!element) return;
  
  const start = performance.now();
  const diff = newValue - oldValue;
  
  function update(time) {
    const elapsed = time - start;
    const progress = Math.min(elapsed / duration, 1);
    
    const currentValue = oldValue + (diff * progress);
    element.textContent = fmt(currentValue);
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

// === EXPORTAR API PRINCIPAL ===
export {
  // Ganancias
  showGain,
  spawnGain,
  setLastGainTotal,
  
  // Labels y stickers
  popLabel,
  popLaugh,
  popBadge,
  popSparkle,
  popSparkleSilent,
  
  // Moneda
  createCoinFlash,
  animateCoinTap,
  createRippleEffect,
  
  // Combos y ventanas
  animateComboMultiplier,
  arcFlash,
  arcUpdateProgress,
  arcShowSegment,
  arcHide,
  
  // Frenzy
  startFrenzyArc,
  
  // Rainbow Challenge
  startChallengeArc,
  stopChallengeArc,
  
  // Hotspots
  animateHotspotAppearance,
  pulseHotspot,
  stopHotspotPulse,
  
  // Energía
  animateEnergyDepletion,
  shakeElement,
  
  // Decoys
  createDecoyAnimation,
  
  // Tags
  tagShow,
  tagHide,
  
  // Utilidades
  setHaloArcColors,
  animateScoreIncrease,
  
  // Configuración
  ANIM_CONFIG
};