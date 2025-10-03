// mk-hooks.js — SIWE 7 días + pagos WLD + sesión + Ideas ticket 5 min
(() => {
  const MK = () => window.MiniKit || window.parent?.MiniKit;
  const isMini = () => !!(MK() && MK().isInstalled && MK().isInstalled());
  const PAY_TO = "0x91bf252c335f2540871d0d2ef1476ae193a5bc8a";
  const SESSION_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

  const LS = {
    siweOk: "rg_siwe_ok",
    siweTs: "rg_siwe_ts",
    wallet: "rg_wallet",
    profile: "rg_profile",     // {name, lang, wallet}
    stats: "rg_stats",         // {rbgp,taps,refills,ideaTickets}
    wld: "rg_wld",             // número (opcional, snapshot)
    ideasExp: "rg_ideas_exp",  // timestamp ms de expiración del ticket
    inbox: "rg_inbox",         // [{id,title,body,ts,read:false}]
    inboxSeen: "rg_inbox_seen" // número de vistos para badge
  };

  // ---------- utils ----------
  const WLD_DEC = 18n;
  function wldToDecimals(amountWLD) {
    const [i, f = ""] = String(amountWLD).split(".");
    const frac = (f + "000000000000000000").slice(0, 18);
    return (BigInt(i || "0") * (10n ** WLD_DEC) + BigInt(frac)).toString();
  }
  function now(){ return Date.now(); }
  function jget(k, def=null){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; }catch{ return def; } }
  function jset(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }
  function sset(k, v){ try{ localStorage.setItem(k, String(v)); }catch{} }

  // ---------- audio de entrada ----------
  let joinReady=false, joinFlag=false, joinAud=null;
  function prepJoinAudio(){
    try{
      if (!joinAud) { joinAud = new Audio("/snd/join.mp3"); joinAud.preload="auto"; joinAud.volume=1; }
      const once = ()=>{ if(joinFlag) joinAud.play().catch(()=>{}); joinFlag=false; };
      document.addEventListener("pointerdown", once, { once:true });
      document.addEventListener("touchstart", once, { once:true });
      joinReady = true;
    }catch{}
  }
  function playJoinSoon(){ if(joinReady) joinFlag = true; }

  // ---------- Inbox helpers (badge, demo seed) ----------
  function seedInboxIfEmpty(){
    const list = jget(LS.inbox, []);
    if (!list.length){
      const demo = [
        {id:"n1", title:"¡Bienvenido a RainbowGold!", body:"Explora combos, desafíos y boosters (pronto).", ts: now(), read:false},
        {id:"n2", title:"Ideas abiertas", body:"Compra un ticket (1 WLD) y vota o sugiere por 5 minutos.", ts: now(), read:false}
      ];
      jset(LS.inbox, demo);
      sset(LS.inboxSeen, 0);
    }
  }
  function updateInboxBadge(){
    try{
      const list = jget(LS.inbox, []);
      const seen = Number(localStorage.getItem(LS.inboxSeen) || "0");
      const unread = Math.max(0, list.filter(x=>!x.read).length);
      const badge = document.getElementById("inboxBadge");
      if (badge){
        if (unread>0){ badge.style.display="grid"; badge.textContent=String(unread); }
        else { badge.style.display="none"; }
      }
    }catch{}
  }
  function renderInbox(){
    const cont = document.getElementById("inboxList");
    const list = jget(LS.inbox, []);
    if (!cont) return;
    cont.innerHTML = list.map(n=>`
      <div class="inbox-item">
        <b>${n.title}</b>
        <p style="opacity:.85">${n.body}</p>
        <small style="opacity:.6">${new Date(n.ts).toLocaleString()}</small>
      </div>
    `).join("");
  }
  function markInboxAllRead(){
    const list = jget(LS.inbox, []);
    list.forEach(n=> n.read = true);
    jset(LS.inbox, list);
    sset(LS.inboxSeen, list.length);
    updateInboxBadge();
    renderInbox();
  }

  // ---------- UI post-login ----------
  function postLoginUI(address=""){
    try{
      const splash = document.getElementById("splash");
      const wldState = document.getElementById("wldState");
      if (splash) splash.style.display = "none";
      if (wldState) wldState.style.display = "none";
    }catch{}
    try{
      const btn = document.getElementById("wldSignIn");
      if (btn && address) btn.textContent = `Conectado: ${address.slice(0,6)}…${address.slice(-4)}`;
    }catch{}

    // sesión y perfil
    sset(LS.siweOk, "1");
    sset(LS.siweTs, String(now()));
    if (address) sset(LS.wallet, address);

    const pf = jget(LS.profile, {});
    pf.wallet = address || pf.wallet || "";
    pf.lang = pf.lang || "es";
    pf.name = pf.name || "";
    jset(LS.profile, pf);

    // Inbox demo (si vacío)
    seedInboxIfEmpty();
    updateInboxBadge();

    // iniciar juego
    if (typeof window.__startGame === "function") window.__startGame();
    else if (typeof window.init === "function") window.init();

    // audio de entrada en el próximo toque
    playJoinSoon();

    // refrescar perfil visible
    try { typeof window.refreshProfilePanel === "function" && window.refreshProfilePanel(); } catch{}
  }

  // ---------- restauración al cargar ----------
  document.addEventListener("DOMContentLoaded", () => {
    prepJoinAudio();
    seedInboxIfEmpty();
    updateInboxBadge();
    // sesión válida?
    try{
      const ok = localStorage.getItem(LS.siweOk)==="1";
      const ts = Number(localStorage.getItem(LS.siweTs)||"0");
      if (ok && (now()-ts) < SESSION_MS && isMini()){
        const addr = MK().walletAddress || "";
        postLoginUI(addr);
      }
    }catch{}
  });

  // ---------- login SIWE ----------
  async function login(){
    const mk = MK();
    if (!mk || !mk.isInstalled()) {
      // fallback dev: entra igual para pruebas en web
      postLoginUI("");
      return true;
    }
    try{
      // nonce (opcional backend)
      let nonce="dev";
      try {
        const r = await fetch("/api/nonce"); if (r.ok){ const j=await r.json(); nonce = j.nonce || "dev"; }
      } catch {}
      const { finalPayload } = await mk.commandsAsync.walletAuth({ nonce });
      if (finalPayload?.status === "success"){
        const addr = mk.walletAddress || finalPayload?.address || "";
        postLoginUI(addr);
        // background verification (opcional)
        fetch("/api/complete-siwe", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ payload: finalPayload, nonce }) }).catch(()=>{});
        return true;
      }
    }catch(e){ console.error("login error", e); }
    return false;
  }

  // ---------- Pagos (WLD) ----------
  async function payWLD({ description, wldAmount }, cbName){
    if (!isMini()) return false;
    try{
      // referencia backend (si no hay backend, id local)
      let id = "rg_" + Math.random().toString(36).slice(2,10);
      try{
        const r = await fetch("/api/initiate-payment",{ method:"POST" });
        if (r.ok){ const j = await r.json(); id = j.id || id; }
      }catch{}
      const payload = {
        reference: id,
        to: PAY_TO,
        tokens: [{ symbol: "WLD", token_amount: wldToDecimals(wldAmount) }],
        description,
      };
      const { finalPayload } = await MK().commandsAsync.pay(payload);
      if (finalPayload?.status === "success"){
        fetch("/api/confirm-payment", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ payload: finalPayload }) }).catch(()=>{});
        try { typeof window[cbName] === "function" && window[cbName](); } catch {}
        return true;
      }
    }catch(e){ console.error("pay error", e); }
    return false;
  }

  // reglas de negocio
  async function payRefill(){
    let price = 0.10; // fallback
    try { if (typeof window.priceRefill === "function") price = Number(window.priceRefill()) || 0.10; } catch {}
    const ok = await payWLD({ description: "RainbowGold — Energy Refill", wldAmount: price }, "onEnergyRefilledCb");
    if (ok) {
      try { typeof window.onEnergyRefilled === "function" && window.onEnergyRefilled(); } catch {}
    }
  }
  async function payIdeaTicket(){
    const ok = await payWLD({ description: "RainbowGold — Idea Ticket", wldAmount: 1 }, "onIdeaTicketGranted");
    if (ok){
      // ticket 5 min
      const exp = now() + 5*60*1000;
      sset(LS.ideasExp, String(exp));
      try { typeof window.onIdeaTicketGranted === "function" && window.onIdeaTicketGranted(exp); } catch {}
    }
  }

  // Exponer API pública
  window.RainbowGold = { login, payRefill, payIdeaTicket, updateInboxBadge, markInboxAllRead };

  // Aliases legacy para tus onclick=""
  window.Login = async function(){ return await login(); }
  window.handleRefillPayment = () => payRefill();
  window.handleIdeaPayment   = () => payIdeaTicket();

})();
