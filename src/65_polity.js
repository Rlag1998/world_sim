/* ============================================================================
   PART VII — CROWNS, VASSALS AND THE LAW OF SUCCESSION
   A realm is a pyramid of oaths. Every oath has a price, and every heir has
   a rival who can count.
   ========================================================================== */

let POLS=[];
const TIERN2=['Chiefdom','Lordship','Principality','Kingdom','Empire'];
const TIERADJ=['petty','minor','great','royal','imperial'];

function polityTierByPop(p){
  let pop=0; for(const sid of p.sites) pop+=SITES[sid].pop;
  const v=p.vassals.length;
  if(pop>2200000||v>=14) return 4;
  if(pop>620000||v>=8) return 3;
  if(pop>170000||v>=4) return 2;
  if(pop>40000||v>=1) return 1;
  return 0;
}

function newPolity(seed,r,site,ruler,year){
  const cult=CULTURES[site.culture];
  const lang=LANGS[cult.lang];
  const nm = chance(r,0.55)
     ? {t:site.name, g:'of '+site.name}
     : lang.unique(sampleK(r,tileConcepts(site.tile).concat(['realm','land']),2),{});
  const p={
    id:POLS.length, name:nm.t, gloss:nm.g, native:nm.t,
    capital:site.id, ruler: ruler? ruler.id : -1, dyn: ruler? ruler.dyn : -1,
    culture:site.culture, faith:site.faith,
    sites:[], liege:-1, vassals:[], tier:0,
    treasury: 60, legit: 0.62, central: rf(r,0.25,0.65), autonomy:0.4,
    rel:new Map(), truce:new Map(), wars:[], claims:[], armies:[],
    manpower:0, mpMax:0, prestige:0, stability:0.6, marriages:0,
    born:year, ended:-1, alive:true, capitalTile:site.tile,
    color: hsl(hashStr('pol'+POLS.length+nm.t,seed)/4294967296, 0.52, 0.55),
    warExhaust:0, lastWar:-999, rulerSince:year, rulers:[], levyPool:0,
    integrity:1, cores:new Set(), history:[]
  };
  POLS.push(p);
  polityAdd(p,site);
  if(ruler){ ruler.titles.push(p.id); ruler.court=site.id; ruler.site=site.id; }
  return p;
}
function P(id){ return id>=0&&id<POLS.length? POLS[id] : null; }
function polityAdd(p,s){
  if(s.polity===p.id) return;
  if(s.polity>=0){
    const o=POLS[s.polity];
    if(o){ const k=o.sites.indexOf(s.id); if(k>=0) o.sites.splice(k,1); }
  }
  s.polity=p.id; p.sites.push(s.id);
  p.cores.add(s.id);
  for(const t of s.hinter) T.owner[t]=p.id;
  T.owner[s.tile]=p.id;
}
function polityPop(p){
  if(p._py===YEAR) return p._pv;
  let v=0; for(const sid of p.sites){ const s=SITES[sid]; if(s) v+=s.pop; }
  p._py=YEAR; p._pv=v; return v;
}
/* Strength is asked for many times a year by many callers; compute it once. */
function polityStr(p,depth){
  depth=depth||0;
  if(p._sy===YEAR) return p._sv;
  if(depth>8) return 0;
  let v=0;
  for(const sid of p.sites){ const s=SITES[sid]; if(s) v+=s.manpower*(1-0.5*s.devast); }
  for(const vid of p.vassals){ const q=POLS[vid]; if(q&&q.alive) v+=polityStr(q,depth+1)*contractLevy(q); }
  p._sy=YEAR; p._sv=v; return v;
}
function contractLevy(p){
  const l=POLS[p.liege];
  if(!l) return 1;
  const base=0.5+0.35*l.central;
  const op = opinionVassal(p);
  return clamp(base*(0.5+0.5*clamp((op+60)/120,0,1)),0.05,0.95);
}
function opinionVassal(p){
  const l=POLS[p.liege]; if(!l) return 0;
  const a=C(p.ruler), b=C(l.ruler);
  if(!a||!b) return 0;
  let v=opinion(a,b,YEAR);
  v -= l.central*40;
  v += (l.legit-0.5)*30;
  if(p.culture!==l.culture) v-=14;
  if(p.faith!==l.faith) v-=20;
  return v;
}
function polityLord(p){ return C(p.ruler); }
function realmOf(p){ let q=p, n=0; while(q.liege>=0&&n++<12){ const l=POLS[q.liege]; if(!l||!l.alive) break; q=l; } return q; }
function allVassals(p,out,depth){
  out=out||[]; depth=depth||0;
  if(depth>8||out.length>400) return out;
  for(const v of p.vassals){ const q=POLS[v]; if(q&&q.alive&&out.indexOf(q)<0){ out.push(q); allVassals(q,out,depth+1); } }
  return out;
}

