/* ============================================================================
   PART VI — THE BLOOD
   Characters are born, inherit, scheme, marry for advantage, and die badly.
   Opinion is never a number without a reason attached to it.
   ========================================================================== */

const TRAITS=[
 /*0 */{k:'ambitious', n:'Ambitious', o:1,  s:{int:1,dip:1},  amb:.35, w:{}},
 /*1 */{k:'content',   n:'Content',   o:0,  s:{ste:1},        amb:-.30},
 /*2 */{k:'brave',     n:'Brave',     o:3,  s:{mar:2},        aggr:.15},
 /*3 */{k:'craven',    n:'Craven',    o:4,  s:{mar:-3},       aggr:-.25},
 /*4 */{k:'honest',    n:'Honest',    o:6,  s:{dip:1,int:-2}, plot:-.35},
 /*5 */{k:'deceitful', n:'Deceitful', o:7,  s:{int:3,dip:-1}, plot:.40},
 /*6 */{k:'just',      n:'Just',      o:8,  s:{ste:2},        cruel:-.3},
 /*7 */{k:'arbitrary', n:'Arbitrary', o:9,  s:{ste:-2,int:1}, cruel:.2},
 /*8 */{k:'humble',    n:'Humble',    o:10, s:{dip:1}},
 /*9 */{k:'proud',     n:'Proud',     o:11, s:{dip:-1,mar:1}, amb:.15},
 /*10*/{k:'patient',   n:'Patient',   o:12, s:{ste:1,lea:1}},
 /*11*/{k:'wroth',     n:'Wroth',     o:13, s:{mar:2,dip:-2}, aggr:.25},
 /*12*/{k:'chaste',    n:'Chaste',    o:14, s:{pie:2},        fert:-.25},
 /*13*/{k:'lustful',   n:'Lustful',   o:15, s:{dip:1},        fert:.35, bastard:.5},
 /*14*/{k:'temperate', n:'Temperate', o:16, s:{ste:1,lea:1}},
 /*15*/{k:'gluttonous',n:'Gluttonous',o:17, s:{ste:-1},       health:-.10},
 /*16*/{k:'generous',  n:'Generous',  o:18, s:{dip:2},        gold:-.2},
 /*17*/{k:'greedy',    n:'Greedy',    o:19, s:{ste:2,dip:-2}, gold:.3, plot:.15},
 /*18*/{k:'diligent',  n:'Diligent',  o:20, s:{ste:2,lea:1}},
 /*19*/{k:'slothful',  n:'Slothful',  o:21, s:{ste:-2,mar:-1}},
 /*20*/{k:'cruel',     n:'Cruel',     o:22, s:{int:2,dip:-3}, cruel:.5, aggr:.1},
 /*21*/{k:'kind',      n:'Kind',      o:23, s:{dip:3,int:-1}, cruel:-.4},
 /*22*/{k:'zealous',   n:'Zealous',   o:24, s:{pie:3,mar:1},  zeal:.4},
 /*23*/{k:'cynical',   n:'Cynical',   o:25, s:{pie:-3,int:2}, zeal:-.4},
 /*24*/{k:'shrewd',    n:'Shrewd',    o:-1, s:{int:2,ste:2,lea:2}},
 /*25*/{k:'dull',      n:'Dull',      o:-1, s:{int:-2,ste:-2,lea:-3}},
 /*26*/{k:'learned',   n:'Learned',   o:-1, s:{lea:4,pie:1}},
 /*27*/{k:'gregarious',n:'Gregarious',o:-1, s:{dip:3}},
 /*28*/{k:'shy',       n:'Reclusive', o:-1, s:{dip:-3,lea:1}},
 /*29*/{k:'paranoid',  n:'Paranoid',  o:-1, s:{int:2,dip:-2}, plot:.2},
 /*30*/{k:'trusting',  n:'Trusting',  o:-1, s:{dip:1,int:-2}},
 /*31*/{k:'vengeful',  n:'Vengeful',  o:-1, s:{mar:1,dip:-1}, aggr:.2, grudge:.5},
 /*32*/{k:'forgiving', n:'Forgiving', o:-1, s:{dip:2},        grudge:-.5},
 /*33*/{k:'stubborn',  n:'Stubborn',  o:-1, s:{mar:1,ste:1,dip:-1}},
 /*34*/{k:'sickly',    n:'Sickly',    o:-1, s:{mar:-1},       health:-.35},
 /*35*/{k:'robust',    n:'Robust',    o:-1, s:{mar:2},        health:.30},
 /*36*/{k:'comely',    n:'Comely',    o:-1, s:{dip:2},        marry:.5},
 /*37*/{k:'scarred',   n:'Scarred',   o:-1, s:{mar:1,dip:-1}, marry:-.2},
 /*38*/{k:'lame',      n:'Lame',      o:-1, s:{mar:-3},       marry:-.3},
 /*39*/{k:'oneeyed',   n:'One-Eyed',  o:-1, s:{mar:-1,int:1}},
 /*40*/{k:'mad',       n:'Mad',       o:-1, s:{int:2,dip:-4,ste:-3}, cruel:.4, aggr:.3},
 /*41*/{k:'drunkard',  n:'A Drunkard',o:-1, s:{ste:-2,dip:1}, health:-.15},
 /*42*/{k:'kinslayer', n:'Kinslayer', o:-1, s:{dip:-5}, earned:1},
 /*43*/{k:'oathbreaker',n:'Oathbreaker',o:-1,s:{dip:-4}, earned:1},
 /*44*/{k:'blessed',   n:'God-Touched',o:-1,s:{pie:4,dip:2}, earned:1},
 /*45*/{k:'twisted',   n:'Corrupted', o:-1, s:{int:3,dip:-3,pie:-3}, earned:1, cruel:.4},
 /*46*/{k:'giant',     n:'Of Great Stature',o:-1,s:{mar:3,dip:1}},
 /*47*/{k:'dwarfish',  n:'Stunted',   o:-1, s:{mar:-2,int:2,lea:1}, marry:-.3},
 /*48*/{k:'seer',      n:'A Dreamer of True Dreams',o:-1,s:{lea:2,pie:2}, earned:1}
];
const TRAITI={}; TRAITS.forEach((t,i)=>TRAITI[t.k]=i);
/* opposite pairs cannot coexist */
const SKILLS=['mar','ste','int','dip','lea','pie'];
const SKILLN={mar:'Martial',ste:'Stewardship',int:'Intrigue',dip:'Diplomacy',lea:'Learning',pie:'Piety'};

