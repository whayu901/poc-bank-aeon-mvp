# AEON Bank Interview — Thundering Herd & Token Refresh

### "1000 Users, 1000 401s, One Refresh Endpoint" — Full 20-Minute Script

---

## ⏱️ Timing Overview

| Section                                               | Time        |
| ----------------------------------------------------- | ----------- |
| Reframe: What is actually happening                   | ~60 sec     |
| The naive solution and why it breaks                  | ~90 sec     |
| Client-side fix: Single refresh promise               | ~3 min      |
| Code walkthrough: The interceptor                     | ~3 min      |
| Terminal failure: What if refresh returns 401         | ~2 min      |
| Edge case 1: Network drops mid-refresh                | ~90 sec     |
| Edge case 2: App goes to background mid-refresh       | ~90 sec     |
| Edge case 3: Clock skew — token looks valid but isn't | ~60 sec     |
| Backend side: What I'd ask the backend team to do     | ~2 min      |
| Security layer: Refresh token rotation                | ~2 min      |
| Testing this                                          | ~90 sec     |
| Trade-offs I'd name proactively                       | ~60 sec     |
| **Total**                                             | **~20 min** |

---

## 🎙️ The Script

---

### OPENING — Reframe the Problem _(~60 sec)_

"Before I talk about the fix, let me make sure I understand what's actually happening — because there are two problems here, not one."

"Problem one is on the client side: a thousand users each have multiple in-flight API requests. Each of those requests gets a 401. Without a smart interceptor, each client fires its own refresh call. So instead of 1,000 users sending 1 refresh request each, you might get 5,000 to 10,000 refresh requests hitting the backend in seconds — because each user had multiple in-flight requests."

"Problem two is on the backend side: even if each client is well-behaved and sends only one refresh call, you still have 1,000 simultaneous refresh calls hitting the token endpoint at 9 AM. That's a spike that can take down the auth service if it's not prepared."

"So the full solution has two layers — client-side concurrency control, and backend resilience. I'll walk through both."

---

### THE NAIVE SOLUTION AND WHY IT BREAKS _(~90 sec)_

"The naive approach is: intercept every 401, call the refresh endpoint, get a new token, retry the original request."

"Here's why this breaks badly in production."

"Imagine one user has five in-flight requests when their token expires. All five get 401 simultaneously. All five hit the interceptor. All five check 'do I have a valid token?' — and at that exact moment, they all see the same expired token. So all five fire a refresh call in parallel."

"Now the backend gets five refresh requests for the same user, all using the same refresh token."

"On a good day, the first one succeeds and the other four fail — because the token was already rotated. Now you have four requests that got an error from the refresh endpoint, but the user's session is actually still valid. You've logged them out for no reason."

"On a bad day — if the backend doesn't have rotation — all five succeed and you now have five different access tokens for the same user floating around. That's a security problem."

"And scale this to 1,000 users, each with five in-flight requests — you've just sent 5,000 refresh calls to your auth service instead of 1,000."

---

### CLIENT-SIDE FIX — Single Refresh Promise _(~3 min)_

"The fix is elegant. The key insight is: on a single client, there should only ever be one refresh call in-flight at a time. Every other request that gets a 401 should wait for that one refresh to complete, then retry with the new token."

"I implement this with a single shared variable — I call it `refreshPromise` — stored at the module level in my API client. Not in a React component, not in a hook. At the module level, so it persists across renders."

"Here's the logic step by step:"

"**Step 1 — First 401 arrives.**"
"The interceptor checks: is `refreshPromise` null? Yes. So it fires the refresh call and assigns the promise to `refreshPromise`. Then it awaits that promise."

"**Step 2 — Second, third, fourth 401 arrive (milliseconds later).**"
"The interceptor checks: is `refreshPromise` null? No — it already exists. So instead of firing another refresh call, each of these requests just awaits the _same_ `refreshPromise` that's already in-flight."

"**Step 3 — Refresh resolves.**"
"The promise resolves with the new access token. All five waiters — the original and the four who were waiting — receive the new token simultaneously. Each of them retries their original request with the new token."

"**Step 4 — Cleanup.**"
"After the promise resolves or rejects, I set `refreshPromise` back to null. This is critical. If I don't clear it, the next wave of 401s — maybe an hour later — will try to await a promise that already resolved, which is fine in JavaScript but semantically wrong. Clearing it means the next 401 properly fires a fresh refresh."

