/**
 * hotspots.js - Sistema de Hotspots RainbowGold Tap
 * Gestiona manchas dinámicas, spawn inteligente, colisiones y efectos visuales
 */

// === CONFIGURACIÓN DE HOTSPOTS ===
const HOTSPOT_CONFIG = {
  // Tiempos de aparición por nivel (ms) [min, max]
  APPEAR_MS: {
    1: [1600, 2400],
    2: [1400, 2000], 
    3: [1100, 1600],
    4: [900, 1300],
    5: [700, 1000],
    decoy: [650, 900],
    rb: [2500, 3200]  // Rainbow spots
  },
  
  // Cooldowns entre spawns automáticos
  AUTO_COOLDOWN: {
    MIN: 2800,
    MAX: 4400
  },
  
  // Configuración visual y de colisión
  MARGIN: {
    MIN: 15,  // % mínimo desde bordes
    MAX: 85   // % máximo desde bordes
  }
};

// === SKINS/APARIENCIAS DE HOTSPOTS ===
const HOTSPOT_SKINS = {
  // Niveles normales X1-X5
  x1: { 
    c1: '#FFD872', c2: '#8a6b1f', 
    coreR: 10, glowR: 18,
    name: 'Oro'
  },
  x2: { 
    c1: '#9CFF70', c2: '#3f8f33', 
    coreR: 9, glowR: 16,
    name: 'Esmeralda'
  },
  x3: { 
    c1: '#6AE1FF', c2: '#2b93b8', 
    coreR: 8, glowR: 14,
    name: 'Zafiro'
  },
  x4: { 
    c1: '#D08BFF', c2: '#7d3ca3', 
    coreR: 7, glowR: 12,
    name: 'Amatista'
  },
  x5: { 
    c1: '#FF6A6A', c2: '#a83232', 
    coreR: 6, glowR: 10,
    name: 'Rubí'
  },
  
  // Especiales
  decoy: { 
    c1: '#A0A6FF', c2: '#4b4fa0', 
    coreR: 9, glowR: 14,
    name: 'Señuelo'
  },
  rb: { 
    c1: '#7aa0ff', c2: '#aa66ff', 
    coreR: 9, glowR: 16,
    name: 'Arcoíris'
  }
};

// === SISTEMA DE HOTSPOTS ===
class HotspotSystem {
  constructor() {
    this.state = {
      active: false,
      skin: 'x1',
      centerX: 50,        // % relativo a la moneda
      centerY: 50,        // % relativo a la moneda
      coreRadius: 10,     // % radio del núcleo (hit real)
      glowRadius: 20,     // % radio del halo (solo visual)
      locked: false,      // si está bloqueado por ventana activa
      autoTimer: 0,       // timeout para auto-hide
      spawning: false     // si está en proceso de spawn automático
    };
    
    // Referencias DOM
    this.elements = {};
    this.initElements();
    
    // Callbacks externos
    this.callbacks = {};
    
    // Configuración
    this.useAutoSpawn = false;  // modo TAP vs TIEMPO
  }

  // === INICIALIZACIÓN ===
  initElements() {
    this.elements = {
      coin: document.getElementById('coin'),
      hot: document.getElementById('hot'),
      hotCore: document.getElementById('hotCore')
    };
  }

  setCallbacks(callbacks) {
    this.callbacks = {
      onHotspotHit: callbacks.onHotspotHit || (() => {}),
      onDecoyHit: callbacks.onDecoyHit || (() => {}),
      onHotspotTimeout: callbacks.onHotspotTimeout || (() => {}),
      animateHotspotAppearance: callbacks.animateHotspotAppearance || (() => {}),
      playSound: callbacks.playSound || (() => {}),
      ...callbacks
    };
  }

  // === UTILIDADES ===
  rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  randInt(a, b) {
    return (a | 0) + Math.floor(Math.random() * ((b | 0) - (a | 0) + 1));
  }

  // === RENDERIZADO VISUAL ===
  
