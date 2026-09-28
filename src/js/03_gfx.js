// ============================================================
//  Graphics core: canvas sizing, particles, glows, floating text, icons
// ============================================================
const VIEW_H = 540;
let VIEW_W = 960;
const GROUND_TOP = 318;   // screen y of the far edge of the walkable floor
const DEPTH = 190;        // walkable depth (z range)
const EL = {
  phys: { c: '#ffffff', c2: '#ffd9a0', name: 'Physical' },
  fire: { c: '#ff7a2f', c2: '#ffd35c', name: 'Fire' },
  ice: { c: '#7fe3ff', c2: '#e6fbff', name: 'Ice' },
  earth: { c: '#d7a15f', c2: '#8a5a2b', name: 'Earth' },
  time: { c: '#c58cff', c2: '#f0dcff', name: 'Time' },
  storm: { c: '#ffe45c', c2: '#ffffff', name: 'Storm' },
  poison: { c: '#8dff5a', c2: '#d9ffb8', name: 'Poison' },
  glitch: { c: '#ff3df2', c2: '#3dfff6', name: 'Glitch' },
};
const canvas = $('game');
const ctx = canvas.getContext('2d');
const View = { scale: 1, cssW: 0, cssH: 0, left: 0, top: 0, dpr: 1, portrait: false, hud: 1, qualityCap: 2 };

function resize() {
  const W = window.innerWidth, Hh = window.innerHeight;
  const portrait = Hh > W * 1.05;
  View.portrait = portrait;
  document.body.classList.toggle('portrait', portrait);
  let gw, gh, left = 0, top = 0;
  if (portrait) {
    VIEW_W = 640;
    gw = W; gh = W * VIEW_H / VIEW_W;
    top = Math.max(0, Math.min((Hh - gh) * 0.18, 60));
    const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
    top += safeTop;
  } else {
    const aspect = W / Hh;
    VIEW_W = Math.round(clamp(VIEW_H * aspect, 720, 1280));
    const s = Math.min(W / VIEW_W, Hh / VIEW_H);
    gw = VIEW_W * s; gh = VIEW_H * s;
    left = (W - gw) / 2; top = (Hh - gh) / 2;
  }
  View.cssW = gw; View.cssH = gh; View.left = left; View.top = top;
  const mobile = Math.min(W, Hh) < 600;
  View.dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2, View.qualityCap);
  canvas.style.width = gw + 'px'; canvas.style.height = gh + 'px';
  canvas.style.left = left + 'px'; canvas.style.top = top + 'px';
  canvas.width = Math.round(gw * View.dpr); canvas.height = Math.round(gh * View.dpr);
  View.scale = canvas.width / VIEW_W;
  View.hud = portrait ? 1.25 : 1;
  const touch = $('touch');
  if (portrait) { touch.style.top = (top + gh) + 'px'; }
  else touch.style.top = '0px';
  if (typeof Game !== 'undefined' && Game.onResize) Game.onResize();
}

