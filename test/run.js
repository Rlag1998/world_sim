const path=require('path');
const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{
  const years = parseInt(process.argv[2]||'300',10);
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1600,height:950}});
  const errs=[];
  page.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  page.on('pageerror',e=>errs.push('PAGEERROR: '+e.message+'\n'+(e.stack||'').split('\n').slice(0,6).join('\n')));
  await page.goto('file://'+path.resolve(__dirname,'../world_sim.html'));
  // deterministic seed
  await page.evaluate(()=>{ document.getElementById('seed').value='12345'; document.getElementById('btnGen').click(); });
  const t0=Date.now();
  try{ await page.waitForFunction('typeof GENDONE!=="undefined" && GENDONE===true',null,{timeout:180000}); }
  catch(e){ console.log('GEN DID NOT FINISH'); errs.forEach(x=>console.log(x)); await browser.close(); process.exit(1); }
  const genMs=Date.now()-t0;
  const world=await page.evaluate(()=>({
    sites:SITES.length, pols:POLS.length, cults:CULTURES.length, faiths:FAITHS.length,
    langs:LANGS.length, species:SPECIES.length, chars:CHARS.length, ruins:RUINS.length,
    arts:ARTS.length, pop:Math.round(STAT.pop), magic:+MAGIC.toFixed(3),
    land:(()=>{let n=0;for(let i=0;i<NT;i++)if(T.land[i])n++;return n;})(),
    rivers:(()=>{let n=0;for(let i=0;i<NT;i++)if(T.flow[i]>26)n++;return n;})(),
    lakes:(()=>{let n=0;for(let i=0;i<NT;i++)if(T.lake[i])n++;return n;})(),
    biomes:(()=>{const c={};for(let i=0;i<NT;i++)c[BIOME[T.biome[i]].n]=(c[BIOME[T.biome[i]].n]||0)+1;return c;})(),
    sampleNames:SITES.slice(0,8).map(s=>s.name+' ("'+s.gloss+'")'),
    sampleLang:LANGS.slice(0,3).map(l=>l.name+': '+['water','king','wolf','death'].map(w=>l.say(w)).join('/')),
    firstEvents:EVENTS.slice(0,4).map(e=>e.t.replace(/<[^>]+>/g,''))
  }));
  console.log('GEN ms:',genMs);
  console.log(JSON.stringify(world,null,1).slice(0,3000));
  // run years
  const t1=Date.now();
  const res=await page.evaluate((y)=>{
    const t=performance.now();
    for(let k=0;k<y;k++) tickYear();
    recomputeStats();
    return {ms:performance.now()-t, year:YEAR, stat:JSON.parse(JSON.stringify(STAT)),
      wars:WARS.length, liveWars:WARS.filter(w=>w.ended<0).length, armies:ARMIES.length,
      events:EVENTS.length, dyn:DYNS.length, dynLive:DYNS.filter(d=>!d.extinct).length,
      arts:ARTS.length, proph:PROPHS.length, fulfilled:PROPHS.filter(p=>p.fulfilled>=0).length,
      ruins:RUINS.length, langs:LANGS.length, cults:CULTURES.length, faiths:FAITHS.length,
      magic:+MAGIC.toFixed(3), living:LIVING.size, chars:CHARS.length,
      biggest:POLS.filter(p=>p.alive).sort((a,b)=>polityPop(b)-polityPop(a)).slice(0,5).map(p=>p.name+' '+Math.round(polityPop(p))+' ('+p.sites.length+' holds)'),
      cities:SITES.filter(s=>s.alive).sort((a,b)=>b.pop-a.pop).slice(0,5).map(s=>s.name+' '+Math.round(s.pop)),
      techAvg:+(CULTURES.reduce((a,c)=>a+c.techs.size,0)/CULTURES.length).toFixed(1)
    };
  },years);
  console.log('SIM',years,'years in',res.ms.toFixed(0),'ms =',(res.ms/years).toFixed(2),'ms/yr');
  console.log(JSON.stringify(res,null,1).slice(0,3000));
  const sample=await page.evaluate(()=>EVENTS.filter(e=>e.s>=4).slice(-28).map(e=>e.y+' | '+e.t.replace(/<[^>]+>/g,'')));
  console.log('\n--- CHRONICLE SAMPLE ---\n'+sample.join('\n'));
  // exercise UI
  await page.evaluate(()=>{ for(const m of MAPMODES){ MODE=m.k; drawMap(); legendFor(m.k); } MODE='terrain'; });
  await page.evaluate(()=>{
    const probes=[['s',0],['p',0],['d',0],['u',0],['f',0],['t',5000],['g',0],['e',0]];
    if(ARTS.length) probes.push(['a',0]);
    if(RUINS.length) probes.push(['r',0]);
    if(WARS.length) probes.push(['w',0]);
    if(PROPHS.length) probes.push(['y',0]);
    if(CHARS.length) probes.push(['c',CHARS.length-1]);
    for(const [t,i] of probes) inspect(t,i);
    renderWorld(); renderChronicle(); renderSearch('a'); showHelp();
  });
  await page.screenshot({path:path.resolve(__dirname,'../test/shot.png')});
  await page.evaluate(()=>{ MODE='political'; ZOOM=1; drawMap(); });
  await page.screenshot({path:path.resolve(__dirname,'../test/shot_political.png')});
  console.log('\nERRORS:', errs.length);
  errs.slice(0,20).forEach(e=>console.log(e));
  await browser.close();
  process.exit(errs.length?1:0);
})();
