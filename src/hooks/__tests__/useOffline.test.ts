import { renderHook, act } from '@testing-library/react';
import { useOffline, usePWAInstall } from '../useOffline';
import { vi } from 'vitest';

// Mock the PWA manager
vi.mock('@/lib/pwa', () => ({
  pwaManager: {
    queueLength: 0,
    queueItems: [],
    addToSyncQueue: vi.fn(),
    processSyncQueue: vi.fn(),
    canInstall: false,
    showInstallPrompt: vi.fn(),
  },
}));

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock navigator.connection
Object.defineProperty(navigator, 'connection', {
  writable: true,
  value: {
    effectiveType: '4g',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
});

describe('useOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (navigator as any).onLine = true;
  });

  it('should initialize with online state', () => {
    const { result } = renderHook(() => useOffline());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
    expect(result.current.syncQueueLength).toBe(0);
  });

  it('should detect offline state', () => {
    const { result } = renderHook(() => useOffline());

    act(() => {
      (navigator as any).onLine = false;
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it('should detect online state change', () => {
    (navigator as any).onLine = false;
    const { result } = renderHook(() => useOffline());

    expect(result.current.isOffline).toBe(true);

    act(() => {
      (navigator as any).onLine = true;
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });

  it('should add items to sync queue', async () => {
    const { pwaManager } = await import('@/lib/pwa');
    const mockAddToSyncQueue = vi.fn().mockReturnValue('test-id');
    (pwaManager.addToSyncQueue as any) = mockAddToSyncQueue;

    const { result } = renderHook(() => useOffline());

    act(() => {
      result.current.addToSyncQueue('transcription', { test: 'data' });
    });

    expect(mockAddToSyncQueue).toHaveBeenCalledWith('transcription', { test: 'data' });
  });

  it('should process sync queue when online', async () => {
    const { pwaManager } = await import('@/lib/pwa');
    const mockProcessSyncQueue = vi.fn().mockResolvedValue(undefined);
    (pwaManager.processSyncQueue as any) = mockProcessSyncQueue;

    const { result } = renderHook(() => useOffline());

    await act(async () => {
      await result.current.processSyncQueue();
    });

    expect(mockProcessSyncQueue).toHaveBeenCalled();
  });

  it('should return connection quality', () => {
    const { result } = renderHook(() => useOffline());

    expect(result.current.getConnectionQuality()).toBe('good');

    // Test poor connection
    (navigator as any).connection.effectiveType = '2g';
    const { result: result2 } = renderHook(() => useOffline());
    expect(result2.current.getConnectionQuality()).toBe('poor');

    // Test offline
    (navigator as any).onLine = false;
    const { result: result3 } = renderHook(() => useOffline());
    expect(result3.current.getConnectionQuality()).toBe('offline');
  });
});

describe('usePWAInstall', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset PWA manager state
    const { pwaManager } = await import('@/lib/pwa');
    (pwaManager as any).canInstall = false;
  });

  it('should initialize with correct install state', () => {
    const { result } = renderHook(() => usePWAInstall());

    expect(result.current.canInstall).toBe(false);
    expect(result.current.isInstalled).toBe(false);
  });

  it('should detect PWA install availability', () => {
    const { result } = renderHook(() => usePWAInstall());

    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt'));
    });

    expect(result.current.canInstall).toBe(true);
  });

  it('should detect PWA installation', () => {
    const { result } = renderHook(() => usePWAInstall());

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it('should handle install prompt', async () => {
    const { pwaManager } = await import('@/lib/pwa');
    const mockShowInstallPrompt = vi.fn().mockResolvedValue(true);
    (pwaManager.showInstallPrompt as any) = mockShowInstallPrompt;

    const { result } = renderHook(() => usePWAInstall());

    let installResult;
    await act(async () => {
      installResult = await result.current.install();
    });

    expect(mockShowInstallPrompt).toHaveBeenCalled();
    expect(installResult).toBe(true);
  });
});