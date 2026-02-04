import { Injectable } from '@angular/core';
import { LearnMode } from 'src/app/app.types';
import { VendingMachinePixiDataService, Toy } from './vending-machine-pixi-data.service';

export type CheckoutStatus = 'no-selection' | 'insufficient' | 'exact' | 'overpaid';

export interface CheckoutResult {
  status: CheckoutStatus;
  change: number;
}

@Injectable()
export class VendingMachinePixiGameService {
  getCoinsForMode(mode: LearnMode) {
    return mode === LearnMode.Starter ? [1, 5] : [1, 5, 10];
  }

  applyCoin(currentBalance: number, value: number) {
    return currentBalance + value;
  }

  evaluateCheckout(selectedToy: Toy | null, currentBalance: number): CheckoutResult {
    if (!selectedToy) {
      return { status: 'no-selection', change: 0 };
    }

    if (currentBalance < selectedToy.price) {
      return { status: 'insufficient', change: selectedToy.price - currentBalance };
    }

    if (currentBalance === selectedToy.price) {
      return { status: 'exact', change: 0 };
    }

    return { status: 'overpaid', change: currentBalance - selectedToy.price };
  }

  applyPurchase(dataService: VendingMachinePixiDataService) {
    if (!dataService.selectedToy) return;
    dataService.purchasedCount++;
    dataService.purchasedImageIds.push(dataService.selectedToy.imageId);
  }

  resetRound(dataService: VendingMachinePixiDataService) {
    dataService.resetRound();
    dataService.clearToys();
  }
}
