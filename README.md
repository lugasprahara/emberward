# emberward

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/lugasprahara/emberward/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/lugasprahara/emberward/reward.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

EMBERWARD is an original twilight tower defence in vanilla JS: at dusk the Ashen Horde walks the old road toward the last Ember Crystal, and you are its keeper. Raise four kinds of ward-tower in three tiers each, chill the horde, scorch the road beneath it, chain lightning through its ranks — and when the kills have fed the crystal's surge, answer with the Crystal Nova. Twenty waves, six foe kinds, four named Behemoth bosses, three difficulties, and an Endless night for the victorious.

## Run it

```sh
node serve.ts            # then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=aes5np1n&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

## The game

The horde pours from the gate at the road's mouth and follows the cobbles
in a long S: Imps in their dozens, Runners that test your reaction time,
Wisps that shrug off half your frost, Brutes that soak bolts, Shield
Golems whose plate turns weak hits aside. Every fifth wave a Behemoth
leads them, named and announced: Gorath, the Cinderback; Vess, Mother of
Ash; the Hollow King — and on the twentieth night, two of them together.

Your wards are four:

- **Arrow Spire** — cheap, fast, honest bolts.
- **Frost Obelisk** — chills a whole cluster, slowing the road to a crawl.
- **Ember Mortar** — lobbed shells whose splash leaves **scorch fields**:
  burning ground that keeps hurting everything standing in it.
- **Storm Pylon** — lightning that chains from foe to foe.

Every tower climbs three tiers. Kills pay bounty gold and feed the
**Crystal Surge**: at full charge the Nova burns and chills the entire
road at once. Gold you *don't* spend earns interest at each wave's end,
so a lean defence compounds. Sell towers back at 70% when the road's
shape changes under you.

## How to play

- **Build:** click a tower card (or keys `1`–`4`), then click a free tile.
  The ghost shows the tower's range; green means the tile is legal.
- **Start wave:** the panel button or `Space`. Waves never start without
  you — plan first.
- **Upgrade / sell:** click any placed tower; its panel shows damage,
  range and rate, the upgrade price, and the sell refund.
- **Crystal Nova:** `F` (or click the surge meter) when it reads full.
- **Speed:** `Tab` or the panel button toggles ×2. **Pause:** `P`.
  **Mute:** `M`. **Restart:** `R` on the end screens.
- **Win:** hold all 20 waves. **Lose:** the crystal's 20 hearts run out.
  Victory unlocks the **Endless** night (`E`): waves, bosses and scaling
  without end, for score.
- **Difficulties:** Squire, Warden and Nightmare, chosen on the title
  screen — they scale foe health, your purse, and the score multiplier.

## Hand it in

`main.ts` is the entry program: it copies `game/` and `screenshots/` to
the output directory and writes `dossier.json` with the vendored make.fun
library (`vendor/makefun-game.ts`, the kit's copy, unchanged).

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `game/index.html` — the page and its styling.
- `game/src/main.js` — state machine, interactions, wave lifecycle, loop.
- `game/src/entities.js` — foes, towers, projectiles, scorch fields,
  particles; all damage and bounty bookkeeping.
- `game/src/render.js` — canvas drawing: the twilight field, towers,
  foes, HUD panel, banners and screens.
- `game/src/world.js` — the road polyline, path tiles, seeded decoration.
- `game/src/config.js` — palette, tower/foe definitions, wave tables,
  boss names, difficulty and Nova tuning.
- `game/src/audio.js` — synthesized WebAudio effects and ambient pad.
- `game/src/input.js` — keyboard and mouse, polled per frame.
- `game/src/shots.js` — deterministic screenshot poses
  (`?shot=title|action|boss|over&seed=N`).
- `game/src/random.js` — seeded RNG (mulberry32).

Screenshots in `screenshots/` are real renders of the game, captured from
the poses named in `shots.json`.

## License

MIT — see `LICENSE`.
