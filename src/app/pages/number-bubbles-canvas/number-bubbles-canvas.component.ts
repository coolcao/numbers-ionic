import { AfterViewInit, Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { interval, Subscription, timer } from 'rxjs';
import { NumberBubblesAudioService } from '../number-bubbles/number-bubbles.audio.service';
import { NumberBubblesStore } from '../../store/number-bubbles.store';
import { AppService } from 'src/app/service/app.service';

interface Bubble {
  index: number;
  size: number;
  duration: number;
  color: string;
  textColor: string;
  x: number;
  y: number;
  number: number;
  startTime: number;
  isExploding?: boolean;
  particles?: Particle[];
  isShaking?: boolean;
  shakeStartTime?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

@Component({
  selector: 'app-number-bubbles-canvas',
  standalone: false,
  templateUrl: './number-bubbles-canvas.component.html',
  styleUrl: './number-bubbles-canvas.component.css'
})
export class NumberBubblesCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly appService = inject(AppService);
  private readonly router = inject(Router);
  private readonly numberBubblesStore = inject(NumberBubblesStore);
  private readonly numberBubblesAudioService = inject(NumberBubblesAudioService);
  private bubbleSubscription?: Subscription;
  private animationId?: number;
  private ctx?: CanvasRenderingContext2D;

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

  bubbleInterval = signal(900); // 900毫秒生成一个泡泡，降低整体密度

  // 泡泡尺寸范围
  bubbleSizeMin = signal(90);
  bubbleSizeMax = signal(110);

  // 泡泡持续时间范围
  bubbleDurationStart = signal(10);
  bubbleDurationEnd = signal(15);

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

  @ViewChild('gameCanvas', { static: false }) gameCanvas!: ElementRef<HTMLCanvasElement>;
  colors = ['#FF5733', '#FFC300', '#DAF7A6', '#C70039', '#900C3F', '#581845', '#355C7D', '#6C5B7B', '#C06C84', '#F67280'];
  bubbles = signal<Bubble[]>([]);

  // 是否正在播放目标数字的音频
  playTargets = signal(false);

  // 当前下落的泡泡中，是否还有目标数字
  hasTargetBubble = computed(() => {
    return this.bubbles().some((bubble: Bubble) => this.targetNumbers().includes(bubble.number));
  })

  constructor() {
    effect(() => {
      if (this.isTimeUp() && !this.hasTargetBubble()) {
        this.numberBubblesAudioService.playSuccess();
        this.gameStatus.set('finished');
        this.bubbleSubscription?.unsubscribe();
        if (this.animationId) {
          cancelAnimationFrame(this.animationId);
        }
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.appService.lockPortrait();
    await this.numberBubblesAudioService.playWelcomeAndRules();
    this.generateTargetNumbers();
  }

  ngAfterViewInit() {
    // 由于 canvas 是条件渲染的，在初始状态下可能不存在
    // 我们在需要时再初始化 canvas
  }

  async ngOnDestroy(): Promise<void> {
    await this.appService.unlockScreen();
    if (this.bubbleSubscription) {
      this.bubbleSubscription.unsubscribe();
    }
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  private initCanvas() {
    const canvas = this.gameCanvas?.nativeElement;
    if (!canvas) return false;

    this.ctx = canvas.getContext('2d')!;

    // 设置canvas尺寸
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const parentRect = canvas.parentElement?.getBoundingClientRect();

      // 确保使用父容器的完整尺寸
      const width = parentRect?.width || rect.width || window.innerWidth;
      const height = parentRect?.height || rect.height || window.innerHeight;

      canvas.width = width;
      canvas.height = height;

      // 确保 canvas 样式也匹配
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return true;
  }

  private startAnimation() {
    const animate = () => {
      if (this.gameStatus() === 'playing' && this.gameCanvas?.nativeElement && !this.playTargets()) {
        this.updateBubbles();
        this.drawBubbles();
        this.animationId = requestAnimationFrame(animate);
      } else if (this.gameStatus() === 'playing') {
        // 如果游戏还在进行但 canvas 不可用，继续等待
        this.animationId = requestAnimationFrame(animate);
      }
    };
    animate();
  }

  private updateBubbles() {
    const currentTime = Date.now();
    const canvas = this.gameCanvas?.nativeElement;
    if (!canvas) return;

    this.bubbles.update(bubbles => {
      return bubbles.filter(bubble => {
        if (bubble.isExploding) {
          // 更新粒子
          if (bubble.particles) {
            bubble.particles.forEach(particle => {
              // 更新位置
              particle.x += particle.vx;
              particle.y += particle.vy;

              // 添加重力效果
              particle.vy += 0.3;

              // 添加空气阻力，让粒子逐渐减速
              particle.vx *= 0.98;
              particle.vy *= 0.98;

              // 减少生命值
              particle.life--;

              // 让粒子大小随时间减小
              const lifeRatio = particle.life / particle.maxLife;
              particle.size = particle.size * 0.99; // 逐渐缩小
            });
            bubble.particles = bubble.particles.filter(p => p.life > 0 && p.size > 0.1);
            return bubble.particles.length > 0;
          }
          return false;
        }

        // 计算泡泡当前位置
        const elapsed = (currentTime - bubble.startTime) / 1000;
        const progress = elapsed / bubble.duration;

        if (progress >= 1) {
          // 泡泡已经下落完成，移除
          return false;
        }

        // 更新Y位置
        bubble.y = -bubble.size + (canvas.height + bubble.size) * progress;
        return true;
      });
    });
  }

  private drawBubbles() {
    if (!this.ctx) return;

    const canvas = this.gameCanvas?.nativeElement;
    if (!canvas) return;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.bubbles().forEach(bubble => {
      if (bubble.isExploding && bubble.particles) {
        // 绘制爆炸粒子
        bubble.particles.forEach(particle => {
          const alpha = particle.life / particle.maxLife;
          const ctx = this.ctx!;

          ctx.save();
          ctx.globalAlpha = alpha;

          // 创建径向渐变让粒子有发光效果
          const gradient = ctx.createRadialGradient(
            particle.x, particle.y, 0,
            particle.x, particle.y, particle.size * 2
          );

          // 处理不同颜色格式的透明度
          let baseColor = particle.color;
          let semiTransparent, transparent;

          if (baseColor.startsWith('#')) {
            // 十六进制颜色
            semiTransparent = baseColor + '80';
            transparent = baseColor + '00';
          } else if (baseColor.startsWith('rgb(')) {
            // RGB 颜色，转换为 rgba
            const rgbMatch = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (rgbMatch) {
              const [, r, g, b] = rgbMatch;
              semiTransparent = `rgba(${r}, ${g}, ${b}, 0.5)`;
              transparent = `rgba(${r}, ${g}, ${b}, 0)`;
            } else {
              semiTransparent = 'rgba(255, 255, 255, 0.5)';
              transparent = 'rgba(255, 255, 255, 0)';
            }
          } else {
            // 其他格式，使用默认值
            semiTransparent = 'rgba(255, 255, 255, 0.5)';
            transparent = 'rgba(255, 255, 255, 0)';
          }

          gradient.addColorStop(0, baseColor);
          gradient.addColorStop(0.7, semiTransparent);
          gradient.addColorStop(1, transparent);

          // 绘制发光效果
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * 2, 0, Math.PI * 2);
          ctx.fill();

          // 绘制粒子核心
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();

          // 为金色和白色粒子添加额外的闪烁效果
          if (particle.color === '#FFD700' || particle.color === '#FFFFFF') {
            ctx.globalAlpha = alpha * 0.8;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        });
      } else {
        // 绘制普通泡泡
        this.drawBubble(bubble);
      }
    });
  }

  private drawBubble(bubble: Bubble) {
    if (!this.ctx) return;

    const ctx = this.ctx;
    let centerX = bubble.x;
    let centerY = bubble.y;
    const radius = bubble.size / 2;

    // 如果泡泡正在震动，添加震动偏移
    if (bubble.isShaking && bubble.shakeStartTime) {
      const elapsed = Date.now() - bubble.shakeStartTime;
      const progress = elapsed / 500; // 500ms震动时间

      if (progress < 1) {
        // 使用正弦波创建震动效果，增加震动幅度
        const shakeIntensity = 12 * (1 - progress); // 从4增加到12，震动幅度更大
        const shakeFrequency = 25; // 从20增加到25，震动更快更明显
        const offsetX = Math.sin(elapsed * shakeFrequency * 0.01) * shakeIntensity;
        const offsetY = Math.cos(elapsed * shakeFrequency * 0.01) * shakeIntensity * 0.6; // 从0.5增加到0.6

        centerX += offsetX;
        centerY += offsetY;
      }
    }

    // 绘制泡泡主体
    ctx.save();

    // 创建径向渐变
    const gradient = ctx.createRadialGradient(
      centerX - radius * 0.3, centerY - radius * 0.3, 0,
      centerX, centerY, radius
    );

    // 解析颜色
    const r = parseInt(bubble.color.slice(1, 3), 16);
    const g = parseInt(bubble.color.slice(3, 5), 16);
    const b = parseInt(bubble.color.slice(5, 7), 16);

    gradient.addColorStop(0, `rgba(255, 255, 255, 0.8)`);
    gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.6)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 1)`);

    // 绘制泡泡圆形
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 绘制泡泡边框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 绘制高光效果
    const highlightGradient = ctx.createRadialGradient(
      centerX - radius * 0.4, centerY - radius * 0.4, 0,
      centerX - radius * 0.4, centerY - radius * 0.4, radius * 0.6
    );
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.arc(centerX - radius * 0.4, centerY - radius * 0.4, radius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = highlightGradient;
    ctx.fill();

    // 绘制数字
    ctx.fillStyle = bubble.textColor;
    ctx.font = `bold ${Math.floor(radius * 0.8)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bubble.number.toString(), centerX, centerY);

    ctx.restore();
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
    this.gameStatus.set('initial');
    this.isTimeUp.set(false);
    this.targetBubbleCount.set(0);
    this.eliminatedBubbleCount.set(0);
    this.bubbles.set([]);
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.startGame();
  }

  async startGame() {
    this.gameStatus.set('playing');
    this.generateTargetNumbers();
    await this.playTargetNumbersAudio();
    this.startGameTimer();
    this.startBubbleGeneration();

    // 等待一小段时间确保 canvas 已经渲染，然后初始化并开始动画
    setTimeout(() => {
      if (this.initCanvas()) {
        // 再等待一小段时间确保尺寸设置完成
        setTimeout(() => {
          this.startAnimation();
        }, 50);
      }
    }, 150);
  }

  startBubbleGeneration() {
    this.bubbleSubscription = interval(this.bubbleInterval()).subscribe(() => {
      if (this.gameStatus() === 'playing' && this.bubbles().length < 8) {
        // 60%概率生成目标数字，40%概率生成其他数字
        const isTarget = Math.random() < 0.6;
        let number: number;

        if (isTarget && this.targetNumbers().length > 0) {
          // 从目标数字中随机选一个
          const targetIdx = Math.floor(Math.random() * this.targetNumbers().length);
          number = this.targetNumbers()[targetIdx];
        } else {
          // 从非目标数字中随机选一个
          const nonTargetNumbers = this.numbers().filter(n => !this.targetNumbers().includes(n));
          const nonTargetIdx = Math.floor(Math.random() * nonTargetNumbers.length);
          number = nonTargetNumbers[nonTargetIdx];
        }

        if (this.targetNumbers().includes(number)) {
          this.targetBubbleCount.update(count => count + 1);
        }
        const newBubble = this.generateBubble(
          Date.now(), // 使用时间戳作为唯一索引
          number,
        );
        this.bubbles.update(bubbles => [...bubbles, newBubble]);
      }
    });
  }

  startGameTimer() {
    timer(this.gameDuration() * 1000).subscribe(() => {
      this.isTimeUp.set(true);
      this.bubbleSubscription?.unsubscribe(); // 确保在游戏结束时取消订阅
    });
  }

  generateBubble(index: number, number: number): Bubble {
    const canvas = this.gameCanvas?.nativeElement;
    if (!canvas) {
      // 如果 canvas 还没有初始化，返回默认值
      return {
        index,
        size: 100,
        duration: 10,
        color: this.colors[0],
        textColor: '#FFFFFF',
        x: 100,
        y: -100,
        number,
        startTime: Date.now()
      };
    }
    const size = Math.floor(Math.random() * (this.bubbleSizeMax() - this.bubbleSizeMin() + 1)) + this.bubbleSizeMin();
    // 持续时间在 start 和 end 之间随机生成
    const duration = Math.random() * (this.bubbleDurationEnd() - this.bubbleDurationStart()) + this.bubbleDurationStart();
    const color = this.colors[Math.floor(Math.random() * this.colors.length)];

    // 计算X位置，确保泡泡不会超出画布边界
    const maxX = canvas.width - size;
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
    const canvas = this.gameCanvas?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
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
      // 错误点击，让被点击的泡泡震动
      this.shakeBubble(bubble);
      this.numberBubblesAudioService.playWrong();
      return;
    }

    // 正确点击
    this.eliminatedBubbleCount.update(count => count + 1);

    // 创建爆炸效果
    this.createExplosion(bubble);

    // 播放爆炸音效
    this.numberBubblesAudioService.playExplode();
  }

  private shakeBubble(bubble: Bubble) {
    // 为泡泡添加震动状态
    this.bubbles.update(bubbles =>
      bubbles.map(b =>
        b.index === bubble.index
          ? { ...b, isShaking: true, shakeStartTime: Date.now() }
          : b
      )
    );

    // 500ms后移除震动状态
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

  private createExplosion(bubble: Bubble) {
    const particleCount = 60; // 增加粒子数量
    const particles: Particle[] = [];

    // 解析泡泡颜色用于创建多种颜色的粒子
    const r = parseInt(bubble.color.slice(1, 3), 16);
    const g = parseInt(bubble.color.slice(3, 5), 16);
    const b = parseInt(bubble.color.slice(5, 7), 16);

    for (let i = 0; i < particleCount; i++) {
      // 创建更随机的角度分布
      const angle = Math.random() * Math.PI * 2;

      // 创建不同层次的速度，有些粒子飞得更远
      const speedLayer = Math.random();
      let speed;
      if (speedLayer < 0.3) {
        speed = Math.random() * 3 + 8; // 快速粒子
      } else if (speedLayer < 0.7) {
        speed = Math.random() * 4 + 4; // 中速粒子
      } else {
        speed = Math.random() * 3 + 1; // 慢速粒子
      }

      // 创建不同大小的粒子
      const size = Math.random() * 6 + 1;

      // 创建颜色变化
      const colorVariation = Math.random() * 0.3 - 0.15; // -0.15 到 0.15
      const newR = Math.max(0, Math.min(255, r + colorVariation * 255));
      const newG = Math.max(0, Math.min(255, g + colorVariation * 255));
      const newB = Math.max(0, Math.min(255, b + colorVariation * 255));

      // 有些粒子使用原色，有些使用白色或金色增加闪烁效果
      let particleColor;
      const colorType = Math.random();
      if (colorType < 0.7) {
        particleColor = `rgb(${Math.floor(newR)}, ${Math.floor(newG)}, ${Math.floor(newB)})`;
      } else if (colorType < 0.85) {
        particleColor = '#FFD700'; // 金色
      } else {
        particleColor = '#FFFFFF'; // 白色
      }

      // 创建不同生命周期的粒子
      const lifeVariation = Math.random() * 20 + 25; // 25-45 帧

      particles.push({
        x: bubble.x + (Math.random() - 0.5) * 10, // 稍微随机化起始位置
        y: bubble.y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 2, // 添加向上的初始速度
        color: particleColor,
        life: lifeVariation,
        maxLife: lifeVariation,
        size
      });
    }

    // 更新泡泡状态为爆炸
    this.bubbles.update(bubbles =>
      bubbles.map(b =>
        b.index === bubble.index
          ? { ...b, isExploding: true, particles }
          : b
      )
    );
  }

  // 根据背景色计算文本颜色，要与背景色的对比度高
  getTextColor(hexColor: string) {
    // 从十六进制颜色值中提取RGB值
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    // 计算亮度值
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // 根据亮度值选择文本颜色，亮度低则用白色，亮度高则用黑色
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }
}
