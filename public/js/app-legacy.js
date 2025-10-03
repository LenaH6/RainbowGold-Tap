/* ==== COMBOS/MANCHAS (config editable) ==== */
const BONUS = { 1:0.025, 2:0.030, 3:0.035, 4:0.040, 5:0.045 };     // % sobre POWER_BASE
const WINDOW_MS = { 1:700, 2:1200, 3:1600, 4:2000, 5:2400 };       // duración de ventana
const ADV_REQ    = { 1:3, 2:2, 3:2, 4:2 };                         // ventanas completas necesarias
const SPAWN_TAPS = { 1:[7,12], 2:[9,14], 3:[10,15], 4:[12,18], 5:[14,20] };
const FRENZY_MS = 5500;                                           // combo máximo
const DECOY_CHANCE = 0.25;                                        // prob. de decoy
const USE_TAP_SPAWN = true; 
/* ==== DESAFÍO ARCOÍRIS (config) ==== */
const RAINBOW = {
  HITS: 6,                     // toques necesarios a manchas arcoíris
  DECOY_CHANCE: 0.45,          // probabilidad de distractor durante el desafío
  APPEAR_MS: [2500, 3200],       // visibilidad de cada mancha (ms)
  TOTAL_MS: 12000              // tiempo máximo del desafío (ms). Si no se logra → vuelve al base
};

const challenge = {
  active: false,
  completed: false,
  hits: 0,
  t0: 0,
  arcRaf: 0,
  timerId: 0
};

// Umbral para marcar energía baja (0..100)
const LOW_ENERGY_THRESHOLD = 50;
// Aparición (antes de activarla): rangos por nivel (ms)
const APPEAR_MS = {
  1: [1600, 2400],
  2: [1400, 2000],
  3: [1100, 1600],
  4: [ 900, 1300],
  5: [ 700, 1000],
  decoy: [650, 900]
};

function updateRefillCue(){
  if (!refillBtn) return;
  const now = performance.now();
  const inCooldown = now < (noEnergyUntil || 0);
  const e = (typeof energy === 'number') ? energy : 100;

  // limpia estados
  refillBtn.classList.remove('refillPulse', 'refillAlarm');

  if (e <= 0 || inCooldown) {
    // vacío o cooldown → alarma fuerte
    refillBtn.classList.add('refillAlarm');
  } else if (e > 0 && e < LOW_ENERGY_THRESHOLD) {
    // bajo → pulso suave
    refillBtn.classList.add('refillPulse');
  }
}

// === decimales fijos y helpers del numerito ===
const GAIN_DECIMALS = 4;
const fmt = (n) => Number(n).toFixed(GAIN_DECIMALS);
const setLastGainTotal = (tot) => { if (lastGainEl) lastGainEl.textContent = `+${fmt(tot)}`; };
                                    // usamos spawn por TAP

/* ==== Estado de combo ==== */
const combo = {
  level: 0,                               // 0 base; 1..5 = X1..X5
  progress: {1:0,2:0,3:0,4:0},            // ventanas completas por nivel
  window: null,                           // ventana activa
  frenzyUntil: 0,                         // fin de Frenzy (ms, performance.now)
  tapCounter: 0,                          // conteo de taps global
  nextSpawnAt: 0                          // umbral próximo spawn
  };
// cooldown de “sin energía” (2s)
let noEnergyUntil = 0;
// Control del halo/mancha
let hotAutoTimer = 0;   // timeout para auto-ocultar si NO se activa
let hotLocked = false;  // true mientras la ventana esté activa (no ocultar)
// --- No permitir que hideHot() oculte la mancha mientras hay ventana activa ---
const _hideHotOrig = (typeof window.hideHot === 'function') ? window.hideHot : null;
function hideHotSafe(){
  if (hotLocked) return;        // si hay ventana, NO ocultes
  _hideHotOrig && _hideHotOrig();
}
// reemplaza el hideHot global por el seguro
if (_hideHotOrig) window.hideHot = hideHotSafe;


 
function targetLevel(){ return Math.max(1, combo.level || 1); }
// — Aplica combo/ventana/frenzy en este tap —
function applyComboTap(e){
  const now = performance.now();

  // 1) FRENZY: +5% de POWER_BASE extra (el base ya lo sumó addTap())
  if (now < combo.frenzyUntil){
    const extra = POWER_BASE * 0.05;
    addTapAmount(extra);
     setLastGainTotal(POWER_BASE + extra);
    try { if (typeof playSnd === 'function') playSnd('tick', { volume: .7 }); } catch(_){}

  updateBadge();
  return;
  }

  // 2) Si hay ventana activa: cada tap suma extra y puede completar
if (combo.window){
  const L = combo.window.level;

  // Solo cuenta si el tap cae dentro del núcleo capturado
  if (!isInWindowRect(e)) return; // fuera del difuminado: sin bonus ni progreso

  combo.window.tapsDone += 1;
    soundTapProgress(L, combo.window.tapsDone);

  if (windowTag) windowTag.textContent = 'X'+L+' '+combo.window.tapsDone+'/'+combo.window.tapsNeeded;

  popLabel('X'+L, e.clientX, e.clientY, { color:'#ff3030', fontSize:36, dy:-130 });

  // extra por tap dentro de ventana
  const extra = POWER_BASE * BONUS[L];
  addTapAmount(extra);
  setLastGainTotal(POWER_BASE + extra);


  // ¿completa antes de que se acabe el tiempo?
  if (combo.window.tapsDone >= combo.window.tapsNeeded){
    const level = L;


    arcFlash();

    // Cerramos un instante después para que se vea el flash
    setTimeout(()=>{
      const r = coin.getBoundingClientRect();
      popSparkle(r.left + r.width/2, r.top + r.height/2);

      closeWindow();
      combo.progress[level] = (combo.progress[level] || 0) + 1;

     if (level === 5){
       playSnd('rainbow', { volume: 1.0 }); // anuncio RAINBOW RACE
        // ✅ En lugar de Frenzy directo → DESAFÍO ARCOÍRIS
        startRainbowChallenge();
        return; // importante
      } else {
              // Subir si cumple requisito; si no, se mantiene
              if (combo.progress[level] >= ADV_REQ[level]){
                combo.level = level + 1;
                combo.progress[level] = 0;
              } else {
                combo.level = Math.max(combo.level, level);
              }
        updateBadge();
      }
    }, 160);
  }

  return; // importante: salimos aquí
}


  // 3) No hay ventana activa → ¿tocaste mancha real?
  const hit = (typeof hotActive!=='undefined' && hotActive && typeof isInHot==='function' && isInHot(e));
  const skin = (typeof hotSkin==='string') ? hotSkin : '';
  if (hit && /^x[1-5]$/.test(skin)){
  const level = Math.max(1, Math.min(5, parseInt(skin.slice(1),10) || 1));
  popLabel('X'+level, e.clientX, e.clientY, { color:'#ff3030', fontSize:40, dy:-150 });
  createWindow(level);
  }
  // Si fue decoy o no había mancha real → sin cambios
}


/* ==== Sonidos (usa tone() que ya tienes) ==== */
function soundLevel(n){ const base=560+n*70; tone(base,0.05,'square',.09); setTimeout(()=>tone(base+90,0.04,'triangle',.07),70); }
function soundMiss(){ tone(520,0.045,'sawtooth',.07); setTimeout(()=>tone(420,0.045,'sawtooth',.06),70); }
function soundFrenzyStart(){ tone(680,0.12,'square',.10); setTimeout(()=>tone(840,0.12,'triangle',.09),120); }
function soundTapProgress(level, tapIndex){
  // Pitch crece por nivel y por el índice del tap
  const base = 1000 + level*120 + (tapIndex-1)*90;
  tone(base, .035, 'square', .07);
  if (typeof playSnd === 'function') playSnd('tick', { volume: .7 });
}

function soundFrenzy777(){

  // campanillas rápidas tipo máquina 777
  const seq = [620,740,880,740,880,980,1100];
  let t = 0;
  for (let i=0;i<seq.length;i++){
    setTimeout(()=>tone(seq[i],0.05,'triangle',.10), t);
    t += 70;
  }
}


/* ==== Helper pequeño ==== */
function randInt(a,b){ return (a|0)+Math.floor(Math.random()*((b|0)-(a|0)+1)); }
// === Badge (Xn / FRENZY / oculto en base) ===
const comboBadgeEl = document.getElementById('comboBadge');
function setBadge(txt, bg, fg){
  if (!comboBadgeEl) return;

  // Asegura span interno
  if (!comboTxtEl){
    comboTxtEl = document.createElement('span');
    comboTxtEl.id = 'comboTxt';
    comboBadgeEl.innerHTML = '';
    comboBadgeEl.appendChild(comboTxtEl);
  }

  if (!txt){
    comboBadgeEl.style.display = 'none';
    comboTxtEl.classList.remove('rainbowText','pulseBeat');
    comboTxtEl.style.color = ''; // limpia el color del texto
    return;
  }

  comboBadgeEl.style.display = 'block';
  comboTxtEl.textContent = txt;

  // Posición fija a la izquierda (no recentrar nunca)
  comboBadgeEl.style.position = 'absolute';
  comboBadgeEl.style.left = '10px';
  comboBadgeEl.style.top = '10px';
  comboBadgeEl.style.transform = 'none';
  comboBadgeEl.style.zIndex = '3000';

// Pastilla base (en el CONTENEDOR, no en el texto)
comboBadgeEl.style.background   = (bg === undefined) ? 'rgba(0,0,0,.70)' : bg; // mismo alpha que la derecha
comboBadgeEl.style.border       = '1px solid rgba(255,255,255,.18)';
comboBadgeEl.style.borderRadius = '12px'; // 12px = igual a la derecha
comboBadgeEl.style.padding      = '4px 10px'; // 4x10 = igual a la derecha
comboBadgeEl.style.fontWeight   = '800';  // = windowTag
comboBadgeEl.style.fontSize     = '12px'; // = windowTag
comboBadgeEl.style.letterSpacing= '0';    // la derecha no usa tracking



  // Color del TEXTO (en el span). Si queremos arcoíris → transparente
  if (fg === 'transparent'){
    comboTxtEl.style.color = 'transparent';
  } else {
    comboTxtEl.style.color = (fg === undefined) ? '#ffd872' : fg;
  }
}




