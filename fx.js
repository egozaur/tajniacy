/* Wspólne efekty Tajniaków (index.html i duo.html): dźwięk Snd, ilustracje kart illus(), deszcz akt celebrate(), dziura po kuli bulletScar().
   Zwykły skrypt: globalne stałe i funkcje, ładowany przed kodem strony. */
/* ---------- dźwięk (Web Audio, bez plików) ---------- */
const Snd=(()=>{
  let ctx=null, master=null, mus=null, fx=null, delay=null, nbuf=null, timer=null;
  const st={m:true,s:true,mv:.5,sv:.85};
  try{ Object.assign(st, JSON.parse(localStorage.getItem('tj_snd')||'{}')); }catch(e){}
  // jednorazowo: nowe domyślne ustawienia (muzyka 50%) także dla osób z zapisanymi ustawieniami
  try{ if(!localStorage.getItem('tj_def_v2')) st.mv=.5; }catch(e){}
  let tension=false, hushed=false, step=0, nextT=0;
  const save=()=>{ try{localStorage.setItem('tj_snd',JSON.stringify(st));}catch(e){} };
  const mtof=n=>440*Math.pow(2,(n-69)/12);

  function init(){
    if(ctx) return true;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return false;
    try{ ctx=new AC(); }catch(e){ return false; }
    const comp=ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
    master=ctx.createGain(); master.gain.value=.9; master.connect(comp);
    mus=ctx.createGain(); mus.gain.value=0; mus.connect(master);
    fx=ctx.createGain(); fx.gain.value=st.sv*.9; fx.connect(master);
    delay=ctx.createDelay(1); delay.delayTime.value=.36;
    const fb=ctx.createGain(); fb.gain.value=.34;
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=2000;
    const wet=ctx.createGain(); wet.gain.value=.4;
    delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(mus);
    nbuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
    const d=nbuf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    return true;
  }

  /* podstawowe klocki */
  function tone(f,t0,dur,type,vol,f2,dst,send){
    const o=ctx.createOscillator(), g=ctx.createGain(); o.type=type||'sine';
    o.frequency.setValueAtTime(f,t0); if(f2) o.frequency.exponentialRampToValueAtTime(f2,t0+dur);
    g.gain.setValueAtTime(.0001,t0); g.gain.exponentialRampToValueAtTime(vol,t0+.015); g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
    o.connect(g); g.connect(dst||fx); if(send) g.connect(delay);
    o.start(t0); o.stop(t0+dur+.05);
  }
  function noise(t0,dur,type,f0,f1,vol,dst,q,att){
    const s=ctx.createBufferSource(); s.buffer=nbuf; s.loop=true;
    const f=ctx.createBiquadFilter(); f.type=type; f.frequency.setValueAtTime(f0,t0); if(f1) f.frequency.exponentialRampToValueAtTime(f1,t0+dur); f.Q.value=q||1;
    const g=ctx.createGain(); const a=att||Math.min(.02,dur/3);
    g.gain.setValueAtTime(.0001,t0); g.gain.exponentialRampToValueAtTime(vol,t0+a); g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
    s.connect(f); f.connect(g); g.connect(dst||fx); s.start(t0,Math.random()); s.stop(t0+dur+.05);
  }

  /* muzyka: noir jazz w d-moll, 4 takty w pętli */
  const CH=[
    {v:[53,57,60,64], b:[38,41,45,44], m:[69,72,74,76,77]},   // Dm9
    {v:[53,59,62,64], b:[43,47,50,49], m:[71,74,77,79,76]},   // G13
    {v:[52,55,59,62], b:[36,40,43,44], m:[67,71,72,76,74]},   // Cmaj9
    {v:[55,58,61,64], b:[45,49,52,50], m:[69,73,76,77,79]}    // A7b9
  ];
  function playStep(n,t,beat){
    const c=CH[n>>3], s=n&7, bt=s>>1, off=s&1;
    if(!off){ // kontrabas
      const o=ctx.createOscillator(), g=ctx.createGain(), f=ctx.createBiquadFilter();
      o.type='triangle'; o.frequency.value=mtof(c.b[bt]+12); f.type='lowpass'; f.frequency.value=700;
      g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.32,t+.012); g.gain.exponentialRampToValueAtTime(.0001,t+beat*.92);
      o.connect(f); f.connect(g); g.connect(mus); o.start(t); o.stop(t+beat);
    }
    if(s===0||s===4) tone(120,t,.16,'sine',s===0?.18:.1,45,mus);                 // cichy kop
    if(!off) noise(t,.07,'highpass',7000,null,.03,mus); else if(s===3||s===7) noise(t,.07,'highpass',7000,null,.022,mus); // talerz
    if(s===2||s===6) noise(t,.15,'bandpass',2800,null,.03,mus,.7,.01);           // miotełki
    if(s===0||s===3){ const vel=s===0?1:.7;                                       // akordy
      c.v.forEach(p=>{ tone(mtof(p),t,.42,'triangle',.05*vel,null,mus,true); tone(mtof(p),t,.3,'sine',.03*vel,null,mus); }); }
    if(tension&&!off){ tone(62,t,.2,'sine',.26,40,mus); tone(62,t+beat*.27,.16,'sine',.16,40,mus); } // bicie serca
    if(!tension&&Math.random()<(off?.1:.17)){                                    // melodia
      const p=c.m[Math.floor(Math.random()*c.m.length)];
      tone(mtof(p),t,beat*(off?.45:1)*(.6+Math.random()*.7),'triangle',.065,null,mus,true);
    }
  }
  function tick(){
    if(!ctx) return;
    const beat=60/(tension?104:80);
    if(nextT<ctx.currentTime) nextT=ctx.currentTime+.05;
    while(nextT<ctx.currentTime+.3){
      playStep(step,nextT,beat);
      nextT+=(step&1)?beat*.38:beat*.62;
      step=(step+1)&31;
    }
  }
  function level(){ if(!ctx) return; mus.gain.setTargetAtTime((hushed||!st.m)?0:st.mv*.8,ctx.currentTime,.2); }
  function startMusic(){
    if(!st.m||!init()) return;
    if(ctx.state==='suspended') ctx.resume();
    if(!timer){ nextT=ctx.currentTime+.1; step=0; timer=setInterval(tick,60); }
    level();
  }
  function stopMusic(){ level(); if(timer){ const t=timer; timer=null; setTimeout(()=>clearInterval(t),500); } }

  /* efekty */
  const SFX={
    flip(t){ noise(t,.3,'bandpass',500,3200,.55,fx,.8); tone(190,t+.24,.1,'triangle',.32,90); },
    r(t){ [523.25,659.25,783.99,1046.5].forEach((f,i)=>{ tone(f,t+i*.07,.38,'triangle',.22); tone(f*2,t+i*.07,.2,'sine',.05); }); },
    b(t){ [440,554.37,659.25,880].forEach((f,i)=>{ tone(f,t+i*.07,.42,'sine',.3); tone(f*3,t+i*.07,.12,'sine',.04); }); },
    neutral(t){ tone(220,t,.34,'sawtooth',.15,150); tone(110,t,.34,'square',.07,75); },
    bad(t){ tone(392,t,.22,'triangle',.26,330); tone(311,t+.2,.42,'triangle',.26,247); },
    turn(t){ noise(t,.36,'bandpass',300,2200,.13,fx,.7); tone(659.25,t+.05,.18,'triangle',.2); tone(493.88,t+.2,.32,'triangle',.2); },
    swell(t){ // narastanie i uderzenie (ok. 0,95 s po starcie)
      noise(t,.98,'highpass',1200,8000,.38,fx,.6,.9);
      tone(55,t,.95,'sawtooth',.05,110);
      const b=t+.95;
      tone(95,b,1.8,'sine',.8,26); noise(b,1,'lowpass',1400,90,.55);
      tone(155,b,2,'sawtooth',.11,118); tone(164.8,b,2,'sawtooth',.1,124); tone(233,b,1.4,'square',.05,170);
    },
    shot(t){ // wystrzał: trzask, uderzenie, pogłos i rykoszet
      noise(t,.25,'lowpass',9000,600,1.1,fx,.4,.002); tone(140,t,.45,'sine',.9,35);
      noise(t+.03,1.4,'bandpass',1200,300,.16,fx,.8,.02); tone(2600,t+.08,.6,'sine',.04,700); },
    stamp(t){ noise(t,.12,'lowpass',900,200,.7,fx,.7,.003); tone(90,t,.2,'sine',.5,50); },
    flap(t){ for(let i=0;i<5;i++) noise(t+i*.04,.03,'highpass',3000,null,.16,fx,1,.002); },
    win(t){ const L=[[523.25,0,.13],[523.25,.15,.13],[523.25,.3,.13],[659.25,.45,.2],[783.99,.68,.9]];
      L.forEach(([f,d,l])=>{ tone(f,t+d,l+.1,'sawtooth',.11); tone(f*2,t+d,l,'square',.04); });
      [523.25,659.25,783.99,1046.5].forEach(f=>tone(f,t+.68,1.4,'triangle',.1,null,fx,true)); }
  };

  return {
    st,
    unlock(){ if(!init()) return; if(ctx.state==='suspended') ctx.resume(); if(st.m&&!timer) startMusic(); },
    play(n){ if(!st.s||!init()) return; if(ctx.state==='suspended') ctx.resume(); SFX[n]&&SFX[n](ctx.currentTime+.01); },
    setMusic(on){ st.m=!!on; save(); if(on) startMusic(); else stopMusic(); },
    setSfx(on){ st.s=!!on; save(); },
    setVol(k,v){ st[k==='m'?'mv':'sv']=v; save(); if(ctx){ if(k==='m') level(); else fx.gain.setTargetAtTime(v*.9,ctx.currentTime,.05); } },
    tension(on){ tension=!!on; },
    hush(on){ hushed=!!on; level(); }
  };
})();

