import { Injectable, computed, inject, signal, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { LearnMode } from 'src/app/app.types';
import { NumberMarketGameService } from './number-market-game.service';
import { StorageService } from 'src/app/service/storage.service';

export type TutorialStep =
  | 'idle'
  | 'welcome'
  | 'find_item'
  | 'action_demo'
  | 'multiplier_hint' // Specific for Advanced Mode
  | 'checkout_hint'
  | 'finished';

@Injectable({
  providedIn: 'root'
})
export class NumberMarketTutorialService implements OnDestroy {
  private gameService = inject(NumberMarketGameService);
  private storageService = inject(StorageService);
  private sub = new Subscription();

  // State
  step = signal<TutorialStep>('idle');
  isPlaying = computed(() => this.step() !== 'idle' && this.step() !== 'finished');

  // UI Signals
  handPosition = signal<{ x: number, y: number } | null>(null);
  handAction = signal<'idle' | 'click' | 'drag'>('idle');
  spotlight = signal<{ x: number, y: number, r: number } | null>(null);
  instruction = signal<string>('');

  // Internal animation loop
  private animationFrameId: number | null = null;
  private demoStartTime: number = 0;

  constructor() { }

  ngOnDestroy() {
    this.stop();
  }

  stop() {
    this.stopDemo();
    this.sub.unsubscribe();
    this.sub = new Subscription();

    this.step.set('idle');
    this.handPosition.set(null);
    this.handAction.set('idle');
    this.spotlight.set(null);
    this.instruction.set('');
  }

  async checkShouldRun(): Promise<boolean> {
    const mode = this.gameService.learnMode();
    const key = mode === LearnMode.Advanced
      ? 'number_market_pixi_tutorial_advanced'
      : 'number_market_tutorial_starter';
    const hasCompleted = await this.storageService.get(key);
    return !hasCompleted;
  }

  startTutorial() {
    this.stop();
    this.setupEventListeners();
    
    // Lock interactions
    this.gameService.dragLocked.set(true);
    this.gameService.checkoutLocked.set(true);
    // Enable Strict Tutorial Checks
    this.gameService.tutorialMode.set(true);

    this.step.set('welcome');
    this.instruction.set('欢迎来到数字小超市！\n让我们一起来买东西吧！');

    setTimeout(() => {
      if (this.step() === 'welcome') {
        this.nextStep();
      }
    }, 2500);
  }

  private setupEventListeners() {
    this.sub.add(
      this.gameService.event$.subscribe(event => {
        if (!this.isPlaying()) return;

        switch (this.step()) {
          case 'action_demo':
            if (this.gameService.learnMode() === LearnMode.Advanced) {
              // Advanced: Waiting for selection
              if (event.type === 'select_goods') {
                this.nextStep(); // Go to multiplier hint
              }
            } else {
              // Starter: Waiting for drop
              if (event.type === 'drop_success') {
                this.nextStep(); // Go to checkout hint
              }
            }
            break;

          case 'multiplier_hint':
            // Advanced only: Waiting for multiplier click
            if (event.type === 'multi_times') {
              this.nextStep();
            }
            break;

          case 'checkout_hint':
            // Waiting for checkout
            if (event.type === 'checkout') {
              this.finish();
            }
            break;
        }
      })
    );
  }

  nextStep() {
    this.stopDemo();

    switch (this.step()) {
      case 'welcome':
        this.step.set('find_item');
        this.showFindItem();
        break;
      case 'find_item':
        this.step.set('action_demo');
        this.gameService.dragLocked.set(false); // Unlock drag/select
        this.showActionDemo();
        break;
      case 'action_demo':
        if (this.gameService.learnMode() === LearnMode.Advanced) {
          this.step.set('multiplier_hint');
          this.showMultiplierHint();
        } else {
          this.step.set('checkout_hint');
          this.gameService.checkoutLocked.set(false); // Unlock checkout
          this.showCheckoutHint();
        }
        break;
      case 'multiplier_hint':
        this.step.set('checkout_hint');
        this.gameService.checkoutLocked.set(false); // Unlock checkout
        this.showCheckoutHint();
        break;
      case 'checkout_hint':
        this.finish();
        break;
    }
  }

  private showFindItem() {
    const target = this.gameService.targetGoods();
    if (!target) return;

    this.updateItemSpotlight(target.id);
    const count = this.gameService.targetNumber();
    this.instruction.set(`看上面！\n我们需要买 ${count} 个 ${target.image}`);

    // Auto advance after reading
    setTimeout(() => {
      if (this.step() === 'find_item') {
        this.nextStep();
      }
    }, 2500);
  }

  private showActionDemo() {
    const mode = this.gameService.learnMode();
    const target = this.gameService.targetGoods();
    if (!target) return;

    if (mode === LearnMode.Advanced) {
      this.instruction.set('第一步：\n点击商品选中它！');
      this.startClickDemo(target.id); // Loop until user clicks
    } else {
      this.instruction.set('按住商品，\n把它拖进购物车里！');
      this.startDragDemo(target.id); // Loop until user drops
    }
  }

  private showMultiplierHint() {
    const mode = this.gameService.learnMode();
    const target = this.gameService.targetGoods();
    if (!target) return;

    this.instruction.set('第二步：\n点击按钮批量购买！');
    // Show click on the first button (x5)
    this.startClickButtonDemo(0);
  }

  private showCheckoutHint() {
    this.spotlight.set(null);
    this.handPosition.set(null);
    this.handAction.set('idle');

    this.instruction.set('买完所有东西后，\n记得点击“结账”按钮哦！');

    // Position hand over estimated Checkout button (Bottom center)
    // Checkout button is flex justified center at bottom.
    // Approximate: center width, height - 60px
    const w = this.gameService.pixiEngine.width;
    const h = this.gameService.pixiEngine.height;

    // Animate hand clicking checkout
    this.startGenericClickDemo({ x: w / 2, y: h - 50 });
  }

  async finish() {
    this.step.set('finished');
    this.spotlight.set(null);
    this.handPosition.set(null);
    this.stopDemo();
    this.sub.unsubscribe();
    
    // Unlock all
    this.gameService.dragLocked.set(false);
    this.gameService.checkoutLocked.set(false);
    this.gameService.tutorialMode.set(false);

    const mode = this.gameService.learnMode();
    const key = mode === LearnMode.Advanced
      ? 'number_market_pixi_tutorial_advanced'
      : 'number_market_tutorial_starter';

    await this.storageService.set(key, 'true');
  }

  skip() {
    this.finish();
  }

  // --- Animation Logic ---

  private updateItemSpotlight(id: string) {
    const pos = this.gameService.getGoodsPosition(id);
    if (pos) {
      this.spotlight.set({ x: pos.x, y: pos.y, r: 60 });
    }
  }

  private startDragDemo(targetId: string) {
    this.demoStartTime = Date.now();
    const animate = () => {
      const itemPos = this.gameService.getGoodsPosition(targetId);
      const cartPos = this.gameService.getCartPosition();

      if (itemPos && cartPos) {
        const now = Date.now();
        const cycle = 2000; // 2s per drag cycle
        const t = (now - this.demoStartTime) % cycle;
        const progress = t / cycle;

        if (progress < 0.2) {
          // Move to item
          this.handAction.set('idle');
          this.handPosition.set(itemPos);
        } else if (progress < 0.8) {
          // Drag
          this.handAction.set('drag');
          const dragP = (progress - 0.2) / 0.6;
          const ease = dragP < .5 ? 2 * dragP * dragP : -1 + (4 - 2 * dragP) * dragP;
          const curX = itemPos.x + (cartPos.x - itemPos.x) * ease;
          const curY = itemPos.y + (cartPos.y - itemPos.y) * ease;
          this.handPosition.set({ x: curX, y: curY });
          this.spotlight.set({ x: curX, y: curY, r: 60 });
        } else {
          // Reset
          this.handAction.set('idle');
          this.handPosition.set(cartPos);
        }
      }
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private startClickDemo(targetId: string) {
    this.demoStartTime = Date.now();
    const animate = () => {
      const itemPos = this.gameService.getGoodsPosition(targetId);
      if (itemPos) {
        const now = Date.now();
        const cycle = 1500;
        const t = (now - this.demoStartTime) % cycle;
        const progress = t / cycle;

        this.handPosition.set(itemPos);
        this.spotlight.set({ x: itemPos.x, y: itemPos.y, r: 60 });

        if (progress > 0.5 && progress < 0.7) {
          this.handAction.set('click');
        } else {
          this.handAction.set('idle');
        }
      }
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private startClickButtonDemo(index: number) {
    this.demoStartTime = Date.now();
    const animate = () => {
      const pos = this.gameService.getLeftButtonPosition(index);
      if (pos) {
        const now = Date.now();
        const cycle = 1500;
        const t = (now - this.demoStartTime) % cycle;
        const progress = t / cycle;

        this.handPosition.set(pos);
        this.spotlight.set({ x: pos.x, y: pos.y, r: 40 }); // Smaller spotlight for button

        if (progress > 0.5 && progress < 0.7) {
          this.handAction.set('click');
        } else {
          this.handAction.set('idle');
        }
      }
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private startGenericClickDemo(pos: { x: number, y: number }) {
    this.demoStartTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const cycle = 1500;
      const t = (now - this.demoStartTime) % cycle;
      const progress = t / cycle;

      this.handPosition.set(pos);
      this.spotlight.set({ x: pos.x, y: pos.y, r: 60 });

      if (progress > 0.5 && progress < 0.7) {
        this.handAction.set('click');
      } else {
        this.handAction.set('idle');
      }
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private stopDemo() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