  /**
   * Dibuja el hotspot con efectos visuales avanzados
   */
  drawHotspot() {
    const { hot, hotCore } = this.elements;
    if (!hot) return;

    const skin = HOTSPOT_SKINS[this.state.skin] || HOTSPOT_SKINS.x1;
    const { c1, c2 } = skin;
    const { centerX: cx, centerY: cy, glowRadius: r } = this.state;

    // === HALO PRINCIPAL (compacto sin ondas) ===
    const mainGradient = `radial-gradient(circle at ${cx}% ${cy}%,
      rgba(255,255,255,.88) 0%,
      ${c1} 10%,
      ${c1} ${Math.round(r * 0.35)}%,
      ${c2} ${Math.round(r * 0.55)}%,
      transparent ${r}%
    )`;

    hot.style.background = mainGradient;
    hot.style.webkitMaskImage = 'none';
    hot.style.maskImage = 'none';
    hot.style.filter = 'blur(0.8px)';
    hot.style.mixBlendMode = 'normal';

    // === NÚCLEO DE COLISIÓN ===
    if (hotCore) {
      const coreR = this.state.coreRadius;
      
      hotCore.style.left = cx + '%';
      hotCore.style.top = cy + '%';
      hotCore.style.width = (coreR * 2) + '%';
      hotCore.style.height = (coreR * 2) + '%';
      hotCore.style.transform = 'translate(-50%,-50%)';
      hotCore.style.borderRadius = '50%';
      
      // Invisible pero presente para hit-testing
      hotCore.style.opacity = '0';
      hotCore.style.background = 'transparent';
      hotCore.style.boxShadow = 'none';
      hotCore.style.pointerEvents = 'none';
    }
  }

  /**
   * Genera posición aleatoria válida
   */
  generateRandomPosition() {
    const { MIN, MAX } = HOTSPOT_CONFIG.MARGIN;
    
    this.state.centerX = Math.random() * (MAX - MIN) + MIN;
    this.state.centerY = Math.random() * (MAX - MIN) + MIN;
  }

  /**
   * Configura skin y propiedades visuales
   */
  applySkin(skinName) {
    const skin = HOTSPOT_SKINS[skinName];
    if (!skin) return;

    this.state.skin = skinName;
    this.state.coreRadius = skin.coreR;
    this.state.glowRadius = skin.glowR;
  }

  // === SISTEMA DE SPAWN ===

  /**
   * Muestra hotspot con skin específica
   * @param {string} skinName - Nombre del skin (x1, x2, decoy, etc.)
   * @param {Object} options - Opciones adicionales
   */
  show(skinName = null, options = {}) {
    if (!this.elements.hot) return;

    // Determinar skin
    if (skinName) {
      this.applySkin(skinName);
    } else {
      // Skin aleatoria para demo
      const skins = ['x1', 'x2', 'x3', 'x4', 'x5', 'decoy'];
      this.applySkin(skins[Math.floor(Math.random() * skins.length)]);
    }

    // Posición (custom o aleatoria)
    if (options.x !== undefined && options.y !== undefined) {
      this.state.centerX = options.x;
      this.state.centerY = options.y;
    } else {
      this.generateRandomPosition();
    }

    // Renderizar
    this.drawHotspot();
    
    // Estado y visibilidad
    this.state.active = true;
    this.elements.hot.style.opacity = '1';
    
    // Animación de aparición
    this.callbacks.animateHotspotAppearance();
    
    // Audio opcional
    if (options.playSound !== false) {
      this.playSpawnSound(this.state.skin);
    }

    // Auto-hide solo si no está en modo TAP
    if (!this.useAutoSpawn && !options.persistent) {
      this.scheduleAutoHide();
    }

    return this;
  }

  /**
   * Spawn con timer automático (para modo TAP)
   */
  showWithTimer(skinName = null, options = {}) {
    this.show(skinName, { ...options, playSound: false });
    
    this.state.locked = false;
    clearTimeout(this.state.autoTimer);

    // Determinar duración según skin
    const key = (this.state.skin === 'decoy' || this.state.skin === 'rb') ? 
                this.state.skin : 
                Math.max(1, Math.min(5, parseInt(this.state.skin.slice(1), 10)));
    
    const range = HOTSPOT_CONFIG.APPEAR_MS[key] || HOTSPOT_CONFIG.APPEAR_MS[1];
    const duration = this.randInt(range[0], range[1]);

    this.state.autoTimer = setTimeout(() => {
      if (!this.state.locked) {
        this.hide();
        this.callbacks.onHotspotTimeout();
      }
    }, duration);

    return this;
  }

