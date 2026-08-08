// names.js — name pools and generators: pawns, colonies, factions, ships, pets, chapter titles.

const NamePools = {
  firstM: ['Abe', 'Ade', 'Alric', 'Ames', 'Ansel', 'Aro', 'Bas', 'Baz', 'Bennet', 'Birch', 'Bo', 'Boone', 'Bram', 'Cael', 'Cassius', 'Cato', 'Cormac', 'Dario', 'Dax', 'Deme', 'Dmitri', 'Eamon', 'Edri', 'Eli', 'Emeka', 'Enzo', 'Ezra', 'Farid', 'Fenn', 'Finn', 'Gideon', 'Grady', 'Hale', 'Haruto', 'Hector', 'Hollis', 'Idris', 'Ike', 'Ilya', 'Ivo', 'Jael', 'Jonas', 'Joss', 'Jun', 'Kae', 'Kaspar', 'Keir', 'Kofi', 'Lazlo', 'Leif', 'Lorcan', 'Lucian', 'Mads', 'Marek', 'Mateo', 'Milo', 'Nash', 'Nico', 'Odin', 'Okoye', 'Orin', 'Osei', 'Otto', 'Pax', 'Quill', 'Rafe', 'Ranit', 'Remy', 'Roan', 'Rustam', 'Sacha', 'Sero', 'Silas', 'Soren', 'Tavish', 'Teo', 'Thane', 'Tobin', 'Ulric', 'Vann', 'Vasco', 'Wade', 'Wren', 'Yusuf', 'Zeke'],
  firstF: ['Ada', 'Adaeze', 'Aki', 'Alba', 'Amara', 'Anouk', 'Ash', 'Astrid', 'Aya', 'Beatrix', 'Bess', 'Briar', 'Calla', 'Cato', 'Ceri', 'Cleo', 'Dara', 'Delia', 'Edda', 'Effie', 'Elke', 'Ember', 'Enid', 'Esme', 'Fara', 'Fern', 'Freya', 'Gilda', 'Greta', 'Hazel', 'Hesper', 'Ines', 'Ingrid', 'Iola', 'Isla', 'Juni', 'Kaia', 'Katya', 'Kesi', 'Lark', 'Leda', 'Liv', 'Lucia', 'Lyra', 'Mabel', 'Maeve', 'Mara', 'Marisol', 'Mercy', 'Mina', 'Nadia', 'Naomi', 'Nell', 'Nia', 'Noor', 'Nova', 'Olena', 'Ona', 'Opal', 'Petra', 'Pia', 'Priya', 'Reva', 'Rhea', 'Romy', 'Rosa', 'Saffron', 'Sana', 'Signe', 'Sol', 'Suki', 'Tamsin', 'Tess', 'Thea', 'Uma', 'Vera', 'Vesna', 'Willa', 'Xiu', 'Yara', 'Zia', 'Zora'],
  firstN: ['Arden', 'Avery', 'Blue', 'Cedar', 'Ellis', 'Ever', 'Gale', 'Hollis', 'Indigo', 'Juniper', 'Kit', 'Lane', 'Marlow', 'Onyx', 'Rain', 'Reese', 'River', 'Rowan', 'Sage', 'Shale', 'Sky', 'Tatum', 'Vesper', 'Winter'],
  last: ['Abara', 'Ashdown', 'Blackwood', 'Bly', 'Bracken', 'Calder', 'Carver', 'Coldstream', 'Crane', 'Cross', 'Dane', 'Draven', 'Duna', 'Eastvale', 'Farrow', 'Fenwick', 'Flint', 'Frost', 'Garrick', 'Glass', 'Greaves', 'Grey', 'Halloran', 'Harrow', 'Hawke', 'Hollow', 'Ibarra', 'Ironwood', 'Kane', 'Keld', 'Kessler', 'Kova', 'Lachlan', 'Larkspur', 'Loam', 'Marsh', 'Mercer', 'Moro', 'Mott', 'Nakamura', 'North', 'Oduya', 'Okafor', 'Ostrander', 'Pike', 'Quist', 'Rell', 'Renata', 'Ridge', 'Rooke', 'Salt', 'Santiago', 'Selby', 'Shaw', 'Sorrel', 'Sparrow', 'Stone', 'Strand', 'Sunder', 'Tanaka', 'Thorn', 'Torres', 'Umber', 'Vale', 'Vann', 'Varga', 'Vesely', 'Volkov', 'Wilder', 'Winters', 'Wolfe', 'Yaro', 'Zhu'],
  nick: ['Ace', 'Badger', 'Bear', 'Bones', 'Bright', 'Crow', 'Dice', 'Digger', 'Dove', 'Echo', 'Ember', 'Flick', 'Fox', 'Grit', 'Gull', 'Hawk', 'Husk', 'Ink', 'Iron', 'Lucky', 'Moss', 'Patch', 'Pepper', 'Pip', 'Quick', 'Rook', 'Rust', 'Scrap', 'Shade', 'Slate', 'Smoke', 'Sparks', 'Stitch', 'Tinker', 'Whisper', 'Wick'],
  pet: ['Barley', 'Biscuit', 'Bramble', 'Bruno', 'Clover', 'Comet', 'Dot', 'Fig', 'Ghost', 'Hazel', 'Juno', 'Kettle', 'Mochi', 'Nutmeg', 'Olive', 'Pebble', 'Pickle', 'Pudding', 'Rascal', 'Sable', 'Scout', 'Soot', 'Tuck', 'Waffles', 'Ziggy'],
  ship: ['Meridian', 'Cormorant', 'Vasilisa', 'Long Dawn', 'Prospect', 'Kestrel', 'Halcyon', 'Perdita', 'Aurora Chase', 'Stellar Rose', 'Cygnus', 'Old Marrow', 'Thessaly', 'Wandering Bell'],
};

