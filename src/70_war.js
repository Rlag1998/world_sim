/* ============================================================================
   PART VIII — THE SWORD
   Wars are declared for reasons the world produced. Armies eat, freeze,
   desert, and die at named places. Peace redraws the map and plants the
   next war's grievance.
   ========================================================================== */

let WARS=[], ARMIES=[], armySeq=0;

const CB=[
 {k:'claim',    n:'a pressed claim',        w:1.00, t:'War of the Claim'},
 {k:'succession',n:'a disputed succession', w:1.10, t:'War of Succession'},
 {k:'conquest', n:'naked conquest',         w:0.38, t:''},
 {k:'holy',     n:'holy war',               w:0.95, t:'Holy War'},
 {k:'liberate', n:'the liberation of kin',  w:0.85, t:'War of Liberation'},
 {k:'trade',    n:'the closing of the roads',w:0.55, t:'War of the Roads'},
 {k:'vengeance',n:'a blood debt',           w:0.80, t:'War of the Blood Debt'},
 {k:'tribute',  n:'a demand of tribute',    w:0.50, t:'Tribute War'},
 {k:'reconquest',n:'the recovery of lost lands',w:0.95, t:'War of Recovery'},
 {k:'independence',n:'independence',        w:1.00, t:'War of Independence'},
 {k:'depose',   n:'the deposition of a tyrant',w:1.00, t:'War of the Crown'},
 {k:'crown',    n:'the crown itself',       w:1.20, t:'War of the Crown'}
];
const CBI={}; CB.forEach(c=>CBI[c.k]=c);

function atWar(a,b){
  if(a<0||b<0||a===b) return false;
  const pa=P(a); if(!pa) return false;
  for(const wid of pa.wars){
    const w=WARS[wid]; if(!w||w.ended>=0) continue;
    if(sideOf(w,a)!==sideOf(w,b)&&sideOf(w,b)!==0) return true;
  }
  return false;
}
function sideOf(w,pid){
  if(w.atk.indexOf(pid)>=0) return 1;
  if(w.def.indexOf(pid)>=0) return -1;
  return 0;
}
function warName(w){
  const a=P(w.atk[0]), d=P(w.def[0]);
  return w.title;
}

/* ---------------------------------------------------------- casus belli     */
function findCB(a,b,year,r,blocked,lost){
  const out=[];
  const ra=C(a.ruler), rb=C(b.ruler);
  if(!ra||!rb) return out;
  /* pressed claim held by our ruler or close kin */
  for(const cl of ra.claims) if(cl.pol===b.id) out.push({k:'claim',str:cl.str,why:cl.why,tgt:b.id});
  for(const kid of ra.kids){ const c=C(kid); if(c&&alive(c))
    for(const cl of c.claims) if(cl.pol===b.id) out.push({k:'claim',str:cl.str*0.8,why:'my child’s claim',tgt:b.id}); }
  /* lost cores */
  if(lost===undefined){ lost=0; for(const sid of a.cores){ const s=SITES[sid]; if(s&&s.polity===b.id) lost++; } }
  if(lost) out.push({k:'reconquest',str:clamp(0.3+lost*0.16,0,1),why:plural(lost,'town')+' once ours',tgt:b.id});
  /* kin under a foreign yoke */
  let kin=0;
  for(const sid of b.sites) if(SITES[sid].culture===a.culture) kin++;
  if(kin>=2&&b.culture!==a.culture)
    out.push({k:'liberate',str:clamp(kin/Math.max(3,b.sites.length),0,1),why:plural(kin,'town')+' of our own blood under their lords',tgt:b.id});
  /* the faith */
  if(a.faith>=0&&b.faith>=0&&a.faith!==b.faith){
    const fa=FAITHS[a.faith];
    const gap=faithGap(fa,FAITHS[b.faith]);
    let holySites=0;
    for(const t of fa.holy) if(T.owner[t]===b.id) holySites++;
    const s=gap*fa.militancy + holySites*0.35;
    if(s>0.45) out.push({k:'holy',str:clamp(s,0,1.2),
      why: holySites? plural(holySites,'holy place')+' in unbelieving hands' : 'their gods are false',tgt:b.id});
  }
  /* blood debts */
  for(const g of ra.grudge) if(rb.dyn>=0&&g.d===rb.dyn)
    out.push({k:'vengeance',str:clamp(g.w/60,0,1),why:g.why,tgt:b.id});
  /* the roads */
  if(blocked===undefined){ blocked=0;
    for(const sid of a.sites){ const s=SITES[sid]; if(!s) continue;
      for(const l of s.links){ const o=SITES[l.to]; if(o&&o.polity===b.id&&l.traffic>30) blocked++; } } }
  if(blocked>2&&relation(a,b)<-20)
    out.push({k:'trade',str:clamp(blocked/12,0,0.7),why:'they choke our trade',tgt:b.id});
  /* raw hunger for land */
  if(!out.length){
    const sa=polityStr(a), sb=polityStr(b);
    if(sa>sb*2.0 && relation(a,b)<-5 && a.legit>0.45)
      out.push({k:'conquest',str:0.4,
        why:pick(r,['they are weak and we are not','the border has always been an argument',
                    'their lords have no friends left','a king must be seen to take something']),
        tgt:b.id});
  }
  return out;
}

