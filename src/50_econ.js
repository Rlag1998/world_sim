/* ============================================================================
   PART V — HOLDFASTS, BREAD AND SILVER
   Settlements draw production from the land they actually hold. Prices move
   with real stocks. Caravans chase real margins. Roads grow where the carts
   already went, and cheaper roads bring more carts.
   ========================================================================== */

const GOODS=[
 {k:'grain', n:'Grain',   base:1.0,  bulk:1.00, food:1.00, need:1.00},
 {k:'fish',  n:'Fish',    base:1.1,  bulk:1.20, food:0.85, need:0.22},
 {k:'meat',  n:'Meat',    base:2.2,  bulk:1.10, food:0.70, need:0.26},
 {k:'timber',n:'Timber',  base:1.3,  bulk:1.55, food:0,    need:0.20},
 {k:'stone', n:'Stone',   base:1.5,  bulk:1.90, food:0,    need:0.10},
 {k:'iron',  n:'Iron',    base:4.0,  bulk:0.90, food:0,    need:0.11},
 {k:'copper',n:'Copper',  base:5.0,  bulk:0.85, food:0,    need:0.06},
 {k:'tin',   n:'Tin',     base:7.5,  bulk:0.80, food:0,    need:0.03},
 {k:'silver',n:'Silver',  base:22,   bulk:0.35, food:0,    need:0.02},
 {k:'gold',  n:'Gold',    base:70,   bulk:0.22, food:0,    need:0.01},
 {k:'salt',  n:'Salt',    base:3.4,  bulk:0.75, food:0.04, need:0.13},
 {k:'cloth', n:'Cloth',   base:4.2,  bulk:0.55, food:0,    need:0.20},
 {k:'wine',  n:'Wine',    base:5.0,  bulk:1.00, food:0.10, need:0.10},
 {k:'horses',n:'Horses',  base:11,   bulk:0.70, food:0,    need:0.05},
 {k:'luxury',n:'Luxuries',base:30,   bulk:0.30, food:0,    need:0.03},
 {k:'arms',  n:'Arms',    base:9.0,  bulk:0.60, food:0,    need:0.05}
];
const NG=GOODS.length;
const G_GRAIN=0,G_FISH=1,G_MEAT=2,G_TIMBER=3,G_STONE=4,G_IRON=5,G_COPPER=6,G_TIN=7,
      G_SILVER=8,G_GOLD=9,G_SALT=10,G_CLOTH=11,G_WINE=12,G_HORSE=13,G_LUX=14,G_ARMS=15;

