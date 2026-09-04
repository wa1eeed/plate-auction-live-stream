type Bucket = { count: number; resetAt: number }

const globalRef = globalThis as typeof globalThis & { __rateBuckets?: Map<string, Bucket> }

function buckets(): Map<string, Bucket> {
  if (!globalRef.__rateBuckets) globalRef.__rateBuckets = new Map()
  return globalRef.__rateBuckets
}

export type RateLimitResult = { allowed: boolean; retryAfterMs: number }

/** نافذة ثابتة بسيطة — كافية لمنع الضغط السريع المتكرر على زر المزايدة. */
export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): RateLimitResult {
  const map = buckets()
  const bucket = map.get(key)

  if (!bucket || bucket.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs })
    if (map.size > 5_000) {
      for (const [k, v] of map) if (v.resetAt <= now) map.delete(k)
    }
    return { allowed: true, retryAfterMs: 0 }
  }
  if (bucket.count >= max) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now }
  }
  bucket.count += 1
  return { allowed: true, retryAfterMs: 0 }
}

export function resetRateLimits(): void {
  globalRef.__rateBuckets = new Map()
}
