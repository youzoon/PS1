// ============================================================
//  Entities: Fighter (heroes & enemies), Projectile, Zone, Pickup, Prop
// ============================================================
let S = null;           // current stage (set by Stage)
let NEXT_ID = 1;
const GRAV = 1600;
const depthScale = (z) => 0.86 + 0.22 * (z / DEPTH);
const scrY = (z, y) => GROUND_TOP + z - y;

class Fighter {
  constructor(o) {
    this.id = NEXT_ID++;
    this.team = o.team;
    this.kind = o.kind;
    this.def = o.def;
    this.isHero = o.team === 'hero';
    this.isBoss = !!o.boss; this.isElite = !!o.elite;
    this.x = o.x; this.y = o.y || 0; this.z = clamp(o.z ?? DEPTH / 2, 0, DEPTH);
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.face = o.face || 1;
    this.scale = o.scale || 1;
    this.art = o.def.art || 'human';
    this.look = Object.assign({}, o.def.look);
    this.maxHp = o.hp; this.hp = o.hp;
    this.mp = 0; this.maxMp = 0;
    this.state = 'idle'; this.stateT = 0;
    this.anim = 'idle'; this.animT = 0;
    this.clock = Math.random() * 10;
    this.walkPhase = 0;
    this.move = null; this.hitIds = new Set(); this.multiT = 0;
    this.combo = 0; this.comboWin = 0; this.buffer = 0;
    this.st = { burn: 0, burnDps: 0, burnSrc: null, chill: 0, chillT: 0, frozen: 0, stun: 0, slowT: 0, shock: 0, poison: 0 };
    this.inv = 0; this.flash = 0; this.fall = 0;
    this.w = (o.def.w || 34) * this.scale;
    this.h = (o.def.h || 104) * this.scale;
    this.weight = o.def.weight || 1;
    this.ts = 1;             // local time scale
    this.dead = false; this.remove = false;
    this.airAtk = false; this.jumps = 0;
    this.blinkT = R(2, 5); this.blinking = 0;
    this.dmg = o.dmg || 8;
    this.speed = o.speed || 100;
    this.ai = o.ai || null;
    this.flying = !!o.def.flying;
    if (this.flying) this.y = 0;
    this.shield = 0; this.mods = [];
    this.held = null;
    this.spawnT = 0;
    this.moving = false;
  }
  get alive() { return !this.dead; }
  get grounded() { return this.y <= 0.01 && !this.flying; }
  canAct() { return !this.dead && ['idle', 'walk', 'run', 'land', 'block', 'hold'].includes(this.state); }
  setState(s, anim) {
    this.state = s; this.stateT = 0;
    this.anim = anim || s; this.animT = 0;
    if (s !== 'attack') { this.move = null; }
  }
  facingTo(o) { return sign(o.x - this.x); }
  isFacing(o) { return (o.x - this.x) * this.face >= -4; }

  startMove(name, opts = {}) {
    const m = MOVES[name];
    if (!m) return;
    const spd = this.isHero ? S.hero.stats.atkSpeed : 1;
    const mv = Object.assign({}, m, opts);
    mv.name = name;
    mv.windup /= spd; mv.active /= Math.min(spd, 1.3); mv.recover /= spd;
    this.move = mv;
    this.state = 'attack'; this.stateT = 0; this.anim = 'attack'; this.animT = 0;
    this.hitIds.clear(); this.multiT = 0;
    this.attacking = true;
    if (!mv.air) this.vx *= 0.2;
    Sfx.play('whoosh');
  }