function updateBadge(){
if (challenge?.active) {
  setBadge('RAINBOW RACE', 'rgba(0,0,0,.55)', 'transparent');
  comboTxtEl?.classList.add('rainbowText','pulseBeat');  // 👈 clases al TEXTO
  return;
} else {
  comboTxtEl?.classList.remove('rainbowText','pulseBeat');
}

  const now = performance.now();

  if (now < combo.frenzyUntil){

    setBadge('FRENZY', 'linear-gradient(180deg,#3a2a00,#1a1200)', '#ffd872');
    return;
  }

  if (combo.level >= 1){
    const colorPorNivel = {1:'#ffd872',2:'#9cff70',3:'#6ae1ff',4:'#d08bff',5:'#ff6a6a'}[combo.level] || '#ffd872';
    setBadge('X'+combo.level, 'rgba(0,0,0,.55)', colorPorNivel);
  } else {
    setBadge(null);
  }
}

function spawnHotWithTimer(skin){
  // skin: 'x1'..'x5' o 'decoy'
  if (typeof showHot === 'function') showHot(skin);

  hotLocked = false;                // aún NO activada
  clearTimeout(hotAutoTimer);

  const key = (skin === 'decoy') ? 'decoy' : Math.max(1, Math.min(5, parseInt(skin.slice(1),10)));
  const R = APPEAR_MS[key];         // [min,max]
  const ms = randInt(R[0], R[1]);

  hotAutoTimer = setTimeout(()=>{
    if (!hotLocked && typeof hideHot === 'function') hideHot();
  }, ms);
}
// === ARO (helpers) ===
const windowArc = document.getElementById('windowArc');
// Sonido de éxito al completar la ventana (corto y ascendente)
function soundWindowComplete(level){
  const base = 600 + level*60;
  tone(base,0.06,'square',.10);
  setTimeout(()=>tone(base+140,0.05,'triangle',.10),80);
  setTimeout(()=>tone(base+260,0.05,'triangle',.09),160);
}

// Flash del aro: muestra el círculo completo y engrosa un instante
function arcFlash(){
  if (!windowArc || !windowArcCircle) return;
  const prevDash  = windowArcCircle.getAttribute('stroke-dasharray') || '360 360';
  const prevWidth = windowArcCircle.getAttribute('stroke-width') || '4';

  // mostrar aro completo y más grueso por ~140ms
  windowArcCircle.setAttribute('stroke-dasharray','360 360');
  windowArcCircle.setAttribute('stroke-width','6');
  windowArc.style.opacity = '1';

  setTimeout(()=>{
    windowArcCircle.setAttribute('stroke-dasharray', prevDash);
    windowArcCircle.setAttribute('stroke-width', prevWidth);
  }, 140);
}

const windowArcCircle = windowArc ? windowArc.querySelector('circle') : null;
const LEVEL_COLOR = {1:'#ffd872',2:'#9cff70',3:'#6ae1ff',4:'#d08bff',5:'#ff6a6a'};

function arcShowSegment(deg, level){
  if (!windowArc || !windowArcCircle) return;

  // Colores del gradiente según nivel
  setHaloArcColors(level);

  // Trazo potente con glow (sin opacidad lavada)
  windowArcCircle.style.stroke = 'url(#haloArc)';
  windowArcCircle.setAttribute('stroke-width', '7');      // más cuerpo
  windowArcCircle.setAttribute('stroke-linecap', 'round');
  windowArcCircle.removeAttribute('style');               // limpia CSS previos
  windowArcCircle.setAttribute('filter', 'url(#arcGlow)'); // ⭐ usa filtro SVG

  // Progreso
  windowArcCircle.setAttribute('stroke-dasharray', `${deg} 360`);
  windowArcCircle.setAttribute('stroke-dashoffset', '0');

  // mostrar
  windowArc.style.opacity = '1';
}

function arcUpdateProgress(level, t){  // level: 1..5, t: 0→1
  if (!windowArcCircle) return;
  const deg = Math.round((level/6)*360);
arcShowSegment(deg, level);

  const off = Math.min(deg, deg * t);    // cuánto se consume del segmento
  windowArcCircle.setAttribute('stroke-dashoffset', String(off));
}

function arcHide(){
  if (windowArc) windowArc.style.opacity = '0';
}


// ==== Ganancias flotantes (un div por cada tap) ====
let lastGainEl = null;
const gainPool = []; // para no acumular infinitos

function spawnGain(x, y, text){
  const el = document.createElement('div');
  el.textContent = text;
  el.style.position = 'fixed';          // fuera de la moneda, no se recorta
  el.style.left = x + 'px';
  el.style.top  = (y - 70) + 'px';
  el.style.fontSize = '18px';
  el.style.fontWeight = '900';
  el.style.color = '#fff';
  el.style.pointerEvents = 'none';
  el.style.zIndex = 1001;
  el.style.textShadow = '0 2px 6px rgba(0,0,0,.55), 0 0 10px rgba(0,0,0,.35)';
  el.style.willChange = 'transform,opacity';
  document.body.appendChild(el);

  // animación más lenta y alta (no tocamos la altura)
  const anim = el.animate(
    [{ transform:'translateY(0)',   opacity:1 },
     { transform:'translateY(-100px)', opacity:0 }],
    { duration: 3200, easing:'cubic-bezier(.18,.9,.22,1)' }
  );
  anim.onfinish = () => el.remove();

  // guarda referencia al "último" para poder actualizar a base+bonus
  lastGainEl = el;

  // limita la cantidad (por si spamean): máximo 10 en pantalla
  gainPool.push(el);
  if (gainPool.length > 10){
    const old = gainPool.shift();
    try { old.remove(); } catch(e){}
  }
}

// --- Mostrar el "+valor" más lento y SIEMPRE por fuera de la moneda ---
let gainAnim = null;
function showGain(x, y, text){
  // x,y ahora son COORDENADAS DE PANTALLA (clientX, clientY)
  gain.style.position = 'fixed';     // ← clave: no lo recorta el #coin
  gain.style.left     = x + 'px';
  gain.style.top      = (y - 70) + 'px'; // la altura que ya te gustó
  gain.style.zIndex   = 1001;
  gain.style.opacity  = '1';
  gain.textContent    = text;

  try { if (gainAnim) gainAnim.cancel(); } catch(e){}

  // MISMA altura (~96px) pero más LENTO (1.4s)
  gainAnim = gain.animate(
    [
      { transform:'translateY(0px)',   opacity: 1 },
      { transform:'translateY(-96px)', opacity: 0 }
    ],
    { duration: 2400, easing: 'cubic-bezier(.18,.9,.22,1)' } // ← más lento
  );

  // Limpieza automática (no queda pegado)
  gainAnim.onfinish = () => { gain.style.opacity = '0'; gain.textContent = ''; };
  setTimeout(() => {
    if (!gainAnim || gainAnim.playState !== 'running'){
      gain.style.opacity = '0';
      gain.textContent = '';
    }
  }, 1900);
}
/* ==== Stickers/Labels flotantes ==== */
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function popLabel(text, x, y, opt={}){
  const {
    fontSize = 36,        // tamaño default
    dy       = -120,      // cuánto sube
    duration = 1600,      // ← antes 1000 aprox
    color    = '#ff3030', // rojo llamativo
    weight   = 900
  } = opt;

  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const el = document.createElement('div');
  el.textContent = text;
  el.style.position = 'fixed';
  el.style.left = clamp(x, 24, window.innerWidth-24) + 'px';
  el.style.top  = clamp(y, 24, window.innerHeight-24) + 'px';
  el.style.transform = 'translate(-50%,-50%)';
  el.style.fontSize = fontSize + 'px';
  el.style.fontWeight = String(weight);
  el.style.color = color;
  el.style.textShadow = '0 2px 10px rgba(0,0,0,.45)';
  el.style.letterSpacing = '1px';
  el.style.pointerEvents = 'none';
  el.style.zIndex = 1002;
  document.body.appendChild(el);

  // más suave: entra, se queda un poquito, luego se va
  const anim = el.animate(
    [
      { transform:'translate(-50%,-50%) scale(.92)',  opacity: 0   },
      { transform:'translate(-50%,-54%) scale(1.00)', opacity: 1, offset: .38 },
      { transform:`translate(-50%, calc(-50% + ${dy}px)) scale(1.04)`, opacity: 0 }
    ],
    { duration, easing:'cubic-bezier(.18,.9,.22,1)' } // easing más calmado
  );
  anim.onfinish = ()=> el.remove();
}


function popLaugh(x, y){
  popLabel('😂', x, y, { fontSize: 40, dy: -120, duration: 2200, color:'#fff' });
}
function popSparkle(x, y){
  // Sin brillo visual (sin emoji ✨); conservamos solo el sonido NICE
  try {
    if (typeof playSnd === 'function') playSnd('nice', { volume: 0.95 });
  } catch (_){}
}


function popBadge(text){
  // centrado en la moneda
  const r = coin.getBoundingClientRect();
  const cx = r.left + r.width/2;
  const cy = r.top  + r.height/2 - 20;
  popLabel(text, cx, cy, { fontSize: 36, dy: -120 });
}



// Letrero del nivel/progreso (si aún no lo pegaste)
const windowTag = document.getElementById('windowTag');
function tagShow(text, color){
  if (!windowTag) return;
  windowTag.textContent = text;
  if (color) windowTag.style.color = color;
  windowTag.style.opacity = '1';
  windowTag.style.transform = 'scale(1.06)';
  setTimeout(()=>{ if(windowTag) windowTag.style.transform='scale(1)'; }, 90);
}
function tagHide(){
  if (!windowTag) return;
  windowTag.style.opacity = '0';
  windowTag.style.transform = 'scale(.9)';
}

