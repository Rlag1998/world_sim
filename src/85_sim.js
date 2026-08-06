/* ============================================================================
   PART X — THE TURNING OF YEARS
   The chronicle, the world's birth, and the year-tick that binds every other
   system together.
   ========================================================================== */

let WORLDGLOSS='';
let YEAR=0, MONTH=0, SEEDV=0, CLIMATE_ANOM=0, GREATWINTER=0, EVENTS=[], EVCAP=42000, EVSEQ=0;
let STAT={pop:0,pols:0,chars:0,wars:0,sites:0};
const SERIES={pop:[],wars:[],magic:[],temp:[],pol:[],tech:[]};

/* --------------------------------------------------------------- chronicle  */
function chron(year,sev,kind,text,refs){
  const e={i:EVSEQ++, y:year, s:sev, k:kind, t:text, r:refs||{}};
  EVENTS.push(e);
  if(EVENTS.length>EVCAP) EVENTS.splice(0,4000);
  const push=(arr,id,list)=>{ if(!list) return;
    for(const x of list){ if(x===undefined||x<0) continue;
      const o=arr[x]; if(o&&o.ev){ o.ev.push(e.i); if(o.ev.length>26) o.ev.shift(); } } };
  push(CHARS,0,refs&&refs.chars);
  push(SITES,0,refs&&refs.sites);
  if(refs&&refs.pols) for(const x of refs.pols){ const p=P(x); if(p) { p.history.push(e.i); if(p.history.length>40) p.history.shift(); } }
  if(sev>=4) makeLegend(e);
  return e;
}
function evById(i){
  /* EVENTS is append-ordered by i, with a possible head trim */
  let lo=0, hi=EVENTS.length-1;
  while(lo<=hi){ const m=(lo+hi)>>1; if(EVENTS[m].i===i) return EVENTS[m];
    if(EVENTS[m].i<i) lo=m+1; else hi=m-1; }
  return null;
}

/* link helpers — every bolded name in the chronicle is clickable */
function lk(t,i,cls,txt){ return `<a class="lk ${cls||''}" data-t="${t}" data-i="${i}">${esc(txt)}</a>`; }
function SL(s){ return s? lk('s',s.id,'s',s.name) : '—'; }
function CHL(c){ return c? lk('c',c.id,'',shortName(c)+(c.epi?' '+c.epi:'')) : '—'; }
function PL(p){ return p? lk('p',p.id,'p',p.name) : '—'; }
function DL(d){ return d? lk('d',d.id,'','House '+d.name) : '—'; }
function CL2(c){ return c? lk('u',c.id,'c',c.name) : '—'; }
function FL(f){ return f? lk('f',f.id,'f',f.name) : '—'; }
function AL(a){ return a? lk('a',a.id,'a',a.name) : '—'; }
function RL(ru){ return ru? lk('r',ru.id,'','the ruins of '+ru.name) : '—'; }

/* --------------------------------------------------------------- birth      */
function worldBirth(seed){
  SEEDV=seed; YEAR=0; MONTH=0; GREATWINTER=0; CLIMATE_ANOM=0; PLAGUE=null;
  EVENTS=[]; EVSEQ=0; LEGENDS=[]; PROPHS=[];
  CHARS=[]; DYNS=[]; LIVING=new Set(); POLS=[]; WARS=[]; ARMIES=[];
  SITES=[]; CULTURES=[]; FAITHS=[]; ROUTE_CACHE.clear();
  for(const k in SERIES) SERIES[k]=[];
  const r=stream(seed,'birth');

  elderLore(seed);
  siteGridBuild();
  /* the world gets a name in the oldest tongue that still has speakers */
  {
    const lw=LANGS[0];
    const nm=lw.unique([pick(r,['earth','land','realm','sky','deep','stone']),
                        pick(r,['great','old','first','fair','wide','far'])],{});
    WORLDNAME = nm.t;
    WORLDGLOSS = nm.g;
  }

  /* ---- where do peoples begin? at the best land, one hearth at a time --- */
  const nCult=ri(r,10,15);
  const cands=[];
  for(let i=0;i<NT;i+=3){ if(!T.land[i]) continue;
    const s=siteSuitability(i); if(s>0.9) cands.push([i,s]); }
  cands.sort((a,b)=>b[1]-a[1]);
  const homes=[];
  for(const [i,s] of cands){
    if(homes.length>=nCult) break;
    let ok=true;
    for(const h of homes) if(tdist(h,i)<30) { ok=false; break; }
    if(ok) homes.push(i);
  }
  while(homes.length<nCult){
    const i=ri(r,0,NT-1); if(T.land[i]) homes.push(i);
  }
  let langIdx=0;
  for(let k=0;k<homes.length;k++){
    const home=homes[k];
    /* which people took root here? whichever finds the land congenial */
    const sp=pickW(r,SPECIES,s=>{
      let v=0.4;
      if(s.biomePref.indexOf(T.biome[home])>=0) v+=2.2;
      if(s.elder) v*= (T.ley[home]>0.7? 2.6 : 0.35);
      if(s.tags.some(t=>t.k==='seafaring')&&T.coast[home]) v+=1.0;
      if(s.tags.some(t=>t.k==='delving')&&T.alt[home]>0.34) v+=1.1;
      return v;
    });
    const lang=LANGS[(langIdx++)%LANGS.length];
    const cult=newCulture(seed,r,sp,lang,home,null);
    const faith=newFaith(seed,r,cult,home,null);
    cult.faith=faith.id; faith.culture=cult.id;
    /* holy places: the strangest ground within reach */
    const holyCands=[];
    for(let a=0;a<600;a++){
      const i=ri(r,0,NT-1);
      if(!T.land[i]||tdist(i,home)>34) continue;
      holyCands.push([i, T.ley[i]*2 + (T.scar[i]?1.2:0) + T.alt[i]*0.9 + (T.res[i]===R_STARMETAL?2:0)]);
    }
    holyCands.sort((a,b)=>b[1]-a[1]);
    for(let q=0;q<Math.min(3,holyCands.length);q++) faith.holy.push(holyCands[q][0]);
    for(const t of faith.holy) T.faith[t]=faith.id;
    /* the first holdfasts */
    const nS=ri(r,3,6);
    const placed=[];
    for(let q=0;q<nS;q++){
      let best=-1,bv=-1;
      for(let a=0;a<420;a++){
        const dx=ri(r,-22,22), dy=ri(r,-16,16);
        const y=clamp((home/W|0)+dy,1,H-2), i=wrapx((home%W)+dx)+y*W;
        if(!T.land[i]||T.site[i]>=0) continue;
        let v=siteSuitability(i);
        if(sp.biomePref.indexOf(T.biome[i])>=0) v+=0.5;
        for(const p of placed) if(tdist(p,i)<6) v-=3;
        if(tdist(home,i)>26) v-=1.5;
        if(v>bv){bv=v;best=i;}
      }
      if(best<0) continue;
      placed.push(best);
      const s=newSite(seed,r,best,cult,faith.id,0,-1);
      claimHinterland(s);
      T.cult[best]=cult.id;
    }
  }
  siteGridBuild();

  /* ---- the first lords ------------------------------------------------- */
  for(const s of SITES){
    if(!s.alive) continue;
    const cult=CULTURES[s.culture];
    const rl=newChar(r,cult,s.faith,-ri(r,20,40),null,null);
    const dyn=newDynasty(seed,r,rl.id,cult,s.name);
    rl.dyn=dyn.id; dyn.members.push(rl.id); dyn.living++; dyn.seat=s.id;
    rl.prestige=ri(r,20,90);
    const p=newPolity(seed,r,s,rl,0);
    s.holder=rl.id;
    /* a spouse and a child or two, so the lines can begin */
    const sp2=newChar(r,cult,s.faith,-ri(r,18,36),null,null, rl.sex==='m'?'f':'m');
    marryPair(rl,sp2,0,r);
    for(let q=0;q<ri(r,1,3);q++){
      const kid=birth(rl.sex==='f'?rl:sp2, rl.sex==='m'?rl:sp2, -ri(r,1,18), r,false);
      kid.site=s.id; kid.court=s.id;
    }
  }
  /* neighbouring holds of one people gather under the strongest */
  const byC={};
  for(const p of POLS){ if(!p.alive) continue; (byC[p.culture]=byC[p.culture]||[]).push(p); }
  for(const k in byC){
    const list=byC[k].sort((a,b)=>polityPop(b)-polityPop(a));
    const head=list[0];
    for(let q=1;q<list.length;q++){
      if(chance(r,0.55)) vassalize(list[q],head,0,false);
    }
  }
  buildTradeLinks(seed);
  for(const s of SITES){ if(s.alive){ produce(s); consume(s); repriceAll(s); } }
  for(const c of CULTURES){ c.techs.add('fire_hard'); c.techs.add('pottery'); if(chance(r,0.6)) c.techs.add('ard'); }

  chron(0,5,'genesis',
    `<b>${esc(WORLDNAME)}</b> — “${esc(WORLDGLOSS)}”. The reckoning of years begins. ${plural(CULTURES.length,'people')} keep fire in ${plural(SITES.length,'holdfast')} `+
    `across a world already old: ${plural(RUINS.length,'ruin')} stand from before the counting, and the power in the deep places `+
    `is measured at ${Math.round(MAGIC*100)} parts in a hundred.`,{});
  for(const ct of CATACLYSMS)
    chron(0,4,'elder',`Of ${ct.name}: ${ct.tale}`,{tile:ct.centre});
  recomputeStats();
}

