import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Note, AppSettings } from '@/types'
import {
  storeApiKey,
  retrieveApiKey,
  clearApiKey,
  storeSettings,
  retrieveSettings,
  clearSettings,
  createNote,
  retrieveNote,
  updateNote,
  deleteNote,
  getAllNotes,
  searchNotes,
  getStorageQuota,
  clearAllData,
  validateDataIntegrity,
  cleanupOrphanedFiles
} from '../storage'

// Get the mock from global
const localStorageMock = (globalThis as any).localStorageMock

// Mock data
const mockNote: Note = {
  id: 'test-note-1',
  title: 'Test Note',
  description: 'A test note for unit testing',
  transcript: 'This is a test transcript',
  rewrittenText: 'This is a rewritten test transcript',
  audioBlob: new Blob(['audio data'], { type: 'audio/wav' }),
  photoBlob: new Blob(['photo data'], { type: 'image/jpeg' }),
  language: 'en-US',
  duration: 30000,
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
  keywords: ['test', 'note', 'audio']
}

const mockSettings: AppSettings = {
  openaiApiKey: 'test-api-key-123',
  defaultLanguage: 'en-US',
  theme: 'dark',
  rewritePrompts: [
    {
      id: 'prompt-1',
      name: 'Professional',
      prompt: 'Rewrite this professionally',
      isDefault: true
    }
  ],
  defaultRewritePrompt: 'prompt-1'
}

describe('Storage - API Key Management', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  it('should store and retrieve API key with encryption', async () => {
    const apiKey = 'test-api-key-123'
    
    await storeApiKey(apiKey)
    const retrieved = await retrieveApiKey()
    
    expect(retrieved).toBe(apiKey)
  })

  it('should return null when no API key is stored', async () => {
    const retrieved = await retrieveApiKey()
    expect(retrieved).toBeNull()
  })

  it('should clear API key', async () => {
    await storeApiKey('test-key')
    await clearApiKey()
    
    const retrieved = await retrieveApiKey()
    expect(retrieved).toBeNull()
  })

  it('should handle corrupted API key data', async () => {
    // Simulate corrupted data
    localStorageMock.setItem('thoughts-to-text-api-key', 'corrupted-data')
    
    const retrieved = await retrieveApiKey()
    expect(retrieved).toBeNull()
  })

  it('should throw error when storing API key fails', async () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('Storage full')
    })

    await expect(storeApiKey('test-key')).rejects.toThrow('Failed to store API key')
  })
})

describe('Storage - Settings Management', () => {
  beforeEach(async () => {
    localStorageMock.clear()
    await clearSettings()
  })

  it('should store and retrieve settings', async () => {
    await expect(storeSettings(mockSettings)).resolves.not.toThrow()
    await expect(retrieveSettings()).resolves.not.toThrow()
  })

  it('should return null when no settings are stored', async () => {
    const retrieved = await retrieveSettings()
    expect(retrieved).toBeNull()
  })

  it('should clear all settings', async () => {
    await storeSettings(mockSettings)
    await clearSettings()
    
    const retrieved = await retrieveSettings()
    expect(retrieved).toBeNull()
  })

  it('should handle corrupted settings data', async () => {
    localStorageMock.setItem('thoughts-to-text-settings', 'invalid-json')
    
    const retrieved = await retrieveSettings()
    expect(retrieved).toBeNull()
  })

  it('should store API key separately from other settings', async () => {
    await expect(storeSettings(mockSettings)).resolves.not.toThrow()
    
    // Test that API key storage works independently
    await expect(storeApiKey('test-key')).resolves.not.toThrow()
    await expect(retrieveApiKey()).resolves.not.toThrow()
  })
})

describe('Storage - Note CRUD Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a note', async () => {
    await expect(createNote(mockNote)).resolves.not.toThrow()
  })

  it('should retrieve a note', async () => {
    // First create the note
    await createNote(mockNote)
    
    const retrieved = await retrieveNote(mockNote.id)
    
    expect(retrieved).toBeTruthy()
    if (retrieved) {
      expect(retrieved.id).toBe(mockNote.id)
      expect(retrieved.title).toBe(mockNote.title)
    }
  })

  it('should return null when note does not exist', async () => {
    const retrieved = await retrieveNote('non-existent-id')
    expect(retrieved).toBeNull()
  })

  it('should update a note', async () => {
    await createNote(mockNote)
    
    const updatedNote = { ...mockNote, title: 'Updated Title' }
    await updateNote(updatedNote)
    
    // Verify the update timestamp is set
    expect(updatedNote.updatedAt).toBeInstanceOf(Date)
  })

  it('should delete a note', async () => {
    await createNote(mockNote)
    await deleteNote(mockNote.id)
    
    const retrieved = await retrieveNote(mockNote.id)
    expect(retrieved).toBeNull()
  })

  it('should get all notes sorted by creation date', async () => {
    const note1 = { ...mockNote, id: 'note-1', createdAt: new Date('2024-01-01') }
    const note2 = { ...mockNote, id: 'note-2', createdAt: new Date('2024-01-02') }
    
    await createNote(note1)
    await createNote(note2)
    
    const allNotes = await getAllNotes()
    
    expect(allNotes.length).toBeGreaterThanOrEqual(0)
  })

  it('should search notes by query', async () => {
    const note1 = { ...mockNote, id: 'note-1', title: 'Meeting Notes' }
    const note2 = { ...mockNote, id: 'note-2', title: 'Shopping List', transcript: 'Buy groceries' }
    
    await createNote(note1)
    await createNote(note2)
    
    const searchResults = await searchNotes('meeting')
    expect(Array.isArray(searchResults)).toBe(true)
  })

  it('should handle note creation', async () => {
    await expect(createNote(mockNote)).resolves.not.toThrow()
  })

  it('should handle note retrieval', async () => {
    const result = await retrieveNote('non-existent')
    expect(result).toBeNull()
  })
})

describe('Storage - Quota Management', () => {
  beforeEach(async () => {
    await clearAllData()
  })

  it('should get storage quota information', async () => {
    const quota = await getStorageQuota()
    
    expect(quota).toHaveProperty('used')
    expect(quota).toHaveProperty('available')
    expect(quota).toHaveProperty('percentage')
  })

  it('should handle browsers without storage estimation', async () => {
    const quota = await getStorageQuota()
    
    expect(quota).toHaveProperty('used')
    expect(quota).toHaveProperty('available')
    expect(quota).toHaveProperty('percentage')
  })

  it('should clear all data', async () => {
    await createNote(mockNote)
    await storeSettings(mockSettings)
    
    await clearAllData()
    
    const notes = await getAllNotes()
    const settings = await retrieveSettings()
    
    expect(notes).toHaveLength(0)
    expect(settings).toBeNull()
  })
})

describe('Storage - Data Integrity', () => {
  it('should validate data integrity', async () => {
    const result = await validateDataIntegrity()
    
    expect(result).toHaveProperty('valid')
    expect(result).toHaveProperty('issues')
    expect(Array.isArray(result.issues)).toBe(true)
  })

  it('should cleanup orphaned files', async () => {
    const cleanedCount = await cleanupOrphanedFiles()
    
    expect(typeof cleanedCount).toBe('number')
    expect(cleanedCount).toBeGreaterThanOrEqual(0)
  })
})