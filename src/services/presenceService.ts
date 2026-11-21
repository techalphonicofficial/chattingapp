import { AppState, AppStateStatus } from 'react-native';
import { Socket } from 'socket.io-client';
import { formatLastSeen } from '../utils/time';

// What the backend sends in the 'user_status' event and in the 'get_user_status' reply
export type UserStatus = {
  user_id: number;
  is_online: boolean;
  last_seen: string | null;
};

// The users API sends is_online as 0/1 (MySQL), the socket sends true/false
export const isOnline = (value: any): boolean => value === true || value === 1 || value === '1';

// Line under a contact's name: "Online", "last seen today at 5:28 PM", or "Offline" when unknown
export const statusText = (online: any, lastSeen: any): string => {
  if (isOnline(online)) return 'Online';
  return formatLastSeen(lastSeen) || 'Offline';
};

// Tells the server when this app goes to the background / comes back, so other people see us
// as online only while the app is really open. Returns a function that stops reporting.
export const reportAppPresence = (socket: Socket): (() => void) => {
  const send = (state: AppStateStatus) => {
    if (socket.connected) socket.emit('set_presence', state !== 'background');
  };

  // A socket that (re)connects while the app is in the background must not count as online
  const onConnect = () => {
    if (AppState.currentState === 'background') send('background');
  };

  socket.on('connect', onConnect);
  const subscription = AppState.addEventListener('change', send);

  return () => {
    subscription.remove();
    socket.off('connect', onConnect);
  };
};
