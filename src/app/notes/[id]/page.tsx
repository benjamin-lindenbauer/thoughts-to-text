'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from "@/components/AppLayout";
import { AudioPlayer } from "@/components/AudioPlayer";
import { APIErrorDisplay } from "@/components/APIErrorDisplay";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  Share,
  Trash2,
  Calendar,
  Clock,
  Mic,
  FileText,
  Sparkles,
  Camera
} from 'lucide-react';
import { Note } from '@/types';
import { retrieveNote, updateNote, deleteNote } from '@/lib/storage';
import { useWebShare } from '@/hooks/useWebShare';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';

export default function NoteDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { shareNote } = useWebShare();
  const { toasts, removeToast, success, error: showError } = useToast();

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNote, setEditedNote] = useState<Partial<Note>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const noteId = params.id as string;

  // Load note data
  useEffect(() => {
    const loadNote = async () => {
      if (!noteId) return;

      try {
        setLoading(true);
        setError(null);
        const noteData = await retrieveNote(noteId);

        if (!noteData) {
          setError('Note not found');
          return;
        }

        setNote(noteData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load note');
      } finally {
        setLoading(false);
      }
    };

    loadNote();
  }, [noteId]);

  // Handle edit mode
  const startEditing = () => {
    if (!note) return;

    setEditedNote({
      title: note.title,
      description: note.description,
      keywords: [...note.keywords]
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedNote({});
  };

  // Save edited note
  const saveNote = async () => {
    if (!note || !editedNote) return;

    try {
      setSaving(true);

      const updatedNote: Note = {
        ...note,
        title: editedNote.title || note.title,
        description: editedNote.description || note.description,
        keywords: editedNote.keywords || note.keywords,
        updatedAt: new Date()
      };

      await updateNote(updatedNote);
      setNote(updatedNote);
      setIsEditing(false);
      setEditedNote({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  // Delete note
  const handleDeleteNote = async () => {
    if (!note) return;

    try {
      setDeleting(true);
      await deleteNote(note.id);
      router.push('/notes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
      setDeleting(false);
    }
  };

  const openDeleteDialog = () => {
    setShowDeleteDialog(true);
  };

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
  };

  // Share note
  const handleShareNote = async () => {
    if (!note) return;

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

  // Handle keyword editing
  const handleKeywordChange = (index: number, value: string) => {
    if (!editedNote.keywords) return;

    const newKeywords = [...editedNote.keywords];
    newKeywords[index] = value;
    setEditedNote({ ...editedNote, keywords: newKeywords });
  };

  const addKeyword = () => {
    const keywords = editedNote.keywords || [];
    setEditedNote({ ...editedNote, keywords: [...keywords, ''] });
  };

  const removeKeyword = (index: number) => {
    if (!editedNote.keywords) return;

    const newKeywords = editedNote.keywords.filter((_, i) => i !== index);
    setEditedNote({ ...editedNote, keywords: newKeywords });
  };

  // Format date and time
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading || !note) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading note...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white py-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push('/notes')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareNote}
                className="flex items-center gap-2"
              >
                <Share className="h-4 w-4" />
                Share
              </Button>

              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveNote}
                    disabled={saving}
                    className="flex items-center gap-2"
                  >
                    {saving ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startEditing}
                    className="flex items-center gap-2"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={openDeleteDialog}
                    disabled={deleting}
                    className="flex items-center gap-2"
                  >
                    {deleting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
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
              onRetry={() => setError(null)}
              onDismiss={() => setError(null)}
            />
          </div>
        )}

        <div className="space-y-6 my-2 md:my-4">
          {/* Title and Metadata */}
          <Card>
            <CardHeader>
              <div className="space-y-4">
                {/* Title */}
                {isEditing ? (
                  <Input
                    value={editedNote.title || ''}
                    onChange={(e) => setEditedNote({ ...editedNote, title: e.target.value })}
                    placeholder="Note title"
                    className="text-xl font-bold"
                  />
                ) : (
                  <CardTitle className="text-xl md:text-2xl">{note.title}</CardTitle>
                )}

                {/* Metadata */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(note.createdAt)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatTime(note.createdAt)}
                  </div>
                  {Number.isFinite(note.duration) && note.duration > 0 && (
                    <div className="flex items-center gap-1">
                      <Mic className="h-4 w-4" />
                      {formatDuration(note.duration)}
                    </div>
                  )}
                  <div className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {note.language.toUpperCase()}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Description */}
              <div>
                <h3 className="font-medium mb-2">Description</h3>
                {isEditing ? (
                  <Textarea
                    value={editedNote.description || ''}
                    onChange={(e) => setEditedNote({ ...editedNote, description: e.target.value })}
                    placeholder="Note description"
                    rows={3}
                  />
                ) : (
                  <p className="text-muted-foreground">
                    {note.description || 'No description available'}
                  </p>
                )}
              </div>

              {/* Keywords */}
              <div>
                <h3 className="font-medium mb-2">Keywords</h3>
                {isEditing ? (
                  <div className="space-y-2">
                    {(editedNote.keywords || []).map((keyword, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={keyword}
                          onChange={(e) => handleKeywordChange(index, e.target.value)}
                          placeholder="Keyword"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeKeyword(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addKeyword}
                      className="w-full"
                    >
                      Add Keyword
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {note.keywords.length > 0 ? (
                      note.keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary">
                          {keyword}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No keywords available</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Audio Player */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Original Recording
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AudioPlayer
                audioBlob={note.audioBlob}
                showVolumeControl={true}
                showTimeDisplay={true}
                initialDurationSeconds={Number.isFinite(note.duration) && note.duration > 0 ? note.duration : 0}
              />
            </CardContent>
          </Card>

          {/* Photo */}
          {note.photoBlob && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Associated Photo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg overflow-hidden">
                  <img
                    src={URL.createObjectURL(note.photoBlob)}
                    alt="Associated with note"
                    className="w-full h-auto max-h-96 object-contain bg-gray-50 dark:bg-gray-800"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transcript */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                  {note.transcript}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Rewritten Text */}
          {note.rewrittenText && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Enhanced Text
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                    {note.rewrittenText}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Last Updated */}
          <div className="text-center text-sm text-muted-foreground">
            Last updated: {formatDate(note.updatedAt)} at {formatTime(note.updatedAt)}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          isOpen={showDeleteDialog}
          onClose={closeDeleteDialog}
          onConfirm={handleDeleteNote}
          title="Delete Note"
          description="Are you sure you want to delete this note? This action cannot be undone and will permanently remove the note, its audio recording, and any associated photo."
          itemName={note.title}
          isDeleting={deleting}
        />

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
      </div>
    </AppLayout>
  );
}