/* --------------------------------------------------------------- year tick  */
function tickYear(){
  YEAR++;
  const Y=YEAR;
  const r=stream(SEEDV*7919+Y,'year');

  /* ---- the sky --------------------------------------------------------- */
  CLIMATE_ANOM = CLIMATE_ANOM*0.72 + gauss(r,0,0.32);
  if(GREATWINTER>0){
    GREATWINTER--;
    CLIMATE_ANOM = Math.min(CLIMATE_ANOM, -1.6 - rf(r,0,1.4));
    if(GREATWINTER===0) chron(Y,5,'winter',
      `The long winter breaks at last. The rivers run again. Those who are left count themselves.`,{});
  } else if(chance(r,0.010)){
    const sev=rf(r,1.2,3.4);
    CLIMATE_ANOM-=sev;
    chron(Y,4,'volcano',
      `A mountain in the far ${chance(r,0.5)?'north':'south'} tears itself open. The sun is a copper coin behind the ash.`,{});
    if(chance(r,0.22)){
      GREATWINTER=ri(r,4,14);
      chron(Y,5,'winter',
        `The summer does not come. Snow lies in the harvest month, and the old people say it will not lift for years.`,{});
    }
  }
  MAGIC = MAGIC0*Math.exp(-Y/620);
  MAGIC = clamp(MAGIC,0.02,1.4);

  /* ---- the land -------------------------------------------------------- */
  const cold = CLIMATE_ANOM;
  for(const s of SITES){
    if(!s.alive) continue;
    produce(s);
    if(cold<-0.8) s.prod[G_GRAIN]*=clamp(1+cold*0.16,0.35,1);
    else if(cold>0.8) s.prod[G_GRAIN]*=clamp(1+cold*0.05,1,1.2);
    consume(s);
  }
  for(const s of SITES) if(s.alive) runTrade(s,Y);
  for(const s of SITES) if(s.alive){ repriceAll(s); popStep(s,Y,r); }
  if(Y%3===0) for(const s of SITES) if(s.alive) growRoads(s,Y);

  /* ---- elder folk fade ------------------------------------------------- */
  if(Y%10===0){
    for(const sp of SPECIES){
      if(!sp.elder) continue;
      const fade=sp.magicDecay*(1-MAGIC)*0.030;
      if(fade<=0) continue;
      for(const s of SITES){
        if(!s.alive||CULTURES[s.culture].species!==sp.id) continue;
        for(let k=0;k<NCLASS;k++) s.cls[k]*=(1-fade);
        s.pop*=(1-fade);
      }
      if(Y%200===0&&MAGIC<0.5)
        chron(Y,4,'fade',`The ${sp.name} grow fewer. They say the world no longer holds them well.`,{});
    }
  }

  /* ---- plague ---------------------------------------------------------- */
  plagueTick(Y,r);

  /* ---- the people ------------------------------------------------------ */
  if(Y%10===0){
    for(const c of CULTURES){
      cultureDrift(c,r,null);
      c.pop=0; c.tiles=0;
    }
    for(const s of SITES) if(s.alive) CULTURES[s.culture].pop+=s.pop;
    /* literacy follows clerks, priests and books */
    for(const c of CULTURES){
      let lit=0,tot=0;
      for(const s of SITES) if(s.alive&&s.culture===c.id){
        lit+=s.cls[CL_MERCHANT]+s.cls[CL_CLERIC]+s.cls[CL_NOBLE]+s.univ*400; tot+=s.pop; }
      const target=tot>0? clamp(lit/tot*3.1,0,0.95):0;
      c.vals.literacy = c.vals.literacy*0.85 + target*0.15;
    }
    cultureSplit(Y,r);
  }
  for(const c of CULTURES) if((c.id+Y)%4===0){ techTick(c,r,Y); techDecay(c,r,Y); }
  if(Y%5===0) contactDiffusion(r,Y);

  /* ---- the gods -------------------------------------------------------- */
  if(Y%5===0) religionTick(Y,r);

  /* ---- the blood ------------------------------------------------------- */
  nobilityTick(Y,r);
  charactersTick(Y,r);

  /* ---- the realms ------------------------------------------------------ */
  for(const p of POLS){
    if(!p.alive) continue;
    if(!p.sites.length){ dissolvePolity(p,Y,'nothing left to rule'); continue; }
    if(p.capital<0||!SITES[p.capital]||!SITES[p.capital].alive||SITES[p.capital].polity!==p.id){
      p.capital=p.sites[0]; p.capitalTile=SITES[p.capital].tile;
    }
    if((p.id+Y)%2===0){ diplomacyTick(p,Y,r); }
    p.tier=polityTierByPop(p);
    let inc=0;
    for(const sid of p.sites){ const s=SITES[sid];
      inc += s.taxBase*0.32 + s.pop*0.00055*(0.5+p.central); }
    for(const vid of p.vassals){ const q=P(vid); if(q&&q.alive) inc+=q.treasury*0.05*contractLevy(q); }
    inc *= 1+techEffect(CULTURES[p.culture],'tax');
    p.treasury += inc - p.levyPool*0.004 - p.sites.length*0.25;
    p.treasury = clamp(p.treasury,-600, 1200 + p.sites.length*1100 + polityPop(p)*0.02);
    p.legit = clamp(p.legit + (p.treasury>0?0.004:-0.008) - p.warExhaust*0.004,0.03,1);
    /* one head, one crown: realms that fall to the same ruler come under the
       greatest of them rather than drifting on as separate kingdoms */
    if((p.id+Y)%5===0&&p.liege<0){
      const rl=C(p.ruler);
      if(rl&&rl.titles.length>1){
        const mine=rl.titles.map(P).filter(q=>q&&q.alive&&q.ruler===rl.id&&q.liege<0);
        if(mine.length>1){
          mine.sort((a,b)=>polityPop(b)-polityPop(a));
          const head=mine[0];
          for(let k=1;k<mine.length;k++){
            if(mine[k]===head) continue;
            mine[k].liege=head.id;
            if(head.vassals.indexOf(mine[k].id)<0) head.vassals.push(mine[k].id);
            if(k===1) chron(Y,4,'union',
              `${CHL(rl)} wears more than one crown; ${listify(mine.slice(1,4).map(q=>PL(q)))} `+
              `${mine.length>2?'are':'is'} joined to ${PL(head)} in a personal union.`,
              {chars:[rl.id],pols:mine.map(q=>q.id)});
          }
        }
      }
    }
    if((p.id+Y)%3===0) factionCheck(p,Y,r);
    if((p.id+Y)%2===0) considerWar(p,Y,r);
    /* unrest where the lord is foreign or the land is wasted */
    for(const sid of p.sites){
      const s=SITES[sid];
      let u=0;
      if(s.culture!==p.culture) u+=0.010*(1+cultureGap(CULTURES[s.culture],CULTURES[p.culture]));
      if(s.faith!==p.faith) u+=0.012;
      u += s.devast*0.020 + (p.legit<0.4?0.010:0) - (p.treasury>500?0.004:0);
      u -= 0.004*Math.min(3,s.walls) + 0.010*p.legit + 0.004*p.central;
      if(sid===p.capital) u-=0.008;
      s.unrest=clamp(s.unrest+u,0,1.6);
      if(s.unrest>1.30&&chance(r,0.030)&&(sid!==p.capital||p.sites.length===1)) revolt(s,Y,r);
    }
  }

  /* ---- the sword ------------------------------------------------------- */
  for(let m=0;m<12;m++){
    for(const a of ARMIES.slice()) armyMove(a,Y,r);
    /* battles where hosts meet */
    const byTile=new Map();
    for(const a of ARMIES){ const l=byTile.get(a.tile)||[]; l.push(a); byTile.set(a.tile,l); }
    for(const [t,list] of byTile){
      if(list.length<2) continue;
      /* group by war, then by side: one field, one battle */
      const byWar=new Map();
      for(const a of list){ const l=byWar.get(a.war)||[]; l.push(a); byWar.set(a.war,l); }
      for(const [wid,hosts] of byWar){
        const w=WARS[wid]; if(!w||w.ended>=0||hosts.length<2) continue;
        const A=[],B=[];
        for(const a of hosts){ const sd=sideOf(w,a.pol); if(sd>0) A.push(a); else if(sd<0) B.push(a); }
        if(!A.length||!B.length) continue;
        fieldBattle(t,A,B,Y,r);
      }
    }
  }
  for(const w of WARS) warTick(w,Y,r);

  /* ---- new ground ------------------------------------------------------ */
  if(Y%4===0) settleFrontier(Y,r);
  if(Y%40===0) siteGridBuild();
  if(Y%7===0) migration(Y,r);

  /* ---- the old power --------------------------------------------------- */
  if(Y%3===0) mythTick(Y,r);
  checkProphecies(Y);

  if(Y%5===0) recomputeStats();
  if(Y%10===0){
    SERIES.pop.push(STAT.pop); SERIES.wars.push(STAT.wars);
    SERIES.magic.push(MAGIC); SERIES.temp.push(CLIMATE_ANOM);
    SERIES.pol.push(STAT.pols);
    let tsum=0; for(const c of CULTURES) tsum+=c.techs.size;
    SERIES.tech.push(CULTURES.length? tsum/CULTURES.length : 0);
    for(const k in SERIES) if(SERIES[k].length>900) SERIES[k].shift();
  }
  MAPDIRTY=true;
}

