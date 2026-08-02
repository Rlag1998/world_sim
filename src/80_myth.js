/* ============================================================================
   PART IX — DEEP TIME
   Before the years were counted, the world was broken and remade. What the
   Elder Age left behind is still on the map: scars, leylines, ruins, and
   things that were made to last longer than the hands that made them.
   ========================================================================== */

let MAGIC=1.0, MAGIC0=1.0;
let POWERS=[], CATACLYSMS=[], ARTS=[], RUINS=[], PROPHS=[], LEGENDS=[];

const SCAR_NONE=0,SCAR_SUNDER=1,SCAR_DROWN=2,SCAR_BURN=3,SCAR_FREEZE=4,SCAR_BLIGHT=5,SCAR_GLASS=6;
const SCARN=['','the Sundering','the Drowning','the Burning','the Long Cold','the Blight','the Glassing'];

/* --------------------------------------------------------- the Elder Age    */
/* Phase one runs *inside* worldgen, before climate and rivers, because what
   the Powers did to the rock changes where the rain falls afterwards.        */
function elderShape(seed){
  const r=stream(seed,'elder');
  POWERS=[]; CATACLYSMS=[]; ARTS=[]; RUINS=[];
  MAGIC0 = rf(r,0.85,1.25); MAGIC=MAGIC0;
  /* the primordial powers seat themselves where the world burns brightest */
  const leyRank=[];
  for(let i=0;i<NT;i+=2) if(T.land[i]&&T.ley[i]>0.85) leyRank.push(i);
  leyRank.sort((a,b)=>T.ley[b]-T.ley[a]);
  const np=ri(r,3,6);
  for(let k=0;k<np;k++){
    const seat = leyRank.length? leyRank[Math.min(leyRank.length-1, k*7+ri(r,0,5))] : ri(r,0,NT-1);
    const lang=LANGS[k%LANGS.length];
    const dom=pick(r,DOMAINS);
    const nm=lang.unique(sampleK(r,dom.t,2),{});
    POWERS.push({
      id:k, name:nm.t, gloss:nm.g, domain:dom.k, dname:dom.n, seat,
      alignment: chance(r,0.42)? 'shadow':'light',
      fate:'', bound:false, epoch:-ri(r,900,4000)
    });
  }
  /* cataclysms — these actually rewrite the map */
  const nc=ri(r,2,4);
  const kinds=[SCAR_SUNDER,SCAR_DROWN,SCAR_BURN,SCAR_FREEZE,SCAR_BLIGHT,SCAR_GLASS];
  shuffle(r,kinds);
  for(let k=0;k<nc;k++){
    const kind=kinds[k%kinds.length];
    const centre = pickCataclysmCentre(r,kind);
    const rad = ri(r,9,26);
    applyCataclysm(kind,centre,rad,r);
    const who = POWERS.length? pick(r,POWERS) : null;
    const lang=LANGS[k%LANGS.length];
    const nm=lang.unique([pick(r,['fire','death','shadow','ice','war','storm','deep','fate'])],{});
    CATACLYSMS.push({
      id:k, kind, name: SCARN[kind]+' of '+nm.t, centre, rad,
      year: -ri(r,300,3600), by: who? who.id : -1,
      tale: cataclysmTale(kind, who, r)
    });
    MAGIC0 -= rf(r,0.02,0.08);
  }
  MAGIC=MAGIC0=clamp(MAGIC0,0.45,1.3);
}

