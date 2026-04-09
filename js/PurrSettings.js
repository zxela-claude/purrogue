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
  statusLabels:  'full',
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

  /**
   * Scale an explicit list of Phaser Text objects by fontScale.
   * Safe to call on dynamically created text (e.g. cards dealt mid-combat).
   * NAN-222: used for text created after create() completes.
   * @param {Phaser.GameObjects.Text[]} textObjects
   */
  static scaleTextObjects(textObjects) {
    const scale = (PurrSettings.load().fontScale) || 1.0;
    if (scale === 1.0) return;
    for (const obj of textObjects) {
      if (obj && obj.style && obj.style.fontSize) {
        const base = parseInt(obj.style.fontSize, 10);
        if (!isNaN(base)) obj.setFontSize(Math.round(base * scale) + 'px');
      }
    }
  }

  /**
   * Walk all Phaser Text objects in a scene (including inside containers)
   * and multiply their fontSize by fontScale. Call at the end of create().
   * NAN-222: wires the Font Scale accessibility setting to actual text objects.
   * @param {Phaser.Scene} scene
   */
  static scaleSceneText(scene) {
    const scale = (PurrSettings.load().fontScale) || 1.0;
    if (scale === 1.0) return;

    function applyToObj(obj) {
      if (obj && obj.type === 'Text' && obj.style && obj.style.fontSize) {
        const base = parseInt(obj.style.fontSize, 10);
        if (!isNaN(base)) {
          obj.setFontSize(Math.round(base * scale) + 'px');
        }
      }
      // Recurse into containers
      if (obj && obj.list && Array.isArray(obj.list)) {
        obj.list.forEach(applyToObj);
      }
    }

    scene.children.list.forEach(applyToObj);
  }
}
