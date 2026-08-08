// storyteller.js — the invisible director. Decides when something happens and what,
// balancing drama against mercy so the chronicle stays alive without cheap wipes.

const PERSONAS = {
  chronicler: { n: 'Cassia the Chronicler', d: 'measured arcs of tension and release', gapDays: [1.1, 2.4], threatBias: 1.0, chaos: 0.15 },
  whisper: { n: 'The Whisper', d: 'long quiets broken by heavy blows', gapDays: [1.8, 3.4], threatBias: 1.25, chaos: 0.1 },
  coyote: { n: 'Old Coyote', d: 'pure caprice, feast then famine', gapDays: [0.7, 2.0], threatBias: 0.95, chaos: 0.5 },
};

const Storyteller = {
  init(world) {
    const key = world.rng.pick(Object.keys(PERSONAS));
    world.st = {
      persona: key,
      lastEventT: world.t,
      nextGap: Storyteller.rollGap(world, key),
      cooldowns: {},   // event key -> earliest day it can fire again
      lastKeys: [],
      graceUntil: 0,   // post-disaster mercy window
      calmDays: 0,
    };
  },

  rollGap(world, key) {
    const p = PERSONAS[key || world.st.persona];
    let gap = world.rng.rf(p.gapDays[0], p.gapDays[1]);
    if (world.rng.chance(p.chaos)) gap *= world.rng.rf(0.35, 0.8); // chaos: sudden pile-ups
    return gap * BAL.MIN_PER_DAY;
  },

  colonyState(world) {
    const colonists = world.pawns.filter(p => p.isColonist());
    if (!colonists.length) return { pop: 0, reeling: true, mood: 0, healthy: 0 };
    const downed = colonists.filter(p => p.downed || p.diseases.length > 0).length;
    const mood = colonists.reduce((s, p) => s + p.mood, 0) / colonists.length;
    const food = Things.countFood(world);
    const reeling = downed >= colonists.length * 0.35 || mood < 26 || colonists.length <= 2 || food < colonists.length;
    return { pop: colonists.length, reeling, mood, healthy: colonists.length - downed, food };
  },

  tickHourly(world) {
    const st = world.st;
    if (world.threat) { st.lastEventT = world.t; return; } // don't stack events on a live battle
    if (world.t - st.lastEventT < st.nextGap) return;
    const state = Storyteller.colonyState(world);
    if (!state.pop) return;

    // category weights, adaptive
    const p = PERSONAS[st.persona];
    let wThreat = 34 * p.threatBias, wFortune = 26, wNeutral = 26;
    if (state.reeling) { wThreat = 2; wFortune = 48; }         // mercy
    if (world.t < st.graceUntil) wThreat *= 0.25;              // post-battle breather
    if (state.mood > 62 && st.calmDays > 3) wThreat *= 1.6;    // too comfortable
    if (state.food < state.pop * 1.5) { wFortune *= 1.5; }
    const cat = world.rng.pickw([
      { k: 'threat', w: wThreat }, { k: 'fortune', w: wFortune }, { k: 'neutral', w: wNeutral },
    ], o => o.w).k;

    const candidates = EVENT_DEFS.filter(e => {
      if (e.cat !== cat) return false;
      if ((st.cooldowns[e.key] || 0) > world.day) return false;
      if (st.lastKeys.includes(e.key)) return false;
      return e.w(world) > 0;
    });
    if (!candidates.length) { st.nextGap = BAL.MIN_PER_DAY * 0.3; st.lastEventT = world.t; return; }
    const ev = world.rng.pickw(candidates, e => e.w(world));
    let ok = true;
    try { ok = ev.run(world) !== false; } catch (err) { throw err; }
    st.lastEventT = world.t;
    st.nextGap = Storyteller.rollGap(world);
    if (ok !== false) {
      st.cooldowns[ev.key] = world.day + ev.cd;
      st.lastKeys.push(ev.key);
      if (st.lastKeys.length > 2) st.lastKeys.shift();
      if (ev.cat === 'threat') { st.calmDays = 0; st.graceUntil = world.t + BAL.MIN_PER_DAY * 2; }
    }
  },

  tickDaily(world) {
    world.st.calmDays++;
  },
};

Object.assign(globalThis, { PERSONAS, Storyteller });
