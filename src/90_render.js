/* ============================================================================
   PART XI — THE MAP
   A monospaced glyph field for texture, with real cartography drawn over it:
   inked coastlines, rivers that taper with their discharge, political borders
   that follow the actual frontier, settlement marks sized by rank, and labels
   that get out of each other's way.
   ========================================================================== */

let MAPDIRTY=true, VIEWDIRTY=true;
let ZOOM=1, CAMX=0, CAMY=0;
const ZOOMS=[[4,6],[6,9],[9,14],[13,20],[19,29]];
let MODE='terrain';
let SHOWLABELS=true, SHOWGRID=false;
const KM_PER_TILE=42;

const MAPMODES=[
 {k:'terrain',  n:'LAND',    d:'the world as it is: seas, forests, mountains, rivers'},
 {k:'political',n:'REALMS',  d:'who holds what — borders are drawn where rule actually changes'},
 {k:'culture',  n:'PEOPLES', d:'which people live where, and where their tongues have split'},
 {k:'faith',    n:'GODS',    d:'faiths and their holy ground'},
 {k:'pop',      n:'FOLK',    d:'where the people are'},
 {k:'trade',    n:'TRADE',   d:'wealth, and the roads that carried it there'},
 {k:'unrest',   n:'UNREST',  d:'discontent and burned ground'},
 {k:'war',      n:'WAR',     d:'realms in arms, hosts in the field, land laid waste'},
 {k:'magic',    n:'POWER',   d:'the leylines — fading, and the scars of the Elder Age'},
 {k:'temp',     n:'CLIMATE', d:'mean annual temperature'},
 {k:'rain',     n:'RAINS',   d:'rainfall — note the dry side of every range'},
 {k:'res',      n:'RICHES',  d:'ore, timber, salt, horses and stranger things'},
 {k:'relief',   n:'RELIEF',  d:'height of the land and depth of the sea'},
 {k:'legend',   n:'LEGENDS', d:'ruins, and the wounds the Powers left'}
];
const MODEBYK={}; MAPMODES.forEach(m=>MODEBYK[m.k]=m);

/* ------------------------------------------------- cartographic palette ---- */
/* Land is warm and legible; the sea is cold and quiet so the coast reads. */
const LANDCOL=new Int32Array(NBIOME);
(function(){
  const C={};
  C[B_GLACIER]=0xdfe9f0; C[B_TUNDRA]=0x8d9585; C[B_TAIGA]=0x3f6b52;
  C[B_BOG]=0x5d6d55;     C[B_TFOREST]=0x4f8046; C[B_TRAINFOREST]=0x3f7a5a;
  C[B_STEPPE]=0xb3ab6d;  C[B_PRAIRIE]=0x9cb058; C[B_SHRUB]=0xa89f5f;
  C[B_DESERT]=0xd0b273;  C[B_COLDDESERT]=0xa39d8b; C[B_SAVANNA]=0xbcae5f;
  C[B_MONSOON]=0x5b9245; C[B_JUNGLE]=0x3f8a3c;  C[B_MARSH]=0x6d8259;
  C[B_MANGROVE]=0x53875f;C[B_ALPINE]=0x92987f;  C[B_BARREN]=0xa89c8c;
  C[B_VOLCANIC]=0x8a6156;C[B_SALT]=0xe2dcc4;    C[B_BADLAND]=0xb07b53;
  C[B_ICECAP]=0xd6e4ec;
  for(let b=0;b<NBIOME;b++) LANDCOL[b]= C[b]!==undefined? C[b] : BIOME[b].c;
})();
/* sea bands, shore -> abyss */
const SEACOL=[0x2d6a86,0x235a76,0x1b4a63,0x143a50,0x0f2e40,0x0b2434,0x081b28,0x06141e];
const INK=0x07100f;

/* glyph carries landform, colour carries biome */
const LANDGLYPH=new Array(NBIOME);
(function(){
  const G={};
  G[B_GLACIER]='*'; G[B_ICECAP]='*';
  G[B_TUNDRA]='"';  G[B_TAIGA]='♣'; G[B_BOG]=',';
  G[B_TFOREST]='♠'; G[B_TRAINFOREST]='♠'; G[B_MONSOON]='♣'; G[B_JUNGLE]='♣';
  G[B_STEPPE]='"';  G[B_PRAIRIE]='"'; G[B_SHRUB]='`';
  G[B_DESERT]=':';  G[B_COLDDESERT]=':'; G[B_SAVANNA]='"';
  G[B_MARSH]=',';   G[B_MANGROVE]=','; G[B_SALT]='=';
  G[B_ALPINE]='^';  G[B_BARREN]='▲'; G[B_VOLCANIC]='△'; G[B_BADLAND]='∴';
  for(let b=0;b<NBIOME;b++) LANDGLYPH[b]= G[b]||'·';
})();

/* ------------------------------------------------------------ glyph atlas   */
/* The cell's fill carries the information; the glyph only carries texture and
   is drawn in one of sixteen fixed inks. That keeps the atlas static — 16 rows
   baked once per zoom — instead of re-baking a row for every shade on screen,
   which is the difference between three seconds a frame and three milliseconds. */
const NINK=16;
const INKS=new Int32Array(NINK);
(function(){ for(let k=0;k<NINK;k++) INKS[k]=mixHex(0x0a0f0e,0xf4efe0,k/(NINK-1)); })();
const ATL={cv:null,cx:null,cw:0,ch:0,glyphs:[],gi:new Map()};
const MONOFONT='ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,"Liberation Mono",monospace';
function atlasInit(cw,ch){
  ATL.cw=cw; ATL.ch=ch;
  ATL.glyphs=[' ','·','.',':','"','\'','`','~','≈','^','▲','△','♠','♣','░','▒','▓','█',
              '*','#','+','-','|','o','O','⌂','◙','■','◊','†','‡','∆','×','⚔','=','∴','●','◦','≡'];
  ATL.gi.clear();
  ATL.glyphs.forEach((g,i)=>{ if(!ATL.gi.has(g)) ATL.gi.set(g,i); });
  ATL.cv=document.createElement('canvas');
  ATL.cv.width=ATL.glyphs.length*cw;
  ATL.cv.height=ch*NINK;
  ATL.cx=ATL.cv.getContext('2d');
  ATL.cx.textBaseline='middle'; ATL.cx.textAlign='center';
  ATL.cx.font=Math.floor(ch*0.84)+'px '+MONOFONT;
  for(let k=0;k<NINK;k++){
    ATL.cx.fillStyle=hexs(INKS[k]);
    const y=k*ch;
    for(let i=0;i<ATL.glyphs.length;i++)
      ATL.cx.fillText(ATL.glyphs[i], i*cw+cw/2, y+ch/2+0.5);
  }
}
/* pick an ink that contrasts with the cell it sits on */
function inkRow(c){
  const lum=(((c>>16)&255)*0.30+((c>>8)&255)*0.59+(c&255)*0.11)/255;
  const t = lum>0.42? lum-0.30 : lum+0.34;
  return clamp((t*(NINK-1))|0,0,NINK-1);
}
function gidx(g){ const i=ATL.gi.get(g); return i===undefined?0:i; }

