// Living things: foes walking the road, ward-towers and their projectiles,
// scorch fields, particles and floating texts. Entities are plain objects in
// arrays on the game state; the update functions here advance them, while
// render.js only reads. Damage, bounty, surge and leak bookkeeping all flow
// through hurt()/kill() so every kill is accounted exactly once.

import {
  ENEMIES, TOWERS, towerStats, waveHpMul, SCORCH_DUR, SCORCH_DPS,
  SURGE_MAX, SURGE_PER_KILL,
} from './config.js';
import { posAt } from './world.js';

let nextId = 1;

export function makeEnemy(game, type) {
  const def = ENEMIES[type];
  const mul = waveHpMul(game.wave) * game.diff.hpMul;
  const hp = Math.round(def.hp * mul);
  return {
    id: nextId++, type, def, hp, maxHp: hp,
    dist: 0, x: -30, y: 0, ang: 0,
    slowFactor: 0, slowUntil: 0, wob: Math.random() * Math.PI * 2,
    alive: true, reached: false, flash: 0,
  };
}

export function makeTower(kind, c, r, x, y) {
  return {
    id: nextId++, kind, c, r, x, y, level: 1,
    invested: TOWERS[kind].cost, cooldown: 0, ang: -Math.PI / 2,
    muzzle: 0, targetId: 0,
  };
}

export function hurt(game, enemy, rawDmg, sourceKind) {
  if (!enemy.alive) return;
  const dmg = Math.max(1, rawDmg - (enemy.def.armor ?? 0));
  enemy.hp -= dmg;
  enemy.flash = 0.08;
  if (enemy.hp <= 0) kill(game, enemy, sourceKind);
}

export function applySlow(game, enemy, factor, dur) {
  const resist = enemy.def.frostResist ?? 0;
  const eff = factor * (1 - resist);
  if (eff >= enemy.slowFactor || game.time >= enemy.slowUntil) {
    enemy.slowFactor = Math.max(enemy.slowFactor, eff);
    enemy.slowUntil = game.time + dur;
  }
}

export function kill(game, enemy, sourceKind) {
  enemy.alive = false;
  game.gold += enemy.def.bounty;
  game.score += Math.round(enemy.def.bounty * 10 * game.diff.scoreMul);
  game.kills += 1;
  game.surge = Math.min(SURGE_MAX, game.surge + SURGE_PER_KILL);
  spawnBurst(game, enemy.x, enemy.y, enemy.def.color, enemy.def.boss ? 34 : 10, enemy.def.boss ? 190 : 110);
  addFloater(game, enemy.x, enemy.y - 14, `+${enemy.def.bounty}g`, '#f5b942');
  if (sourceKind) game.audio.coin();
  if (enemy.def.boss) {
    game.shake = Math.min(14, game.shake + 9);
    game.audio.boom();
  }
}

export function spawnBurst(game, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (0.3 + Math.random() * 0.7) * speed;
    game.particles.push({
      kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      ttl: 0.35 + Math.random() * 0.4, maxTtl: 0.75, color, size: 1.6 + Math.random() * 2.2,
    });
  }
}

export function addFloater(game, x, y, text, color) {
  game.floaters.push({ x, y, text, color, ttl: 1.1 });
}

// --- Spawning ---------------------------------------------------------------

export function buildSpawnQueue(game) {
  const queue = [];
  let t = 0.6;
  for (const grp of game.comp) {
    t += grp.delay;
    for (let i = 0; i < grp.count; i++) {
      queue.push({ at: t, type: grp.type });
      t += grp.gap;
    }
    t += 0.4;
  }
  return queue;
}

export function updateSpawner(game, dt) {
  game.spawnTimer += dt;
  while (game.spawnQueue.length && game.spawnQueue[0].at <= game.spawnTimer) {
    const item = game.spawnQueue.shift();
    game.enemies.push(makeEnemy(game, item.type));
  }
}

