import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { AudioService } from 'src/app/service/audio.service';
import { AppService } from 'src/app/service/app.service';
import { Toy, VendingMachinePixiDataService } from './services/vending-machine-pixi-data.service';
import { VendingMachinePixiSceneService } from './services/vending-machine-pixi-scene.service';
import { VendingMachinePixiGameService } from './services/vending-machine-pixi-game.service';
import { VendingMachinePixiEffectsService } from './services/vending-machine-pixi-effects.service';
import { VendingMachinePixiInteractionService } from './services/vending-machine-pixi-interaction.service';
import { VendingMachinePixiLifecycleService } from './services/vending-machine-pixi-lifecycle.service';
import { VendingMachinePixiToyService } from './services/vending-machine-pixi-toy.service';
import { VendingMachinePixiCoinService } from './services/vending-machine-pixi-coin.service';
import { VendingMachinePixiFeedbackService } from './services/vending-machine-pixi-feedback.service';
import { VENDING_MACHINE_COLORS, VendingMachineColors } from './vending-machine-pixi.colors';
import { VendingMachinePixiThemeService } from './services/vending-machine-pixi-theme.service';
import { VendingMachinePixiCheckoutService } from './services/vending-machine-pixi-checkout.service';
import { VendingMachinePixiTutorialService } from './services/vending-machine-pixi-tutorial.service';

