// EMBERWARD — entry point and state machine. Owns the game state object,
// the fixed vocabulary of interactions (build / upgrade / sell / start wave /
// Nova / pause / speed), the wave lifecycle with its clear bonuses and
// interest, and the requestAnimationFrame loop. In screenshot mode
// (?shot=...) the loop renders the posed scene without advancing it.

import {
  VIEW_W, VIEW_H, TILE, COLS, ROWS, FIELD_W, TOWERS, DIFFICULTIES,
  START_GOLD, START_LIVES, TOTAL_WAVES, SELL_REFUND, INTEREST_RATE,
  INTEREST_CAP, SURGE_MAX, NOVA_DMG, NOVA_SLOW, NOVA_SLOW_DUR,
  waveComp, BOSS_NAMES,
} from './config.js';
import { buildWorld, tileCenter, cellKey, CRYSTAL_TILE } from './world.js';
import { Input } from './input.js';
import { AudioBank } from './audio.js';
import {
  makeTower, buildSpawnQueue, updateSpawner, updateEnemies, updateTowers,
  updateProjectiles, updateFx, hurt, applySlow, spawnBurst,
} from './entities.js';
import { drawScene, panelRects, difficultyRects, inRect, selTower } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? '1') || 1;

export function createGame() {
  const game = {
    world: buildWorld(seed),
    groundCanvas: null,
    input: new Input(canvas),
    audio: new AudioBank(),
    time: 0,
    mode: 'title', // title | play | over | win
    phase: 'build', // build | wave
    paused: false,
    speed: 1,
    difficulty: 'warden',
    diff: DIFFICULTIES.warden,
    gold: START_GOLD,
    lives: START_LIVES,
    score: 0,
    wave: 0,
    kills: 0,
    leaks: 0,
    surge: 0,
    endless: false,
    towers: new Map(),
    enemies: [],
    projectiles: [],
    particles: [],
    floaters: [],
    scorch: [],
    spawnQueue: [],
    spawnTimer: 0,
    comp: [],
    placing: null,
    selectedTowerId: 0,
    banner: '',
    bannerSub: '',
    bannerBoss: false,
    bannerTtl: 0,
    bossName: '',
    shake: 0,
  };

  game.canBuildAt = (c, r) => {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
    if (game.world.pathCells.has(cellKey(c, r))) return false;
    if (game.towers.has(cellKey(c, r))) return false;
    return true;
  };

  game.reset = () => {
    game.gold = Math.round(START_GOLD * game.diff.goldMul);
    game.lives = START_LIVES;
    game.score = 0;
    game.wave = 0;
    game.kills = 0;
    game.leaks = 0;
    game.surge = 0;
    game.endless = false;
    game.towers.clear();
    game.enemies = [];
    game.projectiles = [];
    game.particles = [];
    game.floaters = [];
    game.scorch = [];
    game.spawnQueue = [];
    game.comp = [];
    game.phase = 'build';
    game.placing = null;
    game.selectedTowerId = 0;
    game.bannerTtl = 0;
    game.bossName = '';
    game.paused = false;
  };

  game.startWave = () => {
    if (game.mode !== 'play' || game.phase !== 'build') return;
    game.wave += 1;
    game.comp = waveComp(game.wave);
    game.spawnQueue = buildSpawnQueue(game);
    game.spawnTimer = 0;
    game.phase = 'wave';
    const boss = BOSS_NAMES[game.wave];
    game.bossName = boss ?? '';
    game.bannerBoss = Boolean(boss);
    game.banner = boss ?? `WAVE ${game.wave}`;
    game.bannerSub = boss ? `Wave ${game.wave} — the Behemoth comes` : '';
    game.bannerTtl = 3;
    game.audio.horn();
  };

  game.fireNova = () => {
    if (game.mode !== 'play' || game.surge < SURGE_MAX) return;
    game.surge = 0;
    const c = tileCenter(CRYSTAL_TILE.c, CRYSTAL_TILE.r);
    for (const e of [...game.enemies]) {
      hurt(game, e, NOVA_DMG, 'nova');
      if (e.alive) applySlow(game, e, NOVA_SLOW, NOVA_SLOW_DUR);
    }
    game.particles.push({ kind: 'ring', x: c.x, y: c.y, r: 12, maxR: 1250, ttl: 0.8, maxTtl: 0.8, color: '#ffb347' });
    game.particles.push({ kind: 'ring', x: c.x, y: c.y, r: 6, maxR: 700, ttl: 0.6, maxTtl: 0.6, color: '#ff7a3c' });
    spawnBurst(game, c.x, c.y, '#ffc46b', 40, 260);
    game.shake = Math.min(14, game.shake + 8);
    game.audio.boom();
    game.audio.zap();
  };

  game.waveCleared = () => {
    game.phase = 'build';
    const bonus = 20 + game.wave * 2;
    const interest = Math.min(INTEREST_CAP, Math.floor(game.gold * INTEREST_RATE));
    game.gold += bonus + interest;
    game.score += 100 * game.wave;
    if (!game.endless && game.wave >= TOTAL_WAVES) {
      game.mode = 'win';
      game.audio.win();
    }
  };

  game.update = (dt) => {
    game.time += dt;
    if (game.bannerTtl > 0) game.bannerTtl -= dt;
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 26);
    updateFx(game, dt);
    if (game.mode !== 'play' || game.paused) return;

    if (game.phase === 'wave') {
      updateSpawner(game, dt);
      if (game.spawnQueue.length === 0 && game.enemies.length === 0) game.waveCleared();
    }
    updateEnemies(game, dt);
    updateTowers(game, dt);
    updateProjectiles(game, dt);
    game.audio.pad(dt, true);

    if (game.lives <= 0 && game.mode === 'play') {
      game.mode = 'over';
      game.audio.lose();
    }
  };

  return game;
}

