// UI / meta: consent, menu, maps, battle HUD, arsenal, squad, base (live), ratings (stub), settings, ads, push.
(function(){
const $=s=>document.querySelector(s), app=$('#app'), root=$('#root'), strip=$('#bannerStrip');
const {Battle,MAPS,WEAPONS,BLD,drawRaccoon,drawBuilding,img}=RA;
const PL=window.Platform;
const SHOT=new URLSearchParams(location.search).get('scr');
// ---------- save ----------
const DEF={v:1,consent:null,stats:true,pers:true,coins:1500,gems:150,energy:30,eAt:Date.now(),trophies:0,cups:0,campStars:0,campLvl:0,baseSent:'',wins:0,games:0,
 wl:{bazooka:1,grenade:1,shotgun:1,air:1,drone:1,tele:1},
 squad:[{id:'ryzhik',name:'Рыжик',role:'Командир',char:'commander',lvl:1,hired:true,skill:'Стойкость'},
        {id:'hvost',name:'Хвост',role:'Подрывник',char:'demolition',lvl:1,hired:true,skill:'Двойной бросок'},
        {id:'shnyr',name:'Шнырь',role:'Штурмовик',char:'assault',lvl:1,hired:true,skill:'Дробь x2'},
        {id:'plomba',name:'Пломба',role:'Техник',char:'tech',lvl:1,hired:false,skill:'Дрон+'},
        {id:'nochka',name:'Ночка',role:'Разведчик',char:'commander',lvl:1,hired:false,skill:'Прыжок x2'}],
 base:{hq:1,wall:1,turret:1,radar:1,workshop:1,barracks:1,storage:1},collectAt:Date.now(),
 music:true,sfx:true,push:{timers:true,rating:true,tournament:true,comeback:true,news:true},pushAsked:false,
 daily:{day:'',q:{}},ach:{},used:{},raidsWon:0,bestShot:0,rvAt:0};
let S; try{S=Object.assign(JSON.parse(JSON.stringify(DEF)),JSON.parse(localStorage.getItem('ra_save')||'{}'))}catch(e){S=JSON.parse(JSON.stringify(DEF))}
const save=()=>{try{localStorage.setItem('ra_save',JSON.stringify(S))}catch(e){}};
const EVMAP={battle_start:'battle_start',battle_win:'battle_end',battle_lose:'battle_end',level_start:'level_start',level_win:'level_win',level_lose:'level_lose',
 raid_start:'raid_start',revenge:'revenge',rewarded_ok:'ad_rewarded',interstitial:'ad_interstitial',shop_open:'shop_open',base_edit:'base_edit',session:'session'};
const ev=(n,o)=>{PL.event(n,o);if(EVMAP[n])Net.ev(EVMAP[n]);};
// energy regen 1 / 6 min
function regen(){const n=Math.floor((Date.now()-S.eAt)/360000);if(n>0){S.energy=Math.min(30,S.energy+n);S.eAt+=n*360000;if(S.energy>=30)S.eAt=Date.now();}}
// daily quests
const QUESTS=[['dmg_bz','Нанести 1500 урона базукой',1500,20],['win','Выиграть бой',1,15],['raid','Разнести штаб в рейде',1,25],['shots','Сделать 15 выстрелов',15,10],['air','Использовать авиаудар',1,10]];
function today(){return new Date().toISOString().slice(0,10)}
function dq(){if(S.daily.day!==today()){S.daily={day:today(),q:{}};save();}return S.daily.q}
function qAdd(id,n){const q=dq();q[id]=(q[id]||0)+n;}
// achievements (local; server claims later)
const ACH=[['🎯','Первая победа','wins',1],['💥','Подрывник: 5 000 урона','dmgTotal',5000],['🏰','Разнести штаб','raidsWon',1],['⚔','10 побед','wins',10],['🐾','Нанять 5 енотов','hired',5],
 ['🌪','Победа на ветре 8+','windWin',1],['🧨','Все 6 оружий','allW',6],['👑','Победа на Харде','hardWin',1],['❄','Победа на Ледяной','iceWin',1],['🔒','50 побед','wins',50]];
function achVal(k){return k==='hired'?S.squad.filter(s=>s.hired).length:k==='allW'?Object.keys(S.used).length:(S[k]||S.ach[k]||0)}
// ---------- sound ----------
const AU={};function sfx(n){if(!S.sfx)return;try{let a=AU[n];if(!a){a=AU[n]=new Audio('a/'+n+'.ogg');}const c=a.cloneNode();c.volume=.7;c.play().catch(()=>{});}catch(e){}}
let music=null,musicK='';function musicOn(kind){kind=kind||(cur==='battle'?'battle':'menu');if(!S.music||SHOT)return;if(music&&musicK!==kind){music.pause();music=null;}
 if(!music){musicK=kind;music=new Audio('a/music_'+kind+'.ogg');music.loop=true;music.volume=kind==='battle'?.3:.38;}music.play().catch(()=>{});}
// autoplay policy (incl. VK iframe): (re)start music on the first user gesture
['pointerdown','keydown','touchend'].forEach(e=>addEventListener(e,function f(){removeEventListener(e,f,true);if(S.music&&!document.hidden)musicOn();},true));
function musicOff(){music&&music.pause();}
// ---------- layout ----------
let slot=50;
let AW=960;
// keep top bars clear of the top-centre banner: shrink left/right groups (zoom) until they fit
function fitTop(){const k=app._k||1,ar=app.getBoundingClientRect(),bw=parseFloat(app.style.getPropertyValue('--bw'))||0,bh=parseFloat(app.style.getPropertyValue('--bh'))||0;
 app.style.setProperty('--mch',bh>58?Math.max(140,Math.floor((432-bh-4-10)/2))+'px':'184px');
 if(!bh)return;const zl=AW/2-bw/2,zr=AW/2+bw/2;
 app.querySelectorAll('.top').forEach(t=>{const kids=[...t.children],sp=kids.findIndex(e=>e.style.flex==='1'||e.style.flex.startsWith('1 '));if(sp<0)return;
  for(const [grp,test] of [[kids.slice(sp+1),r=>(r.left-ar.left)/k<zr],[kids.slice(0,sp),r=>(r.right-ar.left)/k>zl]]){let z=1;
   while(z>.62){const r=grp.map(e=>e.getBoundingClientRect());if(!r.some(test))break;z-=.06;grp.forEach(e=>e.style.zoom=z);}}});}
function layout(){const W=innerWidth,H=innerHeight;const bannerOn=cur!=='consent'&&cur!=='consentSet';
  // v0.3: whole screen, no reserved strip; the native banner overlays the top-centre (UI keeps that zone free)
  slot=0;strip.style.display='none';
  const k=W/H>=960/490?H/490:W/960;AW=Math.round(Math.max(960,W/k));root.style.height=H+'px';app.style.width=AW+'px';
  app.style.transform=`translate(${(W-AW*k)/2}px,${(H-490*k)/2}px) scale(${k})`;app._k=k;
  const bh=bannerOn?Math.ceil(PL.ads.slot(50)/k)+4:0;app.style.setProperty('--bh',bh+'px');app.style.setProperty('--bw',Math.ceil(330/k)+'px');
  PL.ads.banner(bannerOn&&S.consent!=null);
  if(battle&&bcv){fitCanvas(bcv);} if(cur)fitTop(); }
addEventListener('resize',layout);
app.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.modalbg .btn,.modalbg .sw,.tutb .btn'))sfx('click')});
function fitCanvas(c){const k=(app._k||1)*Math.min(2,devicePixelRatio||1);c.width=Math.round(AW*k);c.height=Math.round(490*k);}
function dk(c){const x=c.getContext('2d');x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,c.width,c.height);const k=c.height/490;x.setTransform(k,0,0,k,(c.width-960*k)/2,0);return x}
// ---------- helpers ----------
let cur='',battle=null,bcv=null,raf=0,loopFns=[];
function H(s){app.insertAdjacentHTML('beforeend',s);return app.lastElementChild}
function toast(t){const e=H(`<div class="toast">${t}</div>`);setTimeout(()=>e.style.opacity=0,1600);setTimeout(()=>e.remove(),2100)}
const nrg=()=>`<div class="res"><span class="ic i-nrg">⚡</span>${S.energy}/30</div>`;
const coin=()=>`<div class="res" data-a="shop"><span class="ic i-coin"></span>${S.coins.toLocaleString('ru')}<span class="plus">+</span></div>`;
const gem=()=>`<div class="res" data-a="shop"><span class="ic i-gem"></span>${S.gems}<span class="plus">+</span></div>`;
function topbar(title){return `<div class="top"><div class="btn gr" data-a="back" style="width:40px;height:32px;font-size:18px">←</div><div class="title" style="font-size:22px">${title}</div><div style="flex:1"></div>${nrg()}${coin()}${gem()}</div>`}
function bgDiv(n,dim){return `<div class="bgimg" style="background-image:url(img/${n})"></div>${dim?`<div class="h" style="inset:0;background:rgba(8,4,24,${dim})"></div>`:''}`}
function on(sel,fn){app.querySelectorAll(sel).forEach(e=>e.addEventListener('click',ev=>{sfx('click');fn(e,ev)}))}
function clear(){cancelAnimationFrame(raf);loopFns=[];app.innerHTML='';battle=null;bcv=null;if(typeof TUT!=='undefined'){TUT.on=false;TUT.el=null;}}
function loop(){let last=performance.now();const f=now=>{const dt=(now-last)/1000;last=now;for(const fn of loopFns)fn(dt,now/1000);raf=requestAnimationFrame(f)};raf=requestAnimationFrame(f)}
function canvasLayer(z){const c=document.createElement('canvas');c.className='full';if(z){c.style.zIndex=z;c.style.pointerEvents='none';}app.appendChild(c);fitCanvas(c);return c}
// ---------- screens ----------
const SCR={};
function go(n,a){regen();clear();cur=n;layout();SCR[n](a);bindCommon();fitTop();ev('screen',{n});}
function bindCommon(){on('[data-a=back]',()=>back());on('[data-a=shop]',()=>{ev('shop_open');PL.social&&PL.social.pay?shopModal():rewardedCoins()});}
function back(){const md=app.querySelector('.modalbg');if(md){if(md.dataset.lock)return;if(md.dataset.p&&battle)battle.paused=false;md.remove();return}if(cur==='battle'){pauseMenu();return}if(cur==='menu'||cur==='consent')return;go(cur==='consentSet'?'consent':'menu')}
window.G={get battle(){return battle},back,bg(){musicOff();if(battle&&!battle.over&&cur==='battle')pauseMenu()},trim(){}};

SCR.consent=()=>{H(bgDiv('bg_neon.jpg',.35));const c=canvasLayer();
 const units=[{team:0,char:'commander',x:150,y:440,face:1,anim:'idle',ph:0,scale:2.3,at:0},{team:0,char:'assault',x:830,y:440,face:-1,anim:'idle',ph:2,scale:2.1,at:0}];
 loopFns.push((dt,t)=>{const x=dk(c);units.forEach(u=>drawRaccoon(x,u,t));});
 H(`<div class="h" style="left:calc(50% - 275px);top:120px;width:550px;height:325px;border-radius:22px;background:#0a0d1cf2;border:3px solid #29d3ff;box-shadow:0 0 22px #29d3ff99,inset 0 0 18px #29d3ff33;text-align:center;padding:26px 30px">
 <div style="font-size:30px;font-weight:800">Ваша приватность</div>
 <div style="font-size:14px;color:#c8cbe0;margin-top:14px;line-height:1.55">Мы собираем минимальные данные об игре, чтобы улучшать<br>ваш опыт и обеспечивать стабильную работу.<br>Вы можете изменить настройки аналитики в любое время.</div>
 <div class="btn lime" data-a="ok" style="height:66px;margin:22px 10px 0;font-size:38px;border-radius:16px">Хорошо</div>
 <div data-a="set" style="margin-top:14px;color:#aab;font-size:16px;cursor:pointer">Настройки</div></div>`);
 const peek=canvasLayer(6);const pu={team:0,char:'tech',x:480,y:150,face:1,anim:'idle',ph:1,scale:1.5,at:0};
 loopFns.push((dt,t)=>{const x=dk(peek);x.save();x.beginPath();x.rect(0,0,960,122);x.clip();drawRaccoon(x,pu,t);x.restore();});
 on('[data-a=ok]',()=>{S.consent=true;save();applyConsent();S.tutDone?go('menu'):startTut()});on('[data-a=set]',()=>go('consentSet'));loop();
};
SCR.consentSet=()=>{H(bgDiv('bg_neon.jpg',.6));
 H(`<div class="h" style="left:calc(50% - 255px);top:80px;width:510px;border-radius:22px;background:#0a0d1cf2;border:3px solid #29d3ff;padding:22px 28px">
 <div style="font-size:24px;font-weight:800;text-align:center">Настройки приватности</div>
 <div class="row" style="margin-top:20px;justify-content:space-between"><div><b>Аналитика</b><div style="font-size:12px;color:#aab">Обезличенная статистика игры</div></div><div class="sw ${S.stats?'on':''}" data-k="stats"></div></div>
 <div class="row" style="margin-top:16px;justify-content:space-between"><div><b>Персонализация</b><div style="font-size:12px;color:#aab">Подбор контента под ваши интересы</div></div><div class="sw ${S.pers?'on':''}" data-k="pers"></div></div>
 <div class="btn lime" data-a="save" style="height:54px;margin-top:24px;font-size:24px">Сохранить</div></div>`);
 on('.sw',e=>{const k=e.dataset.k;S[k]=!S[k];e.classList.toggle('on',S[k])});on('[data-a=save]',()=>{S.consent=true;save();applyConsent();S.tutDone?go('menu'):startTut()});
};
function applyConsent(){PL.setConsent(S.stats,S.pers);layout();}

SCR.menu=()=>{collect(false);H(bgDiv('bg_neon.jpg',.15));const c=canvasLayer();
 const us=[{team:0,char:'demolition',x:405,y:395,face:1,anim:'idle',ph:0,scale:2.1,at:0},{team:0,char:'assault',x:640,y:395,face:-1,anim:'idle',ph:2,scale:2.0,at:0},{team:0,char:'commander',x:520,y:418,face:1,anim:'idle',ph:1,scale:2.6,at:0}];
 let wt=3;loopFns.push((dt,t)=>{const x=dk(c);
   wt-=dt;if(wt<0){const u=us[Math.random()*3|0];u.anim=u.anim==='win'?'idle':'win';wt=2+Math.random()*3;}us.forEach(u=>drawRaccoon(x,u,t));});
 const QL=questList(),done=QL.filter(z=>z.v>=z.goal).length;
 H(`<div class="top"><div class="res" style="padding-left:3px"><span style="width:28px;height:28px;border-radius:50%;background:#e53935;display:inline-flex;align-items:center;justify-content:center;font-size:12px">${1+Math.floor(S.wins/3)}</span>${Net.nick||'Полосатый_Хвост'}</div><div class="res" style="margin-left:6px">🏆 ${S.cups}</div><div style="flex:1"></div>${nrg()}${coin()}${gem()}<div class="btn gr" data-a="settings" style="width:34px;height:30px">⚙</div></div>`);
 H(`<div class="h" style="left:22px;top:54px"><div class="neonlogo1">ЕНОТЫ:</div><div class="neonlogo2">ОГОНЬ ПО БАЗЕ</div></div>`);
 H(`<div class="h" style="left:22px;top:172px;width:240px;display:flex;flex-direction:column;gap:12px">
 <div class="btn y" data-a="camp" style="height:58px;font-size:25px;position:relative">▶ КАМПАНИЯ<span class="tag" style="position:absolute;bottom:-9px;right:10px;background:#000c;color:#ffd23f">Глава 1 · ${Math.min(40,S.wins)}/40</span></div>
 <div class="btn b" data-a="ai" style="height:54px;font-size:21px">🎯 БОЙ С ИИ</div>
 <div class="btn m" data-a="raid" style="height:54px;font-size:21px;position:relative">⚔ РЕЙДЫ<span class="dot">!</span></div></div>`);
 const side=[['🏠','База','p','base'],['🐾','Отряд','g','squad'],['💣','Арсенал','o','arsenal'],['🏆','Рейтинг','b','rating'],['🎖','Достижения','y','ach'],['📅','Задания','g','quests']];
 H(`<div class="h" style="right:16px;top:58px;display:grid;grid-template-columns:repeat(2,98px);gap:10px">${side.map(s=>`<div class="btn ${s[2]}" data-a="${s[3]}" style="height:80px;flex-direction:column;font-size:14px;position:relative"><div style="font-size:28px">${s[0]}</div>${s[1]}</div>`).join('')}</div>`);
 H(`<div class="h panel" style="right:16px;top:346px;width:206px;padding:8px 10px" data-a="quests"><div style="font-weight:800;font-size:13px;color:#ffd23f">ЕЖЕДНЕВНЫЕ · ${done}/${QL.length}</div>
 ${QL.slice(0,2).map(z=>`<div style="font-size:11px;margin-top:4px">${z.title}</div><div class="bar" style="margin-top:3px"><i style="width:${Math.min(100,z.v/z.goal*100)}%"></i></div>`).join('')}</div>`);
 H(`<div class="h btn gr" data-a="tut" style="left:22px;top:380px;width:240px;height:36px;font-size:15px">🎓 Обучение</div>`);
 H(`<div class="h" style="left:22px;bottom:10px;font-size:11px;color:#fffa">Сезон 1 «Неоновые хвосты» · до конца ${12}&nbsp;д</div>`);
 on('[data-a=camp]',()=>go('maps',{mode:'camp'}));on('[data-a=ai]',()=>go('maps',{mode:'ai'}));on('[data-a=raid]',()=>raidMenu());
 on('[data-a=base]',()=>go('base'));on('[data-a=squad]',()=>go('squad'));on('[data-a=arsenal]',()=>go('arsenal'));on('[data-a=rating]',()=>go('rating'));on('[data-a=ach]',()=>go('rating'));
 on('[data-a=quests]',()=>questsModal());on('[data-a=settings]',()=>settingsModal());on('[data-a=tut]',()=>startTut());loop();musicOn('menu');
 if(!S.tutDone&&!S.tutAuto&&!SHOT&&S.consent!=null){S.tutAuto=1;save();setTimeout(()=>{if(cur==='menu'&&!S.tutDone)startTut()},300);}
};
// quests: server daily quests when online (claim -> signed grant), local ones offline
function questList(){const sq=Net.syncData&&Net.syncData.quests&&Net.syncData.quests.items;
 if(sq&&sq.length)return sq.map(q=>({id:q.id,title:q.title,goal:q.goal,v:Math.min(q.goal,q.progress|0),claimed:q.claimed,rw:q.reward,srv:true}));
 const q=dq();return QUESTS.map(z=>({id:z[0],title:z[1],goal:z[2],v:Math.min(z[2],q[z[0]]||0),claimed:!!q['c_'+z[0]],rw:{gems:z[3]},srv:false}));}
const rwTxt=r=>Object.entries(r||{}).map(([k,v])=>(k==='gems'?'◆ ':'★ ')+v).join(' ');
function questsModal(){if(app.querySelector('.modalbg'))return;const QL=questList();const m=H(`<div class="modalbg"><div class="panel" style="width:480px;padding:16px 20px"><div class="title" style="font-size:22px">Ежедневные задания</div>
 ${QL.map(z=>`<div style="margin-top:10px"><div class="row" style="justify-content:space-between;font-size:13px"><span>${z.title}</span><span>${z.v}/${z.goal}</span></div><div class="row"><div class="bar" style="flex:1"><i style="width:${z.v/z.goal*100}%"></i></div><div class="btn ${z.v>=z.goal&&!z.claimed?'g':'gr'}" data-q="${z.id}" style="width:110px;height:28px;font-size:12px">${z.claimed?'Получено':rwTxt(z.rw)}</div></div></div>`).join('')}
 <div style="font-size:11px;color:#aaa;margin-top:8px">${QL[0]&&QL[0].srv?'Задания и награды — с сервера, обновляются в 00:00 МСК':'Офлайн-задания (нет связи с сервером)'}</div>
 <div class="btn gr" data-a="close" style="height:40px;margin-top:10px">Закрыть</div></div></div>`);
 m.querySelectorAll('[data-q]').forEach(b=>b.onclick=async()=>{const z=QL.find(x=>x.id===b.dataset.q);if(!z||z.v<z.goal||z.claimed)return;
   if(z.srv){b.textContent='…';const r=await Net.claim('quest',z.id);if(r.offline){toast(r.status===422?'Ещё не выполнено на сервере':'Нет связи');b.textContent=rwTxt(z.rw);return}await Net.sync();}
   else{const q=dq();q['c_'+z.id]=1;S.gems+=z.rw.gems;save();sfx('coin');}
   m.remove();go(cur);questsModal();});
 m.querySelector('[data-a=close]').onclick=()=>m.remove();}
function settingsModal(){if(app.querySelector('.modalbg'))return;const m=H(`<div class="modalbg"><div class="panel" style="width:560px;padding:16px 22px;max-height:450px;overflow:auto"><div class="row" style="justify-content:space-between"><div class="title" style="font-size:22px">Настройки</div><div class="btn gr" data-a="x" style="width:36px;height:32px">✕</div></div>
 <div class="row" style="margin-top:10px;justify-content:space-between"><b>Музыка</b><div class="sw ${S.music?'on':''}" data-k="music"></div></div>
 <div class="row" style="margin-top:8px;justify-content:space-between"><b>Звуки</b><div class="sw ${S.sfx?'on':''}" data-k="sfx"></div></div>
 <div style="margin-top:12px;color:#ffd23f;font-weight:800;font-size:13px">КОНФИДЕНЦИАЛЬНОСТЬ</div>
 <div class="row" style="margin-top:6px;justify-content:space-between"><span>Аналитика</span><div class="sw ${S.stats?'on':''}" data-k="stats"></div></div>
 <div class="row" style="margin-top:6px;justify-content:space-between"><span>Персонализация</span><div class="sw ${S.pers?'on':''}" data-k="pers"></div></div>
 ${PL.push.avail()?`<div style="margin-top:12px;color:#ffd23f;font-weight:800;font-size:13px">УВЕДОМЛЕНИЯ</div>
 ${[['timers','Таймеры'],['rating','Рейтинг'],['tournament','Турниры'],['comeback','Возвращение'],['news','Новости']].map(p=>`<div class="row" style="margin-top:6px;justify-content:space-between"><span>${p[1]}</span><div class="sw ${S.push[p[0]]?'on':''}" data-p="${p[0]}"></div></div>`).join('')}`:''}
 ${PL.social&&PL.social.share?`<div style="margin-top:12px;color:#ffd23f;font-weight:800;font-size:13px">${PL.social.name||'VK'}</div>
 <div class="row" style="margin-top:6px;gap:8px"><div class="btn b" data-a="share" style="flex:1;height:34px;font-size:13px">📣 Рассказать друзьям</div><div class="btn gr" data-a="sup" style="flex:1;height:34px;font-size:13px">💬 Поддержка</div></div>`:''}
 <div style="margin-top:12px;color:#ffd23f;font-weight:800;font-size:13px">АККАУНТ</div>
 <div class="row" style="margin-top:4px;justify-content:space-between;font-size:13px"><span>Ник: <b>${Net.nick||'Полосатый_Хвост'}</b> · ${Net.online?'<span style="color:#7f7">онлайн</span>':'<span style="color:#f99">офлайн</span>'}</span><div class="btn gr" data-a="nick" style="padding:0 10px;height:28px;font-size:12px">Сменить ник</div></div>
 ${PL.id==='vk'||PL.id==='fs'?'':`<div class="row" style="margin-top:6px;justify-content:space-between;font-size:13px"><span>Вход: VK ID ${PL.auth.vkAvail()?'':'— скоро'} · Яндекс ID — скоро</span>${PL.auth.vkAvail()?'<div class="btn b" data-a="vk" style="padding:0 10px;height:28px;font-size:12px">Войти VK ID</div>':''}</div>`}
 <div class="row" style="margin-top:10px;position:sticky;bottom:-16px;background:#1a0f3a;padding:8px 0 10px;z-index:2"><div class="btn r" data-a="del" style="flex:1;height:36px;font-size:13px">Удалить аккаунт</div><div class="btn gr" data-a="close" style="flex:1;height:36px">Закрыть</div></div></div></div>`);
 m.querySelectorAll('.sw').forEach(e=>e.onclick=()=>{if(e.dataset.p){S.push[e.dataset.p]=!S.push[e.dataset.p];e.classList.toggle('on',S.push[e.dataset.p]);PL.push.setCats(S.push);}
   else{const k=e.dataset.k;S[k]=!S[k];e.classList.toggle('on',S[k]);if(k==='music')S.music?musicOn():musicOff();if(k==='stats'||k==='pers')applyConsent();}save();});
 m.querySelector('[data-a=close]').onclick=()=>m.remove();m.querySelector('[data-a=x]').onclick=()=>m.remove();
 m.querySelector('[data-a=nick]').onclick=async()=>{const n=(prompt('Новый ник (3–16 символов)',Net.nick)||'').trim();if(n.length<3)return;const r=await Net.nickSet(n.slice(0,16));toast(r.offline?'Нет связи с сервером':'Ник: '+Net.nick);m.remove();go(cur)};
 const sh=m.querySelector('[data-a=share]');sh&&(sh.onclick=()=>PL.social.share());
 const su=m.querySelector('[data-a=sup]');su&&(su.onclick=()=>window.open(PL.social.support,'_blank'));
 const vk=m.querySelector('[data-a=vk]');vk&&(vk.onclick=()=>PL.auth.vkLogin());
 m.querySelector('[data-a=del]').onclick=async()=>{if(!confirm('Удалить аккаунт и весь прогресс?'))return;await Net.del();localStorage.removeItem('ra_save');location.reload();};}

// ---------- maps (07) ----------
const MAPLIST=[['neon','Средняя','1 400 м','Порывистый','6',['Разрушаемая']],['junk','Длинная','2 200 м','Сильный','9',['Разрушаемая','Укрытия']],['port','Короткая','800 м','Слабый','2',['Разрушаемая','Укрытия','Вода']],
 ['ice','Средняя','1 500 м','Сильный','8',['Разрушаемая']],['roof','Короткая','900 м','Переменный','1–7',['Разрушаемая','Укрытия']],['sewer','Длинная','2 000 м','Нет (под землёй)','0',['Разрушаемая','Укрытия','Вода']]];
let sel={map:'neon',wind:0,diff:2};
SCR.maps=(a)=>{const mode=(a&&a.mode)||'ai';H(bgDiv('bg_neon.jpg',.75));H(topbar('Выбор карты · '+(mode==='camp'?'Кампания':'Бой с ИИ')));
 const g=H(`<div class="h" style="left:16px;top:max(54px,calc(var(--bh,0px) + 4px));right:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px"></div>`);
 MAPLIST.forEach((m,i)=>{const M=MAPS[m[0]]||{name:'Канализация мегаполиса',bg:'bg_port.jpg'};const lock=m[0]==='sewer';const bars=m[1]==='Короткая'?1:m[1]==='Средняя'?2:3;
  const w=+String(m[4]).split('–').pop();const wc=w>=8?'#ff6b5a':w>=5?'#ffc23f':w>0?'#7fdc7f':'#9aa';
  g.insertAdjacentHTML('beforeend',`<div class="panel" data-m="${m[0]}" style="position:relative;height:var(--mch,184px);border-radius:14px;overflow:hidden;padding:0;cursor:pointer;${sel.map===m[0]?'border-color:#ffd23f;box-shadow:0 0 18px #ffd23f99':''}">
  <div style="height:calc(var(--mch,184px) - 72px);background:url(img/${M.bg}) center 30%/cover;${m[0]==='roof'?'filter:hue-rotate(-25deg) saturate(1.3)':''}${lock?'filter:brightness(.4)':''}"></div>
  <div style="position:absolute;left:10px;top:7px;font-weight:800;font-size:15px;text-shadow:0 2px 0 #000,0 0 6px #000">${M.name}</div>
  <div style="position:absolute;right:8px;top:6px;background:#000a;padding:1px 6px;border-radius:6px;font-size:12px">${'▮'.repeat(bars)}<span style="opacity:.3">${'▮'.repeat(3-bars)}</span></div>
  ${sel.map===m[0]?'<div style="position:absolute;left:8px;top:86px" class="tag"><span style="background:#ffd23f;color:#3a1200;padding:2px 8px;border-radius:6px">✔ ВЫБРАНА</span></div>':''}
  <div style="padding:6px 10px;display:flex;gap:8px"><div style="flex:1"><div style="font-size:10px;color:#bbb">ДЛИНА КАРТЫ</div><div style="font-weight:800;font-size:14px">📏 ${m[1]} <span style="font-size:11px;color:#ccc">· ${m[2]}</span></div></div>
  <div style="flex:1"><div style="font-size:10px;color:#bbb">ВЕТЕР</div><div style="font-weight:800;font-size:14px;color:${wc}">🌬 ${m[4]} <span style="font-size:11px">· ${m[3]}</span></div></div></div>
  <div style="padding:0 10px;display:flex;gap:4px">${m[5].map(t=>`<span class="tag" style="background:#ffffff1a;font-size:10px">${t}</span>`).join('')}</div>
  ${lock?'<div style="position:absolute;inset:0;background:#000a;display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="font-size:36px">🔒</div><div style="font-weight:800">Откроется: Глава 3</div></div>':''}</div>`);});
 H(`<div class="h" style="left:16px;top:440px;display:flex;gap:8px;align-items:center"><span style="font-size:12px;color:#ccc">Ветер:</span>${['Как на карте','Выкл','Случайный'].map((t,i)=>`<div class="btn ${sel.wind===i?'b':'gr'}" data-w="${i}" style="padding:0 12px;height:34px;font-size:13px">${t}</div>`).join('')}
 <span style="font-size:12px;color:#ccc;margin-left:10px">ИИ:</span>${['Лёгкий','Средний','Хард'].map((t,i)=>`<div class="btn ${sel.diff===i+1?'p':'gr'}" data-d="${i+1}" style="padding:0 12px;height:34px;font-size:13px">${t}</div>`).join('')}</div>`);
 H(`<div class="h btn y" data-a="go" style="right:16px;top:432px;width:210px;height:50px;font-size:22px">В БОЙ! <span style="font-size:13px;margin-left:8px">⚡3</span></div>`);
 on('[data-m]',e=>{if(e.dataset.m==='sewer'){toast('Откроется в Главе 3');return}sel.map=e.dataset.m;go('maps',a)});
 on('[data-w]',e=>{sel.wind=+e.dataset.w;go('maps',a)});on('[data-d]',e=>{sel.diff=+e.dataset.d;go('maps',a)});
 on('[data-a=go]',()=>{if(S.energy<3){energyModal();return}S.energy-=3;if(S.energy<30&&S.energy+3>=30)S.eAt=Date.now();save();go('battle',{map:sel.map,diff:sel.diff,wind:sel.wind,mode})});
};
function energyModal(){if(app.querySelector('.modalbg'))return;const m=H(`<div class="modalbg"><div class="panel" style="width:380px;padding:18px;text-align:center"><div class="title" style="font-size:22px">Мало энергии ⚡</div><div style="margin:10px 0;color:#ccc">+1 каждые 6 минут</div>
 <div class="btn p" data-a="v" style="height:46px">▶ +5 ⚡ за видео</div><div class="btn gr" data-a="c" style="height:38px;margin-top:8px">Закрыть</div></div></div>`);
 m.querySelector('[data-a=c]').onclick=()=>m.remove();m.querySelector('[data-a=v]').onclick=()=>rewarded('energy',ok=>{if(ok){S.energy+=5;save();}m.remove();go(cur,{mode:'ai'})});}

// ---------- battle (02) ----------
function squadForBattle(){return S.squad.filter(s=>s.hired).slice(0,4).map(s=>({name:s.name,char:s.char,hp:100+(s.lvl-1)*8}))}
function enemyTeam(n,diff){const names=['Бот-1','Бот-2','Бот-3','Бот-4'],ch=['commander','assault','demolition','tech'];return Array.from({length:n},(_,i)=>({name:names[i],char:ch[i%4],hp:90+diff*10}))}
SCR.battle=(a)=>{musicOn('battle');if(!a.tut)TUT.on=false;
 bcv=document.createElement('canvas');bcv.className='full';app.appendChild(bcv);fitCanvas(bcv);
 const M=MAPS[a.map]; const sq=squadForBattle();
 const opt={canvas:bcv,map:a.map,diff:a.diff||2,raid:!!a.raid,baseLv:a.baseLv,squad:sq,enemies:a.raid?enemyTeam(2,a.diff||2):enemyTeam(sq.length,a.diff||2),levels:S.wl,seed:Date.now()&0xffff,
  ammoBonus:a.bonus||{},baseMult:a.baseMult||1,sfx,events:(n,o)=>onBattleEvent(n,o,a)};
 battle=new Battle(opt); if(a.wind===1){battle.map=Object.assign({},M,{wind:0});battle.wind=0;} if(a.wind===2){battle.map=Object.assign({},M,{wind:1+Math.floor(Math.random()*10)});}
 const label=`${M.name} · ${a.raid?(a.online?'Рейд на базу «'+a.opp+'» 🏆'+a.oppCups:'Тренировочный рейд (ИИ)'):'Бой с ИИ ('+['','Лёгкий','Средний','Хард'][a.diff]+')'}`;
 H(`<div class="top bt" style="height:56px"><div class="btn gr" data-a="pause" style="width:48px;height:40px">❚❚</div>
 <div class="res" id="tA" style="background:#e53935cc">🐾 Еноты 0</div><div class="res" id="tB" style="background:#2f80edcc">🤖 ИИ 0</div><div style="flex:1"></div>
 <div class="panel" style="padding:3px 12px;text-align:center;border-radius:10px;min-width:84px"><div style="font-size:10px;color:#ccc">ВЕТЕР</div><div id="wind" style="font-weight:800;font-size:18px;color:#7fdcff">0</div></div>
 <div class="panel" style="padding:3px 12px;text-align:center;border-radius:10px;border-color:#ffd23f;min-width:70px"><div style="font-size:10px;color:#ccc">ХОД</div><div id="tmr" style="font-weight:800;font-size:22px;color:#ffd23f">0:30</div></div></div>`);
 H(`<div class="h" style="left:12px;top:60px;font-size:13px;color:#fffc;text-shadow:0 1px 2px #000;z-index:5;pointer-events:none">${label} · <span id="rnd">Раунд 1</span></div>`);
 H(`<div class="h" id="turnBanner" style="left:0;right:0;top:120px;text-align:center;font-size:28px;font-weight:800;text-shadow:0 3px 0 #000;opacity:0;transition:opacity .4s;pointer-events:none;z-index:6"></div>`);
 const wb=H(`<div class="h" style="left:12px;bottom:6px;display:flex;gap:6px;z-index:5">${WEAPONS.map(w=>`<div class="panel wslot" data-wp="${w.id}"><img src="img/${w.icon}"><div style="font-size:10px;font-weight:800;white-space:nowrap">${w.name}</div><div class="am" style="font-size:10px;color:#ffd23f;font-weight:800">∞</div></div>`).join('')}</div>`);
 H(`<div class="h btn p" data-a="bonus" id="bonusBtn" style="right:12px;bottom:88px;padding:0 12px;height:34px;font-size:14px;z-index:5">▶ +Авиаудар и дрон</div>`);
 H(`<div class="h panel" style="right:178px;bottom:8px;width:176px;padding:7px 10px;border-radius:12px;z-index:5"><div style="font-size:13px;font-weight:800;display:flex;justify-content:space-between"><span id="ang">Угол 0°</span><span id="pow">Сила 0%</span></div><div class="bar" style="height:10px;margin-top:4px"><i id="powb" style="width:0;background:linear-gradient(90deg,#ffd23f,#ff5a2a)"></i></div></div>`);
 H(`<div class="h btn r" data-a="fire" style="right:12px;bottom:8px;width:156px;height:74px;font-size:28px;z-index:5">ОГОНЬ!</div>`);
 H(`<div class="h" style="left:14px;bottom:104px;display:flex;flex-direction:column;gap:10px;z-index:5"><div class="btn gr" data-a="jump" style="width:60px;height:56px;font-size:26px">⤒</div><div class="btn gr" id="walkBtn" style="width:60px;height:56px;font-size:26px">⇆</div></div>`);
 on('[data-a=pause]',()=>pauseMenu());on('[data-a=fire]',()=>{if(TUT.on&&TUT.i<5){toast('Сначала выполни подсказку');return}battle.fire()&&(TF.fire=1)||toast(battle.wsel==='air'||battle.wsel==='tele'?'Коснись цели на карте':'Нет боезапаса')});
 on('[data-a=jump]',()=>{battle.jump();TF.move=1});on('[data-wp]',e=>{if(battle.state!=='aim')return;const id=e.dataset.wp;if(battle.ammo[0][id]===0){toast('Нет боезапаса');return}battle.wsel=id;battle.target=null;sfx('select');});
 on('[data-a=bonus]',e=>{if(battle.bonusUsed)return;rewarded('weapon',ok=>{if(ok){battle.ammo[0].air++;battle.ammo[0].drone++;battle.bonusUsed=true;e.style.display='none';toast('+1 Авиаудар, +1 Дрон')}})});
 // walk button: tap = turn around, hold = walk
 const wbtn=$('#walkBtn');let wT=0,wHold=null;
 wbtn.addEventListener('pointerdown',e=>{e.preventDefault();TF.move=1;wT=performance.now();wHold=setTimeout(()=>battle.walk(battle.cur.face),160)});
 const wUp=()=>{clearTimeout(wHold);if(performance.now()-wT<160&&battle.state==='aim'){battle.cur.face*=-1;battle.aimA=Math.PI-battle.aimA;}battle.walk(0)};
 wbtn.addEventListener('pointerup',wUp);wbtn.addEventListener('pointerleave',()=>{clearTimeout(wHold);battle.walk(0)});
 // canvas input: drag near unit = aim; drag elsewhere = pan; tap = target (air/tele) / drone steer
 let drag=null;
 const pt=e=>{const r=bcv.getBoundingClientRect();return{x:(e.clientX-r.left)/r.height*490,y:(e.clientY-r.top)/r.height*490}};
 const ptrs=new Map();let pinch=null;
 bcv.addEventListener('pointerdown',e=>{try{bcv.setPointerCapture(e.pointerId)}catch(_){}ptrs.set(e.pointerId,pt(e));
   if(ptrs.size===2){const [a1,a2]=[...ptrs.values()];pinch={d:Math.hypot(a1.x-a2.x,a1.y-a2.y),z:battle.vh};drag=null;return;}
   const p=pt(e);const w=battle.toWorld(p.x,p.y);
   if(battle.state==='fly'){battle.droneSteer=w;drag={mode:'steer'};return;}
   if(battle.state!=='aim')return;const u=battle.cur,us=battle.toScreen(u.x,u.y-34);
   const tgtW=battle.wsel==='air'||battle.wsel==='tele';
   drag={mode:(!tgtW&&Math.hypot(p.x-us.x,p.y-us.y)<190)?'aim':'pan',sx:p.x,sy:p.y,cam:battle.camX,moved:0};
   if(drag.mode==='aim')aimTo(p);});
 const move=e=>{if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,pt(e));if(pinch&&ptrs.size===2){const [a1,a2]=[...ptrs.values()];battle.setZoom(pinch.z*pinch.d/Math.max(20,Math.hypot(a1.x-a2.x,a1.y-a2.y)));return;}
   if(!drag||!battle)return;const p=pt(e);
   if(drag.mode==='steer'){battle.droneSteer=battle.toWorld(p.x,p.y);return;}
   drag.moved=Math.max(drag.moved,Math.hypot(p.x-drag.sx,p.y-drag.sy));
   if(drag.mode==='aim')aimTo(p);else{const k=bcv.height/490/battle.scale();battle.pan=null;battle.camX=Math.max(0,Math.min(battle.W-battle.viewW(),drag.cam-(p.x-drag.sx)*k));battle.pan=battle.camX+battle.viewW()/2;}};
 const up=e=>{ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;if(!drag||!battle)return;const p=pt(e);if(drag.mode==='pan'&&drag.moved<8&&(battle.wsel==='air'||battle.wsel==='tele')){const w=battle.toWorld(p.x,p.y);battle.setTarget(w.x,w.y);}
   if(drag.mode==='pan'&&drag.moved<8&&!(battle.wsel==='air'||battle.wsel==='tele'))aimTo(p);
   drag=null;setTimeout(()=>{if(battle)battle.pan=null},1500)};
 // window-level: drags keep working over the HUD and outside the canvas / iframe edge
 window.__bMove=move;window.__bUp=up;window.__bCancel=e=>{ptrs.delete(e.pointerId);pinch=null;drag=null};
 if(!window.__bWin){window.__bWin=1;addEventListener('pointermove',e=>window.__bMove&&window.__bMove(e));addEventListener('pointerup',e=>window.__bUp&&window.__bUp(e));addEventListener('pointercancel',e=>window.__bCancel&&window.__bCancel(e));}
 bcv.addEventListener('wheel',e=>{e.preventDefault();battle&&battle.setZoom(battle.vh*(e.deltaY>0?1.08:1/1.08))},{passive:false});
 function aimTo(p){const u=battle.cur,us=battle.toScreen(u.x,u.y-34);const dx=p.x-us.x,dy=p.y-us.y;battle.setAim(Math.atan2(dy,dx),Math.hypot(dx,dy)/150);}
 // keyboard (desktop testing)
 // keyboard (desktop): ↑/↓ angle, ←/→ power, A/D walk, W/Enter jump, Space fire, +/- zoom
 onkeydown=e=>{if(!battle||battle.paused)return;const k=e.key,u=battle.cur;
   if(k==='ArrowUp'||k==='ArrowDown'||k==='ArrowLeft'||k==='ArrowRight'||k===' ')e.preventDefault();
   if(battle.state==='aim'&&u&&battle.team===0){const f=u.face||1;
     if(k==='ArrowUp'||k==='ArrowDown'){let el=f>0?-battle.aimA:Math.PI+battle.aimA;el+=(k==='ArrowUp'?1:-1)*Math.PI/90;el=Math.max(-Math.PI/2+.05,Math.min(Math.PI/2-.01,el));battle.setAim(f>0?-el:-(Math.PI-el),battle.aimP);}
     if(k==='ArrowLeft'||k==='ArrowRight')battle.setAim(battle.aimA,battle.aimP+(k==='ArrowRight'?.02:-.02));}
   if(k==='a'||k==='A'||k==='ф'||k==='Ф')battle.walk(-1);if(k==='d'||k==='D'||k==='в'||k==='В')battle.walk(1);
   if(k===' '){if(battle.fire())TF.fire=1;}if(k==='Enter'||k==='w'||k==='W'||k==='ц'||k==='Ц'){battle.jump();TF.move=1;}
   if(k==='+'||k==='=')battle.setZoom(battle.vh/1.1);if(k==='-'||k==='_')battle.setZoom(battle.vh*1.1);};
 onkeyup=e=>{const k=e.key;if(battle&&'aAdDфФвВ'.includes(k))battle.walk(0)};
 let lastTick=0;if(a.tut)tutStart();
 const el={tA:$('#tA'),tB:$('#tB'),wind:$('#wind'),tmr:$('#tmr'),ang:$('#ang'),pow:$('#pow'),powb:$('#powb'),rnd:$('#rnd')};
 loopFns.push((dt)=>{if(!battle||battle.paused)return;battle.update(dt);battle.render();if(battle.state==='aim'&&battle.team===0){const tc=Math.ceil(battle.timer);if(tc<=5&&tc!==lastTick){lastTick=tc;sfx('tick');}}
   if(a.tut)tutTick();
   const sum=t=>battle.units.filter(u=>u.team===t&&u.alive).reduce((s,u)=>s+Math.max(0,u.hp),0);
   el.tA.textContent='🐾 Еноты '+sum(0); el.tB.textContent=(a.raid?'🏰 База ':'🤖 ИИ ')+(a.raid?Math.round(battle.bld.reduce((s,b)=>s+b.hp,0)):sum(1));
   const w=battle.wind;el.wind.textContent=w===0?'— 0':(w<0?'◀'.repeat(Math.min(3,Math.ceil(-w/3)))+' '+(-w):w+' '+'▶'.repeat(Math.min(3,Math.ceil(w/3))));
   el.tmr.textContent='0:'+String(Math.max(0,Math.ceil(battle.timer))).padStart(2,'0');
   el.ang.textContent='Угол '+Math.round(-battle.aimA*180/Math.PI)+'°';el.pow.textContent='Сила '+Math.round(battle.aimP*100)+'%';el.powb.style.width=battle.aimP*100+'%';
   el.rnd.textContent='Раунд '+Math.ceil(battle.stats.turns/2);
   wb.querySelectorAll('[data-wp]').forEach(s=>{const n=battle.ammo[0][s.dataset.wp];s.querySelector('.am').textContent=n<0?'∞':n;s.classList.toggle('sel',battle.wsel===s.dataset.wp&&battle.team===0);s.classList.toggle('empty',n===0)});});
 loop();ev('battle_start',{map:a.map,diff:a.diff,raid:!!a.raid});
};
function onBattleEvent(n,o,a){
 if(n==='turn'){if(o.team===0)sfx('turn');const b=$('#turnBanner');if(b){b.textContent=(o.team===0?'Твой ход: ':'Ход: ')+o.name;b.style.color=o.team?'#7fdcff':'#ffd23f';b.style.opacity=1;setTimeout(()=>b.style.opacity=0,1100);}}
 if(n==='end')battleEnd(o,a);
}
function battleEnd(o,a){const win=o.res==='win';S.games++;if(a.tut){S.tutDone=1;TUT.on=false;}
 const st=o.stats;S.ach.dmgTotal=(S.ach.dmgTotal||0)+st.dmg;Object.assign(S.used,st.weapons);qAdd('shots',st.shots);if(st.weapons.air)qAdd('air',1);qAdd('dmg_bz',st.dmg);
 const dur=Math.round(battle.t);PL.levelEnd();ev(win?'battle_win':'battle_lose',{map:a.map,diff:a.diff,raid:!!a.raid});
 if(win){S.wins++;qAdd('win',1);if(a.diff===3)S.ach.hardWin=1;if(a.map==='ice')S.ach.iceWin=1;if(Math.abs(battle.map.wind)>=8)S.ach.windWin=1;}
 if(a.raid&&a.online){save();sfx(win?'win':'lose');return raidEndOnline(o,a,dur);}
 let reward=0,gems=0,stars=Math.max(1,Math.min(3,o.alive));
 if(win){reward=a.raid?250+a.diff*60:80+a.diff*50+o.alive*20;gems=a.diff===3?5:(Math.random()<.3?2:0);
   if(a.raid){S.raidsWon++;qAdd('raid',1);} S.coins+=reward;S.gems+=gems;
   if(a.mode==='camp'){S.campLvl=Math.min(40,S.campLvl+1);S.campStars=Math.min(3000,S.campStars+stars);ev('level_win');
     Net.progress({levels_won:1,campaign_stars:S.campStars,play_sec:dur});Net.score('camp',S.campStars,dur);}
   else Net.progress({play_sec:dur});}
 else {if(a.mode==='camp')ev('level_lose');Net.progress({play_sec:dur});}
 save();sfx(win?'win':'lose');
 const canRevive=!win&&!battle.revived;
 const m=H(`<div class="modalbg" data-lock="1"><div class="panel" style="width:430px;padding:20px;text-align:center">
 <div class="title" style="font-size:40px;color:${win?'#ffd23f':'#ff6b6b'}">${win?(a.raid?'Штаб разрушен!':'Победа!'):'Поражение'}</div>
 ${win?`<div style="font-size:34px;margin:6px 0">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</div><div class="row" style="justify-content:center;gap:16px;font-size:18px;font-weight:800"><span><span class="ic i-coin" style="vertical-align:middle"></span> +${reward}</span>${gems?`<span><span class="ic i-gem" style="vertical-align:middle"></span> +${gems}</span>`:''}</div>`:'<div style="margin:10px 0;color:#ccc">Отряд разбит…</div>'}
 ${a.raid?'<div style="font-size:12px;color:#aaa;margin-top:6px">Тренировочная ИИ-база: кубки не меняются</div>':''}
 ${win?`<div class="btn p" data-a="x2" style="height:46px;margin-top:14px">▶ ×2 награда (видео)</div>`:''}
 ${canRevive?`<div class="btn p" data-a="rev" style="height:46px;margin-top:14px">▶ Воскресить бойца (видео)</div>`:''}
 <div class="row" style="margin-top:10px"><div class="btn ${win?'y':'g'}" data-a="again" style="flex:1;height:44px">${win?'Ещё бой':'Заново'}</div><div class="btn gr" data-a="menu" style="flex:1;height:44px">В меню</div></div></div></div>`);
 const x2=m.querySelector('[data-a=x2]');x2&&(x2.onclick=()=>rewarded('x2',ok=>{if(ok){S.coins+=reward;save();toast('+'+reward+' монет');x2.remove();}}));
 const rv=m.querySelector('[data-a=rev]');rv&&(rv.onclick=()=>rewarded('revive',ok=>{if(ok&&battle.revive()){S.games--;m.remove();}}));
 m.querySelector('[data-a=again]').onclick=()=>{a.raid?raidMenu():go('maps',{mode:a.mode})};m.querySelector('[data-a=menu]').onclick=()=>go('menu');
 if(win&&!S.pushAsked)setTimeout(()=>pushPrompt(),600);
 interMaybe();
}
// online raid result -> server decides cups/loot (422 implausible, 410 expired handled)
async function raidEndOnline(o,a,dur){const R=o.raid||{pct:0,stars:0,dur};const pct=R.pct,stars=R.stars;
 const wall=(Date.now()-a.t0)/1000; const d=Math.max(8,Math.min(240,Math.floor(Math.min(R.dur,wall))));
 const loot={coins:Math.min(Math.floor(50*pct),stars?Math.round(pct*4+stars*50):Math.round(pct*2)),gems:stars===3?2:stars===2?1:0};
 const m=H(`<div class="modalbg" data-lock="1"><div class="panel" style="width:440px;padding:20px;text-align:center"><div class="title" style="font-size:34px;color:${stars?'#ffd23f':'#ff6b6b'}">${stars?'Рейд успешен!':'Рейд провален'}</div>
  <div style="font-size:34px;margin:4px 0">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</div><div style="font-size:14px">База «${a.opp}» разрушена на <b>${pct}%</b></div>
  <div id="rres" style="margin-top:10px;font-weight:800;font-size:18px">Отправка результата…</div>
  <div class="row" style="margin-top:14px"><div class="btn y" data-a="again" style="flex:1;height:44px">Новый рейд</div><div class="btn gr" data-a="menu" style="flex:1;height:44px">На базу</div></div></div></div>`);
 m.querySelector('[data-a=again]').onclick=()=>raidMenu();m.querySelector('[data-a=menu]').onclick=()=>go('base');
 const out=m.querySelector('#rres');
 const j=d<8?{implausible:true}:await Net.raidResult(a.raidId,{stars,destroyed:pct,duration:d,loot});
 if(j.implausible){out.innerHTML='<span style="color:#f99">Сервер не принял результат рейда.<br><span style="font-size:13px">Кубки и добыча не начислены.</span></span>';return;}
 if(j.expired){out.innerHTML='<span style="color:#f99">Рейд устарел (больше 15 минут). Результат не засчитан.</span>';return;}
 if(j.offline||j.limited){out.innerHTML='<span style="color:#f99">Нет связи с сервером — результат не засчитан.</span>';return;}
 const lc=(j.loot&&j.loot.coins)|0,lg=(j.loot&&j.loot.gems)|0;S.coins+=lc;S.gems+=lg;S.cups=j.cups|0;if(j.win){S.raidsWon++;qAdd('raid',1);}save();
 out.innerHTML=`<span style="color:${j.delta>=0?'#7f7':'#f77'}">🏆 ${j.delta>=0?'+':''}${j.delta} (всего ${j.cups})</span><br><span style="font-size:16px"><span class="ic i-coin" style="vertical-align:middle"></span> +${lc}${lg?` &nbsp;<span class="ic i-gem" style="vertical-align:middle"></span> +${lg}`:''}</span>${a.revenge?'<br><span style="font-size:12px;color:#ffd23f">Реванш ×1.5</span>':''}`;
 if(j.unlocked&&j.unlocked.length)toast('Достижение открыто! Забери в «Рейтинге»');
 Net.sync();if(j.win&&!S.pushAsked)setTimeout(()=>pushPrompt(),600);interMaybe();
}
function pauseMenu(){if(!battle||battle.over)return;if(app.querySelector('.modalbg'))return;battle.paused=true;const m=H(`<div class="modalbg" data-p="1"><div class="panel" style="width:340px;padding:18px;text-align:center"><div class="title">Пауза</div>
 <div class="btn g" data-a="c" style="height:46px;margin-top:12px">Продолжить</div><div class="btn b" data-a="mu" style="height:40px;margin-top:8px">${S.music?"🔊 Музыка: вкл":"🔇 Музыка: выкл"}</div><div class="btn b" data-a="sx" style="height:40px;margin-top:8px">${S.sfx?"🔊 Звуки: вкл":"🔇 Звуки: выкл"}</div><div class="btn r" data-a="q" style="height:42px;margin-top:8px">Сдаться и выйти</div></div></div>`);
 m.querySelector('[data-a=mu]').onclick=e=>{S.music=!S.music;save();S.music?musicOn('battle'):musicOff();e.target.textContent=S.music?'🔊 Музыка: вкл':'🔇 Музыка: выкл'};
 m.querySelector('[data-a=sx]').onclick=e=>{S.sfx=!S.sfx;save();e.target.textContent=S.sfx?'🔊 Звуки: вкл':'🔇 Звуки: выкл'};
 m.querySelector('[data-a=c]').onclick=()=>{battle.paused=false;m.remove()};m.querySelector('[data-a=q]').onclick=e=>{const b=m.querySelector('[data-a=q]');if(!b.dataset.sure){b.dataset.sure=1;b.textContent='Точно? Нажми ещё раз';setTimeout(()=>{if(b.isConnected){delete b.dataset.sure;b.textContent='Сдаться и выйти'}},2500);return}go('menu')};}
