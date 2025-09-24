/**
 * engine.js - Motor Principal RainbowGold Tap
 * Orquesta todos los sistemas: audio, animaciones, combos, hotspots, energía, etc.
 */

// Imports de sistemas
import AudioManager from './audio-manager.js';
import * as Animations from './animations.js';
import ComboSystem, { ComboAPI } from './combo-system.js';
import HotspotSystem, { HotspotAPI } from './hotspots.js';

// === CONFIGURACIÓN DEL MOTOR ===
const ENGINE_CONFIG = {
  // Valores base del juego
  BASE_CAP: 100,
  BASE_REGEN_PER_SEC: 0.5,
  POWER_BASE: 0.1000,
  
  // Cooldown de energía vacía (ms)
  NO_ENERGY_COOLDOWN: 2000,
  
  // Umbral de energía baja para efectos visuales
  LOW_ENERGY_THRESHOLD: 50,
  
  // Spawn por taps
  USE_TAP_SPAWN: true,
  
  // Persistencia
  STORAGE_KEYS: {
    WLD: 'wld',
    RBGP: 'rbgp', 
    ENERGY: 'energy',
    LAST_TS: 'last_ts',
    USERNAME: 'username',
    LANGUAGE: 'language'
  }
};

// === MOTOR PRINCIPAL ===
class GameEngine {
  constructor() {
    this.systems = {};
    this.state = {
      // Balances
      wld: 0,
      rbgp: 0,
      energy: ENGINE_CONFIG.BASE_CAP,
      lastTimestamp: Date.now(),
      
      // Cooldowns y estados
      noEnergyUntil: 0,
      lastGainTotal: 0,
      
      // Configuración
      username: '',
      language: 'es',
      
      // Estado de UI
      isInitialized: false,
      isPaused: false
    };
    
    // Referencias DOM principales  
    this.elements = {};
    
    // Callbacks de UI externa
    this.uiCallbacks = {};
    
    this.initializeEngine();
  }

  // === INICIALIZACIÓN ===
  async initializeEngine() {
    console.log('🎮 Inicializando RainbowGold Engine...');
    
    try {
      // 1. Cargar estado persistente
      this.loadState();
      
      // 2. Inicializar elementos DOM
      this.initElements();
      
      // 3. Inicializar sistemas
      await this.initSystems();
      
      // 4. Configurar event listeners
      this.setupEventListeners();
      
      // 5. Iniciar loops principales
      this.startGameLoops();
      
      // 6. Renderizado inicial
      this.render();
      
      this.state.isInitialized = true;
      console.log('✅ RainbowGold Engine inicializado correctamente');
      
    } catch (error) {
      console.error('❌ Error inicializando engine:', error);
    }
  }

  initElements() {
    this.elements = {
      // Elementos principales
      coin: document.getElementById('coin'),
      gain: document.getElementById('gain'),
      
      // UI de balances
      balWLD: document.getElementById('balWLD'),
      balRBGp: document.getElementById('balRBGp'),
      
      // Sistema de energía
      energyFill: document.getElementById('energyFill'),
      energyNow: document.getElementById('energyNow'),
      energyMax: document.getElementById('energyMax'),
      
      // Botones principales
      refillBtn: document.getElementById('refillBtn'),
      refillPrice: document.getElementById('refillPrice'),
      
      // Canvas de efectos
      fx: document.getElementById('fx')
    };

    // Configurar canvas si existe
    if (this.elements.fx) {
      const rect = this.elements.coin?.getBoundingClientRect();
      if (rect) {
        this.elements.fx.width = rect.width;
        this.elements.fx.height = rect.height;
      }
    }
  }

