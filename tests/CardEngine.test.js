import { describe, it, expect } from 'vitest';
import { CardEngine } from '../js/CardEngine.js';

// ── helpers ──────────────────────────────────────────────────────────────────
function makePlayer(overrides = {}) {
  return { hp: 50, maxHp: 80, block: 0, statuses: {}, ...overrides };
}

function makeEnemy(overrides = {}) {
  return { hp: 40, maxHp: 40, block: 0, statuses: {}, moveIndex: 0,
    movePattern: [{ type: 'attack', value: 8, desc: 'Attack' }], ...overrides };
}

function makeEffect(type, value, extra = {}) {
  return { type, value, ...extra };
}

// ── resolveEffect ─────────────────────────────────────────────────────────────
describe('CardEngine.resolveEffect', () => {
  it('deals damage reducing enemy hp', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const result = CardEngine.resolveEffect(makeEffect('damage', 6), { player, enemy });
    expect(result).toMatchObject({ type: 'damage', amount: 6 });
    expect(enemy.hp).toBe(34);
  });

  it('damage is blocked by enemy block', () => {
    const player = makePlayer();
    const enemy = makeEnemy({ block: 4 });
    CardEngine.resolveEffect(makeEffect('damage', 6), { player, enemy });
    // blocked = min(4, 6) = 4, enemy.hp -= max(0, 6-4) = 2
    expect(enemy.hp).toBe(38);
    expect(enemy.block).toBe(0);
  });

  it('applies block to player', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const result = CardEngine.resolveEffect(makeEffect('block', 5), { player, enemy });
    expect(result).toMatchObject({ type: 'block', amount: 5 });
    expect(player.block).toBe(5);
  });

  it('heals player up to maxHp', () => {
    const player = makePlayer({ hp: 75 });
    CardEngine.resolveEffect(makeEffect('heal', 10), { player, enemy: makeEnemy() });
    expect(player.hp).toBe(80); // capped at maxHp
  });

  it('applies status to enemy', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    CardEngine.resolveEffect({ type: 'apply_status', status: 'poison', value: 3 }, { player, enemy });
    expect(enemy.statuses.poison).toBe(3);
  });

  it('applies self status to player', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    CardEngine.resolveEffect({ type: 'apply_self_status', status: 'strong', value: 2 }, { player, enemy });
    expect(player.statuses.strong).toBe(2);
  });

  it('vulnerable enemy takes 1.5x damage', () => {
    const player = makePlayer();
    const enemy = makeEnemy({ statuses: { vulnerable: 2 } });
    CardEngine.resolveEffect(makeEffect('damage', 10), { player, enemy });
    expect(enemy.hp).toBe(40 - Math.floor(10 * 1.5)); // 25
  });

  it('weak player deals 0.75x damage', () => {
    const player = makePlayer({ statuses: { weak: 1 } });
    const enemy = makeEnemy();
    CardEngine.resolveEffect(makeEffect('damage', 8), { player, enemy });
    expect(enemy.hp).toBe(40 - Math.floor(8 * 0.75)); // 34
  });

  it('feisty personality boosts attack damage', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    CardEngine.resolveEffect(makeEffect('damage', 10), { player, enemy }, 'feisty');
    expect(enemy.hp).toBe(40 - Math.ceil(10 * 1.15)); // 29
  });

  it('feral personality doubles attack damage', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    CardEngine.resolveEffect(makeEffect('damage', 10), { player, enemy }, 'feral');
    expect(enemy.hp).toBe(40 - 20); // 20
  });

  it('cozy personality heals 1 HP on block', () => {
    const player = makePlayer({ hp: 50 });
    const enemy = makeEnemy();
    CardEngine.resolveEffect(makeEffect('block', 5), { player, enemy }, 'cozy');
    expect(player.hp).toBe(51);
    expect(player.block).toBe(5);
  });

  it('cunning personality adds 1 to status duration', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    CardEngine.resolveEffect({ type: 'apply_status', status: 'poison', value: 3 }, { player, enemy }, 'cunning');
    expect(enemy.statuses.poison).toBe(4);
  });

  it('strong status boosts damage by 2 per stack', () => {
    const player = makePlayer({ statuses: { strong: 2 } });
    const enemy = makeEnemy();
    CardEngine.resolveEffect(makeEffect('damage', 6), { player, enemy });
    expect(enemy.hp).toBe(40 - (6 + 4)); // base 6 + strong bonus 4
  });

  it('magnifying_glass relic adds 1 to applied status', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    CardEngine.resolveEffect({ type: 'apply_status', status: 'poison', value: 3 }, { player, enemy, relics: ['magnifying_glass'] });
    expect(enemy.statuses.poison).toBe(4);
  });

  // NAN-277: damage_all must also receive personality/relic multipliers
  it('feisty personality boosts damage_all', () => {
    const player = makePlayer();
    const e1 = makeEnemy();
    const e2 = makeEnemy();
    CardEngine.resolveEffect(makeEffect('damage_all', 10), { player, enemy: e1, enemies: [e1, e2] }, 'feisty');
    const expected = 40 - Math.ceil(10 * 1.15); // 29
    expect(e1.hp).toBe(expected);
    expect(e2.hp).toBe(expected);
  });

  it('feral personality doubles damage_all', () => {
    const player = makePlayer();
    const e1 = makeEnemy();
    const e2 = makeEnemy();
    CardEngine.resolveEffect(makeEffect('damage_all', 10), { player, enemy: e1, enemies: [e1, e2] }, 'feral');
    expect(e1.hp).toBe(40 - 20);
    expect(e2.hp).toBe(40 - 20);
  });

  it('cursed_collar doubles damage_all', () => {
    const player = makePlayer();
    const e1 = makeEnemy();
    const e2 = makeEnemy();
    CardEngine.resolveEffect(makeEffect('damage_all', 8), { player, enemy: e1, enemies: [e1, e2], relics: ['cursed_collar'] });
    expect(e1.hp).toBe(40 - 16);
    expect(e2.hp).toBe(40 - 16);
  });
});

