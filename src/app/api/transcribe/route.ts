import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Ensure this route runs in the Node.js runtime where the OpenAI SDK is fully supported
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Get the API key from headers
    const apiKey = request.headers.get('x-openai-api-key');

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'API key is required',
          type: 'auth',
          retryable: false
        },
        { status: 401 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Get form data from request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const language = formData.get('language') as string || 'en';
    const prompt = formData.get('prompt') as string || '';
    const model = formData.get('model') as string || 'gpt-4o-transcribe';

    if (!audioFile) {
      return NextResponse.json(
        {
          error: 'Audio file is required',
          type: 'unknown',
          retryable: false
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!audioFile.type.startsWith('audio/')) {
      return NextResponse.json(
        {
          error: 'Invalid file type. Please upload an audio file.',
          type: 'unknown',
          retryable: false
        },
        { status: 400 }
      );
    }

    // Validate file size (avoid sending empty/corrupted files)
    if (typeof audioFile.size === 'number' && audioFile.size <= 0) {
      return NextResponse.json(
        {
          error: 'Empty audio file received. Please record again.',
          type: 'unknown',
          retryable: false
        },
        { status: 400 }
      );
    }

    // Prepare transcription parameters
    const transcriptionParams: any = {
      file: audioFile,
      model: model,
      response_format: 'json',
    };

    // Add language parameter only for whisper-1 model
    // gpt-4o models handle language detection automatically
    if (model === 'whisper-1' && language && language !== 'auto') {
      transcriptionParams.language = language;
    }

    // Add prompt if provided (helps with accuracy, especially for technical terms)
    if (prompt) {
      transcriptionParams.prompt = prompt;
    }

    // Call OpenAI API for transcription
    const transcription = await openai.audio.transcriptions.create(transcriptionParams);

    return NextResponse.json({
      transcript: transcription.text,
      language: language,
      model: model,
    });

  } catch (error: any) {
    console.error('Transcription error:', error);

    // Handle specific OpenAI errors
    if (error?.status === 401) {
      return NextResponse.json(
        {
          error: 'Invalid API key. Please check your OpenAI API key.',
          type: 'auth',
          retryable: false
        },
        { status: 401 }
      );
    }

    // Bad request (commonly due to unsupported/corrupted audio)
    if (error?.status === 400) {
      return NextResponse.json(
        {
          error: error?.message || 'Audio file might be corrupted or unsupported',
          type: 'unknown',
          retryable: false
        },
        { status: 400 }
      );
    }

    if (error?.status === 429) {
      const retryAfter = error?.headers?.['retry-after'] ?
        parseInt(error.headers['retry-after']) : 60;

      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          type: 'quota',
          retryable: true,
          retryAfter: retryAfter
        },
        { status: 429 }
      );
    }

    if (error?.status >= 500) {
      return NextResponse.json(
        {
          error: 'OpenAI service is temporarily unavailable. Please try again.',
          type: 'server',
          retryable: true
        },
        { status: 503 }
      );
    }

    // Network or unknown errors
    if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
      return NextResponse.json(
        {
          error: 'Network error. Please check your internet connection.',
          type: 'network',
          retryable: true
        },
        { status: 503 }
      );
    }

    // Generic error fallback
    return NextResponse.json(
      {
        error: error?.message || 'An unexpected error occurred during transcription.',
        type: 'unknown',
        retryable: true
      },
      { status: 500 }
    );
  }
}