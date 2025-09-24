/**
 * audio-manager.js - Sistema de Audio RainbowGold Tap
 * WebAudio optimizado con fallback HTML5 para máxima compatibilidad
 */

// === CONFIGURACIÓN DE AUDIO ===
const AUDIO_CONFIG = {
  MASTER_VOLUME: 1.0,
  LATENCY_HINT: 'interactive',
  TICK_THROTTLE_MS: 45,           // evita spam de tick
  FADE_OUT_TIME: 0.035,           // fade out para loops
  IDLE_TIMEOUT: 1500,             // carga diferida
  MAX_CONCURRENT_SOUNDS: 8        // límite de sonidos simultáneos
};

// === MANIFEST DE SONIDOS ===
const SOUND_MANIFEST = {
  nice: 'snd/nice.mp3',
  rainbow: 'snd/rainbow_race.mp3',
  freeze: 'snd/freeze.mp3',
  laugh: 'snd/laugh.mp3',
  slot: 'snd/slot_loop.mp3',
  tension: 'snd/tension_loop.mp3',
  tick: 'snd/tick.mp3',
  join: 'snd/join.mp3'
};

// === SISTEMA DE AUDIO PRINCIPAL ===
class AudioManager {
  constructor() {
    this.hasWebAudio = !!(window.AudioContext || window.webkitAudioContext);
    this.ctx = null;
    this.master = null;
    this.buffers = new Map();
    this.loops = new Map();
    this.lastHit = {};
    this.fallbackAudio = {};
    this.isInitialized = false;
    this.tickUseMp3 = false; // modo especial para Rainbow/Frenzy
    
    this.init();
  }

  async init() {
    if (this.hasWebAudio) {
      await this.initWebAudio();
    } else {
      this.initFallback();
    }
    this.isInitialized = true;
  }