// ── tickStatuses ──────────────────────────────────────────────────────────────
describe('CardEngine.tickStatuses', () => {
  it('poison deals damage and decrements', () => {
    const combatant = { hp: 30, statuses: { poison: 4 } };
    CardEngine.tickStatuses(combatant);
    expect(combatant.hp).toBe(26);
    expect(combatant.statuses.poison).toBe(3);
  });

  it('poison is deleted when reaches 0', () => {
    const combatant = { hp: 30, statuses: { poison: 1 } };
    const expired = CardEngine.tickStatuses(combatant);
    expect(combatant.statuses.poison).toBeUndefined();
    expect(expired).toContain('poison');
  });

  it('burn deals 3x stack damage and is removed', () => {
    const combatant = { hp: 40, statuses: { burn: 2 } };
    CardEngine.tickStatuses(combatant);
    expect(combatant.hp).toBe(34); // 3 * 2 = 6 dmg
    expect(combatant.statuses.burn).toBeUndefined();
  });

  it('freeze decrements and is deleted when reaches 0', () => {
    const combatant = { hp: 40, statuses: { freeze: 1 } };
    const expired = CardEngine.tickStatuses(combatant);
    expect(combatant.statuses.freeze).toBeUndefined();
    expect(expired).toContain('freeze');
  });

  it('vulnerable decrements by 1 each tick', () => {
    const combatant = { hp: 40, statuses: { vulnerable: 3 } };
    CardEngine.tickStatuses(combatant);
    expect(combatant.statuses.vulnerable).toBe(2);
  });

  it('returns empty array when no statuses', () => {
    const combatant = { hp: 40, statuses: {} };
    const result = CardEngine.tickStatuses(combatant);
    expect(result).toEqual([]);
  });

  it('handles missing statuses object', () => {
    const combatant = { hp: 40 };
    const result = CardEngine.tickStatuses(combatant);
    expect(result).toEqual([]);
  });

  it('bleed deals damage equal to stacks and decrements', () => {
    const combatant = { hp: 30, statuses: { bleed: 3 } };
    CardEngine.tickStatuses(combatant);
    expect(combatant.hp).toBe(27);
    expect(combatant.statuses.bleed).toBe(2);
  });

  it('bleed is deleted when it reaches 0', () => {
    const combatant = { hp: 30, statuses: { bleed: 1 } };
    const expired = CardEngine.tickStatuses(combatant);
    expect(combatant.statuses.bleed).toBeUndefined();
    expect(expired).toContain('bleed');
  });

  it('strong decrements each tick', () => {
    const combatant = { hp: 30, statuses: { strong: 2 } };
    CardEngine.tickStatuses(combatant);
    expect(combatant.statuses.strong).toBe(1);
  });

  it('strong is deleted when it reaches 0', () => {
    const combatant = { hp: 30, statuses: { strong: 1 } };
    const expired = CardEngine.tickStatuses(combatant);
    expect(combatant.statuses.strong).toBeUndefined();
    expect(expired).toContain('strong');
  });
});

