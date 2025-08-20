// --- roundRect polyfill for older canvases ---
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const rr = Array.isArray(r) ? r : [r, r, r, r].map(v => Math.max(0, v || 0));
    const [r1, r2, r3, r4] = rr;
    this.beginPath();
    this.moveTo(x + r1, y);
    this.lineTo(x + w - r2, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r2);
    this.lineTo(x + w, y + h - r3);
    this.quadraticCurveTo(x + w, y + h, x + w - r3, y + h);
    this.lineTo(x + r4, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r4);
    this.lineTo(x, y + r1);
    this.quadraticCurveTo(x, y, x + r1, y);
  };
}

/* ===== DOM safe getters ===== */
const $ = id => { const el = document.getElementById(id); if(!el) throw new Error('Missing element '+id); return el; };
const stage=$('stage'), ctx=stage.getContext('2d');
const E={
  btnMode:$('btnMode'), selPlanet:$('selPlanet'),
  rngSunLon:$('rngSunLon'), labSunLon:$('labSunLon'),
  rngSunLat:$('rngSunLat'), labSunLat:$('labSunLat'),
  rngAmp:$('rngAmp'), labAmp:$('labAmp'),
  rngOct:$('rngOct'), labOct:$('labOct'),
  rngTau:$('rngTau'), labTau:$('labTau'),
  chkAutoPareto:$('chkAutoPareto'), rngTargetMass:$('rngTargetMass'), labTargetMass:$('labTargetMass'),
  rngQ:$('rngQ'), labQ:$('labQ'), selAxis:$('selAxis'),
  rngIntent:$('rngIntent'), labIntent:$('labIntent'),
  rngNu:$('rngNu'), labNu:$('labNu'),
  rngPts:$('rngPts'), labPts:$('labPts'),
  rngMood:$('rngMood'), labMood:$('labMood'),
  btnShuffle:$('btnShuffle'), btnClear:$('btnClear'),
  outlookGrid:$('outlookGrid'),
  simTxt:$('simTxt'), btnApply:$('btnApply'), btnReset:$('btnReset'),
  chkAutoExec:$('chkAutoExec'), btnRun:$('btnRun'),
  btnLensMode:$('btnLensMode'), rngLensR:$('rngLensR'), labLensR:$('labLensR'),
  statG:$('statG'), statV:$('statV'), statL:$('statL'), statT:$('statT'),
  statK:$('statK'), statMass:$('statMass'), statPos:$('statPos'), statNeg:$('statNeg'),
  chkAutoSextant:$('chkAutoSextant'), rngAutoSpeed:$('rngAutoSpeed'), labAutoSpeed:$('labAutoSpeed'),
  runtimeLog:$('runtimeLog')
};

