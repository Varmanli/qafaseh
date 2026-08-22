/**
 * Global rate limiter and request delay manager for external book source HTTP requests (IranKetab, etc.).
 *
 * Requirements:
 * 1. Sequential execution (concurrency limit = 1).
 * 2. Mandatory delay of 2500ms (between 2000ms-3000ms) between consecutive HTTP requests
 *    to prevent flooding external servers.
 */

const DEFAULT_DELAY_MS = Number(process.env.EXTERNAL_REQUEST_DELAY_MS ?? 2500);

export class ExternalRequestThrottler {
  private queue: Promise<void> = Promise.resolve();
  private lastRequestTime = 0;
  private delayMs: number;

  constructor(delayMs = DEFAULT_DELAY_MS) {
    this.delayMs = delayMs;
  }

  /**
   * Schedule an async operation that fetches data from an external server.
   * Ensures serial execution (1 at a time) with at least `delayMs` elapsed
   * between the start of consecutive requests.
   */
  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    const resultPromise = this.queue.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      const waitTime = Math.max(0, this.delayMs - elapsed);

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      this.lastRequestTime = Date.now();
      return fn();
    });

    // Keep queue chain alive even if a request fails, so subsequent requests can run.
    this.queue = resultPromise.then(
      () => {},
      () => {}
    );

    return resultPromise;
  }
}

export const externalRequestThrottler = new ExternalRequestThrottler(DEFAULT_DELAY_MS);

/**
 * Wraps an external fetch call to ensure it obeys rate limiting and sequential 2500ms delays.
 */
export async function throttleExternalRequest<T>(fn: () => Promise<T>): Promise<T> {
  return externalRequestThrottler.schedule(fn);
}
