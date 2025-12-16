import { Injectable, inject } from '@angular/core';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { NumberTrainPixiEngineService } from './number-train-pixi-engine.service';

@Injectable({
  providedIn: 'root'
})
export class NumberTrainSceneService {
  private engine = inject(NumberTrainPixiEngineService);

  private sceneryContainer!: Container;
  private mountain!: Graphics;
  private trees!: Graphics;
  private tracks!: Graphics;

  init(getBottomY: () => number) {
    this.sceneryContainer = new Container();
    this.engine.mainContainer.addChild(this.sceneryContainer);

    this.createBackground();
    this.createScenery();
    this.createTracks(getBottomY);
  }

  createBackground() {
    // Clouds
    const cloudTex = this.createCloudTexture();
    for (let i = 0; i < 4; i++) {
      const cloud = new Sprite(cloudTex);
      cloud.x = Math.random() * this.engine.app.screen.width;
      cloud.y = Math.random() * (this.engine.app.screen.height / 2);
      cloud.alpha = 0.8;
      this.engine.mainContainer.addChildAt(cloud, 1);

      this.engine.app.ticker.add(() => {
        cloud.x += 0.5 * (i + 1) * 0.5;
        if (cloud.x > this.engine.app.screen.width + 100) {
          cloud.x = -100;
        }
      });
    }
  }

  createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 60;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(30, 30, 20, 0, Math.PI * 2);
    ctx.arc(50, 30, 25, 0, Math.PI * 2);
    ctx.arc(70, 30, 20, 0, Math.PI * 2);
    ctx.fill();
    return Texture.from(canvas);
  }

  createScenery() {
    this.mountain = new Graphics();
    this.trees = new Graphics();
    this.sceneryContainer.addChild(this.mountain);
    this.sceneryContainer.addChild(this.trees);

    this.engine.app.ticker.add(() => {
      this.updateScenery();
    });
  }

  createTracks(getBottomY: () => number) {
    const trackContainer = new Container();
    this.engine.mainContainer.addChild(trackContainer);

    this.tracks = new Graphics();
    trackContainer.addChild(this.tracks);

    this.engine.app.ticker.add(() => {
      // bottomZone might be 0 if not init yet, but getBottomY should handle safe checks?
      // Passed function usually returns `train.bottomZone?.y || default`.
      this.updateTracks(getBottomY());
    });
  }

  // Called by main loop
  updateScenery() {
    if (!this.mountain || !this.trees) return;
    this.mountain.clear();
    this.trees.clear();

    const w = this.engine.app.screen.width;
    const h = this.engine.app.screen.height;
    const groundY = h - 100;

    // Draw Mountains
    this.mountain.moveTo(0, groundY);
    for (let i = 0; i <= w; i += 400) {
      const peakHeight = 600 + Math.sin(i * 0.01) * 200;
      this.mountain.lineTo(i + 200, groundY - peakHeight);
      this.mountain.lineTo(i + 400, groundY);
    }
    this.mountain.fill({ color: 0xc8e6c9, alpha: 0.4 });

    // Draw Trees
    for (let i = 50; i < w; i += 250) {
      const treeX = i + Math.sin(i) * 40;
      const treeY = groundY - 40;

      this.trees.rect(treeX - 18, treeY - 160, 36, 160);
      this.trees.fill({ color: 0x8d6e63, alpha: 0.7 });

      this.trees.moveTo(treeX - 50, treeY - 160);
      this.trees.lineTo(treeX, treeY - 240);
      this.trees.lineTo(treeX + 50, treeY - 160);
      this.trees.closePath();
      this.trees.fill({ color: 0x81c784, alpha: 0.6 });

      this.trees.moveTo(treeX - 25, treeY - 200);
      this.trees.lineTo(treeX, treeY - 230);
      this.trees.lineTo(treeX + 25, treeY - 200);
      this.trees.closePath();
      this.trees.fill({ color: 0xa5d6a7, alpha: 0.5 });
    }
  }

  updateTracks(bottomZoneY: number) {
    if (!this.tracks) return;
    this.tracks.clear();

    const trainY = bottomZoneY;
    const { isMobile, isTablet } = this.engine;
    const carHeight = isMobile ? (isTablet ? 78 : 56) : 100;
    const wheelSize = isMobile ? (isTablet ? 28 : 22) : 40;
    const wheelBottom = carHeight / 2 + wheelSize / 4;
    const trackLevel = trainY + wheelBottom;
    const w = this.engine.app.screen.width;

    this.tracks.rect(0, trackLevel + 8, w, 25);
    this.tracks.fill({ color: 0x8d6e63, alpha: 0.6 });

    for (let x = -20; x < w + 20; x += 50) {
      this.tracks.rect(x, trackLevel + 4, 30, 8);
    }
    this.tracks.fill({ color: 0x4e342e });

    this.tracks.rect(0, trackLevel, w, 8);
    this.tracks.fill({ color: 0x78909c });

    this.tracks.rect(0, trackLevel, w, 3);
    this.tracks.fill({ color: 0xcfd8dc });

    this.tracks.rect(0, trackLevel + 8, w, 2);
    this.tracks.fill({ color: 0x37474f, alpha: 0.5 });
  }
}
