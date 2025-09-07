'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, MicOff, Camera, Square, Wand2, RefreshCw, X } from 'lucide-react';
import { useRecording } from '@/hooks/useRecording';
import { useAppState } from '@/hooks/useAppState';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useAriaLiveRegion } from '@/hooks/useAccessibility';
import { cn } from '@/lib/utils';
import { RewritePrompt } from '@/types';

interface RecordingInterfaceProps {
  selectedLanguage: string;
  onRecordingComplete?: (audioBlob: Blob, transcript?: string, photo?: Blob, rewrittenText?: string) => void;
  onTranscriptionStart?: () => void;
  onTranscriptionComplete?: (transcript: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

// Default rewrite prompts
const DEFAULT_REWRITE_PROMPTS: RewritePrompt[] = [
  {
    id: 'default',
    name: 'Clean & Polish',
    prompt: 'Please clean up and polish this text, fixing any grammar issues, improving clarity, and making it more professional while maintaining the original meaning and tone.',
    isDefault: true
  },
  {
    id: 'summarize',
    name: 'Summarize',
    prompt: 'Please create a concise summary of this text, capturing the main points and key ideas.',
    isDefault: false
  },
  {
    id: 'expand',
    name: 'Expand & Detail',
    prompt: 'Please expand on this text, adding more detail, context, and explanation while maintaining the original ideas.',
    isDefault: false
  },
  {
    id: 'formal',
    name: 'Make Formal',
    prompt: 'Please rewrite this text in a formal, professional tone suitable for business or academic contexts.',
    isDefault: false
  }
];

export function RecordingInterface({
  selectedLanguage,
  onRecordingComplete,
  onTranscriptionStart,
  onTranscriptionComplete,
  onError,
  className
}: RecordingInterfaceProps) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewrittenText, setRewrittenText] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('default');
  const [rewritePrompts] = useState<RewritePrompt[]>(DEFAULT_REWRITE_PROMPTS);
  const [isMounted, setIsMounted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptionStartedRef = useRef<boolean>(false);
  const cameraLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);

  // Use app state hooks
  const { notes } = useAppState();

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

