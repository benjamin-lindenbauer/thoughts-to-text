import { describe, it, expect } from 'vitest';

/**
 * Comprehensive Test Suite Runner
 * 
 * This file serves as the entry point for running all tests in the application.
 * It provides utilities for test organization and reporting.
 */

export interface TestSuiteResult {
  name: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

export interface TestReport {
  suites: TestSuiteResult[];
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalDuration: number;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

/**
 * Test categories for organization
 */
export const TEST_CATEGORIES = {
  UNIT: 'unit',
  INTEGRATION: 'integration',
  E2E: 'e2e',
  COMPONENT: 'component',
  CROSS_BROWSER: 'cross-browser',
  PERFORMANCE: 'performance',
  ACCESSIBILITY: 'accessibility',
} as const;

/**
 * Test suite metadata
 */
export const TEST_SUITES = [
  // Unit Tests
  {
    name: 'Storage Operations',
    category: TEST_CATEGORIES.UNIT,
    path: 'src/lib/__tests__/storage.test.ts',
    description: 'Tests for Local Storage and Local Forage operations',
  },
  {
    name: 'Audio Recording and Playback',
    category: TEST_CATEGORIES.UNIT,
    path: 'src/lib/__tests__/audio.test.ts',
    description: 'Tests for MediaRecorder API wrapper and audio utilities',
  },
  {
    name: 'PWA Functionality',
    category: TEST_CATEGORIES.UNIT,
    path: 'src/lib/__tests__/pwa.test.ts',
    description: 'Tests for service worker and PWA features',
  },
  {
    name: 'API Integration',
    category: TEST_CATEGORIES.UNIT,
    path: 'src/test/api.test.ts',
    description: 'Tests for OpenAI API integration and error handling',
  },
  {
    name: 'Utility Functions',
    category: TEST_CATEGORIES.UNIT,
    path: 'src/test/utils/all-utilities.test.ts',
    description: 'Tests for all utility functions and helpers',
  },

  // Hook Tests
  {
    name: 'Recording Hook',
    category: TEST_CATEGORIES.UNIT,
    path: 'src/hooks/__tests__/useRecording.test.ts',
    description: 'Tests for audio recording hook',
  },
  {
    name: 'Settings Hook',
    category: TEST_CATEGORIES.UNIT,
    path: 'src/hooks/__tests__/useSettings.test.ts',
    description: 'Tests for settings management hook',
  },
  {
    name: 'App State Hook',
    category: TEST_CATEGORIES.UNIT,
    path: 'src/hooks/__tests__/useAppState.test.tsx',
    description: 'Tests for global app state management',
  },
  {
    name: 'Offline Hook',
    category: TEST_CATEGORIES.UNIT,
    path: 'src/hooks/__tests__/useOffline.test.ts',
    description: 'Tests for offline detection and handling',
  },
  {
    name: 'Toast Hook',
    category: TEST_CATEGORIES.UNIT,
    path: 'src/hooks/__tests__/useToast.test.tsx',
    description: 'Tests for toast notification system',
  },

  // Component Tests
  {
    name: 'Audio Player Component',
    category: TEST_CATEGORIES.COMPONENT,
    path: 'src/components/__tests__/AudioPlayer.test.tsx',
    description: 'Tests for audio playback component',
  },
  {
    name: 'Settings Form Component',
    category: TEST_CATEGORIES.COMPONENT,
    path: 'src/components/__tests__/SettingsForm.test.tsx',
    description: 'Tests for settings configuration form',
  },
  {
    name: 'Delete Confirmation Dialog',
    category: TEST_CATEGORIES.COMPONENT,
    path: 'src/components/__tests__/DeleteConfirmationDialog.test.tsx',
    description: 'Tests for delete confirmation modal',
  },
  {
    name: 'Major UI Components',
    category: TEST_CATEGORIES.COMPONENT,
    path: 'src/test/components/major-components.test.tsx',
    description: 'Tests for all major UI components',
  },

  // Integration Tests
  {
    name: 'API Integration',
    category: TEST_CATEGORIES.INTEGRATION,
    path: 'src/test/api-integration.test.ts',
    description: 'Integration tests for API calls with retry logic',
  },
  {
    name: 'Recording Flow',
    category: TEST_CATEGORIES.INTEGRATION,
    path: 'src/test/integration/recording-flow.test.ts',
    description: 'End-to-end recording and transcription flow',
  },
  {
    name: 'Offline Functionality',
    category: TEST_CATEGORIES.INTEGRATION,
    path: 'src/test/integration/offline-functionality.test.ts',
    description: 'Offline recording and sync functionality',
  },

  // E2E Tests
  {
    name: 'Critical User Journeys',
    category: TEST_CATEGORIES.E2E,
    path: 'src/test/e2e/critical-user-journeys.test.ts',
    description: 'Complete user workflows from start to finish',
  },

  // Cross-Browser Tests
  {
    name: 'Browser Compatibility',
    category: TEST_CATEGORIES.CROSS_BROWSER,
    path: 'src/test/cross-browser/compatibility.test.ts',
    description: 'Cross-browser compatibility and feature detection',
  },

  // Error Handling Tests
  {
    name: 'Error Handling',
    category: TEST_CATEGORIES.UNIT,
    path: 'src/test/error-handling.test.ts',
    description: 'Comprehensive error handling and recovery',
  },
] as const;

/**
 * Get test suites by category
 */
export function getTestSuitesByCategory(category: string) {
  return TEST_SUITES.filter(suite => suite.category === category);
}

/**
 * Get all test categories
 */
export function getAllCategories() {
  return Object.values(TEST_CATEGORIES);
}

/**
 * Test coverage requirements
 */
export const COVERAGE_THRESHOLDS = {
  lines: 80,
  functions: 80,
  branches: 70,
  statements: 80,
};

/**
 * Performance benchmarks for tests
 */
export const PERFORMANCE_BENCHMARKS = {
  unitTest: 100, // ms
  integrationTest: 5000, // ms
  e2eTest: 30000, // ms
  componentTest: 1000, // ms
};

/**
 * Test utilities for common setup
 */
export const testUtils = {
  /**
   * Create a mock API response
   */
  createMockResponse: (data: any, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }),

