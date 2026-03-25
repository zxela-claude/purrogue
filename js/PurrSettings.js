/**
 * PurrSettings — persistent game settings via localStorage (NAN-46)
 *
 * Stored under the key 'purrogue_settings'.
 * Defaults: SFX at 25% volume, music at 100%, both enabled.
 * NAN-123: Added accessibility settings (colorblind, fontScale, highContrast, statusLabels).
 */
const KEY = 'purrogue_settings';

const DEFAULTS = {
  sfxVolume:     0.25,
  musicVolume:   1.0,
  sfxEnabled:    true,
  musicEnabled:  true,
  colorblind:    'off',
  fontScale:     1.0,
  highContrast:  false,
  statusLabels:  'short',
};

export class PurrSettings {
  static load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  static save(settings) {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  /**
   * Returns a CSS font-size string scaled by PurrSettings.fontScale.
   * Example: scaledFont(12) with fontScale 1.25 returns '15px'.
   * @param {number} basePx - base font size in pixels
   * @returns {string} CSS size string e.g. '15px'
   */
  static scaledFont(basePx) {
    const settings = PurrSettings.load();
    const scale = settings.fontScale || 1.0;
    return `${Math.round(basePx * scale)}px`;
  }
}
