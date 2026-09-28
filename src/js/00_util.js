// ============================================================
//  Utilities: math, RNG, easing, DOM helpers, persistent save
// ============================================================
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, v) => (v - a) / (b - a);
const sign = (v) => (v < 0 ? -1 : 1);
const dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  outBack: (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

// Small, fast seeded RNG (mulberry32)
function makeRng(seed) {
  let s = seed >>> 0;
  const r = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + r() * (b - a);
  r.int = (a, b) => Math.floor(a + r() * (b - a + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  return r;
}
const rng = makeRng((Date.now() ^ 0x5eed) >>> 0);
const R = (a, b) => a + Math.random() * (b - a);
const RI = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function weightedPick(items, wfn, r = Math.random) {
  let tot = 0;
  for (const it of items) tot += Math.max(0, wfn(it));
  let x = r() * tot;
  for (const it of items) { x -= Math.max(0, wfn(it)); if (x <= 0) return it; }
  return items[items.length - 1];
}
function shuffle(a, r = Math.random) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// 1D value noise for terrain silhouettes
function noise1(seed) {
  const r = makeRng(seed);
  const pts = Array.from({ length: 256 }, () => r());
  return (x) => {
    const i = Math.floor(x), f = x - i;
    const a = pts[i & 255], b = pts[(i + 1) & 255];
    const t = f * f * (3 - 2 * f);
    return a + (b - a) * t;
  };
}
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const $ = (id) => document.getElementById(id);
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

// ------------------------------------------------------------
//  Save data (localStorage; per viewer). Everything is guarded.
// ------------------------------------------------------------
const SAVE_KEY = 'rumblevale.save.v1';
function defaultSave() {
  return {
    v: 1,
    quarters: 0,
    lifetimeQuarters: 0,
    stars: {},          // levelId -> 0..3
    cleared: {},        // levelId -> true
    skills: {},         // nodeId -> rank
    heroes: { rook: true, mira: true, bruno: true },
    hero: 'rook',
    ach: {},            // id -> timestamp
    stats: { kills: 0, deaths: 0, runs: 0, wins: 0, bossKills: 0, maxCombo: 0, playTime: 0, crits: 0, spells: 0, gems: 0, milk: 0, shatters: 0, typedWords: 0, cheats: 0, cows: 0 },
    secrets: {},
    seenIntro: false,
    endlessBest: 0,
    gauntletBest: 0,
    floppies: {},
    typing: { lessons: {}, keyMiss: {}, keyHit: {}, bestWpm: 0 },
    settings: { sfx: 0.8, music: 0.5, shake: true, dmgNums: true, touch: 'auto', hints: true, assist: false },
    mapPos: 'L1',
  };
}
let SAVE = defaultSave();
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) SAVE = mergeSave(defaultSave(), JSON.parse(raw));
  } catch (e) { /* storage unavailable: play without persistence */ }
}
function mergeSave(base, data) {
  for (const k in data) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && data[k] && typeof data[k] === 'object') base[k] = mergeSave(base[k], data[k]);
    else base[k] = data[k];
  }
  return base;
}
let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { /* ignore */ }
  }, 150);
}
// NES-style password save: compact base64 of the save JSON with a checksum
function exportPassword() {
  const json = JSON.stringify(SAVE);
  const b = btoa(unescape(encodeURIComponent(json)));
  const sum = (hashStr(b) % 46656).toString(36).toUpperCase().padStart(3, '0');
  return 'RV1-' + sum + '-' + b;
}
function importPassword(code) {
  code = (code || '').trim();
  const m = /^RV1-([0-9A-Z]{3})-(.+)$/.exec(code);
  if (!m) return false;
  const sum = (hashStr(m[2]) % 46656).toString(36).toUpperCase().padStart(3, '0');
  if (sum !== m[1]) return false;
  try {
    const data = JSON.parse(decodeURIComponent(escape(atob(m[2]))));
    SAVE = mergeSave(defaultSave(), data);
    persist();
    return true;
  } catch (e) { return false; }
}
