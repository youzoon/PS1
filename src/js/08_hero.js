// ============================================================
//  Hero: stats, leveling, controls, spells
// ============================================================
function makeHero(heroId, x, z) {
  const def = HEROES[heroId];
  const f = new Fighter({ team: 'hero', kind: heroId, def: { art: 'human', look: def.look, w: 34, h: 104, weight: def.weight }, x, z, hp: def.hp, speed: def.speed });
  f.hdef = def;
  f.weaponType = WEAPON_TYPES[def.weapon];
  f.cards = {};         // card id -> level
  f.spells = [];        // [{id, lvl, cd}]
  f.level = 1; f.xp = 0; f.xpNext = xpForLevel(1);
  f.overdrive = 0; f.od = 0;
  f.comboStep = 0;
  f.revives = (skillRank('g5') ? 1 : 0);
  f.secondWind = 0;
  f.wpnLevel = 0; f.wpnTier = 1;
  f.guard = 0;
  f.look = Object.assign({}, def.look);
  Object.assign(f, HeroMixin);
  f.recalc();
  f.hp = f.maxHp; f.mp = f.maxMp;
  // starting spell
  let sp = def.spell;
  if (sp === 'random') sp = pick(BASE_SPELLS);
  f.spells.push({ id: sp, lvl: skillRank('a4') ? 2 : 1, cd: 0 });
  f.cards[sp] = f.spells[0].lvl;
  return f;
}
const xpForLevel = (n) => Math.round(8 + n * 6 + Math.pow(n, 1.55) * 2);