const ColonyWords = {
  pre: ['Ash', 'Bright', 'Cinder', 'Clay', 'Cold', 'Dawn', 'Dust', 'Ember', 'Fall', 'Fern', 'Frost', 'Green', 'Grey', 'High', 'Hollow', 'Iron', 'Lark', 'Long', 'Mud', 'New', 'North', 'Oak', 'Rain', 'Red', 'Rust', 'Salt', 'Sky', 'Star', 'Still', 'Stone', 'Thorn', 'Wind'],
  suf: ['barrow', 'bend', 'brook', 'creek', 'fall', 'field', 'ford', 'gate', 'haven', 'hearth', 'hold', 'hollow', 'landing', 'light', 'mark', 'mere', 'perch', 'reach', 'rest', 'ridge', 'root', 'run', 'stead', 'vale', 'watch', 'well'],
  solo: ['Providence', 'Refuge', 'Landfall', 'Second Chance', 'Threshold', 'Solace', 'Homestead', 'Foothold', 'The Claim', 'Last Light', 'First Fire'],
};

const FactionWords = {
  pirateA: ['Crimson', 'Rust', 'Black', 'Broken', 'Ash', 'Iron', 'Grinning', 'Hollow', 'Red', 'Scarred', 'Feral', 'Salt'],
  pirateB: ['Fangs', 'Vultures', 'Jackals', 'Blades', 'Dogs', 'Crows', 'Hooks', 'Reavers', 'Wasps', 'Skulls', 'Serpents', 'Ravagers'],
  tribeA: ['Children', 'Keepers', 'Walkers', 'Singers', 'Riders', 'Watchers', 'Daughters', 'Sons'],
  tribeB: ['Red Moon', 'Deep Root', 'First River', 'Grey Elk', 'Burning Sky', 'Old Stone', 'Silent Pine', 'Broken Star'],
  outlander: ['Combine', 'Compact', 'Freeholds', 'Confederacy', 'Union', 'Charter'],
  outlanderA: ['Northfield', 'Duskvale', 'Twin Rivers', 'Harrowgate', 'Callisto', 'Meridian', 'Far Shore', 'Kereva'],
  pirateTitle: ['Captain', 'Boss', 'Warlord', 'Reaver-King', 'Reaver-Queen', 'Dread'],
};

const ChapterWords = {
  adj: ['Long', 'Silent', 'Burning', 'Hungry', 'Bitter', 'Golden', 'Broken', 'Quiet', 'Red', 'White', 'Gathering', 'Restless', 'Kind', 'Cruel', 'Green'],
  noun: ['Winter', 'Harvest', 'Storm', 'Road', 'Vigil', 'Season', 'Fire', 'Thaw', 'Reckoning', 'Homecoming', 'Siege', 'Garden', 'Silence', 'Dawn', 'Debt', 'Promise'],
};

const Names = {
  pawnFirst(rng, gender) {
    if (gender === 'm') return rng.pick(NamePools.firstM);
    if (gender === 'f') return rng.pick(NamePools.firstF);
    return rng.pick(NamePools.firstN);
  },
  pawnName(rng, gender) {
    const first = Names.pawnFirst(rng, gender);
    const last = rng.pick(NamePools.last);
    const nick = rng.chance(0.22) ? rng.pick(NamePools.nick) : null;
    return { first, last, nick };
  },
  colony(rng) {
    if (rng.chance(0.18)) return rng.pick(ColonyWords.solo);
    const base = rng.pick(ColonyWords.pre) + rng.pick(ColonyWords.suf);
    return rng.chance(0.15) ? 'New ' + base : base;
  },
  faction(rng, kind) {
    if (kind === 'pirate') return 'The ' + rng.pick(FactionWords.pirateA) + ' ' + rng.pick(FactionWords.pirateB);
    if (kind === 'tribe') return rng.pick(FactionWords.tribeA) + ' of the ' + rng.pick(FactionWords.tribeB);
    return rng.pick(FactionWords.outlanderA) + ' ' + rng.pick(FactionWords.outlander);
  },
  pirateTitle(rng) { return rng.pick(FactionWords.pirateTitle); },
  pet(rng) { return rng.pick(NamePools.pet); },
  ship(rng) { return rng.pick(NamePools.ship); },
  chapterTitle(rng, hint) {
    // hint may suggest a noun ("Winter", "Siege"...)
    const noun = hint || rng.pick(ChapterWords.noun);
    const forms = [
      () => 'The ' + rng.pick(ChapterWords.adj) + ' ' + noun,
      () => 'A ' + noun + ' of ' + rng.pick(ChapterWords.noun) + 's',
      () => 'The ' + noun,
      () => rng.pick(ChapterWords.adj) + ' ' + noun,
    ];
    return rng.pick(forms)();
  },
};

Object.assign(globalThis, { NamePools, Names });
