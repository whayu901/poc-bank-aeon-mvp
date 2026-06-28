import { TokenManager } from '../TokenManager';
import { ApiClient } from '@/api/ApiClient';
import { SecureStorageService } from '../SecureStorageService';
import { useAuthStore } from '@/store/authStore';
import { ErrorType, createAppError } from '@/models/AppError';

// Mock dependencies
jest.mock('@/api/ApiClient');
jest.mock('../SecureStorageService');

describe('TokenManager', () => {
  let tokenManager: TokenManager;
  let apiClient: jest.Mocked<ApiClient>;
  let secureStorage: jest.Mocked<SecureStorageService>;
  let errorInterceptor: (error: any) => Promise<any>;

  beforeEach(() => {
    // Reset singletons
    (TokenManager as any).instance = undefined;
    (ApiClient as any).instance = undefined;
    (SecureStorageService as any).instance = undefined;

    // Setup mocked ApiClient
    apiClient = {
      addErrorInterceptor: jest.fn(),
      post: jest.fn(),
      setAccessToken: jest.fn(),
    } as any;

    (ApiClient.getInstance as jest.Mock).mockReturnValue(apiClient);

    // Setup mocked SecureStorageService
    secureStorage = {
      getRefreshToken: jest.fn(),
      storeRefreshToken: jest.fn(),
      clearAll: jest.fn(),
    } as any;

    (SecureStorageService.getInstance as jest.Mock).mockReturnValue(secureStorage);

    // Get TokenManager instance
    tokenManager = TokenManager.getInstance();

    // Capture the error interceptor
    apiClient.addErrorInterceptor.mockImplementation((interceptor) => {
      errorInterceptor = interceptor;
    });

    // Initialize token manager
    tokenManager.initialize();

    // Reset auth store
    useAuthStore.getState().logout();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('401 interceptor', () => {
    it('should attempt refresh on 401 error', async () => {
      // Setup
      secureStorage.getRefreshToken.mockResolvedValue('old-refresh-token');
      apiClient.post.mockResolvedValue({
        data: {
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
        status: 200,
        headers: new Headers(),
        config: {},
      });

      // Create 401 error
      const error = createAppError(
        ErrorType.UNAUTHORIZED,
        'Unauthorized',
        401
      );

      // Process through interceptor
      const result = await errorInterceptor(error);

      // Verify refresh was attempted
      expect(apiClient.post).toHaveBeenCalledWith(
        '/auth/refresh',
        { refreshToken: 'old-refresh-token' },
        { skipAuth: true, timeout: 10000 }
      );

      // Verify tokens were updated
      expect(secureStorage.storeRefreshToken).toHaveBeenCalledWith('new-refresh-token');
      expect(apiClient.setAccessToken).toHaveBeenCalledWith('new-access-token');
    });

    it('should not refresh for non-401 errors', async () => {
      const error = createAppError(
        ErrorType.SERVER_ERROR,
        'Server Error',
        500
      );

      const result = await errorInterceptor(error);

      expect(apiClient.post).not.toHaveBeenCalled();
      expect(result).toBe(error);
    });

    it('should force logout on refresh failure', async () => {
      secureStorage.getRefreshToken.mockResolvedValue('old-refresh-token');
      apiClient.post.mockRejectedValue(
        createAppError(ErrorType.UNAUTHORIZED, 'Invalid refresh token', 401)
      );

      const error = createAppError(
        ErrorType.UNAUTHORIZED,
        'Unauthorized',
        401
      );

      await errorInterceptor(error);

      // Verify logout was triggered
      expect(apiClient.setAccessToken).toHaveBeenCalledWith(null);
      expect(secureStorage.clearAll).toHaveBeenCalled();
      expect(useAuthStore.getState().authState).toBe('unauthenticated');
    });
  });

  describe('refresh token rotation', () => {
    it('should rotate refresh token on successful refresh', async () => {
      secureStorage.getRefreshToken.mockResolvedValue('old-refresh-token');

      const mockResponse = {
        data: {
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'rotated-refresh-token', // Different from old
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
        status: 200,
        headers: new Headers(),
        config: {},
      };

      apiClient.post.mockResolvedValue(mockResponse);

      const success = await tokenManager.refreshToken();

      expect(success).toBe(true);

      // Verify old token was sent
      expect(apiClient.post).toHaveBeenCalledWith(
        '/auth/refresh',
        { refreshToken: 'old-refresh-token' },
        expect.any(Object)
      );

      // Verify new rotated token was stored
      expect(secureStorage.storeRefreshToken).toHaveBeenCalledWith('rotated-refresh-token');

      // Old token should not be used again
      expect(secureStorage.storeRefreshToken).not.toHaveBeenCalledWith('old-refresh-token');
    });

    it('should make refresh token single-use', async () => {
      secureStorage.getRefreshToken
        .mockResolvedValueOnce('refresh-token-1')
        .mockResolvedValueOnce('refresh-token-2');

      // First refresh succeeds
      apiClient.post.mockResolvedValueOnce({
        data: {
          data: {
            accessToken: 'access-1',
            refreshToken: 'refresh-token-2',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
        status: 200,
        headers: new Headers(),
        config: {},
      });

      // Second refresh with new token
      apiClient.post.mockResolvedValueOnce({
        data: {
          data: {
            accessToken: 'access-2',
            refreshToken: 'refresh-token-3',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
        status: 200,
        headers: new Headers(),
        config: {},
      });

      // First refresh
      await tokenManager.refreshToken();
      expect(apiClient.post).toHaveBeenCalledWith(
        '/auth/refresh',
        { refreshToken: 'refresh-token-1' },
        expect.any(Object)
      );

      // Second refresh should use new token, not old one
      await tokenManager.refreshToken();
      expect(apiClient.post).toHaveBeenCalledWith(
        '/auth/refresh',
        { refreshToken: 'refresh-token-2' },
        expect.any(Object)
      );
    });
  });

  describe('single in-flight refresh', () => {
    it('should handle concurrent 401s with single refresh', async () => {
      secureStorage.getRefreshToken.mockResolvedValue('refresh-token');

      // Delay the refresh response to simulate in-flight
      let resolveRefresh: any;
      const refreshPromise = new Promise((resolve) => {
        resolveRefresh = resolve;
      });

      apiClient.post.mockReturnValue(refreshPromise as any);

      // Create multiple 401 errors
      const error1 = createAppError(ErrorType.UNAUTHORIZED, 'Unauthorized', 401);
      const error2 = createAppError(ErrorType.UNAUTHORIZED, 'Unauthorized', 401);
      const error3 = createAppError(ErrorType.UNAUTHORIZED, 'Unauthorized', 401);

      // Process all errors concurrently
      const promises = [
        errorInterceptor(error1),
        errorInterceptor(error2),
        errorInterceptor(error3),
      ];

      // Verify only one refresh request was made
      expect(apiClient.post).toHaveBeenCalledTimes(1);

      // Resolve the refresh
      resolveRefresh({
        data: {
          data: {
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
        status: 200,
        headers: new Headers(),
        config: {},
      });

      // Wait for all to complete
      await Promise.all(promises);

      // Still only one refresh request
      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/auth/refresh',
        { refreshToken: 'refresh-token' },
        expect.any(Object)
      );
    });

    it('should queue requests during refresh', async () => {
      secureStorage.getRefreshToken.mockResolvedValue('refresh-token');

      // Track the order of operations
      const operations: string[] = [];

      // Delay the refresh
      apiClient.post.mockImplementation(async () => {
        operations.push('refresh-start');
        await new Promise(resolve => setTimeout(resolve, 100));
        operations.push('refresh-end');
        return {
          data: {
            data: {
              accessToken: 'new-access',
              refreshToken: 'new-refresh',
              expiresIn: 3600,
              tokenType: 'Bearer',
            },
          },
          status: 200,
          headers: new Headers(),
          config: {},
        };
      });

      // Create multiple errors
      const error1 = createAppError(ErrorType.UNAUTHORIZED, 'Unauthorized', 401);
      const error2 = createAppError(ErrorType.UNAUTHORIZED, 'Unauthorized', 401);

      // Process errors
      const promise1 = errorInterceptor(error1).then(() => operations.push('error1-done'));
      const promise2 = errorInterceptor(error2).then(() => operations.push('error2-done'));

      await Promise.all([promise1, promise2]);

      // Verify operations order
      expect(operations).toEqual([
        'refresh-start',
        'refresh-end',
        'error1-done',
        'error2-done',
      ]);

      // Only one refresh
      expect(apiClient.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry mechanism', () => {
    it('should retry request after successful refresh', async () => {
      secureStorage.getRefreshToken.mockResolvedValue('refresh-token');
      apiClient.post.mockResolvedValue({
        data: {
          data: {
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
        status: 200,
        headers: new Headers(),
        config: {},
      });

      let attempts = 0;
      const requestFn = jest.fn(async () => {
        attempts++;
        if (attempts === 1) {
          // First attempt fails with 401
          throw createAppError(ErrorType.UNAUTHORIZED, 'Unauthorized', 401);
        }
        // Second attempt succeeds
        return { data: 'success' };
      });

      const result = await tokenManager.makeAuthenticatedRequest(requestFn);

      expect(result).toEqual({ data: 'success' });
      expect(requestFn).toHaveBeenCalledTimes(2);
      expect(apiClient.post).toHaveBeenCalledTimes(1); // One refresh
    });

    it('should not retry after max retries exceeded', async () => {
      const requestFn = jest.fn(async () => {
        throw createAppError(ErrorType.UNAUTHORIZED, 'Unauthorized', 401);
      });

      // Mock refresh to always succeed
      secureStorage.getRefreshToken.mockResolvedValue('refresh-token');
      apiClient.post.mockResolvedValue({
        data: {
          data: {
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
        status: 200,
        headers: new Headers(),
        config: {},
      });

      await expect(
        tokenManager.makeAuthenticatedRequest(requestFn, { maxRetries: 2 })
      ).rejects.toMatchObject({
        type: ErrorType.UNAUTHORIZED,
      });

      // Initial call + 2 retries = 3 calls
      expect(requestFn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-401 errors', async () => {
      const requestFn = jest.fn(async () => {
        throw createAppError(ErrorType.SERVER_ERROR, 'Server Error', 500);
      });

      await expect(
        tokenManager.makeAuthenticatedRequest(requestFn)
      ).rejects.toMatchObject({
        type: ErrorType.SERVER_ERROR,
      });

      expect(requestFn).toHaveBeenCalledTimes(1);
      expect(apiClient.post).not.toHaveBeenCalled(); // No refresh attempted
    });
  });

  describe('state management', () => {
    it('should track refreshing state', async () => {
      expect(tokenManager.isCurrentlyRefreshing()).toBe(false);

      secureStorage.getRefreshToken.mockResolvedValue('refresh-token');

      let resolveRefresh: any;
      apiClient.post.mockReturnValue(new Promise(resolve => {
        resolveRefresh = resolve;
      }) as any);

      // Start refresh
      const refreshPromise = tokenManager.refreshToken();

      // Should be refreshing now
      expect(tokenManager.isCurrentlyRefreshing()).toBe(true);

      // Complete refresh
      resolveRefresh({
        data: {
          data: {
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
        status: 200,
        headers: new Headers(),
        config: {},
      });

      await refreshPromise;

      // Should not be refreshing anymore
      expect(tokenManager.isCurrentlyRefreshing()).toBe(false);
    });

    it('should clear refresh state', () => {
      tokenManager.clearRefreshState();
      expect(tokenManager.isCurrentlyRefreshing()).toBe(false);
    });
  });
});