// worker.js
self.onmessage = async (e)=>{
  const msg = e.data||{};
  if (msg.type!=='convert') return;
  const {w,h,img,mask} = msg;

  // compute stitches from img+mask (placeholder)
  // avoid OffscreenCanvas for Safari/iOS unless available
  let stitches = [];
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(w,h);
      const cx = c.getContext('2d');
      const id = new ImageData(new Uint8ClampedArray(img.data), w, h);
      cx.putImageData(id,0,0);
      // … your algorithm …
    } else {
      // operate directly on img.data / mask.data
      // … your algorithm …
    }
  } catch (err) {
    // fail safe
    stitches = [];
  }
  self.postMessage({type:'result', stitches});
};