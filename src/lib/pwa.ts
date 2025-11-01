// PWA utilities for service worker management and offline functionality

export interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface SyncQueueItem {
  id: string;
  type: 'transcription' | 'rewrite';
  data: any;
  timestamp: number;
  retryCount: number;
}

class PWAManager {
  private registration: ServiceWorkerRegistration | null = null;
  private installPrompt: PWAInstallPrompt | null = null;
  private syncQueue: SyncQueueItem[] = [];
  private readonly SYNC_QUEUE_KEY = 'pwa_sync_queue';
  private readonly MAX_RETRIES = 3;

  constructor() {
    this.loadSyncQueue();
  }

  // Service Worker Registration
  async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return null;
    }

    // Only register service worker in production to avoid interfering with other localhost apps during development
    if (process.env.NODE_ENV !== 'production') {
      console.log('Service Worker registration skipped in development mode');
      return null;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('Service Worker registered:', this.registration);

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration?.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              this.notifyUpdate();
            }
          });
        }
      });

      return this.registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  // PWA Installation
  setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e as any;
    });
  }

  async showInstallPrompt(): Promise<boolean> {
    if (!this.installPrompt) {
      return false;
    }

    try {
      await this.installPrompt.prompt();
      const choiceResult = await this.installPrompt.userChoice;
      this.installPrompt = null;
      return choiceResult.outcome === 'accepted';
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    }
  }

  get canInstall(): boolean {
    return this.installPrompt !== null;
  }

  // Background Sync Queue Management
  private loadSyncQueue(): void {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || !window.localStorage) {
        this.syncQueue = [];
        return;
      }
      
      const stored = localStorage.getItem(this.SYNC_QUEUE_KEY);
      this.syncQueue = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  private saveSyncQueue(): void {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }
      
      localStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  addToSyncQueue(type: 'transcription' | 'rewrite', data: any): string {
    const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const item: SyncQueueItem = {
      id,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.syncQueue.push(item);
    this.saveSyncQueue();

    // Try to process immediately if online (only in browser)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.processSyncQueue();
    }

    return id;
  }

  removeFromSyncQueue(id: string): void {
    this.syncQueue = this.syncQueue.filter(item => item.id !== id);
    this.saveSyncQueue();
  }

  async processSyncQueue(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.onLine || this.syncQueue.length === 0) {
      return;
    }

    const itemsToProcess = [...this.syncQueue];
    
    for (const item of itemsToProcess) {
      try {
        await this.processQueueItem(item);
        this.removeFromSyncQueue(item.id);
      } catch (error) {
        console.error(`Failed to process sync item ${item.id}:`, error);
        
        // Increment retry count
        item.retryCount++;
        
        if (item.retryCount >= this.MAX_RETRIES) {
          // Remove failed items after max retries
          this.removeFromSyncQueue(item.id);
          console.warn(`Removing sync item ${item.id} after ${this.MAX_RETRIES} failed attempts`);
        } else {
          // Update the item in queue
          const index = this.syncQueue.findIndex(q => q.id === item.id);
          if (index !== -1) {
            this.syncQueue[index] = item;
            this.saveSyncQueue();
          }
        }
      }
    }
  }

  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    // Only dispatch events in browser environment
    if (typeof window === 'undefined') return;
    
    // This will be implemented by the consuming code
    // We'll dispatch a custom event that components can listen to
    const event = new CustomEvent('pwa-sync-process', {
      detail: { item }
    });
    window.dispatchEvent(event);
  }

  get queueLength(): number {
    return this.syncQueue.length;
  }

  get queueItems(): SyncQueueItem[] {
    return [...this.syncQueue];
  }

  // Service Worker Communication
  async sendMessageToSW(message: any): Promise<any> {
    if (!this.registration?.active) {
      throw new Error('No active service worker');
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      this.registration!.active!.postMessage(message, [messageChannel.port2]);
    });
  }

  // Update notification
  private notifyUpdate(): void {
    const event = new CustomEvent('pwa-update-available');
    window.dispatchEvent(event);
  }

  async skipWaiting(): Promise<void> {
    if (this.registration?.waiting) {
      await this.sendMessageToSW({ type: 'SKIP_WAITING' });
    }
  }
}

// Singleton instance
export const pwaManager = new PWAManager();

// Utility functions
export const isPWAInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
};

export const isPWASupported = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

export const getInstallInstructions = (): string => {
  if (typeof navigator === 'undefined') return 'Install instructions not available';
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  
  if (isIOS) {
    return 'Tap the Share button and select "Add to Home Screen"';
  } else if (isAndroid) {
    return 'Tap the menu button and select "Add to Home Screen" or "Install App"';
  } else {
    return 'Look for the install button in your browser\'s address bar';
  }
};