/* Phase two needs the finished map: it places ruins and buries things in them. */
function elderLore(seed){
  const r=stream(seed,'elderlore');
  /* elder ruins: cities that fell before the reckoning of years */
  const nr=ri(r,10,22);
  for(let k=0;k<nr;k++){
    let best=-1,bv=-1;
    for(let a=0;a<200;a++){
      const i=ri(r,0,NT-1);
      if(!T.land[i]) continue;
      const v=T.ley[i]*1.6+siteSuitability(i)*0.5+(T.scar[i]?0.6:0)-nearRuin(i)*2;
      if(v>bv){bv=v;best=i;}
    }
    if(best<0) continue;
    const lang=LANGS[ri(r,0,LANGS.length-1)];
    const nm=nameSettlement(lang,best,r,3);
    const ru={
      id:RUINS.length, tile:best, name:nm.t, gloss:nm.g, elder:true,
      year:-ri(r,200,3800), why:pick(r,['thrown down in the wars of the Powers','abandoned when the wells of power failed',
        'drowned and raised again','forsaken, and none say why','burned by its own people','swallowed and spat out by the earth']),
      lostTech: chance(r,0.5)? pick(r,TECHS.filter(t=>t.era<=3)).k : null,
      buried:[], looted:false, site:-1
    };
    T.ruin[best]=ru.id;
    RUINS.push(ru);
  }
  /* the great works of the Elder Age */
  const na=ri(r,6,12);
  for(let k=0;k<na;k++){
    const it=forgeArtifact(r,-ri(r,200,3600),null,null,true);
    if(RUINS.length&&chance(r,0.7)){
      const ru=pick(r,RUINS);
      if(it.made>=ru.year){ it.made=ru.year-ri(r,60,900); it.chain[0].y=it.made; }
      ru.buried.push(it.id); it.buried=ru.tile; it.lost=true;
      it.chain.push({y:ru.year,what:'lost in the fall of '+ru.name,where:ru.tile});
    }
  }
}
function nearRuin(i){
  let n=0;
  for(const ru of RUINS) if(tdist(ru.tile,i)<14) n++;
  return n;
}
function pickCataclysmCentre(r,kind){
  let best=-1,bv=-1e9;
  for(let a=0;a<600;a++){
    const i=ri(r,0,NT-1);
    let v=T.ley[i]*2;
    if(kind===SCAR_DROWN) v += T.land[i]&&T.alt[i]<0.15? 2:-2;
    if(kind===SCAR_SUNDER) v += T.land[i]&&T.alt[i]>0.30? 2:-2;
    if(kind===SCAR_FREEZE) v += Math.abs(latOf((i/W)|0))>0.5? 1.5:-1;
    if(kind===SCAR_BURN||kind===SCAR_GLASS) v += T.land[i]?1:-3;
    if(kind===SCAR_BLIGHT) v += T.land[i]&&T.fert[i]>0.4? 2:-2;
    if(v>bv){bv=v;best=i;}
  }
  return best;
}
function applyCataclysm(kind,centre,rad,r){
  const cx=centre%W, cy=(centre/W)|0;
  for(let dy=-rad;dy<=rad;dy++){
    const y=cy+dy; if(y<0||y>=H) continue;
    for(let dx=-rad;dx<=rad;dx++){
      const d=Math.hypot(dx,dy); if(d>rad) continue;
      const i=wrapx(cx+dx)+y*W;
      const f=1-d/rad;
      const n=fbm(i%W,(i/W)|0,12345,3,8.0);
      if(f*n*1.6<0.20) continue;
      T.scar[i]=kind;
      switch(kind){
        case SCAR_SUNDER:
          T.elev[i] += (n>0.5? f*0.30 : -f*0.26);
          break;
        case SCAR_DROWN:
          T.elev[i] -= f*0.24;
          break;
        case SCAR_BURN:
          T.elev[i] += f*0.06*(n-0.4);
          break;
        case SCAR_FREEZE: break;
        case SCAR_BLIGHT: break;
        case SCAR_GLASS:
          T.elev[i] -= f*0.05;
          break;
      }
    }
  }
  /* re-derive land/alt after the earth moved */
  const top=1-SEA;
  for(let i=0;i<NT;i++){
    const e=T.elev[i];
    T.land[i]= e>SEA?1:0;
    T.alt[i] = e>SEA? (e-SEA)/top : -(SEA-e)/(SEA||1);
  }
}
function cataclysmTale(kind,who,r){
  const w = who? who.name : 'something without a name';
  switch(kind){
    case SCAR_SUNDER: return `${w} broke the land as a man breaks bread, and the halves have never sat true since.`;
    case SCAR_DROWN:  return `The sea was called in by ${w}, and it came, and it did not go out again.`;
    case SCAR_BURN:   return `${w} set fire to the air itself. The ash fell for a year.`;
    case SCAR_FREEZE: return `${w} put out the sun for three winters. Nothing that grew then grows now.`;
    case SCAR_BLIGHT: return `Where ${w} walked, the corn went black in the ear.`;
    case SCAR_GLASS:  return `${w} was answered with a light, and the sand ran like water and set as glass.`;
  }
  return 'It is not remembered.';
}

