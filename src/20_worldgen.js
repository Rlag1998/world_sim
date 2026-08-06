/* ============================================================================
   PART II — WORLD GENESIS
   Plate tectonics -> orogeny -> erosion -> climate -> hydrology -> biomes
   -> soils -> ores -> leylines -> travel costs. Nothing here is hand-placed.
   ========================================================================== */

/* biome ids */
const B_DEEP=0,B_OCEAN=1,B_SHELF=2,B_LAKE=3,B_ICECAP=4,B_GLACIER=5,B_TUNDRA=6,
      B_TAIGA=7,B_BOG=8,B_TFOREST=9,B_TRAINFOREST=10,B_STEPPE=11,B_PRAIRIE=12,
      B_SHRUB=13,B_DESERT=14,B_COLDDESERT=15,B_SAVANNA=16,B_MONSOON=17,B_JUNGLE=18,
      B_MARSH=19,B_MANGROVE=20,B_ALPINE=21,B_BARREN=22,B_VOLCANIC=23,B_SALT=24,B_BADLAND=25;
const NBIOME=26;

const BIOME = [
/* 0*/{n:'Abyssal Deep',   g:'≈', c:0x0a1d31, land:0, cost:2.6, food:.05, wood:0, mv:1},
/* 1*/{n:'Open Sea',       g:'≈', c:0x113a56, land:0, cost:1.6, food:.12, wood:0, mv:1},
/* 2*/{n:'Coastal Shallows',g:'~',     c:0x1d5878, land:0, cost:1.1, food:.30, wood:0, mv:1},
/* 3*/{n:'Lake',           g:'~',      c:0x2a6f8c, land:0, cost:1.4, food:.26, wood:0, mv:1},
/* 4*/{n:'Ice Sheet',      g:'*',      c:0xb9cede, land:0, cost:4.0, food:.02, wood:0, mv:1},
/* 5*/{n:'Glacier',        g:'░', c:0xa8c2d6, land:1, cost:6.5, food:.01, wood:0, mv:0},
/* 6*/{n:'Tundra',         g:'"',      c:0x6f7a68, land:1, cost:1.5, food:.14, wood:.02,mv:1},
/* 7*/{n:'Taiga',          g:'♣', c:0x2f5a41, land:1, cost:2.0, food:.20, wood:.85,mv:1},
/* 8*/{n:'Frozen Bog',     g:',',      c:0x4a5a4a, land:1, cost:2.8, food:.16, wood:.30,mv:1},
/* 9*/{n:'Temperate Forest',g:'♠',c:0x3d7239, land:1, cost:1.8, food:.46, wood:1.0,mv:1},
/*10*/{n:'Rainforest Coast',g:'♠',c:0x2e6b4a, land:1, cost:2.2, food:.44, wood:1.1,mv:1},
/*11*/{n:'Steppe',         g:'.',      c:0x8a8a55, land:1, cost:1.0, food:.30, wood:.03,mv:1},
/*12*/{n:'Grass Plain',    g:'’', c:0x7d9448, land:1, cost:1.0, food:.72, wood:.10,mv:1},
/*13*/{n:'Scrubland',      g:'`',      c:0x8d8a4e, land:1, cost:1.2, food:.34, wood:.18,mv:1},
/*14*/{n:'Desert',         g:'·', c:0xa8925c, land:1, cost:1.9, food:.05, wood:0,  mv:1},
/*15*/{n:'Cold Desert',    g:'·', c:0x8b8878, land:1, cost:1.8, food:.06, wood:0,  mv:1},
/*16*/{n:'Savanna',        g:'"', c:0x9a9a4a, land:1, cost:1.1, food:.40, wood:.20,mv:1},
/*17*/{n:'Monsoon Forest', g:'♣', c:0x4a8237, land:1, cost:2.0, food:.62, wood:.9, mv:1},
/*18*/{n:'Jungle',         g:'♣', c:0x2f7d33, land:1, cost:3.2, food:.42, wood:1.2,mv:1},
/*19*/{n:'Marsh',          g:',',      c:0x53704a, land:1, cost:2.9, food:.38, wood:.25,mv:1},
/*20*/{n:'Mangrove',       g:',',      c:0x40714f, land:1, cost:3.0, food:.44, wood:.35,mv:1},
/*21*/{n:'Alpine Meadow',  g:'▲', c:0x77836a, land:1, cost:3.4, food:.12, wood:.15,mv:1},
/*22*/{n:'Bare Peaks',     g:'▲', c:0x8f8d86, land:1, cost:5.0, food:.02, wood:0,  mv:1},
/*23*/{n:'Ashen Waste',    g:'△', c:0x6b5148, land:1, cost:3.0, food:.04, wood:0,  mv:1},
/*24*/{n:'Salt Flat',      g:'-',      c:0xc0b8a0, land:1, cost:1.6, food:.02, wood:0,  mv:1},
/*25*/{n:'Badlands',       g:'∴', c:0x9a6f4e, land:1, cost:2.6, food:.08, wood:0,  mv:1},
];

/* resources */
const R_NONE=0,R_FISH=1,R_TIMBER=2,R_STONE=3,R_IRON=4,R_COPPER=5,R_TIN=6,R_SILVER=7,
      R_GOLD=8,R_GEMS=9,R_SALT=10,R_COAL=11,R_HORSES=12,R_FURS=13,R_OBSIDIAN=14,
      R_MARBLE=15,R_AMBER=16,R_SPICE=17,R_SILK=18,R_VINES=19,R_WHALE=20,R_PEARL=21,
      R_SULFUR=22,R_STARMETAL=23;
