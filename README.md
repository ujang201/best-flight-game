[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/ujang201/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/ujang201/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Skyline Courier

A little flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057). Fly a red courier plane through a sunlit valley in a chase view: thread glowing sky rings, mind the fuel gauge, watch the stall warning, and set her down gently on the island strips.

## Play

Serve `game/` with any static server — `node serve.ts` puts it on http://localhost:8080 — and open `game/index.html` in desktop Chrome. No build step, no network requests, no libraries: plain Canvas 2D and ES modules, with sound synthesized live by WebAudio.

- **Arrows / WASD** — bank and pitch. **Shift / E** throttle up, **Ctrl / Q** throttle down.
- **Mouse** — steer by where it sits on the screen, or hold the button to pin the stick.
- **1 / 2 / 3** — pick a mission on the title screen. **Space / click** — start. **P** — pause. **M** — mute. **R** — restart.

## Missions

1. **Ring Run** — thread all 8 sky rings in order. Clean flying beats raw speed; faster ring passes score more.
2. **Island Hop** — land on Coral Isle, Pine Ridge and Summit Strip, then come home. Only gentle touchdowns count.
3. **Storm Courier** — deliver the mail through 10 rings before the fuel runs dry. Green rings refuel.

## The flying

An arcade flight model with honest edges: throttle sets the target speed, banking turns the heading, a hard bank steals lift, and below flying speed the wings give up and the nose drops. Fuel drains with the throttle, hard touchdowns and belly grazes add damage, and a gentle landing on a strip scores. The HUD shows speed and altitude tapes, a compass strip, throttle / fuel / damage gauges, an attitude indicator, the mission objective and the clock.

## Files

- `game/index.html` — the page; `game/src/main.js` boots the loop.
- `game/src/config.js` — every number the game agrees on.
- `game/src/random.js` — seeded RNG, so one seed builds one valley.
- `game/src/terrain.js` — the valley: heightfield, hills, trees, clouds, runways.
- `game/src/aircraft.js` — the flight model: throttle, bank, pitch, lift, stall.
- `game/src/missions.js` — rings, landings, scoring, and how a run ends.
- `game/src/input.js` — keyboard and mouse.
- `game/src/audio.js` — synthesized engine hum, wind, chimes and thuds.
- `game/src/render.js` — the chase view, the aircraft, and the lit instruments.
- `game/src/shots.js` — the autopilot that stages the screenshot scenes.
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `shots.json` — the four screenshot scenes (`?shot=start|play|rings|land`).

## Screenshots

Four scenes, staged by the game's own autopilot (`?shot=…&seed=7`, see
`shots.json`): the cover mid-flight with a ring ahead, the title over the
valley, threading a ring at close range, and the final approach to Coral Isle.

## License

MIT — see [LICENSE](LICENSE).

---

Built with make.fun — https://make.fun/r/wfjv7kgb
