// ============================================================
//  Stage: level flow, waves, camera, rendering, HUD
// ============================================================
const SEC_W = 1150;
const COMBO_RANKS = [
  { n: 0, r: '', c: '#fff', bonus: 0 }, { n: 8, r: 'D', c: '#c9c3de', bonus: 0.05 }, { n: 15, r: 'C', c: '#3ee6a8', bonus: 0.1 },
  { n: 25, r: 'B', c: '#55c8ff', bonus: 0.15 }, { n: 40, r: 'A', c: '#b77cff', bonus: 0.2 }, { n: 60, r: 'S', c: '#ffc53d', bonus: 0.3 },
  { n: 85, r: 'SS', c: '#ff7a2f', bonus: 0.4 }, { n: 120, r: 'SSS', c: '#ff4f73', bonus: 0.5 },
];
const RANK_WORDS = { D: 'Decent', C: 'Cool', B: 'Bravo', A: 'Awesome', S: 'Stylish', SS: 'Sensational', SSS: 'SUPERSONIC' };
function comboRank(n) { let r = COMBO_RANKS[0]; for (const c of COMBO_RANKS) if (n >= c.n) r = c; return r; }

class Stage {
  constructor(o) {
    S = this;
    this.mode = o.mode || 'level';
    this.level = o.level;
    this.heroId = o.heroId;
    this.bot = !!o.bot;
    this.onEnd = o.onEnd;
    this.time = 0; this.hitstop = 0; this.shakeAmt = 0; this.flashRed = 0; this.flashWhite = 0; this.timeStop = 0; this.slowmo = 0;
    this.combo = 0; this.comboT = 0; this.maxCombo = 0; this.kills = 0; this.quarters = 0; this.dmgDealt = 0; this.tookDamage = false;
    this.heroes = []; this.enemies = []; this.projs = []; this.zones = []; this.pickups = []; this.props = []; this.decals = [];
    this.bolts = []; this.afterimages = []; this.clones = []; this.spawnQ = []; this.banners = [];
    this.engaged = new Set();
    this.pendingLevels = 0; this.pendingChests = 0; this.inDraft = false; this.paused = false; this.over = false;
    this.god = !!Game.cheats.god; this.noclip = !!Game.cheats.noclip;
    this.letterbox = 0; this.bossIntro = null; this.bosses = [];
    this.wave = 0; this.revivesUsed = 0; this.cheated = !!Game.cheatedRun;
    const L = this.mode === 'endless' ? 3 : this.level.n;
    this.setDifficulty(L);
    this.sections = this.mode === 'endless' || this.mode === 'demo' ? 1 : this.level.sections;
    this.stageLen = this.sections * SEC_W;
    this.secIdx = 0;
    this.arena = [0, SEC_W];
    this.unlocked = false;
    const biome = this.level.biome;
    this.bg = createBackground(biome, hashStr(this.level.id || 'x') + 7, this.level.night);
    this.bg.placeProps(this.mode === 'endless' || this.mode === 'demo' ? 6000 : this.stageLen);
    this.hero = o.carry ? carryHero(o.carry, 180, DEPTH * 0.55) : makeHero(this.heroId, 180, DEPTH * 0.55);
    this.heroes.push(this.hero);
    this.mods = o.mods || {};
    if (this.mods.hpMul) this.hpMul *= this.mods.hpMul;
    if (this.mods.elite) this.eliteChance += this.mods.elite;
    if (Game.cheats.idkfa) { for (const s of this.hero.spells) s.lvl = 5; this.hero.cards[this.hero.spells[0].id] = 5; }
    this.camX = 0;
    this.maxEngaged = 2 + Math.floor(L / 4);
    // warm-up kit: later levels start with free upgrade picks so the build fits the difficulty
    if (this.mode === 'level' && !o.noKit) {
      const kit = Math.floor((L - 1) / 2);
      this.pendingLevels = kit; this.hero.level += kit; this.hero.xpNext = xpForLevel(this.hero.level);
      this.warmup = this.bot ? 0 : kit;
    }
    if (this.mods.chest) this.pendingChests++;
    this.startSection(0);
    if (this.mode !== 'demo') Sfx.playMusic(this.mode === 'endless' ? 'boss' : BIOMES[biome].music);
    this.intro = 1.6;
    this.banner(this.mode === 'endless' ? 'ENDLESS COLOSSEUM' : this.mode === 'demo' ? '' : `LEVEL ${this.level.n} · ${this.level.name.toUpperCase()}`, '#fff', 1.8, true);
  }
  setDifficulty(L) {
    this.diff = L;
    this.hpMul = 1 + 0.26 * (L - 1);
    this.dmgMul = 1 + 0.1 * (L - 1);
    this.spdMul = 1 + 0.025 * (L - 1);
    this.aggr = 1 + 0.045 * (L - 1);
    this.eliteChance = L >= 3 ? 0.03 + L * 0.008 : 0;
  }
  bounds(f) {
    const a = this.arena;
    if (f.isHero) return this.noclip ? [a[0] + 10, a[1] - 10] : [a[0] + 20, a[1] - 20];
    if (f.entering) return [a[0] - 260, a[1] + 260];
    return [a[0] + 10, a[1] - 10];
  }
  inChrono(o) {
    for (const z of this.zones) if (z.chrono && !z.dead && z.contains(o, 10)) return true;
    return false;
  }
  shake(n) { if (SAVE.settings.shake) this.shakeAmt = Math.max(this.shakeAmt, n); }
  banner(text, color, dur, big) { if (text) this.banners.push({ text, color, t: 0, dur: dur || 1.2, big }); }
  addProj(p) { this.projs.push(p); return p; }
  addZone(z) { this.zones.push(z); return z; }
  addPickup(p) { this.pickups.push(p); return p; }
  addDecal(d) { d.t = 0; this.decals.push(d); }
  telegraph(o) {
    const z = new Zone(Object.assign({ life: o.life || 0.15, kind: o.kind || 'burst' }, o));
    if (o.meteor) {
      z.onDrawTop = true;
    }
    return this.addZone(z);
  }

