// ============================================================
//  Keyboard Warrior: typing combat special mode.
//  Pedagogy: accuracy before speed, progressive key sets, adaptive pace,
//  targeted practice of the player's weakest keys.
// ============================================================
const DICT = ('a as ask add ads all also and any are arm art away back bad bag ball band bank base bat be bear beat bed bee been best big bill bird bit black blue boat body bold bone book boss both box boy brave bread brick bring brown bug build burn bus but buy by cab cake call calm came camp can cap car card care case cat cave cell chat chip city clap clay clock cloud club coin cold comb come cook cool copy cow crab crew cup cut dad dark dash data day deal deep desk dial did dig dim dog doll done door down draw drop drum duck dust each ear earth east easy eat echo edge egg else end epic even ever exit eye face fact fade fair fall fan far farm fast fat fear feel few fig file fill film find fire fish fist five fix flag flash flat flip flow fly fog fold food foot fork form fox free frog from fun game gap gas gate gem get gift give glad glass glow go goal gold golf good grab gray green grid grow gum had half hall hand hard has hat have head heal heat help hero hide high hill hint hit hold hole home hook hop horn hot hug huge ice idea inch into iron item jam jar jazz jet job jog join joke joy jump just keep key kick kid kind king kite knee knot lab lady lake lamp land lap last late lava lead leaf left leg lens less lift light like lime line link lion list live load lock log long look loop lost loud love low luck mad made mail main make map mask max maze meal melt menu milk mind mine mix moon more moss move much mud mug name near neck need nest net new next nice night nine nod none note now oak odd off oil old one only open over own pack page paint pal park pass past path paw peak pen pet pick pie pig pink pipe pixel plan play plus poem pole pond pool pop port pot power push quest quick quiet quit race rain ran rare rat raw read real red rest rice rich ride ring road rock roll roof room root rope rose rub rule run rush safe sail salt same sand save saw say sea seed seen sell send set shield ship shop show side sign silk sing sink site size skip sky sled slime slow small snow soap sock soft song soon soup spin spot star step stop sun swim sword tag tail take talk tall tank tap team tell ten tent test than that the then thin this tide time tiny tip toad top town toy tree trip true try tub turn two type unit up use van vase very vest view vine visit voice wait wake walk wall want warm wash wave way weak web week well west wet what when wide wild will win wind wing wise wish with wolf wood word work worm yard yarn year yell yes yet you zap zero zone zoom').split(' ');
const HOME_WORDS = ('a as ad add ads all ash ask dad fad fads fall falls flag flags flask glad glass gash gas had half hall has hash jag lad lads lag lash sad salad salsa sash shall slag slash flash dash gall hag').split(' ');
const RETRO_WORDS = ('floppy modem pixel arcade joystick cartridge sprite bitmap dialup chiptune cheatcode highscore combo respawn savegame walkman pager cdrom mixtape rewind dungeon quest loot powerup gamepad keyboard mouse screensaver desktop browser homepage webring guestbook emoticon chatroom lanparty boss level bonus warp secret continue').split(' ');
const CAP_WORDS = ['Hello!', 'Game Over.', 'Press Start', 'Level Up!', 'Insert Coin', 'Ready?', 'Fight!', 'You Win!', 'Boss Fight!', 'Continue?', 'Player 2', 'Save Game.', 'Round 1', 'Get Ready!', 'Nice Combo!', 'Try Again?', 'High Score!', 'Extra Life!', 'Pause.', 'Good Game!'];
const PHRASES = ['press start to begin', 'save early and save often', 'never skip the tutorial', 'the boss is weak to fire', 'blow on the cartridge', 'one more run before bed', 'all bugs are features', 'the slime ate my homework', 'my combo is unstoppable', 'the princess is fine thanks', 'dial up is still loading', 'insert coin to continue'];
const LESSONS = [
  { id: 't1', name: 'Home Row: Left Hand', keys: 'asdf', words: 20, tip: 'Rest your left fingers on A S D F. Feel the bump on F.' },
  { id: 't2', name: 'Home Row: Right Hand', keys: 'jkl;', words: 20, tip: 'Right fingers on J K L ;. Feel the bump on J.' },
  { id: 't3', name: 'Full Home Row', keys: 'asdfghjkl', words: 22, tip: 'Index fingers stretch to G and H, then snap back home.' },
  { id: 't4', name: 'Top Row', keys: 'qwertyuiopasdfghjkl', words: 24, tip: 'Reach up, then return to the home row after every key.' },
  { id: 't5', name: 'Bottom Row', keys: 'abcdefghijklmnopqrstuvwxyz', focus: 'zxcvbnm', words: 24, tip: 'Curl your fingers down for Z X C V B N M.' },
  { id: 't6', name: 'Common Words', keys: 'abcdefghijklmnopqrstuvwxyz', words: 26, tip: 'Keep your eyes on the screen, not your hands.' },
  { id: 't7', name: 'Retro Lingo', list: RETRO_WORDS, words: 22, tip: 'Words from the golden age of dial-up.' },
  { id: 't8', name: 'Capitals & Punctuation', list: CAP_WORDS, words: 16, tip: 'Use the Shift key on the opposite hand of the letter.' },
  { id: 't9', name: 'Speed Round', list: PHRASES, words: 10, tip: 'Steady rhythm beats bursts. Accuracy still comes first.' },
];

