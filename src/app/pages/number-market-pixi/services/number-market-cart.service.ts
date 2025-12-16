import { Injectable } from '@angular/core';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { GoodsItem } from 'src/app/store/number-market.store';
import { LearnMode } from 'src/app/app.types';

@Injectable({
  providedIn: 'root',
})
export class NumberMarketCartService {

  renderCartItems(
    cartGoods: GoodsItem[],
    container: Container, // cartContainer
    cartZone: Graphics,
    screenWidth: number,
    screenHeight: number,
    learnMode: LearnMode,
    callbacks: {
      onRemove: (index: number) => void;
      playClick: () => void;
    }
  ) {
    if (!container || !cartZone) return;

    // Remove old items (keep background)
    container.removeChildren();
    container.addChild(cartZone);

    const bounds = (cartZone as any).hitAreaBounds;
    if (!bounds) return;

    const cartHeight = screenHeight * 0.35;
    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;
    const isSmallHeight = cartHeight < 200;

    // Badge
    const totalCount = cartGoods.reduce((sum, item) => sum + (item.amount || 1), 0);
    this.addCartCountBadge(totalCount, container, screenWidth, bounds.width); // Adjust positioning logic

    // Layout Logic
    let padding: number;
    let topPadding: number;

    if (isSmallHeight) {
      padding = isMobile ? 5 : 10;
      topPadding = 3;
    } else if (isMobile) {
      padding = 8;
      topPadding = 5;
    } else {
      padding = 15;
      topPadding = 15;
    }

    const availableWidth = bounds.width - padding * 2;
    let baseItemSize: number;
    let maxItemSize: number;
    let itemSpacing: number;

    if (isMobile) {
      baseItemSize = 32;
      maxItemSize = Math.min(45, availableWidth / 6);
      itemSpacing = isSmallHeight ? 3 : 5;
    } else if (isTablet) {
      baseItemSize = 65;
      maxItemSize = Math.min(80, availableWidth / 4);
      itemSpacing = 9;
    } else {
      baseItemSize = 75;
      maxItemSize = Math.min(100, availableWidth / 3.5);
      itemSpacing = 10;
    }

    const itemSize = Math.max(baseItemSize, maxItemSize);
    const cols = Math.floor(availableWidth / (itemSize + itemSpacing));

    cartGoods.forEach((item, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = bounds.x + padding + col * (itemSize + itemSpacing) + itemSize / 2;
      const y = bounds.y + topPadding + row * (itemSize + itemSpacing) + itemSize / 2;

      const itemContainer = new Container();
      itemContainer.x = x;
      itemContainer.y = y;

      const shadow = new Graphics();
      shadow.circle(0, 4, itemSize / 2 - 2);
      shadow.fill({ color: 0x000000, alpha: 0.1 });

      const bg = new Graphics();
      bg.circle(0, 0, itemSize / 2 - 2);
      bg.fill({ color: 0xffedd5 });
      bg.stroke({ width: 2, color: 0xfed7aa });

      const text = new Text({
        text: item.image,
        style: new TextStyle({ fontSize: itemSize * 0.5 }),
      });
      text.anchor.set(0.5);
      text.y = item.amount > 1 ? -itemSize * 0.1 : 0;

      itemContainer.addChild(shadow);
      itemContainer.addChild(bg);
      itemContainer.addChild(text);

      if (learnMode === LearnMode.Advanced && item.amount > 1) {
        const amountText = new Text({
          text: `x${item.amount}`,
          style: new TextStyle({
            fontSize: itemSize * 0.25,
            fill: 0xef4444,
            fontWeight: 'bold',
            stroke: { color: 0xffffff, width: 1 },
          }),
        });
        amountText.anchor.set(0.5);
        amountText.y = itemSize * 0.25;
        itemContainer.addChild(amountText);
      }

      itemContainer.eventMode = 'static';
      itemContainer.cursor = 'pointer';

      let pulsePhase = Math.random() * Math.PI * 2;
      const pulseAnimation = () => {
        // Safe to update if container exists
        if (!itemContainer.destroyed) {
          pulsePhase += 0.05;
          itemContainer.scale.set(1 + Math.sin(pulsePhase) * 0.05);
          requestAnimationFrame(pulseAnimation);
        }
      };
      pulseAnimation();

      itemContainer.on('pointerover', () => {
        itemContainer.scale.set(1.15);
        bg.tint = 0xfed7aa;
      });
      itemContainer.on('pointerout', () => {
        itemContainer.scale.set(1);
        bg.tint = 0xffffff;
      });
      itemContainer.on('pointerdown', () => {
        callbacks.onRemove(index);
        callbacks.playClick();
      });

      container.addChild(itemContainer);
    });
  }

  private addCartCountBadge(count: number, container: Container, screenWidth: number, cartWidth: number) {
    // Note: This logic previously depended on global width/height in component. 
    // We are now relative to container, but badge needs absolute position usually inside the cart container.
    // The previous implementation used absolute screen coordinates. 
    // Let's attach it relative to the 'cartZone' if possible, but here we attach to 'container' (which is cartContainer).
    // In LayoutService, cartZone is child of cartContainer.

    // We need to approximate the top-right of the cart.
    // The cartZone bounds are stored in hitAreaBounds. 
    // Wait, we can't easily access cartZone from here unless passed. We passed it!
    const cartZone = container.getChildByLabel('cart');
    const bounds = (cartZone as any)?.hitAreaBounds;

    if (!bounds) return;

    const isMobile = screenWidth < 768;
    const badgeX = bounds.x + bounds.width - 10;
    const badgeY = bounds.y + 15;

    const badgeContainer = new Container();
    badgeContainer.x = badgeX;
    badgeContainer.y = badgeY;

    const badgeRadius = isMobile ? 18 : 22;
    const badgeBg = new Graphics();

    badgeBg.circle(2, 2, badgeRadius);
    badgeBg.fill({ color: 0x000000, alpha: 0.2 });

    badgeBg.circle(0, 0, badgeRadius);
    badgeBg.fill({ color: 0xef4444 });

    badgeBg.circle(0, 0, badgeRadius);
    badgeBg.stroke({ width: 3, color: 0xffffff });

    badgeBg.circle(0, -3, badgeRadius - 5);
    badgeBg.fill({ color: 0xfca5a5, alpha: 0.5 });

    const countText = new Text({
      text: count.toString(),
      style: new TextStyle({
        fontSize: isMobile ? 14 : 16,
        fill: 0xffffff,
        fontWeight: 'bold',
        align: 'center',
      }),
    });
    countText.anchor.set(0.5);

    badgeContainer.addChild(badgeBg);
    badgeContainer.addChild(countText);

    container.addChild(badgeContainer);
    badgeContainer.visible = count > 0;
  }
}
