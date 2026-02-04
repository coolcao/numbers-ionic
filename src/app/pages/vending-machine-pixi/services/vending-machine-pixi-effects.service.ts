import { Injectable } from '@angular/core';
import { timer } from 'rxjs';
import { Application, Assets, BlurFilter, Container, Graphics, Sprite, Text, Ticker } from 'pixi.js';
import { AudioService } from 'src/app/service/audio.service';
import { VendingMachinePixiDataService } from './vending-machine-pixi-data.service';
import { VendingMachinePixiGameService } from './vending-machine-pixi-game.service';

interface SuccessParams {
  app: Application;
  message: string;
  machineContainer: Container;
  coinWalletContainer: Container;
  toyBoxContainer: Container;
  toyBoxText: Text;
  dataService: VendingMachinePixiDataService;
  gameService: VendingMachinePixiGameService;
  audioService: AudioService;
  machineHeight: number;
  windowHeight: number;
  onResetRound: () => void;
  onGoBack: () => void;
}

interface GameOverParams {
  app: Application;
  machineContainer: Container;
  coinWalletContainer: Container;
  toyBoxContainer: Container;
  toyBoxText: Text;
  dataService: VendingMachinePixiDataService;
  audioService: AudioService;
  onResetRound: () => void;
  onGoBack: () => void;
}

@Injectable()
export class VendingMachinePixiEffectsService {
  playSuccess(params: SuccessParams) {
    const {
      app,
      message,
      machineContainer,
      coinWalletContainer,
      toyBoxContainer,
      toyBoxText,
      dataService,
      gameService,
      audioService,
      machineHeight,
      windowHeight,
      onResetRound,
      onGoBack,
    } = params;

    const successText = new Text(message, {
      fontFamily: 'Arial Black',
      fontSize: 48,
      fill: '#E84118',
      stroke: { width: 4, color: '#FFFFFF' },
      dropShadow: {
        alpha: 0.5,
        blur: 4,
        distance: 4,
        angle: Math.PI / 6,
        color: '#000000'
      }
    });
    successText.anchor.set(0.5);

    if (dataService.selectedToy && dataService.selectedToy.sprite) {
      const sprite = dataService.selectedToy.sprite;

      // 1. 坐标系转换
      const globalPos = sprite.getGlobalPosition();
      if (sprite.parent) {
        sprite.parent.removeChild(sprite);
      }
      app.stage.addChild(sprite);
      sprite.position.set(globalPos.x, globalPos.y);

      // 隐藏非图片子对象
      sprite.children.forEach(child => {
        if (!(child instanceof Sprite)) {
          child.visible = false;
        }
      });

      // 2. 计算目标位置
      const targetX = machineContainer.x;
      const headerHeight = machineHeight * 0.09;
      const windowY = -machineHeight / 2 + headerHeight + 12 + windowHeight / 2;
      const targetY = machineContainer.y + windowY;

      successText.x = targetX;
      successText.y = targetY + 150;
      successText.alpha = 0;

      // 3. 准备背景特效
      const blurFilter = new BlurFilter();
      blurFilter.blur = 0;
      machineContainer.filters = [blurFilter];
      coinWalletContainer.filters = [blurFilter];

      const overlay = new Graphics()
        .rect(0, 0, app.screen.width, app.screen.height)
        .fill({ color: 0xFFFFFF, alpha: 0 });

      app.stage.addChild(overlay);
      app.stage.addChild(successText);

      // 撒花放在遮罩之上，玩具之下
      const confettiContainer = new Container();
      app.stage.addChild(confettiContainer);
      this.fireConfetti(app, confettiContainer, targetX, targetY);

      // 确保玩具在最顶层
      app.stage.addChild(sprite);

      let time = 0;
      const animate = (ticker: Ticker) => {
        sprite.x += (targetX - sprite.x) * 0.025;
        sprite.y += (targetY - sprite.y) * 0.025;

        const currentScale = sprite.scale.x;
        const newScale = currentScale + (2.5 - currentScale) * 0.025;
        sprite.scale.set(newScale);

        sprite.rotation = Math.sin(time * 0.03) * 0.1;

        if (time < 60) {
          blurFilter.blur = (time / 60) * 8;
          overlay.alpha = (time / 60) * 0.8;
          successText.alpha = (time / 60);
          successText.y -= 0.5;
        }

        time++;

        if (time > 300) {
          app.ticker.remove(animate);

          successText.destroy();
          confettiContainer.destroy({ children: true });
          overlay.destroy();
          machineContainer.filters = [];
          coinWalletContainer.filters = [];

          // Fly to Toy Box Animation
          this.flyToBox({
            app,
            sprite,
            machineContainer,
            coinWalletContainer,
            toyBoxContainer,
            toyBoxText,
            dataService,
            gameService,
            audioService,
            onResetRound,
            onGoBack,
          });
        }
      };

      app.ticker.add(animate);
    }
  }

