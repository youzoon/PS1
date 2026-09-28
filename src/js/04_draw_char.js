// ============================================================
//  Character renderer: procedural chibi rig with cel shading.
//  Every character is original and drawn with canvas paths.
// ============================================================
const OUTLINE = '#1b1030';
let BIGHEAD = false;

function basePose() {
  return {
    bob: 0, lean: 0, rot: 0, sx: 1, sy: 1, headTilt: 0, headY: 0,
    aF: 0.25, bF: 0.9, aB: -0.1, bB: 0.8,   // arms: angle (0=down, +=forward), elbow bend
    lF: 0.05, kF: 0.1, lB: -0.05, kB: 0.1,  // legs: angle, knee bend
    eyes: 'normal', mouth: 'line', wpnA: 0, glow: null, trail: 0,
  };
}

// f: fighter-like object {anim, animT, walkPhase, face, move, moveK, flash, status...}
function computePose(f) {
  const p = basePose();
  const t = f.animT || 0;
  const T = (f.clock || 0);
  switch (f.anim) {
    case 'idle': {
      const b = Math.sin(T * 3.2 + (f.id || 0));
      p.bob = b * 1.2; p.aF = 0.35 + b * 0.05; p.aB = 0.15 - b * 0.05; p.bF = 1.3; p.bB = 1.1;
      p.sy = 1 + b * 0.012; p.sx = 1 - b * 0.012;
      break;
    }
    case 'walk': case 'run': {
      const run = f.anim === 'run';
      const ph = f.walkPhase || 0;
      const s = Math.sin(ph), c = Math.cos(ph);
      const amp = run ? 0.85 : 0.55;
      p.lF = s * amp; p.lB = -s * amp;
      p.kF = Math.max(0, -Math.cos(ph)) * (run ? 1.3 : 0.7) + 0.1;
      p.kB = Math.max(0, Math.cos(ph)) * (run ? 1.3 : 0.7) + 0.1;
      p.aF = -s * (run ? 0.9 : 0.5) + (run ? 0.3 : 0.1); p.aB = s * (run ? 0.9 : 0.5) + (run ? 0.3 : 0.1);
      p.bF = run ? 1.5 : 0.7; p.bB = run ? 1.5 : 0.7;
      p.bob = -Math.abs(c) * (run ? 3.5 : 2);
      p.lean = run ? 0.22 : 0.05;
      if (run) p.trail = 1;
      break;
    }
    case 'jump': {
      const up = f.vy > 0;
      p.lF = 0.6; p.kF = 1.4; p.lB = -0.2; p.kB = 1.0;
      p.aF = up ? 2.4 : 1.4; p.bF = 0.4; p.aB = up ? -2.2 : -1.0; p.bB = 0.4;
      p.sy = up ? 1.08 : 0.97; p.sx = up ? 0.94 : 1.03;
      break;
    }
    case 'land': {
      const k = 1 - Math.min(1, t / 0.12);
      p.sy = 1 - 0.18 * k; p.sx = 1 + 0.18 * k; p.kF = 0.6 * k + 0.1; p.kB = 0.6 * k + 0.1; p.lF = 0.3 * k; p.lB = -0.3 * k;
      break;
    }
    case 'attack': poseAttack(f, p); break;
    case 'cast': {
      const k = Math.min(1, t / 0.18);
      p.aF = lerp(0.3, 1.7, ease.outBack(k)); p.bF = 0.1; p.aB = lerp(0.1, 1.5, k); p.bB = 0.2;
      p.lean = -0.08; p.lF = 0.35; p.lB = -0.3; p.kF = 0.3; p.eyes = 'focus'; p.mouth = 'o';
      p.glow = f.castColor || '#fff';
      break;
    }
    case 'block': {
      p.aF = 1.9; p.bF = 2.2; p.aB = 1.6; p.bB = 2.3; p.lean = -0.05; p.lF = 0.3; p.lB = -0.35; p.kF = 0.35; p.kB = 0.2;
      p.eyes = 'focus'; p.mouth = 'grit';
      break;
    }
    case 'hurt': {
      const k = Math.min(1, t / 0.25);
      p.lean = -0.35 * (1 - k * 0.5); p.headTilt = -0.3; p.aF = -0.6; p.bF = 0.5; p.aB = -1.2; p.bB = 0.4;
      p.lF = 0.3; p.lB = -0.25; p.eyes = 'hurt'; p.mouth = 'o';
      break;
    }
    case 'air': { // knocked into the air, spinning back
      p.rot = -Math.min(1.4, t * 5); p.aF = -2.2; p.aB = -2.6; p.bF = 0.3; p.bB = 0.3; p.lF = 0.7; p.lB = 0.2; p.kF = 0.5; p.kB = 0.9;
      p.eyes = 'hurt'; p.mouth = 'o';
      break;
    }
    case 'down': case 'dead': {
      p.rot = -Math.PI / 2; p.bob = 0; p.aF = -2.6; p.aB = -2.8; p.bF = 0.3; p.bB = 0.2; p.lF = 0.1; p.lB = -0.1; p.kF = 0.2; p.kB = 0.5;
      p.eyes = f.anim === 'dead' ? 'ko' : 'hurt'; p.mouth = f.anim === 'dead' ? 'tongue' : 'o';
      break;
    }
    case 'getup': {
      const k = Math.min(1, t / 0.35);
      p.rot = -Math.PI / 2 * (1 - ease.outCubic(k)); p.kF = 1.2 * (1 - k); p.kB = 1.2 * (1 - k); p.aF = 0.5; p.aB = 0.9;
      break;
    }
    case 'stun': {
      p.lean = Math.sin(T * 7) * 0.12; p.headTilt = Math.sin(T * 7 + 1) * 0.25; p.aF = 0.1; p.aB = 0.05; p.bF = 0.2; p.bB = 0.2; p.eyes = 'dizzy'; p.mouth = 'wobble';
      break;
    }
    case 'hold': {
      p.aF = 2.9; p.bF = 0.3; p.aB = 2.7; p.bB = 0.3; p.lF = 0.1; p.lB = -0.1; p.kF = 0.25; p.kB = 0.25; p.mouth = 'grit';
      if (f.moving) { const s = Math.sin(f.walkPhase || 0); p.lF = s * 0.5; p.lB = -s * 0.5; p.bob = -Math.abs(Math.cos(f.walkPhase || 0)) * 2; }
      break;
    }
    case 'throw': {
      const k = Math.min(1, t / 0.2);
      p.aF = lerp(2.9, 1.2, k); p.aB = lerp(2.7, 0.8, k); p.bF = 0.1; p.lean = 0.2 * k; p.lF = 0.5; p.lB = -0.4;
      break;
    }
    case 'win': {
      const b = Math.abs(Math.sin(T * 6));
      p.aF = 2.8; p.bF = 0.2; p.aB = 0.3; p.bob = -b * 10; p.eyes = 'happy'; p.mouth = 'grin';
      break;
    }
    case 'dash': {
      p.lean = 0.35; p.lF = 1.0; p.kF = 0.8; p.lB = -0.9; p.kB = 0.5; p.aF = 1.2; p.bF = 0.3; p.aB = -1.2; p.bB = 0.2; p.trail = 1;
      break;
    }
    case 'spawn': {
      const k = Math.min(1, t / 0.4);
      p.sy = ease.outBack(k); p.sx = 2 - ease.outBack(k);
      break;
    }
  }
  if (f.attacking && f.anim !== 'attack') p.mouth = 'grit';
  return p;
}

