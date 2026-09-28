// ============================================================
//  Game flow, main loop, cheats, bot, boot
// ============================================================
const TIPS = [
  'Block (D) facing an enemy to cut damage by 80%.',
  'Freeze an enemy with 3 ice hits, then shatter it with fire or a heavy finisher for double damage.',
  'Your combo rank boosts XP gain. SSS means +50%!',
  'Barrels hide milk and roast chicken. Crates hide mana and quarters.',
  'Stand still and press Attack next to a barrel to lift it. Press again to throw.',
  'Bosses get enraged below 50% HP: watch for faster patterns.',
  'Red ellipses on the floor are attack warnings. Step out of them!',
  'Spend quarters on the Skill Tree. Extra Life gives you a 1UP every level.',
  'Chrono Bubble slows enemies AND their projectiles.',
  'Duo cards appear when you own spells of two different elements.',
  'Double-tap a direction to run, then attack for a dash punch.',
  'Overdrive doubles your damage and slows everyone else. Save it for bosses.',
];
const Game = {
  state: 'boot', stage: null, cheats: {}, cheatedRun: false, lastLevel: null, lastHero: null,
  startDemo() {
    const pool = HERO_ORDER.filter((h) => SAVE.heroes[h]);
    const lvl = pick([LEVELS[0], LEVELS[2], LEVELS[3], LEVELS[6], LEVELS[10]]);
    this.stage = new Stage({ mode: 'demo', level: lvl, heroId: pick(pool), bot: true });
    this.stage.banners = [];
    S.hero.x = 400; S.arena = [0, 1600];
  },
  stopStage() { this.stage = null; S = null; $('touch').hidden = true; },
  startLevel(level, heroId) {
    this.lastLevel = level; this.lastHero = heroId;
    this.cheatedRun = !!(this.cheats.god || this.cheats.idkfa || this.cheats.noclip);
    SAVE.stats.runs++; persist();
    this.state = 'play';
    this.stage = new Stage({ mode: 'level', level, heroId, onEnd: (r) => this.endLevel(r) });
    UI.show(null);
    this.syncTouch();
  },
  startEndless(heroId) {
    this.lastLevel = 'ENDLESS'; this.lastHero = heroId;
    this.state = 'play';
    const level = { id: 'ENDLESS', n: 3, name: 'Endless Colosseum', biome: 'arena', pool: [], end: 'grumble', sections: 1 };
    this.stage = new Stage({ mode: 'endless', level, heroId, onEnd: (r) => this.endEndless(r) });
    UI.show(null);
    this.syncTouch();
  },
  // ---------------- The Gauntlet: five chained battles, one build ----------------
  startGauntlet(heroId) {
    this.lastLevel = 'GAUNTLET'; this.lastHero = heroId;
    SAVE.stats.runs++; persist();
    const pool = shuffle(LEVELS.slice());
    this.gauntlet = { heroId, stage: 0, total: 5, hero: null, quarters: 0, kills: 0, maxCombo: 0, time: 0, pool, path: [] };
    this.gauntletStage(pool[0], 'safe');
  },
  gauntletStage(base, path) {
    const G = this.gauntlet;
    const diff = 2 + G.stage * 2;
    const level = { id: 'G' + G.stage, n: diff, name: base.name, biome: base.biome, pool: base.pool, end: base.end, sections: 2, night: base.night };
    const risky = path === 'risky';
    if (G.hero && !risky) G.hero.heal(G.hero.maxHp * 0.4, true);
    this.state = 'play';
    this.stage = new Stage({ mode: 'level', level, heroId: G.heroId, carry: G.hero, noKit: G.stage > 0, mods: risky ? { hpMul: 1.25, elite: 0.1, chest: true } : {}, onEnd: (r) => this.endGauntletStage(r) });
    S.gauntlet = G; S.risky = risky;
    S.banners = [];
    S.banner(`GAUNTLET ${G.stage + 1}/${G.total} · ${base.name.toUpperCase()}`, risky ? '#ff4f73' : '#b77cff', 2, true);
    G.hero = S.hero;
    UI.show(null);
    this.syncTouch();
  },
  endGauntletStage(result) {
    const G = this.gauntlet, s = S;
    G.quarters += s.quarters * (s.risky ? 1.5 : 1);
    G.kills += s.kills; G.maxCombo = Math.max(G.maxCombo, s.maxCombo); G.time += s.time;
    if (result === 'win') {
      G.stage++;
      SAVE.gauntletBest = Math.max(SAVE.gauntletBest || 0, G.stage);
      if (G.stage >= G.total) return this.finishGauntlet(true);
      persist();
      // crossroads: two paths to choose from
      const a = G.pool[(G.stage * 2) % G.pool.length], b = G.pool[(G.stage * 2 + 1) % G.pool.length];
      const body = $('resultsBody');
      body.innerHTML = '';
      body.append(h('h2', { class: 'h-display', style: 'font-size:clamp(30px,7vw,52px);color:var(--gold);text-shadow:0 5px 0 #1a0f2e' }, 'CROSSROADS'));
      body.append(h('div', { class: 'eyebrow' }, `Battle ${G.stage}/${G.total} won · ${Math.round(G.hero.hp)}/${G.hero.maxHp} HP · ${fmt(G.quarters)}¢ so far`));
      const cards = h('div', { class: 'cards', style: '--n:2' });
      const opt = (lv, path) => {
        const boss = BOSSES[lv.end];
        return h('button', { class: 'card ' + (path === 'risky' ? 'legendary' : 'rare'), onclick: () => { Sfx.play('card'); G.path.push(path); this.gauntletStage(lv, path); } },
          iconCanvas(path === 'risky' ? 'skull' : 'heart', path === 'risky' ? '#ff4f73' : '#3ee6a8', 72),
          h('div', { class: 'txt' },
            h('div', { class: 'rar' }, path === 'risky' ? 'RISKY PATH' : 'SAFE PATH'),
            h('div', { class: 'nm' }, lv.name),
            h('div', { class: 'lv' }, (boss.elite ? 'Elite: ' : 'Boss: ') + boss.name),
            h('div', { class: 'ds' }, path === 'risky' ? 'Tougher enemies and more elites. +50% quarters and a free treasure right away.' : 'Rest first: heal 40% HP before the fight.')));
      };
      cards.append(opt(a, 'safe'), opt(b, 'risky'));
      body.append(cards);
      body.append(h('div', { class: 'small muted' }, `Next battle difficulty: level ${2 + G.stage * 2}`));
      this.state = 'menu';
      UI.show('scrResults');
      Sfx.playMusic('map');
      return;
    }
    this.finishGauntlet(false);
  },
  finishGauntlet(win) {
    const G = this.gauntlet;
    const earned = Math.round(win ? G.quarters + 300 : G.quarters * 0.6);
    SAVE.quarters += earned; SAVE.lifetimeQuarters += earned;
    if (win) { unlockAch('gauntlet'); SAVE.stats.wins++; }
    if (SAVE.lifetimeQuarters >= 5000) unlockAch('rich');
    persist();
    UI.results({
      win, title: win ? 'GAUNTLET CLEARED!' : 'THE GAUNTLET WINS',
      subtitle: `${HEROES[G.heroId].name} · reached battle ${Math.min(G.total, G.stage + (win ? 0 : 1))}/${G.total}`,
      rows: [['Battles won', `${G.stage}/${G.total}`], ['Path taken', G.path.map((p) => (p === 'risky' ? '☠' : '♥')).join(' ') || '—'], ['Enemies defeated', G.kills], ['Best combo', G.maxCombo], ['Hero level', G.hero ? G.hero.level : 1], ['Quarters earned', '+' + earned + '¢' + (win ? ' (incl. 300 bonus)' : ' (60%)')]],
      tip: win ? null : pick(TIPS),
      buttons: [{ label: 'Run it again', cls: 'gold', fn: () => UI.heroes((hero) => Game.startGauntlet(hero), 'Who runs the Gauntlet?') }, { label: 'World map', fn: () => this.quitToMap() }],
    });
    this.state = 'menu';
    Sfx.playMusic(win ? 'victory' : 'map');
  },
  restart() {
    if (this.lastLevel === 'GAUNTLET') { UI.heroes((hero) => Game.startGauntlet(hero), 'Who runs the Gauntlet?'); return; }
    if (this.lastLevel === 'ENDLESS') this.startEndless(this.lastHero);
    else if (this.lastLevel) this.startLevel(this.lastLevel, this.lastHero);
  },
  quitToMap() {
    if (S && S.mode === 'typing') { Typing.active = false; Input.setTyping(null); }
    this.stopStage(); this.toMap();
  },
  toMap() { this.state = 'map'; UI.show('scrMap'); },
  syncTouch() {
    // draw spell icons onto the touch buttons
    if (!S) return;
    const btns = document.querySelectorAll('#touch .tbtn.s');
    btns.forEach((b, i) => {
      const sp = S.hero.spells[i];
      const key = sp ? sp.id : '';
      b.classList.toggle('hide', !sp);
      if (b.dataset.sp === key) return;
      b.dataset.sp = key;
      const cv = b.querySelector('canvas'); const g = cv.getContext('2d');
      g.clearRect(0, 0, 96, 96);
      if (sp) drawIcon(g, SPELLS[sp.id].icon, 48, 48, 40, EL[SPELLS[sp.id].el].c);
    });
  },
  endLevel(result) {
    const s = S, h = s.hero, L = s.level;
    const win = result === 'win';
    const first = win && !SAVE.cleared[L.id];
    const hpOk = h.hp >= h.maxHp * 0.5;
    const comboGoal = 15 + (L.n || 1) * 2;
    let stars = win ? [true, hpOk, s.maxCombo >= comboGoal] : null;
    if (s.cheated) stars = win ? [false, false, false] : null;
    const clearBonus = win ? Math.round((25 + L.n * 15) * h.stats.qMul) : 0;
    const firstBonus = first ? Math.round(L.n * 25 * h.stats.qMul) : 0;
    const collected = Math.round(s.quarters);
    const earned = win ? collected + clearBonus + firstBonus : Math.round(collected * 0.6);
    SAVE.quarters += earned; SAVE.lifetimeQuarters += earned;
    const unlocks = [];
    if (win) {
      SAVE.stats.wins++;
      if (L.id !== 'COW') SAVE.cleared[L.id] = true;
      const n = stars.filter(Boolean).length;
      SAVE.stars[L.id] = Math.max(SAVE.stars[L.id] || 0, n);
      if (L.id === 'L1') unlockAch('win1');
      const bossAch = { grumble: 'boss1', oakley: 'boss2', pharaoh: 'boss3', yeti: 'boss4', magmaw: 'boss5', bug: 'boss6' }[L.end];
      if (bossAch) unlockAch(bossAch);
      if (!s.tookDamage) unlockAch('nohit');
      if (n === 3) unlockAch('stars3');
      if (LEVELS.every((l) => SAVE.stars[l.id] === 3)) unlockAch('allstars');
      for (const hid of HERO_ORDER) { const hd = HEROES[hid]; if (hd.unlock && hd.unlock.level === L.id && !SAVE.heroes[hid]) { SAVE.heroes[hid] = true; unlocks.push(`New hero: ${hd.name}, ${hd.role}`); } }
      if (first) for (const nx of L.next || []) if (LEVEL_BY_ID[nx]) unlocks.push(`New level: ${LEVEL_BY_ID[nx].name}`);
      if (first && L.id === 'L3') unlocks.push('Endless Colosseum is open');
      const idx = LEVELS.findIndex((l) => l.id === L.id);
      if (idx >= 0 && LEVELS[idx + 1]) SAVE.mapPos = LEVELS[idx + 1].id;
    }
    if (SAVE.lifetimeQuarters >= 5000) unlockAch('rich');
    persist();
    const next = win && L.next && L.next.length ? LEVEL_BY_ID[L.next[0]] : null;
    const finale = win && L.id === 'L12';
    const rows = [['Enemies defeated', s.kills], ['Max combo', s.maxCombo + ' hits'], ['Hero level', h.level], ['Time', `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`], ['Quarters collected', collected + '¢']];
    if (win) { rows.push(['Clear bonus', '+' + clearBonus + '¢']); if (firstBonus) rows.push(['First clear bonus', '+' + firstBonus + '¢']); }
    else rows.push(['Kept (60%)', earned + '¢']);
    rows.push(['Total quarters', fmt(SAVE.quarters) + '¢']);
    UI.results({
      win,
      title: finale ? 'THE WORLD IS PATCHED!' : win ? 'STAGE CLEAR!' : 'GAME OVER',
      subtitle: finale ? 'The Millennium Bug is squashed. Rumblevale will party like it\'s 1999 forever.' : `Level ${L.n} · ${L.name}${s.cheated ? ' · CHEATER (no stars)' : ''}`,
      stars: win ? stars : null,
      starLabels: ['Clear the level', 'Finish above 50% HP', `${comboGoal}+ hit combo`],
      rows, unlocks,
      tip: win ? null : pick(TIPS),
      buttons: win
        ? [next ? { label: 'Next: ' + next.name, cls: 'gold', fn: () => { Sfx.play('card'); UI.heroes((hero) => Game.startLevel(next, hero)); } } : null,
          { label: 'World map', fn: () => this.quitToMap() },
          { label: 'Skill tree', cls: 'ghost', fn: () => UI.skills(() => UI.results(this.lastResults)) }].filter(Boolean)
        : [{ label: 'Retry', cls: 'gold', fn: () => this.restart() },
          { label: 'Skill tree', fn: () => UI.skills(() => UI.results(this.lastResults)) },
          { label: 'World map', cls: 'ghost', fn: () => this.quitToMap() }],
    });
    this.lastResults = UI._lastRes;
    this.state = 'menu';
    Sfx.playMusic(win ? 'victory' : 'map');
  },
  endEndless() {
    const s = S;
    const wave = s.wave;
    const best = wave > (SAVE.endlessBest || 0);
    SAVE.endlessBest = Math.max(SAVE.endlessBest || 0, wave);
    const earned = Math.round(s.quarters * 0.8 + wave * 6);
    SAVE.quarters += earned; SAVE.lifetimeQuarters += earned;
    persist();
    UI.results({
      win: false, title: 'WAVE ' + wave, subtitle: best ? 'NEW BEST!' : `Best: wave ${SAVE.endlessBest}`,
      rows: [['Enemies defeated', s.kills], ['Max combo', s.maxCombo], ['Hero level', s.hero.level], ['Quarters earned', '+' + earned + '¢']],
      tip: pick(TIPS),
      buttons: [{ label: 'Again!', cls: 'gold', fn: () => this.restart() }, { label: 'World map', fn: () => this.quitToMap() }],
    });
    this.state = 'menu';
    Sfx.playMusic('map');
  },
  tryCheat(code) {
    if (!CHEATS[code]) return false;
    Sfx.play('cheat');
    const inRun = S && S.mode !== 'demo' && Game.state === 'play';
    const markCheat = () => { SAVE.stats.cheats++; unlockAch('cheat', true); if (inRun) S.cheated = true; this.cheatedRun = true; };
    let msg = CHEATS[code];
    switch (code) {
      case 'IDDQD': this.cheats.god = !this.cheats.god; if (S) S.god = this.cheats.god; msg += this.cheats.god ? ' ON' : ' OFF'; markCheat(); break;
      case 'IDKFA':
        this.cheats.idkfa = true; markCheat();
        if (inRun) { const hh = S.hero; for (const id of shuffle(BASE_SPELLS.slice())) { if (hh.spells.length >= 3) break; if (!hh.spells.find((s) => s.id === id)) hh.spells.push({ id, lvl: 5, cd: 0 }); } for (const s of hh.spells) { if (s.lvl < 5) s.lvl = 5; hh.cards[s.id] = s.lvl; } this.syncTouch(); }
        break;
      case 'THEREISNOCOWLEVEL': SAVE.secrets.cow = true; unlockAch('cow', true); if (WorldMap.img) WorldMap.render(); msg = 'There is no cow level. (Check the map.)'; break;
      case 'ROSEBUD': SAVE.quarters += 1000; SAVE.lifetimeQuarters += 1000; markCheat(); break;
      case 'HESOYAM': if (inRun) { S.hero.hp = S.hero.maxHp; S.hero.mp = S.hero.maxMp; S.quarters += 250; } else SAVE.quarters += 250; markCheat(); break;
      case 'BIGHEAD': BIGHEAD = !BIGHEAD; msg += BIGHEAD ? ' ON' : ' OFF'; break;
      case 'XYZZY': unlockAch('xyzzy', true); msg = 'Nothing happens.'; break;
      case 'NOCLIP': this.cheats.noclip = !this.cheats.noclip; if (S) S.noclip = this.cheats.noclip; msg += this.cheats.noclip ? ' ON' : ' OFF'; markCheat(); break;
      case 'ALLYOURBASE': this.cheats.unlockAll = true; msg = 'ARE BELONG TO US. All levels unlocked (this session).'; markCheat(); if (WorldMap.open_) WorldMap.select(WorldMap.sel, false); break;
      case 'KLAPAUCIUS': if (inRun) for (let i = 0; i < 40; i++) S.addPickup(new Pickup({ kind: 'xp', value: 4, x: S.hero.x + R(-200, 200), z: R(0, DEPTH), y: 200 })); markCheat(); break;
    }
    persist();
    toast('CHEAT ACTIVATED', code + ': ' + msg, '>', 'cheat');
    if (UI.current === 'scrMap') WorldMap.updateTop();
    return true;
  },
  onResize() {
    clearTimeout(this.rsT);
    this.rsT = setTimeout(() => { if (S && S.bg) S.bg.build(); WorldMap.resize(); }, 200);
  },
};

