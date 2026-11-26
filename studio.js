const RATIOS = {
  '1:1': new Array(1200, 1200),
  '4:5': new Array(1080, 1350),
  '9:16': new Array(1080, 1920),
  '16:9': new Array(1920, 1080)
};

const FX = { proAI: true, floor: true, border3d: true, light: true, arch: true };
let logoImg = null, removeBgFn = null, activeCardForVariant = null, wakeLock = null, stopBatch = false, timerId = null;
const items = [], statusBox = document.getElementById('statusBox'), gallery = document.getElementById('gallery');
const logoThumb = document.getElementById('logoThumb'), logoPos = document.getElementById('logoPos'), logoSize = document.getElementById('logoSize');
const ratioSel = document.getElementById('ratioSel');

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
  el.textContent = FX.proAI ? 'AI: Unlimited Pro (1024px)' : 'AI: Fast Mode (720px)';
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

function detectSoleAndScenes(img) {
  const c = document.createElement('canvas'); c.width = 60; c.height = 60;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, 60, 60);
  const d = x.getImageData(0, 0, 60, 60).data;
  let rSum = 0, gSum = 0, bSum = 0, n = 0, maxY = 0;
  for (let y = 0; y < 60; y++) for (let col = 0; col < 60; col++) {
    const i = (y * 60 + col) * 4;
    if (d.at(i + 3) > 180) { rSum += d.at(i); gSum += d.at(i + 1); bSum += d.at(i + 2); n++; if (y > maxY) maxY = y; }
  }
  let sR = 0, sG = 0, sB = 0, sN = 0;
  const soleStart = Math.max(0, maxY - 11);
  for (let y = soleStart; y <= maxY; y++) for (let col = 0; col < 60; col++) {
    const i = (y * 60 + col) * 4;
    if (d.at(i + 3) > 180) { sR += d.at(i); sG += d.at(i + 1); sB += d.at(i + 2); sN++; }
  }
  const soleLum = rgbToHsl(sN ? sR / sN : 128, sN ? sG / sN : 128, sN ? sB / sN : 128).at(2);
  const isBlackSole = soleLum < 30;

  const hsl = rgbToHsl(n ? rSum / n : 128, n ? gSum / n : 128, n ? bSum / n : 128);
  const hue = hsl.at(0), sat = hsl.at(1), lum = hsl.at(2);
  const comp = (hue + 180) % 360, ana = (hue + 40) % 360, tri = (hue + 140) % 360;

  let scenes;
  if (lum > 64) {
    scenes = new Array(
      { type: 'bokeh', ny: 0.48, top: '#464d5e', bot: '#181c24', pod: '#252a36', rim: '#6c7791', glow: 'rgba(255,255,255,0.22)' },
      { type: 'satin', ny: 0.48, top: '#594a42', bot: '#241c18', pod: '#362b25', rim: '#877064', glow: 'rgba(255,235,215,0.25)' },
      { type: 'arch', ny: 0.47, top: '#3c524d', bot: '#192421', pod: '#273834', rim: '#5e7d76', glow: 'rgba(255,255,255,0.22)' },
      { type: 'marble', ny: 0.48, top: '#4a435c', bot: '#1e1a26', pod: '#2f293b', rim: '#73688f', glow: 'rgba(255,255,255,0.24)' },
      { type: 'studio', ny: 0.48, top: '#dce1eb', bot: '#aeb7c7', pod: '#919cb0', rim: '#ffffff', glow: 'rgba(255,255,255,0.6)' }
    );
  } else if (lum < 34 || sat < 18) {
    scenes = new Array(
      { type: 'bokeh', ny: 0.48, top: '#f5efe6', bot: '#d4c8b4', pod: '#bfb099', rim: '#ffffff', glow: 'rgba(255,248,235,0.8)' },
      { type: 'satin', ny: 0.48, top: '#e8edf2', bot: '#bcc6d4', pod: '#a3b0c2', rim: '#ffffff', glow: 'rgba(255,255,255,0.8)' },
      { type: 'arch', ny: 0.47, top: '#f2e8dc', bot: '#cfb99f', pod: '#baa082', rim: '#fcf6ee', glow: 'rgba(255,245,225,0.75)' },
      { type: 'marble', ny: 0.48, top: '#f0f2f5', bot: '#c9cfd9', pod: '#b2bac7', rim: '#ffffff', glow: 'rgba(255,255,255,0.85)' },
      { type: 'studio', ny: 0.48, top: '#787e8a', bot: '#32363d', pod: '#454a54', rim: '#9aa1b0', glow: 'rgba(255,255,255,0.28)' }
    );
  } else {
    scenes = new Array(
      { type: 'bokeh', ny: 0.48, top: 'hsl(' + comp + ',32%,90%)', bot: 'hsl(' + comp + ',24%,72%)', pod: 'hsl(' + comp + ',20%,62%)', rim: 'hsl(' + comp + ',40%,97%)', glow: 'rgba(255,255,255,0.75)' },
      { type: 'satin', ny: 0.48, top: 'hsl(' + tri + ',28%,89%)', bot: 'hsl(' + tri + ',22%,71%)', pod: 'hsl(' + tri + ',18%,61%)', rim: 'hsl(' + tri + ',35%,96%)', glow: 'rgba(255,250,240,0.75)' },
      { type: 'arch', ny: 0.47, top: 'hsl(' + ana + ',26%,91%)', bot: 'hsl(' + ana + ',20%,74%)', pod: 'hsl(' + ana + ',18%,64%)', rim: 'hsl(' + ana + ',32%,97%)', glow: 'rgba(255,255,255,0.75)' },
      { type: 'marble', ny: 0.48, top: '#f2f4f7', bot: '#cbd1db', pod: '#b5bec9', rim: '#ffffff', glow: 'rgba(255,255,255,0.85)' },
      { type: 'studio', ny: 0.48, top: 'hsl(' + comp + ',28%,30%)', bot: 'hsl(' + comp + ',30%,15%)', pod: 'hsl(' + comp + ',26%,21%)', rim: 'hsl(' + comp + ',30%,44%)', glow: 'rgba(255,255,255,0.24)' }
    );
  }
  return { scenes, isBlackSole };
}

