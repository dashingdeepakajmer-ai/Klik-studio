const RATIOS = {
  '1:1': new Array(1200, 1200),
  '4:5': new Array(1080, 1350),
  '9:16': new Array(1080, 1920),
  '16:9': new Array(1920, 1080)
};

const FX = { proAI: true, floor: true, border3d: true, light: true, arch: true };
let logoImg = null, removeBgFn = null, gradioApp = null, activeCardForVariant = null, wakeLock = null, stopBatch = false, timerId = null;
const items = [], statusBox = document.getElementById('statusBox'), gallery = document.getElementById('gallery');
const logoThumb = document.getElementById('logoThumb'), logoPos = document.getElementById('logoPos'), logoSize = document.getElementById('logoSize');
const ratioSel = document.getElementById('ratioSel'), hfInput = document.getElementById('hfTokenInput');

hfInput.value = localStorage.getItem('klik_hf_token') || '';
document.getElementById('saveTokenBtn').onclick = () => {
  localStorage.setItem('klik_hf_token', hfInput.value.trim());
  gradioApp = null;
  showStatus('Free HF Cloud Key Saved!');
};

window.addEventListener('pageshow', (e) => { if (e.persisted && !items.length) statusBox.style.display = 'none'; });

function showStatus(t, live) {
  if (timerId) { clearInterval(timerId); timerId = null; }
  statusBox.style.display = 'block';
  if (!live) { statusBox.textContent = t; return; }
  let sec = 0;
  const render = () => {
    statusBox.innerHTML = t + ' <b>(' + sec + 's)</b> <button id="stopNowBtn" style="margin-left:8px;padding:4px 10px;background:#ef4444;font-size:12px;">Stop</button>';
    const b = document.getElementById('stopNowBtn');
    if (b) b.onclick = () => { stopBatch = true; showStatus('Stopping after current photo...'); };
  };
  render();
  timerId = setInterval(() => { sec++; render(); }, 1000);
}

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
  el.textContent = FX.proAI ? 'AI: Cloud BiRefNet (99%)' : 'AI: Offline Backup (MODNet)';
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
    const spot = ctx.createRadialGradient(W * 0.32, H * 0.18, W * 0.04, W * 0.5, H * 0.45, Math.max(W, H) * 0.8);
    spot.addColorStop(0, sc.light); spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot; ctx.fillRect(0, 0, W, H);
  }
  if (!FX.arch) return;
  if (sc.type === 'pedestal') {
    ctx.fillStyle = sc.pod; ctx.fillRect(0, H * 0.75, W, H * 0.25);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.82, W * 0.36, H * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = sc.pod; ctx.fillRect(W * 0.18, H * 0.72, W * 0.64, H * 0.09);
    ctx.fillStyle = sc.rim; ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.72, W * 0.32, H * 0.065, 0, 0, Math.PI * 2); ctx.fill();
  } else if (sc.type === 'arch') {
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.arc(W * 0.52, H * 0.43, W * 0.33, Math.PI, 0); ctx.lineTo(W * 0.85, H * 0.76); ctx.lineTo(W * 0.19, H * 0.76); ctx.closePath(); ctx.fill();
    ctx.fillStyle = sc.rim; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.43, W * 0.32, Math.PI, 0); ctx.lineTo(W * 0.82, H * 0.76); ctx.lineTo(W * 0.18, H * 0.76); ctx.closePath(); ctx.fill();
    ctx.fillStyle = sc.pod; ctx.fillRect(0, H * 0.75, W, H * 0.25);
  } else if (sc.type === 'outdoor') {
    ctx.fillStyle = sc.pod; ctx.fillRect(0, H * 0.72, W, H * 0.28);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, H * 0.84); ctx.lineTo(W, H * 0.84); ctx.moveTo(W * 0.32, H * 0.72); ctx.lineTo(W * 0.18, H); ctx.moveTo(W * 0.68, H * 0.72); ctx.lineTo(W * 0.82, H); ctx.stroke();
  } else if (sc.type === 'marble') {
    ctx.fillStyle = sc.pod; ctx.fillRect(0, H * 0.73, W, H * 0.27);
    ctx.fillStyle = sc.rim; ctx.fillRect(0, H * 0.73, W, 5);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.55, 0); ctx.lineTo(W * 0.35, H * 0.76); ctx.lineTo(0, H * 0.76); ctx.closePath(); ctx.fill();
    ctx.fillStyle = sc.pod; ctx.fillRect(0, H * 0.76, W, H * 0.24);
  }
}
function getLayerRect(layer, W, H) {
  const b = layer.box, pct = layer.scale / 100;
  const sc = Math.min((W * pct) / b.w, (H * pct) / b.h);
  const dw = b.w * sc, dh = b.h * sc;
  const dx = (W * layer.nx) - dw / 2, dy = (H * layer.ny) - dh / 2;
  return { dx, dy, dw, dh };
}