  update(dt) {
    const st = this.st;
    // status effects tick in real (not local) time so freezes stay fair
    if (st.frozen > 0) {
      st.frozen -= dt;
      if (st.frozen <= 0) { st.frozen = 0; for (let i = 0; i < 8; i++) Particles.add({ x: this.x + R(-15, 15), y: scrY(this.z, this.y) - R(10, 60), vx: R(-80, 80), vy: R(-160, -40), g: 500, life: 0.5, size: 4, color: '#bff5ff', type: 'shard' }); }
    }
    if (st.burn > 0) {
      st.burn -= dt;
      st.burnTick = (st.burnTick || 0) - dt;
      if (st.burnTick <= 0) {
        st.burnTick = 0.4;
        dealDamage(st.burnSrc, this, { dmg: st.burnDps * 0.4, el: 'fire', dot: true });
      }
      if (Math.random() < dt * 20) Particles.add({ x: this.x + R(-12, 12) * this.scale, y: scrY(this.z, this.y) - R(10, this.h * 0.8), vx: R(-10, 10), vy: R(-90, -40), life: 0.5, size: R(3, 6), color: pick(['#ff7a2f', '#ffd35c']), glow: true });
    }
    if (st.poison > 0) {
      st.poison -= dt; st.poisonTick = (st.poisonTick || 0) - dt;
      if (st.poisonTick <= 0) { st.poisonTick = 0.5; dealDamage(null, this, { dmg: st.poisonDps * 0.5, el: 'poison', dot: true }); }
    }
    if (st.chillT > 0) { st.chillT -= dt; if (st.chillT <= 0) st.chill = 0; }
    if (st.slowT > 0) st.slowT -= dt;
    if (st.shock > 0) st.shock -= dt;
    // time scale: chrono bubbles / time stop / overdrive
    let ts = 1;
    if (!this.isHero) {
      if (S.timeStop > 0 && !this.ignoreTime) ts = 0;
      else {
        if (S.inChrono(this)) ts *= 0.3;
        if (st.slowT > 0) ts *= 0.55;
        if (S.hero && S.hero.overdrive > 0) ts *= 0.5;
        if (st.chill > 0) ts *= 1 - Math.min(0.5, st.chill * 0.15);
      }
    }
    if (st.frozen > 0) ts = 0;
    this.ts = ts;
    const ldt = dt * ts;
    this.clock += ldt;
    this.stateT += ldt; this.animT += ldt;
    if (this.inv > 0) this.inv -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.fall > 0) this.fall = Math.max(0, this.fall - 45 * ldt);
    if (this.comboWin > 0) { this.comboWin -= ldt; if (this.comboWin <= 0) this.combo = 0; }
    if (this.buffer > 0) this.buffer -= dt;
    // blinking eyes
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blinking = 0.12; this.blinkT = R(2, 5); }
    if (this.blinking > 0) this.blinking -= dt;
    this.look._blink = this.blinking > 0; this.look._t = this.clock;
    if (ldt <= 0) return;
    this.updateState(ldt);
    this.physics(ldt);
  }

  updateState(dt) {
    const m = this.move;
    switch (this.state) {
      case 'attack': {
        if (!m) { this.setState('idle'); break; }
        const t = this.stateT;
        // lunge during windup end / active
        if (m.lunge && t >= m.windup * 0.5 && t < m.windup + m.active) {
          const k = this.isHero ? 1 : 0.8;
          this.vx = this.face * m.lunge * k * (m.air ? 0 : 1) + (m.air ? this.vx : 0);
        } else if (!m.air) this.vx *= 0.8;
        if (t >= m.windup && t < m.windup + m.active) {
          this.activeHit = true;
          if (m.multi) { this.multiT -= dt; if (this.multiT <= 0) { this.multiT = m.multi; this.hitIds.clear(); } }
          if (!this.sfxActive) { this.sfxActive = true; if (m.shock) this.onShock(m); }
        } else this.activeHit = false;
        const total = m.windup + m.active + m.recover;
        // hero combo cancel into next move during recovery
        if (this.isHero && t >= m.windup + m.active && this.buffer > 0 && !m.air) {
          this.sfxActive = false;
          heroNextCombo(this);
          break;
        }
        if (m.air) {
          if (this.grounded && t > 0.05) { this.sfxActive = false; this.attacking = false; this.setState('land'); }
        } else if (t >= total) {
          this.sfxActive = false; this.attacking = false; this.activeHit = false;
          this.setState(this.held ? 'hold' : 'idle');
        }
        break;
      }
      case 'hurt': if (this.stateT > (this.hurtDur || 0.3)) this.setState('idle'); break;
      case 'air': if (this.grounded && this.stateT > 0.05) { this.setState('down'); this.vx *= 0.3; Sfx.play('land'); dust(this.x, this.z, 10); if (this.onDownHit) this.onDownHit(); } break;
      case 'down': {
        if (this.dead) break;
        const dur = this.isHero ? 0.55 : this.isBoss ? 0.5 : 0.8;
        if (this.stateT > dur) { this.setState('getup'); this.inv = 0.5; }
        break;
      }
      case 'getup': if (this.stateT > 0.35) { this.setState('idle'); if (this.isHero) this.inv = 1.0; this.fall = 0; } break;
      case 'stun': if (this.stateT > (this.stunDur || 1)) this.setState('idle'); break;
      case 'land': if (this.stateT > 0.1) this.setState(this.held ? 'hold' : 'idle'); break;
      case 'cast': if (this.stateT > (this.castDur || 0.3)) this.setState('idle'); break;
      case 'throw': if (this.stateT > 0.25) this.setState('idle'); break;
      case 'dash': if (this.stateT > (this.dashDur || 0.2)) { this.setState('idle'); this.vx *= 0.2; } break;
      case 'spawn': if (this.stateT > 0.45) this.setState('idle'); break;
      case 'dead': {
        if (this.stateT > 1.4 && !this.isHero) this.remove = true;
        break;
      }
      case 'jump': {
        if (this.grounded && this.stateT > 0.05) { this.setState('land'); Sfx.play('land'); dust(this.x, this.z, 6); this.jumps = 0; this.airAtk = false; }
        break;
      }
    }
  }

  physics(dt) {
    // gravity
    if (!this.flying || this.state === 'air' || this.state === 'dead' || this.state === 'down') {
      if (this.y > 0 || this.vy > 0) {
        this.vy -= GRAV * dt;
        this.y += this.vy * dt;
        if (this.y <= 0) {
          this.y = 0;
          if (this.state === 'air' && this.vy < -420 && !this.bounced) { this.vy = -this.vy * 0.35; this.y = 0.1; this.bounced = true; this.vx *= 0.6; dust(this.x, this.z, 6); Sfx.play('land'); }
          else { this.vy = 0; this.bounced = false; }
        }
      }
    } else {
      // flyers hover
      const targetY = this.hoverY ?? 46;
      this.y = lerp(this.y, targetY, Math.min(1, dt * 3));
    }
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    // friction
    const onGround = this.y <= 0.01;
    if (onGround && !['walk', 'run', 'attack', 'dash', 'hold'].includes(this.state)) { this.vx *= Math.pow(0.0005, dt); this.vz *= Math.pow(0.0005, dt); }
    if (this.state === 'down' || this.state === 'dead') { this.vx *= Math.pow(0.001, dt); }
    this.z = clamp(this.z, 0, DEPTH);
    // bounds
    const b = S.bounds(this);
    if (this.x < b[0]) { this.x = b[0]; if (this.state === 'air') this.vx = Math.abs(this.vx) * 0.4; }
    if (this.x > b[1]) { this.x = b[1]; if (this.state === 'air') this.vx = -Math.abs(this.vx) * 0.4; }
  }

  // hurtbox test against a world-space box
  overlaps(x0, x1, y0, y1, z, zr) {
    const hw = this.w * 0.5;
    if (this.x + hw < x0 || this.x - hw > x1) return false;
    const by = this.y + (this.flying ? -10 : 0);
    if (by + this.h < y0 || by > y1) return false;
    return Math.abs(this.z - z) <= zr + 10;
  }
  hitBox() {
    const m = this.move;
    const s = this.scale * (this.isHero ? S.hero.stats.reach : 1);
    const a = this.x + this.face * m.hit.x0 * s, b = this.x + this.face * m.hit.x1 * s;
    return { x0: Math.min(a, b), x1: Math.max(a, b), y0: this.y + m.hit.y0 * this.scale, y1: this.y + m.hit.y1 * this.scale, z: this.z, zr: m.hit.zr * Math.max(1, this.scale * 0.85) };
  }
  onShock(m) {
    // ground shock (slams): dust ring + screenshake
    S.shake(m.shake || 6);
    const x = this.x + this.face * 60 * this.scale;
    Particles.add({ x, y: scrY(this.z, 0), type: 'ring', size: 60 * this.scale, life: 0.35, color: '#fff' });
    dust(x, this.z, 14);
    if (this.isHero && S.hero.cards.wpn_earth) {
      S.addZone(new Zone({ team: 'hero', x, z: this.z, rx: 110, rz: 50, life: 0.25, kind: 'quakeRing', dmg: S.hero.baseDmg() * 1.2, el: 'earth', owner: this, once: true, launch: 260 }));
    }
  }
}

function heroNextCombo(f) {
  const h = S.hero;
  f.buffer = 0;
  const combo = h.weaponType.combo;
  h.comboStep = (h.comboStep + 1) % combo.length;
  f.attacking = false;
  f.startMove(combo[h.comboStep]);
  // a short forward step makes combos feel connected
}