// --- Foes -------------------------------------------------------------------

export function updateEnemies(game, dt) {
  const world = game.world;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    if (e.flash > 0) e.flash -= dt;
    const slowed = game.time < e.slowUntil;
    const speed = e.def.speed * (slowed ? 1 - e.slowFactor : 1);
    if (!slowed) e.slowFactor = 0;
    e.dist += speed * dt;
    e.wob += dt * 6;
    const p = posAt(world, e.dist);
    e.x = p.x;
    e.y = p.y + Math.sin(e.wob) * 1.5;
    e.ang = p.ang;
    // Scorch fields burn anything standing in them.
    for (const s of game.scorch) {
      const d2 = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
      if (d2 < s.r * s.r) {
        e.hp -= SCORCH_DPS * dt * (e.def.boss ? 0.5 : 1);
        if (e.hp <= 0 && e.alive) kill(game, e, 'scorch');
        break;
      }
    }
    if (e.alive && e.dist >= world.totalLength) {
      e.alive = false;
      e.reached = true;
      game.lives -= e.def.leak;
      game.leaks += e.def.leak;
      game.shake = Math.min(12, game.shake + 5);
      addFloater(game, e.x - 20, e.y - 20, `-${e.def.leak} ♥`, '#ff5d73');
      game.audio.leak();
      spawnBurst(game, e.x, e.y, '#ffb347', 14, 130);
    }
  }
  game.enemies = game.enemies.filter((e) => e.alive);
}

// --- Towers -----------------------------------------------------------------

function firstInRange(game, tower, stats) {
  let best = null;
  for (const e of game.enemies) {
    const d = Math.hypot(e.x - tower.x, e.y - tower.y);
    if (d <= stats.range && (!best || e.dist > best.dist)) best = e;
  }
  return best;
}

export function updateTowers(game, dt) {
  for (const tower of game.towers.values()) {
    const stats = towerStats(tower.kind, tower.level);
    tower.cooldown -= dt;
    if (tower.muzzle > 0) tower.muzzle -= dt;
    const target = firstInRange(game, tower, stats);
    tower.targetId = target ? target.id : 0;
    if (target) {
      tower.ang = Math.atan2(target.y - tower.y, target.x - tower.x);
      if (tower.cooldown <= 0) {
        tower.cooldown = 1 / stats.rate;
        fire(game, tower, stats, target);
      }
    }
  }
}

function fire(game, tower, stats, target) {
  tower.muzzle = 0.07;
  if (tower.kind === 'storm') {
    // Instant chain lightning: strike the target, then hop to the nearest
    // unstruck foe within 74 px, losing 30% bite per hop.
    const struck = [];
    let current = target;
    let dmg = stats.dmg;
    let from = { x: tower.x, y: tower.y - 16 };
    for (let hop = 0; hop < stats.chain && current; hop++) {
      game.particles.push({
        kind: 'bolt', pts: jagged(from, current), ttl: 0.16, maxTtl: 0.16,
        color: '#c9a7ff',
      });
      hurt(game, current, dmg, 'storm');
      struck.push(current);
      from = { x: current.x, y: current.y };
      dmg *= 0.7;
      let next = null;
      let bestD = 74;
      for (const e of game.enemies) {
        if (!e.alive || struck.includes(e)) continue;
        const d = Math.hypot(e.x - from.x, e.y - from.y);
        if (d < bestD) { bestD = d; next = e; }
      }
      current = next;
    }
    game.audio.zap();
    return;
  }
  if (tower.kind === 'mortar') {
    const flight = Math.max(0.45, Math.hypot(target.x - tower.x, target.y - tower.y) / 330);
    game.projectiles.push({
      kind: 'shell', x: tower.x, y: tower.y - 14, sx: tower.x, sy: tower.y - 14,
      tx: target.x, ty: target.y, t: 0, flight, stats, towerKind: 'mortar',
    });
    game.audio.mortar();
    return;
  }
  // arrow & frost: homing projectiles that track their foe.
  game.projectiles.push({
    kind: tower.kind === 'frost' ? 'shard' : 'bolt',
    x: tower.x, y: tower.y - 16, target, stats, towerKind: tower.kind,
    speed: tower.kind === 'frost' ? 330 : 520,
  });
  if (tower.kind === 'frost') game.audio.frost(); else game.audio.shoot();
}

