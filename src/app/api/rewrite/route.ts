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

    // Get request body
    const body = await request.json();
    const { text, prompt, language } = body;

    if (!text) {
      return NextResponse.json(
        {
          error: 'Text is required for rewriting',
          type: 'unknown',
          retryable: false
        },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        {
          error: 'Rewrite prompt is required',
          type: 'unknown',
          retryable: false
        },
        { status: 400 }
      );
    }

    // Build the Responses API request (plain text output)
    const languageDirective = language
      ? `Rewrite the text in ${String(language)}.`
      : 'Rewrite the text in the same language as the original text. Detect the language automatically and preserve it.';

    const baseRequest: any = {
      model: 'gpt-5-mini',
      reasoning: { effort: "low" },
      instructions:
        'You are an expert writer. Follow the instructions carefully and return only the rewritten text.',
      input: `${languageDirective}\n\n${prompt}\n\nOriginal text:\n${text}`
    };

    const response = await openai.responses.create(baseRequest);

    // Read plain text from Responses API
    const outputText: string | undefined = (response as any)?.output_text;
    if (!outputText) {
      return NextResponse.json(
        {
          error: 'No output was generated',
          type: 'server',
          retryable: true,
        },
        { status: 500 }
      );
    }

    const result = {
      originalText: String(text),
      rewrittenText: String(outputText).trim(),
      prompt: String(prompt),
      requestedLanguage: language ? String(language) : undefined
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Rewrite error:', error);

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
        error: error?.message || 'An unexpected error occurred during text rewriting.',
        type: 'unknown',
        retryable: true
      },
      { status: 500 }
    );
  }
}