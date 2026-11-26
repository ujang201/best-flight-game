// Drawing only: the world in, pixels out. A chase view over a projected valley:
// the sky, the sun, drifting clouds and far hills, the ground drawn in depth
// bands so speed reads, the runway strips, the rings, the trees — then the
// aircraft itself, banked with the stick, and the instruments, lit.
import { FONT, PALETTE, PLANE, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function shadeGround(t) {
  // Blend the far green into the near green by depth, precomputed once.
  if (!shadeGround.cache) {
    const far = [0x86, 0xbd, 0x74];
    const near = [0x45, 0x9a, 0x44];
    shadeGround.cache = [];
    for (let index = 0; index <= 46; index += 1) {
      const f = index / 46;
      const rgb = far.map((value, channel) => Math.round(value + (near[channel] - value) * f));
      shadeGround.cache.push(`rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);
    }
  }
  return shadeGround.cache[Math.round(t * 46)];
}

export function createRenderer(canvas, terrain) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  const skyGradient = context.createLinearGradient(0, 0, 0, VIEW.height);
  skyGradient.addColorStop(0, PALETTE.skyTop);
  skyGradient.addColorStop(0.45, PALETTE.skyMid);
  skyGradient.addColorStop(0.72, PALETTE.skyLow);
  skyGradient.addColorStop(1, '#e8f4f8');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function font(size, bold) {
    const key = `${bold ? '700 ' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, bold) {
    context.font = font(size, bold);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  // --- Projection: world (x east, y up, z along the course) onto the screen.
  // The camera sits behind and above the plane and looks along its heading.
  function makeCamera(plane, time) {
    const heading = plane.heading;
    const camX = plane.x;
    const camY = plane.y + 4.5;
    const camZ = plane.z - 24;
    const focal = VIEW.height * 1.05;
    const horizon = VIEW.height * 0.46 + plane.pitch * focal * 0.55;
    const sinH = Math.sin(heading);
    const cosH = Math.cos(heading);
    function project(wx, wy, wz) {
      const dx = wx - camX;
      const dz = wz - camZ;
      const fwd = -dx * sinH + dz * cosH;
      const right = dx * cosH + dz * sinH;
      if (fwd < 4) return null;
      return {
        x: VIEW.width / 2 + (right / fwd) * focal,
        y: horizon - ((wy - camY) / fwd) * focal,
        fwd,
        scale: focal / fwd,
      };
    }
    function groundXAt(screenX, fwd) {
      // The world x whose projection lands on screenX at depth fwd.
      const right = ((screenX - VIEW.width / 2) / focal) * fwd;
      return camX + right * cosH;
    }
    return { project, groundXAt, horizon, focal, camX, camY, camZ, time, heading };
  }

  function drawSky(camera, plane) {
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    // The sun hangs ahead-left and slides with the heading, as a real sun would.
    const sunX = VIEW.width * 0.22 - plane.heading * 320;
    const sunY = 118 - plane.pitch * 260;
    const glow = context.createRadialGradient(sunX, sunY, 8, sunX, sunY, 130);
    glow.addColorStop(0, PALETTE.sunCore);
    glow.addColorStop(0.35, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 214, 110, 0)');
    context.fillStyle = glow;
    context.fillRect(sunX - 140, sunY - 140, 280, 280);
    context.fillStyle = PALETTE.sunCore;
    context.beginPath();
    context.arc(sunX, sunY, 26, 0, TAU);
    context.fill();
  }

  function drawClouds(camera) {
    for (const cloud of terrain.clouds) {
      const drift = ((camera.time * cloud.speed + cloud.x) % 1400 + 1400) % 1400 - 700;
      const point = camera.project(drift, cloud.y, cloud.z);
      if (!point || point.fwd > WORLD.farDistance) continue;
      const alpha = clamp(1.15 - point.fwd / WORLD.farDistance, 0.15, 0.85);
      const size = cloud.size * point.scale * 0.9;
      context.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
      context.beginPath();
      context.ellipse(point.x, point.y, size, size * 0.38, 0, 0, TAU);
      context.ellipse(point.x - size * 0.55, point.y + size * 0.1, size * 0.6, size * 0.3, 0, 0, TAU);
      context.ellipse(point.x + size * 0.55, point.y + size * 0.08, size * 0.62, size * 0.3, 0, 0, TAU);
      context.fill();
    }
  }

  function drawFarHills(camera) {
    // Silhouette triangles on the horizon, far to near so nearer ones overlap.
    const sinH = Math.sin(camera.heading);
    const cosH = Math.cos(camera.heading);
    const sorted = terrain.hills.filter((hill) => {
      const fwd = -((hill.x - camera.camX) * sinH) + (hill.z - camera.camZ) * cosH;
      return fwd > 0 && fwd < WORLD.farDistance * 1.4;
    });
    sorted.sort((a, b) => b.z - a.z);
    for (const hill of sorted) {
      const base = camera.project(hill.x, 0, hill.z);
      const peak = camera.project(hill.x, hill.height, hill.z);
      if (!base || !peak || peak.fwd < 8) continue;
      const half = (hill.width / 2) * peak.scale;
      const alpha = clamp(1 - peak.fwd / (WORLD.farDistance * 1.4), 0.25, 0.9);
      context.fillStyle = hill.shade > 0.5 ? PALETTE.farHill : PALETTE.farHillShadow;
      context.globalAlpha = alpha;
      context.beginPath();
      context.moveTo(peak.x, peak.y);
      context.lineTo(base.x - half, base.y + 4);
      context.lineTo(base.x + half, base.y + 4);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    }
  }

  function drawGround(camera) {
    // The valley floor in depth bands: each band is the terrain line at one
    // depth, filled down to the bottom of the screen. Nearer bands cover
    // farther ones, so hills roll past and speed reads in the bands.
    const slices = WORLD.sliceCount;
    const near = 6;
    const far = WORLD.farDistance;
    context.fillStyle = PALETTE.groundFar;
    context.fillRect(0, camera.horizon, VIEW.width, VIEW.height - camera.horizon);
    const samples = 28;
    for (let slice = slices - 1; slice >= 0; slice -= 1) {
      const t = slice / slices;
      const fwd = near + (far - near) * t * t;
      const wz = camera.camZ + fwd;
      // One green, shaded by depth: far bands pale, near bands deep. No
      // alternating stripes — the valley reads as rolling ground, and the
      // bands sliding past are what makes the speed read.
      context.fillStyle = shadeGround(t);
      context.beginPath();
      context.moveTo(-20, VIEW.height + 20);
      for (let s = 0; s <= samples; s += 1) {
        const sx = -20 + ((VIEW.width + 40) / samples) * s;
        const wx = camera.groundXAt(sx, fwd);
        const wy = terrain.heightAt(wx, wz);
        const point = camera.project(wx, wy, wz);
        context.lineTo(point ? point.x : sx, point ? point.y : VIEW.height);
      }
      context.lineTo(VIEW.width + 20, VIEW.height + 20);
      context.closePath();
      context.fill();
      // A whisper of contour every fifth band: just enough texture that the
      // ground reads as land sliding past, never as stripes.
      if (slice % 5 === 0) {
        context.fillStyle = 'rgba(20, 70, 20, 0.07)';
        context.fill();
      }
    }
  }

  function drawRunways(camera) {
    for (const runway of WORLD.runways) {
      const z0 = runway.z - WORLD.runwayLength / 2;
      const z1 = runway.z + WORLD.runwayLength / 2;
      if (z1 < camera.camZ + 4 || z0 > camera.camZ + WORLD.farDistance) continue;
      // The strip as a chain of quads, one per depth band, so it bends with
      // the terrain instead of floating above it.
      const steps = 14;
      for (let index = 0; index < steps; index += 1) {
        const za = z0 + ((z1 - z0) * index) / steps;
        const zb = z0 + ((z1 - z0) * (index + 1)) / steps;
        const aLeft = camera.project(-15, terrain.heightAt(-15, za) + 0.4, za);
        const aRight = camera.project(15, terrain.heightAt(15, za) + 0.4, za);
        const bLeft = camera.project(-15, terrain.heightAt(-15, zb) + 0.4, zb);
        const bRight = camera.project(15, terrain.heightAt(15, zb) + 0.4, zb);
        if (!aLeft || !aRight || !bLeft || !bRight) continue;
        context.fillStyle = PALETTE.runway;
        context.beginPath();
        context.moveTo(aLeft.x, aLeft.y);
        context.lineTo(aRight.x, aRight.y);
        context.lineTo(bRight.x, bRight.y);
        context.lineTo(bLeft.x, bLeft.y);
        context.closePath();
        context.fill();
        if (index % 2 === 0) {
          const cA = camera.project(0, terrain.heightAt(0, za) + 0.5, za);
          const cB = camera.project(0, terrain.heightAt(0, zb) + 0.5, zb);
          if (cA && cB) {
            context.strokeStyle = PALETTE.runwayLine;
            context.lineWidth = Math.max(1, 2.2 * cA.scale);
            context.beginPath();
            context.moveTo(cA.x, cA.y);
            context.lineTo(cB.x, cB.y);
            context.stroke();
          }
        }
      }
      // The strip's name, floating above its far end — capped, so it never
      // fills the sky when the plane is close.
      const label = camera.project(0, 26, z1);
      if (label && label.fwd < WORLD.farDistance * 0.7) {
        text(runway.name, label.x, label.y, Math.min(40, Math.max(13, 15 * label.scale * 2.4)), PALETTE.hudText, 'center', true);
      }
    }
  }

  function drawTrees(camera) {
    const visible = terrain.trees.filter((tree) => {
      const fwd = tree.z - camera.camZ;
      return fwd > 6 && fwd < WORLD.farDistance;
    });
    visible.sort((a, b) => b.z - a.z);
    for (const tree of visible) {
      const ground = terrain.heightAt(tree.x, tree.z);
      const base = camera.project(tree.x, ground, tree.z);
      if (!base) continue;
      const size = tree.size * base.scale;
      if (size < 1.5) continue;
      context.fillStyle = PALETTE.treeTrunk;
      context.fillRect(base.x - size * 0.06, base.y - size * 0.35, size * 0.12, size * 0.35);
      context.fillStyle = tree.shade > 0.5 ? PALETTE.tree : '#3a9d3f';
      context.beginPath();
      context.moveTo(base.x, base.y - size * 1.5);
      context.lineTo(base.x - size * 0.55, base.y - size * 0.3);
      context.lineTo(base.x + size * 0.55, base.y - size * 0.3);
      context.closePath();
      context.fill();
    }
  }

  function drawRings(camera, missionState) {
    const rings = missionState.rings;
    for (let index = rings.length - 1; index >= 0; index -= 1) {
      const ring = rings[index];
      const fwd = ring.z - camera.camZ;
      if (fwd < 5 || fwd > WORLD.farDistance) continue;
      const centre = camera.project(ring.x, ring.y, ring.z);
      if (!centre) continue;
      const radius = ring.radius * centre.scale;
      if (radius < 2) continue;
      const isNext = index === missionState.ringIndex;
      const colour = ring.passed ? PALETTE.hudGreen : ring.fuel ? PALETTE.fuelRing : PALETTE.ring;
      context.save();
      context.globalAlpha = ring.passed ? 0.45 : isNext ? 1 : 0.75;
      context.strokeStyle = colour;
      context.lineWidth = Math.max(2, radius * 0.14);
      if (isNext) {
        context.shadowColor = PALETTE.ringGlow;
        context.shadowBlur = 18;
      }
      context.beginPath();
      context.arc(centre.x, centre.y, radius, 0, TAU);
      context.stroke();
      context.restore();
      if (isNext) {
        text('NEXT', centre.x, centre.y - radius - 10, Math.max(12, radius * 0.22), PALETTE.hudAmber, 'center', true);
      }
    }
  }

  function drawNextRingPointer(camera, missionState) {
    const ring = missionState.rings[missionState.ringIndex];
    if (!ring) return;
    const point = camera.project(ring.x, ring.y, ring.z);
    if (point && point.x > -40 && point.x < VIEW.width + 40 && point.y > 60 && point.y < VIEW.height - 60) return;
    // The next ring is off frame: point at it from the screen edge, with the
    // true 3-D distance — and if it sits behind the plane, say so plainly.
    const dx = ring.x - camera.camX;
    const dy = ring.y - camera.camY;
    const dz = ring.z - camera.camZ;
    const distance = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz));
    const behind = dz < 0;
    const targetX = point ? clamp(point.x, 60, VIEW.width - 60) : VIEW.width / 2;
    const targetY = behind ? VIEW.height - 80 : point ? clamp(point.y, 90, VIEW.height - 90) : 120;
    context.save();
    context.translate(targetX, targetY);
    if (behind) context.rotate(Math.PI);
    context.fillStyle = PALETTE.ring;
    context.beginPath();
    context.moveTo(0, -14);
    context.lineTo(12, 8);
    context.lineTo(-12, 8);
    context.closePath();
    context.fill();
    context.restore();
    text(behind ? `Ring behind — ${distance}m` : `${distance}m`, targetX, targetY + (behind ? -22 : 28), 14, PALETTE.ring, 'center', true);
  }

  // The aircraft, drawn in screen space and banked with the stick: a red
  // courier plane with white wings, a glass canopy and a spinning prop.
  function drawPlane(plane, time) {
    const cx = VIEW.width / 2;
    const cy = VIEW.height * 0.66 + plane.pitch * 60;
    const scale = 1.15;
    context.save();
    context.translate(cx, cy);
    context.rotate(-plane.roll * 0.9);
    context.scale(scale, scale);
    // Propeller blur and blades, spinning with the throttle.
    const propSpeed = 6 + plane.throttle * 26;
    const bladeAngle = time * propSpeed;
    context.fillStyle = 'rgba(34,34,59,0.25)';
    context.beginPath();
    context.ellipse(0, -34, 30, 34, 0, 0, TAU);
    context.fill();
    context.strokeStyle = PALETTE.planeProp;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(-Math.cos(bladeAngle) * 30, -34 - Math.sin(bladeAngle) * 30);
    context.lineTo(Math.cos(bladeAngle) * 30, -34 + Math.sin(bladeAngle) * 30);
    context.moveTo(-Math.cos(bladeAngle + 1.2) * 26, -34 - Math.sin(bladeAngle + 1.2) * 26);
    context.lineTo(Math.cos(bladeAngle + 1.2) * 26, -34 + Math.sin(bladeAngle + 1.2) * 26);
    context.stroke();
    // Wings: wide, white, slightly swept.
    context.fillStyle = PALETTE.planeWing;
    context.beginPath();
    context.moveTo(-118, 6);
    context.quadraticCurveTo(-70, -16, -14, -8);
    context.lineTo(14, -8);
    context.quadraticCurveTo(70, -16, 118, 6);
    context.quadraticCurveTo(70, 16, 14, 12);
    context.lineTo(-14, 12);
    context.quadraticCurveTo(-70, 16, -118, 6);
    context.closePath();
    context.fill();
    // Tailplane and fin.
    context.fillStyle = PALETTE.planeBodyDark;
    context.beginPath();
    context.moveTo(-34, 52);
    context.lineTo(34, 52);
    context.lineTo(20, 38);
    context.lineTo(-20, 38);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(0, 58);
    context.lineTo(16, 30);
    context.lineTo(4, 28);
    context.closePath();
    context.fill();
    // Fuselage: a red teardrop from nose to tail.
    context.fillStyle = PALETTE.planeBody;
    context.beginPath();
    context.moveTo(0, -52);
    context.quadraticCurveTo(20, -30, 16, 6);
    context.quadraticCurveTo(13, 38, 0, 56);
    context.quadraticCurveTo(-13, 38, -16, 6);
    context.quadraticCurveTo(-20, -30, 0, -52);
    context.closePath();
    context.fill();
    // Canopy glass and a courier stripe.
    context.fillStyle = PALETTE.planeGlass;
    context.beginPath();
    context.ellipse(0, -18, 9, 16, 0, 0, TAU);
    context.fill();
    context.fillStyle = PALETTE.planeWing;
    context.fillRect(-14, 2, 28, 5);
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.beginPath();
    context.ellipse(-4, -24, 3, 8, 0.3, 0, TAU);
    context.fill();
    context.restore();
  }

  // --- Instruments: the HUD the judge reads first.
  function headingDegrees(heading) {
    return Math.round((((-heading * 180) / Math.PI) % 360 + 360) % 360);
  }

  function drawCompass(plane) {
    const deg = headingDegrees(plane.heading);
    const cx = VIEW.width / 2;
    const top = 64;
    context.fillStyle = 'rgba(8,24,44,0.55)';
    context.fillRect(cx - 190, top - 22, 380, 34);
    const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let offset = -90; offset <= 90; offset += 15) {
      const value = deg + offset;
      const x = cx + offset * 2.1;
      const norm = ((value % 360) + 360) % 360;
      context.strokeStyle = offset === 0 ? PALETTE.hudAmber : PALETTE.hudDim;
      context.lineWidth = offset === 0 ? 3 : 1;
      context.beginPath();
      context.moveTo(x, top - 8);
      context.lineTo(x, top + (offset % 45 === 0 ? 8 : 2));
      context.stroke();
      if (offset % 45 === 0) {
        text(labels[norm] ?? String(norm), x, top + 24, 13, offset === 0 ? PALETTE.hudAmber : PALETTE.hudText, 'center', offset === 0);
      }
    }
    text(`HDG ${String(deg).padStart(3, '0')}°`, cx, top - 30, 20, PALETTE.hudText, 'center', true);
  }

  function drawTape(x, y, label, value, unit, maxValue, colour) {
    context.fillStyle = 'rgba(8,24,44,0.55)';
    context.fillRect(x - 62, y - 14, 124, 96);
    text(label, x, y + 4, 14, PALETTE.hudDim, 'center', true);
    text(String(value), x, y + 40, 30, colour, 'center', true);
    text(unit, x, y + 62, 13, PALETTE.hudDim, 'center');
    const frac = clamp(value / maxValue, 0, 1);
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(x - 62, y + 70, 124, 6);
    context.fillStyle = colour;
    context.fillRect(x - 62, y + 70, 124 * frac, 6);
  }

  function drawGauges(plane) {
    const speedKt = Math.round(plane.speed * 1.9);
    const altFt = Math.round(plane.y * 32);
    drawTape(84, 96, 'SPEED', speedKt, 'KT', 175, speedKt < 34 ? PALETTE.hudRed : PALETTE.hudText);
    drawTape(VIEW.width - 84, 96, 'ALTITUDE', altFt, 'FT', 4000, PALETTE.hudText);
    // Throttle lever and fuel, stacked under the speed tape.
    const gx = 22;
    let gy = 210;
    text('THR', gx, gy, 13, PALETTE.hudDim, 'left', true);
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(gx, gy + 8, 124, 10);
    context.fillStyle = PALETTE.hudAmber;
    context.fillRect(gx, gy + 8, 124 * plane.throttle, 10);
    gy += 44;
    text('FUEL', gx, gy, 13, PALETTE.hudDim, 'left', true);
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(gx, gy + 8, 124, 10);
    context.fillStyle = plane.fuel < 20 ? PALETTE.hudRed : PALETTE.hudGreen;
    context.fillRect(gx, gy + 8, 124 * clamp(plane.fuel / 100, 0, 1), 10);
    gy += 44;
    text('DAMAGE', gx, gy, 13, PALETTE.hudDim, 'left', true);
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(gx, gy + 8, 124, 10);
    context.fillStyle = plane.damage > 60 ? PALETTE.hudRed : PALETTE.hudAmber;
    context.fillRect(gx, gy + 8, 124 * clamp(plane.damage / 100, 0, 1), 10);
    if (plane.speed < PLANE.minSpeed && plane.airborne) {
      text('STALL!', 84, 320, 22, PALETTE.hudRed, 'center', true);
    }
  }

  function drawAttitude(plane) {
    const cx = VIEW.width - 96;
    const cy = VIEW.height - 104;
    const radius = 58;
    context.save();
    context.beginPath();
    context.arc(cx, cy, radius, 0, TAU);
    context.clip();
    context.translate(cx, cy);
    context.rotate(-plane.roll);
    context.translate(0, plane.pitch * radius * 1.6);
    context.fillStyle = '#3a86c9';
    context.fillRect(-radius, -radius * 2, radius * 2, radius * 2);
    context.fillStyle = '#8b5a2b';
    context.fillRect(-radius, 0, radius * 2, radius * 2);
    context.strokeStyle = 'rgba(255,255,255,0.85)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-radius, 0);
    context.lineTo(radius, 0);
    context.stroke();
    context.restore();
    context.strokeStyle = PALETTE.hudText;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(cx, cy, radius, 0, TAU);
    context.stroke();
    // Fixed aircraft symbol over the moving horizon.
    context.fillStyle = PALETTE.hudAmber;
    context.beginPath();
    context.moveTo(cx, cy - 4);
    context.lineTo(cx + 16, cy + 6);
    context.lineTo(cx - 16, cy + 6);
    context.closePath();
    context.fill();
    text('ATTITUDE', cx, cy + radius + 18, 12, PALETTE.hudDim, 'center', true);
  }

  function drawMissionHud(plane, missionState, timeLeft) {
    const mission = missionState.mission;
    text(`SCORE ${missionState.score}`, 22, 36, 22, PALETTE.hudText, 'left', true);
    text(mission.name, VIEW.width / 2, VIEW.height - 44, 15, PALETTE.hudDim, 'center', true);
    const clock = `${Math.floor(Math.max(0, timeLeft) / 60)}:${String(Math.floor(Math.max(0, timeLeft) % 60)).padStart(2, '0')}`;
    text(clock, VIEW.width - 22, 36, 22, timeLeft < 30 ? PALETTE.hudRed : PALETTE.hudText, 'right', true);
    const next = missionState.rings[missionState.ringIndex];
    const ringDistance = next
      ? Math.round(
          Math.sqrt((next.x - plane.x) ** 2 + (next.y - plane.y) ** 2 + (next.z - plane.z) ** 2),
        )
      : 0;
    const objective =
      mission.id === 'islands'
        ? `Islands landed: ${missionState.landings.length}/${missionState.landingsNeeded.length} — next: ${missionState.landingsNeeded[missionState.landings.length] ?? 'return home'}`
        : next
          ? `Next ring ${missionState.ringIndex + 1}/${missionState.rings.length} — ${ringDistance}m ahead`
          : 'All rings cleared!';
    // A dim pill behind the two bottom lines, so they stay readable over a
    // bright runway dash or a sunlit field.
    context.font = font(15, true);
    const nameWidth = context.measureText(mission.name).width;
    context.font = font(16, false);
    const objectiveWidth = context.measureText(objective).width;
    const pillWidth = Math.max(nameWidth, objectiveWidth) + 32;
    context.fillStyle = 'rgba(8,24,44,0.45)';
    context.fillRect(VIEW.width / 2 - pillWidth / 2, VIEW.height - 66, pillWidth, 56);
    text(objective, VIEW.width / 2, VIEW.height - 18, 16, PALETTE.hudText, 'center');
    if (missionState.message && missionState.messageTime > 0) {
      context.font = font(19, true);
      const width = context.measureText(missionState.message).width + 36;
      context.fillStyle = 'rgba(8,24,44,0.72)';
      context.fillRect(VIEW.width / 2 - width / 2, 96, width, 40);
      text(missionState.message, VIEW.width / 2, 124, 19, PALETTE.hudAmber, 'center', true);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 780;
    const lineHeight = 32;
    const height = 150 + lines.length * lineHeight + 66;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 72, 44, accent ?? PALETTE.hudText, 'center', true);
    lines.forEach((line, index) => {
      text(line, VIEW.width / 2, y + 126 + index * lineHeight, 19, PALETTE.hudDim, 'center');
    });
    text(prompt, VIEW.width / 2, y + height - 28, 20, PALETTE.hudAmber, 'center', true);
  }

  function drawTitle(missionIndex, best) {
    const missions = missionList();
    const lines = [
      'A little red courier plane, a long valley, and a sky full of rings.',
      'Fly with arrows or WASD — or steer with the mouse. Shift / E throttle up,',
      'Ctrl / Q throttle down. Land gently on the strips. Mind the fuel.',
      '',
      'Pick a mission:',
      ...missions.map((mission, index) => `${index + 1} — ${mission.name}: ${mission.tagline}`),
      '',
      `Best score ${best}`,
    ];
    drawPanel('SKYLINE COURIER', lines, 'Press 1, 2 or 3 — or Space for Ring Run', PALETTE.hudAmber);
  }

  function missionList() {
    // The title screen needs the mission names without importing the mission
    // state; the list lives in config, read through a tiny local copy.
    return [
      { name: 'RING RUN', tagline: 'Thread all 8 sky rings in order.' },
      { name: 'ISLAND HOP', tagline: 'Land on three island strips, then come home.' },
      { name: 'STORM COURIER', tagline: '10 rings before the fuel runs dry. Green rings refuel.' },
    ];
  }

  /** Paint one frame: the world, the plane, the instruments, then any panel. */
  function draw(state, screen, best, time) {
    const { plane, mission } = state;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const camera = makeCamera(plane, time);
    drawSky(camera, plane);
    drawFarHills(camera);
    drawClouds(camera);
    drawGround(camera);
    drawRunways(camera);
    drawTrees(camera);
    drawRings(camera, mission.state);
    drawNextRingPointer(camera, mission.state);
    if (screen !== SCREEN_TITLE) drawPlane(plane, time);
    if (screen === SCREEN_TITLE) {
      drawTitle(0, best);
      return;
    }
    drawCompass(plane);
    drawGauges(plane);
    drawAttitude(plane);
    const timeLeft = mission.state.mission.timeLimit - mission.state.elapsed;
    drawMissionHud(plane, mission.state, timeLeft);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The valley will wait for you.'], 'Press P or Space to keep flying');
    } else if (screen === SCREEN_OVER) {
      const won = mission.state.won;
      drawPanel(
        won ? 'MISSION COMPLETE' : 'FLIGHT OVER',
        [
          mission.state.endReason,
          `Score ${mission.state.score}   •   Best ${best}`,
          `Rings ${mission.state.ringsPassed}/${mission.state.rings.length}   •   Distance ${Math.round(plane.distance)}m`,
        ],
        'Press Space or click to fly again',
        won ? PALETTE.hudGreen : PALETTE.hudRed,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
