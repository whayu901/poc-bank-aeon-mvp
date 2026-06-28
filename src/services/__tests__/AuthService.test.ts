import { AuthService } from '../AuthService';
import { SecureStorageService } from '../SecureStorageService';
import { BiometricService } from '../BiometricService';
import { ApiClient } from '../../api/ApiClient';
import { MockBackend } from '../../api/MockBackend';
import { useAuthStore } from '../../store/authStore';

// Mock dependencies
jest.mock('../SecureStorageService');
jest.mock('../BiometricService');
jest.mock('../../api/ApiClient');
jest.mock('../../api/MockBackend');

describe('AuthService', () => {
  let authService: AuthService;
  let secureStorage: jest.Mocked<SecureStorageService>;
  let biometricService: jest.Mocked<BiometricService>;
  let apiClient: jest.Mocked<ApiClient>;
  let mockBackend: jest.Mocked<MockBackend>;

  beforeEach(() => {
    // Reset singleton
    (AuthService as any).instance = undefined;

    // Get mocked instances
    authService = AuthService.getInstance();
    secureStorage = SecureStorageService.getInstance() as jest.Mocked<SecureStorageService>;
    biometricService = BiometricService.getInstance() as jest.Mocked<BiometricService>;
    apiClient = ApiClient.getInstance() as jest.Mocked<ApiClient>;
    mockBackend = MockBackend.getInstance() as jest.Mocked<MockBackend>;

    // Reset auth store
    useAuthStore.getState().logout();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should set unauthenticated state when no refresh token', async () => {
      secureStorage.getRefreshToken.mockResolvedValue(null);

      await authService.initialize();

      expect(useAuthStore.getState().authState).toBe('unauthenticated');
    });

    it('should set locked state when session is locked with biometric', async () => {
      secureStorage.getRefreshToken.mockResolvedValue('refresh-token');
      secureStorage.isSessionLocked.mockResolvedValue(true);
      secureStorage.isBiometricEnabled.mockResolvedValue(true);
      secureStorage.getUserId.mockResolvedValue('user123');

      await authService.initialize();

      expect(useAuthStore.getState().authState).toBe('locked');
      expect(useAuthStore.getState().biometricEnabled).toBe(true);
      expect(useAuthStore.getState().user?.id).toBe('user123');
    });

    it('should restore session when refresh token is valid', async () => {
      secureStorage.getRefreshToken.mockResolvedValue('refresh-token');
      secureStorage.isSessionLocked.mockResolvedValue(false);
      secureStorage.isBiometricEnabled.mockResolvedValue(false);

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

      await authService.initialize();

      expect(apiClient.post).toHaveBeenCalledWith('/auth/refresh', { refreshToken: 'refresh-token' }, { skipAuth: true });
      expect(secureStorage.storeRefreshToken).toHaveBeenCalledWith('new-refresh-token');
      expect(apiClient.setAccessToken).toHaveBeenCalledWith('new-access-token');
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        data: {
          data: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer',
          },
        },
        status: 200,
        headers: new Headers(),
        config: {},
      };

      apiClient.post.mockResolvedValue(mockResponse);

      const result = await authService.login('testuser', 'password');

      expect(result.success).toBe(true);
      expect(result.user?.username).toBe('testuser');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/auth/login',
        { username: 'testuser', password: 'password' },
        { skipAuth: true }
      );
      expect(secureStorage.storeRefreshToken).toHaveBeenCalledWith('refresh-token');
      expect(apiClient.setAccessToken).toHaveBeenCalledWith('access-token');
      expect(useAuthStore.getState().authState).toBe('authenticated');
    });

    it('should handle login failure', async () => {
      apiClient.post.mockRejectedValue(new Error('Invalid credentials'));

      const result = await authService.login('testuser', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(useAuthStore.getState().authState).toBe('unauthenticated');
    });
  });

  describe('logout', () => {
    it('should clear all auth data on logout', async () => {
      await authService.logout();

      expect(apiClient.setAccessToken).toHaveBeenCalledWith(null);
      expect(secureStorage.clearAll).toHaveBeenCalled();
      expect(biometricService.resetAttempts).toHaveBeenCalled();
      expect(useAuthStore.getState().authState).toBe('unauthenticated');
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = {
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
      };

      secureStorage.getRefreshToken.mockResolvedValue('old-refresh-token');
      apiClient.post.mockResolvedValue(mockResponse);

      const result = await authService.refreshToken();

      expect(result.success).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith(
        '/auth/refresh',
        { refreshToken: 'old-refresh-token' },
        { skipAuth: true }
      );
      expect(secureStorage.storeRefreshToken).toHaveBeenCalledWith('new-refresh-token');
      expect(apiClient.setAccessToken).toHaveBeenCalledWith('new-access-token');
    });

    it('should logout on refresh failure', async () => {
      secureStorage.getRefreshToken.mockResolvedValue('invalid-token');
      apiClient.post.mockRejectedValue({
        type: 'UNAUTHORIZED',
        message: 'Invalid token',
      });

      const result = await authService.refreshToken();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session expired');
      // Logout should be called
      expect(apiClient.setAccessToken).toHaveBeenCalledWith(null);
      expect(secureStorage.clearAll).toHaveBeenCalled();
    });
  });

  describe('biometric operations', () => {
    it('should enable biometric when available', async () => {
      biometricService.isAvailable.mockResolvedValue(true);
      biometricService.authenticate.mockResolvedValue({ success: true });

      const result = await authService.enableBiometric();

      expect(result).toBe(true);
      expect(secureStorage.setBiometricEnabled).toHaveBeenCalledWith(true);
      expect(useAuthStore.getState().biometricEnabled).toBe(true);
    });

    it('should not enable biometric when not available', async () => {
      biometricService.isAvailable.mockResolvedValue(false);

      const result = await authService.enableBiometric();

      expect(result).toBe(false);
      expect(secureStorage.setBiometricEnabled).not.toHaveBeenCalled();
    });

    it('should unlock with biometric successfully', async () => {
      biometricService.authenticateForUnlock.mockResolvedValue({ success: true });
      secureStorage.getRefreshToken.mockResolvedValue('refresh-token');

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

      const result = await authService.unlockWithBiometric();

      expect(result.success).toBe(true);
      expect(secureStorage.setSessionLocked).toHaveBeenCalledWith(false);
      expect(useAuthStore.getState().authState).toBe('authenticated');
    });

    it('should logout after too many failed biometric attempts', async () => {
      biometricService.authenticateForUnlock.mockResolvedValue({
        success: false,
        error: 'Too many attempts',
      });
      biometricService.hasExceededMaxAttempts.mockReturnValue(true);

      const result = await authService.unlockWithBiometric();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many failed attempts');
      expect(secureStorage.clearAll).toHaveBeenCalled();
    });
  });

  describe('session management', () => {
    it('should lock session', async () => {
      await authService.lockSession();

      expect(secureStorage.setSessionLocked).toHaveBeenCalledWith(true);
      expect(useAuthStore.getState().authState).toBe('locked');
      expect(useAuthStore.getState().accessToken).toBeNull();
    });

    it('should check if authenticated', () => {
      useAuthStore.getState().setAuthState('authenticated');
      expect(authService.isAuthenticated()).toBe(true);

      useAuthStore.getState().setAuthState('unauthenticated');
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('should check if locked', () => {
      useAuthStore.getState().setAuthState('locked');
      expect(authService.isLocked()).toBe(true);

      useAuthStore.getState().setAuthState('authenticated');
      expect(authService.isLocked()).toBe(false);
    });
  });
});