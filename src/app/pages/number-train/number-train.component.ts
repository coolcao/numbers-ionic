import { Component, computed, effect, inject, linkedSignal, OnInit, Signal, signal, WritableSignal } from '@angular/core';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { LearnMode } from 'src/app/app.types';
import { NumberTrainService } from 'src/app/pages/number-train/number-train.service';
import { AppStore } from 'src/app/store/app.store';
import { NumberTrainStore } from 'src/app/store/number-train.store';

@Component({
  selector: 'app-number-train',
  standalone: false,
  templateUrl: './number-train.component.html',
  styleUrls: ['./number-train.component.css'],
})
export class NumberTrainComponent implements OnInit {

  LearnMode = LearnMode;

  private readonly appStore = inject(AppStore);
  private readonly trainStore = inject(NumberTrainStore);
  private readonly service = inject(NumberTrainService);

  // 所有火车车厢数字
  trainNumbers: WritableSignal<number[]> = signal([]);
  // 目标车厢数字
  targetNumbers: WritableSignal<number[]> = signal([]);

  allTrains = computed(() => {
    return this.trainNumbers().map((num, idx) => {
      return {
        number: num,
        type: idx === 0 ? 'engine' : idx === this.trainNumbers().length - 1 ? 'caboose' : 'car',
      };
    });
  });
  // 目标车厢
  targetTrains = linkedSignal(() => {
    return this.allTrains().filter(train => {
      return this.targetNumbers().includes(train.number);
    });
  });
  // 排列火车车厢
  trains = linkedSignal(() => {
    return this.allTrains().filter(train => {
      return !this.targetNumbers().includes(train.number);
    })
  });

  gameState: Signal<'success' | 'fail' | 'playing' | 'error'> = computed(() => {
    if (this.targetTrains().length === 0) {
      if (this.allTrains().length !== this.trains().length) {
        console.error('程序异常，火车车厢数量不一致');
        return 'error'
      }
      for (let i = 0; i < this.allTrains().length; i++) {
        if (this.allTrains()[i].number !== this.trains()[i].number) {
          return 'fail';
        }
      }
      return 'success';
    }
    return 'playing';
  });



  constructor() {
    effect(() => {
      if (this.gameState() === 'success') {
        console.log('游戏成功');
      } else if (this.gameState() === 'fail') {
        console.log('游戏失败');
      } else if (this.gameState() === 'playing') {
        console.log('游戏进行中');
      } else if (this.gameState() === 'error') {
        console.log('程序异常');
      }
    });
  }

  ngOnInit() {
    const trainNumbers = this.service.generateNumbers(this.trainStore.numbers(), this.trainStore.trainCount());
    const targetNumbers = this.service.generateTargets(trainNumbers, this.trainStore.targetCount());
    this.trainNumbers.set(trainNumbers);
    this.targetNumbers.set(targetNumbers);
  }

  drop(event: CdkDragDrop<any[]>) {
    // 阻止从下方区域向上方区域的拖拽
    if (event.previousContainer.id === 'trains' && event.container.id === 'targetTrains') {
      return;
    }

    // 同区域，不移动
    if (event.previousContainer === event.container) {
      return;
    }
    // 跨区域移动
    const item = event.previousContainer.data[event.previousIndex];

    // 先移除原位置的元素
    event.previousContainer.data.splice(event.previousIndex, 1);
    this.targetTrains.set([...event.previousContainer.data]);

    // 在目标位置插入元素
    event.container.data.splice(event.currentIndex, 0, item);
    this.trains.set([...event.container.data]);

    // 触发变更检测
    // event.container.data = [...event.container.data];
    // event.viousContainer.data = [...event.previousContainer.data];
  }
}
