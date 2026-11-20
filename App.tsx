import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { StatusBar } from 'react-native';
import {
  requestNotificationPermission,
  getFCMToken,
  setupNotificationListeners,
} from './src/services/notificationService';

export default function App() {
  useEffect(() => {
    // Generate FCM device token & print to console
    getFCMToken();

    // Listen for incoming notifications
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