const game = createGame();
game.reset();
window.__game = game;

// --- Interactions ---------------------------------------------------------------

function startFromTitle() {
  game.diff = DIFFICULTIES[game.difficulty];
  game.reset();
  game.mode = 'play';
  game.audio.ensure();
}

function handleClick(x, y, button) {
  game.audio.ensure();
  if (game.mode === 'title') {
    for (const r of difficultyRects()) {
      if (inRect(x, y, r)) {
        game.difficulty = r.key;
        return;
      }
    }
    startFromTitle();
    return;
  }
  if (game.mode === 'over' || game.mode === 'win') {
    game.mode = 'title';
    return;
  }
  if (game.mode !== 'play') return;

  if (button === 2) {
    game.placing = null;
    game.selectedTowerId = 0;
    return;
  }

  const R = panelRects();
  if (x >= FIELD_W) {
    for (const kind of Object.keys(R.shop)) {
      if (inRect(x, y, R.shop[kind])) {
        if (game.gold >= TOWERS[kind].cost) {
          game.placing = game.placing === kind ? null : kind;
          game.selectedTowerId = 0;
        }
        return;
      }
    }
    if (inRect(x, y, R.nova)) { game.fireNova(); return; }
    if (inRect(x, y, R.start)) { game.startWave(); return; }
    if (inRect(x, y, R.speed)) { game.speed = game.speed === 1 ? 2 : 1; return; }
    if (inRect(x, y, R.pause)) { game.paused = !game.paused; return; }
    if (inRect(x, y, R.mute)) { game.audio.muted = !game.audio.muted; return; }
    const sel = selTower(game);
    if (sel && inRect(x, y, R.upgrade) && sel.level < 3) {
      const cost = TOWERS[sel.kind].upCost[sel.level];
      if (game.gold >= cost) {
        game.gold -= cost;
        sel.level += 1;
        sel.invested += cost;
        game.audio.upgrade();
        spawnBurst(game, sel.x, sel.y, '#f5b942', 10, 90);
      }
      return;
    }
    if (sel && inRect(x, y, R.sell)) {
      game.gold += Math.floor(sel.invested * SELL_REFUND);
      game.towers.delete(cellKey(sel.c, sel.r));
      game.selectedTowerId = 0;
      game.audio.place();
      return;
    }
    return;
  }

  // Field clicks.
  const c = Math.floor(x / TILE);
  const r = Math.floor(y / TILE);
  if (game.placing) {
    const def = TOWERS[game.placing];
    if (game.canBuildAt(c, r) && game.gold >= def.cost) {
      const { x: tx, y: ty } = tileCenter(c, r);
      const tower = makeTower(game.placing, c, r, tx, ty);
      game.towers.set(cellKey(c, r), tower);
      game.gold -= def.cost;
      game.selectedTowerId = tower.id;
      game.placing = null;
      game.audio.place();
      spawnBurst(game, tx, ty, '#e8dcc0', 8, 80);
    }
    return;
  }
  const tower = game.towers.get(cellKey(c, r));
  game.selectedTowerId = tower ? tower.id : 0;
}

function handleKey(code) {
  if (game.mode === 'title') {
    if (code === 'Enter' || code === 'Space') startFromTitle();
    return;
  }
  if (game.mode === 'over') {
    if (code === 'KeyR' || code === 'Enter') game.mode = 'title';
    return;
  }
  if (game.mode === 'win') {
    if (code === 'KeyE') {
      game.endless = true;
      game.mode = 'play';
      game.phase = 'build';
    } else if (code === 'KeyR' || code === 'Enter') game.mode = 'title';
    return;
  }
  if (game.mode !== 'play') return;
  switch (code) {
    case 'Space': game.startWave(); break;
    case 'KeyF': game.fireNova(); break;
    case 'KeyP': game.paused = !game.paused; break;
    case 'Escape':
      if (game.placing) game.placing = null;
      else game.paused = !game.paused;
      break;
    case 'KeyM': game.audio.muted = !game.audio.muted; break;
    case 'Tab': game.speed = game.speed === 1 ? 2 : 1; break;
    case 'Digit1': game.placing = 'arrow'; break;
    case 'Digit2': game.placing = 'frost'; break;
    case 'Digit3': game.placing = 'mortar'; break;
    case 'Digit4': game.placing = 'storm'; break;
    default: break;
  }
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// --- Boot + loop ------------------------------------------------------------------

if (shotName) {
  applyShot(game, shotName);
  drawScene(ctx, game);
} else {
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const click of game.input.takeClicks()) handleClick(click.x, click.y, click.button);
    for (const code of game.input.takeKeys()) handleKey(code);
    if (!game.paused) game.update(dt * game.speed);
    drawScene(ctx, game);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
