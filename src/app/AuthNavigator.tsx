import { useTranslation } from "@/i18n";
import { BiometricLockScreen } from "@/screens/login/BiometricLockScreen";
import { LoginScreen } from "@/screens/login/LoginScreen";
import { TransactionDetailScreen } from "@/screens/TransactionDetailScreen";
import { TransactionListScreen } from "@/screens/TransactionListScreen";
import { AppInitializer } from "@/services/AppInitializer";
import { AuthService } from "@/services/AuthService";
import { useAuthState } from "@/store/authStore";
import { useAppTheme } from "@/theme/useAppTheme";
import type { RootStackParamList } from "@/types/navigation";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const Stack = createNativeStackNavigator<
  RootStackParamList & { Login: undefined; BiometricLock: undefined }
>();

/**
 * Auth-aware navigation container
 * Routes users based on authentication state
 */
export function AuthNavigator() {
  const { colors, colorScheme } = useAppTheme();
  const { t } = useTranslation();
  const authState = useAuthState();
  const [isInitializing, setIsInitializing] = React.useState(true);

  // Initialize all app services on mount
  useEffect(() => {
    let isMounted = true;

    const initApp = async () => {
      try {
        await AppInitializer.initialize();
        if (isMounted) {
          setIsInitializing(false);
        }
      } catch (error) {
        console.error("[AuthNavigator] Failed to initialize app:", error);
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    initApp();

    return () => {
      isMounted = false;
    };
  }, []);

  // Show loading while checking auth state
  if (isInitializing) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: colorScheme === "dark",
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.background,
          text: colors.textPrimary,
          border: colors.border,
          notification: colors.accent,
        },
        fonts: {
          regular: { fontFamily: "System", fontWeight: "400" },
          medium: { fontFamily: "System", fontWeight: "500" },
          bold: { fontFamily: "System", fontWeight: "700" },
          heavy: { fontFamily: "System", fontWeight: "800" },
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        {authState === "unauthenticated" && (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}

        {authState === "locked" && (
          <Stack.Screen
            name="BiometricLock"
            component={BiometricLockScreen}
            options={{ headerShown: false }}
          />
        )}

        {(authState === "authenticated" || authState === "authenticating") && (
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
const LogoutButton: React.FC = React.memo(() => {
  const { colors } = useAppTheme();

  const handleLogout = React.useCallback(async () => {
    const authService = AuthService.getInstance();
    await authService.logout();
  }, []);

  return (
    <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
      <Text style={[styles.logoutText, { color: colors.primary }]}>Logout</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