function cloneCanvas(src) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0); return c;
}

function pushUndo(it) {
  if (!it.history) it.history = new Array();
  it.history.push({
    sceneIdx: it.sceneIdx, activeIdx: it.activeIdx,
    layers: it.layers.map(l => ({ nx: l.nx, ny: l.ny, scale: l.scale, tilt: l.tilt || 0, cut: cloneCanvas(l.cutoutCanvas), box: Object.assign({}, l.box) }))
  });
  if (it.history.length > 12) it.history.shift();
}

function undoCard(it) {
  if (!it.history || !it.history.length) return;
  const prev = it.history.pop();
  it.sceneIdx = prev.sceneIdx;
  it.activeIdx = Math.min(prev.activeIdx, it.layers.length - 1);
  prev.layers.forEach((st, idx) => {
    const l = it.layers.at(idx);
    if (l) {
      l.nx = st.nx; l.ny = st.ny; l.scale = st.scale; l.tilt = st.tilt || 0;
      l.cutoutCanvas = st.cut; l.box = st.box;
    }
  });
  const active = it.layers.at(it.activeIdx);
  if (active && it.slider) it.slider.value = String(active.scale);
  if (active && it.tiltSlider) it.tiltSlider.value = String(active.tilt || 0);
  draw(it);
}
function draw(it, hideBox) {
  const dims = RATIOS[ratioSel.value] || new Array(1200, 1200);
  const W = dims.at(0), H = dims.at(1), c = it.canvas;
  c.width = W; c.height = H;
  const ctx = c.getContext('2d'), sc = it.scenes.at(it.sceneIdx);
  drawBackground(ctx, W, H, sc);

  it.layers.forEach((layer, idx) => {
    const r = getLayerRect(layer, W, H);
    const rad = ((layer.tilt || 0) * Math.PI) / 180;
    if (FX.floor) {
      ctx.save(); ctx.translate(r.dx + r.dw / 2, r.dy + r.dh - H * 0.01); ctx.scale(1, 0.2);
      const sg = ctx.createRadialGradient(0, 0, 8, 0, 0, r.dw * 0.48);
      sg.addColorStop(0, 'rgba(0,0,0,0.38)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, r.dw * 0.48, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.save();
    ctx.translate(r.dx + r.dw / 2, r.dy + r.dh / 2);
    ctx.rotate(rad);
    if (FX.border3d) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.44)';
      ctx.shadowBlur = Math.round(Math.min(W, H) * 0.024);
      ctx.shadowOffsetX = Math.round(W * 0.014);
      ctx.shadowOffsetY = Math.round(H * 0.018);
    }
    ctx.drawImage(layer.cutoutCanvas, layer.box.x, layer.box.y, layer.box.w, layer.box.h, -r.dw / 2, -r.dh / 2, r.dw, r.dh);
    if (!hideBox && it.selected && idx === it.activeIdx) {
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#7557ff'; ctx.lineWidth = 4; ctx.setLineDash(new Array(10, 6));
      ctx.strokeRect(-r.dw / 2 - 4, -r.dh / 2 - 4, r.dw + 8, r.dh + 8);
    }
    ctx.restore();
  });

  if (logoImg) {
    const minSide = Math.min(W, H), lw = minSide * (Number(logoSize.value) / 100);
    const lh = lw * (logoImg.height / logoImg.width), p = minSide * 0.045, pos = logoPos.value;
    ctx.drawImage(logoImg, pos.includes('r') ? W - lw - p : p, pos.includes('b') ? H - lh - p : p, lw, lh);
  }
}

