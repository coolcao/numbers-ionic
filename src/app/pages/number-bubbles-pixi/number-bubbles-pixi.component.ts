import { AfterContentInit, AfterViewInit, Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { interval, Subscription, timer } from 'rxjs';
import { NumberBubblesAudioService } from '../number-bubbles/number-bubbles.audio.service';
import { NumberBubblesStore } from '../../store/number-bubbles.store';
import { AppService } from 'src/app/service/app.service';
import { Application, Container, Graphics, Text, Sprite, Texture } from 'pixi.js';

interface Bubble {
  index: number;
  size: number;
  duration: number;
  color: string;
  textColor: number;  // PixiJS v8使用数字格式表示颜色
  x: number;
  y: number;
  number: number;
  startTime: number;
  sprite?: Graphics;
  text?: Text;
  container?: Container;
  isExploding?: boolean;
  particles?: Particle[];
  isShaking?: boolean;
  shakeStartTime?: number;
}

interface Particle {
  sprite: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  initialSize: number;
}

@Component({
  selector: 'app-number-bubbles-pixi',
  standalone: false,
  templateUrl: './number-bubbles-pixi.component.html',
  styleUrl: './number-bubbles-pixi.component.css'
})
export class NumberBubblesPixiComponent implements OnInit, AfterViewInit, AfterContentInit, OnDestroy {
  private readonly appService = inject(AppService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly numberBubblesStore = inject(NumberBubblesStore);
  private readonly numberBubblesAudioService = inject(NumberBubblesAudioService);
  private bubbleSubscription?: Subscription;

  numbers = this.numberBubblesStore.numbers;

  // 标记需要消除的目标数字的个数
  targetNumberCount = signal(2);

  // 标记需要消除的数字
  targetNumbers = signal<number[]>([]);

  gameDuration = this.numberBubblesStore.gameDuration;
  // 标记是否已到时间
  isTimeUp = signal(false);
  // 游戏状态，初始状态， 游戏中， 游戏结束
  gameStatus = signal<string>('initial'); // initial, playing, finished

  bubbleInterval = signal(900); // 恢复到900毫秒生成一个泡泡，与canvas版本一致

  // 泡泡尺寸范围
  bubbleSizeMin = signal(90);
  bubbleSizeMax = signal(110);

  // 泡泡持续时间范围，扩大范围以实现错落有致的效果
  bubbleDurationStart = signal(8);
  bubbleDurationEnd = signal(20);

  // 标记生成目标数字的泡泡总数
  targetBubbleCount = signal(0);
  // 标记已消除的目标数字的泡泡总数
  eliminatedBubbleCount = signal(0);
  // 标记正确率
  accuracy = computed(() => {
    const total = this.targetBubbleCount();
    const correct = this.eliminatedBubbleCount();
    if (total === 0) return 0;
    return Math.round((correct / total) * 100);
  });
  // 根据正确率定制提示
  comment = computed(() => {
    if (this.accuracy() === 100) return '🎉 全对！你是数字小天才！🎉'
    if (this.accuracy() >= 90) return '🌟 太棒了！几乎全对！🌟'
    if (this.accuracy() >= 80) return '👍 真厉害～加油～ 👍'
    if (this.accuracy() >= 60) return '💪 不错哦，再试试看！💪'
    return '🤗 再试一次会更好～ 🤗'
  });
  subComment = computed(() => {
    if (this.accuracy() === 100) return '所有数字都听对啦，太完美了！'
    if (this.accuracy() >= 80) return '马上就要成为数字小达人了！'
    if (this.accuracy() >= 60) return '已经超过很多小朋友啦！'
    return '每个小错误都是进步的机会哦！'
  })

  @ViewChild('gameContainer', { static: false }) gameContainer!: ElementRef;
  colors = ['#FF5733', '#FFC300', '#DAF7A6', '#C70039', '#900C3F', '#581845', '#355C7D', '#6C5B7B', '#C06C84', '#F67280'];
  bubbles = signal<Bubble[]>([]);

  // 是否正在播放目标数字的音频
  playTargets = signal(false);

  // 当前下落的泡泡中，是否还有目标数字
  hasTargetBubble = computed(() => {
    return this.bubbles().some((bubble: Bubble) => this.targetNumbers().includes(bubble.number));
  })

  private pixiApp?: Application;
  private gameStage?: Container;
  private bubbleContainer?: Container;
  private particleContainer?: Container;

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
    await this.appService.lockPortrait();
    await this.numberBubblesAudioService.playWelcomeAndRules();
    this.generateTargetNumbers();
  }

  ngAfterViewInit() {
    // PixiJS应用将在需要时初始化
  }

  ngAfterContentInit() {
    // 确保内容已经初始化
  }

  async ngOnDestroy(): Promise<void> {
    await this.appService.unlockScreen();
    if (this.bubbleSubscription) {
      this.bubbleSubscription.unsubscribe();
    }
    this.destroyPixiApp();
    this.numberBubblesAudioService.stopAll();
  }

  private async waitForGameContainer(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 10;

    while (!this.gameContainer && attempts < maxAttempts) {
      // 强制进行变更检测
      this.cdr.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 50));
      attempts++;
    }
  }

  private async initPixiApp(): Promise<boolean> {
    if (this.pixiApp) return true;

    // 等待Angular完成变更检测和DOM更新
    await this.waitForGameContainer();

    if (!this.gameContainer) {
      console.error('Game container is still not available');
      return false;
    }

    const containerElement = this.gameContainer.nativeElement;
    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;

    // 创建PixiJS应用
    this.pixiApp = new Application();
    await this.pixiApp.init({
      width,
      height,
      backgroundColor: 0x000000, // 使用透明背景
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      backgroundAlpha: 0, // 完全透明
    });

    // 将canvas添加到容器
    containerElement.appendChild(this.pixiApp.canvas as HTMLCanvasElement);

    // 创建容器
    this.gameStage = new Container();
    this.bubbleContainer = new Container();
    this.particleContainer = new Container();

    this.gameStage.addChild(this.bubbleContainer);
    this.gameStage.addChild(this.particleContainer);
    this.pixiApp.stage.addChild(this.gameStage);

    // 设置canvas样式
    this.pixiApp.canvas.style.width = '100%';
    this.pixiApp.canvas.style.height = '100%';
    this.pixiApp.canvas.style.position = 'absolute';
    this.pixiApp.canvas.style.top = '0';
    this.pixiApp.canvas.style.left = '0';

    // 添加点击事件
    this.pixiApp.canvas.addEventListener('click', this.onCanvasClick.bind(this));

    // 处理窗口大小变化
    window.addEventListener('resize', this.handleResize.bind(this));

    // 开始游戏循环
    this.startGameLoop();

    console.log('PixiJS application initialized successfully');
    return true;
  }

  private handleResize() {
    if (!this.pixiApp || !this.gameContainer) return;

    const containerElement = this.gameContainer.nativeElement;
    const width = containerElement.clientWidth;
    const height = containerElement.clientHeight;

    this.pixiApp.renderer.resize(width, height);
  }

  private startGameLoop() {
    if (!this.pixiApp) return;

    this.pixiApp.ticker.add(this.gameLoop.bind(this));
  }

  private stopGameLoop() {
    if (!this.pixiApp) return;

    this.pixiApp.ticker.remove(this.gameLoop.bind(this));
  }

  private gameLoop(ticker: any) {
    if (this.gameStatus() === 'playing' && !this.playTargets()) {
      this.updateBubbles();
    }
  }

  private updateBubbles() {
    const currentTime = Date.now();
    if (!this.pixiApp) return;

    this.bubbles.update(bubbles => {
      return bubbles.filter(bubble => {
        if (bubble.isExploding) {
          // 更新粒子
          if (bubble.particles) {
            bubble.particles.forEach(particle => {
              // 更新位置
              particle.sprite.x += particle.vx;
              particle.sprite.y += particle.vy;

              // 添加重力效果
              particle.vy += 0.3;

              // 添加空气阻力
              particle.vx *= 0.98;
              particle.vy *= 0.98;

              // 减少生命值
              particle.life--;

              // 更新透明度和大小
              const lifeRatio = particle.life / particle.maxLife;
              particle.sprite.alpha = lifeRatio;
              const currentSize = particle.initialSize * lifeRatio;
              particle.sprite.scale.set(currentSize / particle.initialSize);
            });

            bubble.particles = bubble.particles.filter(p => p.life > 0);
            return bubble.particles.length > 0;
          }
          return false;
        }

        // 计算泡泡当前位置
        const elapsed = (currentTime - bubble.startTime) / 1000;
        const progress = elapsed / bubble.duration;

        if (progress >= 1) {
          // 泡泡已经下落完成，移除
          if (bubble.container && bubble.container.parent) {
            bubble.container.parent.removeChild(bubble.container);
          }
          return false;
        }

        // 更新Y位置
        const startY = -bubble.size;
        const endY = this.pixiApp!.renderer.height + bubble.size;
        bubble.y = startY + (endY - startY) * progress;

        if (bubble.container) {
          bubble.container.y = bubble.y;

          // 添加震动效果
          if (bubble.isShaking && bubble.shakeStartTime) {
            const elapsed = Date.now() - bubble.shakeStartTime;
            const progress = elapsed / 500;

            if (progress < 1) {
              const shakeIntensity = 12 * (1 - progress);
              const shakeFrequency = 25;
              const offsetX = Math.sin(elapsed * shakeFrequency * 0.01) * shakeIntensity;
              const offsetY = Math.cos(elapsed * shakeFrequency * 0.01) * shakeIntensity * 0.6;
              bubble.container.x = bubble.x + offsetX;
              bubble.container.y = bubble.y + offsetY;
            } else {
              bubble.container.x = bubble.x;
              bubble.container.y = bubble.y;
            }
          }
        }

        return true;
      });
    });
  }

  private createBubbleSprite(bubble: Bubble) {
    if (!this.bubbleContainer) return;

    // 创建容器
    const container = new Container();
    container.position.set(bubble.x, bubble.y);

    // 创建泡泡图形
    const graphics = new Graphics();
    const radius = bubble.size / 2;

    // 创建多层渐变效果，增加立体感
    // 底层阴影
    graphics.circle(2, 2, radius);
    graphics.fill({
      color: 0x000000,
      alpha: 0.2
    });

    // 主体渐变 - 使用多层圆形创建渐变效果
    for (let i = radius; i >= 0; i -= radius * 0.1) {
      const alpha = 0.9 * (1 - (radius - i) / radius);
      const color = this.adjustColorBrightness(bubble.color, (radius - i) / radius * 30);
      graphics.circle(0, 0, i);
      graphics.fill({
        color: color,
        alpha: alpha
      });
    }

    // 添加边框
    graphics.circle(0, 0, radius);
    graphics.stroke({
      color: 0xFFFFFF,
      width: 3,
      alpha: 0.6
    });

    // 设置交互
    graphics.eventMode = 'static';
    graphics.cursor = 'pointer';
    graphics.on('pointerdown', () => {
      this.onBubbleClick(bubble);
    });

    // 添加图形到容器（先添加，显示在最底层）
    container.addChild(graphics);

    // 添加多层高光效果（中间层）
    // 主高光
    const highlight = new Graphics();
    highlight.circle(-radius * 0.3, -radius * 0.3, radius * 0.5);
    highlight.fill({
      color: 0xFFFFFF,
      alpha: 0.6
    });
    container.addChild(highlight);

    // 次高光
    const highlight2 = new Graphics();
    highlight2.circle(-radius * 0.5, -radius * 0.5, radius * 0.2);
    highlight2.fill({
      color: 0xFFFFFF,
      alpha: 0.8
    });
    container.addChild(highlight2);

    // 创建数字文本，最后添加（显示在最上层）
    const text = new Text({
      text: bubble.number.toString(),
      style: {
        fontFamily: 'Arial',
        fontSize: radius * 0.7, // 稍微调小字体
        fontWeight: 'bold',
        fill: bubble.textColor,
        align: 'center',
        stroke: {
          color: 0x000000,
          width: 2
        },
        dropShadow: {
          color: 0x000000,
          alpha: 0.5,
          blur: 2,
          distance: 1
        }
      }
    });
    text.anchor.set(0.5);
    container.addChild(text);

    this.bubbleContainer.addChild(container);

    // 保存引用
    bubble.container = container;
    bubble.sprite = graphics;
    bubble.text = text;
  }

  // 辅助函数：调整颜色亮度
  private adjustColorBrightness(hexColor: string, percent: number): number {
    const num = parseInt(hexColor.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G = Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amt));
    const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));

    // 返回正确的十六进制颜色值
    return (R << 16) | (G << 8) | B;
  }

  private createExplosion(bubble: Bubble) {
    if (!this.particleContainer || !bubble.container) return;

    const particleCount = 60;
    const particles: Particle[] = [];

    // 解析泡泡颜色
    const color = parseInt(bubble.color.slice(1), 16);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speedLayer = Math.random();
      let speed;

      if (speedLayer < 0.3) {
        speed = Math.random() * 3 + 8;
      } else if (speedLayer < 0.7) {
        speed = Math.random() * 4 + 4;
      } else {
        speed = Math.random() * 3 + 1;
      }

      const size = Math.random() * 6 + 1;
      const lifeVariation = Math.random() * 20 + 25;

      // 创建粒子图形
      const particleGraphics = new Graphics();
      particleGraphics.circle(0, 0, size);

      // 随机颜色变化
      const colorType = Math.random();
      let particleColor;
      if (colorType < 0.7) {
        particleColor = color;
      } else if (colorType < 0.85) {
        particleColor = 0xFFD700; // 金色
      } else {
        particleColor = 0xFFFFFF; // 白色
      }

      particleGraphics.fill({
        color: particleColor,
        alpha: 1
      });

      // 设置粒子位置
      particleGraphics.position.set(
        bubble.x + (Math.random() - 0.5) * 10,
        bubble.y + (Math.random() - 0.5) * 10
      );

      this.particleContainer.addChild(particleGraphics);

      particles.push({
        sprite: particleGraphics,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 2,
        life: lifeVariation,
        maxLife: lifeVariation,
        initialSize: size
      });
    }

    // 移除泡泡容器
    if (bubble.container.parent) {
      bubble.container.parent.removeChild(bubble.container);
    }

    // 更新泡泡状态
    this.bubbles.update(bubbles =>
      bubbles.map(b =>
        b.index === bubble.index
          ? { ...b, isExploding: true, particles }
          : b
      )
    );
  }

  private async playTargetNumbersAudio() {
    this.playTargets.set(true);
    await this.numberBubblesAudioService.playTargetNumbersAudio(this.targetNumbers());
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

  backHome() {
    this.router.navigate(['home']);
  }

  restartGame() {
    // 停止游戏循环
    this.stopGameLoop();

    // 重置游戏状态
    this.gameStatus.set('initial');
    this.isTimeUp.set(false);
    this.targetBubbleCount.set(0);
    this.eliminatedBubbleCount.set(0);
    this.bubbles.set([]);

    // 重置泡泡生成状态
    this.consecutiveTargetCount = 0;
    this.consecutiveNonTargetCount = 0;
    this.lastGeneratedWasTarget = false;

    // 清理现有订阅
    if (this.bubbleSubscription) {
      this.bubbleSubscription.unsubscribe();
      this.bubbleSubscription = undefined;
    }

    // 清理PixiJS舞台
    this.clearPixiStage();

    // 销毁并重新创建PixiJS应用
    if (this.pixiApp) {
      this.pixiApp.destroy(true, { children: true });
      this.pixiApp = undefined;
      this.gameStage = undefined;
      this.bubbleContainer = undefined;
      this.particleContainer = undefined;
    }

    // 延迟启动新游戏，确保状态完全重置
    setTimeout(() => {
      this.startGame();
    }, 100);
  }

  private clearPixiStage() {
    if (this.bubbleContainer) {
      this.bubbleContainer.removeChildren();
    }
    if (this.particleContainer) {
      this.particleContainer.removeChildren();
    }

    // 确保所有泡泡对象都被清理
    this.bubbles().forEach(bubble => {
      if (bubble.container && bubble.container.parent) {
        bubble.container.parent.removeChild(bubble.container);
      }
    });
  }

  private destroyPixiApp() {
    this.stopGameLoop();
    if (this.pixiApp) {
      this.pixiApp.destroy(true, { children: true });
      this.pixiApp = undefined;
    }
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  async startGame() {
    this.gameStatus.set('playing');
    this.generateTargetNumbers();

    // 重置泡泡生成状态
    this.consecutiveTargetCount = 0;
    this.consecutiveNonTargetCount = 0;
    this.lastGeneratedWasTarget = false;

    // 等待DOM更新后再初始化PixiJS
    await new Promise(resolve => {
      setTimeout(async () => {
        if (!this.pixiApp || !this.pixiApp.canvas) {
          await this.initPixiApp();
        }
        resolve(void 0);
      }, 100);
    });

    await this.playTargetNumbersAudio();
    this.startGameTimer();
    this.startBubbleGeneration();
  }

  // 添加用于跟踪生成序列的状态
  private consecutiveTargetCount = 0;
  private consecutiveNonTargetCount = 0;
  private lastGeneratedWasTarget = false;

  startBubbleGeneration() {
    this.bubbleSubscription = interval(this.bubbleInterval()).subscribe(() => {
      if (this.gameStatus() === 'playing') {
        // 控制总泡泡数量，保持在35-40个左右
        // 目标泡泡控制在13-18个区间
        if (this.bubbles().length >= 20) {
          return; // 达到最大数量，不再生成
        }

        let isTarget: boolean;
        let number: number;

        // 实现更智能的泡泡类型交替生成逻辑
        // 避免连续生成相同类型的泡泡
        if (this.consecutiveTargetCount >= 2) {
          // 如果已经连续生成了2个目标泡泡，接下来生成混淆泡泡
          isTarget = false;
          this.consecutiveTargetCount = 0;
          this.consecutiveNonTargetCount++;
        } else if (this.consecutiveNonTargetCount >= 3) {
          // 如果已经连续生成了3个混淆泡泡，接下来生成目标泡泡
          isTarget = true;
          this.consecutiveNonTargetCount = 0;
          this.consecutiveTargetCount++;
        } else {
          // 正常情况下按概率生成，但避免过度连续
          if (this.lastGeneratedWasTarget) {
            // 上一个生成的是目标泡泡，降低继续生成目标泡泡的概率
            isTarget = Math.random() < 0.4; // 40%概率
          } else {
            // 上一个生成的是混淆泡泡，提高生成目标泡泡的概率
            isTarget = Math.random() < 0.7; // 70%概率
          }

          // 更新连续计数
          if (isTarget) {
            this.consecutiveTargetCount++;
            this.consecutiveNonTargetCount = 0;
          } else {
            this.consecutiveNonTargetCount++;
            this.consecutiveTargetCount = 0;
          }
        }

        // 记录最后一次生成的泡泡类型
        this.lastGeneratedWasTarget = isTarget;

        if (isTarget && this.targetNumbers().length > 0) {
          // 从目标数字中随机选一个
          const targetIdx = Math.floor(Math.random() * this.targetNumbers().length);
          number = this.targetNumbers()[targetIdx];
        } else {
          // 从非目标数字中随机选一个
          const nonTargetNumbers = this.numbers().filter(n => !this.targetNumbers().includes(n));
          const nonTargetIdx = Math.floor(Math.random() * nonTargetNumbers.length);
          number = nonTargetNumbers[nonTargetIdx];
          // 重置目标泡泡连续计数标志
          this.lastGeneratedWasTarget = false;
        }

        // 生成泡泡，优先尝试不重叠的位置，如果失败则使用基础生成方法
        let newBubble = this.generateBubbleWithSpacing(
          Date.now(),
          number,
        );

        // 如果防重叠生成失败，则使用基础生成方法
        if (!newBubble) {
          newBubble = this.generateBubble(
            Date.now(),
            number,
          );
        }

        if (newBubble) {
          // 控制目标泡泡数量在13-18个区间
          if (this.targetNumbers().includes(number)) {
            // 确保目标泡泡数量不超过18个
            if (this.targetBubbleCount() < 18) {
              this.targetBubbleCount.update(count => count + 1);
            }
            // 如果目标泡泡已经达到18个，就当作混淆泡泡处理（不增加计数）
          } else {
            // 混淆泡泡，不增加目标计数
          }

          this.bubbles.update(bubbles => [...bubbles, newBubble]);
          this.createBubbleSprite(newBubble);
        }
      }
    });
  }

  private calculateMaxBubbles(): number {
    if (!this.pixiApp) return 20;

    const screenWidth = this.pixiApp.renderer.width;
    const avgBubbleSize = (this.bubbleSizeMin() + this.bubbleSizeMax()) / 2;

    // 增加最大泡泡数量以生成更多泡泡
    // 允许更多泡泡同时存在，目标是至少生成足够的目标泡泡和混淆泡泡
    const baseMax = 20;

    // 根据屏幕宽度调整，但保持至少20个，最多30个
    const widthBased = Math.floor(screenWidth / avgBubbleSize * 1.2);

    return Math.max(baseMax, Math.min(30, widthBased));
  }

  private generateBubbleWithSpacing(index: number, number: number): Bubble | null {
    if (!this.pixiApp) return null;

    const size = Math.floor(Math.random() * (this.bubbleSizeMax() - this.bubbleSizeMin() + 1)) + this.bubbleSizeMin();
    const duration = Math.random() * (this.bubbleDurationEnd() - this.bubbleDurationStart()) + this.bubbleDurationStart();
    const color = this.colors[Math.floor(Math.random() * this.colors.length)];
    const textColor = this.getTextColor(color);

    // 减少尝试次数但增加容忍度
    const maxAttempts = 10;
    const minSpacing = size * 0.2; // 减少最小间距要求

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const maxX = this.pixiApp.renderer.width - size;
      const x = Math.random() * maxX + size / 2;

      // 检查是否与已有泡泡重叠
      let hasOverlap = false;
      for (const existingBubble of this.bubbles()) {
        if (existingBubble.isExploding) continue;

        const distance = Math.abs(x - existingBubble.x);
        const minRequiredDistance = (size + existingBubble.size) / 2 + minSpacing;

        if (distance < minRequiredDistance) {
          hasOverlap = true;
          break;
        }
      }

      if (!hasOverlap) {
        // 找到合适的位置
        return {
          index,
          size,
          duration,
          color,
          textColor,
          x,
          y: -size,
          number,
          startTime: Date.now()
        };
      }
    }

    // 如果找不到合适位置，返回null
    return null;
  }

  startGameTimer() {
    timer(this.gameDuration() * 1000).subscribe(() => {
      this.isTimeUp.set(true);
      this.bubbleSubscription?.unsubscribe();
    });
  }

  generateBubble(index: number, number: number): Bubble {
    if (!this.pixiApp) {
      return {
        index,
        size: 100,
        duration: 10,
        color: this.colors[0],
        textColor: 0xFFFFFF,  // 使用数字格式
        x: 100,
        y: -100,
        number,
        startTime: Date.now()
      };
    }

    const size = Math.floor(Math.random() * (this.bubbleSizeMax() - this.bubbleSizeMin() + 1)) + this.bubbleSizeMin();
    const duration = Math.random() * (this.bubbleDurationEnd() - this.bubbleDurationStart()) + this.bubbleDurationStart();
    const color = this.colors[Math.floor(Math.random() * this.colors.length)];

    const maxX = this.pixiApp.renderer.width - size;
    const x = Math.random() * maxX + size / 2;

    const textColor = this.getTextColor(color);

    return {
      index,
      size,
      duration,
      color,
      textColor,
      x,
      y: -size,
      number,
      startTime: Date.now()
    };
  }

  onCanvasClick(event: MouseEvent) {
    if (!this.pixiApp) return;

    const rect = this.pixiApp.canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // 查找被点击的泡泡
    const clickedBubble = this.bubbles().find(bubble => {
      if (bubble.isExploding) return false;
      const distance = Math.sqrt(
        Math.pow(clickX - bubble.x, 2) + Math.pow(clickY - bubble.y, 2)
      );
      return distance <= bubble.size / 2;
    });

    if (clickedBubble) {
      this.onBubbleClick(clickedBubble);
    }
  }

  private async onBubbleClick(bubble: Bubble) {
    if (!this.targetNumbers().includes(bubble.number)) {
      this.shakeBubble(bubble);
      this.numberBubblesAudioService.playWrong();
      return;
    }

    this.eliminatedBubbleCount.update(count => count + 1);
    this.createExplosion(bubble);
    this.numberBubblesAudioService.playExplode();
  }

  private shakeBubble(bubble: Bubble) {
    this.bubbles.update(bubbles =>
      bubbles.map(b =>
        b.index === bubble.index
          ? { ...b, isShaking: true, shakeStartTime: Date.now() }
          : b
      )
    );

    setTimeout(() => {
      this.bubbles.update(bubbles =>
        bubbles.map(b =>
          b.index === bubble.index
            ? { ...b, isShaking: false, shakeStartTime: undefined }
            : b
        )
      );
    }, 500);
  }

  // 根据背景色计算文本颜色
  getTextColor(hexColor: string): number {
    // 始终返回白色（数字格式），确保数字清晰可见
    return 0xFFFFFF;
  }
}
