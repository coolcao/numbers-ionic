import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppRoutingModule } from 'src/app/app-routing.module';

import { BearComponent } from 'src/app/components/bear/bear.component';
import { ModalComponent } from 'src/app/components/modal/modal.component';
import { AppComponent } from 'src/app/app.component';
import { HomeComponent } from 'src/app/pages/home/home.component';
import { LearnNumbersComponent } from 'src/app/pages/learn-numbers/learn-numbers.component';
import { ListenNumbersComponent } from 'src/app/pages/listen-numbers/listen-numbers.component';
import { NumberBubblesComponent } from 'src/app/pages/number-bubbles/number-bubbles.component';


@NgModule({
  declarations: [AppComponent, BearComponent, ModalComponent, HomeComponent, LearnNumbersComponent, ListenNumbersComponent, NumberBubblesComponent],
  imports: [BrowserModule, IonicModule.forRoot(), AppRoutingModule, FormsModule, BrowserAnimationsModule],
  providers: [{ provide: RouteReuseStrategy, useClass: IonicRouteStrategy }],
  bootstrap: [AppComponent],
})
export class AppModule { }