function exportCleanPng(it) {
  draw(it, true);
  const url = it.canvas.toDataURL('image/jpeg', 0.95);
  draw(it, false);
  const a = document.createElement('a'); a.download = it.name.replace(/\.png$/i, '.jpg'); a.href = url; a.click();
}

function attachGestures(it) {
  let dragIdx = -1, startX = 0, startY = 0, origNx = 0.5, origNy = 0.5;
  let pinchDist = 0, pinchAngle = 0, origScale = 70, origTilt = 0;

  const getPt = (t) => {
    const rect = it.canvas.getBoundingClientRect();
    return { x: ((t.clientX - rect.left) / rect.width) * it.canvas.width, y: ((t.clientY - rect.top) / rect.height) * it.canvas.height };
  };

  it.canvas.addEventListener('touchstart', (ev) => {
    if (ev.touches.length === 2) {
      ev.preventDefault();
      dragIdx = -1;
      pushUndo(it);
      const p1 = getPt(ev.touches.item(0)), p2 = getPt(ev.touches.item(1));
      pinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      pinchAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const l = it.layers.at(it.activeIdx);
      origScale = l.scale; origTilt = l.tilt || 0; it.selected = true; draw(it);
      return;
    }
    const p = getPt(ev.touches.item(0));
    let hit = false;
    for (let i = it.layers.length - 1; i >= 0; i--) {
      const r = getLayerRect(it.layers.at(i), it.canvas.width, it.canvas.height);
      const pad = 60;
      if (p.x >= r.dx - pad && p.x <= r.dx + r.dw + pad && p.y >= r.dy - pad && p.y <= r.dy + r.dh + pad) {
        pushUndo(it);
        dragIdx = i; it.activeIdx = i; it.selected = true; hit = true;
        startX = p.x; startY = p.y;
        origNx = it.layers.at(i).nx; origNy = it.layers.at(i).ny;
        it.slider.value = String(it.layers.at(i).scale);
        it.tiltSlider.value = String(it.layers.at(i).tilt || 0);
        break;
      }
    }
    if (!hit) it.selected = false;
    draw(it);
  }, { passive: false });

  it.canvas.addEventListener('touchmove', (ev) => {
    if (ev.touches.length === 2 && pinchDist > 0) {
      ev.preventDefault();
      const p1 = getPt(ev.touches.item(0)), p2 = getPt(ev.touches.item(1));
      const newDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const newAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const l = it.layers.at(it.activeIdx);
      l.scale = Math.max(25, Math.min(98, Math.round(origScale * (newDist / pinchDist))));
      l.tilt = Math.max(-45, Math.min(45, Math.round(origTilt + ((newAngle - pinchAngle) * 180) / Math.PI)));
      it.slider.value = String(l.scale);
      it.tiltSlider.value = String(l.tilt);
      draw(it);
      return;
    }
    if (dragIdx < 0) return;
    ev.preventDefault();
    const p = getPt(ev.touches.item(0)), l = it.layers.at(dragIdx);
    l.nx = Math.max(0.08, Math.min(0.92, origNx + (p.x - startX) / it.canvas.width));
    l.ny = Math.max(0.08, Math.min(0.92, origNy + (p.y - startY) / it.canvas.height));
    draw(it);
  }, { passive: false });

  it.canvas.addEventListener('touchend', () => { dragIdx = -1; pinchDist = 0; });
}
let rtTarget = null, rtMode = 'magic', rtDrawing = false, rtBackup = null;
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
document.getElementById('rtUndo').onclick = () => { if (rtBackup) { rtCanvas.getContext('2d').putImageData(rtBackup, 0, 0); rtBackup = null; } };

