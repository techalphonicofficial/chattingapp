import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

// Lets code outside screens (e.g. notification taps) navigate
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
