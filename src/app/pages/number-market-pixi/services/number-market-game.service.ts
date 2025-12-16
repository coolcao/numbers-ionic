import {
  EffectRef,
  Injectable,
  Injector,
  OnDestroy,
  WritableSignal,
  effect,
  inject,
  signal,
  computed
} from '@angular/core';
import { Router } from '@angular/router';
import { Container } from 'pixi.js';
import { LearnMode } from 'src/app/app.types';
import { AppService } from 'src/app/service/app.service';
import { AppStore } from 'src/app/store/app.store';
import {
  GoodsItem,
  NumberMarketStore,
} from 'src/app/store/number-market.store';
import { NumberMarketService } from '../../number-market/number-market.service';

// Modular Services
import { NumberMarketAudioService } from './number-market-audio.service';
import { NumberMarketPixiEngineService } from './number-market-pixi-engine.service';
import { NumberMarketLayoutService } from './number-market-layout.service';
import { NumberMarketGoodsService } from './number-market-goods.service';
import { NumberMarketCartService } from './number-market-cart.service';

@Injectable({
  providedIn: 'root',
})
export class NumberMarketGameService implements OnDestroy {
  router = inject(Router);
  store = inject(AppStore);
  marketStore = inject(NumberMarketStore);
  service = inject(NumberMarketService);
  appService = inject(AppService);

  // Game Sub-services
  audioService = inject(NumberMarketAudioService);
  pixiEngine = inject(NumberMarketPixiEngineService);
  layoutService = inject(NumberMarketLayoutService);
  goodsService = inject(NumberMarketGoodsService);
  cartService = inject(NumberMarketCartService);

  LearnMode = LearnMode;
  learnMode = this.store.learnMode;

  // Game State
  gameState: WritableSignal<'init' | 'playing' | 'finished'> = signal('init');
  targetNumber = signal(0);
  targetGoods = signal<GoodsItem | null>(null);
  goods = signal<GoodsItem[]>([]);
  cartGoods = signal<GoodsItem[]>([]);
  selectedGoods = signal<GoodsItem | null>(null);

  totalRound = signal(6);
  currentRound = signal(0);
  correctRound = signal(0);

  private effects: EffectRef[] = [];
  private resizeSubscription: any;
  private cartZoneHitArea: any; // Store hit area for checks

  constructor() {
    this.effects.push(
      effect(() => {
        if (this.gameState() === 'finished') {
          this.audioService.playGameOver();
        }
      })
    );

    this.effects.push(
      effect(() => {
        const isDarkMode = this.store.isDarkMode();
        // Redraw static layout on theme change
        if (this.pixiEngine.app) {
          this.drawLayout();
        }
      })
    );
  }

  async init(container: HTMLElement) {
    try {
      await this.appService.lockPortrait();
      await this.pixiEngine.init(container);

      // Subscribe to resize
      this.resizeSubscription = this.pixiEngine.resize$.subscribe(() => {
        this.drawLayout();
        if (this.goods().length > 0) {
          this.renderGoods();
        }
        this.renderCartItems();
      });

      this.audioService.playWelcome();
      this.drawLayout(); // Initial Draw
    } catch (error) {
      console.error('Error in init:', error);
    }
  }

  ngOnDestroy() {
    this.destroy();
  }

  async destroy() {
    if (this.resizeSubscription) {
      this.resizeSubscription.unsubscribe();
    }

    try {
      await this.appService.unlockScreen();
    } catch (e) {
      console.error('Error unlocking screen:', e);
    }

    this.audioService.stopAll();
    this.pixiEngine.destroy();

    this.effects.forEach(eff => eff.destroy());
    this.effects = [];
  }

