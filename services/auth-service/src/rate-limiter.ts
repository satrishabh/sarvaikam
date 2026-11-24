import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';

/** A limit bucket: [key, max attempts per window]. */
export type Rule = [string, number];

export const WINDOW_MS = 15 * 60_000;
const MAX_KEYS = 20_000;
const SWEEP_EVERY_MS = 10 * 60_000;

/** Bucket names hold IP addresses and email digests; only this digest of them is stored. */
const bucketId = (key: string) => createHash('sha256').update(key).digest('hex');

/**
 * Per-process counts. Used while the database is unreachable, and when there is no database (unit tests).
 * Bounded: expired buckets are dropped, and the oldest one is evicted rather than rejecting everyone when full.
 */
export class LocalRateLimiter {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  now = () => Date.now();

  /** Counts one attempt against every rule; false (and nothing counted) when any is already at its limit. */
  hit(rules: Rule[]): boolean {
    const now = this.now();
    for (const [key, item] of this.attempts) if (item.until < now) this.attempts.delete(key);
    const items = [];
    for (const [key, limit] of rules) {
      const item = this.attempts.get(key) ?? { count: 0, until: now + WINDOW_MS };
      if (item.count >= limit) return false;
      items.push([key, item] as const);
    }
    for (const [key, item] of items) {
      item.count++;
      this.attempts.delete(key);
      this.attempts.set(key, item);
      if (this.attempts.size > MAX_KEYS) this.attempts.delete(this.attempts.keys().next().value!);
    }
    return true;
  }
}

// One statement for all of a request's buckets: a bucket past its window starts again at 1.
const COUNT_SQL = `
INSERT INTO auth_rate_limits AS r (key, count, window_ends)
SELECT k, 1, now() + make_interval(secs => $2) FROM unnest($1::varchar[]) AS k
ON CONFLICT (key) DO UPDATE SET
  count = CASE WHEN r.window_ends <= now() THEN 1 ELSE r.count + 1 END,
  window_ends = CASE WHEN r.window_ends <= now() THEN EXCLUDED.window_ends ELSE r.window_ends END
RETURNING key, count`;

/**
 * Attempt limits shared by every auth-service replica, counted in Postgres (auth_rate_limits), so running two
 * replicas does not double what a client may try. Every attempt counts, including rejected ones. If the database
 * call fails, this instance's own counts apply until it is back: degraded, never wide open.
 */
@Injectable()
export class RateLimiter {
  private readonly log = new Logger(RateLimiter.name);
  readonly local = new LocalRateLimiter();
  private nextSweep = 0;
  private warnedAt = 0;

  constructor(@Optional() @InjectDataSource() private readonly db?: DataSource) {}

  async hit(rules: Rule[]): Promise<boolean> {
    if (!rules.length) return true;
    if (!this.db) return this.local.hit(rules);
    // The same bucket twice in one statement is an error in Postgres; keep the stricter limit.
    const limits = new Map<string, number>();
    for (const [key, limit] of rules) {
      const id = bucketId(key);
      limits.set(id, Math.min(limit, limits.get(id) ?? Infinity));
    }
    try {
      const rows: { key: string; count: number }[] = await this.db.query(COUNT_SQL, [[...limits.keys()], WINDOW_MS / 1000]);
      this.sweep();
      return rows.every((row) => Number(row.count) <= (limits.get(row.key) ?? 0));
    } catch (error) {
      const now = Date.now();
      if (now - this.warnedAt > 60_000) {
        this.warnedAt = now;
        this.log.warn(`Shared rate limits unavailable, using this instance's counts: ${(error as Error).message}`);
      }
      return this.local.hit(rules);
    }
  }

  /** Expired buckets are deleted at most every 10 minutes, off the request path. */
  private sweep() {
    const now = Date.now();
    if (now < this.nextSweep) return;
    this.nextSweep = now + SWEEP_EVERY_MS;
    this.db!.query('DELETE FROM auth_rate_limits WHERE window_ends < now()').catch(() => {});
  }
}
