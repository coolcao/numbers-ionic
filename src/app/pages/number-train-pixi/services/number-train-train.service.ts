import { Injectable, inject, effect, OnDestroy } from '@angular/core';
import { Container, Texture, Sprite, Text, Graphics, Assets, FederatedPointerEvent, Point, Ticker } from 'pixi.js';
import { TrainPart } from '../number-train.types';
import { NumberTrainPixiEngineService } from './number-train-pixi-engine.service';
import { NumberTrainGameService } from './number-train-game.service';
import { AudioService } from 'src/app/service/audio.service';
import { Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NumberTrainTrainService implements OnDestroy {
  private engine = inject(NumberTrainPixiEngineService);
  private gameService = inject(NumberTrainGameService);
  private audioService = inject(AudioService);

  topZone!: Container;
  bottomZone!: Container;

  private textures: { [key: string]: Texture } = {};
  private activeSmokeParticles: Graphics[] = [];
  private pauseSmokeGeneration = false;

  // Drag State
  private dragItem: Container | null = null;
  private dragOffset = { x: 0, y: 0 };
  private originalPosition = { x: 0, y: 0 };
  private originalParent: Container | null = null;
  private gapIndex: number | null = null;

  // Scaling constants (from component)
  private readonly TRAIN_WIDTH = 180;

  private sub = new Subscription();

  constructor() {
    // Track game signals explicitly so changes retrigger even if zones not yet ready
    effect(() => {
      const top = this.gameService.topTrains();
      const bottom = this.gameService.bottomTrains();
      // Only render when zones are ready; but still read signals above to subscribe
      if (this.topZone && this.bottomZone) {
        this.renderTrains();
      }
    });

    this.sub.add(
      this.gameService.event$.subscribe(evt => {
        if (evt.type === 'success') {
          this.playSuccessAnimation();
        } else if (evt.type === 'error') {
          this.playErrorEffect();
        } else if (evt.type === 'next_round') {
          // Reset zones position (in case they moved off screen)
          if (this.bottomZone) this.bottomZone.x = 0;
          this.pauseSmokeGeneration = false;
          if (this.engine.app?.stage) this.engine.app.stage.eventMode = 'static';
          // Ensure a render on explicit next round event
          if (this.topZone && this.bottomZone) this.renderTrains();
        }
      })
    );
  }

  ngOnDestroy() {
    this.activeSmokeParticles.forEach(p => p.destroy());
    this.sub.unsubscribe();
    window.removeEventListener('resize', this.onResizeBound);
  }

  async init() {
    await this.loadTextures();

    // Preload commonly used sounds
    try {
      await Promise.all([
        this.audioService.preload('train-whistle', 'assets/audio/number-train/train-whistle.mp3'),
        this.audioService.preload('train-move', 'assets/audio/number-train/train-move.m4a'),
        this.audioService.preload('wrong-answer', 'assets/audio/number-train/wrong-answer.mp3'),
      ]);
    } catch (e) {
      console.warn('Audio preload failed (will attempt lazy play):', e);
    }

    this.topZone = new Container();
    this.topZone.label = 'topZone';

    this.bottomZone = new Container();
    this.bottomZone.label = 'bottomZone';

    this.engine.mainContainer.addChild(this.topZone);
    this.engine.mainContainer.addChild(this.bottomZone);

    this.onResize();
    window.addEventListener('resize', this.onResizeBound);
  }

  private onResizeBound = () => this.onResize();

  onResize() {
    if (!this.engine.app || !this.bottomZone) return;

    const { isMobile, isTablet } = this.engine;
    const h = this.engine.height;

    this.bottomZone.y = h - (isMobile ? (isTablet ? 120 : 90) : 200);
    this.topZone.y = Math.max(
      isMobile ? (isTablet ? 140 : 120) : 200,
      h * 0.4,
    );

    this.renderTrains();
  }

  async loadTextures() {
    try {
      this.textures['engine'] = await Assets.load('assets/images/train/engine.png');
      this.textures['car'] = await Assets.load('assets/images/train/car.png');
      this.textures['caboose'] = await Assets.load('assets/images/train/caboose.png');
    } catch (e) {
      console.error('Failed to load textures', e);
    }
  }

  renderTrains() {
    if (!this.topZone || !this.bottomZone) {
      console.warn('renderTrains skipped: zones not ready');
      return;
    }

    const topTrains = this.gameService.topTrains();
    const bottomTrains = this.gameService.bottomTrains();

    // Clear zones
    this.topZone.removeChildren();
    this.bottomZone.removeChildren();

    const { isMobile, isTablet } = this.engine;
    const w = this.engine.width;

    // Render Top Trains
    const topSpacing = isMobile ? (isTablet ? 156 : 112) : 200;
    const topOffset = isMobile ? (isTablet ? 70 : 56) : 100;
    const startXTop = (w - topTrains.length * topSpacing) / 2 + topOffset;

    topTrains.forEach((t, i) => {
      const sprite = this.createTrainSprite(t);
      sprite.x = startXTop + i * topSpacing;
      sprite.y = 0;
      this.topZone.addChild(sprite);
    });

    // Render Bottom Trains
    const uniformSize = isMobile ? (isTablet ? 140 : 100) : 180;
    const bottomSpacing = uniformSize;
    const bottomOffset = isMobile ? (isTablet ? 70 : 50) : 90;
    const startXBottom = (w - bottomTrains.length * bottomSpacing) / 2 + bottomOffset;

    bottomTrains.forEach((t, i) => {
      const sprite = this.createTrainSprite(t);
      sprite.x = startXBottom + i * bottomSpacing;
      sprite.y = 0;
      this.bottomZone.addChild(sprite);
    });
  }

  createTrainSprite(train: TrainPart): Container {
    const container = new Container();
    container.label = train.id;

    let body: Sprite | Graphics;
    const tex = this.textures[train.type];

    if (tex) {
      body = new Sprite(tex);
      body.anchor.set(0.5);
    } else {
      console.warn('Missing texture for type:', train.type, 'Using fallback.');
      const g = new Graphics();
      g.rect(-90, -90, 180, 180);
      g.fill({ color: 0xff0000 }); // Red box fallback
      body = g;
    }

    const { isMobile, isTablet } = this.engine;
    const uniformSize = isMobile ? (isTablet ? 140 : 100) : 180;

    // Scale body
    body.scale.set(uniformSize / 180);
    body.y = 0;
    container.addChild(body);

    const text = new Text({
      text: train.number.toString(),
      style: {
        fontFamily: 'Comic Sans MS',
        fontSize: isMobile ? 22 : 40,
        fill: '#ffffff',
        stroke: { color: '#000000', width: isMobile ? 2 : 4 },
        dropShadow: {
          color: '#000000',
          blur: isMobile ? 2 : 4,
          angle: Math.PI / 6,
          distance: isMobile ? 3 : 6,
        },
      },
    });
    text.anchor.set(0.5);
    container.addChild(text);

    // Smoke for Engine
    if (train.type === 'engine') {
      let frame = 0;
      const smokeUpdate = () => {
        frame++;
        if (frame % 20 === 0 && !this.pauseSmokeGeneration) {
          this.spawnSmoke(container);
        }
      };
      this.engine.app.ticker.add(smokeUpdate);
      container.on('destroyed', () => {
        // Ticker clean up handled automatically if we passed function ref? 
        // But we used arrow func closure. Need variable ref.
        // Actually original code was: `this.app.ticker.remove(smokeUpdate)`
        if (this.engine.app?.ticker) this.engine.app.ticker.remove(smokeUpdate);
      });
    }

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', this.onDragStart, this);
    (container as any).trainData = train;

    return container;
  }

  spawnSmoke(parent: Container) {
    const settings = this.engine; // access isMobile etc
    const smoke = new Graphics();
    const baseSize = settings.isMobile ? (settings.isTablet ? 9 : 7) : 10;
    const size = Math.random() * baseSize + baseSize;
    smoke.circle(0, 0, size);
    smoke.fill({ color: 0xeeeeee, alpha: 0.6 });

    const scaleFactor = settings.isMobile ? (settings.isTablet ? 0.78 : 0.56) : 1;
    const chimneyOffsetX = -30 * scaleFactor;
    const chimneyOffsetY = -50 * scaleFactor;
    smoke.x = chimneyOffsetX + (Math.random() * 10 - 5);
    smoke.y = chimneyOffsetY;
    parent.addChild(smoke);

    this.activeSmokeParticles.push(smoke);

    const vx = Math.random() * 0.5 - 1.5;
    const vy = -Math.random() * 1.5 - 1;

    const update = () => {
      if (!smoke || smoke.destroyed) {
        this.removeSmokeParticle(smoke, update);
        return;
      }
      smoke.x += vx;
      smoke.y += vy;
      smoke.alpha -= 0.008;
      smoke.scale.x += 0.01;
      smoke.scale.y += 0.01;

      if (smoke.alpha <= 0) {
        smoke.destroy();
        this.removeSmokeParticle(smoke, update);
      }
    };
    this.engine.app.ticker.add(update);
  }

  removeSmokeParticle(smoke: Graphics, updateFn: any) {
    const index = this.activeSmokeParticles.indexOf(smoke);
    if (index > -1) this.activeSmokeParticles.splice(index, 1);
    if (this.engine.app?.ticker) this.engine.app.ticker.remove(updateFn);
  }

  // --- Interaction ---

  onDragStart(event: FederatedPointerEvent) {
    const obj = event.currentTarget as Container;
    const trainData = (obj as any).trainData as TrainPart;

    if (obj.parent !== this.topZone) return;

    this.dragItem = obj;
    this.originalParent = obj.parent;
    this.originalPosition = { x: obj.x, y: obj.y };
    this.gapIndex = null;

    const globalPos = event.global;
    const objGlobalPos = obj.getGlobalPosition();
    this.dragOffset = {
      x: globalPos.x - objGlobalPos.x,
      y: globalPos.y - objGlobalPos.y
    };

    const newPos = this.engine.mainContainer.toLocal(objGlobalPos);
    this.engine.mainContainer.addChild(this.dragItem);
    this.dragItem.position.set(newPos.x, newPos.y);
    this.dragItem.scale.set(1.1);
    this.dragItem.alpha = 0.9;

    this.engine.app.stage.on('pointermove', this.onDragMove, this);
    this.engine.app.stage.on('pointerup', this.onDragEnd, this);
    this.engine.app.stage.on('pointerupoutside', this.onDragEnd, this);
  }

  onDragMove(event: FederatedPointerEvent) {
    if (!this.dragItem) return;

    const globalPos = event.global;
    const newGlobal = {
      x: globalPos.x - this.dragOffset.x,
      y: globalPos.y - this.dragOffset.y
    };
    const newLocal = this.engine.mainContainer.toLocal(new Point(newGlobal.x, newGlobal.y));
    this.dragItem.position.set(newLocal.x, newLocal.y);

    // Collision
    const bottomY = this.bottomZone.y;
    const distY = Math.abs(this.dragItem.y - bottomY);
    const threshold = 80;

    if (distY < threshold) {
      const bottomX = this.bottomZone.x;
      const relativeX = this.dragItem.x - bottomX;

      const currentLen = this.gameService.bottomTrains().length;
      const { isMobile, isTablet } = this.engine;
      const uniformSize = isMobile ? (isTablet ? 140 : 100) : 180;
      const trainWidth = uniformSize;
      const width = this.engine.width;
      const offset = isMobile ? (isTablet ? 70 : 50) : 90;
      const startX = (width - currentLen * trainWidth) / 2 + offset;

      const relativeToFirst = relativeX - startX;
      let index = Math.round(relativeToFirst / trainWidth);
      index = Math.max(0, Math.min(index, currentLen));

      if (this.gapIndex !== index) {
        this.gapIndex = index;
        this.updateBottomTrainPositions(index);
      }
    } else {
      if (this.gapIndex !== null) {
        this.gapIndex = null;
        this.updateBottomTrainPositions(null);
      }
    }
  }

  updateBottomTrainPositions(gapIndex: number | null) {
    const bottomTrains = this.gameService.bottomTrains();
    const { isMobile, isTablet } = this.engine;
    const uniformSize = isMobile ? (isTablet ? 140 : 100) : 180;
    const trainWidth = uniformSize;

    const count = bottomTrains.length + (gapIndex !== null ? 1 : 0);
    const width = this.engine.width;
    const offset = isMobile ? (isTablet ? 70 : 50) : 90;
    const startX = (width - count * trainWidth) / 2 + offset;

    this.bottomZone.children.forEach((child, i) => {
      let targetX = startX + i * trainWidth;
      if (gapIndex !== null && i >= gapIndex) {
        targetX += trainWidth;
      }
      child.x = targetX;
    });
  }

  onDragEnd() {
    if (this.dragItem) {
      this.engine.app.stage.off('pointermove', this.onDragMove, this);
      this.engine.app.stage.off('pointerup', this.onDragEnd, this);
      this.engine.app.stage.off('pointerupoutside', this.onDragEnd, this);

      if (this.gapIndex !== null) {
        this.handleDrop(this.gapIndex);
      } else {
        this.returnToOriginal();
      }

      this.updateBottomTrainPositions(null);
      this.gapIndex = null;

      if (this.dragItem) {
        this.dragItem.scale.set(1);
        this.dragItem.alpha = 1;
        this.dragItem = null;
      }
    }
  }

  handleDrop(index: number) {
    if (!this.dragItem) return;
    const trainData = (this.dragItem as any).trainData as TrainPart;
    this.dragItem.destroy(); // Destroy visual, re-render will fix
    this.dragItem = null;

    const currentTop = this.gameService.topTrains();
    const currentBottom = this.gameService.bottomTrains();

    const newTop = currentTop.filter(t => t.id !== trainData.id);
    const safeIndex = Math.max(0, Math.min(index, currentBottom.length));
    const newBottom = [...currentBottom];
    newBottom.splice(safeIndex, 0, trainData);

    this.gameService.topTrains.set(newTop);
    this.gameService.bottomTrains.set(newBottom);

    // Trigger check
    if (newTop.length === 0) {
      this.gameService.checkRound();
    }
  }

  returnToOriginal() {
    if (!this.dragItem || !this.originalParent) return;
    this.originalParent.addChild(this.dragItem);
    this.dragItem.x = this.originalPosition.x;
    this.dragItem.y = this.originalPosition.y;
  }

  // --- Animations ---

  async playSuccessAnimation() {
    this.engine.app.stage.eventMode = 'none';

    try {
      // Preload might be skipped if AudioService handles it, but play is safe
      this.audioService.play('train-whistle');
      setTimeout(() => this.audioService.play('train-move'), 500);
    } catch (e) {
      console.warn('Audio play failed', e);
    }

    this.pauseSmokeGeneration = true;
    // Clear smoke?
    this.activeSmokeParticles.forEach(p => p.destroy());
    this.activeSmokeParticles = [];

    const speed = this.engine.isMobile ? 5 : 8;
    const zone = this.bottomZone;

    const animate = () => {
      if (!zone) return;
      zone.x -= speed;
      if (zone.x < -this.engine.width - 500) {
        this.engine.app.ticker.remove(animate);
        // Animation Done
        this.gameService.onRoundComplete();
      }
    };
    this.engine.app.ticker.add(animate);
  }

  async playErrorEffect() {
    // Start audio immediately and do not block shaking
    this.audioService.play('wrong-answer', { volume: 0.4 }).catch(() => { });

    const proceedNext = () => {
      // After error shake completes, advance to next round or finish
      if (this.gameService.currentRound() < this.gameService.totalRound()) {
        this.gameService.playNextRound();
      } else {
        this.gameService.gameState.set('finished');
      }
    };

    if (this.bottomZone) {
      const originalX = this.bottomZone.x;
      let count = 0;
      const shake = () => {
        if (count < 6) {
          const dir = count % 2 === 0 ? 1 : -1;
          this.bottomZone.x = originalX + dir * 10;
          count++;
          setTimeout(shake, 50);
        } else {
          this.bottomZone.x = originalX;
          setTimeout(proceedNext, 500);
        }
      };
      shake();
    } else {
      // If bottomZone not available, fallback to timed next round
      setTimeout(proceedNext, 500);
    }
  }
}
