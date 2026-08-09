// narrator.js — the chronicle: prose log, chapters, memories, season & year summaries,
// epitaphs and art descriptions. This is the product; everything else is its engine.

const Chron = {
  init(world) {
    world.chron = {
      entries: [],       // {t, day, date, text, icon, tone, major}
      chapterCount: 0,
      lastChapterT: -99999,
      memories: [],      // notable moments for art/anniversaries: {day, kind, text, pawns}
      recent: [],        // anti-repeat memory of template hashes
      seasonStats: Chron.blankStats(),
    };
  },

  blankStats() {
    return { deaths: [], births: [], joins: [], raids: 0, weddings: 0, breaks: 0, recovered: 0, harvested: 0, crafted: 0 };
  },

  dateStr(world) {
    return `Day ${world.dayOfSeason + 1} of ${world.season}, ${BAL.START_YEAR + world.year0}`;
  },

  log(world, text, opts = {}) {
    if (!world.chron) return;
    const e = {
      t: world.t, day: world.day, date: Chron.dateStr(world),
      text, icon: opts.icon || '', tone: opts.tone || 'neutral', major: !!opts.major,
    };
    world.chron.entries.push(e);
    if (world.chron.entries.length > 1600) world.chron.entries.splice(0, world.chron.entries.length - 1600);
    world.uiDirty = true;
    if (opts.at && typeof Renderer !== 'undefined' && Renderer.focus && opts.major) {
      Renderer.focus(world, opts.at.x, opts.at.y, 4, null);
    }
    return e;
  },

  // pick a template variant, avoiding recent repeats
  pick(world, variants) {
    const rec = world.chron ? world.chron.recent : [];
    const fresh = variants.filter(v => !rec.includes(Chron.hashText(v)));
    const chosen = (fresh.length ? world.rng.pick(fresh) : world.rng.pick(variants));
    if (world.chron) {
      rec.push(Chron.hashText(chosen));
      if (rec.length > 40) rec.shift();
    }
    return chosen;
  },

  hashText(s) {
    let h = 0;
    for (let i = 0; i < Math.min(s.length, 40); i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  },

  // Novelty gate for low-stakes recurring beats: a template key may log once
  // per cooldown; heavy repetition earns a single summary line, then silence.
  gate(world, tkey, coolDays) {
    const g = world.chron.tpl || (world.chron.tpl = {});
    const rec = g[tkey] || (g[tkey] = { lastT: -1e9, n: 0 });
    if (world.t - rec.lastT >= coolDays * BAL.MIN_PER_DAY) {
      rec.lastT = world.t; rec.n = 0;
      return 'log';
    }
    rec.n++;
    if (rec.n === 8) return 'summary'; // one wry acknowledgement of the rut
    return 'skip';
  },

  remember(world, mem) {
    mem.day = world.day;
    world.chron.memories.push(mem);
    if (world.chron.memories.length > 90) world.chron.memories.shift();
  },

  // trait color for narration: "ever the optimist"
  quip(world, p) {
    const quips = [];
    for (const t of p.traits) for (const q of (TRAITS[t].quip || [])) quips.push(q);
    return quips.length && world.rng.chance(0.6) ? world.rng.pick(quips) : null;
  },

  // ---- chapters ------------------------------------------------------------
  maybeChapter(world, trigger, titleHint) {
    if (world.t - world.chron.lastChapterT < BAL.MIN_PER_DAY * 1.5) return;
    Chron.chapter(world, titleHint || Names.chapterTitle(world.rng, Chron.chapterNounFor(world, trigger)));
  },

  chapterIfDue(world) {
    if (world.t - world.chron.lastChapterT > BAL.MIN_PER_DAY * 10) {
      Chron.chapter(world, Names.chapterTitle(world.rng));
    }
  },

  chapterNounFor(world, trigger) {
    const map = { raidWon: 'Siege', wedding: 'Promise', return: 'Homecoming' };
    return map[trigger] || null;
  },

  chapter(world, title) {
    world.chron.chapterCount++;
    world.chron.lastChapterT = world.t;
    const e = Chron.log(world, title, { tone: 'chapter', major: true });
    if (e) { e.chapter = true; e.chapterNum = world.chron.chapterCount; }
  },

  // ---- season & year summaries ----------------------------------------------
  seasonSummary(world, endedSeason) {
    const s = world.chron.seasonStats;
    const colonists = world.pawns.filter(p => p.isColonist());
    const bits = [];
    if (s.deaths.length) bits.push(`it took ${U.listJoin(s.deaths)} from us`);
    if (s.births.length) bits.push(`it gave us ${U.listJoin(s.births)}`);
    if (s.joins.length) bits.push(`${U.listJoin(s.joins)} came to stay`);
    if (s.raids > 0) bits.push(`${s.raids === 1 ? 'a raid was' : s.raids + ' raids were'} weathered`);
    if (s.weddings > 0) bits.push(`${s.weddings === 1 ? 'a wedding was' : s.weddings + ' weddings were'} danced`);
    if (s.harvested > 40) bits.push(`the fields yielded well`);
    const mood = colonists.length ? Math.round(colonists.reduce((a, p) => a + p.mood, 0) / colonists.length) : 0;
    const openers = {
      Spring: ['Spring came in soft and green.', 'The thaw filled the creeks and the fields went to work.', 'A spring of mud and possibility.'],
      Summer: ['A high, hot summer.', 'Summer lay heavy on the land.', 'Long days; the light did not want to leave.'],
      Fall: ['Fall arrived smelling of woodsmoke.', 'The leaves turned; the larders filled or failed.', 'A season of counting and salting.'],
      Winter: ['Winter closed its fist.', 'Snow silenced everything but the hearth.', 'A pale, patient winter.'],
    };
    const opener = Chron.pick(world, openers[endedSeason] || ['The season passed.']);
    const moodLine = mood > 62 ? 'The colony ends the season in good spirits.' : mood < 38 ? 'The colony is tired, and shows it.' : 'The colony endures, day by ordinary day.';
    const text = `${opener} ${bits.length ? 'This season, ' + U.listJoin(bits) + '.' : 'Nothing the chronicle need weep or sing over — a mercy, in its way.'} ${moodLine} (${colonists.length} colonists · wealth ${Math.round(Sim.colonyWealth(world))})`;
    Chron.log(world, text, { icon: '📜', tone: 'summary', major: true });
    world.chron.seasonStats = Chron.blankStats();
  },

  yearSummary(world) {
    const year = BAL.START_YEAR + world.year0;
    Chron.chapter(world, `Year ${world.year0 + 1} — ${Names.chapterTitle(world.rng)}`);
    const colonists = world.pawns.filter(p => p.isColonist());
    const eldest = colonists.reduce((a, p) => (!a || p.ageYears(world) > a.ageYears(world)) ? p : a, null);
    const youngest = colonists.reduce((a, p) => (!a || p.ageYears(world) < a.ageYears(world)) ? p : a, null);
    const graves = world.buildings.filter(b => !b.blueprint && BUILDINGS[b.key].grave && b.meta && b.meta.occupant).length;
    const lines = [
      `${world.colonyName} enters ${year}. Population ${colonists.length}${graves ? `; ${graves} ${U.plural(graves, 'grave')} on the hill` : ''}.`,
      eldest && youngest && eldest !== youngest ? `Eldest: ${eldest.label()} (${eldest.ageYears(world)}). Youngest: ${youngest.label()} (${youngest.ageYears(world)}).` : '',
      world.stats.raidsSurvived ? `${world.stats.raidsSurvived} ${U.plural(world.stats.raidsSurvived, 'raid')} survived to date.` : '',
    ].filter(Boolean);
    Chron.log(world, lines.join(' '), { icon: '🗓️', tone: 'summary', major: true });
  },

  // ---- death, epitaphs, eulogies -------------------------------------------
  deathProse(world, p, cause, srcLabel) {
    const rng = world.rng;
    const q = Chron.quip(world, p);
    const name = p.full();
    const ageN = p.ageYears(world);
    const age = ageN < 1 ? 'not yet a year old' : ageN < 3 ? `only ${ageN}` : ageN;
    // the newly arrived get honest words, not borrowed heroism
    if (world.day - p.joinedDay < 3 && p.stats.raidsFought === 0 && p.stats.harvests === 0) {
      return Chron.pick(world, [
        `${name} died almost as soon as ${p.he} arrived — ${cause}. The rim gives and takes in the same breath. ${U.cap(p.he)} will be buried as one of ours anyway.`,
        `The colony barely learned ${name}'s name before losing it — ${cause}. A short chapter; the grave gets the same care as any other.`,
      ]);
    }
    const violent = /shot|wound|bled|beast|fists|blade|raid/.test(cause + (srcLabel || ''));
    const templates = violent ? [
      `${name} ${cause}${srcLabel ? ` — ${srcLabel}` : ''}. ${U.cap(p.he)} ${p.was} ${age}. ${rng.pick(['The ground drank; the work went on; the grief waited politely for nightfall.', 'Someone closed ' + p.his + ' eyes. Someone else picked up ' + p.his + ' gun.', 'The colony is smaller tonight, in every way a colony can be.'])}`,
      `They will say ${name} ${cause}. ${q ? U.cap(q) + ' to the end. ' : ''}${rng.pick(['What the chronicle records is simpler: ' + p.he + ' stood between the colony and the dark, and did not step aside.', 'The rim does not negotiate. It only collects.'])}`,
    ] : [
      `${name} ${cause}. ${U.cap(p.he)} ${p.was} ${age}. ${rng.pick(['The bed is made; the bowl is washed; the silence where ' + p.he + ' used to hum is enormous.', 'No violence, no villain — just the rim, doing what the rim does.', p.hasTrait('bard') ? 'Who will tell the stories now?' : 'The work ' + p.he + ' left half-done will be finished by other hands.'])}`,
    ];
    return Chron.pick(world, templates);
  },

  epitaph(world, corpseMeta) {
    const rng = world.rng;
    return rng.pick([
      `${corpseMeta.label} — the ground remembers.`,
      `Here lies ${corpseMeta.label}, far from where ${rng.chance(0.5) ? 'he' : 'she'} began, home anyway.`,
      `${corpseMeta.label}. The fire is yours now.`,
      `${corpseMeta.label} — kept the watch.`,
      `${corpseMeta.label}. We said your name at supper.`,
    ]);
  },

  eulogyLine(world, name) {
    return world.rng.pick([
      `${name} never once let the fire go out.`,
      `The rim is poorer; the ground is richer.`,
      `${name} would have hated this speech, so I'll keep it short.`,
      `We bury a friend and keep the stubbornness.`,
      `Walk easy. We'll take it from here.`,
    ]);
  },

  // ---- art -----------------------------------------------------------------
  artDesc(world, artist, quality) {
    const rng = world.rng;
    const mems = world.chron.memories;
    if (mems.length && rng.chance(0.75)) {
      const m = rng.pick(mems);
      const frames = [
        `a ${quality >= 1.4 ? 'breathtaking' : rng.pick(['rough', 'earnest', 'strangely moving'])} stone relief depicting how ${m.text}`,
        `a carved column remembering the day ${m.text}`,
        `an abstract form which everyone nonetheless agrees is about how ${m.text}`,
      ];
      return rng.pick(frames);
    }
    return rng.pick([
      `a stone figure of ${rng.pick(['a muffalo in the rain', 'two hands almost touching', 'the ship coming down', 'a sleeping dog', 'the mountain, but kinder'])}`,
      `an abstract knot of stone that catches the ${rng.pick(['morning', 'evening'])} light`,
    ]);
  },

  // ---- anniversaries ---------------------------------------------------------
  tickDaily(world) {
    const yearLen = BAL.DAYS_PER_SEASON * 4;
    for (const m of world.chron.memories) {
      if (m.kind !== 'death') continue;
      const age = world.day - m.day;
      if (age > 0 && age % yearLen === 0) {
        const years = age / yearLen;
        for (const id of m.pawns || []) {
          const p = world.byId[id];
          if (p && p.isColonist && p.isColonist()) p.addThought(world, 'remembrance');
        }
        Chron.log(world, `${U.ordinal(years)} anniversary of the day ${m.text}. ${world.rng.pick(['Flowers appeared on the grave; no one saw who.', 'The colony was quieter today, and kinder.', 'Their name came up at supper, and this time there were more smiles than silences.'])}`, { icon: ICONS.grave, tone: 'neutral' });
      }
    }
  },
};

Object.assign(globalThis, { Chron });
