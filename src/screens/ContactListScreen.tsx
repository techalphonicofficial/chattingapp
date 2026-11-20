import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, Image, TextInput, ActivityIndicator, Alert, Modal, Animated } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { io, Socket } from 'socket.io-client';
import { RootStackParamList } from '../navigation/AppNavigator';
import { CHAT_SERVER_URL } from '../config/api';
import { formatListTime, parseServerDate } from '../utils/time';

const BASE_URL = CHAT_SERVER_URL;
const SOCKET_URL = BASE_URL;

// Backend sends last_message_time; live socket updates set last_message_at. Use whichever exists.
const lastMessageTime = (u: any): number => {
  const d = parseServerDate(u?.last_message_at || u?.last_message_time);
  return d ? d.getTime() : 0;
};

// WhatsApp style: latest conversation first; users with no messages at the bottom, by name
const sortByLatestChat = (list: any[]) =>
  [...list].sort((a, b) => {
    const diff = lastMessageTime(b) - lastMessageTime(a);
    if (diff !== 0) return diff;
    return String(a.name || a.user_id || '').localeCompare(String(b.name || b.user_id || ''));
  });

type ChatListRouteProp = RouteProp<RootStackParamList, 'ChatList'>;
type NavigationProp = StackNavigationProp<RootStackParamList, 'ChatList'>;

const ContactListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ChatListRouteProp>();
  const { token, userId, room, role } = route.params as any;

  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Header animation
  const headerAnim = useRef(new Animated.Value(-60)).current;
  const listFadeAnim = useRef(new Animated.Value(0)).current;

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
  const [currentUser, setCurrentUser] = useState<any>(null);


  const socketRef = useRef<Socket | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch users silently (no loading spinner) for background refresh
  const fetchUsersSilent = useCallback(async () => {
    try {
      const baseUrl = `${BASE_URL}/api/auth/users`;
      const url = room?.id ? `${baseUrl}?room_id=${room.id}` : baseUrl;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'accept': '*/*', 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.status && Array.isArray(data.users)) {
        setUsers(sortByLatestChat(data.users));
      }
    } catch (error) {
      console.error('Silent fetch error:', error);
    }
  }, [token, room]);

  useEffect(() => {
    fetchUsers();

    // Header slide-down + list fade-in animation on mount
    Animated.parallel([
      Animated.spring(headerAnim, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(listFadeAnim, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Connect socket to listen for new messages and update last_message in list
    // The backend rejects sockets without a token, so it must be sent here too
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('ContactList socket connected');
    });

    // When any message is received, update that user's last_message instantly
    socket.on('receive_message', (newMessage: any) => {
      // Only update the list for messages of the company that is open
      if (room?.id && newMessage?.room_id != null && String(newMessage.room_id) !== String(room.id)) {
        return;
      }
      setUsers(prev => {
        // Determine the other user's id in this conversation
        const otherId =
          String(newMessage.sender_id) === String(userId)

            ? String(newMessage.receiver_id)
            : String(newMessage.sender_id);

        const preview =
          newMessage.message ||
          (newMessage.message_type === 'image' ? '📷 Photo' : newMessage.file_url ? '📎 Document' : '');
        const updated = prev.map(u => {
          if (String(u.id) === otherId) {
            return {
              ...u,
              last_message: preview,
              last_message_at: newMessage.created_at || new Date().toISOString(),
              last_message_status: newMessage.status || 'sent',
            };
          }
          return u;
        });
        // The chat that just got a message moves to the top
        return sortByLatestChat(updated);
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
      const baseUrl = `${BASE_URL}/api/auth/users`;
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
        setUsers(sortByLatestChat(data.users));
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
      const response = await fetch(`${BASE_URL}/api/auth/all-users`, {
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
      const response = await fetch(`${BASE_URL}/api/rooms/map`, {
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

      const response = await fetch(`${BASE_URL}/api/rooms/create`, {
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

  const fetchCurrentUser = async () => {
    try {
      // 1. Try fetching user details directly by user ID
      const response = await fetch(`${BASE_URL}/api/auth/users/${userId}`, {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      console.log('Fetched current user by ID:', data);

      const userObj = data.user || (data.status && data.user) || (data.id ? data : null);
      if (userObj && userObj.id) {
        setCurrentUser(userObj);
        setProfileName(userObj.name || '');
        setProfileRole(userObj.role || role || 'employee');
        return;
      }
    } catch (error) {
      console.error('Failed to fetch user by ID:', error);
    }

    // 2. Fallback: Fetch all users and find current user
    try {
      const response = await fetch(`${BASE_URL}/api/auth/users`, {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.status && Array.isArray(data.users)) {
        const found = data.users.find((u: any) => String(u.id) === String(userId));
        if (found) {
          setCurrentUser(found);
          setProfileName(found.name || '');
          setProfileRole(found.role || role || 'employee');
        }
      }
    } catch (error) {
      console.error('Failed fallback fetch for current user:', error);
    }
  };

  const openProfileModal = () => {
    setProfilePasskey('');
    fetchCurrentUser();
    setProfileModalVisible(true);
  };

  const handleUpdateProfile = async () => {
    if (!profilePasskey.trim()) {
      Alert.alert('Error', 'Please enter a passkey');
      return;
    }

    try {
      setIsUpdating(true);

      const body = {
        name: profileName,
        user_id: currentUser?.user_id || userId,
        mobile_number: currentUser?.mobile_number || "",
        profile_image: currentUser?.profile_image || "",
        passkey: profilePasskey,
        role: profileRole,
        can_view_previous_messages: currentUser?.can_view_previous_messages ?? 0
      };

      console.log('Updating profile with body:', JSON.stringify(body, null, 2));

      const response = await fetch(`${BASE_URL}/api/auth/users/${userId}`, {
        method: 'PUT',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      console.log('Profile Update Response:', responseText);

      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        Alert.alert('Server Error', 'The server returned an invalid response (not JSON).');
        return;
      }

      if (data.status || response.ok) {
        Alert.alert('Success', data.message || 'User updated successfully');
        setProfileModalVisible(false);
        fetchUsersSilent();
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
    const lastAt = item.last_message_at || item.last_message_time;
    // No chat yet -> no time (the user's sign-up date was shown before, which looked like a message time)
    const timeDisplay = lastAt ? formatListTime(lastAt) : '';

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('Chat', { contact: item, token, userId, room })}
        activeOpacity={0.7}
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
            <Text style={styles.name} numberOfLines={1}>{item.name || item.user_id || 'Unknown'}</Text>
            <Text style={[styles.time, item.unread_count > 0 && styles.timeUnread]}>{timeDisplay}</Text>
          </View>
          <View style={styles.bottomRow}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.last_message_status === 'sent' && <MaterialIcons name="done-all" size={14} color="#8696A0" />}
              {item.last_message_status === 'read' && <MaterialIcons name="done-all" size={14} color="#53BDEB" />}
              {item.last_message ? ` ${item.last_message}` : ''}
            </Text>
            {item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unread_count}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = String(u.name ?? '').toLowerCase().includes(q);
    const userIdMatch = String(u.user_id ?? '').toLowerCase().includes(q);
    const mobileMatch = String(u.mobile_number ?? '').toLowerCase().includes(q);
    return nameMatch || userIdMatch || mobileMatch;
  });

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#075E54" />
      <View style={{ height: insets.top, backgroundColor: '#075E54' }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Users</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.iconBtn} onPress={fetchUsers}>
            <MaterialIcons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
          {role === 'admin' && (
            <TouchableOpacity style={styles.iconBtn} onPress={fetchAllUsers}>
              <MaterialIcons name="group-add" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn} onPress={openProfileModal}>
            <MaterialIcons name="more-vert" size={24} color="#fff" />
          </TouchableOpacity>

        </View>
      </View>

      <View style={styles.searchBar}>
        <View style={styles.searchInputContainer}>
          <MaterialIcons name="search" size={20} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search users..."
            style={styles.searchInput}
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <MaterialIcons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#057A55" />

        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderUserItem}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {searchQuery ? `No users matching "${searchQuery}"` : 'No users found'}
              </Text>
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
                <ActivityIndicator size="large" color="#057A55" />
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
                      <MaterialIcons name="person-add" size={24} color="#057A55" />
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
  container: { flex: 1, backgroundColor: '#F0F0F0' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#075E54',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold', letterSpacing: 0.3 },
  headerIcons: { flexDirection: 'row' },
  iconBtn: { marginLeft: 20 },
  backBtn: { marginRight: 12 },
  searchBar: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#075E54' },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 40,
    elevation: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    paddingVertical: 0,
  },
  chatItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  userImage: { width: 52, height: 52, borderRadius: 26 },
  chatInfo: {
    flex: 1,
    marginLeft: 14,
    borderBottomWidth: 0.6,
    borderBottomColor: '#E8E8E8',
    paddingBottom: 12,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 17, fontWeight: '600', color: '#000', flex: 1, marginRight: 8 },
  time: { fontSize: 12, color: '#8696A0' },
  timeUnread: { fontSize: 12, color: '#25D366', fontWeight: '600' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMessage: { fontSize: 14, color: '#8696A0', flex: 1, marginRight: 8 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  mobileText: { fontSize: 12, color: '#075E54', fontWeight: '500' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#666', fontSize: 16 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: '#25D366',
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: { fontSize: 24 },
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '85%', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#075E54' },

  fieldLabel: { alignSelf: 'flex-start', fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 5 },

  logoPicker: { marginBottom: 20 },
  logoPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#999' },
  logoPlaceholderText: { fontSize: 12, color: '#666', marginTop: 5 },
  pickedLogo: { width: 100, height: 100, borderRadius: 50 },
  modalInput: { width: '100%', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingVertical: 10, fontSize: 16, marginBottom: 20, color: '#000' },
  typeContainer: { flexDirection: 'row', marginBottom: 25, backgroundColor: '#f0f0f0', borderRadius: 25, padding: 4 },
  typeBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  typeBtnActive: { backgroundColor: '#075E54' },

  typeBtnText: { color: '#666', fontWeight: 'bold' },
  typeBtnTextActive: { color: '#fff' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%' },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5, marginLeft: 10 },
  cancelBtn: { backgroundColor: '#eee' },
  createBtn: { backgroundColor: '#075E54' },

  cancelBtnText: { color: '#666', fontWeight: 'bold' },
  createBtnText: { color: '#fff', fontWeight: 'bold' },
});

export default ContactListScreen;