  private drawLayout() {
    // Clear and redraw static layers
    this.pixiEngine.goodsContainer.removeChildren();
    this.pixiEngine.cartContainer.removeChildren();

    const w = this.pixiEngine.width;
    const h = this.pixiEngine.height;

    // Calculate heights relative to screen
    const goodsHeight = h * 0.4;
    const cartHeight = h * 0.35;
    const goodsY = 80;
    const cartY = goodsY + goodsHeight + 5;
    const padding = 20;

    // Draw Shelf
    this.layoutService.drawShelf(
      this.pixiEngine.goodsContainer,
      padding,
      goodsY,
      w - padding * 2,
      goodsHeight - padding,
      w,
      this.store.isDarkMode()
    );

    // Draw Cart
    const cartZone = this.layoutService.drawCart(
      this.pixiEngine.cartContainer,
      padding,
      cartY,
      w - padding * 2,
      cartHeight - padding,
      w,
      this.store.isDarkMode()
    );

    // Store hit area derived from cartZone
    // Note: LayoutService sets hitAreaBounds on the object
    this.cartZoneHitArea = (cartZone as any).hitAreaBounds;

    // Re-render dynamic items if they exist (to match new layout)
    if (this.cartGoods().length > 0) {
      this.renderCartItems();
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

    const { targetGoods, targetNumber, goods } = this.service.init(8);
    this.targetGoods.set(targetGoods);
    this.targetNumber.set(targetNumber);

    const cleanGoods = goods.map(g => ({
      ...g,
      selected: false,
      amount: 1
    }));
    this.goods.set(cleanGoods);
    this.selectedGoods.set(null);

    this.renderGoods();
    this.renderCartItems();
    this.playCurrentRoundSound();
  }

  async playCurrentRoundSound() {
    const num = this.targetNumber();
    const goodsItem = this.targetGoods();
    if (goodsItem) {
      await this.audioService.playRound(num, goodsItem);
    }
  }

  // --- Rendering & Logic Delegation ---

  private renderGoods() {
    this.goodsService.renderGoods(
      this.goods(),
      this.pixiEngine.goodsContainer,
      this.pixiEngine.dragContainer,
      this.targetGoods()?.id,
      this.pixiEngine.width,
      this.pixiEngine.height,
      this.learnMode(),
      {
        checkHitCart: (itemContainer: Container) => this.checkHitCart(itemContainer),
        onDropToCart: (item) => this.handleDropToCart(item),
        onDropFail: () => this.handleDropFail(),
        onSelect: (item) => this.handleSelectGoods(item),
        playClick: () => this.audioService.playClick()
      }
    );
  }

  private renderCartItems() {
    // Find cartZone in current layout
    const cartZone = this.pixiEngine.cartContainer.getChildByLabel('cart') as any; // Cast as any or Graphics

    this.cartService.renderCartItems(
      this.cartGoods(),
      this.pixiEngine.cartContainer,
      cartZone,
      this.pixiEngine.width,
      this.pixiEngine.height,
      this.learnMode(),
      {
        onRemove: (index) => this.handleRemoveFromCart(index),
        playClick: () => this.audioService.playClick()
      }
    );
  }

  // --- Logic Implementations ---

  private checkHitCart(item: Container): boolean {
    if (!this.cartZoneHitArea) return false;
    const itemX = item.x;
    const itemY = item.y;
    return (
      itemX > this.cartZoneHitArea.x &&
      itemX < this.cartZoneHitArea.x + this.cartZoneHitArea.width &&
      itemY > this.cartZoneHitArea.y &&
      itemY < this.cartZoneHitArea.y + this.cartZoneHitArea.height
    );
  }

  private handleDropToCart(item: GoodsItem) {
    this.audioService.playRight();
    // Add to cart with amount 1 (simple drag is always 1)
    this.cartGoods.update(curr => [...curr, { ...item, amount: 1 }]);

    // Delayed re-render of goods (original logic had this)
    setTimeout(() => {
      this.renderGoods();
    }, 200);
    this.renderCartItems();
  }

  private handleDropFail() {
    this.audioService.playError();
  }

  private handleSelectGoods(item: GoodsItem) {
    const goods = this.goods();
    goods.forEach((g) => {
      g.selected = g.id === item.id;
      g.amount = 1; // Reset amount
    });
    this.goods.set([...goods]);
    this.selectedGoods.set(item);
    this.renderGoods();
  }

  private handleRemoveFromCart(index: number) {
    this.cartGoods.update(curr => curr.filter((_, i) => i !== index));
    this.renderCartItems();
  }

  // --- Public Interactions called by Component ---

  multiTimes(times: number) {
    const currentSelected = this.selectedGoods();
    if (!currentSelected) {
      this.audioService.playError();
      return;
    }

    if (currentSelected.id !== this.targetGoods()?.id) {
      this.audioService.playError();
      return;
    }

    // Add to cart
    this.cartGoods.update(curr => [...curr, { ...currentSelected, amount: times }]);
    this.renderCartItems();
    this.audioService.playRight();
  }

  // Game Logic Checks
  check(): boolean {
    const cartGoods = this.cartGoods();
    if (cartGoods.length === 0) return false;
    const totalAmount = cartGoods.reduce((sum, item) => sum + (item.amount || 1), 0);
    return totalAmount === this.targetNumber();
  }

  async checkRound() {
    const result = this.check();
    this.currentRound.update((round) => round + 1);

    if (result) {
      await this.audioService.playRoundRight();
      this.correctRound.update((round) => round + 1);
    } else {
      await this.audioService.playRoundWrong();
    }

    if (this.currentRound() === this.totalRound()) {
      this.gameState.set('finished');
      return;
    }

    setTimeout(() => {
      this.playNextRound();
    }, 300);
  }

  restartGame() {
    this.currentRound.set(0);
    this.correctRound.set(0);
    this.startGame();
  }

  backHome() {
    this.router.navigate(['/home']);
  }

  // Helper for button styles (copied from original)
  getLeftButtonsStyle() {
    if (!this.pixiEngine.app) return '';
    const width = this.pixiEngine.width;
    const height = this.pixiEngine.height;
    const goodsHeight = height * 0.4;
    const goodsY = 80;
    const cartY = goodsY + goodsHeight + 5;
    const PADDING = 20;
    const leftX = PADDING + 10;
    const topY = cartY + 5;
    return `left: ${leftX}px; top: ${topY}px; z-index: 20;`;
  }

  getRightButtonsStyle() {
    if (!this.pixiEngine.app) return '';
    const width = this.pixiEngine.width;
    const height = this.pixiEngine.height;
    const goodsHeight = height * 0.4;
    const goodsY = 80;
    const cartY = goodsY + goodsHeight + 5;
    const PADDING = 20;
    const rightX = width - PADDING - 90;
    const topY = cartY + 5;
    return `left: ${rightX}px; top: ${topY}px; z-index: 20;`;
  }
}
