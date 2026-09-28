// Smoke test: load the built page in headless Chromium, click through screens,
// run bot-played levels at accelerated speed and report errors + screenshots.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.SHOTS || join(root, 'shots');
mkdirSync(out, { recursive: true });
const url = 'file://' + join(root, 'index.html');
const args = process.argv.slice(2);
const only = args[0] || 'all';

const browser = await chromium.launch();
async function newPage(viewport, touch = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForTimeout(800);
  return { page, errors };
}
const shot = (page, name) => page.screenshot({ path: join(out, name + '.png') });

if (only === 'all' || only === 'screens') {
  const { page, errors } = await newPage({ width: 1280, height: 720 });
  await page.waitForTimeout(1500);
  await shot(page, '01_title');
  await page.click('#bPlay');
  await page.waitForTimeout(1200);
  await shot(page, '02_map');
  await page.click('#mapGo');
  await page.waitForTimeout(600);
  await shot(page, '03_heroes');
  await page.click('#heroesBody .btn.gold');
  await page.waitForTimeout(2500);
  await shot(page, '04_level1');
  // walk & punch a bit
  await page.keyboard.down('KeyD'); await page.waitForTimeout(600); await page.keyboard.up('KeyD');
  for (let i = 0; i < 6; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(120); }
  await page.keyboard.press('KeyU');
  await page.waitForTimeout(400);
  await shot(page, '05_fight');
  await page.evaluate(() => { const S = window.__rv.S(); S.hero.gainXp(40); });
  await page.waitForTimeout(700);
  await shot(page, '06_draft');
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await shot(page, '07_pause');
  await page.evaluate(() => window.__rv.UI.resume());
  await page.evaluate(() => { const G = window.__rv.Game; G.quitToMap(); window.__rv.UI.skills(() => G.toMap()); });
  await page.waitForTimeout(400);
  await shot(page, '08_skills');
  await page.evaluate(() => { window.__rv.UI.trophies(() => window.__rv.Game.toMap()); });
  await page.waitForTimeout(300);
  await shot(page, '09_trophies');
  await page.evaluate(() => { window.__rv.Typing.menu(); });
  await page.waitForTimeout(300);
  await shot(page, '10_dojo');
  await page.evaluate(() => { window.__rv.Typing.start(window.__rv.Typing && (window.LESSONS_ || null) || null, 'mira'); }).catch(() => {});
  console.log('screens errors:', errors.length ? errors : 'none');
}

if (only === 'all' || only === 'levels') {
  const { page, errors } = await newPage({ width: 1280, height: 720 });
  const results = await page.evaluate(async () => {
    const rv = window.__rv;
    const res = [];
    const heroes = ['rook', 'mira', 'bruno', 'kit', 'volta', 'glitch'];
    for (let i = 0; i < rv.LEVELS.length; i++) {
      const L = rv.LEVELS[i];
      // simulate a player who has invested quarters from earlier levels
      const r = Math.min(5, Math.floor(i / 2));
      const sv = rv.SAVE();
      sv.heroes = { rook: 1, mira: 1, bruno: 1, kit: 1, volta: 1, glitch: 1 };
      sv.skills = { m1: r, g1: r, a1: r, f1: r, m2: Math.min(5, Math.floor(r * 0.7)), g2: Math.min(3, Math.floor(r / 2)), a2: Math.min(5, Math.floor(r * 0.7)), g5: i >= 8 ? 1 : 0 };
      rv.Game.startLevel(L, heroes[i % heroes.length]);
      const S = rv.S();
      S.bot = true; S.dmgLog = {};
      let t = 0;
      const dt = 1 / 60;
      let err = null;
      try {
        while (!S.ended && t < 60 * 12) {
          if (S.inDraft) { rv.UI.hideAll(); S.inDraft = false; }
          S.update(dt);
          if (Math.floor(t * 60) % 30 === 0) S.draw();
          t += dt;
        }
      } catch (e) { err = e.message + ' @ ' + (e.stack || '').split('\n')[1]; }
      const top = Object.entries(S.dmgLog).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + '=' + Math.round(v)).join(' ');
      res.push({ id: L.id, top, over: S.over, time: Math.round(S.time), lvl: S.hero.level, kills: S.kills, hp: Math.round(S.hero.hp), sec: S.secIdx, err: err && err.slice(0, 60) });
      rv.Game.stopStage();
    }
    return res;
  });
  console.table(results);
  console.log('level errors:', errors.length ? errors.slice(0, 10) : 'none');
}