let raidBusy=false;
function raidMenu(){if(app.querySelector('.modalbg'))return;const so=PL.social;
 const m=H(`<div class="modalbg"><div class="panel" style="width:340px;padding:18px;text-align:center"><div class="title">Рейд: кого атакуем?</div>
 ${so&&!so.noFriends?'<div class="btn b" data-a="fr" style="height:46px;margin-top:12px">👥 Друг из VK</div>':''}<div class="btn g" data-a="rnd" style="height:46px;margin-top:8px">🎲 Случайный игрок</div>
 <div class="btn b" data-a="aib" style="height:46px;margin-top:8px">🤖 ИИ-база</div><div class="btn r" data-a="x" style="height:40px;margin-top:8px">Отмена</div></div></div>`);
 const q=(a,f)=>{const e=m.querySelector('[data-a='+a+']');if(e)e.onclick=f};
 q('x',()=>m.remove());q('rnd',()=>{m.remove();startRaid()});q('aib',()=>{m.remove();startRaid(null,'ai')});q('fr',()=>{m.remove();friendMenu()});}
async function friendMenu(){const so=PL.social;toast('Загружаем друзей…');const fr=await so.friends().catch(()=>[])||[];
 const j=fr.length?await Net.raidFriends(fr.map(f=>f.id)):{friends:[]};const on={};for(const f of (j.friends||[]))on[f.vk_id]=f;
 const pl=fr.filter(f=>on[f.id]&&on[f.id].has_base);
 const m=H(`<div class="modalbg"><div class="panel" style="width:360px;padding:18px;text-align:center;max-height:80%;overflow:auto;touch-action:pan-y"><div class="title">Друзья</div>
 ${pl.length?pl.map(f=>`<div class="btn g" data-pid="${on[f.id].player_id}" style="height:42px;margin-top:8px">⚔ ${esc(f.name)} · ${on[f.id].cups|0}🏆</div>`).join(''):'<div style="margin:12px 0">Пока никто из друзей не играет — позови их!</div>'}
 <div class="btn b" data-a="inv" style="height:42px;margin-top:10px">✉ Пригласить друзей</div><div class="btn r" data-a="x" style="height:40px;margin-top:8px">Назад</div></div></div>`);
 m.querySelector('[data-a=x]').onclick=()=>{m.remove();raidMenu()};m.querySelector('[data-a=inv]').onclick=()=>so.invite();
 m.querySelectorAll('[data-pid]').forEach(b=>b.onclick=()=>{m.remove();startRaid(null,'friend',b.dataset.pid)});}
