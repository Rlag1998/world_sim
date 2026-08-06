/* ============================================================================
   PART XII — THE READING ROOM
   Everything the simulation knows, made clickable.
   ========================================================================== */

let RUNNING=false, SPEED=4, GEN=null, GENDONE=false, TARGET=0;
let PANE='chronicle', SEL={t:null,i:-1}, NAVSTACK=[];
let FILTER={sev:3, kind:'', ent:null};

const $=id=>document.getElementById(id);

/* --------------------------------------------------------------- chronicle  */
/* Each kind of event gets a mark and a colour, so the shape of a century is
   visible before a word of it is read. */
const KINDMARK={
  war:['⚔','war'], battle:['⚔','war'], siege:['⚑','war'], assault:['⚑','war'],
  ally:['⚑','war'], refuse:['⚑','war'], attrition:['⚑','war'], capture:['⚑','war'],
  take:['⚑','war'], civil:['⚔','doom'], revolt:['⚔','doom'], free:['⚑','war'],
  peace:['⚖','peace'], oath:['⚖','peace'], submit:['⚖','peace'], alliance:['⚖','peace'],
  sack:['☠','doom'], ruin:['☠','doom'], murder:['☠','doom'], coup:['☠','doom'],
  execute:['☠','doom'], wedding:['☠','doom'], foiled:['☠','doom'], prison:['☠','doom'],
  plague:['☠','doom'], famine:['☠','doom'], darkage:['☠','doom'], winter:['❄','doom'],
  volcano:['❄','doom'], fade:['❄','myth'], migrate:['⌂','folk'],
  crown:['♔','crown'], inherit:['♔','crown'], seize:['♔','crown'], claim:['♔','crown'],
  partition:['♔','doom'], extinct:['♔','doom'], newhouse:['♔','crown'], fabricate:['♔','crown'],
  faction:['♔','crown'], fall:['♔','doom'], union:['♔','crown'], marry:['♥','folk'], bastard:['♥','folk'],
  death:['†','folk'], grow:['⌂','folk'], found:['⌂','folk'], build:['⌂','folk'],
  road:['⌂','folk'], refound:['⌂','folk'], tech:['✎','lore'], recover:['✎','lore'],
  split:['✎','lore'], convert:['✝','faith'], schism:['✝','faith'],
  prophecy:['☾','myth'], fulfil:['☾','myth'], subvert:['☾','myth'],
  forge:['✦','myth'], delve:['✦','myth'], delvedeath:['✦','myth'], curse:['✦','myth'],
  theft:['✦','myth'], elder:['✦','myth'], genesis:['✧','myth']
};
function renderChronicle(){
  const box=$('chronicle');
  const out=[];
  out.push(`<div class="rowbtns" id="sevbar">
    <button class="btn sm ${FILTER.sev<=1?'on':''}" data-sev="1">ALL</button>
    <button class="btn sm ${FILTER.sev===2?'on':''}" data-sev="2">NOTABLE</button>
    <button class="btn sm ${FILTER.sev===3?'on':''}" data-sev="3">MAJOR</button>
    <button class="btn sm ${FILTER.sev>=4?'on':''}" data-sev="4">GREAT DEEDS</button>
    ${FILTER.ent? `<button class="btn sm on" id="clrent">✕ following ${esc(FILTER.entName||'…')}</button>`:''}
  </div>`);
  if(YEAR<6 && !FILTER.ent && !INTRODONE) out.push(introCard());
  let list=EVENTS;
  if(FILTER.ent){
    const ids=new Set(FILTER.ent);
    list=EVENTS.filter(e=>ids.has(e.i));
  }
  const items=[];
  for(let k=list.length-1;k>=0&&items.length<400;k--){
    const e=list[k];
    if(e.s<FILTER.sev) continue;
    items.push(e);
  }
  let lastYear=null;
  for(const e of items){
    if(e.y!==lastYear){
      lastYear=e.y;
      out.push(`<div class="yrhead"><span>${e.y<0?'before the reckoning':'Year '+e.y}</span></div>`);
    }
    const m=KINDMARK[e.k]||['·',''];
    out.push(`<p class="ev s${e.s} k-${m[1]}"><i class="mk">${m[0]}</i>${e.t}</p>`);
  }
  if(!items.length) out.push('<p class="muted">Nothing recorded at this weight yet. Press <b>RUN</b>, or lower the filter to ALL.</p>');
  box.innerHTML=out.join('');
}
let INTRODONE=false;
function introCard(){
  return `<div class="intro">
    <b>${esc(WORLDNAME||'This world')}</b> has just begun to keep records.
    <ol>
      <li>Press <b>▶ RUN</b> (or <b>+100y</b>) and watch the chronicle fill.</li>
      <li>Switch the map to <b>REALMS</b> to see borders form, <b>PEOPLES</b> to watch tongues split,
          <b>POWER</b> to watch the magic drain out of the world.</li>
      <li>Every coloured name is a link. Click one and follow it — to its house, its wars,
          its enemies, the relic it carries.</li>
    </ol>
    <span class="muted">Nothing here is scripted. The wars have causes you can read; the famines have empty granaries behind them.</span>
    <div class="rowbtns"><button class="btn sm" id="introhide">got it</button>
      <button class="btn sm" id="introhelp">what am I looking at?</button></div>
  </div>`;
}

/* --------------------------------------------------------------- inspector  */
function inspect(t,i,noPush){
  if(!noPush&&SEL.t) NAVSTACK.push({t:SEL.t,i:SEL.i});
  if(NAVSTACK.length>40) NAVSTACK.shift();
  SEL={t,i:+i};
  HILITE={t,i:+i}; VIEWDIRTY=true;
  setPane('inspect');
  renderInspect();
}
function back(){
  const p=NAVSTACK.pop();
  if(p){ SEL=p; HILITE={t:p.t,i:p.i}; VIEWDIRTY=true; renderInspect(); }
}
function crumb(){
  return NAVSTACK.length? `<div class="crumb"><a onclick="back()">◀ back</a></div>` : '';
}
function bar(v,max,col){
  const w=clamp(v/max,0,1)*100;
  return `<div class="bar"><span style="width:${w.toFixed(1)}%;background:${col||'var(--gold-dim)'}"></span></div>`;
}
function traitTags(ch){
  return ch.tr.map(t=>{
    const T2=TRAITS[t];
    const c = T2.earned? 'b' : (T2.k==='blessed'||T2.k==='seer'?'a':'');
    return `<span class="tag ${c}">${esc(T2.n)}</span>`;
  }).join('');
}
function skillRow(ch){
  return SKILLS.map(s=>`<span class="tag">${SKILLN[s].slice(0,3)} ${ch.sk[s]}</span>`).join('');
}

function renderInspect(){
  const box=$('inspect');
  if(!SEL.t){ box.innerHTML='<p class="muted">Click any name in the chronicle, or any tile on the map.</p>'; return; }
  let h='';
  switch(SEL.t){
    case 'c': h=viewChar(CHARS[SEL.i]); break;
    case 's': h=viewSite(SITES[SEL.i]); break;
    case 'p': h=viewPolity(POLS[SEL.i]); break;
    case 'd': h=viewDyn(DYNS[SEL.i]); break;
    case 'u': h=viewCult(CULTURES[SEL.i]); break;
    case 'f': h=viewFaith(FAITHS[SEL.i]); break;
    case 'a': h=viewArt(ARTS[SEL.i]); break;
    case 'r': h=viewRuin(RUINS[SEL.i]); break;
    case 'w': h=viewWar(WARS[SEL.i]); break;
    case 'y': h=viewProph(PROPHS[SEL.i]); break;
    case 't': h=viewTile(SEL.i); break;
    case 'g': h=viewLang(LANGS[SEL.i]); break;
    case 'e': h=viewSpecies(SPECIES[SEL.i]); break;
  }
  box.innerHTML=crumb()+(h||'<p class="muted">Nothing here.</p>');
}

