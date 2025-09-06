import { describe, it, expect, beforeEach, vi } from 'vitest';
import { errorLogger } from '@/lib/error-logging';
import { storageQuotaManager } from '@/lib/storage-quota';

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
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'test-agent',
    onLine: true,
  },
});

describe('Error Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should log errors with proper sanitization', () => {
    const errorId = errorLogger.error('api', 'Test error', {
      apiKey: 'secret-key',
      normalData: 'safe-data',
    });

    expect(errorId).toBeDefined();
    expect(localStorageMock.setItem).toHaveBeenCalled();
    
    // Check that the stored data has sanitized sensitive information
    const storedData = localStorageMock.setItem.mock.calls[0][1];
    const parsedData = JSON.parse(storedData);
    
    expect(parsedData[0].details.apiKey).toBe('[REDACTED]');
    expect(parsedData[0].details.normalData).toBe('safe-data');
  });

  it('should limit the number of stored logs', () => {
    // Add more logs than the limit
    for (let i = 0; i < 60; i++) {
      errorLogger.error('test', `Error ${i}`);
    }

    const storedData = localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1];
    const parsedData = JSON.parse(storedData);
    
    // Should only keep the last 50 logs
    expect(parsedData.length).toBeLessThanOrEqual(50);
  });

  it('should handle API errors correctly', () => {
    const apiError = {
      type: 'auth' as const,
      message: 'Invalid API key',
      retryable: false,
    };

    const errorId = errorLogger.handleAPIError(apiError, '/api/test', 2);
    
    expect(errorId).toBeDefined();
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('should handle storage errors correctly', () => {
    const storageError = new Error('Storage quota exceeded') as any;
    storageError.quota = 1000000;
    storageError.usage = 950000;

    const errorId = errorLogger.handleStorageQuotaError(storageError, 'createNote');
    
    expect(errorId).toBeDefined();
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });
});

describe('Storage Quota Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect storage quota status', async () => {
    // Mock navigator.storage.estimate
    Object.defineProperty(navigator, 'storage', {
      value: {
        estimate: vi.fn().mockResolvedValue({
          usage: 800000000, // 800MB
          quota: 1000000000, // 1GB
        }),
      },
    });

    const status = await storageQuotaManager.getQuotaStatus();
    
    expect(status.quota.percentage).toBe(80);
    expect(status.isNearLimit).toBe(true);
    expect(status.isAtLimit).toBe(false);
    expect(status.recommendedAction).toBe('warn');
  });

  it('should detect critical storage status', async () => {
    // Mock navigator.storage.estimate for critical usage
    Object.defineProperty(navigator, 'storage', {
      value: {
        estimate: vi.fn().mockResolvedValue({
          usage: 960000000, // 960MB
          quota: 1000000000, // 1GB
        }),
      },
    });

    const status = await storageQuotaManager.getQuotaStatus();
    
    expect(status.quota.percentage).toBe(96);
    expect(status.isNearLimit).toBe(true);
    expect(status.isAtLimit).toBe(true);
    expect(status.recommendedAction).toBe('cleanup');
  });

  it('should check if data can be stored', async () => {
    // Mock navigator.storage.estimate
    Object.defineProperty(navigator, 'storage', {
      value: {
        estimate: vi.fn().mockResolvedValue({
          usage: 500000000, // 500MB
          quota: 1000000000, // 1GB
        }),
      },
    });

    const canStore = await storageQuotaManager.canStoreData(100000000); // 100MB
    expect(canStore).toBe(true);

    const cannotStore = await storageQuotaManager.canStoreData(500000000); // 500MB (would exceed safe limit)
    expect(cannotStore).toBe(false);
  });

  it('should provide user-friendly status messages', async () => {
    const mockStatus = {
      quota: { used: 800000000, available: 1000000000, percentage: 80 },
      isNearLimit: true,
      isAtLimit: false,
      canStore: () => false,
      recommendedAction: 'warn' as const,
    };

    const message = storageQuotaManager.getStorageStatusMessage(mockStatus);
    expect(message).toContain('getting full');
    expect(message).toContain('80%');
  });

  it('should provide cleanup recommendations', async () => {
    const mockStatus = {
      quota: { used: 960000000, available: 1000000000, percentage: 96 },
      isNearLimit: true,
      isAtLimit: true,
      canStore: () => false,
      recommendedAction: 'cleanup' as const,
    };

    const recommendations = storageQuotaManager.getCleanupRecommendations(mockStatus);
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.some(r => r.includes('Delete old'))).toBe(true);
  });
});

describe('Error Recovery', () => {
  it('should handle network errors', () => {
    const networkError = new Error('Failed to fetch');
    const errorId = errorLogger.handleNetworkError(networkError, false);
    
    expect(errorId).toBeDefined();
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('should handle audio errors', () => {
    const audioError = new Error('Microphone access denied');
    const deviceInfo = [
      { kind: 'audioinput', deviceId: 'test', groupId: 'test', label: 'Test Mic' } as MediaDeviceInfo
    ];
    
    const errorId = errorLogger.handleAudioError(audioError, 'startRecording', deviceInfo);
    
    expect(errorId).toBeDefined();
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });
});