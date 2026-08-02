/* ============================================================================
   PART XI — THE MAP AS TEXT
   A monospaced glyph grid painted to a canvas through a tinted glyph atlas,
   so forty thousand characters can be repainted without the browser sulking.
   ========================================================================== */

let MAPDIRTY=true, VIEWDIRTY=true;
let ZOOM=1, CAMX=0, CAMY=0;
const ZOOMS=[[5,8],[8,12],[12,18],[17,26]];
let MODE='terrain';

const MAPMODES=[
 {k:'terrain',  n:'LAND'},
 {k:'political',n:'REALMS'},
 {k:'culture',  n:'PEOPLES'},
 {k:'faith',    n:'GODS'},
 {k:'pop',      n:'FOLK'},
 {k:'trade',    n:'TRADE'},
 {k:'unrest',   n:'UNREST'},
 {k:'war',      n:'WAR'},
 {k:'magic',    n:'POWER'},
 {k:'temp',     n:'CLIMATE'},
 {k:'rain',     n:'RAINS'},
 {k:'res',      n:'RICHES'},
 {k:'relief',   n:'RELIEF'},
 {k:'legend',   n:'LEGENDS'}
];

/* ------------------------------------------------------------ glyph atlas   */
const ATL={cv:null,cx:null,rows:new Map(),order:[],cw:0,ch:0,glyphs:[],gi:new Map()};
function atlasInit(cw,ch){
  ATL.cw=cw; ATL.ch=ch; ATL.rows.clear(); ATL.order=[];
  ATL.glyphs=['·','.',':','"','\'','`','~','≈','^','▲','△','♠','♣','░','▒','▓','█','*','#','+',
              '-','|','/','\\','o','O','0','@','⌂','◙','■','□','◊','†','‡','∆','×','⚔','=','∴',
              '·','●','◦','≡','┃','━','┏','┓','┗','┛','┣','┫','┳','┻','╋','▪','▫','♦','☗','§','¤','∩','∙','⌐'];
  ATL.gi.clear();
  ATL.glyphs.forEach((g,i)=>{ if(!ATL.gi.has(g)) ATL.gi.set(g,i); });
  ATL.cv=document.createElement('canvas');
  ATL.cv.width=ATL.glyphs.length*cw;
  ATL.cv.height=ch*300;
  ATL.cx=ATL.cv.getContext('2d',{willReadFrequently:false});
  ATL.cx.textBaseline='middle'; ATL.cx.textAlign='center';
  ATL.cx.font=Math.floor(ch*0.86)+'px '+MONOFONT;
}
const MONOFONT='ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace';
function atlasRow(color){
  let row=ATL.rows.get(color);
  if(row!==undefined) return row;
  if(ATL.order.length>=298){                       /* recycle the oldest row  */
    const old=ATL.order.shift();
    row=ATL.rows.get(old); ATL.rows.delete(old);
  }else{
    row=ATL.order.length;
  }
  ATL.order.push(color);
  ATL.rows.set(color,row);
  const y=row*ATL.ch;
  ATL.cx.clearRect(0,y,ATL.cv.width,ATL.ch);
  ATL.cx.fillStyle=hexs(color);
  for(let i=0;i<ATL.glyphs.length;i++)
    ATL.cx.fillText(ATL.glyphs[i], i*ATL.cw+ATL.cw/2, y+ATL.ch/2+0.5);
  return row;
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
const RP_HEAT=[0x14204a,0x1d5a86,0x35a06e,0xc9c04a,0xd47a32,0xa8291c];
const RP_COLD=[0x2a1a3a,0x2b4a86,0x63a8c4,0xd9e2e6,0xf2f2f2];
const RP_GOLD=[0x241a08,0x5c400f,0x9c7420,0xd0a83a,0xf3dc8a];
const RP_BLOOD=[0x1a0d0a,0x5c1a12,0x9c2c1c,0xd4552c,0xf0a060];
const RP_ARC=[0x161232,0x2f2068,0x5a3cb0,0x8f68dc,0xd6c0ff];
const RP_GREEN=[0x11200e,0x24471c,0x407a2c,0x76b048,0xd0e07a];

/* ------------------------------------------------------------ river glyphs  */
function riverGlyph(i){
  const x=i%W,y=(i/W)|0;
  let m=0;
  const isR=(j)=> j>=0 && (T.flow[j]>0||T.lake[j]||!T.land[j]);
  if(y>0   && isR(idx(x,y-1))) m|=1;
  if(x<W-1 && isR(idx(x+1,y))) m|=2;
  if(y<H-1 && isR(idx(x,y+1))) m|=4;
  if(x>0   && isR(idx(x-1,y))) m|=8;
  switch(m){
    case 0: return '·'; case 1: case 4: case 5: return '┃';
    case 2: case 8: case 10: return '━';
    case 3: return '┗'; case 6: return '┏'; case 12: return '┓'; case 9: return '┛';
    case 7: return '┣'; case 14: return '┳'; case 13: return '┫'; case 11: return '┻';
    default: return '╋';
  }
}
const SITEG=['∙','○','◙','⌂','■','◊'];

/* ------------------------------------------------------------ cell painter  */
function cellOf(i,out){
  const land=T.land[i];
  let g,c;
  const biome=BIOME[T.biome[i]];
  /* base terrain, always visible underneath */
  if(!land){
    g = T.biome[i]===B_SHELF? '~' : (T.biome[i]===B_ICECAP? '▒':'≈');
    c = shade(biome.c, 0.75+0.4*(1+T.alt[i]));
  }else{
    g = biome.g; c = biome.c;
    const sun = 0.72 + 0.55*T.alt[i] - T.slope[i]*0.20;
    c = shade(c,sun);
    if(T.flow[i]>0||T.lake[i]){ g=T.lake[i]?'~':riverGlyph(i); c=0x2f7ba8; }
    if(T.scar[i]&&MODE!=='terrain') {}
  }
  switch(MODE){
    case 'terrain': {
      if(T.scar[i]) c=mixHex(c,0x6a4a7a,0.16);
      break; }
    case 'political': {
      const o=T.owner[i];
      if(land&&o>=0){
        const p=POLS[o];
        const col=p? p.color : 0x555555;
        let frontier=false;
        nb4(i,j=>{ if(T.owner[j]!==o) frontier=true; });
        c = frontier? mixHex(col,0xffffff,0.35) : shade(col,0.62);
        g = frontier? '▓' : biome.g;
        if(p&&p.liege>=0&&!frontier) c=shade(col,0.44);
      }else if(land){ c=shade(0x3a382e,0.9); g=biome.g; }
      break; }
    case 'culture': {
      const u=T.cult[i]>=0? T.cult[i] : (T.dom[i]>=0? SITES[T.dom[i]].culture : -1);
      if(land&&u>=0){ c=shade(CULTURES[u].color,0.55+0.5*T.fert[i]); g=biome.g; }
      else if(land){ c=0x2e2c26; }
      break; }
    case 'faith': {
      const f=T.faith[i]>=0? T.faith[i] : (T.dom[i]>=0? SITES[T.dom[i]].faith : -1);
      if(land&&f>=0&&FAITHS[f]){ c=shade(FAITHS[f].color,0.6); g=biome.g;
        if(FAITHS[f].holy.indexOf(i)>=0){ g='†'; c=0xffe9a8; } }
      else if(land){ c=0x2e2c26; }
      break; }
    case 'pop': {
      if(land){
        const d=T.dom[i]>=0? SITES[T.dom[i]] : null;
        const v=d? clamp(Math.log(1+d.pop)/12,0,1)*(T.fert[i]*0.5+0.5) : 0;
        c=ramp(v,RP_GOLD); g= v>0.62?'▓': v>0.38?'▒': v>0.14?'░':'·';
      }else c=0x0a1420;
      break; }
    case 'trade': {
      if(land){
        c=shade(0x2b281f,1);
        g='·';
        const d=T.dom[i]>=0? SITES[T.dom[i]] : null;
        if(d) c=ramp(clamp(d.wealth/700,0,1),RP_GOLD);
        if(T.road[i]){ g= T.road[i]>=2?'≡':'='; c=mixHex(c,0xe0c070,0.6); }
      }else{ c=0x0c1a26; g='≈'; }
      break; }
    case 'unrest': {
      if(land){
        const d=T.dom[i]>=0? SITES[T.dom[i]] : null;
        const v=d? clamp(d.unrest/1.2,0,1):0;
        const w=clamp(T.dev[i],0,1);
        c=ramp(Math.max(v,w),RP_BLOOD); g= v>0.6?'▓':v>0.3?'▒':'·';
      }else c=0x0a1420;
      break; }
    case 'war': {
      if(land){
        c=shade(0x24221c,1); g='·';
        const o=T.owner[i];
        if(o>=0){
          const p=POLS[o];
          const fighting=p&&p.wars.some(wid=>WARS[wid]&&WARS[wid].ended<0);
          c = fighting? shade(0x8c2b22,0.7+0.5*T.dev[i]) : shade(p?p.color:0x444444,0.35);
        }
        if(T.dev[i]>0.15){ c=ramp(T.dev[i],RP_BLOOD); g='▒'; }
      }else c=0x0a1420;
      break; }
    case 'magic': {
      const v=clamp(T.ley[i]*MAGIC/1.2,0,1);
      /* keep a faint silhouette of the land beneath the leylines */
      const base = land? shade(biome.c,0.24) : 0x070a16;
      c=mixHex(base, ramp(v,RP_ARC), clamp(0.22+v*1.1,0,1));
      g= v>0.7?'▓': v>0.45?'▒': v>0.22?'░':(land?'·':'≈');
      if(T.scar[i]){ g='∆'; c=mixHex(c,0xff9060,0.40); }
      break; }
    case 'temp': {
      const v=clamp((T.temp[i]+CLIMATE_ANOM+28)/62,0,1);
      c=ramp(v,RP_HEAT); g=land?'▒':'≈';
      break; }
    case 'rain': {
      const v=clamp(T.rain[i]/2600,0,1);
      c=ramp(v,RP_GREEN); g=land?(v>0.6?'▓':v>0.3?'▒':'░'):'≈';
      break; }
    case 'res': {
      if(land){
        c=shade(0x262319,1); g='·';
        if(T.res[i]){ g='◊'; c=RESCOL(T.res[i]); }
        else c=ramp(T.fert[i],RP_GREEN);
      }else{ c=0x0c1a26; g='≈'; if(T.res[i]===R_FISH){g='◊';c=0x6ec0d0;} }
      break; }
    case 'relief': {
      if(land){
        const v=clamp(T.alt[i],0,1);
        c=ramp(v,[0x2c4a2a,0x6b7a3c,0xa08a4c,0xbdaea0,0xf0f0f0]);
        g= v>0.62?'▲': v>0.40?'^': v>0.20?'~':'·';
        c=shade(c,0.75+T.slope[i]*0.9);
      }else{ c=ramp(clamp(1+T.alt[i],0,1),[0x040a18,0x0b2340,0x17517a,0x2f86ad]); g='≈'; }
      break; }
    case 'legend': {
      c=shade(0x1e1c16,1); g='·';
      if(land) c=shade(0x2a271e,1);
      if(T.scar[i]){ c=ramp(0.7,RP_ARC); g='∆'; }
      if(T.ruin[i]>=0){ c=0xc0a060; g='‡'; }
      break; }
  }
  /* things that are always drawn on top */
  if(T.ruin[i]>=0&&MODE!=='legend'&&MODE!=='temp'&&MODE!=='rain'){ g='‡'; c=mixHex(c,0xbfa878,0.75); }
  const sid=T.site[i];
  if(sid>=0&&SITES[sid]&&SITES[sid].alive){
    const s=SITES[sid];
    g=SITEG[s.tier];
    if(MODE==='political'&&s.polity>=0&&POLS[s.polity]) c=mixHex(POLS[s.polity].color,0xffffff,0.55);
    else if(MODE==='culture') c=mixHex(CULTURES[s.culture].color,0xffffff,0.5);
    else if(MODE==='faith'&&s.faith>=0) c=mixHex(FAITHS[s.faith].color,0xffffff,0.5);
    else c= s.tier>=3? 0xf0d68a : 0xd8b862;
    if(s.siege) c=0xff6a4a;
    if(s.occupied>=0) c=mixHex(c,0xff4a3a,0.5);
  }
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
  const rows=viewRows();
  CAMY=clamp(CAMY,0,Math.max(0,H-rows+1));
  CAMX=wrapx(CAMX);
}
function drawMap(){
  if(!CAN||!T.biome) return;
  const cw=ATL.cw, ch=ATL.ch;
  const cols=viewCols(), rows=viewRows();
  clampCam();
  CTX.fillStyle='#06050a';
  CTX.fillRect(0,0,CAN.clientWidth,CAN.clientHeight);
  const atl=ATL.cv;
  for(let ry=0;ry<rows;ry++){
    const y=CAMY+ry; if(y<0||y>=H) continue;
    const py=ry*ch;
    for(let rx=0;rx<cols;rx++){
      const x=wrapx(CAMX+rx);
      const i=x+y*W;
      cellOf(i,_cell);
      const row=atlasRow(_cell[1]);
      const gx=gidx(_cell[0])*cw;
      CTX.drawImage(atl,gx,row*ch,cw,ch, rx*cw,py,cw,ch);
    }
  }
  /* armies ride on top of everything */
  if(MODE==='war'||MODE==='political'||MODE==='terrain'){
    CTX.font=Math.floor(ch*0.9)+'px '+MONOFONT;
    CTX.textAlign='center'; CTX.textBaseline='middle';
    for(const a of ARMIES){
      const x=a.tile%W, y=(a.tile/W)|0;
      let rx=x-CAMX; rx=((rx%W)+W)%W;
      const ry=y-CAMY;
      if(rx<0||rx>=cols||ry<0||ry>=rows) continue;
      const p=P(a.pol);
      CTX.fillStyle='rgba(0,0,0,.65)';
      CTX.fillRect(rx*cw,ry*ch,cw,ch);
      CTX.fillStyle=p? hexs(mixHex(p.color,0xffffff,0.45)) : '#fff';
      CTX.fillText('⚔',rx*cw+cw/2,ry*ch+ch/2+0.5);
    }
  }
  /* place names at the larger zooms */
  if(ZOOM>=2){
    CTX.font=Math.floor(ch*0.52)+'px '+MONOFONT;
    CTX.textAlign='left'; CTX.textBaseline='middle';
    for(const s of SITES){
      if(!s.alive||s.tier<(ZOOM>=3?0:2)) continue;
      const x=s.tile%W, y=(s.tile/W)|0;
      let rx=x-CAMX; rx=((rx%W)+W)%W;
      const ry=y-CAMY;
      if(rx<-2||rx>=cols||ry<0||ry>=rows) continue;
      CTX.fillStyle='rgba(4,3,2,.8)';
      const tw=CTX.measureText(s.name).width;
      CTX.fillRect(rx*cw+cw*0.9,ry*ch-ch*0.30,tw+4,ch*0.62);
      CTX.fillStyle= s.tier>=3? '#f0d68a':'#c9bda0';
      CTX.fillText(s.name, rx*cw+cw*0.9+2, ry*ch+0.5);
    }
  }
  drawMini();
  VIEWDIRTY=false;
}
function drawMini(){
  if(!MCTX) return;
  const mw=MINI.width, mh=MINI.height;
  if(!MIMG||MIMG.width!==mw) MIMG=MCTX.createImageData(mw,mh);
  const d=MIMG.data;
  for(let y=0;y<mh;y++){
    const sy=Math.min(H-1,(y*H/mh)|0);
    for(let x=0;x<mw;x++){
      const sx=(x*W/mw)|0;
      const i=sx+sy*W;
      let c;
      if(MODE==='political'&&T.owner[i]>=0&&POLS[T.owner[i]]) c=POLS[T.owner[i]].color;
      else if(!T.land[i]) c=shade(0x13395a,0.6+0.5*(1+T.alt[i]));
      else c=shade(BIOME[T.biome[i]].c,0.7+0.5*T.alt[i]);
      const o=(y*mw+x)*4;
      d[o]=(c>>16)&255; d[o+1]=(c>>8)&255; d[o+2]=c&255; d[o+3]=255;
    }
  }
  MCTX.putImageData(MIMG,0,0);
  /* viewport box */
  const cols=viewCols(), rows=viewRows();
  MCTX.strokeStyle='rgba(240,220,160,.9)'; MCTX.lineWidth=1;
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
  CAMY=clamp(((tile/W)|0)-Math.floor(viewRows()/2),0,H);
  VIEWDIRTY=true;
}

/* -------------------------------------------------------------- legend      */
function legendFor(mode){
  const L=[];
  const sw=(c,t)=>`<span><i style="color:${hexs(c)}">■</i>${esc(t)}</span>`;
  switch(mode){
    case 'terrain':
      for(let b=0;b<NBIOME;b++){
        let n=0; for(let i=0;i<NT;i+=17) if(T.biome[i]===b) n++;
        if(n>3) L.push(`<span><i style="color:${hexs(BIOME[b].c)}">${BIOME[b].g}</i>${esc(BIOME[b].n)}</span>`);
      }
      L.push(`<span><i style="color:#d8b862">◙</i>settlement</span><span><i style="color:#bfa878">‡</i>ruin</span>`);
      break;
    case 'political': {
      const big=POLS.filter(p=>p.alive&&p.liege<0).sort((a,b)=>polityPop(b)-polityPop(a)).slice(0,16);
      for(const p of big) L.push(`<span><i style="color:${hexs(p.color)}">■</i>${esc(p.name)} (${commify(polityPop(p))})</span>`);
      break; }
    case 'culture': {
      const big=CULTURES.slice().sort((a,b)=>b.pop-a.pop).slice(0,16);
      for(const c of big) if(c.pop>0) L.push(`<span><i style="color:${hexs(c.color)}">■</i>${esc(c.name)} (${commify(c.pop)})</span>`);
      break; }
    case 'faith': {
      const big=FAITHS.slice().sort((a,b)=>b.followers-a.followers).slice(0,14);
      for(const f of big) if(f.followers>0) L.push(`<span><i style="color:${hexs(f.color)}">■</i>${esc(f.name)} (${commify(f.followers)})</span>`);
      L.push(sw(0xffe9a8,'holy site'));
      break; }
    case 'pop': L.push(sw(RP_GOLD[0],'empty'),sw(RP_GOLD[2],'settled'),sw(RP_GOLD[4],'thronging')); break;
    case 'trade': L.push(sw(RP_GOLD[0],'poor'),sw(RP_GOLD[4],'rich'),sw(0xe0c070,'road / paved road')); break;
    case 'unrest': L.push(sw(RP_BLOOD[0],'quiet'),sw(RP_BLOOD[2],'restive'),sw(RP_BLOOD[4],'in revolt / wasted')); break;
    case 'war': L.push(sw(0x8c2b22,'realm at war'),sw(RP_BLOOD[4],'devastated'),sw(0xffffff,'⚔ host in the field')); break;
    case 'magic': L.push(sw(RP_ARC[0],'the power is gone'),sw(RP_ARC[2],'a thin current'),sw(RP_ARC[4],'a deep well'),sw(0xff9060,'∆ elder scar')); break;
    case 'temp': L.push(sw(RP_HEAT[0],'−28°'),sw(RP_HEAT[2],'+4°'),sw(RP_HEAT[5],'+34°')); break;
    case 'rain': L.push(sw(RP_GREEN[0],'desert'),sw(RP_GREEN[2],'temperate'),sw(RP_GREEN[4],'drenched')); break;
    case 'res': {
      const seen=new Set();
      for(let i=0;i<NT;i+=7) if(T.res[i]) seen.add(T.res[i]);
      for(const r of seen) L.push(`<span><i style="color:${hexs(RESCOL(r))}">◊</i>${esc(RES[r].n)}</span>`);
      break; }
    case 'relief': L.push(sw(0x2c4a2a,'lowland'),sw(0xa08a4c,'upland'),sw(0xf0f0f0,'peaks'),sw(0x17517a,'shelf / deep')); break;
    case 'legend': L.push(sw(0xc0a060,'‡ ruin'),sw(0x8a63d4,'∆ scar of the Elder Age')); break;
  }
  return L.join('');
}