/* follow a house, a realm, a town or a person through the chronicle */
function followEntity(kind,id){
  let ev=null, nm='';
  if(kind==='c'&&CHARS[id]){ ev=CHARS[id].ev; nm=shortName(CHARS[id]); }
  else if(kind==='s'&&SITES[id]){ ev=SITES[id].ev; nm=SITES[id].name; }
  else if(kind==='p'&&POLS[id]){ ev=POLS[id].history; nm=POLS[id].name; }
  else if(kind==='d'&&DYNS[id]){
    const d=DYNS[id]; ev=[]; nm='House '+d.name;
    for(const m of d.members){ const c=CHARS[m]; if(c&&c.ev) for(const x of c.ev) ev.push(x); }
    ev.sort((a,b)=>a-b);
  }
  if(!ev||!ev.length){ return; }
  FILTER.ent=ev.slice(); FILTER.entName=nm; FILTER.sev=1;
  setPane('chronicle'); renderChronicle();
}
function followBtn(kind,id,label){
  return `<button class="btn sm" data-follow="${kind}" data-fid="${id}">follow ${esc(label)} in the chronicle</button>`;
}
function evList(ids,limit){
  if(!ids||!ids.length) return '<p class="muted">— no record —</p>';
  const out=[];
  for(let k=ids.length-1;k>=0&&out.length<(limit||12);k--){
    const e=evById(ids[k]); if(!e) continue;
    out.push(`<p class="ev s${e.s}"><span class="yr">${e.y}</span>${e.t}</p>`);
  }
  return out.join('')||'<p class="muted">— no record —</p>';
}

/* -------- character ------------------------------------------------------- */
function viewChar(ch){
  if(!ch) return '';
  const sp=SPECIES[ch.spec], cu=CULTURES[ch.cult], d=ch.dyn>=0?DYNS[ch.dyn]:null;
  const age=ageOf(ch,YEAR);
  const alive_=ch.died<0;
  let h=`<h3 class="hd">${esc(fullName(ch))}</h3>`;
  h+=`<div class="kv">
    <div class="k">born</div><div class="v">${ch.born}${alive_?'':' — died '+ch.died}</div>
    <div class="k">age</div><div class="v">${age} of a possible ${sp.life}</div>
    <div class="k">people</div><div class="v">${CL2(cu)} <span class="muted">(${esc(sp.name)})</span></div>
    <div class="k">faith</div><div class="v">${ch.faith>=0?FL(FAITHS[ch.faith]):'—'}</div>
    <div class="k">house</div><div class="v">${d?DL(d):'<span class="muted">no house</span>'}${ch.bastard?' <span class="tag b">baseborn</span>':''}</div>
    <div class="k">name means</div><div class="v muted">“${esc(ch.gloss)}”</div>
    <div class="k">prestige</div><div class="v">${Math.round(ch.prestige)}</div>
    <div class="k">gold</div><div class="v">${commify(ch.gold)}</div>`;
  if(!alive_) h+=`<div class="k">death</div><div class="v" style="color:var(--blood)">${esc(ch.cause)}</div>`;
  if(ch.prison>=0&&alive_) h+=`<div class="k">held by</div><div class="v">${CHL(C(ch.prison))}</div>`;
  h+=`</div>`;
  h+=`<h4 class="sub">Skills</h4><div>${skillRow(ch)}</div>`;
  h+=`<h4 class="sub">Nature</h4><div>${traitTags(ch)||'<span class="muted">unremarkable</span>'}</div>`;
  if(ch.titles.length){
    h+=`<h4 class="sub">Titles</h4><div>`+
      ch.titles.map(t=>{const p=P(t); return p? PL(p)+(p.ruler===ch.id?'':' <span class="muted">(former)</span>'):''}).join(', ')+`</div>`;
  }
  if(ch.claims.length){
    h+=`<h4 class="sub">Claims</h4>`;
    for(const c of ch.claims.slice(0,6)){
      const p=P(c.pol); if(!p) continue;
      h+=`<div>${PL(p)} <span class="muted">— ${esc(c.why)} (${pct(c.str)}, since ${c.since})</span></div>`;
    }
  }
  if(ch.arts.length){
    h+=`<h4 class="sub">Bears</h4><div>`+ch.arts.map(a=>AL(ARTS[a])).join(', ')+`</div>`;
  }
  /* family tree */
  h+=`<h4 class="sub">Blood</h4><div class="tree">${familyTree(ch)}</div>`;
  if(ch.grudge.length){
    h+=`<h4 class="sub">Grudges</h4>`;
    for(const g of ch.grudge.slice(-5).reverse()){
      const o=C(g.c);
      h+=`<div class="muted">${o?CHL(o):'—'} <span class="tag b">${Math.round(g.w)}</span> ${esc(g.why)} <span class="muted">(${g.y})</span></div>`;
    }
  }
  if(ch.rel&&ch.rel.size){
    h+=`<h4 class="sub">Opinions held</h4><table class="t"><tr><th>of</th><th class="num">op.</th><th>because</th></tr>`;
    const rows=[...ch.rel.entries()].sort((a,b)=>Math.abs(b[1].v)-Math.abs(a[1].v)).slice(0,10);
    for(const [k,e] of rows){
      const o=C(k); if(!o) continue;
      let why=''; { let bw=-1; for(const q2 of e.c){ const a=Math.abs(q2.v); if(a>bw){bw=a;why=q2.t;} } }
      h+=`<tr><td>${CHL(o)}</td><td class="num" style="color:${e.v<0?'var(--blood)':'var(--leaf)'}">${e.v>0?'+':''}${Math.round(e.v)}</td><td class="muted">${esc(why)}</td></tr>`;
    }
    h+=`</table>`;
  }
  h+=`<h4 class="sub">Deeds recorded</h4>${evList(ch.ev,14)}`;
  h+=`<div class="rowbtns">${followBtn('c',ch.id,shortName(ch))}${ch.dyn>=0?followBtn('d',ch.dyn,'the house'):''}</div>`;
  return h;
}
function familyTree(ch){
  const nm=c=>c? (c.died<0? c.name : c.name+'†') : '?';
  const L=[];
  const fa=C(ch.fa), mo=C(ch.mo);
  if(fa||mo){
    L.push(`  ${nm(fa)}${fa?'':''} ═══ ${nm(mo)}`);
    L.push(`          │`);
  }
  const sibs=[];
  if(fa) for(const k of fa.kids) if(k!==ch.id) sibs.push(C(k));
  if(mo) for(const k of mo.kids) if(k!==ch.id&&sibs.indexOf(C(k))<0) sibs.push(C(k));
  const line=[];
  for(const s of sibs.slice(0,4)) if(s) line.push(nm(s));
  line.push('【'+nm(ch)+'】');
  L.push('  '+line.join('  ·  '));
  const sp=C(ch.sp);
  if(sp) L.push(`     ═══ ${nm(sp)}`);
  if(ch.kids.length){
    L.push('          │');
    const kids=ch.kids.map(C).filter(Boolean);
    for(let k=0;k<kids.length;k+=3){
      L.push('     '+kids.slice(k,k+3).map(c=>nm(c)+(c.bastard?'*':'')).join('  ·  '));
    }
  }
  return esc(L.join('\n'));
}

