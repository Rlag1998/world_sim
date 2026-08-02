/* ============================================================================
   PART III — TONGUES
   A proto-language is invented, given a phonology and a root lexicon. As
   peoples divide, regular sound laws are applied to the inherited roots, so
   daughter tongues are visibly cognate and every name can be glossed.
   ========================================================================== */

const CONS=[
 {p:'p',r:['p']},{p:'b',r:['b']},{p:'t',r:['t']},{p:'d',r:['d']},
 {p:'k',r:['k','c','k']},{p:'g',r:['g']},{p:'q',r:['q','k']},
 {p:'m',r:['m']},{p:'n',r:['n']},{p:'N',r:['ng','ñ','n']},
 {p:'f',r:['f','ph','f']},{p:'v',r:['v','w']},{p:'T',r:['th','þ','t']},{p:'D',r:['dh','ð','d']},
 {p:'s',r:['s']},{p:'z',r:['z','s']},{p:'S',r:['sh','š','sc']},{p:'Z',r:['zh','ž','j']},
 {p:'x',r:['kh','ch','h']},{p:'h',r:['h']},{p:'G',r:['gh','g']},
 {p:'c',r:['ts','tz','c']},{p:'C',r:['ch','č','tj']},{p:'J',r:['j','dzh','g']},
 {p:'r',r:['r']},{p:'R',r:['rr','hr','ř']},{p:'l',r:['l']},{p:'L',r:['ll','hl','ł']},
 {p:'w',r:['w','v']},{p:'y',r:['y','j','i']},{p:'W',r:['hw','wh','f']},
 {p:'K',r:['qu','kw','cu']},{p:'B',r:['gw','gu','b']},{p:'F',r:['tl','thl']},
 {p:'ʔ',r:["'",'','h']}
];
const VOWS=[
 {p:'a',r:['a']},{p:'e',r:['e']},{p:'i',r:['i']},{p:'o',r:['o']},{p:'u',r:['u']},
 {p:'A',r:['á','aa','ā','a']},{p:'E',r:['é','ee','ē','e']},{p:'I',r:['í','ii','ī','y']},
 {p:'O',r:['ó','oo','ō','o']},{p:'U',r:['ú','uu','ū','ou']},
 {p:'ä',r:['ä','ae','æ','e']},{p:'ö',r:['ö','oe','ø','o']},{p:'ü',r:['ü','ue','y','u']},
 {p:'1',r:['ai','ay','ei']},{p:'2',r:['au','aw','ou']},{p:'3',r:['ei','ey','ai']},
 {p:'4',r:['ou','ow','o']},{p:'5',r:['ia','ya','ea']},{p:'6',r:['ua','wa','oa']},
 {p:'@',r:['e','a','o','']}
];
const CMAP={},VMAP={};
CONS.forEach(c=>CMAP[c.p]=c); VOWS.forEach(v=>VMAP[v.p]=v);
const isV = p=> VMAP[p]!==undefined;

/* Core consonant tiers: every tongue takes all of tier 0 and samples the rest. */
const C_CORE=['p','t','k','m','n','s','l','r'];
const C_COMMON=['b','d','g','h','w','y','f','v','T','S','z','x','C','N'];
const C_RARE=['q','D','Z','G','c','J','R','L','W','K','B','F','ʔ'];
const V_CORE=['a','i','u'];
const V_COMMON=['e','o','A','I','U','1','2'];
const V_RARE=['E','O','ä','ö','ü','3','4','5','6','@'];