"Net result: no matter how many requests are in-flight on one client, only one refresh call is ever fired. The backend sees 1,000 refresh calls, not 5,000 or 10,000."

---

### CODE WALKTHROUGH — The Interceptor _(~3 min)_

"Let me walk through the actual structure in pseudocode — clean enough to reason about, not getting lost in syntax."

```
// Module level — persists across renders
let refreshPromise: Promise<string> | null = null;

// Axios response interceptor
apiClient.interceptors.response.use(
  (response) => response,  // 2xx — pass through

  async (error) => {
    const originalRequest = error.config;

    // Only handle 401, and only once per request
    if (error.response?.status !== 401) throw error;
    if (originalRequest._retry) throw error;  // prevent infinite loop
    originalRequest._retry = true;

    try {
      // If no refresh is in-flight, start one
      if (!refreshPromise) {
        refreshPromise = callRefreshEndpoint()
          .finally(() => {
            refreshPromise = null;  // always clean up
          });
      }

      // All 401s — including the first — await the same promise
      const newAccessToken = await refreshPromise;

      // Update the in-memory token store
      tokenStore.setAccessToken(newAccessToken);

      // Retry the original request with the new token
      originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);

    } catch (refreshError) {
      // Refresh failed — terminal. Force logout.
      await handleTerminalAuthFailure();
      throw refreshError;
    }
  }
);
```

"A few things worth calling out:"

"The `_retry` flag on the original request is important. Without it, if the retried request _also_ gets a 401 for some reason, the interceptor would intercept it again and we'd have an infinite loop. The flag prevents that."

"The `.finally()` on the refresh call is what clears `refreshPromise` back to null — whether the refresh succeeds or fails. This is cleaner than doing it in both the `.then()` and the `.catch()` separately."

"I also update the in-memory token store immediately so that any new requests fired after this moment get the new token from the start — they don't need to go through a 401 cycle at all."

---

### TERMINAL FAILURE — What if Refresh Returns 401 _(~2 min)_

"Now the most important edge case: what if the refresh call itself returns a 401?"

"This means the refresh token is genuinely expired, revoked, or blacklisted. This is a terminal failure — there is no recovery from the client side. You cannot retry. You cannot refresh again."

"If I retry here, I create an infinite loop: 401 → try refresh → 401 → try refresh → forever. The app hangs, the user is stuck, and the backend gets hammered."

"So the rule is: if refresh returns 401, it's over. No retry."

"Here's exactly what `handleTerminalAuthFailure` does:"

"**One:** Reject the `refreshPromise`. Every request that was awaiting it receives the rejection immediately. They all fail cleanly — no retry, no hanging."

"**Two:** Clear the in-memory access token. Set it to null."

"**Three:** Delete the refresh token from secure storage — Keychain on iOS, Keystore-backed storage on Android. Wipe it completely."

"**Four:** Clear any sensitive app state — transaction cache, user profile, balance data. Everything that belongs to this session."

"**Five:** Navigate the user to the login screen. Immediately."

"**Six:** Set `refreshPromise` to null. So the next request after login fires a clean refresh cycle if needed — not an attempt to await a dead promise."

"I also show the user a clear message: 'Your session has expired. Please log in again.' Not just a silent redirect. Users deserve to know why they're on the login screen — especially in a banking app where unexplained behaviour erodes trust."

---

### EDGE CASE 1 — Network Drops Mid-Refresh _(~90 sec)_

"What if the user is on a weak connection and the network drops while the refresh call is in-flight?"

"The refresh promise will reject — but with a network error, not a 401. I need to handle this differently from a terminal auth failure."

"A network error is transient. The user's refresh token is still valid — we just couldn't reach the server."

"So in this case, I do NOT log the user out. Instead I:"

"**One:** Reject the `refreshPromise` with the network error."

"**Two:** Clear `refreshPromise` to null."

"**Three:** Let all the waiting requests fail with a network error."

"**Four:** Show the user a 'No connection — please check your internet' banner."

"**Five:** When the connection is restored — I can detect this with NetInfo — I retry the original requests automatically. This time they'll hit the interceptor, see no `refreshPromise` in-flight, fire a fresh refresh, and succeed."

"The key distinction is: **401 from refresh endpoint = terminal, force logout. Network error from refresh call = transient, retry on reconnect.** I handle them separately in the catch block."

---