/* --------------------------------------------------------------- relations  */
function setRelation(a,b,dv,why,year,decay){
  if(!a||!b||a===b) return;
  let e=a.rel.get(b.id);
  if(!e){ e={v:0,m:[]}; a.rel.set(b.id,e); }
  e.m.push({t:why,v:dv,y:year,d:decay===undefined?0.94:decay});
  if(e.m.length>8) e.m.shift();
  let e2=b.rel.get(a.id);
  if(!e2){ e2={v:0,m:[]}; b.rel.set(a.id,e2); }
  e2.m.push({t:why,v:dv,y:year,d:decay===undefined?0.94:decay});
  if(e2.m.length>8) e2.m.shift();
}
function relation(a,b){
  if(!a||!b||a===b) return 100;
  let v=0;
  const e=a.rel.get(b.id);
  if(e) for(const m of e.m) v+=m.v;
  const ca=CULTURES[a.culture], cb=CULTURES[b.culture];
  v -= 30*cultureGap(ca,cb)*(0.3+ca.vals.xeno);
  if(a.faith!==b.faith&&a.faith>=0&&b.faith>=0){
    const fa=FAITHS[a.faith], fb=FAITHS[b.faith];
    v -= 40*faithGap(fa,fb)*(0.25+0.75*(1-fa.tolerance));
  } else v+=14;
  const ra=C(a.ruler), rb=C(b.ruler);
  if(ra&&rb) v += opinion(ra,rb,YEAR)*0.35;
  if(a.liege===b.id||b.liege===a.id) v+=25;
  return clamp(Math.round(v),-200,200);
}
function decayRelations(p){
  for(const [k,e] of p.rel){
    for(const m of e.m) m.v*=m.d;
    e.m=e.m.filter(m=>Math.abs(m.v)>0.7);
    if(!e.m.length) p.rel.delete(k);
  }
  for(const [k,y] of p.truce) if(y<YEAR) p.truce.delete(k);
}
function hasTruce(a,b){ const y=a.truce.get(b.id); return y!==undefined&&y>=YEAR; }

/* --------------------------------------------------------------- naming     */
function polityTitle(p){
  const t=p.tier;
  if(p.liege>=0) return (t>=3?'the Grand Duchy of ':'the Lordship of ')+p.name;
  return 'the '+TIERN2[t]+' of '+p.name;
}
function polityShort(p){ return p.name; }

