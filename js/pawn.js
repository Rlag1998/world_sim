// pawn.js — people (colonists, raiders, visitors, prisoners) and animals.
// Needs, mood & thoughts, skills, body-part health, aging, pregnancy.

const BODY_PARTS = {
  head: { max: 26, vital: true, hitW: 7 },
  eyes: { max: 8, hitW: 2 },
  torso: { max: 42, vital: true, hitW: 38 },
  lArm: { max: 22, limb: true, hitW: 13 },
  rArm: { max: 22, limb: true, hitW: 13 },
  lLeg: { max: 22, limb: true, hitW: 13 },
  rLeg: { max: 22, limb: true, hitW: 13 },
};
const PART_KEYS = Object.keys(BODY_PARTS);
const PART_LABEL = { head: 'head', eyes: 'eye', torso: 'chest', lArm: 'left arm', rArm: 'right arm', lLeg: 'left leg', rLeg: 'right leg' };

const BLEED_RATE = { cut: 0.7, gunshot: 1.0, bite: 0.85, stab: 0.9, bruise: 0.05, burn: 0.15, frost: 0, arrow: 0.8 };

const SKIN_TONES = ['#f2d3b3', '#e8bb95', '#d9a066', '#b97a45', '#8d5a2b', '#6b4423', '#f7e0c8'];
const HAIR_COLORS = ['#2b2118', '#453022', '#6b4a2f', '#8a6338', '#b58a4e', '#c9a86a', '#4a4a52', '#8c8c94', '#a63c2e', '#d4d4c8'];

class Pawn {
  constructor() { /* fields assigned in make/load */ }

  static make(world, opts = {}) {
    const rng = world.rng;
    const p = new Pawn();
    p.id = U.uid();
    p.thing = 'pawn';
    p.faction = opts.faction || 'colony';
    p.gender = opts.gender || (rng.chance(0.06) ? 'nb' : rng.chance(0.5) ? 'm' : 'f');
    p.name = opts.name || Names.pawnName(rng, p.gender);
    // some arrive already grey — elders make deathbed arcs and grandparents possible
    const years = opts.age != null ? opts.age : (rng.chance(0.18) ? rng.ri(55, 68) : rng.ri(19, 52));
    p.ageDays = Math.round(years * world.daysPerYear);
    p.skin = rng.ri(0, SKIN_TONES.length - 1);
    p.hair = { color: rng.ri(0, HAIR_COLORS.length - 1), style: rng.ri(0, 4) };
    p.childhood = rng.pick(BACKSTORIES.child);
    p.adulthood = years >= 18 ? rng.pick(BACKSTORIES.adult) : null;

    // Traits: 2, sometimes 3, biased by backstory
    p.traits = [];
    const biases = [...(p.childhood.bias || []), ...((p.adulthood && p.adulthood.bias) || [])];
    for (const b of biases) if (rng.chance(0.4) && !p.traits.includes(b)) p.traits.push(b);
    while (p.traits.length < (rng.chance(0.3) ? 3 : 2)) {
      const t = rng.pick(TRAIT_KEYS);
      if (p.traits.includes(t)) continue;
      // avoid direct contradictions
      const conflict = { optimist: 'pessimist', pessimist: 'optimist', sanguine: 'depressive', depressive: 'sanguine',
        hardworker: 'lazy', lazy: 'hardworker', jogger: 'slowpoke', slowpoke: 'jogger', kind: 'abrasive', abrasive: 'kind',
        magnetic: 'offputting', offputting: 'magnetic', ironwilled: 'volatile', volatile: 'ironwilled' }[t];
      if (conflict && p.traits.includes(conflict)) continue;
      p.traits.push(t);
    }
    p.traits = p.traits.slice(0, 3);

    // Skills from backstory + noise; passions
    p.skills = {};
    for (const s of SKILLS) {
      let lv = Math.max(0, Math.round(rng.gauss(3.2, 2.2)));
      lv += (p.childhood.sk && p.childhood.sk[s]) || 0;
      lv += (p.adulthood && p.adulthood.sk && p.adulthood.sk[s]) || 0;
      lv = U.clamp(lv, 0, 13);
      let pas = 0;
      if (lv >= 5 && rng.chance(0.45)) pas = 1;
      if (lv >= 7 && rng.chance(0.25)) pas = 2;
      p.skills[s] = { lv, pas, xp: 0 };
    }
    p.disables = new Set([...(p.childhood.ban || []), ...((p.adulthood && p.adulthood.ban) || [])]);

    p.needs = { food: rng.rf(0.7, 0.95), rest: rng.rf(0.7, 0.95), rec: rng.rf(0.5, 0.9) };
    p.thoughts = [];
    p.mood = 55;
    p.parts = {};
    for (const k of PART_KEYS) p.parts[k] = { hp: BODY_PARTS[k].max };
    p.injuries = [];
    p.diseases = [];
    p.lostParts = [];
    p.blood = 1; p.pain = 0;
    p.dead = false; p.downed = false;
    p.x = opts.x != null ? opts.x : world.map.home.x;
    p.y = opts.y != null ? opts.y : world.map.home.y;
    p.px = p.x; p.py = p.y; p.facing = 1;
    p.job = null; p.path = null; p.carry = null;
    p.mode = 'normal'; p.breaking = null;
    p.weapon = opts.weapon || null;
    p.apparel = opts.apparel || 'clothes';
    p.ops = {};             // opinions of others: id -> number
    p.loverId = null; p.spouseId = null;
    p.family = { mo: null, fa: null, kids: [] };
    p.bondedPet = null;
    p.prisoner = false; p.recruit = 0; p.resist = rng.ri(10, 55);
    p.pregnant = null;
    p.story = [];
    p.deadCause = null;
    p.joinedDay = world.day;
    p.stats = { kills: 0, raidsFought: 0, tended: 0, crafted: 0, harvests: 0 };
    p.inspired = null;
    p.roles = null;         // work priorities, set by overseer
    p.lastAte = null; p.mealStreak = 0;
    p.moodTick = 0;
    return p;
  }

