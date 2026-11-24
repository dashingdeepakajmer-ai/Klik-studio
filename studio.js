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
function trimBox(c) {
  const ctx = c.getContext('2d'), width = c.width, height = c.height;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data.at((y * width + x) * 4 + 3) > 25) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return (x1 <= x0 || y1 <= y0) ? { x: 0, y: 0, w: width, h: height } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function drawBackground(ctx, W, H, sc) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, sc.top); g.addColorStop(1, sc.bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  if (FX.light) {
    const spot = ctx.createRadialGradient(W * 0.35, H * 0.2, W * 0.05, W * 0.5, H * 0.45, Math.max(W, H) * 0.75);
    spot.addColorStop(0, sc.light); spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot; ctx.fillRect(0, 0, W, H);
  }

  if (!FX.arch) return;
  if (sc.type === 'arch') {
    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    ctx.beginPath(); ctx.arc(W * 0.5, H * 0.42, W * 0.34, Math.PI, 0);
    ctx.lineTo(W * 0.84, H * 0.78); ctx.lineTo(W * 0.16, H * 0.78); ctx.closePath(); ctx.fill();
  }
  if (sc.type === 'podium' || sc.type === 'arch') {
    const floorY = H * 0.74;
    ctx.fillStyle = sc.pod; ctx.fillRect(0, floorY, W, H - floorY);
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(0, floorY, W, 4);
  }
  if (sc.type === 'outdoor') {
    const floorY = H * 0.72;
    ctx.fillStyle = sc.pod; ctx.fillRect(0, floorY, W, H - floorY);
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.ellipse(W * (0.15 + i * 0.14), H * 0.18, W * 0.12, H * 0.03, 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function getLayerRect(layer, W, H) {
  const b = layer.box, pct = layer.scale / 100;
  const sc = Math.min((W * pct) / b.w, (H * pct) / b.h);
  const dw = b.w * sc, dh = b.h * sc;
  const dx = (W * layer.nx) - dw / 2, dy = (H * layer.ny) - dh / 2;
  return { dx, dy, dw, dh };
}

function draw(it) {
  const dims = RATIOS[ratioSel.value] || new Array(1200, 1200);
  const W = dims.at(0), H = dims.at(1), c = it.canvas;
  c.width = W; c.height = H;
  const ctx = c.getContext('2d'), sc = it.scenes.at(it.sceneIdx);
  drawBackground(ctx, W, H, sc);

  it.layers.forEach((layer) => {
    const r = getLayerRect(layer, W, H);
    if (FX.floor) {
      ctx.save(); ctx.translate(r.dx + r.dw / 2, r.dy + r.dh - H * 0.01); ctx.scale(1, 0.2);
      const sg = ctx.createRadialGradient(0, 0, 8, 0, 0, r.dw * 0.48);
      sg.addColorStop(0, 'rgba(0,0,0,0.38)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, r.dw * 0.48, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.save();
    if (FX.border3d) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.44)';
      ctx.shadowBlur = Math.round(Math.min(W, H) * 0.024);
      ctx.shadowOffsetX = Math.round(W * 0.014);
      ctx.shadowOffsetY = Math.round(H * 0.018);
    }
    ctx.drawImage(layer.cutoutCanvas, layer.box.x, layer.box.y, layer.box.w, layer.box.h, r.dx, r.dy, r.dw, r.dh);
    ctx.restore();
  });

  if (logoImg) {
    const minSide = Math.min(W, H), lw = minSide * (Number(logoSize.value) / 100);
    const lh = lw * (logoImg.height / logoImg.width), p = minSide * 0.045, pos = logoPos.value;
    ctx.drawImage(logoImg, pos.includes('r') ? W - lw - p : p, pos.includes('b') ? H - lh - p : p, lw, lh);
  }
}

function attachDrag(it) {
  let dragIdx = -1, startX = 0, startY = 0, origNx = 0.5, origNy = 0.5;
  const getPos = (ev) => {
    const rect = it.canvas.getBoundingClientRect();
    const clientX = ev.touches ? ev.touches.item(0).clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches.item(0).clientY : ev.clientY;
    return { x: ((clientX - rect.left) / rect.width) * it.canvas.width, y: ((clientY - rect.top) / rect.height) * it.canvas.height };
  };
  const onDown = (ev) => {
    const p = getPos(ev);
    for (let i = it.layers.length - 1; i >= 0; i--) {
      const r = getLayerRect(it.layers.at(i), it.canvas.width, it.canvas.height);
      if (p.x >= r.dx && p.x <= r.dx + r.dw && p.y >= r.dy && p.y <= r.dy + r.dh) {
        dragIdx = i; it.activeIdx = i; startX = p.x; startY = p.y;
        origNx = it.layers.at(i).nx; origNy = it.layers.at(i).ny;
        it.slider.value = String(it.layers.at(i).scale);
        break;
      }
    }
  };
  const onMove = (ev) => {
    if (dragIdx < 0) return;
    ev.preventDefault();
    const p = getPos(ev), l = it.layers.at(dragIdx);
    l.nx = Math.max(0.08, Math.min(0.92, origNx + (p.x - startX) / it.canvas.width));
    l.ny = Math.max(0.08, Math.min(0.92, origNy + (p.y - startY) / it.canvas.height));
    draw(it);
  };
  const onUp = () => { dragIdx = -1; };
  it.canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  it.canvas.addEventListener('touchstart', onDown, { passive: false });
  it.canvas.addEventListener('touchmove', onMove, { passive: false });
  it.canvas.addEventListener('touchend', onUp);
}
let rtTarget = null, rtMode = 'magic', rtDrawing = false;
const rtModal = document.getElementById('retouchModal'), rtCanvas = document.getElementById('retouchCanvas');
const brushSize = document.getElementById('brushSize');

function setRtMode(m) {
  rtMode = m;
  document.getElementById('modeMagic').className = m === 'magic' ? '' : 'sec';
  document.getElementById('modeErase').className = m === 'erase' ? '' : 'sec';
  document.getElementById('modeRestore').className = m === 'restore' ? '' : 'sec';
}
document.getElementById('modeMagic').onclick = () => setRtMode('magic');
document.getElementById('modeErase').onclick = () => setRtMode('erase');
document.getElementById('modeRestore').onclick = () => setRtMode('restore');

function openRetouch(it) {
  const layer = it.layers.at(it.activeIdx);
  rtTarget = { it, layer };
  rtCanvas.width = layer.cutoutCanvas.width;
  rtCanvas.height = layer.cutoutCanvas.height;
  rtCanvas.getContext('2d').drawImage(layer.cutoutCanvas, 0, 0);
  setRtMode('magic');
  rtModal.style.display = 'flex';
}

function magicFloodErase(sx, sy) {
  const w = rtCanvas.width, h = rtCanvas.height, ctx = rtCanvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, w, h), d = imgData.data;
  const x0 = Math.max(0, Math.min(w - 1, Math.round(sx)));
  const y0 = Math.max(0, Math.min(h - 1, Math.round(sy)));
  const startIdx = y0 * w + x0;
  if (d.at(startIdx * 4 + 3) < 30) return;
  const r0 = d.at(startIdx * 4), g0 = d.at(startIdx * 4 + 1), b0 = d.at(startIdx * 4 + 2);
  const visited = new Uint8Array(w * h);
  const stack = new Array(startIdx);
  visited.fill(1, startIdx, startIdx + 1);
  while (stack.length) {
    const idx = stack.pop();
    d.fill(0, idx * 4 + 3, idx * 4 + 4);
    const x = idx % w, y = (idx - x) / w;
    const nb = new Array(x > 0 ? idx - 1 : -1, x < w - 1 ? idx + 1 : -1, y > 0 ? idx - w : -1, y < h - 1 ? idx + w : -1);
    for (let k = 0; k < 4; k++) {
      const ni = nb.at(k);
      if (ni >= 0 && !visited.at(ni) && d.at(ni * 4 + 3) >= 30) {
        const diff = Math.abs(d.at(ni * 4) - r0) + Math.abs(d.at(ni * 4 + 1) - g0) + Math.abs(d.at(ni * 4 + 2) - b0);
        if (diff < 85) { visited.fill(1, ni, ni + 1); stack.push(ni); }
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function applyBrush(ev) {
  const rect = rtCanvas.getBoundingClientRect();
  const cx = ev.touches ? ev.touches.item(0).clientX : ev.clientX;
  const cy = ev.touches ? ev.touches.item(0).clientY : ev.clientY;
  const scaleX = rtCanvas.width / rect.width, scaleY = rtCanvas.height / rect.height;
  const x = (cx - rect.left) * scaleX, y = (cy - rect.top) * scaleY;
  const r = Number(brushSize.value) * Math.max(scaleX, scaleY) * 0.5;
  const ctx = rtCanvas.getContext('2d');

  if (rtMode === 'magic') {
    magicFloodErase(x, y);
  } else if (rtMode === 'erase') {
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } else if (rtMode === 'restore' && rtTarget) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(rtTarget.layer.rawImg, 0, 0, rtCanvas.width, rtCanvas.height); ctx.restore();
  }
}

rtCanvas.addEventListener('mousedown', (e) => { rtDrawing = true; applyBrush(e); });
rtCanvas.addEventListener('mousemove', (e) => { if (rtDrawing && rtMode !== 'magic') applyBrush(e); });
window.addEventListener('mouseup', () => { rtDrawing = false; });
rtCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); rtDrawing = true; applyBrush(e); }, { passive: false });
rtCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (rtDrawing && rtMode !== 'magic') applyBrush(e); }, { passive: false });
rtCanvas.addEventListener('touchend', () => { rtDrawing = false; });

