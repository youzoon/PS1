// ============================================================
//  Game data: heroes, moves, enemies, bosses, levels, cards, skill tree,
//  achievements, cheats. All characters are original to this game.
// ============================================================
const BUILDS = {
  hero: { s: 1, head: 21, torso: 28, width: 30, limb: 9, leg: 15, arm: 15 },
  slim: { s: 0.98, head: 20, torso: 27, width: 26, limb: 8, leg: 15, arm: 15 },
  heavy: { s: 1.1, head: 21, torso: 34, width: 44, limb: 12, leg: 15, arm: 17 },
  small: { s: 0.8, head: 22, torso: 24, width: 26, limb: 8, leg: 13, arm: 13 },
  thin: { s: 1, head: 20, torso: 28, width: 22, limb: 6, leg: 16, arm: 15 },
  brute: { s: 1.22, head: 20, torso: 34, width: 46, limb: 13, leg: 15, arm: 18 },
};
const L = (o) => Object.assign({ build: BUILDS.hero, skin: '#f2c39b', hair: '#3a2418', hairStyle: 'bob', top: '#888', pants: '#444', shoes: '#1b1030', weapon: 'none', blush: false }, o);

// ---------------- moves ----------------
// windup/active/recover in seconds; hit box relative to fighter (x forward from center)
const MOVES = {
  jab: { pose: 'jab', windup: 0.07, active: 0.08, recover: 0.12, hit: { x0: 8, x1: 58, y0: 40, y1: 90, zr: 22 }, dmg: 1, kx: 60, ky: 0, fall: 18, stop: 0.05, sfx: 'hit', lunge: 60 },
  cross: { pose: 'cross', windup: 0.08, active: 0.08, recover: 0.14, hit: { x0: 8, x1: 62, y0: 40, y1: 90, zr: 22 }, dmg: 1, kx: 80, ky: 0, fall: 20, stop: 0.06, sfx: 'hit', lunge: 80 },
  upper: { pose: 'upper', windup: 0.1, active: 0.1, recover: 0.24, hit: { x0: 4, x1: 62, y0: 30, y1: 120, zr: 24 }, dmg: 1, kx: 190, ky: 360, fall: 100, stop: 0.09, sfx: 'heavy', lunge: 120, finisher: true },
  kick: { pose: 'kick', windup: 0.1, active: 0.1, recover: 0.2, hit: { x0: 10, x1: 70, y0: 20, y1: 70, zr: 22 }, dmg: 1, kx: 240, ky: 160, fall: 100, stop: 0.08, sfx: 'heavy', lunge: 90, finisher: true },
  thrust: { pose: 'thrust', windup: 0.05, active: 0.07, recover: 0.09, hit: { x0: 8, x1: 66, y0: 40, y1: 90, zr: 20 }, dmg: 1, kx: 40, ky: 0, fall: 14, stop: 0.04, sfx: 'hit', lunge: 70 },
  spin: { pose: 'spin', windup: 0.08, active: 0.2, recover: 0.18, hit: { x0: -60, x1: 70, y0: 20, y1: 100, zr: 30 }, dmg: 1, kx: 220, ky: 220, fall: 100, stop: 0.07, sfx: 'heavy', lunge: 60, finisher: true, multi: 0.1 },
  poke: { pose: 'thrust', windup: 0.08, active: 0.08, recover: 0.14, hit: { x0: 10, x1: 96, y0: 40, y1: 90, zr: 20 }, dmg: 1, kx: 70, ky: 0, fall: 20, stop: 0.05, sfx: 'hit', lunge: 40 },
  swing: { pose: 'swing', windup: 0.12, active: 0.1, recover: 0.16, hit: { x0: 0, x1: 92, y0: 20, y1: 130, zr: 26 }, dmg: 1, kx: 110, ky: 40, fall: 30, stop: 0.07, sfx: 'hit', lunge: 50 },
  swingBig: { pose: 'swing', windup: 0.16, active: 0.12, recover: 0.26, hit: { x0: -10, x1: 104, y0: 10, y1: 140, zr: 30 }, dmg: 1, kx: 260, ky: 260, fall: 100, stop: 0.1, sfx: 'heavy', lunge: 60, finisher: true },
  hammer1: { pose: 'swing', windup: 0.17, active: 0.1, recover: 0.2, hit: { x0: 0, x1: 100, y0: 10, y1: 130, zr: 28 }, dmg: 1, kx: 160, ky: 60, fall: 40, stop: 0.09, sfx: 'heavy', lunge: 40 },
  slam: { pose: 'slam', windup: 0.24, active: 0.1, recover: 0.3, hit: { x0: 0, x1: 116, y0: 0, y1: 120, zr: 36 }, dmg: 1, kx: 200, ky: 320, fall: 100, stop: 0.13, sfx: 'quake', lunge: 30, finisher: true, shake: 8, shock: true },
  flykick: { pose: 'flykick', windup: 0.04, active: 0.3, recover: 0.1, hit: { x0: 4, x1: 64, y0: 0, y1: 70, zr: 24 }, dmg: 1.1, kx: 200, ky: 160, fall: 100, stop: 0.07, sfx: 'heavy', air: true },
  dashpunch: { pose: 'thrust', windup: 0.04, active: 0.16, recover: 0.2, hit: { x0: 4, x1: 66, y0: 30, y1: 100, zr: 24 }, dmg: 1.4, kx: 300, ky: 200, fall: 100, stop: 0.08, sfx: 'heavy', lunge: 320 },
  // enemy flavours
  claw: { pose: 'lunge', windup: 0.28, active: 0.1, recover: 0.35, hit: { x0: 4, x1: 58, y0: 20, y1: 90, zr: 22 }, dmg: 1, kx: 90, ky: 40, fall: 25, stop: 0.05, sfx: 'hit', lunge: 120 },
  club: { pose: 'swing', windup: 0.38, active: 0.1, recover: 0.45, hit: { x0: 0, x1: 84, y0: 20, y1: 120, zr: 26 }, dmg: 1.12, kx: 160, ky: 120, fall: 60, stop: 0.08, sfx: 'heavy', lunge: 40 },
  punchE: { pose: 'jab', windup: 0.3, active: 0.08, recover: 0.35, hit: { x0: 8, x1: 58, y0: 40, y1: 90, zr: 22 }, dmg: 1, kx: 80, ky: 0, fall: 25, stop: 0.05, sfx: 'hit', lunge: 70 },
  kickE: { pose: 'kick', windup: 0.36, active: 0.1, recover: 0.4, hit: { x0: 10, x1: 70, y0: 20, y1: 70, zr: 22 }, dmg: 1.1, kx: 200, ky: 120, fall: 60, stop: 0.06, sfx: 'heavy', lunge: 60 },
  spearE: { pose: 'thrust', windup: 0.45, active: 0.1, recover: 0.45, hit: { x0: 10, x1: 100, y0: 40, y1: 90, zr: 20 }, dmg: 1.05, kx: 140, ky: 0, fall: 40, stop: 0.06, sfx: 'hit', lunge: 60 },
  slamE: { pose: 'slam', windup: 0.6, active: 0.1, recover: 0.6, hit: { x0: -10, x1: 110, y0: 0, y1: 130, zr: 36 }, dmg: 1.3, kx: 220, ky: 280, fall: 100, stop: 0.1, sfx: 'quake', lunge: 20, shake: 7, shock: true },
  bump: { pose: 'lunge', windup: 0.3, active: 0.15, recover: 0.4, hit: { x0: -10, x1: 50, y0: 0, y1: 60, zr: 24 }, dmg: 1, kx: 100, ky: 100, fall: 30, stop: 0.05, sfx: 'hit', lunge: 160 },
  swoop: { pose: 'lunge', windup: 0.25, active: 0.25, recover: 0.4, hit: { x0: -20, x1: 40, y0: 20, y1: 90, zr: 26 }, dmg: 1, kx: 80, ky: 20, fall: 20, stop: 0.04, sfx: 'hit', lunge: 260 },
  golemSmash: { pose: 'slam', windup: 0.65, active: 0.12, recover: 0.6, hit: { x0: 0, x1: 120, y0: 0, y1: 140, zr: 40 }, dmg: 1.3, kx: 260, ky: 300, fall: 100, stop: 0.12, sfx: 'quake', lunge: 10, shake: 10, shock: true },
};

