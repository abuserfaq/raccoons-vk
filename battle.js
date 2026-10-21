// Battle engine: per-pixel destructible terrain, wind, turn timer, 6 weapons, AI, animated raccoons & destructible buildings.
(function(){
const IMG={};
function img(n){ if(!IMG[n]){const i=new Image();i.src='img/'+n;IMG[n]=i;} return IMG[n]; }
const CHARS=['commander','demolition','assault','tech'];
const CELL=144, FR={idle:0,walk:[1,2,3],crouch:4,air:5,land:6,aim:7,fire:8,hurt:9,knock:10,win:[11,12],dead:13};
const MAPS={
 neon:{name:'Неоновый город',len:'Средняя',W:2000,wind:6,bg:'bg_neon.jpg',tex:'tex_neon.jpg',edge:'#ff3df2',glow:'#29f0ff',water:'#c21cff'},
 junk:{name:'Свалка будущего',len:'Длинная',W:2700,wind:9,bg:'bg_junk.jpg',tex:'tex_junk.jpg',edge:'#ffb15a',glow:'#ffcf6b',water:'#5bff3a'},
 port:{name:'Заброшенный космопорт',len:'Короткая',W:1500,wind:2,bg:'bg_port.jpg',tex:'tex_port.jpg',edge:'#6fdc3a',glow:'#b4ff57',water:'#3aff9a'},
 ice:{name:'Ледяная станция',len:'Средняя',W:2000,wind:8,bg:'bg_ice.jpg',tex:'tex_ice.jpg',edge:'#ffffff',glow:'#a9e4ff',water:'#2aa8ff'},
 roof:{name:'Крыши на закате',len:'Короткая',W:1500,wind:7,bg:'bg_junk.jpg',tex:'tex_neon.jpg',edge:'#ffc27a',glow:'#ffe7a6',water:'#ff6a3a',gust:true},
};
const WEAPONS=[
 {id:'bazooka',name:'Базука',icon:'w_bazooka.png',ammo:-1,dmg:48,r:44,wind:1,kind:'proj'},
 {id:'grenade',name:'Граната',icon:'w_grenade.png',ammo:3,dmg:50,r:48,wind:0,kind:'grenade'},
 {id:'shotgun',name:'Дробовик',icon:'w_shotgun.png',ammo:2,dmg:15,r:14,wind:0,kind:'shot'},
 {id:'air',name:'Авиаудар',icon:'w_air.png',ammo:1,dmg:26,r:32,wind:.4,kind:'air'},
 {id:'drone',name:'Дрон-камикадзе',icon:'w_drone.png',ammo:1,dmg:55,r:50,wind:.15,kind:'drone'},
 {id:'tele',name:'Телепорт',icon:'w_tele.png',ammo:2,dmg:0,r:0,wind:0,kind:'tele'},
];
const BLD={hq:{img:'b_hq.png',hp:320,h:96,st:['hq_0.png','hq_1.png','hq_2.png','ruin_a.png'],name:'Штаб'},
 turret:{img:'b_turret.png',hp:130,h:70,ruin:'ruin_b.png',name:'Турель'},radar:{img:'b_radar.png',hp:100,h:78,ruin:'ruin_c.png',name:'Радар ИИ'},
 wall:{img:'b_wall.png',hp:200,h:74,dmg:'wall_1.png',ruin:'ruin_d.png',name:'Стена'},workshop:{img:'b_workshop.png',hp:120,h:70,ruin:'ruin_b.png',name:'Мастерская'},
 barracks:{img:'b_barracks.png',hp:120,h:66,ruin:'ruin_c.png',name:'Казарма'},storage:{img:'b_storage.png',hp:140,h:70,ruin:'ruin_d.png',name:'Склад'}};
const G=520, H=560, VH0=430;
function rng(seed){let s=seed>>>0||7;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return((s>>>0)%1e6)/1e6}}

// ---------- shared drawing (also used by base & menu screens) ----------
function drawRaccoon(ctx,u,t){
  const sheet=img(`anim_${u.team==0?'r':'c'}_${u.char}.png`); if(!sheet.complete)return;
  let f=FR.idle, sy=1, rot=0, ox=0, oy=0;
  const breathe=Math.sin(t*2.4+u.ph)*0.022;
  switch(u.anim){
   case 'walk': f=FR.walk[Math.floor(u.wt*9)%3]; oy=-Math.abs(Math.sin(u.wt*9*Math.PI/3*1.5))*2.5; break;
   case 'air': f=u.vy<-60?FR.air:(u.vy>120?FR.land:FR.air); break;
   case 'knock': f=FR.knock; rot=Math.sin(u.at*14)*0.12; break;
   case 'aim': f=FR.aim; sy=1+breathe*0.6; break;
   case 'fire': f=FR.fire; break;
   case 'hurt': f=FR.hurt; ox=Math.sin(u.at*60)*2; break;
   case 'win': f=FR.win[Math.floor(t*3+u.ph)%2]; break;
   case 'dead': f=FR.dead; break;
   case 'land': f=FR.land; sy=1-0.12*Math.max(0,1-u.at*5); break;
   default: f=FR.idle; sy=1+breathe; rot=Math.sin(t*1.7+u.ph)*0.018; // breathing + tail/body sway
  }
  if(u.recoil>0){ox-=u.recoil*7;rot-=u.recoil*0.08;}
  const k=(u.scale||1)*62/118;
  ctx.save(); ctx.translate(u.x+ox*u.face,u.y+oy); ctx.scale(u.face*k,k*sy); ctx.rotate(rot);
  if(u.team==1&&u.anim!=='dead'){ctx.shadowColor='#29f0ff';ctx.shadowBlur=10;}
  ctx.drawImage(sheet,f*CELL,0,CELL,CELL,-CELL/2,-CELL+6,CELL,CELL);
  ctx.restore();
  // procedural tail flick overlay: small striped arc behind (subtle)
}
const DMGC={};
function dmgSprite(im,key,stage,seed){const id=key+'|'+stage+'|'+seed; if(DMGC[id])return DMGC[id];
  const w=im.naturalWidth,h=im.naturalHeight,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(im,0,0);
  const r=rng(seed*7919+13);x.globalCompositeOperation='source-atop';
  for(let i=0;i<stage*2;i++){const cx=w*(.15+.7*r()),cy=h*(.2+.7*r()),rr=w*(.08+.1*r());const g=x.createRadialGradient(cx,cy,0,cx,cy,rr);g.addColorStop(0,'rgba(8,4,2,.85)');g.addColorStop(1,'rgba(8,4,2,0)');x.fillStyle=g;x.fillRect(cx-rr,cy-rr,rr*2,rr*2);}
  for(let i=0;i<stage*4;i++){let px=w*(.1+.8*r()),py=h*(.05+.5*r());x.lineWidth=Math.max(2,w/70);x.strokeStyle='rgba(5,2,0,.9)';x.beginPath();x.moveTo(px,py);
    for(let j=0;j<5;j++){px+=(r()-.5)*w*.12;py+=h*(.04+.07*r());x.lineTo(px,py);} x.stroke();x.lineWidth=1;x.strokeStyle='rgba(255,170,90,.35)';x.stroke();}
  if(stage>=3){x.fillStyle='rgba(0,0,0,.28)';x.fillRect(0,0,w,h);}
  x.globalCompositeOperation='destination-out';
  for(let i=0;i<(stage-1)*2;i++){const top=r()<.65,cx=top?w*(.1+.8*r()):(r()<.5?0:w),cy=top?0:h*(.1+.5*r()),rr=w*(.08+.07*stage*r());
    x.beginPath();for(let k=0;k<10;k++){const a=k/10*Math.PI*2,d=rr*(.6+.6*r());k?x.lineTo(cx+Math.cos(a)*d,cy+Math.sin(a)*d):x.moveTo(cx+Math.cos(a)*d,cy+Math.sin(a)*d);}x.closePath();x.fill();
    x.globalCompositeOperation='source-atop';x.strokeStyle='rgba(255,110,20,.8)';x.lineWidth=Math.max(2,w/60);x.stroke();x.globalCompositeOperation='destination-out';}
  x.globalCompositeOperation='source-over';DMGC[id]=c;return c;}
function drawBuilding(ctx,b,t){
  const d=BLD[b.type]; const r=b.hp/b.max; let name=b.type==='hq'?d.img:d.img, filt='';
  const stage=r>.75?0:r>.5?1:r>.25?2:r>0?3:4;
  if(stage===4)name=b.type==='hq'?d.st[3]:d.ruin; else if(stage>=2&&d.dmg)name=d.dmg;
  let im=img(name); if(!im.complete||!im.naturalWidth)return; if(stage>0&&stage<4)im=dmgSprite(im,name,stage,(b.x|0)%997);
  const h=(r<=0?d.h*0.55:d.h)*(b.scale||1)*(stage===3?.94:1), w=(im.naturalWidth||im.width)/(im.naturalHeight||im.height)*h;
  ctx.save(); ctx.translate(b.x+(b.shake>0?Math.sin(t*80)*b.shake*4:0),b.y+4); if(stage===4&&b.fallT==null)b.fallT=t;if(stage===4)ctx.translate(0,Math.min(1,(t-b.fallT)*3)*4);if(stage>=2&&stage<4)ctx.rotate((((b.x|0)%2)?1:-1)*(stage-1)*0.035);
  let sx=1;
  if(b.type==='turret'&&r>0)sx=b.face||-1;
  if(b.type==='turret'&&b.recoil>0)ctx.translate(-(b.face||-1)*b.recoil*6,0);
  if(stage>0&&stage<4)filt=`brightness(${1-stage*.12}) sepia(${stage*.15})`;
  ctx.scale(sx,1); if(filt)ctx.filter=filt;
  ctx.drawImage(im,-w/2,-h,w,h); ctx.filter='none';
  if(r>0&&b.type!=='hq'){ // neon blink
    ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=Math.max(0,0.12+0.12*Math.sin(t*5+b.x))*(r>.33?1:Math.random()>.5?1:0);
    ctx.drawImage(im,-w/2,-h,w,h); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
  }
  if(b.flash>0){ctx.globalCompositeOperation='lighter';ctx.globalAlpha=b.flash*.8;ctx.filter='brightness(2)';ctx.drawImage(im,-w/2,-h,w,h);ctx.filter='none';ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}
  if(b.type==='radar'&&r>0){ // rotating scan beam around the dish pivot (sprite itself is never scaled/flipped)
    const px=0,py=-h*.78,a=t*1.6,L=h*.9;ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(px,py,2,px,py,L);g.addColorStop(0,'rgba(80,255,200,.35)');g.addColorStop(1,'rgba(80,255,200,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(px,py);ctx.arc(px,py,L,a-.35,a);ctx.closePath();ctx.fill();
    ctx.fillStyle=`rgba(120,255,210,${.5+.5*Math.sin(t*6)})`;ctx.beginPath();ctx.arc(px,py,3,0,7);ctx.fill();ctx.globalCompositeOperation='source-over';}
  else if(r>0&&(b.type==='workshop'||b.type==='barracks'||b.type==='storage')){ // work light
    ctx.globalCompositeOperation='lighter';ctx.fillStyle=`rgba(255,200,90,${.25+.2*Math.sin(t*3+b.x)})`;ctx.beginPath();ctx.arc(w*.28,-h*.85,3,0,7);ctx.fill();ctx.globalCompositeOperation='source-over';}
  ctx.restore();
}

// ---------- Battle ----------
class Battle{
 constructor(opt){
  this.o=opt; this.map=MAPS[opt.map]||MAPS.neon; this.W=this.map.W; this.H=H; this.t=0;
  this.cv=opt.canvas; this.ctx=this.cv.getContext('2d');
  this.rand=rng(opt.seed||Date.now()); this.diff=opt.diff||1; this.raid=!!opt.raid;
  this.units=[]; this.bld=[]; this.proj=[]; this.parts=[]; this.shake=0; this.camX=0; this.camT=0;
  this.genTerrain(); this.spawn(); this.wind=0; this.turnIdx=[-1,-1]; this.team=1; this.state='start'; this.timer=30;
  this.ammo=[{},{}]; for(const w of WEAPONS){this.ammo[0][w.id]=w.ammo<0?-1:w.ammo+(opt.ammoBonus&&opt.ammoBonus[w.id]||0);this.ammo[1][w.id]=w.ammo;}
  this.wsel='bazooka'; this.aimA=-0.6; this.aimP=0.7; this.target=null; this.stats={dmg:0,shots:0,turns:0,weapons:{}};
  this.revived=false; this.over=false; this.events=opt.events||(()=>{}); this.sfx=opt.sfx||(()=>{});
  this.nextTurn();
 }
 lvl(id){return (this.o.levels&&this.o.levels[id])||1}
 wdef(id,team){const w=WEAPONS.find(x=>x.id===id); if(team!==0)return w; const L=this.lvl(id);
   return Object.assign({},w,{dmg:w.dmg*(1+.06*(L-1)),r:w.r*(1+.03*(L-1)),wind:w.wind*(1-.03*(L-1))});}
 genTerrain(){
  const W=this.W,r=this.rand; this.mask=new Uint8Array(W*H);
  const tc=document.createElement('canvas'); tc.width=W; tc.height=H; this.tc=tc; const c=tc.getContext('2d');
  const a=[r()*6,r()*6,r()*6,r()*6], hs=new Float32Array(W);
  for(let x=0;x<W;x++){const u=x/W*Math.PI*2*(W/1500);
    hs[x]=H*(0.6+0.1*Math.sin(u*0.9+a[0])+0.05*Math.sin(u*2.3+a[1])+0.02*Math.sin(u*5.1+a[2])+0.008*Math.sin(u*13+a[3]));}
  if(this.raid){const bx=this.W*0.62; for(let x=Math.floor(bx);x<W;x++)hs[x]=hs[x]*0.25+H*0.6*0.75;} // flatter base plateau
  this.hs=hs;
  for(let x=0;x<W;x++)for(let y=Math.max(0,Math.floor(hs[x]));y<H;y++)this.mask[y*W+x]=1;
  // a few caves
  for(let i=0;i<4;i++){const cx=W*(.15+.7*r()),cy=hs[Math.floor(cx)]+40+r()*70,rr=18+r()*22;this.carve(cx,cy,rr,false);}
  this.paintTerrain();
 }
 paintTerrain(){
  const c=this.tc.getContext('2d'),W=this.W; const tex=img(this.map.tex);
  const id=c.createImageData(W,H); const d=id.data;
  for(let i=0;i<W*H;i++)if(this.mask[i]){d[i*4+3]=255}
  c.putImageData(id,0,0); c.globalCompositeOperation='source-in';
  if(tex.complete&&tex.naturalWidth){c.fillStyle=c.createPattern(tex,'repeat');} else c.fillStyle='#3a2c4a';
  c.fillRect(0,0,W,H); c.globalCompositeOperation='source-atop';
  const g=c.createLinearGradient(0,H*.4,0,H); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.55)'); c.fillStyle=g; c.fillRect(0,0,W,H);
  // neon edge on top surface
  c.globalCompositeOperation='source-atop'; c.strokeStyle=this.map.edge; c.lineWidth=5; c.shadowColor=this.map.glow; c.shadowBlur=12;
  c.beginPath(); for(let x=0;x<W;x++){x?c.lineTo(x,this.hs[x]+1):c.moveTo(x,this.hs[x]+1)} c.stroke(); c.shadowBlur=0;
  c.globalCompositeOperation='source-over';
  this.painted=true;
  {const b=this.bk||document.createElement('canvas');b.width=W;b.height=H;const bc=b.getContext('2d');bc.drawImage(this.tc,0,0);
    bc.globalCompositeOperation='source-atop';bc.fillStyle='rgba(6,2,10,.8)';bc.fillRect(0,0,W,H);bc.globalCompositeOperation='destination-out';const gg=bc.createLinearGradient(0,0,0,30);for(let x=0;x<W;x+=2){bc.fillRect(x,0,2,this.hs[x]+18);}bc.globalCompositeOperation='source-over';this.bk=b;this.bkDone=true;}
 }
 crShape(r,kind,ang){const n=28,pts=[],rnd=this.rand,ph=rnd()*6;let amp=.18,ex=1,ey=1;
  if(kind==='chip'){amp=.38;}else if(kind==='round'){amp=.08;}else if(kind==='deep'){amp=.16;ex=.82;ey=1.3;}else if(kind==='drone'){amp=.3;}else if(kind==='bomb'){amp=.22;ey=.85;}
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2;let k=1+amp*(Math.sin(a*3+ph)*.5+Math.sin(a*7+ph*2)*.3+(rnd()-.5)*.8);
   let px=Math.cos(a)*r*k*ex,py=Math.sin(a)*r*k*ey;if(kind==='deep'&&ang!=null){const c=Math.cos(ang-Math.PI/2),s=Math.sin(ang-Math.PI/2);[px,py]=[px*c-py*s,px*s+py*c];}pts.push([px,py]);}
  return pts;}
 carve(x,y,r,paint=true,kind,ang){
  const W=this.W; const pts=this.crShape(r,kind||'round',ang); let R=0;for(const p of pts)R=Math.max(R,Math.hypot(p[0],p[1]));
  const x0=Math.max(0,Math.floor(x-R)),x1=Math.min(W-1,Math.ceil(x+R)),y0=Math.max(0,Math.floor(y-R)),y1=Math.min(H-1,Math.ceil(y+R));
  const inside=(px,py)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if(((a[1]>py)!==(b[1]>py))&&(px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;};
  for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++){if(this.mask[yy*W+xx]&&inside(xx-x,yy-y))this.mask[yy*W+xx]=0;}
  if(paint&&this.tc){const path=(c,sc)=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(x+p[0]*sc,y+p[1]*sc):c.moveTo(x+p[0]*sc,y+p[1]*sc));c.closePath();};
    const c=this.tc.getContext('2d');c.save();c.globalCompositeOperation='source-atop';
    const g=c.createRadialGradient(x,y,R*.6,x,y,R*1.55);g.addColorStop(0,'rgba(10,3,0,.95)');g.addColorStop(.45,'rgba(25,10,4,.7)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.beginPath();c.arc(x,y,R*1.55,0,7);c.fill();
    c.shadowColor='#ff6a00';c.shadowBlur=8;c.strokeStyle='rgba(255,140,40,.9)';c.lineWidth=3;path(c,1.03);c.stroke();c.shadowBlur=0;
    for(let i=0;i<Math.max(3,R/5);i++){const a=this.rand()*7,d=R*(1.05+this.rand()*.35);c.fillStyle=this.rand()<.5?'rgba(0,0,0,.8)':'rgba(60,40,30,.9)';c.fillRect(x+Math.cos(a)*d,y+Math.sin(a)*d,2+this.rand()*4,2+this.rand()*3);}
    c.restore();c.save();c.globalCompositeOperation='destination-out';path(c,1);c.fill();c.restore();
    if(this.bk){const b=this.bk.getContext('2d');b.save();b.globalCompositeOperation='source-atop';const g2=b.createRadialGradient(x,y,R*.2,x,y,R*1.1);g2.addColorStop(0,'rgba(0,0,0,.75)');g2.addColorStop(1,'rgba(0,0,0,0)');b.fillStyle=g2;b.beginPath();b.arc(x,y,R*1.1,0,7);b.fill();b.restore();}
    this.scars=(this.scars||[]);this.scars.push({x,y,R,t:this.t});if(this.scars.length>40)this.scars.shift();}
 }
 solid(x,y){x|=0;y|=0;if(x<0||x>=this.W)return true;if(y<0)return false;if(y>=H)return true;return this.mask[y*this.W+x]===1}
 surface(x){for(let y=0;y<H;y++)if(this.solid(x,y))return y;return H}
 spawn(){
  const ps=this.o.squad||[], es=this.o.enemies||[], W=this.W;
  const place=(list,team,x0,x1)=>list.forEach((s,i)=>{const x=x0+(x1-x0)*(list.length>1?i/(list.length-1):.5)+(this.rand()-.5)*40;
    this.units.push({team,name:s.name,char:s.char,x,y:this.surface(x)-1,vx:0,vy:0,hp:s.hp,max:s.hp,face:team?-1:1,anim:'idle',at:0,wt:0,ph:this.rand()*6,alive:true,ground:true,recoil:0,lastY:0});});
  place(ps,0,W*.06,W*(this.raid?.32:.38));
  if(this.raid){
    const bx=W*.62,types=['wall','turret','storage','hq','radar','turret','barracks','workshop'];
    types.forEach((ty,i)=>{const x=bx+60+i*((W-bx-120)/(types.length-1)); const y=this.flatten(x,ty==='hq'?60:40);
      const lv=(this.o.baseLv&&this.o.baseLv[ty])||1;const hp=Math.round(BLD[ty].hp*(this.o.baseMult||1)*(1+.15*(Math.min(15,lv)-1))); this.bld.push({type:ty,x,y,hp,max:hp,shake:0,face:-1,recoil:0,cd:0});});
    place(es,1,bx+80,W-60);
  } else place(es,1,W*.62,W*.94);
 }
 flatten(x,half){let y=this.surface(x); for(let xx=Math.floor(x-half);xx<x+half;xx++){for(let yy=0;yy<H;yy++){const i=yy*this.W+xx;if(xx<0||xx>=this.W)break;this.mask[i]=yy>=y?1:0;}this.hs[xx]=y;} this.paintTerrain(); return y;}
 // raid result: HQ weighs as much as all other buildings together; stars follow server rules (50/75/100%)
 raidPct(){const hq=this.bld.find(b=>b.type==='hq'),o=this.bld.filter(b=>b.type!=='hq');const f=b=>1-Math.max(0,b.hp)/b.max;
  const of=o.length?o.reduce((a,b)=>a+f(b),0)/o.length:1;let pct=Math.floor(50*(hq&&hq.hp<=0?1:Math.min(.98,f(hq)))+50*of);if(!(hq&&hq.hp<=0))pct=Math.min(pct,49);
  if(pct>=100&&o.some(b=>b.hp>0))pct=99;const stars=pct>=100?3:pct>=75?2:pct>=50?1:0;return{pct,stars,dur:this.t};}
 alive(team){return this.units.filter(u=>u.alive&&u.team===team)}
 nextTurn(){
  if(this.checkEnd())return;
  this.team=this.team===0?1:0;
  if(this.raid&&this.team===1&&this.alive(1).length===0&&!this.bld.some(b=>b.type==='turret'&&b.hp>0)){this.team=0;}
  const list=this.alive(this.team);
  const mw=this.map.wind; this.wind=Math.round((this.rand()*2-1)*mw); if(this.map.gust)this.wind=Math.round((this.rand()*2-1)*(1+this.rand()*6));
  this.timer=30; this.stats.turns++; this.target=null; this.tele=null; this.focus=null;
  if(list.length===0){ if(this.team===1&&this.raid){this.state='ai';this.cur=null;this.runTurrets();return;} this.nextTurn();return;}
  this.turnIdx[this.team]=(this.turnIdx[this.team]+1)%list.length; this.cur=list[this.turnIdx[this.team]];
  this.moved=0; this.state=this.team===0?'aim':'ai'; this.camT=this.cur.x;
  if(this.team===0){ if(this.ammo[0][this.wsel]===0)this.wsel='bazooka'; }
  this.events('turn',{team:this.team,name:this.cur.name});
  if(this.team===1)this.aiPlan();
 }
 checkEnd(){
  if(this.over)return true;
  const p=this.alive(0).length,e=this.alive(1).length;
  const hq=this.bld.find(b=>b.type==='hq');
  let res=null;
  if(p===0)res='lose'; else if(this.raid?(hq&&hq.hp<=0):e===0)res='win';
  else if(this.raid&&this.stats.turns>40)res='lose';
  if(res){this.over=true;this.state='end';for(const u of this.units)if(u.alive&&u.team===(res==='win'?0:1)){u.anim='win'}
    const rp=this.raid?this.raidPct():null;setTimeout(()=>this.events('end',{res,stats:this.stats,alive:p,raid:rp}),1400);return true;}
  return false;
 }
 revive(){const d=this.units.filter(u=>u.team===0&&!u.alive);if(!d.length)return false;const u=d.sort((a,b)=>b.max-a.max)[0];
   u.alive=true;u.hp=Math.round(u.max*.5);u.anim='idle';u.x=Math.max(40,Math.min(this.W-40,u.x));u.y=this.surface(u.x)-30;u.vy=0;
   this.over=false;this.revived=true;this.team=1;this.state='settle';this.settleT=0.3;for(const v of this.units)if(v.alive)v.anim='idle';return true}
 // ---------- input from UI ----------
 setAim(a,p){if(this.state!=='aim')return;this.aimA=a;this.aimP=Math.max(.1,Math.min(1,p));this.cur.face=Math.cos(a)>=0?1:-1;this.cur.anim='aim';}
 setTarget(x,y){this.target={x,y};}
 walk(dir){if(this.state!=='aim'||!this.cur.ground)return;this.walking=dir;if(dir)this.cur.face=dir;}
 jump(){const u=this.cur;if(this.state!=='aim'||!u.ground||this.moved>160)return;u.vy=-300;u.vx=u.face*110;u.ground=false;u.anim='air';this.sfx('jump');}
 fire(){
  if(this.state!=='aim'&&this.state!=='aiFire')return false;
  const u=this.cur,team=u.team,w=this.wdef(this.wsel,team);
  if(this.ammo[team][w.id]===0)return false;
  if((w.kind==='air'||w.kind==='tele')&&!this.target)return false;
  if(this.ammo[team][w.id]>0)this.ammo[team][w.id]--;
  this.stats.shots+=team===0?1:0; if(team===0)this.stats.weapons[w.id]=1;
  const a=this.aimA,p=this.aimP,mx=u.x+Math.cos(a)*22,my=u.y-34+Math.sin(a)*22;
  u.anim='fire';u.at=0;u.recoil=1;
  this.state='fly'; this.flyT=0;
  if(w.kind==='proj'||w.kind==='shot'||w.kind==='grenade'){const k=w.kind==='proj'?150:w.kind==='shot'?120:50;u.vx-=Math.cos(a)*k;u.vy-=Math.max(0,Math.sin(a))*k*.3;if(w.kind!=='grenade'){u.ground=false;}this.shake=Math.max(this.shake,w.kind==='grenade'?1:3);}
  if(w.kind==='proj'){this.proj.push({k:'rocket',x:mx,y:my,vx:Math.cos(a)*p*820,vy:Math.sin(a)*p*820,w,team});this.sfx('launch');}
  else if(w.kind==='grenade'){this.proj.push({k:'grenade',x:mx,y:my,vx:Math.cos(a)*p*620,vy:Math.sin(a)*p*620,w,team,fuse:3});this.sfx('throw');}
  else if(w.kind==='drone'){this.proj.push({k:'drone',x:mx,y:my-6,vx:Math.cos(a)*240,vy:Math.sin(a)*240,w,team,life:6,head:a});this.sfx('drone');}
  else if(w.kind==='shot'){this.sfx('shot');for(let i=-1;i<=1;i++)this.hitscan(mx,my,a+i*0.05,w,team);this.parts.push({k:'flash',x:mx,y:my,t:0,life:.12});}
  else if(w.kind==='air'){const tx=this.target.x;this.sfx('jet');this.parts.push({k:'jet',x:tx-700*u.face,y:60,vx:700*u.face,t:0,life:2});
    for(let i=0;i<5;i++)setTimeout(()=>{this.proj.push({k:'bomb',x:tx-80+i*40,y:-20,vx:u.face*40,vy:80,w,team})},400+i*110);}
  else if(w.kind==='tele'){const t=this.target;if(!this.solid(t.x,t.y)&&!this.solid(t.x,t.y-30)){this.puff(u.x,u.y-30,'tele');u.x=t.x;u.y=t.y;u.vy=0;u.ground=false;this.puff(u.x,u.y-30,'tele');this.sfx('tele');}}
  this.target=null; return true;
 }
 hitscan(x,y,a,w,team){const dx=Math.cos(a),dy=Math.sin(a);
  for(let d=6;d<520;d+=3){const px=x+dx*d,py=y+dy*d;
   const hu=this.units.find(v=>v.alive&&v!==this.cur&&Math.abs(v.x-px)<12&&py>v.y-50&&py<v.y);
   const hb=team!==1&&this.bld.find(b=>b.hp>0&&Math.abs(b.x-px)<BLD[b.type].h*.45&&py>b.y-BLD[b.type].h&&py<b.y);
   if(this.solid(px,py)||hu||hb){this.explode(px,py,w.r,w.dmg,team,0.5,'chip');return;}
   if(d%15===0)this.parts.push({k:'tracer',x:px,y:py,t:0,life:.15});}
 }
 explode(x,y,r,dmg,team,kb=1,kind,ang){
  this.lastBoom=this.t;this.focus={x,y};this.carve(x,y,r,true,kind,ang); this.shake=Math.min(20,3+r/3.2);this.hs=Math.min(.09,.03+r/900);
  for(let i=0;i<Math.min(16,r/2.5);i++){const a=this.rand()*Math.PI*2,s=200+this.rand()*320;this.parts.push({k:'spark',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-80,t:0,life:.35+this.rand()*.35,c:this.rand()>.5?'#ffe27a':'#ff8a3d'});} this.sfx(r>20?'boom':'chip');
  for(let i=0;i<3;i++)this.parts.push({k:'ember',x:x+(this.rand()-.5)*r,y:y+(this.rand()-.5)*r*.6,t:0,life:2.5+this.rand()*2});
  this.parts.push({k:'boom',x,y,t:0,life:.45,s:r/40});
  for(let i=0;i<Math.min(18,r/2);i++){const a=this.rand()*Math.PI*2,s=120+this.rand()*260;this.parts.push({k:'debris',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-120,t:0,life:1+this.rand(),c:this.rand()>.6?this.map.edge:['#3a2c2a','#20140f','#5a463c'][this.rand()*3|0],sz:2+this.rand()*5,rot:this.rand()*6});}
  if(r>20)this.parts.push({k:'ring',x,y,t:0,life:.35,s:r});
  for(let i=0;i<4;i++)this.parts.push({k:'smoke',x:x+(this.rand()-.5)*r,y:y-this.rand()*r*.5,vx:(this.rand()-.5)*20,vy:-20-this.rand()*30,t:0,life:1.6+this.rand(),s:.4+r/90});
  for(const u of this.units){if(!u.alive)continue;const d=Math.hypot(u.x-x,(u.y-25)-y);if(d<r*1.6){
    const k=1-d/(r*1.6),hit=Math.round(dmg*k);u.hp-=hit;if(team===0&&u.team===1)this.stats.dmg+=hit;
    const a=Math.atan2((u.y-25)-y,u.x-x);u.vx+=Math.cos(a)*260*k*kb;u.vy+=Math.sin(a)*260*k*kb-140*k*kb;u.ground=false;u.anim='knock';u.at=0;
    this.parts.push({k:'num',x:u.x,y:u.y-70,t:0,life:1.2,txt:'-'+hit,c:u.team?'#7fe8ff':'#ff6b6b'});this.sfx('hurt');}}
  for(const b of this.bld){if(b.hp<=0||team===1)continue;const d=Math.hypot(b.x-x,(b.y-BLD[b.type].h/2)-y);if(d<r+BLD[b.type].h*.5){
    const hit=Math.round(dmg*1.3*(1-Math.max(0,d-BLD[b.type].h*.3)/(r+BLD[b.type].h*.5)));b.hp=Math.max(0,b.hp-hit);b.shake=1;b.flash=1;for(let i=0;i<8;i++){const a=-Math.PI*this.rand();this.parts.push({k:'spark',x:b.x+(this.rand()-.5)*30,y:b.y-BLD[b.type].h*.6,vx:Math.cos(a)*160,vy:Math.sin(a)*160,t:0,life:.5,c:'#ffd27a'});}this.parts.push({k:'smoke',x:b.x,y:b.y-BLD[b.type].h*.7,vx:0,vy:-25,t:0,life:1.8,s:.6});this.sfx('metal');if(team===0)this.stats.dmg+=hit;
    this.parts.push({k:'num',x:b.x,y:b.y-BLD[b.type].h-10,t:0,life:1.2,txt:'-'+hit,c:'#ffd23f'});
    if(b.hp<=0){this.events('bld',{type:b.type});this.sfx('collapse');this.shake=16;for(let i=0;i<14;i++){const a=-Math.PI*this.rand(),s=150+this.rand()*250;this.parts.push({k:'debris',x:b.x,y:b.y-30,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:0,life:1.5,c:'#555',sz:4+this.rand()*5});}}}}
 }
 puff(x,y,kind){for(let i=0;i<14;i++){const a=this.rand()*7;this.parts.push({k:'spark',x,y,vx:Math.cos(a)*90,vy:Math.sin(a)*90,t:0,life:.6,c:kind==='tele'?'#ff4dff':'#fff'});}}
 // ---------- AI ----------
 simulate(x,y,vx,vy,wind,kind,maxT=6,team){const dt=1/40;let t=0;const g=kind==='drone'?0:G;
  while(t<maxT){vx+=wind*dt;vy+=g*dt;x+=vx*dt;y+=vy*dt;t+=dt;if(x<0||x>=this.W||y>=H)return{x,y,out:true};if(this.solid(x,y))return{x,y};
   for(const u of this.units)if(u.alive&&t>.1&&Math.abs(u.x-x)<12&&y>u.y-48&&y<u.y)return{x,y};
   if(team!==1)for(const b of this.bld)if(b.hp>0&&Math.abs(b.x-x)<BLD[b.type].h*.4&&y>b.y-BLD[b.type].h&&y<b.y)return{x,y};}
  return{x,y,out:true};}
 bestShot(from,tgt,w,team){
  const noise=[0,0.14,0.06,0.018][this.diff]||.06,pnoise=[0,.16,.07,.02][this.diff]||.07,N=[0,90,160,260][this.diff]||160;
  let best=null;const wind=this.wind*14*w.wind;
  for(let i=0;i<N;i++){const a=-Math.PI*(0.05+0.9*this.rand());const p=.35+.65*this.rand();const sp=w.kind==='grenade'?620:820;
   const mx=from.x+Math.cos(a)*22,my=from.y-34+Math.sin(a)*22;
   const r=this.simulate(mx,my,Math.cos(a)*p*sp,Math.sin(a)*p*sp,wind,w.kind,w.kind==='grenade'?3:6,team);
   let sc=Math.hypot(r.x-tgt.x,r.y-tgt.y)+(r.out?400:0);
   for(const u of this.units)if(u.alive&&u.team===team&&Math.hypot(u.x-r.x,u.y-r.y)<w.r*1.7)sc+=300;
   if(team===1)for(const b of this.bld)if(b.hp>0&&Math.hypot(b.x-r.x,b.y-r.y)<w.r*1.5+30)sc+=250;
   if(!best||sc<best.sc)best={a,p,sc};}
  best.a+=(this.rand()-.5)*2*noise;best.p=Math.max(.2,Math.min(1,best.p*(1+(this.rand()-.5)*2*pnoise)));return best;}
 aiPlan(){
  const u=this.cur;const foes=this.raid?this.alive(0):this.alive(0);if(!foes.length)return;
  const tgt=foes.slice().sort((a,b)=>(Math.abs(a.x-u.x)+a.hp)-(Math.abs(b.x-u.x)+b.hp))[0];
  const dist=Math.hypot(tgt.x-u.x,tgt.y-u.y);let wid='bazooka';
  const am=this.ammo[1];
  if(dist<160&&am.shotgun>0)wid='shotgun';else if(this.diff>=2&&am.air>0&&dist>700&&this.rand()<.5)wid='air';
  else if(am.grenade>0&&dist<420&&this.rand()<.35)wid='grenade';else if(this.diff>=2&&am.drone>0&&this.rand()<.15)wid='drone';
  this.wsel=wid;const w=this.wdef(wid,1);const T={x:tgt.x,y:tgt.y-20};
  if(w.kind==='air'){this.target={x:tgt.x+(this.rand()-.5)*[0,120,60,20][this.diff],y:tgt.y};}
  else if(w.kind==='shot'||w.kind==='drone'){const a=Math.atan2(T.y-(u.y-34),T.x-u.x)+(this.rand()-.5)*[0,.2,.08,.02][this.diff];this.aiAim={a,p:.8};}
  else {const b=this.bestShot(u,T,w,1);this.aiAim={a:b.a,p:b.p};}
  if(!this.aiAim)this.aiAim={a:u.face>0?-0.6:-2.5,p:.7};
  this.aiT=0.55+this.rand()*0.35; this.aiPhase=0;
 }
 runTurrets(){
  this.turretQ=this.bld.filter(b=>b.type==='turret'&&b.hp>0); this.turretT=0.4;
  if(!this.turretQ.length){this.turretQ=null;const d=this.alive(1);if(d.length){this.didUnit=true;this.turnIdx[1]=(this.turnIdx[1]+1)%d.length;this.cur=d[this.turnIdx[1]];this.timer=30;this.aiPlan();}else{this.nextTurn();}}
 }
 turretShoot(b){const foes=this.alive(0);if(!foes.length)return;const tgt=foes.sort((a,c)=>Math.abs(a.x-b.x)-Math.abs(c.x-b.x))[0];
  b.face=tgt.x<b.x?-1:1;const w=Object.assign({},WEAPONS[0],{dmg:30,r:34});const from={x:b.x,y:b.y-40};
  const bs=this.bestShot({x:from.x,y:from.y+34},{x:tgt.x,y:tgt.y-20},w,1);
  this.proj.push({k:'rocket',x:from.x+Math.cos(bs.a)*30,y:from.y+Math.sin(bs.a)*30,vx:Math.cos(bs.a)*bs.p*820,vy:Math.sin(bs.a)*bs.p*820,w,team:1});
  b.recoil=1;this.parts.push({k:'flash',x:from.x+b.face*30,y:from.y-6,t:0,life:.15});this.sfx('launch');this.state='fly';this.flyT=0;}
 // ---------- update ----------
 update(dt){
  dt=Math.min(dt,1/30);if(this.hs>0){this.hs-=dt;return;}this.t+=dt;
  if(this.shake>0)this.shake=Math.max(0,this.shake-dt*30);
  for(const b of this.bld){if(!this.solid(b.x,b.y+3)&&!this.solid(b.x-12,b.y+3)&&!this.solid(b.x+12,b.y+3)&&b.y<H-5){b.vy=(b.vy||0)+G*dt;b.y+=b.vy*dt;b.fall=1;}else if(b.fall){if(b.vy>220&&b.hp>0){const hit=Math.round(b.vy/12);b.hp=Math.max(0,b.hp-hit);b.shake=1;b.flash=1;this.shake=Math.max(this.shake,6);this.parts.push({k:'num',x:b.x,y:b.y-BLD[b.type].h-10,t:0,life:1.2,txt:'-'+hit,c:'#ffd23f'});if(b.hp<=0){this.events('bld',{type:b.type});this.sfx('collapse');}}for(let i=0;i<6;i++)this.parts.push({k:'smoke',x:b.x+(this.rand()-.5)*40,y:b.y-6,vx:(this.rand()-.5)*40,vy:-15,t:0,life:1.2,s:.5});b.vy=0;b.fall=0;}
    if(b.shake>0)b.shake=Math.max(0,b.shake-dt*3);if(b.flash>0)b.flash=Math.max(0,b.flash-dt*5);if(b.recoil>0)b.recoil=Math.max(0,b.recoil-dt*4);
    if(b.hp>0&&b.hp/b.max<=.66&&this.rand()<dt*(b.hp/b.max<=.33?14:4))this.parts.push({k:b.hp/b.max<=.33?'fire':'smoke',x:b.x+(this.rand()-.5)*BLD[b.type].h*.6,y:b.y-BLD[b.type].h*(.3+.4*this.rand()),vx:(this.rand()-.5)*10,vy:-30-this.rand()*30,t:0,life:1+this.rand(),s:.3});
    if(b.hp<=0&&this.rand()<dt*3)this.parts.push({k:'smoke',x:b.x+(this.rand()-.5)*40,y:b.y-10,vx:0,vy:-25,t:0,life:2,s:.35});}
  // timer
  if(this.state==='aim'){this.timer-=dt;if(this.timer<=0){this.state='settle';this.settleT=.5;this.walking=0;}}
  if(this.state==='ai'){
    if(this.turretQ&&this.turretQ.length){this.turretT-=dt;if(this.turretT<=0){const b=this.turretQ.shift();this.turretShoot(b);this.afterTurret=true;}}
    else if(this.cur){this.aiT-=dt;const u=this.cur;
     if(this.aiPhase===0&&this.aiT<0.4){this.aiPhase=1;u.anim='aim';u.face=Math.cos(this.aiAim.a)>=0?1:-1;}
     if(this.aiPhase===1){this.aimA+=(this.aiAim.a-this.aimA)*Math.min(1,dt*6);this.aimP=this.aiAim.p;}
     if(this.aiT<=0){this.aimA=this.aiAim.a;this.state='aiFire';if(!this.fire()){this.wsel='bazooka';this.state='aiFire';this.fire();}this.aiAim=null;}}
  }
  // walking
  if(this.state==='aim'&&this.walking&&this.cur.ground&&this.moved<160){const u=this.cur,nx=u.x+this.walking*65*dt;
    let ny=u.y;let ok=false;for(let s=-10;s<=4;s++){if(!this.solid(nx,ny+s-1)&&this.solid(nx,ny+s)){ny=ny+s-1+1;ok=true;break;}}
    if(ok&&!this.solid(nx,ny-40)){this.moved+=Math.abs(nx-u.x);u.x=nx;u.y=ny;u.anim='walk';u.wt+=dt;}else if(!this.solid(nx,ny)&&!this.solid(nx,ny-40)){u.x=nx;u.ground=false;}}
  else if(this.cur&&this.cur.anim==='walk')this.cur.anim='idle';
  // units physics
  for(const u of this.units){u.at+=dt;if(u.recoil>0)u.recoil=Math.max(0,u.recoil-dt*4);
    if(!u.alive)continue;
    if(!u.ground){u.vy+=G*dt;u.vx*=(1-dt*.3);const nx=u.x+u.vx*dt,ny=u.y+u.vy*dt;
      if(this.solid(nx,ny-30)){u.vx*=-.3;}else u.x=nx;
      if(u.vy>0&&this.solid(u.x,ny)){let y=ny;while(this.solid(u.x,y)&&y>0)y--;u.y=y+1;
        if(u.vy>480){const fd=Math.round((u.vy-480)/12);u.hp-=fd;this.parts.push({k:'num',x:u.x,y:u.y-70,t:0,life:1,txt:'-'+fd,c:'#ff6b6b'});}
        u.vy=0;u.vx=0;u.ground=true;u.anim=u.hp<=0?'dead':'land';u.at=0;}
      else if(u.vy<0&&this.solid(u.x,ny-48)){u.vy=0;}else u.y=ny;
      if(u.anim!=='knock'&&!u.ground)u.anim='air';}
    else {if(!this.solid(u.x,u.y+1)&&!this.solid(u.x,u.y+3)){u.ground=false;}
      if(u.anim==='land'&&u.at>.25)u.anim='idle';if(u.anim==='fire'&&u.at>.35)u.anim='idle';if(u.anim==='hurt'&&u.at>.5)u.anim='idle';
      if(u.anim==='knock')u.anim='hurt';}
    if(u.y>H-14){u.hp=0;}
    if(u.x<4)u.x=4;if(u.x>this.W-4)u.x=this.W-4;
  }
  // projectiles
  for(const p of this.proj){const sub=4,d=dt/sub;
    for(let s=0;s<sub&&!p.dead;s++){
     if(p.k==='drone'){p.life-=d;if(this.droneSteer&&p.team===0){const ta=Math.atan2(this.droneSteer.y-p.y,this.droneSteer.x-p.x);let da=ta-p.head;da=Math.atan2(Math.sin(da),Math.cos(da));p.head+=Math.max(-3*d,Math.min(3*d,da));}
       p.vx=Math.cos(p.head)*240+this.wind*14*p.w.wind;p.vy=Math.sin(p.head)*240;if(p.life<=0){p.vy+=G*.5;}}
     else {p.vx+=this.wind*14*p.w.wind*d;p.vy+=G*d;}
     const nx=p.x+p.vx*d,ny=p.y+p.vy*d;
     const hitU=this.units.find(u=>u.alive&&(u!==this.cur||this.flyT>.25)&&Math.abs(u.x-nx)<11&&ny>u.y-48&&ny<u.y);
     const hitB=p.team!==1&&this.bld.find(b=>b.hp>0&&Math.abs(b.x-nx)<BLD[b.type].h*.4&&ny>b.y-BLD[b.type].h*.9&&ny<b.y);
     if(p.k==='grenade'){
       if(this.solid(nx,ny)){const gx=(this.solid(nx+3,ny)?1:0)-(this.solid(nx-3,ny)?1:0),gy=(this.solid(nx,ny+3)?1:0)-(this.solid(nx,ny-3)?1:0);
         let l=Math.hypot(gx,gy)||1;const n={x:-gx/l,y:-gy/l};if(!gx&&!gy){n.x=0;n.y=-1;}
         const dot=p.vx*n.x+p.vy*n.y;p.vx=(p.vx-2*dot*n.x)*.5;p.vy=(p.vy-2*dot*n.y)*.5;if(Math.abs(dot)>60)this.sfx('bounce');}
       else{p.x=nx;p.y=ny;} p.fuse-=d; if(p.fuse<=0){this.explode(p.x,p.y,p.w.r,p.w.dmg,p.team,1,'round');p.dead=true;}
     } else {
       if(this.solid(nx,ny)||hitU||hitB){this.explode(nx,ny,p.w.r,p.w.dmg,p.team,1,p.k==='rocket'?'deep':p.k==='bomb'?'bomb':p.k==='drone'?'drone':'round',Math.atan2(p.vy,p.vx));p.dead=true;}
       else{p.x=nx;p.y=ny;}
     }
     if(p.x<-300||p.x>this.W+300||p.y>H+40){p.dead=true;if(p.y>H-20){this.parts.push({k:'splash',x:p.x,y:H-16,t:0,life:.6});this.sfx('splash');}}
    }
    if(p.k==='rocket'&&this.rand()<.6)this.parts.push({k:'smoke',x:p.x,y:p.y,vx:0,vy:-8,t:0,life:.7,s:.18});
  }
  this.proj=this.proj.filter(p=>!p.dead);
  // particles
  for(const q of this.parts){q.t+=dt;if(q.vx!==undefined){q.x+=q.vx*dt;q.y+=q.vy*dt;if(q.k==='debris'){q.vy+=G*dt;if(q.vy>0&&this.solid(q.x,q.y+2)){q.y-=2;q.vy*=-.35;q.vx*=.6;q.rot=(q.rot||0)+1;if(Math.abs(q.vy)<40){q.vy=0;q.vx*=.5;}}}if(q.k==='jet'){}}}
  this.parts=this.parts.filter(q=>q.t<q.life);
  // flow
  if(this.state==='fly'){this.flyT+=dt;
    if(!this.proj.length&&this.flyT>(this.wsel==='air'&&this.team===0?1.4:.4)){this.state='settle';this.settleT=.3;this.droneSteer=null;}
  }
  if(this.state==='settle'){
    const moving=this.units.some(u=>u.alive&&!u.ground);
    const since=this.t-(this.lastBoom==null?-99:this.lastBoom),hold=since<1.4&&(since<0.7||moving||this.parts.some(q=>q.k==='debris'&&q.t<q.life*.7));   // camera linger: was >=2.6..5 s (v0.3.1), 0 (v0.3.0)
    if(this.state==='settle'&&!hold&&(!moving||since>=3)){this.settleT-=dt;if(this.settleT<=0){
      for(const u of this.units)if(u.alive&&u.hp<=0){u.alive=false;u.hp=0;u.anim='dead';this.puff(u.x,u.y-20,'x');this.events('death',{team:u.team,name:u.name});this.sfx('death');}
      if(this.turretQ&&this.turretQ.length){this.state='ai';return;}
      if(this.afterTurret&&this.team===1&&!(this.turretQ&&this.turretQ.length)){this.afterTurret=false;this.turretQ=null;
         if(this.alive(1).length&&this.raid&&!this.didUnit){this.didUnit=true;const d=this.alive(1);this.turnIdx[1]=(this.turnIdx[1]+1)%d.length;this.cur=d[this.turnIdx[1]];this.state='ai';this.aiPlan();return;}}
      this.didUnit=false;
      if(this.raid&&this.team===0){this.team=1;if(!this.checkEnd()){this.state='ai';this.cur=null;this.runTurrets();}return;}
      this.nextTurn();}}
  }
  // camera
  let fx=this.cur?this.cur.x:this.camT; const watch=this.focus&&(this.state==='fly'||this.state==='settle'); if(watch)fx=this.focus.x; if(this.proj.length)fx=this.proj[0].x; if(this.target&&this.state==='aim')fx=this.target.x;
  if(this.pan!=null)fx=this.pan;
  const vw=this.viewW(); const want=Math.max(0,Math.min(this.W-vw,fx-vw/2)); const cs=this.proj.length?6:watch?4:3; this.camX+=(want-this.camX)*Math.min(1,dt*cs);
  let fy=this.cur?this.cur.y:H*.62; if(watch)fy=this.focus.y; if(this.proj.length)fy=this.proj[0].y; if(this.target&&this.state==='aim')fy=this.target.y;
  if(this.camY==null)this.camY=Math.max(-110,Math.min(H-this.vh,fy-this.vh*.58));
  // v0.3.2: unit/impact sits a bit above centre (HUD at the bottom); a projectile only drags the camera when it leaves the readable band
  let wy=fy-this.vh*.58; if(this.proj.length&&!watch){const py=this.proj[0].y;wy=this.camY;if(py>this.camY+this.vh*.7)wy=py-this.vh*.7;}
  {const gx=Math.max(0,Math.min(this.W-1,(this.camX+vw/2)|0));const gy=Math.min(this.hs?this.surface(gx):H*.6,H-20);wy=Math.max(wy,gy-this.vh*.74);} // ground never sinks under the bottom HUD
  wy=Math.max(-110,Math.min(H-this.vh,wy)); // may look above the map top: high units keep headroom this.camY+=(wy-this.camY)*Math.min(1,dt*Math.min(3,cs));
 }
 viewW(){return this.cv.width/this.scale()}
 scale(){return this.cv.height/this.vh}
 setZoom(v){this.vh=Math.max(300,Math.min(H,v));}
 get vh(){return this._vh||VH0} set vh(v){this._vh=v}
 toWorld(sx,sy){const k=this.cv.height/490;const s=this.scale();return{x:sx*k/s+this.camX,y:sy*k/s+(this.camY||0)}}
 toScreen(x,y){const k=this.cv.height/490;const s=this.scale();return{x:(x-this.camX)*s/k,y:(y-(this.camY||0))*s/k}}
 // ---------- render ----------
 render(){
  const c=this.ctx,cw=this.cv.width,ch=this.cv.height,s=this.scale(),t=this.t;
  c.setTransform(1,0,0,1,0,0);
  const bg=img(this.map.bg); if(bg.complete&&bg.naturalWidth){const bh=ch*1.12,bw=bg.naturalWidth/bg.naturalHeight*bh;const px=-(this.camX*s*0.25)%bw;const py=Math.min(0,-(bh-ch)*Math.max(0,(this.camY||0))/Math.max(1,H-this.vh));
    if(this.o.map==='roof')c.filter='hue-rotate(-25deg) saturate(1.3) brightness(1.1)';
    for(let x=px-bw;x<cw;x+=bw)c.drawImage(bg,x,py,bw+1,bh);c.filter='none';} else {c.fillStyle='#120626';c.fillRect(0,0,cw,ch);}
  const sh=this.shake?(Math.random()-.5)*this.shake*s:0;
  c.setTransform(s,0,0,s,-this.camX*s+sh,-(this.camY||0)*s+sh);
  if(this.bk)c.drawImage(this.bk,0,0); c.drawImage(this.tc,0,0);
  for(const b of this.bld)drawBuilding(c,b,t);
  // aim preview
  if(this.state==='aim'&&this.cur){const w=this.wdef(this.wsel,0);
    if(w.kind==='proj'||w.kind==='grenade'||w.kind==='drone'||w.kind==='shot'){const u=this.cur,sp=w.kind==='grenade'?620:w.kind==='drone'?240:820;
      let x=u.x+Math.cos(this.aimA)*22,y=u.y-34+Math.sin(this.aimA)*22,vx=Math.cos(this.aimA)*this.aimP*sp,vy=Math.sin(this.aimA)*this.aimP*sp;
      c.fillStyle='#fff';const n=w.kind==='shot'?14:22;
      for(let i=0;i<n;i++){for(let k=0;k<3;k++){if(w.kind==='proj'||w.kind==='grenade')vy+=G/90;x+=vx/90;y+=vy/90;}if(w.kind==='shot'){x+=Math.cos(this.aimA)*12-vx/30;y+=Math.sin(this.aimA)*12-vy/30;}
        c.globalAlpha=1-i/n*.7;c.beginPath();c.arc(x,y,3.2-i/n*1.6,0,7);c.fill();}
      c.globalAlpha=1;c.strokeStyle='rgba(255,255,255,.5)';c.setLineDash([5,5]);c.lineWidth=2;c.beginPath();c.arc(u.x,u.y-34,46,0,7);c.stroke();c.setLineDash([]);}
  }
  if(this.target){c.strokeStyle=this.wsel==='tele'?'#ff4dff':'#ff4040';c.lineWidth=3;c.beginPath();c.arc(this.target.x,this.target.y,16+Math.sin(t*8)*3,0,7);c.moveTo(this.target.x-24,this.target.y);c.lineTo(this.target.x+24,this.target.y);c.moveTo(this.target.x,this.target.y-24);c.lineTo(this.target.x,this.target.y+24);c.stroke();}
  for(const u of this.units){drawRaccoon(c,u,t);
    if(u.alive){c.font='800 11px M,sans-serif';c.textAlign='center';const col=u.team?'#3aa0ff':'#ff4a4a';
      const bw=44,y=u.y-76;c.fillStyle='rgba(0,0,0,.6)';c.fillRect(u.x-bw/2,y,bw,6);c.fillStyle=col;c.fillRect(u.x-bw/2,y,bw*Math.max(0,u.hp)/u.max,6);
      c.fillStyle=col;c.strokeStyle='#000';c.lineWidth=3;const tx=`${u.name} ${Math.max(0,Math.round(u.hp))}`;c.strokeText(tx,u.x,y-4);c.fillText(tx,u.x,y-4);
      if(u===this.cur&&this.state==='aim'){c.fillStyle='#ffd23f';c.beginPath();const by=y-22+Math.sin(t*6)*3;c.moveTo(u.x-7,by);c.lineTo(u.x+7,by);c.lineTo(u.x,by+9);c.fill();}}}
  for(const p of this.proj){c.save();c.translate(p.x,p.y);
    if(p.k==='rocket'){c.rotate(Math.atan2(p.vy,p.vx)+Math.PI/4);const im=img('p_rocket.png');c.drawImage(im,-14,-14,28,28);}
    else if(p.k==='grenade'||p.k==='bomb'){c.rotate(this.t*8);const im=img('p_bomb.png');c.drawImage(im,-10,-10,20,20);}
    else if(p.k==='drone'){const im=img('w_drone.png');c.drawImage(im,-20,-14+Math.sin(t*30),40,28);}
    c.restore();}
  for(const q of this.parts){const k=q.t/q.life;
    if(q.k==='boom'){const im=img('fx_boom.png');const z=(30+90*k)*q.s;c.globalAlpha=1-k;c.drawImage(im,q.x-z,q.y-z,z*2,z*2);c.globalAlpha=1;}
    else if(q.k==='smoke'){const im=img('fx_smoke.png');const z=(30+50*k)*q.s;c.globalAlpha=(1-k)*.7;c.drawImage(im,q.x-z,q.y-z,z*2,z*2);c.globalAlpha=1;}
    else if(q.k==='fire'){c.globalCompositeOperation='lighter';c.fillStyle=`rgba(255,${140-100*k|0},30,${1-k})`;c.beginPath();c.arc(q.x,q.y,7*(1-k)+2,0,7);c.fill();c.globalCompositeOperation='source-over';}
    else if(q.k==='debris'){c.save();c.translate(q.x,q.y);c.rotate((q.rot||0)+q.t*6);c.fillStyle=q.c;c.fillRect(-q.sz/2,-q.sz/2,q.sz,q.sz*.7);c.restore();}
    else if(q.k==='ember'){if(this.solid(q.x,q.y+2)||1){c.globalCompositeOperation='lighter';c.fillStyle=`rgba(255,${90+Math.random()*80|0},20,${(1-k)*(.5+Math.random()*.5)})`;c.fillRect(q.x-1.5,q.y-1.5,3,3);c.globalCompositeOperation='source-over';}}
    else if(q.k==='ring'){c.strokeStyle=`rgba(255,230,180,${1-k})`;c.lineWidth=4*(1-k)+1;c.beginPath();c.arc(q.x,q.y,q.s*(.5+1.6*k),0,7);c.stroke();}
    else if(q.k==='spark'||q.k==='tracer'){c.fillStyle=q.c||'#ffe9a0';c.globalAlpha=1-k;c.fillRect(q.x-2,q.y-2,4,4);c.globalAlpha=1;}
    else if(q.k==='flash'){c.globalCompositeOperation='lighter';c.fillStyle=`rgba(255,220,120,${1-k})`;c.beginPath();c.arc(q.x,q.y,14,0,7);c.fill();c.globalCompositeOperation='source-over';}
    else if(q.k==='num'){c.font='800 16px M,sans-serif';c.textAlign='center';c.globalAlpha=1-k;c.fillStyle=q.c;c.strokeStyle='#000';c.lineWidth=4;c.strokeText(q.txt,q.x,q.y-30*k);c.fillText(q.txt,q.x,q.y-30*k);c.globalAlpha=1;}
    else if(q.k==='jet'){const im=img('w_air.png');c.save();c.translate(q.x,q.y);c.scale(q.vx>0?1:-1,1);c.drawImage(im,-50,-25,100,50);c.restore();}
    else if(q.k==='splash'){c.fillStyle=this.map.water;c.globalAlpha=1-k;for(let i=0;i<6;i++)c.fillRect(q.x+(i-3)*6,q.y-40*k*Math.sin(i),4,8);c.globalAlpha=1;}
  }
  for(const p of this.proj){const top=(this.camY||0);if(p.y<top+6){const x=Math.max(this.camX+12,Math.min(this.camX+this.viewW()-12,p.x));c.fillStyle='#ffd23f';c.strokeStyle='#000';c.lineWidth=2;c.beginPath();c.moveTo(x,top+30);c.lineTo(x-9,top+46);c.lineTo(x+9,top+46);c.closePath();c.fill();c.stroke();}}
  // toxic water
  c.globalAlpha=.85;c.fillStyle=this.map.water;const wy=H-16;c.beginPath();c.moveTo(this.camX,H);
  for(let x=this.camX;x<=this.camX+this.viewW()+10;x+=10)c.lineTo(x,wy+Math.sin(x*.03+t*2)*3);c.lineTo(this.camX+this.viewW()+10,H);c.fill();c.globalAlpha=1;
 }
}
window.RA={Battle,MAPS,WEAPONS,BLD,CHARS,drawRaccoon,drawBuilding,img};
})();