  static makeBaby(world, mother, father) {
    const rng = world.rng;
    const p = Pawn.make(world, { faction: 'colony', age: 0, x: mother.x, y: mother.y });
    p.name = { first: Names.pawnFirst(rng, p.gender), last: (father || mother).name.last, nick: null };
    // inherit looks
    p.skin = rng.chance(0.5) ? mother.skin : (father ? father.skin : mother.skin);
    p.hair.color = rng.chance(0.5) ? mother.hair.color : (father ? father.hair.color : mother.hair.color);
    if (rng.chance(0.6)) p.hair.style = rng.chance(0.5) ? mother.hair.style : (father ? father.hair.style : mother.hair.style);
    // sometimes inherit a parent trait — and remember whose, for the gossip
    p.traits = [];
    const pool = [...mother.traits, ...(father ? father.traits : [])];
    if (pool.length && rng.chance(0.6)) {
      const t = rng.pick(pool);
      p.traits.push(t);
      p.heirloom = { t, from: mother.traits.includes(t) ? mother.id : (father ? father.id : mother.id) };
    }
    while (p.traits.length < 2) {
      const t = rng.pick(TRAIT_KEYS);
      if (!p.traits.includes(t)) p.traits.push(t);
    }
    // passions can come down from either parent
    for (const s of SKILLS) {
      const inherited = Math.max(mother.skills[s].pas, father ? father.skills[s].pas : 0);
      p.skills[s] = { lv: 0, pas: inherited && rng.chance(0.45) ? Math.min(inherited, rng.chance(0.3) ? 2 : 1) : 0, xp: 0 };
    }
    p.childhood = { key: 'colonyborn', n: 'Colony child', d: `was born at {colony}, under the open sky of the rim`, sk: {}, bias: [] };
    p.adulthood = null;
    p.disables = new Set();
    p.family = { mo: mother.id, fa: father ? father.id : null, kids: [] };
    mother.family.kids.push(p.id);
    if (father) father.family.kids.push(p.id);
    return p;
  }

