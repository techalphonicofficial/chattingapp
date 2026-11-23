import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';

import CalculatorScreen from '../screens/CalculatorScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ContactListScreen from '../screens/ContactListScreen';
import ChatScreen from '../screens/ChatScreen';
import CompanyListScreen from '../screens/CompanyListScreen';
import OrderListScreen from '../screens/OrderListScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';
import AdminChatsScreen from '../screens/AdminChatsScreen';
import AdminConversationScreen from '../screens/AdminConversationScreen';
import { navigationRef } from './navigationRef';

export type RootStackParamList = {
  Calculator: undefined;
  Login: undefined;
  Register: undefined;
  ChatList: { token: string; userId: number; room?: any };
  Chat: { contact: any; token: string; userId: number; room: any };
  CompanyListScreen: { token: string; role: string; userId: number };
  OrderList: { token: string };
  OrderDetail: { token: string; orderNumber: string };
  AdminChats: { token: string };
  AdminConversation: {
    token: string;
    user1: { id: number; name: string; image?: string };
    user2: { id: number; name: string; image?: string };
    roomId?: string | number | null;
    roomName?: string | null;
  };
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Calculator"
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="Calculator" component={CalculatorScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ChatList" component={ContactListScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="CompanyListScreen" component={CompanyListScreen} />
        <Stack.Screen name="OrderList" component={OrderListScreen} />
        <Stack.Screen name="OrderDetail" component={OrderDetailScreen} />
        <Stack.Screen name="AdminChats" component={AdminChatsScreen} />
        <Stack.Screen name="AdminConversation" component={AdminConversationScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
