// events.js — everything the storyteller can throw at the colony, plus long-arc
// mechanics: named antagonists, kidnappings and returns, the sealed vault.

const GameEvents = {
  // ---- raids ---------------------------------------------------------------
  raidPoints(world) {
    const wealth = Sim.colonyWealth(world);
    const pop = world.pawns.filter(p => p.isColonist()).length;
    let pts = BAL.raidBase + wealth * BAL.raidPerWealth + pop * BAL.raidPerPawn;
    pts *= 1 + world.year0 * 0.22;                // years since founding
    pts *= world.rng.rf(0.75, 1.25);
    // raids stay roughly proportional to the defenders — menace, not annihilation
    const cap = (1.5 + pop * 0.9 + world.year0 * 0.8) * 40;
    return Math.round(Math.min(pts, cap));
  },

  spawnRaid(world, opts = {}) {
    const rng = world.rng;
    const factionKey = opts.faction || (rng.chance(0.6) ? 'pirate' : 'tribe');
    const fac = world.factions[factionKey];
    let pts = opts.points || GameEvents.raidPoints(world);
    // small early bands carry scrap weapons; real guns come with real raids
    const roster = factionKey === 'pirate'
      ? (pts < 130
        ? [{ cost: 34, weapon: () => rng.pick(['pistol', 'knife', 'club', 'club', 'pistol']) },
           { cost: 40, weapon: () => rng.pick(['machete', 'spear']) }]
        : [{ cost: 34, weapon: () => rng.pick(['pistol', 'pistol', 'knife', 'club', 'shotgun']) },
           { cost: 48, weapon: () => rng.pick(['rifle', 'shotgun', 'revolver']) },
           { cost: 40, weapon: () => rng.pick(['machete', 'spear']) }])
      : [{ cost: 26, weapon: () => rng.pick(['spear', 'club', 'knife']) },
         { cost: 30, weapon: () => 'bow' }];
    const edge = world.map.randomEdgeSpot(rng, world);
    const members = [];
    let guard = 0;
    while (pts > 25 && members.length < 14 && guard++ < 40) {
      const kind = rng.pick(roster);
      if (kind.cost > pts && members.length >= 2) break;
      pts -= kind.cost;
      const p = Pawn.make(world, {
        faction: factionKey,
        age: rng.ri(18, 46),
        x: U.clamp(edge.x + rng.ri(-3, 3), 1, world.map.w - 2),
        y: U.clamp(edge.y + rng.ri(-3, 3), 1, world.map.h - 2),
        weapon: kind.weapon(),
        apparel: factionKey === 'pirate' ? rng.pick(['clothes', 'flak', 'coat']) : rng.pick(['rags', 'clothes']),
      });
      p.factionName = fac.name;
      world.pawns.push(p);
      world.byId[p.id] = p;
      members.push(p);
    }
    if (!members.length) return null;
    // leader: the named antagonist rides along on bigger or grudge raids
    let leaderName = null, leader = null;
    const wantLeader = fac.leaderAlive && (opts.vendetta || members.length >= 5 || fac.grudge >= 2);
    if (wantLeader) {
      leader = members[0];
      leader.name = fac.leaderPawnName;
      leader.weapon = factionKey === 'pirate' ? 'rifle' : 'bow';
      leader.apparel = 'flak';
      leader.skills.Shooting.lv = 9; leader.skills.Melee.lv = 8;
      leader.isLeader = true;
      leaderName = fac.leaderTitle + ' ' + leader.name.first;
      fac.raidsLed++;
    }
    const raid = {
      id: U.uid(), factionKey, factionName: fac.name, members: members.map(p => p.id), size: members.length,
      state: 'approach', startT: world.t, leaderId: leader ? leader.id : null, leaderName, leaderAlive: !!leader,
      deathsBefore: world.stats.colonistDeaths,
    };
    for (const p of members) p.raidId = raid.id;
    world.raids.push(raid);
    const desc = opts.vendetta
      ? `${leaderName} has returned for revenge — ${U.ordinal(fac.raidsLed)} raid against ${world.colonyName}! ${members.length} raiders pour in from the ${GameEvents.sideName(edge)}.`
      : `Raid! ${fac.name}${leaderName ? ', led by ' + leaderName + ',' : ''} — ${members.length} strong, closing from the ${GameEvents.sideName(edge)}.`;
    Chron.log(world, desc, { icon: ICONS.raid, tone: 'bad', major: true });
    Renderer.cinematic(world, desc, { x: edge.x, y: edge.y }, 8);
    world.stats.raids++;
    world.plan.firstRaidSeen = true;
    return raid;
  },

  sideName(edge) { return edge.side === 0 ? 'north' : edge.side === 1 ? 'south' : edge.side === 2 ? 'west' : 'east'; },

  raidOver(world, raid) {
    const fac = world.factions[raid.factionKey];
    const deaths = world.stats.colonistDeaths - raid.deathsBefore;
    const leader = world.byId[raid.leaderId];
    if (raid.leaderId) {
      if (leader && leader.dead) {
        fac.leaderAlive = false;
        Chron.log(world, `${raid.leaderName} lies dead in the dirt of ${world.colonyName}. The ${fac.name} will not soon find another like ${leader.him}.`, { icon: ICONS.raid, tone: 'good', major: true });
        Chron.remember(world, { kind: 'victory', text: `${raid.leaderName} of the ${fac.name} was slain`, pawns: [] });
        Chron.maybeChapter(world, 'nemesisDead', `The Fall of ${raid.leaderName}`);
        fac.grudge = 0;
        fac.rebuildAt = world.day + 20; // a successor rises later
      } else if (leader && (leader.gone || leader.fleeing)) {
        fac.grudge++;
        Chron.log(world, `${raid.leaderName} escaped again. Somewhere out there, ${leader.he} is counting ${leader.his} dead and hating us.`, { icon: ICONS.raid, tone: 'neutral', major: true });
      }
    }
    const colonists = world.pawns.filter(p => p.isColonist());
    for (const p of colonists) {
      p.stats.raidsFought++;
      if (deaths > 0) p.addThought(world, 'raidMauledUs');
      else p.addThought(world, 'raidRepelled');
    }
    if (deaths === 0) {
      Chron.log(world, Chron.pick(world, [
        `The raid is broken. ${world.colonyName} holds. Tonight there will be shaky hands and bad jokes and maybe a little beer.`,
        `Silence after gunfire. They came for everything and left with nothing. Not one of ours was lost.`,
        `It is over. The colonists walk the wall-line, counting each other twice.`,
      ]), { icon: ICONS.raid, tone: 'good', major: true });
      Chron.maybeChapter(world, 'raidWon', null);
    } else {
      Chron.log(world, `The raid is over. ${world.colonyName} paid in blood for its survival.`, { icon: ICONS.death, tone: 'bad', major: true });
    }
    Chron.remember(world, { kind: 'raid', text: `${world.colonyName} survived a raid by the ${raid.factionName}`, pawns: [] });
    world.stats.raidsSurvived++;
  },

  // ---- prisoners & population ---------------------------------------------
  prisonerJoins(world, q, warden) {
    q.prisoner = false;
    q.faction = 'colony';
    q.recruit = 0;
    q.mode = 'normal';
    q.joinedDay = world.day;
    q.addStory(world, `Renounced the ${q.factionName || 'raiders'} and joined ${world.colonyName}`);
    for (const p of world.pawns) if (p.isColonist() && p !== q) p.addThought(world, 'prisonerJoined');
    Chron.log(world, Chron.pick(world, [
      `${q.full()} has renounced the ${q.factionName || 'raider life'}. ${warden ? warden.label() + ' unlocked the cell ' + warden.his + 'self.' : ''} A raider yesterday; a colonist today. The rim is strange like that.`,
      `After ${world.day - q.joinedDay || 'many'} days of talk, bread, and patience, ${q.full()} chose to stay. ${world.colonyName} grows.`,
    ]), { icon: ICONS.arrive, tone: 'good', major: true });
    Chron.remember(world, { kind: 'recruit', text: `${q.label()} the former raider joined the colony`, pawns: [q.id] });
    Overseer.assignRolesDaily(world);
  },

  wandererJoins(world) {
    const edge = world.map.randomEdgeSpot(world.rng, world);
    const p = Pawn.make(world, { faction: 'colony', x: edge.x, y: edge.y });
    world.pawns.push(p); world.byId[p.id] = p;
    for (const q of world.pawns) if (q.isColonist() && q !== p) q.addThought(world, 'newColonist');
    const flavor = world.rng.pick([
      `carrying everything ${p.he} owns in one bag`,
      `half-starved and all pride`,
      `with a story ${p.he} tells three different ways`,
      `following the smoke of the cookfire`,
    ]);
    Chron.log(world, `${p.full()}, ${p.ageYears(world)}, ${p.adulthood ? 'once a ' + p.adulthood.n.toLowerCase() : 'a drifter'}, walked out of the wilds ${flavor} and asked to stay.`, { icon: ICONS.arrive, tone: 'good', major: true });
    p.addStory(world, `Wandered in and joined ${world.colonyName}`);
    Overseer.assignRolesDaily(world);
    Renderer.focus(world, p.x, p.y, 5, `${p.label()} joins the colony`);
    return p;
  },

  escapePod(world) {
    const map = world.map;
    const spot = map.findSpotNear(map.home.x + world.rng.ri(-18, 18), map.home.y + world.rng.ri(-18, 18), 14,
      (x, y) => map.standable(x, y, world));
    if (!spot) return;
    const p = Pawn.make(world, { faction: 'colony', x: spot.x, y: spot.y });
    p.podSurvivor = true;
    p.applyDamage(world, world.rng.ri(8, 16), 'bruise', 'the crash', { part: 'torso' });
    p.applyDamage(world, world.rng.ri(6, 12), 'cut', 'shredded metal');
    p.blood = 0.62; // urgent rescue drama
    world.pawns.push(p); world.byId[p.id] = p;
    world.fx.push({ kind: 'pod', x: spot.x, y: spot.y, t: world.t });
    Things.drop(world, spot.x, spot.y, 'steel', world.rng.ri(4, 10));
    Chron.log(world, `A drop pod screamed down ${GameEvents.dirFromHome(world, spot)} — someone is alive in the wreck! It's ${p.full()}, ${p.ageYears(world)}, badly hurt.`, { icon: '☄️', tone: 'neutral', major: true });
    Renderer.cinematic(world, `An escape pod falls: ${p.full()}`, spot, 7);
    return p;
  },

  dirFromHome(world, spot) {
    const home = world.map.home;
    const dx = spot.x - home.x, dy = spot.y - home.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'to the east' : 'to the west';
    return dy > 0 ? 'to the south' : 'to the north';
  },

  colonistWandersOff(world, p) {
    Sim.removeFromWorld(world, p);
    p.gone = 'wandered';
    p.goneDay = world.day;
    world.gonePawns.push(p);
    for (const q of world.pawns) if (q.isColonist()) q.addThought(world, 'colonistLeft');
    Chron.log(world, Chron.pick(world, [
      `${p.label()} walked past the boundary marker and did not stop. ${U.cap(p.he)} left ${p.his} bowl, ${p.his} bed, and no note.`,
      `In the end the rim took ${p.label()} not with claws but with quiet. ${U.cap(p.he)} wandered into the wilds, broken-hearted.`,
    ]), { icon: ICONS.leave, tone: 'bad', major: true });
    Chron.remember(world, { kind: 'left', text: `${p.label()} gave up and wandered away`, pawns: [] });
  },

  returnee(world) {
    const candidates = world.gonePawns.filter(p => world.day - p.goneDay > 10);
    if (!candidates.length) return false;
    const p = world.rng.pick(candidates);
    world.gonePawns.splice(world.gonePawns.indexOf(p), 1);
    const edge = world.map.randomEdgeSpot(world.rng, world);
    p.x = edge.x; p.y = edge.y;
    const wasKidnapped = p.gone === 'kidnapped';
    p.gone = null; p.dead = false; p.downed = false; p.prisoner = false; p.faction = 'colony';
    p.blood = 0.85; p.needs.food = 0.3; p.mode = 'normal'; p.breaking = null; p.job = null;
    if (wasKidnapped) p.applyDamage(world, 6, 'bruise', 'captivity');
    world.pawns.push(p); world.byId[p.id] = p;
    for (const q of world.pawns) if (q.isColonist() && q !== p) q.addThought(world, 'wandererReturned');
    p.addStory(world, wasKidnapped ? `Escaped captivity and returned home` : `Came back after ${world.day - p.goneDay} days in the wilds`);
    Chron.log(world, wasKidnapped
      ? `A figure at the ${GameEvents.sideName(edge)} gate at dawn — it's ${p.full()}! Thin, scarred, and free. ${U.cap(p.he)} escaped the raiders and walked home by the stars.`
      : `${p.full()} came back today, hat in hand. Nobody said anything. ${world.rng.pick(['Someone just set another bowl at the table.', 'The dog reached ' + p.him + ' first.', p.label() + "'s bed was still made."])}`,
      { icon: ICONS.arrive, tone: 'good', major: true });
    Chron.maybeChapter(world, 'return', `The Return of ${p.label()}`);
    Renderer.cinematic(world, `${p.full()} has returned!`, { x: p.x, y: p.y }, 8);
    Overseer.assignRolesDaily(world);
    return true;
  },

  // ---- animals -------------------------------------------------------------
  manhunterPack(world) {
    const rng = world.rng;
    const species = rng.pick(['wolf', 'boar', 'wolf']);
    const n = rng.ri(3, 5 + Math.floor(world.year0));
    const edge = world.map.randomEdgeSpot(rng, world);
    for (let i = 0; i < n; i++) {
      const a = Animal.make(world, species, U.clamp(edge.x + rng.ri(-3, 3), 1, world.map.w - 2), U.clamp(edge.y + rng.ri(-3, 3), 1, world.map.h - 2));
      a.manhunter = true;
      world.animals.push(a); world.byId[a.id] = a;
    }
    Chron.log(world, `A pack of ${n} maddened ${ANIMALS[species].n}s is tearing in from the ${GameEvents.sideName(edge)}, froth-jawed and fearless! Everyone inside!`, { icon: ICONS.animal, tone: 'bad', major: true });
    Renderer.cinematic(world, `Manhunter pack — ${n} ${ANIMALS[species].n}s!`, edge, 7);
  },

  madAnimal(world) {
    const wild = world.animals.filter(a => !a.dead && !a.tame && !a.def().predator);
    if (!wild.length) return GameEvents.manhunterPack(world);
    const a = world.rng.pick(wild);
    a.manhunter = true;
    Chron.log(world, `The ${a.def().n} by the ${world.rng.pick(['creek', 'treeline', 'rocks'])} has gone mad — it's charging anything that moves!`, { icon: ICONS.animal, tone: 'bad', major: true });
  },

  predatorArrives(world) {
    const species = world.rng.chance(0.5) ? 'bear' : 'cougar';
    const edge = world.map.randomEdgeSpot(world.rng, world);
    const a = Animal.make(world, species, edge.x, edge.y);
    world.animals.push(a); world.byId[a.id] = a;
    Chron.log(world, `A ${ANIMALS[species].n} has come down from the ${world.rng.pick(['high country', 'deep woods'])}, hungry. The hunters exchange looks.`, { icon: ICONS.animal, tone: 'neutral', major: true });
  },

  selfTame(world) {
    const rng = world.rng;
    const species = rng.chance(0.65) ? 'dog' : 'cat';
    const edge = world.map.randomEdgeSpot(rng, world);
    const a = Animal.make(world, species, edge.x, edge.y, { tame: true, name: Names.pet(rng) });
    const colonists = world.pawns.filter(p => p.isColonist());
    const owner = colonists.length ? rng.pick(colonists) : null;
    if (owner) { a.ownerId = owner.id; owner.bondedPet = a.id; }
    a.state = 'pet';
    world.animals.push(a); world.byId[a.id] = a;
    Chron.log(world, Chron.pick(world, [
      `A ${ANIMALS[species].n} trotted into camp like it owned the place${owner ? ` and chose ${owner.label()} on the spot` : ''}. ${world.rng.chance(0.5) ? 'It answers, provisionally, to' : 'The children have already named it'} ${a.name}.`,
      `${world.colonyName} has been adopted by a ${ANIMALS[species].n}. It is now named ${a.name} and considers every bed its bed.`,
    ]), { icon: ICONS.pet, tone: 'good', major: true });
    Chron.remember(world, { kind: 'pet', text: `${a.name} the ${ANIMALS[species].n} adopted the colony`, pawns: owner ? [owner.id] : [] });
  },

  // ---- weather & sky -------------------------------------------------------
  coldSnap(world) {
    world.tempEvent = { delta: -world.rng.ri(12, 18), until: world.t + world.rng.ri(3, 5) * BAL.MIN_PER_DAY };
    Chron.log(world, `A cold snap rolls in. The air goes knife-thin; breath hangs like ghosts. The crops will not like this.`, { icon: ICONS.cold, tone: 'bad', major: true });
  },
  heatWave(world) {
    world.tempEvent = { delta: world.rng.ri(10, 16), until: world.t + world.rng.ri(3, 5) * BAL.MIN_PER_DAY };
    Chron.log(world, `A heat wave settles over the land like a hand over a candle. Work slows; tempers don't.`, { icon: ICONS.heat, tone: 'bad', major: true });
  },
  warmSpell(world) {
    world.tempEvent = { delta: world.rng.ri(8, 12), until: world.t + world.rng.ri(2, 4) * BAL.MIN_PER_DAY };
    Chron.log(world, `An unseasonal warm spell. Meltwater sings in the gullies; everyone finds reasons to work outside.`, { icon: '🌤️', tone: 'good' });
  },
  thunderstorm(world) {
    world.weather = 'storm';
    world.weatherUntil = world.t + world.rng.ri(300, 700);
    Chron.log(world, `Thunderheads pile up ${world.rng.pick(['black as slag', 'green-bellied', 'mountain-high'])}. A storm is on the colony.`, { icon: ICONS.storm, tone: 'neutral', major: true });
  },
  eclipse(world) {
    world.eclipseUntil = world.t + BAL.MIN_PER_DAY;
    for (const p of world.pawns) if (p.isColonist()) p.addThought(world, 'eclipseGloom');
    Chron.log(world, `An eclipse. The sun goes out like a lamp and the day turns the color of old bruises. Work continues, quieter.`, { icon: '🌑', tone: 'bad', major: true });
  },
  aurora(world) {
    world.auroraUntil = world.t + BAL.MIN_PER_DAY * 0.6;
    for (const p of world.pawns) if (p.isColonist()) p.addThought(world, 'auroraWonder');
    Chron.log(world, Chron.pick(world, [
      `The aurora tonight — curtains of green and violet fire, wheeling slow over ${world.colonyName}. Everyone came outside. Nobody spoke.`,
      `The sky is dancing. Even the sentry forgot to watch the dark below it.`,
    ]), { icon: ICONS.star, tone: 'good', major: true });
  },

  blight(world) {
    let killed = 0;
    const map = world.map;
    for (const farm of world.zones.farms) {
      for (let y = farm.y; y < farm.y + farm.h; y++) for (let x = farm.x; x < farm.x + farm.w; x++) {
        const i = map.idx(x, y);
        const pl = map.plantG[i];
        if (pl && PLANTS[pl.kind].crop && world.rng.chance(0.55)) { map.plantG[i] = null; killed++; }
      }
    }
    if (killed < 4) return false;
    for (const p of world.pawns) if (p.isColonist()) p.addThought(world, 'blightDespair');
    Chron.log(world, `Blight. It came overnight — black spots, then rot, then whole rows gone soft. ${killed} plants lost. The growers are out there anyway, cutting and cursing.`, { icon: '🦠', tone: 'bad', major: true });
    world.stats.blights++;
    return true;
  },

  diseaseOutbreak(world) {
    const rng = world.rng;
    const colonists = world.pawns.filter(p => p.isColonist() && !p.diseases.length);
    if (!colonists.length) return false;
    const kind = rng.pickw([{ k: 'flu', w: 5 }, { k: 'plague', w: 2 }, { k: 'gutworms', w: 2 }], o => o.w).k;
    const n = kind === 'plague' ? rng.ri(1, 2) : rng.ri(2, Math.min(4, colonists.length));
    const sick = rng.shuffle([...colonists]).slice(0, n);
    for (const p of sick) p.addDisease(world, kind);
    if (kind === 'plague') {
      Chron.log(world, `Plague. The word nobody says aloud. ${U.listJoin(sick.map(p => p.label()))} ${sick.length > 1 ? 'are' : 'is'} burning with fever — the race between blood and medicine begins.`, { icon: ICONS.sick, tone: 'bad', major: true });
    }
    world.stats.outbreaks++;
    return true;
  },

  // ---- goods & visitors ----------------------------------------------------
  cargoPods(world) {
    const rng = world.rng;
    const goods = rng.pick([
      { kind: 'steel', qty: rng.ri(25, 60) }, { kind: 'mealSimple', qty: rng.ri(6, 14) },
      { kind: 'cloth', qty: rng.ri(20, 40) }, { kind: 'medkit', qty: rng.ri(2, 5) },
      { kind: 'silver', qty: rng.ri(40, 120) }, { kind: 'gold', qty: rng.ri(4, 10) },
    ]);
    const map = world.map;
    const spot = map.findSpotNear(map.home.x + rng.ri(-14, 14), map.home.y + rng.ri(-14, 14), 12, (x, y) => map.standable(x, y, world));
    if (!spot) return false;
    Things.drop(world, spot.x, spot.y, goods.kind, goods.qty);
    world.fx.push({ kind: 'pod', x: spot.x, y: spot.y, t: world.t });
    Chron.log(world, `Cargo pods fell ${GameEvents.dirFromHome(world, spot)} — some ancient ship shedding freight. Inside: ${goods.qty} ${ITEMS[goods.kind].n}. The sky provides, occasionally.`, { icon: '📦', tone: 'good', major: true });
    return true;
  },

  meteorite(world) {
    const map = world.map;
    const spot = map.findSpotNear(map.home.x + world.rng.ri(-20, 20), map.home.y + world.rng.ri(-20, 20), 16, (x, y) => map.standable(x, y, world));
    if (!spot) return false;
    Things.drop(world, spot.x, spot.y, 'steel', world.rng.ri(30, 55));
    Things.drop(world, spot.x, spot.y, 'chunk', world.rng.ri(4, 8));
    if (world.weather !== 'rain' && world.weather !== 'storm') Sim.igniteTile(world, spot.x, spot.y, 25);
    world.fx.push({ kind: 'pod', x: spot.x, y: spot.y, t: world.t });
    Chron.log(world, `A meteorite came down ${GameEvents.dirFromHome(world, spot)} with a crack that rattled every window we don't have. Steel-rich ore, still warm.`, { icon: '☄️', tone: 'good', major: true });
    return true;
  },

  berryBloom(world) {
    const map = world.map;
    let n = 0;
    for (let i = 0; i < map.plantG.length; i++) {
      const pl = map.plantG[i];
      if (pl && pl.kind === 'bush') { pl.growth = 1; n++; }
      else if (!pl && !map.rock[i] && (map.terr[i] === TERR.SOIL || map.terr[i] === TERR.RICH) && world.rng.chance(0.006) && !map.bIdx[i]) {
        map.plantG[i] = { kind: 'bush', growth: 1, i };
        n++;
      }
    }
    Chron.log(world, `The berry bushes have all come ripe at once, heavy and glistening. The children are already purple to the elbows.`, { icon: '🫐', tone: 'good', major: true });
    return n > 0;
  },

  traderCaravan(world) {
    const rng = world.rng;
    const fac = world.factions.outlander;
    const edge = world.map.randomEdgeSpot(rng, world);
    const group = [];
    const trader = Pawn.make(world, { faction: 'outlander', x: edge.x, y: edge.y, weapon: 'pistol', apparel: 'coat' });
    trader.npcRole = 'trader';
    group.push(trader);
    for (let i = 0; i < 2; i++) {
      const g = Pawn.make(world, { faction: 'outlander', x: U.clamp(edge.x + rng.ri(-2, 2), 1, world.map.w - 2), y: U.clamp(edge.y + rng.ri(-2, 2), 1, world.map.h - 2), weapon: rng.pick(['rifle', 'shotgun']), apparel: 'flak' });
      g.npcRole = 'guard';
      group.push(g);
    }
    const anchor = world.map.findSpotNear(world.map.home.x + rng.ri(-6, 6), world.map.home.y + 8, 8, (x, y) => world.map.standable(x, y, world)) || world.map.home;
    for (const p of group) {
      p.npcAnchor = anchor;
      p.leaveAt = world.t + BAL.MIN_PER_DAY * 0.9;
      world.pawns.push(p); world.byId[p.id] = p;
    }
    const muffalo = Animal.make(world, 'muffalo', edge.x, edge.y, { tame: true });
    muffalo.caravan = true; muffalo.state = 'pet'; muffalo.ownerId = trader.id;
    world.animals.push(muffalo); world.byId[muffalo.id] = muffalo;
    world.caravan = { traderId: trader.id, muffaloId: muffalo.id, traded: false, at: world.t };
    Chron.log(world, `A trade caravan from ${fac.name} — ${trader.full()} and guards, a muffalo swaying under crates. They'll camp by the south field till tomorrow.`, { icon: ICONS.trade, tone: 'good', major: true });
    return true;
  },

  doTrade(world) {
    const cv = world.caravan;
    if (!cv || cv.traded) return;
    const trader = world.byId[cv.traderId];
    if (!trader || trader.dead) return;
    cv.traded = true;
    const rng = world.rng;
    const lines = [];
    let silver = Things.count(world, 'silver');
    const sell = (kind, keep) => {
      const have = Things.count(world, kind);
      const excess = have - keep;
      if (excess <= 0) return;
      let sold = 0, gain = 0;
      for (const s of [...world.items]) {
        if (s.kind !== kind || s.carried || sold >= excess) continue;
        const take = Things.take(world, s, excess - sold);
        sold += take;
        gain += Math.floor(take * ITEMS[kind].v * 0.8);
      }
      if (sold > 0) { Things.drop(world, trader.npcAnchor.x, trader.npcAnchor.y, 'silver', gain); silver += gain; lines.push(`sold ${sold} ${ITEMS[kind].n} for ${gain} silver`); }
    };
    sell('gold', 0);
    sell('leather', 30);
    sell('beer', 12);
    const buy = (kind, qty, why) => {
      const price = Math.ceil(ITEMS[kind].v * 1.3) * qty;
      if (silver < price || qty <= 0) return;
      let paid = 0;
      for (const s of [...world.items]) {
        if (s.kind !== 'silver' || s.carried || paid >= price) continue;
        paid += Things.take(world, s, price - paid);
      }
      if (paid >= price * 0.8) {
        Things.drop(world, trader.npcAnchor.x, trader.npcAnchor.y, kind, qty);
        silver -= paid;
        lines.push(`bought ${qty} ${ITEMS[kind].n}${why ? ' (' + why + ')' : ''}`);
      }
    };
    const pop = world.pawns.filter(p => p.isColonist()).length;
    const medkits = Things.count(world, 'medkit');
    if (medkits < pop) buy('medkit', Math.min(3, pop - medkits), 'the hospital shelf was bare');
    if (Things.countFood(world) < pop * 2) buy('mealSimple', 8, 'lean times');
    if ((world.season === 'Fall') && Things.count(world, 'cloth') < 24) buy('cloth', 30, 'winter is coming');
    if (lines.length) {
      Chron.log(world, `Trade with ${trader.label()}: ${U.listJoin(lines)}. ${rng.pick(['Both sides walked away pretending they won.', 'The muffalo seemed relieved either way.', 'Hands were shaken; nothing was stolen. A good day.'])}`, { icon: ICONS.trade, tone: 'good' });
    } else {
      Chron.log(world, `${trader.label()} showed ${trader.his} wares, but nothing changed hands this time. Tea was drunk; news was traded instead.`, { icon: ICONS.trade, tone: 'neutral' });
    }
  },

  visitors(world) {
    const rng = world.rng;
    const edge = world.map.randomEdgeSpot(rng, world);
    const n = rng.ri(2, 3);
    const anchor = world.map.findSpotNear(world.map.home.x + rng.ri(-8, 8), world.map.home.y + 6, 8, (x, y) => world.map.standable(x, y, world)) || world.map.home;
    const names = [];
    for (let i = 0; i < n; i++) {
      const p = Pawn.make(world, { faction: 'outlander', x: U.clamp(edge.x + rng.ri(-2, 2), 1, world.map.w - 2), y: U.clamp(edge.y + rng.ri(-2, 2), 1, world.map.h - 2), weapon: rng.pick(['pistol', 'knife', 'bow']), apparel: 'clothes' });
      p.npcRole = 'visitor'; p.npcAnchor = anchor; p.leaveAt = world.t + BAL.MIN_PER_DAY * 0.4;
      world.pawns.push(p); world.byId[p.id] = p;
      names.push(p.label());
    }
    Chron.log(world, `Travelers from ${world.factions.outlander.name} — ${U.listJoin(names)} — are passing through, trading news for stew.`, { icon: '🚶', tone: 'neutral' });
    return true;
  },

  // A baby left at the edge of the map — the rim produces orphans, and
  // colonies with warm hearths inherit them. Any couple can end up parents.
  foundling(world) {
    const rng = world.rng;
    const colonists = world.pawns.filter(p => p.isColonist() && p.stage(world) === 'adult');
    if (colonists.length < 3) return false;
    // adoptive parents: a married pair if one exists, else lovers, else two friends
    let a = null, b = null;
    for (const p of colonists) {
      if (p.spouseId && world.byId[p.spouseId] && world.byId[p.spouseId].isColonist()) { a = p; b = world.byId[p.spouseId]; break; }
    }
    if (!a) for (const p of colonists) {
      if (p.loverId && world.byId[p.loverId] && world.byId[p.loverId].isColonist()) { a = p; b = world.byId[p.loverId]; break; }
    }
    if (!a) { a = rng.pick(colonists); b = null; }
    const baby = Pawn.makeBaby(world, a, b);
    const edge = world.map.randomEdgeSpot(rng, world);
    baby.x = edge.x; baby.y = edge.y;
    world.pawns.push(baby); world.byId[baby.id] = baby;
    baby.addStory(world, `Found as a foundling at the edge of ${world.colonyName}`);
    a.addStory(world, `Took in the foundling ${baby.name.first}`);
    if (b) b.addStory(world, `Took in the foundling ${baby.name.first}`);
    a.addThought(world, 'newBabyMine');
    if (b) b.addThought(world, 'newBabyMine');
    for (const p of world.pawns) if (p.isColonist() && p !== a && p !== b) p.addThought(world, 'newBabyColony');
    Chron.log(world, Chron.pick(world, [
      `A basket at the ${GameEvents.sideName(edge)} boundary this morning — inside, wrapped against the cold, a baby. A note in rough letters: "better with you." ${a.label()}${b ? ' and ' + b.label() : ''} carried ${baby.gender === 'm' ? 'him' : baby.gender === 'f' ? 'her' : 'them'} home and named ${baby.gender === 'm' ? 'him' : baby.gender === 'f' ? 'her' : 'them'} ${baby.name.first}.`,
      `Refugees passed in the night; at dawn there was one more mouth at ${world.colonyName} — an infant, left where the sentry would find ${baby.gender === 'm' ? 'him' : baby.gender === 'f' ? 'her' : 'them'}. ${a.label()} didn't even pretend to deliberate. The child is called ${baby.name.first} now.`,
    ]), { icon: ICONS.baby, tone: 'good', major: true });
    Chron.remember(world, { kind: 'birth', text: `${baby.name.first} the foundling was taken in`, pawns: [baby.id, a.id, b ? b.id : null].filter(Boolean) });
    Chron.maybeChapter(world, 'birth', `The Foundling`);
    Renderer.cinematic(world, `A foundling at the gates: ${baby.name.first}`, edge, 7);
    Overseer.noteNewResident(world, baby);
    return true;
  },

  // ---- the vault -----------------------------------------------------------
  vaultWhispers(world) {
    const v = world.map.vault;
    if (!v || v.opened || v.sensed) return false;
    v.sensed = true;
    for (const p of world.pawns) if (p.isColonist()) p.addThought(world, 'vaultDread');
    Chron.log(world, `Miners report a sealed chamber deep in the rock — worked stone, older than any map, humming faintly. The colony votes to dig toward it. Of course they do.`, { icon: '🚪', tone: 'neutral', major: true });
    // designate approach tiles
    const map = world.map;
    for (let r = 1; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = v.x + dx, y = v.y + dy;
        if (map.inb(x, y) && map.rock[map.idx(x, y)]) world.mineQueue.add(map.idx(x, y));
      }
    }
    return true;
  },

  openVault(world, miner) {
    const v = world.map.vault;
    if (!v || v.opened) return;
    v.opened = true;
    const roll = world.rng.r();
    Renderer.cinematic(world, `The vault is breached`, v, 8);
    if (roll < 0.45) {
      Things.drop(world, v.x, v.y, 'gold', world.rng.ri(12, 22));
      Things.drop(world, v.x, v.y, 'silver', world.rng.ri(80, 200));
      Things.drop(world, v.x, v.y, 'steel', world.rng.ri(20, 40));
      for (const p of world.pawns) if (p.isColonist()) p.addThought(world, 'vaultTreasure');
      Chron.log(world, `${miner.label()}'s pick broke through into cold, dead air. Lamplight found gold — grave-goods of some vanished people, stacked with terrible neatness. ${world.colonyName} is rich, and slightly ashamed.`, { icon: '🏺', tone: 'good', major: true });
      Chron.remember(world, { kind: 'vault', text: `the ancient vault gave up its treasure`, pawns: [miner.id] });
    } else if (roll < 0.75) {
      const p = Pawn.make(world, { faction: 'colony', x: v.x, y: v.y, age: world.rng.ri(20, 35) });
      p.name = Names.pawnName(world.rng, p.gender);
      p.podSurvivor = true;
      p.needs.food = 0.1;
      world.pawns.push(p); world.byId[p.id] = p;
      Chron.log(world, `Behind the ancient door: a cryosleep casket, still humming. It opened with a hiss of centuries, and ${p.full()} sat up, speaking a dialect a hundred years dead, asking if the war was over.`, { icon: '🧊', tone: 'good', major: true });
      Chron.remember(world, { kind: 'vault', text: `${p.label()} woke from the ancient vault`, pawns: [p.id] });
      Chron.maybeChapter(world, 'vault', 'The Sleeper');
      Overseer.assignRolesDaily(world);
    } else {
      const n = world.rng.ri(3, 5);
      for (let i = 0; i < n; i++) {
        const a = Animal.make(world, 'cougar', v.x + world.rng.ri(-1, 1), v.y + world.rng.ri(-1, 1));
        a.manhunter = true;
        world.animals.push(a); world.byId[a.id] = a;
      }
      Chron.log(world, `The seal cracked — and the dark behind it moved. Pale cave-cats, generations blind, boiled out at ${miner.label()}! Whatever was buried here, they were left to guard it.`, { icon: '🕳️', tone: 'bad', major: true });
      Chron.maybeChapter(world, 'vault', 'What the Mountain Kept');
    }
  },

  // ---- calendar events (fired by Sim, not the storyteller) ------------------
  foundingDay(world) {
    for (const p of world.pawns) if (p.isColonist()) p.addThought(world, 'foundingDay');
    Chron.log(world, `Founding Day. ${U.ordinal(world.year0 + 1)} year since the pods came down. The survivors of that first morning get their names said aloud; the new ones get the story, embellished.`, { icon: '🎆', tone: 'good', major: true });
    if (!world.threat) Social.startParty(world, 'Founding Day');
  },

  harvestFestival(world) {
    if (Things.countFood(world) > world.pawns.filter(p => p.isColonist()).length * 3) {
      for (const p of world.pawns) if (p.isColonist()) p.addThought(world, 'harvestJoy');
      Social.startParty(world, 'the harvest festival');
    }
  },
};

