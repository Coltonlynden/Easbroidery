// small helper to get a quick palette from an image (k-means lite)
window.EAS = window.EAS || {};
EAS.colors = {
  quantize(imgData, k=6){
    const {data,w,h} = imgData, N=w*h, S=4;
    let pts=[]; pts.length=0;
    for(let i=0;i<N;i+=Math.max(1,Math.floor(N/4000))){
      const j=i*4; pts.push([data[j],data[j+1],data[j+2]]);
    }
    // init centers
    const C=pts.slice(0,k);
    for(let iter=0;iter<8;iter++){
      const sum=Array.from({length:k},()=>[0,0,0,0]);
      for(const p of pts){
        let bi=0,bd=1e9;
        for(let c=0;c<k;c++){
          const d=(p[0]-C[c][0])**2+(p[1]-C[c][1])**2+(p[2]-C[c][2])**2;
          if(d<bd){bd=d;bi=c;}
        }
        const s=sum[bi]; s[0]+=p[0]; s[1]+=p[1]; s[2]+=p[2]; s[3]++;
      }
      for(let c=0;c<k;c++){ if(sum[c][3]) C[c]=[sum[c][0]/sum[c][3]|0,sum[c][1]/sum[c][3]|0,sum[c][2]/sum[c][3]|0]; }
    }
    return C;
  }
};