// ---------------- heroes ----------------
const WEAPON_TYPES = {
  gauntlets: { combo: ['jab', 'cross', 'upper'], dmg: [9, 9, 17], names: ['Brass Knuckles', 'Ember Knuckles', 'Sunfist Gauntlets'], colors: ['#d9a55b', '#ff7a2f', '#ffe45c'], glow: [null, '#ff7a2f', '#ffe45c'] },
  staff: { combo: ['poke', 'swing', 'swingBig'], dmg: [8, 9, 15], names: ['Birch Staff', 'Frost Rod', 'Glacier Scepter'], colors: ['#c9c3de', '#7fe3ff', '#e6fbff'], glow: ['#7fe3ff', '#7fe3ff', '#bff5ff'] },
  hammer: { combo: ['hammer1', 'hammer1', 'slam'], dmg: [15, 15, 26], names: ['Mallet', 'Boulder Hammer', 'Worldbreaker'], colors: ['#9aa3b5', '#b58a5b', '#d7a15f'], glow: [null, null, '#ffb35c'] },
  daggers: { combo: ['thrust', 'thrust', 'thrust', 'spin'], dmg: [6, 6, 7, 13], names: ['Twin Daggers', 'Tick & Tock', 'Moment Blades'], colors: ['#c9c3de', '#c58cff', '#f0dcff'], glow: [null, '#c58cff', '#e0b8ff'] },
  keytar: { combo: ['swing', 'swing', 'swingBig'], dmg: [10, 10, 18], names: ['Garage Keytar', 'Thunder Axe', 'Stormcaster'], colors: ['#ff4f73', '#ffe45c', '#55c8ff'], glow: [null, '#ffe45c', '#55c8ff'] },
  glitchsword: { combo: ['thrust', 'swing', 'upper'], dmg: [9, 10, 16], names: ['M1ss1ngBl4de', 'Buffer Overflow', 'Segfault Edge'], colors: ['#ff3df2', '#3dfff6', '#ffffff'], glow: ['#ff3df2', '#3dfff6', '#ffffff'] },
};
const HEROES = {
  rook: {
    id: 'rook', name: 'Rook', role: 'Balanced brawler', blurb: 'Grew up fixing arcade cabinets. Punches like a bug report.',
    hp: 120, mp: 100, mpRegen: 7, speed: 155, weight: 1, weapon: 'gauntlets', spell: 'fireball', element: 'fire',
    ui: { pow: 3, def: 3, spd: 3, mag: 3 },
    look: L({ build: BUILDS.hero, skin: '#f2c39b', hair: '#ff7a2f', hairStyle: 'spiky', headband: '#d8343f', top: '#d8343f', top2: '#fff4e2', pants: '#2f3b73', shoes: '#1b1030', weapon: 'gauntlets', gloves: '#d9a55b', blush: true }),
  },
  mira: {
    id: 'mira', name: 'Mira', role: 'Frost witch', blurb: 'Keeps her spellbook on 3.5" floppies. Hates when you say "just reboot".',
    hp: 92, mp: 150, mpRegen: 11, speed: 150, weight: 0.9, weapon: 'staff', spell: 'iceShard', element: 'ice',
    ui: { pow: 2, def: 2, spd: 3, mag: 5 },
    look: L({ build: BUILDS.slim, skin: '#ffd9c0', hair: '#e6f3ff', hairStyle: 'hood', hood: '#2f6bd8', hoodTrim: '#e6fbff', bangs: true, top: '#2f6bd8', top2: '#e6fbff', pants: '#1d2a66', shoes: '#e6fbff', weapon: 'staff', wpnColor: '#7fe3ff', wpnGlow: '#7fe3ff', cape: '#5fa0ff', blush: true, eyeColor: '#2f6bd8' }),
  },
  bruno: {
    id: 'bruno', name: 'Bruno', role: 'Mountain of a man', blurb: 'Former moving-company champion. Has never lost an arm-wrestle to a boulder.',
    hp: 170, mp: 90, mpRegen: 6, speed: 128, weight: 1.5, weapon: 'hammer', spell: 'quake', element: 'earth',
    ui: { pow: 5, def: 5, spd: 1, mag: 2 },
    look: L({ build: BUILDS.heavy, skin: '#c98b5e', hair: '#6b3e1f', hairStyle: 'bald', beard: '#6b3e1f', top: '#3f9a4a', belt: '#7a5230', pants: '#6b4424', shoes: '#2b1d14', weapon: 'hammer', wpnColor: '#9aa3b5' }),
  },
  kit: {
    id: 'kit', name: 'Kit', role: 'Chrono ninja', blurb: 'Borrowed five minutes from tomorrow and never gave them back.',
    hp: 100, mp: 120, mpRegen: 9, speed: 185, weight: 0.85, weapon: 'daggers', spell: 'chrono', element: 'time',
    ui: { pow: 3, def: 2, spd: 5, mag: 3 }, unlock: { level: 'L4', text: 'Clear Mushroom Hollow' },
    look: L({ build: BUILDS.slim, skin: '#ffe0c4', hair: '#2b2b3a', hairStyle: 'ninja', hood: '#2b2b3a', foxMask: true, scarf: '#ff4f73', top: '#2b2b3a', top2: '#c58cff', pants: '#2b2b3a', shoes: '#1b1030', weapon: 'daggers', wpnColor: '#c9c3de', eyeColor: '#7a3cff' }),
  },
  volta: {
    id: 'volta', name: 'Volta', role: 'Storm rockstar', blurb: 'Her keytar plugs straight into thunderclouds. One world tour, zero encores.',
    hp: 110, mp: 110, mpRegen: 8, speed: 160, weight: 1, weapon: 'keytar', spell: 'chain', element: 'storm',
    ui: { pow: 4, def: 3, spd: 3, mag: 4 }, unlock: { level: 'L8', text: 'Clear Yeti Summit' },
    look: L({ build: BUILDS.hero, skin: '#8d5a3b', hair: '#ffe45c', hairStyle: 'mohawk', shades: true, top: '#1b1030', top2: '#ffe45c', pants: '#ff4f73', shoes: '#fff4e2', weapon: 'keytar', wpnColor: '#ff4f73' }),
  },
  glitch: {
    id: 'glitch', name: 'GL!TCH', role: '??? corrupted sprite', blurb: 'Nobody remembers adding this character. Changes spell every level.',
    hp: 111, mp: 111, mpRegen: 11, speed: 170, weight: 1, weapon: 'glitchsword', spell: 'random', element: 'glitch',
    ui: { pow: 4, def: 2, spd: 4, mag: 4 }, unlock: { secret: true, text: '↑↑↓↓←→←→ B A' },
    look: L({ build: BUILDS.hero, skin: '#9fb4ff', hair: '#ff3df2', hairStyle: 'glitch', top: '#ff3df2', top2: '#3dfff6', pants: '#3dfff6', shoes: '#ff3df2', weapon: 'glitchsword', eyeColor: '#ff3df2' }),
  },
};
const HERO_ORDER = ['rook', 'mira', 'bruno', 'kit', 'volta', 'glitch'];
// innate passives: each hero plays differently, not just with different numbers
const INNATE = {
  rook: { name: 'Hot Streak', desc: 'Every 2nd combo finisher launches a free fireball.' },
  mira: { name: 'Cold Focus', desc: 'Blocking restores MP and chills the attacker.' },
  bruno: { name: 'Unstoppable', desc: 'Cannot be flinched while swinging. Hits knock back further.' },
  kit: { name: 'Borrowed Time', desc: 'Taking a hit slows nearby enemies (8s cooldown).' },
  volta: { name: 'Encore', desc: 'Every 12th hit fires a free chain lightning.' },
  glitch: { name: 'Undefined Behavior', desc: '10% chance for a triple-damage CRITICAL ERROR.' },
};