/* -------------------------------------------------------------- shading     */
function shade(c,f){
  const r=(c>>16)&255,g=(c>>8)&255,b=c&255;
  return (clamp(r*f,0,255)|0)<<16 | (clamp(g*f,0,255)|0)<<8 | (clamp(b*f,0,255)|0);
}
function ramp(t,stops){
  t=clamp(t,0,1);
  const n=stops.length-1, i=Math.min(n-1,(t*n)|0), f=t*n-i;
  return mixHex(stops[i],stops[i+1],f);
}
const RP_HEAT=[0x1b2f66,0x2472a0,0x3aa877,0xcfc558,0xd8802f,0xa8291c];
const RP_GOLD=[0x2b2010,0x66481a,0xa87f28,0xd8b247,0xf6e19a];
const RP_BLOOD=[0x241310,0x662016,0xa63524,0xd96438,0xf2b07a];
const RP_ARC=[0x1a1638,0x352472,0x6444bc,0x9a74e4,0xdcccff];
const RP_GREEN=[0x16240f,0x2b5320,0x4d8c33,0x86c352,0xdcea90];

/* two distinguishable dozen realm colours, plus a greedy anti-clash pass */
const REALMPAL=[
 0xc4553f,0xd08a3a,0xc9b44a,0x8fae4a,0x4f9b58,0x3f9d86,0x4a8fb8,0x5f7ec9,
 0x8a6fc9,0xb163bd,0xc45d92,0xb8555f,0x9a7048,0x6f8f6a,0x4a7f9a,0x8a8fb0,
 0xd4a06a,0xa8c46a,0x6ac4a8,0x6aa8d4,0xa88ad4,0xd48ab8,0xb0724a,0x7a9a5a];
let COLORSTAMP=-1;
function assignRealmColours(){
  const live=POLS.filter(p=>p.alive);
  if(!live.length) return;
  /* who touches whom */
  const adj=new Map();
  for(const p of live) adj.set(p.id,new Set());
  for(let y=0;y<H;y++) for(let x=0;x<W;x+=1){
    const i=x+y*W, o=T.owner[i];
    if(o<0||!adj.has(o)) continue;
    if(x<W-1){ const q=T.owner[i+1]; if(q>=0&&q!==o&&adj.has(q)){ adj.get(o).add(q); adj.get(q).add(o); } }
    if(y<H-1){ const q=T.owner[i+W]; if(q>=0&&q!==o&&adj.has(q)){ adj.get(o).add(q); adj.get(q).add(o); } }
  }
  live.sort((a,b)=>(adj.get(b.id).size-adj.get(a.id).size)||(a.id-b.id));
  for(const p of live){
    const taken=new Set();
    for(const q of adj.get(p.id)){ const o=POLS[q]; if(o&&o._ci!==undefined) taken.add(o._ci); }
    let want = p._ci!==undefined? p._ci : (hashStr('c'+p.id+p.name,SEEDV)%REALMPAL.length);
    if(taken.has(want)){
      for(let k=0;k<REALMPAL.length;k++){ const t=(want+k*7)%REALMPAL.length; if(!taken.has(t)){ want=t; break; } }
    }
    p._ci=want; p.color=REALMPAL[want];
  }
  COLORSTAMP=YEAR;
}

/* A neutral, relief-shaded ground for the thematic maps, so a realm's colour
   means the same thing over a forest as over a desert. */
function parchment(i){
  let nw=0; const x=i%W,y=(i/W)|0;
  if(y>0) nw=T.alt[wrapx(x-1)+(y-1)*W];
  const relief=clamp((T.alt[i]-nw)*6,-0.3,0.3);
  return shade(0xa89c84, 0.62+0.42*T.alt[i]+relief);
}

/* At world scale we paint one pixel per tile into an offscreen image and
   scale it up. Forty-five thousand pixels beats fifty thousand fillRects. */
const BLIT={cv:null,cx:null,img:null,stampMode:'',stampYear:-1};
function blitColours(cols,rows,cw,ch){
  if(!BLIT.cv){
    BLIT.cv=document.createElement('canvas'); BLIT.cv.width=W; BLIT.cv.height=H;
    BLIT.cx=BLIT.cv.getContext('2d');
    BLIT.img=BLIT.cx.createImageData(W,H);
  }
  if(BLIT.stampMode!==MODE || BLIT.stampYear!==YEAR){
    const d=BLIT.img.data;
    for(let i=0;i<NT;i++){
      cellOf(i,_cell);
      const c=_cell[1], o=i*4;
      d[o]=(c>>16)&255; d[o+1]=(c>>8)&255; d[o+2]=c&255; d[o+3]=255;
    }
    BLIT.cx.putImageData(BLIT.img,0,0);
    BLIT.stampMode=MODE; BLIT.stampYear=YEAR;
  }
  CTX.imageSmoothingEnabled=false;
  const sy=Math.max(0,CAMY), dy=(sy-CAMY)*ch;
  const sh=Math.min(H-sy,rows-(sy-CAMY));
  /* the world wraps, so the view may need two blits side by side */
  const first=Math.min(cols, W-CAMX);
  CTX.drawImage(BLIT.cv, CAMX,sy,first,sh, 0,dy,first*cw,sh*ch);
  if(first<cols)
    CTX.drawImage(BLIT.cv, 0,sy,cols-first,sh, first*cw,dy,(cols-first)*cw,sh*ch);
}