/* ------------------------------------------------------------- declaration  */
function considerWar(a,year,r){
  if(!a.alive||a.liege>=0) return;
  if(year-a.lastWar<7) return;
  if(a.warExhaust>0.55) return;
  const rl=C(a.ruler); if(!rl) return;
  if(a.wars.filter(w=>WARS[w]&&WARS[w].ended<0).length>=(a.sites.length>7?2:1)) return;
  /* neighbours only */
  const seen=new Set();
  const cands=[];
  for(const sid of a.sites){
    const s=SITES[sid];
    for(const l of s.links){
      const o=SITES[l.to]; const q=P(o.polity);
      if(q&&q.alive&&q!==a&&!seen.has(q.id)&&realmOf(q)!==realmOf(a)){ seen.add(q.id); cands.push(q); }
    }
  }
  if(!cands.length) return;
  let best=null,bv=0,bcb=null;
  const aggr = 0.5 + traitSum(rl,'aggr') + CULTURES[a.culture].vals.martial*0.6
             + (a.legit<0.45?0.25:0) - (a.treasury<0?0.3:0);
  /* one pass over our own holdings answers "who blocks our roads" for everyone */
  const blockedBy=new Map(), lostTo=new Map();
  for(const sid of a.sites){ const s=SITES[sid]; if(!s) continue;
    for(const l of s.links){ const o=SITES[l.to];
      if(o&&o.polity>=0&&o.polity!==a.id&&l.traffic>30)
        blockedBy.set(o.polity,(blockedBy.get(o.polity)||0)+1); } }
  for(const sid of a.cores){ const s=SITES[sid];
    if(s&&s.polity>=0&&s.polity!==a.id) lostTo.set(s.polity,(lostTo.get(s.polity)||0)+1); }
  const sa=polityStr(a)+alliedStrength(a);
  const myPop=Math.max(1,polityPop(a));
  for(const b of cands){
    if(hasTruce(a,b)) continue;
    const rb=realmOf(b);
    const cbs=findCB(a,b,year,r,blockedBy.get(b.id)||0,lostTo.get(b.id)||0);
    if(!cbs.length) continue;
    const cb=cbs.sort((x,y)=>(y.str*CBI[y.k].w)-(x.str*CBI[x.k].w))[0];
    const sb=polityStr(rb)+alliedStrength(rb);
    if(sb<=0) continue;
    const ratio=sa/(sb+1);
    const prize = polityPop(rb)/myPop;
    const dist = tdist(a.capitalTile,b.capitalTile)/40;
    let v = (ratio-0.95)*1.5 + cb.str*CBI[cb.k].w*1.35 + prize*0.35 - dist*0.5
          - a.warExhaust*1.2 + (relation(a,rb)<-40?0.5:0);
    v *= aggr;
    if(v>bv){ bv=v; best=rb; bcb=cb; }
  }
  if(best&&bv>1.05&&chance(r,clamp(bv*0.075,0.01,0.30))) declareWar(a,best,bcb,year,r);
}
function alliedStrength(p){
  let v=0;
  for(const [k,e] of p.rel){
    const q=P(k);
    if(q&&q.alive&&q.ally===p.id) v+=polityStr(q)*0.5;
  }
  return v;
}

function declareWar(a,b,cb,year,r,forceTitle){
  const lang=LANGS[CULTURES[a.culture].lang];
  const w={
    id:WARS.length, atk:[a.id], def:[b.id], cb:cb.k, why:cb.why,
    start:year, ended:-1, score:0, battles:[], sieges:[], occ:[],
    title: forceTitle || warTitle(a,b,cb,year),
    atkCasualties:0, defCasualties:0, sacked:[], target:cb.tgt
  };
  WARS.push(w);
  a.wars.push(w.id); b.wars.push(w.id);
  a.lastWar=year; b.lastWar=year;
  setRelation(a,b,-70,'they made war upon us',year,0.97);
  /* allies are called; refusing costs honour */
  callAllies(w,a,1,year,r); callAllies(w,b,-1,year,r);
  /* vassals fight for their liege */
  for(const q of allVassals(a)) if(w.atk.indexOf(q.id)<0){ w.atk.push(q.id); q.wars.push(w.id); }
  for(const q of allVassals(b)) if(w.def.indexOf(q.id)<0){ w.def.push(q.id); q.wars.push(w.id); }
  chron(year,5,'war',
    `${PL(a)} declares war upon ${PL(b)} — ${CBI[cb.k].n}: ${cb.why}. The ${cap(w.title)} begins.`,
    {pols:[a.id,b.id],wars:[w.id]});
  raiseArmies(a,w,year,r); raiseArmies(b,w,year,r);
}
function warTitle(a,b,cb,year){
  const r=stream(year*104729+a.id*31+b.id,'wartitle');
  const t=CBI[cb.k].t;
  const forms=[
    ()=>'War of '+a.name+' and '+b.name,
    ()=>pick(r,['Great','Long','Bitter','Winter','Summer','Iron','Bloody','Second','Third','Cold','Red'])+' War of '+b.name,
    ()=>'War for '+b.name,
    ()=>t? t+' of '+b.name : 'War of '+a.name+' and '+b.name,
    ()=>t? t+' of '+b.name : 'War for '+b.name
  ];
  return pick(r,forms)().replace(/^the /i,'');
}
function callAllies(w,p,side,year,r){
  for(const [k,e] of p.rel){
    const q=P(k);
    if(!q||!q.alive||q.ally!==p.id) continue;
    const rq=C(q.ruler);
    const willing = relation(q,p)*0.01 + (rq? (traitHas(rq,'honest')?0.25:0)-(traitHas(rq,'craven')?0.3:0):0)
                  - q.warExhaust*0.8 + 0.3;
    if(chance(r,clamp(willing,0.05,0.92))){
      (side>0? w.atk : w.def).push(q.id); q.wars.push(w.id);
      chron(year,3,'ally',`${PL(q)} answers the call and joins the ${cap(w.title)}.`,{pols:[q.id,p.id],wars:[w.id]});
      raiseArmies(q,w,year,r);
    }else{
      setRelation(q,p,-45,'refused the call to arms',year);
      q.ally=-1; p.ally = p.ally===q.id? -1 : p.ally;
      if(rq) addTrait(rq,'oathbreaker',year);
      chron(year,3,'refuse',`${PL(q)} refuses the call of ${PL(p)}. The alliance is broken.`,{pols:[q.id,p.id]});
    }
  }
}