  // ---- identity ----------------------------------------------------------
  label() { return this.name.nick || this.name.first; }
  full() { return this.name.first + (this.name.nick ? ` "${this.name.nick}"` : '') + ' ' + this.name.last; }
  get he() { return this.gender === 'm' ? 'he' : this.gender === 'f' ? 'she' : 'they'; }
  get him() { return this.gender === 'm' ? 'him' : this.gender === 'f' ? 'her' : 'them'; }
  get his() { return this.gender === 'm' ? 'his' : this.gender === 'f' ? 'her' : 'their'; }
  get isVerb() { return this.gender === 'nb' ? 'are' : 'is'; }
  get was() { return this.gender === 'nb' ? 'were' : 'was'; }
  ageYears(world) { return Math.floor(this.ageDays / world.daysPerYear); }
  stage(world) {
    const y = this.ageYears(world);
    if (y < 2) return 'baby';
    if (y < BAL.workAt) return 'toddler';
    if (y < BAL.adultAt) return 'child';
    return 'adult';
  }
  isColonist() { return this.faction === 'colony' && !this.prisoner && !this.dead; }
  hasTrait(t) { return this.traits.includes(t); }
  canDo(tag) { return !this.disables.has(tag); }
  canFight(world) { return this.canDo('violent') && this.stage(world) === 'adult' && !this.downed; }

  // ---- skills ------------------------------------------------------------
  skill(s) { return this.skills[s] ? this.skills[s].lv : 0; }
  gainXp(world, s, amt) {
    const sk = this.skills[s];
    if (!sk) return;
    const mult = sk.pas === 2 ? 1.8 : sk.pas === 1 ? 1.2 : 0.55;
    sk.xp += amt * mult;
    const need = 600 + sk.lv * 350;
    if (sk.xp >= need && sk.lv < 20) {
      sk.xp = 0; sk.lv++;
      if (sk.lv === 12 || sk.lv === 16) {
        Chron.log(world, `${this.label()} has become ${sk.lv >= 16 ? 'a legendary master' : 'renowned'} at ${s.toLowerCase()}.`, { icon: ICONS.joy, tone: 'good' });
      }
    }
  }
  workSpeed(s) {
    let m = 0.55 + this.skill(s) * 0.075;
    for (const t of this.traits) if (TRAITS[t].work) m *= TRAITS[t].work;
    m *= this.capManip() * 0.5 + 0.5;
    if (this.inspired === 'frenzy') m *= 1.6;
    return m;
  }

  // ---- capacities --------------------------------------------------------
  partPct(k) { return Math.max(0, this.parts[k].hp) / BODY_PARTS[k].max; }
  capMoving() {
    const legs = (this.partPct('lLeg') + this.partPct('rLeg')) / 2;
    return U.clamp(legs * 0.85 + 0.15, 0.05, 1) * this.capConscious();
  }
  capManip() {
    const arms = (this.partPct('lArm') + this.partPct('rArm')) / 2;
    return U.clamp(arms * 0.8 + 0.2, 0.1, 1);
  }
  capSight() { return U.clamp(this.partPct('eyes') * 0.9 + 0.1, 0.15, 1); }
  capConscious() {
    let c = 1 - this.pain * 0.42 - (1 - this.blood) * 1.15;
    for (const d of this.diseases) c -= d.sev * (d.kind === 'plague' ? 0.55 : 0.35);
    if (this.needs.food <= 0) c -= 0.18;
    return U.clamp(c, 0, 1);
  }
  moveSpeed() {
    let base = 1.05 * this.capMoving();
    for (const t of this.traits) if (TRAITS[t].move) base *= 1 + TRAITS[t].move;
    if (this.carry) base *= 0.88;
    if (this.stage(W) === 'child') base *= 0.85;
    if (this.stage(W) === 'toddler') base *= 0.5;
    return Math.max(0.06, base);
  }

  // ---- thoughts & mood ---------------------------------------------------
  addThought(world, key, opts = {}) {
    const def = THOUGHTS[key];
    if (!def) return;
    if (this.hasTrait('detached') && def.m < 0 && ['spouseDied', 'familyDied', 'friendDied', 'colonistDied', 'sawCorpse', 'witnessedDeath'].includes(key)) return;
    const maxStack = def.st || 1;
    const same = this.thoughts.filter(t => t.k === key);
    if (same.length >= maxStack) {
      // refresh oldest
      let oldest = same[0];
      for (const t of same) if (t.end < oldest.end) oldest = t;
      oldest.end = world.t + def.d * BAL.MIN_PER_DAY;
      return;
    }
    this.thoughts.push({ k: key, m: (opts.mult || 1) * def.m, end: world.t + def.d * BAL.MIN_PER_DAY, who: opts.who || null });
    this.moodTick = 0; // force recompute
  }

