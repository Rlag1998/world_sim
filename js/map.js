// map.js — terrain generation, pathfinding (A*), line of sight, room detection.

const TERR = { WATER: 0, MARSH: 1, SAND: 2, SOIL: 3, RICH: 4, GRAVEL: 5, ROCKFLOOR: 6 };
const TERR_COST = { 0: Infinity, 1: 2.2, 2: 1.15, 3: 1, 4: 1, 5: 1.05, 6: 1 };

class GameMap {
  constructor(w, h) {
    this.w = w; this.h = h;
    const n = w * h;
    this.terr = new Uint8Array(n);
    this.rock = new Uint8Array(n);      // natural stone mass
    this.ore = new Uint8Array(n);       // 0 none, 1 steel, 2 gold
    this.floor = new Uint8Array(n);     // 0 none, 1 wood, 2 stone
    this.filth = new Uint8Array(n);     // blood/dirt, 0..250
    this.roomId = new Int16Array(n);    // -1 outside, 0 unset, >0 room index
    this.bIdx = new Int32Array(n);      // building id occupying tile (0 = none)
    this.plantG = new Array(n).fill(null);
    this.itemG = new Int32Array(n);     // item stack id (0 = none)
    this.fireG = new Uint8Array(n);     // fire intensity
    // A* scratch
    this._g = new Float32Array(n);
    this._closed = new Uint8Array(n);
    this._from = new Int32Array(n);
    this.comp = new Int32Array(n);      // walkable-region component id (0 = blocked)
    this.rooms = [];                    // Room objects, index 1-based
    this.roomsDirty = true;
  }

