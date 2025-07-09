import { Component, effect, HostListener, inject, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';

import { filter } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { App, BackButtonListenerEvent } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { AlertController } from '@ionic/angular';
import { AppStore } from 'src/app/store/app.store';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
  standalone: false,
})
export class AppComponent implements OnInit {
  store = inject(AppStore);
  location = inject(Location);
  router = inject(Router);

  isDarkMode = this.store.isDarkMode;
  showHeader = this.store.showHeader;
  showFooter = this.store.showFooter;
  showBack = signal(false);

  showExit = signal(false);

  constructor(
    private alertController: AlertController
  ) {
    effect(() => {
      if (this.isDarkMode()) {
        document.body.classList.add('dark');
      } else {
        document.body.classList.remove('dark');
      }
      if (this.getPlatform() === 'android' || this.getPlatform() === 'ios') {
        this.updateStatusBarColor(this.isDarkMode());
      }
    });
  }

  ngOnInit(): void {
    this.setupRouterEvent();
    const platform = this.getPlatform();
    this.store.setPlatform(platform);
    if (platform === 'web') {
      return;
    }
    this.initializeApp();
    this.setupBackEvent();
  }

  // @HostListener('window:popstate', ['$event'])
  // onPopState(event: Event) {
  //   this.goBack();
  // }

  goBack() {
    this.location.back();
  }


  toggleTheme() {
    this.store.setDarkMode(!this.store.isDarkMode());
  }

  // 判断当前平台
  getPlatform() {
    // 使用 Capacitor 的 Platforms 来判断当前运行平台
    if (Capacitor.isNativePlatform()) {
      if (Capacitor.getPlatform() === 'android') {
        return 'android';
      } else if (Capacitor.getPlatform() === 'ios') {
        return 'ios';
      }
    }
    return 'web';
  }

  updateStatusBarColor(darkMode: boolean) {
    StatusBar.setBackgroundColor({
      color: darkMode ? '#0891b2' : '#06b6d4'
    });
    StatusBar.setStyle({
      style: darkMode ? Style.Dark : Style.Light
    });
  }

  initializeApp() {
    StatusBar.setOverlaysWebView({ overlay: false }); // 关键设置
    // 初始化状态栏颜色
    this.updateStatusBarColor(this.isDarkMode());
  }

  exitGame() {
    if (Capacitor.getPlatform() === 'android') {
      (App as any).exitApp(); // 强制退出（Android）
    } else {
      App.minimizeApp(); // iOS 最小化
    }
    this.showExit.set(false);
  }

  private setupBackEvent() {
    App.addListener('backButton', async (event: BackButtonListenerEvent) => {
      if (event.canGoBack) {
        this.goBack();
      } else {
        this.showExit.set(true);
      }
    });
  }
  private setupRouterEvent() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      if (event.url == '/' || event.url == '/home') {
        this.showBack.set(false);
      } else {
        this.showBack.set(true);
      }
    })
  }

}
