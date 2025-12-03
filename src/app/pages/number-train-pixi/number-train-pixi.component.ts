import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  WritableSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  Application,
  Container,
  Graphics,
  Text,
  Texture,
  Sprite,
  Assets,
  FederatedPointerEvent,
  Point,
} from 'pixi.js';
import { AppStore } from 'src/app/store/app.store';
import { NumberTrainStore } from 'src/app/store/number-train.store';
import { NumberTrainService } from 'src/app/pages/number-train/number-train.service';
import { AudioService } from 'src/app/service/audio.service';
import { timer } from 'rxjs';

interface TrainPart {
  id: string;
  number: number;
  type: 'engine' | 'car' | 'caboose';
  x?: number;
  y?: number;
}

@Component({
  selector: 'app-number-train-pixi',
  standalone: false,
  templateUrl: './number-train-pixi.component.html',
  styleUrls: ['./number-train-pixi.component.css'],
})
export class NumberTrainPixiComponent implements OnInit, OnDestroy {
  @ViewChild('pixiContainer', { static: true }) pixiContainer!: ElementRef;

  private app!: Application;
  private readonly router = inject(Router);
  private readonly appStore = inject(AppStore);
  private readonly trainStore = inject(NumberTrainStore);
  private readonly service = inject(NumberTrainService);
  private readonly audioService = inject(AudioService);

  // Game State Signals
  trainNumbers: WritableSignal<number[]> = signal([]);
  targetNumbers: WritableSignal<number[]> = signal([]);

  // Visual State
  topTrains: WritableSignal<TrainPart[]> = signal([]);
  bottomTrains: WritableSignal<TrainPart[]> = signal([]);

  gameState: WritableSignal<'playing' | 'finished'> = signal('playing');
  totalRound = signal(5);
  currentRound = signal(0);
  correctRound = signal(0);
  roundFinished = signal(false);

  // Pixi Elements
  private mainContainer!: Container;
  private topZone!: Container;
  private bottomZone!: Container;
  private dragItem: Container | null = null;
  private dragOffset = { x: 0, y: 0 };
  private originalPosition = { x: 0, y: 0 };
  private originalParent: Container | null = null;
  private originalIndex: number = -1;

  // Textures
  private textures: { [key: string]: Texture } = {};

  constructor() {
    effect(() => {
      if (this.roundFinished()) {
        this.checkRound();
      }
    });
  }

  async ngOnInit() {
    this.playWelcome();
    await this.initPixi();
    this.playNextRound();
  }