  // ---------------- waves ----------------
  startSection(i) {
    this.secIdx = i;
    const start = i * SEC_W;
    this.arena = [start, start + SEC_W];
    this.unlocked = false;
    this.waves = [];
    const L = this.diff;
    if (this.mode === 'demo' || this.mode === 'typing') { this.waves = []; this.waveIdx = 0; return; }
    if (this.mode === 'endless') { this.nextEndlessWave(); return; }
    const last = i === this.sections - 1;
    const nW = last ? 1 + (L >= 6 ? 1 : 0) : 2 + (i > 0 && L >= 3 ? 1 : 0);
    for (let w = 0; w < nW; w++) {
      const n = Math.round(3 + L * 0.45 + i * 0.8 + w * 0.6);
      const list = [];
      for (let k = 0; k < n; k++) list.push(weightedPick(this.level.pool, (p) => p[1])[0]);
      this.waves.push(list);
    }
    if (last) this.waves.push('BOSS');
    // breakables in this section
    const r = makeRng(hashStr(this.level.id) + i * 31);
    const np = 2 + r.int(0, 2);
    for (let k = 0; k < np; k++) this.props.push(new Prop({ kind: r.pick(['barrel', 'crate', 'barrel', 'rock']), x: start + r.range(200, SEC_W - 150), z: r.range(20, DEPTH - 20), hp: 24 }));
    this.waveIdx = 0;
    this.waveCooldown = i === 0 ? 1.4 : 0.6;
  }
  nextEndlessWave() {
    this.wave++;
    const w = this.wave;
    this.setDifficulty(1 + w * 0.55);
    this.maxEngaged = 2 + Math.floor(w / 3);
    const pool = Object.keys(ENEMIES).filter((k) => k !== 'cow');
    const tierPool = pool.slice(0, Math.min(pool.length, 4 + w));
    const list = [];
    const n = 4 + Math.floor(w * 1.2);
    for (let k = 0; k < n; k++) list.push(pick(tierPool));
    this.waves = [list];
    if (w % 5 === 0) {
      const bossList = ['bigmike', 'twinhood', 'worm', 'frostknight', 'forgegolem', 'mimic', 'grumble', 'pharaoh', 'yeti'];
      this.waves.push('ENDLESSBOSS:' + bossList[Math.min(bossList.length - 1, w / 5 - 1)]);
    }
    this.waveIdx = 0; this.waveCooldown = 1.5;
    this.banner('WAVE ' + w, '#ffc53d', 1.2);
    if (w >= 10) unlockAch('endless10');
  }
  spawnEnemy(kind, o = {}) {
    const def = ENEMIES[kind];
    if (!def) return;
    const doSpawn = () => {
      if (this.over) return;
      const side = o.side || (Math.random() < 0.5 ? -1 : 1);
      const elite = o.elite || Math.random() < this.eliteChance;
      let x = side < 0 ? this.arena[0] - 80 : this.arena[1] + 80;
      const z = o.z ?? R(10, DEPTH - 10);
      const e = new Fighter({ team: 'enemy', kind, def, x, z, hp: def.hp * this.hpMul, dmg: def.dmg * this.dmgMul, speed: def.speed * this.spdMul, ai: def.ai, face: -side, scale: def.scale || 1 });
      e.entering = true;
      // some enemies make a dramatic entrance inside the arena
      if (!o.edge && (kind === 'skeleton' || kind === 'mummy') && Math.random() < 0.5) { e.x = R(this.arena[0] + 100, this.arena[1] - 100); e.entering = false; e.setState('spawn'); dust(e.x, e.z, 10); }
      if (!o.edge && kind === 'slime' && Math.random() < 0.5) { e.x = R(this.arena[0] + 100, this.arena[1] - 100); e.entering = false; e.y = 400; e.setState('air'); e.vy = 0; }
      if (elite) this.makeElite(e);
      this.enemies.push(e);
      this.heroes.length; // noop
    };
    if (o.delay) this.spawnQ.push({ t: o.delay, fn: doSpawn }); else doSpawn();
  }
  makeElite(e) {
    const mod = pick(['shielded', 'swift', 'vampiric', 'explosive', 'giant']);
    e.mods.push(mod);
    e.isElite = true;
    e.maxHp *= 1.8; e.hp = e.maxHp;
    e.xpMul = 3;
    if (mod === 'shielded') e.shield = e.maxHp * 0.4;
    if (mod === 'swift') e.speed *= 1.5;
    if (mod === 'giant') { e.scale *= 1.3; e.w *= 1.3; e.h *= 1.3; e.maxHp *= 1.5; e.hp = e.maxHp; e.dmg *= 1.3; e.weight *= 1.5; }
  }
  spawnBoss(id, opts = {}) {
    const def = BOSSES[id];
    const mk = (x, z, hpFrac) => {
      const L = this.diff;
      const b = new Fighter({ team: 'enemy', kind: id, def, x, z, hp: def.hp * (1 + 0.08 * (L - 1)) * hpFrac, dmg: def.dmg * (1 + 0.06 * (L - 1)), speed: def.speed, ai: 'boss', boss: true, elite: def.elite, face: -1, scale: def.scale || 1 });
      b.w = (def.w || 40) * (def.scale || 1) * (def.art === 'dragon' ? 3 : def.art === 'treant' ? 2.2 : def.art === 'bug' ? 3 : def.art === 'worm' ? 1.4 : def.art === 'golem' ? 1.8 : def.art === 'mimic' ? 1.6 : 1);
      b.h = def.h || 104 * (def.scale || 1);
      if (def.art === 'golem') b.h = 110 * (def.scale || 1);
      b.weight = def.weight || 3;
      b.actCd = 1.5;
      this.enemies.push(b); this.bosses.push(b);
      return b;
    };
    const cx = this.arena[1] - 170;
    this.bosses = this.bosses.filter((b) => !b.dead);
    if (def.twin) { mk(cx, DEPTH * 0.3, 0.6); mk(cx - 60, DEPTH * 0.75, 0.6); }
    else mk(cx, DEPTH * 0.5, 1);
    for (const b of this.bosses) b.setState('spawn');
    this.bossIntro = { t: 0, def, elite: def.elite, dur: opts.quick ? 1.6 : 2.6 };
    if (!def.elite) Sfx.playMusic('boss');
    Sfx.play('roar'); this.shake(8);
  }
  updateWaves(dt) {
    for (let i = this.spawnQ.length - 1; i >= 0; i--) { const q = this.spawnQ[i]; q.t -= dt; if (q.t <= 0) { this.spawnQ.splice(i, 1); q.fn(); } }
    if (this.mode === 'typing') return;
    if (this.mode === 'demo') {
      if (this.enemies.filter((e) => !e.dead).length < 3 && Math.random() < dt) this.spawnEnemy(pick(['goon', 'slime', 'thug', 'archer', 'skeleton', 'mushroom']));
      return;
    }
    if (this.over || this.bossIntro) return;
    const alive = this.enemies.filter((e) => !e.dead).length;
    if (this.waveIdx < this.waves.length) {
      this.waveCooldown -= dt;
      const cur = this.waves[this.waveIdx];
      const threshold = cur === 'BOSS' || (typeof cur === 'string') ? 0 : 1 + Math.floor(this.diff / 5);
      if (alive <= threshold && this.waveCooldown <= 0 && this.spawnQ.length === 0) {
        this.waveIdx++;
        if (cur === 'BOSS') { this.banner('WARNING!', '#ff4f73', 1.4, true); Sfx.play('banner'); this.spawnQ.push({ t: 1.2, fn: () => this.spawnBoss(this.level.end) }); }
        else if (typeof cur === 'string' && cur.startsWith('ENDLESSBOSS')) { this.spawnBoss(cur.split(':')[1], { quick: true }); }
        else {
          cur.forEach((k, j) => this.spawnEnemy(k, { delay: j * R(0.25, 0.6), side: j % 2 ? -1 : 1 }));
          this.waveCooldown = 2.5;
        }
      }
    } else if (alive === 0 && this.spawnQ.length === 0 && !this.unlocked) {
      if (this.mode === 'endless') { this.nextEndlessWave(); return; }
      if (this.secIdx < this.sections - 1) {
        this.unlocked = true;
        this.arena = [this.arena[0], (this.secIdx + 2) * SEC_W];
        this.banner('GO! →', '#3ee6a8', 1.6);
        Sfx.play('banner');
        // the Wandering Merchant sets up shop right before the boss section
        if (this.mode === 'level' && this.diff >= 2 && this.secIdx === this.sections - 2 && !this.merchant) {
          this.merchant = { x: (this.secIdx + 1) * SEC_W - 120, z: 26, t: 0, sold: {}, line: 0, z0: 26 };
          Floaters.add(this.merchant.x, scrY(26, 120), 'SHOP!', { color: '#ffc53d', size: 22, life: 2 });
        }
      }
    }
    if (this.unlocked && this.hero.x > (this.secIdx + 1) * SEC_W + 160) {
      this.startSection(this.secIdx + 1);
      this.arena = [this.secIdx * SEC_W, (this.secIdx + 1) * SEC_W];
    }
  }

  // ---------------- events ----------------
  onKill(e, att) {
    this.kills++;
    this.engaged.delete(e.id);
    if (this.mode !== 'demo') {
      SAVE.stats.kills++;
      if (SAVE.stats.kills === 1) unlockAch('first');
      if (SAVE.stats.kills >= 1000) unlockAch('kills1000');
      if (e.kind === 'cow') SAVE.stats.cows++;
    }
    const def = e.def;
    let xp = (def.xp || 2) * (e.xpMul || 1) * (1 + (this.diff - 1) * 0.12);
    // split XP into gems
    while (xp > 0) { const v = xp >= 10 ? 10 : xp >= 4 ? 4 : Math.max(1, Math.round(xp)); xp -= v; this.addPickup(new Pickup({ kind: 'xp', value: v, x: e.x, z: e.z, y: 30 })); }
    const q = def.q || 1;
    const nq = Math.random() < 0.55 ? RI(0, q) : 0;
    for (let i = 0; i < nq; i++) this.addPickup(new Pickup({ kind: 'coin', value: 1 + Math.floor(this.diff / 4), x: e.x, z: e.z }));
    if (Math.random() < 0.05) this.addPickup(new Pickup({ kind: Math.random() < 0.5 ? 'milk' : 'food', x: e.x, z: e.z }));
    if (e.isElite && !e.isBoss) this.addPickup(new Pickup({ kind: 'chest', x: e.x, z: e.z }));
    if (e.isBoss) {
      SAVE.stats.bossKills++;
      for (let i = 0; i < 12; i++) this.addPickup(new Pickup({ kind: 'coin', value: 2 + this.diff, x: e.x + R(-30, 30), z: e.z }));
      const bossesAlive = this.bosses.filter((b) => !b.dead).length;
      if (bossesAlive === 0 && this.mode !== 'endless') this.victory(e);
      else if (this.mode === 'endless') this.addPickup(new Pickup({ kind: 'chest', x: e.x, z: e.z }));
    }
  }
  heroDown(h) {
    if (h.dead) return;
    if (h.revives > 0 || (h.cards.secondWind && !h.usedSecondWind)) {
      const oneUp = h.revives > 0;
      if (oneUp) h.revives--; else h.usedSecondWind = true;
      h.hp = h.maxHp * (oneUp ? 0.6 : 0.5);
      h.inv = 2.5; h.setState('getup');
      this.revivesUsed++;
      this.banner(oneUp ? '1UP!' : 'SECOND WIND!', '#3ee6a8', 1.4, true);
      Sfx.play('levelup'); this.flashWhite = 0.3;
      for (const e of this.enemies) if (!e.dead && Math.abs(e.x - h.x) < 260) { e.setState('air'); e.vy = 300; e.vx = sign(e.x - h.x) * 300; }
      return;
    }
    h.hp = 0; h.dead = true;
    h.setState('dead'); h.vy = 300; h.vx = -h.face * 120; h.y = 2;
    Sfx.play('die'); Sfx.play('lose');
    this.slowmo = 1.5;
    this.banner('K.O.', '#ff4f73', 2.4, true);
    this.over = 'lose';
    this.endTimer = 2.6;
    if (this.mode !== 'demo') SAVE.stats.deaths++;
  }
  victory(boss) {
    if (this.over) return;
    this.over = 'win';
    this.slowmo = 1.4;
    this.flashWhite = 0.5; this.shake(14);
    Sfx.play('boom');
    this.banner(this.level.end && BOSSES[this.level.end].elite ? 'STAGE CLEAR!' : 'BOSS DEFEATED!', '#ffc53d', 2.8, true);
    Sfx.stopMusic();
    setTimeout(() => { Sfx.play('win'); }, 500);
    this.vacuum = true;
    this.endTimer = 3.4;
    for (const e of this.enemies) if (!e.dead && !e.isBoss) { dealDamage(this.hero, e, { dmg: 99999, ignoreInv: true, noKnock: true }); }
  }
  openChest(p) {
    Sfx.play('card');
    this.pendingChests++;
    Particles.burst(p.x, scrY(p.z, 30), 24, { speed: 260, life: 0.8, size: 5, colors: ['#ffc53d', '#fff4c2'], type: 'star' });
  }