/* ------------------------------------------------------------ cell painter  */
function cellOf(i,out){
  const land=T.land[i];
  const b=T.biome[i];
  let g,c;
  if(!land){
    /* quiet, banded water: the eye should read the coast, not the ocean */
    const d=Math.min(7,Math.max(0,T.distLand[i]-1));
    c=SEACOL[d];
    if(T.lake[i]){ c=0x2f7398; g='~'; }
    else g = d===0? '~' : (d<3? '·' : ' ');
    if(b===B_ICECAP){ c=0xc2d4de; g='*'; }
  }else{
    c=LANDCOL[b];
    g=LANDGLYPH[b];
    /* hillshade: light from the north-west, so ranges read as ranges */
    let nw=0; const x=i%W,y=(i/W)|0;
    if(y>0) nw=T.alt[wrapx(x-1)+(y-1)*W];
    const relief=clamp((T.alt[i]-nw)*6,-0.35,0.35);
    c=shade(c, 0.80 + 0.34*T.alt[i] + relief);
    if(T.alt[i]>0.44&&b!==B_GLACIER) g='▲';
    else if(T.alt[i]>0.26&&g==='·') g='^';
  }
  switch(MODE){
    case 'terrain': break;
    case 'political': {
      const o=T.owner[i];
      if(land){
        if(o>=0&&POLS[o]){
          const p=POLS[o];
          c=mixHex(parchment(i), p.color, p.liege>=0? 0.70 : 0.84);
        }else c=shade(parchment(i),0.72);
      }
      break; }
    case 'culture': {
      const u=T.cult[i]>=0? T.cult[i] : (T.dom[i]>=0&&SITES[T.dom[i]]? SITES[T.dom[i]].culture : -1);
      if(land) c = u>=0? mixHex(parchment(i),CULTURES[u].color,0.82) : shade(parchment(i),0.7);
      break; }
    case 'faith': {
      const f=T.faith[i]>=0? T.faith[i] : (T.dom[i]>=0&&SITES[T.dom[i]]? SITES[T.dom[i]].faith : -1);
      if(land){
        c = f>=0&&FAITHS[f]? mixHex(parchment(i),FAITHS[f].color,0.82) : shade(parchment(i),0.7);
        if(f>=0&&FAITHS[f]&&FAITHS[f].holy.indexOf(i)>=0){ g='†'; c=0xffe9a8; }
      }
      break; }
    case 'pop': {
      if(land){
        const d=T.dom[i]>=0? SITES[T.dom[i]] : null;
        const v=d&&d.alive? clamp(Math.log(1+d.pop)/12,0,1)*(T.fert[i]*0.5+0.5) : 0;
        c=mixHex(shade(c,0.30),ramp(v,RP_GOLD),clamp(0.25+v,0,1));
        g= v>0.62?'▓': v>0.38?'▒': v>0.14?'░':'·';
      }
      break; }
    case 'trade': {
      if(land){
        const d=T.dom[i]>=0? SITES[T.dom[i]] : null;
        const v=d&&d.alive? clamp(d.wealth/700,0,1):0;
        c=mixHex(shade(c,0.28),ramp(v,RP_GOLD),clamp(0.2+v,0,1)); g='·';
      }
      break; }
    case 'unrest': {
      if(land){
        const d=T.dom[i]>=0? SITES[T.dom[i]] : null;
        const v=Math.max(d&&d.alive? clamp(d.unrest/1.2,0,1):0, clamp(T.dev[i],0,1));
        c=mixHex(shade(c,0.28),ramp(v,RP_BLOOD),clamp(0.2+v,0,1));
        g= v>0.6?'▓':v>0.3?'▒':'·';
      }
      break; }
    case 'war': {
      if(land){
        const o=T.owner[i];
        let v=0;
        if(o>=0&&POLS[o]&&POLS[o].wars.some(wid=>WARS[wid]&&WARS[wid].ended<0)) v=0.55;
        v=Math.max(v,clamp(T.dev[i],0,1));
        c = v>0? mixHex(shade(c,0.30),ramp(v,RP_BLOOD),clamp(0.3+v,0,1)) : shade(c,0.34);
        g= v>0.55?'▒':'·';
      }
      break; }
    case 'magic': {
      const v=clamp(T.ley[i]*MAGIC/1.2,0,1);
      const base = land? shade(c,0.26) : 0x081020;
      c=mixHex(base, ramp(v,RP_ARC), clamp(0.20+v*1.1,0,1));
      g= v>0.7?'▓': v>0.45?'▒': v>0.22?'░':(land?'·':' ');
      if(T.scar[i]){ g='∆'; c=mixHex(c,0xff9060,0.45); }
      break; }
    case 'temp': {
      const v=clamp((T.temp[i]+CLIMATE_ANOM+28)/62,0,1);
      c=ramp(v,RP_HEAT); g=land?'▒':'·';
      break; }
    case 'rain': {
      if(land){ const v=clamp(T.rain[i]/2600,0,1);
        c=ramp(v,RP_GREEN); g= v>0.6?'▓':v>0.3?'▒':'░'; }
      break; }
    case 'res': {
      if(land){
        c=shade(c,0.30); g='·';
        if(T.res[i]){ g='◊'; c=RESCOL(T.res[i]); }
      }else if(T.res[i]===R_FISH){ g='◊'; c=0x6ec0d0; }
      break; }
    case 'relief': {
      if(land){
        const v=clamp(T.alt[i],0,1);
        c=ramp(v,[0x2f5a34,0x74864a,0xac9560,0xc9bcae,0xf2f2f2]);
        let nw=0; const x=i%W,y=(i/W)|0; if(y>0) nw=T.alt[wrapx(x-1)+(y-1)*W];
        c=shade(c,0.86+clamp((T.alt[i]-nw)*7,-0.3,0.4));
        g= v>0.55?'▲': v>0.32?'^': '·';
      }else{ const d=Math.min(7,Math.max(0,T.distLand[i]-1)); c=SEACOL[d]; g=' '; }
      break; }
    case 'legend': {
      c = land? shade(c,0.22) : shade(SEACOL[Math.min(7,Math.max(0,T.distLand[i]-1))],0.55);
      g = land?'·':' ';
      if(T.scar[i]){ c=ramp(0.72,RP_ARC); g='∆'; }
      if(T.ruin[i]>=0){ c=0xd8bd7c; g='‡'; }
      break; }
  }
  if(T.ruin[i]>=0&&MODE!=='temp'&&MODE!=='rain'&&MODE!=='relief'){ g='‡'; c=mixHex(c,0xd8bd7c,0.8); }
  out[0]=g; out[1]=c;
}
function RESCOL(r){
  switch(r){
    case R_IRON: return 0x9aa0a8; case R_COPPER: return 0xc07a44; case R_TIN: return 0xa8a090;
    case R_SILVER: return 0xd8dde4; case R_GOLD: return 0xe8c24a; case R_GEMS: return 0xd06ad0;
    case R_SALT: return 0xe0e0d0; case R_HORSES: return 0xb08a50; case R_TIMBER: return 0x4a8a3a;
    case R_STONE: return 0x9a9a92; case R_FURS: return 0x8a6a4a; case R_SPICE: return 0xd08a30;
    case R_SILK: return 0xd0a0c0; case R_VINES: return 0x9a3a5a; case R_AMBER: return 0xe0a040;
    case R_STARMETAL: return 0xa0e0ff; case R_MARBLE: return 0xe8e8e0; case R_COAL: return 0x50504a;
    case R_OBSIDIAN: return 0x50406a; case R_PEARL: return 0xe0e8f0; case R_WHALE: return 0x6a8aa0;
    case R_SULFUR: return 0xd0d040; case R_FISH: return 0x6ec0d0;
  }
  return 0x888888;
}

