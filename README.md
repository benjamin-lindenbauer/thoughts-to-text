# Thoughts to Text

A progressive web app built with Next.js that turns voice notes into polished, shareable text. Capture ideas with audio, optionally add photos, and let AI handle transcription, rewriting, and metadata generation - online or offline.

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Development Scripts](#development-scripts)
- [Project Structure](#project-structure)
- [Data Storage & Privacy](#data-storage--privacy)

## Overview
Thoughts to Text provides an end-to-end workflow for capturing spoken ideas and refining them into usable text. The app ships as an installable PWA with offline-first storage, background processing, and a notes workspace for reviewing and editing finished transcripts. It relies on your own OpenAI API key, which is stored locally on-device and added to API calls only when needed.

## Key Features
- **Voice-first capture experience.** Record up to 10 minutes of audio with haptic/accessibility feedback, auto-save guards, and real-time status indicators. Attach a photo from the device camera or file system before saving the note.
- **Automated transcription and rewriting.** Submit recordings to OpenAI for transcription, generate rewritten summaries using customizable prompts, and produce AI-assisted titles, descriptions, and keywords without leaving the note view.
- **Rich note management.** Browse, search, and filter notes; expand them inline when offline; share or delete with confirmation flows; and edit metadata directly from the detail page.
- **Offline-first PWA.** Works without a network by persisting data in IndexedDB via LocalForage, queueing background processing tasks, and registering a service worker with custom events for sync and install prompts.
- **Customizable settings.** Configure your OpenAI API key, theme, default language, and bespoke rewrite prompts. Install the app to your device directly from the Settings screen when the browser signals availability.

## Tech Stack
- [Next.js 15 App Router](https://nextjs.org/) with React 19 and TypeScript.
- Tailwind CSS v4 for styling plus Radix UI primitives and custom animation utilities.
- LocalForage-backed storage for notes, audio, photos, and encrypted API keys.
- OpenAI SDK for transcription, rewriting, and metadata generation endpoints.

## Getting Started
1. **Install dependencies.**
   ```bash
   npm install
   ```
2. **Start the development server.**
   ```bash
   npm run dev
   ```
3. **Open the app.** Visit http://localhost:3000 in your browser. The UI auto-reloads as you edit code.
4. **Provide your OpenAI API key.** Navigate to Settings > OpenAI API Key, paste your key (must start with `sk-`), and save. The key is stored locally and attached to API requests through the app's secure client-side storage helpers.
5. **Record your first note.** Use the home page interface to capture audio, add optional photos, run transcription/rewrites, and save the note to your local library.

> **Requirements:** Use Node.js 18.18+ (per Next.js 15) and npm 9+ or another compatible package manager.

## Development Scripts
- `npm run dev` - Launch the dev server with Turbopack for hot reloading.
- `npm run build` - Create an optimized production build (also via Turbopack).
- `npm run start` - Serve the production build.
- `npm run test` - Run the Vitest test suite (unit, hooks, components, and integration). Additional scoped scripts like `test:unit`, `test:integration`, and `test:components` are available for targeted runs.

## Project Structure
```
src/
  app/                # App Router routes, layouts, and API handlers
  components/         # UI building blocks (recording, notes, settings, toasts, etc.)
  contexts/           # Global providers (theme, app state)
  hooks/              # Client hooks (recording, offline status, filters)
  lib/                # Storage, API utilities, offline processing helpers
  types/              # Shared TypeScript definitions
public/               # Manifest, icons, and static assets
```

## Data Storage & Privacy
All notes, audio, photos, settings, and API keys are stored locally in the browser via LocalForage with lightweight encryption for the API key. Nothing is uploaded to external servers except direct calls you make to OpenAI's APIs using your own key. You can clear stored content at any time from the Settings page.
