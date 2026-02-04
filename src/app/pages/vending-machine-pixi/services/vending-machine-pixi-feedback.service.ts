import { Injectable } from '@angular/core';
import { Text } from 'pixi.js';
import { Toy } from './vending-machine-pixi-data.service';

@Injectable()
export class VendingMachinePixiFeedbackService {
  setDisplayText(params: {
    displayPriceText: Text;
    displayBalanceText: Text;
    selectedToy: Toy | null;
    currentBalance: number;
  }) {
    const { displayPriceText, displayBalanceText, selectedToy, currentBalance } = params;

    if (!selectedToy) {
      displayPriceText.text = '请选商品';
      displayPriceText.style.fill = '#00ff00';
    } else {
      displayPriceText.text = `价格: ¥${selectedToy.price}`;
      displayPriceText.style.fill = '#ff5252';
    }

    displayBalanceText.text = `已投: ¥${currentBalance}`;
    displayBalanceText.style.fill = '#00ff00';
  }

  flashInsufficient(params: {
    displayPriceText: Text;
    getSelectedToy: () => Toy | null;
    durationMs?: number;
    text?: string;
    color?: string;
  }) {
    const { displayPriceText, getSelectedToy } = params;
    const durationMs = params.durationMs ?? 1500;
    const text = params.text ?? '钱不够哦';
    const color = params.color ?? '#ff0000';

    const originalText = displayPriceText.text;
    const originalColor = displayPriceText.style.fill;

    displayPriceText.text = text;
    displayPriceText.style.fill = color;

    setTimeout(() => {
      if (getSelectedToy()) {
        displayPriceText.text = originalText;
        displayPriceText.style.fill = originalColor;
      }
    }, durationMs);
  }
}
