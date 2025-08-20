import { animate, style, transition, trigger } from '@angular/animations';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Component, effect, inject, OnDestroy, OnInit, signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { LearnMode } from 'src/app/app.types';
import { NumberMarketService } from 'src/app/pages/number-market/number-market.service';
import { AppService } from 'src/app/service/app.service';
import { AudioService } from 'src/app/service/audio.service';
import { AppStore } from 'src/app/store/app.store';
import { GoodsItem, NumberMarketStore } from 'src/app/store/number-market.store';

@Component({
  selector: 'app-number-market',
  standalone: false,
  templateUrl: './number-market.component.html',
  styleUrls: ['./number-market.component.css'],
  animations: [
    trigger('gameOverAnimation', [
      transition(':enter', [
        style({ transform: 'scale(0.8)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'scale(0.8)', opacity: 0 }))
      ])
    ]),
  ]
})
export class NumberMarketComponent implements OnInit, OnDestroy {

  LearnMode = LearnMode;

  router = inject(Router);
  store = inject(AppStore);
  marketStore = inject(NumberMarketStore);
  audioService = inject(AudioService);
  service = inject(NumberMarketService);
  appService = inject(AppService);

  learnMode = this.store.learnMode;

  targetNumber = signal(0);
  targetGoods = signal<GoodsItem | null>(null);
  goods = this.marketStore.goods;
  cartGoods = signal<GoodsItem[]>([]);
  cartGoodsMap = new Map<string, GoodsItem>();

  // 总轮数
  totalRound = signal(6);
  // 当前轮数
  currentRound = signal(0);
  // 正确的轮数
  correctRound = signal(0);
  gameState: WritableSignal<'init' | 'playing' | 'finished'> = signal('init');

  constructor() {
    effect(() => {
      if (this.gameState() === 'finished') {
        this.playGameOver();
      }
    })
  }

  async ngOnInit(): Promise<void> {
    await this.appService.lockPortrait();
    await this.playWelcome();
  }
  async ngOnDestroy(): Promise<void> {
    await this.appService.unlockScreen();
    await this.audioService.stopAll();
  }

  startGame() {
    this.audioService.stopAll();
    this.gameState.set('playing');
    this.playNextRound();
  }

  playNextRound() {
    this.gameState.set('playing');
    this.cartGoodsMap.clear();
    const { targetGoods, targetNumber, goods } = this.service.init(6);
    this.targetGoods.set(targetGoods);
    this.targetNumber.set(targetNumber);
    this.goods.set(goods);
    this.cartGoods.set([]);

    this.playRound(targetNumber, targetGoods).then(() => {
      console.log('播放完成');
    });
  }

  selectGoods(item: GoodsItem) {
    const goods = this.goods();
    goods.forEach((g) => {
      g.selected = false;
      g.amount = 1;
      if (g.id === item.id) {
        g.selected = true;
      }
    });

    this.goods.set([...goods]);
  }

  multiTimes(times: number) {
    const goods = this.goods();
    goods.forEach((g) => {
      if (g.selected) {
        g.amount = times;
      }
    });
    this.goods.set([...goods]);
  }

  check(): boolean {
    const cartGoods = this.cartGoods();
    if (cartGoods.length === 0) {
      // TODO 播放错误音效
      return false;
    }
    const amount = cartGoods.reduce((total, item) => {
      return total + item.amount;
    }, 0);
    if (amount !== this.targetNumber()) {
      // TODO 播放错误音效
      console.log('数量错误');
      return false;
    }
    console.log('数量正确');

    return true;
  }

  async checkRound() {
    const result = this.check();
    if (result) {
      await this.playRoundRight();
      this.correctRound.update((round) => round + 1);
    } else {
      await this.playRoundWrong();
    }
    this.currentRound.update((round) => round + 1);
    if (this.currentRound() === this.totalRound()) {
      // TODO 游戏结束
      console.log('游戏结束');
      console.log('正确轮数：', this.correctRound(), '正确率：', this.correctRound() / this.totalRound() * 100 + '%');
      this.gameState.set('finished');
      return;
    }
    this.playNextRound();
  }

  drop(event: CdkDragDrop<GoodsItem[]>) {
    const containerId = event.container.id;

    if (event.previousContainer === event.container) {
      return;
    }

    // 拖拽到购物车
    if (containerId === 'cartItems') {
      const item = { ...event.previousContainer.data[event.previousIndex] };
      if (item.id !== this.targetGoods()!.id) {
        // TODO 播放错误音效
        this.playError();
        return;
      }

      this.playRight();
      // 将拖拽的商品添加到购物车商品列表中
      this.cartGoods.update((goods) => [...goods, item]);

      if (this.cartGoodsMap.has(item.id)) {
        const goodsItem = this.cartGoodsMap.get(item.id)!;
        goodsItem.amount += item.amount;
        this.cartGoodsMap.set(item.id, { ...goodsItem });
      } else {
        this.cartGoodsMap.set(item.id, { ...item });
      }
    }
    // 拖回到商品区
    if (containerId === 'goodsList') {
      // 根据 idx 删除 cartGoods 列表中的元素
      const item = this.cartGoods()[event.previousIndex];
      this.cartGoods.update((goods) => {
        return goods.filter((_, index) => index !== event.previousIndex);
      });
      if (this.cartGoodsMap.has(item.id)) {
        const goodsItem = this.cartGoodsMap.get(item.id)!;
        goodsItem.amount -= item.amount;
        if (goodsItem.amount === 0) {
          this.cartGoodsMap.delete(item.id);
        } else {
          this.cartGoodsMap.set(item.id, { ...goodsItem });
        }
      }

    }

    // 还原
    const goods = this.goods();
    goods.forEach((g) => {
      g.selected = false;
      g.amount = 1;
    });


  }

  restartGame() {
    this.currentRound.set(0);
    this.correctRound.set(0);
    this.gameState.set('playing');
    this.playNextRound();
  }
  backHome() {
    this.router.navigate(['/home']);
  }

  async playWelcome() {
    await this.audioService.preload('welcome1', 'assets/audio/number-market/number-market-welcome.mp3');
    await this.audioService.preload('welcome2', 'assets/audio/number-market/number-market-welcome2.mp3');
    await this.audioService.preload('welcome3', 'assets/audio/number-market/number-market-welcome3.mp3');
    await this.audioService.play('welcome1');
    await this.audioService.play('welcome2');
    await this.audioService.play('welcome3');
  }

  async playRound(num: number, goodsItem: GoodsItem) {
    this.audioService.stopAll();
    await Promise.all([
      this.audioService.preload('buy1', `assets/audio/number-market/buy1.mp3`),
      this.audioService.preload('buy2', `assets/audio/number-market/buy2.mp3`),
      this.audioService.preload(`${num}`, `assets/audio/numbers/${num}.mp3`),
      this.audioService.preload(`${goodsItem.name}`, `assets/audio/number-market/goods/${goodsItem.id}.mp3`),
    ]);
    await this.audioService.play('buy1');
    await this.audioService.play(`${num}`);
    await this.audioService.play('buy2');
    await this.audioService.play(`${goodsItem.name}`);
  }

  async playRoundRight() {
    await this.audioService.preload('round-right', 'assets/audio/number-market/number-market-round-right.mp3');
    await this.audioService.play('round-right');
  }
  async playRoundWrong() {
    await this.audioService.preload('round-wrong', 'assets/audio/number-market/number-market-round-wrong.mp3');
    await this.audioService.play('round-wrong');
  }
  async playGameOver() {
    await this.audioService.preload('success', 'assets/audio/success.mp3');
    await this.audioService.play('success');
  }
  async playError() {
    await this.audioService.preload('error', 'assets/audio/error.mp3');
    await this.audioService.play('error');
  }
  async playRight() {
    await this.audioService.preload('right', 'assets/audio/right.mp3');
    await this.audioService.play('right');
  }


}