/* animacje wyłączone przy prefers-reduced-motion */
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ilustracje na rewersie kart (inline SVG, bez plików) */
const SKIN='#f1cdaa', SKIN2='#dcae88';
const SKULL='M50 8C28 8 15 24 15 42C15 54 21 62 30 66V82C30 85 32 88 36 88H64C68 88 70 85 70 82V66C79 62 85 54 85 42C85 24 72 8 50 8ZM29 46A9 9 0 1 0 47 46A9 9 0 1 0 29 46ZM53 46A9 9 0 1 0 71 46A9 9 0 1 0 53 46ZM50 54L45 64H55Z';
function illus(k,cls){
  const o=`<svg class="ill${cls?' '+cls:''}" viewBox="0 0 100 100" aria-hidden="true">`;
  if(k==='a') return o+`<circle cx="50" cy="48" r="40" fill="rgba(200,0,0,.22)"/>
    <g stroke="rgba(255,70,70,.45)" stroke-width="1" fill="none"><circle cx="50" cy="50" r="33"/><path d="M50 10V24M50 76V90M10 50H24M76 50H90"/></g>
    <path d="M8 100C10 80 26 71 50 71C74 71 90 80 92 100Z" fill="#0d0d0d"/>
    <path d="M50 11C31 11 24 29 24 46C24 61 31 73 39 77H61C69 73 76 61 76 46C76 29 69 11 50 11Z" fill="#1b1b1b"/>
    <ellipse cx="50" cy="50" rx="16" ry="19" fill="#050505"/>
    <path transform="translate(36.5 35) scale(.27)" fill="#e8e2d4" fill-rule="evenodd" d="${SKULL}"/>
    <circle cx="46.8" cy="47.4" r="1.5" fill="#ff3030"/><circle cx="53.2" cy="47.4" r="1.5" fill="#ff3030"/></svg>`;
  if(k==='n') return o+`<circle cx="50" cy="46" r="40" fill="rgba(255,255,255,.14)"/>
    <path d="M10 100C12 82 26 73 50 73C74 73 88 82 90 100Z" fill="#8c7b66"/>
    <path d="M41 73Q50 83 59 73" fill="none" stroke="#6f604e" stroke-width="3"/>
    <rect x="44" y="60" width="12" height="14" fill="${SKIN2}"/><ellipse cx="50" cy="49" rx="14" ry="16" fill="${SKIN}"/>
    <g fill="none" stroke="#2d2620" stroke-width="1.6"><circle cx="44.5" cy="49" r="4.3"/><circle cx="55.5" cy="49" r="4.3"/><path d="M48.8 49H51.2"/></g>
    <path d="M45.5 59Q50 61 54.5 59" stroke="#8d4f3a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M35 42C34 31 41 26 51 26C60 26 66 31 66 38L74 41C74 43.5 69 44 64 43L36 44Z" fill="#5e4e3c"/>
    <g transform="rotate(-5 50 90)"><rect x="22" y="78" width="56" height="26" rx="1" fill="#f5f0e3"/><path d="M26 83H50M26 87.5H74M26 92H74M26 96.5H62" stroke="rgba(0,0,0,.35)" stroke-width="1.5"/><rect x="55" y="81" width="19" height="9" fill="rgba(0,0,0,.22)"/></g>
    <ellipse cx="22" cy="88" rx="4" ry="5" fill="${SKIN}"/><ellipse cx="78" cy="85" rx="4" ry="5" fill="${SKIN}"/></svg>`;
  return o+`<circle cx="50" cy="46" r="40" fill="rgba(255,255,255,.13)"/>
    <path d="M6 100C8 82 24 72 50 72C76 72 92 82 94 100Z" fill="#1f1a17"/>
    <path d="M39 72L50 98L61 72Z" fill="#f3efe7"/>
    <path d="M47.6 75H52.4L54 91L50 96L46 91Z" style="fill:var(--${k})" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>
    <path d="M28 75L40 72L50 96L36 84Z" fill="#2c2621"/><path d="M72 75L60 72L50 96L64 84Z" fill="#2c2621"/>
    <rect x="44" y="58" width="12" height="15" fill="${SKIN2}"/><ellipse cx="50" cy="48" rx="14" ry="16" fill="${SKIN}"/>
    <path d="M36.5 45H63.5V49.5C63.5 52.5 61.5 54 58.5 54H54.5C52 54 51 51.5 50 50C49 51.5 48 54 45.5 54H41.5C38.5 54 36.5 52.5 36.5 49.5Z" fill="#111"/>
    <path d="M39 46.5H45" stroke="rgba(255,255,255,.5)" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M45.5 59.5Q50 61.5 54.5 59.5" stroke="#8d4f3a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="50" cy="36" rx="28" ry="5.5" fill="#15110e"/>
    <path d="M35 36C35 21 41 15 50 15C59 15 65 21 65 36Z" fill="#241d18"/>
    <path d="M35.3 31H64.7V35.5H35.3Z" style="fill:var(--${k})"/>
    <path d="M44 18Q50 22 56 18" stroke="rgba(0,0,0,.4)" stroke-width="1.5" fill="none"/></svg>`;
}
/* zwycięstwo: spadają akta, odznaki i pieczątki w kolorze zwycięzców */
function celebrate(t){
  if(calm()) return;
  const R=(a,b)=>a+Math.random()*(b-a);
  const badge=`<svg class="bdg" viewBox="0 0 70 80" aria-hidden="true"><path d="M35 3L64 14V38C64 57 51 70 35 77C19 70 6 57 6 38V14Z" style="fill:var(--${t})" stroke="#f2c94c" stroke-width="4"/>
    <path d="M35 22L40 33L52 34L43 42L46 54L35 48L24 54L27 42L18 34L30 33Z" fill="#f2c94c"/></svg>`;
  for(let i=0;i<48;i++){
    const d=document.createElement('div'), kind=i%3;
    d.className='drop '+t;
    d.innerHTML=kind===0?'<div class="doc"></div>':kind===1?badge:'<div class="stmp">TAJNE</div>';
    d.style.left=R(-4,100)+'vw';
    d.style.setProperty('--r0',R(-40,40)+'deg'); d.style.setProperty('--r1',R(-360,360)+'deg'); d.style.setProperty('--dx',R(-14,14)+'vw');
    d.style.animationDuration=R(3.2,5.6)+'s'; d.style.animationDelay=R(0,1.4)+'s';
    d.firstElementChild.style.animationDuration=R(.9,1.8)+'s';
    document.body.appendChild(d); setTimeout(()=>d.remove(),7500);
  }
}
/* baner tury: wjeżdża teczka, pieczątka z nazwą drużyny, teczka wyjeżdża */
/* dziura po kuli z pęknięciami i rozpryskiem krwi w miejscu karty zabójcy */
function bulletScar(x,y){
  document.querySelectorAll('.scar').forEach(e=>e.remove());
  const W=innerWidth, H=innerHeight, u=Math.min(W,H)/100, R=(a,b)=>a+Math.random()*(b-a), f=v=>v.toFixed(1);
  let cracks='';
  for(let k=0;k<11;k++){
    const a=k/11*Math.PI*2+R(-.2,.2), L=R(5,15)*u, n=3+Math.floor(R(0,3)); let d=`M${f(x)} ${f(y)}`;
    for(let s=1;s<=n;s++){ const rr=L*s/n, aa=a+R(-.25,.25); d+=` L${f(x+Math.cos(aa)*rr)} ${f(y+Math.sin(aa)*rr)}`; }
    cracks+=`<path d="${d}"/>`;
  }
  const dir=R(0,Math.PI*2); let drops=`<circle cx="${f(x+Math.cos(dir)*2*u)}" cy="${f(y+Math.sin(dir)*2*u)}" r="${f(4*u)}"/>`;
  for(let k=0;k<24;k++){
    const dist=R(2,20)*u, a=dir+R(-.6,.6), r=Math.max(.25,R(.4,2.4)*(1-dist/(22*u)))*u;
    const cx=x+Math.cos(a)*dist, cy=y+Math.sin(a)*dist;
    drops+=k%5===0?`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r*2.4)}" ry="${f(r*.7)}" transform="rotate(${f(a*180/Math.PI)} ${f(cx)} ${f(cy)})"/>`:`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/>`;
  }
  const s=document.createElement('div');
  s.innerHTML=`<svg class="scar" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <g class="spl" fill="#9d0b0b" style="transform-origin:${f(x)}px ${f(y)}px">${drops}</g>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="rgba(0,0,0,.45)" stroke-width="${f(.45*u)}">${cracks}</g><g stroke="rgba(255,255,255,.6)" stroke-width="${f(.18*u)}">${cracks}</g></g>
    <circle cx="${f(x)}" cy="${f(y)}" r="${f(1.7*u)}" fill="#141414" stroke="#4a4a4a" stroke-width="${f(.45*u)}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(.8*u)}" fill="#000"/></svg>`;
  document.body.appendChild(s.firstElementChild);
}
/* odkrycie zabójcy: reflektor, zaciemnienie, strzał, karta z czaszką */
