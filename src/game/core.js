// src/game/core.js
// Orquesta la lógica del juego. Usa funciones puras de src/lib/combos.js.
// Maneja estado, timers y expone una API (start, stop, handleTap, on).

import { pointsForTap, updateCombo, resetCombo } from '../lib/combos.js';
import * as storage from '../lib/storage.js'; // asume que existe

const DEFAULT_BASE_POINTS = 1;

export function createGame(opts = {}) {
  const basePoints = opts.basePoints ?? DEFAULT_BASE_POINTS;
  let state = {
    running: false,
    score: 0,
    combo: resetCombo(), // {streak, lastTapAt}
    lastTick: 0,
  };

  const listeners = new Map(); // event -> [fn]

  function emit(event, payload) {
    const arr = listeners.get(event) || [];
    arr.forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  }

  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(fn);
    return () => { // off
      const list = listeners.get(event) || [];
      listeners.set(event, list.filter(x => x !== fn));
    };
  }

  function start() {
    state.running = true;
    state.lastTick = performance.now();
    emit('start', { state: { ...state } });
  }

  function pause() {
    state.running = false;
    emit('pause', { state: { ...state } });
  }

  function handleTap() {
    if (!state.running) return;
    const now = performance.now();
    state.combo = updateCombo(state.combo, now);
    const points = pointsForTap(basePoints, state.combo.streak);
    state.score += points;
    emit('tap', { points, score: state.score, combo: state.combo });
    // ejemplo de persistencia ligera
    storage.set('rg_score', { score: state.score, combo: state.combo });
  }

  function reset() {
    state.score = 0;
    state.combo = resetCombo();
    emit('reset', { state: { ...state } });
    storage.remove('rg_score');
  }

  function getState() {
    return { ...state };
  }

  return {
    start,
    pause,
    reset,
    handleTap,
    getState,
    on, // suscribir eventos: 'start','pause','tap','reset'
  };
}