/* --------------------------------------------------------------- artifacts  */
const ART_KIND=[
 {k:'sword', n:'Sword',  eff:'mar', c:'blade'},
 {k:'spear', n:'Spear',  eff:'mar', c:'blade'},
 {k:'axe',   n:'Axe',    eff:'mar', c:'blade'},
 {k:'shield',n:'Shield', eff:'mar', c:'gear'},
 {k:'helm',  n:'Helm',   eff:'mar', c:'gear'},
 {k:'mail',  n:'Hauberk',eff:'mar', c:'gear'},
 {k:'crown', n:'Crown',  eff:'dip', c:'regalia'},
 {k:'ring',  n:'Ring',   eff:'int', c:'regalia'},
 {k:'sceptre',n:'Sceptre',eff:'ste',c:'regalia'},
 {k:'horn',  n:'Horn',   eff:'mar', c:'relic'},
 {k:'book',  n:'Book',   eff:'lea', c:'relic'},
 {k:'harp',  n:'Harp',   eff:'dip', c:'relic'},
 {k:'cup',   n:'Cup',    eff:'pie', c:'relic'},
 {k:'mask',  n:'Mask',   eff:'int', c:'relic'},
 {k:'banner',n:'Banner', eff:'mar', c:'regalia'},
 {k:'staff', n:'Staff',  eff:'lea', c:'relic'},
 {k:'mirror',n:'Mirror', eff:'lea', c:'relic'},
 {k:'key',   n:'Key',    eff:'int', c:'relic'}
];
const ART_MAT=['starmetal','black iron','elder silver','white gold','sea-ivory','heartwood',
 'dragonbone','obsidian','moonstone','red bronze','glass that will not break','stone from the sky'];
const ART_POWER=[
 {k:'mar',d:'its bearer does not tire in battle'},
 {k:'mar',d:'no blade turned against it has yet held'},
 {k:'dip',d:'men find they have agreed before they meant to'},
 {k:'int',d:'it is never found when searched for'},
 {k:'lea',d:'it answers questions that were not asked aloud'},
 {k:'ste',d:'the granaries of its holder are never quite empty'},
 {k:'pie',d:'the sick mend in its shadow'},
 {k:'mar',d:'it sounds and the enemy hears their own dead calling'},
 {k:'lea',d:'it shows a true thing, though seldom the wanted one'},
 {k:'int',d:'the face beneath it is forgotten by all who look'}
];
const ART_CURSE=[
 {d:'it will not be set down willingly', tr:'ambitious'},
 {d:'it takes a little of the bearer each year', tr:'sickly'},
 {d:'it whispers, and the whispering is patient', tr:'mad'},
 {d:'it hates the blood of the one who forged it', tr:'vengeful'},
 {d:'it makes every kindness look like a debt', tr:'paranoid'},
 {d:'it is hungry', tr:'twisted'}
];
function forgeArtifact(r,year,forger,site,elder){
  const kind=pick(r,ART_KIND);
  const langId = forger? CULTURES[forger.cult].lang : ri(r,0,LANGS.length-1);
  const lang=LANGS[langId];
  const nm=lang.unique(sampleK(r,['fire','iron','star','shadow','light','oath','blood','storm','ice',
    'death','fate','king','wolf','serpent','sun','moon','deep','song','word','bone','tear'],2),{});
  const pw=pick(r,ART_POWER);
  const mat=pick(r,ART_MAT);
  const cursed = elder? chance(r,0.32) : chance(r,0.12);
  const it={
    id:ARTS.length, name:nm.t, gloss:nm.g, kind:kind.k, kindn:kind.n,
    mat, made:year, elder:!!elder,
    forger: forger? forger.id : -1,
    forgeSite: site? site.id : -1, forgeTile: site? site.tile : (forger&&forger.site>=0?SITES[forger.site].tile:-1),
    eff: pw.k, pow: (elder? rf(r,0.6,1.4) : rf(r,0.25,0.9)) * (0.4+MAGIC),
    desc: pw.d,
    curse: cursed? pick(r,ART_CURSE) : null,
    holder:-1, site:-1, buried:-1, lost:false, destroyed:false,
    chain:[], renown: elder? ri(r,40,140) : ri(r,5,40)
  };
  it.chain.push({y:year, what: elder? 'forged in the Elder Age of '+mat
                                    : 'forged of '+mat+(forger? ' by '+forger.name:''),
                 who: forger?forger.id:-1, where: it.forgeTile});
  ARTS.push(it);
  return it;
}
function giveArtifact(it,ch,year,how){
  if(it.holder>=0){ const o=C(it.holder); if(o){ const k=o.arts.indexOf(it.id); if(k>=0) o.arts.splice(k,1); } }
  it.holder=ch?ch.id:-1; it.lost=!ch; it.buried=-1;
  if(ch){ ch.arts.push(it.id); ch.prestige+=it.renown*0.5;
    it.chain.push({y:year,what:how||'taken up',who:ch.id,where:ch.site>=0?SITES[ch.site].tile:-1});
    if(it.chain.length>40) it.chain.splice(1,1);
    if(it.curse&&chance(stream(year*31+it.id,'curse'),0.30)){
      if(addTrait(ch,it.curse.tr,year))
        chron(year,4,'curse',`${CHL(ch)} is changed by ${AL(it)}: ${it.curse.d}.`,{chars:[ch.id],arts:[it.id]});
    }
  }
}

