/**
 * PurrSettings — persistent game settings via localStorage (NAN-46)
 *
 * Stored under the key 'purrogue_settings'.
 * Defaults: SFX at 25% volume, music at 100%, both enabled.
 */
const KEY = 'purrogue_settings';

const DEFAULTS = {
  sfxVolume:     0.25,
  musicVolume:   1.0,
  sfxEnabled:    true,
  musicEnabled:  true,
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
}