/* --------------------------------------------------------------- technology */
const TECHS=[
 {k:'fire_hard',   n:'Fire-Hardening',   era:0, pre:[],                     e:{mil:.04}},
 {k:'pottery',     n:'Pottery',          era:0, pre:[],                     e:{store:.10}},
 {k:'ard',         n:'The Ard-Plough',   era:0, pre:[],                     e:{food:.12}},
 {k:'copper_work', n:'Copperworking',    era:0, pre:['pottery'],            e:{craft:.10}},
 {k:'weaving',     n:'Weaving',          era:0, pre:[],                     e:{craft:.08}},
 {k:'sail',        n:'The Sail',         era:0, pre:[],                     e:{sea:.20}},
 {k:'writing',     n:'Writing',          era:1, pre:['pottery'],            e:{admin:.14,lit:.25}},
 {k:'bronze',      n:'Bronze',           era:1, pre:['copper_work'],        e:{mil:.12,craft:.08}},
 {k:'wheel',       n:'The Spoked Wheel', era:1, pre:['copper_work'],        e:{trade:.10}},
 {k:'irrigation',  n:'Irrigation',       era:1, pre:['ard'],                e:{food:.16}},
 {k:'chariot',     n:'War-Chariots',     era:1, pre:['wheel','bronze'],     e:{mil:.10}},
 {k:'coinage',     n:'Coined Money',     era:1, pre:['writing','copper_work'],e:{trade:.20,admin:.06}},
 {k:'keel',        n:'The Keel',         era:1, pre:['sail'],               e:{sea:.22}},
 {k:'masonry',     n:'Cut Masonry',      era:1, pre:['copper_work'],        e:{fort:.18}},
 {k:'iron_work',   n:'Ironworking',      era:2, pre:['bronze'],             e:{mil:.18,craft:.10}},
 {k:'law_code',    n:'Written Law',      era:2, pre:['writing'],            e:{admin:.16,unrest:-.10}},
 {k:'numerals',    n:'Numerals',         era:2, pre:['writing'],            e:{trade:.10,lit:.10}},
 {k:'compbow',     n:'Composite Bow',    era:2, pre:['iron_work'],          e:{mil:.10}},
 {k:'aqueduct',    n:'Aqueducts',        era:2, pre:['masonry'],            e:{growth:.14,health:.10}},
 {k:'roads',       n:'Paved Roads',      era:2, pre:['masonry'],            e:{trade:.16,move:.14}},
 {k:'crop_rot',    n:'Crop Rotation',    era:2, pre:['ard','writing'],      e:{food:.16}},
 {k:'watermill',   n:'The Watermill',    era:2, pre:['masonry','wheel'],    e:{food:.10,craft:.12}},
 {k:'stirrup',     n:'The Stirrup',      era:3, pre:['iron_work'],          e:{mil:.14,cav:.30}},
 {k:'mail',        n:'Mail',             era:3, pre:['iron_work'],          e:{mil:.12}},
 {k:'heavy_plough',n:'The Heavy Plough', era:3, pre:['iron_work','crop_rot'],e:{food:.20}},
 {k:'horse_collar',n:'The Horse Collar', era:3, pre:['heavy_plough'],       e:{food:.10,trade:.06}},
 {k:'codex',       n:'The Codex',        era:3, pre:['numerals'],           e:{lit:.20}},
 {k:'banking',     n:'Letters of Credit',era:3, pre:['coinage','numerals'], e:{trade:.22,tax:.10}},
 {k:'castle',      n:'The Stone Castle', era:3, pre:['masonry','iron_work'],e:{fort:.35}},
 {k:'lateen',      n:'The Lateen Sail',  era:3, pre:['keel'],               e:{sea:.20,trade:.08}},
 {k:'windmill',    n:'The Windmill',     era:3, pre:['watermill'],          e:{food:.10}},
 {k:'guilds',      n:'Craft Guilds',     era:4, pre:['banking'],            e:{craft:.20,trade:.08}},
 {k:'crossbow',    n:'The Crossbow',     era:4, pre:['mail'],               e:{mil:.12}},
 {k:'trebuchet',   n:'The Trebuchet',    era:4, pre:['castle'],             e:{siege:.40}},
 {k:'steel',       n:'Crucible Steel',   era:4, pre:['iron_work','guilds'], e:{mil:.16,craft:.10}},
 {k:'compass',     n:'The Lodestone',    era:4, pre:['lateen','numerals'],  e:{sea:.25,trade:.10}},
 {k:'university',  n:'The University',   era:4, pre:['codex','law_code'],   e:{lit:.30,tech:.20}},
 {k:'paper',       n:'Paper',            era:4, pre:['codex'],              e:{lit:.18,admin:.08}},
 {k:'bureaucracy', n:'The Ministry',     era:5, pre:['university','law_code'],e:{admin:.24,tax:.14}},
 {k:'plate',       n:'Plate Harness',    era:5, pre:['steel'],              e:{mil:.16}},
 {k:'printing',    n:'The Printing Press',era:5,pre:['paper','university'], e:{lit:.45,tech:.25}},
 {k:'blastfurnace',n:'The Blast Furnace',era:5, pre:['steel','windmill'],   e:{craft:.22,mil:.08}},
 {k:'carrack',     n:'The Carrack',      era:5, pre:['compass'],            e:{sea:.30,trade:.16}},
 {k:'blackpowder', n:'Black Powder',     era:5, pre:['blastfurnace'],       e:{siege:.60,mil:.14}}
];
const TECHI={}; TECHS.forEach((t,i)=>TECHI[t.k]=i);
const NTECH=TECHS.length;

function techEffect(cult,key){
  let v=0;
  const s=cult.techs;
  for(const k of s){ const t=TECHS[TECHI[k]]; if(t&&t.e[key]) v+=t.e[key]; }
  return v;
}
function canLearn(cult,t){
  for(const p of t.pre) if(!cult.techs.has(p)) return false;
  return true;
}

