import { Injectable, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { StorageService } from 'src/app/service/storage.service';
import { AudioService } from 'src/app/service/audio.service';
import { VendingMachinePixiDataService } from './vending-machine-pixi-data.service';

export type VendingTutorialStep =
  | 'idle'
  | 'welcome'
  | 'select_toy'
  | 'show_price'
  | 'insert_coin'
  | 'checkout'
  | 'toy_box'
  | 'limit_hint'
  | 'finished';

export type VendingTutorialEvent =
  | { type: 'select_toy'; toyId: number }
  | { type: 'coin_drop' }
  | { type: 'checkout_success' }
  | { type: 'toy_box_arrived' };

interface TutorialRefs {
  getTargetToyPosition: () => { x: number; y: number } | null;
  getPriceDisplayPosition: () => { x: number; y: number } | null;
  getCoinWalletPosition: () => { x: number; y: number } | null;
  getCoinSlotPosition: () => { x: number; y: number } | null;
  getCheckoutButtonPosition: () => { x: number; y: number } | null;
  getToyBoxPosition: () => { x: number; y: number } | null;
  getToyBoxTextPosition: () => { x: number; y: number } | null;
}

@Injectable()
export class VendingMachinePixiTutorialService {
  private readonly storageKey = 'vending_machine_pixi_tutorial';
  private refs: TutorialRefs | null = null;
  private dataService: VendingMachinePixiDataService | null = null;
  private sub = new Subscription();

  step = signal<VendingTutorialStep>('idle');
  isPlaying = computed(() => this.step() !== 'idle' && this.step() !== 'finished');

  instruction = signal<string>('');
  instructionPosition = signal<'top' | 'bottom'>('top');
  spotlight = signal<{ x: number; y: number; r: number } | null>(null);
  handPosition = signal<{ x: number; y: number } | null>(null);
  handAction = signal<'idle' | 'click' | 'drag'>('idle');

  private animationFrameId: number | null = null;
  private demoStartTime = 0;
  private finishCallback: (() => void) | null = null;
  private stepAdvanceId = 0;
  private coinSoundInFlight = false;

  constructor(
    private storageService: StorageService,
    private audioService: AudioService,
  ) { }

  configure(params: {
    dataService: VendingMachinePixiDataService;
    refs: TutorialRefs;
    onFinish?: () => void;
  }) {
    this.dataService = params.dataService;
    this.refs = params.refs;
    this.finishCallback = params.onFinish ?? null;
  }

  async checkShouldRun(): Promise<boolean> {
    const hasCompleted = await this.storageService.get(this.storageKey);
    return !hasCompleted;
  }

  async resetProgress() {
    await this.storageService.remove(this.storageKey);
  }

  startTutorial() {
    if (!this.dataService || !this.refs) return;
    this.stop();
    this.step.set('welcome');
    this.instruction.set('欢迎来到快乐售卖机！\n跟着提示完成一次购买吧～');
    this.instructionPosition.set('top');

    setTimeout(() => {
      if (this.step() === 'welcome') {
        this.nextStep();
      }
    }, 2000);
  }

  stop() {
    this.clearAutoAdvance();
    this.stopDemo();
    this.sub.unsubscribe();
    this.sub = new Subscription();
    this.step.set('idle');
    this.instruction.set('');
    this.instructionPosition.set('top');
    this.spotlight.set(null);
    this.handPosition.set(null);
    this.handAction.set('idle');
  }

  async finish() {
    this.clearAutoAdvance();
    this.step.set('finished');
    this.spotlight.set(null);
    this.handPosition.set(null);
    this.handAction.set('idle');
    this.stopDemo();
    this.sub.unsubscribe();
    await this.storageService.set(this.storageKey, 'true');
    if (this.finishCallback) {
      this.finishCallback();
    }
  }

  skip() {
    this.finish();
  }

  emit(event: VendingTutorialEvent) {
    if (!this.isPlaying()) return;
    const dataService = this.dataService;
    if (!dataService) return;

    switch (this.step()) {
      case 'select_toy':
        if (event.type === 'select_toy') {
          if (dataService.tutorialTargetToyId !== null && event.toyId === dataService.tutorialTargetToyId) {
            this.nextStep();
          }
        }
        break;
      case 'insert_coin':
        if (event.type === 'coin_drop' && dataService.selectedToy) {
          if (!this.coinSoundInFlight) {
            this.coinSoundInFlight = true;
            this.audioService.play('insert_coin', { interrupt: false }).catch(() => undefined).finally(() => {
              this.coinSoundInFlight = false;
              if (this.step() === 'insert_coin' && dataService.selectedToy) {
                if (dataService.currentBalance >= dataService.selectedToy.price) {
                  this.nextStep();
                }
              }
            });
          }
        }
        break;
      case 'checkout':
        if (event.type === 'checkout_success') {
          this.nextStep();
        }
        break;
      case 'toy_box':
        if (event.type === 'toy_box_arrived') {
          this.nextStep();
        }
        break;
    }
  }

  canSelectToy(toyId: number) {
    if (!this.isPlaying()) return true;
    const targetId = this.dataService?.tutorialTargetToyId;
    return this.step() === 'select_toy' && targetId !== null && toyId === targetId;
  }

  canInsertCoin() {
    if (!this.isPlaying()) return true;
    return this.step() === 'insert_coin';
  }

  canUseCoinValue(value: number) {
    if (!this.isPlaying()) return true;
    if (this.step() !== 'insert_coin') return false;
    const targetPrice = this.dataService?.tutorialTargetPrice ?? 1;
    return value === targetPrice;
  }

  canCheckout() {
    if (!this.isPlaying()) return true;
    return this.step() === 'checkout';
  }

  remindCurrentStep() {
    if (!this.isPlaying()) return;
    this.stopDemo();
    this.showStepHint(this.step(), false);
  }

  private nextStep() {
    this.stopDemo();
    this.clearAutoAdvance();
    const dataService = this.dataService;
    if (!dataService) return;

    switch (this.step()) {
      case 'welcome':
        this.step.set('select_toy');
        this.showStepHint('select_toy');
        break;
      case 'select_toy':
        this.step.set('show_price');
        this.showStepHint('show_price').then(() => {
          const token = this.stepAdvanceId;
          setTimeout(() => {
            if (this.step() === 'show_price' && token === this.stepAdvanceId) {
              this.nextStep();
            }
          }, 600);
        });
        break;
      case 'show_price':
        this.step.set('insert_coin');
        this.showStepHint('insert_coin');
        break;
      case 'insert_coin':
        this.step.set('checkout');
        this.showStepHint('checkout');
        break;
      case 'checkout':
        this.step.set('toy_box');
        this.showStepHint('toy_box');
        break;
      case 'toy_box':
        this.step.set('limit_hint');
        this.showStepHint('limit_hint').then(() => {
          const token = this.stepAdvanceId;
          setTimeout(() => {
            if (this.step() === 'limit_hint' && token === this.stepAdvanceId) {
              this.finish();
            }
          }, 800);
        });
        break;
      case 'limit_hint':
        this.finish();
        break;
    }
  }

  private showStepHint(step: VendingTutorialStep, playAudio = true) {
    const refs = this.refs;
    if (!refs || !this.dataService) return Promise.resolve();
    const targetPrice = this.dataService.tutorialTargetPrice;
    let audioPromise: Promise<void> = Promise.resolve();

    switch (step) {
      case 'select_toy': {
        this.instruction.set('第一步：先选一个你喜欢的玩具！');
        this.instructionPosition.set('top');
        if (playAudio) audioPromise = this.playStepAudio('t1');
        this.startClickDemo(refs.getTargetToyPosition(), 70);
        break;
      }
      case 'show_price': {
        this.instruction.set('看这里！\n玩具的价格会显示出来。');
        this.instructionPosition.set('top');
        if (playAudio) audioPromise = this.playStepAudio('t2');
        this.startClickDemo(refs.getPriceDisplayPosition(), 70);
        break;
      }
      case 'insert_coin': {
        this.instruction.set(`拖动 1 元硬币投进这里，\n让金额达到 ¥${targetPrice}。`);
        this.instructionPosition.set('top');
        if (playAudio) audioPromise = this.playStepAudio('t3');
        this.startDragDemo(refs.getCoinWalletPosition(), refs.getCoinSlotPosition(), 70);
        break;
      }
      case 'checkout': {
        this.instruction.set('金额够了，点一下购买按钮吧！');
        this.instructionPosition.set('top');
        if (playAudio) audioPromise = this.playStepAudio('t4');
        this.startClickDemo(refs.getCheckoutButtonPosition(), 60);
        break;
      }
      case 'toy_box': {
        this.instruction.set('购买成功！\n玩具会自动放进玩具箱里。');
        this.instructionPosition.set('bottom');
        if (playAudio) audioPromise = this.playStepAudio('t5');
        this.startClickDemo(refs.getToyBoxPosition(), 70);
        break;
      }
      case 'limit_hint': {
        this.instruction.set('每轮游戏最多可以买 5 个玩具哦！');
        this.instructionPosition.set('bottom');
        if (playAudio) audioPromise = this.playStepAudio('t6');
        this.startClickDemo(refs.getToyBoxTextPosition(), 60);
        break;
      }
    }
    return audioPromise;
  }

  private playStepAudio(key: string) {
    return this.audioService.play(key).catch(() => undefined);
  }

  private clearAutoAdvance() {
    this.stepAdvanceId += 1;
  }

  private startClickDemo(position: { x: number; y: number } | null, radius: number) {
    if (!position) return;
    this.demoStartTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const cycle = 1500;
      const t = (now - this.demoStartTime) % cycle;
      const progress = t / cycle;

      this.handPosition.set(position);
      this.spotlight.set({ x: position.x, y: position.y, r: radius });

      if (progress > 0.5 && progress < 0.7) {
        this.handAction.set('click');
      } else {
        this.handAction.set('idle');
      }
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private startDragDemo(
    from: { x: number; y: number } | null,
    to: { x: number; y: number } | null,
    radius: number,
  ) {
    if (!from || !to) return;
    this.demoStartTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const cycle = 2000;
      const t = (now - this.demoStartTime) % cycle;
      const progress = t / cycle;

      if (progress < 0.2) {
        this.handAction.set('idle');
        this.handPosition.set(from);
        this.spotlight.set({ x: from.x, y: from.y, r: radius });
      } else if (progress < 0.8) {
        this.handAction.set('drag');
        const dragP = (progress - 0.2) / 0.6;
        const ease = dragP < 0.5 ? 2 * dragP * dragP : -1 + (4 - 2 * dragP) * dragP;
        const curX = from.x + (to.x - from.x) * ease;
        const curY = from.y + (to.y - from.y) * ease;
        this.handPosition.set({ x: curX, y: curY });
        this.spotlight.set({ x: curX, y: curY, r: radius });
      } else {
        this.handAction.set('idle');
        this.handPosition.set(to);
        this.spotlight.set({ x: to.x, y: to.y, r: radius });
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
