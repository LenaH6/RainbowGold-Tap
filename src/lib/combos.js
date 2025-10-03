// src/lib/combos.js
// Funciones puras: no usan DOM, no manejan timers, no tocan audio ni storage.
// Solo reciben argumentos y devuelven resultados predictibles.

const BASE_MULTIPLIER = 1;
const STREAK_STEP = 0.1; // +0.1 por cada tap en racha
const MAX_MULTIPLIER = 5;

export function calcMultiplier(streak) {
  // streak = número entero de taps consecutivos
  if (!Number.isFinite(streak) || streak <= 0) return BASE_MULTIPLIER;
  const m = BASE_MULTIPLIER + (streak - 1) * STREAK_STEP;
  return Math.min(m, MAX_MULTIPLIER);
}

export function pointsForTap(basePoints, streak) {
  const multiplier = calcMultiplier(streak);
  // devuelve entero
  return Math.floor(basePoints * multiplier);
}

export function resetCombo() {
  return { streak: 0, lastTapAt: 0 };
}

export function updateCombo(state, now, maxGapMs = 1500) {
  // state = { streak, lastTapAt }
  // now = performance.now() (número)
  if (!state || typeof now !== 'number') return resetCombo();
  if (now - state.lastTapAt > maxGapMs) {
    // gap demasiado grande → rompe la racha
    return { streak: 1, lastTapAt: now };
  } else {
    return { streak: state.streak + 1, lastTapAt: now };
  }
}
