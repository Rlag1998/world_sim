/* ============================================================================
   PART IV — PEOPLES, CULTURES AND GODS
   Species are rolled, not chosen. Cultures are value-vectors that drift when
   sundered and converge when joined. Gods are made in the image of the land
   that first feared them.
   ========================================================================== */

let SPECIES=[], CULTURES=[], FAITHS=[];

/* --------------------------------------------------------------- species    */
const TEMPER=['stoic','fierce','merry','sombre','proud','cunning','patient','restless','austere','ardent'];
const SPEC_TAGS=[
 {k:'longlived',   d:'long-lived'}, {k:'shortlived', d:'swift-burning'},
 {k:'delving',     d:'delvers'},    {k:'seafaring',  d:'sea-born'},
 {k:'nomadic',     d:'wandering'},  {k:'arboreal',   d:'wood-dwelling'},
 {k:'hardy',       d:'hardy'},      {k:'frail',      d:'frail'},
 {k:'tall',        d:'tall'},       {k:'small',      d:'small'},
 {k:'fecund',      d:'fecund'},     {k:'barren',     d:'slow to bear'},
 {k:'attuned',     d:'attuned to the old power'}, {k:'deaf',  d:'deaf to magic'},
 {k:'fierce',      d:'warlike'},    {k:'gentle',     d:'peaceable'},
 {k:'clever',      d:'quick to learn'}, {k:'stubborn', d:'slow to change'}
];

function genSpecies(seed){
  SPECIES=[];
  const r=stream(seed,'species');
  const n=ri(r,5,7);
  const elders=ri(r,1,2);
  for(let k=0;k<n;k++){
    const isElder = k<elders;
    const lang=LANGS[k % LANGS.length];
    const magic = isElder? rf(r,0.55,1.0) : rf(r,0.0,0.35);
    const life  = isElder? ri(r,260,1400) : ri(r,42,86);
    const tags=[];
    const pool=SPEC_TAGS.slice();
    for(let q=0;q<ri(r,2,4);q++){ const t=pick(r,pool); if(tags.indexOf(t)<0) tags.push(t); }
    if(isElder && tags.indexOf(SPEC_TAGS[12])<0) tags.push(SPEC_TAGS[12]);
    const bpref=[];
    const allB=[B_TFOREST,B_TAIGA,B_PRAIRIE,B_STEPPE,B_SHRUB,B_JUNGLE,B_MONSOON,
                B_SAVANNA,B_TUNDRA,B_ALPINE,B_BARREN,B_DESERT,B_MARSH,B_TRAINFOREST];
    for(let q=0;q<ri(r,2,4);q++) bpref.push(pick(r,allB));
    const nm = lang.compose([pick(r,['people','kin','folk','first','star','stone','earth','deep','high','shadow','light','fair','old','iron','sea','wind','fire'])],{suffix:'folk'});
    SPECIES.push({
      id:k, name:nm.t, gloss:nm.g, langSeed:lang.id,
      elder:isElder,
      life, matAge: isElder? Math.round(life*0.11) : ri(r,14,17),
      fert: isElder? rf(r,0.16,0.42) : rf(r,0.80,1.25),
      magic, magicDecay: isElder? rf(r,0.55,0.95) : rf(r,0.0,0.25),
      biomePref:bpref,
      temper: pick(r,TEMPER),
      stature: rf(r,0.55,1.45),
      tech: rf(r,0.7,1.3),
      hardy: rf(r,0.7,1.35),
      war: rf(r,0.65,1.4),
      tags, pop:0, color: hsl(k/n+0.05, 0.55, 0.62)
    });
  }
  return SPECIES;
}

/* --------------------------------------------------------------- cultures   */
const VAL_KEYS=['honor','piety','egal','martial','mercantile','xeno','seafaring','literacy',
                'cruelty','curiosity','tradition','zeal'];
