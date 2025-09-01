window.EAS = {
  state:{
    img:null, hasImage:false, hasMask:false,

    brushSize:26,
    tool:"brush",                 // brush | erase | wand
    brushMode:"mask",             // mask | text | dir

    text:{content:"", size:56, curve:0, x:512, y:940, dragging:false, dx:0, dy:0},

    stitches:null,
    scale:1, zoom:1, panX:0, panY:0,
    undo:[], redo:[],

    // direction + pattern maps
    dirAngle:45,                      // current brush angle
    dirPattern:"fill",                // fill | satin | cross
    dirMap:new Uint8Array(1024*1024), // angle bin (0..180), 255 = unset
    patMap:new Uint8Array(1024*1024)  // 0=fill 1=satin 2=cross 255=unset
  },
  setBrushMode(mode){
    const panels={mask:"panel-mask", text:"panel-text", dir:"panel-dir"};
    EAS.state.brushMode=mode;
    for(const k of Object.keys(panels)){
      document.getElementById(panels[k]).classList.toggle("hidden", k!==mode);
    }
    document.querySelectorAll(".chip").forEach(c=>c.classList.remove("chip--active"));
    ({mask:"mode-mask", text:"mode-text", dir:"mode-dir"}[mode] && document.getElementById({mask:"mode-mask", text:"mode-text", dir:"mode-dir"}[mode]).classList.add("chip--active"));
  }
};