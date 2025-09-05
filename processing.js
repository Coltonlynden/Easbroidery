
// processing.js — raster→stitches (running-stitch) + DST export
(function(){
  if(!document.getElementById('btnConvert')) return;

  const IMG_CAN   = document.getElementById('imgCanvas');
  const MASK_CAN  = document.getElementById('maskCanvas');
  const IMG_EL    = document.getElementById('imgLayer');
  const STATUS_ST = document.getElementById('statusStitches');
  const HOOP_SEL  = document.getElementById('hoopSize');

  // Public stash for preview.js
  window.__stitches = [];

  function grabImageData(){
    const w = IMG_CAN.width, h = IMG_CAN.height;
    const ctx = IMG_CAN.getContext('2d', { willReadFrequently:true });
    // If canvas is empty but <img> is set, draw it once
    try {
      const a = ctx.getImageData(0,0,1,1).data[3];
      if (IMG_EL && IMG_EL.src && a===0) ctx.drawImage(IMG_EL,0,0,w,h);
    } catch {}
    return ctx.getImageData(0,0,w,h);
  }
  function grabMaskData(){
    const w = MASK_CAN.width, h = MASK_CAN.height;
    return MASK_CAN.getContext('2d', { willReadFrequently:true }).getImageData(0,0,w,h);
  }

  /* ---------- Mask generation ---------- */
  function otsuThreshold(gray){
    // gray: Uint8ClampedArray of length w*h
    const hist = new Uint32Array(256);
    for(let i=0;i<gray.length;i++) hist[gray[i]]++;
    const total = gray.length;
    let sum=0; for(let t=0;t<256;t++) sum += t*hist[t];
    let sumB=0, wB=0, wF=0, varMax=0, threshold=127;
    for(let t=0;t<256;t++){
      wB += hist[t]; if(wB===0) continue;
      wF = total - wB; if(wF===0) break;
      sumB += t*hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB*wF*(mB-mF)*(mB-mF);
      if(between > varMax){ varMax=between; threshold=t; }
    }
    return threshold;
  }
  function ensureMask(imgData, maskData){
    // If any alpha in mask is nonzero, keep it. Else auto from luminance.
    const {data:md} = maskData;
    let has = false;
    for(let i=3;i<md.length;i+=4){ if(md[i]>0){ has=true; break; } }
    if(has) return maskData;

    // Build grayscale and threshold
    const {data:id} = imgData;
    const gray = new Uint8ClampedArray(id.length/4);
    for(let i=0,g=0;i<id.length;i+=4){
      // Rec709 luma
      gray[g++] = Math.max(0, Math.min(255, Math.round(id[i]*0.2126 + id[i+1]*0.7152 + id[i+2]*0.0722)));
    }
    const thr = otsuThreshold(gray);
    for(let i=0,g=0;i<md.length;i+=4){
      const m = (gray[g++] < thr) ? 255 : 0; // foreground as darker
      md[i] = md[i+1] = md[i+2] = 0;
      md[i+3] = m;
    }
    return maskData;
  }

  /* ---------- Stitches from mask ---------- */
  function maskToStitches(maskData, stepPx=4, angleDeg=45){
    const w = maskData.width, h = maskData.height;
    const a = maskData.data;
    const rad = angleDeg * Math.PI / 180;
    // Rotate scanlines by angle using a simple shearing trick: sample along lines
    // Implementation: create scanlines in image space by stepping along y, drawing short segments where mask alpha>0.
    const points = [];
    const cos = Math.cos(rad), sin = Math.sin(rad);
    // Precompute a helper that tests mask alpha at integer pixel
    function inside(x,y){
      x|=0; y|=0;
      if(x<0||y<0||x>=w||y>=h) return 0;
      return a[(y*w + x)*4 + 3] > 0 ? 1 : 0;
    }
    // Determine bounding box of mask
    let minx=w, miny=h, maxx=0, maxy=0;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        if(inside(x,y)){ if(x<minx)minx=x; if(y<miny)miny=y; if(x>maxx)maxx=x; if(y>maxy)maxy=y; }
      }
    }
    if(minx>maxx || miny>maxy) return [];
    // Create scanlines perpendicular to angle direction. We step across bounding box in stepPx.
    // For each t along the orthogonal axis, intersect the line with the bounding box and sample.
    const diag = Math.hypot(w,h);
    const ux = Math.cos(rad + Math.PI/2);
    const uy = Math.sin(rad + Math.PI/2);
    const cx = (minx+maxx)/2, cy=(miny+maxy)/2;
    const span = (Math.abs(ux)*(maxx-minx) + Math.abs(uy)*(maxy-miny));
    const nLines = Math.max(1, Math.floor(span / stepPx));
    for(let li= -nLines/2; li<= nLines/2; li++){
      // Point on the orthogonal axis
      const ox = cx + ux * li * stepPx;
      const oy = cy + uy * li * stepPx;
      // Walk along the primary direction across enough length
      const len = diag*1.2;
      const sx = ox - cos * len/2;
      const sy = oy - sin * len/2;
      const ex = ox + cos * len/2;
      const ey = oy + sin * len/2;
      const segPts=[];
      const steps = Math.ceil(len);
      let on=false;
      for(let s=0;s<=steps;s++){
        const t = s/steps;
        const x = Math.round(sx + (ex - sx)*t);
        const y = Math.round(sy + (ey - sy)*t);
        const m = inside(x,y);
        if(m && !on){ // start of segment
          segPts.push([x,y]);
          on=true;
        } else if(!m && on){ // end of segment
          segPts.push([x,y]);
          on=false;
        }
      }
      // If ended inside region, close segment at end
      if(on) segPts.push([Math.round(ex), Math.round(ey)]);
      // For each pair create a short back-and-forth zig
      for(let i=0;i+1<segPts.length;i+=2){
        const A = segPts[i], B = segPts[i+1];
        // Clip to bbox
        const Ax = Math.min(maxx, Math.max(minx, A[0]));
        const Ay = Math.min(maxy, Math.max(miny, A[1]));
        const Bx = Math.min(maxx, Math.max(minx, B[0]));
        const By = Math.min(maxy, Math.max(miny, B[1]));
        if(points.length){
          // jump if distance big
          const px = points[points.length-1][0], py = points[points.length-1][1];
          if(Math.hypot(Ax-px, Ay-py) > stepPx*2) points.push([Ax,Ay]); // jump stitch
        } else {
          points.push([Ax,Ay]);
        }
        points.push([Bx,By]);
      }
    }
    // Optional: simple path smoothing by decimation
    const out=[];
    const minStep = 1; // px
    let last=null;
    for(const p of points){
      if(!last || Math.hypot(p[0]-last[0], p[1]-last[1])>=minStep){
        out.push(p); last=p;
      }
    }
    return out;
  }

  /* ---------- DST writer ---------- */
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function splitDelta(delta){
    // Tajima per-stitch delta limited to [-121,121]
    const parts=[];
    let d = delta;
    while(d > 121){ parts.push(121); d -= 121; }
    while(d < -121){ parts.push(-121); d += 121; }
    parts.push(d);
    return parts;
  }
  function encodeStitch(dx, dy, isJump=false, isEnd=false){
    // Basic Tajima encoding. We use only short format bits.
    // ref: http://www.ime.usp.br/~otavio/Embroideries/TajimaDSTFormat.html
    function b(v,bit){ return (v>>bit)&1; }
    let x = dx, y = dy;
    const b0 =
      (b(x,0)<<0) | (b(y,0)<<1) | (b(x,1)<<2) | (b(y,1)<<3) |
      (b(x,2)<<4) | (b(y,2)<<5) | (b(x,3)<<6) | (b(y,3)<<7);
    const b1 =
      (b(x,4)<<0) | (b(y,4)<<1) | (b(x,5)<<2) | (b(y,5)<<3) |
      (isJump?0x20:0) | 0x03; // 0x03 constant
    const b2 =
      (b(x,6)<<0) | (b(y,6)<<1) |
      (isEnd?0xF0:0x00);
    return String.fromCharCode(b0&0xFF, b1&0xFF, b2&0xFF);
  }
  function buildDST(pointsPx, hoopInches=[4,4], pxToMm){
    // Convert pixel points to DST bytes with scale
    // pxToMm: scalar mm per px
    if(pointsPx.length<2){
      const header = makeDSTHeader(0,0,0,0,0);
      const end = String.fromCharCode(0x00,0x00,0xF3);
      return header + end;
    }
    // Scale to 0.1mm units
    const pts = pointsPx.map(p=> [p[0]*pxToMm*10, p[1]*pxToMm*10]);
    // Centering: shift so center is near origin
    let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
    for(const [x,y] of pts){ if(x<minx)minx=x; if(y<miny)miny=y; if(x>maxx)maxx=x; if(y>maxy)maxy=y; }
    const cx=(minx+maxx)/2, cy=(miny+maxy)/2;
    const centered = pts.map(([x,y])=> [x-cx, y-cy]);

    // Build stitch bytes
    let bytes = "";
    let sx=centered[0][0], sy=centered[0][1];
    let stitches=0;
    for(let i=1;i<centered.length;i++){
      const dx = Math.round(centered[i][0]-sx);
      const dy = Math.round(centered[i][1]-sy);
      // Split if needed
      const partsX = splitDelta(dx);
      const partsY = splitDelta(dy);
      // Make equal-length sequences
      const n = Math.max(partsX.length, partsY.length);
      while(partsX.length<n) partsX.push(0);
      while(partsY.length<n) partsY.push(0);
      for(let k=0;k<n;k++){
        bytes += encodeStitch(partsX[k], partsY[k], false, false);
        stitches++;
      }
      sx = centered[i][0];
      sy = centered[i][1];
    }
    // End record
    bytes += String.fromCharCode(0x00, 0x00, 0xF3);

    // Header requires extents in 0.1mm units
    const extX = Math.round(maxx-minx);
    const extY = Math.round(maxy-miny);
    const header = makeDSTHeader(stitches, extX, extY, -Math.round(minx), -Math.round(miny));
    return header + bytes;
  }
  function pad(s,len){ return (s + " ".repeat(len)).slice(0,len); }
  function makeDSTHeader(stitches, extX, extY, offX, offY){
    // Minimal valid 512-byte header
    // Fields approximate. Many readers accept this.
    const lines = [
      `LA:DESIGN`,
      `ST:${String(stitches).padStart(7,' ')}`,
      `CO:1`,
      `+X:${String(extX).padStart(5,' ')}`,
      `-X:${String(extX).padStart(5,' ')}`,
      `+Y:${String(extY).padStart(5,' ')}`,
      `-Y:${String(extY).padStart(5,' ')}`,
      `AX:+${String(offX).padStart(5,' ')}`,
      `AY:+${String(offY).padStart(5,' ')}`,
      `MX:+00000`,
      `MY:+00000`,
      `PD:**********`
    ];
    let hdr = lines.map(l=> pad(l, 26)).join("");
    hdr = pad(hdr, 512-3) + String.fromCharCode(0x1A,0x00,0x00);
    return hdr;
  }

  /* ---------- Preview + scale ---------- */
  function hoopMmFor(value){
    switch(value){
      case '4x4': return [100,100];
      case '5x7': return [130,180]; // approx
      case '6x10': return [160,260]; // approx
      default: return [100,100];
    }
  }
  function pxToMmFactory(canvasW, canvasH, hoopSel){
    const [mw,mh] = hoopMmFor(hoopSel);
    const s = Math.min(mw/canvasW, mh/canvasH);
    return s; // mm per px
  }

  /* ---------- Main convert ---------- */
  function convert(){
    const w = IMG_CAN.width, h = IMG_CAN.height; if(!w||!h) return;
    const imgData  = grabImageData();
    const maskData = ensureMask(imgData, grabMaskData());

    // Make stitches
    const angleEl = document.getElementById('layerAngle');
    const angle = angleEl ? (+angleEl.value||45) : 45;
    const stepEl = document.getElementById('brushSize');
    const step = stepEl ? Math.max(2, Math.round(+stepEl.value/2)) : 4;
    const pts = maskToStitches(maskData, step, angle);
    window.__stitches = pts;

    // Update status + preview
    STATUS_ST && (STATUS_ST.textContent = `${pts.length} stitches`);
    const evt = new CustomEvent('stitches:update', { detail:{ stitches: pts }});
    window.dispatchEvent(evt);
  }

  function exportDST(){
    const pts = window.__stitches||[];
    const hoopSel = HOOP_SEL ? HOOP_SEL.value : '4x4';
    const pxToMm = pxToMmFactory(IMG_CAN.width, IMG_CAN.height, hoopSel);
    const dst = buildDST(pts, hoopSel.split('x').map(Number), pxToMm);
    const blob = new Blob([dst], {type:'application/octet-stream'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'output.dst';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  document.getElementById('btnConvert')?.addEventListener('click', convert);
  document.getElementById('exportBtn')?.addEventListener('click', exportDST);

  // Also re-render preview hoop when size changes
  HOOP_SEL?.addEventListener('change', e=>{
    window.dispatchEvent(new CustomEvent('preview:hoop', { detail:{ size: e.target.value }}));
    if(window.renderLoomPreview) renderLoomPreview('loomPreviewCanvas');
  });
})();