// ------------------------------------------------------------
//  Damage resolution
// ------------------------------------------------------------
function dealDamage(att, tgt, info) {
  if (!tgt || tgt.dead) return 0;
  if (tgt.isHero && S.god) return 0;
  if (!info.dot && !info.ignoreInv && (tgt.inv > 0 || tgt.state === 'down' || tgt.state === 'getup' || tgt.state === 'spawn' || tgt.hidden)) return 0;
  const hero = S.hero;
  let dmg = info.dmg;
  const heroAtk = att && att.isHero;
  let crit = false;
  if (heroAtk && !info.dot) {
    const st = hero.stats;
    if (Math.random() < st.critChance) { crit = true; dmg *= st.critMul; }
    if (info.melee) {
      if (hero.cards.comboGloves) dmg *= 1 + Math.min(hero.cards.comboGloves * 0.25, S.combo * hero.cards.comboGloves * 0.01);
      if (info.finisher) dmg *= st.finisherMul;
    }
    if (info.spell) dmg *= st.spellMul;
    dmg *= st.dmgMul;
    if (hero.hp < hero.maxHp * 0.35) dmg *= 1 + st.berserk;
    if (hero.overdrive > 0) dmg *= 2;
    if (info.el === 'storm' && hero.cards.duo_plasma && tgt.st.burn > 0) dmg *= 1.4;
  }
  // blocking
  if (!info.dot && !info.unblockable && tgt.state === 'block' && att && tgt.isFacing(att)) {
    const mul = tgt.isHero ? hero.stats.blockMul : 0.15;
    dmg *= mul;
    tgt.hp -= dmg;
    tgt.vx = -tgt.face * 90;
    Sfx.play('block');
    spark(tgt.x + tgt.face * 16, tgt.z, tgt.y + tgt.h * 0.55, '#bfe9ff', 6);
    S.hitstop = Math.max(S.hitstop, 0.03);
    if (tgt.isHero) { tgt.guard = (tgt.guard || 0) + info.dmg; if (tgt.guard > tgt.maxHp * 0.5) { tgt.guard = 0; tgt.setState('stun'); tgt.stunDur = 0.9; Floaters.add(tgt.x, scrY(tgt.z, tgt.h + 20), 'GUARD BREAK', { color: '#ff4f73', size: 18 }); } }
    if (!tgt.isHero && tgt.def.blocker) { tgt.blockHits = (tgt.blockHits || 0) + 1; }
    if (tgt.hp <= 0) killFighter(tgt, att, info);
    return dmg;
  }
  // shatter frozen targets
  if (tgt.st.frozen > 0 && !info.dot && (info.el === 'fire' || info.el === 'earth' || info.heavy || info.finisher)) {
    dmg = dmg * 2 + 10;
    tgt.st.frozen = 0;
    Sfx.play('shatter');
    for (let i = 0; i < 18; i++) Particles.add({ x: tgt.x + R(-20, 20), y: scrY(tgt.z, tgt.y) - R(10, tgt.h), vx: R(-260, 260), vy: R(-360, -60), g: 900, life: R(0.5, 0.9), size: R(3, 7), color: pick(['#bff5ff', '#7fe3ff', '#ffffff']), type: 'shard' });
    Floaters.add(tgt.x, scrY(tgt.z, tgt.h + 30), 'SHATTER!', { color: '#bff5ff', size: 22 });
    if (heroAtk) { SAVE.stats.shatters++; if (SAVE.stats.shatters >= 10) unlockAch('shatter'); }
    if (heroAtk && hero.cards.duo_steam && info.el === 'fire') steamBurst(tgt.x, tgt.z, hero);
  }
  // elite shield
  if (tgt.shield > 0) {
    const a = Math.min(tgt.shield, dmg); tgt.shield -= a; dmg -= a;
    spark(tgt.x, tgt.z, tgt.y + tgt.h * 0.5, '#55c8ff', 4);
  }
  dmg = Math.max(0, dmg);
  tgt.hp -= dmg;
  tgt.flash = 0.08;
  if (dmg > 0 && SAVE.settings.dmgNums && (!info.dot || dmg >= 2)) {
    const color = tgt.isHero ? '#ff4f73' : crit ? '#ffe45c' : info.dot ? EL[info.el]?.c || '#fff' : '#ffffff';
    Floaters.add(tgt.x + R(-10, 10), scrY(tgt.z, tgt.y + tgt.h + 8), (crit ? '' : '') + Math.round(dmg) + (crit ? '!' : ''), { color, size: crit ? 30 : info.dot ? 16 : 22, pop: crit ? 1.4 : 1 });
  }
  if (!info.dot) {
    const hs = info.stop ?? 0.05;
    S.hitstop = Math.max(S.hitstop, crit ? hs + 0.04 : hs);
    Sfx.play(crit ? 'crit' : info.sfx || 'hit');
    const col = info.el && info.el !== 'phys' ? EL[info.el].c : '#fff4c2';
    spark(tgt.x - (att ? sign(tgt.x - att.x) * 8 : 0), tgt.z, tgt.y + tgt.h * 0.6, col, crit ? 12 : 7);
    if (crit || info.heavy || info.finisher) S.shake(crit ? 6 : 4);
  }
  // hero-side bookkeeping
  if (heroAtk) {
    if (!info.dot) {
      S.combo++; S.comboT = 2.4;
      S.maxCombo = Math.max(S.maxCombo, S.combo);
      if (crit) SAVE.stats.crits++;
    }
    hero.addOverdrive(dmg * 0.3);
    if (hero.stats.lifesteal > 0) hero.heal(dmg * hero.stats.lifesteal, true);
    S.dmgDealt += dmg;
  }
  if (tgt.isHero) {
    S.tookDamage = true;
    if (S.dmgLog) { const k = (att ? att.kind + (att.isBoss ? '*' : '') : 'env') + ':' + (info.el || 'phys') + (info.dot ? ':dot' : ''); S.dmgLog[k] = (S.dmgLog[k] || 0) + dmg; }
    hero.addOverdrive(dmg * 0.6);
    S.flashRed = 0.25;
    if (att && !info.dot && hero.stats.thorns > 0 && info.melee) dealDamage(hero, att, { dmg: info.dmg * hero.stats.thorns, el: 'earth', dot: true });
    if (att && att.mods && att.mods.includes('vampiric')) att.hp = Math.min(att.maxHp, att.hp + dmg);
  }
  // element statuses
  if (!info.dot) applyElement(att, tgt, info, dmg);
  if (tgt.hp <= 0) { killFighter(tgt, att, info, dmg); return dmg; }
  if (tgt.isHero && !info.dot && dmg > 0) tgt.inv = Math.max(tgt.inv, 0.35);
  // reactions
  if (!info.dot && !info.noKnock) react(tgt, att, info);
  return dmg;
}

function applyElement(att, tgt, info, dmg) {
  const el = info.el;
  const hero = S.hero;
  if (el === 'fire') { tgt.st.burn = Math.max(tgt.st.burn, 2.5); tgt.st.burnDps = Math.max(tgt.st.burnDps, Math.max(3, dmg * 0.3)); tgt.st.burnSrc = att; }
  else if (el === 'ice') {
    tgt.st.chill += info.chill || 1; tgt.st.chillT = 3;
    const need = tgt.isBoss ? 6 : 3;
    if (tgt.st.chill >= need && !tgt.isHero) {
      tgt.st.chill = 0;
      let dur = tgt.isBoss ? 1.0 : 2.4;
      if (hero && hero.cards.duo_permafrost) dur *= 1.6;
      tgt.st.frozen = dur;
      Sfx.play('ice');
      if (tgt.state === 'air') tgt.vx = 0;
    } else if (tgt.isHero && tgt.st.chill >= 5) { tgt.st.chill = 0; tgt.st.frozen = 0.7; Floaters.add(tgt.x, scrY(tgt.z, tgt.h + 30), 'FROZEN!', { color: '#7fe3ff', size: 18 }); }
  }
  else if (el === 'storm') { tgt.st.shock = 0.5; if (!tgt.isBoss && !info.noStun) { tgt.st.stunMini = 0.25; } }
  else if (el === 'time') { tgt.st.slowT = Math.max(tgt.st.slowT, info.slow || 2); }
  else if (el === 'poison') { tgt.st.poison = 4; tgt.st.poisonDps = Math.max(2, dmg * 0.3); }
  else if (el === 'earth') { tgt.fall += 30; }
  // weapon infusions on hero basic attacks
  if (att && att.isHero && info.melee) {
    const c = hero.cards;
    if (c.wpn_fire && el !== 'fire') { tgt.st.burn = 2; tgt.st.burnDps = Math.max(tgt.st.burnDps, 3 + hero.baseDmg() * 0.25); tgt.st.burnSrc = att; }
    if (c.wpn_ice) { tgt.st.chill += 1; tgt.st.chillT = 3; if (tgt.st.chill >= (tgt.isBoss ? 6 : 3)) { tgt.st.chill = 0; tgt.st.frozen = (tgt.isBoss ? 0.8 : 2) * (c.duo_permafrost ? 1.6 : 1); Sfx.play('ice'); } }
    if (c.wpn_time) tgt.st.slowT = Math.max(tgt.st.slowT, 1.5);
    if (c.wpn_storm && Math.random() < 0.5) chainLightning(att, tgt, 1, hero.baseDmg() * 0.6, 170, [tgt.id]);
  }
}

