import React, { useRef, useEffect } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';

export default function CalculatorScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const lastTap = useRef(0);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;
  const scale = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.navigate('Login');
    }, 3000);

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

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
      navigation.navigate('Login');
    } else {
      lastTap.current = now;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <TouchableOpacity
        style={styles.logoArea}
        onPress={handleDoubleTap}
        activeOpacity={1}
      >
        <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
          <Image
            source={require('./tech-alphonic.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  logoArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: Platform.OS === 'ios' ? 60 : 40,
  },
  logo: {
    width: '100%',
    maxWidth: 360,
    aspectRatio: 2.2,
  },
});
