'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from "@/components/AppLayout";
import { AudioPlayer } from "@/components/AudioPlayer";
import { APIErrorDisplay } from "@/components/APIErrorDisplay";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useOffline } from '@/hooks/useOffline';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit3, Save, X, Share, Trash2, Calendar, Clock, Mic, FileText, Sparkles, Camera } from 'lucide-react';
import { APIError, Note, RewritePrompt } from '@/types';
import { retrieveNote, updateNote, deleteNote, retrieveApiKey } from '@/lib/storage';
import { useWebShare } from '@/hooks/useWebShare';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/Toast';
import { transcribeAudio, generateNoteMetadata, rewriteText } from '@/lib/api';
import { CopyButton } from '@/components/CopyButton';
import { RewriteControls } from '@/components/RewriteControls';
import { DEFAULT_REWRITE_PROMPTS, LANGUAGE_OPTIONS } from '@/lib/utils';
import { useAppState } from '@/hooks/useAppState';

export default function NoteDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { shareNote } = useWebShare();
  const { toasts, removeToast, success, error: showError } = useToast();
  const { isOnline } = useOffline();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNote, setEditedNote] = useState<Partial<Note>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingMetadata, setGeneratingMetadata] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('default');
  const [selectedLanguage, setSelectedLanguage] = useState('auto');

  const noteId = params.id as string;

  // Access settings for rewrite prompts/defaults
  const { settings } = useAppState();

  // Use prompts from settings, fall back to defaults
  const rewritePrompts: RewritePrompt[] =
    (settings?.settings?.rewritePrompts && settings.settings.rewritePrompts.length > 0)
      ? settings.settings.rewritePrompts
      : DEFAULT_REWRITE_PROMPTS;

  // Keep selectedPrompt in sync with settings' default when available
  useEffect(() => {
    const defaultId = settings?.settings?.defaultRewritePrompt || 'default';
    const hasDefault = rewritePrompts.some(p => p.id === defaultId);
    setSelectedPrompt(hasDefault ? defaultId : (rewritePrompts[0]?.id || 'default'));
  }, [settings?.settings?.defaultRewritePrompt, settings?.settings?.rewritePrompts, rewritePrompts]);

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

  // Handle text rewriting (persist result to the note)
  const handleRewrite = useCallback(async () => {
    if (!note?.transcript || !note.transcript.trim()) return;

    setIsRewriting(true);

    try {
      const apiKey = await retrieveApiKey();
      if (!apiKey) {
        setError('OpenAI API key not configured. Please set it in settings.');
        return;
      }

      const selectedPromptObj = rewritePrompts.find(p => p.id === selectedPrompt);
      if (!selectedPromptObj) {
        setError('Selected rewrite prompt not found.');
        return;
      }
      const languageName = LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name;

      const result = await rewriteText(note.transcript, selectedPromptObj.prompt, apiKey, languageName);

      if (!result.rewrittenText) {
        setError('No rewritten text was generated. Please try again.');
        return;
      }

      const updatedNote: Note = {
        ...note,
        rewrittenText: result.rewrittenText,
        updatedAt: new Date(),
      };

      await updateNote(updatedNote);
      setNote(updatedNote);
      success('Text rewritten', 'Your transcript has been rewritten.');

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rewriting failed';
      setError(message);
      showError('Rewriting failed', message);
    } finally {
      setIsRewriting(false);
    }
  }, [note, selectedPrompt, selectedLanguage, rewritePrompts]);

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
      success('Note deleted', 'The note has been permanently deleted.');
      setTimeout(() => {
        router.push('/notes');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
      setDeleting(false);
    }
  };

  // Generate metadata for a note
  const generateMetadata = useCallback(async () => {
    if (!note?.transcript) return;
    try {
      setGeneratingMetadata(true);
      setError(null);
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
      setNote(updatedNote);
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
    } finally {
      setGeneratingMetadata(false);
    }
  }, []);

  const openDeleteDialog = () => {
    setShowDeleteDialog(true);
  };

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
  };

  // Copy handled by reusable CopyButton component

  // Transcribe audio for this note
  const handleTranscribe = async () => {
    if (!note) return;
    try {
      setTranscribing(true);
      setError(null);
      const apiKey = await retrieveApiKey();
      if (!apiKey) {
        showError('OpenAI API key not configured', 'Please set your API key in Settings to enable transcription.');
        return;
      }

      const result = await transcribeAudio(note.audioBlob, apiKey, note.language || 'auto');

      if (!result.transcript?.trim().length) {
        showError('No speech detected', 'No speech detected in the audio file.');
        return;
      }
      
      const updatedNote: Note = {
        ...note,
        transcript: result.transcript || '',
        language: result.language || note.language,
        updatedAt: new Date(),
      };

      await updateNote(updatedNote);
      setNote(updatedNote);
      success('Transcription complete', 'The transcript was added to your note.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to transcribe audio';
      setError(message);
      showError('Transcription failed', message);
    } finally {
      setTranscribing(false);
    }
  };

  // Share note
  const handleShareNote = async () => {
    if (!note) return;

    try {
      await shareNote(note);
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
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
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
    <AppLayout
      header={
        <div className="flex items-center justify-between w-full">
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
      }
    >
      <div className="flex flex-col w-full">

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

        <div className="flex flex-col flex-1 min-h-0 gap-4 py-4">
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
                {isEditing ? (
                  <Textarea
                    value={editedNote.description || ''}
                    onChange={(e) => setEditedNote({ ...editedNote, description: e.target.value })}
                    placeholder="Note description"
                    rows={3}
                  />
                ) : (
                  note.description ? (
                    <p className="text-muted-foreground">
                      {note.description}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-muted-foreground">No description available.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateMetadata}
                        disabled={generatingMetadata || !note?.transcript}
                        className="flex items-center gap-2 w-full md:w-1/3"
                        title={note?.transcript ? 'Generate title, description, and keywords' : 'No transcript available'}
                      >
                        {generatingMetadata ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {generatingMetadata ? 'Generating metadata…' : 'Generate metadata'}
                      </Button>
                    </div>
                  )
                )}
              </div>

              {/* Keywords */}
              <div>
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
                        <Badge key={index} variant="keyword">
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
              <h3 className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Recording
              </h3>
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

          {/* Transcript */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Transcript
                </h3>
                <CopyButton text={note.transcript || ''} title="Copy to clipboard" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <Textarea
                  value={note.transcript}
                  onChange={(e) => setNote({ ...note, transcript: e.target.value })}
                  placeholder="Transcript"
                  rows={6}
                />
              ) : typeof note.transcript === 'string' && note.transcript.trim().length > 0 ? (
                <>
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                      {note.transcript}
                    </p>
                  </div>
                  <RewriteControls
                    rewritePrompts={rewritePrompts}
                    selectedPrompt={selectedPrompt}
                    onChangePrompt={setSelectedPrompt}
                    selectedLanguage={selectedLanguage}
                    onChangeLanguage={setSelectedLanguage}
                    isRewriting={isRewriting}
                    transcript={note.transcript}
                    onRewrite={handleRewrite}
                  />
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">No transcript available.</p>
                  {isOnline && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTranscribe}
                      disabled={transcribing}
                      className="flex items-center gap-2 w-full md:w-1/3"
                    >
                      {transcribing ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-500" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      {transcribing ? 'Transcribing…' : 'Transcribe'}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rewritten Text */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Rewritten Text
                </h3>
                {note.rewrittenText && (
                  <CopyButton text={note.rewrittenText || ''} title="Copy to clipboard" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <Textarea
                  value={note.rewrittenText}
                  onChange={(e) => setNote({ ...note, rewrittenText: e.target.value })}
                  placeholder="Rewritten Text"
                  rows={6}
                />
              ) : note.rewrittenText ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                    {note.rewrittenText}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mb-2">No rewritten text yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Photo */}
          {note.photoBlob && (
            <Card>
              <CardHeader>
                <h3 className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Photo
                </h3>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg overflow-hidden">
                  <img
                    src={URL.createObjectURL(note.photoBlob)}
                    alt="Associated with note"
                    className="w-full h-auto max-h-[70vh] object-contain bg-gray-50 dark:bg-gray-800"
                  />
                </div>
              </CardContent>
            </Card>
          )}
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