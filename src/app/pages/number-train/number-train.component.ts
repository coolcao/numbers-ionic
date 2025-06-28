import { Component, computed, effect, inject, linkedSignal, OnDestroy, OnInit, Signal, signal, WritableSignal } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { LearnMode } from 'src/app/app.types';
import { NumberTrainService } from 'src/app/pages/number-train/number-train.service';
import { AppStore } from 'src/app/store/app.store';
import { NumberTrainStore } from 'src/app/store/number-train.store';
import { timer } from 'rxjs';
import { animate, keyframes, state, style, transition, trigger } from '@angular/animations';
import { AudioService } from 'src/app/service/audio.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-number-train',
  standalone: false,
  templateUrl: './number-train.component.html',
  styleUrls: ['./number-train.component.css'],
  animations: [
    trigger('trainMoveLeft', [
      state('active', style({
        transform: 'translateX(-120%)'
      })),
      transition('* => active', [
        animate('4s ease-in-out')
      ]),
      transition('active => *', [
        animate('0s ease-in-out')
      ])
    ]),
    trigger('explodeDisappear', [
      state('default', style({
        transform: 'translateY(0)'
      })),
      state('active', style({
        transform: 'translateY(-10px)'
      })),
      transition('default <=> active', [
        animate('0.3s', keyframes([
          style({ transform: 'scale(1)', offset: 0 }),
          style({ transform: 'scale(0.4)', offset: 0.3 }),
          style({ transform: 'scale(0.7)', offset: 0.4 }),
          style({ transform: 'scale(0.4)', offset: 0.5 }),
          style({ transform: 'scale(0.8)', offset: 0.6 }),
          style({ transform: 'scale(0.4)', offset: 0.8 }),
          style({ transform: 'scale(0.2)', offset: 0.9 }),
          style({ transform: 'scale(0)', offset: 1 }),
        ]))
      ]),
      // 为了让 active 变为 default 时没有动画，将该过渡的动画时间设置为 0s
      transition('active => default', [
        animate('0s')
      ])

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
export class NumberTrainComponent implements OnInit, OnDestroy {

  LearnMode = LearnMode;

  private readonly router = inject(Router);
  private readonly appStore = inject(AppStore);
  private readonly trainStore = inject(NumberTrainStore);
  private readonly service = inject(NumberTrainService);
  private readonly audioService = inject(AudioService);

  readonly platform = this.appStore.platform;

  // 所有火车车厢数字
  trainNumbers: WritableSignal<number[]> = signal([]);
  // 目标车厢数字
  targetNumbers: WritableSignal<number[]> = signal([]);

  allTrains = computed(() => {
    return this.trainNumbers().map((num, idx) => {
      return {
        number: num,
        type: idx === 0 ? 'engine' : idx === this.trainNumbers().length - 1 ? 'caboose' : 'car',
      };
    });
  });
  // 目标车厢
  targetTrains = linkedSignal(() => {
    return this.allTrains().filter(train => {
      return this.targetNumbers().includes(train.number);
    });
  });
  // 排列火车车厢
  trains = linkedSignal(() => {
    return this.allTrains().filter(train => {
      return !this.targetNumbers().includes(train.number);
    })
  });

  gameState: WritableSignal<'playing' | 'finished'> = signal('playing');

  // 总轮数
  totalRound = signal(5);
  // 当前轮数
  currentRound = signal(0);
  // 正确的轮数
  correctRound = signal(0);
  // 标记当前轮是否已完成
  roundFinished = signal(false);
  animationState = signal('default');
  explodeState = signal('default');

  constructor() {
    effect(() => {
      if (this.gameState() === 'finished') {
      }
    });

    effect(() => {
      if (this.roundFinished()) {
        const result = this.checkRound();
        // 组合成功，播放成功音效并玩下一局
        if (result === 'success') {
          this.playWhistle().then(() => {
            this.playTrainMove();
            this.animationState.set('active');
            this.correctRound.update(round => round + 1);

            if (this.currentRound() < this.totalRound()) {
              timer(4000).subscribe(() => {
                this.playNextRound();
              });
            }
          });
        } else {
          // 组合失败，播放失败音效并开始下一轮
          this.explodeState.set('active');
          this.playWrong().then(() => {
            if (this.currentRound() < this.totalRound()) {
              timer(1500).subscribe(() => {
                this.playNextRound();
              });
            }
          });
        }
      }
    });


    effect(() => {
      if (this.targetTrains().length === 0) {
        this.roundFinished.set(true);

      }

      if (this.currentRound() === this.totalRound() && this.roundFinished()) {
        timer(3000).subscribe(() => {
          this.gameState.set('finished');
        });
      }



    });
  }

  ngOnInit() {
    // const trainNumbers = this.service.generateNumbers(this.trainStore.numbers(), this.trainStore.trainCount());
    // const targetNumbers = this.service.generateTargets(trainNumbers, this.trainStore.targetCount());
    // this.trainNumbers.set(trainNumbers);
    // this.targetNumbers.set(targetNumbers);

    this.playWelcome();

    this.playNextRound();

    if (this.platform() === 'android' || this.platform() === 'ios') {
      this.lockLandscape();
      this.appStore.setShowHeader(false);
      this.appStore.setShowFooter(false);
    }
  }

  checkRound() {
    if (this.targetTrains().length === 0) {
      if (this.allTrains().length !== this.trains().length) {
        throw new Error('程序异常，火车车厢数量不一致');
      }
      for (let i = 0; i < this.allTrains().length; i++) {
        if (this.allTrains()[i].number !== this.trains()[i].number) {
          return 'fail';
        }
      }
    }
    return 'success';
  }

  playNextRound() {
    this.animationState.set('default');
    this.explodeState.set('default');
    this.roundFinished.set(false);
    const trainNumbers = this.service.generateNumbers(this.trainStore.numbers(), this.trainStore.trainCount());
    const targetNumbers = this.service.generateTargets(trainNumbers, this.trainStore.targetCount());
    this.trainNumbers.set(trainNumbers);
    this.targetNumbers.set(targetNumbers);
    this.currentRound.update(round => round + 1);
    console.log('当前轮数：', this.currentRound());

  }

  ngOnDestroy(): void {
    this.appStore.setShowHeader(true);
    this.appStore.setShowFooter(true);
    if (this.platform() === 'android' || this.platform() === 'ios') {
      ScreenOrientation.unlock();
    }
  }
  // 锁定为横屏
  async lockLandscape() {
    try {
      await ScreenOrientation.lock({ orientation: 'landscape' });
    } catch (e) {
      console.error('Failed to lock orientation:', e);
    }
  }

  drop(event: CdkDragDrop<any[]>) {
    // 阻止从下方区域向上方区域的拖拽
    if (event.previousContainer.id === 'trains' && event.container.id === 'targetTrains') {
      return;
    }

    // 同区域，不移动
    if (event.previousContainer === event.container) {
      return;
    }
    // 跨区域移动
    const item = event.previousContainer.data[event.previousIndex];

    // 先移除原位置的元素
    event.previousContainer.data.splice(event.previousIndex, 1);
    this.targetTrains.set([...event.previousContainer.data]);

    // 在目标位置插入元素
    event.container.data.splice(event.currentIndex, 0, item);
    this.trains.set([...event.container.data]);

    // 触发变更检测
    // event.container.data = [...event.container.data];
    // event.viousContainer.data = [...event.previousContainer.data];
  }

  async playWhistle() {
    await this.audioService.preload('whistle', 'assets/audio/number-train/train-whistle.mp3');
    await this.audioService.play('whistle');
  }
  async playTrainMove() {
    await this.audioService.preload('train-move', 'assets/audio/number-train/train-move.m4a');
    await this.audioService.play('train-move', { volume: 0.2, loop: false });
  }
  async playWrong() {
    await this.audioService.preload('wrong', 'assets/audio/number-train/wrong-answer.mp3');
    await this.audioService.play('wrong', { volume: 0.4 });
  }

  async playWelcome() {
    await Promise.all([
      this.audioService.preload('welcome1', 'assets/audio/number-train/number-train-welcome.mp3'),
      this.audioService.preload('welcome2', 'assets/audio/number-train/number-train-welcome2.mp3'),
      this.audioService.preload('welcome3', 'assets/audio/number-train/number-train-welcome3.mp3'),
    ]);
    await this.audioService.playSequence(['welcome1', 'welcome2', 'welcome3']);
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

}
