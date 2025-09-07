import { AudioRecordingOptions, AudioPlaybackState } from '@/types';

// Audio recording utilities using MediaRecorder API
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private onDataAvailable?: (blob: Blob) => void;
  private onStateChange?: (state: 'inactive' | 'recording' | 'paused') => void;
  private onError?: (error: Error) => void;

  constructor(
    onDataAvailable?: (blob: Blob) => void,
    onStateChange?: (state: 'inactive' | 'recording' | 'paused') => void,
    onError?: (error: Error) => void
  ) {
    this.onDataAvailable = onDataAvailable;
    this.onStateChange = onStateChange;
    this.onError = onError;
  }

  async initialize(options: AudioRecordingOptions = {}): Promise<void> {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: options.sampleRate || 44100
        }
      });

      // Determine the best supported MIME type
      const mimeType = this.getBestMimeType(options.mimeType);
      
      // Create MediaRecorder with options
      const mediaRecorderOptions: MediaRecorderOptions = {
        mimeType
      };

      if (options.audioBitsPerSecond) {
        mediaRecorderOptions.audioBitsPerSecond = options.audioBitsPerSecond;
      }

      this.mediaRecorder = new MediaRecorder(this.stream, mediaRecorderOptions);

      // Set up event listeners
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType });
        this.audioChunks = [];
        this.onDataAvailable?.(audioBlob);
        this.onStateChange?.('inactive');
      };

      this.mediaRecorder.onstart = () => {
        this.startTime = Date.now();
        this.onStateChange?.('recording');
      };

      this.mediaRecorder.onpause = () => {
        this.onStateChange?.('paused');
      };

      this.mediaRecorder.onresume = () => {
        this.onStateChange?.('recording');
      };

      this.mediaRecorder.onerror = (event) => {
        const error = new Error(`MediaRecorder error: ${event.error?.message || 'Unknown error'}`);
        this.onError?.(error);
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to initialize audio recorder: ${errorMessage}`);
    }
  }

  private getBestMimeType(preferredType?: string): string {
    const types = [
      preferredType,
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav'
    ].filter(Boolean) as string[];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    // Fallback to default
    return 'audio/webm';
  }

  start(): void {
    if (!this.mediaRecorder) {
      throw new Error('AudioRecorder not initialized');
    }

    if (this.mediaRecorder.state === 'inactive') {
      this.audioChunks = [];
      this.mediaRecorder.start(1000); // Collect data every second
    }
  }

  stop(): void {
    if (!this.mediaRecorder) {
      throw new Error('AudioRecorder not initialized');
    }

    if (this.mediaRecorder.state === 'recording' || this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.stop();
    }
  }

  pause(): void {
    if (!this.mediaRecorder) {
      throw new Error('AudioRecorder not initialized');
    }

    if (this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  resume(): void {
    if (!this.mediaRecorder) {
      throw new Error('AudioRecorder not initialized');
    }

    if (this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  getState(): 'inactive' | 'recording' | 'paused' {
    return this.mediaRecorder?.state || 'inactive';
  }

  getDuration(): number {
    if (this.startTime === 0) return 0;
    return Date.now() - this.startTime;
  }

  cleanup(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.startTime = 0;
  }

  static isSupported(): boolean {
    return !!(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof window !== 'undefined' &&
      window.MediaRecorder
    );
  }
}

// Audio compression using Web Audio API
export class AudioCompressor {
  private audioContext: AudioContext | null = null;

  constructor() {
    if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  async compressAudio(audioBlob: Blob, quality: number = 0.7): Promise<Blob> {
    if (!this.audioContext) {
      // If Web Audio API is not available, return original blob
      return audioBlob;
    }

    try {
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Calculate optimal sample rate based on quality
      const targetSampleRate = Math.max(16000, audioBuffer.sampleRate * quality);
      
      // Create offline context for processing
      const offlineContext = new OfflineAudioContext(
        Math.min(audioBuffer.numberOfChannels, 2), // Limit to stereo
        Math.floor(audioBuffer.length * (targetSampleRate / audioBuffer.sampleRate)),
        targetSampleRate
      );

      // Create buffer source
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Apply compression using DynamicsCompressor
      const compressor = offlineContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, offlineContext.currentTime);
      compressor.knee.setValueAtTime(30, offlineContext.currentTime);
      compressor.ratio.setValueAtTime(12, offlineContext.currentTime);
      compressor.attack.setValueAtTime(0.003, offlineContext.currentTime);
      compressor.release.setValueAtTime(0.25, offlineContext.currentTime);

      // Add low-pass filter to remove high frequencies for better compression
      const lowPassFilter = offlineContext.createBiquadFilter();
      lowPassFilter.type = 'lowpass';
      lowPassFilter.frequency.setValueAtTime(8000, offlineContext.currentTime); // 8kHz cutoff

      // Connect nodes
      source.connect(compressor);
      compressor.connect(lowPassFilter);
      lowPassFilter.connect(offlineContext.destination);

      // Start processing
      source.start();
      const compressedBuffer = await offlineContext.startRendering();

      // Convert back to blob with optimized encoding
      return this.audioBufferToBlob(compressedBuffer, quality);
    } catch (error) {
      console.warn('Audio compression failed, returning original:', error);
      return audioBlob;
    }
  }

  private audioBufferToBlob(audioBuffer: AudioBuffer, quality: number = 0.7): Blob {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    
    // Use 16-bit or 8-bit based on quality
    const bitsPerSample = quality > 0.8 ? 16 : 8;
    const bytesPerSample = bitsPerSample / 8;
    
    // Create WAV file
    const buffer = new ArrayBuffer(44 + length * numberOfChannels * bytesPerSample);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * bytesPerSample, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
    view.setUint16(32, numberOfChannels * bytesPerSample, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * bytesPerSample, true);

    // Convert audio data with optimized bit depth
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        
        if (bitsPerSample === 16) {
          view.setInt16(offset, sample * 0x7FFF, true);
          offset += 2;
        } else {
          // 8-bit unsigned
          view.setUint8(offset, (sample + 1) * 127.5);
          offset += 1;
        }
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  cleanup(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
  }
}

// Audio playback utilities
export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private onStateChange?: (state: AudioPlaybackState) => void;
  private onError?: (error: Error) => void;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    onStateChange?: (state: AudioPlaybackState) => void,
    onError?: (error: Error) => void
  ) {
    this.onStateChange = onStateChange;
    this.onError = onError;
  }

  async loadAudio(audioBlob: Blob): Promise<void> {
    try {
      // Clean up previous audio
      this.cleanup();

      // Create new audio element
      this.audio = new Audio();
      this.audio.preload = 'metadata';
      this.audio.src = URL.createObjectURL(audioBlob);

      // Set up event listeners
      this.audio.onloadedmetadata = () => {
        this.emitStateChange();
      };

      this.audio.onplay = () => {
        this.startUpdateInterval();
        this.emitStateChange();
      };

      this.audio.onpause = () => {
        this.stopUpdateInterval();
        this.emitStateChange();
      };

      this.audio.onended = () => {
        this.stopUpdateInterval();
        this.emitStateChange();
      };

      this.audio.onerror = () => {
        const error = new Error('Audio playback error');
        this.onError?.(error);
      };

      this.audio.ontimeupdate = () => {
        this.emitStateChange();
      };

      // Wait for metadata to load
      const tryLoad = () => new Promise<void>((resolve, reject) => {
        if (!this.audio) {
          reject(new Error('Audio element not created'));
          return;
        }

        const onLoaded = () => {
          cleanup();
          resolve();
        };
        const onCanPlay = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error('Failed to load audio'));
        };

        const cleanup = () => {
          if (!this.audio) return;
          this.audio.removeEventListener('loadedmetadata', onLoaded);
          this.audio.removeEventListener('canplaythrough', onCanPlay);
          this.audio.removeEventListener('error', onError as any);
        };

        this.audio.addEventListener('loadedmetadata', onLoaded);
        this.audio.addEventListener('canplaythrough', onCanPlay, { once: true });
        this.audio.addEventListener('error', onError as any);

        // Trigger load explicitly
        this.audio.load();
      });

      try {
        await tryLoad();
      } catch (e1) {
        // Retry once with a generic webm type in case the blob's MIME string is too specific
        if (!this.audio) throw e1;
        const prevSrc = this.audio.src;
        try {
          const genericBlob = new Blob([audioBlob], { type: 'audio/webm' });
          this.audio.src = URL.createObjectURL(genericBlob);
          await tryLoad();
          if (prevSrc) URL.revokeObjectURL(prevSrc);
        } catch (e2) {
          if (prevSrc) URL.revokeObjectURL(prevSrc);
          const typeInfo = audioBlob.type || 'unknown';
          const sizeInfo = typeof audioBlob.size === 'number' ? `${audioBlob.size} bytes` : 'unknown size';
          throw new Error(`Failed to load audio (type=${typeInfo}, size=${sizeInfo})`);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load audio: ${errorMessage}`);
    }
  }

  play(): void {
    if (!this.audio) {
      throw new Error('No audio loaded');
    }
    this.audio.play().catch(error => {
      this.onError?.(new Error(`Playback failed: ${error.message}`));
    });
  }

  pause(): void {
    if (!this.audio) {
      throw new Error('No audio loaded');
    }
    this.audio.pause();
  }

  stop(): void {
    if (!this.audio) {
      throw new Error('No audio loaded');
    }
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  seek(time: number): void {
    if (!this.audio) {
      throw new Error('No audio loaded');
    }
    this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration));
  }

  setVolume(volume: number): void {
    if (!this.audio) {
      throw new Error('No audio loaded');
    }
    this.audio.volume = Math.max(0, Math.min(1, volume));
    this.emitStateChange();
  }

  getState(): AudioPlaybackState {
    if (!this.audio) {
      return {
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 1
      };
    }

    return {
      isPlaying: !this.audio.paused && !this.audio.ended,
      currentTime: this.audio.currentTime,
      duration: this.audio.duration || 0,
      volume: this.audio.volume
    };
  }

  private emitStateChange(): void {
    this.onStateChange?.(this.getState());
  }

  private startUpdateInterval(): void {
    this.stopUpdateInterval();
    this.updateInterval = setInterval(() => {
      this.emitStateChange();
    }, 100);
  }

  private stopUpdateInterval(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  cleanup(): void {
    this.stopUpdateInterval();
    
    if (this.audio) {
      this.audio.pause();
      // Clear the src before revoking to avoid transient GET blob errors in dev
      const currentSrc = this.audio.src;
      if (currentSrc) {
        this.audio.src = '';
        try {
          this.audio.load();
        } catch {}
        try {
          URL.revokeObjectURL(currentSrc);
        } catch {}
      }
      this.audio = null;
    }
  }

  static isSupported(): boolean {
    return typeof Audio !== 'undefined';
  }
}

