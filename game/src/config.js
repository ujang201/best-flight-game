// Skyline Courier — shared constants: the world, the aircraft, the HUD.
// One file, one job: every number the rest of the game agrees on lives here.
export const STEP = 1 / 60;
export const BEST_KEY = 'skyline-courier-best';

export const VIEW = { width: 1280, height: 800 };
export const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

export const PALETTE = {
  skyTop: '#1d4e89',
  skyMid: '#5fa8d3',
  skyLow: '#cfe8f5',
  sunCore: '#fff3c4',
  sunGlow: '#ffd66e',
  farHill: '#7d9bb8',
  farHillShadow: '#6b8aa8',
  groundNear: '#4f9e4d',
  groundMid: '#5cb85f',
  groundFar: '#79b56e',
  fieldGreen: '#6fbf5a',
  fieldDark: '#5aa84e',
  runway: '#3a3f46',
  runwayLine: '#f5f0dc',
  ring: '#ffb703',
  ringGlow: '#ffdf80',
  fuelRing: '#2ec4b6',
  tree: '#2f7d32',
  treeTrunk: '#6d4c41',
  cloud: '#ffffff',
  planeBody: '#e63946',
  planeBodyDark: '#b02330',
  planeWing: '#f1faee',
  planeGlass: '#a8dadc',
  planeProp: '#22223b',
  hudText: '#eaf6ff',
  hudDim: '#9fc6dd',
  hudAmber: '#ffb703',
  hudRed: '#ef476f',
  hudGreen: '#06d6a0',
  panel: 'rgba(8, 24, 44, 0.86)',
  panelEdge: '#2a6f97',
  backdrop: '#0b1e33',
};

// Flight model numbers (arcade, but honest: throttle and turn discipline matter).
export const PLANE = {
  maxSpeed: 92, // world units per second at full throttle
  cruiseSpeed: 55,
  minSpeed: 18, // below this the wings stop flying and the nose drops
  stallSink: 14,
  climbRate: 26,
  rollRate: 2.6, // radians per second toward the banked target
  maxBank: 0.9, // radians of bank at full stick
  turnRate: 0.85, // heading change per second at full bank
  pitchRate: 1.4,
  maxPitch: 0.42,
  accel: 26, // speed gained per second toward the throttle's target
  drag: 0.4,
  fuelBurn: 0.55, // fuel units per second at full throttle
  fuelCapacity: 100,
  takeoffSpeed: 26, // rolling below this, the wheels stay on the strip
  damagePerGraze: 18,
  hardLandingSpeed: 46,
};

export const WORLD = {
  // The strip the game flies over: wide enough to get lost in, bounded by hills.
  halfWidth: 420,
  farDistance: 460,
  sliceCount: 46,
  runwayX: 0,
  runwayLength: 260,
  // Runway centres along the course (z). The first is home base; the others are island hops.
  runways: [
    { z: 0, name: 'MERIDIAN FIELD' },
    { z: 2400, name: 'CORAL ISLE' },
    { z: 4800, name: 'PINE RIDGE' },
    { z: 7200, name: 'SUMMIT STRIP' },
  ],
  courseLength: 7600,
  startAltitude: 46,
  startSpeed: 48,
  cloudCount: 26,
  treeCount: 170,
  hillCount: 60,
};

// What each mission asks of the pilot.
export const MISSIONS = [
  {
    id: 'rings',
    name: 'RING RUN',
    tagline: 'Thread all 8 sky rings in order. Clean flying beats raw speed.',
    rings: 8,
    fuel: 100,
    timeLimit: 240,
  },
  {
    id: 'islands',
    name: 'ISLAND HOP',
    tagline: 'Land on all three island strips, then come home. Gentle touchdowns only.',
    rings: 0,
    fuel: 100,
    timeLimit: 420,
  },
  {
    id: 'courier',
    name: 'STORM COURIER',
    tagline: 'Deliver the mail through 10 rings before the fuel runs dry. Green rings refuel.',
    rings: 10,
    fuel: 70,
    timeLimit: 300,
  },
];

export const RING_RADIUS = 16;
export const RING_SCORE = 250;
export const LANDING_SCORE = 500;
export const FUEL_RING_BONUS = 30;
export const TIME_BONUS_PER_SECOND = 10;
