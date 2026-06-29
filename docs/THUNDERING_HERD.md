# Thundering Herd: Token Refresh at Scale

> **Scenario.** It's 9 AM in Malaysia. A thousand users open the app at the same
> time. Most were force-closed overnight, so their access tokens are expired.
> They all tap a transaction at once → every request gets a `401` → a thousand
> refresh requests hit `/auth/refresh` in the same instant. The endpoint melts.

This document explains how the app survives that morning, file by file.

---

## 1. There are actually *two* thundering herds

The single most important insight: "thundering herd" is two different problems
that need two different fixes. Confusing them is why naive solutions fail.

| | **Intra-device herd** | **Inter-device herd** (the 9 AM spike) |
|---|---|---|
| **Cause** | One phone fires several requests at once (transaction list + balance + profile), each gets a `401` | A thousand *different* phones each legitimately need *one* refresh, all in the same instant |
| **Scale** | N requests, 1 device | 1 request each, N devices |
| **Fix** | De-duplicate: only one refresh per device | Spread the load: don't all hit at once |
| **Mechanism** | Single in-flight promise | Jitter + exponential backoff |

A per-device lock does **nothing** for the inter-device herd — 1,000 devices
that each need exactly one refresh still produce 1,000 calls. And jitter does
nothing for the intra-device herd — one device firing 3 requests would still
refresh 3 times. **You need both.**

---

## 2. Herd #1 — Intra-device (already solved)

When one device fires several authenticated requests and they all `401` at once,
only **one** of them should refresh; the rest wait for that result.

**File:** `src/services/TokenManager.ts`

```ts
private async refreshTokenWithSingleInflight(): Promise<boolean> {
  // If a refresh is already running, attach to it instead of starting another.
  if (this.refreshPromise) {
    return this.refreshPromise;
  }

  this.refreshPromise = this.performTokenRefresh();
  try {
    return await this.refreshPromise;
  } finally {
    this.refreshPromise = null; // Clear so the next 401 can refresh again.
  }
}
```

Because JavaScript is single-threaded, the `if (this.refreshPromise)` check and
the assignment that follows it run atomically — there is no `await` between them,
so two concurrent 401s cannot both pass the check. The first one creates the
promise; every other one returns the *same* promise. One network call, one token
rotation, everyone gets the new token.

```
401 ─┐
401 ─┼─► refreshTokenWithSingleInflight ─► ONE /auth/refresh ─► new token ─► all retry
401 ─┘
```

This was already in the codebase. It is correct and we kept it.

---

## 3. Herd #2 — Inter-device (the fix we added)

Per-device dedup can't help here. 1,000 devices, each with one expired token,
each correctly making one refresh call — all at `09:00:00.000`. If the endpoint
can only handle, say, 300 concurrent refreshes, the other 700 get
`429 / 503 / timeout`. Worse: a naive client **immediately retries**, reforming
the herd into a tighter, angrier one. This is the retry storm that turns a
momentary spike into an outage.

The fix is **client-side load-spreading**, all inside
`TokenManager.performTokenRefresh`.

### 3a. Startup jitter — desynchronize the spike

The root cause is that everyone fires at the *same* millisecond. So before the
first refresh, each device waits a *random* short delay:

```ts
// Smear a synchronized fleet-wide spike across a window instead of one instant.
await this.sleep(this.randomBetween(0, this.refreshInitialJitterMs)); // 0–4000ms
```

A wall of 1,000 simultaneous calls becomes a ramp spread over ~4 seconds (~250
calls/sec instead of 1,000-at-once). This delay is essentially free: concurrent
401s on the same device are already parked on the shared `refreshPromise`, so the
user waits once, not once per request.

### 3b. Exponential backoff + **full jitter** — survive the overload

If a refresh still fails because the endpoint is shedding load, we retry — but
with growing, randomized gaps:

```ts
private computeBackoffDelay(attempt: number, error: unknown): number {
  // If the server told us when to come back, obey it (+ a little jitter).
  if (isAppError(error) && typeof error.retryAfterMs === 'number') {
    return error.retryAfterMs + this.randomBetween(0, this.refreshBackoffBaseMs);
  }
  // Otherwise: full jitter over an exponentially growing window.
  const cap = Math.min(this.refreshBackoffMaxMs, this.refreshBackoffBaseMs * 2 ** attempt);
  return this.randomBetween(0, cap); // random(0, cap), NOT a fixed delay
}
```