/* --------------------------------------------------------------- settlement */
let SITES=[];
const CL_PEASANT=0,CL_ARTISAN=1,CL_MERCHANT=2,CL_CLERIC=3,CL_WARRIOR=4,CL_NOBLE=5,CL_THRALL=6;
const NCLASS=7;
const CLASSN=['smallfolk','craftsmen','merchants','clergy','men-at-arms','nobility','thralls'];
const TIERN=['hamlet','village','town','city','great city','metropolis'];

let SITEGRID=null, SGW=0,SGH=0,SGC=10;
function siteGridBuild(){
  SGW=Math.ceil(W/SGC); SGH=Math.ceil(H/SGC);
  SITEGRID=[]; for(let i=0;i<SGW*SGH;i++) SITEGRID.push([]);
  for(const s of SITES) if(s.alive) SITEGRID[((s.tile/W|0)/SGC|0)*SGW + ((s.tile%W)/SGC|0)].push(s.id);
}
function siteGridAdd(s){
  if(!SITEGRID) return;
  SITEGRID[((s.tile/W|0)/SGC|0)*SGW + ((s.tile%W)/SGC|0)].push(s.id);
}
function nearbySites(tile,radius){
  const out=[];
  if(!SITEGRID) return out;
  const cx=(tile%W)/SGC|0, cy=((tile/W|0))/SGC|0, rr=Math.ceil(radius/SGC);
  for(let dy=-rr;dy<=rr;dy++){
    const gy=cy+dy; if(gy<0||gy>=SGH) continue;
    for(let dx=-rr;dx<=rr;dx++){
      let gx=(cx+dx)%SGW; if(gx<0)gx+=SGW;
      const cell=SITEGRID[gy*SGW+gx];
      for(const id of cell){ const s=SITES[id]; if(s.alive&&tdist(s.tile,tile)<=radius) out.push(s); }
    }
  }
  return out;
}

function siteSuitability(i){
  if(!T.land[i]||T.biome[i]===B_GLACIER||T.biome[i]===B_ICECAP) return -1;
  let f=0, wood=0, water=0;
  nb8(i,j=>{ if(T.land[j]){ f+=T.fert[j]; wood+=BIOME[T.biome[j]].wood; } });
  f=(f+T.fert[i]*2)/10;
  if(T.flow[i]>0||T.lake[i]) water=1;
  else nb4(i,j=>{ if(T.flow[j]>0||T.lake[j]) water=Math.max(water,0.8); });
  let s = f*1.55 + water*0.55 + T.harbor[i]*0.85 + wood*0.05
        + (T.res[i]?T.resq[i]*0.45:0) + T.defen[i]*0.30 + (T.pass[i]?0.35:0);
  if(T.coast[i]) s+=0.22;
  s -= Math.max(0,T.alt[i]-0.42)*1.7;
  s -= T.slope[i]*0.55;
  if(T.temp[i]<-8) s-=0.9; else if(T.temp[i]<-2) s-=0.35;
  if(T.rain[i]<130) s-=0.6;
  return s;
}

function newSite(seed,r,tile,cult,faith,year,founderPolity){
  const lang=LANGS[cult.lang];
  const nm=nameSettlement(lang,tile,r,0);
  const s={
    id:SITES.length, tile, name:nm.t, gloss:nm.g, alive:true,
    culture:cult.id, faith:faith>=0?faith:cult.faith, polity:-1, founded:year,
    cls:new Float32Array(NCLASS), pop:0, tier:0,
    stock:new Float32Array(NG), prod:new Float32Array(NG), cons:new Float32Array(NG),
    price:new Float32Array(NG), flow:new Float32Array(NG),
    wealth: 0, granary:0, unrest:0, walls:0, temple:0, market:0, port:0, univ:0,
    devast:0, plagueTimer:0, siege:null, occupied:-1,
    links:[], hinter:[], hinterW:[], baseFood:0,
    tradeIn:0, tradeOut:0, taxBase:0, prestige:0, holder:-1,
    lastGrow:0, starving:0, garrison:0, manpower:0, ruinYear:-1, sacked:0,
    events:[]
  };
  for(let g=0;g<NG;g++){ s.price[g]=GOODS[g].base; s.stock[g]=0; }
  const start=ri(r,110,340);
  s.cls[CL_PEASANT]=start*0.80; s.cls[CL_ARTISAN]=start*0.08;
  s.cls[CL_MERCHANT]=start*0.03; s.cls[CL_CLERIC]=start*0.03;
  s.cls[CL_WARRIOR]=start*0.04; s.cls[CL_NOBLE]=start*0.02;
  s.pop=start;
  SITES.push(s);
  T.site[tile]=s.id;
  siteGridAdd(s);
  return s;
}

