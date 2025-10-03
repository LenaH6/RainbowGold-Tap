/* eslint-disable no-undef, no-unused-vars */
// app-legacy.js — lógica de juego: taps, combos x1..x5, decoy, rainbow race, frenzy,
// energía con refill 0.1% cap en WLD, regen a 0.5/s, inbox badge, toasts.

(() => {
  // ====== Estado base ======
  const POWER_BASE = 0.1000;     // puntos por tap
  const ENERGY_CAP = 100;        // capacidad inicial
  const REGEN_PER_S = 0.5;       // energía por segundo
  const REGEN_TICK_MS = 500;     // frecuencia

  const BONUS = [0, 0.0000, 0.0002, 0.0006, 0.0011, 0.0018]; // extra al cerrar ventana
  const WINDOW_MS = [0, 850, 1000, 1150, 1300, 1450];
  const DECOY_CHANCE = 0.30;
  const FRENZY_MS = 8000;

  const RAINBOW = { HITS: 3, TOTAL_MS: 8000, APPEAR_MS:[400,900], DECOY_CHANCE };

  const SPAWN_TAPS = { 1:[5,12], 2:[5,10], 3:[4,8], 4:[3,7], 5:[3,6] };

  // ====== Selectores ======
  const $ = (q)=>document.querySelector(q);
  const coin = $('#coin'); const coinBox = $('#coinBox');
  const fx = $('#fx'); const ctx = fx ? fx.getContext('2d') : null;
  const sparkle = new Image(); sparkle.src = '/img/sparkle.png';
  const windowTag = $('#windowTag'); const windowArc = document.getElementById('windowArc');
  const windowArcCircle = windowArc ? windowArc.querySelector('circle') : null;
  const balWLD = $('#balWLD'); const balRBGp = $('#balRBGp');
  const energyFill = $('#energyFill'); const energyNow = $('#energyNow'); const energyMax = $('#energyMax');
  const refillBtn = $('#refillBtn'); const refillPriceEl = $('#refillPrice');
  const trophyBtn = $('#trophyBtn'); const inboxBtn = $('#inboxBtn'); const profileBtn = $('#profileBtn');

  const hot = $('#hot'); const hotCore = $('#hotCore'); const gainContainer = document.getElementById('gain');

  // ====== Persistencia ======
  function jget(k, def=null){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch{ return def; } }
  function jset(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
  function sset(k, v){ try{ localStorage.setItem(k, String(v)); }catch{} }

  const LS = {
    stats: "rg_stats",    // {rbgp,taps,refills,ideaTickets}
    wld: "rg_wld",
    profile: "rg_profile",
    ideasExp: "rg_ideas_exp"
  };

  const stats = jget(LS.stats, { rbgp:0, taps:0, refills:0, ideaTickets:0 });
  let wld = parseFloat(localStorage.getItem(LS.wld) || "0");

  // ====== Variables ======
  let energy = Number(localStorage.getItem('energy') || ENERGY_CAP);
  let lastTapTime = 0, noEnergyUntil = 0;

  const combo = { level:0, count:0, frenzyUntil:0, window:null, tapCounter:0, nextSpawnAt:8 };
  let hotActive=false, hotSkin=null, hotAutoTimer=0, hotLocked=false;
  const challenge = { active:false, hits:0, timerId:0, spawnTimer:0, completed:false };

  // ====== Utils ======
  const fmt = (v, d=4)=> Number(v).toFixed(d);
  const rand=(a,b)=> (a + Math.random()*(b-a)); const randInt=(a,b)=> Math.floor(rand(a,b+1));
  const capMax = ()=> ENERGY_CAP;
  window.priceRefill = ()=> Math.max(0.001*capMax(), 0.001*capMax()); // 0.1% cap → WLD

  // ====== FX ======
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

  // ====== Ganancia flotante ======
  function spawnGain(x,y,txt){
    const el = document.createElement('div');
    el.className = 'gain';
    el.textContent = txt;
    el.style.position='fixed';
    el.style.left=(x-4)+'px'; el.style.top=(y-10)+'px';
    el.style.fontSize='14px'; el.style.fontWeight='900'; el.style.color='#fff';
    el.style.textShadow='0 2px 6px rgba(0,0,0,.55), 0 0 10px rgba(0,0,0,.35)';
    el.style.transition='transform .5s ease, opacity .5s ease';
    el.style.willChange='transform,opacity'; el.style.zIndex='1001';
    document.body.appendChild(el);
    requestAnimationFrame(()=>{ el.style.transform='translateY(-24px)'; el.style.opacity='0'; });
    setTimeout(()=> el.remove(), 520);
  }

  // ====== UI ======
  function render(){
    if (balWLD)  balWLD.textContent = (Number(localStorage.getItem(LS.wld)||wld)||0).toFixed(2);
    if (balRBGp) balRBGp.textContent= Number(stats.rbgp||0).toFixed(3);
    const eMax = capMax();
    const pct = Math.max(0, Math.min(100, (energy/eMax)*100));
    if (energyFill) energyFill.style.width = pct.toFixed(1)+'%';
    if (energyNow) energyNow.textContent = Math.floor(energy);
    if (energyMax) energyMax.textContent = eMax;
    if (refillPriceEl) refillPriceEl.textContent = priceRefill().toFixed(2)+' WLD';
    // pulso si <= 50%
    if (refillBtn) {
      const low = pct<=50;
      refillBtn.classList.toggle('pulse', low);
      refillBtn.disabled = (energy>=eMax-1e-6);
    }
  }

  // ====== Toast arriba del RBGp ======
  function toast(msg){
    const pill = document.querySelector('.pill');
    if (!pill) return;
    let t = document.getElementById('rg_toast');
    if (!t){ t=document.createElement('div'); t.id='rg_toast'; pill.parentElement.insertBefore(t, pill.nextSibling); }
    t.textContent = msg;
    t.style.marginTop='8px'; t.style.fontWeight='800'; t.style.fontSize='12px';
    t.style.opacity='1'; t.style.transition='opacity .8s';
    setTimeout(()=> t.style.opacity='0', 1200);
  }

  // ====== Aro ======
  function arcShowSegment(deg, color){
    if (!windowArcCircle) return;
    windowArcCircle.style.stroke = color || '#ffd872';
    windowArcCircle.setAttribute('stroke-width','7');
    windowArcCircle.setAttribute('stroke-linecap','round');
    windowArcCircle.setAttribute('stroke-dasharray', `${deg} 360`);
    windowArcCircle.setAttribute('stroke-dashoffset','0');
    if (windowArc) windowArc.style.opacity='1';
  }
  function arcUpdate(level, t){
    if (!windowArcCircle) return;
    const deg = Math.round((level/6)*360);
    arcShowSegment(deg, ({1:'#ffd872',2:'#9cff70',3:'#6ae1ff',4:'#d08bff',5:'#ff6a6a'})[level]);
    const off = Math.min(deg, deg*t);
    windowArcCircle.setAttribute('stroke-dashoffset', String(off));
  }
  function arcHide(){ if (windowArc) windowArc.style.opacity='0'; }

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

  // ====== Hot/Decoy ======
  function showHot(skin){
    if (!hot || !hotCore || !coin) return;
    hotActive=true; hotSkin=skin;
    const R = coin.getBoundingClientRect();
    const s = Math.max(30, Math.round(R.width*0.24));
    const cx = Math.round(R.left + R.width*(0.3 + Math.random()*0.4));
    const cy = Math.round(R.top  + R.height*(0.3 + Math.random()*0.4));
    hot.style.left = (cx - R.left - s/2)+'px';
    hot.style.top  = (cy - R.top  - s/2)+'px';
    hot.style.width = hot.style.height = s+'px';
    hot.style.borderRadius='50%';
    hot.style.opacity='1';
    const core = Math.round(s*0.42);
    hotCore.style.left = (cx - R.left - core/2)+'px';
    hotCore.style.top  = (cy - R.top  - core/2)+'px';
    hotCore.style.width = hotCore.style.height = core+'px';
    hotCore.style.borderRadius='50%';
    hotCore.style.opacity='1';
    if (skin==='rb'){
      hot.style.background = 'conic-gradient(#ff0055,#ff9500,#ffee00,#33dd55,#33aaff,#aa66ff,#ff0055)';
      hotCore.style.background='radial-gradient(circle,#fff,rgba(255,255,255,.0) 70%)';
    } else if (skin==='decoy'){
      hot.style.background='radial-gradient(circle, rgba(255,255,255,.15), rgba(255,255,255,.0) 70%)';
      hotCore.style.background='radial-gradient(circle, rgba(255,80,80,.9), rgba(255,80,80,.0) 66%)';
    } else {
      const colors = {x1:'#ffd872',x2:'#9cff70',x3:'#6ae1ff',x4:'#d08bff',x5:'#ff6a6a'};
      const c = colors[skin] || '#ffd872';
      hot.style.background = `radial-gradient(circle, ${c}88, rgba(0,0,0,0) 70%)`;
      hotCore.style.background = `radial-gradient(circle, ${c}, rgba(0,0,0,0) 68%)`;
    }
  }
  function hideHot(){ hotActive=false; hotSkin=null; if(hot) hot.style.opacity='0'; if(hotCore) hotCore.style.opacity='0'; }
  function isIn(el, e){
    const r = el.getBoundingClientRect();
    return (e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom);
  }

  // ====== Combos & ventanas ======
  function targetLevel(){
    const now = performance.now();
    if (now < combo.frenzyUntil) return 5;
    if (combo.level < 5) return combo.level + 1;
    return 5;
  }
  function createWindow(level){
    if (combo.window) return;
    combo.window = { level, tapsNeeded: level, tapsDone:0, t0:performance.now(), durationMs: WINDOW_MS[level], raf:0 };
    arcShowSegment(Math.round((level/6)*360), ({1:'#ffd872',2:'#9cff70',3:'#6ae1ff',4:'#d08bff',5:'#ff6a6a'})[level]);
    tagShow('X'+level+' 0/'+level);
    combo.window.raf = requestAnimationFrame(tickWindow);
  }
  function tickWindow(){
    const w = combo.window; if (!w) return;
    const t = Math.min(1, (performance.now()-w.t0)/w.durationMs);
    arcUpdate(w.level, t);
    if (t>=1){
      // falló → reset combo
      cancelAnimationFrame(w.raf); combo.window=null; arcHide(); tagHide();
      combo.level=0; combo.count=0; return;
    }
    w.raf = requestAnimationFrame(tickWindow);
  }
  function windowStep(){
    const w = combo.window; if (!w) return;
    w.tapsDone++;
    tagShow('X'+w.level+' '+w.tapsDone+'/'+w.tapsNeeded);
    if (w.tapsDone >= w.tapsNeeded){
      // bonus por cerrar
      stats.rbgp = Number(stats.rbgp||0) + (BONUS[w.level]||0);
      jset(LS.stats, stats);
      cancelAnimationFrame(w.raf); combo.window=null; arcHide(); tagHide();
      combo.level = Math.min(5, w.level); combo.count = 0;
      if (combo.level>=5) startFrenzy();
    }
  }

  // ====== Rainbow challenge ======
  let hotTimer=0;
  function spawnRBorDecoy(){
    clearTimeout(hotTimer);
    const skin = (Math.random() < RAINBOW.DECOY_CHANCE) ? 'decoy' : 'rb';
    showHot(skin);
    hotLocked=false;
    hotTimer = setTimeout(()=>{ hideHot(); }, randInt(RAINBOW.APPEAR_MS[0], RAINBOW.APPEAR_MS[1]));
  }
  function startRainbow(){
    if (challenge.active) return;
    challenge.active=true; challenge.hits=0; challenge.completed=false;
    tagShow(`DESAFÍO 0/${RAINBOW.HITS}`, '#ffd872');
    spawnRBorDecoy();
    challenge.spawnTimer = setInterval(spawnRBorDecoy, randInt(500,900));
    challenge.timerId = setTimeout(()=> endRainbow(false), RAINBOW.TOTAL_MS);
  }
  function endRainbow(win){
    clearTimeout(challenge.timerId); clearInterval(challenge.spawnTimer);
    hideHot(); hotLocked=false; challenge.active=false;
    if (win){ startFrenzy(); toast("¡Ganaste desafío! → FRENZY"); } else { tagHide(); }
  }

  // ====== FRENZY ======
  function startFrenzy(){
    combo.frenzyUntil = performance.now() + FRENZY_MS;
    arcHide(); tagShow('FRENZY','#ffd872');
    setTimeout(()=> tagHide(), FRENZY_MS);
  }

  // ====== Taps ======
  function addTap(){ if (energy<1) return false; energy -= 1; stats.taps=(stats.taps||0)+1; stats.rbgp = Number(stats.rbgp||0) + POWER_BASE; jset(LS.stats,stats); localStorage.setItem('energy', String(energy)); return true; }

  function maybeSpawnByTap(){
    combo.tapCounter++;
    if (combo.tapCounter >= combo.nextSpawnAt){
      const lvl = targetLevel();
      const isDecoy = Math.random() < DECOY_CHANCE;
      showHot(isDecoy ? 'decoy' : ('x'+lvl));
      hotLocked = false;
      const R = SPAWN_TAPS[lvl] || [5,12];
      combo.nextSpawnAt = combo.tapCounter + randInt(R[0], R[1]);
      clearTimeout(hotAutoTimer);
      hotAutoTimer = setTimeout(()=>{ if(!hotLocked) hideHot(); }, randInt(1100,1600));
    }
  }

  function handleTap(e){
    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();

    // desafío rainbow no consume ni suma power base
    if (challenge.active){
      if (hotActive && hotSkin==='rb' && isIn(hot, e)){
        challenge.hits++; tagShow(`DESAFÍO ${challenge.hits}/${RAINBOW.HITS}`,'#ffd872'); hideHot();
        if (challenge.hits >= RAINBOW.HITS){ endRainbow(true); }
      } else if (hotActive && hotSkin==='decoy' && isIn(hotCore, e)){
        // burla
      }
      render(); return;
    }

    const now = performance.now();
    if (hotActive && hotSkin==='decoy' && isIn(hotCore, e)) {
      // risa
    }

    if (now < (noEnergyUntil||0)){
      spawnGain(e.clientX,e.clientY, `+${fmt(0)}`); maybeSpawnByTap(); render(); return;
    }

    if (now < combo.frenzyUntil){
      spawnGain(e.clientX,e.clientY, `+${fmt(POWER_BASE)}`);
      stats.rbgp = Number(stats.rbgp||0) + POWER_BASE; jset(LS.stats, stats);
      windowStep(); maybeSpawnByTap(); render(); return;
    }

    const ok = addTap();
    if (!ok){
      noEnergyUntil = now + 1000; // 1s en 0 antes de empezar a regen
      spawnGain(e.clientX,e.clientY, `+${fmt(0)}`); maybeSpawnByTap(); render(); return;
    }

    spawnGain(e.clientX,e.clientY, `+${fmt(POWER_BASE)}`);
    if (hotActive && hotSkin?.startsWith('x') && isIn(hotCore, e)){
      const level = Number(hotSkin.replace('x',''))||1;
      createWindow(level);
    }
    if (combo.window) windowStep();
    else {
      combo.count = (combo.count||0)+1;
      const goal = targetLevel();
      if (combo.count >= goal) createWindow(goal);
    }
    maybeSpawnByTap(); render();
  }

  function bindTap(){
    if (!coin || coin.__rgTapBound) return;
    coin.__rgTapBound = true;
    coin.addEventListener('pointerdown', handleTap, { passive:false });
    coin.addEventListener('click', handleTap, { passive:false });
    window.onCoinTap = handleTap;
  }

  // ====== Refill + Inbox + Perfil ======
  window.onEnergyRefilled = function(){
    const eMax = capMax();
    energy = eMax; localStorage.setItem('energy', String(energy));
    stats.refills=(stats.refills||0)+1; jset(LS.stats, stats);
    render(); toast("Energía al 100% ⚡");
  };
  window.onEnergyRefilledCb = function(){ /* post confirm noop */ };

  window.refreshProfilePanel = function(){
    const pf = jget(LS.profile, {});
    const profRBGp = document.getElementById('profRBGp');
    const profRBG  = document.getElementById('profRBG'); // locked
    const profWLD  = document.getElementById('profWLD'); // locked / snapshot
    if (pf && pf.name){ const input = document.getElementById('usernameInput'); if (input) input.value = pf.name; }
    if (profRBGp) profRBGp.textContent = Number(stats.rbgp||0).toFixed(3);
    if (profRBG)  profRBG.textContent  = "--";
    if (profWLD)  profWLD.textContent  = "--";
  };

  // Inbox open
  if (inboxBtn){
    inboxBtn.addEventListener('click', () => {
      try { window.RainbowGold?.markInboxAllRead(); } catch {}
      const bd = document.getElementById('backdropIN'); const dr = document.getElementById('drawerIN');
      bd?.classList.add('show'); dr?.classList.add('show');
      const list = document.getElementById('inboxList'); if (list) { /* render se hace en mk-hooks on open */ }
    });
  }

  // ====== Ideas ticket (1 WLD, 5 min) ======
  window.onIdeaTicketGranted = function(expTs){
    toast("Ticket de ideas activado (5 min)");
    // Cambiar a vista de opciones
    const payV = document.getElementById('ideasPayView');
    const optV = document.getElementById('ideasOptionsView');
    if (payV && optV){ payV.style.display='none'; optV.style.display='block'; }
    // timer
    const tEl = document.getElementById('ticketTimer');
    if (tEl){
      const timer = setInterval(()=>{
        const left = Math.max(0, expTs - Date.now());
        const mm = Math.floor(left/60000), ss = Math.floor((left%60000)/1000);
        tEl.textContent = `Tiempo restante: ${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
        if (left<=0){ clearInterval(timer); toast("Ticket expirado"); payV.style.display='block'; optV.style.display='none'; }
      }, 1000);
    }
  };

  // Votar / Sugerir
  const voteBtn = document.getElementById('voteBtn');
  const suggestBtn = document.getElementById('suggestBtn');
  const pollView = document.getElementById('ideasPollView');
  const suggestView = document.getElementById('ideasSuggestView');
  if (voteBtn) voteBtn.onclick = ()=>{
    // validar ticket vigente
    const exp = Number(localStorage.getItem('rg_ideas_exp')||"0");
    if (Date.now()>exp){ toast("Ticket expirado"); return; }
    document.getElementById('ideasOptionsView').style.display='none';
    pollView.style.display='block';
  };
  if (suggestBtn) suggestBtn.onclick = ()=>{
    const exp = Number(localStorage.getItem('rg_ideas_exp')||"0");
    if (Date.now()>exp){ toast("Ticket expirado"); return; }
    document.getElementById('ideasOptionsView').style.display='none';
    suggestView.style.display='block';
  };
  const pollClose = document.getElementById('pollClose');
  if (pollClose) pollClose.onclick = ()=>{
    pollView.style.display='none';
    document.getElementById('ideasPayView').style.display='block';
  };
  const sendSuggestBtn = document.getElementById('sendSuggestBtn');
  if (sendSuggestBtn) sendSuggestBtn.onclick = ()=>{
    const exp = Number(localStorage.getItem('rg_ideas_exp')||"0");
    if (Date.now()>exp){ toast("Ticket expirado"); return; }
    const ta = document.getElementById('suggestText');
    const txt = (ta?.value || "").trim();
    if (!txt || txt.length>100){ toast("Escribe hasta 100 caracteres"); return; }
    // consumir ticket 1 uso
    localStorage.removeItem('rg_ideas_exp');
    toast("Sugerencia enviada");
    suggestView.style.display='none';
    document.getElementById('ideasPayView').style.display='block';
  };
  // Votos (A/B/C)
  const pollA = document.getElementById('pollOptA');
  const pollB = document.getElementById('pollOptB');
  const pollC = document.getElementById('pollOptC');
  function sendVote(which){
    const exp = Number(localStorage.getItem('rg_ideas_exp')||"0");
    if (Date.now()>exp){ toast("Ticket expirado"); return; }
    // consumir ticket
    localStorage.removeItem('rg_ideas_exp');
    toast("Voto enviado");
    pollView.style.display='none';
    document.getElementById('ideasPayView').style.display='block';
  }
  if (pollA) pollA.onclick = ()=> sendVote('A');
  if (pollB) pollB.onclick = ()=> sendVote('B');
  if (pollC) pollC.onclick = ()=> sendVote('C');

  // ====== Enter Game ======
  function enterGame(){
    const splash = document.getElementById('splash');
    if (splash) splash.style.display='none';
    sizeCanvasToCoin();
    setTimeout(()=> spawn(fx.width/2, fx.height/2), 200);
    render();
    combo.tapCounter = 0;
    { const R = SPAWN_TAPS[targetLevel()] || [5,12]; combo.nextSpawnAt = randInt(R[0], R[1]); }
    bindTap();
  }
  window.__startGame = enterGame;

  // ====== Loop ======
  let tPrev = performance.now(), nextRegen = performance.now()+REGEN_TICK_MS;
  function frame(){
    const t = performance.now(); const dt = t - tPrev; tPrev = t;
    stepFX(dt);
    if (t >= nextRegen){
      nextRegen = t + REGEN_TICK_MS;
      const add = (REGEN_PER_S * (REGEN_TICK_MS/1000));
      // si estaba en 0, respetar 1s de espera (ya manejado en tap con noEnergyUntil)
      energy = Math.min(capMax(), energy + add);
      localStorage.setItem('energy', String(energy));
      render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ====== Expose for hooks ======
  try { window.init = window.init || enterGame; } catch {}
})();
