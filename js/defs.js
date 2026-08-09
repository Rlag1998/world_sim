// defs.js — static game data: skills, traits, backstories, thoughts, plants, animals,
// weapons, apparel, items, buildings, research, biomes, and the balance table.

const SKILLS = ['Shooting', 'Melee', 'Construction', 'Mining', 'Cooking', 'Plants', 'Medicine', 'Social', 'Crafting', 'Intellectual'];

// Work tags a backstory can disable.
const WORKTAGS = { violent: 'violence', caring: 'medicine', dumb: 'rough labor', intellectual: 'book-work' };

// mood: passive mood offset. brk: break-threshold shift (positive = snaps easier).
// opin: how others' opinion of this pawn shifts. quip: narrator color, used sparingly.
const TRAITS = {
  optimist:   { n: 'Optimist', d: 'always finds the bright side', mood: 6, quip: ['ever the optimist', 'refusing to be gloomy'] },
  pessimist:  { n: 'Pessimist', d: 'expects the worst', mood: -6, quip: ['as gloomy as ever', 'expecting the worst'] },
  sanguine:   { n: 'Sanguine', d: 'unsinkably cheerful', mood: 11, quip: ['unsinkable as always'] },
  depressive: { n: 'Depressive', d: 'carries a private darkness', mood: -11, quip: ['fighting the old darkness'] },
  volatile:   { n: 'Volatile', d: 'a temper on a short fuse', brk: 8, quip: ['fuse burning short'] },
  ironwilled: { n: 'Iron-willed', d: 'bends for nothing', brk: -13, quip: ['unbending as iron'] },
  hardworker: { n: 'Hard worker', d: 'never idle by choice', work: 1.18, quip: ['working like a mule'] },
  lazy:       { n: 'Lazy', d: 'allergic to effort', work: 0.82, quip: ['at an unhurried pace'] },
  nightowl:   { n: 'Night owl', d: 'comes alive after dark', quip: ['under the stars, wide awake'] },
  gourmand:   { n: 'Gourmand', d: 'lives for the next meal', quip: ['thinking mostly of dinner'] },
  ascetic:    { n: 'Ascetic', d: 'finds comfort in plainness', quip: ['content with nothing'] },
  greedy:     { n: 'Greedy', d: 'wants the finest of everything', quip: ['eyeing the finer things'] },
  jealous:    { n: 'Jealous', d: 'measures everything against others', quip: ['keeping score'] },
  kind:       { n: 'Kind', d: 'gentle with everyone', opin: 6, quip: ['gentle as ever'] },
  abrasive:   { n: 'Abrasive', d: 'says exactly what they think', opin: -8, quip: ['with trademark tact'] },
  magnetic:   { n: 'Magnetic', d: 'people simply like them', opin: 10, quip: ['charming as always'] },
  offputting: { n: 'Off-putting', d: 'hard to warm to', opin: -10, quip: [] },
  brawler:    { n: 'Brawler', d: 'settles things with fists', melee: 3, quip: ['fists first'] },
  sharpshooter: { n: 'Careful shooter', d: 'breathes, then fires', shoot: 2, quip: ['taking careful aim'] },
  triggerhappy: { n: 'Trigger-happy', d: 'shoots first, aims later', quip: ['blazing away'] },
  bloodlust:  { n: 'Bloodlust', d: 'finds a dark joy in violence', opin: -5, quip: ['with an unsettling grin'] },
  wimp:       { n: 'Wimp', d: 'crumples at the first scratch', quip: [] },
  tough:      { n: 'Tough', d: 'built like old leather', quip: ['shrugging it off'] },
  pyromaniac: { n: 'Pyromaniac', d: 'the flames whisper to them', quip: ['watching the flames a little too long'] },
  neurotic:   { n: 'Neurotic', d: 'wound tight as wire', work: 1.12, brk: 6, quip: ['wound tight'] },
  jogger:     { n: 'Jogger', d: 'always half-running', move: 0.15, quip: [] },
  slowpoke:   { n: 'Slowpoke', d: 'moves at their own speed', move: -0.15, quip: [] },
  romantic:   { n: 'Hopeless romantic', d: 'in love with love itself', quip: ['heart worn on sleeve'] },
  greenthumb: { n: 'Green thumb', d: 'happiest with soil under the nails', quip: ['humming among the plants'] },
  dreamer:    { n: 'Dreamer', d: 'touched by strange inspiration', quip: ['lost in some private vision'] },
  detached:   { n: 'Detached', d: 'feels grief and fear only faintly', opin: -4, quip: ['unmoved'] },
  bard:       { n: 'Storyteller', d: 'keeper of tales and songs', quip: ['already turning it into a story'] },
};
const TRAIT_KEYS = Object.keys(TRAITS);

