import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Dimensions, Alert, ActivityIndicator, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const LOGIN_API = 'https://yber.in/api/auth/login';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Mobile, 2: Passkey
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    if (step === 1) {
      if (mobile.trim().length > 0) {
        setStep(2);
      }
    } else {
      // Login via API
      try {
        setLoading(true);
        const response = await fetch(LOGIN_API, {
          method: 'POST',
          headers: {
            'accept': '*/*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: mobile,
            passkey: otp,
          }),
        });

        const data = await response.json();

        if (response.ok && data.status === true) {
          // Store user session for persistent auto-login
          try {
            await AsyncStorage.setItem('userToken', data.token);
            await AsyncStorage.setItem('userRole', data.role || '');
            await AsyncStorage.setItem('userId', String(data.id));
          } catch (e) {
            console.error('Failed to save session:', e);
          }
          navigation.reset({
            index: 0,
            routes: [{ name: 'CompanyListScreen', params: { token: data.token, role: data.role, userId: data.id } }],
          });
        } else {
          Alert.alert('Error', data.message || 'Login failed. Please check your credentials.');
          setOtp('');
        }
      } catch (error) {
        Alert.alert('Network Error', 'Could not connect to the server. Please check your internet connection.');
        setOtp('');
      } finally {
        setLoading(false);
      }
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
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <View style={styles.headerArea}>
              <View style={styles.logoContainer}>
                <Image source={require('./techalphonic_logo.png')} style={styles.logoImage} resizeMode="contain" />
              </View>
              <Text style={styles.title}>{step === 1 ? 'Welcome Back' : 'Enter Passkey'}</Text>
              <Text style={styles.subtitle}>
                {step === 1 
                  ? 'Sign in to access your workspace' 
                  : `Enter security passkey for ${mobile}`}
              </Text>
            </View>

            <View style={styles.inputCard}>
              <View style={styles.inputWrapper}>
                <MaterialIcons 
                  name={step === 1 ? "account-circle" : "lock-outline"} 
                  size={24} 
                  color="#057A55" 
                  style={styles.inputIcon} 
                />
                <TextInput
                  style={styles.input}
                  placeholder={step === 1 ? 'Enter User ID' : 'Enter Passkey'}
                  placeholderTextColor="#94A3B8"
                  keyboardType="default"
                  secureTextEntry={step === 2}
                  value={step === 1 ? mobile : otp}
                  onChangeText={step === 1 ? setMobile : setOtp}
                  maxLength={step === 1 ? 20 : 15}
                  autoFocus
                />
              </View>

              <TouchableOpacity 
                activeOpacity={0.8}
                style={[
                  styles.button,
                  ((step === 1 && mobile.trim().length === 0) || (step === 2 && otp.trim().length === 0) || loading) && styles.buttonDisabled
                ]} 
                onPress={handleAction}
                disabled={(step === 1 && mobile.trim().length === 0) || (step === 2 && otp.trim().length === 0) || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>{step === 1 ? 'Next' : 'Unlock Workspace'}</Text>
                )}
              </TouchableOpacity>

              {step === 2 && (
                <TouchableOpacity onPress={() => setStep(1)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Change User ID</Text>
                </TouchableOpacity>
              )}

              {step === 1 && (
                <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.registerLink}>
                  <Text style={styles.registerLinkText}>Don't have an account? <Text style={styles.registerLinkHighlight}>Register</Text></Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.footer}>
              <View style={styles.badgeRow}>
                <MaterialIcons name="security" size={14} color="rgba(255, 255, 255, 0.7)" />
                <Text style={styles.footerText}> End-to-End Encrypted IAS Portal</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: 24, flex: 1, justifyContent: 'space-between' },
  headerArea: { marginTop: 40, alignItems: 'center' },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
    padding: 12,
  },
  logoImage: { width: '100%', height: '100%' },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  inputCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 24, 
    padding: 24, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    paddingHorizontal: 14,
    height: 56,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#0F172A', fontWeight: '600' },
  button: { 
    backgroundColor: '#057A55', 
    height: 54, 
    borderRadius: 14, 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#057A55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  buttonDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0, elevation: 0 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  editBtn: { marginTop: 16, alignItems: 'center' },
  editBtnText: { color: '#057A55', fontWeight: '600', fontSize: 14 },

  footer: { alignItems: 'center', marginBottom: 12 },
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  footerText: { color: 'rgba(255, 255, 255, 0.75)', fontSize: 12, fontWeight: '500' },
  registerLink: { marginTop: 18, alignItems: 'center' },
  registerLinkText: { color: '#64748B', fontSize: 14 },
  registerLinkHighlight: { color: '#057A55', fontWeight: '700' },
});

export default LoginScreen;