/* -------- settlement ------------------------------------------------------ */
function viewSite(s){
  if(!s) return '';
  const cu=CULTURES[s.culture], p=P(s.polity);
  let h=`<h3 class="hd">${esc(s.name)}${s.alive?'':' <span class="muted">(ruined '+s.ruinYear+')</span>'}</h3>`;
  h+=`<div class="quote">“${esc(s.gloss)}” — in the tongue of ${CL2(cu)}</div>`;
  h+=`<div class="kv">
   <div class="k">rank</div><div class="v">${cap(TIERN[s.tier])}</div>
   <div class="k">souls</div><div class="v">${commify(s.pop)}</div>
   <div class="k">founded</div><div class="v">${s.founded}</div>
   <div class="k">lord</div><div class="v">${C(s.holder)&&alive(C(s.holder))?CHL(C(s.holder))+' of '+(C(s.holder).dyn>=0?DL(DYNS[C(s.holder).dyn]):'no house'):'<span class="muted">vacant</span>'}</div>
   <div class="k">realm</div><div class="v">${p?PL(p):'<span class="muted">no lord</span>'}${s.occupied>=0?' <span class="tag b">occupied by '+esc(P(s.occupied)?P(s.occupied).name:'?')+'</span>':''}</div>
   <div class="k">people</div><div class="v">${CL2(cu)}</div>
   <div class="k">faith</div><div class="v">${s.faith>=0?FL(FAITHS[s.faith]):'—'}</div>
   <div class="k">terrain</div><div class="v">${esc(BIOME[T.biome[s.tile]].n)}${T.harbor[s.tile]>0.4?', a good harbour':''}${T.pass[s.tile]?', guarding a pass':''}</div>
   <div class="k">walls</div><div class="v">${s.walls?('level '+s.walls):'<span class="muted">none</span>'}${s.temple?' · temple '+s.temple:''}${s.market?' · market '+s.market:''}${s.univ?' · school '+s.univ:''}</div>
   <div class="k">wealth</div><div class="v">${commify(s.wealth)}</div>
   <div class="k">unrest</div><div class="v">${bar(s.unrest,1.5,'var(--blood)')}</div>
   <div class="k">devastation</div><div class="v">${bar(s.devast,1,'#7a3a2a')}</div>
   </div>`;
  if(s.siege) h+=`<p class="ev doom">Under siege by ${PL(P(s.siege.by))} since ${s.siege.since}.</p>`;
  h+=`<h4 class="sub">Estates</h4><table class="t">`;
  for(let k=0;k<NCLASS;k++) if(s.cls[k]>0.5)
    h+=`<tr><td>${CLASSN[k]}</td><td class="num">${commify(s.cls[k])}</td><td>${bar(s.cls[k]/Math.max(1,s.pop),1)}</td></tr>`;
  h+=`</table>`;
  h+=`<h4 class="sub">Market</h4><table class="t"><tr><th>good</th><th class="num">makes</th><th class="num">eats</th><th class="num">store</th><th class="num">price</th></tr>`;
  for(let g=0;g<NG;g++){
    if(s.prod[g]<0.05&&s.cons[g]<0.05&&s.stock[g]<0.5) continue;
    const rel=s.price[g]/GOODS[g].base;
    const col=rel>1.4?'var(--blood)':(rel<0.7?'var(--leaf)':'');
    h+=`<tr><td>${GOODS[g].n}</td><td class="num">${s.prod[g].toFixed(1)}</td><td class="num">${s.cons[g].toFixed(1)}</td>
        <td class="num">${s.stock[g].toFixed(0)}</td><td class="num" style="color:${col}">${s.price[g].toFixed(2)}</td></tr>`;
  }
  h+=`</table>`;
  const rc=s.rescnt;
  if(rc){
    const have=[];
    for(let k=1;k<RES.length;k++) if(rc[k]>0.05) have.push(RES[k].n+' ('+rc[k].toFixed(1)+')');
    if(have.length) h+=`<h4 class="sub">The land gives</h4><div class="muted">${esc(listify(have))}</div>`;
  }
  if(s.links.length){
    h+=`<h4 class="sub">Roads and sea-lanes</h4><table class="t"><tr><th>to</th><th class="num">cost</th><th class="num">traffic</th><th>road</th></tr>`;
    for(const l of s.links.slice().sort((a,b)=>b.traffic-a.traffic).slice(0,8)){
      const o=SITES[l.to]; if(!o) continue;
      h+=`<tr><td>${SL(o)}</td><td class="num">${l.cost.toFixed(0)}</td><td class="num">${l.traffic.toFixed(0)}</td>
          <td>${l.sea>0.4?'by sea':(l.road?'paved ×'+l.road:'track')}</td></tr>`;
    }
    h+=`</table>`;
  }
  h+=`<h4 class="sub">Annals</h4>${evList(s.ev,14)}`;
  h+=`<div class="rowbtns">${followBtn('s',s.id,s.name)}</div>`;
  h+=`<div class="rowbtns"><button class="btn sm" onclick="centreOn(${s.tile});VIEWDIRTY=true">show on map</button></div>`;
  return h;
}

/* -------- polity ---------------------------------------------------------- */
function viewPolity(p){
  if(!p) return '';
  const rl=C(p.ruler), cu=CULTURES[p.culture], cap_=SITES[p.capital];
  let h=`<h3 class="hd">${esc(polityTitle(p))}</h3>`;
  if(!p.alive) h+=`<p class="ev doom">Ended in ${p.ended}.</p>`;
  h+=`<div class="kv">
   <div class="k">ruler</div><div class="v">${rl?CHL(rl):'<span class="muted">vacant</span>'}${rl?' <span class="muted">since '+p.rulerSince+'</span>':''}</div>
   <div class="k">house</div><div class="v">${p.dyn>=0?DL(DYNS[p.dyn]):'—'}</div>
   <div class="k">seat</div><div class="v">${cap_?SL(cap_):'—'}</div>
   <div class="k">people</div><div class="v">${CL2(cu)}</div>
   <div class="k">faith</div><div class="v">${p.faith>=0?FL(FAITHS[p.faith]):'—'}</div>
   <div class="k">founded</div><div class="v">${p.born}</div>
   <div class="k">holdings</div><div class="v">${p.sites.length}</div>
   <div class="k">souls</div><div class="v">${commify(polityPop(p))}</div>
   <div class="k">levies</div><div class="v">${commify(polityManpower(p))}</div>
   <div class="k">treasury</div><div class="v" style="color:${p.treasury<0?'var(--blood)':''}">${commify(p.treasury)}</div>
   <div class="k">legitimacy</div><div class="v">${bar(p.legit,1)}</div>
   <div class="k">centralism</div><div class="v">${bar(p.central,1)}</div>
   <div class="k">war weariness</div><div class="v">${bar(p.warExhaust,1.4,'var(--blood)')}</div>
   <div class="k">succession</div><div class="v muted">${esc((SUCC.find(x=>x.k===cu.succ)||{}).d||cu.succ)}; ${esc((GENDER.find(x=>x.k===cu.gender)||{}).d||'')}</div>
   </div>`;
  if(p.liege>=0) h+=`<p>Sworn to ${PL(P(p.liege))}.</p>`;
  if(p.ally>=0&&P(p.ally)) h+=`<p>Allied with ${PL(P(p.ally))}.</p>`;
  if(p.vassals.length){
    h+=`<h4 class="sub">Vassals</h4><div class="tree">${vassalTree(p,'')}</div>`;
  }
  if(rl){
    const hs=heirsOf(p,YEAR);
    if(hs.length) h+=`<h4 class="sub">Line of succession</h4><div>${hs.slice(0,5).map((c,i)=>`${i+1}. `+CHL(c)+` <span class="muted">(${ageOf(c,YEAR)})</span>`).join('<br>')}</div>`;
  }
  const w=p.wars.map(x=>WARS[x]).filter(x=>x&&x.ended<0);
  if(w.length){
    h+=`<h4 class="sub">At war</h4>`;
    for(const x of w) h+=`<div>${lk('w',x.id,'','the '+x.title.replace(/^the /,''))} <span class="muted">— ${esc(CBI[x.cb]?CBI[x.cb].n:x.cb)}, score ${x.score.toFixed(0)}</span></div>`;
  }
  const rels=[...p.rel.entries()].map(([k,e])=>[P(k),relation(p,P(k))]).filter(x=>x[0]&&x[0].alive);
  rels.sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  if(rels.length){
    h+=`<h4 class="sub">Regard for neighbours</h4><table class="t">`;
    for(const [q,v] of rels.slice(0,10)){
      const e=p.rel.get(q.id);
      let why='';
      if(e&&e.m.length){ let bw=-1; for(const m of e.m){ const a=Math.abs(m.v); if(a>bw){bw=a;why=m.t;} } }
      h+=`<tr><td>${PL(q)}</td><td class="num" style="color:${v<0?'var(--blood)':'var(--leaf)'}">${v>0?'+':''}${v}</td><td class="muted">${esc(why)}</td></tr>`;
    }
    h+=`</table>`;
  }
  h+=`<h4 class="sub">Holdings</h4><table class="t"><tr><th>town</th><th class="num">souls</th><th class="num">wealth</th></tr>`;
  for(const sid of p.sites.slice().sort((a,b)=>SITES[b].pop-SITES[a].pop).slice(0,16)){
    const s=SITES[sid];
    h+=`<tr><td>${SL(s)}${sid===p.capital?' <span class="tag g">seat</span>':''}</td><td class="num">${commify(s.pop)}</td><td class="num">${commify(s.wealth)}</td></tr>`;
  }
  h+=`</table>`;
  h+=`<h4 class="sub">Annals</h4>${evList(p.history,16)}`;
  h+=`<div class="rowbtns">${followBtn('p',p.id,p.name)}</div>`;
  return h;
}
function vassalTree(p,pre,depth){
  depth=depth||0;
  if(depth>3) return '';
  let s='';
  const vs=p.vassals.map(P).filter(q=>q&&q.alive);
  vs.forEach((q,i)=>{
    const last=i===vs.length-1;
    s+=pre+(last?'└─ ':'├─ ')+q.name+' ('+commify(polityPop(q))+')\n';
    s+=vassalTree(q,pre+(last?'   ':'│  '),depth+1);
  });
  return s;
}

