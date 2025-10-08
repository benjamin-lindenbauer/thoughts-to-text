'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, MicOff, Camera, Square, Wand2, RefreshCw, X, Save, Trash2, Upload, FileText, Image, FileImage } from 'lucide-react';
import { useRecording } from '@/hooks/useRecording';
import { useAppState } from '@/hooks/useAppState';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useAriaLiveRegion } from '@/hooks/useAccessibility';
import { useOffline } from '@/hooks/useOffline';
import { retrieveApiKey } from '@/lib/storage';
import { cn, DEFAULT_REWRITE_PROMPTS, LANGUAGE_OPTIONS } from '@/lib/utils';
import { rewriteText, transcribeAudio, generateNoteMetadata } from '@/lib/api';
import { RewritePrompt, Note } from '@/types';
import Link from 'next/link';
import { CopyButton } from "@/components/CopyButton";
import { RewriteControls } from "@/components/RewriteControls";
import { markNoteForPostProcessing } from '@/lib/offline-processing';

interface RecordingInterfaceProps {
  onSave?: (noteId: string, note: Note) => void;
  onError?: (error: string) => void;
  showRecordingUI: boolean;
  setShowRecordingUI: (show: boolean) => void;
  className?: string;
  onPendingChange?: (pending: boolean) => void;
}