  // === INICIALIZACIÓN WebAudio ===
  async initWebAudio() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: AUDIO_CONFIG.LATENCY_HINT
      });
      
      this.master = this.ctx.createGain();
      this.master.gain.value = AUDIO_CONFIG.MASTER_VOLUME;
      this.master.connect(this.ctx.destination);
      
      // Auto-resume en gesture del usuario
      this.setupGestureResume();
      
      // Suspender en background para ahorrar batería
      this.setupVisibilityHandling();
      
      // Precarga inteligente en idle
      this.schedulePreload();
      
    } catch (error) {
      console.warn('WebAudio failed, falling back to HTML5:', error);
      this.hasWebAudio = false;
      this.initFallback();
    }
  }

  // === FALLBACK HTML5 Audio ===
  initFallback() {
    for (const [name, url] of Object.entries(SOUND_MANIFEST)) {
      const audio = new Audio(url);
      
      // Configurar loops
      if (name === 'slot' || name === 'tension') {
        audio.loop = true;
      }
      
      // Precarga selectiva
      audio.preload = (name === 'tick' || name === 'nice') ? 'auto' : 'metadata';
      
      this.fallbackAudio[name] = audio;
    }
  }

  // === GESTIÓN DE GESTOS (WebAudio) ===
  setupGestureResume() {
    if (!this.ctx) return;
    
    const resume = () => {
      this.ctx.resume().catch(() => {});
      this.cleanup();
    };
    
    const cleanup = () => {
      window.removeEventListener('pointerdown', resume, true);
      window.removeEventListener('keydown', resume, true);
      window.removeEventListener('touchstart', resume, true);
    };
    
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('keydown', resume, true);
    window.addEventListener('touchstart', resume, true);
  }

  // === SUSPENDER EN BACKGROUND ===
  setupVisibilityHandling() {
    if (!this.ctx) return;
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.ctx.suspend().catch(() => {});
      } else {
        this.ctx.resume().catch(() => {});
      }
    });
  }

  // === PRECARGA INTELIGENTE ===
  schedulePreload() {
    const idle = (fn) => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(fn, { timeout: AUDIO_CONFIG.IDLE_TIMEOUT });
      } else {
        setTimeout(fn, 0);
      }
    };

    // Precarga sonidos críticos en idle
    idle(() => {
      const priority = ['tick', 'nice', 'laugh', 'freeze'];
      priority.forEach(name => {
        this.loadBuffer(name).catch(() => {});
      });
    });
  }

  // === CARGA DE BUFFERS ===
  async loadBuffer(name) {
    if (!this.ctx) return null;
    if (this.buffers.has(name)) return this.buffers.get(name);
    
    try {
      const url = SOUND_MANIFEST[name];
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      
      this.buffers.set(name, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.warn(`Failed to load audio: ${name}`, error);
      return null;
    }
  }

  // === REPRODUCCIÓN WebAudio ===
  playOnce(name, volume = 1) {
    if (!this.ctx || !this.buffers.has(name)) return;
    
    try {
      const nodeGain = this.ctx.createGain();
      nodeGain.gain.value = volume;
      nodeGain.connect(this.master);
      
      const source = this.ctx.createBufferSource();
      source.buffer = this.buffers.get(name);
      source.connect(nodeGain);
      source.start();
      
      // Liberar recursos automáticamente
      source.onended = () => {
        nodeGain.disconnect();
      };
      
    } catch (error) {
      console.warn(`Failed to play sound: ${name}`, error);
    }
  }

  playLoop(name, volume = 1) {
    if (!this.ctx) return;
    
    // Si ya está sonando, solo ajusta volumen
    if (this.loops.has(name)) {
      const obj = this.loops.get(name);
      obj.gain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.01);
      return;
    }
    
    if (!this.buffers.has(name)) {
      console.warn(`Buffer not loaded for loop: ${name}`);
      return;
    }
    
    try {
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      gain.connect(this.master);
      
      const source = this.ctx.createBufferSource();
      source.buffer = this.buffers.get(name);
      source.loop = true;
      source.connect(gain);
      source.start();
      
      this.loops.set(name, { src: source, gain });
      
    } catch (error) {
      console.warn(`Failed to start loop: ${name}`, error);
    }
  }

  stopLoop(name) {
    const obj = this.loops.get(name);
    if (!obj) return;
    
    try {
      // Fade out suave
      obj.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, AUDIO_CONFIG.FADE_OUT_TIME);
      obj.src.stop(this.ctx.currentTime + AUDIO_CONFIG.FADE_OUT_TIME + 0.005);
      
      // Cleanup después del fade
      setTimeout(() => {
        obj.gain.disconnect();
      }, 60);
      
    } catch (error) {
      // El source ya podría estar stopped
    }
    
    this.loops.delete(name);
  }

  // === REPRODUCCIÓN FALLBACK ===
  playFallback(name, { volume = 1, loop = false } = {}) {
    const audio = this.fallbackAudio[name];
    if (!audio) return;
    
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.loop = !!loop;
      audio.volume = volume;
      audio.play().catch(() => {}); // ignore promise rejections
    } catch (error) {
      console.warn(`Fallback audio failed: ${name}`, error);
    }
  }

  stopFallback(name) {
    const audio = this.fallbackAudio[name];
    if (!audio) return;
    
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (error) {}
  }

  // === API PRINCIPAL ===
  async play(name, { volume = 1, loop = false } = {}) {
    // Tick.mp3 solo en Rainbow/Frenzy
    if (name === 'tick' && !this.tickUseMp3) {
      return;
    }

    // Throttle para tick (evita spam y jank)
    if (name === 'tick') {
      const now = performance.now();
      if (this.lastHit.tick && now - this.lastHit.tick < AUDIO_CONFIG.TICK_THROTTLE_MS) {
        return;
      }
      this.lastHit.tick = now;
    }

    if (this.hasWebAudio && this.ctx) {
      try {
        // Cargar buffer si no está cargado
        if (!this.buffers.has(name)) {
          await this.loadBuffer(name);
        }

        if (loop) {
          this.playLoop(name, volume);
        } else {
          this.playOnce(name, volume);
        }
      } catch (error) {
        console.warn('WebAudio playback failed, using fallback:', error);
        this.playFallback(name, { volume, loop });
      }
    } else {
      this.playFallback(name, { volume, loop });
    }
  }

  stop(name) {
    if (this.hasWebAudio && this.ctx) {
      this.stopLoop(name);
    } else {
      this.stopFallback(name);
    }
  }

  // === MODO TICK MP3 (para Rainbow/Frenzy) ===
  setTickMode(useMP3) {
    this.tickUseMp3 = !!useMP3;
  }

  // === CONTROL DE VOLUMEN MAESTRO ===
  setMasterVolume(volume) {
    const vol = Math.max(0, Math.min(1, volume));
    
    if (this.master) {
      this.master.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.01);
    }
    
    // También ajustar fallback
    Object.values(this.fallbackAudio).forEach(audio => {
      if (audio.volume !== undefined) {
        audio.volume = vol;
      }
    });
  }

  // === CLEANUP ===
  destroy() {
    // Parar todos los loops
    for (const name of this.loops.keys()) {
      this.stopLoop(name);
    }
    
    // Cerrar contexto
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
    
    // Limpiar fallback
    Object.values(this.fallbackAudio).forEach(audio => {
      audio.pause();
      audio.src = '';
    });
  }
}

// === GENERADOR DE TONOS SIMPLES ===
class ToneGenerator {
  constructor(audioManager) {
    this.audioManager = audioManager;
  }

  /**
   * Genera tono simple con WebAudio
   * @param {number} freq - Frecuencia en Hz
   * @param {number} duration - Duración en segundos
   * @param {string} type - Tipo de onda
   * @param {number} volume - Volumen 0-1
   */
  play(freq = 560, duration = 0.05, type = 'triangle', volume = 0.08) {
    if (!this.audioManager.hasWebAudio || !this.audioManager.ctx) {
      // Fallback silencioso o beep básico del sistema
      return;
    }

    try {
      const ctx = this.audioManager.ctx;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = type;
      oscillator.frequency.value = freq;
      gain.gain.value = volume;

      oscillator.connect(gain);
      gain.connect(this.audioManager.master);

      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      oscillator.stop(ctx.currentTime + duration + 0.02);

    } catch (error) {
      console.warn('Tone generation failed:', error);
    }
  }
}

