import { Injectable, inject } from '@angular/core';
import { AudioService } from 'src/app/service/audio.service';
import { GoodsItem } from 'src/app/store/number-market.store';

@Injectable({
  providedIn: 'root',
})
export class NumberMarketAudioService {
  private audioService = inject(AudioService);

  stopAll() {
    this.audioService.stopAll();
  }

  async playWelcome() {
    await this.audioService.preload(
      'welcome1',
      'assets/audio/number-market/number-market-welcome.mp3',
    );
    await this.audioService.preload(
      'welcome2',
      'assets/audio/number-market/number-market-welcome2.mp3',
    );
    await this.audioService.preload(
      'welcome3',
      'assets/audio/number-market/number-market-welcome3.mp3',
    );
    await this.audioService.play('welcome1');
    await this.audioService.play('welcome2');
    await this.audioService.play('welcome3');
  }

  async playRound(num: number, goodsItem: GoodsItem) {
    this.audioService.stopAll();
    await Promise.all([
      this.audioService.preload('buy1', `assets/audio/number-market/buy1.mp3`),
      this.audioService.preload('buy2', `assets/audio/number-market/buy2.mp3`),
      this.audioService.preload(`${num}`, `assets/audio/numbers/${num}.mp3`),
      this.audioService.preload(
        `${goodsItem.name}`,
        `assets/audio/number-market/goods/${goodsItem.id}.mp3`,
      ),
    ]);
    await this.audioService.play('buy1');
    await this.audioService.play(`${num}`);
    await this.audioService.play('buy2');
    await this.audioService.play(`${goodsItem.name}`);
  }

  async playRoundRight() {
    await this.audioService.preload(
      'round-right',
      'assets/audio/number-market/number-market-round-right.mp3',
    );
    await this.audioService.play('round-right');
  }

  async playRoundWrong() {
    await this.audioService.preload(
      'round-wrong',
      'assets/audio/number-market/number-market-round-wrong.mp3',
    );
    await this.audioService.play('round-wrong');
  }

  async playGameOver() {
    await this.audioService.preload('success', 'assets/audio/success.mp3');
    await this.audioService.play('success');
  }

  async playError() {
    await this.audioService.preload('error', 'assets/audio/error.mp3');
    await this.audioService.play('error');
  }

  async playRight() {
    await this.audioService.preload('right', 'assets/audio/right.mp3');
    await this.audioService.play('right');
  }

  async playClick() {
    this.audioService.play('click');
  }
}
