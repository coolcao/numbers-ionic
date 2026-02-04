import { Injectable } from '@angular/core';
import { Container, Sprite, Text } from 'pixi.js';
import { AudioService } from 'src/app/service/audio.service';
import { VendingMachinePixiDataService, Toy } from './vending-machine-pixi-data.service';
import { VendingMachinePixiFeedbackService } from './vending-machine-pixi-feedback.service';

@Injectable()
export class VendingMachinePixiInteractionService {
  constructor(private feedbackService: VendingMachinePixiFeedbackService) {}

  selectToy(params: {
    toy: Toy;
    sprite: Container;
    isProcessing: boolean;
    dataService: VendingMachinePixiDataService;
    audioService: AudioService;
    toyBaseScale: number;
  }) {
    const { toy, sprite, isProcessing, dataService, audioService, toyBaseScale } = params;
    if (isProcessing) return;

    dataService.selectedToy = toy;
    dataService.currentBalance = 0;
    audioService.play('click', { interrupt: false });

    dataService.toys.forEach(t => {
      if (t.sprite) {
        t.sprite.alpha = 0.5;
        t.sprite.scale.set(toyBaseScale);

        t.sprite.children.forEach(c => {
          if (!(c instanceof Sprite)) c.visible = false;
        });
      }
    });

    sprite.alpha = 1;
    sprite.scale.set(toyBaseScale * 1.4);

    sprite.children.forEach(c => {
      if (!(c instanceof Sprite)) c.visible = true;
    });
  }

  updateDisplay(params: {
    dataService: VendingMachinePixiDataService;
    displayPriceText: Text;
    displayBalanceText: Text;
    coinWalletContainer: Container;
    pushBtn: Container;
    pushText: Text;
    pushGlow?: Sprite | Container | null;
    isProcessing: boolean;
  }) {
    const {
      dataService,
      displayPriceText,
      displayBalanceText,
      coinWalletContainer,
      pushBtn,
      pushText,
      pushGlow,
      isProcessing,
    } = params;

    this.feedbackService.setDisplayText({
      displayPriceText,
      displayBalanceText,
      selectedToy: dataService.selectedToy,
      currentBalance: dataService.currentBalance,
    });

    this.updatePushStatus({
      dataService,
      pushBtn,
      pushText,
      pushGlow,
    });

    this.updateWalletState({
      dataService,
      coinWalletContainer,
      isProcessing,
    });
  }

  private updateWalletState(params: {
    dataService: VendingMachinePixiDataService;
    coinWalletContainer: Container;
    isProcessing: boolean;
  }) {
    const { dataService, coinWalletContainer, isProcessing } = params;
    if (!coinWalletContainer) return;

    const isEnabled = !!dataService.selectedToy && !isProcessing;

    coinWalletContainer.children.forEach(child => {
      if (child.label === 'visual_coin') {
        child.alpha = isEnabled ? 1 : 0.5;
        child.eventMode = isEnabled ? 'static' : 'none';
        child.cursor = isEnabled ? 'grab' : 'default';
      }
    });
  }

  private updatePushStatus(params: {
    dataService: VendingMachinePixiDataService;
    pushBtn: Container;
    pushText: Text;
    pushGlow?: Sprite | Container | null;
  }) {
    const { dataService, pushBtn, pushText, pushGlow } = params;
    if (!dataService.selectedToy || dataService.currentBalance === 0) {
      pushText.style.fill = '#7F8FA6';
      pushBtn.alpha = 1;
      if (pushGlow) pushGlow.alpha = 0.05;
      return;
    }

    pushText.style.fill = '#00FF00';
    pushBtn.alpha = 1;
    if (pushGlow) pushGlow.alpha = 0.2;
  }
}
