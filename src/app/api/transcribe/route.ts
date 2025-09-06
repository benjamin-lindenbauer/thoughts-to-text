import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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

    // Call OpenAI Whisper API for transcription
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1', // Using whisper-1 as gpt-4o-transcribe is not available
      language: language,
      response_format: 'json',
    });

    return NextResponse.json({
      transcript: transcription.text,
      language: language,
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