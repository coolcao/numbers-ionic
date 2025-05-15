import { computed, inject, Injectable, signal } from "@angular/core";
import { LearnMode } from "src/app/app.types";
import { AppStore } from "src/app/store/app.store";

@Injectable({
  providedIn: 'root'
})
export class ListenNumbersStore {
  private readonly store = inject(AppStore);
  // 进阶模式下，数字的数量
  private readonly _size = signal(20);

  readonly learnMode = this.store.learnMode;
  readonly size = this._size.asReadonly();


  readonly numbers = computed(() => {
    if (this.learnMode() === LearnMode.Starter) {
      const numbers = [...this.store.starterNumbers()];
      // 使用 Fisher-Yates 洗牌算法对数组进行随机排序
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }
      return numbers;
    }

    if (this.learnMode() === LearnMode.Advanced) {
      const numbers = [...this.store.advancedNumbers()];
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }
      return numbers.splice(0, this.size());
    }
    return [];
  });
}
