// All drawing. The static field (ground, road, decorations, gate) is painted
// once onto an offscreen canvas; each frame then draws scorch, towers, foes,
// projectiles and effects over it, and finally the side panel and any
// full-screen state (title, pause, endings). Layout rectangles are exported
// so main.js hit-tests clicks against exactly what is drawn.

import {
  VIEW_W, VIEW_H, TILE, COLS, ROWS, FIELD_W, PANEL_X, PANEL_W, PAL,
  TOWERS, TOWER_ORDER, towerStats, wavePreview, TOTAL_WAVES, SURGE_MAX,
} from './config.js';
import { tileCenter, CRYSTAL_TILE } from './world.js';

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function panelRects() {
  const x = PANEL_X + 14;
  const w = PANEL_W - 28;
  const shop = {};
  TOWER_ORDER.forEach((kind, i) => {
    shop[kind] = { x, y: 168 + i * 62, w, h: 56 };
  });
  return {
    shop,
    nova: { x, y: 108, w, h: 22 },
    selected: { x, y: 424, w, h: 118 },
    upgrade: { x, y: 500, w: 112, h: 34 },
    sell: { x: x + 120, y: 500, w: 112, h: 34 },
    start: { x, y: 610, w, h: 42 },
    speed: { x, y: 662, w: 72, h: 30 },
    pause: { x: x + 80, y: 662, w: 72, h: 30 },
    mute: { x: x + 160, y: 662, w: 72, h: 30 },
  };
}

export function difficultyRects() {
  const w = 176;
  const h = 46;
  const gap = 14;
  const total = w * 3 + gap * 2;
  const x0 = (VIEW_W - total) / 2;
  return ['squire', 'warden', 'nightmare'].map((key, i) => ({
    key, x: x0 + i * (w + gap), y: 486, w, h,
  }));
}

export function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function selTower(game) {
  if (!game.selectedTowerId) return null;
  for (const t of game.towers.values()) if (t.id === game.selectedTowerId) return t;
  return null;
}

// --- Static field -------------------------------------------------------------