function jagged(a, b) {
  const pts = [{ x: a.x, y: a.y }];
  const n = 5;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    pts.push({
      x: a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 16,
      y: a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 16,
    });
  }
  pts.push({ x: b.x, y: b.y });
  return pts;
}

// --- Projectiles --------------------------------------------------------------

export function updateProjectiles(game, dt) {
  const keep = [];
  for (const p of game.projectiles) {
    if (p.kind === 'shell') {
      p.t += dt / p.flight;
      if (p.t >= 1) {
        explodeShell(game, p);
        continue;
      }
      p.x = p.sx + (p.tx - p.sx) * p.t;
      p.y = p.sy + (p.ty - p.sy) * p.t - Math.sin(p.t * Math.PI) * 64;
      keep.push(p);
      continue;
    }
    // Homing bolt / shard.
    const tgt = p.target;
    if (!tgt || !tgt.alive) continue; // fizzles with its foe gone
    const dx = tgt.x - p.x;
    const dy = tgt.y - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (d <= step + tgt.def.r) {
      if (p.towerKind === 'frost') {
        for (const e of game.enemies) {
          if (Math.hypot(e.x - tgt.x, e.y - tgt.y) <= p.stats.splash) {
            hurt(game, e, p.stats.dmg, 'frost');
            if (e.alive) applySlow(game, e, p.stats.slow, p.stats.slowDur);
          }
        }
        spawnBurst(game, tgt.x, tgt.y, '#7fd4ff', 7, 80);
      } else {
        hurt(game, tgt, p.stats.dmg, 'arrow');
        spawnBurst(game, tgt.x, tgt.y, '#ffe9a8', 3, 70);
      }
      continue;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    keep.push(p);
  }
  game.projectiles = keep;
}

function explodeShell(game, p) {
  const { splash, dmg } = p.stats;
  for (const e of game.enemies) {
    const d = Math.hypot(e.x - p.tx, e.y - p.ty);
    if (d <= splash + e.def.r) {
      const fall = d <= splash * 0.55 ? 1 : 0.6;
      hurt(game, e, dmg * fall, 'mortar');
    }
  }
  game.scorch.push({ x: p.tx, y: p.ty, r: splash * 0.8, ttl: SCORCH_DUR, maxTtl: SCORCH_DUR });
  game.particles.push({ kind: 'ring', x: p.tx, y: p.ty, r: 6, maxR: splash, ttl: 0.3, maxTtl: 0.3, color: '#ff7a3c' });
  spawnBurst(game, p.tx, p.ty, '#ff7a3c', 16, 170);
  game.shake = Math.min(10, game.shake + 2.5);
  game.audio.boom();
}

// --- Particles, floaters, scorch ----------------------------------------------

export function updateFx(game, dt) {
  for (const s of game.scorch) s.ttl -= dt;
  game.scorch = game.scorch.filter((s) => s.ttl > 0);

  const keepP = [];
  for (const p of game.particles) {
    p.ttl -= dt;
    if (p.ttl <= 0) continue;
    if (p.kind === 'spark') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    } else if (p.kind === 'ring') {
      p.r += (p.maxR - p.r) * Math.min(1, dt * 10);
    }
    keepP.push(p);
  }
  game.particles = keepP;

  for (const f of game.floaters) {
    f.ttl -= dt;
    f.y -= 26 * dt;
  }
  game.floaters = game.floaters.filter((f) => f.ttl > 0);
}
