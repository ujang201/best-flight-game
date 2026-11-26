// Keyboard and mouse: arrows/WASD bank and pitch, W/S or Shift/Ctrl work the
// throttle, the mouse steers by where it sits on the screen, Space/click
// confirms, P pauses, M mutes, R restarts, 1/2/3 pick a mission on the title.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

export function createInput(canvas) {
  const keys = new Set();
  const actions = { bits: 0 };
  const mouse = { x: 0.5, y: 0.5, active: false, down: false };
  const wheel = { delta: 0 };
  let missionKey = '';

  function keyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  function onKeyDown(event) {
    const key = keyName(event);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === ' ' || key === 'enter') actions.bits |= ACTION_CONFIRM;
    else if (key === 'p' || key === 'escape') actions.bits |= ACTION_PAUSE;
    else if (key === 'm') actions.bits |= ACTION_MUTE;
    else if (key === 'r') actions.bits |= ACTION_RESTART;
    else if (key === '1' || key === '2' || key === '3') missionKey = key;
  }

  function onKeyUp(event) {
    keys.delete(keyName(event));
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) / Math.max(1, rect.width);
    mouse.y = (event.clientY - rect.top) / Math.max(1, rect.height);
    mouse.active = true;
  }

  function onMouseDown(event) {
    mouse.down = true;
    onMouseMove(event);
    actions.bits |= ACTION_CONFIRM;
  }

  function onMouseUp() {
    mouse.down = false;
  }

  function onBlur() {
    keys.clear();
    mouse.down = false;
  }

  function onWheel(event) {
    event.preventDefault();
    // The wheel works the throttle too: up for more power, down for less.
    wheel.delta += event.deltaY < 0 ? 0.12 : -0.12;
    wheel.delta = Math.max(-1, Math.min(1, wheel.delta));
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('mouseup', onMouseUp);

  function takeActions() {
    const bits = actions.bits;
    actions.bits = 0;
    return bits;
  }

  function takeMissionKey() {
    const key = missionKey;
    missionKey = '';
    return key;
  }

  function has(key) {
    return keys.has(key);
  }

  // -1..1 bank, -1..1 pitch, -1..1 throttle change. Keyboard wins when it is
  // held; otherwise the mouse steers gently toward where it points.
  function control() {
    let bank = 0;
    let pitch = 0;
    let throttle = 0;
    if (has('arrowleft') || has('a')) bank -= 1;
    if (has('arrowright') || has('d')) bank += 1;
    if (has('arrowup') || has('w')) pitch += 1;
    if (has('arrowdown') || has('s')) pitch -= 1;
    // W/S double as throttle when combined with Shift/Ctrl is fiddly; instead
    // the dedicated keys work the lever and the arrows keep flying the plane.
    if (has('shift')) throttle += 1;
    if (has('control')) throttle -= 1;
    if (has('q')) throttle -= 1;
    if (has('e')) throttle += 1;
    if (wheel.delta !== 0) {
      throttle += wheel.delta;
      wheel.delta = 0;
    }
    if (bank === 0 && pitch === 0 && mouse.active && !mouse.down) {
      bank = (mouse.x - 0.5) * 2.4;
      pitch = (0.5 - mouse.y) * 1.6;
    }
    // Holding the mouse button pins the stick where it is: a calm way to fly.
    if (mouse.down && mouse.active) {
      bank = (mouse.x - 0.5) * 2.4;
      pitch = (0.5 - mouse.y) * 1.6;
    }
    const clamp = (value) => Math.max(-1, Math.min(1, value));
    return { bank: clamp(bank), pitch: clamp(pitch), throttle: clamp(throttle) };
  }

  return { takeActions, takeMissionKey, control };
}
