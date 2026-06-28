import { ApiClient } from '@/api/ApiClient';
import { AuthService } from './AuthService';
import { TokenManager } from './TokenManager';

/**
 * App Initializer Service
 *
 * Handles proper initialization order of singleton services
 * to prevent circular dependencies and race conditions.
 *
 * Initialization Order:
 * 1. ApiClient (with config)
 * 2. TokenManager (sets up 401 interceptor)
 * 3. AuthService (checks existing session)
 *
 * This ensures all services are properly initialized before use.
 */
export class AppInitializer {
  private static isInitialized = false;

  /**
   * Initialize all app services in correct order
   */
  public static async initialize(): Promise<void> {
    if (AppInitializer.isInitialized) {
      console.log('[AppInitializer] Already initialized, skipping');
      return;
    }

    console.log('[AppInitializer] Starting initialization...');

    try {
      // Step 1: Initialize API Client with configuration
      // This will either create with our config or use the existing instance
      const apiClient = ApiClient.getInstance({
        baseURL: 'http://localhost:3000', // Would come from env config in production
        timeout: 15000,
        certificatePinning: {
          enabled: false, // Enable in production with dev build
          pins: [],
        },
      });
      console.log('[AppInitializer] API Client ready');

      // Step 2: Initialize TokenManager
      // This sets up the 401 interceptor on ApiClient
      const tokenManager = TokenManager.getInstance();
      tokenManager.initialize();
      console.log('[AppInitializer] Token Manager initialized');

      // Step 3: Initialize AuthService
      // This checks for existing session and sets up activity tracking
      const authService = AuthService.getInstance();
      await authService.initialize();
      console.log('[AppInitializer] Auth Service initialized');

      AppInitializer.isInitialized = true;
      console.log('[AppInitializer] All services initialized successfully');
    } catch (error) {
      console.error('[AppInitializer] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Reset initialization state (mainly for testing)
   */
  public static reset(): void {
    AppInitializer.isInitialized = false;
  }
}