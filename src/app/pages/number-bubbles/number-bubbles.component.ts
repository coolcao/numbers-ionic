import { AfterViewInit, Component, computed, effect, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { trigger, state, style, animate, transition, keyframes } from '@angular/animations';
import { Router } from '@angular/router';
import { interval, Subscription, timer } from 'rxjs';
import { NumberBubblesAudioService } from './number-bubbles.audio.service';
import { AppStore } from '../../store/app.store';
import { NumberBubblesStore } from '../../store/number-bubbles.store';

interface Bubble {
  index: number;
  size: number;
  duration: number;
  color: string;
  textColor?: string;
  left: number;
  number: number;
  state?: string;
}

@Component({
  selector: 'app-number-bubbles',
  standalone: false,
  templateUrl: './number-bubbles.component.html',
  styleUrl: './number-bubbles.component.css',
  animations: [
    trigger('bubbleAnimation', [
      // 泡泡初始状态
      state('void', style({
        top: '-50px',
        opacity: 0
      })),
      // 泡泡下落状态
      state('falling', style({
        top: '100%',
        opacity: 0.8
      })),
      // 从初始状态到下落状态的转换
      transition('void => falling', [
        animate('{{duration}}s linear', keyframes([
          style({ top: '-50px', opacity: 0, offset: 0 }),
          style({ top: '10%', opacity: 1, offset: 0.1 }),
          style({ top: '100%', opacity: 0.8, offset: 1 })
        ]))
      ], { params: { duration: 5 } })
    ]),
    trigger('gameOverAnimation', [
      transition(':enter', [
        style({ transform: 'scale(0.8)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'scale(0.8)', opacity: 0 }))
      ])
    ]),
  ]
})
export class NumberBubblesComponent implements OnInit, AfterViewInit, OnDestroy {
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

  bubbleInterval = signal(900); // 700毫秒生成一个泡泡

  // 泡泡尺寸范围
  bubbleSizeMin = signal(80);
  bubbleSizeMax = signal(120);

  // 泡泡持续时间范围
  bubbleDurationStart = signal(8);
  bubbleDurationEnd = signal(13);

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

  @ViewChild('bubbleContainer', { static: false }) bubbleContainer!: ElementRef;
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
      }
    });

  }
  async ngOnInit(): Promise<void> {
    await this.numberBubblesAudioService.playWelcomeAndRules();
    this.generateTargetNumbers();
  }
  ngAfterViewInit() {

  }
  ngOnDestroy(): void {
    if (this.bubbleSubscription) {
      this.bubbleSubscription.unsubscribe();
    }
  }
  private async playTargetNumbersAudio() {
    this.playTargets.set(true);
    await this.numberBubblesAudioService.playTargetNumbersAudio(this.targetNumbers());
    this.playTargets.set(false);
  }
  private removeBubble(index: number) {
    const bubbles = [...this.bubbles().filter((b: Bubble) => b.index !== index)];
    this.bubbles.set(bubbles);
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
    this.startGame();
  }
  async startGame() {
    this.gameStatus.set('playing');
    this.generateTargetNumbers();
    await this.playTargetNumbersAudio();
    this.startGameTimer();
    this.startBubbleGeneration();
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
    const size = Math.floor(Math.random() * (this.bubbleSizeMax() - this.bubbleSizeMin() + 1)) + this.bubbleSizeMin();
    // 持续时间在 start 和 end 之间随机生成
    const duration = Math.random() * (this.bubbleDurationEnd() - this.bubbleDurationStart()) + this.bubbleDurationStart();
    const color = this.colors[Math.floor(Math.random() * this.colors.length)];
    // 获取容器的宽度
    const containerWidth = this.bubbleContainer.nativeElement.getBoundingClientRect().width;
    // 计算泡泡的最大左侧位置，确保泡泡不会超出容器右侧
    const maxLeft = 100 - (size / containerWidth * 100);
    const left = Math.random() * maxLeft;

    const textColor = this.getTextColor(color);

    return {
      index,
      size,
      duration,
      color,
      textColor,
      left,
      number,
      state: 'falling', // 设置初始状态为下落
    };
  }

  async onBubbleClick(idx: number) {
    const bubble = this.bubbles().find((b: any) => b.index === idx);
    if (!bubble) return;
    if (!this.targetNumbers().includes(bubble.number)) {
      const bubbleElement = document.querySelector(`[data-index="${idx}"]`);
      if (bubbleElement) {
        bubbleElement.animate([
          { transform: 'translate3d(-12px, 0, 0)' },
          { transform: 'translate3d(12px, 0, 0)' },
          { transform: 'translate3d(-8px, 0, 0)' },
          { transform: 'translate3d(8px, 0, 0)' },
          { transform: 'translate3d(-5px, 0, 0)' },
          { transform: 'translate3d(5px, 0, 0)' },
          { transform: 'translate3d(0, 0, 0)' }
        ], {
          duration: 500,
          easing: 'cubic-bezier(.36,.07,.19,.97)',
          iterations: 1
        });
      }
      return;
    }
    this.eliminatedBubbleCount.update(count => count + 1);

    const bubbleElement = document.querySelector(`[data-index="${idx}"]`);
    if (bubbleElement) {
      // 创建粒子容器
      const particleContainer = document.createElement('div');
      particleContainer.style.position = 'absolute';
      const rect = bubbleElement.getBoundingClientRect();
      particleContainer.style.left = rect.left + 'px';
      particleContainer.style.top = rect.top + 'px';
      particleContainer.style.width = rect.width + 'px';
      particleContainer.style.height = rect.height + 'px';
      document.body.appendChild(particleContainer);

      // 创建粒子
      const particleCount = 30; // 粒子数量
      const particles = [];
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = '22px';
        particle.style.height = '22px';
        particle.style.backgroundColor = bubble.color;
        particle.style.borderRadius = '50%';
        particle.style.left = '50%';
        particle.style.top = '50%';
        particle.style.transform = 'translate(-50%, -50%)';
        particleContainer.appendChild(particle);
        particles.push(particle);
      }

      // 播放爆炸音效
      this.numberBubblesAudioService.playExplode();

      // 设置粒子动画
      particles.forEach((particle, i) => {
        const angle = (i / particleCount) * 360; // 均匀分布在圆周上
        const radius = 70; // 爆炸半径
        const duration = 500; // 动画持续时间

        particle.animate([
          {
            transform: 'translate(-50%, -50%) scale(1)',
            opacity: 1
          },
          {
            transform: `translate(calc(-50% + ${radius * Math.cos(angle * Math.PI / 180)}px),
                       calc(-50% + ${radius * Math.sin(angle * Math.PI / 180)}px)) scale(0.2)`,
            opacity: 0
          }
        ], {
          duration: duration,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'forwards'
        });
      });

      // 原泡泡缩小消失
      bubbleElement.animate([
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(0.8)', opacity: 0 }
      ], {
        duration: 200,
        easing: 'ease-out',
        fill: 'forwards'
      });

      // 动画结束后清理
      setTimeout(() => {
        particleContainer.remove();
        this.removeBubble(idx);
      }, 500);
    }
  }

  // 动画结束处理函数
  onAnimationDone(event: any, index: number) {
    // 如果是下落动画结束，移除泡泡
    if (event.toState === 'falling') {
      this.removeBubble(index);
    }
  }

  getRgbaColor(hexColor: string) {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 1)`;
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
