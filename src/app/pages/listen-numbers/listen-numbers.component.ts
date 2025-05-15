import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { trigger, state, style, animate, transition, keyframes } from '@angular/animations';
import { Router } from '@angular/router';
import { AppStore } from '../../store/app.store';
import { ListenNumbersStore } from '../../store/listen-numbers.store';
import { LearnMode } from '../../app.types';
import { ListenNumberAudioService } from './listen-numbers.audio.service';

@Component({
  selector: 'app-listen-numbers',
  standalone: false,
  templateUrl: './listen-numbers.component.html',
  styleUrl: './listen-numbers.component.css',
  animations: [
    trigger('cardAnimation', [
      // 默认状态
      state('default', style({
        transform: 'scale(1)',
        backgroundColor: 'white',
        borderColor: '#99f6e4' // teal-200
      })),

      // 正确答案状态
      state('right', style({
        transform: 'scale(1.1)',
        backgroundColor: '#bbf7d0', // green-200
        borderColor: '#4ade80' // green-400
      })),

      // 错误答案状态
      state('wrong', style({
        transform: 'scale(1.1)',
        backgroundColor: '#fecaca', // red-200
        borderColor: '#f87171' // red-400
      })),

      // 从默认状态到正确状态的转换
      transition('default => right', [
        animate('0.5s', keyframes([
          style({ transform: 'scale(1)', offset: 0 }),
          style({ transform: 'scale(1.2) rotate(5deg)', offset: 0.3 }),
          style({ transform: 'scale(1.1) rotate(0deg)', backgroundColor: '#bbf7d0', borderColor: '#4ade80', offset: 1 })
        ]))
      ]),

      // 从默认状态到错误状态的转换
      transition('default => wrong', [
        animate('0.5s', keyframes([
          style({ transform: 'translateX(0)', offset: 0 }),
          style({ transform: 'translateX(-10px)', offset: 0.1 }),
          style({ transform: 'translateX(10px)', offset: 0.2 }),
          style({ transform: 'translateX(-10px)', offset: 0.3 }),
          style({ transform: 'translateX(10px)', offset: 0.4 }),
          style({ transform: 'translateX(-10px)', offset: 0.5 }),
          style({ transform: 'translateX(0) scale(1.1)', backgroundColor: '#fecaca', borderColor: '#f87171', offset: 1 })
        ]))
      ]),

      // 从任何状态回到默认状态
      transition('* => default', [
        animate('0.3s')
      ])
    ]),

    // 数字文本的动画
    trigger('numberAnimation', [
      state('default', style({
        color: '#14b8a6' // teal-500
      })),
      state('right', style({
        color: '#22c55e' // green-500
      })),
      state('wrong', style({
        color: '#ef4444' // red-500
      })),

      // 正确答案时的文本动画
      transition('default => right', [
        animate('0.5s', keyframes([
          style({ transform: 'scale(1)', offset: 0 }),
          style({ transform: 'scale(1.3)', offset: 0.3 }),
          style({ transform: 'scale(1)', color: '#22c55e', offset: 1 })
        ]))
      ]),

      // 错误答案时的文本动画
      transition('default => wrong', [
        animate('0.5s', keyframes([
          style({ transform: 'scale(1)', offset: 0 }),
          style({ transform: 'scale(0.8)', offset: 0.3 }),
          style({ transform: 'scale(1)', color: '#ef4444', offset: 1 })
        ]))
      ]),

      // 回到默认状态
      transition('* => default', [
        animate('0.3s')
      ])
    ]),

    // 底部指示条的动画
    trigger('indicatorAnimation', [
      state('default', style({
        backgroundColor: '#5eead4' // teal-300
      })),
      state('right', style({
        backgroundColor: '#4ade80' // green-400
      })),
      state('wrong', style({
        backgroundColor: '#f87171' // red-400
      })),

      // 正确答案时的指示条动画
      transition('default => right', [
        animate('0.5s', keyframes([
          style({ width: '100%', offset: 0 }),
          style({ width: '110%', offset: 0.3 }),
          style({ width: '100%', backgroundColor: '#4ade80', offset: 1 })
        ]))
      ]),

      // 错误答案时的指示条动画
      transition('default => wrong', [
        animate('0.5s', keyframes([
          style({ width: '100%', offset: 0 }),
          style({ width: '90%', offset: 0.3 }),
          style({ width: '100%', backgroundColor: '#f87171', offset: 1 })
        ]))
      ]),

      // 回到默认状态
      transition('* => default', [
        animate('0.3s')
      ])
    ])
  ]
})
export class ListenNumbersComponent implements OnInit, OnDestroy {

  LearnMode = LearnMode;
  audioUri = 'assets/audio';

