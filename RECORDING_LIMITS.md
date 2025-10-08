# Recording Duration and File Size Limits

## OpenAI Whisper API Constraint
The OpenAI Whisper transcription API has a **25MB file size limit**.

## Audio Format Analysis
Your app uses **Opus codec in WebM container** (`audio/webm;codecs=opus`).

### Bitrate Estimates
- **Typical browser default**: 48-64 kbps for Opus voice
- **Worst-case scenario**: 128 kbps (some browsers may use higher quality)

### Duration Calculations for 25MB

| Bitrate | Max Duration | File Size at Max |
|---------|--------------|------------------|
| 48 kbps | ~69 minutes  | 25 MB           |
| 64 kbps | ~52 minutes  | 25 MB           |
| 128 kbps| ~27 minutes  | 25 MB           |

## Implemented Solution

### 1. Maximum Recording Duration
**Set to 10 minutes** (balances file size and transcription time)

- At 128 kbps (worst case): 10 minutes ≈ 9.4MB
- This ensures recordings stay well under the 25MB limit
- Keeps transcription time reasonable for better user experience

### 2. File Size Validation
Implemented **dual-layer validation**:

#### Frontend Validation (`RecordingInterface.tsx`)
- Checks file size before calling transcription API
- Shows user-friendly error: `"Recording is too large (X.XMB). Maximum file size is 25MB. Please record a shorter audio."`

#### Backend Validation (`api.ts`)
- Additional safety check in the `transcribeAudio()` function
- Throws validation error if file exceeds 25MB
- Prevents unnecessary API calls

### 3. Changes Made

**File: `src/components/RecordingInterface.tsx`**
- Set `MAX_RECORDING_TIME_SECONDS` to 10 minutes
- Added `MAX_FILE_SIZE_BYTES` constant (25MB)
- Added file size check in `handleTranscription()` before API call
- Updated dependency array to include validation constants

**File: `src/lib/api.ts`**
- Added file size validation at API layer
- Throws non-retryable validation error for oversized files

## Platform-Specific Recording Durations

With the 10-minute limit, recordings will be safe across all platforms:

- **Android**: ✅ Safe (typically 48-64 kbps) → ~3.5-4.7 MB
- **Windows**: ✅ Safe (typically 64-96 kbps) → ~4.7-7 MB
- **Apple devices**: ✅ Safe (typically 64-96 kbps) → ~4.7-7 MB

All platforms will produce files well under 25MB at 10 minutes, with reasonable transcription times.