// Attack poses: move.pose chooses the silhouette; k = normalized progress
function poseAttack(f, p) {
  const m = f.move; if (!m) return;
  const t = f.animT;
  const wu = m.windup, ac = m.active, rc = m.recover;
  let ph; // 0..1 windup, 1..2 active, 2..3 recovery
  if (t < wu) ph = t / wu;
  else if (t < wu + ac) ph = 1 + (t - wu) / ac;
  else ph = 2 + Math.min(1, (t - wu - ac) / rc);
  const w = Math.min(1, ph), s = clamp(ph - 1, 0, 1), r = clamp(ph - 2, 0, 1);
  const strike = ph >= 1 ? 1 - r * 0.7 : 0;
  p.eyes = 'angry'; p.mouth = ph >= 1 && ph < 2 ? 'yell' : 'grit';
  switch (m.pose) {
    case 'jab':
      p.aF = lerp(0.6, 0.2, w) + strike * 1.3; p.bF = lerp(1.6, 2.0, w) * (1 - strike) + 0.05;
      p.aB = 0.5; p.bB = 1.6; p.lean = -0.05 * w + 0.15 * strike; p.lF = 0.35; p.lB = -0.35; p.kF = 0.2; p.kB = 0.25;
      break;
    case 'cross':
      p.aB = lerp(0.5, 0.0, w) + strike * 1.5; p.bB = 1.6 * (1 - strike) + 0.05; p.aF = 0.6; p.bF = 1.8;
      p.lean = 0.25 * strike - 0.08 * w; p.lF = 0.5; p.lB = -0.45; p.kF = 0.3;
      break;
    case 'upper':
      p.aF = lerp(0.3, -0.3, w) + strike * 2.6; p.bF = 1.8 - strike * 1.5; p.aB = 0.4; p.bB = 1.5;
      p.lean = lerp(0.1, 0.3, w) - strike * 0.35; p.kF = 0.8 * w * (1 - strike); p.kB = 0.6 * w * (1 - strike); p.lF = 0.4; p.lB = -0.3;
      p.bob = -strike * 6; p.sy = 1 + strike * 0.06;
      break;
    case 'kick':
      p.lF = lerp(0.2, -0.2, w) + strike * 1.7; p.kF = lerp(0.3, 1.8, w) * (1 - strike); p.lB = -0.2; p.kB = 0.15;
      p.aF = -0.4; p.bF = 1.2; p.aB = 0.7; p.bB = 1.5; p.lean = -0.25 * strike;
      break;
    case 'flykick':
      p.lF = 1.6; p.kF = 0.05; p.lB = 0.4; p.kB = 1.6; p.aF = -0.6; p.aB = -1.2; p.bF = 0.8; p.bB = 0.4; p.lean = -0.2;
      break;
    case 'swing': // overhead weapon swing (staff, axe)
      p.aF = lerp(0.6, 2.8, w) - strike * 2.2 - r * 0.2; p.bF = 0.25; p.aB = lerp(0.3, 2.4, w) - strike * 2.0; p.bB = 0.35;
      p.lean = -0.15 * w + 0.28 * strike; p.lF = 0.5; p.lB = -0.45; p.kF = 0.35 * strike;
      p.wpnA = strike;
      break;
    case 'slam': // hammer smash
      p.aF = lerp(0.4, 3.0, w) - strike * 2.7; p.bF = 0.15; p.aB = lerp(0.3, 2.9, w) - strike * 2.6; p.bB = 0.2;
      p.lean = -0.25 * w + 0.45 * strike; p.kF = 0.6 * strike; p.kB = 0.6 * strike; p.lF = 0.55; p.lB = -0.5;
      p.bob = strike * 5; p.sy = 1 - strike * 0.08; p.sx = 1 + strike * 0.08;
      break;
    case 'thrust': // dagger stab / staff poke
      p.aF = lerp(0.9, 0.7, w) + strike * 0.95; p.bF = lerp(1.9, 2.2, w) * (1 - strike) + 0.02; p.aB = 1.2 + strike * 0.3; p.bB = 1.3;
      p.lean = 0.3 * strike; p.lF = 0.7 * strike + 0.2; p.lB = -0.6; p.kF = 0.5 * strike;
      break;
    case 'spin':
      p.rot = 0; p.aF = 1.6; p.aB = 1.6 + Math.PI; p.bF = 0.1; p.bB = 0.1; p.lean = 0; p.lF = 0.3; p.lB = -0.3;
      p.spin = ph * Math.PI * 2;
      break;
    case 'bite': case 'lunge':
      p.lean = 0.4 * strike - 0.2 * w; p.aF = 1.4 * strike + 0.3; p.aB = 1.2 * strike; p.bF = 0.3; p.bB = 0.3; p.lF = 0.8 * strike; p.lB = -0.7 * strike;
      break;
    case 'cast': case 'shoot':
      p.aF = lerp(0.3, 1.6, w); p.bF = 0.1; p.aB = lerp(0.1, 1.2, w); p.bB = 0.3; p.lean = -0.06; p.eyes = 'focus'; p.mouth = 'o';
      p.glow = f.castColor || '#fff';
      break;
    case 'throwP':
      p.aF = lerp(1.5, 3.0, w) - strike * 2.2; p.bF = 0.3; p.aB = 0.8; p.bB = 1.0; p.lean = -0.2 * w + 0.3 * strike;
      break;
    case 'stomp':
      p.lF = lerp(0.2, 1.3, w) - strike * 1.2; p.kF = lerp(0.2, 1.6, w) * (1 - strike); p.aF = 1.9 * w * (1 - strike) + 0.4; p.aB = 1.7 * w * (1 - strike) + 0.2; p.bF = 0.5; p.bB = 0.5;
      p.bob = strike * 4; p.sy = 1 - strike * 0.1; p.sx = 1 + strike * 0.1;
      break;
  }
}

