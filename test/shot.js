const path=require('path');
const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{
  const years=+(process.argv[2]||500), mode=process.argv[3]||'political', zoom=+(process.argv[4]||2),
        pane=process.argv[5]||'chronicle', out=process.argv[6]||'test/shot.png';
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1700,height:1000},deviceScaleFactor:1});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+path.resolve(__dirname,'../world_sim.html'));
  await p.evaluate(()=>{ document.getElementById('seed').value='12345'; document.getElementById('btnGen').click(); });
  await p.waitForFunction('typeof GENDONE!=="undefined"&&GENDONE===true',null,{timeout:180000});
  await p.evaluate(y=>{ for(let k=0;k<y;k++) tickYear(); recomputeStats(); updateClock(); },years);
  await p.evaluate(([m,z,pn])=>{
    MODE=m; document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('on',x.dataset.m===MODE));
    setZoom(z); renderLegend();
    const big=POLS.filter(q=>q.alive&&q.liege<0).sort((a,b)=>polityPop(b)-polityPop(a))[0];
    if(big) centreOn(big.capitalTile);
    if(pn==='inspect'&&big) inspect('p',big.id); else setPane(pn);
    drawMap();
  },[mode,zoom,pane]);
  await p.screenshot({path:path.resolve(__dirname,'..',out)});
  console.log('errors',errs.length,errs.slice(0,5).join(' | '));
  await b.close();
})();
