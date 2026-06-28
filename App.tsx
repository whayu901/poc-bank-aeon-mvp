import 'react-native-gesture-handler';

import React from 'react';
import { StatusBar } from 'expo-status-bar';

import { AuthNavigator } from '@/app/AuthNavigator';

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <AuthNavigator />
    </>
  );
}
