// Deterministic screenshot poses (?shot=title|action|boss|over&seed=N).
// Each pose builds a scripted scenario — placed towers, injected foes at set
// distances along the road — then steps the real simulation a few seconds so
// projectiles, chains and bursts are genuinely mid-flight in the render.
// Nothing here is drawn or faked: the screenshots are the game itself.

import { BOSS_NAMES, DIFFICULTIES, SURGE_MAX } from './config.js';
import { makeTower, makeEnemy } from './entities.js';
import { posAt, cellKey } from './world.js';

function place(game, kind, c, r, level = 1) {
  const x = c * 60 + 30;
  const y = r * 60 + 30;
  const tower = makeTower(kind, c, r, x, y);
  tower.level = level;
  tower.invested = 0;
  game.towers.set(cellKey(c, r), tower);
  return tower;
}

function inject(game, type, distFrac, hpFrac = 1) {
  const e = makeEnemy(game, type);
  e.dist = game.world.totalLength * distFrac;
  const p = posAt(game.world, e.dist);
  e.x = p.x;
  e.y = p.y;
  e.ang = p.ang;
  if (hpFrac < 1) e.hp = Math.round(e.maxHp * hpFrac);
  game.enemies.push(e);
  return e;
}

function step(game, seconds) {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) game.update(1 / 60);
}

// Keep stepping (at most ~5 extra seconds) until the frame is busy —
// projectiles in flight — so the frozen render shows a real fight.
function stepUntilBusy(game, minProjectiles) {
  let guard = 0;
  while (game.projectiles.length < minProjectiles && guard++ < 300) {
    game.update(1 / 60);
  }
}

const ACTION_TOWERS = [
  ['arrow', 11, 1, 2], ['frost', 13, 3, 1], ['mortar', 5, 4, 2],
  ['arrow', 2, 6, 1], ['frost', 4, 6, 1], ['storm', 6, 7, 2],
  ['mortar', 10, 9, 1], ['arrow', 14, 9, 2],
];

export function applyShot(game, name) {
  game.difficulty = 'warden';
  game.diff = DIFFICULTIES.warden;

  if (name === 'title') {
    game.mode = 'title';
    for (const [k, c, r, l] of ACTION_TOWERS.slice(0, 5)) place(game, k, c, r, l);
    inject(game, 'imp', 0.16);
    inject(game, 'imp', 0.13);
    inject(game, 'runner', 0.3);
    inject(game, 'wisp', 0.47);
    game.time = 0.4;
    return;
  }

  if (name === 'action') {
    game.mode = 'play';
    game.phase = 'wave';
    game.wave = 7;
    game.gold = 145;
    game.lives = 17;
    game.score = 4320;
    game.surge = 64;
    for (const [k, c, r, l] of ACTION_TOWERS) place(game, k, c, r, l);
    const sel = place(game, 'storm', 8, 3, 1);
    game.selectedTowerId = sel.id;
    inject(game, 'imp', 0.1);
    inject(game, 'imp', 0.16);
    inject(game, 'runner', 0.22);
    inject(game, 'imp', 0.3, 0.6);
    inject(game, 'wisp', 0.38);
    inject(game, 'brute', 0.46, 0.8);
    inject(game, 'runner', 0.55);
    inject(game, 'imp', 0.63);
    inject(game, 'wisp', 0.72);
    inject(game, 'imp', 0.8, 0.5);
    inject(game, 'imp', 0.26);
    inject(game, 'runner', 0.5);
    inject(game, 'wisp', 0.86);
    inject(game, 'imp', 0.06);
    step(game, 2.4);
    stepUntilBusy(game, 2);
    return;
  }

  if (name === 'boss') {
    game.mode = 'play';
    game.phase = 'wave';
    game.wave = 15;
    game.gold = 260;
    game.lives = 14;
    game.score = 12850;
    game.surge = SURGE_MAX;
    game.bossName = BOSS_NAMES[15];
    for (const [k, c, r, l] of ACTION_TOWERS) place(game, k, c, r, Math.min(3, l + 1));
    place(game, 'storm', 8, 3, 3);
    place(game, 'arrow', 12, 11, 2);
    place(game, 'mortar', 15, 9, 2);
    inject(game, 'imp', 0.18);
    inject(game, 'golem', 0.3, 0.85);
    inject(game, 'runner', 0.4);
    const boss = inject(game, 'behemoth', 0.52, 0.58);
    boss.maxHp = Math.round(boss.maxHp);
    inject(game, 'wisp', 0.6);
    inject(game, 'imp', 0.66, 0.7);
    inject(game, 'brute', 0.74, 0.9);
    inject(game, 'runner', 0.24);
    inject(game, 'imp', 0.44);
    step(game, 2.2);
    stepUntilBusy(game, 2);
    return;
  }

  if (name === 'over') {
    game.mode = 'over';
    game.wave = 13;
    game.lives = 0;
    game.score = 9640;
    game.kills = 512;
    game.leaks = 20;
    for (const [k, c, r, l] of ACTION_TOWERS.slice(0, 6)) place(game, k, c, r, l);
    inject(game, 'brute', 0.9, 0.7);
    inject(game, 'imp', 0.94);
    inject(game, 'golem', 0.84, 0.6);
    game.time = 1.2;
    return;
  }

  game.mode = 'title';
}