function buildGround(game) {
  const cv = document.createElement('canvas');
  cv.width = FIELD_W;
  cv.height = VIEW_H;
  const g = cv.getContext('2d');

  const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, PAL.groundB);
  grad.addColorStop(0.5, PAL.groundA);
  grad.addColorStop(1, PAL.groundB);
  g.fillStyle = grad;
  g.fillRect(0, 0, FIELD_W, VIEW_H);

  // Soft meadow patches.
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * FIELD_W;
    const y = Math.random() * VIEW_H;
    g.fillStyle = `rgba(255, 240, 190, ${0.012 + Math.random() * 0.02})`;
    g.beginPath();
    g.ellipse(x, y, 20 + Math.random() * 46, 12 + Math.random() * 26, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }

  // The road: a wide stroked polyline with a stony edge and cobble speckles.
  const pts = game.world.pts;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = PAL.pathEdge;
  g.lineWidth = TILE * 0.92;
  tracePath(g, pts);
  g.strokeStyle = PAL.pathFill;
  g.lineWidth = TILE * 0.8;
  tracePath(g, pts);
  g.fillStyle = PAL.pathStone;
  for (let i = 0; i < 340; i++) {
    // Speckles only near the road: sample a random segment point.
    const seg = game.world.segments[Math.floor(Math.random() * game.world.segments.length)];
    const t = Math.random();
    const x = seg.a.x + (seg.b.x - seg.a.x) * t + (Math.random() - 0.5) * TILE * 0.62;
    const y = seg.a.y + (seg.b.y - seg.a.y) * t + (Math.random() - 0.5) * TILE * 0.62;
    g.globalAlpha = 0.25 + Math.random() * 0.3;
    g.beginPath();
    g.ellipse(x, y, 3 + Math.random() * 5, 2 + Math.random() * 3.4, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  // Decorations under everything dynamic.
  for (const d of game.world.decorations) drawDecoration(g, d);

  // The gate the horde pours from: a dark arch at the road's mouth.
  const gate = tileCenter(0, 2);
  g.fillStyle = '#14101f';
  g.beginPath();
  g.ellipse(gate.x - 22, gate.y, 20, 34, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#3d3358';
  g.lineWidth = 4;
  g.stroke();
  g.fillStyle = 'rgba(255, 122, 60, 0.55)';
  g.beginPath();
  g.ellipse(gate.x - 22, gate.y + 8, 9, 16, 0, 0, Math.PI * 2);
  g.fill();

  return cv;
}

function tracePath(g, pts) {
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.stroke();
}

function drawDecoration(g, d) {
  g.save();
  g.translate(d.x, d.y);
  g.scale(d.s, d.s);
  if (d.kind === 'pine') {
    g.fillStyle = '#5a4632';
    g.fillRect(-2.5, 2, 5, 8);
    g.fillStyle = '#1d3325';
    for (let i = 0; i < 3; i++) {
      const w = 17 - i * 4;
      const y = 4 - i * 8;
      g.beginPath();
      g.moveTo(-w / 2, y);
      g.lineTo(w / 2, y);
      g.lineTo(0, y - 11);
      g.closePath();
      g.fill();
    }
    g.fillStyle = 'rgba(255, 196, 107, 0.20)';
    g.beginPath();
    g.moveTo(0, -21);
    g.lineTo(6, -9);
    g.lineTo(0, -9);
    g.closePath();
    g.fill();
  } else if (d.kind === 'rock') {
    g.fillStyle = '#5d6066';
    g.beginPath();
    g.ellipse(0, 2, 11, 7, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.fillStyle = '#787c84';
    g.beginPath();
    g.ellipse(-3, 0, 6, 4, 0, Math.PI, Math.PI * 2);
    g.fill();
  } else if (d.kind === 'tuft') {
    g.strokeStyle = '#41684a';
    g.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(i * 3, 4);
      g.quadraticCurveTo(i * 4, -3, i * 5, -7 - Math.abs(i));
      g.stroke();
    }
  } else if (d.kind === 'bloom') {
    g.fillStyle = '#ff9fb0';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.beginPath();
      g.ellipse(Math.cos(a) * 3.4, Math.sin(a) * 3.4, 2.6, 2.6, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffd94d';
    g.beginPath();
    g.arc(0, 0, 2.2, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// --- Pieces -------------------------------------------------------------------

function drawCrystal(ctx, game) {
  const { x, y } = tileCenter(CRYSTAL_TILE.c, CRYSTAL_TILE.r);
  const pulse = 0.5 + 0.5 * Math.sin(game.time * 2.2);
  const surgeGlow = game.surge >= SURGE_MAX ? 0.35 + 0.3 * Math.sin(game.time * 9) : 0;
  const glow = ctx.createRadialGradient(x, y, 4, x, y, 66 + pulse * 10);
  glow.addColorStop(0, `rgba(255, 179, 71, ${0.5 + surgeGlow})`);
  glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 90, y - 90, 180, 180);
  // Stone plinth.
  ctx.fillStyle = '#4a4238';
  ctx.beginPath();
  ctx.ellipse(x, y + 20, 30, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Crystal shards.
  const shards = [
    { dx: 0, h: 52, w: 15, lean: 0 },
    { dx: -16, h: 34, w: 10, lean: -0.22 },
    { dx: 15, h: 38, w: 11, lean: 0.2 },
  ];
  for (const s of shards) {
    ctx.save();
    ctx.translate(x + s.dx, y + 18);
    ctx.rotate(s.lean);
    const grad = ctx.createLinearGradient(0, 0, 0, -s.h);
    grad.addColorStop(0, '#e07f2e');
    grad.addColorStop(1, '#ffd98a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-s.w / 2, 0);
    ctx.lineTo(0, -s.h);
    ctx.lineTo(s.w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(0, -s.h);
    ctx.lineTo(s.w / 2, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawTower(ctx, tower, game) {
  const { x, y } = tower;
  // Stone base.
  ctx.fillStyle = '#4e4860';
  ctx.beginPath();
  ctx.ellipse(x, y + 15, 21, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#655d78';
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 17.5, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.32, 1.32);
  if (tower.kind === 'arrow') {
    ctx.fillStyle = '#8a6844';
    ctx.beginPath();
    ctx.moveTo(-11, 12);
    ctx.lineTo(-6, -16);
    ctx.lineTo(6, -16);
    ctx.lineTo(11, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a37d50';
    ctx.fillRect(-13, -20, 26, 6);
    ctx.save();
    ctx.rotate(tower.ang + Math.PI / 2);
    ctx.strokeStyle = '#5d422a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, -20);
    ctx.quadraticCurveTo(0, -27, 10, -20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(0, -14);
    ctx.stroke();
    ctx.restore();
  } else if (tower.kind === 'frost') {
    const grad = ctx.createLinearGradient(0, 12, 0, -26);
    grad.addColorStop(0, '#3f7ea6');
    grad.addColorStop(1, '#bdeaff');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-9, 12);
    ctx.lineTo(-4, -22);
    ctx.lineTo(0, -30);
    ctx.lineTo(4, -22);
    ctx.lineTo(9, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(0, -12, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (tower.kind === 'mortar') {
    ctx.fillStyle = '#3d3a44';
    ctx.beginPath();
    ctx.ellipse(0, 6, 15, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.rotate(tower.ang);
    ctx.fillStyle = '#26242e';
    ctx.fillRect(2, -5, 20, 10);
    ctx.fillStyle = '#ff7a3c';
    ctx.beginPath();
    ctx.arc(21, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255, 122, 60, 0.30)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (tower.kind === 'storm') {
    ctx.fillStyle = '#4c4364';
    ctx.beginPath();
    ctx.moveTo(-7, 12);
    ctx.lineTo(-2.5, -18);
    ctx.lineTo(2.5, -18);
    ctx.lineTo(7, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6a5a94';
    ctx.fillRect(-5, -4, 10, 3);
    const glow = 0.6 + 0.4 * Math.sin(game.time * 3 + tower.id);
    ctx.fillStyle = `rgba(201, 167, 255, ${0.35 * glow})`;
    ctx.beginPath();
    ctx.arc(0, -24, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9c2ff';
    ctx.beginPath();
    ctx.arc(0, -24, 6.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Muzzle flash.
  if (tower.muzzle > 0) {
    ctx.fillStyle = 'rgba(255, 233, 168, 0.85)';
    ctx.beginPath();
    ctx.arc(x + Math.cos(tower.ang) * 24, y + Math.sin(tower.ang) * 24 - 8, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Level pips.
  for (let i = 0; i < tower.level; i++) {
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    ctx.arc(x - 8 + i * 8, y + 25, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemy(ctx, e, game) {
  const r = e.def.r;
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(1.18, 1.18);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.85, r * 0.9, r * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  const bob = Math.sin(e.wob) * 1.2;
  ctx.translate(0, bob * 0.4);
  if (e.type === 'wisp') {
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2);
    halo.addColorStop(0, 'rgba(142, 242, 226, 0.55)');
    halo.addColorStop(1, 'rgba(142, 242, 226, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    ctx.fillStyle = '#c9fff6';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = e.def.color;
    ctx.beginPath();
    if (e.type === 'brute' || e.type === 'golem') {
      rr(ctx, -r, -r * 0.9, r * 2, r * 1.9, 6);
      ctx.fill();
    } else {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.type === 'imp') {
      ctx.fillStyle = '#8fbf4d';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.5, -r * 0.7);
        ctx.lineTo(s * r * 1.05, -r * 1.25);
        ctx.lineTo(s * r * 0.95, -r * 0.35);
        ctx.closePath();
        ctx.fill();
      }
    } else if (e.type === 'runner') {
      ctx.strokeStyle = 'rgba(255, 217, 77, 0.6)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-r - 4 - i * 5, -4 + i * 4);
        ctx.lineTo(-r + 2 - i * 5, -4 + i * 4);
        ctx.stroke();
      }
    } else if (e.type === 'golem') {
      ctx.fillStyle = '#c8d6e2';
      rr(ctx, -r * 0.55, -r * 0.5, r * 1.1, r * 1.1, 3);
      ctx.fill();
      ctx.fillStyle = '#7e93a8';
      for (const [px, py] of [[-r * 0.35, -r * 0.3], [r * 0.35, -r * 0.3], [-r * 0.35, r * 0.35], [r * 0.35, r * 0.35]]) {
        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (e.type === 'behemoth') {
      ctx.fillStyle = '#8f2f22';
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 9 - 4, -r + 2);
        ctx.lineTo(i * 9, -r - 12);
        ctx.lineTo(i * 9 + 4, -r + 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.2);
      ctx.quadraticCurveTo(0, r * 0.55, r * 0.55, -r * 0.1);
      ctx.stroke();
    }
    // Eyes, turned toward travel.
    const ex = Math.cos(e.ang) * r * 0.34;
    const ey = Math.sin(e.ang) * r * 0.2;
    ctx.fillStyle = '#14101c';
    ctx.beginPath();
    ctx.arc(ex - 3.4, ey - 1, 1.9, 0, Math.PI * 2);
    ctx.arc(ex + 3.4, ey - 1, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.flash > 0) {
    ctx.globalAlpha = Math.min(1, e.flash * 9);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (game.time < e.slowUntil) {
    ctx.fillStyle = 'rgba(127, 212, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, r + 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Health bar (always for bosses and brutes; for others when hurt).
  if (e.hp < e.maxHp) {
    const w = e.def.boss ? 64 : 30;
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(10, 8, 16, 0.75)';
    ctx.fillRect(e.x - w / 2, e.y - r - 13, w, 5);
    ctx.fillStyle = frac > 0.35 ? PAL.hpGood : PAL.hpBad;
    ctx.fillRect(e.x - w / 2 + 0.5, e.y - r - 12.5, (w - 1) * frac, 4);
  }
}

// --- Panel ----------------------------------------------------------------------

function text(ctx, str, x, y, font, color, align = 'left') {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}

function drawPanel(ctx, game) {
  const R = panelRects();
  ctx.fillStyle = PAL.panel;
  ctx.fillRect(PANEL_X, 0, PANEL_W, VIEW_H);
  ctx.fillStyle = PAL.panelEdge;
  ctx.fillRect(PANEL_X, 0, 2, VIEW_H);

  const cx = PANEL_X + PANEL_W / 2;
  text(ctx, 'E M B E R W A R D', cx, 30, '700 17px Georgia, serif', PAL.paper, 'center');
  text(ctx, `${game.diff.name} · Score ${game.score}`, cx, 50, '12px system-ui', PAL.dim, 'center');

  // Stats row.
  const lx = PANEL_X + 16;
  const rx = PANEL_X + PANEL_W - 16;
  text(ctx, `◆ ${game.gold} gold`, lx, 76, '700 14px system-ui', PAL.gold);
  text(ctx, `♥ ${game.lives}`, rx, 76, '700 14px system-ui', PAL.heart, 'right');
  text(ctx, game.endless ? `Wave ∞ ${game.wave}` : `Wave ${Math.min(game.wave, TOTAL_WAVES)} / ${TOTAL_WAVES}`, lx, 96, '13px system-ui', PAL.paper);
  text(ctx, `Foes left ${game.enemies.length + game.spawnQueue.length}`, rx, 96, '12px system-ui', PAL.dim, 'right');

  // Surge meter / Nova button.
  const surgeFull = game.surge >= SURGE_MAX;
  ctx.fillStyle = '#241f38';
  rr(ctx, R.nova.x, R.nova.y, R.nova.w, R.nova.h, 6);
  ctx.fill();
  ctx.fillStyle = surgeFull ? '#ff7a3c' : '#574a7a';
  const sw = (R.nova.w - 4) * (game.surge / SURGE_MAX);
  if (sw > 2) {
    rr(ctx, R.nova.x + 2, R.nova.y + 2, sw, R.nova.h - 4, 4);
    ctx.fill();
  }
  text(ctx, surgeFull ? '✦ FIRE CRYSTAL NOVA (F)' : `Crystal surge ${Math.floor(game.surge)}%`,
    cx, R.nova.y + 15, '700 11px system-ui', surgeFull ? '#fff' : PAL.dim, 'center');

  text(ctx, 'WARD-TOWERS — click, then click a tile', lx, 156, '700 11px system-ui', PAL.dim);

  // Shop cards.
  TOWER_ORDER.forEach((kind, i) => {
    const def = TOWERS[kind];
    const r = R.shop[kind];
    const afford = game.gold >= def.cost;
    const selected = game.placing === kind;
    ctx.fillStyle = selected ? '#2e2a4d' : '#1e1a30';
    rr(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = selected ? PAL.gold : PAL.panelEdge;
    ctx.lineWidth = selected ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(r.x + 22, r.y + 28, 11, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, def.name, r.x + 42, r.y + 22, '700 13px system-ui', PAL.paper);
    text(ctx, def.desc, r.x + 42, r.y + 40, '11px system-ui', PAL.dim);
    text(ctx, `${def.cost}g`, r.x + r.w - 10, r.y + 22, '700 13px system-ui', afford ? PAL.gold : PAL.hpBad, 'right');
    text(ctx, `[${i + 1}]`, r.x + r.w - 10, r.y + 42, '11px system-ui', PAL.dim, 'right');
  });

  // Selected tower / selection hint.
  const S = R.selected;
  ctx.fillStyle = '#1e1a30';
  rr(ctx, S.x, S.y, S.w, S.h, 8);
  ctx.fill();
  ctx.strokeStyle = PAL.panelEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  const sel = selTower(game);
  if (sel) {
    const stats = towerStats(sel.kind, sel.level);
    text(ctx, `${stats.def.name} · Lv ${sel.level}`, S.x + 12, S.y + 22, '700 13px system-ui', PAL.paper);
    text(ctx, `Damage ${stats.dmg} · Range ${stats.range} · Rate ${stats.rate}/s`, S.x + 12, S.y + 42, '11px system-ui', PAL.dim);
    if (sel.level < 3) {
      const cost = stats.def.upCost[sel.level];
      ctx.fillStyle = game.gold >= cost ? '#2c4a2e' : '#2a2438';
      rr(ctx, R.upgrade.x, R.upgrade.y, R.upgrade.w, R.upgrade.h, 6);
      ctx.fill();
      text(ctx, `Upgrade ${cost}g`, R.upgrade.x + R.upgrade.w / 2, R.upgrade.y + 21, '700 12px system-ui', game.gold >= cost ? '#b8e6a0' : PAL.dim, 'center');
    } else {
      text(ctx, 'MAX LEVEL', R.upgrade.x + R.upgrade.w / 2, R.upgrade.y + 21, '700 12px system-ui', PAL.gold, 'center');
    }
    const refund = Math.floor(sel.invested * 0.7);
    ctx.fillStyle = '#4a2c2c';
    rr(ctx, R.sell.x, R.sell.y, R.sell.w, R.sell.h, 6);
    ctx.fill();
    text(ctx, `Sell +${refund}g`, R.sell.x + R.sell.w / 2, R.sell.y + 21, '700 12px system-ui', '#f0a3a3', 'center');
  } else if (game.placing) {
    text(ctx, `Placing: ${TOWERS[game.placing].name}`, S.x + 12, S.y + 26, '700 13px system-ui', PAL.paper);
    text(ctx, 'Click a free tile to build.', S.x + 12, S.y + 48, '12px system-ui', PAL.dim);
    text(ctx, 'Right-click or Esc to cancel.', S.x + 12, S.y + 68, '12px system-ui', PAL.dim);
  } else {
    text(ctx, 'No tower selected.', S.x + 12, S.y + 26, '700 13px system-ui', PAL.paper);
    text(ctx, 'Click a tower to upgrade or sell it.', S.x + 12, S.y + 48, '12px system-ui', PAL.dim);
    text(ctx, 'Kills feed the crystal surge;', S.x + 12, S.y + 72, '12px system-ui', PAL.dim);
    text(ctx, 'banked gold earns interest each wave.', S.x + 12, S.y + 90, '12px system-ui', PAL.dim);
  }

  // Next wave preview.
  if (!game.endless && game.wave < TOTAL_WAVES) {
    text(ctx, `NEXT — WAVE ${game.wave + 1}`, lx, 566, '700 11px system-ui', PAL.dim);
    wrapText(ctx, wavePreview(game.wave + 1), lx, 584, PANEL_W - 32, 15, '12px system-ui', PAL.paper);
  } else if (game.endless) {
    text(ctx, 'ENDLESS — the horde never tires.', lx, 566, '700 11px system-ui', PAL.dim);
  }

  // Buttons.
  const canStart = game.phase === 'build';
  ctx.fillStyle = canStart ? '#8a4b1f' : '#2a2438';
  rr(ctx, R.start.x, R.start.y, R.start.w, R.start.h, 8);
  ctx.fill();
  text(ctx, game.phase === 'wave' ? `— WAVE ${game.wave} IN PROGRESS —` : `▶  START WAVE ${game.endless ? game.wave + 1 : Math.min(game.wave + 1, TOTAL_WAVES)}  (Space)`,
    cx, R.start.y + 27, '700 13px system-ui', canStart ? '#ffe9c9' : PAL.dim, 'center');
  for (const [rect, label] of [[R.speed, `Speed ×${game.speed}`], [R.pause, game.paused ? 'Resume' : 'Pause'], [R.mute, game.audio.muted ? 'Muted' : 'Sound']]) {
    ctx.fillStyle = '#1e1a30';
    rr(ctx, rect.x, rect.y, rect.w, rect.h, 6);
    ctx.fill();
    text(ctx, label, rect.x + rect.w / 2, rect.y + 20, '11px system-ui', PAL.paper, 'center');
  }
}

function wrapText(ctx, str, x, y, maxW, lh, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  const words = str.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

// --- Screens --------------------------------------------------------------------

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(10, 8, 20, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const cx = VIEW_W / 2;
  text(ctx, 'EMBERWARD', cx, 168, '700 84px Georgia, serif', PAL.paper, 'center');
  text(ctx, 'Hold the twilight road. Keep the last Ember Crystal burning.', cx, 208, 'italic 19px Georgia, serif', PAL.emberHot, 'center');
  wrapCenter(ctx,
    'The Ashen Horde walks the old road at dusk. Raise ward-towers — Arrow Spires, Frost Obelisks, '
    + 'Ember Mortars and Storm Pylons — chill them, scorch the road beneath them, and when the crystal '
    + 'surges, answer with its Nova. Twenty waves. Four named Behemoths. One crystal.',
    cx, 262, 760, 24, '15px system-ui', PAL.paper);
  text(ctx, 'BUILD  click a tower card, then a tile      START WAVE  Space      NOVA  F when the surge is full', cx, 356, '13px system-ui', PAL.dim, 'center');
  text(ctx, 'UPGRADE / SELL  click a placed tower      PAUSE  P      SPEED  Tab', cx, 380, '13px system-ui', PAL.dim, 'center');

  text(ctx, 'CHOOSE YOUR WATCH', cx, 452, '700 13px system-ui', PAL.dim, 'center');
  for (const r of difficultyRects()) {
    const active = game.difficulty === r.key;
    ctx.fillStyle = active ? '#8a4b1f' : '#1e1a30';
    rr(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = active ? PAL.gold : PAL.panelEdge;
    ctx.lineWidth = active ? 2 : 1;
    ctx.stroke();
    const names = { squire: 'SQUIRE', warden: 'WARDEN', nightmare: 'NIGHTMARE' };
    text(ctx, names[r.key], r.x + r.w / 2, r.y + 29, '700 15px system-ui', active ? '#ffe9c9' : PAL.paper, 'center');
  }
  if (Math.floor(game.time * 1.6) % 2 === 0) {
    text(ctx, '— click anywhere, or press Enter, to take the watch —', cx, 592, '15px system-ui', PAL.emberHot, 'center');
  }
  text(ctx, 'Survive all 20 waves to win. Endless night awaits the victorious.', cx, 640, '13px system-ui', PAL.dim, 'center');
}

function wrapCenter(ctx, str, cx, y, maxW, lh, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  const words = str.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
}

function drawEndScreen(ctx, game, won) {
  ctx.fillStyle = 'rgba(10, 8, 20, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const cx = VIEW_W / 2;
  text(ctx, won ? 'THE CRYSTAL ENDURES' : 'THE EMBER FALLS', cx, 218, '700 54px Georgia, serif', won ? PAL.emberHot : '#c9ccd6', 'center');
  text(ctx, won
    ? 'Twenty waves broken against your wards. The road is quiet — for now.'
    : `The horde reached the crystal on wave ${game.wave}. The dark takes the road.`,
  cx, 262, 'italic 16px Georgia, serif', PAL.paper, 'center');
  const lines = [
    `Score ${game.score}`,
    `Waves held ${won ? TOTAL_WAVES : game.wave - (game.phase === 'wave' ? 1 : 0)} of ${TOTAL_WAVES} · Foes felled ${game.kills} · Leaks ${game.leaks}`,
    `Difficulty ${game.diff.name}`,
  ];
  lines.forEach((s, i) => text(ctx, s, cx, 330 + i * 30, '16px system-ui', PAL.paper, 'center'));
  if (won) text(ctx, 'Press E for the Endless night — or R to play again.', cx, 452, '15px system-ui', PAL.emberHot, 'center');
  else text(ctx, 'Press R or click to take the watch again.', cx, 452, '15px system-ui', PAL.emberHot, 'center');
}

function drawBanner(ctx, game) {
  if (game.bannerTtl <= 0) return;
  const a = Math.min(1, game.bannerTtl / 0.5, (3 - game.bannerTtl) / 0.5 + 0.4);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  const w = 520;
  const x = (FIELD_W - w) / 2;
  ctx.fillStyle = 'rgba(16, 12, 28, 0.82)';
  rr(ctx, x, 84, w, game.bannerSub ? 74 : 56, 10);
  ctx.fill();
  ctx.strokeStyle = game.bannerBoss ? '#ff5d43' : PAL.gold;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, game.banner, FIELD_W / 2, 122, '700 26px Georgia, serif', game.bannerBoss ? '#ffb0a3' : PAL.paper, 'center');
  if (game.bannerSub) text(ctx, game.bannerSub, FIELD_W / 2, 146, 'italic 14px Georgia, serif', PAL.emberHot, 'center');
  ctx.restore();
}

// --- Main entry -------------------------------------------------------------------

export function drawScene(ctx, game) {
  if (!game.groundCanvas) game.groundCanvas = buildGround(game);
  ctx.save();
  if (game.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }
  ctx.drawImage(game.groundCanvas, 0, 0);

  // Scorch fields.
  for (const s of game.scorch) {
    const a = 0.35 * (s.ttl / s.maxTtl);
    const grad = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, s.r);
    grad.addColorStop(0, `rgba(255, 122, 60, ${a + 0.18})`);
    grad.addColorStop(1, 'rgba(255, 122, 60, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCrystal(ctx, game);

  // Placement ghost + range ring.
  const mouse = game.input.mouse;
  if (game.mode === 'play' && game.placing && mouse.inside && mouse.x < FIELD_W) {
    const c = Math.floor(mouse.x / TILE);
    const r = Math.floor(mouse.y / TILE);
    const { x, y } = tileCenter(c, r);
    const ok = game.canBuildAt(c, r) && game.gold >= TOWERS[game.placing].cost;
    ctx.fillStyle = ok ? 'rgba(125, 208, 105, 0.3)' : 'rgba(229, 72, 77, 0.3)';
    ctx.fillRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4);
    const stats = towerStats(game.placing, 1);
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.5)' : 'rgba(229,72,77,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, stats.range, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Selected tower range ring.
  const sel = selTower(game);
  if (sel) {
    const stats = towerStats(sel.kind, sel.level);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sel.x, sel.y, stats.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Towers, then foes sorted by y for a hint of depth, then projectiles & fx.
  for (const t of game.towers.values()) drawTower(ctx, t, game);
  const sorted = [...game.enemies].sort((a, b) => a.y - b.y);
  for (const e of sorted) drawEnemy(ctx, e, game);

  for (const p of game.projectiles) {
    if (p.kind === 'shell') {
      const gy = p.sy + (p.ty - p.sy) * p.t;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x, gy + 6, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2733';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff7a3c';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'shard') {
      ctx.fillStyle = '#aee6ff';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const p of game.particles) {
    const a = Math.max(0, p.ttl / p.maxTtl);
    if (p.kind === 'spark') {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'ring') {
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'bolt') {
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.pts[0].x, p.pts[0].y);
      for (let i = 1; i < p.pts.length; i++) ctx.lineTo(p.pts[i].x, p.pts[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  for (const f of game.floaters) {
    ctx.globalAlpha = Math.min(1, f.ttl);
    text(ctx, f.text, f.x, f.y, '700 13px system-ui', f.color, 'center');
    ctx.globalAlpha = 1;
  }

  // Boss bar.
  const boss = game.enemies.find((e) => e.def.boss);
  if (boss && game.mode === 'play') {
    const w = 460;
    const x = (FIELD_W - w) / 2;
    ctx.fillStyle = 'rgba(10, 8, 16, 0.8)';
    rr(ctx, x, 14, w, 26, 6);
    ctx.fill();
    const frac = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = '#ff5d43';
    rr(ctx, x + 3, 30, (w - 6) * frac, 7, 3);
    ctx.fill();
    text(ctx, `${game.bossName || 'BEHEMOTH'} — ${Math.max(0, Math.ceil(boss.hp))} HP`, FIELD_W / 2, 27, '700 11px system-ui', '#ffb0a3', 'center');
  }

  drawBanner(ctx, game);
  ctx.restore();

  drawPanel(ctx, game);

  if (game.mode === 'title') drawTitle(ctx, game);
  if (game.mode === 'over') drawEndScreen(ctx, game, false);
  if (game.mode === 'win') drawEndScreen(ctx, game, true);
  if (game.paused && game.mode === 'play') {
    ctx.fillStyle = 'rgba(10, 8, 20, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, 'PAUSED', VIEW_W / 2, 350, '700 44px Georgia, serif', PAL.paper, 'center');
    text(ctx, 'Press P to resume.', VIEW_W / 2, 392, '15px system-ui', PAL.dim, 'center');
  }
  // Vignette.
  const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.55, VIEW_W / 2, VIEW_H / 2, VIEW_H * 1.05);
  vg.addColorStop(0, 'rgba(8, 6, 16, 0)');
  vg.addColorStop(1, 'rgba(8, 6, 16, 0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
