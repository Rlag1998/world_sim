'use strict';
/* ============================================================================
   THE CHRONICLE ENGINE
   A fully procedural, fully simulated, text-rendered fantasy world.
   Everything below is derived from a single integer seed.
   ========================================================================== */

/* ---------------------------------------------------------------- constants */
const W = 280, H = 160, NT = W * H;          // world grid (wraps in x)
const SEA_TARGET = 0.315;                     // fraction of tiles that are land
const MONTHS = ['Frostmoon','Thawmoon','Seedmoon','Blossom','Longsun','Highsun',
                'Harvestide','Goldfall','Duskmoon','Emberfall','Rimefall','Deepnight'];

/* -------------------------------------------------------------------- maths */
const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
const lerp  = (a,b,t)=> a+(b-a)*t;
const smooth= t=> t*t*(3-2*t);
const sat   = v=> v<0?0:(v>1?1:v);
const sq    = v=> v*v;
function wrapx(x){ x%=W; return x<0?x+W:x; }
function idx(x,y){ return wrapx(x) + y*W; }
function tx(i){ return i % W; }
function ty(i){ return (i / W) | 0; }
/* Latitude in [-1,1]. The grid is an equal-area cylindrical projection: rows
   near the poles cover more degrees each, so the map does not squander a fifth
   of the world on ice nobody will ever live in. */
const LATT=new Float32Array(H);
for(let y=0;y<H;y++) LATT[y]=Math.asin(clamp(1-2*(y+0.5)/H,-1,1))/1.5707963;
function latOf(y){ return LATT[y|0]; }

const N8X=[1,1,0,-1,-1,-1,0,1], N8Y=[0,1,1,1,0,-1,-1,-1];
const N4X=[1,0,-1,0], N4Y=[0,1,0,-1];
const N8D=[1,1.41421,1,1.41421,1,1.41421,1,1.41421];

/* Iterate the 8 neighbours of i, calling f(j, dir). Skips off-world rows. */
function nb8(i,f){
  const x=i%W, y=(i/W)|0;
  for(let d=0;d<8;d++){
    const ny=y+N8Y[d]; if(ny<0||ny>=H) continue;
    f(wrapx(x+N8X[d]) + ny*W, d);
  }
}
function nb4(i,f){
  const x=i%W, y=(i/W)|0;
  for(let d=0;d<4;d++){
    const ny=y+N4Y[d]; if(ny<0||ny>=H) continue;
    f(wrapx(x+N4X[d]) + ny*W, d);
  }
}
/* toroidal-in-x distance */
function dxw(ax,bx){ let d=ax-bx; if(d>W/2)d-=W; if(d<-W/2)d+=W; return d; }
function tdist(a,b){ const dx=dxw(a%W,b%W), dy=((a/W)|0)-((b/W)|0); return Math.sqrt(dx*dx+dy*dy); }
function tdist2(a,b){ const dx=dxw(a%W,b%W), dy=((a/W)|0)-((b/W)|0); return dx*dx+dy*dy; }

/* ------------------------------------------------------------------ hashing */
function h32(a){ a|=0; a=Math.imul(a^(a>>>16),0x21f0aaad); a=Math.imul(a^(a>>>15),0x735a2d97); return (a^(a>>>15))>>>0; }
function h2(x,y,s){ return h32(Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s,2246822519)); }
function h3(x,y,z,s){ return h32(Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647)^Math.imul(s,2246822519)); }
function hashStr(str,seed){
  let h = h32(seed|0) ^ 0x811c9dc5;
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h,0x01000193)>>>0; }
  return h>>>0;
}

/* -------------------------------------------------------------------- PRNGs */
function splitmix32(a){
  return function(){
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a>>>16); t = Math.imul(t,0x21f0aaad);
    t = t ^ (t>>>15);     t = Math.imul(t,0x735a2d97);
    return ((t ^ (t>>>15))>>>0) / 4294967296;
  };
}
/* Named substream: adding a new system never reshuffles the others. */
function stream(seed,name){ return splitmix32(hashStr(name,seed)|0); }