const RES=[
 {n:'—',s:''},{n:'Fishery',s:'fish'},{n:'Great Timber',s:'timber'},{n:'Quarry',s:'stone'},
 {n:'Iron Lode',s:'iron'},{n:'Copper Vein',s:'copper'},{n:'Tin Seam',s:'tin'},
 {n:'Silver Vein',s:'silver'},{n:'Gold Placer',s:'gold'},{n:'Gemfield',s:'gems'},
 {n:'Salt Pan',s:'salt'},{n:'Coal Measure',s:'coal'},{n:'Horse Range',s:'horses'},
 {n:'Fur Runs',s:'furs'},{n:'Obsidian Flow',s:'obsidian'},{n:'Marble Quarry',s:'marble'},
 {n:'Amber Shore',s:'amber'},{n:'Spice Groves',s:'spice'},{n:'Silkworm Groves',s:'silk'},
 {n:'Vine Slopes',s:'wine'},{n:'Whale Grounds',s:'whale'},{n:'Pearl Beds',s:'pearl'},
 {n:'Sulfur Springs',s:'sulfur'},{n:'Starmetal Fall',s:'starmetal'}
];

/* ------------------------------------------------------------- tile storage */
const T = {};
function allocTiles(){
  T.elev  = new Float32Array(NT);   // 0..1 raw
  T.alt   = new Float32Array(NT);   // land height above sea, 0..1 (ocean: negative depth)
  T.plate = new Int16Array(NT);
  T.stress= new Float32Array(NT);
  T.land  = new Uint8Array(NT);
  T.coast = new Uint8Array(NT);
  T.distSea=new Int16Array(NT);
  T.distLand=new Int16Array(NT);  // for ocean tiles: how far to the nearest shore
  T.temp  = new Float32Array(NT);   // mean annual °C
  T.tvar  = new Float32Array(NT);   // seasonal half-amplitude °C
  T.rain  = new Float32Array(NT);   // mm/yr
  T.windU = new Float32Array(NT);
  T.windV = new Float32Array(NT);
  T.fill  = new Float32Array(NT);
  T.fdir  = new Int8Array(NT);
  T.acc   = new Float32Array(NT);
  T.flow  = new Float32Array(NT);   // river discharge
  T.lake  = new Uint8Array(NT);
  T.biome = new Uint8Array(NT);
  T.fert  = new Float32Array(NT);
  T.slope = new Float32Array(NT);
  T.res   = new Uint8Array(NT);
  T.resq  = new Float32Array(NT);
  T.ley   = new Float32Array(NT);
  T.cost  = new Float32Array(NT);   // land movement cost
  T.scost = new Float32Array(NT);   // sea movement cost
  T.harbor= new Float32Array(NT);
  T.defen = new Float32Array(NT);
  T.pass  = new Uint8Array(NT);     // 1 = mountain pass / chokepoint
  /* --- mutable simulation state --- */
  T.owner = new Int16Array(NT).fill(-1);
  T.site  = new Int32Array(NT).fill(-1);
  T.dom   = new Int32Array(NT).fill(-1);   // settlement whose hinterland this tile is
  T.rpop  = new Float32Array(NT);   // rural population
  T.cult  = new Int16Array(NT).fill(-1);
  T.faith = new Int16Array(NT).fill(-1);
  T.dev   = new Float32Array(NT);   // devastation 0..1
  T.road  = new Uint8Array(NT);
  T.scar  = new Uint8Array(NT);     // elder-age cataclysm scar type
  T.ruin  = new Int32Array(NT).fill(-1);
}

/* ------------------------------------------------------------------ genesis */
let SEA = 0.5;
let RIVMIN = 26, RIVBIG = 120, RIVNAV = 400;
let PLATES = [];
let HOTSPOTS = [];