// ---------------- enemies ----------------
// ai: brawler | ranged | bomber | hopper | flyer | tank | caster | healer | charger
const ENEMIES = {
  goon: { name: 'Bandit Goon', art: 'human', hp: 34, speed: 92, dmg: 7, xp: 2, q: 1, ai: 'brawler', moves: ['punchE', 'kickE'], range: 52,
    look: L({ build: BUILDS.hero, skin: '#e8b48a', hairStyle: 'bandana', bandana: '#d8343f', top: '#6b4a8a', top2: '#8f6cb5', pants: '#3a3350', shoes: '#2b1d14', angry: true }) },
  thug: { name: 'Club Thug', art: 'human', hp: 46, speed: 84, dmg: 10, xp: 3, q: 2, ai: 'brawler', moves: ['club'], range: 70,
    look: L({ build: BUILDS.heavy, skin: '#d99a6c', hairStyle: 'bandana', bandana: '#2f6bd8', top: '#7a5230', pants: '#3a3350', shoes: '#2b1d14', weapon: 'club', angry: true }) },
  slime: { name: 'Slime-o', art: 'slime', hp: 22, speed: 70, dmg: 6, xp: 1, q: 1, ai: 'hopper', moves: ['bump'], range: 44, h: 40,
    look: { body: '#6fdc5a' } },
  archer: { name: 'Hood Archer', art: 'human', hp: 26, speed: 88, dmg: 7, xp: 3, q: 2, ai: 'ranged', moves: ['punchE'], range: 44, shot: 'arrow',
    look: L({ build: BUILDS.slim, skin: '#f2c39b', hairStyle: 'hood', hood: '#3f7a3a', top: '#4a6b3a', pants: '#2b3a24', weapon: 'bow', angry: true }) },
  bomber: { name: 'Goblin Bomber', art: 'human', hp: 24, speed: 96, dmg: 12, xp: 3, q: 2, ai: 'bomber', moves: ['punchE'], range: 44, shot: 'bomb',
    look: L({ build: BUILDS.small, skin: '#7fc35a', hairStyle: 'bald', ears: 'goblin', top: '#7a5230', pants: '#4a3a28', weapon: 'bomb', angry: true }) },
  skeleton: { name: 'Skele-Bob', art: 'human', hp: 30, speed: 100, dmg: 8, xp: 2, q: 1, ai: 'brawler', moves: ['punchE', 'claw'], range: 52,
    look: L({ build: BUILDS.thin, skin: '#f2ecdc', headShape: 'skull', top: '#e1d8c2', pants: '#e1d8c2', shoes: '#e1d8c2', weapon: 'sword', wpnColor: '#9aa3b5', headphones: true }) },
  mushroom: { name: 'Mushroom Grump', art: 'mushroom', hp: 40, speed: 70, dmg: 9, xp: 2, q: 1, ai: 'brawler', moves: ['bump'], range: 50, h: 80, spores: true,
    look: { cap: '#e04a5a', stem: '#fff1d6' } },
  glowshroom: { name: 'Glowshroom', art: 'mushroom', hp: 32, speed: 60, dmg: 5, xp: 3, q: 2, ai: 'caster', moves: ['bump'], range: 50, h: 80, shot: 'spore',
    look: { cap: '#7a5cff', stem: '#e6dcff', glowCap: '#7a5cff' } },
  bat: { name: 'Byte Bat', art: 'bat', hp: 18, speed: 150, dmg: 6, xp: 2, q: 1, ai: 'flyer', moves: ['swoop'], range: 60, h: 60, flying: true,
    look: { wing: '#5a3a8a', body: '#3a2a5a' } },
  knight: { name: 'Shield Knight', art: 'human', hp: 64, speed: 76, dmg: 9, xp: 4, q: 3, ai: 'tank', moves: ['spearE'], range: 92, blocker: true,
    look: L({ build: BUILDS.heavy, skin: '#f2c39b', hairStyle: 'helmet', helmet: '#aab4c8', plume: '#d8343f', top: '#8a93a8', top2: '#d8343f', pants: '#5a6378', shoes: '#3a4050', weapon: 'shieldspear', wpnColor: '#e6ecf5' }) },
  mummy: { name: 'Mumbling Mummy', art: 'human', hp: 44, speed: 70, dmg: 10, xp: 3, q: 2, ai: 'brawler', moves: ['claw', 'punchE'], range: 52,
    look: L({ build: BUILDS.hero, skin: '#e9dcb8', hairStyle: 'mummy', top: '#e9dcb8', pants: '#d8c9a0', shoes: '#cbbd9a', eyeColor: '#ff4f73' }) },
  scorpion: { name: 'Dune Raider', art: 'human', hp: 38, speed: 110, dmg: 9, xp: 3, q: 2, ai: 'charger', moves: ['spearE'], range: 90,
    look: L({ build: BUILDS.slim, skin: '#c98b5e', hairStyle: 'bandana', bandana: '#f1dfb3', top: '#c9a26b', pants: '#8a6a3a', weapon: 'spear', wpnColor: '#ffc53d', angry: true }) },
  frostimp: { name: 'Frost Imp', art: 'human', hp: 30, speed: 100, dmg: 8, xp: 3, q: 2, ai: 'caster', moves: ['claw'], range: 50, shot: 'iceball',
    look: L({ build: BUILDS.small, skin: '#9fe6ff', hairStyle: 'horns', top: '#3c7ec9', pants: '#2a4a8a', weapon: 'wand', wpnColor: '#e6fbff', wpnGlow: '#7fe3ff' }) },
  snowman: { name: 'Snowman Brute', art: 'snowman', hp: 76, speed: 60, dmg: 11, xp: 4, q: 3, ai: 'tank', moves: ['club'], range: 78, h: 130,
    look: {} },
  fireimp: { name: 'Ember Imp', art: 'human', hp: 30, speed: 104, dmg: 8, xp: 3, q: 2, ai: 'caster', moves: ['claw'], range: 50, shot: 'fireball',
    look: L({ build: BUILDS.small, skin: '#ff7a5a', hairStyle: 'horns', top: '#5a1030', pants: '#3a0a20', weapon: 'wand', wpnColor: '#ffd35c', wpnGlow: '#ff7a2f' }) },
  golem: { name: 'Lava Golem', art: 'golem', hp: 100, speed: 55, dmg: 13, xp: 6, q: 4, ai: 'tank', moves: ['golemSmash'], range: 100, h: 110, weight: 3,
    look: { rock: '#5a4a4a', core: '#ff7a2f' } },
  shaman: { name: 'Goblin Shaman', art: 'human', hp: 36, speed: 80, dmg: 6, xp: 4, q: 3, ai: 'healer', moves: ['punchE'], range: 44, shot: 'spore',
    look: L({ build: BUILDS.small, skin: '#7fc35a', hairStyle: 'feathers', ears: 'goblin', top: '#8a2b4a', pants: '#4a3a28', weapon: 'wand', wpnColor: '#8dff5a', wpnGlow: '#8dff5a' }) },
  punk: { name: 'Neon Punk', art: 'human', hp: 50, speed: 120, dmg: 11, xp: 4, q: 3, ai: 'brawler', moves: ['club', 'kickE'], range: 70,
    look: L({ build: BUILDS.hero, skin: '#e8b48a', hair: '#3dfff6', hairStyle: 'mohawk', shades: true, top: '#ff3df2', top2: '#1b1030', pants: '#1b1030', shoes: '#3dfff6', weapon: 'club', wpnColor: '#3dfff6' }) },
  floppy: { name: 'Floppy Drone', art: 'floppy', hp: 28, speed: 130, dmg: 7, xp: 3, q: 2, ai: 'ranged', moves: ['swoop'], range: 60, h: 70, flying: true, shot: 'laser',
    look: { body: '#2f6bd8' } },
  ghost404: { name: '404 Ghost', art: 'wraith', hp: 40, speed: 110, dmg: 10, xp: 4, q: 3, ai: 'flyer', moves: ['swoop'], range: 60, h: 70, flying: true, phase: true,
    look: { body: '#e6ecf5', text: '404' } },
  wraith: { name: 'Pixel Wraith', art: 'wraith', hp: 42, speed: 105, dmg: 9, xp: 4, q: 3, ai: 'caster', moves: ['swoop'], range: 60, h: 70, flying: true, shot: 'glitchball',
    look: { body: '#9a8cff' } },
  cow: { name: 'Hell Cow', art: 'cow', hp: 60, speed: 90, dmg: 12, xp: 4, q: 5, ai: 'charger', moves: ['bump'], range: 70, h: 80,
    look: { halberd: true } },
};

