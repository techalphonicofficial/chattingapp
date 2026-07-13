import React, { useState } from 'react';
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
      formData.append('role', role);

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
        colors={['#F7F8FA', '#EFF2F6']}
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
                  <TouchableOpacity style={styles.avatarContainer} onPress={pickProfileImage}>
                    {profileImage ? (
                      <Image source={{ uri: profileImage.uri }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <MaterialIcons name="add-a-photo" size={32} color="#999" />
                        <Text style={styles.avatarText}>Profile Photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.fieldLabel}>Display Name</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your Name"
                      placeholderTextColor="#999"
                      value={name}
                      onChangeText={setName}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>User ID</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your User ID"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      value={userId}
                      onChangeText={setUserId}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>Passkey</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your Passkey"
                      placeholderTextColor="#999"
                      secureTextEntry
                      value={passkey}
                      onChangeText={setPasskey}
                    />
                  </View>

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

                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleRegister}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.buttonText}>Register</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.loginBtn}>
                    <Text style={styles.loginBtnText}>Already have an account? <Text style={styles.loginBtnHighlight}>Login</Text></Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>Secure End-to-End Encrypted Chat</Text>
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
  content: { padding: 30, flex: 1, justifyContent: 'space-between' },
  headerArea: { marginTop: 40, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#111827', marginBottom: 10 },
  subtitle: { fontSize: 16, color: 'rgba(17,24,39,0.7)', textAlign: 'center', lineHeight: 22 },
  inputCard: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarContainer: { alignItems: 'center', marginBottom: 15 },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1.5, borderColor: '#ccc' },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  avatarText: { fontSize: 11, color: '#999', marginTop: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 10 },
  inputWrapper: { borderBottomWidth: 2, borderBottomColor: '#eee', marginBottom: 10, paddingHorizontal: 5 },
  input: { width: '100%', fontSize: 16, paddingVertical: 10, color: '#000', fontWeight: '500' },
  roleContainer: { flexDirection: 'row', backgroundColor: '#f0f0f0', borderRadius: 25, padding: 4, marginBottom: 10, marginTop: 4 },
  roleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 20 },
  roleBtnActive: { backgroundColor: '#1E293B' },

  roleBtnText: { color: '#666', fontWeight: 'bold', fontSize: 14 },
  roleBtnTextActive: { color: '#fff' },
  button: { backgroundColor: '#1E293B', padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 15 },

  buttonDisabled: { backgroundColor: '#CBD5E1' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  loginBtn: { marginTop: 20, alignItems: 'center' },
  loginBtnText: { color: '#475569', fontWeight: '500', fontSize: 14 },
  loginBtnHighlight: { color: '#1E293B', fontWeight: '700' },

  footer: { alignItems: 'center', marginBottom: 20 },
  footerText: { color: 'rgba(17,24,39,0.55)', fontSize: 12 },
});

export default RegisterScreen;
