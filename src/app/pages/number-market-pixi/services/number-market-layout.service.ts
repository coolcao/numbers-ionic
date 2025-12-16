import { Injectable } from '@angular/core';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';

@Injectable({
  providedIn: 'root',
})
export class NumberMarketLayoutService {

  drawShelf(
    container: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    screenWidth: number,
    isDarkMode: boolean
  ) {
    const shelfBg = new Graphics();
    const isMobile = screenWidth < 768;

    // 根据暗黑模式调整货架颜色
    const shelfBgColor = isDarkMode ? 0x451a03 : 0xfef3c7;
    const shelfBorderColor = isDarkMode ? 0x7c2d12 : 0xea580c;
    const shelfBgAlpha = isDarkMode ? 0.6 : 0.3;

    // 货架背景
    shelfBg.roundRect(x, y, w, h, 15);
    shelfBg.fill({ color: shelfBgColor, alpha: shelfBgAlpha });

    // 货架边框
    shelfBg.roundRect(x, y, w, h, 15);
    shelfBg.stroke({ width: 6, color: shelfBorderColor });

    // 结构参数
    const shelfCount = 2;
    const shelfHeight = h / shelfCount;
    const shelfThickness = 14;
    const pillarWidth = 10;

    const woodMainColor = isDarkMode ? 0x451a03 : 0x78350f;
    const woodHighlightColor = isDarkMode ? 0x5d1d04 : 0x92400e;
    const woodShadowColor = isDarkMode ? 0x2c0f01 : 0x65260f;

    // 框架
    const framework = new Graphics();
    framework.roundRect(x + 12, y, pillarWidth, h, 5); // 左柱
    framework.fill({ color: woodMainColor });
    framework.roundRect(x + w - 12 - pillarWidth, y, pillarWidth, h, 5); // 右柱
    framework.fill({ color: woodMainColor });

    // 货架板
    for (let i = 0; i < shelfCount; i++) {
      const shelfY = y + i * shelfHeight;
      const shelfBoard = new Graphics();
      // 主体
      shelfBoard.roundRect(x + 8, shelfY + 2, w - 16, shelfThickness, 7);
      shelfBoard.fill({ color: 0x78350f });
      // 高光
      shelfBoard.roundRect(x + 8, shelfY + 2, w - 16, 6, 7);
      shelfBoard.fill({ color: 0x92400e, alpha: 0.6 });
      // 阴影
      shelfBoard.roundRect(x + 8, shelfY + shelfThickness - 2, w - 16, 3, 2);
      shelfBoard.fill({ color: 0x65260f });

      shelfBg.addChild(shelfBoard);
    }

    // 底板
    const bottomBoard = new Graphics();
    bottomBoard.roundRect(x + 8, y + h - 8, w - 16, 8, 5);
    bottomBoard.fill({ color: 0x78350f });
    bottomBoard.roundRect(x + 8, y + h - 8, w - 16, 4, 5);
    bottomBoard.fill({ color: 0x92400e, alpha: 0.6 });
    shelfBg.addChild(bottomBoard);

    shelfBg.addChild(framework);

    // 木纹
    for (let s = 0; s < shelfCount; s++) {
      const levelStartY = y + s * shelfHeight;
      const levelEndY = levelStartY + shelfHeight;
      for (let i = 0; i < 3; i++) {
        const grainY = levelEndY - 20 - i * 20;
        if (grainY > levelStartY + 20) {
          const woodGrain = new Graphics();
          woodGrain.moveTo(x + 15, grainY);
          woodGrain.lineTo(x + w - 15, grainY);
          woodGrain.stroke({ width: 1, color: 0x65260f, alpha: 0.2 });
          shelfBg.addChild(woodGrain);
        }
      }
    }

    // 标签
    const shelfFontSize = isMobile ? 14 : 18;
    const labelWidth = isMobile ? 100 : 120;
    const labelHeight = isMobile ? 26 : 30;
    const labelY = isMobile ? y - 13 : y - 15;

    const signBg = new Graphics();
    signBg.roundRect(x + w / 2 - labelWidth / 2, labelY, labelWidth, labelHeight, 15);
    signBg.fill({ color: 0xfb923c });
    signBg.stroke({ width: 3, color: 0xea580c });

    const signText = new Text({
      text: ' 货架 ',
      style: new TextStyle({
        fontSize: shelfFontSize,
        fill: 0xffffff,
        fontWeight: 'bold',
      }),
    });
    signText.anchor.set(0.5);
    signText.x = x + w / 2;
    signText.y = y;

    shelfBg.addChild(signBg);
    shelfBg.addChild(signText);
    shelfBg.label = 'goods-bg';

    container.addChild(shelfBg);
  }

