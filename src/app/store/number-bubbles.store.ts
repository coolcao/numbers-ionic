import { computed, inject, Injectable, signal } from "@angular/core";
import { AppStore } from "src/app/store/app.store";

@Injectable({
  providedIn: 'root'
})
export class NumberBubblesStore {
  private appStore = inject(AppStore);

  size = computed(() => this.appStore.learnMode() === 'starter' ? 10 : 30);
  learnMode = computed(() => this.appStore.learnMode());

  // 数字泡泡游戏采用定时的方式，入门模式时间为 15s， 进阶模式为 30s
  gameDuration = computed(() => this.learnMode() === 'starter' ? 15 : 30);

  // 数字泡泡的数字范围，入门模式为 0-9， 进阶模式为 10-99中随机取30个数字
  numbers = computed(() => {
    if (this.learnMode() === 'starter') {
      const numbers = [...this.appStore.starterNumbers()];
      // 使用 Fisher-Yates 洗牌算法对数组进行随机排序
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }
      return numbers;
    }
    if (this.learnMode() === 'advanced') {
      const numbers = [...this.appStore.advancedNumbers()];
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }
      return numbers.splice(0, this.size());
    }
    return [];
  })


}