// === SONIDOS ESPECÍFICOS DEL JUEGO ===
class GameSounds {
  constructor(audioManager, toneGenerator) {
    this.audio = audioManager;
    this.tone = toneGenerator;
  }

  // Sonidos de combo por nivel
  level(n) {
    const base = 560 + n * 70;
    this.tone.play(base, 0.05, 'square', 0.09);
    setTimeout(() => {
      this.tone.play(base + 90, 0.04, 'triangle', 0.07);
    }, 70);
  }

  // Sonido de fallo/miss
  miss() {
    this.tone.play(520, 0.045, 'sawtooth', 0.07);
    setTimeout(() => {
      this.tone.play(420, 0.045, 'sawtooth', 0.06);
    }, 70);
  }

  // Inicio de Frenzy
  frenzyStart() {
    this.tone.play(680, 0.12, 'square', 0.10);
    setTimeout(() => {
      this.tone.play(840, 0.12, 'triangle', 0.09);
    }, 120);
  }

  // Progreso en ventana de combo
  tapProgress(level, tapIndex) {
    const base = 1000 + level * 120 + (tapIndex - 1) * 90;
    this.tone.play(base, 0.035, 'square', 0.07);
    this.audio.play('tick', { volume: 0.7 });
  }

  // Sonido tipo slot machine para Frenzy777
  frenzy777() {
    const sequence = [620, 740, 880, 740, 880, 980, 1100];
    let time = 0;
    
    sequence.forEach((freq, i) => {
      setTimeout(() => {
        this.tone.play(freq, 0.05, 'triangle', 0.10);
      }, time);
      time += 70;
    });
  }
}

// === INSTANCIA GLOBAL ===
let audioManagerInstance = null;
let toneGeneratorInstance = null;
let gameSoundsInstance = null;

// === INICIALIZACIÓN ===
export async function initializeAudio() {
  if (audioManagerInstance) return;

  audioManagerInstance = new AudioManager();
  await audioManagerInstance.init();

  toneGeneratorInstance = new ToneGenerator(audioManagerInstance);
  gameSoundsInstance = new GameSounds(audioManagerInstance, toneGeneratorInstance);

  // Hacer disponible globalmente para compatibilidad
  window.__tickUseMp3 = false;
}

// === API PÚBLICA ===

/**
 * Reproduce un sonido
 */
export async function playSnd(name, options = {}) {
  if (!audioManagerInstance) await initializeAudio();
  return audioManagerInstance.play(name, options);
}

/**
 * Para un sonido en loop
 */
export function stopSnd(name) {
  if (!audioManagerInstance) return;
  audioManagerInstance.stop(name);
}

/**
 * Genera un tono simple
 */
export function tone(freq, duration, type, volume) {
  if (!toneGeneratorInstance) return;
  toneGeneratorInstance.play(freq, duration, type, volume);
}

/**
 * Activa/desactiva modo tick MP3 para Rainbow/Frenzy
 */
export function setTickModeMp3(useMP3) {
  if (audioManagerInstance) {
    audioManagerInstance.setTickMode(useMP3);
  }
  window.__tickUseMp3 = useMP3;
}

/**
 * Sonidos específicos del juego
 */
export function soundLevel(n) {
  if (!gameSoundsInstance) return;
  gameSoundsInstance.level(n);
}

export function soundMiss() {
  if (!gameSoundsInstance) return;
  gameSoundsInstance.miss();
}

export function soundFrenzyStart() {
  if (!gameSoundsInstance) return;
  gameSoundsInstance.frenzyStart();
}

export function soundTapProgress(level, tapIndex) {
  if (!gameSoundsInstance) return;
  gameSoundsInstance.tapProgress(level, tapIndex);
}

export function soundFrenzy777() {
  if (!gameSoundsInstance) return;
  gameSoundsInstance.frenzy777();
}

/**
 * Control de volumen maestro
 */
export function setMasterVolume(volume) {
  if (!audioManagerInstance) return;
  audioManagerInstance.setMasterVolume(volume);
}

/**
 * Cleanup completo
 */
export function destroyAudio() {
  if (audioManagerInstance) {
    audioManagerInstance.destroy();
    audioManagerInstance = null;
    toneGeneratorInstance = null;
    gameSoundsInstance = null;
  }
}

// === COMPATIBILIDAD CON CÓDIGO EXISTENTE ===

// Auto-inicializar en la primera llamada
export default {
  initializeAudio,
  playSnd,
  stopSnd,
  tone,
  setTickModeMp3,
  soundLevel,
  soundMiss,
  soundFrenzyStart,
  soundTapProgress,
  soundFrenzy777,
  setMasterVolume,
  destroyAudio,
  
  // Acceso directo a instancias (para uso avanzado)
  get audioManager() { return audioManagerInstance; },
  get toneGenerator() { return toneGeneratorInstance; },
  get gameSounds() { return gameSoundsInstance; }
};