const BACKSTORIES = {
  child: [
    { key: 'urchin', n: 'Urchin', d: 'grew up hungry in the alleys of a glitterworld undercity', sk: { Melee: 2, Social: 1 }, bias: ['tough'] },
    { key: 'farmkid', n: 'Farm kid', d: 'was raised behind a plow on a quiet agriworld', sk: { Plants: 3, Construction: 1 }, bias: ['greenthumb'] },
    { key: 'nobleward', n: 'Noble ward', d: 'was raised among silk and scheming in a highborn house', sk: { Social: 3 }, ban: ['dumb'], bias: ['greedy'] },
    { key: 'vatgrown', n: 'Vatgrown', d: 'spent childhood in a learning vat, dreaming syllabus dreams', sk: { Intellectual: 3 }, bias: ['detached'] },
    { key: 'scavkid', n: 'Scavenger', d: 'picked the bones of dead ships for salvage crews', sk: { Crafting: 2, Mining: 1 }, bias: [] },
    { key: 'bookworm', n: 'Bookworm', d: 'hid from the world inside libraries', sk: { Intellectual: 2, Medicine: 1 }, ban: ['violent'], bias: ['neurotic'] },
    { key: 'tribechild', n: 'Tribe child', d: 'learned the old songs and the older hungers of a tribe', sk: { Plants: 2, Melee: 1 }, bias: ['bard'] },
    { key: 'stationbrat', n: 'Station brat', d: 'grew up zero-g, racing through the vents of an orbital', sk: { Crafting: 1, Shooting: 1 }, bias: ['jogger'] },
    { key: 'warrefugee', n: 'War refugee', d: 'was carried out of a burning city, and remembers it', sk: { Melee: 1 }, bias: ['pessimist'] },
    { key: 'minerskid', n: "Miner's kid", d: 'was born to the dark and the drill-song of deep shafts', sk: { Mining: 3 }, bias: [] },
    { key: 'chefskid', n: "Cook's kid", d: 'was raised in the steam and clatter of a station galley', sk: { Cooking: 3 }, bias: ['gourmand'] },
    { key: 'wildchild', n: 'Wild child', d: 'ran feral in the woods for years before being found', sk: { Melee: 2, Plants: 1 }, ban: ['intellectual'], bias: ['volatile'] },
  ],
  adult: [
    { key: 'soldier', n: 'Soldier', d: 'served in a forgotten war for a forgotten flag', sk: { Shooting: 4, Melee: 2 }, bias: ['ironwilled'] },
    { key: 'medic', n: 'Field medic', d: 'stitched soldiers back together under fire', sk: { Medicine: 4 }, bias: ['kind'] },
    { key: 'farmer', n: 'Farmer', d: 'coaxed harvests out of three different worlds', sk: { Plants: 4, Construction: 1 }, bias: ['greenthumb'] },
    { key: 'chef', n: 'Chef', d: 'ran the kitchen of an orbital pleasure barge', sk: { Cooking: 4, Social: 1 }, bias: ['gourmand'] },
    { key: 'engineer', n: 'Engineer', d: 'kept a freighter breathing years past its scrap date', sk: { Construction: 4, Crafting: 2 }, bias: [] },
    { key: 'miner', n: 'Deep miner', d: 'chased ore veins through the marrow of dead moons', sk: { Mining: 4, Construction: 1 }, bias: ['tough'] },
    { key: 'conartist', n: 'Con artist', d: 'sold empty promises on a dozen worlds, profitably', sk: { Social: 4 }, ban: ['dumb'], bias: ['magnetic'] },
    { key: 'scholar', n: 'Scholar', d: 'held a chair in xenohistory before the funding died', sk: { Intellectual: 4 }, ban: ['violent'], bias: ['neurotic'] },
    { key: 'sculptor', n: 'Sculptor', d: 'made beautiful things for people who deserved worse', sk: { Crafting: 4 }, bias: ['dreamer'] },
    { key: 'hunter', n: 'Hunter', d: 'guided offworld hunts until the client became the prey', sk: { Shooting: 4, Plants: 1 }, bias: ['sharpshooter'] },
    { key: 'expirate', n: 'Ex-pirate', d: 'sailed with a black crew, and left it the hard way', sk: { Shooting: 2, Melee: 3 }, bias: ['bloodlust'] },
    { key: 'herbalist', n: 'Herbalist', d: 'traded remedies along the rim roads', sk: { Medicine: 3, Plants: 2 }, ban: ['violent'], bias: ['kind'] },
    { key: 'machinist', n: 'Machinist', d: 'could make a lathe sing and a rifle out of scrap', sk: { Crafting: 4, Shooting: 1 }, bias: [] },
    { key: 'drifter', n: 'Drifter', d: 'walked between settlements with everything they owned', sk: { Melee: 1, Plants: 1, Cooking: 1 }, bias: ['sanguine'] },
    { key: 'sheriff', n: 'Sheriff', d: 'kept the peace in a town that hated peace', sk: { Shooting: 3, Social: 2 }, bias: ['ironwilled'] },
    { key: 'brewer', n: 'Brewer', d: 'was famous for a dark ale three systems over', sk: { Cooking: 3, Plants: 1 }, bias: ['bard'] },
    { key: 'navvy', n: 'Navvy', d: 'built rail and road across a frontier world', sk: { Construction: 3, Mining: 2 }, bias: ['hardworker'] },
    { key: 'ballerina', n: 'Dancer', d: 'danced for crowds that threw flowers, then bottles', sk: { Social: 2, Melee: 2 }, bias: ['magnetic'] },
  ],
};