// ---------- glow sprite cache ----------
const glowCache = new Map();
const rgbCache = new Map();
const rgbProbe = document.createElement('canvas').getContext('2d');
// normalise any CSS colour to [r,g,b] so we can build alpha stops safely
function colorRGB(color) {
  let v = rgbCache.get(color);
  if (v) return v;
  rgbProbe.fillStyle = '#000';
  rgbProbe.fillStyle = color;
  const s = rgbProbe.fillStyle;
  if (s[0] === '#') v = [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  else { const m = s.match(/[\d.]+/g) || [255, 255, 255]; v = [+m[0], +m[1], +m[2]]; }
  rgbCache.set(color, v);
  return v;
}
function glowSprite(color, r) {
  const key = color + '|' + r;
  let c = glowCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = r * 2;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(r, r, 0, r, r, r);
  const [cr, cg, cb] = colorRGB(color);
  gr.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
  gr.addColorStop(0.35, `rgba(${cr},${cg},${cb},.67)`);
  gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
  glowCache.set(key, c);
  return c;
}
function drawGlow(x, y, r, color, alpha = 1) {
  const s = glowSprite(color, 32);
  ctx.globalAlpha = alpha;
  ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

// ---------- particles ----------
const Particles = {
  list: [],
  max: 700,
  add(p) {
    if (this.list.length >= this.max) this.list.shift();
    p.life = p.life || 0.6; p.t = 0;
    p.vx = p.vx || 0; p.vy = p.vy || 0; p.g = p.g || 0; p.drag = p.drag ?? 0.9; p.size = p.size || 4;
    p.rot = p.rot || 0; p.vr = p.vr || 0;
    this.list.push(p);
    return p;
  },
  burst(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + R(-o.spread || -1, o.spread || 1) : R(0, TAU);
      const sp = R(o.speed * 0.4, o.speed);
      this.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: R(o.life * 0.6, o.life), size: R(o.size * 0.5, o.size),
        color: o.color || pick(o.colors), g: o.g || 0, drag: o.drag ?? 0.92, type: o.type || 'dot', glow: o.glow, shrink: o.shrink ?? true,
        rot: R(0, TAU), vr: R(-10, 10),
      });
    }
  },
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.life) { L.splice(i, 1); continue; }
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.floor != null && p.y > p.floor) { p.y = p.floor; p.vy *= -0.4; p.vx *= 0.7; }
    }
  },
  draw(camX, camY) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      const k = 1 - p.t / p.life;
      const x = p.x - camX, y = p.y - camY;
      if (x < -50 || x > VIEW_W + 50) continue;
      const s = p.shrink ? p.size * (0.3 + 0.7 * k) : p.size;
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(x, y, s * 2.4, p.color, k);
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = p.color;
      if (p.type === 'dot') { ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); }
      else if (p.type === 'sq') { ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.fillRect(-s, -s, s * 2, s * 2); ctx.restore(); }
      else if (p.type === 'shard') { ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.beginPath(); ctx.moveTo(0, -s * 1.6); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s * 1.6); ctx.lineTo(-s * 0.6, 0); ctx.closePath(); ctx.fill(); ctx.restore(); }
      else if (p.type === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.ellipse(x, y, p.size * (1.6 - k), p.size * 0.45 * (1.6 - k), 0, 0, TAU); ctx.stroke(); }
      else if (p.type === 'smoke') { ctx.globalAlpha = k * 0.5; ctx.beginPath(); ctx.arc(x, y, p.size * (1.5 - k * 0.6), 0, TAU); ctx.fill(); }
      else if (p.type === 'line') { ctx.strokeStyle = p.color; ctx.lineWidth = s * 0.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 0.05, y - p.vy * 0.05); ctx.stroke(); }
      else if (p.type === 'star') { ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); starPath(ctx, 0, 0, s, s * 0.45, 5); ctx.fill(); ctx.restore(); }
      else if (p.type === 'note') { ctx.font = `bold ${Math.round(s * 3)}px ${FONT_BODY}`; ctx.fillText('♪', x, y); }
      else if (p.type === 'pix') { ctx.fillRect(Math.round(x / 4) * 4, Math.round(y / 4) * 4, s, s); }
      else if (p.type === 'leaf') { ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    }
    ctx.globalAlpha = 1;
  },
};

