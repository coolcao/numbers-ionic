import { inject, Injectable } from "@angular/core";
import { AppStore } from "src/app/store/app.store";
import { GoodsItem, NumberMarketStore } from "src/app/store/number-market.store";

@Injectable({
  providedIn: 'root'
})
export class NumberMarketService {
  store = inject(AppStore);
  marketStore = inject(NumberMarketStore);
  constructor() {
  }

  /**
   * 随机生成数量为count的一组商品
   * @param count 获取随机商品数量
   * @returns
   */
  private getRandomGoods(count: number): GoodsItem[] {
    const length = this.marketStore.goods().length;
    // 用于存储已选择的商品索引
    const selectedIndexes = new Set<number>();
    const result: GoodsItem[] = [];
    const goodsLength = this.marketStore.goods().length;

    // 如果请求的商品数量大于总商品数量，取总商品数量
    const actualCount = Math.min(count, goodsLength);

    while (selectedIndexes.size < actualCount) {
      const randomIndex = Math.floor(Math.random() * goodsLength);
      if (!selectedIndexes.has(randomIndex)) {
        selectedIndexes.add(randomIndex);
        result.push(this.marketStore.goods()[randomIndex]);
      }
    }
    return result;
  }

  private targetNumber(): number {
    const length = this.marketStore.numbers().length;
    let randomIndex = Math.floor(Math.random() * length);
    let num = this.marketStore.numbers()[randomIndex];
    while (num === 0) {
      randomIndex = Math.floor(Math.random() * length);
      num = this.marketStore.numbers()[randomIndex];
    }
    return num;
  }

  init(goodsCount: number) {
    const targetNumber = this.targetNumber();
    const goods = this.getRandomGoods(goodsCount);
    // 随机从goods中选择一个商品作为目标商品
    const targetGoods = goods[Math.floor(Math.random() * goods.length)];
    return {
      targetNumber,
      targetGoods,
      goods
    }
  }

}
