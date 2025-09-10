'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { ArrowLeft, X, FileText, Mic, Wand2 } from "lucide-react";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { Note } from "@/types";
import { getAllNotes, deleteNote as deleteNoteStorage } from '@/lib/storage';
import { useOffline } from '@/hooks/useOffline';
import { AudioPlayer } from "@/components/AudioPlayer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OfflineIndicator } from '@/components/OfflineIndicator';

// Inline expanded card component to safely handle blob URLs and layout
function InlineExpandedNoteCard({ note: n, isOnline, onClose }: { note: Note; isOnline: boolean; onClose: () => void }) {
  const photoUrl = useMemo(() => (n.photoBlob ? URL.createObjectURL(n.photoBlob) : null), [n.photoBlob]);
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  return (
    <Card onClick={(e) => e.stopPropagation()} className="bg-background">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-lg truncate">{n.title || 'Untitled Note'}</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="flex items-center gap-1 shrink-0">
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="flex items-center gap-2 font-medium text-sm">
            <Mic className="h-4 w-4" />Recording
          </h3>
          <div className="mt-2">
            <AudioPlayer
              audioBlob={n.audioBlob}
              showVolumeControl={true}
              showTimeDisplay={true}
              initialDurationSeconds={Number.isFinite(n.duration) && n.duration > 0 ? n.duration : 0}
            />
          </div>
        </div>
        <div>
          <h3 className="flex items-center gap-2 font-medium text-sm">
            <FileText className="h-4 w-4" /> Transcript
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
            {n.transcript || 'No transcript available.'}
          </p>
        </div>
        {n.rewrittenText && (
          <div>
            <h3 className="flex items-center gap-2 font-medium text-sm">
              <Wand2 className="h-4 w-4" /> Rewritten Text
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
              {n.rewrittenText}
            </p>
          </div>
        )}
        {photoUrl && (
          <div>
            <h3 className="flex items-center gap-2 font-medium text-sm">Photo</h3>
            <img src={photoUrl} alt={n.title ? `Photo for ${n.title}` : 'Note photo'} className="mt-2 max-h-64 w-auto rounded-md border border-border object-contain" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
    clearError,
  };
}

export default function NotesPage() {
  const router = useRouter();
  const { isOnline } = useOffline();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [inlineNoteId, setInlineNoteId] = useState<string | null>(null);
  
  const {
    notes,
    loading,
    error,
    deleteNote,
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
    // Online navigation is handled here; offline inline expansion is handled inside NotesList
    router.push(`/notes/${note.id}`);
  };

  const handleShareNote = async (note: Note) => {
    try {
      await shareNote(note);
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

  // Detect offline deep link intent (either /notes/:id or /notes?open=:id)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isOnline) return; // Only handle when offline
    try {
      const url = new URL(window.location.href);
      let id = url.searchParams.get('open');
      if (!id && url.pathname.startsWith('/notes/')) {
        const parts = url.pathname.split('/');
        if (parts.length >= 3) {
          id = parts[2];
        }
      }
      if (id) {
        setInlineNoteId(id);
      }
    } catch (_e) {
      // ignore
    }
  }, [isOnline]);

  // When a specific inline note is targeted (e.g., deep link offline), ensure it's visible and scroll to it
  useEffect(() => {
    if (!inlineNoteId) return;
    const index = filteredNotes.findIndex((n) => n.id === inlineNoteId);
    if (index >= 0) {
      setVisibleCount((prev) => (index + 1 > prev ? index + 1 : prev));
      // Scroll into view after the list renders
      setTimeout(() => {
        const el = document.querySelector(`[data-note-id="${inlineNoteId}"]`);
        if (el && 'scrollIntoView' in el) {
          (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 0);
    }
  }, [inlineNoteId, filteredNotes]);

  const clearInlineViewer = () => {
    setInlineNoteId(null);
    // Normalize URL back to /notes without triggering network nav
    try {
      if (typeof window !== 'undefined' && window.history && window.location.pathname !== '/notes') {
        window.history.replaceState({}, '', '/notes');
      }
    } catch (_e) {}
  };

  return (
    <AppLayout
      header={
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-lg md:text-xl font-bold text-foreground">
              Notes
            </h1>
          </div>
          <OfflineIndicator />
        </div>
      }
    >
      <div className="flex flex-col w-full">
        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onRemoveToast={removeToast} />

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

        {/* Notes List with inline-offline expansion */}
        <div className="flex-1 min-h-0">
          <NotesList
            notes={notesToRender}
            loading={loading}
            onDeleteNote={handleDeleteNote}
            onShareNote={handleShareNote}
            onViewNote={handleViewNote}
            isOnline={isOnline}
            expandedNoteId={inlineNoteId}
            onExpandNote={(note) => setInlineNoteId(note.id)}
            onCollapseNote={clearInlineViewer}
            renderExpanded={(n) => (
              <InlineExpandedNoteCard note={n} isOnline={isOnline} onClose={clearInlineViewer} />
            )}
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
      </div>
    </AppLayout>
  );
}