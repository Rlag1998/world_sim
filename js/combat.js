// combat.js — fighting, raids, defense mobilization, hunting, and animal behavior.

const Combat = {
  // ---- threat detection & colony mobilization ----------------------------
  updateThreat(world) {
    const hostiles = world.pawns.filter(q => !q.dead && !q.downed && !q.prisoner && (q.faction === 'pirate' || q.faction === 'tribe') && !q.fleeing);
    let manhunters = 0, predatorAttack = false;
    for (const a of world.animals) {
      if (a.dead) continue;
      if (a.manhunter && U.dist(a.x, a.y, world.map.home.x, world.map.home.y) < 19) manhunters++;
      if (a.state === 'attackPawn' && a.target) {
        const victim = world.byId[a.target];
        if (victim && victim.thing === 'pawn' && victim.isColonist && victim.isColonist() && !victim.dead && U.dist(a.x, a.y, victim.x, victim.y) < 16) predatorAttack = true;
      }
    }
    const berserker = world.pawns.some(q => q.isColonist() && q.breaking && q.breaking.kind === 'berserk');
    const newThreat = hostiles.length > 0 || manhunters > 0 || predatorAttack;
    if (newThreat && !world.threat) {
      world.threat = true;
      Overseer.equipFighters(world);
      for (const p of world.pawns) {
        if (!p.isColonist() || p.downed || p.breaking) continue;
        if (p.canFight(world)) { p.mode = 'fight'; Jobs.endJob(world, p); }
        else { p.mode = 'hide'; Jobs.endJob(world, p); }
      }
    } else if (!newThreat && world.threat) {
      world.threat = false;
      for (const p of world.pawns) {
        if (p.mode !== 'normal') { p.mode = 'normal'; Jobs.endJob(world, p); }
        p.station = null;
      }
      if (!berserker) Combat.afterBattle(world);
    }
  },

  afterBattle(world) {
    // count the field
    const raidersDown = world.pawns.filter(q => (q.faction === 'pirate' || q.faction === 'tribe') && q.downed && !q.dead && !q.prisoner).length;
    if (raidersDown > 0) Overseer.considerCaptures(world);
  },

  threatCentroid(world) {
    let sx = 0, sy = 0, n = 0;
    for (const q of world.pawns) {
      if (q.dead || q.prisoner || q.fleeing) continue;
      if (q.faction === 'pirate' || q.faction === 'tribe') { sx += q.x; sy += q.y; n++; }
    }
    for (const a of world.animals) if (a.manhunter && !a.dead) { sx += a.x; sy += a.y; n++; }
    if (!n) return null;
    return { x: sx / n, y: sy / n };
  },

  stationFor(world, p) {
    if (p.station) return p.station;
    const defense = world.zones.defense;
    const fighters = world.pawns.filter(q => q.isColonist() && q.mode === 'fight');
    const myIndex = Math.max(0, fighters.indexOf(p));
    // the fixed firing line only works once walls funnel attackers into it;
    // in the open, form a ring facing the actual threat
    const funneled = world.plan && world.plan.wallAnnounced;
    let useLine = funneled && defense && defense.length;
    if (!funneled && defense && defense.length) {
      const c = Combat.threatCentroid(world);
      if (c) {
        const d0 = defense[0];
        const home = world.map.home;
        // same rough direction as the barricades?
        useLine = (c.y - home.y) * (d0.y - home.y) + (c.x - home.x) * (d0.x - home.x) > 0;
      }
    }
    if (useLine) {
      p.station = defense[myIndex % defense.length];
    } else {
      const c = Combat.threatCentroid(world) || { x: world.map.home.x, y: world.map.home.y - 10 };
      const home = world.map.home;
      const ang = Math.atan2(c.y - home.y, c.x - home.x) + (myIndex - fighters.length / 2) * 0.35;
      const spot = world.map.findSpotNear(Math.round(home.x + Math.cos(ang) * 7), Math.round(home.y + Math.sin(ang) * 7), 5,
        (x, y) => world.map.standable(x, y, world));
      p.station = spot || { x: home.x, y: home.y };
    }
    return p.station;
  },

  safeSpot(world, p) {
    // hide in the biggest indoor room, or at home center
    let best = null;
    for (let r = 1; r < world.map.rooms.length; r++) {
      const room = world.map.rooms[r];
      if (!room || !room.indoor) continue;
      if (!best || room.tiles.length > best.tiles.length) best = room;
    }
    if (best) {
      const i = best.tiles[Math.floor(best.tiles.length / 2)];
      return { x: i % world.map.w, y: Math.floor(i / world.map.w) };
    }
    return { x: world.map.home.x, y: world.map.home.y };
  },

  hostileTargetsFor(world, p) {
    const out = [];
    for (const q of world.pawns) {
      if (q.dead || q.downed || q.prisoner) continue;
      if (p.faction === 'colony' || p.faction === 'outlander') {
        if ((q.faction === 'pirate' || q.faction === 'tribe') && !q.fleeing) out.push(q);
      } else {
        if (q.faction === 'colony' && q.isColonist() && !q.downed) out.push(q);
        else if (q.faction === 'outlander') out.push(q);
      }
    }
    for (const a of world.animals) {
      if (a.dead || a.downed) continue;
      if (p.faction === 'colony' || p.faction === 'outlander') {
        if (a.manhunter) out.push(a);
        else if (a.state === 'attackPawn' && a.target) {
          const victim = world.byId[a.target];
          if (victim && victim.thing === 'pawn' && victim.faction === 'colony') out.push(a); // beast mauling one of ours
        }
      }
      if ((p.faction === 'pirate' || p.faction === 'tribe') && a.tame) out.push(a);
    }
    return out;
  },

  nearestTarget(world, p, maxDist) {
    let best = null, bestD = Infinity;
    for (const t of Combat.hostileTargetsFor(world, p)) {
      const d = U.dist(p.x, p.y, t.x, t.y);
      if (d < bestD && d <= (maxDist || 60)) { bestD = d; best = t; }
    }
    return best;
  },

  // ---- attacks -----------------------------------------------------------
  attack(world, a, t) {
    if (a.cd > 0) return false;
    let wep = a.weaponDef ? a.weaponDef() : { melee: true, dmg: a.def ? a.def().dmg : 5, cd: 8 };
    const dist = U.dist(a.x, a.y, t.x, t.y);
    // shooters in grappling range fight back with the stock of the gun
    if (!wep.melee && wep.rng && dist <= 1.8) wep = { n: wep.n, melee: true, dmg: 7, cd: 5 };
    if (wep.melee || !wep.rng) {
      if (dist > 1.8) return false;
      a.cd = wep.cd;
      let hitChance = 0.75 + (a.skill ? a.skill('Melee') * 0.015 : 0.05);
      if (a.hasTrait && a.hasTrait('brawler')) hitChance += 0.1;
      if (world.rng.chance(U.clamp(hitChance, 0.3, 0.95))) {
        const kind = wep.dmg >= 10 ? 'cut' : 'bruise';
        const dmg = wep.dmg * world.rng.rf(0.75, 1.25) * (a.skill ? (0.8 + a.skill('Melee') * 0.03) : 1);
        t.applyDamage(world, dmg, kind, a.label ? a.label() : 'something', {});
        if (a.gainXp) a.gainXp(world, 'Melee', 60);
        Combat.creditIfKilled(world, a, t);
      }
      world.fx.push({ kind: 'melee', x: t.x, y: t.y, t: world.t });
      return true;
    }
    // ranged
    if (dist > wep.rng || dist < 1.2) return false;
    if (!world.map.hasLOS(a.x, a.y, t.x, t.y, world)) return false;
    a.cd = wep.cd * (a.hasTrait && a.hasTrait('triggerhappy') ? 0.7 : 1);
    let acc = wep.acc * (0.55 + (a.skill ? a.skill('Shooting') : 4) * 0.038);
    acc *= a.capSight ? a.capSight() : 1;
    acc *= 1 - U.clamp(dist / wep.rng, 0, 1) * 0.4;
    if (a.hasTrait && a.hasTrait('sharpshooter')) acc += 0.12;
    if (a.hasTrait && a.hasTrait('triggerhappy')) acc -= 0.12;
    const cover = world.map.coverAt(Math.round(t.x), Math.round(t.y), world);
    acc *= (1 - cover * 0.55);
    const hit = world.rng.chance(U.clamp(acc, 0.05, 0.95));
    world.fx.push({ kind: 'shot', x1: a.x, y1: a.y, x2: t.x + world.rng.rf(-0.4, 0.4), y2: t.y + world.rng.rf(-0.4, 0.4), t: world.t, hit });
    if (hit) {
      const kind = wep.n === 'short bow' ? 'arrow' : 'gunshot';
      t.applyDamage(world, wep.dmg * world.rng.rf(0.7, 1.2), kind, (a.label ? a.label() : 'a shooter') + (wep.n ? `'s ${wep.n}` : ''), {});
      Combat.creditIfKilled(world, a, t);
    }
    if (a.gainXp) a.gainXp(world, 'Shooting', 50);
    return true;
  },

  creditIfKilled(world, a, t) {
    if (!t.dead || !a.stats) return;
    a.stats.kills++;
    if (a.isColonist && a.isColonist() && t.thing === 'pawn') {
      if (a.hasTrait('bloodlust')) a.addThought(world, 'tookLifeGlad');
      else if (!a.hasTrait('detached')) a.addThought(world, 'tookLife');
      a.addStory(world, `Killed ${t.label()} in battle`);
    }
  },

  meleeApproach(world, p, target) {
    const d = U.dist(p.x, p.y, target.x, target.y);
    if (d <= 1.8) { Combat.attack(world, p, target); return 'inRange'; }
    const r = Jobs.advance(world, p, Math.round(target.x), Math.round(target.y), p.faction !== 'colony' ? { hostile: true } : null);
    return r;
  },

  // ---- colonist fighter --------------------------------------------------
  stepFighter(world, p, j) {
    if (p.mode !== 'fight') { Jobs.endJob(world, p); return; }
    const wep = p.weaponDef();
    const target = Combat.nearestTarget(world, p, wep.melee ? 40 : wep.rng + 12);
    const station = Combat.stationFor(world, p);
    if (!target) {
      Jobs.advance(world, p, station.x, station.y);
      return;
    }
    const dist = U.dist(p.x, p.y, target.x, target.y);
    if (wep.melee) {
      // melee: intercept threats near the line, else hold
      if (dist < 12 || U.dist(target.x, target.y, station.x, station.y) < 10) Combat.meleeApproach(world, p, target);
      else Jobs.advance(world, p, station.x, station.y);
    } else {
      const inRange = (dist <= wep.rng && world.map.hasLOS(p.x, p.y, target.x, target.y, world)) || dist <= 1.8;
      if (inRange) { p.facing = target.x >= p.x ? 1 : -1; Combat.attack(world, p, target); }
      else {
        // step toward station first; if at station but no shot, edge toward target
        const atStation = U.dist(p.x, p.y, station.x, station.y) < 2.5;
        if (!atStation) Jobs.advance(world, p, station.x, station.y);
        else {
          const spot = world.map.findSpotNear(Math.round(p.x + Math.sign(target.x - p.x) * 2), Math.round(p.y + Math.sign(target.y - p.y) * 2), 3,
            (x, y) => world.map.standable(x, y, world));
          if (spot) Jobs.advance(world, p, spot.x, spot.y);
        }
      }
    }
  },

  // ---- hunting -----------------------------------------------------------
  stepHunter(world, p, j) {
    const a = world.byId[j.targetId];
    if (!a || a.dead) {
      const ix = world.huntQueue.indexOf(j.targetId);
      if (ix >= 0) world.huntQueue.splice(ix, 1);
      Jobs.endJob(world, p); return;
    }
    const wep = p.weaponDef();
    const dist = U.dist(p.x, p.y, a.x, a.y);
    // don't chase panicked game across the whole map
    j.chaseT = (j.chaseT || 0) + (a.state === 'flee' || dist > (wep.rng || 2) * 1.5 ? 1 : 0);
    if (j.chaseT > 160) {
      Jobs.markTabu(world, 'hunt:' + a.id, 500);
      Jobs.endJob(world, p);
      return;
    }
    if (wep.melee || !wep.rng) {
      if (Combat.meleeApproach(world, p, a) === 'stuck') { Jobs.endJob(world, p); return; }
    } else {
      if (dist <= wep.rng * 0.8 && world.map.hasLOS(p.x, p.y, a.x, a.y, world)) {
        p.facing = a.x >= p.x ? 1 : -1;
        Combat.attack(world, p, a);
      } else {
        const r = Jobs.advance(world, p, Math.round(a.x), Math.round(a.y));
        if (r === 'stuck') { Jobs.endJob(world, p); return; }
      }
    }
    // wounded prey may turn on the hunter
    if (!a.dead && a.hp < a.maxHp && !a.huntAggro) {
      a.huntAggro = true;
      if (world.rng.chance(a.def().retaliate || 0)) {
        a.state = 'attackPawn'; a.target = p.id;
        const dangerous = ['boar', 'bear', 'cougar', 'wolf', 'muffalo'].includes(a.species);
        if (dangerous || world.rng.chance(0.25)) {
          Chron.log(world, `The ${a.def().n} turned on ${p.label()}!`, { icon: ICONS.animal, tone: 'bad', at: p, major: dangerous });
        }
      }
    }
  },

  // ---- non-colonist humans ----------------------------------------------
  decideNonColonist(world, p) {
    Jobs.setJob(world, p, { type: 'npc' });
  },

  stepNpc(world, p, j) {
    if (p.cd > 0) p.cd--;
    if (p.fleeing) return Combat.stepFlee(world, p, j);
    if (p.faction === 'pirate' || p.faction === 'tribe') return Combat.stepRaider(world, p, j);
    return Combat.stepFriendlyVisitor(world, p, j);
  },

  stepRaider(world, p, j) {
    const raid = world.raids.find(r => r.id === p.raidId);
    if (!raid) { p.fleeing = true; return; }
    if (raid.state === 'approach') {
      const home = world.map.home;
      const r = Jobs.advance(world, p, U.clamp(home.x + (p.id % 7) - 3, 1, world.map.w - 2), U.clamp(home.y + (p.id % 5) - 2, 1, world.map.h - 2), { hostile: true });
      if (U.dist(p.x, p.y, home.x, home.y) < 26 || r === 'arrived' || r === 'stuck') raid.state = 'attack';
      return;
    }
    // attack state
    const target = Combat.nearestTarget(world, p, 999);
    const wep = p.weaponDef();
    if (target) {
      const dist = U.dist(p.x, p.y, target.x, target.y);
      if (!wep.melee && wep.rng && dist <= wep.rng && world.map.hasLOS(p.x, p.y, target.x, target.y, world)) {
        p.facing = target.x >= p.x ? 1 : -1;
        Combat.attack(world, p, target);
        return;
      }
      const r = Jobs.advance(world, p, Math.round(target.x), Math.round(target.y), { hostile: true });
      if (r === 'stuck' || Combat.blockedByStructure(world, p)) Combat.bashNearestStructure(world, p);
      else if (!wep.melee && r === 'moving' && dist < 3) Combat.attack(world, p, target);
      else if (wep.melee && dist <= 1.8) Combat.attack(world, p, target);
      return;
    }
    // no reachable pawn targets: wreck the colony
    const b = Things.nearestBuilding(world, p.x, p.y, bb => BUILDINGS[bb.key].v >= 6);
    if (b) {
      const r = Jobs.advanceAdjacent(world, p, b.x, b.y);
      if (r === 'arrived' && p.cd <= 0) {
        p.cd = 8;
        if (Things.damageBuilding(world, b, wep.dmg * 1.5)) world.stats.buildingsLost++;
      } else if (r === 'stuck') Combat.bashNearestStructure(world, p);
    } else {
      p.fleeing = true; // nothing left to do
    }
  },

  blockedByStructure(world, p) {
    // is a colony wall/door directly around us blocking progress?
    const px = Math.round(p.x), py = Math.round(p.y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const bid = world.map.inb(px + dx, py + dy) ? world.map.bIdx[world.map.idx(px + dx, py + dy)] : 0;
      if (bid) {
        const b = world.byId[bid];
        if (b && !b.blueprint && (BUILDINGS[b.key].block || BUILDINGS[b.key].door)) return true;
      }
    }
    return false;
  },

  bashNearestStructure(world, p) {
    const px = Math.round(p.x), py = Math.round(p.y);
    let target = null, bestD = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!world.map.inb(px + dx, py + dy)) continue;
      const bid = world.map.bIdx[world.map.idx(px + dx, py + dy)];
      if (!bid) continue;
      const b = world.byId[bid];
      if (!b || b.blueprint) continue;
      const def = BUILDINGS[b.key];
      if (!def.block && !def.door) continue;
      const d = def.door ? 0 : 1; // prefer doors
      if (d < bestD) { bestD = d; target = b; }
    }
    if (target && p.cd <= 0) {
      p.cd = 7;
      const wep = p.weaponDef();
      if (Things.damageBuilding(world, target, (wep.melee ? wep.dmg : 6) * 2.2)) {
        if (world.rng.chance(0.4)) Chron.log(world, `The raiders broke through the ${BUILDINGS[target.key].n}!`, { icon: ICONS.raid, tone: 'bad', at: target });
      }
      world.fx.push({ kind: 'melee', x: target.x, y: target.y, t: world.t });
    }
  },

  stepFlee(world, p, j) {
    if (!p.fleeTarget) {
      const map = world.map;
      const edges = [{ x: 2, y: Math.round(p.y) }, { x: map.w - 3, y: Math.round(p.y) }, { x: Math.round(p.x), y: 2 }, { x: Math.round(p.x), y: map.h - 3 }];
      let best = edges[0], bestD = Infinity;
      for (const e of edges) { const d = U.dist(p.x, p.y, e.x, e.y); if (d < bestD) { bestD = d; best = e; } }
      p.fleeTarget = best;
      // grab-and-run: loot or kidnap
      if ((p.faction === 'pirate' || p.faction === 'tribe') && world.rng.chance(0.3)) {
        const victim = world.pawns.find(q => q.isColonist() && q.downed && !q.dead && U.dist(p.x, p.y, q.x, q.y) < 8);
        if (victim && world.rng.chance(0.35)) p.kidnapping = victim.id;
        else {
          const loot = Things.nearestItem(world, p.x, p.y, s => ['silver', 'gold', 'medkit', 'mealFine'].includes(s.kind) && U.dist(p.x, p.y, s.x, s.y) < 10);
          if (loot) {
            const qty = Math.min(loot.qty, 20);
            const kind = loot.kind;
            Things.take(world, loot, qty);
            p.carry = { kind, qty };
          }
        }
      }
    }
    if (p.kidnapping) {
      const victim = world.byId[p.kidnapping];
      if (victim && !victim.dead) { victim.x = p.x; victim.y = p.y; }
    }
    const r = Jobs.advance(world, p, p.fleeTarget.x, p.fleeTarget.y, { hostile: true, ignoreFire: true });
    if (r === 'arrived' || r === 'stuck') Sim.despawnPawn(world, p, r === 'arrived' ? 'fled' : 'lost');
  },

  stepFriendlyVisitor(world, p, j) {
    // traders/visitors: walk in, linger near home, leave
    if (world.threat && p.canFight(world)) {
      const target = Combat.nearestTarget(world, p, 24);
      if (target) {
        const wep = p.weaponDef();
        const dist = U.dist(p.x, p.y, target.x, target.y);
        if (!wep.melee && dist <= wep.rng && world.map.hasLOS(p.x, p.y, target.x, target.y, world)) { Combat.attack(world, p, target); return; }
        if (dist < 14) { Combat.meleeApproach(world, p, target); return; }
      }
    }
    if (p.leaveAt && world.t >= p.leaveAt) p.npcLeaving = true;
    if (p.needs.food < 0.25) p.npcLeaving = true; // supplies run low: move on
    if (p.npcLeaving) {
      if (!p.fleeTarget) p.fleeTarget = world.map.randomEdgeSpot(world.rng, world);
      const r = Jobs.advance(world, p, p.fleeTarget.x, p.fleeTarget.y);
      if (r === 'arrived' || r === 'stuck') Sim.despawnPawn(world, p, 'left');
      return;
    }
    const anchor = p.npcAnchor || world.map.home;
    if (U.dist(p.x, p.y, anchor.x, anchor.y) > 6) {
      Jobs.advance(world, p, anchor.x, anchor.y);
    } else if (world.rng.chance(0.02)) {
      const spot = world.map.findSpotNear(anchor.x + world.rng.ri(-4, 4), anchor.y + world.rng.ri(-4, 4), 4, (x, y) => world.map.standable(x, y, world));
      if (spot) Jobs.advance(world, p, spot.x, spot.y);
    }
    // chat with colonists sometimes
    if (world.t % 30 === 0 && world.rng.chance(0.3)) {
      const c = world.pawns.find(q => q.isColonist() && !q.downed && U.dist(p.x, p.y, q.x, q.y) < 3);
      if (c) Social.interact(world, c, p, 'visit');
    }
  },

  // ---- turrets -------------------------------------------------------------
  tickTurrets(world) {
    if (!world.threat) return;
    for (const b of world.buildings) {
      if (b.blueprint) continue;
      const def = BUILDINGS[b.key];
      if (!def.turret) continue;
      b.cd = Math.max(0, (b.cd || 0) - 1);
      if (b.cd > 0) continue;
      const probe = { faction: 'colony', x: b.x, y: b.y };
      let target = null, bestD = Infinity;
      for (const t of Combat.hostileTargetsFor(world, probe)) {
        const d = U.dist(b.x, b.y, t.x, t.y);
        if (d < bestD && d <= def.turret.rng) { bestD = d; target = t; }
      }
      if (!target) continue;
      if (!world.map.hasLOS(b.x, b.y, target.x, target.y, world)) continue;
      b.cd = def.turret.cd;
      b.aimX = target.x; b.aimY = target.y; b.firedT = world.t;
      let acc = def.turret.acc * (1 - U.clamp(bestD / def.turret.rng, 0, 1) * 0.35);
      acc *= (1 - world.map.coverAt(Math.round(target.x), Math.round(target.y), world) * 0.5);
      const hit = world.rng.chance(U.clamp(acc, 0.05, 0.9));
      world.fx.push({ kind: 'shot', x1: b.x, y1: b.y, x2: target.x + world.rng.rf(-0.4, 0.4), y2: target.y + world.rng.rf(-0.4, 0.4), t: world.t, hit });
      if (hit) target.applyDamage(world, def.turret.dmg * world.rng.rf(0.75, 1.2), 'gunshot', 'the turret');
    }
  },

  // ---- raid group management ---------------------------------------------
  tickRaids(world) {
    for (let i = world.raids.length - 1; i >= 0; i--) {
      const raid = world.raids[i];
      const members = raid.members.map(id => world.byId[id]).filter(q => q && !q.dead && !q.prisoner && !q.gone);
      const active = members.filter(q => !q.downed && !q.fleeing);
      const casualties = raid.size - active.length;
      if (!members.length || !active.length) {
        world.raids.splice(i, 1);
        if (world.pawns.some(q => q.isColonist())) GameEvents.raidOver(world, raid);
        continue;
      }
      if (raid.state === 'attack' && !raid.broken) {
        const moraleLimit = raid.size * (raid.leaderAlive === false ? 0.2 : 0.34);
        const leader = world.byId[raid.leaderId];
        if (leader && (leader.dead || leader.downed) && raid.leaderAlive !== false) {
          raid.leaderAlive = false;
          Chron.log(world, `${raid.leaderName} is down — the ${raid.factionName} falter!`, { icon: ICONS.raid, tone: 'good', major: true });
        }
        if (casualties >= Math.max(1, moraleLimit)) {
          raid.broken = true;
          for (const q of members) if (!q.downed) q.fleeing = true;
          Chron.log(world, Chron.pick(world, [
            `The raiders' nerve broke — they are running for the ${world.rng.pick(['hills', 'treeline', 'wastes'])}!`,
            `A ragged cry went up, and the ${raid.factionName} turned tail.`,
          ]), { icon: ICONS.raid, tone: 'good', major: true });
        }
      }
      // timeout: raids don't besiege forever
      if (world.t - raid.startT > 1000 && !raid.broken) {
        raid.broken = true;
        for (const q of members) if (!q.downed) q.fleeing = true;
      }
    }
  },

  // ---- animals -----------------------------------------------------------
  tickAnimal(world, a) {
    if (a.dead) return;
    if (a.cd > 0) a.cd--;
    const def = a.def();
    a.stateT++;
    if (a.manhunter) {
      let target = a.target ? world.byId[a.target] : null;
      if (!target || target.dead || (target.thing === 'pawn' && target.downed)) {
        let bestD = Infinity; target = null;
        for (const q of world.pawns) {
          if (q.dead || q.downed || q.gone) continue;
          const indoors = world.map.indoorsAt(Math.round(q.x), Math.round(q.y));
          if (indoors) continue; // can't reach them inside
          const d = U.dist(a.x, a.y, q.x, q.y);
          if (d < bestD) { bestD = d; target = q; }
        }
        a.target = target ? target.id : null;
      }
      if (target) {
        const d = U.dist(a.x, a.y, target.x, target.y);
        if (d <= 1.6) { if (a.cd <= 0) { a.cd = 9; target.applyDamage(world, def.dmg * world.rng.rf(0.8, 1.2), 'bite', `a mad ${def.n}`); } }
        else Combat.animalMoveToward(world, a, target.x, target.y);
      } else {
        // no prey in the open: prowl toward the colony, but rage burns out
        if (world.rng.chance(0.3)) Combat.animalMoveToward(world, a, world.map.home.x, world.map.home.y, 0.5);
        else Combat.animalWander(world, a);
        if (a.stateT > 750) { a.manhunter = false; a.state = 'flee'; a.fleeUntil = world.t + 500; }
      }
      return;
    }
    switch (a.state) {
      case 'flee':
        if (world.t >= a.fleeUntil) { a.state = 'wander'; break; }
        if (!a.fleeSpot || world.rng.chance(0.1)) {
          a.fleeSpot = { x: U.clamp(Math.round(a.x + world.rng.ri(-14, 14)), 1, world.map.w - 2), y: U.clamp(Math.round(a.y + world.rng.ri(-14, 14)), 1, world.map.h - 2) };
        }
        Combat.animalMoveToward(world, a, a.fleeSpot.x, a.fleeSpot.y, 1.3);
        break;
      case 'attackPawn': {
        const target = world.byId[a.target];
        if (!target || target.dead || target.downed || target.gone) { a.state = a.tame ? 'pet' : 'wander'; a.target = null; break; }
        if (!a.rageT) a.rageT = 0;
        a.rageT++;
        // wounded herbivores make their point and leave; predators persist longer
        const persistence = def.predator || a.tame ? 700 : 120;
        if (a.rageT > persistence) { a.state = a.tame ? 'pet' : 'flee'; a.fleeUntil = world.t + 400; a.target = null; a.rageT = 0; break; }
        const d = U.dist(a.x, a.y, target.x, target.y);
        if (d <= 1.6) { if (a.cd <= 0) { a.cd = 9; target.applyDamage(world, def.dmg * world.rng.rf(0.8, 1.2), 'bite', `the ${def.n}`); } }
        else if (d > 22) { a.state = a.tame ? 'pet' : 'wander'; a.target = null; a.rageT = 0; }
        else Combat.animalMoveToward(world, a, target.x, target.y, 1.15);
        break;
      }
      case 'pet': Combat.tickPet(world, a); break;
      default: {
        // wildlife: wander, graze; predators sometimes hunt
        if (def.predator && world.rng.chance(0.0012)) {
          // hunt smaller wildlife, or rarely a lone human outdoors
          let prey = null, bestD = Infinity;
          for (const b of world.animals) {
            if (b === a || b.dead || b.def().predator || b.tame) continue;
            const d = U.dist(a.x, a.y, b.x, b.y);
            if (d < bestD && d < 30) { bestD = d; prey = b; }
          }
          if (!prey && world.rng.chance(0.25)) {
            for (const q of world.pawns) {
              if (q.dead || q.gone || world.map.indoorsAt(Math.round(q.x), Math.round(q.y))) continue;
              const d = U.dist(a.x, a.y, q.x, q.y);
              if (d < bestD && d < 24) { bestD = d; prey = q; }
            }
            if (prey && prey.thing === 'pawn') {
              Chron.log(world, `A ${def.n} is stalking ${prey.label()}!`, { icon: ICONS.animal, tone: 'bad', major: true, at: prey });
              Renderer.focus(world, prey.x, prey.y, 6, `A ${def.n} hunts ${prey.label()}!`);
            }
          }
          if (prey) { a.state = 'attackPawn'; a.target = prey.id; }
        } else if (a.tame) { a.state = 'pet'; }
        else Combat.animalWander(world, a);
      }
    }
  },

  tickPet(world, a) {
    // follow a colonist, nuzzle, defend owner
    const owner = a.ownerId ? world.byId[a.ownerId] : null;
    if (world.threat && a.def().guard) {
      const raider = Combat.nearestTarget(world, { ...a, faction: 'colony' }, 14);
      if (raider && raider.thing === 'pawn') { a.state = 'attackPawn'; a.target = raider.id; return; }
    }
    const follow = owner && !owner.dead ? owner : world.pawns.find(q => q.isColonist() && !q.downed);
    if (!follow) { Combat.animalWander(world, a); return; }
    const d = U.dist(a.x, a.y, follow.x, follow.y);
    if (d > 4) Combat.animalMoveToward(world, a, follow.x, follow.y);
    else if (world.rng.chance(0.004) && follow.isColonist && follow.isColonist()) {
      follow.addThought(world, a.def().mouser && world.rng.chance(0.25) ? 'petGift' : 'nuzzled');
      world.fx.push({ kind: 'heart', x: follow.x, y: follow.y - 0.5, t: world.t });
    } else if (world.rng.chance(0.02)) {
      Combat.animalWander(world, a);
    }
  },

  animalMoveToward(world, a, tx, ty, speedMult) {
    let spd = a.def().spd * 0.55 * (speedMult || 1) * (a.hp < a.maxHp * 0.5 ? 0.7 : 1);
    if ((a.staggerT || 0) > world.t) spd *= 0.2;
    const dx = tx - a.x, dy = ty - a.y;
    const d = Math.hypot(dx, dy) || 1;
    let nx = a.x + (dx / d) * Math.min(spd, d);
    let ny = a.y + (dy / d) * Math.min(spd, d);
    // animals avoid water & walls crudely
    if (world.map.inb(Math.round(nx), Math.round(ny)) && world.map.moveCost(Math.round(nx), Math.round(ny), world, null) !== Infinity) {
      a.x = nx; a.y = ny;
    } else {
      // slide along
      if (world.map.inb(Math.round(nx), Math.round(a.y)) && world.map.moveCost(Math.round(nx), Math.round(a.y), world, null) !== Infinity) a.x = nx;
      else if (world.map.inb(Math.round(a.x), Math.round(ny)) && world.map.moveCost(Math.round(a.x), Math.round(ny), world, null) !== Infinity) a.y = ny;
      else { a.x += world.rng.rf(-0.4, 0.4); a.y += world.rng.rf(-0.4, 0.4); }
    }
    a.x = U.clamp(a.x, 1, world.map.w - 2); a.y = U.clamp(a.y, 1, world.map.h - 2);
  },

  animalWander(world, a) {
    if (!a.wanderSpot || U.dist(a.x, a.y, a.wanderSpot.x, a.wanderSpot.y) < 1.5 || world.rng.chance(0.005)) {
      a.wanderSpot = { x: U.clamp(Math.round(a.x + world.rng.ri(-10, 10)), 1, world.map.w - 2), y: U.clamp(Math.round(a.y + world.rng.ri(-10, 10)), 1, world.map.h - 2) };
    }
    if (world.rng.chance(0.35)) Combat.animalMoveToward(world, a, a.wanderSpot.x, a.wanderSpot.y, 0.5);
  },
};

// non-colonist humans run through the job system with a single npc job type
Jobs.steps.npc = (world, p, j) => Combat.stepNpc(world, p, j);

Object.assign(globalThis, { Combat });