// ---------------- humanoid ----------------
// look = {build:{s, head, torso, width, limb, leg, arm}, skin, hair, hairStyle, top, top2, pants, shoes, accent, weapon, face, extras}
function drawHumanoid(g, x, y, sc, face, look, pose, fx) {
  const B = look.build;
  const s = sc * B.s;
  const white = fx && fx.flash;
  const tint = fx && fx.tint;
  const col = (c) => (white ? '#ffffff' : tint ? mix(c, tint, 0.55) : c);
  const LW = 3.2;
  g.save();
  g.translate(x, y + pose.bob * s);
  g.scale(face * s, s);
  if (pose.rot) { g.translate(0, -18); g.rotate(pose.rot); g.translate(0, 18); }
  g.scale(pose.sx, pose.sy);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const legLen = B.leg, hipY = -legLen * 2 + 2;
  const torsoH = B.torso, torsoW = B.width;
  // torso pivot at hip
  const lean = pose.lean;
  const shX = Math.sin(lean) * torsoH, shY = hipY - Math.cos(lean) * torsoH;
  const limb = B.limb;

  const drawLimb = (ax, ay, a1, b, len1, len2, color, w, knee) => {
    const ex = ax + Math.sin(a1) * len1, ey = ay + Math.cos(a1) * len1;
    const a2 = knee ? a1 - b : a1 + b;
    const hx = ex + Math.sin(a2) * len2, hy = ey + Math.cos(a2) * len2;
    g.strokeStyle = OUTLINE; g.lineWidth = w + LW * 2;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
    g.strokeStyle = color; g.lineWidth = w;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
    return { ex, ey, hx, hy, a2 };
  };
  const drawFoot = (lx, ly, a, color) => {
    g.save(); g.translate(lx, ly); g.rotate(-a * 0.3);
    g.fillStyle = color; g.strokeStyle = OUTLINE; g.lineWidth = LW;
    g.beginPath(); g.ellipse(3, 1, limb * 0.85, limb * 0.5, 0, 0, TAU); g.fill(); g.stroke();
    g.restore();
  };
  const drawHand = (hx, hy, color, big) => {
    g.fillStyle = color; g.strokeStyle = OUTLINE; g.lineWidth = LW;
    g.beginPath(); g.arc(hx, hy, big ? limb * 0.95 : limb * 0.62, 0, TAU); g.fill(); g.stroke();
  };
  const skin = col(look.skin);
  const back = (c) => col(shade(c, -0.28));

  // --- back leg & arm
  const hipBx = -torsoW * 0.18;
  const lb = drawLimb(hipBx, hipY, pose.lB, pose.kB, legLen, legLen, back(look.pants), limb * 1.05, true);
  drawFoot(lb.hx, lb.hy, pose.lB, back(look.shoes));
  if (look.cape) drawCape(g, shX, shY, pose, col(look.cape), torsoH);
  const abx = shX - torsoW * 0.25, aby = shY + 4;
  const ab = drawLimb(abx, aby, pose.aB, pose.bB, B.arm, B.arm - 1, back(look.sleeve || look.top), limb * 0.9, false);
  if (look.weapon === 'daggers') drawWeapon(g, 'dagger', ab.hx, ab.hy, ab.a2, look, pose, col, true);
  drawHand(ab.hx, ab.hy, look.gloves ? back(look.gloves) : back(look.skin), look.weapon === 'gauntlets');

  // --- torso (rounded trapezoid following lean)
  g.save();
  g.translate(0, hipY); g.rotate(lean);
  const tw = torsoW, th = torsoH;
  g.fillStyle = col(look.top); g.strokeStyle = OUTLINE; g.lineWidth = LW;
  g.beginPath();
  g.moveTo(-tw * 0.42, 2); g.lineTo(tw * 0.42, 2);
  g.quadraticCurveTo(tw * 0.62, -th * 0.55, tw * 0.5, -th);
  g.lineTo(-tw * 0.5, -th);
  g.quadraticCurveTo(-tw * 0.62, -th * 0.55, -tw * 0.42, 2);
  g.closePath(); g.fill();
  // cel shade back half
  g.save(); g.clip();
  g.fillStyle = col(shade(look.top, -0.25)); g.fillRect(-tw, -th - 2, tw * 0.75, th + 6);
  if (look.top2) { g.fillStyle = col(look.top2); g.fillRect(-tw * 0.12, -th, tw * 0.3, th + 2); }
  if (look.belt) { g.fillStyle = col(look.belt); g.fillRect(-tw, -5, tw * 2, 6); }
  if (look.chest) look.chest(g, tw, th, col);
  g.restore();
  g.stroke();
  g.restore();

  // --- front leg
  const lf = drawLimb(torsoW * 0.18, hipY, pose.lF, pose.kF, legLen, legLen, col(look.pants), limb * 1.05, true);
  drawFoot(lf.hx, lf.hy, pose.lF, col(look.shoes));

  // --- head
  const hr = B.head * (BIGHEAD ? 1.7 : 1);
  const hx = shX + Math.sin(lean) * (hr * 0.7), hy = shY - hr * 0.78 + pose.headY;
  g.save();
  g.translate(hx, hy); g.rotate(pose.headTilt + lean * 0.3);
  drawHead(g, hr, look, pose, col, fx);
  g.restore();

  // --- front arm (with weapon)
  const afx = shX + torsoW * 0.22, afy = shY + 4;
  if (pose.spin) { g.save(); g.translate(afx, afy); g.rotate(pose.spin); g.translate(-afx, -afy); }
  const af = drawLimb(afx, afy, pose.aF, pose.bF, B.arm, B.arm - 1, col(look.sleeve || look.top), limb * 0.9, false);
  if (look.weapon && look.weapon !== 'gauntlets' && look.weapon !== 'none') drawWeapon(g, look.weapon, af.hx, af.hy, af.a2, look, pose, col, false);
  drawHand(af.hx, af.hy, look.gloves ? col(look.gloves) : skin, look.weapon === 'gauntlets');
  if (look.weapon === 'gauntlets' && look.wpnGlow) {
    g.globalCompositeOperation = 'lighter';
    drawGlowLocal(g, af.hx, af.hy, 14, look.wpnGlow);
    g.globalCompositeOperation = 'source-over';
  }
  if (pose.spin) g.restore();
  if (pose.glow) {
    g.globalCompositeOperation = 'lighter';
    drawGlowLocal(g, af.hx, af.hy, 22, pose.glow);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
  return { handX: x + face * (af.hx) * s, handY: y + af.hy * s, headY: y + (hy - hr) * s };
}
function drawGlowLocal(g, x, y, r, color) {
  const s = glowSprite(color, 32);
  g.drawImage(s, x - r, y - r, r * 2, r * 2);
}
function drawCape(g, shX, shY, pose, color, th) {
  g.fillStyle = color; g.strokeStyle = OUTLINE; g.lineWidth = 3;
  const flow = pose.trail ? 12 : 4;
  g.beginPath();
  g.moveTo(shX - 6, shY);
  g.quadraticCurveTo(shX - 20 - flow, shY + th * 0.6, shX - 14 - flow * 1.4, shY + th + 8);
  g.lineTo(shX - 2, shY + th + 2);
  g.closePath(); g.fill(); g.stroke();
}

function drawEyes(g, hr, pose, look) {
  const ex1 = hr * 0.18, ex2 = hr * 0.62, ey = hr * 0.05;
  const er = hr * 0.2;
  const e = pose.eyes;
  const blink = look._blink;
  g.lineWidth = 2.4; g.strokeStyle = OUTLINE;
  const pupil = look.eyeColor || '#1b1030';
  const drawOne = (ex, small) => {
    const rr = small ? er * 0.85 : er;
    if (e === 'ko') {
      g.beginPath(); g.moveTo(ex - rr * 0.7, ey - rr * 0.7); g.lineTo(ex + rr * 0.7, ey + rr * 0.7); g.moveTo(ex + rr * 0.7, ey - rr * 0.7); g.lineTo(ex - rr * 0.7, ey + rr * 0.7); g.stroke();
    } else if (e === 'hurt') {
      g.beginPath(); g.moveTo(ex - rr * 0.7, ey - rr * 0.6); g.lineTo(ex + rr * 0.3, ey); g.lineTo(ex - rr * 0.7, ey + rr * 0.6); g.stroke();
    } else if (e === 'happy') {
      g.beginPath(); g.arc(ex, ey + rr * 0.3, rr * 0.7, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    } else if (e === 'dizzy') {
      g.beginPath(); for (let a = 0; a < TAU * 1.5; a += 0.4) { const r2 = rr * a / (TAU * 1.5); g.lineTo(ex + Math.cos(a) * r2, ey + Math.sin(a) * r2); } g.stroke();
    } else if (blink) {
      g.beginPath(); g.moveTo(ex - rr * 0.7, ey); g.lineTo(ex + rr * 0.7, ey); g.stroke();
    } else {
      g.fillStyle = '#fff';
      g.beginPath(); g.ellipse(ex, ey, rr * 0.8, rr * 1.05, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = pupil;
      g.beginPath(); g.ellipse(ex + rr * 0.25, ey + rr * 0.1, rr * 0.45, rr * 0.62, 0, 0, TAU); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(ex + rr * 0.1, ey - rr * 0.25, rr * 0.18, 0, TAU); g.fill();
    }
  };
  drawOne(ex1, true); drawOne(ex2, false);
  // brows
  if (e === 'angry' || e === 'focus' || look.angry) {
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(ex1 - er * 0.8, ey - er * 1.5); g.lineTo(ex1 + er * 0.7, ey - er * 1.05);
    g.moveTo(ex2 - er * 0.8, ey - er * 1.05); g.lineTo(ex2 + er * 0.8, ey - er * 1.6); g.stroke();
  }
}
function drawMouth(g, hr, pose) {
  const mx = hr * 0.45, my = hr * 0.5;
  g.strokeStyle = OUTLINE; g.lineWidth = 2.4; g.fillStyle = '#5a1030';
  switch (pose.mouth) {
    case 'o': g.beginPath(); g.ellipse(mx, my, hr * 0.1, hr * 0.13, 0, 0, TAU); g.fill(); g.stroke(); break;
    case 'yell': g.beginPath(); g.moveTo(mx - hr * 0.18, my - hr * 0.05); g.lineTo(mx + hr * 0.2, my - hr * 0.08); g.lineTo(mx + hr * 0.05, my + hr * 0.18); g.closePath(); g.fill(); g.stroke(); break;
    case 'grit': g.beginPath(); g.moveTo(mx - hr * 0.15, my); g.lineTo(mx + hr * 0.18, my - hr * 0.03); g.stroke(); break;
    case 'grin': g.beginPath(); g.arc(mx, my - hr * 0.05, hr * 0.18, 0.2, Math.PI - 0.2); g.fill(); g.stroke(); break;
    case 'tongue': g.beginPath(); g.moveTo(mx - hr * 0.15, my); g.lineTo(mx + hr * 0.18, my); g.stroke(); g.fillStyle = '#ff6f91'; g.beginPath(); g.ellipse(mx + hr * 0.05, my + hr * 0.08, hr * 0.07, hr * 0.1, 0, 0, TAU); g.fill(); g.stroke(); break;
    case 'wobble': g.beginPath(); for (let i = 0; i <= 6; i++) g.lineTo(mx - hr * 0.18 + i * hr * 0.06, my + (i % 2 ? 2 : -1)); g.stroke(); break;
    case 'none': break;
    default: g.beginPath(); g.arc(mx, my - hr * 0.12, hr * 0.14, 0.4, Math.PI - 0.6); g.stroke();
  }
}

function drawHead(g, hr, look, pose, col, fx) {
  g.strokeStyle = OUTLINE; g.lineWidth = 3.2;
  const hs = look.hairStyle;
  const hair = col(look.hair || '#333');
  // things behind the head
  if (hs === 'long' || hs === 'hood' || hs === 'ponytail') {
    g.fillStyle = hs === 'hood' ? col(look.hood) : hair;
    g.beginPath(); g.ellipse(-hr * 0.35, hr * 0.35, hr * 0.75, hr * 1.0, 0.3, 0, TAU); g.fill(); g.stroke();
    if (hs === 'ponytail') { g.beginPath(); g.ellipse(-hr * 1.1, hr * 0.1, hr * 0.45, hr * 0.28, -0.6 + Math.sin((look._t || 0) * 5) * 0.2, 0, TAU); g.fill(); g.stroke(); }
  }
  if (hs === 'scarf' || look.scarf) {
    g.fillStyle = col(look.scarf || look.accent);
    const w = Math.sin((look._t || 0) * 9) * 3;
    g.beginPath(); g.moveTo(-hr * 0.3, hr * 0.8); g.quadraticCurveTo(-hr * 1.3, hr * 0.7 + w, -hr * 1.9, hr * 0.4 - w); g.lineTo(-hr * 1.8, hr * 0.9 + w); g.quadraticCurveTo(-hr * 1.2, hr * 1.1, -hr * 0.2, hr * 1.05); g.closePath(); g.fill(); g.stroke();
  }
  // head base
  const skinC = col(look.skin);
  g.fillStyle = skinC;
  if (look.headShape === 'skull') {
    g.fillStyle = col('#f2ecdc');
    g.beginPath(); g.arc(0, 0, hr, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.fillStyle = col('#e1d8c2'); g.fillRect(hr * 0.05, hr * 0.55, hr * 0.7, hr * 0.4); g.strokeRect(hr * 0.05, hr * 0.55, hr * 0.7, hr * 0.4);
    g.fillStyle = OUTLINE; g.beginPath(); g.arc(hr * 0.2, hr * 0.02, hr * 0.2, 0, TAU); g.arc(hr * 0.62, hr * 0.02, hr * 0.22, 0, TAU); g.fill();
    g.fillStyle = look.eyeGlow || '#ff4f73'; g.beginPath(); g.arc(hr * 0.22, hr * 0.04, hr * 0.07, 0, TAU); g.arc(hr * 0.64, hr * 0.04, hr * 0.07, 0, TAU); g.fill();
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(hr * (0.2 + i * 0.2), hr * 0.55); g.lineTo(hr * (0.2 + i * 0.2), hr * 0.95); g.stroke(); }
  } else {
    g.beginPath(); g.arc(0, 0, hr, 0, TAU); g.fill(); g.stroke();
    // shade
    g.save(); g.beginPath(); g.arc(0, 0, hr - 1.5, 0, TAU); g.clip();
    g.fillStyle = col(shade(look.skin, -0.18)); g.beginPath(); g.arc(-hr * 0.55, hr * 0.2, hr * 0.9, 0, TAU); g.fill();
    g.restore();
    // ear
    if (look.ears === 'goblin') {
      g.fillStyle = skinC; g.beginPath(); g.moveTo(-hr * 0.2, -hr * 0.1); g.lineTo(-hr * 1.5, -hr * 0.6); g.lineTo(-hr * 0.3, hr * 0.35); g.closePath(); g.fill(); g.stroke();
    } else if (look.ears === 'cow') {
      g.fillStyle = skinC; g.beginPath(); g.ellipse(-hr * 0.9, -hr * 0.3, hr * 0.45, hr * 0.2, -0.4, 0, TAU); g.fill(); g.stroke();
    } else if (hs !== 'hood' && hs !== 'helmet' && hs !== 'mummy') {
      g.fillStyle = skinC; g.beginPath(); g.ellipse(-hr * 0.15, hr * 0.12, hr * 0.18, hr * 0.24, 0, 0, TAU); g.fill(); g.stroke();
    }
    if (look.snout) {
      g.fillStyle = col(look.snout); g.beginPath(); g.ellipse(hr * 0.7, hr * 0.45, hr * 0.42, hr * 0.32, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = OUTLINE; g.beginPath(); g.arc(hr * 0.6, hr * 0.42, hr * 0.06, 0, TAU); g.arc(hr * 0.86, hr * 0.42, hr * 0.06, 0, TAU); g.fill();
    }
    drawEyes(g, hr, pose, look);
    if (!look.snout && !look.beard) drawMouth(g, hr, pose);
    // blush
    if (look.blush) { g.fillStyle = 'rgba(255,110,140,.35)'; g.beginPath(); g.ellipse(hr * 0.72, hr * 0.32, hr * 0.14, hr * 0.08, 0, 0, TAU); g.fill(); }
  }
  // hair / headgear on top
  g.fillStyle = hair; g.strokeStyle = OUTLINE; g.lineWidth = 3.2;
  switch (hs) {
    case 'spiky': {
      g.beginPath();
      g.moveTo(-hr * 1.05, hr * 0.2);
      const spikes = [[-1.3, -0.5], [-0.75, -0.55], [-0.95, -1.25], [-0.3, -0.8], [-0.2, -1.55], [0.25, -0.85], [0.6, -1.35], [0.7, -0.62], [1.2, -0.75], [0.95, -0.2]];
      for (const [a, b] of spikes) g.lineTo(hr * a, hr * b);
      g.quadraticCurveTo(hr * 0.5, -hr * 0.45, hr * 0.1, -hr * 0.3);
      g.quadraticCurveTo(-hr * 0.2, -hr * 0.1, -hr * 0.3, hr * 0.35);
      g.closePath(); g.fill(); g.stroke();
      if (look.headband) { g.fillStyle = col(look.headband); g.beginPath(); g.moveTo(-hr * 1.0, -hr * 0.1); g.quadraticCurveTo(0, -hr * 0.55, hr * 1.0, -hr * 0.35); g.lineTo(hr * 0.98, -hr * 0.12); g.quadraticCurveTo(0, -hr * 0.32, -hr * 1.0, hr * 0.12); g.closePath(); g.fill(); g.stroke();
        const w = Math.sin((look._t || 0) * 10) * 3; g.beginPath(); g.moveTo(-hr * 0.95, 0); g.lineTo(-hr * 1.7, hr * 0.1 + w); g.lineTo(-hr * 1.6, hr * 0.35 - w); g.closePath(); g.fill(); g.stroke(); }
      break;
    }
    case 'bob': case 'long': case 'ponytail': {
      g.beginPath(); g.arc(0, -hr * 0.05, hr * 1.06, Math.PI * 0.95, Math.PI * 2.05); g.quadraticCurveTo(hr * 0.5, -hr * 0.25, hr * 0.1, -hr * 0.4); g.quadraticCurveTo(-hr * 0.3, -hr * 0.1, -hr * 0.4, hr * 0.5); g.lineTo(-hr * 1.05, hr * 0.5); g.closePath(); g.fill(); g.stroke();
      break;
    }
    case 'hood': {
      g.fillStyle = col(look.hood);
      g.beginPath(); g.moveTo(-hr * 1.15, hr * 0.8); g.quadraticCurveTo(-hr * 1.35, -hr * 0.9, -hr * 0.2, -hr * 1.25);
      g.lineTo(hr * 0.3, -hr * 1.9); g.quadraticCurveTo(hr * 1.2, -hr * 0.9, hr * 1.12, -hr * 0.1);
      g.quadraticCurveTo(hr * 0.5, -hr * 0.62, hr * 0.0, -hr * 0.48); g.quadraticCurveTo(-hr * 0.45, -hr * 0.2, -hr * 0.45, hr * 0.8); g.closePath(); g.fill(); g.stroke();
      if (look.hoodTrim) { g.strokeStyle = col(look.hoodTrim); g.lineWidth = 3; g.beginPath(); g.moveTo(hr * 1.05, -hr * 0.15); g.quadraticCurveTo(hr * 0.5, -hr * 0.6, hr * 0.0, -hr * 0.46); g.quadraticCurveTo(-hr * 0.42, -hr * 0.2, -hr * 0.42, hr * 0.75); g.stroke(); }
      if (look.bangs) { g.fillStyle = hair; g.beginPath(); g.moveTo(hr * 0.05, -hr * 0.45); g.quadraticCurveTo(hr * 0.6, -hr * 0.55, hr * 0.95, -hr * 0.12); g.quadraticCurveTo(hr * 0.5, -hr * 0.3, hr * 0.35, -hr * 0.05); g.quadraticCurveTo(hr * 0.2, -hr * 0.3, hr * 0.05, -hr * 0.45); g.fill(); g.strokeStyle = OUTLINE; g.lineWidth = 2.5; g.stroke(); }
      break;
    }
    case 'bald': case 'beard': {
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(hr * 0.1, -hr * 0.6, hr * 0.35, hr * 0.15, -0.3, 0, TAU); g.fill();
      break;
    }
    case 'mohawk': {
      g.beginPath(); g.moveTo(-hr * 0.8, -hr * 0.5);
      for (let i = 0; i < 5; i++) { const a = -2.5 + i * 0.28; g.lineTo(Math.cos(a) * hr * 1.7, Math.sin(a) * hr * 1.7 - hr * 0.1); g.lineTo(Math.cos(a + 0.14) * hr * 0.92, Math.sin(a + 0.14) * hr * 0.92); }
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = col(shade(look.skin, -0.12)); g.beginPath(); g.arc(-hr * 0.1, -hr * 0.05, hr * 0.85, Math.PI * 1.1, Math.PI * 1.35); g.fill();
      break;
    }
    case 'ninja': {
      g.fillStyle = col(look.hood);
      g.beginPath(); g.arc(0, 0, hr * 1.04, Math.PI * 0.62, Math.PI * 2.1); g.lineTo(hr * 0.95, -hr * 0.2); g.lineTo(hr * 0.05, -hr * 0.3); g.lineTo(-hr * 0.1, hr * 0.62); g.closePath(); g.fill(); g.stroke();
      // fox half-mask over the lower face
      if (look.foxMask) {
        g.fillStyle = col('#fff4e8'); g.beginPath(); g.moveTo(hr * 0.02, hr * 0.28); g.quadraticCurveTo(hr * 0.9, hr * 0.12, hr * 1.35, hr * 0.5); g.quadraticCurveTo(hr * 0.8, hr * 1.0, hr * 0.1, hr * 0.92); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = col('#ff4f73'); g.lineWidth = 2; g.beginPath(); g.moveTo(hr * 0.4, hr * 0.55); g.lineTo(hr * 0.9, hr * 0.5); g.stroke();
        g.fillStyle = col(look.hood); g.beginPath(); g.moveTo(-hr * 0.3, -hr * 0.75); g.lineTo(-hr * 0.2, -hr * 1.6); g.lineTo(hr * 0.35, -hr * 0.95); g.closePath(); g.fill(); g.strokeStyle = OUTLINE; g.lineWidth = 3; g.stroke();
        g.fillStyle = col('#ff9fb8'); g.beginPath(); g.moveTo(-hr * 0.18, -hr * 0.9); g.lineTo(-hr * 0.15, -hr * 1.3); g.lineTo(hr * 0.15, -hr * 0.98); g.closePath(); g.fill();
      }
      break;
    }
    case 'bandana': {
      g.fillStyle = col(look.bandana || '#d8343f');
      g.beginPath(); g.arc(0, -hr * 0.05, hr * 1.04, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(0, -hr * 0.55, -hr * 1.02, -hr * 0.1); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-hr * 0.95, -hr * 0.3); g.lineTo(-hr * 1.5, -hr * 0.1); g.lineTo(-hr * 1.3, hr * 0.25); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(hr * 0.1, -hr * 0.62, hr * 0.07, 0, TAU); g.arc(-hr * 0.35, -hr * 0.55, hr * 0.06, 0, TAU); g.fill();
      break;
    }
    case 'helmet': {
      g.fillStyle = col(look.helmet || '#aab4c8');
      g.beginPath(); g.arc(0, 0, hr * 1.08, Math.PI * 0.75, Math.PI * 2.25); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = col('#1b1030'); g.fillRect(hr * 0.05, -hr * 0.15, hr * 1.0, hr * 0.28);
      g.fillStyle = look.eyeGlow || '#ffe45c'; g.fillRect(hr * 0.35, -hr * 0.07, hr * 0.5, hr * 0.1);
      if (look.plume) { g.fillStyle = col(look.plume); g.beginPath(); g.moveTo(-hr * 0.2, -hr * 1.0); g.quadraticCurveTo(-hr * 1.5, -hr * 1.6, -hr * 1.8, -hr * 0.4); g.quadraticCurveTo(-hr * 1.0, -hr * 1.0, -hr * 0.3, -hr * 0.8); g.fill(); g.stroke(); }
      if (look.horns) { g.fillStyle = col('#f2ecdc'); [[-0.5, -1], [0.5, -1]].forEach(([a]) => { g.beginPath(); g.moveTo(hr * a * 0.8, -hr * 0.85); g.quadraticCurveTo(hr * a * 2.2, -hr * 1.4, hr * a * 1.8, -hr * 2.0); g.quadraticCurveTo(hr * a * 1.5, -hr * 1.2, hr * a * 0.2, -hr * 0.95); g.fill(); g.stroke(); }); }
      break;
    }
    case 'crown': case 'beardcrown': {
      g.fillStyle = col('#ffc53d');
      g.beginPath(); g.moveTo(-hr * 0.7, -hr * 0.65); g.lineTo(-hr * 0.8, -hr * 1.35); g.lineTo(-hr * 0.35, -hr * 0.95); g.lineTo(0, -hr * 1.5); g.lineTo(hr * 0.35, -hr * 0.95); g.lineTo(hr * 0.8, -hr * 1.35); g.lineTo(hr * 0.7, -hr * 0.65); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff4f73'; g.beginPath(); g.arc(0, -hr * 0.85, hr * 0.12, 0, TAU); g.fill();
      break;
    }
    case 'nemes': { // striped pharaoh headdress
      g.fillStyle = col('#ffc53d');
      g.beginPath(); g.moveTo(-hr * 1.35, hr * 1.1); g.lineTo(-hr * 1.1, -hr * 0.6); g.quadraticCurveTo(0, -hr * 1.35, hr * 1.1, -hr * 0.6); g.lineTo(hr * 0.9, -hr * 0.2); g.lineTo(-hr * 0.2, -hr * 0.35); g.lineTo(-hr * 0.45, hr * 1.1); g.closePath(); g.fill(); g.stroke();
      g.save(); g.clip(); g.strokeStyle = col('#2f5bd8'); g.lineWidth = 4; for (let i = -3; i < 6; i++) { g.beginPath(); g.moveTo(-hr * 1.6, -hr * 1.0 + i * hr * 0.32); g.lineTo(hr * 1.4, -hr * 1.0 + i * hr * 0.32 - hr * 0.2); g.stroke(); } g.restore();
      g.fillStyle = col('#ffc53d'); g.beginPath(); g.arc(hr * 0.2, -hr * 0.95, hr * 0.14, 0, TAU); g.fill(); g.stroke();
      break;
    }
    case 'mummy': {
      g.strokeStyle = col('#cbbd9a'); g.lineWidth = 3;
      for (let i = -3; i < 4; i++) { g.beginPath(); g.moveTo(-hr, i * hr * 0.28); g.lineTo(hr, i * hr * 0.28 + hr * 0.12); g.stroke(); }
      break;
    }
    case 'furhood': { // yeti
      g.fillStyle = col(look.hair);
      for (let i = 0; i < 9; i++) { const a = Math.PI * 0.9 + i * 0.16; g.beginPath(); g.arc(Math.cos(a) * hr * 0.95, Math.sin(a) * hr * 0.95, hr * 0.32, 0, TAU); g.fill(); }
      if (look.goggles) {
        g.fillStyle = col('#2b2b3a'); g.fillRect(-hr * 0.9, -hr * 0.35, hr * 1.9, hr * 0.18);
        g.fillStyle = col('#ff8a2b'); g.beginPath(); g.ellipse(hr * 0.35, -hr * 0.3, hr * 0.55, hr * 0.28, 0, 0, TAU); g.fill(); g.strokeStyle = OUTLINE; g.lineWidth = 3; g.stroke();
        g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(hr * 0.15, -hr * 0.38, hr * 0.14, hr * 0.07, -0.3, 0, TAU); g.fill();
      }
      break;
    }
    case 'glitch': {
      const t = look._t || 0;
      for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? col('#ff3df2') : col('#3dfff6'); g.fillRect(-hr + ((i * 37 + Math.floor(t * 12) * 13) % (hr * 2)), -hr * 1.1 + (i * 7) % hr, hr * 0.35, hr * 0.25); }
      break;
    }
    case 'horns': {
      g.fillStyle = col('#f2ecdc');
      [[-0.5], [0.45]].forEach(([a]) => { g.beginPath(); g.moveTo(hr * a, -hr * 0.8); g.quadraticCurveTo(hr * a * 1.8, -hr * 1.2, hr * a * 1.3, -hr * 1.7); g.quadraticCurveTo(hr * a * 1.1, -hr * 1.1, hr * (a - 0.3), -hr * 0.85); g.fill(); g.stroke(); });
      break;
    }
    case 'feathers': {
      ['#ff4f73', '#ffc53d', '#3ee6a8', '#55c8ff'].forEach((c, i) => { g.fillStyle = col(c); g.beginPath(); g.ellipse(-hr * 0.5 + i * hr * 0.3, -hr * 1.2, hr * 0.16, hr * 0.6, -0.4 + i * 0.25, 0, TAU); g.fill(); g.stroke(); });
      break;
    }
    case 'cap': {
      g.fillStyle = col(look.capColor || '#3a6df0');
      g.beginPath(); g.arc(0, -hr * 0.1, hr * 1.02, Math.PI, Math.PI * 2); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(hr * 0.9, -hr * 0.12, hr * 0.7, hr * 0.16, 0, 0, TAU); g.fill(); g.stroke();
      break;
    }
  }
  if (look.beard) {
    g.fillStyle = col(look.beard);
    g.beginPath(); g.moveTo(-hr * 0.3, hr * 0.2); g.quadraticCurveTo(hr * 0.2, hr * 0.35, hr * 1.0, hr * 0.2);
    g.quadraticCurveTo(hr * 1.0, hr * 1.2, hr * 0.3, hr * 1.55); g.quadraticCurveTo(-hr * 0.4, hr * 1.2, -hr * 0.3, hr * 0.2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = col(shade(look.beard, -0.2)); g.beginPath(); g.ellipse(hr * 0.55, hr * 0.42, hr * 0.35, hr * 0.12, 0.1, 0, TAU); g.fill();
  }
  if (look.shades) {
    g.fillStyle = '#12101c'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-hr * 0.05, -hr * 0.12); g.lineTo(hr * 1.02, -hr * 0.12); g.lineTo(hr * 0.92, hr * 0.18); g.lineTo(hr * 0.55, hr * 0.2); g.lineTo(hr * 0.45, hr * 0.02); g.lineTo(hr * 0.35, hr * 0.2); g.lineTo(hr * 0.02, hr * 0.15); g.closePath(); g.fill();
    g.fillStyle = 'rgba(120,220,255,.7)'; g.fillRect(hr * 0.62, -hr * 0.06, hr * 0.2, hr * 0.06);
  }
}

// ---------------- weapons ----------------
function drawWeapon(g, type, hx, hy, a, look, pose, col, back) {
  g.save();
  g.translate(hx, hy);
  // weapon direction follows the forearm angle
  g.rotate(-a + Math.PI / 2);
  g.strokeStyle = OUTLINE; g.lineWidth = 3;
  const glow = look.wpnGlow;
  const tier = look.wpnTier || 1;
  const c1 = col(look.wpnColor || '#c9c3de');
  switch (type) {
    case 'staff': {
      g.fillStyle = col('#8a5a2b');
      roundRect(g, -34, -3, 64, 6, 3); g.fill(); g.stroke();
      g.fillStyle = c1; g.beginPath(); g.moveTo(30, 0); g.lineTo(38, -8); g.lineTo(48, 0); g.lineTo(38, 8); g.closePath(); g.fill(); g.stroke();
      if (tier >= 2) { g.beginPath(); g.moveTo(34, -4); g.lineTo(30, -12); g.moveTo(34, 4); g.lineTo(30, 12); g.stroke(); }
      if (glow) { g.globalCompositeOperation = 'lighter'; drawGlowLocal(g, 39, 0, 14 + tier * 3, glow); g.globalCompositeOperation = 'source-over'; }
      break;
    }
    case 'hammer': {
      // handle, then a chunky head across the end of the shaft
      g.fillStyle = col('#7a5230'); roundRect(g, -12, -4, 50, 8, 3); g.fill(); g.stroke();
      const hw = 22 + tier * 3, hh = 38 + tier * 6;
      g.fillStyle = c1; roundRect(g, 34, -hh / 2, hw, hh, 6); g.fill(); g.stroke();
      g.fillStyle = col(shade(look.wpnColor || '#c9c3de', -0.3)); roundRect(g, 34, -hh / 2, hw * 0.35, hh, 4); g.fill();
      g.fillStyle = col(shade(look.wpnColor || '#c9c3de', 0.35)); g.fillRect(34 + hw * 0.55, -hh / 2 + 5, 4, hh - 10);
      g.strokeStyle = OUTLINE; g.lineWidth = 3; g.beginPath(); g.moveTo(34, -hh / 2 + 8); g.lineTo(34 + hw, -hh / 2 + 8); g.moveTo(34, hh / 2 - 8); g.lineTo(34 + hw, hh / 2 - 8); g.stroke();
      if (glow) { g.globalCompositeOperation = 'lighter'; drawGlowLocal(g, 34 + hw / 2, 0, 22 + tier * 3, glow); g.globalCompositeOperation = 'source-over'; }
      break;
    }
    case 'dagger': {
      g.fillStyle = col('#3a2a20'); roundRect(g, -4, -2.5, 10, 5, 2); g.fill(); g.stroke();
      g.fillStyle = c1; g.beginPath(); g.moveTo(6, -4); g.lineTo(26 + tier * 2, 0); g.lineTo(6, 4); g.closePath(); g.fill(); g.stroke();
      if (glow) { g.globalCompositeOperation = 'lighter'; drawGlowLocal(g, 16, 0, 10 + tier * 2, glow); g.globalCompositeOperation = 'source-over'; }
      break;
    }
    case 'daggers': {
      g.fillStyle = col('#3a2a20'); roundRect(g, -4, -2.5, 10, 5, 2); g.fill(); g.stroke();
      g.fillStyle = c1; g.beginPath(); g.moveTo(6, -4); g.lineTo(26 + tier * 2, 0); g.lineTo(6, 4); g.closePath(); g.fill(); g.stroke();
      if (glow) { g.globalCompositeOperation = 'lighter'; drawGlowLocal(g, 16, 0, 10 + tier * 2, glow); g.globalCompositeOperation = 'source-over'; }
      break;
    }
    case 'keytar': {
      g.fillStyle = col('#2b2b3a'); roundRect(g, -6, -3, 36, 6, 2); g.fill(); g.stroke();
      g.fillStyle = c1; g.beginPath(); g.moveTo(28, -5); g.lineTo(52, -16); g.lineTo(58, -2); g.lineTo(52, 14); g.lineTo(34, 10); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) g.fillRect(-2 + i * 6, -2, 3, 4);
      if (glow) { g.globalCompositeOperation = 'lighter'; drawGlowLocal(g, 48, 0, 16 + tier * 3, glow); g.globalCompositeOperation = 'source-over'; }
      break;
    }
    case 'glitchsword': {
      const t = look._t || 0;
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ff3df2' : '#3dfff6'; g.fillRect(4 + i * 5, -3 + ((i * 7 + Math.floor(t * 15)) % 5) - 2, 6, 6); }
      g.fillStyle = '#fff'; g.fillRect(-4, -2, 8, 4);
      break;
    }
    case 'bow': {
      g.strokeStyle = col('#8a5a2b'); g.lineWidth = 4; g.beginPath(); g.arc(-6, 0, 22, -1.2, 1.2); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6 + Math.cos(-1.2) * 22, Math.sin(-1.2) * 22); g.lineTo(-6 + Math.cos(1.2) * 22, Math.sin(1.2) * 22); g.stroke();
      break;
    }
    case 'club': {
      g.fillStyle = col('#8a5a2b'); g.beginPath(); g.moveTo(-4, -3); g.lineTo(34, -8); g.quadraticCurveTo(42, 0, 34, 8); g.lineTo(-4, 3); g.closePath(); g.fill(); g.stroke();
      break;
    }
    case 'sword': {
      g.fillStyle = col('#3a2a20'); g.fillRect(-4, -2.5, 10, 5); g.strokeRect(-4, -2.5, 10, 5);
      g.fillStyle = col('#ffc53d'); g.fillRect(5, -8, 4, 16); g.strokeRect(5, -8, 4, 16);
      g.fillStyle = c1; g.beginPath(); g.moveTo(9, -4); g.lineTo(46, -3); g.lineTo(52, 0); g.lineTo(46, 3); g.lineTo(9, 4); g.closePath(); g.fill(); g.stroke();
      break;
    }
    case 'spear': {
      g.fillStyle = col('#8a5a2b'); roundRect(g, -20, -2.5, 64, 5, 2); g.fill(); g.stroke();
      g.fillStyle = c1; g.beginPath(); g.moveTo(42, -6); g.lineTo(58, 0); g.lineTo(42, 6); g.closePath(); g.fill(); g.stroke();
      break;
    }
    case 'wand': {
      g.fillStyle = col('#5a3a2a'); roundRect(g, -4, -2, 26, 4, 2); g.fill(); g.stroke();
      g.fillStyle = c1; g.beginPath(); g.arc(24, 0, 5, 0, TAU); g.fill(); g.stroke();
      if (glow) { g.globalCompositeOperation = 'lighter'; drawGlowLocal(g, 24, 0, 14, glow); g.globalCompositeOperation = 'source-over'; }
      break;
    }
    case 'bomb': {
      g.fillStyle = '#2b2b3a'; g.beginPath(); g.arc(4, 0, 8, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = '#ffc53d'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, -6); g.lineTo(12, -11); g.stroke();
      break;
    }
    case 'shieldspear': {
      g.fillStyle = col('#8a5a2b'); roundRect(g, -12, -2.5, 52, 5, 2); g.fill(); g.stroke();
      g.fillStyle = c1; g.beginPath(); g.moveTo(38, -5); g.lineTo(52, 0); g.lineTo(38, 5); g.closePath(); g.fill(); g.stroke();
      break;
    }
  }
  g.restore();
}

// ---------------- non-humanoid monsters & bosses ----------------
// Each returns nothing; drawn at feet position (x,y) with scale & facing.
const MonsterArt = {
  slime(g, f, look, fx, col) {
    const T = f.clock || 0;
    const sq = f.anim === 'attack' ? 1 + Math.sin(f.animT * 20) * 0.2 : 1 + Math.sin(T * 5) * 0.08;
    const w = 30 / sq, hh = 30 * sq;
    g.fillStyle = col(look.body); g.strokeStyle = OUTLINE; g.lineWidth = 3.2;
    g.beginPath(); g.moveTo(-w, 0); g.quadraticCurveTo(-w * 1.05, -hh * 1.1, 0, -hh * 1.25); g.quadraticCurveTo(w * 1.05, -hh * 1.1, w, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(-w * 0.35, -hh * 0.85, w * 0.2, hh * 0.12, -0.5, 0, TAU); g.fill();
    if (look.crown) { g.fillStyle = '#ffc53d'; g.beginPath(); g.moveTo(-10, -hh * 1.2); g.lineTo(-12, -hh * 1.2 - 14); g.lineTo(-4, -hh * 1.2 - 6); g.lineTo(0, -hh * 1.2 - 16); g.lineTo(4, -hh * 1.2 - 6); g.lineTo(12, -hh * 1.2 - 14); g.lineTo(10, -hh * 1.2); g.closePath(); g.fill(); g.stroke(); }
    g.save(); g.translate(4, -hh * 0.62);
    drawEyes(g, 16, { eyes: f.anim === 'hurt' ? 'hurt' : f.anim === 'dead' ? 'ko' : 'normal' }, look);
    g.strokeStyle = OUTLINE; g.lineWidth = 2.4; g.beginPath(); g.arc(7, 7, 4, 0.2, Math.PI - 0.2); g.stroke();
    g.restore();
  },
  bat(g, f, look, fx, col) {
    const T = f.clock || 0;
    const flap = Math.sin(T * 18);
    const yb = -46 + Math.sin(T * 4) * 5;
    g.translate(0, yb);
    g.fillStyle = col(look.wing); g.strokeStyle = OUTLINE; g.lineWidth = 3;
    for (const sd of [-1, 1]) {
      g.beginPath(); g.moveTo(0, 0);
      g.lineTo(sd * 20, -12 - flap * 10); g.lineTo(sd * 36, -4 - flap * 14); g.lineTo(sd * 30, 6 - flap * 4); g.lineTo(sd * 22, 2); g.lineTo(sd * 14, 10); g.closePath(); g.fill(); g.stroke();
    }
    // pixelated body (it's a "byte" bat)
    g.fillStyle = col(look.body);
    g.fillRect(-12, -12, 24, 22); g.strokeRect(-12, -12, 24, 22);
    g.fillStyle = col(look.body); g.beginPath(); g.moveTo(-12, -12); g.lineTo(-8, -20); g.lineTo(-4, -12); g.moveTo(4, -12); g.lineTo(8, -20); g.lineTo(12, -12); g.fill(); g.stroke();
    g.fillStyle = look.eyeGlow || '#ff4f73'; g.fillRect(-7, -6, 5, 5); g.fillRect(3, -6, 5, 5);
    g.fillStyle = '#fff'; g.fillRect(-4, 4, 3, 4); g.fillRect(2, 4, 3, 4);
  },
  mushroom(g, f, look, fx, col) {
    const T = f.clock || 0;
    const walk = f.anim === 'walk' ? Math.sin(f.walkPhase) : 0;
    g.fillStyle = col(look.stem); g.strokeStyle = OUTLINE; g.lineWidth = 3;
    // legs
    g.beginPath(); g.ellipse(-8 + walk * 5, -4, 7, 5, 0, 0, TAU); g.ellipse(8 - walk * 5, -4, 7, 5, 0, 0, TAU); g.fill(); g.stroke();
    roundRect(g, -14, -40, 28, 36, 10); g.fill(); g.stroke();
    const bob = Math.sin(T * 3) * 1.5;
    g.save(); g.translate(2, -24 + bob); drawEyes(g, 13, { eyes: f.anim === 'hurt' ? 'hurt' : f.anim === 'dead' ? 'ko' : 'angry' }, { ...look, angry: true }); g.restore();
    g.fillStyle = col(look.cap);
    g.beginPath(); g.moveTo(-34, -36 + bob); g.quadraticCurveTo(-30, -78 + bob, 0, -80 + bob); g.quadraticCurveTo(30, -78 + bob, 34, -36 + bob); g.quadraticCurveTo(0, -30 + bob, -34, -36 + bob); g.fill(); g.stroke();
    g.fillStyle = col('#fff4e2');
    [[-16, -58], [8, -66], [18, -48], [-4, -46]].forEach(([x, y], i) => { g.beginPath(); g.ellipse(x, y + bob, 5 + (i % 2) * 2, 4, 0, 0, TAU); g.fill(); });
    if (look.glowCap) { g.globalCompositeOperation = 'lighter'; drawGlowLocal(g, 0, -60 + bob, 40, look.glowCap); g.globalCompositeOperation = 'source-over'; }
  },
  golem(g, f, look, fx, col) {
    const T = f.clock || 0;
    const walk = f.anim === 'walk' ? Math.sin(f.walkPhase) : 0;
    const atk = f.anim === 'attack' ? Math.sin(Math.min(1, f.animT / 0.5) * Math.PI) : 0;
    g.fillStyle = col(look.rock); g.strokeStyle = OUTLINE; g.lineWidth = 3.5;
    // legs
    roundRect(g, -26 + walk * 4, -34, 20, 34, 6); g.fill(); g.stroke();
    roundRect(g, 6 - walk * 4, -34, 20, 34, 6); g.fill(); g.stroke();
    // body
    g.beginPath(); g.moveTo(-40, -30); g.lineTo(-44, -80); g.lineTo(-20, -104); g.lineTo(26, -100); g.lineTo(44, -74); g.lineTo(38, -30); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = col(shade(look.rock, -0.25)); g.beginPath(); g.moveTo(-40, -30); g.lineTo(-44, -80); g.lineTo(-20, -104); g.lineTo(-8, -60); g.closePath(); g.fill();
    // cracks glowing
    g.strokeStyle = look.core; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, -90); g.lineTo(0, -72); g.lineTo(-8, -58); g.lineTo(6, -44); g.stroke();
    g.globalCompositeOperation = 'lighter'; drawGlowLocal(g, 0, -68, 26 + Math.sin(T * 6) * 3, look.core); g.globalCompositeOperation = 'source-over';
    // arms
    g.fillStyle = col(look.rock); g.strokeStyle = OUTLINE; g.lineWidth = 3.5;
    g.save(); g.translate(30, -84); g.rotate(-0.4 - atk * 1.6); roundRect(g, -10, 0, 22, 50, 8); g.fill(); g.stroke(); g.restore();
    // head eyes
    g.fillStyle = look.core; g.fillRect(4, -92, 10, 5); g.fillRect(20, -90, 10, 5);
  },
  snowman(g, f, look, fx, col) {
    const T = f.clock || 0;
    g.fillStyle = col('#f4fbff'); g.strokeStyle = OUTLINE; g.lineWidth = 3;
    g.beginPath(); g.arc(0, -26, 28, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.arc(0, -68, 21, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.arc(2, -102, 16, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = OUTLINE; [[-2, -76], [-2, -62], [-2, -48]].forEach(([x, y]) => { g.beginPath(); g.arc(x + 6, y, 3, 0, TAU); g.fill(); });
    g.fillStyle = '#ff8a2b'; g.beginPath(); g.moveTo(10, -102); g.lineTo(30, -98); g.lineTo(10, -96); g.fill();
    g.save(); g.translate(0, -106); drawEyes(g, 11, { eyes: f.anim === 'hurt' ? 'hurt' : 'angry' }, { angry: true }); g.restore();
    g.fillStyle = col('#2b2b3a'); g.fillRect(-12, -134, 26, 18); g.strokeRect(-12, -134, 26, 18); g.fillRect(-18, -118, 38, 5); g.strokeRect(-18, -118, 38, 5);
    const a = f.anim === 'attack' ? -1.2 : Math.sin(T * 2) * 0.2;
    g.strokeStyle = '#6b4424'; g.lineWidth = 4; g.beginPath(); g.moveTo(18, -72); g.lineTo(18 + Math.cos(a) * 28, -72 + Math.sin(a) * 28); g.stroke();
    g.beginPath(); g.moveTo(-18, -72); g.lineTo(-40, -86); g.stroke();
  },
  wraith(g, f, look, fx, col) {
    const T = f.clock || 0;
    const yb = -40 + Math.sin(T * 3) * 6;
    g.translate(0, yb);
    g.fillStyle = col(look.body); g.strokeStyle = OUTLINE; g.lineWidth = 3;
    g.globalAlpha = 0.9;
    g.beginPath(); g.moveTo(-22, 10); g.quadraticCurveTo(-26, -40, 0, -46); g.quadraticCurveTo(26, -40, 22, 10);
    for (let i = 0; i < 5; i++) g.lineTo(22 - i * 11 - 5.5, 10 + (i % 2 ? -8 : 8) + Math.sin(T * 8 + i) * 3);
    g.closePath(); g.fill(); g.stroke();
    g.globalAlpha = 1;
    if (look.text) {
      g.fillStyle = OUTLINE; g.font = `bold 13px ${FONT_PIXEL}`; g.textAlign = 'center'; g.fillText(look.text, 0, -4);
    }
    g.save(); g.translate(0, -26); drawEyes(g, 13, { eyes: f.anim === 'hurt' ? 'hurt' : 'normal' }, look); g.restore();
  },
  floppy(g, f, look, fx, col) {
    const T = f.clock || 0;
    const yb = -58 + Math.sin(T * 5) * 4;
    g.translate(0, yb);
    g.strokeStyle = OUTLINE; g.lineWidth = 3;
    // propeller
    g.fillStyle = '#c9c3de'; g.fillRect(-2, -32, 4, 10);
    g.save(); g.translate(0, -32); g.scale(Math.cos(T * 40), 1); g.fillStyle = '#ff4f73'; g.fillRect(-22, -3, 44, 6); g.strokeRect(-22, -3, 44, 6); g.restore();
    // the disk
    g.fillStyle = col(look.body); roundRect(g, -22, -22, 44, 44, 3); g.fill(); g.stroke();
    g.fillStyle = col('#c9ccd6'); g.fillRect(-12, -22, 24, 14); g.strokeRect(-12, -22, 24, 14);
    g.fillStyle = OUTLINE; g.fillRect(2, -19, 6, 9);
    g.fillStyle = '#fff4e2'; g.fillRect(-16, 2, 32, 18); g.strokeRect(-16, 2, 32, 18);
    g.fillStyle = OUTLINE; g.font = `bold 7px ${FONT_PIXEL}`; g.textAlign = 'center'; g.fillText('1.44MB', 0, 14);
    g.fillStyle = look.eyeGlow || '#ff4f73'; g.fillRect(-14, -4, 6, 4); g.fillRect(8, -4, 6, 4);
  },
  cow(g, f, look, fx, col) {
    const walk = f.anim === 'walk' ? Math.sin(f.walkPhase) : 0;
    g.fillStyle = col('#fff'); g.strokeStyle = OUTLINE; g.lineWidth = 3;
    for (const [lx, ph] of [[-22, 1], [-10, -1], [12, 1], [24, -1]]) { g.fillRect(lx - 4, -26 + walk * ph * 2, 8, 26); g.strokeRect(lx - 4, -26 + walk * ph * 2, 8, 26); }
    g.beginPath(); g.ellipse(0, -40, 36, 22, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = col('#1b1030'); g.beginPath(); g.ellipse(-12, -46, 10, 7, 0.3, 0, TAU); g.ellipse(14, -34, 8, 6, -0.2, 0, TAU); g.fill();
    g.fillStyle = col('#fff'); g.beginPath(); g.ellipse(38, -52, 16, 14, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = col('#ffb3c8'); g.beginPath(); g.ellipse(48, -46, 9, 7, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = OUTLINE; g.beginPath(); g.arc(34, -56, 2.5, 0, TAU); g.arc(42, -57, 2.5, 0, TAU); g.fill();
    g.fillStyle = col('#f2ecdc'); g.beginPath(); g.moveTo(30, -64); g.lineTo(26, -74); g.lineTo(34, -66); g.fill(); g.stroke();
    if (look.halberd) { g.strokeStyle = '#6b4424'; g.lineWidth = 4; g.beginPath(); g.moveTo(20, -20); g.lineTo(40, -100); g.stroke(); g.fillStyle = '#c9c3de'; g.strokeStyle = OUTLINE; g.lineWidth = 3; g.beginPath(); g.moveTo(38, -94); g.lineTo(56, -104); g.lineTo(52, -84); g.closePath(); g.fill(); g.stroke(); }
  },
  mimic(g, f, look, fx, col) {
    const T = f.clock || 0;
    const open = f.anim === 'attack' ? Math.min(1, f.animT * 6) : Math.max(0, Math.sin(T * 2)) * 0.2;
    g.strokeStyle = OUTLINE; g.lineWidth = 3.5;
    g.fillStyle = col('#3a2a7a'); g.fillRect(-32, -120, 64, 120); g.strokeRect(-32, -120, 64, 120);
    g.fillStyle = col('#2a1f5c'); g.fillRect(-32, -120, 16, 120);
    // marquee
    g.fillStyle = '#ffc53d'; g.fillRect(-32, -136, 64, 18); g.strokeRect(-32, -136, 64, 18);
    g.fillStyle = OUTLINE; g.font = `bold 9px ${FONT_PIXEL}`; g.textAlign = 'center'; g.fillText('INSERT COIN', 0, -124);
    // screen / mouth
    g.fillStyle = '#0a0717'; g.fillRect(-24, -110, 48, 36 + open * 20); g.strokeRect(-24, -110, 48, 36 + open * 20);
    g.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-24 + i * 8, -110); g.lineTo(-20 + i * 8, -100); g.lineTo(-16 + i * 8, -110); g.fill(); }
    if (open > 0.3) for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-24 + i * 8, -74 + open * 20); g.lineTo(-20 + i * 8, -84 + open * 20); g.lineTo(-16 + i * 8, -74 + open * 20); g.fill(); }
    g.fillStyle = '#ff4f73'; g.fillRect(-14, -98, 8, 6); g.fillRect(6, -98, 8, 6);
    // controls
    g.fillStyle = col('#5a4aa8'); g.fillRect(-32, -62, 64, 14); g.strokeRect(-32, -62, 64, 14);
    g.fillStyle = '#ff4f73'; g.beginPath(); g.arc(6, -55, 4, 0, TAU); g.arc(16, -55, 4, 0, TAU); g.fill();
    g.strokeStyle = '#ddd'; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, -55); g.lineTo(-14 + Math.sin(T * 8) * 4, -66); g.stroke();
  },
  worm(g, f, look, fx, col) {
    const T = f.clock || 0;
    const up = f.submerged ? 0.15 : 1;
    g.fillStyle = col('#d9a45b'); g.strokeStyle = OUTLINE; g.lineWidth = 3.5;
    const segs = 6;
    for (let i = segs; i >= 0; i--) {
      const yy = -i * 20 * up + Math.sin(T * 4 + i) * 3;
      const xx = Math.sin(T * 2 + i * 0.7) * 10 * i * 0.2;
      g.beginPath(); g.ellipse(xx, yy, 26 - i * 1.2, 16, 0, 0, TAU); g.fill(); g.stroke();
    }
    const hx = Math.sin(T * 2) * 1.5, hy = -segs * 20 * up - 20;
    g.fillStyle = col('#e8b86c'); g.beginPath(); g.arc(hx, hy, 30, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#5a1030'; g.beginPath(); g.arc(hx + 12, hy + 6, 16, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(hx + 12 + Math.cos(a) * 16, hy + 6 + Math.sin(a) * 16); g.lineTo(hx + 12 + Math.cos(a) * 9, hy + 6 + Math.sin(a) * 9); g.lineTo(hx + 12 + Math.cos(a + 0.3) * 16, hy + 6 + Math.sin(a + 0.3) * 16); g.fill(); }
  },
  treant(g, f, look, fx, col) {
    const T = f.clock || 0;
    const sway = Math.sin(T * 1.5) * 0.05;
    const atk = f.anim === 'attack' ? Math.sin(Math.min(1, f.animT / (f.move ? f.move.windup + f.move.active : 0.6)) * Math.PI) : 0;
    g.strokeStyle = OUTLINE; g.lineWidth = 4;
    // roots
    g.fillStyle = col('#6b4424');
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 20, -30); g.quadraticCurveTo(sd * 50, -10, sd * 70, 0); g.lineTo(sd * 30, 0); g.closePath(); g.fill(); g.stroke(); }
    g.save(); g.rotate(sway);
    // trunk
    g.fillStyle = col('#7a5230');
    g.beginPath(); g.moveTo(-44, 0); g.quadraticCurveTo(-54, -120, -36, -200); g.lineTo(36, -200); g.quadraticCurveTo(54, -120, 44, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = col('#5e3d22'); g.beginPath(); g.moveTo(-44, 0); g.quadraticCurveTo(-54, -120, -36, -200); g.lineTo(-10, -200); g.quadraticCurveTo(-24, -100, -12, 0); g.closePath(); g.fill();
    // bark lines
    g.strokeStyle = col('#4a2f18'); g.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-30 + i * 12, -20 - i * 5); g.quadraticCurveTo(-26 + i * 12, -80, -30 + i * 12, -130 - i * 4); g.stroke(); }
    // face
    g.fillStyle = '#1b1030'; g.beginPath(); g.ellipse(-12, -140, 10, 14, 0.2, 0, TAU); g.ellipse(22, -140, 10, 14, -0.2, 0, TAU); g.fill();
    g.fillStyle = look.eyeGlow || '#9dff5a'; g.beginPath(); g.arc(-10, -138, 4, 0, TAU); g.arc(24, -138, 4, 0, TAU); g.fill();
    g.fillStyle = '#1b1030'; g.beginPath(); g.ellipse(6, -100, 18, 8 + atk * 10, 0, 0, TAU); g.fill();
    // moustache moss
    g.fillStyle = col('#4aa84a'); g.beginPath(); g.ellipse(-8, -114, 16, 6, 0.3, 0, TAU); g.ellipse(20, -114, 16, 6, -0.3, 0, TAU); g.fill();
    // arms (branches)
    g.strokeStyle = OUTLINE; g.lineWidth = 16; g.lineCap = 'round';
    const armA = -0.4 - atk * 1.4;
    g.beginPath(); g.moveTo(30, -150); g.lineTo(30 + Math.cos(armA) * 80, -150 + Math.sin(armA) * 80); g.stroke();
    g.strokeStyle = col('#7a5230'); g.lineWidth = 10; g.beginPath(); g.moveTo(30, -150); g.lineTo(30 + Math.cos(armA) * 80, -150 + Math.sin(armA) * 80); g.stroke();
    g.strokeStyle = OUTLINE; g.lineWidth = 16; g.beginPath(); g.moveTo(-30, -150); g.lineTo(-90, -190 + Math.sin(T * 2) * 8); g.stroke();
    g.strokeStyle = col('#7a5230'); g.lineWidth = 10; g.beginPath(); g.moveTo(-30, -150); g.lineTo(-90, -190 + Math.sin(T * 2) * 8); g.stroke();
    // canopy
    g.lineWidth = 4; g.strokeStyle = OUTLINE;
    const leaves = [[-50, -220, 50], [10, -250, 60], [60, -215, 48], [-10, -205, 50], [40, -190, 36], [-70, -190, 34]];
    for (const [lx, ly, r] of leaves) { g.fillStyle = col('#3f9a4a'); g.beginPath(); g.arc(lx, ly, r, 0, TAU); g.fill(); g.stroke(); }
    for (const [lx, ly, r] of leaves) { g.fillStyle = col('#5cc063'); g.beginPath(); g.arc(lx - r * 0.25, ly - r * 0.25, r * 0.55, 0, TAU); g.fill(); }
    // a tiny bird nest easter egg
    g.fillStyle = col('#a0703a'); g.beginPath(); g.ellipse(30, -262, 16, 7, 0, 0, Math.PI); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(26, -265, 4, 5, 0, 0, TAU); g.ellipse(34, -265, 4, 5, 0, 0, TAU); g.fill();
    g.restore();
  },
  dragon(g, f, look, fx, col) {
    const T = f.clock || 0;
    const atk = f.anim === 'attack' ? Math.sin(Math.min(1, f.animT / 0.8) * Math.PI) : 0;
    const breathe = Math.sin(T * 2) * 4;
    g.strokeStyle = OUTLINE; g.lineWidth = 4;
    // wings
    g.fillStyle = col('#8e2b2b');
    for (const sd of [1, 0.6]) {
      g.save(); g.scale(sd, 1);
      g.beginPath(); g.moveTo(-30, -150); g.lineTo(-150, -260 - breathe * 3); g.lineTo(-130, -180); g.lineTo(-190, -190); g.lineTo(-140, -130); g.lineTo(-170, -110); g.lineTo(-60, -110); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
    // body
    g.fillStyle = col('#c2392b');
    g.beginPath(); g.ellipse(-20, -90, 90, 70, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = col('#ffb35c'); g.beginPath(); g.ellipse(10, -70, 50, 45, 0, 0, TAU); g.fill();
    g.strokeStyle = col('#d98a3a'); g.lineWidth = 2; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-30, -100 + i * 12); g.quadraticCurveTo(10, -95 + i * 12, 50, -100 + i * 12); g.stroke(); }
    // legs
    g.fillStyle = col('#a52d22'); g.strokeStyle = OUTLINE; g.lineWidth = 4;
    roundRect(g, -80, -40, 40, 40, 12); g.fill(); g.stroke(); roundRect(g, 10, -40, 40, 40, 12); g.fill(); g.stroke();
    // neck + head
    const nx = 60 + atk * 30, ny = -170 + breathe - atk * 10;
    g.fillStyle = col('#c2392b');
    g.beginPath(); g.moveTo(20, -130); g.quadraticCurveTo(50, -180, nx, ny); g.lineTo(nx + 20, ny + 30); g.quadraticCurveTo(60, -130, 50, -90); g.closePath(); g.fill(); g.stroke();
    g.save(); g.translate(nx + 20, ny);
    g.beginPath(); g.moveTo(-30, -20); g.lineTo(40, -14); g.lineTo(62, 4); g.lineTo(40, 14 + atk * 30); g.lineTo(-10, 30); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = col('#f2ecdc'); g.beginPath(); g.moveTo(-20, -18); g.lineTo(-44, -54); g.lineTo(-6, -24); g.fill(); g.stroke();
    g.fillStyle = '#ffe45c'; g.beginPath(); g.ellipse(14, -6, 8, 5, 0.2, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = OUTLINE; g.fillRect(14, -10, 3, 9);
    if (atk > 0.2) { g.globalCompositeOperation = 'lighter'; drawGlowLocal(g, 60, 10, 40 * atk, '#ff7a2f'); g.globalCompositeOperation = 'source-over'; }
    g.restore();
    // tail
    g.fillStyle = col('#c2392b'); g.strokeStyle = OUTLINE;
    g.beginPath(); g.moveTo(-100, -80); g.quadraticCurveTo(-180, -60 + Math.sin(T * 3) * 10, -210, -110); g.lineTo(-190, -60); g.quadraticCurveTo(-160, -30, -90, -50); g.closePath(); g.fill(); g.stroke();
  },
  bug(g, f, look, fx, col) { // The Millennium Bug: a giant glitch beetle with a CRT head
    const T = f.clock || 0;
    const atk = f.anim === 'attack' ? Math.sin(Math.min(1, f.animT / 0.7) * Math.PI) : 0;
    g.strokeStyle = OUTLINE; g.lineWidth = 4;
    // legs
    for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) {
      const ph = Math.sin(T * 6 + i * 2 + (sd > 0 ? 1 : 0)) * 8;
      g.strokeStyle = OUTLINE; g.lineWidth = 9; g.beginPath(); g.moveTo(-40 + i * 40, -60); g.lineTo(-60 + i * 40 + sd * 10, -90 + ph); g.lineTo(-70 + i * 44 + sd * 16, 0); g.stroke();
      g.strokeStyle = col('#2b2b3a'); g.lineWidth = 5; g.beginPath(); g.moveTo(-40 + i * 40, -60); g.lineTo(-60 + i * 40 + sd * 10, -90 + ph); g.lineTo(-70 + i * 44 + sd * 16, 0); g.stroke();
    }
    // shell
    g.lineWidth = 4; g.strokeStyle = OUTLINE;
    g.fillStyle = col('#3a2a7a'); g.beginPath(); g.ellipse(-10, -90, 100, 58, 0, Math.PI, TAU); g.lineTo(90, -80); g.lineTo(-110, -80); g.closePath(); g.fill(); g.stroke();
    g.save(); g.clip();
    for (let i = 0; i < 40; i++) { g.fillStyle = (i + Math.floor(T * 8)) % 3 ? '#ff3df2' : '#3dfff6'; g.globalAlpha = 0.5; g.fillRect(-110 + ((i * 53) % 200), -148 + ((i * 29) % 70), 10, 10); }
    g.globalAlpha = 1; g.restore();
    g.fillStyle = col('#1b1030'); g.fillRect(-12, -148, 4, 68);
    // CRT head
    g.save(); g.translate(96 + atk * 40, -110 + Math.sin(T * 3) * 4);
    g.fillStyle = col('#d9d4c4'); roundRect(g, -40, -40, 80, 70, 8); g.fill(); g.stroke();
    g.fillStyle = '#0a0717'; roundRect(g, -32, -32, 60, 46, 10); g.fill();
    g.fillStyle = '#3dff7a'; g.font = `bold 14px ${FONT_PIXEL}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const glitchText = ['19100', '00:00', 'Y2K', '1/1/00', 'ERR'][Math.floor(T * 1.5) % 5];
    g.fillText(glitchText, -2, -9);
    g.fillStyle = 'rgba(61,255,122,.15)'; for (let i = 0; i < 8; i++) g.fillRect(-32, -32 + i * 6, 60, 2);
    // antennae
    g.strokeStyle = OUTLINE; g.lineWidth = 3; g.beginPath(); g.moveTo(-10, -40); g.lineTo(-30, -80 + Math.sin(T * 5) * 6); g.moveTo(10, -40); g.lineTo(30, -84 + Math.cos(T * 5) * 6); g.stroke();
    g.fillStyle = '#ff4f73'; g.beginPath(); g.arc(-30, -80 + Math.sin(T * 5) * 6, 5, 0, TAU); g.arc(30, -84 + Math.cos(T * 5) * 6, 5, 0, TAU); g.fill();
    // mandibles
    g.fillStyle = col('#2b2b3a'); g.strokeStyle = OUTLINE; g.lineWidth = 3;
    g.beginPath(); g.moveTo(30, 20); g.quadraticCurveTo(60, 20 + atk * 10, 50, 40); g.lineTo(34, 30); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-30, 20); g.quadraticCurveTo(-10, 44 + atk * 10, 10, 40); g.lineTo(-6, 28); g.closePath(); g.fill(); g.stroke();
    g.restore();
  },
};