// ── executeEnemyMove ──────────────────────────────────────────────────────────
describe('CardEngine.executeEnemyMove', () => {
  it('attack reduces player hp', () => {
    const player = makePlayer({ hp: 50, block: 0 });
    const enemy = makeEnemy();
    const move = { type: 'attack', value: 8 };
    const result = CardEngine.executeEnemyMove(move, enemy, player);
    expect(result).toMatchObject({ type: 'attack', amount: 8 });
    expect(player.hp).toBe(42);
  });

  it('attack is blocked by player block', () => {
    const player = makePlayer({ hp: 50, block: 5 });
    const enemy = makeEnemy();
    const result = CardEngine.executeEnemyMove({ type: 'attack', value: 8 }, enemy, player);
    expect(player.hp).toBe(47); // 8 - 5 = 3 dmg
    expect(player.block).toBe(0);
  });

  it('attack blocked completely when block >= dmg', () => {
    const player = makePlayer({ hp: 50, block: 10 });
    const enemy = makeEnemy();
    CardEngine.executeEnemyMove({ type: 'attack', value: 8 }, enemy, player);
    expect(player.hp).toBe(50);
    expect(player.block).toBe(2); // 10 - 8 = 2 remaining block
  });

  it('weak enemy deals 0.75x damage', () => {
    const player = makePlayer({ hp: 50 });
    const enemy = makeEnemy({ statuses: { weak: 1 } });
    CardEngine.executeEnemyMove({ type: 'attack', value: 8 }, enemy, player);
    expect(player.hp).toBe(50 - Math.floor(8 * 0.75)); // 44
  });

  it('block move adds to enemy block', () => {
    const player = makePlayer();
    const enemy = makeEnemy({ block: 3 });
    const result = CardEngine.executeEnemyMove({ type: 'block', value: 5 }, enemy, player);
    expect(result).toMatchObject({ type: 'block', amount: 5 });
    expect(enemy.block).toBe(8);
  });

  it('buff move applies status to enemy', () => {
    const player = makePlayer();
    const enemy = makeEnemy();
    const result = CardEngine.executeEnemyMove({ type: 'buff', status: 'vulnerable', value: 2 }, enemy, player);
    expect(result).toMatchObject({ type: 'buff', status: 'vulnerable' });
    expect(enemy.statuses.vulnerable).toBe(2);
  });
});

// ── resolveEnemyIntent ────────────────────────────────────────────────────────
describe('CardEngine.resolveEnemyIntent', () => {
  it('cycles through movePattern by moveIndex', () => {
    const enemy = makeEnemy({
      moveIndex: 0,
      movePattern: [
        { type: 'attack', value: 5 },
        { type: 'block', value: 4 },
      ]
    });
    const m1 = CardEngine.resolveEnemyIntent(enemy, null);
    expect(m1.type).toBe('attack');
    const m2 = CardEngine.resolveEnemyIntent(enemy, null);
    expect(m2.type).toBe('block');
    const m3 = CardEngine.resolveEnemyIntent(enemy, null);
    expect(m3.type).toBe('attack'); // wraps
  });
});

// ── Smith upgrade key derivation (NAN-211) ────────────────────────────────────
// Mirrors the logic in MapScene._showSmithMenu showPreview()
function getSmithUpgradeKey(cardId, card, mood) {
  const upgMood = mood || 'default';
  const hasSpecific = upgMood !== 'default' && card.upgrades[upgMood];
  return hasSpecific ? `${cardId}_u_${upgMood}` : `${cardId}_u`;
}

describe('Smith upgrade key derivation', () => {
  it('uses mood-specific upgrade key when mood upgrade exists', () => {
    const cardId = 'w_strike';
    const card = { id: cardId, upgrades: { default: {}, feisty: {} } };
    expect(getSmithUpgradeKey(cardId, card, 'feisty')).toBe('w_strike_u_feisty');
  });

  it('falls back to default upgrade key when mood has no specific path', () => {
    const cardId = 'w_headbutt';
    const card = { id: cardId, upgrades: { default: {} } };
    expect(getSmithUpgradeKey(cardId, card, 'cozy')).toBe('w_headbutt_u');
  });

  it('uses default key when mood is null', () => {
    const cardId = 'w_defend';
    const card = { id: cardId, upgrades: { default: {} } };
    expect(getSmithUpgradeKey(cardId, card, null)).toBe('w_defend_u');
  });

  it('uses default key for explicit default mood', () => {
    const cardId = 'w_cleave';
    const card = { id: cardId, upgrades: { default: {} } };
    expect(getSmithUpgradeKey(cardId, card, 'default')).toBe('w_cleave_u');
  });
});
