import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme/useAppTheme';
import { useSetAuthState } from '@/store/authStore';
import { AuthService } from '@/services/AuthService';
import { BiometricService } from '@/services/BiometricService';

/**
 * Login screen component
 * Simple form for demonstration - production would have more validation
 */
export const LoginScreen: React.FC = () => {
  const { colors, spacing, typography } = useAppTheme();
  // Use stable selector hook
  const setAuthState = useSetAuthState();

  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [enableBiometric, setEnableBiometric] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Services
  const authService = AuthService.getInstance();
  const biometricService = BiometricService.getInstance();

  /**
   * Handle login
   */
  const handleLogin = useCallback(async () => {
    // Basic validation
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }

    setIsLoading(true);
    setAuthState('authenticating');

    try {
      // Attempt login
      const result = await authService.login(username, password);

      if (!result.success) {
        Alert.alert('Login Failed', result.error || 'Invalid credentials');
        setAuthState('unauthenticated');
        return;
      }

      // Check if biometric should be enabled
      if (enableBiometric) {
        const biometricAvailable = await biometricService.isAvailable();
        if (biometricAvailable) {
          await authService.enableBiometric();
        } else {
          Alert.alert(
            'Biometric Unavailable',
            'Biometric authentication is not available on this device. You can enable it later in settings.'
          );
        }
      }

      // Login successful - navigation handled by App.tsx based on auth state
    } catch (error) {
      console.error('[LoginScreen] Login error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      setAuthState('unauthenticated');
    } finally {
      setIsLoading(false);
    }
  }, [username, password, enableBiometric, setAuthState]);

  /**
   * Check biometric availability on mount
   */
  React.useEffect(() => {
    const checkBiometric = async () => {
      const available = await biometricService.isAvailable();
      if (available) {
        const biometricType = await biometricService.getPrimaryBiometricType();
        console.log('[LoginScreen] Biometric available:', biometricType);
      }
    };
    checkBiometric();
  }, [biometricService]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }, typography.title]}>
              Aeon Bank
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }, typography.body]}>
              Welcome back
            </Text>
          </View>

          {/* Form */}
          <View style={[styles.form, { padding: spacing.lg }]}>
            {/* Username Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textPrimary }, typography.caption]}>
                Username
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    color: colors.textPrimary,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: spacing.md,
                  },
                ]}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter username"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
                testID="username-input"
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textPrimary }, typography.caption]}>
                Password
              </Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: colors.surface,
                      color: colors.textPrimary,
                      borderColor: colors.border,
                      borderRadius: 8,
                      paddingHorizontal: spacing.md,
                    },
                  ]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  testID="password-input"
                />
                <TouchableOpacity
                  style={[styles.showPasswordButton, { padding: spacing.sm }]}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  <Text style={[styles.showPasswordText, { color: colors.primary }]}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Biometric Option */}
            <View style={[styles.biometricContainer, { marginVertical: spacing.md }]}>
              <Text style={[styles.biometricLabel, { color: colors.textPrimary }, typography.body]}>
                Enable biometric login
              </Text>
              <Switch
                value={enableBiometric}
                onValueChange={setEnableBiometric}
                disabled={isLoading}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                {
                  backgroundColor: isLoading ? colors.textMuted : colors.primary,
                  borderRadius: 8,
                  paddingVertical: spacing.md,
                  marginTop: spacing.lg,
                },
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              testID="login-button"
            >
              {isLoading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={[styles.loginButtonText, { color: colors.surface }, typography.subtitle]}>
                  Login
                </Text>
              )}
            </TouchableOpacity>

            {/* Demo Note */}
            <View style={[styles.demoNote, { marginTop: spacing.lg }]}>
              <Text style={[styles.demoText, { color: colors.textSecondary }, typography.caption]}>
                Demo Mode: Use any username/password
              </Text>
              <Text style={[styles.demoText, { color: colors.textSecondary }, typography.caption]}>
                Tokens expire in 30s to demonstrate refresh
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    marginHorizontal: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    height: 48,
    borderWidth: 1,
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    height: 48,
    borderWidth: 1,
    fontSize: 16,
    paddingRight: 60,
  },
  showPasswordButton: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  showPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  biometricContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  biometricLabel: {
    flex: 1,
  },
  loginButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  loginButtonText: {
    fontWeight: '600',
  },
  demoNote: {
    alignItems: 'center',
  },
  demoText: {
    fontSize: 12,
    marginTop: 4,
  },
});