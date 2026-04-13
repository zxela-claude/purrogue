import { SCREEN_WIDTH, SCREEN_HEIGHT, COLORS } from '../constants.js';
import { PurrSettings } from '../PurrSettings.js';

const STEPS = [
  {
    title: 'WELCOME, CAT',
    body: 'You are a cat. Navigate a dangerous world, build your deck, and defeat the bosses at the end of each act. Use your wits — and your claws.',
    extra: null,
  },
  {
    title: 'THE MAP',
    body: 'Each floor has nodes to visit. Combat nodes pit you against enemies. Elites are harder but drop better loot. Shops let you buy cards and relics. Rest sites let you heal or upgrade cards. The boss waits at floor 7.',
    extra: 'nodes',
  },
  {
    title: 'CARDS & ENERGY',
    body: 'Each turn you draw 5 cards and get 3 energy. Play cards by clicking them — attacks deal damage, skills give block or effects, powers grant lasting bonuses. End your turn when done.',
    extra: null,
  },
  {
    title: 'THE PERSONALITY SYSTEM',
    body: 'Every card you play moves you toward a personality: Attacks → Feisty, Skills → Cozy, Powers → Cunning. After 15 plays of a type, your mood locks in — changing how your cards work and how you upgrade them. Feral is a special high-risk personality that doubles your damage but blocks all healing.',
    extra: null,
  },
  {
    title: 'RELICS',
    body: 'Relics are passive items that change the rules. Some give you more energy, more cards, or make your attacks stronger. Collect them from shops, elites, and events.',
    extra: null,
  },
  {
    title: 'READY?',
    body: "That's everything. Good luck out there. Your deck, your personality, your run.",
    extra: null,
    finalStep: true,
  },
];

const NODE_ICONS = [
  { emoji: '⚔️',  label: 'COMBAT',  desc: 'Fight enemies',       color: '#e94560' },
  { emoji: '💀',  label: 'ELITE',   desc: 'Hard — better loot',  color: '#9b59b6' },
  { emoji: '🛒',  label: 'SHOP',    desc: 'Buy cards & relics',  color: '#ffd700' },
  { emoji: '❓',  label: 'EVENT',   desc: 'Random encounter',    color: '#4fc3f7' },
  { emoji: '🛏',  label: 'REST',    desc: 'Heal or upgrade',     color: '#4caf50' },
  { emoji: '👑',  label: 'BOSS',    desc: 'Act boss — floor 7',  color: '#ff4400' },
];

export class TutorialScene extends Phaser.Scene {
  constructor() { super('TutorialScene'); }

  init(data) {
    this._heroData = data || {};
    this._step = 0;
    this._stepObjects = [];
    this._keyHandlers = null;
  }

  create() {
    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;

    // Full dark background
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a18);