@Component({
  selector: 'app-vending-machine-pixi',
  standalone: false,
  templateUrl: './vending-machine-pixi.component.html',
  styleUrls: ['./vending-machine-pixi.component.css'],
  providers: [
    VendingMachinePixiDataService,
    VendingMachinePixiSceneService,
    VendingMachinePixiGameService,
    VendingMachinePixiEffectsService,
    VendingMachinePixiInteractionService,
    VendingMachinePixiLifecycleService,
    VendingMachinePixiToyService,
    VendingMachinePixiCoinService,
    VendingMachinePixiFeedbackService,
    VendingMachinePixiThemeService,
    VendingMachinePixiCheckoutService,
    VendingMachinePixiTutorialService,
  ],
})
export class VendingMachinePixiComponent
  implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('pixiContainer', { static: true }) pixiContainer!: ElementRef;

  private app!: Application;

  // Game State
  private isProcessing = false;
  isLoading = true;
  private forceTutorial = false;

  // Collection State
  private purchasedToySprites: Container[] = [];
  // 记录已购买的玩具图片ID + 购买数在 dataService 中

  // Scene Elements
  private machineContainer!: Container;
  private toysContainer!: Container;
  private coinWalletContainer!: Container;
  private toyBoxContainer!: Container; // New HUD
  private toyBoxText!: Text; // New Counter text
  private displayPriceText!: Text;
  private displayBalanceText!: Text;
  private coinSlotZone!: Graphics;
  private coinSlotAnchor!: Container;
  private pushBtn!: Container;
  private pushText!: Text;
  private pushGlow?: Graphics;
  private lifecycleCleanup?: () => void;

  private themeCleanup?: () => void;

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
  private colors: VendingMachineColors = VENDING_MACHINE_COLORS.light;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private audioService: AudioService,
    private appService: AppService,
    private dataService: VendingMachinePixiDataService,
    private sceneService: VendingMachinePixiSceneService,
    private gameService: VendingMachinePixiGameService,
    private effectsService: VendingMachinePixiEffectsService,
    private interactionService: VendingMachinePixiInteractionService,
    private lifecycleService: VendingMachinePixiLifecycleService,
    private toyService: VendingMachinePixiToyService,
    private coinService: VendingMachinePixiCoinService,
    private feedbackService: VendingMachinePixiFeedbackService,
    private themeService: VendingMachinePixiThemeService,
    private checkoutService: VendingMachinePixiCheckoutService,
    public tutorialService: VendingMachinePixiTutorialService,
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      // 首页传递的是 'advanced' 或 'starter'
      const mode = params['mode'] === 'advanced' ? 'hard' : 'simple';
      this.dataService.setMode(mode);
      this.forceTutorial = params['tutorial'] === '1';
    });

    // 锁定方向：手机端锁竖屏，平板/大屏允许横屏
    const minSide = Math.min(window.innerWidth, window.innerHeight);
    if (minSide < 600) {
      this.appService.lockPortrait();
    } else {
      this.appService.unlockScreen();
    }

    // 检测暗黑模式
    const theme = this.themeService.getInitialTheme();
    this.isDarkMode = theme.isDarkMode;
    this.colors = theme.colors;

    // 监听主题变化
    this.themeCleanup = this.themeService.bindThemeObserver((isDark) => {
      if (this.isDarkMode !== isDark) {
        this.isDarkMode = isDark;
        this.updateTheme();
      }
    });
  }

  private initThemeColors() {
    this.colors = this.themeService.getColors(this.isDarkMode);
  }

  // 动态更新主题
  private updateTheme() {
    if (!this.app) return;

    // 1. 更新颜色配置
    this.initThemeColors();

    // 2. 更新背景色
    this.themeService.applyBackground(this.app, this.isDarkMode);

    // 3. 重绘场景
    this.app.stage.removeChildren();
    this.buildScene();

    // 恢复 HUD 状态
    if (this.toyBoxText) {
      this.toyBoxText.text = `${this.dataService.purchasedCount}/${this.dataService.maxPurchaseCount}`;
    }

    // 重绘玩具（保留数据）
    this.generateToys();
    this.configureTutorial();
  }

  async ngAfterViewInit() {
    setTimeout(() => this.initGame(), 100);
  }

  async initGame() {
    try {
      await this.lifecycleService.preloadResources({
        audioService: this.audioService,
        toyImageCount: this.TOY_IMAGE_COUNT,
      });
    } catch (e) {
      console.warn('Resource load failed', e);
    }

    this.app = await this.lifecycleService.initApp({
      pixiContainer: this.pixiContainer.nativeElement,
      isDarkMode: this.isDarkMode,
    });

    if (this.forceTutorial) {
      await this.tutorialService.resetProgress();
    }
    const shouldRunTutorial = this.forceTutorial || await this.tutorialService.checkShouldRun();
    if (shouldRunTutorial) {
      this.dataService.enableTutorial(1);
    } else {
      this.dataService.disableTutorial();
    }

    this.buildScene();
    this.generateToys();
    this.configureTutorial();

    if (shouldRunTutorial) {
      this.tutorialService.startTutorial();
    }

    this.lifecycleCleanup = this.lifecycleService.bindLifecycleHandlers({
      app: this.app,
      onRebuild: (reason) => this.rebuildScene(reason),
    });

    // Ensure the first frame is ready before showing
    requestAnimationFrame(() => {
      this.isLoading = false;
      this.audioService.play('welcome');
    });
  }

  private buildScene() {
    const coins = this.gameService.getCoinsForMode(this.dataService.mode);
    const isLandscape = this.app.screen.width / this.app.screen.height > 1.1;
    const refs = this.sceneService.createScene({
      app: this.app,
      colors: this.colors,
      isDarkMode: this.isDarkMode,
      isLandscape,
      purchasedImageIds: this.dataService.purchasedImageIds,
      purchasedCount: this.dataService.purchasedCount,
      maxPurchaseCount: this.dataService.maxPurchaseCount,
      coins,
      onCheckout: () => this.tryCheckout(),
      onCoinPointerDown: (value, x, y, scale) => this.spawnDraggableCoin(value, x, y, scale),
      onLayoutChange: (layout) => {
        this.machineWidth = layout.machineWidth;
        this.machineHeight = layout.machineHeight;
        this.windowWidth = layout.windowWidth;
        this.windowHeight = layout.windowHeight;
        this.rowHeight = layout.rowHeight;
      },
    });

    this.machineContainer = refs.machineContainer;
    this.toysContainer = refs.toysContainer;
    this.coinWalletContainer = refs.coinWalletContainer;
    this.toyBoxContainer = refs.toyBoxContainer;
    this.toyBoxText = refs.toyBoxText;
    this.displayPriceText = refs.displayPriceText;
    this.displayBalanceText = refs.displayBalanceText;
    this.coinSlotZone = refs.coinSlotZone;
    this.coinSlotAnchor = refs.coinSlotAnchor;
    this.pushBtn = refs.pushBtn;
    this.pushText = refs.pushText;
    this.pushGlow = refs.pushGlow;

    this.updateDisplay();
  }

  private rebuildScene(reason: 'visibility' | 'context-restored') {
    if (!this.app) return;
    this.themeService.rebuildScene({
      app: this.app,
      buildScene: () => this.buildScene(),
      generateToys: () => this.generateToys(),
      updateDisplay: () => this.updateDisplay(),
    });
    this.configureTutorial();
  }


  private spawnDraggableCoin(value: number, globalX: number, globalY: number, scale: number) {
    if (!this.tutorialService.canInsertCoin() || !this.tutorialService.canUseCoinValue(value)) {
      this.tutorialService.remindCurrentStep();
      return;
    }
    this.coinService.spawnDraggableCoin({
      app: this.app,
      value,
      globalX,
      globalY,
      scale,
      isProcessing: this.isProcessing,
      dataService: this.dataService,
      audioService: this.audioService,
      sceneService: this.sceneService,
      gameService: this.gameService,
      coinSlotZone: this.coinSlotZone,
      onUpdateDisplay: () => this.updateDisplay(),
      onCoinDrop: () => {
        this.tutorialService.emit({ type: 'coin_drop' });
      },
      playAudio: !this.tutorialService.isPlaying(),
    });
  }

  private generateToys() {
    const { toyBaseScale } = this.toyService.generateAndLayout({
      toysContainer: this.toysContainer,
      dataService: this.dataService,
      toyImageCount: this.TOY_IMAGE_COUNT,
      bgColors: this.BG_COLORS,
      tagBg: this.colors.tagBg,
      tagText: this.colors.tagText,
      windowWidth: this.windowWidth,
      windowHeight: this.windowHeight,
      rowHeight: this.rowHeight,
      onSelect: (toy, sprite) => {
        if (!this.tutorialService.canSelectToy(toy.id)) {
          this.tutorialService.remindCurrentStep();
          return;
        }
        this.selectToy(toy, sprite);
        this.tutorialService.emit({ type: 'select_toy', toyId: toy.id });
      },
    });
    this.toyBaseScale = toyBaseScale;
    this.updateDisplay();
  }

  private selectToy(toy: Toy, sprite: Container) {
    this.interactionService.selectToy({
      toy,
      sprite,
      isProcessing: this.isProcessing,
      dataService: this.dataService,
      audioService: this.audioService,
      toyBaseScale: this.toyBaseScale,
    });
    this.updateDisplay();
  }

  private updateDisplay() {
    this.interactionService.updateDisplay({
      dataService: this.dataService,
      displayPriceText: this.displayPriceText,
      displayBalanceText: this.displayBalanceText,
      coinWalletContainer: this.coinWalletContainer,
      pushBtn: this.pushBtn,
      pushText: this.pushText,
      pushGlow: this.pushGlow ?? null,
      isProcessing: this.isProcessing,
    });
    if (this.toyBoxContainer) {
      const isLandscape = this.app && this.app.screen.width / this.app.screen.height > 1.1;
      const config = this.sceneService.getToyBoxConfig(this.app.screen.width, this.app.screen.height, isLandscape);
      this.sceneService.updateToyBoxVisuals(
        this.toyBoxContainer,
        this.dataService.purchasedCount,
        this.dataService.maxPurchaseCount,
        config.boxWidth,
        config.boxHeight,
        this.colors.body,
        this.colors.textHighlight,
        this.dataService.purchasedImageIds,
        isLandscape,
      );
    }
  }

  private tryCheckout() {
    if (this.isProcessing) return;
    if (!this.tutorialService.canCheckout()) {
      this.tutorialService.remindCurrentStep();
      return;
    }

    this.checkoutService.handleCheckout({
      dataService: this.dataService,
      gameService: this.gameService,
      feedbackService: this.feedbackService,
      audioService: this.audioService,
      displayPriceText: this.displayPriceText,
      onPress: () => {
        const originalScale = this.pushBtn.scale.x;
        this.pushBtn.scale.set(originalScale * 0.95);
        setTimeout(() => this.pushBtn.scale.set(originalScale), 100);
      },
      onSuccess: (message, type) => this.success(message, type),
    });
  }

  private success(message: string, type: 'exact' | 'change') {
    this.isProcessing = true;
    const audioKey = type === 'exact' ? 'checkout_success' : 'checkout_change';
    this.audioService.play(audioKey);
    this.effectsService.playSuccess({
      app: this.app,
      message,
      machineContainer: this.machineContainer,
      coinWalletContainer: this.coinWalletContainer,
      toyBoxContainer: this.toyBoxContainer,
      toyBoxText: this.toyBoxText,
      dataService: this.dataService,
      gameService: this.gameService,
      audioService: this.audioService,
      machineHeight: this.machineHeight,
      windowHeight: this.windowHeight,
      onResetRound: () => this.resetRound(),
      onGoBack: () => this.goBack(),
      onToyBoxChange: (count, max) => {
        const isLandscape = this.app && this.app.screen.width / this.app.screen.height > 1.1;
        const config = this.sceneService.getToyBoxConfig(this.app.screen.width, this.app.screen.height, isLandscape);
        this.sceneService.updateToyBoxVisuals(
          this.toyBoxContainer,
          count,
          max,
          config.boxWidth,
          config.boxHeight,
          this.colors.body,
          this.colors.textHighlight,
          this.dataService.purchasedImageIds,
          isLandscape,
        );
      },
      onToyBoxArrived: () => {
        this.tutorialService.emit({ type: 'toy_box_arrived' });
      },
    });
    this.tutorialService.emit({ type: 'checkout_success' });
  }

  private resetRound() {
    this.isProcessing = false;
    this.dataService.resetRound();
    this.updateDisplay();
    this.dataService.clearToys();
    this.generateToys();
  }

  private configureTutorial() {
    this.tutorialService.configure({
      dataService: this.dataService,
      refs: {
        getTargetToyPosition: () => {
          const targetId = this.dataService.tutorialTargetToyId;
          const targetToy = this.dataService.toys.find(toy => toy.id === targetId) ?? this.dataService.toys[0];
          const sprite = targetToy?.sprite;
          if (!sprite) return null;
          const pos = sprite.getGlobalPosition();
          return { x: pos.x, y: pos.y };
        },
        getPriceDisplayPosition: () => {
          if (!this.displayPriceText) return null;
          const pos = this.displayPriceText.getGlobalPosition();
          return { x: pos.x, y: pos.y };
        },
        getCoinWalletPosition: () => {
          if (!this.coinWalletContainer) return null;
          const coin = this.coinWalletContainer.children.find(child => child.label === 'coin_1') as Container | undefined;
          if (!coin) {
            const pos = this.coinWalletContainer.getGlobalPosition();
            return { x: pos.x, y: pos.y };
          }
          const pos = coin.getGlobalPosition();
          return { x: pos.x, y: pos.y };
        },
        getCoinSlotPosition: () => {
          if (!this.coinSlotAnchor) return null;
          const pos = this.coinSlotAnchor.getGlobalPosition();
          return { x: pos.x, y: pos.y };
        },
        getCheckoutButtonPosition: () => {
          if (!this.pushBtn) return null;
          const pos = this.pushBtn.getGlobalPosition();
          return { x: pos.x, y: pos.y };
        },
        getToyBoxPosition: () => {
          if (!this.toyBoxContainer) return null;
          const pos = this.toyBoxContainer.getGlobalPosition();
          return { x: pos.x, y: pos.y };
        },
        getToyBoxTextPosition: () => {
          if (!this.toyBoxText) return null;
          const pos = this.toyBoxText.getGlobalPosition();
          return { x: pos.x, y: pos.y };
        },
      },
      onFinish: () => {
        this.dataService.disableTutorial();
        this.dataService.resetRound();
        this.dataService.clearToys();
        this.generateToys();
        this.updateDisplay();
      },
    });
    if (this.tutorialService.isPlaying()) {
      this.tutorialService.remindCurrentStep();
    }
  }


  goBack() {
    this.router.navigateByUrl('/home', { replaceUrl: true });
  }

  ngOnDestroy() {
    if (this.themeCleanup) {
      this.themeCleanup();
    }
    if (this.lifecycleCleanup) {
      this.lifecycleCleanup();
    }
    this.tutorialService.stop();
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
    }
  }
}