  async initSystems() {
    console.log('🔧 Inicializando sistemas...');

    // === SISTEMA DE AUDIO ===
    this.systems.audio = AudioManager;
    await this.systems.audio.initializeAudio();
    console.log('🔊 Sistema de audio listo');

    // === SISTEMA DE COMBOS ===
    this.systems.combo = ComboSystem.initComboSystem({
      // Callbacks hacia engine
      addTapAmount: (amount) => this.addTapAmount(amount),
      getPowerBase: () => ENGINE_CONFIG.POWER_BASE,
      
      // Audio callbacks
      playSnd: (name, options) => this.systems.audio.playSnd(name, options),
      stopSnd: (name) => this.systems.audio.stopSnd(name),
      tone: (freq, dur, type, vol) => this.systems.audio.tone(freq, dur, type, vol),
      setTickModeMp3: (use) => this.systems.audio.setTickModeMp3(use),
      
      // Animación callbacks
      popLabel: Animations.popLabel,
      popBadge: Animations.popBadge,
      popSparkle: Animations.popSparkle,
      popSparkleSilent: Animations.popSparkleSilent,
      arcFlash: Animations.arcFlash,
      tagShow: Animations.tagShow,
      tagHide: Animations.tagHide,
      
      // Hotspot callbacks (se configuran después)
      showHot: null, // Se asigna después
      hideHot: null,
      isHotspotHit: null,
      isRainbowHit: null,
      isDecoyHit: null,
      getHotspotSkin: null
    });
    console.log('🎯 Sistema de combos listo');

    // === SISTEMA DE HOTSPOTS ===
    this.systems.hotspot = HotspotSystem.initHotspotSystem({
      // Callbacks hacia combo system
      onHotspotHit: (event, type, skin) => this.handleHotspotHit(event, type, skin),
      onDecoyHit: (event, skin) => this.handleDecoyHit(event, skin),
      onHotspotTimeout: () => this.handleHotspotTimeout(),
      
      // Audio
      playSound: (name, options) => this.systems.audio.playSnd(name, options),
      
      // Animaciones
      animateHotspotAppearance: Animations.animateHotspotAppearance
    });
    
    // Configurar modo spawn
    this.systems.hotspot.setSpawnMode(ENGINE_CONFIG.USE_TAP_SPAWN);
    console.log('🎨 Sistema de hotspots listo');

    // === CONECTAR SISTEMAS ===
    // Hotspot callbacks para combo system
    this.systems.combo.setCallbacks({
      ...this.systems.combo.callbacks,
      showHot: (skin) => this.systems.hotspot.showWithTimer(skin),
      hideHot: () => this.systems.hotspot.hide(),
      isHotspotHit: (event) => this.systems.hotspot.isHit(event),
      isRainbowHit: (event) => this.systems.hotspot.isRainbowHit(event),
      isDecoyHit: (event) => this.systems.hotspot.isDecoyHit(event),
      getHotspotSkin: () => this.systems.hotspot.getCurrentSkin(),
      setHotspotLock: (locked) => this.systems.hotspot.setLocked(locked)
    });

    console.log('🔗 Sistemas interconectados');
  }

  // === GESTIÓN DE ESTADO ===
  loadState() {
    const keys = ENGINE_CONFIG.STORAGE_KEYS;
    
    this.state.wld = +localStorage.getItem(keys.WLD) || 0;
    this.state.rbgp = +localStorage.getItem(keys.RBGP) || 0;
    this.state.energy = +localStorage.getItem(keys.ENERGY);
    this.state.lastTimestamp = +localStorage.getItem(keys.LAST_TS) || Date.now();
    this.state.username = localStorage.getItem(keys.USERNAME) || '';
    this.state.language = localStorage.getItem(keys.LANGUAGE) || 'es';
    
    // Validar energía
    if (isNaN(this.state.energy)) {
      this.state.energy = ENGINE_CONFIG.BASE_CAP;
    }
    
    console.log('📁 Estado cargado:', {
      wld: this.state.wld,
      rbgp: this.state.rbgp,
      energy: this.state.energy
    });
  }

  saveState() {
    const keys = ENGINE_CONFIG.STORAGE_KEYS;
    
    localStorage.setItem(keys.WLD, String(this.state.wld));
    localStorage.setItem(keys.RBGP, String(this.state.rbgp));
    localStorage.setItem(keys.ENERGY, String(this.state.energy));
    localStorage.setItem(keys.LAST_TS, String(this.state.lastTimestamp));
    localStorage.setItem(keys.USERNAME, this.state.username);
    localStorage.setItem(keys.LANGUAGE, this.state.language);
  }

  // === MECÁNICAS DE JUEGO PRINCIPALES ===

