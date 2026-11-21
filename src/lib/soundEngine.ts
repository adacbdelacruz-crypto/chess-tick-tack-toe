class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  public setEnabled(val: boolean) {
    this.enabled = val;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private tone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    gainPeak: number,
    type: OscillatorType = 'triangle',
    delay = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freqEnd),
        now + duration
      );
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playSelect() {
    this.tone(720, 520, 0.045, 0.07, 'sine');
  }

  public playPlace() {
    // Tactile marble-on-slate drop
    this.tone(210, 82, 0.09, 0.18, 'triangle');
    this.tone(640, 310, 0.04, 0.06, 'sine');
  }

  public playMove() {
    // Crisp wooden slide & settle
    this.tone(260, 110, 0.08, 0.14, 'triangle');
    this.tone(880, 440, 0.035, 0.05, 'sine', 0.015);
  }

  public playCapture() {
    // Sharp percussive strike + deep resonance
    this.tone(160, 48, 0.16, 0.25, 'sawtooth');
    this.tone(540, 220, 0.11, 0.14, 'triangle');
    this.tone(1080, 760, 0.08, 0.07, 'sine', 0.02);
  }

  public playPromote() {
    // Ascending harmonic fifths
    this.tone(440, 440, 0.14, 0.12, 'sine', 0);
    this.tone(659.25, 659.25, 0.16, 0.12, 'sine', 0.07);
    this.tone(880, 880, 0.26, 0.14, 'triangle', 0.14);
  }

  public playThreat() {
    // Subtle tense pulse when 3-in-a-row forms
    this.tone(196, 185, 0.18, 0.11, 'sine', 0.05);
  }

  public playVictory() {
    const notes = [261.63, 329.63, 392.0, 523.25];
    notes.forEach((n, idx) => {
      this.tone(n, n, 0.32, 0.11, 'triangle', idx * 0.09);
    });
  }

  public playDefeat() {
    this.tone(293.66, 261.63, 0.22, 0.12, 'triangle', 0);
    this.tone(220.0, 174.61, 0.36, 0.12, 'sine', 0.15);
  }

  public playDraw() {
    this.tone(329.63, 329.63, 0.2, 0.1, 'sine', 0);
    this.tone(392.0, 392.0, 0.24, 0.1, 'sine', 0.12);
  }

  public playInvalid() {
    this.tone(140, 120, 0.07, 0.08, 'square');
  }
}

export const soundEngine = new SoundEngine();
