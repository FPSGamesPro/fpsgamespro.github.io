const NS = 'http://www.w3.org/2000/svg';
const W = 1920, H = 1080, GROUND = 938;
const svg = document.querySelector('#game');
const world = document.querySelector('#world');
const dynamic = document.querySelector('#dynamic');
const fxLayer = document.querySelector('#fx');
const aimLayer = document.querySelector('#aim');
const overlay = document.querySelector('#overlay');
const hint = document.querySelector('#hint');
const roundsUI = [...document.querySelectorAll('.round')];
const levelLabel = document.querySelector('#levelLabel');
const resultTitle = document.querySelector('#resultTitle');
const resultSub = document.querySelector('#resultSub');
const resultIcon = document.querySelector('#resultIcon');
const retry = document.querySelector('#retry');
const muteButton = document.querySelector('#mute');

const audio = {
  music: new Audio('assets/audio/dust-and-gunpowder.mp3'),
  shot: new Audio('assets/audio/hero-gunshot.mp3'),
  boom: new Audio('assets/audio/tnt-chain-blast.mp3')
};
audio.music.loop = true; audio.music.volume = .18; audio.shot.volume = .55; audio.boom.volume = .65;
audio.music.preload = 'auto';
let audioStarted = false, muted = false, ctx;

function tryStartMusic(){
  if (audioStarted) return;
  const p = audio.music.play();
  if (p && p.then) {
    p.then(()=>{ audioStarted = true; }).catch(()=>{});
  } else {
    audioStarted = true;
  }
}
if (audio.music.readyState >= 3) {
  tryStartMusic();
} else {
  audio.music.addEventListener('canplaythrough', tryStartMusic, { once:true });
  audio.music.addEventListener('loadeddata', tryStartMusic, { once:true });
}
['pointerdown','keydown','touchstart','click'].forEach(evt=>{
  window.addEventListener(evt, ()=>{
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    tryStartMusic();
  });
});

function unlockAudio(){
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  tryStartMusic();
}
function play(name){ if(muted) return; const s=audio[name].cloneNode(); s.volume=audio[name].volume; s.play().catch(()=>{}); }
function ping(freq=900, dur=.08, type='square'){
  if(!ctx || muted) return; const o=ctx.createOscillator(), g=ctx.createGain(); o.type=type; o.frequency.value=freq;
  g.gain.setValueAtTime(.08,ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+dur); o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime+dur);
}
muteButton.addEventListener('click',e=>{e.stopPropagation();unlockAudio();muted=!muted;audio.music.muted=muted;muteButton.textContent=muted?'×':'♫';});