// Utility functions
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Compress audio blob using Web Audio API
 */
export async function compressAudio(audioBlob: Blob, quality: number = 0.7): Promise<Blob> {
  const compressor = new AudioCompressor();
  try {
    return await compressor.compressAudio(audioBlob, quality);
  } finally {
    compressor.cleanup();
  }
}

/**
 * Convert audio format
 */
export async function convertAudioFormat(audioBlob: Blob, targetFormat: string): Promise<Blob> {
  // For now, return the original blob with updated type
  // In a real implementation, this would use Web Audio API to convert formats
  if (!targetFormat.startsWith('audio/')) {
    throw new Error(`Unsupported format: ${targetFormat}`);
  }
  
  // Simple format conversion by changing the MIME type
  // This is a simplified implementation - real conversion would require audio processing
  return new Blob([audioBlob], { type: targetFormat });
}

export async function getAudioDuration(audioBlob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.src = URL.createObjectURL(audioBlob);
    
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(audio.duration * 1000); // Convert to milliseconds
    };
    
    audio.onerror = () => {
      URL.revokeObjectURL(audio.src);
      reject(new Error('Failed to get audio duration'));
    };
  });
}

// Audio streaming utilities for large files
export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private chunks: ArrayBuffer[] = [];
  private isPlaying = false;

  constructor() {
    if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  async streamAudio(audioBlob: Blob, chunkSize: number = 64 * 1024): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Web Audio API not supported');
    }

    // Split blob into chunks for streaming
    const arrayBuffer = await audioBlob.arrayBuffer();
    this.chunks = [];
    
    for (let i = 0; i < arrayBuffer.byteLength; i += chunkSize) {
      const chunk = arrayBuffer.slice(i, i + chunkSize);
      this.chunks.push(chunk);
    }

    // Decode first chunk to start playback quickly
    if (this.chunks.length > 0) {
      await this.playChunk(0);
    }
  }

  private async playChunk(index: number): Promise<void> {
    if (!this.audioContext || index >= this.chunks.length) return;

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(this.chunks[index]);
      
      // Create source node
      this.sourceNode = this.audioContext.createBufferSource();
      this.sourceNode.buffer = audioBuffer;

      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      
      // Connect nodes
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      // Handle chunk completion
      this.sourceNode.onended = () => {
        if (this.isPlaying && index + 1 < this.chunks.length) {
          this.playChunk(index + 1);
        }
      };

      // Start playback
      this.sourceNode.start();
      this.isPlaying = true;

    } catch (error) {
      console.warn(`Failed to play chunk ${index}:`, error);
      // Try next chunk
      if (index + 1 < this.chunks.length) {
        this.playChunk(index + 1);
      }
    }
  }

  stop(): void {
    this.isPlaying = false;
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode = null;
    }
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(volume, this.audioContext?.currentTime || 0);
    }
  }

  cleanup(): void {
    this.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.chunks = [];
  }
}