### EDGE CASE 2 — App Goes to Background Mid-Refresh _(~90 sec)_

"What if the user locks their phone or switches apps while the refresh is in-flight?"

"On iOS, the app gets about 3 seconds of background time before the OS suspends it. On Android, it depends on the OEM, but generally similar."

"If the refresh completes before suspension — great, new token is stored, everything resumes normally when the app comes back."

"If the app is suspended mid-refresh — the network call is killed. The promise never resolves or rejects. It just hangs."

"When the app comes back to the foreground, `refreshPromise` is still set to the old, dead promise. Any new requests will await it forever."

"My fix: I listen to the AppState API. When the app transitions from background to active, I check if `refreshPromise` is still set. If it is — meaning a refresh was in-flight when the app was suspended — I clear it to null and trigger a fresh token check."

"I also check the access token's expiry on foreground resume. If it's expired, I proactively refresh before the user takes any action. This prevents the user from tapping a button, waiting for a 401, waiting for a refresh, then seeing their result — I eliminate that delay entirely."

---

### EDGE CASE 3 — Clock Skew _(~60 sec)_

"One more edge case worth flagging: clock skew between the user's device and the server."

"Access tokens typically have an expiry timestamp encoded in the JWT payload — the `exp` claim. I can decode this on the client and proactively refresh before the token actually expires."

"But here's the trap: if the user's device clock is wrong — say it's 5 minutes ahead — the client thinks the token is expired when the server still considers it valid. So I fire a refresh unnecessarily. Or the reverse: the device clock is behind, the client thinks the token is valid, but the server rejects it with a 401."

"The fix is two things. First, I add a buffer when checking expiry on the client — I treat the token as 'about to expire' if it has less than 60 seconds left, and refresh proactively. This handles small clock differences."

"Second, I don't fully trust the client clock for security decisions. The server is the source of truth on token validity. So I always handle 401s gracefully regardless of what the client clock says."

---

### BACKEND SIDE — What I'd Ask the Backend Team _(~2 min)_

"Even with a perfect client-side implementation, 1,000 simultaneous refresh calls at 9 AM is still a real backend load spike. So I'd have a conversation with the backend team about a few things."

"**Refresh token rotation.**"
"Every time a refresh token is used, the backend issues a brand new refresh token and invalidates the old one. This prevents replay attacks — if someone intercepts a refresh token, they can only use it once before it's worthless."

"**Rate limiting on the refresh endpoint.**"
"Limit refresh calls per user per time window — for example, max 5 refresh calls per user per minute. If a client is somehow firing more than that, something is wrong — either a bug or an attack. Reject excess calls with a 429 and a Retry-After header."

"**Redis-backed token store.**"
"Don't store refresh tokens in a relational database if you can avoid it. At 1,000 simultaneous refresh calls, the database becomes a bottleneck. A Redis store can handle this volume with sub-millisecond reads and writes."

"**Staggered token expiry.**"
"If all 500,000 users' refresh tokens expire at the exact same time — say, exactly 7 days after a mass onboarding event — you get a thundering herd at the server level too. I'd recommend the backend adds a small random jitter to token expiry — plus or minus 30 minutes — so expirations are spread across time, not clustered."

"**Monitoring on the refresh endpoint.**"
"Alert on sudden spikes in refresh call volume. A spike might mean a client bug that's firing refreshes too aggressively. Better to catch it in staging than at 9 AM on a Monday."

---

### SECURITY LAYER — Refresh Token Rotation _(~2 min)_

"Let me go deeper on token rotation because it's particularly important for a banking app."

"Here's the security problem without rotation: if an attacker somehow intercepts a refresh token — through a compromised device, a man-in-the-middle attack, or malware — they can use that token indefinitely until it expires. Refresh tokens are typically long-lived — 7 to 14 days. That's a 7-to-14-day window for the attacker to drain the account."

"With rotation, every refresh call returns a new refresh token and invalidates the old one. So even if an attacker intercepts a refresh token, they have at most one use of it. The moment the legitimate client refreshes — which it will, on the next 401 — the old token is invalidated, and the attacker's copy is worthless."

"There's a subtle implementation detail here: **reuse detection.** If the backend sees an old, already-invalidated refresh token being used — it means either there's a bug on the client, or an attacker is replaying a stolen token. In either case, the correct response is to invalidate the _entire_ token family for that user and force a full logout. This is sometimes called 'token family invalidation' or 'refresh token reuse detection.'"

