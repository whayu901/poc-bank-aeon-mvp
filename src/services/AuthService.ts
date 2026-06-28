import { ApiClient } from '@/api/ApiClient';
import { MockBackend } from '@/api/MockBackend';
import { SecureStorageService } from './SecureStorageService';
import { BiometricService } from './BiometricService';
import { useAuthStore, AuthUser } from '@/store/authStore';
import { AppError, ErrorType, isAppError } from '@/models/AppError';

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  error?: string;
  user?: AuthUser;
}

/**
 * Token response from auth endpoints
 */
interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  tokenType: string;
}

/**
 * Authentication service
 * Manages login, logout, token refresh, and biometric integration
 *
 * Security principles:
 * - Access tokens in memory only (never persisted)
 * - Refresh tokens in hardware-backed secure storage
 * - Automatic token refresh on 401
 * - Session lock with biometric re-authentication
 */
export class AuthService {
  private static instance: AuthService;
  private apiClient: ApiClient;
  private secureStorage: SecureStorageService;
  private biometricService: BiometricService;
  private mockBackend: MockBackend;
  private inactivityTimer: NodeJS.Timeout | null = null;
  private readonly INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.apiClient = ApiClient.getInstance();
    this.secureStorage = SecureStorageService.getInstance();
    this.biometricService = BiometricService.getInstance();
    this.mockBackend = MockBackend.getInstance();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Initialize the auth service on app start
   * Checks for existing session and handles biometric gate
   */
  async initialize(): Promise<void> {
    console.log('[AuthService] Initializing...');

    try {
      // Check for stored refresh token
      const refreshToken = await this.secureStorage.getRefreshToken();
      if (!refreshToken) {
        console.log('[AuthService] No stored session found');
        useAuthStore.getState().setAuthState('unauthenticated');
        return;
      }

      // Check if session is locked (requires biometric)
      const isLocked = await this.secureStorage.isSessionLocked();
      const biometricEnabled = await this.secureStorage.isBiometricEnabled();

      if (isLocked && biometricEnabled) {
        console.log('[AuthService] Session locked, requiring biometric');

        // Restore user info but keep session locked
        const userId = await this.secureStorage.getUserId();
        if (userId) {
          const user: AuthUser = {
            id: userId,
            username: userId, // In production, fetch from API
            lastLogin: new Date(),
          };
          useAuthStore.getState().setUser(user);
        }

        useAuthStore.getState().setAuthState('locked');
        useAuthStore.getState().setBiometricEnabled(true);
        return;
      }

      // Try to refresh the token
      console.log('[AuthService] Attempting to restore session...');
      const refreshResult = await this.refreshToken(refreshToken);

      if (refreshResult.success) {
        console.log('[AuthService] Session restored successfully');
        this.startInactivityTimer();
      } else {
        console.log('[AuthService] Failed to restore session:', refreshResult.error);
        await this.logout();
      }
    } catch (error) {
      console.error('[AuthService] Initialization error:', error);
      await this.logout();
    }
  }

  /**
   * Login with username and password
   */
  async login(username: string, password: string): Promise<AuthResult> {
    try {
      console.log('[AuthService] Attempting login for:', username);

      // Call login endpoint
      const response = await this.apiClient.post<{ data: TokenResponse }>(
        '/auth/login',
        { username, password },
        { skipAuth: true }
      );

      const tokenData = response.data.data;

      // Store tokens
      await this.secureStorage.storeRefreshToken(tokenData.refreshToken);
      this.apiClient.setAccessToken(tokenData.accessToken);

      // Create user object
      const user: AuthUser = {
        id: username, // In production, would come from API
        username,
        email: `${username}@example.com`, // Mock email
        lastLogin: new Date(),
      };

      // Store user ID for session restoration
      await this.secureStorage.storeUserId(user.id);

      // Update auth store
      useAuthStore.getState().login(user, tokenData.accessToken, tokenData.expiresIn);

      // Clear any lock state
      await this.secureStorage.setSessionLocked(false);

      // Start inactivity timer
      this.startInactivityTimer();

      console.log('[AuthService] Login successful');
      return { success: true, user };

    } catch (error) {
      console.error('[AuthService] Login failed:', error);

      if (isAppError(error)) {
        return {
          success: false,
          error: this.getErrorMessage(error),
        };
      }

      return {
        success: false,
        error: 'Login failed. Please check your credentials.',
      };
    }
  }