/* Claim a hinterland by cheapest-path flood, stealing from weaker neighbours. */
const HINT_BUDGET=17.0;
function claimHinterland(s){
  const heap=new MinHeap(512);
  const seen=new Map();
  heap.push(0,s.tile); seen.set(s.tile,0);
  const got=[];
  while(heap.size && got.length<80){
    const i=heap.pop(); const d=heap._k;
    if(d>(seen.get(i)!==undefined?seen.get(i):1e9)+1e-6) continue;
    if(!T.land[i]) continue;
    const cur=T.dom[i];
    if(cur>=0 && cur!==s.id){
      const o=SITES[cur];
      if(o && o.alive && o.hinterD[i]!==undefined && o.hinterD[i]<=d) { continue; }
    }
    got.push(i);
    const x=i%W,y=(i/W)|0;
    for(let k=0;k<8;k++){
      const ny=y+N8Y[k]; if(ny<0||ny>=H) continue;
      const j=wrapx(x+N8X[k])+ny*W;
      if(!T.land[j]) continue;
      const nd=d+T.cost[j]*N8D[k];
      if(nd>HINT_BUDGET) continue;
      const pv=seen.get(j);
      if(pv===undefined||nd<pv-1e-6){ seen.set(j,nd); heap.push(nd,j); }
    }
  }
  s.hinter=got; s.hinterD={};
  s.hinterW=[];
  for(const i of got){
    s.hinterD[i]=seen.get(i);
    const w=clamp(1-(seen.get(i)/HINT_BUDGET)*0.75,0.2,1);
    s.hinterW.push(w);
    const prev=T.dom[i];
    if(prev>=0&&prev!==s.id){
      const o=SITES[prev];
      if(o&&o.alive){ const k=o.hinter.indexOf(i); if(k>=0){ o.hinter.splice(k,1); o.hinterW.splice(k,1); delete o.hinterD[i]; } }
    }
    T.dom[i]=s.id;
  }
  computeBase(s);
}

function computeBase(s){
  let food=0, wood=0, ore=0, sea=0;
  const rescnt=new Float32Array(RES.length);
  for(let k=0;k<s.hinter.length;k++){
    const i=s.hinter[k], w=s.hinterW[k];
    food += T.fert[i]*w*(1-0.85*T.dev[i]);
    wood += BIOME[T.biome[i]].wood*w;
    if(T.res[i]) rescnt[T.res[i]]+=T.resq[i]*w;
    if(T.coast[i]) sea+=0.25*w;
  }
  nb8(s.tile,j=>{ if(!T.land[j]) sea+=BIOME[T.biome[j]].food*1.4; });
  s.baseFood=food; s.baseWood=wood; s.baseSea=sea; s.rescnt=rescnt;
  s.isPort = T.harbor[s.tile]>0.35;
}

