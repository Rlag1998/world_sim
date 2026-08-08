// sim.js — world creation, the master tick, environment systems (weather, temperature,
// fire, plant growth), death & grief, aging, mental breaks, save/load, game over.

const Sim = {
  // ---- world creation ------------------------------------------------------
  newWorld(seedIn) {
    const seed = (seedIn != null ? seedIn : Math.floor(Math.random() * 4294967295)) >>> 0;
    const rng = new RNG(seed);
    const world = {
      v: 1, seed, rng,
      t: 0, day: 0, dayOfSeason: 0, seasonIx: 0, season: 'Spring', year0: 0, hourOfDay: 6, isNight: false,
      daysPerYear: BAL.DAYS_PER_SEASON * 4,
      map: null, byId: {},
      pawns: [], animals: [], items: [], buildings: [],
      raids: [], gatherings: [], fights: [], affairs: [], weddingQueue: [], captureQueue: [], gonePawns: [],
      reservations: {}, tabuMap: {}, huntQueue: [], chopQueue: new Set(), mineQueue: new Set(),
      bills: [], techsDone: [], research: null,
      zones: { stock: new Set(), farms: [], defense: null, graveyard: null, weddingSpot: null },
      weather: 'clear', weatherUntil: 0, tempEvent: null, eclipseUntil: 0, auroraUntil: 0, tempOut: 15,
      threat: false, fireCount: 0, caravan: null,
      stats: { colonistDeaths: 0, raids: 0, raidsSurvived: 0, harvested: 0, built: 0, outbreaks: 0, blights: 0, binged: 0, buildingsLost: 0 },
      fx: [],
      gameOverState: null,
      uiDirty: true,
    };
    globalThis.W = world;
    world.t = 7 * 60; // land in the morning light
    world.biome = rng.pick(['temperate', 'temperate', 'boreal', 'arid']);
    world.map = new GameMap(BAL.MAP_W, BAL.MAP_H);
    world.map.gen(rng, world.biome);
    world.colonyName = Names.colony(rng);
    world.shipName = Names.ship(rng);
    world.factions = {
      pirate: Sim.makeFaction(world, 'pirate'),
      tribe: Sim.makeFaction(world, 'tribe'),
      outlander: { name: Names.faction(rng, 'outlander') },
    };
    Chron.init(world);
    Overseer.init(world);
    Storyteller.init(world);
    Sim.deriveTime(world);
    Sim.computeTemp(world);
    Sim.landing(world);
    world.map.recomputeRooms(world);
    Overseer.tickHourly(world);
    Overseer.assignRolesDaily(world);
    return world;
  },

  makeFaction(world, kind) {
    const rng = world.rng;
    return {
      kind, name: Names.faction(rng, kind),
      leaderPawnName: Names.pawnName(rng, rng.chance(0.5) ? 'm' : 'f'),
      leaderTitle: kind === 'pirate' ? Names.pirateTitle(rng) : 'Chief',
      leaderAlive: true, grudge: 0, raidsLed: 0, rebuildAt: 0,
    };
  },

  landing(world) {
    const rng = world.rng;
    const home = world.map.home;
    const survivors = [];
    for (let i = 0; i < 3; i++) {
      const p = Pawn.make(world, {
        faction: 'colony',
        x: U.clamp(home.x + rng.ri(-2, 2), 1, world.map.w - 2),
        y: U.clamp(home.y + rng.ri(-2, 2), 1, world.map.h - 2),
      });
      world.pawns.push(p);
      world.byId[p.id] = p;
      survivors.push(p);
      p.addStory(world, `Survived the fall of the ${world.shipName}`);
      p.addThought(world, 'newWorldHope');
    }
    // guarantee a spread of basic competence among the three
    const ensure = (skill, lv) => {
      if (!survivors.some(p => p.skill(skill) >= lv)) {
        const p = rng.pick(survivors);
        p.skills[skill].lv = lv + rng.ri(0, 2);
        if (!p.skills[skill].pas) p.skills[skill].pas = 1;
      }
    };
    ensure('Plants', 5); ensure('Construction', 5); ensure('Cooking', 4); ensure('Shooting', 5); ensure('Medicine', 4);
    // the classic crashlander kit: one good rifle, one sidearm, one blade
    const bestShot = [...survivors].sort((a, b) => b.skill('Shooting') - a.skill('Shooting'))[0];
    bestShot.weapon = 'rifle';
    const rest = survivors.filter(p => p !== bestShot);
    rest[0].weapon = 'pistol';
    rest[1].weapon = 'knife';
    // scattered supplies from the wreck
    Things.drop(world, home.x - 1, home.y + 3, 'mealPack', 32);
    Things.drop(world, home.x - 1, home.y + 5, 'berries', 25);
    Things.drop(world, home.x + 2, home.y + 3, 'medkit', 5);
    Things.drop(world, home.x, home.y + 4, 'wood', 80);
    Things.drop(world, home.x + 1, home.y + 2, 'steel', 30);
    Things.drop(world, home.x - 2, home.y + 2, 'silver', 40);
    Things.drop(world, home.x + 3, home.y + 4, 'weaponItem', 1, { key: 'bow' });
    Things.drop(world, home.x - 3, home.y + 4, 'cloth', 20);
    for (let i = 0; i < 4; i++) world.fx.push({ kind: 'pod', x: home.x + rng.ri(-3, 3), y: home.y + rng.ri(-2, 4), t: world.t + i * 3 });
    // starting pet, sometimes
    if (rng.chance(0.55)) {
      const a = Animal.make(world, rng.chance(0.7) ? 'dog' : 'cat', home.x + 1, home.y + 1, { tame: true, name: Names.pet(rng) });
      a.ownerId = survivors[0].id; survivors[0].bondedPet = a.id; a.state = 'pet';
      world.animals.push(a); world.byId[a.id] = a;
    }
    Sim.spawnWildlife(world, 12);
    // opening chronicle
    const persona = PERSONAS[world.st.persona];
    Chron.chapter(world, 'Landfall');
    Chron.log(world, `The ${world.shipName} died in orbit with a sound like a struck bell, and fell as fire. Three escape pods reached the ground: ${U.listJoin(survivors.map(p => p.full()))}. ${U.cap(world.season.toLowerCase())} on an unnamed world, ${BIOMES[world.biome].n} as far as the eye can see. They have salvage, five medicine kits, one pistol — and no way home.`, { tone: 'summary', major: true, icon: '🚀' });
    Chron.log(world, `They are calling this place ${world.colonyName}.`, { tone: 'good', major: true, icon: '🏕️' });
    Chron.log(world, `(This chronicle is kept in the manner of ${persona.n}: ${persona.d}.)`, { tone: 'neutral' });
    for (const p of survivors) {
      Chron.log(world, `${p.full()}, ${p.ageYears(world)} — ${p.childhood.n.toLowerCase()} turned ${p.adulthood ? p.adulthood.n.toLowerCase() : 'survivor'}; ${TRAITS[p.traits[0]].n.toLowerCase()}${p.traits[1] ? ' and ' + TRAITS[p.traits[1]].n.toLowerCase() : ''}.`, { tone: 'neutral', icon: '👤' });
    }
  },

  spawnWildlife(world, n) {
    const rng = world.rng;
    for (let i = 0; i < n; i++) {
      const species = rng.pickw([
        { k: 'deer', w: 5 }, { k: 'hare', w: 5 }, { k: 'turkey', w: 3 }, { k: 'boar', w: 2 }, { k: 'fox', w: 1.5 },
      ], o => o.w).k;
      const spot = world.map.randomEdgeSpot(rng, world);
      const a = Animal.make(world, species, U.clamp(spot.x + rng.ri(-4, 4), 1, world.map.w - 2), U.clamp(spot.y + rng.ri(-4, 4), 1, world.map.h - 2));
      world.animals.push(a);
      world.byId[a.id] = a;
    }
  },

  // ---- time & environment --------------------------------------------------
  deriveTime(world) {
    world.day = Math.floor(world.t / BAL.MIN_PER_DAY);
    world.hourOfDay = Math.floor((world.t % BAL.MIN_PER_DAY) / 60);
    world.dayOfSeason = world.day % BAL.DAYS_PER_SEASON;
    world.seasonIx = Math.floor(world.day / BAL.DAYS_PER_SEASON) % 4;
    world.season = SEASONS[world.seasonIx];
    world.year0 = Math.floor(world.day / world.daysPerYear);
    world.isNight = world.hourOfDay < 6 || world.hourOfDay >= 22 || world.t < world.eclipseUntil;
  },

  computeTemp(world) {
    const B = BIOMES[world.biome];
    // interpolate between season midpoints for smooth drift
    const segLen = BAL.DAYS_PER_SEASON;
    const pos = (world.day % world.daysPerYear) / segLen; // 0..4
    const idx = Math.floor(pos), frac = pos - idx;
    const cur = SEASON_TEMP[SEASONS[idx % 4]], next = SEASON_TEMP[SEASONS[(idx + 1) % 4]];
    let temp = B.tBase + U.lerp(cur, next, frac) * B.tSwing;
    temp += Math.sin(((world.hourOfDay - 9) / 24) * Math.PI * 2) * 4.5; // diurnal
    if (world.tempEvent) {
      if (world.t > world.tempEvent.until) world.tempEvent = null;
      else temp += world.tempEvent.delta;
    }
    if (world.weather === 'rain' || world.weather === 'storm') temp -= 2;
    world.tempOut = Math.round(temp * 10) / 10;
  },

  tempAt(world, p) {
    const room = world.map.roomAt(Math.round(p.x), Math.round(p.y));
    if (!room || !room.indoor) return world.tempOut;
    let indoor = world.tempOut + (18 - world.tempOut) * 0.55;
    if (room.heat > 0 && indoor < 21) indoor = Math.min(21, indoor + room.heat * 0.6);
    return Math.round(indoor * 10) / 10;
  },

  tickWeather(world) {
    if (world.weatherUntil && world.t > world.weatherUntil) {
      if (world.weather === 'storm') { world.weather = 'rain'; world.weatherUntil = world.t + world.rng.ri(100, 260); }
      else { world.weather = 'clear'; world.weatherUntil = 0; }
      return;
    }
    if (world.t % 60 !== 17) return;
    const rng = world.rng;
    if (world.weather === 'clear') {
      const rainChance = { Spring: 0.08, Summer: 0.045, Fall: 0.075, Winter: 0.06 }[world.season];
      if (rng.chance(rainChance)) { world.weather = 'rain'; world.weatherUntil = world.t + rng.ri(180, 500); }
    } else if (world.weather === 'rain' && !world.weatherUntil) {
      world.weather = 'clear';
    }
    // lightning during storms
    if (world.weather === 'storm' && rng.chance(0.5)) {
      const x = rng.ri(2, world.map.w - 3), y = rng.ri(2, world.map.h - 3);
      world.fx.push({ kind: 'lightning', x, y, t: world.t });
      Sim.igniteTile(world, x, y, 40);
      for (const p of world.pawns) {
        if (!p.dead && Math.abs(p.x - x) < 1.5 && Math.abs(p.y - y) < 1.5) {
          p.applyDamage(world, 30, 'burn', 'a lightning strike');
          Chron.log(world, `Lightning struck ${p.label()}! The smell of ozone and singed hair everywhere.`, { icon: ICONS.storm, tone: 'bad', major: true, at: p });
        }
      }
    }
  },

  // ---- fire ----------------------------------------------------------------
  igniteTile(world, x, y, amt) {
    if (!world.map.inb(x, y)) return;
    const i = world.map.idx(x, y);
    const t = world.map.terr[i];
    if (t === TERR.WATER || t === TERR.MARSH) return;
    let fuel = 0;
    if (world.map.plantG[i]) fuel = 1;
    if (world.map.floor[i] === 1) fuel = 1;
    const bid = world.map.bIdx[i];
    if (bid) {
      const b = world.byId[bid];
      if (b && !b.blueprint && BUILDINGS[b.key].flam > 0.2) fuel = 1;
    }
    if (world.map.terr[i] === TERR.SOIL || world.map.terr[i] === TERR.RICH) fuel = Math.max(fuel, 0.5); // dry grass
    if (fuel > 0) {
      world.map.fireG[i] = Math.min(250, world.map.fireG[i] + amt);
      Sim.recountFires(world);
    }
  },

  recountFires(world) {
    let n = 0;
    const g = world.map.fireG;
    for (let i = 0; i < g.length; i++) if (g[i]) n++;
    world.fireCount = n;
  },

  tickFires(world) {
    if (!world.fireCount) return;
    const map = world.map;
    const rng = world.rng;
    const wet = world.weather === 'rain' || world.weather === 'storm';
    let count = 0;
    for (let i = 0; i < map.fireG.length; i++) {
      let f = map.fireG[i];
      if (!f) continue;
      const x = i % map.w, y = Math.floor(i / map.w);
      // burn what's here
      const pl = map.plantG[i];
      if (pl && rng.chance(0.12)) { map.plantG[i] = null; }
      const bid = map.bIdx[i];
      if (bid) {
        const b = world.byId[bid];
        if (b && !b.blueprint) {
          const flam = BUILDINGS[b.key].flam;
          if (flam > 0 && rng.chance(0.5)) {
            if (Things.damageBuilding(world, b, 4 + f / 40)) world.stats.buildingsLost++;
          }
        }
      }
      if (map.floor[i] === 1 && rng.chance(0.02)) map.floor[i] = 0;
      // spread
      if (f > 30 && rng.chance(BAL.fireSpreadPerMin * 2 * (world.season === 'Summer' ? 1.4 : 1))) {
        const d = rng.ri(0, 3);
        const nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d];
        Sim.igniteTile(world, nx, ny, 25);
      }
      // decay: fuel burns out; rain quenches
      let decay = 1.1;
      if (wet) decay += BAL.rainExtinguishMult;
      if (!pl && !bid && map.floor[i] !== 1) decay += 2.2;
      f -= decay;
      map.fireG[i] = f <= 0 ? 0 : Math.min(250, f + (pl || bid ? 2 : 0));
      if (map.fireG[i]) count++;
    }
    world.fireCount = count;
    // burns for pawns standing in flame
    for (const p of world.pawns) {
      if (p.dead) continue;
      const i = map.idx(Math.round(p.x), Math.round(p.y));
      if (map.fireG[i] && rng.chance(0.25)) p.applyDamage(world, 3, 'burn', 'the flames');
    }
  },

  // ---- plants ----------------------------------------------------------------
  tickPlantsHourly(world) {
    const map = world.map;
    const daylight = world.hourOfDay >= 6 && world.hourOfDay <= 19;
    // cold slows growth before it stops it entirely
    const growFactor = daylight ? U.clamp((world.tempOut - 1) / 9, 0, 1) : 0;
    const freezing = world.tempOut < -2;
    const rng = world.rng;
    for (let i = 0; i < map.plantG.length; i++) {
      const pl = map.plantG[i];
      if (!pl) continue;
      const def = PLANTS[pl.kind];
      if (freezing && def.crop && !def.hardy && rng.chance(0.25)) { map.plantG[i] = null; continue; }
      if (growFactor > 0 && pl.growth < 1) pl.growth = Math.min(1, pl.growth + growFactor / (def.growD * 12));
    }
    // slow reforestation at the wild edges
    if (world.t % (BAL.MIN_PER_DAY) < 60) {
      for (let k = 0; k < 14; k++) {
        const i = rng.ri(0, map.plantG.length - 1);
        if (map.plantG[i] || map.rock[i] || map.bIdx[i]) continue;
        const t = map.terr[i];
        if (t !== TERR.SOIL && t !== TERR.RICH) continue;
        const x = i % map.w, y = Math.floor(i / map.w);
        if (U.dist(x, y, map.home.x, map.home.y) < 22) continue;
        // near an existing tree?
        let nearTree = false;
        for (let dy = -2; dy <= 2 && !nearTree; dy++) for (let dx = -2; dx <= 2; dx++) {
          const j = map.idx(U.clamp(x + dx, 0, map.w - 1), U.clamp(y + dy, 0, map.h - 1));
          const q = map.plantG[j];
          if (q && PLANTS[q.kind].tree) { nearTree = true; break; }
        }
        if (nearTree) map.plantG[i] = { kind: rng.pick(['pine', 'birch', 'oak']), growth: 0.05, i };
        else if (rng.chance(0.3)) map.plantG[i] = { kind: 'grass', growth: 0.2, i };
      }
    }
  },

  // ---- deaths ----------------------------------------------------------------
  onPawnDied(world, p, cause, srcLabel) {
    const wasColonist = p.faction === 'colony' && !p.prisoner;
    Things.dropCorpse(world, p);
    if (p.weapon && p.weapon !== 'fists') Things.drop(world, Math.round(p.x), Math.round(p.y), 'weaponItem', 1, { key: p.weapon });
    if (p.inBedId) p.inBedId = null;
    // clean bed ownership
    for (const b of world.buildings) {
      if (b.ownerId === p.id) b.ownerId = null;
      if (b.owner2Id === p.id) b.owner2Id = null;
    }
    if (wasColonist) {
      world.stats.colonistDeaths++;
      world.chron.seasonStats.deaths.push(p.label());
      Chron.log(world, Chron.deathProse(world, p, cause, srcLabel), { icon: ICONS.death, tone: 'bad', major: true });
      Chron.remember(world, { kind: 'death', text: `${p.label()} died — ${cause}`, pawns: [p.spouseId, p.loverId, ...p.family.kids, p.family.mo, p.family.fa].filter(Boolean) });
      Chron.maybeChapter(world, 'death', null);
      Renderer.cinematic(world, `${p.full()} has died`, p, 7);
      // grief
      for (const q of world.pawns) {
        if (!q.isColonist() || q === p || q.dead) continue;
        if (q.spouseId === p.id || q.loverId === p.id) {
          q.addThought(world, 'spouseDied', { who: p.id });
          q.addStory(world, `Lost ${q.spouseId === p.id ? (q.gender === 'm' ? 'his' : q.gender === 'f' ? 'her' : 'their') : 'a'} beloved ${p.label()}`);
          if (q.spouseId === p.id) { q.widowed = p.label(); q.spouseId = null; }
          if (q.loverId === p.id) q.loverId = null;
        } else if (q.family.mo === p.id || q.family.fa === p.id || q.family.kids.includes(p.id)) {
          q.addThought(world, 'familyDied', { who: p.id });
        } else {
          const op = Social.opinion(q, p);
          if (op >= 25) q.addThought(world, 'friendDied', { who: p.id });
          else if (op <= -25) q.addThought(world, 'rivalDied', { who: p.id });
          else q.addThought(world, 'colonistDied');
        }
        if (U.dist(q.x, q.y, p.x, p.y) < 9) q.addThought(world, 'witnessedDeath');
      }
      world.plan.firstDeathSeen = true;
      Overseer.requestGrave(world);
      // orphaned baby note
      for (const kidId of p.family.kids) {
        const kid = world.byId[kidId];
        if (kid && kid.isColonist() && kid.stage(world) !== 'adult') {
          const other = world.byId[kid.family.mo === p.id ? kid.family.fa : kid.family.mo];
          if (!other || other.dead) Chron.log(world, `${kid.label()} is an orphan now. The colony, without discussing it, has ${world.rng.ri(2, 5)} new parents.`, { icon: '🤝', tone: 'neutral', major: true });
        }
      }
    } else if (p.prisoner) {
      Chron.log(world, `The prisoner ${p.full()} died in the cell — ${cause}. ${world.rng.chance(0.5) ? 'The wardens took it harder than they expected.' : ''}`, { icon: ICONS.death, tone: 'bad' });
    } else if (p.faction === 'outlander') {
      Chron.log(world, `${p.full()} of ${world.factions.outlander.name} died here — ${cause}. Their people will hear of how it happened.`, { icon: ICONS.death, tone: 'bad' });
    }
    // detach from raid rosters; remove from active lists at cleanup
    Sim.removeFromWorld(world, p, true);
  },

  onAnimalDied(world, a, srcLabel) {
    const spot = { x: Math.round(a.x), y: Math.round(a.y) };
    const stack = { id: U.uid(), thing: 'item', kind: 'corpse', qty: 1, x: spot.x, y: spot.y, day: world.day, meta: { animal: true, species: a.species, label: a.label(), faction: 'wild' } };
    const free = world.map.findSpotNear(spot.x, spot.y, 5, (x, y) => !world.map.itemG[world.map.idx(x, y)] && world.map.standable(x, y, world));
    if (free) { stack.x = free.x; stack.y = free.y; }
    world.items.push(stack); world.byId[stack.id] = stack;
    world.map.itemG[world.map.idx(stack.x, stack.y)] = stack.id;
    if (a.tame && !a.caravan) {
      for (const p of world.pawns) {
        if (!p.isColonist()) continue;
        p.addThought(world, 'petDied', { mult: p.bondedPet === a.id ? 1.6 : 1 });
        if (p.bondedPet === a.id) p.bondedPet = null;
      }
      Chron.log(world, `${a.name} the ${a.def().n} is dead${srcLabel ? ` — ${srcLabel}` : ''}. ${world.rng.pick(['The food bowl stays where it is. Nobody can bear to move it.', 'It died the way it lived: between the colony and trouble.', 'Small grave, big silence.'])}`, { icon: ICONS.pet, tone: 'bad', major: true });
      Chron.remember(world, { kind: 'petDeath', text: `${a.name} the ${a.def().n} died`, pawns: [] });
    }
    const ix = world.animals.indexOf(a);
    if (ix >= 0) world.animals.splice(ix, 1);
    const hq = world.huntQueue.indexOf(a.id);
    if (hq >= 0) world.huntQueue.splice(hq, 1);
  },

  removeFromWorld(world, p, keepDead) {
    const ix = world.pawns.indexOf(p);
    if (ix >= 0) world.pawns.splice(ix, 1);
    for (const g of world.gatherings) {
      const gi = g.guests.indexOf(p.id);
      if (gi >= 0) g.guests.splice(gi, 1);
    }
    world.captureQueue = world.captureQueue.filter(cq => cq.pawnId !== p.id);
    // byId entry is kept: thoughts, memories and family links still reference it
  },

  despawnPawn(world, p, reason) {
    if (p.kidnapping) {
      const victim = world.byId[p.kidnapping];
      if (victim && !victim.dead) {
        Sim.removeFromWorld(world, victim);
        victim.gone = 'kidnapped';
        victim.goneDay = world.day;
        world.gonePawns.push(victim);
        for (const q of world.pawns) if (q.isColonist()) q.addThought(world, 'kidnappedColonist');
        Chron.log(world, `They took ${victim.label()}. Dragged ${victim.him} off the map's edge while the colony fought elsewhere. The chronicle does not forgive; it only waits.`, { icon: ICONS.raid, tone: 'bad', major: true });
        Chron.remember(world, { kind: 'kidnap', text: `${victim.label()} was carried off by raiders`, pawns: [] });
      }
    }
    p.gone = 'exited';
    Sim.removeFromWorld(world, p);
    if (p.caravanMuffalo) { /* handled below */ }
  },

  // ---- breaks & inspiration --------------------------------------------------
  tickBreaksHourly(world, p) {
    if (p.breaking || p.downed || p.dead || p.stage(world) === 'baby' || p.stage(world) === 'toddler') return;
    if (!p.isColonist()) return;
    if ((p.breakCooldownUntil || 0) > world.t) return; // catharsis buys a stretch of stability
    const rng = world.rng;
    const mood = p.mood;
    let sev = null;
    if (mood < p.breakThreshold('extreme') && rng.chance(0.30)) sev = 'extreme';
    else if (mood < p.breakThreshold('major') && rng.chance(0.22)) sev = 'major';
    else if (mood < p.breakThreshold('minor') && rng.chance(BAL.breakCheckPerHour)) sev = 'minor';
    if (sev) { Sim.startBreak(world, p, sev); return; }
    // inspiration on the happy end
    if (mood > 85 && !p.inspired && rng.chance(p.hasTrait('dreamer') ? 0.05 : 0.012)) {
      p.inspired = rng.chance(0.5) ? 'art' : 'frenzy';
      p.addThought(world, 'inspired');
      Chron.log(world, `${p.label()} woke with fire behind the eyes — ${p.inspired === 'art' ? 'an image demanding stone' : 'a manic clarity of purpose'}. ${U.cap(Chron.quip(world, p) || 'inspiration has struck')}.`, { icon: ICONS.joy, tone: 'good' });
    }
  },

  startBreak(world, p, sev) {
    const rng = world.rng;
    let kind, dur;
    const colonists = world.pawns.filter(q => q.isColonist()).length;
    if (p.hasTrait('pyromaniac') && sev !== 'minor') kind = 'fire';
    else if (sev === 'extreme') kind = rng.pickw([{ k: 'berserk', w: 3 }, { k: 'leave', w: colonists > 2 ? 2 : 0.1 }], o => o.w).k;
    else if (sev === 'major') kind = rng.pick(['tantrum', 'binge', 'wander']);
    else kind = rng.pick(['wander', 'binge', 'hide']);
    dur = sev === 'minor' ? rng.ri(90, 150) : sev === 'major' ? rng.ri(140, 220) : rng.ri(180, 280);
    p.breaking = { kind, end: world.t + dur, sev };
    Jobs.endJob(world, p);
    world.chron.seasonStats.breaks++;
    const why = p.thoughts.filter(t => t.m < -4).map(t => THOUGHTS[t.k] ? THOUGHTS[t.k].l : '').filter(Boolean).slice(0, 2);
    const whyTxt = why.length ? ` (${why.join('; ')})` : '';
    const prose = {
      wander: `${p.label()} has stopped working and wanders the grounds, eyes down${whyTxt}.`,
      binge: `${p.label()} broke — and is eating ${p.his} feelings, straight from the larder${whyTxt}.`,
      hide: `${p.label()} has shut ${p.him}self away and won't answer the door${whyTxt}.`,
      tantrum: `${p.label()} is smashing things! ${U.cap(Chron.quip(world, p) || 'the anger has to go somewhere')}${whyTxt}.`,
      berserk: `${p.label()} has snapped — berserk, swinging at anyone in reach${whyTxt}!`,
      fire: `${p.label()}'s eyes have gone bright and wrong. ${U.cap(p.he)} is lighting fires${whyTxt}!`,
      leave: `${p.label()} is packing to leave. ${U.cap(p.he)} says the colony was a mistake${whyTxt}.`,
    }[kind];
    // minor wobbles only sometimes make the chronicle; major breaks always do
    if (sev !== 'minor' || world.rng.chance(0.45)) {
      Chron.log(world, prose, { icon: ICONS.break, tone: 'bad', major: sev !== 'minor', at: p });
    }
    if (sev !== 'minor') Renderer.focus(world, p.x, p.y, 6, `${p.label()} — mental break!`);
  },

  // ---- aging ------------------------------------------------------------------
  tickAgingDaily(world) {
    const yearLen = world.daysPerYear;
    for (const p of world.pawns) {
      if (p.dead) continue;
      const before = Math.floor(p.ageDays / yearLen);
      const rate = (p.faction === 'colony' && Math.floor(p.ageDays / yearLen) < BAL.adultAt) ? BAL.childAgeMult : 1;
      p.ageDays += rate;
      const after = Math.floor(p.ageDays / yearLen);
      if (after > before && p.isColonist()) {
        if (after === BAL.workAt) {
          Chron.log(world, `${p.label()} is ${after} today — old enough to haul, harvest, and get underfoot in a useful way.`, { icon: '🎂', tone: 'good' });
        } else if (after === BAL.adultAt) {
          Chron.log(world, `${p.label()} comes of age today. ${U.cap(p.he)} ${p.gender === 'nb' ? 'take' : 'takes'} a full share of the work — and of the watch.`, { icon: '🎂', tone: 'good', major: true });
          p.addStory(world, `Came of age at ${world.colonyName}`);
          Overseer.assignRolesDaily(world);
        } else if (world.rng.chance(0.35)) {
          const fam = [p.family.mo, p.family.fa].map(id => world.byId[id]).filter(q => q && !q.dead);
          for (const f of fam) f.addThought(world, 'childBirthday');
          if (after >= 60 || world.rng.chance(0.25)) Chron.log(world, `${p.label()} turns ${after} today.`, { icon: '🎂', tone: 'neutral' });
        }
      }
    }
  },

  // ---- misc hourly ------------------------------------------------------------
  tickHouseholdHourly(world) {
    // hearths & campfires light up in cold/dark, drink wood daily
    for (const b of world.buildings) {
      if (b.blueprint) continue;
      const def = BUILDINGS[b.key];
      if (def.fire) b.lit = (world.tempOut < 15 || world.isNight);
      if (def.light && !def.fire) b.lit = world.isNight;
    }
    // pod survivors who healed up decide to stay
    for (const p of world.pawns) {
      if (p.podSurvivor && !p.downed && !p.needsTending() && p.blood > 0.85) {
        p.podSurvivor = false;
        for (const q of world.pawns) if (q.isColonist() && q !== p) q.addThought(world, 'newColonist');
        Chron.log(world, `${p.full()} is back on ${p.his} feet — and staying. "${world.rng.pick(['You pulled me out of the wreck. That buys a lifetime.', 'Nowhere else to fall, anyway.', 'I owe you a life. I pay my debts.'])}"`, { icon: ICONS.arrive, tone: 'good', major: true });
        p.addStory(world, `Rescued from a crashed pod; chose to stay`);
        Chron.remember(world, { kind: 'recruit', text: `${p.label()} was pulled from a crashed pod and joined`, pawns: [p.id] });
        Overseer.assignRolesDaily(world);
      }
    }
    // downed hostiles left on the field crawl away eventually
    for (const q of [...world.pawns]) {
      if ((q.faction === 'pirate' || q.faction === 'tribe') && q.downed && !q.prisoner && !q.dead) {
        if (q.capConscious() > 0.42 && q.blood > 0.6) {
          q.downed = false; q.fleeing = true;
          if (world.rng.chance(0.4)) Chron.log(world, `A wounded raider dragged ${q.him}self up and limped for the treeline. Nobody wasted a bullet.`, { icon: '🩸', tone: 'neutral' });
        } else if (world.rng.chance(0.02)) {
          q.die(world, 'succumbed to wounds on the field');
        }
      }
    }
    // caravan cleanup when the trader leaves or dies
    if (world.caravan) {
      const trader = world.byId[world.caravan.traderId];
      if (!trader || trader.dead || trader.gone) {
        const muff = world.byId[world.caravan.muffaloId];
        if (muff && !muff.dead) {
          const ai = world.animals.indexOf(muff);
          if (ai >= 0) world.animals.splice(ai, 1);
        }
        world.caravan = null;
      } else if (!world.caravan.traded && world.t - world.caravan.at > 90) {
        GameEvents.doTrade(world);
      }
    }
    // fresh wildlife wanders in as stock dwindles
    const wildCount = world.animals.filter(a => !a.dead && !a.tame && !a.manhunter).length;
    if (wildCount < 8 && world.rng.chance(0.25)) Sim.spawnWildlife(world, world.rng.ri(1, 3));
  },

  colonyWealth(world) {
    let wealth = BAL.wealthBase;
    for (const s of world.items) wealth += (ITEMS[s.kind] ? ITEMS[s.kind].v : 1) * s.qty + (s.meta && s.meta.key ? (WEAPONS[s.meta.key] || APPAREL[s.meta.key] || { v: 0 }).v : 0);
    for (const b of world.buildings) if (!b.blueprint) wealth += BUILDINGS[b.key].v * (b.quality || 1);
    wealth += world.pawns.filter(p => p.isColonist()).length * 220;
    return Math.round(wealth);
  },

  // ---- the master tick --------------------------------------------------------
  tick(world) {
    world.t++;
    const prevSeason = world.season, prevYear = world.year0, prevDay = world.day;
    Sim.deriveTime(world);
    const hourly = world.t % 60 === 0;
    const newDay = world.day !== prevDay;

    Sim.tickWeather(world);
    if (hourly) Sim.computeTemp(world);
    if (world.t % 2 === 0) Sim.tickFires(world);
    if (hourly) Sim.tickPlantsHourly(world);
    if (world.map.roomsDirty && world.t % 20 === 0) world.map.recomputeRooms(world);
    if (world.t % 3 === 0) Combat.updateThreat(world);
    if (world.t % 5 === 0) Combat.tickRaids(world);

    // pawns
    for (const p of [...world.pawns]) {
      if (p.dead || p.gone) continue;
      if (p.cd > 0) p.cd--;
      p.tickNeeds(world);
      // ambient chatter: people who work side by side become people who talk
      if ((world.t + p.id) % 47 === 0 && p.isColonist() && !p.downed && !p.breaking && p.stage(world) === 'adult') {
        const q = world.pawns.find(o => o !== p && o.isColonist() && !o.downed && !o.breaking && U.dist(p.x, p.y, o.x, o.y) < 3.2);
        if (q && world.rng.chance(0.6)) Social.interact(world, p, q, 'work');
      }
      if (p.stage(world) === 'baby') {
        p.needs.rest = 1;
        if ((world.t + p.id) % 60 === 0) p.tickHealthHourly(world);
        continue;
      }
      if (!p.downed) Jobs.step(world, p);
      if ((world.t + p.id) % 60 === 0) { p.tickHealthHourly(world); Sim.tickBreaksHourly(world, p); }
    }
    // animals
    for (const a of [...world.animals]) Combat.tickAnimal(world, a);

    Social.tickFights(world);
    Social.tickGatherings(world);
    if (world.t % 10 === 0) Social.maybeFiresideTales(world);

    if (hourly) {
      Storyteller.tickHourly(world);
      Overseer.tickHourly(world);
      Sim.tickHouseholdHourly(world);
      if (world.hourOfDay === 11) Social.processWeddings(world);
    }

    if (newDay) {
      Sim.tickAgingDaily(world);
      Social.tickRelationsDaily(world);
      Chron.tickDaily(world);
      Storyteller.tickDaily(world);
      Overseer.assignRolesDaily(world);
      const lost = Things.tickRotDaily(world);
      if (lost > 20) Chron.log(world, `${lost} units of food spoiled in the heat. The cooks are furious at everyone and no one.`, { icon: '🤢', tone: 'bad' });
      // fuel for the fires
      let lit = world.buildings.filter(b => !b.blueprint && BUILDINGS[b.key].fire && b.lit).length;
      if (lit > 0) {
        let need = lit * 2;
        for (const s of [...world.items]) {
          if (need <= 0) break;
          if (s.kind === 'wood' && !s.carried) need -= Things.take(world, s, need);
        }
      }
      // unburied colonist corpses weigh on everyone
      const unburied = world.items.some(s => s.kind === 'corpse' && s.meta.faction === 'colony' && !s.meta.animal);
      if (unburied) for (const p of world.pawns) if (p.isColonist()) p.addThought(world, 'unburiedDead');
      // calendar events
      if (world.day > 0 && world.day % world.daysPerYear === 0) GameEvents.foundingDay(world);
      if (world.dayOfSeason === 0 && world.season === 'Fall' && world.day > 0) GameEvents.harvestFestival(world);
      // faction leadership recovers in time
      for (const key of ['pirate', 'tribe']) {
        const fac = world.factions[key];
        if (!fac.leaderAlive && fac.rebuildAt && world.day >= fac.rebuildAt) {
          fac.leaderAlive = true;
          fac.leaderPawnName = Names.pawnName(world.rng, world.rng.chance(0.5) ? 'm' : 'f');
          fac.raidsLed = 0;
          Chron.log(world, `Word from a passing trader: the ${fac.name} have a new ${fac.leaderTitle.toLowerCase()} — ${fac.leaderTitle} ${fac.leaderPawnName.first}. May they be wiser than the last. (They won't be.)`, { icon: '🏴', tone: 'neutral' });
          fac.rebuildAt = 0;
        }
      }
    }

    if (world.season !== prevSeason) {
      Chron.seasonSummary(world, prevSeason);
      if (world.season === 'Winter') Chron.maybeChapter(world, 'winter', Names.chapterTitle(world.rng, 'Winter'));
    }
    if (world.year0 !== prevYear) Chron.yearSummary(world);

    // fx expiry
    if (world.fx.length > 130) world.fx.splice(0, world.fx.length - 130);

    // the end of the chronicle?
    if (!world.gameOverState) {
      const colonists = world.pawns.filter(p => p.isColonist());
      if (colonists.length === 0) Sim.gameOver(world);
      else if (!world.strangerCame && colonists.every(p => p.downed) && colonists.length >= 1 && world.t % 30 === 0) {
        // the oldest mercy on the rim: when all hope is down, a stranger walks out of the dust
        world.strangerCame = true;
        const edge = world.map.randomEdgeSpot(world.rng, world);
        const p = Pawn.make(world, { faction: 'colony', x: edge.x, y: edge.y, weapon: 'revolver' });
        p.skills.Medicine.lv = Math.max(p.skills.Medicine.lv, 7);
        p.apparel = 'coat';
        world.pawns.push(p); world.byId[p.id] = p;
        Overseer.assignRolesDaily(world);
        Chron.log(world, `Every colonist lies in the dirt, bleeding into ${world.colonyName}'s soil — and then, at the edge of the map, a stranger. ${p.full()}, coat black as a closed book, walking in without hurry. "${world.rng.pick(["Heard there was trouble.", "Looks like I'm late.", "Don't die yet. I just got here."])}"`, { icon: '🥷', tone: 'good', major: true });
        Chron.remember(world, { kind: 'stranger', text: `a stranger in black saved the colony from its darkest hour`, pawns: [p.id] });
        Chron.maybeChapter(world, 'stranger', 'The Stranger');
        Renderer.cinematic(world, `A stranger arrives at the darkest hour`, p, 9);
      }
    }
  },

  gameOver(world) {
    world.gameOverState = { day: world.day, t: world.t };
    const graves = world.buildings.filter(b => !b.blueprint && BUILDINGS[b.key].grave && b.meta && b.meta.occupant);
    Chron.chapter(world, `The Last Page`);
    Chron.log(world, `There is no one left to write this. ${world.colonyName} stood ${world.day} days — ${world.year0 >= 1 ? (world.year0 + ' ' + U.plural(world.year0, 'year') + ' and change') : 'not even a year'}. ${graves.length ? graves.length + ' graves on the hill keep the only record that matters.' : 'The wind can have what remains.'} Somewhere above, the wreck of the ${world.shipName} still crosses the night sky, and no fire answers it now.`, { icon: '🕯️', tone: 'bad', major: true });
  },

  // ---- save / load -----------------------------------------------------------
  save(world) {
    const strip = (p) => {
      const o = { ...p };
      delete o.job; delete o.path; delete o.pathGoalX; delete o.pathGoalY; delete o.station; delete o.rng;
      o.disables = p.disables ? [...p.disables] : [];
      return o;
    };
    const data = {
      v: 1, seed: world.seed, rngS: world.rng.s, t: world.t,
      biome: world.biome, colonyName: world.colonyName, shipName: world.shipName,
      techsDone: world.techsDone, research: world.research, stats: world.stats, factions: world.factions,
      st: world.st, plan: world.plan, chron: world.chron, bills: world.bills,
      caravan: world.caravan, threat: false,
      weather: world.weather, weatherUntil: world.weatherUntil, tempEvent: world.tempEvent,
      eclipseUntil: world.eclipseUntil, auroraUntil: world.auroraUntil,
      zones: {
        stock: [...world.zones.stock], farms: world.zones.farms, defense: world.zones.defense,
        graveyard: world.zones.graveyard, weddingSpot: world.zones.weddingSpot,
      },
      huntQueue: world.huntQueue, chopQueue: [...world.chopQueue], mineQueue: [...world.mineQueue],
      weddingQueue: world.weddingQueue, affairs: world.affairs, gonePawns: world.gonePawns.map(strip),
      pawns: world.pawns.map(strip),
      animals: world.animals.map(a => { const o = { ...a }; delete o.path; delete o.target2; return o; }),
      items: world.items,
      buildings: world.buildings,
      map: {
        w: world.map.w, h: world.map.h, home: world.map.home, vault: world.map.vault, biome: world.map.biome,
        terr: Array.from(world.map.terr), rock: Array.from(world.map.rock), ore: Array.from(world.map.ore),
        floor: Array.from(world.map.floor), filth: Array.from(world.map.filth),
        plants: world.map.plantG.map(pl => pl ? { k: pl.kind, g: Math.round(pl.growth * 100) / 100, i: pl.i, s: pl.sown ? 1 : 0 } : 0),
      },
    };
    return JSON.stringify(data);
  },

  load(json) {
    const d = JSON.parse(json);
    if (d.v !== 1) throw new Error('save version mismatch');
    const world = Sim.newWorldShell(d);
    globalThis.W = world;
    return world;
  },

  newWorldShell(d) {
    const rng = new RNG(d.seed);
    rng.s = d.rngS;
    const world = {
      v: 1, seed: d.seed, rng, t: d.t,
      daysPerYear: BAL.DAYS_PER_SEASON * 4,
      byId: {}, pawns: [], animals: [], items: d.items, buildings: d.buildings,
      raids: [], gatherings: [], fights: [], affairs: d.affairs || [], weddingQueue: d.weddingQueue || [],
      captureQueue: [], gonePawns: [],
      reservations: {}, tabuMap: {}, huntQueue: d.huntQueue || [], chopQueue: new Set(d.chopQueue || []), mineQueue: new Set(d.mineQueue || []),
      bills: d.bills || [], techsDone: d.techsDone || [], research: d.research,
      zones: { stock: new Set(d.zones.stock || []), farms: d.zones.farms || [], defense: d.zones.defense, graveyard: d.zones.graveyard, weddingSpot: d.zones.weddingSpot },
      weather: d.weather || 'clear', weatherUntil: d.weatherUntil || 0, tempEvent: d.tempEvent, eclipseUntil: d.eclipseUntil || 0, auroraUntil: d.auroraUntil || 0,
      tempOut: 15, threat: false, fireCount: 0, caravan: d.caravan,
      stats: d.stats, fx: [], gameOverState: null, uiDirty: true,
      biome: d.biome, colonyName: d.colonyName, shipName: d.shipName,
      factions: d.factions, st: d.st, plan: d.plan, chron: d.chron,
    };
    const map = new GameMap(d.map.w, d.map.h);
    map.biome = d.map.biome; map.home = d.map.home; map.vault = d.map.vault;
    map.terr.set(d.map.terr); map.rock.set(d.map.rock); map.ore.set(d.map.ore);
    map.floor.set(d.map.floor); map.filth.set(d.map.filth);
    for (let i = 0; i < d.map.plants.length; i++) {
      const pl = d.map.plants[i];
      map.plantG[i] = pl ? { kind: pl.k, growth: pl.g, i: pl.i, sown: !!pl.s } : null;
    }
    world.map = map;
    let maxId = 10;
    const revive = (data) => {
      const p = Object.assign(new Pawn(), data);
      p.disables = new Set(data.disables || []);
      p.job = null; p.path = null; p.mode = 'normal'; p.breaking = data.breaking || null;
      maxId = Math.max(maxId, p.id);
      return p;
    };
    for (const pd of d.pawns) { const p = revive(pd); world.pawns.push(p); world.byId[p.id] = p; }
    for (const pd of d.gonePawns || []) { const p = revive(pd); world.gonePawns.push(p); world.byId[p.id] = p; }
    for (const ad of d.animals) { const a = Object.assign(new Animal(), ad); a.path = null; world.animals.push(a); world.byId[a.id] = a; maxId = Math.max(maxId, a.id); }
    for (const s of world.items) { world.byId[s.id] = s; maxId = Math.max(maxId, s.id); const i = map.idx(s.x, s.y); if (!s.carried) map.itemG[i] = s.id; }
    for (const b of world.buildings) { world.byId[b.id] = b; maxId = Math.max(maxId, b.id); map.bIdx[map.idx(b.x, b.y)] = b.id; }
    U.setUidFloor(maxId + 1);
    // stray raiders from an interrupted battle just leave
    for (const p of world.pawns) if ((p.faction === 'pirate' || p.faction === 'tribe') && !p.prisoner) p.fleeing = true;
    Sim.deriveTime(world);
    Sim.computeTemp(world);
    map.recomputeRooms(world);
    Sim.recountFires(world);
    return world;
  },
};

Object.assign(globalThis, { Sim });