function* worldgen(seed){
  allocTiles();
  noiseInit(seed);
  const R = s=>stream(seed,s);
  /* Tongues and kindreds are invented before the rock, because the Powers who
     broke the world had names, and names need a language to be in. */
  yield [0.005,'the first tongues are spoken'];
  {
    const r0=R('bootstrap');
    langFamilies(seed, ri(r0,3,4), ri(r0,14,20));
    genSpecies(seed);
  }

  /* ---- 1. plates ------------------------------------------------------- */
  yield [0.02,'the crust congeals; plates take shape'];
  {
    const r=R('plates');
    const np = ri(r,11,17);
    PLATES=[];
    const cand=[];
    for(let k=0;k<np*14;k++) cand.push([ri(r,0,W-1),ri(r,0,H-1)]);
    /* Mitchell's best-candidate for even but irregular spacing */
    const chosen=[];
    for(let k=0;k<np;k++){
      let best=null,bd=-1;
      for(let c=0;c<12;c++){
        const p=cand[(k*12+c)%cand.length];
        let d=1e9;
        for(const q of chosen){ const dd=Math.min(d, sq(dxw(p[0],q[0]))+sq(p[1]-q[1])); d=dd; }
        if(d>bd){bd=d;best=p;}
      }
      chosen.push(best);
    }
    for(let k=0;k<np;k++){
      const oceanic = chance(r,0.55);
      const a=rf(r,0,6.2832), sp=rf(r,0.35,1.0);
      PLATES.push({
        id:k, x:chosen[k][0], y:chosen[k][1], oceanic,
        dx:Math.cos(a)*sp, dy:Math.sin(a)*sp*0.7,
        base: oceanic? rf(r,0.10,0.24) : rf(r,0.56,0.70),
        area:0
      });
    }
    /* Voronoi with a little noise so boundaries are not straight lines */
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const i=x+y*W;
      const jx = x + (fbm(x,y,seed^0x5f3a,3,3.0)-0.5)*22;
      const jy = y + (fbm(x,y,seed^0x91c2,3,3.0)-0.5)*22;
      let bp=0,bd=1e18;
      for(let k=0;k<np;k++){
        const p=PLATES[k];
        const d=sq(dxw(jx,p.x))+sq(jy-p.y);
        if(d<bd){bd=d;bp=k;}
      }
      T.plate[i]=bp; PLATES[bp].area++;
    }
  }

  /* ---- 2. boundary stress ---------------------------------------------- */
  yield [0.06,'continents collide; mountains are born in stone'];
  {
    const heap=new MinHeap(NT);
    const nearStress=new Float32Array(NT);
    const dist=new Float32Array(NT).fill(1e9);
    for(let i=0;i<NT;i++){
      const pa=T.plate[i]; let s=0,cnt=0;
      const x=i%W,y=(i/W)|0;
      for(let d=0;d<8;d++){
        const ny=y+N8Y[d]; if(ny<0||ny>=H) continue;
        const j=wrapx(x+N8X[d])+ny*W;
        const pb=T.plate[j]; if(pb===pa) continue;
        const A=PLATES[pa],Bp=PLATES[pb];
        let ux=N8X[d],uy=N8Y[d]; const ul=Math.hypot(ux,uy); ux/=ul; uy/=ul;
        // positive => A drives into B (convergent)
        const conv = (A.dx-Bp.dx)*ux + (A.dy-Bp.dy)*uy;
        let mag = conv;
        if(conv>0){
          if(!A.oceanic && !Bp.oceanic) mag*=2.35;        // continental collision
          else if(A.oceanic && !Bp.oceanic) mag*=0.45;    // A subducts: trench on A
          else if(!A.oceanic && Bp.oceanic) mag*=1.75;    // arc on A
          else mag*=0.95;                                  // island arc
        } else {
          mag *= (A.oceanic&&Bp.oceanic)? 0.55 : 1.15;    // ridge vs continental rift
        }
        s+=mag; cnt++;
      }
      if(cnt){ nearStress[i]=s/cnt; dist[i]=0; heap.push(0,i); }
    }
    /* Dijkstra spread of the nearest boundary's stress */
    const stressOf=new Float32Array(NT);
    for(let i=0;i<NT;i++) stressOf[i]=nearStress[i];
    while(heap.size){
      const i=heap.pop(); const di=heap._k;
      if(di>dist[i]+1e-6) continue;
      const x=i%W,y=(i/W)|0;
      for(let d=0;d<8;d++){
        const ny=y+N8Y[d]; if(ny<0||ny>=H) continue;
        const j=wrapx(x+N8X[d])+ny*W;
        const nd=di+N8D[d];
        if(nd<dist[j]-1e-6 && nd<26){ dist[j]=nd; stressOf[j]=stressOf[i]; heap.push(nd,j); }
      }
    }
    for(let i=0;i<NT;i++){
      const s=stressOf[i], d=dist[i];
      const fall = Math.exp(-d/(s>0? 6.5 : 4.0));
      T.stress[i] = s*fall;
    }
  }

  /* ---- 3. elevation ----------------------------------------------------- */
  yield [0.11,'the bones of the world settle'];
  {
    const r=R('hotspots');
    HOTSPOTS=[];
    const nh=ri(r,4,8);
    for(let k=0;k<nh;k++) HOTSPOTS.push({x:ri(r,0,W-1),y:ri(r,18,H-19),
      dx:rf(r,-1,1),dy:rf(r,-.4,.4),str:rf(r,0.20,0.44),len:ri(r,8,26)});
    /* paint the plume chains once, not once per tile */
    const hs=new Float32Array(NT);
    for(const hp of HOTSPOTS){
      for(let s=0;s<hp.len;s++){
        const hx=Math.round(hp.x+hp.dx*s*1.6), hy=Math.round(hp.y+hp.dy*s*1.6);
        if(hy<1||hy>=H-1) continue;
        const amp=hp.str*(1-s/(hp.len+4));
        for(let dy=-5;dy<=5;dy++){
          const y=hy+dy; if(y<0||y>=H) continue;
          for(let dx=-5;dx<=5;dx++){
            const d2=dx*dx+dy*dy; if(d2>30) continue;
            hs[wrapx(hx+dx)+y*W]+=amp*Math.exp(-d2/9);
          }
        }
      }
    }
    for(let y=0;y<H;y++){
      const l=Math.abs(latOf(y));
      const polar = l>0.93? (l-0.93)*1.6 : 0;
      for(let x=0;x<W;x++){
        const i=x+y*W;
        let e = PLATES[T.plate[i]].base;
        const st=T.stress[i];
        if(st>0) e += st*0.92*(0.45+0.85*ridge(x,y,seed^0x1234,5,4.2));
        else     e += st*0.42;
        e += (fbm(x,y,seed^0xabc,5,1.7)-0.5)*0.30;
        e += (fbm(x,y,seed^0xdef,4,6.0)-0.5)*0.055;
        T.elev[i]=e+hs[i]+polar;
      }
    }
    /* smooth once to kill single-tile spikes */
    const tmp=new Float32Array(NT);
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const i=x+y*W; let s=T.elev[i]*2,w=2;
      for(let d=0;d<8;d++){ const ny=y+N8Y[d]; if(ny<0||ny>=H)continue;
        s+=T.elev[wrapx(x+N8X[d])+ny*W]; w++; }
      tmp[i]=s/w;
    }
    T.elev.set(tmp);
  }

  /* ---- 4. sea level ----------------------------------------------------- */
  yield [0.16,'the waters find their level'];
  {
    const BINS=2048, hist=new Int32Array(BINS);
    let mn=1e9,mx=-1e9;
    for(let i=0;i<NT;i++){ const e=T.elev[i]; if(e<mn)mn=e; if(e>mx)mx=e; }
    const span=Math.max(1e-6,mx-mn);
    for(let i=0;i<NT;i++) hist[clamp(((T.elev[i]-mn)/span*(BINS-1))|0,0,BINS-1)]++;
    let want=Math.round(NT*(1-SEA_TARGET)), acc=0, b=0;
    for(;b<BINS;b++){ acc+=hist[b]; if(acc>=want) break; }
    SEA = mn + (b/(BINS-1))*span;
    const top=mx-SEA||1, bot=SEA-mn||1;
    for(let i=0;i<NT;i++){
      const e=T.elev[i];
      T.land[i]= e>SEA?1:0;
      T.alt[i] = e>SEA? (e-SEA)/top : -(SEA-e)/bot;
    }
  }

  /* ---- 5. the old power settles into the rock --------------------------- */
  yield [0.19,'the world hums with an older power'];
  leylines(seed);

  /* ---- 6. the Elder Age breaks the world -------------------------------- */
  yield [0.23,'before the counting of years, the world was broken'];
  elderShape(seed);

  /* ---- 7. shores, then climate ------------------------------------------ */
  yield [0.28,'shores are drawn; winds rise'];
  distanceFromSea();
  climate(seed);

  /* ---- 8. erosion & hydrology ------------------------------------------- */
  yield [0.34,'rain carves the highlands'];
  for(let pass=0;pass<2;pass++){
    priorityFlood();
    flowRouting();
    /* stream-power erosion */
    for(let i=0;i<NT;i++){
      if(!T.land[i]) continue;
      const a=T.acc[i], s=T.slope[i];
      const e=Math.min(0.055, 0.00055*Math.pow(a,0.42)*Math.pow(s+0.02,0.9));
      T.elev[i]-=e;
    }
    /* isostatic-ish smoothing of the eroded field */
    const tmp=new Float32Array(NT);
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const i=x+y*W; let s=T.elev[i]*3,w=3;
      for(let d=0;d<8;d+=2){ const ny=y+N8Y[d]; if(ny<0||ny>=H)continue;
        s+=T.elev[wrapx(x+N8X[d])+ny*W]; w++; }
      tmp[i]=s/w;
    }
    for(let i=0;i<NT;i++) if(T.land[i]) T.elev[i]=tmp[i];
    for(let i=0;i<NT;i++){
      const e=T.elev[i];
      T.land[i]= e>SEA?1:0;
      T.alt[i] = e>SEA? Math.max(0,(e-SEA))/(1-SEA) : -(SEA-e)/(SEA||1);
    }
    yield [0.34+0.04*(pass+1),'rivers seek the sea ('+(pass+1)+')'];
  }
  levelSea();
  distanceFromSea();
  climate(seed);
  priorityFlood();
  flowRouting();
  rivers();

  /* ---- 9. biomes & soils ------------------------------------------------ */
  yield [0.46,'green things take root'];
  biomes(seed);
  soils(seed);

  /* ---- 10. ores & riches ------------------------------------------------- */
  yield [0.52,'ore settles in the deep places'];
  resources(seed);
  /* the scars and the fire-mountains hold power the plain rock does not */
  for(let i=0;i<NT;i++){
    if(T.scar[i]) T.ley[i]=clamp(T.ley[i]+0.35,0,2.2);
    if(T.biome[i]===B_VOLCANIC) T.ley[i]=clamp(T.ley[i]+0.30,0,2.2);
  }

  /* ---- 11. travel, harbours, chokepoints -------------------------------- */
  yield [0.58,'roads that are not yet roads'];
  travelCosts();
  harbours();
  chokepoints();
}

