hereimport imglyModule from 'https://jsdelivr.net';
const removeBg = imglyModule.removeBackground || imglyModule;

const SHADES = [
  { name: 'Cool Slate', top: '#3c424f', bottom: '#232730' },
  { name: 'Warm Alabaster', top: '#f8f6f1', bottom: '#e6e1d6' },
  { name: 'Soft Stone', top: '#eef0f4', bottom: '#d8dce3' },
  { name: 'Warm Ivory', top: '#fcf9f2', bottom: '#efe7d8' },
  { name: 'Pastel Sky', top: '#edf4fc', bottom: '#d7e5f5' }
];

let logoImg = null;
const processedItems = [];
const statusBox = document.getElementById('statusBox');
const gallery = document.getElementById('gallery');
const logoThumb = document.getElementById('logoThumb');
const logoPos = document.getElementById('logoPos');
const logoSize = document.getElementById('logoSize');

function showStatus(msg) { statusBox.style.display = 'block'; statusBox.textContent = msg; }

function loadSavedLogo() {
  const savedData = localStorage.getItem('klik_logo_data');
  if (localStorage.getItem('klik_logo_pos')) logoPos.value = localStorage.getItem('klik_logo_pos');
  if (localStorage.getItem('klik_logo_size')) logoSize.value = localStorage.getItem('klik_logo_size');
  if (savedData) {
    const img = new Image();
    img.onload = () => { logoImg = img; logoThumb.src = savedData; };
    img.src = savedData;
  }
}
loadSavedLogo();

document.getElementById('logoInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { localStorage.setItem('klik_logo_data', reader.result); loadSavedLogo(); setTimeout(() => processedItems.forEach(renderItem), 100); };
  reader.readAsDataURL(file);
});

logoPos.addEventListener('change', () => { localStorage.setItem('klik_logo_pos', logoPos.value); processedItems.forEach(renderItem); });
logoSize.addEventListener('input', () => { localStorage.setItem('klik_logo_size', logoSize.value); processedItems.forEach(renderItem); });

function detectBestShadeIndex(cutoutImg) {
  const c = document.createElement('canvas'); c.width = 100; c.height = 100;
  const ctx = c.getContext('2d'); ctx.drawImage(cutoutImg, 0, 0, 100, 100);
  const data = ctx.getImageData(0, 0, 100, 100).data;
  let lumSum = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 180) { lumSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; count++; }
  }
  const avgLum = count ? lumSum / count : 128;
  return avgLum > 165 ? 0 : (avgLum < 85 ? 1 : 2);
}

function getTrimmedBounds(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 25) {
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return (maxX <= minX || maxY <= minY) ? { x: 0, y: 0, w: width, h: height } : { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function renderItem(item) {
  const size = 1200, canvas = item.canvas;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d'), shade = SHADES[item.shadeIndex];
  const grad = ctx.createRadialGradient(size * 0.5, size * 0.45, size * 0.08, size * 0.5, size * 0.5, size * 0.78);
  grad.addColorStop(0, shade.top); grad.addColorStop(1, shade.bottom);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);

  const b = item.bounds, scale = Math.min((size * 0.72) / b.w, (size * 0.72) / b.h);
  const drawW = b.w * scale, drawH = b.h * scale, drawX = (size - drawW) / 2, drawY = (size - drawH) / 2 + size * 0.02;

  ctx.save(); ctx.translate(size / 2, drawY + drawH - size * 0.015); ctx.scale(1, 0.22);
  const shGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, drawW * 0.48);
  shGrad.addColorStop(0, 'rgba(0,0,0,0.34)'); shGrad.addColorStop(0.6, 'rgba(0,0,0,0.14)'); shGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shGrad; ctx.beginPath(); ctx.arc(0, 0, drawW * 0.48, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  ctx.drawImage(item.cutoutImg, b.x, b.y, b.w, b.h, drawX, drawY, drawW, drawH);

  if (logoImg) {
    const lW = size * (Number(logoSize.value) / 100), lH = lW * (logoImg.height / logoImg.width), pad = size * 0.045, pos = logoPos.value;
    ctx.drawImage(logoImg, pos.includes('r') ? size - lW - pad : pad, pos.includes('b') ? size - lH - pad : pad, lW, lH);
  }
}

document.getElementById('batchInput').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  const pickBtn = document.getElementById('pickBtn'); pickBtn.disabled = true;

  for (let i = 0; i < files.length; i++) {
    showStatus('Processing ' + (i + 1) + ' of ' + files.length + ' (First photo loads AI model once)...');
    try {
      const blob = await removeBg(files[i], { model: 'medium', output: { format: 'image/png', quality: 1 } });
      const cutoutImg = await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(blob); });
      const card = document.createElement('div'); card.className = 'item';
      const canvas = document.createElement('canvas');
      const item = { name: files[i].name.replace(/\.[^/.]+$/, '') + '_klik.png', cutoutImg, bounds: getTrimmedBounds(cutoutImg), shadeIndex: detectBestShadeIndex(cutoutImg), canvas };
      processedItems.push(item); renderItem(item);

      const bar = document.createElement('div'); bar.className = 'swatches';
      const dots = document.createElement('div'); dots.className = 'dots';
      SHADES.forEach((s, idx) => { const d = document.createElement('div'); d.className = 'dot'; d.style.background = s.top; d.onclick = () => { item.shadeIndex = idx; renderItem(item); }; dots.appendChild(d); });
      const dlBtn = document.createElement('button'); dlBtn.className = 'sec'; dlBtn.textContent = 'Save';
      dlBtn.onclick = () => { const a = document.createElement('a'); a.download = item.name; a.href = canvas.toDataURL('image/png'); a.click(); };
      bar.appendChild(dots); bar.appendChild(dlBtn); card.appendChild(canvas); card.appendChild(bar); gallery.prepend(card);
    } catch (err) { showStatus('Error on photo ' + (i + 1) + ': ' + err.message); }
  }
  pickBtn.disabled = false;
  if (processedItems.length) { document.getElementById('actionsBar').style.display = 'block'; showStatus('Done! ' + processedItems.length + ' product photos ready.'); }
  e.target.value = '';
});

document.getElementById('downloadAllBtn').addEventListener('click', async () => {
  for (let i = 0; i < processedItems.length; i++) {
    const a = document.createElement('a'); a.download = processedItems[i].name; a.href = processedItems[i].canvas.toDataURL('image/png'); a.click();
    await new Promise(r => setTimeout(r, 350));
  }
});
