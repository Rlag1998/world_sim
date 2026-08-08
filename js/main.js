// main.js — browser boot: world creation/loading, the frame loop, speed control,
// autosave, and spectator input (camera + inspection only; the world runs itself).

const Main = {
  speed: 1,          // 0 pause, 0.5, 1, 2, 3
  autoSpeed: true,
  accumulator: 0,
  errorCount: 0,

  boot() {
    const canvas = document.getElementById('game');
    Renderer.init(canvas);
    Renderer.resize();
    window.addEventListener('resize', () => Renderer.resize());
    UIx.init();

    let world = null;
    try {
      const saved = localStorage.getItem('rimtale.save');
      if (saved) world = Sim.load(saved);
    } catch (err) {
      console.warn('save could not be loaded; beginning a new chronicle', err);
    }
    if (!world) world = Sim.newWorld();
    this.world = world;
    Renderer.cam.x = world.map.home.x; Renderer.cam.y = world.map.home.y;
    Renderer.cam.tx = world.map.home.x; Renderer.cam.ty = world.map.home.y;

    this.bindInput(canvas);
    this.lastFrame = performance.now();
    this.lastSaveDay = world.day;
    requestAnimationFrame((t) => this.frame(t));
    setInterval(() => this.autosave(), 45000);
    window.addEventListener('beforeunload', () => this.autosave());
  },

  newChronicle() {
    try { localStorage.removeItem('rimtale.save'); } catch (e) { /* private mode */ }
    this.world = Sim.newWorld();
    UIx.lastChronIx = 0;
    UIx.lastRosterKey = '';
    UIx.chronList.innerHTML = '';
    Renderer.selectedId = null; Renderer.followId = null;
    Renderer.terrainCache = null;
    Renderer.cam.tx = this.world.map.home.x; Renderer.cam.ty = this.world.map.home.y;
    document.getElementById('memorial').style.display = 'none';
  },

  autosave() {
    if (!this.world || this.world.gameOverState) return;
    try { localStorage.setItem('rimtale.save', Sim.save(this.world)); } catch (e) { /* storage full or blocked */ }
  },

  setSpeed(s, manual) {
    if (manual) { this.autoSpeed = false; document.getElementById('btn-auto').classList.remove('on'); }
    this.speed = s;
    for (const b of document.querySelectorAll('.speed-btn[data-speed]')) {
      b.classList.toggle('on', parseFloat(b.dataset.speed) === s && !this.autoSpeed);
    }
  },

  frame(now) {
    const dtMs = Math.min(200, now - this.lastFrame);
    this.lastFrame = now;
    const world = this.world;

    if (this.autoSpeed && Renderer.suggestedSpeed != null && !world.gameOverState) {
      this.speed = Renderer.suggestedSpeed;
    }
    const stepsPerSec = 6 * this.speed;
    this.accumulator += (dtMs / 1000) * stepsPerSec;
    let steps = Math.floor(this.accumulator);
    this.accumulator -= steps;
    if (steps > 30) steps = 30;
    if (world.gameOverState) steps = Math.min(steps, 2); // let the wind blow over the ruins

    for (let k = 0; k < steps; k++) {
      try {
        Sim.tick(world);
      } catch (err) {
        this.errorCount++;
        console.error('sim error', err);
        if (this.errorCount > 40) { steps = 0; break; }
      }
    }

    try { Renderer.draw(world, dtMs); } catch (err) { console.error('render error', err); }
    try { UIx.tick(world); } catch (err) { console.error('ui error', err); }

    if (world.day !== this.lastSaveDay) { this.lastSaveDay = world.day; this.autosave(); }
    requestAnimationFrame((t) => this.frame(t));
  },

  bindInput(canvas) {
    // spectator camera: drag to pan, wheel to zoom, click to inspect
    let dragging = false, moved = false, lx = 0, ly = 0;
    canvas.addEventListener('mousedown', (ev) => { dragging = true; moved = false; lx = ev.clientX; ly = ev.clientY; });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - lx, dy = ev.clientY - ly;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      lx = ev.clientX; ly = ev.clientY;
      Renderer.cam.x -= dx / Renderer.cam.zoom;
      Renderer.cam.y -= dy / Renderer.cam.zoom;
      Renderer.cam.tx = Renderer.cam.x; Renderer.cam.ty = Renderer.cam.y;
      Renderer.manualUntil = performance.now() + 14000;
      Renderer.followId = null;
    });
    canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const f = ev.deltaY > 0 ? 0.88 : 1.14;
      Renderer.cam.zoom = U.clamp(Renderer.cam.zoom * f, 4.5, 26);
      Renderer.cam.tzoom = Renderer.cam.zoom;
      Renderer.manualUntil = performance.now() + 14000;
    }, { passive: false });
    canvas.addEventListener('click', (ev) => {
      if (moved) return;
      const rect = canvas.getBoundingClientRect();
      const wpt = Renderer.screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top);
      let best = null, bestD = 1.6;
      for (const p of this.world.pawns) {
        if (p.dead || p.gone) continue;
        const d = U.dist(wpt.x - 0.5, wpt.y - 0.5, p.x, p.y);
        if (d < bestD) { bestD = d; best = p; }
      }
      Renderer.selectedId = best ? best.id : null;
      UIx.renderDetail(this.world);
    });
    // controls
    document.getElementById('btn-pause').addEventListener('click', () => this.setSpeed(0, true));
    for (const b of document.querySelectorAll('.speed-btn[data-speed]')) {
      b.addEventListener('click', () => this.setSpeed(parseFloat(b.dataset.speed), true));
    }
    document.getElementById('btn-auto').addEventListener('click', () => {
      this.autoSpeed = !this.autoSpeed;
      document.getElementById('btn-auto').classList.toggle('on', this.autoSpeed);
      if (!this.autoSpeed) this.setSpeed(1, true);
    });
    document.getElementById('btn-new').addEventListener('click', () => {
      if (confirm('Abandon this chronicle and begin a new one?')) this.newChronicle();
    });
    window.addEventListener('keydown', (ev) => {
      if (ev.key === ' ') { ev.preventDefault(); this.setSpeed(this.speed === 0 ? 1 : 0, true); }
      if (ev.key === '1') this.setSpeed(1, true);
      if (ev.key === '2') this.setSpeed(2, true);
      if (ev.key === '3') this.setSpeed(3, true);
    });
    document.getElementById('btn-auto').classList.add('on');
  },
};

window.addEventListener('DOMContentLoaded', () => Main.boot());
Object.assign(globalThis, { Main });