/* ------------------------------------------------------------- sub-passes  */
/* Choose the waterline that gives the land fraction we asked for. */
function levelSea(){
  const BINS=2048, hist=new Int32Array(BINS);
  let mn=1e9,mx=-1e9;
  for(let i=0;i<NT;i++){ const e=T.elev[i]; if(e<mn)mn=e; if(e>mx)mx=e; }
  const span=Math.max(1e-6,mx-mn);
  for(let i=0;i<NT;i++) hist[clamp(((T.elev[i]-mn)/span*(BINS-1))|0,0,BINS-1)]++;
  const want=Math.round(NT*(1-SEA_TARGET));
  let acc=0,b=0;
  for(;b<BINS;b++){ acc+=hist[b]; if(acc>=want) break; }
  SEA = mn + (b/(BINS-1))*span;
  const top=Math.max(1e-6,mx-SEA), bot=Math.max(1e-6,SEA-mn);
  for(let i=0;i<NT;i++){
    const e=T.elev[i];
    T.land[i]= e>SEA?1:0;
    T.alt[i] = e>SEA? (e-SEA)/top : -(SEA-e)/bot;
  }
}
function distanceFromSea(){
  T.distSea.fill(0);
  const q=new Int32Array(NT); let qh=0,qt=0;
  const seen=new Uint8Array(NT);
  for(let i=0;i<NT;i++) if(!T.land[i]){ q[qt++]=i; seen[i]=1; T.distSea[i]=0; }
  while(qh<qt){
    const i=q[qh++]; const d=T.distSea[i];
    const x=i%W,y=(i/W)|0;
    for(let k=0;k<8;k++){
      const ny=y+N8Y[k]; if(ny<0||ny>=H) continue;
      const j=wrapx(x+N8X[k])+ny*W;
      if(seen[j]) continue; seen[j]=1;
      T.distSea[j]=Math.min(32000,d+1); q[qt++]=j;
    }
  }
  for(let i=0;i<NT;i++){
    T.coast[i]=0;
    if(T.land[i]&&T.distSea[i]===1) T.coast[i]=1;
  }
  /* and the mirror field: how far out to sea are we? this is what lets the
     map draw a shelf, a sea and an abyss instead of one flat blue. */
  T.distLand.fill(0);
  const q2=new Int32Array(NT); let h2=0,t2=0;
  const seen2=new Uint8Array(NT);
  for(let i=0;i<NT;i++) if(T.land[i]){ q2[t2++]=i; seen2[i]=1; }
  while(h2<t2){
    const i=q2[h2++]; const d=T.distLand[i];
    const x=i%W,y=(i/W)|0;
    for(let k=0;k<8;k++){
      const ny=y+N8Y[k]; if(ny<0||ny>=H) continue;
      const j=wrapx(x+N8X[k])+ny*W;
      if(seen2[j]) continue; seen2[j]=1;
      T.distLand[j]=Math.min(400,d+1); q2[t2++]=j;
    }
  }
}

