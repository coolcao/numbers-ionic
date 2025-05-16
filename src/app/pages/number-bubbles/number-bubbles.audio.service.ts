import { inject, Injectable } from "@angular/core";
import { AudioService } from "../../service/audio.service";

@Injectable({
  providedIn: 'root'
})
export class NumberBubblesAudioService {
  private readonly audioService = inject(AudioService);
  private readonly audioUri = 'assets/audio';

  private readonly audioPath = {
    welcome: `${this.audioUri}/number_bubbles/number_bubbles_welcome.mp3`,
    rules: `${this.audioUri}/number_bubbles/number_bubbles_rules.mp3`,
    start: `${this.audioUri}/number_bubbles/number_bubbles_start.mp3`,
    playTarget: `${this.audioUri}/number_bubbles/number_bubbles_play_target.mp3`,
    explode: `${this.audioUri}/number_bubbles/number_bubbles_explode.mp3`,
    success: `${this.audioUri}/success.mp3`
  };

  private async playAudio(audioKey: string) {
    await this.audioService.play(audioKey);
  }
  private async preloadAudio(audioKey: string, path: string) {
    await this.audioService.preload(audioKey, path);
  }

  async playTargetNumbersAudio(numbers: number[]) {
    this.audioService.stopAll();
    await this.preloadAudio('playTarget', this.audioPath.playTarget);
    await this.playAudio('playTarget');
    for (const number of numbers) {
      await this.preloadAudio(`number_${number}`, `${this.audioUri}/numbers/${number}.mp3`);
      await this.playAudio(`number_${number}`);
    }
  }
  async playWelcomeAndRules() {
    this.audioService.stopAll();
    await this.preloadAudio('welcome', this.audioPath.welcome);
    await Promise.all([
      this.playAudio('welcome'),
      this.preloadAudio('rules', this.audioPath.rules),
      this.preloadAudio('start', this.audioPath.start),
    ]);
    await this.playAudio('rules');
    await this.playAudio('start');
  }

  async playExplode() {
    await this.preloadAudio('explode', this.audioPath.explode);
    await this.playAudio('explode');
  }

  async playSuccess() {
    await this.preloadAudio('success', this.audioPath.success);
    await this.playAudio('success');
  }

}