// ---------------- elites & bosses ----------------
const BOSSES = {
  bigmike: { name: 'Big Mike', title: 'The Bouncer · "Name\'s not on the list."', art: 'human', hp: 320, speed: 90, dmg: 14, xp: 30, q: 25, ai: 'boss', elite: true, scale: 1.35,
    moves: ['punchE', 'club'], range: 70, pattern: ['charge', 'combo', 'summon:goon'],
    look: L({ build: BUILDS.brute, skin: '#c98b5e', hairStyle: 'bald', shades: true, top: '#1b1030', top2: '#ffc53d', pants: '#2b2b3a', shoes: '#1b1030', weapon: 'none', angry: true, chestText: 'STAFF' }) },
  grumble: { name: 'Grumblebeard', title: 'Bandit King · Has never paid a single tax', art: 'human', hp: 780, speed: 88, dmg: 16, xp: 80, q: 60, ai: 'boss', scale: 1.7,
    moves: ['club', 'slamE'], range: 90, pattern: ['slam', 'charge', 'barrel', 'summon:goon', 'combo'],
    look: L({ build: BUILDS.brute, skin: '#e8b48a', hairStyle: 'crown', beard: '#b0502a', top: '#8a2b4a', top2: '#ffc53d', pants: '#3a3350', shoes: '#2b1d14', cape: '#d8343f', weapon: 'club', angry: true }) },
  twinhood: { name: 'The Twin Hoods', title: 'Siblings · Argue about who shoots first', art: 'human', hp: 220, speed: 110, dmg: 9, xp: 30, q: 25, ai: 'boss', elite: true, scale: 1.15, twin: true,
    moves: ['punchE'], range: 50, shot: 'arrow', pattern: ['volley', 'dash', 'volley', 'summon:archer'],
    look: L({ build: BUILDS.slim, skin: '#f2c39b', hairStyle: 'hood', hood: '#8a2b4a', top: '#8a2b4a', pants: '#2b1d14', weapon: 'bow', angry: true }) },
  oakley: { name: 'Oakley', title: 'Elder Treant · 400 years old, still no Wi-Fi', art: 'treant', hp: 1100, speed: 40, dmg: 18, xp: 110, q: 80, ai: 'boss', scale: 1, h: 260, weight: 99, noKnock: true,
    moves: ['golemSmash'], range: 150, pattern: ['roots', 'sweep', 'leafstorm', 'summon:mushroom', 'roots'] ,
    look: { eyeGlow: '#9dff5a' } },
  worm: { name: 'Sandy', title: 'Dune Worm · Just wants a hug. A crushing one.', art: 'worm', hp: 520, speed: 120, dmg: 16, xp: 40, q: 35, ai: 'boss', elite: true, h: 180, weight: 99, noKnock: true,
    moves: ['golemSmash'], range: 110, pattern: ['burrow', 'spit', 'burrow', 'sweep'],
    look: {} },
  pharaoh: { name: 'Pharaoh Mumbles', title: 'Ruler of the Tomb · Forgot the curse halfway', art: 'human', hp: 1400, speed: 90, dmg: 18, xp: 140, q: 100, ai: 'boss', scale: 1.65,
    moves: ['swing', 'spearE'], range: 100, shot: 'sandball', pattern: ['teleport', 'sandstorm', 'beam', 'summon:mummy', 'combo'],
    look: L({ build: BUILDS.hero, skin: '#e9dcb8', hairStyle: 'nemes', top: '#e9dcb8', top2: '#ffc53d', pants: '#d8c9a0', shoes: '#ffc53d', weapon: 'staff', wpnColor: '#ffc53d', wpnGlow: '#ffc53d', eyeColor: '#2f5bd8' }) },
  frostknight: { name: 'Sir Brr', title: 'Frost Knight · Knighted by a snowstorm', art: 'human', hp: 760, speed: 85, dmg: 17, xp: 50, q: 45, ai: 'boss', elite: true, scale: 1.35, blocker: true,
    moves: ['spearE', 'slamE'], range: 100, shot: 'iceball', pattern: ['charge', 'icicles', 'combo', 'nova'],
    look: L({ build: BUILDS.heavy, skin: '#e6fbff', hairStyle: 'helmet', helmet: '#bfe9ff', plume: '#7fe3ff', horns: true, eyeGlow: '#7fe3ff', top: '#7fb6d8', top2: '#e6fbff', pants: '#4a6b8a', shoes: '#2a4a6a', weapon: 'shieldspear', wpnColor: '#e6fbff', cape: '#2f6bd8' }) },
  yeti: { name: 'Ski-Bro', title: 'Big Yeti · Radical. Tubular. Extremely cold.', art: 'human', hp: 1800, speed: 100, dmg: 20, xp: 170, q: 130, ai: 'boss', scale: 1.9,
    moves: ['punchE', 'slamE'], range: 80, shot: 'snowball', pattern: ['slide', 'snowballs', 'slam', 'icicles', 'summon:snowman'],
    look: L({ build: BUILDS.brute, skin: '#dff3ff', hair: '#f4fbff', hairStyle: 'furhood', goggles: true, top: '#f4fbff', pants: '#e6f3ff', shoes: '#9fb4d8', weapon: 'none', angry: true }) },
  forgegolem: { name: 'Forge Golem', title: 'Emberforge Foreman · Union rules: no breaks', art: 'golem', hp: 950, speed: 60, dmg: 22, xp: 60, q: 55, ai: 'boss', elite: true, scale: 1.5, weight: 99, noKnock: true,
    moves: ['golemSmash'], range: 120, pattern: ['slam', 'meteors', 'combo'],
    look: { rock: '#3a2e2e', core: '#ffb35c' } },
  magmaw: { name: 'Magmaw', title: 'Lava Dragon · Hoards rubber ducks, oddly', art: 'dragon', hp: 2400, speed: 70, dmg: 22, xp: 220, q: 170, ai: 'boss', scale: 1, h: 260, weight: 99, noKnock: true,
    moves: ['golemSmash'], range: 170, pattern: ['breath', 'meteors', 'tail', 'summon:fireimp', 'breath'],
    look: {} },
  mimic: { name: 'Cabinet Mimic', title: 'Arcade Horror · Eats quarters AND players', art: 'mimic', hp: 1100, speed: 80, dmg: 20, xp: 70, q: 70, ai: 'boss', elite: true, scale: 1.2, weight: 99, noKnock: true,
    moves: ['golemSmash'], range: 100, pattern: ['coins', 'charge', 'summon:punk', 'coins'],
    look: {} },
  bug: { name: 'The Millennium Bug', title: 'Y2K Incarnate · Thinks it is still 1900', art: 'bug', hp: 3000, speed: 80, dmg: 24, xp: 300, q: 300, ai: 'boss', scale: 1, h: 200, weight: 99, noKnock: true,
    moves: ['golemSmash'], range: 150, pattern: ['beams', 'summon:floppy', 'countdown', 'glitchballs', 'summon:ghost404', 'beams'],
    look: {} },
  cowking: { name: 'The Cow King', title: 'There is no cow level · Moo.', art: 'cow', hp: 1400, speed: 100, dmg: 16, xp: 120, q: 200, ai: 'boss', scale: 1.7, weight: 99,
    moves: ['bump'], range: 90, pattern: ['charge', 'summon:cow', 'slam', 'charge'],
    look: { halberd: true, crown: true } },
};