function climate(seed){
  /* winds by circulation cell, blended */
  for(let y=0;y<H;y++){
    const l=latOf(y), al=Math.abs(l), sgn=l>=0?1:-1;
    let u,v;
    const t1=smooth(clamp((al-0.28)/0.10,0,1));      // trades -> westerlies
    const t2=smooth(clamp((al-0.62)/0.10,0,1));      // westerlies -> polar
    const trU=-0.95, wsU=0.95, poU=-0.75;
    u = lerp(lerp(trU,wsU,t1), poU, t2);
    const trV=-0.32*sgn, wsV=0.22*sgn, poV=-0.18*sgn;
    v = lerp(lerp(trV,wsV,t1), poV, t2);
    for(let x=0;x<W;x++){
      const i=x+y*W;
      const n=(fbm(x,y,seed^0x77a1,3,3.0)-0.5)*0.32;
      let uu=u+n, vv=v+n*0.5;
      const m=Math.hypot(uu,vv)||1;
      T.windU[i]=uu/m; T.windV[i]=vv/m;
    }
  }
  /* temperature */
  for(let y=0;y<H;y++){
    const al=Math.abs(latOf(y));
    const base = 31 - 57*Math.pow(al,1.55);
    for(let x=0;x<W;x++){
      const i=x+y*W;
      const cont=clamp(T.distSea[i]/14,0,1);
      const km = T.land[i]? T.alt[i]*5.4 : 0;
      let t = base - km*6.3 + (fbm(x,y,seed^0x2b7,4,5.0)-0.5)*3.2;
      t += cont*(al<0.30? 1.4 : -1.8);
      T.temp[i]=t;
      T.tvar[i]= 3 + 26*Math.pow(al,1.3)*(0.35+0.65*cont);
    }
  }
  /* rainfall: latitudinal circulation + upwind moisture advection + orography */
  const K=42;
  for(let y=0;y<H;y++){
    const al=Math.abs(latOf(y));
    const itcz=Math.exp(-sq((al-0.015)/0.145));
    const mid =Math.exp(-sq((al-0.585)/0.170));
    const sub =Math.exp(-sq((al-0.320)/0.115));
    const pol =Math.exp(-sq((al-1.000)/0.180));
    let base = 2500*itcz + 1150*mid - 780*sub - 300*pol + 430;
    if(base<50) base=50;
    for(let x=0;x<W;x++){
      const i=x+y*W;
      if(!T.land[i]){ T.rain[i]=base*1.15; continue; }
      /* march upwind gathering moisture */
      let px=x+0.5, py=y+0.5, m=0, carry=1, prevE=T.elev[i];
      for(let k=0;k<K;k++){
        const ii=wrapx(Math.floor(px))+clamp(Math.floor(py),0,H-1)*W;
        px-=T.windU[ii]; py-=T.windV[ii];
        if(py<0||py>=H) break;
        const j=wrapx(Math.floor(px))+(Math.floor(py)|0)*W;
        const rise=Math.max(0,prevE-T.elev[j]);   // ground climbs going downwind
        carry*=Math.exp(-rise*7.4);
        if(!T.land[j]){
          m += carry*(0.55+0.030*clamp(T.temp[j],-5,30))*Math.exp(-k/26);
        }else{
          carry*=0.9825;
          m += carry*0.055*BIOMEWET(T,j)*Math.exp(-k/26);
        }
        prevE=T.elev[j];
        if(carry<0.02) break;
      }
      const adv=clamp(m/9,0,1.8);
      /* local orographic lift */
      const uw = wrapx(Math.round(x-T.windU[i]*2))+clamp(Math.round(y-T.windV[i]*2),0,H-1)*W;
      const lift=Math.max(0,T.elev[i]-T.elev[uw]);
      let rr = base*(0.30+0.86*adv) * (1 + 4.2*lift);
      rr *= (0.80+0.40*fbm(x,y,seed^0x9911,4,6.0));
      T.rain[i]=clamp(rr,15,5200);
    }
  }
}
/* transpiration proxy for the moisture march (avoids a forward reference) */
function BIOMEWET(T,j){ return T.rain[j]>0? clamp(T.rain[j]/1400,0.05,1) : 0.35; }

