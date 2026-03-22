export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const isRetryable =
        error instanceof RetryableError ||
        (error instanceof Error && error.message.includes("fetch failed"));

      if (!isRetryable) throw error;

      const delay =
        error instanceof RetryableError && error.retryAfter
          ? error.retryAfter * 1000
          : baseDelay * Math.pow(2, attempt);

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error("Unreachable");
}

export class RetryableError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter?: number
  ) {
    super(message);
    this.name = "RetryableError";
  }
}

export function checkResponseRetryable(response: Response): void {
  if (response.ok) return;

  if (response.status === 429 || response.status >= 500) {
    const retryAfter = response.headers.get("Retry-After");
    throw new RetryableError(
      `HTTP ${response.status}`,
      response.status,
      retryAfter ? parseInt(retryAfter, 10) : undefined
    );
  }
}
