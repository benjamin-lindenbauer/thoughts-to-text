import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatDuration, formatDate, formatFileSize, truncateText, generateId, validateEmail, sanitizeInput, debounce, throttle } from '@/lib/utils';
import { compressAudio, getAudioDuration, convertAudioFormat } from '@/lib/audio';
import { encryptData, decryptData, hashData } from '@/lib/storage';

describe('Utility Functions', () => {
  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(30)).toBe('0:30');
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(3661)).toBe('1:01:01');
    });

    it('should handle edge cases', () => {
      expect(formatDuration(-1)).toBe('0:00');
      expect(formatDuration(NaN)).toBe('0:00');
      expect(formatDuration(Infinity)).toBe('0:00');
    });
  });

  describe('formatDate', () => {
    it('should format dates correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      expect(formatDate(date)).toMatch(/Jan 15, 2024/);
      expect(formatDate(date, 'time')).toMatch(/10:30/);
      expect(formatDate(date, 'relative')).toMatch(/ago|in/);
    });

    it('should handle invalid dates', () => {
      const invalidDate = new Date('invalid');
      expect(formatDate(invalidDate)).toBe('Invalid Date');
    });
  });

  describe('formatFileSize', () => {
    it('should format file sizes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(1073741824)).toBe('1.0 GB');
    });

    it('should handle decimal places', () => {
      expect(formatFileSize(1536, 2)).toBe('1.50 KB');
      expect(formatFileSize(1536, 0)).toBe('2 KB');
    });
  });

  describe('truncateText', () => {
    it('should truncate text correctly', () => {
      const longText = 'This is a very long text that should be truncated';
      expect(truncateText(longText, 20)).toBe('This is a very long...');
      expect(truncateText(longText, 50)).toBe(longText);
      expect(truncateText('Short', 20)).toBe('Short');
    });

    it('should handle edge cases', () => {
      expect(truncateText('', 10)).toBe('');
      expect(truncateText('Test', 0)).toBe('...');
      expect(truncateText('Test', -1)).toBe('...');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should generate IDs with specified length', () => {
      const shortId = generateId(8);
      const longId = generateId(32);
      expect(shortId.length).toBe(8);
      expect(longId.length).toBe(32);
    });
  });

  describe('validateEmail', () => {
    it('should validate email addresses correctly', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize HTML input', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('alert("xss")');
      expect(sanitizeInput('<b>Bold text</b>')).toBe('Bold text');
      expect(sanitizeInput('Normal text')).toBe('Normal text');
    });

    it('should handle special characters', () => {
      expect(sanitizeInput('Text with & ampersand')).toBe('Text with &amp; ampersand');
      expect(sanitizeInput('Text with < and >')).toBe('Text with &lt; and &gt;');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce function calls', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should throttle function calls', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Audio Utilities', () => {
  beforeEach(() => {
    // Mock Web Audio API
    global.AudioContext = vi.fn().mockImplementation(() => ({
      createAnalyser: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
        getByteFrequencyData: vi.fn(),
      }),
      createMediaElementSource: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
      }),
      decodeAudioData: vi.fn().mockResolvedValue({
        duration: 120,
        sampleRate: 44100,
        numberOfChannels: 2,
      }),
      close: vi.fn(),
    }));
  });

  describe('compressAudio', () => {
    it('should compress audio blob', async () => {
      const originalBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const compressedBlob = await compressAudio(originalBlob, 0.8);

      expect(compressedBlob).toBeInstanceOf(Blob);
      expect(compressedBlob.type).toBe('audio/webm');
    });

    it('should handle compression errors', async () => {
      const invalidBlob = new Blob(['invalid'], { type: 'text/plain' });
      
      await expect(compressAudio(invalidBlob, 0.8)).rejects.toThrow();
    });
  });

  describe('getAudioDuration', () => {
    it('should get audio duration', async () => {
      const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const duration = await getAudioDuration(audioBlob);

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid audio', async () => {
      const invalidBlob = new Blob(['invalid'], { type: 'text/plain' });
      
      await expect(getAudioDuration(invalidBlob)).rejects.toThrow();
    });
  });

  describe('convertAudioFormat', () => {
    it('should convert audio format', async () => {
      const originalBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const convertedBlob = await convertAudioFormat(originalBlob, 'audio/mp4');

      expect(convertedBlob).toBeInstanceOf(Blob);
      expect(convertedBlob.type).toBe('audio/mp4');
    });

    it('should handle unsupported formats', async () => {
      const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
      
      await expect(convertAudioFormat(audioBlob, 'audio/unsupported')).rejects.toThrow();
    });
  });
});

