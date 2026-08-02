# The Chronicle Engine

A text-rendered, fully simulated procedural fantasy world in a single self-contained
HTML file. Open `world_sim.html` in a browser. No build step, no dependencies, no
network access.

Type a seed, press **FORGE WORLD**, then **RUN**. The same seed always produces the
same world, down to the last bastard.

---

## What it actually simulates

Nothing in this world is hand-authored. There are no named kingdoms in the source,
no plot scripts, and no sentence templates hiding a story. There are small phoneme
tables, a list of semantic concepts, and about forty numeric constants. Everything
else is derived.

**The rock.** 11–17 tectonic plates with drift vectors are laid down over a wrapping
280×160 grid. Convergent boundaries between two continental plates raise Himalayan
ranges; oceanic subduction raises volcanic arcs and coastal cordillera; divergent
boundaries open rifts. Mantle plumes paint island chains along their drift. Sea
level is then chosen to give the land fraction we asked for.

**The sky.** Winds come from a three-cell circulation model (trades, westerlies,
polar easterlies) blended across the boundaries. Rainfall is computed by marching
42 steps *upwind* from every tile, gathering evaporation over water and losing it
to orographic lift over rising ground — which is what produces real rain shadows
behind mountain ranges. Temperature falls with latitude and altitude and swings
harder inland. The grid uses an equal-area projection so the poles don't eat a
fifth of the world.

**The water.** Depressions are filled with a priority-flood, flow is routed D8
downhill, and discharge is accumulated in descending-elevation order. Two rounds of
stream-power erosion cut the highlands and are then re-drained. Rivers are whatever
carries the wettest 4% of the drainage; lakes are the basins that never reached the
sea; salt flats are the endorheic ones in deserts.

**The ground.** Biomes are Whittaker classification from real temperature and real
rainfall, with altitude and wetland overrides. Soil fertility comes from biome,
slope, floodplain accumulation, volcanic ash and growing-season length. Ore is
placed where the geology allows it: metals in orogenic belts, coal in old swamps,
salt on dry coasts and in evaporite basins, amber on cold northern shores, horses
on steppe, starmetal where something fell out of the sky.

**The Elder Age.** Before year zero, primordial Powers seat themselves on the
strongest leylines and break the world: a Sundering that splits a mountain range, a
Drowning that takes a coast, a Long Cold, a Glassing. These edits happen *before*
climate and hydrology run, so the scars change where the rain falls forever after.
Their ruins are scattered across the map with things buried in them.

**Tongues.** Three or four proto-languages are invented from sampled phoneme
inventories with typological constraints, then given a root lexicon over ~160
concepts. As peoples divide, daughter tongues inherit those roots and apply chains
of regular sound laws — Grimm's shift, lenition, rhotacism, apocope, palatalisation,
nasal loss — so related languages have visibly cognate words. Open any tongue in the
inspector to see its lexicon beside its parent's, and the laws that separated them.

**Names mean things.** Every place-name is composed from what is actually on its
tile: a river-mouth fort in a pine wood held by a people whose word for pine is
*lötö* becomes **Lötöngi**, and the engine will tell you it means "wood haven".
Personal names are dithematic compounds. Epithets are earned from deeds.

**Peoples.** Species are rolled, not chosen — lifespan, fecundity, magical affinity,
stature, temperament, biome preference. The roll space can produce elf-like,
dwarf-like and human-like kindreds, and it names them in their own language. Culture
is a twelve-value vector (honour, piety, martialism, xenophobia, literacy, cruelty…)
that drifts every decade and *diverges* when a population is cut off by distance or
foreign rule — at which point a new culture and a new daughter language are born,
and the chronicle says so.

**Gods.** Pantheons are generated from what the founding landscape actually cared
about: a coastal people gets a sea god, a famine-scarred one gets a grain god, a
people beside a volcano gets a god of the forge. Holy sites are placed on genuine
geographic anomalies. Faiths schism when congregations drift apart, and every heresy
disagrees about something specific.

**Bread and silver.** Each settlement produces sixteen goods from the tiles it
actually holds and the classes it actually contains. Prices move with local stocks.
Caravans on the settlement graph chase real margins net of transport cost, bulk and
banditry risk. Roads accrete where traffic already went, which lowers cost, which
attracts more traffic. Famine happens when grain stocks reach zero. Technology is a
44-node prerequisite graph that spreads by trade contact and is *lost* when literate
populations collapse — taking everything downstream of it with it.