// Memory thoughts: {l: label, m: mood, d: duration days, st: max stacks}
const THOUGHTS = {
  ateFine: { l: 'ate a fine meal', m: 6, d: 0.5 },
  ateNoTable: { l: 'ate without a table', m: -3, d: 0.4 },
  ateRawFood: { l: 'ate raw food', m: -4, d: 0.4 },
  mealMonotony: { l: 'same food again', m: -3, d: 0.6 },
  hadBeer: { l: 'had a beer', m: 5, d: 0.4 },
  sleptOutside: { l: 'slept outside', m: -5, d: 0.5 },
  sleptOnGround: { l: 'slept on the ground', m: -4, d: 0.5 },
  sleptInCold: { l: 'slept in the cold', m: -6, d: 0.5 },
  sleptInHeat: { l: 'slept in sweltering heat', m: -4, d: 0.5 },
  goodBedroom: { l: 'has a fine bedroom', m: 4, d: 1, st: 1 },
  crampedQuarters: { l: 'cramped shared quarters', m: -3, d: 1, st: 1 },
  soaked: { l: 'soaking wet', m: -4, d: 0.25 },
  filthySurroundings: { l: 'filthy surroundings', m: -3, d: 0.3 },
  beautifulSurroundings: { l: 'beautiful surroundings', m: 3, d: 0.3 },
  insulted: { l: 'was insulted', m: -6, d: 1, st: 3 },
  kindWords: { l: 'heard kind words', m: 4, d: 1, st: 3 },
  goodChat: { l: 'good conversation', m: 2, d: 0.7, st: 3 },
  rebuffed: { l: 'advances rebuffed', m: -8, d: 2 },
  courted: { l: 'someone is courting me', m: 6, d: 2 },
  newLove: { l: 'new love!', m: 14, d: 5 },
  gotMarried: { l: 'married!', m: 18, d: 6 },
  attendedWedding: { l: 'a lovely wedding', m: 8, d: 2 },
  attendedParty: { l: 'what a feast!', m: 8, d: 2 },
  attendedFuneral: { l: 'we said goodbye properly', m: 4, d: 3 },
  heardTales: { l: 'fireside tales', m: 5, d: 1 },
  brokeUp: { l: 'heartbroken', m: -16, d: 8 },
  divorced: { l: 'divorced', m: -20, d: 10 },
  cheatedOn: { l: 'betrayed by my love', m: -22, d: 12 },
  guiltyAffair: { l: 'guilty conscience', m: -6, d: 4 },
  spouseDied: { l: 'my love is dead', m: -25, d: 15 },
  familyDied: { l: 'lost family', m: -18, d: 12 },
  friendDied: { l: 'my friend is dead', m: -12, d: 8 },
  colonistDied: { l: 'a colonist died', m: -5, d: 4, st: 3 },
  rivalDied: { l: 'my rival is gone', m: 3, d: 3 },
  sawCorpse: { l: 'saw a corpse', m: -4, d: 0.7, st: 3 },
  witnessedDeath: { l: 'watched someone die', m: -8, d: 4, st: 2 },
  buriedColonist: { l: 'laid someone to rest', m: -3, d: 2 },
  unburiedDead: { l: 'our dead lie unburied', m: -5, d: 1, st: 1 },
  tookLife: { l: 'I killed someone', m: -8, d: 4, st: 2 },
  tookLifeGlad: { l: 'the thrill of the kill', m: 6, d: 3, st: 2 },
  raidRepelled: { l: 'we drove them off!', m: 10, d: 3 },
  raidMauledUs: { l: 'they hurt us badly', m: -7, d: 4 },
  kidnappedColonist: { l: 'they took one of ours', m: -10, d: 6 },
  newColonist: { l: 'a new face among us', m: 4, d: 2 },
  colonistLeft: { l: 'someone gave up on us', m: -6, d: 4 },
  prisonerJoined: { l: 'we won someone over', m: 6, d: 3 },
  auroraWonder: { l: 'the sky danced', m: 8, d: 1.5 },
  eclipseGloom: { l: 'unnatural darkness', m: -4, d: 1 },
  blightDespair: { l: 'the crops are dying', m: -6, d: 3 },
  harvestJoy: { l: 'a fine harvest', m: 6, d: 2.5 },
  foundingDay: { l: 'Founding Day!', m: 10, d: 1.5 },
  inspired: { l: 'inspired!', m: 8, d: 2 },
  craftedMasterwork: { l: 'I made a masterwork', m: 10, d: 5 },
  nuzzled: { l: 'animal nuzzle', m: 4, d: 0.7, st: 3 },
  petDied: { l: 'our animal died', m: -8, d: 6 },
  petGift: { l: 'the cat brought me a "gift"', m: 3, d: 1 },
  sleepInterrupted: { l: 'the baby cried all night', m: -5, d: 0.8 },
  newBabyMine: { l: 'my child is born!', m: 14, d: 6 },
  newBabyColony: { l: 'a child was born here', m: 6, d: 3 },
  childBirthday: { l: 'the little one is growing', m: 4, d: 1.5 },
  remembrance: { l: 'remembering the dead', m: -5, d: 1 },
  paidRespects: { l: 'visited the grave', m: 4, d: 1.5 },
  wellTended: { l: 'well cared for', m: 4, d: 1.5 },
  imprisoned: { l: 'locked in a cell', m: -10, d: 1, st: 1 },
  treatedFairly: { l: 'my captors are decent', m: 6, d: 2 },
  fledInTerror: { l: 'ran for my life', m: -6, d: 2 },
  survivedBerserk: { l: 'lost myself in rage', m: -4, d: 2 },
  catharsis: { l: 'catharsis', m: 12, d: 2.5 },
  firesMesmerize: { l: 'the beautiful flames', m: 6, d: 1 },
  ateGoodMealCooked: { l: 'they liked my cooking', m: 3, d: 1, st: 2 },
  vaultDread: { l: 'something behind that door', m: -3, d: 2 },
  vaultTreasure: { l: 'the vault made us rich', m: 8, d: 4 },
  wandererReturned: { l: 'they came back to us', m: 8, d: 4 },
  newWorldHope: { l: 'we survived the crash', m: 12, d: 6 },
};