const ri = (r,a,b)=> a + ((r()*(b-a+1))|0);            // inclusive int
const rf = (r,a,b)=> a + r()*(b-a);
const pick = (r,arr)=> arr[(r()*arr.length)|0];
const chance = (r,p)=> r() < p;
function shuffle(r,arr){ for(let i=arr.length-1;i>0;i--){ const j=(r()*(i+1))|0; const t=arr[i];arr[i]=arr[j];arr[j]=t; } return arr; }
function gauss(r,mu,sd){ let u=1-r(),v=r(); return mu + sd*Math.sqrt(-2*Math.log(u))*Math.cos(6.283185307*v); }
function pickW(r,arr,wf){
  let tot=0; for(let i=0;i<arr.length;i++) tot+=Math.max(0,wf(arr[i],i));
  if(tot<=0) return arr[(r()*arr.length)|0];
  let t=r()*tot;
  for(let i=0;i<arr.length;i++){ t-=Math.max(0,wf(arr[i],i)); if(t<=0) return arr[i]; }
  return arr[arr.length-1];
}
function pickIdxW(r,weights){
  let tot=0; for(let i=0;i<weights.length;i++) tot+=Math.max(0,weights[i]);
  if(tot<=0) return (r()*weights.length)|0;
  let t=r()*tot;
  for(let i=0;i<weights.length;i++){ t-=Math.max(0,weights[i]); if(t<=0) return i; }
  return weights.length-1;
}
/* deterministic sample of k distinct items */
function sampleK(r,arr,k){
  const a=arr.slice(); const out=[];
  k=Math.min(k,a.length);
  for(let i=0;i<k;i++){ const j=i+((r()*(a.length-i))|0); const t=a[i];a[i]=a[j];a[j]=t; out.push(a[i]); }
  return out;
}

/* --------------------------------------------------------- cylindrical noise
   x wraps around the world, so we sample noise on a cylinder in 3-space.
   One shuffled permutation table serves the whole world; different callers
   ask for different regions of it by passing an integer offset. Three array
   lookups per lattice corner beats fifteen integer multiplies.               */
let NP=null, NPSEED=null;
function noiseInit(seed){
  if(NPSEED===seed && NP) return;
  const p=new Uint8Array(256);
  for(let i=0;i<256;i++) p[i]=i;
  const r=splitmix32(h32(seed)|0);
  for(let i=255;i>0;i--){ const j=(r()*(i+1))|0; const t=p[i]; p[i]=p[j]; p[j]=t; }
  NP=new Uint8Array(512);
  for(let i=0;i<512;i++) NP[i]=p[i&255];
  NPSEED=seed;
}
const NINV=1/255;
function vn3(x,y,z,off){
  const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
  const xf=smooth(x-xi), yf=smooth(y-yi), zf=smooth(z-zi);
  const X=(xi+off)&255, Y=(yi+off)&255, Z=(zi+off)&255;
  const X1=(X+1)&255, Y1=(Y+1)&255, Z1=(Z+1)&255;
  const A=NP[X]+Y, B=NP[X1]+Y;
  const AA=NP[A&255]+Z, AB=NP[(A+1)&255]+Z, BA=NP[B&255]+Z, BB=NP[(B+1)&255]+Z;
  const c000=NP[AA&255], c010=NP[AB&255], c100=NP[BA&255], c110=NP[BB&255];
  const c001=NP[(AA+1)&255], c011=NP[(AB+1)&255], c101=NP[(BA+1)&255], c111=NP[(BB+1)&255];
  const x00=c000+(c100-c000)*xf, x10=c010+(c110-c010)*xf;
  const x01=c001+(c101-c001)*xf, x11=c011+(c111-c011)*xf;
  const y0=x00+(x10-x00)*yf, y1=x01+(x11-x01)*yf;
  return (y0+(y1-y0)*zf)*NINV;
}
const TAU=6.283185307, NR=W/TAU;
/* fBm sampled on the cylinder for a tile (px,py). freq = cycles around world */
function fbm(px,py,seed,octaves,freq,gain,lac){
  gain=gain||0.5; lac=lac||2.0;
  const ang=px*(TAU/W);
  const ca=Math.cos(ang)*NR, sa=Math.sin(ang)*NR;
  const base=h32(seed)&255;
  let amp=1, tot=0, norm=0, f=freq*0.06;
  for(let o=0;o<octaves;o++){
    tot  += amp * vn3(ca*f, py*f, sa*f, (base+o*37)&255);
    norm += amp; amp*=gain; f*=lac;
  }
  return tot/norm;
}
/* ridged variant for mountain texture */
function ridge(px,py,seed,octaves,freq){
  const ang=px*(TAU/W);
  const ca=Math.cos(ang)*NR, sa=Math.sin(ang)*NR;
  const base=h32(seed^0x9e37)&255;
  let amp=1,tot=0,norm=0,f=freq*0.06;
  for(let o=0;o<octaves;o++){
    const v=Math.abs(vn3(ca*f,py*f,sa*f,(base+o*53)&255)*2-1);
    tot += amp*(1-v); norm+=amp; amp*=0.5; f*=2.1;
  }
  return tot/norm;
}