// ---------------- world & levels ----------------
// map coords are in a 2000x1250 world-map space
const LEVELS = [
  { id: 'L1', n: 1, name: 'Meadowbrook', biome: 'meadow', x: 250, y: 930, next: ['L2'], pool: [['goon', 5], ['slime', 3]], end: 'bigmike', sections: 3,
    blurb: 'A sleepy village where the bandits are fairly polite. Great place to learn the ropes.' },
  { id: 'L2', n: 2, name: 'Cobblestone Crossing', biome: 'village', x: 470, y: 820, next: ['L3'], pool: [['goon', 5], ['thug', 2], ['archer', 2], ['slime', 2]], end: 'grumble', sections: 3,
    blurb: 'The market town, overrun by the Bandit King. Somebody has to collect his overdue taxes.' },
  { id: 'L3', n: 3, name: 'Whisperwood', biome: 'forest', x: 560, y: 600, next: ['L4', 'EC'], pool: [['archer', 3], ['goon', 3], ['bomber', 2], ['bat', 2], ['slime', 2]], end: 'twinhood', sections: 3,
    blurb: 'The trees whisper. Mostly gossip about the Twin Hoods, who ambush travellers in pairs.' },
  { id: 'L4', n: 4, name: 'Mushroom Hollow', biome: 'mushroom', x: 380, y: 420, next: ['L5'], pool: [['mushroom', 4], ['glowshroom', 2], ['bat', 2], ['bomber', 2], ['shaman', 1]], end: 'oakley', sections: 4,
    blurb: 'Glowing fungus and a very old, very grumpy tree. Do not lick anything.' },
  { id: 'L5', n: 5, name: 'Sunscorch Dunes', biome: 'desert', x: 760, y: 330, next: ['L6'], pool: [['scorpion', 3], ['mummy', 2], ['bomber', 2], ['archer', 2], ['skeleton', 2]], end: 'worm', sections: 4,
    blurb: 'Sand in places you did not know existed. Something big moves under the dunes.' },
  { id: 'L6', n: 6, name: 'Tomb of Mumbles', biome: 'tomb', x: 980, y: 460, next: ['L7'], pool: [['mummy', 4], ['skeleton', 3], ['bat', 2], ['scorpion', 2], ['shaman', 1]], end: 'pharaoh', sections: 4,
    blurb: 'An ancient pharaoh who never finished reading his own curse. Bring snacks.' },
  { id: 'L7', n: 7, name: 'Frostfang Pass', biome: 'ice', x: 1180, y: 260, next: ['L8'], pool: [['frostimp', 3], ['knight', 2], ['snowman', 2], ['bat', 2], ['slime', 2]], end: 'frostknight', sections: 4,
    blurb: 'A mountain pass guarded by a knight who took his oath way too literally.' },
  { id: 'L8', n: 8, name: 'Yeti Summit', biome: 'ice', x: 1380, y: 150, next: ['L9'], pool: [['snowman', 3], ['frostimp', 3], ['knight', 2], ['bat', 2]], end: 'yeti', sections: 4, night: true,
    blurb: 'At the top lives a legendary yeti who only speaks in 1990s surfer slang.' },
  { id: 'L9', n: 9, name: 'Emberforge', biome: 'volcano', x: 1560, y: 360, next: ['L10'], pool: [['fireimp', 3], ['golem', 2], ['thug', 2], ['bomber', 2], ['skeleton', 2]], end: 'forgegolem', sections: 4,
    blurb: 'The forges never sleep. Neither do the golems. Mind the lava, it is hot.' },
  { id: 'L10', n: 10, name: "Dragon's Maw", biome: 'volcano', x: 1740, y: 540, next: ['L11'], pool: [['fireimp', 3], ['golem', 2], ['bat', 3], ['shaman', 1], ['knight', 2]], end: 'magmaw', sections: 4, night: true,
    blurb: 'The lair of Magmaw. The dragon sleeps on a pile of treasure and rubber ducks.' },
  { id: 'L11', n: 11, name: 'Neon Undercity', biome: 'neon', x: 1560, y: 780, next: ['L12'], pool: [['punk', 4], ['floppy', 3], ['ghost404', 2], ['bat', 2], ['knight', 1]], end: 'mimic', sections: 4, night: true,
    blurb: 'A city of arcade halls and dial-up tones, stuck in an endless 1999.' },
  { id: 'L12', n: 12, name: 'Glitch Citadel', biome: 'glitch', x: 1770, y: 1000, next: [], pool: [['floppy', 3], ['ghost404', 3], ['wraith', 3], ['punk', 2], ['golem', 1]], end: 'bug', sections: 4, night: true,
    blurb: 'The source of the corruption. The clocks here all say 00:00. Time to patch the world.' },
];
const SIDE = [
  { id: 'DOJO', name: 'Keyboard Warrior Dojo', kind: 'typing', x: 700, y: 1010, blurb: 'Special mode: defeat enemies by typing their words. Starts with the home row and builds to full sentences.' },
  { id: 'EC', name: 'Endless Colosseum', kind: 'endless', x: 860, y: 740, req: 'L3', blurb: 'Survive wave after wave. Your best wave is saved.' },
  { id: 'COW', name: '???', kind: 'cow', x: 120, y: 620, secret: true, blurb: 'There is no cow level.' },
  { id: 'GAUNT', name: 'The Gauntlet', kind: 'gauntlet', x: 1080, y: 650, req: 'L4', blurb: 'Special mode: five battles in a row. Keep your build, pick your path at every crossroads, and see how far you get.' },
];
const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

