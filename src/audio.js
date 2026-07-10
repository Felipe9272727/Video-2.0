export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.engine = null;
    this.engineGain = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.22 : 0;
    this.master.connect(this.ctx.destination);

    this.engine = this.ctx.createOscillator();
    this.engine.type = 'sawtooth';
    this.engine.frequency.value = 44;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 190;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engine.connect(filter).connect(this.engineGain).connect(this.master);
    this.engine.start();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!this.ctx) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(enabled ? 0.22 : 0, this.ctx.currentTime + 0.08);
  }

  setEngine(active, boost = false) {
    if (!this.ctx || !this.engineGain) return;
    const now = this.ctx.currentTime;
    this.engineGain.gain.cancelScheduledValues(now);
    this.engineGain.gain.linearRampToValueAtTime(active ? (boost ? 0.18 : 0.075) : 0, now + 0.12);
    this.engine.frequency.cancelScheduledValues(now);
    this.engine.frequency.linearRampToValueAtTime(boost ? 78 : 46, now + 0.1);
  }

  tone(frequency, duration = 0.12, type = 'sine', volume = 0.24, endFrequency = null) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  shard(combo = 1) {
    this.tone(540 + combo * 42, 0.11, 'sine', 0.25, 910 + combo * 30);
  }

  shield() {
    this.tone(190, 0.45, 'triangle', 0.32, 760);
    setTimeout(() => this.tone(540, 0.25, 'sine', 0.16, 840), 85);
  }

  hit() {
    this.tone(120, 0.5, 'sawtooth', 0.48, 32);
    this.tone(72, 0.36, 'square', 0.18, 20);
  }

  nearMiss() {
    this.tone(330, 0.2, 'triangle', 0.16, 620);
  }

  start() {
    this.tone(110, 0.4, 'sawtooth', 0.2, 330);
    setTimeout(() => this.tone(440, 0.32, 'triangle', 0.22, 880), 170);
  }
}