const PLANTS = {
  grass: { n: 'grass', wild: true, growD: 3, decor: true },
  bush: { n: 'berry bush', wild: true, growD: 6, food: { item: 'berries', qty: 7 } },
  healrootW: { n: 'wild healroot', wild: true, growD: 8, food: { item: 'herbal', qty: 2 } },
  pine: { n: 'pine', wild: true, tree: true, growD: 18, wood: 20 },
  oak: { n: 'oak', wild: true, tree: true, growD: 24, wood: 28 },
  birch: { n: 'birch', wild: true, tree: true, growD: 14, wood: 15 },
  rice: { n: 'rice', crop: true, growD: 3.5, food: { item: 'rawVeg', qty: 5 } },
  potato: { n: 'potatoes', crop: true, growD: 5.5, food: { item: 'rawVeg', qty: 7 }, hardy: true },
  corn: { n: 'corn', crop: true, growD: 10, food: { item: 'rawVeg', qty: 13 } },
  healroot: { n: 'healroot', crop: true, growD: 7, food: { item: 'herbal', qty: 3 } },
  cotton: { n: 'cotton', crop: true, growD: 6.5, food: { item: 'cloth', qty: 4 } },
  hops: { n: 'hops', crop: true, growD: 5.5, food: { item: 'hops', qty: 6 } },
  flowers: { n: 'wildflowers', wild: true, growD: 4, decor: true, beauty: 2 },
};