async function startRaid(revengeId,kind,fpid){if(raidBusy)return;if(S.energy<5){energyModal();return}
 const maps0=['neon','junk','ice','port'];
 if(kind==='ai'){S.energy-=5;save();go('battle',{map:maps0[Math.random()*4|0],diff:2,raid:true,mode:'raid',baseMult:1+S.raidsWon*.08});return}
 raidBusy=true;toast(revengeId?'Ищем обидчика…':kind==='friend'?'Летим к другу…':'Ищем базу соперника…');
 const r=revengeId?await Net.raidRevenge(revengeId):kind==='friend'?await Net.raidFriend(fpid):await Net.raidFind();raidBusy=false;
 if(r.wait){toast('Поиск рейда будет доступен через '+r.wait+' с');return}
 const maps=['neon','junk','ice','port'],map=maps[Math.random()*4|0];
 if(r.opponent&&r.raid_id){const b=r.opponent.base||{},lv={};for(const k of Object.keys(BLD))lv[k]=Math.max(1,Math.min(15,parseInt((b.lv||{})[k])||1));
   S.energy-=5;save();ev(revengeId?'revenge':'raid_start');
   go('battle',{map,diff:Math.min(3,1+Math.floor((r.opponent.cups|0)/300)),raid:true,online:true,mode:'raid',raidId:r.raid_id,t0:Date.now(),baseLv:lv,opp:r.opponent.nickname||'Игрок',oppCups:r.opponent.cups|0,revenge:!!revengeId});return;}
 if(r.error&&revengeId){toast('Реванш недоступен: '+(r.status===409?'уже был':r.status===410?'истёк срок':'ошибка'));return}
 toast(r.offline?'Нет связи — тренировочный рейд на ИИ-базу':'Соперников пока нет — тренировочная ИИ-база');
 S.energy-=5;save();go('battle',{map,diff:2,raid:true,mode:'raid',baseMult:1+S.raidsWon*.08});}