**Why _full_ jitter and not plain exponential backoff?** If every client backed
off by the *same* computed amount (`500ms`, then `1000ms`, then `2000ms`…), they'd
retry in lockstep — the herd would just reconvene one second later. Randomizing
across `[0, cap)` is what actually breaks up the synchronization. This is the
[AWS "Exponential Backoff and Jitter"](https://aws.amazon.com/builds/this-is-my-architecture/)
result.

Backoff windows: `0–500ms` → `0–1000ms` → `0–2000ms` → … capped at `20s`.

### 3c. Honor `Retry-After`

When the server explicitly says "come back in N seconds" via a `Retry-After`
header, that's authoritative — we use it instead of guessing.

- `src/api/ApiClient.ts` parses the header into `AppError.retryAfterMs`.
- `src/models/AppError.ts` adds the `retryAfterMs` field and a `parseRetryAfter()`
  helper (handles both `Retry-After: 120` and the HTTP-date form).

### 3d. A `401` on refresh is **not** retryable

If `/auth/refresh` itself returns `401`/`403`, the refresh token is genuinely
dead. Retrying cannot help and only adds load — so we fail fast and log out:

```ts
if (isAppError(error) &&
    (error.type === ErrorType.UNAUTHORIZED || error.type === ErrorType.FORBIDDEN)) {
  return false; // → handleRefreshFailure() → logout. No retry.
}
```

Only transient failures (`429`, `5xx`, timeout, network) are retried — see
`isRetryableRefreshError()`.

### Putting it together — one device's refresh

```
401 ─► single in-flight lock (Herd #1)
        └─► performTokenRefresh:
              1. sleep(random 0–4000ms)          ← jitter (Herd #2a)
              2. POST /auth/refresh
                   ├─ 200 → rotate token → done
                   ├─ 401/403 → logout (no retry)        (3d)
                   └─ 429/5xx/timeout/network → retryable (3b)
                        └─ sleep(backoff + jitter, honoring Retry-After)
                        └─ retry (up to maxRefreshAttempts = 4)
```

---

## 4. Simulating the overload (`MockBackend`)

To prove the defense works end-to-end, the mock backend can *be* the overloaded
endpoint. It models a server with **finite concurrency**.

**File:** `src/api/MockBackend.ts`

```ts
// Only `refreshCapacity` refreshes may process at once; each holds its slot
// for `refreshProcessingMs`. Overflow is shed BEFORE any token work.
if (this.refreshOverloadEnabled && this.inflightRefreshCount >= this.refreshCapacity) {
  this.refreshRejectionCount++;
  return new Response(JSON.stringify({ error: 'Too many requests. Please retry shortly.' }), {
    status: 429,
    headers: { 'Retry-After': String(this.refreshRetryAfterSeconds), /* ... */ },
  });
}
```

Key correctness property: **the overload guard runs before the token is
consumed.** A shed request leaves the single-use refresh token untouched, so the
client's backed-off retry can still use it. (If we'd invalidated first, every
`429` would orphan a user.)

### Knobs (`configure({ ... })`, all off by default)

| Option | Meaning |
|---|---|
| `refreshOverloadEnabled` | Turn the simulation on |
| `refreshCapacity` | Max concurrent refreshes the "server" accepts |
| `refreshProcessingMs` | How long each refresh holds a slot |
| `refreshRetryAfterSeconds` | Value advertised in the `Retry-After` header |

### Telemetry — `getRefreshOverloadStats()`

```ts
{ rejectionCount, peakInflight, inflight }
```

`peakInflight` should never exceed `refreshCapacity` — proof the server never
processed more than it could handle.

---

## 5. How it all connects

`MockBackend` overrides `global.fetch`
(`src/repositories/ApiTransactionRepository.ts`), so a real refresh call flows
through it. The full round trip:

```
TokenManager.performTokenRefresh
  │  (jitter applied)
  ▼
ApiClient.post('/auth/refresh')  ──fetch──►  MockBackend.handleRefresh
                                                  │  capacity exceeded?
                                                  ▼
                                             429 + Retry-After: 2
  ┌───────────────────────────────────────────────┘
  ▼
ApiClient parses Retry-After → AppError.retryAfterMs
  ▼
TokenManager.computeBackoffDelay honors it → sleep → retry
  ▼
(slot freed by now) → 200 → rotate token → original request retried
```

---

## 6. Try it yourself

Enable the overload after login and fire concurrent requests:

```ts
repository.configureMockBackend({
  refreshOverloadEnabled: true,
  refreshCapacity: 3,
  refreshProcessingMs: 800,
  refreshRetryAfterSeconds: 2,
});
```

Watch the logs:

```
[MockBackend] Refresh overloaded: 3 in flight >= capacity 3. Shedding with 429
[TokenManager] Refresh attempt 1 failed (CLIENT_ERROR 429), backing off 1873ms before retry
[TokenManager] Token refresh and rotation successful
```

### Automated proof

`src/api/__tests__/MockBackend.test.ts` → **`thundering-herd overload`**:

1. **Sheds excess** — 10 simultaneous refreshes, capacity 3 → some `200`, rest
   `429`, `peakInflight ≤ 3`, `Retry-After` header present.
2. **Shed token stays valid** — a device that got `429` retries after the slot
   frees and succeeds (token never wrongly consumed).
3. **Off by default** — 8 concurrent refreshes all `200`, zero rejections.

```bash
npx jest src/api/__tests__/MockBackend.test.ts
```

---

## 7. Tuning & the server-side complement

**Client knobs** (`TokenManager.ts`):

| Field | Default | Trade-off |
|---|---|---|
| `refreshInitialJitterMs` | `4000` | Higher = flatter spike, but slower worst-case login |
| `maxRefreshAttempts` | `4` | Higher = more resilient, more total load if server is down |
| `refreshBackoffBaseMs` | `500` | Starting backoff window |
| `refreshBackoffMaxMs` | `20000` | Ceiling on any single backoff |

**Set these against real backend capacity.** Jitter window should be roughly
`fleet_size / endpoint_capacity_per_second`.

**The proper server-side complement** (not in this client, but worth stating):
make `/auth/refresh` **idempotent within a short grace window** — a just-rotated
refresh token should still work for a few seconds. Otherwise a legitimate retry
after a network blip looks like a replay attack and forces a needless logout.
Client jitter/backoff and server grace-window idempotency together make refresh
robust under load.

---

## File map

| File | Change |
|---|---|
| `src/services/TokenManager.ts` | Jitter, exponential backoff + full jitter, `Retry-After` handling, fail-fast on auth errors |
| `src/models/AppError.ts` | `retryAfterMs` field + `parseRetryAfter()` |
| `src/api/ApiClient.ts` | Parse `Retry-After` header into the error |
| `src/api/MockBackend.ts` | Finite-concurrency overload simulation + telemetry |
| `src/repositories/ApiTransactionRepository.ts` | Expose overload knobs |
| `src/api/__tests__/MockBackend.test.ts` | Overload test suite |