/* ------------------------------------------------------------- armies       */
function polityManpower(p,depth){
  depth=depth||0;
  if(p._my===YEAR) return p._mv;
  if(depth>8) return 0;
  let mp=0;
  for(const sid of p.sites){ const s=SITES[sid]; if(s) mp+=s.manpower; }
  for(const vid of p.vassals){ const q=P(vid); if(q&&q.alive) mp+=polityManpower(q,depth+1)*contractLevy(q); }
  p._my=YEAR; p._mv=mp; return mp;
}
function raiseArmies(p,w,year,r){
  const cap=polityManpower(p);
  const avail=Math.max(0,cap-p.levyPool);
  if(avail<45) return;
  const c=CULTURES[p.culture];
  const take=Math.min(avail, cap*rf(r,0.45,0.80));
  p.levyPool+=take;
  const n=clamp(Math.round(take/1800),1,4);
  const per=take/n;
  /* the best sword in the realm leads, if he is not the king himself */
  const pool=[];
  const rl=C(p.ruler); if(rl) pool.push(rl);
  for(const vid of p.vassals){ const q=P(vid); const cc=q&&C(q.ruler); if(cc&&alive(cc)) pool.push(cc); }
  if(rl) for(const kid of rl.kids){ const cc=C(kid); if(cc&&alive(cc)&&ageOf(cc,year)>=16) pool.push(cc); }
  for(const sid of p.sites){ const hd=C(SITES[sid].holder);
    if(hd&&alive(hd)&&ageOf(hd,year)>=16&&pool.indexOf(hd)<0) pool.push(hd); }
  pool.sort((a,b)=>b.sk.mar-a.sk.mar);
  for(let k=0;k<n;k++){
    const cmd=pool[k%Math.max(1,pool.length)]||null;
    const qual = 0.72 + techEffect(c,'mil') + c.vals.martial*0.30 + SPECIES[c.species].war*0.18
               + (p.treasury>200?0.10:0);
    const a={
      id:armySeq++, pol:p.id, war:w.id, tile:p.capitalTile,
      size:Math.round(per), max:Math.round(per), qual,
      morale:0.85, supply:1.0, cmd: cmd?cmd.id:-1,
      path:null, pi:0, dest:-1, destYear:year, siege:null, home:p.capitalTile,
      atSite:p.capital, prevSite:-1, hopTo:undefined, idle:0,
      side: sideOf(w,p.id), routed:0, naval:0
    };
    ARMIES.push(a);
  }
}
function disband(a){
  const p=P(a.pol);
  if(p){ p.levyPool=Math.max(0,p.levyPool-a.max*0.7); }
  const k=ARMIES.indexOf(a); if(k>=0) ARMIES.splice(k,1);
}

/* Pick the most valuable enemy holding this army can actually reach. */
function chooseTarget(a,year){
  const w=WARS[a.war]; if(!w||w.ended>=0) return null;
  const enemy = a.side>0? w.def : w.atk;
  let best=null,bv=-1e9;
  for(const pid of enemy){
    const q=P(pid); if(!q||!q.alive) continue;
    for(const sid of q.sites){
      const s=SITES[sid];
      if(!s.alive||s.occupied===a.pol) continue;
      if(s.siege && sideOf(w,s.siege.by)===a.side) continue;   /* already invested */
      if(s.occupied>=0 && sideOf(w,s.occupied)===a.side) continue;
      const d=tdist(a.tile,s.tile);
      if(d>80) continue;
      let v = s.pop/1000 + (s.id===q.capital?9:0) + (T.harbor[s.tile]>0.5?2:0) - d*0.42 - s.walls*1.4;
      if(w.target===q.id) v+=3;
      if(v>bv){bv=v;best=s;}
    }
  }
  return best;
}
/* Hosts march by road, hop by hop along the settlement graph. Nobody runs a
   fresh forty-thousand-tile pathfind every month. */
