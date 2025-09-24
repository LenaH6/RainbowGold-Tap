/**
 * combo-system.js - Sistema de Combos RainbowGold Tap
 * Gestiona X1-X5, ventanas temporales, progreso y Rainbow Challenge
 */

// === CONFIGURACIÓN DE COMBOS ===
const COMBO_CONFIG = {
  // Bonus en % sobre POWER_BASE por nivel
  BONUS: { 1: 0.025, 2: 0.030, 3: 0.035, 4: 0.040, 5: 0.045 },
  
  // Duración de ventana temporal por nivel (ms)
  WINDOW_MS: { 1: 700, 2: 1200, 3: 1600, 4: 2000, 5: 2400 },
  
  // Ventanas completas necesarias para avanzar de nivel
  ADV_REQ: { 1: 3, 2: 2, 3: 2, 4: 2 },
  
  // Rangos de taps para spawn de hotspot por nivel [min, max]
  SPAWN_TAPS: { 1: [7, 12], 2: [9, 14], 3: [10, 15], 4: [12, 18], 5: [14, 20] },
  
  // Duración de Frenzy (ms)
  FRENZY_MS: 5500,
  
  // Probabilidad de decoy/señuelo
  DECOY_CHANCE: 0.25,
  
  // Bonus extra en Frenzy (% sobre POWER_BASE)
  FRENZY_BONUS: 0.05
};

// === CONFIGURACIÓN RAINBOW CHALLENGE ===
const RAINBOW_CONFIG = {
  HITS: 6,                    // toques necesarios a manchas arcoíris
  DECOY_CHANCE: 0.45,         // probabilidad de distractor durante desafío
  APPEAR_MS: [2500, 3200],    // visibilidad de cada mancha (ms)
  TOTAL_MS: 12000,            // tiempo máximo del desafío
  SPAWN_INTERVAL: [1200, 1600] // intervalo entre spawns
};

// === COLORES POR NIVEL ===
const LEVEL_COLORS = {
  1: '#ffd872', // Dorado
  2: '#9cff70', // Verde
  3: '#6ae1ff', // Azul
  4: '#d08bff', // Morado
  5: '#ff6a6a'  // Rojo
};

// === ESTADO DEL SISTEMA DE COMBOS ===
class ComboSystem {
  constructor() {
    this.state = {
      level: 0,                               // 0 = base; 1..5 = X1..X5
      progress: { 1: 0, 2: 0, 3: 0, 4: 0 },  // ventanas completas por nivel
      window: null,                           // ventana activa actual
      frenzyUntil: 0,                         // timestamp fin de Frenzy
      tapCounter: 0,                          // conteo global de taps
      nextSpawnAt: 0                          // umbral próximo spawn hotspot
    };
    
    this.challenge = {
      active: false,
      completed: false,
      hits: 0,
      t0: 0,
      arcRaf: 0,
      timerId: 0,
      spawnTimer: 0
    };
    
    // Referencias a elementos DOM
    this.elements = {};
    this.initElements();
    
    // Callbacks externos
    this.callbacks = {};
  }

  // === INICIALIZACIÓN ===
  initElements() {
    this.elements = {
      coin: document.getElementById('coin'),
      comboBadge: document.getElementById('comboBadge'),
      windowTag: document.getElementById('windowTag'),
      windowArc: document.getElementById('windowArc'),
      windowArcCircle: document.querySelector('#windowArc circle'),
      hotCore: document.getElementById('hotCore')
    };
  }

