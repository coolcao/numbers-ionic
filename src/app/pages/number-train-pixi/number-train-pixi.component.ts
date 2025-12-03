import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  WritableSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  Application,
  Container,
  Graphics,
  Text,
  Texture,
  Sprite,
  Assets,
  FederatedPointerEvent,
  Point,
} from 'pixi.js';
import { AppStore } from 'src/app/store/app.store';
import { NumberTrainStore } from 'src/app/store/number-train.store';
import { NumberTrainService } from 'src/app/pages/number-train/number-train.service';
import { AudioService } from 'src/app/service/audio.service';
import { AppService } from 'src/app/service/app.service';
import { Capacitor } from '@capacitor/core';
import { timer } from 'rxjs';

interface TrainPart {
  id: string;
  number: number;
  type: 'engine' | 'car' | 'caboose';
  x?: number;
  y?: number;
}

@Component({
  selector: 'app-number-train-pixi',
  standalone: false,
  templateUrl: './number-train-pixi.component.html',
  styleUrls: ['./number-train-pixi.component.css'],
})
export class NumberTrainPixiComponent implements OnInit, OnDestroy {
  @ViewChild('pixiContainer', { static: true }) pixiContainer!: ElementRef;

  private app!: Application;
  private readonly router = inject(Router);
  private readonly appStore = inject(AppStore);
  private readonly trainStore = inject(NumberTrainStore);
  private readonly service = inject(NumberTrainService);
  private readonly audioService = inject(AudioService);

  // Game State Signals
  trainNumbers: WritableSignal<number[]> = signal([]);
  targetNumbers: WritableSignal<number[]> = signal([]);

  // Visual State
  topTrains: WritableSignal<TrainPart[]> = signal([]);
  bottomTrains: WritableSignal<TrainPart[]> = signal([]);

  gameState: WritableSignal<'playing' | 'finished'> = signal('playing');
  totalRound = signal(5);
  currentRound = signal(0);
  correctRound = signal(0);
  roundFinished = signal(false);

  // Pixi Elements
  private mainContainer!: Container;
  private topZone!: Container;
  private bottomZone!: Container;
  private dragItem: Container | null = null;
  private dragOffset = { x: 0, y: 0 };
  private originalPosition = { x: 0, y: 0 };
  private originalParent: Container | null = null;
  private originalIndex: number = -1;

  // Textures
  private textures: { [key: string]: Texture } = {};

  // Responsive scaling
  private isMobile = false;
  private isTablet = false;
  private scaleFactor = 1;
  private readonly TRAIN_WIDTH = 180;
  private readonly mobileTrainWidth = 100; // Mobile train width (reduced from 120)
  private readonly tabletTrainWidth = 140; // Tablet train width
  private readonly mobileScaleFactor = 0.56; // Mobile scale factor (100/180)
  private readonly tabletScaleFactor = 0.78; // Tablet scale factor (140/180)

  private readonly appService = inject(AppService);

  constructor() {
    effect(() => {
      if (this.roundFinished()) {
        this.checkRound();
      }
    });

    // 监听主题变化，动态更新背景色
    effect(() => {
      if (this.app) {
        const isDarkMode = this.appStore.isDarkMode();
        // 使用与页面一致的颜色：rgb(8 47 73) 对应的十六进制是 #082F49
        // 白天模式使用 rgb(236 254 255) 对应的十六进制是 #ECFEFF
        const backgroundColor = isDarkMode ? 0x082f49 : 0xecfeff; // dark mode 使用 rgb(8 47 73) 或普通模式使用 rgb(236 254 255)
        this.app.renderer.background.color = backgroundColor;

        // 主题变化时重新生成纹理
        this.generateTextures();
        this.renderTrains();
      }
    });
  }

  async ngOnInit() {
    // 检查设备类型（手机、平板或桌面）
    const deviceType = this.getDeviceType();
    if (deviceType === 'mobile') {
      this.isMobile = true;
      this.scaleFactor = this.mobileScaleFactor;
      await this.appService.lockLandscape();
      // 隐藏header和footer以腾出更多空间
      this.appStore.setShowHeader(false);
      this.appStore.setShowFooter(false);
    } else if (deviceType === 'tablet') {
      this.isMobile = true; // 平板也使用移动端逻辑，但尺寸更大
      this.isTablet = true;
      this.scaleFactor = this.tabletScaleFactor;
      await this.appService.lockLandscape();
      // 隐藏header和footer以腾出更多空间
      this.appStore.setShowHeader(false);
      this.appStore.setShowFooter(false);
    }

    this.playWelcome();
    await this.initPixi();
    this.playNextRound();
  }

  // 判断当前平台
  getPlatform() {
    // 使用 Capacitor 的 Platforms 来判断当前运行平台
    if (Capacitor.isNativePlatform()) {
      if (Capacitor.getPlatform() === 'android') {
        return 'android';
      } else if (Capacitor.getPlatform() === 'ios') {
        return 'ios';
      }
    }
    return 'web';
  }

  // 精确判断设备类型（手机、平板或桌面）
  getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    const platform = this.getPlatform();
    
    // Web 平台的判断
    if (platform === 'web') {
      const userAgent = navigator.userAgent.toLowerCase();
      
      // 检测平板设备
      const isTabletDevice = /ipad|android(?!.*mobile)|tablet/i.test(userAgent) || 
                           (navigator.maxTouchPoints > 1 && /macintosh/.test(userAgent));
      
      // 检测手机设备
      const isMobileDevice = /mobile|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile/i.test(userAgent);
      
      if (isTabletDevice) {
        return 'tablet';
      } else if (isMobileDevice) {
        return 'mobile';
      } else {
        return 'desktop';
      }
    }
    
