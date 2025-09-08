'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, MicOff, Camera, Square, Wand2, RefreshCw, X, Save, Trash2 } from 'lucide-react';
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

interface RecordingInterfaceProps {
  onSave?: (noteId: string, note: Note) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function RecordingInterface({
  onSave,
  onError,
  className
}: RecordingInterfaceProps) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewrittenText, setRewrittenText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('default');
  const [isMounted, setIsMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptionStartedRef = useRef<boolean>(false);
  const cameraLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const { isOnline } = useOffline();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [transcriptionAttempted, setTranscriptionAttempted] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('auto');

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

  // Load API key once on mount and cache presence for guidance messages/UI
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const k = await retrieveApiKey();
        if (!cancelled) {
          setApiKey(k || null);
          setHasApiKey(!!k);
        }
      } catch {
        if (!cancelled) {
          setApiKey(null);
          setHasApiKey(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  // Note: We intentionally avoid any auto-save behavior here. Saving occurs only on explicit Save.

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
    maxDuration: 10 * 60 * 1000 // 10 minutes max
  });

  // UI mode: show only the core recording controls centered vertically
  // when the app first loads (no recording yet) or while actively recording.
  // After recording stops (duration > 0 and not recording), show the full UI from the top.
  const showMinimalUI = recordingState.isRecording || recordingState.duration === 0;

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

    setIsTranscribing(true);

    try {
      const key = await getApiKey();
      if (!key) {
        throw new Error('OpenAI API key not configured. Please set your API key in settings.');
      }
      const result = await transcribeAudio(audioBlob, key);

      setTranscript(result.transcript);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      onError?.(errorMessage);
    } finally {
      setIsTranscribing(false);
    }
  }, [onError]);

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

      const result = await rewriteText(transcript, selectedPromptObj.prompt, key);

      if (!result.rewrittenText) {
        throw new Error('No rewritten text was generated. Please try again.');
      }

      setRewrittenText(result.rewrittenText);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rewriting failed';
      onError?.(errorMessage);
      // Keep original transcript as fallback - don't clear existing rewritten text
    } finally {
      setIsRewriting(false);
    }
  }, [transcript, selectedPrompt, rewritePrompts, onError]);

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
      const baseTextRaw = (typeof rewrittenText === 'string' && rewrittenText.trim().length > 0)
        ? rewrittenText
        : (transcript ?? '');
      const baseText = baseTextRaw.trim();

      // Generate metadata if API key exists
      let title = `Recording ${new Date().toLocaleString()}`;
      let description = '';
      let keywords: string[] = [];
      try {
        const apiKey = await retrieveApiKey();
        if (apiKey && baseText) {
          const generated = await generateNoteMetadata(baseText, apiKey);
          title = generated.title || (baseText.slice(0, 50) + (baseText.length > 50 ? '...' : '')) || title;
          description = generated.description || (baseText.slice(0, 200) + (baseText.length > 200 ? '...' : ''));
          keywords = generated.keywords || [];
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
        rewrittenText: rewrittenText || undefined,
        keywords,
        language: selectedLanguage,
        duration: durationSeconds,
        audioBlob: recordingState.audioBlob,
        photoBlob: photo || undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await notes.addNote(newNote);

      haptic.buttonPress();
      announce('Note saved', 'polite');

      // Notify parent of the newly created note so it can decide next actions (e.g., navigate)
      onSave?.(noteId, newNote);

      // Navigation is handled by the parent via onSave

    } catch (error) {
      console.error('Failed to save note:', error);
      onError?.('Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
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
        "flex flex-col gap-6 w-full",
        showMinimalUI ? "items-center justify-center min-h-[calc(100vh-22rem)]" : "items-center justify-start overflow-y-auto",
        className
      )}
    >
      {/* Live region for screen reader announcements */}
      <LiveRegion />

      {/* Greeting */}
      {showMinimalUI && (
        <div className="text-center mb-16">
          <p className="text-sm md:text-base text-muted-foreground">
            What's on your mind today?
          </p>
        </div>
      )}

      {/* Recording button */}
      {showMinimalUI && (
        <div className="relative">
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
              "relative w-28 h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95 touch-manipulation",
              recordingState.isRecording
                ? "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                : "bg-gradient-to-br from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600",
              isTranscribing && "opacity-50 cursor-not-allowed"
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
        </div>
      )}

      {/* Duration display + actions */}
      {(recordingState.isRecording || recordingState.duration > 0) && (
        <div className={`flex w-full items-center ${!recordingState.isRecording ? 'justify-between' : 'justify-center'} gap-4`}>
          <div className="text-center" id="recording-status">
            <div
              className="text-2xl md:text-3xl font-mono font-bold text-foreground"
              aria-live="polite"
              aria-atomic="true"
            >
              {formattedDuration}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {recordingState.isRecording ? 'Recording...' : 'Recording complete'}
            </p>
          </div>

          {/* Show Save/Discard after recording stops (transcript may be absent) */}
          {!recordingState.isRecording && recordingState.duration > 0 && (
            <div className="flex items-center gap-2 ml-8">
              <button
                type="button"
                onClick={handleSaveNote}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm hover:shadow-md active:scale-95 transition-all',
                  'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:active:scale-100'
                )}
                aria-label="Save recording"
                disabled={isSaving || !recordingState.audioBlob}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </>
                )}
              </button>
              <button
                onClick={handleDiscard}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary border border-border hover:bg-accent transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Discard recording and transcript"
                disabled={isSaving}
              >
                <Trash2 className="w-4 h-4" />
                Discard
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status text */}
      {!recordingState.isRecording && recordingState.duration === 0 && (
        <div className="text-center">
          <p className="text-sm md:text-base text-muted-foreground">
            {isTranscribing ? 'Processing...' : 'Tap to start recording'}
          </p>
        </div>
      )}

      {/* Transcription status (only after recording stops) */}
      {!showMinimalUI && isTranscribing && (
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">
            Transcribing audio...
          </p>
        </div>
      )}

      {/* Guidance when we cannot transcribe now (offline or missing API key) */}
      {!showMinimalUI && !isTranscribing && !transcriptionAttempted && (!isOnline || !hasApiKey) && (
        <div className="w-full space-y-2">
          {!isOnline && (
            <div className="text-sm text-amber-800 bg-amber-50 dark:text-amber-200 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
              You are offline. You can save now and transcribe later.
            </div>
          )}
          {isOnline && !hasApiKey && (
            <div className="text-sm text-amber-800 bg-amber-50 dark:text-amber-200 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
              OpenAI API key not configured. Please set your API key in <Link href="/settings" className="underline">Settings</Link> to enable transcription.
            </div>
          )}
        </div>
      )}

      {/* Transcript area (only after a transcription attempt and non-empty transcript) */}
      {!showMinimalUI && !isTranscribing && transcriptionAttempted && transcript?.trim().length ? (
        <div className="w-full space-y-4">
          <div className="p-4 bg-secondary border border-border rounded-lg">
            <h3 className="font-medium text-foreground mb-2">Original Transcript:</h3>
            <textarea
              className="w-full p-3 rounded-md border border-border bg-background text-sm text-foreground resize-y min-h-[120px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              aria-label="Edit transcript"
            />
          </div>

          {/* Rewrite prompt selection and button */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Rewrite Style:
              </label>
              <select
                value={selectedPrompt}
                onChange={(e) => setSelectedPrompt(e.target.value)}
                disabled={isRewriting}
                className="w-full p-2 rounded-lg border border-border bg-secondary text-foreground text-sm transition-colors hover:bg-accent focus:border-transparent disabled:opacity-50"
              >
                {rewritePrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Language selection */}
            <select
              value={selectedLanguage}
              disabled
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full p-2 rounded-lg border border-border bg-secondary text-foreground text-sm transition-colors hover:bg-accent focus:border-transparent disabled:opacity-50"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name} {lang.nativeName ? `(${lang.nativeName})` : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleRewrite}
              disabled={
                isRewriting ||
                transcript === null ||
                (typeof transcript === 'string' && transcript.trim().length === 0)
              }
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200",
                "bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600",
                "text-white shadow-sm hover:shadow-md active:scale-95",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:active:scale-100"
              )}
            >
              {isRewriting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Rewriting...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Rewrite Text</span>
                </>
              )}
            </button>
          </div>

          {/* Rewritten text display (only after recording stops) */}
          {rewrittenText && (
            <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-foreground flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-indigo-500" />
                  Enhanced Text:
                </h3>
                <button
                  onClick={() => setRewrittenText(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Clear rewritten text"
                >
                  Clear
                </button>
              </div>
              <p className="text-sm text-foreground">{rewrittenText}</p>
            </div>
          )}
        </div>
      ) : null}

      {/* No speech detected message when transcription attempted but empty */}
      {!showMinimalUI && !isTranscribing && transcriptionAttempted && !(transcript?.trim().length) && (
        <div className="text-sm text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3">
          No speech detected.
        </div>
      )}

      {/* Camera preview or photo preview (only after recording stops) */}
      {!showMinimalUI && (isCameraActive || isCameraLoading || photoPreview) && (
        <div className="relative w-full">
          {(isCameraLoading || isCameraActive) ? (
            <div className="relative rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-auto"
                autoPlay
                playsInline
                muted
              />
              {isCameraLoading && (
                <div className="absolute inset-0 w-full h-full rounded-lg shadow-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Starting camera...</p>
                  </div>
                </div>
              )}

              {/* Close camera button overlay */}
              {(isCameraActive || isCameraLoading) && (
                <button
                  onClick={() => {
                    haptic.buttonPress();
                    handleCloseCamera();
                  }}
                  aria-label="Close camera"
                  className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : photoPreview ? (
            <img
              src={photoPreview}
              alt="Captured"
              className="w-full rounded-lg shadow-lg"
            />
          ) : null}

          {photoPreview && (
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
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Photo controls (only after recording stops and valid transcript) */}
      {!showMinimalUI && transcriptionAttempted && transcript && (
        <>
          <p className="text-sm md:text-base text-muted-foreground">
            Add an image to your recording
          </p>

          {/* Photo controls */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                haptic.buttonPress();
                handleCameraCapture();
              }}
              disabled={isCameraLoading}
              aria-label={
                isCameraLoading
                  ? 'Starting camera...'
                  : isCameraActive
                    ? 'Capture photo from camera'
                    : 'Open camera to take photo'
              }
              className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Camera className="w-4 h-4" />
              <span className="text-sm">
                {isCameraLoading ? 'Starting...' : isCameraActive ? 'Capture' : 'Camera'}
              </span>
            </button>


          <button
            onClick={() => {
              haptic.buttonPress();
              fileInputRef.current?.click();
            }}
            aria-label="Upload photo from device"
            className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <span className="text-sm">Upload Photo</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>
      </>
      )}
    </div>
  );
}