  // === CONFIGURACIÓN DE CALLBACKS ===
  setCallbacks(callbacks) {
    this.callbacks = {
      addTapAmount: callbacks.addTapAmount || (() => {}),
      playSnd: callbacks.playSnd || (() => {}),
      stopSnd: callbacks.stopSnd || (() => {}),
      tone: callbacks.tone || (() => {}),
      showHot: callbacks.showHot || (() => {}),
      hideHot: callbacks.hideHot || (() => {}),
      popLabel: callbacks.popLabel || (() => {}),
      popBadge: callbacks.popBadge || (() => {}),
      popSparkle: callbacks.popSparkle || (() => {}),
      arcFlash: callbacks.arcFlash || (() => {}),
      tagShow: callbacks.tagShow || (() => {}),
      tagHide: callbacks.tagHide || (() => {}),
      setTickModeMp3: callbacks.setTickModeMp3 || (() => {}),
      ...callbacks
    };
  }

  // === UTILIDADES ===
  randInt(a, b) {
    return (a | 0) + Math.floor(Math.random() * ((b | 0) - (a | 0) + 1));
  }

  targetLevel() {
    return Math.max(1, this.state.level || 1);
  }

  getCurrentComboText() {
    const now = performance.now();
    
    if (this.challenge.active) {
      return 'RAINBOW RACE';
    }
    
    if (now < this.state.frenzyUntil) {
      return 'FRENZY';
    }
    
    if (this.state.level >= 1) {
      return `X${this.state.level}`;
    }
    
    return null;
  }

  // === GESTIÓN DE VENTANAS TEMPORALES ===
  createWindow(level) {
    if (this.state.window) return; // Ya hay una activa
    
    // Calcular área válida de hit (núcleo capturado)
    const coinRect = this.elements.coin?.getBoundingClientRect();
    const coreRect = this.elements.hotCore?.getBoundingClientRect();
    let hitRect = null;
    
    if (coreRect && coinRect) {
      hitRect = {
        x: (coreRect.left - coinRect.left) / coinRect.width,
        y: (coreRect.top - coinRect.top) / coinRect.height,
        w: coreRect.width / coinRect.width,
        h: coreRect.height / coinRect.height
      };
    }

    this.state.window = {
      level,
      tapsNeeded: level,        // regla: #taps == nivel
      tapsDone: 0,
      t0: performance.now(),
      durationMs: COMBO_CONFIG.WINDOW_MS[level],
      rafId: 0,
      hitRect                   // área válida donde deben caer los taps
    };

    // Audio y efectos visuales
    this.callbacks.tone(560 + level * 70, 0.05, 'square', 0.09);
    
    // Mantener hotspot visible durante ventana
    this.lockHotspot(true);
    
    // Mostrar arco segmentado
    const deg = Math.round((level / 6) * 360);
    this.showArcSegment(deg, level);
    
    // Tag de progreso
    this.callbacks.tagShow(`X${level} 0/${level}`, LEVEL_COLORS[level]);
    
    this.updateBadge();
    this.state.window.rafId = requestAnimationFrame(() => this.tickWindow());
  }

  closeWindow() {
    if (!this.state.window) return;
    
    cancelAnimationFrame(this.state.window.rafId);
    this.state.window = null;
    this.hideArc();
    this.callbacks.tagHide();
    this.lockHotspot(false);
    this.callbacks.hideHot();
  }

  tickWindow() {
    const w = this.state.window;
    if (!w) return;
    
    const now = performance.now();
    const progress = Math.min(1, (now - w.t0) / w.durationMs);
    
    this.updateArcProgress(w.level, progress);
    
    if (progress >= 1) {
      // Tiempo agotado → FALLO
      this.handleWindowTimeout();
      return;
    }

    this.state.window.rafId = requestAnimationFrame(() => this.tickWindow());
  }

  handleWindowTimeout() {
    const level = this.state.window.level;
    
    // Audio de fallo
    this.callbacks.tone(520, 0.045, 'sawtooth', 0.07);
    setTimeout(() => {
      this.callbacks.tone(420, 0.045, 'sawtooth', 0.06);
    }, 70);
    
    // Burla visual
    const coinRect = this.elements.coin?.getBoundingClientRect();
    if (coinRect) {
      this.callbacks.popLabel('😂', 
        coinRect.left + coinRect.width / 2, 
        coinRect.top + coinRect.height / 2,
        { fontSize: 40, dy: -120, duration: 2200, color: '#fff' }
      );
    }
    
    this.callbacks.playSnd('laugh', { volume: 0.9 });
    
    // Penalización: bajar nivel o resetear
    if (level >= 2) {
      this.state.level = level - 1;
    } else {
      this.state.level = 0;
    }
    this.state.progress = { 1: 0, 2: 0, 3: 0, 4: 0 };
    
    this.closeWindow();
    this.updateBadge();
  }