function openRetouch(it) {
  const layer = it.layers.at(it.activeIdx);
  rtTarget = { it, layer };
  rtCanvas.width = layer.cutoutCanvas.width;
  rtCanvas.height = layer.cutoutCanvas.height;
  rtCanvas.getContext('2d').drawImage(layer.cutoutCanvas, 0, 0);
  rtBackup = null; setRtMode('magic'); rtModal.style.display = 'flex';
}

function smartAutoRemoveStroke(cx, cy, radius) {
  const w = rtCanvas.width, h = rtCanvas.height, ctx = rtCanvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, w, h), d = imgData.data;
  const visited = new Uint8Array(w * h), stack = new Array();
  let rSum = 0, gSum = 0, bSum = 0, n = 0;
  const rInt = Math.max(2, Math.round(radius));
  for (let dy = -rInt; dy <= rInt; dy++) for (let dx = -rInt; dx <= rInt; dx++) {
    if (dx * dx + dy * dy > rInt * rInt) continue;
    const px = Math.round(cx + dx), py = Math.round(cy + dy);
    if (px < 0 || px >= w || py < 0 || py >= h) continue;
    const idx = py * w + px;
    if (d.at(idx * 4 + 3) >= 30 && !visited.at(idx)) {
      visited.fill(1, idx, idx + 1); stack.push(idx);
      rSum += d.at(idx * 4); gSum += d.at(idx * 4 + 1); bSum += d.at(idx * 4 + 2); n++;
    }
  }
  if (!n) return;
  const r0 = rSum / n, g0 = gSum / n, b0 = bSum / n;
  while (stack.length) {
    const idx = stack.pop(); d.fill(0, idx * 4 + 3, idx * 4 + 4);
    const x = idx % w, y = (idx - x) / w;
    const nb = new Array(x > 0 ? idx - 1 : -1, x < w - 1 ? idx + 1 : -1, y > 0 ? idx - w : -1, y < h - 1 ? idx + w : -1);
    for (let k = 0; k < 4; k++) {
      const ni = nb.at(k);
      if (ni >= 0 && !visited.at(ni) && d.at(ni * 4 + 3) >= 30) {
        const diff = Math.abs(d.at(ni * 4) - r0) + Math.abs(d.at(ni * 4 + 1) - g0) + Math.abs(d.at(ni * 4 + 2) - b0);
        if (diff < 78) { visited.fill(1, ni, ni + 1); stack.push(ni); }
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
  if (rtMode === 'magic') smartAutoRemoveStroke(x, y, r);
  else if (rtMode === 'erase') { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  else if (rtMode === 'restore' && rtTarget) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(rtTarget.layer.rawCanvas, 0, 0, rtCanvas.width, rtCanvas.height); ctx.restore(); }
}

function startRtDraw(e) { rtBackup = rtCanvas.getContext('2d').getImageData(0, 0, rtCanvas.width, rtCanvas.height); rtDrawing = true; applyBrush(e); }
rtCanvas.addEventListener('mousedown', startRtDraw);
rtCanvas.addEventListener('mousemove', (e) => { if (rtDrawing) applyBrush(e); });
window.addEventListener('mouseup', () => { rtDrawing = false; });
rtCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); startRtDraw(e); }, { passive: false });
rtCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (rtDrawing) applyBrush(e); }, { passive: false });
rtCanvas.addEventListener('touchend', () => { rtDrawing = false; });

