/*  Simple photo → embroidery converter
    1. Reads an image
    2. Creates a b/w mask via luminance
    3. Generates running stitches (zig-zag) on a grid
    4. Exports DST and SVG
*/
const canvas   = document.getElementById('sourceCanvas');
const ctx      = canvas.getContext('2d');
const upload   = document.getElementById('imageLoader');
const btn      = document.getElementById('uploadBtn');
const preview  = document.getElementById('btnPreview');
const dstBtn   = document.getElementById('btnDownloadDST');
const svgBtn   = document.getElementById('btnDownloadSVG');
const lenRange = document.getElementById('stitchLen');
const lenVal   = document.getElementById('stitchLenVal');

let img, stitches = [];

// wire up buttons
btn.onclick   = () => upload.click();
upload.onchange = handleImage;
preview.onclick = generateStitches;
lenRange.oninput = e => lenVal.textContent = e.target.value;
dstBtn.onclick   = () => downloadDST(stitches);
svgBtn.onclick   = () => downloadSVG(stitches);

function handleImage(e) {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  img = new Image();
  img.onload = () => {
    canvas.width  = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    document.getElementById('workspace').hidden = false;
  };
  img.src = url;
}

// crude mask: pixels darker than threshold become stitches
function generateStitches() {
  stitches = [];
  const { width, height } = canvas;
  const step = +lenRange.value * 10; // px → mm rough scale
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y += step) {
    let leftToRight = (y / step) % 2 === 0;
    let xs = leftToRight ? 0 : width;
    let xe = leftToRight ? width : 0;
    let dir = leftToRight ? 1 : -1;

    for (let x = xs; x !== xe; x += dir * 2) {
      const idx = (y * width + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (lum < 128) stitches.push([x, y]);
    }
  }
  drawPreview();
}

function drawPreview() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  ctx.strokeStyle = '#ff3f81';
  ctx.lineWidth = 1;
  ctx.beginPath();
  stitches.forEach((p, i) => {
    if (i === 0) ctx.moveTo(...p); else ctx.lineTo(...p);
  });
  ctx.stroke();
}

/* ---------- DST export ---------- */
function downloadDST(points) {
  const dst = toDST(points);
  downloadBlob(dst, 'embroidery.dst', 'application/octet-stream');
}

function toDST(points) {
  // minimal DST header
  const header = 'LA:Easbroidery\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20\x20';
  let body = '';
  let lastX = 0, lastY = 0;
  points.forEach(([x, y]) => {
    const dx = Math.round(x - lastX);
    const dy = Math.round(y - lastY);
    body += encodeTajima(dx, dy, false);
    lastX = x; lastY = y;
  });
  body += encodeTajima(0, 0, true); // END
  return header + body;
}

function encodeTajima(dx, dy, end) {
  const x = (dx < 0 ? dx + 2 ** 21 : dx) & 0x7F;
  const y = (dy < 0 ? dy + 2 ** 21 : dy) & 0x7F;
  const flags = (end ? 0x0F : 0x03) << 5;
  const byte2 = (x >> 4) | flags;
  const byte1 = ((x & 0x0F) << 4) | ((y >> 3) & 0x0F);
  const byte0 = ((y & 0x07) << 5) | 0x03;
  return String.fromCharCode(byte0, byte1, byte2);
}

/* ---------- SVG export ---------- */
function downloadSVG(points) {
  const w = canvas.width, h = canvas.height;
  let path = `M${points.map(p => p.join(',')).join(' L')}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <path d="${path}" stroke="black" fill="none" stroke-width="1"/>
</svg>`;
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'embroidery.svg');
}

/* ---------- helpers ---------- */
function downloadBlob(blob, name, type = 'application/octet-stream') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
