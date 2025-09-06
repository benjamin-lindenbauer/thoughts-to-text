import localforage from 'localforage';
import { Note, AppSettings, StorageQuota } from '@/types';

// Configure LocalForage instances
const notesStore = localforage.createInstance({
  name: 'ThoughtsToText',
  storeName: 'notes',
  description: 'Storage for voice notes and recordings'
});

const audioStore = localforage.createInstance({
  name: 'ThoughtsToText',
  storeName: 'audio',
  description: 'Storage for audio blobs'
});

const photoStore = localforage.createInstance({
  name: 'ThoughtsToText',
  storeName: 'photos',
  description: 'Storage for photo blobs'
});

// Constants
const SETTINGS_KEY = 'thoughts-to-text-settings';
const API_KEY_STORAGE_KEY = 'thoughts-to-text-api-key';
const ENCRYPTION_KEY = 'thoughts-to-text-encryption';

// Simple encryption/decryption utilities
class SimpleEncryption {
  private static encode(text: string): string {
    return btoa(unescape(encodeURIComponent(text)));
  }

  private static decode(encoded: string): string {
    try {
      return decodeURIComponent(escape(atob(encoded)));
    } catch {
      throw new Error('Failed to decrypt data');
    }
  }

  static encrypt(text: string, key: string): string {
    const combined = text + '|' + key;
    return this.encode(combined);
  }

  static decrypt(encrypted: string, key: string): string {
    const decoded = this.decode(encrypted);
    const parts = decoded.split('|');
    if (parts.length !== 2 || parts[1] !== key) {
      throw new Error('Invalid encryption key or corrupted data');
    }
    return parts[0];
  }
}

// Generate or retrieve encryption key
function getEncryptionKey(): string {
  let key = localStorage.getItem(ENCRYPTION_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(ENCRYPTION_KEY, key);
  }
  return key;
}

