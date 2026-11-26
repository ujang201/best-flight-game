// The world the plane flies over: rolling heightfield, mountain silhouettes,
// trees, drifting clouds and the runway strips. Everything is placed from the
// seed, so the same seed builds the same valley every time.
import { WORLD } from './config.js';

// A smooth 1-D value-noise line: hills rise and fall along x, and a second line
// along z makes the valley floor undulate as the course runs forward.
function noiseLine(random, points) {
  const values = [];
  for (let index = 0; index < points; index += 1) values.push(random.range(0, 1));
  return function at(t) {
    const scaled = ((t % 1) + 1) % 1 * (points - 1);
    const low = Math.floor(scaled);
    const high = Math.min(points - 1, low + 1);
    const frac = scaled - low;
    const smooth = frac * frac * (3 - 2 * frac);
    return values[low] + (values[high] - values[low]) * smooth;
  };
}

export function createTerrain(seedRandom) {
  const random = seedRandom;
  const across = noiseLine(random, 9);
  const along = noiseLine(random, 17);
  const ridge = noiseLine(random, 7);

  // Rolling hills far off to each side, drawn as silhouettes on the horizon.
  const hills = [];
  for (let index = 0; index < WORLD.hillCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    hills.push({
      x: side * random.range(480, 1500),
      z: random.range(-200, WORLD.courseLength + 600),
      width: random.range(220, 520),
      height: random.range(60, 210),
      shade: random.next(),
    });
  }

  // Trees scattered beside the course, never on a runway strip.
  const trees = [];
  for (let index = 0; index < WORLD.treeCount; index += 1) {
    const x = random.range(-WORLD.halfWidth, WORLD.halfWidth);
    const z = random.range(-100, WORLD.courseLength + 300);
    let onStrip = false;
    for (const runway of WORLD.runways) {
      if (Math.abs(z - runway.z) < WORLD.runwayLength / 2 + 30 && Math.abs(x) < 46) onStrip = true;
    }
    if (onStrip) continue;
    trees.push({ x, z, size: random.range(7, 15), shade: random.next() });
  }

  // Clouds drift slowly above the valley; their x wanders with time in the renderer.
  const clouds = [];
  for (let index = 0; index < WORLD.cloudCount; index += 1) {
    clouds.push({
      x: random.range(-700, 700),
      y: random.range(120, 220),
      z: random.range(-200, WORLD.courseLength + 400),
      size: random.range(34, 90),
      speed: random.range(1.5, 4),
    });
  }

  // The valley floor: gentle swells across the course, rising toward the edges
  // so the plane stays inside a bowl, plus a slow rise along the course. The
  // ground is flattened near a runway strip so the strip sits level.
  function heightAt(x, z) {
    const edge = Math.min(1, Math.abs(x) / WORLD.halfWidth);
    const bowl = edge * edge * 34;
    const swell = (across(x / 420 + 0.37) - 0.5) * 26 + (along(z / 900 + 0.11) - 0.5) * 18;
    const ridgeLift = (ridge(z / 1500 + 0.5) - 0.5) * 10;
    let height = Math.max(0, 6 + bowl + swell + ridgeLift);
    const runway = runwayAt(z);
    if (runway !== null && Math.abs(x) < 46) {
      const blend = 1 - Math.min(1, Math.abs(x) / 46);
      height = height * (1 - blend) + 6 * blend;
    }
    return height;
  }

  // A runway is flat ground: the strip and its shoulders sit at height 6.
  function isRunway(x, z) {
    if (Math.abs(x) > 34) return false;
    for (const runway of WORLD.runways) {
      if (Math.abs(z - runway.z) <= WORLD.runwayLength / 2) return true;
    }
    return false;
  }

  function runwayAt(z) {
    for (const runway of WORLD.runways) {
      if (Math.abs(z - runway.z) <= WORLD.runwayLength / 2) return runway;
    }
    return null;
  }

  return { hills, trees, clouds, heightAt, isRunway, runwayAt };
}