/* --------------------------------------------------------------- people     */
function charactersTick(Y,r){
  const dead=[];
  /* Houses that hold no land dwindle: their sons go for soldiers and are not
     written down. This is what keeps the cast of the chronicle finite. */
  const crowd = LIVING.size>5200? Math.max(0.35,5200/LIVING.size) : 1;
  const press = LIVING.size>6000? clamp(LIVING.size/6000-1,0,1.6) : 0;
  for(const id of LIVING){
    const ch=CHARS[id];
    if(!ch||ch.died>=0) continue;
    const sp=SPECIES[ch.spec];
    const age=Y-ch.born;
    /* mortality: infancy, then a long flat, then the slope */
    let m;
    if(age<2) m=0.075*(1.25-ch.health);
    else if(age<12) m=0.014*(1.25-ch.health);
    else m=0.0055*(1.3-ch.health) + Math.pow(Math.max(0,age/sp.life),8.5)*0.34;
    if(press>0 && age>26 && !ch.titles.length && !ch.arts.length && !ch.epi && ch.prestige<40
       && (ch.site<0 || !SITES[ch.site] || SITES[ch.site].holder!==ch.id)) m+=0.016*press;
    m *= 1 + (ch.prison>=0?0.35:0) + ch.stress*0.3;
    m *= (CLIMATE_ANOM<-1.5? 1.25:1);
    if(chance(r,m)){ dead.push(ch); continue; }
    /* the yearly business of a life, sharded so it stays cheap */
    if((ch.id+Y)%3!==0) continue;
    if(age>=14){
      if(!ch.married&&chance(r,0.55)) seekMarriage(ch,Y,r);
      else if(ch.married&&ch.sex==='f'&&age<sp.life*0.55){
        const mate=C(ch.sp);
        const seat = ch.site>=0? SITES[ch.site] : (mate&&mate.site>=0? SITES[mate.site] : null);
        const hd = seat? C(seat.holder) : null;
        const landed = !!(ch.titles.length || (mate&&mate.titles.length) ||
                          (hd&&(hd.id===ch.id||hd.id===ch.sp||hd.dyn===ch.dyn||(mate&&hd.dyn===mate.dyn))));
        const pr = 0.30*sp.fert*(1+traitSum(ch,'fert'))*(landed?1:0.80)*crowd;
        if(chance(r,pr)){
          const fa=C(ch.sp);
          if(fa&&alive(fa)) birth(ch,fa,Y,r,false);
        }
      }
      if(chance(r,0.02*(1+traitSum(ch,'bastard')))&&ch.married&&ch.sex==='m'){
        const mo=randomNoble(r);
        if(mo&&mo.sex==='f'&&alive(mo)) { const b=birth(mo,ch,Y,r,true);
          if(chance(r,0.3)) chron(Y,2,'bastard',`${CHL(ch)} acknowledges a natural child, ${CHL(b)}.`,{chars:[ch.id,b.id]}); }
      }
      plotTick(ch,Y,r);
      if(ch.titles.length) rulerActs(ch,Y,r);
      if(chance(r,(0.0016+ch.sk.lea*0.00025)*(0.4+MAGIC)) && MAGIC>0.06 && age>24 && (ch.sk.pie>11||ch.sk.lea>13||traitHas(ch,'seer'))) makeProphecy(ch,Y,r);
      judgeEpithet(ch,Y);
    }
    if(ch.prison>=0){
      const cap=C(ch.prison);
      if(!cap||!alive(cap)) ch.prison=-1;
      else if(chance(r,0.10)) ch.prison=-1;
      else if(chance(r,0.03+traitSum(cap,'cruel')*0.05)){
        killChar(ch,Y,'died in captivity',cap.id);
        chron(Y,4,'execute',`${CHL(ch)} dies in the keeping of ${CHL(cap)}.`,{chars:[ch.id,cap.id]});
      }
    }
    /* grudges cool, but slowly, and the vengeful never forget */
    if(ch.grudge.length&&(ch.id+Y)%9===0){
      const cool=0.985-traitSum(ch,'grudge')*0.02;
      for(const g of ch.grudge) g.w*=cool;
      ch.grudge=ch.grudge.filter(g=>g.w>4);
    }
  }
  for(const ch of dead){
    const sp=SPECIES[ch.spec];
    const age=Y-ch.born;
    const cause = age<3? 'in the cradle'
      : age>sp.life*0.85? 'of old age'
      : pick(r,['of a wasting sickness','of a fever','of a wound gone bad','of the bloody flux',
                'of the coughing sickness','falling from a horse','of a growth in the belly',
                'of childbed fever','of an ague that would not lift','in his sleep, which is rare enough']);
    const wasRuler=ch.titles.length>0;
    killChar(ch,Y,cause,null);
    if(wasRuler){
      chron(Y,4,'death',`${CHL(ch)} is dead, ${cause}, in the ${ordinal(age)} year of ${ch.sex==='m'?'his':'her'} life.`,
        {chars:[ch.id],pols:ch.titles.slice()});
      for(const tid of ch.titles.slice()){ const p=P(tid); if(p&&p.alive&&p.ruler===ch.id) succeed(p,Y,r); }
    }
    /* the dead are compacted: we keep the shape of the life, not the ledger */
    ch.rel=null;
    if(!wasRuler&&ch.arts.length===0&&!ch.epi&&ch.kids.length===0&&ch.ev.length===0) ch.slim=1;
  }
  /* pass artifacts down */
  for(const ch of dead){
    if(!ch.arts.length) continue;
    for(const aid of ch.arts.slice()){
      const it=ARTS[aid]; if(!it) continue;
      const heirs=ch.kids.map(C).filter(c=>c&&alive(c));
      if(heirs.length) giveArtifact(it,heirs[0],Y,'inherited from '+ch.name);
      else if(chance(r,0.5)){
        it.holder=-1; it.lost=true; it.buried= ch.site>=0? SITES[ch.site].tile : -1;
        it.chain.push({y:Y,what:'buried with '+ch.name,who:ch.id,where:it.buried});
        const rid=it.buried>=0? T.ruin[it.buried] : -1;
        if(rid>=0) RUINS[rid].buried.push(it.id);
      }else{
        it.holder=-1; it.lost=true;
        it.chain.push({y:Y,what:'lost after the death of '+ch.name,who:ch.id,where:-1});
      }
    }
  }
}
function randomNoble(r){
  if(!LIVING.size) return null;
  const n=(r()*CHARS.length)|0;
  for(let k=0;k<40;k++){
    const c=CHARS[(n+k*137)%CHARS.length];
    if(c&&alive(c)&&Y_ok(c)) return c;
  }
  return null;
}
function Y_ok(c){ return YEAR-c.born>=16 && YEAR-c.born<SPECIES[c.spec].life*0.6; }

