import { Injectable } from '@angular/core';
import { Application } from 'pixi.js';
import { VENDING_MACHINE_COLORS, VendingMachineColors } from '../vending-machine-pixi.colors';

@Injectable()
export class VendingMachinePixiThemeService {
  getColors(isDarkMode: boolean): VendingMachineColors {
    return isDarkMode ? VENDING_MACHINE_COLORS.dark : VENDING_MACHINE_COLORS.light;
  }

  getInitialTheme() {
    const isDarkMode = document.body.classList.contains('dark');
    return {
      isDarkMode,
      colors: this.getColors(isDarkMode),
    };
  }

  applyBackground(app: Application, isDarkMode: boolean) {
    const bgColor = isDarkMode ? '#082F49' : '#f0f9ff';
    app.renderer.background.color = bgColor;
  }

  bindThemeObserver(onThemeChange: (isDarkMode: boolean) => void) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const isDark = document.body.classList.contains('dark');
          onThemeChange(isDark);
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }

  rebuildScene(params: {
    app: Application;
    buildScene: () => void;
    generateToys: () => void;
    updateDisplay: () => void;
  }) {
    const { app, buildScene, generateToys, updateDisplay } = params;
    app.stage.removeChildren();
    buildScene();
    generateToys();
    updateDisplay();
  }
}
