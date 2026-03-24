/**
 * NAN-66: Integration tests for full combat rounds including relic effects.
 *
 * These tests simulate the CombatScene._playCard + enemy turn + status tick
 * lifecycle without Phaser, exercising CardEngine end-to-end.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CardEngine } from '../js/CardEngine.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function makePlayer(overrides = {}) {
  return { hp: 80, maxHp: 80, block: 0, statuses: {}, ...overrides };
}

function makeEnemy(overrides = {}) {
  return {
    hp: 50, maxHp: 50, block: 0, statuses: {}, moveIndex: 0,
    movePattern: [{ type: 'attack', value: 8 }],
    ...overrides,
  };
}

/**
 * Simulate playing a card with relic side-effects applied, mirroring
 * CombatScene._playCard logic (without Phaser).
 *
 * Returns { results, relicBonus } where relicBonus is extra damage applied.
 */
function playCard(card, combatState, personality, relics = [], sessionFlags = {}) {
  const results = CardEngine.resolveCard(card, { ...combatState, relics }, personality);
  let relicBonus = 0;

  if (relics.includes('claw_sharpener') && card.type === 'attack') {
    const dmg = 2;
    const blocked = Math.min(combatState.enemy.block || 0, dmg);
    combatState.enemy.block = Math.max(0, (combatState.enemy.block || 0) - dmg);
    combatState.enemy.hp -= (dmg - blocked);
    relicBonus += dmg - blocked;
  }

  if (relics.includes('bell_collar') && card.type === 'attack' && !sessionFlags.bellCollarUsed) {
    sessionFlags.bellCollarUsed = true;
    const dmg = 3;
    const blocked = Math.min(combatState.enemy.block || 0, dmg);
    combatState.enemy.block = Math.max(0, (combatState.enemy.block || 0) - dmg);
    combatState.enemy.hp -= (dmg - blocked);
    relicBonus += dmg - blocked;
  }

  if (relics.includes('warm_blanket') && card.type === 'skill') {
    combatState.player.block = (combatState.player.block || 0) + 2;
  }

  return { results, relicBonus };
}

/**
 * Run one enemy turn: resolve intent, apply move, tick statuses on both sides.
 * NOTE: Block resets at the START of the player's next turn, not here.
 *       Call startPlayerTurn() separately when simulating a new player turn.
 */
function runEnemyTurn(enemy, player) {
  const move = CardEngine.resolveEnemyIntent(enemy, player);
  const moveResult = CardEngine.executeEnemyMove(move, enemy, player);

  // Tick status effects at end of turn
  const playerExpired = CardEngine.tickStatuses(player);
  const enemyExpired = CardEngine.tickStatuses(enemy);

  return { move, moveResult, playerExpired, enemyExpired };
}

/** Simulate start of a new player turn: reset block (mirrors CombatScene._startPlayerTurn). */
function startPlayerTurn(player) {
  player.block = 0;
}

// ── Full single-turn round ────────────────────────────────────────────────────

describe('Full combat round — single turn', () => {
  let player, enemy;

  beforeEach(() => {
    player = makePlayer();
    enemy = makeEnemy();
  });

  it('player plays Strike, then enemy attacks — correct HP on both sides', () => {
    const strike = { id: 'w_strike', type: 'attack', effects: [{ type: 'damage', value: 6 }] };
    playCard(strike, { player, enemy }, null);

    expect(enemy.hp).toBe(44); // 50 - 6

    // Enemy attacks for 8, player has no block
    runEnemyTurn(enemy, player);
    expect(player.hp).toBe(72); // 80 - 8
  });

  it('player gains block before enemy attacks — block absorbs damage', () => {
    const defend = { id: 'w_defend', type: 'skill', effects: [{ type: 'block', value: 5 }] };
    playCard(defend, { player, enemy }, null);

    expect(player.block).toBe(5);

    // Enemy attacks for 8, 5 blocked
    const { moveResult } = runEnemyTurn(enemy, player);
    expect(player.hp).toBe(77); // 80 - (8-5) = 77
    expect(moveResult.blocked).toBe(5);
  });

  it('multi-card turn: block then attack', () => {
    const defend = { id: 'w_defend', type: 'skill', effects: [{ type: 'block', value: 5 }] };
    const strike = { id: 'w_strike', type: 'attack', effects: [{ type: 'damage', value: 6 }] };

    playCard(defend, { player, enemy }, null);
    playCard(strike, { player, enemy }, null);

    expect(player.block).toBe(5);
    expect(enemy.hp).toBe(44); // 50 - 6
  });
});