  recomputeMood(world) {
    let m = BAL.moodBase;
    for (const t of this.traits) m += TRAITS[t].mood || 0;
    // needs states
    if (this.needs.food < 0.25) m -= this.needs.food <= 0 ? 16 : 6;
    if (this.needs.rest < 0.22) m -= this.needs.rest <= 0 ? 10 : 5;
    if (this.needs.rec < 0.25) m -= 7;
    else if (this.needs.rec > 0.85) m += 4;
    if (this.hasTrait('gourmand') && this.needs.food < 0.45) m -= 5;
    // pain & sickness
    m -= this.pain * 26;
    for (const d of this.diseases) m -= 6 + d.sev * 8;
    // environment (sampled cheaply)
    const room = world.map.roomAt(Math.round(this.x), Math.round(this.y));
    if (room) {
      if (room.beauty > 4) m += 4; else if (room.beauty < -2) m -= 3;
      if (this.hasTrait('ascetic') && room.beauty > 4) m -= 6;
      if (this.hasTrait('greedy') && room.kind === 'bedroom' && room.beauty < 3) m -= 4;
    }
    const temp = Sim.tempAt(world, this);
    const ins = APPAREL[this.apparel] ? APPAREL[this.apparel].ins : 2;
    if (temp < BAL.tempComfyLo - ins) m -= Math.min(14, (BAL.tempComfyLo - ins - temp) * 1.1);
    if (temp > BAL.tempComfyHi + ins * 0.4) m -= Math.min(12, (temp - BAL.tempComfyHi - ins * 0.4) * 1.0);
    // thoughts
    for (const t of this.thoughts) m += t.m;
    // expecting
    if (this.pregnant) m += 4;
    this.mood = U.clamp(Math.round(m), 0, 100);
    return this.mood;
  }

  tickThoughts(world) {
    for (let i = this.thoughts.length - 1; i >= 0; i--) {
      if (this.thoughts[i].end <= world.t) this.thoughts.splice(i, 1);
    }
  }

  breakThreshold(kind) {
    let minor = BAL.breakMinor, major = BAL.breakMajor, extreme = BAL.breakExtreme;
    let shift = 0;
    for (const t of this.traits) shift += TRAITS[t].brk || 0;
    minor += shift; major += shift * 0.7; extreme += shift * 0.4;
    return kind === 'minor' ? minor : kind === 'major' ? major : extreme;
  }

  // ---- needs -------------------------------------------------------------
  tickNeeds(world) {
    const asleep = this.job && this.job.type === 'sleep';
    this.needs.food = Math.max(0, this.needs.food - BAL.hungerPerMin * (this.hasTrait('gourmand') ? 1.25 : 1) * (this.stage(world) === 'baby' ? 0.7 : 1));
    if (asleep) {
      const bedQ = this.job.bedQ || 0.8;
      this.needs.rest = Math.min(1, this.needs.rest + BAL.restPerMin * BAL.restRecoverMult * bedQ);
    } else {
      this.needs.rest = Math.max(0, this.needs.rest - BAL.restPerMin);
    }
    if (!asleep) this.needs.rec = Math.max(0, this.needs.rec - BAL.recPerMin * (this.stage(world) === 'adult' ? 1 : 1.4));
    if (this.moodTick-- <= 0) { this.tickThoughts(world); this.recomputeMood(world); this.moodTick = 10; }
  }

  // ---- health ------------------------------------------------------------
  pickHitPart(world, kind) {
    let total = 0;
    for (const k of PART_KEYS) total += BODY_PARTS[k].hitW;
    const roll = world.rng.r() * total;
    let acc = 0;
    for (const k of PART_KEYS) {
      acc += BODY_PARTS[k].hitW;
      if (roll < acc) return k;
    }
    return 'torso';
  }

