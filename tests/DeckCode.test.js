import { describe, it, expect, beforeEach } from 'vitest';
import { DeckCode } from '../js/DeckCode.js';
import { GameState } from '../js/GameState.js';

describe('DeckCode', () => {
  let gs;

  beforeEach(() => {
    localStorage.clear();
    gs = new GameState();
    gs.startRun('WARRIOR');
    gs.addCard('w_strike');
    gs.addCard('w_defend');
    gs.addRelic('catnip');
  });

  describe('encode', () => {
    it('returns a non-empty base64 string', () => {
      const code = DeckCode.encode(gs);
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });

    it('encodes hero and deck', () => {
      const code = DeckCode.encode(gs);
      const decoded = JSON.parse(atob(code));
      expect(decoded.hero).toBe('WARRIOR');
      expect(decoded.deck).toContain('w_strike');
    });

    it('includes relics', () => {
      const code = DeckCode.encode(gs);
      const decoded = JSON.parse(atob(code));
      expect(decoded.relics).toContain('catnip');
    });

    it('includes version field', () => {
      const code = DeckCode.encode(gs);
      const decoded = JSON.parse(atob(code));
      expect(decoded.v).toBe(1);
    });
  });

  describe('decode', () => {
    it('roundtrips encode → decode successfully', () => {
      const code = DeckCode.encode(gs);
      const result = DeckCode.decode(code);
      expect(result.ok).toBe(true);
      expect(result.hero).toBe('WARRIOR');
      expect(result.deck).toContain('w_strike');
    });

    it('returns error on invalid base64', () => {
      const result = DeckCode.decode('!!not-valid-base64!!');
      expect(result.error).toBeDefined();
    });

    it('returns error on valid base64 with wrong version', () => {
      const tampered = btoa(JSON.stringify({ v: 999, hero: 'WARRIOR', deck: [], relics: [] }));
      const result = DeckCode.decode(tampered);
      expect(result.error).toMatch(/version/i);
    });

    it('returns error on empty string', () => {
      const result = DeckCode.decode('');
      expect(result.error).toBeDefined();
    });

    it('decoded result contains stats from original run', () => {
      gs.runStats.damage_dealt = 42;
      const code = DeckCode.encode(gs);
      const result = DeckCode.decode(code);
      expect(result.stats.damage_dealt).toBe(42);
    });
  });
});