// Progressive audio loading for better performance
export class ProgressiveAudioLoader {
  private loadedChunks = new Map<number, ArrayBuffer>();
  private totalChunks = 0;
  private chunkSize: number;

  constructor(chunkSize: number = 64 * 1024) {
    this.chunkSize = chunkSize;
  }

  async loadAudioProgressively(
    audioBlob: Blob,
    onChunkLoaded?: (chunkIndex: number, totalChunks: number) => void
  ): Promise<ArrayBuffer[]> {
    const arrayBuffer = await audioBlob.arrayBuffer();
    this.totalChunks = Math.ceil(arrayBuffer.byteLength / this.chunkSize);
    
    const chunks: ArrayBuffer[] = [];
    
    for (let i = 0; i < this.totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, arrayBuffer.byteLength);
      const chunk = arrayBuffer.slice(start, end);
      
      chunks.push(chunk);
      this.loadedChunks.set(i, chunk);
      
      onChunkLoaded?.(i, this.totalChunks);
      
      // Yield control to prevent blocking
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return chunks;
  }

  getChunk(index: number): ArrayBuffer | null {
    return this.loadedChunks.get(index) || null;
  }

  getLoadProgress(): number {
    return this.totalChunks > 0 ? this.loadedChunks.size / this.totalChunks : 0;
  }

  cleanup(): void {
    this.loadedChunks.clear();
    this.totalChunks = 0;
  }
}