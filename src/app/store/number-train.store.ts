import { computed, inject, Injectable, signal } from "@angular/core";
import { LearnMode } from "src/app/app.types";
import { AppStore } from "src/app/store/app.store";

@Injectable({
  providedIn: 'root'
})
export class NumberTrainStore {
  private readonly appStore = inject(AppStore);
  private readonly learnMode = this.appStore.learnMode;
  // 火车车厢数量，即连续数字的个数
  private readonly _trainCount = signal(5);     // 建议 5~8
  private readonly _targetCount = signal(1);    // 建议 1~3

  readonly trainCount = this._trainCount.asReadonly();
  readonly targetCount = this._targetCount.asReadonly();

  readonly numbers = computed(() => {
    if (this.learnMode() === LearnMode.Starter) {
      return this.appStore.starterNumbers();
    } else if (this.learnMode() === LearnMode.Advanced) {
      return this.appStore.advancedNumbers();
    }
    return [];
  });


  setTargetCount(count: number) {
    this._targetCount.set(count);
  }
  setTrainCount(count: number) {
    this._trainCount.set(count);
  }



}
