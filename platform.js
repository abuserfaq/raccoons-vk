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
const fs={
  id:'fs', canSign:()=>false, sign:()=>'',
  user:null, launch:Q?Object.fromEntries(Q.entries()):{}, launchQS:location.search.slice(1),
  social:{
    name:'ФОТОСТРАНА', cur:'ФМ', noFriends:true,
    // [key, title, price FM, icon, FS itemId] — itemId/price must match backend lb/fs_pay.py FS_ITEMS
    items:[['gems_80','80 кристаллов',20,'gem',1],['gems_250','250 кристаллов',55,'gem',2],['gems_700','700 кристаллов',140,'gem',3],['gems_1800','1800 кристаллов',300,'gem',4],['coins_10000','10 000 монет',35,'coin',5]],
    // FS charges FM; currency is credited by the server (/fspay type=1) and arrives as a gift on sync
    ready:()=>fsLoad().then(c=>!!c),
    pay:key=>fsLoad().then(c=>new Promise(res=>{
      const it=fs.social.items.find(i=>i[0]===key); if(!c||!it)return res(false);
      const done=ok=>{ if(!fsPend.delete(done))return; res(ok); }; fsPend.add(done);
      try{ c.event('buyItemCallback',r=>done(!!(r&&r.result==='success')),
        Object.assign({itemId:it[4],name:it[1],priceFmCents:it[2]*100,amount:1,picUrl:FS_IMG+it[3]+'.png'},
          ((W.FS_CFG&&W.FS_CFG.debugViewerIds)||[]).map(String).includes(String(Q.get('viewerId')))?{isDebug:1}:{})); }catch(e){ done(false); }
    })),
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
W.Platform=B?android:(isVK?vk:(isFS?fs:web));
})();
