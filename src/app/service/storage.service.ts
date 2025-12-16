import { Injectable, inject } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly storage = inject(Storage);
  private _storage: Storage | null = null;
  private _initPromise: Promise<void>;

  constructor() {
    // 保存初始化Promise，确保所有方法都等待同一个初始化过程
    this._initPromise = this.init();
  }

  private async init(): Promise<void> {
    try {
      const storage = await this.storage.create();
      this._storage = storage;
    } catch (error) {
      console.error('❌ StorageService 初始化失败:', error);
      throw error;
    }
  }

  // 确保初始化完成的辅助方法
  private async ensureInitialized(): Promise<void> {
    await this._initPromise;
  }

  public async set(key: string, value: any): Promise<any> {
    await this.ensureInitialized();
    return this._storage?.set(key, value);
  }

  public async get(key: string): Promise<any> {
    await this.ensureInitialized();
    return this._storage?.get(key);
  }

  public async remove(key: string): Promise<any> {
    await this.ensureInitialized();
    return this._storage?.remove(key);
  }

  public async clear(): Promise<void> {
    await this.ensureInitialized();
    await this._storage?.clear();
  }

  public async keys(): Promise<string[]> {
    await this.ensureInitialized();
    return (await this._storage?.keys()) || [];
  }
}
