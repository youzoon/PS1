// ============================================================
//  AI: regular enemies (token-based engagement) and boss patterns
// ============================================================
function moveToward(e, tx, tz, spdMul, dt) {
  const dx = tx - e.x, dz = tz - e.z;
  const sp = e.speed * spdMul;
  const d = Math.hypot(dx, dz * 1.4);
  if (d < 6) { e.vx = 0; e.vz = 0; if (e.state === 'walk' || e.state === 'run') { e.state = 'idle'; e.anim = 'idle'; } return true; }
  e.vx = (dx / d) * sp; e.vz = (dz / d) * sp * 0.75;
  const st = spdMul > 1.5 ? 'run' : 'walk';
  if (e.state !== st) { e.state = st; e.anim = st; }
  e.walkPhase += dt * (st === 'run' ? 14 : 9) * Math.min(1.5, e.speed / 100);
  return false;
}
function enemyShoot(e, kind, h) {
  const dir = sign(h.x - e.x);
  e.face = dir;
  const L = S.diff;
  const base = { team: 'enemy', owner: e, x: e.x + dir * 30 * e.scale, y: 60 * e.scale + (e.flying ? e.y : 0), z: e.z, life: 3, dmg: e.dmg * 0.85, r: 12 };
  let p;
  switch (kind) {
    case 'arrow': p = new Projectile(Object.assign(base, { kind: 'arrow', vx: dir * 430, kx: 90, fall: 30, el: 'phys' })); break;
    case 'laser': p = new Projectile(Object.assign(base, { kind: 'laser', vx: dir * 470, kx: 60, fall: 20, el: 'phys', y: e.y + 10 })); break;
    case 'iceball': p = new Projectile(Object.assign(base, { kind: 'iceball', vx: dir * 310, el: 'ice', chill: 1, trail: '#7fe3ff', r: 14 })); break;
    case 'fireball': p = new Projectile(Object.assign(base, { kind: 'fireball', vx: dir * 320, el: 'fire', trail: '#ff7a2f', r: 14 })); break;
    case 'spore': p = new Projectile(Object.assign(base, { kind: 'spore', vx: dir * 260, vz: (h.z - e.z) * 0.6, el: 'poison', trail: '#8dff5a', r: 14 })); break;
    case 'glitchball': p = new Projectile(Object.assign(base, { kind: 'glitchball', vx: dir * 300, vz: R(-120, 120), bounceZ: true, el: 'glitch', r: 14, life: 4 })); break;
    case 'bomb': {
      const T = 0.9;
      const tx = h.x + R(-30, 30), tz = h.z;
      p = new Projectile(Object.assign(base, { kind: 'bomb', vx: (tx - e.x) / T, vz: (tz - e.z) / T, vy: 0.5 * 900 * T - (base.y) / T, g: 900, r: 10, dmg: 0,
        onLand: (pr) => { pr.dead = true; S.telegraph({ x: pr.x, z: pr.z, rx: 80, rz: 34, delay: 0.55, team: 'enemy', owner: e, dmg: e.dmg, launch: 260, color: '#ff7a2f', onFire: (zn) => explosion(zn.x, zn.z, 80, '#ff7a2f') }); } }));
      break;
    }
  }
  if (p) { S.addProj(p); Sfx.play(kind === 'arrow' ? 'throw' : kind === 'fireball' ? 'fire' : kind === 'iceball' ? 'ice' : 'whoosh'); }
}

