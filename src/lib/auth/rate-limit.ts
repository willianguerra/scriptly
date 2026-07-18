type RateLimitOptions = {
  maxAttempts: number;
  windowMs: number;
  now?: () => number;
  maxEntries?: number;
};

type AttemptRecord = {
  count: number;
  windowStartedAt: number;
};

export class LoginRateLimiter {
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly options: RateLimitOptions;
  private readonly now: () => number;
  private readonly maxEntries: number;

  constructor(options: RateLimitOptions) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.maxEntries = options.maxEntries ?? 10_000;
  }

  canAttempt(key: string): boolean {
    const record = this.getCurrentRecord(key);
    return !record || record.count < this.options.maxAttempts;
  }

  recordFailure(key: string): void {
    const current = this.getCurrentRecord(key);
    if (current) {
      current.count += 1;
      return;
    }

    if (this.attempts.size >= this.maxEntries) {
      const oldestKey = this.attempts.keys().next().value;
      if (oldestKey) this.attempts.delete(oldestKey);
    }

    this.attempts.set(key, { count: 1, windowStartedAt: this.now() });
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  private getCurrentRecord(key: string): AttemptRecord | undefined {
    const record = this.attempts.get(key);
    if (!record) return undefined;

    if (this.now() - record.windowStartedAt >= this.options.windowMs) {
      this.attempts.delete(key);
      return undefined;
    }

    return record;
  }
}
