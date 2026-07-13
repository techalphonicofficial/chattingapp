import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, Image, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { io, Socket } from 'socket.io-client';
import { RootStackParamList } from '../navigation/AppNavigator';

const SOCKET_URL = 'https://miya-unslumbery-hunter.ngrok-free.dev';

type ChatListRouteProp = RouteProp<RootStackParamList, 'ChatList'>;
type NavigationProp = StackNavigationProp<RootStackParamList, 'ChatList'>;

const ContactListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ChatListRouteProp>();
  const { token, userId, room, role } = route.params as any;

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // All Users Modal State
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allUsersModalVisible, setAllUsersModalVisible] = useState(false);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  
  // Room Creation State
  const [isModalVisible, setModalVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState('private');
  const [newRoomLogo, setNewRoomLogo] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Profile Update State
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileRole, setProfileRole] = useState('employee');
  const [profilePasskey, setProfilePasskey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);


  const socketRef = useRef<Socket | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch users silently (no loading spinner) for background refresh
  const fetchUsersSilent = useCallback(async () => {
    try {
      const baseUrl = 'https://yber.in/api/auth/users';
      const url = room?.id ? `${baseUrl}?room_id=${room.id}` : baseUrl;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'accept': '*/*', 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.status && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Silent fetch error:', error);
    }
  }, [token, room]);

  useEffect(() => {
    fetchUsers();

    // Connect socket to listen for new messages and update last_message in list
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('ContactList socket connected');
    });

    // When any message is received, update that user's last_message instantly
    socket.on('receive_message', (newMessage: any) => {
      setUsers(prev => {
        // Determine the other user's id in this conversation
        const otherId =
          String(newMessage.sender_id) === String(userId)
            ? String(newMessage.receiver_id)
            : String(newMessage.sender_id);

        const updated = prev.map(u => {
          if (String(u.id) === otherId) {
            return {
              ...u,
              last_message: newMessage.message || '',
              last_message_at: newMessage.created_at,
              last_message_status: newMessage.status || 'sent',
            };
          }
          return u;
        });
        // Sort: users with latest messages bubble to the top
        return [...updated].sort((a, b) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : new Date(a.created_at).getTime();
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : new Date(b.created_at).getTime();
          return bTime - aTime;
        });
      });
    });

    // Start polling every 10 seconds for last message updates
    pollingRef.current = setInterval(() => {
      fetchUsersSilent();
    }, 10000);

    return () => {
      socket.disconnect();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Refresh on screen focus (when coming back from a chat)
  useFocusEffect(
    useCallback(() => {
      fetchUsersSilent();
    }, [fetchUsersSilent])
  );

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const baseUrl = 'https://yber.in/api/auth/users';
      const url = room?.id ? `${baseUrl}?room_id=${room.id}` : baseUrl;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.status && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        Alert.alert('Error', 'Failed to fetch users');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong while fetching users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setLoadingAllUsers(true);
      setAllUsersModalVisible(true);
      const response = await fetch('https://yber.in/api/auth/all-users', {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.status && Array.isArray(data.users)) {
        setAllUsers(data.users);
      } else {
        Alert.alert('Error', 'Failed to fetch all users');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong while fetching all users');
    } finally {
      setLoadingAllUsers(false);
    }
  };

  const handleAddUserToRoom = async (targetUserId: number) => {
    if (!room?.id) {
      Alert.alert('Error', 'No room selected to add users to.');
      return;
    }

    try {
      const response = await fetch('https://yber.in/api/rooms/map', {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_id: room.id,
          user_id: targetUserId,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        Alert.alert('Success', 'User added to room successfully!');
      } else {
        Alert.alert('Info', data.error || data.message || 'Failed to add user to room');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong while adding user to room');
    }
  };

  const pickRoomLogo = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 1,
    });
    if (result.assets && result.assets.length > 0) {
      setNewRoomLogo(result.assets[0]);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) {
      Alert.alert('Error', 'Please enter a room name');
      return;
    }

    try {
      setIsCreating(true);
      const formData = new FormData();
      formData.append('room_name', newRoomName);
      formData.append('room_type', newRoomType);
      
      if (newRoomLogo) {
        formData.append('room_logo', {
          uri: newRoomLogo.uri,
          type: newRoomLogo.type,
          name: newRoomLogo.fileName || 'room_logo.jpg',
        });
      }

      const response = await fetch('https://yber.in/api/rooms/create', {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
          // Content-Type is handled automatically for FormData
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok || data.room_id) {
        Alert.alert('Success', 'Room created successfully');
        setModalVisible(false);
        setNewRoomName('');
        setNewRoomLogo(null);
        // Refresh users/rooms list if needed
        fetchUsers();
      } else {
        Alert.alert('Error', data.message || 'Failed to create room');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong while creating the room');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!profilePasskey.trim()) {
      Alert.alert('Error', 'Please enter a passkey');
      return;
    }

    try {
      setIsUpdating(true);
      const response = await fetch(`https://yber.in/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: profileName,
          role: profileRole,
          passkey: profilePasskey,
        }),
      });

      const data = await response.json();
      if (data.status) {
        Alert.alert('Success', data.message || 'User updated successfully');
        setProfileModalVisible(false);
      } else {
        Alert.alert('Error', data.message || 'Failed to update user');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong while updating profile');
    } finally {
      setIsUpdating(false);
    }
  };


  const renderUserItem = ({ item }: { item: any }) => {
    const formatTime = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      return isToday 
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const timeDisplay = item.last_message_at ? formatTime(item.last_message_at) : formatTime(item.created_at);

    return (
      <TouchableOpacity 
        style={styles.chatItem} 
        onPress={() => navigation.navigate('Chat', { contact: item, token, userId, room })}
      >
        <View style={styles.avatarPlaceholder}>
          {item.profile_image ? (
            <Image source={{ uri: item.profile_image }} style={styles.userImage} />
          ) : (
            <Text style={styles.avatarText}>
              {(item.name || item.user_id || 'U').charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.topRow}>
            <Text style={styles.name}>{item.name || item.user_id || 'Unknown'}</Text>
            <Text style={styles.time}>{timeDisplay}</Text>
          </View>
          <View style={styles.bottomRow}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.last_message_status === 'sent' && <MaterialIcons name="done-all" size={14} color="#34B7F1" />}
              {item.last_message_status === 'read' && <MaterialIcons name="done-all" size={14} color="#34B7F1" />}
              {item.last_message ? ` ${item.last_message}` : ''}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0052CC" />
      <View style={{ height: insets.top, backgroundColor: '#0052CC' }} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Users</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={fetchUsers}>
            <MaterialIcons name="search" size={24} color="#fff" />
          </TouchableOpacity>
          {role === 'admin' && (
            <TouchableOpacity style={styles.iconBtn} onPress={fetchAllUsers}>
              <MaterialIcons name="group-add" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={() => setProfileModalVisible(true)}>
            <MaterialIcons name="more-vert" size={24} color="#fff" />
          </TouchableOpacity>

        </View>
      </View>

      <View style={styles.searchBar}>
        <TextInput 
          placeholder="Search users..." 
          style={styles.searchInput}
          placeholderTextColor="#999"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0052CC" />

        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderUserItem}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          }
        />
      )}
      
      {/* Create Room Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Room</Text>
            
            <TouchableOpacity style={styles.logoPicker} onPress={pickRoomLogo}>
              {newRoomLogo ? (
                <Image source={{ uri: newRoomLogo.uri }} style={styles.pickedLogo} />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <MaterialIcons name="add-a-photo" size={30} color="#666" />
                  <Text style={styles.logoPlaceholderText}>Room Logo</Text>
                </View>
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.modalInput}
              placeholder="Room Name"
              value={newRoomName}
              onChangeText={setNewRoomName}
            />

            <View style={styles.typeContainer}>
              <TouchableOpacity 
                style={[styles.typeBtn, newRoomType === 'private' && styles.typeBtnActive]} 
                onPress={() => setNewRoomType('private')}
              >
                <Text style={[styles.typeBtnText, newRoomType === 'private' && styles.typeBtnTextActive]}>Private</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeBtn, newRoomType === 'public' && styles.typeBtnActive]} 
                onPress={() => setNewRoomType('public')}
              >
                <Text style={[styles.typeBtnText, newRoomType === 'public' && styles.typeBtnTextActive]}>Public</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.createBtn]} 
                onPress={handleCreateRoom}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.createBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Update Modal */}
      <Modal
        visible={profileModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Profile</Text>

            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter Name"
              placeholderTextColor="#999"
              value={profileName}
              onChangeText={setProfileName}
            />

            <Text style={styles.fieldLabel}>Passkey</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter Passkey"
              placeholderTextColor="#999"
              secureTextEntry
              value={profilePasskey}
              onChangeText={setProfilePasskey}
            />

            <Text style={styles.fieldLabel}>Role</Text>
            <View style={styles.typeContainer}>
              <TouchableOpacity 
                style={[styles.typeBtn, profileRole === 'employee' && styles.typeBtnActive]} 
                onPress={() => setProfileRole('employee')}
              >
                <Text style={[styles.typeBtnText, profileRole === 'employee' && styles.typeBtnTextActive]}>Employee</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.typeBtn, profileRole === 'admin' && styles.typeBtnActive]} 
                onPress={() => setProfileRole('admin')}
              >
                <Text style={[styles.typeBtnText, profileRole === 'admin' && styles.typeBtnTextActive]}>Admin</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]} 
                onPress={() => setProfileModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.createBtn]} 
                onPress={handleUpdateProfile}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.createBtnText}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* All Users Modal */}
      <Modal
        visible={allUsersModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAllUsersModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%', padding: 0 }]}>
            <View style={{ width: '100%', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>All Users</Text>
              <TouchableOpacity onPress={() => setAllUsersModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {loadingAllUsers ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#0052CC" />
              </View>
            ) : (
              <FlatList
                data={allUsers}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={[styles.chatItem, { width: '100%', paddingHorizontal: 15 }]}>
                    <View style={styles.avatarPlaceholder}>
                      {item.profile_image ? (
                        <Image source={{ uri: item.profile_image }} style={styles.userImage} />
                      ) : (
                        <Text style={styles.avatarText}>
                          {(item.name || item.user_id || 'U').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.chatInfo, { borderBottomWidth: 0, flex: 1 }]}>
                      <Text style={styles.name}>{item.name || item.user_id || 'Unknown'}</Text>
                      <Text style={styles.time}>Role: {item.role || 'employee'}</Text>
                    </View>
                    <TouchableOpacity 
                      style={{ padding: 10 }}
                      onPress={() => handleAddUserToRoom(item.id)}
                    >
                      <MaterialIcons name="person-add" size={24} color="#0052CC" />
                    </TouchableOpacity>
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.center}>
                    <Text style={styles.emptyText}>No users found</Text>
                  </View>
                }
                style={{ width: '100%' }}
              />
            )}
          </View>
        </View>
      </Modal>


      {/* <TouchableOpacity style={styles.fab}>
        <MaterialIcons name="chat" size={28} color="#fff" />
      </TouchableOpacity> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    padding: 15, 
    backgroundColor: '#0052CC', 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center' 
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerIcons: { flexDirection: 'row' },
  iconBtn: { marginLeft: 20 },
  iconText: { color: '#fff', fontSize: 20 },
  searchBar: { padding: 10, backgroundColor: '#0052CC' },

  searchInput: { 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    borderRadius: 20, 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    color: '#fff' 
  },
  chatItem: { flexDirection: 'row', padding: 15, alignItems: 'center' },
  avatarPlaceholder: { 
    width: 55, 
    height: 55, 
    borderRadius: 27.5, 
    backgroundColor: '#007AFF', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  userImage: { width: 55, height: 55, borderRadius: 27.5 },
  chatInfo: { flex: 1, marginLeft: 15, borderBottomWidth: 0.5, borderBottomColor: '#eee', paddingBottom: 15 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  name: { fontSize: 17, fontWeight: 'bold', color: '#000' },
  time: { fontSize: 12, color: '#666' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 14, color: '#666', flex: 1, marginRight: 10 },
  mobileText: { fontSize: 12, color: '#075E54', fontWeight: '500' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#666', fontSize: 16 },
  fab: { 
    position: 'absolute', 
    right: 20, 
    bottom: 20, 
    backgroundColor: '#3B82F6', 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3
  },
  fabText: { fontSize: 24 },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 15, padding: 20, width: '85%', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#0052CC' },

  fieldLabel: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 5 },

  logoPicker: { marginBottom: 20 },
  logoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#999' },
  logoPlaceholderText: { fontSize: 12, color: '#666', marginTop: 5 },
  pickedLogo: { width: 100, height: 100, borderRadius: 50 },
  modalInput: { width: '100%', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingVertical: 10, fontSize: 16, marginBottom: 20, color: '#000' },
  typeContainer: { flexDirection: 'row', marginBottom: 25, backgroundColor: '#f0f0f0', borderRadius: 25, padding: 4 },
  typeBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  typeBtnActive: { backgroundColor: '#0052CC' },

  typeBtnText: { color: '#666', fontWeight: 'bold' },
  typeBtnTextActive: { color: '#fff' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%' },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5, marginLeft: 10 },
  cancelBtn: { backgroundColor: '#eee' },
  createBtn: { backgroundColor: '#0052CC' },

  cancelBtnText: { color: '#666', fontWeight: 'bold' },
  createBtnText: { color: '#fff', fontWeight: 'bold' },
});

export default ContactListScreen;

