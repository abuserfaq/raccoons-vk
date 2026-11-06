// Telegram Mini App adapter. Loaded after platform.js; overrides window.Platform when Telegram.WebApp is present.
// Ads: Adsgram rewarded stub (disabled until window.TG_ADSGRAM_BLOCK is set). No interstitials.
(function(){
const W=window, TW=W.Telegram&&W.Telegram.WebApp;
if(!TW)return;
const tryf=(f,d)=>{try{return f()}catch(e){return d}};
const DARK='#07041a';

// Force dark Telegram chrome (Desktop light theme otherwise leaves white letterbox bars)
function applyChrome(){
  tryf(()=>TW.setHeaderColor&&TW.setHeaderColor(DARK));
  tryf(()=>TW.setBackgroundColor&&TW.setBackgroundColor(DARK));
  tryf(()=>TW.setBottomBarColor&&TW.setBottomBarColor(DARK));
  const r=document.documentElement, b=document.body;
  if(r){ r.style.background=DARK; r.style.backgroundColor=DARK; }
  if(b){ b.style.background=DARK; b.style.backgroundColor=DARK; }
}
applyChrome();

TW.ready();
tryf(()=>TW.expand());
// Bot API 8+: fullscreen + disable vertical swipes. Do NOT lock landscape orientation —
// we CSS-rotate #root for portrait Mini Apps; locking the WebView fights that and yields a black screen.
if(TW.isVersionAtLeast&&TW.isVersionAtLeast('8.0')){
  tryf(()=>TW.requestFullscreen&&TW.requestFullscreen());
  tryf(()=>TW.disableVerticalSwipes&&TW.disableVerticalSwipes());
}
applyChrome();

const theme=()=>{ applyChrome();
  const s=TW.themeParams||{}, r=document.documentElement;
  if(s.button_color)r.style.setProperty('--tg-btn',s.button_color);
  if(s.text_color)r.style.setProperty('--tg-fg',s.text_color);
  r.style.setProperty('--tg-bg', DARK);
};
theme(); TW.onEvent&&TW.onEvent('themeChanged',theme);

// Inject TG shell CSS (dark fill, no white gaps). Safe-area handled in layout(), not padding.
if(!document.getElementById('tg-shell-css')){
  const st=document.createElement('style'); st.id='tg-shell-css';
  st.textContent='html,body,#root{background:'+DARK+'!important;background-color:'+DARK+'!important;}'+
    'html,body{overscroll-behavior:none;touch-action:none;}'+
    '#root{min-width:1px;min-height:1px;}'+
    '#root.tg-rot{overflow:hidden;background:'+DARK+'!important;}'+
    '#bannerStrip{display:none!important;}';
  (document.head||document.documentElement).appendChild(st);
}

const BOT='raccoons_fire_bot', APP='play';
const APP_LINK='https://t.me/'+BOT+'/'+APP;
const BASE=(W.Net&&W.Net.BASE)||'https://d5dkao4fh5oe83poui3n.d8epmcec.apigw.yandexcloud.net';
const GAME='raccoons_art';
const GPI={gems_80:{gems:80},gems_250:{gems:250},gems_700:{gems:700}};
const ITEMS=[
  ['gems_80','80 кристаллов',50,'gem'],
  ['gems_250','250 кристаллов',100,'gem'],
  ['gems_700','700 кристаллов',250,'gem'],
];

let tgRc={}, cloudT=0;
const uid=()=>{ const u=TW.initDataUnsafe&&TW.initDataUnsafe.user; return u&&u.id?String(u.id):''; };
const uname=()=>{ const u=TW.initDataUnsafe&&TW.initDataUnsafe.user; if(!u)return '';
  return ((u.first_name||'')+' '+(u.last_name||'')).trim()||(u.username?('@'+u.username):''); };

function cloudPull(){
  tryf(()=>{
    const CS=TW.CloudStorage; if(!CS||typeof CS.getItem!=='function')return;
    CS.getItem('ra_save',(e,v)=>{ if(e||!v)return;
      const local=tryf(()=>localStorage.getItem('ra_save'),null);
      if(!local) tryf(()=>localStorage.setItem('ra_save',v));
    });
  });
}
function cloudPush(v){
  tryf(()=>{
    const CS=TW.CloudStorage; if(!CS||typeof CS.setItem!=='function')return;
    clearTimeout(cloudT); cloudT=setTimeout(()=>tryf(()=>CS.setItem('ra_save',String(v),()=>{})),800);
  });
}
tryf(cloudPull);
(function(){ const sI=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){ sI.call(this,k,v); if(this===W.localStorage&&k==='ra_save')cloudPush(v); };
})();

tryf(()=>{ const BB=TW.BackButton; if(!BB)return;
  BB.show(); BB.onClick(()=>{ try{ if(W.__tgBack)return W.__tgBack(); }catch(e){}
    tryf(()=>TW.close()); });
});

const hap=(t)=>{ tryf(()=>{ const H=TW.HapticFeedback; if(!H)return;
  if(t==='success')H.notificationOccurred('success');
  else if(t==='error')H.notificationOccurred('error');
  else H.impactOccurred('light'); }); };

const AG_BLOCK=W.TG_ADSGRAM_BLOCK||'';
let agReady=false, agBusy=false;
function agLoad(){ if(!AG_BLOCK||agReady)return Promise.resolve(!!AG_BLOCK&&!!W.Adsgram);
  return new Promise(res=>{ const s=document.createElement('script'); s.src='https://sad.adsgram.ai/js/sad.min.js'; s.async=true;
    s.onload=()=>{agReady=true;res(!!W.Adsgram)}; s.onerror=()=>res(false); document.head.appendChild(s); }); }

/* ---- Viewport / portrait-rotate layout ----
   Game is landscape 960×490. In a portrait Mini App we CSS-rotate #root 90° CW so the
   landscape stage fills the screen, and remap pointer coords for canvas hit-testing. */
const L={rot:false, ox:0, oy:0, sw:0, sh:0, k:1, AW:960, offX:0, offY:0};

function insets(){
  const sai=TW.safeAreaInset||{}, cai=TW.contentSafeAreaInset||{};
  return {
    top:(sai.top|0)+(cai.top|0),
    bottom:(sai.bottom|0)+(cai.bottom|0),
    left:(sai.left|0)+(cai.left|0),
    right:(sai.right|0)+(cai.right|0),
  };
}
function contentBox(){
  const ins=insets();
  const vw=TW.viewportWidth||innerWidth;
  const vh=TW.viewportStableHeight||TW.viewportHeight||innerHeight;
  const sw=Math.max(1, Math.round(vw-ins.left-ins.right));
  const sh=Math.max(1, Math.round(vh-ins.top-ins.bottom));
  return {ox:ins.left, oy:ins.top, sw, sh, vw, vh};
}

function screenToRoot(sx, sy){
  // Inverse of: translate(ox+sw, oy) rotate(90deg)  with origin top-left
  // forward: (lx,ly) -> (ox+sw-ly, oy+lx)
  if(!L.rot) return {x:sx-L.ox, y:sy-L.oy};
  return {x:sy-L.oy, y:L.ox+L.sw-sx};
}
function rootToGame(rx, ry){
  // app: transform-origin 0 0; translate(offX,offY) scale(k)
  const x=(rx-L.offX)/L.k;
  const y=(ry-L.offY)/L.k;
  return {x, y};
}

function applyRootBox(root, box, portrait, stageW, stageH){
  // Always clear stylesheet right/bottom so fixed+width are not stretched to viewport.
  const base='position:fixed;left:0;top:0;right:auto;bottom:auto;overflow:hidden;background:'+DARK+';transform-origin:0 0;';
  if(portrait){
    root.classList.add('tg-rot');
    root.style.cssText=base+'width:'+stageW+'px;height:'+stageH+'px;'+
      'transform:translate('+(box.ox+box.sw)+'px,'+box.oy+'px) rotate(90deg);';
  }else{
    root.classList.remove('tg-rot');
    root.style.cssText=base+'left:'+box.ox+'px;top:'+box.oy+'px;width:'+stageW+'px;height:'+stageH+'px;transform:none;';
  }
}

function letterboxNoRotate(root, app, setAW, box){
  // Safe fallback: no CSS rotate — scale 960×490 into the content box (may letterbox).
  L.rot=false; L.ox=box.ox; L.oy=box.oy; L.sw=box.sw; L.sh=box.sh;
  const stageW=box.sw, stageH=box.sh;
  const k=Math.max(0.05, stageW/stageH>=960/490?stageH/490:stageW/960);
  const AW=Math.round(Math.max(960, stageW/k));
  const offX=(stageW-AW*k)/2, offY=(stageH-490*k)/2;
  L.k=k; L.AW=AW; L.offX=offX; L.offY=offY; setAW(AW);
  applyRootBox(root, box, false, stageW, stageH);
  app.style.width=AW+'px';
  app.style.transform='translate('+offX+'px,'+offY+'px) scale('+k+')';
  app._k=k;
}

function tgLayout(ctx){
  const {app, root, strip, cur, battle, bcv, fitCanvas, fitTop, setAW}=ctx;
  try{
    applyChrome();
    const box=contentBox();
    // If Telegram reports absurd sizes, fall back to window
    if(box.sw<32||box.sh<32){ box.sw=Math.max(32,innerWidth|0); box.sh=Math.max(32,innerHeight|0); box.ox=0; box.oy=0; }
    const portrait=box.sw<box.sh;
    L.rot=portrait;
    L.ox=box.ox; L.oy=box.oy; L.sw=box.sw; L.sh=box.sh;

    const stageW=portrait?box.sh:box.sw;
    const stageH=portrait?box.sw:box.sh;
    let k=stageW/stageH>=960/490?stageH/490:stageW/960;
    if(!(k>0.05&&isFinite(k))) k=0.2;
    const AW=Math.round(Math.max(960, stageW/k));
    const offX=(stageW-AW*k)/2, offY=(stageH-490*k)/2;
    L.k=k; L.AW=AW; L.offX=offX; L.offY=offY;
    setAW(AW);

    if(strip) strip.style.display='none';
    applyRootBox(root, box, portrait, stageW, stageH);
    app.style.width=AW+'px';
    app.style.transform='translate('+offX+'px,'+offY+'px) scale('+k+')';
    app._k=k;

    // If the scaled app ended up invisible / off-screen, drop CSS-rotate and letterbox.
    try{
      const ar=app.getBoundingClientRect();
      const vr=Math.max(innerWidth,1)*Math.max(innerHeight,1);
      const visible=ar.width>8&&ar.height>8&&ar.right>4&&ar.bottom>4&&ar.left<innerWidth-4&&ar.top<innerHeight-4;
      if(!visible || (ar.width*ar.height)<vr*0.02){ letterboxNoRotate(root, app, setAW, box); }
    }catch(e){ letterboxNoRotate(root, app, setAW, box); }

    const bannerOn=cur!=='consent'&&cur!=='consentSet';
    const bh=bannerOn?Math.ceil(tg.ads.slot(50)/(app._k||k))+4:0;
    app.style.setProperty('--bh',bh+'px');
    app.style.setProperty('--bw',Math.ceil(330/(app._k||k))+'px');
    const Sref=W.S;
    tg.ads.banner(bannerOn&&Sref&&Sref.consent!=null&&!(tg.id==='gamepush'&&cur==='battle'));
    if(battle&&bcv) fitCanvas(bcv);
    if(cur) fitTop();
  }catch(e){
    // Last resort: plain letterbox so the user never stays on a black screen
    try{ letterboxNoRotate(root, app, setAW, {ox:0,oy:0,sw:Math.max(32,innerWidth),sh:Math.max(32,innerHeight)}); }catch(e2){}
  }
}

function tgPt(e, _canvas, logicalH){
  // App-local coords (0..AW, 0..490) — same space as stock battle pt().
  // Base-screen callers subtract (AW-960)/2 themselves for world centering.
  const r=screenToRoot(e.clientX, e.clientY);
  const g=rootToGame(r.x, r.y);
  return {x:g.x, y:g.y};
}

const tg={
  id:'telegram', canSign:()=>false, sign:()=>'',
  user:uid()?{id:uid(),name:uname()}:null,
  initData:TW.initData||'', launch:TW.initDataUnsafe||{}, launchQS:'',
  social:{
    name:'Telegram', cur:'⭐', noFriends:true, items:ITEMS.slice(),
    ready:()=>Promise.resolve(!!(TW.initData&&TW.openInvoice)),
    pay:key=>new Promise(async res=>{
      if(!TW.initData||!TW.openInvoice){res(false);return;}
      if(!GPI[key]){res(false);return;}
      hap('light');
      let j; try{
        const r=await fetch(BASE+'/tg/invoice/'+GAME,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({initData:TW.initData,item:key})});
        j=await r.json();
      }catch(e){res(false);return;}
      if(!j||!j.url){res(false);return;}
      TW.openInvoice(j.url, st=>{ hap(st==='paid'?'success':'error'); res(st==='paid'); });
    }),
    share:()=>{ const link=APP_LINK+'?startapp=ref_'+(uid()||'0');
      if(TW.switchInlineQuery){ tryf(()=>TW.switchInlineQuery('Играй в Еноты: Огонь по базе! '+link,['users','groups','channels'])); return; }
      if(TW.openTelegramLink) tryf(()=>TW.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent('Командуй енотами-артиллеристами!')));
      else if(navigator.share) navigator.share({text:'Играй в Еноты: Огонь по базе! '+link}).catch(()=>{});
    },
    support:'https://t.me/'+BOT,
  },
  event:(n,o)=>{}, setConsent:()=>{},
  rcInt:(k,d)=>k in tgRc?(tgRc[k]|0):d, rcBool:(k,d)=>k in tgRc?!!tgRc[k]:d,
  ads:{
    slot:def=>0,
    banner:()=>{},
    noDemo:true,
    rewardedAvail:()=>!!(AG_BLOCK&&W.Adsgram&&!agBusy),
    noAdMsg:'Реклама пока недоступна',
    showRewarded:k=>{ if(!AG_BLOCK){W.__adResult&&W.__adResult(k,false);return;}
      agLoad().then(ok=>{ if(!ok||!W.Adsgram){W.__adResult&&W.__adResult(k,false);return;}
        try{ const c=W.Adsgram.init({blockId:AG_BLOCK}); agBusy=true;
          c.show().then(r=>{agBusy=false;W.__adResult&&W.__adResult(k,!!(r&&r.done));})
           .catch(()=>{agBusy=false;W.__adResult&&W.__adResult(k,false);});
        }catch(e){agBusy=false;W.__adResult&&W.__adResult(k,false);}
      }); },
    interstitialOn:()=>false,
    showInterstitial:()=>{},
  },
  push:{avail:()=>false,setCats:()=>{},setReminders:()=>{},ask:()=>{},token:()=>'',takeOpen:()=>null},
  auth:{vkAvail:()=>false,vkLogin:()=>{},yaAvail:()=>false,yaLogin:()=>{}},
  levelEnd:()=>{},
  setRc:o=>{tgRc=o||{}},
  setShop:sh=>{ if(!sh||!Array.isArray(sh.tg))return;
    const map=(list)=>(list||[]).filter(i=>i&&i.id&&+i.price>0).map(i=>[String(i.id),String(i.title||i.id),+i.price,/^coins/.test(i.id)?'coin':'gem']);
    const m=map(sh.tg); if(m.length)tg.social.items=m; },
  layout:tgLayout,
  pt:tgPt,
};