const ANIMALS = {
  deer: { n: 'deer', sz: 1.0, hp: 36, dmg: 5, spd: 1.6, meat: 22, leather: 6, retaliate: 0.05 },
  hare: { n: 'hare', sz: 0.4, hp: 8, dmg: 1, spd: 1.9, meat: 5, retaliate: 0 },
  boar: { n: 'wild boar', sz: 0.9, hp: 34, dmg: 9, spd: 1.3, meat: 20, leather: 5, retaliate: 0.5 },
  turkey: { n: 'turkey', sz: 0.55, hp: 12, dmg: 2, spd: 1.0, meat: 9, retaliate: 0.05 },
  fox: { n: 'fox', sz: 0.55, hp: 16, dmg: 5, spd: 1.7, meat: 8, leather: 3, retaliate: 0.15 },
  wolf: { n: 'timber wolf', sz: 0.85, hp: 30, dmg: 11, spd: 1.7, meat: 14, leather: 4, predator: true, pack: true, retaliate: 0.7 },
  bear: { n: 'grizzly bear', sz: 1.5, hp: 80, dmg: 17, spd: 1.2, meat: 40, leather: 10, predator: true, rare: true, retaliate: 0.95 },
  cougar: { n: 'cougar', sz: 0.9, hp: 32, dmg: 13, spd: 1.8, meat: 16, leather: 5, predator: true, rare: true, retaliate: 0.8 },
  muffalo: { n: 'muffalo', sz: 1.4, hp: 70, dmg: 10, spd: 0.9, meat: 36, leather: 12, retaliate: 0.4 },
  dog: { n: 'dog', sz: 0.75, hp: 30, dmg: 8, spd: 1.7, meat: 0, petable: true, guard: true },
  cat: { n: 'cat', sz: 0.45, hp: 14, dmg: 4, spd: 1.8, meat: 0, petable: true, mouser: true },
};

const WEAPONS = {
  fists: { n: 'fists', melee: true, dmg: 4, cd: 5, v: 0 },
  knife: { n: 'knife', melee: true, dmg: 7, cd: 4, v: 20, craft: { tech: 'smithing', cost: { steel: 4 } } },
  club: { n: 'club', melee: true, dmg: 9, cd: 7, v: 10, craft: { cost: { wood: 8 } } },
  spear: { n: 'spear', melee: true, dmg: 11, cd: 8, v: 35, craft: { tech: 'smithing', cost: { wood: 6, steel: 4 } } },
  machete: { n: 'machete', melee: true, dmg: 12, cd: 7, v: 45, craft: { tech: 'smithing', cost: { steel: 8 } } },
  bow: { n: 'short bow', dmg: 9, rng: 14, cd: 10, acc: 0.55, v: 30, craft: { cost: { wood: 12 } } },
  pistol: { n: 'autopistol', dmg: 9, rng: 16, cd: 6, acc: 0.6, v: 90 },
  revolver: { n: 'revolver', dmg: 11, rng: 17, cd: 8, acc: 0.66, v: 110, craft: { tech: 'gunsmithing', cost: { steel: 20, wood: 3 } } },
  rifle: { n: 'bolt rifle', dmg: 15, rng: 24, cd: 12, acc: 0.72, v: 180, craft: { tech: 'gunsmithing', cost: { steel: 28, wood: 6 } } },
  shotgun: { n: 'shotgun', dmg: 16, rng: 11, cd: 10, acc: 0.78, v: 160 },
};