/* --------------------------------------------------------------- ruins      */
function ruinSite(s,year,why){
  if(!s.alive) return;
  s.alive=false; s.ruinYear=year;
  const ru={
    id:RUINS.length, tile:s.tile, name:s.name, gloss:s.gloss, elder:false,
    year, why, lostTech:null, buried:[], looted:false, site:s.id
  };
  /* what the earth keeps */
  const c=CULTURES[s.culture];
  const advanced=[...c.techs].filter(k=>TECHS[TECHI[k]].era>=3);
  if(advanced.length&&chance(stream(year*13+s.id,'ruin'),0.4)) ru.lostTech=pick(stream(year*13+s.id,'ruin2'),advanced);
  T.ruin[s.tile]=ru.id;
  RUINS.push(ru);
  if(s.polity>=0){ const p=P(s.polity); if(p){ const k=p.sites.indexOf(s.id); if(k>=0) p.sites.splice(k,1);
    if(p.capital===s.id&&p.sites.length) { p.capital=p.sites[0]; p.capitalTile=SITES[p.capital].tile; }
    else if(!p.sites.length) dissolvePolity(p,year,'its last hold is a ruin'); } }
  for(const t of s.hinter){ if(T.dom[t]===s.id) T.dom[t]=-1; T.owner[t]=-1; }
  T.site[s.tile]=-1;
  chron(year,5,'ruin',`${s.name} is abandoned to the crows — ${why}. Its stones will outlast its name.`,
    {sites:[s.id],tile:s.tile});
}
function delve(ru,by,year,r){
  if(ru.looted) return null;
  ru.looted=true; ru.lootedBy=by?by.id:-1; ru.lootYear=year;
  const found=[];
  for(const aid of ru.buried){
    const it=ARTS[aid];
    if(!it||it.destroyed) continue;
    it.lost=false;
    giveArtifact(it,by,year,'brought up out of the ruins of '+ru.name);
    found.push(it);
  }
  if(ru.lostTech&&by){
    const c=CULTURES[by.cult];
    if(!c.techs.has(ru.lostTech)&&canLearn(c,TECHS[TECHI[ru.lostTech]])){
      c.techs.add(ru.lostTech);
      chron(year,4,'recover',`Digging in ${ru.name}, the ${CL2(c)} recover the lost art of ${TECHS[TECHI[ru.lostTech]].n}.`,
        {cults:[c.id]});
    }
  }
  if(found.length&&by)
    chron(year,5,'delve',
      `${CHL(by)} comes up out of ${ru.name} carrying ${listify(found.map(f=>AL(f)))}. It had lain there ${commify(year-ru.year)} years.`,
      {chars:[by.id],arts:found.map(f=>f.id),tile:ru.tile});
  return found;
}

