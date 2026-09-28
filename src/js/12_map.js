// ============================================================
//  World map of Rumblevale: procedural parchment continent,
//  level nodes, pan/zoom, hero token, secrets.
// ============================================================
const MAP_W = 2000, MAP_H = 1250;
const REGIONS = [
  { name: 'Pixel Meadows', x: 330, y: 880, r: 330, c: '#9bd46a', c2: '#7fc35a' },
  { name: 'Whisperwood', x: 520, y: 600, r: 230, c: '#4f9a4a', c2: '#3f8a3a' },
  { name: 'Mushroom Hollow', x: 330, y: 380, r: 220, c: '#a58ad8', c2: '#8a6cc9' },
  { name: 'Sunscorch Dunes', x: 830, y: 360, r: 290, c: '#f0cf85', c2: '#e3b86a' },
  { name: 'Frostfang Peaks', x: 1300, y: 200, r: 300, c: '#eef6ff', c2: '#cfe3f7' },
  { name: 'Emberforge', x: 1660, y: 460, r: 250, c: '#b8604a', c2: '#8a3a2a' },
  { name: 'Neon Undercity', x: 1500, y: 800, r: 220, c: '#6a5ab8', c2: '#4a3a98' },
  { name: 'Glitch Wastes', x: 1780, y: 1010, r: 200, c: '#3a2a5a', c2: '#2a1a4a' },
];
const WorldMap = {
  cv: null, g: null, img: null, open_: false, raf: 0,
  cam: { x: MAP_W / 2, y: MAP_H / 2, z: 0.6 }, target: null,
  sel: null, token: { x: 0, y: 0, tx: 0, ty: 0, t: 1 }, t: 0,
  cowClicks: 0,
  init() {
    this.cv = $('mapCanvas');
    this.g = this.cv.getContext('2d');
    const pointers = new Map();
    let down = null, pinch0 = null;
    this.cv.addEventListener('pointerdown', (e) => {
      Sfx.init();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { this.cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (pointers.size === 1) down = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y, moved: false };
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.cam.z }; down = null; }
    });
    this.cv.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch0 && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        this.cam.z = clamp(pinch0.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch0.d, this.minZ(), 2.2);
        this.target = null;
      } else if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true;
        if (down.moved) { this.cam.x = down.cx - dx / this.cam.z; this.cam.y = down.cy - dy / this.cam.z; this.target = null; this.clampCam(); }
      }
    });
    const up = (e) => {
      if (down && !down.moved && pointers.size === 1) this.click(e.clientX, e.clientY);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch0 = null;
      if (pointers.size === 0) down = null;
    };
    this.cv.addEventListener('pointerup', up);
    this.cv.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); down = null; pinch0 = null; });
    this.cv.addEventListener('wheel', (e) => { e.preventDefault(); this.cam.z = clamp(this.cam.z * (e.deltaY < 0 ? 1.1 : 0.9), this.minZ(), 2.2); this.target = null; this.clampCam(); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (!this.open_ || UI.current !== 'scrMap') return;
      if (e.code === 'Enter' || e.code === 'KeyJ') { const b = $('mapGo'); if (b) b.click(); }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        const nodes = this.nodes().filter((n) => n.avail);
        let i = nodes.findIndex((n) => n.id === this.sel);
        i = (i + (e.code === 'ArrowLeft' || e.code === 'ArrowUp' ? -1 : 1) + nodes.length) % nodes.length;
        this.select(nodes[i].id, true);
      }
    });
  },
  minZ() { const r = this.cv.getBoundingClientRect(); return Math.max(r.width / MAP_W, r.height / MAP_H) * 0.98; },
  clampCam() {
    const r = this.cv.getBoundingClientRect();
    const hw = r.width / 2 / this.cam.z, hh = r.height / 2 / this.cam.z;
    this.cam.x = clamp(this.cam.x, Math.min(hw, MAP_W / 2), Math.max(MAP_W - hw, MAP_W / 2));
    this.cam.y = clamp(this.cam.y, Math.min(hh, MAP_H / 2), Math.max(MAP_H - hh, MAP_H / 2));
  },
  nodes() {
    const out = [];
    for (const l of LEVELS) out.push({ id: l.id, x: l.x, y: l.y, lvl: l, avail: levelAvailable(l.id), cleared: !!SAVE.cleared[l.id], stars: SAVE.stars[l.id] || 0 });
    for (const s of SIDE) {
      if (s.secret && !SAVE.secrets.cow) continue;
      if (s.kind === 'typing' && !SAVE.secrets.typing) continue;
      out.push({ id: s.id, x: s.x, y: s.y, side: s, avail: !s.req || !!SAVE.cleared[s.req] });
    }
    return out;
  },
  open() {
    if (this.open_) { this.updateTop(); return; }
    this.open_ = true;
    this.resize();
    if (!this.img) this.render();
    const cur = this.nodes().find((n) => n.id === SAVE.mapPos) || this.nodes()[0];
    this.token.x = this.token.tx = cur.x; this.token.y = this.token.ty = cur.y; this.token.t = 1;
    this.cam.z = Math.max(this.minZ(), Math.min(1.0, this.cv.getBoundingClientRect().width / 900));
    this.cam.x = cur.x; this.cam.y = cur.y; this.clampCam();
    this.select(this.bestNode(), false);
    this.updateTop();
    Sfx.playMusic('map');
    const loop = (now) => { if (!this.open_) return; this.frame(now); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  },
  bestNode() {
    // the next unfinished level, else the current position
    const next = LEVELS.find((l) => levelAvailable(l.id) && !SAVE.cleared[l.id]);
    return next ? next.id : SAVE.mapPos;
  },
  close() { this.open_ = false; cancelAnimationFrame(this.raf); },
  resize() {
    if (!this.cv) return;
    const r = this.cv.getBoundingClientRect();
    const d = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.max(1, Math.round(r.width * d)); this.cv.height = Math.max(1, Math.round(r.height * d));
    this.dpr = d;
  },
  updateTop() {
    $('mapQ').textContent = fmt(SAVE.quarters);
    $('mapS').textContent = Object.values(SAVE.stars).reduce((a, b) => a + b, 0) + '/' + LEVELS.length * 3;
  },
  toScreen(x, y) { const r = this.cv.getBoundingClientRect(); return [(x - this.cam.x) * this.cam.z + r.width / 2, (y - this.cam.y) * this.cam.z + r.height / 2]; },
  toMap(sx, sy) { const r = this.cv.getBoundingClientRect(); return [(sx - r.left - r.width / 2) / this.cam.z + this.cam.x, (sy - r.top - r.height / 2) / this.cam.z + this.cam.y]; },
  click(cx, cy) {
    const [mx, my] = this.toMap(cx, cy);
    // secrets first
    if (Math.hypot(mx - 175, my - 1045) < 30) {
      this.cowClicks++; Sfx.play('moo');
      if (this.cowClicks >= 10 && !SAVE.secrets.cow) { SAVE.secrets.cow = true; persist(); unlockAch('cow', true); toast('Moo.', 'A secret location has appeared…', '🐄'); this.render(); }
      else if (!SAVE.secrets.cow) toast('Moo?', `${10 - this.cowClicks} more…`, '🐄');
      return;
    }
    if (Math.hypot(mx - 1010, my - 180) < 40) { unlockAch('ufo', true); toast('The truth is out there', 'A crashed saucer. Someone left a floppy inside.', '🛸'); Sfx.play('dialup'); return; }
    let best = null, bd = 44 / Math.min(1, this.cam.z);
    for (const n of this.nodes()) { const d = Math.hypot(n.x - mx, n.y - my); if (d < bd) { bd = d; best = n; } }
    if (best) { Sfx.play('select'); this.select(best.id, true); }
  },
  select(id, walk) {
    const n = this.nodes().find((q) => q.id === id);
    if (!n) return;
    this.sel = id;
    if (walk && n.avail) {
      this.token.sx = this.token.x; this.token.sy = this.token.y; this.token.tx = n.x; this.token.ty = n.y; this.token.t = 0;
      SAVE.mapPos = id; persist();
    }
    this.target = { x: n.x, y: n.y };
    this.panel(n);
  },
  panel(n) {
    const p = $('mapPanel');
    p.innerHTML = '';
    p.hidden = false;
    if (n.side) {
      const s = n.side;
      p.append(h('div', { class: 'eyebrow' }, s.kind === 'typing' ? 'Special mode' : s.kind === 'endless' ? 'Arena' : 'Secret'), h('h2', null, s.name), h('p', null, s.blurb));
      if (s.kind === 'endless') p.append(h('div', { class: 'meta-row' }, `Best wave: ${SAVE.endlessBest || 0}`));
      if (s.kind === 'gauntlet') p.append(h('div', { class: 'meta-row' }, `Best: ${SAVE.gauntletBest || 0}/5 battles`));
      if (!n.avail) { p.append(h('div', { class: 'meta-row' }, `Clear ${LEVEL_BY_ID[s.req].name} to unlock`)); return; }
      const go = h('button', { class: 'btn gold', id: 'mapGo', style: 'width:100%;margin-top:10px', onclick: () => {
        Sfx.play('card');
        if (s.kind === 'typing') Typing.menu();
        else if (s.kind === 'endless') UI.heroes((hero) => Game.startEndless(hero), 'Enter the Colosseum');
        else if (s.kind === 'cow') UI.heroes((hero) => Game.startLevel(COW_LEVEL, hero), 'Moo.');
        else if (s.kind === 'gauntlet') UI.heroes((hero) => Game.startGauntlet(hero), 'Who runs the Gauntlet?');
      } }, s.kind === 'typing' ? 'Enter the Dojo' : s.kind === 'endless' ? 'Fight!' : s.kind === 'gauntlet' ? 'Enter the Gauntlet' : 'Moo!');
      p.append(go);
      return;
    }
    const l = n.lvl;
    const boss = BOSSES[l.end];
    p.append(h('div', { class: 'eyebrow' }, `Level ${l.n} · ${REGION_OF[l.biome] || l.biome}`));
    p.append(h('h2', null, l.name));
    const sk = h('div', { class: 'skulls', 'aria-label': 'Difficulty' });
    const dots = Math.min(6, Math.ceil(l.n / 2));
    for (let i = 0; i < 6; i++) sk.append(h('i', { class: 'skull' + (i < dots ? ' on' : '') }));
    const stars = h('span', { class: 'row', style: 'gap:2px' });
    for (let i = 0; i < 3; i++) stars.append(h('i', { class: 'star-i', style: i < (SAVE.stars[l.id] || 0) ? '' : 'background:#5b4f86' }));
    p.append(h('div', { class: 'meta-row' }, sk, stars, boss.elite ? `Elite: ${boss.name}` : `BOSS: ${boss.name}`));
    p.append(h('p', null, l.blurb));
    const heroUnlock = Object.values(HEROES).find((hh) => hh.unlock && hh.unlock.level === l.id);
    if (heroUnlock && !SAVE.heroes[heroUnlock.id]) p.append(h('div', { class: 'meta-row', style: 'color:var(--gold)' }, `Clear to unlock hero: ${heroUnlock.name}`));
    if (!n.avail) { p.append(h('div', { class: 'meta-row' }, 'Locked · clear the previous level first')); return; }
    p.append(h('button', { class: 'btn gold', id: 'mapGo', style: 'width:100%', onclick: () => { Sfx.play('card'); UI.heroes((hero) => Game.startLevel(l, hero)); } }, n.cleared ? 'Replay' : 'Fight!'));
  },
  frame(now) {
    const g = this.g;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now; this.t += dt;
    if (this.target) {
      this.cam.x = lerp(this.cam.x, this.target.x, Math.min(1, dt * 3));
      this.cam.y = lerp(this.cam.y, this.target.y, Math.min(1, dt * 3));
      this.clampCam();
    }
    if (this.token.t < 1) {
      this.token.t = Math.min(1, this.token.t + dt * 1.6);
      const k = ease.inOut(this.token.t);
      this.token.x = lerp(this.token.sx, this.token.tx, k); this.token.y = lerp(this.token.sy, this.token.ty, k) - Math.sin(k * Math.PI) * 30;
      if (Math.random() < dt * 20) Sfx.play('step');
    }
    const r = this.cv.getBoundingClientRect();
    const d = this.dpr;
    if (Math.round(r.width * d) !== this.cv.width || Math.round(r.height * d) !== this.cv.height) this.resize();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#6fa6c4'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.setTransform(d * this.cam.z, 0, 0, d * this.cam.z, d * (r.width / 2 - this.cam.x * this.cam.z), d * (r.height / 2 - this.cam.y * this.cam.z));
    g.drawImage(this.img, 0, 0, MAP_W, MAP_H);
    this.drawLive(g);
  },
  drawLive(g) {
    const T = this.t;
    // animated sea waves
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
    for (const [wx, wy] of MAP_WAVES) { const o = Math.sin(T * 1.5 + wx) * 4; g.beginPath(); g.moveTo(wx - 12 + o, wy); g.quadraticCurveTo(wx - 6 + o, wy - 6, wx + o, wy); g.quadraticCurveTo(wx + 6 + o, wy - 6, wx + 12 + o, wy); g.stroke(); }
    // sea serpent
    const sx = 1000 + Math.sin(T * 0.2) * 120, sy = 1140;
    g.fillStyle = '#3ab09a'; g.strokeStyle = OUTLINE; g.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) { const y = sy + Math.sin(T * 2 + i) * 3; g.beginPath(); g.arc(sx + i * 26, y, 11 - i, Math.PI, TAU); g.fill(); g.stroke(); }
    g.beginPath(); g.ellipse(sx - 18, sy - 12 + Math.sin(T * 2) * 3, 12, 9, -0.3, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(sx - 22, sy - 16 + Math.sin(T * 2) * 3, 3, 0, TAU); g.fill();
    // ship
    const bx = 120 + ((T * 12) % 260), by = 200 + Math.sin(T) * 3;
    g.fillStyle = '#8a5a2b'; g.beginPath(); g.moveTo(bx - 22, by); g.lineTo(bx + 22, by); g.lineTo(bx + 14, by + 10); g.lineTo(bx - 14, by + 10); g.fill(); g.stroke();
    g.fillStyle = '#fff4e2'; g.beginPath(); g.moveTo(bx, by - 32); g.lineTo(bx + 16, by - 6); g.lineTo(bx, by - 6); g.fill(); g.stroke();
    // volcano smoke
    for (let i = 0; i < 5; i++) { const k = ((T * 0.3 + i / 5) % 1); g.fillStyle = `rgba(90,70,70,${0.45 * (1 - k)})`; g.beginPath(); g.arc(1720 + Math.sin(k * 6 + i) * 12, 330 - k * 110, 10 + k * 22, 0, TAU); g.fill(); }
    // glitch sparkle
    for (let i = 0; i < 8; i++) { if (Math.random() < 0.5) { g.fillStyle = pick(['#ff3df2', '#3dfff6', '#ffffff']); g.fillRect(1680 + Math.random() * 220, 920 + Math.random() * 170, 8, 8); } }
    // neon twinkle
    for (let i = 0; i < 6; i++) { const on = Math.sin(T * 3 + i * 2) > 0; g.fillStyle = on ? pick(['#ff3df2', '#3dfff6', '#ffe45c']) : 'rgba(0,0,0,0)'; g.fillRect(1440 + i * 22, 720 + (i % 3) * 18, 5, 5); }
    // cow easter egg (bobs)
    const cb = Math.sin(T * 3) > 0.95 ? -3 : 0;
    g.fillStyle = '#fff'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
    g.fillRect(165, 1040 + cb, 22, 12); g.strokeRect(165, 1040 + cb, 22, 12);
    g.fillStyle = OUTLINE; g.fillRect(170, 1042 + cb, 6, 4); g.fillRect(183, 1036 + cb, 8, 8);
    g.fillRect(167, 1052, 3, 6); g.fillRect(182, 1052, 3, 6);
    // paths between nodes
    const nodes = this.nodes();
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    g.setLineDash([10, 9]); g.lineCap = 'round';
    for (const n of nodes) {
      const nexts = n.lvl ? n.lvl.next : [];
      for (const id of nexts) {
        const m = byId[id]; if (!m) continue;
        g.strokeStyle = n.cleared ? '#7a3a14' : 'rgba(90,50,20,.35)'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(n.x, n.y); g.quadraticCurveTo((n.x + m.x) / 2 + (m.y - n.y) * 0.15, (n.y + m.y) / 2 - (m.x - n.x) * 0.15, m.x, m.y); g.stroke();
      }
    }
    // side routes
    const dojo = byId.DOJO, l1 = byId.L1;
    if (dojo && l1) { g.strokeStyle = 'rgba(90,50,20,.45)'; g.lineWidth = 4; g.beginPath(); g.moveTo(l1.x, l1.y); g.lineTo(dojo.x, dojo.y); g.stroke(); }
    if (byId.EC && byId.L3) { g.strokeStyle = 'rgba(90,50,20,.45)'; g.beginPath(); g.moveTo(byId.L3.x, byId.L3.y); g.lineTo(byId.EC.x, byId.EC.y); g.stroke(); }
    if (byId.GAUNT && byId.L4) { g.strokeStyle = 'rgba(90,50,20,.45)'; g.beginPath(); g.moveTo(byId.EC.x, byId.EC.y); g.lineTo(byId.GAUNT.x, byId.GAUNT.y); g.stroke(); }
    if (byId.COW && l1) { g.strokeStyle = 'rgba(255,120,190,.6)'; g.beginPath(); g.moveTo(175, 1045); g.lineTo(byId.COW.x, byId.COW.y); g.stroke(); }
    g.setLineDash([]);
    // nodes
    for (const n of nodes) drawMapNode(g, n, T, n.id === this.sel);
    // hero token
    const hd = HEROES[SAVE.hero] || HEROES.rook;
    const look = Object.assign({}, hd.look, { _t: T, _blink: T % 3 < 0.1 });
    const wt = WEAPON_TYPES[hd.weapon]; look.wpnColor = wt.colors[0]; look.wpnTier = 1; if (hd.weapon === 'gauntlets') look.gloves = wt.colors[0];
    const walking = this.token.t < 1;
    const pose = computePose({ anim: walking ? 'walk' : 'idle', animT: T, clock: T, walkPhase: T * 12, id: 1 });
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(this.token.tx, this.token.ty - 18, 16, 5, 0, 0, TAU); g.fill();
    drawHumanoid(g, this.token.x, this.token.y - 20, 0.42, walking && this.token.tx < this.token.sx ? -1 : 1, look, pose, {});
  },
  render() {
    // pre-render the static parchment map
    const s = Math.min(1.5, Math.max(1, (window.devicePixelRatio || 1) * 0.75));
    const c = document.createElement('canvas');
    c.width = MAP_W * s; c.height = MAP_H * s;
    const g = c.getContext('2d');
    g.scale(s, s);
    g.lineJoin = 'round'; g.lineCap = 'round';
    paintMap(g);
    this.img = c;
  },
};
const REGION_OF = { meadow: 'Pixel Meadows', village: 'Pixel Meadows', forest: 'Whisperwood', mushroom: 'Mushroom Hollow', desert: 'Sunscorch Dunes', tomb: 'Sunscorch Dunes', ice: 'Frostfang Peaks', volcano: 'Emberforge', neon: 'Neon Undercity', glitch: 'Glitch Wastes', cow: '???' };
const COW_LEVEL = { id: 'COW', n: 7, name: 'The Cow Level', biome: 'cow', pool: [['cow', 1]], end: 'cowking', sections: 3, blurb: 'There is no cow level.' };
const MAP_WAVES = [];
{ const r = makeRng(77); for (let i = 0; i < 70; i++) { const x = r.range(20, MAP_W - 20), y = r.range(20, MAP_H - 20); MAP_WAVES.push([x, y]); } }
function levelAvailable(id) {
  if (id === 'L1') return true;
  if (Game.cheats.unlockAll) return true;
  return LEVELS.some((l) => SAVE.cleared[l.id] && l.next.includes(id));
}
function landShape(x, y) {
  // signed "inside" value for the continent: union of blobs plus noise
  const blobs = [[330, 880, 330], [520, 600, 260], [330, 380, 240], [830, 380, 300], [1300, 230, 320], [1660, 470, 270], [1500, 800, 260], [1780, 1000, 220], [1000, 600, 300], [1150, 820, 230], [700, 900, 230]];
  let v = 0;
  for (const [bx, by, br] of blobs) { const d = Math.hypot(x - bx, y - by) / br; v += Math.max(0, 1 - d * d); }
  return v + (MAP_NOISE(x * 0.01) + MAP_NOISE(y * 0.013 + 50) - 1) * 0.35;
}
const MAP_NOISE = noise1(4242);
function paintMap(g) {
  // sea
  const sea = g.createLinearGradient(0, 0, 0, MAP_H);
  sea.addColorStop(0, '#8cc6df'); sea.addColorStop(1, '#6fa6c4');
  g.fillStyle = sea; g.fillRect(0, 0, MAP_W, MAP_H);
  // land mask via marching grid
  const step = 10;
  const land = document.createElement('canvas'); land.width = MAP_W; land.height = MAP_H;
  const lg = land.getContext('2d');
  lg.fillStyle = '#fff';
  for (let y = 0; y < MAP_H; y += step) for (let x = 0; x < MAP_W; x += step) if (landShape(x, y) > 0.35) { lg.beginPath(); lg.arc(x, y, step * 0.95, 0, TAU); lg.fill(); }
  // shallow water glow around coast
  g.save(); g.filter = 'blur(10px)'; g.globalAlpha = 0.6; g.drawImage(land, -6, -6, MAP_W + 12, MAP_H + 12); g.restore();
  g.filter = 'none';
  // coast outline (draw land offset dark)
  const tint = (color) => { const c = document.createElement('canvas'); c.width = MAP_W; c.height = MAP_H; const cg = c.getContext('2d'); cg.drawImage(land, 0, 0); cg.globalCompositeOperation = 'source-in'; cg.fillStyle = color; cg.fillRect(0, 0, MAP_W, MAP_H); return c; };
  const darkLand = tint('#5a3a1a');
  for (const [ox, oy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) g.drawImage(darkLand, ox, oy);
  // region colours clipped to land
  const regionC = document.createElement('canvas'); regionC.width = MAP_W; regionC.height = MAP_H;
  const rg = regionC.getContext('2d');
  rg.fillStyle = '#e8d49a'; rg.fillRect(0, 0, MAP_W, MAP_H);
  for (const R0 of REGIONS) {
    const gr = rg.createRadialGradient(R0.x, R0.y, 0, R0.x, R0.y, R0.r * 1.3);
    gr.addColorStop(0, R0.c); gr.addColorStop(0.7, R0.c2); gr.addColorStop(1, R0.c2 + '00');
    rg.fillStyle = gr; rg.beginPath(); rg.arc(R0.x, R0.y, R0.r * 1.3, 0, TAU); rg.fill();
  }
  rg.globalCompositeOperation = 'destination-in'; rg.drawImage(land, 0, 0);
  g.drawImage(regionC, 0, 0);
  // parchment texture
  const r = makeRng(99);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(90,60,20,${r.range(0.02, 0.06)})`; g.beginPath(); g.arc(r.range(0, MAP_W), r.range(0, MAP_H), r.range(2, 18), 0, TAU); g.fill(); }
  const inLand = (x, y) => landShape(x, y) > 0.45;
  const regionAt = (x, y) => { let best = null, bd = 1e9; for (const R0 of REGIONS) { const d = Math.hypot(x - R0.x, y - R0.y) / R0.r; if (d < bd) { bd = d; best = R0; } } return best; };
  // scatter details by region
  for (let i = 0; i < 1700; i++) {
    const x = r.range(40, MAP_W - 40), y = r.range(40, MAP_H - 40);
    if (!inLand(x, y)) continue;
    const reg = regionAt(x, y);
    if (Math.hypot(x - reg.x, y - reg.y) > reg.r * 1.05) { if (r() < 0.25) { g.fillStyle = 'rgba(90,70,30,.25)'; g.fillRect(x, y, 2, 5); } continue; }
    if (LEVELS.some((l) => Math.hypot(l.x - x, l.y - y) < 55)) continue;
    switch (reg.name) {
      case 'Pixel Meadows': if (r() < 0.4) mapTree(g, x, y, 0.7, '#4f9a4a'); else if (r() < 0.08) mapHouse(g, x, y); else { g.fillStyle = 'rgba(60,120,40,.35)'; g.fillRect(x, y, 3, 6); } break;
      case 'Whisperwood': mapTree(g, x, y, r.range(0.8, 1.1), r() < 0.5 ? '#2f7a3a' : '#3f8a3a'); break;
      case 'Mushroom Hollow': if (r() < 0.5) mapShroom(g, x, y, r.pick(['#e04a5a', '#7a5cff', '#ff8a2b'])); else mapTree(g, x, y, 0.8, '#6a4aa8'); break;
      case 'Sunscorch Dunes': if (r() < 0.6) { g.strokeStyle = 'rgba(150,100,40,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y + 8, 12, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); } else if (r() < 0.2) mapCactus(g, x, y); break;
      case 'Frostfang Peaks': if (r() < 0.55) mapMountain(g, x, y, r.range(26, 44), '#b8cfe8', '#fff'); else mapPine(g, x, y); break;
      case 'Emberforge': if (r() < 0.5) mapMountain(g, x, y, r.range(24, 40), '#6a3a2a', '#ff7a2f'); else { g.fillStyle = 'rgba(40,10,10,.4)'; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); } break;
      case 'Neon Undercity': if (r() < 0.5) { g.fillStyle = '#2a1f5c'; g.fillRect(x - 5, y - r.range(10, 26), 10, r.range(10, 26)); g.fillStyle = r.pick(['#ff3df2', '#3dfff6', '#ffe45c']); g.fillRect(x - 2, y - 8, 3, 3); } break;
      case 'Glitch Wastes': g.fillStyle = r.pick(['#ff3df2', '#3dfff6', '#1b1030', '#ff00dc']); g.globalAlpha = 0.6; g.fillRect(Math.floor(x / 12) * 12, Math.floor(y / 12) * 12, 12, 12); g.globalAlpha = 1; break;
    }
  }
  // landmarks
  mapCastle(g, 470, 760);
  mapVolcano(g, 1720, 400);
  for (let i = 0; i < 3; i++) mapPyramid(g, 900 + i * 60, 440 - i * 12, 50 - i * 8);
  // river
  g.strokeStyle = '#6fa6c4'; g.lineWidth = 7; g.beginPath(); g.moveTo(1290, 330); g.bezierCurveTo(1200, 500, 1100, 560, 1050, 700); g.bezierCurveTo(1000, 820, 1020, 980, 960, 1140); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 2; g.stroke();
  // UFO crash site
  g.save(); g.translate(1010, 180); g.rotate(-0.4);
  g.fillStyle = '#9aa3b5'; g.strokeStyle = OUTLINE; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, 0, 28, 9, 0, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = 'rgba(120,230,255,.8)'; g.beginPath(); g.ellipse(0, -6, 12, 9, 0, Math.PI, TAU); g.fill(); g.stroke();
  g.restore();
  g.fillStyle = 'rgba(90,60,20,.35)'; g.beginPath(); g.ellipse(1000, 196, 40, 8, 0, 0, TAU); g.fill();
  // region labels
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const R0 of REGIONS) {
    g.font = `22px ${FONT_DISPLAY}`;
    g.lineWidth = 6; g.strokeStyle = 'rgba(241,223,179,.85)'; g.strokeText(R0.name.toUpperCase(), R0.x, R0.y - R0.r * 0.55);
    g.fillStyle = R0.name === 'Glitch Wastes' ? '#ff3df2' : '#4b3216'; g.fillText(R0.name.toUpperCase(), R0.x, R0.y - R0.r * 0.55);
  }
  g.font = `italic 18px ${FONT_BODY}`; g.fillStyle = 'rgba(75,50,22,.8)'; g.fillText('here be dragons', 1830, 250);
  g.fillText('x marks the spot', 700, 1180);
  g.strokeStyle = '#b0302a'; g.lineWidth = 4; g.beginPath(); g.moveTo(690, 1150); g.lineTo(710, 1170); g.moveTo(710, 1150); g.lineTo(690, 1170); g.stroke();
  // compass rose
  g.save(); g.translate(1870, 1130);
  g.fillStyle = 'rgba(241,223,179,.85)'; g.beginPath(); g.arc(0, 0, 58, 0, TAU); g.fill();
  g.strokeStyle = '#4b3216'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.stroke();
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillStyle = i % 2 ? '#4b3216' : '#b0302a'; g.beginPath(); g.moveTo(0, -46); g.lineTo(9, 0); g.lineTo(-9, 0); g.fill(); }
  g.fillStyle = '#4b3216'; g.font = `16px ${FONT_DISPLAY}`; g.fillText('N', 0, -64 + 8);
  g.restore();
  // title cartouche
  g.fillStyle = 'rgba(241,223,179,.9)'; g.strokeStyle = '#4b3216'; g.lineWidth = 3;
  roundRect(g, 1560, 40, 400, 90, 16); g.fill(); g.stroke();
  g.fillStyle = '#4b3216'; g.font = `38px ${FONT_DISPLAY}`; g.fillText('RUMBLEVALE', 1760, 80);
  g.font = `14px ${FONT_BODY}`; g.fillText('A map of the known brawling world · est. 1999', 1760, 112);
  // frame
  g.strokeStyle = '#4b3216'; g.lineWidth = 10; g.strokeRect(5, 5, MAP_W - 10, MAP_H - 10);
  g.strokeStyle = '#c9a26b'; g.lineWidth = 3; g.strokeRect(16, 16, MAP_W - 32, MAP_H - 32);
}
function mapTree(g, x, y, s, c) { g.fillStyle = '#5a3a24'; g.fillRect(x - 1.5 * s, y, 3 * s, 7 * s); g.fillStyle = c; g.beginPath(); g.arc(x, y - 2 * s, 8 * s, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(x - 3 * s, y - 5 * s, 3 * s, 0, TAU); g.fill(); }
function mapPine(g, x, y) { g.fillStyle = '#2f6a5a'; g.beginPath(); g.moveTo(x - 7, y + 4); g.lineTo(x, y - 14); g.lineTo(x + 7, y + 4); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 3, y - 6); g.lineTo(x, y - 14); g.lineTo(x + 3, y - 6); g.fill(); }
function mapShroom(g, x, y, c) { g.fillStyle = '#fff1d6'; g.fillRect(x - 2, y - 4, 4, 8); g.fillStyle = c; g.beginPath(); g.ellipse(x, y - 4, 8, 6, 0, Math.PI, TAU); g.fill(); }
function mapCactus(g, x, y) { g.fillStyle = '#4aa84a'; g.fillRect(x - 2, y - 12, 4, 14); g.fillRect(x - 7, y - 8, 3, 6); g.fillRect(x + 4, y - 10, 3, 6); }
function mapHouse(g, x, y) { g.fillStyle = '#f1dfb3'; g.fillRect(x - 6, y - 6, 12, 9); g.fillStyle = '#b0302a'; g.beginPath(); g.moveTo(x - 8, y - 6); g.lineTo(x, y - 13); g.lineTo(x + 8, y - 6); g.fill(); }
function mapMountain(g, x, y, s, c, cap) {
  g.fillStyle = c; g.beginPath(); g.moveTo(x - s, y + s * 0.3); g.lineTo(x, y - s); g.lineTo(x + s, y + s * 0.3); g.fill();
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y + s * 0.3); g.lineTo(x + s * 0.1, y + s * 0.3); g.fill();
  g.fillStyle = cap; g.beginPath(); g.moveTo(x - s * 0.3, y - s * 0.45); g.lineTo(x, y - s); g.lineTo(x + s * 0.3, y - s * 0.45); g.lineTo(x + s * 0.1, y - s * 0.52); g.lineTo(x - s * 0.1, y - s * 0.45); g.fill();
}
function mapCastle(g, x, y) {
  g.fillStyle = '#c9c3de'; g.strokeStyle = '#4b3216'; g.lineWidth = 2;
  g.fillRect(x - 24, y - 26, 48, 26); g.strokeRect(x - 24, y - 26, 48, 26);
  for (const tx of [-30, 18]) { g.fillRect(x + tx, y - 40, 12, 40); g.strokeRect(x + tx, y - 40, 12, 40); g.fillStyle = '#b0302a'; g.beginPath(); g.moveTo(x + tx - 3, y - 40); g.lineTo(x + tx + 6, y - 54); g.lineTo(x + tx + 15, y - 40); g.fill(); g.fillStyle = '#c9c3de'; }
}
function mapVolcano(g, x, y) {
  g.fillStyle = '#4a2a22'; g.beginPath(); g.moveTo(x - 90, y + 40); g.lineTo(x - 18, y - 60); g.lineTo(x + 18, y - 60); g.lineTo(x + 90, y + 40); g.fill();
  g.fillStyle = '#ff7a2f'; g.beginPath(); g.moveTo(x - 16, y - 58); g.lineTo(x - 8, y - 20); g.lineTo(x - 14, y + 20); g.lineTo(x - 4, y + 20); g.lineTo(x + 2, y - 20); g.lineTo(x + 16, y - 58); g.fill();
}
function mapPyramid(g, x, y, s) {
  g.fillStyle = '#e2b06a'; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y - s * 0.8); g.lineTo(x + s, y); g.fill();
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(x, y - s * 0.8); g.lineTo(x + s, y); g.lineTo(x + s * 0.1, y); g.fill();
}
function drawMapNode(g, n, T, selected) {
  const x = n.x, y = n.y;
  const avail = n.avail;
  if (selected) { g.strokeStyle = 'rgba(255,197,61,.9)'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 34 + Math.sin(T * 5) * 3, 0, TAU); g.stroke(); }
  if (avail && !n.cleared && !n.side) { g.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(T * 4) * 0.3})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 30 + (T * 20) % 14, 0, TAU); g.stroke(); }
  // flag banner
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y + 22, 22, 6, 0, 0, TAU); g.fill();
  const col = !avail ? '#8a8398' : n.side ? (n.side.kind === 'typing' ? '#3ee6a8' : n.side.kind === 'cow' ? '#ff9fd0' : n.side.kind === 'gauntlet' ? '#b77cff' : '#ff7a2f') : n.cleared ? '#3ee6a8' : BOSSES[n.lvl.end].elite ? '#55c8ff' : '#ff4f73';
  g.fillStyle = col; g.strokeStyle = OUTLINE; g.lineWidth = 3;
  g.beginPath(); g.arc(x, y, 22, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x - 6, y - 7, 8, 0, TAU); g.fill();
  g.fillStyle = OUTLINE; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (!avail) {
    g.fillStyle = '#3a3350'; g.fillRect(x - 7, y - 3, 14, 11); g.strokeStyle = '#3a3350'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y - 4, 5, Math.PI, TAU); g.stroke();
  } else if (n.side) {
    g.font = `16px ${FONT_DISPLAY}`; g.fillText(n.side.kind === 'typing' ? '⌨' : n.side.kind === 'cow' ? 'M' : n.side.kind === 'gauntlet' ? '5x' : '∞', x, y + 1);
  } else {
    g.font = `17px ${FONT_DISPLAY}`; g.fillStyle = '#1b1030'; g.fillText(n.lvl.n, x, y + 1);
    if (!BOSSES[n.lvl.end].elite) { g.fillStyle = '#ffc53d'; g.strokeStyle = OUTLINE; g.lineWidth = 2; starPath(g, x + 17, y - 17, 8, 3.5, 5); g.fill(); g.stroke(); }
  }
  // golden floppy found here
  if (n.lvl && SAVE.floppies && SAVE.floppies[n.id]) { g.fillStyle = '#ffc53d'; g.strokeStyle = OUTLINE; g.lineWidth = 1.5; g.fillRect(x + 16, y + 6, 12, 12); g.strokeRect(x + 16, y + 6, 12, 12); g.fillStyle = '#fff'; g.fillRect(x + 18, y + 12, 8, 5); }
  // stars
  if (n.lvl && n.cleared) for (let i = 0; i < 3; i++) { g.fillStyle = i < n.stars ? '#ffc53d' : 'rgba(60,40,20,.5)'; starPath(g, x - 16 + i * 16, y + 32, 7, 3, 5); g.fill(); }
  // label
  const name = n.side ? n.side.name : n.lvl.name;
  g.font = `13px ${FONT_BODY}`; g.lineWidth = 4; g.strokeStyle = 'rgba(241,223,179,.95)'; g.fillStyle = '#3a2410';
  const ly = n.lvl && n.cleared ? y + 54 : y + 40;
  g.strokeText(name, x, ly); g.fillText(name, x, ly);
}