  /**
   * Programa auto-hide para modo TIEMPO
   */
  scheduleAutoHide() {
    const HOT_SHOW_MS = 1600;
    
    setTimeout(() => {
      if (this.state.locked) return;
      this.hide();
      this.scheduleNextSpawn();
    }, HOT_SHOW_MS);
  }

  /**
   * Programa próximo spawn automático
   */
  scheduleNextSpawn() {
    if (this.state.spawning) return;
    
    const { MIN, MAX } = HOTSPOT_CONFIG.AUTO_COOLDOWN;
    const cooldown = Math.round(this.rand(MIN, MAX));
    
    this.state.spawning = true;
    
    setTimeout(() => {
      this.state.spawning = false;
      if (!this.useAutoSpawn) {
        this.show();
      }
    }, cooldown);
  }

  /**
   * Oculta el hotspot
   */
  hide() {
    if (!this.elements.hot) return;
    
    this.state.active = false;
    this.elements.hot.style.opacity = '0';
    
    if (this.elements.hotCore) {
      this.elements.hotCore.style.opacity = '0';
    }
    
    clearTimeout(this.state.autoTimer);
    return this;
  }

  // === DETECCIÓN DE COLISIONES ===

  /**
   * Verifica si un evento está dentro del núcleo del hotspot
   * @param {Event} event - Evento de tap/click
   * @returns {boolean} True si el tap está en el núcleo
   */
  isHit(event) {
    if (!this.state.active || !this.elements.coin) return false;
    
    // Los decoys nunca cuentan como hit válido
    if (this.state.skin === 'decoy') return false;
    
    const coinRect = this.elements.coin.getBoundingClientRect();
    const x = ((event.clientX - coinRect.left) / coinRect.width) * 100;
    const y = ((event.clientY - coinRect.top) / coinRect.height) * 100;
    
    const dx = x - this.state.centerX;
    const dy = y - this.state.centerY;
    const distance = Math.hypot(dx, dy);
    
    return distance <= this.state.coreRadius;
  }

  /**
   * Verifica hit en el núcleo usando elemento DOM (más preciso para ventanas)
   * @param {Event} event - Evento de tap/click
   * @returns {boolean} True si está en el área del núcleo
   */
  isInCore(event) {
    if (!this.state.active || !this.elements.hotCore || !this.elements.coin) {
      return false;
    }
    
    const coinRect = this.elements.coin.getBoundingClientRect();
    const coreRect = this.elements.hotCore.getBoundingClientRect();
    
    const x = (event.clientX - coinRect.left) / coinRect.width;
    const y = (event.clientY - coinRect.top) / coinRect.height;
    
    const core = {
      x: (coreRect.left - coinRect.left) / coinRect.width,
      y: (coreRect.top - coinRect.top) / coinRect.height,
      w: coreRect.width / coinRect.width,
      h: coreRect.height / coinRect.height
    };
    
    return (x >= core.x && x <= core.x + core.w && 
            y >= core.y && y <= core.y + core.h);
  }

  /**
   * Verifica si es un hit de decoy
   * @param {Event} event - Evento de tap/click
   * @returns {boolean} True si tocó un decoy
   */
  isDecoyHit(event) {
    return this.state.active && 
           this.state.skin === 'decoy' && 
           this.isInCore(event);
  }

  /**
   * Verifica si es un hit de mancha arcoíris
   * @param {Event} event - Evento de tap/click
   * @returns {boolean} True si tocó mancha arcoíris
   */
  isRainbowHit(event) {
    return this.state.active && 
           this.state.skin === 'rb' && 
           this.isHit(event);
  }

  // === GESTIÓN DE ESTADO ===

  /**
   * Bloquea/desbloquea el hotspot (para ventanas activas)
   * @param {boolean} locked - Si debe estar bloqueado
   */
  setLocked(locked) {
    this.state.locked = !!locked;
    if (this.state.locked) {
      clearTimeout(this.state.autoTimer);
    }
  }

