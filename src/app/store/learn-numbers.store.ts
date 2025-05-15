import { computed, inject, Injectable, signal } from "@angular/core";
import { LearnMode, StarterNumberInfo } from "src/app/app.types";
import { AppStore } from "src/app/store/app.store";

@Injectable({
  providedIn: 'root'
})
export class LearnNumbersStore {
  private appStore = inject(AppStore);

  learnMode = computed(() => this.appStore.learnMode());

  // 入门版数字详情描述
  starterNumbersDetail = signal<StarterNumberInfo[]>([
    { desc: '0像鸡蛋做蛋糕', descImg: 'assets/images/learn-numbers/0.jpg', meaningAudio: 'assets/audio/learn-numbers/0_meaning.mp3', meaningImg: 'assets/images/learn-numbers/meaning/0_meaning.jpg' },
    { desc: '1像树枝细又长', descImg: 'assets/images/learn-numbers/1.jpg', meaningAudio: 'assets/audio/learn-numbers/1_meaning.mp3', meaningImg: 'assets/images/learn-numbers/meaning/1_meaning.jpg' },
    { desc: '2像鸭子水上飘', descImg: 'assets/images/learn-numbers/2.jpg', meaningAudio: 'assets/audio/learn-numbers/2_meaning.mp3', meaningImg: 'assets/images/learn-numbers/meaning/2_meaning.jpg' },
    { desc: '3像一只右耳朵', descImg: 'assets/images/learn-numbers/3.jpg', meaningAudio: 'assets/audio/learn-numbers/3_meaning.mp3', meaningImg: 'assets/images/learn-numbers/meaning/3_meaning.jpg' },
    { desc: '4像红旗随风飘', descImg: 'assets/images/learn-numbers/4.jpg', meaningAudio: 'assets/audio/learn-numbers/4_meaning.mp3', meaningImg: 'assets/images/learn-numbers/meaning/4_meaning.jpg' },
    { desc: '5像秤钩来卖菜​', descImg: 'assets/images/learn-numbers/5.jpg', meaningAudio: 'assets/audio/learn-numbers/5_meaning.mp3', meaningImg: 'assets/images/learn-numbers/meaning/5_meaning.jpg' },
    { desc: '6像豆芽开心笑​', descImg: 'assets/images/learn-numbers/6.jpg', meaningAudio: 'assets/audio/learn-numbers/6_meaning.mp3', meaningImg: 'assets/images/learn-numbers/meaning/6_meaning.jpg' },
    { desc: '7像镰刀割小麦​', descImg: 'assets/images/learn-numbers/7.jpg', meaningAudio: 'assets/audio/learn-numbers/7_meaning.mp3', meaningImg: 'assets/images/learn-numbers/meaning/7_meaning.jpg' },
    { desc: '8像两个甜甜圈​', descImg: 'assets/images/learn-numbers/8.jpg', meaningAudio: 'assets/audio/learn-numbers/8_meaning.mp3', meaningImg: 'assets/images/learn-numbers/meaning/8_meaning.jpg' },
    { desc: '9像蝌蚪小尾巴', descImg: 'assets/images/learn-numbers/9.jpg', meaningAudio: 'assets/audio/learn-numbers/9_meaning.mp3', meaningImg: 'assets/images/learn-numbers/meaning/9_meaning.jpg' }
  ])

  numbers = computed(() => {
    if (this.learnMode() === LearnMode.Starter) {
      return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    }
    if (this.learnMode() === LearnMode.Advanced) {
      const nums = [];
      for (let i = 10; i < 100; i++) {
        nums.push(i);
      }
      return nums;
    }
    return [];
  });




}
