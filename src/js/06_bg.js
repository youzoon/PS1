// ============================================================
//  Backgrounds: parallax layers (pre-rendered seamless tiles),
//  ground, detail props with easter eggs, weather, lighting.
// ============================================================
function periodic(W, seed, terms = 5, amp = 1) {
  const r = makeRng(seed);
  const t = [];
  for (let i = 0; i < terms; i++) t.push({ k: r.int(1 + i, 2 + i * 3), a: amp / (1 + i * 0.9) * r.range(0.6, 1), p: r.range(0, TAU) });
  return (x) => { let v = 0; for (const q of t) v += q.a * Math.sin((x / W) * TAU * q.k + q.p); return v; };
}
function makeTile(W, H, drawFn) {
  const c = document.createElement('canvas');
  const s = View.scale;
  c.width = Math.ceil(W * s); c.height = Math.ceil(H * s);
  const g = c.getContext('2d');
  g.scale(s, s);
  g.lineJoin = 'round'; g.lineCap = 'round';
  drawFn(g, W, H);
  return { c, W, H };
}
// draw an object at x and its wrapped copies so tiles are seamless
function wrap(W, x, pad, fn) { fn(x); if (x < pad) fn(x + W); if (x > W - pad) fn(x - W); }
function silhouette(g, W, base, f, color, bottom = 400) {
  g.fillStyle = color; g.beginPath(); g.moveTo(0, bottom);
  for (let x = 0; x <= W; x += 6) g.lineTo(x, base + f(x));
  g.lineTo(W, bottom); g.closePath(); g.fill();
}
function vgrad(g, y0, y1, stops) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
  return gr;
}

// ---------- reusable scenery painters ----------
const Paint = {
  roundTree(g, x, y, s, c1, c2, trunk = '#6b4424') {
    g.fillStyle = trunk; g.fillRect(x - 4 * s, y - 30 * s, 8 * s, 30 * s);
    g.fillStyle = c1;
    g.beginPath(); g.arc(x, y - 44 * s, 22 * s, 0, TAU); g.arc(x - 16 * s, y - 34 * s, 15 * s, 0, TAU); g.arc(x + 16 * s, y - 34 * s, 15 * s, 0, TAU); g.fill();
    g.fillStyle = c2; g.beginPath(); g.arc(x - 6 * s, y - 50 * s, 12 * s, 0, TAU); g.arc(x - 18 * s, y - 38 * s, 7 * s, 0, TAU); g.fill();
  },
  pine(g, x, y, s, c1, c2, snow) {
    g.fillStyle = '#5a3a24'; g.fillRect(x - 3 * s, y - 14 * s, 6 * s, 14 * s);
    for (let i = 0; i < 3; i++) {
      const yy = y - 12 * s - i * 18 * s, w = (26 - i * 6) * s;
      g.fillStyle = c1; g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x, yy - 30 * s); g.lineTo(x + w, yy); g.closePath(); g.fill();
      g.fillStyle = c2; g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x, yy - 30 * s); g.lineTo(x - w * 0.2, yy); g.closePath(); g.fill();
      if (snow) { g.fillStyle = snow; g.beginPath(); g.moveTo(x - w * 0.55, yy - 13 * s); g.lineTo(x, yy - 30 * s); g.lineTo(x + w * 0.55, yy - 13 * s); g.quadraticCurveTo(x, yy - 18 * s, x - w * 0.55, yy - 13 * s); g.fill(); }
    }
  },
  palm(g, x, y, s) {
    g.strokeStyle = '#8a5a2b'; g.lineWidth = 6 * s; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10 * s, y - 40 * s, x + 4 * s, y - 80 * s); g.stroke();
    g.fillStyle = '#3f9a4a';
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.55; g.beginPath(); g.ellipse(x + 4 * s + Math.cos(a) * 20 * s, y - 80 * s + Math.sin(a) * 10 * s + 8 * s, 24 * s, 6 * s, a, 0, TAU); g.fill(); }
  },
  cloud(g, x, y, s, c = '#ffffff') {
    g.fillStyle = c; g.beginPath();
    g.arc(x, y, 18 * s, 0, TAU); g.arc(x + 20 * s, y - 8 * s, 22 * s, 0, TAU); g.arc(x + 44 * s, y, 17 * s, 0, TAU); g.arc(x + 22 * s, y + 6 * s, 16 * s, 0, TAU); g.fill();
  },
  house(g, x, y, w, h, wall, roof, o = {}) {
    g.fillStyle = wall; g.fillRect(x, y - h, w, h);
    g.fillStyle = shade(wall, -0.2); g.fillRect(x, y - h, w * 0.25, h);
    if (o.timber) { g.strokeStyle = '#5a3a24'; g.lineWidth = 3; g.strokeRect(x, y - h, w, h); g.beginPath(); g.moveTo(x, y - h * 0.5); g.lineTo(x + w, y - h * 0.5); g.moveTo(x + w * 0.5, y - h); g.lineTo(x + w * 0.5, y); g.stroke(); }
    g.fillStyle = roof; g.beginPath(); g.moveTo(x - 8, y - h); g.lineTo(x + w / 2, y - h - h * 0.7); g.lineTo(x + w + 8, y - h); g.closePath(); g.fill();
    g.fillStyle = shade(roof, -0.25); g.beginPath(); g.moveTo(x - 8, y - h); g.lineTo(x + w / 2, y - h - h * 0.7); g.lineTo(x + w * 0.3, y - h); g.closePath(); g.fill();
    // windows
    g.fillStyle = o.lit ? '#ffe9a0' : '#3a4a7a';
    g.fillRect(x + w * 0.15, y - h * 0.8, w * 0.22, h * 0.25); g.fillRect(x + w * 0.63, y - h * 0.8, w * 0.22, h * 0.25);
    g.fillStyle = '#5a3a24'; g.fillRect(x + w * 0.4, y - h * 0.42, w * 0.2, h * 0.42);
    if (o.chimney) { g.fillStyle = '#8a4a3a'; g.fillRect(x + w * 0.72, y - h - h * 0.55, w * 0.12, h * 0.35); }
  },
  mountain(g, x, y, w, h, c, snow, shadowC) {
    g.fillStyle = c; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - h); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
    if (shadowC) { g.fillStyle = shadowC; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w / 2, y); g.lineTo(x + w * 0.1, y); g.closePath(); g.fill(); }
    if (snow) { g.fillStyle = snow; g.beginPath(); g.moveTo(x - w * 0.14, y - h * 0.72); g.lineTo(x, y - h); g.lineTo(x + w * 0.14, y - h * 0.72); g.lineTo(x + w * 0.05, y - h * 0.66); g.lineTo(x - w * 0.03, y - h * 0.74); g.closePath(); g.fill(); }
  },
  castle(g, x, y, s, c, roof) {
    g.fillStyle = c;
    g.fillRect(x - 40 * s, y - 60 * s, 80 * s, 60 * s);
    for (const tx of [-50, 34]) { g.fillRect(x + tx * s, y - 90 * s, 16 * s, 90 * s); g.fillStyle = roof; g.beginPath(); g.moveTo(x + (tx - 4) * s, y - 90 * s); g.lineTo(x + (tx + 8) * s, y - 116 * s); g.lineTo(x + (tx + 20) * s, y - 90 * s); g.fill(); g.fillStyle = c; }
    g.fillRect(x - 10 * s, y - 100 * s, 20 * s, 40 * s);
    g.fillStyle = roof; g.beginPath(); g.moveTo(x - 14 * s, y - 100 * s); g.lineTo(x, y - 130 * s); g.lineTo(x + 14 * s, y - 100 * s); g.fill();
    for (let i = 0; i < 5; i++) { g.fillStyle = c; g.fillRect(x - 40 * s + i * 17 * s, y - 68 * s, 9 * s, 8 * s); }
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - 8 * s, y - 24 * s, 16 * s, 24 * s);
    g.strokeStyle = '#ff4f73'; g.lineWidth = 1.5 * s; g.beginPath(); g.moveTo(x, y - 130 * s); g.lineTo(x, y - 145 * s); g.stroke();
    g.fillStyle = '#ff4f73'; g.fillRect(x, y - 145 * s, 10 * s, 6 * s);
  },
  pyramid(g, x, y, w, c) {
    g.fillStyle = c; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - w * 0.6); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
    g.fillStyle = shade(c, -0.22); g.beginPath(); g.moveTo(x, y - w * 0.6); g.lineTo(x + w / 2, y); g.lineTo(x + w * 0.08, y); g.closePath(); g.fill();
    g.strokeStyle = shade(c, -0.12); g.lineWidth = 1;
    for (let i = 1; i < 8; i++) { const yy = y - (w * 0.6) * i / 8, hw = (w / 2) * (1 - i / 8); g.beginPath(); g.moveTo(x - hw, yy); g.lineTo(x + hw, yy); g.stroke(); }
  },
  cactus(g, x, y, s, shades) {
    g.fillStyle = '#4aa84a'; roundRect(g, x - 6 * s, y - 50 * s, 12 * s, 50 * s, 6 * s); g.fill();
    roundRect(g, x - 20 * s, y - 36 * s, 8 * s, 20 * s, 4 * s); g.fill(); g.fillRect(x - 16 * s, y - 20 * s, 12 * s, 6 * s);
    roundRect(g, x + 12 * s, y - 42 * s, 8 * s, 18 * s, 4 * s); g.fill(); g.fillRect(x + 4 * s, y - 28 * s, 12 * s, 6 * s);
    if (shades) { g.fillStyle = '#1b1030'; g.fillRect(x - 8 * s, y - 42 * s, 16 * s, 4 * s); g.fillRect(x - 7 * s, y - 42 * s, 6 * s, 5 * s); g.fillRect(x + 1 * s, y - 42 * s, 6 * s, 5 * s); }
  },
  bigShroom(g, x, y, s, cap, stem, glow) {
    g.fillStyle = stem; roundRect(g, x - 8 * s, y - 60 * s, 16 * s, 60 * s, 6 * s); g.fill();
    g.fillStyle = cap; g.beginPath(); g.ellipse(x, y - 60 * s, 40 * s, 22 * s, 0, Math.PI, TAU); g.fill();
    g.fillStyle = glow; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x - 26 * s + i * 13 * s, y - 68 * s - (i % 2) * 6 * s, 3.5 * s, 0, TAU); g.fill(); }
  },
  building(g, x, y, w, h, c, win, r) {
    g.fillStyle = c; g.fillRect(x, y - h, w, h);
    g.fillStyle = shade(c, 0.08); g.fillRect(x + w - 6, y - h, 6, h);
    for (let yy = y - h + 10; yy < y - 12; yy += 16) for (let xx = x + 6; xx < x + w - 10; xx += 12) {
      g.fillStyle = r() < 0.4 ? win[Math.floor(r() * win.length)] : shade(c, -0.25);
      g.fillRect(xx, yy, 6, 8);
    }
    if (r() < 0.5) { g.strokeStyle = shade(c, 0.2); g.lineWidth = 2; g.beginPath(); g.moveTo(x + w / 2, y - h); g.lineTo(x + w / 2, y - h - 20); g.stroke(); g.fillStyle = '#ff4f73'; g.beginPath(); g.arc(x + w / 2, y - h - 20, 2.5, 0, TAU); g.fill(); }
  },
};

