import { COLORS, FERAL_WARNING_THRESHOLD, FONT_2XL, FONT_3XL, FONT_LG, FONT_MD, FONT_MD2, FONT_MICRO, FONT_SM, FONT_SM2, FONT_TINY, FONT_TITLE, FONT_XL, FONT_XS, FONT_XXS, NODE_TYPES, PERSONALITY, PERSONALITY_THRESHOLD, SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants.js';
import { MapGenerator } from '../MapGenerator.js';
import { PersonalitySystem } from '../PersonalitySystem.js';
import { ALL_CARDS } from '../data/cards.js';
import { MusicManager } from '../MusicManager.js';
import { RELICS } from '../data/relics.js';
import { GameState } from '../GameState.js';
import { getBiome } from '../DungeonBuilding.js';
import { PurrSettings } from '../PurrSettings.js';

const NODE_SPRITE_KEYS = {
  [NODE_TYPES.COMBAT]: 'node_combat',
  [NODE_TYPES.ELITE]: 'node_elite',
  [NODE_TYPES.SHOP]: 'node_shop',
  [NODE_TYPES.EVENT]: 'node_event',
  [NODE_TYPES.REST]: 'node_rest',
  [NODE_TYPES.BOSS]: 'node_boss'
};

export class MapScene extends Phaser.Scene {
  constructor() { super('MapScene'); }

  create() {
    const gs = this.registry.get('gameState');
    // NAN-215: resolve biome config for this act — drives node colours, labels, atmosphere
    const biome = getBiome(gs.act);
    const isNewAct = !gs.map;
    if (isNewAct) {
      // NAN-203: pass a deterministic seed — daily runs use the date seed so
      // every player gets the same map; casual runs derive a seed from the
      // run's daily seed or fall back to a random value stored on GameState.
      if (!gs.mapBaseSeed) {
        gs.mapBaseSeed = gs.dailySeed || (Math.random() * 0xFFFFFFFF | 0) || 1;
      }
      // Combine base seed with act number so each act has a different layout.
      const actSeed = `${gs.mapBaseSeed}_act${gs.act}`;
      gs.map = MapGenerator.generate(gs.act, { petite: gs.hasModifier && gs.hasModifier('petite') }, actSeed);
      // Daily modifier: elites_only — replace all COMBAT nodes with ELITE
      if (gs.isDaily && gs.dailyModifier && gs.dailyModifier.id === 'elites_only') {
        for (const floor of gs.map.floors) {
          for (const node of floor) {
            if (node.type === NODE_TYPES.COMBAT) node.type = NODE_TYPES.ELITE;
          }
        }
      }
      // Ancient Tome: upgrade a random non-upgraded card at the start of each act
      if (gs.relics.includes('ancient_tome')) {
        const upgradeable = gs.deck.filter(id => !/_u(_\w+)?$/.test(id));
        if (upgradeable.length > 0) {
          const pick = upgradeable[Math.floor(Math.random() * upgradeable.length)];
          gs.upgradeCard(pick, gs.personality.mood);
        }
      }
    }

    // Background music: return to ambient menu/map track between battles
    MusicManager.getInstance(this).play('menu');

    const mapBgKey = `bg_combat_${Math.min(gs.act || 1, 3)}`;
    if (this.textures.exists(mapBgKey)) {
      this.add.image(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, mapBgKey).setDisplaySize(SCREEN_WIDTH, SCREEN_HEIGHT).setDepth(-1);
      // NAN-215: use biome fog colour as the dark overlay tint
      this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, biome.fogColor, 0.6).setDepth(-1);
    } else {
      this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH, SCREEN_HEIGHT, COLORS.BG);
    }

    // Header — NAN-215: show biome name as act subtitle
    this.add.text(20, 20, `ACT ${gs.act} — FLOOR ${gs.floor + 1}/7`, { fontFamily: '"Press Start 2P"', fontSize: FONT_XL, color: '#f0ead6', stroke: '#000000', strokeThickness: 1 });
    this.add.text(20, 42, biome.headerSuffix, { fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: `#${biome.accentColor.toString(16).padStart(6, '0')}`, stroke: '#000000', strokeThickness: 1 });
    this.add.text(SCREEN_WIDTH - 20, 20, `❤️ ${gs.hp}/${gs.maxHp}  💰 ${gs.gold}`, { fontFamily: '"Press Start 2P"', fontSize: FONT_XL, color: '#f0ead6', stroke: '#000000', strokeThickness: 1 }).setOrigin(1, 0);

    // NAN-126: Floor pip progress indicator
    this._addFloorPips(gs);

    // NAN-117: Personality progress bar
    this._addPersonalityBar(gs);

    // NAN-118: Relic panel
    this._addRelicPanel(gs);

    // NAN-175: Ghost run tracker for daily challenge
    if (gs.isDaily && gs.dailySeed) {
      this._addGhostPanel(gs);
    }

    // Cat mood modifier banner — show once at the start of Act 1
    if (gs.act === 1 && gs.floor === 0 && gs.catMoodModifier && isNewAct) {
      this._showCatMoodBanner(gs.catMoodModifier);
    }

    // Settings gear (top-left below act label)
    this.add.text(20, SCREEN_HEIGHT - 20, '⚙', { fontSize: FONT_TITLE, color: '#444444' })
      .setOrigin(0, 1).setInteractive({ useHandCursor: true })
      .on('pointerover', function() { this.setColor('#aaaaaa'); })
      .on('pointerout',  function() { this.setColor('#444444'); })
      .on('pointerdown', () => {
        if (!this.scene.isActive('SettingsScene')) this.scene.launch('SettingsScene');
      });

    // Help button (bottom-left, next to gear)
    const helpBtn = this.add.text(56, SCREEN_HEIGHT - 20, '[?]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_LG, color: '#444466'
    }).setOrigin(0, 1).setInteractive({ useHandCursor: true });
    helpBtn.on('pointerover', function() { this.setColor('#aaaacc'); });
    helpBtn.on('pointerout',  function() { this.setColor('#444466'); });
    helpBtn.on('pointerdown', () => this._showHelpModal());

    const available = MapGenerator.getAvailableNodes(gs.map);
    const availableIds = new Set(available.map(n => n.id));
    this._mapKeyNodes = []; // populated below: [{node, fi, x}] sorted left→right

    // Draw nodes and connections
    const { floors } = gs.map;
    const floorH = (SCREEN_HEIGHT - 120) / floors.length;

    // Shared tooltip objects (reused across all node hovers)
    const tipBg   = this.add.rectangle(0, 0, 120, 28, 0x111122, 0.9).setDepth(20).setVisible(false);
    const tipText = this.add.text(0, 0, '', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#f0ead6'
    }).setOrigin(0.5).setDepth(21).setVisible(false);

    const showTip = (x, y, label) => {
      tipText.setText(label);
      const tw = tipText.width + 16;
      tipBg.setSize(tw, 28);
      // Position above node, clamp to screen edges
      const tx = Phaser.Math.Clamp(x, tw / 2 + 4, SCREEN_WIDTH - tw / 2 - 4);
      const ty = Math.max(y - 46, 20);
      tipBg.setPosition(tx, ty).setVisible(true);
      tipText.setPosition(tx, ty).setVisible(true);
    };
    const hideTip = () => { tipBg.setVisible(false); tipText.setVisible(false); };

    floors.forEach((floor, fi) => {
      const y = SCREEN_HEIGHT - 60 - fi * floorH;
      floor.forEach((node, ni) => {
        const x = SCREEN_WIDTH * (ni + 1) / (floor.length + 1);

        // Draw connections to next floor
        if (fi < floors.length - 1) {
          node.connections.forEach(targetId => {
            const nextFloor = floors[fi + 1];
            const target = nextFloor.find(n => n.id === targetId);
            if (target) {
              const tx = SCREEN_WIDTH * (nextFloor.indexOf(target) + 1) / (nextFloor.length + 1);
              const ty = SCREEN_HEIGHT - 60 - (fi + 1) * floorH;
              this.add.line(0, 0, x, y, tx, ty, 0x444444).setOrigin(0, 0);
            }
          });
        }

        // Draw node — NAN-215: node colour and label come from the biome data asset
        const isAvail = availableIds.has(node.id);
        const color = node.completed ? 0x444444 : (biome.nodeColors[node.type] ?? 0x888888);
        const circle = this.add.circle(x, y, 28, color, node.completed ? 0.3 : 0.85);
        const nodeSprite = this.add.image(x, y, NODE_SPRITE_KEYS[node.type]).setDisplaySize(40, 40);
        if (node.completed) nodeSprite.setAlpha(0.35);

        const label = (node.completed ? '✓ ' : '') + (biome.nodeLabels[node.type] || node.type);

        if (isAvail && !node.completed) {
          // Pulsing outline
          const outline = this.add.circle(x, y, 28, 0xffd700, 0).setStrokeStyle(2, 0xffd700);
          this.tweens.add({ targets: outline, alpha: { from: 0.3, to: 1 }, duration: 800, yoyo: true, repeat: -1 });

          // Track for keyboard navigation (sorted by x = left→right)
          this._mapKeyNodes.push({ node, fi, x });
          this._mapKeyNodes.sort((a, b) => a.x - b.x);

          // Invisible 48px hit zone for easy mobile tapping
          const hitZone = this.add.circle(x, y, 48, 0xffffff, 0)
            .setInteractive({ useHandCursor: true });
          hitZone.on('pointerover', () => showTip(x, y, label));
          hitZone.on('pointerout',  hideTip);
          hitZone.on('pointerdown', () => {
            hideTip();
            node.completed = true;
            gs.map.currentNode = node.id;
            gs.map.currentFloor = fi;
            gs.floor = fi;
            gs.save();
            this._enterNode(node, gs);
          });
        } else {
          // Non-interactive nodes still get a hover tooltip
          const hoverZone = this.add.circle(x, y, 32, 0xffffff, 0)
            .setInteractive();
          hoverZone.on('pointerover', () => showTip(x, y, label));
          hoverZone.on('pointerout',  hideTip);
        }
      });
    });

    // Add key-number labels above available nodes (sorted left→right)
    this._mapKeyNodes.forEach(({ x, fi }, i) => {
      if (i >= 5) return;
      const y = SCREEN_HEIGHT - 60 - fi * ((SCREEN_HEIGHT - 120) / floors.length);
      this.add.text(x, y - 44, `[${i+1}]`, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#ffd700'
      }).setOrigin(0.5).setDepth(5);
    });

    // Deck viewer button (backed by a 200×44 hit zone for mobile)
    this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT - 20, '[ VIEW DECK ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_LG, color: '#aaaaaa'
    }).setOrigin(0.5);
    this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT - 20, 200, 44, 0xffffff, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this._showDeck(gs));

    if (gs.personality.feralPending && !gs.personality.feral) {
      this._showFeralWarning(gs);
    }
    PurrSettings.scaleSceneText(this); // NAN-222

    // Keyboard: 1-N selects available nodes sorted left→right, D views deck
    const NUM_KEYS = ['ONE','TWO','THREE','FOUR','FIVE'];
    this._mapKeyNodes.forEach((entry, i) => {
      if (i >= NUM_KEYS.length) return;
      this.input.keyboard.on(`keydown-${NUM_KEYS[i]}`, () => {
        if (this._mapChosen) return;
        this._mapChosen = true;
        const { node, fi } = entry;
        node.completed = true;
        gs.map.currentNode = node.id;
        gs.map.currentFloor = fi;
        gs.floor = fi;
        gs.save();
        this._enterNode(node, gs);
      });
    });
    this.input.keyboard.on('keydown-D', () => this._showDeck(gs));
  }

  _enterNode(node, gs) {
    const actStart = gs.floor === 0;
    switch(node.type) {
      case NODE_TYPES.COMBAT: this.scene.start('CombatScene', { elite: false, actStart }); break;
      case NODE_TYPES.ELITE: this.scene.start('CombatScene', { elite: true, actStart }); break;
      case NODE_TYPES.SHOP: this.scene.start('ShopScene'); break;
      case NODE_TYPES.EVENT: this.scene.start('EventScene'); break;
      case NODE_TYPES.BOSS: this.scene.start('CombatScene', { boss: true, actStart }); break;
      case NODE_TYPES.REST: this._showRestMenu(gs); break;
    }
  }

  _showRestMenu(gs) {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
    if (this.textures.exists('bg_rest')) {
      this.add.image(W/2, H/2, 'bg_rest').setDisplaySize(420, 360).setDepth(9).setAlpha(0.35);
    }
    const overlay = this.add.rectangle(W/2, H/2, 420, 360, COLORS.PANEL, 0.85).setDepth(10);
    const border = this.add.graphics().setDepth(10);
    border.lineStyle(2, 0x4caf50);
    border.strokeRect(W/2 - 210, H/2 - 180, 420, 360);

    this.add.text(W/2, H/2 - 148, '🛏 REST SITE', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_3XL, color: '#f0ead6'
    }).setOrigin(0.5).setDepth(11);

    const healAmt = 8 + (gs.relics.includes('cat_nap') ? 8 : 0);
    const canHeal = PersonalitySystem.canHeal(gs.getDominantPersonality());
    const noHealing = gs.hasModifier && gs.hasModifier('no_healing');

    // Option 1: Rest / Block
    const restLabel = noHealing
      ? `REST — Gain 8 🛡 Block (No Healing)`
      : `REST — Heal ${healAmt} HP`;
    const restColor = noHealing ? '#4fc3f7' : (canHeal ? '#4caf50' : '#555555');
    this.add.text(W/2, H/2 - 80, restLabel, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_LG,
      color: restColor
    }).setOrigin(0.5).setDepth(11)
      .setInteractive({ useHandCursor: noHealing || canHeal })
      .on('pointerdown', () => {
        if (!noHealing && !canHeal) return;
        if (noHealing) {
          gs.playerBlock = (gs.playerBlock || 0) + 8;
          gs.save();
        } else if (canHeal) {
          gs.heal(healAmt);
        }
        this.scene.start('MapScene');
      });
    if (noHealing) {
      this.add.text(W/2, H/2 - 58, '✕ HEAL BLOCKED by daily modifier', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#e94560'
      }).setOrigin(0.5).setDepth(11);
    } else if (!canHeal) {
      this.add.text(W/2, H/2 - 58, '🔥 Feral — healing blocked', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#e67e22'
      }).setOrigin(0.5).setDepth(11);
    }

    // Option 2: Smith
    const upgradeable = gs.deck.filter(id => !/_u(_\w+)?$/.test(id));
    const hasUpgradeable = upgradeable.length > 0;
    this.add.text(W/2, H/2 - 20, 'SMITH — Upgrade a card', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_LG,
      color: hasUpgradeable ? '#ffd700' : '#555555'
    }).setOrigin(0.5).setDepth(11)
      .setInteractive({ useHandCursor: hasUpgradeable })
      .on('pointerdown', () => {
        if (!hasUpgradeable) return;
        overlay.destroy(); border.destroy();
        this._showSmithMenu(gs);
      });

    // Option 3: Reflect (remove a card)
    const removable = gs.deck.length > 1; // keep at least 1 card
    this.add.text(W/2, H/2 + 40, 'REFLECT — Remove a card', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_LG,
      color: removable ? '#e94560' : '#555555'
    }).setOrigin(0.5).setDepth(11)
      .setInteractive({ useHandCursor: removable })
      .on('pointerdown', () => {
        if (!removable) return;
        overlay.destroy(); border.destroy();
        this._showRemoveMenu(gs, 'MapScene');
      });

    // Cancel
    this.add.text(W/2, H/2 + 130, '[ LEAVE ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#aaaaaa'
    }).setOrigin(0.5).setDepth(11)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MapScene'));
  }

  _showRemoveMenu(gs, returnScene) {
    const allCards = ALL_CARDS;
    const cardDb = {};
    for (const c of allCards) {
      cardDb[c.id] = c;
      if (c.upgrades) {
        for (const [mood, upgrade] of Object.entries(c.upgrades)) {
          const uid = mood === 'default' ? `${c.id}_u` : `${c.id}_u_${mood}`;
          cardDb[uid] = { ...c, id: uid, name: c.name + '+', effects: upgrade.effects };
        }
      }
    }

    const group = this.add.group();
    const bg = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH - 100, SCREEN_HEIGHT - 100, COLORS.PANEL).setDepth(20);
    group.add(bg);
    const title = this.add.text(SCREEN_WIDTH/2, 80, 'REFLECT — Choose a card to remove', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_LG, color: '#e94560'
    }).setOrigin(0.5).setDepth(21);
    group.add(title);

    const removable = gs.deck.slice(0, gs.deck.length - 1); // keep at least 1
    removable.forEach((cardId, i) => {
      const card = cardDb[cardId];
      if (!card) return;
      const col = i % 4, row = Math.floor(i / 4);
      const x = 220 + col * 220, y = 155 + row * 56;
      const isUpgraded = cardId.includes('_u');
      const nameColor = isUpgraded ? '#ffd700' : '#f0ead6';

      // NAN-232: show cost, type, and effect summary below card name
      const costTypeLabel = `[${card.cost ?? '?'}] ${(card.type || '').toUpperCase()}`;
      const effectDesc = this._effectSummary(card.effects);
      const contextLine = effectDesc ? `${costTypeLabel} · ${effectDesc}` : costTypeLabel;

      const btn = this.add.text(x, y - 6, `✕ ${card.name}${isUpgraded ? '+' : ''}`, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_MD, color: nameColor
      }).setDepth(21).setInteractive({ useHandCursor: true });
      const ctxText = this.add.text(x, y + 10, contextLine, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_TINY, color: '#7799cc'
      }).setDepth(21);
      btn.on('pointerover', function() { this.setColor('#e94560'); });
      btn.on('pointerout', function() { this.setColor(nameColor); });
      btn.on('pointerdown', () => {
        gs.removeCard(cardId);
        group.destroy(true);
        this.scene.start(returnScene);
      });
      group.add(btn);
      group.add(ctxText);
    });

    const cancelBtn = this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT - 55, '[ CANCEL ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_LG, color: '#aaaaaa'
    }).setOrigin(0.5).setDepth(21)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { group.destroy(true); this.scene.start(returnScene); });
    group.add(cancelBtn);
  }

  _showDeck(gs) {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
    const allCards = ALL_CARDS;
    const cardDb = {};
    for (const c of allCards) {
      cardDb[c.id] = c;
      if (c.upgrades) {
        for (const [mood, upgrade] of Object.entries(c.upgrades)) {
          const upgradeId = mood === 'default' ? `${c.id}_u` : `${c.id}_u_${mood}`;
          cardDb[upgradeId] = { ...c, id: upgradeId, name: c.name + '+', effects: upgrade.effects };
        }
      }
    }

    const CARD_TYPE_COLORS = { attack: '#e94560', skill: '#4fc3f7', power: '#9b59b6' };

    const group = this.add.group();

    // Backdrop — click outside to close
    const backdrop = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.75)
      .setDepth(20).setInteractive();
    backdrop.on('pointerdown', () => { group.destroy(true); escKey.removeAllListeners(); });
    group.add(backdrop);

    const panelW = Math.min(W - 60, 760);
    const panelH = H - 80;
    const panelX = W / 2, panelY = H / 2;

    const bg = this.add.rectangle(panelX, panelY, panelW, panelH, COLORS.PANEL).setDepth(21);
    const border = this.add.graphics().setDepth(21);
    border.lineStyle(2, 0x4fc3f7);
    border.strokeRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH);
    group.add(bg);
    group.add(border);

    const title = this.add.text(panelX, panelY - panelH / 2 + 22, `FULL DECK — ${gs.deck.length} cards`, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_LG, color: '#4fc3f7'
    }).setOrigin(0.5).setDepth(22);
    group.add(title);

    const sub = this.add.text(panelX, panelY - panelH / 2 + 44, '[ESC] or click outside to close', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#666666'
    }).setOrigin(0.5).setDepth(22);
    group.add(sub);

    const sep = this.add.graphics().setDepth(22);
    sep.lineStyle(1, 0x222244);
    sep.lineBetween(panelX - panelW / 2 + 16, panelY - panelH / 2 + 56, panelX + panelW / 2 - 16, panelY - panelH / 2 + 56);
    group.add(sep);

    const cols = 3;
    const rowH = 34;
    const colW = Math.floor((panelW - 32) / cols);
    const startY = panelY - panelH / 2 + 74;

    gs.deck.forEach((cardId, i) => {
      const card = cardDb[cardId];
      if (!card) return;
      const col = i % cols, row = Math.floor(i / cols);
      const cx = panelX - panelW / 2 + 16 + col * colW;
      const cy = startY + row * rowH;

      const typeCol = CARD_TYPE_COLORS[card.type] || '#888888';
      const isUpgraded = cardId.includes('_u');

      const pip = this.add.rectangle(cx + 6, cy + rowH / 2 - 1, 10, 10,
        Phaser.Display.Color.HexStringToColor(typeCol).color).setDepth(22);
      group.add(pip);

      const nameText = this.add.text(cx + 18, cy + 4, card.name + (isUpgraded ? '+' : ''), {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: isUpgraded ? '#ffd700' : '#f0ead6'
      }).setDepth(22);
      group.add(nameText);

      const effects = card.effects || [];
      const dmgEffect = effects.find(e => e.type === 'damage');
      const blockEffect = effects.find(e => e.type === 'block');
      const statParts = [`Cost:${card.cost ?? '?'}`, card.type.toUpperCase()];
      if (dmgEffect) statParts.push(`DMG:${dmgEffect.value}`);
      if (blockEffect) statParts.push(`BLK:${blockEffect.value}`);

      const statText = this.add.text(cx + 18, cy + 18, statParts.join('  '), {
        fontFamily: '"Press Start 2P"', fontSize: FONT_TINY, color: typeCol
      }).setDepth(22);
      group.add(statText);

      if (row > 0) {
        const rowSep = this.add.graphics().setDepth(21);
        rowSep.lineStyle(1, 0x111133);
        rowSep.lineBetween(cx, cy, cx + colW - 4, cy);
        group.add(rowSep);
      }
    });

    const closeBtn = this.add.text(panelX, panelY + panelH / 2 - 16, '[ CLOSE ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD, color: '#e94560'
    }).setOrigin(0.5).setDepth(22).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { group.destroy(true); escKey.removeAllListeners(); });
    group.add(closeBtn);

    // Escape key to close
    const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.once('down', () => { group.destroy(true); });
  }

  // NAN-231: generate a short effect summary for the smith list (e.g. "Deal 6 dmg + 2 Vuln")
  _effectSummary(effects) {
    if (!effects || effects.length === 0) return '';
    const STATUS_ABBR = { vulnerable: 'Vuln', weak: 'Weak', burn: 'Burn', poison: 'Poison', freeze: 'Freeze', bleed: 'Bleed', thorns: 'Thorns', strong: 'Strong' };
    const parts = [];
    for (const e of effects) {
      if (parts.length >= 2) { parts.push('…'); break; }
      if (e.type === 'damage')             parts.push(`${e.value} dmg`);
      else if (e.type === 'block')         parts.push(`+${e.value} block`);
      else if (e.type === 'draw')          parts.push(`Draw ${e.value}`);
      else if (e.type === 'heal')          parts.push(`+${e.value} HP`);
      else if (e.type === 'gain_energy')   parts.push(`+${e.value} nrg`);
      else if (e.type === 'apply_status')  parts.push(`${e.value} ${STATUS_ABBR[e.status] || e.status}`);
      else if (e.type === 'apply_self_status') parts.push(`+${e.value} ${STATUS_ABBR[e.status] || e.status}`);
      else if (e.type === 'scry')          parts.push(`Scry ${e.value}`);
      else if (e.type === 'feral_override') parts.push(`Feral ${e.damage} dmg`);
    }
    return parts.join(' + ');
  }

  // NAN-211: draw a mini card frame (before or after upgrade) into a Phaser container
  _buildSmithCardPreview(card, tinted = false) {
    const CARD_TYPE_COLORS = { attack: 0xe94560, skill: 0x4fc3f7, power: 0x9b59b6 };
    const RARITY_BORDER_COLORS = { common: 0x888888, uncommon: 0x22cc77, rare: 0xffd700 };
    const CW = 130, CH = 170;
    const container = this.add.container(0, 0);

    // Shadow
    container.add(this.add.rectangle(3, 4, CW, CH, 0x000000, 0.5));

    // Body
    const bodyColor = tinted ? 0x1e3a1e : 0x1e2a4a;
    container.add(this.add.rectangle(0, 0, CW, CH, bodyColor));

    // Rarity border
    const rarityColor = RARITY_BORDER_COLORS[card.rarity] || 0x888888;
    const borderGfx = this.add.graphics();
    borderGfx.lineStyle(3, tinted ? 0x44ff88 : rarityColor);
    borderGfx.strokeRect(-CW/2, -CH/2, CW, CH);
    container.add(borderGfx);

    // Type pip (top-right)
    const typeColor = CARD_TYPE_COLORS[card.type] || 0x666666;
    container.add(this.add.rectangle(CW/2 - 10, -CH/2 + 10, 18, 18, typeColor));

    // Cost (top-left)
    container.add(this.add.text(-CW/2 + 7, -CH/2 + 6, `${card.cost}`, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM2, color: '#ffd700'
    }));

    // Card art
    const baseCardId = card.id.replace(/_u(_\w+)?$/, '');
    const artKey = `card_art_${baseCardId}`;
    if (this.textures && this.textures.exists(artKey)) {
      container.add(this.add.rectangle(0, -10, 84, 84, 0x000000, 0.3));
      container.add(this.add.image(0, -10, artKey).setDisplaySize(80, 80));
    } else {
      // Placeholder art area
      const artGfx = this.add.graphics();
      artGfx.fillStyle(0x000000, 0.3);
      artGfx.fillRect(-42, -52, 84, 84);
      container.add(artGfx);
    }

    // Card name
    container.add(this.add.text(0, -70, card.name, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_TINY, color: '#f0ead6',
      wordWrap: { width: 110 }, align: 'center'
    }).setOrigin(0.5));

    // Description
    container.add(this.add.text(0, 52, card.description, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MICRO, color: tinted ? '#aaffbb' : '#aaaaaa',
      wordWrap: { width: 114 }, align: 'center'
    }).setOrigin(0.5));

    // Rarity label (bottom-left)
    container.add(this.add.text(-CW/2 + 4, CH/2 - 14, card.rarity ? card.rarity[0].toUpperCase() : '', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_TINY,
      color: `#${rarityColor.toString(16).padStart(6, '0')}`
    }));

    return container;
  }

  _showSmithMenu(gs) {
    const mood = gs.getDominantPersonality();
    const allCards = ALL_CARDS;
    const cardDb = {};
    for (const c of allCards) {
      cardDb[c.id] = c;
      if (c.upgrades) {
        for (const [m, upgrade] of Object.entries(c.upgrades)) {
          const upgradeId = m === 'default' ? `${c.id}_u` : `${c.id}_u_${m}`;
          const upgradeDesc = upgrade.description || c.description;
          cardDb[upgradeId] = { ...c, id: upgradeId, name: c.name + '+', effects: upgrade.effects, description: upgradeDesc };
        }
      }
    }
    const upgradeable = gs.deck.filter(id => !id.includes('_u') && cardDb[id]?.upgrades);

    const group = this.add.group();
    const bg = this.add.rectangle(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, SCREEN_WIDTH - 60, SCREEN_HEIGHT - 60, COLORS.PANEL, 0.96).setDepth(20);
    group.add(bg);
    const border = this.add.graphics().setDepth(20);
    border.lineStyle(2, 0xffd700);
    border.strokeRect(30, 30, SCREEN_WIDTH - 60, SCREEN_HEIGHT - 60);
    group.add(border);

    const title = this.add.text(SCREEN_WIDTH/2, 58, '⚒  SMITH', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_3XL, color: '#ffd700'
    }).setOrigin(0.5).setDepth(21);
    group.add(title);

    // Preview containers tracked outside if/else so cancel can clean them up
    let smithBeforeContainer = null, smithAfterContainer = null;
    const destroyPreviews = () => {
      if (smithBeforeContainer) { smithBeforeContainer.destroy(true); smithBeforeContainer = null; }
      if (smithAfterContainer)  { smithAfterContainer.destroy(true);  smithAfterContainer = null; }
    };

    if (upgradeable.length === 0) {
      const t = this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT/2, 'No cards to upgrade!', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_XL, color: '#aaaaaa'
      }).setOrigin(0.5).setDepth(21);
      group.add(t);
    } else {
      // ── Left panel: card list ─────────────────────────────────────────────
      const listX = 200;
      group.add(this.add.text(listX, 100, 'Choose a card:', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM2, color: '#aaaaaa'
      }).setOrigin(0.5).setDepth(21));

      // ── Right panel: before/after preview ────────────────────────────────
      const previewLabelY = 100;
      const previewY = SCREEN_HEIGHT / 2 + 20;
      const beforeX = SCREEN_WIDTH - 360;
      const afterX  = SCREEN_WIDTH - 180;

      const beforeLabel = this.add.text(beforeX, previewLabelY, 'BEFORE', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#888888'
      }).setOrigin(0.5).setDepth(21).setAlpha(0);
      group.add(beforeLabel);

      const afterLabel = this.add.text(afterX, previewLabelY, 'AFTER', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#44ff88'
      }).setOrigin(0.5).setDepth(21).setAlpha(0);
      group.add(afterLabel);

      const arrowLabel = this.add.text((beforeX + afterX)/2, previewY, '→', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_TITLE, color: '#ffd700'
      }).setOrigin(0.5).setDepth(21).setAlpha(0);
      group.add(arrowLabel);

      // Upgrade button (shown when a card is selected)
      const upgradeBtn = this.add.text(afterX, previewY + 120, '[ UPGRADE ]', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#ffd700'
      }).setOrigin(0.5).setDepth(22).setAlpha(0);
      group.add(upgradeBtn);

      // Selected card state
      let selectedCardId = null;

      const showPreview = (cardId) => {
        selectedCardId = cardId;
        const card = cardDb[cardId];

        // Get the upgraded card — 'default' maps to cardId_u, mood-specific to cardId_u_mood
        const upgMood = mood || 'default';
        const hasSpecific = upgMood !== 'default' && card.upgrades[upgMood];
        const upgKey = hasSpecific ? `${cardId}_u_${upgMood}` : `${cardId}_u`;
        const upgCard = cardDb[upgKey] || { ...card, name: card.name + '+', id: upgKey };

        // Destroy old previews
        destroyPreviews();

        smithBeforeContainer = this._buildSmithCardPreview(card, false);
        smithBeforeContainer.setPosition(beforeX, previewY).setDepth(22);

        smithAfterContainer = this._buildSmithCardPreview(upgCard, true);
        smithAfterContainer.setPosition(afterX, previewY).setDepth(22);

        beforeLabel.setAlpha(1);
        afterLabel.setAlpha(1);
        arrowLabel.setAlpha(1);
        upgradeBtn.setAlpha(1).setInteractive({ useHandCursor: true });
        upgradeBtn.removeListener('pointerdown');
        upgradeBtn.on('pointerdown', () => {
          gs.upgradeCard(selectedCardId, mood);
          destroyPreviews();
          group.destroy(true);
          this.scene.start('MapScene');
        });
      };

      // Card list buttons
      upgradeable.forEach((cardId, i) => {
        const card = cardDb[cardId];
        const y = 130 + i * 46;
        const isSelected = () => selectedCardId === cardId;

        // Compute before/after effect summary for inline display (NAN-231)
        const upgMoodKey = mood || 'default';
        const hasSpecific = upgMoodKey !== 'default' && card.upgrades?.[upgMoodKey];
        const upgKey = hasSpecific ? `${cardId}_u_${upgMoodKey}` : `${cardId}_u`;
        const upgCard = cardDb[upgKey];
        const beforeSummary = this._effectSummary(card.effects);
        const afterSummary  = upgCard ? this._effectSummary(upgCard.effects) : beforeSummary;
        const effectLine = beforeSummary || afterSummary
          ? `${beforeSummary} → ${afterSummary}`
          : '';

        const rowBg = this.add.rectangle(listX, y, 300, 42, 0x000000, 0).setDepth(21).setInteractive({ useHandCursor: true });
        const btn = this.add.text(listX + 10, y - 8, `► ${card.name}`, {
          fontFamily: '"Press Start 2P"', fontSize: FONT_MD, color: '#f0ead6'
        }).setOrigin(0, 0.5).setDepth(22);

        const effectHint = this.add.text(listX + 10, y + 10, effectLine, {
          fontFamily: '"Press Start 2P"', fontSize: FONT_TINY, color: '#7799cc'
        }).setOrigin(0, 0.5).setDepth(22);

        const rarityDot = this.add.text(listX - 120, y, '●', {
          fontFamily: '"Press Start 2P"', fontSize: FONT_SM,
          color: card.rarity === 'rare' ? '#ffd700' : card.rarity === 'uncommon' ? '#22cc77' : '#888888'
        }).setOrigin(0.5).setDepth(22);

        group.add(rowBg); group.add(btn); group.add(effectHint); group.add(rarityDot);

        rowBg.on('pointerover', () => {
          btn.setColor('#ffd700');
          rowBg.setFillStyle(0x1e2a4a, 0.6);
        });
        rowBg.on('pointerout', () => {
          btn.setColor(isSelected() ? '#ffd700' : '#f0ead6');
          rowBg.setFillStyle(0x000000, isSelected() ? 0.3 : 0);
        });
        rowBg.on('pointerdown', () => {
          // Reset all buttons
          group.getChildren().forEach(c => {
            if (c.type === 'Text' && c !== title && c !== beforeLabel && c !== afterLabel && c !== arrowLabel && c !== upgradeBtn) {
              if (typeof c.setColor === 'function') c.setColor('#f0ead6');
            }
          });
          btn.setColor('#ffd700');
          rowBg.setFillStyle(0x1e2a4a, 0.3);
          showPreview(cardId);
        });

        // Auto-select first card on open
        if (i === 0) {
          this.time.delayedCall(0, () => {
            btn.setColor('#ffd700');
            showPreview(cardId);
          });
        }
      });
    }

    const cancelBtn = this.add.text(SCREEN_WIDTH/2, SCREEN_HEIGHT - 42, '[ CANCEL ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#e94560'
    }).setOrigin(0.5).setDepth(21)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { destroyPreviews(); group.destroy(true); this.scene.start('MapScene'); });
    group.add(cancelBtn);
  }

  _addFloorPips(gs) {
    // NAN-126: Row of floor progress pips centered at Y=50
    // 6 small circles for floors 0-5, then a ★ for floor 6 (boss)
    const TOTAL_FLOORS = 7; // 6 normal + 1 boss
    const PIP_R = 6;
    const GAP = 18;
    const totalWidth = (TOTAL_FLOORS - 1) * GAP;
    const startX = SCREEN_WIDTH / 2 - totalWidth / 2;
    const pipY = 50;

    const gfx = this.add.graphics();

    for (let i = 0; i < TOTAL_FLOORS; i++) {
      const px = startX + i * GAP;
      const isBossFloor = (i === TOTAL_FLOORS - 1);
      const isCurrent = (i === gs.floor);
      const isCompleted = (i < gs.floor);

      if (isBossFloor) {
        // Star for boss floor
        const starColor = isCurrent ? '#ffd700' : (isCompleted ? '#666666' : '#444444');
        this.add.text(px, pipY, '★', {
          fontSize: FONT_LG, color: starColor
        }).setOrigin(0.5).setStroke('#000000', 2);
      } else {
        // Pip circle
        if (isCurrent) {
          gfx.fillStyle(0xffd700, 1.0);
          gfx.fillCircle(px, pipY, PIP_R);
          gfx.lineStyle(2, 0xffd700, 1.0);
          gfx.strokeCircle(px, pipY, PIP_R);
        } else if (isCompleted) {
          gfx.fillStyle(0x444444, 1.0);
          gfx.fillCircle(px, pipY, PIP_R);
          // Checkmark tint
          gfx.lineStyle(1, 0x888888, 0.6);
          gfx.strokeCircle(px, pipY, PIP_R);
          this.add.text(px, pipY, '✓', {
            fontSize: FONT_XXS, color: '#888888'
          }).setOrigin(0.5);
        } else {
          gfx.fillStyle(0x222233, 1.0);
          gfx.fillCircle(px, pipY, PIP_R);
          gfx.lineStyle(1, 0x444466, 0.8);
          gfx.strokeCircle(px, pipY, PIP_R);
        }
      }
    }

    // NAN-126: Boss warning — pulsing red text when floor === 5 (one before boss)
    if (gs.floor === 5) {
      const warning = this.add.text(SCREEN_WIDTH / 2, 68, '⚠ BOSS NEXT', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#e94560',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5);
      this.tweens.add({
        targets: warning,
        alpha: { from: 1, to: 0.2 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  _addPersonalityBar(gs) {
    const p = gs.personality;
    const MOOD_COLORS = {
      [PERSONALITY.FEISTY]: '#e74c3c',
      [PERSONALITY.COZY]:   '#3498db',
      [PERSONALITY.CUNNING]:'#9b59b6',
      [PERSONALITY.FERAL]:  '#e67e22'
    };
    const MOOD_LABELS = {
      [PERSONALITY.FEISTY]: 'Feisty',
      [PERSONALITY.COZY]:   'Cozy',
      [PERSONALITY.CUNNING]:'Cunning',
      [PERSONALITY.FERAL]:  'Feral'
    };

    // Draw personality bar using Phaser graphics instead of Unicode block chars
    // (Press Start 2P bitmap font may not contain ▓/░ glyphs — NAN-239)
    const BAR_W = 100;
    const BAR_H = 8;
    const BAR_Y = 22;
    const cx = SCREEN_WIDTH / 2;

    if (p.mood !== null) {
      // Mood locked — full solid bar + LOCKED label
      const col = MOOD_COLORS[p.mood] || '#f0ead6';
      const colNum = parseInt(col.replace('#', ''), 16);
      const moodName = MOOD_LABELS[p.mood] || p.mood;

      this.add.text(cx - BAR_W / 2 - 4, 20, moodName, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: col,
        stroke: '#000000', strokeThickness: 1
      }).setOrigin(1, 0);

      const gfx = this.add.graphics();
      // Background track
      gfx.fillStyle(0x333333, 1);
      gfx.fillRect(cx - BAR_W / 2, BAR_Y, BAR_W, BAR_H);
      // Full filled bar
      gfx.fillStyle(colNum, 1);
      gfx.fillRect(cx - BAR_W / 2, BAR_Y, BAR_W, BAR_H);

      this.add.text(cx + BAR_W / 2 + 4, 20, 'LOCKED', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: col,
        stroke: '#000000', strokeThickness: 1
      }).setOrigin(0, 0);
    } else {
      // In progress — find dominant counter, draw partial bar
      const counters = [
        { key: PERSONALITY.FEISTY, val: p.feisty || 0 },
        { key: PERSONALITY.COZY,   val: p.cozy   || 0 },
        { key: PERSONALITY.CUNNING,val: p.cunning || 0 }
      ];
      const dominant = counters.reduce((a, b) => b.val > a.val ? b : a, counters[0]);
      const count = dominant.val;
      const threshold = PERSONALITY_THRESHOLD;
      const fillFrac = Math.min(1, count / threshold);
      const col = MOOD_COLORS[dominant.key] || '#f0ead6';
      const colNum = parseInt(col.replace('#', ''), 16);
      const moodName = MOOD_LABELS[dominant.key] || dominant.key;

      this.add.text(cx - BAR_W / 2 - 4, 20, moodName, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: col,
        stroke: '#000000', strokeThickness: 1
      }).setOrigin(1, 0);

      const gfx = this.add.graphics();
      // Background track
      gfx.fillStyle(0x333333, 1);
      gfx.fillRect(cx - BAR_W / 2, BAR_Y, BAR_W, BAR_H);
      // Filled portion
      if (fillFrac > 0) {
        gfx.fillStyle(colNum, 1);
        gfx.fillRect(cx - BAR_W / 2, BAR_Y, Math.round(BAR_W * fillFrac), BAR_H);
      }

      this.add.text(cx + BAR_W / 2 + 4, 20, `${count}/${threshold}`, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: col,
        stroke: '#000000', strokeThickness: 1
      }).setOrigin(0, 0);
    }
  }

  _addRelicPanel(gs) {
    const relicDb = {};
    for (const r of RELICS) relicDb[r.id] = r;

    const btnText = `🎒 Relics (${gs.relics.length})`;
    const btn = this.add.text(SCREEN_WIDTH - 20, SCREEN_HEIGHT - 20, btnText, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM2, color: '#aaaaaa',
      stroke: '#000000', strokeThickness: 1
    }).setOrigin(1, 1).setDepth(8).setInteractive({ useHandCursor: true });

    btn.on('pointerover', function() { this.setColor('#f0ead6'); });
    btn.on('pointerout',  function() { this.setColor('#aaaaaa'); });

    const PANEL_X = SCREEN_WIDTH - 220;
    const PANEL_Y = 80;
    const PANEL_W = 200;
    const ROW_H = 36;
    const panelGroup = this.add.group();
    let panelOpen = false;
    let tooltipObj = null;

    // Transparent fullscreen overlay: captures outside clicks to close the panel
    const overlay = this.add.rectangle(
      SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2,
      SCREEN_WIDTH, SCREEN_HEIGHT,
      0x000000, 0
    ).setDepth(9).setInteractive().setVisible(false);
    overlay.on('pointerdown', () => {
      panelOpen = false;
      overlay.setVisible(false);
      buildPanel();
    });

    const buildPanel = () => {
      panelGroup.clear(true, true);
      if (tooltipObj) { tooltipObj.destroy(); tooltipObj = null; }
      if (!panelOpen) { overlay.setVisible(false); return; }

      overlay.setVisible(true);

      const rowCount = Math.max(1, gs.relics.length);
      const panelH = 28 + rowCount * ROW_H + 8;

      const bg = this.add.rectangle(
        PANEL_X + PANEL_W / 2, PANEL_Y + panelH / 2,
        PANEL_W, panelH, 0x0a0a1a, 0.9
      ).setDepth(10);
      const border = this.add.graphics().setDepth(10);
      border.lineStyle(1, 0x444466);
      border.strokeRect(PANEL_X, PANEL_Y, PANEL_W, panelH);
      panelGroup.add(bg);
      panelGroup.add(border);

      const title = this.add.text(PANEL_X + PANEL_W / 2, PANEL_Y + 10, 'RELICS', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#ffd700',
        stroke: '#000000', strokeThickness: 1
      }).setOrigin(0.5, 0).setDepth(11);
      panelGroup.add(title);

      if (gs.relics.length === 0) {
        const none = this.add.text(PANEL_X + 8, PANEL_Y + 30, 'None yet', {
          fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#555555'
        }).setDepth(11);
        panelGroup.add(none);
        return;
      }

      gs.relics.forEach((id, i) => {
        const relic = relicDb[id];
        const name = relic ? relic.name : id;
        const desc = relic ? relic.desc : '';
        const rowY = PANEL_Y + 28 + i * ROW_H;

        const rowZone = this.add.rectangle(
          PANEL_X + PANEL_W / 2, rowY + ROW_H / 2,
          PANEL_W - 4, ROW_H - 4, 0xffffff, 0
        ).setDepth(11).setInteractive();
        panelGroup.add(rowZone);

        const nameLabel = this.add.text(PANEL_X + 8, rowY + 4, name, {
          fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#f0ead6',
          stroke: '#000000', strokeThickness: 1
        }).setDepth(12);
        panelGroup.add(nameLabel);

        rowZone.on('pointerover', () => {
          nameLabel.setColor('#ffd700');
          if (tooltipObj) { tooltipObj.destroy(); tooltipObj = null; }
          if (desc) {
            tooltipObj = this.add.text(PANEL_X + 8, rowY + ROW_H - 2, desc, {
              fontFamily: '"Press Start 2P"', fontSize: FONT_TINY, color: '#aaaaaa',
              wordWrap: { width: PANEL_W - 16 }, lineSpacing: 2
            }).setDepth(13);
          }
        });
        rowZone.on('pointerout', () => {
          nameLabel.setColor('#f0ead6');
          if (tooltipObj) { tooltipObj.destroy(); tooltipObj = null; }
        });
      });
    };

    btn.on('pointerdown', () => {
      panelOpen = !panelOpen;
      buildPanel();
    });
  }

  // NAN-175: Ghost run tracker panel — shows the best daily run's progress vs current run
  _addGhostPanel(gs) {
    const ghost = GameState.getDailyGhostRecord(gs.dailySeed);
    if (!ghost) return; // No previous daily run to compare against

    const HERO_EMOJI = { WARRIOR: '⚔️', MAGE: '🔮', ROGUE: '🗡️' };
    const ghostEmoji = HERO_EMOJI[ghost.hero] || '👻';

    // Find ghost's score at this same floor/act or the closest checkpoint before it
    const playerFloorIdx = (gs.act - 1) * 7 + gs.floor;
    let ghostScoreAtThisPoint = 0;
    let ghostReachedHere = false;
    if (ghost.checkpoints && ghost.checkpoints.length > 0) {
      for (const cp of ghost.checkpoints) {
        const cpIdx = (cp.act - 1) * 7 + cp.floor;
        if (cpIdx <= playerFloorIdx) {
          ghostScoreAtThisPoint = cp.score;
          if (cpIdx === playerFloorIdx) ghostReachedHere = true;
        }
      }
      // Check if ghost reached this point at all
      const lastCp = ghost.checkpoints[ghost.checkpoints.length - 1];
      const lastIdx = (lastCp.act - 1) * 7 + lastCp.floor;
      ghostReachedHere = lastIdx >= playerFloorIdx;
    }

    const playerScore = gs.computeScore(false);
    const ahead = playerScore >= ghostScoreAtThisPoint;
    const diff = Math.abs(playerScore - ghostScoreAtThisPoint);

    // Panel dimensions & position — bottom-right corner
    const pW = 192, pH = 74;
    const pX = SCREEN_WIDTH - pW / 2 - 8;
    const pY = SCREEN_HEIGHT - pH / 2 - 46;

    const bg = this.add.rectangle(pX, pY, pW, pH, 0x0a0a18, 0.88).setDepth(5);
    const border = this.add.graphics().setDepth(5);
    border.lineStyle(1, 0x6644aa, 0.7);
    border.strokeRect(pX - pW / 2, pY - pH / 2, pW, pH);

    // Header
    this.add.text(pX, pY - pH / 2 + 11, '👻 GHOST RUN', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#9966dd'
    }).setOrigin(0.5).setDepth(6);

    // Ghost info line
    this.add.text(pX, pY - pH / 2 + 26, `${ghostEmoji}  ${ghost.score}pts  ${ghost.won ? '(WIN)' : `Act${ghost.act}`}`, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_TINY, color: '#888899'
    }).setOrigin(0.5).setDepth(6);

    // Comparison line
    const compColor = ahead ? '#44dd88' : '#dd4466';
    const compText = ghostReachedHere
      ? (ahead ? `▲ +${diff}pts ahead` : `▼ −${diff}pts behind`)
      : (playerScore > 0 ? `▲ past ghost` : `ghost was here`);
    this.add.text(pX, pY - pH / 2 + 43, compText, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: compColor
    }).setOrigin(0.5).setDepth(6);

    // Player score
    this.add.text(pX, pY - pH / 2 + 58, `You: ${playerScore}pts`, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_TINY, color: '#cccccc'
    }).setOrigin(0.5).setDepth(6);
  }

  _showFeralWarning(gs) {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.7).setDepth(30);

    const panel = this.add.rectangle(W/2, H/2, 520, 320, COLORS.PANEL).setDepth(31);
    const border = this.add.graphics().setDepth(31);
    border.lineStyle(3, 0xe67e22);
    border.strokeRect(W/2 - 260, H/2 - 160, 520, 320);

    this.add.text(W/2, H/2 - 120, '⚠️ GOING FERAL', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_3XL, color: '#e67e22'
    }).setOrigin(0.5).setDepth(32);

    this.add.text(W/2, H/2 - 55, 'Your combat instincts are taking over.\nGoing FERAL doubles all damage,\nbut you can NEVER heal again.', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#f0ead6',
      align: 'center', lineSpacing: 8
    }).setOrigin(0.5).setDepth(32);

    // Accept
    const acceptBtn = this.add.text(W/2 - 90, H/2 + 60, '[ GO FERAL ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#e67e22'
    }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });

    acceptBtn.on('pointerover', () => acceptBtn.setColor('#ff9944'));
    acceptBtn.on('pointerout', () => acceptBtn.setColor('#e67e22'));
    acceptBtn.on('pointerdown', () => {
      gs.personality.feralPending = false;
      gs.personality.mood = PERSONALITY.FERAL;
      gs.personality.feral = true;
      gs.save();
      overlay.destroy(); panel.destroy(); border.destroy();
      this.scene.restart();
    });

    // Decline
    const declineBtn = this.add.text(W/2 + 90, H/2 + 60, '[ STAY CALM ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#4fc3f7'
    }).setOrigin(0.5).setDepth(32).setInteractive({ useHandCursor: true });

    declineBtn.on('pointerover', () => declineBtn.setColor('#88ddff'));
    declineBtn.on('pointerout', () => declineBtn.setColor('#4fc3f7'));
    declineBtn.on('pointerdown', () => {
      gs.personality.feralPending = false;
      gs.personality.feralDeclined = true;
      gs.personality.feisty = FERAL_WARNING_THRESHOLD - 1;
      gs.save();
      overlay.destroy(); panel.destroy(); border.destroy();
    });
  }

  _showHelpModal() {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;

    const group = this.add.group();

    // Backdrop — click to close
    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72)
      .setDepth(40).setInteractive();
    backdrop.on('pointerdown', () => { group.destroy(true); escKey.removeAllListeners(); });
    group.add(backdrop);

    const panelW = 640;
    const panelH = 500;
    const panelX = W / 2;
    const panelY = H / 2;

    const panelBg = this.add.rectangle(panelX, panelY, panelW, panelH, COLORS.PANEL, 0.97).setDepth(41);
    group.add(panelBg);

    const border = this.add.graphics().setDepth(41);
    border.lineStyle(2, 0x4fc3f7, 0.8);
    border.strokeRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH);
    group.add(border);

    const titleText = this.add.text(panelX, panelY - panelH / 2 + 26, 'QUICK REFERENCE', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_2XL, color: '#4fc3f7',
    }).setOrigin(0.5).setDepth(42);
    group.add(titleText);

    const divGfx = this.add.graphics().setDepth(42);
    divGfx.lineStyle(1, 0x4fc3f7, 0.3);
    divGfx.lineBetween(panelX - panelW / 2 + 30, panelY - panelH / 2 + 46, panelX + panelW / 2 - 30, panelY - panelH / 2 + 46);
    group.add(divGfx);

    const sections = [
      {
        heading: 'NODE TYPES',
        color: '#ffd700',
        lines: [
          '⚔️  COMBAT  — standard enemy fight',
          '💀  ELITE   — tough foe, better loot',
          '🛒  SHOP    — buy cards & relics',
          '❓  EVENT   — random encounter',
          '🛏  REST    — heal or upgrade a card',
          '👑  BOSS    — act boss at floor 7',
        ],
      },
      {
        heading: 'PERSONALITY',
        color: '#ffd700',
        lines: [
          'Attacks → FEISTY  (red)   DMG bonus',
          'Skills  → COZY    (green) DEF bonus',
          'Powers  → CUNNING (blue)  energy bonus',
          'FERAL   — double DMG, no healing',
          `Mood locks at ${15} plays of one type`,
        ],
      },
      {
        heading: 'COMBAT',
        color: '#ffd700',
        lines: [
          'Draw 5 cards · 3 energy per turn',
          'Attack = damage  Skill = block/effect',
          'Power = lasting bonus',
          'Click END TURN when done',
        ],
      },
    ];

    let curY = panelY - panelH / 2 + 68;
    const lineH = 18;
    const headingH = 26;
    const leftX = panelX - panelW / 2 + 32;

    sections.forEach(sec => {
      const heading = this.add.text(leftX, curY, sec.heading, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: sec.color,
      }).setDepth(42);
      group.add(heading);
      curY += headingH;

      sec.lines.forEach(line => {
        const t = this.add.text(leftX + 8, curY, line, {
          fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#c0b8a8',
        }).setDepth(42);
        group.add(t);
        curY += lineH;
      });

      curY += 10;
    });

    // Close button
    const closeBtn = this.add.text(panelX, panelY + panelH / 2 - 22, '[ CLOSE ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD, color: '#e94560',
    }).setOrigin(0.5).setDepth(42).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', function() { this.setColor('#ff7799'); });
    closeBtn.on('pointerout',  function() { this.setColor('#e94560'); });
    closeBtn.on('pointerdown', () => { group.destroy(true); escKey.removeAllListeners(); });
    group.add(closeBtn);

    const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.once('down', () => { group.destroy(true); });
  }

  _showCatMoodBanner(modifier) {
    const W = SCREEN_WIDTH;
    const isConfident = modifier === 'confident';
    const color  = isConfident ? 0xffd700 : 0xe94560;
    const hexStr = isConfident ? '#ffd700' : '#e94560';
    const icon   = isConfident ? '😼' : '😾';
    const label  = isConfident ? 'CONFIDENT — +1 energy per combat' : 'FRUSTRATED — feisty energy rising';

    const bannerBg  = this.add.rectangle(W / 2, 680, W - 40, 36, 0x0d0d1a, 0.92).setDepth(50);
    const borderGfx = this.add.graphics().setDepth(50);
    borderGfx.lineStyle(1, color, 0.7);
    borderGfx.strokeRect(20, 662, W - 40, 36);
    const bannerTxt = this.add.text(W / 2, 680, `${icon}  Your cat feels ${label}`, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: hexStr,
    }).setOrigin(0.5).setDepth(51);

    this.time.delayedCall(4000, () => {
      this.tweens.add({ targets: [bannerBg, borderGfx, bannerTxt], alpha: 0, duration: 800 });
    });
  }
}