/* -------------------------------------------------------------- draw        */
let CAN=null, CTX=null, MINI=null, MCTX=null, MIMG=null;
const _cell=[null,0];
function renderInit(){
  CAN=document.getElementById('map'); CTX=CAN.getContext('2d',{alpha:false});
  MINI=document.getElementById('minimap'); MCTX=MINI.getContext('2d');
  atlasInit(ZOOMS[ZOOM][0],ZOOMS[ZOOM][1]);
}
function resizeMap(){
  const wrap=document.getElementById('mapwrap');
  const dpr=Math.min(2,window.devicePixelRatio||1);
  CAN.width=Math.floor(wrap.clientWidth*dpr);
  CAN.height=Math.floor(wrap.clientHeight*dpr);
  CAN.style.width=wrap.clientWidth+'px';
  CAN.style.height=wrap.clientHeight+'px';
  CTX.setTransform(dpr,0,0,dpr,0,0);
  CTX.imageSmoothingEnabled=false;
  VIEWDIRTY=true;
}
function viewCols(){ return Math.ceil(CAN.clientWidth/ATL.cw)+1; }
function viewRows(){ return Math.ceil(CAN.clientHeight/ATL.ch)+1; }
function clampCam(){
  CAMY=clamp(CAMY,-2,Math.max(-2,H-viewRows()+2));
  CAMX=wrapx(CAMX);
}
/* screen position of a tile, or null if off-view */
function scr(tile,cols,rows){
  const x=tile%W, y=(tile/W)|0;
  let rx=x-CAMX; rx=((rx%W)+W)%W;
  const ry=y-CAMY;
  if(rx<-1||rx>cols+1||ry<-1||ry>rows+1) return null;
  return [rx*ATL.cw, ry*ATL.ch];
}

