// The flight model: throttle, bank, pitch and the air's answer. Arcade at heart
// — the plane always wants to fly — but speed, lift and the ground still matter:
// fly too slow and she sinks, bank hard and the nose drops, land too fast and
// the gear complains.
import { PLANE, STEP, WORLD } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;
export const EVENT_GRAZE = 8;
export const EVENT_FUEL_EMPTY = 16;
export const EVENT_TIMEOUT = 32;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function createAircraft(terrain) {
  const state = {
    x: 0,
    y: WORLD.startAltitude,
    z: -WORLD.runwayLength / 2 - 40,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: WORLD.startSpeed,
    throttle: 0.55,
    fuel: 100,
    damage: 0,
    time: 0,
    distance: 0,
    airborne: true,
    onGround: false,
    landedRunway: null,
  };

  function reset(mission) {
    state.x = 0;
    state.y = WORLD.startAltitude;
    state.z = -WORLD.runwayLength / 2 - 40;
    state.heading = 0;
    state.pitch = 0;
    state.roll = 0;
    state.speed = WORLD.startSpeed;
    state.throttle = 0.55;
    state.fuel = mission ? mission.fuel : 100;
    state.damage = 0;
    state.time = 0;
    state.distance = 0;
    state.airborne = true;
    state.onGround = false;
    state.landedRunway = null;
  }

  // `control` carries -1..1 bank, -1..1 pitch (up is positive), -1..1 throttle
  // change, each already smoothed by the input layer.
  function step(control, dt) {
    let events = EVENT_NONE;
    state.time += dt;

    // Throttle: the lever moves, the engine answers a moment later.
    state.throttle = clamp(state.throttle + control.throttle * dt * 0.9, 0, 1);
    const targetSpeed = state.throttle * PLANE.maxSpeed;
    const pull = state.throttle > 0.02 ? PLANE.accel : PLANE.accel * 0.4;
    state.speed += clamp(targetSpeed - state.speed, -pull * dt, pull * dt);
    state.speed -= state.speed * PLANE.drag * 0.12 * dt;

    // Bank into the turn; the heading follows the bank, tighter when fast.
    const targetRoll = control.bank * PLANE.maxBank;
    state.roll += clamp(targetRoll - state.roll, -PLANE.rollRate * dt, PLANE.rollRate * dt);
    state.heading += -state.roll * PLANE.turnRate * dt * clamp(state.speed / PLANE.cruiseSpeed, 0.3, 1.4);

    // Pitch: pull up to climb, push down to dive; a hard bank steals lift.
    const targetPitch = control.pitch * PLANE.maxPitch;
    state.pitch += clamp(targetPitch - state.pitch, -PLANE.pitchRate * dt, PLANE.pitchRate * dt);
    const liftLoss = Math.abs(state.roll) * 0.35;
    let climb = Math.sin(state.pitch - liftLoss * 0.4) * state.speed;
    if (state.speed < PLANE.minSpeed) {
      // Below flying speed the wings give up: the nose drops and she sinks.
      climb -= (PLANE.minSpeed - state.speed) * PLANE.stallSink * 0.12;
    }
    // Rolling on a strip, she stays on her wheels until she is fast enough
    // to fly; once airborne, clear the landed flags behind her.
    if (state.onGround && state.speed < PLANE.takeoffSpeed) climb = Math.min(climb, 0);
    state.y += climb * dt;
    if (state.y > terrain.heightAt(state.x, state.z) + 3) {
      state.onGround = false;
      state.airborne = true;
      state.landedRunway = null;
    }

    // Forward motion, steered by the heading.
    const forward = state.speed * dt;
    state.z += Math.cos(state.heading) * forward;
    state.x += -Math.sin(state.heading) * forward;
    state.distance += forward;

    // Stay inside the valley: the hills push a wandering pilot back.
    if (Math.abs(state.x) > WORLD.halfWidth) {
      state.x = Math.sign(state.x) * WORLD.halfWidth;
      state.heading *= 0.9;
    }
    if (state.z < -WORLD.runwayLength) state.z = -WORLD.runwayLength;

    // Fuel: the engine drinks in proportion to the throttle.
    if (state.throttle > 0.02 && state.fuel > 0) {
      state.fuel = Math.max(0, state.fuel - PLANE.fuelBurn * state.throttle * dt);
      if (state.fuel === 0) events |= EVENT_FUEL_EMPTY;
    }
    if (state.fuel === 0) state.throttle = Math.max(0, state.throttle - dt * 0.5);

    // The ground: a runway forgives a gentle touchdown, anything else does not.
    const ground = terrain.heightAt(state.x, state.z);
    if (state.y <= ground + 1.2) {
      const runway = terrain.runwayAt(state.z);
      const aligned = runway !== null && Math.abs(state.x) < 26 && Math.abs(state.heading) < 0.35;
      const gentle = state.speed < PLANE.hardLandingSpeed && Math.abs(state.pitch) < 0.16;
      state.y = ground + 1.2;
      if (runway !== null && aligned && gentle) {
        state.onGround = true;
        state.airborne = false;
        state.landedRunway = runway;
        state.speed = Math.max(0, state.speed - 30 * dt);
        events |= EVENT_LANDED;
      } else if (state.speed < 12 && Math.abs(state.pitch) < 0.2 && terrain.isRunway(state.x, state.z)) {
        // Rolling out on the strip at walking pace is a landing too.
        state.onGround = true;
        state.airborne = false;
        state.landedRunway = runway;
        events |= EVENT_LANDED;
      } else if (state.speed < 26 && state.y - ground < 3) {
        // A belly graze: sparks, damage, and a bounce back into the air.
        state.damage = Math.min(100, state.damage + PLANE.damagePerGraze);
        state.y = ground + 6;
        state.speed *= 0.82;
        state.pitch = 0.12;
        events |= EVENT_GRAZE;
      } else {
        events |= EVENT_CRASHED;
      }
    }
    if (state.damage >= 100) events |= EVENT_CRASHED;
    return events;
  }

  return { state, reset, step };
}
