// ============================================================
//  UI: DOM screens (title, heroes, drafts, skill tree, results, settings…)
// ============================================================
const SCREENS = ['scrTitle', 'scrMap', 'scrHeroes', 'scrSkills', 'scrTrophies', 'scrSettings', 'scrTypingMenu', 'scrDraft', 'scrPause', 'scrResults'];
const UI = {
  current: null,
  backStack: [],
  show(id) {
    for (const s of SCREENS) $(s).hidden = s !== id;
    this.current = id;
    const playing = !id || id === 'scrDraft' || id === 'scrPause';
    const inPlay = Game.state === 'play' && playing;
    $('pauseBtn').hidden = !(Game.state === 'play' && !id);
    const touchOn = inPlay && !id && useTouchControls();
    $('touch').hidden = !touchOn;
    if (id === 'scrMap') WorldMap.open(); else WorldMap.close();
    const scr = id && $(id);
    if (scr) { const f = scr.querySelector('button.btn:not([disabled]), .card, .snode'); if (f && !Input.touch) setTimeout(() => f.focus({ preventScroll: true }), 30); }
  },
  hideAll() { this.show(null); },

  // ---------------- title ----------------
  title() {
    Game.state = 'title';
    Game.startDemo();
    this.show('scrTitle');
    Sfx.playMusic('title');
    $('bTyping').disabled = false;
  },

  // ---------------- hero select ----------------
  heroes(onPick, title = 'Choose your fighter', back) {
    const body = $('heroesBody');
    body.innerHTML = '';
    const goBack = back || (() => { Game.stopStage(); Game.toMap(); });
    body.append(h('div', { class: 'screen-head' },
      h('button', { class: 'btn small ghost', onclick: () => { Sfx.play('back'); cancelAnimationFrame(raf); goBack(); } }, back ? '◀ Back' : '◀ Map'),
      h('h2', null, title)));
    const grid = h('div', { class: 'hero-grid' });
    const anims = [];
    let sel = SAVE.hero && SAVE.heroes[SAVE.hero] ? SAVE.hero : 'rook';
    const cards = {};
    for (const id of HERO_ORDER) {
      const d = HEROES[id];
      const unlocked = !!SAVE.heroes[id];
      if (id === 'glitch' && !unlocked) continue;
      const cv = h('canvas', { width: 240, height: 260 });
      anims.push({ cv, id });
      const stats = h('div', { class: 'statbars' }, ...['pow', 'def', 'spd', 'mag'].map((k) => h('div', { class: 'statbar' }, k.toUpperCase(), h('span', null, h('i', { style: `width:${d.ui[k] * 20}%` })))));
      const card = h('button', { class: 'hero-card' + (unlocked ? '' : ' locked') + (id === sel ? ' sel' : ''), 'aria-label': d.name, onclick: () => {
        if (!unlocked) { Sfx.play('back'); toast('Locked', d.unlock ? d.unlock.text : 'Keep playing', 'lock'); return; }
        Sfx.play('select');
        if (sel === id) { go(); return; }
        sel = id; for (const k in cards) cards[k].classList.toggle('sel', k === id);
      } },
      cv, h('h3', null, d.name), h('div', { class: 'role' }, d.role), stats,
      h('div', { class: 'small muted', style: 'margin-top:4px' }, d.blurb),
      h('div', { class: 'small', style: 'margin-top:4px;color:var(--gold)' }, '★ ' + INNATE[id].name, h('div', { class: 'muted', style: 'color:#e2d9ff' }, INNATE[id].desc)),
      !unlocked ? h('div', { class: 'lock' }, '🔒 ' + (d.unlock ? d.unlock.text : '')) : null);
      cards[id] = card;
      grid.append(card);
    }
    body.append(grid);
    const go = () => { cancelAnimationFrame(raf); SAVE.hero = sel; persist(); Sfx.play('card'); onPick(sel); };
    body.append(h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: go }, 'Fight!')));
    this.show('scrHeroes');
    let raf = 0, t0 = performance.now();
    const loop = (now) => {
      if (UI.current !== 'scrHeroes') return;
      const t = (now - t0) / 1000;
      for (const a of anims) {
        const g = a.cv.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, 240, 260);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(120, 236, 50, 12, 0, 0, TAU); g.fill();
        const d = HEROES[a.id];
        const look = Object.assign({}, d.look, { _t: t, _blink: (t * 0.7 + a.id.length) % 3 < 0.1 });
        const wt = WEAPON_TYPES[d.weapon];
        look.wpnColor = wt.colors[0]; look.wpnGlow = wt.glow[0]; look.wpnTier = 1;
        if (d.weapon === 'gauntlets') look.gloves = wt.colors[0];
        const f = { anim: a.id === sel ? 'win' : 'idle', animT: t, clock: t, id: a.id.length };
        const pose = computePose(f);
        drawHumanoid(g, 120, 234, 1.7, 1, look, pose, {});
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  },

  // ---------------- draft ----------------
  openDraft(cards, chest, cb) {
    const body = $('draftBody');
    body.innerHTML = '';
    const hero = S.hero;
    const rerolls = S.rerolls ?? (S.rerolls = skillRank('f3'));
    const warm = !chest && S.warmup > 0;
    body.append(h('div', { class: 'draft-title' }, chest ? 'TREASURE!' : warm ? 'WARM-UP KIT' : 'LEVEL UP!'));
    body.append(h('div', { class: 'eyebrow' }, chest ? 'Pick one reward' : warm ? `Tougher land, stronger start · ${S.warmup} free pick${S.warmup > 1 ? 's' : ''} left` : `Level ${hero.level - S.pendingLevels + 1} · pick one upgrade`));
    const wrap = h('div', { class: 'cards', style: `--n:${cards.length}` });
    let chosen = false;
    const choose = (card) => {
      if (chosen) return; chosen = true;
      document.removeEventListener('keydown', onKey, true);
      Sfx.play('card');
      UI.hideAll(); UI.show(null);
      cb(card);
    };
    cards.forEach((card, i) => {
      const info = cardInfo(card);
      const el = h('button', { class: 'card ' + card.rarity, style: `animation-delay:${i * 0.08}s`, onclick: () => choose(card) },
        h('span', { class: 'key' }, String(i + 1)),
        iconCanvas(info.icon, card.glitched ? '#ff3df2' : info.color, 72),
        h('div', { class: 'txt' },
          h('div', { class: 'rar' }, card.glitched ? '??? GLITCHED ???' : RARITY[card.rarity].name + ' · ' + info.tag),
          h('div', { class: 'nm' }, card.glitched ? info.name.split('').map((c) => (Math.random() < 0.3 ? '#' : c)).join('') : info.name),
          info.lvl ? h('div', { class: 'lv' }, info.lvl === 1 ? 'NEW' : `Lv ${info.lvl - 1} → ${info.lvl}`) : null,
          h('div', { class: 'ds' }, card.glitched ? 'Rolls a random upgrade. Could be anything!' : info.desc)));
      wrap.append(el);
    });
    body.append(wrap);
    const row = h('div', { class: 'row' });
    if (rerolls > 0) row.append(h('button', { class: 'btn small', onclick: () => { S.rerolls--; Sfx.play('select'); document.removeEventListener('keydown', onKey, true); UI.openDraft(makeDraft(hero, chest), chest, cb); } }, `Reroll (${rerolls})`));
    row.append(h('button', { class: 'btn small ghost', onclick: () => { choose({ id: 'quarters', kind: 'filler', rarity: 'common' }); } }, 'Skip (+25¢)'));
    body.append(row);
    // current build summary
    const build = h('div', { class: 'row small muted' });
    const parts = hero.spells.map((s) => `${SPELLS[s.id].name}${s.lvl <= 5 ? ' ' + s.lvl : ''}`);
    for (const k in hero.cards) if (PASSIVES[k]) parts.push(`${PASSIVES[k].name} ${hero.cards[k]}`);
    parts.push(`${hero.weaponType.names[hero.wpnTier - 1]} (Lv ${hero.wpnLevel})`);
    build.textContent = 'Build: ' + parts.join(' · ');
    body.append(build);
    const onKey = (e) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= cards.length) { e.preventDefault(); e.stopPropagation(); choose(cards[n - 1]); }
    };
    document.addEventListener('keydown', onKey, true);
    Sfx.play('levelup');
    this.show('scrDraft');
    $('touch').hidden = true;
  },

  // ---------------- merchant shop ----------------
  shop() {
    if (!S || S.over) return;
    S.paused = true;
    const s = S;
    const m = s.merchant;
    const render = () => {
      const body = $('draftBody');
      body.innerHTML = '';
      body.append(h('div', { class: 'draft-title' }, "PIP'S WARES"));
      body.append(h('div', { class: 'eyebrow' }, MERCHANT_LINES[m.line++ % MERCHANT_LINES.length]));
      body.append(h('span', { class: 'chip' }, h('i', { class: 'coin' }), h('b', null, fmt(s.quarters) + ' quarters this run')));
      const wrap = h('div', { class: 'cards', style: '--n:4' });
      for (const o of shopOffers(s)) {
        const sold = m.sold[o.id];
        const can = !sold && s.quarters >= o.cost && (!o.ok || o.ok());
        wrap.append(h('button', { class: 'card ' + (o.id === 'card' ? 'epic' : 'rare'), disabled: !can, style: can ? '' : 'filter:grayscale(.8) brightness(.7)', onclick: () => {
          if (!can) { Sfx.play('back'); return; }
          s.quarters -= o.cost; m.sold[o.id] = true; o.buy(); unlockAch('shopper');
          Sfx.play('coin'); Sfx.play('heal');
          render();
        } },
        iconCanvas(o.icon, o.color, 72),
        h('div', { class: 'txt' },
          h('div', { class: 'rar' }, sold ? 'SOLD OUT' : 'FOR SALE'),
          h('div', { class: 'nm' }, o.name),
          h('div', { class: 'lv' }, sold ? '—' : o.cost + '¢'),
          h('div', { class: 'ds' }, o.desc))));
      }
      body.append(wrap);
      body.append(h('div', { class: 'small muted', style: 'max-width:520px;text-align:center' }, 'Quarters you spend here are not banked for the skill tree. Choose wisely!'));
      body.append(h('div', { class: 'row' }, h('button', { class: 'btn gold', onclick: () => { Sfx.play('select'); s.paused = false; Input.clearAll(); UI.show(null); } }, 'Leave shop')));
      UI.show('scrDraft');
      $('touch').hidden = true;
    };
    Sfx.play('coin');
    render();
  },

  // ---------------- pause ----------------
  pause() {
    if (Game.state !== 'play' || !S || S.over || S.inDraft) return;
    S.paused = true;
    Sfx.play('back');
    const body = $('pauseBody');
    body.innerHTML = '';
    body.append(h('h2', { class: 'h-display', style: 'font-size:44px' }, 'PAUSED'));
    const hero = S.hero;
    const list = h('div', { class: 'panel', style: 'max-width:520px' });
    list.append(h('div', { class: 'eyebrow' }, `${hero.hdef.name} · Level ${hero.level} · ${hero.weaponType.names[hero.wpnTier - 1]}`));
    const chips = h('div', { class: 'row', style: 'justify-content:flex-start;margin-top:8px' });
    for (const s of hero.spells) chips.append(h('span', { class: 'chip' }, iconSmall(SPELLS[s.id].icon, EL[SPELLS[s.id].el].c), `${SPELLS[s.id].name} ${s.lvl > 5 ? '★' : 'Lv' + s.lvl}`));
    for (const k in hero.cards) if (PASSIVES[k]) chips.append(h('span', { class: 'chip' }, iconSmall(PASSIVES[k].icon, '#ffc53d'), `${PASSIVES[k].name} ${hero.cards[k]}`));
    for (const k in hero.cards) if (DUOS[k]) chips.append(h('span', { class: 'chip' }, iconSmall(DUOS[k].icon, '#b77cff'), DUOS[k].name));
    list.append(chips);
    body.append(list);
    body.append(h('div', { class: 'row' },
      h('button', { class: 'btn gold', onclick: () => UI.resume() }, 'Resume'),
      S.mode === 'level' || S.mode === 'cow' ? h('button', { class: 'btn', onclick: () => { Game.restart(); } }, 'Restart') : null,
      h('button', { class: 'btn hot', onclick: () => { Game.quitToMap(); } }, 'Quit to map')));
    body.append(controlsTable());
    body.append(h('div', { class: 'row' },
      toggleRow('Music', SAVE.settings.music > 0, (v) => { SAVE.settings.music = v ? 0.5 : 0; Sfx.applyVolumes(); persist(); }),
      toggleRow('Sound', SAVE.settings.sfx > 0, (v) => { SAVE.settings.sfx = v ? 0.8 : 0; Sfx.applyVolumes(); persist(); }),
      toggleRow('Shake', SAVE.settings.shake, (v) => { SAVE.settings.shake = v; persist(); })));
    this.show('scrPause');
  },
  resume() { if (!S) return; S.paused = false; Input.clearAll(); Sfx.play('select'); this.show(null); },

  // ---------------- results ----------------
  results(res) {
    const body = $('resultsBody');
    body.innerHTML = '';
    const win = res.win;
    body.append(h('h2', { class: 'h-display', style: `font-size:clamp(34px,8vw,60px);color:${win ? 'var(--gold)' : 'var(--hot)'};text-shadow:0 5px 0 #1a0f2e` }, res.title));
    if (res.subtitle) body.append(h('div', { class: 'eyebrow' }, res.subtitle));
    if (res.stars) {
      const st = h('div', { class: 'big-stars' });
      for (let i = 0; i < 3; i++) st.append(h('i', { class: 's' + (res.stars[i] ? ' on' : '') }));
      body.append(st);
      body.append(h('div', { class: 'row small muted' }, ...res.starLabels.map((l, i) => h('span', { style: `color:${res.stars[i] ? 'var(--gold)' : 'var(--muted)'}` }, (res.stars[i] ? '★ ' : '☆ ') + l))));
    }
    const tbl = h('div', { class: 'stat-table' });
    for (const [k, v] of res.rows) tbl.append(h('span', null, k), h('span', null, v));
    body.append(h('div', { class: 'panel', style: 'display:flex;justify-content:center;max-width:420px' }, tbl));
    if (res.unlocks && res.unlocks.length) body.append(h('div', { class: 'panel', style: 'max-width:420px;text-align:center;border-color:var(--gold)' }, h('div', { class: 'eyebrow' }, 'Unlocked'), ...res.unlocks.map((u) => h('div', { style: 'font-weight:600;margin-top:4px' }, u))));
    if (!win) body.append(h('div', { class: 'press-start' }, 'INSERT COIN TO CONTINUE'));
    const row = h('div', { class: 'row' });
    for (const b of res.buttons) row.append(h('button', { class: 'btn ' + (b.cls || ''), onclick: b.fn }, b.label));
    body.append(row);
    if (res.tip) body.append(h('div', { class: 'small muted', style: 'max-width:480px;text-align:center' }, 'Tip: ' + res.tip));
    this.show('scrResults');
  },

  // ---------------- skill tree ----------------
  skills(back) {
    const body = $('skillsBody');
    const render = () => {
      body.innerHTML = '';
      const spent = SKILLS.reduce((a, s) => a + skillRank(s.id), 0);
      body.append(h('div', { class: 'screen-head' },
        h('button', { class: 'btn small ghost', onclick: () => { Sfx.play('back'); back(); } }, '◀ Back'),
        h('h2', null, 'Skill Tree'),
        h('span', { class: 'chip' }, h('i', { class: 'coin' }), h('b', null, fmt(SAVE.quarters)))));
      body.append(h('div', { class: 'small muted', style: 'align-self:flex-start' }, `Spend quarters on permanent upgrades. Ranks bought: ${spent}. Each branch unlocks top to bottom.`));
      const tree = h('div', { class: 'tree' });
      for (const br of BRANCHES) {
        const col = h('div', { class: 'branch', style: `border-color:${br.color}55` }, h('h3', { style: `color:${br.color}` }, br.name), h('div', { class: 'blurb' }, br.blurb));
        const nodes = SKILLS.filter((s) => s.br === br.id);
        nodes.forEach((s, i) => {
          const r = skillRank(s.id);
          const prevOk = i === 0 || skillRank(nodes[i - 1].id) > 0;
          const maxed = r >= s.max;
          const cost = maxed ? 0 : s.cost(r);
          const can = prevOk && !maxed && SAVE.quarters >= cost;
          const node = h('button', { class: 'snode' + (maxed ? ' maxed' : '') + (!prevOk ? ' locked' : '') + (can ? ' can' : ''), 'aria-label': s.name, onclick: () => {
            if (!prevOk) { Sfx.play('back'); toast('Locked', `Buy ${nodes[i - 1].name} first`, 'lock'); return; }
            if (maxed) return;
            if (SAVE.quarters < cost) { Sfx.play('back'); toast('Not enough quarters', `Need ${fmt(cost)}¢`, '¢'); return; }
            SAVE.quarters -= cost; SAVE.skills[s.id] = r + 1; persist();
            Sfx.play('levelup');
            if (SKILLS.reduce((a, q) => a + skillRank(q.id), 0) >= 10) unlockAch('skill10');
            render();
          } },
          iconCanvas(s.icon, br.color, 40),
          h('div', null,
            h('div', { class: 'nm' }, s.name),
            h('div', { class: 'ds' }, s.desc(Math.max(1, r + (maxed ? 0 : 1)))),
            h('div', { class: 'rk' }, `${r}/${s.max}`, maxed ? 'MAX' : h('span', null, h('i', { class: 'coin', style: 'display:inline-block;width:10px;height:10px;vertical-align:-1px' }), ' ' + fmt(cost)))));
          col.append(node);
        });
        tree.append(col);
      }
      body.append(tree);
    };
    render();
    this.show('scrSkills');
  },

  // ---------------- trophies ----------------
  trophies(back) {
    const body = $('trophiesBody');
    body.innerHTML = '';
    const got = ACH.filter((a) => SAVE.ach[a.id]).length;
    body.append(h('div', { class: 'screen-head' },
      h('button', { class: 'btn small ghost', onclick: () => { Sfx.play('back'); back(); } }, '◀ Back'),
      h('h2', null, 'Trophies'), h('span', { class: 'chip' }, `${got}/${ACH.length}`)));
    const grid = h('div', { class: 'ach-grid' });
    for (const a of ACH) {
      const g = !!SAVE.ach[a.id];
      const secret = !g && ['konami', 'cow', 'xyzzy', 'ufo', 'cheat'].includes(a.id);
      grid.append(h('div', { class: 'ach' + (g ? ' got' : '') }, h('div', { class: 'medal' }, g ? '★' : '?'), h('div', null, h('div', { class: 'nm' }, secret ? '???' : a.name), h('div', { class: 'ds' }, secret ? 'A secret from the old days.' : a.desc))));
    }
    body.append(grid);
    const st = SAVE.stats;
    const rows = [['Enemies defeated', fmt(st.kills)], ['Bosses defeated', fmt(st.bossKills)], ['Levels cleared', fmt(st.wins)], ['Runs started', fmt(st.runs)], ['Knock-outs', fmt(st.deaths)], ['Best combo', fmt(st.maxCombo)], ['Critical hits', fmt(st.crits)], ['Spells cast', fmt(st.spells)], ['Frozen foes shattered', fmt(st.shatters)], ['Milk consumed', fmt(st.milk)], ['XP gems collected', fmt(st.gems)], ['Lifetime quarters', fmt(SAVE.lifetimeQuarters)], ['Endless best wave', fmt(SAVE.endlessBest)], ['Best typing speed', (SAVE.typing.bestWpm || 0) + ' WPM'], ['Time played', Math.floor(st.playTime / 60) + ' min']];
    const tbl = h('div', { class: 'stat-table', style: 'width:min(100%,520px)' });
    for (const [k, v] of rows) tbl.append(h('span', null, k), h('span', null, v));
    body.append(h('div', { class: 'panel', style: 'display:flex;justify-content:center' }, tbl));
    this.show('scrTrophies');
  },

  // ---------------- settings ----------------
  settings(back) {
    const body = $('settingsBody');
    body.innerHTML = '';
    body.append(h('div', { class: 'screen-head' }, h('button', { class: 'btn small ghost', onclick: () => { Sfx.play('back'); back(); } }, '◀ Back'), h('h2', null, 'Settings')));
    const list = h('div', { class: 'set-list' });
    const range = (label, id, key) => h('div', { class: 'set-row' }, h('label', { for: id }, label), h('input', { type: 'range', id, min: 0, max: 1, step: 0.05, value: SAVE.settings[key], oninput: (e) => { SAVE.settings[key] = +e.target.value; Sfx.applyVolumes(); persist(); } }));
    list.append(range('Music volume', 'setMusic', 'music'), range('Sound volume', 'setSfx', 'sfx'));
    const tog = (label, id, key) => h('div', { class: 'set-row' }, h('label', { for: id }, label), h('input', { type: 'checkbox', class: 'toggle', id, checked: SAVE.settings[key], onchange: (e) => { SAVE.settings[key] = e.target.checked; persist(); } }));
    list.append(tog('Screen shake', 'setShake', 'shake'), tog('Damage numbers', 'setDmg', 'dmgNums'), tog('Tutorial hints', 'setHints', 'hints'));
    const sel = h('select', { id: 'setTouch', style: 'font:inherit;padding:6px 10px;border-radius:8px;background:#120d26;color:var(--text);border:2px solid var(--line)', onchange: (e) => { SAVE.settings.touch = e.target.value; persist(); } },
      ...['auto', 'on', 'off'].map((v) => h('option', { value: v, selected: SAVE.settings.touch === v }, v === 'auto' ? 'Automatic' : v === 'on' ? 'Always on' : 'Off')));
    list.append(h('div', { class: 'set-row' }, h('label', { for: 'setTouch' }, 'Touch controls'), sel));
    // cheats
    const cheatIn = h('input', { type: 'text', id: 'cheatInput', placeholder: 'Type a code from the old days…', autocomplete: 'off', spellcheck: 'false' });
    list.append(h('div', { class: 'set-row' }, h('label', { for: 'cheatInput' }, 'Cheat terminal'), h('div', { class: 'row', style: 'flex:1;min-width:220px;flex-wrap:nowrap' }, cheatIn, h('button', { class: 'btn small', onclick: () => { if (!Game.tryCheat(cheatIn.value.toUpperCase().replace(/[^A-Z]/g, ''))) toast('Unknown code', 'Nothing happens… or does it?', '?'); cheatIn.value = ''; } }, 'Enter'))));
    // password save
    const pw = h('textarea', { id: 'pwBox', readonly: true, rows: 3 });
    pw.value = exportPassword();
    const copyBtn = h('button', { class: 'btn small', onclick: () => {
      pw.select();
      navigator.clipboard?.writeText(pw.value).then(() => toast('Copied', 'Password copied to clipboard', '✓'), () => toast('Select & copy', 'Copy the highlighted password manually', '!'));
    } }, 'Copy password');
    const pwIn = h('textarea', { id: 'pwIn', rows: 2, placeholder: 'Paste a password (RV1-…) to restore progress' });
    list.append(h('div', { class: 'set-row', style: 'flex-direction:column;align-items:stretch' },
      h('label', { for: 'pwBox' }, 'Password save (NES style). Copy this code to move your progress to another device.'), pw, h('div', { class: 'row', style: 'justify-content:flex-start' }, copyBtn),
      pwIn, h('div', { class: 'row', style: 'justify-content:flex-start' }, h('button', { class: 'btn small mint', onclick: () => { if (importPassword(pwIn.value)) { toast('Password accepted', 'Progress restored', '✓'); Sfx.play('levelup'); UI.settings(back); } else { toast('Invalid password', 'Check the code and try again', '!'); Sfx.play('back'); } } }, 'Load password'))));
    // reset (two-step, in page)
    const resetBtn = h('button', { class: 'btn small hot', onclick: () => {
      if (resetBtn.dataset.armed) { SAVE = defaultSave(); persist(); toast('Save erased', 'A fresh start', '!'); UI.settings(back); return; }
      resetBtn.dataset.armed = '1'; resetBtn.textContent = 'Tap again to erase everything';
    } }, 'Erase save data');
    list.append(h('div', { class: 'set-row' }, h('span', null, 'Danger zone'), resetBtn));
    body.append(list);
    body.append(controlsTable());
    this.show('scrSettings');
  },
};
function iconSmall(id, color) { const c = iconCanvas(id, color, 22); c.style.cssText = 'width:22px;height:22px'; return c; }
function toggleRow(label, on, fn) {
  const id = 'tg' + label;
  return h('label', { class: 'chip', for: id, style: 'padding:6px 12px;gap:8px;cursor:pointer' }, h('input', { type: 'checkbox', class: 'toggle', id, checked: on, onchange: (e) => fn(e.target.checked) }), label);
}
function controlsTable() {
  const t = h('div', { class: 'panel', style: 'max-width:560px' });
  t.append(h('div', { class: 'eyebrow', style: 'margin-bottom:8px' }, 'Controls'));
  const g = h('div', { class: 'controls-table' });
  const rows = [
    [['W', 'A', 'S', 'D'], 'Move (or arrow keys). Double-tap left/right to run.'],
    [['J'], 'Attack. Keep pressing for a 3-hit combo. Pick up barrels & crates when standing still.'],
    [['K'], 'Jump. Attack in the air for a flying kick.'],
    [['L'], 'Defend. Blocks attacks from the front.'],
    [['L', '→', 'J'], 'Spell 1 (D→A). Also D↑A = spell 2, D↓A = spell 3.'],
    [['U', 'I', 'O'], 'Spells 1/2/3 directly.'],
    [['Space'], 'Overdrive when the gold meter is full.'],
    [['Esc'], 'Pause.'],
  ];
  for (const [keys, d] of rows) g.append(h('span', null, ...keys.map((k) => h('kbd', null, k))), h('span', { class: 'small' }, d));
  t.append(g);
  t.append(h('div', { class: 'small muted', style: 'margin-top:8px' }, 'Touch: left side of the screen is a floating stick (push fully to run). Buttons: A attack · J jump · D defend · spell buttons · ★ overdrive.'));
  return t;
}
function useTouchControls() {
  const s = SAVE.settings.touch;
  if (s === 'on') return true;
  if (s === 'off') return false;
  return Input.touch || matchMedia('(pointer: coarse)').matches;
}

// ---------------- toasts & achievements ----------------
function toast(t1, t2, ico = '★', cls = '') {
  const box = $('toasts');
  while (box.children.length >= 3) box.firstChild.remove();
  const el = h('div', { class: 'toast ' + cls }, h('div', { class: 'ico' }, ico), h('div', null, h('div', { class: 't1' }, t1), h('div', { class: 't2' }, t2)));
  box.append(el);
  setTimeout(() => el.remove(), 4200);
}
function unlockAch(id) {
  if (SAVE.ach[id] || (S && S.mode === 'demo')) return;
  const a = ACH.find((x) => x.id === id);
  if (!a) return;
  SAVE.ach[id] = Date.now();
  persist();
  toast('Achievement unlocked · 50G', a.name, '🏆');
  Sfx.play('coin');
}
