const rate = 22050, tau = 2 * Math.PI;
const between = (low, high) => low + Math.random() * (high - low);
const sine = cycles => Math.sin(tau * cycles);

function noiseBand(low, high) {
  const a = 1 - Math.exp(-tau * low / rate), b = 1 - Math.exp(-tau * high / rate);
  let slow = 0, fast = 0;
  return () => {
    const white = Math.random() * 2 - 1;
    slow += a * (white - slow);
    fast += b * (white - fast);
    return fast - slow;
  };
}

// Bake one short, tapered call per species/texture on first use. Playback
// rate, level, stereo position and the silence between calls vary live.
const sounds = {
  bird: {duration: .23, level: .115, pause: [6, 12], sample: () => t => {
    const u = t / .23, phase = 1790 * t + 220 * u * u - 152 * u ** 3;
    return Math.sin(Math.PI * u) ** 1.4 * (sine(phase) + .12 * sine(2 * phase));
  }},
  cicada: {duration: 3.5, level: .115, pause: [4.6, 8.4], sample: () => {
    const hiss = noiseBand(1900, 5300);
    return t => {
      const pulse = (.5 + .5 * sine(78 * t + .28 * sine(2.4 * t))) ** 2;
      const rasp = .50 * hiss() + .30 * sine(3290 * t + .5 * sine(112 * t)) + .15 * sine(3715 * t);
      return Math.sin(Math.PI * t / 3.5) * (.70 + .30 * sine(1.35 * t)) * (.22 + .78 * pulse) * rasp;
    };
  }},
  leaves: {duration: 3.2, level: .16, pause: [5.2, 10], sample: () => {
    const foliage = noiseBand(680, 4300), crackle = noiseBand(2200, 7800);
    return t => {
      const flutter = (.5 + .5 * sine(3.3 * t + .55 * sine(1.8 * t))) ** 4;
      return Math.sin(Math.PI * t / 3.2) ** 1.5 * (.50 * foliage() + flutter * crackle());
    };
  }},
  cricket: {duration: .25, level: .062, pause: [8, 15], sample: () => t => {
    const pulse = Math.min(1, (t % .083) / .048);
    return Math.sin(Math.PI * pulse) ** 2 * (sine(3450 * t) + .16 * sine(3670 * t));
  }},
  lap: {duration: 2.2, level: .16, pause: [3.4, 6.8], sample: () => {
    const wash = noiseBand(170, 1400), foam = noiseBand(1150, 3500);
    return t => {
      const crest = Math.min(1, t / .32) * Math.exp(-1.9 * t);
      return Math.sin(Math.PI * t / 2.2) * (wash() + .85 * crest * foam());
    };
  }}
};

function renderCall(ctx, sound) {
  const buffer = ctx.createBuffer(1, Math.ceil(rate * sound.duration), rate);
  const data = buffer.getChannelData(0), sample = sound.sample();
  let peak = .0001;
  for (let i = 0; i < data.length; i++) {
    data[i] = sample(i / rate);
    peak = Math.max(peak, Math.abs(data[i]));
  }
  for (let i = 0; i < data.length; i++) data[i] /= peak;
  return buffer;
}

export function createSeasonAudio(ctx, master) {
  const tracks = Object.entries(sounds).map(([name, sound]) => {
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(master);
    return {name, sound, bus, buffer: null, amount: 0, next: 0};
  });

  function play(track, time, speed, pan, level = 1) {
    const source = ctx.createBufferSource(), stereo = ctx.createStereoPanner(), gain = ctx.createGain();
    source.buffer = track.buffer ??= renderCall(ctx, track.sound);
    source.playbackRate.value = speed;
    stereo.pan.value = pan;
    gain.gain.value = level;
    source.connect(stereo).connect(gain).connect(track.bus);
    source.start(time);
    source.onended = () => { source.disconnect(); stereo.disconnect(); gain.disconnect(); };
  }

  let season, weather, period, recoveringUntil = 0;
  let habitat = {ground: 0, trees: 0, shore: 0, grass: 0};
  function mix() {
    const {ground, trees, grass, shore} = habitat;
    const now = ctx.currentTime;
    const daylight = ({day: 1, overcast: .85, sunset: .55, dusk: .15})[period] ?? 0;
    const clear = weather === 'clear';
    const levels = {
      bird: clear && season === 'spring' ? (.32 * ground + .68 * trees) * daylight : 0,
      cicada: clear && season === 'summer' ? trees * daylight ** 1.5 : 0,
      lap: clear && season === 'summer' ? shore : 0,
      leaves: clear && season === 'autumn' ? trees : 0,
      cricket: clear && season === 'autumn' && (period === 'night' || period === 'dusk') ? grass : 0
    };
    for (const track of tracks) {
      const amount = levels[track.name];
      if (amount === track.amount) continue;
      if (track.amount === 0 && amount > 0) {
        track.next = now + between(.2, .75);
        if (now < recoveringUntil) track.next += track.name === 'bird' ? 1 : between(2, 4);
      }
      track.bus.gain.setTargetAtTime(amount * track.sound.level, now, now < recoveringUntil && amount > 0 ? 2 : .5);
      track.amount = amount;
    }
  }
  return {
    setClimate(nextSeason, nextWeather, nextPeriod) {
      if (weather === 'rain' && nextWeather === 'clear') recoveringUntil = ctx.currentTime + 5;
      season = nextSeason; weather = nextWeather; period = nextPeriod;
      mix();
    },
    update(location) {
      habitat = location;
      mix();
      const now = ctx.currentTime;
      for (const track of tracks) {
        if (track.amount < .025 || now < track.next) continue;
        const pan = between(.28, .72) * (Math.random() < .5 ? -1 : 1);
        const speed = between(.91, 1.08);
        play(track, now, speed, pan);
        if (track.name === 'bird') {
          if (now >= recoveringUntil) play(track, now + .31, speed * 1.09, pan, .78);
          play(track, now + between(1.4, 2.6), speed * .86, -pan, .43);
        } else if (track.name === 'cricket') {
          play(track, now + between(.42, .65), speed, pan, .73);
        }
        track.next = now + between(...track.sound.pause);
      }
    }
  };
}