const Typing = {
  lesson: null, active: false,
  menu() {
    Game.state = 'menu';
    Sfx.playMusic('typing');
    const body = $('typingBody');
    body.innerHTML = '';
    body.append(h('div', { class: 'screen-head' },
      h('button', { class: 'btn small ghost', onclick: () => { Sfx.play('back'); Game.toMap(); } }, '◀ Map'),
      h('h2', null, 'Keyboard Warrior Dojo')));
    body.append(h('p', { class: 'muted', style: 'max-width:640px;text-align:center;margin:0' }, 'Every enemy carries a word. Type it to strike. A typo breaks your combo, so accuracy pays more than speed. Enemies slow down when you struggle and speed up as you improve. Your weakest keys show up more often.'));
    const weak = weakKeys(3);
    if (weak.length) body.append(h('div', { class: 'chip' }, 'Keys to practise: ', h('b', null, weak.map((k) => k.toUpperCase()).join('  '))));
    const grid = h('div', { class: 'lesson-grid' });
    LESSONS.forEach((L, i) => {
      const rec = SAVE.typing.lessons[L.id];
      const prev = i === 0 || (SAVE.typing.lessons[LESSONS[i - 1].id] && SAVE.typing.lessons[LESSONS[i - 1].id].acc >= 85);
      const unlocked = prev || Game.cheats.unlockAll;
      const el = h('button', { class: 'lesson' + (rec && rec.acc >= 85 ? ' done' : '') + (unlocked ? '' : ' locked'), onclick: () => {
        if (!unlocked) { Sfx.play('back'); toast('Locked', 'Pass the previous lesson with 85% accuracy', '⌨'); return; }
        Sfx.play('card');
        UI.heroes((hero) => Typing.start(L, hero), 'Choose your warrior', () => Typing.menu());
      } },
      h('div', { class: 'eyebrow' }, `Lesson ${i + 1}`),
      h('div', { style: 'font-weight:600' }, L.name),
      h('div', { class: 'keys' }, L.list ? L.list.slice(0, 3).join(' · ') + '…' : (L.focus || L.keys).split('').join(' ')),
      h('div', { class: 'small muted' }, rec ? `Best: ${rec.wpm} WPM · ${rec.acc}% accuracy · ${'★'.repeat(rec.stars || 0)}` : unlocked ? 'Not tried yet' : '🔒 Locked'));
      grid.append(el);
    });
    body.append(grid);
    body.append(h('div', { class: 'kbd-hint' }, 'On a phone? The on-screen keyboard opens when the lesson starts. Tap the game if it closes.'));
    UI.show('scrTypingMenu');
  },
  start(lesson, heroId) {
    this.lesson = lesson;
    this.words = buildLessonWords(lesson);
    this.idx = 0; this.done = 0; this.target = null; this.pos = 0;
    this.hits = 0; this.misses = 0; this.typedChars = 0; this.typeTime = 0; this.firstKeyT = null;
    this.combo = 0; this.maxCombo = 0; this.comfort = 1; this.spawnT = 1.5; this.missFlash = 0; this.lastKeyT = 0;
    this.keyHit = {}; this.keyMiss = {};
    this.active = true;
    Game.state = 'play';
    const level = { id: 'TYPING', n: 2, name: lesson.name, biome: 'forest', pool: [['goon', 1]], end: 'bigmike', sections: 1 };
    Game.stage = new Stage({ mode: 'typing', level, heroId, onEnd: () => this.finish() });
    S.hero.x = 170; S.arena = [0, VIEW_W]; S.camX = 0;
    S.banners = []; S.banner(lesson.name.toUpperCase(), '#3ee6a8', 1.6, true);
    S.hero.maxHp = 100; S.hero.hp = 100;
    Sfx.playMusic('typing');
    Input.setTyping((e) => this.onKey(e));
    UI.show(null);
    const inp = $('typeInput');
    inp.value = '';
    inp.oninput = () => { const v = inp.value; inp.value = ''; for (const ch of v) this.handleChar(ch); };
    if (matchMedia('(pointer: coarse)').matches) setTimeout(() => inp.focus(), 100);
    this.tapHandler = () => { if (this.active) inp.focus(); };
    canvas.addEventListener('pointerdown', this.tapHandler);
  },
  onKey(e) {
    if (!this.active || !S || S.mode !== 'typing') return false;
    if (e.key === 'Escape') { UI.pause(); return true; }
    if (e.target && e.target.id === 'typeInput') return false; // handled by input event
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return e.key === ' ' ;
    this.handleChar(e.key);
    return true;
  },
  handleChar(ch) {
    if (!this.active || S.paused || S.over) return;
    const now = S.time;
    if (this.firstKeyT == null) this.firstKeyT = now;
    // count active typing time, ignoring long idle gaps
    if (this.lastKeyT) this.typeTime += Math.min(2, now - this.lastKeyT);
    this.lastKeyT = now;
    if (!this.target || this.target.dead) {
      this.target = null;
      const cands = S.enemies.filter((e) => !e.dead && e.word && e.word[0] === ch).sort((a, b) => a.x - b.x);
      if (!cands.length) { if (ch !== ' ') this.miss(ch, null); return; }
      this.target = cands[0]; this.pos = 0;
    }
    const want = this.target.word[this.pos];
    if (ch === want) {
      this.pos++; this.hits++; this.typedChars++;
      this.keyHit[want.toLowerCase()] = (this.keyHit[want.toLowerCase()] || 0) + 1;
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      Sfx.play('typeKey');
      const t = this.target;
      t.flash = 0.05; t.vx = 30;
      spark(t.x - 10, t.z, t.h * 0.6, '#3ee6a8', 3);
      S.hero.anim = 'attack'; S.hero.state = 'idle';
      if (this.pos >= t.word.length) this.complete(t);
    } else {
      this.miss(ch, want);
    }
  },
  miss(ch, want) {
    this.misses++;
    if (want) { const k = want.toLowerCase(); this.keyMiss[k] = (this.keyMiss[k] || 0) + 1; }
    this.combo = 0;
    this.missFlash = 0.25;
    Sfx.play('typeMiss');
    this.comfort = Math.max(0.55, this.comfort - 0.05);
    if (this.target) Floaters.add(this.target.x, scrY(this.target.z, this.target.h + 50), want === ' ' ? 'SPACE' : want ? want : '?', { color: '#ff4f73', size: 18, font: FONT_PIXEL, vy: -30 });
  },
  complete(t) {
    const h = S.hero;
    this.done++;
    SAVE.stats.typedWords++;
    const errors = t.errors0 !== undefined ? this.misses - t.errors0 : 0;
    if (errors === 0) this.comfort = Math.min(1.7, this.comfort + 0.05);
    this.target = null; this.pos = 0;
    // hero strikes: a homing bolt in the hero's element
    const el = SPELLS[h.spells[0].id].el;
    const kind = el === 'fire' ? 'fireball' : el === 'ice' ? 'iceShard' : el === 'earth' ? 'boulder' : 'fireball';
    h.setState('cast'); h.castDur = 0.2; h.castColor = EL[el].c;
    const p = new Projectile({ team: 'hero', owner: h, kind, x: h.x + 30, y: 60, z: h.z, vx: 900, r: 16, dmg: 9999, el, life: 2, pierce: 0, trail: EL[el].c, homing: 20, kx: 300, ky: 300, fall: 100 });
    // the strike only hits its own word's enemy; if it somehow misses, the enemy still falls
    p.target = t; p.only = t; t.marked = true;
    p.onExpire = () => { if (!t.dead) dealDamage(h, t, { dmg: 9999, ignoreInv: true, noKnock: true }); };
    S.addProj(p);
    Sfx.play(el === 'ice' ? 'ice' : el === 'storm' ? 'zap' : 'fire');
    if (this.combo >= 10 && this.combo % 10 === 0) S.banner(`${this.combo} CHAR STREAK!`, '#ffc53d', 1);
  },
  update(dt) {
    if (!this.active) return;
    const h = S.hero;
    if (this.missFlash > 0) this.missFlash -= dt;
    // keep the hero planted at the left
    h.x = lerp(h.x, 170, dt * 5); h.face = 1;
    if (h.state === 'walk' || h.state === 'run') { h.state = 'idle'; h.anim = 'idle'; }
    // spawn enemies with words
    const onField = S.enemies.filter((e) => !e.dead).length;
    this.spawnT -= dt;
    const total = this.words.length;
    if (this.idx < total && this.spawnT <= 0 && onField < 4) {
      const w = this.words[this.idx++];
      const pool = ['goon', 'slime', 'skeleton', 'mushroom', 'bat', 'thug', 'archer', 'punk'];
      const kind = pool[Math.min(pool.length - 1, Math.floor(Math.random() * (2 + LESSONS.indexOf(this.lesson))))];
      const def = ENEMIES[kind];
      const lanes = [30, 80, 130, 175];
      const used = S.enemies.filter((e) => !e.dead).map((e) => e.lane);
      const lane = lanes.findIndex((_, i) => !used.includes(i));
      const e = new Fighter({ team: 'enemy', kind, def, x: S.camX + VIEW_W - 30, z: lanes[Math.max(0, lane)], hp: 1, dmg: 20, speed: def.speed, ai: 'typing', face: -1 });
      e.lane = Math.max(0, lane);
      e.word = w; e.entering = true; e.errors0 = this.misses;
      S.enemies.push(e);
      const lenK = Math.max(1, w.length / 5);
      this.spawnT = (1.5 + lenK * 0.7) / this.comfort;
    }
    if (this.idx >= total && S.enemies.filter((e) => !e.dead).length === 0 && !S.over) {
      S.over = 'win'; S.endTimer = 1.2; this.active = false;
      S.banner('LESSON COMPLETE!', '#ffc53d', 2, true); Sfx.play('win');
    }
  },
  enemyThink(e, dt) {
    if (e.dead || !e.word) return;
    const h = S.hero;
    const L = LESSONS.indexOf(this.lesson);
    // walk time to the hero stays readable: longer words walk a little slower
    const speed = (70 + L * 7) / (1 + e.word.length * 0.06) * this.comfort * (e === this.target ? 0.55 : 1);
    e.vx = -speed; e.vz = 0; e.face = -1;
    if (e.state === 'idle' || e.state === 'walk') { e.state = 'walk'; e.anim = 'walk'; e.walkPhase += dt * 7; }
    if (e.x < h.x + 80 && !e.marked && !e.dead) {
      // reached the hero: hit and run away
      e.startMove(e.def.moves[0]);
      dealDamage(e, h, { dmg: 20, kx: 120, fall: 30, ignoreInv: true });
      e.dead = true; e.setState('dead'); e.vx = 200; e.vy = 200; e.y = 2;
      if (this.target === e) { this.target = null; this.pos = 0; }
      this.comfort = Math.max(0.55, this.comfort - 0.1);
      this.combo = 0;
    }
  },
  drawWords() {
    if (!S || S.mode !== 'typing') return;
    const g = ctx;
    g.textBaseline = 'middle'; g.textAlign = 'left';
    for (const e of S.enemies) {
      if (e.dead || !e.word) continue;
      const x = e.x - S.camX, y = scrY(e.z, e.y + e.h + 26);
      const isT = e === this.target;
      g.font = `${isT ? 20 : 17}px ${FONT_PIXEL}`;
      const w = g.measureText(e.word).width;
      const bx = x - w / 2 - 10;
      g.fillStyle = isT ? 'rgba(20,12,50,.92)' : 'rgba(20,12,50,.78)';
      roundRect(g, bx, y - 15, w + 20, 30, 10); g.fill();
      if (isT) { g.strokeStyle = this.missFlash > 0 ? '#ff4f73' : '#ffc53d'; g.lineWidth = 3; g.stroke(); }
      const typed = isT ? e.word.slice(0, this.pos) : '';
      const rest = isT ? e.word.slice(this.pos) : e.word;
      g.fillStyle = '#ffc53d'; g.fillText(typed, bx + 10, y + 1);
      const tw = g.measureText(typed).width;
      g.fillStyle = '#fff4e2'; g.fillText(rest, bx + 10 + tw, y + 1);
      if (isT && rest.length) {
        // cursor under the next letter
        const cw = g.measureText(rest[0]).width;
        g.fillStyle = Math.floor(S.time * 4) % 2 ? '#ffc53d' : 'transparent';
        g.fillRect(bx + 10 + tw, y + 11, Math.max(8, cw), 3);
      }
    }
  },
  drawHUD() {
    const g = ctx;
    const k = View.hud;
    g.save(); g.scale(k, k);
    const W = VIEW_W / k, Hh = VIEW_H / k;
    const acc = this.hits + this.misses ? Math.round((this.hits / (this.hits + this.misses)) * 100) : 100;
    const wpm = this.typeTime > 1 ? Math.round((this.typedChars / 5) / (this.typeTime / 60)) : 0;
    g.fillStyle = 'rgba(10,6,28,.8)'; roundRect(g, W / 2 - 230, Hh - 70, 460, 56, 14); g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const cols = [['WPM', wpm, '#55c8ff'], ['ACCURACY', acc + '%', acc >= 95 ? '#3ee6a8' : acc >= 85 ? '#ffc53d' : '#ff4f73'], ['STREAK', this.combo, '#ffc53d'], ['WORDS', `${this.done}/${this.words.length}`, '#fff4e2']];
    cols.forEach(([l, v, c], i) => {
      const x = W / 2 - 172 + i * 115;
      g.fillStyle = '#b9acdf'; g.font = `9px ${FONT_PIXEL}`; g.fillText(l, x, Hh - 56);
      g.fillStyle = c; g.font = `20px ${FONT_DISPLAY}`; g.fillText(v, x, Hh - 34);
    });
    g.fillStyle = '#b9acdf'; g.font = `11px ${FONT_BODY}`; g.fillText(this.lesson.tip, W / 2, Hh - 84);
    if (this.missFlash > 0) { g.fillStyle = `rgba(255,79,115,${this.missFlash})`; g.fillRect(0, 0, W, 6); }
    g.restore();
  },
  finish() {
    Input.setTyping(null);
    canvas.removeEventListener('pointerdown', this.tapHandler);
    $('typeInput').blur();
    this.active = false;
    const win = S.over === 'win';
    const acc = this.hits + this.misses ? Math.round((this.hits / (this.hits + this.misses)) * 100) : 0;
    const wpm = this.typeTime > 1 ? Math.round((this.typedChars / 5) / (this.typeTime / 60)) : 0;
    // merge key stats into the long-term profile
    for (const k in this.keyHit) SAVE.typing.keyHit[k] = (SAVE.typing.keyHit[k] || 0) + this.keyHit[k];
    for (const k in this.keyMiss) SAVE.typing.keyMiss[k] = (SAVE.typing.keyMiss[k] || 0) + this.keyMiss[k];
    const stars = [win, win && acc >= 95, win && wpm >= 20 + LESSONS.indexOf(this.lesson) * 2];
    const nStars = stars.filter(Boolean).length;
    const rec = SAVE.typing.lessons[this.lesson.id] || { wpm: 0, acc: 0, stars: 0 };
    if (win) { rec.wpm = Math.max(rec.wpm, wpm); rec.acc = Math.max(rec.acc, acc); rec.stars = Math.max(rec.stars, nStars); SAVE.typing.lessons[this.lesson.id] = rec; }
    SAVE.typing.bestWpm = Math.max(SAVE.typing.bestWpm || 0, win ? wpm : 0);
    const q = win ? Math.round(10 + this.done * 2 * (acc / 100)) : Math.round(this.done);
    SAVE.quarters += q; SAVE.lifetimeQuarters += q;
    if (win && wpm >= 30) unlockAch('wpm30');
    if (win && acc >= 98) unlockAch('acc98');
    persist();
    const weakNow = Object.keys(this.keyMiss).sort((a, b) => this.keyMiss[b] - this.keyMiss[a]).slice(0, 3);
    const idx = LESSONS.indexOf(this.lesson);
    const next = LESSONS[idx + 1];
    UI.results({
      win, title: win ? 'LESSON COMPLETE' : 'OUT OF HEARTS', subtitle: this.lesson.name,
      stars, starLabels: ['Finish the lesson', '95% accuracy', `${20 + idx * 2}+ WPM`],
      rows: [['Words per minute', wpm], ['Accuracy', acc + '%'], ['Longest streak', this.maxCombo + ' keys'], ['Words typed', `${this.done}/${this.words.length}`], ['Keys to practise', weakNow.length ? weakNow.map((k) => (k === ' ' ? 'space' : k.toUpperCase())).join(' ') : 'none!'], ['Quarters earned', '+' + q + '¢']],
      unlocks: win && acc >= 85 && next && !(rec.acc >= 85 && rec.prevUnlocked) ? ['Next lesson: ' + next.name] : [],
      tip: acc < 90 ? 'Slow down a little. Accuracy first, speed follows on its own.' : wpm < 20 ? 'Great accuracy! Now try to keep a steady rhythm.' : 'Excellent. Take a short break, then try the next lesson. Short, spaced sessions train best.',
      buttons: [
        { label: 'Retry', fn: () => { Game.stopStage(); UI.heroes((hero) => Typing.start(this.lesson, hero), 'Choose your warrior', () => Typing.menu()); } },
        win && next && acc >= 85 ? { label: 'Next lesson', cls: 'gold', fn: () => { Game.stopStage(); UI.heroes((hero) => Typing.start(next, hero), 'Choose your warrior', () => Typing.menu()); } } : null,
        { label: 'Dojo', cls: 'ghost', fn: () => { Game.stopStage(); Typing.menu(); } },
      ].filter(Boolean),
    });
    Game.state = 'menu';
  },
};
function weakKeys(n) {
  const hit = SAVE.typing.keyHit, miss = SAVE.typing.keyMiss;
  return Object.keys(miss).filter((k) => /[a-z]/.test(k) && miss[k] >= 2).sort((a, b) => miss[b] / ((hit[b] || 0) + miss[b]) - miss[a] / ((hit[a] || 0) + miss[a])).slice(0, n);
}
function buildLessonWords(L) {
  const n = L.words;
  if (L.list) return shuffle(L.list.slice()).concat(shuffle(L.list.slice())).slice(0, n);
  const allowed = new Set(L.keys.split(''));
  let pool = (L.keys === 'asdfghjkl' || L.keys === 'asdf' ? HOME_WORDS.concat(DICT) : DICT).filter((w) => w.split('').every((c) => allowed.has(c)));
  if (L.focus) pool = pool.filter((w) => w.split('').some((c) => L.focus.includes(c)));
  // pseudo-word drills when the real vocabulary is thin (e.g. right-hand home row)
  const keys = L.keys.split('');
  while (pool.length < 12) {
    const len = RI(2, 4);
    let w = '';
    for (let i = 0; i < len; i++) w += pick(keys);
    pool.push(w);
  }
  // weight towards the player's weakest keys
  const weak = weakKeys(3);
  const out = [];
  for (let i = 0; i < n; i++) {
    const w = weightedPick(pool, (x) => 1 + weak.filter((k) => x.includes(k)).length * 2 + (x.length > 6 && i < n / 3 ? -0.5 : 0));
    out.push(w);
  }
  return out;
}
