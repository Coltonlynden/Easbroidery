// Centralized upload with guaranteed visual update
(function(){
  const main = document.getElementById('fileInput');
  const imgLayer = document.getElementById('imgLayer');

  function fileToDataURL(file){
    return new Promise((resolve, reject)=>{
      const fr = new FileReader();
      fr.onload = ()=> resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  async function onMainChange(e){
    const f = e.target.files?.[0]; if(!f) return;
    try{
      const dataUrl = await fileToDataURL(f);
      if (imgLayer){ imgLayer.src = dataUrl; imgLayer.style.opacity='1'; }
      const img = new Image(); img.src = dataUrl;
      if (img.decode){ try{ await img.decode(); }catch{} }
      window.dispatchEvent(new CustomEvent('editor:imageLoaded', { detail:{ img, file:f, dataUrl } }));
    } finally {
      e.target.value = '';
    }
  }

  main?.addEventListener('change', onMainChange);
})();