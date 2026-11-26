// Missions: what the pilot is asked to do, and how the run is scored. Rings are
// laid along the course from the seed; landings are judged by the flight model.
// A mission ends in a win, a crash, an empty tank or the clock running out.
import {
  FUEL_RING_BONUS,
  LANDING_SCORE,
  MISSIONS,
  RING_RADIUS,
  RING_SCORE,
  TIME_BONUS_PER_SECOND,
  WORLD,
} from './config.js';
import { EVENT_CRASHED, EVENT_FUEL_EMPTY, EVENT_LANDED, EVENT_RING } from './aircraft.js';

export function missionById(id) {
  return MISSIONS.find((mission) => mission.id === id) ?? MISSIONS[0];
}

export function createMission(seedRandom, missionId) {
  const mission = missionById(missionId);
  const random = seedRandom;
  const rings = [];
  const count = mission.rings;
  for (let index = 0; index < count; index += 1) {
    const along = ((index + 1) / (count + 1)) * WORLD.courseLength;
    const fuelRing = mission.id === 'courier' && index % 3 === 2;
    rings.push({
      x: random.range(-150, 150),
      y: random.range(34, 110),
      z: along,
      radius: RING_RADIUS,
      passed: false,
      fuel: fuelRing,
    });
  }
  // Island Hop needs no rings: its goals are the three strips after home base.
  const landingsNeeded =
    mission.id === 'islands' ? WORLD.runways.slice(1).map((runway) => runway.name) : [];

  const state = {
    mission,
    rings,
    ringIndex: 0,
    score: 0,
    ringsPassed: 0,
    landings: [],
    landingsNeeded,
    message: '',
    messageTime: 0,
    finished: false,
    won: false,
    endReason: '',
    elapsed: 0,
    bestCombo: 0,
  };

  function say(text) {
    state.message = text;
    state.messageTime = 3.2;
  }

  function ringPassed(plane) {
    const ring = rings[state.ringIndex];
    if (!ring) return false;
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    if (Math.abs(plane.z - ring.z) > 14) return false;
    if (dx * dx + dy * dy > ring.radius * ring.radius) return false;
    ring.passed = true;
    state.ringIndex += 1;
    state.ringsPassed += 1;
    const speedBonus = Math.round(plane.speed);
    state.score += RING_SCORE + speedBonus;
    if (ring.fuel) {
      plane.fuel = Math.min(100, plane.fuel + FUEL_RING_BONUS);
      say(`Fuel ring! +${FUEL_RING_BONUS} fuel — ${state.ringsPassed}/${rings.length} rings`);
    } else {
      say(`Ring ${state.ringsPassed}/${rings.length} — +${RING_SCORE + speedBonus} pts`);
    }
    return true;
  }

  function finish(won, reason) {
    if (state.finished) return;
    state.finished = true;
    state.won = won;
    state.endReason = reason;
    if (won) {
      const remaining = Math.max(0, Math.ceil(mission.timeLimit - state.elapsed));
      const bonus = remaining * TIME_BONUS_PER_SECOND;
      state.score += bonus;
      say(`Mission complete! Time bonus +${bonus}`);
    }
  }

  // Called every step with the plane's events; returns nothing, keeps score.
  function update(plane, events, dt) {
    if (state.finished) return;
    state.elapsed += dt;
    if (state.messageTime > 0) state.messageTime -= dt;

    if (events & EVENT_RING) ringPassed(plane); // the caller raises it on a crossing
    if (state.ringIndex >= rings.length && rings.length > 0 && mission.id !== 'islands') {
      finish(true, 'All rings threaded');
      return;
    }
    if (events & EVENT_LANDED) {
      const runway = plane.landedRunway;
      if (runway && mission.id === 'islands') {
        if (runway.name === 'MERIDIAN FIELD') {
          if (state.landings.length === landingsNeeded.length) {
            state.score += LANDING_SCORE;
            finish(true, 'Home safe after every island');
            return;
          }
          say('Home base — but the islands still wait. Take off again!');
        } else if (!state.landings.includes(runway.name)) {
          state.landings.push(runway.name);
          state.score += LANDING_SCORE;
          say(`Touched down on ${runway.name}! ${state.landings.length}/${landingsNeeded.length} islands`);
        } else {
          say(`${runway.name} already visited — on to the next strip`);
        }
      } else if (runway) {
        state.score += LANDING_SCORE;
        finish(true, `Landed at ${runway.name}`);
        return;
      }
    }
    if (events & EVENT_CRASHED) {
      finish(false, plane.damage >= 100 ? 'Airframe gave out' : 'Crashed into the valley');
      return;
    }
    if (events & EVENT_FUEL_EMPTY) {
      say('Fuel empty! Glide her down gently…');
    }
    if (state.elapsed >= mission.timeLimit) {
      finish(false, 'Out of time');
    }
  }

  // The caller checks ring crossings with the plane's previous z, because a ring
  // is a plane in space: crossing its z inside its circle counts as a pass.
  function checkRingCrossing(plane, previousZ) {
    const ring = rings[state.ringIndex];
    if (!ring || state.finished) return 0;
    if (previousZ < ring.z && plane.z >= ring.z) {
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      if (dx * dx + dy * dy <= ring.radius * ring.radius) return 1; // EVENT_RING
    }
    return 0;
  }

  return { state, update, checkRingCrossing, say, finish };
}