  /**
   * Procesa un tap/click en la moneda
   */
  handleCoinTap(event) {
    if (this.state.isPaused || !this.state.isInitialized) return;

    const now = performance.now();
    
    // Verificar cooldown de energía vacía
    if (now < this.state.noEnergyUntil) {
      this.handleNoEnergyTap();
      return;
    }

    // Verificar energía disponible
    if (this.state.energy <= 0) {
      this.startNoEnergyCooldown();
      this.handleNoEnergyTap();
      return;
    }

    // === TAP VÁLIDO ===
    
    // 1. Consumir energía
    this.consumeEnergy(1);
    
    // 2. Ganancia base
    this.addTapAmount(ENGINE_CONFIG.POWER_BASE);
    
    // 3. Efectos visuales base
    this.createTapEffects(event);
    
    // 4. Procesar combo system
    this.systems.combo.handleTap(event);
    
    // 5. Manejo de spawn por taps
    if (ENGINE_CONFIG.USE_TAP_SPAWN) {
      this.systems.combo.handleTapSpawn();
    }
    
    // 6. Actualizar UI
    this.render();
    
    // 7. Persistir estado
    this.saveState();
  }

  /**
   * Añade cantidad a RBGp
   */
  addTapAmount(amount) {
    if (!amount || amount <= 0) return;
    
    this.state.rbgp += amount;
    this.state.lastGainTotal = amount;
    
    // Actualizar elemento lastGain si existe
    Animations.setLastGainTotal(this.state.lastGainTotal);
  }

  /**
   * Consume energía
   */
  consumeEnergy(amount) {
    this.state.energy = Math.max(0, this.state.energy - amount);
    this.state.lastTimestamp = Date.now();
  }

  /**
   * Inicia cooldown por energía vacía
   */
  startNoEnergyCooldown() {
    this.state.noEnergyUntil = performance.now() + ENGINE_CONFIG.NO_ENERGY_COOLDOWN;
  }

  /**
   * Maneja tap cuando no hay energía
   */
  handleNoEnergyTap() {
    // Shake del botón refill
    Animations.shakeElement('refillBtn');
    
    // Audio de fallo
    this.systems.audio.tone(300, 0.1, 'sawtooth', 0.05);
    
    console.log('⚡ Sin energía - usa Refill');
  }

  /**
   * Efectos visuales base del tap
   */
  createTapEffects(event) {
    // Animación de escala de moneda
    Animations.animateCoinTap();
    
    // Efecto ripple
    Animations.createRippleEffect(event.clientX, event.clientY);
    
    // Flash de moneda en combos
    if (this.systems.combo.hasActiveWindow()) {
      Animations.createCoinFlash();
    }
    
    // Mostrar ganancia flotante
    Animations.showGain(
      event.clientX, 
      event.clientY, 
      `+${this.state.lastGainTotal.toFixed(4)}`
    );
  }

  // === MANEJO DE HOTSPOTS ===
  handleHotspotHit(event, type, skin) {
    console.log(`🎯 Hotspot hit: ${type} (${skin})`);
    
    // Audio de éxito
    this.systems.audio.playSnd('nice', { volume: 0.8 });
    
    // Efecto visual de éxito
    Animations.popSparkleSilent(event.clientX, event.clientY);
  }

  handleDecoyHit(event, skin) {
    console.log(`🤡 Decoy hit: ${skin}`);
    
    // Laugh visual y audio
    Animations.popLaugh(event.clientX, event.clientY);
    this.systems.audio.playSnd('laugh', { volume: 0.9 });
    
    // Efecto especial del hotspot
    this.systems.hotspot.playDecoyEffect();
  }

  handleHotspotTimeout() {
    console.log('⏰ Hotspot timeout');
    // Lógica adicional si necesaria
  }

  // === REGENERACIÓN DE ENERGÍA ===
  updateEnergyRegen() {
    const now = Date.now();
    
    // No regenerar durante cooldown
    if (performance.now() < this.state.noEnergyUntil) {
      this.state.lastTimestamp = now;
      this.saveState();
      return;
    }
    
    const deltaTime = (now - this.state.lastTimestamp) / 1000;
    this.state.lastTimestamp = now;
    
    const maxEnergy = this.getMaxEnergy();
    const regenRate = this.getRegenRate();
    
    this.state.energy = Math.min(maxEnergy, this.state.energy + regenRate * deltaTime);
    this.saveState();
  }

  getMaxEnergy() {
    return ENGINE_CONFIG.BASE_CAP;
  }

  getRegenRate() {
    return ENGINE_CONFIG.BASE_REGEN_PER_SEC;
  }