function enemyThink(e, dt) {
  const h = S.hero;
  if (e.dead) return;
  if (S.mode === 'typing') { Typing.enemyThink(e, dt); return; }
  if (e.isBoss) { bossThink(e, dt); return; }
  e.aiT = (e.aiT || 0) - dt * e.ts;
  e.atkCd = (e.atkCd ?? R(0.6, 1.5)) - dt * e.ts;
  if (!e.canAct()) return;
  if (!h || h.dead) { moveToward(e, e.x + e.face * 10, e.z, 0.3, dt); return; }
  if (e.entering) {
    const b = S.arena;
    moveToward(e, clamp(e.x, b[0] + 60, b[1] - 60), e.z, 1, dt);
    if (e.x > b[0] + 30 && e.x < b[1] - 30) e.entering = false;
    return;
  }
  const dx = h.x - e.x, dz = h.z - e.z, adx = Math.abs(dx);
  const aggr = S.aggr;
  if (e.state !== 'block') e.face = sign(dx) || e.face;
  const def = e.def;
  const range = def.range * e.scale;
  // engagement token
  const wantsToken = ['brawler', 'tank', 'charger', 'flyer', 'hopper'].includes(e.ai);
  if (wantsToken && !S.engaged.has(e.id) && S.engaged.size < S.maxEngaged && adx < 520) S.engaged.add(e.id);
  const engaged = S.engaged.has(e.id);
  // blockers react to hero attacks
  if (def.blocker && h.state === 'attack' && adx < 130 && Math.abs(dz) < 30 && Math.random() < dt * 5 && (e.blockHits || 0) < 4) {
    e.setState('block'); e.vx = 0; e.vz = 0; e.blockT = R(0.5, 0.9);
    return;
  }
  switch (e.ai) {
    case 'brawler': case 'tank': case 'hopper': case 'flyer': case 'charger': {
      if (!engaged) {
        // circle at a distance, waiting for a turn
        if (e.aiT <= 0) { e.aiT = R(0.8, 1.6); e.waitX = h.x - sign(dx || 1) * R(190, 280); e.waitZ = clamp(h.z + R(-70, 70), 0, DEPTH); }
        moveToward(e, e.waitX ?? e.x, e.waitZ ?? e.z, 0.6, dt);
        e.face = sign(dx) || 1;
        return;
      }
      if (e.ai === 'charger' && adx > 220 && Math.abs(dz) < 24 && e.atkCd <= 0) {
        // charge!
        e.charging = 1.1; e.atkCd = R(2.2, 3.2) / aggr;
        Floaters.add(e.x, scrY(e.z, e.h + 30), '!', { color: '#ff4f73', size: 26, vy: -20 });
      }
      if (e.charging > 0) {
        e.charging -= dt;
        moveToward(e, h.x, h.z, 2.6, dt);
        if (adx < range + 10 && Math.abs(dz) < 22) { e.charging = 0; e.startMove(pick(def.moves)); }
        return;
      }
      const tx = h.x - sign(dx || 1) * range * 0.7;
      const inRange = adx < range + 8 && Math.abs(dz) < 16 && (!e.flying || true);
      if (inRange && e.atkCd <= 0) {
        e.startMove(pick(def.moves));
        e.atkCd = R(0.9, 1.8) / aggr;
        return;
      }
      if (inRange) { e.vx = 0; e.vz = 0; if (e.state === 'walk') { e.state = 'idle'; e.anim = 'idle'; } return; }
      moveToward(e, tx, h.z, e.ai === 'tank' ? 0.9 : 1, dt);
      if (e.ai === 'hopper' && e.grounded && Math.random() < dt * 1.2) { e.vy = 300; e.y = 1; }
      return;
    }
    case 'ranged': case 'caster': case 'bomber': case 'healer': {
      const want = e.ai === 'bomber' ? 240 : 300;
      if (e.ai === 'healer' && e.atkCd <= 0) {
        const hurt = S.enemies.filter((o) => !o.dead && o !== e && o.hp < o.maxHp * 0.7 && Math.abs(o.x - e.x) < 320).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (hurt) {
          e.setState('cast'); e.castDur = 0.6; e.castColor = '#8dff5a'; e.atkCd = 4 / aggr;
          const amt = hurt.maxHp * 0.3; hurt.hp = Math.min(hurt.maxHp, hurt.hp + amt);
          Floaters.add(hurt.x, scrY(hurt.z, hurt.h + 20), '+' + Math.round(amt), { color: '#8dff5a', size: 18 });
          for (let i = 0; i < 12; i++) Particles.add({ x: hurt.x + R(-20, 20), y: scrY(hurt.z, R(10, hurt.h)), vy: -60, life: 0.8, size: 4, color: '#8dff5a', type: 'star' });
          return;
        }
      }
      const tx = h.x - sign(dx || 1) * want;
      const tz = h.z + (e.ai === 'bomber' ? R(-5, 5) : 0);
      const aligned = Math.abs(dz) < (e.ai === 'bomber' ? 90 : 14);
      if (adx < 110 && e.atkCd <= 0) { e.startMove(pick(def.moves)); e.atkCd = R(1, 1.8) / aggr; return; }
      const shooters = S.enemies.filter((o) => !o.dead && o !== e && o.state === 'cast' && !o.isBoss).length;
      if (aligned && adx > 140 && adx < 520 && e.atkCd <= 0 && shooters < 2 && S.time - (S.lastShot || 0) > 0.45) {
        S.lastShot = S.time;
        e.setState('cast'); e.castDur = 0.45; e.castColor = EL[{ iceball: 'ice', fireball: 'fire', spore: 'poison', glitchball: 'glitch' }[def.shot]]?.c || '#fff';
        e.pendingShot = { kind: def.shot, t: 0.3 };
        e.atkCd = R(2.6, 4) / aggr;
        return;
      }
      if (Math.abs(e.x - tx) > 30 || !aligned) moveToward(e, tx, tz, 0.9, dt);
      else { e.vx = 0; e.vz = 0; if (e.state === 'walk') { e.state = 'idle'; e.anim = 'idle'; } }
      return;
    }
  }
}