/* --------------------------------------------------------------- production */
function produce(s){
  const c=CULTURES[s.culture];
  const foodT=1+techEffect(c,'food'), craftT=1+techEffect(c,'craft'), seaT=1+techEffect(c,'sea');
  const P=s.prod; P.fill(0);
  const workers = s.cls[CL_PEASANT]+s.cls[CL_THRALL]*0.9;
  const arts    = s.cls[CL_ARTISAN];
  const rc=s.rescnt;
  const dev=1-0.9*s.devast;
  /* grain: land-limited, then labour-limited */
  const landFood = s.baseFood*51*foodT*dev;
  P[G_GRAIN] = Math.min(landFood, workers*1.35*foodT) * (1-0.30*s.starving*0);
  P[G_FISH]  = Math.min(s.baseSea*30*seaT, workers*0.30) * dev;
  P[G_MEAT]  = (s.baseWood*3.0 + rc[R_HORSES]*6 + s.baseFood*4.0)*dev*0.5;
  P[G_TIMBER]= Math.min(s.baseWood*11, workers*0.45)*dev;
  P[G_STONE] = (rc[R_STONE]*7 + rc[R_MARBLE]*5)*craftT*dev;
  P[G_IRON]  = rc[R_IRON]*8.0*craftT*(c.techs.has('iron_work')?1.6:0.55)*dev;
  P[G_COPPER]= rc[R_COPPER]*6.5*craftT*dev;
  P[G_TIN]   = rc[R_TIN]*4.2*craftT*dev;
  P[G_SILVER]= rc[R_SILVER]*2.4*craftT*dev;
  P[G_GOLD]  = rc[R_GOLD]*1.1*craftT*dev;
  P[G_SALT]  = rc[R_SALT]*6.0*dev;
  P[G_CLOTH] = (arts*0.55 + rc[R_SILK]*5 + s.baseWood*0.8)*craftT*dev;
  P[G_WINE]  = (rc[R_VINES]*7 + s.baseFood*1.2)*dev;
  P[G_HORSE] = rc[R_HORSES]*3.4*dev;
  P[G_LUX]   = (rc[R_GEMS]*3.2+rc[R_AMBER]*2.6+rc[R_SPICE]*3.0+rc[R_PEARL]*2.4+rc[R_SILK]*2.0
              + arts*0.10*craftT)*dev;
  const metal = P[G_IRON]*1.0 + P[G_COPPER]*0.6 + rc[R_STARMETAL]*3;
  P[G_ARMS]  = Math.min(arts*0.35*craftT, metal*0.8);
  /* fishing villages: coastal sites lean on the sea when the soil is poor */
  if(s.isPort) P[G_FISH]*=1.5;
}

function consume(s){
  const C=s.cls, K=s.cons; K.fill(0);
  const pop=s.pop;
  const rich=(C[CL_MERCHANT]+C[CL_NOBLE]*1.6+C[CL_CLERIC]*0.5);
  for(let g=0;g<NG;g++) K[g]=pop*GOODS[g].need*0.0125;
  K[G_GRAIN]=pop*0.0132;
  K[G_LUX]  =rich*0.010;
  K[G_WINE] =rich*0.016+pop*0.0016;
  K[G_ARMS] =(C[CL_WARRIOR]*0.020+C[CL_NOBLE]*0.010);
  K[G_HORSE]=(C[CL_WARRIOR]*0.010+C[CL_NOBLE]*0.014);
  K[G_CLOTH]=pop*0.0026;
  K[G_TIMBER]=pop*0.0022;
  K[G_STONE]=pop*0.0009+(s.walls*0.4);
}

/* Price seeks the level that clears local stocks. */
function repriceAll(s){
  for(let g=0;g<NG;g++){
    const sup=s.prod[g]+s.stock[g]*0.30+s.flow[g];
    const dem=s.cons[g]+0.001;
    const ratio=(dem-sup)/(dem+sup+0.02);
    let p=s.price[g]*(1+0.24*ratio);
    const base=GOODS[g].base;
    s.price[g]=clamp(p, base*0.16, base*14);
  }
}
function goodValue(s,g){ return s.price[g]; }

/* --------------------------------------------------------------- trade net  */
function buildTradeLinks(seed){
  const r=stream(seed,'trade');
  for(const s of SITES){ if(s.alive) s.links=[]; }
  for(const s of SITES){
    if(!s.alive) continue;
    const near=nearbySites(s.tile,34).filter(o=>o!==s);
    near.sort((a,b)=>tdist2(s.tile,a.tile)-tdist2(s.tile,b.tile));
    const want=6;
    for(const o of near.slice(0,14)){
      if(s.links.length>=want) break;
      if(s.links.some(l=>l.to===o.id)) continue;
      const path=routeCost(s.tile,o.tile);
      if(!path) continue;
      s.links.push({to:o.id, cost:path.cost, sea:path.sea, road:0, traffic:0, path:path.path});
      if(!o.links.some(l=>l.to===s.id))
        o.links.push({to:s.id, cost:path.cost, sea:path.sea, road:0, traffic:0, path:path.path.slice().reverse()});
    }
  }
}

