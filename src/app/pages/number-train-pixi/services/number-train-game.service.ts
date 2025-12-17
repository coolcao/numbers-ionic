import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { Subject } from 'rxjs';
import { TrainPart } from '../number-train.types';
import { AppStore } from 'src/app/store/app.store';
import { NumberTrainStore } from 'src/app/store/number-train.store';
import { NumberTrainService } from 'src/app/pages/number-train/number-train.service';

@Injectable({
  providedIn: 'root'
})
export class NumberTrainGameService {
  // Tutorial flag to control flow and counters
  private tutorialMode = false;
  private appStore = inject(AppStore);
  private logicService = inject(NumberTrainService);
  private trainStore = inject(NumberTrainStore);

  // Game State
  trainNumbers: WritableSignal<number[]> = signal([]);
  targetNumbers: WritableSignal<number[]> = signal([]);

  topTrains: WritableSignal<TrainPart[]> = signal([]);
  bottomTrains: WritableSignal<TrainPart[]> = signal([]);

  gameState: WritableSignal<'playing' | 'finished' | 'animating'> = signal('playing');

  totalRound = signal(5);
  currentRound = signal(0);
  correctRound = signal(0);
  roundFinished = signal(false);

  // Event Bus for effects/animations and tutorial signals
  event$ = new Subject<{ type: 'success' | 'error' | 'next_round' | 'tutorial_drag' | 'tutorial_drag_end', payload?: any }>();

  initGame(options: { tutorial?: boolean } = { tutorial: false }) {
    // Switch tutorial mode and reset counters; tutorial rounds don't count
    this.tutorialMode = !!options?.tutorial;
    this.currentRound.set(0);
    this.correctRound.set(0);
    this.gameState.set('playing');
    // Start first round with internal tutorial flag having effect
    this.playNextRound();
  }

  playNextRound() {
    this.roundFinished.set(false);
    this.gameState.set('playing');

    let trainNumbers = this.logicService.generateNumbers(
      this.trainStore.numbers(),
      this.trainStore.trainCount(),
    );
    let targetNumbers = this.logicService.generateTargets(
      trainNumbers,
      this.trainStore.targetCount(),
    );

    if (!trainNumbers || trainNumbers.length === 0) {
      console.error('Failed to generate train numbers! Store might be empty or uninitialized. Using fallback [1,2,3,4,5].');
      trainNumbers = [1, 2, 3, 4, 5];
      targetNumbers = [3];
    }

    // 教程使用指定数字
    if (this.tutorialMode) {
      trainNumbers = [1, 2, 3, 4, 5];
      targetNumbers = [3];
    }

    this.trainNumbers.set(trainNumbers);
    this.targetNumbers.set(targetNumbers);
    // 教程不计入轮次
    if (!this.tutorialMode) {
      this.currentRound.update((r) => r + 1);
    }

    // Prepare Data
    const allTrains: TrainPart[] = trainNumbers.map((num, idx) => ({
      id: Math.random().toString(36).substr(2, 9),
      number: num,
      type:
        idx === 0
          ? 'engine'
          : idx === trainNumbers.length - 1
            ? 'caboose'
            : 'car',
    }));

    // Filter
    const top = allTrains.filter((t) => targetNumbers.includes(t.number));
    const bottom = allTrains.filter((t) => !targetNumbers.includes(t.number));

    this.topTrains.set(top);
    this.bottomTrains.set(bottom);

    // Notify scene to update (if needed, or just let signals drive it)
    this.event$.next({ type: 'next_round' });
  }

  checkRound() {
    // Basic check logic
    const bottom = this.bottomTrains();
    const correctSequence = this.trainNumbers();

    let isCorrect = true;
    if (bottom.length !== correctSequence.length) {
      isCorrect = false;
    } else {
      for (let i = 0; i < bottom.length; i++) {
        if (bottom[i].number !== correctSequence[i]) {
          isCorrect = false;
          break;
        }
      }
    }

    if (isCorrect) {
      if (!this.tutorialMode) {
        this.correctRound.update((r) => r + 1);
      }
      this.gameState.set('animating'); // Lock interaction
      this.event$.next({ type: 'success' }); // Trigger animation
    } else {
      this.event$.next({ type: 'error' }); // Trigger shake/sound
    }

    if (this.currentRound() >= this.totalRound()) {
      // We typically wait for animation to finish before showing modal?
      // But for now we set finished here or after animation?
      // Original code set 'finished' immediately if round count met.
      // Actually original updated 'finished' state at end.
      // I'll let the animation complete handler call 'finishCheck'?
    }
  }

  // Called after success animation completes
  onRoundComplete() {
    // 教程模式下，完成一轮后切换到正式游戏第一轮
    if (this.tutorialMode) {
      this.tutorialMode = false;
      // 重置目标为正式模式
      this.playNextRound();
      return;
    }
    if (this.currentRound() >= this.totalRound()) {
      this.gameState.set('finished');
    } else {
      this.playNextRound();
    }
  }

  get learnMode() {
    return this.appStore.learnMode;
  }

  // Expose tutorial mode for UI/drag visuals gating
  isTutorialMode() {
    return this.tutorialMode;
  }
}