let CHARS=[], DYNS=[], LIVING=new Set(), HIST=[];
let charSeq=0;

function traitHas(ch,k){ return ch.tr.indexOf(TRAITI[k])>=0; }
function traitSum(ch,key){
  let v=0; for(const t of ch.tr){ const q=TRAITS[t][key]; if(q) v+=q; }
  return v;
}
function addTrait(ch,k,year,why){
  const id=TRAITI[k]; if(id===undefined||ch.tr.indexOf(id)>=0) return false;
  const o=TRAITS[id].o;
  if(o>=0){ const oi=ch.tr.indexOf(o); if(oi>=0) ch.tr.splice(oi,1); }
  ch.tr.push(id);
  applySkills(ch);
  return true;
}
function applySkills(ch){
  const b=ch.base;
  for(const s of SKILLS) ch.sk[s]=b[s];
  for(const t of ch.tr){ const m=TRAITS[t].s; if(!m) continue;
    for(const k in m) ch.sk[k]=clamp(ch.sk[k]+m[k],0,30); }
}

/* --------------------------------------------------------------- dynasties  */
const SIGIL_CHARGE=['wolf','bear','raven','eagle','hawk','horse','boar','stag','serpent',
 'lion','fish','whale','swan','owl','fox','goat','worm','oak','pine','thorn','flower',
 'sun','moon','star','fire','storm','tower','sword','spear','shield','crown','horn',
 'ring','hand','eye','heart','bone','gate','bridge','mount','water','tower','wall'];
const TINCT=[['sable','#1b1b1b'],['gules','#8c2b22'],['azure','#25517a'],['vert','#2f6b3a'],
 ['purpure','#5b3a6e'],['or','#c8a24a'],['argent','#cfcfcf'],['tenné','#8a5a2b'],['murrey','#6b2a44']];
const DIVISION=['plain','per pale','per fess','per bend','quarterly','per chevron','per saltire','barry','paly','chequy'];

function newDynasty(seed,r,founder,cult,seatName){
  const lang=LANGS[cult.lang];
  const nm=nameDynasty(lang,r,seatName);
  const f=pick(r,TINCT), c1=pick(r,TINCT.filter(t=>t!==f));
  const motto=lang.compose(sampleK(r,['blood','fire','iron','oath','stone','sea','storm','wolf',
    'law','shadow','light','war','peace','crown','death','life','song','star','ice','honor'],2));
  const d={
    id:DYNS.length, name:nm.t, gloss:nm.g, founder:founder,
    culture:cult.id, prestige:0, members:[], living:0, seat:-1, extinct:false,
    born:0, ended:-1, kings:0, peakPrestige:0,
    sigil:{field:f, charge:pick(r,SIGIL_CHARGE), tinct:c1, div:pick(r,DIVISION)},
    motto: motto.t, mottoGloss: motto.g,
    grudges:[], color: hsl(hashStr('dyn'+DYNS.length+nm.t,seed)/4294967296,0.5,0.58)
  };
  DYNS.push(d);
  return d;
}
function sigilText(d){
  const s=d.sigil;
  return `${cap(s.tinct[0])} ${CN[s.charge]||s.charge} on ${s.field[0]}${s.div!=='plain'? ', '+s.div:''}`;
}

