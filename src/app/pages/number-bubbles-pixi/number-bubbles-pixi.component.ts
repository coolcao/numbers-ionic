import {
  AfterContentInit,
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { interval, Subscription, timer, firstValueFrom } from 'rxjs';
import { NumberBubblesAudioService } from '../number-bubbles/number-bubbles.audio.service';
import { NumberBubblesStore } from '../../store/number-bubbles.store';
import { AppService } from 'src/app/service/app.service';
import { AppStore } from 'src/app/store/app.store';
import { LearnMode } from 'src/app/app.types';
// Pixi types are handled inside services; no direct dependency here.

import { NumberBubblesPixiEngineService } from './services/number-bubbles-pixi-engine.service';
import { NumberBubblesBubbleService } from './services/number-bubbles-bubble.service';
import { Bubble } from './services/number-bubbles-pixi.types';
import { StorageService } from 'src/app/service/storage.service';

@Component({
  selector: 'app-number-bubbles-pixi',
  standalone: false,
  templateUrl: './number-bubbles-pixi.component.html',
  styleUrl: './number-bubbles-pixi.component.css',
})
export class NumberBubblesPixiComponent
  implements OnInit, AfterViewInit, AfterContentInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly appService = inject(AppService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly numberBubblesStore = inject(NumberBubblesStore);
  private readonly numberBubblesAudioService = inject(
    NumberBubblesAudioService,
  );
  private readonly appStore = inject(AppStore);
  private readonly engine = inject(NumberBubblesPixiEngineService);
  private readonly bubbleSrv = inject(NumberBubblesBubbleService);
  private readonly storageService = inject(StorageService);
  private bubbleSubscription?: Subscription;

  numbers = this.numberBubblesStore.numbers;

  targetNumberCount = signal(2);
  targetNumbers = signal<number[]>([]);
  gameDuration = this.numberBubblesStore.gameDuration;
  isTimeUp = signal(false);
  gameStatus = signal<string>('initial');
  bubbleInterval = signal(900);
  bubbleSizeMin = signal(90);
  bubbleSizeMax = signal(110);
  bubbleDurationStart = signal(8);
  bubbleDurationEnd = signal(20);

  isTutorial = signal(false);

  targetBubbleCount = signal(0);
  eliminatedBubbleCount = signal(0);
  accuracy = computed(() => {
    const total = this.targetBubbleCount();
    const correct = this.eliminatedBubbleCount();
    if (total === 0) return 0;
    return Math.round((correct / total) * 100);
  });
  comment = computed(() => {
    if (this.accuracy() === 100) return '🎉 全对！你是数字小天才！🎉';
    if (this.accuracy() >= 90) return '🌟 太棒了！几乎全对！🌟';
    if (this.accuracy() >= 80) return '👍 真厉害～加油～ 👍';
    if (this.accuracy() >= 60) return '💪 不错哦，再试试看！💪';
    return '🤗 再试一次会更好～ 🤗';
  });
  subComment = computed(() => {
    if (this.accuracy() === 100) return '所有数字都听对啦，太完美了！';
    if (this.accuracy() >= 80) return '马上就要成为数字小达人了！';
    if (this.accuracy() >= 60) return '已经超过很多小朋友啦！';
    return '每个小错误都是进步的机会哦！';
  });

  @ViewChild('gameContainer', { static: false }) gameContainer!: ElementRef;
  colors = [
    '#FF5733',
    '#FFC300',
    '#DAF7A6',
    '#C70039',
    '#900C3F',
    '#581845',
    '#355C7D',
    '#6C5B7B',
    '#C06C84',
    '#F67280',
  ];
  bubbles = signal<Bubble[]>([]);
  playTargets = signal(false);
  hasTargetBubble = computed(() => {
    return this.bubbles().some((bubble: Bubble) =>
      this.targetNumbers().includes(bubble.number),
    );
  });

  constructor() {
    effect(() => {
      if (this.isTimeUp() && !this.hasTargetBubble()) {
        this.numberBubblesAudioService.playSuccess();
        this.gameStatus.set('finished');
        this.bubbleSubscription?.unsubscribe();
        this.stopGameLoop();
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.route.queryParams.subscribe((params) => {
      if (params['mode']) {
        const mode =
          params['mode'] === 'advanced'
            ? LearnMode.Advanced
            : LearnMode.Starter;
        this.appStore.setLearnMode(mode);
      }
    });

    await this.appService.lockPortrait();
    this.updateBubbleSize();
    await this.numberBubblesAudioService.playWelcomeAndRules();
    this.generateTargetNumbers();
  }

  ngAfterViewInit() { }
  ngAfterContentInit() { }

  async ngOnDestroy(): Promise<void> {
    await this.appService.unlockScreen();
    if (this.bubbleSubscription) this.bubbleSubscription.unsubscribe();
    this.destroyPixiApp();
    this.numberBubblesAudioService.stopAll();
  }

  private getResponsiveBubbleSize(): { min: number; max: number } {
    const width = window.innerWidth;
    if (width < 768) return { min: 60, max: 80 };
    else if (width < 1024) return { min: 75, max: 95 };
    else return { min: 90, max: 110 };
  }
  private updateBubbleSize() {
    const { min, max } = this.getResponsiveBubbleSize();
    this.bubbleSizeMin.set(min);
    this.bubbleSizeMax.set(max);
  }

  private async waitForGameContainer(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 10;
    while (!this.gameContainer && attempts < maxAttempts) {
      this.cdr.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 50));
      attempts++;
    }
  }

  private async initPixiApp(): Promise<boolean> {
    await this.waitForGameContainer();
    if (!this.gameContainer) return false;

    if (this.engine.app) {
      // Ensure canvas is attached to current container
      if (this.engine.app.canvas.parentElement !== this.gameContainer.nativeElement) {
        this.gameContainer.nativeElement.appendChild(this.engine.app.canvas);
      }
      return true;
    }

    await this.engine.init(
      this.gameContainer.nativeElement,
      this.gameLoop.bind(this),
      this.onCanvasClick.bind(this),
      this.handleResize.bind(this),
    );
    // update size on init
    this.updateBubbleSize();
    return true;
  }

  private handleResize() {
    // engine handles resize and we update bubble sizes
    this.updateBubbleSize();
  }

  private startGameLoop() {
    if (!this.engine.app) return;
    this.engine.startLoop(this.gameLoop.bind(this));
  }
  private stopGameLoop() {
    if (!this.engine.app) return;
    this.engine.stopLoop(this.gameLoop.bind(this));
  }

  private gameLoop(ticker: any) {
    if (
      (this.gameStatus() === 'playing' || this.gameStatus() === 'tutorial') &&
      !this.playTargets()
    ) {
      if (this.engine.app) {
        // Only show overlay in tutorial mode
        const overlay =
          this.gameStatus() === 'tutorial'
            ? this.engine.tutorialOverlay
            : undefined;

        const updated = this.bubbleSrv.updateBubbles(
          this.engine.app,
          this.bubbles(),
          overlay,
          this.engine.uiContainer,
        );
        this.bubbles.set(updated);
      }
    }
  }

  backHome() {
    this.router.navigate(['home']);
  }

  restartGame() {
    this.stopGameLoop();
    this.gameStatus.set('initial');
    this.isTimeUp.set(false);
    this.targetBubbleCount.set(0);
    this.eliminatedBubbleCount.set(0);
    this.bubbles.set([]);

    this.consecutiveTargetCount = 0;
    this.consecutiveNonTargetCount = 0;
    this.lastGeneratedWasTarget = false;

    if (this.bubbleSubscription) {
      this.bubbleSubscription.unsubscribe();
      this.bubbleSubscription = undefined;
    }

    this.clearPixiStage();
    if (this.engine.app) {
      this.engine.destroy();
    }
    setTimeout(() => {
      this.startGame();
    }, 100);
  }

  private clearPixiStage() {
    if (this.engine.bubbleContainer)
      this.engine.bubbleContainer.removeChildren();
    if (this.engine.particleContainer)
      this.engine.particleContainer.removeChildren();
    this.engine.tutorialOverlay?.clear();
    this.engine.uiContainer?.removeChildren();
    this.bubbles().forEach((b) => {
      if (b.container && b.container.parent)
        b.container.parent.removeChild(b.container);
    });
  }

  private destroyPixiApp() {
    this.stopGameLoop();
    this.engine.destroy();
  }

  async startGame() {
    const tutorialDone = await this.storageService.get(
      'number_bubbles_tutorial_done',
    );
    if (!tutorialDone) {
      await this.startTutorial();
      return;
    }

    this.isTutorial.set(false);
    this.gameStatus.set('playing');
    this.generateTargetNumbers();
    this.consecutiveTargetCount = 0;
    this.consecutiveNonTargetCount = 0;
    this.lastGeneratedWasTarget = false;

    await new Promise((resolve) => {
      setTimeout(async () => {
        if (!this.engine.app || !this.engine.app.canvas) {
          await this.initPixiApp();
        }
        resolve(void 0);
      }, 100);
    });

    // Ensure overlay is cleared when starting game
    this.engine.tutorialOverlay?.clear();
    this.engine.uiContainer?.removeChildren();

    await this.playTargetNumbersAudio();
    this.startGameTimer();
    this.startBubbleGeneration();
  }

  async startTutorial() {
    this.isTutorial.set(true);
    this.gameStatus.set('tutorial');
    this.targetNumbers.set([1]);

    await new Promise((resolve) => {
      setTimeout(async () => {
        if (!this.engine.app || !this.engine.app.canvas) {
          await this.initPixiApp();
        }
        resolve(void 0);
      }, 100);
    });

    // In tutorial, we just start generation. No timer.
    this.startBubbleGeneration();
  }

  async completeTutorial() {
    await this.storageService.set('number_bubbles_tutorial_done', 'true');
    this.numberBubblesAudioService.playSuccess();

    // Stop game loop but keep the last frame visible for the modal background
    this.stopGameLoop();
    if (this.bubbleSubscription) this.bubbleSubscription.unsubscribe();

    this.gameStatus.set('tutorial_success');
  }

  startRealGame() {
    this.targetBubbleCount.set(0);
    this.eliminatedBubbleCount.set(0);
    this.bubbles.set([]); // Clear bubbles array too
    this.clearPixiStage();
    // Ensure loop is running!
    this.startGameLoop();
    this.startGame();
  }

  private async playTargetNumbersAudio() {
    this.playTargets.set(true);
    await this.numberBubblesAudioService.playTargetNumbersAudio(
      this.targetNumbers(),
    );
    this.playTargets.set(false);
  }

  private generateTargetNumbers() {
    const targetNumbers: number[] = [];
    while (targetNumbers.length < this.targetNumberCount()) {
      const randomIndex = Math.floor(Math.random() * this.numbers().length);
      const randomNumber = this.numbers()[randomIndex];
      if (!targetNumbers.includes(randomNumber)) {
        targetNumbers.push(randomNumber);
      }
    }
    this.targetNumbers.set([...targetNumbers]);
  }

  // generation sequence state
  private consecutiveTargetCount = 0;
  private consecutiveNonTargetCount = 0;
  private lastGeneratedWasTarget = false;

  startBubbleGeneration() {
    this.bubbleSubscription = interval(this.bubbleInterval()).subscribe(() => {
      if (this.gameStatus() === 'tutorial') {
        if (this.bubbles().length >= 3) return;

        const hasTarget = this.bubbles().some((b) => b.number === 1);
        let number: number;
        let isHighlight = false;

        if (!hasTarget) {
          number = 1;
          isHighlight = true;
        } else {
          // 40% chance to spawn distractor if target exists
          if (Math.random() > 0.4) return;
          const nonTargetNumbers = this.numbers().filter((n) => n !== 1);
          const idx = Math.floor(Math.random() * nonTargetNumbers.length);
          number = nonTargetNumbers[idx];
        }

        if (!this.engine.app) return;

        let newBubble = this.bubbleSrv.generateBubbleWithSpacing(
          this.engine.app,
          this.bubbles(),
          Date.now(),
          number,
          this.bubbleSizeMin(),
          this.bubbleSizeMax(),
          this.bubbleDurationStart(),
          this.bubbleDurationEnd(),
          this.colors,
        );

        if (!newBubble) return;

        if (newBubble) {
          newBubble.isHighlight = isHighlight; // Set highlight
          this.bubbles.update((bs) => [...bs, newBubble]);
          if (this.engine.bubbleContainer) {
            this.bubbleSrv.createBubbleSprite(
              this.engine.bubbleContainer,
              newBubble,
            );
          }
        }
        return;
      }

      if (this.gameStatus() === 'playing') {
        if (this.bubbles().length >= 20) {
          return;
        }
        let isTarget: boolean;
        let number: number;
        if (this.consecutiveTargetCount >= 2) {
          isTarget = false;
          this.consecutiveTargetCount = 0;
          this.consecutiveNonTargetCount++;
        } else if (this.consecutiveNonTargetCount >= 3) {
          isTarget = true;
          this.consecutiveNonTargetCount = 0;
          this.consecutiveTargetCount++;
        } else {
          if (this.lastGeneratedWasTarget) {
            isTarget = Math.random() < 0.4;
          } else {
            isTarget = Math.random() < 0.7;
          }
          if (isTarget) {
            this.consecutiveTargetCount++;
            this.consecutiveNonTargetCount = 0;
          } else {
            this.consecutiveNonTargetCount++;
            this.consecutiveTargetCount = 0;
          }
        }
        this.lastGeneratedWasTarget = isTarget;

        if (isTarget && this.targetNumbers().length > 0) {
          const targetIdx = Math.floor(
            Math.random() * this.targetNumbers().length,
          );
          number = this.targetNumbers()[targetIdx];
        } else {
          const nonTargetNumbers = this.numbers().filter(
            (n) => !this.targetNumbers().includes(n),
          );
          const nonTargetIdx = Math.floor(
            Math.random() * nonTargetNumbers.length,
          );
          number = nonTargetNumbers[nonTargetIdx];
          this.lastGeneratedWasTarget = false;
        }

        let newBubble =
          this.engine.app &&
          this.bubbleSrv.generateBubbleWithSpacing(
            this.engine.app,
            this.bubbles(),
            Date.now(),
            number,
            this.bubbleSizeMin(),
            this.bubbleSizeMax(),
            this.bubbleDurationStart(),
            this.bubbleDurationEnd(),
            this.colors,
          );
        if (!newBubble) {
          newBubble = this.bubbleSrv.generateBubble(
            this.engine.app,
            Date.now(),
            number,
            this.bubbleSizeMin(),
            this.bubbleSizeMax(),
            this.bubbleDurationStart(),
            this.bubbleDurationEnd(),
            this.colors,
          );
        }

        if (newBubble) {
          if (this.targetNumbers().includes(number)) {
            if (this.targetBubbleCount() < 18) {
              this.targetBubbleCount.update((c) => c + 1);
            }
          }
          this.bubbles.update((bs) => [...bs, newBubble!]);
          if (this.engine.bubbleContainer) {
            this.bubbleSrv.createBubbleSprite(
              this.engine.bubbleContainer,
              newBubble,
            );
          }
        }
      }
    });
  }

  startGameTimer() {
    timer(this.gameDuration() * 1000).subscribe(() => {
      this.isTimeUp.set(true);
      this.bubbleSubscription?.unsubscribe();
    });
  }

  onCanvasClick(event: MouseEvent) {
    if (!this.engine.app) return;
    const topMostBubble = this.bubbleSrv.onCanvasClick(
      this.engine.app,
      this.bubbles(),
      event,
    );
    if (topMostBubble) this.onBubbleClick(topMostBubble);
  }

  private async onBubbleClick(bubble: Bubble) {
    if (this.gameStatus() === 'tutorial') {
      if (bubble.number === 1) {
        // Correct tutorial click
        this.bubbleSubscription?.unsubscribe(); // Stop generation immediately
        this.eliminatedBubbleCount.update((count) => count + 1);
        if (this.engine.particleContainer) {
          this.bubbles.set(
            this.bubbleSrv.createExplosion(
              this.engine.particleContainer,
              bubble,
              this.bubbles(),
            ),
          );
        }
        this.numberBubblesAudioService.playExplode();

        // Wait for explosion animation
        await new Promise((resolve) => setTimeout(resolve, 800));

        await this.completeTutorial();
      } else {
        // Wrong tutorial click
        this.bubbles.set(this.bubbleSrv.shakeBubble(this.bubbles(), bubble));
        setTimeout(() => {
          this.bubbles.set(this.bubbleSrv.clearShake(this.bubbles(), bubble));
        }, 500);
        this.numberBubblesAudioService.playWrong();
      }
      return;
    }

    if (!this.targetNumbers().includes(bubble.number)) {
      this.bubbles.set(this.bubbleSrv.shakeBubble(this.bubbles(), bubble));
      setTimeout(() => {
        this.bubbles.set(this.bubbleSrv.clearShake(this.bubbles(), bubble));
      }, 500);
      this.numberBubblesAudioService.playWrong();
      return;
    }
    this.eliminatedBubbleCount.update((count) => count + 1);
    if (this.engine.particleContainer) {
      this.bubbles.set(
        this.bubbleSrv.createExplosion(
          this.engine.particleContainer,
          bubble,
          this.bubbles(),
        ),
      );
    }
    this.numberBubblesAudioService.playExplode();
  }
}
