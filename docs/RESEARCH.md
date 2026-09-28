# Research notes: Rumblevale

Research done before any code was written. Each section ends with the concrete design decisions it produced for the game.

---

## 1. The original: Little Fighter 2 (Marti Wong & Starsky Wong, 1999)

- Freeware Windows brawler. Up to 4 players on one keyboard, 8 fighters on screen, 24 characters (11 at the start).
- Four buttons: **Attack, Jump, Defend**, plus directions. Specials are **input sequences** like `Defend → Forward → Attack` (D→A), `D↑A` and `D↓A`. Everyone knows the fighter by their D→A.
- 2.5D belt-scroller space: you move left/right **and** in depth. Jump, run (double tap), dash, and pick up and throw props (bats, stones, boxes, milk and beer bottles).
- HP bar (red) plus MP bar (blue) that pays for specials. Characters have elements: fire (Firen), ice (Freeze), healing (Jan), shockwave palms (Monk), homing balls (Dennis).
- **Stage Mode:** you move through areas while waves grow in size and difficulty. While a boss is alive, mooks keep respawning. Stage 1 (Lion Forest) teaches the controls.
- Other modes: VS, Championship, Battle, 1-on-2, and a Demo (bots fight).

**What made it great:** readable elemental specials, chaotic group fights, and emergent combos (freeze someone, then shatter them with fire). It was free on every school computer, and you learned a fighter by memorising three inputs.

**What aged badly:** tiny low-res sprites, no progression, no reason to replay stage mode beyond score, keyboard only, no onboarding.

**Decisions:**
- Keep Attack/Jump/Defend and the **D→A / D↑A / D↓A grammar** on keyboard. On touch screens each spell slot gets its own button.
- Keep HP + MP and **elemental specials with interactions** (freeze → shatter, oil/fire, quake stuns).
- Keep **stage waves**: an arena locks, waves spawn, then "GO →". The boss gets support mooks.
- Keep **throwable props** and healing milk bottles.
- Fix the aged parts: large vector fighters, onboarding, progression, and touch controls.

---

## 2. Similar games and what each does best

| Game | What it contributes | What we take |
|---|---|---|
| **Streets of Rage 2 / Final Fight** (1991–93) | Crowd-control beat 'em up grammar, food hidden in breakables | Breakable barrels drop food and coins. Wall-chicken joke. |
| **River City Ransom** (1989) | RPG stats in a brawler, shops, humour | Merchant between levels, funny enemy barks |
| **Castle Crashers** (2008) | Levelling brawler, world map, animal orbs, absurd humour | World map with branching nodes and silly bosses |
| **Hades** (2020) | Build crafting through boons from gods; duo boons; the Mirror meta tree; story keeps going when you die | Elemental "boon" cards, **duo synergies** (Fire+Ice = Steam), and a **permanent skill tree** |
| **Dead Cells** (2018) | Tight combat, permanent unlocks widen the item pool | Beating bosses unlocks new elements and cards in the draft pool |
| **Vampire Survivors** (2022) | A reward every few seconds, level-up choice of 3–4, weapon **evolutions**, escalating power fantasy | XP gems that magnetise, 3-card level-up drafts, spells that **evolve at level 5** |
| **Slay the Spire** (2017) | A readable branching map with risk and reward (elites, rest, treasure, shop) | Map nodes of different types. Optional elite and treasure branches. |
| **Brotato / Magic Survival** | Short, mobile-friendly runs | Levels of 3–6 minutes, with pause anywhere |
| **Devil May Cry** (2001) | Style rank D → SSS | Combo counter with a rank letter that pays out bonus XP |
| **The Typing of the Dead** (1999), **Epistory** (2016) | Typing as combat; adaptive difficulty | Special mode **"Keyboard Warrior"**, see §5 |

---

## 3. Why these games are motivating (and where "addictive" should stop)

**Self-Determination Theory** (Deci & Ryan; Ryan, Rigby & Przybylski 2006 for games): enjoyment and wanting to come back rise when three needs are met.

