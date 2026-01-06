import { Injectable, computed, inject, signal, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { LearnMode } from 'src/app/app.types';
import { NumberTrainGameService } from './number-train-game.service';
import { NumberTrainTrainService } from './number-train-train.service';
import { NumberTrainPixiEngineService } from './number-train-pixi-engine.service';
import { StorageService } from 'src/app/service/storage.service';

export type TutorialStep =
  | 'idle'
  | 'welcome'
  | 'find_target'
  | 'drag_demo'
  | 'finished';

@Injectable({
  providedIn: 'root'
})
export class NumberTrainTutorialService implements OnDestroy {
  private gameService = inject(NumberTrainGameService);
  private trainService = inject(NumberTrainTrainService);
  private engineService = inject(NumberTrainPixiEngineService);
  private storageService = inject(StorageService);
  private sub = new Subscription();

  step = signal<TutorialStep>('idle');
  isPlaying = computed(() => this.step() !== 'idle' && this.step() !== 'finished');

  handPosition = signal<{ x: number, y: number } | null>(null);
  handAction = signal<'idle' | 'click' | 'drag'>('idle');
  spotlight = signal<{ x: number, y: number, r: number } | null>(null);
  instruction = signal<string>('');

  private animationFrameId: number | null = null;
  private demoStartTime: number = 0;

  constructor() { }

  ngOnDestroy() {
    this.stopDemo();
    this.sub.unsubscribe();
  }

  async checkShouldRun(): Promise<boolean> {
    // 数字小火车游戏交互模式都是一样的，所以这里不区分入门模式还是进阶模式
    const key = 'number_train_tutorial';

    // const mode = this.gameService.learnMode();
    // const key = mode === LearnMode.Advanced
    //   ? 'number_train_tutorial_advanced'
    //   : 'number_train_tutorial_starter';
    const hasCompleted = await this.storageService.get(key);
    return !hasCompleted;
  }

  startTutorial() {
    this.setupEventListeners();
    this.step.set('welcome');
    this.instruction.set('欢迎来到数字小火车！\n把火车车厢排好顺序吧！');

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
          case 'find_target':
            if (event.type === 'next_round') {
              // Round regenerated (e.g., after error). Refresh spotlight and instruction.
              this.showFindTarget();
            }
            break;
          case 'drag_demo':
            if (event.type === 'success') {
              this.finish();
            } else if (event.type === 'next_round') {
              this.showDragDemo();
            } else if (event.type === 'tutorial_drag' && event.payload) {
              // Follow drag position and hide hand during actual dragging
              this.spotlight.set({ x: event.payload.x, y: event.payload.y, r: 110 });
              if (event.payload.hideHand) {
                this.handPosition.set(null);
              }
            } else if (event.type === 'tutorial_drag_end') {
              // Restore hand after dragging ends (optional)
              this.handAction.set('idle');
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
        this.step.set('find_target');
        this.showFindTarget();
        break;
      case 'find_target':
        this.step.set('drag_demo');
        this.showDragDemo();
        break;
      case 'drag_demo':
        this.finish();
        break;
    }
  }

  private showFindTarget() {
    const targetTrains = this.gameService.topTrains();
    if (!targetTrains || targetTrains.length === 0) return;

    const firstTarget = targetTrains[0];
    this.updateTrainSpotlight(firstTarget.id);
    this.instruction.set(`把编号 ${firstTarget.number} 的车厢\n拖到下面正确的位置`);

    setTimeout(() => {
      if (this.step() === 'find_target') {
        this.nextStep();
      }
    }, 2500);
  }

  private showDragDemo() {
    const targetTrains = this.gameService.topTrains();
    if (!targetTrains || targetTrains.length === 0) return;

    const firstTarget = targetTrains[0];
    this.instruction.set(`按住车厢拖到正确位置！`);
    this.startDragDemo(firstTarget.id);
  }

  async finish() {
    this.step.set('finished');
    this.spotlight.set(null);
    this.handPosition.set(null);
    this.stopDemo();
    this.sub.unsubscribe();

    // 不区分模式，统一存一个完成标记，避免重复展示
    await this.storageService.set('number_train_tutorial', 'true');
  }

  skip() {
    this.finish();
  }

  private updateTrainSpotlight(id: string) {
    const pos = this.getTrainPosition(id);
    if (pos) {
      this.spotlight.set({ x: pos.x, y: pos.y, r: 110 });
    }
  }

  private startDragDemo(targetId: string) {
    this.demoStartTime = Date.now();
    const animate = () => {
      const trainPos = this.getTrainPosition(targetId);
      const bottomPos = this.getBottomZonePosition();

      if (trainPos && bottomPos) {
        const now = Date.now();
        const cycle = 3000;
        const t = (now - this.demoStartTime) % cycle;
        const progress = t / cycle;

        if (progress < 0.15) {
          this.handAction.set('idle');
          this.handPosition.set(trainPos);
        } else if (progress < 0.85) {
          this.handAction.set('drag');
          const dragP = (progress - 0.15) / 0.7;
          const ease = dragP < 0.5 ? 2 * dragP * dragP : -1 + (4 - 2 * dragP) * dragP;
          const curX = trainPos.x + (bottomPos.x - trainPos.x) * ease;
          const curY = trainPos.y + (bottomPos.y - trainPos.y) * ease;
          this.handPosition.set({ x: curX, y: curY });
          this.spotlight.set({ x: curX, y: curY, r: 110 });
        } else {
          this.handAction.set('idle');
          this.handPosition.set(bottomPos);
        }
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

  private getTrainPosition(id: string): { x: number, y: number } | null {
    if (this.trainService.topZone) {
      const topZone = this.trainService.topZone;
      const child = topZone.children.find((c: any) => c.label === id);
      if (child) {
        const globalPos = child.getGlobalPosition();
        return { x: globalPos.x, y: globalPos.y };
      }
    }
    return null;
  }

  private getBottomZonePosition(): { x: number, y: number } | null {
    if (this.trainService.bottomZone) {
      const bottomZone = this.trainService.bottomZone;
      const engineWidth = this.engineService.width || 800;
      return { x: engineWidth / 2, y: bottomZone.y };
    }
    return null;
  }
}