"On the client side, I pair this with: short access token lifetime — 15 minutes maximum. Long refresh token lifetime — 7 days. Refresh token in secure storage only. Access token in memory only, never persisted. Biometric re-authentication required before any high-risk action like transfer or PIN change — even if the session is valid."

---

### TESTING THIS _(~90 sec)_

"A feature this critical needs to be tested at multiple levels."

"**Unit tests for the interceptor logic.**"
"I mock the API client and simulate concurrent 401 responses. I verify that no matter how many simultaneous 401s fire, only one refresh call is made. I verify all requests retry with the new token. I verify terminal failure triggers logout. I verify network error does not trigger logout."

"**Integration tests.**"
"I test the full auth flow with a mock backend — login, get tokens, make requests, simulate token expiry, verify refresh, verify retry. I use MSW — Mock Service Worker — or a local mock server."

"**E2E with Detox.**"
"I write a Detox test that logs in, waits for the token to expire (or forces expiry by manually setting the stored token to an expired one), then performs a transaction action. I verify the user sees their result — not a login screen — meaning the silent refresh worked correctly."

"**Load testing.**"
"I simulate 1,000 concurrent clients all sending 401s at the same time and verify the backend refresh endpoint receives exactly 1,000 calls — one per client — not 5,000. This confirms the client-side concurrency control is working."

---

### TRADE-OFFS I'D NAME PROACTIVELY _(~60 sec)_

"A few trade-offs worth flagging to the team:"

"**Single refresh promise: simplicity vs. multi-account.**"
"This pattern assumes one user session per app instance. If the app ever supports multiple accounts — switching between personal and business — you need a `refreshPromise` per account, keyed by user ID. Worth designing for from the start."

"**Proactive refresh vs. reactive refresh.**"
"I can proactively refresh the access token 60 seconds before expiry, using a timer. This eliminates the 401 cycle entirely. But it means more frequent background refreshes. The trade-off is user experience (no delay on actions) vs. battery and network usage. For a banking app, I'd lean toward proactive — user trust is more important than a few extra refresh calls."

"**Token rotation vs. stateless JWTs.**"
"Rotation requires the backend to store state — which tokens are valid, which are invalidated. Stateless JWTs don't require storage, but they can't be revoked before expiry. For a banking app, revocability is non-negotiable. I'd always choose stateful refresh tokens with rotation over pure stateless JWTs."

---

## 🆘 Safety Net — If You Blank

These 7 sentences will carry you:

1. _"Two problems: client-side concurrency and backend load spike. I solve both."_
2. _"I keep one `refreshPromise` at the module level. First 401 fires it. All other 401s await the same promise."_
3. _"Once resolved, all waiting requests retry with the new token. Then I clear the promise to null."_
4. _"If refresh returns 401 — terminal failure. Reject all waiters, clear tokens, force logout."_
5. _"Network error during refresh is different — transient. Don't log out. Retry on reconnect."_
6. _"I ask the backend for rotation, rate limiting, Redis token store, and jitter on expiry."_
7. _"I test this with unit tests for the interceptor, Detox for E2E, and load tests to verify one refresh per client."_

---

## 🧠 Structure to Remember

> **Diagnose both layers (client + backend) → Client fix (single promise) → Code walkthrough → Terminal failure → Edge cases → Backend asks → Security (rotation) → Testing → Trade-offs**

---

## ⚠️ Senior Signals to Drop Naturally

- _"There are actually two problems here — client concurrency and backend load. Let me separate them."_
- _"A network error and a refresh 401 are different failure modes. I handle them differently."_
- _"I'd also talk to the backend team about jitter on token expiry — so we don't get a thundering herd at the server level too."_
- _"Token rotation plus reuse detection means even a stolen refresh token is only useful once."_
- _"This is test-critical. I'd write a load test to verify the client sends exactly one refresh per client, not five."_

---

## ❌ Common Mistakes to Avoid

- Don't forget to clear `refreshPromise` to null after resolve/reject
- Don't treat network error the same as refresh 401 — one is transient, one is terminal
- Don't forget the `_retry` flag — without it you risk an infinite retry loop
- Don't skip the backend conversation — client-side alone doesn't fully solve the problem
- Don't forget token rotation — stateless JWTs with no revocation are not acceptable for banking
- Never log the user out on a transient network failure — that destroys trust