  // ---------------- update ----------------
  update(dtReal) {
    let dt = Math.min(dtReal, 1 / 30);
    this.time += dt;
    if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.35; }
    Particles.update(dt); Floaters.update(dt);
    for (const b of this.banners) b.t += dtReal;
    this.banners = this.banners.filter((b) => b.t < b.dur);
    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dtReal * 40);
    if (this.flashRed > 0) this.flashRed -= dtReal;
    if (this.flashWhite > 0) this.flashWhite -= dtReal;
    this.bolts = this.bolts.filter((b) => (b.t -= dtReal) > 0);
    this.afterimages = this.afterimages.filter((a) => (a.t -= dtReal) > 0);
    if (this.hitstop > 0) { this.hitstop -= dtReal; this.updateCamera(dtReal); return; }
    if (this.intro > 0) this.intro -= dt;
    if (this.bossIntro) {
      this.bossIntro.t += dt;
      this.letterbox = Math.min(1, this.letterbox + dt * 3);
      if (this.bossIntro.t > this.bossIntro.dur) { this.bossIntro = null; }
    } else this.letterbox = Math.max(0, this.letterbox - dt * 3);
    if (this.timeStop > 0) this.timeStop -= dt;
    const h = this.hero;
    // input
    if (!this.over && !this.bossIntro) {
      if (this.mode === 'typing') { /* the typing controller drives the hero */ }
      else if (this.bot) botControl(h, dt); else heroControl(h, dt, Input);
    } else if (!h.dead && this.over !== 'win') { h.vx *= 0.8; }
    if (this.over === 'win' && !h.dead && h.canAct()) { h.state = 'win'; h.anim = 'win'; h.vx = 0; h.vz = 0; }
    h.tickHero(dt);
    // AI
    if (!this.bossIntro) for (const e of this.enemies) {
      enemyThink(e, dt);
      if (e.pendingShot) { e.pendingShot.t -= dt * e.ts; if (e.pendingShot.t <= 0) { if (!e.dead && e.state === 'cast') enemyShoot(e, e.pendingShot.kind, h); e.pendingShot = null; } }
      if (e.state === 'block') { e.blockT -= dt; if (e.blockT <= 0) { e.setState('idle'); e.blockHits = 0; } }
    }
    // physics & states
    for (const f of this.heroes) f.update(dt);
    for (const e of this.enemies) e.update(dt);
    this.separate();
    this.resolveMelee();
    for (const p of this.projs) p.update(dt);
    for (const z of this.zones) z.update(dt);
    for (const p of this.pickups) p.update(dt);
    for (const p of this.props) p.update(dt);
    for (const d of this.decals) d.t += dt;
    this.updateClones(dt);
    this.projs = this.projs.filter((p) => !p.dead);
    this.zones = this.zones.filter((z) => !z.dead);
    this.pickups = this.pickups.filter((p) => !p.dead);
    this.props = this.props.filter((p) => !p.dead || p.held);
    this.decals = this.decals.filter((d) => d.t < d.life);
    this.enemies = this.enemies.filter((e) => { if (e.remove) { this.engaged.delete(e.id); return false; } return true; });
    for (const id of this.engaged) if (!this.enemies.find((e) => e.id === id && !e.dead)) this.engaged.delete(id);
    // combo decay
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.endCombo(); } }
    if (this.combo >= 25) unlockAch('combo25');
    if (this.combo >= 75) unlockAch('combo75');
    this.updateWaves(dt);
    this.bg.weather(this.camX, dt);
    this.updateCamera(dtReal);
    // level-ups and chests
    if (!this.inDraft && !h.dead && (this.pendingLevels > 0 || this.pendingChests > 0) && !this.bossIntro && this.intro <= 0.6 && (this.over !== 'win' || this.pendingChests > 0 || this.pendingLevels > 0)) {
      if (this.bot || this.mode === 'demo') { this.autoDraft(); }
      else this.openDraft();
    }
    if (this.over && !this.inDraft) {
      this.endTimer -= dtReal;
      if (this.endTimer <= 0 && !this.ended) { this.ended = true; if (this.onEnd) this.onEnd(this.over); }
    }
  }
  endCombo() {
    if (this.combo >= 8 && this.mode !== 'demo') {
      const rk = comboRank(this.combo);
      Floaters.add(this.hero.x, scrY(this.hero.z, 170), `${this.combo} HIT ${RANK_WORDS[rk.r] || ''}`, { color: rk.c, size: 20, life: 1.2 });
    }
    if (this.mode !== 'demo') SAVE.stats.maxCombo = Math.max(SAVE.stats.maxCombo, this.combo);
    this.combo = 0;
  }
  openDraft() {
    const chest = this.pendingChests > 0;
    this.inDraft = true;
    const cards = makeDraft(this.hero, chest);
    const warm = !chest && this.warmup > 0;
    UI.openDraft(cards, chest, (card) => {
      if (card) applyCard(this.hero, card);
      if (chest) this.pendingChests--; else { this.pendingLevels--; if (this.warmup > 0) this.warmup--; }
      this.inDraft = false;
      Input.clearAll();
    });
  }
  autoDraft() {
    const chest = this.pendingChests > 0;
    const cards = makeDraft(this.hero, chest);
    applyCard(this.hero, cards[0]);
    if (chest) this.pendingChests--; else this.pendingLevels--;
  }
  separate() {
    const all = this.enemies;
    const h = this.hero;
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (a.dead || a.hidden) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (b.dead || b.hidden) continue;
        const dx = b.x - a.x, dz = (b.z - a.z) * 1.6;
        const min = (a.w + b.w) * 0.42;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 0.01) {
          const d = Math.sqrt(d2), push = (min - d) * 0.5;
          const nx = dx / d, nz = dz / d / 1.6;
          const wa = a.isBoss ? 0.1 : 1, wb = b.isBoss ? 0.1 : 1;
          a.x -= nx * push * wa; a.z -= nz * push * wa; b.x += nx * push * wb; b.z += nz * push * wb;
        }
      }
      // hero vs enemy (soft; noclip cheat disables)
      if (!this.noclip && !h.dead && h.y < 30 && a.y < 30 && a.state !== 'down' && a.state !== 'air') {
        const dx = h.x - a.x, dz = (h.z - a.z) * 1.6;
        const min = (a.w + h.w) * 0.4;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 0.01) {
          const d = Math.sqrt(d2), push = (min - d);
          const w = a.isBoss ? 0.9 : 0.5;
          h.x += (dx / d) * push * w; h.z += (dz / d / 1.6) * push * w;
          a.x -= (dx / d) * push * (1 - w); a.z -= (dz / d / 1.6) * push * (1 - w);
        }
      }
    }
    for (const f of [h, ...all]) f.z = clamp(f.z, 0, DEPTH);
  }
  resolveMelee() {
    const all = [...this.heroes, ...this.enemies];
    for (const a of all) {
      if (a.dead || a.state !== 'attack' || !a.activeHit || !a.move) continue;
      const box = a.hitBox();
      const targets = a.team === 'hero' ? this.enemies : this.heroes;
      for (const t of targets) {
        if (t.dead || a.hitIds.has(t.id) || t.hidden) continue;
        if (!t.overlaps(box.x0, box.x1, box.y0, box.y1, box.z, box.zr)) continue;
        a.hitIds.add(t.id);
        const m = a.move;
        let dmg = a.isHero ? this.heroMoveDmg(a, m) : a.dmg * (m.dmg || 1);
        dealDamage(a, t, { dmg, el: 'phys', kx: m.kx, ky: m.ky, fall: m.fall, stop: m.stop, sfx: m.sfx, melee: true, finisher: m.finisher, heavy: m.finisher, dir: a.face });
        if (a.isHero) this.heroInnate(a, t, m);
      }
      // deflect enemy projectiles (LF2 style: punch the energy ball away)
      if (a.isHero) for (const p of this.projs) {
        if (p.dead || p.team !== 'enemy' || p.kind === 'bomb' || p.unblockable) continue;
        if (p.x < box.x0 - p.r || p.x > box.x1 + p.r || Math.abs(p.z - box.z) > box.zr + 12 || p.y < box.y0 - 20 || p.y > box.y1 + 20) continue;
        p.dead = true;
        spark(p.x, p.z, p.y, '#fff4c2', 8);
        Floaters.add(p.x, scrY(p.z, p.y + 30), 'DEFLECT!', { color: '#55c8ff', size: 16 });
        Sfx.play('block');
        this.hitstop = Math.max(this.hitstop, 0.04);
        a.addOverdrive(6);
      }
      // props
      if (a.isHero) for (const p of this.props) {
        if (p.dead || p.held || a.hitIds.has(p.id)) continue;
        if (p.x < box.x0 - 18 || p.x > box.x1 + 18 || Math.abs(p.z - box.z) > box.zr + 10) continue;
        a.hitIds.add(p.id);
        p.hit(this.heroMoveDmg(a, a.move), a);
        this.hitstop = Math.max(this.hitstop, 0.03);
      }
    }
    // Tectonic Thunder duo: zap knocked-down enemies
    if (this.hero.cards.duo_tectonic) for (const e of this.enemies) {
      if (!e.dead && e.state === 'down' && !e.tectonicZapped) { e.tectonicZapped = true; boltFx(e.x, 0, e.x, scrY(e.z, 10)); dealDamage(this.hero, e, { dmg: this.hero.baseDmg() * 1.5, el: 'storm', dot: true }); }
      if (e.state !== 'down') e.tectonicZapped = false;
    }
  }
  // hero innate passives that trigger on landed melee hits
  heroInnate(h, t, m) {
    const id = h.hdef.id;
    if (id === 'rook' && m.finisher && !h.hitIds.has('innate')) {
      h.hitIds.add('innate');
      h.streak = (h.streak || 0) + 1;
      if (h.streak % 2 === 0) {
        Sfx.play('fire');
        this.addProj(new Projectile({ team: 'hero', owner: h, spell: true, kind: 'fireball', x: h.x + h.face * 30, y: 62, z: h.z, vx: h.face * 560, r: 14, dmg: h.baseDmg() * 1.3, el: 'fire', life: 1.1, kx: 160, fall: 50, trail: '#ff7a2f' }));
        Floaters.add(h.x, scrY(h.z, h.h + 40), 'HOT STREAK', { color: '#ff7a2f', size: 16 });
      }
    }
    if (id === 'volta') {
      h.encore = (h.encore || 0) + 1;
      if (h.encore % 12 === 0) { chainLightning(h, t, 2, h.baseDmg() * 1.4, 220, []); Floaters.add(h.x, scrY(h.z, h.h + 40), 'ENCORE!', { color: '#ffe45c', size: 16 }); }
    }
  }
  heroMoveDmg(h, m) {
    const wt = h.weaponType;
    const idx = Math.min(h.comboStep, wt.dmg.length - 1);
    let base = wt.dmg[idx] * h.stats.wpnMul * (m.dmg || 1);
    if (m.name === 'dashpunch' || m.name === 'flykick') base = wt.dmg[wt.dmg.length - 1] * h.stats.wpnMul * (m.dmg || 1);
    return base;
  }
  updateClones(dt) {
    const h = this.hero;
    for (const c of this.clones) {
      c.t -= dt;
      c.atkT = (c.atkT || c.delay || 0) - dt;
      c.face = h.face;
      // follow the hero loosely
      c.x = lerp(c.x, h.x - h.face * 60, dt * 3); c.z = lerp(c.z, h.z + (c.delay - 0.08) * 400, dt * 3);
      if (c.atkT <= 0) {
        c.atkT = 0.45;
        for (const e of this.enemies) if (!e.dead && Math.abs(e.x - (c.x + c.face * 50)) < 60 && Math.abs(e.z - c.z) < 40) dealDamage(h, e, { dmg: h.baseDmg() * 0.7, el: 'time', slow: 1, kx: 60, fall: 20, melee: true, dir: c.face });
      }
    }
    this.clones = this.clones.filter((c) => c.t > 0);
  }
  updateCamera(dt) {
    const h = this.hero;
    let target = h.x - VIEW_W / 2 + h.face * 70;
    if (this.bossIntro && this.bosses[0]) target = lerp(target, this.bosses[0].x - VIEW_W / 2, 0.6);
    const a0 = this.arena[0], a1 = this.arena[1];
    if (a1 - a0 <= VIEW_W) target = (a0 + a1) / 2 - VIEW_W / 2;
    else target = clamp(target, a0 - 20, a1 - VIEW_W + 20);
    this.camX = lerp(this.camX, target, Math.min(1, dt * 5));
  }

  // ---------------- render ----------------
  draw() {
    const g = ctx;
    const T = this.time;
    let sx = 0, sy = 0;
    if (this.shakeAmt > 0) { sx = R(-1, 1) * this.shakeAmt; sy = R(-1, 1) * this.shakeAmt; }
    const cam = Math.round(this.camX);
    g.save();
    g.translate(sx, sy);
    this.bg.drawBack(cam, T);
    // decals
    for (const d of this.decals) drawDecal(d, cam);
    for (const z of this.zones) z.draw(cam, 'floor');
    // shadows
    const ents = [];
    for (const f of this.heroes) ents.push(f);
    for (const f of this.enemies) ents.push(f);
    for (const p of this.props) ents.push(p);
    for (const p of this.pickups) ents.push(p);
    for (const p of this.projs) ents.push(p);
    if (this.merchant) ents.push({ z: this.merchant.z, draw: (c) => drawMerchant(this, c) });
    for (const f of ents) if (f instanceof Fighter) drawShadow(f, cam);
    ents.sort((a, b) => a.z - b.z || (a.y || 0) - (b.y || 0));
    // afterimages behind
    for (const a of this.afterimages) { g.globalAlpha = a.t * 1.5; drawHumanoid(g, a.x - cam, scrY(a.z, 0), depthScale(a.z), a.face, a.look, Object.assign(basePose(), { lean: 0.35, lF: 1, lB: -0.9, kF: 0.8 }), { tint: '#c58cff' }); g.globalAlpha = 1; }
    for (const c of this.clones) { g.globalAlpha = 0.55; drawHumanoid(g, c.x - cam, scrY(c.z, 0), depthScale(c.z), c.face, this.hero.look, computePose(this.hero), { tint: '#c58cff' }); g.globalAlpha = 1; }
    for (const e of ents) {
      if (e instanceof Fighter) drawFighter(e, cam);
      else e.draw(cam);
    }
    // hero orbiting ice shards
    const h = this.hero;
    if (h.orbs) for (const o of h.orbs) {
      const ox = o.x - cam, oy = scrY(o.z, 60);
      g.globalCompositeOperation = 'lighter'; drawGlow(ox, oy, 16, '#7fe3ff', 0.8); g.globalCompositeOperation = 'source-over';
      g.save(); g.translate(ox, oy); g.rotate(o.a * 2); g.fillStyle = '#e6fbff'; g.strokeStyle = '#2f6bd8'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -10); g.lineTo(5, 0); g.lineTo(0, 10); g.lineTo(-5, 0); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    for (const z of this.zones) {
      z.draw(cam, 'top');
      if (z.meteor && z.t < z.delay) {
        const k = z.t / z.delay;
        const mx = z.x - cam + (1 - k) * 160, my = scrY(z.z, 0) - (1 - k) * 420;
        g.globalCompositeOperation = 'lighter'; drawGlow(mx, my, 34, '#ff7a2f', 0.9); drawGlow(mx, my, 16, '#ffd35c', 1); g.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 2; i++) Particles.add({ x: mx + cam, y: my, vx: R(40, 120), vy: R(-200, -120), life: 0.3, size: 6, color: '#ff7a2f', glow: true });
      }
    }
    // lightning bolts
    g.globalCompositeOperation = 'lighter';
    for (const b of this.bolts) {
      g.strokeStyle = '#ffe45c'; g.lineWidth = 6; g.globalAlpha = Math.min(1, b.t * 10);
      g.beginPath(); b.pts.forEach(([x, y], i) => (i ? g.lineTo(x - cam, y) : g.moveTo(x - cam, y))); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.stroke();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    Particles.draw(cam, 0);
    Floaters.draw(cam, 0);
    this.bg.drawFront(cam, T);
    g.restore();
    // screen effects
    if (this.timeStop > 0) {
      g.globalCompositeOperation = 'saturation'; g.fillStyle = 'hsl(0,0%,50%)'; g.fillRect(0, 0, VIEW_W, VIEW_H);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = 'rgba(120,60,200,.18)'; g.fillRect(0, 0, VIEW_W, VIEW_H);
      drawHumanoid(g, h.x - cam, scrY(h.z, h.y), depthScale(h.z), h.face, h.look, computePose(h), {});
    }
    if (h.overdrive > 0) {
      const a = 0.15 + Math.sin(T * 10) * 0.05;
      const gr = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7);
      gr.addColorStop(0, 'rgba(255,197,61,0)'); gr.addColorStop(1, `rgba(255,197,61,${a})`);
      g.fillStyle = gr; g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (this.flashRed > 0) {
      const gr = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.75);
      gr.addColorStop(0, 'rgba(255,40,80,0)'); gr.addColorStop(1, `rgba(255,40,80,${this.flashRed * 1.4})`);
      g.fillStyle = gr; g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (h.hp < h.maxHp * 0.25 && !h.dead) {
      const a = 0.12 + Math.sin(T * 6) * 0.08;
      const gr = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.4, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.75);
      gr.addColorStop(0, 'rgba(255,0,40,0)'); gr.addColorStop(1, `rgba(255,0,40,${a})`);
      g.fillStyle = gr; g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (this.flashWhite > 0) { g.fillStyle = `rgba(255,255,255,${Math.min(0.8, this.flashWhite * 1.6)})`; g.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.letterbox > 0) {
      const lb = 56 * ease.outCubic(this.letterbox);
      g.fillStyle = '#000'; g.fillRect(0, 0, VIEW_W, lb); g.fillRect(0, VIEW_H - lb, VIEW_W, lb);
    }
    if (this.mode !== 'demo') drawHUD(this);
  }
}

