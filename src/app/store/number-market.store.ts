import { computed, inject, Inject, Injectable, signal, WritableSignal } from "@angular/core";
import { LearnMode } from "src/app/app.types";
import { AppStore } from "src/app/store/app.store";

export interface GoodsItem {
  id: string;
  name: string;
  image: string;
  amount: number;
  selected?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NumberMarketStore {
  store = inject(AppStore);

  readonly numbers = computed(() => {
    if (this.store.learnMode() === LearnMode.Starter) {
      return this.store.starterNumbers();
    }
    if (this.store.learnMode() === LearnMode.Advanced) {
      return this.store.advancedNumbers();
    }
    return [];
  });

  readonly goods: WritableSignal<GoodsItem[]> = signal([
    { id: 'red-apple', name: '红苹果', image: '🍎', amount: 1 },
    { id: 'green-apple', name: '绿苹果', image: '🍏', amount: 1 },
    { id: 'banana', name: '香蕉', image: '🍌', amount: 1 },
    { id: 'orange', name: '橘子', image: '🍊', amount: 1 },
    { id: 'pear', name: '梨', image: '🍐', amount: 1 },
    { id: 'grape', name: '葡萄', image: '🍇', amount: 1 },
    { id: 'watermelon', name: '西瓜', image: '🍉', amount: 1 },
    { id: 'pineapple', name: '菠萝', image: '🍍', amount: 1 },
    { id: 'strawberry', name: '草莓', image: '🍓', amount: 1 },
    { id: 'cherry', name: '樱桃', image: '🍒', amount: 1 },
    { id: 'mango', name: '芒果', image: '🥭', amount: 1 },
    { id: 'lemon', name: '柠檬', image: '🍋', amount: 1 },
    { id: 'peach', name: '桃子', image: '🍑', amount: 1 },
    { id: 'avocado', name: '鳄梨', image: '🥑', amount: 1 },
    { id: 'kiwi', name: '猕猴桃', image: '🥝', amount: 1 },
    { id: 'corn', name: '玉米', image: '🌽', amount: 1 },
    { id: 'potato', name: '土豆', image: '🥔', amount: 1 },
    { id: 'carrot', name: '胡萝卜', image: '🥕', amount: 1 },
    { id: 'broccoli', name: '西兰花', image: '🥦', amount: 1 },
    { id: 'tomato', name: '西红柿', image: '🍅', amount: 1 },
    { id: 'cucumber', name: '黄瓜', image: '🥒', amount: 1 },
    { id: 'bell-pepper', name: '辣椒', image: '🌶️', amount: 1 },
    { id: 'onion', name: '洋葱', image: '🧅', amount: 1 },
    { id: 'garlic', name: '大蒜', image: '🧄', amount: 1 },
    { id: 'melon', name: '甜瓜', image: '🍈', amount: 1 },
    { id: 'cabbage', name: '绿叶蔬菜', image: '🥬', amount: 1 },
    { id: 'peanut', name: '花生', image: '🥜', amount: 1 },
  ]);


}
