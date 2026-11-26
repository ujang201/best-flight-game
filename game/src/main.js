// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play,
// paused and game over. Three missions wait on the title screen.
//
// ?seed=N fixes the valley, the rings and the clouds. ?shot=start|play|rings|
// land (with &seed=N) stages that scene instead of running the loop, paints
// it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, MISSIONS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createTerrain } from './terrain.js';
import { createAircraft, EVENT_CRASHED, EVENT_LANDED } from './aircraft.js';
import { createMission } from './missions.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const terrain = createTerrain(createRandom(seed));
const aircraft = createAircraft(terrain);
const renderer = createRenderer(canvas, terrain);
const audio = createAudio();

// The world the loop steps: the plane, its mission, and the step that joins
// them — ring crossings are checked between the old z and the new one. The
// mission is a property, never a closed-over const: reset() swaps the whole
// mission object, so the renderer and the mission's own methods always see
// the same state (swapping only .state would leave the methods talking to
// the old one while the screen read the new one).
function createWorld(missionId) {
  const world = {
    plane: aircraft.state,
    mission: createMission(createRandom(seed + 101), missionId),
    reset() {
      this.mission = createMission(createRandom(seed + 101), missionId);
      aircraft.reset(this.mission.state.mission);
    },
    step(control, dt) {
      const previousZ = aircraft.state.z;
      const events = aircraft.step(control, dt);
      return events | this.mission.checkRingCrossing(aircraft.state, previousZ);
    },
  };
  aircraft.reset(world.mission.state.mission);
  return world;
}

let world = createWorld('rings');
let missionIndex = 0;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts one visit.
  }
}

function runShot(name) {
  // The landing scene flies the Island Hop mission, so its HUD names the
  // strip ahead and no ring pointer crowds the approach.
  if (name === 'land') world = createWorld('islands');
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, 12);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let clock = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startMission(index) {
    missionIndex = index;
    world = createWorld(MISSIONS[index].id);
    screen = SCREEN_PLAY;
    accumulator = 0;
    announce(`Flying ${MISSIONS[index].name}. ${MISSIONS[index].tagline}`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.crash();
    if (world.mission.state.score > best) {
      best = world.mission.state.score;
      saveBest(best);
    }
    announce(`Flight over. Score ${world.mission.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    const missionKey = input.takeMissionKey();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_OVER)) {
      startMission(missionIndex);
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (missionKey === '1') startMission(0);
      else if (missionKey === '2') startMission(1);
      else if (missionKey === '3') startMission(2);
      else if (actions & ACTION_CONFIRM) startMission(0);
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) {
      startMission(missionIndex);
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The valley idles behind the title: the plane cruises straight on
      // autopilot and the world resets when she has flown past the first
      // bend, so the title always sits over open sky.
      world.step({ bank: 0, pitch: 0, throttle: 0 }, STEP);
      if (world.plane.z > 600) world.reset();
      return;
    }
    const previousScore = world.mission.state.score;
    const previousRings = world.mission.state.ringsPassed;
    const events = world.step(input.control(), STEP);
    world.mission.update(world.plane, events, STEP);
    clock += STEP;
    if (world.mission.state.ringsPassed > previousRings) audio.ringChime();
    if (events & EVENT_LANDED) audio.thud();
    if (events & EVENT_CRASHED) endGame();
    else if (world.mission.state.finished) endGame();
    else if (world.mission.state.score !== previousScore) {
      announce(`Score ${world.mission.state.score}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.update(world.plane.throttle, world.plane.speed, screen === SCREEN_PLAY);
    renderer.draw(world, screen, best, clock);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  canvas.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  announce('Skyline Courier. Press 1, 2 or 3 to pick a mission, or Space to fly Ring Run.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