// ---------------- in-run cards ----------------
const RARITY = {
  common: { w: 100, name: 'Common' }, rare: { w: 42, name: 'Rare' }, epic: { w: 14, name: 'Epic' }, legendary: { w: 4, name: 'Legendary' },
};
const SPELLS = {
  fireball: { name: 'Fireball', el: 'fire', icon: 'fireball', cost: 18, cd: 0.6, rarity: 'common', evolve: 'meteor',
    desc: (l) => `Hurl ${l >= 5 ? 3 : l >= 3 ? 2 : 1} fireball${l >= 3 ? 's' : ''} that burn. ${14 + l * 6} dmg.`, input: 'D→A' },
  pillar: { name: 'Flame Pillar', el: 'fire', icon: 'pillar', cost: 26, cd: 1.6, rarity: 'rare', evolve: 'tornado',
    desc: (l) => `A pillar of fire erupts ahead, juggling foes. ${8 + l * 3} dmg per tick.`, input: 'D↑A' },
  iceShard: { name: 'Ice Shard', el: 'ice', icon: 'iceShard', cost: 14, cd: 0.45, rarity: 'common', evolve: 'lance',
    desc: (l) => `Piercing shard, ${l >= 3 ? 2 : 1} chill stack${l >= 3 ? 's' : ''}. ${12 + l * 5} dmg. 3 stacks freeze.`, input: 'D→A' },
  nova: { name: 'Frost Nova', el: 'ice', icon: 'nova', cost: 30, cd: 2.4, rarity: 'rare', evolve: 'zero',
    desc: (l) => `Ring of frost around you. ${16 + l * 6} dmg, 2 chill stacks, radius ${130 + l * 15}.`, input: 'D↓A' },
  quake: { name: 'Earthquake', el: 'earth', icon: 'quake', cost: 30, cd: 2.2, rarity: 'common', evolve: 'tectonic',
    desc: (l) => `Stomp! Shockwave knocks down grounded foes. ${20 + l * 7} dmg.`, input: 'D↓A' },
  boulder: { name: 'Boulder Toss', el: 'earth', icon: 'boulder', cost: 24, cd: 1.2, rarity: 'common', evolve: 'avalanche',
    desc: (l) => `Roll a boulder that flattens everything in a line. ${18 + l * 7} dmg.`, input: 'D→A' },
  chrono: { name: 'Chrono Bubble', el: 'time', icon: 'chrono', cost: 34, cd: 5, rarity: 'rare', evolve: 'timestop',
    desc: (l) => `Enemies and bullets near you move at 30% speed for ${3 + l * 0.6}s.`, input: 'D↑A' },
  blink: { name: 'Blink Strike', el: 'time', icon: 'blink', cost: 20, cd: 1.1, rarity: 'common', evolve: 'army',
    desc: (l) => `Teleport forward, slashing through foes. ${16 + l * 6} dmg.`, input: 'D→A' },
  chain: { name: 'Chain Lightning', el: 'storm', icon: 'chain', cost: 22, cd: 0.9, rarity: 'common', evolve: 'thunder',
    desc: (l) => `Zap the nearest foe, arcing to ${2 + l} more. ${14 + l * 5} dmg, stuns.`, input: 'D↑A' },
  // evolutions (granted at level 5 of the base spell when drafted)
  meteor: { name: 'Meteor Rain', el: 'fire', icon: 'meteor', cost: 40, cd: 3, rarity: 'legendary', evo: true, desc: () => 'Call 8 meteors on nearby enemies. Burns everything.' },
  tornado: { name: 'Inferno Tornado', el: 'fire', icon: 'tornado', cost: 38, cd: 3, rarity: 'legendary', evo: true, desc: () => 'A roaming fire tornado that drags enemies along.' },
  lance: { name: 'Glacial Lance', el: 'ice', icon: 'lance', cost: 30, cd: 1.2, rarity: 'legendary', evo: true, desc: () => 'A colossal lance that freezes everything in its lane.' },
  zero: { name: 'Absolute Zero', el: 'ice', icon: 'nova', cost: 50, cd: 6, rarity: 'legendary', evo: true, desc: () => 'Freeze every enemy on screen solid.' },
  tectonic: { name: 'Tectonic Rage', el: 'earth', icon: 'quake', cost: 45, cd: 4, rarity: 'legendary', evo: true, desc: () => 'Three rolling quakes plus falling rocks.' },
  avalanche: { name: 'Avalanche', el: 'earth', icon: 'boulder', cost: 40, cd: 3, rarity: 'legendary', evo: true, desc: () => 'Seven boulders thunder across every lane.' },
  timestop: { name: 'Time Stop', el: 'time', icon: 'timestop', cost: 60, cd: 10, rarity: 'legendary', evo: true, desc: () => 'Stop time for everyone else for 3.5 seconds.' },
  army: { name: 'Afterimage Army', el: 'time', icon: 'blink', cost: 30, cd: 2, rarity: 'legendary', evo: true, desc: () => 'Blink, leaving 3 afterimages that copy your attacks.' },
  thunder: { name: 'Thunderstorm', el: 'storm', icon: 'bolt', cost: 45, cd: 5, rarity: 'legendary', evo: true, desc: () => 'Summon a storm that strikes enemies for 6 seconds.' },
};
const BASE_SPELLS = ['fireball', 'pillar', 'iceShard', 'nova', 'quake', 'boulder', 'chrono', 'blink', 'chain'];
const PASSIVES = {
  fireAura: { name: 'Fire Aura', el: 'fire', icon: 'fireAura', max: 5, rarity: 'rare', desc: (l) => `Burn enemies within ${70 + l * 12} units. ${3 + l * 2} dmg/tick.` },
  iceOrbit: { name: 'Orbiting Shards', el: 'ice', icon: 'iceOrbit', max: 5, rarity: 'rare', desc: (l) => `${1 + l} ice shards orbit you, chilling on touch.` },
  staticField: { name: 'Static Field', el: 'storm', icon: 'static', max: 5, rarity: 'rare', desc: (l) => `Zap a nearby enemy every ${(2.2 - l * 0.3).toFixed(1)}s.` },
  thorns: { name: 'Thorn Skin', el: 'earth', icon: 'thorn', max: 5, rarity: 'common', desc: (l) => `Reflect ${20 + l * 20}% of melee damage.` },
  vampire: { name: 'Vampire Fangs', el: 'phys', icon: 'fang', max: 5, rarity: 'rare', desc: (l) => `Heal ${l * 2}% of damage dealt.` },
  lucky: { name: 'Lucky Cartridge', el: 'phys', icon: 'cart', max: 5, rarity: 'common', desc: (l) => `+${l * 6}% crit chance. Blow on it first.` },
  boots: { name: 'Turbo Boots', el: 'phys', icon: 'boot', max: 5, rarity: 'common', desc: (l) => `+${l * 8}% move speed.` },
  magnet: { name: 'Coin Magnet', el: 'phys', icon: 'magnet', max: 3, rarity: 'common', desc: (l) => `+${l * 60}% pickup radius.` },
  secondWind: { name: 'Second Wind', el: 'phys', icon: 'recover', max: 1, rarity: 'epic', desc: () => 'Once per level, revive with 50% HP.' },
  comboGloves: { name: 'Combo Gloves', el: 'phys', icon: 'gloves', max: 5, rarity: 'common', desc: (l) => `Each combo hit adds +${l}% damage (max ${l * 25}%).` },
  manaCrystal: { name: 'Mana Crystal', el: 'phys', icon: 'crystal', max: 5, rarity: 'common', desc: (l) => `+${l * 15} max MP and +${l * 20}% MP regen.` },
  doubleJump: { name: 'Cloud Boots', el: 'phys', icon: 'wing', max: 1, rarity: 'rare', desc: () => 'Jump again in mid-air.' },
  heartUp: { name: 'Heart Container', el: 'phys', icon: 'heart', max: 5, rarity: 'common', desc: (l) => `+${l * 20} max HP and heal 20.` },
  might: { name: 'Protein Shake', el: 'phys', icon: 'fist', max: 5, rarity: 'common', desc: (l) => `+${l * 8}% damage.` },
  echo: { name: 'Spell Echo', el: 'phys', icon: 'echo', max: 3, rarity: 'epic', desc: (l) => `${l * 12}% chance to cast spells twice.` },
};
const WEAPON_CARDS = {
  wpn_dmg: { name: 'Sharpen', icon: 'sword', max: 8, rarity: 'common', desc: () => '+18% weapon damage. Weapon level +1.' },
  wpn_speed: { name: 'Rhythm', icon: 'speed', max: 5, rarity: 'common', desc: () => '+12% attack speed. Weapon level +1.' },
  wpn_reach: { name: 'Reach', icon: 'reach', max: 4, rarity: 'common', desc: () => '+15% attack range. Weapon level +1.' },
  wpn_fire: { name: 'Fire Infusion', el: 'fire', icon: 'fire', max: 1, rarity: 'rare', desc: () => 'Basic hits burn. Weapon level +1.' },
  wpn_ice: { name: 'Ice Infusion', el: 'ice', icon: 'snow', max: 1, rarity: 'rare', desc: () => 'Basic hits chill. Weapon level +1.' },
  wpn_earth: { name: 'Earth Infusion', el: 'earth', icon: 'earth', max: 1, rarity: 'rare', desc: () => 'Finishers send out a mini quake. Weapon level +1.' },
  wpn_storm: { name: 'Storm Infusion', el: 'storm', icon: 'bolt', max: 1, rarity: 'rare', desc: () => 'Hits spark to a nearby enemy. Weapon level +1.' },
  wpn_time: { name: 'Time Infusion', el: 'time', icon: 'clock', max: 1, rarity: 'rare', desc: () => 'Hits slow enemies briefly. Weapon level +1.' },
};
const DUOS = {
  duo_steam: { name: 'Steam Engine', els: ['fire', 'ice'], icon: 'steam', rarity: 'epic', desc: () => 'Hitting a frozen enemy with fire makes a big steam explosion.' },
  duo_magma: { name: 'Magma Core', els: ['fire', 'earth'], icon: 'boulder', rarity: 'epic', desc: () => 'Quakes and boulders leave burning lava pools.' },
  duo_plasma: { name: 'Plasma', els: ['fire', 'storm'], icon: 'bolt', rarity: 'epic', desc: () => 'Burning enemies take +40% storm damage and chain further.' },
  duo_permafrost: { name: 'Permafrost Clock', els: ['ice', 'time'], icon: 'clock', rarity: 'epic', desc: () => 'Frozen enemies stay frozen 60% longer.' },
  duo_tectonic: { name: 'Tectonic Thunder', els: ['earth', 'storm'], icon: 'quake', rarity: 'epic', desc: () => 'Knocked-down enemies get zapped for bonus damage.' },
  duo_deja: { name: 'Déjà Vu', els: ['time', 'storm'], icon: 'echo', rarity: 'epic', desc: () => 'Spell cooldowns are 25% shorter.' },
};
const FILLER = {
  milk: { name: 'Milk Break', icon: 'milk', rarity: 'common', desc: () => 'Heal 40% HP. Does a body good.' },
  quarters: { name: 'Pocket Change', icon: 'coin', rarity: 'common', desc: () => '+25 quarters right now.' },
};