function seekMarriage(ch,Y,r){
  const age=Y-ch.born;
  const myPol=ch.titles.length? P(ch.titles[0]) : (ch.court>=0&&SITES[ch.court]? P(SITES[ch.court].polity):null);
  const home=ch.site>=0? SITES[ch.site].tile : (myPol? myPol.capitalTile : 0);
  /* thin markets send lords looking further afield, as they did */
  let near=nearbySites(home,46);
  if(near.length<6) near=nearbySites(home,90);
  let pool=[];
  for(const s of near){
    const p=P(s.polity); if(!p||!p.alive) continue;
    const rl=C(p.ruler);
    const hd=C(s.holder);
    let cands=[];
    if(rl) cands=cands.concat([rl],rl.kids.map(C).filter(Boolean));
    if(hd) cands=cands.concat([hd],hd.kids.map(C).filter(Boolean));
    for(const c of cands){
      if(!c||!alive(c)||c.married||c.sex===ch.sex) continue;
      const a2=Y-c.born;
      if(a2<14||a2>SPECIES[c.spec].life*0.62) continue;
      if(Math.abs(a2-age)>Math.max(22,age*0.6)) continue;
      if(consang(ch,c)>=0.9) continue;
      pool.push({c,p});
    }
  }
  if(!pool.length) return;
  if(pool.length>40) pool=sampleK(r,pool,40);
  let best=null,bv=-1e9;
  for(const q of pool){
    const c=q.c;
    let v = q.p.tier*10 + polityPop(q.p)/9000 + c.prestige*0.05
          + (c.sk.dip+c.sk.ste)*0.6 + traitSum(c,'marry')*12
          - consang(ch,c)*40
          - cultureGap(CULTURES[ch.cult],CULTURES[c.cult])*26
          - (ch.faith!==c.faith? 22:0)
          + (myPol&&relation(myPol,q.p)>0? relation(myPol,q.p)*0.12:0);
    if(myPol&&q.p!==myPol&&atWar(myPol.id,q.p.id)) v-=60;
    v+=gauss(r,0,9);
    if(v>bv){bv=v;best=q;}
  }
  if(!best||bv<-30) return;
  marryPair(ch,best.c,Y,r);
  weddingTreachery(ch,best.c,Y,r);
  if(ch.titles.length||best.c.titles.length)
    chron(Y,3,'marry',`${CHL(ch)} is wed to ${CHL(best.c)}${best.p&&myPol&&best.p!==myPol? ', binding '+PL(myPol)+' to '+PL(best.p):''}.`,
      {chars:[ch.id,best.c.id],pols:[myPol?myPol.id:-1,best.p?best.p.id:-1].filter(x=>x>=0)});
}

