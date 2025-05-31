import { Component, effect, HostListener, inject, OnInit } from '@angular/core';
import { AppStore } from 'src/app/store/app.store';

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
  standalone: false,
})
export class AppComponent implements OnInit {
  store = inject(AppStore);
  router = inject(Router);

  isDarkMode = this.store.isDarkMode;
  showHeader = this.store.showHeader;
  showFooter = this.store.showFooter;

  constructor() {
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
    const platform = this.getPlatform();
    this.store.setPlatform(platform);
    if (platform === 'web') {
      return;
    }
    this.initializeApp();
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event: Event) {
    this.goBack();
  }

  goBack() {
    this.router.navigate(['/', 'home']);
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

}