W.Platform=tg;
(function(P){const cut=v=>String(v||'').slice(0,60);
 P.STORE_URL=APP_LINK;
 P.deviceInfo=()=>{const n=navigator,ua=n.userAgent||'',m=ua.match(/Android [\d.]+|iPhone OS [\d_]+|Windows NT [\d.]+|Mac OS X [\d_.]+|Linux|CrOS/);
  return {lang:cut((TW.initDataUnsafe&&TW.initDataUnsafe.user&&TW.initDataUnsafe.user.language_code)||(navigator.language||'ru').slice(0,5)),
    platform:'telegram',model:cut((n.userAgentData&&n.userAgentData.platform)||n.platform||''),
    os:cut(m?m[0].replace(/_/g,'.'):''),device:cut(/Mobi|Android|iPhone/.test(ua)?'mobile':'desktop')};};
 P.canShare=()=>true;
 P.share=t=>{ const link=APP_LINK+'?startapp=ref_'+(uid()||'0'); const text=(t||'Играй в Еноты: Огонь по базе!')+' '+link;
   if(TW.switchInlineQuery)tryf(()=>TW.switchInlineQuery(text,['users','groups','channels']));
   else if(TW.openTelegramLink)tryf(()=>TW.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(t||'Командуй енотами!')));
   else if(navigator.share)navigator.share({text}).catch(()=>{}); };
 P.canRate=()=>false; P.rate=()=>{}; P.openStore=()=>tryf(()=>TW.openTelegramLink&&TW.openTelegramLink(APP_LINK));
 P.haptic=hap;
})(tg);

