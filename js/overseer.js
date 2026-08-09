// overseer.js — the colony's collective planning brain. No player, so this AI decides
// what gets built where, who does which work, what to research, craft, buy, and capture.
// Its decisions are reactive on purpose: walls after the first raid, graves after the
// first death — cause and effect the viewer can read on the map.

const Overseer = {
  init(world) {
    world.plan = {
      stage: 0,
      placed: [],          // structural memory for auto-rebuild: {key,x,y,prison,floor}
      roomsBuilt: {},      // label -> true
      bedroomSlots: 0,
      decorSpots: [],
      lastRebuild: 0,
      lastParty: -9999,
      firstRaidSeen: false,
      firstDeathSeen: false,
      prisonWanted: false,
    };
  },

  // ---- geometry helpers ---------------------------------------------------
  buildableRect(world, x, y, w, h, allowSharedWalls) {
    const map = world.map;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (!map.inb(xx, yy)) return false;
      const i = map.idx(xx, yy);
      if (map.rock[i]) return false;
      const t = map.terr[i];
      if (t === TERR.WATER || t === TERR.MARSH) return false;
      const bid = map.bIdx[i];
      if (bid) {
        const b = world.byId[bid];
        const isEdge = (xx === x || xx === x + w - 1 || yy === y || yy === y + h - 1);
        const isWallish = b && (BUILDINGS[b.key].block || BUILDINGS[b.key].door);
        if (!(allowSharedWalls && isEdge && isWallish)) return false;
      }
    }
    return true;
  },

  // Queue a full room: walls, a door facing home, floors, furniture.
  planRoom(world, label, spec) {
    const map = world.map;
    const home = map.home;
    const offsets = [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3], [6, 0], [-6, 0], [0, 6], [0, -6], [9, 0], [-9, 0]];
    let X = null, Y = null;
    for (const [ox, oy] of offsets) {
      const x = home.x + spec.dx + ox, y = home.y + spec.dy + oy;
      if (Overseer.buildableRect(world, x, y, spec.w, spec.h, true)) { X = x; Y = y; break; }
    }
    if (X === null) return false;
    const wallKey = spec.stone && world.techsDone.includes('fortification') ? 'wallStone' : 'wallWood';
    const doorKey = wallKey === 'wallStone' ? 'doorStone' : 'doorWood';
    // door in the middle of the side facing home
    const cx = X + Math.floor(spec.w / 2), cy = Y + Math.floor(spec.h / 2);
    let doorX, doorY;
    const dxh = home.x - cx, dyh = home.y - cy;
    if (Math.abs(dxh) > Math.abs(dyh)) { doorX = dxh > 0 ? X + spec.w - 1 : X; doorY = cy; }
    else { doorY = dyh > 0 ? Y + spec.h - 1 : Y; doorX = cx; }
    // walls & door first
    for (let yy = Y; yy < Y + spec.h; yy++) for (let xx = X; xx < X + spec.w; xx++) {
      const isEdge = (xx === X || xx === X + spec.w - 1 || yy === Y || yy === Y + spec.h - 1);
      if (!isEdge) continue;
      const i = map.idx(xx, yy);
      const isDoor = (xx === doorX && yy === doorY);
      if (map.bIdx[i]) {
        // the door tile must BE a door — if a shared wall already stands there,
        // swap it out, or the room is born sealed
        if (isDoor) {
          const existing = world.byId[map.bIdx[i]];
          if (existing && (existing.key === 'wallWood' || existing.key === 'wallStone')) {
            Things.removeBuilding(world, existing);
            const d = Things.addBlueprint(world, doorKey, xx, yy);
            if (d) world.plan.placed.push({ key: doorKey, x: xx, y: yy });
            for (const pl of world.plan.placed) if (pl.x === xx && pl.y === yy && (pl.key === 'wallWood' || pl.key === 'wallStone')) pl.dead = true;
          }
        }
        continue;
      }
      const key = isDoor ? doorKey : wallKey;
      const b = Things.addBlueprint(world, key, xx, yy);
      if (b) world.plan.placed.push({ key, x: xx, y: yy });
    }
    // furniture next — floors must not squat on its tiles
    for (const f of spec.furniture || []) {
      const fx = X + f.dx, fy = Y + f.dy;
      if (fx === doorX && fy === doorY) continue;
      const i = map.idx(fx, fy);
      if (map.bIdx[i]) continue;
      if (map.plantG[i] && !PLANTS[map.plantG[i].kind].tree) map.plantG[i] = null;
      const b = Things.addBlueprint(world, f.key, fx, fy, f.meta || null);
      if (b) {
        if (spec.prison) b.prison = true;
        world.plan.placed.push({ key: f.key, x: fx, y: fy, prison: !!spec.prison, meta: f.meta || null });
      }
    }
    // floors fill the remaining interior
    for (let yy = Y + 1; yy < Y + spec.h - 1; yy++) for (let xx = X + 1; xx < X + spec.w - 1; xx++) {
      const i = map.idx(xx, yy);
      if (map.plantG[i] && !PLANTS[map.plantG[i].kind].tree) map.plantG[i] = null;
      if (!map.floor[i] && !map.bIdx[i]) {
        const fb = Things.addBlueprint(world, spec.stoneFloor ? 'floorStone' : 'floorWood', xx, yy);
        if (fb) world.plan.placed.push({ key: spec.stoneFloor ? 'floorStone' : 'floorWood', x: xx, y: yy });
      }
    }
    world.plan.roomsBuilt[label] = true;
    return true;
  },

  // Find a fertile rectangle near home for a crop field; fixed offsets would
  // land on sand half the time in the drylands.
  placeFarm(world, crop, w, h) {
    const map = world.map;
    const home = map.home;
    let best = null, bestScore = 4;
    for (let oy = -20; oy <= 20; oy += 2) for (let ox = -20; ox <= 20; ox += 2) {
      const X = home.x + ox, Y = home.y + oy;
      if (!map.inb(X, Y) || !map.inb(X + w - 1, Y + h - 1)) continue;
      if (Math.abs(ox) < 5 && Math.abs(oy) < 5) continue; // keep the yard clear
      let fertile = 0, blocked = 0;
      for (let yy = Y; yy < Y + h; yy++) for (let xx = X; xx < X + w; xx++) {
        const i = map.idx(xx, yy);
        if (map.rock[i] || map.bIdx[i] || map.terr[i] === TERR.WATER || map.terr[i] === TERR.MARSH) { blocked++; continue; }
        const t = map.terr[i];
        if (t === TERR.SOIL || t === TERR.RICH) fertile++;
      }
      if (blocked > w * h * 0.2) continue;
      // overlap with existing farms?
      let overlaps = false;
      for (const f of world.zones.farms) {
        if (X < f.x + f.w && X + w > f.x && Y < f.y + f.h && Y + h > f.y) { overlaps = true; break; }
      }
      if (overlaps) continue;
      const score = fertile - (Math.abs(ox) + Math.abs(oy)) * 0.25;
      if (score > bestScore) { bestScore = score; best = { x: X, y: Y, w, h, crop }; }
    }
    if (best) {
      world.zones.farms.push(best);
      // clear trees standing in the field
      for (let yy = best.y; yy < best.y + best.h; yy++) for (let xx = best.x; xx < best.x + best.w; xx++) {
        const i = map.idx(xx, yy);
        const pl = map.plantG[i];
        if (pl && PLANTS[pl.kind].tree) world.chopQueue.add(i);
      }
    }
    return best;
  },

  blueprintBacklog(world) {
    let n = 0;
    for (const b of world.buildings) if (b.blueprint) n++;
    return n;
  },

  // Blueprints that sit untouched for days (no materials, unreachable) are
  // cancelled so they can't wedge the whole construction ladder.
  timeoutStaleBlueprints(world) {
    let cancelled = 0;
    for (const b of [...world.buildings]) {
      if (!b.blueprint) continue;
      if (b.bpDay == null) { b.bpDay = world.day; continue; }
      if (world.day - b.bpDay > 4 && (b.work || 0) === 0) {
        for (const pl of world.plan.placed) if (pl.x === b.x && pl.y === b.y && pl.key === b.key) pl.dead = true;
        Things.removeBuilding(world, b);
        cancelled++;
      }
    }
    if (cancelled >= 3) Chron.log(world, `The overseer's grander plans have been quietly trimmed — ${cancelled} pieces struck from the ledger for want of materials or access.`, { icon: ICONS.build, tone: 'neutral' });
    return cancelled;
  },

  // ---- staged base development -------------------------------------------
  tickHourly(world) {
    const plan = world.plan;
    const colonists = world.pawns.filter(p => p.isColonist());
    if (!colonists.length) return;
    const pop = colonists.length;
    const wood = Things.count(world, 'wood');
    const home = world.map.home;
    if (world.hourOfDay === 5) Overseer.timeoutStaleBlueprints(world);

    // Stage 0: landing — cabin, campfire, stockpile, first farm
    if (plan.stage === 0) {
      world.zones.stock = new Set();
      for (let dy = 2; dy <= 6; dy++) for (let dx = -2; dx <= 3; dx++) {
        world.zones.stock.add(world.map.idx(home.x + dx, home.y + dy));
      }
      Overseer.planRoom(world, 'cabin', {
        dx: -4, dy: -6, w: 9, h: 7,
        furniture: [
          { key: 'campfire', dx: 4, dy: 1 },
          { key: 'bedroll', dx: 1, dy: 1 }, { key: 'bedroll', dx: 1, dy: 3 }, { key: 'bedroll', dx: 1, dy: 5 },
          { key: 'bedroll', dx: 7, dy: 1 }, { key: 'bedroll', dx: 7, dy: 5 },
          { key: 'table', dx: 4, dy: 4 }, { key: 'stool', dx: 3, dy: 4 }, { key: 'stool', dx: 5, dy: 4 },
          { key: 'craftSpot', dx: 6, dy: 2 }, { key: 'butcher', dx: 2, dy: 5 },
        ],
      });
      Overseer.placeFarm(world, 'rice', 7, 5);
      Overseer.placeFarm(world, 'potato', 7, 5);
      world.zones.weddingSpot = { x: home.x, y: home.y + 1 };
      // a first firing line, day one: crude barricades south of the cabin
      world.zones.defense = [];
      for (const dx of [-3, -1, 1, 3, -5, 5]) {
        const x = home.x + dx, y = home.y + 6;
        if (!world.map.inb(x, y)) continue;
        world.zones.defense.push({ x, y: y - 1 });
        if (Math.abs(dx) <= 3 && !world.map.bIdx[world.map.idx(x, y)]) {
          const b = Things.addBlueprint(world, 'sandbag', x, y);
          if (b) world.plan.placed.push({ key: 'sandbag', x, y });
        }
      }
      plan.stage = 1;
      Chron.log(world, `A plan takes shape: a cabin against the cold, fields to the south, and a fire always burning.`, { icon: ICONS.build, tone: 'good' });
      return;
    }

    // Stage 1: once cabin exists → kitchen & real bedrooms & research
    if (plan.stage === 1 && Overseer.blueprintBacklog(world) < 8 && wood > 40) {
      Overseer.planRoom(world, 'kitchen', {
        dx: 6, dy: -6, w: 7, h: 6,
        furniture: [{ key: 'stove', dx: 2, dy: 1 }, { key: 'butcher', dx: 4, dy: 1 }, { key: 'table', dx: 2, dy: 3 }, { key: 'stool', dx: 1, dy: 3 }, { key: 'stool', dx: 3, dy: 3 }],
      });
      Overseer.planRoom(world, 'study', {
        dx: -11, dy: -6, w: 6, h: 6,
        furniture: [{ key: 'researchDesk', dx: 2, dy: 1 }, { key: 'torch', dx: 1, dy: 4 }],
      });
      Overseer.placeFarm(world, 'healroot', 6, 4);
      plan.stage = 2;
      return;
    }

    // Stage 2: private bedrooms
    if (plan.stage === 2 && Overseer.blueprintBacklog(world) < 8 && wood > 60) {
      Overseer.addBedrooms(world, Math.min(pop, 4));
      plan.stage = 3;
      return;
    }

    // Stage 3: workshop & stockpile barn
    if (plan.stage === 3 && Overseer.blueprintBacklog(world) < 8 && wood > 50) {
      Overseer.planRoom(world, 'workshop', {
        dx: 6, dy: 2, w: 8, h: 6,
        furniture: [{ key: 'workbench', dx: 1, dy: 1 }, { key: 'tailorBench', dx: 4, dy: 1 }, { key: 'torch', dx: 6, dy: 4 }],
      });
      Overseer.planRoom(world, 'barn', { dx: -12, dy: 2, w: 7, h: 6, furniture: [{ key: 'torch', dx: 1, dy: 1 }] });
      // move most of the stockpile indoors (barn interior)
      plan.stockBarn = { x: home.x - 12 + 1, y: home.y + 2 + 1, w: 5, h: 4 };
      plan.stage = 4;
      return;
    }

    // Stage 4: defenses (triggered by fear or prosperity)
    if (plan.stage === 4 && (plan.firstRaidSeen || Sim.colonyWealth(world) > 6000) && Overseer.blueprintBacklog(world) < 8) {
      Overseer.planPerimeter(world);
      plan.stage = 5;
      return;
    }

    // Stage 5: comfort — rec room, hospital, hearth, flowers
    if (plan.stage === 5 && Overseer.blueprintBacklog(world) < 8 && wood > 60) {
      Overseer.planRoom(world, 'recroom', {
        dx: -11, dy: -13, w: 8, h: 6,
        furniture: [{ key: 'gameTable', dx: 2, dy: 2 }, { key: 'stool', dx: 1, dy: 2 }, { key: 'stool', dx: 3, dy: 2 }, { key: 'horseshoes', dx: 5, dy: 3 }, { key: 'hearth', dx: 5, dy: 1 }],
      });
      Overseer.planRoom(world, 'hospital', {
        dx: 6, dy: -13, w: 7, h: 6,
        furniture: [{ key: 'bed', dx: 1, dy: 1 }, { key: 'bed', dx: 3, dy: 1 }, { key: 'torch', dx: 5, dy: 3 }],
      });
      const ws = world.zones.weddingSpot;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const b = Things.addBlueprint(world, 'flowerbed', ws.x + dx, ws.y + dy);
        if (b) world.plan.placed.push({ key: 'flowerbed', x: ws.x + dx, y: ws.y + dy });
      }
      plan.stage = 6;
      return;
    }

    // Stage 6+: growth on demand
    if (plan.stage >= 6) Overseer.growthPass(world, colonists);

    Overseer.maintainZones(world, pop);
    Overseer.maintainQueues(world, pop);
    Overseer.maintainBills(world, pop, colonists);
    Overseer.maintainResearch(world);
    Overseer.maybeParty(world, colonists);
    if (world.t - plan.lastRebuild > 180) { Overseer.rebuildPass(world); plan.lastRebuild = world.t; }
  },

  addBedrooms(world, n) {
    const slots = [
      { dx: -13, dy: -12 }, { dx: -8, dy: -12 }, { dx: -3, dy: -12 }, { dx: 2, dy: -12 }, { dx: 7, dy: -12 }, { dx: 12, dy: -12 },
      { dx: -13, dy: -17 }, { dx: -8, dy: -17 }, { dx: -3, dy: -17 }, { dx: 2, dy: -17 }, { dx: 7, dy: -17 }, { dx: 12, dy: -17 },
      { dx: -18, dy: -12 }, { dx: -18, dy: -17 }, { dx: 17, dy: -12 }, { dx: 17, dy: -17 },
    ];
    let added = 0, cursor = world.plan.bedroomSlots;
    while (added < n && cursor < slots.length) {
      const s = slots[cursor++];
      const ok = Overseer.planRoom(world, 'bedroom' + cursor, {
        dx: s.dx, dy: s.dy, w: 5, h: 5,
        furniture: [{ key: 'bed', dx: 1, dy: 1 }],
      });
      if (ok) added++; // failed slots stay consumed, but only count successes against demand
    }
    world.plan.bedroomSlots = cursor;
    return added;
  },

  planPerimeter(world) {
    const home = world.map.home;
    const x0 = home.x - 16, y0 = home.y - 19, x1 = home.x + 16, y1 = home.y + 7;
    const map = world.map;
    const gate = { x: home.x, y: y1 };
    for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) {
      if (!map.inb(x, y)) continue;
      const i = map.idx(x, y);
      if (map.rock[i] || map.terr[i] === TERR.WATER || map.terr[i] === TERR.MARSH || map.bIdx[i]) continue;
      const isGate = (x >= gate.x - 1 && x <= gate.x + 1 && y === y1);
      const key = isGate ? (x === gate.x ? 'doorWood' : 'sandbag') : 'wallWood';
      const b = Things.addBlueprint(world, key, x, y);
      if (b) world.plan.placed.push({ key, x, y });
    }
    for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) {
      if (!map.inb(x, y)) continue;
      const i = map.idx(x, y);
      if (map.rock[i] || map.terr[i] === TERR.WATER || map.terr[i] === TERR.MARSH || map.bIdx[i]) continue;
      const b = Things.addBlueprint(world, 'wallWood', x, y);
      if (b) world.plan.placed.push({ key: 'wallWood', x, y });
    }
    // sandbag firing line inside the gate
    world.plan.perimeterPlanned = true;
    world.zones.defense = [];
    for (const [dx, dy] of [[-2, -2], [0, -3], [2, -2], [-4, -2], [4, -2], [-1, -3], [1, -3]]) {
      const x = gate.x + dx, y = y1 + dy;
      if (!map.inb(x, y)) continue;
      world.zones.defense.push({ x, y });
      if (Math.abs(dx) <= 2) {
        const i = map.idx(x, y - 0);
        if (!map.bIdx[i] && !map.rock[i]) {
          const b = Things.addBlueprint(world, 'sandbag', x, y);
          if (b) world.plan.placed.push({ key: 'sandbag', x, y });
        }
      }
    }
    Chron.log(world, `${world.colonyName} is raising a palisade. ${world.plan.firstRaidSeen ? 'Never again, they said, and meant it.' : 'Wealth draws wolves; best be ready.'}`, { icon: ICONS.build, tone: 'good', major: true });
  },

  growthPass(world, colonists) {
    const plan = world.plan;
    if (Overseer.blueprintBacklog(world) >= 10) return; // don't drown the builders
    // bedrooms for the homeless
    const beds = world.buildings.filter(b => !b.blueprint && BUILDINGS[b.key].bed && !BUILDINGS[b.key].crib && !b.prison);
    const adults = colonists.filter(p => p.stage(world) !== 'baby' && p.stage(world) !== 'toddler');
    if (beds.length < adults.length) { if (Overseer.addBedrooms(world, adults.length - beds.length)) return; }
    // prison when wanted
    if (plan.prisonWanted && !plan.roomsBuilt.prison) {
      Overseer.planRoom(world, 'prison', {
        dx: 13, dy: 2, w: 5, h: 5, prison: true,
        furniture: [{ key: 'bed', dx: 1, dy: 1 }, { key: 'stool', dx: 3, dy: 2 }],
      });
      const bedsP = world.plan.placed.filter(pl => pl.prison);
      plan.roomsBuilt.prison = true;
      return;
    }
    // brewery once brewing known
    if (world.techsDone.includes('brewing') && !plan.roomsBuilt.brewhouse) {
      Overseer.planRoom(world, 'brewhouse', { dx: 13, dy: -6, w: 6, h: 5, furniture: [{ key: 'brewery', dx: 1, dy: 1 }] });
      Overseer.placeFarm(world, 'hops', 6, 4);
      return;
    }
    // art bench once artistry known
    if (world.techsDone.includes('artistry') && !plan.roomsBuilt.artcorner) {
      const spot = world.map.findSpotNear(world.map.home.x + 8, world.map.home.y + 3, 6, (x, y) => !world.map.bIdx[world.map.idx(x, y)] && world.map.standable(x, y, world));
      if (spot) {
        const b = Things.addBlueprint(world, 'artBench', spot.x, spot.y);
        if (b) world.plan.placed.push({ key: 'artBench', x: spot.x, y: spot.y });
        plan.roomsBuilt.artcorner = true;
        // decor spots for future sculptures
        plan.decorSpots = [
          { x: world.map.home.x - 2, y: world.map.home.y + 1 }, { x: world.map.home.x + 2, y: world.map.home.y + 1 },
          { x: world.map.home.x, y: world.map.home.y - 8 },
        ];
        return;
      }
    }
    // cotton field once tailoring known
    if (world.techsDone.includes('tailoring') && !plan.cottonField) {
      Overseer.placeFarm(world, 'cotton', 6, 5);
      plan.cottonField = true;
      return;
    }
    // turrets flanking the gate once gunsmithing is mastered
    if (world.techsDone.includes('gunsmithing') && plan.perimeterPlanned && !plan.turretsPlanned && Things.count(world, 'steel') >= 46) {
      plan.turretsPlanned = true;
      const line = world.zones.defense || [];
      let placed = 0;
      for (const spot of line) {
        if (placed >= 2) break;
        const p2 = world.map.findSpotNear(spot.x, spot.y, 3, (x, y) => !world.map.bIdx[world.map.idx(x, y)] && world.map.standable(x, y, world));
        if (p2) {
          const b = Things.addBlueprint(world, 'turret', p2.x, p2.y);
          if (b) { world.plan.placed.push({ key: 'turret', x: p2.x, y: p2.y }); placed++; }
        }
      }
      if (placed) Chron.log(world, `The machinists are assembling ${placed === 1 ? 'a gun turret' : 'gun turrets'} to watch the gate. The colony sleeps easier already, and louder soon.`, { icon: ICONS.build, tone: 'good', major: true });
      return;
    }
    // creeping upgrade: wooden perimeter becomes stone, a stretch at a time
    if (world.techsDone.includes('fortification') && plan.perimeterPlanned && !world.threat && Things.count(world, 'stone') >= 24 && world.hourOfDay === 13) {
      let swapped = 0;
      for (const pl of world.plan.placed) {
        if (swapped >= 2) break;
        if (pl.key !== 'wallWood') continue;
        const bid = world.map.bIdx[world.map.idx(pl.x, pl.y)];
        const b = bid ? world.byId[bid] : null;
        if (!b || b.blueprint || b.key !== 'wallWood') continue;
        Things.removeBuilding(world, b);
        const bp = Things.addBlueprint(world, 'wallStone', pl.x, pl.y);
        if (bp) { pl.key = 'wallStone'; swapped++; }
      }
      if (swapped && !plan.stoneWallAnnounced) {
        plan.stoneWallAnnounced = true;
        Chron.log(world, `Stone is replacing timber along the wall, one course at a time. Future raiders will find ${world.colonyName} considerably less flammable.`, { icon: ICONS.build, tone: 'good' });
      }
    }
  },

  maintainZones(world, pop) {
    // graveyard appears on first death
    if (world.plan.firstDeathSeen && !world.zones.graveyard) {
      const home = world.map.home;
      world.zones.graveyard = { x: home.x - 22, y: home.y + 9, w: 5, h: 6, used: 0 };
    }
    // our dead deserve graves: one open plot per colonist corpse
    const colonistCorpses = world.items.filter(s => s.kind === 'corpse' && s.meta.faction === 'colony' && !s.meta.animal).length;
    if (colonistCorpses > 0) {
      const openGraves = world.buildings.filter(b => BUILDINGS[b.key].grave && (!b.meta || !b.meta.occupant)).length;
      for (let k = openGraves; k < colonistCorpses; k++) Overseer.requestGrave(world);
    }
  },

  requestGrave(world) {
    const gy = world.zones.graveyard;
    if (!gy) return null;
    const spot = world.map.findSpotNear(gy.x + (gy.used % gy.w), gy.y + Math.floor(gy.used / gy.w), 8,
      (x, y) => !world.map.bIdx[world.map.idx(x, y)] && world.map.standable(x, y, world));
    if (!spot) return null;
    gy.used++;
    const b = Things.addBlueprint(world, 'grave', spot.x, spot.y);
    return b;
  },

  maintainQueues(world, pop) {
    const map = world.map;
    // wood: keep a healthy stack
    const wood = Things.count(world, 'wood');
    const wantWood = BAL.woodLow + pop * 12 + (world.season === 'Fall' ? 40 : 0);
    if (wood < wantWood && world.chopQueue.size < 6) {
      let added = 0;
      let bestList = [];
      for (let i = 0; i < map.plantG.length; i++) {
        const pl = map.plantG[i];
        if (!pl || !PLANTS[pl.kind].tree || pl.growth < 0.5) continue;
        if (world.chopQueue.has(i)) continue;
        const x = i % map.w, y = Math.floor(i / map.w);
        const d = U.dist(x, y, map.home.x, map.home.y);
        if (d < 40) bestList.push({ i, d });
      }
      bestList.sort((a, b) => a.d - b.d);
      for (const t of bestList) { world.chopQueue.add(t.i); if (++added >= 5) break; }
    }
    // steel & stone via mining — turrets need a real stockpile, not a pantry
    const steelTarget = world.techsDone.includes('gunsmithing') ? 70 : world.techsDone.includes('smithing') ? 45 : 30;
    const needSteel = Things.count(world, 'steel') < steelTarget && (world.techsDone.includes('smithing') || world.plan.stage >= 1);
    const needStone = Things.count(world, 'chunk') < 10 && world.techsDone.includes('stonecutting');
    if ((needSteel || needStone) && world.mineQueue.size < 5) {
      let candidates = [];
      for (let i = 0; i < map.rock.length; i++) {
        if (!map.rock[i]) continue;
        const wantOre = needSteel && map.ore[i] === 1;
        const plainOk = needStone && !map.ore[i];
        if (!wantOre && !plainOk && map.ore[i] !== 2) continue;
        const x = i % map.w, y = Math.floor(i / map.w);
        // must be reachable: an adjacent standable tile
        let reachable = false;
        for (let d = 0; d < 4; d++) {
          const nx = x + [1, -1, 0, 0][d], ny = y + [0, 0, 1, -1][d];
          if (map.inb(nx, ny) && !map.rock[map.idx(nx, ny)] && map.terr[map.idx(nx, ny)] !== TERR.WATER) { reachable = true; break; }
        }
        if (!reachable) continue;
        const dist = U.dist(x, y, map.home.x, map.home.y);
        candidates.push({ i, dist, pri: map.ore[i] ? 0 : 1 });
      }
      candidates.sort((a, b) => (a.pri - b.pri) || (a.dist - b.dist));
      for (let k = 0; k < Math.min(4, candidates.length); k++) world.mineQueue.add(candidates[k].i);
    }
    // hunting: keep meat stocked
    const meat = Things.count(world, 'rawMeat');
    const foodShort = Things.countFood(world) < pop * 2.5;
    const famine = Things.countFood(world) < pop * 1.2;
    if ((meat < pop * 4 || foodShort) && world.huntQueue.length < (famine ? 4 : 2)) {
      const prey = world.animals.filter(a => !a.dead && !a.tame && !a.def().predator && !world.huntQueue.includes(a.id));
      prey.sort((a, b) => U.dist(a.x, a.y, map.home.x, map.home.y) - U.dist(b.x, b.y, map.home.x, map.home.y));
      if (prey.length) world.huntQueue.push(prey[0].id);
    }
  },

  maintainBills(world, pop, colonists) {
    // demand is recomputed absolutely each pass — bills shrink when supply
    // appears (looted, crafted, lying on the ground), so no infinite bow mills
    const ensureBill = (key, spec, want) => {
      let bill = world.bills.find(b => b.key === key);
      if (!bill && want > 0) { bill = { id: U.uid(), key, ...spec, count: 0 }; world.bills.push(bill); }
      if (bill) bill.count = Math.max(0, want);
    };
    const groundWeapons = (k) => world.items.filter(s => s.kind === 'weaponItem' && !s.carried && s.meta && s.meta.key === k).length;
    const groundApparel = (k) => world.items.filter(s => s.kind === 'apparelItem' && !s.carried && s.meta && s.meta.key === k).length;
    // stone blocks from chunks
    if (world.techsDone.includes('stonecutting') && Things.count(world, 'chunk') >= 1 && Things.count(world, 'stone') < 60) {
      ensureBill('stonecut', { bench: 'stonecutting', skill: 'Crafting', wk: 14, cost: { chunk: 1 }, out: 'stone', outQty: 4 }, 6);
    }
    // medicine
    if (world.techsDone.includes('medicine') && Things.count(world, 'medkit') < pop) {
      ensureBill('medkit', { bench: 'tailoring', skill: 'Medicine', wk: 22, cost: { herbal: 2, cloth: 1 }, out: 'medkit', outQty: 2, tech: 'medicine' }, 3);
    }
    // clothes & winter coats
    if (world.techsDone.includes('tailoring')) {
      const ragged = colonists.filter(p => p.apparel === 'rags').length;
      if (ragged > 0 && Things.count(world, 'cloth') >= 12) {
        ensureBill('clothes', { bench: 'tailoring', skill: 'Crafting', wk: 20, cost: { cloth: 12 }, out: 'apparel', outKey: 'clothes' }, ragged);
      }
      if ((world.season === 'Fall' || world.season === 'Winter')) {
        const coatless = colonists.filter(p => !['coat', 'parka'].includes(p.apparel)).length;
        if (coatless > 0 && Things.count(world, 'leather') >= 14) {
          ensureBill('coat', { bench: 'tailoring', skill: 'Crafting', wk: 26, cost: { leather: 14 }, out: 'apparel', outKey: 'coat' }, Math.min(coatless, 3));
        }
      }
    }
    // weapons: bows for the unarmed, blades once smithing — but a bow lying in
    // the stockpile counts as a bow; the mill stops when supply meets demand
    const unarmed = colonists.filter(p => !p.weapon && p.canFight(world)).length;
    const groundArms = world.items.filter(s => s.kind === 'weaponItem' && !s.carried).length;
    if (Things.count(world, 'wood') >= 12) {
      ensureBill('bow', { bench: 'stonecutting', skill: 'Crafting', wk: 18, cost: { wood: 12 }, out: 'weapon', outKey: 'bow' }, U.clamp(unarmed - groundArms, 0, 2));
    }
    if (world.techsDone.includes('smithing') && Things.count(world, 'steel') >= 8) {
      const meleeless = colonists.filter(p => p.canFight(world) && (!p.weapon || p.weapon === 'club' || p.weapon === 'knife')).length;
      ensureBill('machete', { bench: 'smithing', skill: 'Crafting', wk: 26, cost: { steel: 8 }, out: 'weapon', outKey: 'machete', tech: 'smithing' }, U.clamp(meleeless - 1 - groundWeapons('machete'), 0, 1));
    }
    if (world.techsDone.includes('gunsmithing') && Things.count(world, 'steel') >= 28) {
      const gunless = colonists.filter(p => p.canFight(world) && (!p.weapon || WEAPONS[p.weapon].melee)).length;
      ensureBill('rifle', { bench: 'smithing', skill: 'Crafting', wk: 44, cost: { steel: 28, wood: 6 }, out: 'weapon', outKey: 'rifle', tech: 'gunsmithing' }, U.clamp(gunless - groundWeapons('rifle'), 0, 1));
    }
    // art
    if (world.techsDone.includes('artistry') && Things.count(world, 'stone') >= 10 && world.plan.decorSpots.length) {
      ensureBill('sculpture', { bench: 'art', skill: 'Crafting', wk: 40, cost: { stone: 10 }, out: 'sculpture', tech: 'artistry' }, 1);
    }
    // beer
    if (world.techsDone.includes('brewing') && Things.count(world, 'hops') >= 6 && Things.count(world, 'beer') < 15) {
      ensureBill('beer', { bench: 'brewing', skill: 'Cooking', wk: 24, cost: { hops: 6 }, out: 'beer', outQty: 5, tech: 'brewing' }, 3);
    }
    // flak vests for the unarmored line
    if (world.techsDone.includes('smithing') && Things.count(world, 'steel') >= 25 && Things.count(world, 'cloth') >= 6) {
      const unarmored = colonists.filter(p => p.canFight(world) && p.apparel !== 'flak' && p.apparel !== 'parka').length;
      ensureBill('flak', { bench: 'smithing', skill: 'Crafting', wk: 34, cost: { steel: 25, cloth: 6 }, out: 'apparel', outKey: 'flak', tech: 'smithing' }, U.clamp(unarmored - 1 - groundApparel('flak'), 0, 1));
    }
    // peg legs for those the rim took a leg from
    if (world.techsDone.includes('smithing')) {
      const legless = colonists.filter(p => p.lostParts.includes('lLeg') || p.lostParts.includes('rLeg')).length;
      if (legless > 0 && Things.count(world, 'steel') >= 4 && Things.count(world, 'wood') >= 6) {
        ensureBill('pegleg', { bench: 'smithing', skill: 'Crafting', wk: 28, cost: { wood: 6, steel: 4 }, out: 'pegleg', tech: 'smithing' }, legless);
      }
    }
  },

  finishBill(world, bill, p, bench) {
    switch (bill.out) {
      case 'pegleg': {
        const patient = world.pawns.find(q => q.isColonist() && (q.lostParts.includes('lLeg') || q.lostParts.includes('rLeg')));
        if (patient) {
          const leg = patient.lostParts.includes('lLeg') ? 'lLeg' : 'rLeg';
          patient.lostParts = patient.lostParts.filter(k => k !== leg);
          patient.parts[leg].hp = Math.round(BODY_PARTS[leg].max * 0.55);
          patient.pegLeg = true;
          patient.recomputePain();
          patient.checkDowned(world);
          patient.addStory(world, `Fitted with a carved peg leg by ${p.label()}`);
          Chron.log(world, Chron.pick(world, [
            `${p.label()} fitted ${patient.label()} with a carved peg leg. First lap of the yard: slow, loud, triumphant. ${U.cap(patient.he)} walks again.`,
            `A peg leg for ${patient.label()}, oak and steel and ${p.label()}'s best work. The tapping in the corridor is the sound of a promise kept.`,
          ]), { icon: ICONS.heal, tone: 'good', major: true });
          Chron.remember(world, { kind: 'heal', text: `${patient.label()} walked again on a carved peg leg`, pawns: [patient.id, p.id] });
        }
        break;
      }
      case 'stone': Things.drop(world, bench.x, bench.y, 'stone', bill.outQty || 4); break;
      case 'medkit': Things.drop(world, bench.x, bench.y, 'medkit', bill.outQty || 2); break;
      case 'beer': Things.drop(world, bench.x, bench.y, 'beer', bill.outQty || 5); break;
      case 'weapon': Things.drop(world, bench.x, bench.y, 'weaponItem', 1, { key: bill.outKey }); break;
      case 'apparel': {
        Things.drop(world, bench.x, bench.y, 'apparelItem', 1, { key: bill.outKey });
        Overseer.distributeApparel(world);
        break;
      }
      case 'sculpture': {
        const spot = world.plan.decorSpots.shift();
        if (spot) {
          const quality = U.clamp(0.5 + p.skill('Crafting') * 0.07 + world.rng.rf(-0.15, 0.3) + (p.inspired === 'art' ? 0.5 : 0), 0.3, 2);
          const desc = Chron.artDesc(world, p, quality);
          const b = Things.placeBuilt(world, 'sculpture', spot.x, spot.y, { desc, artist: p.label() });
          if (b) {
            b.quality = quality;
            if (quality >= 1.4) {
              p.addThought(world, 'craftedMasterwork');
              p.inspired = null;
              Chron.log(world, `${p.label()} has finished a masterwork: ${desc}`, { icon: ICONS.art, tone: 'good', major: true });
              Chron.remember(world, { kind: 'art', text: `${p.label()} carved a masterwork sculpture`, pawns: [p.id] });
            } else {
              Chron.log(world, `${p.label()} finished a sculpture: ${desc}`, { icon: ICONS.art, tone: 'good' });
            }
          }
        }
        break;
      }
    }
  },

  distributeApparel(world) {
    // hand the best clothes to whoever is dressed worst
    const rank = { rags: 0, clothes: 1, coat: 2, flak: 2, parka: 3 };
    for (const s of [...world.items]) {
      if (s.kind !== 'apparelItem' || s.carried) continue;
      const key = s.meta.key;
      let worst = null;
      for (const p of world.pawns) {
        if (!p.isColonist() || p.stage(world) === 'baby') continue;
        if ((rank[p.apparel] || 0) < (rank[key] || 0) && (!worst || (rank[p.apparel] || 0) < (rank[worst.apparel] || 0))) worst = p;
      }
      if (worst) {
        worst.apparel = key;
        Things.take(world, s, 1);
        if (world.rng.chance(0.4)) Chron.log(world, `${worst.label()} pulled on a new ${APPAREL[key].n}${world.season === 'Winter' ? ' against the cold' : ''}.`, { icon: '🧥', tone: 'good' });
      } else break;
    }
  },

  maintainResearch(world) {
    if (world.research) return;
    const order = ['stonecutting', 'tailoring', 'smithing', 'medicine', 'fortification', 'artistry', 'brewing', 'gunsmithing'];
    for (const key of order) {
      if (world.techsDone.includes(key)) continue;
      const def = TECHS[key];
      if (def.req && !world.techsDone.includes(def.req)) continue;
      world.research = { key, progress: 0, need: def.days * 900 };
      return;
    }
  },

  finishResearch(world, p) {
    const key = world.research.key;
    world.techsDone.push(key);
    world.research = null;
    Chron.log(world, Chron.pick(world, [
      `${p.label()} looked up from the research desk, eyes shining: ${TECHS[key].n} — ${TECHS[key].d}.`,
      `Breakthrough! ${world.colonyName} has mastered ${TECHS[key].n.toLowerCase()}.`,
    ]), { icon: ICONS.research, tone: 'good', major: true });
    p.addStory(world, `Completed the research of ${TECHS[key].n}`);
    Overseer.maintainResearch(world);
  },

  // ---- roles --------------------------------------------------------------
  assignRolesDaily(world) {
    const colonists = world.pawns.filter(p => p.isColonist() && !p.downed);
    if (!colonists.length) return;
    const bySkill = (s) => [...colonists].filter(p => p.stage(world) === 'adult').sort((a, b) => b.skill(s) - a.skill(s));
    const doctors = bySkill('Medicine').filter(p => p.canDo('caring')).slice(0, 2).map(p => p.id);
    const cooks = bySkill('Cooking').slice(0, 2).map(p => p.id);
    const hunters = bySkill('Shooting').filter(p => p.canFight(world) && !p.weaponDef().melee).slice(0, 2).map(p => p.id);
    const wardens = bySkill('Social').slice(0, 2).map(p => p.id);
    const researchers = bySkill('Intellectual').filter(p => p.canDo('intellectual')).slice(0, 2).map(p => p.id);

    for (const p of colonists) {
      const roles = [];
      const stage = p.stage(world);
      if (stage === 'baby' || stage === 'toddler') { p.roles = []; continue; }
      if (stage === 'child') {
        p.roles = ['harvest', 'sow', 'haul', 'clean'];
        continue;
      }
      if (doctors.includes(p.id)) roles.push('doctor');
      roles.push('equip');
      roles.push('bury');
      if (wardens.includes(p.id)) roles.push('warden');
      if (cooks.includes(p.id)) { roles.push('cook'); roles.push('butcher'); }
      if (hunters.includes(p.id)) roles.push('hunt');
      // main vocation by best skill
      const vocations = [
        ['Plants', ['harvest', 'sow', 'chop']],
        ['Construction', ['build']],
        ['Mining', ['mine']],
        ['Crafting', ['craft']],
        ['Intellectual', ['research']],
      ];
      vocations.sort((a, b) => p.skill(b[0]) - p.skill(a[0]));
      for (const [, keys] of vocations) for (const k of keys) if (!roles.includes(k)) roles.push(k);
      if (researchers.includes(p.id) && p.canDo('intellectual')) {
        const ix = roles.indexOf('research');
        if (ix > 0) { roles.splice(ix, 1); roles.splice(1, 0, 'research'); }
      }
      for (const k of ['harvest', 'sow', 'build', 'repair', 'haul', 'craft', 'clean']) if (!roles.includes(k)) roles.push(k);
      p.roles = roles;
    }
    Overseer.assignBeds(world, colonists);
  },

  assignBeds(world, colonists) {
    const beds = world.buildings.filter(b => !b.blueprint && BUILDINGS[b.key].bed && !BUILDINGS[b.key].crib && !b.prison);
    for (const b of beds) {
      if (b.ownerId && !world.byId[b.ownerId]) b.ownerId = null;
      if (b.owner2Id && !world.byId[b.owner2Id]) b.owner2Id = null;
    }
    for (const p of colonists) {
      if (p.stage(world) === 'baby' || p.stage(world) === 'toddler') continue;
      let mine = beds.find(b => b.ownerId === p.id || b.owner2Id === p.id);
      if (mine) continue;
      // couples share doubles
      const partner = world.byId[p.spouseId || p.loverId];
      if (partner) {
        const theirs = beds.find(b => (b.ownerId === partner.id) && BUILDINGS[b.key].double && !b.owner2Id);
        if (theirs) { theirs.owner2Id = p.id; continue; }
      }
      const free = beds.find(b => !b.ownerId);
      if (free) free.ownerId = p.id;
    }
  },

  wantDoubleRoom(world, a, b) {
    // upgrade one of the couple's rooms to a double bed
    const beds = world.buildings.filter(bb => !bb.blueprint && BUILDINGS[bb.key].bed && (bb.ownerId === a.id || bb.ownerId === b.id));
    if (!beds.length) return;
    const keep = beds[0];
    const spot = { x: keep.x, y: keep.y };
    Things.removeBuilding(world, keep);
    const bp = Things.addBlueprint(world, 'doubleBed', spot.x, spot.y);
    if (bp) {
      world.plan.placed.push({ key: 'doubleBed', x: spot.x, y: spot.y });
      bp.claimA = a.id; bp.claimB = b.id;
    }
    for (const other of beds.slice(1)) { other.ownerId = null; other.owner2Id = null; }
  },

  noteNewResident(world, baby) {
    // crib in the family bedroom
    const mother = world.byId[baby.family.mo];
    if (!mother) return;
    const bed = world.buildings.find(b => !b.blueprint && BUILDINGS[b.key].bed && (b.ownerId === mother.id || b.owner2Id === mother.id));
    if (!bed) return;
    const spot = world.map.findSpotNear(bed.x, bed.y, 3, (x, y) => {
      const i = world.map.idx(x, y);
      return !world.map.bIdx[i] && world.map.roomAt(x, y) === world.map.roomAt(bed.x, bed.y);
    });
    if (spot) {
      const b = Things.addBlueprint(world, 'crib', spot.x, spot.y);
      if (b) { b.ownerBaby = baby.id; world.plan.placed.push({ key: 'crib', x: spot.x, y: spot.y }); }
    }
  },

  onBuilt(world, b, builder) {
    if (b.key === 'doubleBed' && b.claimA) { b.ownerId = b.claimA; b.owner2Id = b.claimB; }
    if (b.key === 'stove' && !world.plan.stoveAnnounced) {
      world.plan.stoveAnnounced = true;
      Chron.log(world, `The kitchen stove is lit. Hot meals from now on — ${builder.label()} takes full credit.`, { icon: ICONS.food, tone: 'good' });
    }
    if ((b.key === 'wallWood' || b.key === 'wallStone') && world.plan.perimeterPlanned && !world.plan.wallAnnounced) {
      const wallsLeft = world.buildings.some(bb => bb.blueprint && (bb.key === 'wallWood' || bb.key === 'wallStone'));
      if (!wallsLeft) {
        world.plan.wallAnnounced = true;
        Chron.log(world, `The palisade is closed. ${world.colonyName} sleeps a little easier behind its wall.`, { icon: ICONS.build, tone: 'good', major: true });
        Chron.remember(world, { kind: 'built', text: `the palisade was completed`, pawns: [] });
      }
    }
    if (world.plan.stockBarn && b.key === 'floorWood') {
      // once barn floor exists, shift stockpile indoors
      const sb = world.plan.stockBarn;
      const roomHere = world.map.roomAt(sb.x, sb.y);
      if (roomHere && roomHere.indoor) {
        world.zones.stock = new Set();
        for (let yy = sb.y; yy < sb.y + sb.h; yy++) for (let xx = sb.x; xx < sb.x + sb.w; xx++) world.zones.stock.add(world.map.idx(xx, yy));
        world.plan.stockBarn = null;
      }
    }
  },

  // Re-queue blueprints for anything destroyed (walls after raids, burned furniture).
  rebuildPass(world) {
    const map = world.map;
    const seen = new Set();
    let queued = 0;
    for (let k = world.plan.placed.length - 1; k >= 0 && queued < 30; k--) {
      const pl = world.plan.placed[k];
      const tileKey = pl.x * 4096 + pl.y;
      if (seen.has(tileKey)) continue;
      seen.add(tileKey);
      if (pl.dead) continue;
      const i = map.idx(pl.x, pl.y);
      if (pl.key === 'floorWood' || pl.key === 'floorStone') {
        if (map.floor[i] || map.bIdx[i]) continue;
        if (Things.addBlueprint(world, pl.key, pl.x, pl.y)) queued++;
        continue;
      }
      if (map.bIdx[i]) continue;
      const b = Things.addBlueprint(world, pl.key, pl.x, pl.y, pl.meta || null);
      if (b) { if (pl.prison) b.prison = true; queued++; }
    }
  },

  // ---- fighters & captures ------------------------------------------------
  equipFighters(world) {
    const weapons = world.items.filter(s => s.kind === 'weaponItem' && !s.carried);
    weapons.sort((a, b) => (WEAPONS[b.meta.key].v || 0) - (WEAPONS[a.meta.key].v || 0));
    const fighters = world.pawns.filter(p => p.isColonist() && p.canFight(world));
    fighters.sort((a, b) => b.skill('Shooting') - a.skill('Shooting'));
    for (const p of fighters) {
      const current = p.weapon ? (WEAPONS[p.weapon].v || 0) : -1;
      const prefMelee = p.hasTrait('brawler') || p.skill('Melee') > p.skill('Shooting') + 3;
      let bestIx = -1;
      for (let i = 0; i < weapons.length; i++) {
        const def = WEAPONS[weapons[i].meta.key];
        if (def.v <= current) continue;
        if (prefMelee && !def.melee && bestIx >= 0) continue;
        bestIx = i;
        if (prefMelee === !!def.melee) break;
      }
      if (bestIx >= 0) {
        const s = weapons.splice(bestIx, 1)[0];
        const old = p.weapon;
        p.weapon = s.meta.key;
        Things.take(world, s, 1);
        if (old) Things.drop(world, Math.round(p.x), Math.round(p.y), 'weaponItem', 1, { key: old });
      }
    }
  },

  considerCaptures(world) {
    const colonists = world.pawns.filter(p => p.isColonist());
    if (!colonists.length || colonists.length >= BAL.popSoftCap) return;
    const downedFoes = world.pawns.filter(q => (q.faction === 'pirate' || q.faction === 'tribe') && q.downed && !q.dead && !q.prisoner && !q.gone);
    if (!downedFoes.length) return;
    world.plan.prisonWanted = true;
    let prisonBeds = world.buildings.filter(b => !b.blueprint && BUILDINGS[b.key].bed && b.prison);
    // no cell yet? throw a pallet in a spare corner — the rim improvises
    if (!prisonBeds.length && !world.buildings.some(b => b.blueprint && b.prison)) {
      for (let r = 1; r < world.map.rooms.length && !prisonBeds.length; r++) {
        const room = world.map.rooms[r];
        if (!room || !room.indoor || room.kind === 'kitchen') continue;
        const spot = room.tiles.map(i => ({ x: i % world.map.w, y: Math.floor(i / world.map.w) }))
          .find(t => !world.map.bIdx[world.map.idx(t.x, t.y)] && world.map.standable(t.x, t.y, world));
        if (spot) {
          const bp = Things.addBlueprint(world, 'bedroll', spot.x, spot.y);
          if (bp) {
            bp.prison = true;
            world.plan.placed.push({ key: 'bedroll', x: spot.x, y: spot.y, prison: true });
            Chron.log(world, `A corner is being cleared for a makeshift cell. Waste not — even enemies can become neighbors, given bread and time.`, { icon: '⛓️', tone: 'neutral' });
          }
          break;
        }
      }
    }
    const prisoners = world.pawns.filter(q => q.prisoner && !q.dead);
    for (const foe of downedFoes) {
      // hold the wounded where they fell while a cell is arranged
      foe.captureHold = world.t + BAL.MIN_PER_DAY * 1.5;
      if (prisoners.length >= prisonBeds.length) continue;
      const bed = prisonBeds.find(b => !world.pawns.some(q => q.prisoner && q.inBedId === b.id) && !world.captureQueue.some(cq => cq.bedId === b.id));
      if (!bed) break;
      if (world.captureQueue.some(cq => cq.pawnId === foe.id)) continue;
      world.captureQueue.push({ pawnId: foe.id, bedId: bed.id });
      prisoners.push(foe);
    }
  },

  maybeParty(world, colonists) {
    if (world.threat || world.gatherings.length) return;
    if (world.t - world.plan.lastParty < 4 * BAL.MIN_PER_DAY) return;
    const avgMood = colonists.reduce((s, p) => s + p.mood, 0) / colonists.length;
    const meals = Things.count(world, 'mealSimple') + Things.count(world, 'mealFine');
    if (avgMood > 55 && meals > colonists.length * 2 && world.rng.chance(0.05) && world.hourOfDay >= 17 && world.hourOfDay <= 19) {
      world.plan.lastParty = world.t;
      Social.startParty(world, world.rng.pick(['no reason at all, which is the best reason', 'a good week', 'surviving another season', `${world.rng.pick(colonists).label()}'s birthday, probably`]));
    }
  },
};

Object.assign(globalThis, { Overseer });
