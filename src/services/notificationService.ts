import {
  getMessaging,
  requestPermission,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  onTokenRefresh,
  AuthorizationStatus,
  RemoteMessage,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const messaging = getMessaging();

/**
 * Request notification permissions (including Android 13+ POST_NOTIFICATIONS)
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.warn('⚠️ Android 13+ POST_NOTIFICATIONS permission denied');
        return false;
      }
    }

    const authStatus = await requestPermission(messaging);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    console.log('Firebase notification authorization status:', authStatus, 'Enabled:', enabled);
    return enabled;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Get device FCM token for sending push notifications from your backend server
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    // Request permission (non-blocking for token generation)
    try {
      await requestNotificationPermission();
    } catch (e) {
      console.warn('Permission request error (proceeding to get token):', e);
    }

    const token = await getToken(messaging);
    if (token) {
      console.log('\n======================================================');
      console.log('🔥 FIREBASE FCM DEVICE TOKEN 🔥');
      console.log(token);
      console.log('======================================================\n');

      try {
        await AsyncStorage.setItem('fcm_token', token);
      } catch (e) {
        // ignore
      }
    } else {
      console.warn('⚠️ FCM Token returned empty');
    }
    return token;
  } catch (error) {
    console.error('❌ Error getting FCM token:', error);
    return null;
  }
}

/**
 * Set up foreground & background notification listeners
 */
export function setupNotificationListeners(
  onMessageReceived?: (message: RemoteMessage) => void,
  onNotificationOpened?: (message: RemoteMessage) => void
) {
  // 1. Foreground message handler (when app is open and active)
  const unsubscribeOnMessage = onMessage(messaging, (remoteMessage: RemoteMessage) => {
    console.log('FCM Foreground message received:', remoteMessage);
    if (onMessageReceived) {
      onMessageReceived(remoteMessage);
    } else {
      if (remoteMessage.notification) {
        Alert.alert(
          remoteMessage.notification.title || 'New Message',
          remoteMessage.notification.body || ''
        );
      }
    }
  });

  // 2. Notification opened from background state
  const unsubscribeOnNotificationOpened = onNotificationOpenedApp(
    messaging,
    (remoteMessage: RemoteMessage) => {
      console.log('Notification opened from background:', remoteMessage);
      if (onNotificationOpened) {
        onNotificationOpened(remoteMessage);
      }
    }
  );

  // 3. Notification opened from quit state
  getInitialNotification(messaging).then((remoteMessage) => {
    if (remoteMessage) {
      console.log('Notification opened from quit state:', remoteMessage);
      if (onNotificationOpened) {
        onNotificationOpened(remoteMessage);
      }
    }
  });

  // 4. Token refresh listener
  const unsubscribeTokenRefresh = onTokenRefresh(messaging, (token: string) => {
    console.log('FCM Token refreshed:', token);
  });

  return () => {
    unsubscribeOnMessage();
    unsubscribeOnNotificationOpened();
    unsubscribeTokenRefresh();
  };
}