function drawMap(){
  if(!CAN||!T.biome) return;
  const cw=ATL.cw, ch=ATL.ch;
  const cols=viewCols(), rows=viewRows();
  clampCam();
  if(MODE==='political'&&(YEAR-COLORSTAMP>=5||COLORSTAMP<0)) assignRealmColours();

  CTX.fillStyle='#05080c';
  CTX.fillRect(0,0,CAN.clientWidth,CAN.clientHeight);

  /* ---- 1. the ground ------------------------------------------------- */
  const atl=ATL.cv;
  const DETAIL = cw>=8;                 /* below this a glyph is a smudge */
  if(!DETAIL){
    blitColours(cols,rows,cw,ch);
  }else{
    for(let ry=0;ry<rows;ry++){
      const y=CAMY+ry; if(y<0||y>=H) continue;
      const py=ry*ch;
      for(let rx=0;rx<cols;rx++){
        const i=wrapx(CAMX+rx)+y*W;
        cellOf(i,_cell);
        const col=_cell[1];
        CTX.fillStyle=hexs(_cell[0]===' '? col : shade(col,0.62));
        CTX.fillRect(rx*cw,py,cw+0.6,ch+0.6);
        if(_cell[0]!==' ')
          CTX.drawImage(atl,gidx(_cell[0])*cw,inkRow(col)*ch,cw,ch, rx*cw,py,cw,ch);
      }
    }
  }

  /* ---- 2. inked coastline -------------------------------------------- */
  if(DETAIL){
  const coast=new Path2D();
  for(let ry=-1;ry<=rows;ry++){
    const y=CAMY+ry; if(y<0||y>=H) continue;
    for(let rx=-1;rx<=cols;rx++){
      const x=wrapx(CAMX+rx), i=x+y*W;
      if(!T.land[i]) continue;
      const px=rx*cw, py=ry*ch;
      if(y>0     && !T.land[x+(y-1)*W])          { coast.moveTo(px,py);       coast.lineTo(px+cw,py); }
      if(y<H-1   && !T.land[x+(y+1)*W])          { coast.moveTo(px,py+ch);    coast.lineTo(px+cw,py+ch); }
      if(!T.land[wrapx(x-1)+y*W])                { coast.moveTo(px,py);       coast.lineTo(px,py+ch); }
      if(!T.land[wrapx(x+1)+y*W])                { coast.moveTo(px+cw,py);    coast.lineTo(px+cw,py+ch); }
    }
  }
  CTX.lineWidth=Math.max(1,cw*0.13);
  CTX.strokeStyle='rgba(9,17,20,.85)';
  CTX.stroke(coast);
  }

  /* ---- 3. rivers, tapering with discharge ---------------------------- */
  if(MODE!=='temp'&&MODE!=='magic'){
    const wide=new Path2D(), thin=new Path2D();
    const onlyBig=!DETAIL;
    for(let ry=-1;ry<=rows;ry++){
      const y=CAMY+ry; if(y<0||y>=H) continue;
      for(let rx=-1;rx<=cols;rx++){
        const x=wrapx(CAMX+rx), i=x+y*W;
        if(!T.land[i]||T.flow[i]<=0) continue;
        if(onlyBig&&T.flow[i]<=RIVBIG) continue;
        const d=T.fdir[i]; if(d<0) continue;
        const ny=y+N8Y[d]; if(ny<0||ny>=H) continue;
        const p=(T.flow[i]>RIVBIG)? wide : thin;
        p.moveTo(rx*cw+cw/2, ry*ch+ch/2);
        p.lineTo((rx+N8X[d])*cw+cw/2, (ry+N8Y[d])*ch+ch/2);
      }
    }
    CTX.lineCap='round';
    CTX.strokeStyle='rgba(88,168,208,.75)'; CTX.lineWidth=Math.max(1,cw*0.16); CTX.stroke(thin);
    CTX.strokeStyle='rgba(110,190,224,.95)'; CTX.lineWidth=Math.max(1.4,cw*0.30); CTX.stroke(wide);
    CTX.lineCap='butt';
  }

  /* ---- 4. lakes get an outline too ----------------------------------- */
  /* ---- 5. frontiers --------------------------------------------------- */
  const bmode = MODE==='political'? 'owner' : (MODE==='culture'? 'cult' : (MODE==='faith'? 'faith' : (MODE==='war'? 'owner':null)));
  if(bmode){
    const key=(i)=>{
      if(!T.land[i]) return -1;
      if(bmode==='owner') return T.owner[i];
      if(bmode==='cult')  return T.cult[i]>=0?T.cult[i]:(T.dom[i]>=0&&SITES[T.dom[i]]?SITES[T.dom[i]].culture:-1);
      return T.faith[i]>=0?T.faith[i]:(T.dom[i]>=0&&SITES[T.dom[i]]?SITES[T.dom[i]].faith:-1);
    };
    const b1=new Path2D(), b2=new Path2D();
    for(let ry=-1;ry<=rows;ry++){
      const y=CAMY+ry; if(y<0||y>=H) continue;
      for(let rx=-1;rx<=cols;rx++){
        const x=wrapx(CAMX+rx), i=x+y*W;
        const a=key(i); if(a<0) continue;
        const px=rx*cw, py=ry*ch;
        const suz = bmode==='owner'&&POLS[a]? realmOf(POLS[a]).id : a;
        const edge=(j,x1,y1,x2,y2)=>{
          const q=key(j); if(q===a) return;
          const qs = (bmode==='owner'&&q>=0&&POLS[q])? realmOf(POLS[q]).id : q;
          const p = (qs!==suz)? b1 : b2;      /* realm frontier vs internal march */
          p.moveTo(x1,y1); p.lineTo(x2,y2);
        };
        if(y>0)   edge(x+(y-1)*W, px,py, px+cw,py);
        if(y<H-1) edge(x+(y+1)*W, px,py+ch, px+cw,py+ch);
        edge(wrapx(x-1)+y*W, px,py, px,py+ch);
        edge(wrapx(x+1)+y*W, px+cw,py, px+cw,py+ch);
      }
    }
    CTX.strokeStyle='rgba(28,20,10,.55)'; CTX.lineWidth=Math.max(1,cw*0.16); CTX.stroke(b2);
    CTX.strokeStyle='rgba(20,14,8,.9)';   CTX.lineWidth=Math.max(2,cw*0.30); CTX.stroke(b1);
    CTX.strokeStyle='rgba(246,232,190,.75)'; CTX.lineWidth=Math.max(1,cw*0.11); CTX.stroke(b1);
  }

  /* ---- 6. roads -------------------------------------------------------- */
  if(DETAIL&&(MODE==='trade'||MODE==='terrain'||MODE==='political')){
    const rp=new Path2D(); let any=false;
    for(let ry=0;ry<rows;ry++){
      const y=CAMY+ry; if(y<0||y>=H) continue;
      for(let rx=0;rx<cols;rx++){
        const x=wrapx(CAMX+rx), i=x+y*W;
        if(!T.road[i]) continue;
        for(let d=0;d<4;d++){
          const ny=y+N4Y[d]; if(ny<0||ny>=H) continue;
          const j=wrapx(x+N4X[d])+ny*W;
          if(!T.road[j]) continue;
          rp.moveTo(rx*cw+cw/2, ry*ch+ch/2);
          rp.lineTo((rx+N4X[d])*cw+cw/2, (ry+N4Y[d])*ch+ch/2);
          any=true;
        }
      }
    }
    if(any){ CTX.setLineDash([Math.max(2,cw*0.5),Math.max(2,cw*0.45)]);
      CTX.strokeStyle= MODE==='trade'? 'rgba(240,208,130,.85)':'rgba(226,196,132,.42)';
      CTX.lineWidth=Math.max(1,cw*0.14); CTX.stroke(rp); CTX.setLineDash([]); }
  }

  /* ---- 7. settlements, armies, labels ---------------------------------- */
  drawSites(cols,rows,cw,ch);
  drawArmies(cols,rows,cw,ch);
  if(SHOWLABELS) drawLabels(cols,rows,cw,ch);

  /* ---- 7b. whatever is open in the inspector, picked out ---------------- */
  drawHilite(cols,rows,cw,ch);

  /* ---- 8. map furniture ------------------------------------------------ */
  drawFurniture();
  drawMini();
  VIEWDIRTY=false;
}

