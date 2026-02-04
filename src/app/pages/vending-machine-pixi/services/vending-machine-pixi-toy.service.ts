import { Injectable } from '@angular/core';
import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { Toy, VendingMachinePixiDataService } from './vending-machine-pixi-data.service';

interface LayoutParams {
  toysContainer: Container;
  dataService: VendingMachinePixiDataService;
  toyImageCount: number;
  bgColors: number[];
  tagBg: number;
  tagText: number;
  windowWidth: number;
  windowHeight: number;
  rowHeight: number;
  onSelect: (toy: Toy, sprite: Container) => void;
}

interface LayoutResult {
  toyBaseScale: number;
}

@Injectable()
export class VendingMachinePixiToyService {
  generateAndLayout(params: LayoutParams): LayoutResult {
    const {
      toysContainer,
      dataService,
      toyImageCount,
      bgColors,
      tagBg,
      tagText,
      windowWidth,
      windowHeight,
      rowHeight,
      onSelect,
    } = params;

    toysContainer.removeChildren();

    if (dataService.toys.length === 0) {
      dataService.resetRound();
      dataService.buildToys(toyImageCount, bgColors);
    }

    const cols = 3;
    const colWidth = windowWidth / cols;

    const baseWidth = 80;
    const baseHeight = 100;
    const scaleX = (colWidth * 0.85) / baseWidth;
    const scaleY = (rowHeight * 0.85) / baseHeight;
    const nextBaseScale = Math.min(1.5, Math.min(scaleX, scaleY));

    for (let i = 0; i < dataService.toys.length; i++) {
      const toyData = dataService.toys[i];
      const toyContainer = new Container();

      const isSelected = !!dataService.selectedToy && dataService.selectedToy.id === toyData.id;
      toyContainer.scale.set(isSelected ? nextBaseScale * 1.4 : nextBaseScale);

      const row = Math.floor(i / cols);
      const col = i % cols;
      const floorY = -windowHeight / 2 + (row + 1) * rowHeight;
      const yOffset = 55 * nextBaseScale;

      toyContainer.x = -windowWidth / 2 + colWidth / 2 + col * colWidth;
      toyContainer.y = floorY - yOffset;

      // @ts-ignore
      const texture = Assets.get(`assets/images/number-vending/toys/${toyData.imageId}.png`);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);

      const maxDim = Math.max(sprite.width, sprite.height);
      const baseInnerScale = 90 / maxDim;
      toyData.innerScale = baseInnerScale;

      sprite.scale.set(baseInnerScale);
      sprite.y = 0;
      toyContainer.addChild(sprite);

      const tag = this.createPriceTag(toyData.price, isSelected, tagBg, tagText);
      toyContainer.addChild(tag.container);

      toyContainer.eventMode = 'static';
      toyContainer.cursor = 'pointer';
      toyContainer.on('pointerdown', () => onSelect(toyData, toyContainer));

      toysContainer.addChild(toyContainer);
      toyData.sprite = toyContainer;
    }

    return { toyBaseScale: nextBaseScale };
  }

  private createPriceTag(price: number, visible: boolean, tagBg: number, tagText: number) {
    const tag = new Graphics()
      .roundRect(-25, 30, 50, 20, 4)
      .fill(tagBg)
      .stroke({ width: 1, color: 0x000000 });

    const priceText = new Text(`¥${price}`, {
      fontSize: 14,
      fill: tagText,
      fontWeight: 'bold',
    });
    priceText.anchor.set(0.5);
    priceText.y = 40;

    const container = new Container();
    container.addChild(tag, priceText);
    container.visible = visible;

    return { container };
  }
}
