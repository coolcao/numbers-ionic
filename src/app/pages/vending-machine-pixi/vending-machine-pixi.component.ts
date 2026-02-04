import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Application, Assets, BlurFilter, Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { AudioService } from 'src/app/service/audio.service';

interface Toy {
  id: number;
  name: string;
  price: number;
  color: number; // Hex color
  sprite?: Container;
  imageId: number; // 1-9
  innerScale?: number;
}

@Component({
  selector: 'app-vending-machine-pixi',
  standalone: false,
  templateUrl: './vending-machine-pixi.component.html',
  styleUrls: ['./vending-machine-pixi.component.css'],
})
export class VendingMachinePixiComponent
  implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('pixiContainer', { static: true }) pixiContainer!: ElementRef;

  private app!: Application;
  private mode: 'simple' | 'hard' = 'simple';

  // Game State
  private toys: Toy[] = [];
  selectedToy: Toy | null = null;
  private currentBalance = 0;
  private isProcessing = false;

  // Scene Elements
  private machineContainer!: Container;
  private toysContainer!: Container;
  private coinWalletContainer!: Container;
  private displayPriceText!: Text;
  private displayBalanceText!: Text;
  private coinSlotZone!: Graphics;
  private pushBtn!: Container;
  private pushText!: Text;

  private observer?: MutationObserver;

  // 存储共享的布局属性，确保对齐
  private machineWidth = 0;
  private machineHeight = 0;
  private windowWidth = 0;
  private windowHeight = 0;
  private rowHeight = 0;
  private toyBaseScale = 1.0;

  // Constants
  private readonly TOY_IMAGE_COUNT = 61;
  private readonly COIN_COLORS = {
    1: 0xc0c0c0, // Silver
    5: 0xffd700, // Gold
    10: 0xb8860b, // Dark Gold
  };

  private readonly BG_COLORS = [
    0xFF9FF3, 0xFeca57, 0xFF6B6B, 0x48DBFB, 0x1DD1A1,
    0x00D2D3, 0x54A0FF, 0x5F27CD, 0xC8D6E5
  ];

  // Theme Colors
  private isDarkMode = false;
  private colors = {
    body: 0xE84118,
    shadow: 0x000000,
    glass: 0xDFF9FB,
    shelf: 0x95A5A6,
    panel: 0x2F3640,
    walletBg: 0xFFFFFF,
    walletBorder: 0xE17055,
    textHighlight: 0xFFFFFF,
    headerBg: 0xFFFFFF,
    headerText: 0xE84118,
    tagBg: 0xFFFFFF,
    tagText: 0x000000,
    toyStroke: 0xFFFFFF
  };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private audioService: AudioService,
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      // 首页传递的是 'advanced' 或 'starter'
      this.mode = params['mode'] === 'advanced' ? 'hard' : 'simple';
    });

    // 检测暗黑模式
    this.isDarkMode = document.body.classList.contains('dark');
    this.initThemeColors();

    // 监听主题变化
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          const isDark = document.body.classList.contains('dark');
          if (this.isDarkMode !== isDark) {
            this.isDarkMode = isDark;
            this.updateTheme();
          }
        }
      });
    });

    this.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  private initThemeColors() {
    if (this.isDarkMode) {
      this.colors = {
        body: 0x5D0F0A, // 深酒红 (更暗)
        shadow: 0x000000,
        glass: 0x17202A, // 深灰黑 (更暗)
        shelf: 0x4D5656, // 暗灰栏杆
        panel: 0x17202A, // 与玻璃一致的深色
        walletBg: 0x1C2833, // 深蓝灰钱包底
        walletBorder: 0x5D0F0A, // 深红边框
        textHighlight: 0x95A5A6, // 灰色高亮
        headerBg: 0x2C3E50, // 深色标题栏
        headerText: 0xE74C3C, // 亮红文字
        tagBg: 0x2C3E50, // 深色标签底
        tagText: 0xECF0F1, // 亮色标签字
        toyStroke: 0x95A5A6 // 浅灰描边
      };
    } else {
      this.colors = {
        body: 0xE84118,
        shadow: 0x000000,
        glass: 0xDFF9FB,
        shelf: 0x95A5A6,
        panel: 0x2F3640,
        walletBg: 0xFFFFFF,
        walletBorder: 0xE17055,
        textHighlight: 0xFFFFFF,
        headerBg: 0xFFFFFF,
        headerText: 0xE84118,
        tagBg: 0xFFFFFF,
        tagText: 0x000000,
        toyStroke: 0xFFFFFF
      };
    }
  }

  // 动态更新主题
  private updateTheme() {
    if (!this.app) return;

    // 1. 更新颜色配置
    this.initThemeColors();

    // 2. 更新背景色
    const bgColor = this.isDarkMode ? '#082F49' : '#f0f9ff';
    this.app.renderer.background.color = bgColor;

    // 3. 重绘场景
    this.app.stage.removeChildren();
    this.createScene();

    // 重绘玩具（保留数据）
    this.generateToys();
  }

  async ngAfterViewInit() {
    setTimeout(() => this.initGame(), 100);
  }

  async initGame() {
    try {
      const audioPromises = [
        this.audioService.preload('insert_coin', 'assets/audio/vending-machine/dropping-a-coin.mp3'),
        this.audioService.preload('checkout_success', 'assets/audio/right_answer.mp3'),
        this.audioService.preload('checkout_fail', 'assets/audio/wrong_answer.mp3'),
      ];

      const texturePromises = [];
      for (let i = 1; i <= this.TOY_IMAGE_COUNT; i++) {
        texturePromises.push(Assets.load(`assets/images/number-vending/toys/${i}.png`));
      }

      await Promise.all([...audioPromises, ...texturePromises]);
    } catch (e) {
      console.warn('Resource load failed', e);
    }

    this.app = new Application();

    const bgColor = this.isDarkMode ? '#082F49' : '#f0f9ff';

    // 获取容器实际尺寸
    const width = this.pixiContainer.nativeElement.clientWidth;
    const height = this.pixiContainer.nativeElement.clientHeight;

    await this.app.init({
      background: bgColor,
      backgroundAlpha: 1,
      width: width || window.innerWidth,
      height: height || window.innerHeight,
      resizeTo: this.pixiContainer.nativeElement,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    this.pixiContainer.nativeElement.appendChild(this.app.canvas);

    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    this.createScene();
    this.generateToys();
  }

  private createScene() {
    const { width, height } = this.app.screen;

    // --- A. Vending Machine Body ---
    this.machineContainer = new Container();
    this.machineContainer.x = width / 2;
    this.machineContainer.y = height * 0.38;
    this.app.stage.addChild(this.machineContainer);

    this.machineHeight = height * 0.65;
    const isNarrowScreen = width <= 480;
    const maxWidthRatio = isNarrowScreen ? 0.95 : 0.85;
    this.machineWidth = Math.min(width * maxWidthRatio, this.machineHeight * 0.72);

    // Shadow
    const shadow = new Graphics()
      .roundRect(-this.machineWidth / 2 + 6, -this.machineHeight / 2 + 6, this.machineWidth, this.machineHeight, 18)
      .fill({ color: this.colors.shadow, alpha: this.isDarkMode ? 0.5 : 0.12 });
    this.machineContainer.addChild(shadow);

    // Body
    const body = new Graphics()
      .roundRect(-this.machineWidth / 2, -this.machineHeight / 2, this.machineWidth, this.machineHeight, 18)
      .fill(this.colors.body)
      .stroke({ width: 5, color: this.colors.panel });
    this.machineContainer.addChild(body);

    // Header / Title
    const headerHeight = this.machineHeight * 0.09;
    const header = new Graphics()
      .roundRect(
        -this.machineWidth / 2 + 6,
        -this.machineHeight / 2 + 6,
        this.machineWidth - 12,
        headerHeight,
        12,
      )
      .fill(this.colors.headerBg);
    this.machineContainer.addChild(header);

    const titleText = new Text('TOY SHOP', {
      fontSize: headerHeight * 0.6,
      fill: this.colors.headerText,
      fontWeight: '900',
      fontFamily: 'Arial Black',
      stroke: { color: '#FFFFFF', width: 6, join: 'round' },
      padding: 15,
      dropShadow: {
        alpha: 0.3,
        blur: 4,
        color: '#000000',
        distance: 4,
        angle: Math.PI / 6,
      },
    });
    titleText.anchor.set(0.5);
    titleText.y = -this.machineHeight / 2 + 6 + headerHeight / 2;
    this.machineContainer.addChild(titleText);

    // --- Display Window ---
    const windowMargin = 10;
    this.windowWidth = this.machineWidth - windowMargin * 2;
    this.windowHeight = this.machineHeight * 0.5;
    const windowY = -this.machineHeight / 2 + headerHeight + 12 + this.windowHeight / 2;

    const glass = new Graphics()
      .rect(-this.windowWidth / 2, -this.windowHeight / 2, this.windowWidth, this.windowHeight)
      .fill({ color: this.colors.glass, alpha: 0.9 })
      .stroke({ width: 3, color: this.colors.textHighlight });

    // Shelves
    const shelfCount = 3;
    this.rowHeight = this.windowHeight / shelfCount;
    for (let i = 1; i < shelfCount; i++) {
      const shelfY = -this.windowHeight / 2 + i * this.rowHeight;
      glass.rect(-this.windowWidth / 2, shelfY, this.windowWidth, 3).fill(this.colors.shelf);
    }

    const glassContainer = new Container();
    glassContainer.y = windowY;
    glassContainer.addChild(glass);
    this.machineContainer.addChild(glassContainer);

    this.toysContainer = new Container();
    glassContainer.addChild(this.toysContainer);

    // --- Control Panel Area ---
    const bottomAreaY = windowY + this.windowHeight / 2 + 5;
    const controlPanelWidth = this.machineWidth * 0.4;
    const controlPanelX = this.machineWidth / 2 - controlPanelWidth / 2 - 10;
    const panelHeight = (this.machineHeight / 2 - bottomAreaY) * 0.85;
    const controlPanelY = this.machineHeight / 2 - panelHeight / 2 - 15;

    const panelBg = new Graphics()
      .roundRect(-controlPanelWidth / 2, -panelHeight / 2, controlPanelWidth, panelHeight, 10)
      .fill(this.colors.panel);

    const panelContainer = new Container();
    panelContainer.x = controlPanelX;
    panelContainer.y = controlPanelY;
    panelContainer.addChild(panelBg);
    this.machineContainer.addChild(panelContainer);

    // Display screen
    const screenH = panelHeight * 0.3;
    const screenY = -panelHeight / 2 + 8;
    const screenBg = new Graphics()
      .rect(-controlPanelWidth / 2 + 5, screenY, controlPanelWidth - 10, screenH)
      .fill(0x000000);
    panelContainer.addChild(screenBg);

    const screenCenterY = screenY + screenH / 2;

    const priceStyle = new TextStyle({
      fontFamily: 'Courier New, Arial',
      fontSize: Math.min(screenH * 0.32, 16),
      fill: '#00FF00',
      fontWeight: 'bold',
      align: 'center',
    });

    this.displayPriceText = new Text({ text: '选择', style: priceStyle });
    this.displayPriceText.anchor.set(0.5);
    this.displayPriceText.y = screenCenterY - screenH * 0.22;
    panelContainer.addChild(this.displayPriceText);

    this.displayBalanceText = new Text({
      text: '¥0',
      style: { ...priceStyle, fontSize: Math.min(screenH * 0.28, 14), fill: '#F1C40F' } as any
    });
    this.displayBalanceText.anchor.set(0.5);
    this.displayBalanceText.y = screenCenterY + screenH * 0.22;
    panelContainer.addChild(this.displayBalanceText);

    // Coin Slot
    const slotRadius = Math.min(controlPanelWidth * 0.28, panelHeight * 0.15);
    const slotCenterY = panelHeight * 0.22;

    const slotOuter = new Graphics()
      .circle(0, slotCenterY, slotRadius)
      .fill(0x7F8FA6)
      .stroke({ width: 2, color: 0xDCDDE1 });

    const holeW = slotRadius * 0.25;
    const holeH = slotRadius * 1.1;
    const slotHole = new Graphics()
      .rect(-holeW / 2, slotCenterY - holeH / 2, holeW, holeH)
      .fill(0x000000);

    const slotText = new Text({
      text: 'COIN',
      style: {
        fontSize: Math.max(8, slotRadius * 0.4),
        fill: '#FFFFFF',
        fontWeight: 'bold'
      }
    });
    slotText.anchor.set(0.5);
    slotText.y = slotCenterY + slotRadius + (panelHeight * 0.05);

    this.coinSlotZone = slotOuter;
    panelContainer.addChild(slotOuter, slotHole, slotText);

    // --- Exit Door (PUSH) ---
    const exitW = this.machineWidth - controlPanelWidth - 25;
    const exitX = -this.machineWidth / 2 + exitW / 2 + 8;
    const exitH = panelHeight * 0.8;
    const exitY = controlPanelY + panelHeight / 2 - exitH / 2;

    const exitDoor = new Graphics()
      .roundRect(-exitW / 2, -exitH / 2, exitW, exitH, 8)
      .fill(this.colors.panel);

    const exitFlap = new Graphics()
      .rect(-exitW / 2 + 5, -exitH / 2 + 5, exitW - 10, exitH - 10)
      .fill({ color: this.colors.shadow, alpha: 0.5 })
      .stroke({ width: 1, color: this.colors.textHighlight });

    const pushText = new Text({
      text: 'PUSH',
      style: { fontSize: exitH * 0.25, fill: '#7F8FA6', fontWeight: 'bold' }
    });
    pushText.anchor.set(0.5);

    const exitContainer = new Container();
    exitContainer.x = exitX;
    exitContainer.y = exitY;
    exitContainer.addChild(exitDoor, exitFlap, pushText);

    exitContainer.eventMode = 'static';
    exitContainer.cursor = 'pointer';
    exitContainer.on('pointerdown', () => this.tryCheckout());

    this.pushBtn = exitContainer;
    this.pushText = pushText;

    this.machineContainer.addChild(exitContainer);

    this.createCoinWallet(height);
  }

  private createCoinWallet(screenHeight: number) {
    const screenWidth = this.app.screen.width;

    let walletHeight = 140;
    let coinScale = 1.0;

    if (screenHeight < 600) {
      walletHeight = 85;
      coinScale = 0.65;
    } else if (screenHeight < 900) {
      walletHeight = 115;
      coinScale = 0.85;
    }

    this.coinWalletContainer = new Container();
    this.coinWalletContainer.x = screenWidth / 2;
    this.coinWalletContainer.y = screenHeight - (walletHeight / 2) - 10;
    this.app.stage.addChild(this.coinWalletContainer);

    const bg = new Graphics()
      .roundRect(-this.machineWidth / 2, -walletHeight / 2, this.machineWidth, walletHeight, 20)
      .fill({ color: this.colors.walletBg, alpha: 0.95 })
      .stroke({ width: 3, color: this.colors.walletBorder });
    this.coinWalletContainer.addChild(bg);

    const coins = this.mode === 'simple' ? [1, 5] : [1, 5, 10];
    const spacing = Math.min(110 * coinScale, this.machineWidth / (coins.length + 0.5));
    const startX = -((coins.length - 1) * spacing) / 2;

    coins.forEach((value, index) => {
      const x = startX + index * spacing;

      const placeholder = this.drawCoinGraphics(value);
      placeholder.scale.set(coinScale);
      placeholder.alpha = 0.3;
      placeholder.x = x;
      this.coinWalletContainer.addChild(placeholder);

      const visualCoin = this.drawCoinGraphics(value);
      visualCoin.label = 'visual_coin'; // Pixi 8 use label or name. Keeping name for safety if older version, but label is preferred in 8.
      visualCoin.scale.set(coinScale);
      visualCoin.x = x;

      visualCoin.eventMode = 'static';
      visualCoin.cursor = 'grab';
      visualCoin.on('pointerdown', (e) => this.spawnDraggableCoin(value, e.global.x, e.global.y, coinScale));

      this.coinWalletContainer.addChild(visualCoin);
    });
    
    this.updateWalletState();
  }

  private drawCoinGraphics(value: number): Graphics {
    const g = new Graphics();

    let baseColor = 0xFFFFFF;
    let shadowColor = 0x000000;
    let highlightColor = 0xFFFFFF;

    if (value === 1) {
      baseColor = 0xE0E0E0;
      shadowColor = 0x7F8C8D;
      highlightColor = 0xFFFFFF;
    } else if (value === 5) {
      baseColor = 0xCD7F32;
      shadowColor = 0x5D4037;
      highlightColor = 0xFFA726;
    } else {
      baseColor = 0xFFD700;
      shadowColor = 0x996515;
      highlightColor = 0xFFF176;
    }

    const radius = value === 1 ? 34 : (value === 5 ? 35 : 36);

    g.circle(0, 3, radius).fill(shadowColor);
    g.circle(0, 0, radius).fill(baseColor);
    g.circle(-radius * 0.3, -radius * 0.3, radius * 0.4).fill({ color: highlightColor, alpha: 0.5 });
    g.circle(0, 0, radius * 0.82).stroke({ width: 1.5, color: shadowColor, alpha: 0.4 });

    const text = new Text({
      text: `${value}`,
      style: {
        fontSize: radius * 0.9,
        fontWeight: '900',
        fill: shadowColor,
        fontFamily: 'Arial Black',
        dropShadow: {
          alpha: 0.3,
          angle: 45,
          blur: 1,
          color: highlightColor,
          distance: 1,
        }
      }
    });
    text.anchor.set(0.5);
    text.y = 0;

    g.addChild(text);
    return g;
  }

  private spawnDraggableCoin(value: number, globalX: number, globalY: number, scale: number) {
    if (this.isProcessing || !this.selectedToy) {
      if (!this.selectedToy) this.audioService.play('checkout_fail', { interrupt: false });
      return;
    }

    const coin = this.drawCoinGraphics(value);
    coin.scale.set(scale * 1.2);
    coin.position.set(globalX, globalY);
    coin.alpha = 0.9;

    coin.eventMode = 'dynamic';
    coin.cursor = 'grabbing';

    let isDragging = true;

    const onMove = (e: any) => {
      if (isDragging) {
        coin.position.set(e.global.x, e.global.y);
      }
    };

    const onUp = () => {
      isDragging = false;
      this.app.stage.off('pointermove', onMove);
      this.app.stage.off('pointerup', onUp);
      this.app.stage.off('pointerupoutside', onUp);

      coin.scale.set(scale);
      coin.alpha = 1.0;

      const slotGlobalPos = this.coinSlotZone.getGlobalPosition();
      const dx = coin.x - slotGlobalPos.x;
      const dy = coin.y - slotGlobalPos.y;

      if (Math.sqrt(dx * dx + dy * dy) < 80) {
        this.handleCoinDrop(value, coin);
      } else {
        const fadeOut = (ticker: any) => {
          coin.alpha -= 0.1;
          coin.scale.x -= 0.05;
          coin.scale.y -= 0.05;
          if (coin.alpha <= 0) {
            this.app.ticker.remove(fadeOut);
            this.app.stage.removeChild(coin);
            coin.destroy();
          }
        };
        this.app.ticker.add(fadeOut);
      }
    };

    this.app.stage.addChild(coin);

    this.app.stage.on('pointermove', onMove);
    this.app.stage.on('pointerup', onUp);
    this.app.stage.on('pointerupoutside', onUp);
  }

  private handleCoinDrop(value: number, coinSprite: Graphics) {
    this.audioService.play('insert_coin', { interrupt: false });
    this.currentBalance += value;
    this.updateDisplay();

    const slotPos = this.coinSlotZone.getGlobalPosition();

    const animateDrop = (ticker: any) => {
      coinSprite.x += (slotPos.x - coinSprite.x) * 0.2;
      coinSprite.y += (slotPos.y - coinSprite.y) * 0.2;
      coinSprite.scale.x *= 0.8;
      coinSprite.scale.y *= 0.8;
      coinSprite.alpha -= 0.1;

      if (coinSprite.alpha <= 0.1) {
        this.app.ticker.remove(animateDrop);
        this.app.stage.removeChild(coinSprite);
        coinSprite.destroy();
        this.updatePushStatus();
      }
    };
    this.app.ticker.add(animateDrop);
  }

  private generateToys() {
    this.toysContainer.removeChildren();

    // 如果没有数据（初次初始化），则生成数据
    if (this.toys.length === 0) {
      this.selectedToy = null;
      this.currentBalance = 0;
      this.updateDisplay();

      const allIds = Array.from({ length: this.TOY_IMAGE_COUNT }, (_, k) => k + 1);
      for (let i = allIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
      }
      const selectedIds = allIds.slice(0, 9);

      let prices: number[] = [];
      if (this.mode === 'simple') {
        for (let k = 0; k < 3; k++) prices.push(Math.floor(Math.random() * 3) + 1);
        for (let k = 0; k < 3; k++) prices.push(Math.floor(Math.random() * 3) + 4);
        for (let k = 0; k < 3; k++) prices.push(Math.floor(Math.random() * 3) + 7);
        prices.sort(() => 0.5 - Math.random());
      } else {
        prices = Array.from({ length: 9 }, () => Math.floor(Math.random() * 90) + 10);
      }

      for (let i = 0; i < 9; i++) {
        const toyData: Toy = {
          id: i,
          name: `Toy ${i}`,
          price: prices[i],
          color: this.BG_COLORS[i % this.BG_COLORS.length],
          // @ts-ignore
          imageId: selectedIds[i]
        };
        this.toys.push(toyData);
      }
    } else {
      this.updateDisplay();
    }

    const cols = 3;
    const colWidth = this.windowWidth / cols;

    const baseWidth = 80;
    const baseHeight = 100;
    const scaleX = (colWidth * 0.85) / baseWidth;
    const scaleY = (this.rowHeight * 0.85) / baseHeight;
    this.toyBaseScale = Math.min(1.5, Math.min(scaleX, scaleY)); // 调大最大限制

    for (let i = 0; i < this.toys.length; i++) {
      const toyData = this.toys[i];
      const toyContainer = new Container();

      const isSelected = this.selectedToy && this.selectedToy.id === toyData.id;
      toyContainer.scale.set(isSelected ? this.toyBaseScale * 1.4 : this.toyBaseScale);

      const row = Math.floor(i / cols);
      const col = i % cols;
      const floorY = -this.windowHeight / 2 + (row + 1) * this.rowHeight;
      const yOffset = 55 * this.toyBaseScale;

      toyContainer.x = -this.windowWidth / 2 + colWidth / 2 + col * colWidth;
      toyContainer.y = floorY - yOffset;

      // 1. 先创建 Sprite (底层)
      // @ts-ignore
      const texture = Assets.get(`assets/images/number-vending/toys/${toyData.imageId}.png`);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);

      const maxDim = Math.max(sprite.width, sprite.height);
      const baseInnerScale = 90 / maxDim; // 调大基准尺寸 (75 -> 90)
      toyData.innerScale = baseInnerScale;

      sprite.scale.set(baseInnerScale);
      sprite.y = 0;
      toyContainer.addChild(sprite);

      // 2. 后创建标签 (顶层，确保不被图片遮挡)
      const tag = new Graphics()
        .roundRect(-25, 30, 50, 20, 4)
        .fill(this.colors.tagBg)
        .stroke({ width: 1, color: 0x000000 });
      
      const priceText = new Text(`¥${toyData.price}`, {
        fontSize: 14,
        fill: this.colors.tagText,
        fontWeight: 'bold',
      });
      priceText.anchor.set(0.5);
      priceText.y = 40;

      tag.visible = !!isSelected;
      priceText.visible = !!isSelected;

      toyContainer.addChild(tag, priceText);

      toyContainer.eventMode = 'static';
      toyContainer.cursor = 'pointer';
      toyContainer.on('pointerdown', () => this.selectToy(toyData, toyContainer));

      this.toysContainer.addChild(toyContainer);
      toyData.sprite = toyContainer;
    }
  }

  private selectToy(toy: Toy, sprite: Container) {
    if (this.isProcessing) return;

    this.selectedToy = toy;
    this.currentBalance = 0;
    this.updateDisplay();
    this.audioService.play('click', { interrupt: false });

    this.toys.forEach(t => {
      if (t.sprite) {
        t.sprite.alpha = 0.5;
        t.sprite.scale.set(this.toyBaseScale);

        t.sprite.children.forEach(c => {
          if (!(c instanceof Sprite)) c.visible = false;
        });
      }
    });

    sprite.alpha = 1;
    sprite.scale.set(this.toyBaseScale * 1.4);

    sprite.children.forEach(c => {
      if (!(c instanceof Sprite)) c.visible = true;
    });
  }

  private updateDisplay() {
    if (!this.selectedToy) {
      this.displayPriceText.text = "请选商品";
      this.displayPriceText.style.fill = '#00ff00';
    } else {
      this.displayPriceText.text = `价格: ¥${this.selectedToy.price}`;
      this.displayPriceText.style.fill = '#ff5252';
    }

    this.displayBalanceText.text = `已投: ¥${this.currentBalance}`;
    this.displayBalanceText.style.fill = '#00ff00';

    this.updatePushStatus();
    this.updateWalletState();
  }

  private updateWalletState() {
    if (!this.coinWalletContainer) return;
    
    const isEnabled = !!this.selectedToy && !this.isProcessing;

    this.coinWalletContainer.children.forEach(child => {
      if (child.label === 'visual_coin') {
        child.alpha = isEnabled ? 1 : 0.5;
        child.eventMode = isEnabled ? 'static' : 'none';
        child.cursor = isEnabled ? 'grab' : 'default';
      }
    });
  }

  private updatePushStatus() {
    if (!this.selectedToy || this.currentBalance === 0) {
      this.pushText.style.fill = '#7F8FA6';
      this.pushBtn.alpha = 1;
      return;
    }

    this.pushText.style.fill = '#00FF00';
    this.pushBtn.alpha = 1;
  }

  private tryCheckout() {
    if (this.isProcessing) return;

    if (!this.selectedToy) {
      this.audioService.play('checkout_fail');
      return;
    }

    if (this.currentBalance < this.selectedToy.price) {
      // [语音需求 1] 投币不足
      // 建议文件名: money_not_enough.mp3
      // 建议文案: "还差一点点钱哦，请继续投币吧！"
      // 当前使用: checkout_fail (wrong_answer.mp3)
      this.audioService.play('checkout_fail');

      const originalText = this.displayPriceText.text;
      const originalColor = this.displayPriceText.style.fill;

      this.displayPriceText.text = "钱不够哦";
      this.displayPriceText.style.fill = '#ff0000';

      setTimeout(() => {
        if (this.selectedToy) {
          this.displayPriceText.text = originalText;
          this.displayPriceText.style.fill = originalColor;
        }
      }, 1500);

      return;
    }

    const originalScale = this.pushBtn.scale.x;
    this.pushBtn.scale.set(originalScale * 0.95);
    setTimeout(() => this.pushBtn.scale.set(originalScale), 100);

    if (this.currentBalance === this.selectedToy.price) {
      // [语音需求 2] 投币正好
      // 建议文件名: buy_success.mp3
      // 建议文案: "太棒了！购买成功！"
      // 当前使用: checkout_success (right_answer.mp3)
      // this.audioService.play('buy_success');
      this.success("购买成功!");
    } else {
      const change = this.currentBalance - this.selectedToy.price;
      // [语音需求 3] 投币过多 (找零)
      // 建议文件名: change_returned.mp3
      // 建议文案: "购买成功！这是找给你的零钱。"
      // (注：如果能动态读出找零金额更好，如 "找你2元"，但通用文案也够用)
      // 当前使用: checkout_success (right_answer.mp3)
      // this.audioService.play('change_returned');
      this.success(`找零: ¥${change}`);
    }
  }

  private success(message: string) {
    this.isProcessing = true;
    this.audioService.play('checkout_success');

    const successText = new Text(message, {
      fontFamily: 'Arial Black',
      fontSize: 48,
      fill: '#E84118',
      stroke: { width: 4, color: '#FFFFFF' },
      dropShadow: {
        alpha: 0.5,
        blur: 4,
        distance: 4,
        angle: Math.PI / 6,
        color: '#000000'
      }
    });
    successText.anchor.set(0.5);

    if (this.selectedToy && this.selectedToy.sprite) {
      const sprite = this.selectedToy.sprite;

      // 1. 坐标系转换
      const globalPos = sprite.getGlobalPosition();
      if (sprite.parent) {
        sprite.parent.removeChild(sprite);
      }
      this.app.stage.addChild(sprite);
      sprite.position.set(globalPos.x, globalPos.y);

      // 隐藏非图片子对象
      sprite.children.forEach(child => {
        if (!(child instanceof Sprite)) {
          child.visible = false;
        }
      });

      // 2. 计算目标位置
      const targetX = this.machineContainer.x;
      const headerHeight = this.machineHeight * 0.09;
      const windowY = -this.machineHeight / 2 + headerHeight + 12 + this.windowHeight / 2;
      const targetY = this.machineContainer.y + windowY;

      successText.x = targetX;
      successText.y = targetY + 150;
      successText.alpha = 0;

      // 3. 准备背景特效
      const blurFilter = new BlurFilter();
      blurFilter.blur = 0;
      this.machineContainer.filters = [blurFilter];
      this.coinWalletContainer.filters = [blurFilter];

      const overlay = new Graphics()
        .rect(0, 0, this.app.screen.width, this.app.screen.height)
        .fill({ color: 0xFFFFFF, alpha: 0 });

      this.app.stage.addChild(overlay);
      this.app.stage.addChild(successText);

      // 撒花放在遮罩之上，玩具之下
      const confettiContainer = new Container();
      this.app.stage.addChild(confettiContainer);
      this.fireConfetti(confettiContainer, targetX, targetY);

      // 确保玩具在最顶层
      this.app.stage.addChild(sprite);

      let time = 0;
      const animate = (ticker: any) => {
        sprite.x += (targetX - sprite.x) * 0.025;
        sprite.y += (targetY - sprite.y) * 0.025;

        const currentScale = sprite.scale.x;
        const newScale = currentScale + (2.5 - currentScale) * 0.025;
        sprite.scale.set(newScale);

        sprite.rotation = Math.sin(time * 0.03) * 0.1;

        if (time < 60) {
          blurFilter.blur = (time / 60) * 8;
          overlay.alpha = (time / 60) * 0.8;
          successText.alpha = (time / 60);
          successText.y -= 0.5;
        }

        time++;

        if (time > 240) {
          this.app.ticker.remove(animate);

          sprite.destroy();
          successText.destroy();
          confettiContainer.destroy({ children: true });
          overlay.destroy();

          this.machineContainer.filters = [];
          this.coinWalletContainer.filters = [];

          this.isProcessing = false;
          this.selectedToy = null;
          this.currentBalance = 0;
          this.updateDisplay();

          this.toys = [];
          this.generateToys();
        }
      };

      this.app.ticker.add(animate);
    }
  }

  private fireConfetti(container: Container, x: number, y: number) {
    const colors = [0xFF6B6B, 0x4ECDC4, 0xFFD93D, 0xFFFFFF, 0x6C5CE7];
    const particleCount = 80;

    for (let i = 0; i < particleCount; i++) {
      const p = new Graphics();
      const color = colors[Math.floor(Math.random() * colors.length)];

      if (Math.random() > 0.5) {
        p.circle(0, 0, 6 + Math.random() * 4);
      } else {
        p.rect(-5, -5, 10 + Math.random() * 5, 10 + Math.random() * 5);
      }
      p.fill(color);

      p.x = x;
      p.y = y;

      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      const vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed - 5;
      const rotationSpeed = (Math.random() - 0.5) * 0.2;

      container.addChild(p);

      const updateParticle = (ticker: any) => {
        if (p.destroyed) return;

        p.x += vx;
        p.y += vy;
        p.rotation += rotationSpeed;

        vy += 0.3;

        if (p.y > this.app.screen.height + 50) {
          this.app.ticker.remove(updateParticle);
          if (!p.destroyed) p.destroy();
        }
      };
      this.app.ticker.add(updateParticle);
    }
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
    }
  }
}
