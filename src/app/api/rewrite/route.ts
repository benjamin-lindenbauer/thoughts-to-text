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
    const { text, prompt } = body;

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

    // Create the full prompt for rewriting
    const fullPrompt = `${prompt}\n\nOriginal text:\n${text}`;

    // Strict JSON schema for the final structured output (always enforced)
    const jsonSchema = {
      name: 'note_rewrite_output',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          originalText: {
            type: 'string',
            description: 'Echo of the provided original text.'
          },
          rewrittenText: {
            type: 'string',
            description: 'The rewritten/improved version of the original text. Plain text only.'
          },
          title: {
            type: 'string',
            description: 'A concise title summarizing the transcript (max 50 characters).',
            maxLength: 50,
          },
          description: {
            type: 'string',
            description: 'A brief description of the transcript (max 150 characters).',
            maxLength: 150,
          },
          keywords: {
            type: 'array',
            description: '3 relevant keywords.',
            items: { type: 'string' },
            minItems: 3,
            maxItems: 3,
          },
        },
        required: ['originalText', 'rewrittenText', 'title', 'description', 'keywords'],
      },
    } as const;

    // Build the Responses API request (always gpt-5 and structured)
    const baseRequest: any = {
      model: 'gpt-5',
      instructions:
        'You are a helpful assistant. Return only valid JSON matching the provided JSON schema. Do not include extra keys or any prose. Use "rewrittenText" for the improved text.',
      input: fullPrompt,
      max_output_tokens: 2000,
      text: {
        format: {
          type: 'json_schema',
          name: jsonSchema.name,
          strict: jsonSchema.strict,
          schema: jsonSchema.schema,
        },
      },
    };

    const response = await openai.responses.create(baseRequest);

    // Parse JSON from Responses API
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

    let parsed: any;
    try {
      parsed = JSON.parse(outputText);
    } catch (e) {
      return NextResponse.json(
        {
          error: 'Failed to parse structured JSON output',
          type: 'server',
          retryable: true,
        },
        { status: 500 }
      );
    }

    // Ensure shape and return exactly the 5 fields
    const result = {
      originalText: String(parsed.originalText ?? text),
      rewrittenText: String(parsed.rewrittenText ?? ''),
      description: String(parsed.description ?? ''),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      title: String(parsed.title ?? ''),
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