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
 * - Single in-flight refresh (prevents thundering herd)
 * - Retry original request after refresh
 * - Force logout on refresh failure
 *
 * Security principles:
 * - Refresh tokens are single-use (rotation prevents replay attacks)
 * - Only one refresh request at a time (prevents race conditions)
 * - Failed refresh = immediate logout (security over convenience)
 */
export class TokenManager {
  private static instance: TokenManager;
  private apiClient: ApiClient;
  private secureStorage: SecureStorageService;
  private refreshPromise: Promise<boolean> | null = null;
  private isRefreshing = false;
  private maxRetries = 1; // Only retry once after refresh
  private refreshEndpoint = '/auth/refresh';

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
   * Perform the actual token refresh
   */
  private async performTokenRefresh(): Promise<boolean> {
    this.isRefreshing = true;

    try {
      const oldRefreshToken = await this.secureStorage.getRefreshToken();
      if (!oldRefreshToken) {
        console.log('[TokenManager] No refresh token available');
        return false;
      }

      console.log('[TokenManager] Performing token refresh...');

      // Call refresh endpoint
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
      // The old refresh token is now invalid (single-use)
      // Store the new refresh token immediately
      console.log('[TokenManager] Rotating refresh token (single-use)');
      await this.secureStorage.storeRefreshToken(tokenData.refreshToken);

      // Update access token in API client
      this.apiClient.setAccessToken(tokenData.accessToken);

      // Update auth store
      useAuthStore.getState().setAccessToken(tokenData.accessToken, tokenData.expiresIn);

      console.log('[TokenManager] Token refresh and rotation successful');
      return true;

    } catch (error) {
      console.error('[TokenManager] Token refresh failed:', error);

      // Check if it's a 401 on refresh itself
      if (isAppError(error) && error.type === ErrorType.UNAUTHORIZED) {
        console.log('[TokenManager] Refresh token is invalid or expired');
      }

      return false;
    } finally {
      this.isRefreshing = false;
    }
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

    // Track activity when making authenticated requests
    this.trackActivity();

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