// Aro completo para FRENZY
function startFrenzyArc(){
  if (!windowArc || !windowArcCircle) return;
  windowArcCircle.style.stroke = 'url(#frenzy777)';
  windowArcCircle.setAttribute('stroke-dasharray', '360 360');
  windowArcCircle.setAttribute('stroke-dashoffset', '0');
  windowArc.style.opacity = '1';

  const t0 = performance.now();
  function tick(){
    const now = performance.now();
    const elapsed = Math.min(FRENZY_MS, now - t0);
    const off = 360 * (elapsed / FRENZY_MS);
    windowArcCircle.setAttribute('stroke-dashoffset', String(off));
    if (now < combo.frenzyUntil){
      requestAnimationFrame(tick);
    } else {
      arcHide();
    }
  }
  requestAnimationFrame(tick);
}

function startChallengeArc(){
  if (!windowArc || !windowArcCircle) return;
  windowArcCircle.style.stroke = 'url(#frenzy777)'; // usamos el mismo gradiente multicolor
  windowArcCircle.setAttribute('stroke-dasharray', '360 360');
  windowArc.style.opacity = '1';

  // giro infinito hasta que termine el desafío
  const t0 = performance.now();
  function tick(){
    const now = performance.now();
    const off = (now - t0) * 0.15; // velocidad de giro
    windowArcCircle.setAttribute('stroke-dashoffset', String(off % 360));
    if (challenge.active){
      challenge.arcRaf = requestAnimationFrame(tick);
    } else {
      arcHide();
    }
  }
  challenge.arcRaf = requestAnimationFrame(tick);
}

function stopChallengeArc(){
  cancelAnimationFrame(challenge.arcRaf || 0);
  arcHide();
}


function isInWindowRect(e){
  if (!combo.window || !combo.window.hitRect) return false;
  const coinRect = coin.getBoundingClientRect();
  const x = (e.clientX - coinRect.left) / coinRect.width;
  const y = (e.clientY - coinRect.top ) / coinRect.height;
  const r = combo.window.hitRect;
  return (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}



function closeWindow(){
  if (!combo.window) return;
  cancelAnimationFrame(combo.window.rafId);
  combo.window = null;
  arcHide();
  tagHide();
  hotLocked = false;
  clearTimeout(hotAutoTimer);
  if (typeof hideHot === 'function') hideHot();  // ocultar la mancha al terminar la ventana

}

function tickWindow(){
  const w = combo.window; if (!w) return;
  const now = performance.now();
  const t = Math.min(1, (now - w.t0) / w.durationMs); // 0→1
  arcUpdateProgress(w.level, t);
  if (t >= 1){
    // Tiempo agotado → FALLO
    soundMiss();
        // Burla centrada en la moneda cuando expira la ventana
    (function(){
      const r = coin.getBoundingClientRect();
      popLaugh(r.left + r.width/2, r.top + r.height/2);
    })();
    playSnd('laugh', { volume: 0.9 });


    if (w.level >= 2){ combo.level = w.level - 1; }
    else { combo.level = 0; }
    combo.progress = {1:0,2:0,3:0,4:0};
    closeWindow();
    updateBadge();
    return;
  }

  combo.window.rafId = requestAnimationFrame(tickWindow);
}

function createWindow(level){
  if (combo.window) return; // ya hay una activa, la que manda
  // Rect del núcleo capturado (normalizado al tamaño de la moneda)
const coinRect = coin.getBoundingClientRect();
const coreRect = hotCore ? hotCore.getBoundingClientRect() : null;
let hitRect = null;
if (coreRect){
  hitRect = {
    x: (coreRect.left - coinRect.left) / coinRect.width,
    y: (coreRect.top  - coinRect.top ) / coinRect.height,
    w:  coreRect.width  / coinRect.width,
    h:  coreRect.height / coinRect.height
  };
}

  combo.window = {
    level,
    tapsNeeded: level, // regla: #taps == nivel
    tapsDone: 0,
    t0: performance.now(),
    durationMs: WINDOW_MS[level],
    rafId: 0,
    hitRect // ← área válida donde deben caer los taps
  };
  soundLevel(level);
  // Mantener visible la mancha durante toda la ventana
  hotLocked = true;
  clearTimeout(hotAutoTimer);

    // Aro segmentado según el nivel (X1=1/6...X5=5/6)
  const deg = Math.round((level/6)*360);
  arcShowSegment(deg, LEVEL_COLOR[level]);

  // (opcional) ocultar la barrita horizontal si no la quieres
  if (windowBar){ windowBar.style.opacity='0'; windowBar.style.width='0'; }
  tagShow('X'+level+' 0/'+level, LEVEL_COLOR[level]);

  updateBadge();
  combo.window.rafId = requestAnimationFrame(tickWindow);
}

function spawnRainbowOrDecoy(){
  // aparición rápida y exclusiva del desafío
  clearTimeout(hotAutoTimer);
  const isDecoy = Math.random() < RAINBOW.DECOY_CHANCE;
  const skin = isDecoy ? 'decoy' : 'rb';
  if (typeof showHot === 'function') showHot(skin);

  hotLocked = false;
  const ms = Math.round(rand(RAINBOW.APPEAR_MS[0], RAINBOW.APPEAR_MS[1]));
  hotAutoTimer = setTimeout(()=>{
    if (!hotLocked && typeof hideHot === 'function') hideHot();
  }, ms);
}

function startFrenzy(){
  setTickModeMp3(true);

  // Igual que antes: activa Frenzy por FRENZY_MS y luego resetea a X1
  combo.frenzyUntil = performance.now() + FRENZY_MS;

  if (typeof arcHide === 'function') arcHide();     // limpia estado previo
  requestAnimationFrame(()=> startFrenzyArc());     // arranca el arco con un frame de respiro

  if (typeof soundFrenzy777 === 'function') soundFrenzy777();
  else if (typeof soundFrenzyStart === 'function') soundFrenzyStart();

  if (typeof tagShow === 'function') tagShow('FRENZY', '#ffd872');
  popBadge('FRENZY');

  updateBadge();
  // 👉 Vibrar ambos FRENZY mientras dura
if (typeof comboBadgeEl !== 'undefined' && comboBadgeEl) comboBadgeEl.classList.add('vibeX');
if (typeof windowTag !== 'undefined' && windowTag) windowTag.classList.add('vibeX');


  setTimeout(()=>{
        if (performance.now() >= combo.frenzyUntil){
          setTickModeMp3(false);
      combo.level = 0;
      combo.progress = {1:0,2:0,3:0,4:0};
      combo.frenzyUntil = 0;
      if (typeof tagHide === 'function') tagHide();
      if (typeof arcHide === 'function') arcHide();
// 👉 Apagar vibración al terminar FRENZY
if (typeof comboBadgeEl !== 'undefined' && comboBadgeEl) comboBadgeEl.classList.remove('vibeX');
if (typeof windowTag !== 'undefined' && windowTag) windowTag.classList.remove('vibeX');


      updateBadge();
    }
  }, FRENZY_MS + 20);
}

function startRainbowChallenge(){

playSnd('rainbow', { volume: 1.0 });
playSnd('tension', { volume: 0.7, loop: true });

  challenge.active = true;
  challenge.completed = false;
  challenge.hits = 0;
  challenge.t0 = performance.now();

  // UI
  tagShow(`DESAFÍO 0/${RAINBOW.HITS}`, '#ffd872');
  startChallengeArc();
  popBadge('RAINBOW CHALLENGE');


 function autoSpawn(){
    if (!challenge.active) return;
    spawnRainbowOrDecoy();
    challenge.spawnTimer = setTimeout(autoSpawn, randInt(1200,1600)); 
  }
  autoSpawn();

  clearTimeout(challenge.timerId); 
  challenge.timerId = setTimeout(()=>{
    if (challenge.active) endRainbowChallenge(false);
  }, RAINBOW.TOTAL_MS);
}

function endRainbowChallenge(success){
  setTickModeMp3(false);

  clearTimeout(challenge.timerId);   // 👈 matar timer

  challenge.completed = true;
  if (comboBadgeEl) comboBadgeEl.classList.remove('rainbowPulse');
  updateBadge();  // 👈 vuelve a FRENZY o Xn según corresponda

  // 🔇 cortar música de tensión (hard stop + refuerzo)
  stopSnd('tension');
  setTimeout(()=> stopSnd('tension'), 50);

  challenge.active = false;
  clearTimeout(challenge.spawnTimer);
  stopChallengeArc();
  tagHide();
  hideHotSafe();

  if (success){
    // ✨ brillo centrado al ganar el desafío
(function(){
  const r = coin.getBoundingClientRect();
  popSparkle(r.left + r.width/2, r.top + r.height/2);
})();
playSnd('freeze', { volume: 1.0 });
    setTimeout(()=> playSnd('slot', { volume: 0.9, loop: true }), 400); // arranca un poco después
    setTimeout(()=> stopSnd('slot'), 5500); // corta a los 5s
startFrenzy(); // pasamos al Frenzy

  } else {
    playSnd('laugh', { volume: 0.9 });
    combo.level = 0;
    combo.progress = {1:0,2:0,3:0,4:0};
    updateBadge();
  }
}
function handleChallengeTap(e){
  if (!challenge.active || challenge.completed) return;

  // Acierto en mancha arcoíris real (rb)
  const wasHit = (hotActive && hotSkin === 'rb' && typeof isInHot === 'function' && isInHot(e));
  // Acierto en DECOY (usa el núcleo real para que sí detecte)
  const hitDecoy = (hotActive && hotSkin === 'decoy' && typeof isInHotCore === 'function' && isInHotCore(e));

  if (wasHit){
     playSnd('tick', { volume: .8 });
    challenge.hits = Math.min(RAINBOW.HITS, challenge.hits + 1);
   
    arcFlash();
    if (typeof popSparkleSilent === 'function') {
    popSparkleSilent(e.clientX, e.clientY);}
    tagShow(`DESAFÍO ${challenge.hits}/${RAINBOW.HITS}`, '#ffd872');


      // 👇 Un tap por mancha: desaparecer al instante
    clearTimeout(hotAutoTimer);
    hotLocked = false;
    hideHotSafe();

    if (challenge.hits >= RAINBOW.HITS){
      challenge.completed = true;
      clearTimeout(challenge.timerId);
      clearTimeout(challenge.spawnTimer);
      hotLocked = false;
      hideHotSafe();
      setTimeout(()=> endRainbowChallenge(true), 80);
    }
    return;
  }

  if (hitDecoy){
   
  if (hotActive) 
    popLaugh(e.clientX, e.clientY);
    playSnd('laugh', { volume: 0.9 });
    soundMiss();
    return;
  }

  // Tap fuera de cualquier cosa → ignorar (NO termina el desafío)
}


// — Spawn por TAP (real o decoy) —
function maybeSpawnByTap(){
  // Se llama al final de CADA click (tenga o no energía)
  combo.tapCounter++;
  if (combo.tapCounter >= combo.nextSpawnAt){
    const lvl = targetLevel();
    const isDecoy = Math.random() < DECOY_CHANCE;
    spawnHotWithTimer(isDecoy ? 'decoy' : ('x'+lvl));
    const R = SPAWN_TAPS[lvl]; // [min,max]
    combo.nextSpawnAt = combo.tapCounter + randInt(R[0], R[1]);
  }
}

// — Sumar RBGp de forma segura si el proyecto no define addTapAmount —
if (typeof addTapAmount !== 'function'){
  window.addTapAmount = function(amount){
    if (!amount) return;
    rbgp += amount;
    localStorage.setItem('rbgp', String(rbgp));
    // si tu render ya se llama al final del click, no hace falta aquí
  };
}


/* ===== Helpers ===== */
const $=q=>document.querySelector(q);

let AC; function tone(f=560,d=.05,t='triangle',v=.08){try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain();o.type=t;o.frequency.value=f;g.gain.value=v;o.connect(g).connect(AC.destination);o.start();g.gain.exponentialRampToValueAtTime(0.0001,AC.currentTime+d);o.stop(AC.currentTime+d+0.02);}catch(e){}}