function baseSnap(){return {v:1,lv:Object.assign({},S.base),squad:S.squad.filter(s=>s.hired).map(s=>[s.char,s.lvl]).slice(0,4),layout:'std'}}
function sendBase(force){const js=JSON.stringify(baseSnap());if(!force&&S.baseSent===js)return;Net.basePut(baseSnap(),1).then(j=>{if(j&&j.ok){S.baseSent=js;if(j.cups!=null)S.cups=j.cups;save();}})}
function pushPrompt(){S.pushAsked=true;save();const m=H(`<div class="modalbg" style="z-index:45"><div class="panel" style="width:420px;padding:18px;text-align:center"><div class="title" style="font-size:22px">Напомнить, когда отряд будет готов?</div>
 <div style="color:#ccc;margin:8px 0;font-size:13px">Сообщим о готовых улучшениях и атаках на базу. Не чаще 1 раза в день.</div>
 <div class="btn g" data-a="y" style="height:44px">Да, напомнить</div><div class="btn gr" data-a="n" style="height:36px;margin-top:8px">Не сейчас</div></div></div>`);
 m.querySelector('[data-a=y]').onclick=()=>{PL.push.ask();ev('push_permission_prompt',{yes:1});m.remove()};m.querySelector('[data-a=n]').onclick=()=>m.remove();}