// ---------- biome definitions ----------
// Each: sky(stops), far/mid/near painters, ground painter, props list, weather, tint
const BIOMES = {};
function groundBase(g, W, H, top, stops) {
  g.fillStyle = vgrad(g, 0, H, stops); g.fillRect(0, 0, W, H);
}
BIOMES.meadow = {
  music: 'meadow', sky: ['#5fb2ff', '#a9dbff', '#ffe7c2'], sun: { x: 0.75, y: 90, r: 38, c: '#fff4c2' }, clouds: '#ffffff',
  far(g, W, H) {
    const f = periodic(W, 11, 4, 40);
    silhouette(g, W, 250, f, '#9cc2e8');
    const f2 = periodic(W, 12, 5, 24);
    silhouette(g, W, 285, f2, '#7fb0d8');
    const r = makeRng(5);
    for (let i = 0; i < 4; i++) { const x = r.range(0, W); wrap(W, x, 80, (xx) => Paint.mountain(g, xx, 290, 260, r.range(110, 170), '#8fb2d6', '#f4fbff', '#7a9dc4')); }
  },
  mid(g, W, H) {
    const f = periodic(W, 21, 4, 18);
    silhouette(g, W, 300, f, '#6fbf5a');
    const r = makeRng(22);
    for (let i = 0; i < 26; i++) { const x = r.range(0, W); const s = r.range(0.5, 0.8); wrap(W, x, 40, (xx) => Paint.roundTree(g, xx, 305 + f(xx) * 0.4, s, '#4f9f45', '#77c26a')); }
    // windmill
    wrap(W, W * 0.62, 60, (xx) => {
      g.fillStyle = '#e9dcc2'; g.beginPath(); g.moveTo(xx - 14, 300); g.lineTo(xx - 8, 236); g.lineTo(xx + 8, 236); g.lineTo(xx + 14, 300); g.fill();
      g.fillStyle = '#b0502a'; g.beginPath(); g.moveTo(xx - 11, 238); g.lineTo(xx, 222); g.lineTo(xx + 11, 238); g.fill();
    });
    // tiny cows in a field (the cow level is foreshadowed)
    for (let i = 0; i < 3; i++) { const x = W * 0.2 + i * 22; g.fillStyle = '#fff'; g.fillRect(x, 292, 10, 5); g.fillStyle = '#1b1030'; g.fillRect(x + 3, 292, 3, 2); g.fillRect(x + 9, 290, 3, 3); }
  },
  near(g, W, H) {
    const r = makeRng(33);
    for (let i = 0; i < 7; i++) {
      const x = i * (W / 7) + r.range(0, 60);
      wrap(W, x, 100, (xx) => {
        if (i % 3 === 1) Paint.house(g, xx, 322, 70, 52, '#f1dfb3', '#d8343f', { timber: true, chimney: true });
        else Paint.roundTree(g, xx, 324, r.range(1.1, 1.4), '#3f8f3a', '#63b35a');
      });
    }
    // fence line
    g.fillStyle = '#a0703a';
    for (let x = 0; x < W; x += 22) { g.fillRect(x, 300, 5, 26); }
    g.fillRect(0, 306, W, 4); g.fillRect(0, 316, W, 4);
  },
  ground(g, W, H) {
    groundBase(g, W, H, 0, ['#5aa83f', '#79c24f', '#6db548']);
    // dirt path band through the middle
    g.fillStyle = '#d9b77a'; g.beginPath(); g.moveTo(0, 70);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, 70 + Math.sin(x / W * TAU * 3) * 8);
    for (let x = W; x >= 0; x -= 16) g.lineTo(x, 150 + Math.sin(x / W * TAU * 2 + 1) * 10);
    g.fill();
    const r = makeRng(44);
    for (let i = 0; i < 180; i++) { const x = r.range(0, W), y = r.range(0, H); g.fillStyle = r() < 0.5 ? '#4f9a37' : '#8ad35f'; g.fillRect(x, y, 2, r.range(4, 8)); }
    for (let i = 0; i < 40; i++) { const x = r.range(0, W), y = r.range(75, 145); g.fillStyle = '#b8955a'; g.beginPath(); g.ellipse(x, y, r.range(3, 7), r.range(2, 3), 0, 0, TAU); g.fill(); }
    for (let i = 0; i < 30; i++) { const x = r.range(0, W), y = r.pick([r.range(5, 60), r.range(160, 210)]); g.fillStyle = r.pick(['#fff', '#ffe45c', '#ff9fb8', '#b77cff']); g.beginPath(); g.arc(x, y, 2.5, 0, TAU); g.fill(); }
  },
  props: ['sign_meadow', 'floppy', 'eggpet', 'mailbox', 'construction', 'barrelStack', 'haybale', 'well'],
  weather: 'petals',
};
BIOMES.village = {
  music: 'meadow', sky: ['#6aa8ff', '#b5d8ff', '#ffdcb0'], sun: { x: 0.2, y: 80, r: 34, c: '#fff4c2' }, clouds: '#ffffff',
  far(g, W, H) {
    silhouette(g, W, 262, periodic(W, 31, 4, 30), '#a8c4e6');
    wrap(W, W * 0.4, 80, (xx) => Paint.castle(g, xx, 275, 1.1, '#b8c2d8', '#6a7aa8'));
  },
  mid(g, W, H) {
    silhouette(g, W, 296, periodic(W, 32, 4, 12), '#79b86a');
    const r = makeRng(36);
    for (let i = 0; i < 10; i++) { const x = r.range(0, W); wrap(W, x, 60, (xx) => Paint.house(g, xx, 300, r.range(30, 46), r.range(22, 32), r.pick(['#e8d3a8', '#f1dfb3', '#d9c6a0']), r.pick(['#b0502a', '#6a4aa8', '#2f6bd8']), {})); }
  },
  near(g, W, H) {
    const r = makeRng(37);
    for (let i = 0; i < 6; i++) {
      const x = i * (W / 6) + 20;
      wrap(W, x, 120, (xx) => Paint.house(g, xx, 322, r.range(80, 110), r.range(60, 80), r.pick(['#f1dfb3', '#e8c9a0', '#d9e0f0']), r.pick(['#b0502a', '#8a2b4a', '#3a5aa8']), { timber: r() < 0.6, chimney: true, lit: r() < 0.3 }));
    }
    // bunting
    g.strokeStyle = '#5a3a24'; g.lineWidth = 1.5; g.beginPath();
    for (let x = 0; x <= W; x += 4) g.lineTo(x, 196 + Math.abs(Math.sin(x / 90 * Math.PI)) * 14); g.stroke();
    const cs = ['#ff4f73', '#ffc53d', '#3ee6a8', '#55c8ff'];
    for (let x = 10, i = 0; x < W; x += 18, i++) { const y = 196 + Math.abs(Math.sin(x / 90 * Math.PI)) * 14; g.fillStyle = cs[i % 4]; g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.lineTo(x, y + 12); g.fill(); }
  },
  ground(g, W, H) {
    groundBase(g, W, H, 0, ['#9a8f86', '#b3a89c', '#a39789']);
    const r = makeRng(38);
    for (let y = 0; y < H; y += 14) for (let x = (y / 14) % 2 ? 0 : 12; x < W; x += 24) {
      g.fillStyle = r() < 0.5 ? '#c2b8ac' : '#a89c8f'; roundRect(g, x + 1, y + 1, 22, 12, 4); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 4, y + 3, 10, 2);
    }
  },
  props: ['stall', 'wanted', 'cafe', 'graffiti_base', 'cake', 'barrelStack', 'lamp', 'vhs'],
  weather: 'none',
};
BIOMES.forest = {
  music: 'forest', sky: ['#2f6f6a', '#5fa88a', '#c9e6a8'], sun: null, clouds: null, rays: '#fff7c2',
  far(g, W, H) {
    const r = makeRng(41);
    for (let i = 0; i < 40; i++) { const x = r.range(0, W); wrap(W, x, 40, (xx) => Paint.pine(g, xx, 300, r.range(1.2, 1.8), '#4f8a6a', '#467a5e')); }
    g.fillStyle = 'rgba(200,240,210,.25)'; g.fillRect(0, 0, W, H);
  },
  mid(g, W, H) {
    const r = makeRng(42);
    for (let i = 0; i < 26; i++) { const x = r.range(0, W); wrap(W, x, 60, (xx) => Paint.roundTree(g, xx, 310, r.range(1.3, 1.9), '#2f7a3a', '#3f9a4a', '#5a3a24')); }
  },
  near(g, W, H) {
    const r = makeRng(43);
    for (let i = 0; i < 9; i++) {
      const x = i * (W / 9) + r.range(0, 40);
      wrap(W, x, 80, (xx) => {
        // big trunks with roots
        const w = r.range(26, 40);
        g.fillStyle = '#5e3d22'; g.fillRect(xx - w / 2, 0, w, 330);
        g.fillStyle = '#4a2f18'; g.fillRect(xx - w / 2, 0, w * 0.35, 330);
        g.fillStyle = '#5e3d22'; g.beginPath(); g.moveTo(xx - w / 2, 300); g.quadraticCurveTo(xx - w, 326, xx - w * 1.4, 330); g.lineTo(xx + w * 1.4, 330); g.quadraticCurveTo(xx + w, 326, xx + w / 2, 300); g.fill();
        if (i === 3) { g.fillStyle = '#e8c9a0'; g.font = `bold 11px ${FONT_BODY}`; g.textAlign = 'center'; g.fillText('R+M', xx, 240); g.strokeStyle = '#e8c9a0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(xx - 10, 226); g.bezierCurveTo(xx - 16, 216, xx - 4, 212, xx, 220); g.bezierCurveTo(xx + 4, 212, xx + 16, 216, xx + 10, 226); g.lineTo(xx, 236); g.closePath(); g.stroke(); }
      });
    }
    // canopy on top
    g.fillStyle = '#23592b';
    for (let x = -20; x < W + 20; x += 34) { g.beginPath(); g.arc(x, 10 + Math.sin(x) * 8, 40, 0, TAU); g.fill(); }
    g.fillStyle = '#2f7a3a';
    for (let x = 0; x < W; x += 46) { g.beginPath(); g.arc(x, 30 + Math.cos(x) * 6, 26, 0, TAU); g.fill(); }
  },
  ground(g, W, H) {
    groundBase(g, W, H, 0, ['#3d6b2c', '#4f8a38', '#44792f']);
    const r = makeRng(45);
    for (let i = 0; i < 120; i++) { g.fillStyle = r.pick(['#8a5a2b', '#c98b3a', '#d8a04a', '#6b8a2c']); g.save(); g.translate(r.range(0, W), r.range(0, H)); g.rotate(r.range(0, TAU)); g.beginPath(); g.ellipse(0, 0, 5, 2.4, 0, 0, TAU); g.fill(); g.restore(); }
    for (let i = 0; i < 160; i++) { g.fillStyle = r() < 0.5 ? '#2f5f22' : '#6fae4a'; g.fillRect(r.range(0, W), r.range(0, H), 2, r.range(4, 9)); }
  },
  props: ['cavesign', 'duck', 'stump', 'mushroomRing', 'log', 'owl'],
  weather: 'leaves',
};
BIOMES.mushroom = {
  music: 'forest', sky: ['#1d1245', '#3a2a7a', '#7a5cc9'], sun: null, moon: { x: 0.3, y: 70, r: 26 }, stars: true, clouds: null,
  far(g, W, H) {
    silhouette(g, W, 240, periodic(W, 51, 4, 40), '#2a1f5c');
    const r = makeRng(52);
    for (let i = 0; i < 18; i++) { const x = r.range(0, W); wrap(W, x, 60, (xx) => Paint.bigShroom(g, xx, 280, r.range(0.8, 1.4), '#3a2a7a', '#4a3a8a', '#7a5cff')); }
  },
  mid(g, W, H) {
    silhouette(g, W, 292, periodic(W, 53, 4, 14), '#2b2266');
    const r = makeRng(54);
    for (let i = 0; i < 16; i++) { const x = r.range(0, W); wrap(W, x, 60, (xx) => Paint.bigShroom(g, xx, 305, r.range(1.1, 1.8), r.pick(['#c93a6a', '#7a5cff', '#3ab0c9']), '#e6dcff', '#ffe45c')); }
  },
  near(g, W, H) {
    const r = makeRng(55);
    for (let i = 0; i < 6; i++) { const x = i * (W / 6) + r.range(0, 60); wrap(W, x, 90, (xx) => Paint.bigShroom(g, xx, 330, r.range(2.2, 2.8), r.pick(['#e04a5a', '#9a4aff', '#ff8a2b']), '#fff1d6', '#fff4c2')); }
  },
  ground(g, W, H) {
    groundBase(g, W, H, 0, ['#2e2a5a', '#3a3570', '#302b60']);
    const r = makeRng(56);
    for (let i = 0; i < 90; i++) { g.fillStyle = r.pick(['#5a4aa8', '#4a3a8a', '#6fdc5a']); g.beginPath(); g.arc(r.range(0, W), r.range(0, H), r.range(1, 3), 0, TAU); g.fill(); }
    for (let i = 0; i < 26; i++) { const x = r.range(0, W), y = r.range(0, H); g.fillStyle = '#e04a5a'; g.beginPath(); g.ellipse(x, y, 6, 4, 0, Math.PI, TAU); g.fill(); g.fillStyle = '#fff1d6'; g.fillRect(x - 1.5, y, 3, 4); }
  },
  props: ['glowSign', 'stump', 'mushroomRing', 'cauldron', 'eggpet'],
  weather: 'fireflies', tint: 'rgba(40,20,90,.12)',
};
BIOMES.desert = {
  music: 'desert', sky: ['#ff9a5a', '#ffc27a', '#ffe9b0'], sun: { x: 0.8, y: 110, r: 52, c: '#fff1b0' }, clouds: null, heat: true,
  far(g, W, H) {
    silhouette(g, W, 262, periodic(W, 61, 3, 16), '#e8a868');
    const r = makeRng(62);
    for (let i = 0; i < 3; i++) { const x = W * (0.15 + i * 0.3) + r.range(-40, 40); wrap(W, x, 140, (xx) => Paint.pyramid(g, xx, 280, r.range(160, 240), '#e2b06a')); }
  },
  mid(g, W, H) {
    silhouette(g, W, 294, periodic(W, 63, 4, 18), '#f0c07a');
    const r = makeRng(64);
    for (let i = 0; i < 8; i++) { const x = r.range(0, W); wrap(W, x, 40, (xx) => Paint.cactus(g, xx, 300, r.range(0.6, 0.9), false)); }
    for (let i = 0; i < 3; i++) { const x = r.range(0, W); wrap(W, x, 40, (xx) => Paint.palm(g, xx, 302, 0.9)); }
  },
  near(g, W, H) {
    silhouette(g, W, 318, periodic(W, 65, 3, 10), '#f5cd8a');
    const r = makeRng(66);
    for (let i = 0; i < 5; i++) { const x = i * (W / 5) + r.range(0, 80); wrap(W, x, 40, (xx) => Paint.cactus(g, xx, 326, 1.3, i === 2)); }
    // giant fish skeleton
    wrap(W, W * 0.7, 120, (xx) => {
      g.strokeStyle = '#fff4e2'; g.lineWidth = 4; g.beginPath(); g.moveTo(xx - 80, 316); g.lineTo(xx + 60, 312); g.stroke();
      for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(xx - 60 + i * 16, 314); g.quadraticCurveTo(xx - 56 + i * 16, 296, xx - 64 + i * 16, 290); g.stroke(); }
      g.beginPath(); g.arc(xx + 72, 306, 14, 0, TAU); g.stroke();
    });
  },
  ground(g, W, H) {
    groundBase(g, W, H, 0, ['#f0c07a', '#f5cd8a', '#eab874']);
    g.strokeStyle = 'rgba(180,120,60,.35)'; g.lineWidth = 2;
    for (let y = 10; y < H; y += 22) { g.beginPath(); for (let x = 0; x <= W; x += 10) g.lineTo(x, y + Math.sin((x / W) * TAU * 6 + y) * 4); g.stroke(); }
    const r = makeRng(67);
    for (let i = 0; i < 40; i++) { g.fillStyle = '#c99a5b'; g.beginPath(); g.ellipse(r.range(0, W), r.range(0, H), r.range(2, 5), r.range(1, 3), 0, 0, TAU); g.fill(); }
  },
  props: ['crt_desert', 'bunker', 'skull', 'oasis', 'camel'],
  weather: 'sand',
};
BIOMES.tomb = {
  music: 'desert', sky: ['#1a1208', '#2e2010', '#4a3418'], sun: null, clouds: null, torches: true,
  far(g, W, H) {
    g.fillStyle = '#3a2a18'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 26) for (let x = (y / 26) % 2 ? 0 : 30; x < W; x += 60) { g.fillStyle = '#4a3620'; g.fillRect(x + 2, y + 2, 56, 22); }
  },
  mid(g, W, H) {
    // wall with hieroglyph panels
    g.fillStyle = '#6b5030'; g.fillRect(0, 60, W, 270);
    for (let y = 60; y < 330; y += 30) for (let x = (y / 30) % 2 ? 0 : 40; x < W; x += 80) { g.fillStyle = '#7a5c38'; g.fillRect(x + 2, y + 2, 76, 26); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + 2, y + 24, 76, 4); }
    const glyphs = ['eye', 'floppy', 'joy', 'bird', 'ankh', 'cart', 'wave', 'heart'];
    for (let i = 0; i < 14; i++) {
      const x = 40 + i * (W / 14);
      g.fillStyle = '#d9b77a'; g.fillRect(x - 22, 120, 44, 130);
      g.strokeStyle = '#5a3a18'; g.lineWidth = 2;
      for (let j = 0; j < 3; j++) glyph(g, glyphs[(i * 3 + j) % glyphs.length], x, 145 + j * 40);
    }
  },
  near(g, W, H) {
    for (let i = 0; i < 6; i++) {
      const x = i * (W / 6) + 60;
      wrap(W, x, 60, (xx) => {
        g.fillStyle = '#8a6a40'; g.fillRect(xx - 26, 30, 52, 300);
        g.fillStyle = '#6b5030'; g.fillRect(xx - 26, 30, 16, 300);
        g.fillStyle = '#a07a48'; g.fillRect(xx - 34, 20, 68, 18); g.fillRect(xx - 34, 310, 68, 20);
        g.fillStyle = '#2f5bd8'; for (let k = 0; k < 6; k++) g.fillRect(xx - 26, 60 + k * 40, 52, 6);
      });
    }
  },
  ground(g, W, H) {
    groundBase(g, W, H, 0, ['#8a6a40', '#a07a48', '#8a6a40']);
    for (let y = 0; y < H; y += 32) for (let x = (y / 32) % 2 ? 0 : 40; x < W; x += 80) { g.strokeStyle = 'rgba(40,20,0,.35)'; g.lineWidth = 2; g.strokeRect(x, y, 80, 32); }
    const r = makeRng(71);
    for (let i = 0; i < 50; i++) { g.fillStyle = 'rgba(240,200,120,.35)'; g.beginPath(); g.ellipse(r.range(0, W), r.range(0, H), r.range(8, 20), r.range(3, 6), 0, 0, TAU); g.fill(); }
  },
  props: ['sarcophagus', 'urn', 'treasure', 'torchpost', 'skull'],
  weather: 'dust', tint: 'rgba(30,10,0,.25)', dark: 0.35,
};
function glyph(g, k, x, y) {
  g.beginPath();
  switch (k) {
    case 'eye': g.ellipse(x, y, 12, 6, 0, 0, TAU); g.moveTo(x + 3, y); g.arc(x, y, 3, 0, TAU); g.moveTo(x - 4, y + 6); g.lineTo(x - 8, y + 14); break;
    case 'floppy': g.rect(x - 9, y - 9, 18, 18); g.rect(x - 5, y - 9, 10, 6); g.rect(x - 6, y + 2, 12, 7); break;
    case 'joy': g.rect(x - 10, y + 2, 20, 8); g.moveTo(x, y + 2); g.lineTo(x, y - 8); g.moveTo(x + 3, y - 9); g.arc(x, y - 9, 3, 0, TAU); break;
    case 'bird': g.moveTo(x - 10, y + 8); g.quadraticCurveTo(x - 4, y - 10, x + 8, y - 6); g.lineTo(x + 12, y - 4); g.lineTo(x + 8, y - 2); g.quadraticCurveTo(x, y + 2, x - 10, y + 8); break;
    case 'ankh': g.ellipse(x, y - 6, 5, 6, 0, 0, TAU); g.moveTo(x, y); g.lineTo(x, y + 12); g.moveTo(x - 8, y + 2); g.lineTo(x + 8, y + 2); break;
    case 'cart': g.rect(x - 8, y - 10, 16, 20); g.rect(x - 5, y - 7, 10, 8); break;
    case 'wave': for (let i = 0; i < 3; i++) { g.moveTo(x - 10, y - 6 + i * 6); g.lineTo(x - 5, y - 9 + i * 6); g.lineTo(x, y - 6 + i * 6); g.lineTo(x + 5, y - 9 + i * 6); g.lineTo(x + 10, y - 6 + i * 6); } break;
    case 'heart': g.moveTo(x, y + 8); g.bezierCurveTo(x - 12, y, x - 8, y - 10, x, y - 4); g.bezierCurveTo(x + 8, y - 10, x + 12, y, x, y + 8); break;
  }
  g.stroke();
}
BIOMES.ice = {
  music: 'ice', sky: ['#7fb6ff', '#c9e6ff', '#f4fbff'], sun: { x: 0.3, y: 90, r: 30, c: '#ffffff' }, clouds: '#f4fbff',
  far(g, W, H) {
    const r = makeRng(81);
    for (let i = 0; i < 7; i++) { const x = r.range(0, W); wrap(W, x, 160, (xx) => Paint.mountain(g, xx, 300, r.range(260, 380), r.range(150, 230), '#a9c8ec', '#ffffff', '#8fb2d6')); }
  },
  mid(g, W, H) {
    silhouette(g, W, 292, periodic(W, 82, 4, 16), '#e6f3ff');
    const r = makeRng(83);
    for (let i = 0; i < 30; i++) { const x = r.range(0, W); wrap(W, x, 40, (xx) => Paint.pine(g, xx, 300, r.range(0.7, 1.1), '#2f6a5a', '#285a4c', '#ffffff')); }
  },
  near(g, W, H) {
    silhouette(g, W, 318, periodic(W, 84, 3, 8), '#f4fbff');
    const r = makeRng(85);
    for (let i = 0; i < 7; i++) { const x = i * (W / 7) + r.range(0, 60); wrap(W, x, 60, (xx) => Paint.pine(g, xx, 330, r.range(1.6, 2.1), '#2f6a5a', '#285a4c', '#ffffff')); }
    // icicle cliff edge at top
    g.fillStyle = '#dff3ff';
    for (let x = 0; x < W; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 9, 18 + (x * 7 % 23)); g.lineTo(x + 18, 0); g.fill(); }
  },
  ground(g, W, H) {
    groundBase(g, W, H, 0, ['#e6f3ff', '#f4fbff', '#dcecfb']);
    const r = makeRng(86);
    for (let i = 0; i < 18; i++) { const x = r.range(0, W), y = r.range(20, H - 20); g.fillStyle = 'rgba(127,227,255,.35)'; g.beginPath(); g.ellipse(x, y, r.range(30, 70), r.range(8, 14), 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x - 10, y - 3, 20, 2); }
    for (let i = 0; i < 100; i++) { g.fillStyle = 'rgba(160,190,230,.45)'; g.beginPath(); g.arc(r.range(0, W), r.range(0, H), r.range(1, 3), 0, TAU); g.fill(); }
  },
  props: ['snowman_cone', 'skisign', 'icecube_pet', 'igloo', 'penguin'],
  weather: 'snow',
};
BIOMES.volcano = {
  music: 'volcano', sky: ['#1a0508', '#5a1010', '#c9401a'], sun: null, clouds: null, volcano: true,
  far(g, W, H) {
    wrap(W, W * 0.5, 260, (xx) => {
      g.fillStyle = '#2a0e0e'; g.beginPath(); g.moveTo(xx - 260, 290); g.lineTo(xx - 50, 110); g.lineTo(xx + 50, 110); g.lineTo(xx + 260, 290); g.fill();
      g.fillStyle = '#ff7a2f'; g.beginPath(); g.moveTo(xx - 40, 112); g.lineTo(xx - 20, 170); g.lineTo(xx - 30, 230); g.lineTo(xx - 10, 290); g.lineTo(xx + 4, 290); g.lineTo(xx - 12, 230); g.lineTo(xx, 168); g.lineTo(xx + 40, 112); g.fill();
    });
    silhouette(g, W, 270, periodic(W, 91, 4, 26), '#3a1212');
  },
  mid(g, W, H) {
    silhouette(g, W, 296, periodic(W, 92, 4, 14), '#2a0e0e');
    // lava river glow
    g.fillStyle = '#ff5a1f'; g.fillRect(0, 300, W, 8);
    g.fillStyle = '#ffd35c'; for (let x = 0; x < W; x += 30) g.fillRect(x, 302, 12, 3);
    const r = makeRng(93);
    for (let i = 0; i < 8; i++) { const x = r.range(0, W); wrap(W, x, 20, (xx) => { g.fillStyle = '#1a0808'; g.beginPath(); g.moveTo(xx - 10, 300); g.lineTo(xx - 3, 250); g.lineTo(xx + 4, 256); g.lineTo(xx + 10, 300); g.fill(); }); }
  },
  near(g, W, H) {
    const r = makeRng(94);
    for (let i = 0; i < 5; i++) {
      const x = i * (W / 5) + r.range(0, 60);
      wrap(W, x, 100, (xx) => {
        // forge building with chimney
        g.fillStyle = '#3a2a2a'; g.fillRect(xx - 60, 250, 120, 76);
        g.fillStyle = '#2a1e1e'; g.fillRect(xx - 60, 250, 30, 76);
        g.fillStyle = '#4a3434'; g.fillRect(xx + 20, 190, 22, 64);
        g.fillStyle = '#ff7a2f'; g.fillRect(xx - 20, 280, 40, 30);
        g.fillStyle = '#ffd35c'; g.fillRect(xx - 12, 290, 24, 14);
        g.fillStyle = '#5a4040'; g.beginPath(); g.moveTo(xx - 70, 252); g.lineTo(xx, 226); g.lineTo(xx + 70, 252); g.fill();
      });
    }
  },
  ground(g, W, H) {
    groundBase(g, W, H, 0, ['#2a1e1e', '#3a2a2a', '#2e2020']);
    const r = makeRng(95);
    for (let i = 0; i < 22; i++) {
      const x = r.range(0, W), y = r.range(10, H - 10);
      g.strokeStyle = '#ff5a1f'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y);
      let xx = x, yy = y; for (let k = 0; k < 5; k++) { xx += r.range(8, 22); yy += r.range(-8, 8); g.lineTo(xx, yy); } g.stroke();
      g.strokeStyle = '#ffd35c'; g.lineWidth = 1; g.stroke();
    }
    for (let i = 0; i < 60; i++) { g.fillStyle = '#4a3838'; g.beginPath(); g.ellipse(r.range(0, W), r.range(0, H), r.range(4, 10), r.range(2, 5), 0, 0, TAU); g.fill(); }
  },
  props: ['anvil', 'duck', 'mug', 'lavapool', 'skull'],
  weather: 'embers', tint: 'rgba(90,10,0,.12)',
};
BIOMES.neon = {
  music: 'neon', sky: ['#07051a', '#1d0f45', '#5a1a6a'], sun: null, moon: { x: 0.8, y: 60, r: 22 }, stars: true, clouds: null, rain: true,
  far(g, W, H) {
    const r = makeRng(101);
    for (let x = 0; x < W; x += r.range(30, 60)) { const w = r.range(30, 60), h = r.range(80, 220); Paint.building(g, x, 300, w, h, '#1a1440', ['#3dfff6', '#ff3df2', '#ffe45c'], r); }
  },
  mid(g, W, H) {
    const r = makeRng(102);
    for (let x = 0; x < W; x += r.range(50, 90)) { const w = r.range(50, 90), h = r.range(60, 150); Paint.building(g, x, 310, w, h, '#2a1f5c', ['#3dfff6', '#ff3df2', '#ffe45c', '#fff4c2'], r); }
  },
  near(g, W, H) {
    const signs = [['ARCADE', '#ff3df2'], ['NET CAFE 56k', '#3dfff6'], ['PIZZA', '#ffe45c'], ['HOTEL', '#ff4f73'], ['VIDEO', '#3ee6a8'], ['24/7', '#55c8ff']];
    for (let i = 0; i < 6; i++) {
      const x = i * (W / 6) + 40;
      wrap(W, x, 120, (xx) => {
        g.fillStyle = '#1d1640'; g.fillRect(xx - 70, 150, 140, 180);
        g.fillStyle = '#2a2060'; g.fillRect(xx - 70, 150, 36, 180);
        for (let yy = 170; yy < 280; yy += 26) for (let k = -50; k < 60; k += 26) { g.fillStyle = (yy + k) % 3 ? '#0e0a24' : '#ffe9a0'; g.fillRect(xx + k, yy, 16, 16); }
        const [txt, c] = signs[i];
        g.font = `bold 16px ${FONT_DISPLAY}`; g.textAlign = 'center';
        g.shadowColor = c; g.shadowBlur = 14; g.fillStyle = c; g.fillText(txt, xx, 300); g.shadowBlur = 0;
        g.strokeStyle = c; g.lineWidth = 2; g.strokeRect(xx - 60, 283, 120, 26);
      });
    }
  },
  ground(g, W, H) {
    groundBase(g, W, H, 0, ['#15122e', '#1d1840', '#141030']);
    g.strokeStyle = 'rgba(61,255,246,.18)'; g.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = 'rgba(255,61,242,.08)'; for (let i = 0; i < 12; i++) g.fillRect(i * W / 12, 0, 20, H);
    g.fillStyle = '#ffe45c'; for (let x = 0; x < W; x += 60) g.fillRect(x, H * 0.45, 30, 4);
  },
  props: ['crt_snake', 'hitcounter', 'y2kclock', 'phonebooth', 'insertcoin', 'vhs'],
  weather: 'rain', tint: 'rgba(20,0,60,.12)', reflect: true,
};
BIOMES.glitch = {
  music: 'glitch', sky: ['#050510', '#120a2a', '#2a0a3a'], sun: null, clouds: null, stars: true, glitchy: true,
  far(g, W, H) {
    g.strokeStyle = 'rgba(255,61,242,.25)'; g.lineWidth = 1;
    for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x - (x - W / 2) * 0.8, 330); g.stroke(); }
    for (let y = 150; y < 330; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const r = makeRng(111);
    for (let i = 0; i < 20; i++) { const x = r.range(0, W), y = r.range(30, 200), s = r.range(10, 40); g.fillStyle = r.pick(['#ff3df2', '#3dfff6', '#ffe45c', '#1b1030']); g.globalAlpha = 0.5; g.fillRect(x, y, s, s); g.globalAlpha = 1; }
  },
  mid(g, W, H) {
    const r = makeRng(112);
    for (let i = 0; i < 10; i++) {
      const x = r.range(0, W), y = r.range(160, 260), w = r.range(40, 90), h = r.range(30, 70);
      wrap(W, x, 100, (xx) => {
        // missing-texture checkerboard blocks
        for (let a = 0; a < w; a += 10) for (let b = 0; b < h; b += 10) { g.fillStyle = ((a + b) / 10) % 2 ? '#ff00dc' : '#0a0a0a'; g.fillRect(xx + a, y + b, 10, 10); }
      });
    }
    // blue error panel
    wrap(W, W * 0.5, 120, (xx) => {
      g.fillStyle = '#1e3cb4'; g.fillRect(xx - 90, 150, 180, 110);
      g.fillStyle = '#fff'; g.font = `10px ${FONT_PIXEL}`; g.textAlign = 'left';
      ['FATAL EXCEPTION 0x0000001E', 'THE WORLD HAS PERFORMED', 'AN ILLEGAL OPERATION.', '', '* PRESS ANY KEY', '* OR PUNCH HARDER'].forEach((t, i) => g.fillText(t, xx - 82, 172 + i * 14));
    });
  },
  near(g, W, H) {
    const r = makeRng(113);
    for (let i = 0; i < 7; i++) {
      const x = i * (W / 7) + r.range(0, 60);
      wrap(W, x, 70, (xx) => {
        g.fillStyle = '#1b1030'; g.fillRect(xx - 20, 170, 40, 160);
        for (let k = 0; k < 16; k++) { g.fillStyle = r.pick(['#ff3df2', '#3dfff6', '#2a1f5c', '#1b1030']); g.fillRect(xx - 20 + r.int(0, 4) * 10, 170 + k * 10, 10, 10); }
      });
    }
  },
  ground(g, W, H) {
    groundBase(g, W, H, 0, ['#0a0a18', '#120e2a', '#0a0a18']);
    g.strokeStyle = 'rgba(61,255,246,.35)'; g.lineWidth = 1.5;
    for (let x = 0; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const r = makeRng(114);
    for (let i = 0; i < 40; i++) { g.fillStyle = r.pick(['#ff3df2', '#3dfff6']); g.globalAlpha = 0.4; g.fillRect(Math.floor(r.range(0, W) / 48) * 48, Math.floor(r.range(0, H) / 24) * 24, 48, 24); }
    g.globalAlpha = 1;
  },
  props: ['bsod', 'hourglass', 'y2kclock', 'crt_snake', 'dialup'],
  weather: 'pixels', tint: 'rgba(40,0,60,.15)',
};
BIOMES.cow = Object.assign({}, BIOMES.meadow, {
  music: 'cow', sky: ['#ff9fd0', '#ffd0e8', '#fff1f8'], sun: { x: 0.5, y: 80, r: 44, c: '#fff4c2' },
  props: ['cowsign', 'haybale', 'milkcan', 'barrelStack'], weather: 'petals',
});
BIOMES.arena = Object.assign({}, BIOMES.village, {
  music: 'boss', sky: ['#3a1a5a', '#7a3a7a', '#ff9a5a'],
  near(g, W, H) {
    // colosseum arches
    g.fillStyle = '#c9b89a'; g.fillRect(0, 110, W, 220);
    for (let x = 0; x < W; x += 70) { g.fillStyle = '#6b5a4a'; roundRect(g, x + 12, 150, 46, 80, 22); g.fill(); roundRect(g, x + 12, 250, 46, 70, 22); g.fill(); }
    g.fillStyle = '#e8d8b8'; g.fillRect(0, 104, W, 12); g.fillRect(0, 236, W, 8);
    // crowd dots
    const r = makeRng(121);
    for (let i = 0; i < 300; i++) { g.fillStyle = r.pick(['#ff4f73', '#ffc53d', '#55c8ff', '#3ee6a8', '#f2c39b']); g.beginPath(); g.arc(r.range(0, W), r.range(60, 104), 4, 0, TAU); g.fill(); }
  },
  props: ['banner', 'barrelStack', 'torchpost'], weather: 'none',
});

