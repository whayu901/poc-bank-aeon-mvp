import * as SecureStore from 'expo-secure-store';

/**
 * Secure storage service wrapper for sensitive data
 * Uses hardware-backed encryption (iOS Keychain, Android Keystore)
 *
 * Security considerations:
 * - Never store sensitive data in AsyncStorage (unencrypted)
 * - Refresh tokens stored here, access tokens kept in memory only
 * - Automatically wipes on app uninstall (iOS) or app data clear (Android)
 */
export class SecureStorageService {
  private static instance: SecureStorageService;
  private readonly keyPrefix = 'aeonbank_';

  // Storage keys
  public readonly KEYS = {
    REFRESH_TOKEN: `${this.keyPrefix}refresh_token`,
    BIOMETRIC_ENABLED: `${this.keyPrefix}biometric_enabled`,
    SESSION_LOCKED: `${this.keyPrefix}session_locked`,
    USER_ID: `${this.keyPrefix}user_id`,
    LAST_ACTIVITY: `${this.keyPrefix}last_activity`,
  } as const;

  private constructor() {}

  public static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  /**
   * Store a value securely
   * @param key Storage key
   * @param value Value to store (will be stringified if object)
   * @returns Promise<void>
   */
  async setItem(key: string, value: string | object): Promise<void> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      // SecureStore options for maximum security
      const options: SecureStore.SecureStoreOptions = {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        // This ensures data is only accessible when device is unlocked
        // and cannot be transferred to other devices via backup
      };

      await SecureStore.setItemAsync(key, stringValue, options);
    } catch (error) {
      console.error('[SecureStorage] Failed to store item:', { key, error });
      throw new Error('Failed to store secure data');
    }
  }

  /**
   * Retrieve a value from secure storage
   * @param key Storage key
   * @returns Promise<string | null>
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const value = await SecureStore.getItemAsync(key);
      return value;
    } catch (error) {
      console.error('[SecureStorage] Failed to retrieve item:', { key, error });
      return null;
    }
  }

  /**
   * Remove a value from secure storage
   * @param key Storage key
   * @returns Promise<void>
   */
  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('[SecureStorage] Failed to remove item:', { key, error });
      // Don't throw - item might not exist
    }
  }

  /**
   * Store the refresh token securely
   * @param token Refresh token from auth server
   */
  async storeRefreshToken(token: string): Promise<void> {
    await this.setItem(this.KEYS.REFRESH_TOKEN, token);
  }

  /**
   * Retrieve the refresh token
   * @returns Promise<string | null>
   */
  async getRefreshToken(): Promise<string | null> {
    return this.getItem(this.KEYS.REFRESH_TOKEN);
  }

  /**
   * Clear the refresh token
   */
  async clearRefreshToken(): Promise<void> {
    await this.removeItem(this.KEYS.REFRESH_TOKEN);
  }

  /**
   * Store biometric preference
   * @param enabled Whether biometric is enabled
   */
  async setBiometricEnabled(enabled: boolean): Promise<void> {
    await this.setItem(this.KEYS.BIOMETRIC_ENABLED, enabled.toString());
  }

  /**
   * Get biometric preference
   * @returns Promise<boolean>
   */
  async isBiometricEnabled(): Promise<boolean> {
    const value = await this.getItem(this.KEYS.BIOMETRIC_ENABLED);
    return value === 'true';
  }

  /**
   * Store session lock state
   * @param locked Whether session is locked
   */
  async setSessionLocked(locked: boolean): Promise<void> {
    await this.setItem(this.KEYS.SESSION_LOCKED, locked.toString());
  }

  /**
   * Get session lock state
   * @returns Promise<boolean>
   */
  async isSessionLocked(): Promise<boolean> {
    const value = await this.getItem(this.KEYS.SESSION_LOCKED);
    return value === 'true';
  }

  /**
   * Store user ID
   * @param userId User identifier
   */
  async storeUserId(userId: string): Promise<void> {
    await this.setItem(this.KEYS.USER_ID, userId);
  }

  /**
   * Get user ID
   * @returns Promise<string | null>
   */
  async getUserId(): Promise<string | null> {
    return this.getItem(this.KEYS.USER_ID);
  }

  /**
   * Update last activity timestamp
   */
  async updateLastActivity(): Promise<void> {
    await this.setItem(this.KEYS.LAST_ACTIVITY, Date.now().toString());
  }

  /**
   * Get last activity timestamp
   * @returns Promise<number | null>
   */
  async getLastActivity(): Promise<number | null> {
    const value = await this.getItem(this.KEYS.LAST_ACTIVITY);
    return value ? parseInt(value, 10) : null;
  }

  /**
   * Clear all secure storage (logout)
   * IMPORTANT: This wipes all sensitive data
   */
  async clearAll(): Promise<void> {
    const keys = Object.values(this.KEYS);

    // Clear each key individually
    await Promise.all(keys.map(key => this.removeItem(key)));

    console.log('[SecureStorage] All secure data cleared');
  }

  /**
   * Check if secure storage is available on this device
   * @returns Promise<boolean>
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try to store and retrieve a test value
      const testKey = `${this.keyPrefix}test`;
      const testValue = 'test';

      await SecureStore.setItemAsync(testKey, testValue);
      const retrieved = await SecureStore.getItemAsync(testKey);
      await SecureStore.deleteItemAsync(testKey);

      return retrieved === testValue;
    } catch (error) {
      console.error('[SecureStorage] Secure storage not available:', error);
      return false;
    }
  }
}