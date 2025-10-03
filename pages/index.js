import Head from "next/head";
import Script from "next/script";

const HTML = `
<div aria-busy="true" aria-label="Cargando RainbowGold" class="splash" id="splash">
  <div class="splash__logo"><img alt="RainbowGold" src="/img/logo-splash.png"/></div>
  <button id="wldSignIn" onclick="Login()" style="margin-top:18px;padding:12px 16px;border-radius:12px;background:rgba(255,255,255,.08);color:#fff;font-weight:700;cursor:pointer">
    Entrar con World ID
  </button>
  <div class="splash__hint" id="wldState" style="margin-top:10px;opacity:1;transform:translateY(0)">
    <span>Preparando tu sesión</span><span class="dots"><span>.</span><span>.</span><span>.</span></span>
  </div>
</div>

<div class="floatCol">
  <button class="fab profile" id="profileBtn" title="Profile"><img alt="Perfil" src="/img/icon-profile.png" style="width:45px;height:45px;"/></button>
  <button class="fab inbox" id="inboxBtn" title="Inbox"><img alt="Inbox" src="/img/icon-inbox.png" style="width:35px;height:35px;"/><span class="badge" id="inboxBadge" style="display:none">0</span></button>
</div>

<div class="top-actions" style="overflow:visible">
  <div><span>Saldo WLD:</span></div>
  <div><b id="balWLD">0.00</b> WLD</div>
  <div class="trophyWrap">
    <button class="fab trophy" id="trophyBtn" title="Leaderboard" type="button">
      <img alt="Trophy" src="/img/icon-trophy.png" style="width:25px;height:25px;"/>
    </button>
    <div class="tip" id="trophyTip">Próximamente</div>
  </div>
</div>

<section class="hero">
  <div class="pill"><img alt="" src="/img/brand-mark-wg-128.png"/> RBGp: <b id="balRBGp">0.000</b></div>

  <div class="coinWrap" id="coinBox">
    <div class="ring"></div>
    <canvas id="fx"></canvas>

    <div class="coin" id="coin">
      <svg id="windowArc" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;pointer-events:none;transform:rotate(-90deg);z-index:6" viewBox="0 0 100 100"><circle cx="50" cy="50" fill="none" pathLength="360" r="46" stroke="#ffd872" strokeLinecap="round" strokeWidth="4"></circle></svg>
      <div id="windowTag" style="position:absolute;top:8px;left:50%;transform:translateX(-50%) scale(.9);padding:4px 10px;font-weight:800;font-size:12px;line-height:1;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.70);color:#ffd872;opacity:0;transition:opacity .14s,transform .18s;pointer-events:none;z-index:999"></div>
      <img alt="" class="coinImg" src="/img/Coin.png"/>
      <div class="coinFallback" id="fallback" style="display:none">🪙</div>
      <div id="gain"></div>
      <div id="hot" style="position:absolute; inset:0; pointer-events:none; opacity:0; transition:opacity .18s ease; filter: drop-shadow(0 0 10px rgba(255,223,120,.25));"></div>
      <div id="hotCore" style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:0; height:0; border-radius:50%; pointer-events:none; opacity:0; box-shadow: 0 0 6px rgba(0,0,0,.25) inset, 0 0 6px rgba(255,255,255,.15);"></div>
      <div id="comboBadge" style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.18); color:#ffd872; font-weight:800; font-size:12px; padding:4px 8px; border-radius:10px; display:none; pointer-events:none;">COMBO x1</div>

      <button aria-label="Ideas" class="idea-btn" id="ideasBtn" onclick="handleIdeaPayment()"><img alt="Ideas" src="/img/icon-idea.png"/></button>
    </div>

    <div class="action-dock">
      <button aria-label="Refill" class="btn-icon" id="refillBtn" onclick="handleRefillPayment()"><img alt="Refill" src="/img/ico-refill.png" style="width:40px;height:40px;"/><span class="price-pill" id="refillPrice">0.10 WLD</span></button>
      <button aria-label="Boosters" class="btn-icon" id="openUp"><img alt="Perfil" src="/img/icon-gear.png" style="width:40px;height:35px;"/></button>
    </div>

    <div class="energyWrap">
      <div class="energyBar"><div class="energyFill" id="energyFill" style="width:100%"></div></div>
      <div class="energyLbl">⚡ <b id="energyNow">100</b>/<b id="energyMax">100</b></div>
    </div>
  </div>
</section>

<div class="backdrop" id="backdropUP"></div>
<aside class="drawer" id="drawerUP" role="dialog">
  <button aria-label="Cerrar" class="close" onclick="closeDrawer('UP')">x</button>
  <h3>Impulsores</h3>
  <p style="opacity:.85">Próximamente... ✔</p>
</aside>

<div class="backdrop" id="backdropIN"></div>
<aside class="drawer" id="drawerIN" role="dialog">
  <button aria-label="Cerrar" class="close" onclick="closeDrawer('IN')">x</button>
  <h3 style="margin:0 0 8px">Buzón</h3>
  <div class="inbox-list cardPro" id="inboxList"></div>
</aside>

<div class="backdrop" id="backdropID"></div>
<aside class="drawer" id="drawerID" role="dialog">
  <button aria-label="Cerrar" class="close" onclick="closeDrawer('ID')">x</button>
  <h3>Ideas</h3>
  <div class="cardPro" id="ideasPayView">
    <p>¡Sé parte de los desarrolladores y corre con la comunidad PARTICIPA!</p>
    <button class="btn-icon" id="payIdeasBtn" onclick="handleIdeaPayment()"><img alt="pagar" src="/img/icon-idea.png" style="width:28px;height:28px;"/><span>Comprar ticket</span><span class="price-pill"><b>1 WLD 🎟️</b></span></button>
  </div>
  <div class="cardPro" id="ideasOptionsView" style="display:none">
    <p><b>Escoge una opción</b></p>
    <p id="ticketTimer" style="margin:10px 0;font-size:14px;color:#ffd872;font-weight:bold">Tiempo restante: 05:00</p>
    <button class="btn-icon btnPro" id="voteBtn"><b>Votar✍️</b></button>
    <button class="btn-icon btnPro" id="suggestBtn"><b>Sugerencia💡</b></button>
    <p style="font-size:12px;opacity:.6;margin-top:6px"><i>*Cada acción consume 1 ticket</i></p>
  </div>
  <div class="cardPro" id="ideasPollView" style="display:none">
    <h4 style="margin:6px 0 8px">🏁 ¡EMPIEZA LA CARRERA!</h4>
    <p class="hint"><b>TÚ ELIGES💊</b></p>
    <div style="display:grid; gap:8px; margin:10px 0 12px;">
      <button class="btn" id="pollOptA"><b>Comodidad/Seguridad🔵</b></button>
      <button class="btn" id="pollOptB"><b>Cambio/Riesgo🔴</b></button>
      <button class="btn" id="pollOptC"><b>Autotap 🤖</b></button>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button class="btn" id="pollClose">Cerrar</button>
    </div>
  </div>
  <div class="cardPro" id="ideasSuggestView" style="display:none">
    <h4 style="margin:6px 0 8px">¿Alguna idea?</h4>
    <p class="hint"><b>Máx. 100 caracteres.</b></p>
    <textarea class="textareaPro" id="suggestText" maxlength="100" placeholder="Escribe tu idea o mejora aquí…" rows="5" style="width:100%;"></textarea>
    <button class="btn" id="sendSuggestBtn">Enviar</button>
    <button class="btn" id="sugClose" onclick="closeDrawer('ID')">Cerrar</button>
  </div>
</aside>

<div class="backdrop" id="backdropPF"></div>
<aside class="drawer" id="drawerPF" role="dialog">
  <button aria-label="Cerrar" class="close" onclick="closeDrawer('PF')">x</button>
  <h3 style="margin:0 0 12px">Perfil</h3>
  <div class="cardPro">
    <label style="display:block;margin-bottom:8px;font-size:14px;">Nombre de usuario</label>
    <input class="inputPro" id="usernameInput" placeholder="Tu nombre" style="width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#222;color:#fff;" type="text"/>
    <label style="display:block;margin:16px 0 8px;font-size:14px;">Idioma</label>
    <select id="langSelect" style="width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#222;color:#fff;">
      <option value="es">Español</option>
      <option value="en">Inglés</option>
    </select>
    <div style="margin:16px 0;">
      <p>RBGp: <b id="profRBGp">0.000</b></p>
      <p style="opacity:.7;">RBG Balance: <b id="profRBG">--</b> 🔒</p>
      <p style="opacity:.7;">WLD Balance: <b id="profWLD">--</b> 🔒</p>
    </div>
    <button class="btn-icon" disabled style="opacity:.5;">Reclamar (Pronto)</button>
  </div>
</aside>
`;

export default function IndexPage() {
  return (
    <>
      <Head>
        <title>RainbowGold — App</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no" />
        <meta name="theme-color" content="#1b103a" />
      </Head>

      <main dangerouslySetInnerHTML={{ __html: HTML }} />

      <Script src="/js/app-legacy.js" strategy="afterInteractive" />
      <Script src="/js/mk-hooks.js"  strategy="afterInteractive" />
      <Script type="module" src="/js/main.js" strategy="afterInteractive" />
    </>
  );
}