  // === REFILL SYSTEM ===
  handleRefill() {
    const cost = this.getRefillCost();
    
    if (this.state.wld < cost) {
      console.log('💰 Insufficient WLD for refill');
      Animations.shakeElement('refillBtn');
      return false;
    }
    
    // Consumir WLD
    this.state.wld -= cost;
    
    // Restaurar energía
    this.state.energy = this.getMaxEnergy();
    
    // Limpiar cooldown
    this.state.noEnergyUntil = 0;
    
    // Efectos visuales
    const refillBtn = this.elements.refillBtn;
    if (refillBtn) {
      const rect = refillBtn.getBoundingClientRect();
      Animations.popLabel('⚡ REFILL!', 
        rect.left + rect.width / 2, 
        rect.top + rect.height / 2,
        { color: '#00ff88', fontSize: 24 }
      );
    }
    
    // Audio
    this.systems.audio.playSnd('nice', { volume: 1.0 });
    
    this.render();
    this.saveState();
    
    console.log(`⚡ Refill completed - Cost: ${cost} WLD`);
    return true;
  }

  getRefillCost() {
    return +(this.getMaxEnergy() * 0.001).toFixed(2); // 0.1% de capacidad
  }

  // === RENDERIZADO DE UI ===
  render() {
    this.renderBalances();
    this.renderEnergy();
    this.renderRefillButton();
  }

  renderBalances() {
    if (this.elements.balWLD) {
      this.elements.balWLD.textContent = this.state.wld.toFixed(2);
    }
    
    if (this.elements.balRBGp) {
      this.elements.balRBGp.textContent = this.state.rbgp.toFixed(3);
    }
  }

  renderEnergy() {
    const maxEnergy = this.getMaxEnergy();
    const percentage = Math.max(0, (this.state.energy / maxEnergy) * 100);
    
    if (this.elements.energyFill) {
      Animations.animateEnergyDepletion(this.state.energy, maxEnergy);
    }
    
    if (this.elements.energyNow) {
      this.elements.energyNow.textContent = Math.ceil(this.state.energy);
    }
    
    if (this.elements.energyMax) {
      this.elements.energyMax.textContent = maxEnergy;
    }
  }

  renderRefillButton() {
    if (!this.elements.refillBtn) return;
    
    const now = performance.now();
    const inCooldown = now < this.state.noEnergyUntil;
    const energy = this.state.energy;
    
    // Limpiar clases previas
    this.elements.refillBtn.classList.remove('refillPulse', 'refillAlarm');
    
    // Aplicar estado visual
    if (energy <= 0 || inCooldown) {
      this.elements.refillBtn.classList.add('refillAlarm');
    } else if (energy < ENGINE_CONFIG.LOW_ENERGY_THRESHOLD) {
      this.elements.refillBtn.classList.add('refillPulse');
    }
    
    // Actualizar precio
    if (this.elements.refillPrice) {
      this.elements.refillPrice.textContent = `${this.getRefillCost()} WLD`;
    }
  }

