const RATIOS = {
  '1:1': new Array(1200, 1200),
  '4:5': new Array(1080, 1350),
  '9:16': new Array(1080, 1920),
  '16:9': new Array(1920, 1080)
};

const FX = { proAI: true, floor: true, border3d: true, light: true, arch: true };
let logoImg = null, removeBgFn = null, activeCardForVariant = null, wakeLock = null;
const items = [], statusBox = document.getElementById('statusBox'), gallery = document.getElementById('gallery');
const logoThumb = document.getElementById('logoThumb'), logoPos = document.getElementById('logoPos'), logoSize = document.getElementById('logoSize');
const ratioSel = document.getElementById('ratioSel');

function showStatus(t) { statusBox.style.display = 'block'; statusBox.textContent = t; }

async function keepAlive(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}

document.getElementById('tabAI').onclick = () => {
  FX.proAI = !FX.proAI;
  const el = document.getElementById('tabAI');
  el.className = FX.proAI ? 'chip on' : 'chip';
  el.textContent = FX.proAI ? 'AI: Pro (RMBG-1.4)' : 'AI: Fast (MODNet)';
};

function bindTab(id, key, label, redraw) {
  const el = document.getElementById(id);
  el.onclick = () => {
    FX[key] = !FX[key];
    el.className = FX[key] ? 'chip on' : 'chip';
    el.textContent = label + ': ' + (FX[key] ? 'ON' : 'OFF');
    if (redraw) items.forEach(draw);
  };
}
bindTab('tabFloor', 'floor', 'Floor Shadow', true);
bindTab('tab3D', 'border3d', '3D Border', true);
bindTab('tabLight', 'light', 'Lighting', true);
bindTab('tabArch', 'arch', 'Scene Design', true);

function loadLogo() {
  const d = localStorage.getItem('klik_logo');
  if (localStorage.getItem('klik_pos')) logoPos.value = localStorage.getItem('klik_pos');
  if (localStorage.getItem('klik_size')) logoSize.value = localStorage.getItem('klik_size');
  if (d) { const i = new Image(); i.onload = () => { logoImg = i; logoThumb.src = d; }; i.src = d; }
}
loadLogo();

document.getElementById('logoBtn').onclick = () => document.getElementById('logoInput').click();
document.getElementById('pickBtn').onclick = () => document.getElementById('batchInput').click();
document.getElementById('logoInput').onchange = (e) => {
  const f = e.target.files.item(0); if (!f) return;
  const r = new FileReader(); r.onload = () => { localStorage.setItem('klik_logo', r.result); loadLogo(); setTimeout(() => items.forEach(draw), 100); }; r.readAsDataURL(f);
};
logoPos.onchange = () => { localStorage.setItem('klik_pos', logoPos.value); items.forEach(draw); };
logoSize.oninput = () => { localStorage.setItem('klik_size', logoSize.value); items.forEach(draw); };
ratioSel.onchange = () => items.forEach(draw);
￼Enter