function nextHop(a,tgt){
  const here=SITES[a.atSite];
  if(!here||!here.links.length) return null;
  let best=null,bv=1e18;
  for(const l of here.links){
    const o=SITES[l.to];
    if(!o||!o.alive) continue;
    if(l.to===a.prevSite && here.links.length>1) continue;
    const v = l.cost*0.9 + tdist(o.tile,tgt.tile)*3.0;
    if(v<bv){ bv=v; best=l; }
  }
  return best;
}
function armyMove(a,year,r){
  const w=WARS[a.war];
  if(!w||w.ended>=0){ disband(a); return; }
  const p=P(a.pol);
  if(!p||!p.alive||a.size<40){ disband(a); return; }
  /* supply and attrition */
  const own = T.owner[a.tile]===a.pol || (P(T.owner[a.tile])&&sideOf(w,T.owner[a.tile])===a.side);
  const forage = BIOME[T.biome[a.tile]].food + T.fert[a.tile]*0.5;
  const winter = T.temp[a.tile] - T.tvar[a.tile]*0.8;
  let attr = 0.008;
  if(!own) attr+=0.020;
  attr += Math.max(0,0.35-forage)*0.09;
  if(winter<-6) attr+=0.030;
  if(a.siege) attr+=0.012;
  attr *= (1 - clamp(techEffect(CULTURES[p.culture],'admin'),0,0.4));
  const loss=Math.round(a.size*attr);
  if(loss>0){ a.size-=loss; a.supply=clamp(a.supply-attr*1.5,0,1);
    if(a.side>0) w.atkCasualties+=loss; else w.defCasualties+=loss; }
  a.morale=clamp(a.morale + (own?0.02:0.005) - attr*2.2, 0.12, 1.25);
  if(a.size<a.max*0.45&&a.max-a.size>300&&chance(r,0.10)){
    chron(year,2,'attrition',`The host of ${PL(p)} melts away in the ${BIOME[T.biome[a.tile]].n.toLowerCase()} — ${commify(a.max-a.size)} gone to hunger and desertion.`,
      {pols:[p.id],wars:[w.id]});
    a.max=a.size;
  }
  if(a.size<40){ disband(a); return; }
  /* siege in progress? */
  if(a.siege!==null){ siegeStep(a,year,r); return; }

  /* choose (or keep) an objective */
  if(a.dest<0||!SITES[a.dest]||!SITES[a.dest].alive||
     (year-a.destYear>3) || SITES[a.dest].occupied===a.pol){
    const tgt=chooseTarget(a,year);
    if(!tgt){ a.path=null; a.dest=-1; return; }
    a.dest=tgt.id; a.destYear=year; a.path=null;
  }
  const tgt=SITES[a.dest];

  /* pick the next road leg when the current one is walked out */
  if(!a.path||a.pi>=a.path.length){
    if(a.atSite===a.dest){ arriveAt(a,tgt,year,r,w); return; }
    const hop=nextHop(a,tgt);
    if(!hop){ a.idle=(a.idle||0)+1; if(a.idle>6) disband(a); return; }
    a.idle=0;
    a.path=hop.path; a.pi=1; a.hopTo=hop.to;
  }
  /* march */
  let mp = (2.4 + techEffect(CULTURES[p.culture],'move')*3) * (a.routed>0? 1.5 : 1);
  if(a.routed>0) a.routed--;
  let guard=0;
  while(mp>0 && a.path && a.pi<a.path.length && guard++<64){
    const nxt=a.path[a.pi];
    const c=T.land[nxt]? T.cost[nxt]*(T.road[nxt]?0.5:1) : 1.6;
    if(c>mp && mp<2.4) break;
    mp-=c; a.tile=nxt; a.pi++;
    if(T.site[nxt]>=0){
      const s=SITES[T.site[nxt]];
      if(s&&s.alive){ const q=P(s.polity);
        if(q&&sideOf(w,q.id)===-a.side){ a.atSite=s.id; beginSiege(a,s,year,r); return; } }
    }
  }
  if(a.path && a.pi>=a.path.length){
    a.prevSite=a.atSite; a.atSite=a.hopTo!==undefined? a.hopTo : a.atSite;
    const here=SITES[a.atSite];
    if(here) a.tile=here.tile;
    a.path=null;
    if(here && a.atSite===a.dest) arriveAt(a,here,year,r,w);
  }
}
function arriveAt(a,s,year,r,w){
  if(!s||!s.alive) { a.dest=-1; return; }
  const q=P(s.polity);
  if(q&&sideOf(w,q.id)===-a.side) beginSiege(a,s,year,r);
  else a.dest=-1;
}