  // === PROCESAMIENTO DE TAPS ===
  processTap(event) {
    const now = performance.now();

    // 1) FRENZY: bonus extra
    if (now < this.state.frenzyUntil) {
      const POWER_BASE = this.callbacks.getPowerBase ? this.callbacks.getPowerBase() : 0.1000;
      const extra = POWER_BASE * COMBO_CONFIG.FRENZY_BONUS;
      this.callbacks.addTapAmount(extra);
      
      // Audio tick especial
      try {
        this.callbacks.playSnd('tick', { volume: 0.7 });
      } catch (_) {}
      
      this.updateBadge();
      return;
    }

    // 2) Si hay ventana activa: procesar progreso
    if (this.state.window) {
      this.processWindowTap(event);
      return;
    }

    // 3) No hay ventana → verificar si tocó hotspot real
    if (this.callbacks.isHotspotHit && this.callbacks.isHotspotHit(event)) {
      const skin = this.callbacks.getHotspotSkin ? this.callbacks.getHotspotSkin() : 'x1';
      
      if (/^x[1-5]$/.test(skin)) {
        const level = Math.max(1, Math.min(5, parseInt(skin.slice(1), 10) || 1));
        
        // Label visual
        this.callbacks.popLabel(`X${level}`, event.clientX, event.clientY, {
          color: '#ff3030',
          fontSize: 40,
          dy: -150
        });
        
        this.createWindow(level);
      }
    }
  }

  processWindowTap(event) {
    const w = this.state.window;
    if (!w) return;

    // Verificar si el tap está dentro del área válida
    if (!this.isInWindowRect(event)) return;

    w.tapsDone += 1;
    
    // Audio de progreso
    const base = 1000 + w.level * 120 + (w.tapsDone - 1) * 90;
    this.callbacks.tone(base, 0.035, 'square', 0.07);
    this.callbacks.playSnd('tick', { volume: 0.7 });

    // Actualizar tag
    this.callbacks.tagShow(`X${w.level} ${w.tapsDone}/${w.tapsNeeded}`, LEVEL_COLORS[w.level]);

    // Label visual
    this.callbacks.popLabel(`X${w.level}`, event.clientX, event.clientY, {
      color: '#ff3030',
      fontSize: 36,
      dy: -130
    });

    // Bonus por tap dentro de ventana
    const POWER_BASE = this.callbacks.getPowerBase ? this.callbacks.getPowerBase() : 0.1000;
    const extra = POWER_BASE * COMBO_CONFIG.BONUS[w.level];
    this.callbacks.addTapAmount(extra);

    // ¿Ventana completada?
    if (w.tapsDone >= w.tapsNeeded) {
      this.completeWindow(w.level);
    }
  }

  completeWindow(level) {
    // Flash visual
    this.callbacks.arcFlash();
    
    setTimeout(() => {
      // Sparkle centrado
      const coinRect = this.elements.coin?.getBoundingClientRect();
      if (coinRect) {
        this.callbacks.popSparkle(
          coinRect.left + coinRect.width / 2,
          coinRect.top + coinRect.height / 2
        );
      }

      this.closeWindow();
      this.state.progress[level] = (this.state.progress[level] || 0) + 1;

      if (level === 5) {
        // X5 completado → Rainbow Challenge
        this.callbacks.playSnd('rainbow', { volume: 1.0 });
        this.startRainbowChallenge();
        return;
      } else {
        // Verificar si puede avanzar de nivel
        if (this.state.progress[level] >= COMBO_CONFIG.ADV_REQ[level]) {
          this.state.level = level + 1;
          this.state.progress[level] = 0;
        } else {
          this.state.level = Math.max(this.state.level, level);
        }
        this.updateBadge();
      }
    }, 160);
  }