/* Priority-flood depression filling (Barnes 2014). */
function priorityFlood(){
  const heap=new MinHeap(NT);
  const done=new Uint8Array(NT);
  for(let i=0;i<NT;i++) T.fill[i]=T.elev[i];
  for(let i=0;i<NT;i++){
    if(!T.land[i]){ done[i]=1; heap.push(T.elev[i],i); }
  }
  for(let x=0;x<W;x++){
    for(const y of [0,H-1]){ const i=x+y*W; if(!done[i]){ done[i]=1; heap.push(T.elev[i],i); } }
  }
  const EPS=2e-5;
  while(heap.size){
    const i=heap.pop(); const ei=T.fill[i];
    const x=i%W,y=(i/W)|0;
    for(let d=0;d<8;d++){
      const ny=y+N8Y[d]; if(ny<0||ny>=H) continue;
      const j=wrapx(x+N8X[d])+ny*W;
      if(done[j]) continue; done[j]=1;
      if(T.fill[j]<=ei) T.fill[j]=ei+EPS;
      heap.push(T.fill[j],j);
    }
  }
}

let ORDER=null;
function flowRouting(){
  /* steepest descent on the filled surface */
  for(let i=0;i<NT;i++){
    if(!T.land[i]){ T.fdir[i]=-1; T.slope[i]=0; continue; }
    const x=i%W,y=(i/W)|0, e=T.fill[i];
    let bd=-1,bs=0;
    for(let d=0;d<8;d++){
      const ny=y+N8Y[d]; if(ny<0||ny>=H) continue;
      const j=wrapx(x+N8X[d])+ny*W;
      const s=(e-T.fill[j])/N8D[d];
      if(s>bs){bs=s;bd=d;}
    }
    T.fdir[i]=bd; T.slope[i]=clamp(bs*11,0,1);
  }
  /* accumulate in descending filled-elevation order */
  if(!ORDER||ORDER.length!==NT) ORDER=new Int32Array(NT);
  for(let i=0;i<NT;i++) ORDER[i]=i;
  const f=T.fill;
  const arr=Array.from(ORDER);
  arr.sort((a,b)=>f[b]-f[a]);
  for(let i=0;i<NT;i++) ORDER[i]=arr[i];
  for(let i=0;i<NT;i++) T.acc[i]= T.land[i]? (0.35+T.rain[i]/1100) : 0;
  for(let k=0;k<NT;k++){
    const i=ORDER[k]; const d=T.fdir[i];
    if(d<0) continue;
    const x=i%W,y=(i/W)|0, ny=y+N8Y[d];
    if(ny<0||ny>=H) continue;
    const j=wrapx(x+N8X[d])+ny*W;
    T.acc[j]+=T.acc[i];
  }
}

function rivers(){
  T.lake.fill(0);
  /* A river is a river relative to the world it is in: take the wettest 4%
     of land, so small continents still get drawn a river network. */
  const samp=[];
  for(let i=0;i<NT;i+=3) if(T.land[i]) samp.push(T.acc[i]);
  samp.sort((a,b)=>a-b);
  RIVMIN = samp.length? clamp(samp[Math.floor(samp.length*0.960)],4,60) : 26;
  RIVBIG = RIVMIN*4.5; RIVNAV = RIVMIN*13;
  for(let i=0;i<NT;i++){
    T.flow[i]=0;
    if(!T.land[i]) continue;
    if(T.fill[i]-T.elev[i] > 0.0055 && T.acc[i]>RIVMIN*0.35) T.lake[i]=1;
    if(T.acc[i]>RIVMIN) T.flow[i]=T.acc[i];
  }
  /* lakes become water tiles for climate/biome purposes */
  for(let i=0;i<NT;i++) if(T.lake[i]) T.biome[i]=B_LAKE;
}