// ---- storyteller-facing registry -------------------------------------------
const EVENT_DEFS = [
  // day gates give a young colony time to raise walls and grow food before the rim notices it
  { key: 'raid', cat: 'threat', cd: 2.5, w: w => w.day < 9 ? 0 : 10 + w.year0 * 2, run: w => GameEvents.spawnRaid(w) },
  { key: 'vendetta', cat: 'threat', cd: 5, w: w => (w.factions.pirate.grudge >= 2 && w.factions.pirate.leaderAlive ? 8 : 0), run: w => GameEvents.spawnRaid(w, { vendetta: true, faction: 'pirate' }) },
  { key: 'manhunters', cat: 'threat', cd: 6, w: w => w.day < 6 ? 0 : 4, run: w => GameEvents.manhunterPack(w) },
  { key: 'madAnimal', cat: 'threat', cd: 3, w: w => w.day < 4 ? 0 : 3, run: w => GameEvents.madAnimal(w) },
  { key: 'predator', cat: 'threat', cd: 7, w: w => w.day < 5 ? 0 : 3, run: w => GameEvents.predatorArrives(w) },
  { key: 'coldSnap', cat: 'threat', cd: 10, w: w => (w.season === 'Winter' || w.season === 'Fall') ? 4 : 1, run: w => GameEvents.coldSnap(w) },
  { key: 'heatWave', cat: 'threat', cd: 10, w: w => w.season === 'Summer' ? 4 : 0.5, run: w => GameEvents.heatWave(w) },
  { key: 'storm', cat: 'threat', cd: 4, w: w => 5, run: w => GameEvents.thunderstorm(w) },
  { key: 'blight', cat: 'threat', cd: 9, w: w => (w.day < 6 || !w.zones.farms.length) ? 0 : 3.5, run: w => GameEvents.blight(w) },
  { key: 'disease', cat: 'threat', cd: 8, w: w => w.day < 5 ? 0 : 4, run: w => GameEvents.diseaseOutbreak(w) },
  { key: 'eclipse', cat: 'threat', cd: 12, w: w => 2, run: w => GameEvents.eclipse(w) },
  { key: 'wanderer', cat: 'fortune', cd: 5, w: w => { const pop = w.pawns.filter(p => p.isColonist()).length; return pop < 4 ? 10 : pop < BAL.popSoftCap ? 6 : 0.4; }, run: w => GameEvents.wandererJoins(w) },
  { key: 'pod', cat: 'fortune', cd: 6, w: w => { const pop = w.pawns.filter(p => p.isColonist()).length; return pop < BAL.popSoftCap ? 5 : 0.8; }, run: w => GameEvents.escapePod(w) },
  { key: 'cargo', cat: 'fortune', cd: 6, w: w => 4, run: w => GameEvents.cargoPods(w) },
  { key: 'meteorite', cat: 'fortune', cd: 9, w: w => 2.5, run: w => GameEvents.meteorite(w) },
  { key: 'berries', cat: 'fortune', cd: 8, w: w => w.season === 'Winter' ? 0 : 3, run: w => GameEvents.berryBloom(w) },
  { key: 'selfTame', cat: 'fortune', cd: 14, w: w => w.animals.some(a => a.tame && !a.dead && !a.caravan) ? 1 : 4, run: w => GameEvents.selfTame(w) },
  { key: 'aurora', cat: 'fortune', cd: 9, w: w => 3, run: w => GameEvents.aurora(w) },
  { key: 'warmSpell', cat: 'fortune', cd: 10, w: w => w.season === 'Winter' ? 3 : 0, run: w => GameEvents.warmSpell(w) },
  { key: 'returnee', cat: 'fortune', cd: 10, w: w => w.gonePawns.length ? 6 : 0, run: w => GameEvents.returnee(w) },
  { key: 'foundling', cat: 'fortune', cd: 24, w: w => {
    const pop = w.pawns.filter(p => p.isColonist()).length;
    const kids = w.pawns.filter(p => p.isColonist() && p.stage(w) !== 'adult').length;
    return (pop >= 4 && pop < BAL.popSoftCap && kids < 3 && Things.countFood(w) > pop * 2) ? 3 : 0;
  }, run: w => GameEvents.foundling(w) },
  { key: 'trader', cat: 'neutral', cd: 5, w: w => w.caravan ? 0 : 5, run: w => GameEvents.traderCaravan(w) },
  { key: 'visitors', cat: 'neutral', cd: 4, w: w => 4, run: w => GameEvents.visitors(w) },
  { key: 'vault', cat: 'neutral', cd: 30, w: w => (w.map.vault && !w.map.vault.sensed && w.year0 >= 1) ? 3 : 0, run: w => GameEvents.vaultWhispers(w) },
];

Object.assign(globalThis, { GameEvents, EVENT_DEFS });