  // Auto-save function for recordings and transcripts
  const saveNoteAfterRecording = useCallback(async (audioBlob: Blob) => {
    try {
      // Generate a unique ID for the note
      const noteId = crypto.randomUUID();
      setCurrentNoteId(noteId);

      // Create initial note with recording
      const newNote = {
        id: noteId,
        title: `Recording ${new Date().toLocaleString()}`,
        description: 'Processing...',
        transcript: '',
        rewrittenText: undefined,
        keywords: [],
        language: selectedLanguage,
        duration: recordingState.duration || 0,
        audioBlob,
        photoBlob: photo || undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save note immediately after recording
      await notes.addNote(newNote);

    } catch (error) {
      console.error('Failed to save recording:', error);
      onError?.('Failed to save recording. Please try again.');
    }
  }, [selectedLanguage, photo, onError, notes]);

  // Auto-save function for transcript updates
  const saveTranscriptUpdate = useCallback(async (transcript: string) => {
    if (!currentNoteId) return;

    try {
      // Get the current note
      const currentNote = notes.getNote(currentNoteId);
      if (!currentNote) return;

      // Generate title and description from transcript
      const { generateNoteMetadata } = await import('@/lib/api');
      const { retrieveApiKey } = await import('@/lib/storage');
      const apiKey = await retrieveApiKey();

      let title = currentNote.title;
      let description = currentNote.description;
      let keywords = currentNote.keywords;

      if (apiKey && transcript.trim()) {
        try {
          const generated = await generateNoteMetadata(transcript, apiKey);
          title = generated.title || title;
          description = generated.description || description;
          keywords = generated.keywords || keywords;
        } catch (error) {
          console.warn('Failed to generate title/description:', error);
          // Use fallback title/description
          title = transcript.slice(0, 50) + (transcript.length > 50 ? '...' : '');
          description = transcript.slice(0, 200) + (transcript.length > 200 ? '...' : '');
        }
      }

      // Update note with transcript and generated metadata
      const updatedNote = {
        ...currentNote,
        title,
        description,
        transcript,
        keywords,
        updatedAt: new Date()
      };

      // Save updated note immediately
      await notes.updateNote(updatedNote);

    } catch (error) {
      console.error('Failed to save transcript:', error);
      onError?.('Failed to save transcript. Please try again.');
    }
  }, [currentNoteId, onError, notes]);

  // Auto-save function for rewritten text updates
  const saveRewrittenTextUpdate = useCallback(async (rewrittenText: string) => {
    if (!currentNoteId) return;

    try {
      // Get the current note
      const currentNote = notes.getNote(currentNoteId);
      if (!currentNote) return;

      // Update note with rewritten text
      const updatedNote = {
        ...currentNote,
        rewrittenText,
        updatedAt: new Date()
      };

      // Save updated note immediately
      await notes.updateNote(updatedNote);

    } catch (error) {
      console.error('Failed to save rewritten text:', error);
      onError?.('Failed to save rewritten text. Please try again.');
    }
  }, [currentNoteId, onError, notes]);

  const {
    recordingState,
    startRecording,
    stopRecording,
    isSupported,
    error: recordingError,
    formattedDuration,
    clearError
  } = useRecording({
    autoCompress: true,
    compressionQuality: 0.8,
    maxDuration: 10 * 60 * 1000 // 10 minutes max
  });

  // Handle recording button click
  const handleRecordingToggle = useCallback(async () => {
    clearError();
    haptic.buttonPress();

    if (recordingState.isRecording) {
      stopRecording();
      haptic.recordingStop();
      announce('Recording stopped', 'polite');
    } else {
      // Check for API key before starting recording
      try {
        const { retrieveApiKey } = await import('@/lib/storage');
        const apiKey = await retrieveApiKey();

        if (!apiKey) {
          onError?.('OpenAI API key not configured. Please set your API key in settings before recording.');
          return;
        }
      } catch (error) {
        onError?.('Failed to check API key. Please try again.');
        return;
      }

      // Clear previous transcript and rewritten text when starting new recording
      setTranscript(null);
      setRewrittenText(null);
      setCurrentNoteId(null);
      transcriptionStartedRef.current = false;

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

        console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
        console.log('Video ready state:', video.readyState);
        console.log('Video current time:', video.currentTime);

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
      console.log('Starting camera...');

      // Wait a tick for React to re-render and create the video element
      await new Promise(resolve => setTimeout(resolve, 10));

      try {
        // Try with simpler constraints first
        let stream;
        try {
          console.log('Trying back camera...');
          // Try with back camera first
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'environment',
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            }
          });
        } catch (backCameraError) {
          console.log('Back camera failed, trying any camera...', backCameraError);
          // Fallback to any available camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            }
          });
        }

        console.log('Got camera stream:', stream);
        console.log('Video ref current:', videoRef.current);

        // Wait for video element to be available if it's not ready yet
        let retries = 0;
        while (!videoRef.current && retries < 10) {
          console.log(`Waiting for video element, retry ${retries + 1}`);
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }

