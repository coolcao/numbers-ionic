import { Injectable, signal } from "@angular/core";
import { GoBackState, LearnMode } from "src/app/app.types";

@Injectable({
  providedIn: 'root'
})
export class AppStore {

  private _isDarkMode = signal<boolean>(false);
  private _learnMode = signal<LearnMode>(LearnMode.Starter);
  private _starterNumbers = signal<number[]>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  private _advancedNumbers = signal<number[]>(new Array(90).fill(0).map((_, i) => i + 10));
  private _showHeader = signal<boolean>(true);
  private _showFooter = signal<boolean>(true);
  private _platform = signal<'web' | 'android' | 'ios'>('web');

  readonly learnMode = this._learnMode.asReadonly();
  readonly starterNumbers = this._starterNumbers.asReadonly();
  readonly advancedNumbers = this._advancedNumbers.asReadonly();
  readonly isDarkMode = this._isDarkMode.asReadonly();
  readonly platform = this._platform.asReadonly();
  readonly showHeader = this._showHeader.asReadonly();
  readonly showFooter = this._showFooter.asReadonly();

  setLearnMode(mode: LearnMode) {
    this._learnMode.set(mode);
  }

  setDarkMode(isDarkMode: boolean) {
    this._isDarkMode.set(isDarkMode);
  }

  setPlatform(platform: 'web' | 'android' | 'ios') {
    this._platform.set(platform);
  }

  setShowHeader(showHeader: boolean) {
    this._showHeader.set(showHeader);
  }
  setShowFooter(showFooter: boolean) {
    this._showFooter.set(showFooter);
  }

}
