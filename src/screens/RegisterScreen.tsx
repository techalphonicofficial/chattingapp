import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const REGISTER_API = 'https://yber.in/api/auth/register';

const RegisterScreen = () => {
  const navigation = useNavigation<any>();
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [passkey, setPasskey] = useState('');
  const [role, setRole] = useState('employee');
  const [profileImage, setProfileImage] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Logged-in user's role/token. Only an admin may pick a role; everyone else registers as employee.
  const [isAdmin, setIsAdmin] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [storedRole, storedToken] = await Promise.all([
          AsyncStorage.getItem('userRole'),
          AsyncStorage.getItem('userToken'),
        ]);
        setIsAdmin(storedRole === 'admin');
        setAuthToken(storedToken);
      } catch (e) {
        setIsAdmin(false);
      }
    })();
  }, []);

  const pickProfileImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1 });
    if (result.assets && result.assets.length > 0) {
      setProfileImage(result.assets[0]);
    }
  };

  const handleRegister = async () => {
    if (userId.trim().length === 0 || passkey.trim().length === 0 || name.trim().length === 0) {
      Alert.alert('Validation', 'Please enter User ID, Name and Passkey.');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('user_id', userId.trim());
      formData.append('name', name.trim());
      formData.append('passkey', passkey.trim());
      formData.append('role', isAdmin ? role : 'employee');

      if (profileImage) {
        formData.append('profile_image', {
          uri: profileImage.uri,
          type: profileImage.type,
          name: profileImage.fileName || 'profile_image.jpg',
        });
      }

      const response = await fetch(REGISTER_API, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          // backend allows creating an admin only when the request carries an admin token
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: formData,
      });

      const data = await response.json();

      if (data.status === true) {
        Alert.alert('Success', data.message || 'User registered successfully!', [
          { text: 'Login Now', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', data.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server. Please check your internet connection.');
    } finally {
      setLoading(false);
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
          <KeyboardAvoidingView 
            enabled={true}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 80}
            style={{ flex: 1 }}
          >
            <ScrollView 
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.content}>
                <View style={styles.headerArea}>
                  <Text style={styles.title}>Create Account</Text>
                  <Text style={styles.subtitle}>Register to start chatting securely</Text>
                </View>

                <View style={styles.inputCard}>
                  <TouchableOpacity style={styles.avatarContainer} onPress={pickProfileImage} activeOpacity={0.8}>
                    {profileImage ? (
                      <View style={styles.avatarWrap}>
                        <Image source={{ uri: profileImage.uri }} style={styles.avatarImage} />
                        <View style={styles.cameraBadge}>
                          <MaterialIcons name="edit" size={14} color="#FFF" />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <MaterialIcons name="add-a-photo" size={28} color="#057A55" />
                        <Text style={styles.avatarText}>Add Photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.fieldLabel}>Display Name</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons name="person-outline" size={20} color="#057A55" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your Name"
                      placeholderTextColor="#94A3B8"
                      value={name}
                      onChangeText={setName}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>User ID</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons name="badge" size={20} color="#057A55" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your User ID"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      value={userId}
                      onChangeText={setUserId}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Passkey</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialIcons name="lock-outline" size={20} color="#057A55" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your Passkey"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry
                      value={passkey}
                      onChangeText={setPasskey}
                    />
                  </View>

                  {/* Role choice is shown only to admins */}
                  {isAdmin && (<>
                  <Text style={styles.fieldLabel}>Role</Text>
                  <View style={styles.roleContainer}>
                    <TouchableOpacity
                      style={[styles.roleBtn, role === 'employee' && styles.roleBtnActive]}
                      onPress={() => setRole('employee')}
                    >
                      <Text style={[styles.roleBtnText, role === 'employee' && styles.roleBtnTextActive]}>Employee</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleBtn, role === 'admin' && styles.roleBtnActive]}
                      onPress={() => setRole('admin')}
                    >
                      <Text style={[styles.roleBtnText, role === 'admin' && styles.roleBtnTextActive]}>Admin</Text>
                    </TouchableOpacity>
                  </View>
                  </>)}

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleRegister}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>Register Now</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.loginBtn}>
                    <Text style={styles.loginBtnText}>Already have an account? <Text style={styles.loginBtnHighlight}>Login</Text></Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>Secure End-to-End Encrypted IAS Portal</Text>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: 20, flex: 1, justifyContent: 'space-between' },
  headerArea: { marginTop: 24, marginBottom: 16, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center' },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  avatarContainer: { alignItems: 'center', marginBottom: 16 },
  avatarWrap: { position: 'relative' },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#057A55' },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#057A55', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
  avatarText: { fontSize: 11, color: '#057A55', fontWeight: '600', marginTop: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 10 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, height: 48, marginBottom: 4 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#0F172A', fontWeight: '500' },
  roleContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 4, marginTop: 4, marginBottom: 12 },
  roleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  roleBtnActive: { backgroundColor: '#057A55' },

  roleBtnText: { color: '#64748B', fontWeight: '600', fontSize: 14 },
  roleBtnTextActive: { color: '#FFFFFF' },
  button: { backgroundColor: '#057A55', height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },

  buttonDisabled: { backgroundColor: '#CBD5E1' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  loginBtn: { marginTop: 16, alignItems: 'center' },
  loginBtnText: { color: '#64748B', fontWeight: '500', fontSize: 14 },
  loginBtnHighlight: { color: '#057A55', fontWeight: '700' },

  footer: { alignItems: 'center', marginVertical: 16 },
  footerText: { color: 'rgba(255, 255, 255, 0.75)', fontSize: 12 },
});

export default RegisterScreen;