// ---------------- bot (title demo + automated tests) ----------------
function botControl(h, dt) {
  if (h.dead) return;
  const e = nearestEnemy(h.x, h.z, 3000);
  h.botT = (h.botT || 0) - dt;
  if (h.state === 'attack') { if (e && Math.abs(e.x - h.x) < 90 && Math.abs(e.z - h.z) < 26) h.buffer = 0.3; return; }
  if (h.od >= 100) h.triggerOverdrive();
  if (!h.canAct()) return;
  if (!e) {
    if (S.unlocked) { h.vx = h.speed; h.face = 1; h.state = 'walk'; h.anim = 'walk'; h.walkPhase += dt * 10; }
    else { h.vx = 0; h.vz = 0; h.state = 'idle'; h.anim = 'idle'; }
    return;
  }
  const dx = e.x - h.x, dz = e.z - h.z;
  h.face = sign(dx) || 1;
  // block incoming melee wind-ups
  const threat = S.enemies.find((o) => !o.dead && o.state === 'attack' && o.move && o.stateT < o.move.windup && Math.abs(o.x - h.x) < 130 * o.scale && Math.abs(o.z - h.z) < 34);
  if (threat && Math.random() < 0.85) { h.face = sign(threat.x - h.x) || 1; if (h.state !== 'block') h.setState('block'); h.vx = 0; h.vz = 0; return; }
  if (h.state === 'block') h.setState('idle');
  // cast spells now and then
  if (h.botT <= 0) {
    h.botT = R(0.8, 2);
    const i = RI(0, h.spells.length - 1);
    if (Math.abs(dx) < 420 && castSpell(h, i)) return;
  }
  // sidestep incoming projectiles in our lane
  const shot = S.projs.find((p) => p.team === 'enemy' && Math.abs(p.z - h.z) < 26 && Math.abs(p.x - h.x) < 260 && sign(p.vx) === sign(h.x - p.x));
  if (shot) { h.vz = (h.z > DEPTH / 2 ? -1 : 1) * h.speed * 0.66; h.vx = 0; h.state = 'walk'; h.anim = 'walk'; h.walkPhase += dt * 10; return; }
  // dodge danger zones
  const danger = S.zones.find((z) => z.team === 'enemy' && z.t < z.delay && z.contains(h, 20));
  if (danger) { h.vz = (h.z > danger.z ? 1 : -1) * h.speed * 0.66; h.vx = -sign(dx) * h.speed * 0.5; h.state = 'walk'; h.anim = 'walk'; h.walkPhase += dt * 10; return; }
  if (Math.abs(dx) < 66 * h.stats.reach && Math.abs(dz) < 16) {
    h.comboStep = 0; h.startMove(h.weaponType.combo[0]);
    return;
  }
  const tx = e.x - sign(dx) * 50, sp = h.speed;
  const d = Math.hypot(tx - h.x, dz);
  h.vx = ((tx - h.x) / (d || 1)) * sp; h.vz = (dz / (d || 1)) * sp * 0.66;
  h.state = 'walk'; h.anim = 'walk'; h.walkPhase += dt * 10;
}

