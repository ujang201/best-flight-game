// Sound, synthesized live with WebAudio: an engine hum that follows the
// throttle, wind that rises with speed, a chime for a ring, a soft thud for a
// touchdown. No audio files, no network — and nothing breaks if audio is off.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();

      // Looping filtered noise for the wind: a buffer of static through a
      // bandpass, its gain tied to airspeed.
      const length = context.sampleRate * 2;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
      windSource = context.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      const windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windGain = context.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(context.destination);
      windSource.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  // Called every frame while flying: the hum tracks throttle, the wind speed
  // — and the wind's pitch rises with airspeed, as it does in an open cockpit.
  function update(throttle, speed, flying) {
    if (!started || !context) return;
    const targetEngine = muted || !flying ? 0 : 0.03 + throttle * 0.05;
    const targetWind = muted || !flying ? 0 : Math.min(0.09, (speed / 92) * 0.09);
    engineGain.gain.setTargetAtTime(targetEngine, context.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(58 + throttle * 95, context.currentTime, 0.1);
    windGain.gain.setTargetAtTime(targetWind, context.currentTime, 0.15);
    windSource.playbackRate.setTargetAtTime(0.7 + (speed / 92) * 0.9, context.currentTime, 0.2);
  }

  function blip(frequency, duration, type, volume) {
    if (!started || !context || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + duration);
    } catch {
      // A missed blip is never worth crashing the game over.
    }
  }

  function ringChime() {
    blip(880, 0.35, 'sine', 0.16);
    setTimeout(() => blip(1318, 0.4, 'sine', 0.14), 90);
  }

  function thud() {
    blip(90, 0.25, 'triangle', 0.25);
  }

  function crash() {
    blip(70, 0.7, 'sawtooth', 0.22);
    setTimeout(() => blip(48, 0.8, 'sawtooth', 0.18), 120);
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  return { unlock, update, ringChime, thud, crash, toggleMute };
}