document.getElementById('rtCancel').onclick = () => { rtModal.style.display = 'none'; rtTarget = null; };
document.getElementById('rtDone').onclick = () => {
  if (rtTarget) {
    const l = rtTarget.layer;
    l.cutoutCanvas.getContext('2d').clearRect(0, 0, l.cutoutCanvas.width, l.cutoutCanvas.height);
    l.cutoutCanvas.getContext('2d').drawImage(rtCanvas, 0, 0);
    l.box = trimBox(l.cutoutCanvas);
    draw(rtTarget.it);
  }
  rtModal.style.display = 'none'; rtTarget = null;
};

async function processFileToLayer(file, nx, ny, scale) {
  if (!removeBgFn) {
    showStatus('Loading Offline AI Engine...');
    const at = String.fromCharCode(64), sl = String.fromCharCode(47);
    const m = await import('https:' + sl + sl + 'esm.sh' + sl + at + 'imgly' + sl + 'background-removal' + at + '1.4.5');
    removeBgFn = m.removeBackground || m.default;
  }
  const rawImg = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
  const maxDim = 1200, ratio = Math.min(1, maxDim / Math.max(rawImg.width, rawImg.height));
  const prep = document.createElement('canvas');
  prep.width = Math.round(rawImg.width * ratio); prep.height = Math.round(rawImg.height * ratio);
  prep.getContext('2d').drawImage(rawImg, 0, 0, prep.width, prep.height);
  const fastBlob = await new Promise((res) => prep.toBlob(res, 'image/jpeg', 0.92));
  const blob = await removeBgFn(fastBlob, { model: 'small' });
  const cutImg = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(blob); });
  const cutoutCanvas = document.createElement('canvas');
  cutoutCanvas.width = cutImg.width; cutoutCanvas.height = cutImg.height;
  cutoutCanvas.getContext('2d').drawImage(cutImg, 0, 0);
  autoCleanCanvas(cutoutCanvas);
  return { rawImg, cutoutCanvas, box: trimBox(cutoutCanvas), nx, ny, scale };
}