  ngOnDestroy() {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
    }
  }

  async initPixi() {
    this.app = new Application();
    await this.app.init({
      resizeTo: this.pixiContainer.nativeElement,
      backgroundAlpha: 0, // Transparent background
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.pixiContainer.nativeElement.appendChild(this.app.canvas);

    // Enable stage interactivity for global drag events
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    // Generate Textures
    this.generateTextures();

    // Setup Scene
    this.mainContainer = new Container();
    this.app.stage.addChild(this.mainContainer);

    this.createBackground();
    this.createTracks();

    this.topZone = new Container();
    this.topZone.label = 'topZone';
    this.topZone.y = 150;
    this.mainContainer.addChild(this.topZone);

    this.bottomZone = new Container();
    this.bottomZone.label = 'bottomZone';
    this.bottomZone.y = this.app.screen.height - 250;
    this.mainContainer.addChild(this.bottomZone);

    // Handle Resize
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
  }

  onResize() {
    if (!this.app || !this.bottomZone) return;
    this.app.stage.hitArea = this.app.screen;
    this.bottomZone.y = this.app.screen.height - 200;
    this.topZone.y = 150;
    this.renderTrains();
  }

  generateTextures() {
    // Helper to create texture from canvas
    const createTexture = (
      drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
      width: number,
      height: number,
    ) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      drawFn(ctx, width, height);
      return Texture.from(canvas);
    };

    // Coupler Texture
    this.textures['coupler'] = createTexture(
      (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#616161');
        grad.addColorStop(1, '#424242');
        ctx.fillStyle = grad;
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, 4);
        ctx.fill();
        ctx.stroke();
      },
      20, // Longer coupler
      30,
    );

    // Engine Texture
    this.textures['engine'] = createTexture(
      (ctx, w, h) => {
        // Body Gradient
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#66bb6a');
        grad.addColorStop(0.5, '#4caf50');
        grad.addColorStop(1, '#388e3c');

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#2e7d32';
        ctx.lineWidth = 2;

        // Draw Engine Shape (Rounded Rect with some custom shape)
        ctx.beginPath();
        ctx.moveTo(25, 0);
        ctx.lineTo(w - 10, 0);
        ctx.quadraticCurveTo(w, 0, w, 10);
        ctx.lineTo(w, h - 10);
        ctx.quadraticCurveTo(w, h, w - 10, h);
        ctx.lineTo(25, h);
        ctx.quadraticCurveTo(0, h, 0, h - 25);
        ctx.lineTo(0, 25);
        ctx.quadraticCurveTo(0, 0, 25, 0);
        ctx.fill();
        ctx.stroke();

        // Window
        ctx.fillStyle = '#e8f5e8';
        ctx.fillRect(30, 25, 60, 40);
        ctx.strokeRect(30, 25, 60, 40);

        // Light
        ctx.beginPath();
        ctx.arc(w - 20, 30, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#ffeb3b';
        ctx.fill();
        ctx.shadowColor = '#ffeb3b';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Smoke Stack
        ctx.fillStyle = '#424242';
        ctx.fillRect(40, -20, 25, 20);
      },
      180,
      100,
    );

    // Car Texture
    this.textures['car'] = createTexture(
      (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#81c784');
        grad.addColorStop(0.5, '#66bb6a');
        grad.addColorStop(1, '#4caf50');

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#43a047';
        ctx.lineWidth = 2;

        // Rounded Rect
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, 10);
        ctx.fill();
        ctx.stroke();

        // Inner Panel
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.roundRect(15, 15, w - 30, h - 30, 8);
        ctx.fill();

        // Windows
        ctx.fillStyle = '#fff';
        const winW = 20;
        const gap = (w - 50 - 3 * winW) / 2;
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(25 + i * (winW + gap), 25, winW, 25);
        }

        // Door
        ctx.fillStyle = '#1b5e20';
        ctx.fillRect(w / 2 - 15, h - 20, 30, 20);
      },
      160,
      100,
    );

    // Caboose Texture
    this.textures['caboose'] = createTexture(
      (ctx, w, h) => {
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#a5d6a7');
        grad.addColorStop(0.5, '#81c784');
        grad.addColorStop(1, '#66bb6a');

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 2;

        // Shape
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(w - 25, 0);
        ctx.quadraticCurveTo(w, 0, w, 25);
        ctx.lineTo(w, h - 10);
        ctx.quadraticCurveTo(w, h, w - 10, h);
        ctx.lineTo(10, h);
        ctx.quadraticCurveTo(0, h, 0, h - 10);
        ctx.lineTo(0, 10);
        ctx.quadraticCurveTo(0, 0, 10, 0);
        ctx.fill();
        ctx.stroke();

        // Window
        ctx.fillStyle = '#fff';
        ctx.fillRect(25, 25, 40, 30);

        // Flag
        ctx.fillStyle = '#4caf50';
        ctx.save();
        ctx.translate(w - 30, 0);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(0, -10, 20, 15);
        ctx.restore();
      },
      180,
      100,
    );

    // Wheel Texture
    this.textures['wheel'] = createTexture(
      (ctx, w, h) => {
        const grad = ctx.createRadialGradient(
          w / 2,
          h / 2,
          5,
          w / 2,
          h / 2,
          w / 2,
        );
        grad.addColorStop(0, '#212121');
        grad.addColorStop(0.5, '#000000');
        grad.addColorStop(1, '#212121');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#616161';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Inner hub
        ctx.fillStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 8, 0, Math.PI * 2);
        ctx.fill();
      },
      50,
      50,
    );
  }

  createBackground() {
    // Create clouds
    const cloudTex = this.createCloudTexture();
    for (let i = 0; i < 4; i++) {
      const cloud = new Sprite(cloudTex);
      cloud.x = Math.random() * this.app.screen.width;
      cloud.y = Math.random() * (this.app.screen.height / 2);
      cloud.alpha = 0.8;
      this.mainContainer.addChild(cloud);

      // Animate clouds
      this.app.ticker.add(() => {
        cloud.x += 0.5 * (i + 1) * 0.5;
        if (cloud.x > this.app.screen.width + 100) {
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

  createTracks() {
    const trackContainer = new Container();
    this.mainContainer.addChild(trackContainer);

    // Draw tracks using Graphics
    const track = new Graphics();
    trackContainer.addChild(track);

    this.app.ticker.add(() => {
      track.clear();
      const y = this.app.screen.height - 100;
      const w = this.app.screen.width;

      // Rails
      track.rect(0, y, w, 8);
      track.fill({ color: 0x9e9e9e });

      // Sleepers (ties)
      track.fill({ color: 0x5d4037 });
      for (let x = 0; x < w; x += 30) {
        track.rect(x, y + 8, 20, 6);
      }
    });
  }

  createTrainSprite(train: TrainPart): Container {
    const container = new Container();
    container.label = train.id;

    // Couplers (Behind body)
    // We add them first so they are behind the body sprite
    if (train.type === 'engine' || train.type === 'car') {
      // Right coupler (connects to next car)
      const cRight = new Sprite(this.textures['coupler']);
      cRight.anchor.set(0.5);
      cRight.x = 90; // Half width of engine/car approx
      if (train.type === 'car') cRight.x = 80;
      container.addChild(cRight);
    }
    if (train.type === 'caboose' || train.type === 'car') {
      // Left coupler (connects to previous car)
      const cLeft = new Sprite(this.textures['coupler']);
      cLeft.anchor.set(0.5);
      cLeft.x = -90;
      if (train.type === 'car') cLeft.x = -80;
      container.addChild(cLeft);
    }

    // Body
    const body = new Sprite(this.textures[train.type]);
    body.anchor.set(0.5);
    container.addChild(body);

    // Number Text
    const text = new Text({
      text: train.number.toString(),
      style: {
        fontFamily: 'Comic Sans MS',
        fontSize: 40,
        fill: '#ffffff',
        stroke: { color: '#000000', width: 4 },
        dropShadow: {
          color: '#000000',
          blur: 4,
          angle: Math.PI / 6,
          distance: 6,
        },
      },
    });
    text.anchor.set(0.5);
    container.addChild(text);

    // Wheels
    const w1 = new Sprite(this.textures['wheel']);
    w1.anchor.set(0.5);
    w1.y = 50;
    w1.x = -40;
    w1.width = 40;
    w1.height = 40;
    container.addChild(w1);

    const w2 = new Sprite(this.textures['wheel']);
    w2.anchor.set(0.5);
    w2.y = 50;
    w2.x = 40;
    w2.width = 40;
    w2.height = 40;
    container.addChild(w2);

    // Animate Wheels
    const wheelUpdate = () => {
      w1.rotation += 0.05;
      w2.rotation += 0.05;
    };
    this.app.ticker.add(wheelUpdate);

    // Smoke for Engine
    let smokeUpdate: (() => void) | null = null;
    if (train.type === 'engine') {
      let frame = 0;
      smokeUpdate = () => {
        frame++;
        if (frame % 15 === 0) {
          // More frequent smoke
          this.spawnSmoke(container);
        }
      };
      this.app.ticker.add(smokeUpdate);
    }

    // Cleanup
    container.on('destroyed', () => {
      this.app.ticker.remove(wheelUpdate);
      if (smokeUpdate) {
        this.app.ticker.remove(smokeUpdate);
      }
    });

    // Make Interactive
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointerdown', this.onDragStart, this);

    // Store data
    (container as any).trainData = train;

    return container;
  }

  spawnSmoke(parent: Container) {
    const smoke = new Graphics();
    const size = Math.random() * 10 + 10; // Random size 10-20
    smoke.circle(0, 0, size);
    smoke.fill({ color: 0xeeeeee, alpha: 0.6 }); // Lighter smoke
    smoke.x = 40 + (Math.random() * 10 - 5); // Stack pos with jitter
    smoke.y = -30;
    parent.addChild(smoke);

    // Random velocity
    const vx = Math.random() * 0.5 - 1.5; // Drift left (train moving right)
    const vy = -Math.random() * 1.5 - 1; // Upward

    const update = () => {
      smoke.x += vx;
      smoke.y += vy;
      smoke.alpha -= 0.008;
      smoke.scale.x += 0.01;
      smoke.scale.y += 0.01;

      if (smoke.alpha <= 0) {
        smoke.destroy();
        this.app.ticker.remove(update);
      }
    };
    this.app.ticker.add(update);
  }

  renderTrains() {
    // Clear zones
    this.topZone.removeChildren();
    this.bottomZone.removeChildren();

    // Render Top Trains (Target/Missing)
    const topTrains = this.topTrains();
    const startXTop =
      (this.app.screen.width - topTrains.length * 200) / 2 + 100;

    topTrains.forEach((t, i) => {
      const sprite = this.createTrainSprite(t);
      sprite.x = startXTop + i * 200;
      sprite.y = 0;
      this.topZone.addChild(sprite);
    });

    // Render Bottom Trains (Current Sequence)
    const bottomTrains = this.bottomTrains();
    const startXBottom =
      (this.app.screen.width - bottomTrains.length * 180) / 2 + 90;

    bottomTrains.forEach((t, i) => {
      const sprite = this.createTrainSprite(t);
      sprite.x = startXBottom + i * 180;
      sprite.y = 0;
      this.bottomZone.addChild(sprite);
    });
  }

  private gapIndex: number | null = null;
  private readonly TRAIN_WIDTH = 180;

  onDragStart(event: FederatedPointerEvent) {
    const obj = event.currentTarget as Container;
    const trainData = (obj as any).trainData as TrainPart;

    // Only allow dragging from Top Zone
    if (obj.parent !== this.topZone) return;

    this.dragItem = obj;
    this.originalParent = obj.parent;
    this.originalPosition = { x: obj.x, y: obj.y };
    this.originalIndex = this.topTrains().findIndex(
      (t) => t.id === trainData.id,
    );
    this.gapIndex = null;

    // Calculate offset: pointer pos relative to object anchor
    const globalPos = event.global;
    const objGlobalPos = obj.getGlobalPosition();

    this.dragOffset = {
      x: globalPos.x - objGlobalPos.x,
      y: globalPos.y - objGlobalPos.y,
    };

    // Move to main container
    const newPosInMain = this.mainContainer.toLocal(objGlobalPos);

    this.mainContainer.addChild(this.dragItem);
    this.dragItem.position.set(newPosInMain.x, newPosInMain.y);

    this.dragItem.scale.set(1.1);
    this.dragItem.alpha = 0.9;

    this.app.stage.on('pointermove', this.onDragMove, this);
    this.app.stage.on('pointerup', this.onDragEnd, this);
    this.app.stage.on('pointerupoutside', this.onDragEnd, this);
  }

  onDragMove(event: FederatedPointerEvent) {
    if (this.dragItem) {
      const globalPos = event.global;
      const newObjGlobal = {
        x: globalPos.x - this.dragOffset.x,
        y: globalPos.y - this.dragOffset.y,
      };

      const newObjLocal = this.mainContainer.toLocal(
        new Point(newObjGlobal.x, newObjGlobal.y),
      );
      this.dragItem.position.set(newObjLocal.x, newObjLocal.y);

      // Check collision with Bottom Zone for gap effect
      const bottomZoneBounds = this.bottomZone.getBounds();
      const itemBounds = this.dragItem.getBounds();

      if (
        itemBounds.y + itemBounds.height > bottomZoneBounds.y &&
        itemBounds.y < bottomZoneBounds.y + bottomZoneBounds.height
      ) {
        // Calculate relative X in bottom zone
        const relativeX =
          itemBounds.x + itemBounds.width / 2 - bottomZoneBounds.x;
        let index = Math.floor(relativeX / this.TRAIN_WIDTH);

        // Clamp index
        const currentBottomLen = this.bottomTrains().length;
        index = Math.max(0, Math.min(index, currentBottomLen));

        if (this.gapIndex !== index) {
          this.gapIndex = index;
          this.updateBottomTrainPositions(this.gapIndex);
        }

        // Optional: Snap Y if very close (Adsorption effect)
        const distY = Math.abs(
          bottomZoneBounds.y +
            bottomZoneBounds.height / 2 -
            (itemBounds.y + itemBounds.height / 2),
        );
        if (distY < 50) {
          // Snap visual Y only? Or just let user feel it?
          // Let's just rely on the gap opening as the visual cue.
        }
      } else {
        if (this.gapIndex !== null) {
          this.gapIndex = null;
          this.updateBottomTrainPositions(null);
        }
      }
    }
  }

  updateBottomTrainPositions(gapIndex: number | null) {
    const bottomTrains = this.bottomTrains();
    // Calculate new startX based on whether there is a gap (simulating +1 item)
    const count = bottomTrains.length + (gapIndex !== null ? 1 : 0);
    const startX = (this.app.screen.width - count * this.TRAIN_WIDTH) / 2 + 90; // 90 is half width offset

    this.bottomZone.children.forEach((child, i) => {
      let targetX = startX + i * this.TRAIN_WIDTH;
      if (gapIndex !== null && i >= gapIndex) {
        targetX += this.TRAIN_WIDTH;
      }
      // Simple lerp or direct set? Direct set is snappier for drag feedback
      child.x = targetX;
    });
  }

  onDragEnd() {
    if (this.dragItem) {
      this.app.stage.off('pointermove', this.onDragMove, this);
      this.app.stage.off('pointerup', this.onDragEnd, this);
      this.app.stage.off('pointerupoutside', this.onDragEnd, this);

      if (this.gapIndex !== null) {
        this.handleDrop(this.gapIndex);
      } else {
        this.returnToOriginal();
      }

      // Reset gap visual
      this.updateBottomTrainPositions(null);
      this.gapIndex = null;

      if (this.dragItem) {
        this.dragItem.scale.set(1);
        this.dragItem.alpha = 1;
        this.dragItem = null;
      }
    }
  }

  handleDrop(insertIndex: number) {
    if (!this.dragItem) return;
    const trainData = (this.dragItem as any).trainData as TrainPart;

    // Destroy the drag item immediately as we will re-render everything
    this.dragItem.destroy();
    this.dragItem = null;

    // Update Data
    const currentTop = this.topTrains();
    const currentBottom = this.bottomTrains();

    // Remove from top
    const newTop = currentTop.filter((t) => t.id !== trainData.id);

    // Add to bottom
    // Clamp index
    const safeIndex = Math.max(0, Math.min(insertIndex, currentBottom.length));
    const newBottom = [...currentBottom];
    newBottom.splice(safeIndex, 0, trainData);

    // Update Signals
    this.topTrains.set(newTop);
    this.bottomTrains.set(newBottom);

    // Re-render
    this.renderTrains();

    // Check if round finished (no more top trains)
    if (newTop.length === 0) {
      this.roundFinished.set(true);
    }
  }

  returnToOriginal() {
    if (!this.dragItem || !this.originalParent) return;

    // Animate back? For now just snap
    this.originalParent.addChild(this.dragItem);
    this.dragItem.x = this.originalPosition.x;
    this.dragItem.y = this.originalPosition.y;
  }

  playNextRound() {
    this.roundFinished.set(false);

    // Clear existing trains visually before generating new ones
    this.topZone.removeChildren();
    this.bottomZone.removeChildren();

    const trainNumbers = this.service.generateNumbers(
      this.trainStore.numbers(),
      this.trainStore.trainCount(),
    );
    const targetNumbers = this.service.generateTargets(
      trainNumbers,
      this.trainStore.targetCount(),
    );

    this.trainNumbers.set(trainNumbers);
    this.targetNumbers.set(targetNumbers);
    this.currentRound.update((r) => r + 1);

    // Prepare Data
    const allTrains: TrainPart[] = trainNumbers.map((num, idx) => ({
      id: Math.random().toString(36).substr(2, 9),
      number: num,
      type:
        idx === 0
          ? 'engine'
          : idx === trainNumbers.length - 1
            ? 'caboose'
            : 'car',
    }));

    // Filter
    const top = allTrains.filter((t) => targetNumbers.includes(t.number));
    const bottom = allTrains.filter((t) => !targetNumbers.includes(t.number));

    this.topTrains.set(top);
    this.bottomTrains.set(bottom);

    this.renderTrains();
  }

  checkRound() {
    const bottom = this.bottomTrains();
    const correctSequence = this.trainNumbers();

    let isCorrect = true;
    if (bottom.length !== correctSequence.length) {
      isCorrect = false;
    } else {
      for (let i = 0; i < bottom.length; i++) {
        if (bottom[i].number !== correctSequence[i]) {
          isCorrect = false;
          break;
        }
      }
    }

    if (isCorrect) {
      this.spawnConfetti();
      this.playWhistle().then(() => {
        this.playTrainMove();
        this.correctRound.update((r) => r + 1);
        if (this.currentRound() < this.totalRound()) {
          timer(4000).subscribe(() => this.playNextRound());
        } else {
          this.gameState.set('finished');
        }
      });
    } else {
      this.shakeContainer(this.bottomZone);
      this.playWrong().then(() => {
        // Reset round or just move on? Original moves on.
        if (this.currentRound() < this.totalRound()) {
          timer(1500).subscribe(() => this.playNextRound());
        } else {
          this.gameState.set('finished');
        }
      });
    }
  }

  spawnConfetti() {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
    const particles: any[] = [];

    for (let i = 0; i < 200; i++) {
      const p = new Graphics();
      p.rect(0, 0, 8, 5);
      p.fill({ color: colors[Math.floor(Math.random() * colors.length)] });
      p.x = Math.random() * this.app.screen.width;
      p.y = -Math.random() * 200 - 20;

      (p as any).vx = Math.random() * 4 - 2;
      (p as any).vy = Math.random() * 5 + 3;
      (p as any).rotationSpeed = Math.random() * 0.2 - 0.1;

      this.mainContainer.addChild(p);
      particles.push(p);
    }

    let frame = 0;
    const update = () => {
      frame++;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        if (p.y > this.app.screen.height) {
          p.destroy();
          particles.splice(i, 1);
        }
      }

      if (particles.length === 0 || frame > 300) {
        this.app.ticker.remove(update);
        particles.forEach((p) => !p.destroyed && p.destroy());
      }
    };

    this.app.ticker.add(update);
  }

  shakeContainer(container: Container) {
    const originalX = container.x;
    const originalY = container.y;
    let frame = 0;
    const duration = 30; // frames (approx 0.5s)
    const intensity = 10;

    const update = () => {
      frame++;
      if (frame < duration) {
        container.x = originalX + (Math.random() * intensity - intensity / 2);
        container.y = originalY + (Math.random() * intensity - intensity / 2);
      } else {
        container.x = originalX;
        container.y = originalY;
        this.app.ticker.remove(update);
      }
    };

    this.app.ticker.add(update);
  }

  restartGame() {
    this.currentRound.set(0);
    this.correctRound.set(0);
    this.gameState.set('playing');
    this.playNextRound();
  }

  backHome() {
    this.router.navigate(['/']);
  }

  // Audio Helpers
  async playWhistle() {
    await this.audioService.preload(
      'whistle',
      'assets/audio/number-train/train-whistle.mp3',
    );
    await this.audioService.play('whistle');
  }
  async playTrainMove() {
    await this.audioService.preload(
      'train-move',
      'assets/audio/number-train/train-move.m4a',
    );
    await this.audioService.play('train-move', { volume: 0.2, loop: false });
  }
  async playWrong() {
    await this.audioService.preload(
      'wrong',
      'assets/audio/number-train/wrong-answer.mp3',
    );
    await this.audioService.play('wrong', { volume: 0.4 });
  }
  async playWelcome() {
    await Promise.all([
      this.audioService.preload(
        'welcome1',
        'assets/audio/number-train/number-train-welcome.mp3',
      ),
      this.audioService.preload(
        'welcome2',
        'assets/audio/number-train/number-train-welcome2.mp3',
      ),
      this.audioService.preload(
        'welcome3',
        'assets/audio/number-train/number-train-welcome3.mp3',
      ),
    ]);
    await this.audioService.playSequence(['welcome1', 'welcome2', 'welcome3']);
  }
}
