import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { LearnNumbersStore } from '../../store/learn-numbers.store';
import { LearnMode } from '../../app.types';
import { LearnNumbersAudioService } from './learn-numbers.service';
import { learnNumbersAnimations } from './learn-numbers.animations';
import { AppService } from 'src/app/service/app.service';

@Component({
  selector: 'app-learn-numbers',
  standalone: false,
  templateUrl: './learn-numbers.component.html',
  styleUrl: './learn-numbers.component.css',
  animations: learnNumbersAnimations,
})
export class LearnNumbersComponent implements OnInit, OnDestroy {
  LearnMode = LearnMode;
  private readonly learnNumbersStore = inject(LearnNumbersStore);
  private readonly audioService = inject(LearnNumbersAudioService);
  private readonly appService = inject(AppService);

  numbers = this.learnNumbersStore.numbers;
  learnMode = this.learnNumbersStore.learnMode;
  starterNumbersDetail = this.learnNumbersStore.starterNumbersDetail;

  showNumberDetail = signal(false);
  numberDetailImage = signal<string>('');
  clickedNumber = signal<number | null>(null);

  // 进阶模式下数字太多，分6组，每组15个数字
  group = computed(() => {
    if (this.learnMode() === LearnMode.Advanced) {
      return 6;
    }
    return 1;
  });
  currentGroup = signal<number>(0);
  groupNumbers = computed(() => {
    // 将numbers数组分成6组，每组15个数字
    const groups: number[][] = [];
    for (let i = 0; i < this.group(); i++) {
      groups.push(this.numbers().slice(i * 15, (i + 1) * 15));
    }
    return groups;
  });
  currentGroupNumbers = computed(() => {
    return this.groupNumbers()[this.currentGroup()];
  });

  numberAnimationState = signal<{ [key: number]: string }>({});

  private initNumberAnimationState() {
    this.numberAnimationState.set(this.numbers().reduce((acc, cur) => {
      acc[cur] = 'default';
      return acc;
    }, {} as { [key: number]: string }));
  }
  private updateNumberAnimationState(number: number, state: string) {
    this.numberAnimationState.update(prev => {
      prev[number] = state;
      return prev;
    });
  }

  private async waitSeconds(seconds: number) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  private async playWelcome() {
    await this.audioService.preloadWelcome(this.learnMode());
    await this.audioService.playWelcome(this.learnMode());
  }


  async ngOnInit(): Promise<void> {
    await this.appService.lockPortrait();
    await this.audioService.preloadWelcome(this.learnMode());
    await Promise.all([this.audioService.preloadNumbers(this.numbers()), this.playWelcome(), this.audioService.preloadNumberDesc(this.numbers()), this.audioService.preloadNumberMeaning(this.numbers())]);
  }

  async ngOnDestroy(): Promise<void> {
    await this.appService.unlockScreen();
    this.audioService.stopAll();
  }

  async playNumber(number: number) {
    this.audioService.stopAll();
    this.clickedNumber.set(number);
    this.updateNumberAnimationState(number, 'playing');
    // 入门模式，播放数字，然后展示数字的详细信息
    if (this.learnMode() === LearnMode.Starter) {
      this.showNumberDetail.set(true);
      this.numberDetailImage.set(this.starterNumbersDetail()[number].descImg);
      await this.audioService.playNumber(number);
      await this.waitSeconds(0.5);
      await this.audioService.playNumberDesc(number);
      await this.waitSeconds(0.5);
      this.numberDetailImage.set(this.starterNumbersDetail()[number].meaningImg);
      await this.audioService.playNumberMeaning(number);
      await this.waitSeconds(1.5);
    } else {
      // 高级模式，只播放数字即可
      await this.audioService.playNumber(number);
      await this.waitSeconds(1.5);
    }
    this.updateNumberAnimationState(number, 'default');
    this.showNumberDetail.set(false);
    this.clickedNumber.set(null);
    this.numberDetailImage.set('');
  }



}