/* town marks: rank is readable at a glance, capitals carry a crown-point */
function drawSites(cols,rows,cw,ch){
  const R0=Math.max(1.6,cw*0.34);
  for(const s of SITES){
    if(!s.alive) continue;
    const P0=scr(s.tile,cols,rows); if(!P0) continue;
    const cx=P0[0]+cw/2, cy=P0[1]+ch/2;
    const p=P(s.polity);
    const isCap = p&&p.capital===s.id;
    const r = R0*(0.55+s.tier*0.30)*(isCap?1.25:1);
    let fill = s.tier>=3? '#f2dda4' : (s.tier>=1? '#d9c48c' : '#a89a76');
    if(MODE==='political'&&p) fill=hexs(mixHex(p.color,0xffffff,0.55));
    CTX.beginPath(); CTX.arc(cx,cy,r+Math.max(1,cw*0.12),0,6.2832);
    CTX.fillStyle='rgba(6,10,10,.85)'; CTX.fill();
    CTX.beginPath(); CTX.arc(cx,cy,r,0,6.2832);
    CTX.fillStyle= s.tier>=2? fill : 'rgba(0,0,0,0)';
    CTX.strokeStyle=fill; CTX.lineWidth=Math.max(1,cw*0.12);
    if(s.tier>=2) CTX.fill();
    CTX.stroke();
    if(isCap&&s.tier>=1){
      CTX.beginPath(); CTX.arc(cx,cy,r*1.85,0,6.2832);
      CTX.strokeStyle='rgba(242,214,138,.85)'; CTX.lineWidth=Math.max(1,cw*0.09); CTX.stroke();
    }
    if(s.siege){
      CTX.beginPath(); CTX.arc(cx,cy,r*2.3,0,6.2832);
      CTX.strokeStyle='rgba(232,86,60,.95)'; CTX.lineWidth=Math.max(1,cw*0.14); CTX.stroke();
    }
  }
  /* ruins */
  if(MODE==='legend'||MODE==='terrain'){
    for(const ru of RUINS){
      const P0=scr(ru.tile,cols,rows); if(!P0) continue;
      CTX.fillStyle='rgba(216,189,124,.9)';
      CTX.font=Math.floor(ch*0.9)+'px '+MONOFONT;
      CTX.textAlign='center'; CTX.textBaseline='middle';
      CTX.fillText('‡',P0[0]+cw/2,P0[1]+ch/2);
    }
  }
}
function drawArmies(cols,rows,cw,ch){
  if(!ARMIES.length) return;
  if(MODE==='temp'||MODE==='rain'||MODE==='relief') return;
  CTX.font='700 '+Math.floor(ch*0.82)+'px '+MONOFONT;
  CTX.textAlign='center'; CTX.textBaseline='middle';
  for(const a of ARMIES){
    const P0=scr(a.tile,cols,rows); if(!P0) continue;
    const p=P(a.pol);
    const cx=P0[0]+cw/2, cy=P0[1]+ch/2;
    const r=Math.max(3,cw*0.55);
    CTX.beginPath(); CTX.arc(cx,cy,r,0,6.2832);
    CTX.fillStyle='rgba(10,6,4,.9)'; CTX.fill();
    CTX.strokeStyle= p? hexs(mixHex(p.color,0xffffff,0.4)) : '#fff';
    CTX.lineWidth=Math.max(1,cw*0.12); CTX.stroke();
    CTX.fillStyle= p? hexs(mixHex(p.color,0xffffff,0.7)) : '#fff';
    CTX.fillText('⚔',cx,cy+0.5);
  }
}

/* labels that refuse to overlap: biggest towns get first refusal */
function drawLabels(cols,rows,cw,ch){
  const boxes=[];
  const fits=(x,y,w,h)=>{
    for(let k=0;k<boxes.length;k++){
      const b=boxes[k];
      if(x<b[0]+b[2]&&x+w>b[0]&&y<b[1]+b[3]&&y+h>b[1]) return false;
    }
    return true;
  };
  const minTier = ZOOM<=0? 4 : ZOOM===1? 3 : ZOOM===2? 2 : ZOOM===3? 1 : 0;
  const list=SITES.filter(s=>s.alive&&s.tier>=minTier);
  list.sort((a,b)=>b.pop-a.pop);
  const fs=Math.max(9,Math.min(15,Math.round(ch*0.62)));
  CTX.font=fs+'px '+MONOFONT;
  CTX.textAlign='left'; CTX.textBaseline='middle';
  let drawn=0;
  for(const s of list){
    if(drawn>150) break;
    const P0=scr(s.tile,cols,rows); if(!P0) continue;
    const p=P(s.polity), isCap=p&&p.capital===s.id;
    const txt=s.name;
    const w=CTX.measureText(txt).width+6, h=fs+3;
    const ax=P0[0]+cw*0.75, ay=P0[1]+ch/2-h/2;
    let px=ax, py=ay, ok=fits(px,py,w,h);
    if(!ok){ px=P0[0]-w-cw*0.4; ok=fits(px,py,w,h); }
    if(!ok){ px=ax; py=P0[1]-ch*0.9-h/2; ok=fits(px,py,w,h); }
    if(!ok) continue;
    boxes.push([px,py,w,h]); drawn++;
    CTX.fillStyle='rgba(6,9,8,.72)';
    CTX.fillRect(px,py,w,h);
    CTX.fillStyle= isCap? '#f7e2a8' : (s.tier>=3? '#e6d5ac' : '#bdb094');
    CTX.fillText(txt, px+3, py+h/2+0.5);
  }
}

/* The panel on the right and the map on the left should never disagree about
   what you are looking at. */