/* ------------------------------------------------------------- battle       */
function battlePower(a,defending,r){
  const p=P(a.pol); const c=CULTURES[p.culture];
  const cmd=C(a.cmd);
  let v=a.size*a.qual*(0.45+0.70*a.morale);
  if(cmd){
    v*= 1 + (cmd.sk.mar-8)*0.030
       + (traitHas(cmd,'brave')?0.06:0) - (traitHas(cmd,'craven')?0.10:0)
       + (traitHas(cmd,'shrewd')?0.05:0) - (traitHas(cmd,'dull')?0.05:0);
    if(cmd.arts.length) for(const aid of cmd.arts){ const it=ARTS[aid]; if(it&&it.eff==='mar') v*=1+it.pow*0.10; }
  }
  v *= 1 + techEffect(c,'mil');
  if(defending) v *= 1 + T.defen[a.tile]*0.60;
  v *= rf(r,0.78,1.28);
  return v;
}
/* All the hosts that meet on one field fight one battle, not several. */
function fieldBattle(tile,A,B,year,r){
  const w=WARS[A[0].war]; if(!w) return;
  const def = T.owner[tile]===B[0].pol;
  let va=0, vb=0;
  for(const x of A) va+=battlePower(x,!def,r);
  for(const x of B) vb+=battlePower(x,def,r);
  const winS = va>vb? A : B, loseS = va>vb? B : A;
  const ratio = Math.max(va,vb)/Math.max(1,Math.min(va,vb));
  const lossL = clamp(0.16+0.13*Math.min(3,ratio-1),0.10,0.55);
  const lossW = clamp(0.11/Math.max(1,ratio-0.2),0.020,0.16);
  let dL=0,dW=0;
  for(const x of loseS){ const d=Math.round(x.size*lossL); x.size-=d; dL+=d;
    x.morale=clamp(x.morale-0.35,0.10,1.2); x.routed=2; }
  for(const x of winS){ const d=Math.round(x.size*lossW); x.size-=d; dW+=d;
    x.morale=clamp(x.morale+0.16,0.1,1.3); }
  const cmdOf=list=>{ let best=null,bv=-1; for(const x of list){ const c=C(x.cmd);
    if(c&&alive(c)&&c.sk.mar>bv){bv=c.sk.mar;best=c;} } return best; };
  const cw=cmdOf(winS), cl=cmdOf(loseS);
  const place=placeName(tile);
  const winPol=winS[0].pol, losePol=loseS[0].pol;
  w.battles.push({year, tile, place, win:winPol, lose:losePol, dead:dL+dW,
                  cmdW:cw?cw.id:-1, cmdL:cl?cl.id:-1});
  if(w.battles.length>120) w.battles.splice(0,40);
  if(sideOf(w,winPol)>0){ w.score+=clamp((dL+dW)/900,0.5,7); w.defCasualties+=dL; w.atkCasualties+=dW; }
  else { w.score-=clamp((dL+dW)/900,0.5,7); w.atkCasualties+=dL; w.defCasualties+=dW; }
  if(cw){ cw.battles++; cw.wonBattles++; cw.prestige+=28+dL/40; }
  if(cl){ cl.battles++; cl.prestige-=12; }
  const dieP = 0.055 + (cl&&traitHas(cl,'brave')?0.05:0) + lossL*0.12;
  if(cl&&chance(r,dieP)){
    killChar(cl,year,'cut down at '+place,cw?cw.id:-1);
    for(const tid of cl.titles.slice()){ const tp=P(tid); if(tp&&tp.alive&&tp.ruler===cl.id) succeed(tp,year,r); }
  } else if(cl&&chance(r,0.10)&&cw){
    cl.prison=cw.id;
    chron(year,4,'capture',`${CHL(cl)} is taken alive at ${place}.`,{chars:[cl.id],wars:[w.id]});
  }
  if(cw&&chance(r,0.02)) killChar(cw,year,'a stray arrow at '+place,cl?cl.id:-1);
  if(cl&&chance(r,0.18)) addTrait(cl,'scarred',year);
  const hosts = (A.length+B.length)>2? ` ${plural(A.length+B.length,'host')} met on the field.` : '';
  chron(year,5,'battle',
    `${plural(dL+dW,'man','men')} fall at ${place}. ${PL(P(winPol))} breaks ${PL(P(losePol))}`+
    (cw? ' under '+CHL(cw):'')+'.'+hosts,
    {pols:[winPol,losePol],wars:[w.id],
     chars:[cw?cw.id:-1,cl?cl.id:-1].filter(x=>x>=0),tile});
  for(const x of loseS) if(x.size<40) disband(x);
  for(const x of winS) if(x.size<40) disband(x);
}
function fightBattle(a,b,year,r){
  const w=WARS[a.war]; if(!w) return;
  const pa=P(a.pol), pb=P(b.pol);
  const def = T.owner[a.tile]===b.pol;
  const va=battlePower(a,!def,r), vb=battlePower(b,def,r);
  const win = va>vb? a : b, lose = va>vb? b : a;
  const ratio = Math.max(va,vb)/Math.max(1,Math.min(va,vb));
  const lossL = clamp(0.16+0.13*Math.min(3,ratio-1),0.10,0.55);
  const lossW = clamp(0.11/Math.max(1,ratio-0.2),0.020,0.16);
  const dL=Math.round(lose.size*lossL), dW=Math.round(win.size*lossW);
  lose.size-=dL; win.size-=dW;
  lose.morale=clamp(lose.morale-0.35,0.10,1.2);
  win.morale=clamp(win.morale+0.16,0.1,1.3);
  lose.routed=2;
  const place=placeName(a.tile);
  const bt={year, tile:a.tile, place, win:win.pol, lose:lose.pol, dead:dL+dW, cmdW:win.cmd, cmdL:lose.cmd};
  w.battles.push(bt);
  if(sideOf(w,win.pol)>0) { w.score+= clamp((dL+dW)/900,0.5,7); w.defCasualties+=dL; }
  else { w.score-= clamp((dL+dW)/900,0.5,7); w.atkCasualties+=dL; }
  const cw=C(win.cmd), cl=C(lose.cmd);
  if(cw){ cw.battles++; cw.wonBattles++; cw.prestige+=28+dL/40; }
  if(cl){ cl.battles++; cl.prestige-=12; }
  /* lords die in battle */
  const dieP = 0.055 + (cl&&traitHas(cl,'brave')?0.05:0) + lossL*0.12;
  if(cl&&chance(r,dieP)){
    killChar(cl,year,'cut down at '+place,win.cmd);
    for(const tid of cl.titles.slice()){ const tp=P(tid); if(tp&&tp.ruler===cl.id) succeed(tp,year,r); }
  } else if(cl&&chance(r,0.10)){
    cl.prison=win.cmd;
    chron(year,4,'capture',`${CHL(cl)} is taken alive at ${place}.`,{chars:[cl.id],wars:[w.id]});
  }
  if(cw&&chance(r,0.02)) killChar(cw,year,'a stray arrow at '+place,lose.cmd);
  if(cl&&chance(r,0.18)) addTrait(cl,'scarred',year);
  chron(year,5,'battle',
    `${plural(dL+dW,'man','men')} fall at ${place}. ${PL(P(win.pol))} breaks ${PL(P(lose.pol))}`+
    (cw? ' under '+CHL(cw):'')+'.',
    {pols:[win.pol,lose.pol],wars:[w.id],chars:[cw?cw.id:-1,cl?cl.id:-1].filter(x=>x>=0),tile:a.tile});
  if(lose.size<40) disband(lose);
}
/* Battlefields get named the way real ones do: after the nearest thing that
   already had a name, in the tongue of whoever lives there. */
