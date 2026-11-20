import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'react-native';
import {
  getFCMToken,
  setupNotificationListeners,
} from './src/services/notificationService';

export default function App() {
  useEffect(() => {
    // Ask notification permission + create the FCM token.
    // It is sent to the backend after login (CompanyListScreen).
    getFCMToken();

    // Listen for incoming notifications / notification taps / token refresh
    const unsubscribe = setupNotificationListeners();
    return () => {
      unsubscribe?.();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}