/* ===== Canvas fit (robust boot) ===== */
function fitCanvas(){
  const header = document.querySelector('header');
  const h = (header && header.offsetHeight) || 64;
  const wrap = document.getElementById('stageWrap');
  if (!wrap) return;

  wrap.style.height = `calc(100vh - ${h}px)`;

  const rect = wrap.getBoundingClientRect();
  const w = Math.max(0, rect.width);
  const hpx = Math.max(0, rect.height);
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  if (w === 0 || hpx === 0) return; // layout not ready yet; boot loop will retry

  stage.width  = Math.floor(w * dpr);
  stage.height = Math.floor(hpx * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function bootOnceCanvasReady(){
  fitCanvas();
  if (stage.width === 0 || stage.height === 0) {
    requestAnimationFrame(bootOnceCanvasReady);
    return;
  }
  init(); // start the app once canvas has non-zero backing size
}
window.addEventListener('load', bootOnceCanvasReady, { once: true });
window.addEventListener('resize', fitCanvas, { passive: true });

/* ===== Math utils ===== */
const toRad=d=>d*Math.PI/180, toDeg=r=>r*180/Math.PI;
const clamp=(v,lo=-1,hi=1)=>Math.max(lo,Math.min(hi,v));
function rng(seed){let t=seed>>>0; return ()=>{t+=0x6D2B79F5; let r=Math.imul(t^(t>>>15),1|t); r^=r+Math.imul(r^(r>>>7),61|r); return ((r^(r>>>14))>>>0)/4294967296;};}
function randn(r){let u=1-r(),v=1-r(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
function chiSquare(df,r){let s=0;for(let i=0;i<df;i++){const z=randn(r); s+=z*z;} return s;}
function studentT(df,r){const z=randn(r); return z/Math.sqrt(chiSquare(df,r)/df);}
function softmax(a,t=1){const m=Math.max(...a); const ex=a.map(v=>Math.exp((v-m)/Math.max(1e-6,t))); const s=ex.reduce((x,y)=>x+y,0); return ex.map(e=>e/s);}
function greatCircleDeg(lon1,lat1,lon2,lat2){const L1=toRad(lon1),P1=toRad(lat1),L2=toRad(lon2),P2=toRad(lat2);const d=2*Math.asin(Math.sqrt(Math.sin((P2-P1)/2)**2+Math.cos(P1)*Math.cos(P2)*Math.sin((L2-L1)/2)**2));return toDeg(d);}

/* ===== Terrain + shading ===== */
function hash3(x,y,z){let h=x*374761393+y*668265263+z*73856093;h=(h^(h>>13))>>>0;return (h*0x6C50B47C)%4294967296/4294967296;}
function valueNoise3D(x,y,z){const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z);const xf=x-xi,yf=y-yi,zf=z-zi;const F=t=>t*t*(3-2*t),L=(a,b,t)=>a+(b-a)*t;const u=F(xf),v=F(yf),w=F(zf);
  let c000=hash3(xi,yi,zi),c100=hash3(xi+1,yi,zi),c010=hash3(xi,yi+1,zi),c110=hash3(xi+1,yi+1,zi),c001=hash3(xi,yi,zi+1),c101=hash3(xi+1,yi,zi+1),c011=hash3(xi,yi+1,zi+1),c111=hash3(xi+1,yi+1,zi+1);
  const x00=L(c000,c100,u),x10=L(c010,c110,u),x01=L(c001,c101,u),x11=L(c011,c111,u);const y0=L(x00,x10,v),y1=L(x01,x11,v);return L(y0,y1,w)*2-1;}
function sphereNoise(lon,lat,scale,seed){const lam=toRad(lon),phi=toRad(lat);const x=Math.cos(phi)*Math.cos(lam),y=Math.cos(phi)*Math.sin(lam),z=Math.sin(phi);const s=seed*0.12345+100;return valueNoise3D(x*scale+s,y*scale+2*s,z*scale+3*s);}
function fBmSphere(lon,lat,oct=4,lac=2.2,gain=0.5,scale=1.2,seed=1){let amp=1,fr=1,sum=0,norm=0;for(let o=0;o<oct;o++){sum+=amp*sphereNoise(lon*fr,lat*fr,scale*fr,seed+o*13);norm+=amp;amp*=gain;fr*=lac;}return sum/(norm||1);}
function gaussBump(lon,lat,Lc,Pc,s){const d=greatCircleDeg(lon,lat,Lc,Pc);return Math.exp(-(d*d)/(2*s*s));}
const planetModels={earth(lon,lat,oct,amp){const n=fBmSphere(lon,lat,oct,2.1,0.5,1.3,7);const e=(n>0?n*0.8:n*0.3);return e*amp;},mars(lon,lat,oct,amp){let n=fBmSphere(lon,lat,Math.max(1,oct-1),2.0,0.55,0.9,21)*0.7;const th=gaussBump(lon,lat,-110,-10,35)*0.9;const om=gaussBump(lon,lat,-133,18,9)*1.2;return (n+th+om*1.4)*amp;}}; 
function elevation(lon,lat){return planetModels[planet](lon,lat,terrain.oct,terrain.amp);}
function sunDir(){const lam=toRad(sun.lon),phi=toRad(sun.lat);return [Math.cos(phi)*Math.cos(lam),Math.cos(phi)*Math.sin(lam),Math.sin(phi)]}
function planetNormal(lon,lat){const lam=toRad(lon),phi=toRad(lat);const n0=[Math.cos(phi)*Math.cos(lam),Math.cos(phi)*Math.sin(lam),Math.sin(phi)];
  const d=0.5,ex=elevation(lon+d,lat)-elevation(lon-d,lat),ey=elevation(lon,lat+d)-elevation(lon,lat-d);
  const tLon=[-Math.cos(phi)*Math.sin(lam),Math.cos(phi)*Math.cos(lam),0],tLat=[-Math.sin(phi)*Math.cos(lam),-Math.sin(phi)*Math.sin(lam),Math.cos(phi)];
  const n=[ n0[0]-(ex*50)*tLon[0]-(ey*50)*tLat[0],n0[1]-(ex*50)*tLon[1]-(ey*50)*tLat[1],n0[2]-(ex*50)*tLon[2]-(ey*50)*tLat[2] ];
  const L=sunDir(); const ll=Math.hypot(...n)||1; const l=Math.max(0,(n[0]/ll)*L[0]+(n[1]/ll)*L[1]+(n[2]/ll)*L[2]); return {l};}
// Shading for Earth/Mars using elevation + sun light
function shadePlanet(ldot, elev){
  if (planet === 'earth') {
    if (elev < 0) {
      const r = (50 + 40*ldot) | 0;
      const g = (100 + 60*ldot) | 0;
      const b = (160 + 80*ldot) | 0;
      return `rgba(${r},${g},${b},0.90)`;
    }
    const r = (60 + 60*ldot) | 0;
    const g = (80 + 100*ldot) | 0;
    const b = (40 + 40*ldot) | 0;
    return `rgba(${r},${g},${b},0.95)`;
  } else {
    const r = (130 + 80*ldot) | 0;
    const g = (60 + 40*ldot) | 0;
    const b = (40 + 30*ldot) | 0;
    return `rgba(${r},${g},${b},0.95)`;
  }
}

/* ===== Projections ===== */
function projBase(){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = stage.width / dpr;
  const h = stage.height / dpr;
  const R = Math.min(w, h) * 0.42;
  const cx = w / 2, cy = h / 2;
  return { R, cx, cy };
}
function projPlanet(lon,lat,e){const {R,cx,cy}=projBase();const lam=toRad(lon),phi=toRad(lat),lam0=toRad(globe.lon0),phi0=toRad(globe.lat0);const Re=R*(1+e);
  const cosc=Math.sin(phi0)*Math.sin(phi)+Math.cos(phi0)*Math.cos(phi)*Math.cos(lam-lam0);const vis=cosc>=0;
  const x=Re*(Math.cos(phi)*Math.sin(lam-lam0))+cx,y=Re*(Math.cos(phi0)*Math.sin(phi)-Math.sin(phi0)*Math.cos(phi)*Math.cos(lam-lam0))+cy;return {x,y,visible:vis,R:Re,cx,cy};}
function invPlanet(x,y){const {R,cx,cy}=projBase();const lam0=toRad(globe.lon0),phi0=toRad(globe.lat0);const X=(x-cx)/R,Y=(y-cy)/R;const rho=Math.hypot(X,Y);if(rho>1) return null;const c=Math.asin(rho);
  const phi=Math.asin(clamp(Math.cos(c)*Math.sin(phi0)+(Y*Math.sin(c)*Math.cos(phi0)/(rho||1))));const lam=lam0+Math.atan2(X*Math.sin(c),(rho*Math.cos(phi0)*Math.cos(c)-Y*Math.sin(phi0)*Math.sin(c)));return {lon:((toDeg(lam)+540)%360)-180,lat:toDeg(phi)};}
function sphToAltAz(lon,lat,obsLon,obsLat){const lam=toRad(lon),phi=toRad(lat),lam0=toRad(obsLon),phi0=toRad(obsLat);
  const sinEl=clamp(Math.sin(phi0)*Math.sin(phi)+Math.cos(phi0)*Math.cos(phi)*Math.cos(lam-lam0));
  const Az=Math.atan2(Math.sin(lam-lam0)*Math.cos(phi), Math.cos(phi0)*Math.sin(phi)-Math.sin(phi0)*Math.cos(phi)*Math.cos(lam-lam0));
  const alt=Math.asin(sinEl); const c=Math.acos(sinEl);
  return {alt:toDeg(alt), az:(toDeg(Az)+360)%360, c:toDeg(c)};}
function projSky(az,alt){const {R,cx,cy}=projBase();const k=R*0.9/90;const r=(90-alt)*k;const th=toRad(az);const x=cx+r*Math.sin(th),y=cy-r*Math.cos(th);return {x,y,visible:alt>=0,rho:r,cx,cy,R:R*0.9};}
function invSky(x,y){const {R,cx,cy}=projBase();const k=R*0.9/90;const dx=x-cx,dy=y-cy;const r=Math.hypot(dx,dy);if(r>R*0.9+2) return null;const az=((toDeg(Math.atan2(dx,-dy))+360)%360);const alt=90-r/k;return {az,alt};}

/* ===== State ===== */
let mode='planet', planet='earth';
const globe={lon0:0,lat0:15,dragging:false,lastX:0,lastY:0};
const sun={lon:0,lat:20};
const terrain={amp:0.036,oct:4};
const DIMENSIONS=['Creed','Race','Class','Caste','Tribe','Nationality','Continentality','Planetarity','Occupation'];
let outlook=Object.fromEntries(DIMENSIONS.map(d=>[d,+1]));
let seed=42, points=[], weights=[], lockSet=new Set();
let cfg;
const lens={lon:0,lat:0, az:0,alt:60, ang:20, mode:'infosophic', dragging:false};

/* Auto-sextant state */
const auto={enabled:false, speed:0.15, targetAz:null, targetAlt:null, cooldown:0};
E.labAutoSpeed.textContent=auto.speed.toFixed(2);

/* ===== SimuLang ===== */
function defaultSimuLang(){return `# SimuLang (runtime)
pareto.tau = 0.55
quality.q = 1.00
intent.axis = radial
intent.strength = 1.20
art.nu = 3
art.points = 900
lockon.k = 8
mood.strength = 1.0
auto.pareto = true
target.mass = 0.80
terrain.amp = 0.036
terrain.oct = 4
sun.lon = 0
sun.lat = 20
# runtime:
execute.mode = auto
execute.metric = lens_intensity
`; }
function parseSimuLang(src){
  const c={paretoTau:0.55,qualityQ:1.0,intentAxis:'radial',intentStrength:1.2,artNu:3,artPoints:900,lockTopK:8,moodStrength:1.0,autoPareto:true,targetMass:0.80,amp:0.036,oct:4,sunLon:0,sunLat:20,execMode:'auto',execMetric:'lens_intensity'};
  for(const raw of src.split('\n')){const l=raw.trim(); if(!l||l.startsWith('#')) continue; const m=l.match(/^([a-z._]+)\s*=\s*(.+)$/i); if(!m) continue; const k=m[1].toLowerCase(), v=m[2].trim();
    if(k==='pareto.tau') c.paretoTau=parseFloat(v);
    else if(k==='quality.q') c.qualityQ=parseFloat(v);
    else if(k==='intent.axis') c.intentAxis=v.toLowerCase();
    else if(k==='intent.strength') c.intentStrength=parseFloat(v);
    else if(k==='art.nu') c.artNu=Math.max(1,parseInt(v));
    else if(k==='art.points') c.artPoints=Math.max(10,Math.min(5000,parseInt(v)));
    else if(k==='lockon.k') c.lockTopK=Math.max(0,parseInt(v));
    else if(k==='mood.strength') c.moodStrength=Math.max(0,parseFloat(v));
    else if(k==='auto.pareto') c.autoPareto=(v.toLowerCase()==='true');
    else if(k==='target.mass') c.targetMass=Math.min(0.95,Math.max(0.5,parseFloat(v)));
    else if(k==='terrain.amp') c.amp=Math.max(0,parseFloat(v));
    else if(k==='terrain.oct') c.oct=Math.max(1,parseInt(v));
    else if(k==='sun.lon') c.sunLon=parseFloat(v);
    else if(k==='sun.lat') c.sunLat=parseFloat(v);
    else if(k==='execute.mode') c.execMode=v.toLowerCase();
    else if(k==='execute.metric') c.execMetric=v.toLowerCase();
  }
  if (!Number.isFinite(c.artPoints) || c.artPoints < 10) c.artPoints = 900;
  if (!Number.isFinite(c.artNu) || c.artNu < 1) c.artNu = 3;
  if (!Number.isFinite(c.intentStrength)) c.intentStrength = 1.2;
  if (!Number.isFinite(c.paretoTau) || c.paretoTau <= 0) c.paretoTau = 0.55;
  if (!Number.isFinite(c.qualityQ) || c.qualityQ <= 0) c.qualityQ = 1.0;
  if (!['radial','lon','lat'].includes(c.intentAxis)) c.intentAxis = 'radial';
  return c;
}

/* ===== UI sync ===== */
function syncControls(){
  E.rngTau.value=cfg.paretoTau; E.labTau.textContent=cfg.paretoTau.toFixed(2); E.statT.textContent=cfg.paretoTau.toFixed(2);
  E.chkAutoPareto.checked=cfg.autoPareto; E.rngTargetMass.value=cfg.targetMass; E.labTargetMass.textContent=cfg.targetMass.toFixed(2);
  E.rngQ.value=cfg.qualityQ; E.labQ.textContent=cfg.qualityQ.toFixed(2);
  E.rngIntent.value=cfg.intentStrength; E.labIntent.textContent=cfg.intentStrength.toFixed(2);
  E.selAxis.value=cfg.intentAxis; E.rngNu.value=cfg.artNu; E.labNu.textContent=cfg.artNu;
  E.rngPts.value=cfg.artPoints; E.labPts.textContent=cfg.artPoints;
  E.rngMood.value=cfg.moodStrength; E.labMood.textContent=cfg.moodStrength.toFixed(2);
  E.rngLensR.value=lens.ang; E.labLensR.textContent=`${lens.ang}°`;
  E.rngAmp.value=terrain.amp=cfg.amp; E.labAmp.textContent=terrain.amp.toFixed(3);
  E.rngOct.value=terrain.oct=cfg.oct; E.labOct.textContent=terrain.oct;
  E.rngSunLon.value=sun.lon=cfg.sunLon; E.labSunLon.textContent=`${Math.round(sun.lon)}°`;
  E.rngSunLat.value=sun.lat=cfg.sunLat; E.labSunLat.textContent=`${Math.round(sun.lat)}°`;
  E.btnMode.textContent=(mode==='planet'?'Mode: Planet':'Mode: Celestial');
  E.chkAutoExec.checked=(cfg.execMode==='auto');
  E.chkAutoSextant.checked=auto.enabled;
  E.rngAutoSpeed.value=auto.speed; E.labAutoSpeed.textContent=auto.speed.toFixed(2);
}
function hueForDim(i){return (i*37)%360;}
function buildOutlookGrid(){
  E.outlookGrid.innerHTML='';
  DIMENSIONS.forEach((d,i)=>{
    const label=document.createElement('div'); const sw=document.createElement('span'); sw.className='swatch'; sw.style.background=`hsl(${hueForDim(i)} 80% 60%)`;
    label.appendChild(sw); label.appendChild(document.createTextNode(d));
    const btn=document.createElement('button'); const isPos=outlook[d]>=0;
    btn.className='toggle '+(isPos?'pos':'neg'); btn.textContent=isPos?'Optimistic':'Pessimistic';
    btn.addEventListener('click',()=>{outlook[d]=(outlook[d]>=0)?-1:+1; buildART(); ensurePoints(); computeSkyAutoTarget();});
    E.outlookGrid.appendChild(label); E.outlookGrid.appendChild(btn);
  });
}

/* ===== Field generation & weights ===== */
function recomputeWeights(){weights=softmax(points.map(p=>p.sal),Math.max(0.05,cfg.paretoTau));}
function buildART(){
  const r=rng(seed); points=[]; let pos=0,neg=0;
  let centerLon=0,centerLat=0;
  if(mode==='planet'){centerLon=lens.lon; centerLat=lens.lat;}
  else {
    const az=toRad(lens.az),alt=toRad(lens.alt),phi0=toRad(globe.lat0),lam0=toRad(globe.lon0); const d=Math.PI/2-alt;
    const phi=Math.asin(clamp(Math.sin(phi0)*Math.cos(d)+Math.cos(phi0)*Math.sin(d)*Math.cos(az)));
    const lam=lam0+Math.atan2(Math.sin(az)*Math.sin(d)*Math.cos(phi0), Math.cos(d)-Math.sin(phi0)*Math.sin(phi));
    centerLon=((toDeg(lam)+540)%360)-180; centerLat=toDeg(phi);
  }
  const scaleLon=40, scaleLat=25;
  for(let i=0;i<cfg.artPoints;i++){
    const dim=DIMENSIONS[i%DIMENSIONS.length];
    const dlon=studentT(cfg.artNu,r)*scaleLon, dlat=studentT(cfg.artNu,r)*scaleLat;
    let lon=((centerLon+dlon+540)%360)-180, lat=Math.max(-89.9,Math.min(89.9,centerLat+dlat));
    let align=0; if(cfg.intentAxis==='lon') align=1-Math.min(1,Math.abs(dlon)/scaleLon);
    else if(cfg.intentAxis==='lat') align=1-Math.min(1,Math.abs(dlat)/scaleLat);
    else {const ang=greatCircleDeg(centerLon,centerLat,lon,lat); align=Math.max(0,1-ang/60);}
    const angDist=greatCircleDeg(centerLon,centerLat,lon,lat);
    const base=1/(1+(angDist/45)**2);
    const mood=outlook[dim]||+1;
    const moodGain=1+cfg.moodStrength*(mood*0.25);
    const sal=base*(1+cfg.intentStrength*align)*moodGain;
    points.push({lon,lat,sal,dim,mood});
    if(mood>=0) pos++; else neg++;
  }
  const maxS=points.reduce((m,p)=>Math.max(m,p.sal),1e-6); for(const p of points){p.sal/=maxS;}
  recomputeWeights();
  lockSet.clear();
  if(cfg.lockTopK>0){ const top=[...points.map((p,i)=>[p.sal,i])].sort((a,b)=>b[0]-a[0]).slice(0,cfg.lockTopK).map(x=>x[1]); for(const i of top) lockSet.add(i); }
  E.statPos.textContent=pos; E.statNeg.textContent=neg;
}
function ensurePoints(){ if(!points || !Array.isArray(points) || points.length===0){ buildART(); } }

/* ===== Gauges & lens scoring ===== */
function computeDS2Dual(activeIdx){
  if(points.length===0) return {g:0,v:0};
  function posOf(p){ if(mode==='planet'){const e=elevation(p.lon,p.lat); const P=projPlanet(p.lon,p.lat,e); return {x:P.x,y:P.y,vis:P.visible};}
                     else {const s=sphToAltAz(p.lon,p.lat,globe.lon0,globe.lat0); const P=projSky(s.az,s.alt); return {x:P.x,y:P.y,vis:P.visible};} }
  let idx=activeIdx.length?activeIdx:[...points.map((p,i)=>[p.sal,i])].sort((a,b)=>b[0]-a[0]).slice(0,Math.max(3,Math.floor(points.length*0.05))).map(x=>x[1]);
  const Q=cfg.qualityQ, K=(a,b)=>{const dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy;return Math.exp(-d2/3000);}, G=(a,b)=>1/(Math.hypot(a.x-b.x,a.y-b.y)+1e-3);
  let dsg=0,dsv=0; for(const i of idx){const pi=posOf(points[i]); if(!pi.vis) continue; for(let j=0;j<points.length;j++){const pj=posOf(points[j]); if(!pj.vis) continue; const wi=weights[i]/Q, wj=weights[j]/Q; dsg+=wi*wj*K(pi,pj); dsv+=wi*wj*G(pi,pj);} }
  const squash=v=>1-Math.exp(-v/50); return {g:squash(dsg), v:squash(dsv)};
}
function lensScores(){
  const kernel=(lens.mode==='infosophic')?(a)=>Math.exp(-(a*a)/25):(a)=>1/(a+1e-2);
  let scores=new Float32Array(points.length), sum=0;
  if(mode==='planet'){
    for(let i=0;i<points.length;i++){const ang=greatCircleDeg(lens.lon,lens.lat,points[i].lon,points[i].lat); if(ang>lens.ang){scores[i]=0;continue;} const s=(weights[i]/Math.max(0.5,cfg.qualityQ))*kernel(ang); scores[i]=s; sum+=s;}
  } else {
    for(let i=0;i<points.length;i++){const sky=sphToAltAz(points[i].lon,points[i].lat,globe.lon0,globe.lat0); if(sky.alt<0){scores[i]=0;continue;}
      const ang=greatCircleDeg(0,90-lens.alt,(sky.az-lens.az),90-sky.alt); if(ang>lens.ang){scores[i]=0;continue;} const s=(weights[i]/Math.max(0.5,cfg.qualityQ))*kernel(ang); scores[i]=s; sum+=s;}
  }
  const m=Math.max(1e-6,...scores); for(let i=0;i<scores.length;i++) scores[i]/=m; const dsLocal=1-Math.exp(-sum/20); return {scores, dsLocal};
}

/* ===== Dynamic Pareto ===== */
function headStatsForTarget(target){const arr=weights.slice().sort((a,b)=>b-a); let cum=0,k=0; for(k=0;k<arr.length;k++){cum+=arr[k]; if(cum>=target) break;} return {k:k+1,headFrac:(k+1)/arr.length,mass:Math.min(1,cum)};}
function autoAdjustTau(dt){const {headFrac}=headStatsForTarget(cfg.targetMass); const err=headFrac-0.20; const step=-1.0*err*dt; cfg.paretoTau=Math.min(1.5,Math.max(0.05,cfg.paretoTau+step)); E.rngTau.value=cfg.paretoTau; E.labTau.textContent=cfg.paretoTau.toFixed(2); E.statT.textContent=cfg.paretoTau.toFixed(2); recomputeWeights();}

/* ===== Drawing ===== */
function drawParetoBar(){ if(weights.length===0) return; const x=12,y=12,W=320,H=50; ctx.save(); ctx.fillStyle='rgba(16,20,30,.78)'; ctx.strokeStyle='#27304a'; ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect(x,y,W,H,10); ctx.fill(); ctx.stroke();
  const arr=weights.slice().sort((a,b)=>b-a); let cum=0,kStar=arr.length; for(let i=0;i<arr.length;i++){cum+=arr[i]; if(cum>=cfg.targetMass){kStar=i+1; break;}} const headFrac=kStar/arr.length, headW=Math.floor(W*headFrac);
  ctx.fillStyle='rgba(110,231,166,.35)'; ctx.fillRect(x+1,y+H-16,headW-2,10); ctx.fillStyle='rgba(97,218,251,.25)'; ctx.fillRect(x+headW,y+H-16,W-headW-1,10);
  ctx.fillStyle='#cfe8ff'; ctx.font='12px ui-monospace'; ctx.fillText(`Pareto (runtime) — τ=${cfg.paretoTau.toFixed(2)} • head ${kStar}/${arr.length} (${(headFrac*100).toFixed(1)}%) • mass ${Math.min(cum,1).toFixed(2)}`, x+8, y+18);
  E.statK.textContent=`${kStar}/${arr.length}`; E.statMass.textContent=Math.min(cum,1).toFixed(2); ctx.restore(); }

function drawPlanet(){
  const {cx,cy,R}=projBase();
  ctx.beginPath(); ctx.arc(cx,cy,R*(1+terrain.amp*1.2),0,Math.PI*2); ctx.fillStyle='#060a12'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx,cy,R*(1+terrain.amp*1.0),0,Math.PI*2); ctx.fillStyle=(planet==='earth')?'#0a1525':'#120907'; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R*(1+terrain.amp*1.0),0,Math.PI*2); ctx.clip();
  const latStep=2.5, lonStep=3;
  for(let lat=-88; lat<=88; lat+=latStep){ let moved=false; ctx.beginPath();
    for(let lon=-180; lon<=180; lon+=lonStep){ const {l}=planetNormal(lon,lat); const e=elevation(lon,lat); const P=projPlanet(lon,lat,e); if(!P.visible){moved=false; continue;}
      ctx.strokeStyle=shadePlanet(l,e); ctx.lineWidth=1.2; if(!moved){ctx.moveTo(P.x,P.y); moved=true;} else ctx.lineTo(P.x,P.y);} ctx.stroke();
  }
  ctx.restore();
  const ds=computeDS2Dual([...lockSet]); ctx.strokeStyle='rgba(159,122,234,.85)'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(cx,cy,R*0.35*(.6+.6*ds.g),R*0.35*(.6+.6*ds.v),0,0,Math.PI*2); ctx.stroke();
  renderPoints(); drawLensPlanet();
  E.statG.textContent=ds.g.toFixed(3); E.statV.textContent=ds.v.toFixed(3);
}

function lensPathPlanet(){
  const steps=180,alpha=toRad(lens.ang),lam1=toRad(lens.lon),phi1=toRad(lens.lat);
  ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const t=2*Math.PI*i/steps;
    const phi2=Math.asin(clamp(Math.sin(phi1)*Math.cos(alpha)+Math.cos(phi1)*Math.sin(alpha)*Math.cos(t)));
    const lam2=lam1+Math.atan2(Math.sin(t)*Math.sin(alpha)*Math.cos(phi1),Math.cos(alpha)-Math.sin(phi1)*Math.sin(phi2));
    const e=elevation(toDeg(lam2),toDeg(phi2)); const P=projPlanet(toDeg(lam2),toDeg(phi2),e);
    if(i===0) ctx.moveTo(P.x,P.y); else ctx.lineTo(P.x,P.y);
  }
}
function drawLensPlanet(){
  const {scores,dsLocal}=lensScores(); const {cx,cy,R}=projBase();
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R*(1+terrain.amp*1.0),0,Math.PI*2); ctx.clip();
  ctx.save(); ctx.beginPath(); lensPathPlanet(); ctx.clip();
  for(let i=0;i<points.length;i++){
    const e=elevation(points[i].lon,points[i].lat); const P=projPlanet(points[i].lon,points[i].lat,e);
    if(scores[i]<=0 || !P.visible) continue;
    const s=scores[i], a=.25+.55*s; const col=(lens.mode==='infosophic')?`hsla(195,90%,60%,${a})`:`hsla(40,95%,60%,${a})`;
    ctx.beginPath(); ctx.fillStyle=col; ctx.arc(P.x,P.y,1.6+3*s,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth=2.2; ctx.setLineDash([6,4]); ctx.strokeStyle=(lens.mode==='infosophic')?'rgba(97,218,251,.9)':'rgba(251,191,36,.9)';
  ctx.beginPath(); lensPathPlanet(); ctx.stroke(); ctx.setLineDash([]);
  const Pc=projPlanet(lens.lon,lens.lat,elevation(lens.lon,lens.lat));
  const label=(lens.mode==='infosophic')?'Infosophic lens (∇⁻¹)':'Simulonic lens (∇¹)⁻¹';
  const text=`${label} • r=${lens.ang}° • local ds²=${dsLocal.toFixed(3)}`;
  ctx.fillStyle='rgba(16,20,30,.85)'; ctx.strokeStyle='#27304a'; ctx.lineWidth=1; ctx.font='12px ui-monospace';
  const wtxt=ctx.measureText(text).width+12,h=20; ctx.beginPath(); ctx.roundRect(Pc.x-wtxt/2,Pc.y-30,wtxt,h,6); ctx.fill(); ctx.stroke(); ctx.fillStyle='#cfe8ff'; ctx.fillText(text,Pc.x-wtxt/2+6,Pc.y-16);
}

function drawSky(){
  const {cx,cy,R}=projBase();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = stage.width / dpr, h = stage.height / dpr;

  const g=ctx.createRadialGradient(cx,cy,0,cx,cy,R*0.95); g.addColorStop(0,'#0b1222'); g.addColorStop(1,'#05080f');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);

  ctx.beginPath(); ctx.arc(cx,cy,R*0.9,0,Math.PI*2); ctx.strokeStyle='rgba(180,200,255,.15)'; ctx.lineWidth=2; ctx.stroke();
  ctx.strokeStyle='rgba(200,220,255,.08)'; ctx.lineWidth=1; for(let alt=10; alt<=80; alt+=10){ const P=projSky(0,alt); ctx.beginPath(); ctx.arc(P.cx,P.cy,P.rho,0,Math.PI*2); ctx.stroke(); }
  for(let az=0; az<360; az+=30){ const P0=projSky(az,0.1), P1=projSky(az,85); ctx.beginPath(); ctx.moveTo(P0.x,P0.y); ctx.lineTo(P1.x,P1.y); ctx.stroke(); }
  const ds=computeDS2Dual([...lockSet]); ctx.strokeStyle='rgba(159,122,234,.85)'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(cx,cy,R*0.28*(.6+.6*ds.g),R*0.28*(.6+.6*ds.v),0,0,Math.PI*2); ctx.stroke();
  renderPoints(); drawLensSky();
  E.statG.textContent=ds.g.toFixed(3); E.statV.textContent=ds.v.toFixed(3);
}
function lensPathSky(){
  const steps=180,alpha=lens.ang; ctx.beginPath();
  for(let i=0;i<=steps;i++){
    const t=2*Math.PI*i/steps; const col0=90-lens.alt, az0=lens.az;
    const col=Math.acos(clamp(Math.cos(toRad(alpha))*Math.cos(toRad(col0))+Math.sin(toRad(alpha))*Math.sin(toRad(col0))*Math.cos(t)));
    const dAz=Math.atan2(Math.sin(t)*Math.sin(toRad(alpha))*Math.sin(toRad(col0)),Math.cos(toRad(alpha))-Math.cos(toRad(col))*Math.cos(toRad(col0)));
    const az=(az0+toDeg(dAz)+360)%360, alt=90-toDeg(col); const P=projSky(az,alt);
    if(i===0) ctx.moveTo(P.x,P.y); else ctx.lineTo(P.x,P.y);
  }
}
function drawLensSky(){
  const {scores,dsLocal}=lensScores(); const {cx,cy,R}=projBase();
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R*0.9,0,Math.PI*2); ctx.clip();
  ctx.save(); ctx.beginPath(); lensPathSky(); ctx.clip();
  for(let i=0;i<points.length;i++){
    const s=sphToAltAz(points[i].lon,points[i].lat,globe.lon0,globe.lat0); if(s.alt<0) continue;
    const P=projSky(s.az,s.alt); const val=scores[i]; if(val<=0) continue;
    const a=.25+.55*val; const col=(lens.mode==='infosophic')?`hsla(195,90%,60%,${a})`:`hsla(40,95%,60%,${a})`;
    ctx.beginPath(); ctx.fillStyle=col; ctx.arc(P.x,P.y,1.5+3*val,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth=2.2; ctx.setLineDash([6,4]); ctx.strokeStyle=(lens.mode==='infosophic')?'rgba(97,218,251,.9)':'rgba(251,191,36,.9)';
  ctx.beginPath(); lensPathSky(); ctx.stroke(); ctx.setLineDash([]);
  const Pc=projSky(lens.az,lens.alt);
  const label=(lens.mode==='infosophic')?'Infosophic sextant (∇⁻¹)':'Simulonic sextant (∇¹)⁻¹';
  const text=`${label} • r=${lens.ang}° • local ds²=${dsLocal.toFixed(3)}`;
  ctx.fillStyle='rgba(16,20,30,.85)'; ctx.strokeStyle='#27304a'; ctx.lineWidth=1; ctx.font='12px ui-monospace';
  const wtxt=ctx.measureText(text).width+12,h=20; ctx.beginPath(); ctx.roundRect(Pc.x-wtxt/2,Pc.y-30,wtxt,h,6); ctx.fill(); ctx.stroke(); ctx.fillStyle='#cfe8ff'; ctx.fillText(text,Pc.x-wtxt/2+6,Pc.y-16);
}

function renderPoints(){
  let posCount=0,negCount=0;
  for(let i=0;i<points.length;i++){
    let P,vis=true;
    if(mode==='planet'){const e=elevation(points[i].lon,points[i].lat); P=projPlanet(points[i].lon,points[i].lat,e); vis=P.visible;}
    else {const s=sphToAltAz(points[i].lon,points[i].lat,globe.lon0,globe.lat0); P=projSky(s.az,s.alt); vis=P.visible;}
    if(!vis) continue;
    const w=weights[i]||0; const rPt=(mode==='planet'?1.4:1.2)+3.8*w; const locked=lockSet.has(i);
    const dimIdx=DIMENSIONS.indexOf(points[i].dim); const baseHue=(dimIdx*37)%360; const hue=(points[i].mood>=0)?(baseHue*0.7+120*0.3):(baseHue*0.7+0*0.3); const alpha=0.55+0.35*w;
    ctx.beginPath(); ctx.fillStyle=locked?`hsl(160 90% 60% / .95)`: `hsl(${hue} 80% 60% / ${alpha})`; ctx.strokeStyle=locked?'rgba(110,231,166,.85)':(points[i].mood>=0?'rgba(110,231,166,.28)':'rgba(248,113,113,.28)'); ctx.lineWidth=locked?1.4:0.8;
    ctx.arc(P.x,P.y,rPt*(locked?1.25:1.0),0,Math.PI*2); ctx.fill(); ctx.stroke();
    if(locked){ctx.beginPath(); ctx.setLineDash([3,3]); ctx.strokeStyle='rgba(110,231,166,.25)'; ctx.arc(P.x,P.y,rPt*2.0,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);}
    if(points[i].mood>=0) posCount++; else negCount++;
  }
  E.statPos.textContent=posCount; E.statNeg.textContent=negCount;
}

/* ===== Auto-sextant targeting ===== */
function skyVec(azDeg,altDeg){ const az=toRad(azDeg), alt=toRad(altDeg); const c=Math.cos(alt); return {x:c*Math.sin(az), y:c*Math.cos(az), z:Math.sin(alt)}; }
function vecToAzAlt(v){ const alt=Math.asin(clamp(v.z)); const az=(Math.atan2(v.x,v.y)+2*Math.PI)%(2*Math.PI); return {az:toDeg(az), alt:toDeg(alt)}; }
function computeSkyAutoTarget(){
  if(mode!=='sky'){ auto.targetAz=null; auto.targetAlt=null; return; }
  let vx=0,vy=0,vz=0, wsum=0;
  const add = (az,alt,w)=>{ const v=skyVec(az,alt); vx+=v.x*w; vy+=v.y*w; vz+=v.z*w; wsum+=w; };
  const consider = (i,wExtra=0)=>{
    const s=sphToAltAz(points[i].lon,points[i].lat,globe.lon0,globe.lat0);
    if(s.alt<0) return; const w=(weights[i]||0)+wExtra; if(w<=0) return; add(s.az,s.alt,w);
  };
  if(lockSet.size>0){ for(const i of lockSet) consider(i,0.6); }
  else { const idx=[...points.map((p,i)=>[weights[i],i])].sort((a,b)=>b[0]-a[0]).slice(0,Math.max(20,Math.floor(points.length*0.05))).map(x=>x[1]); for(const i of idx) consider(i,0); }
  if(wsum<=0){ auto.targetAz=null; auto.targetAlt=null; return; }
  const vnorm=Math.hypot(vx,vy,vz)||1; const v={x:vx/vnorm,y:vy/vnorm,z:vz/vnorm}; const tar=vecToAzAlt(v);
  auto.targetAz=tar.az; auto.targetAlt=Math.max(0, Math.min(90, tar.alt));
}
function stepLensTowardTarget(dt){
  if(mode!=='sky' || !auto.enabled || auto.targetAz==null || auto.targetAlt==null) return;
  if(lens.dragging || globe.dragging || auto.cooldown>0){ auto.cooldown=Math.max(0, auto.cooldown-dt); return; }
  const speed = auto.speed;
  let dAz = ((auto.targetAz - lens.az + 540) % 360) - 180;
  lens.az = (lens.az + dAz*speed + 360) % 360;
  lens.alt += (auto.targetAlt - lens.alt) * speed;
  lens.alt = Math.max(0, Math.min(90, lens.alt));
}

/* ===== Runtime (minimal) ===== */
function contextSnapshot(){ const ds=computeDS2Dual([...lockSet]); const head=headStatsForTarget(cfg.targetMass);
  return {mode,observer:{lon:globe.lon0,lat:globe.lat0}, lens:(mode==='planet'?{kind:lens.mode,lon:lens.lon,lat:lens.lat,radiusDeg:lens.ang}:{kind:lens.mode,az:lens.az,alt:lens.alt,radiusDeg:lens.ang}),
    ds2:{green:+ds.g.toFixed(6),vacuum:+ds.v.toFixed(6)}, tau:+cfg.paretoTau.toFixed(6), head:{k:head.k,mass:+head.mass.toFixed(6)}, selected:{indices:[...lockSet],count:lockSet.size},
    pointsCount:points.length, timestamp:new Date().toISOString()};}
function executeSimuLang(){ const {scores}=lensScores(); let sum=0,n=0; for(let i=0;i<scores.length;i++){ if(scores[i]>0){sum+=scores[i];n++;}} const lensIntensity=(n?sum/n:0);
  return {cfgUsed:{execMode:cfg.execMode,execMetric:'lens_intensity'}, result:{metric:'lens_intensity',value:+lensIntensity.toFixed(6)}};}
function appendLog(ctxObj,exec){ const line=document.createElement('div'); line.className='line'; const p1=document.createElement('div'); p1.innerHTML=`<span class="tag exec">EXEC</span> <span class="mono">${ctxObj.timestamp}</span>`; const pre=document.createElement('pre'); pre.textContent=JSON.stringify({context:ctxObj,...exec},null,2); E.runtimeLog.prepend(line); line.appendChild(p1); line.appendChild(pre); }
function maybeAutoExec(){ if(!E.chkAutoExec.checked) return; const c=contextSnapshot(); const ex=executeSimuLang(c); appendLog(c,ex); }

/* ===== Render loop ===== */
let lastT=performance.now();
function render(t){
  const dt=Math.min(0.1,(t-lastT)/1000); lastT=t;
  if(cfg.autoPareto && points.length>0) autoAdjustTau(dt);
  stepLensTowardTarget(dt);

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = stage.width / dpr, h = stage.height / dpr;
  ctx.clearRect(0,0,w,h);

  ensurePoints();

  if(mode==='planet') drawPlanet(); else drawSky();
  drawParetoBar();
  E.statL.textContent=lockSet.size;
  requestAnimationFrame(render);
}

/* ===== Interaction ===== */
stage.addEventListener('mousedown', e=>{
  const r=stage.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top;
  if(mode==='planet'){ const inv=invPlanet(x,y); if(inv){ const ang=greatCircleDeg(inv.lon,inv.lat,lens.lon,lens.lat); if(ang<=lens.ang){ lens.dragging=true; } else { globe.dragging=true; globe.lastX=x; globe.lastY=y; } } }
  else { const inv=invSky(x,y); if(inv){ const ang=greatCircleDeg(0,90-lens.alt,(inv.az-lens.az),90-inv.alt); if(ang<=lens.ang){ lens.dragging=true; } else { globe.dragging=true; globe.lastX=x; globe.lastY=y; } } }
});
addEventListener('mouseup', ()=>{ const dragged=lens.dragging; globe.dragging=false; lens.dragging=false; if(dragged){ auto.cooldown=0.25; computeSkyAutoTarget(); maybeAutoExec(); } });
addEventListener('mousemove', e=>{
  const r=stage.getBoundingClientRect(); const x=e.clientX-r.left, y=e.clientY-r.top;
  if(globe.dragging){ const dx=x-globe.lastX, dy=y-globe.lastY; globe.lon0=((globe.lon0-dx*0.2+540)%360)-180; globe.lat0=Math.max(-80,Math.min(80,globe.lat0+dy*0.2)); globe.lastX=x; globe.lastY=y; }
  else if(lens.dragging){ if(mode==='planet'){ const inv=invPlanet(x,y); if(inv){ lens.lon=inv.lon; lens.lat=inv.lat; } } else { const inv=invSky(x,y); if(inv){ lens.az=inv.az; lens.alt=Math.max(0,Math.min(90,inv.alt)); } } }
});
stage.addEventListener('click', e=>{
  if(globe.dragging||lens.dragging) return;
  const r=stage.getBoundingClientRect(); const x=e.clientX-r.left,y=e.clientY-r.top; let best=-1,bd=1e9;
  for(let i=0;i<points.length;i++){
    let P,vis; if(mode==='planet'){ const e=elevation(points[i].lon,points[i].lat); P=projPlanet(points[i].lon,points[i].lat,e); vis=P.visible; }
    else { const s=sphToAltAz(points[i].lon,points[i].lat,globe.lon0,globe.lat0); P=projSky(s.az,s.alt); vis=P.visible; }
    if(!vis) continue; const d=(P.x-x)*(P.x-x)+(P.y-y)*(P.y-y); if(d<bd){bd=d; best=i;}
  }
  if(best>=0){ if(lockSet.has(best)) lockSet.delete(best); else lockSet.add(best); computeSkyAutoTarget(); maybeAutoExec(); }
});

/* ===== Controls ===== */
E.btnMode.addEventListener('click', ()=>{
  mode=(mode==='planet')?'sky':'planet';
  E.btnMode.textContent=(mode==='planet'?'Mode: Planet':'Mode: Celestial');
  if(mode==='sky'){
    const s=sphToAltAz(lens.lon,lens.lat,globe.lon0,globe.lat0); lens.az=s.az; lens.alt=Math.max(0,s.alt);
    computeSkyAutoTarget();
  } else {
    const az=toRad(lens.az),alt=toRad(lens.alt),phi0=toRad(globe.lat0),lam0=toRad(globe.lon0); const d=Math.PI/2-alt;
    const phi=Math.asin(clamp(Math.sin(phi0)*Math.cos(d)+Math.cos(phi0)*Math.sin(d)*Math.cos(az)));
    const lam=lam0+Math.atan2(Math.sin(az)*Math.sin(d)*Math.cos(phi0), Math.cos(d)-Math.sin(phi0)*Math.sin(phi));
    lens.lon=((toDeg(lam)+540)%360)-180; lens.lat=toDeg(phi);
  }
  buildART(); ensurePoints(); maybeAutoExec();
});
E.selPlanet.addEventListener('change', e=>{ planet=e.target.value; });
E.rngSunLon.addEventListener('input', e=>{ sun.lon=parseFloat(e.target.value); E.labSunLon.textContent=`${Math.round(sun.lon)}°`; });
E.rngSunLat.addEventListener('input', e=>{ sun.lat=parseFloat(e.target.value); E.labSunLat.textContent=`${Math.round(sun.lat)}°`; });
E.rngAmp.addEventListener('input', e=>{ terrain.amp=parseFloat(e.target.value); E.labAmp.textContent=terrain.amp.toFixed(3); });
E.rngOct.addEventListener('input', e=>{ terrain.oct=parseInt(e.target.value,10); E.labOct.textContent=terrain.oct; });

E.rngTau.addEventListener('input', e=>{ cfg.paretoTau=parseFloat(e.target.value); E.labTau.textContent=cfg.paretoTau.toFixed(2); E.statT.textContent=cfg.paretoTau.toFixed(2); recomputeWeights(); computeSkyAutoTarget(); });
E.chkAutoPareto.addEventListener('change', e=>{ cfg.autoPareto=e.target.checked; });
E.rngTargetMass.addEventListener('input', e=>{ cfg.targetMass=parseFloat(e.target.value); E.labTargetMass.textContent=cfg.targetMass.toFixed(2); computeSkyAutoTarget(); });

E.rngQ.addEventListener('input', e=>{ cfg.qualityQ=parseFloat(e.target.value); E.labQ.textContent=cfg.qualityQ.toFixed(2); });
E.rngIntent.addEventListener('input', e=>{ cfg.intentStrength=parseFloat(e.target.value); E.labIntent.textContent=cfg.intentStrength.toFixed(2); buildART(); ensurePoints(); computeSkyAutoTarget(); });
E.selAxis.addEventListener('change', e=>{ cfg.intentAxis=e.target.value; buildART(); ensurePoints(); computeSkyAutoTarget(); });
E.rngNu.addEventListener('input', e=>{ cfg.artNu=parseInt(e.target.value,10); E.labNu.textContent=cfg.artNu; buildART(); ensurePoints(); computeSkyAutoTarget(); });
E.rngPts.addEventListener('input', e=>{ cfg.artPoints=parseInt(e.target.value,10); E.labPts.textContent=cfg.artPoints; buildART(); ensurePoints(); computeSkyAutoTarget(); });
E.rngMood.addEventListener('input', e=>{ cfg.moodStrength=parseFloat(e.target.value); E.labMood.textContent=cfg.moodStrength.toFixed(2); buildART(); ensurePoints(); computeSkyAutoTarget(); });

E.btnShuffle.addEventListener('click', ()=>{ seed=(seed*1664525+1013904223)>>>0; buildART(); ensurePoints(); computeSkyAutoTarget(); maybeAutoExec(); });
E.btnClear.addEventListener('click', ()=>{ lockSet.clear(); computeSkyAutoTarget(); maybeAutoExec(); });

E.btnApply.addEventListener('click', ()=>{ cfg={...cfg, ...parseSimuLang(E.simTxt.value)}; syncControls(); buildART(); ensurePoints(); computeSkyAutoTarget(); maybeAutoExec(); });
E.btnReset.addEventListener('click', ()=>{ E.simTxt.value=defaultSimuLang(); cfg=parseSimuLang(E.simTxt.value); syncControls(); buildART(); ensurePoints(); computeSkyAutoTarget(); maybeAutoExec(); });

E.btnLensMode.addEventListener('click', ()=>{ lens.mode = lens.mode==='infosophic' ? 'simulonic' : 'infosophic'; E.btnLensMode.textContent = (lens.mode==='infosophic' ? 'Lens: Infosophic (I)' : 'Lens: Simulonic (S)'); maybeAutoExec(); });
addEventListener('keydown', (e)=>{ if(e.key.toLowerCase()==='i'){ lens.mode='infosophic'; E.btnLensMode.textContent='Lens: Infosophic (I)'; maybeAutoExec(); }
                                   if(e.key.toLowerCase()==='s'){ lens.mode='simulonic'; E.btnLensMode.textContent='Lens: Simulonic (S)'; maybeAutoExec(); }});
E.rngLensR.addEventListener('input', e=>{ lens.ang=parseInt(e.target.value,10); E.labLensR.textContent=`${lens.ang}°`; buildART(); ensurePoints(); computeSkyAutoTarget(); });

E.chkAutoSextant.addEventListener('change', e=>{ auto.enabled=e.target.checked; if(auto.enabled){ computeSkyAutoTarget(); } });
E.rngAutoSpeed.addEventListener('input', e=>{ auto.speed=parseFloat(e.target.value); E.labAutoSpeed.textContent=auto.speed.toFixed(2); });

E.btnRun.addEventListener('click', ()=>{ const c=contextSnapshot(); const ex=executeSimuLang(c); appendLog(c,ex); });

/* ===== Init ===== */
function init(){
  E.simTxt.value=defaultSimuLang();
  cfg=parseSimuLang(E.simTxt.value);
  syncControls();
  buildOutlookGrid();
  buildART();
  ensurePoints();
  computeSkyAutoTarget();
  requestAnimationFrame(render);
}