const PLACECACHE=new Map();
function placeName(i){
  const sid=T.site[i];
  if(sid>=0&&SITES[sid]) return SITES[sid].name;
  const hit=PLACECACHE.get(i); if(hit) return hit;
  const r=stream(i*7919+1,'place');
  let lang=null, near=null;
  const d=T.dom[i];
  if(d>=0&&SITES[d]) { near=SITES[d]; lang=LANGS[CULTURES[near.culture].lang]; }
  if(!lang){
    const ns=nearbySites(i,20);
    if(ns.length){ near=ns[0]; lang=LANGS[CULTURES[near.culture].lang]; }
  }
  if(!lang) lang=LANGS[(i>>3)%LANGS.length];
  const f=tileConcepts(i);
  const feat=pick(r,['Ford','Ridge','Moor','Crossing','Hollow','Downs','Marches','Wold','Field',
                     'Heath','Bridge','Gate','Stones','Barrows','Meadow','Pass','Mire','Reach']);
  let nm;
  if(near&&chance(r,0.45)){
    nm = feat+' of '+near.name;                    /* named for the nearest hold */
  }else{
    const c=lang.compose(sampleK(r,f.length?f:['stone'],1));
    nm = c.t+' '+feat;
  }
  PLACECACHE.set(i,nm);
  if(PLACECACHE.size>4000) PLACECACHE.clear();
  return nm;
}

/* ------------------------------------------------------------- siege        */
function beginSiege(a,s,year,r){
  const w0=WARS[a.war];
  if(s.siege){
    if(w0 && sideOf(w0,s.siege.by)===a.side){
      /* reinforce the host already before the walls, do not start a second camp */
      const other=ARMIES.find(x=>x.id===s.siege.army);
      if(other&&other.siege){ other.siege.prog+=0.06; }
      a.dest=-1; a.path=null; return;
    }
  }
  if(s.occupied>=0 && w0 && sideOf(w0,s.occupied)===a.side){ a.dest=-1; a.path=null; return; }
  a.siege={site:s.id, prog:0, stores: 12+s.walls*10+s.granary*0.02, start:year};
  s.siege={by:a.pol, army:a.id, since:year};
  chron(year, s.tier>=3?4:(s.tier>=2?3:2),'siege',`${PL(P(a.pol))} lays siege to ${SL(s)}.`,
    {pols:[a.pol,s.polity],sites:[s.id],wars:[a.war]});
}
function siegeStep(a,year,r){
  const s=SITES[a.siege.site];
  if(!s||!s.alive||s.polity<0){ a.siege=null; return; }
  const w=WARS[a.war];
  if(!w||w.ended>=0||sideOf(w,s.polity)!==-a.side){ if(s.siege&&s.siege.army===a.id) s.siege=null; a.siege=null; return; }
  const p=P(a.pol), c=CULTURES[p.culture];
  const siegeT=1+techEffect(c,'siege');
  const fortT=1+techEffect(CULTURES[s.culture],'fort');
  a.siege.stores-=1;
  const rate = (a.size/Math.max(300,s.pop*0.08+300))*siegeT/(1+s.walls*0.85*fortT);
  a.siege.prog += rate;
  s.unrest+=0.015; s.devast=clamp(s.devast+0.012,0,1);
  const cmd=C(a.cmd);
  const assaultWant = a.siege.prog>0.55 || (cmd&&traitHas(cmd,'wroth')) || a.supply<0.4;
  if(assaultWant&&chance(r,0.20)){
    /* storm the walls */
    const odds=clamp(0.22+a.siege.prog*0.45+siegeT*0.12-s.walls*0.10,0.05,0.90);
    const dead=Math.round(a.size*rf(r,0.06,0.20));
    a.size-=dead;
    if(w){ if(a.side>0) w.atkCasualties+=dead; else w.defCasualties+=dead; }
    if(chance(r,odds)){
      captureSite(a,s,year,r,true);
    }else{
      if(dead>240) chron(year, dead>1200?4:3,'assault',
        `The assault on ${SL(s)} is thrown back; ${plural(dead,'man','men')} lie beneath the walls.`,
        {sites:[s.id],pols:[a.pol],wars:[w.id]});
      a.morale=clamp(a.morale-0.18,0.1,1.2);
      a.siege.prog=Math.max(0,a.siege.prog-0.20);
    }
    return;
  }
  if(a.siege.stores<=0||a.siege.prog>=1){
    captureSite(a,s,year,r,false);
  }
}
function captureSite(a,s,year,r,stormed){
  const w=WARS[a.war], p=P(a.pol);
  if(s.occupied>=0 && w && sideOf(w,s.occupied)===a.side){ a.siege=null; a.dest=-1; return; }
  const old=P(s.polity);
  s.siege=null; a.siege=null;
  s.occupied=a.pol;
  if(w){ w.occ.push(s.id); w.score += sideOf(w,a.pol)>0? clamp(s.pop/2200,0.6,7) : -clamp(s.pop/2200,0.6,7); }
  const cmd=C(a.cmd);
  const cruel = cmd? traitSum(cmd,'cruel') : 0;
  let sackP = (stormed?0.40:0.09) + cruel*0.45 + CULTURES[p.culture].vals.cruelty*0.25
            + (old&&old.faith!==p.faith? 0.14:0);
  if(year-(s.lastSack||-99)<12) sackP*=0.15;      /* there is little left to take */
  if(chance(r,clamp(sackP,0,0.85))){
    sack(s,a,year,r,cmd);
  }else{
    chron(year, s.tier>=3?4:(s.tier>=2?3:2),'take',`${SL(s)} opens its gates to ${PL(p)}${cmd? ' and '+CHL(cmd):''}.`,
      {sites:[s.id],pols:[p.id],wars:[w?w.id:-1],chars:cmd?[cmd.id]:[]});
  }
  if(cmd){ cmd.prestige+=40+s.pop/300; cmd.conquests++; }
}
function sack(s,a,year,r,cmd){
  const p=P(a.pol);
  const killed=s.pop*rf(r,0.08,0.30);
  const scale=killed/Math.max(1,s.pop);
  for(let k=0;k<NCLASS;k++) s.cls[k]*=(1-scale);
  s.pop*= (1-scale);
  const loot=s.wealth*0.6 + s.pop*0.02;
  s.wealth*=0.3; s.granary*=0.15;
  if(p) p.treasury+=loot*0.5;
  if(cmd){ cmd.gold+=loot*0.2; cmd.prestige+=25;
    if(chance(r,0.35)) addTrait(cmd,'cruel',year); }
  s.devast=clamp(s.devast+rf(r,0.25,0.60),0,1);
  s.unrest=clamp(s.unrest+0.45,0,1.6);
  s.sacked++; s.lastSack=year;
  for(const t of s.hinter) T.dev[t]=clamp(T.dev[t]+0.30,0,1);
  /* the books burn */
  const cu=CULTURES[s.culture];
  if(s.univ&&chance(r,0.5)) cu.vals.literacy=clamp(cu.vals.literacy-0.10,0,1);
  const w0=WARS[a.war];
  if(w0){ if(sideOf(w0,a.pol)>0) w0.defCasualties+=killed; else w0.atkCasualties+=killed; }
  chron(year,5,'sack',
    `${SL(s)} is sacked${cmd? ' by '+CHL(cmd):''}. ${commify(killed)} dead; the ${s.tier>=3?'city':'town'} burns.`,
    {sites:[s.id],pols:[p?p.id:-1],chars:cmd?[cmd.id]:[],wars:[a.war]});
  if(WARS[a.war]) WARS[a.war].sacked.push(s.id);
  /* the dead lord's kin remember who held the torch */
  if(cmd){
    const old=P(s.polity); const or_=old&&C(old.ruler);
    if(or_){ or_.grudge.push({c:cmd.id,d:cmd.dyn,w:45,y:year,why:'the sack of '+s.name});
             opine(or_,cmd,-80,'burned my city',year); }
  }
  if(s.pop<180&&chance(r,0.5)) ruinSite(s,year,'put to the torch');
}