function react(tgt, att, info) {
  const dir = info.dir ?? (att ? sign(tgt.x - att.x) : -tgt.face);
  if (tgt.st.frozen > 0) { tgt.vx = dir * 40; return; }
  const bossArmor = tgt.isBoss || (tgt.def && tgt.def.noKnock);
  if (bossArmor) {
    // bosses flinch only when idle-ish, never get juggled
    tgt.fall += (info.fall || 20) * 0.35;
    if (tgt.fall >= 100 && tgt.canAct() && !tgt.def.noKnock) { tgt.fall = 0; tgt.setState('hurt'); tgt.hurtDur = 0.25; }
    return;
  }
  tgt.fall += info.fall || 20;
  if (tgt.isHero && tgt.overdrive > 0) return; // super armor during overdrive
  if (tgt.state === 'air' || tgt.fall >= 100 || (info.ky || 0) >= 200) {
    // launch
    tgt.setState('air');
    tgt.vy = Math.max(info.ky || 0, tgt.state === 'air' ? 180 : 260) / Math.sqrt(tgt.weight);
    tgt.vx = dir * (info.kx || 120) / tgt.weight;
    tgt.y = Math.max(tgt.y, 1);
    tgt.fall = 0;
    tgt.attacking = false;
  } else {
    tgt.setState('hurt');
    tgt.hurtDur = tgt.isHero ? 0.22 : 0.32;
    tgt.vx = dir * (info.kx || 60) * 0.7 / tgt.weight;
    tgt.attacking = false;
    if (tgt.st.stunMini) { tgt.hurtDur += tgt.st.stunMini; tgt.st.stunMini = 0; }
  }
}

function killFighter(f, att, info, dmg) {
  if (f.dead) return;
  if (f.isHero) { S.heroDown(f); return; }
  f.dead = true;
  f.hp = 0;
  f.setState('dead');
  f.vy = 320; f.vx = (att ? sign(f.x - att.x) : -f.face) * 180 / f.weight; f.y = Math.max(f.y, 2);
  f.flying = false;
  Sfx.play('die');
  S.onKill(f, att, info);
  // overkill splash (skill)
  if (att && att.isHero && skillRank('m5') && dmg > 0) {
    S.addZone(new Zone({ team: 'hero', x: f.x, z: f.z, rx: 90, rz: 40, life: 0.2, kind: 'burst', dmg: Math.max(8, dmg * 0.6), el: 'phys', owner: att, once: true, color: '#ff4f73' }));
  }
  if (f.mods.includes('explosive')) {
    S.telegraph({ x: f.x, z: f.z, rx: 100, rz: 45, delay: 0.8, team: 'enemy', dmg: f.dmg * 2, color: '#ff7a2f', onFire: (z) => explosion(z.x, z.z, 100, '#ff7a2f') });
  }
}

// ------------------------------------------------------------
//  FX helpers
// ------------------------------------------------------------
function spark(x, z, y, color, n) {
  const sy = scrY(z, y);
  Particles.burst(x, sy, n, { speed: 380, life: 0.3, size: 4, colors: [color, '#ffffff'], type: 'line', drag: 0.85 });
  Particles.add({ x, y: sy, life: 0.14, size: 20, color, glow: true });
  Particles.add({ x, y: sy, life: 0.1, size: 12, color: '#ffffff', glow: true });
}
function dust(x, z, n) {
  const sy = scrY(z, 0);
  for (let i = 0; i < n; i++) Particles.add({ x: x + R(-14, 14), y: sy - R(0, 6), vx: R(-90, 90), vy: R(-50, -10), life: R(0.3, 0.6), size: R(5, 10), color: 'rgba(230,220,200,.8)', type: 'smoke', drag: 0.9 });
}
function explosion(x, z, r, color) {
  const sy = scrY(z, 20);
  Sfx.play('boom'); S.shake(10);
  Particles.add({ x, y: sy, life: 0.35, size: r * 0.9, color, glow: true });
  Particles.add({ x, y: scrY(z, 0), type: 'ring', size: r, life: 0.4, color: '#fff' });
  Particles.burst(x, sy, 26, { speed: 420, life: 0.6, size: 7, colors: [color, '#ffd35c', '#ffffff'], drag: 0.88, g: 300 });
  for (let i = 0; i < 8; i++) Particles.add({ x: x + R(-r * 0.5, r * 0.5), y: sy + R(-20, 10), vx: R(-40, 40), vy: R(-80, -20), life: R(0.6, 1.1), size: R(10, 18), color: 'rgba(60,50,60,.7)', type: 'smoke', drag: 0.92 });
}
function steamBurst(x, z, hero) {
  explosion(x, z, 120, '#e6fbff');
  S.addZone(new Zone({ team: 'hero', x, z, rx: 130, rz: 55, life: 0.2, kind: 'burst', dmg: hero.baseDmg() * 2.5, el: 'phys', owner: hero, once: true, launch: 300, color: '#e6fbff' }));
}

