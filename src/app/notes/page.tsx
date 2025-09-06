'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from "@/components/AppLayout";
import { NotesList } from "@/components/NotesList";
import { NotesSearch, SearchFilters } from "@/components/NotesSearch";
import { APIErrorDisplay } from "@/components/APIErrorDisplay";
import { useNotesFilter } from "@/hooks/useNotesFilter";
import { useWebShare } from "@/hooks/useWebShare";
import { Note, APIError } from "@/types";
import { 
  getAllNotes, 
  searchNotes as searchNotesStorage, 
  deleteNote as deleteNoteStorage, 
  updateNote,
  retrieveApiKey 
} from '@/lib/storage';
import { generateNoteMetadata } from '@/lib/api';

const DEFAULT_FILTERS: SearchFilters = {
  sortBy: 'date',
  sortOrder: 'desc',
  dateRange: 'all',
  hasKeywords: false,
  hasRewrittenText: false,
};

// Inline useNotes hook implementation
function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all notes
  const refreshNotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const allNotes = await getAllNotes();
      setNotes(allNotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete note
  const handleDeleteNote = useCallback(async (id: string) => {
    try {
      await deleteNoteStorage(id);
      await refreshNotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  }, [refreshNotes]);

  // Generate metadata for a note
  const generateMetadata = useCallback(async (note: Note) => {
    try {
      const apiKey = await retrieveApiKey();
      if (!apiKey) {
        setError('OpenAI API key not configured. Please set it in settings.');
        return;
      }

      const metadata = await generateNoteMetadata(note.transcript, apiKey);
      
      const updatedNote: Note = {
        ...note,
        title: metadata.title,
        description: metadata.description,
        keywords: metadata.keywords,
        updatedAt: new Date(),
      };

      await updateNote(updatedNote);
      await refreshNotes();
    } catch (err) {
      if (err && typeof err === 'object' && 'type' in err) {
        const apiError = err as APIError;
        switch (apiError.type) {
          case 'auth':
            setError('Invalid API key. Please check your OpenAI API key in settings.');
            break;
          case 'quota':
            setError('Rate limit exceeded. Please try again later.');
            break;
          case 'network':
            setError('Network error. Please check your internet connection.');
            break;
          default:
            setError('Failed to generate metadata. Please try again.');
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to generate metadata');
      }
    }
  }, [refreshNotes]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load notes on mount
  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  return {
    notes,
    loading,
    error,
    deleteNote: handleDeleteNote,
    generateMetadata,
    clearError,
  };
}

export default function NotesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  
  const {
    notes,
    loading,
    error,
    deleteNote,
    generateMetadata,
    clearError,
  } = useNotes();
  
  const { shareNote } = useWebShare();
  
  const filteredNotes = useNotesFilter(notes, searchQuery, filters);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleFilter = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };

  const handleEditNote = (note: Note) => {
    // TODO: Navigate to note details page for editing
    // This will be implemented in task 10
    console.log('Edit note:', note.id);
  };

  const handleShareNote = async (note: Note) => {
    const success = await shareNote(note);
    if (!success) {
      // Could show an error toast here
      console.error('Failed to share note');
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2">
            Your Notes
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Browse and manage your recorded thoughts
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6">
            <APIErrorDisplay
              error={{
                type: 'unknown',
                message: error,
                retryable: false,
              }}
              onRetry={clearError}
              onDismiss={clearError}
            />
          </div>
        )}

        {/* Search and Filter */}
        <div className="mb-6">
          <NotesSearch
            onSearch={handleSearch}
            onFilter={handleFilter}
            searchQuery={searchQuery}
            totalNotes={notes.length}
            filteredCount={filteredNotes.length}
          />
        </div>

        {/* Notes List */}
        <NotesList
          notes={filteredNotes}
          loading={loading}
          onDeleteNote={deleteNote}
          onGenerateMetadata={generateMetadata}
          onEditNote={handleEditNote}
          onShareNote={handleShareNote}
        />
      </div>
    </AppLayout>
  );
}