  applyDamage(world, amount, kind, srcLabel, opts = {}) {
    if (this.dead) return null;
    if (this.hasTrait('tough')) amount *= 0.75;
    if (this.hasTrait('wimp')) amount *= 1.1;
    const armor = APPAREL[this.apparel] ? APPAREL[this.apparel].armor : 0;
    if (['gunshot', 'cut', 'stab', 'bite', 'arrow'].includes(kind)) amount *= (1 - armor);
    amount = Math.max(1, Math.round(amount));
    this.staggerUntil = world.t + 4; // getting hit stops a charge cold
    const part = opts.part || this.pickHitPart(world, kind);
    const inj = { part, kind, sev: amount, bleed: (BLEED_RATE[kind] || 0.3) * amount * 0.0062, tended: false, tendQ: 0, t: world.t };
    this.injuries.push(inj);
    this.parts[part].hp -= amount;
    if (this.parts[part].hp <= 0) {
      this.parts[part].hp = 0;
      if (BODY_PARTS[part].vital) {
        this.die(world, `${kind === 'burn' ? 'burned to death' : 'died of a ' + PART_LABEL[part] + ' wound'}`, srcLabel);
        return inj;
      }
      if (!this.lostParts.includes(part)) {
        this.lostParts.push(part);
        this.injuries = this.injuries.filter(i2 => i2.part !== part || i2 === inj);
        inj.bleed *= 2.2;
        Chron.log(world, `${this.label()} lost ${this.his} ${PART_LABEL[part]}${srcLabel ? ' to ' + srcLabel : ''}.`, { icon: ICONS.bad, tone: 'bad', major: this.isColonist() });
        this.addStory(world, `Lost ${this.his} ${PART_LABEL[part]}${srcLabel ? ' to ' + srcLabel : ''}`);
        // scars earn names on the rim
        if (part === 'eyes' && this.isColonist() && !this.name.nick && world.rng.chance(0.6)) {
          this.name.nick = world.rng.pick(['One-Eye', 'Patch', 'Wink']);
          Chron.log(world, `The colony has started calling ${this.him} "${this.name.nick}". ${U.cap(this.he)} pretends to mind.`, { icon: '🏷️', tone: 'neutral' });
        }
      }
    }
    this.recomputePain();
    this.checkDowned(world, srcLabel);
    if (world.map.inb(Math.round(this.x), Math.round(this.y)) && (BLEED_RATE[kind] || 0) > 0.4) {
      world.map.addFilth(Math.round(this.x), Math.round(this.y), 22);
    }
    return inj;
  }

  recomputePain() {
    let pain = 0;
    for (const inj of this.injuries) pain += inj.sev * (inj.tended ? 0.55 : 1) * 0.012;
    for (const d of this.diseases) pain += d.sev * 0.25;
    if (this.hasTrait('wimp')) pain *= 1.7;
    if (this.hasTrait('tough')) pain *= 0.7;
    this.pain = U.clamp(pain, 0, 1);
  }

  bleedRate() {
    let b = 0;
    for (const inj of this.injuries) if (!inj.tended) b += inj.bleed;
    return b;
  }

  checkDowned(world, srcLabel) {
    if (this.dead) return;
    const wasDowned = this.downed;
    const legsGone = this.partPct('lLeg') <= 0 && this.partPct('rLeg') <= 0;
    // pain downs a body long before wounds kill it — most fights end in collapse, not death
    this.downed = this.capConscious() < 0.28 || legsGone || this.blood < 0.5 || this.pain >= 0.6;
    if (this.downed && !wasDowned) {
      this.job = null; this.path = null;
      if (this.carry) { Things.drop(world, Math.round(this.x), Math.round(this.y), this.carry.kind, this.carry.qty, this.carry.meta); this.carry = null; }
      if (this.isColonist()) {
        Chron.log(world, `${this.label()} is down${srcLabel ? ` — ${srcLabel} did it` : ''}!`, { icon: ICONS.bad, tone: 'bad', major: true, at: this });
      } else if ((this.faction === 'pirate' || this.faction === 'tribe') && this.weapon && this.weapon !== 'fists') {
        // dropped where they fell — the colony armory grows on victories
        Things.drop(world, Math.round(this.x), Math.round(this.y), 'weaponItem', 1, { key: this.weapon });
        this.weapon = null;
      }
    }
    if (!this.downed && wasDowned) this.downed = false;
  }

