// social.js — opinions, chats, romance, marriage, fights, gatherings, births.
// Most of the long-arc drama comes from here.

const Social = {
  // ---- opinions ----------------------------------------------------------
  opinion(a, b) {
    if (!a || !b || a === b) return 0;
    let op = (U.hash2(Math.min(a.id, b.id), Math.max(a.id, b.id)) * 26 - 13); // innate chemistry
    op += a.ops[b.id] || 0;
    for (const t of b.traits) op += TRAITS[t].opin || 0;
    if (a.loverId === b.id) op += 35;
    if (a.spouseId === b.id) op += 45;
    if (a.family.mo === b.id || a.family.fa === b.id) op += 30;
    if (a.family.kids.includes(b.id)) op += 35;
    if (b.family.mo && b.family.mo === a.family.mo && a.id !== b.id) op += 15; // siblings
    return Math.round(U.clamp(op, -100, 100));
  },

  changeOp(a, b, delta) {
    a.ops[b.id] = U.clamp((a.ops[b.id] || 0) + delta, -85, 85);
  },

  relLabel(world, a, b) {
    if (a.spouseId === b.id) return 'spouse';
    if (a.loverId === b.id) return 'lover';
    if (a.family.mo === b.id) return 'mother';
    if (a.family.fa === b.id) return 'father';
    if (a.family.kids.includes(b.id)) return 'child';
    if (b.family.mo && b.family.mo === a.family.mo) return 'sibling';
    const op = Social.opinion(a, b);
    if (op <= -45) return 'nemesis';
    if (op <= -22) return 'rival';
    if (op >= 55) return 'close friend';
    if (op >= 25) return 'friend';
    return 'acquaintance';
  },

  eligibleRomance(world, a, b) {
    if (a.stage(world) !== 'adult' || b.stage(world) !== 'adult') return false;
    if (a.family.mo === b.id || a.family.fa === b.id || a.family.kids.includes(b.id)) return false;
    if (b.family.mo && b.family.mo === a.family.mo) return false;
    if (a.prisoner !== b.prisoner) return false;
    // orientation via stable hash: 0..1
    const orient = (p) => U.hash2(p.id, 777);
    const likes = (p, o) => {
      const h = orient(p);
      if (p.gender === 'nb' || o.gender === 'nb') return h > 0.25;
      if (h < 0.75) return p.gender !== o.gender;   // straight
      if (h < 0.9) return p.gender === o.gender;    // gay
      return true;                                   // bi
    };
    return likes(a, b) && likes(b, a);
  },

  attraction(world, a, b) {
    if (!Social.eligibleRomance(world, a, b)) return 0;
    let s = U.hash2(a.id * 3, b.id * 7) * 0.7;
    const ageGap = Math.abs(a.ageYears(world) - b.ageYears(world));
    s -= ageGap * 0.01;
    if (b.hasTrait('magnetic')) s += 0.2;
    if (b.hasTrait('offputting')) s -= 0.2;
    s += Social.opinion(a, b) / 250;
    return U.clamp(s, 0, 1);
  },

  // ---- one social interaction between adjacent-ish pawns ------------------
  interact(world, a, b, context) {
    if (a.dead || b.dead || a.downed || b.downed) return null;
    const rng = world.rng;
    const opAB = Social.opinion(a, b), opBA = Social.opinion(b, a);
    const options = [];
    options.push({ k: 'chat', w: 10 });
    if (opAB >= 20) options.push({ k: 'deep', w: 4 });
    options.push({ k: 'joke', w: 3 });
    if (a.hasTrait('kind')) options.push({ k: 'kind', w: 5 });
    if (a.hasTrait('bard')) options.push({ k: 'tale', w: 4 });
    if (a.hasTrait('abrasive')) options.push({ k: 'insult', w: 4 });
    if (opAB <= -15) options.push({ k: 'insult', w: 3 + (a.hasTrait('volatile') ? 3 : 0) });
    const attract = Social.attraction(world, a, b);
    const single = !a.loverId && !a.spouseId;
    if (attract > 0.22 && (single || (a.hasTrait('romantic') && Social.opinion(a, world.byId[a.spouseId || a.loverId]) < 10))) {
      options.push({ k: 'flirt', w: 2 + attract * 4 + (a.hasTrait('romantic') ? 3 : 0) });
    }
    const choice = rng.pickw(options, o => o.w).k;
    const bubbleIcon = { chat: '💬', deep: '💬', joke: '😄', kind: '💛', tale: '📖', insult: '💢', flirt: '💘' }[choice];
    if (bubbleIcon) world.fx.push({ kind: 'bubble', icon: bubbleIcon, x: a.x, y: a.y, t: world.t });

    switch (choice) {
      case 'chat':
        Social.changeOp(a, b, rng.ri(1, 3)); Social.changeOp(b, a, rng.ri(1, 3));
        if (rng.chance(0.25)) { a.addThought(world, 'goodChat'); b.addThought(world, 'goodChat'); }
        return { kind: 'chat' };
      case 'deep':
        Social.changeOp(a, b, rng.ri(3, 6)); Social.changeOp(b, a, rng.ri(3, 6));
        a.addThought(world, 'goodChat'); b.addThought(world, 'goodChat');
        return { kind: 'chat' };
      case 'joke': {
        const lands = rng.chance(0.75);
        if (lands) {
          Social.changeOp(b, a, rng.ri(2, 5));
          b.needs.rec = Math.min(1, b.needs.rec + 0.06);
          a.needs.rec = Math.min(1, a.needs.rec + 0.04);
        }
        return { kind: lands ? 'joke' : 'chat' };
      }
      case 'kind':
        b.addThought(world, 'kindWords', { who: a.id });
        Social.changeOp(b, a, rng.ri(3, 7));
        return { kind: 'kind' };
      case 'tale':
        b.addThought(world, 'heardTales', { who: a.id });
        Social.changeOp(b, a, rng.ri(2, 5));
        return { kind: 'tale' };
      case 'insult': {
        b.addThought(world, 'insulted', { who: a.id });
        Social.changeOp(b, a, -rng.ri(5, 10));
        const fightRisk = (b.hasTrait('volatile') ? 0.25 : 0.06) + (b.hasTrait('brawler') ? 0.15 : 0) + (opBA < -30 ? 0.2 : 0);
        if (b.canFight(world) && a.canFight(world) && rng.chance(fightRisk)) Social.socialFight(world, b, a);
        else if (rng.chance(0.12)) Chron.log(world, Chron.pick(world, [
          `${a.label()} needled ${b.label()} about ${rng.pick(['the snoring', 'that haircut', 'the cooking', 'old debts', 'nothing at all'])}. ${b.label()} did not laugh.`,
          `Sharp words between ${a.label()} and ${b.label()} over ${rng.pick(['a borrowed knife', 'whose turn it was to haul', 'an old grudge', 'a spilled meal'])}.`,
        ]), { icon: '💢', tone: 'bad' });
        return { kind: 'insult' };
      }
      case 'flirt': {
        const spouseOrLover = a.spouseId || a.loverId;
        const bAvailable = !b.loverId && !b.spouseId;
        const recept = Social.attraction(world, b, a) * (0.5 + opBA / 120) * (bAvailable ? 1 : 0.15);
        if (rng.chance(U.clamp(recept + a.skill('Social') * 0.02, 0.05, 0.9))) {
          b.addThought(world, 'courted', { who: a.id });
          Social.changeOp(b, a, rng.ri(3, 8)); Social.changeOp(a, b, rng.ri(2, 6));
          const already = a.loverId === b.id;
          if (!already && rng.chance(0.22 + attract * 0.2)) {
            if (spouseOrLover || b.loverId || b.spouseId) Social.beginAffair(world, a, b);
            else Social.beginRomance(world, a, b);
          }
          return { kind: 'flirt' };
        } else {
          a.addThought(world, 'rebuffed', { who: b.id });
          Social.changeOp(b, a, -3);
          if (rng.chance(0.3)) Chron.log(world, `${a.label()} tried ${a.his} luck with ${b.label()}, and was gently turned down.`, { icon: '💔', tone: 'neutral' });
          return { kind: 'rebuff' };
        }
      }
    }
    return null;
  },

  beginRomance(world, a, b) {
    a.loverId = b.id; b.loverId = a.id;
    a.addThought(world, 'newLove', { who: b.id }); b.addThought(world, 'newLove', { who: a.id });
    a.addStory(world, `Fell in love with ${b.label()}`); b.addStory(world, `Fell in love with ${a.label()}`);
    Chron.log(world, Chron.pick(world, [
      `${a.label()} and ${b.label()} have fallen in love. The whole colony pretends to be surprised.`,
      `Something has bloomed between ${a.label()} and ${b.label()} — they were seen walking together at dusk, shoulders touching.`,
      `${a.label()} and ${b.label()} are lovers now. ${world.rng.chance(0.5) ? 'It started over a shared meal and never really stopped.' : 'Some things even a deathworld cannot prevent.'}`,
    ]), { icon: ICONS.love, tone: 'good', major: true, at: a });
    Chron.remember(world, { kind: 'romance', text: `${a.label()} and ${b.label()} fell in love`, pawns: [a.id, b.id] });
    Renderer.focus(world, a.x, a.y, 3, `${a.label()} ♥ ${b.label()}`);
  },

  beginAffair(world, a, b) {
    // Secret lovers; may be discovered.
    world.affairs.push({ a: a.id, b: b.id, started: world.day });
    a.addThought(world, 'newLove', { who: b.id }); b.addThought(world, 'newLove', { who: a.id });
    if (a.spouseId || a.loverId) a.addThought(world, 'guiltyAffair');
    if (b.spouseId || b.loverId) b.addThought(world, 'guiltyAffair');
    Chron.log(world, `${a.label()} and ${b.label()} have been lingering in each other's company... though ${a.label()} ${a.gender === 'nb' ? 'are' : 'is'} not free.`, { icon: '🤫', tone: 'bad' });
  },

  tickAffairsDaily(world) {
    for (let i = world.affairs.length - 1; i >= 0; i--) {
      const aff = world.affairs[i];
      const a = world.byId[aff.a], b = world.byId[aff.b];
      if (!a || !b || a.dead || b.dead) { world.affairs.splice(i, 1); continue; }
      if (world.rng.chance(0.18)) { // discovered
        world.affairs.splice(i, 1);
        const wronged = world.byId[a.spouseId || a.loverId] || world.byId[b.spouseId || b.loverId];
        if (wronged && !wronged.dead) {
          const cheater = (a.spouseId === wronged.id || a.loverId === wronged.id) ? a : b;
          const other = cheater === a ? b : a;
          wronged.addThought(world, 'cheatedOn', { who: cheater.id });
          Social.changeOp(wronged, cheater, -45); Social.changeOp(wronged, other, -35);
          Chron.log(world, `${wronged.label()} caught ${cheater.label()} with ${other.label()}. ${U.cap(wronged.he)} said nothing at first. That was worse.`, { icon: '💔', tone: 'bad', major: true, at: wronged });
          Chron.remember(world, { kind: 'scandal', text: `${cheater.label()}'s affair with ${other.label()} came to light`, pawns: [cheater.id, other.id, wronged.id] });
          if (wronged.canFight(world) && cheater.canFight(world) && world.rng.chance(0.5)) Social.socialFight(world, wronged, cheater);
          if (wronged.spouseId === cheater.id && world.rng.chance(0.6)) Social.divorce(world, wronged, cheater);
          else if (wronged.loverId === cheater.id) Social.breakup(world, wronged, cheater);
        }
      }
    }
  },

  breakup(world, a, b) {
    if (a.loverId === b.id) a.loverId = null;
    if (b.loverId === a.id) b.loverId = null;
    a.addThought(world, 'brokeUp'); b.addThought(world, 'brokeUp');
    Social.changeOp(a, b, -20); Social.changeOp(b, a, -20);
    Chron.log(world, `${a.label()} and ${b.label()} have parted ways. The colony feels a little colder for it.`, { icon: '💔', tone: 'bad', major: true });
  },

  divorce(world, a, b) {
    if (a.spouseId === b.id) a.spouseId = null;
    if (b.spouseId === a.id) b.spouseId = null;
    a.loverId = null; b.loverId = null;
    a.addThought(world, 'divorced'); b.addThought(world, 'divorced');
    Chron.log(world, `${a.label()} and ${b.label()} are divorced. ${world.rng.chance(0.5) ? 'The rings went into the river.' : 'They divide the colony between them now, one cold room at a time.'}`, { icon: '💔', tone: 'bad', major: true });
    Chron.remember(world, { kind: 'divorce', text: `${a.label()} and ${b.label()} divorced`, pawns: [a.id, b.id] });
  },

  // Daily relationship upkeep: decay, proposals, conception.
  tickRelationsDaily(world) {
    const rng = world.rng;
    const colonists = world.pawns.filter(p => p.isColonist());
    for (const p of colonists) {
      for (const idStr of Object.keys(p.ops)) {
        p.ops[idStr] *= 0.985;
        if (Math.abs(p.ops[idStr]) < 0.5) delete p.ops[idStr];
      }
      // proposals
      if (p.loverId && !p.spouseId) {
        const lover = world.byId[p.loverId];
        if (lover && !lover.dead && !lover.spouseId && Social.opinion(p, lover) > 40 && Social.opinion(lover, p) > 30 && rng.chance(0.08)) {
          if (rng.chance(0.85)) {
            world.weddingQueue.push({ a: p.id, b: lover.id, day: world.day + 1 });
            Chron.log(world, Chron.pick(world, [
              `${p.label()} proposed to ${lover.label()}${rng.chance(0.5) ? ' with a ring hammered from a silver coin' : ' beneath the ' + (world.season === 'Winter' ? 'cold stars' : 'open sky')}. ${U.cap(lover.he)} said yes.`,
              `On one knee in the ${rng.pick(['dirt', 'kitchen', 'field'])}, ${p.label()} asked ${lover.label()} to marry ${p.him}. The answer was never in doubt.`,
            ]), { icon: ICONS.wedding, tone: 'good', major: true, at: p });
            Renderer.focus(world, p.x, p.y, 4, `${p.label()} proposes!`);
          } else {
            p.addThought(world, 'rebuffed', { who: lover.id });
            Chron.log(world, `${p.label()} proposed to ${lover.label()} — and was told "not yet." The words hung in the air for days.`, { icon: '💔', tone: 'bad', major: true });
          }
        }
      }
      // conception
      if (p.gender === 'f' && !p.pregnant && p.stage(world) === 'adult' && p.ageYears(world) <= 44) {
        const mate = world.byId[p.spouseId || p.loverId];
        if (mate && !mate.dead && mate.isColonist() && mate.gender === 'm') {
          const foodOk = Things.countFood(world) > colonists.length * 2;
          const popOk = colonists.length < BAL.popSoftCap + 2;
          if (foodOk && popOk && rng.chance(p.spouseId ? 0.09 : 0.035)) {
            p.pregnant = { by: mate.id, due: world.day + 10 };
            Chron.log(world, Chron.pick(world, [
              `${p.label()} is expecting a child with ${mate.label()}. A new thread begins in the chronicle.`,
              `Quiet news over breakfast: ${p.label()} and ${mate.label()} are going to be parents.`,
            ]), { icon: ICONS.baby, tone: 'good', major: true });
          }
        }
      }
    }
    Social.tickAffairsDaily(world);
  },

  // Weddings kick off late morning, not at the stroke of midnight.
  processWeddings(world) {
    if (world.threat) return;
    for (let i = world.weddingQueue.length - 1; i >= 0; i--) {
      const wq = world.weddingQueue[i];
      if (world.day >= wq.day) {
        world.weddingQueue.splice(i, 1);
        const a = world.byId[wq.a], b = world.byId[wq.b];
        if (a && b && !a.dead && !b.dead && !a.spouseId && !b.spouseId) Social.startWedding(world, a, b);
      }
    }
  },

  giveBirth(world, mother) {
    const father = world.byId[mother.pregnant.by];
    mother.pregnant = null;
    const baby = Pawn.makeBaby(world, mother, father && !father.dead ? father : null);
    world.pawns.push(baby);
    world.byId[baby.id] = baby;
    mother.addThought(world, 'newBabyMine');
    if (father && !father.dead) father.addThought(world, 'newBabyMine');
    for (const p of world.pawns) if (p.isColonist() && p !== mother && p !== father) p.addThought(world, 'newBabyColony');
    mother.addStory(world, `Gave birth to ${baby.name.first}`);
    baby.addStory(world, `Born at ${world.colonyName}`);
    Chron.log(world, Chron.pick(world, [
      `A child is born! ${mother.label()} ${father && !father.dead ? 'and ' + father.label() + ' ' : ''}named ${world.byId[baby.id].gender === 'm' ? 'him' : world.byId[baby.id].gender === 'f' ? 'her' : 'them'} ${baby.name.first}. The whole colony found reasons to walk past the crib today.`,
      `${baby.name.first} ${baby.name.last} came into the world squalling, red-faced, and instantly beloved. Population of ${world.colonyName}: ${world.pawns.filter(p => p.isColonist()).length}.`,
    ]), { icon: ICONS.birth, tone: 'good', major: true, at: mother });
    Chron.remember(world, { kind: 'birth', text: `${baby.name.first} was born to ${mother.label()}`, pawns: [baby.id, mother.id] });
    Chron.maybeChapter(world, 'birth', `A Child of ${world.colonyName}`);
    Renderer.focus(world, mother.x, mother.y, 5, `${baby.name.first} is born!`);
    if (world.rng.chance(0.10)) {
      mother.applyDamage(world, 8, 'bruise', 'a hard labor', { part: 'torso' });
      Chron.log(world, `The birth was hard on ${mother.label()}; ${mother.he} will need rest.`, { icon: ICONS.sick, tone: 'bad' });
    }
    Overseer.noteNewResident(world, baby);
  },

  // ---- fights ------------------------------------------------------------
  socialFight(world, a, b) {
    if (world.fights.some(f => f.a === a.id || f.b === a.id || f.a === b.id || f.b === b.id)) return;
    world.fights.push({ a: a.id, b: b.id, end: world.t + 25 });
    a.job = null; b.job = null;
    Social.changeOp(a, b, -15); Social.changeOp(b, a, -15);
    Chron.log(world, Chron.pick(world, [
      `${a.label()} and ${b.label()} came to blows${world.rng.chance(0.5) ? ' — fists, dust, and words that can\'t be unsaid' : ''}!`,
      `A brawl! ${a.label()} swung first, but ${b.label()} swung better.`,
    ]), { icon: '🥊', tone: 'bad', major: true, at: a });
    Renderer.focus(world, a.x, a.y, 4, `${a.label()} vs ${b.label()}!`);
  },

  tickFights(world) {
    for (let i = world.fights.length - 1; i >= 0; i--) {
      const f = world.fights[i];
      const a = world.byId[f.a], b = world.byId[f.b];
      const over = !a || !b || a.dead || b.dead || a.downed || b.downed || world.t >= f.end;
      if (over) {
        world.fights.splice(i, 1);
        if (a && b && !a.dead && !b.dead) {
          const loser = a.downed ? a : b.downed ? b : (world.rng.chance(0.5) ? a : b);
          Chron.log(world, `The fight between ${a.label()} and ${b.label()} is over. ${loser.label()} came off worse.`, { icon: '🥊', tone: 'neutral' });
        }
        continue;
      }
      // exchange blows every few ticks
      if (world.t % 4 === 0) {
        const attacker = world.rng.chance(0.5) ? a : b;
        const defender = attacker === a ? b : a;
        const dmg = world.rng.ri(2, 5) + (attacker.hasTrait('brawler') ? 2 : 0);
        defender.applyDamage(world, dmg, 'bruise', `${attacker.label()}'s fists`);
      }
      // keep them adjacent
      if (U.dist(a.x, a.y, b.x, b.y) > 1.6) {
        a.x += Math.sign(b.x - a.x) * 0.3; a.y += Math.sign(b.y - a.y) * 0.3;
      }
    }
  },

  // ---- gatherings --------------------------------------------------------
  startGathering(world, type, spot, guests, durMin, meta) {
    const g = { id: U.uid(), type, x: spot.x, y: spot.y, start: world.t, end: world.t + durMin, guests: guests.map(p => p.id), meta: meta || {}, fx: 0 };
    world.gatherings.push(g);
    for (const p of guests) {
      if (p.job && ['sleep', 'patient', 'tendPawn', 'firefight'].includes(p.job.type)) continue;
      p.job = null; // they'll pick up the attend job
    }
    return g;
  },

  startWedding(world, a, b) {
    const spot = world.zones.weddingSpot || world.map.home;
    const guests = world.pawns.filter(p => p.isColonist() && !p.downed);
    const g = Social.startGathering(world, 'wedding', spot, guests, 90, { a: a.id, b: b.id });
    Chron.chapterIfDue(world);
    Chron.log(world, `Today ${a.label()} and ${b.label()} are to be married. Work has stopped; someone found flowers.`, { icon: ICONS.wedding, tone: 'good', major: true, at: spot });
    Renderer.cinematic(world, `The wedding of ${a.label()} & ${b.label()}`, spot, 9);
    return g;
  },

  marry(world, a, b) {
    a.spouseId = b.id; b.spouseId = a.id;
    a.loverId = b.id; b.loverId = a.id;
    a.addThought(world, 'gotMarried'); b.addThought(world, 'gotMarried');
    a.addStory(world, `Married ${b.label()}`); b.addStory(world, `Married ${a.label()}`);
    const vow = Chron.pick(world, [
      `"Until the stars go out," ${a.label()} said. ${b.label()} answered, "Longer."`,
      `They exchanged rings of ${world.rng.pick(['braided wire', 'carved oak', 'hammered silver'])}, and for one afternoon nobody thought about raiders at all.`,
      `${world.rng.pick(['Old', 'Young'])} and battle-scarred and grinning like fools, they said the words.`,
    ]);
    Chron.log(world, `${a.label()} and ${b.label()} are married! ${vow}`, { icon: ICONS.wedding, tone: 'good', major: true });
    Chron.remember(world, { kind: 'wedding', text: `${a.label()} and ${b.label()} were wed`, pawns: [a.id, b.id] });
    Chron.maybeChapter(world, 'wedding', null);
    for (const p of world.pawns) if (p.isColonist() && p !== a && p !== b) p.addThought(world, 'attendedWedding');
    Overseer.wantDoubleRoom(world, a, b);
  },

  startParty(world, reason) {
    const table = Things.findBuilding(world, b => BUILDINGS[b.key].table);
    const spot = table ? { x: table.x, y: table.y } : world.map.home;
    const guests = world.pawns.filter(p => p.isColonist() && !p.downed);
    if (guests.length < 2) return null;
    Social.startGathering(world, 'party', spot, guests, 110, { reason });
    Chron.log(world, Chron.pick(world, [
      `A feast is called${reason ? ' — ' + reason : ''}! The good bowls come out; somebody is frying everything.`,
      `Tonight ${world.colonyName} celebrates${reason ? ': ' + reason : ''}. There is music, if you can call it that.`,
    ]), { icon: '🎉', tone: 'good', major: true });
    return true;
  },

  startFuneral(world, grave, deadLabel) {
    const guests = world.pawns.filter(p => p.isColonist() && !p.downed);
    if (!guests.length) return;
    Social.startGathering(world, 'funeral', { x: grave.x, y: grave.y }, guests, 60, { deadLabel, graveId: grave.id });
    const speaker = guests.reduce((best, p) => p.skill('Social') > (best ? best.skill('Social') : -1) ? p : best, null);
    Chron.log(world, Chron.pick(world, [
      `They buried ${deadLabel} today. ${speaker ? speaker.label() + ' spoke: "' + Chron.eulogyLine(world, deadLabel) + '"' : 'No one could find any words.'}`,
      `A grave for ${deadLabel}. The colony stood in silence while the wind said whatever the wind says.`,
    ]), { icon: ICONS.grave, tone: 'bad', major: true, at: grave });
    Renderer.focus(world, grave.x, grave.y, 6, `Funeral for ${deadLabel}`);
  },

  tickGatherings(world) {
    for (let i = world.gatherings.length - 1; i >= 0; i--) {
      const g = world.gatherings[i];
      if (world.threat || world.t >= g.end) {
        // conclude
        world.gatherings.splice(i, 1);
        const guests = g.guests.map(id => world.byId[id]).filter(p => p && !p.dead);
        if (world.t >= g.end) {
          if (g.type === 'wedding') {
            const a = world.byId[g.meta.a], b = world.byId[g.meta.b];
            if (a && b && !a.dead && !b.dead) Social.marry(world, a, b);
          } else if (g.type === 'party') {
            for (const p of guests) { p.addThought(world, 'attendedParty'); p.needs.rec = Math.min(1, p.needs.rec + 0.5); }
            if (Things.count(world, 'beer') > 0) {
              for (const p of guests) if (world.rng.chance(0.6)) { p.addThought(world, 'hadBeer'); }
              const drank = Math.min(Things.count(world, 'beer'), guests.length);
              let left = drank;
              for (const s of [...world.items]) if (s.kind === 'beer' && left > 0) left -= Things.take(world, s, left);
            }
          } else if (g.type === 'funeral') {
            for (const p of guests) p.addThought(world, 'attendedFuneral');
          } else if (g.type === 'tales') {
            for (const p of guests) { p.addThought(world, 'heardTales'); p.needs.rec = Math.min(1, p.needs.rec + 0.35); }
            for (let x = 0; x < guests.length - 1; x++) Social.changeOp(guests[x], guests[x + 1], 2);
          }
        }
        continue;
      }
      // ambience during gathering: random chats
      if (world.t % 12 === 0 && g.guests.length >= 2) {
        const here = g.guests.map(id => world.byId[id]).filter(p => p && !p.dead && !p.downed && U.dist(p.x, p.y, g.x, g.y) < 6);
        if (here.length >= 2) {
          const a = world.rng.pick(here);
          let b = world.rng.pick(here);
          if (a !== b) Social.interact(world, a, b, 'gathering');
        }
      }
    }
  },

  // Evening fireside tales: small ritual that binds the colony.
  maybeFiresideTales(world) {
    if (world.hourOfDay !== 20 || world.threat || world.gatherings.length) return;
    if (!world.rng.chance(0.30)) return;
    const fire = Things.findBuilding(world, b => (b.key === 'campfire' || b.key === 'hearth'));
    if (!fire) return;
    const guests = world.pawns.filter(p => p.isColonist() && !p.downed && p.stage(world) !== 'baby' && (!p.job || !['sleep', 'patient'].includes(p.job.type)));
    if (guests.length < 3) return;
    Social.startGathering(world, 'tales', { x: fire.x, y: fire.y }, guests, 70, {});
    // most fires burn unrecorded; the chronicle notes only the memorable nights
    if (world.rng.chance(0.4)) {
      const bardP = guests.find(p => p.hasTrait('bard'));
      Chron.log(world, Chron.pick(world, [
        `${bardP ? bardP.label() : world.rng.pick(guests).label()} gathered everyone by the fire and told ${bardP ? 'the old stories' : 'a story that grew with every telling'} — ${world.rng.pick(['the ship that fell', 'the winter of wolves', 'how the colony got its name', 'a love story, badly disguised', 'ghosts, obviously', 'the one about the muffalo and the door'])}.`,
        `Fire, sparks, and stories tonight. Even the sentry leaned in to listen.`,
        `Tales by the fire again. ${world.rng.pick(guests).label()}'s version of the crash gains a new impossible detail every telling, and nobody minds.`,
      ]), { icon: '🔥', tone: 'good' });
    }
  },
};

Object.assign(globalThis, { Social });
