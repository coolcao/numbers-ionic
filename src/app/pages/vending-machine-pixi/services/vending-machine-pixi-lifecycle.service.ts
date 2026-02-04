import { Injectable } from '@angular/core';
import { Application, Assets } from 'pixi.js';
import { AudioService } from 'src/app/service/audio.service';

@Injectable()
export class VendingMachinePixiLifecycleService {
  async preloadResources(params: {
    audioService: AudioService;
    toyImageCount: number;
  }) {
    const { audioService, toyImageCount } = params;
    const audioPromises = [
      audioService.preload('insert_coin', 'assets/audio/vending-machine/dropping-a-coin.mp3'),
      audioService.preload('checkout_success', 'assets/audio/vending-machine/checkout_success.mp3'),
      audioService.preload('checkout_change', 'assets/audio/vending-machine/change_returned.mp3'),
      audioService.preload('checkout_fail', 'assets/audio/vending-machine/money_not_enough.mp3'),
      audioService.preload('game_success', 'assets/audio/vending-machine/game_success.mp3'),
      audioService.preload('welcome', 'assets/audio/vending-machine/welcome.mp3'),
      audioService.preload('t1', 'assets/audio/vending-machine/t1.mp3'),
      audioService.preload('t2', 'assets/audio/vending-machine/t2.mp3'),
      audioService.preload('t3', 'assets/audio/vending-machine/t3.mp3'),
      audioService.preload('t4', 'assets/audio/vending-machine/t4.mp3'),
      audioService.preload('t5', 'assets/audio/vending-machine/t5.mp3'),
      audioService.preload('t6', 'assets/audio/vending-machine/t6.mp3'),
    ];

    const texturePromises = [];
    for (let i = 1; i <= toyImageCount; i++) {
      texturePromises.push(Assets.load(`assets/images/number-vending/toys/${i}.png`));
    }

    await Promise.all([...audioPromises, ...texturePromises]);
  }

  async initApp(params: {
    pixiContainer: HTMLElement;
    isDarkMode: boolean;
  }) {
    const { pixiContainer, isDarkMode } = params;
    const app = new Application();

    const bgColor = isDarkMode ? '#082F49' : '#ecfeff';
    const width = pixiContainer.clientWidth;
    const height = pixiContainer.clientHeight;

    await app.init({
      background: bgColor,
      backgroundAlpha: 1,
      width: width || window.innerWidth,
      height: height || window.innerHeight,
      resizeTo: pixiContainer,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    pixiContainer.appendChild(app.canvas);
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    return app;
  }

  bindLifecycleHandlers(params: {
    app: Application;
    onRebuild: (reason: 'visibility' | 'context-restored') => void;
  }) {
    const { app, onRebuild } = params;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestAnimationFrame(() => onRebuild('visibility'));
      }
    };

    const onContextLost = (event: any) => {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    };

    const onContextRestored = () => {
      onRebuild('context-restored');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    app.canvas.addEventListener('webglcontextlost', onContextLost, false);
    app.canvas.addEventListener('webglcontextrestored', onContextRestored, false);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      app.canvas.removeEventListener('webglcontextlost', onContextLost, false);
      app.canvas.removeEventListener('webglcontextrestored', onContextRestored, false);
    };
  }
}