/* --------------------------------------------------------------- characters */
function newChar(r,cult,faith,year,father,mother,sex){
  const sp=SPECIES[cult.species];
  const lang=LANGS[cult.lang];
  sex = sex || (chance(r,0.512)?'m':'f');
  const nm=namePerson(lang,r,sex==='f');
  const base={};
  for(const s of SKILLS){
    let v=gauss(r,7.0,3.1);
    if(father&&mother) v=v*0.55 + (father.base[s]+mother.base[s])*0.5*0.45 + gauss(r,0,1.6);
    base[s]=clamp(Math.round(v),0,22);
  }
  const ch={
    id:CHARS.length, name:nm.t, gloss:nm.g, epi:'', regnal:0,
    sex, born:year, died:-1, cause:'',
    dyn:-1, cult:cult.id, faith: faith, spec:cult.species,
    fa: father? father.id : -1, mo: mother? mother.id : -1,
    sp:-1, kids:[], spouses:[],
    base, sk:{}, tr:[],
    health: clamp(gauss(r,0.82,0.13),0.25,1),
    prestige: 0, gold: 0, piety: 0, stress:0,
    titles:[], claims:[], liege:-1, court:-1,
    rel:null, grudge:[], arts:[],
    bastard:0, prison:-1, exiled:0, married:0, pregnant:0, fertile:1,
    site:-1, lastPlot:0, plotting:null, kills:0, battles:0, wonBattles:0, conquests:0,
    deeds:[], ev:[], great:0
  };
  /* traits: correlated with parents, then noise */
  const nt=ri(r,2,4);
  for(let k=0;k<nt;k++){
    let t;
    if(father&&mother&&chance(r,0.42)){
      const src=chance(r,0.5)?father:mother;
      if(src.tr.length) t=pick(r,src.tr);
    }
    if(t===undefined) t=(r()*42)|0;
    if(TRAITS[t].earned) continue;
    const o=TRAITS[t].o;
    if(o>=0&&ch.tr.indexOf(o)>=0) continue;
    if(ch.tr.indexOf(t)<0) ch.tr.push(t);
  }
  if(sp.stature>1.25&&chance(r,0.10)) ch.tr.push(TRAITI.giant);
  if(sp.stature<0.75&&chance(r,0.10)) ch.tr.push(TRAITI.dwarfish);
  /* Most people are ordinary. A few are not, and history is mostly about them. */
  if(chance(r,0.0045)){
    ch.great=1;
    const s1=pick(r,SKILLS), s2=pick(r,SKILLS);
    ch.base[s1]=clamp(ch.base[s1]+ri(r,7,12),0,26);
    ch.base[s2]=clamp(ch.base[s2]+ri(r,4,9),0,26);
    const boon=pick(r,['ambitious','shrewd','brave','learned','gregarious','diligent','zealous','deceitful']);
    const bi=TRAITI[boon];
    if(ch.tr.indexOf(bi)<0){ const o=TRAITS[bi].o;
      if(o>=0){ const oi=ch.tr.indexOf(o); if(oi>=0) ch.tr.splice(oi,1); }
      ch.tr.push(bi); }
  }
  applySkills(ch);
  ch.health += traitSum(ch,'health');
  ch.health = clamp(ch.health,0.15,1.15);
  CHARS.push(ch); LIVING.add(ch.id);
  if(father&&father.dyn>=0){ ch.dyn=father.dyn; }
  else if(mother&&mother.dyn>=0&&CULTURES[cult.id].gender==='enatic') ch.dyn=mother.dyn;
  else if(mother&&mother.dyn>=0&&!father) ch.dyn=mother.dyn;
  if(ch.dyn>=0){ DYNS[ch.dyn].members.push(ch.id); DYNS[ch.dyn].living++; }
  return ch;
}
function C(id){ return id>=0&&id<CHARS.length? CHARS[id] : null; }
function alive(ch){ return ch && ch.died<0; }
function ageOf(ch,year){ return (ch.died<0? year : ch.died) - ch.born; }
function fullName(ch){
  const d=ch.dyn>=0? DYNS[ch.dyn] : null;
  let n=ch.name;
  if(ch.regnal>1) n+=' '+roman(ch.regnal);
  if(ch.epi) n+=' '+ch.epi;
  if(d) n+=' of '+d.name;
  return n;
}
function shortName(ch){
  let n=ch.name;
  if(ch.regnal>1) n+=' '+roman(ch.regnal);
  return n;
}