/* ------------------------------------------------------------- the concepts */
const CN = {
  water:'water', river:'river', sea:'sea', lake:'lake', spring:'spring', ford:'ford',
  isle:'isle', shore:'shore', bay:'bay', cape:'cape', marsh:'marsh', mere:'mere',
  hill:'hill', mount:'mountain', peak:'peak', crag:'crag', vale:'vale', glen:'glen',
  plain:'plain', field:'field', meadow:'meadow', moor:'moor', heath:'heath',
  forest:'wood', grove:'grove', waste:'waste', sand:'sand', stone:'stone', cave:'cave',
  ash:'ash', ice:'ice', snow:'snow', fire:'fire', storm:'storm', wind:'wind',
  mist:'mist', rain:'rain', sun:'sun', moon:'moon', star:'star', sky:'sky',
  earth:'earth', deep:'deep', salt:'salt', gate:'gate', pass:'pass', road:'road',
  bridge:'bridge', harbor:'haven',
  oak:'oak', pine:'pine', birch:'birch', willow:'willow', thorn:'thorn', reed:'reed',
  grass:'grass', vine:'vine', olive:'olive', palm:'palm', cedar:'cedar', fern:'fern',
  grain:'corn', apple:'apple', flower:'flower', moss:'moss',
  wolf:'wolf', bear:'bear', raven:'raven', eagle:'eagle', hawk:'hawk', horse:'horse',
  boar:'boar', stag:'hart', serpent:'serpent', fish:'fish', whale:'whale', lion:'lion',
  ox:'ox', hound:'hound', swan:'swan', owl:'owl', fox:'fox', goat:'goat', worm:'wyrm',
  great:'great', small:'little', high:'high', low:'low', new:'new', old:'old',
  black:'black', white:'white', red:'red', gold:'golden', silver:'silver',
  green:'green', blue:'blue', grey:'grey', bright:'bright', dark:'dark',
  cold:'cold', warm:'warm', swift:'swift', still:'still', wild:'wild',
  holy:'hallowed', cursed:'accursed', hidden:'hidden', lost:'lost', broken:'broken',
  fair:'fair', grim:'grim', far:'far', first:'first', last:'last', iron:'iron',
  fort:'fort', tower:'tower', wall:'wall', hall:'hall', house:'house', town:'town',
  city:'city', temple:'temple', tomb:'tomb', throne:'throne', keep:'keep',
  camp:'camp', market:'market', mine:'mine', mill:'mill', well:'well', ring:'ring',
  king:'king', queen:'queen', lord:'lord', lady:'lady', folk:'folk', kin:'kin',
  son:'son', daughter:'daughter', father:'father', mother:'mother',
  war:'war', peace:'peace', blood:'blood', death:'death', life:'life',
  god:'god', spirit:'spirit', oath:'oath', law:'law', song:'song', word:'word',
  dream:'dream', fate:'doom', shadow:'shadow', light:'light',
  sword:'sword', spear:'spear', shield:'shield', crown:'crown', horn:'horn',
  banner:'banner', hand:'hand', eye:'eye', heart:'heart', bone:'bone',
  wound:'wound', tear:'tear', gift:'gift', hunger:'hunger', plague:'plague',
  exile:'exile', home:'home', land:'land', realm:'realm', people:'people',
  gold_m:'gold', silver_m:'silver', copper:'copper', tin:'tin', gem:'gem',
  wine:'wine', bread:'bread', salt_m:'salt', fur:'fur', amber:'amber', spice:'spice'
};
const CONCEPTS=Object.keys(CN);

/* Concepts that read well in personal names (dithematic style). */
const NAME_A=['wolf','bear','raven','eagle','hawk','horse','boar','stag','serpent','lion',
  'iron','gold','silver','stone','fire','storm','wind','sun','moon','star','sky','sea',
  'war','blood','oath','law','song','shadow','light','sword','spear','shield','crown',
  'horn','hand','eye','heart','bone','god','spirit','dream','fate','high','bright','dark',
  'holy','swift','grim','fair','old','first','ash','ice','snow','thorn','oak','hound','owl'];
const NAME_B=['lord','king','queen','wolf','bear','raven','war','sword','spear','shield',
  'oath','law','gift','fate','light','shadow','stone','fire','storm','hand','heart','song',
  'crown','horn','ring','kin','son','blood','word','bone',
  'peace','life','death','realm','land','home','banner','hound','tower','hall'];