/* --------------------------------------------------------------- succession */
function heirsOf(p,year){
  const rl=C(p.ruler);
  if(!rl) return [];
  const cult=CULTURES[p.culture];
  const law=cult.succ, glaw=cult.gender;
  const okSex=(ch)=>{
    if(glaw==='agnatic') return ch.sex==='m';
    if(glaw==='enatic')  return ch.sex==='f';
    return true;
  };
  const sexRank=(ch)=>{
    if(glaw==='agnatic-cognatic') return ch.sex==='m'?0:1;
    if(glaw==='enatic-cognatic')  return ch.sex==='f'?0:1;
    return 0;
  };
  let pool=[];
  const kids=rl.kids.map(C).filter(c=>c&&alive(c)&&!c.bastard&&okSex(c));
  if(law==='primogeniture'||law==='partible'||law==='appointment'){
    pool=kids.slice().sort((a,b)=> sexRank(a)-sexRank(b) || a.born-b.born);
  }else if(law==='ultimogeniture'){
    pool=kids.slice().sort((a,b)=> sexRank(a)-sexRank(b) || b.born-a.born);
  }else if(law==='seniority'){
    const d=rl.dyn>=0?DYNS[rl.dyn]:null;
    pool=(d? d.members.map(C):[]).filter(c=>c&&alive(c)&&okSex(c)&&c.id!==rl.id)
        .sort((a,b)=> sexRank(a)-sexRank(b) || a.born-b.born);
  }else if(law==='tanistry'){
    const d=rl.dyn>=0?DYNS[rl.dyn]:null;
    pool=(d? d.members.map(C):[]).filter(c=>c&&alive(c)&&okSex(c)&&c.id!==rl.id&&ageOf(c,year)>=14)
        .sort((a,b)=> (b.sk.mar+b.sk.dip+b.prestige/40)-(a.sk.mar+a.sk.dip+a.prestige/40));
  }else if(law==='elective'){
    const cands=[];
    for(const vid of p.vassals){ const q=POLS[vid]; const c=q&&C(q.ruler); if(c&&alive(c)&&okSex(c)) cands.push(c); }
    for(const k of kids) cands.push(k);
    const votes=new Map();
    const voters=p.vassals.map(v=>POLS[v]).filter(q=>q&&q.alive).map(q=>C(q.ruler)).filter(alive);
    for(const c of cands) votes.set(c.id,c.prestige/50+c.sk.dip*0.2);
    for(const v of voters){
      let best=null,bv=-1e9;
      for(const c of cands){ const o=opinion(v,c,year)+(v.dyn===c.dyn?25:0); if(o>bv){bv=o;best=c;} }
      if(best) votes.set(best.id,(votes.get(best.id)||0)+1);
    }
    pool=cands.sort((a,b)=>(votes.get(b.id)||0)-(votes.get(a.id)||0));
  }
  if(!pool.length){
    /* the line fails: look to siblings, then to the wider dynasty */
    const d=rl.dyn>=0?DYNS[rl.dyn]:null;
    if(d) pool=d.members.map(C).filter(c=>c&&alive(c)&&c.id!==rl.id&&okSex(c))
                .sort((a,b)=>a.born-b.born);
  }
  if(!pool.length&&rl.kids.length){
    pool=rl.kids.map(C).filter(c=>c&&alive(c)).sort((a,b)=>a.born-b.born);
  }
  return pool;
}

