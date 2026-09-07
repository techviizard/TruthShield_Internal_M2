import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

export function safeApiError(
  error: unknown,
  context: string,
  status = 500
) {
  const requestId = randomUUID();

  // Keep detailed error information server-side only.
  console.error(`[${context}] requestId=${requestId}`, error);

  return NextResponse.json(
    {
      error: 'An unexpected error occurred while processing your request.',
      requestId,
    },
    { status }
  );
}