**The blood.** Every hold of any size has a lord. Characters have skills, a
correlated trait pool, inherited and mutated from their parents; opinions of each
other that always carry the reason attached; claims; grudges that outlive them and
are inherited by their children. Marriage is an alliance market weighted by realm
size, prestige, faith, culture gap and consanguinity taboo. Succession follows the
culture's law — and partible inheritance really does shatter realms among four sons.
Plots are murder, seizure, forged claims and usurpation, resolved by skill checks
with co-conspirators recruited from people who share the grievance.

Occasionally, a wedding between two houses with a blood debt between them ends
badly.

**The sword.** Wars are declared for reasons the world produced: pressed claims,
lost cores, kin under a foreign yoke, holy sites in unbelieving hands, blocked trade
routes, avenged grudges — or plain arithmetic about who is weaker. Levies deplete a
real manpower pool. Armies march the road network, starve in hostile terrain in
winter, and desert. Every host that meets on one field fights one battle, resolved
from numbers, quality, terrain, weather and the commander's own martial skill and
temperament — and named lords die in it. Sieges have walls, stores, assault-versus-
starve-out, and sack. Peace transfers real territory and plants the next war's
grievance.

**Deep time.** Magic is a mappable field over the tiles, generated from tectonics
and Elder Age scars, and it is *leaving the world* — about 84% of it is gone by year
1200. The elder kindreds fade with it. Artifacts are forged with a real provenance
chain: who made it, of what, where, and every hand it passed through, including the
four hundred years it spent in the ground before a named looter dug it up. Some of
them corrupt their bearers. Prophecies are generated from the simulation's own
predicted state, made deliberately obscure, and then actually checked — fulfilled,
or outliving their deadline and quietly reinterpreted.

**Legend drift.** The chronicle stores what happened. The **WORLD** panel also shows
what people now *say* happened: numbers inflate in the telling, giants are added,
and some events are held not to have happened at all.

---

## Reading it

| | |
|---|---|
| drag / arrow keys | pan |
| wheel, `+` / `-` | zoom (4 levels) |
| `1` … `9` | map modes |
| space | run / pause |
| click a tile | inspect it |
| click any coloured name | follow it — anywhere |

Fourteen map modes: **LAND** (biomes and rivers), **REALMS** (borders drawn bright
at frontiers), **PEOPLES**, **GODS**, **FOLK**, **TRADE** (roads), **UNREST**,
**WAR**, **POWER** (leylines), **CLIMATE**, **RAINS**, **RICHES**, **RELIEF**,
**LEGENDS** (ruins and Elder Age scars only).

Everything is clickable and everything cross-links: a battle → its war → the
commander → his house → its sigil and motto → his grudges → the man who killed his
father → that man's seat → its market prices.

---

## Performance

The map is a monospaced glyph grid painted to a canvas through a tinted glyph atlas,
so forty-four thousand cells repaint without the browser sulking. World generation
takes about 2.5 seconds. Simulation runs roughly 3 ms/year early and 50 ms/year by
year 1200, time-sliced against `requestAnimationFrame` so long jumps never freeze
the tab. A 1200-year history costs about 27 seconds and 120 MB.

---

## Layout

`world_sim.html` is the deliverable and is fully self-contained. It is generated by
concatenating the annotated sources:

```
src/00_head.html   markup and styling
src/10_core.js     PRNG streams, cylindrical noise, heaps, palettes
src/20_worldgen.js tectonics, climate, hydrology, biomes, ores, travel costs
src/30_lang.js     phonologies, sound laws, compositional naming
src/40_peoples.js  species, cultures, pantheons
src/50_econ.js     settlements, goods, prices, trade, roads, technology
src/60_char.js     characters, traits, dynasties, opinion, heraldry
src/65_polity.js   realms, vassalage, succession law, factions, plots
src/70_war.js      diplomacy, casus belli, armies, battles, sieges, peace
src/80_myth.js     Elder Age, leylines, artifacts, prophecy, ruins, legend drift
src/85_sim.js      chronicle, world birth, the year tick
src/90_render.js   glyph atlas, map modes, minimap
src/95_ui.js       inspectors, chronicle, controls, scheduler
```

Rebuild with `./build.sh`.

`test/node.js`, `test/story.js` and `test/prof.js` run the simulation core headless
in Node for profiling and narrative inspection; `test/run.js` and `test/shot.js`
drive the real page in headless Chromium.
