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
  
  // Performance control
  private pauseSmokeGeneration = false;
  private activeSmokeParticles: Graphics[] = [];
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
      const isTabletDevice =
        /ipad|android(?!.*mobile)|tablet/i.test(userAgent) ||
        (navigator.maxTouchPoints > 1 && /macintosh/.test(userAgent));

      // 检测手机设备
      const isMobileDevice =
        /mobile|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile/i.test(
          userAgent,
        );

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
      if (
        platform === 'ios' &&
        /ipad/.test(navigator.userAgent.toLowerCase())
      ) {
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
      this.appService.unlockScreen().catch((err) => {
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

    // Load Textures
    await this.loadTextures();

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
    this.bottomZone.y =
      this.app.screen.height -
      (this.isMobile ? (this.isTablet ? 120 : 90) : 250);
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
      for (let i = 0; i <= w; i += 400) {
        // Increased spacing
        const peakHeight = 600 + Math.sin(i * 0.01) * 200; // Even taller mountains
        mountain.lineTo(i + 200, groundY - peakHeight); // Wider peaks
        mountain.lineTo(i + 400, groundY);
      }
      mountain.fill({ color: 0xc8e6c9, alpha: 0.4 }); // Even lighter green mountains with more transparency

      // Draw Trees (Foreground/Midground) - Made much larger
      // Simple triangle trees with increased size (about 3x taller)
      for (let i = 50; i < w; i += 250) {
        // Increased spacing
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
    this.bottomZone.y =
      this.app.screen.height -
      (this.isMobile ? (this.isTablet ? 120 : 90) : 200);
    this.topZone.y = Math.max(
      this.isMobile ? (this.isTablet ? 140 : 120) : 200,
      this.app.screen.height * 0.4,
    ); // Lower top zone even further
    this.renderTrains();
  }

  async loadTextures() {
    // 加载火车图片纹理
    const engineTexture = await Assets.load('assets/images/train/engine.png');
    const carTexture = await Assets.load('assets/images/train/car.png');
    const cabooseTexture = await Assets.load('assets/images/train/caboose.png');
    
    // 预先设置纹理的基地尺寸，避免运行时缩放
    this.textures['engine'] = engineTexture;
    this.textures['car'] = carTexture;
    this.textures['caboose'] = cabooseTexture;
  }

  generateTextures() {
    // 不再需要生成纹理，所有纹理都从图片加载
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
      const trainY = this.bottomZone
        ? this.bottomZone.y
        : this.app.screen.height - (this.isMobile ? 90 : 200);
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

    // Body
    const body = new Sprite(this.textures[train.type]);
    body.anchor.set(0.5);
    
    // 统一设置所有车厢的尺寸为相同值
    const uniformSize = this.isMobile ? (this.isTablet ? 140 : 100) : 180;
    
    // 使用scale而不是width/height来确保比例一致
    body.scale.set(uniformSize / 180); // 原始图片是180x180
    
    // 所有车厢保持在同一水平线上
    body.y = 0;
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

    // Smoke for Engine
    let smokeUpdate: (() => void) | null = null;
    if (train.type === 'engine') {
      let frame = 0;
      smokeUpdate = () => {
        frame++;
        if (frame % 20 === 0 && !this.pauseSmokeGeneration) { // 检查是否暂停烟雾生成
          // More frequent smoke
          this.spawnSmoke(container);
        }
      };
      this.app.ticker.add(smokeUpdate);
    }

    // Cleanup
    container.on('destroyed', () => {
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
    
    // 根据缩放比例调整烟雾位置
    const chimneyOffsetX = -30 * this.scaleFactor;
    const chimneyOffsetY = -50 * this.scaleFactor;
    
    smoke.x = chimneyOffsetX + (Math.random() * 10 - 5); // Stack pos with jitter
    smoke.y = chimneyOffsetY; // 从车头顶部冒出
    parent.addChild(smoke);
    
    // 追踪烟雾粒子
    this.activeSmokeParticles.push(smoke);

    // Random velocity
    const vx = Math.random() * 0.5 - 1.5; // Drift left (train moving right)
    const vy = -Math.random() * 1.5 - 1; // Upward

    const update = () => {
      // 检查烟雾是否还存在
      if (!smoke || smoke.destroyed) {
        // 从活跃粒子列表中移除
        const index = this.activeSmokeParticles.indexOf(smoke);
        if (index > -1) {
          this.activeSmokeParticles.splice(index, 1);
        }
        this.app.ticker.remove(update);
        return;
      }
      
      smoke.x += vx;
      smoke.y += vy;
      smoke.alpha -= 0.008;
      smoke.scale.x += 0.01;
      smoke.scale.y += 0.01;

      if (smoke.alpha <= 0) {
        smoke.destroy();
        // 从活跃粒子列表中移除
        const index = this.activeSmokeParticles.indexOf(smoke);
        if (index > -1) {
          this.activeSmokeParticles.splice(index, 1);
        }
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
    const uniformSize = this.isMobile ? (this.isTablet ? 140 : 100) : 180;
    const bottomSpacing = uniformSize; // 间距等于车厢宽度，避免重叠
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
        const uniformSize = this.isMobile ? (this.isTablet ? 140 : 100) : 180;
        const trainWidth = uniformSize; // 间距等于车厢宽度，避免重叠
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
    const uniformSize = this.isMobile ? (this.isTablet ? 140 : 100) : 180;
    const trainWidth = uniformSize; // 间距等于车厢宽度，避免重叠
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
        await this.audioService.preload(
          'wrong-answer',
          'assets/audio/number-train/wrong-answer.mp3',
        );
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
      await this.audioService.preload(
        'train-whistle',
        'assets/audio/number-train/train-whistle.mp3',
      );
      await this.audioService.preload(
        'train-move',
        'assets/audio/number-train/train-move.m4a',
      );

      this.audioService.play('train-whistle');
      setTimeout(() => {
        this.audioService.play('train-move');
      }, 500);
    } catch (e) {
      console.error('Audio play failed', e);
    }
    
    // 暂时禁用烟雾生成以提高性能
    this.pauseSmokeGeneration = true;
    
    // 清除现有的烟雾粒子，减少渲染负担
    this.clearExistingSmoke();

    // Animate Train Moving Left
    // 根据设备类型调整速度
    const speed = this.isMobile ? 5 : 8; // 手机端速度慢一些
    
    // 先缓存bottomZone的引用，避免每次查找
    const zone = this.bottomZone;
    const screenWidth = this.app.screen.width;
    
    // 使用requestAnimationFrame而不是ticker，更精确控制
    let animationId: number;
    const animate = () => {
      if (!zone) return;

      zone.x -= speed;

      // Stop when off screen
      if (zone.x < -screenWidth - 500) {
        cancelAnimationFrame(animationId);
        zone.x = 0; // Reset
        this.app.stage.eventMode = 'static'; // Re-enable
        this.pauseSmokeGeneration = false; // 恢复烟雾生成

        if (this.currentRound() < this.totalRound()) {
          this.playNextRound();
        }
      } else {
        animationId = requestAnimationFrame(animate);
      }
    };
    
    animationId = requestAnimationFrame(animate);
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

  clearExistingSmoke() {
    // 清除所有活跃的烟雾粒子
    const particlesToRemove = [...this.activeSmokeParticles];
    particlesToRemove.forEach(smoke => {
      if (smoke && !smoke.destroyed) {
        smoke.destroy();
      }
    });
    this.activeSmokeParticles = [];
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