let HILITE={t:null,i:-1};
function drawHilite(cols,rows,cw,ch){
  if(!HILITE.t) return;
  const t=HILITE.t, id=HILITE.i;
  const flash='rgba(255,236,170,.95)';
  if(t==='p'&&POLS[id]&&POLS[id].alive){
    const ids=new Set([id]);
    for(const q of allVassals(POLS[id])) ids.add(q.id);
    const path=new Path2D();
    for(let ry=-1;ry<=rows;ry++){
      const y=CAMY+ry; if(y<0||y>=H) continue;
      for(let rx=-1;rx<=cols;rx++){
        const x=wrapx(CAMX+rx), i=x+y*W;
        if(!ids.has(T.owner[i])) continue;
        const px=rx*cw, py=ry*ch;
        if(y<=0||!ids.has(T.owner[x+(y-1)*W]))  { path.moveTo(px,py);    path.lineTo(px+cw,py); }
        if(y>=H-1||!ids.has(T.owner[x+(y+1)*W])){ path.moveTo(px,py+ch); path.lineTo(px+cw,py+ch); }
        if(!ids.has(T.owner[wrapx(x-1)+y*W]))   { path.moveTo(px,py);    path.lineTo(px,py+ch); }
        if(!ids.has(T.owner[wrapx(x+1)+y*W]))   { path.moveTo(px+cw,py); path.lineTo(px+cw,py+ch); }
      }
    }
    CTX.strokeStyle='rgba(0,0,0,.7)'; CTX.lineWidth=Math.max(3,cw*0.45); CTX.stroke(path);
    CTX.strokeStyle=flash; CTX.lineWidth=Math.max(1.5,cw*0.20); CTX.stroke(path);
    return;
  }
  let tile=-1;
  if(t==='s'&&SITES[id]) tile=SITES[id].tile;
  else if(t==='t') tile=id;
  else if(t==='r'&&RUINS[id]) tile=RUINS[id].tile;
  else if(t==='c'&&CHARS[id]&&CHARS[id].site>=0&&SITES[CHARS[id].site]) tile=SITES[CHARS[id].site].tile;
  if(tile<0) return;
  const P0=scr(tile,cols,rows); if(!P0) return;
  const cx=P0[0]+cw/2, cy=P0[1]+ch/2, r=Math.max(7,cw*1.5);
  CTX.strokeStyle='rgba(0,0,0,.75)'; CTX.lineWidth=Math.max(3,cw*0.4);
  CTX.beginPath(); CTX.arc(cx,cy,r,0,6.2832); CTX.stroke();
  CTX.strokeStyle=flash; CTX.lineWidth=Math.max(1.5,cw*0.18);
  CTX.beginPath(); CTX.arc(cx,cy,r,0,6.2832); CTX.stroke();
  CTX.beginPath();
  CTX.moveTo(cx-r*1.7,cy); CTX.lineTo(cx-r*1.15,cy);
  CTX.moveTo(cx+r*1.15,cy); CTX.lineTo(cx+r*1.7,cy);
  CTX.moveTo(cx,cy-r*1.7); CTX.lineTo(cx,cy-r*1.15);
  CTX.moveTo(cx,cy+r*1.15); CTX.lineTo(cx,cy+r*1.7);
  CTX.stroke();
}

/* ---------------------------------------------------------- map furniture   */
let WORLDNAME='';
function drawFurniture(){
  const w=CAN.clientWidth, h=CAN.clientHeight;
  const m=MODEBYK[MODE];
  /* title cartouche, bottom-left */
  CTX.save();
  const title=(WORLDNAME||'THE WORLD').toUpperCase();
  const sub=m? m.n+' — '+m.d : '';
  CTX.font='700 15px '+MONOFONT;
  const tw=Math.max(CTX.measureText(title).width, 0);
  CTX.font='11px '+MONOFONT;
  const sw=CTX.measureText(sub).width;
  const bw=Math.min(w-24, Math.max(tw,sw)+24), bh=54;
  const bx=12, by=h-bh-16;
  CTX.fillStyle='rgba(8,11,10,.82)'; CTX.fillRect(bx,by,bw,bh);
  CTX.strokeStyle='rgba(201,162,71,.5)'; CTX.lineWidth=1; CTX.strokeRect(bx+.5,by+.5,bw-1,bh-1);
  CTX.strokeStyle='rgba(201,162,71,.22)'; CTX.strokeRect(bx+3.5,by+3.5,bw-7,bh-7);
  CTX.fillStyle='#e8d49a'; CTX.font='700 15px '+MONOFONT;
  CTX.textAlign='left'; CTX.textBaseline='alphabetic';
  CTX.fillText(title, bx+11, by+24);
  CTX.fillStyle='#8d8471'; CTX.font='11px '+MONOFONT;
  CTX.fillText(sub, bx+11, by+41);

  /* scale bar, bottom-right */
  const target=Math.max(60,Math.min(200,w*0.16));
  let tiles=Math.max(1,Math.round(target/ATL.cw));
  const nice=[1,2,5,10,20,25,50,100,200,400];
  let best=nice[0]; for(const n of nice) if(Math.abs(n*KM_PER_TILE-tiles*KM_PER_TILE)<Math.abs(best*KM_PER_TILE-tiles*KM_PER_TILE)) best=n;
  tiles=best;
  const px=tiles*ATL.cw;
  const sx=w-px-22, sy=h-26;
  CTX.strokeStyle='rgba(232,212,154,.85)'; CTX.lineWidth=2;
  CTX.beginPath(); CTX.moveTo(sx,sy); CTX.lineTo(sx+px,sy);
  CTX.moveTo(sx,sy-4); CTX.lineTo(sx,sy+4);
  CTX.moveTo(sx+px,sy-4); CTX.lineTo(sx+px,sy+4); CTX.stroke();
  CTX.fillStyle='#c9bda0'; CTX.font='10px '+MONOFONT; CTX.textAlign='center';
  CTX.fillText(commify(tiles*KM_PER_TILE)+' km', sx+px/2, sy-8);

  /* compass, top-left */
  const cx=34, cy=42, rr=15;
  CTX.strokeStyle='rgba(201,162,71,.55)'; CTX.lineWidth=1;
  CTX.beginPath(); CTX.arc(cx,cy,rr,0,6.2832); CTX.stroke();
  CTX.beginPath();
  CTX.moveTo(cx,cy-rr-3); CTX.lineTo(cx-4,cy+3); CTX.lineTo(cx,cy);
  CTX.lineTo(cx+4,cy+3); CTX.closePath();
  CTX.fillStyle='rgba(232,212,154,.9)'; CTX.fill();
  CTX.fillStyle='#c9a247'; CTX.font='700 10px '+MONOFONT; CTX.textAlign='center';
  CTX.fillText('N', cx, cy-rr-6);
  CTX.restore();
}

