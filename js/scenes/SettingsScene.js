import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../constants.js';
import { SoundManager } from '../SoundManager.js';
import { MusicManager } from '../MusicManager.js';
import { PurrSettings } from '../PurrSettings.js';

const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
const PANEL_W = 480, PANEL_H = 560;
const PANEL_X = W / 2, PANEL_Y = H / 2;
const SEG_COUNT = 8;          // volume bar segments
const SEG_W = 22, SEG_H = 18, SEG_GAP = 4;

// Colorblind palette remaps keyed by STATUS name (not hex) to avoid fragile string matching.
// Keys match STATUS_COLORS_BASE: poison, burn, freeze, vulnerable, weak, strong
export const COLORBLIND_MAPS = {
  deuteranopia: { poison: '#4fc3f7', burn: '#ff9800' },         // green→blue, red→orange
  protanopia:   { poison: '#4fc3f7', burn: '#ffd700' },         // green→blue, red→yellow
  tritanopia:   { freeze: '#e94560', strong: '#ff9800' },       // blue→red, yellow→orange
};

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
    this.add.text(PANEL_X, PANEL_Y - 256, 'SETTINGS', {
      fontFamily: '"Press Start 2P"', fontSize: '20px', color: '#e94560',
    }).setOrigin(0.5);

    // Divider under title
    const divGfx = this.add.graphics();
    divGfx.lineStyle(1, 0xe94560, 0.3);
    divGfx.lineBetween(PANEL_X - PANEL_W / 2 + 20, PANEL_Y - 228, PANEL_X + PANEL_W / 2 - 20, PANEL_Y - 228);

    // SFX row
    this._sfxToggle   = this._makeToggle(PANEL_Y - 188, 'SFX',   this._settings.sfxEnabled,   v => this._onSfxToggle(v));
    this._sfxBar      = this._makeVolumeBar(PANEL_Y - 188, this._settings.sfxVolume,            v => this._onSfxVolume(v));

    // Music row
    this._musicToggle = this._makeToggle(PANEL_Y - 118,  'MUSIC', this._settings.musicEnabled, v => this._onMusicToggle(v));
    this._musicBar    = this._makeVolumeBar(PANEL_Y - 118,  this._settings.musicVolume,         v => this._onMusicVolume(v));

    // Fullscreen button
    const isFs = !!document.fullscreenElement;
    this._fsLabel = this.add.text(PANEL_X, PANEL_Y - 50, this._fsText(isFs), {
      fontFamily: '"Press Start 2P"', fontSize: '13px', color: '#f0ead6',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', function() { this.setColor('#ffd700'); })
      .on('pointerout',  function() { this.setColor('#f0ead6'); })
      .on('pointerdown', () => this._toggleFullscreen());

    // ── ACCESSIBILITY section ────────────────────────────────────────────────

    // Section divider
    const accDivGfx = this.add.graphics();
    accDivGfx.lineStyle(1, 0xe94560, 0.3);
    accDivGfx.lineBetween(PANEL_X - PANEL_W / 2 + 20, PANEL_Y - 12, PANEL_X + PANEL_W / 2 - 20, PANEL_Y - 12);

    // Section label
    this.add.text(PANEL_X, PANEL_Y + 10, 'ACCESSIBILITY', {
      fontFamily: '"Press Start 2P"', fontSize: '11px', color: '#e94560',
    }).setOrigin(0.5);

    // 1) Colorblind Mode dropdown (cycle button)
    this._makeAccessibilityLabel(PANEL_Y + 50, 'COLORBLIND');
    this._colorblindBtn = this._makeCycleButton(
      PANEL_Y + 50,
      ['Off', 'Deuteranopia', 'Protanopia', 'Tritanopia'],
      this._colorblindIndex(this._settings.colorblind),
      (label) => this._onColorblind(label)
    );

    // 2) Font Scale — three preset buttons
    this._makeAccessibilityLabel(PANEL_Y + 110, 'FONT SCALE');
    this._fontScaleBtns = this._makeFontScaleButtons(PANEL_Y + 110, this._settings.fontScale);

    // 3) High Contrast toggle
    this._makeAccessibilityLabel(PANEL_Y + 170, 'HIGH CONTRAST');
    this._highContrastBtn = this._makeOnOffButton(
      PANEL_Y + 170,
      this._settings.highContrast,
      (val) => this._onHighContrast(val)
    );

    // 4) Status Labels toggle
    this._makeAccessibilityLabel(PANEL_Y + 230, 'STATUS LABELS');
    this._statusLabelsBtn = this._makeCycleButton(
      PANEL_Y + 230,
      ['Icon only', 'Full text'],
      this._settings.statusLabels === 'full' ? 1 : 0,
      (label) => this._onStatusLabels(label)
    );

    // Close button
    this.add.text(PANEL_X + PANEL_W / 2 - 20, PANEL_Y - PANEL_H / 2 + 16, '✕', {
      fontFamily: '"Press Start 2P"', fontSize: '14px', color: '#888888',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', function() { this.setColor('#e94560'); })
      .on('pointerout',  function() { this.setColor('#888888'); })
      .on('pointerdown', () => this._close());

    // ESC to close
    this.input.keyboard.once('keydown-ESC', () => this._close());
    PurrSettings.scaleSceneText(this); // NAN-222
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

  // ── Accessibility row builders ────────────────────────────────────────────

  _makeAccessibilityLabel(rowY, label) {
    const labelX = PANEL_X - PANEL_W / 2 + 24;
    this.add.text(labelX, rowY, label, {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#888888',
    }).setOrigin(0, 0.5);
  }

  /**
   * Creates a cycle button that steps through options on click.
   * Returns the button text object.
   */
  _makeCycleButton(rowY, options, initialIndex, onChange) {
    const btnX = PANEL_X + 20;
    let idx = initialIndex;

    const btn = this.add.text(btnX, rowY, `[ ${options[idx]} ]`, {
      fontFamily: '"Press Start 2P"', fontSize: '10px', color: '#f0ead6',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', function() { this.setColor('#ffd700'); });
    btn.on('pointerout',  function() { this.setColor('#f0ead6'); });
    btn.on('pointerdown', () => {
      idx = (idx + 1) % options.length;
      btn.setText(`[ ${options[idx]} ]`);
      onChange(options[idx]);
    });

    return btn;
  }

  /**
   * Creates an ON/OFF button (single toggle, styled like existing toggles).
   * Returns the button text object.
   */
  _makeOnOffButton(rowY, initialOn, onChange) {
    const btnX = PANEL_X + 20;
    let on = initialOn;

    const btn = this.add.text(btnX, rowY, on ? 'ON' : 'OFF', {
      fontFamily: '"Press Start 2P"', fontSize: '11px',
      color: on ? '#4caf50' : '#e94560',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setAlpha(0.7));
    btn.on('pointerout',  () => btn.setAlpha(1.0));
    btn.on('pointerdown', () => {
      on = !on;
      btn.setText(on ? 'ON' : 'OFF');
      btn.setColor(on ? '#4caf50' : '#e94560');
      onChange(on);
    });

    return btn;
  }

  /**
   * Creates three preset font-scale buttons (100% / 125% / 150%).
   * Returns an array of button text objects.
   */
  _makeFontScaleButtons(rowY, initialScale) {
    const presets = [
      { label: '100%', value: 1.0 },
      { label: '125%', value: 1.25 },
      { label: '150%', value: 1.5 },
    ];
    const startX = PANEL_X + 20;
    const spacing = 80;
    const btns = [];

    presets.forEach((p, i) => {
      const isActive = Math.abs(p.value - initialScale) < 0.01;
      const btn = this.add.text(startX + i * spacing, rowY, p.label, {
        fontFamily: '"Press Start 2P"', fontSize: '10px',
        color: isActive ? '#ffd700' : '#f0ead6',
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

      btn.on('pointerover', function() { if (this.style.color !== '#ffd700') this.setColor('#aaaaaa'); });
      btn.on('pointerout',  () => {
        btns.forEach((b, j) => {
          const activeVal = this._settings.fontScale;
          b.setColor(Math.abs(presets[j].value - activeVal) < 0.01 ? '#ffd700' : '#f0ead6');
        });
      });
      btn.on('pointerdown', () => {
        this._onFontScale(p.value);
        btns.forEach((b, j) => {
          b.setColor(Math.abs(presets[j].value - p.value) < 0.01 ? '#ffd700' : '#f0ead6');
        });
      });

      btns.push(btn);
    });

    return btns;
  }

  // ── Accessibility helpers ─────────────────────────────────────────────────

  _colorblindIndex(val) {
    const map = { off: 0, deuteranopia: 1, protanopia: 2, tritanopia: 3 };
    return map[val] ?? 0;
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

  _onColorblind(label) {
    const valMap = { 'Off': 'off', 'Deuteranopia': 'deuteranopia', 'Protanopia': 'protanopia', 'Tritanopia': 'tritanopia' };
    this._settings.colorblind = valMap[label] ?? 'off';
    PurrSettings.save(this._settings);
  }

  _onFontScale(value) {
    this._settings.fontScale = value;
    PurrSettings.save(this._settings);
  }

  _onHighContrast(value) {
    this._settings.highContrast = value;
    PurrSettings.save(this._settings);
  }

  _onStatusLabels(label) {
    this._settings.statusLabels = label === 'Full text' ? 'full' : 'short';
    PurrSettings.save(this._settings);
  }

  _close() {
    this.scene.stop('SettingsScene');
  }
}
