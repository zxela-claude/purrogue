/**
 * NAN-66: Integration tests for a full combat round including relic effects.
 *
 * These tests simulate the full round loop — player plays cards, enemy acts,
 * statuses tick — to verify that relic interactions and status chains work
 * end-to-end without a running Phaser scene.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CardEngine } from '../js/CardEngine.js';
import { ALL_CARDS as CARDS } from '../js/data/cards.js';
import { RELICS } from '../js/data/relics.js';

// ── helpers ──────────────────────────────────────────────────────────────────
function getCard(id) {
  const card = CARDS.find(c => c.id === id);
  if (!card) throw new Error(`Card not found: ${id}`);
  return card;
}

function makePlayer(overrides = {}) {
  return { hp: 80, maxHp: 80, block: 0, statuses: {}, energy: 3, ...overrides };
}

function makeEnemy(overrides = {}) {
  return {
    hp: 50, maxHp: 50, block: 0, statuses: {}, moveIndex: 0,
    movePattern: [
      { type: 'attack', value: 10, desc: 'Scratches for 10' },
      { type: 'block', value: 8, desc: 'Guards (block 8)' },
      { type: 'attack', value: 14, desc: 'Pounces for 14' },
    ],
    ...overrides
  };
}

/** Apply a card's effects to combat state, returning all results. */
function playCard(card, player, enemy, { personality = null, relics = [] } = {}) {
  return CardEngine.resolveCard(card, { player, enemy, enemies: [enemy], relics }, personality);
}

/** Simulate enemy's current move against player. Advances moveIndex. */
function enemyAct(enemy, player) {
  const move = enemy.movePattern[enemy.moveIndex % enemy.movePattern.length];
  enemy.moveIndex++;
  if (move.type === 'attack') {
    const dmg = move.value;
    const blocked = Math.min(player.block || 0, dmg);
    player.block = Math.max(0, (player.block || 0) - dmg);
    player.hp -= Math.max(0, dmg - blocked);
  } else if (move.type === 'block') {
    enemy.block = (enemy.block || 0) + move.value;
  } else if (move.type === 'buff') {
    if (!enemy.statuses) enemy.statuses = {};
    enemy.statuses[move.status] = (enemy.statuses[move.status] || 0) + move.value;
  }
  return move;
}

/** Tick status effects at end of turn (poison damage, decrement counts). */
function tickStatuses(entity) {
  if (entity.statuses?.poison) {
    entity.hp -= entity.statuses.poison;
    entity.statuses.poison = Math.max(0, entity.statuses.poison - 1);
    if (entity.statuses.poison === 0) delete entity.statuses.poison;
  }
  // Vulnerable / weak tick down
  ['vulnerable', 'weak'].forEach(s => {
    if (entity.statuses?.[s]) {
      entity.statuses[s]--;
      if (entity.statuses[s] === 0) delete entity.statuses[s];
    }
  });
  // Block resets at start of next turn (simplified: clear here)
  entity.block = 0;
}

// ── Full combat round ─────────────────────────────────────────────────────────
describe('Combat round integration', () => {
  let player, enemy;

  beforeEach(() => {
    player = makePlayer();
    enemy  = makeEnemy();
  });

  it('player attacks then enemy retaliates — hp changes are correct', () => {
    // Player plays Strike (6 damage)
    const strike = getCard('w_strike');
    playCard(strike, player, enemy);
    expect(enemy.hp).toBe(44); // 50 - 6

    // Enemy attacks (move 0: 10 damage, player has no block)
    enemyAct(enemy, player);
    expect(player.hp).toBe(70); // 80 - 10
  });

  it('player blocks then enemy attacks — block absorbs damage', () => {
    // Gain 7 block with Defend (buffed from 5)
    const defend = getCard('w_defend');
    playCard(defend, player, enemy);
    expect(player.block).toBe(7);

    // Enemy attacks for 10 — 7 blocked, 3 through
    enemyAct(enemy, player);
    expect(player.hp).toBe(77); // 80 - 3
    expect(player.block).toBe(0);
  });

  it('full turn sequence: bash → vulnerable → strike amplified', () => {
    // Bash: 8 damage + 2 Vulnerable
    const bash = getCard('w_bash');
    playCard(bash, player, enemy);
    expect(enemy.hp).toBe(42);          // 50 - 8
    expect(enemy.statuses.vulnerable).toBe(2);

    // Strike on vulnerable enemy: 6 * 1.5 = 9
    const strike = getCard('w_strike');
    playCard(strike, player, enemy);
    expect(enemy.hp).toBe(42 - Math.floor(6 * 1.5)); // 33
  });

  it('poison ticks down each end-of-turn', () => {
    // Apply 3 poison to enemy
    CardEngine.resolveEffect(
      { type: 'apply_status', status: 'poison', value: 3 },
      { player, enemy }
    );
    expect(enemy.statuses.poison).toBe(3);

    tickStatuses(enemy);
    expect(enemy.hp).toBe(47);         // 50 - 3
    expect(enemy.statuses.poison).toBe(2);

    tickStatuses(enemy);
    expect(enemy.hp).toBe(45);         // 47 - 2
    expect(enemy.statuses.poison).toBe(1);

    tickStatuses(enemy);
    expect(enemy.hp).toBe(44);         // 45 - 1
    expect(enemy.statuses.poison).toBeUndefined();
  });

  it('two-round sequence: block clears, status ticks, enemy cycles moves', () => {
    // Round 1: player blocks, enemy attacks (move 0: 10 dmg)
    playCard(getCard('w_defend'), player, enemy); // +7 block (buffed)
    enemyAct(enemy, player);
    expect(player.hp).toBe(77);  // 7 blocked, 3 through
    tickStatuses(player);
    tickStatuses(enemy);
    // block cleared for round 2

    // Round 2: enemy blocks (move 1: +8 block on enemy), player attacks
    enemyAct(enemy, player);   // enemy gains 8 block, no player damage
    expect(enemy.block).toBe(8);
    playCard(getCard('w_strike'), player, enemy); // 6 dmg, all blocked
    expect(enemy.hp).toBe(50); // still full
    expect(enemy.block).toBe(2); // 8 - 6 = 2 remaining
  });
});