    // 原生平台的判断
    if (platform === 'ios' || platform === 'android') {
      // 通过屏幕尺寸判断是手机还是平板
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const minDimension = Math.min(screenWidth, screenHeight);
      const maxDimension = Math.max(screenWidth, screenHeight);
      
      // 根据屏幕尺寸和像素密度判断
      // 一般情况下，手机最小边小于768px，平板最小边大于768px
      // 考虑到像素密度，我们使用设备像素比进行调整
      const devicePixelRatio = window.devicePixelRatio || 1;
      const adjustedMinDimension = minDimension * devicePixelRatio;
      
      // iPad 设备特殊处理
      if (platform === 'ios' && /ipad/.test(navigator.userAgent.toLowerCase())) {
        return 'tablet';
      }
      
      // Android 设备根据屏幕尺寸判断
      if (platform === 'android') {
        // 大于768px的设备认为是平板
        if (minDimension >= 768) {
          return 'tablet';
        }
      }
      
      // 根据屏幕长宽比和尺寸判断
      const aspectRatio = maxDimension / minDimension;
      // 长宽比在1.3到1.7之间且最小边较大的设备可能是平板
      if (aspectRatio > 1.3 && aspectRatio < 1.7 && minDimension >= 600) {
        return 'tablet';
      }
      
      return 'mobile';
    }
    