describe('Storage Utilities', () => {
  beforeEach(() => {
    // Mock crypto API
    global.crypto = {
      ...global.crypto,
      subtle: {
        encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
        generateKey: vi.fn().mockResolvedValue({}),
        importKey: vi.fn().mockResolvedValue({}),
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      } as any,
    };
  });

  describe('encryptData', () => {
    it('should encrypt data', async () => {
      const data = 'sensitive data';
      const encrypted = await encryptData(data, 'password');

      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(data);
    });

    it('should handle encryption errors', async () => {
      vi.mocked(crypto.subtle.encrypt).mockRejectedValueOnce(new Error('Encryption failed'));
      
      await expect(encryptData('data', 'password')).rejects.toThrow('Encryption failed');
    });
  });

  describe('decryptData', () => {
    it('should decrypt data', async () => {
      const originalData = 'sensitive data';
      const encrypted = await encryptData(originalData, 'password');
      const decrypted = await decryptData(encrypted, 'password');

      expect(decrypted).toBe(originalData);
    });

    it('should handle decryption errors', async () => {
      vi.mocked(crypto.subtle.decrypt).mockRejectedValueOnce(new Error('Decryption failed'));
      
      await expect(decryptData('invalid', 'password')).rejects.toThrow('Decryption failed');
    });
  });

  describe('hashData', () => {
    it('should hash data consistently', async () => {
      const data = 'test data';
      const hash1 = await hashData(data);
      const hash2 = await hashData(data);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('should produce different hashes for different data', async () => {
      const hash1 = await hashData('data1');
      const hash2 = await hashData('data2');

      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('Performance Utilities', () => {
  beforeEach(() => {
    // Mock performance API
    global.performance = {
      ...global.performance,
      now: vi.fn().mockReturnValue(1000),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn().mockReturnValue([]),
    };
  });

  describe('Performance Monitoring', () => {
    it('should measure execution time', () => {
      const { measurePerformance } = require('@/lib/performance');
      
      const result = measurePerformance('test-operation', () => {
        return 'test result';
      });

      expect(result).toBe('test result');
      expect(performance.mark).toHaveBeenCalledWith('test-operation-start');
      expect(performance.mark).toHaveBeenCalledWith('test-operation-end');
      expect(performance.measure).toHaveBeenCalledWith(
        'test-operation',
        'test-operation-start',
        'test-operation-end'
      );
    });

    it('should handle async operations', async () => {
      const { measurePerformanceAsync } = require('@/lib/performance');
      
      const result = await measurePerformanceAsync('async-test', async () => {
        return Promise.resolve('async result');
      });

      expect(result).toBe('async result');
      expect(performance.mark).toHaveBeenCalledWith('async-test-start');
      expect(performance.mark).toHaveBeenCalledWith('async-test-end');
    });
  });

  describe('Memory Monitoring', () => {
    it('should monitor memory usage', () => {
      // Mock memory API
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 10000000,
          totalJSHeapSize: 20000000,
          jsHeapSizeLimit: 100000000,
        },
      });

      const { getMemoryUsage } = require('@/lib/performance');
      const memoryInfo = getMemoryUsage();

      expect(memoryInfo.used).toBe(10000000);
      expect(memoryInfo.total).toBe(20000000);
      expect(memoryInfo.limit).toBe(100000000);
      expect(memoryInfo.percentage).toBe(50);
    });
  });
});

describe('Animation Utilities', () => {
  beforeEach(() => {
    global.requestAnimationFrame = vi.fn().mockImplementation(cb => {
      setTimeout(cb, 16);
      return 1;
    });
    global.cancelAnimationFrame = vi.fn();
  });

  describe('Animation Helpers', () => {
    it('should create smooth animations', () => {
      const { createAnimation } = require('@/lib/animations');
      
      const mockCallback = vi.fn();
      const animation = createAnimation({
        duration: 1000,
        easing: 'ease-in-out',
        onUpdate: mockCallback,
      });

      animation.start();
      expect(requestAnimationFrame).toHaveBeenCalled();
    });

    it('should handle animation cancellation', () => {
      const { createAnimation } = require('@/lib/animations');
      
      const animation = createAnimation({
        duration: 1000,
        onUpdate: vi.fn(),
      });

      animation.start();
      animation.cancel();
      
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('Easing Functions', () => {
    it('should provide easing functions', () => {
      const { easing } = require('@/lib/animations');
      
      expect(typeof easing.linear).toBe('function');
      expect(typeof easing.easeInOut).toBe('function');
      expect(typeof easing.easeIn).toBe('function');
      expect(typeof easing.easeOut).toBe('function');

      // Test easing function behavior
      expect(easing.linear(0)).toBe(0);
      expect(easing.linear(1)).toBe(1);
      expect(easing.linear(0.5)).toBe(0.5);
    });
  });
});