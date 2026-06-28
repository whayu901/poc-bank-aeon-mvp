import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore, useAuthState } from '@/store/authStore';
import { AuthService } from '@/services/AuthService';
import { LoginScreen } from '@/screens/login/LoginScreen';
import { BiometricLockScreen } from '@/screens/login/BiometricLockScreen';
import { TransactionListScreen } from '@/screens/TransactionListScreen';
import { TransactionDetailScreen } from '@/screens/TransactionDetailScreen';
import { useAppTheme } from '@/theme/useAppTheme';
import { useTranslation } from '@/i18n';
import type { RootStackParamList } from '@/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList & { Login: undefined; BiometricLock: undefined }>();

/**
 * Auth-aware navigation container
 * Routes users based on authentication state
 */
export function AuthNavigator() {
  const { colors, colorScheme } = useAppTheme();
  const { t } = useTranslation();
  const authState = useAuthState();
  const [isInitializing, setIsInitializing] = React.useState(true);

  // Initialize auth service on mount
  useEffect(() => {
    const initAuth = async () => {
      const authService = AuthService.getInstance();
      await authService.initialize();
      setIsInitializing(false);
    };
    initAuth();
  }, []);

  // Show loading while checking auth state
  if (isInitializing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: colorScheme === 'dark',
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.background,
          text: colors.textPrimary,
          border: colors.border,
          notification: colors.accent,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '800' },
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        {authState === 'unauthenticated' && (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}

        {authState === 'locked' && (
          <Stack.Screen
            name="BiometricLock"
            component={BiometricLockScreen}
            options={{ headerShown: false }}
          />
        )}

        {(authState === 'authenticated' || authState === 'authenticating') && (
          <>
            <Stack.Screen
              name="TransactionList"
              component={TransactionListScreen}
              options={{
                title: t.navigation.transactions,
                headerRight: () => <LogoutButton />,
              }}
            />
            <Stack.Screen
              name="TransactionDetail"
              component={TransactionDetailScreen}
              options={{ title: t.navigation.transactionDetail }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/**
 * Logout button component
 */
const LogoutButton: React.FC = () => {
  const { colors } = useAppTheme();
  const authService = AuthService.getInstance();

  const handleLogout = async () => {
    await authService.logout();
  };

  return (
    <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
      <Text style={[styles.logoutText, { color: colors.primary }]}>Logout</Text>
    </TouchableOpacity>
  );
};

// Import missing components
import { TouchableOpacity, Text } from 'react-native';

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
  },
});