// ---------------- meta skill tree ----------------
const BRANCHES = [
  { id: 'might', name: 'Might', color: '#ff4f73', blurb: 'Hit harder' },
  { id: 'guard', name: 'Guard', color: '#3ee6a8', blurb: 'Stay alive' },
  { id: 'arcana', name: 'Arcana', color: '#55c8ff', blurb: 'Better spells' },
  { id: 'fortune', name: 'Fortune', color: '#ffc53d', blurb: 'Luck & loot' },
];
const SKILLS = [
  { id: 'm1', br: 'might', name: 'Iron Fists', icon: 'fist', max: 5, cost: (r) => 30 + r * 30, desc: (r) => `+${r * 6}% all damage` },
  { id: 'm2', br: 'might', name: 'Crit Eye', icon: 'eye', max: 5, cost: (r) => 60 + r * 45, desc: (r) => `+${r * 3}% crit chance` },
  { id: 'm3', br: 'might', name: 'Heavy Finisher', icon: 'hammer', max: 3, cost: (r) => 120 + r * 80, desc: (r) => `Combo finishers deal +${r * 20}%` },
  { id: 'm4', br: 'might', name: 'Berserker', icon: 'rage', max: 3, cost: (r) => 220 + r * 120, desc: (r) => `Below 35% HP: +${r * 15}% damage` },
  { id: 'm5', br: 'might', name: 'Overkill Splash', icon: 'overkill', max: 1, cost: () => 700, desc: () => 'Excess damage on kills explodes onto nearby foes' },
  { id: 'g1', br: 'guard', name: 'Thick Skin', icon: 'heart', max: 5, cost: (r) => 30 + r * 30, desc: (r) => `+${r * 10} max HP` },
  { id: 'g2', br: 'guard', name: 'Block Master', icon: 'shield', max: 3, cost: (r) => 70 + r * 50, desc: (r) => `Blocking takes ${80 + r * 5}% less damage` },
  { id: 'g3', br: 'guard', name: 'Milk Lover', icon: 'milk', max: 3, cost: (r) => 100 + r * 60, desc: (r) => `Food heals +${r * 25}%` },
  { id: 'g4', br: 'guard', name: 'Quick Recovery', icon: 'recover', max: 3, cost: (r) => 180 + r * 90, desc: (r) => `Regenerate ${r * 0.6} HP/s` },
  { id: 'g5', br: 'guard', name: 'Extra Life', icon: '1up', max: 1, cost: () => 800, desc: () => '1UP! Revive once per level with 60% HP' },
  { id: 'a1', br: 'arcana', name: 'Deep Pockets', icon: 'crystal', max: 5, cost: (r) => 30 + r * 30, desc: (r) => `+${r * 12} max MP` },
  { id: 'a2', br: 'arcana', name: 'Mana Flow', icon: 'echo', max: 5, cost: (r) => 60 + r * 45, desc: (r) => `+${r * 12}% MP regen` },
  { id: 'a3', br: 'arcana', name: 'Elemental Lore', icon: 'book', max: 3, cost: (r) => 120 + r * 80, desc: (r) => `Spells deal +${r * 12}% damage` },
  { id: 'a4', br: 'arcana', name: 'Head Start', icon: 'up', max: 1, cost: () => 400, desc: () => 'Start each level with your hero spell at Lv 2' },
  { id: 'a5', br: 'arcana', name: 'Overdrive Core', icon: 'overkill', max: 3, cost: (r) => 300 + r * 200, desc: (r) => `Overdrive charges ${r * 25}% faster` },
  { id: 'f1', br: 'fortune', name: 'Greedy', icon: 'coin', max: 5, cost: (r) => 30 + r * 35, desc: (r) => `+${r * 10}% quarters` },
  { id: 'f2', br: 'fortune', name: 'Scholar', icon: 'xp', max: 5, cost: (r) => 50 + r * 40, desc: (r) => `+${r * 8}% XP` },
  { id: 'f3', br: 'fortune', name: 'Reroll', icon: 'dice', max: 3, cost: (r) => 90 + r * 70, desc: (r) => `${r} free card reroll${r > 1 ? 's' : ''} per level` },
  { id: 'f4', br: 'fortune', name: 'Lucky Charm', icon: 'clover', max: 3, cost: (r) => 150 + r * 100, desc: (r) => `Rare+ cards ${r * 25}% more likely` },
  { id: 'f5', br: 'fortune', name: 'Fourth Card', icon: 'card4', max: 1, cost: () => 900, desc: () => 'Level-ups offer 4 cards instead of 3' },
];
const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
const skillRank = (id) => SAVE.skills[id] || 0;