/* A* over the movement-cost field; sea legs allowed between ports. */
const ROUTE_CACHE=new Map();
const NOROUTE={fail:1};
function routeCost(a,b){
  if(a===b) return {cost:0,sea:0,path:[a]};
  const key=a<b? a*NT+b : b*NT+a;
  const hit=ROUTE_CACHE.get(key);
  if(hit) return hit===NOROUTE? null : hit;
  const seaOK = (T.harbor[a]>0.2&&T.harbor[b]>0.2);
  const res = astar(a,b,seaOK);
  if(ROUTE_CACHE.size>60000) ROUTE_CACHE.clear();
  ROUTE_CACHE.set(key,res||NOROUTE);
  return res;
}
const _g=new Float32Array(NT), _f=new Float32Array(NT), _from=new Int32Array(NT), _mark=new Int32Array(NT);
let _epoch=0;
function astar(a,b,seaOK){
  _epoch++;
  const heap=new MinHeap(4096);
  _g[a]=0; _mark[a]=_epoch; _from[a]=-1;
  heap.push(tdist(a,b),a);
  let iter=0;
  const bx=b%W, by=(b/W)|0;
  while(heap.size){
    const i=heap.pop();
    if(i===b) break;
    if(++iter>26000) return null;
    const gi=_g[i];
    const x=i%W,y=(i/W)|0;
    for(let k=0;k<8;k++){
      const ny=y+N8Y[k]; if(ny<0||ny>=H) continue;
      const j=wrapx(x+N8X[k])+ny*W;
      let c;
      if(T.land[j]) c=T.cost[j]*(T.road[j]?0.45:1);
      else if(seaOK) c=T.scost[j]*1.05;
      else continue;
      if(!T.land[i]&&T.land[j]&&!(T.coast[j])) continue;
      const ng=gi+c*N8D[k];
      if(_mark[j]!==_epoch||ng<_g[j]-1e-6){
        _mark[j]=_epoch; _g[j]=ng; _from[j]=i;
        heap.push(ng+tdist(j,b)*0.95,j);
      }
    }
  }
  if(_mark[b]!==_epoch) return null;
  const path=[]; let cur=b, sea=0;
  while(cur>=0&&path.length<600){ path.push(cur); if(!T.land[cur]) sea++; cur=_from[cur]; }
  path.reverse();
  return {cost:_g[b], sea:sea/Math.max(1,path.length), path};
}

/* Caravans: each link moves the goods with the fattest margin, both ways. */
function runTrade(s,year){
  if(!s.alive||!s.links.length) return;
  const c=CULTURES[s.culture];
  const tradeT=1+techEffect(c,'trade');
  s.flow.fill(0);
  let income=0;
  for(const l of s.links){
    const o=SITES[l.to];
    if(!o||!o.alive) continue;
    const hostile = s.polity!==o.polity && atWar(s.polity,o.polity);
    if(hostile) { l.traffic*=0.55; continue; }
    const roadDisc = 1-0.36*Math.min(3,l.road)/3;
    const risk = 1 + 0.55*avgUnrest(s,o) + (l.sea>0.4? 0.20:0);
    const unit = (0.55 + l.cost*0.055*roadDisc)*risk;
    let bestG=-1,bestM=0;
    for(let g=0;g<NG;g++){
      const avail=s.stock[g]+s.prod[g]-s.cons[g];
      if(avail<=0.4) continue;
      const m=(o.price[g]-s.price[g]) - unit*GOODS[g].bulk*GOODS[g].base*0.35;
      if(m>bestM){ bestM=m; bestG=g; }
    }
    if(bestG<0){ l.traffic*=0.90; continue; }
    const cap = 2.5 + s.cls[CL_MERCHANT]*0.055*tradeT + Math.min(3,l.road)*1.6;
    const avail=Math.max(0,s.stock[bestG]+s.prod[bestG]-s.cons[bestG]);
    const qty=Math.min(cap, avail*0.55, (o.cons[bestG]-o.prod[bestG]+o.stock[bestG]*0.2)*1.2+2);
    if(qty<=0.2){ l.traffic*=0.9; continue; }
    const gross=qty*bestM;
    s.stock[bestG]-=qty; o.flow[bestG]+=qty; o.stock[bestG]+=qty;
    income+=gross*0.6; o.wealth+=gross*0.18;
    l.traffic=l.traffic*0.90+qty*1.2;
    o.tradeIn+=qty;
    s.tradeOut+=qty;
  }
  s.wealth+=income;
  s.taxBase=income;
}
function avgUnrest(a,b){ return (a.unrest+b.unrest)*0.5; }