document.getElementById('rtCancel').onclick = () => { rtModal.style.display = 'none'; rtTarget = null; };
document.getElementById('rtDone').onclick = () => {
  if (rtTarget) {
    pushUndo(rtTarget.it);
    const l = rtTarget.layer;
    l.cutoutCanvas.getContext('2d').clearRect(0, 0, l.cutoutCanvas.width, l.cutoutCanvas.height);
    l.cutoutCanvas.getContext('2d').drawImage(rtCanvas, 0, 0);
    l.box = trimBox(l.cutoutCanvas); draw(rtTarget.it);
  }
  rtModal.style.display = 'none'; rtTarget = null;
};
 async function processFileToLayer(file, nx, ny, scale) {
  showStatus('Preparing Photo...');
  const rawImg = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
  const maxDim = FX.proAI ? 1200 : 640, ratio = Math.min(1, maxDim / Math.max(rawImg.width, rawImg.height));
  const prep = document.createElement('canvas');
  prep.width = Math.round(rawImg.width * ratio); prep.height = Math.round(rawImg.height * ratio);
  prep.getContext('2d').drawImage(rawImg, 0, 0, prep.width, prep.height);
  URL.revokeObjectURL(rawImg.src);

  const hfToken = (localStorage.getItem('klik_hf_token') || '').trim();
  const at = String.fromCharCode(64), sl = String.fromCharCode(47);

  if (FX.proAI && hfToken) {
    showStatus('Cloud BiRefNet GPU Cutting (99% Sharp)...', true);
    if (!gradioApp) {
      const gUrl = 'https:' + sl + sl + 'cdn.jsdelivr.net' + sl + 'npm' + sl + at + 'gradio' + sl + 'client' + sl + '+esm';
      const { Client } = await import(gUrl);
      gradioApp = await Client.connect('not-lain' + sl + 'background-removal', { hf_token: hfToken });
    }
    const jpgBlob = await new Promise((r) => prep.toBlob(r, 'image/jpeg', 0.95));
    const result = await gradioApp.predict(sl + 'image', { image: jpgBlob });
    const outData = Array.isArray(result.data) ? result.data.at(0) : result.data;
    const outUrl = Array.isArray(outData) ? outData.at(1).url : (outData.url || outData);
    const cutImg = await new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = rej; im.src = outUrl; });
    const cutoutCanvas = document.createElement('canvas');
    cutoutCanvas.width = prep.width; cutoutCanvas.height = prep.height;
    cutoutCanvas.getContext('2d').drawImage(cutImg, 0, 0, prep.width, prep.height);
    return { rawCanvas: prep, cutoutCanvas, box: trimBox(cutoutCanvas), nx, ny, scale, tilt: 0 };
  }

  if (!removeBgFn) {
    showStatus('Loading Offline AI Backup...');
    const tfUrl = 'https:' + sl + sl + 'cdn.jsdelivr.net' + sl + 'npm' + sl + at + 'huggingface' + sl + 'transformers' + at + '3.8.0' + sl + 'dist' + sl + 'transformers.min.js';
    const tf = await import(tfUrl);
    tf.env.allowLocalModels = false;
    tf.env.backends.onnx.wasm.numThreads = 1;
    removeBgFn = await tf.pipeline('background-removal', 'briaai/RMBG-1.4', {
      dtype: 'q8', device: 'wasm',
      progress_callback: (p) => { if (p && p.status === 'progress' && p.total) showStatus('Downloading Offline AI: ' + Math.round((p.loaded / p.total) * 100) + '%...'); }
    });
  }
  showStatus('Offline AI Cutting Product...', true);
  await new Promise((r) => setTimeout(r, 50));
  const out = await removeBgFn(prep.toDataURL('image/jpeg', 0.92));
  const resImg = Array.isArray(out) ? out.at(0) : out;
  const cutoutCanvas = resImg.toCanvas();
  return { rawCanvas: prep, cutoutCanvas, box: trimBox(cutoutCanvas), nx, ny, scale, tilt: 0 };
}