function cleanStrayPixels(c) {
  const w = c.width, h = c.height, ctx = c.getContext('2d');
  const imgData = ctx.getImageData(0, 0, w, h), d = imgData.data;
  const labels = new Int32Array(w * h), sizes = new Array(0), stack = new Array();
  let compId = 0, bestSize = 0;
  for (let i = 0; i < w * h; i++) {
    if (d.at(i * 4 + 3) > 40 && !labels.at(i)) {
      compId++; let cnt = 0; stack.push(i); labels.fill(compId, i, i + 1);
      while (stack.length) {
        const idx = stack.pop(); cnt++;
        const x = idx % w, y = (idx - x) / w;
        const nb = new Array(x > 0 ? idx - 1 : -1, x < w - 1 ? idx + 1 : -1, y > 0 ? idx - w : -1, y < h - 1 ? idx + w : -1);
        for (let k = 0; k < 4; k++) {
          const ni = nb.at(k);
          if (ni >= 0 && d.at(ni * 4 + 3) > 40 && !labels.at(ni)) { labels.fill(compId, ni, ni + 1); stack.push(ni); }
        }
      }
      sizes[compId] = cnt;
      if (cnt > bestSize) bestSize = cnt;
    }
  }
  const minKeep = Math.max(400, bestSize * 0.18);
  for (let i = 0; i < w * h; i++) {
    const id = labels.at(i);
    if (id && sizes.at(id) < minKeep) d.fill(0, i * 4 + 3, i * 4 + 4);
  }
  ctx.putImageData(imgData, 0, 0);
}