// === Audio optimizado (WebAudio + fallback) ===
(() => {
  const hasWA = !!(window.AudioContext || window.webkitAudioContext);
  const manifest = {
    nice:'snd/nice.mp3',
    rainbow:'snd/rainbow_race.mp3',
    freeze:'snd/freeze.mp3',
    laugh:'snd/laugh.mp3',
    slot:'snd/slot_loop.mp3',
    tension:'snd/tension_loop.mp3',
    tick:'snd/tick.mp3',
    join:'snd/join.mp3'
  };

  // --- Fallback súper simple si no hay WebAudio (mantiene API) ---
  if (!hasWA) {
    const tag = {};
    for (const k in manifest) {
      const a = new Audio(manifest[k]);
      if (k==='slot' || k==='tension') a.loop = true;
      a.preload = (k==='tick' || k==='nice') ? 'auto' : 'metadata';
      tag[k] = a;
    }
 // Fallback basado en <audio> (sin WebAudio)
window.playSnd = function(name, { volume = 1, loop = false } = {}) {
  // Tick: fuera de Rainbow/Frenzy NO reproducimos mp3 (el beep lo hace tone())
  if (name === 'tick' && !window.__tickUseMp3) {
    return;
  }

  const a = tag[name];
  if (!a) return;

  try {
    a.pause();
    a.currentTime = 0;
    a.loop = !!loop;
    a.volume = volume ?? 1;
    a.play();
  } catch (_) { /* noop */ }
};

    window.stopSnd = function(name){
      const a = tag[name]; if (a){ try{ a.pause(); a.currentTime = 0; }catch(e){} }
    };
    return;
  }

  // --- WebAudio manager ---
  const Ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  const master = Ctx.createGain(); master.gain.value = 1; master.connect(Ctx.destination);
  const buffers = new Map();        // name -> AudioBuffer
  const loops   = new Map();        // name -> {src, gain}
  const lastHit = {};               // throttling (p.ej. 'tick')

  function resumeOnGestureOnce(){
    const resume = () => { Ctx.resume().catch(()=>{}); cleanup(); };
    const cleanup = () => {
      window.removeEventListener('pointerdown', resume, true);
      window.removeEventListener('keydown', resume, true);
      window.removeEventListener('touchstart', resume, true);
    };
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('keydown', resume, true);
    window.addEventListener('touchstart', resume, true);
  }
  resumeOnGestureOnce();

  // Suspender en background para ahorrar batería/CPU
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { Ctx.suspend().catch(()=>{}); }
    else { Ctx.resume().catch(()=>{}); }
  });

  function idle(fn){ ('requestIdleCallback' in window) ? requestIdleCallback(fn, {timeout:1500}) : setTimeout(fn,0); }

  async function loadBuffer(name){
    if (buffers.has(name)) return buffers.get(name);
    const url = manifest[name];
    const resp = await fetch(url);
    const ab   = await resp.arrayBuffer();
    const buf  = await Ctx.decodeAudioData(ab);
    buffers.set(name, buf);
    return buf;
  }

  function playOnce(name, volume=1){
    const nodeGain = Ctx.createGain();
    nodeGain.gain.value = volume;
    nodeGain.connect(master);
    const src = Ctx.createBufferSource();
    src.buffer = buffers.get(name);
    src.connect(nodeGain);
    src.start();
    // liberar al terminar
    src.onended = () => { nodeGain.disconnect(); };
  }

  function playLoop(name, volume=1){
    // si ya está sonando, solo ajusta volumen
    if (loops.has(name)) {
      const obj = loops.get(name);
      obj.gain.gain.setTargetAtTime(volume, Ctx.currentTime, 0.01);
      return;
    }
    const g = Ctx.createGain(); g.gain.value = volume; g.connect(master);
    const src = Ctx.createBufferSource();
    src.buffer = buffers.get(name);
    src.loop = true;
    src.connect(g);
    src.start();
    loops.set(name, { src, gain: g });
  }

  function stopLoop(name){
    const obj = loops.get(name);
    if (!obj) return;
    // fade out corto
    obj.gain.gain.setTargetAtTime(0.0001, Ctx.currentTime, 0.03);
    try { obj.src.stop(Ctx.currentTime + 0.035); } catch(e){}
    setTimeout(() => { obj.gain.disconnect(); }, 60);
    loops.delete(name);
  }

  // Precarga liviana en idle (golpes cortos)
  idle(() => { ['tick','nice','laugh','freeze'].forEach(n => loadBuffer(n).catch(()=>{})); });
 // ===== WebAudio =====
window.playSnd = async function(name, {volume=1, loop=false} = {}){
  // Tick.mp3 solo en Rainbow/Frenzy; afuera no reproducimos el mp3
  if (name === 'tick' && !window.__tickUseMp3) return;

  // throttle para 'tick' (evita spam y jank)
  if (name === 'tick') {
    const now = performance.now();
    if (lastHit.tick && now - lastHit.tick < 45) return;
    lastHit.tick = now;
  }

  try {
    if (!buffers.has(name)) await loadBuffer(name);
    if (loop) playLoop(name, volume);
    else      playOnce(name, volume);
  } catch(e) {
    // Fallback mínimo con WebAudio si falla la carga
    try {
      const o = Ctx.createOscillator(), g = Ctx.createGain();
      o.type = 'triangle'; o.frequency.value = (name==='tick') ? 1400 : 560;
      g.gain.value = 0.08 * volume;
      o.connect(g).connect(master);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, Ctx.currentTime + 0.05);
      o.stop(Ctx.currentTime + 0.07);
    } catch(_){}
  }
};

  window.stopSnd = function(name){ stopLoop(name); };
  // Preload mínimo en idle (móvil)
  ('requestIdleCallback' in window ? requestIdleCallback : cb=>setTimeout(cb,0))(()=>{
    ['nice','laugh','freeze','tick'].forEach(n=>loadBuffer(n).catch(()=>{}));
    });
})();


/* ===== Estado base (demo) ===== */
const BASE_CAP=100, BASE_REGEN_PER_SEC=0.5, POWER_BASE=0.1000;
let wld = +localStorage.getItem('wld') || 0;
let rbgp= +localStorage.getItem('rbgp')|| 0;
let energy=+localStorage.getItem('energy'); if(isNaN(energy)) energy=BASE_CAP;
let lastTs=+localStorage.getItem('last_ts')||Date.now();
// === Hotspot / Combo ===
const HOT_SHOW_MS= 1600;    // tiempo visible del hotspot 1.6s
const HOT_CD_MIN = 2800;    // cooldown mínimo
const HOT_CD_MAX = 4400;    // cooldown máximo

/* ===== Derivados ===== */
function capMax(){return BASE_CAP}
function regenPerSec(){return BASE_REGEN_PER_SEC}
function priceRefill(){return +(capMax()* 0.001).toFixed(2)} // 0.1% capacidad
function lazyRegen(){
  const now = Date.now();

  // ⛔ Pausa regeneración si estás en cooldown (noEnergyUntil)
  if (performance.now() < (noEnergyUntil || 0)){
    // resetea sellos para no “acumular” dt
    lastTs = now;
    localStorage.setItem('last_ts', String(lastTs));
    return;
  }

  const dt = (now - lastTs) / 1000;
  lastTs = now;
  energy = Math.min(capMax(), energy + regenPerSec() * dt);
  localStorage.setItem('last_ts', String(lastTs));
  localStorage.setItem('energy', String(energy));
}


/* ===== Refs ===== */
const balWLD=$('#balWLD'), balRBGp=$('#balRBGp');
const coin=$('#coin'), gain=$('#gain');
// Hotspot + Combo (refs)
const hot = document.getElementById('hot');
const comboBadge = document.getElementById('comboBadge');
const hotCore = document.getElementById('hotCore');