function biomes(seed){
  for(let i=0;i<NT;i++){
    if(!T.land[i]){
      const a=T.alt[i];
      if(T.temp[i]<-9 && T.distSea[i]===0 && Math.abs(latOf((i/W)|0))>0.80) { T.biome[i]=B_ICECAP; continue; }
      T.biome[i] = a>-0.10? B_SHELF : (a>-0.45? B_OCEAN : B_DEEP);
      continue;
    }
    if(T.lake[i]){ T.biome[i]=B_LAKE; continue; }
    const t=T.temp[i], p=T.rain[i], al=T.alt[i], sl=T.slope[i];
    let b;
    if(al>0.68 && t<-4) b=B_GLACIER;
    else if(al>0.62) b= t<2? B_BARREN : (p>700? B_ALPINE : B_BARREN);
    else if(al>0.46) b= t<-2? B_GLACIER : (p>560? B_ALPINE : (t>19&&p<260? B_BADLAND : B_BARREN));
    else if(t<-11) b=B_ICECAP;
    else if(t<-4)  b= p>240? B_TUNDRA : B_COLDDESERT;
    else if(t<2.5) b= p>460? (p>900&&sl<0.12? B_BOG : B_TAIGA) : (p>190? B_TUNDRA : B_COLDDESERT);
    else if(t<9)   b= p>950? B_TAIGA : (p>430? B_TFOREST : (p>210? B_STEPPE : B_COLDDESERT));
    else if(t<17){
      if(p>1500) b=B_TRAINFOREST; else if(p>800) b=B_TFOREST;
      else if(p>470) b=B_PRAIRIE; else if(p>250) b=B_STEPPE; else b=B_DESERT;
    } else if(t<23){
      if(p>1700) b=B_TRAINFOREST; else if(p>1000) b=B_TFOREST;
      else if(p>620) b=B_PRAIRIE; else if(p>340) b=B_SHRUB;
      else if(p>170) b=B_STEPPE; else b=B_DESERT;
    } else {
      if(p>2100) b=B_JUNGLE; else if(p>1250) b=B_MONSOON;
      else if(p>620) b=B_SAVANNA; else if(p>300) b=B_SHRUB; else b=B_DESERT;
    }
    /* wetlands where water pools on flat ground */
    if(sl<0.05 && T.acc[i]>120 && al<0.30 && b!==B_DESERT)
      b = t>21? (T.coast[i]? B_MANGROVE : B_MARSH) : (t<1? B_BOG : B_MARSH);
    /* endorheic salt flats: big flow that never reaches the sea */
    if(b===B_DESERT && T.fill[i]-T.elev[i]>0.004 && T.acc[i]>40) b=B_SALT;
    T.biome[i]=b;
  }
  /* volcanic waste near hot plumes */
  for(const hp of HOTSPOTS){
    for(let s=0;s<hp.len;s+=3){
      const hx=hp.x+hp.dx*s*1.6, hy=hp.y+hp.dy*s*1.6;
      if(hy<1||hy>=H-1) continue;
      const i=wrapx(Math.round(hx))+Math.round(hy)*W;
      if(T.land[i]&&T.alt[i]>0.30){ T.biome[i]=B_VOLCANIC;
        nb8(i,j=>{ if(T.land[j]&&T.alt[j]>0.34&&h2(j,7,3)%5===0) T.biome[j]=B_VOLCANIC; }); }
    }
  }
}

function soils(seed){
  for(let i=0;i<NT;i++){
    if(!T.land[i]){ T.fert[i]=0; continue; }
    const b=BIOME[T.biome[i]];
    let f=b.food;
    /* floodplain / delta bonus */
    if(T.acc[i]>60) f+=0.30*clamp(Math.log(T.acc[i])/8,0,1);
    let riverAdj=0; nb4(i,j=>{ if(T.flow[j]>0) riverAdj=1; });
    if(riverAdj) f+=0.13;
    if(T.biome[i]===B_VOLCANIC) f=0.10;
    let volc=0; nb8(i,j=>{ if(T.biome[j]===B_VOLCANIC) volc=1; });
    if(volc) f+=0.26;
    f *= (1-0.62*T.slope[i]);
    f *= (0.86+0.28*fbm(i%W,(i/W)|0,seed^0x33aa,3,9.0));
    /* growing season */
    const gs = clamp((T.temp[i]+4)/16,0,1.15);
    f *= (0.30+0.80*gs);
    T.fert[i]=clamp(f,0,1.25);
  }
}

function resources(seed){
  const r=stream(seed,'ores');
  const oro=new Float32Array(NT);
  for(let i=0;i<NT;i++) oro[i]=Math.max(0,T.stress[i]);
  for(let i=0;i<NT;i++){
    T.res[i]=R_NONE; T.resq[i]=0;
    const x=i%W,y=(i/W)|0, b=T.biome[i], al=T.alt[i];
    const n1=fbm(x,y,seed^0x1a1,3,16.0), n2=fbm(x,y,seed^0x2b2,3,22.0), n3=fbm(x,y,seed^0x3c3,3,11.0);
    if(!T.land[i]){
      if(b===B_SHELF && n1>0.72){ T.res[i]=R_FISH; T.resq[i]=0.6+n1*0.8; }
      else if(b===B_OCEAN && n2>0.86){ T.res[i]=R_WHALE; T.resq[i]=0.7+n2*0.5; }
      else if(b===B_SHELF && T.temp[i]>22 && n3>0.84){ T.res[i]=R_PEARL; T.resq[i]=0.6+n3*0.6; }
      continue;
    }
    const metallic = oro[i]*2.4 + al*0.9;
    let best=R_NONE, q=0;
    const put=(id,v)=>{ if(v>q){q=v;best=id;} };
    if(metallic>0.55){
      put(R_IRON,   (n1-0.50)*2.6*metallic);
      put(R_COPPER, (n2-0.55)*2.4*metallic);
      put(R_TIN,    (n3-0.66)*2.9*metallic);
      put(R_SILVER, (n1*n2-0.34)*3.0*metallic);
      put(R_GOLD,   (n2*n3-0.40)*3.6*metallic);
      put(R_GEMS,   (n1*n3-0.44)*3.8*metallic);
    }
    if(al>0.34) put(R_STONE,(n2-0.42)*1.5);
    if(al>0.40 && n1*n3>0.34) put(R_MARBLE,(n1*n3-0.34)*2.0);
    if(b===B_TFOREST||b===B_TAIGA||b===B_TRAINFOREST||b===B_JUNGLE||b===B_MONSOON)
      put(R_TIMBER,(n3-0.40)*1.9*BIOME[b].wood);
    if(b===B_TAIGA||b===B_TUNDRA||b===B_BOG) put(R_FURS,(n1-0.46)*2.1);
    if(b===B_STEPPE||b===B_PRAIRIE) put(R_HORSES,(n2-0.50)*2.6);
    if(b===B_SALT) put(R_SALT,1.1);
    if(T.coast[i] && T.rain[i]<520 && T.temp[i]>16) put(R_SALT,(n1-0.44)*2.2);
    if((b===B_MARSH||b===B_BOG) && T.temp[i]>2) put(R_COAL,(n2-0.60)*2.6);
    if(b===B_TFOREST && T.distSea[i]<9 && T.temp[i]<12) put(R_AMBER,(n3-0.70)*2.6);
    if(b===B_VOLCANIC) put(R_OBSIDIAN,0.9+n1*0.4);
    if(b===B_VOLCANIC||(al>0.5&&n2>0.80)) put(R_SULFUR,(n2-0.66)*2.2);
    if(b===B_JUNGLE||b===B_MONSOON) put(R_SPICE,(n1-0.56)*2.5);
    if((b===B_MONSOON||b===B_TFOREST)&&T.temp[i]>15) put(R_SILK,(n3-0.66)*2.5);
    if(b===B_SHRUB||(b===B_TFOREST&&T.temp[i]>13&&T.rain[i]<900))
      put(R_VINES,(n2-0.52)*2.3);
    if(q>0.05){ T.res[i]=best; T.resq[i]=clamp(q,0.1,1.6); }
  }
  /* starmetal: rare, always dramatic — a handful of meteor falls */
  const nfall=ri(r,2,5);
  for(let k=0;k<nfall;k++){
    for(let a=0;a<400;a++){
      const i=ri(r,0,NT-1);
      if(T.land[i]&&T.alt[i]>0.12){ T.res[i]=R_STARMETAL; T.resq[i]=rf(r,0.9,1.6); break; }
    }
  }
}