let MINISTAMP='';
function drawMini(){
  if(!MCTX) return;
  const mw=MINI.width, mh=MINI.height;
  const stamp=MODE+'|'+YEAR;
  if(stamp===MINISTAMP && MINICACHE){ MCTX.putImageData(MINICACHE,0,0); drawMiniBox(mw,mh); return; }
  MINISTAMP=stamp;
  if(!MIMG||MIMG.width!==mw) MIMG=MCTX.createImageData(mw,mh);
  const d=MIMG.data;
  const political = MODE==='political'||MODE==='war';
  for(let y=0;y<mh;y++){
    const sy=Math.min(H-1,(y*H/mh)|0);
    for(let x=0;x<mw;x++){
      const i=((x*W/mw)|0)+sy*W;
      let c;
      if(!T.land[i]) c=SEACOL[Math.min(7,Math.max(0,T.distLand[i]-1))];
      else if(political&&T.owner[i]>=0&&POLS[T.owner[i]]) c=POLS[T.owner[i]].color;
      else c=shade(LANDCOL[T.biome[i]],0.72+0.4*T.alt[i]);
      const o=(y*mw+x)*4;
      d[o]=(c>>16)&255; d[o+1]=(c>>8)&255; d[o+2]=c&255; d[o+3]=255;
    }
  }
  MCTX.putImageData(MIMG,0,0);
  MINICACHE=MIMG;
  drawMiniBox(mw,mh);
}
let MINICACHE=null;
function drawMiniBox(mw,mh){
  const cols=viewCols(), rows=viewRows();
  MCTX.strokeStyle='rgba(246,226,166,.95)'; MCTX.lineWidth=1;
  const bx=(CAMX/W)*mw, by=(CAMY/H)*mh, bw=(cols/W)*mw, bh=(rows/H)*mh;
  MCTX.strokeRect(bx+0.5,by+0.5,Math.max(2,bw),Math.max(2,bh));
  if(bx+bw>mw) MCTX.strokeRect(bx-mw+0.5,by+0.5,Math.max(2,bw),Math.max(2,bh));
}

function setZoom(z){
  z=clamp(z,0,ZOOMS.length-1);
  if(z===ZOOM) return;
  const cxOld=CAMX+viewCols()/2, cyOld=CAMY+viewRows()/2;
  ZOOM=z;
  atlasInit(ZOOMS[ZOOM][0],ZOOMS[ZOOM][1]);
  CAMX=wrapx(Math.round(cxOld-viewCols()/2));
  CAMY=Math.round(cyOld-viewRows()/2);
  VIEWDIRTY=true;
}
function centreOn(tile){
  CAMX=wrapx((tile%W)-Math.floor(viewCols()/2));
  CAMY=clamp(((tile/W)|0)-Math.floor(viewRows()/2),-2,H);
  VIEWDIRTY=true;
}

/* -------------------------------------------------------------- legend      */
function legendFor(mode){
  const L=[];
  const sw=(c,t)=>`<span><i style="background:${hexs(c)};display:inline-block;width:10px;height:10px;border:1px solid #000"></i> ${esc(t)}</span>`;
  const gl=(g,c,t)=>`<span><i style="color:${hexs(c)}">${g}</i>${esc(t)}</span>`;
  const m=MODEBYK[mode];
  L.push(`<b style="color:var(--gold);letter-spacing:.1em">${m.n}</b><span class="muted">${esc(m.d)}</span>`);
  switch(mode){
    case 'terrain': {
      const seen=new Set();
      for(let i=0;i<NT;i+=11) if(T.land[i]) seen.add(T.biome[i]);
      const order=[...seen].sort((a,b)=>a-b);
      for(const b of order) L.push(gl(LANDGLYPH[b],LANDCOL[b],BIOME[b].n));
      L.push(sw(0x2d6a86,'shelf'),sw(0x0b2434,'deep'));
      L.push(`<span><i style="color:#6ebee0">━</i>river</span><span><i style="color:#e6d5ac">●</i>town</span><span><i style="color:#d8bd7c">‡</i>ruin</span>`);
      break; }
    case 'political': {
      const big=POLS.filter(p=>p.alive&&p.liege<0).sort((a,b)=>polityPop(b)-polityPop(a)).slice(0,14);
      for(const p of big) L.push(sw(p.color,p.name+' · '+commify(polityPop(p))));
      L.push('<span class="muted">a pale line marks a frontier between realms; a dark one, a vassal march</span>');
      break; }
    case 'culture': {
      const big=CULTURES.slice().sort((a,b)=>b.pop-a.pop).slice(0,14);
      for(const c of big) if(c.pop>0) L.push(sw(c.color,c.name+' · '+commify(c.pop)));
      break; }
    case 'faith': {
      const big=FAITHS.slice().sort((a,b)=>b.followers-a.followers).slice(0,12);
      for(const f of big) if(f.followers>0) L.push(sw(f.color,f.name+' · '+commify(f.followers)));
      L.push(gl('†',0xffe9a8,'holy ground'));
      break; }
    case 'pop': L.push(sw(RP_GOLD[0],'empty'),sw(RP_GOLD[2],'settled'),sw(RP_GOLD[4],'thronging')); break;
    case 'trade': L.push(sw(RP_GOLD[0],'poor'),sw(RP_GOLD[4],'rich'),`<span><i style="color:#f0d082">╌</i>road</span>`); break;
    case 'unrest': L.push(sw(RP_BLOOD[0],'quiet'),sw(RP_BLOOD[2],'restive'),sw(RP_BLOOD[4],'in revolt / laid waste')); break;
    case 'war': L.push(sw(RP_BLOOD[2],'realm at war'),sw(RP_BLOOD[4],'devastated'),`<span><i style="color:#fff">⚔</i>host in the field</span>`,`<span><i style="color:#e8563c">◎</i>town besieged</span>`); break;
    case 'magic': L.push(sw(RP_ARC[0],'the power is gone'),sw(RP_ARC[2],'a thin current'),sw(RP_ARC[4],'a deep well'),gl('∆',0xff9060,'Elder Age scar')); break;
    case 'temp': L.push(sw(RP_HEAT[0],'−28°'),sw(RP_HEAT[2],'+4°'),sw(RP_HEAT[5],'+34°')); break;
    case 'rain': L.push(sw(RP_GREEN[0],'desert'),sw(RP_GREEN[2],'temperate'),sw(RP_GREEN[4],'drenched')); break;
    case 'res': {
      const seen=new Set();
      for(let i=0;i<NT;i+=7) if(T.res[i]) seen.add(T.res[i]);
      for(const r of seen) L.push(gl('◊',RESCOL(r),RES[r].n));
      break; }
    case 'relief': L.push(sw(0x2f5a34,'lowland'),sw(0xac9560,'upland'),sw(0xf2f2f2,'peaks'),sw(0x143a50,'deep water')); break;
    case 'legend': L.push(gl('‡',0xd8bd7c,'ruin'),gl('∆',0x9a74e4,'scar of the Elder Age')); break;
  }
  return L.join('');
}