const SUCC=[
  {k:'primogeniture', d:'eldest child inherits all'},
  {k:'ultimogeniture',d:'youngest child inherits all'},
  {k:'partible',      d:'the realm is divided among all sons'},
  {k:'elective',      d:'the great lords choose a successor'},
  {k:'tanistry',      d:'the worthiest of the blood is chosen'},
  {k:'seniority',     d:'the eldest of the dynasty inherits'},
  {k:'appointment',   d:'the ruler names an heir'}
];
const GENDER=[{k:'agnatic',d:'men only'},{k:'agnatic-cognatic',d:'men preferred'},
              {k:'absolute',d:'eldest regardless of sex'},{k:'enatic-cognatic',d:'women preferred'},
              {k:'enatic',d:'women only'}];
const CULT_ETH=['austere','ostentatious','mercantile','martial','contemplative','festive',
                'insular','wandering','legalistic','mystic','pastoral','maritime'];

function newCulture(seed,r,species,lang,homeTile,parent){
  const id=CULTURES.length;
  const vals={};
  for(const k of VAL_KEYS) vals[k]= parent? clamp(parent.vals[k]+gauss(r,0,0.12),0,1) : clamp(gauss(r,0.5,0.19),0.02,0.98);
  if(!parent){
    /* the land shapes the first values */
    if(homeTile>=0){
      if(T.coast[homeTile]) vals.seafaring=clamp(vals.seafaring+0.30,0,1);
      if(T.biome[homeTile]===B_STEPPE||T.biome[homeTile]===B_PRAIRIE) vals.martial=clamp(vals.martial+0.18,0,1);
      if(T.alt[homeTile]>0.35) vals.tradition=clamp(vals.tradition+0.20,0,1);
      if(T.fert[homeTile]>0.6) vals.mercantile=clamp(vals.mercantile+0.10,0,1);
      if(T.temp[homeTile]<0) vals.honor=clamp(vals.honor+0.12,0,1);
    }
    vals.literacy=clamp(vals.literacy*0.4,0,1);
  }
  const nm = parent? lang.unique([pick(r,['new','high','far','old','free','lost','great']),'people'],{suffix:'folk'})
                   : (homeTile>=0? lang.unique(sampleK(r,tileConcepts(homeTile).concat(['people']),2),{suffix:'folk'})
                                 : lang.unique(['people'],{suffix:'folk'}));
  const c={
    id, name:nm.t, gloss:nm.g, lang:lang.id, species:species.id,
    parent: parent? parent.id : -1, born: 0,
    vals, succ: parent? (chance(r,0.75)?parent.succ:pick(r,SUCC).k) : pick(r,SUCC).k,
    gender: parent? (chance(r,0.8)?parent.gender:pick(r,GENDER).k) : pickW(r,GENDER,(g,i)=>[3,5,2,1,0.5][i]).k,
    ethos: parent? (chance(r,0.6)?parent.ethos:pick(r,CULT_ETH)) : pick(r,CULT_ETH),
    faith:-1, home:homeTile, pop:0, tiles:0, prestige:0,
    color: hsl(hashStr('cult'+id+nm.t,seed)/4294967296, 0.48+0.3*((id*7)%3)/3, 0.55),
    techs:new Set(), lit:0, arts:0
  };
  CULTURES.push(c);
  return c;
}

/* Values drift every decade; separation makes them diverge. */
function cultureDrift(c,r,pressure){
  for(const k of VAL_KEYS){
    c.vals[k]=clamp(c.vals[k]+gauss(r,0,0.018)+(pressure&&pressure[k]||0),0.02,0.98);
  }
}