  drawCart(
    container: Container,
    x: number,
    y: number,
    w: number,
    h: number,
    screenWidth: number,
    isDarkMode: boolean
  ): Graphics {
    const cartZone = new Graphics();

    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;
    const isSmallHeight = h < 200;

    const cartTopOffset = isSmallHeight ? 30 : 50;
    const cartMainY = y + cartTopOffset;
    const cartMainH = h - cartTopOffset;

    const cartMainColor = isDarkMode ? 0x7c2d12 : 0xfb923c;
    const cartInnerColor = isDarkMode ? 0x451a03 : 0xffedd5;
    const cartBorderColor = isDarkMode ? 0x9a3412 : 0xc2410c;

    // Shadow
    cartZone.roundRect(x + 5, cartMainY + 5, w - 10, cartMainH - 10, 20);
    cartZone.fill({ color: 0x000000, alpha: isDarkMode ? 0.3 : 0.1 });

    // Main Body
    cartZone.roundRect(x, cartMainY, w, cartMainH, 20);
    cartZone.fill({ color: cartMainColor });

    // Inner
    cartZone.roundRect(x + 10, cartMainY + 10, w - 20, cartMainH - 20, 15);
    cartZone.fill({ color: cartInnerColor });

    // Border
    cartZone.roundRect(x, cartMainY, w, cartMainH, 20);
    cartZone.stroke({ width: 4, color: cartBorderColor });

    // Grid
    const gridColor = isDarkMode ? 0x78350f : 0xfed7aa;
    const gridSize = 20;
    const gridAlpha = isDarkMode ? 0.5 : 0.3;

    for (let gx = x + 20; gx < x + w - 20; gx += gridSize) {
      cartZone.moveTo(gx, cartMainY + 15);
      cartZone.lineTo(gx, cartMainY + cartMainH - 15);
      cartZone.stroke({ width: 1, color: gridColor, alpha: gridAlpha });
    }
    for (let gy = cartMainY + 20; gy < cartMainY + cartMainH - 20; gy += gridSize) {
      cartZone.moveTo(x + 15, gy);
      cartZone.lineTo(x + w - 15, gy);
      cartZone.stroke({ width: 1, color: gridColor, alpha: gridAlpha });
    }

    // Handle
    const handleY = y + (isSmallHeight ? 5 : 10);
    const handlePath = new Graphics();
    handlePath.moveTo(x + w / 2 - 40, handleY);
    handlePath.bezierCurveTo(
      x + w / 2 - 40, handleY - 20,
      x + w / 2 + 40, handleY - 20,
      x + w / 2 + 40, handleY,
    );
    handlePath.stroke({ width: 8, color: cartBorderColor });
    handlePath.bezierCurveTo(
      x + w / 2 + 40, handleY - 20,
      x + w / 2 - 40, handleY - 20,
      x + w / 2 - 40, handleY,
    );
    handlePath.stroke({ width: 6, color: cartMainColor });
    cartZone.addChild(handlePath);

    // Wheels
    const baseWheelRatio = isMobile ? 0.08 : isTablet ? 0.09 : 0.10;
    let wheelRadius = Math.floor(w * baseWheelRatio);
    const minWheelRadius = isMobile ? 20 : isTablet ? 28 : 35;
    const maxWheelRadius = isMobile ? 40 : isTablet ? 50 : 65;
    wheelRadius = Math.max(minWheelRadius, Math.min(maxWheelRadius, wheelRadius));

    const wheelInnerRadius = wheelRadius * 0.65;
    const wheelCenterRadius = wheelRadius * 0.3;
    const shadowOffset = Math.floor(wheelRadius * 0.15);
    const wheelY = cartMainY + cartMainH - Math.floor(wheelRadius * 0.35);
    const wheelOffset = Math.max(wheelRadius * 1.8, 45);

    [x + wheelOffset, x + w - wheelOffset].forEach((wheelX) => {
      const wheelShadow = new Graphics();
      wheelShadow.circle(wheelX + shadowOffset, wheelY + shadowOffset, wheelRadius);
      wheelShadow.fill({ color: 0x000000, alpha: 0.2 });
      cartZone.addChild(wheelShadow);

      const wheel = new Graphics();
      wheel.circle(wheelX, wheelY, wheelRadius);
      wheel.fill({ color: 0x1f2937 });
      wheel.circle(wheelX, wheelY, wheelInnerRadius);
      wheel.fill({ color: 0x4b5563 });
      wheel.circle(wheelX, wheelY, wheelCenterRadius);
      wheel.fill({ color: 0x9ca3af });

      if (!isMobile) {
        const spokeCount = 6;
        for (let i = 0; i < spokeCount; i++) {
          const angle = (i * Math.PI * 2) / spokeCount;
          wheel.moveTo(
            wheelX + Math.cos(angle) * (wheelCenterRadius + 2),
            wheelY + Math.sin(angle) * (wheelCenterRadius + 2)
          );
          wheel.lineTo(
            wheelX + Math.cos(angle) * (wheelInnerRadius - 2),
            wheelY + Math.sin(angle) * (wheelInnerRadius - 2)
          );
          wheel.stroke({ width: 2, color: 0x6b7280, alpha: 0.6 });
        }
      }
      cartZone.addChild(wheel);
    });

    // Label
    const cartFontSize = isMobile ? 18 : 24;
    const strokeWidth = isMobile ? 2 : 3;
    const labelTextColor = isDarkMode ? 0xfed7aa : 0xc2410c;
    const labelStrokeColor = isDarkMode ? 0x000000 : 0xffffff;
    const labelY = y + (isSmallHeight ? 20 : 30);

    const cartLabel = new Text({
      text: '🛒 购物车',
      style: new TextStyle({
        fontSize: cartFontSize,
        fill: labelTextColor,
        fontWeight: 'bold',
        stroke: { color: labelStrokeColor, width: strokeWidth },
      }),
    });
    cartLabel.anchor.set(0.5);
    cartLabel.x = x + w / 2;
    cartLabel.y = labelY;
    cartZone.addChild(cartLabel);

    cartZone.label = 'cart';

    // Re-added hitAreaBounds from original logic to ensure drop detection works
    const approximateCartHeight = h + 20;
    const hitAreaTopOffset = approximateCartHeight < 200 ? 50 : approximateCartHeight < 250 ? 60 : 80;

    (cartZone as any).hitAreaBounds = {
      x: x + 20,
      y: y + hitAreaTopOffset,
      width: w - 40,
      height: h - hitAreaTopOffset
    };

    container.addChild(cartZone);

    return cartZone;
  }
}
