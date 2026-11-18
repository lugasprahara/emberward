// Synthesized WebAudio sound: no audio files. Short blips for shots, a deep
// thump for mortar shells, a crackle for lightning, a coin chime for bounty,
// a low groan when the crystal is hit, and a slow ambient pad under play.
// Everything is guarded: no context exists until the first user gesture, and
// in screenshot mode nothing ever initialises.

export class AudioBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.padTimer = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, dur, type = 'square', vol = 0.16, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol = 0.12, freq = 1200, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  shoot() { this.tone(880, 0.07, 'square', 0.05, 320); }
  frost() { this.tone(1240, 0.14, 'sine', 0.08, 1900); }
  mortar() { this.noise(0.22, 0.16, 500); this.tone(120, 0.22, 'sine', 0.16, 55); }
  zap() { this.noise(0.09, 0.10, 3200); this.tone(1600, 0.08, 'sawtooth', 0.05, 300); }
  boom() { this.noise(0.35, 0.22, 380); this.tone(90, 0.32, 'sine', 0.2, 40); }
  coin() { this.tone(1320, 0.06, 'sine', 0.05); this.tone(1760, 0.09, 'sine', 0.05, null, 0.05); }
  leak() { this.tone(220, 0.3, 'sawtooth', 0.14, 70); }
  place() { this.tone(420, 0.09, 'triangle', 0.12, 640); }
  upgrade() { this.tone(660, 0.08, 'triangle', 0.1); this.tone(990, 0.12, 'triangle', 0.1, null, 0.07); }
  horn() { this.tone(196, 0.4, 'sawtooth', 0.1); this.tone(262, 0.4, 'sawtooth', 0.1, null, 0.05); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.12, null, i * 0.13)); }
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.12, null, i * 0.16)); }

  // A slow two-oscillator pad that re-triggers itself while playing.
  pad(dt, active) {
    if (!this.ctx || this.muted || !active) return;
    this.padTimer -= dt;
    if (this.padTimer > 0) return;
    this.padTimer = 3.6;
    this.tone(110, 3.4, 'sine', 0.045);
    this.tone(165, 3.4, 'sine', 0.03, null, 0.4);
    this.tone(220, 3.4, 'triangle', 0.018, null, 0.8);
  }
}