/* --------------------------------------------------------------- faiths     */
const DOMAINS=[
 {k:'sea',n:'the Sea',t:['sea','water','storm']},
 {k:'storm',n:'Storm',t:['storm','wind','fire']},
 {k:'harvest',n:'the Harvest',t:['grain','field','earth']},
 {k:'war',n:'War',t:['war','sword','blood']},
 {k:'death',n:'Death',t:['death','shadow','bone']},
 {k:'forge',n:'the Forge',t:['fire','iron','stone']},
 {k:'sun',n:'the Sun',t:['sun','light','gold']},
 {k:'moon',n:'the Moon',t:['moon','dark','dream']},
 {k:'beasts',n:'Beasts',t:['wolf','stag','hound']},
 {k:'trade',n:'Trade',t:['market','road','gift']},
 {k:'wisdom',n:'Wisdom',t:['word','law','star']},
 {k:'ice',n:'Winter',t:['ice','snow','cold']},
 {k:'mountain',n:'the Mountain',t:['mount','stone','peak']},
 {k:'plague',n:'Pestilence',t:['plague','wound','death']},
 {k:'love',n:'Love',t:['heart','flower','life']},
 {k:'fate',n:'Fate',t:['fate','dream','star']},
 {k:'dark',n:'the Dark',t:['dark','shadow','hidden']},
 {k:'hearth',n:'the Hearth',t:['house','fire','kin']},
 {k:'hunt',n:'the Hunt',t:['hawk','boar','spear']},
 {k:'river',n:'the River',t:['river','water','fish']},
 {k:'sky',n:'the Sky',t:['sky','eagle','wind']},
 {k:'healing',n:'Healing',t:['life','spring','hand']},
 {k:'justice',n:'Justice',t:['law','oath','shield']},
 {k:'revel',n:'Revelry',t:['wine','song','flower']},
 {k:'craft',n:'Craft',t:['hand','stone','gift']},
 {k:'exile',n:'the Wanderer',t:['exile','road','star']},
 {k:'serpent',n:'the Wyrm',t:['worm','serpent','fire']},
 {k:'tree',n:'the World-Tree',t:['oak','forest','earth']}
];
const FAITH_KIND=['pantheon','pantheon','pantheon','dualist','ancestral','animist','monist'];

function domainWeights(i){
  /* how much does this land care about each domain? */
  const w={};
  for(const d of DOMAINS) w[d.k]=0.25;
  if(i>=0){
    if(T.coast[i]) { w.sea+=1.4; w.river+=0.3; }
    if(T.harbor[i]>0.5) w.trade+=0.8;
    if(T.flow[i]>0) w.river+=1.1;
    if(T.fert[i]>0.55) w.harvest+=1.3;
    if(T.fert[i]<0.2) { w.death+=0.5; w.exile+=0.6; }
    if(T.alt[i]>0.34) w.mountain+=1.3;
    if(T.temp[i]<0) { w.ice+=1.3; w.hearth+=0.6; }
    if(T.temp[i]>25) { w.sun+=1.0; w.serpent+=0.4; }
    if(T.rain[i]>2000) { w.storm+=0.9; w.tree+=0.5; }
    if(T.rain[i]<250) { w.sun+=0.9; w.exile+=0.6; }
    const b=T.biome[i];
    if(b===B_TFOREST||b===B_TAIGA||b===B_JUNGLE) { w.tree+=1.1; w.beasts+=0.8; w.hunt+=0.7; }
    if(b===B_STEPPE||b===B_PRAIRIE) { w.sky+=1.0; w.hunt+=0.6; w.war+=0.4; }
    if(b===B_VOLCANIC) { w.forge+=1.5; w.serpent+=0.8; }
    if(b===B_MARSH||b===B_BOG) { w.plague+=0.8; w.dark+=0.5; }
    if(T.res[i]===R_IRON||T.res[i]===R_COPPER) w.forge+=1.0;
    if(T.res[i]===R_GOLD||T.res[i]===R_SILVER) { w.sun+=0.5; w.craft+=0.6; }
    if(T.ley[i]>0.9) { w.fate+=1.2; w.wisdom+=0.7; w.dark+=0.4; }
  }
  return w;
}

