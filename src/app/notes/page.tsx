'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from "@/components/AppLayout";
import { NotesList } from "@/components/NotesList";
import { NotesSearch, SearchFilters } from "@/components/NotesSearch";
import { APIErrorDisplay } from "@/components/APIErrorDisplay";
import { useNotesFilter } from "@/hooks/useNotesFilter";
import { useWebShare } from "@/hooks/useWebShare";
import { useToast } from "@/hooks/useToast";
import { ToastContainer } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
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
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  const {
    notes,
    loading,
    error,
    deleteNote,
    generateMetadata,
    clearError,
  } = useNotes();
  
  const { shareNote } = useWebShare();
  const { toasts, removeToast, success, error: showError } = useToast();
  
  const filteredNotes = useNotesFilter(notes, searchQuery, filters);

  // Incremental batching: show an initial set and load more as user scrolls
  const INITIAL_COUNT = 5;
  const LOAD_STEP = 5;
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  // Reset when search or filters change
  useEffect(() => {
    setVisibleCount(INITIAL_COUNT);
  }, [searchQuery, filters]);

  const notesToRender = filteredNotes.slice(0, visibleCount);
  const hasMore = visibleCount < filteredNotes.length;
  const handleEndReached = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + LOAD_STEP, filteredNotes.length));
  }, [filteredNotes.length]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleFilter = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };

  const handleViewNote = (note: Note) => {
    // Navigate to note details page
    router.push(`/notes/${note.id}`);
  };

  const handleEditNote = (note: Note) => {
    // Navigate to note details page for editing
    router.push(`/notes/${note.id}`);
  };

  const handleShareNote = async (note: Note) => {
    try {
      const shareSuccess = await shareNote(note);
      if (shareSuccess) {
        success('Note shared successfully', 'Your note has been shared or copied to clipboard.');
      } else {
        showError('Share cancelled', 'The share operation was cancelled.');
      }
    } catch (err) {
      showError('Failed to share note', err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
  };

  const handleDeleteNote = async (note: Note) => {
    setNoteToDelete(note);
    setShowDeleteDialog(true);
  };

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;
    
    try {
      setDeleting(true);
      await deleteNote(noteToDelete.id);
      success('Note deleted', 'The note has been permanently deleted.');
      setShowDeleteDialog(false);
      setNoteToDelete(null);
    } catch (err) {
      showError('Failed to delete note', err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setDeleting(false);
    }
  };

  const closeDeleteDialog = () => {
    if (!deleting) {
      setShowDeleteDialog(false);
      setNoteToDelete(null);
    }
  };

  return (
    <AppLayout>
      <div className="w-full max-w-3xl p-2 md:p-4 flex flex-col h-full min-h-0">

        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-row gap-2">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-xl md:text-2xl font-bold text-foreground mb-2">
              Your Notes
            </h1>
          </div>
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
        <div className="flex-1 min-h-0">
          <NotesList
            notes={notesToRender}
            loading={loading}
            onDeleteNote={handleDeleteNote}
            onGenerateMetadata={generateMetadata}
            onEditNote={handleEditNote}
            onShareNote={handleShareNote}
            onViewNote={handleViewNote}
            className="flex-1 min-h-0 overflow-y-auto"
            onEndReached={hasMore ? handleEndReached : undefined}
            hasMore={hasMore}
          />
        </div>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={showDeleteDialog}
          onClose={closeDeleteDialog}
          onConfirm={confirmDeleteNote}
          title="Delete Note"
          description="Are you sure you want to delete this note? This action cannot be undone and will permanently remove the note, its audio recording, and any associated photo."
          itemName={noteToDelete?.title}
          isDeleting={deleting}
        />

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      </div>
    </AppLayout>
  );
}