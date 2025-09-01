// UI glue: tool switching, icon buttons for modes, layer pills, modal behavior
(function(){
  if(!document.body.classList.contains('editor-shell')) return;
  const $  = s=>document.querySelector(s);
  const $$ = s=>Array.from(document.querySelectorAll(s));
  const by = id=>document.getElementById(id);

  // tool -> panel
  const panels = new Map($$('.panel').map(p=>[p.dataset.panel, p]));
  function setTool(t){
    $$('.eb-tool').forEach(b=>{
      const on = b.dataset.tool===t;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    panels.forEach((node,key)=> node.classList.toggle('hidden', key!==t));
    window.dispatchEvent(new CustomEvent('tool:select',{detail:{tool:t}}));
  }
  $$('.eb-tool').forEach(btn=>btn.addEventListener('click',()=> setTool(btn.dataset.tool)));
  setTool('select');

  // Upload
  by('uploadMainBtn')?.addEventListener('click', ()=> by('fileInput')?.click());

  // Tool settings toggle
  const toggleBtn = $('.eb-tools-toggle');
  const setExpanded = on => {
    document.body.classList.toggle('context-collapsed', !on);
    toggleBtn?.setAttribute('aria-expanded', on ? 'true' : 'false');
  };
  toggleBtn?.addEventListener('click', ()=> setExpanded(document.body.classList.contains('context-collapsed')));

  // Top-left hints
  const brandHint = {DST:'Tajima compatible',PES:'Brother / Baby Lock / Bernina',JEF:'Janome / Elna',EXP:'Melco / Bernina',VP3:'Husqvarna Viking / Pfaff',XXX:'Singer',HUS:'Husqvarna Viking',PEC:'Brother (older)'};
  const typeSel = by('fileType'), hintEl = by('fileTypeHint'); const updateHint = ()=> hintEl.textContent = brandHint[typeSel.value] || ''; typeSel?.addEventListener('change', updateHint); updateHint();
  const hoopMap = { '4x4':'4.0" × 4.0', '5x7':'5.0" × 7.0', '6x10':'6.0" × 10.0', '8x12':'8.0" × 12.0' };
  by('hoopSize')?.addEventListener('change', (e)=>{ by('statusHoop').textContent = hoopMap[e.target.value] || e.target.value; window.dispatchEvent(new CustomEvent('preview:hoop', { detail:{ size:e.target.value }})); });
  by('showDirGlobal')?.addEventListener('change', e=> window.dispatchEvent(new CustomEvent('preview:showDirection', { detail:{ enabled:e.target.checked }})));

  // SELECT modes via buttons
  const selectModes = $('#selectModes');
  function setSelectMode(mode){
    selectModes?.querySelectorAll('.chipbtn').forEach(b=> b.classList.toggle('is-active', b.dataset.mode===mode));
    const selW = by('selectWandGroup'), selR = by('selectRefineGroup');
    selW.classList.toggle('hidden', mode!=='wand');
    selR.classList.toggle('hidden', mode!=='refine');
    window.dispatchEvent(new CustomEvent('select:mode',{detail:{mode}}));
  }
  selectModes?.addEventListener('click', e=>{
    const b = e.target.closest('.chipbtn'); if(!b) return;
    setSelectMode(b.dataset.mode);
  });
  setSelectMode('wand');

  // MOVE tool checkbox -> drag enable
  by('moveEnable')?.addEventListener('change', e=> window.dispatchEvent(new CustomEvent('layer:drag',{detail:{enabled:e.target.checked}})));

  // SHAPES via buttons
  const shapeBtns = by('shapeBtns');
  function setShape(shape){
    shapeBtns?.querySelectorAll('.chipbtn').forEach(b=> b.classList.toggle('is-active', b.dataset.shape===shape));
    window.dispatchEvent(new CustomEvent('shape:select',{detail:{shape}}));
  }
  shapeBtns?.addEventListener('click', e=>{
    const b = e.target.closest('.chipbtn'); if(!b) return;
    setShape(b.dataset.shape);
  });
  setShape('rect');
  by('shapeStroke')?.addEventListener('input', e=> window.dispatchEvent(new CustomEvent('shape:stroke',{detail:{width:+e.target.value||0}})));

  // Selection state drives buttons
  const removeBgBtn = by('removeBgAction');
  const layerFromSel = by('layerFromSelection');
  window.addEventListener('selection:state', e=>{
    const on = !!e.detail?.active;
    removeBgBtn.disabled = !on;
    if (layerFromSel) layerFromSel.disabled = !on;
  });
  removeBgBtn?.addEventListener('click', ()=> window.dispatchEvent(new CustomEvent('selection:removebg')));

  // Layers pills
  const pills = by('layerPills');
  function renderLayerPills(list, activeIdx){
    pills.innerHTML = '';
    list.forEach((L,i)=>{
      const b = document.createElement('button');
      b.type='button'; b.className='pill'+(i===activeIdx?' is-active':''); b.textContent=`Layer ${i+1}`;
      b.dataset.index=String(i);
      pills.appendChild(b);
    });
  }
  pills?.addEventListener('click', e=>{
    const b = e.target.closest('.pill'); if(!b) return;
    window.dispatchEvent(new CustomEvent('layer:select',{detail:{index:+b.dataset.index}}));
  });
  by('layerMoveToggle')?.addEventListener('change', e=> window.dispatchEvent(new CustomEvent('layer:drag',{detail:{enabled:e.target.checked}})));
  by('layerAngle')?.addEventListener('input', e=> window.dispatchEvent(new CustomEvent('layer:angle',{detail:{angle:+e.target.value||0}})));
  by('layerRemoveBg')?.addEventListener('change', e=> window.dispatchEvent(new CustomEvent('layer:removebg',{detail:{enabled:e.target.checked}})));
  by('layerFromSelection')?.addEventListener('click', ()=> window.dispatchEvent(new CustomEvent('layer:from-selection')));
  window.addEventListener('layers:update', e=>{
    const {layers=[], active=0} = e.detail||{};
    renderLayerPills(layers, active);
  });

  // Modal open/close
  const modal = by('previewModal');
  by('loomPreviewEnlarge')?.addEventListener('click', ()=>{
    if (!modal.open) modal.showModal();
    if(window.renderLoomPreview) renderLoomPreview('loomPreviewLarge');
  });
  by('previewModalClose')?.addEventListener('click', ()=> modal.close());
  modal?.addEventListener('click', ev=>{
    const body = modal.querySelector('.eb-modal__body');
    if(!body) return;
    const r = body.getBoundingClientRect();
    const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    if(!inside) modal.close();
  });

  // Init
  window.addEventListener('load', ()=>{
    by('maskCanvas')?.classList.add('is-hidden');
    if(window.renderLoomPreview) renderLoomPreview('loomPreviewCanvas');
  });
})();
