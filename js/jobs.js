// jobs.js — pawn behavior: needs, work scanning by role, job execution, mental breaks.
// decide() picks a job; step() advances it one sim-minute.

const Jobs = {
  // ---- reservations ------------------------------------------------------
  reserve(world, key, p) { world.reservations[key] = p.id; },
  free(world, key) { delete world.reservations[key]; },
  taken(world, key, p) {
    if ((world.tabuMap[key] || 0) > world.t) return true; // recently failed target
    const holder = world.reservations[key];
    if (!holder) return false;
    const other = world.byId[holder];
    if (!other || other.dead || !other.job || other.job.resKey !== key) { delete world.reservations[key]; return false; }
    return holder !== p.id;
  },

  markTabu(world, key, ticks) { if (key) world.tabuMap[key] = world.t + (ticks || 240); },

  endJob(world, p) {
    if (p.job && p.job.resKey) Jobs.free(world, p.job.resKey);
    p.job = null; p.path = null;
  },

  setJob(world, p, job) {
    if (p.job && p.job.resKey) Jobs.free(world, p.job.resKey);
    p.job = job;
    p.path = null;
    if (job && job.resKey) Jobs.reserve(world, job.resKey, p);
  },

  // ---- movement ----------------------------------------------------------
  // Returns 'arrived' | 'moving' | 'stuck'
  advance(world, p, tx, ty, opts) {
    const px = Math.round(p.x), py = Math.round(p.y);
    if (px === tx && py === ty) return 'arrived';
    // only re-path when the goal actually moved meaningfully (chasing) or path spent
    const goalMoved = p.pathGoalX == null || U.dist(p.pathGoalX, p.pathGoalY, tx, ty) > 2.4;
    if (!p.path || !p.path.length || goalMoved) {
      p.path = world.map.path(px, py, tx, ty, world, opts || (p.faction !== 'colony' && p.faction !== 'outlander' ? { hostile: true } : null));
      p.pathGoalX = tx; p.pathGoalY = ty;
      if (!p.path) { if (p.job) Jobs.markTabu(world, p.job.resKey); return 'stuck'; }
    }
    if (!p.path.length) return U.dist(p.x, p.y, tx, ty) <= 2 ? 'arrived' : (p.pathGoalX = null, 'moving');
    // movement progress accumulates across ticks so slow terrain is slow, not impassable
    let budget = p.moveSpeed() + (p.moveProg || 0);
    if ((p.staggerUntil || 0) > world.t) budget *= 0.2; // reeling from a hit
    while (p.path.length) {
      const next = p.path[0];
      const cost = world.map.moveCost(next.x, next.y, world, null);
      if (cost === Infinity) { p.path = null; p.moveProg = 0; if (p.job) Jobs.markTabu(world, p.job.resKey, 60); return 'stuck'; }
      const stepCost = Math.max(0.35, cost) * (next.x !== Math.round(p.x) && next.y !== Math.round(p.y) ? 1.41 : 1);
      if (budget < stepCost) break;
      p.facing = next.x > p.x ? 1 : next.x < p.x ? -1 : p.facing;
      p.x = next.x; p.y = next.y;
      p.path.shift();
      budget -= stepCost;
    }
    p.moveProg = Math.min(budget, 2.5);
    return (Math.round(p.x) === tx && Math.round(p.y) === ty) ? 'arrived' : 'moving';
  },

  adjacentTo(world, p, tx, ty) {
    return Math.abs(Math.round(p.x) - tx) <= 1 && Math.abs(Math.round(p.y) - ty) <= 1;
  },

  // Move adjacent to a target tile (for mining, building on occupied tiles, etc.)
  advanceAdjacent(world, p, tx, ty) {
    if (Jobs.adjacentTo(world, p, tx, ty)) return 'arrived';
    const spot = world.map.findSpotNear(tx, ty, 2, (x, y) => world.map.standable(x, y, world) && (Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1));
    if (!spot) return 'stuck';
    return Jobs.advance(world, p, spot.x, spot.y);
  },

  // ---- decision tree -----------------------------------------------------
  decide(world, p) {
    if (p.dead || p.downed) return;
    const stage = p.stage(world);
    if (stage === 'baby') return;

    // Fire under our feet: flee
    const hereIdx = world.map.idx(Math.round(p.x), Math.round(p.y));
    if (world.map.fireG[hereIdx]) {
      const spot = world.map.findSpotNear(p.x, p.y, 6, (x, y) => world.map.standable(x, y, world) && !world.map.fireG[world.map.idx(x, y)]);
      if (spot) { Jobs.setJob(world, p, { type: 'fleeTo', tx: spot.x, ty: spot.y }); return; }
    }

    // Combat / hiding modes (set by DefenseAI). Even soldiers break for food when
    // the enemy is nowhere near — sieges shouldn't starve the garrison.
    if (p.mode === 'fight' && p.canFight(world)) {
      if (p.needs.food <= 0.25 && !Combat.nearestTarget(world, p, 18)) {
        const j = Jobs.makeEatJob(world, p);
        if (j) { Jobs.setJob(world, p, j); return; }
      }
      Jobs.setJob(world, p, { type: 'combat' });
      return;
    }
    if (p.mode === 'hide') {
      if (p.needs.food < 0.25) { // a dash to the larder mid-siege
        const j = Jobs.makeEatJob(world, p);
        if (j) { Jobs.setJob(world, p, j); return; }
      }
      // even in hiding, someone drags in the wounded and feeds the baby
      const urgent = Jobs.scanUrgent(world, p);
      if (urgent) { Jobs.setJob(world, p, urgent); return; }
      if (p.needs.rest < 0.1) { Jobs.startSleep(world, p); return; }
      const safe = Combat.safeSpot(world, p);
      Jobs.setJob(world, p, { type: 'hideAt', tx: safe.x, ty: safe.y });
      return;
    }

    // Mental break behaviors — but even the broken get hungry
    if (p.breaking) {
      if (p.needs.food < 0.2 && !['berserk', 'leave', 'fire'].includes(p.breaking.kind)) {
        const j = Jobs.makeEatJob(world, p);
        if (j) { Jobs.setJob(world, p, j); return; }
      }
      Jobs.setJob(world, p, { type: 'break_' + p.breaking.kind });
      return;
    }

    // Prisoners (of any faction) pace their cells; other non-colonists have NPC logic
    if (p.prisoner) { Jobs.decidePrisoner(world, p); return; }
    if (p.faction !== 'colony') { Combat.decideNonColonist(world, p); return; }

    // Urgent shared duties come before comfort — and even before nursing one's own
    // lesser wounds: fires, the bleeding, hungry babies.
    if (p.needs.food > 0.08 && p.needs.rest > 0.05 && p.blood > 0.6) {
      const urgent = Jobs.scanUrgent(world, p);
      if (urgent) { Jobs.setJob(world, p, urgent); return; }
    }

    // Patient: seriously hurt colonists take to bed
    if ((p.needsTending() && (p.pain > 0.25 || p.diseases.length)) || p.blood < 0.75) {
      const bed = Jobs.findBedFor(world, p, true);
      if (bed && !Jobs.taken(world, 'bed:' + bed.id, p)) {
        Jobs.setJob(world, p, { type: 'patient', bedId: bed.id, tx: bed.x, ty: bed.y, resKey: 'bed:' + bed.id });
        return;
      }
    }

    // Sleep
    const sleepy = p.needs.rest < BAL.sleepAt;
    if (sleepy || (Jobs.isSleepHour(world, p) && p.needs.rest < 0.92)) { Jobs.startSleep(world, p); return; }

    // Eat
    if (p.needs.food < BAL.eatAt) {
      const j = Jobs.makeEatJob(world, p);
      if (j) { Jobs.setJob(world, p, j); return; }
    }

    // Gatherings trump work
    const g = world.gatherings.find(gg => gg.guests.includes(p.id));
    if (g) { Jobs.setJob(world, p, { type: 'attend', gatherId: g.id }); return; }

    // Doctor duty for the walking wounded ahead of ordinary work
    if (p.roles && p.roles.includes('doctor')) {
      const dj = Jobs.scanners.doctor(world, p);
      if (dj) { Jobs.setJob(world, p, dj); return; }
    }

    // Recreation when depleted
    if (p.needs.rec < 0.22 && stage === 'adult') {
      const j = Jobs.makeJoyJob(world, p);
      if (j) { Jobs.setJob(world, p, j); return; }
    }

    // Work by role priority
    const roles = p.roles || [];
    for (const role of roles) {
      const scanner = Jobs.scanners[role];
      if (!scanner) continue;
      const j = scanner(world, p);
      if (j) { Jobs.setJob(world, p, j); return; }
    }

    // Joy for kids or bored adults
    const j = Jobs.makeJoyJob(world, p);
    if (j && (stage !== 'adult' || p.needs.rec < 0.75)) { Jobs.setJob(world, p, j); return; }

    // Idle: drift near home
    const home = world.map.home;
    const spot = world.map.findSpotNear(home.x + world.rng.ri(-7, 7), home.y + world.rng.ri(-7, 7), 5, (x, y) => world.map.standable(x, y, world));
    Jobs.setJob(world, p, { type: 'wander', tx: spot ? spot.x : home.x, ty: spot ? spot.y : home.y, until: world.t + world.rng.ri(10, 30) });
  },

  isSleepHour(world, p) {
    const h = world.hourOfDay;
    if (p.hasTrait('nightowl')) return h >= 6 && h < 14;
    return h >= 22 || h < 6;
  },

  findBedFor(world, p, medical) {
    // own bed first, else free bed, else null
    let own = null, free = null, freeD = Infinity;
    const wantCrib = p.stage(world) === 'baby' || p.stage(world) === 'toddler';
    for (const b of world.buildings) {
      if (b.blueprint) continue;
      const def = BUILDINGS[b.key];
      if (!def.bed) continue;
      if (!!def.crib !== wantCrib) continue;
      if (!!b.prison !== !!p.prisoner) continue;
      if (b.ownerId === p.id || (def.double && b.owner2Id === p.id)) { own = b; break; }
      if (!b.ownerId && !Jobs.taken(world, 'bed:' + b.id, p)) {
        const d = U.dist(p.x, p.y, b.x, b.y);
        if (d < freeD) { freeD = d; free = b; }
      }
    }
    return own || free;
  },

  startSleep(world, p) {
    const bed = Jobs.findBedFor(world, p, false);
    if (bed) {
      Jobs.setJob(world, p, { type: 'sleep', bedId: bed.id, tx: bed.x, ty: bed.y, resKey: 'bed:' + bed.id, bedQ: BUILDINGS[bed.key].restQ || 0.9 });
    } else {
      // sleep on the ground near home
      const spot = world.map.findSpotNear(world.map.home.x + world.rng.ri(-4, 4), world.map.home.y + world.rng.ri(-4, 4), 6, (x, y) => world.map.standable(x, y, world));
      Jobs.setJob(world, p, { type: 'sleep', tx: spot ? spot.x : Math.round(p.x), ty: spot ? spot.y : Math.round(p.y), bedQ: 0.7, ground: true });
    }
  },

  makeEatJob(world, p) {
    const pref = ['mealFine', 'mealSimple', 'mealPack', 'berries', 'rawVeg', 'rawMeat'];
    for (const kind of pref) {
      const s = Things.nearestItem(world, p.x, p.y, st => st.kind === kind && !Jobs.taken(world, 'item:' + st.id, p));
      if (s) return { type: 'eat', itemId: s.id, tx: s.x, ty: s.y, resKey: 'item:' + s.id };
    }
    // forage a wild bush directly if starving
    if (p.needs.food < 0.15) {
      const map = world.map;
      let best = null, bestD = Infinity;
      for (let i = 0; i < map.plantG.length; i++) {
        const pl = map.plantG[i];
        if (pl && pl.kind === 'bush' && pl.growth >= 0.6) {
          const x = i % map.w, y = Math.floor(i / map.w);
          const d = U.dist(p.x, p.y, x, y);
          if (d < bestD) { bestD = d; best = { x, y, i }; }
        }
      }
      if (best) return { type: 'forage', tx: best.x, ty: best.y, plantIdx: best.i };
    }
    return null;
  },

  makeJoyJob(world, p) {
    const rng = world.rng;
    const opts = [];
    const horseshoes = Things.nearestBuilding(world, p.x, p.y, b => BUILDINGS[b.key].rec === 'horseshoes');
    if (horseshoes) opts.push({ w: 3, j: { type: 'joyAt', tx: horseshoes.x, ty: horseshoes.y, joy: 'horseshoes' } });
    const games = Things.nearestBuilding(world, p.x, p.y, b => BUILDINGS[b.key].rec === 'games');
    if (games) opts.push({ w: 3, j: { type: 'joyAt', tx: games.x, ty: games.y, joy: 'games' } });
    // social stroll with someone idle
    const buddy = world.pawns.find(q => q !== p && q.isColonist() && !q.downed && q.job && (q.job.type === 'wander' || q.job.type === 'joyWalk') && q.stage(world) === 'adult');
    if (buddy) opts.push({ w: 2, j: { type: 'joyWalk', buddyId: buddy.id } });
    if (!world.isNight || rng.chance(0.4)) opts.push({ w: 1.5, j: { type: 'joyWalk' } });
    if (world.isNight) opts.push({ w: 2, j: { type: 'stargaze' } });
    const pet = world.animals.find(a => a.tame && !a.dead);
    if (pet) opts.push({ w: 2, j: { type: 'playPet', petId: pet.id } });
    // visit a grave of someone missed
    if (world.rng.chance(0.25)) {
      const grave = world.buildings.find(b => !b.blueprint && BUILDINGS[b.key].grave && b.meta && b.meta.occupant);
      if (grave) opts.push({ w: 1, j: { type: 'visitGrave', tx: grave.x, ty: grave.y, graveId: grave.id } });
    }
    if (!opts.length) return null;
    return rng.pickw(opts, o => o.w).j;
  },

  scanUrgent(world, p) {
    // firefight (home area fires)
    if (world.fireCount > 0 && !p.disables.has('dumb')) {
      const map = world.map;
      let best = null, bestD = Infinity;
      for (let i = 0; i < map.fireG.length; i++) {
        if (!map.fireG[i]) continue;
        const x = i % map.w, y = Math.floor(i / map.w);
        if (U.dist(x, y, map.home.x, map.home.y) > 34) continue; // let the wilds burn
        if (Jobs.taken(world, 'fire:' + i, p)) continue;
        const d = U.dist(p.x, p.y, x, y);
        if (d < bestD) { bestD = d; best = { x, y, i }; }
      }
      if (best) return { type: 'firefight', tx: best.x, ty: best.y, fireIdx: best.i, resKey: 'fire:' + best.i };
    }
    // rescue downed colonist lying outside a bed
    for (const q of world.pawns) {
      if (!q.isColonist() || !q.downed || q.dead || q === p) continue;
      if (q.inBedId) continue;
      if (Jobs.taken(world, 'rescue:' + q.id, p)) continue;
      const bed = Jobs.findBedFor(world, q, true);
      if (!bed) continue;
      return { type: 'rescue', victimId: q.id, bedId: bed.id, resKey: 'rescue:' + q.id };
    }
    // emergency first aid: anyone can press a bandage to a bleeding wound
    if (p.canDo('caring')) {
      for (const q of world.pawns) {
        if ((!q.isColonist() && !q.prisoner) || q.dead || q === p) continue;
        if (!q.downed && !q.inBedId) continue;
        if (!q.injuries.some(inj => !inj.tended && inj.bleed > 0)) continue;
        if (Jobs.taken(world, 'tend:' + q.id, p)) continue;
        return { type: 'tend', patientId: q.id, resKey: 'tend:' + q.id, phase: 'med' };
      }
    }
    // carry captured raiders to their cells
    while (world.captureQueue.length) {
      const cq = world.captureQueue[0];
      const foe = world.byId[cq.pawnId], bed = world.byId[cq.bedId];
      if (!foe || foe.dead || !foe.downed || foe.prisoner || !bed) { world.captureQueue.shift(); continue; }
      if (Jobs.taken(world, 'rescue:' + foe.id, p)) break;
      return { type: 'capture', victimId: foe.id, bedId: cq.bedId, resKey: 'rescue:' + foe.id };
    }
    // feed a hungry baby
    for (const q of world.pawns) {
      if (!q.isColonist() || q.dead || q.stage(world) !== 'baby') continue;
      if (q.needs.food > 0.4) continue;
      if (Jobs.taken(world, 'feed:' + q.id, p)) continue;
      const s = Things.nearestItem(world, q.x, q.y, st => ITEMS[st.kind] && ITEMS[st.kind].food && !Jobs.taken(world, 'item:' + st.id, p));
      if (s) return { type: 'feedBaby', babyId: q.id, itemId: s.id, tx: s.x, ty: s.y, resKey: 'feed:' + q.id };
    }
    // feed a bedridden or field-downed patient
    for (const q of world.pawns) {
      if (!q.isColonist() || q.dead || !(q.inBedId || q.downed) || q.needs.food > 0.35 || q === p) continue;
      if (Jobs.taken(world, 'feed:' + q.id, p)) continue;
      const s = Things.nearestItem(world, q.x, q.y, st => ITEMS[st.kind] && ITEMS[st.kind].food && ITEMS[st.kind].food > 0.15 && !Jobs.taken(world, 'item:' + st.id, p));
      if (s) return { type: 'feedBaby', babyId: q.id, itemId: s.id, tx: s.x, ty: s.y, resKey: 'feed:' + q.id };
    }
    return null;
  },

  // ---- work scanners (by role) -------------------------------------------
  scanners: {
    doctor(world, p) {
      if (!p.canDo('caring')) return null;
      for (const q of world.pawns) {
        if (q.dead || q === p) continue;
        if (!q.isColonist() && !q.prisoner) continue;
        if (!q.needsTending()) continue;
        if (!q.downed && !q.inBedId && q !== p) continue; // walking wounded tend themselves at low prio
        if (Jobs.taken(world, 'tend:' + q.id, p)) continue;
        return { type: 'tend', patientId: q.id, resKey: 'tend:' + q.id, phase: 'med' };
      }
      // self-tend if hurt and nobody else
      if (p.needsTending() && p.skill('Medicine') >= 3) return { type: 'tend', patientId: p.id, resKey: 'tend:' + p.id, phase: 'med' };
      return null;
    },

    warden(world, p) {
      if (!p.canDo('social')) { /* no such tag; social always allowed */ }
      for (const q of world.pawns) {
        if (!q.prisoner || q.dead) continue;
        // feed
        if (q.needs.food < 0.45 && !Jobs.taken(world, 'feed:' + q.id, p)) {
          const s = Things.nearestItem(world, p.x, p.y, st => ITEMS[st.kind] && ITEMS[st.kind].food && ITEMS[st.kind].food > 0.15 && !Jobs.taken(world, 'item:' + st.id, p));
          if (s) return { type: 'deliverPrisonerFood', prisonerId: q.id, itemId: s.id, tx: s.x, ty: s.y, resKey: 'feed:' + q.id };
        }
        // recruit chat (a few times a day)
        if ((q.lastRecruitT || 0) < world.t - 300 && !Jobs.taken(world, 'recruit:' + q.id, p)) {
          return { type: 'recruitChat', prisonerId: q.id, resKey: 'recruit:' + q.id };
        }
      }
      return null;
    },

    bury(world, p) {
      if (!p.canDo('dumb')) return null;
      // colonist corpses to graves; raider corpses hauled off the map edge
      for (const s of world.items) {
        if (s.kind !== 'corpse' || s.carried) continue;
        if (Jobs.taken(world, 'corpse:' + s.id, p)) continue;
        if (s.meta.faction === 'colony' && !s.meta.animal) {
          const grave = world.buildings.find(b => !b.blueprint && BUILDINGS[b.key].grave && (!b.meta || !b.meta.occupant) && !Jobs.taken(world, 'grave:' + b.id, p));
          if (grave) return { type: 'bury', corpseId: s.id, graveId: grave.id, tx: s.x, ty: s.y, resKey: 'corpse:' + s.id };
        } else if (!s.meta.animal || s.meta.rotten) {
          // human raiders & spoiled carcasses get hauled away; fresh game goes to the butcher
          return { type: 'dumpCorpse', corpseId: s.id, tx: s.x, ty: s.y, resKey: 'corpse:' + s.id };
        }
      }
      return null;
    },

    cook(world, p) {
      if (p.skill('Cooking') < 1) return null;
      const colonists = world.pawns.filter(q => q.isColonist()).length;
      const meals = Things.count(world, 'mealSimple') + Things.count(world, 'mealFine');
      if (meals >= colonists * BAL.mealsLow) return null;
      const stove = Things.nearestBuilding(world, p.x, p.y, b => BUILDINGS[b.key].cook);
      if (!stove || Jobs.taken(world, 'bench:' + stove.id, p)) return null;
      const veg = Things.count(world, 'rawVeg') + Things.count(world, 'berries');
      const meat = Things.count(world, 'rawMeat');
      if (veg + meat < 3) return null;
      return { type: 'cook', benchId: stove.id, tx: stove.x, ty: stove.y, resKey: 'bench:' + stove.id, wk: 0 };
    },

    butcher(world, p) {
      if (p.skill('Cooking') < 1 || !p.canDo('violent')) return null;
      const corpse = Things.nearestItem(world, p.x, p.y, s => s.kind === 'corpse' && s.meta.animal && !s.meta.rotten && !Jobs.taken(world, 'corpse:' + s.id, p));
      if (!corpse) return null;
      const block = Things.nearestBuilding(world, p.x, p.y, b => BUILDINGS[b.key].butcher);
      if (!block) return null;
      return { type: 'butcher', corpseId: corpse.id, benchId: block.id, tx: corpse.x, ty: corpse.y, resKey: 'corpse:' + corpse.id };
    },

    hunt(world, p) {
      if (!p.canFight(world)) return null;
      if (!world.huntQueue.length) return null;
      const ranged = !p.weaponDef().melee;
      const id = world.huntQueue.find(aid => {
        const a = world.byId[aid];
        if (!a || a.dead || Jobs.taken(world, 'hunt:' + aid, p)) return false;
        // only well-armed hunters take on big game; anyone can chase hares
        if (!ranged && !['hare', 'turkey'].includes(a.species)) return false;
        return true;
      });
      if (!id) return null;
      return { type: 'hunt', targetId: id, resKey: 'hunt:' + id };
    },

    harvest(world, p) {
      const map = world.map;
      let best = null, bestD = Infinity;
      // farm crops first
      for (const farm of world.zones.farms) {
        for (let y = farm.y; y < farm.y + farm.h; y++) for (let x = farm.x; x < farm.x + farm.w; x++) {
          const i = map.idx(x, y);
          const pl = map.plantG[i];
          if (!pl || pl.growth < 1 || !PLANTS[pl.kind].crop) continue;
          if (Jobs.taken(world, 'plant:' + i, p)) continue;
          const d = U.dist(p.x, p.y, x, y);
          if (d < bestD) { bestD = d; best = { x, y, i } }
        }
      }
      // wild berries when food is short
      if (!best && Things.countFood(world) < world.pawns.filter(q => q.isColonist()).length * 3.2) {
        for (let i = 0; i < map.plantG.length; i++) {
          const pl = map.plantG[i];
          if (!pl || (pl.kind !== 'bush' && pl.kind !== 'healrootW') || pl.growth < 0.85) continue;
          if (Jobs.taken(world, 'plant:' + i, p)) continue;
          const x = i % map.w, y = Math.floor(i / map.w);
          const d = U.dist(p.x, p.y, x, y);
          if (d < bestD) { bestD = d; best = { x, y, i }; }
        }
      }
      if (!best) return null;
      return { type: 'harvest', tx: best.x, ty: best.y, plantIdx: best.i, resKey: 'plant:' + best.i };
    },

    sow(world, p) {
      if (world.tempOut < 3) return null; // too cold to sow
      const map = world.map;
      let best = null, bestD = Infinity;
      for (const farm of world.zones.farms) {
        for (let y = farm.y; y < farm.y + farm.h; y++) for (let x = farm.x; x < farm.x + farm.w; x++) {
          const i = map.idx(x, y);
          if (map.plantG[i] || map.bIdx[i] || map.rock[i]) continue;
          const t = map.terr[i];
          if (t !== TERR.SOIL && t !== TERR.RICH) continue;
          if (Jobs.taken(world, 'plant:' + i, p)) continue;
          const d = U.dist(p.x, p.y, x, y);
          if (d < bestD) { bestD = d; best = { x, y, i, crop: farm.crop }; }
        }
      }
      if (!best) return null;
      return { type: 'sow', tx: best.x, ty: best.y, plantIdx: best.i, crop: best.crop, resKey: 'plant:' + best.i };
    },

    chop(world, p) {
      if (!world.chopQueue.size) return null;
      const map = world.map;
      let best = null, bestD = Infinity;
      for (const i of world.chopQueue) {
        const pl = map.plantG[i];
        if (!pl || !PLANTS[pl.kind].tree) { world.chopQueue.delete(i); continue; }
        if (Jobs.taken(world, 'plant:' + i, p)) continue;
        const x = i % map.w, y = Math.floor(i / map.w);
        const d = U.dist(p.x, p.y, x, y);
        if (d < bestD) { bestD = d; best = { x, y, i }; }
      }
      if (!best) return null;
      return { type: 'chop', tx: best.x, ty: best.y, plantIdx: best.i, resKey: 'plant:' + best.i };
    },

    mine(world, p) {
      if (!world.mineQueue.size) return null;
      const map = world.map;
      let best = null, bestD = Infinity;
      for (const i of world.mineQueue) {
        if (!map.rock[i]) { world.mineQueue.delete(i); continue; }
        if (Jobs.taken(world, 'mine:' + i, p)) continue;
        const x = i % map.w, y = Math.floor(i / map.w);
        // must be reachable: adjacent standable
        const d = U.dist(p.x, p.y, x, y);
        if (d < bestD) { bestD = d; best = { x, y, i }; }
      }
      if (!best) return null;
      return { type: 'mine', tx: best.x, ty: best.y, mineIdx: best.i, resKey: 'mine:' + best.i };
    },

    build(world, p) {
      if (p.skill('Construction') < 1 && !p.hasTrait('hardworker')) { /* anyone can build a bit */ }
      let best = null, bestD = Infinity;
      for (const b of world.buildings) {
        if (!b.blueprint) continue;
        if (Jobs.taken(world, 'bp:' + b.id, p)) continue;
        // materials available?
        const def = BUILDINGS[b.key];
        let ok = true;
        for (const [kind, qty] of Object.entries(def.cost || {})) {
          if (!b.fetched && Things.count(world, kind) < qty) { ok = false; break; }
        }
        if (!ok) continue;
        const d = U.dist(p.x, p.y, b.x, b.y);
        if (d < bestD) { bestD = d; best = b; }
      }
      if (!best) return null;
      return { type: 'build', bpId: best.id, resKey: 'bp:' + best.id, phase: best.fetched ? 'build' : 'fetch' };
    },

    craft(world, p) {
      for (const bill of world.bills) {
        if (bill.count <= 0) continue;
        if (bill.tech && !world.techsDone.includes(bill.tech)) continue;
        if (bill.skill && p.skill(bill.skill) < (bill.minSkill || 0)) continue;
        const bench = Things.nearestBuilding(world, p.x, p.y, b => BUILDINGS[b.key].bench && BUILDINGS[b.key].bench.includes(bill.bench));
        if (!bench || Jobs.taken(world, 'bench:' + bench.id, p)) continue;
        // ingredients?
        let ok = true;
        for (const [kind, qty] of Object.entries(bill.cost || {})) {
          if (Things.count(world, kind) < qty) { ok = false; break; }
        }
        if (!ok) continue;
        return { type: 'craft', billId: bill.id, benchId: bench.id, tx: bench.x, ty: bench.y, resKey: 'bench:' + bench.id, wk: 0 };
      }
      return null;
    },

    research(world, p) {
      if (!p.canDo('intellectual') || !world.research) return null;
      const desk = Things.nearestBuilding(world, p.x, p.y, b => BUILDINGS[b.key].research);
      if (!desk || Jobs.taken(world, 'bench:' + desk.id, p)) return null;
      return { type: 'research', benchId: desk.id, tx: desk.x, ty: desk.y, resKey: 'bench:' + desk.id };
    },

    haul(world, p) {
      if (!p.canDo('dumb')) return null;
      if (!world.zones.stock.size) return null;
      const s = Things.nearestItem(world, p.x, p.y, st =>
        st.kind !== 'corpse' && !Things.inStockpile(world, st) && !Jobs.taken(world, 'item:' + st.id, p) && U.dist(st.x, st.y, world.map.home.x, world.map.home.y) < 46);
      if (!s) return null;
      const dest = Things.freeStockTile(world, s.kind);
      if (!dest) return null;
      return { type: 'haul', itemId: s.id, tx: s.x, ty: s.y, destX: dest.x, destY: dest.y, resKey: 'item:' + s.id, phase: 'get' };
    },

    clean(world, p) {
      if (!p.canDo('dumb')) return null;
      const map = world.map;
      let best = null, bestD = Infinity;
      const home = map.home;
      for (let dy = -20; dy <= 20; dy += 1) for (let dx = -20; dx <= 20; dx += 1) {
        const x = home.x + dx, y = home.y + dy;
        if (!map.inb(x, y)) continue;
        const i = map.idx(x, y);
        if (map.filth[i] < 30) continue;
        const room = map.roomAt(x, y);
        if (!room || !room.indoor) continue; // only scrub indoors
        if (Jobs.taken(world, 'clean:' + i, p)) continue;
        const d = U.dist(p.x, p.y, x, y);
        if (d < bestD) { bestD = d; best = { x, y, i }; }
      }
      if (!best) return null;
      return { type: 'clean', tx: best.x, ty: best.y, tileIdx: best.i, resKey: 'clean:' + best.i };
    },
  },

  decidePrisoner(world, p) {
    // prisoners eat delivered food, sleep, pace
    if (p.needs.food < 0.4) {
      const room = world.map.roomAt(Math.round(p.x), Math.round(p.y));
      if (room) {
        const s = Things.nearestItem(world, p.x, p.y, st => ITEMS[st.kind] && ITEMS[st.kind].food && world.map.roomAt(st.x, st.y) === room);
        if (s) { Jobs.setJob(world, p, { type: 'eat', itemId: s.id, tx: s.x, ty: s.y }); return; }
      }
    }
    if (p.needs.rest < 0.3 || Jobs.isSleepHour(world, p)) { Jobs.startSleep(world, p); return; }
    Jobs.setJob(world, p, { type: 'wander', tx: Math.round(p.x) + world.rng.ri(-2, 2), ty: Math.round(p.y) + world.rng.ri(-2, 2), until: world.t + 20 });
  },

  // ---- job execution -----------------------------------------------------
  step(world, p) {
    if (!p.job) { Jobs.decide(world, p); if (!p.job) return; }
    const j = p.job;
    // hunger interrupts long work — nobody chops wood into a starvation grave
    if (p.isColonist() && !p.breaking && p.needs.food < 0.15 &&
        !['eat', 'forage', 'combat', 'fleeTo', 'hideAt', 'patient', 'sleep'].includes(j.type)) {
      const ej = Jobs.makeEatJob(world, p);
      if (ej) { Jobs.setJob(world, p, ej); return Jobs.step(world, p); }
    }
    // total exhaustion drops the tools too
    if (p.isColonist() && !p.breaking && p.needs.rest < 0.03 && j.type !== 'sleep' && j.type !== 'patient') {
      Jobs.startSleep(world, p);
      return;
    }
    const handler = Jobs.steps[j.type];
    if (!handler) { Jobs.endJob(world, p); return; }
    try {
      handler(world, p, j);
    } catch (err) {
      Jobs.endJob(world, p);
      throw err;
    }
  },

  workAmount(p, skillName) { return p.workSpeed(skillName || 'Construction'); },

  steps: {
    wander(world, p, j) {
      const r = Jobs.advance(world, p, j.tx, j.ty);
      if (r === 'stuck' || (r === 'arrived' && world.t >= (j.until || 0))) Jobs.endJob(world, p);
    },

    fleeTo(world, p, j) {
      const r = Jobs.advance(world, p, j.tx, j.ty, { ignoreFire: true });
      if (r !== 'moving') Jobs.endJob(world, p);
    },

    hideAt(world, p, j) {
      const r = Jobs.advance(world, p, j.tx, j.ty);
      if (r === 'stuck') Jobs.endJob(world, p);
      if (p.mode !== 'hide') Jobs.endJob(world, p);
    },

    combat(world, p, j) { Combat.stepFighter(world, p, j); },

    sleep(world, p, j) {
      if (j.bedId && !world.byId[j.bedId]) { Jobs.endJob(world, p); return; }
      const r = Jobs.advance(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        if (!j.sleeping) {
          j.sleeping = true;
          j.startRest = p.needs.rest;
          p.inBedId = j.bedId || null;
        }
        // wake conditions (a growling stomach counts)
        const morning = !Jobs.isSleepHour(world, p) && p.needs.rest > 0.55;
        const starvingAwake = p.needs.food < 0.06 && p.needs.rest > 0.3;
        if (p.needs.rest >= 0.99 || morning || starvingAwake || p.mode !== 'normal') {
          // sleep-quality thoughts
          const map = world.map;
          const room = map.roomAt(j.tx, j.ty);
          if (!room || !room.indoor) p.addThought(world, 'sleptOutside');
          if (j.ground) p.addThought(world, 'sleptOnGround');
          const temp = Sim.tempAt(world, p);
          if (temp < 8) p.addThought(world, 'sleptInCold');
          if (temp > 32) p.addThought(world, 'sleptInHeat');
          if (room && room.indoor && room.kind === 'bedroom' && room.beauty > 2 && j.bedId) {
            const bed = world.byId[j.bedId];
            if (bed && bed.ownerId === p.id) p.addThought(world, 'goodBedroom');
          }
          if (room && room.indoor && room.kind === 'barracks') p.addThought(world, 'crampedQuarters');
          // baby in the room cried?
          const baby = world.pawns.find(q => q.isColonist() && q.stage(world) === 'baby' && (q.family.mo === p.id || q.family.fa === p.id) && q.needs.food < 0.5);
          if (baby) p.addThought(world, 'sleepInterrupted');
          p.inBedId = null;
          Jobs.endJob(world, p);
        }
      }
    },

    patient(world, p, j) {
      const bed = world.byId[j.bedId];
      if (!bed) { Jobs.endJob(world, p); return; }
      const r = Jobs.advance(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        p.inBedId = j.bedId;
        p.needs.rest = Math.min(1, p.needs.rest + BAL.restPerMin * 3);
        // desperate patients crawl to food rather than starve waiting for room service
        if (p.needs.food < 0.12) { p.inBedId = null; Jobs.endJob(world, p); return; }
        if (!p.needsTending() && p.blood > 0.9 && !p.diseases.length) {
          p.inBedId = null;
          Jobs.endJob(world, p);
        }
      }
    },

    eat(world, p, j) {
      const s = world.byId[j.itemId];
      if (!s || s.carried) { Jobs.endJob(world, p); return; }
      const r = Jobs.advance(world, p, s.x, s.y);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        const kind = s.kind;
        if (Things.take(world, s, 1) > 0) {
          p.eat(world, kind);
          // eat at a table if one is close by
          const table = Things.nearestBuilding(world, p.x, p.y, b => BUILDINGS[b.key].table);
          if (!table || U.dist(p.x, p.y, table.x, table.y) > 14) {
            if (!ITEMS[kind].raw && p.stage(world) === 'adult') p.addThought(world, 'ateNoTable');
          }
          if (s.meta && s.meta.poisoned && world.rng.chance(0.5)) {
            p.addDisease(world, 'foodPoison');
          }
        }
        Jobs.endJob(world, p);
      }
    },

    forage(world, p, j) {
      const pl = world.map.plantG[j.plantIdx];
      if (!pl) { Jobs.endJob(world, p); return; }
      const r = Jobs.advance(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        j.wk = (j.wk || 0) + Jobs.workAmount(p, 'Plants');
        if (j.wk >= 6) {
          pl.growth = 0.2;
          p.eat(world, 'berries'); p.eat(world, 'berries');
          Jobs.endJob(world, p);
        }
      }
    },

    attend(world, p, j) {
      const g = world.gatherings.find(gg => gg.id === j.gatherId);
      if (!g) { Jobs.endJob(world, p); return; }
      if (!j.spotX) {
        const spot = world.map.findSpotNear(g.x + world.rng.ri(-2, 2), g.y + world.rng.ri(-2, 2), 4, (x, y) => world.map.standable(x, y, world));
        j.spotX = spot ? spot.x : g.x; j.spotY = spot ? spot.y : g.y;
      }
      const r = Jobs.advance(world, p, j.spotX, j.spotY);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      p.facing = g.x >= p.x ? 1 : -1;
      p.needs.rec = Math.min(1, p.needs.rec + 0.002);
    },

    firefight(world, p, j) {
      const map = world.map;
      if (!map.fireG[j.fireIdx]) { Jobs.endJob(world, p); return; }
      const r = Jobs.advanceAdjacent(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        map.fireG[j.fireIdx] = Math.max(0, map.fireG[j.fireIdx] - 22);
        if (world.rng.chance(0.012)) p.applyDamage(world, 2, 'burn', 'the flames');
        if (!map.fireG[j.fireIdx]) { Sim.recountFires(world); Jobs.endJob(world, p); }
      }
    },

    rescue(world, p, j) {
      const victim = world.byId[j.victimId];
      const bed = world.byId[j.bedId];
      if (!victim || victim.dead || !victim.downed || !bed) { Jobs.endJob(world, p); if (victim && j.carrying) Jobs.dropVictim(world, p, victim); return; }
      if (!j.carrying) {
        const r = Jobs.advance(world, p, Math.round(victim.x), Math.round(victim.y));
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') j.carrying = true;
      } else {
        victim.x = p.x; victim.y = p.y;
        const r = Jobs.advance(world, p, bed.x, bed.y);
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') {
          victim.x = bed.x; victim.y = bed.y;
          victim.inBedId = bed.id;
          Social.changeOp(victim, p, 12);
          victim.addThought(world, 'wellTended', { who: p.id });
          Jobs.endJob(world, p);
        }
      }
    },

    capture(world, p, j) {
      const foe = world.byId[j.victimId];
      const bed = world.byId[j.bedId];
      if (!foe || foe.dead || foe.prisoner || !foe.downed || !bed) {
        world.captureQueue = world.captureQueue.filter(cq => cq.pawnId !== j.victimId);
        Jobs.endJob(world, p); return;
      }
      if (!j.carrying) {
        const r = Jobs.advance(world, p, Math.round(foe.x), Math.round(foe.y));
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') j.carrying = true;
      } else {
        foe.x = p.x; foe.y = p.y;
        const r = Jobs.advance(world, p, bed.x, bed.y);
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') {
          foe.x = bed.x; foe.y = bed.y;
          foe.prisoner = true; foe.fleeing = false; foe.raidId = null; foe.mode = 'normal';
          foe.inBedId = bed.id;
          foe.addThought(world, 'imprisoned');
          world.captureQueue = world.captureQueue.filter(cq => cq.pawnId !== j.victimId);
          Chron.log(world, `${foe.full()} of the ${foe.factionName || 'raiders'} was carried, bleeding, to the cell. ${world.rng.chance(0.5) ? 'Perhaps there is a colonist in there somewhere.' : 'The wardens will work on ' + foe.him + '.'}`, { icon: '⛓️', tone: 'neutral', major: true });
          Jobs.endJob(world, p);
        }
      }
    },

    tend(world, p, j) {
      const q = world.byId[j.patientId];
      if (!q || q.dead || !q.needsTending()) { Jobs.endJob(world, p); return; }
      if (j.phase === 'med' && !j.med) {
        const medStack = Things.nearestItem(world, p.x, p.y, s => (s.kind === 'medkit' || s.kind === 'herbal') && !Jobs.taken(world, 'item:' + s.id, p));
        if (medStack) {
          const r = Jobs.advance(world, p, medStack.x, medStack.y);
          if (r === 'moving') return;
          if (r === 'arrived') {
            const kind = medStack.kind;
            if (Things.take(world, medStack, 1) > 0) j.med = ITEMS[kind].med;
          }
          j.phase = 'go';
        } else { j.phase = 'go'; j.med = 0; }
      }
      const r = Jobs.advanceAdjacent(world, p, Math.round(q.x), Math.round(q.y));
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        j.wk = (j.wk || 0) + Jobs.workAmount(p, 'Medicine');
        if (j.wk >= 14) {
          const quality = U.clamp(BAL.tendBase + p.skill('Medicine') * 0.05 + (j.med || 0) * 0.35 + world.rng.rf(-0.08, 0.08), 0.1, 1);
          for (const inj of q.injuries) if (!inj.tended) { inj.tended = true; inj.tendQ = quality; }
          for (const d of q.diseases) d.tendQ = Math.max(d.tendQ, quality);
          p.gainXp(world, 'Medicine', 120);
          p.stats.tended++;
          q.recomputePain();
          if (quality > 0.65) q.addThought(world, 'wellTended', { who: p.id });
          Social.changeOp(q, p, 4);
          if (q !== p && world.rng.chance(0.1)) {
            Chron.log(world, `${p.label()} ${j.med ? 'dressed' : 'field-dressed'} ${q.label()}'s wounds${quality > 0.8 ? ' with a steady, practiced hand' : quality < 0.3 ? ', clumsily' : ''}.`, { icon: ICONS.heal, tone: 'neutral' });
          }
          Jobs.endJob(world, p);
        }
      }
    },

    cook(world, p, j) {
      const stove = world.byId[j.benchId];
      if (!stove) { Jobs.endJob(world, p); return; }
      const r = Jobs.advanceAdjacent(world, p, stove.x, stove.y);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        stove.working = world.t;
        j.wk += Jobs.workAmount(p, 'Cooking') * (BUILDINGS[stove.key].cook || 1);
        if (j.wk >= 22) {
          // consume ~1 nutrition of raw food
          let need = 5;
          for (const s of [...world.items]) {
            if (need <= 0) break;
            if (['rawVeg', 'berries', 'rawMeat'].includes(s.kind) && !s.carried) need -= Things.take(world, s, need);
          }
          const fine = p.skill('Cooking') >= 8 && world.rng.chance(0.55);
          const poisoned = p.skill('Cooking') <= 3 && world.rng.chance(0.06);
          Things.drop(world, stove.x, stove.y, fine ? 'mealFine' : 'mealSimple', 1, poisoned ? { poisoned: true } : null);
          p.gainXp(world, 'Cooking', 90);
          if (world.rng.chance(0.06) && p.skill('Cooking') >= 8) p.addThought(world, 'ateGoodMealCooked');
          Jobs.endJob(world, p);
        }
      }
    },

    butcher(world, p, j) {
      const corpse = world.byId[j.corpseId];
      const block = world.byId[j.benchId];
      if (!corpse || !block) { Jobs.endJob(world, p); return; }
      if (!j.carrying) {
        const r = Jobs.advance(world, p, corpse.x, corpse.y);
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') { j.carrying = true; corpse.carried = true; }
      } else {
        corpse.x = Math.round(p.x); corpse.y = Math.round(p.y);
        const r = Jobs.advanceAdjacent(world, p, block.x, block.y);
        if (r === 'stuck') { corpse.carried = false; Jobs.endJob(world, p); return; }
        if (r === 'arrived') {
          j.wk = (j.wk || 0) + Jobs.workAmount(p, 'Cooking');
          if (j.wk >= 16) {
            const def = ANIMALS[corpse.meta.species] || { meat: 10, leather: 3 };
            Things.drop(world, block.x, block.y, 'rawMeat', def.meat || 8);
            if (def.leather) Things.drop(world, block.x, block.y, 'leather', def.leather);
            Things.removeStack(world, corpse);
            world.map.addFilth(block.x, block.y, 30);
            p.gainXp(world, 'Cooking', 60);
            Jobs.endJob(world, p);
          }
        }
      }
    },

    hunt(world, p, j) { Combat.stepHunter(world, p, j); },

    harvest(world, p, j) {
      const pl = world.map.plantG[j.plantIdx];
      if (!pl) { Jobs.endJob(world, p); return; }
      const r = Jobs.advance(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        j.wk = (j.wk || 0) + Jobs.workAmount(p, 'Plants');
        if (j.wk >= 9) {
          const def = PLANTS[pl.kind];
          if (def.food) {
            const skillBonus = 0.75 + p.skill('Plants') * 0.03;
            Things.drop(world, j.tx, j.ty, def.food.item, Math.max(1, Math.round(def.food.qty * skillBonus * pl.growth)));
          }
          if (def.crop) world.map.plantG[j.plantIdx] = null;
          else pl.growth = 0.15; // wild plants regrow

          p.gainXp(world, 'Plants', 45);
          p.stats.harvests++;
          world.stats.harvested++;
          Jobs.endJob(world, p);
        }
      }
    },

    sow(world, p, j) {
      const map = world.map;
      if (map.plantG[j.plantIdx] || map.bIdx[j.plantIdx]) { Jobs.endJob(world, p); return; }
      const r = Jobs.advance(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        j.wk = (j.wk || 0) + Jobs.workAmount(p, 'Plants');
        if (j.wk >= 7) {
          map.plantG[j.plantIdx] = { kind: j.crop, growth: 0.01, i: j.plantIdx, sown: true };
          p.gainXp(world, 'Plants', 30);
          Jobs.endJob(world, p);
        }
      }
    },

    chop(world, p, j) {
      const pl = world.map.plantG[j.plantIdx];
      if (!pl || !PLANTS[pl.kind].tree) { world.chopQueue.delete(j.plantIdx); Jobs.endJob(world, p); return; }
      const r = Jobs.advanceAdjacent(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        j.wk = (j.wk || 0) + Jobs.workAmount(p, 'Plants');
        if (j.wk >= 20) {
          const wood = Math.round((PLANTS[pl.kind].wood || 15) * (0.5 + 0.5 * pl.growth));
          world.map.plantG[j.plantIdx] = null;
          world.chopQueue.delete(j.plantIdx);
          Things.drop(world, j.tx, j.ty, 'wood', wood);
          p.gainXp(world, 'Plants', 40);
          Jobs.endJob(world, p);
        }
      }
    },

    mine(world, p, j) {
      const map = world.map;
      if (!map.rock[j.mineIdx]) { world.mineQueue.delete(j.mineIdx); Jobs.endJob(world, p); return; }
      const r = Jobs.advanceAdjacent(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        j.wk = (j.wk || 0) + Jobs.workAmount(p, 'Mining');
        if (j.wk >= 24) {
          const ore = map.ore[j.mineIdx];
          map.rock[j.mineIdx] = 0;
          map.terr[j.mineIdx] = TERR.ROCKFLOOR;
          map.ore[j.mineIdx] = 0;
          map.roomsDirty = true;
          world.mineQueue.delete(j.mineIdx);
          if (ore === 1) Things.drop(world, j.tx, j.ty, 'steel', world.rng.ri(8, 14));
          else if (ore === 2) Things.drop(world, j.tx, j.ty, 'gold', world.rng.ri(3, 6));
          else Things.drop(world, j.tx, j.ty, 'chunk', world.rng.ri(2, 4));
          p.gainXp(world, 'Mining', 55);
          // vault breach check
          if (world.map.vault && !world.map.vault.opened) {
            const v = world.map.vault;
            if (Math.abs(j.tx - v.x) <= 2 && Math.abs(j.ty - v.y) <= 2) GameEvents.openVault(world, p);
          }
          Jobs.endJob(world, p);
        }
      }
    },

    build(world, p, j) {
      const b = world.byId[j.bpId];
      if (!b || !b.blueprint) { Jobs.endJob(world, p); return; }
      const def = BUILDINGS[b.key];
      if (j.phase === 'fetch') {
        if (!j.fetchKind) {
          // deduct all materials from stockpiles; carry the visual load of the first kind
          const entries = Object.entries(def.cost || {});
          if (!entries.length) { b.fetched = true; j.phase = 'build'; return; }
          for (const [kind, qty] of entries) if (Things.count(world, kind) < qty) { Jobs.endJob(world, p); return; }
          j.fetchKind = entries[0][0];
          const s = Things.nearestItem(world, p.x, p.y, st => st.kind === j.fetchKind);
          if (!s) { Jobs.endJob(world, p); return; }
          j.fetchId = s.id; j.tx = s.x; j.ty = s.y;
        }
        const s = world.byId[j.fetchId];
        if (!s) { j.fetchKind = null; return; }
        const r = Jobs.advance(world, p, s.x, s.y);
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') {
          for (const [kind, qty] of Object.entries(def.cost || {})) {
            let need = qty;
            for (const st of [...world.items]) {
              if (need <= 0) break;
              if (st.kind === kind && !st.carried) need -= Things.take(world, st, need);
            }
          }
          b.fetched = true;
          p.carry = { kind: j.fetchKind, qty: def.cost[j.fetchKind] };
          j.phase = 'build';
        }
        return;
      }
      const r = Jobs.advanceAdjacent(world, p, b.x, b.y);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        p.carry = null;
        b.work = (b.work || 0) + Jobs.workAmount(p, 'Construction');
        if (b.work >= def.wk) {
          Things.finishBuilding(world, b);
          p.gainXp(world, 'Construction', 50);
          world.stats.built++;
          Overseer.onBuilt(world, b, p);
          Jobs.endJob(world, p);
        }
      }
    },

    craft(world, p, j) {
      const bill = world.bills.find(bb => bb.id === j.billId);
      const bench = world.byId[j.benchId];
      if (!bill || bill.count <= 0 || !bench) { Jobs.endJob(world, p); return; }
      const r = Jobs.advanceAdjacent(world, p, bench.x, bench.y);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        bench.working = world.t;
        j.wk += Jobs.workAmount(p, bill.skill || 'Crafting');
        if (j.wk >= (bill.wk || 30)) {
          for (const [kind, qty] of Object.entries(bill.cost || {})) {
            let need = qty;
            for (const st of [...world.items]) {
              if (need <= 0) break;
              if (st.kind === kind && !st.carried) need -= Things.take(world, st, need);
            }
          }
          Overseer.finishBill(world, bill, p, bench);
          bill.count--;
          p.stats.crafted++;
          p.gainXp(world, bill.skill || 'Crafting', 90);
          Jobs.endJob(world, p);
        }
      }
    },

    research(world, p, j) {
      const desk = world.byId[j.benchId];
      if (!desk || !world.research) { Jobs.endJob(world, p); return; }
      const r = Jobs.advanceAdjacent(world, p, desk.x, desk.y);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        desk.working = world.t;
        world.research.progress += p.workSpeed('Intellectual') * 1.15;
        p.gainXp(world, 'Intellectual', 6);
        if (world.research.progress >= world.research.need) Overseer.finishResearch(world, p);
        if (world.rng.chance(0.02)) Jobs.endJob(world, p); // stretch legs
      }
    },

    haul(world, p, j) {
      const s = world.byId[j.itemId];
      if (j.phase === 'get') {
        if (!s || s.carried) { Jobs.endJob(world, p); return; }
        const r = Jobs.advance(world, p, s.x, s.y);
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') {
          const qty = Math.min(s.qty, ITEMS[s.kind].stack || 75);
          const meta = s.meta;
          const kind = s.kind;
          Things.take(world, s, qty);
          p.carry = { kind, qty, meta };
          j.phase = 'put';
        }
        return;
      }
      const dest = Things.freeStockTile(world, p.carry ? p.carry.kind : null) || { x: j.destX, y: j.destY };
      const r = Jobs.advance(world, p, dest.x, dest.y);
      if (r === 'stuck') {
        if (p.carry) { Things.drop(world, Math.round(p.x), Math.round(p.y), p.carry.kind, p.carry.qty, p.carry.meta); p.carry = null; }
        Jobs.endJob(world, p); return;
      }
      if (r === 'arrived') {
        if (p.carry) { Things.drop(world, dest.x, dest.y, p.carry.kind, p.carry.qty, p.carry.meta); p.carry = null; }
        Jobs.endJob(world, p);
      }
    },

    clean(world, p, j) {
      const map = world.map;
      if (map.filth[j.tileIdx] < 5) { Jobs.endJob(world, p); return; }
      const r = Jobs.advance(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        map.filth[j.tileIdx] = Math.max(0, map.filth[j.tileIdx] - 20);
        if (map.filth[j.tileIdx] <= 0) Jobs.endJob(world, p);
      }
    },

    bury(world, p, j) {
      const corpse = world.byId[j.corpseId];
      const grave = world.byId[j.graveId];
      if (!corpse || !grave) { Jobs.endJob(world, p); return; }
      if (!j.carrying) {
        const r = Jobs.advance(world, p, corpse.x, corpse.y);
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') { j.carrying = true; corpse.carried = true; }
      } else {
        corpse.x = Math.round(p.x); corpse.y = Math.round(p.y);
        const r = Jobs.advance(world, p, grave.x, grave.y);
        if (r === 'stuck') { corpse.carried = false; Jobs.endJob(world, p); return; }
        if (r === 'arrived') {
          grave.meta = grave.meta || {};
          grave.meta.occupant = corpse.meta.label;
          grave.meta.epitaph = Chron.epitaph(world, corpse.meta);
          grave.meta.buriedDay = world.day;
          Things.removeStack(world, corpse);
          p.addThought(world, 'buriedColonist');
          p.gainXp(world, 'Construction', 20);
          Social.startFuneral(world, grave, corpse.meta.label);
          Jobs.endJob(world, p);
        }
      }
    },

    dumpCorpse(world, p, j) {
      const corpse = world.byId[j.corpseId];
      if (!corpse) { Jobs.endJob(world, p); return; }
      if (!j.carrying) {
        const r = Jobs.advance(world, p, corpse.x, corpse.y);
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') { j.carrying = true; corpse.carried = true; p.addThought(world, 'sawCorpse'); }
      } else {
        corpse.x = Math.round(p.x); corpse.y = Math.round(p.y);
        // to the map edge, away from home
        if (!j.destX) {
          const map = world.map;
          const dx = Math.round(p.x) < map.w / 2 ? 2 : map.w - 3;
          j.destX = dx; j.destY = U.clamp(Math.round(p.y) + world.rng.ri(-8, 8), 2, map.h - 3);
        }
        const r = Jobs.advance(world, p, j.destX, j.destY);
        if (r === 'stuck' || r === 'arrived') {
          Things.removeStack(world, corpse); // returned to the earth
          Jobs.endJob(world, p);
        }
      }
    },

    deliverPrisonerFood(world, p, j) {
      const q = world.byId[j.prisonerId];
      const s = world.byId[j.itemId];
      if (!q || q.dead || !q.prisoner) { Jobs.endJob(world, p); return; }
      if (!j.carrying) {
        if (!s || s.carried) { Jobs.endJob(world, p); return; }
        const r = Jobs.advance(world, p, s.x, s.y);
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') {
          const kind = s.kind;
          if (Things.take(world, s, 1) > 0) { j.carrying = kind; }
          else { Jobs.endJob(world, p); return; }
        }
      } else {
        const r = Jobs.advanceAdjacent(world, p, Math.round(q.x), Math.round(q.y));
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') {
          q.eat(world, j.carrying);
          q.addThought(world, 'treatedFairly');
          q.recruit += 2;
          Jobs.endJob(world, p);
        }
      }
    },

    recruitChat(world, p, j) {
      const q = world.byId[j.prisonerId];
      if (!q || q.dead || !q.prisoner) { Jobs.endJob(world, p); return; }
      const r = Jobs.advanceAdjacent(world, p, Math.round(q.x), Math.round(q.y));
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        j.wk = (j.wk || 0) + 1;
        if (j.wk >= 12) {
          q.lastRecruitT = world.t;
          const gain = 2 + p.skill('Social') * 0.8 + (Social.opinion(q, p) > 0 ? 2 : 0);
          q.recruit += gain;
          Social.changeOp(q, p, world.rng.ri(1, 4));
          Social.interact(world, p, q, 'recruit');
          if (q.recruit >= 40 + q.resist) GameEvents.prisonerJoins(world, q, p);
          Jobs.endJob(world, p);
        }
      }
    },

    feedBaby(world, p, j) {
      const baby = world.byId[j.babyId];
      const s = world.byId[j.itemId];
      if (!baby || baby.dead) { Jobs.endJob(world, p); return; }
      if (!j.carrying) {
        if (!s || s.carried) { Jobs.endJob(world, p); return; }
        const r = Jobs.advance(world, p, s.x, s.y);
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') {
          const kind = s.kind;
          if (Things.take(world, s, 1) > 0) j.carrying = kind;
          else { Jobs.endJob(world, p); return; }
        }
      } else {
        const r = Jobs.advanceAdjacent(world, p, Math.round(baby.x), Math.round(baby.y));
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
        if (r === 'arrived') {
          baby.needs.food = Math.min(1, baby.needs.food + 0.7);
          Social.changeOp(baby, p, 2);
          Jobs.endJob(world, p);
        }
      }
    },

    // ---- recreation ------------------------------------------------------
    joyAt(world, p, j) {
      const r = Jobs.advanceAdjacent(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        p.needs.rec = Math.min(1, p.needs.rec + 0.012);
        j.wk = (j.wk || 0) + 1;
        // pals may already be here — chat
        if (world.t % 15 === 0) {
          const other = world.pawns.find(q => q !== p && q.isColonist() && !q.downed && U.dist(p.x, p.y, q.x, q.y) < 3);
          if (other) Social.interact(world, p, other, 'joy');
        }
        if (p.needs.rec >= 0.95 || j.wk > 80) Jobs.endJob(world, p);
      }
    },

    joyWalk(world, p, j) {
      if (!j.tx || Jobs.advance(world, p, j.tx, j.ty) !== 'moving') {
        const spot = world.map.findSpotNear(Math.round(p.x) + world.rng.ri(-9, 9), Math.round(p.y) + world.rng.ri(-9, 9), 6, (x, y) => world.map.standable(x, y, world));
        if (!spot) { Jobs.endJob(world, p); return; }
        j.tx = spot.x; j.ty = spot.y;
        j.legs = (j.legs || 0) + 1;
      }
      p.needs.rec = Math.min(1, p.needs.rec + 0.006);
      const buddy = j.buddyId ? world.byId[j.buddyId] : null;
      if (buddy && !buddy.dead && U.dist(p.x, p.y, buddy.x, buddy.y) < 4 && world.t % 18 === 0) Social.interact(world, p, buddy, 'stroll');
      if (p.needs.rec >= 0.9 || (j.legs || 0) > 6) Jobs.endJob(world, p);
    },

    stargaze(world, p, j) {
      if (!j.tx) {
        const spot = world.map.findSpotNear(Math.round(p.x) + world.rng.ri(-5, 5), Math.round(p.y) + world.rng.ri(-5, 5), 8,
          (x, y) => world.map.standable(x, y, world) && !world.map.indoorsAt(x, y));
        if (!spot) { Jobs.endJob(world, p); return; }
        j.tx = spot.x; j.ty = spot.y;
      }
      const r = Jobs.advance(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        p.needs.rec = Math.min(1, p.needs.rec + 0.009);
        j.wk = (j.wk || 0) + 1;
        if (j.wk > 45 || p.needs.rec > 0.9 || !world.isNight) Jobs.endJob(world, p);
      }
    },

    playPet(world, p, j) {
      const pet = world.byId[j.petId];
      if (!pet || pet.dead) { Jobs.endJob(world, p); return; }
      const r = Jobs.advance(world, p, Math.round(pet.x), Math.round(pet.y));
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        p.needs.rec = Math.min(1, p.needs.rec + 0.02);
        j.wk = (j.wk || 0) + 1;
        if (j.wk === 8 && world.rng.chance(0.5)) p.addThought(world, 'nuzzled');
        if (j.wk > 25 || p.needs.rec > 0.9) Jobs.endJob(world, p);
      }
    },

    visitGrave(world, p, j) {
      const grave = world.byId[j.graveId];
      if (!grave) { Jobs.endJob(world, p); return; }
      const r = Jobs.advanceAdjacent(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.endJob(world, p); return; }
      if (r === 'arrived') {
        j.wk = (j.wk || 0) + 1;
        if (j.wk >= 20) {
          p.addThought(world, 'paidRespects');
          p.needs.rec = Math.min(1, p.needs.rec + 0.1);
          if (world.rng.chance(0.2) && grave.meta && grave.meta.occupant) {
            Chron.log(world, `${p.label()} stood a while at ${grave.meta.occupant}'s grave${world.season === 'Winter' ? ', brushing off the snow' : ''}.`, { icon: ICONS.grave, tone: 'neutral' });
          }
          Jobs.endJob(world, p);
        }
      }
    },

    // ---- mental break behaviors -------------------------------------------
    break_wander(world, p, j) {
      if (!j.tx || world.rng.chance(0.05)) {
        const spot = world.map.findSpotNear(Math.round(p.x) + world.rng.ri(-6, 6), Math.round(p.y) + world.rng.ri(-6, 6), 6, (x, y) => world.map.standable(x, y, world));
        if (spot) { j.tx = spot.x; j.ty = spot.y; }
      }
      if (j.tx) Jobs.advance(world, p, j.tx, j.ty);
      Jobs.checkBreakEnd(world, p);
    },

    break_binge(world, p, j) {
      if (p.needs.food > 0.95) { Jobs.steps.break_wander(world, p, j); return; }
      const s = Things.nearestItem(world, p.x, p.y, st => ITEMS[st.kind] && ITEMS[st.kind].food);
      if (!s) { Jobs.steps.break_wander(world, p, j); return; }
      const r = Jobs.advance(world, p, s.x, s.y);
      if (r === 'arrived' && world.t >= (j.nextBite || 0)) {
        j.nextBite = world.t + 10;
        const kind = s.kind;
        if (Things.take(world, s, 1) > 0) p.eat(world, kind);
        world.stats.binged++;
      }
      Jobs.checkBreakEnd(world, p);
    },

    break_hide(world, p, j) {
      if (!j.tx) {
        const bed = Jobs.findBedFor(world, p, false);
        j.tx = bed ? bed.x : Math.round(p.x); j.ty = bed ? bed.y : Math.round(p.y);
      }
      Jobs.advance(world, p, j.tx, j.ty);
      Jobs.checkBreakEnd(world, p);
    },

    break_tantrum(world, p, j) {
      if (!j.targetId) {
        const b = Things.nearestBuilding(world, p.x, p.y, bb => BUILDINGS[bb.key].cat === 'furniture' && U.dist(p.x, p.y, bb.x, bb.y) < 20);
        if (!b) { Jobs.checkBreakEnd(world, p, true); return; }
        j.targetId = b.id;
      }
      const b = world.byId[j.targetId];
      if (!b) { j.targetId = null; Jobs.checkBreakEnd(world, p); return; }
      const r = Jobs.advanceAdjacent(world, p, b.x, b.y);
      if (r === 'stuck') { j.targetId = null; return; }
      if (r === 'arrived' && world.t % 3 === 0) {
        const destroyed = Things.damageBuilding(world, b, world.rng.ri(4, 9));
        if (destroyed) {
          Chron.log(world, `${p.label()} smashed the ${BUILDINGS[b.key].n} to splinters.`, { icon: ICONS.break, tone: 'bad' });
          j.targetId = null;
        }
      }
      Jobs.checkBreakEnd(world, p);
    },

    break_berserk(world, p, j) {
      let target = j.targetId ? world.byId[j.targetId] : null;
      if (!target || target.dead || target.downed) {
        let bestD = Infinity; target = null;
        for (const q of world.pawns) {
          if (q === p || q.dead || q.downed) continue;
          const d = U.dist(p.x, p.y, q.x, q.y);
          if (d < bestD && d < 25) { bestD = d; target = q; }
        }
        if (!target) { Jobs.checkBreakEnd(world, p, true); return; }
        j.targetId = target.id;
      }
      Combat.meleeApproach(world, p, target);
      Jobs.checkBreakEnd(world, p);
    },

    break_fire(world, p, j) {
      // pyromaniac spree: ignite things
      if (!j.tx || world.rng.chance(0.2)) {
        const b = Things.nearestBuilding(world, p.x + world.rng.ri(-10, 10), p.y + world.rng.ri(-10, 10), bb => BUILDINGS[bb.key].flam > 0.3);
        const spot = b ? { x: b.x, y: b.y } : world.map.findSpotNear(Math.round(p.x) + world.rng.ri(-8, 8), Math.round(p.y) + world.rng.ri(-8, 8), 6, (x, y) => {
          const i = world.map.idx(x, y);
          return world.map.plantG[i] && world.map.standable(x, y, world);
        });
        if (spot) { j.tx = spot.x; j.ty = spot.y; }
      }
      if (j.tx != null) {
        const r = Jobs.advanceAdjacent(world, p, j.tx, j.ty);
        if (r === 'arrived') {
          Sim.igniteTile(world, j.tx, j.ty, 30);
          p.addThought(world, 'firesMesmerize');
          j.tx = null;
        }
      }
      Jobs.checkBreakEnd(world, p);
    },

    break_leave(world, p, j) {
      if (!j.tx) {
        const edge = world.map.randomEdgeSpot(world.rng, world);
        j.tx = edge.x; j.ty = edge.y;
      }
      const r = Jobs.advance(world, p, j.tx, j.ty);
      if (r === 'stuck') { Jobs.checkBreakEnd(world, p, true); return; }
      if (r === 'arrived') GameEvents.colonistWandersOff(world, p);
    },
  },

  checkBreakEnd(world, p, force) {
    if (!p.breaking) { Jobs.endJob(world, p); return; }
    if (force || world.t >= p.breaking.end) {
      const kind = p.breaking.kind;
      p.breaking = null;
      p.breakCooldownUntil = world.t + 420; // no immediate re-break spiral
      p.addThought(world, 'catharsis');
      if (kind === 'berserk') p.addThought(world, 'survivedBerserk');
      Chron.log(world, `${p.label()} has come back to ${p.his} senses.`, { icon: '😮‍💨', tone: 'neutral' });
      Jobs.endJob(world, p);
    }
  },

  dropVictim(world, p, victim) { /* victim stays where they are */ },
};

Object.assign(globalThis, { Jobs });