/* Roads accrete where the carts already go. */
function growRoads(s,year){
  for(const l of s.links){
    const o=SITES[l.to]; if(!o||!o.alive) continue;
    const need = 22 + l.road*46;
    if(l.traffic>need && s.wealth>60 && l.road<3 && l.sea<0.35){
      l.road++;
      const back=o.links.find(q=>q.to===s.id); if(back) back.road=l.road;
      s.wealth-=42;
      for(const t of l.path) if(T.land[t]&&T.road[t]<l.road) T.road[t]=l.road;
      if(l.road>=2) chron(year,3,'road',
        `A paved road is completed between ${SL(s)} and ${SL(o)}.`, {sites:[s.id,o.id]});
    }
  }
}

/* ------------------------------------------------------------- populations  */
function tierOf(pop){
  return pop<600?0 : pop<3000?1 : pop<12000?2 : pop<40000?3 : pop<110000?4 : 5;
}
function popStep(s,year,r){
  const c=CULTURES[s.culture], sp=SPECIES[c.species];
  const foodProd = s.prod[G_GRAIN]*GOODS[G_GRAIN].food + s.prod[G_FISH]*GOODS[G_FISH].food
                 + s.prod[G_MEAT]*GOODS[G_MEAT].food + s.flow[G_GRAIN]*0.9;
  const foodNeed = s.pop*0.0132;
  let ratio = foodNeed>0? foodProd/foodNeed : 2;
  /* the granary smooths one bad year, not three */
  if(ratio<1 && s.granary>0){
    const draw=Math.min(s.granary, (1-ratio)*foodNeed*12);
    s.granary-=draw; ratio+=draw/(foodNeed*12);
  } else if(ratio>1.06){
    const put=Math.min((ratio-1)*foodNeed*12, foodNeed*36-s.granary);
    if(put>0){ s.granary+=put*0.55; ratio-=put*0.55/(foodNeed*12); }
  }
  const health = 1 + techEffect(c,'health') - s.devast*0.4 - (s.tier>=3?0.06:0);
  let growth;
  if(ratio>=1){
    growth = 0.0135*sp.fert*Math.min(1.5,(ratio-1)*2.2+0.55)*health;
    s.starving=0;
  }else{
    growth = -0.055*(1-ratio)*(2.6-health);
    s.starving++;
    if(s.starving>=3 && s.pop>800){
      const died=s.pop*clamp((1-ratio)*0.16,0.01,0.22);
      /* a bad year is not news; a famine that empties a town is */
      if(died>s.pop*0.045)
        chron(year, died>s.pop*0.12?5:(died>s.pop*0.08?4:3),'famine',
          `Famine in ${SL(s)}. ${commify(died)} are dead of hunger.`,{sites:[s.id]});
      s.unrest+=0.20;
    }
  }
  growth += (s.unrest>0.55? -0.012:0);
  /* carrying capacity of the actual land */
  const cap = Math.max(400, s.baseFood*3400*(1+techEffect(c,'food'))*(1+techEffect(c,'growth'))
              + (s.isPort?4200:0) + s.market*2600 + s.baseSea*1500);
  if(s.pop>cap) growth -= 0.010*Math.min(3,(s.pop/cap-1));
  const f=1+growth;
  for(let k=0;k<NCLASS;k++) s.cls[k]*=f;
  /* class mobility: wealth pulls people out of the fields */
  const urb = clamp((s.wealth/(s.pop*0.9+200))*0.35 + techEffect(c,'craft')*0.5,0,0.25);
  const move = s.cls[CL_PEASANT]*urb*0.014;
  s.cls[CL_PEASANT]-=move;
  s.cls[CL_ARTISAN]+=move*0.55; s.cls[CL_MERCHANT]+=move*0.22;
  s.cls[CL_CLERIC]+=move*0.10*(1+c.vals.piety); s.cls[CL_WARRIOR]+=move*0.13;
  if(s.cls[CL_NOBLE]<s.pop*0.004) s.cls[CL_NOBLE]+=s.pop*0.00006;
  s.pop=0; for(let k=0;k<NCLASS;k++){ if(s.cls[k]<0)s.cls[k]=0; s.pop+=s.cls[k]; }
  const nt=tierOf(s.pop);
  if(nt>s.tier){
    s.tier=nt;
    if(nt>=2) chron(year, nt>=4?4:3,'grow',
      `${SL(s)} has grown into a ${TIERN[nt]}.`,{sites:[s.id]});
  } else if(nt<s.tier){ s.tier=nt; }
  s.manpower = s.cls[CL_WARRIOR]*0.62 + s.cls[CL_PEASANT]*0.045 + s.cls[CL_THRALL]*0.020;
  s.unrest=clamp(s.unrest*0.975 - 0.004 + (ratio<1?0.02:0),0,1.6);
  s.devast=Math.max(0,s.devast-0.030);
  s.wealth=Math.max(0,s.wealth*0.985);
  for(let g=0;g<NG;g++){
    s.stock[g]=clamp(s.stock[g]+s.prod[g]-s.cons[g],0, 60+s.pop*0.02);
  }
}