    // Subtle grid lines for texture
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1a1a3a, 0.4);
    for (let x = 0; x < W; x += 80) grid.lineBetween(x, 0, x, H);
    for (let y = 0; y < H; y += 80) grid.lineBetween(0, y, W, y);

    // Title bar accent
    this.add.rectangle(W / 2, 0, W, 4, 0xe94560).setOrigin(0.5, 0);

    // Step indicator container (persistent)
    this._stepIndicator = this.add.text(W / 2, H - 28, '', {
      fontFamily: '"Press Start 2P"',
      fontSize: '10px',
      color: '#555577',
    }).setOrigin(0.5).setDepth(10);

    // Container for per-step content
    this._contentGroup = this.add.group();

    // Register keyboard handlers once; remove on scene shutdown
    const onSpace = () => this._advance();
    const onEnter = () => this._advance();
    const onBack  = () => this._goBack();
    this.input.keyboard.on('keydown-SPACE', onSpace);
    this.input.keyboard.on('keydown-ENTER', onEnter);
    this.input.keyboard.on('keydown-LEFT',  onBack);
    this.input.keyboard.on('keydown-BACKSPACE', onBack);
    this._keyHandlers = { onSpace, onEnter, onBack };

    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown-SPACE', onSpace);
      this.input.keyboard.off('keydown-ENTER', onEnter);
      this.input.keyboard.off('keydown-LEFT',  onBack);
      this.input.keyboard.off('keydown-BACKSPACE', onBack);
    });

    this._renderStep();
    PurrSettings.scaleSceneText(this); // NAN-222
  }

  _clearStep() {
    this._contentGroup.destroy(true);
    this._contentGroup = this.add.group();
  }

  _renderStep() {
    this._clearStep();

    const W = SCREEN_WIDTH, H = SCREEN_HEIGHT;
    const step = STEPS[this._step];
    const g = this._contentGroup;
    const isReturning = !!localStorage.getItem('purrogue_tutorial_done');

    // Step indicator
    this._stepIndicator.setText(`${this._step + 1} / ${STEPS.length}`);

    // Panel
    const panelW = 900;
    const panelH = 480;
    const panelX = W / 2;
    const panelY = H / 2 - 20;

    const panelBg = this.add.rectangle(panelX, panelY, panelW, panelH, COLORS.PANEL, 0.97).setDepth(5);
    g.add(panelBg);

    const border = this.add.graphics().setDepth(5);
    border.lineStyle(2, 0xe94560, 0.7);
    border.strokeRect(panelX - panelW / 2, panelY - panelH / 2, panelW, panelH);
    g.add(border);

    // Corner accents
    const corners = this.add.graphics().setDepth(6);
    corners.lineStyle(3, 0xffd700, 0.8);
    const cx = panelX - panelW / 2, cy = panelY - panelH / 2;
    const cl = 18;
    corners.lineBetween(cx, cy, cx + cl, cy);
    corners.lineBetween(cx, cy, cx, cy + cl);
    corners.lineBetween(cx + panelW - cl, cy, cx + panelW, cy);
    corners.lineBetween(cx + panelW, cy, cx + panelW, cy + cl);
    corners.lineBetween(cx, cy + panelH, cx + cl, cy + panelH);
    corners.lineBetween(cx, cy + panelH - cl, cx, cy + panelH);
    corners.lineBetween(cx + panelW - cl, cy + panelH, cx + panelW, cy + panelH);
    corners.lineBetween(cx + panelW, cy + panelH - cl, cx + panelW, cy + panelH);
    g.add(corners);

    // Title
    const titleY = panelY - panelH / 2 + 52;
    const title = this.add.text(panelX, titleY, step.title, {
      fontFamily: '"Press Start 2P"',
      fontSize: '24px',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6);
    g.add(title);

    // Divider
    const divider = this.add.graphics().setDepth(6);
    divider.lineStyle(1, 0xffd700, 0.4);
    divider.lineBetween(panelX - panelW / 2 + 40, titleY + 22, panelX + panelW / 2 - 40, titleY + 22);
    g.add(divider);

    // Body text
    const bodyY = step.extra === 'nodes' ? panelY - 100 : panelY - 20;
    const body = this.add.text(panelX, bodyY, step.body, {
      fontFamily: '"Press Start 2P"',
      fontSize: '12px',
      color: '#d0c8b8',
      wordWrap: { width: panelW - 100 },
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(6);
    g.add(body);

    // Extra content: node type grid
    if (step.extra === 'nodes') {
      this._renderNodeGrid(g, panelX, panelY + 80, panelW);
    }

    const btnY = panelY + panelH / 2 - 44;

    // SKIP button — only on step 0 for returning players
    if (this._step === 0 && isReturning) {
      this._addButton(g, panelX - 280, btnY, 160, 'Skip ✕', '#888888', 0x111122, () => this._finish());
    }

    // BACK button — visible on steps > 0
    if (this._step > 0) {
      this._addButton(g, panelX - 145, btnY, 200, '← Back', '#aaaaaa', 0x111122, () => this._goBack());
    }

    // NEXT / FINISH button
    const nextLabel = step.finalStep ? 'Begin Run →' : 'Next →';
    const nextX = this._step > 0 ? panelX + 145 : panelX;
    this._addButton(g, nextX, btnY, 240, nextLabel, '#ffd700', 0x1a1a3e, () => this._advance());

    // Animate panel in
    this.tweens.add({
      targets: [panelBg, border, corners, title, body],
      alpha: { from: 0, to: 1 },
      duration: 220,
      ease: 'Sine.easeOut',
    });
  }

  _addButton(group, x, y, w, label, color, fill, onClick) {
    const bg = this.add.rectangle(x, y, w, 44, fill).setDepth(6).setInteractive({ useHandCursor: true });
    group.add(bg);

    const bdr = this.add.graphics().setDepth(6);
    bdr.lineStyle(2, Phaser.Display.Color.HexStringToColor(color).color, 0.9);
    bdr.strokeRect(x - w / 2, y - 22, w, 44);
    group.add(bdr);

    const txt = this.add.text(x, y, label, {
      fontFamily: '"Press Start 2P"',
      fontSize: '14px',
      color,
    }).setOrigin(0.5).setDepth(7);
    group.add(txt);

    bg.on('pointerover',  () => { bg.setFillStyle(0x2a2a5e); txt.setColor('#ffffff'); });
    bg.on('pointerout',   () => { bg.setFillStyle(fill);      txt.setColor(color);    });
    bg.on('pointerdown',  onClick);
  }

  _renderNodeGrid(group, centerX, centerY, panelW) {
    const colCount = 3;
    const colW = 220;
    const rowH = 58;
    const startX = centerX - (colCount - 1) * colW / 2;

    NODE_ICONS.forEach((node, i) => {
      const col = i % colCount;
      const row = Math.floor(i / colCount);
      const x = startX + col * colW;
      const y = centerY + row * rowH;

      const chip = this.add.rectangle(x, y, 200, 48, 0x0d0d20, 0.9).setDepth(6);
      group.add(chip);

      const chipBorder = this.add.graphics().setDepth(6);
      chipBorder.lineStyle(1, Phaser.Display.Color.HexStringToColor(node.color).color, 0.6);
      chipBorder.strokeRect(x - 100, y - 24, 200, 48);
      group.add(chipBorder);

      const emoji = this.add.text(x - 80, y, node.emoji, { fontSize: '20px' }).setOrigin(0, 0.5).setDepth(7);
      group.add(emoji);

      const label = this.add.text(x - 50, y - 9, node.label, {
        fontFamily: '"Press Start 2P"',
        fontSize: '9px',
        color: node.color,
      }).setDepth(7);
      group.add(label);

      const desc = this.add.text(x - 50, y + 5, node.desc, {
        fontFamily: '"Press Start 2P"',
        fontSize: '8px',
        color: '#888888',
      }).setDepth(7);
      group.add(desc);
    });
  }

  _advance() {
    if (this._step < STEPS.length - 1) {
      this._step++;
      this._renderStep();
    } else {
      this._finish();
    }
  }

  _goBack() {
    if (this._step > 0) {
      this._step--;
      this._renderStep();
    }
  }

  _finish() {
    localStorage.setItem('purrogue_tutorial_done', '1');
    const returnTo = (this._heroData && this._heroData.returnTo) || 'MapScene';
    this.scene.start(returnTo);
  }
}