/* A marriage between houses that hate each other is an opportunity, and some
   lords are the sort of men who take it. */
function weddingTreachery(a,b,Y,r){
  const host = chance(r,0.5)? a : b, guest = host===a? b : a;
  const hp = host.titles.length? P(host.titles[0]) : null;
  const gp = guest.titles.length? P(guest.titles[0]) : null;
  if(!hp||!gp||hp===gp) return;
  /* is there a debt of blood between these houses? */
  let hate=0;
  for(const g of host.grudge) if(g.d===guest.dyn) hate+=g.w;
  hate += Math.max(0,-relation(hp,gp))*0.35;
  hate += Math.max(0,-opinion(host,guest,Y))*0.4;
  if(hate<55) return;
  const nerve = traitSum(host,'cruel')*1.4 + traitSum(host,'plot') + host.sk.int*0.035
              + CULTURES[host.cult].vals.cruelty*0.5 - (traitHas(host,'honest')?0.8:0)
              - CULTURES[host.cult].vals.honor*0.9;
  if(nerve<0.30) return;
  if(!chance(r, clamp(nerve*0.16,0.01,0.20))) return;
  /* the doors are barred and the musicians change their tune */
  const victims=[guest];
  for(const kid of guest.kids){ const c=C(kid); if(c&&alive(c)&&victims.length<5) victims.push(c); }
  const gr=C(gp.ruler); if(gr&&alive(gr)&&victims.indexOf(gr)<0&&chance(r,0.6)) victims.push(gr);
  const dead=[];
  for(const v of victims){
    if(!chance(r,0.78)) continue;
    killChar(v,Y,'cut down at a wedding feast in '+(host.site>=0?SITES[host.site].name:'a hall'),host.id);
    dead.push(v);
    for(const tid of v.titles.slice()){ const tp=P(tid); if(tp&&tp.alive&&tp.ruler===v.id) succeed(tp,Y,r); }
  }
  if(!dead.length) return;
  addTrait(host,'kinslayer',Y); addTrait(host,'oathbreaker',Y); addTrait(host,'cruel',Y);
  host.prestige-=40;
  /* everyone who hears of it hates the host, and remembers */
  for(const p2 of POLS){
    if(!p2.alive||p2===hp) continue;
    if(tdist(p2.capitalTile,hp.capitalTile)>60) continue;
    setRelation(p2,hp,-55,'guest-right was broken at '+(host.site>=0?SITES[host.site].name:'the feast'),Y,0.985);
    const rr=C(p2.ruler);
    if(rr&&alive(rr)){ opine(rr,host,-70,'broke guest-right',Y);
      rr.grudge.push({c:host.id,d:host.dyn,w:50,y:Y,why:'the murder of guests under his own roof'}); }
  }
  chron(Y,5,'wedding',
    `${listify(dead.map(v=>CHL(v)))} ${dead.length>1?'are':'is'} murdered at the wedding feast of ${CHL(a)} and ${CHL(b)}. `+
    `${CHL(host)} had the doors barred. Guest-right is a small thing to some men, and a very large thing to everyone else.`,
    {chars:[host.id].concat(dead.map(v=>v.id)),pols:[hp.id,gp.id]});
}

/* what a ruler does with a quiet year */
function rulerActs(ch,Y,r){
  const p=P(ch.titles[0]); if(!p||!p.alive||p.ruler!==ch.id) return;
  const cap=SITES[p.capital]; if(!cap||!cap.alive) return;
  const c=CULTURES[p.culture];
  const spend=Math.min(p.treasury*0.45, 1600);
  if(spend<25) return;
  const opts=[];
  /* the king builds in his own seat first, then in the next-greatest hold */
  const holds=p.sites.map(x=>SITES[x]).filter(x=>x&&x.alive).sort((a,b)=>b.pop-a.pop).slice(0,3);
  const target = pickW(r,holds,x=>x===cap? 3:1) || cap;
  if(target.walls<5&&c.techs.has('masonry')) opts.push(['walls', 60+target.walls*80, 1.0+(p.wars.length?1.6:0)]);
  if(target.market<4) opts.push(['market', 70+target.market*100, 0.9+c.vals.mercantile]);
  if(target.temple<4) opts.push(['temple', 60+target.temple*90, 0.7+c.vals.piety*1.4+ch.sk.pie*0.05]);
  if(target.univ<3&&c.techs.has('university')) opts.push(['univ', 240, 0.5+c.vals.literacy*2]);
  if(!opts.length) return;
  const o=pickW(r,opts,x=>x[2]);
  if(spend<o[1]) return;
  p.treasury-=o[1];
  target[o[0]]++;
  const nm={walls:'the walls',market:'the market square',temple:'the great temple',univ:'a house of learning'}[o[0]];
  chron(Y, target.tier>=3?3:2,'build',`${CHL(ch)} raises ${nm} of ${SL(target)}.`,{chars:[ch.id],sites:[target.id]});
  if(o[0]==='temple'&&p.faith>=0) FAITHS[p.faith].followers+=target.pop*0.02;
  if(o[0]==='univ') c.vals.literacy=clamp(c.vals.literacy+0.05,0,1);
  ch.prestige+=14;
}

/* --------------------------------------------------------- landed houses    */
/* Every hold of any size has a lord sitting in it. These are the men and women
   who make up a realm's politics: they marry each other, hate each other,
   lead its armies, and revolt when the crown leans too hard.                  */
