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
import { CHAT_API_BASE } from '../config/api';
import { navigationRef } from '../navigation/navigationRef';

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
 * Get device FCM token (also asks for notification permission)
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    try {
      await requestNotificationPermission();
    } catch (e) {
      console.warn('Permission request error (proceeding to get token):', e);
    }

    const token = await getToken(messaging);
    if (token) {
      console.log('🔥 FCM device token:', token);
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

// ─── Backend registration ────────────────────────────────────────────────────
// The backend sends a push to every token saved for a user, so each logged-in
// phone must register its token. Called after login/auto-login and on token refresh.

const postToken = async (authToken: string, fcmToken: string) => {
  const response = await fetch(`${CHAT_API_BASE}/auth/fcm-token`, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ token: fcmToken, platform: Platform.OS }),
  });
  if (!response.ok) {
    throw new Error(`FCM token register failed (${response.status})`);
  }
};

export async function registerTokenWithBackend(authToken: string): Promise<void> {
  try {
    if (!authToken) return;
    const fcmToken = await getFCMToken();
    if (!fcmToken) return;
    await postToken(authToken, fcmToken);
    console.log('✅ FCM token registered with backend');
  } catch (error) {
    console.warn('FCM token registration error:', error);
  }
}

// Call BEFORE clearing the session on logout, so this phone stops getting that user's pushes
export async function unregisterTokenFromBackend(authToken: string): Promise<void> {
  try {
    const fcmToken = await AsyncStorage.getItem('fcm_token');
    if (!authToken || !fcmToken) return;
    await fetch(`${CHAT_API_BASE}/auth/fcm-token`, {
      method: 'DELETE',
      headers: {
        accept: '*/*',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: fcmToken }),
    });
  } catch (error) {
    console.warn('FCM token unregister error:', error);
  }
}

// ─── Open chat currently on screen (no popup for the chat you are already reading) ──
let activeChatUserId: string | null = null;

export function setActiveChatUser(userId: number | string | null) {
  activeChatUserId = userId === null || userId === undefined ? null : String(userId);
}

// ─── Opening a chat from a notification tap ──────────────────────────────────
// If the app is still on the splash/login screen, the chat is opened later by
// CompanyListScreen through consumePendingNotification().
let pendingChatMessage: RemoteMessage | null = null;

const READY_ROUTES_BLOCKLIST = ['Calculator', 'Login', 'Register'];

async function openChatFromNotification(remoteMessage: RemoteMessage | null): Promise<boolean> {
  const data: any = remoteMessage?.data;
  if (!data || data.type !== 'chat_message' || !data.sender_id) return false;

  const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
  if (!currentRoute || READY_ROUTES_BLOCKLIST.includes(currentRoute)) {
    pendingChatMessage = remoteMessage;
    return false;
  }

  const [token, userIdStr] = await Promise.all([
    AsyncStorage.getItem('userToken'),
    AsyncStorage.getItem('userId'),
  ]);
  if (!token || !userIdStr) {
    pendingChatMessage = remoteMessage;
    return false;
  }

  const roomId = data.room_id ? (/^\d+$/.test(data.room_id) ? Number(data.room_id) : data.room_id) : null;
  navigationRef.navigate('Chat', {
    contact: {
      id: Number(data.sender_id),
      name: data.sender_name || undefined,
      user_id: data.sender_user_id || undefined,
      profile_image: data.sender_image || undefined,
    },
    token,
    userId: parseInt(userIdStr, 10),
    room: roomId !== null ? { id: roomId } : null,
  });
  return true;
}

/**
 * Opens the chat of a notification that was tapped while the app was starting up.
 * Call once the user is logged in and inside the app (CompanyListScreen).
 */
export async function consumePendingNotification(): Promise<void> {
  if (!pendingChatMessage) return;
  const msg = pendingChatMessage;
  pendingChatMessage = null;
  await openChatFromNotification(msg);
}

/**
 * Set up foreground, background-tap, quit-tap and token-refresh listeners
 */
export function setupNotificationListeners() {
  // 1. Foreground: Android shows nothing by itself, so show an in-app popup
  const unsubscribeOnMessage = onMessage(messaging, (remoteMessage: RemoteMessage) => {
    console.log('FCM Foreground message received:', remoteMessage);
    const data: any = remoteMessage.data || {};

    // Already looking at this conversation -> the message appears in the chat, no popup
    if (data.type === 'chat_message' && activeChatUserId && String(data.sender_id) === activeChatUserId) {
      return;
    }

    if (remoteMessage.notification) {
      const buttons: any[] = [{ text: 'Close', style: 'cancel' }];
      if (data.type === 'chat_message') {
        buttons.push({ text: 'Open', onPress: () => openChatFromNotification(remoteMessage) });
      }
      Alert.alert(
        remoteMessage.notification.title || 'New Message',
        remoteMessage.notification.body || '',
        buttons
      );
    }
  });

  // 2. Notification tapped while the app was in the background
  const unsubscribeOnNotificationOpened = onNotificationOpenedApp(
    messaging,
    (remoteMessage: RemoteMessage) => {
      console.log('Notification opened from background:', remoteMessage);
      openChatFromNotification(remoteMessage);
    }
  );

  // 3. Notification tapped while the app was closed: splash is still showing,
  //    so this is stored and opened by CompanyListScreen after auto-login
  getInitialNotification(messaging).then((remoteMessage) => {
    if (remoteMessage) {
      console.log('Notification opened from quit state:', remoteMessage);
      pendingChatMessage = remoteMessage;
    }
  });

  // 4. Token refresh: save the new token on the backend for the logged-in user
  const unsubscribeTokenRefresh = onTokenRefresh(messaging, async (newToken: string) => {
    console.log('FCM Token refreshed');
    try {
      await AsyncStorage.setItem('fcm_token', newToken);
      const authToken = await AsyncStorage.getItem('userToken');
      if (authToken) await postToken(authToken, newToken);
    } catch (e) {
      console.warn('FCM token refresh register error:', e);
    }
  });

  return () => {
    unsubscribeOnMessage();
    unsubscribeOnNotificationOpened();
    unsubscribeTokenRefresh();
  };
}