/* --------------------------------------------------------------- opinion    */
function relOf(a,b){
  if(!a.rel) a.rel=new Map();
  let e=a.rel.get(b);
  if(!e){ e={v:0,c:[]}; a.rel.set(b,e);
    if(a.rel.size>26){ /* forget the weakest tie */
      let wk=null,wv=1e9;
      for(const [k,q] of a.rel){ const m=Math.abs(q.v); if(m<wv){wv=m;wk=k;} }
      if(wk!==null&&wk!==b) a.rel.delete(wk);
    }
  }
  return e;
}
function opine(a,b,dv,why,year){
  if(!a||!b||a.id===b.id) return;
  const e=relOf(a,b);
  e.v=clamp(e.v+dv,-140,140);
  if(why){ e.c.push({t:why,v:dv,y:year}); if(e.c.length>6) e.c.shift(); }
}
function opinion(a,b,year){
  if(!a||!b) return 0;
  let v=0;
  if(a.rel){ const e=a.rel.get(b.id); if(e) v=e.v; }
  /* structural opinion */
  const ca=CULTURES[a.cult], cb=CULTURES[b.cult];
  if(a.cult!==b.cult) v-=18*cultureGap(ca,cb)*(0.4+ca.vals.xeno);
  if(a.faith!==b.faith&&a.faith>=0&&b.faith>=0)
    v-=26*faithGap(FAITHS[a.faith],FAITHS[b.faith])*(0.3+ca.vals.zeal);
  if(a.dyn>=0&&a.dyn===b.dyn) v+=16;
  v += (b.sk.dip-8)*1.4;
  if(traitHas(a,'paranoid')) v-=8;
  if(traitHas(a,'trusting')) v+=6;
  if(traitHas(b,'kinslayer')) v-=25;
  if(traitHas(b,'oathbreaker')) v-=22;
  if(traitHas(b,'cruel')&&!traitHas(a,'cruel')) v-=10;
  if(traitHas(b,'kind')) v+=6;
  /* shared traits */
  for(const t of a.tr) if(b.tr.indexOf(t)>=0) v+=3;
  /* inherited feuds */
  for(const g of a.grudge) if(g.d===b.dyn||g.c===b.id) v-=g.w;
  return clamp(Math.round(v),-160,160);
}

/* --------------------------------------------------------------- lifecycle  */
function killChar(ch,year,cause,killer){
  if(ch.died>=0) return;
  ch.died=year; ch.cause=cause||'natural causes';
  LIVING.delete(ch.id);
  if(ch.dyn>=0) DYNS[ch.dyn].living--;
  if(ch.sp>=0){ const s=C(ch.sp); if(s&&alive(s)){ s.sp=-1; s.married=0; } }
  ch.rel=null;
  if(killer&&killer!==ch.id){
    const k=C(killer);
    if(k){
      k.kills++;
      /* the dead man's kin remember */
      const kin=[];
      if(ch.fa>=0) kin.push(ch.fa);
      if(ch.mo>=0) kin.push(ch.mo);
      for(const c of ch.kids) kin.push(c);
      if(ch.sp>=0) kin.push(ch.sp);
      for(const kid of kin){
        const q=C(kid); if(!q||!alive(q)) continue;
        opine(q,k,-70,'slew my blood',year);
        q.grudge.push({c:k.id,d:k.dyn,w:38,y:year,why:'the killing of '+ch.name});
        if(q.grudge.length>10) q.grudge.shift();
      }
      if(k.dyn>=0&&ch.dyn>=0&&k.dyn===ch.dyn) addTrait(k,'kinslayer',year);
    }
  }
}
function sameDyn(a,b){ return a.dyn>=0&&a.dyn===b.dyn; }
function consang(a,b){
  if(!a||!b) return 0;
  if(a.fa>=0&&(a.fa===b.fa||a.fa===b.id)) return 1;
  if(a.mo>=0&&(a.mo===b.mo||a.mo===b.id)) return 1;
  if(b.fa===a.id||b.mo===a.id) return 1;
  const g=new Set();
  const fa=C(a.fa), mo=C(a.mo);
  if(fa){ if(fa.fa>=0)g.add(fa.fa); if(fa.mo>=0)g.add(fa.mo); }
  if(mo){ if(mo.fa>=0)g.add(mo.fa); if(mo.mo>=0)g.add(mo.mo); }
  const fb=C(b.fa), mb=C(b.mo);
  const gb=new Set();
  if(fb){ if(fb.fa>=0)gb.add(fb.fa); if(fb.mo>=0)gb.add(fb.mo); }
  if(mb){ if(mb.fa>=0)gb.add(mb.fa); if(mb.mo>=0)gb.add(mb.mo); }
  for(const x of g) if(gb.has(x)) return 0.5;
  return 0;
}

