import { Injectable } from '@angular/core';
import { AudioService } from 'src/app/service/audio.service';
import { VendingMachinePixiDataService } from './vending-machine-pixi-data.service';
import { VendingMachinePixiGameService } from './vending-machine-pixi-game.service';
import { VendingMachinePixiFeedbackService } from './vending-machine-pixi-feedback.service';
import { Text } from 'pixi.js';

@Injectable()
export class VendingMachinePixiCheckoutService {
  handleCheckout(params: {
    dataService: VendingMachinePixiDataService;
    gameService: VendingMachinePixiGameService;
    feedbackService: VendingMachinePixiFeedbackService;
    audioService: AudioService;
    displayPriceText: Text;
    onSuccess: (message: string) => void;
    onPress: () => void;
  }) {
    const { dataService, gameService, feedbackService, audioService, displayPriceText, onSuccess, onPress } = params;

    const checkout = gameService.evaluateCheckout(dataService.selectedToy, dataService.currentBalance);

    if (checkout.status === 'no-selection') {
      audioService.play('checkout_fail');
      return;
    }

    if (checkout.status === 'insufficient') {
      audioService.play('checkout_fail');
      feedbackService.flashInsufficient({
        displayPriceText,
        getSelectedToy: () => dataService.selectedToy,
      });
      return;
    }

    onPress();

    if (checkout.status === 'exact') {
      onSuccess('购买成功!');
      return;
    }

    onSuccess(`找零: ¥${checkout.change}`);
  }
}
