import { Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root',
})
export class NumberTrainService {
  constructor() { }


  /**
   * 从给定的数字数组中生成n个连续数字
   * @param from 给定的数字数组，from数组要求升序排列且连续
   * @param n 要生成连续数字的个数
   */
  generateNumbers(from: number[], n: number) {
    if (from.length === 0 || n <= 0) return [];
    if (from.length < n) return [];

    const start = Math.floor(Math.random() * (from.length - n + 1));

    const result: number[] = [];

    for (let i = start; i < n + start; i++) {
      result.push(from[i]);
    }
    return result;
  }

  /**
 * 从from数组中随机生成targetCount个数字作为目标数字
 * @param from 随机生成目标数字的数组
 * @param targetCount 目标数字个数
 * @param strategy 生成策略：'unique'（唯一值）| 'sequential'（连续值）| 'any'（允许重复）
 */
  generateTargets(
    from: number[],
    targetCount: number,
    strategy: 'unique' | 'sequential' | 'any' = 'unique'
  ): number[] {
    // 边界条件处理
    if (targetCount <= 0) return [];
    if (from.length === 0) return [];

    // 不同生成策略实现
    switch (strategy) {
      case 'unique':
        return this.getUniqueRandomElements(from, targetCount);

      case 'sequential':
        return this.getSequentialElements(from, targetCount);

      case 'any':
        return this.getRandomElementsWithDuplicates(from, targetCount);

      default:
        throw new Error('Invalid strategy');
    }
  }

  /**
   * 计算两个数组的差异数组，即arr1 - arr2
   * @param arr1 第一个数组
   * @param arr2 第二个数组
   * @returns 差异数组
   */
  numbersDiff(arr1: number[], arr2: number[]) {
    return arr1.filter((x) => !arr2.includes(x));
  }


  // 辅助方法：获取唯一随机元素
  private getUniqueRandomElements(arr: number[], count: number): number[] {
    if (count > arr.length) {
      throw new Error(`Cannot get ${count} unique elements from array of length ${arr.length}`);
    }

    // Fisher-Yates洗牌算法
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
  }

  // 辅助方法：获取连续随机元素
  private getSequentialElements(arr: number[], count: number): number[] {
    if (count > arr.length) {
      throw new Error(`Sequence length ${count} exceeds array length ${arr.length}`);
    }

    const start = Math.floor(Math.random() * (arr.length - count + 1));
    return arr.slice(start, start + count);
  }

  // 辅助方法：允许重复的随机元素
  private getRandomElementsWithDuplicates(arr: number[], count: number): number[] {
    return Array.from({ length: count }, () => {
      const randomIndex = Math.floor(Math.random() * arr.length);
      return arr[randomIndex];
    });
  }

}
