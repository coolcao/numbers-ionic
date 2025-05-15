import { Injectable, signal } from "@angular/core";
import { LearnMode } from "src/app/app.types";

@Injectable({
  providedIn: 'root'
})
export class AppStore {

  private _learnMode = signal<LearnMode>(LearnMode.Starter);
  private _starterNumbers = signal<number[]>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  private _advancedNumbers = signal<number[]>(new Array(90).fill(0).map((_, i) => i + 10));

  readonly learnMode = this._learnMode.asReadonly();
  readonly starterNumbers = this._starterNumbers.asReadonly();
  readonly advancedNumbers = this._advancedNumbers.asReadonly();

  setLearnMode(mode: LearnMode) {
    this._learnMode.set(mode);
  }


}
