import { Injectable } from '@angular/core';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GoodsItem } from 'src/app/store/number-market.store';
import { LearnMode } from 'src/app/app.types';

@Injectable({
  providedIn: 'root',
})
export class NumberMarketGoodsService {

  renderGoods(
    goods: GoodsItem[],
    container: Container, // goodsContainer
    dragContainer: Container, // The layer to move items to when dragging
    targetGoodsId: string | undefined,
    screenWidth: number,
    screenHeight: number,
    learnMode: LearnMode,
    // Callbacks for interaction
    callbacks: {
      checkHitCart: (itemContainer: Container) => boolean;
      onDropToCart: (item: GoodsItem) => void;
      onDropFail: () => void;
      onSelect: (item: GoodsItem) => void;
      playClick: () => void;
    }
  ) {
    // Clean up
    const children = [...container.children];
    for (let i = children.length - 1; i >= 0; i--) {
      // @ts-ignore
      if (children[i].label !== 'goods-bg') {
        container.removeChild(children[i]);
      }
    }

    const goodsHeight = screenHeight * 0.4;
    const goodsY = 80;

    const cols = 4;
    const rows = 2;
    const padding = 40;
    const availableWidth = screenWidth - padding * 2;
    const availableHeight = goodsHeight - padding;

    const itemWidth = availableWidth / cols;
    const itemHeight = availableHeight / rows;
    const itemSize = Math.min(itemWidth, itemHeight) * 0.6;

    goods.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = padding + col * itemWidth + itemWidth / 2;
      const y = goodsY + padding / 2 + row * itemHeight + itemHeight / 2;

      const itemContainer = this.createDraggableItem(
        item, x, y, itemSize,
        dragContainer,
        targetGoodsId,
        learnMode,
        container,
        callbacks
      );
      container.addChild(itemContainer);
    });
  }

  private createDraggableItem(
    item: GoodsItem,
    x: number,
    y: number,
    size: number,
    dragContainer: Container,
    targetGoodsId: string | undefined,
    learnMode: LearnMode,
    parentContainer: Container,
    callbacks: {
      checkHitCart: (itemContainer: Container) => boolean;
      onDropToCart: (item: GoodsItem) => void;
      onDropFail: () => void;
      onSelect: (item: GoodsItem) => void;
      playClick: () => void;
    }
  ): Container {
    const container = new Container();
    container.x = x;
    container.y = y;
    container.label = item.id;

    // Shadow
    const shadow = new Graphics();
    shadow.circle(0, 6, size / 2);
    shadow.fill({ color: 0x000000, alpha: 0.15 });

    // Background
    const bg = new Graphics();
    bg.circle(0, 0, size / 2);
    bg.fill({ color: 0xffedd5, alpha: 1 }); // Default bg
    bg.stroke({ width: 3, color: 0xfb923c });

    // Inner glow
    const glow = new Graphics();
    glow.circle(0, 0, size / 2 - 5);
    glow.fill({ color: 0xffedd5, alpha: 0.5 });

    // Selection Border (Advanced Mode only)
    if (learnMode === LearnMode.Advanced && item.selected) {
      const selectionBorder = new Graphics();
      selectionBorder.circle(0, 0, size / 2 + 8);
      selectionBorder.stroke({ width: 6, color: 0x22c55e, alpha: 0.8 });

      let pulsePhase = 0;
      const pulseAnimation = () => {
        if (!container.destroyed && item.selected) {
          pulsePhase += 0.1;
          selectionBorder.alpha = 0.5 + Math.sin(pulsePhase) * 0.3;
          requestAnimationFrame(pulseAnimation);
        }
      };
      pulseAnimation();
      container.addChild(selectionBorder);
    }

    const text = new Text({
      text: item.image,
      style: new TextStyle({
        fontSize: size * 0.6,
        align: 'center',
      }),
    });
    text.anchor.set(0.5);

    container.addChild(shadow);
    container.addChild(bg);
    container.addChild(glow);
    container.addChild(text);

    container.eventMode = 'static';
    container.cursor = 'pointer';

    let dragData: any = null;
    let startPosition = { x: 0, y: 0 };
    let isDragging = false;
    let hoverAnimation: any = null;
    let clickStartPos: { x: number, y: number } | null = null;

    // Interactions
    container.on('pointerover', () => {
      if (!isDragging) {
        container.scale.set(1.1);
        let bounce = 0;
        hoverAnimation = setInterval(() => {
          bounce += 0.1;
          container.y = y + Math.sin(bounce) * 3;
        }, 16);
      }
    });

    container.on('pointerout', () => {
      if (!isDragging) {
        container.scale.set(1);
        container.y = y;
        if (hoverAnimation) {
          clearInterval(hoverAnimation);
          hoverAnimation = null;
        }
      }
    });

    container.on('pointerdown', (event) => {
      if (hoverAnimation) {
        clearInterval(hoverAnimation);
        hoverAnimation = null;
      }
      clickStartPos = { x: event.global.x, y: event.global.y };
      dragData = event;
      startPosition = { x: container.x, y: container.y };
      callbacks.playClick();
    });

    container.on('globalpointermove', (event) => {
      if (dragData && !isDragging && clickStartPos) {
        const moveDistance = Math.sqrt(
          Math.pow(event.global.x - clickStartPos.x, 2) +
          Math.pow(event.global.y - clickStartPos.y, 2)
        );

        if (moveDistance > 5) {
          isDragging = true;
          container.alpha = 0.9;
          container.scale.set(1.3);
          shadow.alpha = 0.3;

          // Reparent to drag layer
          const globalPos = container.getGlobalPosition();
          dragContainer.addChild(container);
          container.position.set(globalPos.x, globalPos.y);
        }
      }

      if (isDragging && dragData) {
        const newPosition = dragContainer.toLocal(event.global);
        container.x = newPosition.x;
        container.y = newPosition.y;
      }
    });

    container.on('pointerup', () => {
      if (isDragging) {
        isDragging = false;
        container.alpha = 1;
        container.scale.set(1);
        shadow.alpha = 0.15;

        if (callbacks.checkHitCart(container)) {
          if (item.id === targetGoodsId) {
            // Success
            dragContainer.removeChild(container);
            callbacks.onDropToCart(item); // Logic handled by game service (add to cart, re-render)
          } else {
            // Wrong item
            callbacks.onDropFail();
            this.animateBack(container, startPosition, () => {
              parentContainer.addChild(container);
              container.position.set(startPosition.x, startPosition.y);
            });
          }
        } else {
          // Not dropped on cart
          this.animateBack(container, startPosition, () => {
            parentContainer.addChild(container);
            container.position.set(startPosition.x, startPosition.y);
          });
        }
      } else if (learnMode === LearnMode.Advanced && clickStartPos) {
        // Click selection
        callbacks.onSelect(item);
        container.scale.set(1.2);
        setTimeout(() => container.scale.set(1.0), 200);
      }

      dragData = null;
      clickStartPos = null;
    });

    container.on('pointerupoutside', () => {
      if (isDragging) {
        // @ts-ignore
        container.emit('pointerup', {});
      }
    });

    return container;
  }

  private animateBack(
    item: Container,
    target: { x: number; y: number },
    onComplete: () => void,
  ) {
    const startX = item.x;
    const startY = item.y;
    const duration = 200;
    const startTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      item.x = startX + (target.x - startX) * ease;
      item.y = startY + (target.y - startY) * ease;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        onComplete();
      }
    };
    tick();
  }
}