// ------------------------------------------------------------
//  Boss patterns
// ------------------------------------------------------------
function bossThink(b, dt) {
  const h = S.hero;
  if (b.dead) return;
  const bdt = dt * b.ts;
  if (bdt <= 0) return;
  if (!b.enraged && b.hp < b.maxHp * 0.5) {
    b.enraged = true; b.speed *= 1.2;
    S.banner(b.def.name.toUpperCase() + ' IS ENRAGED!', '#ff4f73', 1.4);
    Sfx.play('roar'); S.shake(10);
  }
  if (h.dead) return;
  if (b.act) {
    const done = BossActs[b.act.name.split(':')[0]](b, bdt, b.act, h);
    b.act.t += bdt;
    if (done || b.act.t > 12) {
      b.act = null; b.actCd = R(0.7, 1.4) * (b.enraged ? 0.6 : 1) / S.aggr;
      if (b.state === 'bossact') b.setState('idle');
      b.hidden = false;
    }
    return;
  }
  b.actCd = (b.actCd ?? 1.2) - bdt;
  if (!b.canAct()) return;
  const dx = h.x - b.x;
  b.face = sign(dx) || b.face;
  if (b.def.anchor || b.art === 'dragon' || b.art === 'treant' || b.art === 'bug') {
    // big bosses stay near the right side of the arena
    const ax = S.arena[1] - (b.art === 'dragon' ? 170 : 150);
    moveToward(b, ax, clamp(h.z, 40, DEPTH - 40), 0.5, bdt);
    b.face = -1;
  } else {
    const want = b.def.shot && !b.def.moves.includes('club') ? 260 : b.def.range * 0.8;
    const tx = h.x - sign(dx || 1) * want;
    if (Math.abs(b.x - tx) > 30 || Math.abs(b.z - h.z) > 18) moveToward(b, tx, h.z, 0.8, bdt);
    else { b.vx = 0; b.vz = 0; b.state = 'idle'; b.anim = 'idle'; }
    // opportunistic melee
    if (Math.abs(dx) < b.def.range * b.scale * 0.9 && Math.abs(b.z - h.z) < 22 && Math.random() < bdt * 2) { b.startMove(pick(b.def.moves)); return; }
  }
  if (b.actCd <= 0) {
    const pat = b.def.pattern;
    b.patIdx = ((b.patIdx ?? -1) + 1) % pat.length;
    let name = pat[b.patIdx];
    if (name.startsWith('summon') && S.enemies.filter((e) => !e.dead && !e.isBoss).length >= 6) name = pat[(b.patIdx + 1) % pat.length];
    b.act = { name, t: 0, step: 0, st: 0 };
    b.vx = 0; b.vz = 0;
  }
}
function bossPose(b, anim, moveName) {
  b.state = 'bossact';
  if (b.anim !== anim || (moveName && b.move !== MOVES[moveName])) { b.anim = anim; b.animT = 0; }
  if (moveName) b.move = MOVES[moveName];
}
function laneTelegraph(z, x0, x1, delay, dmg, o = {}) {
  return S.telegraph(Object.assign({ x: (x0 + x1) / 2, z, rx: Math.abs(x1 - x0) / 2, rz: o.rz || 34, delay, team: 'enemy', dmg, color: o.color || '#ff4f73', lane: true }, o));
}
const BossActs = {
  charge(b, dt, a, h) {
    if (a.step === 0) {
      bossPose(b, 'attack', 'club'); b.animT = Math.min(b.animT, 0.2);
      if (a.t < 0.05) { b.face = sign(h.x - b.x) || 1; a.z = b.z; a.dir = b.face; Sfx.play('roar'); a.tele = laneTelegraph(b.z, b.x, b.face > 0 ? S.arena[1] : S.arena[0], 0.75, 0, { color: '#ff4f73', rz: 30 }); }
      if (a.t > 0.75) { a.step = 1; a.st = a.t; a.hit = false; }
      return false;
    }
    bossPose(b, 'run');
    b.walkPhase += dt * 18;
    b.vx = a.dir * b.speed * 4.2; b.vz = 0;
    if (Math.random() < dt * 30) dust(b.x - a.dir * 20, b.z, 1);
    if (!a.hit && Math.abs(h.x - b.x) < 50 * b.scale && Math.abs(h.z - b.z) < 30) {
      a.hit = true; dealDamage(b, h, { dmg: b.dmg * 1.3, kx: 320, ky: 320, fall: 100, dir: a.dir, stop: 0.08, heavy: true });
    }
    const bnd = S.bounds(b);
    if (a.t - a.st > 1.4 || b.x <= bnd[0] + 5 || b.x >= bnd[1] - 5) { b.vx = 0; S.shake(6); dust(b.x, b.z, 10); return true; }
    return false;
  },
  slide(b, dt, a, h) {
    // yeti belly slide: two passes
    if (a.passes == null) a.passes = 0;
    const r = BossActs.charge(b, dt, a, h);
    if (a.step === 1) { b.anim = 'dash'; }
    if (r) { a.passes++; if (a.passes < 2) { a.step = 0; a.t = 0; return false; } return true; }
    return false;
  },
  combo(b, dt, a, h) {
    if (a.n == null) { a.n = 2 + (b.enraged ? 1 : 0); a.done = 0; }
    if (b.state === 'attack') return false;
    if (a.done >= a.n) return true;
    const dx = h.x - b.x;
    b.face = sign(dx) || 1;
    const range = b.def.range * b.scale * 0.85;
    if (Math.abs(dx) < range && Math.abs(h.z - b.z) < 22) { b.startMove(b.def.moves[a.done % b.def.moves.length]); a.done++; }
    else moveToward(b, h.x - sign(dx || 1) * range * 0.7, h.z, 1.2, dt);
    return a.t > 6;
  },
  slam(b, dt, a, h) {
    if (a.step === 0) {
      a.tx = h.x; a.tz = h.z; a.step = 1;
      b.setState('jump'); b.vy = 760; b.y = 1;
      b.vx = (a.tx - b.x) / 0.95; b.vz = (a.tz - b.z) / 0.95;
      S.telegraph({ x: a.tx, z: a.tz, rx: 150, rz: 60, delay: 0.95, team: 'enemy', owner: b, dmg: b.dmg * 1.4, launch: 320, groundOnly: true, color: '#ff4f73', onFire: (zn) => { S.shake(12); Sfx.play('quake'); dust(zn.x, zn.z, 20); Particles.add({ x: zn.x, y: scrY(zn.z, 0), type: 'ring', size: 150, life: 0.4, color: '#fff' }); } });
      Sfx.play('jump');
      return false;
    }
    if (b.grounded && a.t > 0.2) { b.vx = 0; b.vz = 0; b.setState('land'); return true; }
    return false;
  },
  summon(b, dt, a, h) {
    bossPose(b, 'cast'); b.castColor = '#ff4f73';
    if (a.step === 0) {
      a.step = 1; Sfx.play('roar');
      const kind = a.name.split(':')[1];
      const n = 2 + Math.floor(S.level.n / 4);
      for (let i = 0; i < n; i++) S.spawnEnemy(kind, { side: i % 2 ? -1 : 1, delay: i * 0.25 });
      Floaters.add(b.x, scrY(b.z, b.h + 40), pick(['GET HIM!', 'MINIONS!', 'HELP!', 'ATTACK!']), { color: '#fff', size: 20, font: FONT_BODY, life: 1.2 });
    }
    return a.t > 0.8;
  },
  barrel(b, dt, a, h) {
    bossPose(b, 'attack', 'throwP');
    if (a.t > a.step * 0.45 && a.step < 3) {
      a.step++; b.animT = 0;
      const T = 1.0, tx = h.x + R(-40, 40), tz = clamp(h.z + R(-30, 30), 0, DEPTH);
      S.telegraph({ x: tx, z: tz, rx: 80, rz: 34, delay: T, team: 'enemy', owner: b, dmg: b.dmg, launch: 240, color: '#ff4f73' });
      S.addProj(new Projectile({ team: 'enemy', owner: b, kind: 'barrel', x: b.x, y: 140 * b.scale, z: b.z, vx: (tx - b.x) / T, vz: (tz - b.z) / T, vy: 0.5 * 900 * T - 140 * b.scale / T, g: 900, r: 16, dmg: 0, life: 3,
        onLand: (p) => { p.dead = true; const bp = new Prop({ kind: 'barrel', x: p.x, z: p.z, hp: 1 }); if (Math.random() < 0.3) bp.break(); else { Particles.burst(p.x, scrY(p.z, 10), 10, { speed: 260, life: 0.6, size: 6, colors: ['#a0703a', '#6b4424'], type: 'sq', g: 800 }); } Sfx.play('crate'); } }));
      Sfx.play('throw');
    }
    return a.t > 1.8;
  },
  volley(b, dt, a, h) {
    bossPose(b, 'attack', 'shoot'); b.castColor = '#fff';
    b.face = sign(h.x - b.x) || 1;
    if (a.t > 0.35 + a.step * 0.6 && a.step < 2) {
      a.step++; b.animT = 0;
      for (let i = -1; i <= 1; i++) S.addProj(new Projectile({ team: 'enemy', owner: b, kind: 'arrow', x: b.x + b.face * 30, y: 70, z: b.z, vx: b.face * 430, vz: i * 90, r: 12, dmg: b.dmg * 0.6, kx: 90, fall: 30, life: 2.5 }));
      Sfx.play('throw');
    }
    return a.t > 1.6;
  },
  dash(b, dt, a, h) {
    bossPose(b, 'dash');
    if (a.step === 0) { a.step = 1; a.tx = h.x > (S.arena[0] + S.arena[1]) / 2 ? S.arena[0] + 120 : S.arena[1] - 120; }
    b.face = sign(a.tx - b.x) || 1;
    b.vx = b.face * b.speed * 4;
    if (Math.random() < dt * 30) dust(b.x, b.z, 1);
    if (Math.abs(b.x - a.tx) < 30 || a.t > 1.2) { b.vx = 0; return true; }
    return false;
  },
  roots(b, dt, a, h) {
    bossPose(b, 'attack', 'slamE'); b.animT = Math.min(b.animT, 0.5);
    if (a.step === 0) {
      a.step = 1; Sfx.play('roar');
      const n = 4 + (b.enraged ? 3 : 0);
      for (let i = 0; i < n; i++) {
        const x = i === 0 ? h.x : h.x + R(-300, 300), z = i === 0 ? h.z : R(10, DEPTH - 10);
        S.telegraph({ x, z, rx: 56, rz: 24, delay: 0.9 + i * 0.08, team: 'enemy', owner: b, dmg: b.dmg, launch: 330, color: '#9dff5a', kind: 'roots', life: 0.6, onFire: (zn) => { dust(zn.x, zn.z, 6); Sfx.play('crate'); } });
      }
    }
    return a.t > 1.6;
  },
  sweep(b, dt, a, h) {
    bossPose(b, 'attack', 'swingBig'); b.animT = a.t < 0.8 ? Math.min(b.animT, 0.14) : b.animT;
    if (a.step === 0) {
      a.step = 1;
      const x0 = b.x + b.face * 30, x1 = b.x + b.face * 360;
      laneTelegraph(h.z, x0, x1, 0.8, b.dmg * 1.2, { owner: b, launch: 280, rz: 44, color: '#ff4f73' });
    }
    return a.t > 1.3;
  },
  leafstorm(b, dt, a, h) {
    bossPose(b, 'cast'); b.castColor = '#9dff5a';
    if (a.t > a.step * 0.15 && a.step < 8) {
      a.step++;
      const p = new Projectile({ team: 'enemy', owner: b, kind: 'leaf', x: b.x + b.face * 40, y: 150 + R(-40, 40), z: b.z + R(-40, 40), vx: b.face * R(260, 340), vz: R(-60, 60), r: 12, dmg: b.dmg * 0.5, kx: 60, fall: 20, life: 3.5, homing: 1.1 });
      p.target = h; S.addProj(p); Sfx.play('whoosh');
    }
    return a.t > 1.6;
  },
  burrow(b, dt, a, h) {
    if (a.step === 0) { a.step = 1; b.hidden = true; b.submerged = true; b.state = 'bossact'; Sfx.play('quake'); dust(b.x, b.z, 16); }
    if (a.step === 1) {
      moveToward(b, h.x, h.z, 1.8, dt); b.state = 'bossact';
      if (Math.random() < dt * 40) Particles.add({ x: b.x + R(-20, 20), y: scrY(b.z, 0), vx: R(-60, 60), vy: R(-160, -60), g: 600, life: 0.5, size: 5, color: '#e8c48a', type: 'sq' });
      if (a.t > 1.4) { a.step = 2; a.st = a.t; b.vx = 0; b.vz = 0; S.telegraph({ x: h.x, z: h.z, rx: 110, rz: 46, delay: 0.7, team: 'enemy', owner: b, dmg: b.dmg * 1.5, launch: 380, color: '#ff4f73' }); a.tx = h.x; a.tz = h.z; }
      return false;
    }
    if (a.step === 2 && a.t - a.st > 0.7) {
      b.x = a.tx; b.z = a.tz; b.hidden = false; b.submerged = false; S.shake(12); Sfx.play('roar'); dust(b.x, b.z, 24);
      return true;
    }
    return false;
  },
  spit(b, dt, a, h) {
    bossPose(b, 'attack', 'bite');
    if (a.t > a.step * 0.3 && a.step < 4) {
      a.step++;
      const T = 0.9, tx = h.x + R(-80, 80), tz = clamp(h.z + R(-40, 40), 0, DEPTH);
      S.telegraph({ x: tx, z: tz, rx: 60, rz: 26, delay: T, team: 'enemy', owner: b, dmg: b.dmg * 0.8, color: '#e8c48a' });
      S.addProj(new Projectile({ team: 'enemy', owner: b, kind: 'sandball', x: b.x, y: 160, z: b.z, vx: (tx - b.x) / T, vz: (tz - b.z) / T, vy: 0.5 * 900 * T - 160 / T, g: 900, r: 14, dmg: 0, life: 3 }));
    }
    return a.t > 1.6;
  },
  teleport(b, dt, a, h) {
    if (a.step === 0) { a.step = 1; b.hidden = true; Sfx.play('blink'); Particles.burst(b.x, scrY(b.z, 60), 20, { speed: 200, life: 0.5, size: 6, colors: ['#ffc53d', '#e8c48a'], glow: true }); b.state = 'bossact'; }
    if (a.step === 1 && a.t > 0.5) {
      a.step = 2; b.hidden = false;
      const bnd = S.bounds(b);
      b.x = clamp(h.x - h.face * 140, bnd[0], bnd[1]); b.z = h.z; b.face = sign(h.x - b.x) || 1;
      Particles.burst(b.x, scrY(b.z, 60), 20, { speed: 200, life: 0.5, size: 6, colors: ['#ffc53d', '#e8c48a'], glow: true });
      b.startMove(b.def.moves[0]);
      return true;
    }
    return false;
  },
  sandstorm(b, dt, a, h) {
    bossPose(b, 'cast'); b.castColor = '#e8c48a';
    if (a.step === 0) {
      a.step = 1; Sfx.play('fire');
      const lanes = [30, 95, 160];
      const skip = RI(0, 2);
      lanes.forEach((z, i) => { if (i === skip && !b.enraged) return; S.addProj(new Projectile({ team: 'enemy', owner: b, kind: 'sandnado', x: b.x, y: 30, z, vx: b.face * 230, r: 30, rz: 30, dmg: b.dmg * 0.9, kx: 200, ky: 240, fall: 100, life: 5, pierce: 999, unblockable: true })); });
    }
    return a.t > 1;
  },
  beam(b, dt, a, h) {
    bossPose(b, 'cast'); b.castColor = '#ffc53d';
    if (a.step === 0) {
      a.step = 1;
      laneTelegraph(h.z, S.arena[0], S.arena[1], 1.0, b.dmg * 1.3, { owner: b, kind: 'beam', life: 0.45, tick: 0.2, color: '#ffc53d', rz: 30, unblockable: true, onFire: () => { Sfx.play('zap'); S.shake(6); } });
    }
    return a.t > 1.6;
  },
  icicles(b, dt, a, h) {
    bossPose(b, 'cast'); b.castColor = '#7fe3ff';
    if (a.step === 0) {
      a.step = 1;
      const n = 6 + (b.enraged ? 3 : 0);
      for (let i = 0; i < n; i++) {
        const x = i === 0 ? h.x : h.x + R(-360, 360), z = i === 0 ? h.z : R(10, DEPTH - 10);
        S.telegraph({ x, z, rx: 46, rz: 20, delay: 1.0 + i * 0.07, team: 'enemy', owner: b, dmg: b.dmg * 0.8, el: 'ice', chill: 2, color: '#7fe3ff',
          onFire: (zn) => { Sfx.play('shatter'); for (let k = 0; k < 8; k++) Particles.add({ x: zn.x + R(-10, 10), y: scrY(zn.z, R(0, 20)), vx: R(-150, 150), vy: R(-250, -60), g: 900, life: 0.5, size: 5, color: '#bff5ff', type: 'shard' }); } });
      }
    }
    return a.t > 1.5;
  },
  nova(b, dt, a, h) {
    bossPose(b, 'cast'); b.castColor = '#7fe3ff';
    if (a.step === 0) { a.step = 1; S.telegraph({ x: b.x, z: b.z, rx: 230, rz: 95, delay: 0.9, team: 'enemy', owner: b, dmg: b.dmg, el: 'ice', chill: 3, kx: 260, color: '#7fe3ff', onFire: (zn) => { Sfx.play('ice'); Particles.add({ x: zn.x, y: scrY(zn.z, 0), type: 'ring', size: 230, life: 0.4, color: '#bff5ff' }); } }); }
    return a.t > 1.3;
  },
  snowballs(b, dt, a, h) {
    bossPose(b, 'attack', 'throwP');
    if (a.t > a.step * 0.25 && a.step < 5) {
      a.step++; b.animT = 0;
      const T = 0.9, tx = h.x + R(-120, 120), tz = clamp(h.z + R(-60, 60), 0, DEPTH);
      S.telegraph({ x: tx, z: tz, rx: 62, rz: 26, delay: T, team: 'enemy', owner: b, dmg: b.dmg * 0.8, el: 'ice', chill: 1, color: '#7fe3ff' });
      S.addProj(new Projectile({ team: 'enemy', owner: b, kind: 'snowball', x: b.x, y: 160, z: b.z, vx: (tx - b.x) / T, vz: (tz - b.z) / T, vy: 0.5 * 900 * T - 160 / T, g: 900, r: 16, dmg: 0, life: 3, onLand: (p) => { p.dead = true; Particles.burst(p.x, scrY(p.z, 10), 10, { speed: 200, life: 0.5, size: 5, colors: ['#fff', '#dff3ff'], g: 600 }); } }));
      Sfx.play('throw');
    }
    return a.t > 1.8;
  },
  meteors(b, dt, a, h) {
    bossPose(b, 'cast'); b.castColor = '#ff7a2f';
    if (a.step === 0) {
      a.step = 1; Sfx.play('roar');
      const n = 6 + (b.enraged ? 4 : 0);
      for (let i = 0; i < n; i++) {
        const x = i === 0 ? h.x : h.x + R(-380, 380), z = i === 0 ? h.z : R(10, DEPTH - 10);
        S.telegraph({ x, z, rx: 64, rz: 28, delay: 1.0 + i * 0.12, team: 'enemy', owner: b, dmg: b.dmg, el: 'fire', launch: 260, color: '#ff7a2f', meteor: true, onFire: (zn) => explosion(zn.x, zn.z, 70, '#ff7a2f') });
      }
    }
    return a.t > 1.8;
  },
  breath(b, dt, a, h) {
    bossPose(b, 'attack', 'bite'); b.animT = 0.4;
    if (a.step < 3 && a.t > a.step * 0.7) {
      a.step++;
      const x1 = b.x - 60, x0 = b.x - 700;
      laneTelegraph(h.z, x0, x1, 0.6, b.dmg * 0.7, { owner: b, kind: 'breath', life: 0.5, tick: 0.25, el: 'fire', color: '#ff7a2f', rz: 38, onFire: () => Sfx.play('fire') });
    }
    return a.t > 2.6;
  },
  tail(b, dt, a, h) {
    bossPose(b, 'attack', 'swingBig');
    if (a.step === 0) { a.step = 1; S.telegraph({ x: b.x - 60, z: b.z, rx: 260, rz: 80, delay: 0.8, team: 'enemy', owner: b, dmg: b.dmg * 1.1, launch: 300, color: '#ff4f73', onFire: () => { S.shake(8); Sfx.play('heavy'); } }); }
    return a.t > 1.3;
  },
  coins(b, dt, a, h) {
    bossPose(b, 'attack', 'bite'); b.animT = 0.3;
    if (a.t > a.step * 0.12 && a.step < 10) {
      a.step++;
      const T = 0.8, tx = h.x + R(-200, 200), tz = R(10, DEPTH - 10);
      S.addProj(new Projectile({ team: 'enemy', owner: b, kind: 'coin', x: b.x, y: 100, z: b.z, vx: (tx - b.x) / T, vz: (tz - b.z) / T, vy: 0.5 * 900 * T - 100 / T, g: 900, r: 10, dmg: b.dmg * 0.5, kx: 60, fall: 20, life: 3,
        onLand: (p) => { p.dead = true; if (Math.random() < 0.5) S.addPickup(new Pickup({ kind: 'coin', value: 1, x: p.x, z: p.z, vy: 120 })); } }));
      Sfx.play('coin');
    }
    return a.t > 1.5;
  },
  beams(b, dt, a, h) {
    bossPose(b, 'cast'); b.castColor = '#ff3df2';
    if (a.step === 0) {
      a.step = 1;
      const lanes = [28, 95, 162];
      const safe = RI(0, 2);
      lanes.forEach((z, i) => { if (i !== safe) laneTelegraph(z, S.arena[0], S.arena[1], 1.1, b.dmg * 0.9, { owner: b, kind: 'beam', life: 0.5, tick: 0.25, color: '#ff3df2', rz: 30, unblockable: true, onFire: () => { Sfx.play('zap'); S.shake(5); } }); });
      a.safe = safe;
    }
    if (a.step === 1 && a.t > 1.8) {
      a.step = 2;
      const lanes = [28, 95, 162];
      laneTelegraph(lanes[a.safe], S.arena[0], S.arena[1], 0.9, b.dmg * 0.9, { owner: b, kind: 'beam', life: 0.5, tick: 0.25, color: '#3dfff6', rz: 30, unblockable: true, onFire: () => Sfx.play('zap') });
    }
    return a.t > 3;
  },
  countdown(b, dt, a, h) {
    bossPose(b, 'cast'); b.castColor = '#ff3df2';
    if (a.step === 0) {
      a.step = 1;
      Sfx.play('dialup');
      a.safes = [];
      for (let i = 0; i < 2; i++) {
        const x = S.arena[0] + 150 + (i + R(0.1, 0.9)) * (S.arena[1] - S.arena[0] - 300) / 2;
        const z = R(40, DEPTH - 40);
        a.safes.push(S.addZone(new Zone({ team: 'none', kind: 'safe', x, z, rx: 70, rz: 30, life: 3.4 })));
      }
    }
    const n = 3 - Math.floor(a.t);
    if (n !== a.last && n > 0) { a.last = n; S.banner(String(n), '#ff3df2', 0.8); Sfx.play('banner'); }
    if (a.t > 3.1 && a.step === 1) {
      a.step = 2;
      S.flashWhite = 0.5; S.shake(16); Sfx.play('boom');
      const safe = a.safes.some((z) => z.contains(h, 10));
      if (!safe) dealDamage(b, h, { dmg: b.dmg * 2, unblockable: true, kx: 200, ky: 300, fall: 100, ignoreInv: true });
      else Floaters.add(h.x, scrY(h.z, 150), 'SAFE!', { color: '#3ee6a8', size: 26 });
      S.banner('Y2K!', '#ff3df2', 1);
    }
    return a.t > 3.6;
  },
  glitchballs(b, dt, a, h) {
    bossPose(b, 'cast'); b.castColor = '#3dfff6';
    if (a.t > a.step * 0.2 && a.step < 6) {
      a.step++;
      S.addProj(new Projectile({ team: 'enemy', owner: b, kind: 'glitchball', x: b.x - 60, y: 90, z: b.z, vx: -R(180, 280), vz: R(-200, 200), bounceZ: true, r: 16, dmg: b.dmg * 0.6, el: 'glitch', life: 5, kx: 90, fall: 30 }));
      Sfx.play('zap');
    }
    return a.t > 1.5;
  },
};