  /**
   * Logout and clear all auth data
   */
  async logout(): Promise<void> {
    console.log('[AuthService] Logging out...');

    // Clear tokens
    this.apiClient.setAccessToken(null);
    await this.secureStorage.clearAll();

    // Reset biometric attempts
    this.biometricService.resetAttempts();

    // Clear auth store
    useAuthStore.getState().logout();

    // Stop inactivity timer
    this.stopInactivityTimer();

    console.log('[AuthService] Logout complete');
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshToken(refreshToken?: string): Promise<AuthResult> {
    try {
      // Get refresh token if not provided
      const token = refreshToken || (await this.secureStorage.getRefreshToken());
      if (!token) {
        return { success: false, error: 'No refresh token available' };
      }

      console.log('[AuthService] Refreshing token...');

      // Call refresh endpoint
      const response = await this.apiClient.post<{ data: TokenResponse }>(
        '/auth/refresh',
        { refreshToken: token },
        { skipAuth: true }
      );

      const tokenData = response.data.data;

      // Store new tokens (rotation)
      await this.secureStorage.storeRefreshToken(tokenData.refreshToken);
      this.apiClient.setAccessToken(tokenData.accessToken);

      // Update auth store
      useAuthStore.getState().setAccessToken(tokenData.accessToken, tokenData.expiresIn);

      // Restore user if not present
      if (!useAuthStore.getState().user) {
        const userId = await this.secureStorage.getUserId();
        if (userId) {
          const user: AuthUser = {
            id: userId,
            username: userId,
            lastLogin: new Date(),
          };
          useAuthStore.getState().setUser(user);
        }
      }

      console.log('[AuthService] Token refreshed successfully');
      return { success: true };

    } catch (error) {
      console.error('[AuthService] Token refresh failed:', error);

      if (isAppError(error) && error.type === ErrorType.UNAUTHORIZED) {
        // Refresh token is invalid or expired
        await this.logout();
        return { success: false, error: 'Session expired. Please login again.' };
      }

      return { success: false, error: 'Failed to refresh session' };
    }
  }

  /**
   * Enable biometric authentication
   */
  async enableBiometric(): Promise<boolean> {
    try {
      const isAvailable = await this.biometricService.isAvailable();
      if (!isAvailable) {
        console.log('[AuthService] Biometric not available');
        return false;
      }

      // Authenticate to confirm
      const result = await this.biometricService.authenticate(
        'Enable biometric authentication for Aeon Bank'
      );

      if (result.success) {
        await this.secureStorage.setBiometricEnabled(true);
        useAuthStore.getState().setBiometricEnabled(true);
        console.log('[AuthService] Biometric enabled');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[AuthService] Failed to enable biometric:', error);
      return false;
    }
  }

  /**
   * Disable biometric authentication
   */
  async disableBiometric(): Promise<void> {
    await this.secureStorage.setBiometricEnabled(false);
    useAuthStore.getState().setBiometricEnabled(false);
    console.log('[AuthService] Biometric disabled');
  }

  /**
   * Unlock session with biometric
   */
  async unlockWithBiometric(): Promise<AuthResult> {
    try {
      const result = await this.biometricService.authenticateForUnlock();

      if (!result.success) {
        if (this.biometricService.hasExceededMaxAttempts()) {
          // Too many attempts, force logout
          await this.logout();
          return { success: false, error: 'Too many failed attempts. Please login again.' };
        }

        return { success: false, error: result.error };
      }

      // Unlock successful, refresh token to get new access token
      await this.secureStorage.setSessionLocked(false);
      const refreshResult = await this.refreshToken();

      if (refreshResult.success) {
        useAuthStore.getState().unlockSession();
        this.startInactivityTimer();
        return { success: true };
      }

      return refreshResult;

    } catch (error) {
      console.error('[AuthService] Biometric unlock failed:', error);
      return { success: false, error: 'Failed to unlock session' };
    }
  }

  /**
   * Lock the session (requires biometric to unlock)
   */
  async lockSession(): Promise<void> {
    console.log('[AuthService] Locking session...');

    await this.secureStorage.setSessionLocked(true);
    useAuthStore.getState().lockSession();
    this.stopInactivityTimer();
  }

  /**
   * Start inactivity timer for auto-lock/logout
   */
  private startInactivityTimer(): void {
    this.stopInactivityTimer();

    this.inactivityTimer = setTimeout(async () => {
      console.log('[AuthService] Inactivity timeout reached');

      const biometricEnabled = await this.secureStorage.isBiometricEnabled();
      if (biometricEnabled) {
        // Lock session if biometric is enabled
        await this.lockSession();
      } else {
        // Logout if no biometric
        await this.logout();
      }
    }, this.INACTIVITY_TIMEOUT);
  }

  /**
   * Stop inactivity timer
   */
  private stopInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  /**
   * Reset inactivity timer on user activity
   */
  resetInactivityTimer(): void {
    const authState = useAuthStore.getState().authState;
    if (authState === 'authenticated') {
      this.startInactivityTimer();
      useAuthStore.getState().updateLastActivity();
    }
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: AppError): string {
    switch (error.type) {
      case ErrorType.UNAUTHORIZED:
        return 'Invalid username or password';
      case ErrorType.NETWORK:
        return 'Network error. Please check your connection.';
      case ErrorType.TIMEOUT:
        return 'Request timed out. Please try again.';
      case ErrorType.SERVER_ERROR:
        return 'Server error. Please try again later.';
      default:
        return 'An error occurred. Please try again.';
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return useAuthStore.getState().authState === 'authenticated';
  }

  /**
   * Check if session is locked
   */
  isLocked(): boolean {
    return useAuthStore.getState().authState === 'locked';
  }
}