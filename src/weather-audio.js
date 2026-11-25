function startLoop(ctx, buffer) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start();
  return source;
}

function makeRaindrops(ctx) {
  const rate = 24000;
  const buffer = ctx.createBuffer(2, rate * 9, rate);
  const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
  // Each impact has a short splash and a damped resonance. Wrap its tail
  // around the buffer so a drop at the loop boundary can ring out.
  for (let start = 0; start < buffer.length; start += Math.ceil(rate * (.006 + Math.random() * .066))) {
    const decay = .004 + Math.random() * .012;
    const pitch = 700 + Math.random() ** 2 * 2400;
    const strength = .14 + Math.random() ** 2 * .63;
    const pan = (.12 + Math.random() * .76) * Math.PI / 2;
    const l = Math.cos(pan), r = Math.sin(pan);
    for (let i = 0; i < 6 * decay * rate; i++) {
      const t = i / rate;
      const envelope = Math.min(1, t / .0015) * Math.exp(-t / decay);
      const ring = Math.sin(2 * Math.PI * pitch * (t + 2 * t * t));
      const sample = strength * envelope * (.52 * ring + .48 * (2 * Math.random() - 1));
      const index = (start + i) % buffer.length;
      left[index] += sample * l;
      right[index] += sample * r;
    }
  }
  return buffer;
}

export function createWeatherAudio(ctx, master) {
  function gain(value, output) {
    const node = ctx.createGain();
    node.gain.value = value;
    node.connect(output);
    return node;
  }
  function filter(type, hz, q, output) {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = hz;
    node.Q.value = q;
    node.connect(output);
    return node;
  }

  const air = ctx.createBuffer(2, 5.3 * 24000, 24000);
  for (let ch = 0; ch < air.numberOfChannels; ch++) {
    const data = air.getChannelData(ch);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const noise = startLoop(ctx, air);
  const rain = gain(0, master), wind = gain(0, master);
  const rainCover = filter('lowpass', 9000, .7, rain);
  noise.connect(filter('bandpass', 3000, .65, gain(.53, rainCover)));
  startLoop(ctx, makeRaindrops(ctx)).connect(rainCover);

  const gust = gain(1.05, wind);
  const windBand = filter('bandpass', 650, .95, gust);
  noise.connect(windBand);
  // Two different periods keep consecutive gusts from cresting identically.
  const swell = ctx.createOscillator(), ripple = ctx.createOscillator();
  swell.frequency.value = .083;
  ripple.frequency.value = .137;
  swell.connect(gain(350, windBand.frequency));
  swell.connect(gain(.42, gust.gain));
  ripple.connect(gain(160, windBand.frequency));
  swell.start();
  ripple.start();

  const phrases = {rain: [293.66, 369.99, 440, 0, 329.63, 0], snow: [196, 0, 293.66, 246.94, 0, 220]};
  let noteIndex = 0, current;
  return {
    mix(weather, sheltered) {
      const now = ctx.currentTime;
      rain.gain.setTargetAtTime(weather === 'rain' ? (sheltered ? .50 : 1) : 0, now, .55);
      rainCover.frequency.setTargetAtTime(sheltered ? 1450 : 9000, now, .35);
      wind.gain.setTargetAtTime(weather === 'snow' ? (sheltered ? .40 : 1.2) : 0, now, .70);
      if (current !== weather) noteIndex = 0;
      current = weather;
    },
    playNote() {
      const phrase = phrases[current];
      if (!phrase) return;
      const hz = phrase[noteIndex++ % phrase.length];
      if (!hz) return;
      const now = ctx.currentTime, end = now + 3.8;
      const voice = ctx.createOscillator();
      const envelope = gain(0, current === 'rain' ? rain : wind);
      voice.frequency.value = hz;
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(.038, now + .45);
      envelope.gain.exponentialRampToValueAtTime(.0001, end);
      voice.connect(envelope);
      voice.start(now);
      voice.stop(end);
      voice.onended = () => { voice.disconnect(); envelope.disconnect(); };
    }
  };
}