/* ------------------------------------------------------------- peace        */
function warTick(w,year,r){
  if(w.ended>=0) return;
  const dur=year-w.start;
  const A=w.atk.map(P).filter(p=>p&&p.alive), D=w.def.map(P).filter(p=>p&&p.alive);
  if(!A.length||!D.length){ endWar(w,year,A.length?1:-1,r); return; }
  for(const p of A.concat(D)) p.warExhaust=clamp(p.warExhaust+0.018,0,1.4);
  const exA=A.reduce((s,p)=>s+p.warExhaust,0)/A.length;
  const exD=D.reduce((s,p)=>s+p.warExhaust,0)/D.length;
  const armiesA=ARMIES.filter(x=>sideOf(w,x.pol)>0&&x.war===w.id).length;
  const armiesD=ARMIES.filter(x=>sideOf(w,x.pol)<0&&x.war===w.id).length;
  let done=false, victor=0;
  if(w.score>=12+dur*0.2){ done=true; victor=1; }
  else if(w.score<=-12-dur*0.2){ done=true; victor=-1; }
  else if(dur>3&&(!armiesA||!armiesD)&&chance(r,0.35)){ done=true; victor= w.score>0?1:(w.score<0?-1:0); }
  else if(exA>0.85&&exD>0.85&&chance(r,0.4)){ done=true; victor=0; }
  else if(dur>22&&chance(r,0.25)){ done=true; victor= w.score>2?1:(w.score<-2?-1:0); }
  if(done) endWar(w,year,victor,r);
}
const NUMWORD=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
  'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen','Twenty'];
