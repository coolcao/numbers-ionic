import { Component, effect, inject, OnInit } from '@angular/core';
import { AppStore } from 'src/app/store/app.store';

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
  standalone: false,
})
export class AppComponent implements OnInit {
  store = inject(AppStore);

  isDarkMode = this.store.isDarkMode;

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
    if (this.getPlatform() === 'web') {
      return;
    }
    this.initializeApp();
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