function buildPhotoCard(it) {
  const card = document.createElement('div'); card.className = 'item';
  const canvas = document.createElement('canvas'); it.canvas = canvas;

  const bar1 = document.createElement('div'); bar1.className = 'bar';
  const dots = document.createElement('div'); dots.className = 'dots';
  it.scenes.forEach((s, idx) => {
    const thumb = document.createElement('canvas'); thumb.width = 80; thumb.height = 80;
    thumb.style.cssText = 'width:38px;height:38px;border-radius:8px;border:2px solid #fff7;cursor:pointer;';
    drawBackground(thumb.getContext('2d'), 80, 80, s);
    thumb.onclick = () => { pushUndo(it); it.sceneIdx = idx; it.layers.at(it.activeIdx).ny = s.ny; draw(it); saveToVault(it); };
    dots.appendChild(thumb);
  });

  const undoBtn = document.createElement('button'); undoBtn.className = 'sec'; undoBtn.textContent = 'Undo';
  undoBtn.onclick = () => { undoCard(it); saveToVault(it); };

  const rtBtn = document.createElement('button'); rtBtn.className = 'sec'; rtBtn.textContent = 'Retouch';
  rtBtn.onclick = () => openRetouch(it);

  const addVarBtn = document.createElement('button'); addVarBtn.className = 'sec'; addVarBtn.textContent = '+ Color';
  addVarBtn.onclick = () => { pushUndo(it); activeCardForVariant = it; document.getElementById('variantInput').click(); };

  const btn = document.createElement('button'); btn.className = 'sec'; btn.textContent = 'Save';
  btn.onclick = () => exportCleanPng(it);

  const bar2 = document.createElement('div'); bar2.className = 'bar';
  const sizeLbl = document.createElement('label'); sizeLbl.textContent = 'Size ';
  const slider = document.createElement('input'); slider.type = 'range'; slider.min = '25'; slider.max = '98'; slider.value = String(it.layers.at(0).scale); slider.style.width = '80px';
  slider.onpointerdown = () => pushUndo(it);
  slider.oninput = () => { it.layers.at(it.activeIdx).scale = Number(slider.value); draw(it); };
  slider.onchange = () => saveToVault(it);
  sizeLbl.appendChild(slider); it.slider = slider;

  const tiltLbl = document.createElement('label'); tiltLbl.textContent = 'Rotate ';
  const tiltSlider = document.createElement('input'); tiltSlider.type = 'range'; tiltSlider.min = '-45'; tiltSlider.max = '45'; tiltSlider.value = String(it.layers.at(0).tilt || 0); tiltSlider.style.width = '80px';
  tiltSlider.onpointerdown = () => pushUndo(it);
  tiltSlider.oninput = () => { it.layers.at(it.activeIdx).tilt = Number(tiltSlider.value); draw(it); };
  tiltSlider.onchange = () => saveToVault(it);
  tiltLbl.appendChild(tiltSlider); it.tiltSlider = tiltSlider;

  draw(it); attachGestures(it);
  bar1.append(dots, undoBtn);
  bar2.append(sizeLbl, tiltLbl, rtBtn, addVarBtn, btn);
  card.append(canvas, bar1, bar2); gallery.prepend(card);
}
function openVault() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('klik_vault', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos', { keyPath: 'id' });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function saveToVault(it) {
  try {
    const db = await openVault();
    const layersData = it.layers.map(l => ({
      nx: l.nx, ny: l.ny, scale: l.scale, tilt: l.tilt || 0, box: l.box,
      cutUrl: l.cutoutCanvas.toDataURL('image/png'),
      rawUrl: l.rawCanvas.toDataURL('image/jpeg', 0.85)
    }));
    const tx = db.transaction('photos', 'readwrite');
    tx.objectStore('photos').put({ id: it.id, name: it.name, scenes: it.scenes, sceneIdx: it.sceneIdx, layersData });
  } catch (e) {}
}

