import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppRoutingModule } from 'src/app/app-routing.module';

import { BearComponent } from 'src/app/components/bear/bear.component';
import { ModalComponent } from 'src/app/components/modal/modal.component';
import { AppComponent } from 'src/app/app.component';
import { HomeComponent } from 'src/app/pages/home/home.component';
import { LearnNumbersComponent } from 'src/app/pages/learn-numbers/learn-numbers.component';
import { ListenNumbersComponent } from 'src/app/pages/listen-numbers/listen-numbers.component';
import { NumberBubblesComponent } from 'src/app/pages/number-bubbles/number-bubbles.component';
import { NumberTrainComponent } from 'src/app/pages/number-train/number-train.component';
import { TrainEngineComponent } from 'src/app/pages/number-train/components/train-engine/train-engine.component';
import { TrainCarComponent } from 'src/app/pages/number-train/components/train-car/train-car.component';
import { TrainCabooseComponent } from 'src/app/pages/number-train/components/train-caboose/train-caboose.component';
import { NumberMarketComponent } from 'src/app/pages/number-market/number-market.component';



@NgModule({
  declarations: [
    AppComponent,
    BearComponent,
    ModalComponent,
    HomeComponent,
    LearnNumbersComponent,
    ListenNumbersComponent,
    NumberBubblesComponent,
    NumberTrainComponent,
    TrainEngineComponent,
    TrainCarComponent,
    TrainCabooseComponent,
    NumberMarketComponent,
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    FormsModule,
    BrowserAnimationsModule,
    DragDropModule,
  ],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule { }
