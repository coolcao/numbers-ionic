import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AppStore } from 'src/app/store/app.store';
import { AudioService } from 'src/app/service/audio.service';
import { AppService } from 'src/app/service/app.service';
import { LearnMode } from 'src/app/app.types';
import { NumberTrainPixiEngineService } from './services/number-train-pixi-engine.service';
import { NumberTrainGameService } from './services/number-train-game.service';
import { NumberTrainSceneService } from './services/number-train-scene.service';
import { NumberTrainTrainService } from './services/number-train-train.service';
import { NumberTrainTutorialService } from './services/number-train-tutorial.service';

@Component({
  selector: 'app-number-train-pixi',
  standalone: false,
  templateUrl: './number-train-pixi.component.html',
  styleUrls: ['./number-train-pixi.component.css'],
})
export class NumberTrainPixiComponent implements OnInit, OnDestroy {
  @ViewChild('pixiContainer', { static: true }) pixiContainer!: ElementRef;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appStore = inject(AppStore);
  private readonly audioService = inject(AudioService);
  private readonly appService = inject(AppService);

  readonly engine = inject(NumberTrainPixiEngineService);
  readonly gameService = inject(NumberTrainGameService);
  readonly scene = inject(NumberTrainSceneService);
  readonly train = inject(NumberTrainTrainService);
  readonly tutorialService = inject(NumberTrainTutorialService);

  // Expose signals for Template
  totalRound = this.gameService.totalRound;
  currentRound = this.gameService.currentRound;
  correctRound = this.gameService.correctRound;
  gameState = this.gameService.gameState;

  // Tutorial signals
  tutorialStep = this.tutorialService.step;
  tutorialHandPosition = this.tutorialService.handPosition;
  tutorialHandAction = this.tutorialService.handAction;
  tutorialSpotlight = this.tutorialService.spotlight;
  tutorialInstruction = this.tutorialService.instruction;
  introVisible = signal(true);
  canvasHidden = signal(true);

  constructor() { }

  async ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['mode']) {
        const mode = params['mode'] === 'advanced' ? LearnMode.Advanced : LearnMode.Starter;
        this.appStore.setLearnMode(mode);
      }
    });

    this.engine.detectDevice(); // Ensure flags are set
    if (this.engine.isMobile || this.engine.isTablet) {
      // Lock landscape logic
      await this.appService.lockLandscape();
      this.appStore.setShowHeader(false);
      this.appStore.setShowFooter(false);
    }

    this.playWelcome();

    await this.engine.init(this.pixiContainer);

    // Check device type from engine after init
    // (Engine init calls detectDevice)

    this.scene.init(() => {
      // Callback for track Y position
      // default to some meaningful value if bottomZone not ready
      return this.train.bottomZone ? this.train.bottomZone.y : (this.engine.height - 200);
    });

    await this.train.init();

    // Ensure canvas is resized to full screen after layout updates (e.g. header removal)
    setTimeout(() => {
      this.engine.resize();
    }, 100);

    // Wait for user action to start game
  }

  async startGame() {
    if (this.introVisible()) {
      this.introVisible.set(false);
    }
    this.canvasHidden.set(true);
    this.engine.resize();
    requestAnimationFrame(() => {
      this.canvasHidden.set(false);
    });
    const shouldRun = await this.tutorialService.checkShouldRun();

    if (shouldRun) {
      this.gameService.initGame({ tutorial: true });
      this.tutorialService.startTutorial();
    } else {
      this.gameService.initGame();
    }
  }

  ngOnDestroy() {
    this.train.reset();
    this.tutorialService.stop();
    this.engine.destroy();
    this.audioService.stopAll();

    const platform = this.engine.getPlatform();
    if (platform === 'android' || platform === 'ios') { // or check isMobile generic
      this.appService.unlockScreen().catch(console.error);
      this.appStore.setShowHeader(true);
      this.appStore.setShowFooter(true);
    }
  }

  async restartGame() {
    await this.startGame();
  }

  backHome() {
    this.router.navigate(['/home'], { replaceUrl: true });
  }

  async playWelcome() {
    try {
      await Promise.all([
        this.audioService.preload('welcome1', 'assets/audio/number-train/number-train-welcome.mp3'),
        this.audioService.preload('welcome2', 'assets/audio/number-train/number-train-welcome2.mp3'),
        this.audioService.preload('welcome3', 'assets/audio/number-train/number-train-welcome3.mp3'),
      ]);
      await this.audioService.playSequence(['welcome1', 'welcome2', 'welcome3']);
    } catch (e) {
      console.warn('Welcome audio failed', e);
    }
  }
}
