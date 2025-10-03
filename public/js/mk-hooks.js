(() => {
  const MK = () => window.MiniKit || window.parent?.MiniKit;
  const isMini = () => !!(MK() && MK().isInstalled && MK().isInstalled());
  const PAY_TO = "0x91bf252c335f2540871d0d2ef1476ae193a5bc8a";
  const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

  const LS = { siweOk:"rg_siwe_ok", siweTs:"rg_siwe_ts", wallet:"rg_wallet" };

  function now(){ return Date.now(); }
  function postLoginUI(addr=""){
    const splash = document.getElementById('splash');
    const wldState = document.getElementById('wldState');
    if (splash) splash.style.display='none';
    if (wldState) wldState.style.display='none';
    const btn = document.getElementById('wldSignIn');
    if (btn && addr) btn.textContent = `Conectado: ${addr.slice(0,6)}…${addr.slice(-4)}`;
    localStorage.setItem(LS.siweOk,"1");
    localStorage.setItem(LS.siweTs,String(now()));
    if (addr) localStorage.setItem(LS.wallet, addr);
    if (typeof window.__startGame==='function') window.__startGame();
    else if (typeof window.init==='function') window.init();
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const ok = localStorage.getItem(LS.siweOk)==="1";
    const ts = Number(localStorage.getItem(LS.siweTs)||"0");
    if (ok && (now()-ts)<SESSION_MS && isMini()){
      const addr = MK().walletAddress || "";
      postLoginUI(addr);
    }
  });

  function wldToDecimals(amount) {
    const [i, f=""] = String(amount).split(".");
    const frac = (f + "000000000000000000").slice(0,18);
    return (BigInt(i||"0")*(10n**18n) + BigInt(frac)).toString();
  }

  async function Login(){
    const mk = MK();
    if (!mk || !mk.isInstalled()){
      postLoginUI("");
      return true;
    }
    try{
      let nonce="dev";
      try{ const r = await fetch('/api/nonce', { credentials:'include' }); if (r.ok){ const j=await r.json(); nonce=j.nonce||'dev'; } }catch{}
      const { finalPayload } = await mk.commandsAsync.walletAuth({ nonce });
      if (finalPayload?.status==='success'){
        const addr = mk.walletAddress || finalPayload?.address || "";
        postLoginUI(addr);
        fetch('/api/complete-siwe',{ method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ payload: finalPayload, nonce }) }).catch(()=>{});
        return true;
      }
    }catch(e){ console.error(e); }
    return false;
  }
  window.Login = Login;

  async function pay({ description, wldAmount }){
    if (!isMini()) return false;
    let id = 'ref_'+Math.random().toString(36).slice(2,10);
    try{ const r=await fetch('/api/initiate-payment',{method:'POST'}); if (r.ok){ const j=await r.json(); id=j.id||id; } }catch{}
    const payload = { reference:id, to: PAY_TO, tokens:[{ symbol:'WLD', token_amount: wldToDecimals(wldAmount) }], description };
    const { finalPayload } = await MK().commandsAsync.pay(payload);
    if (finalPayload?.status==='success'){
      fetch('/api/confirm-payment', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ payload: finalPayload }) }).catch(()=>{});
      return true;
    }
    return false;
  }
  window.handleRefillPayment = async ()=> {
    try{
      const priceEl = document.getElementById('refillPrice');
      let price = 0.10;
      if (priceEl && /\d+(\.\d+)?/.test(priceEl.textContent||'')){ price = parseFloat(priceEl.textContent); }
      const ok = await pay({ description:'RainbowGold — Energy Refill', wldAmount: price });
      if (ok && typeof window.onEnergyRefilled==='function') window.onEnergyRefilled();
    }catch(e){ console.error(e); }
  };
  window.handleIdeaPayment = async ()=>{
    const ok = await pay({ description:'RainbowGold — Idea Ticket', wldAmount: 1 });
    if (ok && typeof window.onIdeaTicketGranted==='function'){
      const exp = Date.now() + 5*60*1000;
      window.onIdeaTicketGranted(exp);
    }
  };
})();