function el(tag, attrs={}, html=''){
  const n=document.createElementNS(NS,tag); for(const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if(html)n.innerHTML=html; return n;
}
function log(event,data={}){ window.ProgressLogger?.logProgress(event,data); }

world.innerHTML = `
  <rect width="1920" height="1080" fill="url(#sky)"/>
  <circle cx="1510" cy="240" r="110" fill="#ffe6a0" opacity=".75"/>
  <path d="M0 610L180 455l105 90 170-185 170 228 180-137 188 145 210-207 190 201 155-125 216 156 156-83v438H0z" fill="#76506a" opacity=".55"/>
  <path d="M0 700q260-170 520 0t520 0 520 0 360-20v310H0z" fill="#bd6450"/>
  <path d="M0 802q290-120 590 0t640-15 690 10v283H0z" fill="url(#sand)"/>
  <rect y="800" width="1920" height="280" fill="url(#grain)"/>
  <path d="M0 938h1920v142H0z" fill="#422c32"/><path d="M0 938h1920" stroke="#ffd27d" stroke-width="14"/>
  <g opacity=".38" fill="#402b39"><path d="M270 765v-95h18v95m-54-52h95v18h-95"/><path d="M1730 780v-110h20v110m-55-61h120v20h-120"/></g>`;

let level=0, bulletsLeft=3, state='play', mouse={x:900,y:500}, bullet=null;
let enemies=[], explosives=[], towers=[], platforms=[], effects=[];
const hero={x:210,y:836};
let heroNode, aimPath, muzzleFlash;
let pointerHeld = false;

function heroMarkup(){return `<g filter="url(#shadow)">
  <ellipse cx="0" cy="72" rx="64" ry="15" fill="#251e2c" opacity=".35"/>
  <path d="M-35 20l-18 98h38L0 60l17 58h40L34 17z" fill="#243b58" stroke="#111827" stroke-width="10"/>
  <path d="M-54 112h43v19h-62q-9-17 19-19m68 0h44q26 4 17 19H14z" fill="#171e2d" stroke="#101521" stroke-width="8"/>
  <path d="M-52-44q5-61 58-62t58 61L44 25h-81z" fill="#1b83a8" stroke="#142338" stroke-width="10"/>
  <circle cy="-76" r="47" fill="#eaa064" stroke="#3a252b" stroke-width="9"/>
  <path d="M-45-92q11-52 57-46 37 4 43 41z" fill="#17304c"/><path d="M-60-91q55-23 120 0" stroke="#ffb43d" stroke-width="13"/>
  <path d="M-17-72h8m30 0h8" stroke="#172031" stroke-width="8" stroke-linecap="round"/><path d="M-7-49q16 12 30 0" fill="none" stroke="#6d332d" stroke-width="6"/>
  <path d="M37-25l85-16 7 24-81 31z" fill="#5d392b" stroke="#1d1c25" stroke-width="9"/><path d="M116-45h57v20h-52z" fill="#b7cad0" stroke="#1d1c25" stroke-width="8"/>
  <circle cx="45" cy="-10" r="17" fill="#eaa064" stroke="#3a252b" stroke-width="7"/>
  <path d="M-34-12l-48 27" stroke="#eaa064" stroke-width="23" stroke-linecap="round"/>
</g>`}
function enemyMarkup(i){return `<g filter="url(#shadow)">
 <ellipse cx="0" cy="76" rx="56" ry="14" fill="#241b29" opacity=".35"/><path d="M-35 18l-14 96h37L0 61l16 53h38L34 13z" fill="#412d42" stroke="#271c2b" stroke-width="9"/>
 <path d="M-48 108h40v19h-61q-6-17 21-19m61 0h43q25 4 16 19H13z" fill="#201927" stroke="#16121d" stroke-width="7"/>
 <path d="M-52-41q8-60 52-59 46 1 53 61l-14 65h-80z" fill="#c83d3f" stroke="#3b222d" stroke-width="10"/>
 <circle cy="-73" r="44" fill="#d98557" stroke="#41232d" stroke-width="9"/>
 <path d="M-48-86q14-48 51-46 42 2 50 47z" fill="#783337"/><path d="M-58-84q53-20 115 0" stroke="#1e2331" stroke-width="12"/>
 <path d="M-22-70l13 2m23 0l13-2" stroke="#211923" stroke-width="8" stroke-linecap="round"/><path d="M-9-47q12-8 25 0" fill="none" stroke="#692d31" stroke-width="6"/>
 <path d="M-50-13l-43 33m126-33l43 31" stroke="#d98557" stroke-width="21" stroke-linecap="round"/>
 </g>`}
function makeHero(){heroNode=el('g',{transform:`translate(${hero.x} ${hero.y})`},heroMarkup());dynamic.append(heroNode);}
function makeEnemy(x,id){const n=el('g',{transform:`translate(${x} 820)`,class:'enemy'},enemyMarkup(id));dynamic.append(n);return {x,y:820,r:49,alive:true,node:n,dy:0,spin:0};}
function makeExplosive(x,type){
 const n=el('g',{transform:`translate(${x} 850)`,filter:'url(#shadow)'});
 n.innerHTML=type==='tnt'?`<rect x="-42" y="-48" width="84" height="88" rx="8" fill="#df3937" stroke="#54262b" stroke-width="9"/><path d="M-42-17h84M-42 17h84" stroke="#ffcf72" stroke-width="10"/><text x="0" y="7" text-anchor="middle" fill="#fff3c5" font-family="Barlow Condensed" font-weight="900" font-size="35">TNT</text><path d="M0-49q8-31 31-22" fill="none" stroke="#2d2630" stroke-width="7"/><circle cx="33" cy="-74" r="8" fill="#ffb62f"/>`:`<path d="M-43-51q43-19 86 0v90q-43 20-86 0z" fill="#df712d" stroke="#482832" stroke-width="9"/><path d="M-43-40h86M-43 28h86" stroke="#303344" stroke-width="12"/><path d="M-8-10h16v35H-8zM-8-31h16v13H-8z" fill="#ffe07a"/>`;
 dynamic.append(n); return {x,y:850,r:50,type,alive:true,node:n};
}
function makeTower(x){
 const n=el('g',{transform:`translate(${x} ${GROUND}) rotate(0)`});
 n.innerHTML=`<g filter="url(#shadow)"><path d="M-45 0V-292h90V0" fill="#754636" stroke="#332630" stroke-width="11"/><path d="M-38-235h76M-38-168h76M-38-101h76" stroke="#d88c4b" stroke-width="19"/><path d="M-69-309h138v42H-69z" fill="#344052" stroke="#202434" stroke-width="10"/><path d="M-56-314l28-43 28 43 28-43 28 43" fill="#e6a44d" stroke="#382a31" stroke-width="9"/><path d="M-82 0h164" stroke="#2a222b" stroke-width="19"/></g>`;
 dynamic.append(n);return{x,y:GROUND,w:96,h:320,node:n,falling:false,fallen:false,angle:0,dir:1};
}
function makePlatform(x,y,w){const n=el('g',{});n.innerHTML=`<rect x="${x}" y="${y}" width="${w}" height="27" rx="8" fill="#34475a" stroke="#1e2634" stroke-width="8"/><path d="M${x+16} ${y+8}h${w-32}" stroke="#e9a64a" stroke-width="5" stroke-dasharray="24 18"/>`;dynamic.prepend(n);return{x,y,w,h:27,node:n};}

function clearLevel(){dynamic.innerHTML='';fxLayer.innerHTML='';aimLayer.innerHTML='';enemies=[];explosives=[];towers=[];platforms=[];effects=[];bullet=null;}
function shuffled(a){return a.sort(()=>Math.random()-.5)}
function newLevel(){
 level++; clearLevel(); state='play'; bulletsLeft=3; roundsUI.forEach(x=>x.classList.remove('spent')); overlay.classList.remove('show');
 levelLabel.textContent=`Wanted ${String(level).padStart(2,'0')}`; hint.textContent='Move your mouse to aim • Click to fire';
 const count=1+Math.floor(Math.random()*4); const slots=shuffled([740,990,1250,1510,1700]).slice(0,count).sort((a,b)=>a-b);
 slots.forEach((x,i)=>enemies.push(makeEnemy(x,i)));
 if(count>=2 && Math.random()<.72){const target=enemies[enemies.length-1];const tx=target.x-175;towers.push(makeTower(tx));}
 const propCandidates=slots.map(x=>x-100).filter(x=>!towers.some(t=>Math.abs(t.x-x)<100));
 if(propCandidates.length) explosives.push(makeExplosive(propCandidates[0],Math.random()<.58?'tnt':'barrel'));
 if(count>=3 && propCandidates.length>1) explosives.push(makeExplosive(propCandidates[propCandidates.length-1],Math.random()<.55?'barrel':'tnt'));
 if(Math.random()<.7){const px=820+Math.random()*400, py=540+Math.random()*100;platforms.push(makePlatform(px,py,220+Math.random()*120));}
 makeHero();
 aimPath=el('path',{fill:'none',stroke:'#fff4bc','stroke-width':8,'stroke-linecap':'round','stroke-dasharray':'2 28',opacity:.88,filter:'url(#glow)'});aimLayer.append(aimPath);
 muzzleFlash=el('g',{});aimLayer.append(muzzleFlash); updateAim(); log('level_start',{level,enemies:count});
}

function svgPoint(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return{x:q.x,y:q.y};}

svg.addEventListener('pointermove',e=>{ mouse=svgPoint(e); updateAim(); });
svg.addEventListener('pointerdown',e=>{
  if(e.button!==0) return;
  e.preventDefault();
  unlockAudio();
  pointerHeld = true;
  mouse = svgPoint(e);
  updateAim();
});
svg.addEventListener('pointerup',e=>{
  if(e.button!==0) return;
  if(!pointerHeld) return;
  pointerHeld = false;
  if(state!=='play') return;
  unlockAudio();
  mouse = svgPoint(e);
  updateAim();
  shoot();
});
svg.addEventListener('pointercancel',()=>{ pointerHeld=false; });
svg.addEventListener('pointerleave',()=>{ pointerHeld=false; });
window.addEventListener('blur',()=>{ pointerHeld=false; });

function aimVector(){let dx=mouse.x-(hero.x+170),dy=mouse.y-(hero.y-35),m=Math.hypot(dx,dy)||1;return{x:dx/m,y:dy/m};}
function updateAim(){
 if(!aimPath||state!=='play'||bullet){if(aimPath)aimPath.setAttribute('opacity','0');return;}aimPath.setAttribute('opacity','.88');
 const v=aimVector();let x=hero.x+170,y=hero.y-35,vx=v.x,vy=v.y,d=`M${x} ${y}`;
 for(let b=0;b<4;b++){
  let ts=[vx>0?(1890-x)/vx:(30-x)/vx,vy>0?(GROUND-10-y)/vy:(150-y)/vy].filter(t=>t>0);let t=Math.min(...ts,520);x+=vx*t;y+=vy*t;d+=` L${x} ${y}`;
  if(t===520)break;if(x<40||x>1880)vx*=-1;else vy*=-1;
 }
 aimPath.setAttribute('d',d);
 const a=Math.atan2(v.y,v.x)*180/Math.PI;heroNode?.setAttribute('transform',`translate(${hero.x} ${hero.y})`);heroNode?.querySelector('g')?.setAttribute('transform',`rotate(${Math.max(-12,Math.min(12,a*.08))})`);
}
function shoot(){
 if(bullet||bulletsLeft<=0)return; const v=aimVector(); bulletsLeft--; roundsUI[bulletsLeft].classList.add('spent');play('shot');log('shot',{level,remaining:bulletsLeft});
 muzzleFlash.innerHTML=`<path d="M${hero.x+170} ${hero.y-35}l42-18-12 25 22 13-44 9z" fill="#fff1a1"/>`;setTimeout(()=>muzzleFlash.innerHTML='',70);
 const n=el('g',{});n.innerHTML='<circle r="15" fill="#ffda53" stroke="#542f24" stroke-width="7"/><path d="M-28 0h18" stroke="#fff6b4" stroke-width="8" stroke-linecap="round"/>';dynamic.append(n);
 bullet={x:hero.x+170,y:hero.y-35,vx:v.x*1450,vy:v.y*1450,r:13,node:n,life:0,bounces:0};updateAim();
}
function bounceSound(){ping(1250,.055,'square');}
function killEnemy(en,reason){
 if(!en.alive)return;en.alive=false;en.dy=-260;en.spin=(Math.random()>.5?1:-1)*360;en.node.style.opacity='.85';burst(en.x,en.y-30,reason==='crush'?'#ddc08a':'#ef5542',10);ping(reason==='crush'?100:320,.16,'sawtooth');
 hint.textContent=reason==='crush'?'SQUISHED! +250':reason==='frag'?'SHRAPNEL! +150':'BANDIT DOWN! +100';
 setTimeout(endCheck,80);
}

const BLAST_RADIUS   = 340;
const TOWER_RADIUS   = 260;
const CHAIN_RADIUS   = 340;

function explode(ex){
 if(!ex.alive)return;
 if(ex.type==='tnt'){
   ex.alive=false;ex.node.remove();play('boom');
   burst(ex.x,ex.y,'#ff9e28',42,true,1.7);
   enemies.forEach(e=>{if(e.alive&&Math.hypot(e.x-ex.x,e.y-ex.y)<BLAST_RADIUS)killEnemy(e,'blast')});
   towers.forEach(t=>{if(!t.falling&&!t.fallen&&Math.abs(t.x-ex.x)<TOWER_RADIUS)fallTower(t,1)});
   explosives.forEach(other=>{
     if(other.alive&&other!==ex&&other.type==='tnt'&&Math.hypot(other.x-ex.x,other.y-ex.y)<CHAIN_RADIUS)
       setTimeout(()=>explode(other),120);
   });
 } else {
   triggerBarrel(ex);
 }
}
function triggerBarrel(ex){
 if(ex.spent) return;
 ex.spent = true;
 ex.alive = false;
 burst(ex.x,ex.y-20,'#ffc357',22,false,1.2);
 ping(260,.18,'triangle');
 let found = false;
 for(const other of explosives){
   if(other===ex) continue;
   if(!other.alive) continue;
   if(other.type!=='tnt') continue;
   if(Math.hypot(other.x-ex.x,other.y-ex.y) < CHAIN_RADIUS){
     found = true;
     setTimeout(()=>explode(other),120);
   }
 }
 hint.textContent = found ? 'BARREL RUPTURED!' : 'BARREL BURST!';
 ex.node.remove();
}
function fallTower(t,dir){if(t.falling||t.fallen)return;t.falling=true;t.dir=dir>=0?1:-1;hint.textContent='TIMBER!';ping(145,.22,'sawtooth');}
function burst(x,y,color,count,big=false,scale=1){
 const ringR = big ? 18*scale : 12*scale;
 const ringW = (big ? 34 : 16) * scale;
 const ring=el('circle',{cx:x,cy:y,r:ringR,fill:'none',stroke:color,'stroke-width':ringW,opacity:1});
 fxLayer.append(ring);
 effects.push({type:'ring',node:ring,x,y,r:ringR,life:0,big,scale});
 const baseSpeed = (big?260:150) * scale;
 const baseR     = (big?10:6) * scale;
 for(let i=0;i<count;i++){
   const a=Math.random()*Math.PI*2, s=baseSpeed*(0.4+Math.random());
   const n=el('circle',{cx:x,cy:y,r:4+Math.random()*baseR,fill:i%3?color:'#fff0a1'});
   fxLayer.append(n);
   effects.push({type:'spark',node:n,x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-80,life:0});
 }
}
function endCheck(){
 if(state!=='play'||bullet)return;
 if(enemies.every(e=>!e.alive)){setTimeout(()=>finish(true),500);return;}
 if(towers.some(t=>t.falling)){setTimeout(endCheck,180);return;}
 if(bulletsLeft===0)setTimeout(()=>finish(false),450);
}
function finish(win){
 if(state!=='play')return;state=win?'win':'lose';aimPath?.setAttribute('opacity','0');overlay.classList.add('show');
 resultIcon.textContent=win?'★':'↻';resultTitle.textContent=win?'Clean Shot!':'Failed!';resultSub.textContent=win?`${enemies.length} bandit${enemies.length>1?'s':''} cleared.`:'Failed.';retry.textContent=win?'Next Level!':'Next Level!';log(win?'level_complete':'level_failed',{level});
}
retry.addEventListener('click',()=>{unlockAudio();if(state==='lose')level--;newLevel();});

function bulletHitRect(b,r){return b.x+b.r>r.x&&b.x-b.r<r.x+r.w&&b.y+b.r>r.y&&b.y-b.r<r.y+r.h;}
function update(dt){
 for(const t of towers){if(t.falling){t.angle+=150*dt;if(t.angle>=88){t.angle=88;t.falling=false;t.fallen=true;burst(t.x+t.dir*t.h*.55,GROUND-20,'#d6a35c',18);enemies.forEach(e=>{const lo=Math.min(t.x,t.x+t.dir*t.h),hi=Math.max(t.x,t.x+t.dir*t.h);if(e.alive&&e.x>lo-55&&e.x<hi+55)killEnemy(e,'crush')});}t.node.setAttribute('transform',`translate(${t.x} ${GROUND}) rotate(${t.angle*t.dir})`);}}
 if(bullet){
  bullet.life+=dt; const steps=3,sd=dt/steps;
  for(let s=0;s<steps&&bullet;s++){
   const b=bullet;b.x+=b.vx*sd;b.y+=b.vy*sd;
   if(b.x<28&&b.vx<0){b.x=28;b.vx*=-1;b.bounces++;bounceSound()}if(b.x>1892&&b.vx>0){b.x=1892;b.vx*=-1;b.bounces++;bounceSound()}
   if(b.y<145&&b.vy<0){b.y=145;b.vy*=-1;b.bounces++;bounceSound()}if(b.y>GROUND-14&&b.vy>0){b.y=GROUND-14;b.vy*=-1;b.bounces++;bounceSound()}
   for(const p of platforms){if(bullet&&bulletHitRect(b,p)){b.vy*=-1;b.y=b.vy<0?p.y-b.r:p.y+p.h+b.r;b.bounces++;bounceSound();}}
   for(const ex of explosives){
     if(!ex.alive||ex.spent)continue;
     if(Math.hypot(b.x-ex.x,b.y-ex.y)<b.r+ex.r){
       if(ex.type==='tnt'){explode(ex);}
       else{triggerBarrel(ex);}
       removeBullet();break;
     }
   }
   if(!bullet)break;
   for(const e of enemies){if(e.alive&&Math.hypot(b.x-e.x,b.y-e.y)<b.r+e.r){killEnemy(e,'shot');removeBullet();break;}}
   if(!bullet)break;
   for(const t of towers){if(!t.falling&&!t.fallen&&b.x>t.x-55&&b.x<t.x+55&&b.y>GROUND-t.h-20&&b.y<GROUND){fallTower(t,b.vx);removeBullet();break;}}
   if(!bullet)break;
   if(b.life>.28&&Math.hypot(b.x-hero.x,b.y-(hero.y-35))<58){burst(hero.x,hero.y-40,'#ef3c38',18);removeBullet();hint.textContent='OUCH! THAT CAME BACK!';bulletsLeft=0;roundsUI.forEach(x=>x.classList.add('spent'));setTimeout(()=>finish(false),450);break;}
   if(b.life>7||b.bounces>8){removeBullet();break;}
  }
  if(bullet)bullet.node.setAttribute('transform',`translate(${bullet.x} ${bullet.y}) rotate(${bullet.life*900})`);
 }
 for(const e of enemies){if(!e.alive&&e.node.isConnected){e.dy+=650*dt;e.y+=e.dy*dt;e.node.setAttribute('transform',`translate(${e.x} ${e.y}) rotate(${e.spin*Math.min(1,(e.y-700)/300)})`);if(e.y>1100)e.node.remove();}}

 for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life+=dt;if(e.type==='spark'){e.vy+=460*dt;e.x+=e.vx*dt;e.y+=e.vy*dt;e.node.setAttribute('cx',e.x);e.node.setAttribute('cy',e.y);e.node.setAttribute('opacity',Math.max(0,1-e.life/1.1));}else{e.r+=dt*(e.big?420:180)*(e.scale||1);e.node.setAttribute('r',e.r);e.node.setAttribute('opacity',Math.max(0,1-e.life/.65));}if(e.life>1.1){e.node.remove();effects.splice(i,1);}}
}
function removeBullet(){if(!bullet)return;bullet.node.remove();bullet=null;updateAim();setTimeout(endCheck,100);}
let last=performance.now();function loop(now){const dt=Math.min(.025,(now-last)/1000);last=now;if(state==='play')update(dt);requestAnimationFrame(loop)}
newLevel();requestAnimationFrame(loop);
