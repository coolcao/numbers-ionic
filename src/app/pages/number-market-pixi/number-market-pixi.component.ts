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

    // 参考DOM版本: 左右布局 (手机端上下,平板/电脑端左右)
    // 这里简化为上下布局,货架区在上,购物车区在下
    const GOODS_HEIGHT_RATIO = 0.4; // 商品区占40% (从50%减小)
    const CART_HEIGHT_RATIO = 0.35; // 购物车区占35% (从45%减小)
    const PADDING = 20;
    const GAP = 5; // 货架和购物车之间的间隙

    const goodsHeight = height * GOODS_HEIGHT_RATIO;
    const cartHeight = height * CART_HEIGHT_RATIO;

    // 重新计算位置,让两者更紧凑
    const goodsY = 60; // 货架区从顶部60px开始(为提示框留出足够空间)
    const cartY = goodsY + goodsHeight + GAP; // 购物车紧跟货架区

    // ===== 绘制商品区背景 =====
    const goodsBg = new Graphics();
    goodsBg.roundRect(
      PADDING,
      goodsY,
      width - PADDING * 2,
      goodsHeight - PADDING,
      15,
    );
    goodsBg.fill({ color: 0x2dd4bf, alpha: 0.1 }); // 青色背景
    goodsBg.stroke({ width: 3, color: 0x14b8a6, alpha: 0.3 });
    goodsBg.label = 'goods-bg'; // 标记为背景,不会被清除
    this.goodsContainer.addChild(goodsBg);

    // ===== 绘制购物车区 =====
    this.cartZone = new Graphics();

    const cartBgY = cartY;
    const cartBgHeight = cartHeight - PADDING;

    // 购物车主体
    this.cartZone.roundRect(
      PADDING,
      cartBgY,
      width - PADDING * 2,
      cartBgHeight,
      20,
    );
    this.cartZone.fill({ color: 0x2dd4bf, alpha: 0.1 });
    this.cartZone.stroke({ width: 4, color: 0x14b8a6, alpha: 0.3 });

    // 购物车图标和标签
    const cartIcon = new Text({
      text: '🛒',
      style: new TextStyle({
        fontSize: 32,
      }),
    });
    cartIcon.x = PADDING + 15;
    cartIcon.y = cartBgY + 10;
    this.cartZone.addChild(cartIcon);

    const cartLabel = new Text({
      text: '购物车',
      style: new TextStyle({
        fontSize: 20,
        fill: 0x0f766e,
        fontWeight: 'bold',
      }),
    });
    cartLabel.x = PADDING + 60;
    cartLabel.y = cartBgY + 18;
    this.cartZone.addChild(cartLabel);

    this.cartContainer.addChild(this.cartZone);

    // 存储购物车碰撞区域
    this.cartZone.label = 'cart';
    (this.cartZone as any).hitAreaBounds = {
      x: PADDING,
      y: cartBgY + 50, // 留出标题空间
      width: width - PADDING * 2,
      height: cartBgHeight - 50,
    };

    // 重新渲染商品
    if (this.goods().length > 0) {
      this.renderGoods();
    }
    this.renderCartItems();
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

    // Background Circle
    const bg = new Graphics();
    bg.circle(0, 0, size / 2);
    bg.fill({ color: 0xffffff, alpha: 0.9 });
    bg.stroke({ width: 2, color: 0xcccccc });
    // Shadow
    bg.circle(4, 4, size / 2);
    bg.fill({ color: 0x000000, alpha: 0.1 });

    // Emoji Text
    const text = new Text({
      text: item.image,
      style: new TextStyle({
        fontSize: size * 0.6,
        align: 'center',
      }),
    });
    text.anchor.set(0.5);

    container.addChild(bg); // Add shadow/bg first
    container.addChild(text);

    // Interactivity
    container.eventMode = 'static';
    container.cursor = 'pointer';

    let dragData: any = null;
    let startPosition = { x: 0, y: 0 };
    let dragOffset = { x: 0, y: 0 };
    let isDragging = false;

    container.on('pointerdown', (event) => {
      dragData = event;
      startPosition = { x: container.x, y: container.y };
      const localPos = container.toLocal(event.global);
      dragOffset = { x: localPos.x, y: localPos.y };

      isDragging = true;
      container.alpha = 0.8;
      container.scale.set(1.2);

      // Move to drag layer to be on top
      const globalPos = container.getGlobalPosition();
      this.dragContainer.addChild(container);
      container.position.set(globalPos.x, globalPos.y);

      this.audioService.play('click'); // Optional click sound
    });

    container.on('globalpointermove', (event) => {
      if (isDragging) {
        const newPosition = dragData.getLocalPosition(this.dragContainer);
        container.x = newPosition.x; // - dragOffset.x; // Simplified centering
        container.y = newPosition.y; // - dragOffset.y;
      }
    });

    container.on('pointerup', async () => {
      if (!isDragging) return;
      isDragging = false;
      container.alpha = 1;
      container.scale.set(1);
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
    const cartHeight = height * 0.35; // 更新为35%

    // 使用新的购物车边界
    const bounds = (this.cartZone as any).hitAreaBounds;
    const padding = 15;
    const itemSize = 50; // 购物车内商品尺寸
    const cols = Math.floor((bounds.width - padding * 2) / itemSize);

    cartItems.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = bounds.x + padding + col * itemSize + itemSize / 2;
      const y = bounds.y + padding + row * itemSize + itemSize / 2;

      const container = new Container();
      container.x = x;
      container.y = y;

      const text = new Text({
        text: item.image,
        style: new TextStyle({ fontSize: itemSize * 0.6 }),
      });
      text.anchor.set(0.5);

      container.addChild(text);

      // Click to remove
      container.eventMode = 'static';
      container.cursor = 'pointer';
      container.on('pointerdown', () => {
        this.removeFromCart(index);
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
