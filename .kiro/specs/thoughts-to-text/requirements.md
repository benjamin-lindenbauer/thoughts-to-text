# Requirements Document

## Introduction

The "Thoughts to Text" application is a Progressive Web App (PWA) built with Next.js 15, React 19, TypeScript, and TailwindCSS 4. It enables users to record voice memos, transcribe them using OpenAI's speech-to-text API, and enhance the transcriptions with AI-powered rewriting. The app operates entirely client-side with local storage, supports offline functionality, and requires users to provide their own OpenAI API key.

## Requirements

### Requirement 1: Core Recording Functionality

**User Story:** As a user, I want to record voice memos with language selection and duration display, so that I can capture my thoughts in my preferred language and know how long I've been recording.

#### Acceptance Criteria

1. WHEN the user taps the record button THEN the system SHALL start audio recording and display a recording indicator
2. WHEN recording is active THEN the system SHALL display the current recording duration in real-time
3. WHEN the user selects a language THEN the system SHALL use that language for transcription
4. WHEN the user stops recording THEN the system SHALL save the audio file locally and automatically initiate transcription
5. IF the device is offline WHEN recording stops THEN the system SHALL queue the recording for transcription when connectivity is restored

### Requirement 2: Offline Support and PWA Capabilities

**User Story:** As a user, I want the app to work offline and sync when I'm back online, so that I can record thoughts even without internet connectivity.

#### Acceptance Criteria

1. WHEN the app is installed THEN the system SHALL function as a Progressive Web App with offline capabilities
2. WHEN the device goes offline THEN the system SHALL display offline status and continue allowing recordings
3. WHEN recordings are made offline THEN the system SHALL store them locally using Local Storage and Local Forage
4. WHEN connectivity is restored THEN the system SHALL automatically transcribe all queued offline recordings
5. WHEN the app loads THEN the system SHALL register a service worker for offline functionality

### Requirement 3: AI-Powered Transcription and Rewriting

**User Story:** As a user, I want my recordings automatically transcribed and enhanced with AI rewriting options, so that I can get polished text from my voice memos.

#### Acceptance Criteria

1. WHEN a recording is completed THEN the system SHALL automatically transcribe it using OpenAI's "gpt-4o-transcribe" model
2. WHEN transcription is complete THEN the system SHALL display rewrite prompt options with a default selection
3. WHEN the user clicks the rewrite button THEN the system SHALL enhance the transcript using OpenAI's "gpt-5" model
4. WHEN no OpenAI API key is configured THEN the system SHALL prompt the user to set their API key
5. IF API calls fail THEN the system SHALL display appropriate error messages and retain the original transcript

### Requirement 4: Note Management and History

**User Story:** As a user, I want to view, organize, and manage my previous recordings, so that I can easily find and reference my past thoughts.

#### Acceptance Criteria

1. WHEN recordings are saved THEN the system SHALL store them in Local Storage and Local Forage with metadata
2. WHEN the user accesses the notes page THEN the system SHALL display a list of all recordings with title, date, time, and description
3. WHEN a note lacks a title or description THEN the system SHALL auto-generate them using the rewrite API
4. WHEN the user taps a note THEN the system SHALL open the note details page
5. WHEN viewing note details THEN the system SHALL display title, date, keywords, description, transcript, rewritten text, and photo if available

### Requirement 5: Photo Integration

**User Story:** As a user, I want to add photos to my voice recordings, so that I can provide visual context to my thoughts.

#### Acceptance Criteria

1. WHEN recording THEN the system SHALL provide an option to add a photo from the camera
2. WHEN a photo is added THEN the system SHALL store it locally and associate it with the recording
3. WHEN viewing note details THEN the system SHALL display the associated photo if available
4. WHEN sharing a note THEN the system SHALL include the photo in the shared content if present

### Requirement 6: Settings and Customization

**User Story:** As a user, I want to configure my preferences including API key, default language, and rewrite prompts, so that the app works according to my needs.

#### Acceptance Criteria

1. WHEN the user accesses settings THEN the system SHALL provide fields for OpenAI API key configuration
2. WHEN the user sets a default language THEN the system SHALL use it as the default selection for new recordings
3. WHEN the user manages rewrite prompts THEN the system SHALL allow creating, editing, and deleting custom prompts
4. WHEN rewrite prompts are modified THEN the system SHALL save them locally and make them available for selection
5. WHEN the user changes theme preference THEN the system SHALL apply the selected theme (dark/light/auto)

### Requirement 7: Theme and Responsive Design

**User Story:** As a user, I want the app to adapt to my device's theme preference and work well on mobile devices, so that I have a consistent and comfortable user experience.

#### Acceptance Criteria

1. WHEN the app loads THEN the system SHALL detect and apply the device's current theme setting (dark/light)
2. WHEN the user manually changes the theme THEN the system SHALL override the automatic setting and remember the preference
3. WHEN viewed on mobile devices THEN the system SHALL display three navigation buttons at the bottom (history, record, settings)
4. WHEN viewed on different screen sizes THEN the system SHALL provide responsive layouts using TailwindCSS
5. WHEN using accent colors THEN the system SHALL use indigo-500 and purple-500 instead of green and blue tones

### Requirement 8: Note Operations and Sharing

**User Story:** As a user, I want to edit, delete, and share my notes, so that I can manage my content and share insights with others.

#### Acceptance Criteria

1. WHEN viewing a note THEN the system SHALL provide options to edit, delete, and share
2. WHEN editing a note THEN the system SHALL allow modification of title, description, and other editable fields
3. WHEN deleting a note THEN the system SHALL remove it from local storage after confirmation
4. WHEN sharing a note THEN the system SHALL use the Web Share API to share title, content, and photo
5. WHEN playing audio THEN the system SHALL provide playback controls for the original recording

### Requirement 9: API Integration and Error Handling

**User Story:** As a user, I want reliable API integration with proper error handling, so that I can trust the transcription and rewriting features.

#### Acceptance Criteria

1. WHEN making API calls THEN the system SHALL use the configured OpenAI API key for authentication
2. WHEN API calls succeed THEN the system SHALL process and store the results appropriately
3. WHEN API calls fail THEN the system SHALL display user-friendly error messages
4. WHEN rate limits are exceeded THEN the system SHALL inform the user and suggest retry timing
5. IF the API key is invalid THEN the system SHALL prompt the user to check their configuration

### Requirement 10: Data Persistence and Performance

**User Story:** As a user, I want my data to be reliably stored locally and the app to perform well, so that I don't lose my recordings and have a smooth experience.

#### Acceptance Criteria

1. WHEN data is saved THEN the system SHALL use both Local Storage and Local Forage for redundancy
2. WHEN the app starts THEN the system SHALL load existing data efficiently
3. WHEN storage is nearly full THEN the system SHALL warn the user and suggest cleanup options
4. WHEN large files are stored THEN the system SHALL use Local Forage for better performance
5. WHEN data corruption is detected THEN the system SHALL attempt recovery and inform the user