/* Headless harness: runs the simulation core in node with a stub DOM. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const files=['10_core.js','20_worldgen.js','30_lang.js','40_peoples.js','50_econ.js',
             '60_char.js','65_polity.js','70_war.js','80_myth.js','85_sim.js'];
let src=files.map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const ctx={console,performance:{now:()=>Number(process.hrtime.bigint()/1000n)/1000},Math,Date,JSON,Set,Map,
  Float32Array,Float64Array,Int32Array,Int16Array,Int8Array,Uint8Array,Uint16Array,Array,Object,String,Number,parseInt,isNaN};
ctx.globalThis=ctx;
ctx.MAPDIRTY=false;
vm.createContext(ctx);
src += "\n;globalThis.__G={SITES,POLS,CHARS,DYNS,LIVING,WARS,ARMIES,EVENTS,LANGS,CULTURES,FAITHS,ARTS,RUINS,PROPHS,SPECIES,STAT,T,BIOME,NT,MAGIC,POWERS,CATACLYSMS};"
     + "\nglobalThis.__snap=()=>({SITES,POLS,CHARS,LIVING,WARS,ARMIES,EVENTS,LANGS,CULTURES,FAITHS,ARTS,RUINS,PROPHS,DYNS,MAGIC,YEAR});";
vm.runInContext(src,ctx,{filename:'worldsim.js'});
const t0=Date.now();
const seed=parseInt(process.argv[2]||'12345',10);
const gen=ctx.worldgen(seed);
let step;
let tp=Date.now();
while(!(step=gen.next()).done){ const d=Date.now()-tp; tp=Date.now();
  console.log('   +'+d+'ms ->',(step.value[0]*100|0)+'%',step.value[1]); }
console.log('   +'+(Date.now()-tp)+'ms -> tail');
console.log('worldgen',Date.now()-t0,'ms');
const t1=Date.now();
ctx.worldBirth(seed);
console.log('worldBirth',Date.now()-t1,'ms');
const years=parseInt(process.argv[3]||'200',10);
const t2=Date.now();
let marks=[];
for(let k=0;k<years;k++){
  const a=Date.now();
  ctx.tickYear();
  const d=Date.now()-a;
  if(d>60) marks.push(ctx.YEAR+':'+d+'ms');
}
const tot=Date.now()-t2;
console.log('sim',years,'yr in',tot,'ms =',(tot/years).toFixed(2),'ms/yr');
if(marks.length) console.log('slow years:',marks.slice(0,20).join(' '));
ctx.recomputeStats();
console.log(JSON.stringify(ctx.__snap&&ctx.recomputeStats?(()=>{ctx.recomputeStats();return ctx.__G.STAT;})():{}));
const g=ctx.__snap();
console.log('sites',g.SITES.length,'pols',g.POLS.length,'chars',g.CHARS.length,'living',g.LIVING.size,
  'wars',g.WARS.length,'live',g.WARS.filter(w=>w.ended<0).length,'armies',g.ARMIES.length,
  'events',g.EVENTS.length,'langs',g.LANGS.length,'cults',g.CULTURES.length,'faiths',g.FAITHS.length,
  'arts',g.ARTS.length,'ruins',g.RUINS.length,'proph',g.PROPHS.length,'magic',g.MAGIC.toFixed(3));
const T=ctx.__G.T,NT=ctx.__G.NT,BIOME=ctx.__G.BIOME,H_=160;
let land=0,riv=0,lake=0; for(let i=0;i<NT;i++){ if(T.land[i])land++; if(T.flow[i]>26)riv++; if(T.lake[i])lake++; }
console.log('land',land,'('+(land/NT*100).toFixed(1)+'%)','river tiles',riv,'lake',lake);
const bc={}; for(let i=0;i<NT;i++){const n=BIOME[T.biome[i]].n; bc[n]=(bc[n]||0)+1;}
console.log('biomes',Object.entries(bc).sort((a,b)=>b[1]-a[1]).map(x=>x[0]+':'+x[1]).join(', '));
console.log('names', g.SITES.slice(0,10).map(s=>s.name+' ("'+s.gloss+'")').join(' | '));
console.log('langs', g.LANGS.slice(0,4).map(l=>l.name+' ['+['water','king','wolf','death','stone'].map(w=>l.say(w)).join(',')+']').join(' | '));
console.log('\n--- major events ---');
for(const e of g.EVENTS.filter(e=>e.s>=4).slice(-30)) console.log(e.y,'|',e.t.replace(/<[^>]+>/g,''));

// --- hydrology probe ---
{
  const acc=[]; for(let i=0;i<NT;i++) if(T.land[i]) acc.push(T.acc[i]);
  acc.sort((a,b)=>a-b);
  const q=p=>acc[Math.min(acc.length-1,(acc.length*p)|0)].toFixed(1);
  console.log('acc percentiles p50',q(.5),'p90',q(.9),'p99',q(.99),'p999',q(.999),'max',acc[acc.length-1].toFixed(0));
  let lat=[]; for(let y=0;y<H_;y+=16) lat.push(y+':'+ctx.latOf(y).toFixed(2));
  console.log('lat rows',lat.join(' '));
}