// ---------- floating combat text ----------
const FONT_DISPLAY = '"Bungee", "Impact", "Arial Black", sans-serif';
const FONT_BODY = '"Fredoka", "Trebuchet MS", "Segoe UI", sans-serif';
const FONT_PIXEL = '"Silkscreen", "Courier New", monospace';
const Floaters = {
  list: [],
  add(x, y, text, o = {}) {
    if (this.list.length > 80) this.list.shift();
    this.list.push({ x, y, text, t: 0, life: o.life || 0.9, color: o.color || '#fff', size: o.size || 22, vy: o.vy ?? -70, vx: o.vx ?? R(-20, 20), font: o.font || FONT_DISPLAY, pop: o.pop ?? 1 });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.t += dt; f.y += f.vy * dt; f.x += f.vx * dt; f.vy *= Math.pow(0.1, dt);
      if (f.t > f.life) this.list.splice(i, 1);
    }
  },
  draw(camX, camY) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of this.list) {
      const k = f.t / f.life;
      const sc = f.pop * (k < 0.15 ? ease.outBack(k / 0.15) : 1);
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.font = `${Math.round(f.size * Math.max(0.2, sc))}px ${f.font}`;
      ctx.lineWidth = 5; ctx.strokeStyle = '#1a0f2e'; ctx.lineJoin = 'round';
      ctx.strokeText(f.text, f.x - camX, f.y - camY);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x - camX, f.y - camY);
    }
    ctx.globalAlpha = 1;
  },
};

