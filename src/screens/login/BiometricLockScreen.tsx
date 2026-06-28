import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore, useAuthUser } from '../../store/authStore';
import { AuthService } from '../../services/AuthService';
import { BiometricService, BiometricType } from '../../services/BiometricService';

/**
 * Biometric lock screen
 * Shown when app is locked and requires biometric authentication
 */
export const BiometricLockScreen: React.FC = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const user = useAuthUser();
  const authService = AuthService.getInstance();
  const biometricService = BiometricService.getInstance();

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>(BiometricType.NONE);
  const [remainingAttempts, setRemainingAttempts] = useState(3);

  /**
   * Get biometric type on mount
   */
  useEffect(() => {
    const getBiometricType = async () => {
      const type = await biometricService.getPrimaryBiometricType();
      setBiometricType(type);
    };
    getBiometricType();
  }, [biometricService]);

  /**
   * Auto-trigger biometric on mount
   */
  useEffect(() => {
    // Small delay for better UX
    const timer = setTimeout(() => {
      handleBiometricAuth();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  /**
   * Handle biometric authentication
   */
  const handleBiometricAuth = async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);

    try {
      const result = await authService.unlockWithBiometric();

      if (!result.success) {
        const remaining = biometricService.getRemainingAttempts();
        setRemainingAttempts(remaining);

        if (remaining === 0) {
          Alert.alert(
            'Too Many Attempts',
            'You have exceeded the maximum number of attempts. Please log in again.',
            [{ text: 'OK' }]
          );
        } else if (result.error && !result.error.includes('cancelled')) {
          Alert.alert(
            'Authentication Failed',
            `${result.error}\n${remaining} attempts remaining.`,
            [{ text: 'Try Again', onPress: handleBiometricAuth }]
          );
        }
      }
      // If successful, navigation will be handled by auth state change
    } catch (error) {
      console.error('[BiometricLockScreen] Error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await authService.logout();
          },
        },
      ]
    );
  };

  /**
   * Get biometric icon based on type
   */
  const getBiometricIcon = () => {
    switch (biometricType) {
      case BiometricType.FACE_ID:
        return '👤'; // In production, use vector icons
      case BiometricType.FINGERPRINT:
        return '👆'; // In production, use vector icons
      case BiometricType.IRIS:
        return '👁'; // In production, use vector icons
      default:
        return '🔒';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.icon]}>{getBiometricIcon()}</Text>
          <Text style={[styles.title, { color: colors.text }, typography.largeTitle]}>
            Welcome back
          </Text>
          {user && (
            <Text style={[styles.username, { color: colors.secondaryText }, typography.body]}>
              {user.username}
            </Text>
          )}
        </View>

        {/* Biometric Prompt */}
        <View style={[styles.promptContainer, { padding: spacing.large }]}>
          <Text style={[styles.promptText, { color: colors.text }, typography.headline]}>
            {biometricType === BiometricType.FACE_ID
              ? 'Look at your device to unlock'
              : biometricType === BiometricType.FINGERPRINT
              ? 'Use your fingerprint to unlock'
              : 'Authenticate to unlock'}
          </Text>

          {remainingAttempts < 3 && remainingAttempts > 0 && (
            <Text style={[styles.attemptsText, { color: colors.warning }, typography.caption]}>
              {remainingAttempts} attempts remaining
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={[styles.actions, { padding: spacing.large }]}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              {
                backgroundColor: isAuthenticating ? colors.disabled : colors.primary,
                borderRadius: borderRadius.medium,
                paddingVertical: spacing.medium,
              },
            ]}
            onPress={handleBiometricAuth}
            disabled={isAuthenticating || remainingAttempts === 0}
          >
            {isAuthenticating ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.surface }, typography.headline]}>
                Unlock with {biometricService.getBiometricTypeName(biometricType)}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.secondaryButton,
              {
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: borderRadius.medium,
                paddingVertical: spacing.medium,
              },
            ]}
            onPress={handleLogout}
            disabled={isAuthenticating}
          >
            <Text style={[styles.buttonText, { color: colors.text }, typography.headline]}>
              Logout
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Text */}
        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { color: colors.secondaryText }, typography.caption]}>
            Your session is locked for security. Please authenticate to continue.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  username: {
    fontSize: 18,
  },
  promptContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  promptText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  attemptsText: {
    fontSize: 14,
  },
  actions: {
    marginBottom: 32,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    marginBottom: 12,
  },
  primaryButton: {
    // Styles applied inline
  },
  secondaryButton: {
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontWeight: '600',
  },
  infoContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  infoText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});