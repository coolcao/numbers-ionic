import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LearnNumbersStore } from '../../store/learn-numbers.store';
import { LearnMode } from '../../app.types';
import { LearnNumbersAudioService } from './learn-numbers.service';
import { learnNumbersAnimations } from './learn-numbers.animations';
import { AppService } from 'src/app/service/app.service';
import { AppStore } from 'src/app/store/app.store';
import { ImagePreloaderService } from 'src/app/image-preloader.service';

@Component({
  selector: 'app-learn-numbers',
  standalone: false,
  templateUrl: './learn-numbers.component.html',
  styleUrl: './learn-numbers.component.css',
  animations: learnNumbersAnimations,
})
export class LearnNumbersComponent implements OnInit, OnDestroy {
  LearnMode = LearnMode;
  private readonly route = inject(ActivatedRoute);
  private readonly learnNumbersStore = inject(LearnNumbersStore);
  private readonly audioService = inject(LearnNumbersAudioService);
  private readonly appService = inject(AppService);
  private readonly appStore = inject(AppStore);
  private readonly imagePreloader = inject(ImagePreloaderService);

  numbers = this.learnNumbersStore.numbers;
  learnMode = this.learnNumbersStore.learnMode;
  starterNumbersDetail = this.learnNumbersStore.starterNumbersDetail;

  showNumberDetail = signal(false);
  numberDetailImage = signal<string>('');
  clickedNumber = signal<number | null>(null);

  // 进阶模式下数字太多，分9组，每组10个数字
  group = computed(() => {
    if (this.learnMode() === LearnMode.Advanced) {
      return 9;
    }
    return 1;
  });
  currentGroup = signal<number>(0);
  groupNumbers = computed(() => {
    // 将numbers数组分成9组，每组10个数字
    const groups: number[][] = [];
    for (let i = 0; i < this.group(); i++) {
      groups.push(this.numbers().slice(i * 10, (i + 1) * 10));
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
    // 检查query参数中的模式，如果有则更新store
    this.route.queryParams.subscribe(params => {
      if (params['mode']) {
        const mode = params['mode'] === 'advanced' ? LearnMode.Advanced : LearnMode.Starter;
        this.appStore.setLearnMode(mode);
      }
    });
    
    await this.appService.lockPortrait();
    await this.audioService.preloadWelcome(this.learnMode());
    // Optimization: Only preload number pronunciations initially.
    // Descriptions and meanings are loaded on demand when clicked.
    await Promise.all([
        this.audioService.preloadNumbers(this.numbers()), 
        this.playWelcome()
    ]);
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
      const detail = this.starterNumbersDetail()[number];
      
      // Preload images and audio on demand
      await Promise.all([
        this.imagePreloader.preloadImages([detail.descImg, detail.meaningImg]),
        this.audioService.preloadNumberDesc([number]),
        this.audioService.preloadNumberMeaning([number])
      ]);

      this.showNumberDetail.set(true);
      this.numberDetailImage.set(detail.descImg);
      
      await this.audioService.playNumber(number);
      await this.waitSeconds(0.5);
      await this.audioService.playNumberDesc(number);
      await this.waitSeconds(0.5);
      this.numberDetailImage.set(detail.meaningImg);
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