const APPAREL = {
  rags: { n: 'rags', ins: 2, armor: 0, v: 4 },
  clothes: { n: 'simple clothes', ins: 7, armor: 0.05, v: 30, craft: { tech: 'tailoring', cost: { cloth: 12 } } },
  coat: { n: 'leather coat', ins: 14, armor: 0.12, v: 70, craft: { tech: 'tailoring', cost: { leather: 14 } } },
  parka: { n: 'parka', ins: 22, armor: 0.08, v: 100, craft: { tech: 'tailoring', cost: { cloth: 10, leather: 8 } } },
  flak: { n: 'flak vest', ins: 4, armor: 0.32, v: 160 },
};

// rotD: days until spoiled at mild temps (freezing pauses, larder slows).
const ITEMS = {
  wood: { n: 'wood', v: 1.2, stack: 75 },
  stone: { n: 'stone blocks', v: 1.0, stack: 75 },
  chunk: { n: 'stone chunks', v: 0.4, stack: 25 },
  steel: { n: 'steel', v: 2.2, stack: 75 },
  gold: { n: 'gold', v: 9, stack: 40 },
  silver: { n: 'silver', v: 1, stack: 200 },
  cloth: { n: 'cloth', v: 1.6, stack: 100 },
  leather: { n: 'leather', v: 1.9, stack: 100 },
  herbal: { n: 'herbal medicine', v: 4, stack: 25, med: 0.7 },
  medkit: { n: 'medicine kit', v: 18, stack: 25, med: 1.0 },
  berries: { n: 'berries', v: 0.9, stack: 50, food: 0.18, raw: true, rotD: 8 },
  rawVeg: { n: 'raw vegetables', v: 1.1, stack: 75, food: 0.2, raw: true, rotD: 14 },
  rawMeat: { n: 'raw meat', v: 1.4, stack: 75, food: 0.2, raw: true, rotD: 5 },
  mealSimple: { n: 'simple meals', v: 4, stack: 20, food: 0.9, rotD: 6 },
  mealFine: { n: 'fine meals', v: 8, stack: 20, food: 0.92, rotD: 6 },
  mealPack: { n: 'packaged survival meals', v: 5, stack: 40, food: 0.85 },
  hops: { n: 'hops', v: 0.7, stack: 75, rotD: 10 },
  beer: { n: 'beer', v: 3, stack: 40 },
  // container kinds — real value lives in meta
  weaponItem: { n: 'weapon', v: 0, stack: 1 },
  apparelItem: { n: 'apparel', v: 0, stack: 1 },
  corpse: { n: 'corpse', v: 0, stack: 1 },
};

