import { ApiClient } from '@/api/ApiClient';
import { SecureStorageService } from './SecureStorageService';
import { AppError, ErrorType, isAppError } from '@/models/AppError';
import { useAuthStore } from '@/store/authStore';

/**
 * Token refresh response
 */
interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Token Manager Service
 *
 * Handles advanced token management scenarios:
 * - Automatic token refresh on 401
 * - Refresh token rotation (single-use refresh tokens)
 * - Single in-flight refresh (prevents per-device thundering herd)
 * - Jitter + exponential backoff (prevents fleet-wide thundering herd)
 * - Retry original request after refresh
 * - Force logout on refresh failure
 *
 * Thundering herd defense (two distinct problems):
 *
 *   1. INTRA-DEVICE herd — one device fires many requests at once (transaction
 *      list + balance + profile), each gets a 401. Solved by the single
 *      in-flight `refreshPromise`: only ONE refresh leaves the device.
 *
 *   2. INTER-DEVICE herd — the "9 AM in Malaysia" spike. A thousand DIFFERENT
 *      devices each legitimately need one refresh and all fire it in the same
 *      instant. Per-device dedup cannot help (1 device = 1 refresh). If they
 *      all hit at once the endpoint falls over, returns 429/503/timeouts, and
 *      every client instantly retries — a second, worse herd. Solved by:
 *        - startup JITTER: each device waits a random delay before refreshing,
 *          smearing the synchronized spike across a window.
 *        - exponential BACKOFF + full jitter on retryable failures, so a
 *          shed-load response makes clients back off instead of re-hammering.
 *        - honoring the server's `Retry-After` header.
 *
 * Security principles:
 * - Refresh tokens are single-use (rotation prevents replay attacks)
 * - Only one refresh request at a time (prevents race conditions)
 * - A 401 on the refresh call itself is NOT retried — the token is genuinely
 *   dead, so we fail fast and log out (security over convenience).
 */
export class TokenManager {
  private static instance: TokenManager;
  private apiClient: ApiClient;
  private secureStorage: SecureStorageService;
  private refreshPromise: Promise<boolean> | null = null;
  private isRefreshing = false;
  private maxRetries = 1; // Only retry the ORIGINAL request once after refresh
  private refreshEndpoint = '/auth/refresh';

  // --- Inter-device thundering herd tuning ---------------------------------
  // Max random delay applied BEFORE the first refresh attempt. Spreads a
  // synchronized fleet-wide spike (e.g. 1000 devices at 9 AM) across this
  // window. Tune against backend capacity vs. acceptable login latency.
  private refreshInitialJitterMs = 4000;
  // Max attempts for the refresh CALL itself (initial + backoff retries).
  private maxRefreshAttempts = 4;
  // Exponential backoff base and ceiling for retryable refresh failures.
  private refreshBackoffBaseMs = 500;
  private refreshBackoffMaxMs = 20000;

  private constructor() {
    this.apiClient = ApiClient.getInstance();
    this.secureStorage = SecureStorageService.getInstance();

    // Setup interceptors
    this.setupResponseInterceptor();
  }

  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Initialize token manager
   * Should be called after ApiClient is initialized
   */
  public initialize(): void {
    console.log('[TokenManager] Initialized with 401 interceptor');
  }

  /**
   * Setup response interceptor for 401 handling
   */
  private setupResponseInterceptor(): void {
    this.apiClient.addErrorInterceptor(async (error: AppError) => {
      // Only handle 401 errors
      if (error.type !== ErrorType.UNAUTHORIZED || error.statusCode !== 401) {
        return error;
      }

      console.log('[TokenManager] Received 401, attempting token refresh...');

      // Check if we should attempt refresh
      const shouldRefresh = await this.shouldAttemptRefresh();
      if (!shouldRefresh) {
        console.log('[TokenManager] Skipping refresh (no refresh token or already refreshing)');
        return error;
      }

      // Attempt refresh (single in-flight mechanism)
      const refreshSuccess = await this.refreshTokenWithSingleInflight();

      if (refreshSuccess) {
        console.log('[TokenManager] Token refresh successful, retrying original request');

        // Retry the original request with new token
        // Note: The original request config is not available in error interceptor
        // In a production app, you'd store and retry the original request
        // For now, we'll return a special error that signals retry is needed
        const retryError = { ...error, shouldRetry: true };
        return retryError as AppError;
      } else {
        console.log('[TokenManager] Token refresh failed, logging out');
        await this.handleRefreshFailure();
        return error;
      }
    });
  }

