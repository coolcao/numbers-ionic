import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';
import { Drivers } from '@ionic/storage';

import { AppRoutingModule } from 'src/app/app-routing.module';

import { BearComponent } from 'src/app/components/bear/bear.component';
import { ModalComponent } from 'src/app/components/modal/modal.component';
import { AppComponent } from 'src/app/app.component';
import { HomeComponent } from 'src/app/pages/home/home.component';
import { LearnNumbersComponent } from 'src/app/pages/learn-numbers/learn-numbers.component';
import { ListenNumbersComponent } from 'src/app/pages/listen-numbers/listen-numbers.component';
import { NumberTrainPixiComponent } from './pages/number-train-pixi/number-train-pixi.component';
import { NumberMarketPixiComponent } from './pages/number-market-pixi/number-market-pixi.component';
import { NumberBubblesPixiComponent } from 'src/app/pages/number-bubbles-pixi/number-bubbles-pixi.component';
import { VendingMachinePixiComponent } from './pages/vending-machine-pixi/vending-machine-pixi.component';


@NgModule({
  declarations: [
    AppComponent,
    BearComponent,
    ModalComponent,
    HomeComponent,
    LearnNumbersComponent,
    ListenNumbersComponent,
    NumberBubblesPixiComponent,
    NumberTrainPixiComponent,
    NumberMarketPixiComponent,
    VendingMachinePixiComponent,
  ],
  imports: [
    BrowserModule,
    CommonModule,
    IonicModule.forRoot(),
    IonicStorageModule.forRoot({
      name: 'baby-numbers',
      driverOrder: [Drivers.IndexedDB, Drivers.LocalStorage],
    }),
    AppRoutingModule,
    FormsModule,
    BrowserAnimationsModule,
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule { }
