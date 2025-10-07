import { Note } from '@/types';
import { retrieveNote, updateNote, retrieveApiKey } from '@/lib/storage';
import { transcribeAudio, generateNoteMetadata } from '@/lib/api';

const OFFLINE_PENDING_NOTES_KEY = 'offline_pending_notes';
export const OFFLINE_QUEUE_CHANGE_EVENT = 'offline-processing:queue-changed';
let isProcessing = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getQueue(): string[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(OFFLINE_PENDING_NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read offline pending notes queue:', error);
    return [];
  }
}

function saveQueue(ids: string[]): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(OFFLINE_PENDING_NOTES_KEY, JSON.stringify(ids));
    notifyQueueChange(ids);
  } catch (error) {
    console.error('Failed to persist offline pending notes queue:', error);
  }
}

function notifyQueueChange(ids: string[]): void {
  if (!isBrowser()) return;
  try {
    const event = new CustomEvent<string[]>(OFFLINE_QUEUE_CHANGE_EVENT, { detail: ids });
    window.dispatchEvent(event);
  } catch (error) {
    console.error('Failed to dispatch offline queue change event:', error);
  }
}

export function markNoteForPostProcessing(noteId: string): void {
  if (!noteId) return;
  const queue = getQueue();
  if (!queue.includes(noteId)) {
    queue.push(noteId);
    saveQueue(queue);
  }
}

export function clearNoteFromPostProcessingQueue(noteId: string): void {
  if (!noteId) return;
  const queue = getQueue().filter(id => id !== noteId);
  saveQueue(queue);
}

export function hasPendingOfflineNotes(): boolean {
  return getQueue().length > 0;
}

export function getPendingOfflineNoteIds(): string[] {
  return getQueue();
}

export async function processPendingOfflineNotes(
  onNoteProcessed?: (note: Note) => void
): Promise<void> {
  if (isProcessing || !isBrowser()) return;

  const queue = getQueue();
  if (queue.length === 0) {
    return;
  }

  const apiKey = await retrieveApiKey();
  if (!apiKey) {
    console.warn('Cannot process offline notes: missing OpenAI API key.');
    return;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  isProcessing = true;

  try {
    for (const noteId of queue) {
      try {
        const note = await retrieveNote(noteId);
        if (!note) {
          clearNoteFromPostProcessingQueue(noteId);
          continue;
        }

        // Skip notes that already have transcripts
        if (note.transcript && note.transcript.trim().length > 0) {
          clearNoteFromPostProcessingQueue(noteId);
          continue;
        }

        if (!note.audioBlob) {
          console.warn('Skipping offline note without audio blob:', noteId);
          clearNoteFromPostProcessingQueue(noteId);
          continue;
        }

        const language = note.language || 'auto';
        const transcription = await transcribeAudio(note.audioBlob, apiKey, language);
        const transcriptText = transcription.transcript?.trim() ?? '';

        if (!transcriptText) {
          console.warn('Transcription returned empty result for note:', noteId);
          // Keep in queue to retry later
          continue;
        }

        let improvedText = note.rewrittenText ?? '';
        let title = note.title;
        let description = note.description;
        let keywords = note.keywords ?? [];
        let detectedLanguage = transcription.language || note.language;

        try {
          const improved = await generateNoteMetadata(transcriptText, apiKey);
          improvedText = improved.improvedText || improvedText;
          title = improved.title || title;
          description = improved.description || description;
          keywords = improved.keywords && improved.keywords.length > 0 ? improved.keywords : keywords;
          detectedLanguage = improved.language || detectedLanguage;
        } catch (error) {
          console.error('Failed to improve offline note:', noteId, error);
        }

        const updatedNote: Note = {
          ...note,
          transcript: transcriptText,
          rewrittenText: improvedText,
          title,
          description,
          keywords,
          language: detectedLanguage || note.language,
          updatedAt: new Date(),
        };

        await updateNote(updatedNote);
        clearNoteFromPostProcessingQueue(noteId);
        onNoteProcessed?.(updatedNote);
      } catch (error) {
        console.error('Failed to process offline note:', noteId, error);
      }
    }
  } finally {
    isProcessing = false;
  }
}
