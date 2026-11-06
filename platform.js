// Platform layer: one interface for the game, adapters per platform.
//  android — Kotlin WebView wrapper bridges (AdBridge / AppBridge / PushBridge / RuStore)
//  web     — browser build (future web version): simulated ads, no native push, no game key (online read-only until a web
//            adapter for the portal SDK — VK Play / Яндекс Игры / OK — supplies auth + signing).
// Game code must only use window.Platform, never the bridges directly.
(function(){
const W=window, A=W.AdBridge, B=W.AppBridge, P=W.PushBridge;
const tryf=(f,d)=>{try{return f()}catch(e){return d}};
const android={
  id:'android',
  canSign:()=>!!(B&&B.gsig),
  sign:p=>tryf(()=>B.gsig(p),''),
  event:(n,o)=>tryf(()=>B&&B.event&&B.event(n,JSON.stringify(o||{}))),
  setConsent:(stats,pers)=>{tryf(()=>B&&B.setConsent&&B.setConsent(!!stats));tryf(()=>A&&A.setConsent&&A.setConsent(!!pers));},
  rcInt:(k,d)=>tryf(()=>B&&B.rcInt?B.rcInt(k,d):d,d),
  rcBool:(k,d)=>tryf(()=>B&&B.rcBool?B.rcBool(k,d):d,d),
  ads:{
    slot:def=>tryf(()=>A&&A.slotDp?A.slotDp():def,def),
    banner:on=>tryf(()=>A&&A.banner&&A.banner(!!on)),
    rewardedAvail:()=>tryf(()=>!!(A&&A.showRewarded&&A.enabled&&A.enabled()),false),
    showRewarded:k=>tryf(()=>A.showRewarded(k)),
    interstitialOn:()=>tryf(()=>!!(A&&A.interstitialEnabled&&A.interstitialEnabled()),false),
    showInterstitial:()=>tryf(()=>A.showInterstitial()),
  },
  push:{
    avail:()=>!!P,
    setCats:o=>tryf(()=>P&&P.setCats(JSON.stringify(o))),
    setReminders:l=>tryf(()=>P&&P.setReminders(JSON.stringify(l))),
    ask:()=>tryf(()=>P&&P.ask()),
    token:()=>tryf(()=>P&&P.token?P.token():'',''),
    takeOpen:()=>tryf(()=>{const s=P&&P.takeOpen?P.takeOpen():'';return s?JSON.parse(s):null},null),
  },
  auth:{
    vkAvail:()=>tryf(()=>!!(B&&B.vkAvail&&B.vkAvail()),false), vkLogin:()=>tryf(()=>B.vkLogin('ru')),
    yaAvail:()=>tryf(()=>!!(B&&B.yaAvail&&B.yaAvail()),false), yaLogin:()=>tryf(()=>B.yaLogin('ru')),
  },
  levelEnd:()=>tryf(()=>W.RuStore&&W.RuStore.levelEnd&&W.RuStore.levelEnd()),
};
const web={
  id:'web', canSign:()=>false, sign:()=>'',
  event:(n,o)=>{}, setConsent:()=>{}, rcInt:(k,d)=>d, rcBool:(k,d)=>d,
  ads:{slot:def=>def, banner:()=>{}, rewardedAvail:()=>false, showRewarded:()=>{}, interstitialOn:()=>false, showInterstitial:()=>{}},
  push:{avail:()=>false,setCats:()=>{},setReminders:()=>{},ask:()=>{},token:()=>'',takeOpen:()=>null},
  auth:{vkAvail:()=>false,vkLogin:()=>{},yaAvail:()=>false,yaLogin:()=>{}},
  levelEnd:()=>{},
};
// vk — VK Games / VK Mini Apps (vk-bridge, bundled locally as vk-bridge.min.js). No game key in the build (like web):
//      register goes with platform 'vk'; signed calls need a server-side VK launch-params check (TODO backend).
const Q=tryf(()=>new URLSearchParams(location.search),null);
const isVK=!!(Q&&(Q.get('vk_app_id')||Q.get('vk_platform')))&&!!W.vkBridge;
const VB=W.vkBridge;
const vsend=(m,p)=>{try{return VB.send(m,p||{}).catch(()=>null)}catch(e){return Promise.resolve(null)}};
let vkRc={}, vkRw=false, vkBWant=false, vkBReady=false;
// no ad right after launch: banner only after the first user interaction or 30 s
const vkBGo=()=>{ if(vkBReady)return; vkBReady=true; if(vkBWant)vk.ads.banner(true); };
if(W.addEventListener){ W.addEventListener('pointerdown',()=>setTimeout(vkBGo,1500),{once:true}); setTimeout(vkBGo,30000); }
const vk={
  id:'vk', canSign:()=>false, sign:()=>'',
  user:null, launch:Q?Object.fromEntries(Q.entries()):{}, launchQS:location.search.slice(1),
  social:{ // VK friends for friend raids; other adapters have no social -> option hidden
    friends:()=>vsend('VKWebAppGetFriends',{multi:true}).then(r=>((r&&r.users)||[]).map(u=>({id:u.id,name:((u.first_name||'')+' '+(u.last_name||'')).trim()}))),
    invite:()=>vsend('VKWebAppShowInviteBox'),
    share:()=>vsend('VKWebAppShare',{link:'https://vk.com/app54836295'}),   // only on user tap; user can cancel in VK dialog
    support:'https://vk.com/app54836295',
    // VK votes purchases; currency is credited by the server (payments callback) and arrives as a gift on sync
    onOK:!!(Q&&Q.get('vk_client')==='ok'),  // same mini app on ok.ru: prices in ОК, server callback /okpay
    items:(Q&&Q.get('vk_client')==='ok')?[['gems_80','80 кристаллов',20,'gem'],['gems_250','250 кристаллов',55,'gem'],['gems_700','700 кристаллов',140,'gem'],['gems_1800','1800 кристаллов',300,'gem'],['coins_10000','10 000 монет',35,'coin']]
      :[['gems_80','80 кристаллов',3,'gem'],['gems_250','250 кристаллов',8,'gem'],['gems_700','700 кристаллов',20,'gem'],['gems_1800','1800 кристаллов',45,'gem'],['coins_10000','10 000 монет',5,'coin']],
    pay:item=>vsend('VKWebAppShowOrderBox',{type:'item',item}).then(r=>!!(r&&(r.success||r.status==='success'))),
  },
  event:(n,o)=>{}, setConsent:()=>{},
  rcInt:(k,d)=>k in vkRc?(vkRc[k]|0):d, rcBool:(k,d)=>k in vkRc?!!vkRc[k]:d,
  ads:{
    slot:def=>0, // banner shown in 'resize' layout: VK shrinks the iframe, nothing is covered
    banner:on=>{ vkBWant=!!on; if(!vkBReady)return; if(on)vsend('VKWebAppShowBannerAd',{banner_location:'bottom',layout_type:'resize',can_close:false}); else vsend('VKWebAppHideBannerAd'); },
    rewardedAvail:()=>vkRw,
    showRewarded:k=>{ vsend('VKWebAppShowNativeAds',{ad_format:'reward'}).then(r=>{ W.__adResult&&W.__adResult(k,!!(r&&r.result)); vkCheck(); }); },
    interstitialOn:()=>true, // gated by server RC ads_interstitial_enabled (default off) in game.js
    showInterstitial:()=>{ vsend('VKWebAppShowNativeAds',{ad_format:'interstitial'}); },
  },
  push:{avail:()=>false,setCats:()=>{},setReminders:()=>{},ask:()=>{},token:()=>'',takeOpen:()=>null},
  auth:{vkAvail:()=>false,vkLogin:()=>{},yaAvail:()=>false,yaLogin:()=>{}},
  levelEnd:()=>{},
  setRc:o=>{vkRc=o||{}},
};
function vkCheck(){ vsend('VKWebAppCheckNativeAds',{ad_format:'reward'}).then(r=>{vkRw=!!(r&&r.result)}); }
if(isVK){
  vsend('VKWebAppInit').then(()=>{ vkCheck(); return vsend('VKWebAppGetUserInfo'); }).then(u=>{ if(u&&u.id)vk.user={id:u.id,name:((u.first_name||'')+' '+(u.last_name||'')).trim()}; });
}
// fs — Fotostrana iframe app. Launch params apiId/viewerId/authKey come in the iframe URL; the server checks
//      authKey = md5(apiId_viewerId_serverKey) on register. JS SDK URL comes in GET param fsapi (host whitelisted).
//      FS_CFG {appId, clientKey} (public client key) is written into fs-config.js by fs/build_fs.py.
//      No ad SDK on FS: ads are stubs (no rewarded, no interstitials, no demo rewards).
const isFS=!B&&!isVK&&!!(Q&&Q.get('apiId')&&Q.get('viewerId')&&Q.get('authKey'));
let fsC=null, fsP=null; const fsPend=new Set(); const fsFail=()=>{ fsPend.forEach(f=>f(false)); fsPend.clear(); };
const fsLoad=()=>fsP||(fsP=new Promise(res=>{
  const cfg=W.FS_CFG||{}; let u=null;
  try{ u=new URL(Q.get('fsapi')||''); if(u.protocol==='http:')u.protocol='https:'; }catch(e){u=null}
  if(!u||u.protocol!=='https:'||!/(^|\.)(fotostrana\.ru|fsimg\.ru|fotocdn\.net)$/.test(u.hostname)||!cfg.clientKey){ console.warn('fs: no sdk'); return res(null); }
  const s=document.createElement('script'); s.src=u.href; s.async=true;
  s.onload=()=>{ try{ if(typeof W.fsapi!=='function'){ console.warn('fs: fsapi global missing'); return res(null); }
    // real SDK (st.fotocdn.net …fsapi.js): fsapi(appId, clientKey).init(errorHand); errors go to errorHand, not to event callbacks
    fsC=new W.fsapi(Q.get('apiId')||cfg.appId,cfg.clientKey); fsC.init(e=>{ console.warn('fs api error',e&&e.errorText); fsFail(); }); res(fsC); }catch(e){ console.warn('fs: init failed',e); res(null); } };
  s.onerror=()=>res(null); document.head.appendChild(s);
}));
const FS_IMG=(W.FS_CFG&&W.FS_CFG.imgBase)||'https://abuserfaq.github.io/raccoons-fs/img/';
const FS_SLUG=(W.FS_CFG&&W.FS_CFG.slug)||(Q&&Q.get('apiId'))||'raccoons';
const FS_APP='https://fotostrana.ru/app/'+FS_SLUG;
const fsSocialEv=(ev,extra)=>{ fsLoad().then(c=>{ if(!c)return; const txt='🦝 Еноты: Огонь по базе — сыграй со мной! '+FS_APP;
  tryf(()=>c.event(ev,r=>console.log('[fs]',ev,r),Object.assign({text:txt,message:txt,img:FS_IMG+'gem.png'},extra||{}))); }); };
const fs={
  id:'fs', canSign:()=>false, sign:()=>'',
  user:null, launch:Q?Object.fromEntries(Q.entries()):{}, launchQS:location.search.slice(1),
  social:{
    name:'ФОТОСТРАНА', cur:'ФМ', noFriends:true,
    // [key, title, price FM, icon, FS itemId] — itemId/price must match backend lb/fs_pay.py FS_ITEMS
    items:[['gems_80','80 кристаллов',20,'gem',1],['gems_250','250 кристаллов',55,'gem',2],['gems_700','700 кристаллов',140,'gem',3],['gems_1800','1800 кристаллов',300,'gem',4],['coins_10000','10 000 монет',35,'coin',5]],
    ready:()=>fsLoad().then(c=>!!c),
    pay:key=>fsLoad().then(c=>new Promise(res=>{
      const it=fs.social.items.find(i=>i[0]===key); if(!c||!it)return res(false);
      const done=ok=>{ if(!fsPend.delete(done))return; res(ok); }; fsPend.add(done);
      try{ c.event('buyItemCallback',r=>done(!!(r&&r.result==='success')),
        Object.assign({itemId:it[4],name:it[1],priceFmCents:it[2]*100,amount:1,picUrl:FS_IMG+it[3]+'.png'},
          ((W.FS_CFG&&W.FS_CFG.debugViewerIds)||[]).map(String).includes(String(Q.get('viewerId')))?{isDebug:1}:{})); }catch(e){ done(false); }
    })),
    invite:()=>fsSocialEv('invite'),
    share:()=>fsSocialEv('sendMessageAndInvite'),
  },
  event:(n,o)=>{}, setConsent:()=>{},
  rcInt:(k,d)=>k in fsRc?(fsRc[k]|0):d, rcBool:(k,d)=>k in fsRc?!!fsRc[k]:d,
  ads:{slot:def=>0, banner:()=>{}, rewardedAvail:()=>false, showRewarded:k=>{W.__adResult&&W.__adResult(k,false)}, noDemo:true,
       interstitialOn:()=>false, showInterstitial:()=>{}},
  push:{avail:()=>false,setCats:()=>{},setReminders:()=>{},ask:()=>{},token:()=>'',takeOpen:()=>null},
  auth:{vkAvail:()=>false,vkLogin:()=>{},yaAvail:()=>false,yaLogin:()=>{}},
  levelEnd:()=>{},
  setRc:o=>{fsRc=o||{}},
};
let fsRc={};
if(isFS){
  fs.user={id:Q.get('viewerId'),name:''};
  fsLoad().then(c=>{ if(c)try{ c.api('User.getProfiles',{userIds:fs.user.id,fields:'user_name'},r=>{ const u=r&&r.response&&r.response[fs.user.id]; if(u&&u.user_name)fs.user.name=u.user_name; }); }catch(e){} });
  // ask NOTIFY bit 32 after first tap (same as Capy); decline remembered 3 days; notifyPopup when already allowed
  const aps=parseInt(Q.get('apiSettings')||'0',10)||0; console.log('[fs] apiSettings',aps);
  const LK='ra_fs_perm32_ts', ago=+(tryf(()=>localStorage.getItem(LK),0)||0);
  if(!(aps&32)&&Date.now()-ago>3*864e5){ let asked=false;
    W.addEventListener('pointerdown',()=>{ if(asked)return; asked=true;
      fsLoad().then(c=>{ if(!c)return; tryf(()=>c.event('appSettings',r=>{ console.log('[fs] appSettings',r);
        const ok=r&&(r.result==='success'||((+r.settings||+r.apiSettings||0)&32)); if(!ok)tryf(()=>localStorage.setItem(LK,String(Date.now()))); },{request_permission:32})); }); },{capture:true}); }
  if(Q.get('hasNotifications')==='1') fsLoad().then(c=>{ if(c)tryf(()=>c.event('notifyPopup',r=>console.log('[fs] notifyPopup',r),{show:true,title:'Новые события'})); });
}
// v0.3.3: paid catalog from the signed /v2/config `shop` {vk|ok|fs:[{id,title,price,reward[,fs_id]}]} (enabled items only).
// Hardcoded items above stay only as fallback while no config has been verified. Server callbacks charge by the same table.
const SHOP_FB={vk:vk.social.items.slice(),fs:fs.social.items.slice()};
const icon=(id,rw)=>(rw&&rw.coins&&!rw.gems)||/^coins/.test(id)?'coin':'gem';
function setShop(sh){
  const ok=sh&&typeof sh==='object';
  const map=(list,withFs)=>(Array.isArray(list)?list:[]).filter(i=>i&&i.id&&+i.price>0&&(!withFs||i.fs_id)).map(i=>{const r=[String(i.id),String(i.title||i.id),+i.price,icon(i.id,i.reward)];if(withFs)r.push(+i.fs_id);return r;});
  vk.social.items=ok?map(sh[vk.social.onOK?'ok':'vk'],false):SHOP_FB.vk.slice();
  fs.social.items=ok?map(sh.fs,true):SHOP_FB.fs.slice();
  vk.social.fromShop=fs.social.fromShop=!!ok;
}
vk.setShop=fs.setShop=setShop; if(typeof web!=='undefined')web.setShop=()=>{}; if(typeof android!=='undefined')android.setShop=()=>{};
W.__setShop=setShop; W.__shopDbg=()=>({vk:vk.social.items,ok:vk.social.onOK,fs:fs.social.items,fromShop:!!vk.social.fromShop});
// gp — GamePush build only (one build for all GP platforms). Active only when the GP build loader ran
//      (window.GP_CFG set by gp/build_gp.py) or with ?gp=1 for local tests. VK/FS/Android builds never set GP_CFG.
//      Ads: sticky banner + rewarded only; fullscreen/interstitial off unless GP_CFG.interstitial or RC ads_interstitial_enabled.
//      Cloud save: localStorage 'ra_save' mirrored to player field 'save' (create field 'save' (string) + 'score' (number) in GP panel).
//      Purchases: gp.payments (tags = item keys). Server-side verification via GP webhook is TODO (no secret key yet):
//      until then the reward is granted on the client after purchase+consume (window.__grant in game.js).
const GPC=W.GP_CFG||(Q&&Q.get('gp')==='1'?{}:null);
const isGP=!B&&!!GPC;
const GPI={gems_80:{gems:80},gems_250:{gems:250},gems_700:{gems:700},gems_1800:{gems:1800},coins_10000:{coins:10000}};
let gpRc={}, gpBWant=false, gpBReady=false;
const gpS=()=>W.__gp||null;
const gpBGo=()=>{ if(gpBReady)return; if(!gpAdsOk()){setTimeout(gpBGo,5000);return;} gpBReady=true; if(gpBWant)gpo.ads.banner(true); };
const gpDone=()=>tryf(()=>JSON.parse(localStorage.getItem('ra_gp_granted')||'[]'),[])||[];
const gpCredit=async(g,tag,pid)=>{ const r=GPI[tag]; if(!r)return; const done=gpDone();
  if(!(pid&&done.indexOf(pid)>=0)){ W.__grant&&W.__grant(r); if(pid){done.push(pid);tryf(()=>localStorage.setItem('ra_gp_granted',JSON.stringify(done.slice(-50))));} }
  try{ const v=localStorage.getItem('ra_save'); if(v)g.player.set('save',String(v)); await g.player.sync(); }catch(e){}
  try{ await g.payments.consume({tag}); }catch(e){ console.warn('gp consume',e); } };
// ads allowed only after tutorial + 2 campaign levels (no ads at game start)
const gpAdsOk=()=>tryf(()=>{ const s=JSON.parse(localStorage.getItem('ra_save')||'{}'); return !!s.tutDone&&(s.campLvl|0)>=2; },false);
const gpo={
  id:'gamepush', canSign:()=>false, sign:()=>'',
  user:null, launch:{}, launchQS:'',
  social:{
    name:'', cur:'', noFriends:true, items:[],
    ready:()=>Promise.resolve(!!(gpS()&&gpS().payments&&gpS().payments.isAvailable)),
    pay:key=>{ const g=gpS(); if(!g||!g.payments||!g.payments.isAvailable)return Promise.resolve(false);
      // docs order: purchase -> grant -> await player.sync() -> consume (never consume before the save is in the cloud)
      return g.payments.purchase({tag:key}).then(res=>gpCredit(g,key,res&&res.purchase&&res.purchase.id)).then(()=>false)
        .catch(e=>{console.warn('gp pay',e);return false;}); },
  },
  event:(n,o)=>{}, setConsent:()=>{},
  rcInt:(k,d)=>k in gpRc?(gpRc[k]|0):d, rcBool:(k,d)=>k in gpRc?!!gpRc[k]:d,
  ads:{
    slot:def=>0,
    banner:on=>{ gpBWant=!!on; const g=gpS(); if(!gpBReady||!g)return; tryf(()=>{ if(on){ if(g.ads.isStickyAvailable)g.ads.showSticky(); } else g.ads.closeSticky(); }); },
    noDemo:true, // never grant 'demo' rewards without a real video
    rewardedAvail:()=>tryf(()=>!!(gpS()&&gpS().ads.isRewardedAvailable),false),
    noAdMsg:'Реклама не найдена, попробуйте позже',
    showRewarded:k=>{ const g=gpS(); if(!g||!g.ads.isRewardedAvailable){W.__adResult&&W.__adResult(k,false);return;}
      Promise.resolve(g.ads.showRewardedVideo()).then(ok=>W.__adResult&&W.__adResult(k,!!ok)).catch(()=>W.__adResult&&W.__adResult(k,false)); },
    interstitialOn:()=>!!(GPC&&GPC.interstitial), // off by default; game.js also requires RC ads_interstitial_enabled
    showInterstitial:()=>tryf(()=>{ const g=gpS(); if(g&&g.ads.isFullscreenAvailable)g.ads.showFullscreen(); }),
  },
  push:{avail:()=>false,setCats:()=>{},setReminders:()=>{},ask:()=>{},token:()=>'',takeOpen:()=>null},
  auth:{vkAvail:()=>false,vkLogin:()=>{},yaAvail:()=>false,yaLogin:()=>{}},
  levelEnd:()=>{},
  setRc:o=>{gpRc=o||{}},
  setShop:()=>{},
};
if(isGP){
  if(W.addEventListener){ W.addEventListener('pointerdown',()=>setTimeout(gpBGo,1500),{once:true}); setTimeout(gpBGo,30000); }
  const g=gpS();
  if(g){ tryf(()=>{
    gpo.user={id:g.player.id,name:g.player.name||''};
    // cloud save: take the cloud copy if local is empty or older (saves carry no timestamp -> prefer cloud when local missing)
    const cloud=tryf(()=>g.player.get('save'),''), local=tryf(()=>localStorage.getItem('ra_save'),null);
    if(cloud&&!local) tryf(()=>localStorage.setItem('ra_save',cloud));
    let t=0; const sI=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){ sI.call(this,k,v); if(this===W.localStorage&&k==='ra_save'){ clearTimeout(t); t=setTimeout(()=>tryf(()=>{
      g.player.set('save',String(v)); const c=tryf(()=>JSON.parse(v).cups|0,0); if(c)g.player.set('score',c); g.player.sync(); }),3000); } };
    if(g.payments&&g.payments.isAvailable){
      const pr=tryf(()=>g.payments.products,[])||[];
      gpo.social.items=pr.filter(p=>GPI[p.tag]).map(p=>[p.tag,p.name||p.tag,p.price,GPI[p.tag].coins?'coin':'gem']);
      gpo.social.cur=(pr[0]&&pr[0].currencySymbol)||'';
    }
    const ap=p=>tryf(()=>{W.__muted=p;W.__adPause&&W.__adPause(p);});
    g.on&&g.on('pause',()=>ap(true)); g.on&&g.on('resume',()=>ap(false));
    g.ads&&g.ads.on&&(g.ads.on('start',()=>ap(true)),g.ads.on('close',()=>ap(false)));
    document.addEventListener('visibilitychange',()=>{ if(document.hidden)ap(true); else if(!tryf(()=>g.ads.isAdsPlaying,false))ap(false); });
    // credit unconsumed purchases (paid but not consumed, e.g. tab closed mid-flow); wait for game.js __grant
    const pend=tryf(()=>(g.payments.purchases||[]).slice(),[])||[];
    if(pend.length){ const go=()=>{ if(!W.__grant)return setTimeout(go,500);
      pend.forEach(pu=>{ const pr=tryf(()=>g.payments.getProduct(pu.productId),null); const tag=(pr&&pr.tag)||pu.tag; if(GPI[tag])gpCredit(g,tag,pu.id); }); }; go(); }
    g.gameStart&&g.gameStart();
  }); }
  gpo.leaderboard=()=>tryf(()=>gpS()&&gpS().leaderboard.open({orderBy:['score'],limit:20}));
}
W.Platform=B?android:(isGP?gpo:(isVK?vk:(isFS?fs:web)));
// 0.3.7: device info (≤60 chars each), share, rate — same interface on every platform.
(function(P){const cut=v=>String(v||'').slice(0,60);
 P.STORE_URL='https://www.rustore.ru/catalog/app/ru.raccoons.artillery';
 P.deviceInfo=()=>{let o={};if(P.id==='android')o=tryf(()=>JSON.parse(B.device()),{});else{const n=navigator,ua=n.userAgent||'',m=ua.match(/Android [\d.]+|iPhone OS [\d_]+|Windows NT [\d.]+|Mac OS X [\d_.]+|Linux|CrOS/);
   o={model:(n.userAgentData&&n.userAgentData.platform)||n.platform||'',os:m?m[0].replace(/_/g,'.'):'',device:/Mobi|Android|iPhone/.test(ua)?'mobile':'desktop'};}
  const plat=P.id==='vk'?(P.social&&P.social.onOK?'ok':'vk'):P.id;
  return {lang:cut((navigator.language||'ru').slice(0,5)),platform:cut(plat),model:cut(o.model),os:cut(o.os),device:cut(o.device)}};
 P.canShare=()=>P.id==='android'?!!(B&&B.share):!!(navigator.share||(P.social&&P.social.share));
 P.share=t=>{if(P.id==='android')return tryf(()=>B.share(t));if(P.social&&P.social.share)return P.social.share();if(navigator.share)navigator.share({text:t}).catch(()=>{})};
 P.canRate=()=>P.id==='android'&&!!(W.RuStore&&W.RuStore.review);
 P.rate=()=>tryf(()=>W.RuStore.review());
 P.openStore=()=>tryf(()=>W.RuStore.openStore?W.RuStore.openStore():B.openUrl('',P.STORE_URL));
})(W.Platform);
})();
