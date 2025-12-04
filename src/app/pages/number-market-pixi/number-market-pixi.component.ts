import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  WritableSignal,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  Application,
  Container,
  Graphics,
  Text,
  TextStyle,
  Texture,
  Assets,
  Sprite,
} from 'pixi.js';
import { AppService } from 'src/app/service/app.service';
import { AudioService } from 'src/app/service/audio.service';
import { AppStore } from 'src/app/store/app.store';
import {
  GoodsItem,
  NumberMarketStore,
} from 'src/app/store/number-market.store';
import { NumberMarketService } from '../number-market/number-market.service';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-number-market-pixi',
  templateUrl: './number-market-pixi.component.html',
  styleUrls: ['./number-market-pixi.component.css'],
  standalone: false,
  animations: [
    trigger('gameOverAnimation', [
      transition(':enter', [
        style({ transform: 'scale(0.8)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'scale(1)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate(
          '200ms ease-in',
          style({ transform: 'scale(0.8)', opacity: 0 }),
        ),
      ]),
    ]),
  ],
})
export class NumberMarketPixiComponent implements OnInit, OnDestroy {
  @ViewChild('pixiContainer', { static: true }) pixiContainer!: ElementRef;

  router = inject(Router);
  store = inject(AppStore);
  marketStore = inject(NumberMarketStore);
  audioService = inject(AudioService);
  service = inject(NumberMarketService);
  appService = inject(AppService);

  // Game State
  gameState: WritableSignal<'init' | 'playing' | 'finished'> = signal('init');
  targetNumber = signal(0);
  targetGoods = signal<GoodsItem | null>(null);
  goods = signal<GoodsItem[]>([]);
  cartGoods = signal<GoodsItem[]>([]);

  totalRound = signal(6);
  currentRound = signal(0);
  correctRound = signal(0);

  // Pixi
  private app!: Application;
  private goodsContainer!: Container;
  private cartContainer!: Container;
  private dragContainer!: Container; // Container for items currently being dragged
  private cartZone!: Graphics; // Visual representation of the cart

  // Layout Constants
  private readonly CART_HEIGHT_RATIO = 0.35;
  private readonly GOODS_AREA_PADDING = 20;

  constructor() {
    effect(() => {
      if (this.gameState() === 'finished') {
        this.playGameOver();
      }
    });
  }

  private resizeObserver: ResizeObserver | null = null;

  async ngOnInit() {
    console.log('NumberMarketPixiComponent ngOnInit started');
    console.log('Current GameState:', this.gameState());
    try {
      await this.appService.lockPortrait();
      console.log('Screen locked');
      await this.initPixi();
      console.log('Pixi initialized');
      await this.playWelcome();
      console.log('Welcome played');
    } catch (error) {
      console.error('Error in ngOnInit:', error);
    }

    // Listen to window resize
    // window.addEventListener('resize', this.onResize.bind(this)); // Handled by ResizeObserver
  }

  async ngOnDestroy() {
    // window.removeEventListener('resize', this.onResize.bind(this));
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    try {
      await this.appService.unlockScreen();
    } catch (e) {
      console.error('Error unlocking screen:', e);
    }
    this.audioService.stopAll();
    if (this.app) {
      this.app.destroy(true, {
        children: true,
        texture: true,
        // baseTexture: true,
      });
    }
  }