  /**
   * Check if we should attempt token refresh
   */
  private async shouldAttemptRefresh(): Promise<boolean> {
    // Don't refresh if already refreshing
    if (this.isRefreshing) {
      return false;
    }

    // Check if we have a refresh token
    const refreshToken = await this.secureStorage.getRefreshToken();
    return !!refreshToken;
  }

  /**
   * Refresh token with single in-flight mechanism
   *
   * IMPORTANT: This prevents the "thundering herd" problem where multiple
   * concurrent 401s would trigger multiple refresh attempts. Only ONE
   * refresh request should be in flight at any time.
   */
  private async refreshTokenWithSingleInflight(): Promise<boolean> {
    // If already refreshing, wait for the existing promise
    if (this.refreshPromise) {
      console.log('[TokenManager] Refresh already in progress, waiting...');
      return this.refreshPromise;
    }

    // Create new refresh promise
    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      // Clear the promise when done
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh.
   *
   * Wrapped in inter-device thundering-herd defenses: an initial random jitter
   * to desynchronize a fleet-wide spike, then exponential backoff + full jitter
   * across retryable failures (overload / network), honoring `Retry-After`.
   */
  private async performTokenRefresh(): Promise<boolean> {
    this.isRefreshing = true;

    try {
      // STEP 1 — Initial jitter.
      // The whole point of the "9 AM" scenario is that every device fires at
      // the SAME instant. A small random delay here smears those calls across
      // a window so the endpoint sees a ramp, not a wall. Other concurrent
      // 401s on THIS device are already parked on the shared refreshPromise,
      // so this delay costs the device nothing extra.
      await this.sleep(this.randomBetween(0, this.refreshInitialJitterMs));

      let lastError: unknown = null;

      for (let attempt = 0; attempt < this.maxRefreshAttempts; attempt++) {
        // Read the token fresh each attempt — it never changes here, but this
        // keeps the rotation contract explicit.
        const oldRefreshToken = await this.secureStorage.getRefreshToken();
        if (!oldRefreshToken) {
          console.log('[TokenManager] No refresh token available');
          return false;
        }

        try {
          console.log(
            `[TokenManager] Performing token refresh (attempt ${attempt + 1}/${this.maxRefreshAttempts})...`
          );

          const response = await this.apiClient.post<{ data: TokenRefreshResponse }>(
            this.refreshEndpoint,
            { refreshToken: oldRefreshToken },
            {
              skipAuth: true, // Don't add auth header to refresh request
              timeout: 10000, // 10 second timeout for refresh
            }
          );

          const tokenData = response.data.data;

          // REFRESH TOKEN ROTATION
          // The old refresh token is now invalid (single-use).
          // Store the new refresh token immediately.
          console.log('[TokenManager] Rotating refresh token (single-use)');
          await this.secureStorage.storeRefreshToken(tokenData.refreshToken);

          // Update access token in API client
          this.apiClient.setAccessToken(tokenData.accessToken);

          // Update auth store
          useAuthStore.getState().setAccessToken(tokenData.accessToken, tokenData.expiresIn);

          console.log('[TokenManager] Token refresh and rotation successful');
          return true;

        } catch (error) {
          lastError = error;

          // A 401/403 on the refresh call means the refresh token itself is
          // genuinely invalid/expired. Retrying cannot help and only adds load
          // — fail fast so the caller logs the user out.
          if (
            isAppError(error) &&
            (error.type === ErrorType.UNAUTHORIZED || error.type === ErrorType.FORBIDDEN)
          ) {
            console.log('[TokenManager] Refresh token is invalid or expired — not retrying');
            return false;
          }

          // Everything else (429, 5xx, timeout, network) is the endpoint
          // shedding load or flaking. These ARE retryable — but only with
          // backoff, otherwise we just reform the herd.
          if (!this.isRetryableRefreshError(error)) {
            console.error('[TokenManager] Non-retryable refresh error:', error);
            return false;
          }

          // No retries left.
          if (attempt >= this.maxRefreshAttempts - 1) {
            break;
          }

          const delayMs = this.computeBackoffDelay(attempt, error);
          console.log(
            `[TokenManager] Refresh attempt ${attempt + 1} failed (${this.describeError(error)}), ` +
              `backing off ${delayMs}ms before retry`
          );
          await this.sleep(delayMs);
        }
      }

      console.error('[TokenManager] Token refresh exhausted all attempts:', lastError);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Whether a refresh failure is worth retrying (with backoff).
   * Overload (429), server errors (5xx), timeouts and network blips are
   * transient. Auth failures (401/403) are handled separately and never retried.
   */
  private isRetryableRefreshError(error: unknown): boolean {
    if (!isAppError(error)) {
      return false;
    }

    if (error.statusCode === 429) return true; // Too Many Requests / rate limited
    if (error.statusCode !== undefined && error.statusCode >= 500) return true; // 5xx

    return (
      error.type === ErrorType.SERVER_ERROR ||
      error.type === ErrorType.TIMEOUT ||
      error.type === ErrorType.NETWORK
    );
  }

  /**
   * Exponential backoff with FULL jitter, honoring the server's `Retry-After`.
   *
   * Full jitter (delay = random(0, cap)) rather than fixed exponential is what
   * actually breaks up the herd: if every client backed off by the same
   * computed amount they would simply retry in lockstep again.
   */
  private computeBackoffDelay(attempt: number, error: unknown): number {
    // If the server told us when to come back, respect it (plus a little
    // jitter so the retry wave is still spread out).
    if (isAppError(error) && typeof error.retryAfterMs === 'number') {
      return error.retryAfterMs + this.randomBetween(0, this.refreshBackoffBaseMs);
    }

    const exponentialCap = Math.min(
      this.refreshBackoffMaxMs,
      this.refreshBackoffBaseMs * 2 ** attempt
    );
    return this.randomBetween(0, exponentialCap);
  }

  /** Promise-based delay. */
  private sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Inclusive-of-zero random integer in [min, max]. */
  private randomBetween(min: number, max: number): number {
    if (max <= min) return min;
    return Math.floor(min + Math.random() * (max - min));
  }

  /** Short, non-sensitive description of a refresh error for logging. */
  private describeError(error: unknown): string {
    if (isAppError(error)) {
      return `${error.type}${error.statusCode ? ` ${error.statusCode}` : ''}`;
    }
    return 'unknown error';
  }

  /**
   * Handle refresh failure - force logout
   */
  private async handleRefreshFailure(): Promise<void> {
    console.log('[TokenManager] Handling refresh failure - forcing logout');

    // Clear all auth data
    this.apiClient.setAccessToken(null);
    await this.secureStorage.clearAll();

    // Update auth store to trigger navigation
    useAuthStore.getState().logout();

    // Note: In production, you might want to show a specific error message
    // or redirect to a session expired screen
  }

  /**
   * Create a retry-capable request wrapper
   * This wraps requests to automatically retry on 401 after token refresh
   */
  public async makeAuthenticatedRequest<T>(
    requestFn: () => Promise<T>,
    options: { maxRetries?: number } = {}
  ): Promise<T> {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    let retryCount = 0;

    // Temporarily disable automatic activity tracking to prevent loops
    // this.trackActivity();

    while (retryCount <= maxRetries) {
      try {
        // Attempt the request
        const result = await requestFn();
        return result;

      } catch (error) {
        // Check if it's a 401 and we haven't exhausted retries
        if (
          isAppError(error) &&
          error.type === ErrorType.UNAUTHORIZED &&
          error.statusCode === 401 &&
          retryCount < maxRetries
        ) {
          console.log(`[TokenManager] Request failed with 401, attempting refresh (retry ${retryCount + 1}/${maxRetries})`);

          // Attempt token refresh
          const refreshSuccess = await this.refreshTokenWithSingleInflight();

          if (refreshSuccess) {
            console.log('[TokenManager] Retrying request after successful refresh');
            retryCount++;
            // Continue to retry the request
            continue;
          } else {
            // Refresh failed, handle logout
            await this.handleRefreshFailure();
            throw error;
          }
        }

        // Not a 401 or exhausted retries
        throw error;
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error('Max retries exceeded');
  }

  /**
   * Manually trigger token refresh
   * Useful for proactive refresh before token expires
   */
  public async refreshToken(): Promise<boolean> {
    return this.refreshTokenWithSingleInflight();
  }

  /**
   * Check if currently refreshing
   */
  public isCurrentlyRefreshing(): boolean {
    return this.isRefreshing;
  }

  /**
   * Track user activity for inactivity timer
   * Called automatically on API requests
   */
  private trackActivity(): void {
    // Only track if AuthService exists (avoid circular dependency)
    try {
      const state = useAuthStore.getState();
      const now = Date.now();

      // Only update if authenticated and more than 1 second has passed (debounce)
      if (state.authState === 'authenticated' && now - state.lastActivity > 1000) {
        // Update last activity in auth store
        state.updateLastActivity();

        // Update in secure storage (async, don't await)
        this.secureStorage.updateLastActivity().catch(() => {
          // Silently ignore storage errors
        });
      }
    } catch (error) {
      // Silently ignore if auth tracking fails
      // This is non-critical functionality
    }
  }

  /**
   * Clear refresh state (for testing or reset)
   */
  public clearRefreshState(): void {
    this.refreshPromise = null;
    this.isRefreshing = false;
  }
}