function endWar(w,year,victor,r){
  w.ended=year; w.victor=victor;
  const yrs=year-w.start;
  if(yrs>=8&&!w.civil){
    w.title = (NUMWORD[yrs]? NUMWORD[yrs]+" Years' War" : yrs+" Years' War")+
              (w.def.length&&P(w.def[0])? ' of '+P(w.def[0]).name : '');
  }
  const A=w.atk.map(P).filter(p=>p&&p.alive), D=w.def.map(P).filter(p=>p&&p.alive);
  const win = victor>0? A : D, lose = victor>0? D : A;
  for(const a of ARMIES.slice()) if(a.war===w.id) disband(a);
  for(const sid of w.occ){ const s=SITES[sid]; if(s) { s.occupied=-1; s.siege=null; } }
  const wa=A[0], wd=D[0];
  if(victor===0){
    if(wa&&wd){
      wa.truce.set(wd.id,year+8); wd.truce.set(wa.id,year+8);
      setRelation(wa,wd,20,'a white peace',year);
    }
    const fell0=Math.round(w.atkCasualties+w.defCasualties);
    chron(year,4,'peace',`The ${cap(w.title)} ends without victory. `+
      (fell0>20? plural(fell0,'man','men')+' died for nothing.' : 'Both sides claim they were about to win.'),
      {pols:[wa?wa.id:-1,wd?wd.id:-1],wars:[w.id]});
  }else{
    const V=win[0], L=lose[0];
    if(!V||!L){ return; }
    let gained=[];
    /* territory actually held changes hands */
    const seenS=new Set();
    const held=w.occ.filter(id=>{ if(seenS.has(id)) return false; seenS.add(id); return true; })
      .map(id=>SITES[id]).filter(s=>s&&s.alive&&lose.some(p=>p.id===s.polity));
    held.sort((a,b)=>b.pop-a.pop);
    const take=Math.min(held.length, Math.max(1,Math.round(Math.abs(w.score)/6)));
    for(let k=0;k<take;k++){
      const s=held[k];
      polityAdd(V,s);
      gained.push(s);
    }
    const cbk=w.cb;
    const crushing = Math.abs(w.score)>18 && polityStr(V) > polityStr(L)*2.2;
    if(((cbk==='claim'||cbk==='succession'||cbk==='crown')&&Math.abs(w.score)>16&&L.sites.length)
       || (crushing && L.liege<0 && V.liege<0 && L.sites.length)){
      /* the throne itself is brought under another crown */
      vassalize(L,V,year,true);
      chron(year,5,'submit',`${PL(L)} bends the knee to ${PL(V)}.`,{pols:[L.id,V.id],wars:[w.id]});
    } else if(cbk==='independence'&&victor>0){
      independence(A[0],year,'won by the sword');
    } else if(cbk==='tribute'&&victor>0){
      L.tributary=V.id;
      V.treasury+=40;
    }
    const tribute=Math.min(L.treasury*0.5, 250);
    L.treasury-=tribute; V.treasury+=tribute;
    V.truce.set(L.id,year+10); L.truce.set(V.id,year+10);
    setRelation(V,L,-45,'they took our land at the peace table',year,0.98);
    const lr=C(L.ruler), vr=C(V.ruler);
    if(lr&&vr){
      lr.grudge.push({c:vr.id,d:vr.dyn,w:40,y:year,why:'the peace of '+year});
      opine(lr,vr,-60,'humbled me',year);
      lr.prestige-=60; vr.prestige+=90;
    }
    for(const p of lose) p.legit=clamp(p.legit-0.10,0.05,1);
    for(const p of win) p.legit=clamp(p.legit+0.05,0.05,1);
    const fell=Math.round(w.atkCasualties+w.defCasualties);
    chron(year,5,'peace',
      `The ${cap(w.title)} ends. ${PL(V)} is victorious`+
      (gained.length? '; '+listify(gained.map(s=>SL(s)))+' pass'+(gained.length>1?'':'es')+' to '+PL(V) : ', though nothing changes hands')+
      `. `+(fell>20? plural(fell,'man','men')+' died.' : 'It was decided by marching, not by fighting.'),
      {pols:[V.id,L.id],wars:[w.id],sites:gained.map(s=>s.id)});
  }
  for(const p of A.concat(D)){
    const k=p.wars.indexOf(w.id); if(k>=0) p.wars.splice(k,1);
    p.levyPool=0;
  }
}

/* ------------------------------------------------------------- civil war    */
function startCivilWar(p,rebels,kind,year,r){
  const lead=rebels[0];
  const w={
    id:WARS.length, atk:rebels.map(q=>q.id), def:[p.id],
    cb: kind==='independence'?'independence':'depose',
    why: kind==='independence'? 'they will not kneel' : 'the crown is unfit',
    start:year, ended:-1, score:0, battles:[], sieges:[], occ:[], sacked:[],
    title:pick(r,['Rising','Revolt','Rebellion','Broken Oath','Anarchy','Troubles'])+' of '+p.name,
    atkCasualties:0, defCasualties:0, civil:1, target:p.id
  };
  WARS.push(w);
  p.wars.push(w.id);
  for(const q of rebels){ q.wars.push(w.id); raiseArmies(q,w,year,r); }
  raiseArmies(p,w,year,r);
  chron(year,5,'civil',
    `${listify(rebels.slice(0,3).map(q=>PL(q)))}${rebels.length>3?' and others':''} rise against ${PL(p)}. The ${cap(w.title)} begins.`,
    {pols:[p.id].concat(rebels.map(q=>q.id)),wars:[w.id]});
  const rl=C(lead.ruler); if(rl) addTrait(rl,'oathbreaker',year);
}

/* ------------------------------------------------------------- alliances    */
function diplomacyTick(p,year,r){
  if(!p.alive||p.liege>=0) return;
  decayRelations(p);
  if(p.ally!==undefined&&p.ally>=0){ const q=P(p.ally); if(!q||!q.alive) p.ally=-1; }
  if((p.ally===undefined||p.ally<0)&&chance(r,0.10)){
    const cands=[];
    for(const [k,e] of p.rel){
      const q=P(k);
      if(q&&q.alive&&q.liege<0&&(q.ally===undefined||q.ally<0)&&relation(p,q)>45&&!atWar(p.id,q.id)) cands.push(q);
    }
    if(cands.length){
      const q=pick(r,cands);
      p.ally=q.id; q.ally=p.id;
      setRelation(p,q,25,'we are allies',year);
      chron(year,3,'alliance',`${PL(p)} and ${PL(q)} swear an alliance.`,{pols:[p.id,q.id]});
    }
  }
  /* a small realm beside a very great one often decides that oaths are cheaper
     than sieges */
  if(p.liege<0&&p.sites.length>=4&&chance(r,0.05)){
    const mine=polityStr(p);
    for(const sid of p.sites){
      const s=SITES[sid]; let done=false;
      for(const l of s.links){
        const o=SITES[l.to]; const q=o&&P(o.polity);
        if(!q||!q.alive||q===p||q.liege>=0) continue;
        if(realmOf(q)===p) continue;
        if(polityStr(q)<mine*0.28 && relation(p,q)>-20 && !atWar(p.id,q.id)
           && q.sites.length<=p.sites.length*0.5){
          vassalize(q,p,YEAR,false);
          chron(YEAR,4,'submit',
            `${PL(q)}, weighing the size of its neighbour, swears to ${PL(p)} rather than be taken.`,
            {pols:[q.id,p.id]});
          done=true; break;
        }
      }
      if(done) break;
    }
  }
  p.warExhaust=clamp(p.warExhaust-0.030,0,1.4);
}
