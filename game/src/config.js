// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Seconds of night to survive: at the end the dawn breaks and the warden wins. */
export const NIGHT_LENGTH = 150;

export const PLAYER = {
  radius: 16,
  speed: 300,
  invulnerable: 1.2,
  maxHp: 3,
};

export const LANTERN = {
  radius: 140,
  damage: 1,
  interval: 1.45,
  minInterval: 0.7,
};

export const FLARE = {
  radius: 230,
  damage: 3,
  maxCharges: 3,
  recharge: 18,
};

/** Enemy kinds. */
export const KIND_WISP = 0;
export const KIND_DART = 1;
export const KIND_BULWARK = 2;
export const KIND_GLOOM = 3;

export const ENEMY = {
  [KIND_WISP]: { radius: 13, hp: 1, speed: 66, score: 10, embers: 1, color: '#8b7cf6' },
  [KIND_DART]: { radius: 11, hp: 1, speed: 135, score: 15, embers: 1, color: '#2dd4bf' },
  [KIND_BULWARK]: { radius: 24, hp: 3, speed: 34, score: 30, embers: 2, color: '#e879f9' },
  [KIND_GLOOM]: { radius: 34, hp: 10, speed: 42, score: 100, embers: 5, color: '#f43f5e' },
};

/** Spawn pacing: interval shrinks from start to end over the night. */
export const SPAWN = { startInterval: 1.0, endInterval: 0.34, maxAlive: 85 };

/** When each kind first appears (seconds into the night); the gloom elite returns every 45 s. */
export const UNLOCK = { [KIND_DART]: 20, [KIND_BULWARK]: 45, [KIND_GLOOM]: 60 };
export const GLOOM_PERIOD = 40;

/** XP to go from level n to n+1. */
export function xpForLevel(level) {
  return 8 + (level - 1) * 6;
}

/** Blessing ids, in the order the level-up screen lists them. */
export const BLESS_WIDE = 0;
export const BLESS_HOT = 1;
export const BLESS_QUICK = 2;
export const BLESS_SWIFT = 3;
export const BLESS_MAGNET = 4;
export const BLESS_HEART = 5;
export const BLESS_FLARE = 6;

export const BLESSINGS = [
  { id: BLESS_WIDE, name: 'Wider Light', desc: 'Lantern reach +28', max: 5 },
  { id: BLESS_HOT, name: 'Hotter Flame', desc: 'Pulse damage +1', max: 3 },
  { id: BLESS_QUICK, name: 'Quicker Pulse', desc: 'Pulse every 0.18 s faster', max: 4 },
  { id: BLESS_SWIFT, name: 'Swift Boots', desc: 'Move speed +40', max: 4 },
  { id: BLESS_MAGNET, name: 'Ember Magnet', desc: 'Ember pull +55', max: 3 },
  { id: BLESS_HEART, name: 'Heartwood', desc: '+1 max heart, heal 1', max: 3 },
  { id: BLESS_FLARE, name: 'Flare Cache', desc: '+1 flare charge, now', max: 2 },
];

/** How many things can exist at once; the pools are allocated once, at boot. */
export const POOL_ENEMY = 80;
export const POOL_EMBER = 120;
export const POOL_PARTICLE = 256;
export const POOL_FLOATER = 24;

export const PALETTE = {
  backdropTop: '#0b0e1a',
  backdropBottom: '#141a2e',
  groundMist: '#1e2a4a',
  player: '#fbbf24',
  playerCloak: '#92400e',
  lanternGlow: '#fde68a',
  ember: '#fb923c',
  panel: '#1a2138',
  panelEdge: '#3b4a6b',
  text: '#f3f0ff',
  muted: '#9aa3c0',
  hp: '#fb7185',
  xp: '#fbbf24',
  danger: '#f43f5e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberwarden.best';