  /**
   * Configura modo de spawn (TAP vs TIEMPO)
   * @param {boolean} useTapSpawn - True para modo TAP, false para modo TIEMPO
   */
  setSpawnMode(useTapSpawn) {
    this.useAutoSpawn = !useTapSpawn;
    
    if (!useTapSpawn && !this.state.spawning) {
      // Iniciar ciclo automático
      this.scheduleNextSpawn();
    }
  }

  /**
   * Procesa un tap del usuario
   * @param {Event} event - Evento de tap/click
   * @returns {Object} Resultado del tap
   */
  processTap(event) {
    if (!this.state.active) {
      return { hit: false, type: 'miss' };
    }

    // Verificar diferentes tipos de hit
    if (this.isRainbowHit(event)) {
      this.callbacks.onHotspotHit(event, 'rainbow', this.state.skin);
      return { hit: true, type: 'rainbow', skin: this.state.skin };
    }

    if (this.isDecoyHit(event)) {
      this.callbacks.onDecoyHit(event, this.state.skin);
      return { hit: true, type: 'decoy', skin: this.state.skin };
    }

    if (this.isHit(event)) {
      this.callbacks.onHotspotHit(event, 'normal', this.state.skin);
      return { hit: true, type: 'normal', skin: this.state.skin };
    }

    return { hit: false, type: 'miss' };
  }

  // === EFECTOS VISUALES ===

  /**
   * Pulso visual para indicar interactividad
   */
  startPulse() {
    if (this.elements.hot) {
      this.elements.hot.style.animation = 'hotspotPulse 1s ease-in-out infinite';
    }
  }

  /**
   * Para el pulso visual
   */
  stopPulse() {
    if (this.elements.hot) {
      this.elements.hot.style.animation = '';
    }
  }

  /**
   * Efecto especial para decoys al ser tocados
   */
  playDecoyEffect() {
    if (!this.elements.hot) return;
    
    const originalFilter = this.elements.hot.style.filter;
    this.elements.hot.style.filter = 'hue-rotate(180deg) saturate(0.3)';
    
    setTimeout(() => {
      this.elements.hot.style.filter = originalFilter;
    }, 200);
  }

  // === AUDIO ===
  playSpawnSound(skinName) {
    // Diferentes sonidos según el tipo de hotspot
    const soundMap = {
      'x1': () => this.callbacks.playSound?.('spawn_gold'),
      'x2': () => this.callbacks.playSound?.('spawn_green'),
      'x3': () => this.callbacks.playSound?.('spawn_blue'),
      'x4': () => this.callbacks.playSound?.('spawn_purple'),
      'x5': () => this.callbacks.playSound?.('spawn_red'),
      'decoy': () => this.callbacks.playSound?.('spawn_decoy'),
      'rb': () => this.callbacks.playSound?.('spawn_rainbow')
    };

    const soundFn = soundMap[skinName];
    if (soundFn) {
      soundFn();
    }
  }

  // === API DE INFORMACIÓN ===

  /**
   * Obtiene el estado actual del sistema
   */
  getState() {
    return {
      active: this.state.active,
      skin: this.state.skin,
      skinName: HOTSPOT_SKINS[this.state.skin]?.name || 'Unknown',
      position: {
        x: this.state.centerX,
        y: this.state.centerY
      },
      dimensions: {
        coreRadius: this.state.coreRadius,
        glowRadius: this.state.glowRadius
      },
      locked: this.state.locked,
      spawning: this.state.spawning,
      useAutoSpawn: this.useAutoSpawn
    };
  }

  /**
   * Obtiene información de todos los skins disponibles
   */
  getAvailableSkins() {
    return Object.keys(HOTSPOT_SKINS).map(key => ({
      id: key,
      name: HOTSPOT_SKINS[key].name,
      colors: {
        primary: HOTSPOT_SKINS[key].c1,
        secondary: HOTSPOT_SKINS[key].c2
      },
      dimensions: {
        coreRadius: HOTSPOT_SKINS[key].coreR,
        glowRadius: HOTSPOT_SKINS[key].glowR
      }
    }));
  }

  /**
   * Verifica si hay un hotspot activo
   */
  isActive() {
    return this.state.active;
  }

  /**
   * Obtiene el skin actual
   */
  getCurrentSkin() {
    return this.state.skin;
  }

  // === TESTING Y DEBUG ===