// Buildings & furniture. size defaults 1x1. walk: pawns can walk through. hp, flam(mability).
const BUILDINGS = {
  floorWood: { n: 'wood floor', cost: { wood: 2 }, wk: 4, hp: 1, flam: 0.4, v: 2, floor: 1, walk: true, cat: 'structure' },
  floorStone: { n: 'stone floor', cost: { stone: 2 }, wk: 6, hp: 1, flam: 0, v: 3, floor: 2, walk: true, cat: 'structure' },
  wallWood: { n: 'wooden wall', cost: { wood: 5 }, wk: 14, hp: 120, flam: 0.9, v: 6, block: true, cat: 'structure' },
  wallStone: { n: 'stone wall', cost: { stone: 6 }, wk: 22, hp: 320, flam: 0, v: 9, block: true, cat: 'structure' },
  doorWood: { n: 'wooden door', cost: { wood: 8 }, wk: 18, hp: 100, flam: 0.9, v: 9, door: true, walk: true, cat: 'structure' },
  doorStone: { n: 'stone door', cost: { stone: 9 }, wk: 26, hp: 260, flam: 0, v: 13, door: true, walk: true, cat: 'structure' },
  bed: { n: 'bed', cost: { wood: 18 }, wk: 20, hp: 80, flam: 0.8, v: 24, bed: true, restQ: 1.0, walk: true, cat: 'furniture' },
  doubleBed: { n: 'double bed', cost: { wood: 26 }, wk: 26, hp: 90, flam: 0.8, v: 40, bed: true, double: true, restQ: 1.05, walk: true, cat: 'furniture' },
  crib: { n: 'crib', cost: { wood: 10 }, wk: 12, hp: 50, flam: 0.8, v: 14, bed: true, crib: true, restQ: 1.0, walk: true, cat: 'furniture' },
  bedroll: { n: 'straw pallet', cost: { wood: 4 }, wk: 6, hp: 30, flam: 0.9, v: 8, bed: true, restQ: 0.85, walk: true, cat: 'furniture' },
  table: { n: 'table', cost: { wood: 14 }, wk: 14, hp: 90, flam: 0.8, v: 18, table: true, walk: true, cat: 'furniture' },
  stool: { n: 'stool', cost: { wood: 5 }, wk: 6, hp: 40, flam: 0.8, v: 6, seat: true, walk: true, cat: 'furniture' },
  campfire: { n: 'campfire', cost: { wood: 6 }, wk: 4, hp: 40, flam: 0, v: 4, heat: 14, light: 5, fire: true, cook: 0.7, walk: true, cat: 'production' },
  hearth: { n: 'stone hearth', cost: { stone: 12 }, wk: 18, hp: 140, flam: 0, v: 20, heat: 22, light: 5, fire: true, walk: true, cat: 'furniture' },
  torch: { n: 'torch post', cost: { wood: 4 }, wk: 4, hp: 30, flam: 0.2, v: 3, light: 4, fire: true, walk: false, cat: 'decor' },
  stove: { n: 'wood stove', cost: { steel: 12, stone: 6 }, wk: 26, hp: 140, flam: 0, v: 45, cook: 1.0, walk: true, cat: 'production' },
  butcher: { n: 'butcher block', cost: { wood: 12 }, wk: 14, hp: 90, flam: 0.6, v: 16, butcher: true, walk: true, cat: 'production' },
  craftSpot: { n: 'crafting spot', cost: { wood: 2 }, wk: 3, hp: 30, flam: 0.4, v: 3, bench: ['stonecutting'], walk: true, cat: 'production' },
  researchDesk: { n: 'research desk', cost: { wood: 20, steel: 4 }, wk: 24, hp: 100, flam: 0.7, v: 40, research: true, walk: true, cat: 'production' },
  workbench: { n: 'workbench', cost: { wood: 18, steel: 6 }, wk: 24, hp: 110, flam: 0.7, v: 40, bench: ['stonecutting', 'smithing'], walk: true, cat: 'production' },
  tailorBench: { n: 'tailoring bench', cost: { wood: 16 }, wk: 20, hp: 100, flam: 0.8, v: 34, bench: ['tailoring'], walk: true, cat: 'production' },
  artBench: { n: "sculptor's bench", cost: { wood: 16, stone: 6 }, wk: 22, hp: 100, flam: 0.6, v: 40, bench: ['art'], walk: true, cat: 'production' },
  brewery: { n: 'brewery', cost: { wood: 22, steel: 4 }, wk: 26, hp: 110, flam: 0.7, v: 44, bench: ['brewing'], walk: true, cat: 'production' },
  horseshoes: { n: 'horseshoes pin', cost: { steel: 2 }, wk: 6, hp: 30, flam: 0, v: 8, rec: 'horseshoes', walk: true, cat: 'decor' },
  gameTable: { n: 'game table', cost: { wood: 16 }, wk: 16, hp: 80, flam: 0.8, v: 24, rec: 'games', walk: true, cat: 'furniture' },
  sandbag: { n: 'barricade', cost: { wood: 4 }, wk: 10, hp: 160, flam: 0.2, v: 6, cover: 0.5, walk: true, cat: 'defense' },
  turret: { n: 'gun turret', cost: { steel: 40, stone: 6 }, wk: 42, hp: 230, flam: 0, v: 130, turret: { dmg: 11, rng: 19, cd: 9, acc: 0.6 }, cat: 'defense' },
  grave: { n: 'grave', cost: {}, wk: 22, hp: 999, flam: 0, v: 2, grave: true, walk: true, cat: 'decor' },
  sculpture: { n: 'sculpture', cost: { stone: 10 }, wk: 0, hp: 120, flam: 0, v: 60, beauty: 6, cat: 'decor' },
  petBed: { n: 'animal bed', cost: { cloth: 8 }, wk: 8, hp: 40, flam: 0.9, v: 10, petBed: true, walk: true, cat: 'furniture' },
  flowerbed: { n: 'flower bed', cost: {}, wk: 8, hp: 20, flam: 0.4, v: 6, beauty: 3, walk: true, cat: 'decor' },
};