    return 'desktop';
  }

  ngOnDestroy() {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
    }

    // 检查是否为移动端，如果是则解锁屏幕方向
    const platform = this.getPlatform();
    if (platform === 'android' || platform === 'ios') {
      this.appService.unlockScreen().catch(err => {
        console.error('Failed to unlock screen:', err);
      });
      // 恢复header和footer的显示
      this.appStore.setShowHeader(true);
      this.appStore.setShowFooter(true);
    }
  }

  async initPixi() {
    this.app = new Application();

    // 根据黑暗模式设置背景色
    const isDarkMode = this.appStore.isDarkMode();
    // 使用与页面一致的颜色：rgb(8 47 73) 对应的十六进制是 #082F49
    // 白天模式使用 rgb(236 254 255) 对应的十六进制是 #ECFEFF
    const backgroundColor = isDarkMode ? 0x082f49 : 0xecfeff; // dark mode 使用 rgb(8 47 73) 或普通模式使用 rgb(236 254 255)

    await this.app.init({
      resizeTo: this.pixiContainer.nativeElement,
      backgroundColor: backgroundColor, // 根据主题设置背景色
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.pixiContainer.nativeElement.appendChild(this.app.canvas);

    // Enable stage interactivity for global drag events
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    // Generate Textures
    this.generateTextures();

    // Setup Scene
    this.mainContainer = new Container();
    this.app.stage.addChild(this.mainContainer);

    this.createBackground();
    this.createScenery();
    this.createTracks();

    this.topZone = new Container();
    this.topZone.label = 'topZone';
    this.topZone.y = this.isMobile ? (this.isTablet ? 120 : 100) : 150;
    this.mainContainer.addChild(this.topZone);

    this.bottomZone = new Container();
    this.bottomZone.label = 'bottomZone';
    this.bottomZone.y = this.app.screen.height - (this.isMobile ? (this.isTablet ? 120 : 90) : 250);
    this.mainContainer.addChild(this.bottomZone);

    // Handle Resize
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
  }

  createScenery() {
    const sceneryContainer = new Container();
    this.mainContainer.addChild(sceneryContainer);

    // Mountains
    const mountain = new Graphics();
    sceneryContainer.addChild(mountain);

    // Trees
    const trees = new Graphics();
    sceneryContainer.addChild(trees);

    this.app.ticker.add(() => {
      mountain.clear();
      trees.clear();

      const w = this.app.screen.width;
      const h = this.app.screen.height;
      const groundY = this.bottomZone ? this.bottomZone.y + 100 : h - 100;

      // Draw Mountains (Background) - Made much larger
      mountain.moveTo(0, groundY);
      // Generate some peaks - Increased spacing and height (about 2x taller)
      for (let i = 0; i <= w; i += 400) { // Increased spacing
        const peakHeight = 600 + Math.sin(i * 0.01) * 200; // Even taller mountains
        mountain.lineTo(i + 200, groundY - peakHeight); // Wider peaks
        mountain.lineTo(i + 400, groundY);
      }
      mountain.fill({ color: 0xc8e6c9, alpha: 0.4 }); // Even lighter green mountains with more transparency

      // Draw Trees (Foreground/Midground) - Made much larger
      // Simple triangle trees with increased size (about 3x taller)
      for (let i = 50; i < w; i += 250) { // Increased spacing
        const treeX = i + Math.sin(i) * 40; // More horizontal variation
        const treeY = groundY - 40; // Adjusted position

        // Trunk - Even taller trunk (much higher than train cars)
        trees.rect(treeX - 18, treeY - 160, 36, 160); // Much taller trunk (160px high)
        trees.fill({ color: 0x8d6e63, alpha: 0.7 }); // Lighter brown with transparency

        // Leaves - Better proportioned canopy with more natural shape
        trees.moveTo(treeX - 50, treeY - 160); // Adjusted base width for taller trunk
        trees.lineTo(treeX, treeY - 240); // Even taller (80px from trunk top)
        trees.lineTo(treeX + 50, treeY - 160);
        trees.closePath(); // Close the path to create a complete triangle
        trees.fill({ color: 0x81c784, alpha: 0.6 }); // Lighter green with transparency

        // Add a subtle highlight to the leaves for more depth
        trees.moveTo(treeX - 25, treeY - 200);
        trees.lineTo(treeX, treeY - 230);
        trees.lineTo(treeX + 25, treeY - 200);
        trees.closePath();
        trees.fill({ color: 0xa5d6a7, alpha: 0.5 }); // Even lighter green with more transparency
      }
    });
  }

  onResize() {
    if (!this.app || !this.bottomZone) return;
    this.app.stage.hitArea = this.app.screen;
    this.bottomZone.y = this.app.screen.height - (this.isMobile ? (this.isTablet ? 120 : 90) : 200);
    this.topZone.y = Math.max(this.isMobile ? (this.isTablet ? 140 : 120) : 200, this.app.screen.height * 0.4); // Lower top zone even further
    this.renderTrains();
  }

  generateTextures() {
    // Helper to create texture from canvas
    const createTexture = (
      drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
      width: number,
      height: number,
    ) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      drawFn(ctx, width, height);
      return Texture.from(canvas);
    };

    // Coupler Texture
    this.textures['coupler'] = createTexture(
      (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#616161');
        grad.addColorStop(1, '#424242');
        ctx.fillStyle = grad;
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, 4);
        ctx.fill();
        ctx.stroke();
      },
      this.isMobile ? (this.isTablet ? 16 : 12) : 20, // Tablet uses medium size
      this.isMobile ? (this.isTablet ? 24 : 17) : 30,
    );

    // Engine Texture
    this.textures['engine'] = createTexture(
      (ctx, w, h) => {
        const topOffset = this.isMobile ? 20 : 40; // 恢复到接近原始的topOffset

        // 根据黑暗模式调整颜色
        const isDarkMode = this.appStore.isDarkMode();
        const lightFactor = isDarkMode ? 0.7 : 1; // 黑暗模式下调亮颜色

        // 调整颜色亮度的辅助函数
        const adjustColor = (color: string) => {
          if (!isDarkMode) return color;
          // 在黑暗模式下将颜色调亮一些
          const hex = color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);

          // 提高亮度
          const newR = Math.min(255, Math.floor(r * lightFactor));
          const newG = Math.min(255, Math.floor(g * lightFactor));
          const newB = Math.min(255, Math.floor(b * lightFactor));

          return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        };

        // Chimney - 调整大小以适应新的高度
        ctx.fillStyle = adjustColor('#424242');
        ctx.strokeStyle = adjustColor('#212121');
        ctx.lineWidth = 2;

        // Chimney Rect - 根据设备类型调整尺寸
        const chimneyW = this.isMobile ? (this.isTablet ? 27 : 24) : 30;
        const chimneyH = this.isMobile ? (this.isTablet ? 35 : 24) : 30; // 加大平板上烟囱高度
        const chimneyX = this.isMobile ? (this.isTablet ? 35 : 30) : 40;
        const chimneyY = this.isMobile ? 10 : 10; // 调整烟囱位置
        ctx.fillRect(chimneyX, chimneyY, chimneyW, chimneyH);
        ctx.strokeRect(chimneyX, chimneyY, chimneyW, chimneyH);

        // Chimney Top (Flared) - 根据设备类型调整尺寸
        ctx.beginPath();
        const chimneyTopX = chimneyX + chimneyW / 2;
        const chimneyTopY = chimneyY;
        const chimneyTopRx = this.isMobile ? (this.isTablet ? 14 : 12) : 15;
        const chimneyTopRy = this.isMobile ? (this.isTablet ? 6 : 4) : 5; // 加大平板上烟囱顶部高度
        ctx.ellipse(chimneyTopX, chimneyTopY, chimneyTopRx, chimneyTopRy, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Body Gradient
        const grad = ctx.createLinearGradient(0, topOffset, w, h);
        if (isDarkMode) {
          // 黑暗模式下使用较浅的颜色
          grad.addColorStop(0, adjustColor('#81c784'));
          grad.addColorStop(0.5, adjustColor('#66bb6a'));
          grad.addColorStop(1, adjustColor('#4caf50'));
        } else {
          grad.addColorStop(0, '#66bb6a');
          grad.addColorStop(0.5, '#4caf50');
          grad.addColorStop(1, '#388e3c');
        }

        ctx.fillStyle = grad;
        ctx.strokeStyle = adjustColor('#2e7d32');
        ctx.lineWidth = 2;

        // Draw Engine Shape (Rounded Rect with some custom shape)
        ctx.beginPath();
        ctx.moveTo(25, topOffset);
        ctx.lineTo(w - 10, topOffset);
        ctx.quadraticCurveTo(w, topOffset, w, topOffset + 10);
        ctx.lineTo(w, h - 10);
        ctx.quadraticCurveTo(w, h, w - 10, h);
        ctx.lineTo(25, h);
        ctx.quadraticCurveTo(0, h, 0, h - 25);
        ctx.lineTo(0, 25 + topOffset);
        ctx.quadraticCurveTo(0, topOffset, 25, topOffset);
        ctx.fill();
        ctx.stroke();

        // Window
        ctx.fillStyle = isDarkMode ? 'rgba(200, 230, 200, 0.9)' : '#e8f5e8';
        const windowX = this.isMobile ? (this.isTablet ? 25 : 20) : 30; // 根据设备类型调整车窗位置
        // 调整窗口位置，使其更居中
        const engineHeight = this.isMobile ? (this.isTablet ? 100 : 75) : 140;
        // 调整车窗大小，使其与车厢车窗比例协调
        const windowH = this.isMobile ? (this.isTablet ? 30 : 20) : 40; // 根据设备类型调整车窗高度
        const windowY = topOffset + (this.isMobile ? (this.isTablet ? 25 : 20) : 25); // 根据设备类型调整车窗位置
        const windowW = this.isMobile ? (this.isTablet ? 35 : 25) : 60; // 根据设备类型调整车窗宽度
        ctx.fillRect(windowX, windowY, windowW, windowH);
        ctx.strokeRect(windowX, windowY, windowW, windowH);

        // Light
        ctx.beginPath();
        const lightX = w - (this.isMobile ? (this.isTablet ? 25 : 20) : 20);
        const lightY = topOffset + (this.isMobile ? (this.isTablet ? 22 : 20) : 30); // 根据设备类型调整车灯位置
        const lightR = this.isMobile ? (this.isTablet ? 14 : 12) : 15;
        ctx.arc(lightX, lightY, lightR, 0, Math.PI * 2);
        ctx.fillStyle = adjustColor('#ffeb3b');
        ctx.fill();
        ctx.shadowColor = adjustColor('#ffeb3b');
        ctx.shadowBlur = this.isMobile ? (this.isTablet ? 9 : 8) : 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      },
      this.isMobile ? (this.isTablet ? 140 : 100) : 180, // 根据设备类型调整宽度
      this.isMobile ? (this.isTablet ? 100 : 75) : 140, // 平板设备上车头高度调整为100
    );

    // Car Texture
    this.textures['car'] = createTexture(
      (ctx, w, h) => {
        // 根据黑暗模式调整颜色
        const isDarkMode = this.appStore.isDarkMode();
        const lightFactor = isDarkMode ? 0.7 : 1;

        // 调整颜色亮度的辅助函数
        const adjustColor = (color: string) => {
          if (!isDarkMode) return color;
          const hex = color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);

          const newR = Math.min(255, Math.floor(r * lightFactor));
          const newG = Math.min(255, Math.floor(g * lightFactor));
          const newB = Math.min(255, Math.floor(b * lightFactor));

          return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        };

        const grad = ctx.createLinearGradient(0, 0, w, h);
        if (isDarkMode) {
          // 黑暗模式下使用较浅的颜色
          grad.addColorStop(0, adjustColor('#a5d6a7'));
          grad.addColorStop(0.5, adjustColor('#81c784'));
          grad.addColorStop(1, adjustColor('#66bb6a'));
        } else {
          grad.addColorStop(0, '#81c784');
          grad.addColorStop(0.5, '#66bb6a');
          grad.addColorStop(1, '#4caf50');
        }

        ctx.fillStyle = grad;
        ctx.strokeStyle = adjustColor('#43a047');
        ctx.lineWidth = 2;

        // Rounded Rect
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, 10);
        ctx.fill();
        ctx.stroke();

        // Inner Panel
        ctx.fillStyle = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.roundRect(15, 15, w - 30, h - 30, 8);
        ctx.fill();

        // Windows
        ctx.fillStyle = isDarkMode ? '#f0f0f0' : '#fff';
        const winW = this.isMobile ? (this.isTablet ? 16 : 11) : 20;
        const winH = this.isMobile ? (this.isTablet ? 20 : 14) : 25;
        const startX = this.isMobile ? (this.isTablet ? 20 : 14) : 25;
        const startY = this.isMobile ? (this.isTablet ? 20 : 14) : 25;
        const doorOffset = this.isMobile ? (this.isTablet ? 40 : 28) : 50;
        const gap = (w - doorOffset - 3 * winW) / 2;
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(startX + i * (winW + gap), startY, winW, winH);
        }

        // Door
        ctx.fillStyle = isDarkMode ? adjustColor('#2e7d32') : '#1b5e20';
        const doorW = this.isMobile ? (this.isTablet ? 24 : 17) : 30;
        const doorH = this.isMobile ? (this.isTablet ? 16 : 11) : 20;
        ctx.fillRect(w / 2 - doorW / 2, h - doorH, doorW, doorH);
      },
      this.isMobile ? (this.isTablet ? 125 : 90) : 160,
      this.isMobile ? (this.isTablet ? 78 : 56) : 100,
    );

    // Caboose Texture
    this.textures['caboose'] = createTexture(
      (ctx, w, h) => {
        // 根据黑暗模式调整颜色
        const isDarkMode = this.appStore.isDarkMode();
        const lightFactor = isDarkMode ? 0.7 : 1;

        // 调整颜色亮度的辅助函数
        const adjustColor = (color: string) => {
          if (!isDarkMode) return color;
          const hex = color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);

          const newR = Math.min(255, Math.floor(r * lightFactor));
          const newG = Math.min(255, Math.floor(g * lightFactor));
          const newB = Math.min(255, Math.floor(b * lightFactor));

          return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        };

        // 主体渐变
        const grad = ctx.createLinearGradient(0, 0, w, h);
        if (isDarkMode) {
          // 黑暗模式下使用较浅的颜色
          grad.addColorStop(0, adjustColor('#c8e6c9'));
          grad.addColorStop(0.5, adjustColor('#a5d6a7'));
          grad.addColorStop(1, adjustColor('#81c784'));
        } else {
          grad.addColorStop(0, '#a5d6a7');
          grad.addColorStop(0.5, '#81c784');
          grad.addColorStop(1, '#66bb6a');
        }

        ctx.fillStyle = grad;
        ctx.strokeStyle = adjustColor('#4caf50');
        ctx.lineWidth = 2;

        // 绘制主体形状（保持与其他车厢相同的高度）
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(w - 25, 0);
        ctx.quadraticCurveTo(w, 0, w, 25);
        ctx.lineTo(w, h - 10);
        ctx.quadraticCurveTo(w, h, w - 10, h);
        ctx.lineTo(10, h);
        ctx.quadraticCurveTo(0, h, 0, h - 10);
        ctx.lineTo(0, 10);
        ctx.quadraticCurveTo(0, 0, 10, 0);
        ctx.fill();
        ctx.stroke();

        // 尾部特色装饰（在保持高度的前提下添加）
        // 轻微凸起的尾部平台
        const platformGrad = ctx.createLinearGradient(0, h - 25, w, h);
        if (isDarkMode) {
          platformGrad.addColorStop(0, adjustColor('#81c784'));
          platformGrad.addColorStop(1, adjustColor('#66bb6a'));
        } else {
          platformGrad.addColorStop(0, '#81c784');
          platformGrad.addColorStop(1, '#4caf50');
        }

        ctx.fillStyle = platformGrad;
        ctx.beginPath();
        ctx.moveTo(20, h - 20);
        ctx.lineTo(w - 30, h - 20);
        ctx.lineTo(w - 35, h - 5);
        ctx.lineTo(15, h - 5);
        ctx.closePath();
        ctx.fill();

        // 主要窗户
        ctx.fillStyle = isDarkMode ? '#f5f5f5' : '#fff';
        const mainWinX = this.isMobile ? (this.isTablet ? 20 : 14) : 25;
        const mainWinY = this.isMobile ? (this.isTablet ? 20 : 14) : 25;
        const mainWinW = this.isMobile ? (this.isTablet ? 32 : 22) : 40;
        const mainWinH = this.isMobile ? (this.isTablet ? 24 : 17) : 30;
        ctx.fillRect(mainWinX, mainWinY, mainWinW, mainWinH);

        // 观察窗（侧面的小窗户）
        const obsWinX = this.isMobile ? w - (this.isTablet ? 48 : 33) : w - 60;
        const obsWinY = this.isMobile ? (this.isTablet ? 20 : 14) : 25;
        const obsWinW = this.isMobile ? (this.isTablet ? 16 : 11) : 20;
        const obsWinH = this.isMobile ? (this.isTablet ? 16 : 11) : 20;
        ctx.fillRect(obsWinX, obsWinY, obsWinW, obsWinH);

        // 小型通风口
        ctx.fillStyle = adjustColor('#5d4037'); // 深棕色
        const ventX = w - (this.isMobile ? (this.isTablet ? 16 : 11) : 20);
        const ventY = this.isMobile ? (this.isTablet ? 12 : 8) : 15;
        const ventW = this.isMobile ? (this.isTablet ? 6 : 4) : 8;
        const ventH = this.isMobile ? (this.isTablet ? 12 : 8) : 15;
        ctx.fillRect(ventX, ventY, ventW, ventH); // 竖直的通风管

        // 通风口顶部装饰
        ctx.beginPath();
        const ventTopX = w - (this.isMobile ? (this.isTablet ? 14 : 9) : 16);
        const ventTopY = this.isMobile ? (this.isTablet ? 12 : 8) : 15;
        const ventTopR = this.isMobile ? (this.isTablet ? 4 : 3) : 5;
        ctx.arc(ventTopX, ventTopY, ventTopR, 0, Math.PI, true); // 半圆顶部
        ctx.fill();

        // 尾部标识文字
        ctx.fillStyle = isDarkMode ? '#1b5e20' : '#000';
        ctx.font = `bold ${this.isMobile ? (this.isTablet ? 8 : 6) : 10}px Arial`;
        ctx.fillText('CABOOSE', this.isMobile ? (this.isTablet ? 28 : 19) : 35, h - (this.isMobile ? (this.isTablet ? 8 : 6) : 10));

        // 侧边装饰条纹
        ctx.fillStyle = adjustColor('#4caf50');
        const stripeY1 = h - (this.isMobile ? (this.isTablet ? 20 : 14) : 25);
        const stripeY2 = h - (this.isMobile ? (this.isTablet ? 12 : 8) : 15);
        const stripeH = this.isMobile ? (this.isTablet ? 2 : 1) : 2;
        const stripeX = this.isMobile ? (this.isTablet ? 12 : 8) : 15;
        const stripeW = w - (this.isMobile ? (this.isTablet ? 24 : 16) : 30);
        ctx.fillRect(stripeX, stripeY1, stripeW, stripeH);
        ctx.fillRect(stripeX, stripeY2, stripeW, stripeH);

        // 尾部旗帜
        ctx.fillStyle = isDarkMode ? adjustColor('#66bb6a') : '#4caf50';
        ctx.save();
        ctx.translate(w - (this.isMobile ? (this.isTablet ? 28 : 19) : 35), this.isMobile ? (this.isTablet ? 6 : 4) : 8);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(0, this.isMobile ? (this.isTablet ? -8 : -5) : -10, this.isMobile ? (this.isTablet ? 16 : 11) : 20, this.isMobile ? (this.isTablet ? 12 : 8) : 15);
        ctx.restore();
      },
      this.isMobile ? (this.isTablet ? 140 : 100) : 180,
      this.isMobile ? (this.isTablet ? 78 : 56) : 100,
    );

    // Wheel Texture
    this.textures['wheel'] = createTexture(
      (ctx, w, h) => {
        // 根据黑暗模式调整颜色
        const isDarkMode = this.appStore.isDarkMode();

        const grad = ctx.createRadialGradient(
          w / 2,
          h / 2,
          5,
          w / 2,
          h / 2,
          w / 2,
        );

        if (isDarkMode) {
          // 黑暗模式下使用较浅的颜色
          grad.addColorStop(0, '#424242');
          grad.addColorStop(0.5, '#212121');
          grad.addColorStop(1, '#424242');
        } else {
          grad.addColorStop(0, '#212121');
          grad.addColorStop(0.5, '#000000');
          grad.addColorStop(1, '#212121');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isDarkMode ? '#9e9e9e' : '#616161';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Inner hub
        ctx.fillStyle = isDarkMode ? '#bdbdbd' : '#e0e0e0';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, this.isMobile ? (this.isTablet ? 10 : 6) : 8, 0, Math.PI * 2);
        ctx.fill();
      },
      this.isMobile ? (this.isTablet ? 35 : 28) : 50,
      this.isMobile ? (this.isTablet ? 35 : 28) : 50,
    );
  }

  createBackground() {
    // Create clouds
    const cloudTex = this.createCloudTexture();
    for (let i = 0; i < 4; i++) {
      const cloud = new Sprite(cloudTex);
      cloud.x = Math.random() * this.app.screen.width;
      cloud.y = Math.random() * (this.app.screen.height / 2);
      cloud.alpha = 0.8;
      this.mainContainer.addChild(cloud);

      // Animate clouds
      this.app.ticker.add(() => {
        cloud.x += 0.5 * (i + 1) * 0.5;
        if (cloud.x > this.app.screen.width + 100) {
          cloud.x = -100;
        }
      });
    }
  }

  createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 60;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(30, 30, 20, 0, Math.PI * 2);
    ctx.arc(50, 30, 25, 0, Math.PI * 2);
    ctx.arc(70, 30, 20, 0, Math.PI * 2);
    ctx.fill();
    return Texture.from(canvas);
  }

  createTracks() {
    const trackContainer = new Container();
    this.mainContainer.addChild(trackContainer);

    // Draw tracks using Graphics
    const track = new Graphics();
    trackContainer.addChild(track);

    this.app.ticker.add(() => {
      track.clear();

      // Calculate track position based on bottomZone (train) position
      // Train center is at bottomZone.y
      // 车厢高度：移动端56，平板78，桌面端100（所有车厢一致）
      // 车轮位置：车厢高度/2 - 车轮高度/4
      // 车轮底部位置：trainY + 车厢高度/2 + 车轮高度/4
      // 轨道应该与车轮底部对齐
      const trainY = this.bottomZone ? this.bottomZone.y : this.app.screen.height - (this.isMobile ? 90 : 200);
      const carHeight = this.isMobile ? (this.isTablet ? 78 : 56) : 100; // 根据设备类型调整车厢高度
      const wheelSize = this.isMobile ? (this.isTablet ? 28 : 22) : 40;
      const wheelBottom = carHeight / 2 + wheelSize / 4; // 车轮底部相对于车厢中心的位置
      const trackLevel = trainY + wheelBottom;
      const w = this.app.screen.width;

      // 1. Ballast (Gravel bed)
      track.rect(0, trackLevel + 8, w, 25);
      track.fill({ color: 0x8d6e63, alpha: 0.6 }); // Brownish gray

      // 2. Sleepers (Ties)
      // Draw sleepers
      for (let x = -20; x < w + 20; x += 50) {
        track.rect(x, trackLevel + 4, 30, 8);
      }
      track.fill({ color: 0x4e342e }); // Dark wood

      // 3. Rails
      // Main Rail
      track.rect(0, trackLevel, w, 8);
      track.fill({ color: 0x78909c }); // Blue grey steel

      // Rail Highlight (Top surface)
      track.rect(0, trackLevel, w, 3);
      track.fill({ color: 0xcfd8dc }); // Light reflection

      // Rail Shadow (Bottom)
      track.rect(0, trackLevel + 8, w, 2);
      track.fill({ color: 0x37474f, alpha: 0.5 });
    });
  }

  createTrainSprite(train: TrainPart): Container {
    const container = new Container();
    container.label = train.id;

    // Couplers (Behind body)
    // We add them first so they are behind the body sprite
    if (train.type === 'engine' || train.type === 'car') {
      // Right coupler (connects to next car)
      const cRight = new Sprite(this.textures['coupler']);
      cRight.anchor.set(0.5);
      cRight.x = train.type === 'engine' 
        ? (this.isMobile ? (this.isTablet ? 70 : 50) : 90) // Half width of engine
        : (this.isMobile ? (this.isTablet ? 62 : 45) : 80); // Half width of car
      container.addChild(cRight);
    }
    if (train.type === 'caboose' || train.type === 'car') {
      // Left coupler (connects to previous car)
      const cLeft = new Sprite(this.textures['coupler']);
      cLeft.anchor.set(0.5);
      cLeft.x = train.type === 'caboose'
        ? (this.isMobile ? (this.isTablet ? -70 : -50) : -90) // Half width of caboose
        : (this.isMobile ? (this.isTablet ? -62 : -45) : -80); // Half width of car
      container.addChild(cLeft);
    }

    // Body
    const body = new Sprite(this.textures[train.type]);
    body.anchor.set(0.5);
    if (train.type === 'engine') {
      body.y = this.isMobile ? -10 : -20; // 恢复原始的车头偏移
    }
    container.addChild(body);

    // Number Text
    const text = new Text({
      text: train.number.toString(),
      style: {
        fontFamily: 'Comic Sans MS',
        fontSize: this.isMobile ? 22 : 40,
        fill: '#ffffff',
        stroke: { color: '#000000', width: this.isMobile ? 2 : 4 },
        dropShadow: {
          color: '#000000',
          blur: this.isMobile ? 2 : 4,
          angle: Math.PI / 6,
          distance: this.isMobile ? 3 : 6,
        },
      },
    });
    text.anchor.set(0.5);
    container.addChild(text);

    // Wheels
    const wheelSize = this.isMobile ? (this.isTablet ? 35 : 28) : 40;
    // 所有车厢的车轮应该在同一水平线上
    // 使用标准的车厢高度来计算车轮位置，确保所有车轮对齐
    const standardCarHeight = this.isMobile ? (this.isTablet ? 78 : 56) : 100;
    const wheelY = standardCarHeight / 2; // 车轮应该在车厢底部
    const wheelX = this.isMobile ? (this.isTablet ? -35 : -30) : -40;

    const w1 = new Sprite(this.textures['wheel']);
    w1.anchor.set(0.5);
    w1.y = wheelY;
    w1.x = wheelX;
    w1.width = wheelSize;
    w1.height = wheelSize;
    container.addChild(w1);

    const w2 = new Sprite(this.textures['wheel']);
    w2.anchor.set(0.5);
    w2.y = wheelY;
    w2.x = -wheelX;
    w2.width = wheelSize;
    w2.height = wheelSize;
    container.addChild(w2);

    // Animate Wheels
    const wheelUpdate = () => {
      w1.rotation += 0.05;
      w2.rotation += 0.05;
    };
    this.app.ticker.add(wheelUpdate);

    // Smoke for Engine
    let smokeUpdate: (() => void) | null = null;
    if (train.type === 'engine') {
      let frame = 0;
      smokeUpdate = () => {
        frame++;
        if (frame % 15 === 0) {
          // More frequent smoke
          this.spawnSmoke(container);
        }
      };
      this.app.ticker.add(smokeUpdate);
    }

    // Cleanup
    container.on('destroyed', () => {
      this.app.ticker.remove(wheelUpdate);
      if (smokeUpdate) {
        this.app.ticker.remove(smokeUpdate);
      }
    });

    // Make Interactive
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', this.onDragStart, this);

    // Store data
    (container as any).trainData = train;

    return container;
  }

  spawnSmoke(parent: Container) {
    const smoke = new Graphics();
    const baseSize = this.isMobile ? (this.isTablet ? 9 : 7) : 10;
    const size = Math.random() * baseSize + baseSize; // Random size
    smoke.circle(0, 0, size);
    smoke.fill({ color: 0xeeeeee, alpha: 0.6 }); // Lighter smoke
    smoke.x = (this.isMobile ? (this.isTablet ? -30 : -25) : -35) + (Math.random() * 10 - 5); // Stack pos with jitter
    // 调整烟雾位置，考虑车头高度
    const engineHeight = this.isMobile ? (this.isTablet ? 100 : 75) : 140;
    smoke.y = -engineHeight / 2 - 10; // 从车头顶部冒出
    parent.addChild(smoke);

    // Random velocity
    const vx = Math.random() * 0.5 - 1.5; // Drift left (train moving right)
    const vy = -Math.random() * 1.5 - 1; // Upward

    const update = () => {
      smoke.x += vx;
      smoke.y += vy;
      smoke.alpha -= 0.008;
      smoke.scale.x += 0.01;
      smoke.scale.y += 0.01;

      if (smoke.alpha <= 0) {
        smoke.destroy();
        this.app.ticker.remove(update);
      }
    };
    this.app.ticker.add(update);
  }

  renderTrains() {
    // Clear zones
    this.topZone.removeChildren();
    this.bottomZone.removeChildren();

    // Render Top Trains (Target/Missing)
    const topTrains = this.topTrains();
    const topSpacing = this.isMobile ? (this.isTablet ? 156 : 112) : 200;
    const topOffset = this.isMobile ? (this.isTablet ? 70 : 56) : 100;
    const startXTop =
      (this.app.screen.width - topTrains.length * topSpacing) / 2 + topOffset;

    topTrains.forEach((t, i) => {
      const sprite = this.createTrainSprite(t);
      sprite.x = startXTop + i * topSpacing;
      sprite.y = 0;
      this.topZone.addChild(sprite);
    });

    // Render Bottom Trains (Current Sequence)
    const bottomTrains = this.bottomTrains();
    const bottomSpacing = this.isMobile ? (this.isTablet ? this.tabletTrainWidth : this.mobileTrainWidth) : 180;
    const bottomOffset = this.isMobile ? (this.isTablet ? 70 : 50) : 90;
    const startXBottom =
      (this.app.screen.width - bottomTrains.length * bottomSpacing) / 2 + bottomOffset;

    bottomTrains.forEach((t, i) => {
      const sprite = this.createTrainSprite(t);
      sprite.x = startXBottom + i * bottomSpacing;
      sprite.y = 0;
      this.bottomZone.addChild(sprite);
    });
  }

  private gapIndex: number | null = null;

  onDragStart(event: FederatedPointerEvent) {
    const obj = event.currentTarget as Container;
    const trainData = (obj as any).trainData as TrainPart;

    // Only allow dragging from Top Zone
    if (obj.parent !== this.topZone) return;

    this.dragItem = obj;
    this.originalParent = obj.parent;
    this.originalPosition = { x: obj.x, y: obj.y };
    this.originalIndex = this.topTrains().findIndex(
      (t) => t.id === trainData.id,
    );
    this.gapIndex = null;

    // Calculate offset: pointer pos relative to object anchor
    const globalPos = event.global;
    const objGlobalPos = obj.getGlobalPosition();

    this.dragOffset = {
      x: globalPos.x - objGlobalPos.x,
      y: globalPos.y - objGlobalPos.y,
    };

    // Move to main container
    const newPosInMain = this.mainContainer.toLocal(objGlobalPos);

    this.mainContainer.addChild(this.dragItem);
    this.dragItem.position.set(newPosInMain.x, newPosInMain.y);

    this.dragItem.scale.set(1.1);
    this.dragItem.alpha = 0.9;

    this.app.stage.on('pointermove', this.onDragMove, this);
    this.app.stage.on('pointerup', this.onDragEnd, this);
    this.app.stage.on('pointerupoutside', this.onDragEnd, this);
  }

  onDragMove(event: FederatedPointerEvent) {
    if (this.dragItem) {
      const globalPos = event.global;
      const newObjGlobal = {
        x: globalPos.x - this.dragOffset.x,
        y: globalPos.y - this.dragOffset.y,
      };

      const newObjLocal = this.mainContainer.toLocal(
        new Point(newObjGlobal.x, newObjGlobal.y),
      );
      this.dragItem.position.set(newObjLocal.x, newObjLocal.y);

      // Check collision with Bottom Zone for gap effect
      // Use direct coordinate comparison instead of bounds to avoid smoke/particle inflation
      const bottomZoneY = this.bottomZone.y;
      const itemY = this.dragItem.y;
      const distY = Math.abs(itemY - bottomZoneY);

      // Threshold: Overlap significantly
      // Train height is ~100. 80 allows for some margin but ensures overlap.
      const yThreshold = 80;

      if (distY < yThreshold) {
        // Calculate relative X in bottom zone
        // bottomZone.x is 0 usually, but we need to account for it if it moves
        const bottomZoneX = this.bottomZone.x;
        const relativeX = this.dragItem.x - bottomZoneX;

        // 重新设计拖拽响应位置算法，通过计算实际车厢位置来确定插入点
        const currentBottomLen = this.bottomTrains().length;
        const trainWidth = this.isMobile ? (this.isTablet ? this.tabletTrainWidth : this.mobileTrainWidth) : this.TRAIN_WIDTH;
        const startXBottom = (this.app.screen.width - currentBottomLen * trainWidth) / 2 + (this.isMobile ? (this.isTablet ? 70 : 50) : 90);

        // 计算相对于第一个车厢的位置
        const relativeToFirstCar = relativeX - startXBottom;

        // 直接计算应该插入的位置
        // 如果在第一辆车左边，则index=0
        // 如果在最后一辆车右边，则index=currentBottomLen
        // 否则根据距离各车厢中心的距离确定位置
        let index = 0;
        if (relativeToFirstCar <= 0) {
          index = 0; // 在最左边
        } else if (relativeToFirstCar >= currentBottomLen * trainWidth) {
          index = currentBottomLen; // 在最右边
        } else {
          // 计算在哪个车厢附近
          // 每个车厢的中心位置应该是 startXBottom + i * trainWidth + trainWidth/2
          index = Math.round(relativeToFirstCar / trainWidth);

          // 边界检查
          index = Math.max(0, Math.min(index, currentBottomLen));
        }

        // Clamp index
        index = Math.max(0, Math.min(index, currentBottomLen));

        if (this.gapIndex !== index) {
          this.gapIndex = index;
          this.updateBottomTrainPositions(this.gapIndex);
        }
      } else {
        if (this.gapIndex !== null) {
          this.gapIndex = null;
          this.updateBottomTrainPositions(null);
        }
      }
    }
  }

  updateBottomTrainPositions(gapIndex: number | null) {
    const bottomTrains = this.bottomTrains();
    // Calculate new startX based on whether there is a gap (simulating +1 item)
    const trainWidth = this.isMobile ? (this.isTablet ? this.tabletTrainWidth : this.mobileTrainWidth) : this.TRAIN_WIDTH;
    const count = bottomTrains.length + (gapIndex !== null ? 1 : 0);
    const startX = (this.app.screen.width - count * trainWidth) / 2 + (this.isMobile ? (this.isTablet ? 70 : 50) : 90); // 90 is half width offset

    this.bottomZone.children.forEach((child, i) => {
      let targetX = startX + i * trainWidth;
      if (gapIndex !== null && i >= gapIndex) {
        targetX += trainWidth;
      }
      // Simple lerp or direct set? Direct set is snappier for drag feedback
      child.x = targetX;
    });
  }

  onDragEnd() {
    if (this.dragItem) {
      this.app.stage.off('pointermove', this.onDragMove, this);
      this.app.stage.off('pointerup', this.onDragEnd, this);
      this.app.stage.off('pointerupoutside', this.onDragEnd, this);

      if (this.gapIndex !== null) {
        this.handleDrop(this.gapIndex);
      } else {
        this.returnToOriginal();
      }

      // Reset gap visual
      this.updateBottomTrainPositions(null);
      this.gapIndex = null;

      if (this.dragItem) {
        this.dragItem.scale.set(1);
        this.dragItem.alpha = 1;
        this.dragItem = null;
      }
    }
  }

  handleDrop(insertIndex: number) {
    if (!this.dragItem) return;
    const trainData = (this.dragItem as any).trainData as TrainPart;

    // Destroy the drag item immediately as we will re-render everything
    this.dragItem.destroy();
    this.dragItem = null;

    // Update Data
    const currentTop = this.topTrains();
    const currentBottom = this.bottomTrains();

    // Remove from top
    const newTop = currentTop.filter((t) => t.id !== trainData.id);

    // Add to bottom
    // Clamp index
    const safeIndex = Math.max(0, Math.min(insertIndex, currentBottom.length));
    const newBottom = [...currentBottom];
    newBottom.splice(safeIndex, 0, trainData);

    // Update Signals
    this.topTrains.set(newTop);
    this.bottomTrains.set(newBottom);

    // Re-render
    this.renderTrains();

    // Check if round finished (no more top trains)
    if (newTop.length === 0) {
      this.roundFinished.set(true);
    }
  }

  returnToOriginal() {
    if (!this.dragItem || !this.originalParent) return;

    // Animate back? For now just snap
    this.originalParent.addChild(this.dragItem);
    this.dragItem.x = this.originalPosition.x;
    this.dragItem.y = this.originalPosition.y;
  }

  playNextRound() {
    this.roundFinished.set(false);

    // Clear existing trains visually before generating new ones
    this.topZone.removeChildren();
    this.bottomZone.removeChildren();

    const trainNumbers = this.service.generateNumbers(
      this.trainStore.numbers(),
      this.trainStore.trainCount(),
    );
    const targetNumbers = this.service.generateTargets(
      trainNumbers,
      this.trainStore.targetCount(),
    );

    this.trainNumbers.set(trainNumbers);
    this.targetNumbers.set(targetNumbers);
    this.currentRound.update((r) => r + 1);

    // Prepare Data
    const allTrains: TrainPart[] = trainNumbers.map((num, idx) => ({
      id: Math.random().toString(36).substr(2, 9),
      number: num,
      type:
        idx === 0
          ? 'engine'
          : idx === trainNumbers.length - 1
            ? 'caboose'
            : 'car',
    }));

    // Filter
    const top = allTrains.filter((t) => targetNumbers.includes(t.number));
    const bottom = allTrains.filter((t) => !targetNumbers.includes(t.number));

    this.topTrains.set(top);
    this.bottomTrains.set(bottom);

    this.renderTrains();
  }

  checkRound() {
    const bottom = this.bottomTrains();
    const correctSequence = this.trainNumbers();

    let isCorrect = true;
    if (bottom.length !== correctSequence.length) {
      isCorrect = false;
    } else {
      for (let i = 0; i < bottom.length; i++) {
        if (bottom[i].number !== correctSequence[i]) {
          isCorrect = false;
          break;
        }
      }
    }

    if (isCorrect) {
      this.correctRound.update((r) => r + 1);
      this.playSuccessAnimation();
    } else {
      // 添加错误处理：播放错误音效和抖动效果
      this.playErrorEffect();
    }

    if (this.currentRound() >= this.totalRound()) {
      this.gameState.set('finished');
    }
  }

  async playErrorEffect() {
    // 并行执行音效播放和抖动效果
    const playAudio = async () => {
      try {
        await this.audioService.preload('wrong-answer', 'assets/audio/number-train/wrong-answer.mp3');
        await this.audioService.play('wrong-answer', { volume: 0.4 });
      } catch (e) {
        console.error('Error audio play failed', e);
      }
    };

    const playShake = () => {
      // 实现抖动效果
      if (this.bottomZone) {
        const originalX = this.bottomZone.x;
        const shakeAmount = 10;
        let shakeCount = 0;
        const maxShakes = 6;

        const shake = () => {
          if (shakeCount < maxShakes) {
            // 抖动方向交替变化
            const direction = shakeCount % 2 === 0 ? 1 : -1;
            this.bottomZone.x = originalX + direction * shakeAmount;

            shakeCount++;

            // 使用setTimeout来控制抖动频率
            setTimeout(shake, 50);
          } else {
            // 恢复原始位置
            this.bottomZone.x = originalX;

            // 等待一段时间后继续下一轮
            setTimeout(() => {
              if (this.currentRound() < this.totalRound()) {
                this.playNextRound();
              }
            }, 500);
          }
        };

        shake();
      } else {
        // 如果没有bottomZone，直接继续下一轮
        setTimeout(() => {
          if (this.currentRound() < this.totalRound()) {
            this.playNextRound();
          }
        }, 500);
      }
    };

    // 同时开始播放音效和抖动效果
    playAudio();
    playShake();
  }

  async playSuccessAnimation() {
    // Block interaction
    this.app.stage.eventMode = 'none';

    // Play Sounds
    try {
      await this.audioService.preload('train-whistle', 'assets/audio/number-train/train-whistle.mp3');
      await this.audioService.preload('train-move', 'assets/audio/number-train/train-move.m4a');

      this.audioService.play('train-whistle');
      setTimeout(() => {
        this.audioService.play('train-move');
      }, 500);
    } catch (e) {
      console.error('Audio play failed', e);
    }

    // Animate Train Moving Left
    const speed = 3; // Slower speed
    const moveTicker = () => {
      if (!this.bottomZone) return;

      this.bottomZone.x -= speed;

      // Stop when off screen
      if (this.bottomZone.x < -this.app.screen.width - 500) {
        this.app.ticker.remove(moveTicker);
        this.bottomZone.x = 0; // Reset
        this.app.stage.eventMode = 'static'; // Re-enable

        if (this.currentRound() < this.totalRound()) {
          this.playNextRound();
        }
      }
    };
    this.app.ticker.add(moveTicker);
  }

  restartGame() {
    this.currentRound.set(0);
    this.correctRound.set(0);
    this.gameState.set('playing');
    this.playNextRound();
  }

  backHome() {
    this.router.navigate(['/']);
  }

  async playWelcome() {
    try {
      await Promise.all([
        this.audioService.preload(
          'welcome1',
          'assets/audio/number-train/number-train-welcome.mp3',
        ),
        this.audioService.preload(
          'welcome2',
          'assets/audio/number-train/number-train-welcome2.mp3',
        ),
        this.audioService.preload(
          'welcome3',
          'assets/audio/number-train/number-train-welcome3.mp3',
        ),
      ]);
      await this.audioService.playSequence(['welcome1', 'welcome2', 'welcome3']);
    } catch (e) {
      console.warn('Welcome audio failed', e);
    }
  }
}