// ── Multi-turn combat ─────────────────────────────────────────────────────────

describe('Multi-turn combat', () => {
  it('player kills enemy before dying', () => {
    const player = makePlayer({ hp: 40 });
    // 14 HP so 6 (Strike) + 8 (Bash) = 14 total kills it
    const enemy = makeEnemy({ hp: 14, movePattern: [{ type: 'attack', value: 8 }] });

    const strike = { id: 'w_strike', type: 'attack', effects: [{ type: 'damage', value: 6 }] };
    const bash   = { id: 'w_bash',   type: 'attack', effects: [{ type: 'damage', value: 8 }, { type: 'apply_status', status: 'vulnerable', value: 2 }] };

    // Turn 1: play Strike (6 dmg → enemy 8 HP)
    playCard(strike, { player, enemy }, null);
    expect(enemy.hp).toBe(8);
    runEnemyTurn(enemy, player);
    expect(player.hp).toBe(32);

    // Turn 2: play Bash (8 dmg → enemy dead)
    startPlayerTurn(player);
    playCard(bash, { player, enemy }, null);
    expect(enemy.hp).toBeLessThanOrEqual(0);
  });

  it('poison accumulates and drains enemy HP over turns', () => {
    const player = makePlayer();
    const enemy  = makeEnemy({ hp: 40 });

    const poisonCard = { id: 'm_corruption', type: 'power', effects: [{ type: 'apply_status', status: 'poison', value: 5 }] };

    playCard(poisonCard, { player, enemy }, null);
    expect(enemy.statuses.poison).toBe(5);

    // Turn 1 tick: 5 dmg, poison → 4
    CardEngine.tickStatuses(enemy);
    expect(enemy.hp).toBe(35);
    expect(enemy.statuses.poison).toBe(4);

    // Turn 2 tick: 4 dmg, poison → 3
    CardEngine.tickStatuses(enemy);
    expect(enemy.hp).toBe(31);
    expect(enemy.statuses.poison).toBe(3);
  });

  it('vulnerable debuff increases player damage and expires correctly', () => {
    const player = makePlayer();
    const enemy  = makeEnemy({ hp: 60, statuses: { vulnerable: 1 } });

    const strike = { id: 'w_strike', type: 'attack', effects: [{ type: 'damage', value: 10 }] };
    playCard(strike, { player, enemy }, null);

    // 10 * 1.5 = 15 dmg
    expect(enemy.hp).toBe(45);

    // Tick: vulnerable expires
    CardEngine.tickStatuses(enemy);
    expect(enemy.statuses.vulnerable).toBeUndefined();
  });
});

// ── Relic effects in full rounds ──────────────────────────────────────────────

describe('Relic: claw_sharpener', () => {
  it('adds +2 damage on every attack card played', () => {
    const player = makePlayer();
    const enemy  = makeEnemy({ hp: 50 });
    const strike = { id: 'w_strike', type: 'attack', effects: [{ type: 'damage', value: 6 }] };

    playCard(strike, { player, enemy }, null, ['claw_sharpener']);

    // 6 base + 2 relic = 8 total
    expect(enemy.hp).toBe(42);
  });

  it('does NOT add bonus for skill cards', () => {
    const player = makePlayer();
    const enemy  = makeEnemy({ hp: 50 });
    const defend = { id: 'w_defend', type: 'skill', effects: [{ type: 'block', value: 5 }] };

    playCard(defend, { player, enemy }, null, ['claw_sharpener']);
    expect(enemy.hp).toBe(50); // no damage
  });

  it('stacks with personality: feisty + claw_sharpener', () => {
    const player = makePlayer();
    const enemy  = makeEnemy({ hp: 50 });
    const strike = { id: 'w_strike', type: 'attack', effects: [{ type: 'damage', value: 10 }] };

    playCard(strike, { player, enemy }, 'feisty', ['claw_sharpener']);

    // feisty: ceil(10 * 1.15) = 12, plus +2 relic = 14
    expect(enemy.hp).toBe(36);
  });
});

