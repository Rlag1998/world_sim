// audio.js — procedural ambience: wind, rain, crickets, birdsong, fire crackle,
// distant thunder, and an alarm bell for raids. No samples, all synthesized.
// Off by default; the 🔊 button starts it (which also satisfies autoplay policy).

const Ambience = {
  on: false,
  ctx: null,

  toggle() {
    if (!this.ctx) this.build();
    this.on = !this.on;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.setTargetAtTime(this.on ? 0.9 : 0, this.ctx.currentTime, 0.4);
    return this.on;
  },

  build() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // shared looping noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const noiseVoice = (freq, q, gain0) => {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass'; filt.frequency.value = freq; filt.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain0;
      src.connect(filt).connect(g).connect(this.master);
      src.start();
      return { g, filt };
    };

    this.wind = noiseVoice(300, 0.4, 0.05);
    this.rain = noiseVoice(2400, 0.3, 0);
    this.fire = noiseVoice(900, 1.2, 0);
    // wind gusts
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 0.025;
    lfo.connect(lfoG).connect(this.wind.g.gain);
    lfo.start();
    // crickets: pulsed high chirp
    this.cricketG = ctx.createGain(); this.cricketG.gain.value = 0;
    const cOsc = ctx.createOscillator();
    cOsc.type = 'sine'; cOsc.frequency.value = 4200;
    const cPulse = ctx.createOscillator(), cPulseG = ctx.createGain();
    cPulse.type = 'square'; cPulse.frequency.value = 13;
    cPulseG.gain.value = 1;
    const cAmp = ctx.createGain(); cAmp.gain.value = 0;
    cPulse.connect(cPulseG).connect(cAmp.gain);
    cOsc.connect(cAmp).connect(this.cricketG).connect(this.master);
    cOsc.start(); cPulse.start();
    this.cricketAmp = cAmp;
    this.lastBird = 0;
    this.lastThunderFx = 0;
    this.wasThreat = false;
  },

  chirp() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    const base = 2000 + Math.random() * 1800;
    o.frequency.setValueAtTime(base, t);
    for (let k = 0; k < 3 + Math.random() * 3; k++) {
      const tt = t + k * 0.09;
      o.frequency.setValueAtTime(base + Math.random() * 600, tt);
      o.frequency.exponentialRampToValueAtTime(base - 300 - Math.random() * 400, tt + 0.07);
    }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.6);
  },

  thunder() {
    const ctx = this.ctx, t = ctx.currentTime + 0.4 + Math.random() * 1.5;
    const src = ctx.createBufferSource();
    src.buffer = this.rumbleBuf || (this.rumbleBuf = (() => {
      const len = ctx.sampleRate * 3;
      const b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
      return b;
    })());
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 110;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.65, t);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
  },

  bell() {
    const ctx = this.ctx;
    for (let k = 0; k < 3; k++) {
      const t = ctx.currentTime + k * 0.8;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 620;
      const o2 = ctx.createOscillator();
      o2.type = 'sine'; o2.frequency.value = 930;
      const g2 = ctx.createGain(); g2.gain.value = 0.4;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.connect(g); o2.connect(g2).connect(g);
      g.connect(this.master);
      o.start(t); o.stop(t + 0.75); o2.start(t); o2.stop(t + 0.75);
    }
  },

  // called each frame from the main loop
  update(world) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const raining = world.weather === 'rain' || world.weather === 'storm';
    this.rain.g.gain.setTargetAtTime(raining ? (world.weather === 'storm' ? 0.16 : 0.09) : 0, t, 1.2);
    this.wind.g.gain.setTargetAtTime(world.weather === 'storm' ? 0.09 : 0.05, t, 1.5);
    // crickets at night (not in winter), birds at day
    const crickets = world.isNight && world.tempOut > 2 && !raining;
    this.cricketG.gain.setTargetAtTime(crickets ? 0.5 : 0, t, 1.5);
    if (!world.isNight && !raining && performance.now() - this.lastBird > 2500 + Math.random() * 9000) {
      this.lastBird = performance.now();
      if (Math.random() < 0.7) this.chirp();
    }
    // fire crackle when a lit hearth is near the camera
    let fireNear = 0;
    const cam = Renderer.cam;
    for (const b of world.buildings) {
      if (b.blueprint || !b.lit) continue;
      const def = BUILDINGS[b.key];
      if (!def.fire) continue;
      const d = U.dist(cam.x, cam.y, b.x, b.y);
      if (d < 15) fireNear = Math.max(fireNear, 1 - d / 15);
    }
    if (world.fireCount > 0) fireNear = Math.max(fireNear, 0.6); // wildfire is loud
    this.fire.g.gain.setTargetAtTime(fireNear * 0.11, t, 0.8);
    // thunder follows lightning fx
    for (const fx of world.fx) {
      if (fx.kind === 'lightning' && fx.t > this.lastThunderFx) {
        this.lastThunderFx = fx.t;
        this.thunder();
      }
    }
    // raid bell on threat rising edge
    if (world.threat && !this.wasThreat) this.bell();
    this.wasThreat = world.threat;
  },
};

Object.assign(globalThis, { Ambience });
