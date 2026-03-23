import { PurrSettings } from './PurrSettings.js';

/**
 * SoundManager — synthesised sound effects using Web Audio API (NAN-5)
 *
 * All sounds are generated programmatically via oscillators + gain envelopes
 * so no audio files need to be shipped.  The manager gracefully degrades when
 * AudioContext is unavailable or suspended (browser autoplay policy).
 */
export class SoundManager {
  /**
   * @param {Phaser.Scene} scene  The Phaser scene that owns this manager.
   */
  constructor(scene) {
    this.scene = scene;
    // Use Phaser's underlying Web Audio context so Phaser can manage the
    // unlock / resume lifecycle across browsers.
    this.ctx = scene.sound && scene.sound.context ? scene.sound.context : null;
    this.enabled = true;
    this._masterGain = null;

    if (this.ctx) {
      this._masterGain = this.ctx.createGain();
      const s = PurrSettings.load();
      this._masterGain.gain.value = s.sfxEnabled ? s.sfxVolume : 0;
      this.enabled = s.sfxEnabled;
      this._masterGain.connect(this.ctx.destination);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Set SFX master volume (0–1). */
  setVolume(v) {
    if (this._masterGain) this._masterGain.gain.value = this.enabled ? v : 0;
  }

  /** Enable or disable SFX. */
  setEnabled(flag) {
    this.enabled = flag;
    if (this._masterGain) {
      const s = PurrSettings.load();
      this._masterGain.gain.value = flag ? s.sfxVolume : 0;
    }
  }

  /**
   * Play a named sound effect.
   * @param {string} type  One of the sound type constants below.
   */
  play(type) {
    if (!this.enabled || !this.ctx || !this._masterGain) return;

    // Resume if suspended (browser requires prior user gesture)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    switch (type) {
      case 'card_play':   this._playCardPlay();    break;
      case 'damage_dealt':this._playDamageDealt(); break;
      case 'player_hit':  this._playPlayerHit();   break;
      case 'heal':        this._playHeal();         break;
      case 'card_draw':   this._playCardDraw();     break;
      case 'victory':     this._playVictory();      break;
      case 'death':       this._playDeath();        break;
      default:            break;
    }
  }

  /**
   * Toggle mute.  Returns the new enabled state.
   */
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  /**
   * Create and connect a gain node that automatically stops when the envelope
   * is done, preventing node leaks.
   */
  _makeGain(peak, attackTime, decayTime) {
    const gain = this.ctx.createGain();
    gain.connect(this._masterGain);
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + attackTime);
    gain.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime);
    return { gain, endTime: now + attackTime + decayTime };
  }

  _makeOscillator(type, freq, gainNode, endTime) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gainNode);
    osc.start();
    osc.stop(endTime + 0.02); // slight tail to avoid clicks
    return osc;
  }

  // ── card_play — short whoosh: sine 440→220 hz over 200 ms ──────────────────
  _playCardPlay() {
    const { gain, endTime } = this._makeGain(0.25, 0.01, 0.19);
    const osc = this._makeOscillator('sine', 440, gain, endTime);
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(220, this.ctx.currentTime + 0.20);
  }

  // ── damage_dealt — sharp hit: square 330 hz, 150 ms, quick decay ───────────
  _playDamageDealt() {
    const { gain, endTime } = this._makeGain(0.3, 0.005, 0.145);
    this._makeOscillator('square', 330, gain, endTime);
  }

  // ── player_hit — lower thud: sine 180 hz, 200 ms, slow decay ───────────────
  _playPlayerHit() {
    const { gain, endTime } = this._makeGain(0.3, 0.008, 0.192);
    this._makeOscillator('sine', 180, gain, endTime);
  }

  // ── heal — gentle chime: sine 660 hz, 300 ms, slow attack ──────────────────
  _playHeal() {
    const { gain, endTime } = this._makeGain(0.22, 0.08, 0.22);
    this._makeOscillator('sine', 660, gain, endTime);
  }

  // ── card_draw — soft tick: triangle 520 hz, 100 ms ─────────────────────────
  _playCardDraw() {
    const { gain, endTime } = this._makeGain(0.18, 0.005, 0.095);
    this._makeOscillator('triangle', 520, gain, endTime);
  }

  // ── victory — ascending trio: 440 → 550 → 660 hz, 150 ms each ─────────────
  _playVictory() {
    const notes = [440, 550, 660];
    notes.forEach((freq, i) => {
      const start = this.ctx.currentTime + i * 0.16;
      const gain = this.ctx.createGain();
      gain.connect(this._masterGain);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.28, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  // ── death — descending trio: 440 → 330 → 220 hz, 150 ms each ─────────────
  _playDeath() {
    const notes = [440, 330, 220];
    notes.forEach((freq, i) => {
      const start = this.ctx.currentTime + i * 0.16;
      const gain = this.ctx.createGain();
      gain.connect(this._masterGain);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.28, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }
}
