(function(){
  let hoop = '4x4';
  let showDir = false;

  window.addEventListener('preview:hoop', e=>{ hoop = e.detail?.size || hoop; render('loomPreviewCanvas'); });
  window.addEventListener('preview:showDirection', e=>{ showDir = !!e.detail?.enabled; render('loomPreviewCanvas'); });

  function hoopRect(w,h){ const pad=Math.min(w,h)*0.12; return {x:pad,y:pad,w:w-2*pad,h:h-2*pad,r:18}; }
  function rr(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function drawHoop(ctx,w,h){
    ctx.fillStyle='#f6e9de'; ctx.fillRect(0,0,w,h);
    ctx.lineWidth=20; ctx.strokeStyle='#6b6766'; rr(ctx,10,10,w-20,h-20,30); ctx.stroke();
    ctx.lineWidth=12; ctx.strokeStyle='#c9c5c2'; const m=28; rr(ctx,m,m,w-2*m,h-2*m,22); ctx.stroke();
    const clampW=Math.max(26,w*0.065), clampH=Math.max(60,h*0.35); const cx=w-(m+clampW)+6, cy=h/2-clampH/2;
    ctx.fillStyle='#d9d7d6'; ctx.strokeStyle='#6b6766'; ctx.lineWidth=2; ctx.fillRect(cx,cy,clampW,clampH); ctx.strokeRect(cx,cy,clampW,clampH);
    ctx.beginPath(); ctx.fillStyle='#efc1b9'; ctx.arc(cx+clampW/2,cy+clampH/2,Math.max(8,clampW*0.25),0,Math.PI*2); ctx.fill();
    const r=hoopRect(w,h); ctx.save(); ctx.beginPath(); rr(ctx,r.x,r.y,r.w,r.h,r.r); ctx.clip();
    ctx.strokeStyle='rgba(0,0,0,.18)'; ctx.lineWidth=1; const cols=4, rows=3;
    for(let i=1;i<cols;i++){ const x=r.x+(r.w/cols)*i; ctx.beginPath(); ctx.moveTo(x,r.y); ctx.lineTo(x,r.y+r.h); ctx.stroke(); }
    for(let j=1;j<rows;j++){ const y=r.y+(r.h/rows)*j; ctx.beginPath(); ctx.moveTo(r.x,y); ctx.lineTo(r.x+r.w,y); ctx.stroke(); }
    ctx.restore();
  }
  function drawStitches(ctx,w,h){
    const src=document.getElementById('imgCanvas'); const r=hoopRect(w,h);
    ctx.save(); ctx.beginPath(); rr(ctx,r.x,r.y,r.w,r.h,r.r); ctx.clip();
    try{ ctx.drawImage(src,r.x,r.y,r.w,r.h); }catch{}
    ctx.strokeStyle='rgba(80,80,80,.25)'; const step=Math.max(6, Math.min(r.w,r.h)/28); ctx.lineWidth=1;
    const angleDeg = (()=>{ const el=document.getElementById('dirAngle'); return el?parseFloat(el.value||'45'):45; })();
    const baseAng = showDir ? (Math.PI/180)*angleDeg : Math.PI/4;
    for(let y=r.y; y<r.y+r.h; y+=step){
      ctx.beginPath();
      for(let x=r.x; x<r.x+r.w; x+=step){
        const len=step*0.9, dx=Math.cos(baseAng)*len*0.5, dy=Math.sin(baseAng)*len*0.5;
        ctx.moveTo(x-dx,y-dy); ctx.lineTo(x+dx,y+dy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function render(targetId){
    const can=document.getElementById(targetId); if(!can) return;
    const ctx=can.getContext('2d'); const w=can.width,h=can.height;
    ctx.clearRect(0,0,w,h); drawHoop(ctx,w,h); drawStitches(ctx,w,h);
  }
  window.renderLoomPreview = render;
})();