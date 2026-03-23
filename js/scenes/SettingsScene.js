import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../constants.js';
import { SoundManager } from '../SoundManager.js';
import { MusicManager } from '../MusicManager.js';
import { PurrSettings } from '../PurrSettings.js';

const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
const PANEL_W = 420, PANEL_H = 320;
const PANEL_X = W / 2, PANEL_Y = H / 2;
const SEG_COUNT = 8;          // volume bar segments
const SEG_W = 22, SEG_H = 18, SEG_GAP = 4;

export class SettingsScene extends Phaser.Scene {
  constructor() { super('SettingsScene'); }

  create() {
    this._settings = PurrSettings.load();
    this._sfxMgr   = new SoundManager(this);
    this._musicMgr  = MusicManager.getInstance(this);

    // Semi-transparent overlay
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72)
      .setInteractive()   // block click-through
      .on('pointerdown', () => {});

    // Panel background
    this.add.rectangle(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 0x0d0d1a, 0.98);
    const borderGfx = this.add.graphics();
    borderGfx.lineStyle(2, 0xe94560, 0.8);
    borderGfx.strokeRect(PANEL_X - PANEL_W / 2, PANEL_Y - PANEL_H / 2, PANEL_W, PANEL_H);

    // Title
    this.add.text(PANEL_X, PANEL_Y - 128, 'SETTINGS', {
      fontFamily: '"Press Start 2P"', fontSize: '20px', color: '#e94560',
    }).setOrigin(0.5);

    // Divider
    const divGfx = this.add.graphics();
    divGfx.lineStyle(1, 0xe94560, 0.3);
    divGfx.lineBetween(PANEL_X - PANEL_W / 2 + 20, PANEL_Y - 102, PANEL_X + PANEL_W / 2 - 20, PANEL_Y - 102);

    // SFX row
    this._sfxToggle   = this._makeToggle(PANEL_Y - 60, 'SFX',   this._settings.sfxEnabled,   v => this._onSfxToggle(v));
    this._sfxBar      = this._makeVolumeBar(PANEL_Y - 60, this._settings.sfxVolume,            v => this._onSfxVolume(v));

    // Music row
    this._musicToggle = this._makeToggle(PANEL_Y + 10,  'MUSIC', this._settings.musicEnabled, v => this._onMusicToggle(v));
    this._musicBar    = this._makeVolumeBar(PANEL_Y + 10,  this._settings.musicVolume,         v => this._onMusicVolume(v));

    // Fullscreen button
    const isFs = !!document.fullscreenElement;
    this._fsLabel = this.add.text(PANEL_X, PANEL_Y + 80, this._fsText(isFs), {
      fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#f0ead6',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', function() { this.setColor('#ffd700'); })
      .on('pointerout',  function() { this.setColor('#f0ead6'); })
      .on('pointerdown', () => this._toggleFullscreen());

    // Close button
    this.add.text(PANEL_X + PANEL_W / 2 - 20, PANEL_Y - PANEL_H / 2 + 16, '✕', {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#888888',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', function() { this.setColor('#e94560'); })
      .on('pointerout',  function() { this.setColor('#888888'); })
      .on('pointerdown', () => this._close());

    // ESC to close
    this.input.keyboard.once('keydown-ESC', () => this._close());
  }

  // ── Row builders ─────────────────────────────────────────────────────────

  _makeToggle(rowY, label, initialOn, onChange) {
    const labelX = PANEL_X - PANEL_W / 2 + 24;

    this.add.text(labelX, rowY, label, {
      fontFamily: '"Press Start 2P"', fontSize: '12px', color: '#888888',
    }).setOrigin(0, 0.5);

    const btnX = labelX + 84;
    const btn = this.add.text(btnX, rowY, initialOn ? 'ON' : 'OFF', {
      fontFamily: '"Press Start 2P"', fontSize: '11px',
      color: initialOn ? '#4caf50' : '#e94560',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => {
      const newVal = btn.text === 'ON' ? false : true;
      btn.setText(newVal ? 'ON' : 'OFF');
      btn.setColor(newVal ? '#4caf50' : '#e94560');
      onChange(newVal);
    });

    return btn;
  }

  _makeVolumeBar(rowY, initialVolume, onChange) {
    const barStartX = PANEL_X - 4;   // right side of row
    const segments = [];

    for (let i = 0; i < SEG_COUNT; i++) {
      const x = barStartX + i * (SEG_W + SEG_GAP);
      const filled = (i + 1) / SEG_COUNT <= initialVolume + 0.01;
      const seg = this.add.rectangle(x, rowY, SEG_W, SEG_H, filled ? 0x4caf50 : 0x333333)
        .setInteractive({ useHandCursor: true });

      seg.on('pointerover', () => seg.setAlpha(0.7));
      seg.on('pointerout',  () => seg.setAlpha(1.0));
      seg.on('pointerdown', () => {
        const vol = (i + 1) / SEG_COUNT;
        this._updateBar(segments, vol);
        onChange(vol);
      });

      segments.push(seg);
    }

    return segments;
  }

  _updateBar(segments, volume) {
    segments.forEach((seg, i) => {
      const filled = (i + 1) / SEG_COUNT <= volume + 0.01;
      seg.setFillStyle(filled ? 0x4caf50 : 0x333333);
    });
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  _onSfxToggle(enabled) {
    this._settings.sfxEnabled = enabled;
    // Dim/brighten bar to show muted state
    this._sfxBar.forEach(s => s.setAlpha(enabled ? 1 : 0.35));
    if (this._sfxMgr) this._sfxMgr.setEnabled(enabled);
    PurrSettings.save(this._settings);
  }

  _onSfxVolume(volume) {
    this._settings.sfxVolume = volume;
    if (this._sfxMgr) this._sfxMgr.setVolume(volume);
    PurrSettings.save(this._settings);
  }

  _onMusicToggle(enabled) {
    this._settings.musicEnabled = enabled;
    this._musicBar.forEach(s => s.setAlpha(enabled ? 1 : 0.35));
    if (this._musicMgr) this._musicMgr.setEnabled(enabled);
    PurrSettings.save(this._settings);
  }

  _onMusicVolume(volume) {
    this._settings.musicVolume = volume;
    if (this._musicMgr) this._musicMgr.setVolume(volume);
    PurrSettings.save(this._settings);
  }

  _toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      this._fsLabel.setText(this._fsText(true));
    } else {
      document.exitFullscreen().catch(() => {});
      this._fsLabel.setText(this._fsText(false));
    }
  }

  _fsText(isFs) {
    return isFs ? '[ EXIT FULLSCREEN ]' : '[ FULLSCREEN ]';
  }

  _close() {
    this.scene.stop('SettingsScene');
  }
}