tryf(()=>{ const sp=TW.initDataUnsafe&&TW.initDataUnsafe.start_param; if(sp&&/^ref_/.test(sp)) tryf(()=>sessionStorage.setItem('ra_ref',sp.slice(4))); });

// ---------- tApps Center Analytics (@telegram-apps/analytics) ----------
// Token + appName come from TON Builders → Analytics tab (builders.ton.org).
// Wire via window.__TGA_CONFIG = { token, appName } OR Platform.setAnalytics({token,appName}).
// Until configured, SDK is not initialized (catalog requirement stays gated on user-provided secrets).
(function(){
  let inited=false;
  function bootAnalytics(cfg){
    if(inited||!cfg||!cfg.token||!cfg.appName)return;
    const run=()=>{
      try{
        const api=W.telegramAnalytics||W.TelegramAnalytics;
        if(!api||typeof api.init!=='function')return false;
        api.init({token:String(cfg.token), appName:String(cfg.appName)});
        inited=true; return true;
      }catch(e){return false;}
    };
    if(run())return;
    // script may still be loading
    let n=0; const tmr=setInterval(()=>{ if(run()||++n>40)clearInterval(tmr); },250);
  }
  W.__tgaBoot=bootAnalytics;
  tg.setAnalytics=bootAnalytics;
  // Prefer explicit config; also accept remote-config keys once Net loads (game.js hooks)
  try{ if(W.__TGA_CONFIG) bootAnalytics(W.__TGA_CONFIG); }catch(e){}
})();



// Re-layout on Telegram viewport / safe-area / fullscreen changes
const relayout=()=>{ applyChrome();
  tryf(()=>W.dispatchEvent(new Event('resize')));
};
['viewportChanged','safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'].forEach(ev=>{
  tryf(()=>TW.onEvent&&TW.onEvent(ev, relayout));
});
// Retry fullscreen a couple of times — Desktop sometimes ignores the first call before expand settles
setTimeout(()=>{ if(TW.isVersionAtLeast&&TW.isVersionAtLeast('8.0')&&!TW.isFullscreen)
  tryf(()=>TW.requestFullscreen&&TW.requestFullscreen()); applyChrome(); relayout(); }, 400);
setTimeout(()=>{ if(TW.isVersionAtLeast&&TW.isVersionAtLeast('8.0')&&!TW.isFullscreen)
  tryf(()=>TW.requestFullscreen&&TW.requestFullscreen()); applyChrome(); }, 1200);

W.__tgPlatform=tg;
W.__tgLayoutState=L;
})();