// ---------------- achievements ----------------
const ACH = [
  { id: 'first', name: 'First Blood', desc: 'Defeat your first enemy.' },
  { id: 'win1', name: 'Hello, World', desc: 'Clear Meadowbrook.' },
  { id: 'boss1', name: 'Tax Season', desc: 'Defeat Grumblebeard.' },
  { id: 'boss2', name: 'Lumberjack', desc: 'Defeat Oakley the Elder Treant.' },
  { id: 'boss3', name: 'It Belongs in a Museum', desc: 'Defeat Pharaoh Mumbles.' },
  { id: 'boss4', name: 'Totally Tubular', desc: 'Defeat Ski-Bro.' },
  { id: 'boss5', name: 'Dragon Slayer', desc: 'Defeat Magmaw.' },
  { id: 'boss6', name: 'Y2K Compliant', desc: 'Defeat The Millennium Bug.' },
  { id: 'combo25', name: 'C-C-C-Combo', desc: 'Reach a 25-hit combo.' },
  { id: 'combo75', name: 'Smokin\' Sexy Style', desc: 'Reach a 75-hit combo.' },
  { id: 'shatter', name: 'Ice to Meet You', desc: 'Shatter 10 frozen enemies.' },
  { id: 'evolve', name: 'It\'s Evolving!', desc: 'Evolve a spell.' },
  { id: 'wpnmax', name: 'Master Smith', desc: 'Reach weapon tier 3.' },
  { id: 'lvl15', name: 'Power Overwhelming', desc: 'Reach level 15 in a single run.' },
  { id: 'nohit', name: 'Untouchable', desc: 'Clear a level without taking damage.' },
  { id: 'stars3', name: 'Gold Star Student', desc: 'Get 3 stars on any level.' },
  { id: 'allstars', name: 'Completionist', desc: 'Get 3 stars on all 12 levels.' },
  { id: 'rich', name: 'Arcade Millionaire', desc: 'Earn 5,000 quarters in total.' },
  { id: 'skill10', name: 'Tree Hugger', desc: 'Buy 10 skill tree ranks.' },
  { id: 'milk', name: 'Got Milk?', desc: 'Drink 25 bottles of milk.' },
  { id: 'konami', name: '30 Lives', desc: 'Enter the famous code.' },
  { id: 'cow', name: 'There Is No Cow Level', desc: 'Find the cow level.' },
  { id: 'cheat', name: 'Cheater!', desc: 'Use a cheat code.' },
  { id: 'xyzzy', name: 'Nothing Happens', desc: 'Say the magic word.' },
  { id: 'endless10', name: 'Gladiator', desc: 'Reach wave 10 in the Endless Colosseum.' },
  { id: 'wpm30', name: 'Keyboard Warrior', desc: 'Finish a typing lesson at 30+ WPM.' },
  { id: 'acc98', name: 'Accuracy Before Speed', desc: 'Finish a typing lesson with 98% accuracy.' },
  { id: 'overdrive', name: 'Limit Break', desc: 'Trigger Overdrive.' },
  { id: 'kills1000', name: 'Rumble Veteran', desc: 'Defeat 1,000 enemies.' },
  { id: 'ufo', name: 'The Truth Is Out There', desc: 'Find the crashed UFO on the map.' },
  { id: 'gauntlet', name: 'Ran the Gauntlet', desc: 'Survive all five battles of The Gauntlet.' },
  { id: 'shopper', name: 'Valued Customer', desc: 'Buy something from Pip the Peddler.' },
  { id: 'throw', name: 'Yeet', desc: 'Defeat an enemy with a thrown object.' },
];

// ---------------- cheats (1990s-2000s nods) ----------------
const CHEATS = {
  IDDQD: 'God mode',
  IDKFA: 'All spells, max level',
  THEREISNOCOWLEVEL: 'There is no cow level',
  ROSEBUD: '+1,000 quarters',
  HESOYAM: 'Health, mana & cash',
  BIGHEAD: 'Big head mode',
  XYZZY: 'Nothing happens',
  NOCLIP: 'Phase through enemies',
  ALLYOURBASE: 'Are belong to us',
  KLAPAUCIUS: 'Make it rain gems',
};