// ---------- shapes ----------
function starPath(g, x, y, r1, r2, n) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = (i / (n * 2)) * TAU - Math.PI / 2;
    g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.closePath();
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function shade(hex, amt) {
  // amt -1..1: darken/lighten
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = lerp(pa >> 16, pb >> 16, t), g = lerp((pa >> 8) & 255, (pb >> 8) & 255, t), bl = lerp(pa & 255, pb & 255, t);
  return '#' + [r, g, bl].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

// ---------- icon painter (procedural glyphs for spells, relics, skills) ----------
function drawIcon(g, id, cx, cy, s, color) {
  // s = icon radius. Draws a badge background + glyph.
  const col = color || '#ffc53d';
  g.save();
  g.translate(cx, cy);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const bg = g.createRadialGradient(-s * 0.3, -s * 0.4, s * 0.1, 0, 0, s);
  bg.addColorStop(0, shade(col, 0.25)); bg.addColorStop(1, shade(col, -0.55));
  g.fillStyle = bg;
  g.beginPath(); g.arc(0, 0, s, 0, TAU); g.fill();
  g.lineWidth = s * 0.09; g.strokeStyle = shade(col, -0.75); g.stroke();
  g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  const u = s / 10;
  const P = (pts, close = true) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * u, y * u) : g.moveTo(x * u, y * u))); if (close) g.closePath(); };
  g.lineWidth = u * 1.4;
  switch (id) {
    case 'fire': case 'fireball': case 'fireAura':
      P([[0, -7], [4, -2], [5, 3], [2, 7], [-2, 7], [-5, 3], [-4, -1], [-2, 1]]); g.fill();
      g.fillStyle = shade(col, 0.5); P([[0, -1], [2, 3], [0, 6], [-2, 3]]); g.fill();
      if (id === 'fireAura') { g.lineWidth = u; g.beginPath(); g.arc(0, 0, 8.3 * u, 0.3, 2.8); g.stroke(); }
      break;
    case 'pillar': case 'tornado':
      for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(i * 0.6 * u, (-6 + i * 4) * u, (6 - i * 1.2) * u, 1.6 * u, 0, 0, TAU); g.stroke(); }
      break;
    case 'meteor':
      g.beginPath(); g.arc(2 * u, 2 * u, 4 * u, 0, TAU); g.fill();
      g.lineWidth = u * 1.6; [[-7, -7], [-8, -3], [-3, -8]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x * u, y * u); g.lineTo(-1 * u, -1 * u); g.stroke(); });
      break;
    case 'ice': case 'iceShard': case 'lance':
      P([[0, -8], [2.5, 0], [0, 8], [-2.5, 0]]); g.fill();
      g.fillStyle = shade(col, 0.3); P([[0, -8], [2.5, 0], [0, 0]]); g.fill();
      break;
    case 'nova': case 'snow': case 'iceOrbit':
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 7 * u, Math.sin(a) * 7 * u); g.stroke();
        g.beginPath(); g.moveTo(Math.cos(a) * 4 * u, Math.sin(a) * 4 * u); g.lineTo(Math.cos(a + 0.5) * 5.5 * u, Math.sin(a + 0.5) * 5.5 * u); g.stroke(); }
      if (id === 'iceOrbit') { g.beginPath(); g.arc(0, 0, 2 * u, 0, TAU); g.fill(); }
      break;
    case 'earth': case 'quake':
      P([[-8, 5], [-4, -2], [-1, 1], [3, -6], [8, 5]]); g.fill();
      g.strokeStyle = shade(col, -0.6); g.lineWidth = u; P([[-2, 5], [0, 2], [-1, 0], [1, -2]], false); g.stroke();
      break;
    case 'boulder':
      g.beginPath(); g.arc(0, 0, 6.5 * u, 0, TAU); g.fill();
      g.fillStyle = shade(col, -0.4); g.beginPath(); g.arc(-2 * u, -1 * u, 1.5 * u, 0, TAU); g.arc(2.5 * u, 2 * u, 1.2 * u, 0, TAU); g.fill();
      break;
    case 'time': case 'chrono': case 'hourglass':
      P([[-5, -7], [5, -7], [0, 0], [5, 7], [-5, 7], [0, 0]]); g.fill();
      g.fillStyle = shade(col, -0.4); P([[-3, 5], [3, 5], [0, 2]]); g.fill();
      break;
    case 'clock': case 'timestop':
      g.beginPath(); g.arc(0, 0, 7 * u, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -5 * u); g.moveTo(0, 0); g.lineTo(3.5 * u, 1.5 * u); g.stroke();
      break;
    case 'blink':
      g.globalAlpha = 0.4; g.beginPath(); g.arc(-4 * u, 0, 3 * u, 0, TAU); g.fill();
      g.globalAlpha = 0.7; g.beginPath(); g.arc(0, 0, 3 * u, 0, TAU); g.fill();
      g.globalAlpha = 1; g.beginPath(); g.arc(4 * u, 0, 3 * u, 0, TAU); g.fill();
      break;
    case 'storm': case 'chain': case 'bolt': case 'static':
      P([[2, -8], [-4, 1], [0, 1], [-2, 8], [5, -2], [1, -2], [3, -8]]); g.fill();
      break;
    case 'sword': case 'wpn':
      g.lineWidth = u * 2.2; g.beginPath(); g.moveTo(-6 * u, 6 * u); g.lineTo(6 * u, -6 * u); g.stroke();
      g.lineWidth = u * 1.6; g.beginPath(); g.moveTo(-6 * u, 1 * u); g.lineTo(-1 * u, 6 * u); g.stroke();
      break;
    case 'reach':
      g.lineWidth = u * 1.6; g.beginPath(); g.moveTo(-7 * u, 0); g.lineTo(7 * u, 0); g.stroke();
      P([[7, 0], [3, -3.5], [3, 3.5]]); g.fill(); P([[-7, 0], [-3, -3.5], [-3, 3.5]]); g.fill();
      break;
    case 'speed': case 'boot':
      P([[-4, -7], [1, -7], [1, 2], [7, 3], [7, 7], [-4, 7]]); g.fill();
      g.lineWidth = u; [[-9, -2], [-9, 2]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x * u, y * u); g.lineTo((x + 3) * u, y * u); g.stroke(); });
      break;
    case 'heart': case 'hp':
      g.beginPath(); g.moveTo(0, 7 * u); g.bezierCurveTo(-9 * u, 0, -6 * u, -8 * u, 0, -3 * u); g.bezierCurveTo(6 * u, -8 * u, 9 * u, 0, 0, 7 * u); g.fill();
      break;
    case '1up':
      g.beginPath(); g.moveTo(0, 7 * u); g.bezierCurveTo(-9 * u, 0, -6 * u, -8 * u, 0, -3 * u); g.bezierCurveTo(6 * u, -8 * u, 9 * u, 0, 0, 7 * u); g.fill();
      g.fillStyle = shade(col, -0.6); g.font = `bold ${5 * u}px ${FONT_PIXEL}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1UP', 0, 0.5 * u);
      break;
    case 'shield': case 'guard':
      P([[0, -8], [7, -5], [6, 3], [0, 8], [-6, 3], [-7, -5]]); g.fill();
      g.fillStyle = shade(col, -0.3); P([[0, -5], [4, -3], [3.5, 2], [0, 5]]); g.fill();
      break;
    case 'fang': case 'vamp':
      P([[-6, -5], [-1, -5], [-3, 6]]); g.fill(); P([[1, -5], [6, -5], [3, 6]]); g.fill();
      break;
    case 'thorn':
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; P([[Math.cos(a) * 8, Math.sin(a) * 8], [Math.cos(a + 0.35) * 3, Math.sin(a + 0.35) * 3], [Math.cos(a - 0.35) * 3, Math.sin(a - 0.35) * 3]]); g.fill(); }
      break;
    case 'clover': case 'luck':
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4; g.beginPath(); g.arc(Math.cos(a) * 3.3 * u, Math.sin(a) * 3.3 * u, 3 * u, 0, TAU); g.fill(); }
      break;
    case 'cart':
      roundRect(g, -6 * u, -7 * u, 12 * u, 13 * u, 1.5 * u); g.fill();
      g.fillStyle = shade(col, -0.5); g.fillRect(-4 * u, -5 * u, 8 * u, 6 * u);
      g.fillStyle = '#fff'; for (let i = -4; i <= 3; i += 2) g.fillRect(i * u, 4 * u, u, 2 * u);
      break;
    case 'magnet':
      g.lineWidth = u * 3; g.beginPath(); g.arc(0, -1 * u, 5 * u, Math.PI, 0); g.stroke();
      g.beginPath(); g.moveTo(-5 * u, -1 * u); g.lineTo(-5 * u, 6 * u); g.moveTo(5 * u, -1 * u); g.lineTo(5 * u, 6 * u); g.stroke();
      g.strokeStyle = shade(col, -0.5); g.lineWidth = u * 3; g.beginPath(); g.moveTo(-5 * u, 4 * u); g.lineTo(-5 * u, 6.5 * u); g.moveTo(5 * u, 4 * u); g.lineTo(5 * u, 6.5 * u); g.stroke();
      break;
    case 'wing': case 'jump':
      g.beginPath(); g.moveTo(-7 * u, 3 * u); g.quadraticCurveTo(-2 * u, -9 * u, 7 * u, -6 * u); g.quadraticCurveTo(2 * u, -3 * u, 4 * u, 0); g.quadraticCurveTo(0, 0, 2 * u, 3 * u); g.quadraticCurveTo(-2 * u, 2 * u, -7 * u, 3 * u); g.fill();
      break;
    case 'gloves': case 'combo': case 'fist':
      roundRect(g, -5 * u, -4 * u, 10 * u, 10 * u, 3 * u); g.fill();
      g.fillStyle = shade(col, -0.4); for (let i = 0; i < 3; i++) g.fillRect((-3.5 + i * 2.6) * u, -4 * u, 1 * u, 4 * u);
      g.fillStyle = '#fff'; roundRect(g, -8 * u, -2 * u, 4 * u, 5 * u, 1.5 * u); g.fill();
      break;
    case 'crystal': case 'mp':
      P([[0, -8], [5, -2], [3, 7], [-3, 7], [-5, -2]]); g.fill();
      g.fillStyle = shade(col, 0.4); P([[0, -8], [5, -2], [0, 0]]); g.fill();
      break;
    case 'coin': case 'greed':
      g.beginPath(); g.arc(0, 0, 7 * u, 0, TAU); g.fill();
      g.fillStyle = shade(col, -0.35); g.font = `bold ${9 * u}px ${FONT_DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('¢', 0, 0.8 * u);
      break;
    case 'book': case 'xp':
      roundRect(g, -7 * u, -6 * u, 14 * u, 12 * u, u); g.fill();
      g.strokeStyle = shade(col, -0.6); g.lineWidth = u; g.beginPath(); g.moveTo(0, -6 * u); g.lineTo(0, 6 * u); g.stroke();
      break;
    case 'dice': case 'reroll':
      roundRect(g, -6 * u, -6 * u, 12 * u, 12 * u, 2.5 * u); g.fill();
      g.fillStyle = shade(col, -0.6); [[-3, -3], [3, 3], [0, 0], [3, -3], [-3, 3]].forEach(([x, y]) => { g.beginPath(); g.arc(x * u, y * u, 1.1 * u, 0, TAU); g.fill(); });
      break;
    case 'card4':
      for (let i = 0; i < 4; i++) { g.save(); g.rotate((i - 1.5) * 0.25); g.globalAlpha = 0.6 + i * 0.13; roundRect(g, -3 * u, -8 * u, 6 * u, 10 * u, u); g.fill(); g.restore(); }
      break;
    case 'eye': case 'crit':
      g.beginPath(); g.ellipse(0, 0, 8 * u, 4.5 * u, 0, 0, TAU); g.fill();
      g.fillStyle = shade(col, -0.6); g.beginPath(); g.arc(0, 0, 2.8 * u, 0, TAU); g.fill();
      break;
    case 'skull': case 'rage':
      g.beginPath(); g.arc(0, -1 * u, 6 * u, 0, TAU); g.fill(); g.fillRect(-3.5 * u, 3 * u, 7 * u, 4 * u);
      g.fillStyle = shade(col, -0.6); g.beginPath(); g.arc(-2.3 * u, -1 * u, 1.6 * u, 0, TAU); g.arc(2.3 * u, -1 * u, 1.6 * u, 0, TAU); g.fill();
      break;
    case 'milk':
      P([[-3, -8], [3, -8], [3, -5], [5, -2], [5, 7], [-5, 7], [-5, -2], [-3, -5]]); g.fill();
      g.fillStyle = shade(col, -0.4); g.fillRect(-5 * u, 0, 10 * u, 3 * u);
      break;
    case 'echo':
      for (let i = 0; i < 3; i++) { g.globalAlpha = 1 - i * 0.3; g.beginPath(); g.arc(0, 0, (3 + i * 2.5) * u, -1, 1); g.stroke(); }
      g.globalAlpha = 1; g.beginPath(); g.arc(-3 * u, 0, 2 * u, 0, TAU); g.fill();
      break;
    case 'steam': case 'duo':
      g.beginPath(); g.arc(-3 * u, 1 * u, 4 * u, 0, TAU); g.arc(3 * u, -1 * u, 4.5 * u, 0, TAU); g.arc(0, 3 * u, 4 * u, 0, TAU); g.fill();
      break;
    case 'up': case 'lvl':
      P([[0, -8], [7, 0], [3, 0], [3, 7], [-3, 7], [-3, 0], [-7, 0]]); g.fill();
      break;
    case 'hammer':
      g.fillRect(-1 * u, -2 * u, 2 * u, 10 * u); roundRect(g, -7 * u, -8 * u, 14 * u, 6 * u, u); g.fill();
      break;
    case 'overkill':
      starPath(g, 0, 0, 8 * u, 3.5 * u, 8); g.fill();
      break;
    case 'recover':
      g.lineWidth = u * 2; g.beginPath(); g.arc(0, 0, 6 * u, -2.6, 1.6); g.stroke(); P([[5.5, 2], [2, 5.5], [7.5, 6.5]]); g.fill();
      break;
    default:
      starPath(g, 0, 0, 7 * u, 3 * u, 5); g.fill();
  }
  g.restore();
}
function iconCanvas(id, color, size = 72) {
  const c = document.createElement('canvas');
  const d = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = size * d;
  const g = c.getContext('2d');
  g.scale(d, d);
  drawIcon(g, id, size / 2, size / 2, size / 2 - 2, color);
  return c;
}
