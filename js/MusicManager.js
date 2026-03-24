/**
 * MusicManager — generative background music using Web Audio API (NAN-33)
 *
 * Three ambient patterns are generated entirely from oscillators; no audio
 * files are required.  The manager persists on the Phaser game registry so
 * music continues seamlessly across scene transitions.
 *
 * Patterns:
 *  'menu'   — slow, major-key arpeggio (~80 bpm)
 *  'combat' — faster, minor-key pulse (~140 bpm)
 *  'boss'   — intense, dissonant (~160 bpm)
 *
 * Usage (from any Phaser scene):
 *   const music = MusicManager.getInstance(this);
 *   music.play('combat');      // switch to pattern, crossfade
 *   music.stop();              // fade out and stop
 *   music.setEnabled(false);   // mute (persists across scenes)
 */
export class MusicManager {
  /** @returns {MusicManager} */
  static getInstance(scene) {
    // Store singleton on the Phaser registry so it survives scene changes.
    let inst = scene.registry.get('__musicManager');
    if (!inst) {
      inst = new MusicManager(scene);
      scene.registry.set('__musicManager', inst);
    }
    // Keep scene reference fresh so time events work in the current scene.
    inst._scene = scene;
    return inst;
  }

  constructor(scene) {
    this._scene = scene;
    this.ctx = scene.sound && scene.sound.context ? scene.sound.context : null;
    this._enabled = true;
    this._volumeScale = 1.0;
    this._currentPattern = null;
    this._nodes = [];          // active oscillator / gain nodes
    this._masterGain = null;
    this._intervalId = null;
    this._stepIndex = 0;
    this._isStopping = false;

    if (this.ctx) {
      this._masterGain = this.ctx.createGain();
      this._masterGain.gain.value = 0;  // start silent; fadein on play()
      this._masterGain.connect(this.ctx.destination);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Start (or switch to) a named pattern with a 0.5 s crossfade. */
  play(pattern) {
    if (!this.ctx || !this._masterGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (pattern === this._currentPattern) return;
    this._currentPattern = pattern;
    if (!this._enabled) return;
    this._startPattern(pattern);
  }

  /** Fade out and stop all music. */
  stop() {
    this._currentPattern = null;
    this._stopPattern(true);
  }

  /** Enable or disable music globally (survives scene changes). */
  setEnabled(flag) {
    this._enabled = flag;
    if (!flag) {
      this._stopPattern(true);
    } else if (this._currentPattern) {
      this._startPattern(this._currentPattern);
    }
  }

  get enabled() { return this._enabled; }

  /** Toggle mute — returns new state. */
  toggle() {
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  /** Set music volume multiplier (0–1). Scales on top of per-pattern gains. */
  setVolume(v) {
    this._volumeScale = Math.max(0, Math.min(1, v));
    if (this._masterGain && this._enabled && this._currentPattern) {
      const def = MusicManager.PATTERNS[this._currentPattern];
      if (def) {
        const now = this.ctx.currentTime;
        this._masterGain.gain.cancelScheduledValues(now);
        this._masterGain.gain.setValueAtTime(def.gain * this._volumeScale, now);
      }
    }
  }

  get volumeScale() { return this._volumeScale ?? 1.0; }

  // ── Pattern definitions ────────────────────────────────────────────────────

  static PATTERNS = {
    // Major key ascending arpeggio, 80 bpm (750 ms per step)
    menu: {
      bpm: 80,
      notes: [261.63, 329.63, 392.00, 523.25, 392.00, 329.63],  // C4 E4 G4 C5 G4 E4
      wave: 'sine',
      noteDuration: 0.28,
      gain: 0.03,
    },
    // Minor key staccato pulse, 140 bpm (~430 ms per step)
    combat: {
      bpm: 140,
      notes: [220.00, 261.63, 246.94, 220.00, 196.00, 246.94, 261.63, 196.00], // Am arpeggio
      wave: 'triangle',
      noteDuration: 0.12,
      gain: 0.03,
    },
    // Intense, dissonant pattern, 160 bpm
    boss: {
      bpm: 160,
      notes: [185.00, 233.08, 220.00, 185.00, 207.65, 233.08, 196.00, 220.00], // Dissonant minor
      wave: 'sawtooth',
      noteDuration: 0.10,
      gain: 0.025,
    },
  };

  // ── Internals ───────────────────────────────────────────────────────────────

  _startPattern(patternName) {
    const def = MusicManager.PATTERNS[patternName];
    if (!def) return;

    // Crossfade: fade current master out, then fade back in
    const FADE = 0.5;
    const now = this.ctx.currentTime;

    // Fade out
    this._masterGain.gain.cancelScheduledValues(now);
    this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now);
    this._masterGain.gain.linearRampToValueAtTime(0, now + FADE);

    // Stop the old interval after fade
    this._clearInterval();

    // After fade-out, launch the new pattern
    const startDelay = FADE * 1000;
    this._scene.time.delayedCall(startDelay, () => {
      if (this._isStopping) return;
      if (this._currentPattern !== patternName) return;  // switched again
      this._stepIndex = 0;
      this._scheduleNext(def);

      // Fade back in
      const t = this.ctx.currentTime;
      this._masterGain.gain.cancelScheduledValues(t);
      this._masterGain.gain.setValueAtTime(0, t);
      this._masterGain.gain.linearRampToValueAtTime(def.gain * this._volumeScale, t + FADE);
    });
  }

  _scheduleNext(def) {
    if (!this._enabled || !this._currentPattern) return;
    if (this._isStopping) return;

    const stepMs = (60 / def.bpm) * 1000;
    const freq = def.notes[this._stepIndex % def.notes.length];
    this._stepIndex++;

    this._playNote(freq, def.wave, def.noteDuration);

    this._intervalId = this._scene.time.delayedCall(stepMs, () => {
      this._scheduleNext(def);
    });
  }

  _playNote(freq, waveType, duration) {
    if (!this.ctx || !this._masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = waveType;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(this._masterGain);

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1.0, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.02);

    // Cleanup after the note finishes
    osc.onended = () => {
      try { osc.disconnect(); gain.disconnect(); } catch (_) {}
    };
  }

  _stopPattern(fade) {
    this._isStopping = true;
    this._clearInterval();
    if (!this.ctx || !this._masterGain) { this._isStopping = false; return; }

    const FADE = fade ? 0.5 : 0.05;
    const now = this.ctx.currentTime;
    this._masterGain.gain.cancelScheduledValues(now);
    this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now);
    this._masterGain.gain.linearRampToValueAtTime(0, now + FADE);

    this._scene.time.delayedCall(FADE * 1000, () => {
      this._isStopping = false;
    });
  }

  _clearInterval() {
    if (this._intervalId) {
      this._intervalId.remove(false);
      this._intervalId = null;
    }
  }
}
