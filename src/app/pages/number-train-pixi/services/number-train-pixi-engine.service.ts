import { ElementRef, Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Application, Container, Graphics } from 'pixi.js';
import { Subject } from 'rxjs';

import { AppStore } from 'src/app/store/app.store';
import { AppService } from 'src/app/service/app.service';

@Injectable({
  providedIn: 'root'
})
export class NumberTrainPixiEngineService {
  app!: Application;
  mainContainer!: Container;

  public resize$ = new Subject<void>();

  // Background
  private backgroundGraphics!: Graphics;

  public isMobile = false;
  public isTablet = false;

  readonly appStore = inject(AppStore);
  readonly appService = inject(AppService);

  async init(container: ElementRef) {
    this.detectDevice();
    this.app = new Application();
    const isDarkMode = this.appStore.isDarkMode();
    const backgroundColor = isDarkMode ? 0x082f49 : 0xecfeff;

    await this.app.init({
      resizeTo: container.nativeElement,
      backgroundColor: backgroundColor,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    container.nativeElement.appendChild(this.app.canvas);

    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    this.mainContainer = new Container();
    // Allow zIndex sorting so dragged items/highlights can appear above others
    this.mainContainer.sortableChildren = true;
    this.app.stage.addChild(this.mainContainer);

    this.backgroundGraphics = new Graphics();
    this.mainContainer.addChild(this.backgroundGraphics);
    this.updateBackgroundColor(backgroundColor);

    window.addEventListener('resize', () => this.onResize());
  }

  updateBackgroundColor(color: number) {
    if (this.backgroundGraphics && this.app) {
      this.backgroundGraphics.clear();
      this.backgroundGraphics.rect(0, 0, this.app.screen.width, this.app.screen.height);
      this.backgroundGraphics.fill({ color });
    }
  }

  onResize() {
    if (!this.app) return;
    this.app.stage.hitArea = this.app.screen;

    // Update background
    const isDarkMode = this.appStore.isDarkMode();
    const backgroundColor = isDarkMode ? 0x082f49 : 0xecfeff;
    this.updateBackgroundColor(backgroundColor);

    this.resize$.next();
  }

  resize() {
    if (this.app) {
      this.app.resize();
      this.onResize();
    }
  }

  destroy() {
    if (this.app) {
      try {
        // Do not destroy textures as they are cached by Assets and reused by singleton service
        this.app.destroy(true, { children: true, texture: false });
      } catch (e) {
        console.warn('Error destroying Pixi app', e);
      }
    }
    // Remove listeners if any specific bound ones (arrow function above handles it for this instance if kept alive?)
    // Note: arrow function in addEventListener is hard to remove unless reference saved.
    // Ideally we should save the bound function.
    // For now simple destroy is okay as service is singleton? 
    // Wait, service is 'root' but component destroys app. 
    // The service might persist. We should clean up properly.
  }

  // ... inside class
  getPlatform() {
    if (Capacitor.isNativePlatform()) {
      if (Capacitor.getPlatform() === 'android') {
        return 'android';
      } else if (Capacitor.getPlatform() === 'ios') {
        return 'ios';
      }
    }
    return 'web';
  }

  detectDevice() {
    const platform = this.getPlatform();
    let type = 'desktop';

    if (platform === 'web') {
      const userAgent = navigator.userAgent.toLowerCase();
      const isTabletDevice = /ipad|android(?!.*mobile)|tablet/i.test(userAgent) || (navigator.maxTouchPoints > 1 && /macintosh/.test(userAgent));
      const isMobileDevice = /mobile|iphone|ipod|android.*mobile|blackberry|opera mini|iemobile/i.test(userAgent);

      if (isTabletDevice) type = 'tablet';
      else if (isMobileDevice) type = 'mobile';
    } else if (platform === 'ios' || platform === 'android') {
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const minDimension = Math.min(screenWidth, screenHeight);

      if (platform === 'ios' && /ipad/.test(navigator.userAgent.toLowerCase())) {
        type = 'tablet';
      } else if (platform === 'android' && minDimension >= 768) {
        type = 'tablet';
      } else {
        const maxDimension = Math.max(screenWidth, screenHeight);
        const aspectRatio = maxDimension / minDimension;
        if (aspectRatio > 1.3 && aspectRatio < 1.7 && minDimension >= 600) {
          type = 'tablet';
        } else {
          type = 'mobile';
        }
      }
    }

    if (type === 'mobile') {
      this.isMobile = true;
    } else if (type === 'tablet') {
      this.isMobile = true;
      this.isTablet = true;
    }
  }

  get width() {
    return this.app?.renderer ? this.app.screen.width : 0;
  }
  // ...

  get height() {
    return this.app?.renderer ? this.app.screen.height : 0;
  }
}
