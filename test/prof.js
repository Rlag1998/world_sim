const fs=require('fs'),path=require('path'),vm=require('vm');
const files=['10_core.js','20_worldgen.js','30_lang.js','40_peoples.js','50_econ.js',
             '60_char.js','65_polity.js','70_war.js','80_myth.js','85_sim.js'];
let src=files.map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
// inject stage markers into tickYear so a hang can be located
src=src.replace(/\/\* ---- (the sky|the land|elder folk fade|plague|the people|the gods|the blood|the realms|the sword|new ground|the old power) ([^*]*)\*\//g,
                (m,a)=>`__mark(${JSON.stringify(a)});`);
// mark EVERY function entry; cheap (array store + counter), and the counter
// converts an infinite loop into a throw with a real stack trace.
src=src.replace(/\bfunction ([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
  (m,name,args)=>`function ${name}(${args}){ __mark(${JSON.stringify(name)});`);
src+="\n;globalThis.__snap=()=>({SITES,POLS,CHARS,LIVING,WARS,ARMIES,EVENTS,LANGS,CULTURES,FAITHS,ARTS,RUINS,PROPHS,DYNS,MAGIC,YEAR,STAT});";
const ctx={console,performance:{now:()=>Number(process.hrtime.bigint()/1000n)/1000},Math,Date,JSON,Set,Map,
  Float32Array,Float64Array,Int32Array,Int16Array,Int8Array,Uint8Array,Uint16Array,Array,Object,String,Number,parseInt,isNaN};
ctx.globalThis=ctx; ctx.MAPDIRTY=false;
let _mc=0; const _ring=new Array(48).fill(''); let _ri=0;
let _armed=false;
ctx.__arm=()=>{_armed=true;};
ctx.__mark=(s)=>{ _ring[(_ri++)&47]=s;
  if(_armed && ++_mc>6e6){ _mc=0; const o=[]; for(let k=0;k<48;k++) o.push(_ring[(_ri+k)&47]);
    throw new Error('BUDGET EXCEEDED. last calls: '+o.join(' > ')); } };
ctx.__resetBudget=()=>{ _mc=0; };
vm.createContext(ctx); vm.runInContext(src,ctx,{filename:'ws.js'});
const seed=+(process.argv[2]||12345), years=+(process.argv[3]||300);
const g=ctx.worldgen(seed); while(!g.next().done);
ctx.worldBirth(seed); ctx.__arm();
let t=Date.now(), bucket=Date.now();
for(let k=1;k<=years;k++){
  ctx.__resetBudget();
  ctx.tickYear();
  if(k%1===0){
    const s=ctx.__snap();
    console.log('yr',s.YEAR,'|',(Date.now()-bucket)+'ms','| sites',s.SITES.filter(x=>x.alive).length,
      'pols',s.POLS.filter(p=>p.alive).length,'living',s.LIVING.size,'chars',s.CHARS.length,
      'armies',s.ARMIES.length,'wars',s.WARS.filter(w=>w.ended<0).length,'ev',s.EVENTS.length,
      'pop',Math.round(s.STAT.pop),'cults',s.CULTURES.length,'faiths',s.FAITHS.length);
    bucket=Date.now();
  }
}
console.log('total',Date.now()-t,'ms');
