(function(){
  let hoop = '4x4';
  let showDir = false;

  function hoopRect(w,h){ const pad=Math.min(w,h)*0.12; return {x:pad,y:pad,w:w-2*pad,h:h-2*pad,r:18}; }
  function rr(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function drawHoop(ctx,w,h){
    ctx.fillStyle='#f6e9de'; ctx.fillRect(0,0,w,h);
    ctx.lineWidth=20; ctx.strokeStyle='#6b6766'; rr(ctx,10,10,w-20,h-20,30); ctx.stroke();
    ctx.lineWidth=12; ctx.strokeStyle='#c9c5c2'; const m=28; rr(ctx,m,m,w-2*m,h-2*m,22); ctx.stroke();
    const clampW=Math.max(26,w*0.065), clampH=Math.max(60,h*0.35); const cx=w-(m+clampW)+6, cy=h/2-clampH/2;
    ctx.fillStyle='#d9d7d6'; ctx.strokeStyle='#6b6766'; ctx.lineWidth=2; ctx.fillRect(cx,cy,clampW,clampH); ctx.strokeRect(cx,cy,clampW,clampH);
    ctx.beginPath(); ctx.fillStyle='#efc1b9'; ctx.arc(cx+clampW/2,cy+clampH/2,Math.max(8,clampW*0.25),0,Math.PI*2); ctx.fill();
  }

  function drawStitches(ctx,w,h){
    try{
      const pts = (window.__stitches||[]);
      if(!pts.length) return;
      const ic = document.getElementById('imgCanvas');
      const iw = Math.max(1, ic?.width || w);
      const ih = Math.max(1, ic?.height|| h);
      const sx = w/iw, sy = h/ih;

      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#c66';
      ctx.beginPath();
      ctx.moveTo(pts[0][0]*sx, pts[0][1]*sy);
      for(let i=1;i<pts.length;i++){
        ctx.lineTo(pts[i][0]*sx, pts[i][1]*sy);
      }
      ctx.stroke();
      ctx.restore();
    }catch(e){}
  }

  function render(targetId){
    const can=document.getElementById(targetId); if(!can) return;
    const ctx=can.getContext('2d'); const w=can.width,h=can.height;
    ctx.clearRect(0,0,w,h); 
    drawHoop(ctx,w,h); 
    drawStitches(ctx,w,h);
  }

  window.addEventListener('preview:hoop', e=>{ hoop = e.detail?.size || hoop; render('loomPreviewCanvas'); });
  window.addEventListener('preview:showDirection', e=>{ showDir = !!e.detail?.enabled; render('loomPreviewCanvas'); });
  window.addEventListener('stitches:update', ()=> render('loomPreviewCanvas'));
  window.renderLoomPreview = render;
})();