// ------------------------------------------------------------
//  Projectiles
// ------------------------------------------------------------
class Projectile {
  constructor(o) {
    Object.assign(this, { vx: 0, vy: 0, vz: 0, y: 50, g: 0, life: 2, pierce: 0, r: 16, rz: 22, hitIds: new Set(), t: 0, dead: false, spin: 0, reflect: false }, o);
    this.id = NEXT_ID++;
  }
  update(dt) {
    let ts = 1;
    if (this.team === 'enemy') {
      if (S.timeStop > 0) ts = 0;
      else { if (S.inChrono(this)) ts = 0.3; if (S.hero.overdrive > 0) ts *= 0.5; }
    }
    const d = dt * ts;
    this.t += d; this.life -= d;
    if (this.homing && this.target && !this.target.dead) {
      const tx = this.target.x, tz = this.target.z;
      const a = Math.atan2(tz - this.z, tx - this.x);
      const sp = Math.hypot(this.vx, this.vz);
      const cur = Math.atan2(this.vz, this.vx);
      let da = a - cur; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      const na = cur + clamp(da, -this.homing * d, this.homing * d);
      this.vx = Math.cos(na) * sp; this.vz = Math.sin(na) * sp;
    }
    this.vy -= this.g * d;
    this.x += this.vx * d; this.y += this.vy * d; this.z += this.vz * d;
    if (this.z < -10 || this.z > DEPTH + 10) { if (this.bounceZ) this.vz *= -1; else this.life = 0; }
    this.z = clamp(this.z, -10, DEPTH + 10);
    if (this.trail && Math.random() < d * 60) Particles.add({ x: this.x + R(-4, 4), y: scrY(this.z, this.y) + R(-4, 4), vx: -this.vx * 0.1, vy: R(-20, 20), life: 0.35, size: this.r * 0.6, color: this.trail, glow: true });
    if (this.y <= 0 && this.g > 0) { this.y = 0; if (this.onLand) { this.onLand(this); } else this.life = 0; }
    if (this.life <= 0) { this.dead = true; if (this.onExpire) this.onExpire(this); return; }
    // collision
    const targets = this.team === 'hero' ? S.enemies : S.heroes;
    for (const f of targets) {
      if (f.dead || this.hitIds.has(f.id)) continue;
      if (Math.abs(f.x - this.x) > this.r + f.w * 0.5) continue;
      if (Math.abs(f.z - this.z) > this.rz) continue;
      const fy = f.y + (f.flying ? -10 : 0);
      if (this.y < fy - this.r || this.y > fy + f.h + this.r) continue;
      if (this.team === 'enemy' && f.isHero && f.state === 'block' && f.isFacing(this) && !this.unblockable) {
        // blocked projectile
        Sfx.play('block'); spark(this.x, this.z, this.y, '#bfe9ff', 6);
        f.hp -= this.dmg * S.hero.stats.blockMul; if (f.hp <= 0) S.heroDown(f);
        this.dead = true; return;
      }
      this.hitIds.add(f.id);
      const dealt = dealDamage(this.owner, f, { dmg: this.dmg, el: this.el, kx: this.kx ?? 140, ky: this.ky ?? 0, fall: this.fall ?? 40, stop: 0.04, spell: this.team === 'hero' && this.spell, chill: this.chill, dir: sign(this.vx || (f.x - this.x)), heavy: this.heavy, unblockable: this.unblockable, ignoreInv: false });
      if (this.onHit) this.onHit(this, f, dealt);
      if (this.pierce-- <= 0) { this.dead = true; if (this.onExpire) this.onExpire(this); return; }
    }
  }
  draw(camX) {
    const x = this.x - camX, y = scrY(this.z, this.y);
    if (x < -80 || x > VIEW_W + 80) return;
    const g = ctx;
    // shadow
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, scrY(this.z, 0), this.r * 0.8, this.r * 0.25, 0, 0, TAU); g.fill();
    PROJ_ART[this.kind] ? PROJ_ART[this.kind](g, x, y, this) : (g.fillStyle = '#fff', g.beginPath(), g.arc(x, y, this.r, 0, TAU), g.fill());
  }
}
const PROJ_ART = {
  fireball(g, x, y, p) {
    g.globalCompositeOperation = 'lighter';
    drawGlow(x, y, p.r * 2.6, '#ff7a2f', 0.9); drawGlow(x, y, p.r * 1.4, '#ffd35c', 1);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#fff4c2'; g.beginPath(); g.arc(x, y, p.r * 0.45, 0, TAU); g.fill();
  },
  iceShard(g, x, y, p) {
    g.save(); g.translate(x, y); g.scale(sign(p.vx), 1);
    g.globalCompositeOperation = 'lighter'; drawGlow(0, 0, p.r * 2, '#7fe3ff', 0.6); g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#e6fbff'; g.strokeStyle = '#2f6bd8'; g.lineWidth = 2;
    const L = p.r * (p.big ? 3.2 : 1.6);
    g.beginPath(); g.moveTo(L, 0); g.lineTo(-L * 0.6, -p.r * 0.45); g.lineTo(-L * 0.35, 0); g.lineTo(-L * 0.6, p.r * 0.45); g.closePath(); g.fill(); g.stroke();
    g.restore();
  },
  boulder(g, x, y, p) {
    g.save(); g.translate(x, y); g.rotate(p.t * 10 * sign(p.vx));
    g.fillStyle = '#8a7a6a'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = p.r * (0.85 + (i % 3) * 0.08); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#6b5e50'; g.beginPath(); g.arc(-p.r * 0.3, -p.r * 0.2, p.r * 0.25, 0, TAU); g.fill();
    g.restore();
  },
  arrow(g, x, y, p) {
    g.save(); g.translate(x, y); g.rotate(Math.atan2(-p.vy, p.vx));
    g.strokeStyle = '#8a5a2b'; g.lineWidth = 3; g.beginPath(); g.moveTo(-18, 0); g.lineTo(14, 0); g.stroke();
    g.fillStyle = '#c9c3de'; g.beginPath(); g.moveTo(20, 0); g.lineTo(12, -4); g.lineTo(12, 4); g.fill();
    g.fillStyle = '#ff4f73'; g.fillRect(-18, -3, 6, 6);
    g.restore();
  },
  bomb(g, x, y, p) {
    g.fillStyle = '#2b2b3a'; g.strokeStyle = OUTLINE; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = Math.floor(p.t * 12) % 2 ? '#ffd35c' : '#ff4f73'; g.beginPath(); g.arc(x + 5, y - 9, 3, 0, TAU); g.fill();
  },
  iceball(g, x, y, p) { g.globalCompositeOperation = 'lighter'; drawGlow(x, y, p.r * 2, '#7fe3ff', 0.9); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#e6fbff'; g.beginPath(); g.arc(x, y, p.r * 0.5, 0, TAU); g.fill(); },
  spore(g, x, y, p) { g.globalCompositeOperation = 'lighter'; drawGlow(x, y, p.r * 2, '#8dff5a', 0.8); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#d9ffb8'; g.beginPath(); g.arc(x, y, p.r * 0.45, 0, TAU); g.fill(); },
  laser(g, x, y, p) { g.globalCompositeOperation = 'lighter'; g.fillStyle = '#ff4f73'; g.fillRect(x - 14, y - 2, 28, 4); drawGlow(x, y, 18, '#ff4f73', 0.6); g.globalCompositeOperation = 'source-over'; },
  glitchball(g, x, y, p) { for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#ff3df2' : '#3dfff6'; g.fillRect(x - 10 + R(-4, 4), y - 10 + R(-4, 4), 10, 10); } },
  sandball(g, x, y, p) { g.fillStyle = '#e8c48a'; g.beginPath(); g.arc(x, y, p.r * 0.8, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,240,200,.6)'; g.beginPath(); g.arc(x - 3, y - 3, p.r * 0.3, 0, TAU); g.fill(); },
  snowball(g, x, y, p) { g.fillStyle = '#ffffff'; g.strokeStyle = '#9fb4d8'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, p.r * 0.8, 0, TAU); g.fill(); g.stroke(); },
  barrel(g, x, y, p) { g.save(); g.translate(x, y); g.rotate(p.t * 8); g.fillStyle = '#a0703a'; g.strokeStyle = OUTLINE; g.lineWidth = 2; roundRect(g, -14, -16, 28, 32, 6); g.fill(); g.stroke(); g.fillStyle = '#6b4424'; g.fillRect(-14, -10, 28, 3); g.fillRect(-14, 6, 28, 3); g.restore(); },
  crate(g, x, y, p) { g.save(); g.translate(x, y); g.rotate(p.t * 7); g.fillStyle = '#c98b3a'; g.strokeStyle = OUTLINE; g.lineWidth = 2; g.fillRect(-16, -16, 32, 32); g.strokeRect(-16, -16, 32, 32); g.beginPath(); g.moveTo(-16, -16); g.lineTo(16, 16); g.stroke(); g.restore(); },
  rock(g, x, y, p) { PROJ_ART.boulder(g, x, y, p); },
  leaf(g, x, y, p) { g.save(); g.translate(x, y); g.rotate(p.t * 12); g.fillStyle = '#5cc063'; g.strokeStyle = OUTLINE; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, 12, 5, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); },
  coin(g, x, y, p) { g.save(); g.translate(x, y); g.scale(Math.cos(p.t * 14), 1); g.fillStyle = '#ffc53d'; g.strokeStyle = '#a86400'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fill(); g.stroke(); g.restore(); },
  tornado(g, x, y, p) {
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { const yy = y + 30 - i * 16; const w = 12 + i * 6; g.strokeStyle = i % 2 ? 'rgba(255,122,47,.8)' : 'rgba(255,211,92,.7)'; g.lineWidth = 5; g.beginPath(); g.ellipse(x + Math.sin(p.t * 10 + i) * 6, yy, w, w * 0.28, 0, 0, TAU); g.stroke(); }
    drawGlow(x, y, 60, '#ff7a2f', 0.4);
    g.globalCompositeOperation = 'source-over';
  },
  sandnado(g, x, y, p) {
    for (let i = 0; i < 6; i++) { const yy = y + 30 - i * 14; const w = 10 + i * 6; g.strokeStyle = 'rgba(232,196,138,.85)'; g.lineWidth = 5; g.beginPath(); g.ellipse(x + Math.sin(p.t * 10 + i) * 5, yy, w, w * 0.3, 0, 0, TAU); g.stroke(); }
  },
};

// ------------------------------------------------------------
//  Zones: area effects (spell fields, telegraphs, hazards)
// ------------------------------------------------------------
class Zone {
  constructor(o) {
    Object.assign(this, { t: 0, life: 1, tick: 0, tickT: 0, rx: 80, rz: 30, hitIds: new Set(), dead: false, once: false, delay: 0 }, o);
    this.id = NEXT_ID++;
  }
  contains(f, pad = 0) {
    if (this.lane) return Math.abs(f.x - this.x) <= this.rx + pad && Math.abs(f.z - this.z) <= this.rz + pad * 0.3;
    const dx = (f.x - this.x) / (this.rx + pad), dz = (f.z - this.z) / (this.rz + pad * 0.4);
    return dx * dx + dz * dz <= 1;
  }
  update(dt) {
    this.t += dt;
    if (this.follow) { this.x = this.follow.x; this.z = this.follow.z; }
    if (this.vx) this.x += this.vx * dt;
    if (this.grow) { this.rx += this.grow * dt; this.rz += this.grow * 0.42 * dt; }
    if (this.t >= this.delay && !this.fired && this.onFire) { this.fired = true; this.onFire(this); }
    if (this.t >= this.delay && this.dmg) {
      this.tickT -= dt;
      if (this.tickT <= 0) {
        this.tickT = this.tick || 999;
        if (!this.once || !this.didHit) {
          if (this.tick) this.hitIds.clear();
          const targets = this.team === 'hero' ? S.enemies : S.heroes;
          for (const f of targets) {
            if (f.dead || this.hitIds.has(f.id)) continue;
            if (this.groundOnly && f.y > 20) continue;
            if (!this.contains(f, f.w * 0.5)) continue;
            this.hitIds.add(f.id);
            dealDamage(this.owner, f, { dmg: this.dmg, el: this.el, kx: this.kx ?? 120, ky: this.launch || 0, fall: this.fall ?? (this.launch ? 100 : 30), stop: 0.04, spell: this.team === 'hero', chill: this.chill, dir: sign(f.x - this.x) || 1, heavy: this.heavy, unblockable: this.unblockable, ignoreInv: this.ignoreInv, slow: this.slow });
            if (this.onHitF) this.onHitF(this, f);
          }
          if (this.once) this.didHit = true;
        }
      }
    }
    if (this.onUpdate) this.onUpdate(this, dt);
    if (this.t >= this.delay + this.life) { this.dead = true; if (this.onEnd) this.onEnd(this); }
  }
  draw(camX, layer) {
    const x = this.x - camX, y = scrY(this.z, 0);
    if (x < -300 || x > VIEW_W + 300) return;
    const g = ctx;
    const k = this.t < this.delay ? this.t / this.delay : 1;
    if (layer === 'floor') {
      if (this.t < this.delay && this.lane) {
        // lane telegraph: a striped warning band that fills from the source side
        const c = this.color || '#ff4f73';
        const x0 = Math.max(-20, x - this.rx), x1 = Math.min(VIEW_W + 20, x + this.rx);
        const y0 = y - this.rz, hgt = this.rz * 2;
        g.fillStyle = c + '26'; g.fillRect(x0, y0, x1 - x0, hgt);
        g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, hgt); g.clip();
        g.strokeStyle = c + '55'; g.lineWidth = 8;
        const off = (this.t * 120) % 40;
        for (let sx = x0 - 60 + off; sx < x1 + 60; sx += 40) { g.beginPath(); g.moveTo(sx, y0 + hgt); g.lineTo(sx + 30, y0); g.stroke(); }
        g.fillStyle = c + '44'; g.fillRect(x0, y0, (x1 - x0) * k, hgt);
        g.restore();
        g.strokeStyle = c; g.lineWidth = 3; g.strokeRect(x0, y0, x1 - x0, hgt);
        g.fillStyle = c; g.font = `bold 14px ${FONT_PIXEL}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (Math.floor(this.t * 6) % 2) g.fillText('! DANGER !', clamp(S.hero.x - S.camX, x0 + 60, x1 - 60), y0 - 12);
        return;
      }
      if (this.t < this.delay) {
        // telegraph: pulsing red ellipse that fills up
        g.fillStyle = (this.color || '#ff4f73') + '33'; g.strokeStyle = this.color || '#ff4f73'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(x, y, this.rx, this.rz, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = (this.color || '#ff4f73') + '55'; g.beginPath(); g.ellipse(x, y, this.rx * k, this.rz * k, 0, 0, TAU); g.fill();
        if (this.lane) { g.fillStyle = (this.color || '#ff4f73') + '22'; }
        return;
      }
      if (ZONE_ART[this.kind] && ZONE_ART[this.kind].floor) ZONE_ART[this.kind].floor(g, x, y, this);
    } else if (this.t >= this.delay && ZONE_ART[this.kind] && ZONE_ART[this.kind].top) ZONE_ART[this.kind].top(g, x, y, this);
  }
}
const ZONE_ART = {
  chrono: {
    floor(g, x, y, z) {
      const a = Math.min(1, z.t * 4) * Math.min(1, (z.life - z.t + z.delay) * 2);
      g.globalAlpha = a;
      g.fillStyle = 'rgba(197,140,255,.14)'; g.strokeStyle = 'rgba(197,140,255,.8)'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y, z.rx, z.rz, 0, 0, TAU); g.fill(); g.stroke();
      g.setLineDash([6, 8]); g.lineDashOffset = -z.t * 30; g.beginPath(); g.ellipse(x, y, z.rx * 0.8, z.rz * 0.8, 0, 0, TAU); g.stroke(); g.setLineDash([]);
      // clock hands
      g.strokeStyle = 'rgba(240,220,255,.6)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(z.t * 2) * z.rx * 0.5, y + Math.sin(z.t * 2) * z.rz * 0.5); g.moveTo(x, y); g.lineTo(x + Math.cos(z.t * 0.3) * z.rx * 0.3, y + Math.sin(z.t * 0.3) * z.rz * 0.3); g.stroke();
      g.globalAlpha = 1;
    },
    top(g, x, y, z) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.25 * Math.min(1, (z.life - z.t + z.delay) * 2);
      g.strokeStyle = '#c58cff'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(x, y - z.rz * 1.2, z.rx, z.rx * 0.9, 0, Math.PI, TAU); g.stroke();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    },
  },
  pillar: {
    top(g, x, y, z) {
      const k = Math.min(1, z.t * 6) * Math.min(1, (z.life - z.t + z.delay) * 4);
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) { const yy = y - i * 22 * k; drawGlow(x + Math.sin(z.t * 20 + i) * 6, yy, 34 - i * 2, i % 2 ? '#ff7a2f' : '#ffd35c', 0.8 * k); }
      g.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.5) Particles.add({ x: z.x + R(-20, 20), y: y - R(0, 160), vx: R(-30, 30), vy: R(-220, -80), life: 0.5, size: 5, color: '#ffd35c', glow: true });
    },
  },
  lava: {
    floor(g, x, y, z) {
      const a = Math.min(1, (z.life - z.t + z.delay));
      g.globalAlpha = a;
      g.fillStyle = '#ff5a1f'; g.beginPath(); g.ellipse(x, y, z.rx, z.rz, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffd35c'; g.beginPath(); g.ellipse(x + Math.sin(z.t * 3) * 8, y, z.rx * 0.5, z.rz * 0.4, 0, 0, TAU); g.fill();
      g.globalAlpha = 1;
    },
  },
  quakeRing: {
    floor(g, x, y, z) {
      const k = z.t / (z.life || 0.3);
      g.strokeStyle = `rgba(215,161,95,${1 - k})`; g.lineWidth = 8 * (1 - k) + 2;
      g.beginPath(); g.ellipse(x, y, z.rx, z.rz, 0, 0, TAU); g.stroke();
    },
  },
  nova: {
    floor(g, x, y, z) {
      const k = z.t / z.life;
      g.strokeStyle = `rgba(191,245,255,${1 - k})`; g.lineWidth = 10 * (1 - k) + 2;
      g.beginPath(); g.ellipse(x, y, z.rx, z.rz, 0, 0, TAU); g.stroke();
      g.fillStyle = `rgba(127,227,255,${0.25 * (1 - k)})`; g.fill();
    },
  },
  burst: {
    floor(g, x, y, z) {
      if (z.lane) {
        const k = clamp((z.t - z.delay) / (z.life || 0.15), 0, 1);
        g.fillStyle = z.color || '#fff'; g.globalAlpha = 0.5 * (1 - k);
        g.fillRect(x - z.rx, y - z.rz, z.rx * 2, z.rz * 2); g.globalAlpha = 1;
        return;
      }
      const k = z.t / z.life;
      g.strokeStyle = z.color || '#fff'; g.globalAlpha = 1 - k; g.lineWidth = 6;
      g.beginPath(); g.ellipse(x, y, z.rx * (0.5 + k * 0.5), z.rz * (0.5 + k * 0.5), 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
    },
  },
  beam: {
    top(g, x, y, z) {
      const k = Math.min(1, (z.t - z.delay) * 8) * Math.min(1, (z.life - (z.t - z.delay)) * 5);
      const left = z.x - z.rx - S.camX, w = z.rx * 2;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = z.color || '#ffc53d'; g.globalAlpha = 0.6 * k;
      g.fillRect(left, y - 60 - z.rz * 0.4, w, 36 + z.rz * 0.4);
      g.globalAlpha = 0.9 * k; g.fillStyle = '#fff'; g.fillRect(left, y - 48 - z.rz * 0.2, w, 10);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    },
  },
  roots: {
    top(g, x, y, z) {
      const k = Math.min(1, (z.t - z.delay) * 6);
      g.fillStyle = '#6b4424'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
      for (let i = 0; i < 5; i++) { const ox = (i - 2) * 14; g.beginPath(); g.moveTo(x + ox - 7, y); g.lineTo(x + ox + Math.sin(i) * 6, y - (50 + i * 9) * k); g.lineTo(x + ox + 7, y); g.closePath(); g.fill(); g.stroke(); }
    },
  },
  breath: {
    top(g, x, y, z) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) drawGlow(z.x - S.camX + R(-z.rx, z.rx), y - R(20, 70), R(26, 50), pick(['#ff7a2f', '#ffd35c', '#ff4f1f']), 0.6);
      g.globalCompositeOperation = 'source-over';
    },
  },
  safe: {
    floor(g, x, y, z) {
      g.fillStyle = 'rgba(62,230,168,.25)'; g.strokeStyle = '#3ee6a8'; g.lineWidth = 3; g.setLineDash([8, 6]);
      g.beginPath(); g.ellipse(x, y, z.rx, z.rz, 0, 0, TAU); g.fill(); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#3ee6a8'; g.font = `12px ${FONT_PIXEL}`; g.textAlign = 'center'; g.fillText('SAFE', x, y + 4);
    },
  },
  storm: {
    top(g, x, y, z) {
      g.fillStyle = 'rgba(40,40,70,.35)';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x - 120 + i * 60, 60 + Math.sin(z.t + i) * 6, 60, 22, 0, 0, TAU); g.fill(); }
    },
  },
};

// ------------------------------------------------------------
//  Pickups
// ------------------------------------------------------------
class Pickup {
  constructor(o) {
    Object.assign(this, { y: 20, vy: R(160, 260), vx: R(-80, 80), vz: R(-40, 40), t: 0, dead: false, magnet: false }, o);
    this.id = NEXT_ID++;
  }
  update(dt) {
    this.t += dt;
    const h = S.hero;
    const dx = h.x - this.x, dz = h.z - this.z;
    const d = Math.hypot(dx, dz);
    if (!this.magnet && this.t > 0.35 && (d < h.stats.magnet || S.vacuum) && (this.kind === 'xp' || this.kind === 'coin' || S.vacuum)) this.magnet = true;
    if (this.magnet && !h.dead) {
      const sp = 520 + this.t * 200;
      this.x += (dx / (d || 1)) * sp * dt; this.z += (dz / (d || 1)) * sp * dt;
      this.y = lerp(this.y, 30, dt * 8);
    } else {
      this.vy -= GRAV * dt; this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = -this.vy * 0.4; if (Math.abs(this.vy) < 40) this.vy = 0; this.vx *= 0.6; this.vz *= 0.6; }
      this.x += this.vx * dt; this.z = clamp(this.z + this.vz * dt, 0, DEPTH);
    }
    if (d < 34 && this.t > 0.2 && Math.abs(h.y - this.y) < 80) { this.collect(h); }
    if (this.t > 30 && !this.magnet) this.dead = true;
  }
  collect(h) {
    this.dead = true;
    switch (this.kind) {
      case 'xp': h.gainXp(this.value); Sfx.play('gem'); SAVE.stats.gems++; break;
      case 'coin': S.quarters += this.value * h.stats.qMul; Sfx.play('coin'); Floaters.add(this.x, scrY(this.z, 60), '+' + Math.round(this.value * h.stats.qMul) + '¢', { color: '#ffc53d', size: 16, font: FONT_PIXEL }); break;
      case 'milk': case 'food': {
        const amt = (this.kind === 'milk' ? 35 : 22) * h.stats.foodMul;
        h.heal(amt); h.mp = Math.min(h.maxMp, h.mp + 25); Sfx.play('heal');
        Floaters.add(this.x, scrY(this.z, 70), this.kind === 'milk' ? 'MILK! +' + Math.round(amt) : 'NOM! +' + Math.round(amt), { color: '#3ee6a8', size: 18 });
        if (this.kind === 'milk') { SAVE.stats.milk++; if (SAVE.stats.milk >= 25) unlockAch('milk'); }
        break;
      }
      case 'chest': S.openChest(this); break;
      case 'mana': h.mp = Math.min(h.maxMp, h.mp + 40); Sfx.play('gem'); Floaters.add(this.x, scrY(this.z, 70), '+MP', { color: '#55c8ff', size: 16 }); break;
    }
  }
  draw(camX) {
    const x = this.x - camX, y = scrY(this.z, this.y);
    if (x < -40 || x > VIEW_W + 40) return;
    const g = ctx;
    const bob = this.y < 1 ? Math.sin(this.t * 5) * 3 : 0;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, scrY(this.z, 0), 8, 3, 0, 0, TAU); g.fill();
    switch (this.kind) {
      case 'xp': {
        const c = this.value >= 10 ? '#ff4f73' : this.value >= 4 ? '#b77cff' : '#3ee6a8';
        g.globalCompositeOperation = 'lighter'; drawGlow(x, y - 8 + bob, 14, c, 0.7); g.globalCompositeOperation = 'source-over';
        g.fillStyle = c; g.strokeStyle = OUTLINE; g.lineWidth = 2;
        const s = this.value >= 10 ? 9 : this.value >= 4 ? 7 : 5.5;
        g.beginPath(); g.moveTo(x, y - 8 + bob - s); g.lineTo(x + s * 0.7, y - 8 + bob); g.lineTo(x, y - 8 + bob + s); g.lineTo(x - s * 0.7, y - 8 + bob); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x - 1.5, y - 8 + bob - s * 0.5, 2, s * 0.5);
        break;
      }
      case 'coin': {
        g.save(); g.translate(x, y - 10 + bob); g.scale(Math.cos(this.t * 6), 1);
        g.fillStyle = '#ffc53d'; g.strokeStyle = '#a86400'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#fff4c2'; g.fillRect(-1, -5, 2, 10); g.restore();
        break;
      }
      case 'milk': {
        g.fillStyle = '#fff'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x - 5, y - 28 + bob); g.lineTo(x + 5, y - 28 + bob); g.lineTo(x + 5, y - 22 + bob); g.lineTo(x + 8, y - 18 + bob); g.lineTo(x + 8, y + bob); g.lineTo(x - 8, y + bob); g.lineTo(x - 8, y - 18 + bob); g.lineTo(x - 5, y - 22 + bob); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#55c8ff'; g.fillRect(x - 8, y - 12 + bob, 16, 5);
        break;
      }
      case 'food': {
        // roast drumstick (the classic wall chicken)
        g.save(); g.translate(x, y - 12 + bob); g.rotate(-0.4);
        g.fillStyle = '#f2ecdc'; g.fillRect(6, -2, 10, 4); g.beginPath(); g.arc(16, -3, 3, 0, TAU); g.arc(16, 3, 3, 0, TAU); g.fill();
        g.fillStyle = '#c9702a'; g.strokeStyle = OUTLINE; g.lineWidth = 2; g.beginPath(); g.ellipse(-2, 0, 12, 9, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-5, -4, 4, 2, -0.3, 0, TAU); g.fill();
        g.restore();
        break;
      }
      case 'mana': {
        g.globalCompositeOperation = 'lighter'; drawGlow(x, y - 10 + bob, 16, '#55c8ff', 0.8); g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#55c8ff'; g.strokeStyle = OUTLINE; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 20 + bob); g.lineTo(x + 6, y - 10 + bob); g.lineTo(x, y + bob); g.lineTo(x - 6, y - 10 + bob); g.closePath(); g.fill(); g.stroke();
        break;
      }
      case 'chest': {
        const open = this.opened;
        g.fillStyle = '#8a5a2b'; g.strokeStyle = OUTLINE; g.lineWidth = 3;
        roundRect(g, x - 22, y - 30, 44, 30, 4); g.fill(); g.stroke();
        g.fillStyle = '#ffc53d'; g.fillRect(x - 22, y - 20, 44, 5); g.fillRect(x - 4, y - 24, 8, 10);
        g.fillStyle = '#a0703a'; g.beginPath(); g.moveTo(x - 22, y - 30); g.quadraticCurveTo(x, y - 46 - (open ? 10 : 0), x + 22, y - 30); g.fill(); g.stroke();
        g.globalCompositeOperation = 'lighter'; drawGlow(x, y - 30, 30 + Math.sin(this.t * 4) * 5, '#ffc53d', 0.5); g.globalCompositeOperation = 'source-over';
        if (!open && Math.sin(this.t * 3) > 0.7) Particles.add({ x: this.x + R(-20, 20), y: scrY(this.z, 40), vy: -30, life: 0.6, size: 3, color: '#fff4c2', type: 'star' });
        break;
      }
    }
  }
}

// ------------------------------------------------------------
//  Props: breakable, liftable, throwable (LF2 style)
// ------------------------------------------------------------
class Prop {
  constructor(o) {
    Object.assign(this, { y: 0, hp: 20, t: 0, dead: false, held: false, vx: 0, vy: 0 }, o);
    this.id = NEXT_ID++;
    this.w = 36;
  }
  hit(dmg, att) {
    this.hp -= dmg;
    this.shakeT = 0.2;
    Sfx.play('crate');
    if (this.hp <= 0) this.break();
  }
  break() {
    this.dead = true;
    const sy = scrY(this.z, 20);
    Particles.burst(this.x, sy, 14, { speed: 300, life: 0.7, size: 6, colors: ['#a0703a', '#6b4424', '#c98b3a'], type: 'sq', g: 800, drag: 0.95 });
    dust(this.x, this.z, 8);
    const r = Math.random();
    const drop = this.kind === 'barrel' ? (r < 0.45 ? 'food' : r < 0.75 ? 'milk' : 'coin') : this.kind === 'crate' ? (r < 0.3 ? 'milk' : r < 0.55 ? 'mana' : 'coin') : null;
    if (drop === 'coin') for (let i = 0; i < 4; i++) S.addPickup(new Pickup({ kind: 'coin', value: 2, x: this.x, z: this.z }));
    else if (drop) S.addPickup(new Pickup({ kind: drop, value: 1, x: this.x, z: this.z }));
  }
  update(dt) { this.t += dt; if (this.shakeT > 0) this.shakeT -= dt; }
  draw(camX) {
    if (this.held) return;
    const x = this.x - camX + (this.shakeT > 0 ? R(-3, 3) : 0), y = scrY(this.z, this.y);
    if (x < -60 || x > VIEW_W + 60) return;
    drawPropSprite(ctx, this.kind, x, y);
  }
}
function drawPropSprite(g, kind, x, y) {
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y, 22, 6, 0, 0, TAU); g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 3;
  if (kind === 'barrel') {
    g.fillStyle = '#a0703a'; roundRect(g, x - 18, y - 44, 36, 44, 9); g.fill(); g.stroke();
    g.fillStyle = '#7a5230'; g.fillRect(x - 18, y - 36, 36, 4); g.fillRect(x - 18, y - 12, 36, 4);
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x - 12, y - 42, 5, 40);
  } else if (kind === 'crate') {
    g.fillStyle = '#c98b3a'; g.fillRect(x - 20, y - 40, 40, 40); g.strokeRect(x - 20, y - 40, 40, 40);
    g.strokeStyle = '#7a5230'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 18, y - 38); g.lineTo(x + 18, y - 2); g.moveTo(x + 18, y - 38); g.lineTo(x - 18, y - 2); g.stroke();
  } else if (kind === 'rock') {
    g.fillStyle = '#8a8a9a'; g.beginPath(); g.ellipse(x, y - 14, 22, 16, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#a8a8b8'; g.beginPath(); g.ellipse(x - 6, y - 20, 8, 5, 0, 0, TAU); g.fill();
  }
}
