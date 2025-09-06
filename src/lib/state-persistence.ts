import { AppState, TranscriptionRequest, RewriteRequest } from '@/types';

// Keys for different types of persisted data
const PERSISTED_STATE_KEY = 'thoughts-to-text-app-state';
const OFFLINE_QUEUE_KEY = 'thoughts-to-text-offline-queue';

// Interface for persisted state (only UI state, not sensitive data)
interface PersistedState {
  selectedNoteId: string | null;
  lastActiveTimestamp: number;
}

// Interface for offline queue data
interface OfflineQueueData {
  pendingTranscriptions: TranscriptionRequest[];
  pendingRewrites: RewriteRequest[];
  lastUpdated: number;
}

// Utility functions for state persistence
export class StatePersistence {
  // Load persisted UI state
  static loadPersistedState(): Partial<AppState> | null {
    // Only run on client side
    if (typeof window === 'undefined') return null;
    
    try {
      const persistedData = localStorage.getItem(PERSISTED_STATE_KEY);
      if (!persistedData) return null;

      const parsed: PersistedState = JSON.parse(persistedData);
      
      // Check if the data is not too old (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - parsed.lastActiveTimestamp > maxAge) {
        // Clear old data
        this.clearPersistedState();
        return null;
      }

      return {
        selectedNoteId: parsed.selectedNoteId
      };
    } catch (error) {
      console.error('Failed to load persisted state:', error);
      this.clearPersistedState();
      return null;
    }
  }

  // Save UI state to localStorage
  static savePersistedState(state: AppState): void {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    try {
      const dataToSave: PersistedState = {
        selectedNoteId: state.selectedNoteId,
        lastActiveTimestamp: Date.now()
      };

      localStorage.setItem(PERSISTED_STATE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Failed to save persisted state:', error);
      // If storage is full, try to clear old data
      this.clearPersistedState();
    }
  }

  // Clear persisted UI state
  static clearPersistedState(): void {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(PERSISTED_STATE_KEY);
    } catch (error) {
      console.error('Failed to clear persisted state:', error);
    }
  }

  // Load offline queue data
  static loadOfflineQueue(): { pendingTranscriptions: TranscriptionRequest[]; pendingRewrites: RewriteRequest[] } {
    // Only run on client side
    if (typeof window === 'undefined') {
      return { pendingTranscriptions: [], pendingRewrites: [] };
    }
    
    try {
      const queueData = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (!queueData) {
        return { pendingTranscriptions: [], pendingRewrites: [] };
      }

      const parsed: OfflineQueueData = JSON.parse(queueData);
      
      // Check if the queue data is not too old (7 days)
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      if (Date.now() - parsed.lastUpdated > maxAge) {
        // Clear old queue data
        this.clearOfflineQueue();
        return { pendingTranscriptions: [], pendingRewrites: [] };
      }

      return {
        pendingTranscriptions: parsed.pendingTranscriptions || [],
        pendingRewrites: parsed.pendingRewrites || []
      };
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.clearOfflineQueue();
      return { pendingTranscriptions: [], pendingRewrites: [] };
    }
  }

  // Save offline queue data
  static saveOfflineQueue(pendingTranscriptions: TranscriptionRequest[], pendingRewrites: RewriteRequest[]): void {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    try {
      const dataToSave: OfflineQueueData = {
        pendingTranscriptions,
        pendingRewrites,
        lastUpdated: Date.now()
      };

      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
      // If storage is full, try to clear old data
      this.clearOfflineQueue();
    }
  }

  // Clear offline queue data
  static clearOfflineQueue(): void {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } catch (error) {
      console.error('Failed to clear offline queue:', error);
    }
  }

  // Check if localStorage is available and has space
  static checkStorageAvailability(): { available: boolean; reason?: string } {
    // Only run on client side
    if (typeof window === 'undefined') {
      return { available: false, reason: 'Server-side rendering' };
    }
    
    try {
      const testKey = 'storage-test';
      const testValue = 'test';
      
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (retrieved !== testValue) {
        return { available: false, reason: 'Storage not working correctly' };
      }
      
      return { available: true };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'QuotaExceededError') {
          return { available: false, reason: 'Storage quota exceeded' };
        }
        return { available: false, reason: error.message };
      }
      return { available: false, reason: 'Unknown storage error' };
    }
  }

  // Get storage usage information
  static async getStorageInfo(): Promise<{ used: number; available: number; percentage: number }> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const available = estimate.quota || 0;
        const percentage = available > 0 ? (used / available) * 100 : 0;
        
        return { used, available, percentage };
      }
      
      // Fallback: estimate localStorage usage
      let localStorageSize = 0;
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          localStorageSize += localStorage[key].length + key.length;
        }
      }
      
      // Rough estimate: localStorage is typically 5-10MB
      const estimatedQuota = 10 * 1024 * 1024; // 10MB
      const percentage = (localStorageSize / estimatedQuota) * 100;
      
      return {
        used: localStorageSize,
        available: estimatedQuota,
        percentage: Math.min(percentage, 100)
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { used: 0, available: 0, percentage: 0 };
    }
  }

  // Clean up old or corrupted data
  static cleanupStorage(): void {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    try {
      // List of keys that belong to our app
      const appKeys = [
        PERSISTED_STATE_KEY,
        OFFLINE_QUEUE_KEY,
        'thoughts-to-text-settings',
        'thoughts-to-text-api-key',
        'thoughts-to-text-encryption',
        'theme' // From theme context
      ];

      // Check each key and remove if corrupted
      appKeys.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            JSON.parse(value); // Test if it's valid JSON
          }
        } catch (error) {
          console.warn(`Removing corrupted data for key: ${key}`);
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to cleanup storage:', error);
    }
  }

  // Initialize storage on app startup
  static async initialize(): Promise<void> {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    try {
      // Check storage availability
      const storageCheck = this.checkStorageAvailability();
      if (!storageCheck.available) {
        console.warn('Storage not available:', storageCheck.reason);
        return;
      }

      // Clean up any corrupted data
      this.cleanupStorage();

      // Check storage usage and warn if high
      const storageInfo = await this.getStorageInfo();
      if (storageInfo.percentage > 80) {
        console.warn(`Storage usage is high: ${storageInfo.percentage.toFixed(1)}%`);
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }
}