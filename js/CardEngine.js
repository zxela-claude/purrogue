export class CardEngine {
  // Resolve a card's effects against combat state
  // combatState: { player, enemy, hand, drawPile, discardPile, statusEffects }
  static resolveCard(card, combatState, personality) {
    const results = [];
    for (const effect of card.effects) {
      const result = this.resolveEffect(effect, combatState, personality);
      results.push(result);
    }
    return results;
  }

  static resolveEffect(effect, { player, enemy, relics = [] }, personality) {
    let value = effect.value || 0;

    // Personality modifiers
    if (personality === 'feisty' && effect.type === 'damage') value = Math.ceil(value * 1.15);
    if (personality === 'feral' && effect.type === 'damage') value = value * 2;
    if (personality === 'cozy' && effect.type === 'block') {
      player.hp = Math.min(player.hp + 1, player.maxHp);
    }
    if (personality === 'cunning' && effect.type === 'apply_status') value += 1;

    switch (effect.type) {
      case 'damage': {
        let dmg = value;
        if (player.statuses?.strong) dmg += 2 * player.statuses.strong;
        if (enemy.statuses?.vulnerable) dmg = Math.floor(dmg * 1.5);
        if (player.statuses?.weak) dmg = Math.floor(dmg * 0.75);
        const blocked = Math.min(enemy.block || 0, dmg);
        enemy.block = Math.max(0, (enemy.block || 0) - dmg);
        enemy.hp -= Math.max(0, dmg - blocked);
        return { type: 'damage', amount: dmg, blocked };
      }

      case 'block':
        player.block = (player.block || 0) + value;
        return { type: 'block', amount: value };

      case 'draw':
        return { type: 'draw', amount: value };

      case 'heal':
        player.hp = Math.min(player.hp + value, player.maxHp);
        return { type: 'heal', amount: value };

      case 'gain_energy':
        return { type: 'gain_energy', amount: value };

      case 'apply_status': {
        if (!enemy.statuses) enemy.statuses = {};
        const statusAmt = value + (relics.includes('magnifying_glass') ? 1 : 0);
        enemy.statuses[effect.status] = (enemy.statuses[effect.status] || 0) + statusAmt;
        return { type: 'apply_status', status: effect.status, amount: statusAmt };
      }

      case 'apply_self_status':
        if (!player.statuses) player.statuses = {};
        player.statuses[effect.status] = (player.statuses[effect.status] || 0) + value;
        return { type: 'apply_self_status', status: effect.status, amount: value };

      case 'damage_all':
        // handled externally for multi-enemy (v2)
        return { type: 'damage_all', amount: value };

      default:
        return { type: 'noop' };
    }
  }

  static tickStatuses(combatant) {
    if (!combatant.statuses) return [];
    const expired = [];
    const { statuses } = combatant;

    // Poison: deal damage, then reduce by 1
    if (statuses.poison > 0) {
      combatant.hp -= statuses.poison;
      statuses.poison--;
      if (statuses.poison <= 0) { delete statuses.poison; expired.push('poison'); }
    }

    // Burn: deal 3 damage, remove
    if (statuses.burn > 0) {
      combatant.hp -= 3 * statuses.burn;
      delete statuses.burn;
      expired.push('burn');
    }

    // Freeze: skip turn, reduce by 1
    if (statuses.freeze > 0) {
      statuses.freeze--;
      if (statuses.freeze <= 0) { delete statuses.freeze; expired.push('freeze'); }
    }

    // Vulnerable/Weak: reduce by 1
    ['vulnerable', 'weak'].forEach(s => {
      if (statuses[s] > 0) {
        statuses[s]--;
        if (statuses[s] <= 0) { delete statuses[s]; expired.push(s); }
      }
    });

    // Bleed: deal damage equal to stacks, then reduce by 1
    if (statuses.bleed > 0) {
      combatant.hp -= statuses.bleed;
      statuses.bleed--;
      if (statuses.bleed <= 0) { delete statuses.bleed; expired.push('bleed'); }
    }

    // Strong: decrement (damage boost is applied in resolveEffect during damage calc)
    if (statuses.strong > 0) {
      statuses.strong--;
      if (statuses.strong <= 0) { delete statuses.strong; expired.push('strong'); }
    }

    return expired;
  }

  static resolveEnemyIntent(enemy, player) {
    // Check if enemy has dropped below HP threshold — if so use the escalated pattern
    const tb = enemy.thresholdBehavior;
    const useThreshold = tb && (enemy.hp / enemy.maxHp) < tb.below;
    const pattern = useThreshold ? tb.pattern : enemy.movePattern;
    const move = pattern[enemy.moveIndex % pattern.length];
    enemy.moveIndex = (enemy.moveIndex || 0) + 1;
    return move;
  }

  static executeEnemyMove(move, enemy, player) {
    switch (move.type) {
      case 'attack': {
        let dmg = move.value;
        if (enemy.statuses?.weak) dmg = Math.floor(dmg * 0.75);
        const blocked = Math.min(player.block || 0, dmg);
        player.block = Math.max(0, (player.block || 0) - dmg);
        player.hp -= Math.max(0, dmg - blocked);
        return { type: 'attack', amount: dmg, blocked };
      }
      case 'block':
        enemy.block = (enemy.block || 0) + move.value;
        return { type: 'block', amount: move.value };
      case 'buff':
        if (!enemy.statuses) enemy.statuses = {};
        enemy.statuses[move.status] = (enemy.statuses[move.status] || 0) + move.value;
        return { type: 'buff', status: move.status };
      default:
        return { type: 'noop' };
    }
  }
}