function newFaith(seed,r,culture,homeTile,parent,kindOverride){
  const id=FAITHS.length;
  const lang=LANGS[culture.lang];
  const kind = kindOverride || (parent? parent.kind : pick(r,FAITH_KIND));
  const gods=[];
  if(parent){
    for(const g of parent.gods) gods.push(Object.assign({},g));
  }else{
    const wts=domainWeights(homeTile);
    const order=DOMAINS.slice().sort((a,b)=>wts[b.k]-wts[a.k]);
    const ng = kind==='monist'? 1 : kind==='dualist'? 2 : kind==='ancestral'? ri(r,2,4) : ri(r,4,9);
    const picked=[];
    for(let k=0;k<ng;k++){
      const d = k<3? order[k] : pickW(r,DOMAINS,dd=>picked.indexOf(dd)>=0?0:wts[dd.k]);
      if(!d||picked.indexOf(d)>=0){ k--; if(picked.length>=DOMAINS.length) break; continue; }
      picked.push(d);
      const parts=sampleK(r,d.t,Math.min(2,d.t.length));
      const nm=lang.unique(parts,{});
      gods.push({name:nm.t, gloss:nm.g, domain:d.k, dname:d.n,
                 sex: chance(r,0.5)?'f':'m', rank:k===0?2:(k<3?1:0),
                 aspect: pick(r,['stern','merciful','jealous','silent','laughing','veiled','many-eyed','ever-young','ancient','wrathful','sorrowing','wandering'])});
    }
  }
  const head = gods.length? gods[0] : null;
  let nm;
  if(parent){
    nm = lang.unique([pick(r,['new','true','pure','old','hidden','broken','first']),'law'],{});
    nm.t = nm.t;
  } else {
    nm = lang.unique([pick(r,['law','oath','word','song','light','fate','holy'])],{});
  }
  const f={
    id, name: parent? nm.t : (head? 'the '+capWord(head.dname.replace(/^the /,''))+' Way' : nm.t),
    native: nm.t, kind, gods,
    parent: parent? parent.id : -1, born:0,
    origin: homeTile, culture: culture.id,
    prosel: parent? clamp(parent.prosel+gauss(r,0,0.15),0,1) : rf(r,0.05,0.95),
    tolerance: parent? clamp(parent.tolerance+gauss(r,0,0.15),0,1) : rf(r,0.05,0.95),
    militancy: parent? clamp(parent.militancy+gauss(r,0,0.15),0,1) : rf(r,0.05,0.95),
    ascetic: rf(r,0,1),
    organized: kind==='animist'? 0 : (chance(r,0.5)?1:0),
    headChar:-1, holy:[], followers:0, doctrine:[],
    color: hsl(hashStr('faith'+id+nm.t,seed)/4294967296, 0.42, 0.58),
    heresies:0
  };
  /* holy sites at genuinely strange places */
  FAITHS.push(f);
  return f;
}

function faithName(f){ return f.name; }
function faithBlurb(f){
  if(!f.gods.length) return 'a faith without names';
  const g=f.gods.slice(0,3).map(g=>g.name+' of '+g.dname);
  return listify(g);
}

/* Distance between two faiths' doctrine, for schism and tolerance checks. */
function faithGap(a,b){
  if(a===b) return 0;
  if(a.parent===b.id||b.parent===a.id) return 0.35;
  if(a.parent>=0&&a.parent===b.parent) return 0.5;
  let shared=0;
  for(const g of a.gods) if(b.gods.some(h=>h.domain===g.domain)) shared++;
  const den=Math.max(1,Math.max(a.gods.length,b.gods.length));
  return clamp(1-shared/den,0.15,1);
}
function cultureGap(a,b){
  if(a===b) return 0;
  let d=0;
  for(const k of VAL_KEYS) d+=Math.abs(a.vals[k]-b.vals[k]);
  d/=VAL_KEYS.length;
  if(a.species!==b.species) d+=0.28;
  if(LANGS[a.lang].family!==LANGS[b.lang].family) d+=0.22;
  else if(a.lang!==b.lang) d+=0.08;
  return clamp(d,0,1.4);
}