function foundHolder(s,Y,r){
  if(LIVING.size>9000) return null;
  const cult=CULTURES[s.culture];
  const p=P(s.polity);
  const rl=p&&C(p.ruler);
  const ch=newChar(r,cult,s.faith,Y-ri(r,22,44),null,null);
  let dyn=null;
  if(rl&&rl.dyn>=0&&chance(r,0.45)){
    dyn=DYNS[rl.dyn];                     /* a cadet branch of the ruling house */
    ch.dyn=dyn.id; dyn.members.push(ch.id); dyn.living++;
    ch.claims.push({pol:p.id,str:0.30,since:Y,why:'a cadet of the house'});
  }else{
    dyn=newDynasty(SEEDV,r,ch.id,cult,s.name);
    ch.dyn=dyn.id; dyn.members.push(ch.id); dyn.living++;
    dyn.born=Y; dyn.seat=s.id;
  }
  ch.prestige=ri(r,5,45)+s.tier*12;
  ch.site=s.id; ch.court=s.id;
  ch.gold=ri(r,5,60);
  if(rl) ch.liege=rl.id;
  s.holder=ch.id;
  /* a household, so the line does not die out in a single fever */
  if(chance(r,0.82)){
    const sp2=newChar(r,cult,s.faith,Y-ri(r,20,40),null,null, ch.sex==='m'?'f':'m');
    sp2.site=s.id; sp2.court=s.id;
    marryPair(ch,sp2,Y,r);
    for(let q=0;q<ri(r,0,3);q++){
      const kid=birth(ch.sex==='f'?ch:sp2, ch.sex==='m'?ch:sp2, Y-ri(r,1,20), r,false);
      kid.site=s.id; kid.court=s.id;
    }
  }
  return ch;
}
function siteSuccession(s,Y,r){
  const old=C(s.holder);
  if(old&&alive(old)) return;
  const cult=CULTURES[s.culture];
  if(old){
    const heirs=old.kids.map(C).filter(c=>c&&alive(c)&&!c.bastard);
    heirs.sort((a,b)=> cult.succ==='ultimogeniture'? b.born-a.born : a.born-b.born);
    if(heirs.length){
      const h=heirs[0];
      s.holder=h.id; h.site=s.id; h.court=s.id;
      h.prestige+=8;
      if(s.tier>=3) chron(Y,2,'inherit',`${CHL(h)} inherits the seat of ${SL(s)}.`,
        {chars:[h.id],sites:[s.id]});
      /* siblings resent the one who got the hall */
      for(let k=1;k<heirs.length&&k<4;k++) opine(heirs[k],h,-14,'took our father’s seat',Y);
      return;
    }
    if(old.dyn>=0){
      const d=DYNS[old.dyn];
      const kin=d.members.map(C).filter(c=>c&&alive(c)&&c.site===s.id);
      if(kin.length){ s.holder=kin[0].id; return; }
    }
  }
  const nu=foundHolder(s,Y,r);
  if(nu&&s.tier>=3)
    chron(Y,3,'newhouse',`With no heir left in ${SL(s)}, ${CHL(nu)} of ${DL(DYNS[nu.dyn])} takes the hall.`,
      {chars:[nu.id],sites:[s.id],dyns:[nu.dyn]});
}
function nobilityTick(Y,r){
  for(const s of SITES){
    if(!s.alive) continue;
    if((s.id+Y)%3!==0) continue;
    if(s.tier<1&&s.holder<0) continue;
    const h=C(s.holder);
    if(!h||!alive(h)) siteSuccession(s,Y,r);
  }
}

/* --------------------------------------------------------------- revolt     */
function revolt(s,Y,r){
  const p=P(s.polity); if(!p) return;
  const cult=CULTURES[s.culture];
  const held=C(s.holder);
  let leader=null, how='';
  if(held&&alive(held)&&chance(r,0.62)){
    leader=held; addTrait(leader,'ambitious',Y); how='its own lord';
  }else{
    leader=newChar(r,cult,s.faith,Y-ri(r,24,44),null,null);
    leader.prestige=ri(r,10,60);
    addTrait(leader,'ambitious',Y);
    const dyn=newDynasty(SEEDV,r,leader.id,cult,s.name);
    leader.dyn=dyn.id; dyn.members.push(leader.id); dyn.living++; dyn.born=Y;
    how=pick(r,['a smith','a captain of the watch','a hedge knight','a priest',
      'a miller’s son','a disinherited cousin','a former thrall','a tax collector who changed sides']);
  }
  const np=newPolity(SEEDV,r,s,leader,Y);
  np.legit=0.25;
  chron(Y,5,'revolt',
    `${SL(s)} rises. ${CHL(leader)}, ${how}, is raised on shields against ${PL(p)}.`,
    {sites:[s.id],pols:[p.id,np.id],chars:[leader.id]});
  s.unrest=0.3;
  const cb={k:'independence',str:0.8,why:'they will not be ruled from '+SITES[p.capital].name,tgt:p.id};
  declareWar(np,p,cb,Y,r,'Rising of '+s.name);
}

/* --------------------------------------------------------------- plague     */
let PLAGUE=null;
function plagueTick(Y,r){
  if(!PLAGUE){
    let dens=0;
    for(const s of SITES) if(s.alive&&s.tier>=2) dens+=s.pop;
    const p0=clamp(dens/45000000,0,1)*0.030;
    if(chance(r,p0)){
      const big=SITES.filter(s=>s.alive&&s.tier>=2);
      if(big.length){
        const start=pickW(r,big,s=>s.pop*(s.isPort?2:1));
        const lang=LANGS[CULTURES[start.culture].lang];
        const nm=lang.compose([pick(r,['death','plague','shadow','tear','bone'])]);
        PLAGUE={name:nm.t+' Pest', start:Y, sites:new Set([start.id]), dead:0, virulence:rf(r,0.10,0.34)};
        chron(Y,5,'plague',`A sickness takes hold in ${SL(start)}. They are calling it the ${PLAGUE.name}.`,
          {sites:[start.id]});
      }
    }
    return;
  }
  const next=new Set(PLAGUE.sites);
  let dead=0;
  for(const sid of PLAGUE.sites){
    const s=SITES[sid]; if(!s||!s.alive) continue;
    const kill=s.pop*PLAGUE.virulence*rf(r,0.5,1.3)*(1+ (s.tier>=3?0.3:0) - techEffect(CULTURES[s.culture],'health'));
    const k=Math.min(s.pop*0.72,Math.max(0,kill));
    const f=1-k/Math.max(1,s.pop);
    for(let q=0;q<NCLASS;q++) s.cls[q]*=f;
    s.pop*=f; dead+=k;
    s.unrest+=0.12;
    for(const l of s.links){
      const o=SITES[l.to];
      if(o&&o.alive&&!next.has(o.id)&&chance(r, clamp(0.10+l.traffic*0.004,0,0.55))) next.add(o.id);
    }
    /* the highborn die too */
    for(const id of LIVING){
      const ch=CHARS[id];
      if(ch&&ch.site===sid&&chance(r,PLAGUE.virulence*0.5)){
        killChar(ch,Y,'of the '+PLAGUE.name,null);
        if(ch.titles.length){ for(const tid of ch.titles.slice()){ const p=P(tid); if(p&&p.alive&&p.ruler===ch.id) succeed(p,Y,r); } }
      }
    }
  }
  PLAGUE.sites=next; PLAGUE.dead+=dead;
  if(dead>0&&(Y-PLAGUE.start)%2===0)
    chron(Y,4,'plague',`The ${PLAGUE.name} is in ${plural(next.size,'town')}. ${commify(PLAGUE.dead)} dead so far.`,{});
  if(Y-PLAGUE.start>ri(r,4,12)||dead<40){
    chron(Y,5,'plague',`The ${PLAGUE.name} burns out after ${plural(Y-PLAGUE.start,'year')}. ${commify(PLAGUE.dead)} are dead. `+
      `Wages rise; lords complain.`,{});
    /* labour scarcity: a real economic aftershock */
    for(const sid of PLAGUE.sites){ const s=SITES[sid]; if(s&&s.alive){ s.wealth*=1.2; s.unrest=clamp(s.unrest-0.2,0,1.6); } }
    PLAGUE=null;
  }
}

