import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CalculatorScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const lastTap = useRef(0);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;
  const scale = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    const checkSessionAndNavigate = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const role = await AsyncStorage.getItem('userRole');
        const userIdStr = await AsyncStorage.getItem('userId');

        if (token && userIdStr) {
          const userId = parseInt(userIdStr, 10);
          navigation.reset({
            index: 0,
            routes: [{ name: 'CompanyListScreen' as any, params: { token, role: role || '', userId } }],
          });
          return;
        }
      } catch (e) {
        console.error('Session check error:', e);
      }
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' as any }],
      });
    };

    const timer = setTimeout(() => {
      checkSessionAndNavigate();
    }, 2500);

    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 14,
          stiffness: 90,
          mass: 1,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 12,
          stiffness: 80,
          mass: 1,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    return () => clearTimeout(timer);
  }, [navigation, opacity, translateY, scale]);

  const handleDoubleTap = async () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const role = await AsyncStorage.getItem('userRole');
        const userIdStr = await AsyncStorage.getItem('userId');

        if (token && userIdStr) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'CompanyListScreen' as any, params: { token, role: role || '', userId: parseInt(userIdStr, 10) } }],
          });
          return;
        }
      } catch (e) {}
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' as any }],
      });
    } else {
      lastTap.current = now;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#044E3A', '#057A55', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <TouchableOpacity
          style={styles.logoArea}
          onPress={handleDoubleTap}
          activeOpacity={1}
        >
          <Animated.View style={[styles.cardContainer, { opacity, transform: [{ translateY }, { scale }] }]}>
            <View style={styles.logoCircle}>
              <Image
                source={require('./tech-alphonic.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appSubtitle}>Secure Business & Messaging Portal</Text>
          </Animated.View>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  logoArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: Platform.OS === 'ios' ? 60 : 40,
  },
  cardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  logoCircle: {
    width: 200,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: 24,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  appSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.2,
  },
});