export function RecordingInterface({
  onSave,
  onError,
  showRecordingUI,
  setShowRecordingUI,
  className,
  onPendingChange
}: RecordingInterfaceProps) {
  const { isOnline } = useOffline();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptionStartedRef = useRef<boolean>(false);
  const cameraLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewrittenText, setRewrittenText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('default');
  const [isMounted, setIsMounted] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [transcriptionAttempted, setTranscriptionAttempted] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [showRewriteSection, setShowRewriteSection] = useState(false);

  // Recording time limits and helpers
  // Limit to 10 minutes to keep transcription time reasonable
  const MAX_RECORDING_TIME_SECONDS = 10 * 60; // 10 minutes
  const MAX_RECORDING_TIME_MS = MAX_RECORDING_TIME_SECONDS * 1000;
  const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB OpenAI limit

  // Use app state hooks
  const { notes, settings } = useAppState();

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

  // Accessibility and haptic feedback hooks
  const haptic = useHapticFeedback({ enabled: true });
  const { announce, LiveRegion } = useAriaLiveRegion();

  // Track client-side mounting to prevent hydration mismatches
  useEffect(() => {
    setIsMounted(true);

    // Cleanup function
    return () => {
      if (cameraLoadingTimeoutRef.current) {
        clearTimeout(cameraLoadingTimeoutRef.current);
      }
      // Stop camera stream if active
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const SaveDiscardButtons: React.FC<{
    canSave: boolean;
    isSaving: boolean;
    onSave: () => void;
    onDiscard: () => void;
    className?: string;
  }> = ({ canSave, isSaving, onSave, onDiscard, className }) => (
    <div className={cn('flex w-full items-center justify-center gap-2 md:gap-4', className)}>
      <button
        onClick={onDiscard}
        className="flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-background border border-border hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Discard recording and transcript"
        disabled={isSaving}
      >
        <Trash2 className="size-4 flex-shrink-0" />
        Discard
      </button>
      <button
        type="button"
        onClick={onSave}
        className={cn('flex w-full items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium', 'btn-gradient-primary')}
        aria-label="Save recording"
        disabled={isSaving || !canSave}
      >
        {isSaving ? (
          <>
            <RefreshCw className="size-4 animate-spin flex-shrink-0" />
            <span>Saving...</span>
          </>
        ) : (
          <>
            <Save className="size-4 flex-shrink-0" />
            <span>Save</span>
          </>
        )}
      </button>
    </div>
  );

  // Reusable Recording status (duration + state + optional progress)
  const RecordingStatus: React.FC<{
    isRecording: boolean;
    durationMs: number;
    maxMs: number;
    formatted: string;
    className?: string;
  }> = ({ isRecording, durationMs, maxMs, formatted, className }) => (
    <div className={cn("flex flex-col w-full items-center text-center gap-2 p-4", className)} id="recording-status">
      <div className="text-5xl font-mono font-bold text-foreground" aria-live="polite" aria-atomic="true">
        {formatted}
      </div>
      <p className="text-sm text-muted-foreground">
        {isRecording ? 'Recording...' : 'Recording complete'}
      </p>
      <div className="w-full max-w-40">
        <div className="h-2 w-full bg-background rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 transition-[width] duration-200"
            style={{ width: `${Math.min(100, ((durationMs || 0) / maxMs) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );

  // Helper to retrieve API key using cached state when available
  const getApiKey = React.useCallback(async (): Promise<string | null> => {
    if (apiKey) return apiKey;
    try {
      const k = await retrieveApiKey();
      setApiKey(k || null);
      setHasApiKey(!!k);
      return k || null;
    } catch {
      setHasApiKey(false);
      return null;
    }
  }, [apiKey]);

  // Keep local API key flags in sync with settings updates (e.g., after clearing in Settings)
  useEffect(() => {
    const key = settings?.settings?.openaiApiKey ?? '';
    setApiKey(key || null);
    setHasApiKey(!!key);
  }, [settings?.settings?.openaiApiKey]);

  const {
    recordingState,
    startRecording,
    stopRecording,
    isSupported,
    error: recordingError,
    formattedDuration,
    clearError,
    resetRecording
  } = useRecording({
    // Keep the pipeline simple: record directly in a supported format (webm/opus) without conversion
    autoCompress: false,
    mimeType: 'audio/webm;codecs=opus',
    maxDuration: MAX_RECORDING_TIME_MS // 10 minutes max
  });

  // Extra safety: ensure we hard-stop at the max time in case the hook's timer is delayed
  useEffect(() => {
    if (recordingState.isRecording && (recordingState.duration || 0) >= MAX_RECORDING_TIME_MS) {
      stopRecording();
    }
  }, [recordingState.isRecording, recordingState.duration]);

  // Determine if there is unsaved work that should warn on navigation
  const hasUnsavedWork = React.useMemo(() => {
    if (isSaving) return false; // allow navigation while saving
    const hasAudio = !!recordingState.audioBlob && (recordingState.duration || 0) > 0;
    const hasText = !!transcript?.trim() || !!rewrittenText?.trim();
    const hasImage = !!photo;
    return recordingState.isRecording || hasAudio || hasText || hasImage;
  }, [isSaving, recordingState.isRecording, recordingState.audioBlob, recordingState.duration, transcript, rewrittenText, photo]);

  // Notify parent about pending state
  useEffect(() => {
    onPendingChange?.(hasUnsavedWork);
  }, [hasUnsavedWork, onPendingChange]);

  // Ensure parent pending state is cleared on unmount
  useEffect(() => {
    return () => {
      onPendingChange?.(false);
    };
  }, [onPendingChange]);

  // Handle recording button click
  const handleRecordingToggle = useCallback(async () => {
    clearError();
    haptic.buttonPress();

    if (recordingState.isRecording) {
      stopRecording();
      haptic.recordingStop();
      announce('Recording stopped', 'polite');
    } else {
      // Clear previous transcript and rewritten text when starting new recording
      setTranscript(null);
      setRewrittenText(null);
      transcriptionStartedRef.current = false;
      setTranscriptionAttempted(false);

      try {
        await startRecording();
        haptic.recordingStart();
        announce('Recording started', 'polite');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
        haptic.recordingError();
        announce(`Recording failed: ${errorMessage}`, 'assertive');
        onError?.(errorMessage);
      }
    }
  }, [recordingState.isRecording, startRecording, stopRecording, clearError, onError, haptic, announce]);

  // Handle closing camera without taking photo
  const handleCloseCamera = useCallback(() => {
    // Clear any existing timeout
    if (cameraLoadingTimeoutRef.current) {
      clearTimeout(cameraLoadingTimeoutRef.current);
      cameraLoadingTimeoutRef.current = null;
    }

    // Stop camera stream
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsCameraLoading(false);
  }, []);

  // Handle photo capture from camera
  const handleCameraCapture = useCallback(async () => {
    // Only run on client side
    if (!isMounted || typeof navigator === 'undefined') return;

    if (isCameraActive) {
      // Clear any existing timeout
      if (cameraLoadingTimeoutRef.current) {
        clearTimeout(cameraLoadingTimeoutRef.current);
        cameraLoadingTimeoutRef.current = null;
      }

      // Stop camera and capture photo
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (context && video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0);

          canvas.toBlob((blob) => {
            if (blob && typeof URL !== 'undefined') {
              setPhoto(blob);
              setPhotoPreview(URL.createObjectURL(blob));
            }
          }, 'image/jpeg', 0.8);
        } else {
          onError?.(`Camera not ready. Video dimensions: ${video.videoWidth}x${video.videoHeight}, Ready state: ${video.readyState}`);
          return;
        }
      }

      // Stop camera stream
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
    } else {
      // Clear any existing timeout
      if (cameraLoadingTimeoutRef.current) {
        clearTimeout(cameraLoadingTimeoutRef.current);
        cameraLoadingTimeoutRef.current = null;
      }

      // Start camera
      setIsCameraLoading(true);

      // Wait a tick for React to re-render and create the video element
      await new Promise(resolve => setTimeout(resolve, 10));

      try {
        // Try with simpler constraints first
        let stream;
        try {
          // Try with back camera first
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            }
          });
        } catch (backCameraError) {
          // Fallback to any available camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            }
          });
        }

        // Wait for video element to be available if it's not ready yet
        let retries = 0;
        while (!videoRef.current && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }

        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;

          // Set up timeout first
          cameraLoadingTimeoutRef.current = setTimeout(() => {
            setIsCameraActive(true);
            setIsCameraLoading(false);
            cameraLoadingTimeoutRef.current = null;
          }, 5000);

          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play().then(() => {
                if (cameraLoadingTimeoutRef.current) {
                  clearTimeout(cameraLoadingTimeoutRef.current);
                  cameraLoadingTimeoutRef.current = null;
                }
                setIsCameraActive(true);
                setIsCameraLoading(false);
              }).catch(playError => {
                console.error('Error playing video:', playError);
                if (cameraLoadingTimeoutRef.current) {
                  clearTimeout(cameraLoadingTimeoutRef.current);
                  cameraLoadingTimeoutRef.current = null;
                }
                setIsCameraLoading(false);
                onError?.('Failed to start camera preview.');
              });
            }
          };

          // Also try to play immediately in case metadata is already loaded
          if (videoRef.current.readyState >= 1) {
            videoRef.current.play().then(() => {
              if (cameraLoadingTimeoutRef.current) {
                clearTimeout(cameraLoadingTimeoutRef.current);
                cameraLoadingTimeoutRef.current = null;
              }
              setIsCameraActive(true);
              setIsCameraLoading(false);
            }).catch(playError => {
              console.error('Error playing video immediately:', playError);
            });
          }
        } else {
          console.error('No video ref or stream');
          setIsCameraLoading(false);

          // Stop the stream if we can't use it
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }

          onError?.('Failed to initialize camera.');
        }
      } catch (error) {
        console.error('Camera access error:', error);
        setIsCameraLoading(false);
        let errorMessage = 'Failed to access camera. ';

        if (error instanceof Error) {
          if (error.name === 'NotAllowedError') {
            errorMessage += 'Please allow camera permissions and try again.';
          } else if (error.name === 'NotFoundError') {
            errorMessage += 'No camera found on this device.';
          } else if (error.name === 'NotReadableError') {
            errorMessage += 'Camera is already in use by another application.';
          } else {
            errorMessage += 'Please check permissions and try again.';
          }
        } else {
          errorMessage += 'Please check permissions and try again.';
        }

        onError?.(errorMessage);
      }
    }
  }, [isCameraActive, isCameraLoading, onError, isMounted]);

  // Handle photo upload from file
  const handlePhotoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/') && typeof URL !== 'undefined') {
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }, []);

  // Handle transcription
  const handleTranscription = useCallback(async (audioBlob: Blob) => {
    if (!audioBlob) return;

    // Check file size before transcription
    if (audioBlob.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (audioBlob.size / (1024 * 1024)).toFixed(1);
      const errorMessage = `Recording is too large (${sizeMB}MB). Maximum file size is 25MB. Please record a shorter audio.`;
      onError?.(errorMessage);
      return;
    }

    setIsTranscribing(true);

    try {
      const key = await getApiKey();
      if (!key) {
        throw new Error('OpenAI API key not configured. Please set your API key in settings.');
      }
      const result = await transcribeAudio(audioBlob, key);

      if (result.transcript?.trim().length) {
        setShowRecordingUI(false);
      }
      setTranscript(result.transcript);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      onError?.(errorMessage);
    } finally {
      setIsTranscribing(false);
    }
  }, [onError, MAX_FILE_SIZE_BYTES, getApiKey]);

  // Handle text rewriting
  const handleRewrite = useCallback(async () => {
    if (!transcript) return;

    setIsRewriting(true);

    try {
      const key = await getApiKey();
      if (!key) {
        throw new Error('OpenAI API key not configured. Please set your API key in settings.');
      }

      const selectedPromptObj = rewritePrompts.find(p => p.id === selectedPrompt);
      if (!selectedPromptObj) {
        throw new Error('Selected rewrite prompt not found.');
      }
      const language = LANGUAGE_OPTIONS.find(l => l.code === selectedLanguage)?.name;

      const result = await rewriteText(transcript, selectedPromptObj.prompt, key, language);

      if (!result.rewrittenText) {
        throw new Error('No rewritten text was generated. Please try again.');
      }

      setShowRewriteSection(true);
      setRewrittenText(result.rewrittenText);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rewriting failed';
      onError?.(errorMessage);
      // Keep original transcript as fallback - don't clear existing rewritten text
    } finally {
      setIsRewriting(false);
    }
  }, [transcript, selectedPrompt, rewritePrompts, onError, selectedLanguage]);

  // Save and discard handlers
  const handleDiscard = useCallback(() => {
    // Clear photo preview URL
    if (photoPreview && typeof URL !== 'undefined') {
      try { URL.revokeObjectURL(photoPreview); } catch {}
    }

    // Reset local UI state
    setTranscript(null);
    setRewrittenText(null);
    setSelectedPrompt('default');
    setPhoto(null);
    setPhotoPreview(null);
    setShowRecordingUI(true);
    setShowRewriteSection(false);

    // Close camera if active
    if (isCameraActive || isCameraLoading) {
      handleCloseCamera();
    }

    // Reset recording hook state (duration, blob, flags)
    resetRecording();

    // Reset internal flags/ids
    transcriptionStartedRef.current = false;
    setTranscriptionAttempted(false);
  }, [photoPreview, isCameraActive, isCameraLoading, handleCloseCamera, resetRecording]);

  const handleSaveNote = useCallback(async () => {
    try {
      setIsSaving(true);
      if (!recordingState.audioBlob) {
        onError?.('Nothing to save yet.');
        return;
      }

      // Prepare base note fields
      const noteId = crypto.randomUUID();
      const durationMs = recordingState.duration || 0;
      const durationSeconds = Math.round(durationMs / 1000);
      const baseText = transcript?.trim() ?? rewrittenText?.trim() ?? '';

      // Generate metadata if API key exists
      let improvedText = '';
      let title = `Recording ${new Date().toLocaleString()}`;
      let description = '';
      let keywords: string[] = [];
      let language = '';
      try {
        const apiKey = await retrieveApiKey();
        if (apiKey && baseText.length > 5) {
          const generated = await generateNoteMetadata(baseText, apiKey);
          improvedText = generated.improvedText;
          title = generated.title || (baseText.slice(0, 50) + (baseText.length > 50 ? '...' : '')) || title;
          description = generated.description || (baseText.slice(0, 200) + (baseText.length > 200 ? '...' : ''));
          keywords = generated.keywords || [];
          language = generated.language;
        } else if (baseText) {
          // Fallback metadata without API key
          title = baseText.slice(0, 50) + (baseText.length > 50 ? '...' : '');
          description = baseText.slice(0, 200) + (baseText.length > 200 ? '...' : '');
        }
      } catch (metaErr) {
        console.warn('Failed to generate note metadata, using fallbacks:', metaErr);
        if (baseText) {
          title = baseText.slice(0, 50) + (baseText.length > 50 ? '...' : '');
          description = baseText.slice(0, 200) + (baseText.length > 200 ? '...' : '');
        }
      }

      const newNote = {
        id: noteId,
        title,
        description,
        transcript: transcript ?? '',
        rewrittenText: rewrittenText || improvedText || '',
        keywords,
        language,
        duration: durationSeconds,
        audioBlob: recordingState.audioBlob,
        photoBlob: photo || undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await notes.addNote(newNote);

      if (!isOnline && (!transcript || !transcript.trim())) {
        markNoteForPostProcessing(noteId);
      }

      haptic.buttonPress();
      announce('Note saved', 'polite');

      // Notify parent of the newly created note so it can decide next actions (e.g., navigate)
      onSave?.(noteId, newNote);

      // Navigation is handled by the parent via onSave

    } catch (error) {
      setIsSaving(false);
      console.error('Failed to save note:', error);
      onError?.('Failed to save note. Please try again.');
    }
  }, [recordingState.audioBlob, recordingState.duration, transcript, rewrittenText, selectedLanguage, photo, notes, haptic, announce, onError]);

  // Handle recording completion: auto-transcribe only when online and API key exists
  React.useEffect(() => {
    if (recordingState.audioBlob && !recordingState.isRecording && !transcriptionStartedRef.current) {
      transcriptionStartedRef.current = true;
      (async () => {
        try {
          const key = await getApiKey();
          setHasApiKey(!!key);
          if (isOnline && key) {
            setTranscriptionAttempted(true);
            await handleTranscription(recordingState.audioBlob!);
          } else {
            setTranscriptionAttempted(false);
          }
        } catch {
          setHasApiKey(false);
          setTranscriptionAttempted(false);
        }
      })();
    }
  }, [recordingState.audioBlob, recordingState.isRecording, isOnline, handleTranscription, getApiKey]);

  // Handle recording errors
  React.useEffect(() => {
    if (recordingError) {
      onError?.(recordingError);
    }
  }, [recordingError, onError]);

  // Don't render anything during SSR to prevent hydration mismatches
  if (!isMounted) {
    return (
      <div className={cn("flex flex-col items-center gap-6 w-full", className)}>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className={cn("flex flex-col items-center gap-6 w-full", className)}>
        <div className="text-red-500 mb-4">
          <MicOff className="w-12 h-12 mx-auto mb-2" />
          <p className="font-medium">Recording Not Supported</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your browser doesn't support audio recording
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col w-full",
        showRecordingUI
          ? "items-center justify-center text-center h-[72vh] p-2 md:p-4"
          : "items-stretch justify-start text-left px-0 py-2 md:py-4",
        className
      )}
    >
      {/* Live region for screen reader announcements */}
      <LiveRegion />

      {showRecordingUI ? (
        // Phase 1: Recording only (centered square)
        <section className="flex flex-col w-full items-center justify-center gap-4">
          {/* Greeting */}
          {!recordingState.isRecording && recordingState.duration === 0 && !isTranscribing && !transcriptionAttempted && (
            <p className="text-sm md:text-base text-muted-foreground">What's on your mind today?</p>
          )}

          <div className="flex flex-col p-4 h-96 w-full md:w-96 gap-8 rounded-4xl bg-panel-gradient text-center items-center justify-center">
            {/* Recording button */}
            {(recordingState.isRecording || (recordingState.duration === 0 && !isTranscribing && !transcriptionAttempted)) && (
              <button
                onClick={handleRecordingToggle}
                disabled={isTranscribing}
                aria-label={
                  recordingState.isRecording
                    ? `Stop recording. Current duration: ${formattedDuration}`
                    : 'Start recording'
                }
                aria-pressed={recordingState.isRecording}
                aria-describedby="recording-status"
                className={cn(
                  "relative mt-8 aspect-square w-28 h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 rounded-full transition-all duration-300 active:scale-95 touch-manipulation",
                  recordingState.isRecording
                    ? "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                    : "bg-gradient-to-br from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                )}
              >
                <div className="absolute inset-2 md:inset-3 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  {recordingState.isRecording ? (
                    <Square className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 text-white drop-shadow-sm" />
                  ) : (
                    <Mic className="w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 text-white drop-shadow-sm" />
                  )}
                </div>

                {/* Pulse animation ring when recording */}
                {recordingState.isRecording && (
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500 to-red-600 animate-pulse opacity-30"></div>
                )}
              </button>
            )}

            {/* Duration display + actions */}
            {(recordingState.isRecording || recordingState.duration > 0) && (
              <RecordingStatus
                isRecording={recordingState.isRecording}
                durationMs={recordingState.duration || 0}
                maxMs={MAX_RECORDING_TIME_MS}
                formatted={formattedDuration}
                className={!recordingState.isRecording && recordingState.duration > 0 && !isTranscribing ? "mt-12" : ""}
              />
            )}

            {/* Status text */}
            {!recordingState.isRecording && recordingState.duration === 0 && !isTranscribing && !transcriptionAttempted && (
              <p className="w-full text-center mb-8 text-sm md:text-base text-muted-foreground">Tap to start recording</p>
            )}

            {/* Transcription status (only after recording stops) */}
            {isTranscribing && (
              <div className="flex flex-col items-center w-full text-center mb-8 gap-1">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-muted-foreground">Transcribing audio...</p>
              </div>
            )}

            {/* No speech detected message when transcription attempted but empty */}
            {!isTranscribing && transcriptionAttempted && !transcript?.trim().length && (
              <div className="w-full text-center mb-8 error-box">No speech detected.</div>
            )}

            {/* Show Save/Discard after recording stops (even if transcript is empty) */}
            {!recordingState.isRecording && recordingState.duration > 0 && !isTranscribing && (
              <SaveDiscardButtons
                canSave={!!recordingState.audioBlob}
                isSaving={isSaving}
                onSave={handleSaveNote}
                onDiscard={handleDiscard}
              />
            )}
          </div>
          
          {/* Guidance when we cannot transcribe now (offline or missing API key) */}
          {!isTranscribing && !transcriptionAttempted && (!isOnline || !hasApiKey) && (
            <div className="space-y-2 mt-4">
              {!isOnline && (
                <div className="info-box">You are offline. You still can record now and transcribe later.</div>
              )}
              {isOnline && !hasApiKey && (
                <div className="info-box">OpenAI API key not configured. Please set your API key in <Link href="/settings" className="underline">Settings</Link> to enable transcriptions and rewrites.</div>
              )}
            </div>
          )}
        </section>
      ) : (
        // Phase 2: Edit (show all 4 sections full width)
        <div className="w-full flex flex-col gap-4">
          {/* Section 1: Recording / Saving */}
          <section className="rounded-xl bg-panel-gradient p-4 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-4 justify-around">
              {(recordingState.isRecording || recordingState.duration > 0) && (
                <RecordingStatus
                  isRecording={recordingState.isRecording}
                  durationMs={recordingState.duration || 0}
                  maxMs={MAX_RECORDING_TIME_MS}
                  formatted={formattedDuration}
                  className="md:w-2/3"
                />
              )}

              {!recordingState.isRecording && recordingState.duration > 0 && (
                <SaveDiscardButtons
                  canSave={!!recordingState.audioBlob}
                  isSaving={isSaving}
                  onSave={handleSaveNote}
                  onDiscard={handleDiscard}
                  className="md:flex-col md:w-1/3"
                />
              )}
            </div>
          </section>

          {/* Section 2: Transcript */}
          {transcript?.trim().length ? (
            <section className="flex flex-col gap-2 p-4 rounded-xl bg-card w-full">
              <div className="flex items-center justify-between h-9">
                <h3 className="flex flex-row items-center gap-2">
                  <FileText className="size-4 flex-shrink-0" />
                  Transcript
                </h3>
                {transcript?.trim().length && <CopyButton text={transcript} />}
              </div>
              <textarea
                className="w-full p-3 rounded-lg border border-border bg-background text-sm text-foreground resize-y min-h-[120px]"
                value={transcript || ''}
                onChange={(e) => setTranscript(e.target.value)}
                aria-label="Edit transcript"
              />
              <RewriteControls
                rewritePrompts={rewritePrompts}
                selectedPrompt={selectedPrompt}
                onChangePrompt={setSelectedPrompt}
                selectedLanguage={selectedLanguage}
                onChangeLanguage={setSelectedLanguage}
                isRewriting={isRewriting}
                transcript={transcript || ''}
                onRewrite={handleRewrite}
              />
            </section>
          ) : null}

          {/* Section 3: Rewriting */}
          {showRewriteSection && (
            <section className="flex flex-col gap-2 p-4 rounded-xl bg-panel-gradient w-full">
              <div className="flex items-center justify-between h-9">
                <h3 className="flex flex-row items-center gap-2">
                  <Wand2 className="size-4 flex-shrink-0" />
                  Rewritten text
                </h3>
                {rewrittenText?.trim() && <CopyButton text={rewrittenText} />}
              </div>
              <textarea
                className="w-full p-3 rounded-lg border border-border bg-background text-sm text-foreground resize-y min-h-[120px]"
                value={rewrittenText || ''}
                onChange={(e) => setRewrittenText(e.target.value)}
                aria-label="Edit rewritten text"
              />
            </section>
          )}

          {/* Section 4: Image / Camera */}
          <section className="flex flex-col gap-2 p-4 rounded-xl bg-card w-full">
            <h3 className="flex flex-row items-center gap-2 h-9">
              <FileImage className="size-4 flex-shrink-0" />
              Add image
            </h3>
            <div className="flex gap-2 w-full md:w-1/2">
              <button
                onClick={() => {
                  haptic.buttonPress();
                  if (isCameraLoading) {
                    return;
                  }
                  if (isCameraActive) {
                    handleCloseCamera();
                  } else {
                    handleCameraCapture();
                  }
                }}
                disabled={isCameraLoading}
                aria-label={
                  isCameraLoading
                    ? 'Camera loading...'
                    : isCameraActive
                      ? 'Close camera'
                      : 'Open camera to take photo'
                }
                className="flex flex-row justify-center w-full px-4 py-2 rounded-lg text-sm bg-background border border-border hover:bg-accent transition-colors items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Camera className="size-4 flex-shrink-0" />
                <span className="text-sm">{isCameraLoading ? 'Camera loading...' : isCameraActive ? 'Close camera' : 'Camera'}</span>
              </button>
              <button
                onClick={() => {
                  haptic.buttonPress();
                  if (isCameraActive || isCameraLoading) {
                    handleCloseCamera();
                  }
                  fileInputRef.current?.click();
                }}
                aria-label="Upload image from device"
                className="flex flex-row justify-center w-full px-4 py-2 rounded-lg text-sm bg-background border border-border hover:bg-accent transition-colors items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="size-4 flex-shrink-0" />
                <span className="text-sm">Upload</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </div>

            <div className="relative w-full">
              {(isCameraLoading || isCameraActive) ? (
                <div className="relative rounded-lg overflow-hidden">
                  <video ref={videoRef} className="w-full h-auto" autoPlay playsInline muted />
                  {isCameraLoading && (
                    <div className="absolute inset-0 w-full h-full rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Starting camera...</p>
                      </div>
                    </div>
                  )}

                  {(isCameraActive || isCameraLoading) && (
                    <button
                      onClick={() => {
                        haptic.buttonPress();
                        handleCloseCamera();
                      }}
                      aria-label="Close camera"
                      className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X className="size-4 flex-shrink-0" />
                    </button>
                  )}

                  {isCameraActive && !isCameraLoading && (
                    <button
                      onClick={() => {
                        haptic.buttonPress();
                        handleCameraCapture();
                      }}
                      aria-label="Capture photo"
                      className="absolute top-2 left-1/2 -translate-x-1/2 p-3 md:p-4 bg-black/60 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                    >
                      <Camera className="size-5 md:size-6" />
                    </button>
                  )}
                </div>
              ) : (!isCameraActive && !isCameraLoading && photoPreview) ? (
                <img src={photoPreview} alt="Captured" className="w-full rounded-lg" />
              ) : (
                <div className="w-full md:w-1/2 aspect-video rounded-lg bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Image className="w-10 h-10" />
                  <span className="text-sm">No image</span>
                </div>
              )}

              {photoPreview && !isCameraActive && !isCameraLoading && (
                <button
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview(null);
                    if (photoPreview && typeof URL !== 'undefined') {
                      URL.revokeObjectURL(photoPreview);
                    }
                  }}
                  aria-label="Remove captured photo"
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                >
                  <X className="size-4 flex-shrink-0" />
                </button>
              )}
            </div>

            {/* Hidden canvas for photo capture */}
            <canvas ref={canvasRef} className="hidden" />
          </section>
        </div>
      )}
    </div>
  );
}