/* --------------------------------------------------------------- frontier   */
function settleFrontier(Y,r){
  if(SITES.filter(s=>s.alive).length>720) return;
  const parents=SITES.filter(s=>s.alive&&s.pop>1800);
  if(!parents.length) return;
  const n=Math.min(7,1+((parents.length/18)|0));
  for(let q=0;q<n;q++){
    const par=pickW(r,parents,s=>s.pop);
    let best=-1,bv=0.55;
    const px=par.tile%W, py=(par.tile/W)|0;
    for(let a=0;a<320;a++){
      const y=clamp(py+ri(r,-18,18),1,H-2), i=wrapx(px+ri(r,-24,24))+y*W;
      if(!T.land[i]||T.site[i]>=0||T.dom[i]===par.id&&tdist(i,par.tile)<5) continue;
      let v=siteSuitability(i);
      const sp=SPECIES[CULTURES[par.culture].species];
      if(sp.biomePref.indexOf(T.biome[i])>=0) v+=0.45;
      const nn=nearbySites(i,7);
      if(nn.length) v-=1.6*nn.length;
      if(T.ruin[i]>=0) v+=0.5;
      if(T.owner[i]>=0&&T.owner[i]!==par.polity) v-=1.2;
      if(v>bv){bv=v;best=i;}
    }
    if(best<0) continue;
    const s=newSite(SEEDV,r,best,CULTURES[par.culture],par.faith,Y,par.polity);
    claimHinterland(s);
    const p=P(par.polity);
    if(p&&p.alive) polityAdd(p,s);
    par.cls[CL_PEASANT]*=0.94; par.pop*=0.96;
    linkNewSite(s);
    /* did they build on old bones? */
    const ru=T.ruin[best]>=0? RUINS[T.ruin[best]] : null;
    if(ru&&!ru.looted){
      chron(Y,4,'refound',`Settlers out of ${SL(par)} raise a new hold at ${SL(s)}, among the stones of ${ru.name}.`,
        {sites:[s.id,par.id],tile:best});
      const holder=p&&C(p.ruler);
      delve(ru,holder,Y,r);
    }else{
      chron(Y,2,'found',`${SL(s)} is founded by folk out of ${SL(par)}.`,{sites:[s.id,par.id]});
    }
  }
}
function linkNewSite(s){
  const near=nearbySites(s.tile,32).filter(o=>o!==s&&o.alive);
  near.sort((a,b)=>tdist2(s.tile,a.tile)-tdist2(s.tile,b.tile));
  for(const o of near.slice(0,5)){
    if(s.links.some(l=>l.to===o.id)) continue;
    const rt=routeCost(s.tile,o.tile);
    if(!rt) continue;
    s.links.push({to:o.id,cost:rt.cost,sea:rt.sea,road:0,traffic:0,path:rt.path});
    o.links.push({to:s.id,cost:rt.cost,sea:rt.sea,road:0,traffic:0,path:rt.path.slice().reverse()});
  }
}

/* --------------------------------------------------------------- migration  */
function migration(Y,r){
  const donors=SITES.filter(s=>s.alive&&(s.unrest>0.7||s.starving>0||s.devast>0.4)&&s.pop>400);
  for(const s of donors){
    if(!chance(r,0.35)) continue;
    const opts=[];
    for(const l of s.links){
      const o=SITES[l.to];
      if(!o||!o.alive) continue;
      const pull=(o.baseFood*30-o.pop*0.010) - o.unrest*300 - l.cost*4 - o.devast*400;
      if(pull>0) opts.push([o,pull]);
    }
    if(!opts.length) continue;
    const dst=pickW(r,opts,x=>x[1])[0];
    const move=Math.min(s.pop*rf(r,0.02,0.09), 4000);
    const f=move/s.pop;
    for(let k=0;k<NCLASS;k++){ const v=s.cls[k]*f; s.cls[k]-=v; dst.cls[k]+=v; }
    s.pop-=move; dst.pop+=move;
    if(move>1400) chron(Y,3,'migrate',
      `${commify(move)} leave ${SL(s)} for ${SL(dst)}, driven out by ${s.starving?'hunger':(s.devast>0.4?'ruin':'their own lords')}.`,
      {sites:[s.id,dst.id]});
    /* migrants carry their culture with them */
    if(dst.culture!==s.culture&&move>dst.pop*0.28&&chance(r,0.3)) dst.culture=s.culture;
  }
}

/* --------------------------------------------------------------- culture    */
function cultureSplit(Y,r){
  if(CULTURES.length>46) return;
  for(const c of CULTURES.slice()){
    const mine=SITES.filter(s=>s.alive&&s.culture===c.id);
    if(mine.length<5) continue;
    /* find a cluster far from the heartland and under foreign rule */
    const far=mine.filter(s=>tdist(s.tile,c.home)>36 || (P(s.polity)&&P(s.polity).culture!==c.id));
    if(far.length<2) continue;
    if(!chance(r,0.16)) continue;
    const seedS=pickW(r,far,s=>tdist(s.tile,c.home));
    const group=far.filter(s=>tdist(s.tile,seedS.tile)<26);
    if(group.length<2) continue;
    const lang=new Language(LANGS.length,SEEDV+Y,LANGS[c.lang]);
    LANGS.push(lang);
    const nc=newCulture(SEEDV,r,SPECIES[c.species],lang,seedS.tile,c);
    nc.born=Y; nc.faith=c.faith;
    for(const k of c.techs) nc.techs.add(k);
    for(const s of group){ s.culture=nc.id; for(const t of s.hinter) T.cult[t]=nc.id; }
    chron(Y,4,'split',
      `Cut off from ${CL2(c)} by distance and other lords, the folk of ${listify(group.slice(0,3).map(s=>SL(s)))} `+
      `no longer call themselves by the old name. They are the ${CL2(nc)} now, and their speech has drifted with them.`,
      {cults:[c.id,nc.id],sites:group.map(s=>s.id)});
  }
}
function contactDiffusion(r,Y){
  for(const s of SITES){
    if(!s.alive||!s.links.length) continue;
    const a=CULTURES[s.culture];
    const l=pick(r,s.links);
    const o=SITES[l.to];
    if(!o||!o.alive||o.culture===s.culture) continue;
    techDiffuse(a,CULTURES[o.culture],r,Y);
  }
}

