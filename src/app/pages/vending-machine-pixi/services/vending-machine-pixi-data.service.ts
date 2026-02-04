import { Injectable } from '@angular/core';
import { Container } from 'pixi.js';

export interface Toy {
  id: number;
  name: string;
  price: number;
  color: number; // Hex color
  sprite?: Container;
  imageId: number; // 1-9
  innerScale?: number;
}

@Injectable()
export class VendingMachinePixiDataService {
  mode: 'simple' | 'hard' = 'simple';
  toys: Toy[] = [];
  selectedToy: Toy | null = null;
  currentBalance = 0;

  purchasedCount = 0;
  readonly maxPurchaseCount = 5;
  purchasedImageIds: number[] = [];

  setMode(mode: 'simple' | 'hard') {
    this.mode = mode;
  }

  resetRound() {
    this.selectedToy = null;
    this.currentBalance = 0;
  }

  clearToys() {
    this.toys = [];
  }

  buildToys(toyImageCount: number, bgColors: number[]) {
    // 1. 生成所有可用 ID
    let allIds = Array.from({ length: toyImageCount }, (_, k) => k + 1);

    // 2. 排除已购买的 ID
    allIds = allIds.filter(id => !this.purchasedImageIds.includes(id));

    // 3. 洗牌
    for (let i = allIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
    }

    // 4. 选取前 9 个（如果不够 9 个，就取全部）
    const selectedIds = allIds.slice(0, 9);

    const count = selectedIds.length;
    const prices = this.mode === 'simple'
      ? this.pickUniquePrices(count, 1, 9)
      : this.pickUniquePrices(count, 10, 99);

    this.toys = [];
    for (let i = 0; i < count; i++) {
      const toyData: Toy = {
        id: i,
        name: `Toy ${i}`,
        price: prices[i],
        color: bgColors[i % bgColors.length],
        imageId: selectedIds[i]
      };
      this.toys.push(toyData);
    }

    // 按价格随机排序放置
    this.shuffle(this.toys);
  }

  private pickUniquePrices(count: number, min: number, max: number) {
    const range = max - min + 1;
    const cappedCount = Math.min(count, range);
    const pool = Array.from({ length: range }, (_, i) => min + i);
    this.shuffle(pool);
    return pool.slice(0, cappedCount);
  }

  private shuffle<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