// === Hotspot: helpers y ciclo ===
function rand(min, max){ return Math.random()*(max-min)+min; }
// Centro y tamaño de la mancha (en % relativo a la moneda)
let hotCX = 50, hotCY = 50; // centro (%)
let hotCoreR = 10;          // radio del NÚCLEO (hit real) en %
let hotGlowR = 20;          // radio del HALO (solo visual) en %

// Dibuja el sector dorado radial
function drawHot(){
  if (!hot) return;
  const s = HOT_SKIN[hotSkin] || HOT_SKIN.x1;

// HALO (visual) compacto SIN ondas
const r  = hotGlowR;              // radio halo en %
const cx = hotCX, cy = hotCY;
const c1 = s.c1,  c2 = s.c2;

// Gradiente principal: brillo al centro → color → borde → transparente
const main = `radial-gradient(circle at ${cx}% ${cy}%,
  rgba(255,255,255,.88) 0%,
  ${c1} 10%,
  ${c1} ${Math.round(r*0.35)}%,
  ${c2} ${Math.round(r*0.55)}%,
  transparent ${r}%
)`;

hot.style.background = main;

// Nada de máscara ni ondas
hot.style.webkitMaskImage = 'none';
hot.style.maskImage = 'none';

// Difuminado leve y sin blend que infla
hot.style.filter = 'blur(0.8px)';     // más compacto que 1.2px
hot.style.mixBlendMode = 'normal';


 // 🔴 Núcleo real para capturar taps de la ventana (usa % del tamaño de la moneda)
if (hotCore){
  hotCore.style.left = hotCX + '%';
  hotCore.style.top  = hotCY + '%';
  hotCore.style.width  = (hotCoreR * 2) + '%';
  hotCore.style.height = (hotCoreR * 2) + '%';
  hotCore.style.transform = 'translate(-50%,-50%)';
  hotCore.style.borderRadius = '50%';

  // invisible pero presente (el rect se usa en createWindow/isInWindowRect)
  hotCore.style.opacity = '0';
  hotCore.style.background = 'transparent';
  hotCore.style.boxShadow = 'none';
  hotCore.style.pointerEvents = 'none';
}

}



function showHot(skin = null){
  if (!hot) return;

  // Skin aleatoria para que veas colores (luego la ligamos a X1..X5)
  if (!skin){
    const pool = ['x1','x2','x3','x4','x5','decoy'];
    hotSkin = pool[Math.floor(Math.random()*pool.length)];
  } else {
    hotSkin = skin;
  }

  // Toma tamaños según skin
  const s = HOT_SKIN[hotSkin] || HOT_SKIN.x1;
  hotCoreR = s.coreR;
  hotGlowR = s.glowR;

  // Posición aleatoria con margen
  hotCX = Math.random()*70 + 15; // 15..85
  hotCY = Math.random()*70 + 15; // 15..85

  drawHot();
  hotActive = true;
  hot.style.opacity = '1';
// Solo auto-ocultar en el modo "por tiempo". En modo TAP lo maneja spawnHotWithTimer()
  if (!USE_TAP_SPAWN){
  setTimeout(()=>{
    if (hotLocked) return;
    if (typeof hideHot === 'function') hideHot();
    scheduleHot();
  }, HOT_SHOW_MS);
}
}
// Helper para ocultar la mancha (usado por timeouts y al cerrar ventana)
function hideHot(){
  if (!hot) return;
  hotActive = false;
  hot.style.opacity = '0';
  if (hotCore) hotCore.style.opacity = '0';
}


// Apariencia por tipo: X1..X5 y decoy (JAJA)
const HOT_SKIN = {
  x1:{ c1:'#FFD872', c2:'#8a6b1f', coreR:10, glowR:18 },
  x2:{ c1:'#9CFF70', c2:'#3f8f33', coreR: 9, glowR:16 },
  x3:{ c1:'#6AE1FF', c2:'#2b93b8', coreR: 8, glowR:14 },
  x4:{ c1:'#D08BFF', c2:'#7d3ca3', coreR: 7, glowR:12 },
  x5:{ c1:'#FF6A6A', c2:'#a83232', coreR: 6, glowR:10 },
  decoy:{ c1:'#A0A6FF', c2:'#4b4fa0', coreR: 9, glowR:14 },
  rb:{ c1:'#7aa0ff', c2:'#aa66ff', coreR: 9, glowR:16 }
};
// Colores del aro por nivel (mismos tonos que las manchas)
const ARC_SKIN = {
  1: { c1:'#FFD872', c2:'#8a6b1f' },
  2: { c1:'#9CFF70', c2:'#3f8f33' },
  3: { c1:'#6AE1FF', c2:'#2b93b8' },
  4: { c1:'#D08BFF', c2:'#7d3ca3' },
  5: { c1:'#FF6A6A', c2:'#a83232' }
};
function setHaloArcColors(level){
  const g = document.querySelector('#windowArc #haloArc');
  if (!g) return;
  const stops = g.querySelectorAll('stop');
  const skin = ARC_SKIN[level] || ARC_SKIN[1];
  stops[1].setAttribute('stop-color', skin.c1);
  stops[2].setAttribute('stop-color', skin.c2);
}
let hotSkin = 'x1'; // skin actual



// Programa la siguiente aparición
function scheduleHot(){
  const cd = Math.round(rand(HOT_CD_MIN, HOT_CD_MAX));
  setTimeout(()=>{ showHot(); }, cd);
}

// ¿El tap cayó dentro del NÚCLEO? (el halo NO cuenta)
function isInHot(event){
  if (hotSkin === 'decoy') return false; // “JAJA” nunca cuenta
  const r = coin.getBoundingClientRect();
  const x = ((event.clientX - r.left) / r.width ) * 100;
  const y = ((event.clientY - r.top )  / r.height) * 100;
  const dx = x - hotCX, dy = y - hotCY;
  return Math.hypot(dx, dy) <= hotCoreR;
}
function isInHotCore(e){
  const coinRect = coin.getBoundingClientRect();
  const x = (e.clientX - coinRect.left) / coinRect.width;
  const y = (e.clientY - coinRect.top ) / coinRect.height;
  const r = hotCore ? hotCore.getBoundingClientRect() : null;
  if (!r) return false;
  const core = {
    x: (r.left - coinRect.left) / coinRect.width,
    y: (r.top  - coinRect.top ) / coinRect.height,
    w:  r.width  / coinRect.width,
    h:  r.height / coinRect.height
  };
  return (x >= core.x && x <= core.x + core.w && y >= core.y && y <= core.y + core.h);
}




// Estado hotspot/combo
let hotActive = false;

const fx=$('#fx'), ctx=fx.getContext('2d');
const energyFill=$('#energyFill'), energyNow=$('#energyNow'), energyMax=$('#energyMax');
const refillBtn=$('#refillBtn'), refillPrice=$('#refillPrice');
const openUp=$('#openUp'), drawerUP=$('#drawerUP'), backdropUP=$('#backdropUP');
const inboxBtn=$('#inboxBtn'), drawerIN=$('#drawerIN'), backdropIN=$('#backdropIN'), inboxBadge=$('#inboxBadge');
const profileBtn=$('#profileBtn'), drawerPF=$('#drawerPF'), backdropPF=$('#backdropPF');
// === Ideas: refs y lógica ===
const ideasBtn         = document.querySelector('#ideasBtn');
const drawerID         = document.querySelector('#drawerID');
const backdropID       = document.querySelector('#backdropID');
const payIdeasBtn      = document.querySelector('#payIdeasBtn');
const ideasPayView     = document.querySelector('#ideasPayView');
const ideasOptionsView = document.querySelector('#ideasOptionsView');
const voteBtn          = document.querySelector('#voteBtn');
const suggestBtn       = document.querySelector('#suggestBtn');
let ideasTicketActive = false;
// === Encuesta: refs y estado ===
const ideasPollView = document.getElementById('ideasPollView');
const pollOptA = document.getElementById('pollOptA');
const pollOptB = document.getElementById('pollOptB');
const pollOptC = document.getElementById('pollOptC');
const pollResults = document.getElementById('pollResults');
const barA = document.getElementById('barA');
const barB = document.getElementById('barB');
const barC = document.getElementById('barC');
const pctA = document.getElementById('pctA');
const pctB = document.getElementById('pctB');
const pctC = document.getElementById('pctC');
const pollClose = document.getElementById('pollClose');

// Estado local (solo demo)
let votes = JSON.parse(localStorage.getItem('wg_votes') || '{"A":0,"B":0,"C":0}');
function saveVotes(){ localStorage.setItem('wg_votes', JSON.stringify(votes)); }

function renderPoll(){
  const total = votes.A + votes.B + votes.C;
  const pA = total ? Math.round((votes.A/total)*100) : 0;
  const pB = total ? Math.round((votes.B/total)*100) : 0;
  const pC = total ? Math.round((votes.C/total)*100) : 0;
  barA.style.width = pA + '%'; pctA.textContent = pA + '%';
  barB.style.width = pB + '%'; pctB.textContent = pB + '%';
  barC.style.width = pC + '%'; pctC.textContent = pC + '%';
}

function showPoll(){
  ideasOptionsView.style.display = 'none';
  ideasPollView.style.display = 'block';
  pollResults.style.display = 'block'; // muestra resultados siempre
  renderPoll();
}

function consumeTicketAndReset(){
  // consumir acceso: volver a pagar
  ideasTicketActive = false; 
  clearInterval(ticketTimerId);
  document.getElementById('ticketTimer')?.style && (document.getElementById('ticketTimer').textContent='⛔ Ticket vencido');
  ideasPollView.style.display = 'none';
  ideasSuggestView.style.display = 'none';
  ideasOptionsView.style.display = 'none';
  ideasPayView.style.display = 'block';
}
/* === Feed público: lista vertical con cola === */
const activityBar = document.getElementById('activityBar');
const noticeQueue = [];
let noticeRunning = false;