/* ------------------------------------------------------------- binary heaps */
class MinHeap {
  constructor(cap){ this.k=new Float64Array(cap||1024); this.v=new Int32Array(cap||1024); this.n=0; }
  _grow(){ const k=new Float64Array(this.k.length*2), v=new Int32Array(this.v.length*2);
           k.set(this.k); v.set(this.v); this.k=k; this.v=v; }
  push(key,val){
    if(this.n===this.k.length) this._grow();
    let i=this.n++; this.k[i]=key; this.v[i]=val;
    while(i>0){ const p=(i-1)>>1; if(this.k[p]<=this.k[i]) break;
      const tk=this.k[p];this.k[p]=this.k[i];this.k[i]=tk;
      const tv=this.v[p];this.v[p]=this.v[i];this.v[i]=tv; i=p; }
  }
  pop(){
    const top=this.v[0], tk=this.k[0];
    this.n--;
    if(this.n>0){
      this.k[0]=this.k[this.n]; this.v[0]=this.v[this.n];
      let i=0;
      for(;;){ const l=2*i+1,r=l+1; let m=i;
        if(l<this.n&&this.k[l]<this.k[m])m=l;
        if(r<this.n&&this.k[r]<this.k[m])m=r;
        if(m===i)break;
        const a=this.k[m];this.k[m]=this.k[i];this.k[i]=a;
        const b=this.v[m];this.v[m]=this.v[i];this.v[i]=b; i=m; }
    }
    this._k=tk; return top;
  }
  get size(){ return this.n; }
}

/* ----------------------------------------------------------------- strings  */
function cap(s){ return s? s.charAt(0).toUpperCase()+s.slice(1) : s; }
function roman(n){
  if(n<1) return '';
  const v=[1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const s=['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let out=''; for(let i=0;i<v.length;i++) while(n>=v[i]){ out+=s[i]; n-=v[i]; }
  return out;
}
function commify(n){
  n=Math.round(n);
  if(Math.abs(n)>=1e9) return (n/1e9).toFixed(2)+'B';
  if(Math.abs(n)>=1e6) return (n/1e6).toFixed(2)+'M';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');
}
function pct(v){ return Math.round(v*100)+'%'; }
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function ordinal(n){
  const s=['th','st','nd','rd'], v=n%100;
  return n+(s[(v-20)%10]||s[v]||s[0]);
}
function listify(a){
  if(!a.length) return '';
  if(a.length===1) return a[0];
  if(a.length===2) return a[0]+' and '+a[1];
  return a.slice(0,-1).join(', ')+', and '+a[a.length-1];
}
function plural(n,s,p){ return n===1? '1 '+s : commify(n)+' '+(p||s+'s'); }

/* ----------------------------------------------------------------- palettes */
/* Colour is quantised to a fixed palette so the glyph atlas stays small.      */
const PAL = [];
function palAdd(hex){ PAL.push(hex); return PAL.length-1; }
function mixHex(a,b,t){
  const ar=(a>>16)&255, ag=(a>>8)&255, ab=a&255;
  const br=(b>>16)&255, bg=(b>>8)&255, bb=b&255;
  return (((ar+(br-ar)*t)|0)<<16) | (((ag+(bg-ag)*t)|0)<<8) | ((ab+(bb-ab)*t)|0);
}
function hexs(v){ return '#'+('000000'+(v>>>0).toString(16)).slice(-6); }
/* build a ramp of n colours between hex a and b, return the first index */
function palRamp(a,b,n){
  const start=PAL.length;
  for(let i=0;i<n;i++) palAdd(mixHex(a,b,n===1?0:i/(n-1)));
  return start;
}
/* HSL -> RGB int, used for the many distinct polity / culture colours */
function hsl(h,s,l){
  h=((h%1)+1)%1;
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs(((h*6)%2)-1)), m=l-c/2;
  let r,g,b;
  const seg=(h*6)|0;
  if(seg===0){r=c;g=x;b=0} else if(seg===1){r=x;g=c;b=0} else if(seg===2){r=0;g=c;b=x}
  else if(seg===3){r=0;g=x;b=c} else if(seg===4){r=x;g=0;b=c} else {r=c;g=0;b=x}
  return (((r+m)*255|0)<<16)|(((g+m)*255|0)<<8)|(((b+m)*255)|0);
}

/* --------------------------------------------------------- small containers */
/* Bounded ring of recent items, used for per-entity event indices. */
function ringPush(arr,v,max){ arr.push(v); if(arr.length>max) arr.shift(); return arr; }

/* Sorted top-K without full sort. */
function topK(items,k,score){
  const out=[];
  for(let i=0;i<items.length;i++){
    const s=score(items[i]); if(s===null||s===undefined||s!==s) continue;
    if(out.length<k){ out.push([s,items[i]]); if(out.length===k) out.sort((a,b)=>b[0]-a[0]); }
    else if(s>out[k-1][0]){
      out[k-1]=[s,items[i]];
      for(let j=k-1;j>0&&out[j][0]>out[j-1][0];j--){ const t=out[j];out[j]=out[j-1];out[j-1]=t; }
    }
  }
  if(out.length<k) out.sort((a,b)=>b[0]-a[0]);
  return out.map(o=>o[1]);
}