/* --------------------------------------------------------------- prophecy   */
const PROPH_FORMS=[
 (a,b)=>`When ${a}, then ${b}.`,
 (a,b)=>`Not before ${a}: then, and not sooner, ${b}.`,
 (a,b)=>`${cap(b)} — but first, ${a}.`,
 (a,b)=>`They say ${a}. They do not say what comes after. What comes after is this: ${b}.`,
 (a,b)=>`Thrice the sign and thrice denied — ${a} — and then ${b}.`,
 (a,b)=>`Set it down: ${a}. Set this down beneath it: ${b}.`
];
/* An omen is a grammatical clause about something the world could actually do. */
function omen(r,lang){
  const f=[
    ()=>`${kenning(r,'winter')} comes twice in one turning`,
    ()=>`${kenning(r,'gold')} is counted twice and found short`,
    ()=>`${kenning(r,'sea')} gives back what it took`,
    ()=>`${kenning(r,'sun')} is thin three summers together`,
    ()=>`a ${lang.say('raven')} is crowned and no one laughs`,
    ()=>`the ${lang.say('wolf')} lies down in the hall of the ${lang.say('lion')}`,
    ()=>`an exile is made a ${lang.say('king')}`,
    ()=>`the ${lang.say('river')} runs the wrong way for a day`,
    ()=>`two ${lang.say('moon')} stand in one sky`,
    ()=>`${kenning(r,'blood')} is paid in ${lang.say('silver_m')}`,
    ()=>`the ${lang.say('stone')} of the ${lang.say('gate')} is found split`,
    ()=>`${kenning(r,'war')} is called a harvest by those who reap it`,
    ()=>`no ${lang.say('song')} is sung in ${lang.say('hall')} for a year`
  ];
  return pick(r,f)();
}
function kenning(r,concept,langId){
  const lang=LANGS[langId!==undefined?langId:0];
  const pairs={
    sea:['the whale-road','the grey field','the salt waste'],
    war:['the iron harvest','the crow’s feast','the red hour'],
    death:['the long quiet','the last door','the hall of the unnamed'],
    king:['the high seat','the one who wears the ring','the giver of gold'],
    fire:['the bright hunger','the red beast'],
    winter:['the white year','the time of the wolf'],
    blood:['the kin-water','the red debt'],
    gold:['the sun’s bones','the dragon-bed'],
    sun:['the sky-wheel','the day’s eye'],
    ship:['the sea-horse','the wave-steed']
  };
  const k=pairs[concept];
  return k? pick(r,k) : concept;
}
function makeProphecy(seer,year,r){
  /* Prophecy is generated from real trend, then made obscure. */
  const kinds=[];
  const pols=POLS.filter(p=>p.alive&&p.sites.length>0&&SITES[p.capital]);
  const dyns=DYNS.filter(d=>!d.extinct&&d.living>0);
  if(dyns.length) kinds.push('dynasty_falls');
  if(dyns.length&&pols.length) kinds.push('line_restored');
  if(pols.length) kinds.push('city_burns','realm_united');
  if(ARTS.some(a=>a.lost&&!a.destroyed)) kinds.push('artifact_returns');
  if(dyns.length>1) kinds.push('blood_of_two');
  kinds.push('long_winter');
  const kind=pick(r,kinds);
  const p={
    id:PROPHS.length, by: seer? seer.id:-1, year, kind,
    fulfilled:-1, subverted:false, cond:null, text:'', deadline: year+ri(r,80,420),
    subject:'', reint:[]
  };
  const lang = seer? LANGS[CULTURES[seer.cult].lang] : LANGS[0];
  let a='',b='';
  switch(kind){
    case 'dynasty_falls': {
      const d=pickW(r,dyns,x=>x.kings+1);
      p.cond={t:'dyn_extinct',d:d.id};
      p.subject='House '+d.name;
      a=omen(r,lang);
      b=`the blood of ${d.name} shall be spent to the last drop`;
      break; }
    case 'line_restored': {
      const d=pickW(r,dyns,x=>x.kings+1);
      const pp=pick(r,pols);
      p.cond={t:'dyn_rules',d:d.id,p:pp.id};
      p.subject=d.name+' in '+pp.name;
      a=omen(r,lang);
      b=`one of ${d.name} shall sit again in ${pp.name}`;
      break; }
    case 'city_burns': {
      const pp=pick(r,pols); const s=SITES[pp.capital];
      p.cond={t:'site_sacked',s:s.id};
      p.subject=s.name;
      a=omen(r,lang);
      b=`${s.name} shall burn, and the burning will be remembered longer than the building`;
      break; }
    case 'realm_united': {
      const pp=pick(r,pols);
      p.cond={t:'pol_size',p:pp.id,n:Math.max(6,pp.sites.length*3)};
      p.subject=pp.name;
      a=omen(r,lang);
      b=`${pp.name} shall hold all the land between the hills, and hold it badly`;
      break; }
    case 'artifact_returns': {
      const lost=ARTS.filter(x=>x.lost&&!x.destroyed);
      const it=pick(r,lost);
      p.cond={t:'art_found',a:it.id};
      p.subject=it.name;
      a=omen(r,lang);
      b=`${it.name} shall come again into a living hand`;
      break; }
    case 'blood_of_two': {
      const d1=pick(r,dyns), d2=pick(r,dyns.filter(x=>x!==d1))||d1;
      p.cond={t:'blood_two',a:d1.id,b:d2.id};
      p.subject=d1.name+' and '+d2.name;
      a=omen(r,lang);
      b=`one shall wear a crown who carries both ${d1.name} and ${d2.name} in the blood`;
      break; }
    default: {
      p.cond={t:'cold',n:-1.6};
      p.subject='the world';
      a=omen(r,lang);
      b=`there shall come a winter that does not break`;
    }
  }
  if(prophecyHolds(p.cond)) return null;     /* already so; no one would call it foresight */
  p.text=pick(r,PROPH_FORMS)(a,b);
  PROPHS.push(p);
  if(seer) addTrait(seer,'seer',year);
  chron(year,4,'prophecy',
    `${seer? CHL(seer)+' speaks a prophecy' : 'A prophecy is set down'} concerning ${p.subject}: “${p.text}”`,
    {chars:seer?[seer.id]:[],prophs:[p.id]});
  return p;
}
function prophecyHolds(c){
  if(!c) return false;
  switch(c.t){
    case 'dyn_extinct': return !!(DYNS[c.d]&&DYNS[c.d].extinct);
    case 'dyn_rules': { const pp=P(c.p); return !!(pp&&pp.alive&&pp.dyn===c.d); }
    case 'site_sacked': { const s=SITES[c.s]; return !!(s&&(s.sacked>0||!s.alive)); }
    case 'pol_size': { const pp=P(c.p); return !!(pp&&pp.alive&&pp.sites.length>=c.n); }
    case 'art_found': { const it=ARTS[c.a]; return !!(it&&!it.lost&&it.holder>=0); }
    case 'blood_two':
      for(const pp of POLS){ if(!pp.alive) continue; const rl=C(pp.ruler);
        if(rl&&hasBlood(rl,c.a)&&hasBlood(rl,c.b)) return true; }
      return false;
    case 'cold': return CLIMATE_ANOM < c.n;
  }
  return false;
}
function checkProphecies(year){
  for(const p of PROPHS){
    if(p.fulfilled>=0||p.subverted) continue;
    if(year - p.year < 12) continue;      /* a prophecy needs time to be one */
    const c=p.cond; if(!c) continue;
    let hit=false;
    hit = prophecyHolds(c);
    if(hit){
      p.fulfilled=year;
      chron(year,5,'fulfil',
        `The words spoken in ${p.year} are fulfilled: “${p.text}”`,
        {prophs:[p.id]});
    }else if(year>p.deadline){
      p.subverted=true;
      chron(year,3,'subvert',
        `The prophecy of ${p.year} concerning ${p.subject} has outlived its own deadline. Scholars now argue it meant something else entirely.`,
        {prophs:[p.id]});
      p.reint.push({y:year,t:'read as figure, not fact'});
    }
  }
}
function hasBlood(ch,dynId,depth){
  depth=depth||0;
  if(!ch||depth>4) return false;
  if(ch.dyn===dynId) return true;
  return hasBlood(C(ch.fa),dynId,depth+1)||hasBlood(C(ch.mo),dynId,depth+1);
}

