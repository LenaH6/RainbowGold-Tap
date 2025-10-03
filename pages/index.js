import Head from "next/head";
import Script from "next/script";

const HTML = `<!-- === SPLASH / CARGA INICIAL === -->
<div id="splash" class="splash" aria-busy="true" aria-label="Cargando RainbowGold">
  <div class="splash__logo">
    <img src="img/logo-splash.png" alt="RainbowGold" data-critical fetchpriority="high" decoding="async">

  </div>

 <button id="wldSignIn" data-i18n="signin_wld"
  onclick="Login()"
  style="margin-top:18px;padding:12px 16px;border-radius:12px;
         background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
         color:#fff;font-weight:700;cursor:pointer">
  Entrar con World ID
</button>

   <div id="wldState" class="splash__hint" style="margin-top:10px;opacity:1;transform:translateY(0)">
  <span data-i18n="preparing_session">Preparando tu sesión</span>
  <span class="dots"><span>.</span><span>.</span><span>.</span></span>
</div>



</div>

<!-- Left FABs -->
<div class="floatCol">
  <button id="profileBtn" class="fab profile" title="Profile">
    <img src="img/icon-profile.png" alt="Perfil" style="width:45px;height:45px;">
  </button>
  <button id="inboxBtn" class="fab inbox" title="Inbox">
    <img src="img/icon-inbox.png" alt="Inbox" style="width:35px;height:35px;">
    <span id="inboxBadge" class="badge" style="display:none">0</span>
  </button>
</div>

<!-- Botón trofeo en top-actions -->
<div class="top-actions" style="overflow:visible">
  <div><span data-i18n="wld_balance">Saldo WLD:</span></div>
  <div><b id="balWLD">0.00</b> WLD</div>

  <!-- WRAP del trofeo: el tip vive junto al botón -->
  <div class="trophyWrap">
    <button id="trophyBtn" class="fab trophy" title="Leaderboard" type="button" aria-describedby="trophyTip">
      <img src="img/icon-trophy.png" alt="Trophy" style="width:25px;height:25px;">
    </button>
    <div id="trophyTip" class="tip" data-i18n="coming_soon">Próximamente</div>
  </div>
  </div>

<!-- HERO -->
<section class="hero">
  <!-- Pastilla de RBGp: SOLO esto adentro -->
  <div class="pill">
    <img src="img/brand-mark-wg-128.png" alt="" onerror="this.style.display='none'">
    RBGp: <b id="balRBGp">0.000</b>
  </div>

  <!-- Moneda (coin) — YA NO va dentro de .pill -->
  <div class="coinWrap" id="coinBox">
    <div class="ring"></div>
    <canvas id="fx"></canvas>

    <div id="coin" class="coin" aria-label="Tap">
      <svg id="windowArc" viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;pointer-events:none;transform:rotate(-90deg);z-index:6">
        <defs>
          <linearGradient id="frenzy777" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stop-color="#ff0055"/>
            <stop offset="20%"  stop-color="#ff9500"/>
            <stop offset="40%"  stop-color="#ffee00"/>
            <stop offset="60%"  stop-color="#33dd55"/>
            <stop offset="80%"  stop-color="#33aaff"/>
            <stop offset="100%" stop-color="#aa66ff"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="none" stroke="#ffd872" stroke-width="4" stroke-linecap="round" pathLength="360"></circle>
      </svg>

      <div id="windowTag"
        style="position:absolute;top:8px;left:50%;transform:translateX(-50%) 
        scale(.9);padding:4px 10px;font-weight:800;font-size:12px;line-height:1;border-radius:12px;border:1px solid 
        rgba(255,255,255,.18);background:rgba(0,0,0,.70);
        color:#ffd872;opacity:0;transition:opacity .14s,transform 
        .18s;pointer-events:none;z-index:999"></div>

      <img src="img/Coin.png" alt="" class="coinImg" onerror="this.remove();document.getElementById('fallback').style.display='block'">
      <div id="fallback" class="coinFallback" style="display:none">🪙</div>

      <div id="gain"
        style="position:absolute; left:0; top:0;
               font-size:14px; font-weight:900; color:#fff;
               text-shadow:0 2px 6px rgba(0,0,0,.55), 0 0 10px rgba(0,0,0,.35);
               pointer-events:none; z-index:1001;">
      </div>

      <div id="hot" style="
        position:absolute; inset:0;
        pointer-events:none; opacity:0; transition:opacity .18s ease;
        filter: drop-shadow(0 0 10px rgba(255,223,120,.25));
      "></div>

      <div id="hotCore" style="
        position:absolute; left:50%; top:50%;
        transform:translate(-50%,-50%);
        width:0; height:0; border-radius:50%;
        pointer-events:none; opacity:0;
        box-shadow: 0 0 6px rgba(0,0,0,.25) inset, 0 0 6px rgba(255,255,255,.15);
      "></div>

      <div id="comboBadge" style="
        position:absolute; top:10px; left:10px;
        background:rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.18);
        color:#ffd872; font-weight:800; font-size:12px;
        padding:4px 8px; border-radius:10px; display:none; pointer-events:none;">
        COMBO x1
      </div>

    <!-- Botón Ideas anclado a la moneda -->
  <button id="ideasBtn" class="idea-btn" aria-label="Ideas" onclick="handleIdeaPayment()">
  <img src="img/icon-idea.png" alt="Ideas" onerror="this.style.display='none'">
</button>
  </div>

  <!-- DOCK bajo la moneda -->
  <div class="action-dock" aria-label="acciones rápidas">
  <button id="refillBtn" class="btn-icon" aria-label="Refill" onclick="handleRefillPayment()">
  <img src="img/ico-refill.png" alt="Perfil" style="width:40px;height:40px;">
  <span id="refillPrice" class="price-pill">0.10 WLD</span>
</button>
    <button id="openUp" class="btn-icon" aria-label="Boosters">
      <img src="img/icon-gear.png" alt="Perfil" style="width:40px;height:35px;">
    </button>
  </div>

  <div class="energyWrap">
    <div class="energyBar"><div id="energyFill" class="energyFill" style="width:100%"></div></div>
    <div class="energyLbl">⚡ <b id="energyNow">100</b>/<b id="energyMax">100</b></div>
  </div>
</section>





<!-- Drawers (Boosters simple + Inbox placeholder+Perfil) -->
<div id="backdropUP" class="backdrop"></div>
<aside id="drawerUP" class="drawer" role="dialog" aria-modal="true">
  <button class="close" aria-label="Cerrar" onclick="closeDrawer('UP')">x</button>
  <h3 data-i18n="boosters_title">Impulsores</h3>
  <p style="opacity:.85" data-i18n="coming_soon">Proximamente... ✔</p>
</aside>


<!-- BUZÓN -->

<div id="backdropIN" class="backdrop"></div>
<aside id="drawerIN" class="drawer" role="dialog" aria-modal="true">
  <button class="close" aria-label="Cerrar" onclick="closeDrawer('IN')">x</button>
<h3 data-i18n="inbox_title" style="margin:0 0 8px">Buzón</h3>
<div id="inboxList" class="inbox-list cardPro"></div>
</aside>

<!-- Drawer IDEAS -->
 <div id="backdropID" class="backdrop"></div>
<aside id="drawerID" class="drawer" role="dialog" aria-modal="true">
  <button class="close" aria-label="Cerrar" onclick="closeDrawer('ID')">x</button>
 <h3 data-i18n="ideas_title">Ideas</h3>


  <!-- Vista inicial: pagar -->
  <div id="ideasPayView" class="cardPro"> 
   <p data-i18n="ideas_pay_intro">¡Sé parte de los desarrolladores y carrera con la comunidad PARTICIPA!</p>
 <button id="payIdeasBtn" class="btn-icon" onclick="handleIdeaPayment()">
  <img src="img/icon-idea.png" alt="pagar" style="width:28px;height:28px;">
  <span data-i18n="ideas_pay_btn">Comprar ticket</span>
  <span class="price-pill"><b>1 WLD 🎟️</b></span>
</button>
</div>


  <!-- Vista desbloqueada: opciones -->
  <div id="ideasOptionsView" class="cardPro" style="display:none">
  <p><b data-i18n="ideas_choose">Escoge una opción</b></p>
  <p id="ticketTimer" style="margin:10px 0;font-size:14px;color:#ffd872;font-weight:bold">
  Tiempo restante: 05:00
  </p>
  <button id="voteBtn" class="btn-icon btnPro"><b data-i18n="vote">Votar✍️</b></button>
  <button id="suggestBtn" class="btn-icon btnPro"><b data-i18n="suggest">Sugerencia💡</b></button>
  <p style="font-size:12px;opacity:.6;margin-top:6px">
  <i data-i18n="each_action_consumes">*Cada acción consume 1 ticket</i>
  </p>

  </div>
  <!-- Vista: Encuesta -->
<div id="ideasPollView" class="cardPro" style="display:none">
<h4 style="margin:6px 0 8px" data-i18n="poll_title">🏁 ¡EMPIEZA LA CARRERA!</h4>
<p class="hint"><b data-i18n="poll_hint">TÚ ELIGES💊</b></p>


  <!-- Opciones -->
  <div style="display:grid; gap:8px; margin:10px 0 12px;">
    <button class="btn" id="pollOptA"><b data-i18n="opt_a">Comodidad/Seguridad🔵</b></button>
<button class="btn" id="pollOptB"><b data-i18n="opt_b">Cambio/Riesgo🔴</b></button>
<button class="btn" id="pollOptC"><b data-i18n="opt_c">Autotap 🤖</b></button>
</div>

  <!-- Resultados (barras simples) -->
  <div id="pollResults" style="display:none; margin-top:10px;">
    <div style="display:flex;align-items:center;gap:8px;margin:6px 0;">
      <span style="width:58px;opacity:.8">A</span>
      <div style="flex:1;background:#0f0e13;border:1px solid #2a2930;border-radius:8px;overflow:hidden;height:10px">
        <div id="barA" style="height:100%;width:0;background:#c9a848"></div>
      </div>
      <span id="pctA" style="width:48px;text-align:right">0%</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin:6px 0;">
      <span style="width:58px;opacity:.8">B</span>
      <div style="flex:1;background:#0f0e13;border:1px solid #2a2930;border-radius:8px;overflow:hidden;height:10px">
        <div id="barB" style="height:100%;width:0;background:#9aa0ff"></div>
      </div>
      <span id="pctB" style="width:48px;text-align:right">0%</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin:6px 0;">
      <span style="width:58px;opacity:.8">C</span>
      <div style="flex:1;background:#0f0e13;border:1px solid #2a2930;border-radius:8px;overflow:hidden;height:10px">
        <div id="barC" style="height:100%;width:0;background:#78d59c"></div>
      </div>
      <span id="pctC" style="width:48px;text-align:right">0%</span>
    </div>
  </div>

  <div style="display:flex;gap:8px;margin-top:12px;">
   <button class="btn" id="pollClose" data-i18n="poll_close">Cerrar</button>
  </div>
</div>

<!-- Vista: Enviar sugerencia -->
<div id="ideasSuggestView" class="cardPro" style="display:none">
  <h4 style="margin:6px 0 8px" data-i18n="suggest_title">¿Alguna idea?</h4>
<p class="hint"><b data-i18n="suggest_hint">Máx. 400 caracteres.</b></p>
<textarea id="suggestText" class="textareaPro" rows="5" maxlength="240"
  data-i18n-placeholder="placeholder_suggest"
  placeholder="Escribe tu idea o mejora aquí…" style="width:100%;"></textarea>

<button class="btn" id="sendSuggestBtn" data-i18n="send">Enviar</button>
<button class="btn" id="sugClose" data-i18n="close">Cerrar</button>

  </div>
</div>


</aside>


<div id="backdropPF" class="backdrop"></div>
<aside id="drawerPF" class="drawer" role="dialog" aria-modal="true">
  <button class="close" aria-label="Cerrar" onclick="closeDrawer('PF')">x</button>
  <h3 data-i18n="profile_title" style="margin:0 0 12px">Perfil</h3>
  <div class="cardPro">


<label data-i18n="username_label" style="display:block;margin-bottom:8px;font-size:14px;">Nombre de usuario</label>
<input id="usernameInput"  class="inputPro" type="text"
  style="width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#222;color:#fff;"
  data-i18n-placeholder="username_placeholder"
  placeholder="Tu nombre">

<label data-i18n="language_label" style="display:block;margin:16px 0 8px;font-size:14px;">Idioma</label>
<select id="langSelect" style="width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#222;color:#fff;">
  <option value="es" data-i18n="option_es">Español</option>
  <option value="en" data-i18n="option_en">Inglés</option>
</select>

<div style="margin:16px 0;">
  <p><span data-i18n="profile_rbgp_label">RBGp:</span> <b id="profRBGp">0.000</b></p>
  <p style="opacity:.7;"><span data-i18n="profile_rbg_label">RBG Balance:</span> <b id="profRBG">--</b> 🔒</p>
  <p style="opacity:.7;"><span data-i18n="profile_wld_label">WLD Balance:</span> <b id="profWLD">--</b> 🔒</p>
</div>

<button id="claimBtn" class="btn-icon" disabled style="opacity:.5;" data-i18n="claim_soon">Reclamar (Pronto)</button>

</aside>`;

export default function IndexPage() {
  return (
   <>
  <Head>
    <title>RainbowGold — App</title>
    <meta charSet="utf-8" />
    <meta
      name="viewport"
      content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no"
    />
    <meta name="theme-color" content="#1b103a" />
  </Head>

  {/* ✅ Corrección aquí */}
  <main dangerouslySetInnerHTML={{ __html: MARKUP }} />

  <Script src="/js/app-legacy.js" strategy="afterInteractive" />
  <Script src="/js/mk-hooks.js" strategy="afterInteractive" />
  <Script type="module" src="/js/main.js" strategy="afterInteractive" />
</>

  );
}