// Editor core: draw/select/move/layers with icon-mode wiring
(function(){
  const $ = s => document.querySelector(s);
  const wrap  = $('#canvasWrap');
  const imgEl = $('#imgLayer');
  const imgC  = $('#imgCanvas');
  const maskC = $('#maskCanvas');
  const textC = $('#textCanvas');
  const showMask  = $('#showMask');
  const showEdges = $('#showEdges');
  const brushSize = $('#brushSize');
  const refineSize= $('#refineSize');

  const dpr = Math.max(1, window.devicePixelRatio||1);
  const ctxImg  = imgC.getContext('2d');
  const ctxMask = maskC.getContext('2d', { willReadFrequently:true });
  const ctxText = textC.getContext('2d');

  let currentImg = null;
  let activeTool = 'select';
  let selectMode = 'wand';
  let selectionActive = false;
  let lassoPts = [];
  let isPointerDown = false;
  let lastX = 0, lastY = 0;

  // Shapes
  let shapeType = 'rect';
  let shapeStroke = 2;

  // Layers
  const layers = []; // {canvas, x, y, angle, removeBg}
  let activeLayer = -1;
  let layerDrag = false;

  function emitSelectionState(on){ window.dispatchEvent(new CustomEvent('selection:state',{detail:{active:!!on}})); }
  function emitLayers(){ window.dispatchEvent(new CustomEvent('layers:update',{detail:{layers, active:activeLayer}})); }

  function hideMask(){
    maskC.classList.add('is-hidden');
    if (showMask) showMask.checked = false;
    ctxMask.setTransform(1,0,0,1,0,0);
    ctxMask.clearRect(0,0,maskC.width,maskC.height);
    selectionActive = false;
    emitSelectionState(false);
  }

  function computeFitDims(imgLike){
    const cw = Math.max(320, wrap?.clientWidth || 800);
    const ch = Math.max(220, wrap?.clientHeight || 600);
    const iw = imgLike?.naturalWidth || imgLike?.width || 1;
    const ih = imgLike?.naturalHeight || imgLike?.height || 1;
    const r = Math.min(cw/iw, ch/ih);
    return { w: Math.max(2, Math.floor(iw*r)), h: Math.max(2, Math.floor(ih*r)) };
  }

  function resizeAll(w, h){
    if (imgEl){ imgEl.style.width = w+'px'; imgEl.style.height = h+'px'; }
    [imgC,maskC,textC].forEach(c=>{
      c.width  = Math.round(w*dpr);
      c.height = Math.round(h*dpr);
      c.style.width = w+'px';
      c.style.height= h+'px';
    });
  }

  function redraw(){
    const w = imgC.width, h = imgC.height;
    const clear = ctx => { ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,w,h); };
    clear(ctxImg); clear(ctxText);

    if (currentImg && (currentImg.naturalWidth||currentImg.width)){
      ctxImg.imageSmoothingEnabled = true;
      ctxImg.drawImage(currentImg, 0, 0, w, h);
    }

    // draw layers on top of base
    layers.forEach(L=>{ if(L) ctxImg.drawImage(L.canvas, L.x, L.y); });

    if (showEdges && showEdges.checked){
      ctxImg.save(); ctxImg.globalCompositeOperation='multiply';
      ctxImg.strokeStyle='rgba(50,50,50,.25)'; ctxImg.lineWidth=1;
      for (let i=-h;i<w;i+=22){ ctxImg.beginPath(); ctxImg.moveTo(i,0); ctxImg.lineTo(i+h,h); ctxImg.stroke(); }
      ctxImg.restore();
    }

    if (window.renderLoomPreview) { try { renderLoomPreview('loomPreviewCanvas'); } catch{} }
  }

  function setTool(t){
    activeTool=t;
    if(t!=='select'){ lassoPts.length=0; selectionActive=false; emitSelectionState(false); }
  }
  window.addEventListener('tool:select', e=> setTool(e.detail.tool));

  // icon-mode events
  window.addEventListener('select:mode', e=>{ selectMode = e.detail?.mode || 'wand'; lassoPts.length=0; });
  window.addEventListener('shape:select', e=>{ shapeType = e.detail?.shape || 'rect'; });
  window.addEventListener('shape:stroke', e=>{ shapeStroke = +e.detail?.width || 0; });

  // pointer helpers
  function xyFromEvent(ev){
    const rect = imgC.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * dpr;
    const y = (ev.clientY - rect.top)  * dpr;
    return {x,y};
  }

  function startPointer(ev){
    isPointerDown = true;
    const {x,y} = xyFromEvent(ev); lastX=x; lastY=y;

    if (activeTool==='draw'){
      ctxMask.globalCompositeOperation='source-over';
      ctxMask.lineCap='round'; ctxMask.lineJoin='round';
      ctxMask.strokeStyle='rgba(0,0,0,1)'; ctxMask.lineWidth=(+brushSize.value||24)*dpr;
      ctxMask.beginPath(); ctxMask.moveTo(x,y);
      maskC.classList.remove('is-hidden');
      selectionActive=true; emitSelectionState(true);
    } else if (activeTool==='select'){
      if (selectMode==='lasso'){
        lassoPts=[{x,y}];
      } else if (selectMode==='refine'){
        ctxMask.globalCompositeOperation='source-over';
        ctxMask.lineCap='round'; ctxMask.lineJoin='round';
        ctxMask.strokeStyle='rgba(0,0,0,1)'; ctxMask.lineWidth=(+refineSize.value||24)*dpr;
        ctxMask.beginPath(); ctxMask.moveTo(x,y);
        maskC.classList.remove('is-hidden');
        selectionActive=true; emitSelectionState(true);
      } else { // wand
        doWandSelection(x|0, y|0, (+document.getElementById('wandTol').value||24));
      }
    } else if (activeTool==='move'){
      // move tool acts like layer-drag if a layer is active
      layerDrag = true;
    } else if (activeTool==='layers' && layerDrag && activeLayer>=0){
      // drag layer; handled in move
    } else if (activeTool==='shapes'){
      // stamp a simple shape into mask for selection -> can become layer
      ctxMask.save();
      ctxMask.globalCompositeOperation='source-over';
      ctxMask.fillStyle='rgba(0,0,0,1)';
      const size = Math.max(40*dpr, 120*dpr);
      if (shapeType==='rect'){
        ctxMask.fillRect(x-size/2, y-size/2, size, size);
      } else if (shapeType==='circle'){
        ctxMask.beginPath(); ctxMask.arc(x, y, size/2, 0, Math.PI*2); ctxMask.fill();
      } else {
        ctxMask.beginPath();
        ctxMask.moveTo(x, y-size/2);
        ctxMask.lineTo(x-size/2, y+size/2);
        ctxMask.lineTo(x+size/2, y+size/2);
        ctxMask.closePath(); ctxMask.fill();
      }
      ctxMask.restore();
      maskC.classList.remove('is-hidden'); selectionActive=true; emitSelectionState(true);
    }
  }

  function movePointer(ev){
    if (!isPointerDown) return;
    const {x,y} = xyFromEvent(ev);

    if (activeTool==='draw' || (activeTool==='select' && selectMode==='refine')){
      ctxMask.lineTo(x,y); ctxMask.stroke();
    } else if (activeTool==='select' && selectMode==='lasso'){
      lassoPts.push({x,y}); drawLassoPreview();
    } else if ((activeTool==='layers' || activeTool==='move') && layerDrag && activeLayer>=0){
      const dx = x-lastX, dy = y-lastY;
      layers[activeLayer].x += dx; layers[activeLayer].y += dy;
      redraw();
    }
    lastX=x; lastY=y;
  }

  function endPointer(){
    if (!isPointerDown) return; isPointerDown=false;

    if (activeTool==='select' && selectMode==='lasso' && lassoPts.length>2){
      ctxMask.save();
      ctxMask.globalCompositeOperation='source-over';
      ctxMask.fillStyle='rgba(0,0,0,1)';
      ctxMask.beginPath();
      ctxMask.moveTo(lassoPts[0].x, lassoPts[0].y);
      for (let i=1;i<lassoPts.length;i++) ctxMask.lineTo(lassoPts[i].x, lassoPts[i].y);
      ctxMask.closePath(); ctxMask.fill(); ctxMask.restore();
      maskC.classList.remove('is-hidden'); selectionActive=true; emitSelectionState(true);
      lassoPts.length=0; ctxText.clearRect(0,0,textC.width,textC.height);
    }
    if (activeTool==='move'){ layerDrag=false; }
  }

  function drawLassoPreview(){
    const w=textC.width,h=textC.height; ctxText.clearRect(0,0,w,h);
    if (!lassoPts.length) return;
    ctxText.save(); ctxText.strokeStyle='rgba(200,50,50,.8)'; ctxText.lineWidth=2*dpr;
    ctxText.beginPath(); ctxText.moveTo(lassoPts[0].x, lassoPts[0].y);
    for (let i=1;i<lassoPts.length;i++) ctxText.lineTo(lassoPts[i].x, lassoPts[i].y);
    ctxText.stroke(); ctxText.restore();
  }

  function doWandSelection(sx,sy,tol){
    const w=imgC.width, h=imgC.height;
    const src = ctxImg.getImageData(0,0,w,h);
    const dst = ctxMask.getImageData(0,0,w,h);
    const si = (sy*w+sx)*4;
    const r0=src.data[si], g0=src.data[si+1], b0=src.data[si+2];
    const seen = new Uint8Array(w*h);
    const q=[{x:sx,y:sy}];
    const t = tol*tol*3;
    while(q.length){
      const {x,y}=q.pop();
      if (x<0||y<0||x>=w||y>=h) continue;
      const idx=y*w+x; if (seen[idx]) continue; seen[idx]=1;
      const i=idx*4; const dr=src.data[i]-r0, dg=src.data[i+1]-g0, db=src.data[i+2]-b0;
      if (dr*dr+dg*dg+db*db<=t){
        dst.data[i]=0; dst.data[i+1]=0; dst.data[i+2]=0; dst.data[i+3]=255;
        q.push({x:x+1,y}); q.push({x:x-1,y}); q.push({x,y+1}); q.push({x,y-1});
      }
    }
    ctxMask.putImageData(dst,0,0);
    maskC.classList.remove('is-hidden'); selectionActive=true; emitSelectionState(true);
  }

  // Remove background action
  window.addEventListener('selection:removebg', ()=>{
    if (!selectionActive) return;
    const w=imgC.width,h=imgC.height;
    const base = ctxImg.getImageData(0,0,w,h);
    const sel  = ctxMask.getImageData(0,0,w,h);
    for(let i=0;i<base.data.length;i+=4){
      if (sel.data[i+3]>0){ base.data[i+3]=0; }
    }
    ctxImg.putImageData(base,0,0);
    hideMask(); redraw();
  });

  // Layers
  window.addEventListener('layer:from-selection', ()=>{
    if (!selectionActive) return;
    const w=imgC.width,h=imgC.height;
    const sub = document.createElement('canvas'); sub.width=w; sub.height=h;
    const sctx=sub.getContext('2d');
    sctx.clearRect(0,0,w,h);
    sctx.drawImage(imgC,0,0);
    const imgD=sctx.getImageData(0,0,w,h);
    const mD=ctxMask.getImageData(0,0,w,h);
    for(let i=0;i<imgD.data.length;i+=4){
      if (mD.data[i+3]===0){ imgD.data[i+3]=0; }
    }
    sctx.putImageData(imgD,0,0);
    layers.push({canvas:sub, x:0, y:0, angle:45, removeBg:false});
    activeLayer = layers.length-1;
    hideMask(); redraw(); emitLayers();
  });
  window.addEventListener('layer:select', e=>{
    activeLayer = Math.max(0, Math.min(layers.length-1, +e.detail.index||0));
    emitLayers();
  });
  window.addEventListener('layer:drag', e=>{ layerDrag = !!e.detail.enabled; });
  window.addEventListener('layer:angle', e=>{
    if (activeLayer>=0 && layers[activeLayer]){ layers[activeLayer].angle = +e.detail.angle||0; }
    redraw();
  });
  window.addEventListener('layer:removebg', e=>{
    if (activeLayer>=0 && layers[activeLayer]){ layers[activeLayer].removeBg = !!e.detail.enabled; }
  });

  // Pointer events
  imgC.addEventListener('pointerdown', startPointer);
  imgC.addEventListener('pointermove', movePointer);
  imgC.addEventListener('pointerup', endPointer);
  imgC.addEventListener('pointerleave', endPointer);

  // Upload
  window.addEventListener('editor:imageLoaded', e=>{
    const img = e?.detail?.img; if(!img) return;
    currentImg = img; hideMask();
    const {w,h} = computeFitDims(img);
    resizeAll(w,h);
    requestAnimationFrame(redraw);
  });

  // Toggles and resize
  showMask && showMask.addEventListener('change', ()=> maskC.classList.toggle('is-hidden', !showMask.checked));
  window.addEventListener('resize', ()=>{
    const base = currentImg || imgEl; if(!base) return;
    const {w,h}=computeFitDims(base); resizeAll(w,h); requestAnimationFrame(redraw);
  });

  // Init
  window.addEventListener('load', ()=>{
    const cw = Math.max(320, wrap?.clientWidth || 800);
    const ch = Math.max(220, wrap?.clientHeight || 600);
    resizeAll(cw, ch); hideMask(); redraw();
  });

  window.Editor = { redraw };
})();