/* --------------------------------------------------------------- legends    */
/* Objective truth is stored once. What people believe drifts with distance
   and time, and later generations act on the drifted version.               */
function makeLegend(ev){
  const l={ id:LEGENDS.length, ev, year:ev.y, drift:0 };
  LEGENDS.push(l);
  if(LEGENDS.length>6000) LEGENDS.splice(0,1500);
  return l;
}
function retell(l,year,cultId){
  const age=Math.max(0,year-l.year);
  const r=stream(l.id*7919 + (cultId|0)*31 + ((age/50)|0), 'legend');
  const d=clamp(age/420,0,1);
  let t=l.ev.t;
  /* numbers grow in the telling */
  t=t.replace(/(\d[\d,]*)/g, m=>{
    const n=parseInt(m.replace(/,/g,''),10);
    if(!n||n<10) return m;
    return commify(Math.round(n*(1+d*rf(r,0.4,3.2))));
  });
  const flourish=[
    'It is said the sky went dark for it.',
    'Some hold that this never happened at all.',
    'The song adds a giant. There was no giant.',
    'Three cities claim the deed; two are lying.',
    'Children are still told to be quiet, or it will happen again.',
    'The date is disputed by a hundred years.',
    'It is remembered as a judgement, though at the time it was merely a Tuesday.'
  ];
  if(d>0.35&&chance(r,d)) t+=' '+pick(r,flourish);
  return t;
}
