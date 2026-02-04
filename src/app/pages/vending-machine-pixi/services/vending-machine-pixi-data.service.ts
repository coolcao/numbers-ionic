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

    let prices: number[] = [];
    const count = selectedIds.length; // 实际生成的数量

    if (this.mode === 'simple') {
      // 简单模式：价格 1~9
      for (let k = 0; k < count; k++) {
        // 简单的分布：1-3, 4-6, 7-9 均匀分布
        const tier = k % 3;
        const price = Math.floor(Math.random() * 3) + 1 + (tier * 3);
        prices.push(price);
      }
      prices.sort(() => 0.5 - Math.random());
    } else {
      prices = Array.from({ length: count }, () => Math.floor(Math.random() * 90) + 10);
    }

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
  }
}
