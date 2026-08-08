// things.js — physical stuff in the world: item stacks, buildings, blueprints, zones.

const Things = {
  // ---- Items -------------------------------------------------------------
  drop(world, x, y, kind, qty, meta) {
    if (qty <= 0) return null;
    const map = world.map;
    const def = ITEMS[kind];
    // Merge into an existing stack of the same kind nearby
    const spot = map.findSpotNear(x, y, 8, (tx, ty) => {
      const i = map.idx(tx, ty);
      if (map.rock[i] || map.terr[i] === TERR.WATER) return false;
      const sid = map.itemG[i];
      if (sid) {
        const s = world.byId[sid];
        return !meta && s && s.kind === kind && !s.meta && s.qty + qty <= (def.stack || 75);
      }
      const bid = map.bIdx[i];
      if (bid) {
        const b = world.byId[bid];
        if (b && !b.blueprint && !BUILDINGS[b.key].walk) return false;
      }
      return true;
    });
    if (!spot) return null;
    const i = map.idx(spot.x, spot.y);
    const sid = map.itemG[i];
    if (sid && !meta) {
      const s = world.byId[sid];
      if (s && s.kind === kind && !s.meta) {
        // merged stacks age by weighted average, so fresh food doesn't inherit old rot
        s.day = Math.round((s.day * s.qty + world.day * qty) / (s.qty + qty));
        s.qty += qty;
        return s;
      }
    }
    const stack = { id: U.uid(), thing: 'item', kind, qty, x: spot.x, y: spot.y, meta: meta || null, day: world.day };
    world.items.push(stack);
    world.byId[stack.id] = stack;
    map.itemG[i] = stack.id;
    return stack;
  },

  removeStack(world, stack) {
    const i = world.map.idx(stack.x, stack.y);
    if (world.map.itemG[i] === stack.id) world.map.itemG[i] = 0;
    const ix = world.items.indexOf(stack);
    if (ix >= 0) world.items.splice(ix, 1);
    delete world.byId[stack.id];
  },

  take(world, stack, qty) {
    const got = Math.min(qty, stack.qty);
    stack.qty -= got;
    if (stack.qty <= 0) Things.removeStack(world, stack);
    return got;
  },

  count(world, kind) {
    let total = 0;
    for (const s of world.items) if (s.kind === kind && !s.carried) total += s.qty;
    for (const p of world.pawns) if (p.carry && p.carry.kind === kind) total += p.carry.qty;
    return total;
  },

  countFood(world) {
    let total = 0;
    for (const s of world.items) {
      if (s.carried) continue;
      const def = ITEMS[s.kind];
      if (def && def.food) total += def.food * s.qty;
    }
    return total;
  },

  nearestItem(world, x, y, pred) {
    let best = null, bestD = Infinity;
    for (const s of world.items) {
      if (s.carried) continue;
      if (!pred(s)) continue;
      const d = U.dist(x, y, s.x, s.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  },

  // Is this stack lying outside a stockpile? (haulable)
  inStockpile(world, s) {
    return world.zones.stock.has(world.map.idx(s.x, s.y));
  },

  freeStockTile(world, forKind) {
    const map = world.map;
    let mergeTile = null, freeTile = null;
    for (const i of world.zones.stock) {
      const sid = map.itemG[i];
      if (sid) {
        const st = world.byId[sid];
        if (forKind && st && st.kind === forKind && !st.meta && st.qty < (ITEMS[forKind].stack || 75)) { mergeTile = i; break; }
      } else if (freeTile === null && !map.fireG[i]) {
        const bid = map.bIdx[i];
        if (!bid || (world.byId[bid] && BUILDINGS[world.byId[bid].key] && BUILDINGS[world.byId[bid].key].walk)) freeTile = i;
      }
    }
    const i = mergeTile !== null ? mergeTile : freeTile;
    if (i === null) return null;
    return { x: i % map.w, y: Math.floor(i / map.w) };
  },

  // ---- Buildings ---------------------------------------------------------
  addBlueprint(world, key, x, y, meta) {
    const map = world.map;
    if (!map.inb(x, y)) return null;
    const i = map.idx(x, y);
    if (map.rock[i] || map.terr[i] === TERR.WATER || map.terr[i] === TERR.MARSH) return null;
    if (map.bIdx[i]) return null;
    const b = { id: U.uid(), thing: 'building', key, x, y, hp: 1, blueprint: true, work: 0, fetched: false, meta: meta || null };
    world.buildings.push(b);
    world.byId[b.id] = b;
    map.bIdx[i] = b.id;
    return b;
  },

  finishBuilding(world, b) {
    const def = BUILDINGS[b.key];
    if (def.floor) { // floors become terrain, not buildings
      world.map.floor[world.map.idx(b.x, b.y)] = def.floor;
      Things.removeBuilding(world, b);
      return;
    }
    b.blueprint = false;
    b.hp = def.hp;
    if (def.door) b.open = false;
    if (def.fire) { b.lit = false; b.fuel = 0; }
    world.map.roomsDirty = true;
    // clear plants under real buildings
    const i = world.map.idx(b.x, b.y);
    world.map.plantG[i] = null;
  },

  placeBuilt(world, key, x, y, meta) {
    const b = Things.addBlueprint(world, key, x, y, meta);
    if (b) Things.finishBuilding(world, b);
    return b;
  },

  removeBuilding(world, b) {
    const i = world.map.idx(b.x, b.y);
    if (world.map.bIdx[i] === b.id) world.map.bIdx[i] = 0;
    const ix = world.buildings.indexOf(b);
    if (ix >= 0) world.buildings.splice(ix, 1);
    delete world.byId[b.id];
    if (BUILDINGS[b.key].block || BUILDINGS[b.key].door) world.map.roomsDirty = true;
  },

  damageBuilding(world, b, amt) {
    b.hp -= amt;
    if (b.hp <= 0) {
      const def = BUILDINGS[b.key];
      // partial material refund as debris
      for (const [kind, qty] of Object.entries(def.cost || {})) {
        if (qty >= 3) Things.drop(world, b.x, b.y, kind, Math.max(1, Math.floor(qty * 0.3)));
      }
      Things.removeBuilding(world, b);
      return true;
    }
    return false;
  },

  findBuilding(world, pred) {
    for (const b of world.buildings) if (!b.blueprint && pred(b)) return b;
    return null;
  },

  nearestBuilding(world, x, y, pred) {
    let best = null, bestD = Infinity;
    for (const b of world.buildings) {
      if (b.blueprint || !pred(b)) continue;
      const d = U.dist(x, y, b.x, b.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  },

  // ---- Corpses -----------------------------------------------------------
  dropCorpse(world, pawn) {
    const stack = { id: U.uid(), thing: 'item', kind: 'corpse', qty: 1, x: Math.round(pawn.x), y: Math.round(pawn.y), day: world.day,
      meta: { pawnId: pawn.id, label: pawn.label(), faction: pawn.faction, animal: !!pawn.animal } };
    // corpses don't merge; find any free-ish tile
    const spot = world.map.findSpotNear(stack.x, stack.y, 6, (tx, ty) => {
      const i = world.map.idx(tx, ty);
      return !world.map.rock[i] && world.map.terr[i] !== TERR.WATER && !world.map.itemG[i];
    });
    if (spot) { stack.x = spot.x; stack.y = spot.y; }
    world.items.push(stack);
    world.byId[stack.id] = stack;
    world.map.itemG[world.map.idx(stack.x, stack.y)] = stack.id;
    return stack;
  },

  // ---- Rot ---------------------------------------------------------------
  tickRotDaily(world) {
    let lostFood = 0;
    for (const s of [...world.items]) {
      const def = ITEMS[s.kind];
      let rotD = def && def.rotD;
      if (s.kind === 'corpse') rotD = 30;
      if (!rotD) continue;
      if (world.tempOut <= 0) { s.day++; continue; } // frozen: preserved
      const room = world.map.roomAt(s.x, s.y);
      const mult = (room && room.indoor) ? 0.55 : 1; // cool interior larder effect
      const age = (world.day - s.day) * mult;
      if (age <= rotD) continue;
      if (s.kind === 'corpse') { s.meta.rotten = true; continue; }
      // spoilage is gradual: the edges of the stack go first
      const spoiled = Math.max(1, Math.ceil(s.qty * 0.4));
      if (def.food) lostFood += spoiled;
      Things.take(world, s, spoiled);
    }
    return lostFood;
  },
};

Object.assign(globalThis, { Things });
