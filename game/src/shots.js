// The screenshot scenes behind ?shot=start|play|rings|land. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (bank toward the next ring, pitch to hold its height,
// throttle up when slow), so the frame is what a short game really looks like
// and the same seed always gives the same frame.
import { STEP } from './config.js';
import { createMission } from './missions.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { EVENT_LANDED } from './aircraft.js';

const SAMPLE = STEP;
const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const RINGS_SECONDS = 36;
const LAND_SECONDS = 75;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Steer toward a point in the sky: a pursuit controller, not a bare
 * proportional one. It works out the heading that intercepts the target by
 * the time the plane gets there, banks to hold that heading, and pitches to
 * meet the target's height on the same schedule — so the plane settles onto
 * the line instead of weaving across it. Exported so a headless harness can
 * drive the same pilot the screenshots use. */
export function autopilotTo(plane, targetX, targetY, targetZ) {
  const dx = targetX - plane.x;
  const dy = targetY - plane.y;
  const dz = Math.max(30, targetZ - plane.z);
  const speed = Math.max(20, plane.speed);
  const timeToTarget = dz / speed;

  // Lateral: the heading whose sideways speed closes dx by arrival.
  const wantLateral = clamp(dx / timeToTarget, -30, 30);
  const wantHeading = Math.asin(clamp(-wantLateral / speed, -0.5, 0.5));
  let headingError = wantHeading - plane.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  // The model's bank is signed the other way: a positive bank rolls right
  // and turns the heading down, so the error enters with a minus.
  const bank = clamp(-headingError * 2.5, -1, 1);

  // Vertical: the pitch whose climb closes dy by arrival.
  const wantClimb = clamp(dy / timeToTarget, -24, 24);
  const wantPitch = Math.asin(clamp(wantClimb / speed, -0.4, 0.4));
  const pitch = clamp(wantPitch / 0.42, -1, 1);

  const throttle = plane.speed < 58 ? 0.6 : plane.speed > 72 ? -0.6 : 0;
  return { bank, pitch, throttle };
}

/** Step the world forward with the autopilot, returning the events it raised. */
function flyFor(world, mission, seconds, target) {
  const plane = world.plane;
  let events = 0;
  for (let step = 0; step < seconds / SAMPLE; step += 1) {
    const previousZ = plane.z;
    const control = target(plane, mission);
    const raised = world.step(control, SAMPLE);
    events |= raised;
    events |= mission.checkRingCrossing(plane, previousZ);
    mission.update(plane, events, SAMPLE);
    if (mission.state.finished) break;
    events = 0;
  }
  return events;
}

/**
 * Set the world to the named scene and return the screen to draw over it.
 * start: the title over the valley at dawn light. play: mid-flight, a ring
 * ahead and the HUD lit. rings: threading a ring at close range. land: on
 * final approach to Coral Isle, gear down in spirit, runway ahead.
 */
export function stageShot(name, world) {
  world.reset();
  // Capture the mission AFTER the reset: reset() swaps in a fresh mission
  // object, and the pilot must steer the one the screen is reading.
  const mission = world.mission;
  if (name !== 'play' && name !== 'rings' && name !== 'land') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step({ bank: 0, pitch: 0, throttle: 0 }, STEP);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    flyFor(world, mission, PLAY_SECONDS, (plane) => {
      const ring = mission.state.rings[mission.state.ringIndex];
      if (!ring) return { bank: 0, pitch: 0, throttle: 0 };
      return autopilotTo(plane, ring.x, ring.y, ring.z);
    });
    return { screen: mission.state.finished ? SCREEN_OVER : SCREEN_PLAY, best: mission.state.score };
  }
  if (name === 'rings') {
    flyFor(world, mission, RINGS_SECONDS, (plane) => {
      const ring = mission.state.rings[mission.state.ringIndex];
      if (!ring) return { bank: 0, pitch: 0, throttle: 0 };
      return autopilotTo(plane, ring.x, ring.y, ring.z);
    });
    return { screen: mission.state.finished ? SCREEN_OVER : SCREEN_PLAY, best: mission.state.score };
  }
  // land: fly the approach to the Coral Isle strip and hold the frame just
  // short of touchdown, runway filling the view, so the shot shows the
  // landing itself rather than the panel that follows it.
  const strip = { x: 0, y: 8, z: 2400 };
  const plane = world.plane;
  for (let step = 0; step < LAND_SECONDS / SAMPLE; step += 1) {
    const dist = strip.z - plane.z;
    if (dist < 90 && plane.y < 24) break;
    const previousZ = plane.z;
    let control;
    if (dist > 500) control = autopilotTo(plane, strip.x, 60, strip.z);
    else if (dist > 120) control = autopilotTo(plane, strip.x, 22, strip.z);
    else control = { bank: clamp(-plane.x / 40, -1, 1), pitch: clamp((7.5 - plane.y) / 10, -1, 1), throttle: plane.speed > 34 ? -1 : -0.4 };
    const raised = world.step(control, SAMPLE);
    const events = raised | mission.checkRingCrossing(plane, previousZ);
    mission.update(plane, events, SAMPLE);
    if (mission.state.finished) break;
  }
  return { screen: SCREEN_PLAY, best: mission.state.score };
}
