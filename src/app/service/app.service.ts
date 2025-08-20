import { Injectable } from "@angular/core";
import { ScreenOrientation } from '@capacitor/screen-orientation';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  /**
   * 锁定屏幕为横向
   */
  async lockLandscape() {
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
    try {
      await ScreenOrientation.lock({ orientation: 'portrait' });
    } catch (e) {
      console.error('Failed to lock orientation:', e);
    }
  }
  async unlockScreen() {
    try {
      await ScreenOrientation.unlock();
    } catch (error) {
      console.error('Failed to unlock screen');
    }
  }
}