function succeed(p,year,r){
  const old=C(p.ruler);
  const cult=CULTURES[p.culture];
  const pool=heirsOf(p,year);
  if(old) p.rulers.push({id:old.id,from:p.rulerSince,to:year});
  if(old&&!alive(old)) p.ruler=-1;
  if(!pool.length){
    /* extinction: the strongest vassal or neighbour takes the throne */
    return interregnum(p,year,r);
  }
  const heir=pool[0];
  /* partible inheritance shatters realms */
  if(cult.succ==='partible'&&pool.length>1&&p.sites.length>=3&&p.liege<0){
    partition(p,pool,year,r);
    return;
  }
  crown(p,heir,year,r,old);
  /* disappointed claimants keep a claim, and some will press it */
  for(let k=1;k<pool.length&&k<4;k++){
    const c=pool[k];
    const str=clamp(0.85-0.16*k + (c.sk.dip+c.sk.mar)/90,0.2,0.95);
    c.claims.push({pol:p.id,str,since:year,why:'passed over in the succession'});
    if(chance(r,0.30+0.30*traitSum(c,'amb'))){
      chron(year,4,'claim',
        `${CHL(c)} disputes the succession in ${PL(p)}, naming ${CHL(heir)} a usurper.`,
        {chars:[c.id,heir.id],pols:[p.id]});
    }
  }
}
function crown(p,heir,year,r,old){
  if(!heir||!alive(heir)) return false;
  p.ruler=heir.id; p.dyn=heir.dyn; p.rulerSince=year;
  if(heir.titles.indexOf(p.id)<0) heir.titles.push(p.id);
  heir.court=p.capital; heir.site=p.capital;
  if(heir.dyn>=0) DYNS[heir.dyn].kings++;
  /* regnal number, counted once and remembered */
  if(!p.nameCount) p.nameCount=Object.create(null);
  p.nameCount[heir.name]=(p.nameCount[heir.name]||0)+1;
  heir.regnal=p.nameCount[heir.name];
  /* legitimacy */
  const legitimate = old? (heir.fa===old.id||heir.mo===old.id) : true;
  p.legit=clamp((legitimate?0.72:0.44)+ (heir.prestige/900) - (heir.bastard?0.18:0),0.05,1);
  if(heir.bastard) p.legit-=0.08;
  chron(year, p.tier>=3?4:(p.tier>=2?3:2),'crown',
    `${CHL(heir)} ${p.tier>=3?'is crowned':'takes the seat'} in ${PL(p)}${old? ', following the death of '+CHL(old):''}.`,
    {chars:[heir.id],pols:[p.id]});
  if(p.rulers.length>240) p.rulers.splice(0,120);
  /* vassals reassess */
  for(const vid of p.vassals){
    const q=POLS[vid]; if(!q||!q.alive) continue;
    const vr=C(q.ruler); if(!vr||!alive(vr)) continue;
    opine(vr,heir,-8+Math.round(heir.sk.dip*1.2)-Math.round(traitSum(heir,'cruel')*20),'a new liege',year);
  }
  return true;
}
function partition(p,pool,year,r){
  const heirs=pool.slice(0,Math.min(4,pool.length));
  const shares=[]; for(let k=0;k<heirs.length;k++) shares.push([]);
  const sites=p.sites.slice().sort((a,b)=>SITES[b].pop-SITES[a].pop);
  sites.forEach((sid,k)=>shares[k%heirs.length].push(sid));
  crown(p,heirs[0],year,r,null);
  const lost=[];
  for(let k=1;k<heirs.length;k++){
    if(!shares[k].length) continue;
    const cap=SITES[shares[k][0]];
    const np=newPolity(SEEDV,r,cap,heirs[k],year);
    for(const sid of shares[k]) polityAdd(np,SITES[sid]);
    np.legit=0.55; np.culture=p.culture; np.faith=p.faith;
    lost.push(np);
    setRelation(p,np,-25,'the realm was divided between us',year);
    /* brothers inherit each other's claims */
    heirs[k].claims.push({pol:p.id,str:0.7,since:year,why:'a brother’s portion'});
    heirs[0].claims.push({pol:np.id,str:0.7,since:year,why:'a brother’s portion'});
  }
  p.sites=p.sites.filter(sid=>SITES[sid].polity===p.id);
  chron(year,5,'partition',
    `On the death of its lord, ${PL(p)} is divided among ${plural(heirs.length,'heir')}. `+
    (lost.length? listify(lost.map(x=>PL(x)))+' are severed from it.' : ''),
    {pols:[p.id].concat(lost.map(x=>x.id)),chars:heirs.map(h=>h.id)});
}
function interregnum(p,year,r){
  const d=p.dyn>=0?DYNS[p.dyn]:null;
  if(d&&d.living<=0&&!d.extinct){
    d.extinct=true; d.ended=year;
    chron(year,5,'extinct',`The line of ${DL(d)} is ended. No heir of the blood remains.`,{dyns:[d.id]});
  }
  /* a vassal or a neighbouring lord seizes the vacant seat */
  const cands=[], seen=new Set();
  const add=c=>{ if(c&&alive(c)&&c.id!==p.ruler&&!seen.has(c.id)){ seen.add(c.id); cands.push(c); } };
  for(const vid of p.vassals){ const q=POLS[vid]; if(q&&q.alive) add(C(q.ruler)); }
  if(!cands.length){
    for(const s of nearbySites(p.capitalTile,26)){
      const q=P(s.polity);
      if(q&&q.alive&&q!==p) add(C(q.ruler));
    }
  }
  if(!cands.length){ dissolvePolity(p,year,'no heir, no claimant'); return; }
  const winner=cands.sort((a,b)=>(b.prestige+b.sk.mar*20)-(a.prestige+a.sk.mar*20))[0];
  p.ruler=-1;
  if(!crown(p,winner,year,r,null)){ dissolvePolity(p,year,'no heir, no claimant'); return; }
  p.legit=0.30;
  chron(year,4,'seize',`With the old line extinguished, ${CHL(winner)} seizes ${PL(p)}.`,
    {chars:[winner.id],pols:[p.id]});
}
function dissolvePolity(p,year,why){
  if(!p.alive) return;
  p.alive=false; p.ended=year;
  for(const sid of p.sites){ const s=SITES[sid]; if(s.polity===p.id) s.polity=-1; }
  for(const vid of p.vassals){ const q=POLS[vid]; if(q) q.liege=-1; }
  if(p.liege>=0){ const l=POLS[p.liege]; if(l){ const k=l.vassals.indexOf(p.id); if(k>=0) l.vassals.splice(k,1); } }
  p.vassals=[];
  chron(year,4,'fall',`${PL(p)} ceases to be. (${why})`,{pols:[p.id]});
}

