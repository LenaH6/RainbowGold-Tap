
(() => {
  const MK = () => window.MiniKit || window.parent?.MiniKit;
  const isMini = () => !!(MK() && MK().isInstalled && MK().isInstalled());
  const PAY_TO = "0x91bf252c335f2540871d0d2ef1476ae193a5bc8a";
  const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

  const LS = {
    siweOk:"rg_siwe_ok", siweTs:"rg_siwe_ts", wallet:"rg_wallet",
    ideasExp:"rg_ideas_exp"
  };

  const WLD_DEC = 18n;
  function wldToDecimals(amountWLD) {
    const [i, f=""] = String(amountWLD).split(".");
    const frac = (f+"000000000000000000").slice(0,18);
    return (BigInt(i||"0")*(10n**WLD_DEC) + BigInt(frac)).toString();
  }
  function save(k,v){ try{ localStorage.setItem(k, String(v)); }catch{} }
  function load(k, def){ try{ const v=localStorage.getItem(k); return v??def; }catch{ return def; } }
  function now(){ return Date.now(); }

  async function login(){
    const mk = MK();
    if (!mk || !mk.isInstalled()){
      // dev fallback
      afterLogin("");
      return true;
    }
    try {
      let nonce="dev";
      try {
        const r = await fetch("/api/nonce"); if (r.ok){ const j=await r.json(); nonce=j.nonce||"dev"; }
      }catch{}
      const { finalPayload } = await mk.commandsAsync.walletAuth({ nonce });
      if (finalPayload?.status === "success"){
        const addr = mk.walletAddress || finalPayload?.address || "";
        afterLogin(addr);
        fetch("/api/complete-siwe", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ payload: finalPayload, nonce }) }).catch(()=>{});
        return true;
      }
    }catch(e){ console.error("login error", e); }
    return false;
  }

  function afterLogin(address){
    // hide splash & update button
    const splash = document.getElementById("splash");
    const wldState = document.getElementById("wldState");
    if (splash) splash.style.display="none";
    if (wldState) wldState.style.display="none";
    const btn = document.getElementById("wldSignIn");
    if (btn && address) btn.textContent = `Conectado: ${address.slice(0,6)}…${address.slice(-4)}`;
    // session
    save(LS.siweOk,"1"); save(LS.siweTs, now()); if (address) save(LS.wallet, address);
    // start game
    if (typeof window.__startGame === 'function') window.__startGame();
    else if (typeof window.init === 'function') window.init();
    // prepare join sound on first tap
    try{
      const a = new Audio("/snd/join.mp3"); a.preload="auto"; a.volume=1;
      const once = ()=>{ a.play().catch(()=>{}); document.removeEventListener("pointerdown", once, {capture:true}); };
      document.addEventListener("pointerdown", once, { once:true, capture:true });
    }catch{}
  }

  async function pay({ description, wldAmount }, cbName){
    if (!isMini()) return false;
    try {
      let id = "ref_"+Math.random().toString(36).slice(2,10);
      try { const r=await fetch("/api/initiate-payment",{method:"POST"}); if (r.ok){ const j=await r.json(); id=j.id||id; } }catch{}
      const payload = {
        reference: id,
        to: PAY_TO,
        tokens: [{ symbol: "WLD", token_amount: wldToDecimals(wldAmount) }],
        description
      };
      const { finalPayload } = await MK().commandsAsync.pay(payload);
      if (finalPayload?.status === "success"){
        fetch("/api/confirm-payment", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ payload: finalPayload })}).catch(()=>{});
        try { typeof window[cbName] === "function" && window[cbName](); } catch {}
        return true;
      }
    }catch(e){ console.error("pay error", e); }
    return false;
  }

  // UI helpers from HTML
  window.Login = login;
  window.handleRefillPayment = async () => {
    let price = 0.10;
    try { if (typeof window.priceRefill === "function") price = Number(window.priceRefill()) || 0.10; } catch {}
    const ok = await pay({ description:"RainbowGold — Energy Refill", wldAmount: price }, "onEnergyRefilledCb");
    if (ok) try { window.onEnergyRefilled && window.onEnergyRefilled(); } catch {}
  };
  window.handleIdeaPayment = async () => {
    const ok = await pay({ description:"RainbowGold — Idea Ticket", wldAmount: 1 }, "onIdeaTicketGranted");
    if (ok){
      const exp = now() + 5*60*1000; save(LS.ideasExp, exp);
      try { window.onIdeaTicketGranted && window.onIdeaTicketGranted(exp); } catch {}
    }
  };

  // auto-restore session
  document.addEventListener("DOMContentLoaded", ()=>{
    try {
      const ok = load(LS.siweOk)==="1";
      const ts = Number(load(LS.siweTs, "0"));
      if (ok && (now()-ts) < SESSION_MS && isMini()){
        const addr = MK().walletAddress || "";
        afterLogin(addr);
      }
    }catch{}
  });
})();
