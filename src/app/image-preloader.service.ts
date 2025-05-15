import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImagePreloaderService {

  constructor() { }
  preloadImages(imageUrls: string[]): Promise<boolean> {
    const promises = imageUrls.map((url) => this.loadImage(url));
    return Promise.all(promises)
      .then(() => true)
      .catch(() => false);
  }

  private loadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve();
      img.onerror = (error) => reject(error);
    });
  }
}
