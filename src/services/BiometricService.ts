import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/**
 * Biometric authentication types
 */
export enum BiometricType {
  FINGERPRINT = 'FINGERPRINT',
  FACE_ID = 'FACE_ID',
  IRIS = 'IRIS',
  NONE = 'NONE',
}

/**
 * Biometric authentication result
 */
export interface BiometricResult {
  success: boolean;
  error?: string;
  warning?: string;
}

/**
 * Biometric authentication service
 *
 * Security considerations:
 * - Always check hardware availability before enabling
 * - Provide fallback to passcode when biometric fails
 * - Clear sensitive data on too many failed attempts
 * - iOS: Face ID requires NSFaceIDUsageDescription in Info.plist
 */
export class BiometricService {
  private static instance: BiometricService;
  private maxAttempts = 3;
  private currentAttempts = 0;

  private constructor() {}

  public static getInstance(): BiometricService {
    if (!BiometricService.instance) {
      BiometricService.instance = new BiometricService();
    }
    return BiometricService.instance;
  }

  /**
   * Check if biometric hardware is available
   */
  async isHardwareAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      return hasHardware;
    } catch (error) {
      console.error('[BiometricService] Failed to check hardware:', error);
      return false;
    }
  }

  /**
   * Check if biometrics are enrolled
   */
  async isEnrolled(): Promise<boolean> {
    try {
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return isEnrolled;
    } catch (error) {
      console.error('[BiometricService] Failed to check enrollment:', error);
      return false;
    }
  }

  /**
   * Check if biometric authentication is available and enrolled
   */
  async isAvailable(): Promise<boolean> {
    const hasHardware = await this.isHardwareAvailable();
    if (!hasHardware) return false;

    const isEnrolled = await this.isEnrolled();
    return isEnrolled;
  }

  /**
   * Get available biometric types
   */
  async getAvailableTypes(): Promise<BiometricType[]> {
    try {
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const types: BiometricType[] = [];

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        types.push(BiometricType.FINGERPRINT);
      }
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        types.push(BiometricType.FACE_ID);
      }
      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        types.push(BiometricType.IRIS);
      }

      return types;
    } catch (error) {
      console.error('[BiometricService] Failed to get biometric types:', error);
      return [];
    }
  }

  /**
   * Get the primary biometric type available
   */
  async getPrimaryBiometricType(): Promise<BiometricType> {
    const types = await this.getAvailableTypes();

    // Prefer Face ID on iOS, fingerprint on Android
    if (Platform.OS === 'ios' && types.includes(BiometricType.FACE_ID)) {
      return BiometricType.FACE_ID;
    }
    if (types.includes(BiometricType.FINGERPRINT)) {
      return BiometricType.FINGERPRINT;
    }
    if (types.includes(BiometricType.FACE_ID)) {
      return BiometricType.FACE_ID;
    }
    if (types.includes(BiometricType.IRIS)) {
      return BiometricType.IRIS;
    }

    return BiometricType.NONE;
  }

  /**
   * Authenticate with biometrics
   * @param reason The reason shown to the user
   * @param options Additional options
   */
  async authenticate(
    reason: string = 'Please authenticate to continue',
    options?: {
      fallbackLabel?: string;
      disableDeviceFallback?: boolean;
      cancelLabel?: string;
    }
  ): Promise<BiometricResult> {
    try {
      // Check availability first
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device',
        };
      }

      // Check attempt limit
      if (this.currentAttempts >= this.maxAttempts) {
        return {
          success: false,
          error: 'Too many failed attempts. Please use password instead.',
        };
      }

      // Perform authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: options?.fallbackLabel ?? 'Use Passcode',
        disableDeviceFallback: options?.disableDeviceFallback ?? false,
        cancelLabel: options?.cancelLabel ?? 'Cancel',
      });

      if (result.success) {
        this.currentAttempts = 0; // Reset attempts on success
        return { success: true };
      }

      // Handle different error types
      this.currentAttempts++;

      switch (result.error) {
        case 'UserCancel':
          return {
            success: false,
            error: 'Authentication was cancelled',
          };

        case 'UserFallback':
          return {
            success: false,
            warning: 'User selected fallback authentication',
          };

        case 'SystemCancel':
          return {
            success: false,
            error: 'Authentication was cancelled by the system',
          };

        case 'PasscodeNotSet':
          return {
            success: false,
            error: 'Device passcode is not set',
          };

        case 'BiometryNotAvailable':
          return {
            success: false,
            error: 'Biometric authentication is not available',
          };

        case 'BiometryNotEnrolled':
          return {
            success: false,
            error: 'No biometric data is enrolled',
          };

        case 'BiometryLockout':
          return {
            success: false,
            error: 'Biometric authentication is locked due to too many attempts',
          };

        default:
          return {
            success: false,
            error: result.error || 'Authentication failed',
          };
      }
    } catch (error) {
      console.error('[BiometricService] Authentication error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred during authentication',
      };
    }
  }

  /**
   * Authenticate for app unlock (with specific messaging)
   */
  async authenticateForUnlock(): Promise<BiometricResult> {
    const biometricType = await this.getPrimaryBiometricType();

    let reason = 'Unlock Aeon Bank';
    switch (biometricType) {
      case BiometricType.FACE_ID:
        reason = 'Look at your device to unlock Aeon Bank';
        break;
      case BiometricType.FINGERPRINT:
        reason = 'Use your fingerprint to unlock Aeon Bank';
        break;
      case BiometricType.IRIS:
        reason = 'Use iris scan to unlock Aeon Bank';
        break;
    }

    return this.authenticate(reason, {
      fallbackLabel: 'Enter Passcode',
      cancelLabel: 'Logout',
    });
  }

  /**
   * Authenticate for sensitive operations (e.g., viewing account details)
   */
  async authenticateForSensitiveOperation(
    operation: string = 'view sensitive information'
  ): Promise<BiometricResult> {
    const reason = `Authenticate to ${operation}`;

    return this.authenticate(reason, {
      fallbackLabel: 'Use Password',
      disableDeviceFallback: false,
    });
  }

  /**
   * Reset attempt counter
   */
  resetAttempts(): void {
    this.currentAttempts = 0;
  }

  /**
   * Get remaining attempts
   */
  getRemainingAttempts(): number {
    return Math.max(0, this.maxAttempts - this.currentAttempts);
  }

  /**
   * Check if user has exceeded max attempts
   */
  hasExceededMaxAttempts(): boolean {
    return this.currentAttempts >= this.maxAttempts;
  }

  /**
   * Get user-friendly biometric type name
   */
  getBiometricTypeName(type: BiometricType): string {
    switch (type) {
      case BiometricType.FACE_ID:
        return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      case BiometricType.FINGERPRINT:
        return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      case BiometricType.IRIS:
        return 'Iris Scan';
      default:
        return 'Biometric Authentication';
    }
  }
}