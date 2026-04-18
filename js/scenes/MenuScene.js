import { COLORS, FONT_2XL, FONT_3XL, FONT_BANNER, FONT_LG, FONT_MD, FONT_MD2, FONT_MICRO, FONT_SM, FONT_SM2, FONT_TINY, FONT_XL, FONT_XS, FONT_XXS, HERO_CLASSES, SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants.js';
import { GameState } from '../GameState.js';
import { DeckCode } from '../DeckCode.js';
import { MusicManager } from '../MusicManager.js';
import { RELICS } from '../data/relics.js';
import { ALL_CARDS } from '../data/cards.js';
import { PurrSettings } from '../PurrSettings.js';
import { PersonalitySystem } from '../PersonalitySystem.js';

const HERO_FLAVOUR = {
  WARRIOR: 'Tank & smash',
  MAGE:    'Spells & burn',
  ROGUE:   'Poison & speed',
};

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    const gs = this.registry.get('gameState') || new GameState();
    this.registry.set('gameState', gs);

    // Background music (NAN-33): menu ambient pattern
    const music = MusicManager.getInstance(this);
    music.play('menu');

    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;

    // ── Background ──────────────────────────────────────────────────────────
    this.add.rectangle(W/2, H/2, W, H, COLORS.BG);
    this._createStars();

    // Decorative lines
    const lines = this.add.graphics();
    lines.lineStyle(1, 0xe94560, 0.4);
    lines.lineBetween(60, 64, W - 60, 64);
    lines.lineBetween(60, H - 64, W - 60, H - 64);

    // ── Title ───────────────────────────────────────────────────────────────
    const titleText = this.add.text(W/2, 110, 'PURROGUE', {
      fontFamily: '"Press Start 2P"', fontSize: '52px', color: '#e94560',
      stroke: '#7a0020', strokeThickness: 4
    }).setOrigin(0.5);

    this.tweens.add({
      targets: titleText, scaleX: 1.04, scaleY: 1.04,
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    this.add.text(W/2, 178, 'A  Cat  Roguelike', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_2XL, color: '#f0ead6'
    }).setOrigin(0.5).setAlpha(0.7);

    // ── Continue run ─────────────────────────────────────────────────────────
    const saved = GameState.load();
    if (saved) {
      const contBg = this.add.rectangle(W/2, 232, 300, 36, 0x1a1a00).setInteractive({ useHandCursor: true });
      this.add.graphics().lineStyle(2, 0xffd700, 0.8).strokeRect(W/2 - 150, 214, 300, 36);
      this.add.text(W/2, 232, '► CONTINUE RUN', {
        fontFamily: '"Press Start 2P"', fontSize: '17px', color: '#ffd700'
      }).setOrigin(0.5).setDepth(1);
      contBg.on('pointerover', () => contBg.setFillStyle(0x333300));
      contBg.on('pointerout', () => contBg.setFillStyle(0x1a1a00));
      contBg.on('pointerdown', () => {
        this.registry.set('gameState', saved);
        this.scene.start('MapScene');
      });
    }

    // ── Hero select label ─────────────────────────────────────────────────────
    this.add.text(W/2, 285, '— CHOOSE YOUR CAT —', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_LG, color: '#888888'
    }).setOrigin(0.5);

    // ── Hero cards ────────────────────────────────────────────────────────────
    const heroes = Object.entries(HERO_CLASSES);
    const heroSpriteKeys = { WARRIOR: 'warrior_idle', MAGE: 'mage_idle', ROGUE: 'rogue_idle' };

    // ── Daily Challenge button ─────────────────────────────────────────────────
    const dailySeed = GameState.getDailySeed();
    const dailyModifier = GameState.getDailyModifier(dailySeed);
    const dailyBest = GameState.getDailyBestScore(dailySeed);

    const dailyBtnY = 635;
    const dailyBtnW = 360;
    const dailyBtnH = 40;
    const dailyBg = this.add.rectangle(W/2, dailyBtnY, dailyBtnW, dailyBtnH, 0x001a1a)
      .setInteractive({ useHandCursor: true });
    const dailyBorder = this.add.graphics();
    dailyBorder.lineStyle(2, 0x00e5ff, 0.85);
    dailyBorder.strokeRect(W/2 - dailyBtnW/2, dailyBtnY - dailyBtnH/2, dailyBtnW, dailyBtnH);
    this.add.text(W/2, dailyBtnY, '📅 DAILY CHALLENGE', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_LG, color: '#00e5ff'
    }).setOrigin(0.5).setDepth(1);

    if (dailyBest) {
      this.add.text(W/2, dailyBtnY + dailyBtnH/2 + 10, `Best: ${dailyBest.score}pts  (${dailyBest.won ? 'WIN' : 'defeat'})`, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#00897b'
      }).setOrigin(0.5);
    }

    dailyBg.on('pointerover', () => dailyBg.setFillStyle(0x003333));
    dailyBg.on('pointerout',  () => dailyBg.setFillStyle(0x001a1a));
    dailyBg.on('pointerdown', () => this._showDailyModal(dailySeed, dailyModifier));

    // START RUN button (hidden until a hero is selected)
    const startBtnY = 555;
    const startBtnBg = this.add.rectangle(W/2, startBtnY, 280, 40, 0x1a3300, 0)
      .setDepth(2);
    const startBtnBorder = this.add.graphics().setDepth(2);
    const startBtnText = this.add.text(W/2, startBtnY, '', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XL, color: '#4caf50'
    }).setOrigin(0.5).setDepth(3).setAlpha(0);
    let selectedHeroKey = null;
    let selectedHeroData = null;

    const showStartBtn = (heroKey, heroData) => {
      selectedHeroKey = heroKey;
      selectedHeroData = heroData;
      startBtnText.setText(`► START AS ${heroData.name.toUpperCase()}`).setAlpha(1);
      startBtnBg.setFillStyle(0x1a3300, 1).setInteractive({ useHandCursor: true });
      startBtnBorder.clear();
      startBtnBorder.lineStyle(2, heroData.color, 0.9);
      startBtnBorder.strokeRect(W/2 - 140, startBtnY - 20, 280, 40);
    };

    startBtnBg.on('pointerover', () => { if (selectedHeroKey) startBtnBg.setFillStyle(0x2a5500, 1); });
    startBtnBg.on('pointerout',  () => { if (selectedHeroKey) startBtnBg.setFillStyle(0x1a3300, 1); });
    startBtnBg.on('pointerdown', () => {
      if (!selectedHeroKey) return;
      const newGs = new GameState();
      newGs.startRun(selectedHeroKey);
      newGs.deck = this._getStartingDeck(selectedHeroKey);
      newGs.save();
      this.registry.set('gameState', newGs);
      if (newGs.ascensionUnlocked > 0) {
        this._showAscensionModal(newGs);
      } else {
        this._afterAscension(newGs);
      }
    });

    const borderGfxMap = {};
    const cardMap = {};

    heroes.forEach(([key, hero], i) => {
      const x = W/2 + (i - 1) * 296;
      const cardY = 435;

      // Shadow
      this.add.rectangle(x + 4, cardY + 5, 250, 220, 0x000000, 0.4);

      // Body
      const card = this.add.rectangle(x, cardY, 250, 220, COLORS.PANEL)
        .setInteractive({ useHandCursor: true });
      cardMap[key] = card;

      // Colored border
      const borderGfx = this.add.graphics();
      borderGfxMap[key] = { gfx: borderGfx, x, cardY, hero };
      const drawBorder = (alpha = 0.7, width = 3) => {
        borderGfx.clear();
        borderGfx.lineStyle(width, hero.color, alpha);
        borderGfx.strokeRect(x - 125, cardY - 110, 250, 220);
      };
      drawBorder();

      // Hero sprite or emoji fallback
      const spriteKey = heroSpriteKeys[key];
      if (this.textures.exists(spriteKey)) {
        this.add.image(x, cardY - 50, spriteKey).setDisplaySize(100, 100);
      } else {
        this.add.circle(x, cardY - 50, 44, hero.color, 0.4);
        this.add.text(x, cardY - 50, hero.emoji, { fontSize: '40px' }).setOrigin(0.5);
      }

      this.add.text(x, cardY + 28, hero.name, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#f0ead6'
      }).setOrigin(0.5);

      this.add.text(x, cardY + 54, HERO_FLAVOUR[key], {
        fontFamily: '"Press Start 2P"', fontSize: FONT_MD, color: '#888888'
      }).setOrigin(0.5);

      this.add.text(x, cardY + 80, `HP: ${hero.hp}`, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#4caf50'
      }).setOrigin(0.5);

      // NAN-289: Starting deck preview
      const deckLines = this._getDeckPreviewLines(key);
      this.add.text(x, cardY + 96, 'STARTING DECK', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_MICRO, color: '#444466'
      }).setOrigin(0.5);
      deckLines.forEach((line, li) => {
        this.add.text(x, cardY + 106 + li * 10, line, {
          fontFamily: '"Press Start 2P"', fontSize: FONT_MICRO, color: '#666688',
          wordWrap: { width: 238 }, align: 'center'
        }).setOrigin(0.5);
      });

      card.on('pointerover', () => {
        if (selectedHeroKey !== key) { card.setFillStyle(0x2a2a5e); drawBorder(1); }
      });
      card.on('pointerout', () => {
        if (selectedHeroKey !== key) { card.setFillStyle(COLORS.PANEL); drawBorder(0.7); }
      });
      card.on('pointerdown', () => {
        // Reset all cards to unselected state
        Object.entries(borderGfxMap).forEach(([k, { gfx, x: bx, cardY: by, hero: bh }]) => {
          cardMap[k].setFillStyle(COLORS.PANEL);
          gfx.clear();
          gfx.lineStyle(k === key ? 4 : 3, bh.color, k === key ? 1 : 0.7);
          gfx.strokeRect(bx - 125, by - 110, 250, 220);
        });
        card.setFillStyle(0x1e1e3e);
        showStartBtn(key, hero);
      });
    });

    // ── Settings gear ─────────────────────────────────────────────────────────
    this.add.text(24, H - 24, '⚙', { fontSize: FONT_BANNER, color: '#444444' })
      .setOrigin(0, 1).setInteractive({ useHandCursor: true })
      .on('pointerover', function() { this.setColor('#aaaaaa'); })
      .on('pointerout',  function() { this.setColor('#444444'); })
      .on('pointerdown', () => {
        if (!this.scene.isActive('SettingsScene')) this.scene.launch('SettingsScene');
      });

    // ── How to Play button ────────────────────────────────────────────────────
    this.add.text(W - 24, H - 24, '[ ? HOW TO PLAY ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM2, color: '#7777aa'
    }).setOrigin(1, 1).setInteractive({ useHandCursor: true })
      .on('pointerover', function() { this.setColor('#8888cc'); })
      .on('pointerout',  function() { this.setColor('#7777aa'); })
      .on('pointerdown', () => {
        this.scene.start('TutorialScene', { returnTo: 'MenuScene' });
      });

    // ── Import deck code ──────────────────────────────────────────────────────
    this.add.text(W/2, H - 52, '[ IMPORT DECK CODE ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#444444'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerover', function() { this.setColor('#888888'); })
      .on('pointerout',  function() { this.setColor('#444444'); })
      .on('pointerdown', () => { this._showImportModal(); });

    // ── Cat identity panel (left side) ────────────────────────────────────────
    this._buildCatProfile(W, H);

    // ── High scores ───────────────────────────────────────────────────────────
    const scores = GameState.getScores();
    this._buildLeaderboard(scores, W);
    PurrSettings.scaleSceneText(this); // NAN-222
  }

  _buildLeaderboard(allScores, W) {
    const MOOD_HEX   = { feisty: 0xe94560, cozy: 0x4caf50, cunning: 0x4fc3f7, feral: 0xce93d8 };
    const HERO_EMOJI = { WARRIOR: '⚔️', MAGE: '🔮', ROGUE: '🗡️' };

    const ROW_H    = 34;
    const MAX_ROWS = 10;
    const panelW   = 330;
    const panelX   = W - panelW / 2 - 8;
    const panelTop = 20;

    const TABS  = ['All', 'Warrior', 'Mage', 'Rogue'];
    const TAB_W = panelW / TABS.length;
    const TAB_H = 24;

    // "BEST RUNS" header
    this.add.text(panelX, panelTop + 10, 'BEST RUNS', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#ffd700'
    }).setOrigin(0.5);

    const tabsTop    = panelTop + 24;
    const contentTop = tabsTop + TAB_H;

    let rowContainer = [];
    let activeTab    = 'All';

    const tabGfx    = this.add.graphics();
    const tabLabels = {};

    const drawTabs = (active) => {
      tabGfx.clear();
      TABS.forEach((t, ti) => {
        const tx       = panelX - panelW / 2 + ti * TAB_W;
        const isActive = t === active;
        tabGfx.fillStyle(isActive ? 0x2a2000 : 0x0d0d1a, 0.97);
        tabGfx.fillRect(tx, tabsTop, TAB_W, TAB_H);
        tabGfx.lineStyle(1, isActive ? 0xffd700 : 0x334466, isActive ? 0.9 : 0.4);
        tabGfx.strokeRect(tx, tabsTop, TAB_W, TAB_H);
        if (tabLabels[t]) tabLabels[t].setColor(isActive ? '#ffd700' : '#777799');
      });
    };

    TABS.forEach((t, ti) => {
      const tx  = panelX - panelW / 2 + ti * TAB_W + TAB_W / 2;
      const lbl = this.add.text(tx, tabsTop + TAB_H / 2, t, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#777799'
      }).setOrigin(0.5);
      tabLabels[t] = lbl;

      const hitBox = this.add.rectangle(tx, tabsTop + TAB_H / 2, TAB_W - 2, TAB_H - 2, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hitBox.on('pointerover', () => { if (t !== activeTab) lbl.setColor('#aaaaaa'); });
      hitBox.on('pointerout',  () => { if (t !== activeTab) lbl.setColor('#777799'); });
      hitBox.on('pointerdown', () => {
        activeTab = t;
        drawTabs(activeTab);
        renderRows(activeTab);
      });
    });

    drawTabs(activeTab);

    const renderRows = (filter) => {
      rowContainer.forEach(obj => obj.destroy());
      rowContainer = [];

      const filtered = filter === 'All'
        ? allScores
        : allScores.filter(s => s.hero && s.hero.toUpperCase() === filter.toUpperCase());

      const visible  = filtered.slice(0, MAX_ROWS);
      const panelH   = Math.max(visible.length, 1) * ROW_H + 8;

      const bg = this.add.rectangle(panelX, contentTop + panelH / 2, panelW, panelH, 0x0d0d1a, 0.92);
      const border = this.add.graphics();
      border.lineStyle(1, 0xffd700, 0.3).strokeRect(panelX - panelW / 2, contentTop, panelW, panelH);
      rowContainer.push(bg, border);

      if (visible.length === 0) {
        const empty = this.add.text(panelX, contentTop + ROW_H / 2 + 4, 'No runs yet', {
          fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#555577'
        }).setOrigin(0.5);
        rowContainer.push(empty);
        return;
      }

      visible.forEach((s, i) => {
        const rowY = contentTop + 4 + i * ROW_H + ROW_H / 2;

        if (i % 2 === 0) {
          const shade = this.add.rectangle(panelX, rowY, panelW - 2, ROW_H - 2, 0xffffff, 0.02);
          rowContainer.push(shade);
        }

        const scoreVal  = s.score != null ? s.score : (s.act - 1) * 1000 + s.floor * 100;
        const heroEmoji = HERO_EMOJI[s.hero] || '?';
        const moodHex   = MOOD_HEX[s.personality] || 0x888888;
        const resultCol = s.won ? '#4caf50' : '#e94560';

        const rank = this.add.text(panelX - panelW / 2 + 8, rowY, `${i + 1}.`, {
          fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#555577'
        }).setOrigin(0, 0.5);

        const heroTxt = this.add.text(panelX - panelW / 2 + 30, rowY, heroEmoji, {
          fontSize: FONT_MD2
        }).setOrigin(0, 0.5);

        const dotGfx = this.add.graphics();
        dotGfx.fillStyle(moodHex, 0.9);
        dotGfx.fillCircle(panelX - panelW / 2 + 56, rowY, 5);

        const heroLabel = this.add.text(panelX - panelW / 2 + 66, rowY,
          s.hero ? s.hero.charAt(0) + s.hero.slice(1).toLowerCase() : '???',
          { fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: resultCol }
        ).setOrigin(0, 0.5);

        const actLabel = this.add.text(panelX - panelW / 2 + 138, rowY, `Act${s.act}`, {
          fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#aaaaaa'
        }).setOrigin(0, 0.5);

        const scoreTxt = this.add.text(panelX + panelW / 2 - 8, rowY, `${scoreVal}pts`, {
          fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#ffd700'
        }).setOrigin(1, 0.5);

        rowContainer.push(rank, heroTxt, dotGfx, heroLabel, actLabel, scoreTxt);
      });
    };

    renderRows(activeTab);

    // ── Achievements ──────────────────────────────────────────────────────────
    const ACHIEVEMENT_DEFS = [
      { id: 'first_win',   label: 'First Blood',    emoji: '🏆', tip: 'Win a run' },
      { id: 'all_heroes',  label: 'Triple Threat',  emoji: '🐱', tip: 'Win with all 3 heroes' },
      { id: 'win_feral',   label: 'Feral Victory',  emoji: '😾', tip: 'Win while feral' },
      { id: 'a5_win',      label: 'Apex Predator',  emoji: '👑', tip: 'Win at Ascension 5' },
      { id: 'no_heal_win', label: 'Iron Will',       emoji: '🩺', tip: 'Win with No Healing modifier' },
    ];
    const meta = GameState.loadMeta();
    const earned = meta.achievements || [];
    const achTop = contentTop + MAX_ROWS * ROW_H + 24;
    this.add.text(panelX, achTop, 'ACHIEVEMENTS', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#888888'
    }).setOrigin(0.5);
    // shared tooltip objects (created once, repositioned on hover)
    const tipBg = this.add.rectangle(0, 0, 160, 40, 0x111122, 0.95)
      .setStrokeStyle(1, 0x4444aa).setDepth(50).setVisible(false).setOrigin(0.5, 1);
    const tipLabel = this.add.text(0, 0, '', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_TINY, color: '#ffffff', wordWrap: { width: 148 }
    }).setDepth(51).setVisible(false).setOrigin(0.5, 1);
    const tipSub = this.add.text(0, 0, '', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MICRO, color: '#aaaacc', wordWrap: { width: 148 }
    }).setDepth(51).setVisible(false).setOrigin(0.5, 1);

    ACHIEVEMENT_DEFS.forEach((def, i) => {
      const ax = panelX - panelW / 2 + 14 + i * (panelW / ACHIEVEMENT_DEFS.length);
      const ay = achTop + 22;
      const unlocked = earned.includes(def.id);
      const badge = this.add.text(ax, ay, def.emoji, { fontSize: FONT_3XL })
        .setOrigin(0, 0.5)
        .setAlpha(unlocked ? 1 : 0.2);
      badge.setInteractive({ useHandCursor: true });

      badge.on('pointerover', () => {
        const tipX = ax + 9;
        const tipY = ay - 18;
        const statusText = unlocked ? def.label : '???';
        const subText = unlocked ? def.tip : 'Locked';
        // size the bg to fit content
        tipBg.setPosition(tipX, tipY).setSize(160, 36).setVisible(true);
        tipLabel.setPosition(tipX, tipY - 18).setText(statusText).setVisible(true);
        tipSub.setPosition(tipX, tipY - 4).setText(subText).setVisible(true);
      });
      badge.on('pointerout', () => {
        tipBg.setVisible(false);
        tipLabel.setVisible(false);
        tipSub.setVisible(false);
      });
    });
  }

  _createStars() {
    const starGfx = this.add.graphics().setDepth(-1);
    const stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * SCREEN_WIDTH,
        y: Math.random() * SCREEN_HEIGHT,
        r: Math.random() * 1.8 + 0.4,
        phase: Math.random() * Math.PI * 2
      });
    }
    starGfx.fillStyle(0xffffff, 0.4);
    stars.forEach(s => starGfx.fillCircle(s.x, s.y, s.r));

    this.time.addEvent({
      delay: 80, repeat: -1,
      callback: () => {
        starGfx.clear();
        const t = this.time.now * 0.001;
        stars.forEach(s => {
          const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 1.5 + s.phase));
          starGfx.fillStyle(0xffffff, a);
          starGfx.fillCircle(s.x, s.y, s.r);
        });
      }
    });
  }

  _getStartingDeck(heroClass) {
    const starts = {
      WARRIOR: ['w_strike','w_strike','w_strike','w_defend','w_defend','w_bash'],
      MAGE:    ['m_zap','m_zap','m_zap','m_frost','m_frost','m_arcane'],
      ROGUE:   ['r_shiv','r_shiv','r_shiv','r_dodge','r_dodge','r_sprint']
    };
    return starts[heroClass] || [];
  }

  _getDeckPreviewLines(heroClass) {
    const deck = this._getStartingDeck(heroClass);
    const cardDb = {};
    for (const c of ALL_CARDS) cardDb[c.id] = c.name;
    const counts = {};
    for (const id of deck) {
      const name = cardDb[id] || id;
      counts[name] = (counts[name] || 0) + 1;
    }
    const parts = Object.entries(counts).map(([name, n]) => n > 1 ? `${n}× ${name}` : name);
    // Split into two lines if > 3 entries, otherwise one line
    if (parts.length <= 3) return [parts.join('  ·  ')];
    const mid = Math.ceil(parts.length / 2);
    return [parts.slice(0, mid).join('  ·  '), parts.slice(mid).join('  ·  ')];
  }

  _showDailyModal(dailySeed, dailyModifier) {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;

    // Overlay
    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.75)
      .setDepth(10).setInteractive();

    // Modal panel
    const mW = 520, mH = 340;
    const mX = W/2, mY = H/2;
    this.add.rectangle(mX, mY, mW, mH, 0x04151f, 0.98).setDepth(11);
    const modalBorder = this.add.graphics().setDepth(11);
    modalBorder.lineStyle(2, 0x00e5ff, 0.9);
    modalBorder.strokeRect(mX - mW/2, mY - mH/2, mW, mH);

    // Header
    this.add.text(mX, mY - mH/2 + 28, '📅 DAILY CHALLENGE', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_2XL, color: '#00e5ff'
    }).setOrigin(0.5).setDepth(12);

    this.add.text(mX, mY - mH/2 + 60, dailySeed, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM2, color: '#aaaacc'
    }).setOrigin(0.5).setDepth(12);

    // Modifier name
    this.add.text(mX, mY - 40, `Today's Modifier:`, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#888888'
    }).setOrigin(0.5).setDepth(12);

    this.add.text(mX, mY - 12, dailyModifier.name, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_3XL, color: '#ffd700'
    }).setOrigin(0.5).setDepth(12);

    this.add.text(mX, mY + 24, dailyModifier.desc, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#aaaaaa',
      wordWrap: { width: mW - 60 }, align: 'center'
    }).setOrigin(0.5).setDepth(12);

    // Best score for today
    const best = GameState.getDailyBestScore(dailySeed);
    if (best) {
      this.add.text(mX, mY + 62,
        `Best today: ${best.score}pts  ${best.won ? '(WIN)' : '(defeat)'}  as ${best.hero}`,
        { fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#00897b' }
      ).setOrigin(0.5).setDepth(12);
      // NAN-175: Ghost run hint when a record exists with checkpoints
      if (best.checkpoints && best.checkpoints.length > 0) {
        this.add.text(mX, mY + 78,
          '👻 Ghost run active — race your best on the map!',
          { fontFamily: '"Press Start 2P"', fontSize: FONT_TINY, color: '#6644aa',
            wordWrap: { width: mW - 80 }, align: 'center' }
        ).setOrigin(0.5).setDepth(12);
      }
    }

    // Hero select label
    this.add.text(mX, mY + 90, 'Choose your hero to start:', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#555577'
    }).setOrigin(0.5).setDepth(12);

    // Hero play buttons
    const heroes = Object.entries(HERO_CLASSES);
    heroes.forEach(([key, hero], i) => {
      const bx = mX + (i - 1) * 148;
      const by = mY + mH/2 - 44;
      const btn = this.add.rectangle(bx, by, 128, 36, 0x0a0a1a)
        .setDepth(12).setInteractive({ useHandCursor: true });
      const btnBorder = this.add.graphics().setDepth(12);
      btnBorder.lineStyle(2, hero.color, 0.8);
      btnBorder.strokeRect(bx - 64, by - 18, 128, 36);
      this.add.text(bx, by, `${hero.emoji} ${hero.name}`, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#f0ead6'
      }).setOrigin(0.5).setDepth(13);

      btn.on('pointerover', () => btn.setFillStyle(0x1a1a3e));
      btn.on('pointerout',  () => btn.setFillStyle(0x0a0a1a));
      btn.on('pointerdown', () => {
        const newGs = new GameState();
        newGs.startRun(key);
        // Set daily fields after startRun (startRun calls reset which clears them)
        newGs.isDaily = true;
        newGs.dailySeed = dailySeed;
        newGs.dailyModifier = dailyModifier;
        newGs.deck = this._getStartingDeck(key);

        // Apply all_upgraded immediately
        if (dailyModifier.id === 'all_upgraded') {
          newGs.deck = newGs.deck.map(id => `${id}_u`);
        }
        // Apply no_gold
        if (dailyModifier.id === 'no_gold') {
          newGs.gold = 0;
        }
        // Apply lucky relic
        if (dailyModifier.id === 'lucky') {
          newGs.relics.push('lucky_paw');
        }

        newGs.save();
        this.registry.set('gameState', newGs);
        const tutorialDone = localStorage.getItem('purrogue_tutorial_done');
        if (!tutorialDone) {
          this.scene.start('TutorialScene');
        } else {
          this.scene.start('MapScene');
        }
      });
    });

    // Close button
    const closeBtn = this.add.text(mX + mW/2 - 12, mY - mH/2 + 12, '✕', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_LG, color: '#555577'
    }).setOrigin(1, 0).setDepth(13).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerover', () => closeBtn.setColor('#e94560'));
    closeBtn.on('pointerout',  () => closeBtn.setColor('#555577'));
    closeBtn.on('pointerdown', () => {
      overlay.destroy();
      this.children.list
        .filter(c => c.depth >= 11)
        .forEach(c => c.destroy());
    });
  }

  _showAscensionModal(newGs) {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
    const unlocked = newGs.ascensionUnlocked;
    let selectedTier = 0;

    // Overlay
    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.78).setDepth(20).setInteractive();

    const mW = 580, mH = 280;
    const mX = W/2, mY = H/2;
    this.add.rectangle(mX, mY, mW, mH, 0x04151f, 0.98).setDepth(21);
    const border = this.add.graphics().setDepth(21);
    border.lineStyle(2, 0xffd700, 0.6);
    border.strokeRect(mX - mW/2, mY - mH/2, mW, mH);

    this.add.text(mX, mY - mH/2 + 28, 'DIFFICULTY', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_3XL, color: '#ffd700',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(22);

    this.add.text(mX, mY - mH/2 + 54, 'Choose your ascension tier', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#888888'
    }).setOrigin(0.5).setDepth(22);

    // Tier buttons: Normal + A1..A(unlocked) + locked remaining
    const tiers = [{ label: 'Normal', tier: 0 }];
    for (let t = 1; t <= 5; t++) {
      if (t <= unlocked) tiers.push({ label: `A${t}`, tier: t });
      else tiers.push({ label: '🔒', tier: t, locked: true });
    }

    const btnW = 72, btnH = 44, gap = 10;
    const totalW = tiers.length * (btnW + gap) - gap;
    const startX = mX - totalW / 2 + btnW / 2;
    const btnY = mY - 10;

    const btnBgs = [];
    const btnLabels = [];

    const updateSelection = () => {
      tiers.forEach((t, i) => {
        const isSelected = t.tier === selectedTier;
        const isLocked = t.locked;
        const bg = btnBgs[i];
        const lbl = btnLabels[i];
        if (isSelected) {
          bg.setFillStyle(0x3a2a00);
          lbl.setColor('#ffd700');
        } else if (isLocked) {
          bg.setFillStyle(0x111111);
          lbl.setColor('#444444');
        } else {
          bg.setFillStyle(0x1a1a2e);
          lbl.setColor('#aaaaaa');
        }
      });
    };

    tiers.forEach((t, i) => {
      const bx = startX + i * (btnW + gap);
      const bg = this.add.rectangle(bx, btnY, btnW, btnH, 0x1a1a2e).setDepth(22);
      const lbl = this.add.text(bx, btnY, t.label, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_SM2, color: '#aaaaaa'
      }).setOrigin(0.5).setDepth(23);
      const btnBorder = this.add.graphics().setDepth(22);
      btnBorder.lineStyle(1, 0x334466);
      btnBorder.strokeRect(bx - btnW/2, btnY - btnH/2, btnW, btnH);
      btnBgs.push(bg);
      btnLabels.push(lbl);
      if (!t.locked) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerdown', () => { selectedTier = t.tier; updateSelection(); });
        bg.on('pointerover', () => { if (t.tier !== selectedTier) bg.setFillStyle(0x2a2a4e); });
        bg.on('pointerout',  () => { if (t.tier !== selectedTier) bg.setFillStyle(0x1a1a2e); });
      }
    });

    updateSelection();

    // BEGIN RUN button
    const beginY = mY + mH/2 - 36;
    const beginBg = this.add.rectangle(mX, beginY, 200, 38, 0x0a2a0a).setDepth(22).setInteractive({ useHandCursor: true });
    const beginBorder = this.add.graphics().setDepth(22);
    beginBorder.lineStyle(2, 0x4caf50, 0.9);
    beginBorder.strokeRect(mX - 100, beginY - 19, 200, 38);
    const beginLabel = this.add.text(mX, beginY, 'BEGIN RUN', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#4caf50'
    }).setOrigin(0.5).setDepth(23);
    beginBg.on('pointerover', () => { beginBg.setFillStyle(0x0a3a0a); beginLabel.setColor('#6cd66c'); });
    beginBg.on('pointerout',  () => { beginBg.setFillStyle(0x0a2a0a); beginLabel.setColor('#4caf50'); });
    beginBg.on('pointerdown', () => {
      newGs.ascension = selectedTier;
      newGs.save();
      this.registry.set('gameState', newGs);
      // Destroy ascension modal elements (depth >= 20)
      this.children.list
        .filter(c => c.depth >= 20)
        .forEach(c => c.destroy());
      this._afterAscension(newGs);
    });
  }

  _afterAscension(newGs) {
    const scores = GameState.getScores();
    if (scores.length > 0) {
      this._showModifierModal(newGs);
    } else {
      this._startRunOrTutorial(newGs);
    }
  }

  _startRunOrTutorial(newGs) {
    const meta = GameState.loadMeta();
    const heroWins = (meta.heroWins || {})[newGs.hero] || 0;
    const a3Wins   = (meta.a3Wins  || {})[newGs.hero] || 0;
    const hasUnlockedRelic = heroWins >= 1 && !newGs.runModifiers.includes('bare_metal');
    const hasUnlockedDeck  = a3Wins >= 1;
    if (hasUnlockedRelic || hasUnlockedDeck) {
      this._showRunSetupModal(newGs, { hasUnlockedRelic, hasUnlockedDeck });
    } else {
      this._launchRun(newGs);
    }
  }

  _launchRun(newGs) {
    const tutorialDone = localStorage.getItem('purrogue_tutorial_done');
    if (!tutorialDone) {
      this.scene.start('TutorialScene');
    } else {
      this.scene.start('MapScene');
    }
  }

  _showRunSetupModal(newGs, { hasUnlockedRelic, hasUnlockedDeck }) {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
    const HERO_STARTER_RELICS = { WARRIOR: 'iron_paw', MAGE: 'spell_tome', ROGUE: 'shadow_cloak' };
    const HERO_ALT_DECKS = {
      WARRIOR: { label: 'Berserk',  tip: '4x Strike + 2x Bash',       deck: ['w_strike','w_strike','w_strike','w_strike','w_bash','w_bash'] },
      MAGE:    { label: 'Surge',    tip: '4x Zap + 2x Arcane',         deck: ['m_zap','m_zap','m_zap','m_zap','m_arcane','m_arcane'] },
      ROGUE:   { label: 'Shadow',   tip: '4x Shiv + 2x Sprint',        deck: ['r_shiv','r_shiv','r_shiv','r_shiv','r_sprint','r_sprint'] },
    };
    const DEPTH = 40;
    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.80).setDepth(DEPTH).setInteractive();

    const mW = 480, mH = hasUnlockedRelic && hasUnlockedDeck ? 340 : 260;
    const mX = W/2, mY = H/2;
    this.add.rectangle(mX, mY, mW, mH, 0x04151f, 0.98).setDepth(DEPTH + 1);
    const border = this.add.graphics().setDepth(DEPTH + 1);
    border.lineStyle(2, 0xffd700, 0.6);
    border.strokeRect(mX - mW/2, mY - mH/2, mW, mH);

    this.add.text(mX, mY - mH/2 + 24, '✨ RUN BONUSES UNLOCKED', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#ffd700',
    }).setOrigin(0.5).setDepth(DEPTH + 2);

    let selectedRelic = null;   // null = default (no starter relic)
    let selectedDeck  = 'standard';

    let contentY = mY - mH/2 + 60;

    // ── Generic toggle button factory ─────────────────────────────────────────
    const makeToggleBtn = (label, color, x, y, active) => {
      const bg = this.add.rectangle(x, y, 200, 34, active ? 0x1a2a00 : 0x0d0d1a).setDepth(DEPTH + 2).setInteractive({ useHandCursor: true });
      const gfx = this.add.graphics().setDepth(DEPTH + 2);
      gfx.lineStyle(2, color, active ? 0.9 : 0.3).strokeRect(x - 100, y - 17, 200, 34);
      const txt = this.add.text(x, y, label, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: active ? '#c8e6c9' : '#666666'
      }).setOrigin(0.5).setDepth(DEPTH + 3);
      const setActive = (on, activeColor) => {
        bg.setFillStyle(on ? 0x1a2a00 : 0x0d0d1a);
        gfx.clear().lineStyle(2, on ? activeColor : color, on ? 0.9 : 0.3).strokeRect(x - 100, y - 17, 200, 34);
        txt.setColor(on ? (activeColor === 0xffd700 ? '#ffd700' : '#c8e6c9') : '#666666');
      };
      return { bg, gfx, txt, setActive };
    };

    // ── Starter relic section ─────────────────────────────────────────────────
    if (hasUnlockedRelic) {
      const relicId    = HERO_STARTER_RELICS[newGs.hero];
      const relicData  = RELICS.find(r => r.id === relicId);
      const relicLabel = relicData ? relicData.name.toUpperCase() : relicId.replace(/_/g,' ').toUpperCase();
      this.add.text(mX, contentY, 'STARTER RELIC', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#888888'
      }).setOrigin(0.5).setDepth(DEPTH + 2);
      contentY += 20;

      const rowY = contentY;
      const noneBtn  = makeToggleBtn('None (default)', 0x4caf50, mX - 110, rowY, true);
      const relicBtn = makeToggleBtn(relicLabel,       0xffd700, mX + 110, rowY, false);

      noneBtn.bg.on('pointerdown', () => {
        selectedRelic = null;
        noneBtn.setActive(true,  0x4caf50);
        relicBtn.setActive(false, 0xffd700);
      });
      relicBtn.bg.on('pointerdown', () => {
        selectedRelic = relicId;
        relicBtn.setActive(true,  0xffd700);
        noneBtn.setActive(false, 0x4caf50);
      });
      contentY += 46;
    }

    // ── Deck variant section ──────────────────────────────────────────────────
    if (hasUnlockedDeck) {
      const alt = HERO_ALT_DECKS[newGs.hero];
      this.add.text(mX, contentY, 'STARTER DECK', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#888888'
      }).setOrigin(0.5).setDepth(DEPTH + 2);
      contentY += 20;

      const rowY = contentY;
      const stdBtn = makeToggleBtn('STANDARD',            0x4caf50, mX - 110, rowY, true);
      const altBtn = makeToggleBtn(alt.label.toUpperCase(), 0xffd700, mX + 110, rowY, false);

      stdBtn.bg.on('pointerdown', () => {
        selectedDeck = 'standard';
        stdBtn.setActive(true,  0x4caf50);
        altBtn.setActive(false, 0xffd700);
      });
      altBtn.bg.on('pointerdown', () => {
        selectedDeck = 'alt';
        altBtn.setActive(true,  0xffd700);
        stdBtn.setActive(false, 0x4caf50);
      });
      this.add.text(mX + 110, rowY + 22, alt.tip, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_TINY, color: '#555577'
      }).setOrigin(0.5).setDepth(DEPTH + 2);
      contentY += 56;
    }

    // ── Begin button ──────────────────────────────────────────────────────────
    const btnY = mY + mH/2 - 32;
    const beginBg = this.add.rectangle(mX, btnY, 220, 38, 0x0a2a0a).setDepth(DEPTH + 2).setInteractive({ useHandCursor: true });
    const beginGfx = this.add.graphics().setDepth(DEPTH + 2);
    beginGfx.lineStyle(2, 0x4caf50, 0.9).strokeRect(mX - 110, btnY - 19, 220, 38);
    const beginTxt = this.add.text(mX, btnY, 'BEGIN RUN', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#4caf50'
    }).setOrigin(0.5).setDepth(DEPTH + 3);
    beginBg.on('pointerover', () => { beginBg.setFillStyle(0x0a3a0a); beginTxt.setColor('#6cd66c'); });
    beginBg.on('pointerout',  () => { beginBg.setFillStyle(0x0a2a0a); beginTxt.setColor('#4caf50'); });
    beginBg.on('pointerdown', () => {
      // Apply selected relic
      if (selectedRelic && !newGs.relics.includes(selectedRelic)) {
        newGs.relics.push(selectedRelic);
        newGs.save();
      }
      // Apply selected deck variant
      if (selectedDeck === 'alt' && hasUnlockedDeck) {
        const alt = HERO_ALT_DECKS[newGs.hero];
        newGs.deck = [...alt.deck];
        newGs.save();
      }
      this.registry.set('gameState', newGs);
      this.children.list.filter(c => c.depth >= DEPTH).forEach(c => c.destroy());
      this._launchRun(newGs);
    });
  }

  _showModifierModal(newGs) {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;

    const MODIFIERS = [
      { id: 'petite',      emoji: '🐱', label: 'Petite',      desc: '20% fewer combat nodes',             mult: 0.8  },
      { id: 'relentless',  emoji: '⚡', label: 'Relentless',  desc: 'Enemies deal +25% damage',           mult: 1.3  },
      { id: 'bare_metal',  emoji: '🪨', label: 'Bare Metal',  desc: 'Start with no relics; shop has none',mult: 1.4  },
      { id: 'no_healing',  emoji: '🩹', label: 'No Healing',  desc: 'Rest sites give block instead of HP',mult: 1.5  },
      { id: 'glass_cannon',emoji: '💥', label: 'Glass Cannon','desc': 'Max HP halved; attacks deal +50% dmg',mult: 1.6  },
    ];

    const active = new Set();

    const overlay = this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.78).setDepth(30).setInteractive();

    const mW = 560, mH = 420;
    const mX = W/2, mY = H/2;
    const panel = this.add.rectangle(mX, mY, mW, mH, 0x04151f, 0.98).setDepth(31);
    const border = this.add.graphics().setDepth(31);
    border.lineStyle(2, 0xffd700, 0.6);
    border.strokeRect(mX - mW/2, mY - mH/2, mW, mH);

    this.add.text(mX, mY - mH/2 + 26, 'MODIFIERS (optional)', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_2XL, color: '#ffd700',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(32);

    this.add.text(mX, mY - mH/2 + 50, 'Toggle to increase difficulty and score', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#666688'
    }).setOrigin(0.5).setDepth(32);

    // Multiplier preview text
    const multText = this.add.text(mX, mY + 108, 'Score multiplier: ×1.0', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM2, color: '#ffd700'
    }).setOrigin(0.5).setDepth(32);

    const updateMult = () => {
      let mult = 1.0;
      for (const mod of MODIFIERS) {
        if (active.has(mod.id)) mult *= mod.mult;
      }
      multText.setText(`Score multiplier: ×${mult.toFixed(2)}`);
    };

    // Toggle buttons
    const btnW = mW - 40, btnH = 38;
    const startY = mY - mH/2 + 74;
    const btnBgs = {};
    const btnLabels = {};

    MODIFIERS.forEach((mod, i) => {
      const bx = mX;
      const by = startY + i * (btnH + 6) + btnH / 2;

      const bg = this.add.rectangle(bx, by, btnW, btnH, 0x0a0a1a).setDepth(32).setInteractive({ useHandCursor: true });
      const bgBorder = this.add.graphics().setDepth(32);
      bgBorder.lineStyle(1, 0x334466);
      bgBorder.strokeRect(bx - btnW/2, by - btnH/2, btnW, btnH);
      btnBgs[mod.id] = bg;

      const label = this.add.text(bx - btnW/2 + 12, by, `${mod.emoji} ${mod.label}  —  ${mod.desc}  (×${mod.mult})`, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#aaaaaa'
      }).setOrigin(0, 0.5).setDepth(33);
      btnLabels[mod.id] = label;

      const redraw = () => {
        if (active.has(mod.id)) {
          bg.setFillStyle(0x2a1a00);
          label.setColor('#ffd700');
        } else {
          bg.setFillStyle(0x0a0a1a);
          label.setColor('#aaaaaa');
        }
      };

      bg.on('pointerover', () => { if (!active.has(mod.id)) bg.setFillStyle(0x1a1a2e); });
      bg.on('pointerout',  () => redraw());
      bg.on('pointerdown', () => {
        if (active.has(mod.id)) active.delete(mod.id);
        else active.add(mod.id);
        redraw();
        updateMult();
      });
    });

    // BEGIN RUN button — centered pair: 200 + 20gap + 160 = 380px, symmetric around mX
    const beginY = mY + mH/2 - 44;
    const beginBg = this.add.rectangle(mX - 90, beginY, 200, 38, 0x0a2a0a).setDepth(32).setInteractive({ useHandCursor: true });
    const beginBorder = this.add.graphics().setDepth(32);
    beginBorder.lineStyle(2, 0x4caf50, 0.9);
    beginBorder.strokeRect(mX - 190, beginY - 19, 200, 38);
    const beginLabel = this.add.text(mX - 90, beginY, 'BEGIN RUN', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD, color: '#4caf50'
    }).setOrigin(0.5).setDepth(33);
    beginBg.on('pointerover', () => { beginBg.setFillStyle(0x0a3a0a); beginLabel.setColor('#6cd66c'); });
    beginBg.on('pointerout',  () => { beginBg.setFillStyle(0x0a2a0a); beginLabel.setColor('#4caf50'); });
    beginBg.on('pointerdown', () => {
      newGs.runModifiers = [...active];
      newGs.applyRunModifiers();
      this.registry.set('gameState', newGs);
      this._startRunOrTutorial(newGs);
    });

    // SKIP button
    const skipBg = this.add.rectangle(mX + 110, beginY, 160, 38, 0x0d0d1a).setDepth(32).setInteractive({ useHandCursor: true });
    const skipBorder = this.add.graphics().setDepth(32);
    skipBorder.lineStyle(2, 0x444466, 0.7);
    skipBorder.strokeRect(mX + 30, beginY - 19, 160, 38);
    const skipLabel = this.add.text(mX + 110, beginY, 'SKIP', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD, color: '#666688'
    }).setOrigin(0.5).setDepth(33);
    skipBg.on('pointerover', () => { skipBg.setFillStyle(0x1a1a2e); skipLabel.setColor('#aaaaaa'); });
    skipBg.on('pointerout',  () => { skipBg.setFillStyle(0x0d0d1a); skipLabel.setColor('#666688'); });
    skipBg.on('pointerdown', () => {
      newGs.runModifiers = [];
      newGs.applyRunModifiers();
      this.registry.set('gameState', newGs);
      this._startRunOrTutorial(newGs);
    });
  }

  // NAN-249: Replace native prompt()/alert() with styled in-game modal
  _showImportModal() {
    if (this._importOpen) return;
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;

    // Container groups all Phaser objects for single-call cleanup
    const container = this.add.container(0, 0).setDepth(60);

    // Dim overlay — blocks clicks behind modal
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.80)
      .setInteractive();
    container.add(overlay);

    // Modal box
    const boxW = 580, boxH = 290;
    const boxX = W / 2, boxY = H / 2;
    const boxBg = this.add.rectangle(boxX, boxY, boxW, boxH, 0x0d0d1a);
    const boxBorder = this.add.graphics().lineStyle(2, 0x4fc3f7)
      .strokeRect(boxX - boxW / 2, boxY - boxH / 2, boxW, boxH);
    container.add([boxBg, boxBorder]);

    // Title
    container.add(this.add.text(boxX, boxY - 115, 'IMPORT DECK CODE', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: '#4fc3f7'
    }).setOrigin(0.5));

    // Instruction
    container.add(this.add.text(boxX, boxY - 80, 'Paste your deck code below, then press IMPORT:', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#aaaaaa'
    }).setOrigin(0.5));

    // Status / feedback text
    const statusText = this.add.text(boxX, boxY + 80, '', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#ef5350',
      wordWrap: { width: boxW - 40 }, align: 'center'
    }).setOrigin(0.5);
    container.add(statusText);

    // HTML textarea positioned over the Phaser canvas
    const canvas = this.game.canvas;
    const cb = canvas.getBoundingClientRect();
    const sx = cb.width / W, sy = cb.height / H;
    const taX = cb.left + (boxX - boxW / 2 + 20) * sx;
    const taY = cb.top  + (boxY - 55) * sy;
    const ta = document.createElement('textarea');
    ta.placeholder = 'Paste deck code here…';
    ta.style.cssText = [
      `position:fixed`,
      `left:${taX}px`,
      `top:${taY}px`,
      `width:${(boxW - 40) * sx}px`,
      `height:${90 * sy}px`,
      `background:#0d1a2a`,
      `color:#f0ead6`,
      `border:1px solid #4fc3f7`,
      `font-family:monospace`,
      `font-size:${Math.max(11 * sy, 11)}px`,
      `resize:none`,
      `padding:6px`,
      `box-sizing:border-box`,
      `z-index:9999`,
    ].join(';');
    document.body.appendChild(ta);
    ta.focus();

    let escHandler = null;
    const cleanup = () => {
      this._importOpen = false;
      container.destroy(true);
      if (ta.parentNode) ta.parentNode.removeChild(ta);
      if (escHandler) this.input.keyboard.off('keydown-ESC', escHandler);
    };

    // IMPORT button
    const importBtn = this.add.text(boxX - 110, boxY + 115, '[ IMPORT ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD, color: '#4caf50',
      backgroundColor: '#1a3a1a', padding: { x: 12, y: 7 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    importBtn.on('pointerover', function() { this.setColor('#a5d6a7'); });
    importBtn.on('pointerout',  function() { this.setColor('#4caf50'); });
    importBtn.on('pointerdown', () => {
      const code = ta.value.trim();
      if (!code) {
        statusText.setText('Please paste a deck code first.').setColor('#ef5350');
        return;
      }
      const result = DeckCode.decode(code);
      if (result.error) {
        statusText.setText(result.error).setColor('#ef5350');
        return;
      }
      statusText.setText(`Imported: ${result.hero} deck — ${result.deck.length} cards`).setColor('#4caf50');
      importBtn.disableInteractive();
      cancelBtn.disableInteractive();
      this.time.delayedCall(1800, cleanup);
    });
    container.add(importBtn);

    // CANCEL button
    const cancelBtn = this.add.text(boxX + 110, boxY + 115, '[ CANCEL ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD, color: '#ef5350',
      backgroundColor: '#3a1a1a', padding: { x: 12, y: 7 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerover', function() { this.setColor('#ef9a9a'); });
    cancelBtn.on('pointerout',  function() { this.setColor('#ef5350'); });
    cancelBtn.on('pointerdown', cleanup);
    container.add(cancelBtn);

    // ESC key closes modal
    this._importOpen = true;
    escHandler = () => { if (this._importOpen) cleanup(); };
    this.input.keyboard.on('keydown-ESC', escHandler);
  }

  _buildCatProfile(W, H) {
    const profile = GameState.getCatProfile();
    const panelW  = 330;
    const panelX  = panelW / 2 + 8;    // mirror leaderboard position
    const panelTop = 20;
    const panelH   = 300;

    // Panel background
    this.add.rectangle(panelX, panelTop + panelH / 2, panelW, panelH, 0x0d0d1a, 0.88);
    this.add.graphics().lineStyle(1, 0x334466).strokeRect(panelX - panelW / 2, panelTop, panelW, panelH);

    // Header
    this.add.rectangle(panelX, panelTop + 18, panelW, 34, 0x1a1a3e);
    this.add.text(panelX, panelTop + 18, 'YOUR CAT', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#e94560',
    }).setOrigin(0.5);

    if (profile.totalRuns === 0) {
      // Empty state
      this.add.text(panelX, panelTop + panelH / 2, 'Play your first run\nto shape your cat', {
        fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#444466',
        align: 'center', lineSpacing: 8,
      }).setOrigin(0.5);
      return;
    }

    // Dominant personality display
    const moodInfo = profile.dominant ? PersonalitySystem.getMoodDescription(profile.dominant) : null;
    const moodName = moodInfo ? moodInfo.name : '—';
    const moodColor = moodInfo ? moodInfo.color : '#888888';
    const domPct = profile.dominant === 'feral' ? profile.feral
      : profile.dominant === 'feisty'  ? profile.feisty
      : profile.dominant === 'cozy'    ? profile.cozy
      : profile.dominant === 'cunning' ? profile.cunning : 0;

    this.add.text(panelX, panelTop + 58, moodName, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_MD2, color: moodColor,
    }).setOrigin(0.5);
    this.add.text(panelX, panelTop + 80, `${domPct}%`, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM2, color: moodColor,
    }).setOrigin(0.5);

    // Personality bars
    const barTraits = [
      { key: 'feisty',  label: 'Feisty',  pct: profile.feisty,  col: 0xe74c3c },
      { key: 'cozy',    label: 'Cozy',    pct: profile.cozy,    col: 0x3498db },
      { key: 'cunning', label: 'Cunning', pct: profile.cunning, col: 0x9b59b6 },
    ];
    const barLeft = panelX - panelW / 2 + 14;
    const barMaxW = panelW - 28;
    barTraits.forEach((t, i) => {
      const rowY = panelTop + 108 + i * 34;
      this.add.text(barLeft, rowY, t.label, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#777799',
      }).setOrigin(0, 0.5);
      // Track bg
      this.add.rectangle(barLeft + barMaxW / 2, rowY + 14, barMaxW, 10, 0x1a1a3e);
      // Fill
      const fillW = Math.max(4, Math.round(barMaxW * t.pct / 100));
      this.add.rectangle(barLeft + fillW / 2, rowY + 14, fillW, 10, t.col, 0.85);
      this.add.text(barLeft + barMaxW + 4, rowY + 14, `${t.pct}%`, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_TINY, color: '#888899',
      }).setOrigin(0, 0.5);
    });

    // Stats row
    const meta  = GameState.loadMeta();
    const runs  = meta.runHistory || [];
    const wins  = runs.filter(r => r.won).length;
    const winRate = runs.length > 0 ? Math.round(wins / runs.length * 100) : 0;
    this.add.text(panelX, panelTop + 218, `${profile.totalRuns} runs  ·  ${winRate}% win rate`, {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: '#555577',
    }).setOrigin(0.5);

    // Streak
    if (profile.winStreak >= 2 || profile.lossStreak >= 2) {
      const streakStr = profile.winStreak >= 2 ? `🔥 ${profile.winStreak} win streak` : `💀 ${profile.lossStreak} loss streak`;
      const streakCol = profile.winStreak >= 2 ? '#ffd700' : '#e94560';
      this.add.text(panelX, panelTop + 240, streakStr, {
        fontFamily: '"Press Start 2P"', fontSize: FONT_XXS, color: streakCol,
      }).setOrigin(0.5);
    }

    // Share button
    const shareBtnY = panelTop + panelH - 20;
    const shareBg = this.add.rectangle(panelX, shareBtnY, panelW - 16, 28, 0x0a1a2a)
      .setInteractive({ useHandCursor: true });
    this.add.graphics().lineStyle(1, 0x4fc3f7, 0.6).strokeRect(panelX - (panelW - 16) / 2, shareBtnY - 14, panelW - 16, 28);
    const shareLabel = this.add.text(panelX, shareBtnY, 'SHARE MY CAT', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_XS, color: '#4fc3f7',
    }).setOrigin(0.5);
    shareBg.on('pointerover', () => { shareBg.setFillStyle(0x0a2a3a); shareLabel.setColor('#7fd8f8'); });
    shareBg.on('pointerout',  () => { shareBg.setFillStyle(0x0a1a2a); shareLabel.setColor('#4fc3f7'); });
    shareBg.on('pointerdown', () => this._showCatCard(profile));
  }

  _showCatCard(profile) {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
    const moodInfo = profile.dominant ? PersonalitySystem.getMoodDescription(profile.dominant) : null;
    const moodName = moodInfo ? moodInfo.name : 'Undecided';
    const domPct = profile.dominant === 'feral' ? profile.feral
      : profile.dominant === 'feisty'  ? profile.feisty
      : profile.dominant === 'cozy'    ? profile.cozy
      : profile.dominant === 'cunning' ? profile.cunning : 0;

    const meta    = GameState.loadMeta();
    const runs    = meta.runHistory || [];
    const wins    = runs.filter(r => r.won).length;
    const winRate = runs.length > 0 ? Math.round(wins / runs.length * 100) : 0;

    const heroCounts = {};
    runs.forEach(r => { heroCounts[r.hero] = (heroCounts[r.hero] || 0) + 1; });
    const favHero = Object.entries(heroCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const shareText = [
      `🐱 My Purrogue Cat — ${moodName} (${domPct}%)`,
      `${profile.totalRuns} runs  ·  ${winRate}% win rate  ·  Fav: ${favHero}`,
      `Feisty ${profile.feisty}%  ·  Cozy ${profile.cozy}%  ·  Cunning ${profile.cunning}%`,
      `purrogue.cat`,
    ].join('\n');

    const boxW = 520, boxH = 200;
    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75)
      .setInteractive({ useHandCursor: false }).setDepth(100);
    this.add.rectangle(W / 2, H / 2, boxW, boxH, 0x0d0d1a, 1).setDepth(101);
    this.add.graphics().setDepth(101).lineStyle(1, 0x4fc3f7).strokeRect(W / 2 - boxW / 2, H / 2 - boxH / 2, boxW, boxH);
    this.add.text(W / 2, H / 2 - boxH / 2 + 18, 'Share your cat:', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#4fc3f7',
    }).setOrigin(0.5).setDepth(102);

    const ta = this.add.dom(W / 2, H / 2 + 16, 'textarea', {
      width: (boxW - 32) + 'px', height: '90px',
      background: '#0d1a2a', color: '#f0ead6', border: '1px solid #4fc3f7',
      fontFamily: 'monospace', fontSize: FONT_MD, resize: 'none', padding: '6px',
    }, shareText).setDepth(102);
    if (ta.node) ta.node.select();

    const closeBtn = this.add.text(W / 2, H / 2 + boxH / 2 - 16, '[ CLOSE ]', {
      fontFamily: '"Press Start 2P"', fontSize: FONT_SM, color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => { overlay.destroy(); closeBtn.destroy(); if (ta) ta.destroy(); });
    overlay.on('pointerdown',  () => { overlay.destroy(); closeBtn.destroy(); if (ta) ta.destroy(); });
  }
}
