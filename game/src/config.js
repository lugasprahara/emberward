// EMBERWARD — shared tuning: geometry, palette, tower and enemy definitions,
// and the wave compositions. Pure data and small pure functions; every other
// module reads from here so balance lives in exactly one place.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TILE = 60;
export const COLS = 17; // field is COLS*TILE = 1020 px wide…
export const ROWS = 12; // …and ROWS*TILE = 720 px tall
export const FIELD_W = COLS * TILE;
export const PANEL_X = FIELD_W;
export const PANEL_W = VIEW_W - FIELD_W;

export const START_GOLD = 200;
export const START_LIVES = 20;
export const TOTAL_WAVES = 20;
export const SELL_REFUND = 0.7;
export const INTEREST_RATE = 0.08;
export const INTEREST_CAP = 40;

// Crystal Nova: kills feed the surge meter; at full charge the keeper may
// unleash it — a crystal-centred blast that burns and chills the whole road.
export const SURGE_MAX = 100;
export const SURGE_PER_KILL = 2.2;
export const NOVA_DMG = 90;
export const NOVA_SLOW = 0.6;
export const NOVA_SLOW_DUR = 2.5;

// Mortar shells leave a scorch field: burning ground that hurts over time.
export const SCORCH_DUR = 3.0;
export const SCORCH_DPS = 12;

// Difficulty: chosen on the title screen; scales foe health and the purse.
export const DIFFICULTIES = {
  squire: { name: 'Squire', hpMul: 0.85, goldMul: 1.15, scoreMul: 1 },
  warden: { name: 'Warden', hpMul: 1.0, goldMul: 1.0, scoreMul: 1.5 },
  nightmare: { name: 'Nightmare', hpMul: 1.25, goldMul: 0.9, scoreMul: 2.25 },
};

// Twilight palette: deep indigo sky-shadows, mossy ground, warm ember accents.
export const PAL = {
  groundA: '#2c4632',
  groundB: '#243a2b',
  groundPatch: '#314e38',
  pathFill: '#8a6f4d',
  pathEdge: '#6d5638',
  pathStone: '#9c805a',
  panel: '#171422',
  panelEdge: '#2e2a45',
  ink: '#0f0d18',
  paper: '#f2e7c9',
  dim: '#a99f83',
  gold: '#f5b942',
  ember: '#ff7a3c',
  emberHot: '#ffc46b',
  crystal: '#ffb347',
  frost: '#7fd4ff',
  storm: '#c9a7ff',
  arrow: '#ffe9a8',
  hpGood: '#7dd069',
  hpBad: '#e5484d',
  heart: '#ff5d73',
};

// Tower definitions. statsFor() resolves a level (1..3) to concrete numbers so
// the rest of the code never re-derives upgrade maths.
export const TOWERS = {
  arrow: {
    name: 'Arrow Spire',
    short: 'Arrow',
    color: '#e8c877',
    cost: 50,
    desc: 'Fast bolts, single target.',
    levels: [
      { dmg: 9, rate: 2.3, range: 132 },
      { dmg: 16, rate: 2.7, range: 142 },
      { dmg: 29, rate: 3.3, range: 154 },
    ],
    upCost: [0, 45, 85],
  },
  frost: {
    name: 'Frost Obelisk',
    short: 'Frost',
    color: '#7fd4ff',
    cost: 80,
    desc: 'Chills a cluster, slowing it.',
    levels: [
      { dmg: 3, rate: 1.1, range: 118, slow: 0.45, slowDur: 1.6, splash: 48 },
      { dmg: 6, rate: 1.25, range: 126, slow: 0.55, slowDur: 1.9, splash: 54 },
      { dmg: 11, rate: 1.4, range: 136, slow: 0.65, slowDur: 2.3, splash: 62 },
    ],
    upCost: [0, 70, 130],
  },
  mortar: {
    name: 'Ember Mortar',
    short: 'Mortar',
    color: '#ff7a3c',
    cost: 120,
    desc: 'Lobbed shells, big splash.',
    levels: [
      { dmg: 34, rate: 0.55, range: 178, splash: 58, minRange: 52 },
      { dmg: 62, rate: 0.6, range: 188, splash: 68, minRange: 52 },
      { dmg: 112, rate: 0.66, range: 200, splash: 80, minRange: 52 },
    ],
    upCost: [0, 105, 190],
  },
  storm: {
    name: 'Storm Pylon',
    short: 'Storm',
    color: '#c9a7ff',
    cost: 150,
    desc: 'Lightning that chains foes.',
    levels: [
      { dmg: 14, rate: 0.95, range: 148, chain: 3 },
      { dmg: 25, rate: 1.05, range: 156, chain: 4 },
      { dmg: 42, rate: 1.15, range: 166, chain: 5 },
    ],
    upCost: [0, 130, 240],
  },
};
export const TOWER_ORDER = ['arrow', 'frost', 'mortar', 'storm'];

