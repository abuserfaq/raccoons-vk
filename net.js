// Net: client of game_backend online API for game "raccoons_art" (v2 envelope, HMAC; grants/config RSA-verified).
// Every call degrades gracefully: offline -> local stubs, the UI never blocks.
(function(){
const BASE='https://d5dkao4fh5oe83poui3n.d8epmcec.apigw.yandexcloud.net', GAME='raccoons_art', VER='0.2.0', TO=8000;
const PUB='MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArPfX8g5oECXcB+5XLPCd4vchTb+5yObUUbwGX6Diq1YRRNxDn9RnBbNYe75ng0BSX6S6yZ2cDjPwV8JY/1E1WPmzZJy9ubmGyDkM/QlsHv0pX9IRt43lTWCvlZ9TfL8LnkLzGXWou1Zs7dxOd+J+yUrtdvkGxZyRTuy3Sa9AE45iU2uI86tWoacNZzOH/i5Nfy0UThK4HXb6nlJQaNUXet604pLr9N2b60yBg5ZyGunNZU2L2iHjpqza9LXOGvXvGl9kPL6zho84vX5GbEHqB/vR4J/MCOzbxPWqZiTTTgrOcoMbYEx97642XjmXjve6gSxtGVHGkWgnLw7kCGF9ewIDAQAB';
const LS='ra_net';
let st={}; try{st=JSON.parse(localStorage.getItem(LS)||'{}')}catch(e){}
try{st.cfg&&window.__setShop&&window.__setShop(st.cfg.shop)}catch(e){}
// 0.3.5: Yandex ad unit ids from signed config → native cache (keys top-level or under "ads").
function adCfg(o){try{if(!o||!window.AppBridge||!AppBridge.setAdConfig)return;const K=['yandex_banner_id','yandex_rewarded_id','yandex_interstitial_id','ads_interstitial_enabled','interstitial_every_games','ads_banner_persistent'],a=o.ads||{},m={};K.forEach(k=>{const v=a[k]!=null?a[k]:o[k];if(v!=null&&v!=='')m[k]=String(v)});if(Object.keys(m).length)AppBridge.setAdConfig(JSON.stringify(m))}catch(e){}}
try{st.cfg&&adCfg(st.cfg)}catch(e){}
st.applied=st.applied||[]; st.rf=st.rf||[];
const save=()=>{try{localStorage.setItem(LS,JSON.stringify(st))}catch(e){}};
let offset=0, online=false, lastErr='', cfg=null, syncD=null;
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const enc=s=>new TextEncoder().encode(s);
const sub=()=>W.crypto&&crypto.subtle; const W=window;
async function hmac(key,msg){const k=await crypto.subtle.importKey('raw',enc(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,enc(msg)))}
let pubKey=null;
async function verify(msg,b64){try{if(!sub()||!b64)return false;
  if(!pubKey)pubKey=await crypto.subtle.importKey('spki',Uint8Array.from(atob(PUB),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pubKey,Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),enc(msg));}catch(e){return false}}
function nonce(){let s='';const c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';for(let i=0;i<20;i++)s+=c[Math.random()*c.length|0];return s}
async function fetchT(url,opt){const ac=new AbortController();const t=setTimeout(()=>ac.abort(),TO);try{return await fetch(url,Object.assign({signal:ac.signal,cache:'no-store'},opt))}finally{clearTimeout(t)}}
class NetErr extends Error{constructor(m,status){super(m);this.status=status}}
async function call(action,d,gameKey,retry){
  const p=JSON.stringify({a:action,g:GAME,pid:gameKey?'':(st.pid||''),ts:Math.floor(Date.now()/1000+offset),n:nonce(),d:d||{}});
  let s='';
  if(gameKey&&(Platform.id==='vk'||Platform.id==='fs')){ s=''; }
  else if(gameKey){ if(!Platform.canSign())throw new NetErr('no game key',0); s=Platform.sign(p); if(!s)throw new NetErr('no game key',0); }
  else { if(!st.secret)throw new NetErr('not registered',0); s=await hmac(st.secret,p); }
  let r; try{r=await fetchT(BASE+'/v2/'+action,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({p,s})})}
  catch(e){online=false;throw new NetErr('network',0)}
  const j=await r.json().catch(()=>({}));
  if(j.now)offset=j.now-Date.now()/1000;
  if(r.status===401&&/stale/.test(j.error||'')&&!retry)return call(action,d,gameKey,true);
  online=r.status<500;
  if(!r.ok)throw new NetErr(j.error||('http '+r.status),r.status);
  return j;
}
async function get(path){let r;try{r=await fetchT(BASE+path)}catch(e){online=false;throw new NetErr('network',0)}if(!r.ok)throw new NetErr('http '+r.status,r.status);online=true;return r.json()}
async function safe(fn,fallback){try{return await fn()}catch(e){lastErr=String(e&&e.message||e);return typeof fallback==='function'?fallback(e):fallback}}
let regP=null;
function ensure(){ if(st.secret)return Promise.resolve(true); if(!regP)regP=(async()=>{try{const j=await call('register',Platform.id==='fs'?{platform:'fotostrana',fs:Platform.launchQS||''}:Platform.id==='vk'?{platform:Platform.social&&Platform.social.onOK?'ok':'vk',vk:Platform.launchQS||''}:{platform:Platform.id},true);
  st.pid=j.player_id;st.secret=j.secret;st.nick=j.nickname;save();return true}catch(e){lastErr=String(e.message);return false}finally{regP=null}})(); return regP;}
const need=async()=>{if(!await ensure())throw new NetErr('offline',0)};
// ---- rewards: RSA-signed grants, each gid applied once ----
let onGrant=null;
async function take(grant,gsig){ if(!grant)return null; if(!await verify(grant,gsig))return null;
  let g;try{g=JSON.parse(grant)}catch(e){return null}
  if(g.pid!==st.pid||g.game!==GAME||st.applied.includes(g.gid))return null;
  const rw={};for(const k in g.reward||{})rw[k]=parseInt(g.reward[k])||0;
  st.applied.push(g.gid);while(st.applied.length>500)st.applied.shift();save();
  onGrant&&onGrant(rw,g); return rw;}
async function takeConfig(c,csig){ if(!c||!await verify(c,csig))return null; try{const o=JSON.parse(c);if(o.game!==GAME)return null;cfg=o;st.cfg=o;save();try{window.__setShop&&window.__setShop(o.shop)}catch(e){}adCfg(o);return o}catch(e){return null}}
// ---- analytics: batched, whitelisted names, <=20 per call ----
const EVN=['session','tutorial_done','level_start','level_win','level_lose','battle_start','battle_end','raid_start','raid_win','raid_lose','defense','revenge','ad_rewarded','ad_interstitial','ad_banner','shop_open','base_edit'];
let evq={},evT=0;
function ev(name,n){ if(!EVN.includes(name))return; evq[name]=(evq[name]||0)+(n||1); if(!evT)evT=setTimeout(flush,30000); }
async function flush(){ clearTimeout(evT);evT=0; const e=evq; if(!Object.keys(e).length)return; evq={};
  try{await need();await call('events',{events:e,platform:Platform.id})}catch(x){ if(x.status===429||x.status===0){for(const k in e)evq[k]=(evq[k]||0)+e[k];} } }
// ---- raid_find limits: 20 s cooldown, <=60/h (mirrored client-side) ----
function raidWait(){const now=Date.now();st.rf=st.rf.filter(t=>now-t<3600e3);
  const cd=st.rf.length?Math.max(0,20e3-(now-st.rf[st.rf.length-1])):0; const hr=st.rf.length>=60?3600e3-(now-st.rf[0]):0;
  return Math.ceil(Math.max(cd,hr)/1000);}
function raidMark(){st.rf.push(Date.now());save();}
const off=(o)=>Object.assign({offline:true},o||{});
// ---- offline stub top (only when the server is unreachable) ----
const NAMES=['Енотище','MaskedBandit','Клык_77','Мусорщик','TrashPanda','Полоска','Бублик_енот'];
function stubTop(board,period){const base={day:900,week:4800,month:12000,all:40000}[period]||1000;
  return off({entries:NAMES.map((n,i)=>({rank:i+1,nickname:n,score:Math.round(base*(1-i*0.045))})),prizes:[]})}
W.addEventListener('pagehide',flush); document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
W.Net={
  GAME, VER, get online(){return online}, get lastErr(){return lastErr}, get nick(){return st.nick||''}, get pid(){return st.pid||''},
  get registered(){return !!st.secret}, get config(){return cfg||st.cfg||null}, get syncData(){return syncD},
  set onGrant(f){onGrant=f}, ensure, ev, flush, raidWait,
  async sync(){return safe(async()=>{await need();const j=await call('sync',{board:'trophies',lang:'ru',ver:VER});syncD=j;if(j.nickname)st.nick=j.nickname;save();
     await takeConfig(j.config,j.csig); for(const g of j.gifts||[]){ // admin gifts: claim (idempotent), then apply verified grant
       try{const c=await call('claim',{kind:'gift',id:g.gid});await take(c.grant,c.gsig)}catch(e){}}
     return j},off)},
  async loadConfig(){return safe(async()=>{const j=await get('/v2/config?game='+GAME);return await takeConfig(j.config,j.csig)||off()},()=>st.cfg||off())},
  score:(board,score,duration)=>{ if(board!=='camp')return Promise.resolve(off({skipped:true})); // trophies/raids are server-only (403)
     return safe(async()=>{await need();return call('score',{board,score:Math.max(0,Math.min(3000,score|0)),duration:Math.max(1,duration|0)})},off)},
  progress:(stats)=>safe(async()=>{await need();return call('progress',{stats})},off),
  top:(board,period,limit)=>safe(()=>get(`/v2/top?game=${GAME}&board=${board}&period=${period}&limit=${limit||50}`),()=>stubTop(board,period)),
  rank:(board)=>safe(async()=>{if(!st.pid)throw 0;return get(`/v2/rank?game=${GAME}&board=${board}&player_id=${st.pid}`)},off),
  claim:(kind,id,board)=>safe(async()=>{await need();const j=await call('claim',Object.assign({kind,id},board?{board}:{}));const rw=await take(j.grant,j.gsig);return {ok:true,reward:rw,repeat:j.repeat}},e=>off({error:e.message,status:e.status})),
  basePut:(base,v)=>safe(async()=>{await need();return call('base_put',{base,v:v||1})},off),
  // -> {raid_id, opponent{...}} | {opponent:null} | {wait:s} | {offline}
  async raidFind(){const w=raidWait();if(w>0)return {wait:w};
    return safe(async()=>{await need();raidMark();return await call('raid_find',{})},e=>e.status===429?{wait:Math.max(20,raidWait()),limited:true}:off())},
  raidFriends:(ids)=>safe(async()=>{await need();return call('raid_friends',{vk_ids:ids.slice(0,100)})},off({friends:[]})),
  async raidFriend(pid){const w=raidWait();if(w>0)return {wait:w};
    return safe(async()=>{await need();raidMark();return await call('raid_friend',{player_id:pid})},e=>e.status===429?{wait:20}:off({error:e.message,status:e.status}))},
  async raidRevenge(rid){const w=raidWait();if(w>0)return {wait:w};
    return safe(async()=>{await need();raidMark();return await call('raid_revenge',{raid_id:rid})},e=>e.status===429?{wait:20}:off({error:e.message,status:e.status}))},
  // -> server answer | {implausible} (422) | {expired} (410/404) | {offline}
  raidResult:(raid_id,res)=>safe(async()=>{await need();return call('raid_result',Object.assign({raid_id},res))},
     e=>e.status===422?{implausible:true}:(e.status===410||e.status===404)?{expired:true}:e.status===429?{limited:true}:off()),
  raidLog:(limit)=>safe(async()=>{await need();return call('raid_log',{limit:limit||20})},off({entries:[]})),
  pushToken:(token,on)=>safe(async()=>{await need();return call('push_token',{token,on})},off),
  pushOpen:(type,source)=>safe(async()=>{await need();return call('push_open',{type,source})},off),
  nickSet:(nickname)=>safe(async()=>{await need();const j=await call('nick',{nickname});st.nick=j.nickname;save();return j},e=>off({error:e.message})),
  vkLink:(o)=>safe(async()=>{await need();const j=await call('vk_link',o);if(j.switched&&j.secret){st.pid=j.player_id;st.secret=j.secret;}st.nick=j.nickname||st.nick;save();return j},e=>off({error:e.message,status:e.status})),
  del:()=>safe(async()=>{await need();const j=await call('delete',{confirm:true});st={applied:[],rf:[]};save();return j},off),
};
})();
