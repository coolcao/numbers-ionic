import { inject, Injectable } from "@angular/core";
import { AudioService } from "../../service/audio.service";

@Injectable({
  providedIn: 'root'
})
export class ListenNumberAudioService {
  private readonly audioUri = 'assets/audio';
  private readonly audioService = inject(AudioService);

  async preloadSuccess() {
    await this.audioService.preload('success', `${this.audioUri}/success.mp3`);
  }

  async playSuccess() {
    await this.audioService.play('success');
  }

  async preloadWelcomeAndRules() {
    await Promise.all([
      this.audioService.preload('welcome', `${this.audioUri}/listen-numbers/listen_numbers_welcome.mp3`),
      this.audioService.preload('rules', `${this.audioUri}/listen-numbers/listen_numbers_rules.mp3`),
      this.audioService.preload('start', `${this.audioUri}/listen-numbers/listen_numbers_start.mp3`),
    ]);
  }

  async playWelcomeAndRules() {
    // await this.audioService.play('welcome');
    // await this.audioService.play('rules');
    // await this.audioService.play('start');
    await this.audioService.playSequence(['welcome', 'rules', 'start']);
  }

  async playRightAnswer() {
    await this.audioService.preload('right-answer', `${this.audioUri}/right_answer.mp3`);
    await this.audioService.play('right-answer');
  }

  async playWrongAnswer() {
    await this.audioService.preload('wrong-answer', `${this.audioUri}/wrong_answer.mp3`);
    await this.audioService.play('wrong-answer');
  }

  async playNumber(number: number) {
    await this.audioService.preload(`number-${number}`, `${this.audioUri}/numbers/${number}.mp3`);
    await this.audioService.play(`number-${number}`);
  }

  async stopAll() {
    await this.audioService.stopAll();
  }


}
