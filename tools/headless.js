#!/usr/bin/env node
// headless.js — run the colony sim without a browser, for soak-testing and
// reading the generated chronicle. Usage:
//   node tools/headless.js --days 60 --seed 12345 [--quiet] [--chronicle]

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = ['util', 'names', 'defs', 'map', 'things', 'pawn', 'social', 'jobs', 'combat', 'overseer', 'events', 'storyteller', 'narrator', 'sim'];

// The renderer isn't loaded headless; sim code calls these hooks freely.
globalThis.Renderer = {
  focus() {}, cinematic() {},
};

const src = FILES.map(f => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n;\n');
vm.runInThisContext(src, { filename: 'game-bundle.js' });

const args = process.argv.slice(2);
const getArg = (name, dflt) => {
  const ix = args.indexOf('--' + name);
  return ix >= 0 && args[ix + 1] ? args[ix + 1] : dflt;
};
const days = parseInt(getArg('days', '40'), 10);
const seed = parseInt(getArg('seed', '12345'), 10);
const quiet = args.includes('--quiet');
const showChronicle = args.includes('--chronicle');

const world = Sim.newWorld(seed);
console.log(`# ${world.colonyName} — biome ${world.biome}, seed ${seed}, storyteller ${world.st.persona}`);

const t0 = Date.now();
let lastSeason = world.season;
let errors = 0;
const target = days * BAL.MIN_PER_DAY;

for (let step = 0; step < target; step++) {
  try {
    Sim.tick(world);
  } catch (err) {
    errors++;
    console.error(`\n!! ERROR at t=${world.t} (day ${world.day}): ${err.stack}\n`);
    if (errors > 5) { console.error('too many errors, aborting'); process.exit(1); }
  }
  if (world.season !== lastSeason || step === target - 1) {
    const colonists = world.pawns.filter(p => p.isColonist());
    const mood = colonists.length ? Math.round(colonists.reduce((a, p) => a + p.mood, 0) / colonists.length) : 0;
    if (!quiet) {
      console.log(`[day ${String(world.day).padStart(3)}] ${lastSeason.padEnd(6)} → pop ${String(colonists.length).padStart(2)} mood ${String(mood).padStart(3)} ` +
        `food ${String(Math.round(Things.countFood(world))).padStart(4)} wood ${String(Things.count(world, 'wood')).padStart(4)} ` +
        `wealth ${String(Sim.colonyWealth(world)).padStart(6)} bldgs ${world.buildings.filter(b => !b.blueprint).length} ` +
        `deaths ${world.stats.colonistDeaths} raids ${world.stats.raids}`);
    }
    lastSeason = world.season;
  }
  if (world.gameOverState) {
    console.log(`\n== COLONY FELL on day ${world.day} ==`);
    break;
  }
}

const ms = Date.now() - t0;
console.log(`\nSimulated ${world.day} days in ${ms}ms (${Math.round(world.t / (ms / 1000))} ticks/s). Errors: ${errors}`);

// sanity checks
let bad = 0;
for (const p of world.pawns) {
  if (Number.isNaN(p.mood) || Number.isNaN(p.x) || Number.isNaN(p.needs.food)) { console.error(`NaN state on ${p.label()}`); bad++; }
}
if (Number.isNaN(Sim.colonyWealth(world))) { console.error('NaN wealth'); bad++; }

// chronicle dump
if (showChronicle) {
  console.log('\n===== THE CHRONICLE =====');
  for (const e of world.chron.entries) {
    if (e.chapter) console.log(`\n### Chapter ${e.chapterNum}: ${e.text}\n`);
    else console.log(`[${e.date}] ${e.icon} ${e.text}`);
  }
}

// story quality stats
const majors = world.chron.entries.filter(e => e.major).length;
console.log(`\nChronicle: ${world.chron.entries.length} entries, ${majors} major, ${world.chron.chapterCount} chapters, ${world.chron.memories.length} memories.`);
const colonists = world.pawns.filter(p => p.isColonist());
console.log(`Final: pop ${colonists.length}, buildings ${world.buildings.filter(b => !b.blueprint).length}, techs ${world.techsDone.join(',') || 'none'}`);
for (const p of colonists.slice(0, 20)) {
  console.log(`  - ${p.full()} (${p.ageYears(world)}) mood ${p.mood} [${p.traits.join(', ')}] ${p.spouseId ? '⚭' : ''}`);
}

// save/load round-trip check
try {
  const json = Sim.save(world);
  const w2 = Sim.load(json);
  console.log(`Save/load OK (${Math.round(json.length / 1024)} KB, ${w2.pawns.length} pawns restored)`);
} catch (err) {
  console.error('SAVE/LOAD FAILED: ' + err.stack);
  bad++;
}

process.exit(errors + bad > 0 ? 1 : 0);
