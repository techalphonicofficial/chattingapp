import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';

const SetPinScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [pin, setPin] = useState('');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.title}>Set App PIN</Text>
          <Text style={styles.subtitle}>This PIN will be used to unlock your app via the calculator.</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter 4 digit PIN"
            placeholderTextColor="#999"
            keyboardType="numeric"
            secureTextEntry
            maxLength={4}
            value={pin}
            onChangeText={setPin}
          />

          <TouchableOpacity 
            style={[styles.button, { opacity: pin.length === 4 ? 1 : 0.5 }]} 
            disabled={pin.length !== 4}
            onPress={onComplete}
          >
            <Text style={styles.buttonText}>Save PIN</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 30, flex: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#000' },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 30 },
  input: { borderBottomWidth: 2, borderBottomColor: '#0052CC', fontSize: 20, paddingVertical: 10, marginBottom: 40, textAlign: 'center', color: '#000' },

  button: { backgroundColor: '#0052CC', padding: 15, borderRadius: 10, alignItems: 'center' },

  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

export default SetPinScreen;