/* --------------------------------------------------------------- phonology  */
function makePhonology(r){
  const cons=C_CORE.slice();
  for(const c of C_COMMON) if(chance(r,0.62)) cons.push(c);
  for(const c of C_RARE)   if(chance(r,0.24)) cons.push(c);
  const vows=V_CORE.slice();
  for(const v of V_COMMON) if(chance(r,0.66)) vows.push(v);
  for(const v of V_RARE)   if(chance(r,0.26)) vows.push(v);
  const onsets=cons.slice();
  const codaPool=cons.filter(c=>['p','t','k','m','n','s','l','r','N','T','S','f','x','z','d','g','b'].indexOf(c)>=0);
  const codas = codaPool.length? sampleK(r,codaPool,Math.max(2,(codaPool.length*rf(r,0.35,0.9))|0)) : ['n'];
  const clusterOK = chance(r,0.5);
  const clusters=[];
  if(clusterOK){
    const liq=cons.filter(c=>'lrwy'.indexOf(c)>=0);
    const stop=cons.filter(c=>'ptkbdgfsSx'.indexOf(c)>=0);
    for(const s of stop) for(const l of liq) if(chance(r,0.42)) clusters.push(s+l);
  }
  const tmplPool=[];
  const add=(t,n)=>{ for(let i=0;i<n;i++) tmplPool.push(t); };
  add('CV', ri(r,5,9)); add('CVC', ri(r,2,7)); add('V', ri(r,0,2)); add('VC', ri(r,0,3));
  if(clusters.length){ add('LV', ri(r,0,3)); add('LVC', ri(r,0,2)); }
  if(codas.length) add('CVC', 2);
  return {cons,vows,onsets,codas,clusters,tmplPool,
          maxSyl: ri(r,2,3), minSyl: 1,
          romStyle: ri(r,0,2),
          harmony: chance(r,0.22),
          stress: pick(r,['initial','penult','final'])};
}

function genWord(ph,r,minS,maxS){
  const n=ri(r,minS!==undefined?minS:ph.minSyl, maxS!==undefined?maxS:ph.maxSyl);
  const out=[];
  let frontHarm = chance(r,0.5);
  for(let s=0;s<n;s++){
    let t=pick(r,ph.tmplPool);
    if(s===0&&t[0]==='V'&&chance(r,0.5)) t='C'+t;
    for(const ch of t){
      if(ch==='C') out.push(pick(r,ph.onsets));
      else if(ch==='L') out.push.apply(out, ph.clusters.length? pick(r,ph.clusters).split('') : [pick(r,ph.onsets)]);
      else if(ch==='V'){
        let v=pick(r,ph.vows);
        if(ph.harmony){
          const front='ieEIäü3'.indexOf(v)>=0;
          if(s>0 && front!==frontHarm){
            const alt=ph.vows.filter(q=>('ieEIäü3'.indexOf(q)>=0)===frontHarm);
            if(alt.length) v=pick(r,alt);
          } else if(s===0) frontHarm=('ieEIäü3'.indexOf(v)>=0);
        }
        out.push(v);
      }
    }
  }
  return out;
}

