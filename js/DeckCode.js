const VERSION = 1;

export class DeckCode {
  static encode(gameState) {
    const payload = {
      v: VERSION,
      hero: gameState.hero,
      deck: gameState.deck,
      relics: gameState.relics,
      personality: gameState.getDominantPersonality(),
      stats: gameState.runStats
    };
    try {
      return btoa(JSON.stringify(payload));
    } catch(e) { return null; }
  }

  static decode(code) {
    try {
      const payload = JSON.parse(atob(code));
      if (payload.v !== VERSION) return { error: 'Version mismatch — code from newer version' };
      return { ok: true, ...payload };
    } catch(e) {
      return { error: 'Invalid deck code' };
    }
  }
}