window.__pushPerm=g=>ev('push_permission',{granted:!!g});

// ---------- tutorial (v0.3) ----------
const TF={};const TUT={on:false,i:0,el:null};
const TSTEPS=[
 ['🎯 Прицел','Проведи пальцем от своего енота: направление — куда лететь, расстояние — сила выстрела.','aim'],
 ['💪 Сила и угол','Чем дальше палец от енота, тем сильнее выстрел. Угол и силу видно внизу справа.','next','#powb'],
 ['🌬 Ветер','Ветер вверху справа сносит ракеты и авиаудар. Стрелки — куда дует, число — насколько сильно.','next','#wind'],
 ['🧨 Оружие','Выбери другое оружие на панели внизу — например, гранату.','weapon'],
 ['🐾 Движение','⇆: удерживай, чтобы идти, коротко нажми, чтобы развернуться. ⤒ — прыжок.','move'],
 ['🔥 Огонь!','Жми «ОГОНЬ!». После выстрела ход переходит к противнику. На ход 30 секунд.','fire'],
 ['🏆 Отлично!','Ты готов, командир! Разбей вражеский отряд. Обучение можно пройти снова из меню.','next']];
function startTut(){go('battle',{map:'port',diff:1,wind:0,mode:'ai',tut:true});}
function tutStart(){TUT.on=true;TUT.i=0;for(const k in TF)delete TF[k];TUT.a0=battle.aimA;tutShow();}
function tutShow(){TUT.el&&TUT.el.remove();document.querySelectorAll('.tuthl').forEach(e=>e.classList.remove('tuthl'));if(!TUT.on)return;const st=TSTEPS[TUT.i];
 TUT.el=H(`<div class="h tutb"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:20px;color:#ffd23f">${st[0]}</b><span style="font-size:12px;color:#aab">${TUT.i+1}/${TSTEPS.length}</span></div>
 <div style="font-size:16px;margin-top:6px;line-height:1.35">${st[1]}</div><div class="row" style="margin-top:8px;justify-content:flex-end;gap:10px">
 <div class="btn gr" data-t="skip" style="height:34px;padding:0 12px;font-size:13px">Пропустить</div>${st[2]==='next'?'<div class="btn y" data-t="next" style="height:34px;padding:0 18px;font-size:15px">Далее</div>':''}</div></div>`);
 if(st[3]){const h=$(st[3]);h&&(h.closest('.panel')||h).classList.add('tuthl');}
 if(st[2]==='weapon')document.querySelectorAll('.wslot').forEach(e=>e.classList.add('tuthl'));
 if(st[2]==='move')$('#walkBtn').parentNode.classList.add('tuthl');
 if(st[2]==='fire')document.querySelector('[data-a=fire]').classList.add('tuthl');
 TUT.el.querySelector('[data-t=skip]').onclick=()=>{TUT.on=false;S.tutDone=1;save();tutShow();};
 const n=TUT.el.querySelector('[data-t=next]');n&&(n.onclick=()=>tutNext());}