const HeroMixin = {
  recalc() {
    const d = this.hdef, c = this.cards;
    const lv = (k) => c[k] || 0;
    const oldMax = this.maxHp || 0;
    this.maxHp = d.hp + skillRank('g1') * 10 + lv('heartUp') * 20;
    this.maxMp = d.mp + skillRank('a1') * 12 + lv('manaCrystal') * 15;
    if (oldMax && this.maxHp > oldMax) this.hp += this.maxHp - oldMax;
    const wd = lv('wpn_dmg'), ws = lv('wpn_speed'), wr = lv('wpn_reach');
    this.stats = {
      dmgMul: 1 + skillRank('m1') * 0.06 + lv('might') * 0.08,
      wpnMul: 1 + wd * 0.18,
      spellMul: 1 + skillRank('a3') * 0.12,
      critChance: 0.05 + skillRank('m2') * 0.03 + lv('lucky') * 0.06,
      critMul: 1.8,
      speedMul: 1 + lv('boots') * 0.08,
      atkSpeed: 1 + ws * 0.12,
      reach: 1 + wr * 0.15,
      blockMul: 0.2 - skillRank('g2') * 0.05,
      foodMul: 1 + skillRank('g3') * 0.25,
      regen: skillRank('g4') * 0.6,
      mpRegen: d.mpRegen * (1 + skillRank('a2') * 0.12 + lv('manaCrystal') * 0.2),
      lifesteal: lv('vampire') * 0.02,
      thorns: lv('thorns') ? 0.2 + lv('thorns') * 0.2 : 0,
      magnet: 90 * (1 + lv('magnet') * 0.6),
      xpMul: 1 + skillRank('f2') * 0.08,
      qMul: 1 + skillRank('f1') * 0.1,
      finisherMul: 1 + skillRank('m3') * 0.2,
      berserk: skillRank('m4') * 0.15,
      odRate: 1 + skillRank('a5') * 0.25,
      echo: lv('echo') * 0.12,
      cdMul: c.duo_deja ? 0.75 : 1,
    };
    this.speed = d.speed * this.stats.speedMul;
    // weapon tier visuals
    this.wpnLevel = Object.keys(WEAPON_CARDS).reduce((a, k) => a + lv(k), 0);
    const tier = this.wpnLevel >= 6 ? 3 : this.wpnLevel >= 3 ? 2 : 1;
    if (tier !== this.wpnTier && this.level > 1) {
      Floaters.add(this.x, scrY(this.z, 150), 'WEAPON UP!', { color: '#ffc53d', size: 26, life: 1.4 });
      Floaters.add(this.x, scrY(this.z, 120), this.weaponType.names[tier - 1], { color: '#fff', size: 16, font: FONT_BODY, life: 1.4 });
      Sfx.play('levelup');
      if (tier === 3) unlockAch('wpnmax');
    }
    this.wpnTier = tier;
    const wt = this.weaponType;
    this.look.wpnTier = tier;
    this.look.wpnColor = wt.colors[tier - 1];
    this.look.wpnGlow = wt.glow[tier - 1] || (c.wpn_fire ? '#ff7a2f' : c.wpn_ice ? '#7fe3ff' : c.wpn_storm ? '#ffe45c' : c.wpn_time ? '#c58cff' : null);
    if (this.hdef.weapon === 'gauntlets') this.look.gloves = wt.colors[tier - 1];
    if (this.mp > this.maxMp) this.mp = this.maxMp;
  },
  baseDmg() {
    const wt = this.weaponType;
    return (wt.dmg[0] + (this.hdef.id === 'bruno' ? 3 : 0)) * this.stats.wpnMul;
  },
  heal(n, quiet) {
    if (this.dead) return;
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    if (!quiet && this.hp > before) for (let i = 0; i < 8; i++) Particles.add({ x: this.x + R(-20, 20), y: scrY(this.z, R(10, 90)), vy: R(-80, -30), life: 0.8, size: 4, color: '#3ee6a8', type: 'star' });
  },
  gainXp(n) {
    const rank = comboRank(S.combo);
    this.xp += n * this.stats.xpMul * (1 + rank.bonus);
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpForLevel(this.level);
      S.pendingLevels++;
      if (this.level >= 15) unlockAch('lvl15');
    }
  },
  addOverdrive(n) {
    if (this.overdrive > 0) return;
    this.od = Math.min(100, this.od + n * 0.35 * this.stats.odRate);
  },
  triggerOverdrive() {
    if (this.od < 100 || this.overdrive > 0 || this.dead) return;
    this.od = 0; this.overdrive = 6;
    Sfx.play('overdrive'); S.shake(10);
    S.banner('OVERDRIVE!', '#ffc53d', 1.2);
    Sfx.setMusicRate(1.25);
    unlockAch('overdrive');
    for (let i = 0; i < 40; i++) Particles.add({ x: this.x, y: scrY(this.z, 50), vx: R(-500, 500), vy: R(-500, 300), life: 0.8, size: 6, color: pick(['#ffc53d', '#fff4c2']), glow: true });
  },
  tickHero(dt) {
    if (this.dead) return;
    this.mp = Math.min(this.maxMp, this.mp + this.stats.mpRegen * dt);
    if (this.stats.regen) this.heal(this.stats.regen * dt, true);
    for (const s of this.spells) if (s.cd > 0) s.cd -= dt;
    if (this.overdrive > 0) {
      this.overdrive -= dt;
      if (Math.random() < dt * 30) Particles.add({ x: this.x + R(-20, 20), y: scrY(this.z, R(0, 110)), vy: R(-120, -40), life: 0.5, size: 5, color: '#ffc53d', glow: true });
      if (this.overdrive <= 0) Sfx.setMusicRate(1);
    }
    if (this.guard > 0) this.guard = Math.max(0, this.guard - dt * 20);
    this.passives(dt);
  },
  passives(dt) {
    const c = this.cards;
    if (c.fireAura) {
      this.auraT = (this.auraT || 0) - dt;
      const r = 70 + c.fireAura * 12;
      if (this.auraT <= 0) {
        this.auraT = 0.5;
        for (const e of S.enemies) if (!e.dead && Math.abs(e.x - this.x) < r && Math.abs(e.z - this.z) < r * 0.45) dealDamage(this, e, { dmg: 3 + c.fireAura * 2, el: 'fire', dot: true, spell: true });
      }
      if (Math.random() < dt * 25) { const a = R(0, TAU); Particles.add({ x: this.x + Math.cos(a) * r, y: scrY(this.z + Math.sin(a) * r * 0.4, 0), vy: R(-60, -20), life: 0.5, size: 4, color: pick(['#ff7a2f', '#ffd35c']), glow: true }); }
    }
    if (c.iceOrbit) {
      const n = 1 + c.iceOrbit;
      this.orbitA = (this.orbitA || 0) + dt * 3.2;
      this.orbs = [];
      for (let i = 0; i < n; i++) {
        const a = this.orbitA + i * TAU / n;
        const ox = this.x + Math.cos(a) * 70, oz = this.z + Math.sin(a) * 30;
        this.orbs.push({ x: ox, z: oz, a });
        for (const e of S.enemies) {
          if (e.dead || Math.abs(e.x - ox) > 22 + e.w * 0.4 || Math.abs(e.z - oz) > 22) continue;
          e.orbHit = e.orbHit || 0;
          if (S.time - e.orbHit > 0.6) { e.orbHit = S.time; dealDamage(this, e, { dmg: 6 + c.iceOrbit * 3, el: 'ice', kx: 60, fall: 10, stop: 0.02, spell: true }); }
        }
      }
    } else this.orbs = null;
    if (c.staticField) {
      this.staticT = (this.staticT || 0) - dt;
      if (this.staticT <= 0) {
        this.staticT = 2.2 - c.staticField * 0.3;
        const tgt = nearestEnemy(this.x, this.z, 280);
        if (tgt) chainLightning(this, tgt, 0, 8 + c.staticField * 4, 0, []);
      }
    }
  },
};

