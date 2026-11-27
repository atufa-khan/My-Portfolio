/* ==================================================================
 *  Ocean sound, generated live with the Web Audio API (no audio files).
 *  Waves by day (+ the odd gull), wind and crickets at night, rain and
 *  thunder in the storm, everything muffled once you're underwater.
 * ================================================================== */

export type SoundState = { night: number; storm: number; under: number };

export class OceanSound {
  private ctx: AudioContext;
  private master: GainNode;
  private muffle: BiquadFilterNode;
  private white: AudioBuffer;
  private brown: AudioBuffer;
  private waveGain: GainNode;
  private waveFilter: BiquadFilterNode;
  private foamGain: GainNode;
  private windGain: GainNode;
  private windFilter: BiquadFilterNode;
  private rainGain: GainNode;
  private droneGain: GainNode;
  private state: SoundState = { night: 0, storm: 0, under: 0 };
  private timers: number[] = [];
  private lastUpdate = 0;
  enabled = false;

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0;
    this.muffle = c.createBiquadFilter();
    this.muffle.type = "lowpass";
    this.muffle.frequency.value = 18000;
    this.muffle.connect(this.master).connect(c.destination);

    // noise sources
    const len = c.sampleRate * 4;
    this.white = c.createBuffer(1, len, c.sampleRate);
    this.brown = c.createBuffer(1, len, c.sampleRate);
    const w = this.white.getChannelData(0);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      w[i] = Math.random() * 2 - 1;
      last = (last + 0.02 * w[i]) / 1.02;
      b[i] = last * 3.5;
    }

    // waves: deep, slowly swelling brown noise
    this.waveFilter = c.createBiquadFilter();
    this.waveFilter.type = "lowpass";
    this.waveFilter.frequency.value = 500;
    this.waveGain = c.createGain();
    this.waveGain.gain.value = 0;
    this.loop(this.brown).connect(this.waveFilter).connect(this.waveGain).connect(this.muffle);

    // foam: the hiss of a breaking crest
    const foamF = c.createBiquadFilter();
    foamF.type = "bandpass";
    foamF.frequency.value = 1100;
    foamF.Q.value = 0.6;
    this.foamGain = c.createGain();
    this.foamGain.gain.value = 0;
    this.loop(this.white).connect(foamF).connect(this.foamGain).connect(this.muffle);

    // wind
    this.windFilter = c.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.frequency.value = 420;
    this.windFilter.Q.value = 0.9;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0;
    this.loop(this.white).connect(this.windFilter).connect(this.windGain).connect(this.muffle);

    // rain
    const rainF = c.createBiquadFilter();
    rainF.type = "highpass";
    rainF.frequency.value = 2800;
    this.rainGain = c.createGain();
    this.rainGain.gain.value = 0;
    this.loop(this.white).connect(rainF).connect(this.rainGain).connect(this.muffle);

    // the deep: a low hum
    this.droneGain = c.createGain();
    this.droneGain.gain.value = 0;
    for (const f of [55, 82.5]) {
      const o = c.createOscillator();
      o.frequency.value = f;
      o.connect(this.droneGain);
      o.start();
    }
    this.droneGain.connect(this.master);

    this.timers.push(window.setInterval(() => this.cricket(), 650));
    this.timers.push(window.setInterval(() => Math.random() < 0.35 && this.gull(), 4000));
  }

  private loop(buf: AudioBuffer) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.loopStart = Math.random();
    s.start(0, Math.random() * 3);
    return s;
  }

  async setEnabled(on: boolean) {
    this.enabled = on;
    const now = this.ctx.currentTime;
    if (on) {
      await this.ctx.resume();
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(0.9, now, 0.8);
    } else {
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(0, now, 0.25);
    }
  }

  /** Called every frame; only reshapes the mix a few times a second. */
  update(s: SoundState, t: number) {
    this.state = s;
    if (!this.enabled || t - this.lastUpdate < 0.1) return;
    this.lastUpdate = t;
    const now = this.ctx.currentTime;
    const { night, storm, under } = s;
    const surface = 1 - under;
    const swell = 0.5 + 0.5 * Math.sin((t / 7.5) * Math.PI * 2);
    const swell2 = 0.5 + 0.5 * Math.sin((t / 4.3) * Math.PI * 2 + 1.3);
    const set = (p: AudioParam, v: number, k = 0.25) => p.setTargetAtTime(v, now, k);
    set(this.waveGain.gain, surface * (0.22 + 0.25 * swell + storm * 0.45));
    set(this.waveFilter.frequency, 380 + 380 * swell + storm * 600);
    set(this.foamGain.gain, surface * (0.012 + 0.05 * Math.pow(swell2, 3) + storm * 0.06));
    set(this.windGain.gain, surface * (night * 0.06 + storm * 0.2) * (0.6 + 0.4 * Math.sin(t * 0.37)));
    set(this.windFilter.frequency, 300 + 260 * (0.5 + 0.5 * Math.sin(t * 0.23)) + storm * 500);
    set(this.rainGain.gain, surface * storm * 0.09);
    set(this.droneGain.gain, under * 0.05, 0.8);
    set(this.muffle.frequency, 18000 - under * 17400, 0.4);
  }

  private cricket() {
    const { night, storm, under } = this.state;
    const v = night * (1 - storm) * (1 - under);
    if (!this.enabled || v < 0.1) return;
    const c = this.ctx;
    // two crickets, left and right, with their own rhythm
    for (const [pan, f, chance] of [[-0.6, 4550, 0.85], [0.55, 4950, 0.6]] as const) {
      if (Math.random() > chance) continue;
      const start = c.currentTime + Math.random() * 0.25;
      const o = c.createOscillator();
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.value = 0;
      const p = c.createStereoPanner();
      p.pan.value = pan;
      for (let k = 0; k < 3; k++) {
        const t0 = start + k * 0.05;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.018 * v, t0 + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
      }
      o.connect(g).connect(p).connect(this.muffle);
      o.start(start);
      o.stop(start + 0.2);
    }
  }

  private gull() {
    const { night, storm, under } = this.state;
    const v = (1 - night) * (1 - storm) * (1 - under);
    if (!this.enabled || v < 0.3) return;
    const c = this.ctx;
    const pan = c.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1900;
    bp.Q.value = 2;
    bp.connect(pan).connect(this.muffle);
    const calls = 2 + Math.floor(Math.random() * 2);
    for (let k = 0; k < calls; k++) {
      const t0 = c.currentTime + k * 0.42;
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(2300, t0);
      o.frequency.exponentialRampToValueAtTime(1450, t0 + 0.32);
      const vib = c.createOscillator();
      vib.frequency.value = 28;
      const vg = c.createGain();
      vg.gain.value = 60;
      vib.connect(vg).connect(o.frequency);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.03 * v, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);
      o.connect(g).connect(bp);
      o.start(t0);
      vib.start(t0);
      o.stop(t0 + 0.4);
      vib.stop(t0 + 0.4);
    }
  }

  /** Lightning just flashed: the rumble arrives a moment later. */
  thunder() {
    if (!this.enabled) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.25 + Math.random() * 0.9;
    const crack = c.createBufferSource();
    crack.buffer = this.white;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const cg = c.createGain();
    cg.gain.setValueAtTime(0, t0);
    cg.gain.linearRampToValueAtTime(0.25, t0 + 0.01);
    cg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    crack.connect(hp).connect(cg).connect(this.muffle);
    crack.start(t0, Math.random() * 3);
    crack.stop(t0 + 0.4);

    const rumble = c.createBufferSource();
    rumble.buffer = this.brown;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(260, t0);
    lp.frequency.exponentialRampToValueAtTime(70, t0 + 3.5);
    const rg = c.createGain();
    rg.gain.setValueAtTime(0, t0);
    rg.gain.linearRampToValueAtTime(0.9, t0 + 0.12);
    rg.gain.setTargetAtTime(0.35, t0 + 0.4, 0.6);
    rg.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.2);
    rumble.connect(lp).connect(rg).connect(this.muffle);
    rumble.start(t0, Math.random() * 2);
    rumble.stop(t0 + 4.5);
  }

  /** The ring is found. */
  chime() {
    if (!this.enabled) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.05;
    [880, 1318.5, 1760, 2637].forEach((f, i) => {
      const o = c.createOscillator();
      o.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t0 + i * 0.09);
      g.gain.linearRampToValueAtTime(0.06 / (i + 1), t0 + i * 0.09 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.09 + 2.8);
      o.connect(g).connect(this.master);
      o.start(t0 + i * 0.09);
      o.stop(t0 + i * 0.09 + 3);
    });
  }

  destroy() {
    this.timers.forEach(clearInterval);
    this.ctx.close();
  }
}
