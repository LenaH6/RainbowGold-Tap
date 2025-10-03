import Head from "next/head";
import Script from "next/script";

export default function IndexPage() {
  return (
    <>
      <Head>
        <title>RainbowGold — App</title>
        <meta charset="utf-8"/><meta content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1,user-scalable=no" name="viewport"/><meta content="#1b103a" name="theme-color"/>
      </Head>

      <main dangerouslySetInnerHTML={{ __html: `
<!-- === SPLASH / CARGA INICIAL === -->
<div aria-busy="true" aria-label="Cargando RainbowGold" class="splash" id="splash">
<div class="splash__logo">
<img alt="RainbowGold" data-critical="" decoding="async" fetchpriority="high" src="img/logo-splash.png"/>
</div>
<button data-i18n="signin_wld" id="wldSignIn" onclick="Login()" style="margin-top:18px;padding:12px 16px;border-radius:12px;
         background:linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.04));
         color:#fff;font-weight:700;cursor:pointer">
  Entrar con World ID
</button>
<div class="splash__hint" id="wldState" style="margin-top:10px;opacity:1;transform:translateY(0)">
<span data-i18n="preparing_session">Preparando tu sesión</span>
<span class="dots"><span>.</span><span>.</span><span>.</span></span>
</div>
</div>
<!-- Left FABs -->
<div class="floatCol">
<button class="fab profile" id="profileBtn" title="Profile">
<img alt="Perfil" src="img/icon-profile.png" style="width:45px;height:45px;"/>
</button>
<button class="fab inbox" id="inboxBtn" title="Inbox">
<img alt="Inbox" src="img/icon-inbox.png" style="width:35px;height:35px;"/>
<span class="badge" id="inboxBadge" style="display:none">0</span>
</button>
</div>
<!-- Botón trofeo en top-actions -->
<div class="top-actions" style="overflow:visible">
<div><span data-i18n="wld_balance">Saldo WLD:</span></div>
<div><b id="balWLD">0.00</b> WLD</div>
<!-- WRAP del trofeo: el tip vive junto al botón -->
<div class="trophyWrap">
<button aria-describedby="trophyTip" class="fab trophy" id="trophyBtn" title="Leaderboard" type="button">
<img alt="Trophy" src="img/icon-trophy.png" style="width:25px;height:25px;"/>
</button>
<div class="tip" data-i18n="coming_soon" id="trophyTip">Próximamente</div>
</div>
</div>
<!-- HERO -->
<section class="hero">
<!-- Pastilla de RBGp: SOLO esto adentro -->
<div class="pill">
<img alt="" onerror="this.style.display='none'" src="img/brand-mark-wg-128.png"/>
    RBGp: <b id="balRBGp">0.000</b>
</div>
<!-- Moneda (coin) — YA NO va dentro de .pill -->
<div class="coinWrap" id="coinBox">
<div class="ring"></div>
<canvas id="fx"></canvas>
<div aria-label="Tap" class="coin" id="coin">
<svg id="windowArc" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;pointer-events:none;transform:rotate(-90deg);z-index:6" viewbox="0 0 100 100">
<defs>
<lineargradient id="frenzy777" x1="0" x2="1" y1="0" y2="1">
<stop offset="0%" stop-color="#ff0055"></stop>
<stop offset="20%" stop-color="#ff9500"></stop>
<stop offset="40%" stop-color="#ffee00"></stop>
<stop offset="60%" stop-color="#33dd55"></stop>
<stop offset="80%" stop-color="#33aaff"></stop>
<stop offset="100%" stop-color="#aa66ff"></stop>
</lineargradient>
</defs>
<circle cx="50" cy="50" fill="none" pathlength="360" r="46" stroke="#ffd872" stroke-linecap="round" stroke-width="4"></circle>
</svg>
<div id="windowTag" style="position:absolute;top:8px;left:50%;transform:translateX(-50%) 
        scale(.9);padding:4px 10px;font-weight:800;font-size:12px;line-height:1;border-radius:12px;border:1px solid 
        rgba(255,255,255,.18);background:rgba(0,0,0,.70);
        color:#ffd872;opacity:0;transition:opacity .14s,transform 
        .18s;pointer-events:none;z-index:999"></div>
<img alt="" class="coinImg" onerror="this.remove();document.getElementById('fallback').style.display='block'" src="img/Coin.png"/>
<div class="coinFallback" id="fallback" style="display:none">🪙</div>
<div id="gain" style="position:absolute; left:0; top:0;
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
<button aria-label="Ideas" class="idea-btn" id="ideasBtn" onclick="handleIdeaPayment()">
<img alt="Ideas" onerror="this.style.display='none'" src="img/icon-idea.png"/>
</button>
</div>
<!-- DOCK bajo la moneda -->
<div aria-label="acciones rápidas" class="action-dock">
<button aria-label="Refill" class="btn-icon" id="refillBtn" onclick="handleRefillPayment()">
<img alt="Perfil" src="img/ico-refill.png" style="width:40px;height:40px;"/>
<span class="price-pill" id="refillPrice">0.10 WLD</span>
</button>
<button aria-label="Boosters" class="btn-icon" id="openUp">
<img alt="Perfil" src="img/icon-gear.png" style="width:40px;height:35px;"/>
</button>
</div>
<div class="energyWrap">
<div class="energyBar"><div class="energyFill" id="energyFill" style="width:100%"></div></div>
<div class="energyLbl">⚡ <b id="energyNow">100</b>/<b id="energyMax">100</b></div>
</div>
</div></section>
<!-- Drawers (Boosters simple + Inbox placeholder+Perfil) -->
<div class="backdrop" id="backdropUP"></div>
<aside aria-modal="true" class="drawer" id="drawerUP" role="dialog">
<button aria-label="Cerrar" class="close" onclick="closeDrawer('UP')">x</button>
<h3 data-i18n="boosters_title">Impulsores</h3>
<p data-i18n="coming_soon" style="opacity:.85">Proximamente... ✔</p>
</aside>
<!-- BUZÓN -->
<div class="backdrop" id="backdropIN"></div>
<aside aria-modal="true" class="drawer" id="drawerIN" role="dialog">
<button aria-label="Cerrar" class="close" onclick="closeDrawer('IN')">x</button>
<h3 data-i18n="inbox_title" style="margin:0 0 8px">Buzón</h3>
<div class="inbox-list cardPro" id="inboxList"></div>
</aside>
<!-- Drawer IDEAS -->
<div class="backdrop" id="backdropID"></div>
<aside aria-modal="true" class="drawer" id="drawerID" role="dialog">
<button aria-label="Cerrar" class="close" onclick="closeDrawer('ID')">x</button>
<h3 data-i18n="ideas_title">Ideas</h3>
<!-- Vista inicial: pagar -->
<div class="cardPro" id="ideasPayView">
<p data-i18n="ideas_pay_intro">¡Sé parte de los desarrolladores y carrera con la comunidad PARTICIPA!</p>
<button class="btn-icon" id="payIdeasBtn" onclick="handleIdeaPayment()">
<img alt="pagar" src="img/icon-idea.png" style="width:28px;height:28px;"/>
<span data-i18n="ideas_pay_btn">Comprar ticket</span>
<span class="price-pill"><b>1 WLD 🎟️</b></span>
</button>
</div>
<!-- Vista desbloqueada: opciones -->
<div class="cardPro" id="ideasOptionsView" style="display:none">
<p><b data-i18n="ideas_choose">Escoge una opción</b></p>
<p id="ticketTimer" style="margin:10px 0;font-size:14px;color:#ffd872;font-weight:bold">
  Tiempo restante: 05:00
  </p>
<button class="btn-icon btnPro" id="voteBtn"><b data-i18n="vote">Votar✍️</b></button>
<button class="btn-icon btnPro" id="suggestBtn"><b data-i18n="suggest">Sugerencia💡</b></button>
<p style="font-size:12px;opacity:.6;margin-top:6px">
<i data-i18n="each_action_consumes">*Cada acción consume 1 ticket</i>
</p>
</div>
<!-- Vista: Encuesta -->
<div class="cardPro" id="ideasPollView" style="display:none">
<h4 data-i18n="poll_title" style="margin:6px 0 8px">🏁 ¡EMPIEZA LA CARRERA!</h4>
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
<button class="btn" data-i18n="poll_close" id="pollClose">Cerrar</button>
</div>
</div>
<!-- Vista: Enviar sugerencia -->
<div class="cardPro" id="ideasSuggestView" style="display:none">
<h4 data-i18n="suggest_title" style="margin:6px 0 8px">¿Alguna idea?</h4>
<p class="hint"><b data-i18n="suggest_hint">Máx. 400 caracteres.</b></p>
<textarea class="textareaPro" data-i18n-placeholder="placeholder_suggest" id="suggestText" maxlength="240" placeholder="Escribe tu idea o mejora aquí…" rows="5" style="width:100%;"></textarea>
<button class="btn" data-i18n="send" id="sendSuggestBtn">Enviar</button>
<button class="btn" data-i18n="close" id="sugClose">Cerrar</button>
</div>

</aside>
<div class="backdrop" id="backdropPF"></div>
<aside aria-modal="true" class="drawer" id="drawerPF" role="dialog">
<button aria-label="Cerrar" class="close" onclick="closeDrawer('PF')">x</button>
<h3 data-i18n="profile_title" style="margin:0 0 12px">Perfil</h3>
<div class="cardPro">
<label data-i18n="username_label" style="display:block;margin-bottom:8px;font-size:14px;">Nombre de usuario</label>
<input class="inputPro" data-i18n-placeholder="username_placeholder" id="usernameInput" placeholder="Tu nombre" style="width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#222;color:#fff;" type="text"/>
<label data-i18n="language_label" style="display:block;margin:16px 0 8px;font-size:14px;">Idioma</label>
<select id="langSelect" style="width:100%;padding:8px;border-radius:8px;border:1px solid #555;background:#222;color:#fff;">
<option data-i18n="option_es" value="es">Español</option>
<option data-i18n="option_en" value="en">Inglés</option>
</select>
<div style="margin:16px 0;">
<p><span data-i18n="profile_rbgp_label">RBGp:</span> <b id="profRBGp">0.000</b></p>
<p style="opacity:.7;"><span data-i18n="profile_rbg_label">RBG Balance:</span> <b id="profRBG">--</b> 🔒</p>
<p style="opacity:.7;"><span data-i18n="profile_wld_label">WLD Balance:</span> <b id="profWLD">--</b> 🔒</p>
</div>
<button class="btn-icon" data-i18n="claim_soon" disabled="" id="claimBtn" style="opacity:.5;">Reclamar (Pronto)</button>
</div></aside>

` }} />

      <Script src="/src/app-legacy.js" strategy="afterInteractive" />
      <Script type="module" src="/src/main.js" strategy="afterInteractive" />
    </>
  );
}