  isInWindowRect(event) {
    if (!this.state.window || !this.state.window.hitRect) return false;
    
    const coinRect = this.elements.coin?.getBoundingClientRect();
    if (!coinRect) return false;
    
    const x = (event.clientX - coinRect.left) / coinRect.width;
    const y = (event.clientY - coinRect.top) / coinRect.height;
    const r = this.state.window.hitRect;
    
    return (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  // === SISTEMA FRENZY ===
  startFrenzy() {
    this.callbacks.setTickModeMp3(true);
    
    this.state.frenzyUntil = performance.now() + COMBO_CONFIG.FRENZY_MS;
    
    this.hideArc();
    requestAnimationFrame(() => this.startFrenzyArc());
    
    // Audio especial tipo slot machine
    this.playFrenzy777Sound();
    
    this.callbacks.tagShow('FRENZY', '#ffd872');
    this.callbacks.popBadge('FRENZY');
    
    this.updateBadge();
    this.addVibrateClass();
    
    setTimeout(() => {
      if (performance.now() >= this.state.frenzyUntil) {
        this.endFrenzy();
      }
    }, COMBO_CONFIG.FRENZY_MS + 20);
  }

  endFrenzy() {
    this.callbacks.setTickModeMp3(false);
    
    this.state.level = 0;
    this.state.progress = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.state.frenzyUntil = 0;
    
    this.callbacks.tagHide();
    this.hideArc();
    this.removeVibrateClass();
    this.updateBadge();
  }

  playFrenzy777Sound() {
    const sequence = [620, 740, 880, 740, 880, 980, 1100];
    let time = 0;
    
    sequence.forEach(freq => {
      setTimeout(() => {
        this.callbacks.tone(freq, 0.05, 'triangle', 0.10);
      }, time);
      time += 70;
    });
  }

  startFrenzyArc() {
    const { windowArc, windowArcCircle } = this.elements;
    if (!windowArc || !windowArcCircle) return;
    
    windowArcCircle.style.stroke = 'url(#frenzy777)';
    windowArcCircle.setAttribute('stroke-dasharray', '360 360');
    windowArcCircle.setAttribute('stroke-dashoffset', '0');
    windowArc.style.opacity = '1';
    
    const t0 = performance.now();
    const tick = () => {
      const now = performance.now();
      const elapsed = Math.min(COMBO_CONFIG.FRENZY_MS, now - t0);
      const offset = 360 * (elapsed / COMBO_CONFIG.FRENZY_MS);
      
      windowArcCircle.setAttribute('stroke-dashoffset', String(offset));
      
      if (now < this.state.frenzyUntil) {
        requestAnimationFrame(tick);
      } else {
        this.hideArc();
      }
    };
    requestAnimationFrame(tick);
  }

  // === RAINBOW CHALLENGE ===
  startRainbowChallenge() {
    this.callbacks.playSnd('rainbow', { volume: 1.0 });
    this.callbacks.playSnd('tension', { volume: 0.7, loop: true });
    
    this.challenge.active = true;
    this.challenge.completed = false;
    this.challenge.hits = 0;
    this.challenge.t0 = performance.now();
    
    // UI
    this.callbacks.tagShow(`DESAFÍO 0/${RAINBOW_CONFIG.HITS}`, '#ffd872');
    this.startChallengeArc();
    this.callbacks.popBadge('RAINBOW CHALLENGE');
    
    // Auto-spawn de manchas
    this.scheduleRainbowSpawn();
    
    // Timeout global del desafío
    this.challenge.timerId = setTimeout(() => {
      if (this.challenge.active) {
        this.endRainbowChallenge(false);
      }
    }, RAINBOW_CONFIG.TOTAL_MS);
  }

  scheduleRainbowSpawn() {
    if (!this.challenge.active) return;
    
    this.spawnRainbowOrDecoy();
    
    this.challenge.spawnTimer = setTimeout(() => {
      this.scheduleRainbowSpawn();
    }, this.randInt(RAINBOW_CONFIG.SPAWN_INTERVAL[0], RAINBOW_CONFIG.SPAWN_INTERVAL[1]));
  }

  spawnRainbowOrDecoy() {
    const isDecoy = Math.random() < RAINBOW_CONFIG.DECOY_CHANCE;
    const skin = isDecoy ? 'decoy' : 'rb';
    this.callbacks.showHot(skin);
    this.lockHotspot(false);
    
    const ms = this.randInt(RAINBOW_CONFIG.APPEAR_MS[0], RAINBOW_CONFIG.APPEAR_MS[1]);
    setTimeout(() => {
      if (!this.isHotspotLocked()) {
        this.callbacks.hideHot();
      }
    }, ms);
  }

  handleChallengeTap(event) {
    if (!this.challenge.active || this.challenge.completed) return;

    const wasRainbowHit = this.callbacks.isRainbowHit && this.callbacks.isRainbowHit(event);
    const hitDecoy = this.callbacks.isDecoyHit && this.callbacks.isDecoyHit(event);

    if (wasRainbowHit) {
      this.callbacks.playSnd('tick', { volume: 0.8 });
      this.challenge.hits = Math.min(RAINBOW_CONFIG.HITS, this.challenge.hits + 1);
      
      this.callbacks.arcFlash();
      
      if (this.callbacks.popSparkleSilent) {
        this.callbacks.popSparkleSilent(event.clientX, event.clientY);
      }
      
      this.callbacks.tagShow(`DESAFÍO ${this.challenge.hits}/${RAINBOW_CONFIG.HITS}`, '#ffd872');
      
      // Ocultar mancha inmediatamente
      this.lockHotspot(false);
      this.callbacks.hideHot();
      
      if (this.challenge.hits >= RAINBOW_CONFIG.HITS) {
        this.challenge.completed = true;
        clearTimeout(this.challenge.timerId);
        clearTimeout(this.challenge.spawnTimer);
        setTimeout(() => this.endRainbowChallenge(true), 80);
      }
      return;
    }

    if (hitDecoy) {
      this.callbacks.popLabel('😂', event.clientX, event.clientY, {
        fontSize: 40,
        dy: -120,
        duration: 2200,
        color: '#fff'
      });
      this.callbacks.playSnd('laugh', { volume: 0.9 });
      this.callbacks.tone(520, 0.045, 'sawtooth', 0.07);
      return;
    }
  }

  endRainbowChallenge(success) {
    this.callbacks.setTickModeMp3(false);
    
    clearTimeout(this.challenge.timerId);
    clearTimeout(this.challenge.spawnTimer);
    
    this.challenge.completed = true;
    this.challenge.active = false;
    
    this.stopChallengeArc();
    this.callbacks.tagHide();
    this.callbacks.hideHot();
    this.updateBadge();
    
    // Parar música de tensión
    this.callbacks.stopSnd('tension');
    setTimeout(() => this.callbacks.stopSnd('tension'), 50);

    if (success) {
      // Victoria: sparkle y pasar a Frenzy
      const coinRect = this.elements.coin?.getBoundingClientRect();
      if (coinRect) {
        this.callbacks.popSparkle(
          coinRect.left + coinRect.width / 2,
          coinRect.top + coinRect.height / 2
        );
      }
      
      this.callbacks.playSnd('freeze', { volume: 1.0 });
      setTimeout(() => {
        this.callbacks.playSnd('slot', { volume: 0.9, loop: true });
      }, 400);
      setTimeout(() => {
        this.callbacks.stopSnd('slot');
      }, 5500);
      
      this.startFrenzy();
    } else {
      // Derrota: resetear progreso
      this.callbacks.playSnd('laugh', { volume: 0.9 });
      this.state.level = 0;
      this.state.progress = { 1: 0, 2: 0, 3: 0, 4: 0 };
      this.updateBadge();
    }
  }

  startChallengeArc() {
    const { windowArc, windowArcCircle } = this.elements;
    if (!windowArc || !windowArcCircle) return;
    
    windowArcCircle.style.stroke = 'url(#frenzy777)';
    windowArcCircle.setAttribute('stroke-dasharray', '360 360');
    windowArc.style.opacity = '1';
    
    const t0 = performance.now();
    const tick = () => {
      const now = performance.now();
      const offset = (now - t0) * 0.15;
      
      windowArcCircle.setAttribute('stroke-dashoffset', String(offset % 360));
      
      if (this.challenge.active) {
        this.challenge.arcRaf = requestAnimationFrame(tick);
      } else {
        this.hideArc();
      }
    };
    
    this.challenge.arcRaf = requestAnimationFrame(tick);
  }

  stopChallengeArc() {
    cancelAnimationFrame(this.challenge.arcRaf || 0);
    this.hideArc();
  }

  // === SPAWN POR TAPS ===
  maybeSpawnByTap() {
    this.state.tapCounter++;
    
    if (this.state.tapCounter >= this.state.nextSpawnAt) {
      const level = this.targetLevel();
      const isDecoy = Math.random() < COMBO_CONFIG.DECOY_CHANCE;
      const skin = isDecoy ? 'decoy' : `x${level}`;
      
      this.callbacks.showHot(skin);
      
      const range = COMBO_CONFIG.SPAWN_TAPS[level];
      this.state.nextSpawnAt = this.state.tapCounter + this.randInt(range[0], range[1]);
    }
  }

  // === GESTIÓN DE BADGES ===
  updateBadge() {
    const comboBadgeEl = this.elements.comboBadge;
    if (!comboBadgeEl) return;

    let comboTxtEl = comboBadgeEl.querySelector('#comboTxt');
    if (!comboTxtEl) {
      comboTxtEl = document.createElement('span');
      comboTxtEl.id = 'comboTxt';
      comboBadgeEl.innerHTML = '';
      comboBadgeEl.appendChild(comboTxtEl);
    }

    const text = this.getCurrentComboText();
    
    if (!text) {
      comboBadgeEl.style.display = 'none';
      comboTxtEl.classList.remove('rainbowText', 'pulseBeat');
      return;
    }

    // Mostrar badge
    comboBadgeEl.style.display = 'block';
    comboTxtEl.textContent = text;
    
    // Posición fija
    comboBadgeEl.style.position = 'absolute';
    comboBadgeEl.style.left = '10px';
    comboBadgeEl.style.top = '10px';
    comboBadgeEl.style.transform = 'none';
    comboBadgeEl.style.zIndex = '3000';

    // Estilos base
    comboBadgeEl.style.background = 'rgba(0,0,0,.70)';
    comboBadgeEl.style.border = '1px solid rgba(255,255,255,.18)';
    comboBadgeEl.style.borderRadius = '12px';
    comboBadgeEl.style.padding = '4px 10px';
    comboBadgeEl.style.fontWeight = '800';
    comboBadgeEl.style.fontSize = '12px';

    // Colores específicos
    if (this.challenge.active) {
      comboTxtEl.style.color = 'transparent';
      comboTxtEl.classList.add('rainbowText', 'pulseBeat');
    } else {
      comboTxtEl.classList.remove('rainbowText', 'pulseBeat');
      
      const now = performance.now();
      if (now < this.state.frenzyUntil) {
        comboBadgeEl.style.background = 'linear-gradient(180deg,#3a2a00,#1a1200)';
        comboTxtEl.style.color = '#ffd872';
      } else if (this.state.level >= 1) {
        comboTxtEl.style.color = LEVEL_COLORS[this.state.level] || '#ffd872';
      } else {
        comboTxtEl.style.color = '#ffd872';
      }
    }
  }

  // === UTILIDADES VISUALES ===
  showArcSegment(deg, level) {
    const { windowArc, windowArcCircle } = this.elements;
    if (!windowArc || !windowArcCircle) return;

    this.setHaloArcColors(level);
    
    windowArcCircle.style.stroke = 'url(#haloArc)';
    windowArcCircle.setAttribute('stroke-width', '7');
    windowArcCircle.setAttribute('stroke-linecap', 'round');
    windowArcCircle.setAttribute('filter', 'url(#arcGlow)');
    windowArcCircle.setAttribute('stroke-dasharray', `${deg} 360`);
    windowArcCircle.setAttribute('stroke-dashoffset', '0');
    
    windowArc.style.opacity = '1';
  }

  updateArcProgress(level, progress) {
    const { windowArcCircle } = this.elements;
    if (!windowArcCircle) return;
    
    const deg = Math.round((level / 6) * 360);
    const offset = Math.min(deg, deg * progress);
    
    windowArcCircle.setAttribute('stroke-dashoffset', String(offset));
  }

  hideArc() {
    const { windowArc } = this.elements;
    if (windowArc) windowArc.style.opacity = '0';
  }

  setHaloArcColors(level) {
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

  addVibrateClass() {
    ['comboBadge', 'windowTag'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('vibeX');
    });
  }

  removeVibrateClass() {
    ['comboBadge', 'windowTag'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('vibeX');
    });
  }

  // === GESTIÓN DE HOTSPOT LOCK ===
  lockHotspot(locked) {
    this.hotLocked = locked;
    if (this.callbacks.setHotspotLock) {
      this.callbacks.setHotspotLock(locked);
    }
  }

  isHotspotLocked() {
    return this.hotLocked || false;
  }

  // === API PÚBLICA ===

  /**
   * Procesa un tap del usuario
   * @param {Event} event - Evento de tap/click
   */
  handleTap(event) {
    // Rainbow Challenge tiene prioridad
    if (this.challenge.active) {
      this.handleChallengeTap(event);
      return;
    }

    // Procesar combo normal
    this.processTap(event);
  }

  /**
   * Maneja spawn de hotspots por conteo de taps
   */
  handleTapSpawn() {
    this.maybeSpawnByTap();
  }

  /**
   * Resetea completamente el sistema de combos
   */
  reset() {
    this.state.level = 0;
    this.state.progress = { 1: 0, 2: 0, 3: 0, 4: 0 };
    this.state.frenzyUntil = 0;
    this.state.tapCounter = 0;
    this.state.nextSpawnAt = 0;

    this.challenge.active = false;
    this.challenge.completed = false;
    this.challenge.hits = 0;
    
    this.closeWindow();
    this.stopChallengeArc();
    this.hideArc();
    this.callbacks.tagHide();
    this.removeVibrateClass();
    this.updateBadge();
  }

  /**
   * Obtiene el estado actual del sistema
   */
  getState() {
    return {
      level: this.state.level,
      progress: { ...this.state.progress },
      hasActiveWindow: !!this.state.window,
      inFrenzy: performance.now() < this.state.frenzyUntil,
      inChallenge: this.challenge.active,
      challengeHits: this.challenge.hits,
      tapCounter: this.state.tapCounter
    };
  }

  /**
   * Restaura estado del sistema (para persistencia)
   */
  setState(state) {
    if (state.level !== undefined) this.state.level = state.level;
    if (state.progress) this.state.progress = { ...state.progress };
    if (state.tapCounter !== undefined) this.state.tapCounter = state.tapCounter;
    
    this.updateBadge();
  }

  /**
   * Fuerza inicio de Frenzy (para testing/cheats)
   */
  forceFrenzy() {
    this.startFrenzy();
  }

  /**
   * Fuerza inicio de Rainbow Challenge (para testing)
   */
  forceRainbow() {
    this.startRainbowChallenge();
  }

  /**
   * Obtiene multiplicador actual de bonus
   */
  getCurrentBonus() {
    const now = performance.now();
    
    if (now < this.state.frenzyUntil) {
      return COMBO_CONFIG.FRENZY_BONUS;
    }
    
    if (this.state.window) {
      return COMBO_CONFIG.BONUS[this.state.window.level] || 0;
    }
    
    return 0;
  }

  /**
   * Verifica si hay ventana activa
   */
  hasActiveWindow() {
    return !!this.state.window;
  }

  /**
   * Obtiene información de la ventana activa
   */
  getActiveWindow() {
    if (!this.state.window) return null;
    
    const now = performance.now();
    const elapsed = now - this.state.window.t0;
    const progress = Math.min(1, elapsed / this.state.window.durationMs);
    
    return {
      level: this.state.window.level,
      tapsNeeded: this.state.window.tapsNeeded,
      tapsDone: this.state.window.tapsDone,
      progress: progress,
      timeLeft: Math.max(0, this.state.window.durationMs - elapsed)
    };
  }

  /**
   * Cleanup completo del sistema
   */
  destroy() {
    this.closeWindow();
    this.stopChallengeArc();
    
    clearTimeout(this.challenge.timerId);
    clearTimeout(this.challenge.spawnTimer);
    
    this.callbacks.setTickModeMp3(false);
    this.callbacks.stopSnd('tension');
    this.callbacks.stopSnd('slot');
    
    this.removeVibrateClass();
  }
}

// === INSTANCIA SINGLETON ===
let comboSystemInstance = null;

/**
 * Inicializa el sistema de combos
 * @param {Object} callbacks - Callbacks para interactuar con otros sistemas
 * @returns {ComboSystem} Instancia del sistema
 */
export function initComboSystem(callbacks = {}) {
  if (!comboSystemInstance) {
    comboSystemInstance = new ComboSystem();
  }
  
  comboSystemInstance.setCallbacks(callbacks);
  return comboSystemInstance;
}

/**
 * Obtiene la instancia actual del sistema de combos
 */
export function getComboSystem() {
  return comboSystemInstance;
}

/**
 * API simplificada para integración rápida
 */
export const ComboAPI = {
  // Eventos principales
  handleTap: (event) => comboSystemInstance?.handleTap(event),
  handleTapSpawn: () => comboSystemInstance?.handleTapSpawn(),
  
  // Estado
  getState: () => comboSystemInstance?.getState(),
  setState: (state) => comboSystemInstance?.setState(state),
  reset: () => comboSystemInstance?.reset(),
  
  // Información
  getCurrentBonus: () => comboSystemInstance?.getCurrentBonus() || 0,
  hasActiveWindow: () => comboSystemInstance?.hasActiveWindow() || false,
  getActiveWindow: () => comboSystemInstance?.getActiveWindow(),
  
  // Testing/Debug
  forceFrenzy: () => comboSystemInstance?.forceFrenzy(),
  forceRainbow: () => comboSystemInstance?.forceRainbow(),
  
  // Cleanup
  destroy: () => {
    comboSystemInstance?.destroy();
    comboSystemInstance = null;
  }
};

// === CONFIGURACIÓN EXPORTADA ===
export const COMBO_SETTINGS = COMBO_CONFIG;
export const RAINBOW_SETTINGS = RAINBOW_CONFIG;
export const LEVEL_COLORS_EXPORT = LEVEL_COLORS;

// === EXPORTACIÓN PRINCIPAL ===
export default {
  ComboSystem,
  initComboSystem,
  getComboSystem,
  ComboAPI,
  COMBO_SETTINGS,
  RAINBOW_SETTINGS,
  LEVEL_COLORS_EXPORT
};