describe('Relic: bell_collar', () => {
  it('first attack in combat deals +3 bonus damage', () => {
    const player = makePlayer();
    const enemy  = makeEnemy({ hp: 50 });
    const flags  = {};
    const strike = { id: 'w_strike', type: 'attack', effects: [{ type: 'damage', value: 6 }] };

    playCard(strike, { player, enemy }, null, ['bell_collar'], flags);
    expect(enemy.hp).toBe(41); // 6 + 3
    expect(flags.bellCollarUsed).toBe(true);
  });

  it('second attack in same combat does NOT get bonus', () => {
    const player = makePlayer();
    const enemy  = makeEnemy({ hp: 50 });
    const flags  = { bellCollarUsed: true };
    const strike = { id: 'w_strike', type: 'attack', effects: [{ type: 'damage', value: 6 }] };

    playCard(strike, { player, enemy }, null, ['bell_collar'], flags);
    expect(enemy.hp).toBe(44); // only base 6
  });

  it('only triggers on attack type — skill does not consume flag', () => {
    const player = makePlayer();
    const enemy  = makeEnemy({ hp: 50 });
    const flags  = {};
    const defend = { id: 'w_defend', type: 'skill', effects: [{ type: 'block', value: 5 }] };
    const strike = { id: 'w_strike', type: 'attack', effects: [{ type: 'damage', value: 6 }] };

    playCard(defend, { player, enemy }, null, ['bell_collar'], flags);
    expect(flags.bellCollarUsed).toBeUndefined(); // skill didn't trigger it

    playCard(strike, { player, enemy }, null, ['bell_collar'], flags);
    expect(enemy.hp).toBe(41); // 6 + 3, collar fires on first attack
  });
});

describe('Relic: warm_blanket', () => {
  it('grants +2 block when a skill card is played', () => {
    const player = makePlayer();
    const enemy  = makeEnemy();
    const defend = { id: 'w_defend', type: 'skill', effects: [{ type: 'block', value: 5 }] };

    playCard(defend, { player, enemy }, null, ['warm_blanket']);
    expect(player.block).toBe(7); // 5 base + 2 relic
  });

  it('does NOT add block for attack cards', () => {
    const player = makePlayer();
    const enemy  = makeEnemy();
    const strike = { id: 'w_strike', type: 'attack', effects: [{ type: 'damage', value: 6 }] };

    playCard(strike, { player, enemy }, null, ['warm_blanket']);
    expect(player.block).toBe(0);
  });

  it('warm_blanket block absorbs enemy damage in same round', () => {
    const player = makePlayer({ hp: 50 });
    const enemy  = makeEnemy({ hp: 50, movePattern: [{ type: 'attack', value: 10 }] });
    const defend = { id: 'w_defend', type: 'skill', effects: [{ type: 'block', value: 5 }] };

    playCard(defend, { player, enemy }, null, ['warm_blanket']);
    expect(player.block).toBe(7);

    // Enemy attacks for 10, 7 blocked → 3 dmg
    runEnemyTurn(enemy, player);
    expect(player.hp).toBe(47);
  });
});

describe('Relic: magnifying_glass', () => {
  it('status effects last 1 extra turn', () => {
    const player = makePlayer();
    const enemy  = makeEnemy();
    const poison = { id: 'm_corruption', type: 'power', effects: [{ type: 'apply_status', status: 'poison', value: 3 }] };

    playCard(poison, { player, enemy }, null, ['magnifying_glass']);
    expect(enemy.statuses.poison).toBe(4); // 3 + 1 relic extension
  });

  it('magnifying_glass + cunning personality stack', () => {
    const player = makePlayer();
    const enemy  = makeEnemy();
    const poison = { id: 'm_corruption', type: 'power', effects: [{ type: 'apply_status', status: 'poison', value: 3 }] };

    playCard(poison, { player, enemy }, 'cunning', ['magnifying_glass']);
    expect(enemy.statuses.poison).toBe(5); // 3 + 1 cunning + 1 glass
  });
});

// ── Relic combo: claw_sharpener + bell_collar ─────────────────────────────────

