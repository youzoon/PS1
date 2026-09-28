// ============================================================
//  Input: keyboard (+ LF2 style D→A sequences), touch stick & buttons,
//  cheat-code buffer, Konami code
// ============================================================
const Input = (() => {
  const held = {};           // logical buttons currently held
  const pressed = {};        // pressed this frame (edge)
  const keyMap = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    KeyJ: 'atk', KeyZ: 'atk', KeyK: 'jump', KeyX: 'jump', KeyL: 'def', KeyC: 'def',
    KeyU: 's1', KeyI: 's2', KeyO: 's3', Digit1: 's1', Digit2: 's2', Digit3: 's3', Space: 'od',
    Escape: 'pause', KeyP: 'pause', Enter: 'start',
  };
  let seqBuf = [];           // recent logical presses with time, for D→A combos
  let cheatBuf = '';
  let konami = [];
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  let lastTap = { left: 0, right: 0 };
  let runDir = 0;
  const stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, mag: 0 };
  let usingTouch = false;
  const listeners = { cheat: [], konami: [], anyKey: [] };
  let typingHandler = null;  // Keyboard Warrior mode takes raw keys

  function now() { return performance.now(); }
  function press(b) {
    if (!held[b]) {
      pressed[b] = true;
      seqBuf.push({ b, t: now() });
      if (seqBuf.length > 8) seqBuf.shift();
      if (b === 'left' || b === 'right') {
        const t = now();
        if (t - lastTap[b] < 260) runDir = b === 'left' ? -1 : 1;
        lastTap[b] = t;
      }
    }
    held[b] = true;
  }
  function release(b) {
    held[b] = false;
    if ((b === 'left' && runDir < 0) || (b === 'right' && runDir > 0)) runDir = 0;
  }
  function isTextTarget(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.id !== 'typeInput';
  }
  window.addEventListener('keydown', (e) => {
    Sfx.init();
    if (isTextTarget(e)) return;
    if (typingHandler && typingHandler(e)) { e.preventDefault(); return; }
    usingTouch = false;
    // konami
    konami.push(e.code); if (konami.length > KONAMI.length) konami.shift();
    if (konami.join() === KONAMI.join()) { konami = []; listeners.konami.forEach((f) => f()); }
    // cheat buffer
    if (e.key && e.key.length === 1 && /[a-z]/i.test(e.key)) {
      cheatBuf = (cheatBuf + e.key.toUpperCase()).slice(-24);
      listeners.cheat.forEach((f) => f(cheatBuf));
    }
    listeners.anyKey.forEach((f) => f(e));
    const b = keyMap[e.code];
    if (b) {
      if (!e.repeat) press(b);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const b = keyMap[e.code];
    if (b) release(b);
  });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; runDir = 0; });

  // LF2 grammar: Defend, then a direction, then Attack inside a short window
  function consumeSpecial() {
    const n = seqBuf.length;
    if (n < 3) return null;
    const a = seqBuf[n - 1];
    if (a.b !== 'atk' || now() - a.t > 90) return null;
    const d = seqBuf[n - 2], df = seqBuf[n - 3];
    if (df.b !== 'def' || a.t - df.t > 650) return null;
    let slot = null;
    if (d.b === 'left' || d.b === 'right') slot = 's1';
    else if (d.b === 'up') slot = 's2';
    else if (d.b === 'down') slot = 's3';
    if (!slot) return null;
    seqBuf = [];
    return { slot, dir: d.b === 'left' ? -1 : d.b === 'right' ? 1 : 0 };
  }

  // ------------- touch -------------
  function setupTouch() {
    const zone = $('stickZone'), stickEl = $('stick'), knob = $('stickKnob');
    const R0 = 52;
    zone.addEventListener('pointerdown', (e) => {
      Sfx.init();
      usingTouch = true;
      if (stick.active) return;
      stick.active = true; stick.id = e.pointerId;
      const r = zone.getBoundingClientRect();
      stick.ox = e.clientX - r.left; stick.oy = e.clientY - r.top;
      stick.x = 0; stick.y = 0; stick.mag = 0;
      stickEl.hidden = false;
      stickEl.style.left = stick.ox + 'px'; stickEl.style.top = stick.oy + 'px';
      knob.style.transform = 'translate(0,0)';
      try { zone.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    const move = (e) => {
      if (!stick.active || e.pointerId !== stick.id) return;
      const r = zone.getBoundingClientRect();
      let dx = e.clientX - r.left - stick.ox, dy = e.clientY - r.top - stick.oy;
      const m = Math.hypot(dx, dy);
      if (m > R0) {
        // let the stick base follow the thumb a little (floating stick)
        const k = (m - R0) / m;
        stick.ox += dx * k; stick.oy += dy * k;
        dx *= R0 / m; dy *= R0 / m;
        stickEl.style.left = stick.ox + 'px'; stickEl.style.top = stick.oy + 'px';
      }
      stick.x = dx / R0; stick.y = dy / R0; stick.mag = Math.min(1, m / R0);
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      e.preventDefault();
    };
    zone.addEventListener('pointermove', move);
    const end = (e) => {
      if (e.pointerId !== stick.id) return;
      stick.active = false; stick.id = null; stick.x = stick.y = stick.mag = 0;
      stickEl.hidden = true;
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    document.querySelectorAll('#touch .tbtn').forEach((btn) => {
      const b = btn.dataset.b;
      btn.addEventListener('pointerdown', (e) => {
        Sfx.init(); usingTouch = true;
        press(b); btn.classList.add('on');
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        e.preventDefault();
      });
      const up = () => { release(b); btn.classList.remove('on'); };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  // Unified movement vector (x: -1..1, z: -1..1) and run flag
  function moveVec() {
    let x = 0, z = 0, run = false;
    if (held.left) x -= 1;
    if (held.right) x += 1;
    if (held.up) z -= 1;
    if (held.down) z += 1;
    if (stick.active && stick.mag > 0.2) {
      x = stick.x; z = stick.y;
      if (Math.abs(x) < 0.25) x = 0;
      if (Math.abs(z) < 0.3) z = 0;
      run = stick.mag > 0.92 && Math.abs(stick.x) > 0.6;
    }
    if (runDir && ((runDir < 0 && held.left) || (runDir > 0 && held.right))) run = true;
    return { x, z, run };
  }
  function endFrame() { for (const k in pressed) pressed[k] = false; }
  function clearAll() { for (const k in held) held[k] = false; for (const k in pressed) pressed[k] = false; seqBuf = []; runDir = 0; }
  return {
    held, pressed, press, release, moveVec, consumeSpecial, endFrame, clearAll, setupTouch, stick,
    on(ev, f) { listeners[ev].push(f); },
    get touch() { return usingTouch; },
    set touch(v) { usingTouch = v; },
    setTyping(fn) { typingHandler = fn; },
    resetCheat() { cheatBuf = ''; },
  };
})();