/* -------- dynasty --------------------------------------------------------- */
function viewDyn(d){
  if(!d) return '';
  let h=`<h3 class="hd">House ${esc(d.name)}</h3>`;
  h+=`<div class="quote">${esc(sigilText(d))}<br>“${esc(d.motto)}” — <span class="muted">${esc(d.mottoGloss)}</span></div>`;
  h+=`<div class="kv">
   <div class="k">people</div><div class="v">${CL2(CULTURES[d.culture])}</div>
   <div class="k">founded</div><div class="v">${d.born}</div>
   <div class="k">status</div><div class="v">${d.extinct?'<span style="color:var(--blood)">extinct '+d.ended+'</span>':'living'}</div>
   <div class="k">members</div><div class="v">${d.members.length} recorded, ${d.living} living</div>
   <div class="k">times crowned</div><div class="v">${d.kings}</div>
   <div class="k">name means</div><div class="v muted">“${esc(d.gloss)}”</div>
   </div>`;
  const held=POLS.filter(p=>p.alive&&p.dyn===d.id);
  if(held.length) h+=`<h4 class="sub">Rules</h4><div>${held.map(PL).join(', ')}</div>`;
  const living=d.members.map(C).filter(c=>c&&alive(c)).sort((a,b)=>a.born-b.born);
  h+=`<h4 class="sub">Living blood</h4><table class="t"><tr><th>name</th><th class="num">age</th><th>note</th></tr>`;
  for(const c of living.slice(0,26))
    h+=`<tr><td>${CHL(c)}</td><td class="num">${ageOf(c,YEAR)}</td><td class="muted">${c.titles.length?esc(P(c.titles[0])?P(c.titles[0]).name:''):(c.bastard?'baseborn':'')}</td></tr>`;
  h+=`</table>`;
  h+=`<div class="rowbtns">${followBtn('d',d.id,'House '+d.name)}</div>`;
  const notable=d.members.map(C).filter(c=>c&&(c.epi||c.titles.length||c.arts.length)).slice(-24).reverse();
  h+=`<h4 class="sub">Of note</h4><table class="t"><tr><th>name</th><th>born–died</th><th>end</th></tr>`;
  for(const c of notable)
    h+=`<tr><td class="${c.died>=0?'dead':''}">${CHL(c)}</td><td>${c.born}–${c.died<0?'':c.died}</td><td class="muted">${esc(c.cause||'')}</td></tr>`;
  h+=`</table>`;
  return h;
}

/* -------- culture / faith / species / language ---------------------------- */
function viewCult(c){
  if(!c) return '';
  const sp=SPECIES[c.species], lg=LANGS[c.lang];
  let h=`<h3 class="hd">${esc(c.name)}</h3>`;
  h+=`<div class="quote">“${esc(c.gloss)}” · a ${esc(c.ethos)} people of the ${lk('e',sp.id,'',sp.name)}</div>`;
  h+=`<div class="kv">
   <div class="k">tongue</div><div class="v">${lk('g',lg.id,'',lg.name)} <span class="muted">(family ${lg.family}, ${lg.depth} removes from the proto-tongue)</span></div>
   <div class="k">faith</div><div class="v">${c.faith>=0?FL(FAITHS[c.faith]):'—'}</div>
   <div class="k">souls</div><div class="v">${commify(c.pop)}</div>
   <div class="k">succession</div><div class="v muted">${esc((SUCC.find(x=>x.k===c.succ)||{}).d||c.succ)}</div>
   <div class="k">inheritance</div><div class="v muted">${esc((GENDER.find(x=>x.k===c.gender)||{}).d||c.gender)}</div>
   ${c.parent>=0?`<div class="k">split from</div><div class="v">${CL2(CULTURES[c.parent])} in ${c.born}</div>`:''}
   </div>`;
  h+=`<h4 class="sub">Values</h4><table class="t">`;
  for(const k of VAL_KEYS) h+=`<tr><td>${k}</td><td style="width:60%">${bar(c.vals[k],1)}</td><td class="num">${Math.round(c.vals[k]*100)}</td></tr>`;
  h+=`</table>`;
  const known=[...c.techs].map(k=>TECHS[TECHI[k]]).filter(Boolean).sort((a,b)=>a.era-b.era);
  h+=`<h4 class="sub">Arts known (${known.length}/${NTECH})</h4><div>${known.map(t=>`<span class="tag">${esc(t.n)}</span>`).join('')}</div>`;
  const words=['water','stone','king','war','death','god','sea','fire','wolf','star','home','oath'];
  h+=`<h4 class="sub">A few words</h4><table class="t">`;
  for(const w of words) h+=`<tr><td class="muted">${CN[w]}</td><td>${esc(lg.say(w))}</td></tr>`;
  h+=`</table>`;
  const mine=SITES.filter(s=>s.alive&&s.culture===c.id).sort((a,b)=>b.pop-a.pop);
  h+=`<h4 class="sub">Their towns</h4><div>${mine.slice(0,18).map(SL).join(', ')||'<span class="muted">none left</span>'}</div>`;
  return h;
}
function viewFaith(f){
  if(!f) return '';
  let h=`<h3 class="hd">${esc(f.name)}</h3>`;
  h+=`<div class="quote">a ${esc(f.kind)} faith · ${esc(faithBlurb(f))}</div>`;
  h+=`<div class="kv">
   <div class="k">followers</div><div class="v">${commify(f.followers)}</div>
   <div class="k">arose</div><div class="v">${f.born}${f.parent>=0?', broken from '+FL(FAITHS[f.parent]):''}</div>
   <div class="k">proselytism</div><div class="v">${bar(f.prosel,1)}</div>
   <div class="k">tolerance</div><div class="v">${bar(f.tolerance,1)}</div>
   <div class="k">militancy</div><div class="v">${bar(f.militancy,1,'var(--blood)')}</div>
   <div class="k">schisms</div><div class="v">${f.heresies}</div>
   </div>`;
  if(f.gods.length){
    h+=`<h4 class="sub">The gods</h4><table class="t"><tr><th>name</th><th>domain</th><th>aspect</th></tr>`;
    for(const g of f.gods)
      h+=`<tr><td>${esc(g.name)} <span class="muted">(${esc(g.gloss)})</span></td><td>${esc(g.dname)}</td><td class="muted">${esc(g.aspect)}</td></tr>`;
    h+=`</table>`;
  }
  if(f.doctrine.length) h+=`<h4 class="sub">They hold</h4><div class="quote">${f.doctrine.map(esc).join('<br>')}</div>`;
  if(f.holy.length){
    h+=`<h4 class="sub">Holy ground</h4>`;
    for(const t of f.holy){
      const o=T.owner[t];
      h+=`<div>${lk('t',t,'','a place in the '+BIOME[T.biome[t]].n.toLowerCase())} — ${o>=0&&P(o)?'held by '+PL(P(o)):'<span class="muted">held by no one</span>'}</div>`;
    }
  }
  const mine=SITES.filter(s=>s.alive&&s.faith===f.id).sort((a,b)=>b.pop-a.pop);
  h+=`<h4 class="sub">Congregations</h4><div>${mine.slice(0,18).map(SL).join(', ')||'<span class="muted">none</span>'}</div>`;
  return h;
}
function viewSpecies(sp){
  if(!sp) return '';
  let h=`<h3 class="hd">The ${esc(sp.name)}</h3>`;
  h+=`<div class="quote">“${esc(sp.gloss)}” · a ${esc(sp.temper)} kind${sp.elder?', of the Elder sort':''}</div>`;
  h+=`<div class="kv">
   <div class="k">span of years</div><div class="v">${sp.life}</div>
   <div class="k">come of age</div><div class="v">${sp.matAge}</div>
   <div class="k">fecundity</div><div class="v">${bar(sp.fert,1.3)}</div>
   <div class="k">affinity</div><div class="v">${bar(sp.magic,1)} <span class="muted">${sp.elder?'fades as the power fades':''}</span></div>
   <div class="k">stature</div><div class="v">${sp.stature<0.8?'small':sp.stature>1.2?'tall':'middling'}</div>
   </div>`;
  h+=`<h4 class="sub">Said of them</h4><div>${sp.tags.map(t=>`<span class="tag">${esc(t.d)}</span>`).join('')}</div>`;
  h+=`<h4 class="sub">Home ground</h4><div class="muted">${esc(listify([...new Set(sp.biomePref)].map(b=>BIOME[b].n)))}</div>`;
  const cs=CULTURES.filter(c=>c.species===sp.id);
  h+=`<h4 class="sub">Their peoples</h4><div>${cs.map(CL2).join(', ')}</div>`;
  return h;
}
function viewLang(lg){
  if(!lg) return '';
  let h=`<h3 class="hd">The ${esc(lg.name)} tongue</h3>`;
  h+=`<div class="kv">
   <div class="k">family</div><div class="v">${lg.family===lg.id?'a proto-tongue':lk('g',lg.family,'',LANGS[lg.family].name)}</div>
   <div class="k">descended from</div><div class="v">${lg.parent>=0?lk('g',lg.parent,'',LANGS[lg.parent].name):'—'}</div>
   <div class="k">sound laws</div><div class="v muted">${lg.laws.length?esc(listify(lg.laws.map(l=>l.n))):'none (it is the root)'}</div>
   <div class="k">word order</div><div class="v muted">${lg.headFirst?'head-initial (Fort-of-Pines)':'head-final (Pinefort)'}</div>
   <div class="k">stress</div><div class="v muted">${lg.stress}</div>
   </div>`;
  const par=lg.parent>=0? LANGS[lg.parent] : null;
  const words=['water','stone','fire','king','death','sea','wolf','star','war','oath','god','home','mount','river','blood'];
  h+=`<h4 class="sub">Lexicon${par?' beside its parent':''}</h4><table class="t"><tr><th>meaning</th><th>${esc(lg.name)}</th>${par?`<th>${esc(par.name)}</th>`:''}</tr>`;
  for(const w of words){
    h+=`<tr><td class="muted">${CN[w]||w}</td><td>${esc(lg.say(w))}</td>${par?`<td class="muted">${esc(par.say(w))}</td>`:''}</tr>`;
  }
  h+=`</table>`;
  const kids=LANGS.filter(l=>l.parent===lg.id);
  if(kids.length) h+=`<h4 class="sub">Daughter tongues</h4><div>${kids.map(k=>lk('g',k.id,'',k.name)).join(', ')}</div>`;
  const cs=CULTURES.filter(c=>c.lang===lg.id);
  if(cs.length) h+=`<h4 class="sub">Spoken by</h4><div>${cs.map(CL2).join(', ')}</div>`;
  return h;
}

