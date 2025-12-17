import { ElementRef, Injectable } from '@angular/core';
import { Application, Container, Graphics } from 'pixi.js';

@Injectable({ providedIn: 'root' })
export class NumberBubblesPixiEngineService {
  app?: Application;
  gameStage?: Container;
  bubbleContainer?: Container;
  particleContainer?: Container;
  tutorialOverlay?: Graphics;
  uiContainer?: Container;

  private resizeHandler?: () => void;
  private canvasClickHandler?: (e: MouseEvent) => void;

  async init(
    containerEl: HTMLElement,
    onTick: (ticker: any) => void,
    onCanvasClick: (e: MouseEvent) => void,
    onResize?: () => void,
  ): Promise<void> {
    if (this.app) return;

    this.app = new Application();
    await this.app.init({
      width: containerEl.clientWidth,
      height: containerEl.clientHeight,
      backgroundColor: 0x000000,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      backgroundAlpha: 0,
    });

    containerEl.appendChild(this.app.canvas as HTMLCanvasElement);

    this.gameStage = new Container();
    this.bubbleContainer = new Container();
    this.particleContainer = new Container();
    this.tutorialOverlay = new Graphics();
    this.uiContainer = new Container();
    this.gameStage.addChild(this.bubbleContainer);
    this.gameStage.addChild(this.particleContainer);
    this.gameStage.addChild(this.tutorialOverlay);
    this.gameStage.addChild(this.uiContainer);
    this.app.stage.addChild(this.gameStage);

    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';

    this.canvasClickHandler = onCanvasClick;
    canvas.addEventListener('click', this.canvasClickHandler);

    this.resizeHandler = () => {
      if (!this.app) return;
      this.app.renderer.resize(
        containerEl.clientWidth,
        containerEl.clientHeight,
      );
      if (onResize) onResize();
    };
    window.addEventListener('resize', this.resizeHandler);

    this.app.ticker.add(onTick);
  }

  startLoop(onTick: (ticker: any) => void) {
    if (!this.app) return;
    this.app.ticker.add(onTick);
  }

  stopLoop(onTick: (ticker: any) => void) {
    if (!this.app) return;
    this.app.ticker.remove(onTick);
  }

  destroy() {
    if (this.app) {
      const canvas = this.app.canvas as HTMLCanvasElement | undefined;
      if (this.canvasClickHandler && canvas) {
        canvas.removeEventListener('click', this.canvasClickHandler);
      }
      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
      }
      this.app.destroy(true, { children: true });
    }
    this.app = undefined;
    this.gameStage = undefined;
    this.bubbleContainer = undefined;
    this.particleContainer = undefined;
    this.tutorialOverlay = undefined;
    this.uiContainer = undefined;
  }
}
