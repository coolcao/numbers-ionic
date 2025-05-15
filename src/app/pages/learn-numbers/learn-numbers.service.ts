import { inject, Injectable } from "@angular/core";
import { AudioService } from "../../service/audio.service";
import { LearnMode } from "../../app.types";

@Injectable({
  providedIn: 'root'
})
export class LearnNumbersAudioService {
  private readonly audioUri = 'assets/audio';
  private readonly audioService = inject(AudioService);

  async preloadWelcome(mode: LearnMode) {
    if (mode === LearnMode.Starter) {
      await this.audioService.preload('welcome', `${this.audioUri}/learn-numbers/starter-welcome.mp3`);
      await this.audioService.preload('description', `${this.audioUri}/learn-numbers/starter-description.mp3`);
    }
    else if (mode === LearnMode.Advanced) {
      await this.audioService.preload('welcome', `${this.audioUri}/learn-numbers/advanced-welcome.mp3`);
      await this.audioService.preload('description', `${this.audioUri}/learn-numbers/advanced-description.mp3`);
    }
  }
  async playWelcome(mode: LearnMode) {
    if (mode === LearnMode.Starter) {
      await this.audioService.playSequence(['welcome', 'description']);
    }
    else if (mode === LearnMode.Advanced) {
      await this.audioService.playSequence(['welcome', 'description']);
    }
  }

  async preloadNumbers(numbers: number[]) {
    const p = [];
    for (const number of numbers) {
      p.push(this.audioService.preload(`number-${number}`, `${this.audioUri}/numbers/${number}.mp3`));
    }

    await Promise.all(p);
  }

  async preloadNumberDesc(numbers: number[]) {
    const p = [];
    for (const number of numbers) {
      if (number < 10) {
        p.push(this.audioService.preload(`${number}_desc`, `${this.audioUri}/learn-numbers/${number}_desc.mp3`));
      }
    }
    await Promise.all(p);
  }
  async preloadNumberMeaning(numbers: number[]) {
    const p = [];
    for (const number of numbers) {
      if (number < 10) {
        p.push(this.audioService.preload(`${number}_meaning`, `${this.audioUri}/learn-numbers/${number}_meaning.mp3`));
      }
    }
    await Promise.all(p);
  }
  async playNumber(number: number) {
    await this.audioService.play(`number-${number}`);
  }
  async playNumberDesc(number: number) {
    if (number < 10) {
      await this.audioService.play(`${number}_desc`);
    }
  }
  async playNumberMeaning(number: number) {
    if (number < 10) {
      await this.audioService.play(`${number}_meaning`);
    }
  }

  stopAll() {
    this.audioService.stopAll();
  }

}