/* -------- artifact / ruin / war / prophecy / tile -------------------------- */
function viewArt(a){
  if(!a) return '';
  let h=`<h3 class="hd">${esc(a.name)}</h3>`;
  h+=`<div class="quote">the ${esc(a.kindn)} “${esc(a.gloss)}”, of ${esc(a.mat)}${a.elder?', made in the Elder Age':''}<br>${esc(cap(a.desc))}.</div>`;
  h+=`<div class="kv">
   <div class="k">made</div><div class="v">${a.made<0?Math.abs(a.made)+' before the reckoning':a.made}</div>
   <div class="k">potency</div><div class="v">${bar(a.pow,1.5,'var(--arcane)')}</div>
   <div class="k">renown</div><div class="v">${a.renown}</div>
   <div class="k">now</div><div class="v">${a.destroyed?'<span style="color:var(--blood)">destroyed</span>':(a.holder>=0?'borne by '+CHL(C(a.holder)):(a.buried>=0?'lost in the ground':'lost'))}</div>
   </div>`;
  if(a.curse) h+=`<p class="ev doom">It is not a clean thing: ${esc(a.curse.d)}.</p>`;
  h+=`<h4 class="sub">Provenance</h4><table class="t"><tr><th>year</th><th>passage</th></tr>`;
  for(const c of a.chain)
    h+=`<tr><td class="num muted">${c.y<0?'—'+Math.abs(c.y):c.y}</td><td>${esc(cap(c.what))}${c.where>=0?' <span class="muted">·</span> '+lk('t',c.where,'','there'):''}</td></tr>`;
  h+=`</table>`;
  return h;
}
function viewRuin(ru){
  if(!ru) return '';
  let h=`<h3 class="hd">The ruins of ${esc(ru.name)}</h3>`;
  h+=`<div class="quote">“${esc(ru.gloss)}”<br>${esc(cap(ru.why))}.</div>`;
  h+=`<div class="kv">
   <div class="k">fell</div><div class="v">${ru.year<0? Math.abs(ru.year)+' years before the reckoning' : ru.year}</div>
   <div class="k">of the Elder Age</div><div class="v">${ru.elder?'yes':'no'}</div>
   <div class="k">searched</div><div class="v">${ru.looted?('in '+ru.lootYear+(ru.lootedBy>=0?' by '+CHL(C(ru.lootedBy)):'')):'<span class="muted">not yet</span>'}</div>
   <div class="k">terrain</div><div class="v">${esc(BIOME[T.biome[ru.tile]].n)}</div>
   </div>`;
  if(ru.lostTech) h+=`<p>Somewhere in it lies the knowledge of <b>${esc(TECHS[TECHI[ru.lostTech]].n)}</b>.</p>`;
  if(ru.buried.length) h+=`<h4 class="sub">Buried here</h4><div>${ru.buried.map(x=>AL(ARTS[x])).join(', ')}</div>`;
  h+=`<div class="rowbtns"><button class="btn sm" onclick="centreOn(${ru.tile});VIEWDIRTY=true">show on map</button></div>`;
  return h;
}
function viewWar(w){
  if(!w) return '';
  let h=`<h3 class="hd">${esc(cap(w.title))}</h3>`;
  h+=`<div class="quote">${esc(cap(CBI[w.cb]?CBI[w.cb].n:w.cb))}: ${esc(w.why)}</div>`;
  h+=`<div class="kv">
   <div class="k">began</div><div class="v">${w.start}</div>
   <div class="k">ended</div><div class="v">${w.ended<0?'<span style="color:var(--blood)">still burning</span>':w.ended}</div>
   <div class="k">attackers</div><div class="v">${w.atk.map(x=>PL(P(x))).join(', ')}</div>
   <div class="k">defenders</div><div class="v">${w.def.map(x=>PL(P(x))).join(', ')}</div>
   <div class="k">war score</div><div class="v">${w.score.toFixed(1)}</div>
   <div class="k">the dead</div><div class="v">${commify(w.atkCasualties+w.defCasualties)}</div>
   </div>`;
  if(w.battles.length){
    h+=`<h4 class="sub">Battles</h4><table class="t"><tr><th>year</th><th>place</th><th>victor</th><th class="num">fallen</th></tr>`;
    for(const b of w.battles.slice(-20).reverse())
      h+=`<tr><td class="num">${b.year}</td><td>${lk('t',b.tile,'',b.place)}</td><td>${PL(P(b.win))}</td><td class="num">${commify(b.dead)}</td></tr>`;
    h+=`</table>`;
  }
  if(w.sacked.length) h+=`<h4 class="sub">Sacked</h4><div>${[...new Set(w.sacked)].map(x=>SL(SITES[x])).join(', ')}</div>`;
  return h;
}
function viewProph(p){
  if(!p) return '';
  let h=`<h3 class="hd">A prophecy of ${p.year}</h3>`;
  h+=`<div class="quote">“${esc(p.text)}”</div>`;
  h+=`<div class="kv">
   <div class="k">spoken by</div><div class="v">${p.by>=0?CHL(C(p.by)):'unknown'}</div>
   <div class="k">concerning</div><div class="v">${esc(p.subject)}</div>
   <div class="k">state</div><div class="v">${p.fulfilled>=0?'<span style="color:var(--gold)">fulfilled in '+p.fulfilled+'</span>':(p.subverted?'<span class="muted">unfulfilled; reinterpreted</span>':'awaited')}</div>
   </div>`;
  return h;
}
function viewTile(i){
  const b=BIOME[T.biome[i]];
  let h=`<h3 class="hd">${esc(b.n)} <span class="muted">(${i%W}, ${(i/W)|0})</span></h3>`;
  h+=`<div class="kv">
   <div class="k">elevation</div><div class="v">${T.land[i]? Math.round(T.alt[i]*5400)+' m' : Math.round(-T.alt[i]*4000)+' m deep'}</div>
   <div class="k">temperature</div><div class="v">${T.temp[i].toFixed(1)}°, ±${T.tvar[i].toFixed(0)}° by season</div>
   <div class="k">rainfall</div><div class="v">${Math.round(T.rain[i])} mm</div>
   <div class="k">soil</div><div class="v">${bar(T.fert[i],1.25,'var(--leaf)')}</div>
   <div class="k">river</div><div class="v">${T.flow[i]>0? Math.round(T.flow[i])+' of flow':'—'}${T.lake[i]?' (a lake)':''}</div>
   <div class="k">the deep power</div><div class="v">${bar(T.ley[i]*MAGIC,1.5,'var(--arcane)')}</div>
   <div class="k">going</div><div class="v">${T.cost[i]<999? T.cost[i].toFixed(1)+(T.road[i]?' (road)':' (wild)') : 'water'}</div>
   <div class="k">defensible</div><div class="v">${bar(T.defen[i],1)}${T.pass[i]?' <span class="tag g">a pass</span>':''}</div>
   ${T.res[i]?`<div class="k">riches</div><div class="v">${esc(RES[T.res[i]].n)} (${T.resq[i].toFixed(2)})</div>`:''}
   ${T.scar[i]?`<div class="k">scarred</div><div class="v" style="color:var(--arcane)">${esc(SCARN[T.scar[i]])}</div>`:''}
   <div class="k">held by</div><div class="v">${T.owner[i]>=0&&P(T.owner[i])?PL(P(T.owner[i])):'<span class="muted">no one</span>'}</div>
   ${T.dom[i]>=0&&SITES[T.dom[i]]?`<div class="k">worked from</div><div class="v">${SL(SITES[T.dom[i]])}</div>`:''}
   </div>`;
  if(T.ruin[i]>=0) h+=`<p>${RL(RUINS[T.ruin[i]])} lie here.</p>`;
  /* what would a local call this place? */
  const d=T.dom[i]>=0? SITES[T.dom[i]] : null;
  if(d){
    const lg=LANGS[CULTURES[d.culture].lang];
    const r=stream(i*31337,'nm');
    const nm=nameRegion(lg,i,r);
    h+=`<div class="quote">The folk of ${SL(d)} call this ground <b>${esc(nm.t)}</b> — “${esc(nm.g)}”.</div>`;
  }
  return h;
}

