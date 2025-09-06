// Storage quota management and error handling

import { StorageQuota } from '@/types';
import { errorLogger } from './error-logging';

export interface StorageQuotaStatus {
  quota: StorageQuota;
  isNearLimit: boolean;
  isAtLimit: boolean;
  canStore: (sizeBytes: number) => boolean;
  recommendedAction?: 'cleanup' | 'warn' | 'none';
}

export interface StorageCleanupResult {
  freedBytes: number;
  itemsRemoved: number;
  errors: string[];
}

class StorageQuotaManager {
  private readonly WARNING_THRESHOLD = 0.8; // 80%
  private readonly CRITICAL_THRESHOLD = 0.95; // 95%
  private readonly MIN_FREE_SPACE = 50 * 1024 * 1024; // 50MB

  // Get current storage quota status
  async getQuotaStatus(): Promise<StorageQuotaStatus> {
    try {
      const quota = await this.getStorageQuota();
      const isNearLimit = quota.percentage >= this.WARNING_THRESHOLD * 100;
      const isAtLimit = quota.percentage >= this.CRITICAL_THRESHOLD * 100;
      
      const canStore = (sizeBytes: number) => {
        const availableSpace = quota.available - quota.used;
        return availableSpace > sizeBytes + this.MIN_FREE_SPACE;
      };

      let recommendedAction: StorageQuotaStatus['recommendedAction'] = 'none';
      if (isAtLimit) {
        recommendedAction = 'cleanup';
      } else if (isNearLimit) {
        recommendedAction = 'warn';
      }

      return {
        quota,
        isNearLimit,
        isAtLimit,
        canStore,
        recommendedAction,
      };
    } catch (error) {
      errorLogger.error('storage', 'Failed to get quota status', {}, error as Error);
      
      // Return safe defaults
      return {
        quota: { used: 0, available: 0, percentage: 0 },
        isNearLimit: false,
        isAtLimit: false,
        canStore: () => false,
        recommendedAction: 'none',
      };
    }
  }

  // Get storage quota information
  private async getStorageQuota(): Promise<StorageQuota> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const available = estimate.quota || 0;
      const percentage = available > 0 ? (used / available) * 100 : 0;
      
