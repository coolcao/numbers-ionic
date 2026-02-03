import { Injectable, OnDestroy, inject } from '@angular/core';
import { Application, Container } from 'pixi.js';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NumberMarketPixiEngineService implements OnDestroy {
  public app!: Application;
  public cartContainer!: Container;
  public goodsContainer!: Container;
  public dragContainer!: Container;

  public resize$ = new Subject<{ width: number; height: number }>();

  private resizeObserver: ResizeObserver | null = null;
  private resizeHandler: (() => void) | null = null;

  async init(containerElement: HTMLElement) {
    if (this.app) {
      this.destroy();
    }

    this.app = new Application();
    await this.app.init({
      resizeTo: containerElement,
      backgroundAlpha: 0,
      backgroundColor: 0x000000,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    if (this.app.canvas) {
      containerElement.appendChild(this.app.canvas);
    }

    // Create Layers
    this.cartContainer = new Container();
    this.goodsContainer = new Container();
    this.dragContainer = new Container();

    this.app.stage.addChild(this.cartContainer);
    this.app.stage.addChild(this.goodsContainer);
    this.app.stage.addChild(this.dragContainer); // Drag layer needs to be on top

    // Setup ResizeObserver
    this.resizeObserver = new ResizeObserver(() => {
      const w = containerElement.clientWidth;
      const h = containerElement.clientHeight;
      if (w > 0 && h > 0) {
        this.app.resize();
        this.resize$.next({ width: this.app.screen.width, height: this.app.screen.height });
      }
    });
    this.resizeObserver.observe(containerElement);
  }

  get width() {
    return this.app?.screen.width || 0;
  }

  get height() {
    return this.app?.screen.height || 0;
  }

  ngOnDestroy() {
    this.destroy();
  }

  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.app) {
      this.app.destroy(true, {
        children: true,
        texture: false,
      });
      // @ts-ignore
      this.app = null;
    }
  }
}