  // hourly health processes
  tickHealthHourly(world) {
    // bleeding
    const bleed = this.bleedRate();
    if (bleed > 0) {
      this.blood = Math.max(0, this.blood - bleed);
      if (this.blood <= 0.15) { this.die(world, 'bled out'); return; }
    } else {
      this.blood = Math.min(1, this.blood + 0.02);
    }
    // wounds heal / clot / get infected
    for (let i = this.injuries.length - 1; i >= 0; i--) {
      const inj = this.injuries[i];
      if (!inj.tended) {
        // the downed curl around their wounds: pressure, cloth, stubbornness
        inj.bleed *= this.downed ? 0.88 : 0.955;
        if (inj.sev < 3.5) inj.bleed = 0;   // small wounds close on their own
        if (this.downed && world.t - inj.t > 130 && this.capConscious() > 0.22) {
          inj.tended = true; inj.tendQ = 0.22; // packed their own wound, badly but enough
          if (this.isColonist() && world.rng.chance(0.25)) {
            Chron.log(world, `${this.label()}, flat in the dirt, packed ${this.his} own wounds with ${world.rng.pick(['torn cloth', 'moss and spit', 'a sleeve and swearing'])}. Not dead yet.`, { icon: '🩸', tone: 'neutral' });
          }
        }
      }
      const healRate = inj.tended ? 0.5 + inj.tendQ * 0.8 : (inj.sev <= 4 ? 0.25 : 0.06);
      inj.sev -= healRate / 10;
      this.parts[inj.part].hp = Math.min(BODY_PARTS[inj.part].max, this.parts[inj.part].hp + healRate / 10);
      if (inj.sev <= 0) {
        if (!inj.tended && inj.kind !== 'bruise' && world.rng.chance(0.12)) {
          this.scars = this.scars || [];
          this.scars.push(PART_LABEL[inj.part]);
        }
        this.injuries.splice(i, 1);
      } else if (!inj.tended && inj.sev > 5 && world.rng.chance(BAL.infectChance / 24)) {
        inj.tended = true; inj.tendQ = 0.2; // stop double infections from same wound
        this.addDisease(world, 'infection');
      }
    }
    // diseases race: severity vs immunity
    for (let i = this.diseases.length - 1; i >= 0; i--) {
      const d = this.diseases[i];
      const inBed = this.job && (this.job.type === 'patient' || this.job.type === 'sleep');
      const sevRate = { flu: 0.021, plague: 0.037, infection: 0.030, gutworms: 0.004, foodPoison: 0.004 }[d.kind] || 0.01;
      if (d.kind === 'foodPoison') d.imm += 0.03; // passes quickly
      const immRate = (0.022 + (inBed ? 0.014 : 0) + d.tendQ * 0.02) * (this.stage(world) === 'adult' ? 1 : 0.8);
      d.sev = Math.min(1, d.sev + sevRate * world.rng.rf(0.7, 1.3));
      d.imm = Math.min(1, d.imm + immRate * world.rng.rf(0.8, 1.2));
      d.tendQ = Math.max(0, d.tendQ - 0.03); // tending wears off
      if (d.imm >= 1) {
        this.diseases.splice(i, 1);
        if (this.isColonist()) Chron.log(world, `${this.label()} has recovered from ${({flu:'the flu',plague:'the plague',infection:'the infection',gutworms:'the gut worms',foodPoison:'the food poisoning'})[d.kind] || d.kind}.`, { icon: ICONS.heal, tone: 'good' });
        continue;
      }
      if (d.sev >= 1 && d.kind !== 'gutworms' && d.kind !== 'foodPoison') { this.die(world, `succumbed to ${({flu:'the flu',plague:'the plague',infection:'infection'})[d.kind] || d.kind}`); return; }
    }
    // starvation (visitors and raiders carry their own rations off-screen)
    if (this.needs.food <= 0 && (this.faction === 'colony' || this.prisoner)) {
      this.applyDamage(world, BAL.starveDmgPerHour, 'bruise', 'starvation', { part: 'torso' });
      if (this.parts.torso.hp <= 6 && !this.dead) this.die(world, 'starved to death');
    }
    // pregnancy
    if (this.pregnant && world.day >= this.pregnant.due) {
      Social.giveBirth(world, this);
    }
    // elderly risks
    const years = this.ageYears(world);
    if (years >= BAL.oldAge && world.rng.chance(0.0005 * (years - BAL.oldAge + 1))) {
      this.addDisease(world, 'infection'); // failing body
      Chron.log(world, `${this.label()} (${years}) has fallen gravely ill. Age comes for everyone, even on the rim.`, { icon: ICONS.sick, tone: 'bad', major: true });
    }
    this.recomputePain();
    this.checkDowned(world);
  }