// reuse a hero between Gauntlet stages: keep the build, reset the body
function carryHero(h, x, z) {
  h.x = x; h.z = z; h.y = 0; h.vx = h.vy = h.vz = 0;
  h.dead = false; h.remove = false; h.held = null;
  h.setState('idle'); h.inv = 1.2; h.overdrive = 0; h.attacking = false; h.activeHit = false; h.buffer = 0; h.comboStep = 0;
  h.st = { burn: 0, burnDps: 0, burnSrc: null, chill: 0, chillT: 0, frozen: 0, stun: 0, slowT: 0, shock: 0, poison: 0 };
  h.usedSecondWind = false; h.revives = skillRank('g5') ? 1 : 0; h.fall = 0; h.guard = 0;
  for (const sp of h.spells) sp.cd = 0;
  return h;
}
// ------------------------------------------------------------
//  Pip the Peddler: the wandering merchant (original character)
// ------------------------------------------------------------
const MERCHANT_LOOK = L({ build: BUILDS.small, skin: '#f2c39b', hairStyle: 'hood', hood: '#8a5a2b', hoodTrim: '#ffc53d', top: '#6b4424', top2: '#ffc53d', pants: '#4a3a28', shoes: '#2b1d14', weapon: 'none', blush: true, beard: '#e8e2d2' });
const MERCHANT_LINES = ['Psst! Upgrades! Barely used!', 'No refunds. No returns. No questions.', 'I take quarters, tokens and exact change.', 'This stew? Secret recipe. Mostly soup.', 'Boss ahead. Just saying. Buy something.', 'Found this floppy in a dragon. Still works!'];
function nearMerchant(s, h) { const m = s.merchant; return m && Math.abs(h.x - m.x) < 80 && Math.abs(h.z - m.z) < 60; }
function drawMerchant(s, cam) {
  const m = s.merchant, g = ctx;
  const x = m.x - cam, y = scrY(m.z, 0);
  if (x < -200 || x > VIEW_W + 200) return;
  const T = s.time;
  const h = s.hero;
  const face = h.x < m.x ? -1 : 1;
  const sc = depthScale(m.z) * 1.05;
  g.fillStyle = 'rgba(10,5,30,.3)'; g.beginPath(); g.ellipse(x, y, 34 * sc, 9 * sc, 0, 0, TAU); g.fill();
  // the enormous backpack
  g.save(); g.translate(x - face * 16 * sc, y - 40 * sc); g.scale(sc, sc);
  g.lineJoin = 'round'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
  g.fillStyle = '#a0703a'; roundRect(g, -26, -70, 52, 74, 12); g.fill(); g.stroke();
  g.fillStyle = '#7a5230'; g.fillRect(-26, -40, 52, 8); g.fillStyle = '#ffc53d'; g.fillRect(-4, -42, 8, 12);
  g.fillStyle = '#9aa3b5'; g.beginPath(); g.ellipse(-8, -76, 16, 9, 0, Math.PI, TAU); g.fill(); g.stroke(); // pot
  g.fillStyle = '#ffe45c'; g.beginPath(); g.ellipse(14, -80, 8, 6, 0, 0, TAU); g.fill(); g.stroke(); // rubber duck
  g.beginPath(); g.arc(18, -88, 5, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#ff8a2b'; g.fillRect(22, -89, 5, 3);
  g.fillStyle = '#2f6bd8'; g.save(); g.rotate(0.3); g.fillRect(10, -64, 14, 14); g.strokeRect(10, -64, 14, 14); g.restore(); // a floppy
  g.fillStyle = '#f1dfb3'; g.save(); g.rotate(-0.5); roundRect(g, -40, -60, 30, 9, 4); g.fill(); g.stroke(); g.restore(); // scroll
  g.restore();
  // Pip himself
  const pose = computePose({ anim: nearMerchant(s, h) ? 'win' : 'idle', animT: T, clock: T + 3, id: 7 });
  const look = Object.assign({}, MERCHANT_LOOK, { _t: T, _blink: T % 4 < 0.12 });
  drawHumanoid(g, x, y, sc, face, look, pose, {});
  // lantern on a stick
  const lx = x + face * 26 * sc, ly = y - 92 * sc + Math.sin(T * 2) * 2;
  g.strokeStyle = '#5a3a24'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + face * 18 * sc, y - 40 * sc); g.lineTo(lx, ly - 10); g.stroke();
  g.globalCompositeOperation = 'lighter'; drawGlow(lx, ly + 6, 30, '#ffd35c', 0.6); g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#ffd35c'; g.strokeStyle = OUTLINE; g.lineWidth = 2; roundRect(g, lx - 6, ly - 4, 12, 16, 3); g.fill(); g.stroke();
  // speech bubble & prompt
  const d = Math.abs(h.x - m.x);
  if (d < 320) {
    const line = MERCHANT_LINES[Math.floor(T / 4) % MERCHANT_LINES.length];
    g.font = `13px ${FONT_BODY}`;
    const w = g.measureText(line).width + 20;
    const bx = clamp(x - w / 2, 8, VIEW_W - w - 8), by = y - 150 * sc;
    g.fillStyle = '#fff4e2'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
    roundRect(g, bx, by - 26, w, 26, 10); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 6, by); g.lineTo(x, by + 10); g.lineTo(x + 6, by); g.fill();
    g.fillStyle = '#3a2410'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(line, bx + w / 2, by - 12);
  }
  if (nearMerchant(s, h)) {
    const txt = Input.touch ? 'Tap A to shop' : 'Press J to shop';
    g.font = `12px ${FONT_PIXEL}`; g.textAlign = 'center';
    g.fillStyle = 'rgba(10,6,28,.85)'; roundRect(g, x - 70, y + 8, 140, 22, 8); g.fill();
    g.fillStyle = Math.floor(T * 3) % 2 ? '#ffc53d' : '#fff4e2'; g.fillText(txt, x, y + 20);
  }
}
function shopOffers(s) {
  const L = s.diff, h = s.hero;
  const owned = h.spells.filter((sp) => sp.lvl < 5);
  return [
    { id: 'stew', name: 'Hearty Stew', icon: 'heart', color: '#ff4f73', desc: h.hp < h.maxHp ? 'Heal 60% of your HP.' : 'You are already at full HP.', cost: 10 + L * 3, ok: () => h.hp < h.maxHp, buy: () => h.heal(h.maxHp * 0.6) },
    { id: 'soda', name: 'Mana Soda', icon: 'crystal', color: '#55c8ff', desc: 'Refill MP and charge Overdrive by half.', cost: 8 + L * 2, buy: () => { h.mp = h.maxMp; h.od = Math.min(100, h.od + 50); } },
    { id: 'card', name: 'Mystery Card', icon: 'card4', color: '#b77cff', desc: 'Open a treasure draft of rare cards.', cost: 18 + L * 6, buy: () => { s.pendingChests++; } },
    { id: 'tune', name: 'Spell Tune-up', icon: 'up', color: '#ffc53d', desc: owned.length ? 'One of your spells gains a level.' : 'No spell can be tuned right now.', cost: 16 + L * 5, ok: () => owned.length > 0, buy: () => { const sp = pick(owned); sp.lvl++; h.cards[sp.id] = sp.lvl; Floaters.add(h.x, scrY(h.z, 150), SPELLS[sp.id].name + ' Lv ' + sp.lvl, { color: '#ffc53d', size: 18 }); } },
  ];
}
function drawShadow(f, cam) {
  if (f.hidden) {
    if (f.submerged) { const x = f.x - cam, y = scrY(f.z, 0); ctx.fillStyle = '#c99a5b'; ctx.beginPath(); ctx.ellipse(x, y, 40, 12, 0, Math.PI, TAU); ctx.fill(); }
    return;
  }
  const x = f.x - cam, y = scrY(f.z, 0);
  const s = depthScale(f.z) * f.scale;
  const hk = clamp(1 - f.y / 400, 0.3, 1);
  const w = (f.art === 'dragon' ? 120 : f.art === 'treant' ? 90 : f.art === 'bug' ? 130 : f.art === 'worm' ? 50 : 26 + f.w * 0.2) * s * hk;
  ctx.fillStyle = 'rgba(10,5,30,.32)';
  ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.28, 0, 0, TAU); ctx.fill();
}
function drawFighter(f, cam) {
  if (f.hidden) return;
  const x = f.x - cam;
  if (x < -300 || x > VIEW_W + 300) return;
  const y = scrY(f.z, f.y);
  const sc = depthScale(f.z) * f.scale;
  const g = ctx;
  const fx = { flash: f.flash > 0, tint: f.st.frozen > 0 ? '#9fe6ff' : f.st.poison > 0 ? '#8dff5a' : f.isHero && f.overdrive > 0 ? '#ffe7a0' : null };
  let alpha = 1;
  if (f.state === 'dead' && !f.isHero) alpha = Math.max(0, 1 - Math.max(0, f.stateT - 0.8) / 0.6);
  if (f.isHero && f.inv > 0 && f.state !== 'dash' && Math.floor(f.inv * 16) % 2) alpha *= 0.45;
  if (f.def.phase && Math.sin(f.clock * 2) > 0.6) alpha *= 0.5;
  g.globalAlpha = alpha;
  // boss / elite aura
  if ((f.isElite || f.isBoss) && !f.dead) {
    g.globalCompositeOperation = 'lighter';
    drawGlow(x, y - f.h * 0.45 * depthScale(f.z), f.h * 0.6 * depthScale(f.z), f.enraged ? '#ff4f73' : f.mods.includes('shielded') ? '#55c8ff' : f.mods.includes('vampiric') ? '#b0002a' : f.mods.includes('explosive') ? '#ff7a2f' : '#b77cff', 0.35 + Math.sin(f.clock * 4) * 0.1);
    g.globalCompositeOperation = 'source-over';
  }
  if (f.isHero && f.overdrive > 0) { g.globalCompositeOperation = 'lighter'; drawGlow(x, y - 55 * sc, 90 * sc, '#ffc53d', 0.5); g.globalCompositeOperation = 'source-over'; }
  if (f.art === 'human') {
    const pose = computePose(f);
    drawHumanoid(g, x, y, sc, f.face, f.look, pose, fx);
    if (f.look.chestText) {
      // label on a shirt (Big Mike's STAFF tee)
      g.save(); g.fillStyle = '#ffc53d'; g.font = `bold ${Math.round(9 * sc)}px ${FONT_PIXEL}`; g.textAlign = 'center';
      g.fillText(f.look.chestText, x + f.face * 3 * sc, y - 58 * sc); g.restore();
    }
    if (f.look.headphones) {
      const hy = y - (BUILDS.thin.leg * 2 + BUILDS.thin.torso + 16) * sc;
      g.strokeStyle = '#ff4f73'; g.lineWidth = 3 * sc; g.beginPath(); g.arc(x + f.face * 2 * sc, hy, 18 * sc, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.fillStyle = '#ff4f73'; g.beginPath(); g.arc(x - f.face * 12 * sc, hy + 4 * sc, 5 * sc, 0, TAU); g.fill();
      if (Math.random() < 0.02) Particles.add({ x: f.x, y: hy - 20, vy: -40, vx: R(-20, 20), life: 1, size: 4, color: '#ff9fd0', type: 'note' });
    }
  } else {
    const col = (c) => (fx.flash ? '#ffffff' : fx.tint ? mix(c, fx.tint, 0.55) : c);
    g.save(); g.translate(x, y); g.scale(f.face * sc, sc);
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (f.state === 'dead' || f.state === 'down') { g.rotate(-0.25); }
    if (f.anim === 'hurt' || f.anim === 'air') g.rotate(-0.15);
    if (f.state === 'spawn') g.scale(1, ease.outBack(Math.min(1, f.stateT / 0.4)));
    const art = f.art === 'cow' && f.look.crown ? 'cow' : f.art;
    MonsterArt[art](g, f, f.look, fx, col);
    if (f.art === 'cow' && f.look.crown) { g.fillStyle = '#ffc53d'; g.strokeStyle = OUTLINE; g.lineWidth = 2; g.beginPath(); g.moveTo(30, -66); g.lineTo(28, -84); g.lineTo(36, -74); g.lineTo(40, -88); g.lineTo(44, -74); g.lineTo(52, -84); g.lineTo(48, -66); g.closePath(); g.fill(); g.stroke(); }
    g.restore();
  }
  g.globalAlpha = 1;
  // frozen overlay
  if (f.st.frozen > 0) {
    const hh = f.h * depthScale(f.z) * (f.art === 'human' ? 1.05 : 1);
    const ww = Math.max(40, f.w * 1.5) * depthScale(f.z);
    g.fillStyle = 'rgba(160,230,255,.45)'; g.strokeStyle = 'rgba(230,251,255,.9)'; g.lineWidth = 2;
    roundRect(g, x - ww / 2, y - hh, ww, hh + 4, 6); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x - ww / 2 + 5, y - hh + 5, 4, hh * 0.6);
  }
  // stun stars / slow clock
  if (f.state === 'stun' || (f.st.shock > 0 && !f.dead)) {
    for (let i = 0; i < 3; i++) { const a = f.clock * 5 + i * TAU / 3; g.fillStyle = '#ffe45c'; starPath(g, x + Math.cos(a) * 18, y - f.h * depthScale(f.z) - 8 + Math.sin(a) * 5, 5, 2.2, 5); g.fill(); }
  }
  if (f.st.slowT > 0 && !f.dead) { drawIcon(g, 'clock', x + 18, y - f.h * depthScale(f.z) - 6, 8, '#c58cff'); }
  if (f.shield > 0) { g.strokeStyle = 'rgba(85,200,255,.8)'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y - f.h * 0.5 * sc, f.w * sc, f.h * 0.6 * sc, 0, 0, TAU); g.stroke(); }
  // enemy hp bar
  if (!f.isHero && !f.isBoss && !f.dead && f.hp < f.maxHp) {
    const bw = f.isElite ? 60 : 40, by = y - f.h * sc - 14;
    g.fillStyle = 'rgba(10,5,30,.7)'; g.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 6);
    g.fillStyle = f.isElite ? '#b77cff' : '#ff4f73'; g.fillRect(x - bw / 2, by, bw * (f.hp / f.maxHp), 4);
    if (f.shield > 0) { g.fillStyle = '#55c8ff'; g.fillRect(x - bw / 2, by - 3, bw * Math.min(1, f.shield / (f.maxHp * 0.4)), 2); }
  }
  if (f.isElite && !f.isBoss && !f.dead) {
    g.font = `10px ${FONT_PIXEL}`; g.textAlign = 'center'; g.fillStyle = '#e0c8ff';
    g.fillText((f.mods[0] || 'elite').toUpperCase(), x, y - f.h * sc - 20);
  }
  // attack tell for bosses/elites
  if (!f.isHero && f.state === 'attack' && f.move && f.stateT < f.move.windup && (f.isBoss || f.isElite)) {
    g.fillStyle = '#ff4f73'; g.font = `bold 20px ${FONT_DISPLAY}`; g.textAlign = 'center'; g.fillText('!', x, y - f.h * sc - 26);
  }
  if (f.isHero && f.held) drawPropSprite(g, f.held.kind, x, y - 118 * sc);
}
function drawDecal(d, cam) {
  const x = d.x - cam, y = scrY(d.z, 0);
  const a = Math.min(1, (d.life - d.t));
  ctx.globalAlpha = a;
  if (d.kind === 'crack') {
    ctx.strokeStyle = 'rgba(40,20,10,.6)'; ctx.lineWidth = 3;
    const r = makeRng(Math.floor(d.x));
    for (let i = 0; i < 7; i++) { const an = i / 7 * TAU; ctx.beginPath(); ctx.moveTo(x, y); let px = x, py = y; for (let k = 0; k < 3; k++) { px += Math.cos(an + r.range(-0.4, 0.4)) * 30; py += Math.sin(an + r.range(-0.4, 0.4)) * 12; ctx.lineTo(px, py); } ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------
//  HUD
// ------------------------------------------------------------
function drawHUD(s) {
  const g = ctx;
  const h = s.hero;
  const k = View.hud;
  g.save();
  g.scale(k, k);
  const W = VIEW_W / k, Hh = VIEW_H / k;
  // --- hero panel
  const px = 14, py = 12;
  g.fillStyle = 'rgba(10,6,28,.72)'; roundRect(g, px, py, 268, 70, 14); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.stroke();
  // portrait
  g.save(); g.beginPath(); g.arc(px + 34, py + 35, 26, 0, TAU); g.fillStyle = '#2b2266'; g.fill(); g.clip();
  g.translate(px + 34, py + 40);
  drawHead(g, 17, h.look, Object.assign(basePose(), { eyes: h.dead ? 'ko' : h.hp < h.maxHp * 0.3 ? 'hurt' : s.combo > 20 ? 'angry' : 'normal', mouth: s.combo > 20 ? 'grin' : 'line' }), (c) => c, {});
  g.restore();
  g.strokeStyle = '#ffc53d'; g.lineWidth = 3; g.beginPath(); g.arc(px + 34, py + 35, 26, 0, TAU); g.stroke();
  // level badge
  g.fillStyle = '#ffc53d'; g.beginPath(); g.arc(px + 54, py + 56, 12, 0, TAU); g.fill();
  g.fillStyle = '#2a1600'; g.font = `11px ${FONT_DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(h.level, px + 54, py + 57);
  // bars
  const bx = px + 70, bw = 186;
  bar(g, bx, py + 10, bw, 16, h.hp / h.maxHp, '#ff4f73', '#ff99ad', `${Math.ceil(Math.max(0, h.hp))}/${h.maxHp}`, s.hpChip ?? (s.hpChip = h.hp / h.maxHp));
  s.hpChip = Math.max(h.hp / h.maxHp, (s.hpChip || 0) - 0.006);
  bar(g, bx, py + 30, bw, 11, h.mp / h.maxMp, '#55c8ff', '#b8ecff', null);
  // xp bar
  g.fillStyle = 'rgba(255,255,255,.1)'; roundRect(g, bx, py + 46, bw, 6, 3); g.fill();
  g.fillStyle = '#3ee6a8'; roundRect(g, bx, py + 46, bw * clamp(h.xp / h.xpNext, 0, 1), 6, 3); g.fill();
  // overdrive meter
  const odFull = h.od >= 100;
  g.fillStyle = 'rgba(255,255,255,.1)'; roundRect(g, bx, py + 56, bw, 6, 3); g.fill();
  g.fillStyle = h.overdrive > 0 ? '#fff4c2' : odFull ? (Math.floor(s.time * 6) % 2 ? '#ffc53d' : '#fff4c2') : '#d98a12';
  roundRect(g, bx, py + 56, bw * (h.overdrive > 0 ? h.overdrive / 6 : h.od / 100), 6, 3); g.fill();
  if (odFull && h.overdrive <= 0) { g.fillStyle = '#ffc53d'; g.font = `9px ${FONT_PIXEL}`; g.textAlign = 'left'; g.fillText(Input.touch ? 'OVERDRIVE READY ★' : 'OVERDRIVE READY [SPACE]', bx, py + 72); }
  if (s.mode === 'typing') { drawBanners(s, g, W, Hh); g.restore(); return; }
  // --- right side: quarters & timer
  g.textAlign = 'right'; g.textBaseline = 'middle';
  const rx = W - 70;
  g.fillStyle = 'rgba(10,6,28,.72)'; roundRect(g, rx - 150, py, 150, 34, 12); g.fill();
  g.fillStyle = '#ffc53d'; g.beginPath(); g.arc(rx - 132, py + 17, 9, 0, TAU); g.fill();
  g.fillStyle = '#fff4e2'; g.font = `15px ${FONT_PIXEL}`; g.fillText(fmt(s.quarters), rx - 10, py + 18);
  const secs = Math.floor(s.time);
  g.textAlign = 'left'; g.fillStyle = '#b9acdf'; g.font = `11px ${FONT_PIXEL}`;
  g.fillText(`${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`, rx - 112, py + 18);
  if (s.cheated) { g.fillStyle = '#00ff7b'; g.fillText('CHEATER', rx - 148, py + 46); }
  // section / wave progress
  if (s.mode === 'level') {
    const n = s.sections; const cx = W / 2 - (n - 1) * 11;
    for (let i = 0; i < n; i++) { g.fillStyle = i < s.secIdx ? '#3ee6a8' : i === s.secIdx ? '#ffc53d' : 'rgba(255,255,255,.25)'; g.beginPath(); if (i === n - 1) { starPath(g, cx + i * 22, py + 14, 8, 3.5, 5); } else g.arc(cx + i * 22, py + 14, 5, 0, TAU); g.fill(); }
  } else if (s.mode === 'endless') {
    g.textAlign = 'center'; g.fillStyle = '#ffc53d'; g.font = `16px ${FONT_DISPLAY}`; g.fillText('WAVE ' + s.wave, W / 2, py + 16);
  }
  // GO arrow
  if (s.unlocked && Math.floor(s.time * 3) % 2) {
    g.fillStyle = '#3ee6a8'; g.font = `28px ${FONT_DISPLAY}`; g.textAlign = 'right'; g.fillText('GO ▶', W - 24, Hh * 0.42);
  }
  // combo counter
  if (s.combo >= 3) {
    const rk = comboRank(s.combo);
    const pulse = 1 + Math.max(0, s.comboT - 2.2) * 2;
    g.save(); g.translate(W - 30, Hh * 0.3); g.scale(pulse, pulse);
    g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.font = `44px ${FONT_DISPLAY}`; g.lineWidth = 6; g.strokeStyle = '#1a0f2e'; g.strokeText(s.combo, 0, 0); g.fillStyle = rk.c; g.fillText(s.combo, 0, 0);
    g.font = `13px ${FONT_PIXEL}`; g.fillStyle = '#fff'; g.strokeText('HITS', 0, 16); g.fillText('HITS', 0, 16);
    if (rk.r) { g.font = `30px ${FONT_DISPLAY}`; g.strokeText(rk.r, -86, -4); g.fillStyle = rk.c; g.fillText(rk.r, -86, -4); g.font = `10px ${FONT_PIXEL}`; g.fillStyle = '#fff'; g.fillText(RANK_WORDS[rk.r], -86, 12); }
    // decay bar
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-100, 24, 100, 3); g.fillStyle = rk.c; g.fillRect(-100 * (s.comboT / 2.4), 24, 100 * (s.comboT / 2.4), 3);
    g.restore();
  }
  // spell slots (desktop)
  if (!Input.touch) {
    const sx0 = 16, sy0 = Hh - 62;
    const keys = ['U', 'I', 'O'];
    const seqs = ['D→A', 'D↑A', 'D↓A'];
    for (let i = 0; i < 3; i++) {
      const sp = h.spells[i];
      const x = sx0 + i * 60;
      g.fillStyle = 'rgba(10,6,28,.72)'; roundRect(g, x, sy0, 52, 52, 12); g.fill();
      if (sp) {
        const d = SPELLS[sp.id];
        drawIcon(g, d.icon, x + 26, sy0 + 26, 20, EL[d.el].c);
        if (sp.cd > 0 || h.mp < d.cost) {
          g.fillStyle = 'rgba(10,6,28,.65)';
          const frac = sp.cd > 0 ? sp.cd / (d.cd * h.stats.cdMul) : 1;
          g.beginPath(); g.moveTo(x + 26, sy0 + 26); g.arc(x + 26, sy0 + 26, 22, -Math.PI / 2, -Math.PI / 2 + TAU * frac); g.closePath(); g.fill();
        }
        g.fillStyle = '#ffc53d'; g.font = `9px ${FONT_PIXEL}`; g.textAlign = 'right'; g.fillText(sp.lvl > 5 || d.evo ? '★' : 'Lv' + sp.lvl, x + 50, sy0 + 46);
      }
      g.fillStyle = '#b9acdf'; g.font = `9px ${FONT_PIXEL}`; g.textAlign = 'left'; g.fillText(keys[i] + ' ' + seqs[i], x + 2, sy0 - 6);
    }
  }
  // boss bar
  const liveBosses = s.bosses.filter((b) => !b.dead);
  if (liveBosses.length && !s.bossIntro) {
    const tot = s.bosses.reduce((a, b) => a + Math.max(0, b.hp), 0), max = s.bosses.reduce((a, b) => a + b.maxHp, 0);
    const bw2 = Math.min(560, W - 120), bx2 = W / 2 - bw2 / 2, by2 = Hh - (Input.touch && !View.portrait ? 140 : 44);
    g.fillStyle = 'rgba(10,6,28,.8)'; roundRect(g, bx2 - 8, by2 - 22, bw2 + 16, 40, 10); g.fill();
    g.fillStyle = '#fff4e2'; g.font = `12px ${FONT_DISPLAY}`; g.textAlign = 'left'; g.fillText(liveBosses[0].def.name.toUpperCase(), bx2, by2 - 10);
    bar(g, bx2, by2, bw2, 10, tot / max, liveBosses[0].enraged ? '#ff4f73' : '#b77cff', '#e0c8ff', null, s.bossChip ?? (s.bossChip = 1));
    s.bossChip = Math.max(tot / max, s.bossChip - 0.004);
  }
  // boss intro card
  if (s.bossIntro) {
    const bi = s.bossIntro;
    const t = bi.t;
    const kx = ease.outCubic(clamp(t / 0.5, 0, 1));
    g.save();
    g.translate(lerp(-W, 0, kx), 0);
    g.fillStyle = bi.elite ? 'rgba(90,40,160,.9)' : 'rgba(180,20,60,.9)';
    g.beginPath(); g.moveTo(0, Hh * 0.62); g.lineTo(W * 0.72, Hh * 0.62); g.lineTo(W * 0.66, Hh * 0.8); g.lineTo(0, Hh * 0.8); g.fill();
    g.fillStyle = '#fff'; g.font = `${bi.elite ? 30 : 38}px ${FONT_DISPLAY}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(bi.def.name.toUpperCase(), 30, Hh * 0.67);
    g.font = `15px ${FONT_BODY}`; g.fillStyle = '#ffe9f0'; g.fillText(bi.def.title, 32, Hh * 0.75);
    g.restore();
  }
  drawBanners(s, g, W, Hh);
  // tutorial hints on level 1
  drawHints(s, g, W, Hh);
  g.restore();
}
function drawBanners(s, g, W, Hh) {
  for (const b of s.banners) {
    const t = b.t / b.dur;
    const sc = b.big ? ease.outBack(Math.min(1, b.t / 0.3)) : 1;
    const a = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
    g.save(); g.globalAlpha = a; g.translate(W / 2, Hh * 0.4); g.scale(sc, sc);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const size = b.big ? Math.min(64, W / (b.text.length * 0.75)) : Math.min(34, W / (b.text.length * 0.7));
    g.font = `${size}px ${FONT_DISPLAY}`;
    g.lineWidth = 10; g.strokeStyle = '#1a0f2e'; g.lineJoin = 'round'; g.strokeText(b.text, 0, 0);
    g.fillStyle = b.color; g.fillText(b.text, 0, 0);
    g.restore();
  }
}
function drawHints(s, g, W, Hh) {
  if (s.mode === 'level' && s.level.n === 1 && s.time < 16 && SAVE.settings.hints) {
    const a = Math.min(1, (16 - s.time) / 2, s.time / 1);
    g.globalAlpha = a;
    const lines = Input.touch
      ? ['Left thumb: move · push fully to run', 'A attack · J jump · D defend', 'Spell buttons cast magic · ★ overdrive']
      : ['WASD / Arrows move · double-tap to run', 'J attack · K jump · L defend', 'Spells: U I O  or  L+→+J (LF2 style!)'];
    g.fillStyle = 'rgba(10,6,28,.75)'; roundRect(g, W / 2 - 200, Hh * 0.18, 400, 76, 12); g.fill();
    g.fillStyle = '#fff4e2'; g.font = `14px ${FONT_BODY}`; g.textAlign = 'center';
    lines.forEach((l, i) => g.fillText(l, W / 2, Hh * 0.18 + 18 + i * 20));
    g.globalAlpha = 1;
  }
}
function bar(g, x, y, w, hh, frac, c1, c2, label, chip) {
  frac = clamp(frac, 0, 1);
  g.fillStyle = 'rgba(0,0,0,.45)'; roundRect(g, x, y, w, hh, hh / 2); g.fill();
  if (chip != null && chip > frac) { g.fillStyle = '#fff4e2'; roundRect(g, x, y, w * clamp(chip, 0, 1), hh, hh / 2); g.fill(); }
  if (frac > 0) {
    const gr = g.createLinearGradient(0, y, 0, y + hh);
    gr.addColorStop(0, c2); gr.addColorStop(0.5, c1); gr.addColorStop(1, shade(c1, -0.25));
    g.fillStyle = gr; roundRect(g, x, y, Math.max(hh, w * frac), hh, hh / 2); g.fill();
  }
  if (label) { g.fillStyle = '#fff'; g.font = `10px ${FONT_PIXEL}`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(label, x + w - 6, y + hh / 2 + 1); }
}

// ------------------------------------------------------------
//  Cards (drafts)
// ------------------------------------------------------------
function heroElements(h) {
  const els = new Set();
  for (const s of h.spells) els.add(SPELLS[s.id].el);
  for (const k of ['wpn_fire', 'wpn_ice', 'wpn_earth', 'wpn_storm', 'wpn_time']) if (h.cards[k]) els.add(k.slice(4));
  for (const k in PASSIVES) if (h.cards[k] && PASSIVES[k].el !== 'phys') els.add(PASSIVES[k].el);
  return els;
}
function makeDraft(h, chest) {
  const c = h.cards;
  const pool = [];
  const luck = 1 + skillRank('f4') * 0.25 + (chest ? 2 : 0);
  // spells
  for (const id of BASE_SPELLS) {
    const def = SPELLS[id];
    const owned = h.spells.find((s) => s.id === id);
    if (owned) {
      if (owned.lvl < 5) pool.push({ id, kind: 'spellUp', rarity: def.rarity, w: 1.3, lvl: owned.lvl + 1 });
      else if (def.evolve && !h.spells.find((s) => s.id === def.evolve)) pool.push({ id: def.evolve, base: id, kind: 'evolve', rarity: 'legendary', w: 3 });
    } else if (h.spells.length < 3) pool.push({ id, kind: 'spellNew', rarity: def.rarity, w: 0.8, lvl: 1 });
  }
  for (const id in PASSIVES) { const d = PASSIVES[id]; if ((c[id] || 0) < d.max) pool.push({ id, kind: 'passive', rarity: d.rarity, w: 1, lvl: (c[id] || 0) + 1 }); }
  for (const id in WEAPON_CARDS) { const d = WEAPON_CARDS[id]; if ((c[id] || 0) < d.max) pool.push({ id, kind: 'weapon', rarity: d.rarity, w: id.startsWith('wpn_') && d.max === 1 ? 0.6 : 1.1, lvl: (c[id] || 0) + 1 }); }
  const els = heroElements(h);
  for (const id in DUOS) { const d = DUOS[id]; if (!c[id] && d.els.every((e) => els.has(e))) pool.push({ id, kind: 'duo', rarity: 'epic', w: 2.5 }); }
  const n = skillRank('f5') ? 4 : 3;
  const out = [];
  const rw = (card) => RARITY[card.rarity].w * card.w * (card.rarity !== 'common' ? luck : chest ? 0.3 : 1);
  while (out.length < n && pool.length) {
    const card = weightedPick(pool, rw);
    out.push(card);
    pool.splice(pool.indexOf(card), 1);
  }
  while (out.length < n) out.push(out.length % 2 ? { id: 'quarters', kind: 'filler', rarity: 'common' } : { id: 'milk', kind: 'filler', rarity: 'common' });
  // Glitch hero: one card is always a total surprise
  if (h.hdef.id === 'glitch' && out.length) out[out.length - 1].glitched = true;
  return out;
}
function cardInfo(card) {
  switch (card.kind) {
    case 'spellUp': case 'spellNew': { const d = SPELLS[card.id]; return { name: d.name, icon: d.icon, color: EL[d.el].c, el: d.el, desc: d.desc(card.lvl), tag: card.kind === 'spellNew' ? 'NEW SPELL · ' + d.input : 'SPELL', lvl: card.lvl }; }
    case 'evolve': { const d = SPELLS[card.id]; return { name: d.name, icon: d.icon, color: EL[d.el].c, el: d.el, desc: d.desc(), tag: 'EVOLUTION', lvl: null }; }
    case 'passive': { const d = PASSIVES[card.id]; return { name: d.name, icon: d.icon, color: EL[d.el].c === '#ffffff' ? '#ffc53d' : EL[d.el].c, el: d.el, desc: d.desc(card.lvl), tag: 'RELIC', lvl: card.lvl }; }
    case 'weapon': { const d = WEAPON_CARDS[card.id]; return { name: d.name, icon: d.icon, color: d.el ? EL[d.el].c : '#c9c3de', el: d.el || 'phys', desc: d.desc(), tag: 'WEAPON', lvl: card.lvl }; }
    case 'duo': { const d = DUOS[card.id]; return { name: d.name, icon: d.icon, color: '#b77cff', el: d.els.join('+'), desc: d.desc(), tag: 'DUO · ' + d.els.map((e) => EL[e].name).join(' + '), lvl: null }; }
    case 'filler': { const d = FILLER[card.id]; return { name: d.name, icon: d.icon, color: '#3ee6a8', desc: d.desc(), tag: 'SNACK', lvl: null }; }
  }
}
function applyCard(h, card) {
  if (card.glitched) {
    // the glitch card rolls something random from the whole pool
    const alt = makeDraft(Object.assign(Object.create(Object.getPrototypeOf(h)), h, { hdef: HEROES.rook }), false);
    card = pick(alt);
    Floaters.add(h.x, scrY(h.z, 160), 'GL1TCH3D!', { color: '#ff3df2', size: 20 });
  }
  const c = h.cards;
  switch (card.kind) {
    case 'spellNew': h.spells.push({ id: card.id, lvl: 1, cd: 0 }); c[card.id] = 1; break;
    case 'spellUp': { const s = h.spells.find((x) => x.id === card.id); if (s) s.lvl++; c[card.id] = s ? s.lvl : 1; break; }
    case 'evolve': {
      const s = h.spells.find((x) => x.id === card.base);
      if (s) { s.id = card.id; s.lvl = 6; s.cd = 0; }
      c[card.id] = 1;
      unlockAch('evolve');
      S.banner('EVOLVED: ' + SPELLS[card.id].name.toUpperCase(), '#ffc53d', 1.6);
      break;
    }
    case 'passive': case 'weapon': c[card.id] = (c[card.id] || 0) + 1; break;
    case 'duo': c[card.id] = 1; break;
    case 'filler': if (card.id === 'milk') h.heal(h.maxHp * 0.4); else S.quarters += 25; break;
  }
  if (card.id === 'heartUp') h.heal(20);
  h.recalc();
  Sfx.play('levelup');
  for (let i = 0; i < 30; i++) Particles.add({ x: h.x + R(-30, 30), y: scrY(h.z, R(0, 120)), vy: R(-200, -60), vx: R(-40, 40), life: 0.9, size: 5, color: pick(['#ffc53d', '#3ee6a8', '#fff']), type: 'star' });
}
