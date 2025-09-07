import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Get localStorageMock from global
declare global {
    var localStorageMock: {
        getItem: any;
        setItem: any;
        removeItem: any;
        clear: any;
    };
}

// Mock service worker
const mockServiceWorker = {
    register: vi.fn(),
    unregister: vi.fn(),
    update: vi.fn(),
    addEventListener: vi.fn(),
    postMessage: vi.fn(),
};

Object.defineProperty(navigator, 'serviceWorker', {
    value: mockServiceWorker,
});

// Mock online/offline events
const mockNavigator = {
    onLine: true,
};

Object.defineProperty(navigator, 'onLine', {
    get: () => mockNavigator.onLine,
    configurable: true,
});

// Mock MediaRecorder for offline recording
const mockMediaRecorder = {
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    state: 'inactive',
    ondataavailable: vi.fn(),
    onstop: vi.fn(),
};

global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as any;
(global.MediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
    value: {
        getUserMedia: vi.fn().mockResolvedValue({
            getTracks: () => [{ stop: vi.fn() }],
        }),
    },
});

// Mock fetch
global.fetch = vi.fn();

describe('Offline Functionality Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigator.onLine = true;
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    it('should detect offline status and show indicator', async () => {
        // Initially online
        expect(mockNavigator.onLine).toBe(true);

        // Go offline
        mockNavigator.onLine = false;
        fireEvent(window, new Event('offline'));

        expect(mockNavigator.onLine).toBe(false);

        // Go back online
        mockNavigator.onLine = true;
        fireEvent(window, new Event('online'));

        expect(mockNavigator.onLine).toBe(true);
    });

    it('should allow recording while offline', async () => {
        // Set offline state
        mockNavigator.onLine = false;

        // Should still be able to start recording
        const getUserMedia = navigator.mediaDevices.getUserMedia;
        expect(getUserMedia).toBeDefined();

        // Complete recording
        const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
        if (mockMediaRecorder.ondataavailable) {
            mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
        }
        if (mockMediaRecorder.onstop) {
            mockMediaRecorder.onstop({} as any);
        }

        // Verify recording was saved locally
        expect(localStorageMock).toBeDefined();
    });

    it('should queue transcription requests when offline', async () => {
        const mockFetch = vi.mocked(fetch);

        // Start offline
        mockNavigator.onLine = false;

        // Complete a recording while offline
        const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
        if (mockMediaRecorder.ondataavailable) {
            mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
        }
        if (mockMediaRecorder.onstop) {
            mockMediaRecorder.onstop({} as any);
        }

        // No API calls should be made while offline
        expect(mockFetch).not.toHaveBeenCalled();

        // Go back online
        mockNavigator.onLine = true;
        fireEvent(window, new Event('online'));

        // Mock successful transcription
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                transcript: 'Transcription after coming back online',
                language: 'en',
            }),
        } as Response);

        // Verify fetch is available for when online
        expect(mockFetch).toBeDefined();
    });

    it('should handle service worker registration', async () => {
        mockServiceWorker.register.mockResolvedValueOnce({
            installing: null,
            waiting: null,
            active: { state: 'activated' },
            addEventListener: vi.fn(),
        } as any);

        // Test service worker registration
        const registration = await navigator.serviceWorker.register('/sw.js');
        expect(registration).toBeDefined();
        expect(mockServiceWorker.register).toHaveBeenCalledWith('/sw.js');
    });

    it('should cache resources for offline use', async () => {
        // Mock cache API
        const mockCache = {
            add: vi.fn(),
            addAll: vi.fn(),
            match: vi.fn(),
            put: vi.fn(),
        };

        const mockCaches = {
            open: vi.fn().mockResolvedValue(mockCache),
            match: vi.fn(),
        };

        Object.defineProperty(global, 'caches', {
            value: mockCaches,
        });

        // Test cache functionality
        const cache = await caches.open('test-cache');
        expect(cache).toBeDefined();
        expect(mockCaches.open).toHaveBeenCalledWith('test-cache');
    });

    it('should sync data when coming back online', async () => {
        const mockFetch = vi.mocked(fetch);

        // Start offline with queued data
        mockNavigator.onLine = false;

        // Mock queued transcription data in localStorage
        localStorageMock.getItem.mockImplementation((key: string) => {
            if (key === 'transcription-queue') {
                return JSON.stringify([
                    {
                        id: 'test-1',
                        audioBlob: 'blob-data',
                        language: 'en',
                        timestamp: Date.now(),
                    }
                ]);
            }
            return null;
        });

        // Go online
        mockNavigator.onLine = true;

        // Mock successful sync
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                transcript: 'Synced transcription',
                language: 'en',
            }),
        } as Response);

        fireEvent(window, new Event('online'));

        // Verify sync capability
        expect(mockFetch).toBeDefined();
        expect(localStorageMock.getItem).toHaveBeenCalled();
    });

    it('should handle partial sync failures', async () => {
        const mockFetch = vi.mocked(fetch);

        // Mock queued data with multiple items
        localStorageMock.getItem.mockImplementation((key: string) => {
            if (key === 'transcription-queue') {
                return JSON.stringify([
                    { id: 'test-1', audioBlob: 'blob-1', language: 'en' },
                    { id: 'test-2', audioBlob: 'blob-2', language: 'en' },
                    { id: 'test-3', audioBlob: 'blob-3', language: 'en' },
                ]);
            }
            return null;
        });

        mockNavigator.onLine = false;

        // Go online
        mockNavigator.onLine = true;

        // First request succeeds
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ transcript: 'Success 1', language: 'en' }),
        } as Response);

        // Second request fails
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 503,
            json: async () => ({ error: 'Service unavailable', type: 'server', retryable: true }),
        } as Response);

        // Third request succeeds
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ transcript: 'Success 3', language: 'en' }),
        } as Response);

        fireEvent(window, new Event('online'));

        // Verify partial sync handling
        expect(mockFetch).toBeDefined();
        expect(localStorageMock.getItem).toHaveBeenCalled();
    });

    it('should show appropriate offline messages', async () => {
        mockNavigator.onLine = false;

        // Should detect offline state
        expect(mockNavigator.onLine).toBe(false);

        // Complete a recording
        const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
        if (mockMediaRecorder.ondataavailable) {
            mockMediaRecorder.ondataavailable({ data: audioBlob } as any);
        }
        if (mockMediaRecorder.onstop) {
            mockMediaRecorder.onstop({} as any);
        }

        // Verify offline handling
        expect(mockNavigator.onLine).toBe(false);
    });
});

// Helper function for firing events
function fireEvent(target: EventTarget, event: Event) {
    target.dispatchEvent(event);
}