/* --------------------------------------------------------- sound-change law */
const LAWS=[
  {n:'Grimm’s shift',        f:(w)=>map(w,{p:'f',t:'T',k:'x',b:'p',d:'t',g:'k'})},
  {n:'lenition',             f:(w)=>inter(w,{p:'b',t:'d',k:'g',s:'h',f:'v'})},
  {n:'final devoicing',      f:(w)=>final(w,{b:'p',d:'t',g:'k',z:'s',v:'f'})},
  {n:'rhotacism',            f:(w)=>inter(w,{z:'r',s:'r'})},
  {n:'palatalisation',       f:(w)=>beforeFront(w,{k:'C',g:'J',t:'c',s:'S'})},
  {n:'apocope',              f:(w)=>apocope(w)},
  {n:'syncope',              f:(w)=>syncope(w)},
  {n:'the great vowel shift',f:(w)=>map(w,{a:'e',e:'i',i:'1',o:'u',u:'2',A:'E',E:'I',O:'U'})},
  {n:'vowel lowering',       f:(w)=>map(w,{i:'e',u:'o',I:'E',U:'O',e:'a',E:'A'})},
  {n:'vowel breaking',       f:(w)=>map(w,{A:'2',E:'3',I:'5',O:'4',U:'6'})},
  {n:'nasal loss',           f:(w)=>nasalLoss(w)},
  {n:'debuccalisation',      f:(w)=>initial(w,{s:'h',f:'h',T:'h',x:'h'})},
  {n:'cluster simplification',f:(w)=>declust(w)},
  {n:'prothesis',            f:(w)=>prothesis(w)},
  {n:'liquid merger',        f:(w)=>map(w,{L:'l',R:'r',l:'r'})},
  {n:'spirantisation',       f:(w)=>map(w,{T:'s',D:'z',x:'h',G:'g'})},
  {n:'affrication',          f:(w)=>map(w,{t:'c',d:'J',k:'C'})},
  {n:'w-loss',               f:(w)=>drop(w,['w','ʔ','h'])},
  {n:'glottal hardening',    f:(w)=>map(w,{h:'x',ʔ:'k'})},
  {n:'vowel raising',        f:(w)=>map(w,{a:'o',o:'u',e:'i'})},
  {n:'gemination',           f:(w)=>map(w,{l:'L',r:'R'})},
  {n:'labialisation',        f:(w)=>map(w,{k:'K',g:'B'})},
];
function map(w,m){ return w.map(p=>m[p]||p); }
function inter(w,m){
  return w.map((p,i)=> (i>0&&i<w.length-1&&isV(w[i-1])&&isV(w[i+1])&&m[p])? m[p] : p);
}
function final(w,m){ const o=w.slice(); const i=o.length-1; if(o.length&&m[o[i]]) o[i]=m[o[i]]; return o; }
function initial(w,m){ const o=w.slice(); if(o.length&&m[o[0]]) o[0]=m[o[0]]; return o; }
function beforeFront(w,m){
  return w.map((p,i)=>{ const nx=w[i+1]; return (nx&&'ieEIäü35'.indexOf(nx)>=0&&m[p])? m[p]:p; });
}
function apocope(w){ let o=w.slice(); let vs=0; for(const p of o) if(isV(p)) vs++;
  if(vs>=2&&isV(o[o.length-1])) o.pop(); return o; }
function syncope(w){
  let vs=0; for(const p of w) if(isV(p)) vs++;
  if(vs<3) return w;
  const o=[]; let seen=0;
  for(let i=0;i<w.length;i++){
    if(isV(w[i])){ seen++;
      if(seen===2 && i>0 && i<w.length-1 && !isV(w[i-1]) && !isV(w[i+1])) continue; }
    o.push(w[i]);
  }
  return o;
}
function nasalLoss(w){
  const o=[];
  for(let i=0;i<w.length;i++){
    if((w[i]==='n'||w[i]==='m'||w[i]==='N') && i>0 && isV(w[i-1]) && i<w.length-1 && !isV(w[i+1])){
      const L={a:'A',e:'E',i:'I',o:'O',u:'U'};
      if(L[o[o.length-1]]) o[o.length-1]=L[o[o.length-1]];
      continue;
    }
    o.push(w[i]);
  }
  return o;
}
function declust(w){
  const o=[];
  for(let i=0;i<w.length;i++){
    if(i<w.length-1 && !isV(w[i]) && !isV(w[i+1]) && (i===0||isV(w[i-1]))) continue;
    o.push(w[i]);
  }
  return o.length? o : w;
}
function prothesis(w){ return (!isV(w[0]) && w.length>1 && !isV(w[1]))? ['e'].concat(w) : w; }
function drop(w,set){ const o=w.filter(p=>set.indexOf(p)<0); return o.length? o : w; }