  private readonly router = inject(Router);
  private readonly store = inject(AppStore);
  private readonly listenStore = inject(ListenNumbersStore);
  private readonly audioService = inject(ListenNumberAudioService);

  learnMode = this.store.learnMode;
  numbers = this.listenStore.numbers;

  // 一局游戏听数字轮数
  round = computed(() => {
    if (this.learnMode() === LearnMode.Advanced) {
      return 15;
    }
    if (this.learnMode() === LearnMode.Starter) {
      return 10;
    }
    return 10;
  });
  // 当前轮数
  roundCount = signal(0);

  // 当前播报的数字
  num = signal(0);

  // 答对的次数
  count = signal(0);

  // 游戏状态，初始状态， 游戏中， 游戏结束
  gameStatus = signal<string>('initial'); // initial, playing, finished

  // 标记是否正在播放当前数字，如果正在播放，就不允许点击后面的数字
  isPlaying = signal(false);

  // 是否完成游戏
  isFinished = computed(() => {
    return this.roundCount() === this.round();
  })

  // 计算正确率
  rate = computed(() => {
    if (this.roundCount() === 0) {
      return 0;
    }
    return Math.round(this.count() / this.roundCount() * 100);
  });
  // 根据正确率定制提示
  comment = computed(() => {
    if (this.rate() === 100) return '🎉 全对！你是数字小天才！🎉'
    if (this.rate() >= 90) return '🌟 太棒了！几乎全对！🌟'
    if (this.rate() >= 80) return '👍 真厉害～加油～ 👍'
    if (this.rate() >= 60) return '💪 不错哦，再试试看！💪'
    return '🤗 再试一次会更好～ 🤗'
  });
  subComment = computed(() => {
    if (this.rate() === 100) return '所有数字都听对啦，太完美了！'
    if (this.rate() >= 80) return '马上就要成为数字小达人了！'
    if (this.rate() >= 60) return '已经超过很多小朋友啦！'
    return '每个小错误都是进步的机会哦！'
  })


  size = computed(() => {
    if (this.learnMode() === LearnMode.Advanced) {
      return this.listenStore.size();
    }
    return 10;
  });

  // 记录数字卡片的动画状态
  cardStates = signal<{ [key: number]: string }>({});

  constructor() {
    effect(async () => {
      if (this.gameStatus() === 'finished') {
        await this.audioService.preloadSuccess();
        await this.audioService.playSuccess();
      }
    });
  }

  ngOnInit(): void {
    this.audioService.preloadWelcomeAndRules().then(() => {
      this.isPlaying.set(true);
      return this.audioService.playWelcomeAndRules();
    }).then(() => {
      this.isPlaying.set(false);
    });
  }

  ngOnDestroy(): void {
    this.audioService.stopAll();
  }

  // 初始化数字卡片动画状态为default
  private initCardStates() {
    const states: { [key: number]: string } = {};
    this.numbers().forEach(n => {
      states[n] = 'default';
    });
    this.cardStates.set(states);
  }

  // 更新数字卡片的动画状态
  private updateCardState(number: number, state: string) {
    const states = { ...this.cardStates() };
    states[number] = state;
    this.cardStates.set(states);
  }


  private async waitForSeconds(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async startGame() {
    if (this.isPlaying()) {
      return;
    }
    this.gameStatus.set('playing');
    await this.generateNumbers();
  }

  async restartGame() {
    await this.waitForSeconds(0.5);
    this.roundCount.set(0);
    this.count.set(0);
    await this.startGame();
  }

  backHome() {
    if (this.isPlaying()) {
      return;
    }
    this.router.navigate(['home']);
  }

  async checkNumber(number: number) {
    if (this.isPlaying()) {
      return;
    }

    this.roundCount.update((v) => v + 1);
    this.isPlaying.set(true);
    if (number === this.num()) {
      this.updateCardState(number, 'right');
      this.count.update((v) => v + 1);
      await this.audioService.playRightAnswer();
    } else {
      this.updateCardState(number, 'wrong');
      await this.audioService.playWrongAnswer();
    }


    await this.waitForSeconds(0.5);

    // 重置所有卡片状态
    this.initCardStates();

    await this.waitForSeconds(0.5);

    if (this.isFinished()) {
      this.gameStatus.set('finished');
    } else {
      await this.generateNumbers();
    }
    this.isPlaying.set(false);
  }

  // 随机生成数字
  async generateNumbers() {
    const idx = Math.floor(Math.random() * this.numbers().length);
    this.num.set(this.numbers()[idx]);

    // 播放数字
    await this.audioService.playNumber(this.num());
  }

  async replayAudio() {
    await this.audioService.stopAll();
    await this.audioService.playNumber(this.num());
  }

}