1. **Competence:** a clear, fair challenge with instant feedback. We use telegraphed boss attacks (red ground markers), hit-stop, damage numbers, combo rank, and difficulty that climbs **one notch per level**.
2. **Autonomy:** meaningful choice. The player picks the path on the map, the hero, one of 3 draft cards per level-up, and what to buy on the skill tree.
3. **Relatedness:** characters with personality, boss banter, and shared cultural jokes (the easter eggs).

**Reward cadence (Vampire Survivors):** something good happens every few seconds (gems, coins, crits). There is a bigger reward every ~30 s (level-up) and a big one per level (stars, quarters, unlocks). We copy the cadence but keep it **honest**: no loot boxes, no real money, no energy timers, no daily-login guilt. The "one more run" pull comes from visible progress on the map and skill tree.

**Game feel ("Juice it or lose it", Jonasson & Purho, 2012):**
- **Hit-stop** of 40–90 ms on impact
- Screen shake scaled to hit strength
- Squash and stretch on jump and land
- White flash on the victim
- Particles and dust puffs
- Damage numbers that pop
- Sound for every action

**Rogue-lite structure (Hades, Dead Cells, Rogue Legacy):** a failed run still pays out (quarters, XP to the skill tree), so death becomes progress. Permanent unlocks widen the pool instead of only raising stats, so later runs feel *different*, not just easier.

**Decisions:**
- Per level: waves → level-ups → draft cards → boss → 1–3 stars → quarters.
- Death keeps 60 % of earned quarters.
- Skill tree with 4 branches (Might, Guard, Arcana, Fortune), including an "Extra Life" node.
- Achievements with toasts (the 2005 console-toast feeling) and a stats page.
- Difficulty per level `L`: enemy HP ×(1 + 0.28·L), damage ×(1 + 0.12·L), more elites, faster spawns, and new enemy types every region.

---

## 4. The retro culture layer (1990–2010)

Easter eggs are what players *share*, so they help with relatedness and word of mouth. We use **nods, not copies**: short phrases, cheat codes, and generic objects from the era (floppy disks, CRTs, cartridges, dial-up modems, a Y2K bug). We never draw anyone else's characters.

- **Konami code** (↑↑↓↓←→←→BA) on the title screen unlocks a secret hero.
- **Typed cheats** that are period-correct:
  - `IDDQD` (1993) and `IDKFA`
  - `THEREISNOCOWLEVEL` (which opens a cow level, of course)
  - `ROSEBUD` (2000)
  - `HESOYAM` (2004)
  - `BIGHEAD`
  - `XYZZY` (it says "Nothing happens.")
- Cheats mark the run as "CHEATER", so no stars. It is the honest arcade way.
- The final boss is **The Millennium Bug** (Y2K).
- The meta currency is **Quarters** (arcade coin-op), the game over screen says **INSERT COIN**, and **password saves** work like NES-era progress codes.
- Background props: a CRT playing a snake game, a floppy in the grass, a tamagotchi-style egg pet, a dial-up sign, a "The cake is a lie" chalk scrawl, and "All your base" graffiti.

---

## 5. Learning to type (research) and the "Keyboard Warrior" special mode