const TECHS = {
  stonecutting: { n: 'Stonecutting', d: 'cutting usable blocks from rough stone', days: 4 },
  smithing: { n: 'Smithing', d: 'forging steel tools and blades', days: 6, req: 'stonecutting' },
  tailoring: { n: 'Tailoring', d: 'proper clothes from cloth and leather', days: 5 },
  medicine: { n: 'Medicine production', d: 'distilling true medicine from healroot', days: 8, req: 'tailoring' },
  brewing: { n: 'Brewing', d: 'the ancient consolation of beer', days: 6 },
  artistry: { n: 'Artistry', d: 'sculpture, and the keeping of memory in stone', days: 7, req: 'stonecutting' },
  fortification: { n: 'Fortification', d: 'stone walls and killing fields', days: 6, req: 'stonecutting' },
  gunsmithing: { n: 'Gunsmithing', d: 'rifled barrels, machined at home', days: 12, req: 'smithing' },
};

const BIOMES = {
  temperate: { n: 'temperate forest', tBase: 13, tSwing: 15, trees: 0.11, bushes: 0.02, water: 0.5, groundTint: [104, 128, 74] },
  boreal: { n: 'boreal forest', tBase: 4, tSwing: 19, trees: 0.14, bushes: 0.012, water: 0.45, groundTint: [92, 116, 78] },
  arid: { n: 'arid shrubland', tBase: 21, tSwing: 12, trees: 0.045, bushes: 0.014, water: 0.3, groundTint: [140, 128, 82] },
};

const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
// Seasonal temperature offsets (fraction of biome tSwing)
const SEASON_TEMP = { Spring: 0.1, Summer: 1.0, Fall: -0.1, Winter: -1.0 };

const BAL = {
  MIN_PER_DAY: 1440,
  DAYS_PER_SEASON: 8,
  START_YEAR: 5502,
  MAP_W: 96, MAP_H: 96,

  // Needs drain per minute (0..1 scale)
  hungerPerMin: 1 / 1150,
  restPerMin: 1 / 1250,
  restRecoverMult: 5.2,      // sleeping recovers this × drain
  recPerMin: 1 / 1700,
  eatAt: 0.34, sleepAt: 0.16, mealNutrition: 0.92,
  starveDmgPerHour: 1.6,

  moodBase: 47,
  breakMinor: 32, breakMajor: 19, breakExtreme: 7,
  breakCheckPerHour: 0.24,   // chance per hour below threshold

  childAgeMult: 8,           // children age faster (frontier metabolism)
  adultAt: 14, workAt: 7, oldAge: 62,

  cropsPerColonist: 20,
  mealsLow: 4,               // per colonist: cook when below
  woodLow: 60,

  wealthBase: 1800,
  raidBase: 32,              // points
  raidPerWealth: 1 / 400,
  raidPerPawn: 14,
  raidPointHp: 1.0,

  popSoftCap: 13,

  tendBase: 0.35,            // base tend quality
  infectChance: 0.16,        // per untended wound-day
  immunityPerDayBed: 0.45,

  tempComfyLo: 13, tempComfyHi: 29,

  fireSpreadPerMin: 0.012,
  rainExtinguishMult: 3.5,

  autosaveEveryDays: 1,
};

const ICONS = {
  raid: '⚔️', death: '🕯️', wedding: '💍', birth: '👶', joy: '✨', bad: '⚠️', fire: '🔥',
  sick: '🤒', food: '🍲', build: '🔨', animal: '🐾', trade: '🧺', storm: '⛈️', cold: '❄️',
  heat: '☀️', love: '❤️', break: '😡', grave: '🪦', research: '📖', art: '🗿', beer: '🍺',
  baby: '🍼', pet: '🐕', star: '🌠', arrive: '🚶', leave: '🚪', heal: '🩹', hunt: '🏹',
};

Object.assign(globalThis, {
  SKILLS, WORKTAGS, TRAITS, TRAIT_KEYS, BACKSTORIES, THOUGHTS, PLANTS, ANIMALS,
  WEAPONS, APPAREL, ITEMS, BUILDINGS, TECHS, BIOMES, SEASONS, SEASON_TEMP, BAL, ICONS,
});