      return { used, available, percentage };
    }
    
    // Fallback for browsers that don't support storage estimation
    return { used: 0, available: 0, percentage: 0 };
  }

  // Check if we can store data of a given size
  async canStoreData(sizeBytes: number): Promise<boolean> {
    try {
      const status = await this.getQuotaStatus();
      return status.canStore(sizeBytes);
    } catch (error) {
      errorLogger.error('storage', 'Failed to check storage capacity', { sizeBytes }, error as Error);
      return false;
    }
  }

  // Handle storage quota exceeded error
  async handleQuotaExceeded(operation: string, dataSize?: number): Promise<StorageCleanupResult> {
    errorLogger.error('storage', 'Storage quota exceeded', {
      operation,
      dataSize,
    });

    // Attempt automatic cleanup
    return this.performAutomaticCleanup();
  }

  // Perform automatic cleanup of old data
  async performAutomaticCleanup(): Promise<StorageCleanupResult> {
    const result: StorageCleanupResult = {
      freedBytes: 0,
      itemsRemoved: 0,
      errors: [],
    };

    try {
      // Clean up error logs first (they're less important)
      await this.cleanupErrorLogs();
      result.itemsRemoved += 1;

      // Clean up old notes if needed
      const notesCleanup = await this.cleanupOldNotes();
      result.freedBytes += notesCleanup.freedBytes;
      result.itemsRemoved += notesCleanup.itemsRemoved;
      result.errors.push(...notesCleanup.errors);

      // Clean up orphaned files
      const orphanCleanup = await this.cleanupOrphanedFiles();
      result.freedBytes += orphanCleanup.freedBytes;
      result.itemsRemoved += orphanCleanup.itemsRemoved;
      result.errors.push(...orphanCleanup.errors);

      errorLogger.info('storage', 'Automatic cleanup completed', {
        freedBytes: result.freedBytes,
        itemsRemoved: result.itemsRemoved,
        errorCount: result.errors.length,
      });

    } catch (error) {
      const errorMessage = `Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMessage);
      errorLogger.error('storage', 'Cleanup operation failed', {}, error as Error);
    }

    return result;
  }

  // Clean up error logs
  private async cleanupErrorLogs(): Promise<void> {
    try {
      errorLogger.clearLogs();
    } catch (error) {
      errorLogger.warn('storage', 'Failed to cleanup error logs');
    }
  }

  // Clean up old notes (keep only recent ones)
  private async cleanupOldNotes(): Promise<StorageCleanupResult> {
    const result: StorageCleanupResult = {
      freedBytes: 0,
      itemsRemoved: 0,
      errors: [],
    };

    try {
      // Import storage functions dynamically to avoid circular dependencies
      const { getAllNotes, deleteNote } = await import('./storage');
      
      const allNotes = await getAllNotes();
      
      // Sort by creation date and keep only the 20 most recent
      const sortedNotes = allNotes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const notesToDelete = sortedNotes.slice(20); // Delete all but the 20 most recent

      for (const note of notesToDelete) {
        try {
          // Estimate size before deletion
          const estimatedSize = this.estimateNoteSize(note);
          
          await deleteNote(note.id);
          
          result.freedBytes += estimatedSize;
          result.itemsRemoved += 1;
        } catch (error) {
          const errorMessage = `Failed to delete note ${note.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMessage);
        }
      }

    } catch (error) {
      const errorMessage = `Failed to cleanup old notes: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMessage);
    }

    return result;
  }

  // Clean up orphaned files
  private async cleanupOrphanedFiles(): Promise<StorageCleanupResult> {
    const result: StorageCleanupResult = {
      freedBytes: 0,
      itemsRemoved: 0,
      errors: [],
    };

    try {
      // Import storage functions dynamically
      const { cleanupOrphanedFiles } = await import('./storage');
      
      const cleanedCount = await cleanupOrphanedFiles();
      result.itemsRemoved = cleanedCount;
      
      // Estimate freed bytes (rough estimate)
      result.freedBytes = cleanedCount * 1024 * 1024; // Assume 1MB per file

    } catch (error) {
      const errorMessage = `Failed to cleanup orphaned files: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMessage);
    }

    return result;
  }

  // Estimate the size of a note in bytes
  private estimateNoteSize(note: any): number {
    let size = 0;
    
    // Text content (rough estimate)
    size += (note.title?.length || 0) * 2; // UTF-16
    size += (note.description?.length || 0) * 2;
    size += (note.transcript?.length || 0) * 2;
    size += (note.rewrittenText?.length || 0) * 2;
    
    // Audio blob (if available)
    if (note.audioBlob?.size) {
      size += note.audioBlob.size;
    } else {
      // Estimate based on duration (rough: 1 minute = ~1MB)
      size += (note.duration || 0) * 1024 * 1024 / 60;
    }
    
    // Photo blob (if available)
    if (note.photoBlob?.size) {
      size += note.photoBlob.size;
    }
    
    return size;
  }

  // Get user-friendly storage status message
  getStorageStatusMessage(status: StorageQuotaStatus): string {
    const { quota, isNearLimit, isAtLimit } = status;
    
    if (quota.available === 0) {
      return 'Storage information unavailable';
    }

    const usedMB = Math.round(quota.used / (1024 * 1024));
    const availableMB = Math.round(quota.available / (1024 * 1024));
    const percentageText = `${Math.round(quota.percentage)}%`;

    if (isAtLimit) {
      return `Storage is critically full (${percentageText} used). Please delete some recordings to continue.`;
    } else if (isNearLimit) {
      return `Storage is getting full (${percentageText} used). Consider deleting old recordings.`;
    } else {
      return `Using ${usedMB}MB of ${availableMB}MB available (${percentageText})`;
    }
  }

  // Get cleanup recommendations
  getCleanupRecommendations(status: StorageQuotaStatus): string[] {
    const recommendations: string[] = [];

    if (status.isAtLimit) {
      recommendations.push('Delete old voice recordings you no longer need');
      recommendations.push('Clear app data and start fresh (this will delete all recordings)');
    } else if (status.isNearLimit) {
      recommendations.push('Review and delete old recordings');
      recommendations.push('Consider backing up important recordings elsewhere');
    }

    return recommendations;
  }
}

// Export singleton instance
export const storageQuotaManager = new StorageQuotaManager();

// Utility functions
export async function checkStorageBeforeOperation(sizeBytes: number): Promise<boolean> {
  return storageQuotaManager.canStoreData(sizeBytes);
}

export async function handleStorageQuotaError(operation: string, dataSize?: number): Promise<StorageCleanupResult> {
  return storageQuotaManager.handleQuotaExceeded(operation, dataSize);
}

export async function getStorageStatus(): Promise<StorageQuotaStatus> {
  return storageQuotaManager.getQuotaStatus();
}