function leylines(seed){
  /* Power pools where the crust is torn and where the world's old wounds lie. */
  for(let i=0;i<NT;i++){
    const x=i%W,y=(i/W)|0;
    const t=Math.abs(T.stress[i]);
    const n=fbm(x,y,seed^0x7e11,5,3.4);
    const nn=ridge(x,y,seed^0x4d21,4,5.0);
    let v = 0.34*t*2.2 + 0.42*Math.pow(nn,2.1) + 0.24*n;
    if(T.biome[i]===B_VOLCANIC) v+=0.30;
    if(T.lake[i]) v+=0.06;
    T.ley[i]=clamp(v,0,1.6);
  }
}

function travelCosts(){
  for(let i=0;i<NT;i++){
    const b=BIOME[T.biome[i]];
    if(!T.land[i]){
      T.cost[i]=999;
      let c = 1.0 + Math.max(0,-T.alt[i])*2.6;      // open ocean is dangerous
      if(T.biome[i]===B_SHELF) c=0.68;
      if(T.biome[i]===B_ICECAP) c=6.0;
      T.scost[i]=c;
    }else{
      let c=b.cost + T.slope[i]*4.2 + Math.max(0,T.alt[i]-0.3)*3.0;
      if(T.flow[i]>RIVBIG) c+=2.2;                      // major river crossing
      T.cost[i]=c;
      T.scost[i]= T.flow[i]>RIVNAV? 1.3 : 999;          // great rivers are navigable
    }
  }
}

function harbours(){
  for(let i=0;i<NT;i++){
    T.harbor[i]=0;
    if(!T.land[i]||!T.coast[i]) continue;
    let water=0, shelter=0, deep=0;
    nb8(i,j=>{ if(!T.land[j]){ water++; if(T.biome[j]===B_SHELF) shelter++; } else shelter+=0.5; });
    const x=i%W,y=(i/W)|0;
    for(let d=0;d<8;d++){
      const ny=y+N8Y[d]*3; if(ny<0||ny>=H) continue;
      const j=wrapx(x+N8X[d]*3)+ny*W;
      if(!T.land[j]&&T.alt[j]<-0.10) deep++;
    }
    if(water<1) continue;
    let h = (Math.min(water,4)/4)*0.42 + (shelter/8)*0.36 + Math.min(deep,3)/3*0.22;
    if(T.flow[i]>RIVBIG) h+=0.30;                        // river mouth
    if(T.lake[i]) h*=0.4;
    const ice = T.temp[i]<-6? 0.35 : 1;
    T.harbor[i]=clamp(h*ice,0,1.4);
  }
}

function chokepoints(){
  /* A pass is cheap ground flanked by expensive ground on opposite sides. */
  for(let i=0;i<NT;i++){
    T.pass[i]=0; T.defen[i]=0;
    if(!T.land[i]) continue;
    const x=i%W,y=(i/W)|0;
    const c=[];
    for(let d=0;d<8;d++){
      const ny=y+N8Y[d]; if(ny<0||ny>=H){ c.push(99); continue; }
      c.push(T.cost[wrapx(x+N8X[d])+ny*W]);
    }
    let def = T.slope[i]*0.55 + Math.max(0,T.alt[i]-0.18)*0.9;
    let water=0; nb4(i,j=>{ if(!T.land[j]||T.flow[j]>RIVBIG||T.lake[j]) water++; });
    def += water*0.12;
    T.defen[i]=clamp(def,0,1);
    const me=T.cost[i];
    if(me>2.6) continue;
    for(let d=0;d<4;d++){
      const a=c[d], b=c[(d+4)%8], p=c[(d+2)%8], q=c[(d+6)%8];
      if(a>3.6&&b>3.6&&p<2.4&&q<2.4){ T.pass[i]=1; T.defen[i]=clamp(def+0.35,0,1); break; }
    }
  }
}
