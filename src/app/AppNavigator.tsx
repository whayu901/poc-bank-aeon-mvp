import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useTranslation } from '@/i18n';
import { TransactionDetailScreen } from '@/screens/TransactionDetailScreen';
import { TransactionListScreen } from '@/screens/TransactionListScreen';
import { useAppTheme } from '@/theme/useAppTheme';
import type { RootStackParamList } from '@/types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { colors, colorScheme } = useAppTheme();
  const { t } = useTranslation();

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
      }}>
      <Stack.Navigator
        initialRouteName="TransactionList"
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '700' },
        }}>
        <Stack.Screen
          name="TransactionList"
          component={TransactionListScreen}
          options={{ title: t.navigation.transactions }}
        />
        <Stack.Screen
          name="TransactionDetail"
          component={TransactionDetailScreen}
          options={{ title: t.navigation.transactionDetail }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
