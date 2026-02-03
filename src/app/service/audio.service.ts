// audio.service.ts
import { Injectable } from '@angular/core';
import { Howl, Howler } from 'howler';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private sounds = new Map<string, Howl>();

  // 停止所有声音
  stopAll() {
    Howler.stop();
  }

  // 全局音量控制
  setVolume(volume: number) {
    Howler.volume(volume);
  }

  // 预加载音频（返回Promise）
  async preload(key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const howl = new Howl({
        src: [url],
        preload: true,
        onload: () => resolve(),
        onloaderror: (id, error) => reject(error)
      });
      this.sounds.set(key, howl);
    });
  }

  // 播放音频并返回Promise
  async play(key: string, options: { interrupt?: boolean, loop?: boolean, volume?: number } = {}): Promise<void> {
    // 默认策略：播放新音频前停止所有正在播放的音频
    // 除非 options.interrupt 显式设置为 false (虽然目前没有用到，但保留灵活性)
    if (options.interrupt !== false) {
      this.stopAll();
    }

    return new Promise((resolve, reject) => {
      const sound = this.sounds.get(key);
      if (!sound) {
        return reject(`Sound ${key} not found`);
      }

      if (options.loop) {
        sound.loop(true);
      }

      if (options.volume) {
        sound.volume(0.5);
      }


      const soundId = sound.play();

      sound.once('end', () => resolve());
      sound.once('stop', () => resolve());
      sound.once('playerror', (id, error) => reject(error));
    });
  }

  // 顺序播放多个音频
  async playSequence(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.play(key);
    }
  }
}
