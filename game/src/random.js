// A small seeded random generator (mulberry32): the same seed always builds the
// same hills, trees, clouds and rings, so a screenshot scene replays exactly.
export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  function range(min, max) {
    return min + (max - min) * next();
  }
  function int(min, max) {
    return Math.floor(range(min, max + 1));
  }
  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }
  return { next, range, int, pick };
}