// igualar ancho del aviso al ancho real de la píldora (responsive)
(function syncActivityWidth(){
  const pill = document.querySelector('.pill');
  function apply(){
    if (!pill) return;
    const w = Math.round(pill.getBoundingClientRect().width);
    document.documentElement.style.setProperty('--activityWidth', w + 'px');
  }
  apply();
  window.addEventListener('resize', apply);
  setTimeout(apply, 0);
})();

function postActivity(html){
  if (!activityBar) return;
  noticeQueue.push(html);
  if (!noticeRunning) runNextNotice();
}

function runNextNotice(){
  const html = noticeQueue.shift();
  if (!html){ noticeRunning = false; return; }
  noticeRunning = true;

  // un solo item visible a la vez
  activityBar.innerHTML = '';

  const el = document.createElement('div');
  el.className = 'activity-item';
  el.innerHTML = html;
  activityBar.appendChild(el);

  // arrancar la animación (entra desde abajo → vibra → sube y sale)
  requestAnimationFrame(() => el.classList.add('run'));

  el.addEventListener('animationend', () => {
    el.remove();
    runNextNotice();          // mostrar el siguiente de la cola
  }, { once: true });
}

function handleVote(key){

  // bloquear doble clic
  [pollOptA,pollOptB,pollOptC].forEach(b=> b && (b.disabled = true));
  // % antes
  const totalBefore = votes.A + votes.B + votes.C;
  const beforePct = totalBefore ? Math.round(((votes[key]||0) / totalBefore) * 100) : 0;

  // sumar voto
  votes[key] = (votes[key] || 0) + 1;
  saveVotes();

  // % después
  const totalAfter = votes.A + votes.B + votes.C;
  const afterPct = totalAfter ? Math.round(((votes[key]||0) / totalAfter) * 100) : 0;
  const delta = afterPct - beforePct;

  renderPoll();

  // nombre y etiqueta opción
  const user = (typeof getUsername === 'function') ? getUsername() : 'Usuario';
  const optName = ({A:'🔴',B:'🔵',C:'🤖'})[key] || key;

  // mensaje público
  const deltaTxt = (delta === 0) ? '±0%' : (delta>0 ? `+${delta}%` : `${delta}%`);
  const cur = getLang(); const T = I18N[cur] || I18N.es;
const msgVote = (cur === 'en')
  ? `${user} voted <b>${optName}</b> (${deltaTxt}) → <b>${afterPct}%</b>`
  : `<b>${user}</b> votó ${optName} (${deltaTxt}) → <b>${afterPct}%</b>`;
postActivity(msgVote);
alert(T.vote_recorded || '✅ Voto registrado');

    consumeTicketAndReset();
    closeDrawer('ID');
document.querySelector('.hero')?.scrollIntoView({behavior:'smooth'});

}


if (voteBtn){
  voteBtn.onclick = () => {
    if (!ideasTicketActive) { const cur = getLang(); const T = I18N[cur] || I18N.es;
alert(T.need_active_ticket || 'Necesitas un ticket activo');
 return; }
    showPoll();
  };
}
if (pollOptA) pollOptA.onclick = () => handleVote('A');
if (pollOptB) pollOptB.onclick = () => handleVote('B');
if (pollOptC) pollOptC.onclick = () => handleVote('C');
if (pollClose) pollClose.onclick = () => { ideasPollView.style.display='none'; ideasOptionsView.style.display='block'; };

// === Sugerencias: refs y lógica ===
const ideasSuggestView = document.getElementById('ideasSuggestView');
const suggestBtnEl = document.getElementById('suggestBtn');  // ya existe arriba como suggestBtn
const suggestText = document.getElementById('suggestText');
const sendSuggestBtn = document.getElementById('sendSuggestBtn');
const sugClose = document.getElementById('sugClose');
const sugCount = document.getElementById('sugCount');

function showSuggest(){
  ideasOptionsView.style.display = 'none';
  ideasSuggestView.style.display = 'block';
  if (suggestText) { suggestText.value=''; sugCount.textContent='0'; suggestText.focus(); }
}

function safeText(s){
  // bloqueo básico de HTML: reemplaza < y >
  return String(s || '').replaceAll('<','&lt;').replaceAll('>','&gt;').trim();
}

if (suggestBtn){
  suggestBtn.onclick = () => {
    if (!ideasTicketActive) { const cur = getLang(); const T = I18N[cur] || I18N.es;
alert(T.need_active_ticket || 'Necesitas un ticket activo');
 return; }
    showSuggest();
  };
}

if (suggestText){
  suggestText.addEventListener('input', () => {
    const n = (suggestText.value || '').length;
    sugCount.textContent = String(n);
  });
}

if (sendSuggestBtn){
  sendSuggestBtn.onclick = () => {
    const txt = safeText(suggestText.value);
    if (!txt || txt.length < 4){
      alert('Escribe al menos 4 caracteres.');
      return;
    }
    // Guarda privado en localStorage (solo tú lo ves)
    const box = JSON.parse(localStorage.getItem('wg_suggestions') || '[]');
    box.unshift({ txt, ts: Date.now() });
    localStorage.setItem('wg_suggestions', JSON.stringify(box));

    {
  const cur = getLang(); const T = I18N[cur] || I18N.es;
  alert(T.sug_sent_private || '✅ Sugerencia enviada (privada)');
  const u = (typeof getUsername==='function'?getUsername():'Usuario');
  const msgSug = (cur === 'en') ? `${u} sent a suggestion!` : `<b>${u}</b> envió una sugerencia`;
  postActivity(msgSug);
}

    consumeTicketAndReset();
    closeDrawer('ID');
document.querySelector('.hero')?.scrollIntoView({behavior:'smooth'});

  };
}

if (sugClose){
  sugClose.onclick = () => {
    ideasSuggestView.style.display = 'none';
    ideasOptionsView.style.display = 'block';
  };
}


// ==== Temporizador del ticket ====
let ticketTimerId = null;
let ticketExpiresAt = 0;

function startTicketTimer(minutes=5){
  ticketExpiresAt = Date.now() + minutes*60*1000;
  updateTicketTimer();
  ticketTimerId = setInterval(updateTicketTimer, 1000);
}

