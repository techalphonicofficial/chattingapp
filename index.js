/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Register background handler for FCM
setBackgroundMessageHandler(getMessaging(), async (remoteMessage) => {
  console.log('FCM Message handled in the background:', remoteMessage);
});

AppRegistry.registerComponent(appName, () => App);