/* ------------------------------------------------------------- romanisation */
function romanize(ph,w){
  let s='';
  for(let i=0;i<w.length;i++){
    const p=w[i];
    const e=CMAP[p]||VMAP[p];
    if(!e){ s+=p; continue; }
    let v=e.r[Math.min(ph.romStyle,e.r.length-1)];
    if(v===''&&s==='') v=e.r[0]||'';
    s+=v;
  }
  s=s.replace(/([bcdfghjklmnpqrstvwxyz])\1\1+/gi,'$1$1');
  s=s.replace(/^-+|-+$/g,'');
  return s;
}
function capWord(s){ return s? s.charAt(0).toUpperCase()+s.slice(1) : s; }

/* --------------------------------------------------------------- Language   */
let LANGS=[];
class Language {
  constructor(id,seed,parent,name){
    this.id=id; this.parent=parent? parent.id : -1;
    this.family = parent? parent.family : id;
    this.depth = parent? parent.depth+1 : 0;
    this.laws = [];
    this.rng = stream(seed,'lang'+id);
    const r=this.rng;
    if(parent){
      this.ph = Object.assign({},parent.ph);
      this.ph.romStyle = chance(r,0.45)? ri(r,0,2) : parent.ph.romStyle;
      const nlaw=ri(r,2,4);
      const used={};
      for(let k=0;k<nlaw;k++){
        const L=pick(r,LAWS); if(used[L.n]) continue; used[L.n]=1; this.laws.push(L);
      }
      this.lex={};
      for(const c of CONCEPTS){
        let w=parent.lex[c]? parent.lex[c].slice() : genWord(this.ph,r);
        for(const L of this.laws) w=L.f(w);
        if(!w.length) w=genWord(this.ph,r);
        this.lex[c]=w;
      }
      /* lexical innovation: a share of roots are simply replaced */
      const innov=rf(r,0.06,0.20);
      for(const c of CONCEPTS) if(chance(r,innov)) this.lex[c]=genWord(this.ph,r);
    }else{
      this.ph=makePhonology(r);
      this.lex={};
      for(const c of CONCEPTS) this.lex[c]=genWord(this.ph,r);
    }
    /* morphology */
    this.aff={
      place: genWord(this.ph,r,1,1),
      folk:  genWord(this.ph,r,1,1),
      gen:   genWord(this.ph,r,1,1),
      son:   genWord(this.ph,r,1,1),
      dau:   genWord(this.ph,r,1,1),
      land:  this.lex.land.slice()
    };
    this.headFirst = chance(r,0.45);
    this.linker = chance(r,0.4)? [pick(r,this.ph.vows)] : [];
    this.name = name || capWord(romanize(this.ph,this.lex.word.concat(this.aff.folk)));
    this.used = Object.create(null);
  }
  w(c){ return this.lex[c] || (this.lex[c]=genWord(this.ph,this.rng)); }
  say(c){ return capWord(romanize(this.ph,this.w(c))); }
  /* compose morphemes into one word; returns {t:text, g:gloss}.
     Compounds clip their elements the way real ones do — nobody says
     "Aethelbeorhtingaham" twice.                                          */
  compose(parts,opts){
    opts=opts||{};
    if(parts.length>2) parts=parts.slice(0,2);
    const seq = this.headFirst? parts.slice() : parts.slice().reverse();
    const budget = seq.length>=2? 2 : 3;
    let w=[];
    for(let i=0;i<seq.length;i++){
      if(i) w=w.concat(this.linker);
      let m=this.w(seq[i]);
      if(seq.length>=2) m=clipSyl(m, i===seq.length-1? budget : budget-1+1);
      w=w.concat(m);
    }
    if(opts.suffix) w=w.concat(clipSyl(this.aff[opts.suffix],1));
    /* no three consonants in a row, and never end on a cluster */
    const out=[]; let run=0;
    for(const p of w){
      if(!isV(p)){ run++; if(run>2) continue; } else run=0;
      out.push(p);
    }
    while(out.length>2 && !isV(out[out.length-1]) && !isV(out[out.length-2])) out.pop();
    let t=capWord(romanize(this.ph,out));
    if(t.length>13){ t=trimTo(t,12); }
    const gl=parts.map(p=>CN[p]||p);
    return {t, g: glossOf(gl,opts.suffix)};
  }
  unique(parts,opts){
    let c=this.compose(parts,opts);
    let n=0;
    const ADJ=['Great','Old','New','High','Low','Far','Little','Black','White','Red','Fair','Upper','Nether','East','West'];
    while(this.used[c.t] && n<8){
      const a=ADJ[n%ADJ.length];
      c={t:a+' '+c.t, g:a.toLowerCase()+' '+c.g};
      if(!this.used[c.t]) break;
      c=this.compose(parts,opts); n++;
    }
    if(this.used[c.t]){ c.t=c.t+' '+roman((n%9)+2); }
    this.used[c.t]=1;
    return c;
  }
}
/* keep the first n syllables of a phoneme sequence */
function clipSyl(w,n){
  let v=0, end=w.length;
  for(let i=0;i<w.length;i++){
    if(isV(w[i])){ v++; if(v>n){ end=i; break; } }
  }
  if(end<w.length){
    /* carry one closing consonant if there is one */
    let e=end;
    while(e<w.length && !isV(w[e]) && e-end<1) e++;
    return w.slice(0,e);
  }
  return w;
}
/* trim a romanised string back to a vowel boundary */
function trimTo(t,n){
  let s=t.slice(0,n);
  const m=s.match(/^(.*[aeiouyáéíóúäöüāēīōū])[^aeiouyáéíóúäöüāēīōū]{0,2}/i);
  return m? m[0] : s;
}
function glossOf(parts,suffix){
  const sfx = suffix==='place'? '-place' : suffix==='folk'? '-folk' : '';
  if(parts.length===1) return parts[0]+sfx;
  const head=parts[parts.length-1], mods=parts.slice(0,-1);
  return mods.join('-')+' '+head+sfx;
}