/* --------------------------------------------------------------- world pane */
function spark(arr,w,h,col){
  if(!arr||arr.length<2) return '';
  let mn=Infinity,mx=-Infinity;
  for(const v of arr){ if(v<mn)mn=v; if(v>mx)mx=v; }
  if(mx-mn<1e-9) mx=mn+1;
  const pts=arr.map((v,i)=>`${(i/(arr.length-1)*w).toFixed(1)},${(h-(v-mn)/(mx-mn)*h).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="${col||'#c9a247'}" stroke-width="1"/></svg>`;
}
function renderWorld(){
  const box=$('world');
  let h='';
  h+=`<h3 class="hd">The World in Year ${YEAR}</h3>`;
  h+=`<div class="kv">
   <div class="k">souls</div><div class="v">${commify(STAT.pop)} ${spark(SERIES.pop,120,14)}</div>
   <div class="k">holdfasts</div><div class="v">${STAT.sites}</div>
   <div class="k">realms</div><div class="v">${STAT.pols} ${spark(SERIES.pol,120,14,'#9fc0da')}</div>
   <div class="k">named living</div><div class="v">${STAT.chars}</div>
   <div class="k">houses</div><div class="v">${STAT.dyns} of ${DYNS.length} ever</div>
   <div class="k">wars burning</div><div class="v">${STAT.wars} ${spark(SERIES.wars,120,14,'#b04030')}</div>
   <div class="k">the deep power</div><div class="v">${Math.round(MAGIC*100)}% ${spark(SERIES.magic,120,14,'#8a6fc0')}</div>
   <div class="k">the sky</div><div class="v">${CLIMATE_ANOM>0.4?'warm':CLIMATE_ANOM<-0.8?'bitter':'settled'} (${CLIMATE_ANOM.toFixed(2)}) ${spark(SERIES.temp,120,14,'#7fa8c0')}</div>
   <div class="k">arts known</div><div class="v">avg ${SERIES.tech.length?SERIES.tech[SERIES.tech.length-1].toFixed(1):0}/${NTECH} ${spark(SERIES.tech,120,14,'#4d7a3a')}</div>
   ${PLAGUE?`<div class="k">pestilence</div><div class="v" style="color:var(--blood)">the ${esc(PLAGUE.name)}, ${commify(PLAGUE.dead)} dead</div>`:''}
   </div>`;
  const realms=POLS.filter(p=>p.alive&&p.liege<0).sort((a,b)=>polityPop(b)-polityPop(a));
  h+=`<h4 class="sub">The great realms</h4><table class="t"><tr><th>realm</th><th>ruler</th><th class="num">souls</th><th class="num">holds</th></tr>`;
  for(const p of realms.slice(0,18)){
    const rl=C(p.ruler);
    h+=`<tr><td>${PL(p)}</td><td>${rl?CHL(rl):'—'}</td><td class="num">${commify(polityPop(p))}</td><td class="num">${p.sites.length+allVassals(p).reduce((s,q)=>s+q.sites.length,0)}</td></tr>`;
  }
  h+=`</table>`;
  const cities=SITES.filter(s=>s.alive).sort((a,b)=>b.pop-a.pop);
  h+=`<h4 class="sub">The great cities</h4><table class="t"><tr><th>city</th><th class="num">souls</th><th>realm</th></tr>`;
  for(const s of cities.slice(0,12))
    h+=`<tr><td>${SL(s)}</td><td class="num">${commify(s.pop)}</td><td>${s.polity>=0&&P(s.polity)?PL(P(s.polity)):'—'}</td></tr>`;
  h+=`</table>`;
  h+=`<h4 class="sub">Peoples</h4><table class="t"><tr><th>people</th><th>kind</th><th class="num">souls</th><th class="num">arts</th></tr>`;
  for(const c of CULTURES.slice().sort((a,b)=>b.pop-a.pop).slice(0,16))
    h+=`<tr><td>${CL2(c)}</td><td class="muted">${esc(SPECIES[c.species].name)}</td><td class="num">${commify(c.pop)}</td><td class="num">${c.techs.size}</td></tr>`;
  h+=`</table>`;
  h+=`<h4 class="sub">Kinds</h4><div>${SPECIES.map(s=>lk('e',s.id,'',s.name)+(s.elder?' <span class="tag a">elder</span>':'')).join(' · ')}</div>`;
  h+=`<h4 class="sub">Tongues</h4><div>${LANGS.slice(0,26).map(l=>lk('g',l.id,'',l.name)).join(' · ')}</div>`;
  const live=ARTS.filter(a=>!a.destroyed).sort((a,b)=>b.renown-a.renown);
  h+=`<h4 class="sub">Things of power</h4><table class="t"><tr><th>name</th><th>kind</th><th>where</th></tr>`;
  for(const a of live.slice(0,14)){
    const hh=a.holder>=0? CHL(C(a.holder)) : (a.lost? '<span class="muted">lost</span>':'—');
    h+=`<tr><td>${AL(a)}</td><td class="muted">${esc(a.kindn)}</td><td>${hh}</td></tr>`;
  }
  h+=`</table>`;
  const pr=PROPHS.slice().reverse();
  if(pr.length){
    h+=`<h4 class="sub">Prophecies</h4>`;
    for(const p of pr.slice(0,10))
      h+=`<div class="ev s${p.fulfilled>=0?5:3}"><span class="yr">${p.year}</span>${lk('y',p.id,'','“'+p.text+'”')} ${p.fulfilled>=0?'<span class="tag g">fulfilled '+p.fulfilled+'</span>':(p.subverted?'<span class="tag">reinterpreted</span>':'')}</div>`;
  }
  h+=`<h4 class="sub">Before the reckoning</h4>`;
  for(const p of POWERS)
    h+=`<div>${esc(p.name)} <span class="muted">— ${esc(p.dname)}, of the ${esc(p.alignment)}; ${lk('t',p.seat,'','its seat')}</span></div>`;
  for(const ct of CATACLYSMS)
    h+=`<div class="quote">${esc(ct.name)}: ${esc(ct.tale)} ${lk('t',ct.centre,'','[where]')}</div>`;
  /* legend drift: what the singers have made of it since */
  const old=LEGENDS.filter(l=>YEAR-l.year>90);
  if(old.length){
    h+=`<h4 class="sub">As it is now remembered</h4>`;
    h+=`<p class="hint">The chronicle records what happened. This is what people say happened.</p>`;
    const step=Math.max(1,Math.floor(old.length/7));
    for(let k=old.length-1,n=0;k>=0&&n<7;k-=step,n++){
      const l=old[k];
      const c=CULTURES.length? CULTURES[(l.id)%CULTURES.length] : null;
      h+=`<p class="ev s3"><span class="yr">${l.year}</span>${retell(l,YEAR,c?c.id:0)}</p>`;
    }
  }
  box.innerHTML=h;
}

/* --------------------------------------------------------------- search     */
function renderSearch(q){
  const box=$('search');
  let h=`<input type="text" id="searchbox" placeholder="search names — people, towns, realms, houses, relics…" value="${esc(q||'')}">`;
  if(!q||q.length<2){ box.innerHTML=h+'<p class="hint">Type at least two letters.</p>'; wireSearch(); return; }
  const ql=q.toLowerCase();
  const hit=(n)=>n&&n.toLowerCase().indexOf(ql)>=0;
  const rows=[];
  for(const s of SITES) if(hit(s.name)&&rows.length<60) rows.push(['town',SL(s),s.alive?commify(s.pop)+' souls':'ruined']);
  for(const p of POLS) if(hit(p.name)&&rows.length<90) rows.push(['realm',PL(p),p.alive?commify(polityPop(p))+' souls':'ended '+p.ended]);
  for(const d of DYNS) if(hit(d.name)&&rows.length<120) rows.push(['house',DL(d),d.extinct?'extinct':d.living+' living']);
  for(const c of CULTURES) if(hit(c.name)&&rows.length<140) rows.push(['people',CL2(c),commify(c.pop)]);
  for(const f of FAITHS) if(hit(f.name)&&rows.length<160) rows.push(['faith',FL(f),commify(f.followers)]);
  for(const a of ARTS) if(hit(a.name)&&rows.length<180) rows.push(['relic',AL(a),a.holder>=0?'borne':'lost']);
  let n=0;
  for(let i=CHARS.length-1;i>=0&&rows.length<260;i--){
    const c=CHARS[i];
    if(hit(c.name)){ rows.push([c.died<0?'living':'dead', CHL(c), (c.titles.length&&P(c.titles[0])?P(c.titles[0]).name:'')+' '+c.born+'–'+(c.died<0?'':c.died)]); n++; }
  }
  h+=`<table class="t"><tr><th>kind</th><th>name</th><th>note</th></tr>`;
  for(const r of rows) h+=`<tr><td class="muted">${r[0]}</td><td>${r[1]}</td><td class="muted">${esc(r[2])}</td></tr>`;
  h+=`</table>`;
  if(!rows.length) h+='<p class="muted">Nothing of that name.</p>';
  box.innerHTML=h;
  wireSearch();
}
function wireSearch(){
  const el=$('searchbox');
  if(!el) return;
  el.oninput=()=>{ const v=el.value; const pos=el.selectionStart; renderSearch(v);
    const e2=$('searchbox'); if(e2){ e2.focus(); e2.setSelectionRange(pos,pos); } };
}

/* --------------------------------------------------------------- shell      */
function setPane(p){
  PANE=p;
  document.querySelectorAll('.pane').forEach(e=>e.classList.toggle('on',e.id===p));
  document.querySelectorAll('.tab').forEach(e=>e.classList.toggle('on',e.dataset.p===p));
  if(p==='world') renderWorld();
  if(p==='search') renderSearch($('searchbox')?$('searchbox').value:'');
  if(p==='chronicle') renderChronicle();
  if(p==='inspect') renderInspect();
}
function updateClock(){
  $('clock').innerHTML=`<b>Year ${YEAR}</b> <span id="mon">${MONTHS[MONTH]}</span>`;
  const era = YEAR<80?'the First Age of Men':
              MAGIC>0.55? 'the world still hums':
              MAGIC>0.25? 'the power is thinning':
              MAGIC>0.10? 'the long fading':'the age of iron and forgetting';
  $('era').textContent='— '+era;
  $('statusbar').innerHTML=
    `<span><b>souls</b> ${commify(STAT.pop)}</span>`+
    `<span><b>realms</b> ${STAT.pols}</span>`+
    `<span><b>towns</b> ${STAT.sites}</span>`+
    `<span><b>named</b> ${STAT.chars}</span>`+
    `<span><b>wars</b> ${STAT.wars}</span>`+
    `<span><b>hosts</b> ${ARMIES.length}</span>`+
    `<span><b>power</b> ${Math.round(MAGIC*100)}%</span>`+
    (YEAR<TARGET? `<span style="color:var(--gold)"><b>running to</b> year ${TARGET}…</span>`:'')+
    (PLAGUE?`<span style="color:var(--blood)"><b>plague</b> ${esc(PLAGUE.name)}</span>`:'');
}

/* --------------------------------------------------------------- main loop  */
let lastRender=0;
function frame(ts){
  requestAnimationFrame(frame);
  if(GEN&&!GENDONE){ stepGen(); return; }
  if(GENDONE&&(RUNNING||YEAR<TARGET)){
    const jumping = YEAR<TARGET;
    const budget = jumping? 26 : ([0,4,7,10,14,18,24,34,48][SPEED]||14);
    const t0=performance.now();
    let n=0;
    while(performance.now()-t0<budget&&n<400){
      tickYear(); n++;
      if(!RUNNING&&YEAR>=TARGET) break;
    }
    if(n){
      updateClock();
      if(!jumping||YEAR>=TARGET){
        if(PANE==='chronicle') renderChronicle();
        if(PANE==='world') renderWorld();
        if(PANE==='inspect') renderInspect();
        renderLegend();
      }
    }
  }
  /* redraw less often while centuries are flying past; snappily when idle */
  const gap=(RUNNING||YEAR<TARGET)? 105 : 34;
  if((VIEWDIRTY||MAPDIRTY)&&ts-lastRender>gap){
    drawMap(); MAPDIRTY=false; lastRender=ts;
  }
}

/* --------------------------------------------------------------- worldgen   */
function startGen(seed){
  RUNNING=false; GENDONE=false; TARGET=0;
  $('gennote').style.display='flex';
  $('bar').firstElementChild.style.width='0%';
  GEN=worldgen(seed);
  GENSEED=seed;
  $('btnPlay').textContent='▶ RUN';
}
let GENSEED=0, GENPHASE=0;
function stepGen(){
  const t0=performance.now();
  while(performance.now()-t0<26){
    const r=GEN.next();
    if(r.done){
      $('genmsg').textContent='naming the world, and everyone in it…';
      $('bar').firstElementChild.style.width='72%';
      setTimeout(()=>{
        worldBirth(GENSEED);
        GEN=null; GENDONE=true;
        $('gennote').style.display='none';
        /* open on the busiest quarter of the world, framed */
        setZoom(2);
        let bx=0,by=0,n=0;
        for(const s of SITES){ if(!s.alive) continue; bx+=s.tile%W; by+=(s.tile/W|0); n++; }
        const ct = n? wrapx(Math.round(bx/n))+clamp(Math.round(by/n),0,H-1)*W : (W/2|0)+(H/2|0)*W;
        centreOn(ct);
        VIEWDIRTY=true; MAPDIRTY=true;
        updateClock(); renderChronicle(); renderLegend();
      },20);
      return;
    }
    $('bar').firstElementChild.style.width=(r.value[0]*70).toFixed(0)+'%';
    $('genmsg').textContent=r.value[1];
    if(r.value[0]>0.55) break;
  }
}
function renderLegend(){ $('legend').innerHTML=legendFor(MODE); }

/* --------------------------------------------------------------- wiring     */
function boot(){
  renderInit();
  resizeMap();
  window.addEventListener('resize',()=>{ resizeMap(); });
  /* the legend grows and shrinks with the map mode; the canvas must follow it */
  if(window.ResizeObserver){
    let last=0;
    new ResizeObserver(()=>{
      const wrap=$('mapwrap');
      const k=wrap.clientWidth*10000+wrap.clientHeight;
      if(k!==last){ last=k; resizeMap(); }
    }).observe($('mapwrap'));
  }
  /* map modes */
  $('modebar').innerHTML=MAPMODES.map(m=>`<button class="mode ${m.k===MODE?'on':''}" data-m="${m.k}">${m.n}</button>`).join('');
  $('modebar').addEventListener('click',e=>{
    const b=e.target.closest('.mode'); if(!b) return;
    MODE=b.dataset.m;
    document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('on',x.dataset.m===MODE));
    VIEWDIRTY=true; renderLegend();
  });
  /* tabs */
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>setPane(t.dataset.p));
  /* global link clicks */
  document.body.addEventListener('click',e=>{
    const a=e.target.closest('a.lk');
    if(a){ inspect(a.dataset.t,a.dataset.i); e.preventDefault(); return; }
    const sv=e.target.closest('[data-sev]');
    if(sv){ FILTER.sev=+sv.dataset.sev; FILTER.ent=null; renderChronicle(); return; }
    if(e.target.id==='clrent'){ FILTER.ent=null; FILTER.entName=''; renderChronicle(); return; }
    if(e.target.id==='introhide'){ INTRODONE=true; renderChronicle(); return; }
    if(e.target.id==='introhelp'){ showHelp(); return; }
    const fl=e.target.closest('[data-follow]');
    if(fl){ followEntity(fl.dataset.follow, +fl.dataset.fid); return; }
  });
  /* controls */
  $('btnGen').onclick=()=>{ const s=hashStr($('seed').value||'world',0); startGen(s|0); };
  $('btnRandom').onclick=()=>{ const s=Math.floor(Math.random()*1e9);
    $('seed').value=String(s); startGen(s|0); };
  $('btnPlay').onclick=()=>{ if(!GENDONE) return;
    if(YEAR<TARGET){ TARGET=0; $('btnPlay').textContent='▶ RUN'; $('btnPlay').classList.remove('on'); return; }
    RUNNING=!RUNNING;
    $('btnPlay').textContent=RUNNING?'❚❚ PAUSE':'▶ RUN';
    $('btnPlay').classList.toggle('on',RUNNING); };
  const step=n=>{ if(!GENDONE) return;
    if(n<=1){ tickYear(); updateClock(); MAPDIRTY=true;
      if(PANE==='chronicle') renderChronicle(); if(PANE==='world') renderWorld();
      if(PANE==='inspect') renderInspect(); return; }
    TARGET=Math.max(TARGET,YEAR+n); };
  $('btnStep').onclick=()=>step(1);
  $('btnStep10').onclick=()=>step(10);
  $('btnStep100').onclick=()=>step(100);
  $('btnStep500').onclick=()=>step(500);
  $('speed').oninput=e=>{ SPEED=+e.target.value; };
  $('btnHelp').onclick=showHelp;
  /* map interaction */
  const wrap=$('mapwrap');
  let drag=null;
  wrap.addEventListener('mousedown',e=>{ drag={x:e.clientX,y:e.clientY,cx:CAMX,cy:CAMY,moved:0}; });
  window.addEventListener('mouseup',e=>{
    if(drag&&drag.moved<4){
      const t=tileAt(e);
      if(t>=0){
        const s=T.site[t];
        if(s>=0&&SITES[s]) inspect('s',s);
        else if(T.ruin[t]>=0) inspect('r',T.ruin[t]);
        else inspect('t',t);
      }
    }
    drag=null;
  });
  window.addEventListener('mousemove',e=>{
    if(drag){
      const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
      drag.moved=Math.max(drag.moved,Math.abs(dx)+Math.abs(dy));
      CAMX=wrapx(drag.cx-Math.round(dx/ATL.cw));
      CAMY=drag.cy-Math.round(dy/ATL.ch);
      VIEWDIRTY=true;
      return;
    }
    hoverTip(e);
  });
  wrap.addEventListener('wheel',e=>{ e.preventDefault(); setZoom(ZOOM+(e.deltaY<0?1:-1)); },{passive:false});
  wrap.addEventListener('mouseleave',()=>{ $('hover').style.display='none'; });
  $('minimap').addEventListener('click',e=>{
    const r=$('minimap').getBoundingClientRect();
    const x=((e.clientX-r.left)/r.width*W)|0, y=((e.clientY-r.top)/r.height*H)|0;
    centreOn(wrapx(x)+clamp(y,0,H-1)*W);
  });
  window.addEventListener('keydown',e=>{
    if(e.target.tagName==='INPUT') return;
    if(e.key===' '){ $('btnPlay').click(); e.preventDefault(); }
    if(e.key==='ArrowLeft') { CAMX=wrapx(CAMX-4); VIEWDIRTY=true; }
    if(e.key==='ArrowRight'){ CAMX=wrapx(CAMX+4); VIEWDIRTY=true; }
    if(e.key==='ArrowUp')   { CAMY-=3; VIEWDIRTY=true; }
    if(e.key==='ArrowDown') { CAMY+=3; VIEWDIRTY=true; }
    if(e.key==='+'||e.key==='=') setZoom(ZOOM+1);
    if(e.key==='-') setZoom(ZOOM-1);
    if(e.key==='l'||e.key==='L'){ SHOWLABELS=!SHOWLABELS; VIEWDIRTY=true; }
    if(e.key>='1'&&e.key<='9'){ const m=MAPMODES[+e.key-1]; if(m){ MODE=m.k;
      document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('on',x.dataset.m===MODE));
      VIEWDIRTY=true; renderLegend(); } }
  });
  $('seed').value=String(Math.floor(Math.random()*1e9));
  requestAnimationFrame(frame);
  startGen(hashStr($('seed').value,0)|0);
}
function tileAt(e){
  const r=CAN.getBoundingClientRect();
  const cx=Math.floor((e.clientX-r.left)/ATL.cw), cy=Math.floor((e.clientY-r.top)/ATL.ch);
  if(cx<0||cy<0||cy>=viewRows()) return -1;
  const y=CAMY+cy; if(y<0||y>=H) return -1;
  return wrapx(CAMX+cx)+y*W;
}
function hoverTip(e){
  const box=$('hover');
  if(!GENDONE){ box.style.display='none'; return; }
  const t=tileAt(e);
  if(t<0){ box.style.display='none'; return; }
  const lines=[];
  const s=T.site[t]>=0? SITES[T.site[t]] : null;
  if(s&&s.alive){
    lines.push(s.name+' — '+cap(TIERN[s.tier])+', '+commify(s.pop)+' souls');
    const p=P(s.polity);
    if(p) lines.push(p.name+(C(p.ruler)?' · '+shortName(C(p.ruler)):''));
    lines.push(CULTURES[s.culture].name+' · '+(s.faith>=0?FAITHS[s.faith].name:'—'));
    if(s.siege) lines.push('UNDER SIEGE');
  }else{
    lines.push(BIOME[T.biome[t]].n);
    if(T.owner[t]>=0&&P(T.owner[t])) lines.push(P(T.owner[t]).name);
    if(T.ruin[t]>=0) lines.push('ruins of '+RUINS[T.ruin[t]].name);
  }
  lines.push(`${T.temp[t].toFixed(0)}°  ${Math.round(T.rain[t])}mm  soil ${(T.fert[t]*100).toFixed(0)}`+
             (T.res[t]?'  '+RES[T.res[t]].n:'')+(T.ley[t]*MAGIC>0.7?'  ✦power':''));
  const army=ARMIES.filter(a=>a.tile===t);
  if(army.length) lines.push(army.map(a=>'⚔ '+commify(a.size)+' of '+(P(a.pol)?P(a.pol).name:'?')).join('\n'));
  box.textContent=lines.join('\n');
  box.style.display='block';
  const wr=$('mapwrap').getBoundingClientRect();
  let x=e.clientX-wr.left+14, y=e.clientY-wr.top+14;
  if(x+280>wr.width) x-=300;
  if(y+120>wr.height) y-=140;
  box.style.left=x+'px'; box.style.top=y+'px';
}
function showHelp(){
  SEL={t:null,i:-1};
  setPane('inspect');
  $('inspect').innerHTML=`
   <h3 class="hd">THE CHRONICLE ENGINE</h3>
   <p>A world is built from a seed: plates collide, rain falls where the wind carries it,
   rivers cut where water runs downhill, and soil is good where the geology says it should be.
   Everything after that follows from people trying to eat, marry well, and outlive their enemies.</p>
   <h4 class="sub">Nothing here is written in advance</h4>
   <p class="muted">Languages are generated from phoneme inventories and then split by regular sound
   laws, so related peoples have cognate words. Place-names are composed from what is actually on the
   tile — every name can be glossed. Gods are given the domains their founding landscape cared about.
   Wars begin from claims, grudges, holy sites in the wrong hands, or plain arithmetic about who is weaker.
   Famines come from grain stocks reaching zero. Roads appear where carts already went.</p>
   <h4 class="sub">Controls</h4>
   <table class="t">
    <tr><td>drag / arrows</td><td class="muted">pan the map</td></tr>
    <tr><td>wheel / + −</td><td class="muted">zoom</td></tr>
    <tr><td>1 … 9</td><td class="muted">map modes</td></tr>
    <tr><td>space</td><td class="muted">run / pause</td></tr>
    <tr><td>click a tile</td><td class="muted">inspect it</td></tr>
    <tr><td>click any gold name</td><td class="muted">follow it anywhere</td></tr>
   </table>
   <h4 class="sub">Reading the map</h4>
   <p class="muted">REALMS shows borders; frontier tiles are drawn bright. WAR shows realms in arms and
   burned ground. POWER shows the leylines — they are fading, and when they are gone the elder peoples
   go with them. LEGENDS shows only ruins and the scars of the Elder Age.</p>
   <p class="muted">Same seed, same world, always.</p>`;
}
window.addEventListener('DOMContentLoaded',boot);