document.getElementById('batchInput').onchange = async (e) => {
  const files = Array.from(e.target.files || []); if (!files.length) return;
  document.getElementById('pickBtn').disabled = true;
  await keepAlive(true);
  try {
    for (let i = 0; i < files.length; i++) {
      const f = files.at(i); showStatus('Processing ' + (i + 1) + ' of ' + files.length + ' (Background Active)...');
      const layer = await processFileToLayer(f, 0.5, 0.52, 72);
      const card = document.createElement('div'); card.className = 'item';
      const canvas = document.createElement('canvas');
      const it = { name: f.name.replace(/\.[^/.]+$/, '') + '_klik.png', layers: new Array(layer), activeIdx: 0, scenes: buildMatchedScenes(layer.cutoutCanvas), sceneIdx: 0, canvas };
      items.push(it);

      const bar = document.createElement('div'); bar.className = 'bar';
      const dots = document.createElement('div'); dots.className = 'dots';
      it.scenes.forEach((s, idx) => { const d = document.createElement('div'); d.className = 'dot'; d.style.background = s.dot; d.onclick = () => { it.sceneIdx = idx; draw(it); }; dots.appendChild(d); });

      const slider = document.createElement('input'); slider.type = 'range'; slider.min = '30'; slider.max = '95'; slider.value = '72'; slider.style.width = '70px';
      slider.oninput = () => { it.layers.at(it.activeIdx).scale = Number(slider.value); draw(it); };
      it.slider = slider;

      const rtBtn = document.createElement('button'); rtBtn.className = 'sec'; rtBtn.textContent = 'Retouch';
      rtBtn.onclick = () => openRetouch(it);

      const addVarBtn = document.createElement('button'); addVarBtn.className = 'sec'; addVarBtn.textContent = '+ Color';
      addVarBtn.onclick = () => { activeCardForVariant = it; document.getElementById('variantInput').click(); };

      const btn = document.createElement('button'); btn.className = 'sec'; btn.textContent = 'Save';
      btn.onclick = () => { const a = document.createElement('a'); a.download = it.name; a.href = canvas.toDataURL('image/png'); a.click(); };

      draw(it); attachDrag(it);
      bar.append(dots, slider, rtBtn, addVarBtn, btn);
      card.append(canvas, bar); gallery.prepend(card);
    }
    if (items.length) { document.getElementById('actionsBar').style.display = 'block'; showStatus('Done! ' + items.length + ' photos ready.'); }
  } catch (err) { showStatus('Error: ' + err.message); }
  await keepAlive(false);
  document.getElementById('pickBtn').disabled = false; e.target.value = '';
};

document.getElementById('variantInput').onchange = async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length || !activeCardForVariant) return;
  const it = activeCardForVariant;
  await keepAlive(true);
  try {
    for (let i = 0; i < files.length; i++) {
      showStatus('Adding color variant ' + (i + 1) + '...');
      const count = it.layers.length;
      const nx = Math.min(0.8, 0.35 + count * 0.18), ny = Math.min(0.75, 0.48 + count * 0.06);
      if (count === 1) { it.layers.at(0).nx = 0.34; it.layers.at(0).scale = 54; }
      const newLayer = await processFileToLayer(files.at(i), nx, ny, 54);
      it.layers.push(newLayer);
      it.activeIdx = it.layers.length - 1;
      it.slider.value = '54';
      draw(it);
    }
    showStatus('Variant added! Drag each shoe to arrange.');
  } catch (err) { showStatus('Error: ' + err.message); }
  await keepAlive(false);
  e.target.value = '';
};

document.getElementById('downloadAllBtn').onclick = () => items.forEach((it, idx) => setTimeout(() => {
  const a = document.createElement('a'); a.download = it.name; a.href = it.canvas.toDataURL('image/png'); a.click();
}, idx * 350));