function updateTicketTimer(){
  const el = document.getElementById('ticketTimer');
  if (!el) return;
  const remaining = ticketExpiresAt - Date.now();
  const cur = getLang();
  const T = I18N[cur] || I18N.es;

  if (remaining <= 0){
    clearInterval(ticketTimerId);
    el.textContent = T.ticket_expired || "⛔ Ticket vencido";
    ideasPayView.style.display = 'block';
    ideasOptionsView.style.display = 'none';
    return;
  }

  const m = Math.floor(remaining/60000);
  const s = Math.floor((remaining%60000)/1000);
  el.textContent = `${T.ticket_time_left || 'Tiempo restante:'} ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function saveMsgs(){
  localStorage.setItem('msgs', JSON.stringify(msgs));
  localStorage.setItem('unread', String(unread));
}

function renderInbox(){
  const box = document.getElementById('inboxList');
  if (!box) return;

  const cur = getLang();
  const locale = (cur === 'en') ? 'en-US' : 'es-PE';
  const T = I18N[cur] || I18N.es;

  if (msgs.length === 0){
    // "Sin mensajes" también se traduce:
    box.innerHTML = '';
    const p = document.createElement('p');
    p.style.opacity = '.7';
    p.textContent = (cur === 'en') ? 'No messages.' : 'Sin mensajes.';
    box.appendChild(p);
  } else {
    box.innerHTML = '';
    msgs.forEach(m => {
      const wrap = document.createElement('div');
      wrap.className = 'msg' + (m.type === 'system' ? ' msg-system' : '');

      const time = document.createElement('div');
      time.className = 'msg-time';
      time.textContent = new Date(m.ts).toLocaleString(locale);

      const txt = document.createElement('div');
      txt.className = 'msg-text';

      // Si el mensaje tiene "key", se traduce; si no, usa el texto literal
      if (m.key && T[m.key] != null){
        txt.textContent = T[m.key];
      } else {
        txt.textContent = String(m.text || '');
      }

      wrap.appendChild(time);
      wrap.appendChild(txt);
      box.appendChild(wrap);
    });
  }

  if (unread > 0){
    inboxBadge.style.display = 'grid';
    inboxBadge.textContent = unread;
  } else {
    inboxBadge.style.display = 'none';
  }
}

// Mensaje con TEXTO literal (no se traduce al cambiar idioma)
function addMessage(text, type='announce'){
  const allowed = new Set(['system','announce','reward']);
  if (!allowed.has(type)) return;
  msgs.unshift({ text: String(text || ''), ts: Date.now(), type });
  unread++;
  saveMsgs();
  renderInbox();
}

// Mensaje por CLAVE del diccionario (sí se traduce al cambiar idioma)
function addMessageKey(key, type='announce'){
  const allowed = new Set(['system','announce','reward']);
  if (!allowed.has(type)) return;
  msgs.unshift({ key: String(key || ''), ts: Date.now(), type });
  unread++;
  saveMsgs();
  renderInbox();
}

// Abrir Inbox = mostrar y limpiar contador
if (inboxBtn) inboxBtn.onclick = () => {
  openDrawer('IN');
  unread = 0;
  saveMsgs();
  renderInbox();
};

/* ===== Canvas del tamaño de la moneda ===== */
function sizeCanvasToCoin(){
  const r = coin.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 1.75);

  fx.width  = Math.round(r.width * scale);
  fx.height = Math.round(r.height * scale);
  fx.style.width  = r.width + 'px';
  fx.style.height = r.height + 'px';
}
addEventListener('resize', sizeCanvasToCoin);

/* ===== Partículas con fallback ===== */
let sparkle = null;
let parts=[];
function spawn(x,y){
  for(let i=0;i<10;i++){
    const a  = Math.random()*Math.PI*2;
    const sp = 1.3 + Math.random()*2.0;
    const s  = 14 + Math.random()*8;
    parts.push({
      x, y,
      vx: Math.cos(a)*sp,
      vy: Math.sin(a)*sp,
      life: 520 + Math.random()*320,
      size: s,
      alpha: 1
    });
  }
}


function stepFX(dt){
  ctx.clearRect(0,0,fx.width,fx.height);
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i]; p.life-=dt; if(p.life<=0){parts.splice(i,1); continue;}
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.02; p.alpha=Math.max(0,p.life/700);
    ctx.globalAlpha=p.alpha;
    if(sparkle.complete){
      ctx.drawImage(sparkle, p.x-p.size/2, p.y-p.size/2, p.size, p.size);
    }else{
      ctx.beginPath(); ctx.fillStyle='rgba(255,255,255,.9)';
      ctx.arc(p.x,p.y, Math.max(2, p.size*0.15), 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.globalAlpha=1;
}

/* ===== UI render ===== */
function render(){
  balWLD.textContent=wld.toFixed(2); balRBGp.textContent=rbgp.toFixed(3);
  const eMax=capMax(), pct=Math.max(0,Math.min(100,(energy/eMax)*100));
  energyFill.style.width=pct.toFixed(1)+'%'; energyNow.textContent=Math.floor(energy); energyMax.textContent=eMax;

  const cost=priceRefill(); refillPrice.textContent=cost.toFixed(2)+' WLD';
  const low = pct<25, canPay = wld>=cost && energy<eMax-1e-6;
  refillBtn.classList.toggle('pulse', low && canPay);
  refillBtn.disabled = energy>=eMax-1e-6;
    if (typeof renderProfile === 'function') renderProfile(); // 👈 mantiene el perfil sincronizado
}


/* ===== Tap logic ===== */
function addTap(){ if(energy<1) return false; energy-=1; rbgp+=POWER_BASE; 
  localStorage.setItem('energy',String(energy)); 
  localStorage.setItem('rbgp',String(rbgp)); return true; }

// Anti-autotap: rate limit
let lastTapTime = 0;
let tapCount = 0;

coin.addEventListener('click', (e) => {
  if (typeof lazyRegen === 'function') lazyRegen();

  const now = performance.now();
  const cx = e.clientX, 
  cy = e.clientY; // coords de pantalla (no se recorta)

    // 🔒 Durante el DESAFÍO: no gastas energía, no ganas RBGp, solo cuenta el reto
  if (challenge.active) {
    handleChallengeTap(e);
    // no mostramos +ganancia y no tocamos energía
    render?.();
    updateRefillCue?.();
    return;
  }
    // Si hay un DISTRACTOR y lo tocaste en el núcleo → burla (modo normal)
  if (hotActive && hotSkin === 'decoy' && isInHotCore(e)) {
    popLaugh(cx, cy);
    soundMiss();
  }



  // Si estamos en cooldown por 0 energía → siempre 0.0000
  if (now < (noEnergyUntil || 0)) {
    spawnGain?.(cx, cy, `+${fmt(0)}`);
    maybeSpawnByTap?.(); render?.(); 
    updateRefillCue();
    return;
   
  }

  // FRENZY: NO gasta energía; sumamos base y luego +5% en applyComboTap
  if (now < combo.frenzyUntil) {
    spawnGain?.(cx, cy, `+${fmt(POWER_BASE)}`);
    addTapAmount(POWER_BASE);    // base sin tocar energía
    applyComboTap(e);            // aquí añade el +5% y actualiza el numerito
    maybeSpawnByTap?.(); render?.();
    updateRefillCue();
     return;
  }

  // Modo normal: intentar gastar energía usando addTap()
  const ok = (typeof addTap === 'function') ? addTap() : true;

  if (!ok) {
    // No alcanzó (0.. <1) → marcar 0.0000 y activar cooldown de 2s
    noEnergyUntil = now + 3000;
    spawnGain?.(cx, cy, `+${fmt(0)}`);
    maybeSpawnByTap?.(); render?.();
    updateRefillCue();
    
    try { navigator.vibrate && navigator.vibrate([80,40,80]); } catch(e){}
     return;
  }

  // Había energía suficiente → base + posible bonus (ventana)
  spawnGain?.(cx, cy, `+${fmt(POWER_BASE)}`);
  applyComboTap(e);

  maybeSpawnByTap?.();
  render?.();
  updateRefillCue();
}
);


/* ===== Refill ===== */
function doRefill(){
  const cost=priceRefill(), eMax=capMax();
  if(energy>=eMax-1e-6) return;
  if(wld<cost){refillBtn.classList.add('shake'); setTimeout(()=>refillBtn.classList.remove('shake'),260); return;}
  wld-=cost; energy=eMax; localStorage.setItem('wld',String(wld)); localStorage.setItem('energy',String(energy));
  tone(620,0.08,'sine',.08); render();
}
refillBtn.onclick=doRefill;


/* ===== Boosters drawer (placeholder) ===== */
openUp.onclick=()=>openDrawer('UP');

function openDrawer(which){
  const map = {
    UP: [drawerUP, backdropUP],
    IN: [drawerIN, backdropIN],
    PF: [drawerPF, backdropPF],
    ID: [drawerID, backdropID],   
  };
  const pair = map[which];
  if (!pair) return;
  const [dr, bd] = pair;
  dr.classList.add('show');
  bd.classList.add('show');
}
function closeDrawer(which){
  const map = {
    UP: [drawerUP, backdropUP],
    IN: [drawerIN, backdropIN],
    PF: [drawerPF, backdropPF],
    ID: [drawerID, backdropID],  
  };
  const pair = map[which];
  if (!pair) return;
  const [dr, bd] = pair;
  dr.classList.remove('show');
  bd.classList.remove('show');
}
// 1) Clic en cualquier backdrop: cierra su drawer correspondiente
document.addEventListener('click', (ev) => {
  const el = ev.target;
  if (!el.classList || !el.classList.contains('backdrop')) return;
  // ids: backdropUP / backdropIN / backdropPF / backdropID
  const code = el.id.replace('backdrop',''); // "UP" | "IN" | "PF" | "ID"
  closeDrawer(code);
});

// 2) Clic en la "x" de cualquier drawer
document.querySelectorAll('.drawer .close').forEach(btn => {
  btn.addEventListener('click', () => {
    const aside = btn.closest('.drawer');
    if (!aside || !aside.id) return;
    const code = aside.id.replace('drawer',''); // "UP" | "IN" | "PF" | "ID"
    closeDrawer(code);
  });
});

// 3) Tecla ESC: cierra todos los drawers abiertos
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  ['UP','IN','PF','ID'].forEach(code => closeDrawer(code));
});

/* === Clicks de Perfil e Inbox (no volver a declarar profileBtn/inboxBtn) === */
if (profileBtn) profileBtn.onclick = () => openDrawer('PF');
if (ideasBtn) {
  ideasBtn.onclick = () => {
    openDrawer('ID');

    // vistas: pago / opciones / encuesta / sugerencia
    const pay  = document.getElementById('ideasPayView');
    const opts = document.getElementById('ideasOptionsView');
    const poll = document.getElementById('ideasPollView');
    const sugg = document.getElementById('ideasSuggestView');

    // si no hay ticket activo, muestra "Comprar"; si hay, muestra "Opciones"
    if (window.ideasTicketActive) {
      if (pay)  pay.style.display  = 'none';
      if (opts) opts.style.display = 'block';
    } else {
      if (pay)  pay.style.display  = 'block';
      if (opts) opts.style.display = 'none';
    }

    if (poll) poll.style.display = 'none';
    if (sugg) sugg.style.display = 'none';};}

/* ===== OPF: Orquestador Presupuestado de Frames (≤8ms) + integración ===== */
const BUDGET_MS = 8;
const OPF_Q = { now: [], next: [], idle: [] };
let OPF_over = 0;

function opfNow(fn){ OPF_Q.now.push(fn); }
function opfNext(fn){ OPF_Q.next.push(fn); }
function opfIdle(fn){ OPF_Q.idle.push(fn); }

function __opfTick(){
  const start = performance.now();
  let i = 0;
  for (; i < OPF_Q.now.length; i++){
    try { OPF_Q.now[i](); } catch(e){}
    if (performance.now() - start > BUDGET_MS){
      OPF_Q.next = OPF_Q.now.slice(i+1).concat(OPF_Q.next);
      OPF_over++;
      break;
    }
  }
  OPF_Q.now = OPF_Q.next;
  OPF_Q.next = [];
  if (OPF_Q.idle.length){
    const runIdle = () => {
      const t0 = performance.now();
      const B = 12;
      while (OPF_Q.idle.length && (performance.now() - t0) < B){
        try { OPF_Q.idle.shift()(); } catch(e){}
      }
    };
    if ('requestIdleCallback' in window) requestIdleCallback(runIdle, { timeout: 60 });
    else setTimeout(runIdle, 0);
  }
  if (OPF_over > 3){ document.body.dataset.lowpower = '1'; OPF_over = 0; }
  requestAnimationFrame(__opfTick);
}
requestAnimationFrame(__opfTick);

/* ===== Integración: FX por frame y Regen/UI temporizados ===== */
let __tPrev = performance.now();
function __fxStepTask(){
  const t = performance.now();
  const dt = t - __tPrev; __tPrev = t;
  if (typeof stepFX === 'function') stepFX(dt);
}

(function __enqueueFX(){
  opfNow(__fxStepTask);
  requestAnimationFrame(__enqueueFX);
})();

const REGEN_UI_MS = 500;
let __nextRU = performance.now();
(function __scheduleRU(){
  const now = performance.now();
  if (now >= __nextRU){
    __nextRU = now + REGEN_UI_MS;
    opfNow(() => { try{ lazyRegen(); }catch(_){} try{ render(); }catch(_){} });
  }
  requestAnimationFrame(__scheduleRU);
})();


/* ===== Perfil: nombre de usuario + idioma ===== */
/* Helpers sin TDZ */
function getLang(){ return localStorage.getItem('lang') || 'es'; }
function setLang(v){ localStorage.setItem('lang', v === 'en' ? 'en' : 'es'); }

var username = localStorage.getItem('username') || 'Player'; // por compatibilidad con otros trozos
function getUsername(){ return localStorage.getItem('username') || 'Player'; }
function setUsername(v){
  const s = (v || '').slice(0,20);
  localStorage.setItem('username', s);
  username = s;
  return s;
}

/* Diccionario i18n (UNA sola vez) */
const I18N = {
  es: {
    wld_balance:   'Saldo WLD:',
    coming_soon:   'Próximamente',
    inbox_title:   'Buzón',
    boosters_title:'Impulsores',
    profile_title: 'Perfil',
    claim_soon:    'Reclamar (Pronto)',

    // 👇 NUEVO: Perfil
    username_label:        'Nombre de usuario',
    username_placeholder:  'Tu nombre',
    language_label:        'Idioma',
    option_es:             'Español',
    option_en:             'Inglés',
    profile_rbgp_label:    'RBGp:',
    profile_rbg_label:     'RBG Balance:',
    profile_wld_label:     'WLD Balance:',

      // 👇 Seeds del Inbox (si usas addMessageKey)
    seed_stay_tuned:  'Novedades MUY pronto. Mantente atento. 💌',
    seed_get_wallet:  'Prepara tu billetera para ganar a lo GRANDE . 💸',
    seed_farming_time:'¡Hora de farmear $RBG! Alístate para la sorpresa y toma la delantera. 🎮',
  // --- Ideas / Boosters / Varios ---
    ideas_title: 'Ideas',
    ideas_pay_intro: '¡Sé parte de los desarrolladores y carrera con la comunidad PARTICIPA!',
    ideas_pay_btn: 'Comprar ticket',
    ideas_choose: 'Escoge una opción',
    ticket_time_left: 'Tiempo restante:',
    vote: 'Votar✍️',
    suggest: 'Sugerencia💡',
    each_action_consumes: '*Cada acción consume 1 ticket',
    poll_title: '🏁 ¡EMPIEZA LA CARRERA!',
    poll_hint: 'TÚ ELIGES💊',
    opt_a: 'Comodidad/Seguridad🔵',
    opt_b: 'Cambio/Riesgo🔴',
    opt_c: 'Autotap 🤖',
    poll_close: 'Cerrar',
    suggest_title: '¿Alguna idea?',
    suggest_hint: 'Máx. 400 caracteres.',
    placeholder_suggest: 'Escribe tu idea o mejora aquí…',
    send: 'Enviar',
    close: 'Cerrar',
    signin_wld: 'Entrar con World ID',
    need_active_ticket: 'Necesitas un ticket activo',
    vote_recorded: '✅ Voto registrado',
    sug_sent_private: '✅ Sugerencia enviada' ,
    ticket_expired: '⛔ Ticket vencido',
    preparing_session: 'Preparando tu sesión',

  
  },

en: {
    wld_balance:   'WLD Balance:',
    coming_soon:   'Coming Soon',
    inbox_title:   'Inbox',
    boosters_title:'Boosters',
    profile_title: 'Profile',
    claim_soon:    'Claim (Soon)',

    // 👇 NEW: Profile
    username_label:        'Username',
    username_placeholder:  'Your name',
    language_label:        'Language',
    option_es:             'Spanish',
    option_en:             'English',
    profile_rbgp_label:    'RBGp:',
    profile_rbg_label:     'RBG Balance:',
    profile_wld_label:     'WLD Balance:',

    // 👇 Inbox seeds
    seed_stay_tuned:  'Stay tuned — big updates soon. 💌',
    seed_get_wallet:  'Get your wallet ready to earn BIG. 💸',
    seed_farming_time:'Farming time for $RBG ! Get ready for surprise and take the lead. 🎮',
    // --- Ideas / Boosters / Misc ---
    ideas_title: 'Ideas',
    ideas_pay_intro: 'Be part of the devs and race with the community. PARTICIPATE!',
    ideas_pay_btn: 'Buy ticket',
    ideas_choose: 'Choose an option',
    ticket_time_left: 'Time left:',
    vote: 'Vote✍️',
    suggest: 'Suggestion💡',
    each_action_consumes: '*Each action consumes 1 ticket',
    poll_title: '🏁 START THE RACE!',
    poll_hint: 'YOU CHOOSE💊',
    opt_a: 'Comfort/Security🔵',
    opt_b: 'Change/Risk🔴',
    opt_c: 'Autotap 🤖',
    poll_close: 'Close',
    suggest_title: 'Any idea?',
    suggest_hint: 'Max. 400 characters.',
    placeholder_suggest: 'Type your idea or improvement…',
    send: 'Send',
    close: 'Close',
    signin_wld: 'Sign in with World ID',
    need_active_ticket: 'You need an active ticket',
    vote_recorded: '✅ Vote recorded',
    sug_sent_private: '✅ Suggestion sent (private)',
    ticket_expired: '⛔ Ticket expired',
    ticket_bought_dev: '✅ Ticket purchased ',
    preparing_session: 'Preparing your session',

  
  
  
  }
  
};

/* Aplica i18n a todos los [data-i18n] y placeholders */
function applyLang(){
  const cur = getLang();
  const T = I18N[cur] || I18N.es;

  // 1) Textos
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.getAttribute('data-i18n');
    if (T[key] != null) el.textContent = T[key];
  });

  // 2) Placeholders (inputs/textarea)
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
    const key = el.getAttribute('data-i18n-placeholder');
    if (T[key] != null) el.setAttribute('placeholder', T[key]);
  });

  document.documentElement.lang = cur;

  // Redibuja partes dependientes de idioma
  renderInbox();                         // Inbox por clave
}



/* Carga campos del Perfil + botón Guardar */
function loadProfileFields(){
  const usernameInput = document.getElementById('usernameInput');
  const langSelect    = document.getElementById('langSelect');

  // Nombre de usuario
  if (usernameInput){
    usernameInput.value = getUsername();

    const markDirty = ()=>{
      const dirty = usernameInput.value !== getUsername();
    };
    usernameInput.addEventListener('input', markDirty);
    usernameInput.addEventListener('focus', markDirty);
  }

  // Idioma
  if (langSelect){
    langSelect.value = getLang();
    langSelect.onchange = (e)=>{
      setLang(e.target.value);
      applyLang();
    };
  }

  // Primera aplicación
  applyLang();
}

/* Muestra balances dentro del Perfil */
function renderProfile(){
  const pWLD  = document.getElementById('profWLD');
  const pRBGp = document.getElementById('profRBGp');
  const pRBG  = document.getElementById('profRBG');
  
  if (pWLD)  pWLD.textContent  = wld.toFixed(2);
  if (pRBGp) pRBGp.textContent = rbgp.toFixed(3);
  
  // Mostrar dirección de wallet si hay sesión
  if (pRBG && wldUser?.address) {
    const short = wldUser.address.slice(0,6) + '...' + wldUser.address.slice(-4);
    pRBG.textContent = short;
  }
  
  // Mostrar username en el input
  const usernameInput = document.getElementById('usernameInput');
  if (usernameInput && wldUser?.username) {
    usernameInput.value = wldUser.username;
    usernameInput.disabled = true; // No editable si viene de World ID
  }
}

/* ===== Init ===== */
(function init(){
  
  sizeCanvasToCoin();
  // Partículas de arranque para confirmar que se ven
  setTimeout(()=>{ spawn(fx.width/2, fx.height/2); }, 250);

  render();               // primer pintado
  loadProfileFields();    // engancha Perfil (username/idioma)
  if (typeof renderProfile === 'function') renderProfile(); // sincroniza WLD/RBGp en Perfil
  // Mensajes iniciales con CLAVE (se traducen)
if (msgs.length === 0) {
  addMessageKey('seed_stay_tuned', 'system');
  addMessageKey('seed_get_wallet', 'system');
  addMessageKey('seed_farming_time', 'system');
}

// Primer pintado del Inbox (ahora sí, I18N ya existe)
renderInbox();
if (!USE_TAP_SPAWN) {
      scheduleHot(); // modo clásico por tiempo
} else {
  // modo por TAP: configurar el primer umbral de aparición
  combo.tapCounter = 0;
  combo.nextSpawnAt = randInt(...SPAWN_TAPS[targetLevel()]);
}
updateBadge(); // inicia oculto en base
// Cargar sesión guardada o mostrar splash
if (!loadSavedSession()) {
  document.getElementById('splash')?.classList.remove('splash--hide');
}
})(); 

// === Sincroniza clase .open para animación de drawers ===
(function(){
  const prevOpen = window.openDrawer;
  const prevClose = window.closeDrawer;

  window.openDrawer = function(id){
    if (typeof prevOpen === 'function') prevOpen(id);
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  };

  window.closeDrawer = function(id){
    if (typeof prevClose === 'function') prevClose(id);
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  };
})();

// ===== Body lock cuando hay drawers abiertos =====
(function(){
  const drawers = document.querySelectorAll('.drawer');
  if (!drawers.length) return;

  const update = () => {
    const anyOpen = Array.from(drawers).some(d => d.classList.contains('show'));
    document.body.classList.toggle('has-drawer', anyOpen);
  };

  // Observa cambios de clase en cada drawer (abre/cierra)
  const mo = new MutationObserver(update);
  drawers.forEach(d => mo.observe(d, { attributes: true, attributeFilter: ['class'] }));

  // Llamada inicial por si ya hay alguno abierto al cargar
  update();
})();

// 🔒 Anti-autotap: pausar juego si está en background
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    noEnergyUntil = performance.now() + 9999999; // bloquea mientras esté oculto
  } else {
    noEnergyUntil = 0; // desbloquea al volver
  }
});
(function setupTrophyTip(){
  const btn = document.getElementById('trophyBtn');
  const tip = document.getElementById('trophyTip');
  if (!btn || !tip) return;

  let timer;
  btn.addEventListener('click', () => {
    tip.classList.add('show');     // aparece
    clearTimeout(timer);
    timer = setTimeout(() => {
      tip.classList.remove('show'); // se desvanece
    }, 1600); // 1.6s visible
  });
})();

// expose init for hooks
try{ window.init = window.init || init; window.__startGame = window.__startGame || init; }catch{};