// ---------------- main loop ----------------
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  try {
    if (Input.pressed.pause && Game.state === 'play' && S) { if (S.paused) UI.resume(); else if (!S.inDraft && !S.over) UI.pause(); }
    const running = Game.stage && S && !S.paused && !S.inDraft && (Game.state === 'play' || Game.state === 'title');
    if (running) {
      S.update(dt);
      if (S && S.mode === 'typing') Typing.update(dt);
    }
    if (Game.state === 'play') {
      SAVE.stats.playTime += dt;
      // adaptive resolution: if we can't hold ~45 fps for a few seconds, render at a lower pixel ratio
      const P = Game.perf || (Game.perf = { t: 0, n: 0, slow: 0 });
      P.t += dt; P.n++;
      if (P.t >= 3) {
        const avg = P.t / P.n;
        P.slow = avg > 0.022 && !S.paused ? P.slow + 1 : 0;
        P.t = 0; P.n = 0;
        if (P.slow >= 1 && View.dpr > 1) { View.qualityCap = Math.max(1, View.dpr - 0.35); resize(); if (S && S.bg) S.bg.build(); }
      }
    }
    const showGame = Game.stage && S && UI.current !== 'scrMap' && UI.current !== 'scrHeroes' && UI.current !== 'scrSkills' && UI.current !== 'scrTrophies' && UI.current !== 'scrSettings' && UI.current !== 'scrTypingMenu';
    if (showGame) {
      ctx.setTransform(View.scale, 0, 0, View.scale, 0, 0);
      S.draw();
      if (S.mode === 'typing') { Typing.drawWords(); Typing.drawHUD(); }
    }
    if (Game.state === 'play' && S && !S.paused) updateTouchButtons();
  } catch (err) {
    console.error(err);
    if (!Game.errShown) { Game.errShown = true; toast('Oops, a bug!', String(err.message || err).slice(0, 80), '!'); }
  }
  Input.endFrame();
  requestAnimationFrame(frame);
}
let touchSig = '';
function updateTouchButtons() {
  if ($('touch').hidden) return;
  const h = S.hero;
  Game.syncTouch();
  const sig = h.spells.map((s) => Math.round(Math.max(0, s.cd) * 10) + (h.mp >= SPELLS[s.id].cost ? 'y' : 'n')).join() + (h.od >= 100);
  if (sig === touchSig) return;
  touchSig = sig;
  document.querySelectorAll('#touch .tbtn.s').forEach((b, i) => {
    const sp = h.spells[i]; if (!sp) return;
    const d = SPELLS[sp.id];
    const frac = sp.cd > 0 ? sp.cd / (d.cd * h.stats.cdMul) : h.mp < d.cost ? 1 : 0;
    b.querySelector('.cd').style.setProperty('--cd', Math.round(frac * 100) + '%');
  });
  document.querySelector('#touch .tbtn.od').classList.toggle('ready', h.od >= 100);
}

