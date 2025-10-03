(() => {
  // ====== Estado base persistente ======
  const GAIN_DECIMALS = 4;
  const POWER_BASE    = 0.0001;         // base por tap (se suma a RBGp)
  const ENERGY_CAP    = 100;            // tope de energía “capMax()”
  const REGEN_PER_S   = 0.45;           // energía que regenera por segundo
  const REGEN_TICK_MS = 500;            // cada cuánto aplicamos regen

  // Ventanas / combos / spawn
  const BONUS       = [0, 0.0000, 0.0002, 0.0006, 0.0011, 0.0018]; // X1..X5
  const WINDOW_MS   = [0, 850, 1000, 1150, 1300, 1450];            // X1..X5
  const DECOY_CHANCE = 0.30;
  const FRENZY_MS    = 8000;

  // Desafío Rainbow (mini-evento con manchas)
  const RAINBOW = {
    HITS: 3,
    TOTAL_MS: 8000,
    APPEAR_MS: [400, 900],
    DECOY_CHANCE: DECOY_CHANCE
  };

  // Spawn por taps (manchas normales): nivel → rango [min,max] taps para siguiente spawn
  const SPAWN_TAPS = {
    1:[5,12], 2:[5,10], 3:[4,8], 4:[3,7], 5:[3,6]
  };

  // ====== Selectores (el HTML lo inyectas con dangerouslySetInnerHTML) ======
  const $ = (q) => document.querySelector(q);
  const coin         = $('#coin');
  const coinBox      = $('#coinBox');
  const gainEl       = $('#gain');
  const windowTag    = $('#windowTag');
  const fx           = $('#fx');
  const ctx          = fx ? fx.getContext('2d') : null;
  const sparkle      = new Image(); sparkle.src = '/img/sparkle.png';
  const hot          = $('#hot');
  const hotCore      = $('#hotCore');
  const balWLD       = $('#balWLD');
  const balRBGp      = $('#balRBGp');
  const energyFill   = $('#energyFill');
  const energyNow    = $('#energyNow');
  const energyMax    = $('#energyMax');
  const refillBtn    = $('#refillBtn');
  const refillPrice  = $('#refillPrice');
  const trophyBtn    = $('#trophyBtn');
  const inboxBtn     = $('#inboxBtn');
  const profileBtn   = $('#profileBtn');

  // ====== Variables de juego ======
  let wld   = parseFloat(localStorage.getItem('wld')   || '0');
  let rbgp  = parseFloat(localStorage.getItem('rbgp')  || '0');
  let energy= parseFloat(localStorage.getItem('energy')|| String(ENERGY_CAP));

  // Anti-autotap y cooldown por 0 energía
  let lastTapTime = 0;
  let noEnergyUntil = 0;

  // Sistema de combos + ventanas
  const combo = {
    level: 0,             // 0..5
    count: 0,             // taps acumulados a este nivel (cuando llega a “level” se cierra la ventana)
    frenzyUntil: 0,       // timestamp ms hasta que dura el FRENZY
    window: null,         // { level, tapsNeeded, tapsDone, t0, durationMs, hitRect, rafId }
    tapCounter: 0,        // para spawn por tap
    nextSpawnAt: 8        // umbral dinámico para próxima mancha
  };

  // “Mancha” activa (hot) + control
  let hotActive = false;
  let hotSkin   = null;  // 'x1'..'x5' | 'rb' | 'decoy'
  let hotAutoTimer = 0;
  let hotLocked    = false;

  // Desafío Rainbow en curso
  const challenge = { active:false, hits:0, timerId:0, spawnTimer:0, completed:false };

  // ====== Audio helpers ======
  let AC;
  function tone(f=560, d=.06, type='triangle', v=.08){
    try {
      AC = AC || new (window.AudioContext||window.webkitAudioContext)();
      const o=AC.createOscillator(), g=AC.createGain();
      o.type=type; o.frequency.value=f; g.gain.value=v;
      o.connect(g).connect(AC.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + d);
      o.stop(AC.currentTime + d + 0.02);
    } catch(_) {}
  }
  const SND = {
    join:  new Audio('/snd/join.mp3'),
  };
  function playSnd(name, opts={}){
    if (name === 'tick')   { tone(940,0.04,'square',.09); return; }
    if (name === 'laugh')  { tone(420,0.06,'sawtooth',.10); setTimeout(()=>tone(280,0.08,'sawtooth',.08),70); return; }
    if (name === 'tension'){ tone(320,0.08,'sine',.06); return; }
    if (name === 'rainbow'){ tone(700,0.06,'triangle',.10); setTimeout(()=>tone(840,0.06,'triangle',.09),90); return; }
    if (name === 'win777') { tone(620,0.06,'square',.09); setTimeout(()=>tone(760,0.05,'triangle',.09),100); setTimeout(()=>tone(900,0.05,'triangle',.09),180); return; }
    if (name === 'join')   { try { SND.join.currentTime=0; SND.join.volume=(opts.volume??1); SND.join.play(); }catch(_){} }
  }
  function soundLevel(level){
    // pequeño arpegio según el nivel
    const base = 540 + level*40;
    tone(base,0.05,'triangle',.10);
    setTimeout(()=>tone(base+120,0.05,'triangle',.09),80);
  }
  function soundMiss(){ tone(220,0.10,'sawtooth',.06); }
  function soundFrenzyStart(){ tone(680,0.06,'square',.11); setTimeout(()=>tone(880,0.06,'square',.10),90); }

  // ====== Utilidades ======
  const fmt       = (v)=> Number(v).toFixed(GAIN_DECIMALS);
  const rand      = (a,b)=> (a + Math.random()*(b-a));
  const randInt   = (a,b)=> Math.floor(rand(a,b+1));
  const capMax    = ()=> ENERGY_CAP;
  const priceRefill = ()=> Math.max(0.01, capMax()*0.001); // 0.1% del cap en WLD (tu regla)

  // ====== Partículas muy livianas ======
  const parts=[];
  function sizeCanvasToCoin(){
    if (!fx || !coin) return;
    const r = coin.getBoundingClientRect();
    fx.width = Math.max(64, Math.round(r.width));
    fx.height= Math.max(64, Math.round(r.height));
    fx.style.position='absolute'; fx.style.left='0'; fx.style.top='0';
    fx.style.pointerEvents='none'; fx.style.zIndex='0';
  }
  function spawn(x,y){
    parts.push({x,y, vx:(Math.random()-0.5)*1.2, vy:(-1.2 - Math.random()*1.2), size:10+Math.random()*8, life:700, alpha:1});
    while (parts.length>64) parts.shift();
  }
  function stepFX(dt){
    if (!ctx || !fx) return;
    ctx.clearRect(0,0,fx.width,fx.height);
    for (let i=parts.length-1;i>=0;i--){
      const p = parts[i];
      p.life -= dt; if (p.life<=0){ parts.splice(i,1); continue; }
      p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.alpha = Math.max(0, p.life/700);
      ctx.globalAlpha = p.alpha;
      if (sparkle.complete) ctx.drawImage(sparkle, p.x-p.size/2, p.y-p.size/2, p.size, p.size);
      else { ctx.beginPath(); ctx.fillStyle='rgba(255,255,255,.9)'; ctx.arc(p.x,p.y, Math.max(2,p.size*0.15), 0, Math.PI*2); ctx.fill(); }
    }
    ctx.globalAlpha=1;
  }

  // ====== Ganancia flotante (número) ======
  const gainPool=[];
  function spawnGain(x,y,txt){
    const el = document.createElement('div');
    el.className='gain';
    el.textContent = txt;
    el.style.position='fixed';
    el.style.left = (x-4)+'px';
    el.style.top  = (y-10)+'px';
    el.style.fontSize='14px';
    el.style.fontWeight='900';
    el.style.color='#fff';
    el.style.textShadow='0 2px 6px rgba(0,0,0,.55), 0 0 10px rgba(0,0,0,.35)';
    el.style.transition='transform .5s ease, opacity .5s ease';
    el.style.willChange='transform,opacity';
    el.style.zIndex='1001';
    document.body.appendChild(el);
    requestAnimationFrame(()=>{
      el.style.transform='translateY(-24px)';
      el.style.opacity='0';
    });
    setTimeout(()=> el.remove(), 520);
    gainPool.push(el); while (gainPool.length>24){ const k=gainPool.shift(); k?.remove(); }
  }

  // ====== UI y renders ======
  function render(){
    if (balWLD)  balWLD.textContent = wld.toFixed(2);
    if (balRBGp) balRBGp.textContent= rbgp.toFixed(3);
    const eMax = capMax();
    const pct  = Math.max(0, Math.min(100, (energy/eMax)*100));
    if (energyFill) energyFill.style.width = pct.toFixed(1)+'%';
    if (energyNow)  energyNow.textContent  = Math.floor(energy);
    if (energyMax)  energyMax.textContent  = eMax;
    if (refillPrice) refillPrice.textContent = priceRefill().toFixed(2)+' WLD';
    if (refillBtn){
      const low = pct<25, canPay = wld>=priceRefill() && energy<eMax-1e-6;
      refillBtn.classList.toggle('pulse', low && canPay);
      refillBtn.disabled = energy>=eMax-1e-6;
    }
  }
  function updateRefillCue(){ /* ya cubierto en render */ }

  function setBadge(txt, bg, fg){
    const badge = document.getElementById('comboBadge');
    if (!badge) return;
    const spanId = 'comboTxt';
    let span = document.getElementById(spanId);
    if (!span){ span=document.createElement('span'); span.id=spanId; badge.innerHTML=''; badge.appendChild(span); }
    if (!txt){ badge.style.display='none'; span.classList.remove('rainbowText','pulseBeat'); span.style.color=''; return; }
    badge.style.display='block';
    span.textContent=txt;
    // estilo
    badge.style.position='absolute';
    badge.style.left='10px'; badge.style.top='10px';
    badge.style.transform='none'; badge.style.zIndex='3000';
    badge.style.background = (bg===undefined)?'rgba(0,0,0,.70)':bg;
    badge.style.border='1px solid rgba(255,255,255,.18)';
    badge.style.borderRadius='12px'; badge.style.padding='4px 10px';
    badge.style.fontWeight='800'; badge.style.fontSize='12px';
    span.style.color = (fg==='transparent')? 'transparent' : (fg || '#ffd872');
  }
  function updateBadge(){
    const now = performance.now();
    if (challenge.active){
      setBadge('RAINBOW RACE','rgba(0,0,0,.55)','transparent'); // arcoíris via CSS (ya traes estilos)
      return;
    }
    if (now < combo.frenzyUntil){ setBadge('FRENZY','linear-gradient(180deg,#3a2a00,#1a1200)','#ffd872'); return; }
    if (combo.level>=1){
      const color = ({1:'#ffd872',2:'#9cff70',3:'#6ae1ff',4:'#d08bff',5:'#ff6a6a'})[combo.level] || '#ffd872';
      setBadge('X'+combo.level, 'rgba(0,0,0,.55)', color);
    } else setBadge(null);
  }
  function tagShow(text, color='#ffd872'){
    if (!windowTag) return;
    windowTag.textContent = text;
    windowTag.style.color = color;
    windowTag.style.opacity='1';
    windowTag.style.transform='translateX(-50%) scale(1)';
  }
  function tagHide(){
    if (!windowTag) return;
    windowTag.style.opacity='0';
    windowTag.style.transform='translateX(-50%) scale(.9)';
  }

  // ====== Aro (SVG) para ventanas/desafío ======
  const windowArc = document.getElementById('windowArc');
  const windowArcCircle = windowArc ? windowArc.querySelector('circle') : null;
  function arcShowSegment(deg, levelColor){
    if (!windowArc || !windowArcCircle) return;
    windowArcCircle.style.stroke = levelColor || '#ffd872';
    windowArcCircle.setAttribute('stroke-width','7');
    windowArcCircle.setAttribute('stroke-linecap','round');
    windowArcCircle.setAttribute('stroke-dasharray', `${deg} 360`);
    windowArcCircle.setAttribute('stroke-dashoffset','0');
    windowArc.style.opacity='1';
  }
  function arcUpdateProgress(level, t){
    if (!windowArcCircle) return;
    const deg = Math.round((level/6)*360);
    arcShowSegment(deg, ({1:'#ffd872',2:'#9cff70',3:'#6ae1ff',4:'#d08bff',5:'#ff6a6a'})[level]);
    const off = Math.min(deg, deg*t);
    windowArcCircle.setAttribute('stroke-dashoffset', String(off));
  }
  function arcFlash(){
    if (!windowArc || !windowArcCircle) return;
    const prevDash  = windowArcCircle.getAttribute('stroke-dasharray') || '360 360';
    const prevWidth = windowArcCircle.getAttribute('stroke-width') || '4';
    windowArcCircle.setAttribute('stroke-dasharray','360 360');
    windowArcCircle.setAttribute('stroke-width','6');
    windowArc.style.opacity='1';
    setTimeout(()=>{ windowArcCircle.setAttribute('stroke-dasharray',prevDash);
                     windowArcCircle.setAttribute('stroke-width',prevWidth); }, 140);
  }
  function arcHide(){ if (windowArc) windowArc.style.opacity='0'; }

  // ====== Hot/Decoy ======
  function showHot(skin){
    if (!hot || !hotCore || !coin) return;
    hotSkin = skin; hotActive = true;
    // tamaño y posición ~centrado y aleatorio
    const R = coin.getBoundingClientRect();
    const s = Math.max(30, Math.round(R.width*0.24));
    const cx = Math.round(R.left + R.width* (0.3 + Math.random()*0.4));
    const cy = Math.round(R.top  + R.height*(0.3 + Math.random()*0.4));

    // capa grande
    hot.style.left = (cx - R.left - s/2)+'px';
    hot.style.top  = (cy - R.top  - s/2)+'px';
    hot.style.width = hot.style.height = s+'px';
    hot.style.borderRadius='50%';
    hot.style.opacity='1';

    // núcleo
    const core = Math.round(s*0.42);
    hotCore.style.left = (cx - R.left - core/2)+'px';
    hotCore.style.top  = (cy - R.top  - core/2)+'px';
    hotCore.style.width = hotCore.style.height = core+'px';
    hotCore.style.borderRadius='50%';
    hotCore.style.opacity='1';

    // color/gradiente por skin
    const colors = {x1:'#ffd872',x2:'#9cff70',x3:'#6ae1ff',x4:'#d08bff',x5:'#ff6a6a'};
    if (skin==='rb'){
      hot.style.background = 'conic-gradient(#ff0055,#ff9500,#ffee00,#33dd55,#33aaff,#aa66ff,#ff0055)';
      hotCore.style.background = 'radial-gradient(circle,#fff,rgba(255,255,255,.0) 70%)';
    } else if (skin==='decoy'){
      hot.style.background='radial-gradient(circle, rgba(255,255,255,.15), rgba(255,255,255,.0) 70%)';
      hotCore.style.background='radial-gradient(circle, rgba(255,80,80,.9), rgba(255,80,80,.0) 66%)';
    } else {
      const c = colors[skin] || '#ffd872';
      hot.style.background = `radial-gradient(circle, ${c}88, rgba(0,0,0,0) 70%)`;
      hotCore.style.background = `radial-gradient(circle, ${c}, rgba(0,0,0,0) 68%)`;
    }
  }
  function hideHot(){
    hotActive=false; hotSkin=null;
    if (hot) { hot.style.opacity='0'; }
    if (hotCore){ hotCore.style.opacity='0'; }
  }
  function hideHotSafe(){ try{ hideHot(); }catch(_){} }

  function isInHot(e){
    if (!hot || hot.style.opacity==='0') return false;
    const r = hot.getBoundingClientRect();
    return (e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom);
  }
  function isInHotCore(e){
    if (!hotCore || hotCore.style.opacity==='0') return false;
    const r = hotCore.getBoundingClientRect();
    return (e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom);
  }

  // ====== Ventanas / Combos ======
  function targetLevel(){
    const now = performance.now();
    if (now < combo.frenzyUntil) return 5;
    // sube 1,2,3,4,5 en orden
    if (combo.level<5) return combo.level+1;
    return 5;
  }
  function createWindow(level){
    if (combo.window) return;
    // “hitRect” (área válida) = rect del núcleo capturado
    let hitRect = null;
    if (hotCore && coin){
      const coinRect = coin.getBoundingClientRect();
      const coreRect = hotCore.getBoundingClientRect();
      hitRect = {
        x:(coreRect.left-coinRect.left)/coinRect.width,
        y:(coreRect.top -coinRect.top )/coinRect.height,
        w: coreRect.width/coinRect.width,
        h: coreRect.height/coinRect.height
      };
    }
    combo.window = {
      level, tapsNeeded: level, tapsDone:0,
      t0: performance.now(), durationMs: WINDOW_MS[level],
      hitRect, rafId:0
    };
    soundLevel(level);
    hotLocked = true; clearTimeout(hotAutoTimer);
    const deg = Math.round((level/6)*360);
    arcShowSegment(deg, ({1:'#ffd872',2:'#9cff70',3:'#6ae1ff',4:'#d08bff',5:'#ff6a6a'})[level]);
    tagShow('X'+level+' 0/'+level, ({1:'#ffd872',2:'#9cff70',3:'#6ae1ff',4:'#d08bff',5:'#ff6a6a'})[level]);
    updateBadge();
    combo.window.rafId = requestAnimationFrame(tickWindow);
  }
  function tickWindow(){
    if (!combo.window) return;
    const w = combo.window;
    const t = Math.min(1, (performance.now()-w.t0)/w.durationMs);
    arcUpdateProgress(w.level, t);
    if (t>=1){
      // falló la ventana → reset de combo
      closeWindow(false);
      combo.level=0; combo.count=0; updateBadge(); tagHide();
      hideHotSafe(); hotLocked=false;
      return;
    }
    w.rafId = requestAnimationFrame(tickWindow);
  }
  function closeWindow(success){
    if (!combo.window) return;
    cancelAnimationFrame(combo.window.rafId||0);
    combo.window=null;
    arcHide();
    tagHide();
    hotLocked=false;
  }

  function onComboStep(hits){
    const w = combo.window; const level = w?.level || combo.level || 1;
    if (!w) return;
    w.tapsDone = hits;
    tagShow('X'+level+' '+hits+'/'+level, ({1:'#ffd872',2:'#9cff70',3:'#6ae1ff',4:'#d08bff',5:'#ff6a6a'})[level]);
    // si completó
    if (w.tapsDone >= w.tapsNeeded){
      // aplica bonus
      const bonus = BONUS[level] || 0;
      rbgp += bonus; localStorage.setItem('rbgp',String(rbgp));
      playSnd('tick',{volume:.8});
      spawn(Math.random()*fx.width, Math.random()*fx.height);
      closeWindow(true);
      combo.level = Math.min(5, level);
      combo.count = 0;
      updateBadge();
      // si llegó a 5 → FRENZY
      if (level>=5){ startFrenzy(); }
    }
  }
  function applyComboTap(e){
    // si hay ventana activa, validamos zona de acierto
    if (combo.window){
      const w = combo.window;
      if (w.hitRect && coin){
        const R = coin.getBoundingClientRect();
        const rx = (e.clientX - R.left)/R.width;
        const ry = (e.clientY - R.top)/R.height;
        if (rx>=w.hitRect.x && rx<=w.hitRect.x+w.hitRect.w && ry>=w.hitRect.y && ry<=w.hitRect.y+w.hitRect.h){
          onComboStep((w.tapsDone||0)+1);
        } // si cae fuera, se ignora (no termina ventana)
      }
      return;
    }
    const now = performance.now();
    // ¿había “hot” visible? → abre ventana en su nivel
    if (hotActive && !hotLocked){
      const lvl = Math.max(1, Math.min(5, parseInt(String(hotSkin).replace('x',''))||1));
      createWindow(lvl); return;
    }
    // si no hay ventana → ACIERTO = sube “count”, cuando llega a target abre ventana
    combo.count = (combo.count||0)+1;
    const goal = targetLevel();
    if (combo.count >= goal){ createWindow(goal); }
  }

  function startFrenzy(){
    combo.frenzyUntil = performance.now() + FRENZY_MS;
    arcHide();
    soundFrenzyStart();
    tagShow('FRENZY','#ffd872');
    updateBadge();
    // vibración leve (si existe)
    try{ navigator.vibrate && navigator.vibrate([60,40,60]); }catch(_){}
    setTimeout(()=>{ tagHide(); updateBadge(); }, FRENZY_MS);
  }

  // ====== Desafío Rainbow (manchas “rb” + decoy) ======
  function spawnRainbowOrDecoy(){
    clearTimeout(hotAutoTimer);
    const skin = (Math.random() < RAINBOW.DECOY_CHANCE) ? 'decoy' : 'rb';
    showHot(skin);
    hotLocked = false;
    const ms = Math.round(rand(RAINBOW.APPEAR_MS[0], RAINBOW.APPEAR_MS[1]));
    hotAutoTimer = setTimeout(()=>{ if (!hotLocked) hideHot(); }, ms);
  }
  function startRainbowChallenge(){
    if (challenge.active) return;
    challenge.active = true; challenge.hits=0; challenge.completed=false;
    tagShow(`DESAFÍO 0/${RAINBOW.HITS}`,'#ffd872');
    playSnd('tension');
    // spawner rápido:
    spawnRainbowOrDecoy();
    challenge.spawnTimer = setInterval(spawnRainbowOrDecoy, randInt(500,900));
    // timeout global:
    challenge.timerId = setTimeout(()=> endRainbowChallenge(false), RAINBOW.TOTAL_MS);
    updateBadge();
  }
  function endRainbowChallenge(win){
    clearTimeout(challenge.timerId); clearInterval(challenge.spawnTimer);
    hideHotSafe(); hotLocked=false; challenge.active=false;
    if (win){
      playSnd('rainbow'); setTimeout(()=>playSnd('win777'),160);
      // premia con FRENZY:
      startFrenzy();
    } else {
      tagHide();
    }
    updateBadge();
  }
  function handleChallengeTap(e){
    // Acierto en “rb” (real) o le pegó al núcleo del “decoy”
    const wasHit  = (hotActive && hotSkin==='rb'    && isInHot(e));
    const hitDecoy= (hotActive && hotSkin==='decoy' && isInHotCore(e));
    if (wasHit){
      playSnd('tick',{volume:.8});
      challenge.hits = Math.min(RAINBOW.HITS, challenge.hits+1);
      arcFlash();
      tagShow(`DESAFÍO ${challenge.hits}/${RAINBOW.HITS}`, '#ffd872');
      clearTimeout(hotAutoTimer); hotLocked=false; hideHotSafe();
      if (challenge.hits >= RAINBOW.HITS){ challenge.completed=true; setTimeout(()=> endRainbowChallenge(true),80); }
      return;
    }
    if (hitDecoy){ playSnd('laugh',{volume:.9}); soundMiss(); return; }
    // tap fuera → ignorar
  }

  // ====== Tap principal ======
  function addTap(){ if (energy<1) return false; energy -= 1; rbgp += POWER_BASE;
    localStorage.setItem('energy',String(energy)); localStorage.setItem('rbgp',String(rbgp)); return true; }

  function maybeSpawnByTap(){
    combo.tapCounter++;
    if (combo.tapCounter >= combo.nextSpawnAt){
      const lvl = targetLevel();
      const isDecoy = Math.random() < DECOY_CHANCE;
      showHot(isDecoy ? 'decoy' : ('x'+lvl));
      hotLocked = false;
      const R = SPAWN_TAPS[lvl];
      combo.nextSpawnAt = combo.tapCounter + randInt(R[0], R[1]);
      // autohide tras 1.1–1.6s
      clearTimeout(hotAutoTimer);
      hotAutoTimer = setTimeout(()=>{ if(!hotLocked) hideHot(); }, randInt(1100,1600));
    }
  }

  // ====== Refill / Drawers ======
  function doRefill(){
    const cost = priceRefill(), eMax = capMax();
    if (energy >= eMax-1e-6) return;
    if (wld < cost){ refillBtn?.classList.add('shake'); setTimeout(()=>refillBtn?.classList.remove('shake'),260); return; }
    wld -= cost; energy = eMax;
    localStorage.setItem('wld',String(wld)); localStorage.setItem('energy',String(energy));
    tone(620,0.08,'sine',.08); render();
  }
  window.openDrawer = function(code){
    const map={UP:['drawerUP','backdropUP'], IN:['drawerIN','backdropIN'], PF:['drawerPF','backdropPF'], ID:['drawerID','backdropID']};
    const [dr,bd]=map[code]||[]; const D=document.getElementById(dr), B=document.getElementById(bd);
    D?.classList.add('show'); B?.classList.add('show');
  };
  window.closeDrawer = function(code){
    const map={UP:['drawerUP','backdropUP'], IN:['drawerIN','backdropIN'], PF:['drawerPF','backdropPF'], ID:['drawerID','backdropID']};
    const [dr,bd]=map[code]||[]; const D=document.getElementById(dr), B=document.getElementById(bd);
    D?.classList.remove('show'); B?.classList.remove('show');
  };

  // ====== Login OK → entrar al juego ======
  function enterGame(){
    // ocultar splash, reproducir join, primer spawn FX, sincronizar UI
    const splash = document.getElementById('splash');
    if (splash) splash.style.display='none';
    playSnd('join',{volume:1});
    sizeCanvasToCoin();
    setTimeout(()=> spawn(fx.width/2, fx.height/2), 200);
    render(); updateBadge();
    // primer schedule de manchas (si quieres también por tiempo)
  combo.tapCounter = 0;
{
  const R = SPAWN_TAPS[targetLevel()] || [5,12]; // fallback por si acaso
  combo.nextSpawnAt = randInt(R[0], R[1]);       // primer umbral
}
  window.__startGame = enterGame;  // la usa mk-hooks.js tras SIWE

  // ====== Eventos ======
  if (refillBtn) refillBtn.onclick = doRefill;
  if (trophyBtn) trophyBtn.onclick = () => {/* aún "Próximamente" */};
  if (inboxBtn)  inboxBtn.onclick  = () => openDrawer('IN');
  if (profileBtn) profileBtn.onclick = () => openDrawer('PF');

  if (coin){
    coin.addEventListener('click', (e)=>{
      const now = performance.now();
      // Si estás en desafío, no gastas energía ni sumas base
      if (challenge.active){ handleChallengeTap(e); render(); updateRefillCue(); return; }
      // si hay decoy y tocaste núcleo → burla
      if (hotActive && hotSkin==='decoy' && isInHotCore(e)){ playSnd('laugh'); soundMiss(); }
      // cooldown por 0 energía → muestra +0.0000
      if (now < (noEnergyUntil||0)){ spawnGain(e.clientX,e.clientY, `+${fmt(0)}`); maybeSpawnByTap(); render(); updateRefillCue(); return; }
      // FRENZY: no gasta energía, suma base + 5% (via combo)
      if (now < combo.frenzyUntil){
        spawnGain(e.clientX,e.clientY, `+${fmt(POWER_BASE)}`);
        rbgp += POWER_BASE; localStorage.setItem('rbgp',String(rbgp));
        applyComboTap(e); maybeSpawnByTap(); render(); updateRefillCue(); return;
      }
      // modo normal: intenta gastar energía
      const ok = addTap();
      if (!ok){
        noEnergyUntil = now + 3000;
        spawnGain(e.clientX,e.clientY, `+${fmt(0)}`);
        maybeSpawnByTap(); render(); updateRefillCue();
        try{ navigator.vibrate && navigator.vibrate([80,40,80]); }catch(_){}
        return;
      }
      // sumó base → mostrar ganancia y aplicar combo/ventana
      spawnGain(e.clientX,e.clientY, `+${fmt(POWER_BASE)}`);
      applyComboTap(e);
      maybeSpawnByTap(); render(); updateRefillCue();
    });
  }

  // ====== Regen + FX scheduling (muy barato) ======
  let tPrev = performance.now(), nextRegen = performance.now()+REGEN_TICK_MS;
  function frame(){
    const t = performance.now();
    const dt = t - tPrev; tPrev = t;
    stepFX(dt);
    if (t >= nextRegen){
      nextRegen = t + REGEN_TICK_MS;
      // regen proporcional al cap
      const add = (REGEN_PER_S * (REGEN_TICK_MS/1000));
      energy = Math.min(capMax(), energy + add);
      localStorage.setItem('energy', String(energy));
      render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ====== Exponer helpers útiles al resto ======
  window.startRainbowChallenge = startRainbowChallenge;

  // Primer render
  sizeCanvasToCoin();
  render();

})();
// ==== exporta puntos de entrada para los hooks ====
try { window.init = window.init || enterGame; } catch {}
try { window.__startGame = window.__startGame || enterGame; } catch {}
