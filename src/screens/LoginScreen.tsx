import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, Dimensions, Alert, ActivityIndicator, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import LinearGradient from 'react-native-linear-gradient';

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
          // data.token, data.id, data.user_id available here
          navigation.navigate('CompanyListScreen', { token: data.token, role: data.role, userId: data.id });
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
        colors={['#0A2540', '#0052CC', '#4F46E5', '#06B6D4']}
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
              <Text style={styles.title}>{step === 1 ? 'Welcome Back' : 'Secure Passkey'}</Text>
              <Text style={styles.subtitle}>
                {step === 1 
                  ? 'Enter your User ID to continue' 
                  : `Enter the passkey for ${mobile}`}
              </Text>
            </View>

            <View style={styles.inputCard}>
              <View style={styles.inputWrapper}>
                {/* {step === 1 && <Text style={styles.prefix}>+91 </Text>} */}
                <TextInput
                  style={styles.input}
                  placeholder={step === 1 ? 'User ID' : 'Enter Passkey'}
                  placeholderTextColor="#999"
                  keyboardType="default"
                  secureTextEntry={step === 2}
                  value={step === 1 ? mobile : otp}
                  onChangeText={step === 1 ? setMobile : setOtp}
                  maxLength={step === 1 ? 20 : 10}
                  autoFocus
                />
              </View>

              <TouchableOpacity 
                style={[
                  styles.button,
                  ((step === 1 && mobile.trim().length === 0) || (step === 2 && otp.trim().length === 0) || loading) && styles.buttonDisabled
                ]} 
                onPress={handleAction}
                disabled={(step === 1 && mobile.trim().length === 0) || (step === 2 && otp.trim().length === 0) || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{step === 1 ? 'Get Started' : 'Unlock Chat'}</Text>
                )}
              </TouchableOpacity>

              {step === 2 && (
                <TouchableOpacity onPress={() => setStep(1)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit User ID</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.footer}>
              <Text style={styles.footerText}>Secure End-to-End Encrypted Chat</Text>
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
  content: { padding: 30, flex: 1, justifyContent: 'space-between' },
  headerArea: { marginTop: 60, alignItems: 'center' },
  logoContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    padding: 15,
  },
  logoImage: { width: '100%', height: '100%' },
  title: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', marginBottom: 10 },
  subtitle: { fontSize: 16, color: 'rgba(255, 255, 255, 0.85)', textAlign: 'center', lineHeight: 22 },
  inputCard: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 25, 
    padding: 25, 
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#eee',
    marginBottom: 30,
    paddingHorizontal: 5
  },
  prefix: { fontSize: 20, fontWeight: '600', color: '#333' },
  input: { flex: 1, fontSize: 20, paddingVertical: 15, color: '#000', fontWeight: '500' },
  button: { backgroundColor: '#1E293B', padding: 18, borderRadius: 15, alignItems: 'center' },

  buttonDisabled: { backgroundColor: '#CBD5E1' },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  editBtn: { marginTop: 20, alignItems: 'center' },
  editBtnText: { color: '#475569', fontWeight: '600' },

  footer: { alignItems: 'center', marginBottom: 20 },
  footerText: { color: 'rgba(255, 255, 255, 0.75)', fontSize: 12 },
  registerLink: { marginTop: 12 },
  registerLinkText: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  registerLinkHighlight: { color: '#fff', fontWeight: '700' },
});

export default LoginScreen;