// API Key Storage Functions
export async function storeApiKey(apiKey: string): Promise<void> {
  try {
    const encryptionKey = getEncryptionKey();
    const encrypted = SimpleEncryption.encrypt(apiKey, encryptionKey);
    localStorage.setItem(API_KEY_STORAGE_KEY, encrypted);
  } catch (error) {
    throw new Error(`Failed to store API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function retrieveApiKey(): Promise<string | null> {
  try {
    const encrypted = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (!encrypted) return null;
    
    const encryptionKey = getEncryptionKey();
    return SimpleEncryption.decrypt(encrypted, encryptionKey);
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    // Clear corrupted data
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    return null;
  }
}

export async function clearApiKey(): Promise<void> {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

// Settings Storage Functions
export async function storeSettings(settings: AppSettings): Promise<void> {
  try {
    // Store API key separately with encryption
    if (settings.openaiApiKey) {
      await storeApiKey(settings.openaiApiKey);
    }
    
    // Store other settings without API key
    const settingsToStore = { ...settings, openaiApiKey: '' };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToStore));
  } catch (error) {
    throw new Error(`Failed to store settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function retrieveSettings(): Promise<AppSettings | null> {
  try {
    const settingsJson = localStorage.getItem(SETTINGS_KEY);
    if (!settingsJson) return null;
    
    const settings = JSON.parse(settingsJson) as AppSettings;
    
    // Retrieve API key separately
    const apiKey = await retrieveApiKey();
    settings.openaiApiKey = apiKey || '';
    
    return settings;
  } catch (error) {
    console.error('Failed to retrieve settings:', error);
    return null;
  }
}

export async function clearSettings(): Promise<void> {
  localStorage.removeItem(SETTINGS_KEY);
  await clearApiKey();
}

// Note CRUD Operations
export async function createNote(note: Note): Promise<void> {
  try {
    // Store note metadata (without blobs)
    const noteMetadata = {
      ...note,
      audioBlob: undefined,
      photoBlob: undefined
    };
    
    await notesStore.setItem(note.id, noteMetadata);
    
    // Store audio blob separately
    if (note.audioBlob) {
      await audioStore.setItem(note.id, note.audioBlob);
    }
    
    // Store photo blob separately if exists
    if (note.photoBlob) {
      await photoStore.setItem(note.id, note.photoBlob);
    }
  } catch (error) {
    throw new Error(`Failed to create note: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function retrieveNote(id: string): Promise<Note | null> {
  try {
    const noteMetadata = await notesStore.getItem<Omit<Note, 'audioBlob' | 'photoBlob'>>(id);
    if (!noteMetadata) return null;
    
    // Retrieve audio blob
    const audioBlob = await audioStore.getItem<Blob>(id);
    if (!audioBlob) {
      throw new Error('Audio blob not found for note');
    }
    
    // Retrieve photo blob if exists
    const photoBlob = await photoStore.getItem<Blob>(id);
    
    // Reconstruct dates from stored strings
    const note: Note = {
      ...noteMetadata,
      createdAt: new Date(noteMetadata.createdAt),
      updatedAt: new Date(noteMetadata.updatedAt),
      audioBlob,
      photoBlob: photoBlob || undefined
    };
    
    return note;
  } catch (error) {
    throw new Error(`Failed to retrieve note: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function updateNote(note: Note): Promise<void> {
  try {
    // Update timestamp
    note.updatedAt = new Date();
    
    // Store note metadata (without blobs)
    const noteMetadata = {
      ...note,
      audioBlob: undefined,
      photoBlob: undefined
    };
    
    await notesStore.setItem(note.id, noteMetadata);
    
    // Update audio blob if provided
    if (note.audioBlob) {
      await audioStore.setItem(note.id, note.audioBlob);
    }
    
    // Update photo blob if provided
    if (note.photoBlob) {
      await photoStore.setItem(note.id, note.photoBlob);
    }
  } catch (error) {
    throw new Error(`Failed to update note: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deleteNote(id: string): Promise<void> {
  try {
    await Promise.all([
      notesStore.removeItem(id),
      audioStore.removeItem(id),
      photoStore.removeItem(id)
    ]);
  } catch (error) {
    throw new Error(`Failed to delete note: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getAllNotes(): Promise<Note[]> {
  try {
    const notes: Note[] = [];
    const keys = await notesStore.keys();
    
    for (const key of keys) {
      const note = await retrieveNote(key);
      if (note) {
        notes.push(note);
      }
    }
    
    // Sort by creation date (newest first)
    return notes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    throw new Error(`Failed to retrieve all notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function searchNotes(query: string): Promise<Note[]> {
  try {
    const allNotes = await getAllNotes();
    const lowercaseQuery = query.toLowerCase();
    
    return allNotes.filter(note => 
      note.title.toLowerCase().includes(lowercaseQuery) ||
      note.description.toLowerCase().includes(lowercaseQuery) ||
      note.transcript.toLowerCase().includes(lowercaseQuery) ||
      (note.rewrittenText && note.rewrittenText.toLowerCase().includes(lowercaseQuery)) ||
      note.keywords.some(keyword => keyword.toLowerCase().includes(lowercaseQuery))
    );
  } catch (error) {
    throw new Error(`Failed to search notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Storage Quota Management
export async function getStorageQuota(): Promise<StorageQuota> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const available = estimate.quota || 0;
      const percentage = available > 0 ? (used / available) * 100 : 0;
      
      return { used, available, percentage };
    }
    
    // Fallback for browsers that don't support storage estimation
    return { used: 0, available: 0, percentage: 0 };
  } catch (error) {
    console.error('Failed to get storage quota:', error);
    return { used: 0, available: 0, percentage: 0 };
  }
}

export async function clearAllData(): Promise<void> {
  try {
    await Promise.all([
      notesStore.clear(),
      audioStore.clear(),
      photoStore.clear(),
      clearSettings()
    ]);
  } catch (error) {
    throw new Error(`Failed to clear all data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Data integrity and recovery
export async function validateDataIntegrity(): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
  
  try {
    const noteKeys = await notesStore.keys();
    const audioKeys = await audioStore.keys();
    const photoKeys = await photoStore.keys();
    
    // Check for orphaned audio files
    for (const audioKey of audioKeys) {
      if (!noteKeys.includes(audioKey)) {
        issues.push(`Orphaned audio file: ${audioKey}`);
      }
    }
    
    // Check for orphaned photo files
    for (const photoKey of photoKeys) {
      if (!noteKeys.includes(photoKey)) {
        issues.push(`Orphaned photo file: ${photoKey}`);
      }
    }
    
    // Check for notes missing audio files
    for (const noteKey of noteKeys) {
      if (!audioKeys.includes(noteKey)) {
        issues.push(`Note missing audio file: ${noteKey}`);
      }
    }
    
    return { valid: issues.length === 0, issues };
  } catch (error) {
    issues.push(`Failed to validate data integrity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { valid: false, issues };
  }
}

export async function cleanupOrphanedFiles(): Promise<number> {
  try {
    const noteKeys = await notesStore.keys();
    const audioKeys = await audioStore.keys();
    const photoKeys = await photoStore.keys();
    
    let cleanedCount = 0;
    
    // Remove orphaned audio files
    for (const audioKey of audioKeys) {
      if (!noteKeys.includes(audioKey)) {
        await audioStore.removeItem(audioKey);
        cleanedCount++;
      }
    }
    
    // Remove orphaned photo files
    for (const photoKey of photoKeys) {
      if (!noteKeys.includes(photoKey)) {
        await photoStore.removeItem(photoKey);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  } catch (error) {
    throw new Error(`Failed to cleanup orphaned files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}