if (only === 'all' || only === 'mobile') {
  for (const [name, vp] of [['m_portrait', { width: 390, height: 844 }], ['m_landscape', { width: 844, height: 390 }]]) {
    const { page, errors } = await newPage(vp, true);
    await page.waitForTimeout(1200);
    await shot(page, name + '_title');
    await page.tap('#bPlay');
    await page.waitForTimeout(1200);
    await shot(page, name + '_map');
    await page.evaluate(() => { const rv = window.__rv; rv.Input.touch = true; rv.Game.startLevel(rv.LEVELS[3], 'kit'); });
    await page.waitForTimeout(2500);
    await shot(page, name + '_level');
    await page.evaluate(() => { const S = window.__rv.S(); S.hero.gainXp(40); });
    await page.waitForTimeout(700);
    await shot(page, name + '_draft');
    console.log(name, 'errors:', errors.length ? errors : 'none');
  }
}

if (only === 'bosses') {
  const { page, errors } = await newPage({ width: 1280, height: 720 });
  const results = await page.evaluate(async () => {
    const rv = window.__rv;
    const res = [];
    const list = rv.LEVELS.map((l) => l).concat([{ id: 'COW', n: 7, name: 'Cow', biome: 'cow', pool: [['cow', 1]], end: 'cowking', sections: 3 }]);
    for (const L of list) {
      rv.Game.startLevel(L, 'bruno');
      const S = rv.S();
      S.bot = true; S.dmgLog = {}; S.pendingLevels = 0; S.warmup = 0;
      S.startSection(L.sections - 1);
      S.waves = ['BOSS']; S.waveIdx = 0; S.waveCooldown = 0;
      S.hero.x = S.arena[0] + 200; S.hero.maxHp = 99999; S.hero.hp = 99999;
      const pats = new Set();
      let err = null, t = 0;
      try {
        while (!S.ended && t < 240) {
          if (S.inDraft) { rv.UI.hideAll(); S.inDraft = false; }
          S.update(1 / 60);
          for (const b of S.bosses) if (b.act) pats.add(b.act.name);
          if (Math.floor(t * 60) % 20 === 0) S.draw();
          t += 1 / 60;
        }
      } catch (e) { err = e.message + ' @ ' + (e.stack || '').split('\n')[1]; }
      const dmg = Math.round(Object.entries(S.dmgLog).filter(([k]) => k.includes('*')).reduce((a, [, v]) => a + v, 0));
      res.push({ id: L.id, boss: L.end, over: S.over, t: Math.round(t), bossDmgToHero: dmg, pats: [...pats].join(','), err: err && err.slice(0, 90) });
      rv.Game.stopStage();
    }
    return res;
  });
  console.table(results);
  console.log('boss errors:', errors.length ? errors.slice(0, 10) : 'none');
}

if (only === 'gallery') {
  const { page, errors } = await newPage({ width: 1280, height: 720 });
  const lv = (process.env.LV || '0,1,2,3,4,5,6,7,8,9,10,11').split(',').map(Number);
  for (const i of lv) {
    await page.evaluate((i) => {
      const rv = window.__rv; const L = rv.LEVELS[i];
      rv.Game.startLevel(L, ['rook', 'mira', 'bruno', 'kit', 'volta', 'glitch'][i % 6]);
      const S = rv.S(); S.pendingLevels = 0; S.warmup = 0; S.intro = 0; S.banners = [];
      rv.UI.hideAll();
      for (const [k] of L.pool) S.spawnEnemy(k, { edge: true });
      for (let t = 0; t < 150; t++) S.update(1 / 60);
      for (const e of S.enemies) { e.x = S.hero.x + 150 + Math.random() * 400; e.entering = false; }
      S.bot = true;
      for (let t = 0; t < 90; t++) S.update(1 / 60);
    }, i);
    await page.waitForTimeout(250);
    await shot(page, 'g_' + String(i + 1).padStart(2, '0') + '_a');
    await page.evaluate(() => {
      const rv = window.__rv; const S = rv.S();
      for (const e of S.enemies) e.dead = e.remove = true;
      S.enemies = []; S.spawnBoss(S.level.end); S.hero.maxHp = S.hero.hp = 9999;
      for (let t = 0; t < 60 * 3.2; t++) S.update(1 / 60);
    });
    await page.waitForTimeout(250);
    await shot(page, 'g_' + String(i + 1).padStart(2, '0') + '_boss');
    await page.evaluate(() => { const S = window.__rv.S(); for (let t = 0; t < 60 * 4; t++) S.update(1 / 60); });
    await page.waitForTimeout(200);
    await shot(page, 'g_' + String(i + 1).padStart(2, '0') + '_fight');
  }
  console.log('gallery errors:', errors.length ? errors.slice(0, 6) : 'none');
}
await browser.close();