export function towerStats(kind, level) {
  const def = TOWERS[kind];
  return { ...def.levels[level - 1], def };
}

// Enemy definitions. armor is flat damage reduction per hit (min 1 through).
export const ENEMIES = {
  imp: { name: 'Imp', hp: 22, speed: 47, bounty: 6, leak: 1, r: 13, armor: 0, color: '#b8e26e' },
  runner: { name: 'Runner', hp: 16, speed: 88, bounty: 7, leak: 1, r: 11, armor: 0, color: '#ffd94d' },
  wisp: { name: 'Wisp', hp: 11, speed: 120, bounty: 8, leak: 1, r: 9, armor: 0, color: '#8ef2e2', frostResist: 0.5 },
  brute: { name: 'Brute', hp: 125, speed: 30, bounty: 14, leak: 2, r: 17, armor: 0, color: '#e2804d' },
  golem: { name: 'Shield Golem', hp: 95, speed: 34, bounty: 16, leak: 2, r: 16, armor: 3, color: '#9fb4c7' },
  behemoth: { name: 'Ashen Behemoth', hp: 1500, speed: 21, bounty: 300, leak: 10, r: 26, armor: 2, color: '#ff5d43', boss: true },
};

// Wave strength multiplier: hit points grow ~17% per wave.
export function waveHpMul(wave) {
  return Math.pow(1.17, wave - 1);
}

// A wave is a list of spawn groups {type, count, gap, delay} — delay is the
// pause before the group starts, gap the seconds between its spawns.
export function waveComp(wave) {
  const g = [];
  const add = (type, count, gap, delay = 0) => g.push({ type, count, gap, delay });
  if (wave % 5 === 0) {
    // Boss waves: an escort, the Behemoth, then a trailing pack.
    add('imp', 4 + wave / 2, 0.9);
    if (wave >= 10) add('runner', wave / 2, 0.55, 1.2);
    add('behemoth', wave === 20 ? 2 : 1, 6, 2.0);
    if (wave >= 15) add('golem', 3, 1.4, 1.0);
    add('imp', 6 + wave / 2, 0.6, 1.0);
    return g;
  }
  add('imp', 6 + wave * 2, Math.max(0.45, 1.05 - wave * 0.03));
  if (wave >= 3) add('runner', 2 + wave, 0.5, 1.5);
  if (wave >= 4) add('brute', Math.floor(wave / 2), 1.6, 2.0);
  if (wave >= 6) add('wisp', 3 + wave, 0.34, 1.0);
  if (wave >= 8) add('golem', Math.floor((wave - 5) / 2), 1.5, 2.5);
  if (wave >= 12) add('runner', wave, 0.38, 1.2);
  if (wave >= 16) add('brute', 4, 1.3, 1.5);
  return g;
}

// Named bosses: every fifth wave is led by one, announced on a banner.
// Wave 20 fields two at once — the twins of the final night.
export const BOSS_NAMES = {
  5: 'Gorath, the Cinderback',
  10: 'Vess, Mother of Ash',
  15: 'The Hollow King',
  20: 'Gorath Reborn & The Hollow King',
};

// Short human preview of the next wave for the side panel.
export function wavePreview(wave) {
  if (wave > TOTAL_WAVES) return '—';
  const counts = {};
  for (const grp of waveComp(wave)) counts[grp.type] = (counts[grp.type] ?? 0) + grp.count;
  return Object.entries(counts)
    .map(([t, n]) => `${ENEMIES[t].name} ×${n}`)
    .join(', ');
}