// ------------------------------------------------------------
//  Hero input handling
// ------------------------------------------------------------
function heroControl(h, dt) {
  if (h.dead) return;
  const P = Input.pressed, H = Input.held;
  const mv = Input.moveVec();
  if (P.od) h.triggerOverdrive();
  // LF2 style D→A / D↑A / D↓A, or direct spell buttons
  let slot = null;
  const sp = Input.consumeSpecial();
  if (sp) slot = sp.slot;
  if (P.s1) slot = 's1'; else if (P.s2) slot = 's2'; else if (P.s3) slot = 's3';
  const free = h.canAct() && h.st.frozen <= 0;
  if (slot && (free || h.state === 'attack' && h.stateT > (h.move ? h.move.windup + h.move.active : 0))) {
    if (sp && sp.dir) h.face = sp.dir;
    else if (mv.x) h.face = sign(mv.x);
    if (castSpell(h, { s1: 0, s2: 1, s3: 2 }[slot])) return;
  }
  if (h.state === 'attack') {
    if (P.atk) h.buffer = 0.3;
    return;
  }
  if (h.state === 'jump') {
    // air control
    h.vx = approach(h.vx, mv.x * h.speed * (h.runJump ? 1.7 : 1), 900 * dt);
    h.vz = mv.z * h.speed * 0.5;
    if (P.atk && !h.airAtk) { h.airAtk = true; h.startMove('flykick'); h.vz = 0; return; }
    if (P.jump && h.cards.doubleJump && h.jumps < 2) { h.jumps = 2; h.vy = 520; Sfx.play('jump'); Particles.add({ x: h.x, y: scrY(h.z, h.y), type: 'ring', size: 30, life: 0.3, color: '#fff' }); }
    return;
  }
  if (!free) return;
  if (h.held) {
    // carrying something
    h.anim = 'hold';
    if (P.atk) { throwHeld(h); return; }
    const sp2 = h.speed * 0.75;
    h.vx = mv.x * sp2; h.vz = mv.z * sp2 * 0.65; h.moving = !!(mv.x || mv.z);
    if (mv.x) h.face = sign(mv.x);
    if (h.moving) h.walkPhase += dt * 10;
    if (P.jump) { h.held.dead = false; dropHeld(h); }
    return;
  }
  if (P.atk) {
    const prop = !mv.x && !mv.z ? nearbyProp(h) : null;
    if (prop) { liftProp(h, prop); return; }
    if (h.state === 'run') { h.startMove('dashpunch'); h.comboStep = h.weaponType.combo.length - 1; return; }
    h.comboStep = 0;
    h.startMove(h.weaponType.combo[0]);
    if (mv.x) h.face = sign(mv.x);
    return;
  }
  if (P.jump) {
    h.setState('jump');
    h.vy = 600; h.jumps = 1; h.airAtk = false;
    h.runJump = h.state === 'run' || mv.run;
    if (mv.run) h.vx = mv.x * h.speed * 1.7;
    Sfx.play('jump'); dust(h.x, h.z, 4);
    return;
  }
  if (H.def) {
    if (h.state !== 'block') h.setState('block');
    h.vx *= 0.5; h.vz = 0;
    if (mv.x) h.face = sign(mv.x);
    return;
  } else if (h.state === 'block') h.setState('idle');
  // movement
  const running = mv.run && mv.x !== 0;
  const spd = h.speed * (running ? 1.75 : 1);
  h.vx = mv.x * spd; h.vz = mv.z * h.speed * 0.66;
  if (mv.x) h.face = sign(mv.x);
  if (mv.x || mv.z) {
    const st = running ? 'run' : 'walk';
    if (h.state !== st) { h.state = st; h.anim = st; }
    const prev = h.walkPhase;
    h.walkPhase += dt * (running ? 15 : 10);
    if (Math.floor(prev / Math.PI) !== Math.floor(h.walkPhase / Math.PI)) { Sfx.play('step'); if (running) dust(h.x - h.face * 10, h.z, 1); }
  } else if (h.state === 'walk' || h.state === 'run') { h.state = 'idle'; h.anim = 'idle'; }
}
function nearbyProp(h) {
  let best = null, bd = 60;
  for (const p of S.props) { if (p.dead || p.held) continue; const d = Math.abs(p.x - h.x) + Math.abs(p.z - h.z) * 1.5; if (d < bd) { bd = d; best = p; } }
  return best;
}
function liftProp(h, p) { p.held = true; h.held = p; h.setState('hold'); Sfx.play('jump'); }
function dropHeld(h) { const p = h.held; h.held = null; p.held = false; p.x = h.x + h.face * 20; p.z = h.z; h.setState('idle'); }
function throwHeld(h) {
  const p = h.held; h.held = null; p.dead = true;
  h.setState('throw'); Sfx.play('throw');
  S.addProj(new Projectile({
    team: 'hero', owner: h, kind: p.kind === 'rock' ? 'rock' : p.kind, x: h.x + h.face * 20, y: 90, z: h.z, vx: h.face * 620, vy: 120, g: 500, r: 18, rz: 26,
    dmg: 28 + h.baseDmg() * 1.5, el: 'phys', kx: 260, ky: 260, fall: 100, heavy: true, life: 2,
    onHit: (pr, f) => { if (f.dead) unlockAch('throw'); },
    onLand: (pr) => { pr.dead = true; const bp = new Prop({ kind: p.kind, x: pr.x, z: pr.z, hp: 1 }); bp.break(); },
    onExpire: (pr) => { const bp = new Prop({ kind: p.kind, x: pr.x, z: pr.z, hp: 1 }); bp.break(); },
  }));
}