/* --------------------------------------------------------------- religion   */
function religionTick(Y,r){
  for(const f of FAITHS) f.followers=0;
  for(const s of SITES) if(s.alive&&s.faith>=0) FAITHS[s.faith].followers+=s.pop;
  for(const s of SITES){
    if(!s.alive||!s.links.length) continue;
    const f=FAITHS[s.faith]; if(!f) continue;
    const l=pick(r,s.links);
    const o=SITES[l.to];
    if(!o||!o.alive||o.faith===s.faith) continue;
    const of_=FAITHS[o.faith];
    const pressure = of_.prosel*(0.5+of_.followers/Math.max(1,f.followers+of_.followers))
                   - CULTURES[s.culture].vals.tradition*0.4
                   + (P(s.polity)&&P(s.polity).faith===o.faith? 0.5:0);
    if(pressure>0.55&&chance(r,clamp(pressure*0.10,0,0.25))){
      const old=s.faith;
      s.faith=o.faith;
      for(const t of s.hinter) T.faith[t]=o.faith;
      if(s.tier>=2) chron(Y,3,'convert',`${SL(s)} turns from ${FL(FAITHS[old])} to ${FL(of_)}.`,
        {sites:[s.id],faiths:[old,o.faith]});
    }
  }
  /* schism: distance and difference make new gods out of old ones */
  for(const f of FAITHS.slice()){
    if(FAITHS.length>34) break;
    const mine=SITES.filter(s=>s.alive&&s.faith===f.id);
    if(mine.length<6) continue;
    const cults=new Set(mine.map(s=>s.culture));
    if(cults.size<2) continue;
    if(!chance(r,0.05+f.prosel*0.03)) continue;
    const seedS=pick(r,mine);
    const group=mine.filter(s=>tdist(s.tile,seedS.tile)<24);
    if(group.length<3) continue;
    const cult=CULTURES[seedS.culture];
    const nf=newFaith(SEEDV,r,cult,seedS.tile,f);
    nf.born=Y; f.heresies++;
    /* a heresy always disagrees about something specific */
    const doc=pick(r,[
      'that the dead must be burned, not buried',
      'that the priesthood may not hold land',
      'that images of the gods are a blasphemy',
      'that the gods are one god wearing masks',
      'that the last god is not a god at all',
      'that the world was made in error and must be endured',
      'that oaths sworn to unbelievers do not bind',
      'that the blood of kings is no holier than any other blood'
    ]);
    nf.doctrine.push(doc);
    nf.name = pick(r,['the ','the Reformed ','the Old ','the True '])+nf.native+' Creed';
    for(const s of group){ s.faith=nf.id; for(const t of s.hinter) T.faith[t]=nf.id; }
    nf.holy=f.holy.slice(0,1);
    chron(Y,5,'schism',
      `A schism: the congregations of ${listify(group.slice(0,3).map(s=>SL(s)))} break from ${FL(f)}, holding ${doc}. `+
      `They are called ${FL(nf)}.`,
      {faiths:[f.id,nf.id],sites:group.map(s=>s.id)});
  }
}

/* --------------------------------------------------------------- myth       */
function mythTick(Y,r){
  /* smiths and mages make things when the power is still in the world */
  if(MAGIC>0.08&&chance(r, 0.10*MAGIC)){
    const cands=[];
    for(const s of SITES) if(s.alive&&(s.rescnt&&(s.rescnt[R_STARMETAL]>0||s.rescnt[R_IRON]>0.6))&&T.ley[s.tile]>0.6) cands.push(s);
    if(cands.length){
      const s=pick(r,cands);
      const p=P(s.polity); const rl=p&&C(p.ruler);
      const it=forgeArtifact(r,Y,rl,s,false);
      if(rl) giveArtifact(it,rl,Y,'forged for '+rl.name);
      chron(Y,4,'forge',
        `In ${SL(s)}, where the ground still hums, ${AL(it)} is made of ${it.mat}. They say ${it.desc}.`,
        {sites:[s.id],arts:[it.id],chars:rl?[rl.id]:[]});
    }
  }
  /* someone always goes down into the dark */
  const unlooted=RUINS.filter(x=>!x.looted);
  if(unlooted.length&&chance(r,0.10)){
    const ru=pick(r,unlooted);
    const near=nearbySites(ru.tile,22);
    if(near.length){
      const s=pick(r,near);
      const p=P(s.polity); const rl=p&&C(p.ruler);
      let who=rl;
      if(rl&&rl.kids.length&&chance(r,0.5)){ const k=C(pick(r,rl.kids)); if(k&&alive(k)) who=k; }
      if(who&&chance(r,0.6)){
        const found=delve(ru,who,Y,r);
        if(!found||!found.length){
          if(chance(r,0.35))
            chron(Y,3,'delve',`${CHL(who)} opens ${RL(ru)} and finds only water, bats and a great deal of dust.`,
              {chars:[who.id],tile:ru.tile});
        }
        if(chance(r,0.18)){
          killChar(who,Y,'in the deep places beneath '+ru.name,null);
          chron(Y,4,'delvedeath',`${CHL(who)} did not come back up out of ${RL(ru)}.`,{chars:[who.id],tile:ru.tile});
          for(const tid of who.titles.slice()){ const p2=P(tid); if(p2&&p2.alive&&p2.ruler===who.id) succeed(p2,Y,r); }
        }
      }
    }
  }
  /* artifacts change hands in war and in the night */
  for(const it of ARTS){
    if(it.destroyed||it.holder<0) continue;
    const h=C(it.holder);
    if(!h||!alive(h)) { continue; }
    if(chance(r,0.004)){
      it.holder=-1; it.lost=true;
      const k=h.arts.indexOf(it.id); if(k>=0) h.arts.splice(k,1);
      it.chain.push({y:Y,what:'stolen from '+h.name,who:h.id,where:h.site>=0?SITES[h.site].tile:-1});
      chron(Y,4,'theft',`${AL(it)} is gone from the hall of ${CHL(h)}. No one saw anything.`,
        {chars:[h.id],arts:[it.id]});
    }
  }
}

/* --------------------------------------------------------------- stats      */
function recomputeStats(){
  let pop=0,sites=0;
  for(const s of SITES) if(s.alive){ pop+=s.pop; sites++; }
  STAT.pop=pop; STAT.sites=sites;
  STAT.pols=POLS.filter(p=>p.alive).length;
  STAT.chars=LIVING.size;
  STAT.wars=WARS.filter(w=>w.ended<0).length;
  STAT.arts=ARTS.filter(a=>!a.destroyed).length;
  STAT.dyns=DYNS.filter(d=>!d.extinct).length;
}
