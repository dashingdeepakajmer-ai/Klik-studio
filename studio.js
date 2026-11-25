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
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return new Array(Math.round(h), Math.round(s * 100), Math.round(l * 100));
}

function buildMatchedScenes(img) {
  const c = document.createElement('canvas'); c.width = 60; c.height = 60;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, 60, 60);
  const d = x.getImageData(0, 0, 60, 60).data;
  let rSum = 0, gSum = 0, bSum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d.at(i + 3) > 180) { rSum += d.at(i); gSum += d.at(i + 1); bSum += d.at(i + 2); n++; }
  }
  const hsl = rgbToHsl(n ? rSum / n : 128, n ? gSum / n : 128, n ? bSum / n : 128);
  const hue = hsl.at(0), sat = hsl.at(1), lum = hsl.at(2);
  const comp = (hue + 180) % 360, ana = (hue + 35) % 360;

  if (lum > 68) {
    return new Array(
      { type: 'pedestal', ny: 0.52, top: '#3c4354', bot: '#1b1f28', pod: '#2c3240', rim: '#525b70', light: 'rgba(255,255,255,0.22)' },
      { type: 'arch', ny: 0.50, top: '#4a5d58', bot: '#232e2b', pod: '#34423e', rim: '#627872', light: 'rgba(255,255,255,0.24)' },
      { type: 'outdoor', ny: 0.50, top: '#786c5c', bot: '#3e372e', pod: '#574e42', rim: '#8c7e6c', light: 'rgba(255,242,215,0.28)' },
      { type: 'marble', ny: 0.51, top: '#4b4659', bot: '#24212c', pod: '#363242', rim: '#665f78', light: 'rgba(255,255,255,0.22)' },
      { type: 'studio', ny: 0.52, top: '#d8dde6', bot: '#b4bcc9', pod: '#9aa4b5', rim: '#eef2f7', light: 'rgba(255,255,255,0.55)' }
    );
  }
  if (lum < 32 || sat < 18) {
    return new Array(
      { type: 'pedestal', ny: 0.52, top: '#f7f2e8', bot: '#dfd5c3', pod: '#cfc2ab', rim: '#ffffff', light: 'rgba(255,255,255,0.75)' },
      { type: 'arch', ny: 0.50, top: '#eef2f6', bot: '#cfd7e3', pod: '#bcc7d6', rim: '#ffffff', light: 'rgba(255,255,255,0.75)' },
      { type: 'outdoor', ny: 0.50, top: '#f2ece1', bot: '#cfc6b6', pod: '#bfb5a2', rim: '#faf6ee', light: 'rgba(255,245,220,0.65)' },
      { type: 'marble', ny: 0.51, top: '#f5f6f8', bot: '#d7dce3', pod: '#c5ccd6', rim: '#ffffff', light: 'rgba(255,255,255,0.8)' },
      { type: 'studio', ny: 0.52, top: '#f5e6d3', bot: '#d9be9c', pod: '#c7a780', rim: '#fcf3e8', light: 'rgba(255,240,215,0.65)' }
    );
  }
  return new Array(
    { type: 'pedestal', ny: 0.52, top: 'hsl(' + comp + ',30%,91%)', bot: 'hsl(' + comp + ',24%,76%)', pod: 'hsl(' + comp + ',22%,68%)', rim: 'hsl(' + comp + ',35%,97%)', light: 'rgba(255,255,255,0.7)' },
    { type: 'arch', ny: 0.50, top: 'hsl(' + hue + ',26%,92%)', bot: 'hsl(' + hue + ',20%,78%)', pod: 'hsl(' + hue + ',18%,70%)', rim: 'hsl(' + hue + ',30%,98%)', light: 'rgba(255,255,255,0.75)' },
    { type: 'outdoor', ny: 0.50, top: 'hsl(' + ana + ',28%,89%)', bot: 'hsl(' + ana + ',22%,74%)', pod: 'hsl(' + ana + ',20%,66%)', rim: 'hsl(' + ana + ',32%,96%)', light: 'rgba(255,245,220,0.65)' },
    { type: 'marble', ny: 0.51, top: '#f4f6f9', bot: '#d5dbe3', pod: '#c3cbd6', rim: '#ffffff', light: 'rgba(255,255,255,0.8)' },
    { type: 'studio', ny: 0.52, top: 'hsl(' + comp + ',26%,32%)', bot: 'hsl(' + comp + ',28%,17%)', pod: 'hsl(' + comp + ',25%,23%)', rim: 'hsl(' + comp + ',28%,42%)', light: 'rgba(255,255,255,0.22)' }
  );
}