/* --------------------------------------------------------------- vassalage  */
function vassalize(p,l,year,forced){
  if(p===l||p.liege===l.id) return;
  if(realmOf(l)===p) return;
  if(p.liege>=0){ const o=POLS[p.liege]; if(o){ const k=o.vassals.indexOf(p.id); if(k>=0) o.vassals.splice(k,1); } }
  p.liege=l.id; l.vassals.push(p.id);
  const a=C(p.ruler), b=C(l.ruler);
  if(a&&b) opine(a,b, forced? -30 : 12, forced?'forced my knee':'I swore freely', year);
  setRelation(p,l,forced?-20:20,forced?'submission at the sword-point':'sworn fealty',year);
  chron(year,3,'oath',`${PL(p)} ${forced?'is brought under':'swears fealty to'} ${PL(l)}.`,{pols:[p.id,l.id]});
}
function independence(p,year,why){
  if(p.liege<0) return;
  const l=POLS[p.liege];
  if(l){ const k=l.vassals.indexOf(p.id); if(k>=0) l.vassals.splice(k,1); setRelation(p,l,-60,'we broke our oath',year); }
  p.liege=-1;
  chron(year,4,'free',`${PL(p)} throws off the yoke of ${l?PL(l):'its liege'}. (${why})`,{pols:[p.id,l?l.id:-1]});
}

/* --------------------------------------------------------------- factions   */
function factionCheck(p,year,r){
  if(!p.vassals.length) return;
  const rl=C(p.ruler); if(!rl) return;
  const angry=[];
  let total=0, angryStr=0;
  for(const vid of p.vassals){
    const q=POLS[vid]; if(!q||!q.alive) continue;
    const st=polityStr(q); total+=st;
    const op=opinionVassal(q);
    if(op<-28) { angry.push({q,op,st}); angryStr+=st; }
  }
  total+=polityStr(p)*0.4;
  if(!angry.length||total<=0) return;
  const share=angryStr/total;
  if(share<0.34) return;
  const lead=angry.sort((a,b)=>b.st-a.st)[0].q;
  const leadR=C(lead.ruler);
  const kinds=[];
  if(p.central>0.4) kinds.push('lower_crown');
  if(CULTURES[p.culture].succ==='elective'||p.legit<0.45) kinds.push('depose');
  kinds.push('independence');
  const kind=pick(r,kinds);
  const power = share*(1+ (leadR? leadR.sk.dip/40:0));
  if(chance(r, clamp(0.10+power*0.35,0,0.6))){
    if(kind==='lower_crown'&&chance(r, clamp(0.35+p.legit*0.4,0,0.9))){
      p.central=clamp(p.central-0.12,0.05,1);
      chron(year,3,'faction',
        `${plural(angry.length,'lord')} of ${PL(p)} press their king; the crown's demands are eased.`,
        {pols:[p.id]});
      for(const a of angry){ const c=C(a.q.ruler); if(c&&rl) opine(c,rl,18,'the crown yielded',year); }
    }else{
      startCivilWar(p,angry.map(a=>a.q),kind,year,r);
    }
  }
}