function langFamilies(seed,nRoots,nLeaves){
  LANGS=[];
  const r=stream(seed,'langtree');
  const roots=[];
  for(let i=0;i<nRoots;i++){ const L=new Language(LANGS.length,seed,null); LANGS.push(L); roots.push(L); }
  /* grow the tree until we have enough leaves */
  let frontier=roots.slice();
  while(LANGS.length<nLeaves){
    const p=pick(r,frontier);
    const kids=ri(r,2,3);
    const nk=[];
    for(let k=0;k<kids && LANGS.length<nLeaves;k++){
      const L=new Language(LANGS.length,seed,p); LANGS.push(L); nk.push(L);
    }
    frontier=frontier.filter(x=>x!==p||chance(r,0.2)).concat(nk);
    if(!frontier.length) frontier=LANGS.slice();
  }
  return LANGS;
}

/* -------------------------------------------------- geography -> toponym    */
/* What does this land look like to the people who name it?                    */
function tileConcepts(i){
  const out=[];
  const b=T.biome[i], al=T.alt[i], t=T.temp[i], p=T.rain[i];
  switch(b){
    case B_TAIGA: out.push('pine'); break;
    case B_TFOREST: out.push(T.temp[i]<10?'birch':'oak'); break;
    case B_TRAINFOREST: out.push('fern'); break;
    case B_JUNGLE: case B_MONSOON: out.push('palm'); break;
    case B_STEPPE: out.push('grass'); break;
    case B_PRAIRIE: out.push('field'); break;
    case B_SHRUB: out.push(T.temp[i]>17?'olive':'thorn'); break;
    case B_DESERT: out.push('sand'); break;
    case B_COLDDESERT: out.push('waste'); break;
    case B_SAVANNA: out.push('grass'); break;
    case B_MARSH: case B_BOG: out.push('reed'); break;
    case B_MANGROVE: out.push('reed'); break;
    case B_TUNDRA: out.push('moss'); break;
    case B_BARREN: case B_ALPINE: out.push('stone'); break;
    case B_GLACIER: out.push('ice'); break;
    case B_VOLCANIC: out.push('ash'); break;
    case B_SALT: out.push('salt'); break;
    case B_BADLAND: out.push('crag'); break;
  }
  if(al>0.55) out.push('peak'); else if(al>0.34) out.push('mount');
  else if(al>0.18) out.push('hill'); else if(al>0.02) out.push('vale');
  if(T.flow[i]>0) out.push('river');
  if(T.lake[i]) out.push('mere');
  if(T.coast[i]) out.push(T.harbor[i]>0.5?'harbor':'shore');
  if(T.pass[i]) out.push('pass');
  /* climate words are a last resort: they are true of half the map */
  if(out.length<2){
    if(t<-2) out.push('cold'); else if(t>25) out.push('warm');
    if(p>2200) out.push('rain'); else if(p<200) out.push('sand');
  }
  if(T.ley[i]>1.0) out.push('spirit');
  if(T.scar[i]) out.push('shadow');
  if(T.defen[i]>0.55) out.push('crag');
  const rr=T.res[i];
  if(rr===R_IRON) out.push('iron'); else if(rr===R_GOLD) out.push('gold_m');
  else if(rr===R_SILVER) out.push('silver_m'); else if(rr===R_SALT) out.push('salt');
  else if(rr===R_GEMS) out.push('gem'); else if(rr===R_TIMBER) out.push('forest');
  else if(rr===R_HORSES) out.push('horse'); else if(rr===R_VINES) out.push('vine');
  else if(rr===R_COPPER) out.push('copper');
  return out;
}
const HEADS_SETTLE=['fort','town','hall','keep','tower','market','house','bridge','gate','harbor','well','mill','city'];
function nameSettlement(lang,i,r,tier){
  const facts=tileConcepts(i);
  const parts=[];
  const nf=Math.min(facts.length, chance(r,0.30)?2:1);
  const chosen=sampleK(r,facts,Math.max(1,nf));
  for(const c of chosen) parts.push(c);
  if(parts.length<2&&chance(r,0.34)) parts.unshift(pick(r,['great','old','new','high','black','white','red','gold','grey','fair','far','holy','little','bright','dark','green']));
  let head=null;
  if(chance(r,0.55)){
    head = T.harbor[i]>0.55? pick(r,['harbor','market','gate','town'])
         : T.defen[i]>0.5?  pick(r,['fort','keep','tower','wall'])
         : pick(r,HEADS_SETTLE);
    parts.push(head);
  }
  const opts = head? {} : {suffix: chance(r,0.5)?'place':null};
  return lang.unique(parts.slice(0,2),opts);
}
function nameRegion(lang,i,r){
  const facts=tileConcepts(i);
  const parts=sampleK(r,facts,Math.min(2,facts.length));
  if(!parts.length) parts.push('land');
  return lang.unique(parts,{suffix:chance(r,0.6)?'place':null});
}
function namePerson(lang,r,fem){
  const a=pick(r,NAME_A);
  if(chance(r,0.62)){
    const b=pick(r,NAME_B);
    const c=lang.compose([a,b]);
    return {t:c.t, g:c.g};
  }
  const c=lang.compose([a]);
  let t=c.t;
  if(fem&&chance(r,0.6)) t = t + romanize(lang.ph,[pick(r,lang.ph.vows)]);
  return {t:capWord(t), g:c.g};
}
function nameDynasty(lang,r,seatName){
  if(seatName&&chance(r,0.45)) return {t:seatName, g:'of '+seatName};
  const a=pick(r,NAME_A), b=pick(r,['house','hall','blood','kin','crown','banner','tower','stone','ring','oath']);
  const c=lang.compose([a,b]);
  return c;
}
