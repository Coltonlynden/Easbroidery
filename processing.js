// Export uses imgCanvas; if empty, draws from <img> first
(function () {
  const IMG_CAN = document.getElementById('imgCanvas');
  const MASK_CAN= document.getElementById('maskCanvas');
  const IMG_EL  = document.getElementById('imgLayer');

  function grabImageData(){
    const w = IMG_CAN.width, h = IMG_CAN.height;
    const ctx = IMG_CAN.getContext('2d');
    try {
      const px = ctx.getImageData(0,0,1,1).data[3];
      if (IMG_EL && IMG_EL.src && px===0) ctx.drawImage(IMG_EL, 0, 0, w, h);
    } catch {}
    return ctx.getImageData(0,0,w,h);
  }

  window.convertToEmbroidery = function (){
    const w = IMG_CAN.width, h = IMG_CAN.height; if (!w||!h) return;
    const imgData  = grabImageData();
    const maskData = MASK_CAN.getContext('2d').getImageData(0,0,w,h);
    // TODO: plug into your real pipeline
    console.log('convert stub', {w,h,imgBytes:imgData.data.length, maskBytes:maskData.data.length});
  };

  document.getElementById('btnConvert')?.addEventListener('click', window.convertToEmbroidery);
})();