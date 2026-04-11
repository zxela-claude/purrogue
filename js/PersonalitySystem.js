import { PERSONALITY } from './constants.js';

export class PersonalitySystem {
  static getMoodDescription(mood) {
    const descriptions = {
      [PERSONALITY.FEISTY]: { name: 'Feisty 😾', desc: 'Attack cards cost 1 less energy', color: '#e74c3c' },
      [PERSONALITY.COZY]: { name: 'Cozy 😸', desc: 'Block cards restore 1 HP', color: '#3498db' },
      [PERSONALITY.CUNNING]: { name: 'Cunning 😼', desc: 'Status effects apply +1 extra stack', color: '#9b59b6' },
      [PERSONALITY.FERAL]: { name: 'FERAL 🔥', desc: 'Double damage. No healing.', color: '#e67e22' },
    };
    return descriptions[mood] || null;
  }

  static getCardCost(card, mood) {
    let cost = card.cost;
    if (mood === PERSONALITY.FEISTY && card.type === 'attack') {
      cost = Math.max(0, cost - 1);
    }
    return cost;
  }

  static canHeal(mood) {
    return mood !== PERSONALITY.FERAL;
  }

  static getUpgradePath(card, mood) {
    if (!card.upgrades) return card.upgraded || card;
    return card.upgrades[mood] || card.upgrades.default || card;
  }

  static getUpgradeId(baseCardId, card, mood) {
    if (mood && card?.upgrades?.[mood]) {
      return `${baseCardId}_u_${mood}`;
    }
    return `${baseCardId}_u`;
  }
}