  private async initPixi() {
    console.log('Initializing Pixi...');
    const container = this.pixiContainer.nativeElement;
    console.log(
      'Container dimensions:',
      container.clientWidth,
      container.clientHeight,
    );

    try {
      this.app = new Application();
      await this.app.init({
        resizeTo: container,
        backgroundAlpha: 0, // Transparent background to let CSS gradient show
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });
      console.log('Pixi Application created', this.app);

      if (this.app.canvas) {
        container.appendChild(this.app.canvas);
        console.log('Canvas appended to container');
      } else {
        console.error('Pixi app.canvas is undefined!');
      }

      // Create Layers
      this.cartContainer = new Container();
      this.goodsContainer = new Container();
      this.dragContainer = new Container();

      this.app.stage.addChild(this.cartContainer);
      this.app.stage.addChild(this.goodsContainer);
      this.app.stage.addChild(this.dragContainer); // Drag layer on top

      this.setupLayout();
      console.log('Layout setup complete');

      // Setup ResizeObserver
      this.resizeObserver = new ResizeObserver(() => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        console.log('ResizeObserver triggered. New dimensions:', w, h);
        if (w > 0 && h > 0) {
          this.app.resize();
          console.log(
            'Pixi App resized to:',
            this.app.screen.width,
            this.app.screen.height,
          );
          this.setupLayout();
        }
      });
      this.resizeObserver.observe(container);
    } catch (error) {
      console.error('Error in initPixi:', error);
    }
  }

  private setupLayout() {
    if (!this.app) return;
    const width = this.app.screen.width;
    const height = this.app.screen.height;

    // Clear previous
    this.cartContainer.removeChildren();
    this.goodsContainer.removeChildren();

    const GOODS_HEIGHT_RATIO = 0.4;
    const CART_HEIGHT_RATIO = 0.35;
    const PADDING = 20;
    const GAP = 5;

    const goodsHeight = height * GOODS_HEIGHT_RATIO;
    const cartHeight = height * CART_HEIGHT_RATIO;

    const goodsY = 60;
    const cartY = goodsY + goodsHeight + GAP;

    // ===== 绘制卡通货架 =====
    this.drawCartoonShelf(
      PADDING,
      goodsY,
      width - PADDING * 2,
      goodsHeight - PADDING,
    );

    // ===== 绘制卡通购物车 =====
    this.drawCartoonCart(
      PADDING,
      cartY,
      width - PADDING * 2,
      cartHeight - PADDING,
    );

    // 存储购物车碰撞区域
    this.cartZone.label = 'cart';
    (this.cartZone as any).hitAreaBounds = {
      x: PADDING + 20,
      y: cartY + 80, // 留出购物车顶部装饰空间
      width: width - PADDING * 2 - 40,
      height: cartHeight - PADDING - 80,
    };

    // 重新渲染商品
    if (this.goods().length > 0) {
      this.renderGoods();
    }
    this.renderCartItems();
  }

  private drawCartoonShelf(x: number, y: number, w: number, h: number) {
    const shelfBg = new Graphics();

    // 货架背景 - 木质纹理效果
    shelfBg.roundRect(x, y, w, h, 15);
    shelfBg.fill({ color: 0xfef3c7, alpha: 0.3 }); // 浅黄色背景

    // 货架边框 - 橙色边框
    shelfBg.roundRect(x, y, w, h, 15);
    shelfBg.stroke({ width: 6, color: 0xea580c });

    // 绘制货架层板 (两层)
    const shelfCount = 2;
    const shelfHeight = h / shelfCount;

    for (let i = 0; i < shelfCount; i++) {
      const shelfY = y + i * shelfHeight;

      // 货架板 - 木板效果
      const shelf = new Graphics();
      shelf.roundRect(x + 10, shelfY + 5, w - 20, 12, 6);
      shelf.fill({ color: 0x78350f }); // 深棕色

      // 货架板高光
      shelf.roundRect(x + 10, shelfY + 5, w - 20, 4, 6);
      shelf.fill({ color: 0x92400e, alpha: 0.5 });

      shelfBg.addChild(shelf);

      // 货架支撑柱
      if (i < shelfCount - 1) {
        const pillarLeft = new Graphics();
        pillarLeft.roundRect(x + 15, shelfY + 17, 8, shelfHeight - 22, 4);
        pillarLeft.fill({ color: 0x78350f });
        shelfBg.addChild(pillarLeft);

        const pillarRight = new Graphics();
        pillarRight.roundRect(x + w - 23, shelfY + 17, 8, shelfHeight - 22, 4);
        pillarRight.fill({ color: 0x78350f });
        shelfBg.addChild(pillarRight);
      }
    }

    // 添加装饰性标签
    const signBg = new Graphics();
    signBg.roundRect(x + w / 2 - 60, y - 15, 120, 30, 15);
    signBg.fill({ color: 0xfb923c }); // 橙色
    signBg.stroke({ width: 3, color: 0xea580c });

    const signText = new Text({
      text: '🍎 货架 🍊',
      style: new TextStyle({
        fontSize: 18,
        fill: 0xffffff,
        fontWeight: 'bold',
      }),
    });
    signText.anchor.set(0.5);
    signText.x = x + w / 2;
    signText.y = y;

    shelfBg.addChild(signBg);
    shelfBg.addChild(signText);

    shelfBg.label = 'goods-bg';
    this.goodsContainer.addChild(shelfBg);
  }

  private drawCartoonCart(x: number, y: number, w: number, h: number) {
    this.cartZone = new Graphics();

    // 购物车主体 - 3D效果
    const cartMainY = y + 50;
    const cartMainH = h - 50;

    // 购物车背景阴影
    this.cartZone.roundRect(x + 5, cartMainY + 5, w - 10, cartMainH - 10, 20);
    this.cartZone.fill({ color: 0x000000, alpha: 0.1 });

    // 购物车主体
    this.cartZone.roundRect(x, cartMainY, w, cartMainH, 20);
    this.cartZone.fill({ color: 0xfb923c }); // 橙色购物车

    // 购物车内部
    this.cartZone.roundRect(x + 10, cartMainY + 10, w - 20, cartMainH - 20, 15);
    this.cartZone.fill({ color: 0xffedd5 }); // 浅橙色内部

    // 购物车边框装饰
    this.cartZone.roundRect(x, cartMainY, w, cartMainH, 20);
    this.cartZone.stroke({ width: 4, color: 0xc2410c });

    // 购物车网格装饰
    const gridSize = 20;
    for (let gx = x + 20; gx < x + w - 20; gx += gridSize) {
      this.cartZone.moveTo(gx, cartMainY + 15);
      this.cartZone.lineTo(gx, cartMainY + cartMainH - 15);
      this.cartZone.stroke({ width: 1, color: 0xfed7aa, alpha: 0.3 });
    }
    for (
      let gy = cartMainY + 20;
      gy < cartMainY + cartMainH - 20;
      gy += gridSize
    ) {
      this.cartZone.moveTo(x + 15, gy);
      this.cartZone.lineTo(x + w - 15, gy);
      this.cartZone.stroke({ width: 1, color: 0xfed7aa, alpha: 0.3 });
    }

    // 购物车把手
    const handleY = y + 10;
    const handlePath = new Graphics();
    handlePath.moveTo(x + w / 2 - 40, handleY);
    handlePath.bezierCurveTo(
      x + w / 2 - 40,
      handleY - 20,
      x + w / 2 + 40,
      handleY - 20,
      x + w / 2 + 40,
      handleY,
    );
    handlePath.stroke({ width: 8, color: 0xc2410c });
    handlePath.bezierCurveTo(
      x + w / 2 + 40,
      handleY - 20,
      x + w / 2 - 40,
      handleY - 20,
      x + w / 2 - 40,
      handleY,
    );
    handlePath.stroke({ width: 6, color: 0xfb923c });
    this.cartZone.addChild(handlePath);

    // 购物车轮子
    const wheelY = cartMainY + cartMainH - 5;
    const wheelPositions = [x + 30, x + w - 30];

    wheelPositions.forEach((wheelX) => {
      // 轮子阴影
      const wheelShadow = new Graphics();
      wheelShadow.circle(wheelX + 2, wheelY + 2, 12);
      wheelShadow.fill({ color: 0x000000, alpha: 0.2 });
      this.cartZone.addChild(wheelShadow);

      // 轮子外圈
      const wheel = new Graphics();
      wheel.circle(wheelX, wheelY, 12);
      wheel.fill({ color: 0x1f2937 }); // 深灰色

      // 轮子内圈
      wheel.circle(wheelX, wheelY, 8);
      wheel.fill({ color: 0x4b5563 }); // 灰色

      // 轮子中心
      wheel.circle(wheelX, wheelY, 4);
      wheel.fill({ color: 0x9ca3af }); // 浅灰色

      this.cartZone.addChild(wheel);
    });

    // 购物车标签
    const cartLabel = new Text({
      text: '🛒 购物车',
      style: new TextStyle({
        fontSize: 24,
        fill: 0xc2410c,
        fontWeight: 'bold',
        stroke: { color: 0xffffff, width: 3 },
      }),
    });
    cartLabel.anchor.set(0.5);
    cartLabel.x = x + w / 2;
    cartLabel.y = y + 30;
    this.cartZone.addChild(cartLabel);

    this.cartContainer.addChild(this.cartZone);
  }

  private onResize() {
    if (this.app) {
      this.app.resize();
      this.setupLayout();
    }
  }

  startGame() {
    this.audioService.stopAll();
    this.gameState.set('playing');
    this.playNextRound();
  }

  playNextRound() {
    this.gameState.set('playing');
    this.cartGoods.set([]);

    // Generate Round Data
    const { targetGoods, targetNumber, goods } = this.service.init(8); // 8个商品
    this.targetGoods.set(targetGoods);
    this.targetNumber.set(targetNumber);
    this.goods.set(goods);

    this.renderGoods();
    this.renderCartItems();

    this.playCurrentRoundSound();
  }

  async playCurrentRoundSound() {
    const num = this.targetNumber();
    const goodsItem = this.targetGoods();
    if (goodsItem) {
      await this.playRound(num, goodsItem);
    }
  }

  private renderGoods() {
    // 移除之前的商品,但保留背景
    const children = [...this.goodsContainer.children];
    for (let i = children.length - 1; i >= 0; i--) {
      if (children[i].label !== 'goods-bg') {
        this.goodsContainer.removeChild(children[i]);
      }
    }

    const goods = this.goods();
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    const goodsHeight = height * 0.4; // 更新为40%
    const goodsY = 60; // 与setupLayout中的goodsY保持一致

    // 商品布局 - 4列2行
    const cols = 4;
    const rows = 2;
    const padding = 40;
    const availableWidth = width - padding * 2;
    const availableHeight = goodsHeight - padding;

    const itemWidth = availableWidth / cols;
    const itemHeight = availableHeight / rows;
    const itemSize = Math.min(itemWidth, itemHeight) * 0.6; // 商品尺寸

    goods.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = padding + col * itemWidth + itemWidth / 2;
      const y = goodsY + padding / 2 + row * itemHeight + itemHeight / 2;

      const itemContainer = this.createDraggableItem(item, x, y, itemSize);
      this.goodsContainer.addChild(itemContainer);
    });
  }

  private createDraggableItem(
    item: GoodsItem,
    x: number,
    y: number,
    size: number,
  ): Container {
    const container = new Container();
    container.x = x;
    container.y = y;
    container.label = item.id;

    // Shadow (deeper and more realistic)
    const shadow = new Graphics();
    shadow.circle(0, 6, size / 2);
    shadow.fill({ color: 0x000000, alpha: 0.15 });

    // Background Circle with gradient effect
    const bg = new Graphics();
    bg.circle(0, 0, size / 2);
    bg.fill({ color: 0xffffff, alpha: 1 });
    bg.stroke({ width: 3, color: 0xfb923c }); // Orange border

    // Inner glow effect
    const glow = new Graphics();
    glow.circle(0, 0, size / 2 - 5);
    glow.fill({ color: 0xffedd5, alpha: 0.5 });

    // Emoji Text
    const text = new Text({
      text: item.image,
      style: new TextStyle({
        fontSize: size * 0.6,
        align: 'center',
      }),
    });
    text.anchor.set(0.5);

    container.addChild(shadow);
    container.addChild(bg);
    container.addChild(glow);
    container.addChild(text);

    // Interactivity
    container.eventMode = 'static';
    container.cursor = 'pointer';

    let dragData: any = null;
    let startPosition = { x: 0, y: 0 };
    let dragOffset = { x: 0, y: 0 };
    let isDragging = false;
    let hoverAnimation: any = null;

    // Hover effect
    container.on('pointerover', () => {
      if (!isDragging) {
        container.scale.set(1.1);
        // Add bounce animation
        let bounce = 0;
        hoverAnimation = setInterval(() => {
          bounce += 0.1;
          container.y = y + Math.sin(bounce) * 3;
        }, 16);
      }
    });

    container.on('pointerout', () => {
      if (!isDragging) {
        container.scale.set(1);
        container.y = y;
        if (hoverAnimation) {
          clearInterval(hoverAnimation);
          hoverAnimation = null;
        }
      }
    });

    container.on('pointerdown', (event) => {
      if (hoverAnimation) {
        clearInterval(hoverAnimation);
        hoverAnimation = null;
      }

      dragData = event;
      startPosition = { x: container.x, y: container.y };
      const localPos = container.toLocal(event.global);
      dragOffset = { x: localPos.x, y: localPos.y };

      isDragging = true;
      container.alpha = 0.9;
      container.scale.set(1.3);
      shadow.alpha = 0.3; // Stronger shadow when dragging

      // Move to drag layer to be on top
      const globalPos = container.getGlobalPosition();
      this.dragContainer.addChild(container);
      container.position.set(globalPos.x, globalPos.y);

      this.audioService.play('click');
    });

    container.on('globalpointermove', (event) => {
      if (isDragging) {
        const newPosition = dragData.getLocalPosition(this.dragContainer);
        container.x = newPosition.x;
        container.y = newPosition.y;
      }
    });

    container.on('pointerup', async () => {
      if (!isDragging) return;
      isDragging = false;
      container.alpha = 1;
      container.scale.set(1);
      shadow.alpha = 0.15;
      dragData = null;

      // Check Hit with Cart
      if (this.checkHitCart(container)) {
        // Correct Item?
        if (item.id === this.targetGoods()?.id) {
          // 立即移除拖拽的容器
          this.dragContainer.removeChild(container);

          // 播放音效(不等待)
          this.playRight();

          // 添加到购物车
          this.addToCart(item);

          // 200ms后重新渲染货架区
          setTimeout(() => {
            this.renderGoods();
          }, 200);
        } else {
          // 播放错误音效(不等待)
          this.playError();

          // Animate back
          this.animateBack(container, startPosition, () => {
            this.goodsContainer.addChild(container);
            container.position.set(startPosition.x, startPosition.y);
          });
        }
      } else {
        // Return to start
        this.animateBack(container, startPosition, () => {
          this.goodsContainer.addChild(container);
          container.position.set(startPosition.x, startPosition.y);
        });
      }
    });

    container.on('pointerupoutside', () => {
      if (isDragging) {
        container.emit('pointerup', {} as any);
      }
    });

    return container;
  }

  private checkHitCart(item: Container): boolean {
    const bounds = (this.cartZone as any).hitAreaBounds;
    if (!bounds) return false;

    // Simple AABB collision
    const itemX = item.x;
    const itemY = item.y;

    return (
      itemX > bounds.x &&
      itemX < bounds.x + bounds.width &&
      itemY > bounds.y &&
      itemY < bounds.y + bounds.height
    );
  }

  private animateBack(
    item: Container,
    target: { x: number; y: number },
    onComplete: () => void,
  ) {
    // Simple lerp animation loop or just set it for now.
    // For better UX, use a ticker.
    const startX = item.x;
    const startY = item.y;
    const duration = 200; // ms
    const startTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      item.x = startX + (target.x - startX) * ease;
      item.y = startY + (target.y - startY) * ease;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        onComplete();
      }
    };
    tick();
  }

  private addToCart(item: GoodsItem) {
    this.cartGoods.update((current) => [...current, { ...item }]);
    this.renderCartItems();
  }

  private removeFromCart(index: number) {
    this.cartGoods.update((current) => current.filter((_, i) => i !== index));
    this.renderCartItems();
  }

  private renderCartItems() {
    this.cartContainer.removeChildren();
    this.cartContainer.addChild(this.cartZone); // Keep the background

    const cartItems = this.cartGoods();
    const width = this.app.screen.width;
    const height = this.app.screen.height;
    const cartHeight = height * 0.35;

    const bounds = (this.cartZone as any).hitAreaBounds;
    const padding = 15;
    const itemSize = 55;
    const cols = Math.floor((bounds.width - padding * 2) / (itemSize + 5));

    cartItems.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = bounds.x + padding + col * (itemSize + 5) + itemSize / 2;
      const y = bounds.y + padding + row * (itemSize + 5) + itemSize / 2;

      const container = new Container();
      container.x = x;
      container.y = y;

      // Shadow
      const shadow = new Graphics();
      shadow.circle(0, 4, itemSize / 2 - 2);
      shadow.fill({ color: 0x000000, alpha: 0.1 });

      // Background with border
      const bg = new Graphics();
      bg.circle(0, 0, itemSize / 2 - 2);
      bg.fill({ color: 0xffedd5 });
      bg.stroke({ width: 2, color: 0xfed7aa });

      // Emoji
      const text = new Text({
        text: item.image,
        style: new TextStyle({ fontSize: itemSize * 0.5 }),
      });
      text.anchor.set(0.5);

      container.addChild(shadow);
      container.addChild(bg);
      container.addChild(text);

      // Click to remove with visual feedback
      container.eventMode = 'static';
      container.cursor = 'pointer';

      // Pulse animation to indicate clickable
      let pulsePhase = Math.random() * Math.PI * 2;
      const pulseAnimation = () => {
        pulsePhase += 0.05;
        container.scale.set(1 + Math.sin(pulsePhase) * 0.05);
        requestAnimationFrame(pulseAnimation);
      };
      pulseAnimation();

      container.on('pointerover', () => {
        container.scale.set(1.15);
        bg.tint = 0xfed7aa; // Lighter orange on hover
      });

      container.on('pointerout', () => {
        container.scale.set(1);
        bg.tint = 0xffffff;
      });

      container.on('pointerdown', () => {
        this.removeFromCart(index);
        this.audioService.play('click');
      });

      this.cartContainer.addChild(container);
    });
  }

  // Game Logic Checks
  check(): boolean {
    const cartGoods = this.cartGoods();
    if (cartGoods.length === 0) {
      return false;
    }
    const amount = cartGoods.length; // Assuming amount is 1 per item for now in this mode
    // Note: Original had 'amount' property on item, but drag-drop usually adds 1 by 1.
    // If we support multipliers, we need to handle that.
    // For simplicity in Pixi refactor, let's assume 1 click = 1 item.

    if (amount !== this.targetNumber()) {
      return false;
    }
    return true;
  }

  async checkRound() {
    const result = this.check();

    // 立即更新轮数
    this.currentRound.update((round) => round + 1);

    if (result) {
      // 播放正确音效并等待播放完成
      await this.playRoundRight();
      this.correctRound.update((round) => round + 1);
    } else {
      // 播放错误音效(不等待)
      this.playRoundWrong();
    }

    if (this.currentRound() === this.totalRound()) {
      // 游戏结束
      this.gameState.set('finished');
      return;
    }

    // 正确时已经等待了音效,错误时延迟500ms后进入下一轮
    const delay = result ? 300 : 500;
    setTimeout(() => {
      this.playNextRound();
    }, delay);
  }

  restartGame() {
    this.currentRound.set(0);
    this.correctRound.set(0);
    this.startGame();
  }

  backHome() {
    this.router.navigate(['/home']);
  }

  // Audio Wrappers
  async playWelcome() {
    await this.audioService.preload(
      'welcome1',
      'assets/audio/number-market/number-market-welcome.mp3',
    );
    await this.audioService.preload(
      'welcome2',
      'assets/audio/number-market/number-market-welcome2.mp3',
    );
    await this.audioService.preload(
      'welcome3',
      'assets/audio/number-market/number-market-welcome3.mp3',
    );
    await this.audioService.play('welcome1');
    await this.audioService.play('welcome2');
    await this.audioService.play('welcome3');
  }

  async playRound(num: number, goodsItem: GoodsItem) {
    this.audioService.stopAll();
    await Promise.all([
      this.audioService.preload('buy1', `assets/audio/number-market/buy1.mp3`),
      this.audioService.preload('buy2', `assets/audio/number-market/buy2.mp3`),
      this.audioService.preload(`${num}`, `assets/audio/numbers/${num}.mp3`),
      this.audioService.preload(
        `${goodsItem.name}`,
        `assets/audio/number-market/goods/${goodsItem.id}.mp3`,
      ),
    ]);
    await this.audioService.play('buy1');
    await this.audioService.play(`${num}`);
    await this.audioService.play('buy2');
    await this.audioService.play(`${goodsItem.name}`);
  }

  async playRoundRight() {
    await this.audioService.preload(
      'round-right',
      'assets/audio/number-market/number-market-round-right.mp3',
    );
    await this.audioService.play('round-right');
  }
  async playRoundWrong() {
    await this.audioService.preload(
      'round-wrong',
      'assets/audio/number-market/number-market-round-wrong.mp3',
    );
    await this.audioService.play('round-wrong');
  }
  async playGameOver() {
    await this.audioService.preload('success', 'assets/audio/success.mp3');
    await this.audioService.play('success');
  }
  async playError() {
    await this.audioService.preload('error', 'assets/audio/error.mp3');
    await this.audioService.play('error');
  }
  async playRight() {
    await this.audioService.preload('right', 'assets/audio/right.mp3');
    await this.audioService.play('right');
  }
}
