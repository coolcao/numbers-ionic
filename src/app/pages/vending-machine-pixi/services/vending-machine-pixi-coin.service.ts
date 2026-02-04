import { Injectable } from '@angular/core';
import { Application, Graphics, Ticker } from 'pixi.js';
import { AudioService } from 'src/app/service/audio.service';
import { VendingMachinePixiDataService } from './vending-machine-pixi-data.service';
import { VendingMachinePixiGameService } from './vending-machine-pixi-game.service';
import { VendingMachinePixiSceneService } from './vending-machine-pixi-scene.service';

@Injectable()
export class VendingMachinePixiCoinService {
  spawnDraggableCoin(params: {
    app: Application;
    value: number;
    globalX: number;
    globalY: number;
    scale: number;
    isProcessing: boolean;
    dataService: VendingMachinePixiDataService;
    audioService: AudioService;
    sceneService: VendingMachinePixiSceneService;
    gameService: VendingMachinePixiGameService;
    coinSlotZone: Graphics;
    onUpdateDisplay: () => void;
    onCoinDrop?: () => void;
    playAudio?: boolean;
  }) {
    const {
      app,
      value,
      globalX,
      globalY,
      scale,
      isProcessing,
      dataService,
      audioService,
      sceneService,
      coinSlotZone,
      onUpdateDisplay,
      onCoinDrop,
      playAudio,
    } = params;

    if (isProcessing || !dataService.selectedToy) {
      if (!dataService.selectedToy) audioService.play('checkout_fail', { interrupt: false });
      return;
    }

    const coin = sceneService.drawCoinGraphics(value);
    coin.scale.set(scale * 1.2);
    coin.position.set(globalX, globalY);
    coin.alpha = 0.9;

    coin.eventMode = 'dynamic';
    coin.cursor = 'grabbing';

    let isDragging = true;

    const onMove = (e: any) => {
      if (isDragging) {
        coin.position.set(e.global.x, e.global.y);
      }
    };

    const onUp = () => {
      isDragging = false;
      app.stage.off('pointermove', onMove);
      app.stage.off('pointerup', onUp);
      app.stage.off('pointerupoutside', onUp);

      coin.scale.set(scale);
      coin.alpha = 1.0;

      const slotGlobalPos = coinSlotZone.getGlobalPosition();
      const dx = coin.x - slotGlobalPos.x;
      const dy = coin.y - slotGlobalPos.y;

      if (Math.sqrt(dx * dx + dy * dy) < 80) {
        this.handleCoinDrop({
          app,
          value,
          coinSprite: coin,
          audioService,
          dataService,
          gameService: params.gameService,
          coinSlotZone,
          onUpdateDisplay,
          onCoinDrop,
          playAudio,
        });
      } else {
        const fadeOut = (ticker: Ticker) => {
          coin.alpha -= 0.1;
          coin.scale.x -= 0.05;
          coin.scale.y -= 0.05;
          if (coin.alpha <= 0) {
            app.ticker.remove(fadeOut);
            app.stage.removeChild(coin);
            coin.destroy();
          }
        };
        app.ticker.add(fadeOut);
      }
    };

    app.stage.addChild(coin);

    app.stage.on('pointermove', onMove);
    app.stage.on('pointerup', onUp);
    app.stage.on('pointerupoutside', onUp);
  }

  handleCoinDrop(params: {
    app: Application;
    value: number;
    coinSprite: Graphics;
    audioService: AudioService;
    dataService: VendingMachinePixiDataService;
    gameService: VendingMachinePixiGameService;
    coinSlotZone: Graphics;
    onUpdateDisplay: () => void;
    onCoinDrop?: () => void;
    playAudio?: boolean;
  }) {
    const { app, value, coinSprite, audioService, dataService, gameService, coinSlotZone, onUpdateDisplay, onCoinDrop, playAudio } = params;
    if (playAudio !== false) {
      audioService.play('insert_coin', { interrupt: false });
    }
    dataService.currentBalance = gameService.applyCoin(dataService.currentBalance, value);
    onUpdateDisplay();
    if (onCoinDrop) {
      onCoinDrop();
    }

    const slotPos = coinSlotZone.getGlobalPosition();

    const animateDrop = (ticker: Ticker) => {
      coinSprite.x += (slotPos.x - coinSprite.x) * 0.2;
      coinSprite.y += (slotPos.y - coinSprite.y) * 0.2;
      coinSprite.scale.x *= 0.8;
      coinSprite.scale.y *= 0.8;
      coinSprite.alpha -= 0.1;

      if (coinSprite.alpha <= 0.1) {
        app.ticker.remove(animateDrop);
        app.stage.removeChild(coinSprite);
        coinSprite.destroy();
        onUpdateDisplay();
      }
    };
    app.ticker.add(animateDrop);
  }
}