        if (videoRef.current && stream) {
          console.log('Setting stream to video element');
          videoRef.current.srcObject = stream;

          // Set up timeout first
          cameraLoadingTimeoutRef.current = setTimeout(() => {
            console.log('Camera timeout reached, forcing activation');
            setIsCameraActive(true);
            setIsCameraLoading(false);
            cameraLoadingTimeoutRef.current = null;
          }, 5000);

          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            console.log('Video metadata loaded');
            if (videoRef.current) {
              videoRef.current.play().then(() => {
                console.log('Video playing successfully');
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
            console.log('Video ready state is good, playing immediately');
            videoRef.current.play().then(() => {
              console.log('Video playing immediately');
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
          console.log('videoRef.current:', videoRef.current);
          console.log('stream:', stream);
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
    onTranscriptionStart?.();

    try {
      // Get API key from encrypted storage
      const { retrieveApiKey } = await import('@/lib/storage');
      const apiKey = await retrieveApiKey();

      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please set your API key in settings.');
      }

      // Use the API utility function
      const { transcribeAudio } = await import('@/lib/api');
      const result = await transcribeAudio(audioBlob, selectedLanguage, apiKey);

      setTranscript(result.transcript);
      onTranscriptionComplete?.(result.transcript);

      // Auto-save transcript immediately
      await saveTranscriptUpdate(result.transcript);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      onError?.(errorMessage);
    } finally {
      setIsTranscribing(false);
    }
  }, [selectedLanguage, onTranscriptionStart, onTranscriptionComplete, onError]);

  // Handle text rewriting
  const handleRewrite = useCallback(async () => {
    if (!transcript) return;

    setIsRewriting(true);

    try {
      // Get API key from encrypted storage
      const { retrieveApiKey } = await import('@/lib/storage');
      const apiKey = await retrieveApiKey();

      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please set your API key in settings.');
      }

      const selectedPromptObj = rewritePrompts.find(p => p.id === selectedPrompt);
      if (!selectedPromptObj) {
        throw new Error('Selected rewrite prompt not found.');
      }

      // Use the API utility function
      const { rewriteText } = await import('@/lib/api');
      const result = await rewriteText(transcript, selectedPromptObj.prompt, apiKey);

      if (!result.rewrittenText) {
        throw new Error('No rewritten text was generated. Please try again.');
      }

      setRewrittenText(result.rewrittenText);

      // Auto-save rewritten text immediately
      await saveRewrittenTextUpdate(result.rewrittenText);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Rewriting failed';
      onError?.(errorMessage);
      // Keep original transcript as fallback - don't clear existing rewritten text
    } finally {
      setIsRewriting(false);
    }
  }, [transcript, selectedPrompt, rewritePrompts, onError]);

  // Handle recording completion and save note immediately
  React.useEffect(() => {
    if (recordingState.audioBlob && !recordingState.isRecording && !transcriptionStartedRef.current) {
      transcriptionStartedRef.current = true;

      // Save note immediately after recording stops
      saveNoteAfterRecording(recordingState.audioBlob);

      // Automatically start transcription after recording
      handleTranscription(recordingState.audioBlob);

      // Call completion callback with rewritten text if available
      onRecordingComplete?.(recordingState.audioBlob, transcript || undefined, photo || undefined, rewrittenText || undefined);
    }
  }, [recordingState.audioBlob, recordingState.isRecording]);

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
    <div className={cn("flex flex-col items-center gap-6 w-full", className)}>
      {/* Live region for screen reader announcements */}
      <LiveRegion />

      {/* Recording button */}
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
            "relative w-28 h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl active:scale-95 touch-manipulation focus:outline-none focus:ring-4 focus:ring-indigo-500/50",
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

      {/* Duration display */}
      {(recordingState.isRecording || recordingState.duration > 0) && (
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
      )}

      {/* Status text */}
      {!recordingState.isRecording && recordingState.duration === 0 && (
        <div className="text-center">
          <p className="text-sm md:text-base text-muted-foreground">
            {isTranscribing ? 'Processing...' : 'Tap to start recording'}
          </p>
        </div>
      )}

      {/* Transcription status */}
      {isTranscribing && (
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">
            Transcribing audio...
          </p>
        </div>
      )}

      {/* Transcript preview */}
      {transcript && (
        <div className="w-full max-w-md space-y-4">
          <div className="p-4 bg-card border border-border rounded-lg">
            <h3 className="font-medium text-foreground mb-2">Original Transcript:</h3>
            <p className="text-sm text-muted-foreground">{transcript}</p>
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
                className="w-full p-2 rounded-lg border border-border bg-card text-foreground text-sm transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
              >
                {rewritePrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRewrite}
              disabled={isRewriting || !transcript}
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

          {/* Rewritten text display */}
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
      )}

      {/* Camera preview or photo preview */}
      {(isCameraActive || isCameraLoading || photoPreview) && (
        <div className="relative w-full max-w-sm">
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
                  className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-sm text-white rounded-full hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
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
              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {transcript && (
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
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
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