  addDisease(world, kind) {
    if (this.diseases.some(d => d.kind === kind)) return;
    this.diseases.push({ kind, sev: 0.08, imm: 0, tendQ: 0 });
    if (this.isColonist()) {
      Chron.log(world, `${this.label()} has come down with ${({flu:'the flu',plague:'the plague',infection:'an infection',gutworms:'gut worms',foodPoison:'food poisoning'})[kind] || kind}.`, { icon: ICONS.sick, tone: 'bad', major: kind === 'plague', at: this });
    }
  }

  needsTending() {
    return this.injuries.some(i => !i.tended && i.sev > 2) || this.diseases.some(d => d.tendQ < 0.25 && d.imm < 1);
  }

  // ---- eat / equip -------------------------------------------------------
  eat(world, itemKind) {
    const def = ITEMS[itemKind];
    if (!def || !def.food) return;
    this.needs.food = Math.min(1, this.needs.food + def.food);
    if (itemKind === 'mealFine') this.addThought(world, 'ateFine');
    if (def.raw) this.addThought(world, 'ateRawFood');
    if (this.lastAte === itemKind && !def.raw) {
      this.mealStreak++;
      if (this.mealStreak >= 4) this.addThought(world, 'mealMonotony');
    } else this.mealStreak = 0;
    this.lastAte = itemKind;
  }

  weaponDef() { return WEAPONS[this.weapon || 'fists']; }

  // ---- story & death -----------------------------------------------------
  addStory(world, text) {
    this.story.push({ day: world.day, text });
    if (this.story.length > 60) this.story.shift();
  }

  die(world, cause, srcLabel) {
    if (this.dead) return;
    this.dead = true;
    this.deadCause = cause + (srcLabel ? ` (${srcLabel})` : '');
    this.job = null; this.path = null;
    if (this.carry) { Things.drop(world, Math.round(this.x), Math.round(this.y), this.carry.kind, this.carry.qty, this.carry.meta); this.carry = null; }
    Sim.onPawnDied(world, this, cause, srcLabel);
  }
}

// ---- Animals --------------------------------------------------------------
class Animal {
  static make(world, species, x, y, opts = {}) {
    const a = new Animal();
    const def = ANIMALS[species];
    a.id = U.uid();
    a.thing = 'animal';
    a.species = species;
    a.name = opts.name || null;      // pets get names
    a.x = x; a.y = y; a.px = x; a.py = y;
    a.hp = def.hp; a.maxHp = def.hp;
    a.tame = !!opts.tame;
    a.manhunter = false;
    a.dead = false; a.downed = false;
    a.target = null; a.path = null;
    a.state = 'wander'; a.stateT = 0;
    a.ownerId = null;
    a.fleeUntil = 0;
    a.gender = world.rng.chance(0.5) ? 'm' : 'f';
    return a;
  }
  label() { return this.name ? this.name : ANIMALS[this.species].n; }
  def() { return ANIMALS[this.species]; }
  applyDamage(world, amount, kind, srcLabel) {
    if (this.dead) return;
    this.hp -= amount;
    this.staggerT = world.t + 4;
    world.map.addFilth(Math.round(this.x), Math.round(this.y), 10);
    if (this.hp <= 0) {
      this.dead = true;
      Sim.onAnimalDied(world, this, srcLabel);
    } else if (this.hp < this.maxHp * 0.35 && !this.manhunter && !this.tame) {
      this.state = 'flee'; this.fleeUntil = world.t + 600;
    }
  }
}

Object.assign(globalThis, { Pawn, Animal, BODY_PARTS, PART_KEYS, PART_LABEL, SKIN_TONES, HAIR_COLORS });