  // === EVENT LISTENERS ===
  setupEventListeners() {
    // Tap en moneda
    if (this.elements.coin) {
      this.elements.coin.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.handleCoinTap(e);
      });
    }
    
    // Refill button
    if (this.elements.refillBtn) {
      this.elements.refillBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleRefill();
      });
    }
    
    // Resize handler para canvas
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
    
    // Visibility change para pausar/resume
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    });
    
    console.log('🎯 Event listeners configurados');
  }

  resizeCanvas() {
    if (!this.elements.fx || !this.elements.coin) return;
    
    const rect = this.elements.coin.getBoundingClientRect();
    this.elements.fx.width = rect.width;
    this.elements.fx.height = rect.height;
  }

  // === GAME LOOPS ===
  startGameLoops() {
    // Loop de regeneración de energía (cada segundo)
    setInterval(() => {
      if (!this.state.isPaused) {
        this.updateEnergyRegen();
        this.render();
      }
    }, 1000);
    
    // Loop de actualización rápida (para combos, etc)
    const fastLoop = () => {
      if (!this.state.isPaused && this.state.isInitialized) {
        // Actualizar badges de combo
        this.systems.combo.updateBadge();
      }
      requestAnimationFrame(fastLoop);
    };
    requestAnimationFrame(fastLoop);
    
    console.log('🔄 Game loops iniciados');
  }

  // === CONTROL DE ESTADO ===
  pause() {
    this.state.isPaused = true;
    console.log('⏸️ Juego pausado');
  }

  resume() {
    this.state.isPaused = false;
    console.log('▶️ Juego resumido');
  }

  // === API PÚBLICA ===

  /**
   * Obtiene estado completo del juego
   */
  getGameState() {
    return {
      // Estado base
      ...this.state,
      
      // Estados de sistemas
      combo: this.systems.combo?.getState(),
      hotspot: this.systems.hotspot?.getState(),
      
      // Información calculada
      maxEnergy: this.getMaxEnergy(),
      regenRate: this.getRegenRate(),
      refillCost: this.getRefillCost(),
      currentBonus: this.systems.combo?.getCurrentBonus() || 0
    };
  }

  /**
   * Configura callbacks de UI externa
   */
  setUICallbacks(callbacks) {
    this.uiCallbacks = { ...callbacks };
  }

  /**
   * Añade WLD (para testing/rewards)
   */
  addWLD(amount) {
    this.state.wld += Math.max(0, amount);
    this.render();
    this.saveState();
  }

  /**
   * Resetea el juego completo
   */
  resetGame() {
    console.log('🔄 Reseteando juego...');
    
    // Reset estado
    this.state.wld = 0;
    this.state.rbgp = 0;
    this.state.energy = ENGINE_CONFIG.BASE_CAP;
    this.state.noEnergyUntil = 0;
    this.state.lastTimestamp = Date.now();
    
    // Reset sistemas
    this.systems.combo?.reset();
    this.systems.hotspot?.hide();
    
    this.render();
    this.saveState();
    
    console.log('✅ Juego reseteado');
  }

  /**
   * Información de debug
   */
  getDebugInfo() {
    return {
      engine: this.getGameState(),
      systems: {
        audio: !!this.systems.audio,
        combo: this.systems.combo?.getDebugInfo?.(),
        hotspot: this.systems.hotspot?.getDebugInfo?.()
      },
      performance: {
        initialized: this.state.isInitialized,
        paused: this.state.isPaused,
        timestamp: performance.now()
      }
    };
  }

  /**
   * Cleanup completo
   */
  destroy() {
    console.log('🧹 Destruyendo engine...');
    
    this.pause();
    
    // Destroy sistemas
    this.systems.combo?.destroy();
    this.systems.hotspot?.destroy();
    this.systems.audio?.destroyAudio();
    
    // Limpiar referencias
    this.elements = {};
    this.systems = {};
    this.uiCallbacks = {};
    
    console.log('✅ Engine destruido');
  }
}

// === INSTANCIA SINGLETON ===
let gameEngineInstance = null;

/**
 * Inicializa el motor del juego
 */
export async function initGameEngine() {
  if (gameEngineInstance) {
    console.warn('⚠️ Engine ya inicializado');
    return gameEngineInstance;
  }
  
  gameEngineInstance = new GameEngine();
  await gameEngineInstance.initializeEngine();
  
  return gameEngineInstance;
}

/**
 * Obtiene la instancia del engine
 */
export function getGameEngine() {
  return gameEngineInstance;
}

/**
 * API simplificada para uso global
 */
export const GameAPI = {
  // Control principal
  tap: (event) => gameEngineInstance?.handleCoinTap(event),
  refill: () => gameEngineInstance?.handleRefill(),
  
  // Estado
  getState: () => gameEngineInstance?.getGameState(),
  addWLD: (amount) => gameEngineInstance?.addWLD(amount),
  
  // Control de juego
  pause: () => gameEngineInstance?.pause(),
  resume: () => gameEngineInstance?.resume(),
  reset: () => gameEngineInstance?.resetGame(),
  
  // Debug
  debug: () => gameEngineInstance?.getDebugInfo(),
  
  // Sistemas
  get combo() { return gameEngineInstance?.systems.combo; },
  get hotspot() { return gameEngineInstance?.systems.hotspot; },
  get audio() { return gameEngineInstance?.systems.audio; }
};

// === CONFIGURACIÓN EXPORTADA ===
export const ENGINE_SETTINGS = ENGINE_CONFIG;

// === EXPORTACIÓN PRINCIPAL ===
export default {
  GameEngine,
  initGameEngine,
  getGameEngine,
  GameAPI,
  ENGINE_SETTINGS
};