/* --------------------------------------------------------------- plots      */
const PLOTS=[
  {k:'murder', n:'murder', skill:'int', base:0.10},
  {k:'imprison', n:'seizure', skill:'mar', base:0.12},
  {k:'forge',  n:'forged claim', skill:'lea', base:0.16},
  {k:'coup',   n:'usurpation', skill:'dip', base:0.07}
];
function plotTick(ch,year,r){
  if(!alive(ch)||ageOf(ch,year)<16) return;
  if(year-ch.lastPlot<4) return;
  const amb=traitSum(ch,'amb')+traitSum(ch,'plot')+(ch.sk.int-8)/24;
  if(amb<0.12) return;
  /* choose a target the character genuinely hates or covets */
  let target=null, kind=null, why='';
  const myPol = ch.titles.length? POLS[ch.titles[0]] : null;
  if(ch.claims.length&&chance(r,0.5)){
    const cl=pick(r,ch.claims); const tp=P(cl.pol);
    if(tp&&tp.alive&&tp.ruler>=0&&tp.ruler!==ch.id){ target=C(tp.ruler); kind='murder'; why='to clear my path to '+tp.name; }
  }
  if(!target&&ch.rel){
    let worst=null,wv=0;
    for(const [k,e] of ch.rel){ const o=C(k); if(o&&alive(o)&&e.v<wv){ wv=e.v; worst=o; } }
    if(worst&&wv<-45){ target=worst; kind=chance(r,0.6)?'murder':'imprison'; why='an old hatred'; }
  }
  if(!target&&myPol&&myPol.liege>=0&&chance(r,0.25)){
    const l=POLS[myPol.liege]; const lr=C(l.ruler);
    if(lr&&opinion(ch,lr,year)<-20){ target=lr; kind='coup'; why='my liege is unworthy'; }
  }
  if(!target&&chance(r,0.07)){ kind='forge'; }
  if(!kind) return;
  ch.lastPlot=year;
  if(kind==='forge'){
    /* fabricate a claim on a neighbour */
    const near=nearbySites(ch.site>=0?SITES[ch.site].tile:0,30);
    const cands=near.map(s=>P(s.polity)).filter(p=>p&&p.alive&&p.ruler!==ch.id);
    if(!cands.length) return;
    const tp=pick(r,cands);
    if(chance(r, clamp(0.08+ch.sk.lea*0.014,0,0.35))){
      ch.claims.push({pol:tp.id,str:0.45,since:year,why:'a document of doubtful provenance'});
      if(chance(r,0.4)) chron(year,3,'fabricate',
        `${CHL(ch)} produces a parchment naming ${CHL(ch)} rightful lord of ${PL(tp)}. Its ink is suspiciously fresh.`,
        {chars:[ch.id],pols:[tp.id]});
    }
    return;
  }
  if(!target||!alive(target)) return;
  /* recruit: anyone who also hates the target */
  const helpers=[];
  if(ch.rel) for(const [k,e] of ch.rel){
    const o=C(k); if(!o||!alive(o)) continue;
    if(e.v>20 && opinion(o,target,year)<-25 && helpers.length<3) helpers.push(o);
  }
  const P0=PLOTS.find(p=>p.k===kind);
  let odds=P0.base + ch.sk[P0.skill]*0.020 + helpers.length*0.055 - target.sk.int*0.014;
  odds += traitSum(ch,'plot')*0.15;
  if(traitHas(target,'paranoid')) odds-=0.07;
  odds=clamp(odds,0.02,0.62);
  if(!chance(r,odds*0.5)) return;                    /* the plot needs time */
  if(chance(r,odds)){
    if(kind==='murder'){
      const cause=pick(r,['poison at table','a knife in the dark','a fall from a tower stair',
        'a hunting accident that was no accident','a fever that came on too fast','a strangling in his sleep']);
      killChar(target,year,cause,ch.id);
      chron(year, target.titles.length?5:3,'murder',
        `${CHL(target)} is dead — ${cause}. ${helpers.length?'Whispers name ':'Whispers name '}${CHL(ch)}.`,
        {chars:[ch.id,target.id]});
      if(target.titles.length){ for(const tid of target.titles.slice()){ const tp=P(tid); if(tp&&tp.ruler===target.id) succeed(tp,year,r); } }
      if(chance(r,0.45)) addTrait(ch,'deceitful',year);
      /* discovery */
      if(chance(r,0.35)){
        for(const kid of target.kids){ const q=C(kid); if(q&&alive(q)){
          opine(q,ch,-90,'murdered my kin',year);
          q.grudge.push({c:ch.id,d:ch.dyn,w:55,y:year,why:'the murder of '+target.name});
        }}
      }
    }else if(kind==='imprison'){
      target.prison=ch.id;
      chron(year,3,'prison',`${CHL(ch)} takes ${CHL(target)} captive.`,{chars:[ch.id,target.id]});
      opine(target,ch,-70,'held me in chains',year);
    }else if(kind==='coup'){
      const tp=target.titles.length? P(target.titles[0]) : null;
      if(tp&&tp.alive){
        chron(year,5,'coup',`${CHL(ch)} seizes the seat of ${PL(tp)}; ${CHL(target)} is cast down.`,
          {chars:[ch.id,target.id],pols:[tp.id]});
        target.titles=target.titles.filter(t=>t!==tp.id);
        crown(tp,ch,year,r,target);
        tp.legit=0.28;
        addTrait(ch,'oathbreaker',year);
        target.claims.push({pol:tp.id,str:0.9,since:year,why:'I was cast down from this seat'});
      }
    }
  }else{
    /* caught */
    if(chance(r,0.55)){
      opine(target,ch,-80,'plotted against me',year);
      chron(year,3,'foiled',`A plot against ${CHL(target)} is uncovered. ${CHL(ch)} denies everything.`,
        {chars:[ch.id,target.id]});
      if(chance(r,0.3)&&target.titles.length){ ch.prison=target.id; }
    }
  }
}
