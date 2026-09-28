// Functional flow tests: typing mode, endless, cow level, unlocks, cheats, password, results navigation.
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.SHOTS || join(root, 'shots');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + ' | ' + (e.stack || '').split('\n')[1]));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT')) errors.push('console: ' + m.text()); });
await page.goto('file://' + join(root, 'index.html'));
await page.waitForTimeout(600);
const log = (...a) => console.log(...a);
const check = (name, ok, extra = '') => log((ok ? 'PASS ' : 'FAIL ') + name, extra);

// 1) typing mode: start lesson 1, type every word with a couple of typos
await page.evaluate(() => window.__rv.Typing.menu());
await page.waitForTimeout(200);
check('dojo menu visible', await page.isVisible('#scrTypingMenu'));
await page.click('#typingBody .lesson');
await page.waitForTimeout(200);
await page.click('#heroesBody .btn.gold');
await page.waitForTimeout(1800);
let typed = 0;
for (let step = 0; step < 400; step++) {
  const st = await page.evaluate(() => {
    const S = window.__rv.S();
    if (!S || S.mode !== 'typing') return { done: true };
    const T = window.__rv.Typing;
    const e = S.enemies.filter((q) => !q.dead && q.word && !q.marked).sort((a, b) => a.x - b.x)[0];
    return { done: !!S.over, word: e ? e.word : null, target: T.target ? T.target.word : null, pos: T.pos };
  });
  if (st.done) break;
  if (st.target) { const rest = st.target.slice(st.pos); for (const ch of rest) await page.keyboard.type(ch, { delay: 20 }); typed++; }
  else if (st.word) { if (typed === 3) await page.keyboard.type('q'); for (const ch of st.word) await page.keyboard.type(ch, { delay: 20 }); typed++; }
  else await page.waitForTimeout(250);
}
await page.waitForTimeout(2500);
check('typing lesson results shown', await page.isVisible('#scrResults'), await page.evaluate(() => document.querySelector('#resultsBody').innerText.replace(/\s+/g, ' ').slice(0, 160)));
await page.screenshot({ path: join(out, 'f_typing_results.png') });
check('typing stats saved', await page.evaluate(() => !!window.__rv.SAVE().typing.lessons.t1));

// 2) level 1 win flow via bot, then results -> next level button -> hero select
await page.evaluate(() => { const rv = window.__rv; rv.Game.stopStage(); rv.Game.startLevel(rv.LEVELS[0], 'rook'); const S = rv.S(); S.bot = true; });
for (let i = 0; i < 120; i++) {
  const over = await page.evaluate(() => { const S = window.__rv.S(); if (!S) return 'none'; for (let k = 0; k < 120; k++) { if (S.inDraft) { S.inDraft = false; window.__rv.UI.hideAll(); } S.update(1 / 60); } return S.ended ? 'ended' : S.over || ''; });
  if (over === 'ended' || over === 'none') break;
}
await page.waitForTimeout(600);
check('L1 cleared saved', await page.evaluate(() => !!window.__rv.SAVE().cleared.L1));
check('L2 now available', await page.evaluate(() => window.__rv.WorldMap.nodes().find((n) => n.id === 'L2').avail));
await page.screenshot({ path: join(out, 'f_win_results.png') });
const nextBtn = await page.$('#resultsBody .btn.gold');
check('next-level button present', !!nextBtn);
if (nextBtn) { await nextBtn.click(); await page.waitForTimeout(300); check('hero select after next', await page.isVisible('#scrHeroes')); }

// 3) pause / restart / quit
await page.click('#heroesBody .btn.gold');
await page.waitForTimeout(3000);
await page.evaluate(() => { const S = window.__rv.S(); if (S.inDraft) { S.pendingLevels = 0; } });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('pause visible', await page.isVisible('#scrPause'));
await page.click('#pauseBody .btn.gold');
await page.waitForTimeout(200);
check('resumed', !(await page.isVisible('#scrPause')));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
await page.click('#pauseBody .btn.hot');
await page.waitForTimeout(500);
check('quit to map', await page.isVisible('#scrMap'));

// 4) cheats and konami
await page.keyboard.type('rosebud');
await page.waitForTimeout(200);
check('ROSEBUD adds quarters', await page.evaluate(() => window.__rv.SAVE().quarters >= 1000));
await page.keyboard.type('thereisnocowlevel');
await page.waitForTimeout(200);
check('cow secret set', await page.evaluate(() => !!window.__rv.SAVE().secrets.cow));
for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA']) await page.keyboard.press(k);
await page.waitForTimeout(200);
check('konami unlocks glitch', await page.evaluate(() => !!window.__rv.SAVE().heroes.glitch));
await page.screenshot({ path: join(out, 'f_map_after.png') });

// 5) cow level quick run with a tough bot
await page.evaluate(() => { const rv = window.__rv; rv.Game.startLevel({ id: 'COW', n: 7, name: 'The Cow Level', biome: 'cow', pool: [['cow', 1]], end: 'cowking', sections: 3 }, 'glitch'); const S = rv.S(); S.bot = true; S.hero.maxHp = S.hero.hp = 99999; S.hero.recalc = () => {}; });
for (let i = 0; i < 200; i++) {
  const over = await page.evaluate(() => { const S = window.__rv.S(); if (!S) return 'none'; for (let k = 0; k < 120; k++) { if (S.inDraft) { S.inDraft = false; window.__rv.UI.hideAll(); } S.update(1 / 60); } return S.ended ? 'ended' : ''; });
  if (over) break;
}
await page.waitForTimeout(400);
check('cow level finishes', await page.isVisible('#scrResults'), await page.evaluate(() => document.querySelector('#resultsBody h2')?.textContent));

// 6) endless: survive to wave 6 with a sturdy bot
await page.evaluate(() => { const rv = window.__rv; rv.Game.startEndless('bruno'); const S = rv.S(); S.bot = true; S.hero.maxHp = S.hero.hp = 99999; S.hero.recalc = () => {}; });
let wave = 0;
for (let i = 0; i < 300 && wave < 6; i++) {
  wave = await page.evaluate(() => { const S = window.__rv.S(); for (let k = 0; k < 120; k++) { if (S.inDraft) { S.inDraft = false; window.__rv.UI.hideAll(); } S.update(1 / 60); } return S.wave; });
}
check('endless reaches wave 6', wave >= 6, 'wave=' + wave);
await page.screenshot({ path: join(out, 'f_endless.png') });

// 7) password round trip
const pw = await page.evaluate(() => { window.__rv.Game.stopStage(); return window.__rv.SAVE().quarters; });
await page.evaluate(() => window.__rv.UI.settings(() => window.__rv.Game.toMap()));
const code = await page.inputValue('#pwBox');
await page.evaluate(() => { window.__rv.setSave({}); });
await page.fill('#pwIn', code);
await page.click('#settingsBody .btn.mint');
await page.waitForTimeout(200);
check('password restores quarters', await page.evaluate((q) => window.__rv.SAVE().quarters === q, pw));
await page.screenshot({ path: join(out, 'f_settings.png') });

log('errors:', errors.length ? errors : 'none');
await browser.close();