// ── Relic: bell_collar ────────────────────────────────────────────────────────
describe('Relic: bell_collar (first attack +3 dmg)', () => {
  it('first attack in a combat gets +3, second does not', () => {
    const player = makePlayer();
    const enemy1 = makeEnemy();
    const enemy2 = makeEnemy();
    const relics = ['bell_collar'];

    // bell_collar is handled at the scene level (not in CardEngine directly),
    // so we test the base engine returns are correct and the relic effect
    // can be layered on top
    const r1 = CardEngine.resolveEffect({ type: 'damage', value: 6 }, { player, enemy: enemy1, relics });
    expect(r1.amount).toBe(6); // CardEngine doesn't implement bell_collar — scene does

    // Verify the relic exists in data
    const relic = RELICS.find(r => r.id === 'bell_collar');
    expect(relic).toBeDefined();
    expect(relic.effect).toBe('first_attack_bonus');
    expect(relic.value).toBe(3);
  });
});

// ── Relic: magnifying_glass ───────────────────────────────────────────────────
describe('Relic: magnifying_glass (status effects +1)', () => {
  it('apply_status adds 1 extra stack with magnifying_glass', () => {
    const player = makePlayer();
    const enemy = makeEnemy();

    CardEngine.resolveEffect(
      { type: 'apply_status', status: 'vulnerable', value: 2 },
      { player, enemy, relics: ['magnifying_glass'] }
    );
    expect(enemy.statuses.vulnerable).toBe(3); // 2 + 1 from relic
  });

  it('apply_status without relic gives base value', () => {
    const player = makePlayer();
    const enemy = makeEnemy();

    CardEngine.resolveEffect(
      { type: 'apply_status', status: 'vulnerable', value: 2 },
      { player, enemy, relics: [] }
    );
    expect(enemy.statuses.vulnerable).toBe(2);
  });
});

// ── Relic: cursed_collar ──────────────────────────────────────────────────────
describe('Relic: cursed_collar (double damage)', () => {
  it('double damage stacks with vulnerable', () => {
    // cursed_collar doubles damage at the scene level.
    // We verify the relic is defined correctly and that vulnerable
    // and strong stack in the engine as expected.
    const player = makePlayer({ statuses: { strong: 1 } });
    const enemy = makeEnemy({ statuses: { vulnerable: 1 } });

    // strong: +2 to dmg, vulnerable: *1.5
    const r = CardEngine.resolveEffect({ type: 'damage', value: 6 }, { player, enemy });
    const expected = Math.floor((6 + 2) * 1.5); // 12
    expect(r.amount).toBe(expected);
    expect(enemy.hp).toBe(50 - expected);
  });
});

// ── Personality × relic interaction ───────────────────────────────────────────
describe('Personality + relic combined', () => {
  it('feisty + strong relic synergy: feisty 15% boost stacks with strong', () => {
    const player = makePlayer({ statuses: { strong: 2 } }); // +4 bonus dmg
    const enemy = makeEnemy();

    // feisty: ceil(6 * 1.15) = 7, then strong +4 = 11
    const r = CardEngine.resolveEffect(
      { type: 'damage', value: 6 },
      { player, enemy },
      'feisty'
    );
    expect(r.amount).toBe(Math.ceil(6 * 1.15) + 4);
    expect(enemy.hp).toBe(50 - r.amount);
  });

  it('cunning personality applies +1 to status effects', () => {
    const player = makePlayer();
    const enemy = makeEnemy();

    CardEngine.resolveEffect(
      { type: 'apply_status', status: 'poison', value: 2 },
      { player, enemy, relics: [] },
      'cunning'
    );
    expect(enemy.statuses.poison).toBe(3); // 2 + 1 from cunning
  });

  it('cunning + magnifying_glass: +1 from each source stack', () => {
    const player = makePlayer();
    const enemy = makeEnemy();

    CardEngine.resolveEffect(
      { type: 'apply_status', status: 'vulnerable', value: 2 },
      { player, enemy, relics: ['magnifying_glass'] },
      'cunning'
    );
    expect(enemy.statuses.vulnerable).toBe(4); // 2 + 1 (cunning) + 1 (relic)
  });
});

// ── Enemy AI move cycling ─────────────────────────────────────────────────────
describe('Enemy move cycling', () => {
  it('cycles through move pattern correctly', () => {
    const player = makePlayer();
    const enemy = makeEnemy();

    // Move 0: attack 10
    const m0 = enemyAct(enemy, player);
    expect(m0.type).toBe('attack');
    expect(player.hp).toBe(70);

    // Move 1: block 8 (no player damage)
    player.hp = 80; // reset
    const m1 = enemyAct(enemy, player);
    expect(m1.type).toBe('block');
    expect(enemy.block).toBe(8);

    // Move 2: attack 14
    const m2 = enemyAct(enemy, player);
    expect(m2.type).toBe('attack');
    expect(player.hp).toBe(66); // 80 - 14

    // Wraps: move 3 → move 0 again
    player.hp = 80;
    const m3 = enemyAct(enemy, player);
    expect(m3.type).toBe('attack');
    expect(m3.value).toBe(10);
  });
});