describe('Relic combo: claw_sharpener + bell_collar', () => {
  it('first attack gets both bonuses', () => {
    const player = makePlayer();
    const enemy  = makeEnemy({ hp: 50 });
    const flags  = {};
    const strike = { id: 'w_strike', type: 'attack', effects: [{ type: 'damage', value: 6 }] };

    playCard(strike, { player, enemy }, null, ['claw_sharpener', 'bell_collar'], flags);
    expect(enemy.hp).toBe(39); // 6 + 2 (sharpener) + 3 (collar) = 11 total
  });
});

// ── HP threshold behavior ─────────────────────────────────────────────────────

describe('Enemy HP threshold behavior', () => {
  it('switches to escalated pattern below threshold', () => {
    const enemy = makeEnemy({
      hp: 50, maxHp: 50,
      movePattern: [{ type: 'attack', value: 5 }],
      thresholdBehavior: {
        below: 0.5,
        pattern: [{ type: 'attack', value: 15 }],
      },
    });
    const player = makePlayer();

    // At full HP, should use base pattern
    const normalMove = CardEngine.resolveEnemyIntent(enemy, player);
    expect(normalMove.value).toBe(5);

    // Drop below 50%
    enemy.hp = 24;

    // Reset moveIndex so it picks from the start of the escalated pattern
    enemy.moveIndex = 0;
    const escalatedMove = CardEngine.resolveEnemyIntent(enemy, player);
    expect(escalatedMove.value).toBe(15);
  });
});

// ── Status interactions in a full round ───────────────────────────────────────

describe('Burn + full round', () => {
  it('burn is consumed at start of status tick, dealing 3x stacks damage', () => {
    const player = makePlayer();
    const enemy  = makeEnemy({ hp: 50 });

    const burnCard = { id: 'm_fireball', type: 'attack', effects: [{ type: 'damage', value: 10 }, { type: 'apply_status', status: 'burn', value: 2 }] };
    playCard(burnCard, { player, enemy }, null);

    expect(enemy.hp).toBe(40);           // 10 dmg
    expect(enemy.statuses.burn).toBe(2);

    CardEngine.tickStatuses(enemy);

    // burn 2 → 3 * 2 = 6 dmg
    expect(enemy.hp).toBe(34);
    expect(enemy.statuses.burn).toBeUndefined();
  });
});

describe('Bleed + full round', () => {
  it('bleed drains over multiple ticks then expires', () => {
    const player = makePlayer();
    const enemy  = makeEnemy({ hp: 30, statuses: { bleed: 3 } });

    // Tick 1: 3 dmg, bleed → 2
    CardEngine.tickStatuses(enemy);
    expect(enemy.hp).toBe(27);
    expect(enemy.statuses.bleed).toBe(2);

    // Tick 2: 2 dmg, bleed → 1
    CardEngine.tickStatuses(enemy);
    expect(enemy.hp).toBe(25);

    // Tick 3: 1 dmg, bleed expires
    const expired = CardEngine.tickStatuses(enemy);
    expect(enemy.hp).toBe(24);
    expect(enemy.statuses.bleed).toBeUndefined();
    expect(expired).toContain('bleed');
  });
});

// ── Personality + relic end-to-end ────────────────────────────────────────────

describe('Feral personality full round', () => {
  it('feral doubles damage, killing low-HP enemy', () => {
    const player = makePlayer();
    const enemy  = makeEnemy({ hp: 12 });
    const strike = { id: 'w_strike', type: 'attack', effects: [{ type: 'damage', value: 6 }] };

    playCard(strike, { player, enemy }, 'feral');
    expect(enemy.hp).toBeLessThanOrEqual(0); // 6 * 2 = 12 → exactly 0
  });
});

describe('Cozy personality full round', () => {
  it('cozy heals 1 HP on block and warm_blanket adds 2 extra block', () => {
    const player = makePlayer({ hp: 70 });
    const enemy  = makeEnemy();
    const defend = { id: 'w_defend', type: 'skill', effects: [{ type: 'block', value: 5 }] };

    playCard(defend, { player, enemy }, 'cozy', ['warm_blanket']);

    expect(player.hp).toBe(71);   // +1 from cozy
    expect(player.block).toBe(7); // 5 + 2 warm_blanket
  });
});