  idx(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  gen(rng, biomeKey) {
    this.biome = biomeKey;
    const B = BIOMES[biomeKey];
    const noiseE = makeNoise(rng), noiseM = makeNoise(rng);
    const { w, h } = this;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = this.idx(x, y);
      const e = noiseE(x, y, 0.045);
      const m = noiseM(x, y, 0.08);
      let t = TERR.SOIL;
      if (e < 0.30 * B.water + 0.14) t = TERR.WATER;
      else if (e < 0.30 * B.water + 0.165) t = TERR.MARSH;
      else if (e < 0.30 * B.water + 0.19) t = TERR.SAND;
      else if (e > 0.74) { t = TERR.ROCKFLOOR; this.rock[i] = 1; }
      else if (e > 0.70) t = TERR.ROCKFLOOR;
      else if (m > 0.63) t = TERR.RICH;
      else if (m < 0.34) t = TERR.GRAVEL;
      this.terr[i] = t;
    }
    // Ore veins: random walks inside rock
    const veins = [{ ore: 1, count: 7, len: [6, 13] }, { ore: 2, count: 2, len: [3, 6] }];
    for (const v of veins) for (let c = 0; c < v.count; c++) {
      let tries = 0, x, y;
      do { x = rng.ri(2, w - 3); y = rng.ri(2, h - 3); tries++; } while (!this.rock[this.idx(x, y)] && tries < 400);
      if (!this.rock[this.idx(x, y)]) continue;
      let len = rng.ri(v.len[0], v.len[1]);
      while (len-- > 0) {
        this.ore[this.idx(x, y)] = v.ore;
        x = U.clamp(x + rng.ri(-1, 1), 1, w - 2); y = U.clamp(y + rng.ri(-1, 1), 1, h - 2);
        if (!this.rock[this.idx(x, y)]) break;
      }
    }
    // Vegetation
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = this.idx(x, y);
      const t = this.terr[i];
      if (this.rock[i] || t === TERR.WATER || t === TERR.MARSH || t === TERR.ROCKFLOOR) continue;
      const fertile = (t === TERR.SOIL || t === TERR.RICH);
      if (fertile && rng.chance(B.trees)) {
        this.plantG[i] = { kind: rng.pick(['pine', 'oak', 'birch']), growth: rng.rf(0.5, 1), i };
      } else if (fertile && rng.chance(B.bushes)) {
        this.plantG[i] = { kind: 'bush', growth: rng.rf(0.4, 1), i };
      } else if (fertile && rng.chance(0.004)) {
        this.plantG[i] = { kind: 'healrootW', growth: rng.rf(0.3, 1), i };
      } else if (fertile && rng.chance(0.3)) {
        this.plantG[i] = { kind: 'grass', growth: rng.rf(0.3, 1), i };
      } else if (fertile && rng.chance(0.02)) {
        this.plantG[i] = { kind: 'flowers', growth: rng.rf(0.3, 1), i };
      }
    }
    this.pickHomeSite(rng);
    this.carveVault(rng);
    this.roomsDirty = true;
  }

  // Find a buildable clearing for the colony, near map center.
  pickHomeSite(rng) {
    const { w, h } = this;
    let best = null, bestScore = -1e9;
    for (let attempt = 0; attempt < 900; attempt++) {
      const x = rng.ri(16, w - 17), y = rng.ri(16, h - 17);
      let ok = true, soil = 0;
      for (let dy = -7; dy <= 7 && ok; dy++) for (let dx = -7; dx <= 7; dx++) {
        const i = this.idx(x + dx, y + dy);
        const t = this.terr[i];
        if (this.rock[i] || t === TERR.WATER || t === TERR.MARSH) { ok = false; break; }
        if (t === TERR.SOIL || t === TERR.RICH) soil++;
      }
      if (!ok) continue;
      const centerDist = U.dist(x, y, w / 2, h / 2);
      const score = soil - centerDist * 1.5;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    this.home = best || { x: Math.floor(w / 2), y: Math.floor(h / 2) };
    // Clear plants in the immediate landing zone
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const i = this.idx(this.home.x + dx, this.home.y + dy);
      if (this.plantG[i] && PLANTS[this.plantG[i].kind].tree) this.plantG[i] = null;
    }
  }

  // Hide a sealed chamber in the mountain: a mid-game mystery.
  carveVault(rng) {
    this.vault = null;
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = rng.ri(4, this.w - 5), y = rng.ri(4, this.h - 5);
      let allRock = true;
      for (let dy = -2; dy <= 2 && allRock; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (!this.rock[this.idx(x + dx, y + dy)]) { allRock = false; break; }
      }
      if (!allRock) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const i = this.idx(x + dx, y + dy);
        this.rock[i] = 0; this.terr[i] = TERR.ROCKFLOOR; this.ore[i] = 0;
      }
      this.vault = { x, y, opened: false, sensed: false };
      return;
    }
  }

  blockedAt(x, y, world) {
    const i = this.idx(x, y);
    if (this.rock[i]) return true;
    const bid = this.bIdx[i];
    if (bid) {
      const b = world.byId[bid];
      if (b && b.blueprint) return false;
      if (b && !BUILDINGS[b.key].walk && !BUILDINGS[b.key].door) return true;
    }
    return false;
  }

  // Movement cost for pathfinding. Enemies pay to break through doors.
  moveCost(x, y, world, opts) {
    const i = this.idx(x, y);
    if (this.rock[i]) return opts && opts.digging ? 40 : Infinity;
    const t = TERR_COST[this.terr[i]];
    if (t === Infinity) return Infinity;
    let c = this.floor[i] ? 0.92 : t;
    const bid = this.bIdx[i];
    if (bid) {
      const b = world.byId[bid];
      if (b && !b.blueprint) {
        const def = BUILDINGS[b.key];
        if (def.door) c += (opts && opts.hostile) ? 9 : 0.35;
        else if (!def.walk) { if (opts && opts.hostile) return 70; return Infinity; }
        else c += 0.2;
      }
    }
    const p = this.plantG[i];
    if (p && PLANTS[p.kind].tree) c += 0.9;
    if (this.fireG[i] && !(opts && opts.ignoreFire)) c += 22;
    return c;
  }

  // Connected components over walkable tiles (doors count as walkable).
  // Lets path() reject unreachable goals instantly instead of flooding the map.
  recomputeComponents(world) {
    const { w, h } = this;
    this.comp.fill(0);
    let next = 0;
    const stack = [];
    for (let i = 0; i < w * h; i++) {
      if (this.comp[i]) continue;
      const x = i % w, y = Math.floor(i / w);
      if (this.moveCost(x, y, world, null) === Infinity) continue;
      next++;
      this.comp[i] = next;
      stack.length = 0;
      stack.push(i);
      while (stack.length) {
        const cur = stack.pop();
        const cx = cur % w, cy = Math.floor(cur / w);
        for (let d = 0; d < 4; d++) {
          const nx = cx + [1, -1, 0, 0][d], ny = cy + [0, 0, 1, -1][d];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (this.comp[ni]) continue;
          if (this.moveCost(nx, ny, world, null) === Infinity) continue;
          this.comp[ni] = next;
          stack.push(ni);
        }
      }
    }
  }

  sameRegion(x1, y1, x2, y2) {
    if (!this.inb(x1, y1) || !this.inb(x2, y2)) return false;
    const a = this.comp[this.idx(x1, y1)], b = this.comp[this.idx(x2, y2)];
    return a !== 0 && a === b;
  }

  // A* pathfinding, 8-directional, no corner cutting.
  path(sx, sy, tx, ty, world, opts) {
    if (!this.inb(tx, ty)) return null;
    const { w, h } = this;
    const start = this.idx(sx, sy), goal = this.idx(tx, ty);
    if (start === goal) return [];
    // fast unreachability check for ordinary (non-wall-bashing) movement
    if (!(opts && (opts.hostile || opts.digging))) {
      const ca = this.comp[start], cb = this.comp[goal];
      if (cb === 0) return null;                       // goal tile itself is blocked
      if (ca !== 0 && ca !== cb) return null;          // different walkable islands
    }
    const g = this._g, closed = this._closed, from = this._from;
    g.fill(Infinity); closed.fill(0);
    g[start] = 0;
    // binary heap of [f, idx]
    const heap = [[U.dist(sx, sy, tx, ty), start]];
    const push = (f, i) => {
      heap.push([f, i]);
      let c = heap.length - 1;
      while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; }
    };
    const pop = () => {
      const topEl = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          let m = c; const l = 2 * c + 1, r = l + 1;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]]; c = m;
        }
      }
      return topEl;
    };
    const maxExpand = (opts && opts.maxExpand) || 5000;
    let expanded = 0;
    while (heap.length) {
      const [, cur] = pop();
      if (cur === goal) {
        const out = [];
        let i = cur;
        while (i !== start) { out.push({ x: i % w, y: Math.floor(i / w) }); i = from[i]; }
        out.reverse();
        return out;
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (++expanded > maxExpand) return null;
      const cx = cur % w, cy = Math.floor(cur / w);
      for (let d = 0; d < 8; d++) {
        const dx = [1, -1, 0, 0, 1, 1, -1, -1][d], dy = [0, 0, 1, -1, 1, -1, 1, -1][d];
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (closed[ni]) continue;
        const stepCost = this.moveCost(nx, ny, world, opts);
        if (stepCost === Infinity) continue;
        if (dx !== 0 && dy !== 0) { // no diagonal corner cutting
          if (this.moveCost(cx + dx, cy, world, opts) === Infinity) continue;
          if (this.moveCost(cx, cy + dy, world, opts) === Infinity) continue;
        }
        const nc = g[cur] + stepCost * (dx && dy ? 1.41 : 1);
        if (nc < g[ni]) {
          g[ni] = nc; from[ni] = cur;
          push(nc + U.dist(nx, ny, tx, ty), ni);
        }
      }
    }
    return null;
  }

  hasLOS(x1, y1, x2, y2, world) {
    let x = Math.round(x1), y = Math.round(y1);
    const ex = Math.round(x2), ey = Math.round(y2);
    const dx = Math.abs(ex - x), dy = Math.abs(ey - y);
    const sx = x < ex ? 1 : -1, sy = y < ey ? 1 : -1;
    let err = dx - dy;
    for (let steps = 0; steps < 200; steps++) {
      if (x === ex && y === ey) return true;
      if (!(x === Math.round(x1) && y === Math.round(y1))) {
        const i = this.idx(x, y);
        if (this.rock[i]) return false;
        const bid = this.bIdx[i];
        if (bid) {
          const b = world.byId[bid];
          if (b && !b.blueprint && BUILDINGS[b.key].block) return false;
          if (b && !b.blueprint && BUILDINGS[b.key].door && !b.open) return false;
        }
      }
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return false;
  }

  coverAt(x, y, world) {
    // Cover from sandbags/trees adjacent to the defender.
    let best = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!this.inb(x + dx, y + dy)) continue;
      const i = this.idx(x + dx, y + dy);
      const bid = this.bIdx[i];
      if (bid) {
        const b = world.byId[bid];
        if (b && !b.blueprint && BUILDINGS[b.key].cover) best = Math.max(best, BUILDINGS[b.key].cover);
      }
      const p = this.plantG[i];
      if (p && PLANTS[p.kind].tree) best = Math.max(best, 0.25);
    }
    return best;
  }

  // Flood-fill room detection. Outside = connected to map edge through non-blocking tiles.
  recomputeRooms(world) {
    const { w, h } = this;
    const n = w * h;
    this.roomId.fill(0);
    const isWallAt = (i) => {
      if (this.rock[i]) return true;
      const bid = this.bIdx[i];
      if (bid) {
        const b = world.byId[bid];
        if (b && !b.blueprint) {
          const def = BUILDINGS[b.key];
          if (def.block || def.door) return true; // doors bound rooms
        }
      }
      return false;
    };
    const queue = [];
    // Mark outside from edges
    for (let x = 0; x < w; x++) { queue.push(this.idx(x, 0), this.idx(x, h - 1)); }
    for (let y = 0; y < h; y++) { queue.push(this.idx(0, y), this.idx(w - 1, y)); }
    for (const i of queue) if (!isWallAt(i)) this.roomId[i] = -1;
    let qi = 0;
    const outQ = queue.filter(i => this.roomId[i] === -1);
    while (qi < outQ.length) {
      const cur = outQ[qi++];
      const cx = cur % w, cy = Math.floor(cur / w);
      for (let d = 0; d < 4; d++) {
        const nx = cx + [1, -1, 0, 0][d], ny = cy + [0, 0, 1, -1][d];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (this.roomId[ni] !== 0) continue;
        if (isWallAt(ni)) continue;
        this.roomId[ni] = -1;
        outQ.push(ni);
      }
    }
    // Remaining unmarked non-wall tiles form rooms
    this.rooms = [null];
    for (let i = 0; i < n; i++) {
      if (this.roomId[i] !== 0 || isWallAt(i)) continue;
      const rid = this.rooms.length;
      const tiles = [i];
      this.roomId[i] = rid;
      let ti = 0;
      while (ti < tiles.length) {
        const cur = tiles[ti++];
        const cx = cur % w, cy = Math.floor(cur / w);
        for (let d = 0; d < 4; d++) {
          const nx = cx + [1, -1, 0, 0][d], ny = cy + [0, 0, 1, -1][d];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (this.roomId[ni] !== 0 || isWallAt(ni)) continue;
          this.roomId[ni] = rid;
          tiles.push(ni);
        }
      }
      const room = { id: rid, tiles, indoor: tiles.length <= 220, kind: null, beauty: 0, temp: null, heat: 0 };
      this.rooms.push(room);
    }
    // Classify rooms by furniture; compute beauty
    for (let r = 1; r < this.rooms.length; r++) {
      const room = this.rooms[r];
      let beds = 0, cribs = 0, stove = 0, research = 0, bench = 0, tables = 0, rec = 0, graves = 0, beauty = 0, filth = 0, heat = 0;
      for (const i of room.tiles) {
        filth += this.filth[i];
        if (this.floor[i]) beauty += 0.15;
        const bid = this.bIdx[i];
        if (!bid) continue;
        const b = world.byId[bid];
        if (!b || b.blueprint) continue;
        const def = BUILDINGS[b.key];
        if (def.bed && !def.crib) beds++;
        if (def.crib) cribs++;
        if (def.cook) stove++;
        if (def.research) research++;
        if (def.bench) bench++;
        if (def.table) tables++;
        if (def.rec) rec++;
        if (def.grave) graves++;
        if (def.beauty) beauty += def.beauty * (b.quality || 1);
        if (def.heat && b.lit) heat += def.heat;
      }
      room.beauty = beauty - filth / 40;
      room.heat = heat;
      room.kind = !room.indoor ? 'yard'
        : cribs && beds ? 'family room' : beds > 2 ? 'barracks' : beds ? 'bedroom'
        : stove ? 'kitchen' : research ? 'study' : bench ? 'workshop'
        : rec ? 'rec room' : tables ? 'hall' : graves ? 'crypt' : 'room';
    }
    this.recomputeComponents(world);
    this.roomsDirty = false;
  }

  roomAt(x, y) {
    if (!this.inb(x, y)) return null;
    const rid = this.roomId[this.idx(x, y)];
    return rid > 0 ? this.rooms[rid] : null;
  }

  indoorsAt(x, y) {
    const r = this.roomAt(x, y);
    return !!(r && r.indoor);
  }

  // Spiral search for a tile passing pred(x, y).
  findSpotNear(x0, y0, maxR, pred) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    if (this.inb(x0, y0) && pred(x0, y0)) return { x: x0, y: y0 };
    for (let r = 1; r <= maxR; r++) {
      for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) {
        const x = x0 + dx, y = y0 + dy;
        if (this.inb(x, y) && pred(x, y)) return { x, y };
      }
      for (let dy = -r + 1; dy <= r - 1; dy++) for (const dx of [-r, r]) {
        const x = x0 + dx, y = y0 + dy;
        if (this.inb(x, y) && pred(x, y)) return { x, y };
      }
    }
    return null;
  }

  standable(x, y, world) {
    if (!this.inb(x, y)) return false;
    return this.moveCost(x, y, world, null) !== Infinity;
  }

  randomEdgeSpot(rng, world) {
    for (let tries = 0; tries < 300; tries++) {
      const side = rng.ri(0, 3);
      let x, y;
      if (side === 0) { x = rng.ri(1, this.w - 2); y = 1; }
      else if (side === 1) { x = rng.ri(1, this.w - 2); y = this.h - 2; }
      else if (side === 2) { x = 1; y = rng.ri(1, this.h - 2); }
      else { x = this.w - 2; y = rng.ri(1, this.h - 2); }
      if (this.standable(x, y, world)) return { x, y, side };
    }
    return { x: 1, y: 1, side: 2 };
  }

  addFilth(x, y, amt) {
    if (!this.inb(x, y)) return;
    const i = this.idx(x, y);
    this.filth[i] = Math.min(250, this.filth[i] + amt);
  }
}

Object.assign(globalThis, { TERR, TERR_COST, GameMap });
