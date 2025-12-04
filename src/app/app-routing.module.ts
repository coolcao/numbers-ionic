import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { HomeComponent } from 'src/app/pages/home/home.component';
import { LearnNumbersComponent } from 'src/app/pages/learn-numbers/learn-numbers.component';
import { ListenNumbersComponent } from 'src/app/pages/listen-numbers/listen-numbers.component';
import { NumberBubblesCanvasComponent } from 'src/app/pages/number-bubbles-canvas/number-bubbles-canvas.component';
import { NumberBubblesPixiComponent } from 'src/app/pages/number-bubbles-pixi/number-bubbles-pixi.component';
import { NumberMarketComponent } from 'src/app/pages/number-market/number-market.component';
import { NumberTrainComponent } from 'src/app/pages/number-train/number-train.component';
import { NumberTrainPixiComponent } from './pages/number-train-pixi/number-train-pixi.component';
import { NumberMarketPixiComponent } from './pages/number-market-pixi/number-market-pixi.component';

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'learn-numbers', component: LearnNumbersComponent },
  { path: 'listen-numbers', component: ListenNumbersComponent },
  // { path: 'number-bubbles', component: NumberBubblesCanvasComponent },
  { path: 'number-bubbles', component: NumberBubblesPixiComponent },
  // { path: 'number-train', component: NumberTrainComponent },
  { path: 'number-train', component: NumberTrainPixiComponent },
  // { path: 'number-market', component: NumberMarketComponent },
  { path: 'number-market', component: NumberMarketPixiComponent },
  { path: '**', redirectTo: '/home' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