- **Accuracy before speed.** Early practice fixes finger paths into memory, errors included. Aim for ≥ 95 % accuracy before pushing speed (typing-pedagogy consensus; Ericsson's deliberate-practice work covers typing too).
- **Deliberate practice.** Target weak keys with immediate feedback, rather than repeating everything.
- **Spaced, short sessions** beat marathon sessions.
- **Progressive key sets:** home row (`asdf jkl;`) → top row → bottom row → common words → capitals and punctuation.
- **Adaptive pacing** (Epistory slows down when you struggle) keeps hunt-and-peck players playing long enough to improve.
- **The Typing of the Dead** showed that typing works as a verb in an action game, but gives little to real beginners without a curriculum.

**Decisions:** Keyboard Warrior mode, where every enemy carries a word:

- The **lesson ladder** grows from home row to full sentences.
- The **combo resets on a typo**, so accuracy pays more than speed.
- Enemy speed **adapts** to your rolling accuracy and WPM.
- The **results screen** shows WPM, accuracy, and your 3 weakest keys, and the next session puts more of those letters in its words.
- On phones, the on-screen keyboard is used through a hidden input.

---

## 6. "Lorem ipsum" and the main idea

Lorem ipsum is scrambled Latin from Cicero's *De finibus bonorum et malorum* (45 BC, §1.10.32–33). A 16th-century typesetter probably used it first as filler. Letraset rub-on sheets revived it in the 1960s, and Richard McClintock traced the source in the 1980s. It is placeholder text that shows the *shape* of a page before the real words exist.

For this project the "lorem ipsum" equivalent is the **core loop**. It had to be fun with grey boxes before any art went on it:

> **Move → hit → hit harder → level up → pick a card → get stronger → face something bigger → win or die → spend quarters → pick the next place on the map.**

Everything else (biomes, jokes, easter eggs) is real content layered onto that loop. The game ships no placeholder text anywhere.

---

## Sources

- [Little Fighter 2, Wikipedia](https://en.wikipedia.org/wiki/Little_Fighter_2) · [Stage Mode, LF Wiki](https://lf2.fandom.com/wiki/Stage_Mode) · [LF2 Moves, StrategyWiki](https://strategywiki.org/wiki/Little_Fighter_2/Moves) · [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/LittleFighter2)
- [Hades vs Dead Cells, FULLSYNC](https://fullsync.co.uk/roguelite-rumble-hades-vs-dead-cells/)
- [Vampire Survivors design analysis](https://www.kokutech.com/blog/gamedev/design-patterns/power-fantasy/vampire-survivors) · [The Secret Sauce of Vampire Survivors](https://jboger.substack.com/p/the-secret-sauce-of-vampire-survivors) · [An escalating dopamine rush](https://www.thevibes.com/articles/lifestyles/53373/vampire-survivors-an-escalating-dopamine-rush-disguised-as-a-retro-game)
- [Slay the Spire map generation](https://www.ludo.guide/guide/slay-the-spire/pathing-risk-assessment/map-generation-and-branching) · [Map routing guide](https://www.dood.gg/en/slay-the-spire/guides/map-guide/)
- [Castle Crashers, Wikipedia](https://en.wikipedia.org/wiki/Castle_Crashers) · [River City Ransom, Wikipedia](https://en.wikipedia.org/wiki/River_City_Ransom)
- [Self-Determination Theory breakdown, Game Developer](https://www.gamedeveloper.com/design/a-quick-breakdown-of-self-determination-theory) · [Ryan, Rigby & Przybylski 2006 (PDF)](https://selfdeterminationtheory.org/SDT/documents/2006_RyanRigbyPrzybylski_MandE.pdf)
- [Juice it or lose it, GameJuice](https://gamejuice.co.uk/resources/juice-it-or-lose-it) · [Game feel on the web](https://valdemird.com/blog/game-feel-on-the-web/)
- [The Typing of the Dead, Wikipedia](https://en.wikipedia.org/wiki/The_Typing_of_the_Dead) · [Epistory review, Tech Age Kids](https://www.techagekids.com/2017/10/epistory-gorgeous-typing-game-for.html) · [Typing game, Wikipedia](https://en.wikipedia.org/wiki/Typing_game)
- [Deliberate practice and typing proficiency (Keith & Ericsson, preprint)](https://www.orgpsy.psychologie.tu-darmstadt.de/media/orgpsy/keithericsson2007_preprint.pdf) · [Speed or accuracy, Typesy](https://www.typesy.com/speed-or-accuracy-mastering-the-typing-balance/)
- [Lorem ipsum history, lipsum.com](https://www.lipsum.com/) · [FedTech: Lorem ipsum from Cicero to modern design](https://fedtechmagazine.com/article/2021/06/history-lorem-ipsum)