/* ------------------------------------------------------------- tech spread  */
function techTick(c,r,year){
  const lit = c.vals.literacy;
  const rate = 0.013*(1+techEffect(c,'tech'))*(0.30+1.8*lit)*(0.5+c.vals.curiosity)*SPECIES[c.species].tech;
  const cand=[];
  for(const t of TECHS) if(!c.techs.has(t.k)&&canLearn(c,t)) cand.push(t);
  if(!cand.length) return;
  if(chance(r, rate*cand.length*0.9)){
    const t=pickW(r,cand,tt=>1/(1+tt.era*0.65));
    c.techs.add(t.k); c.lit=lit;
    chron(year,3,'tech',`The ${CL2(c)} learn ${t.n}.`,{cults:[c.id]});
  }
}
function techDiffuse(a,b,r,year){
  /* contact copies what the other already knows */
  const gap=[];
  for(const k of b.techs) if(!a.techs.has(k)&&canLearn(a,TECHS[TECHI[k]])) gap.push(k);
  if(!gap.length) return;
  const p=0.085*(0.3+a.vals.curiosity)*(1-0.5*a.vals.xeno)*(0.4+a.vals.literacy);
  if(chance(r,p)){
    const k=pick(r,gap); a.techs.add(k);
    if(chance(r,0.25)) chron(year,2,'tech',
      `${CL2(a)} take up ${TECHS[TECHI[k]].n} from the ${CL2(b)}.`,{cults:[a.id,b.id]});
  }
}
/* A dark age: when the readers die, the books stop being copied. */
function techDecay(c,r,year){
  if(c.vals.literacy>0.12) return;
  const lose=[];
  for(const k of c.techs){ const t=TECHS[TECHI[k]]; if(t&&t.era>=2) lose.push(k); }
  if(lose.length&&chance(r,0.030)){
    const k=pick(r,lose);
    /* drop everything that depended on it */
    const dead=[k];
    let changed=true;
    while(changed){ changed=false;
      for(const q of c.techs) if(dead.indexOf(q)<0){
        const t=TECHS[TECHI[q]];
        if(t&&t.pre.some(p=>dead.indexOf(p)>=0)){ dead.push(q); changed=true; }
      }
    }
    for(const q of dead) c.techs.delete(q);
    chron(year,4,'darkage',
      `The art of ${TECHS[TECHI[k]].n} is lost to the ${CL2(c)}. ${dead.length>1?'With it goes much else.':''}`,
      {cults:[c.id]});
  }
}
