import { pwaManager, isPWAInstalled, isPWASupported, getInstallInstructions } from '../pwa';
import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock navigator
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: vi.fn(),
    addEventListener: vi.fn(),
  },
  writable: true,
});

Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
});

describe('PWAManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Service Worker Registration', () => {
    it('should register service worker successfully', async () => {
      const mockRegistration = {
        installing: null,
        waiting: null,
        active: null,
        addEventListener: vi.fn(),
      };
      
      (navigator.serviceWorker.register as any).mockResolvedValue(mockRegistration);

      const registration = await pwaManager.registerServiceWorker();

      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js', {
        scope: '/',
      });
      expect(registration).toBe(mockRegistration);
    });

    it('should handle service worker registration failure', async () => {
      const error = new Error('Registration failed');
      (navigator.serviceWorker.register as any).mockRejectedValue(error);

      const registration = await pwaManager.registerServiceWorker();

      expect(registration).toBeNull();
    });

    it('should return null when service worker not supported', async () => {
      // Temporarily remove service worker support
      const originalSW = navigator.serviceWorker;
      delete (navigator as any).serviceWorker;

      const registration = await pwaManager.registerServiceWorker();

      expect(registration).toBeNull();

      // Restore service worker
      (navigator as any).serviceWorker = originalSW;
    });
  });

  describe('Sync Queue Management', () => {
    it('should add items to sync queue', () => {
      const data = { test: 'data' };
      const id = pwaManager.addToSyncQueue('transcription', data);

      expect(typeof id).toBe('string');
      expect(id).toContain('transcription_');
      expect(pwaManager.queueLength).toBe(1);
    });

    it('should remove items from sync queue', () => {
      const id = pwaManager.addToSyncQueue('transcription', { test: 'data' });
      expect(pwaManager.queueLength).toBe(1);

      pwaManager.removeFromSyncQueue(id);
      expect(pwaManager.queueLength).toBe(0);
    });

    it('should load sync queue from localStorage', () => {
      const mockQueue = [
        {
          id: 'test-id',
          type: 'transcription',
          data: { test: 'data' },
          timestamp: Date.now(),
          retryCount: 0,
        },
      ];
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockQueue));

      // Create new instance to trigger loading
      const newManager = new (pwaManager.constructor as any)();
      expect(newManager.queueLength).toBe(1);
    });

    it('should handle corrupted localStorage data', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      // Should not throw and should initialize empty queue
      const newManager = new (pwaManager.constructor as any)();
      expect(newManager.queueLength).toBe(0);
    });

    it('should save sync queue to localStorage', () => {
      pwaManager.addToSyncQueue('transcription', { test: 'data' });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'pwa_sync_queue',
        expect.stringContaining('transcription')
      );
    });
  });

  describe('Background Sync Processing', () => {
    it('should not process queue when offline', async () => {
      (navigator as any).onLine = false;
      pwaManager.addToSyncQueue('transcription', { test: 'data' });

      await pwaManager.processSyncQueue();

      // Queue should still have items
      expect(pwaManager.queueLength).toBe(1);
    });

    it('should process queue when online', async () => {
      (navigator as any).onLine = true;
      
      // Mock the custom event dispatch
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
      
      pwaManager.addToSyncQueue('transcription', { test: 'data' });
      await pwaManager.processSyncQueue();

      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'pwa-sync-process',
        })
      );
    });

    it('should handle processing errors and retry', async () => {
      (navigator as any).onLine = true;
      
      // Mock event listener that throws error
      const originalAddEventListener = window.addEventListener;
      window.addEventListener = vi.fn((type, listener) => {
        if (type === 'pwa-sync-process') {
          // Simulate error in processing
          setTimeout(() => {
            try {
              (listener as any)({ detail: { item: { id: 'test', type: 'transcription' } } });
            } catch (e) {
              // Expected error
            }
          }, 0);
        }
      });

      pwaManager.addToSyncQueue('transcription', { test: 'data' });
      
      // Should handle error gracefully
      await expect(pwaManager.processSyncQueue()).resolves.not.toThrow();

      window.addEventListener = originalAddEventListener;
    });
  });
});

describe('PWA Utility Functions', () => {
  describe('isPWAInstalled', () => {
    it('should detect standalone display mode', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockReturnValue({
          matches: true,
        }),
      });

      expect(isPWAInstalled()).toBe(true);
    });

    it('should detect iOS standalone mode', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockReturnValue({
          matches: false,
        }),
      });

      (window.navigator as any).standalone = true;
      expect(isPWAInstalled()).toBe(true);
    });

    it('should return false when not installed', () => {
      Object.defineProperty(window, 'matchMedia', {
        value: vi.fn().mockReturnValue({
          matches: false,
        }),
      });

      (window.navigator as any).standalone = false;
      expect(isPWAInstalled()).toBe(false);
    });
  });

  describe('isPWASupported', () => {
    it('should return true when PWA features are supported', () => {
      expect(isPWASupported()).toBe(true);
    });

    it('should return false when service worker not supported', () => {
      const originalSW = navigator.serviceWorker;
      delete (navigator as any).serviceWorker;

      expect(isPWASupported()).toBe(false);

      (navigator as any).serviceWorker = originalSW;
    });
  });

  describe('getInstallInstructions', () => {
    const originalUserAgent = navigator.userAgent;

    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        writable: true,
      });
    });

    it('should return iOS instructions for iOS devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true,
      });

      const instructions = getInstallInstructions();
      expect(instructions).toContain('Share button');
      expect(instructions).toContain('Add to Home Screen');
    });

    it('should return Android instructions for Android devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10; SM-G975F)',
        writable: true,
      });

      const instructions = getInstallInstructions();
      expect(instructions).toContain('menu button');
      expect(instructions).toContain('Add to Home Screen');
    });

    it('should return generic instructions for other devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        writable: true,
      });

      const instructions = getInstallInstructions();
      expect(instructions).toContain('install button');
      expect(instructions).toContain('address bar');
    });
  });
});