  showGameOver(params: GameOverParams) {
    const { app, machineContainer, coinWalletContainer, toyBoxContainer, toyBoxText, dataService, audioService, onResetRound, onGoBack } = params;

    // 创建统一容器，方便管理和销毁
    const gameOverContainer = new Container();
    gameOverContainer.eventMode = 'static';
    gameOverContainer.sortableChildren = true;
    app.stage.addChild(gameOverContainer);

    // 1. 准备模糊效果
    const blurFilter = new BlurFilter();
    blurFilter.blur = 0;
    machineContainer.filters = [blurFilter];
    coinWalletContainer.filters = [blurFilter];
    toyBoxContainer.filters = [blurFilter];

    // 全屏遮罩
    const overlay = new Graphics()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: 0x000000, alpha: 0 });
    gameOverContainer.addChild(overlay);

    // 2. 渐变动画
    let time = 0;
    const fadeIn = (ticker: Ticker) => {
      if (time < 60) {
        const progress = time / 60;
        overlay.alpha = progress * 0.8;
        blurFilter.blur = progress * 10;
        time++;
      } else {
        app.ticker.remove(fadeIn);
      }
    };
    app.ticker.add(fadeIn);

    // 3. 胜利标题
    const gameOverText = new Text('挑战成功', {
      fontFamily: 'Arial Black',
      fontSize: 64,
      fill: '#FFD700',
      stroke: { width: 6, color: '#FFFFFF', join: 'round' },
      dropShadow: { alpha: 0.5, blur: 10, distance: 5, angle: Math.PI / 4, color: '#000000' }
    });
    gameOverText.anchor.set(0.5);
    gameOverText.x = app.screen.width / 2;
    gameOverText.y = app.screen.height * 0.6;
    gameOverContainer.addChild(gameOverText);

    // 4. 展示战利品
    const toysShowcase = new Container();
    toysShowcase.x = app.screen.width / 2;
    toysShowcase.y = app.screen.height * 0.25;
    gameOverContainer.addChild(toysShowcase);

    const row1Count = 3;
    const itemSize = 100;
    const spacing = 20;

    dataService.purchasedImageIds.forEach((imageId, index) => {
      // @ts-ignore
      const texture = Assets.get(`assets/images/number-vending/toys/${imageId}.png`);
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);

      const maxDim = Math.max(sprite.width, sprite.height);
      sprite.scale.set(100 / maxDim);

      let row = 0;
      let col = 0;
      let rowWidth = 0;

      if (index < row1Count) {
        row = 0;
        col = index;
        rowWidth = row1Count * itemSize + (row1Count - 1) * spacing;
      } else {
        row = 1;
        col = index - row1Count;
        const row2Count = dataService.purchasedImageIds.length - row1Count;
        rowWidth = row2Count * itemSize + (row2Count - 1) * spacing;
      }

      const startX = -rowWidth / 2 + itemSize / 2;
      sprite.x = startX + col * (itemSize + spacing);
      sprite.y = row * (itemSize + spacing + 20);

      sprite.scale.set(0);

      let tick = 0;
      const delay = index * 10;
      const bounce = (t: Ticker) => {
        if (sprite.destroyed) {
          app.ticker.remove(bounce);
          return;
        }

        if (tick < delay) {
          tick++;
          return;
        }
        const animTick = tick - delay;
        const progress = Math.min(animTick / 20, 1);

        const s = 100 / maxDim;
        if (progress < 1) {
          const p = progress - 1;
          const scaleFactor = Math.sin(p * Math.PI * 4.5) * p * p + 1;
          sprite.scale.set(s * scaleFactor);
        } else {
          sprite.scale.set(s);
          sprite.rotation = Math.sin(Date.now() / 200 + index) * 0.1;
        }
        tick++;
      };
      app.ticker.add(bounce);
      toysShowcase.addChild(sprite);
    });

    audioService.play('checkout_success');

    // 5. 操作按钮
    const btnY = app.screen.height * 0.75;

    const createBtn = (text: string, color: number, x: number, onClick: () => void) => {
      const btn = new Container();
      btn.x = x;
      btn.y = btnY;

      const bg = new Graphics()
        .roundRect(-65, -25, 130, 50, 25)
        .fill(color)
        .stroke({ width: 3, color: 0xFFFFFF });

      const txt = new Text(text, {
        fontFamily: 'Arial',
        fontSize: 20,
        fontWeight: 'bold',
        fill: 0xFFFFFF
      });
      txt.anchor.set(0.5);

      btn.addChild(bg, txt);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';

      btn.on('pointerdown', () => {
        btn.scale.set(0.9);
        audioService.play('click', { interrupt: false });

        timer(100).subscribe(() => {
          btn.scale.set(1);
          onClick();
        });
      });
      btn.on('pointerup', () => btn.scale.set(1));
      btn.on('pointerupoutside', () => btn.scale.set(1));

      btn.zIndex = 10;
      gameOverContainer.addChild(btn);
      return btn;
    };

    const cleanup = () => {
      gameOverContainer.destroy({ children: true });
      machineContainer.filters = [];
      coinWalletContainer.filters = [];
      toyBoxContainer.filters = [];
    };

    createBtn('再玩一次', 0x2ECC71, app.screen.width / 2 - 80, () => {
      cleanup();
      dataService.purchasedCount = 0;
      dataService.purchasedImageIds = [];
      toyBoxText.text = `0/${dataService.maxPurchaseCount}`;
      onResetRound();
    });

    createBtn('回到首页', 0x3498DB, app.screen.width / 2 + 80, () => {
      timer(300).subscribe(() => {
        cleanup();
        onGoBack();
      });
    });
  }

  private flyToBox(params: {
    app: Application;
    sprite: Container;
    machineContainer: Container;
    coinWalletContainer: Container;
    toyBoxContainer: Container;
    toyBoxText: Text;
    dataService: VendingMachinePixiDataService;
    gameService: VendingMachinePixiGameService;
    audioService: AudioService;
    onResetRound: () => void;
    onGoBack: () => void;
  }) {
    const {
      app,
      sprite,
      machineContainer,
      coinWalletContainer,
      toyBoxContainer,
      toyBoxText,
      dataService,
      gameService,
      audioService,
      onResetRound,
      onGoBack,
    } = params;
    const startX = sprite.x;
    const startY = sprite.y;
    const startScale = sprite.scale.x;

    const targetPos = toyBoxContainer.getGlobalPosition();

    let progress = 0;
    const fly = (ticker: Ticker) => {
      progress += 0.05;

      if (progress >= 1) {
        app.ticker.remove(fly);
        sprite.destroy();

        gameService.applyPurchase(dataService);
        toyBoxText.text = `${dataService.purchasedCount}/${dataService.maxPurchaseCount}`;

        this.bumpToyBox(app, toyBoxContainer);

        if (dataService.purchasedCount >= dataService.maxPurchaseCount) {
          this.showGameOver({
            app,
            machineContainer,
            coinWalletContainer,
            toyBoxContainer,
            toyBoxText,
            dataService,
            audioService,
            onResetRound,
            onGoBack,
          });
        } else {
          onResetRound();
        }
        return;
      }

      sprite.x = startX + (targetPos.x - startX) * progress;
      sprite.y = startY + (targetPos.y - startY) * progress;
      sprite.scale.set(startScale * (1 - progress * 0.8));
      sprite.rotation += 0.5;
    };

    app.ticker.add(fly);
  }

  private bumpToyBox(app: Application, toyBoxContainer: Container) {
    let tick = 0;
    const bump = (t: any) => {
      tick += 0.2;
      const s = 1 + Math.sin(tick) * 0.2;
      toyBoxContainer.scale.set(s);
      if (tick >= Math.PI) {
        toyBoxContainer.scale.set(1);
        app.ticker.remove(bump);
      }
    };
    app.ticker.add(bump);
  }

  private fireConfetti(app: Application, container: Container, x: number, y: number) {
    const colors = [0xFF6B6B, 0x4ECDC4, 0xFFD93D, 0xFFFFFF, 0x6C5CE7];
    const particleCount = 80;

    for (let i = 0; i < particleCount; i++) {
      const p = new Graphics();
      const color = colors[Math.floor(Math.random() * colors.length)];

      if (Math.random() > 0.5) {
        p.circle(0, 0, 6 + Math.random() * 4);
      } else {
        p.rect(-5, -5, 10 + Math.random() * 5, 10 + Math.random() * 5);
      }
      p.fill(color);

      p.x = x;
      p.y = y;

      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      const vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed - 5;
      const rotationSpeed = (Math.random() - 0.5) * 0.2;

      container.addChild(p);

      const updateParticle = (ticker: any) => {
        if (p.destroyed) return;

        p.x += vx;
        p.y += vy;
        p.rotation += rotationSpeed;

        vy += 0.3;

        if (p.y > app.screen.height + 50) {
          app.ticker.remove(updateParticle);
          if (!p.destroyed) p.destroy();
        }
      };
      app.ticker.add(updateParticle);
    }
  }
}
