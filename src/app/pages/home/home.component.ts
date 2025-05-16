import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppStore } from '../../store/app.store';
import { LearnMode } from '../../app.types';
import { AudioService } from '../../service/audio.service';
import { ImagePreloaderService } from '../../image-preloader.service';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  LearnMode = LearnMode;

  private readonly audioUri = 'assets/audio';

  private readonly router = inject(Router);
  private readonly store = inject(AppStore);
  private readonly audioService = inject(AudioService);
  private readonly imagePreloader = inject(ImagePreloaderService);

  learnMode = this.store.learnMode;

  resourceLoading = false;

  private preLoadImage() {
    this.resourceLoading = true;

    const imageUrls = [];
    for (let i = 0; i < 10; i++) {
      imageUrls.push(`assets/images/learn-numbers/${i}.jpg`);
      imageUrls.push(`assets/images/learn-numbers/meaning/${i}_meaning.jpg`);
    }

    this.imagePreloader.preloadImages(imageUrls).then(success => {
      if (success) {
        this.resourceLoading = false;
        console.log('所有图片已成功加载');
      } else {
        console.error('图片预加载失败');
      }
    }).catch(error => {
      console.error('图片预加载错误:', error);
    })
  }
  private async preloadAudio() {
    await Promise.all([
      this.audioService.preload('welcome', `${this.audioUri}/home/home_welcome.mp3`),
      this.audioService.preload('start', `${this.audioUri}/home/home_start.mp3`),
    ]);
  }
  private async playWelcomeAudio() {
    await this.audioService.play('welcome');
    await this.audioService.play('start');
  }

  async ngOnInit(): Promise<void> {
    this.preLoadImage();
    await this.preloadAudio();
    await this.playWelcomeAudio();
  }
  ngOnDestroy(): void {
    this.audioService.stopAll();
  }

  goToLearn() {
    this.audioService.stopAll();
    this.router.navigate(['learn-numbers']);
  }
  goToListen() {
    this.audioService.stopAll();
    this.router.navigate(['listen-numbers']);
  }
  goToBubbles() {
    this.audioService.stopAll();
    this.router.navigate(['number-bubbles']);
  }

  changeLearnMode(mode: LearnMode) {
    this.store.setLearnMode(mode);
  }
}
