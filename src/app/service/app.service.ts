import { computed, inject, Injectable } from "@angular/core";
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { AppStore } from "../store/app.store";

@Injectable({
  providedIn: 'root'
})
export class AppService {
  private readonly appStore = inject(AppStore);

  private isNative = computed(() => this.appStore.platform() !== 'web');

  /**
   * 锁定屏幕为横向
   */
  async lockLandscape() {
    if (!this.isNative()) return;
    try {
      await ScreenOrientation.lock({ orientation: 'landscape' });
    } catch (e) {
      console.error('Failed to lock orientation:', e);
    }
  }

  /**
   * 锁定屏幕为竖向
   */
  async lockPortrait() {
    if (!this.isNative()) return;
    try {
      await ScreenOrientation.lock({ orientation: 'portrait' });
    } catch (e) {
      console.error('Failed to lock orientation:', e);
    }
  }
  async unlockScreen() {
    if (!this.isNative()) return;
    try {
      await ScreenOrientation.unlock();
    } catch (error) {
      console.error('Failed to unlock screen');
    }
  }
}
