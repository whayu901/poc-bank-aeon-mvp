import * as SecureStore from 'expo-secure-store';
import { SecureStorageService } from '../SecureStorageService';

// Mock expo-secure-store
jest.mock('expo-secure-store');

describe('SecureStorageService', () => {
  let service: SecureStorageService;
  const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

  beforeEach(() => {
    // Reset singleton
    (SecureStorageService as any).instance = undefined;
    service = SecureStorageService.getInstance();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = SecureStorageService.getInstance();
      const instance2 = SecureStorageService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('setItem', () => {
    it('should store string value', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();

      await service.setItem('test-key', 'test-value');

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'test-key',
        'test-value',
        expect.objectContaining({
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        })
      );
    });

    it('should store object value as JSON', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();

      const obj = { foo: 'bar', num: 123 };
      await service.setItem('test-key', obj);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(obj),
        expect.any(Object)
      );
    });

    it('should handle storage errors', async () => {
      mockSecureStore.setItemAsync.mockRejectedValue(new Error('Storage error'));

      await expect(service.setItem('test-key', 'value')).rejects.toThrow(
        'Failed to store secure data'
      );
    });
  });

  describe('getItem', () => {
    it('should retrieve stored value', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('stored-value');

      const value = await service.getItem('test-key');

      expect(value).toBe('stored-value');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existent key', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const value = await service.getItem('non-existent');

      expect(value).toBeNull();
    });

    it('should handle retrieval errors gracefully', async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Retrieval error'));

      const value = await service.getItem('test-key');

      expect(value).toBeNull();
    });
  });

  describe('removeItem', () => {
    it('should remove stored value', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      await service.removeItem('test-key');

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('test-key');
    });

    it('should not throw if item does not exist', async () => {
      mockSecureStore.deleteItemAsync.mockRejectedValue(new Error('Item not found'));

      await expect(service.removeItem('non-existent')).resolves.not.toThrow();
    });
  });

  describe('token management', () => {
    it('should store refresh token', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();

      await service.storeRefreshToken('refresh-token-123');

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        service.KEYS.REFRESH_TOKEN,
        'refresh-token-123',
        expect.any(Object)
      );
    });

    it('should retrieve refresh token', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('refresh-token-123');

      const token = await service.getRefreshToken();

      expect(token).toBe('refresh-token-123');
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(service.KEYS.REFRESH_TOKEN);
    });

    it('should clear refresh token', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      await service.clearRefreshToken();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(service.KEYS.REFRESH_TOKEN);
    });
  });

  describe('biometric settings', () => {
    it('should store biometric enabled state', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();

      await service.setBiometricEnabled(true);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        service.KEYS.BIOMETRIC_ENABLED,
        'true',
        expect.any(Object)
      );
    });

    it('should retrieve biometric enabled state', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('true');

      const enabled = await service.isBiometricEnabled();

      expect(enabled).toBe(true);
    });

    it('should return false when biometric not set', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const enabled = await service.isBiometricEnabled();

      expect(enabled).toBe(false);
    });
  });

  describe('session lock', () => {
    it('should store session locked state', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();

      await service.setSessionLocked(true);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        service.KEYS.SESSION_LOCKED,
        'true',
        expect.any(Object)
      );
    });

    it('should retrieve session locked state', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('true');

      const locked = await service.isSessionLocked();

      expect(locked).toBe(true);
    });
  });

  describe('user management', () => {
    it('should store user ID', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();

      await service.storeUserId('user-123');

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        service.KEYS.USER_ID,
        'user-123',
        expect.any(Object)
      );
    });

    it('should retrieve user ID', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue('user-123');

      const userId = await service.getUserId();

      expect(userId).toBe('user-123');
    });
  });

  describe('activity tracking', () => {
    it('should update last activity timestamp', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);
      mockSecureStore.setItemAsync.mockResolvedValue();

      await service.updateLastActivity();

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        service.KEYS.LAST_ACTIVITY,
        now.toString(),
        expect.any(Object)
      );
    });

    it('should retrieve last activity timestamp', async () => {
      const timestamp = 1234567890;
      mockSecureStore.getItemAsync.mockResolvedValue(timestamp.toString());

      const activity = await service.getLastActivity();

      expect(activity).toBe(timestamp);
    });

    it('should return null when no activity recorded', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const activity = await service.getLastActivity();

      expect(activity).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('should clear all secure storage keys', async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      await service.clearAll();

      const expectedKeys = Object.values(service.KEYS);
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledTimes(expectedKeys.length);

      expectedKeys.forEach((key) => {
        expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(key);
      });
    });
  });

  describe('isAvailable', () => {
    it('should return true when secure storage is available', async () => {
      mockSecureStore.setItemAsync.mockResolvedValue();
      mockSecureStore.getItemAsync.mockResolvedValue('test');
      mockSecureStore.deleteItemAsync.mockResolvedValue();

      const available = await service.isAvailable();

      expect(available).toBe(true);
    });

    it('should return false when secure storage is not available', async () => {
      mockSecureStore.setItemAsync.mockRejectedValue(new Error('Not available'));

      const available = await service.isAvailable();

      expect(available).toBe(false);
    });
  });
});