  /**
   * Spawn forzado para testing
   */
  debugSpawn(skinName, x, y) {
    return this.show(skinName, { x, y, persistent: true });
  }

  /**
   * Información de debug
   */
  getDebugInfo() {
    return {
      ...this.getState(),
      config: HOTSPOT_CONFIG,
      skins: HOTSPOT_SKINS,
      elements: Object.keys(this.elements).reduce((acc, key) => {
        acc[key] = !!this.elements[key];
        return acc;
      }, {})
    };
  }

  // === CLEANUP ===

  /**
   * Limpieza completa del sistema
   */
  destroy() {
    this.hide();
    clearTimeout(this.state.autoTimer);
    this.state.spawning = false;
    
    // Limpiar referencias
    this.callbacks = {};
    this.elements = {};
  }
}

// === INSTANCIA SINGLETON ===
let hotspotSystemInstance = null;

/**
 * Inicializa el sistema de hotspots
 * @param {Object} callbacks - Callbacks para interactuar con otros sistemas
 * @returns {HotspotSystem} Instancia del sistema
 */
export function initHotspotSystem(callbacks = {}) {
  if (!hotspotSystemInstance) {
    hotspotSystemInstance = new HotspotSystem();
  }
  
  hotspotSystemInstance.setCallbacks(callbacks);
  return hotspotSystemInstance;
}

/**
 * Obtiene la instancia actual del sistema de hotspots
 */
export function getHotspotSystem() {
  return hotspotSystemInstance;
}

/**
 * API simplificada para uso rápido
 */
export const HotspotAPI = {
  // Spawn y control
  show: (skin, options) => hotspotSystemInstance?.show(skin, options),
  showWithTimer: (skin, options) => hotspotSystemInstance?.showWithTimer(skin, options),
  hide: () => hotspotSystemInstance?.hide(),
  
  // Detección de colisiones
  isHit: (event) => hotspotSystemInstance?.isHit(event) || false,
  isInCore: (event) => hotspotSystemInstance?.isInCore(event) || false,
  isDecoyHit: (event) => hotspotSystemInstance?.isDecoyHit(event) || false,
  isRainbowHit: (event) => hotspotSystemInstance?.isRainbowHit(event) || false,
  processTap: (event) => hotspotSystemInstance?.processTap(event),
  
  // Estado y configuración
  setLocked: (locked) => hotspotSystemInstance?.setLocked(locked),
  setSpawnMode: (useTapSpawn) => hotspotSystemInstance?.setSpawnMode(useTapSpawn),
  isActive: () => hotspotSystemInstance?.isActive() || false,
  getCurrentSkin: () => hotspotSystemInstance?.getCurrentSkin() || 'x1',
  getState: () => hotspotSystemInstance?.getState(),
  
  // Efectos
  startPulse: () => hotspotSystemInstance?.startPulse(),
  stopPulse: () => hotspotSystemInstance?.stopPulse(),
  playDecoyEffect: () => hotspotSystemInstance?.playDecoyEffect(),
  
  // Testing
  debugSpawn: (skin, x, y) => hotspotSystemInstance?.debugSpawn(skin, x, y),
  getDebugInfo: () => hotspotSystemInstance?.getDebugInfo(),
  
  // Cleanup
  destroy: () => {
    hotspotSystemInstance?.destroy();
    hotspotSystemInstance = null;
  }
};

// === CONFIGURACIÓN EXPORTADA ===
export const HOTSPOT_SETTINGS = HOTSPOT_CONFIG;
export const HOTSPOT_SKINS_EXPORT = HOTSPOT_SKINS;

// === COMPATIBILIDAD CON FUNCIONES GLOBALES ===
export const LegacyAPI = {
  showHot: (skin) => HotspotAPI.show(skin),
  hideHot: () => HotspotAPI.hide(),
  isInHot: (event) => HotspotAPI.isHit(event),
  isInHotCore: (event) => HotspotAPI.isInCore(event)
};

// === EXPORTACIÓN PRINCIPAL ===
export default {
  HotspotSystem,
  initHotspotSystem,
  getHotspotSystem,
  HotspotAPI,
  LegacyAPI,
  HOTSPOT_SETTINGS,
  HOTSPOT_SKINS_EXPORT
};