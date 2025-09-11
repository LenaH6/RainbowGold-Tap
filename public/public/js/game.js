
/**
 * RainbowGold - Game (migrado a onefile)
 * Replica estructura y mecánicas básicas del ZIP original.
 */
window.Game = window.Game || {};

(function(){
  const root = document.getElementById('game-root');
  const $ = (s,el=document)=>el.querySelector(s);

  function preload(srcs=[]){ srcs.forEach(s=>{ const i=new Image(); i.src=s; }); }

  let score=0, energyNow=100, energyMax=100, energyPerTap=1;
  const regenPerSec=8; let lastTs=0; let playing=false; let rafId=0;

  const sounds = {
    tick: new Audio('/snd/tick.mp3'),
    slot: new Audio('/snd/slot_loop.mp3'),
    tension: new Audio('/snd/tension_loop.mp3'),
    join: new Audio('/snd/join.mp3'),
    nice: new Audio('/snd/nice.mp3'),
    laugh: new Audio('/snd/laugh.mp3'),
    rainbow: new Audio('/snd/rainbow_race.mp3'),
    freeze: new Audio('/snd/freeze.mp3')
  };
  Object.values(sounds).forEach(a => { a.preload='auto'; a.volume=0.7; });

  root.innerHTML = `
    <div class="pill">
      <img src="/assets/img/brand-mark-wg-128.png" alt="" onerror="this.style.display='none'">
      RBGp: <b id="balRBGp" aria-live="polite">0.000</b>
    </div>
    <section class="hero">
      <div class="coinWrap" id="coinBox">
        <div class="ring"></div>
        <canvas id="fx"></canvas>
        <div id="coin" class="coin" aria-label="Tap">
          <img src="/assets/img/Coin.png" alt="Coin" width="220" height="220" style="user-select:none;-webkit-user-drag:none;">
        </div>
        <button id="ideasBtn" class="idea-btn" aria-label="Ideas">
          <img src="/assets/img/icon-idea.png" alt="Ideas">
        </button>
      </div>
      <div class="action-dock" aria-label="acciones rápidas">
        <button id="refillBtn" class="btn-icon" aria-label="Refill">
          <img src="/assets/img/ico-refill.png" alt="Refill" style="width:40px;height:40px;">
          <span id="refillPrice" class="price-pill">0.10 WLD</span>
        </button>
        <button id="openUp" class="btn-icon" aria-label="Boosters">
          <img src="/assets/img/icon-gear.png" alt="Boosters" style="width:40px;height:35px;">
        </button>
        <button id="trophyBtn" class="btn-icon" aria-label="Trophy">
          <img src="/assets/img/icon-trophy.png" alt="Trophy" style="width:40px;height:35px;">
        </button>
        <div id="trophyTip" class="tip">Próximamente</div>
      </div>
      <div class="energyWrap">
        <div class="energyBar"><div id="energyFill" class="energyFill" style="width:100%"></div></div>
        <div class="energyLbl">⚡ <b id="energyNow">100</b>/<b id="energyMax">100</b></div>
      </div>
    </section>
  `;

  const elBal = $('#balRBGp', root);
  const elCoin = $('#coin', root);
  const elEnergyFill = $('#energyFill', root);
  const elEnergyNow = $('#energyNow', root);
  const elEnergyMax = $('#energyMax', root);
  const elTrophyBtn = $('#trophyBtn', root);
  const elTrophyTip = $('#trophyTip', root);
  const elRefillBtn = $('#refillBtn', root);

  preload(['/assets/img/Coin.png','/assets/img/logo-splash.png','/assets/img/noise-512.png']);

  function setScore(v){ score=Math.max(0,v); if(elBal) elBal.textContent=score.toFixed(3); }
  function setEnergy(v){
    energyNow=Math.max(0, Math.min(energyMax, v));
    if (elEnergyNow) elEnergyNow.textContent=String(Math.floor(energyNow));
    if (elEnergyMax) elEnergyMax.textContent=String(energyMax);
    if (elEnergyFill) elEnergyFill.style.width = `${Math.round((energyNow/energyMax)*100)}%`;
  }

  function tap(){
    if (energyNow<=0) return;
    setEnergy(energyNow - energyPerTap);
    setScore(score + 0.005);
    elCoin.animate([{transform:'scale(1)'},{transform:'scale(0.94)'},{transform:'scale(1)'}], {duration:120, easing:'cubic-bezier(.2,.8,.2,1)'});
    try{ sounds.tick.currentTime=0; sounds.tick.play(); }catch{}
  }

  function regen(dt){ if (energyNow>=energyMax) return; const add = regenPerSec*(dt/1000); setEnergy(energyNow + add); }

  function loop(ts){ if(!playing){ lastTs=ts; rafId=requestAnimationFrame(loop); return; } const dt=Math.min(48, ts-lastTs); lastTs=ts; regen(dt); rafId=requestAnimationFrame(loop); }
  function start(){ if(playing) return; playing=true; lastTs=performance.now(); rafId=requestAnimationFrame(loop); try{ sounds.join.play(); }catch{} }
  function stop(){ playing=false; cancelAnimationFrame(rafId); }

  elCoin.addEventListener('click', tap, { passive: true });
  elCoin.addEventListener('touchstart', e=>{ e.preventDefault(); tap(); }, { passive:false });

  (function(btn, tip){
    if(!btn||!tip) return;
    let t; btn.addEventListener('click', ()=>{ tip.classList.add('show'); clearTimeout(t); t=setTimeout(()=>tip.classList.remove('show'), 1600); });
  })(elTrophyBtn, elTrophyTip);

  elRefillBtn.addEventListener('click', ()=>{ setEnergy(energyMax); try{ sounds.nice.play(); }catch{} });

  window.rafClearAll = ()=>{ cancelAnimationFrame(rafId); };

  setScore(0); setEnergy(energyNow);

  window.Game.start = async ({ token }) => { start(); };
})();