async function restoreVault() {
  try {
    const db = await openVault();
    const tx = db.transaction('photos', 'readonly');
    const req = tx.objectStore('photos').getAll();
    req.onsuccess = async () => {
      const saved = req.result || [];
      for (let i = 0; i < saved.length; i++) {
        const rec = saved.at(i), layers = [];
        for (let j = 0; j < rec.layersData.length; j++) {
          const ld = rec.layersData.at(j);
          const loadC = (u) => new Promise((r) => {
            const im = new Image(); im.onload = () => {
              const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
              c.getContext('2d').drawImage(im, 0, 0); r(c);
            }; im.src = u;
          });
          layers.push({ rawCanvas: await loadC(ld.rawUrl), cutoutCanvas: await loadC(ld.cutUrl), box: ld.box, nx: ld.nx, ny: ld.ny, scale: ld.scale, tilt: ld.tilt || 0 });
        }
        const it = { id: rec.id, name: rec.name, layers, activeIdx: 0, selected: false, scenes: rec.scenes, sceneIdx: rec.sceneIdx, canvas: null, history: new Array() };
        items.push(it); buildPhotoCard(it);
      }
      if (items.length) { document.getElementById('actionsBar').style.display = 'block'; showStatus('Restored ' + items.length + ' saved photos.'); }
    };
  } catch (e) {}
}
restoreVault();
document.getElementById('batchInput').onchange = async (e) => {
  const files = Array.from(e.target.files || []); if (!files.length) return;
  document.getElementById('pickBtn').disabled = true; stopBatch = false;
  await keepAlive(true);
  try {
    for (let i = 0; i < files.length; i++) {
      if (stopBatch) break;
      const f = files.at(i); showStatus('Processing ' + (i + 1) + ' of ' + files.length + '...', true);
      const layer = await processFileToLayer(f, 0.5, 0.51, 70);
      const scenes = buildMatchedScenes(layer.cutoutCanvas);
      layer.ny = scenes.at(0).ny;
      const it = { id: Date.now() + '_' + i, name: f.name.replace(/\.[^/.]+$/, '') + '_klik.png', layers: new Array(layer), activeIdx: 0, selected: false, scenes, sceneIdx: 0, canvas: null, history: new Array() };
      items.push(it); buildPhotoCard(it); await saveToVault(it);
    }
    if (items.length) { document.getElementById('actionsBar').style.display = 'block'; showStatus('Done! ' + items.length + ' photos ready & auto-saved to vault.'); }
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
      showStatus('Adding color variant ' + (i + 1) + '...', true);
      const count = it.layers.length;
      const nx = Math.min(0.8, 0.35 + count * 0.18), ny = Math.min(0.75, 0.48 + count * 0.06);
      if (count === 1) { it.layers.at(0).nx = 0.34; it.layers.at(0).scale = 54; }
      const newLayer = await processFileToLayer(files.at(i), nx, ny, 54);
      it.layers.push(newLayer); it.activeIdx = it.layers.length - 1; it.selected = true;
      it.slider.value = '54'; it.tiltSlider.value = '0'; draw(it); await saveToVault(it);
    }
    showStatus('Variant added! Touch to select, pinch to resize & rotate.');
  } catch (err) { showStatus('Error: ' + err.message); }
  await keepAlive(false);
  e.target.value = '';
};

document.getElementById('downloadAllBtn').onclick = () => items.forEach((it, idx) => setTimeout(() => exportCleanPng(it), idx * 350));
document.getElementById('clearBatchBtn').onclick = async () => {
  const db = await openVault();
  db.transaction('photos', 'readwrite').objectStore('photos').clear();
  items.length = 0; gallery.innerHTML = '';
  document.getElementById('actionsBar').style.display = 'none';
  showStatus('Cleared all saved photos.');
};