function trimBox(c) {
  cleanStrayPixels(c);
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
    const spot = ctx.createRadialGradient(W * 0.45, H * 0.25, W * 0.04, W * 0.5, H * 0.48, Math.max(W, H) * 0.85);
    spot.addColorStop(0, sc.glow); spot.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spot; ctx.fillRect(0, 0, W, H);
  }
  if (!FX.arch) return;

  if (sc.type === 'bokeh') {
    ctx.save(); ctx.fillStyle = sc.pod; ctx.fillRect(0, H * 0.72, W, H * 0.28);
    ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 3;
    for (let i = 1; i <= 4; i++) {
      const y = H * (0.72 + i * 0.065);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(W * 0.28, H * 0.72); ctx.lineTo(W * 0.12, H);
    ctx.moveTo(W * 0.72, H * 0.72); ctx.lineTo(W * 0.88, H); ctx.stroke();
    ctx.fillStyle = sc.rim; ctx.fillRect(0, H * 0.72, W, 4); ctx.restore();
  } else if (sc.type === 'satin') {
    ctx.save();
    for (let i = -3; i <= 3; i++) {
      const rg = ctx.createLinearGradient(W * 0.5 + i * W * 0.14, 0, W * 0.5 + i * W * 0.28, H);
      rg.addColorStop(0, 'rgba(255,255,255,0)'); rg.addColorStop(0.5, sc.glow); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, H * 0.75, W, H * 0.25); ctx.restore();
  } else if (sc.type === 'arch') {
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath(); ctx.arc(W * 0.52, H * 0.43, W * 0.35, Math.PI, 0); ctx.lineTo(W * 0.87, H * 0.76); ctx.lineTo(W * 0.17, H * 0.76); ctx.closePath(); ctx.fill();
    ctx.fillStyle = sc.rim; ctx.globalAlpha = 0.65;
    ctx.beginPath(); ctx.arc(W * 0.5, H * 0.43, W * 0.34, Math.PI, 0); ctx.lineTo(W * 0.84, H * 0.76); ctx.lineTo(W * 0.16, H * 0.76); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = sc.pod; ctx.fillRect(0, H * 0.76, W, H * 0.24); ctx.restore();
  } else if (sc.type === 'marble') {
    ctx.save(); ctx.fillStyle = sc.pod; ctx.fillRect(0, H * 0.73, W, H * 0.27);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, H * 0.81); ctx.bezierCurveTo(W * 0.3, H * 0.77, W * 0.6, H * 0.89, W, H * 0.83);
    ctx.moveTo(W * 0.15, H); ctx.bezierCurveTo(W * 0.4, H * 0.9, W * 0.7, H * 0.94, W * 0.95, H * 0.88); ctx.stroke();
    ctx.fillStyle = sc.rim; ctx.fillRect(0, H * 0.73, W, 5); ctx.restore();
  } else {
    ctx.save();
    const orbs = new Array(new Array(0.2, 0.25, 0.22), new Array(0.8, 0.22, 0.25), new Array(0.76, 0.6, 0.18), new Array(0.24, 0.62, 0.16));
    orbs.forEach(o => {
      const rg = ctx.createRadialGradient(W * o.at(0), H * o.at(1), 4, W * o.at(0), H * o.at(1), W * o.at(2));
      rg.addColorStop(0, sc.glow); rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(W * o.at(0), H * o.at(1), W * o.at(2), 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = sc.pod; ctx.globalAlpha = 0.55; ctx.fillRect(0, H * 0.76, W, H * 0.24); ctx.restore();
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

  const useShadow = it.edgeShadow !== undefined ? it.edgeShadow : FX.border3d;
  const useReflect = it.reflect !== undefined ? it.reflect : true;

  it.layers.forEach((layer, idx) => {
    const r = getLayerRect(layer, W, H);
    const rad = ((layer.tilt || 0) * Math.PI) / 180;

    if (useReflect) {
      ctx.save();
      ctx.translate(r.dx + r.dw / 2, r.dy + r.dh * 1.48);
      ctx.rotate(-rad);
      ctx.scale(1, -0.52);
      ctx.globalAlpha = 0.24;
      ctx.filter = 'blur(3px)';
      ctx.drawImage(layer.cutoutCanvas, layer.box.x, layer.box.y, layer.box.w, layer.box.h, -r.dw / 2, -r.dh / 2, r.dw, r.dh);
      ctx.restore();
    }

    if (FX.floor) {
      ctx.save(); ctx.translate(r.dx + r.dw / 2, r.dy + r.dh - H * 0.008); ctx.scale(1, 0.16);
      const sg = ctx.createRadialGradient(0, 0, 6, 0, 0, r.dw * 0.45);
      sg.addColorStop(0, 'rgba(0,0,0,0.42)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, r.dw * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    ctx.save();
    ctx.translate(r.dx + r.dw / 2, r.dy + r.dh / 2);
    ctx.rotate(rad);
    if (useShadow) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.62)';
      ctx.shadowBlur = Math.round(Math.min(W, H) * 0.011);
      ctx.shadowOffsetX = Math.round(W * 0.008);
      ctx.shadowOffsetY = Math.round(H * 0.010);
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
  let dragIdx = -1, startX = 0, startY = 0, origNx = 0.5, origNy = 0.5, moved = false;
  let pinchDist = 0, pinchAngle = 0, origScale = 78, origTilt = 0;
  it.canvas.style.touchAction = 'pan-y';

  const getPt = (t) => {
    const rect = it.canvas.getBoundingClientRect();
    return { x: ((t.clientX - rect.left) / rect.width) * it.canvas.width, y: ((t.clientY - rect.top) / rect.height) * it.canvas.height };
  };

  it.canvas.addEventListener('touchstart', (ev) => {
    moved = false;
    if (ev.touches.length === 2 && it.selected) {
      ev.preventDefault();
      dragIdx = -1;
      pushUndo(it);
      const p1 = getPt(ev.touches.item(0)), p2 = getPt(ev.touches.item(1));
      pinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      pinchAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const l = it.layers.at(it.activeIdx);
      origScale = l.scale; origTilt = l.tilt || 0;
      return;
    }
    const p = getPt(ev.touches.item(0));
    let hitIdx = -1;
    for (let i = it.layers.length - 1; i >= 0; i--) {
      const r = getLayerRect(it.layers.at(i), it.canvas.width, it.canvas.height);
      const pad = 35;
      if (p.x >= r.dx - pad && p.x <= r.dx + r.dw + pad && p.y >= r.dy - pad && p.y <= r.dy + r.dh + pad) {
        hitIdx = i; break;
      }
    }
    if (it.selected && hitIdx >= 0) {
      ev.preventDefault();
      pushUndo(it);
      dragIdx = hitIdx; it.activeIdx = hitIdx;
      startX = p.x; startY = p.y;
      origNx = it.layers.at(hitIdx).nx; origNy = it.layers.at(hitIdx).ny;
    } else {
      dragIdx = -1;
      it._pendingHit = hitIdx;
    }
  }, { passive: false });

  it.canvas.addEventListener('touchmove', (ev) => {
    moved = true;
    if (ev.touches.length === 2 && it.selected && pinchDist > 0) {
      ev.preventDefault();
      const p1 = getPt(ev.touches.item(0)), p2 = getPt(ev.touches.item(1));
      const newDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const newAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const l = it.layers.at(it.activeIdx);
      l.scale = Math.max(25, Math.min(98, Math.round(origScale * (newDist / pinchDist))));
      l.tilt = Math.max(-45, Math.min(45, Math.round(origTilt + ((newAngle - pinchAngle) * 180) / Math.PI)));
      draw(it);
      return;
    }
    if (!it.selected || dragIdx < 0) return;
    ev.preventDefault();
    const p = getPt(ev.touches.item(0)), l = it.layers.at(dragIdx);
    l.nx = Math.max(0.08, Math.min(0.92, origNx + (p.x - startX) / it.canvas.width));
    l.ny = Math.max(0.08, Math.min(0.92, origNy + (p.y - startY) / it.canvas.height));
    draw(it);
  }, { passive: false });

  it.canvas.addEventListener('touchend', () => {
    if (!moved) {
      if (it._pendingHit >= 0) {
        it.selected = true; it.activeIdx = it._pendingHit;
        it.canvas.style.touchAction = 'none';
      } else if (it.selected && dragIdx < 0) {
        it.selected = false;
        it.canvas.style.touchAction = 'pan-y';
      }
      draw(it);
    }
    if (it.selected && (dragIdx >= 0 || pinchDist > 0)) saveToVault(it);
    dragIdx = -1; pinchDist = 0; it._pendingHit = -1;
  });
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

let rtZoom = 1, rtPanX = 0, rtPanY = 0, rtPinch0 = 0, rtZoom0 = 1;
function updateRtTransform() {
  rtCanvas.style.transform = 'translate(' + rtPanX + 'px,' + rtPanY + 'px) scale(' + rtZoom + ')';
}
const origOpenRetouch = openRetouch;
openRetouch = function(it) { rtZoom = 1; rtPanX = 0; rtPanY = 0; updateRtTransform(); origOpenRetouch(it); };

function startRtDraw(e) { rtBackup = rtCanvas.getContext('2d').getImageData(0, 0, rtCanvas.width, rtCanvas.height); rtDrawing = true; applyBrush(e); }
rtCanvas.addEventListener('mousedown', startRtDraw);
rtCanvas.addEventListener('mousemove', (e) => { if (rtDrawing) applyBrush(e); });
window.addEventListener('mouseup', () => { rtDrawing = false; });

rtCanvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (e.touches.length === 2) {
    rtDrawing = false;
    const t0 = e.touches.item(0), t1 = e.touches.item(1);
    rtPinch0 = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
    rtZoom0 = rtZoom;
    return;
  }
  startRtDraw(e);
}, { passive: false });

rtCanvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (e.touches.length === 2 && rtPinch0 > 0) {
    const t0 = e.touches.item(0), t1 = e.touches.item(1);
    const d = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
    rtZoom = Math.max(1, Math.min(4.5, rtZoom0 * (d / rtPinch0)));
    updateRtTransform();
    return;
  }
  if (rtDrawing) applyBrush(e);
}, { passive: false });

rtCanvas.addEventListener('touchend', () => { rtDrawing = false; rtPinch0 = 0; });

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
  const maxDim = FX.proAI ? 768 : 580, ratio = Math.min(1, maxDim / Math.max(rawImg.width, rawImg.height));
  const prep = document.createElement('canvas');
  prep.width = Math.round(rawImg.width * ratio); prep.height = Math.round(rawImg.height * ratio);
  prep.getContext('2d').drawImage(rawImg, 0, 0, prep.width, prep.height);
  URL.revokeObjectURL(rawImg.src);

  const at = String.fromCharCode(64), sl = String.fromCharCode(47);
  if (!removeBgFn) {
    showStatus('Loading Unlimited Pro AI (One-Time)...', true);
    const tfUrl = 'https:' + sl + sl + 'cdn.jsdelivr.net' + sl + 'npm' + sl + at + 'huggingface' + sl + 'transformers' + at + '3.8.0' + sl + 'dist' + sl + 'transformers.min.js';
    const tf = await import(tfUrl);
    tf.env.allowLocalModels = false;
    tf.env.backends.onnx.wasm.numThreads = 1;
    removeBgFn = await tf.pipeline('background-removal', 'briaai/RMBG-1.4', {
      dtype: 'q8', device: 'wasm',
      progress_callback: (p) => { if (p && p.status === 'progress' && p.total) showStatus('Downloading AI Engine: ' + Math.round((p.loaded / p.total) * 100) + '%...'); }
    });
  }
  showStatus('AI Cutting Product (Unlimited)...', true);
  await new Promise((r) => setTimeout(r, 250));
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

  const shBtn = document.createElement('button');
  shBtn.className = it.edgeShadow ? 'chip on' : 'chip'; shBtn.textContent = 'Shadow';
  shBtn.onclick = () => { it.edgeShadow = !it.edgeShadow; shBtn.className = it.edgeShadow ? 'chip on' : 'chip'; draw(it); saveToVault(it); };

  const rfBtn = document.createElement('button');
  rfBtn.className = it.reflect ? 'chip on' : 'chip'; rfBtn.textContent = 'Reflect';
  rfBtn.onclick = () => { it.reflect = !it.reflect; rfBtn.className = it.reflect ? 'chip on' : 'chip'; draw(it); saveToVault(it); };

  const rtBtn = document.createElement('button'); rtBtn.className = 'sec'; rtBtn.textContent = 'Retouch';
  rtBtn.onclick = () => openRetouch(it);

  const addVarBtn = document.createElement('button'); addVarBtn.className = 'sec'; addVarBtn.textContent = '+ Color';
  addVarBtn.onclick = () => { pushUndo(it); activeCardForVariant = it; document.getElementById('variantInput').click(); };

  const btn = document.createElement('button'); btn.className = 'sec'; btn.textContent = 'Save';
  btn.onclick = () => exportCleanPng(it);

  const bar2 = document.createElement('div'); bar2.className = 'bar';
  draw(it); attachGestures(it);
  bar1.append(dots, undoBtn);
  bar2.append(shBtn, rfBtn, rtBtn, addVarBtn, btn);
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
    tx.objectStore('photos').put({ id: it.id, name: it.name, scenes: it.scenes, sceneIdx: it.sceneIdx, edgeShadow: it.edgeShadow, reflect: it.reflect, layersData });
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
        const it = { id: rec.id, name: rec.name, layers, activeIdx: 0, selected: false, scenes: rec.scenes, sceneIdx: rec.sceneIdx, edgeShadow: rec.edgeShadow, reflect: rec.reflect, canvas: null, history: new Array() };
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
      const layer = await processFileToLayer(f, 0.5, 0.48, 78);
      const analyzed = detectSoleAndScenes(layer.cutoutCanvas);
      layer.ny = analyzed.scenes.at(0).ny;
      const it = { id: Date.now() + '_' + i, name: f.name.replace(/\.[^/.]+$/, '') + '_klik.png', layers: new Array(layer), activeIdx: 0, selected: false, scenes: analyzed.scenes, sceneIdx: 0, edgeShadow: !analyzed.isBlackSole, reflect: true, canvas: null, history: new Array() };
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
      if (count === 1) { it.layers.at(0).nx = 0.34; it.layers.at(0).scale = 58; }
      const newLayer = await processFileToLayer(files.at(i), nx, ny, 58);
      it.layers.push(newLayer); it.activeIdx = it.layers.length - 1; it.selected = true;
     if (it.slider) it.slider.value = '58'; it.tiltSlider.value = '0'; draw(it); await saveToVault(it);
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