// ------------------------------------------------------------
//  Spells
// ------------------------------------------------------------
function nearestEnemy(x, z, maxD = 9999, exclude = []) {
  let best = null, bd = maxD;
  for (const e of S.enemies) { if (e.dead || e.hidden || exclude.includes(e.id)) continue; const d = Math.hypot(e.x - x, (e.z - z) * 1.6); if (d < bd) { bd = d; best = e; } }
  return best;
}
function spellDmg(h, base) { return base; }
function castSpell(h, idx) {
  const s = h.spells[idx];
  if (!s) return false;
  const def = SPELLS[s.id];
  if (s.cd > 0) return false;
  const cost = def.cost;
  if (h.mp < cost && !S.god) { Floaters.add(h.x, scrY(h.z, 130), 'NO MP', { color: '#55c8ff', size: 16, font: FONT_PIXEL }); Sfx.play('back'); return false; }
  h.mp -= S.god ? 0 : cost;
  s.cd = def.cd * h.stats.cdMul;
  h.setState('cast'); h.castDur = 0.28; h.castColor = EL[def.el].c;
  h.vx = 0; h.vz = 0;
  SAVE.stats.spells++;
  SpellFx[s.id](h, s.lvl);
  if (h.stats.echo && Math.random() < h.stats.echo) setTimeout(() => { if (S && !S.over && !h.dead) { SpellFx[s.id](h, s.lvl); Floaters.add(h.x, scrY(h.z, 150), 'ECHO!', { color: '#c58cff', size: 18 }); } }, 280);
  return true;
}
function chainLightning(src, first, jumps, dmg, range, hit) {
  let cur = first, fromX = src.x, fromY = scrY(src.z, src.y + 70);
  const ids = hit.slice();
  const extra = S.hero.cards.duo_plasma ? 1 : 0;
  for (let i = 0; i <= jumps + extra && cur; i++) {
    ids.push(cur.id);
    const toX = cur.x, toY = scrY(cur.z, cur.y + cur.h * 0.6);
    boltFx(fromX, fromY, toX, toY);
    dealDamage(src, cur, { dmg, el: 'storm', kx: 40, fall: 20, stop: 0.03, spell: true, sfx: 'zap' });
    fromX = toX; fromY = toY;
    cur = nearestEnemy(cur.x, cur.z, range || 220, ids);
  }
  Sfx.play('zap');
}
function boltFx(x0, y0, x1, y1) {
  const pts = [];
  const n = 7;
  for (let i = 0; i <= n; i++) { const k = i / n; pts.push([lerp(x0, x1, k) + (i && i < n ? R(-14, 14) : 0), lerp(y0, y1, k) + (i && i < n ? R(-14, 14) : 0)]); }
  S.bolts.push({ pts, t: 0.14 });
  Particles.add({ x: x1, y: y1, life: 0.15, size: 22, color: '#ffe45c', glow: true });
}
const SpellFx = {
  fireball(h, l) {
    Sfx.play('fire');
    const n = l >= 5 ? 3 : l >= 3 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const dz = n === 1 ? 0 : (i - (n - 1) / 2) * 28;
      S.addProj(new Projectile({ team: 'hero', owner: h, spell: true, kind: 'fireball', x: h.x + h.face * 30, y: 62, z: h.z + dz, vx: h.face * 560, r: 16 + l, dmg: 14 + l * 6, el: 'fire', life: 1.3, pierce: l >= 4 ? 1 : 0, kx: 160, fall: 50, trail: '#ff7a2f', onExpire: (p) => Particles.burst(p.x, scrY(p.z, p.y), 8, { speed: 150, life: 0.4, size: 5, colors: ['#ff7a2f', '#ffd35c'], glow: true }) }));
    }
  },
  meteor(h) {
    Sfx.play('fire');
    const targets = S.enemies.filter((e) => !e.dead && Math.abs(e.x - h.x) < VIEW_W * 0.7);
    for (let i = 0; i < 8; i++) {
      const t = targets.length ? targets[i % targets.length] : null;
      const x = t ? t.x + R(-30, 30) : h.x + h.face * R(80, 400), z = t ? t.z : R(20, DEPTH - 20);
      S.telegraph({ x, z, rx: 70, rz: 30, delay: 0.5 + i * 0.12, team: 'hero', owner: h, dmg: 45, el: 'fire', launch: 280, color: '#ff7a2f', spell: true,
        onFire: (zn) => { explosion(zn.x, zn.z, 80, '#ff7a2f'); if (h.cards.duo_magma) S.addZone(new Zone({ team: 'hero', owner: h, x: zn.x, z: zn.z, rx: 60, rz: 24, life: 3, tick: 0.5, dmg: 6, el: 'fire', kind: 'lava' })); },
        meteor: true });
    }
  },
  pillar(h, l) {
    Sfx.play('fire');
    const x = h.x + h.face * 130;
    S.addZone(new Zone({ team: 'hero', owner: h, kind: 'pillar', x, z: h.z, rx: 44 + l * 4, rz: 28, life: 1.2 + l * 0.15, tick: 0.25, dmg: 8 + l * 3, el: 'fire', launch: 240, kx: 20, fall: 100 }));
  },
  tornado(h) {
    Sfx.play('fire');
    const pr = new Projectile({ team: 'hero', owner: h, spell: true, kind: 'tornado', x: h.x + h.face * 60, y: 40, z: h.z, vx: h.face * 170, r: 40, rz: 40, dmg: 16, el: 'fire', life: 4, pierce: 999, kx: -h.face * 60, fall: 30, homing: 1.2 });
    pr.target = nearestEnemy(h.x, h.z);
    const hitReset = setInterval(() => { if (pr.dead) clearInterval(hitReset); else pr.hitIds.clear(); }, 300);
    S.addProj(pr);
  },
  iceShard(h, l) {
    Sfx.play('ice');
    S.addProj(new Projectile({ team: 'hero', owner: h, spell: true, kind: 'iceShard', x: h.x + h.face * 30, y: 64, z: h.z, vx: h.face * 760, r: 14, dmg: 12 + l * 5, el: 'ice', chill: l >= 3 ? 2 : 1, life: 1, pierce: 1 + Math.floor(l / 2), kx: 80, fall: 25, trail: '#7fe3ff' }));
  },
  lance(h) {
    Sfx.play('ice'); S.shake(6);
    S.addProj(new Projectile({ team: 'hero', owner: h, spell: true, kind: 'iceShard', big: true, x: h.x + h.face * 40, y: 64, z: h.z, vx: h.face * 900, r: 26, rz: 44, dmg: 50, el: 'ice', chill: 3, life: 1.2, pierce: 999, kx: 200, fall: 60, trail: '#bff5ff' }));
  },
  nova(h, l) {
    Sfx.play('ice');
    const r = 130 + l * 15;
    // an expanding ring that hits each enemy once as it passes
    const zn = new Zone({ team: 'hero', owner: h, kind: 'nova', x: h.x, z: h.z, rx: 30, rz: 12, grow: r * 3.3, life: 0.3, dmg: 16 + l * 6 });
    S.addZone(zn);
    zn.update = function (dt) {
      this.t += dt; this.rx += this.grow * dt; this.rz += this.grow * 0.42 * dt;
      for (const f of S.enemies) { if (f.dead || this.hitIds.has(f.id)) continue; if (!this.contains(f, f.w * 0.5)) continue; this.hitIds.add(f.id); dealDamage(this.owner, f, { dmg: this.dmg, el: 'ice', chill: 2, kx: 220, fall: 60, spell: true, dir: sign(f.x - this.x) }); }
      if (this.t >= this.life) this.dead = true;
    };
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; Particles.add({ x: h.x, y: scrY(h.z, 20), vx: Math.cos(a) * r * 3, vy: Math.sin(a) * r * 1.2, life: 0.35, size: 5, color: '#bff5ff', type: 'shard', drag: 0.9 }); }
  },
  zero(h) {
    Sfx.play('timeStop'); S.flashWhite = 0.4; S.shake(8);
    S.banner('ABSOLUTE ZERO', '#7fe3ff', 1);
    for (const e of S.enemies) if (!e.dead) { dealDamage(h, e, { dmg: 30, el: 'ice', chill: 6, noKnock: true, spell: true, ignoreInv: true }); if (!e.dead) { e.st.frozen = e.isBoss ? 2 : 4; } }
  },
  quake(h, l) {
    Sfx.play('quake'); S.shake(12);
    const z = new Zone({ team: 'hero', owner: h, kind: 'quakeRing', x: h.x, z: h.z, rx: 40, rz: 18, grow: 520, life: 0.45, dmg: 20 + l * 7, el: 'earth', launch: 300, groundOnly: true, once: false, heavy: true });
    z.update = function (dt) {
      this.t += dt; this.rx += this.grow * dt; this.rz += this.grow * 0.42 * dt;
      for (const f of S.enemies) { if (f.dead || this.hitIds.has(f.id) || f.y > 25) continue; if (!this.contains(f, f.w * 0.5)) continue; this.hitIds.add(f.id); dealDamage(h, f, { dmg: this.dmg, el: 'earth', ky: 300, kx: 120, fall: 100, spell: true, heavy: true, dir: sign(f.x - this.x) }); }
      if (this.t >= this.life) this.dead = true;
    };
    S.addZone(z);
    dust(h.x, h.z, 20);
    for (let i = 0; i < 10; i++) Particles.add({ x: h.x + R(-160, 160), y: scrY(h.z + R(-40, 40), 0), vx: R(-40, 40), vy: R(-420, -200), g: 1200, life: 0.8, size: R(4, 8), color: '#8a7a6a', type: 'sq' });
    if (h.cards.duo_magma) S.addZone(new Zone({ team: 'hero', owner: h, x: h.x, z: h.z, rx: 90, rz: 36, life: 3, tick: 0.5, dmg: 6, el: 'fire', kind: 'lava' }));
    S.addDecal({ kind: 'crack', x: h.x, z: h.z, life: 4 });
  },
  tectonic(h) {
    for (let i = 0; i < 3; i++) setTimeout(() => { if (S && !S.over) SpellFx.quake(h, 6); }, i * 380);
    for (let i = 0; i < 10; i++) {
      const x = h.x + R(-VIEW_W * 0.5, VIEW_W * 0.5), z = R(10, DEPTH - 10);
      S.telegraph({ x, z, rx: 46, rz: 20, delay: 0.6 + i * 0.1, team: 'hero', owner: h, dmg: 30, el: 'earth', launch: 200, color: '#d7a15f', onFire: (zn) => { dust(zn.x, zn.z, 8); Sfx.play('crate'); } });
    }
  },
  boulder(h, l) {
    Sfx.play('throw');
    S.addProj(new Projectile({ team: 'hero', owner: h, spell: true, kind: 'boulder', x: h.x + h.face * 40, y: 30, z: h.z, vx: h.face * 420, r: 26 + l * 2, rz: 30, dmg: 18 + l * 7, el: 'earth', life: 1.6, pierce: 999, kx: 260, ky: 240, fall: 100, heavy: true,
      onHit: () => S.shake(3), onExpire: (p) => { dust(p.x, p.z, 10); if (h.cards.duo_magma) S.addZone(new Zone({ team: 'hero', owner: h, x: p.x, z: p.z, rx: 60, rz: 24, life: 3, tick: 0.5, dmg: 6, el: 'fire', kind: 'lava' })); } }));
  },
  avalanche(h) {
    Sfx.play('quake'); S.shake(8);
    for (let i = 0; i < 7; i++) {
      const z = (i + 0.5) * DEPTH / 7;
      S.addProj(new Projectile({ team: 'hero', owner: h, spell: true, kind: 'boulder', x: h.x - h.face * 200 + R(-30, 30), y: 30, z, vx: h.face * 480, r: 28, rz: 18, dmg: 40, el: 'earth', life: 2.4, pierce: 999, kx: 260, ky: 240, fall: 100, heavy: true }));
    }
  },
  chrono(h, l) {
    Sfx.play('time');
    S.addZone(new Zone({ team: 'hero', owner: h, kind: 'chrono', x: h.x, z: h.z, rx: 170 + l * 20, rz: 72 + l * 8, life: 3 + l * 0.6, follow: h, chrono: true }));
  },
  timestop(h) {
    Sfx.play('timeStop');
    S.timeStop = 3.5; S.flashWhite = 0.3;
    S.banner('TIME STOP', '#c58cff', 1.2);
  },
  blink(h, l) {
    Sfx.play('blink');
    const x0 = h.x;
    const dist = 240;
    const b = S.bounds(h);
    const x1 = clamp(h.x + h.face * dist, b[0], b[1]);
    for (let i = 0; i < 5; i++) S.afterimages.push({ x: lerp(x0, x1, i / 5), z: h.z, face: h.face, t: 0.35, look: h.look });
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    for (const e of S.enemies) if (!e.dead && e.x > lo - 20 && e.x < hi + 20 && Math.abs(e.z - h.z) < 40) dealDamage(h, e, { dmg: 16 + l * 6, el: 'time', slow: 2, kx: 100, fall: 50, spell: true, dir: h.face });
    h.x = x1; h.inv = 0.3;
    h.setState('dash', 'dash'); h.dashDur = 0.15;
  },
  army(h) {
    SpellFx.blink(h, 6);
    for (let i = 0; i < 3; i++) S.clones.push({ x: h.x - h.face * (40 + i * 30), z: clamp(h.z + (i - 1) * 40, 0, DEPTH), t: 6, delay: i * 0.08, face: h.face });
  },
  chain(h, l) {
    const t = nearestEnemy(h.x + h.face * 60, h.z, 420);
    if (!t) { Sfx.play('zap'); boltFx(h.x, scrY(h.z, 80), h.x + h.face * 200, scrY(h.z, 40)); return; }
    chainLightning(h, t, 2 + l, 14 + l * 5, 240, []);
  },
  thunder(h) {
    Sfx.play('zap'); S.banner('THUNDERSTORM', '#ffe45c', 1);
    S.addZone(new Zone({ team: 'hero', owner: h, kind: 'storm', x: h.x, z: h.z, rx: 10, rz: 10, life: 6, follow: h,
      onUpdate: (zn, dt) => {
        zn.bt = (zn.bt || 0) - dt;
        if (zn.bt <= 0) {
          zn.bt = 0.28;
          const t = nearestEnemy(h.x + R(-300, 300), R(0, DEPTH), 700);
          if (t) { boltFx(t.x + R(-10, 10), 0, t.x, scrY(t.z, t.y + 40)); dealDamage(h, t, { dmg: 22, el: 'storm', kx: 40, fall: 30, spell: true, sfx: 'zap' }); S.flashWhite = 0.06; }
        }
      } }));
  },
};