function tutNext(){sfx('coin');TUT.i++;if(TUT.i>=TSTEPS.length){TUT.on=false;S.tutDone=1;save();}tutShow();}
function tutTick(){if(!TUT.on||!battle)return;const k=TSTEPS[TUT.i][2];if(TUT.i<6&&battle.team===0&&battle.state==='aim')battle.timer=30;
 if(k==='aim'&&battle.cur&&battle.cur.anim==='aim'&&Math.abs(battle.aimA-TUT.a0)>.05)tutNext();
 else if(k==='weapon'&&battle.wsel!=='bazooka')tutNext();
 else if(k==='move'&&TF.move&&(battle.moved>8||!battle.cur.ground))tutNext();
 else if(k==='fire'&&TF.fire)tutNext();}

// ---------- arsenal (03) ----------
let wSel='bazooka';
const WSTAT={bazooka:'Ракета летит по дуге, сносит ветром. Боезапас ∞.',grenade:'Отскакивает, взрыв через 3 с. Ветер не влияет.',shotgun:'Три дробины по прямой — для ближнего боя.',air:'Самолёт сбрасывает 5 бомб на выбранную точку.',drone:'Летит прямо, ведёшь пальцем, взрывается при касании.',tele:'Мгновенно переносит бойца в выбранную точку.'};
const wcost=L=>Math.round(200*Math.pow(1.35,L-1)/10)*10;
SCR.arsenal=()=>{H(bgDiv('bg_neon.jpg',.7));H(topbar('Арсенал'));const maxL=4+S.base.workshop*2;
 const cards=WEAPONS.map(w=>[w.id,w.icon,w.name,'Ур. '+S.wl[w.id]]).concat([['mag','','Магнитная мина','🔒 Глава 3'],['tor','','Торнадо-пушка','🔒 Рейды 10']]);
 H(`<div class="h" style="left:16px;top:54px;width:440px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${cards.map(c=>`<div class="panel" data-w="${c[0]}" style="height:122px;border-radius:12px;text-align:center;padding-top:8px;cursor:pointer;${wSel===c[0]?'border-color:#29d3ff;box-shadow:0 0 14px #29d3ff99':''};${c[3].includes('🔒')?'filter:grayscale(1) brightness(.6)':''}">
  ${c[1]?`<img src="img/${c[1]}" style="height:46px;max-width:90px;object-fit:contain">`:`<div style="font-size:40px;height:46px">${c[0]==='mag'?'🧲':'🌪'}</div>`}<div style="font-weight:800;font-size:12px;margin-top:4px;min-height:30px">${c[2]}</div><div class="tag" style="background:#0008;color:#ffd23f">${c[3]}</div></div>`).join('')}</div>`);
 H(`<div class="h panel" style="left:16px;top:316px;width:440px;height:158px;padding:10px 14px"><div style="font-weight:800;color:#ffd23f">ПРОКАЧКА</div>
 <div style="font-size:12px;color:#ddd;margin-top:4px;line-height:1.45">• Монеты ★ — уровни оружия (до 15)<br>• Урон +6%, радиус +3%, меньше сносит ветром за уровень<br>• Мастерская на базе ограничивает макс. уровень (сейчас ${maxL})<br>• Видео даёт монеты — только по желанию</div>
 <div style="display:flex;gap:8px;margin-top:8px"><span class="tag" style="background:#0007">🏭 Мастерская ур. ${S.base.workshop}</span><span class="tag" style="background:#0007">Макс. ур. ${maxL}</span></div></div>`);
 const w=WEAPONS.find(x=>x.id===wSel),L=S.wl[w.id],c=wcost(L);
 const st=[['Урон',`${Math.round(w.dmg*(1+.06*(L-1)))} → ${Math.round(w.dmg*(1+.06*L))}`,L/15],['Радиус взрыва',`${Math.round(w.r*(1+.03*(L-1)))} → ${Math.round(w.r*(1+.03*L))}`,L/15*.9],['Отталкивание','x'+(1+L*.02).toFixed(2),L/18],['Влияние ветра',`−${Math.round(3*(L-1))}%`,L/20]];
 H(`<div class="h panel" style="left:470px;top:54px;width:474px;height:420px;padding:14px 18px">
 <div style="display:flex;gap:14px;align-items:center"><img src="img/${w.icon}" style="height:70px;width:90px;object-fit:contain"><div><div class="title">${w.name}</div><div class="tag" style="background:#ffd23f;color:#3a1200">Уровень ${L} / 15</div><div style="font-size:12px;color:#ccc;margin-top:4px">${WSTAT[w.id]}</div></div></div>
 ${st.map(s=>`<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800"><span>${s[0]}</span><span style="color:#7f7">${s[1]}</span></div><div class="bar" style="height:10px;margin-top:4px"><i style="width:${Math.min(100,s[2]*100)}%"></i></div></div>`).join('')}
 <div style="margin-top:14px;font-size:12px;font-weight:800;color:#ffd23f">МОДУЛИ</div>
 <div style="display:flex;gap:8px;margin-top:6px">${['🔥 Напалм','❄ Заморозка','🔒 Кассета (ур.10)'].map((m,i)=>`<div class="tag" style="background:#0007;border:2px solid #555;font-size:12px;padding:5px 9px">${m}</div>`).join('')}<span style="font-size:11px;color:#999;align-self:center">скоро</span></div>
 <div style="display:flex;gap:10px;margin-top:16px"><div class="btn ${L<maxL&&S.coins>=c?'g':'gr'}" data-a="up" style="flex:1;height:52px;font-size:18px">${L>=15?'МАКС.':L>=maxL?'НУЖНА МАСТЕРСКАЯ':`УЛУЧШИТЬ <span class="ic i-coin" style="margin:0 4px 0 10px"></span>${c.toLocaleString('ru')}`}</div><div class="btn p" data-a="vid" style="width:150px;height:52px;font-size:14px;flex-direction:column;line-height:1.1">▶ Видео<span style="font-size:11px">+150 монет</span></div></div></div>`);
 on('[data-w]',e=>{if(e.dataset.w==='mag'||e.dataset.w==='tor'){toast('Скоро');return}wSel=e.dataset.w;go('arsenal')});
 on('[data-a=up]',()=>{if(L>=15||L>=maxL){toast(L>=15?'Максимум':'Улучши Мастерскую на базе');return}if(S.coins<c){toast('Не хватает монет');return}S.coins-=c;S.wl[w.id]++;save();sfx('coin');go('arsenal')});
 on('[data-a=vid]',()=>rewardedCoins());
};
function shopModal(){if(app.querySelector('.modalbg'))return;const so=PL.social;
 const m=H(`<div class="modalbg"><div class="panel" style="width:380px;padding:18px;text-align:center;max-height:85%;overflow:auto;touch-action:pan-y"><div class="title">Магазин</div>
 ${PL.ads.noDemo&&!PL.ads.rewardedAvail()?'':'<div class="btn g" data-a="rv" style="height:42px;margin-top:10px">▶ Видео: +150 монет</div>'}
 ${so.items.map(i=>`<div class="btn b" data-it="${i[0]}" style="height:42px;margin-top:8px"><span class="ic i-${i[3]}"></span> ${i[1]} — ${i[2]} ${so.cur?so.cur:so.onOK?'ОК':i[2]%10===1&&i[2]%100!==11?'голос':i[2]%10>=2&&i[2]%10<=4&&(i[2]%100<10||i[2]%100>=20)?'голоса':'голосов'}</div>`).join('')}
 <div class="btn r" data-a="x" style="height:40px;margin-top:10px">Закрыть</div></div></div>`);
 m.querySelector('[data-a=x]').onclick=()=>m.remove();const rvb=m.querySelector('[data-a=rv]');rvb&&(rvb.onclick=()=>{m.remove();rewardedCoins()});
 m.querySelectorAll('[data-it]').forEach(b=>b.onclick=async()=>{if(so.ready&&!(await so.ready())){toast('Покупки временно недоступны');return}const ok=await so.pay(b.dataset.it);if(!ok)return;m.remove();toast('Оплата прошла — начисляем…');
   for(const t of [1500,4000,10000,25000])setTimeout(()=>Net.sync(),t);});}
function rewardedCoins(){if(Date.now()-S.rvAt<120000){toast('Видео будет доступно через '+Math.ceil((120000-(Date.now()-S.rvAt))/1000)+' с');return}rewarded('coins',ok=>{if(ok){S.coins+=150;S.rvAt=Date.now();save();sfx('coin');go(cur)}})}

// ---------- squad (04) ----------
SCR.squad=()=>{H(bgDiv('bg_junk.jpg',.6));H(topbar('Отряд'));
 const cards=H(`<div class="h" style="left:16px;top:58px;display:flex;gap:10px"></div>`);const cvs=[];
 S.squad.forEach((s,i)=>{const cost=Math.round(150*Math.pow(1.4,s.lvl-1)/10)*10;
  cards.insertAdjacentHTML('beforeend',`<div class="panel" style="width:142px;height:270px;border-radius:14px;text-align:center;padding-top:6px;${i==0?'border-color:#ffd23f':''};${s.hired?'':'filter:brightness(.55)'}">
   <div style="font-weight:800">${s.name}</div><div class="tag" style="background:#0008;color:#ffd23f">${s.role}</div>
   <canvas data-c="${i}" width="240" height="220" style="width:120px;height:110px;display:block;margin:0 auto"></canvas>
   <div style="font-size:12px;font-weight:800">Ур. ${s.lvl} · ❤ ${100+(s.lvl-1)*8}</div><div class="bar" style="margin:4px 14px"><i style="width:${s.lvl/20*100}%;background:linear-gradient(90deg,#7fdcff,#2a7fff)"></i></div>
   <div style="font-size:10px;color:#ccc">Навык: ${s.skill}</div>
   ${s.hired?`<div class="btn g" data-up="${i}" style="height:30px;margin:8px 12px 0;font-size:11px">ПРОКАЧАТЬ ★${cost}</div>`:`<div class="btn y" data-hire="${i}" style="height:30px;margin:8px 12px 0;font-size:11px">НАНЯТЬ ◆120</div>`}</div>`);});
 cards.insertAdjacentHTML('beforeend',`<div class="panel" style="width:142px;height:270px;border-radius:14px;border-style:dashed;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:.85"><div style="font-size:46px">🔒</div><div style="font-weight:800;font-size:13px">6-й слот</div><div style="font-size:11px;color:#ccc;text-align:center;padding:0 8px">Штаб ур. 6<br>или Глава 4</div></div>`);
 const hired=S.squad.filter(s=>s.hired).length;
 H(`<div class="h panel" style="left:16px;top:340px;width:928px;height:136px;padding:10px 16px;display:flex;gap:20px;align-items:center">
 <div style="flex:1"><div style="font-weight:800;color:#ffd23f">РОСТ ОТРЯДА</div><div style="font-size:12px;color:#ddd;margin-top:4px">Начинаешь с 3 енотов → до 6 в отряде (в бою до 4). Новые бойцы — за кристаллы, Казарму на базе и кампанию. Прокачка повышает здоровье.</div>
 <div style="display:flex;gap:6px;margin-top:8px;align-items:center">${[1,2,3,4,5,6].map(i=>`<div style="width:34px;height:34px;border-radius:8px;background:${i<=hired?'#e53935':'#0007'};border:2px solid #fff4;display:flex;align-items:center;justify-content:center;font-weight:800">${i<=hired?'🐾':'🔒'}</div>`).join('')}<span style="font-size:12px;margin-left:8px">${hired} / 6 в отряде</span></div></div>
 <div style="text-align:center"><div style="font-size:12px;color:#ccc">Новобранец</div><div class="btn y" data-a="hire" style="width:200px;height:50px;font-size:16px;margin-top:4px">НАНЯТЬ <span class="ic i-gem" style="margin:0 4px 0 8px;width:18px;height:18px"></span>120</div></div></div>`);
 const us=S.squad.map((s,i)=>({team:0,char:s.char,x:120,y:214,face:1,anim:'idle',ph:i*1.3,scale:3.4,at:0}));
 const cs=[...app.querySelectorAll('canvas[data-c]')];
 loopFns.push((dt,t)=>cs.forEach((c,i)=>{const x=c.getContext('2d');x.clearRect(0,0,240,220);drawRaccoon(x,us[i],t)}));
 const hire=i=>{const s=S.squad[i];if(!s||s.hired)return;if(S.gems<120){toast('Нужно 120 кристаллов');return}S.gems-=120;s.hired=true;save();sfx('coin');go('squad')};
 on('[data-hire]',e=>hire(+e.dataset.hire));on('[data-a=hire]',()=>{const i=S.squad.findIndex(s=>!s.hired);i<0?toast('Все нанятые. 6-й слот — позже'):hire(i)});
 on('[data-up]',e=>{const s=S.squad[+e.dataset.up];const cost=Math.round(150*Math.pow(1.4,s.lvl-1)/10)*10;if(s.lvl>=20)return;if(S.coins<cost){toast('Не хватает монет');return}S.coins-=cost;s.lvl++;save();sfx('coin');go('squad')});
 loop();};

// ---------- base (05) live ----------
const BPOS=[['hq',150,300],['wall',330,318],['turret',470,262],['turret',600,292],['radar',735,282],['workshop',295,400],['barracks',520,410],['storage',735,400]];
function income(){return 60+S.base.storage*40}
function collect(show){const h=(Date.now()-S.collectAt)/3600000;const c=Math.min(Math.floor(h*income()),income()*8);if(c>0){S.coins+=c;S.collectAt=Date.now();save();show&&toast('Склад: +'+c+' монет');}}
SCR.base=()=>{collect(true);H(bgDiv('bg_neon.jpg',0));const lv=Math.round(Object.values(S.base).reduce((a,b)=>a+b,0)/7);
 const c=canvasLayer();let selB=null;
 const bl=BPOS.map(([type,x,y])=>({type,x,y,hp:1,max:1,shake:0,face:-1,recoil:0,scale:1.15,lvl:S.base[type]}));
 const guard={team:0,char:'commander',x:880,y:330,face:-1,anim:'idle',ph:0,scale:1.25,at:0};const sparks=[];
 loopFns.push((dt,t)=>{const x=dk(c);
   // hill
   x.fillStyle='#1c3a1e';x.beginPath();x.moveTo(-400,490);x.lineTo(-400,300);x.lineTo(0,300);x.bezierCurveTo(200,240,400,250,480,265);x.bezierCurveTo(620,240,800,250,960,290);x.lineTo(1400,290);x.lineTo(1400,490);x.fill();
   x.strokeStyle='#5fe05a';x.lineWidth=3;x.shadowColor='#5fe05a';x.shadowBlur=10;x.beginPath();x.moveTo(0,300);x.bezierCurveTo(200,240,400,250,480,265);x.bezierCurveTo(620,240,800,250,960,290);x.stroke();x.shadowBlur=0;
   for(const b of bl){if(b.type==='turret'){b.face=b.face||-1;if(Math.random()<dt*.15){b.recoil=1;sparks.push({x:b.x+b.face*34,y:b.y-48,t:0});}}if(b.recoil>0)b.recoil-=dt*3;drawBuilding(x,b,t);
     x.font='800 12px M';x.textAlign='center';x.fillStyle='rgba(0,0,0,.75)';const lb=`${BLD[b.type].name} ${b.lvl}`;const tw=x.measureText(lb).width+14;x.beginPath();x.roundRect(b.x-tw/2,b.y+6,tw,20,8);x.fill();x.fillStyle='#fff';x.fillText(BLD[b.type].name+' ',b.x-8,b.y+21);x.fillStyle='#ffd23f';x.fillText(b.lvl,b.x+x.measureText(BLD[b.type].name).width/2,b.y+21);
     if(selB===b){x.strokeStyle='#ffd23f';x.lineWidth=3;x.setLineDash([6,4]);x.strokeRect(b.x-50,b.y-BLD[b.type].h*1.15-6,100,BLD[b.type].h*1.15+10);x.setLineDash([]);}}
   for(const s of sparks){s.t+=dt;x.globalCompositeOperation='lighter';x.fillStyle=`rgba(255,200,90,${1-s.t*4})`;x.beginPath();x.arc(s.x,s.y,8,0,7);x.fill();x.globalCompositeOperation='source-over';}
   while(sparks.length&&sparks[0].t>.25)sparks.shift();
   guard.x=880+Math.sin(t*.4)*30;guard.face=Math.cos(t*.4)>0?1:-1;guard.anim=Math.abs(Math.cos(t*.4))>.2?'walk':'idle';guard.wt=t;drawRaccoon(x,guard,t);});
 c.addEventListener('click',e=>{const r=c.getBoundingClientRect();const py=(e.clientY-r.top)/r.height*490,px=(e.clientX-r.left)/r.height*490-(AW-960)/2;selB=bl.find(b=>Math.abs(b.x-px)<55&&py<b.y+20&&py>b.y-100)||null;if(selB)toast(`${BLD[selB.type].name} ур. ${selB.lvl} → улучшить: ★${bcost(selB.type)}`)});
 H(topbar('Моя база · Ур. '+lv));
 H(`<div class="h panel" style="left:12px;top:54px;width:252px;padding:8px 12px"><div style="font-weight:800;color:#ffd23f;font-size:13px">ЗАЩИТА ИИ · ОНЛАЙН 24/7</div><div style="font-size:11px;color:#ddd;margin-top:3px">Пока тебя нет, базу защищает ИИ-отряд (сложность = ур. Радара).</div>
 <div style="font-size:12px;margin-top:6px">🏆 Кубки: <b style="color:#ffd23f" id="bcups">${S.cups}</b> <span id="bshield"></span></div><div style="font-size:12px;margin-top:2px">🛡 Обороны выиграно: <b style="color:#7f7">${(Net.syncData&&Net.syncData.stats&&Net.syncData.stats.defenses_won)|0}</b></div><div style="font-size:12px;margin-top:2px">💰 Доход склада: <b style="color:#ffd23f">${income()}/ч</b></div></div>`);
 H(`<div class="h panel" style="right:12px;top:54px;width:272px;padding:8px 12px"><div style="font-weight:800;color:#ffd23f;font-size:13px">ЖУРНАЛ РЕЙДОВ</div>
 <div id="rlog" style="font-size:11px;margin-top:4px;color:#ccc">Загрузка…</div><div class="btn gr" id="revBtn" style="height:28px;font-size:12px;margin-top:6px">⚔ РЕВАНШ</div></div>`);
 loadLog();
 H(`<div class="h" style="left:12px;bottom:8px;display:flex;gap:8px">${[['🔨','Строить','g','build'],['⬆','Улучшить','y','up'],['🧭','Расставить ИИ','b','place']].map(b=>`<div class="btn ${b[2]}" data-a="${b[3]}" style="width:150px;height:46px;font-size:15px">${b[0]} ${b[1]}</div>`).join('')}</div>`);
 H(`<div class="h btn r" data-a="raid" style="right:12px;bottom:8px;width:224px;height:56px;font-size:19px;flex-direction:column;line-height:1.05">⚔ НАЙТИ РЕЙД<span style="font-size:11px" data-rw>⚡ 5 · база соперника под ИИ</span></div>`);raidTimer();
 on('[data-a=raid]',()=>raidMenu());on('[data-a=build]',()=>toast('Все постройки уже стоят. Новые — в следующих версиях'));on('[data-a=place]',()=>toast('Расстановка ИИ — скоро'));
 on('[data-a=up]',()=>{if(!selB){toast('Выбери постройку касанием');return}const t=selB.type,cst=bcost(t);if(t!=='hq'&&S.base[t]>=S.base.hq+1){toast('Сначала улучши Штаб');return}if(S.coins<cst){toast('Не хватает монет: ★'+cst);return}S.coins-=cst;S.base[t]++;save();sfx('coin');ev('base_edit');sendBase();go('base')});
 loop();};
const bcost=t=>Math.round(300*Math.pow(1.5,S.base[t]-1)*(t==='hq'?2:1)/10)*10;

// ---------- ratings (06) stub ----------
let rPer='week',rBoard='trophies';
SCR.rating=()=>{H(bgDiv('bg_ice.jpg',.65));H(topbar('Рейтинг'));
 const UNIT={trophies:'🏆',camp:'⭐',raids:'⚔'};
 H(`<div class="h" style="left:16px;top:52px;display:flex;gap:6px">${[['day','День'],['week','Неделя'],['month','Месяц'],['all','Всё время']].map(t=>`<div class="btn ${rPer===t[0]?'y':'gr'}" data-p="${t[0]}" style="width:118px;height:36px;font-size:15px">${t[1]}</div>`).join('')}</div>`);
 H(`<div class="h" style="left:520px;top:52px;display:flex;gap:6px">${[['trophies','Кубки 🏆'],['camp','Кампания ⭐'],['raids','Рейды ⚔']].map(t=>`<div class="btn ${rBoard===t[0]?'b':'gr'}" data-b="${t[0]}" style="width:132px;height:36px;font-size:14px">${t[1]}</div>`).join('')}</div>`);
 const list=H(`<div class="h panel" style="left:16px;top:96px;width:600px;height:380px;padding:8px 10px">Загрузка…</div>`);
 const prz=H(`<div class="h panel" style="left:630px;top:96px;width:314px;height:180px;padding:10px 12px"></div>`);
 Promise.all([Net.top(rBoard,rPer,7),Net.rank(rBoard)]).then(([r,rk])=>{const rows=(r.entries||[]).slice(0,7);const col=['#ffd23f','#d8e3f0','#e39a5a'];
  const me=rk&&rk[rPer]||{};const myScore=me.score!=null?me.score:(rBoard==='trophies'?S.cups:rBoard==='camp'?S.campStars:null);
  list.innerHTML=(rows.length?rows.map((l,i)=>`<div style="display:flex;align-items:center;gap:10px;height:40px;border-bottom:1px solid #fff1;font-weight:800;${l.player_id&&l.player_id===Net.pid?'color:#ffd23f':''}"><div style="width:30px;height:30px;border-radius:50%;background:${col[i]||'#0006'};color:${col[i]?'#222':'#fff'};display:flex;align-items:center;justify-content:center">${l.rank||i+1}</div>
   <div style="width:32px;height:32px;border-radius:8px;background:#3a2b6a url(img/anim_${i%2?'c':'r'}_${['commander','assault','demolition','tech'][i%4]}.png) 0 -4px/448px 36px no-repeat"></div><div style="flex:1">${esc(l.nickname||'Игрок')}</div><div style="color:#ffd23f">${UNIT[rBoard]} ${l.score==null?'—':(+l.score).toLocaleString('ru')}</div></div>`).join('')
   :'<div style="padding:40px 10px;text-align:center;color:#ccc">Пока пусто — стань первым в этом периоде!</div>')+
   `<div style="display:flex;align-items:center;gap:10px;height:44px;margin-top:6px;background:#e5393555;border:2px solid #e53935;border-radius:10px;padding:0 8px;font-weight:800"><div style="width:44px;text-align:center">${me.rank||'—'}</div><div style="flex:1">${esc(Net.nick||'Полосатый_Хвост')} (вы)</div><div style="color:#ffd23f">${UNIT[rBoard]} ${myScore==null?0:(+myScore).toLocaleString('ru')}</div></div>
   <div style="font-size:10px;color:#aaa;margin-top:4px">${r.offline?'Нет связи с сервером — показан пример рейтинга':rBoard==='camp'?'Звёзды кампании':'Кубки и рейды считает только сервер (рейды против баз игроков)'}</div>`;
  const pz=r.prizes||((Net.config&&Net.config.season_rewards)||{})[rBoard]||[];
  const pend=((Net.syncData&&Net.syncData.season_pending)||[]).find(x=>x.board===rBoard);
  prz.innerHTML=`<div style="font-weight:800;color:#ffd23f">НАГРАДЫ НЕДЕЛИ</div><div style="font-size:11px;color:#ccc">Неделя с пн 00:00 МСК · выдаёт сервер</div>
   ${pz.length?pz.slice(0,4).map(z=>`<div style="display:flex;justify-content:space-between;font-size:12px;margin-top:5px"><b>${z.from===z.to?'Топ-'+z.from:'Места '+z.from+'–'+z.to}</b><span>${rwTxt(z.reward)}</span></div>`).join(''):'<div style="font-size:12px;margin-top:8px;color:#aaa">Призы за этот период не назначены</div>'}
   ${pend?`<div class="btn g" data-a="season" style="height:30px;font-size:12px;margin-top:6px">Забрать: ${pend.rank}-е место (${rwTxt(pend.reward)})</div>`:''}`;
  const sb=prz.querySelector('[data-a=season]');sb&&(sb.onclick=async()=>{const x=await Net.claim('season',pend.season,rBoard);toast(x.ok?'Награда получена':'Не удалось получить');await Net.sync();go('rating')});});
 // achievements: server list when online (claim -> signed grant), local fallback
 const SA=Net.syncData&&Net.syncData.achievements;
 if(SA&&SA.length){const got=SA.filter(a=>a.unlocked).length;
  H(`<div class="h panel" style="left:630px;top:286px;width:314px;height:190px;padding:10px 12px;overflow:auto"><div style="display:flex;justify-content:space-between"><b style="color:#ffd23f">ДОСТИЖЕНИЯ</b><span style="font-size:12px">${got} / ${SA.length}</span></div>
  ${SA.map(a=>`<div style="display:flex;align-items:center;gap:6px;margin-top:5px;font-size:12px;${a.unlocked?'':'opacity:.65'}"><span style="flex:1"><b>${esc(a.title)}</b> <span style="color:#aaa">${Math.min(a.progress|0,a.goal)}/${a.goal}</span></span>${a.claimed?'<span style="color:#7f7">✔</span>':a.unlocked?`<div class="btn g" data-ach="${a.id}" style="height:24px;padding:0 8px;font-size:11px">${rwTxt(a.reward)}</div>`:`<span style="color:#ccc">${rwTxt(a.reward)}</span>`}</div>`).join('')}</div>`);
  on('[data-ach]',async e=>{e.textContent='…';const x=await Net.claim('achievement',e.dataset.ach);if(!x.ok)toast(x.status===422?'Ещё не выполнено':'Нет связи');await Net.sync();go('rating')});
 } else {const got=ACH.filter(a=>achVal(a[2])>=a[3]).length;const nx=ACH.find(a=>achVal(a[2])<a[3])||ACH[0];
 H(`<div class="h panel" style="left:630px;top:286px;width:314px;height:190px;padding:10px 12px"><div style="display:flex;justify-content:space-between"><b style="color:#ffd23f">ДОСТИЖЕНИЯ</b><span style="font-size:12px">${got} / ${ACH.length}</span></div>
 <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px">${ACH.map(a=>{const ok=achVal(a[2])>=a[3];return `<div title="${a[1]}" style="height:42px;border-radius:8px;background:${ok?'#ffd23f33':'#0006'};border:2px solid ${ok?'#ffd23f':'#555'};display:flex;align-items:center;justify-content:center;font-size:22px;${ok?'':'filter:grayscale(1);opacity:.6'}">${a[0]}</div>`}).join('')}</div>
 <div style="font-size:11px;margin-top:8px">«${nx[1]}»: ${Math.min(achVal(nx[2]),nx[3])}/${nx[3]}</div><div class="bar" style="margin-top:3px"><i style="width:${Math.min(100,achVal(nx[2])/nx[3]*100)}%"></i></div></div>`);}
 on('[data-p]',e=>{rPer=e.dataset.p;go('rating')});on('[data-b]',e=>{rBoard=e.dataset.b;go('rating')});};
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function ago(ts){const m=Math.max(1,Math.round((Date.now()/1000-ts)/60));return m<60?m+' мин':m<1440?Math.round(m/60)+' ч':Math.round(m/1440)+' д'}
async function loadLog(){const j=await Net.raidLog(10);const el=$('#rlog'),rb=$('#revBtn');if(!el)return;
 if(j.offline){el.textContent='Нет связи с сервером — журнал недоступен.';rb.classList.add('dis');rb.onclick=()=>toast('Нет связи');return}
 if(j.cups!=null){S.cups=j.cups;save();const c=$('#bcups');c&&(c.textContent=j.cups);}
 const sh=$('#bshield');if(sh&&j.shield_until>Date.now()/1000)sh.textContent='· 🛡 щит '+Math.ceil((j.shield_until-Date.now()/1000)/3600)+' ч';
 const E=j.entries||[];el.innerHTML=E.length?E.slice(0,4).map(e=>`<div style="margin-top:2px">${e.kind==='attack'?'⚔':'🛡'} ${e.kind==='attack'?'Ты → '+(e.opp_nick||'Игрок'):(e.opp_nick||'Игрок')+' → тебя'} ${'★'.repeat(e.stars)}${'☆'.repeat(3-e.stars)} <b style="color:${e.cups>=0?'#7f7':'#f77'}">${e.cups>=0?'+':''}${e.cups}🏆</b> <span style="color:#888">${ago(e.ts)}</span></div>`).join(''):'Пока никто не нападал. Рейды других игроков появятся здесь.';
 const hrs=((Net.config&&Net.config.config)||{}).raid_revenge_hours||48;
 const rv=E.find(e=>e.kind==='defense'&&!e.revenged&&e.stars>0&&Date.now()/1000-e.ts<hrs*3600);
 if(rv){rb.className='btn r';rb.textContent='⚔ РЕВАНШ: '+(rv.opp_nick||'Игрок')+' (×1.5🏆)';rb.onclick=()=>startRaid(rv.rid);}else{rb.classList.add('dis');rb.onclick=()=>toast('Реванш — после проигранной обороны (48 ч)');}}
function raidTimer(){const f=()=>{const el=document.querySelector('[data-rw]');if(!el)return clearInterval(t);const w=Net.raidWait();el.textContent=w>0?'поиск через '+w+' с':'⚡ 5 · база соперника под ИИ';};const t=setInterval(f,1000);f();}
// ---------- ads ----------
let rwCb=null;
function rewarded(kind,cb){ev('rewarded_click',{kind});
 const done=ok=>{if(ok){ev('rewarded_ok',{kind});Net.progress({ads_watched:1});}cb(ok)};
 if(PL.ads.rewardedAvail()){rwCb=done;PL.ads.showRewarded(kind);}
 else if(PL.ads.noDemo){toast('Видео сейчас недоступно');cb(false);}
 else{toast('Демо: видео просмотрено');setTimeout(()=>done(true),300);}}
window.__adResult=(kind,ok)=>{if(kind==='inter')return;const f=rwCb;rwCb=null;if(f)f(!!ok);if(!ok)toast('Видео сейчас недоступно');};
window.__adPause=p=>{p?musicOff():musicOn();if(battle)battle.paused=!!p;};
function rc(k,d){const c=Net.config&&Net.config.config;return c&&c[k]!=null?c[k]:d}
function interMaybe(){if(!rc('ads_interstitial_enabled',false)||!PL.ads.interstitialOn())return;const n=rc('interstitial_every_games',0)|0;if(n>0&&S.games%n===0){ev('interstitial');PL.ads.showInterstitial();}}
// ---------- push reminders (local; server push waits for push_project_id) ----------
function reminders(){if(!PL.push.avail())return;const now=Date.now();PL.push.setCats(S.push);
 PL.push.setReminders([{type:'energy',at:now+(30-S.energy)*360000,title:'Еноты: Огонь по базе',text:'Отряд восстановлен и ждёт приказа.',ch:'timers'},
  {type:'storage',at:now+8*3600000,title:'Еноты: Огонь по базе',text:'Склад базы полон — забери монеты!',ch:'timers'},
  {type:'daily',at:now+20*3600000,title:'Еноты: Огонь по базе',text:'🦝 Новые задания дня ждут командира!',ch:'timers'}]);
 const sendTok=()=>{const tok=PL.push.token();if(tok&&tok!==S.pushTok){Net.pushToken(tok,true).then(j=>{if(!j.offline){S.pushTok=tok;save();}})}};sendTok();setTimeout(sendTok,15000);
 const o=PL.push.takeOpen();if(o){Net.pushOpen(o.type,o.source);ev('push_open',o);}}
document.addEventListener('visibilitychange',()=>{if(document.hidden){reminders();musicOff();}else if(cur!=='battle'||!battle||!battle.paused)musicOn();});
// ---------- online ----------
Net.onGrant=(rw,g)=>{S.coins+=rw.coins|0;S.gems+=rw.gems|0;save();sfx('coin');toast('Награда: '+rwTxt(rw));if(cur==='menu'||cur==='rating')setTimeout(()=>go(cur),400);};
window.__vkResult=async js=>{let o;try{o=JSON.parse(js)}catch(e){return}if(!o.ok){if(o.err!=='cancel')toast('VK ID: ошибка входа');return}
 const r=await Net.vkLink({code:o.code,code_verifier:o.code_verifier,device_id:o.device_id,state:o.state});
 if(r.offline){toast(r.status===503?'VK ID пока не настроен на сервере':'VK ID: не удалось связать');return}
 toast(r.switched?'Вход выполнен: '+r.nickname:'VK ID привязан');if(r.switched)setTimeout(()=>location.reload(),800);};
async function online(){ if(SHOT==='offline')return;
 await Net.loadConfig(); const j=await Net.sync(); if(j.offline)return;
 ev('session'); sendBase(); const l=await Net.raidLog(1); if(!l.offline&&l.cups!=null){S.cups=l.cups;save();}
 if(S.campStars>0)Net.progress({campaign_stars:S.campStars});
 if(cur==='menu')go('menu'); }
setInterval(()=>{if(cur!=='battle')Net.sync()},10*60e3);
// ---------- boot ----------
function boot(){
 if(SHOT){S.consent=SHOT==='consent'?null:true;S.coins=12480;S.gems=356;S.energy=24;}
 if(S.consent==null)go('consent');else{applyConsent();go('menu');}
 reminders();online();
 if(SHOT&&SCR[SHOT]&&SHOT!=='consent'){if(SHOT==='battle')go('battle',{map:'junk',diff:2,wind:0,mode:'ai'});else if(SHOT==='raid')go('battle',{map:'neon',diff:2,raid:true,mode:'raid'});else go(SHOT);}
 if(SHOT==='raid'){go('battle',{map:'neon',diff:2,raid:true,mode:'raid'});setTimeout(()=>{if(battle)battle.pan=battle.W-500},300);}
}
// preload images then boot
const PRE=['bg_neon.jpg','bg_junk.jpg','bg_port.jpg','bg_ice.jpg','tex_neon.jpg','tex_junk.jpg','tex_port.jpg','tex_ice.jpg','coin.png','gem.png','p_rocket.png','p_bomb.png','fx_boom.png','fx_smoke.png','w_air.png','w_drone.png',
 ...['r','c'].flatMap(t=>RA.CHARS.map(c=>`anim_${t}_${c}.png`)),...Object.values(BLD).flatMap(b=>[b.img,b.ruin,b.dmg,...(b.st||[])]).filter(Boolean)];
Promise.race([new Promise(r=>setTimeout(r,4000)),Promise.all(PRE.map(n=>new Promise(r=>{const i=img(n);if(i.complete)r();else{i.addEventListener('load',r);i.addEventListener('error',r)}})))]).then(()=>document.fonts?document.fonts.ready:0).then(boot).catch(e=>console.error("BOOT",e.stack||e));
})();