/* --------------------------------------------------------------- epithets   */
const EPITHETS={
 conqueror:'the Conqueror', great:'the Great', wise:'the Wise', cruel:'the Cruel',
 just:'the Just', bold:'the Bold', unready:'the Unready', fat:'the Fat',
 pious:'the Pious', accursed:'the Accursed', lawgiver:'the Lawgiver',
 navigator:'the Navigator', builder:'the Builder', mad:'the Mad',
 kinslayer:'Kinslayer', bastard:'the Bastard', young:'the Young', old:'the Old',
 black:'the Black', ironhand:'Ironhand', bloody:'the Bloody', peaceful:'the Peacemaker',
 golden:'the Golden', unlucky:'the Unlucky', broken:'the Broken', seer:'the Dreamer',
 hammer:'the Hammer', lion:'the Lion', wolf:'the Wolf', silent:'the Silent',
 fair:'the Fair', grim:'the Grim', martyr:'the Martyr', usurper:'the Usurper',
 restorer:'the Restorer', sunderer:'the Sunderer', wanderer:'the Wanderer'
};
function award(ch,key,year){
  if(ch.epi) return false;
  ch.epi=EPITHETS[key]||key;
  return true;
}
function judgeEpithet(ch,year){
  if(ch.epi) return;
  const age=ageOf(ch,year);
  const r=stream(year*7919+ch.id,'epi');
  if(ch.conquests>=4) return award(ch,'conqueror');
  if(traitHas(ch,'mad')) return award(ch,'mad');
  if(traitHas(ch,'kinslayer')&&chance(r,0.8)) return award(ch,'kinslayer');
  if(ch.bastard&&chance(r,0.35)) return award(ch,'bastard');
  if(ch.wonBattles>=4) return award(ch,'hammer');
  if(ch.sk.lea>=17&&chance(r,0.6)) return award(ch,'wise');
  if(ch.sk.pie>=17&&chance(r,0.6)) return award(ch,'pious');
  if(traitHas(ch,'cruel')&&ch.kills>1) return award(ch,'cruel');
  if(traitHas(ch,'just')&&ch.sk.ste>=14) return award(ch,'just');
  if(traitHas(ch,'brave')&&ch.battles>=3) return award(ch,'bold');
  if(traitHas(ch,'seer')) return award(ch,'seer');
  if(ch.gold>2400) return award(ch,'golden');
  if(ch.great&&(ch.sk.mar+ch.sk.dip+ch.sk.ste)>48&&ch.conquests>=2) return award(ch,'great');
  if(age>0&&ch.died<0&&age>SPECIES[ch.spec].life*0.92) return award(ch,'old');
}

/* --------------------------------------------------------------- marriage   */
function marryPair(a,b,year,r){
  a.sp=b.id; b.sp=a.id; a.married=1; b.married=1;
  a.spouses.push(b.id); b.spouses.push(a.id);
  opine(a,b,18,'we are wed',year); opine(b,a,18,'we are wed',year);
  const pa=a.titles.length?POLS[a.titles[0]]:null, pb=b.titles.length?POLS[b.titles[0]]:null;
  if(pa&&pb&&pa!==pb){
    setRelation(pa,pb,26,'marriage alliance',year);
    pa.marriages=(pa.marriages||0)+1; pb.marriages=(pb.marriages||0)+1;
  }
}
function birth(mo,fa,year,r,bastard){
  const cult=CULTURES[fa? fa.cult : mo.cult];
  const ch=newChar(r,cult, fa? fa.faith : mo.faith, year, fa, mo);
  ch.bastard=bastard?1:0;
  if(bastard&&chance(r,0.5)) ch.dyn=-1;
  if(mo){ mo.kids.push(ch.id); }
  if(fa){ fa.kids.push(ch.id); }
  ch.site = mo? mo.site : (fa?fa.site:-1);
  ch.court= mo? mo.court: (fa?fa.court:-1);
  return ch;
}