// ---------------- boot ----------------
function boot() {
  loadSave();
  resize();
  Input.setupTouch();
  WorldMap.init();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  $('bPlay').onclick = () => { Sfx.init(); Sfx.play('card'); Game.stopStage(); Game.toMap(); };
  $('bTyping').onclick = () => { Sfx.init(); Sfx.play('card'); Game.stopStage(); Typing.menu(); };
  $('bSkills').onclick = () => { Sfx.init(); Sfx.play('select'); UI.skills(() => UI.title()); };
  $('bTrophies').onclick = () => { Sfx.init(); Sfx.play('select'); UI.trophies(() => UI.title()); };
  $('bSettings').onclick = () => { Sfx.init(); Sfx.play('select'); UI.settings(() => UI.title()); };
  $('mapBack').onclick = () => { Sfx.play('back'); UI.title(); };
  $('mapSkills').onclick = () => { Sfx.play('select'); UI.skills(() => Game.toMap()); };
  $('mapTrophies').onclick = () => { Sfx.play('select'); UI.trophies(() => Game.toMap()); };
  $('mapSettings').onclick = () => { Sfx.play('select'); UI.settings(() => Game.toMap()); };
  $('pauseBtn').onclick = () => UI.pause();
  Cloud.init();
  Input.on('konami', () => {
    if (!SAVE.heroes.glitch) { SAVE.heroes.glitch = true; persist(); toast('+30 LIVES', 'Just kidding. Secret hero GL!TCH unlocked!', '↑'); }
    else toast('+30 LIVES', 'You already know the code.', '↑');
    unlockAch('konami', true); Sfx.play('cheat');
  });
  Input.on('cheat', (buf) => { for (const code in CHEATS) if (buf.endsWith(code)) { Game.tryCheat(code); Input.resetCheat(); break; } });
  // results screen remembers itself so the skill tree can return to it
  const origResults = UI.results.bind(UI);
  UI.results = (res) => { UI._lastRes = res; Game.lastResults = res; origResults(res); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && Game.state === 'play' && S && !S.paused && !S.inDraft && !S.over && S.mode !== 'demo') UI.pause(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { WorldMap.img = null; if (WorldMap.open_) WorldMap.render(); });
  UI.title();
  const press = $('pressStart');
  const wake = () => { Sfx.init(); if (Sfx.current !== 'title' && Game.state === 'title') Sfx.playMusic('title'); press.textContent = 'READY PLAYER ONE?'; };
  window.addEventListener('pointerdown', wake, { once: true });
  window.addEventListener('keydown', wake, { once: true });
  requestAnimationFrame(frame);
  // debugging / automated test hooks
  window.__rv = { Game, UI, SAVE: () => SAVE, S: () => S, LEVELS, Input, WorldMap, Typing, setSave: (s) => { SAVE = mergeSave(defaultSave(), s); } };
  window.__dbg = { drawHUD, Particles, drawFighter, drawProp };
  // dev helper: a pose sheet of every hero and enemy (used by tools/ for visual checks)
  window.__drawSheet = (g) => {
    const poses = [['idle', 0.2], ['walk', 0.3], ['run', 0.3], ['jump', 0.1], ['attack:jab', 0.1], ['attack:upper', 0.14], ['attack:swing', 0.16], ['attack:slam', 0.3], ['attack:thrust', 0.08], ['block', 0.1], ['cast', 0.2], ['hurt', 0.1], ['down', 0.1], ['win', 0.2]];
    const ids = HERO_ORDER.map((id) => ({ look: HEROES[id].look, wt: WEAPON_TYPES[HEROES[id].weapon] }))
      .concat(['goon', 'archer', 'bomber', 'skeleton', 'knight', 'mummy', 'frostimp', 'punk'].map((k) => ({ look: ENEMIES[k].look })));
    ids.forEach((it, row) => {
      poses.forEach(([p, t], col) => {
        const [anim, mv] = p.split(':');
        const f = { anim, animT: t, clock: t, walkPhase: 1.2, vy: 100, move: mv ? MOVES[mv] : null, id: row };
        const look = Object.assign({}, it.look, { _t: t });
        if (it.wt) { look.wpnColor = it.wt.colors[2]; look.wpnGlow = it.wt.glow[2]; look.wpnTier = 3; }
        drawHumanoid(g, 50 + col * 96, 62 + row * 58, 0.5, 1, look, computePose(f), {});
      });
    });
    ['slime', 'bat', 'mushroom', 'golem', 'snowman', 'wraith', 'floppy', 'cow', 'mimic'].forEach((art, i) => {
      g.save(); g.translate(1390 - 40, 70 + i * 92); g.scale(-0.55, 0.55);
      MonsterArt[art](g, { clock: 1, anim: 'idle', animT: 0.2, walkPhase: 1 }, art === 'wraith' ? { body: '#e6ecf5', text: '404' } : art === 'slime' ? { body: '#6fdc5a' } : art === 'golem' ? { rock: '#5a4a4a', core: '#ff7a2f' } : art === 'mushroom' ? { cap: '#e04a5a', stem: '#fff1d6' } : art === 'bat' ? { wing: '#5a3a8a', body: '#3a2a5a' } : art === 'floppy' ? { body: '#2f6bd8' } : { halberd: true }, {}, (c) => c);
      g.restore();
    });
  };
}
(function start() {
  const hot = window.claude && window.claude.hot;
  try { if (hot && hot.snapshot) hot.snapshot(() => ({ save: SAVE })); } catch (e) { /* optional */ }
  const go = (data) => { boot(); if (data && data.save) { SAVE = mergeSave(defaultSave(), data.save); persist(); } };
  if (hot && hot.ready) hot.ready(go); else go((hot && hot.data) || {});
})();