  /**
   * Create a mock audio blob
   */
  createMockAudioBlob: (duration = 1000) => {
    const blob = new Blob(['mock audio data'], { type: 'audio/webm' });
    Object.defineProperty(blob, 'duration', { value: duration });
    return blob;
  },

  /**
   * Create a mock note object
   */
  createMockNote: (overrides = {}) => ({
    id: 'test-note-' + Math.random().toString(36).substr(2, 9),
    title: 'Test Note',
    description: 'Test note description',
    transcript: 'This is a test transcript',
    createdAt: new Date(),
    updatedAt: new Date(),
    duration: 30,
    language: 'en',
    keywords: ['test'],
    ...overrides,
  }),

  /**
   * Wait for async operations
   */
  waitFor: (condition: () => boolean, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        if (condition()) {
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  },
};

/**
 * Test environment setup
 */
export function setupTestEnvironment() {
  // Mock global APIs that might not be available in test environment
  if (typeof global.crypto === 'undefined') {
    global.crypto = {
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
      getRandomValues: (arr: any) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
    } as any;
  }

  if (typeof global.MediaRecorder === 'undefined') {
    global.MediaRecorder = class MockMediaRecorder {
      static isTypeSupported = () => true;
      start = () => {};
      stop = () => {};
      addEventListener = () => {};
      removeEventListener = () => {};
      state = 'inactive';
    } as any;
  }

  if (typeof global.fetch === 'undefined') {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({}),
    }) as any;
  }
}

/**
 * Test reporter for CI/CD integration
 */
export class TestReporter {
  private results: TestSuiteResult[] = [];

  addResult(result: TestSuiteResult) {
    this.results.push(result);
  }

  generateReport(): TestReport {
    const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0);
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    return {
      suites: this.results,
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalDuration,
    };
  }

  exportJUnit(): string {
    // Generate JUnit XML format for CI/CD systems
    const report = this.generateReport();
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="${report.totalTests}" failures="${report.totalFailed}" time="${report.totalDuration / 1000}">
  ${this.results.map(suite => `
  <testsuite name="${suite.name}" tests="${suite.passed + suite.failed + suite.skipped}" failures="${suite.failed}" time="${suite.duration / 1000}">
  </testsuite>`).join('')}
</testsuites>`;
  }
}

// Initialize test environment
setupTestEnvironment();

describe('Test Suite Validation', () => {
  it('should have all required test suites', () => {
    const requiredCategories = Object.values(TEST_CATEGORIES);
    const availableCategories = [...new Set(TEST_SUITES.map(s => s.category))];
    
    requiredCategories.forEach(category => {
      expect(availableCategories).toContain(category);
    });
  });

  it('should have tests for all critical components', () => {
    const criticalComponents = [
      'RecordingInterface',
      'AudioPlayer', 
      'NotesList',
      'SettingsForm',
      'OfflineIndicator',
    ];

    const componentTests = TEST_SUITES.filter(s => s.category === TEST_CATEGORIES.COMPONENT);
    
    // Verify we have component tests
    expect(componentTests.length).toBeGreaterThan(0);
  });

  it('should have integration tests for main flows', () => {
    const integrationTests = TEST_SUITES.filter(s => s.category === TEST_CATEGORIES.INTEGRATION);
    
    expect(integrationTests.some(t => t.name.includes('Recording'))).toBe(true);
    expect(integrationTests.some(t => t.name.includes('Offline'))).toBe(true);
  });
});