// ---------- props (drawn live in world space; x in world units, at back of ground) ----------
// y is screen-space baseline (just above GROUND_TOP). Each prop can be interactive (tap/hit) later.
function drawProp(g, kind, x, y, T) {
  g.save(); g.translate(x, y);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const O = OUTLINE;
  const txt = (s, xx, yy, size = 10, c = '#1b1030', font = FONT_PIXEL) => { g.fillStyle = c; g.font = `${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, xx, yy); };
  switch (kind) {
    case 'sign_meadow': case 'cowsign': {
      g.fillStyle = '#8a5a2b'; g.fillRect(-3, -50, 6, 50);
      g.fillStyle = '#e8c48a'; g.strokeStyle = O; g.lineWidth = 2.5; roundRect(g, -58, -78, 116, 34, 5); g.fill(); g.stroke();
      if (kind === 'cowsign') { txt('MOO-DOWBROOK', 0, -66, 9); txt('POP. 1 COW KING', 0, -54, 8); }
      else { txt('MEADOWBROOK', 0, -66, 10); txt('POP. 12 (13 WITH YOU)', 0, -54, 7); }
      break;
    }
    case 'floppy': {
      g.save(); g.rotate(-0.3); g.fillStyle = '#2f6bd8'; g.strokeStyle = O; g.lineWidth = 2; g.fillRect(-10, -10, 20, 20); g.strokeRect(-10, -10, 20, 20);
      g.fillStyle = '#c9ccd6'; g.fillRect(-5, -10, 10, 6); g.fillStyle = '#fff'; g.fillRect(-7, 1, 14, 8); g.restore();
      break;
    }
    case 'eggpet': {
      g.fillStyle = '#8a5a2b'; g.fillRect(-18, -14, 36, 14); g.fillStyle = '#a0703a'; g.beginPath(); g.ellipse(0, -14, 18, 5, 0, 0, TAU); g.fill();
      g.fillStyle = '#ff9fd0'; g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -28, 9, 12, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#d8f5c0'; g.fillRect(-5, -34, 10, 8); g.fillStyle = O; const bl = Math.floor(T * 2) % 2; g.fillRect(-3 + bl, -32, 2, 2); g.fillRect(1 + bl, -32, 2, 2);
      g.fillStyle = '#ffc53d'; g.beginPath(); g.arc(-4, -20, 1.5, 0, TAU); g.arc(0, -19, 1.5, 0, TAU); g.arc(4, -20, 1.5, 0, TAU); g.fill();
      break;
    }
    case 'mailbox': {
      g.fillStyle = '#5a3a24'; g.fillRect(-2, -40, 5, 40);
      g.fillStyle = '#2f6bd8'; g.strokeStyle = O; g.lineWidth = 2; roundRect(g, -14, -58, 28, 18, 8); g.fill(); g.stroke();
      g.fillStyle = '#ff4f73'; g.fillRect(12, -64 + (Math.sin(T * 3) > 0 ? 0 : 4), 3, 12);
      if (Math.sin(T * 1.3) > 0.4) { g.fillStyle = '#fff4e2'; roundRect(g, -40, -92, 80, 18, 6); g.fill(); txt("YOU'VE GOT MAIL!", 0, -83, 7); }
      break;
    }
    case 'construction': {
      g.fillStyle = '#1b1030'; g.fillRect(-2, -40, 4, 40);
      g.fillStyle = '#ffc53d'; g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -84); g.lineTo(28, -44); g.lineTo(-28, -44); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = O; g.fillRect(-10, -58, 20, 3); g.beginPath(); g.arc(-4, -66, 3, 0, TAU); g.fill();
      if (Math.floor(T * 3) % 2) { g.fillStyle = '#ff7a2f'; g.beginPath(); g.arc(0, -88, 4, 0, TAU); g.fill(); }
      txt('UNDER CONSTRUCTION', 0, -34, 7, '#fff4e2');
      break;
    }
    case 'barrelStack': {
      for (const [bx, by] of [[-16, 0], [16, 0], [0, -30]]) { g.fillStyle = '#a0703a'; g.strokeStyle = O; g.lineWidth = 2; roundRect(g, bx - 14, by - 30, 28, 30, 6); g.fill(); g.stroke(); g.fillStyle = '#6b4424'; g.fillRect(bx - 14, by - 24, 28, 3); g.fillRect(bx - 14, by - 9, 28, 3); }
      break;
    }
    case 'haybale': case 'milkcan': {
      if (kind === 'haybale') { g.fillStyle = '#e8c45a'; g.strokeStyle = O; g.lineWidth = 2; roundRect(g, -26, -34, 52, 34, 8); g.fill(); g.stroke(); g.strokeStyle = '#c9a23a'; for (let i = -18; i < 26; i += 8) { g.beginPath(); g.moveTo(i, -30); g.lineTo(i, -4); g.stroke(); } }
      else { g.fillStyle = '#c9ccd6'; g.strokeStyle = O; g.lineWidth = 2; roundRect(g, -12, -40, 24, 40, 5); g.fill(); g.stroke(); txt('MILK', 0, -20, 7); }
      break;
    }
    case 'well': {
      g.fillStyle = '#9a8f86'; g.strokeStyle = O; g.lineWidth = 2; roundRect(g, -26, -30, 52, 30, 4); g.fill(); g.stroke();
      g.fillStyle = '#8a5a2b'; g.fillRect(-24, -76, 5, 46); g.fillRect(19, -76, 5, 46);
      g.fillStyle = '#b0502a'; g.beginPath(); g.moveTo(-32, -72); g.lineTo(0, -92); g.lineTo(32, -72); g.fill(); g.stroke();
      break;
    }
    case 'stall': {
      g.fillStyle = '#8a5a2b'; g.fillRect(-44, -60, 5, 60); g.fillRect(39, -60, 5, 60);
      g.fillStyle = '#c9a26b'; g.fillRect(-46, -28, 92, 28);
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#ff4f73' : '#fff4e2'; g.fillRect(-48 + i * 16, -76, 16, 18); }
      ['#ff4f73', '#ffc53d', '#3ee6a8', '#b77cff'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(-30 + i * 20, -32, 7, 0, TAU); g.fill(); });
      break;
    }
    case 'wanted': {
      g.fillStyle = '#f1dfb3'; g.strokeStyle = O; g.lineWidth = 2; g.fillRect(-22, -96, 44, 56); g.strokeRect(-22, -96, 44, 56);
      txt('WANTED', 0, -88, 8); g.fillStyle = '#e8b48a'; g.beginPath(); g.arc(0, -68, 11, 0, TAU); g.fill(); g.fillStyle = '#b0502a'; g.beginPath(); g.ellipse(0, -58, 10, 7, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffc53d'; g.fillRect(-8, -84, 16, 6); txt('10,000¢', 0, -45, 7);
      break;
    }
    case 'cafe': {
      g.fillStyle = '#3a2a7a'; g.strokeStyle = O; g.lineWidth = 2; roundRect(g, -56, -110, 112, 30, 6); g.fill(); g.stroke();
      txt('DIAL-UP CAFÉ', 0, -101, 10, '#3dfff6'); txt('NOW 56K!', 0, -89, 8, '#ffe45c');
      g.fillStyle = '#5a3a24'; g.fillRect(-2, -80, 4, 80);
      break;
    }
    case 'graffiti_base': {
      g.fillStyle = '#b3a89c'; g.fillRect(-60, -90, 120, 90);
      g.save(); g.rotate(-0.06); txt('ALL YOUR BASE', 0, -62, 12, '#ff4f73', FONT_DISPLAY); txt('ARE BELONG TO US', 0, -44, 9, '#2f6bd8', FONT_DISPLAY); g.restore();
      break;
    }
    case 'cake': {
      g.fillStyle = '#2b2b3a'; g.strokeStyle = '#8a5a2b'; g.lineWidth = 4; g.fillRect(-40, -90, 80, 54); g.strokeRect(-40, -90, 80, 54);
      txt('TODAY:', 0, -78, 8, '#fff'); txt('THE CAKE', 0, -64, 9, '#fff', FONT_BODY); txt('IS A LIE', 0, -50, 9, '#fff', FONT_BODY);
      g.fillStyle = '#8a5a2b'; g.fillRect(-30, -36, 4, 36); g.fillRect(26, -36, 4, 36);
      break;
    }
    case 'lamp': {
      g.fillStyle = '#2b2b3a'; g.fillRect(-2, -100, 4, 100); g.fillRect(-10, -104, 20, 6);
      g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(0, -96, 6, 0, TAU); g.fill();
      break;
    }
    case 'vhs': {
      g.fillStyle = '#1b1030'; g.strokeStyle = '#555'; g.lineWidth = 2; g.fillRect(-24, -16, 48, 16); g.strokeRect(-24, -16, 48, 16);
      g.fillStyle = '#fff'; g.fillRect(-18, -13, 36, 6); txt('BE KIND REWIND', 0, -10, 5);
      g.fillStyle = '#555'; g.beginPath(); g.arc(-8, -4, 3, 0, TAU); g.arc(8, -4, 3, 0, TAU); g.fill();
      break;
    }
    case 'cavesign': {
      g.fillStyle = '#1b1030'; g.beginPath(); g.ellipse(0, 0, 44, 60, 0, Math.PI, TAU); g.fill();
      g.fillStyle = '#e8c48a'; g.strokeStyle = O; g.lineWidth = 2; roundRect(g, -64, -96, 128, 26, 4); g.fill(); g.stroke();
      txt("IT'S DANGEROUS TO GO ALONE", 0, -87, 7); txt('TAKE THIS →  ★', 0, -77, 7);
      break;
    }
    case 'duck': {
      g.fillStyle = '#ffe45c'; g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -8, 12, 8, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.arc(8, -18, 7, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#ff8a2b'; g.beginPath(); g.moveTo(14, -18); g.lineTo(20, -16); g.lineTo(14, -14); g.fill(); g.fillStyle = O; g.beginPath(); g.arc(10, -20, 1.5, 0, TAU); g.fill();
      break;
    }
    case 'stump': case 'log': {
      g.fillStyle = '#6b4424'; g.strokeStyle = O; g.lineWidth = 2;
      if (kind === 'stump') { g.fillRect(-18, -24, 36, 24); g.strokeRect(-18, -24, 36, 24); g.fillStyle = '#c98b5e'; g.beginPath(); g.ellipse(0, -24, 18, 6, 0, 0, TAU); g.fill(); g.stroke(); }
      else { roundRect(g, -40, -18, 80, 18, 9); g.fill(); g.stroke(); g.fillStyle = '#c98b5e'; g.beginPath(); g.ellipse(40, -9, 5, 9, 0, 0, TAU); g.fill(); g.stroke(); }
      break;
    }
    case 'mushroomRing': {
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; const mx = Math.cos(a) * 30, my = Math.sin(a) * 8 - 4; g.fillStyle = '#fff1d6'; g.fillRect(mx - 2, my - 6, 4, 6); g.fillStyle = '#e04a5a'; g.beginPath(); g.ellipse(mx, my - 6, 6, 4, 0, Math.PI, TAU); g.fill(); }
      break;
    }
    case 'owl': {
      g.fillStyle = '#6b4424'; g.fillRect(-2, -60, 4, 60); g.fillRect(-20, -62, 40, 4);
      g.fillStyle = '#a0703a'; g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -76, 11, 14, 0, 0, TAU); g.fill(); g.stroke();
      const bl = Math.floor(T * 0.7) % 5 === 0;
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-5, -80, 5, 0, TAU); g.arc(5, -80, 5, 0, TAU); g.fill(); g.fillStyle = O; if (!bl) { g.beginPath(); g.arc(-5, -80, 2.5, 0, TAU); g.arc(5, -80, 2.5, 0, TAU); g.fill(); } else { g.fillRect(-9, -80, 18, 1.5); }
      break;
    }
    case 'glowSign': {
      g.fillStyle = '#5a3a24'; g.fillRect(-2, -54, 4, 54);
      g.fillStyle = '#2a1f5c'; roundRect(g, -40, -80, 80, 28, 4); g.fill();
      g.shadowColor = '#9dff5a'; g.shadowBlur = 10; txt('DO NOT LICK', 0, -66, 9, '#9dff5a'); g.shadowBlur = 0;
      break;
    }
    case 'cauldron': {
      g.fillStyle = '#2b2b3a'; g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -18, 22, 18, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#8dff5a'; g.beginPath(); g.ellipse(0, -32, 18, 5, 0, 0, TAU); g.fill();
      for (let i = 0; i < 3; i++) { const p = (T * 0.8 + i / 3) % 1; g.globalAlpha = 1 - p; g.beginPath(); g.arc(-8 + i * 8, -36 - p * 30, 3 + p * 3, 0, TAU); g.fill(); } g.globalAlpha = 1;
      break;
    }
    case 'crt_desert': case 'crt_snake': {
      if (kind === 'crt_desert') { g.fillStyle = '#e2b06a'; g.beginPath(); g.ellipse(0, 0, 40, 8, 0, 0, TAU); g.fill(); }
      g.fillStyle = '#d9d4c4'; g.strokeStyle = O; g.lineWidth = 2; roundRect(g, -30, -58, 60, 50, 6); g.fill(); g.stroke();
      g.fillStyle = '#0a1a0a'; roundRect(g, -24, -52, 44, 36, 8); g.fill();
      // tiny snake game
      g.fillStyle = '#3dff7a'; const n = 6; const step = Math.floor(T * 6);
      for (let i = 0; i < n; i++) { const k = (step - i + 400) % 40; const px = -20 + (k < 20 ? k : 39 - k) * 1.9, py = -44 + Math.floor(((step - i + 400) % 80) / 40) * 12 + (k % 3); g.fillRect(px, py, 3, 3); }
      g.fillStyle = '#ff4f73'; g.fillRect(8, -30, 3, 3);
      g.fillStyle = 'rgba(61,255,122,.12)'; for (let i = 0; i < 9; i++) g.fillRect(-24, -52 + i * 4, 44, 1);
      break;
    }
    case 'bunker': {
      g.fillStyle = '#9aa3b5'; g.strokeStyle = O; g.lineWidth = 2; roundRect(g, -50, -44, 100, 44, 10); g.fill(); g.stroke();
      g.fillStyle = '#3a4050'; g.fillRect(-12, -32, 24, 32);
      g.fillStyle = '#ffc53d'; g.fillRect(-46, -60, 92, 14); txt('Y2K-PROOF BUNKER', 0, -53, 7);
      break;
    }
    case 'skull': {
      g.fillStyle = '#f2ecdc'; g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.arc(0, -10, 10, 0, TAU); g.fill(); g.stroke(); g.fillRect(-5, -3, 10, 6);
      g.fillStyle = O; g.beginPath(); g.arc(-4, -11, 2.5, 0, TAU); g.arc(4, -11, 2.5, 0, TAU); g.fill();
      break;
    }
    case 'oasis': {
      g.fillStyle = '#3ab0c9'; g.beginPath(); g.ellipse(0, -4, 50, 9, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-20 + Math.sin(T) * 6, -6, 14, 2);
      Paint.palm(g, 30, -4, 0.8);
      break;
    }
    case 'camel': {
      g.fillStyle = '#c99a5b'; g.strokeStyle = O; g.lineWidth = 2;
      for (const lx of [-16, -8, 10, 18]) { g.fillRect(lx, -24, 4, 24); }
      g.beginPath(); g.ellipse(0, -30, 26, 10, 0, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.arc(-8, -38, 8, Math.PI, TAU); g.arc(8, -38, 8, Math.PI, TAU); g.fill();
      g.beginPath(); g.moveTo(22, -32); g.quadraticCurveTo(34, -44, 32, -58); g.lineTo(40, -58); g.lineTo(38, -52); g.lineTo(34, -52); g.quadraticCurveTo(36, -40, 26, -28); g.fill();
      g.fillStyle = '#1b1030'; g.fillRect(32, -56, 7, 2); // sunglasses. obviously.
      break;
    }
    case 'sarcophagus': {
      g.fillStyle = '#ffc53d'; g.strokeStyle = O; g.lineWidth = 2; roundRect(g, -16, -80, 32, 80, 14); g.fill(); g.stroke();
      g.fillStyle = '#2f5bd8'; for (let i = 0; i < 5; i++) g.fillRect(-16, -66 + i * 12, 32, 4);
      g.fillStyle = '#e9dcb8'; g.beginPath(); g.arc(0, -64, 9, 0, TAU); g.fill();
      break;
    }
    case 'urn': {
      g.fillStyle = '#b0502a'; g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, -40); g.quadraticCurveTo(-20, -24, -10, 0); g.lineTo(10, 0); g.quadraticCurveTo(20, -24, 8, -40); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#1b1030'; g.fillRect(-12, -24, 24, 3);
      break;
    }
    case 'treasure': {
      g.fillStyle = '#ffc53d'; for (let i = 0; i < 16; i++) { g.beginPath(); g.ellipse(-30 + (i * 13) % 60, -4 - Math.floor(i / 5) * 5, 7, 3, 0, 0, TAU); g.fill(); }
      g.fillStyle = '#8a5a2b'; g.strokeStyle = O; g.lineWidth = 2; g.fillRect(-16, -26, 32, 20); g.strokeRect(-16, -26, 32, 20);
      break;
    }
    case 'torchpost': {
      g.fillStyle = '#5a3a24'; g.fillRect(-3, -70, 6, 70);
      const fl = Math.sin(T * 17) * 2 + Math.sin(T * 11) * 2;
      g.globalCompositeOperation = 'lighter'; drawGlowLocal(g, 0, -82, 40 + fl * 2, '#ff7a2f'); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#ffd35c'; g.beginPath(); g.moveTo(-7, -72); g.quadraticCurveTo(-6, -90 - fl, 0, -98 - fl); g.quadraticCurveTo(6, -90 - fl, 7, -72); g.fill();
      break;
    }
    case 'snowman_cone': {
      g.fillStyle = '#fff'; g.strokeStyle = O; g.lineWidth = 2; g.beginPath(); g.arc(0, -16, 16, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(0, -42, 12, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#ff8a2b'; g.beginPath(); g.moveTo(-9, -52); g.lineTo(0, -76); g.lineTo(9, -52); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.fillRect(-5, -62, 10, 3);
      g.fillStyle = O; g.beginPath(); g.arc(-4, -44, 1.5, 0, TAU); g.arc(4, -44, 1.5, 0, TAU); g.fill();
      break;
    }
    case 'skisign': {
      g.fillStyle = '#5a3a24'; g.fillRect(-2, -60, 4, 60);
      g.fillStyle = '#ff4f73'; g.strokeStyle = O; g.lineWidth = 2; roundRect(g, -40, -86, 80, 28, 4); g.fill(); g.stroke();
      txt('SKI RENTAL', 0, -76, 9, '#fff'); txt('TOTALLY RAD', 0, -64, 7, '#ffe45c');
      break;
    }
    case 'icecube_pet': {
      g.fillStyle = 'rgba(160,230,255,.7)'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.fillRect(-18, -36, 36, 36); g.strokeRect(-18, -36, 36, 36);
      g.fillStyle = '#ff9fd0'; g.beginPath(); g.ellipse(0, -18, 7, 10, 0, 0, TAU); g.fill(); g.fillStyle = '#d8f5c0'; g.fillRect(-4, -22, 8, 6);
      break;
    }
    case 'igloo': {
      g.fillStyle = '#f4fbff'; g.strokeStyle = '#a9c8ec'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 42, Math.PI, TAU); g.fill(); g.stroke();
      for (let i = 1; i < 4; i++) { g.beginPath(); g.arc(0, 0, 42, Math.PI + i * 0.2, TAU - i * 0.2); g.stroke(); }
      g.fillStyle = '#2a4a8a'; g.beginPath(); g.arc(22, 0, 12, Math.PI, TAU); g.fill();
      break;
    }
    case 'penguin': {
      const w = Math.sin(T * 4) * 0.1;
      g.save(); g.rotate(w);
      g.fillStyle = '#1b1030'; g.beginPath(); g.ellipse(0, -18, 11, 18, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(2, -15, 7, 13, 0, 0, TAU); g.fill();
      g.fillStyle = '#ff8a2b'; g.beginPath(); g.moveTo(8, -28); g.lineTo(14, -26); g.lineTo(8, -24); g.fill();
      g.restore();
      break;
    }
    case 'anvil': {
      g.fillStyle = '#3a3a4a'; g.strokeStyle = O; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-30, -30); g.lineTo(30, -30); g.lineTo(40, -38); g.lineTo(-20, -38); g.closePath(); g.fill(); g.stroke();
      g.fillRect(-12, -30, 24, 20); g.fillRect(-20, -10, 40, 10);
      if (Math.floor(T * 2) % 3 === 0) Particles.add({ x: x + R(-10, 10), y: y - 40, vx: R(-60, 60), vy: R(-120, -60), g: 300, life: 0.4, size: 2, color: '#ffd35c', type: 'sq' });
      break;
    }
    case 'mug': {
      g.fillStyle = '#fff'; g.strokeStyle = O; g.lineWidth = 2; g.fillRect(-10, -22, 20, 22); g.strokeRect(-10, -22, 20, 22);
      g.beginPath(); g.arc(12, -11, 6, -1.4, 1.4); g.stroke(); txt("WORLD'S", 0, -15, 4); txt('BEST BOSS', 0, -9, 4);
      break;
    }
    case 'lavapool': {
      g.fillStyle = '#ff5a1f'; g.beginPath(); g.ellipse(0, -4, 44, 8, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffd35c'; g.beginPath(); g.ellipse(Math.sin(T * 2) * 10, -5, 14, 3, 0, 0, TAU); g.fill();
      break;
    }
    case 'hitcounter': {
      g.fillStyle = '#1b1030'; g.strokeStyle = '#3dfff6'; g.lineWidth = 2; g.fillRect(-46, -110, 92, 30); g.strokeRect(-46, -110, 92, 30);
      txt('VISITORS', 0, -102, 7, '#3dfff6');
      txt(String(451 + Math.floor(T)).padStart(6, '0'), 0, -89, 11, '#ffe45c');
      g.fillStyle = '#5a5a6a'; g.fillRect(-2, -80, 4, 80);
      break;
    }
    case 'y2kclock': {
      g.fillStyle = '#1b1030'; g.strokeStyle = '#ff4f73'; g.lineWidth = 2; g.fillRect(-56, -120, 112, 40); g.strokeRect(-56, -120, 112, 40);
      txt('Y2K COUNTDOWN', 0, -110, 7, '#ff4f73');
      const s = Math.max(0, 59 - Math.floor(T) % 60);
      txt(`23:59:${String(s).padStart(2, '0')}`, 0, -93, 13, '#ff4f73');
      g.fillStyle = '#5a5a6a'; g.fillRect(-2, -80, 4, 80);
      break;
    }
    case 'phonebooth': {
      g.fillStyle = '#d8343f'; g.strokeStyle = O; g.lineWidth = 2; g.fillRect(-18, -110, 36, 110); g.strokeRect(-18, -110, 36, 110);
      g.fillStyle = 'rgba(160,220,255,.5)'; for (let i = 0; i < 4; i++) g.fillRect(-12, -96 + i * 22, 24, 18);
      txt('PHONE', 0, -103, 6, '#fff');
      break;
    }
    case 'insertcoin': {
      g.fillStyle = '#2a2060'; g.strokeStyle = O; g.lineWidth = 2; g.fillRect(-26, -110, 52, 110); g.strokeRect(-26, -110, 52, 110);
      g.fillStyle = '#0a0717'; g.fillRect(-20, -100, 40, 34);
      if (Math.floor(T * 2) % 2) txt('INSERT', 0, -88, 7, '#ffe45c'), txt('COIN', 0, -77, 7, '#ffe45c');
      g.fillStyle = '#ff4f73'; g.beginPath(); g.arc(6, -56, 4, 0, TAU); g.arc(14, -52, 4, 0, TAU); g.fill();
      g.fillStyle = '#ffc53d'; g.fillRect(-4, -34, 8, 10);
      break;
    }
    case 'bsod': {
      g.fillStyle = '#1e3cb4'; g.strokeStyle = '#d9d4c4'; g.lineWidth = 4; g.fillRect(-36, -70, 72, 50); g.strokeRect(-36, -70, 72, 50);
      txt(':(', -20, -58, 12, '#fff', FONT_BODY); txt('YOUR WORLD RAN', 0, -42, 5, '#fff'); txt('INTO A PROBLEM', 0, -34, 5, '#fff');
      g.fillStyle = '#d9d4c4'; g.fillRect(-10, -20, 20, 20);
      break;
    }
    case 'hourglass': {
      g.fillStyle = '#ffc53d'; g.fillRect(-16, -60, 32, 5); g.fillRect(-16, -5, 32, 5);
      g.fillStyle = 'rgba(200,230,255,.5)'; g.beginPath(); g.moveTo(-12, -55); g.lineTo(12, -55); g.lineTo(0, -30); g.lineTo(12, -5); g.lineTo(-12, -5); g.lineTo(0, -30); g.fill();
      const k = (T * 0.2) % 1; g.fillStyle = '#e8c45a'; g.beginPath(); g.moveTo(-12 * (1 - k), -55 + 25 * k); g.lineTo(12 * (1 - k), -55 + 25 * k); g.lineTo(0, -30); g.fill();
      g.beginPath(); g.moveTo(-12, -5); g.lineTo(12, -5); g.lineTo(12 * (1 - k), -5 - 20 * k); g.lineTo(-12 * (1 - k), -5 - 20 * k); g.fill();
      break;
    }
    case 'dialup': {
      g.fillStyle = '#d9d4c4'; g.strokeStyle = O; g.lineWidth = 2; roundRect(g, -30, -16, 60, 16, 4); g.fill(); g.stroke();
      for (let i = 0; i < 5; i++) { g.fillStyle = Math.floor(T * 8 + i) % 3 ? '#3dff7a' : '#1a3a1a'; g.fillRect(-24 + i * 8, -10, 4, 4); }
      txt('56K', 18, -8, 6);
      break;
    }
    case 'banner': {
      g.fillStyle = '#8a2b4a'; g.fillRect(-30, -120, 60, 80); g.beginPath(); g.moveTo(-30, -40); g.lineTo(0, -26); g.lineTo(30, -40); g.fill();
      txt('★', 0, -86, 24, '#ffc53d', FONT_BODY);
      break;
    }
  }
  g.restore();
}

// ---------- the background controller ----------
function createBackground(biomeId, levelSeed, night) {
  const B = BIOMES[biomeId] || BIOMES.meadow;
  const bg = { B, id: biomeId, t: 0, seed: levelSeed, night: !!night, props: [], clouds: [], stars: [] };
  bg.build = () => {
    bg.far = makeTile(1400, 340, (g, W, H) => B.far(g, W, H));
    bg.mid = makeTile(1600, 340, (g, W, H) => B.mid(g, W, H));
    bg.near = makeTile(1800, 340, (g, W, H) => B.near(g, W, H));
    bg.ground = makeTile(1024, VIEW_H - GROUND_TOP + 30, (g, W, H) => B.ground(g, W, H));
  };
  bg.build();
  const r = makeRng(levelSeed);
  for (let i = 0; i < 7; i++) bg.clouds.push({ x: r.range(0, 2400), y: r.range(30, 170), s: r.range(0.6, 1.4), v: r.range(4, 12) });
  for (let i = 0; i < 90; i++) bg.stars.push({ x: r.range(0, 1), y: r.range(0, 260), s: r.range(0.5, 2), p: r.range(0, TAU) });
  bg.placeProps = (stageLen) => {
    bg.props = [];
    const kinds = B.props;
    let x = 200;
    let i = 0;
    while (x < stageLen - 100) {
      bg.props.push({ kind: kinds[i % kinds.length], x, y: GROUND_TOP - 4 });
      x += r.range(260, 520); i++;
    }
  };
  bg.drawSky = (camX, T) => {
    const g = ctx;
    const sky = B.sky;
    const gr = g.createLinearGradient(0, 0, 0, GROUND_TOP);
    gr.addColorStop(0, sky[0]); gr.addColorStop(0.6, sky[1]); gr.addColorStop(1, sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, VIEW_W, GROUND_TOP + 10);
    if (B.stars || bg.night) {
      for (const s of bg.stars) { const a = 0.4 + 0.6 * Math.abs(Math.sin(T * 1.5 + s.p)); g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(((s.x * VIEW_W * 2 - camX * 0.02) % VIEW_W + VIEW_W) % VIEW_W, s.y, s.s, s.s); }
    }
    if (B.sun) {
      const sx = B.sun.x * VIEW_W - camX * 0.01;
      g.globalCompositeOperation = 'lighter'; drawGlow(sx, B.sun.y, B.sun.r * 4, '#ffe9a0', 0.5); g.globalCompositeOperation = 'source-over';
      g.fillStyle = B.sun.c; g.beginPath(); g.arc(sx, B.sun.y, B.sun.r, 0, TAU); g.fill();
    }
    if (B.moon) {
      const mx = B.moon.x * VIEW_W - camX * 0.01;
      g.globalCompositeOperation = 'lighter'; drawGlow(mx, B.moon.y, B.moon.r * 3.5, '#b8c8ff', 0.5); g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#f4f0ff'; g.beginPath(); g.arc(mx, B.moon.y, B.moon.r, 0, TAU); g.fill();
      g.fillStyle = 'rgba(180,170,220,.6)'; g.beginPath(); g.arc(mx - 6, B.moon.y - 4, 5, 0, TAU); g.arc(mx + 7, B.moon.y + 6, 3.5, 0, TAU); g.fill();
    }
    if (biomeId === 'ice' && bg.night || biomeId === 'ice' && B === BIOMES.ice && bg.aurora) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        g.fillStyle = ['rgba(62,230,168,.18)', 'rgba(85,200,255,.14)', 'rgba(183,124,255,.12)'][i];
        g.beginPath(); g.moveTo(0, 80 + i * 20);
        for (let x = 0; x <= VIEW_W; x += 20) g.lineTo(x, 80 + i * 20 + Math.sin(x / 120 + T * 0.6 + i) * 22);
        for (let x = VIEW_W; x >= 0; x -= 20) g.lineTo(x, 140 + i * 20 + Math.sin(x / 90 + T * 0.5 + i) * 18);
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    if (B.clouds) {
      for (const c of bg.clouds) {
        const x = ((c.x + T * c.v - camX * 0.05) % 2400 + 2400) % 2400 - 200;
        if (x < -150 || x > VIEW_W + 50) continue;
        g.globalAlpha = 0.9; Paint.cloud(g, x, c.y, c.s, B.clouds); g.globalAlpha = 1;
      }
    }
    if (B.volcano) {
      // eruption glow
      const vx = ((VIEW_W * 0.5 - camX * 0.1) % 1400 + 1400) % 1400;
      g.globalCompositeOperation = 'lighter'; drawGlow(vx, 110, 120 + Math.sin(T * 3) * 20, '#ff5a1f', 0.6); g.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.3) Particles.add({ x: camX + vx + R(-20, 20), y: 110, vx: R(-80, 80), vy: R(-260, -120), g: 260, life: R(1, 2), size: R(2, 5), color: pick(['#ffd35c', '#ff7a2f']), glow: true });
    }
  };
  const drawTile = (tile, factor, camX, y = 0) => {
    const W = tile.W;
    let ox = -((camX * factor) % W);
    if (ox > 0) ox -= W;
    for (let x = ox; x < VIEW_W; x += W) ctx.drawImage(tile.c, x, y, W, tile.H);
  };
  bg.drawBack = (camX, T) => {
    bg.drawSky(camX, T);
    drawTile(bg.far, 0.12, camX, 0);
    drawTile(bg.mid, 0.3, camX, 0);
    if (B.rays) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x = ((i * 300 - camX * 0.4) % 1500 + 1500) % 1500 - 200;
        ctx.fillStyle = `rgba(255,247,194,${0.05 + 0.03 * Math.sin(T + i)})`;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 60, 0); ctx.lineTo(x + 220, GROUND_TOP); ctx.lineTo(x + 120, GROUND_TOP); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    drawTile(bg.near, 0.6, camX, -12);
    drawTile(bg.ground, 1, camX, GROUND_TOP - 20);
    // depth shading on the floor: darker at the back
    const gr = ctx.createLinearGradient(0, GROUND_TOP - 20, 0, GROUND_TOP + 30);
    gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, GROUND_TOP - 20, VIEW_W, 50);
    if (B.torches) {
      for (let i = 0; i < 6; i++) {
        const x = ((i * 300 + 150 - camX * 0.6) % 1800 + 1800) % 1800 - 100;
        const fl = Math.sin(T * 13 + i) * 3;
        ctx.globalCompositeOperation = 'lighter'; drawGlow(x, 150, 70 + fl * 3, '#ff9a3a', 0.55); ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.moveTo(x - 6, 158); ctx.quadraticCurveTo(x - 5, 140 - fl, x, 132 - fl); ctx.quadraticCurveTo(x + 5, 140 - fl, x + 6, 158); ctx.fill();
        ctx.fillStyle = '#5a3a24'; ctx.fillRect(x - 5, 158, 10, 18);
      }
    }
    // props at the back edge of the floor
    for (const p of bg.props) {
      const sx = p.x - camX;
      if (sx < -150 || sx > VIEW_W + 150) continue;
      drawProp(ctx, p.kind, sx, p.y, T);
    }
  };
  bg.drawFront = (camX, T) => {
    // foreground silhouettes (grass tufts / rocks) with parallax > 1
    const f = 1.25;
    const base = VIEW_H + 4;
    ctx.fillStyle = B === BIOMES.ice ? 'rgba(230,243,255,.9)' : B === BIOMES.volcano ? 'rgba(20,6,6,.9)' : B === BIOMES.neon || B === BIOMES.glitch ? 'rgba(10,8,24,.9)' : B === BIOMES.desert ? 'rgba(200,150,90,.9)' : B === BIOMES.tomb ? 'rgba(60,40,20,.9)' : 'rgba(30,60,30,.85)';
    for (let i = -1; i < 7; i++) {
      const x = ((i * 260 - camX * f) % 1560 + 1560) % 1560 - 200;
      ctx.beginPath(); ctx.moveTo(x - 60, base);
      for (let k = 0; k < 8; k++) ctx.lineTo(x - 50 + k * 14, base - 18 - ((k * 37 + i * 11) % 16) - Math.sin(T * 2 + k + i) * 2);
      ctx.lineTo(x + 70, base); ctx.fill();
    }
    // one combined full-screen grade instead of two separate fills
    if (B.tint || bg.night) { ctx.fillStyle = bg.night && B.tint ? 'rgba(20,6,50,.3)' : bg.night ? 'rgba(10,10,40,.22)' : B.tint; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (B.heat) {
      ctx.globalAlpha = 0.06; ctx.fillStyle = '#fff';
      for (let y = 180; y < 330; y += 8) ctx.fillRect(Math.sin(T * 3 + y) * 6, y, VIEW_W, 2);
      ctx.globalAlpha = 1;
    }
  };
  bg.weather = (camX, dt) => {
    const w = B.weather;
    const rate = { petals: 3, leaves: 5, fireflies: 3, sand: 18, snow: 30, embers: 14, rain: 60, pixels: 10, dust: 4 }[w] || 0;
    let n = rate * dt;
    while (n > 0) {
      if (Math.random() > n) break;
      n -= 1;
      const x = camX + R(-50, VIEW_W + 100);
      if (w === 'petals') Particles.add({ x, y: -10, vx: R(-40, -10), vy: R(20, 40), life: 8, size: 3, color: pick(['#ff9fb8', '#fff', '#ffe45c']), type: 'leaf', vr: R(-3, 3), drag: 1, shrink: false });
      else if (w === 'leaves') Particles.add({ x, y: R(-10, 60), vx: R(-50, -10), vy: R(20, 50), life: 7, size: 4, color: pick(['#d8a04a', '#8a5a2b', '#c9401a', '#6fae4a']), type: 'leaf', vr: R(-4, 4), drag: 1, shrink: false });
      else if (w === 'fireflies') Particles.add({ x, y: R(150, 480), vx: R(-15, 15), vy: R(-15, 15), life: R(2, 4), size: 3, color: pick(['#fff4a0', '#9dff5a', '#b8a0ff']), glow: true, drag: 1 });
      else if (w === 'sand') Particles.add({ x: camX + VIEW_W + 20, y: R(150, 520), vx: R(-420, -260), vy: R(-10, 20), life: 3, size: 1.5, color: '#fff1c2', type: 'line', drag: 1 });
      else if (w === 'snow') Particles.add({ x, y: -10, vx: R(-30, 10), vy: R(40, 90), life: 9, size: R(1.5, 3.5), color: '#ffffff', drag: 1, shrink: false });
      else if (w === 'embers') Particles.add({ x, y: VIEW_H + 10, vx: R(-20, 20), vy: R(-120, -50), life: R(3, 5), size: R(1.5, 3), color: pick(['#ffd35c', '#ff7a2f']), glow: true, drag: 1 });
      else if (w === 'rain') Particles.add({ x: x + 100, y: -10, vx: -120, vy: 900, life: 0.7, size: 2, color: 'rgba(160,200,255,.6)', type: 'line', drag: 1 });
      else if (w === 'pixels') Particles.add({ x, y: R(0, VIEW_H), vx: 0, vy: R(-30, 30), life: R(0.3, 1.2), size: R(3, 8), color: pick(['#ff3df2', '#3dfff6', '#ffffff']), type: 'pix', drag: 1, shrink: false });
      else if (w === 'dust') Particles.add({ x, y: R(100, 500), vx: R(-10, 10), vy: R(-5, 5), life: R(3, 6), size: R(1, 2), color: 'rgba(255,220,160,.5)', drag: 1 });
    }
  };
  return bg;
}
