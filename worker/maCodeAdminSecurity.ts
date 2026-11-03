// Uses the existing access object, with independent administrative keys and queue.
// No alarms: expiry and bounded cleanup are driven only by incoming requests.
export const MA_CODE_ADMIN_SECURITY_PATH = '/__internal/ma-code/admin/security'
const PREFIX = 'ma-code-admin-security:'
const CLEANUP_CURSOR = 'ma-code-admin-security-cleanup-cursor-v1'
const WINDOW_MS = 15 * 60_000
const PAUSE_MS = 5 * 60_000
const SESSION_MS = 12 * 60 * 60_000
const CLEANUP_BATCH = 32

export type AdminSecurityOperation =
  | { action: 'login-attempt'; originHash: string; matched: boolean }
  | { action: 'session-status' | 'revoke-session'; sessionHash: string; expiresAt: number }

interface ExpiringRecord { expiresAt: number }
interface AttemptRecord extends ExpiringRecord {
  count: number
  windowStartedAt: number
  blockedUntil: number | null
}

export interface AdminSecurityStorage {
  get<T>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
  delete(key: string | string[]): Promise<unknown>
  list<T>(options: { prefix: string; limit: number; startAfter?: string }): Promise<Map<string, T>>
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'
  } })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isExpiry(value: unknown): value is ExpiringRecord {
  return isRecord(value) && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt)
}

function isHash(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
}

export class MaCodeAdminSecurity {
  private operation: Promise<void> = Promise.resolve()
  private lastCleanupAt = 0

  constructor(private readonly storage: AdminSecurityStorage) {}

  fetch(request: Request): Promise<Response> {
    const response = this.operation.then(async () => {
      try { return await this.handle(request) }
      catch { return json({ unavailable: true }, 503) }
    })
    // A failed request must not poison later logins or logout retries.
    this.operation = response.then(() => undefined, () => undefined)
    return response
  }

  private async handle(request: Request) {
    if (request.method !== 'POST') return json({ allowed: false }, 405)
    const text = await request.text()
    if (text.length > 1000) return json({ allowed: false }, 400)
    const input: unknown = JSON.parse(text)
    if (!isRecord(input)) return json({ allowed: false }, 400)
    const now = Date.now()

    if (input.action === 'login-attempt') {
      if (!isHash(input.originHash) || typeof input.matched !== 'boolean') return json({ allowed: false }, 400)
      const key = `${PREFIX}attempt:${input.originHash}`
      const stored = await this.storage.get<AttemptRecord>(key)
      if (stored !== undefined && (!isExpiry(stored) || !Number.isInteger(stored.count) ||
        stored.count < 1 || stored.count > 5 || !Number.isFinite(stored.windowStartedAt) ||
        (stored.blockedUntil !== null && !Number.isFinite(stored.blockedUntil)))) throw new Error('Invalid state')

      if (stored?.blockedUntil && stored.blockedUntil > now) {
        // Absolutely no writes while paused, including cleanup or timestamp updates.
        return json({ allowed: false, retryAfter: Math.max(1, Math.ceil((stored.blockedUntil - now) / 1000)) })
      }

      if (input.matched) {
        if (stored !== undefined) await this.storage.delete(key)
      } else {
        // Expiring a pause also resets its failures, even inside the original window.
        const previous = stored && stored.expiresAt > now ? stored : undefined
        const count = (previous?.count ?? 0) + 1
        const windowStartedAt = previous?.windowStartedAt ?? now
        const blockedUntil = count >= 5 ? now + PAUSE_MS : null
        await this.storage.put(key, { count, windowStartedAt, blockedUntil,
          expiresAt: blockedUntil ?? windowStartedAt + WINDOW_MS } satisfies AttemptRecord)
      }
      await this.cleanup(now)
      return json({ allowed: true })
    }

    if (input.action === 'session-status' || input.action === 'revoke-session') {
      if (!isHash(input.sessionHash) || typeof input.expiresAt !== 'number' ||
        !Number.isFinite(input.expiresAt) || input.expiresAt > now + SESSION_MS + 60_000) return json({ allowed: false }, 400)
      const key = `${PREFIX}revoked:${input.sessionHash}`
      const stored = await this.storage.get<ExpiringRecord>(key)
      if (stored !== undefined && !isExpiry(stored)) throw new Error('Invalid state')
      if (input.action === 'revoke-session') {
        // Confirm logout only after the revocation is durable. Never evict a live one.
        if (input.expiresAt > now && (!stored || stored.expiresAt < input.expiresAt)) {
          await this.storage.put(key, { expiresAt: input.expiresAt })
        }
        await this.cleanup(now)
        return json({ allowed: true })
      }
      const allowed = !stored || stored.expiresAt <= now
      await this.cleanup(now)
      return json({ allowed })
    }
    return json({ allowed: false }, 404)
  }

  private async cleanup(now: number) {
    if (now - this.lastCleanupAt < 60_000) return
    this.lastCleanupAt = now
    try {
      const cursor = await this.storage.get<string>(CLEANUP_CURSOR)
      const entries = await this.storage.list<ExpiringRecord>({ prefix: PREFIX, limit: CLEANUP_BATCH,
        ...(typeof cursor === 'string' && cursor.startsWith(PREFIX) ? { startAfter: cursor } : {}) })
      const expired = [...entries].filter(([, value]) => isExpiry(value) && value.expiresAt <= now).map(([key]) => key)
      if (expired.length) await this.storage.delete(expired)
      if (entries.size === CLEANUP_BATCH) {
        await this.storage.put(CLEANUP_CURSOR, [...entries.keys()].at(-1))
      } else if (cursor !== undefined) {
        await this.storage.delete(CLEANUP_CURSOR)
      }
    } catch {
      // Cleanup failure never undoes a committed revocation or removes live records.
    }
  }
}
