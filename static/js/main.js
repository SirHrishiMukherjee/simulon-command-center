// Tab switching + example calls
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    const tabId = button.getAttribute('data-tab');

    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    button.classList.add('active');
    const el = document.getElementById(tabId);
    if (el) el.classList.add('active');
    flashYear();
  });
});

// Default: activate the first tab
const firstTabBtn = document.querySelector('.tab-button');
if (firstTabBtn) firstTabBtn.click();

// Theme toggle
document.getElementById('theme-toggle')?.addEventListener('click', () => {
  document.body.classList.toggle('light');
});

// SimuLang run
document.getElementById('run-simulang')?.addEventListener('click', async () => {
  const code = document.getElementById('simulang-input').value;
  setStatus('simulang-status', 'Running...');
  try {
    const res = await fetch('/api/simulang/run', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    document.getElementById('simulang-output').textContent = data.output || JSON.stringify(data, null, 2);
    setStatus('simulang-status', 'Done.');
    flashYear();
  } catch (e) {
    setStatus('simulang-status', 'Error.');
  }
});

// Pareto analyze
document.getElementById('analyze-pareto')?.addEventListener('click', async () => {
  let arr = [];
  try {
    arr = JSON.parse(document.getElementById('pareto-input').value || '[]');
  } catch (e) {}
  setStatus('pareto-status', 'Analyzing...');
  try {
    const res = await fetch('/api/pareto/analyze', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ data: arr })
    });
    const data = await res.json();
    document.getElementById('pareto-output').textContent = JSON.stringify(data, null, 2);
    setStatus('pareto-status', 'Done.');
    flashYear();
  } catch (e) {
    setStatus('pareto-status', 'Error.');
  }
});

// Contradiction compute
document.getElementById('compute-contradiction')?.addEventListener('click', async () => {
  const c1 = (document.getElementById('c1') || {}).value || '';
  const c2 = (document.getElementById('c2') || {}).value || '';
  try {
    const res = await fetch('/api/contradiction/compute', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ c1, c2 })
    });
    const data = await res.json();
    document.getElementById('contradiction-output').textContent = JSON.stringify(data, null, 2);
    flashYear();
  } catch (e) {}
});

// Warp initiate
document.getElementById('initiate-warp')?.addEventListener('click', async () => {
  let payload = {};
  try {
    payload = JSON.parse(document.getElementById('warp-param').value || '{}');
  } catch(e) {}
  setStatus('warp-status', 'Engaging...');
  try {
    const res = await fetch('/api/warp/initiate', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    document.getElementById('warp-output').textContent = JSON.stringify(data, null, 2);
    setStatus('warp-status', 'Engaged.');
    flashYear();
  } catch (e) {
    setStatus('warp-status', 'Error.');
  }
});

// Contradiction compute
document.getElementById('compute-contradiction')?.addEventListener('click', async () => {
  const c1 = (document.getElementById('c1') || {}).value || '';
  const c2 = (document.getElementById('c2') || {}).value || '';
  const out = document.getElementById('contradiction-output');
  if (out) out.textContent = 'Processing...';

  try {
    const res = await fetch('/api/contradiction/compute', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ c1, c2 })
    });
    const data = await res.json();
    if (out) out.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    if (out) out.textContent = 'Error: ' + e;
  }
});

// Warp: load and boot once the tab is opened
let warpBooted = false;
async function bootWarpIfNeeded(tabId) {
  if (tabId !== 'Warp-Drive' || warpBooted) return;
  const { initWarpDrive } = await import('/static/js/warp.js');
  initWarpDrive();
  warpBooted = true;
}

// Call this when switching tabs (adapt to your existing code)
document.querySelectorAll('.tab-button').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;   // e.g., "Warp-Drive"
    bootWarpIfNeeded(tab);
  });
});

// If Warp is the default active tab on first load:
if (document.getElementById('Warp-Drive')?.classList.contains('active')) {
  bootWarpIfNeeded('Warp-Drive');
}

// Celestial: lazy boot when its tab is opened
let celestialBooted = false;
async function bootCelestialIfNeeded(tabId) {
  if (tabId !== 'Celestial' || celestialBooted) return;
  const { initCelestial } = await import('/static/js/celestial.js');
  initCelestial();
  celestialBooted = true;
}

// Hook into your existing tab switch logic:
document.querySelectorAll('.tab-button').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;         // e.g. "Celestial"
    bootCelestialIfNeeded(tab);
  });
});

// If Celestial is active on first load:
if (document.getElementById('Celestial')?.classList.contains('active')) {
  bootCelestialIfNeeded('Celestial');
}

function setStatus(id, text){ const el = document.getElementById(id); if (el) el.textContent = text; }

// Footer year flash mechanic
let baseYear = 2025;
function flashYear(){
  const y = document.getElementById('copyright-year');
  if(!y) return;
  // Increment based on total active tabs count as a playful cue
  const activeTabs = document.querySelectorAll('.tab-button.active').length;
  const newYear = baseYear + activeTabs;
  y.textContent = String(newYear);
  y.animate([{opacity:0.3}, {opacity:1}], {duration:250, fill:'forwards'});
}
