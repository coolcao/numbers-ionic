import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { HomeComponent } from 'src/app/pages/home/home.component';
import { LearnNumbersComponent } from 'src/app/pages/learn-numbers/learn-numbers.component';
import { ListenNumbersComponent } from 'src/app/pages/listen-numbers/listen-numbers.component';
import { NumberBubblesComponent } from 'src/app/pages/number-bubbles/number-bubbles.component';
import { NumberMarketComponent } from 'src/app/pages/number-market/number-market.component';
import { NumberTrainComponent } from 'src/app/pages/number-train/number-train.component';

const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'learn-numbers', component: LearnNumbersComponent },
  { path: 'listen-numbers', component: ListenNumbersComponent },
  { path: 'number-bubbles', component: NumberBubblesComponent },
  { path: 'number-train', component: NumberTrainComponent },
  { path: 'number-market', component: NumberMarketComponent },
  { path: '**', redirectTo: '/home' }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
