const RATIOS = {
  '1:1': new Array(1200, 1200),
  '4:5': new Array(1080, 1350),
  '9:16': new Array(1080, 1920),
  '16:9': new Array(1920, 1080)
};

const FX = { floor: true, border3d: true, light: true, arch: true, clean: true };
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

function bindTab(id, key, label) {
  const el = document.getElementById(id);
  el.onclick = () => {
    FX[key] = !FX[key];
    el.className = FX[key] ? 'chip on' : 'chip';
    el.textContent = label + ': ' + (FX[key] ? 'ON' : 'OFF');
    if (key !== 'clean') items.forEach(draw);
  };
}
bindTab('tabFloor', 'floor', 'Floor Shadow');
bindTab('tab3D', 'border3d', '3D Border');
bindTab('tabLight', 'light', 'Lighting');
bindTab('tabArch', 'arch', 'Scene Design');
bindTab('tabClean', 'clean', 'Auto Clean');

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
      { type: 'podium', dot: '#2d3340', top: '#3c4354', bot: '#1e222b', pod: '#282d38', light: 'rgba(255,255,255,0.16)' },
      { type: 'arch', dot: '#3b4a46', top: '#4a5d58', bot: '#26312e', pod: '#32403c', light: 'rgba(255,255,255,0.18)' },
      { type: 'outdoor', dot: '#5c5346', top: '#736858', bot: '#423b32', pod: '#52493e', light: 'rgba(255,245,225,0.22)' },
      { type: 'podium', dot: '#3a3548', top: '#4b445e', bot: '#262230', pod: '#342f42', light: 'rgba(255,255,255,0.16)' },
      { type: 'clean', dot: '#d4d8e0', top: '#e2e6ed', bot: '#c5cbd6', pod: '#b8bfcc', light: 'rgba(255,255,255,0.5)' }
    );
  }
  if (lum < 32 || sat < 18) {
    return new Array(
      { type: 'arch', dot: '#f3ede2', top: '#faf6ef', bot: '#e6decb', pod: '#dfd4be', light: 'rgba(255,255,255,0.65)' },
      { type: 'outdoor', dot: '#e5dfd3', top: '#f0ece3', bot: '#d4cdc0', pod: '#c7bfb0', light: 'rgba(255,248,230,0.55)' },
      { type: 'podium', dot: '#e3e8ef', top: '#f2f5fa', bot: '#d4dce8', pod: '#c6d0df', light: 'rgba(255,255,255,0.65)' },
      { type: 'outdoor', dot: '#ebd9c3', top: '#f6e8d7', bot: '#dec5a6', pod: '#d1b592', light: 'rgba(255,240,215,0.55)' },
      { type: 'clean', dot: '#dce8e3', top: '#ebf3f0', bot: '#cde0d8', pod: '#bdd4cb', light: 'rgba(255,255,255,0.55)' }
    );
  }
  return new Array(
    { type: 'arch', dot: 'hsl(' + comp + ',28%,86%)', top: 'hsl(' + comp + ',30%,92%)', bot: 'hsl(' + comp + ',24%,80%)', pod: 'hsl(' + comp + ',22%,74%)', light: 'rgba(255,255,255,0.6)' },
    { type: 'podium', dot: 'hsl(' + hue + ',22%,88%)', top: 'hsl(' + hue + ',25%,94%)', bot: 'hsl(' + hue + ',20%,83%)', pod: 'hsl(' + hue + ',18%,77%)', light: 'rgba(255,255,255,0.65)' },
    { type: 'outdoor', dot: 'hsl(' + ana + ',25%,84%)', top: 'hsl(' + ana + ',28%,90%)', bot: 'hsl(' + ana + ',22%,78%)', pod: 'hsl(' + ana + ',20%,72%)', light: 'rgba(255,248,230,0.55)' },
    { type: 'podium', dot: 'hsl(' + comp + ',24%,26%)', top: 'hsl(' + comp + ',26%,32%)', bot: 'hsl(' + comp + ',28%,18%)', pod: 'hsl(' + comp + ',25%,22%)', light: 'rgba(255,255,255,0.18)' },
    { type: 'clean', dot: '#eef0f4', top: '#f7f8fa', bot: '#dfe3ea', pod: '#d2d7e0', light: 'rgba(255,255,255,0.65)' }
  );
}

function autoCleanCanvas(c) {
  if (!FX.clean) return;
  const w = c.width, h = c.height, ctx = c.getContext('2d');
  const imgData = ctx.getImageData(0, 0, w, h), d = imgData.data;
  const visited = new Uint8Array(w * h);
  let bestPixels = null;
  for (let i = 0; i < w * h; i++) {
    if (visited.at(i) || d.at(i * 4 + 3) < 40) continue;
    const comp = new Array();
    const stack = new Array(i);
    visited.fill(1, i, i + 1);
    while (stack.length) {
      const idx = stack.pop();
      comp.push(idx);
      const x = idx % w, y = (idx - x) / w;
      const nb = new Array(x > 0 ? idx - 1 : -1, x < w - 1 ? idx + 1 : -1, y > 0 ? idx - w : -1, y < h - 1 ? idx + w : -1);
      for (let k = 0; k < 4; k++) {
        const ni = nb.at(k);
        if (ni >= 0 && !visited.at(ni) && d.at(ni * 4 + 3) >= 40) { visited.fill(1, ni, ni + 1); stack.push(ni); }
      }
    }
    if (!bestPixels || comp.length > bestPixels.length) bestPixels = comp;
  }
  if (!bestPixels) return;
  const keep = new Uint8Array(w * h);
  for (let i = 0; i < bestPixels.length; i++) keep.fill(1, bestPixels.at(i), bestPixels.at(i) + 1);
  for (let i = 0; i < w * h; i++) if (!keep.at(i)) d.fill(0, i * 4 + 3, i * 4 + 4);
  ctx.putImageData(imgData, 0, 0);
}

