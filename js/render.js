// render.js — canvas presentation: terrain, buildings, pawns, weather, night,
// fires, combat fx — plus the cinematic director camera that decides what the
// viewer is looking at, and why.

const TERR_COLORS = {
  temperate: { 0: '#3f6f86', 1: '#5d7d62', 2: '#c9bd8f', 3: '#8a9a58', 4: '#6f9048', 5: '#96906c', 6: '#8d8d88' },
  boreal: { 0: '#3a6478', 1: '#57755f', 2: '#bdb389', 3: '#7c9055', 4: '#61854a', 5: '#8e8a6c', 6: '#88898a' },
  arid: { 0: '#4a7a85', 1: '#7d8560', 2: '#d3c391', 3: '#a5a061', 4: '#8b9455', 5: '#b0a273', 6: '#98917d' },
};
const SEASON_TINT = { Spring: [0, 0, 0, 0], Summer: [30, 22, -12, 0.10], Fall: [58, 26, -30, 0.16], Winter: [46, 52, 66, 0.38] };
const WEAPON_COLORS = { melee: '#b9bec4', ranged: '#6d5b3f' };

const Renderer = {
  ready: false,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 48, y: 48, zoom: 9, tx: 48, ty: 48, tzoom: 9 };
    this.manualUntil = 0;
    this.interests = [];
    this.caption = null;
    this.cine = null;         // {text, until}
    this.banners = [];
    this.particles = [];
    this.terrainCache = null;
    this.terrainCacheAt = -1;
    this.selectedId = null;
    this.followId = null;
    this.suggestedSpeed = 1;
    this.lastFxHandled = 0;
    this.shake = 0;
    this.ready = true;
  },

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = Math.floor(rect.width * devicePixelRatio);
    this.canvas.height = Math.floor(rect.height * devicePixelRatio);
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
  },

  // ---- director hooks (called from sim code; safe when headless) -----------
  focus(world, x, y, pri, caption) {
    if (!this.ready) return;
    this.interests.push({ x, y, pri: pri || 3, caption, until: world.t + 70 });
  },

  cinematic(world, text, at, pri) {
    if (!this.ready) return;
    this.interests.push({ x: at.x, y: at.y, pri: (pri || 8) + 2, caption: text, until: world.t + 90 });
    this.cine = { text, untilReal: performance.now() + 5200 };
    this.shake = Math.min(6, (pri || 8) * 0.5);
  },

  // ---- camera --------------------------------------------------------------
  updateCamera(world, dt) {
    const cam = this.cam;
    this.interests = this.interests.filter(i => i.until > world.t);
    const manual = performance.now() < this.manualUntil;
    let speedWish = 2; // calm default

    if (!manual) {
      let target = null;
      if (this.followId) {
        const p = world.byId[this.followId];
        if (p && !p.dead && !p.gone) target = { x: p.x, y: p.y, pri: 5, zoom: 13 };
        else this.followId = null;
      }
      if (!target && this.interests.length) {
        const best = this.interests.reduce((a, b) => (b.pri > a.pri ? b : a));
        target = { x: best.x, y: best.y, pri: best.pri, zoom: best.pri >= 7 ? 12 : 10.5 };
        this.caption = best.caption || this.caption;
        speedWish = best.pri >= 7 ? 0.5 : 1;
      }
      if (!target) {
        // idle: drift after a working colonist, or hover the base
        this.caption = null;
        if (!this.idleTargetId || world.rng.chance(0.002) || !world.byId[this.idleTargetId] || world.byId[this.idleTargetId].dead) {
          const workers = world.pawns.filter(p => p.isColonist() && !p.downed);
          this.idleTargetId = workers.length ? workers[Math.floor(Math.random() * workers.length)].id : null;
        }
        const p = this.idleTargetId ? world.byId[this.idleTargetId] : null;
        if (p && !p.dead) target = { x: p.x, y: p.y, pri: 1, zoom: 10 };
        else target = { x: world.map.home.x, y: world.map.home.y, pri: 0, zoom: 8.5 };
        // everyone asleep and nothing happening? fast-forward the night
        const anyoneAwake = world.pawns.some(p => p.isColonist() && (!p.job || p.job.type !== 'sleep') && !p.downed);
        if (!anyoneAwake && !world.threat) speedWish = 3;
      }
      if (target) { cam.tx = target.x; cam.ty = target.y; cam.tzoom = target.zoom || cam.tzoom; }
      if (world.threat) speedWish = Math.min(speedWish, 1);
      if (this.cine && performance.now() < this.cine.untilReal) speedWish = 0.5;
    } else {
      speedWish = null; // user is driving
    }
    this.suggestedSpeed = speedWish;

    const k = Math.min(1, dt * 3.2);
    cam.x += (cam.tx - cam.x) * k;
    cam.y += (cam.ty - cam.y) * k;
    cam.zoom += (cam.tzoom - cam.zoom) * Math.min(1, dt * 2.6);
    const halfW = this.canvas.width / devicePixelRatio / cam.zoom / 2;
    const halfH = this.canvas.height / devicePixelRatio / cam.zoom / 2;
    cam.x = U.clamp(cam.x, halfW - 4, world.map.w - halfW + 4);
    cam.y = U.clamp(cam.y, halfH - 4, world.map.h - halfH + 4);
  },

  worldToScreen(x, y) {
    const cam = this.cam, c = this.canvas;
    return {
      x: (x - cam.x) * cam.zoom + c.width / devicePixelRatio / 2,
      y: (y - cam.y) * cam.zoom + c.height / devicePixelRatio / 2,
    };
  },

  screenToWorld(sx, sy) {
    const cam = this.cam, c = this.canvas;
    return {
      x: (sx - c.width / devicePixelRatio / 2) / cam.zoom + cam.x,
      y: (sy - c.height / devicePixelRatio / 2) / cam.zoom + cam.y,
    };
  },

  // ---- terrain cache -------------------------------------------------------
  rebuildTerrain(world) {
    const map = world.map;
    const px = 4; // cache resolution per tile
    if (!this.terrainCache) {
      this.terrainCache = document.createElement('canvas');
      this.terrainCache.width = map.w * px;
      this.terrainCache.height = map.h * px;
    }
    const tc = this.terrainCache.getContext('2d');
    const pal = TERR_COLORS[world.biome] || TERR_COLORS.temperate;
    const tint = SEASON_TINT[world.season];
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const i = map.idx(x, y);
        let col;
        if (map.rock[i]) col = map.ore[i] === 1 ? '#7a8695' : map.ore[i] === 2 ? '#a8905a' : '#6d6d70';
        else col = pal[map.terr[i]];
        tc.fillStyle = col;
        tc.fillRect(x * px, y * px, px, px);
        if (map.floor[i]) {
          tc.fillStyle = map.floor[i] === 1 ? '#8a6a44' : '#9a978c';
          tc.fillRect(x * px, y * px, px, px);
        }
        // subtle texture
        if (((x * 7 + y * 13) % 5) === 0 && !map.rock[i] && !map.floor[i]) {
          tc.fillStyle = 'rgba(0,0,0,0.05)';
          tc.fillRect(x * px, y * px, px, px);
        }
      }
    }
    // farm zone tinting
    tc.fillStyle = 'rgba(70,44,22,0.30)';
    for (const farm of world.zones.farms) tc.fillRect(farm.x * px, farm.y * px, farm.w * px, farm.h * px);
    tc.fillStyle = 'rgba(220,205,150,0.12)';
    for (const idx of world.zones.stock) {
      const x = idx % map.w, y = Math.floor(idx / map.w);
      tc.fillRect(x * px, y * px, px, px);
    }
    // seasonal wash
    if (tint[3] > 0) {
      tc.fillStyle = `rgba(${tint[0] + 100},${tint[1] + 100},${tint[2] + 100},${tint[3]})`;
      tc.fillRect(0, 0, this.terrainCache.width, this.terrainCache.height);
    }
    this.terrainCacheAt = world.t;
    this.terrainSeason = world.season;
  },

  // ---- main draw -----------------------------------------------------------
  draw(world, dtMs) {
    if (!this.ready) return;
    const dt = Math.min(0.1, dtMs / 1000);
    const ctx = this.ctx;
    const cam = this.cam;
    this.updateCamera(world, dt);
    if (!this.terrainCache || world.t - this.terrainCacheAt > 900 || this.terrainSeason !== world.season) this.rebuildTerrain(world);

    ctx.save();
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const vw = this.canvas.width / devicePixelRatio, vh = this.canvas.height / devicePixelRatio;
    ctx.fillStyle = '#1a1d24';
    ctx.fillRect(0, 0, vw, vh);

    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake *= 0.9;
    }

    // terrain
    const px = 4;
    const topLeft = this.screenToWorld(0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.terrainCache,
      0, 0, this.terrainCache.width, this.terrainCache.height,
      (0 - cam.x) * cam.zoom + vw / 2, (0 - cam.y) * cam.zoom + vh / 2,
      world.map.w * cam.zoom, world.map.h * cam.zoom);

    const z = cam.zoom;
    const t2s = (x, y) => ({ x: (x - cam.x) * z + vw / 2, y: (y - cam.y) * z + vh / 2 });
    const x0 = Math.max(0, Math.floor(topLeft.x) - 1), y0 = Math.max(0, Math.floor(topLeft.y) - 1);
    const x1 = Math.min(world.map.w - 1, Math.ceil(this.screenToWorld(vw, vh).x) + 1);
    const y1 = Math.min(world.map.h - 1, Math.ceil(this.screenToWorld(vw, vh).y) + 1);
    const map = world.map;
    const time = performance.now() / 1000;

    // water shimmer + filth + plants
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const i = map.idx(tx, ty);
        const s = t2s(tx, ty);
        if (map.terr[i] === TERR.WATER && ((tx * 3 + ty * 7 + Math.floor(time * 2)) % 9) === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          ctx.fillRect(s.x + z * 0.2, s.y + z * 0.45, z * 0.55, z * 0.1);
        }
        if (map.filth[i] > 25) {
          ctx.fillStyle = `rgba(96,26,26,${Math.min(0.5, map.filth[i] / 350)})`;
          ctx.beginPath(); ctx.arc(s.x + z / 2, s.y + z / 2, z * 0.3, 0, 7); ctx.fill();
        }
        const pl = map.plantG[i];
        if (pl) this.drawPlant(ctx, pl, s, z, world);
      }
    }

    // items
    for (const st of world.items) {
      if (st.carried || st.x < x0 || st.x > x1 || st.y < y0 || st.y > y1) continue;
      const s = t2s(st.x, st.y);
      if (st.kind === 'corpse') { this.drawCorpse(ctx, st, s, z); continue; }
      this.drawItem(ctx, st, s, z);
    }

    // buildings
    for (const b of world.buildings) {
      if (b.x < x0 - 1 || b.x > x1 + 1 || b.y < y0 - 1 || b.y > y1 + 1) continue;
      this.drawBuilding(ctx, world, b, t2s(b.x, b.y), z, time);
    }

    // animals
    for (const a of world.animals) {
      if (a.dead || a.x < x0 || a.x > x1 || a.y < y0 || a.y > y1) continue;
      this.drawAnimal(ctx, world, a, t2s, z, dt);
    }

    // pawns
    for (const p of world.pawns) {
      if (p.dead || p.gone) continue;
      if (p.x < x0 - 1 || p.x > x1 + 1 || p.y < y0 - 1 || p.y > y1 + 1) continue;
      this.drawPawn(ctx, world, p, t2s, z, dt);
    }

    // fire
    if (world.fireCount) {
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const f = map.fireG[map.idx(tx, ty)];
        if (!f) continue;
        const s = t2s(tx, ty);
        const flick = Math.sin(time * 11 + tx * 3 + ty * 7) * 0.2 + 0.8;
        ctx.fillStyle = `rgba(255,${120 + Math.floor(70 * flick)},20,${Math.min(0.85, f / 130)})`;
        ctx.beginPath();
        ctx.moveTo(s.x + z * 0.2, s.y + z * 0.9);
        ctx.lineTo(s.x + z * 0.5, s.y + z * (0.15 + 0.2 * flick));
        ctx.lineTo(s.x + z * 0.8, s.y + z * 0.9);
        ctx.fill();
      }
    }

    // transient fx
    this.drawFx(world, ctx, t2s, z);

    // night / eclipse overlay with light sources
    this.drawLighting(world, ctx, t2s, z, vw, vh);

    // weather particles
    this.drawWeather(world, ctx, vw, vh, dt);

    // aurora
    if (world.t < world.auroraUntil && world.isNight) {
      const g = ctx.createLinearGradient(0, 0, vw, vh * 0.5);
      g.addColorStop(0, 'rgba(60,255,160,0.10)');
      g.addColorStop(0.5, `rgba(120,80,255,${0.06 + 0.05 * Math.sin(time * 0.7)})`);
      g.addColorStop(1, 'rgba(60,255,190,0.08)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
    }

    // selection ring
    const sel = this.selectedId ? world.byId[this.selectedId] : null;
    if (sel && !sel.dead && !sel.gone) {
      const s = t2s(sel.x + 0.5, sel.y + 0.62);
      ctx.strokeStyle = 'rgba(255,235,170,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, z * 0.5, z * 0.24, 0, 0, 7); ctx.stroke();
    }

    // cinematic letterbox & caption
    if (this.cine && performance.now() < this.cine.untilReal) {
      const barH = Math.min(52, vh * 0.09);
      ctx.fillStyle = 'rgba(8,8,10,0.85)';
      ctx.fillRect(0, 0, vw, barH);
      ctx.fillRect(0, vh - barH, vw, barH);
      ctx.fillStyle = '#e8ddc4';
      ctx.font = `600 15px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText(this.cine.text, vw / 2, vh - barH / 2 + 5, vw - 40);
    } else if (this.caption) {
      ctx.font = `13px Georgia, serif`;
      const tw = ctx.measureText(this.caption).width;
      ctx.fillStyle = 'rgba(10,10,14,0.72)';
      ctx.fillRect(vw / 2 - tw / 2 - 12, vh - 34, tw + 24, 24);
      ctx.fillStyle = '#d8cfae';
      ctx.textAlign = 'center';
      ctx.fillText(this.caption, vw / 2, vh - 18);
    }
    ctx.restore();
  },

  // ---- pieces --------------------------------------------------------------
  drawPlant(ctx, pl, s, z, world) {
    const def = PLANTS[pl.kind];
    const g = pl.growth;
    if (def.tree) {
      const h = z * (0.5 + g * 0.75);
      const winter = world.season === 'Winter';
      ctx.fillStyle = '#5b4327';
      ctx.fillRect(s.x + z * 0.44, s.y + z * 0.55, z * 0.14, z * 0.4);
      ctx.fillStyle = winter ? (pl.kind === 'pine' ? '#3d5a44' : '#6b6257')
        : world.season === 'Fall' && pl.kind !== 'pine' ? '#b0762e'
        : pl.kind === 'pine' ? '#33553c' : pl.kind === 'oak' ? '#44683a' : '#5d7b3e';
      ctx.beginPath();
      if (pl.kind === 'pine') {
        ctx.moveTo(s.x + z * 0.5, s.y + z * 0.85 - h);
        ctx.lineTo(s.x + z * 0.18, s.y + z * 0.72);
        ctx.lineTo(s.x + z * 0.82, s.y + z * 0.72);
      } else {
        ctx.arc(s.x + z * 0.5, s.y + z * 0.72 - h * 0.55, h * 0.48, 0, 7);
      }
      ctx.fill();
    } else if (pl.kind === 'bush') {
      ctx.fillStyle = '#3f6134';
      ctx.beginPath(); ctx.arc(s.x + z * 0.5, s.y + z * 0.62, z * 0.3 * (0.5 + g / 2), 0, 7); ctx.fill();
      if (g >= 0.85) {
        ctx.fillStyle = '#7b3d8e';
        for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(s.x + z * (0.35 + k * 0.15), s.y + z * (0.55 + (k % 2) * 0.12), z * 0.05, 0, 7); ctx.fill(); }
      }
    } else if (pl.kind === 'flowers') {
      ctx.fillStyle = ['#c86fa2', '#d8c65e', '#8f7fd8'][pl.i % 3];
      ctx.beginPath(); ctx.arc(s.x + z * 0.5, s.y + z * 0.5, z * 0.12, 0, 7); ctx.fill();
    } else if (def.crop) {
      const rows = pl.kind === 'corn' ? 2 : 3;
      ctx.fillStyle = g >= 1 ? '#c9b458' : `rgba(90,${120 + g * 60},52,0.9)`;
      for (let k = 0; k < rows; k++) {
        ctx.fillRect(s.x + z * (0.2 + k * 0.25), s.y + z * (0.85 - g * 0.5), z * 0.1, z * g * 0.5);
      }
    } else { // grass, wild healroot
      ctx.fillStyle = pl.kind === 'healrootW' ? 'rgba(120,160,90,0.8)' : 'rgba(110,140,70,0.5)';
      ctx.fillRect(s.x + z * 0.3, s.y + z * 0.6, z * 0.08, z * 0.25);
      ctx.fillRect(s.x + z * 0.55, s.y + z * 0.55, z * 0.08, z * 0.3);
    }
  },

  drawItem(ctx, st, s, z) {
    const colors = {
      wood: '#9a7645', stone: '#9a9a96', chunk: '#7f7f7c', steel: '#9fb2c2', gold: '#e0b64f', silver: '#cfd6dd',
      cloth: '#c8cdb0', leather: '#a4713f', herbal: '#7fae6a', medkit: '#e0e5e8', berries: '#8e4a9e',
      rawVeg: '#a9c069', rawMeat: '#c05555', mealSimple: '#d9c9a0', mealFine: '#e5d3a8', mealPack: '#b8c5b0',
      hops: '#94a84e', beer: '#c9932e', weaponItem: '#8a8f96', apparelItem: '#b0a58a',
    };
    ctx.fillStyle = colors[st.kind] || '#bbb';
    const n = Math.min(3, 1 + Math.floor(st.qty / 30));
    for (let k = 0; k < n; k++) {
      ctx.fillRect(s.x + z * (0.22 + k * 0.13), s.y + z * (0.42 - k * 0.1), z * 0.5, z * 0.34);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.6;
      ctx.strokeRect(s.x + z * (0.22 + k * 0.13), s.y + z * (0.42 - k * 0.1), z * 0.5, z * 0.34);
    }
  },

  drawCorpse(ctx, st, s, z) {
    ctx.save();
    ctx.translate(s.x + z / 2, s.y + z / 2);
    ctx.rotate(1.35);
    ctx.fillStyle = st.meta.rotten ? '#5f6b52' : st.meta.animal ? '#8a6248' : '#b5a289';
    ctx.beginPath(); ctx.ellipse(0, 0, z * 0.34, z * 0.18, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(z * 0.32, 0, z * 0.13, 0, 7); ctx.fill();
    ctx.restore();
  },

  drawBuilding(ctx, world, b, s, z, time) {
    const def = BUILDINGS[b.key];
    if (b.blueprint) {
      ctx.strokeStyle = 'rgba(140,190,255,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x + 1, s.y + 1, z - 2, z - 2);
      if (b.work > 0) {
        ctx.fillStyle = 'rgba(140,190,255,0.25)';
        ctx.fillRect(s.x + 1, s.y + 1 + (z - 2) * (1 - b.work / def.wk), z - 2, (z - 2) * (b.work / def.wk));
      }
      return;
    }
    switch (b.key) {
      case 'wallWood': case 'wallStone': {
        ctx.fillStyle = b.key === 'wallWood' ? '#6e5233' : '#75757a';
        ctx.fillRect(s.x, s.y, z, z);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(s.x, s.y, z, z * 0.25);
        break;
      }
      case 'doorWood': case 'doorStone': {
        ctx.fillStyle = b.key === 'doorWood' ? '#4e3a24' : '#5a5a60';
        ctx.fillRect(s.x, s.y, z, z);
        // open if someone stands near
        const open = world.pawns.some(p => !p.dead && Math.abs(p.x - b.x) <= 1 && Math.abs(p.y - b.y) <= 1);
        ctx.fillStyle = open ? 'rgba(20,20,26,0.8)' : '#7d6034';
        ctx.fillRect(s.x + z * 0.2, s.y + z * 0.12, z * 0.6, z * 0.76);
        break;
      }
      case 'bed': case 'doubleBed': case 'bedroll': case 'crib': {
        const wide = def.double;
        ctx.fillStyle = b.key === 'bedroll' ? '#8c7b52' : '#7b5a36';
        ctx.fillRect(s.x + z * 0.08, s.y + z * 0.08, z * (wide ? 0.86 : 0.84), z * 0.84);
        ctx.fillStyle = b.prison ? '#c9a960' : '#d8d3c2';
        ctx.fillRect(s.x + z * 0.14, s.y + z * 0.12, z * (wide ? 0.72 : 0.7), z * 0.26);
        if (def.crib) { ctx.strokeStyle = '#5f4426'; ctx.lineWidth = 1; ctx.strokeRect(s.x + z * 0.08, s.y + z * 0.08, z * 0.84, z * 0.84); }
        break;
      }
      case 'table': case 'gameTable': {
        ctx.fillStyle = '#8b6a41';
        ctx.fillRect(s.x + z * 0.08, s.y + z * 0.15, z * 0.84, z * 0.7);
        if (b.key === 'gameTable') {
          ctx.fillStyle = '#3c3c40'; ctx.fillRect(s.x + z * 0.3, s.y + z * 0.35, z * 0.18, z * 0.18);
          ctx.fillStyle = '#d8d8d0'; ctx.fillRect(s.x + z * 0.5, s.y + z * 0.5, z * 0.18, z * 0.18);
        }
        break;
      }
      case 'stool': { ctx.fillStyle = '#7d5f3b'; ctx.beginPath(); ctx.arc(s.x + z / 2, s.y + z / 2, z * 0.22, 0, 7); ctx.fill(); break; }
      case 'campfire': case 'hearth': case 'torch': {
        if (b.key === 'hearth') { ctx.fillStyle = '#6a6a6e'; ctx.fillRect(s.x + z * 0.08, s.y + z * 0.2, z * 0.84, z * 0.7); }
        else { ctx.fillStyle = '#54402a'; ctx.beginPath(); ctx.arc(s.x + z / 2, s.y + z * 0.65, z * 0.3, 0, 7); ctx.fill(); }
        if (b.lit) {
          const flick = Math.sin(time * 9 + b.id) * 0.2 + 0.8;
          ctx.fillStyle = `rgba(255,${140 + 60 * flick},30,0.95)`;
          ctx.beginPath();
          ctx.moveTo(s.x + z * 0.32, s.y + z * 0.68);
          ctx.lineTo(s.x + z * 0.5, s.y + z * (0.2 + 0.12 * flick));
          ctx.lineTo(s.x + z * 0.68, s.y + z * 0.68);
          ctx.fill();
        }
        break;
      }
      case 'stove': {
        ctx.fillStyle = '#3f3f45'; ctx.fillRect(s.x + z * 0.06, s.y + z * 0.1, z * 0.88, z * 0.8);
        if (b.working && world.t - b.working < 5) { ctx.fillStyle = '#ff9930'; ctx.fillRect(s.x + z * 0.3, s.y + z * 0.35, z * 0.4, z * 0.3); }
        break;
      }
      case 'butcher': { ctx.fillStyle = '#79553a'; ctx.fillRect(s.x + z * 0.1, s.y + z * 0.2, z * 0.8, z * 0.6); ctx.fillStyle = '#a03e3e'; ctx.fillRect(s.x + z * 0.2, s.y + z * 0.32, z * 0.3, z * 0.2); break; }
      case 'researchDesk': {
        ctx.fillStyle = '#7c6448'; ctx.fillRect(s.x + z * 0.06, s.y + z * 0.2, z * 0.88, z * 0.6);
        ctx.fillStyle = '#d8d2b8'; ctx.fillRect(s.x + z * 0.2, s.y + z * 0.32, z * 0.32, z * 0.24);
        break;
      }
      case 'workbench': case 'tailorBench': case 'artBench': case 'brewery': case 'craftSpot': {
        ctx.fillStyle = { workbench: '#6f6a5a', tailorBench: '#7d6a5e', artBench: '#6a6f7d', brewery: '#7a5c33', craftSpot: '#68604e' }[b.key];
        ctx.fillRect(s.x + z * 0.06, s.y + z * 0.18, z * 0.88, z * 0.64);
        if (b.working && world.t - b.working < 5) { ctx.fillStyle = 'rgba(255,230,150,0.5)'; ctx.fillRect(s.x + z * 0.3, s.y + z * 0.3, z * 0.4, z * 0.3); }
        break;
      }
      case 'sandbag': {
        ctx.fillStyle = '#8f8258';
        ctx.fillRect(s.x + z * 0.05, s.y + z * 0.35, z * 0.9, z * 0.45);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.7;
        ctx.strokeRect(s.x + z * 0.05, s.y + z * 0.35, z * 0.44, z * 0.45);
        break;
      }
      case 'grave': {
        ctx.fillStyle = '#6d6154';
        ctx.beginPath(); ctx.ellipse(s.x + z / 2, s.y + z * 0.62, z * 0.34, z * 0.2, 0, 0, 7); ctx.fill();
        if (b.meta && b.meta.occupant) { ctx.fillStyle = '#9d9d98'; ctx.fillRect(s.x + z * 0.4, s.y + z * 0.1, z * 0.2, z * 0.4); }
        break;
      }
      case 'sculpture': {
        ctx.fillStyle = '#a9a9ad';
        ctx.fillRect(s.x + z * 0.3, s.y + z * 0.15, z * 0.4, z * 0.7);
        ctx.fillStyle = '#8e8e94';
        ctx.beginPath(); ctx.arc(s.x + z / 2, s.y + z * 0.22, z * 0.18, 0, 7); ctx.fill();
        break;
      }
      case 'horseshoes': { ctx.fillStyle = '#9c9ca2'; ctx.beginPath(); ctx.arc(s.x + z / 2, s.y + z / 2, z * 0.14, 0.5, 5.7); ctx.lineWidth = 2; ctx.strokeStyle = '#9c9ca2'; ctx.stroke(); break; }
      case 'petBed': { ctx.fillStyle = '#7a6a4e'; ctx.beginPath(); ctx.ellipse(s.x + z / 2, s.y + z / 2, z * 0.4, z * 0.3, 0, 0, 7); ctx.fill(); break; }
      case 'flowerbed': {
        ctx.fillStyle = '#4c3a26'; ctx.fillRect(s.x + z * 0.1, s.y + z * 0.1, z * 0.8, z * 0.8);
        for (let k = 0; k < 3; k++) { ctx.fillStyle = ['#c86fa2', '#d8c65e', '#e08f5f'][k]; ctx.beginPath(); ctx.arc(s.x + z * (0.28 + k * 0.22), s.y + z * (0.35 + (k % 2) * 0.3), z * 0.08, 0, 7); ctx.fill(); }
        break;
      }
      default: {
        ctx.fillStyle = '#888';
        ctx.fillRect(s.x + z * 0.15, s.y + z * 0.15, z * 0.7, z * 0.7);
      }
    }
  },

  ensureDrawPos(e, dt) {
    if (e.dx == null) { e.dx = e.x; e.dy = e.y; }
    const k = Math.min(1, dt * 7);
    e.dx += (e.x - e.dx) * k;
    e.dy += (e.y - e.dy) * k;
  },

  drawPawn(ctx, world, p, t2s, z, dt) {
    this.ensureDrawPos(p, dt);
    const s = t2s(p.dx + 0.5, p.dy + 0.5);
    const stage = p.stage(world);
    const scale = stage === 'baby' ? 0.45 : stage === 'toddler' ? 0.55 : stage === 'child' ? 0.75 : 1;
    const r = z * 0.34 * scale;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (p.downed || (p.job && p.job.type === 'sleep' && p.job.sleeping) || (p.job && p.job.type === 'patient')) ctx.rotate(1.45);
    // body
    const hostile = p.faction === 'pirate' || p.faction === 'tribe';
    const outfit = p.prisoner ? '#c9a13f'
      : hostile ? (p.faction === 'pirate' ? '#7d3b3b' : '#7d6136')
      : p.faction === 'outlander' ? '#4e6e7d'
      : { rags: '#8d8168', clothes: '#5e7161', coat: '#7a5c3a', parka: '#6e7d92', flak: '#5a5f52' }[p.apparel] || '#5e7161';
    ctx.fillStyle = outfit;
    ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 0.78, r * 0.95, 0, 0, 7); ctx.fill();
    // head
    ctx.fillStyle = SKIN_TONES[p.skin];
    ctx.beginPath(); ctx.arc(0, -r * 0.55, r * 0.62, 0, 7); ctx.fill();
    // hair
    ctx.fillStyle = HAIR_COLORS[p.hair.color];
    ctx.beginPath();
    const hs = p.hair.style;
    if (hs === 0) ctx.arc(0, -r * 0.68, r * 0.58, Math.PI, 0);
    else if (hs === 1) { ctx.arc(0, -r * 0.62, r * 0.62, Math.PI * 0.95, Math.PI * 0.05); ctx.lineTo(r * 0.6, -r * 0.1); ctx.lineTo(-r * 0.6, -r * 0.1); }
    else if (hs === 2) ctx.arc(0, -r * 0.75, r * 0.45, Math.PI * 0.9, Math.PI * 0.1);
    else if (hs === 3) { ctx.arc(0, -r * 0.66, r * 0.6, Math.PI, 0); ctx.rect(-r * 0.62, -r * 0.66, r * 0.28, r * 0.9); }
    else ctx.arc(-r * 0.1, -r * 0.8, r * 0.34, 0, 7);
    ctx.fill();
    // weapon
    if (p.weapon && (p.mode === 'fight' || (p.job && ['hunt', 'combat', 'npc'].includes(p.job.type)) || hostile)) {
      const wd = WEAPONS[p.weapon];
      ctx.strokeStyle = wd && wd.melee ? '#c2c8ce' : '#4d4438';
      ctx.lineWidth = Math.max(1, z * 0.09);
      ctx.beginPath();
      ctx.moveTo(p.facing * r * 0.3, r * 0.2);
      ctx.lineTo(p.facing * r * (wd && wd.melee ? 1.15 : 1.35), -r * 0.25);
      ctx.stroke();
    }
    // carried goods
    if (p.carry) { ctx.fillStyle = '#c9b489'; ctx.fillRect(p.facing * r * 0.4 - r * 0.25, -r * 0.1, r * 0.5, r * 0.42); }
    ctx.restore();

    // status icons
    ctx.font = `${Math.max(8, z * 0.5)}px system-ui`;
    ctx.textAlign = 'center';
    if (p.job && p.job.type === 'sleep' && p.job.sleeping) ctx.fillText('💤', s.x + r, s.y - r * 1.4);
    else if (p.breaking) ctx.fillText('❗', s.x + r * 0.8, s.y - r * 1.5);
    else if (p.downed) ctx.fillText('🩸', s.x + r, s.y - r * 1.2);
    // health bar when hurt
    const hurt = p.injuries.length > 0 || p.blood < 0.95 || p.diseases.length;
    if (hurt && !p.dead) {
      const w = z * 0.9;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(s.x - w / 2, s.y - z * 0.85, w, 2);
      ctx.fillStyle = p.blood < 0.6 ? '#e04f42' : '#e0a53e';
      ctx.fillRect(s.x - w / 2, s.y - z * 0.85, w * U.clamp(p.blood * (1 - p.pain * 0.5), 0.05, 1), 2);
    }
    // name label
    if (z >= 8 && p.isColonist()) {
      ctx.font = `${Math.max(8, z * 0.42)}px system-ui`;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const nm = p.label();
      const tw = ctx.measureText(nm).width;
      ctx.fillRect(s.x - tw / 2 - 2, s.y + z * 0.55, tw + 4, z * 0.5);
      ctx.fillStyle = p.mood < p.breakThreshold('minor') ? '#f0b8a0' : '#e6e2d2';
      ctx.fillText(nm, s.x, s.y + z * 0.95);
    }
  },

  drawAnimal(ctx, world, a, t2s, z, dt) {
    this.ensureDrawPos(a, dt);
    const s = t2s(a.dx + 0.5, a.dy + 0.5);
    const def = a.def();
    const r = z * 0.3 * def.sz;
    const colors = {
      deer: '#a5794c', hare: '#b3a48c', boar: '#5d4a3a', turkey: '#6b4f3f', fox: '#c26838',
      wolf: '#8a8d94', bear: '#6d4a2f', cougar: '#b0885a', dog: '#96703f', cat: '#7d7d84', muffalo: '#7a4f35',
    };
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = colors[a.species] || '#997';
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.25, r * 0.75, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(r * 1.2, -r * 0.25, r * 0.5, 0, 7); ctx.fill();
    if (a.species === 'deer') { ctx.strokeStyle = '#6d5433'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r * 1.2, -r * 0.6); ctx.lineTo(r * 1.5, -r * 1.3); ctx.moveTo(r * 1.1, -r * 0.6); ctx.lineTo(r * 0.8, -r * 1.2); ctx.stroke(); }
    if (a.species === 'turkey') { ctx.fillStyle = '#8a6a52'; ctx.beginPath(); ctx.arc(-r * 1.1, -r * 0.3, r * 0.7, 0, 7); ctx.fill(); }
    if (a.manhunter) { ctx.fillStyle = '#ff5040'; ctx.beginPath(); ctx.arc(r * 1.35, -r * 0.45, r * 0.12, 0, 7); ctx.fill(); }
    ctx.restore();
    if (a.tame && a.name && z >= 9) {
      ctx.font = `${Math.max(7, z * 0.36)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(235,225,200,0.85)';
      ctx.fillText(a.name, s.x, s.y + z * 0.8);
    }
  },

  drawFx(world, ctx, t2s, z) {
    for (const fx of world.fx) {
      const age = world.t - fx.t;
      if (fx.kind === 'shot' && age < 3) {
        const a = t2s(fx.x1 + 0.5, fx.y1 + 0.5), b = t2s(fx.x2 + 0.5, fx.y2 + 0.5);
        ctx.strokeStyle = fx.hit ? 'rgba(255,220,120,0.85)' : 'rgba(220,220,220,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      } else if (fx.kind === 'melee' && age < 4) {
        const s = t2s(fx.x + 0.5, fx.y + 0.5);
        ctx.strokeStyle = 'rgba(255,240,200,0.7)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(s.x, s.y, z * 0.4 * (age / 4 + 0.4), -0.6, 1.2); ctx.stroke();
      } else if (fx.kind === 'heart' && age < 30) {
        const s = t2s(fx.x + 0.5, fx.y + 0.3 - age * 0.02);
        ctx.font = `${z * 0.5}px system-ui`; ctx.textAlign = 'center';
        ctx.globalAlpha = 1 - age / 30;
        ctx.fillText('❤️', s.x, s.y);
        ctx.globalAlpha = 1;
      } else if (fx.kind === 'bubble' && age < 24) {
        const s = t2s(fx.x + 0.9, fx.y - 0.2);
        ctx.font = `${z * 0.55}px system-ui`; ctx.textAlign = 'center';
        ctx.globalAlpha = Math.min(1, 2 - age / 12);
        ctx.fillText(fx.icon, s.x, s.y);
        ctx.globalAlpha = 1;
      } else if (fx.kind === 'pod' && age < 40) {
        const s = t2s(fx.x + 0.5, fx.y + 0.5);
        const drop = Math.max(0, 1 - age / 14);
        ctx.fillStyle = '#b8bcc2';
        ctx.beginPath(); ctx.ellipse(s.x, s.y - drop * 260, z * 0.42, z * 0.55, 0, 0, 7); ctx.fill();
        if (drop > 0) { ctx.strokeStyle = 'rgba(255,180,80,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x, s.y - drop * 260 - z); ctx.lineTo(s.x, s.y - drop * 260 - z * 2.4); ctx.stroke(); }
        if (age > 12 && age < 22) { ctx.fillStyle = `rgba(220,220,190,${(22 - age) / 10 * 0.5})`; ctx.beginPath(); ctx.arc(s.x, s.y, z * (age - 11) * 0.35, 0, 7); ctx.fill(); }
      } else if (fx.kind === 'lightning' && age < 3) {
        const s = t2s(fx.x + 0.5, fx.y + 0.5);
        ctx.strokeStyle = 'rgba(220,230,255,0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let yy = s.y - 400;
        ctx.moveTo(s.x + 20, yy);
        while (yy < s.y) { yy += 60; ctx.lineTo(s.x + (Math.random() - 0.5) * 30, Math.min(yy, s.y)); }
        ctx.stroke();
      }
    }
  },

  drawLighting(world, ctx, t2s, z, vw, vh) {
    let darkness = 0;
    const h = world.hourOfDay + (world.t % 60) / 60;
    if (h < 5) darkness = 0.62;
    else if (h < 7) darkness = 0.62 * (1 - (h - 5) / 2);
    else if (h >= 20 && h < 22) darkness = 0.62 * ((h - 20) / 2);
    else if (h >= 22) darkness = 0.62;
    if (world.t < world.eclipseUntil) darkness = Math.max(darkness, 0.5);
    if (world.weather === 'storm') darkness = Math.max(darkness, 0.25);
    if (darkness <= 0.02) return;
    ctx.fillStyle = `rgba(10,14,34,${darkness})`;
    ctx.fillRect(0, 0, vw, vh);
    // warm pools of light
    ctx.globalCompositeOperation = 'lighter';
    for (const b of world.buildings) {
      if (b.blueprint || !b.lit) continue;
      const def = BUILDINGS[b.key];
      if (!def.light) continue;
      const s = t2s(b.x + 0.5, b.y + 0.5);
      const rad = def.light * z;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
      g.addColorStop(0, `rgba(255,170,60,${0.28 * darkness})`);
      g.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, rad, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  },

  drawWeather(world, ctx, vw, vh, dt) {
    const snowing = (world.weather === 'rain' || world.weather === 'storm') && world.tempOut < 1;
    const raining = (world.weather === 'rain' || world.weather === 'storm') && !snowing;
    const wanted = raining ? 140 : snowing ? 110 : 0;
    while (this.particles.length < wanted) {
      this.particles.push({ x: Math.random() * vw, y: Math.random() * vh, v: 0.5 + Math.random() });
    }
    if (this.particles.length > wanted) this.particles.length = wanted;
    if (raining) {
      ctx.strokeStyle = 'rgba(160,190,220,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const p of this.particles) {
        p.y += p.v * 520 * dt; p.x -= p.v * 90 * dt;
        if (p.y > vh) { p.y = -8; p.x = Math.random() * (vw + 80); }
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 2.4, p.y + 9);
      }
      ctx.stroke();
    } else if (snowing) {
      ctx.fillStyle = 'rgba(240,245,250,0.75)';
      for (const p of this.particles) {
        p.y += p.v * 60 * dt; p.x += Math.sin(p.y / 24) * 0.5;
        if (p.y > vh) { p.y = -4; p.x = Math.random() * vw; }
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, 7); ctx.fill();
      }
    }
    if (world.weather === 'storm' && Math.random() < 0.006) {
      ctx.fillStyle = 'rgba(230,236,255,0.35)';
      ctx.fillRect(0, 0, vw, vh);
    }
  },

  // ---- portraits for the roster --------------------------------------------
  paintPortrait(canvas, p) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#262b33';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.56, r = w * 0.30;
    // shoulders
    ctx.fillStyle = { rags: '#8d8168', clothes: '#5e7161', coat: '#7a5c3a', parka: '#6e7d92', flak: '#5a5f52' }[p.apparel] || '#5e7161';
    ctx.beginPath(); ctx.ellipse(cx, h * 1.05, w * 0.42, h * 0.4, 0, Math.PI, 0); ctx.fill();
    // head
    ctx.fillStyle = SKIN_TONES[p.skin];
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    // eyes
    ctx.fillStyle = '#2c2c30';
    ctx.beginPath(); ctx.arc(cx - r * 0.38, cy + r * 0.05, r * 0.1, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.38, cy + r * 0.05, r * 0.1, 0, 7); ctx.fill();
    // hair
    ctx.fillStyle = HAIR_COLORS[p.hair.color];
    ctx.beginPath();
    const hs = p.hair.style;
    if (hs === 0) ctx.arc(cx, cy - r * 0.25, r * 0.95, Math.PI, 0);
    else if (hs === 1) { ctx.arc(cx, cy - r * 0.15, r * 1.02, Math.PI * 0.95, Math.PI * 0.05); ctx.rect(cx - r * 1.02, cy - r * 0.2, r * 0.3, r * 1.1); ctx.rect(cx + r * 0.72, cy - r * 0.2, r * 0.3, r * 1.1); }
    else if (hs === 2) ctx.arc(cx, cy - r * 0.45, r * 0.72, Math.PI * 0.95, Math.PI * 0.05);
    else if (hs === 3) { ctx.arc(cx, cy - r * 0.2, r * 0.98, Math.PI, 0); ctx.rect(cx - r * 1.0, cy - r * 0.3, r * 0.34, r * 1.2); }
    else ctx.arc(cx - r * 0.2, cy - r * 0.6, r * 0.5, 0, 7);
    ctx.fill();
  },
};

Object.assign(globalThis, { Renderer });
