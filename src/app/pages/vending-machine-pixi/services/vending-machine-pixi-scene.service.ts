import { Injectable } from '@angular/core';
import { Application, Assets, Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';

export interface VendingMachineColors {
  body: number;
  shadow: number;
  glass: number;
  shelf: number;
  panel: number;
  walletBg: number;
  walletBorder: number;
  textHighlight: number;
  headerBg: number;
  headerText: number;
  tagBg: number;
  tagText: number;
  toyStroke: number;
}

export interface VendingMachineLayout {
  machineWidth: number;
  machineHeight: number;
  windowWidth: number;
  windowHeight: number;
  rowHeight: number;
}

export interface VendingMachineSceneRefs {
  machineContainer: Container;
  toysContainer: Container;
  coinWalletContainer: Container;
  toyBoxContainer: Container;
  toyBoxText: Text;
  displayPriceText: Text;
  displayBalanceText: Text;
  coinSlotZone: Graphics;
  coinSlotAnchor: Container;
  pushBtn: Container;
  pushText: Text;
  pushGlow?: Graphics;
}

interface SceneParams {
  app: Application;
  colors: VendingMachineColors;
  isDarkMode: boolean;
  isLandscape: boolean;
  purchasedImageIds: number[];
  purchasedCount: number;
  maxPurchaseCount: number;
  coins: number[];
  onCheckout: () => void;
  onCoinPointerDown: (value: number, x: number, y: number, scale: number) => void;
  onLayoutChange: (layout: VendingMachineLayout) => void;
}

@Injectable()
export class VendingMachinePixiSceneService {
  getToyBoxConfig(screenWidth: number, screenHeight: number, isLandscape: boolean) {
    if (!isLandscape) {
      const isPadPortrait = Math.min(screenWidth, screenHeight) >= 600;
      if (isPadPortrait) {
        return {
          boxWidth: 80,
          boxHeight: 80,
          x: screenWidth * 0.86,
          y: 70,
          badgeRadius: 18,
        };
      }
      return {
        boxWidth: 60,
        boxHeight: 60,
        x: screenWidth - 60,
        y: 45,
        badgeRadius: 20,
      };
    }

    const boxWidth = this.clamp(screenWidth * 0.32, 260, 360);
    const boxHeight = this.clamp(screenHeight * 0.36, 180, 260);
    return {
      boxWidth,
      boxHeight,
      x: screenWidth * 0.78,
      y: screenHeight * 0.32,
      badgeRadius: 18,
    };
  }

  createScene(params: SceneParams): VendingMachineSceneRefs {
    const { app, colors, isDarkMode, isLandscape } = params;
    const { width, height } = app.screen;

    // --- A. Vending Machine Body ---
    const machineContainer = new Container();
    machineContainer.x = isLandscape ? width * 0.35 : width / 2;
    machineContainer.y = isLandscape ? height * 0.5 : height * 0.38;
    app.stage.addChild(machineContainer);

    const machineHeight = height * (isLandscape ? 0.78 : 0.65);
    const isNarrowScreen = width <= 480;
    const maxWidthRatio = isLandscape ? 0.55 : (isNarrowScreen ? 0.95 : 0.85);
    const machineWidth = Math.min(width * maxWidthRatio, machineHeight * 0.72);

    // Support legs/feet - fixed to extend downward from machine bottom
    const legWidth = 28;
    const legHeight = 15;
    const legOffsetX = machineWidth * 0.3;
    const machineBottom = machineHeight / 2;

    // Left leg
    const leftLeg = new Graphics()
      .roundRect(-legOffsetX - legWidth / 2, machineBottom, legWidth, legHeight, 6)
      .fill({ color: 0x1A1A1A })
      .stroke({ width: 2, color: 0x0A0A0A });
    machineContainer.addChild(leftLeg);

    // Left leg top highlight
    const leftLegTop = new Graphics()
      .roundRect(-legOffsetX - legWidth / 2 + 4, machineBottom + 3, legWidth - 8, 6, 3)
      .fill({ color: 0x404040 });
    machineContainer.addChild(leftLegTop);

    // Right leg
    const rightLeg = new Graphics()
      .roundRect(legOffsetX - legWidth / 2, machineBottom, legWidth, legHeight, 6)
      .fill({ color: 0x1A1A1A })
      .stroke({ width: 2, color: 0x0A0A0A });
    machineContainer.addChild(rightLeg);

    // Right leg top highlight
    const rightLegTop = new Graphics()
      .roundRect(legOffsetX - legWidth / 2 + 4, machineBottom + 3, legWidth - 8, 6, 3)
      .fill({ color: 0x404040 });
    machineContainer.addChild(rightLegTop);

    // Ground shadow under legs
    const legShadow = new Graphics()
      .ellipse(-legOffsetX, machineBottom + legHeight, legWidth * 0.6, 6)
      .fill({ color: 0x000000, alpha: 0.3 })
      .ellipse(legOffsetX, machineBottom + legHeight, legWidth * 0.6, 6)
      .fill({ color: 0x000000, alpha: 0.3 });
    machineContainer.addChild(legShadow);

    // Shadow
    const shadow = new Graphics()
      .roundRect(-machineWidth / 2 + 6, -machineHeight / 2 + 6, machineWidth, machineHeight, 18)
      .fill({ color: colors.shadow, alpha: isDarkMode ? 0.5 : 0.12 });
    machineContainer.addChild(shadow);

    // Body
    const body = new Graphics()
      .roundRect(-machineWidth / 2, -machineHeight / 2, machineWidth, machineHeight, 18)
      .fill(colors.body)
      .stroke({ width: 5, color: colors.panel });
    machineContainer.addChild(body);

    // Body accents (subtle highlight + side shade)
    const bodyHighlight = new Graphics()
      .roundRect(-machineWidth / 2 + 6, -machineHeight / 2 + 6, machineWidth - 12, machineHeight * 0.12, 14)
      .fill({ color: 0xFFFFFF, alpha: 0.12 });
    machineContainer.addChild(bodyHighlight);

    const bodyShade = new Graphics()
      .roundRect(-machineWidth / 2, -machineHeight / 2, machineWidth * 0.12, machineHeight, 18)
      .fill({ color: 0x000000, alpha: isDarkMode ? 0.2 : 0.08 });
    machineContainer.addChild(bodyShade);

    const bodyInnerStroke = new Graphics()
      .roundRect(-machineWidth / 2 + 4, -machineHeight / 2 + 4, machineWidth - 8, machineHeight - 8, 16)
      .stroke({ width: 2, color: colors.textHighlight, alpha: 0.18 });
    machineContainer.addChild(bodyInnerStroke);

    const screwOffsetX = machineWidth / 2 - 18;
    const screwOffsetY = machineHeight / 2 - 18;
    const screws = new Graphics()
      .circle(-screwOffsetX, -screwOffsetY, 4)
      .fill({ color: 0x000000, alpha: 0.25 })
      .circle(screwOffsetX, -screwOffsetY, 4)
      .fill({ color: 0x000000, alpha: 0.25 })
      .circle(-screwOffsetX, screwOffsetY, 4)
      .fill({ color: 0x000000, alpha: 0.25 })
      .circle(screwOffsetX, screwOffsetY, 4)
      .fill({ color: 0x000000, alpha: 0.25 });
    machineContainer.addChild(screws);

    // Header / Title
    const headerHeight = machineHeight * 0.09;
    const header = new Graphics()
      .roundRect(-machineWidth / 2 + 6, -machineHeight / 2 + 6, machineWidth - 12, headerHeight, 12)
      .fill(colors.headerBg);
    machineContainer.addChild(header);

    const titleText = new Text('TOY SHOP', {
      fontSize: headerHeight * 0.6,
      fill: colors.headerText,
      fontWeight: '900',
      fontFamily: 'Arial Black',
      stroke: { color: '#FFFFFF', width: 6, join: 'round' },
      padding: 15,
      dropShadow: {
        alpha: 0.3,
        blur: 4,
        color: '#000000',
        distance: 4,
        angle: Math.PI / 6,
      },
    });
    titleText.anchor.set(0.5);
    titleText.y = -machineHeight / 2 + 6 + headerHeight / 2;
    machineContainer.addChild(titleText);

    // --- Display Window ---
    const windowMargin = 10;
    const windowWidth = machineWidth - windowMargin * 2;
    const windowHeight = machineHeight * 0.5;
    const windowY = -machineHeight / 2 + headerHeight + 12 + windowHeight / 2;

    const glass = new Graphics()
      .rect(-windowWidth / 2, -windowHeight / 2, windowWidth, windowHeight)
      .fill({ color: colors.glass, alpha: 0.9 })
      .stroke({ width: 3, color: colors.textHighlight });

    // Shelves
    const shelfCount = 3;
    const rowHeight = windowHeight / shelfCount;
    for (let i = 1; i < shelfCount; i++) {
      const shelfY = -windowHeight / 2 + i * rowHeight;
      glass.rect(-windowWidth / 2, shelfY, windowWidth, 3).fill(colors.shelf);
    }

    const glassContainer = new Container();
    glassContainer.y = windowY;
    glassContainer.addChild(glass);
    machineContainer.addChild(glassContainer);

    const glassShine = new Graphics()
      .poly([
        -windowWidth / 2 + 10, -windowHeight / 2 + 10,
        -windowWidth / 2 + windowWidth * 0.35, -windowHeight / 2 + 10,
        windowWidth / 2 - 10, windowHeight / 2 - 10,
        windowWidth / 2 - windowWidth * 0.35, windowHeight / 2 - 10,
      ])
      .fill({ color: 0xFFFFFF, alpha: isDarkMode ? 0.04 : 0.08 });
    glassContainer.addChild(glassShine);

    const toysContainer = new Container();
    glassContainer.addChild(toysContainer);

    // --- Control Panel Area ---
    const bottomAreaY = windowY + windowHeight / 2 + 5;
    const controlPanelWidth = machineWidth * 0.4;
    const controlPanelX = machineWidth / 2 - controlPanelWidth / 2 - 10;
    const panelHeight = (machineHeight / 2 - bottomAreaY) * 0.85;
    const controlPanelY = machineHeight / 2 - panelHeight / 2 - 15;

    const panelBg = new Graphics()
      .roundRect(-controlPanelWidth / 2, -panelHeight / 2, controlPanelWidth, panelHeight, 10)
      .fill(colors.panel);

    const panelContainer = new Container();
    panelContainer.x = controlPanelX;
    panelContainer.y = controlPanelY;
    panelContainer.addChild(panelBg);
    machineContainer.addChild(panelContainer);

    const panelInset = new Graphics()
      .roundRect(-controlPanelWidth / 2 + 6, -panelHeight / 2 + 6, controlPanelWidth - 12, panelHeight - 12, 8)
      .stroke({ width: 2, color: colors.textHighlight, alpha: 0.15 });
    panelContainer.addChild(panelInset);

    // Display screen
    const screenH = panelHeight * 0.3;
    const screenY = -panelHeight / 2 + 8;
    const screenGlow = new Graphics()
      .rect(-controlPanelWidth / 2 + 4, screenY - 2, controlPanelWidth - 8, screenH + 4)
      .fill({ color: 0x00FF7F, alpha: isDarkMode ? 0.08 : 0.12 });
    panelContainer.addChild(screenGlow);
    const screenBg = new Graphics()
      .rect(-controlPanelWidth / 2 + 5, screenY, controlPanelWidth - 10, screenH)
      .fill(0x000000);
    panelContainer.addChild(screenBg);

    const screenCenterY = screenY + screenH / 2;

    const priceStyle = new TextStyle({
      fontFamily: 'Courier New, Arial',
      fontSize: Math.min(screenH * 0.32, 16),
      fill: '#00FF00',
      fontWeight: 'bold',
      align: 'center',
    });

    const displayPriceText = new Text({ text: '选择', style: priceStyle });
    displayPriceText.anchor.set(0.5);
    displayPriceText.y = screenCenterY - screenH * 0.22;
    panelContainer.addChild(displayPriceText);

    const displayBalanceText = new Text({
      text: '¥0',
      style: { ...priceStyle, fontSize: Math.min(screenH * 0.28, 14), fill: '#F1C40F' } as any
    });
    displayBalanceText.anchor.set(0.5);
    displayBalanceText.y = screenCenterY + screenH * 0.22;
    panelContainer.addChild(displayBalanceText);

    // Coin Slot
    const slotRadius = Math.min(controlPanelWidth * 0.28, panelHeight * 0.15);
    const slotCenterY = panelHeight * 0.22;

    const slotOuter = new Graphics()
      .circle(0, slotCenterY, slotRadius)
      .fill(0x7F8FA6)
      .stroke({ width: 2, color: 0xDCDDE1 });
    const slotInner = new Graphics()
      .circle(0, slotCenterY, slotRadius * 0.72)
      .fill({ color: 0x000000, alpha: 0.35 });

    const holeW = slotRadius * 0.25;
    const holeH = slotRadius * 1.1;
    const slotHole = new Graphics()
      .rect(-holeW / 2, slotCenterY - holeH / 2, holeW, holeH)
      .fill(0x000000);

    const slotText = new Text({
      text: 'COIN',
      style: {
        fontSize: Math.max(8, slotRadius * 0.4),
        fill: '#FFFFFF',
        fontWeight: 'bold'
      }
    });
    slotText.anchor.set(0.5);
    slotText.y = slotCenterY + slotRadius + (panelHeight * 0.05);

    const coinSlotZone = slotOuter;
    const coinSlotAnchor = new Container();
    coinSlotAnchor.x = 0;
    coinSlotAnchor.y = slotCenterY;
    panelContainer.addChild(slotOuter, slotInner, slotHole, slotText, coinSlotAnchor);

    // --- Exit Door (PUSH) ---
    const exitW = machineWidth - controlPanelWidth - 25;
    const exitX = -machineWidth / 2 + exitW / 2 + 8;
    const exitH = panelHeight * 0.8;
    const exitY = controlPanelY + panelHeight / 2 - exitH / 2;

    const exitDoor = new Graphics()
      .roundRect(-exitW / 2, -exitH / 2, exitW, exitH, 8)
      .fill(colors.panel);

    const exitGlow = new Graphics()
      .roundRect(-exitW / 2 + 4, -exitH / 2 + 4, exitW - 8, exitH - 8, 6)
      .fill({ color: 0x00FF7F, alpha: 0.06 });

    const exitFlap = new Graphics()
      .rect(-exitW / 2 + 5, -exitH / 2 + 5, exitW - 10, exitH - 10)
      .fill({ color: colors.shadow, alpha: 0.5 })
      .stroke({ width: 1, color: colors.textHighlight });

    const pushText = new Text({
      text: 'PUSH',
      style: { fontSize: exitH * 0.25, fill: '#7F8FA6', fontWeight: 'bold' }
    });
    pushText.anchor.set(0.5);

    const exitContainer = new Container();
    exitContainer.x = exitX;
    exitContainer.y = exitY;
    exitContainer.addChild(exitDoor, exitGlow, exitFlap, pushText);

    exitContainer.eventMode = 'static';
    exitContainer.cursor = 'pointer';
    exitContainer.on('pointerdown', () => params.onCheckout());

    machineContainer.addChild(exitContainer);

    const walletWidth = isLandscape ? Math.min(width * 0.38, machineWidth) : machineWidth;
    const walletX = isLandscape ? width * 0.78 : width / 2;
    const walletY = isLandscape ? height * 0.78 : height - 10;

    const { coinWalletContainer } = this.createCoinWallet({
      app,
      colors,
      walletWidth,
      walletX,
      walletY,
      coins: params.coins,
      onCoinPointerDown: params.onCoinPointerDown,
    });

    const { toyBoxContainer, toyBoxText } = this.createToyBoxHUD({
      app,
      colors,
      isLandscape,
      purchasedImageIds: params.purchasedImageIds,
      purchasedCount: params.purchasedCount,
      maxPurchaseCount: params.maxPurchaseCount,
    });

    params.onLayoutChange({ machineWidth, machineHeight, windowWidth, windowHeight, rowHeight });

    return {
      machineContainer,
      toysContainer,
      coinWalletContainer,
      toyBoxContainer,
      toyBoxText,
      displayPriceText,
      displayBalanceText,
      coinSlotZone,
      coinSlotAnchor,
      pushBtn: exitContainer,
      pushText,
      pushGlow: exitGlow,
    };
  }

  createToyBoxHUD(params: {
    app: Application;
    colors: VendingMachineColors;
    isLandscape: boolean;
    purchasedImageIds: number[];
    purchasedCount: number;
    maxPurchaseCount: number;
  }) {
    const { app, colors, isLandscape, purchasedImageIds, purchasedCount, maxPurchaseCount } = params;
    const { width } = app.screen;

    const config = this.getToyBoxConfig(app.screen.width, app.screen.height, isLandscape);
    const boxWidth = config.boxWidth;
    const boxHeight = config.boxHeight;
    const toyBoxContainer = new Container();
    toyBoxContainer.x = config.x;
    toyBoxContainer.y = config.y;
    app.stage.addChild(toyBoxContainer);

    const hasToys = purchasedCount > 0;
    const hudColors = {
      boxFill: hasToys ? this.mixColor(colors.body, 0xFFFFFF, 0.22) : colors.body,
      boxStroke: colors.textHighlight,
      badgeFill: colors.headerText,
      text: colors.textHighlight
    };

    const box = new Graphics();
    box.label = 'toybox_box';
    box.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 12)
      .fill(hudColors.boxFill)
      .stroke({ width: 4, color: hudColors.boxStroke });

    box.moveTo(-boxWidth / 2, -boxHeight / 2 + (isLandscape ? 14 : 18))
      .lineTo(boxWidth / 2, -boxHeight / 2 + (isLandscape ? 14 : 18))
      .stroke({ width: 3, color: hudColors.boxStroke });

    toyBoxContainer.addChild(box);

    const fillLayer = new Graphics();
    fillLayer.label = 'toybox_fill';
    toyBoxContainer.addChild(fillLayer);

    const itemsLayer = new Container();
    itemsLayer.label = 'toybox_items';
    toyBoxContainer.addChild(itemsLayer);

    const bulgeShadow = new Graphics()
      .ellipse(0, 8, boxWidth * 0.26, boxHeight * 0.16)
      .fill({ color: 0x000000, alpha: 0.2 });
    bulgeShadow.label = 'toybox_bulge_shadow';
    bulgeShadow.visible = hasToys;

    const bulgeHighlight = new Graphics()
      .ellipse(0, -6, boxWidth * 0.22, boxHeight * 0.14)
      .fill({ color: 0xFFFFFF, alpha: 0.35 });
    bulgeHighlight.label = 'toybox_bulge_highlight';
    bulgeHighlight.visible = hasToys;

    toyBoxContainer.addChild(bulgeShadow, bulgeHighlight);

    const badge = new Graphics()
      .circle(boxWidth / 2 - 8, -boxHeight / 2 + 8, config.badgeRadius)
      .fill(hudColors.badgeFill)
      .stroke({ width: 2, color: hudColors.boxStroke });
    toyBoxContainer.addChild(badge);

    const toyBoxText = new Text(`${purchasedCount}/${maxPurchaseCount}`, {
      fontFamily: 'Arial',
      fontSize: isLandscape ? 14 : 16,
      fill: hudColors.text,
      fontWeight: 'bold',
      stroke: { width: 2, color: 0x000000, join: 'round' }
    });
    toyBoxText.anchor.set(0.5);
    toyBoxText.position.set(boxWidth / 2 - 8, -boxHeight / 2 + 8);
    toyBoxContainer.addChild(toyBoxText);

    this.updateToyBoxVisuals(
      toyBoxContainer,
      purchasedCount,
      maxPurchaseCount,
      boxWidth,
      boxHeight,
      hudColors.boxFill,
      hudColors.boxStroke,
      purchasedImageIds,
      isLandscape,
    );

    return { toyBoxContainer, toyBoxText };
  }

  createCoinWallet(params: {
    app: Application;
    colors: VendingMachineColors;
    walletWidth: number;
    walletX: number;
    walletY: number;
    coins: number[];
    onCoinPointerDown: (value: number, x: number, y: number, scale: number) => void;
  }) {
    const { app, colors, walletWidth, walletX, walletY, coins, onCoinPointerDown } = params;
    const screenHeight = app.screen.height;
    const screenWidth = app.screen.width;

    let walletHeight = 140;
    let coinScale = 1.0;

    if (screenHeight < 600) {
      walletHeight = 85;
      coinScale = 0.65;
    } else if (screenHeight < 900) {
      walletHeight = 115;
      coinScale = 0.85;
    }

    const coinWalletContainer = new Container();
    coinWalletContainer.x = walletX;
    coinWalletContainer.y = walletY - (walletHeight / 2);
    app.stage.addChild(coinWalletContainer);

    const bg = new Graphics()
      .roundRect(-walletWidth / 2, -walletHeight / 2, walletWidth, walletHeight, 20)
      .fill({ color: colors.walletBg, alpha: 0.95 })
      .stroke({ width: 3, color: colors.walletBorder });
    coinWalletContainer.addChild(bg);

    const spacing = Math.min(110 * coinScale, walletWidth / (coins.length + 0.5));
    const startX = -((coins.length - 1) * spacing) / 2;

    coins.forEach((value, index) => {
      const x = startX + index * spacing;

      const placeholder = this.drawCoinGraphics(value);
      placeholder.scale.set(coinScale);
      placeholder.alpha = 0.3;
      placeholder.x = x;
      coinWalletContainer.addChild(placeholder);

      const visualCoin = this.drawCoinGraphics(value);
      visualCoin.label = `coin_${value}`;
      visualCoin.scale.set(coinScale);
      visualCoin.x = x;

      visualCoin.eventMode = 'static';
      visualCoin.cursor = 'grab';
      visualCoin.on('pointerdown', (e) => onCoinPointerDown(value, e.global.x, e.global.y, coinScale));

      coinWalletContainer.addChild(visualCoin);
    });

    return { coinWalletContainer };
  }

  updateToyBoxVisuals(
    toyBoxContainer: Container,
    purchasedCount: number,
    maxPurchaseCount: number,
    boxWidth = 60,
    boxHeight = 60,
    baseFill = 0xffffff,
    strokeColor = 0xffffff,
    purchasedImageIds: number[] = [],
    isLandscape = false,
  ) {
    const box = toyBoxContainer.children.find((c) => c.label === 'toybox_box') as Graphics | undefined;
    const fillLayer = toyBoxContainer.children.find((c) => c.label === 'toybox_fill') as Graphics | undefined;
    const itemsLayer = toyBoxContainer.children.find((c) => c.label === 'toybox_items') as Container | undefined;
    const bulgeShadow = toyBoxContainer.children.find((c) => c.label === 'toybox_bulge_shadow') as Graphics | undefined;
    const bulgeHighlight = toyBoxContainer.children.find((c) => c.label === 'toybox_bulge_highlight') as Graphics | undefined;

    const hasToys = purchasedCount > 0;

    if (box) {
      const fillColor = hasToys ? this.mixColor(baseFill, 0xFFFFFF, 0.22) : baseFill;
      box.clear()
        .roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 12)
        .fill(fillColor)
        .stroke({ width: 4, color: strokeColor });
      box.moveTo(-boxWidth / 2, -boxHeight / 2 + (isLandscape ? 14 : 18))
        .lineTo(boxWidth / 2, -boxHeight / 2 + (isLandscape ? 14 : 18))
        .stroke({ width: 3, color: strokeColor });
    }

    if (bulgeShadow) bulgeShadow.visible = hasToys;
    if (bulgeHighlight) bulgeHighlight.visible = hasToys;
    if (hasToys && bulgeShadow && bulgeHighlight) {
      const count = Math.max(1, Math.min(purchasedCount, maxPurchaseCount));
      const step = maxPurchaseCount > 1 ? (count - 1) / (maxPurchaseCount - 1) : 0;
      const scale = 0.75 + step * 0.45; // 1个最小，5个最大
      bulgeShadow.scale.set(scale);
      bulgeHighlight.scale.set(scale);
      bulgeShadow.alpha = 0.18 + step * 0.07;
      bulgeHighlight.alpha = 0.3 + step * 0.1;
    }

    if (fillLayer) {
      const ratio = maxPurchaseCount > 0 ? Math.min(1, purchasedCount / maxPurchaseCount) : 0;
      const fillHeight = boxHeight * 0.55 * ratio;
      const y = boxHeight / 2 - 6 - fillHeight;

      fillLayer.clear();
      if (fillHeight > 0) {
        fillLayer.roundRect(-boxWidth / 2 + 6, y, boxWidth - 12, fillHeight, 8)
          .fill({ color: this.mixColor(baseFill, 0xFFFFFF, 0.35), alpha: 0.9 });
      }
    }

    if (itemsLayer) {
      itemsLayer.removeChildren();
      if (hasToys) {
        if (isLandscape && purchasedImageIds.length > 0) {
          const cols = 3;
          const rows = 2;
          const innerW = boxWidth - 16;
          const innerH = boxHeight - 28;
          const cellW = innerW / cols;
          const cellH = innerH / rows;
          const cell = Math.min(cellW, cellH);
          const maxItems = cols * rows;
          const size = cell * 0.8;
          const startX = -innerW / 2 + cellW / 2;
          const startY = -innerH / 2 + cellH / 2 + 10;
          purchasedImageIds.slice(0, maxItems).forEach((id, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            // @ts-ignore
            const texture = Assets.get(`assets/images/number-vending/toys/${id}.png`);
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            const maxDim = Math.max(sprite.width, sprite.height);
            if (maxDim > 0) {
              sprite.scale.set(size / maxDim);
            }
            sprite.x = startX + col * cellW;
            sprite.y = startY + row * cellH;
            itemsLayer.addChild(sprite);
          });
        } else {
          const item1 = new Graphics().circle(-10, 6, 6).fill({ color: 0xffffff, alpha: 0.35 });
          const item2 = new Graphics().circle(8, 2, 7).fill({ color: 0xffffff, alpha: 0.3 });
          const item3 = new Graphics().rect(-4, -6, 10, 10).fill({ color: 0xffffff, alpha: 0.28 });
          itemsLayer.addChild(item1, item2, item3);
        }
      }
    }
  }

  private mixColor(base: number, tint: number, ratio: number) {
    const r = Math.round(((base >> 16) & 0xff) * (1 - ratio) + ((tint >> 16) & 0xff) * ratio);
    const g = Math.round(((base >> 8) & 0xff) * (1 - ratio) + ((tint >> 8) & 0xff) * ratio);
    const b = Math.round((base & 0xff) * (1 - ratio) + (tint & 0xff) * ratio);
    return (r << 16) | (g << 8) | b;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  drawCoinGraphics(value: number): Graphics {
    const g = new Graphics();

    let baseColor = 0xFFFFFF;
    let shadowColor = 0x000000;
    let highlightColor = 0xFFFFFF;

    if (value === 1) {
      baseColor = 0xE0E0E0;
      shadowColor = 0x7F8C8D;
      highlightColor = 0xFFFFFF;
    } else if (value === 5) {
      baseColor = 0xCD7F32;
      shadowColor = 0x5D4037;
      highlightColor = 0xFFA726;
    } else {
      baseColor = 0xFFD700;
      shadowColor = 0x996515;
      highlightColor = 0xFFF176;
    }

    const radius = value === 1 ? 34 : (value === 5 ? 35 : 36);

    g.circle(0, 3, radius).fill(shadowColor);
    g.circle(0, 0, radius).fill(baseColor);
    g.circle(-radius * 0.3, -radius * 0.3, radius * 0.4).fill({ color: highlightColor, alpha: 0.5 });
    g.circle(0, 0, radius * 0.82).stroke({ width: 1.5, color: shadowColor, alpha: 0.4 });

    const text = new Text({
      text: `${value}`,
      style: {
        fontSize: radius * 0.9,
        fontWeight: '900',
        fill: shadowColor,
        fontFamily: 'Arial Black',
        dropShadow: {
          alpha: 0.3,
          angle: 45,
          blur: 1,
          color: highlightColor,
          distance: 1,
        }
      }
    });
    text.anchor.set(0.5);
    text.y = 0;

    g.addChild(text);
    return g;
  }
}
