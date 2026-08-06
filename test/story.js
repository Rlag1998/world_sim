const fs=require('fs'),path=require('path'),vm=require('vm');
const files=['10_core.js','20_worldgen.js','30_lang.js','40_peoples.js','50_econ.js',
             '60_char.js','65_polity.js','70_war.js','80_myth.js','85_sim.js'];
let src=files.map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
src+="\n;globalThis.__g=()=>({SITES,POLS,CHARS,LIVING,WARS,ARMIES,EVENTS,LANGS,CULTURES,FAITHS,ARTS,RUINS,PROPHS,DYNS,MAGIC,YEAR,STAT,SPECIES,POWERS,CATACLYSMS,LEGENDS,retell,polityPop,C,P,fullName,sigilText,TECHS,TECHI,TRAITS,CBI});";
const ctx={console,performance:{now:()=>Number(process.hrtime.bigint()/1000n)/1000},Math,Date,JSON,Set,Map,
  Float32Array,Float64Array,Int32Array,Int16Array,Int8Array,Uint8Array,Uint16Array,Array,Object,String,Number,parseInt,isNaN};
ctx.globalThis=ctx; ctx.MAPDIRTY=false; ctx.WORLDNAME=''; ctx.VIEWDIRTY=false; ctx.HILITE={t:null,i:-1};
vm.createContext(ctx); vm.runInContext(src,ctx,{filename:'ws.js'});
const seed=+(process.argv[2]||12345), years=+(process.argv[3]||600);
const gg=ctx.worldgen(seed); while(!gg.next().done);
ctx.worldBirth(seed);
for(let k=0;k<years;k++) ctx.tickYear();
ctx.recomputeStats();
const g=ctx.__g(); const strip=t=>t.replace(/<[^>]+>/g,'');
console.log('=== YEAR '+g.YEAR+' ===');
console.log('pop',Math.round(g.STAT.pop),'| realms',g.POLS.filter(p=>p.alive).length,
 '| towns',g.SITES.filter(s=>s.alive).length,'| living named',g.LIVING.size,'| recorded lives',g.CHARS.length,
 '| houses',g.DYNS.filter(d=>!d.extinct).length+'/'+g.DYNS.length,'| peoples',g.CULTURES.length,
 '| faiths',g.FAITHS.length,'| tongues',g.LANGS.length,'| relics',g.ARTS.length,'| ruins',g.RUINS.length,
 '| magic',(g.MAGIC*100).toFixed(0)+'%');
const n=+(process.argv[4]||60);
console.log('\n=== CHRONICLE (weight 5) ===');
for(const e of g.EVENTS.filter(e=>e.s>=5).slice(-n)) console.log(e.y+'  '+strip(e.t));
console.log('\n=== A GREAT REALM ===');
const big=g.POLS.filter(p=>p.alive&&p.liege<0).sort((a,b)=>g.polityPop(b)-g.polityPop(a))[0];
if(big){
  const rl=g.C(big.ruler);
  console.log(big.name,'| ruler',rl?ctx.fullName(rl):'—','| souls',Math.round(g.polityPop(big)),'| holds',big.sites.length,
   '| vassals',big.vassals.length,'| legit',big.legit.toFixed(2),'| treasury',Math.round(big.treasury));
  if(rl){ console.log('  traits:',rl.tr.map(t=>g.TRAITS[t].n).join(', '));
    console.log('  skills:',JSON.stringify(rl.sk));
    if(rl.claims.length) console.log('  claims:',rl.claims.map(c=>g.P(c.pol)?g.P(c.pol).name+' ('+c.why+')':'').join('; '));
    if(rl.grudge.length) console.log('  grudges:',rl.grudge.map(x=>x.why).join('; ')); }
  const d=big.dyn>=0?g.DYNS[big.dyn]:null;
  if(d) console.log('  house '+d.name+' —',ctx.sigilText(d),'| motto:',d.motto,'("'+d.mottoGloss+'")','| crowns',d.kings);
}
console.log('\n=== RELICS ===');
for(const a of g.ARTS.filter(a=>!a.destroyed).sort((x,y)=>y.renown-x.renown).slice(0,5)){
  console.log(a.name+' — the '+a.kindn+' of '+a.mat+(a.curse?' [CURSED: '+a.curse.d+']':''));
  for(const c of a.chain.slice(0,7)) console.log('   '+(c.y<0?'—'+Math.abs(c.y):c.y)+'  '+c.what);
}
console.log('\n=== PROPHECY ===');
for(const p of g.PROPHS.slice(-6)) console.log(p.year+' ['+(p.fulfilled>=0?'FULFILLED '+p.fulfilled:(p.subverted?'reinterpreted':'awaited'))+'] '+p.text);
console.log('\n=== AS IT IS NOW REMEMBERED ===');
for(const l of g.LEGENDS.slice(-400).filter(l=>g.YEAR-l.year>250).slice(0,4)){
  console.log('TRUE  ('+l.year+'): '+strip(l.ev.t));
  console.log('TOLD  ('+g.YEAR+'): '+strip(ctx.retell(l,g.YEAR,0))+'\n');
}
console.log('=== TONGUES ===');
for(const l of g.LANGS.slice(0,6)) console.log(l.name.padEnd(14),
  ['water','king','wolf','death','stone','sea','fire'].map(w=>l.say(w)).join(' · '),
  l.parent>=0? '  < '+g.LANGS[l.parent].name+' ('+l.laws.map(x=>x.n).join(', ')+')' : '  [proto]');
