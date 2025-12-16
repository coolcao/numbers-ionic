import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NumberMarketGameService } from './services/number-market-game.service';
import { animate, style, transition, trigger } from '@angular/animations';
import { LearnMode } from 'src/app/app.types';

@Component({
  selector: 'app-number-market-pixi',
  templateUrl: './number-market-pixi.component.html',
  styleUrls: ['./number-market-pixi.component.css'],
  standalone: false,
  animations: [
    trigger('gameOverAnimation', [
      transition(':enter', [
        style({ transform: 'scale(0.8)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'scale(1)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate(
          '200ms ease-in',
          style({ transform: 'scale(0.8)', opacity: 0 }),
        ),
      ]),
    ]),
  ],
})
export class NumberMarketPixiComponent implements OnInit, OnDestroy {
  @ViewChild('pixiContainer', { static: true }) pixiContainer!: ElementRef;

  gameService = inject(NumberMarketGameService);
  route = inject(ActivatedRoute);

  // Expose signals and properties for the template
  gameState = this.gameService.gameState;
  targetNumber = this.gameService.targetNumber;
  targetGoods = this.gameService.targetGoods;
  totalRound = this.gameService.totalRound;
  currentRound = this.gameService.currentRound;
  correctRound = this.gameService.correctRound;
  learnMode = this.gameService.learnMode;

  LearnMode = LearnMode;

  constructor() { }

  async ngOnInit() {
    // Logic from incoming changes: Check query params for mode
    this.route.queryParams.subscribe(params => {
      if (params['mode']) {
        const mode = params['mode'] === 'advanced' ? LearnMode.Advanced : LearnMode.Starter;
        this.gameService.store.setLearnMode(mode);
      }
    });

    // Initialize Game Service (replaces old initPixi logic)
    await this.gameService.init(this.pixiContainer.nativeElement);
  }

  ngOnDestroy() {
    this.gameService.destroy();
  }

  // Proxy methods for template
  startGame() {
    this.gameService.startGame();
  }

  playCurrentRoundSound() {
    this.gameService.playCurrentRoundSound();
  }

  multiTimes(times: number) {
    this.gameService.multiTimes(times);
  }

  checkRound() {
    this.gameService.checkRound();
  }

  restartGame() {
    this.gameService.restartGame();
  }

  backHome() {
    this.gameService.backHome();
  }

  getLeftButtonsStyle() {
    return this.gameService.getLeftButtonsStyle();
  }

  getRightButtonsStyle() {
    return this.gameService.getRightButtonsStyle();
  }
}
