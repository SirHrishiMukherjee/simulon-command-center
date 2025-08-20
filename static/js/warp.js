let booted = false;

export function initWarpDrive() {
  if (booted) return;
  booted = true;

  const root = document.getElementById('Warp-Drive');
  if (!root) return;

  // ----- DOM helpers (scoped to tab) -----
  const $ = sel => root.querySelector(sel);
  const svg = $('#graph');
  const nodeLayer = $('#nodes');
  const edgeLayer = $('#edges');
  const particleLayer = $('#particles');
  const intentLayer = $('#intentLayer');

  // Controls
  const bias = $('#bias'), flux = $('#flux');
  const o_bias = $('#o_bias'), o_flux = $('#o_flux');
  const bearing = $('#bearing'), mag = $('#mag'), gain = $('#gain');
  const o_bearing = $('#o_bearing'), o_mag = $('#o_mag'), o_gain = $('#o_gain');
  const focusSel = $('#focus'), targetSel = $('#targetNode'), autoSteer = $('#autoSteer');
  const couplingVal = $('#couplingVal'), coherenceVal = $('#coherenceVal'), readinessVal = $('#readinessVal');

  // ----- Node definitions -----
  const CORE = [
    { id:'INC', label:'Inertial Null Core', sub:'Nullness • Stability', r:28, x:170, y:340 },
    { id:'MEA', label:'Membrane Emitter Array', sub:'Gain • Density', r:26, x:430, y:130 },
    { id:'HO',  label:'Harmonic Oscillator', sub:'Frequency • Q', r:26, x:770, y:340 },
  ];
  const CENTER = { x:500, y:340, R:150 };
  const SFGS = Array.from({length:12}, (_,i) => {
    const a = (i/12)*Math.PI*2;
    return { id:`SFG${i+1}`, label:'SFG', sub:`Simulonic Field Gen #${i+1}`, r:18,
             x: CENTER.x + CENTER.R*Math.cos(a),
             y: CENTER.y + CENTER.R*Math.sin(a) };
  });
  const ALL = [...CORE, ...SFGS];

  const NS = 'http://www.w3.org/2000/svg';
  function makeNode(n){
    const g = document.createElementNS(NS,'g');
    g.classList.add('node-wrap'); g.dataset.id=n.id;
    g.setAttribute('transform', `translate(${n.x},${n.y})`);
    const hit = document.createElementNS(NS,'circle'); hit.setAttribute('class','hit'); hit.setAttribute('r', n.r+20);
    const c   = document.createElementNS(NS,'circle'); c.setAttribute('class','node'); c.setAttribute('r', n.r);
    const t1  = document.createElementNS(NS,'text');  t1.setAttribute('class','label'); t1.setAttribute('text-anchor','middle'); t1.setAttribute('dy', -(n.r+20)); t1.textContent = n.label;
    const t2  = document.createElementNS(NS,'text');  t2.setAttribute('class','sublabel'); t2.setAttribute('text-anchor','middle'); t2.setAttribute('dy', n.r+22); t2.textContent = n.sub;
    g.appendChild(hit); g.appendChild(c); g.appendChild(t1); g.appendChild(t2);
    nodeLayer.appendChild(g);
    n.g=g; n.hit=hit; n.circ=c;
  }
  ALL.forEach(makeNode);

  // Drag core nodes
  CORE.forEach(n=>enableDrag(n));
  function enableDrag(n){
    let dragging=false, ox=0, oy=0;
    n.hit.addEventListener('pointerdown', e=>{
      dragging=true; e.target.setPointerCapture?.(e.pointerId);
      ox = e.clientX - n.x; oy = e.clientY - n.y;
    });
    window.addEventListener('pointermove', e=>{
      if(!dragging) return;
      n.x = Math.max(40, Math.min(960, e.clientX - ox));
      n.y = Math.max(60, Math.min(640, e.clientY - oy));
      n.g.setAttribute('transform', `translate(${n.x},${n.y})`);
      updateAllEdges();
      updateIntentGraphics();
    });
    window.addEventListener('pointerup', ()=> dragging=false);
  }

  // ----- Edges: complete graph -----
  const edges = []; // {a,b,path,main}
  function bez(a,b,bulge=24){
    const dx=b.x-a.x, dy=b.y-a.y, mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    const len = Math.hypot(dx,dy)||1, ux=-dy/len, uy=dx/len;
    const cx = mx + ux*bulge, cy = my + uy*bulge;
    return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
  }
  function addEdge(a,b, main=false){
    const p = document.createElementNS(NS,'path');
    p.setAttribute('class','edge' + (main?' main':'')); p.setAttribute('stroke','url(#flux)');
    p.setAttribute('d', bez(a,b, main?40:24));
    edgeLayer.appendChild(p);
    edges.push({a,b,path:p,main});
  }
  // Emphasized core triangle
  addEdge(ALL.find(n=>n.id==='INC'), ALL.find(n=>n.id==='MEA'), true);
  addEdge(ALL.find(n=>n.id==='MEA'), ALL.find(n=>n.id==='HO'),  true);
  addEdge(ALL.find(n=>n.id==='HO'),  ALL.find(n=>n.id==='INC'), true);
  // Complete graph
  for(let i=0;i<ALL.length;i++){
    for(let j=i+1;j<ALL.length;j++){
      const ia=ALL[i].id, jb=ALL[j].id;
      const isMain = (ia==='INC'&&jb==='MEA')||(ia==='MEA'&&jb==='HO')||(ia==='HO'&&jb==='INC');
      if(!isMain) addEdge(ALL[i], ALL[j], false);
    }
  }
  function updateAllEdges(){
    edges.forEach(e=> e.path.setAttribute('d', bez(e.a,e.b, e.main?40:24)));
  }

  // ----- Particles (continuous + bursts) -----
  const MAX_PARTICLES = 900;
  const particles = []; // {el, path, t, speed}

  function spawnParticleOnPath(path, intensity=1){
    if(particles.length >= MAX_PARTICLES){
      const old = particles.shift();
      if(old?.el?.parentNode) old.el.parentNode.removeChild(old.el);
    }
    const el = document.createElementNS(NS,'circle');
    el.setAttribute('class','particle');
    const baseR = 2.8;
    el.setAttribute('r', (baseR + Math.random()*1.4*intensity).toFixed(2));
    particleLayer.appendChild(el);
    const p = { el, path, t: Math.random()*0.2, speed: 0.0022 + Math.random()*0.003*intensity };
    particles.push(p);
    try {
      const len = path.getTotalLength();
      const pt  = path.getPointAtLength(p.t * len);
      el.setAttribute('cx', pt.x); el.setAttribute('cy', pt.y);
      el.setAttribute('opacity', 0.55 + 0.4*(1-p.t));
    } catch {}
  }

  function connectedEdgesOf(node){
    return edges.filter(e=> e.a===node || e.b===node);
  }

  function burstFromNode(node, magnitude=1){
    const connected = connectedEdgesOf(node);
    connected.forEach(e=> e.path.classList.add('active'));
    setTimeout(()=> connected.forEach(e=> e.path.classList.remove('active')), 900);

    const count = Math.floor(8 + 16*magnitude);
    for(const e of connected){
      for(let i=0;i<count;i++) spawnParticleOnPath(e.path, 0.9 + 0.6*magnitude);
    }
  }

  // ----- CII Intent Vector -----
  [bearing, mag, gain].forEach(el => el.addEventListener('input', ()=>{
    o_bearing.textContent = bearing.value;
    o_mag.textContent = (+mag.value).toFixed(2);
    o_gain.textContent = (+gain.value).toFixed(2);
    updateIntentGraphics();
  }));
  [focusSel, targetSel].forEach(el => el.addEventListener('change', updateIntentGraphics));

  function deg2rad(d){ return d*Math.PI/180; }
  function intentVec(){
    const th = deg2rad(+bearing.value);
    const m = +mag.value;
    return { x: Math.cos(th)*m, y: Math.sin(th)*m, th, m };
  }

  // Intent graphics
  const intentStem = document.createElementNS(NS,'path');
  intentStem.setAttribute('class','intent-stem'); intentStem.setAttribute('marker-end','url(#arrowHead)');
  const intentCore = document.createElementNS(NS,'circle');
  intentCore.setAttribute('class','intent-core');
  intentCore.setAttribute('cx', CENTER.x); intentCore.setAttribute('cy', CENTER.y); intentCore.setAttribute('r', CENTER.R+18);
  const intentLabel = document.createElementNS(NS,'text');
  intentLabel.setAttribute('x', CENTER.x); intentLabel.setAttribute('y', CENTER.y- (CENTER.R+36));
  intentLabel.setAttribute('text-anchor','middle'); intentLabel.setAttribute('class','label'); intentLabel.textContent='CII Intent';
  intentLayer.appendChild(intentCore); intentLayer.appendChild(intentStem); intentLayer.appendChild(intentLabel);

  function updateIntentGraphics(){
    const R = CENTER.R + 130;
    const V = intentVec();
    const x2 = CENTER.x + Math.cos(V.th)*R;
    const y2 = CENTER.y + Math.sin(V.th)*R;
    const scale = 0.35 + 0.65*V.m;
    const xEnd = CENTER.x + (x2-CENTER.x)*scale;
    const yEnd = CENTER.y + (y2-CENTER.y)*scale;
    const ctrl = 0.18;
    const cx = CENTER.x + (xEnd-CENTER.x)* (1-ctrl) - (yEnd-CENTER.y)*0.08;
    const cy = CENTER.y + (yEnd-CENTER.y)* (1-ctrl) + (xEnd-CENTER.x)*0.08;
    intentStem.setAttribute('d', `M ${CENTER.x} ${CENTER.y} Q ${cx} ${cy} ${xEnd} ${yEnd}`);
  }
  updateIntentGraphics();

  function nodeById(id){ return ALL.find(n=>n.id===id); }

  // Weighted edge selection by intent alignment & focus
  function pickIntentWeightedEdge(){
    const V = intentVec();
    const g = +gain.value;
    const focus = focusSel.value;
    const target = nodeById(targetSel.value);

    let total = 0;
    const weights = new Array(edges.length).fill(0);
    for(let i=0;i<edges.length;i++){
      const e = edges[i];
      if(focus==='core' && !(isCore(e.a) && isCore(e.b))) { weights[i]=0; continue; }
      if(focus==='sfg' && !(isSFG(e.a) && isSFG(e.b))) { weights[i]=0; continue; }
      if(focus==='target' && !(e.a===target || e.b===target)) { weights[i]=0; continue; }

      const mx=(e.a.x+e.b.x)/2, my=(e.a.y+e.b.y)/2;
      const ex = mx - CENTER.x, ey = my - CENTER.y;
      const elen = Math.hypot(ex,ey)||1;
      const dx = ex/elen, dy = ey/elen;

      const align = Math.max(0, (dx*V.x + dy*V.y));
      const base = 1;
      const w = base * (1 + V.m * g * align);
      weights[i]=w; total += w;
    }
    if(total<=0) return edges[(Math.random()*edges.length)|0];
    let r = Math.random()*total;
    for(let i=0;i<weights.length;i++){
      r -= weights[i];
      if(r<=0) return edges[i];
    }
    return edges[edges.length-1];
  }

  function isCore(n){ return n.id==='INC'||n.id==='MEA'||n.id==='HO'; }
  function isSFG(n){ return n.id.startsWith('SFG'); }

  // Continuous emission with intent bias
  function continuousEmit(){
    const f = +flux.value;
    const emitEdges = Math.floor(2 + f * 14);
    for(let i=0;i<emitEdges;i++){
      const e = pickIntentWeightedEdge();
      const intensity = 0.6 + 0.9*f;
      spawnParticleOnPath(e.path, intensity);
    }
  }

  // Intent Pulse
  $('#pulse').addEventListener('click', ()=>{
    const tgt = nodeById(targetSel.value) || CORE[0];
    burstFromNode(tgt, 1.5);
  });

  // Warp mechanic
  const warpCounter = Object.fromEntries(ALL.map(n=>[n.id,0]));
  const WARP_THRESHOLD = 5;
  function doWarp(n){
    n.g.classList.add('warping');
    setTimeout(()=> n.g.classList.remove('warping'), 620);
    if(n.id.startsWith('SFG')){
      const j=6; n.x += (Math.random()*2-1)*j; n.y += (Math.random()*2-1)*j;
      n.g.setAttribute('transform', `translate(${n.x},${n.y})`);
      updateAllEdges();
      updateIntentGraphics();
    }
  }
  ALL.forEach(n=>{
    n.hit.addEventListener('click', (evt)=>{
      burstFromNode(n, 1.2);
      warpCounter[n.id] += 1;
      if(warpCounter[n.id] >= WARP_THRESHOLD){ warpCounter[n.id]=0; doWarp(n); }
      if(evt.shiftKey){ targetSel.value = n.id; updateIntentGraphics(); }
    });
  });

  // Meters + sliders
  [bias,flux].forEach(s=> s.addEventListener('input', ()=>{
    if(s===bias) o_bias.textContent=(+bias.value).toFixed(2);
    if(s===flux) o_flux.textContent=(+flux.value).toFixed(2);
  }));

  function computeRingSymmetry(){
    const targetR = CENTER.R; let acc = 0;
    for(const s of SFGS){
      const dr = Math.hypot(s.x-CENTER.x, s.y-CENTER.y) - targetR;
      acc += Math.max(0, 1 - Math.min(1, Math.abs(dr)/20));
    }
    return acc / SFGS.length;
  }

  function computeIntentAlignment(){
    const V = intentVec();
    let ax=0, ay=0;
    for(const s of SFGS){
      const vx = s.x - CENTER.x, vy = s.y - CENTER.y;
      const L = Math.hypot(vx,vy)||1;
      ax += vx/L; ay += vy/L;
    }
    const L = Math.hypot(ax,ay)||1; ax/=L; ay/=L;
    return Math.max(0, ax*V.x + ay*V.y);
  }

  function computeState(){
    const particleFactor = Math.min(1, particles.length / MAX_PARTICLES);
    const ringSymmetry   = computeRingSymmetry();
    const intentAlign    = computeIntentAlignment();
    const coupling = Math.max(0, Math.min(1,
      0.26*particleFactor + 0.24*ringSymmetry + 0.35*(+flux.value) + 0.15*intentAlign*(+gain.value)/2
    ));
    const coherence= Math.max(0, Math.min(1,
      0.42*ringSymmetry + 0.18*particleFactor + 0.30*(1 - Math.abs(+bias.value-0.5)*2) + 0.10*intentAlign
    ));
    let readiness='Idle', cls='warn';
    if(coupling>0.75 && coherence>0.75){ readiness='Warp-Ready'; cls='ok' }
    else if(coupling>0.5 && coherence>0.5){ readiness='Aligning'; cls='warn' }
    else { readiness='Unstable'; cls='bad' }
    return {coupling, coherence, readiness, cls};
  }

  // Auto-steer (CII guidance)
  function autoSteerUpdate(dt){
    if(!autoSteer.checked) return;
    let worst=null, worstErr=-1;
    const R = CENTER.R;
    for(const s of SFGS){
      const dr = Math.abs(Math.hypot(s.x-CENTER.x, s.y-CENTER.y)-R);
      if(dr>worstErr){ worstErr=dr; worst=s; }
    }
    if(!worst) return;
    const ang = Math.atan2(CENTER.y - worst.y, CENTER.x - worst.x);
    let current = ( +bearing.value ) * Math.PI/180;
    let diff = ((ang - current + Math.PI*3) % (Math.PI*2)) - Math.PI;
    const rate = 0.9; // rad/s
    const step = Math.max(-rate*dt, Math.min(rate*dt, diff));
    current += step;
    let deg = current*180/Math.PI;
    if(deg<0) deg+=360;
    bearing.value = (deg % 360).toFixed(0);
    o_bearing.textContent = bearing.value;
    updateIntentGraphics();
  }

  // Animation loop
  let running = true, last=performance.now()/1000;
  function tick(ms){
    const now=ms/1000, dt=Math.min(0.05, now-last); last=now;

    continuousEmit();

    // advance particles
    const speedScale = 0.35 + 1.6*(+flux.value);
    for(let i=particles.length-1; i>=0; i--){
      const p = particles[i];
      p.t += p.speed * speedScale * (1 + 0.25*Math.sin(now*2 + i));
      if(p.t >= 1){
        if(p.el?.parentNode) p.el.parentNode.removeChild(p.el);
        particles.splice(i,1); continue;
      }
      try{
        const len = p.path.getTotalLength();
        const pt  = p.path.getPointAtLength(p.t * len);
        p.el.setAttribute('cx', pt.x);
        p.el.setAttribute('cy', pt.y);
        p.el.setAttribute('opacity', 0.6 + 0.35*(1 - p.t));
      }catch{}
    }

    autoSteerUpdate(dt);

    const S = computeState();
    couplingVal.textContent  = S.coupling.toFixed(2);
    coherenceVal.textContent = S.coherence.toFixed(2);
    readinessVal.textContent = S.readiness;
    readinessVal.className = 'v ' + (S.cls==='ok'?'ok':S.cls==='warn'?'warn':'bad');

    if(running) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Controls
  $('#toggle').addEventListener('click', (e)=>{
    running = !running;
    e.target.textContent = running ? 'Pause' : 'Resume';
    if(running){ last = performance.now()/1000; requestAnimationFrame(tick); }
  });

  $('#reset').addEventListener('click', ()=>{
    bias.value=0.50; flux.value=0.80; o_bias.textContent='0.50'; o_flux.textContent='0.80';
    bearing.value=0; o_bearing.textContent='0';
    mag.value=0.70; o_mag.textContent='0.70';
    gain.value=0.60; o_gain.textContent='0.60';
    focusSel.value='all'; targetSel.value='INC'; autoSteer.checked=false;

    SFGS.forEach((s,i)=>{
      const a=(i/12)*Math.PI*2; s.x=CENTER.x + CENTER.R*Math.cos(a); s.y=CENTER.y + CENTER.R*Math.sin(a);
      s.g.setAttribute('transform', `translate(${s.x},${s.y})`);
    });
    updateAllEdges(); updateIntentGraphics();
    // reset warp counters
    ALL.forEach(n=> n._count=0);
  });

  $('#burst').addEventListener('click', ()=>{
    ALL.forEach(n=> burstFromNode(n, 1.4));
  });

  // Kickstart visuals
  for(let i=0;i<200;i++){
    const e = edges[(Math.random()*edges.length)|0];
    spawnParticleOnPath(e.path, 0.9);
  }
}
