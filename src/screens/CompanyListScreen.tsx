import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  registerTokenWithBackend,
  unregisterTokenFromBackend,
  consumePendingNotification,
} from '../services/notificationService';

type CompanyListRouteProp = RouteProp<RootStackParamList, 'CompanyListScreen'>;
type NavigationProp = StackNavigationProp<RootStackParamList, 'CompanyListScreen'>;

const CompanyListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CompanyListRouteProp>();
  const { token, role, userId } = route.params;

  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<'private' | 'public'>('private');
  const [creating, setCreating] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedMapRoom, setSelectedMapRoom] = useState<number | null>(null);
  const [selectedMapUsers, setSelectedMapUsers] = useState<number[]>([]);
  const [selectedMapUser, setSelectedMapUser] = useState<number | null>(null);
  const [mapping, setMapping] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [canViewPrevMessages, setCanViewPrevMessages] = useState(0);
  const [editUserName, setEditUserName] = useState('');
  const [editUserCustomId, setEditUserCustomId] = useState('');
  const [editUserMobile, setEditUserMobile] = useState('');
  const [editUserProfileImage, setEditUserProfileImage] = useState<any>(null);
  const [editUserRole, setEditUserRole] = useState('employee');
  const [editUserPasskey, setEditUserPasskey] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchRooms();
    // Logged in (fresh login or auto-login): tell the backend this phone's push token,
    // then open a chat if the app was started by tapping a notification
    registerTokenWithBackend(token);
    consumePendingNotification();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://yber.in/api/rooms', {
        method: 'GET',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setRooms(data);
      } else {
        Alert.alert('Error', 'Failed to fetch rooms');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong while fetching rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySelect = (room: any) => {
    navigation.navigate('ChatList' as any, { room, token, userId, role });
  };

  const handleCreateRoom = async () => {
    if (roomName.trim().length === 0) {
      Alert.alert('Validation', 'Please enter a room name.');
      return;
    }
    try {
      setCreating(true);
      const response = await fetch('https://yber.in/api/rooms/create', {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({
          room_name: roomName.trim(),
          room_type: roomType,
        }),
      });
      const data = await response.json();
      if (response.ok && data.room_id) {
        Alert.alert('Success', data.message || 'Room created successfully!');
        setCreateModalVisible(false);
        setRoomName('');
        setRoomType('private');
        fetchRooms(); // refresh list
      } else {
        Alert.alert('Error', data.message || 'Failed to create room.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
    } finally {
      setCreating(false);
    }
  };

  const openMapModal = () => {
    setMenuVisible(false);
    setMapModalVisible(true);
    if (allUsers.length === 0) {
      fetchAllUsers();
    }
  };

  const fetchAllUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('https://yber.in/api/auth/all-users', {
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const data = await response.json();
      if (data.status && Array.isArray(data.users)) {
        setAllUsers(data.users);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleMapUserSelection = (id: number) => {
    setSelectedMapUsers((prev) =>
      prev.includes(id) ? prev.filter((uid) => uid !== id) : [...prev, id]
    );
  };

  const handleMapUser = async () => {
    if (!selectedMapRoom || selectedMapUsers.length === 0) return;
    try {
      setMapping(true);
      let successCount = 0;
      let lastError = '';

      for (const mapUserId of selectedMapUsers) {
        const response = await fetch('https://yber.in/api/rooms/map', {
          method: 'POST',
          headers: {
            'accept': '*/*',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({
            room_id: selectedMapRoom,
            user_id: mapUserId,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          successCount += 1;
        } else {
          lastError = data.error || data.message || 'Failed to map user';
        }
      }

      if (successCount === selectedMapUsers.length) {
        Alert.alert('Success', `${successCount} user(s) mapped to company successfully!`);
        setMapModalVisible(false);
        setSelectedMapRoom(null);
        setSelectedMapUsers([]);
      } else if (successCount > 0) {
        Alert.alert(
          'Partial Success',
          `${successCount} of ${selectedMapUsers.length} user(s) mapped.${lastError ? ` ${lastError}` : ''}`
        );
      } else {
        Alert.alert('Info', lastError || 'Failed to map users');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Something went wrong while mapping user');
    } finally {
      setMapping(false);
    }
  };

  const handleLogout = async () => {
    // Stop this phone from receiving this user's pushes (needs the token, so before clearing it)
    await unregisterTokenFromBackend(token);
    try {
      if (AsyncStorage.removeMany) {
        await AsyncStorage.removeMany(['userToken', 'userRole', 'userId']);
      } else {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userRole');
        await AsyncStorage.removeItem('userId');
      }
    } catch (e) {
      console.error('Logout error:', e);
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' as any }],
    });
  };

  const handleUpdateUser = async () => {
    if (!selectedMapUser) return;
    try {
      setUpdating(true);
      
      // Prepare the body exactly like the curl example
      const body: any = {
        name: editUserName,
        user_id: editUserCustomId,
        mobile_number: editUserMobile,
        profile_image: (editUserProfileImage && editUserProfileImage.uri && editUserProfileImage.uri.startsWith('http')) 
          ? editUserProfileImage.uri 
          : (editUserProfileImage && editUserProfileImage.base64)
            ? `data:${editUserProfileImage.type || 'image/jpeg'};base64,${editUserProfileImage.base64}`
            : "",
        passkey: editUserPasskey || "", // Server might require this
        role: editUserRole,
        can_view_previous_messages: canViewPrevMessages,
      };

      console.log('Updating user with body:', JSON.stringify(body, null, 2));

      const response = await fetch(`https://yber.in/api/auth/users/${selectedMapUser}`, {
        method: 'PUT',
        headers: {
          'accept': '*/*',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      console.log('Update Response:', responseText);

      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        Alert.alert('Server Error', 'The server returned an invalid response (not JSON).');
        return;
      }

      if (data.status || response.ok) {
        Alert.alert('Success', data.message || 'User updated successfully!');
        setPermissionModalVisible(false);
        setEditUserName('');
        setEditUserMobile('');
        setEditUserProfileImage(null);
        setEditUserPasskey('');
        fetchAllUsers(); 
      } else {
        Alert.alert('Error', data.message || data.error || 'Failed to update user');
      }
    } catch (error: any) {
      console.error('Update Error:', error);
      Alert.alert('Network Error', error.message || 'Check your internet or server connection');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async (userIdToDelete: number) => {
    Alert.alert(
      'Delete User',
      'Are you sure you want to delete this user? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              const response = await fetch(`https://yber.in/api/auth/users/${userIdToDelete}`, {
                method: 'DELETE',
                headers: {
                  'accept': '*/*',
                  'Authorization': `Bearer ${token}`,
                },
              });

              const responseText = await response.text();
              console.log('Delete Response:', responseText);

              let data: any = {};
              try {
                data = JSON.parse(responseText);
              } catch (e) {
                Alert.alert('Server Error', 'The server returned an invalid response.');
                return;
              }

              if (data.status || response.ok) {
                Alert.alert('Success', data.message || 'User deleted successfully!');
                fetchAllUsers();
              } else {
                Alert.alert('Error', data.message || 'Failed to delete user');
              }
            } catch (error: any) {
              console.error('Delete Error:', error);
              Alert.alert('Network Error', error.message || 'Could not connect to the server');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const pickEditProfileImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 1,
      includeBase64: true,
    });
    if (result.assets && result.assets.length > 0) {
      setEditUserProfileImage(result.assets[0]);
    }
  };

  const openPermissionEdit = (user: any) => {
    setSelectedMapUser(user.id);
    setEditUserName(user.name || '');
    setEditUserCustomId(user.user_id || '');
    setEditUserMobile(user.mobile_number || '');
    setEditUserProfileImage(user.profile_image ? { uri: user.profile_image } : null);
    setEditUserRole(user.role || 'employee');
    setEditUserPasskey(''); // Keep passkey empty by default for security
    setCanViewPrevMessages(user.can_view_previous_messages || 0);
    setPermissionModalVisible(true);
  };

  const renderRoomItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.companyCard}
      onPress={() => handleCompanySelect(item)}
      activeOpacity={0.82}
    >
      <LinearGradient
        colors={['#057A55', '#10B981']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.logoGradient}
      >
        <Text style={styles.logoText}>
          {item.room_name?.charAt(0).toUpperCase() || 'R'}
        </Text>
      </LinearGradient>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.room_name}</Text>
        <Text style={styles.subtext}>Tap to join conversation</Text>
      </View>
      <View style={styles.cardRight}>
        {item.created_at && (
          <Text style={styles.time}>
            {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </Text>
        )}
        <View style={styles.chevronCircle}>
          <MaterialIcons name="chevron-right" size={18} color="#057A55" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const filteredRooms = rooms.filter(room =>
    room.room_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#044E3A', '#057A55', '#0E9F6E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: insets.top }}
      >
        <View style={styles.header}>
          {isSearchActive ? (
            <View style={styles.searchHeaderContainer}>
              <TouchableOpacity
                onPress={() => {
                  setIsSearchActive(false);
                  setSearchQuery('');
                }}
                style={styles.searchBackBtn}
              >
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search companies..."
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.searchClearBtn}
                >
                  <MaterialIcons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <View>
                <Text style={styles.headerTitle}>Companies</Text>
                <Text style={styles.headerSubtitle}>
                  {role === 'admin' ? 'Admin Portal' : 'Select a company to start chat'}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  onPress={() => setIsSearchActive(true)}
                  style={styles.headerIconBtn}
                >
                  <MaterialIcons name="search" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLogout} style={styles.headerIconBtn}>
                  <MaterialIcons name="logout" size={22} color="#fff" />
                </TouchableOpacity>
                {role === 'admin' && (
                  <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerIconBtn}>
                    <MaterialIcons name="more-vert" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </LinearGradient>

      {/* Admin Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.menuOverlay} 
          activeOpacity={1} 
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.menuContainer, { top: insets.top + 60 }]}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate('Register' as any);
              }}
            >
              <MaterialIcons name="person-add" size={20} color="#333" />
              <Text style={styles.menuItemText}>Register User</Text>
            </TouchableOpacity>
            
            <View style={styles.menuDivider} />

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setMenuVisible(false);
                setCreateModalVisible(true);
              }}
            >
              <MaterialIcons name="add-business" size={20} color="#333" />
              <Text style={styles.menuItemText}>Create Company</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={openMapModal}
            >
              <MaterialIcons name="group-add" size={20} color="#333" />
              <Text style={styles.menuItemText}>Map User</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setMenuVisible(false);
                setEditModalVisible(true);
                if (allUsers.length === 0) fetchAllUsers();
              }}
            >
              <MaterialIcons name="edit" size={20} color="#333" />
              <Text style={styles.menuItemText}>Edit User</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#057A55" />
        </View>
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRoomItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="business-off" size={60} color="#94A3B8" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No matching companies' : 'No companies found'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery 
                  ? `We couldn't find any company matching "${searchQuery}"`
                  : 'When companies are created/assigned, they will appear here.'}
              </Text>
            </View>
          }
        />
      )}
    </View>

    {/* Create Room Modal */}
    <Modal
      visible={createModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setCreateModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={{ width: '100%', alignItems: 'center' }}
        >
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.modalTitle}>Create Company</Text>

              <Text style={styles.modalLabel}>Company Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter company name"
                placeholderTextColor="#94A3B8"
                value={roomName}
                onChangeText={setRoomName}
                autoFocus
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => { setCreateModalVisible(false); setRoomName(''); setRoomType('private'); }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={handleCreateRoom}
                  disabled={creating}
                >
                  <LinearGradient
                    colors={creating ? ['#94A3B8', '#94A3B8'] : ['#057A55', '#0E9F6E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalCreateGradient}
                  >
                    {creating ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.modalCreateText}>Create</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>

    {/* Map User Modal */}
    <Modal
      visible={mapModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setMapModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { height: '85%', paddingHorizontal: 0, paddingBottom: 20 }]}>
          <View style={{ paddingHorizontal: 25, marginBottom: 15 }}>
            <Text style={styles.modalTitle}>Map User to Company</Text>
          </View>

          <View style={{ paddingHorizontal: 25 }}>
            <Text style={styles.modalLabel}>Select Company</Text>
          </View>
          <View style={{ height: 50, marginBottom: 15 }}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 25 }}
              data={rooms}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.mapChip,
                    selectedMapRoom === item.id && styles.mapChipActive
                  ]}
                  onPress={() => setSelectedMapRoom(item.id)}
                >
                  <Text style={[
                    styles.mapChipText,
                    selectedMapRoom === item.id && styles.mapChipTextActive
                  ]}>{item.room_name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>

          <View style={{ paddingHorizontal: 25, flex: 1 }}>
            <Text style={styles.modalLabel}>
              Select Users{selectedMapUsers.length > 0 ? ` (${selectedMapUsers.length} selected)` : ''}
            </Text>
            {loadingUsers ? (
              <ActivityIndicator color="#057A55" style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={allUsers}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.mapUserItem,
                      selectedMapUsers.includes(item.id) && styles.mapUserItemActive
                    ]}
                    onPress={() => toggleMapUserSelection(item.id)}
                  >
                    <View style={styles.mapUserAvatar}>
                      {item.profile_image ? (
                        <Image source={{ uri: item.profile_image }} style={styles.mapUserImage} />
                      ) : (
                        <Text style={styles.mapUserAvatarText}>
                          {(item.name || item.user_id || 'U').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.mapUserName,
                        selectedMapUsers.includes(item.id) && styles.mapUserNameActive
                      ]}>{item.name || item.user_id || 'Unknown'}</Text>
                      <View style={styles.roleCapsule}>
                        <Text style={styles.roleCapsuleText}>{item.role || 'employee'}</Text>
                      </View>
                    </View>
                    {selectedMapUsers.includes(item.id) && (
                      <MaterialIcons name="check-circle" size={24} color="#057A55" />
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>

          <View style={[styles.modalActions, { paddingHorizontal: 25, marginTop: 15 }]}>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setMapModalVisible(false);
                setSelectedMapRoom(null);
                setSelectedMapUsers([]);
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={handleMapUser}
              disabled={!selectedMapRoom || selectedMapUsers.length === 0 || mapping}
            >
              <LinearGradient
                colors={(!selectedMapRoom || selectedMapUsers.length === 0 || mapping) ? ['#CBD5E1', '#CBD5E1'] : ['#057A55', '#0E9F6E']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.modalCreateGradient}
              >
                {mapping ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalCreateText}>
                    {selectedMapUsers.length > 1 ? `Map ${selectedMapUsers.length} Users` : 'Map User'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Edit User Modal */}
    <Modal
      visible={editModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setEditModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { height: '85%', paddingHorizontal: 0, paddingBottom: 20 }]}>
          <View style={{ paddingHorizontal: 25, marginBottom: 15 }}>
            <Text style={styles.modalTitle}>Manage Users</Text>
          </View>

          <View style={{ paddingHorizontal: 25, flex: 1 }}>
            <Text style={styles.modalLabel}>Select User to Edit</Text>
            {loadingUsers ? (
              <ActivityIndicator color="#057A55" style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={allUsers}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 10 }}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.mapUserItem,
                      selectedMapUser === item.id && styles.mapUserItemActive
                    ]}
                  >
                    <View style={styles.mapUserAvatar}>
                      {item.profile_image ? (
                        <Image source={{ uri: item.profile_image }} style={styles.mapUserImage} />
                      ) : (
                        <Text style={styles.mapUserAvatarText}>
                          {(item.name || item.user_id || 'U').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[
                        styles.mapUserName,
                        selectedMapUser === item.id && styles.mapUserNameActive
                      ]}>{item.name || item.user_id || 'Unknown'}</Text>
                      <View style={styles.roleCapsule}>
                        <Text style={styles.roleCapsuleText}>{item.role || 'employee'}</Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      onPress={() => openPermissionEdit(item)}
                      style={styles.editIconContainer}
                    >
                      <MaterialIcons name="edit" size={20} color="#057A55" />
                    </TouchableOpacity>
                    {role === 'admin' && (
                      <TouchableOpacity 
                        onPress={() => handleDeleteUser(item.id)}
                        style={styles.deleteIconContainer}
                      >
                        <MaterialIcons name="delete" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              />
            )}
          </View>

          <View style={[styles.modalActions, { paddingHorizontal: 25, marginTop: 15 }]}>
            <TouchableOpacity
              style={[styles.modalCancel, { flex: 1 }]}
              onPress={() => {
                setEditModalVisible(false);
                setSelectedMapRoom(null);
                setSelectedMapUser(null);
              }}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Permission Edit Sub-Modal */}
    <Modal
      visible={permissionModalVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setPermissionModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          style={{ width: '100%', alignItems: 'center' }}
        >
          <View style={[styles.modalCard, { width: '90%', paddingBottom: 25, height: 'auto', borderRadius: 24, marginBottom: 'auto', marginTop: 'auto', maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Edit User Details</Text>
              
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <TouchableOpacity onPress={pickEditProfileImage} style={styles.photoUploadContainer}>
                  {editUserProfileImage ? (
                    <Image source={{ uri: editUserProfileImage.uri }} style={styles.editProfileImage} />
                  ) : (
                    <View style={[styles.editProfileImage, styles.editAvatarPlaceholder]}>
                      <MaterialIcons name="add-a-photo" size={28} color="#057A55" />
                    </View>
                  )}
                  <View style={styles.cameraBadge}>
                    <MaterialIcons name="camera-alt" size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
                <Text style={{ marginTop: 8, color: '#057A55', fontWeight: '600', fontSize: 14 }}>Change Photo</Text>
              </View>

              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editUserName}
                onChangeText={setEditUserName}
                placeholder="Enter name"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.modalLabel}>User ID</Text>
              <TextInput
                style={styles.modalInput}
                value={editUserCustomId}
                onChangeText={setEditUserCustomId}
                placeholder="Enter user id"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.modalLabel}>Mobile Number</Text>
              <TextInput
                style={styles.modalInput}
                value={editUserMobile}
                onChangeText={setEditUserMobile}
                placeholder="Enter mobile number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />

              <Text style={styles.modalLabel}>Passkey (Leave empty if no change)</Text>
              <TextInput
                style={styles.modalInput}
                value={editUserPasskey}
                onChangeText={setEditUserPasskey}
                placeholder="Enter new passkey"
                placeholderTextColor="#94A3B8"
                secureTextEntry
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                <Text style={[styles.modalLabel, { marginTop: 0 }]}>Can View Previous Messages</Text>
                <Switch
                  value={canViewPrevMessages === 1}
                  onValueChange={(value) => setCanViewPrevMessages(value ? 1 : 0)}
                  trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
                  thumbColor={canViewPrevMessages === 1 ? '#057A55' : '#F1F5F9'}
                />
              </View>

              <View style={[styles.modalActions, { marginTop: 25 }]}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setPermissionModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={handleUpdateUser}
                  disabled={updating}
                >
                  <LinearGradient
                    colors={updating ? ['#94A3B8', '#94A3B8'] : ['#057A55', '#0E9F6E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalCreateGradient}
                  >
                    {updating ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.modalCreateText}>Update</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────
  container: { flex: 1, backgroundColor: '#F2F7F4' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: {
    marginLeft: 8,
    padding: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  listContainer: { padding: 16, paddingTop: 20 },

  // ── Company Card ─────────────────────────────────────────────────────
  companyCard: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#057A55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  logoGradient: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  info: { flex: 1, marginLeft: 14 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 3 },
  subtext: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  time: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginBottom: 6 },
  cardRight: { alignItems: 'flex-end', marginLeft: 10 },
  chevronCircle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevron: { marginLeft: 8 },

  // ── Empty / Center ───────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: { color: '#1E293B', fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySubtext: { color: '#64748B', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },

  // ── Admin Dropdown Menu ──────────────────────────────────────────────
  menuOverlay: { flex: 1, backgroundColor: 'transparent' },
  menuContainer: {
    position: 'absolute',
    right: 14,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 6,
    minWidth: 200,
    elevation: 12,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  menuItemText: { fontSize: 15, color: '#1E293B', marginLeft: 12, fontWeight: '600' },
  menuDivider: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 14 },

  // ── Modal Base ───────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 26,
    paddingBottom: 40,
    width: '100%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 20, letterSpacing: -0.3 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    fontWeight: '500',
  },

  // ── Role Row ─────────────────────────────────────────────────────────
  typeRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  typeBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  typeBtnActive: { borderColor: '#057A55', backgroundColor: '#E6F4EA' },
  typeBtnText: { fontSize: 14, color: '#64748B', fontWeight: '700' },
  typeBtnTextActive: { color: '#057A55' },

  // ── Modal Actions Row ────────────────────────────────────────────────
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  modalCancelText: { color: '#64748B', fontWeight: '700', fontSize: 15 },
  modalCreateGradient: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  modalCreateText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },

  // ── Map Chips (Company Selector) ─────────────────────────────────────
  mapChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    justifyContent: 'center',
    height: 42,
  },
  mapChipActive: { backgroundColor: '#E6F4EA', borderColor: '#057A55' },
  mapChipText: { color: '#64748B', fontWeight: '700', fontSize: 14 },
  mapChipTextActive: { color: '#057A55' },

  // ── User List Items ──────────────────────────────────────────────────
  mapUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  mapUserItemActive: { borderColor: '#057A55', backgroundColor: '#ECFDF5' },
  mapUserAvatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#057A55',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mapUserAvatarText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  mapUserImage: { width: 46, height: 46, borderRadius: 14 },
  mapUserName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  mapUserNameActive: { color: '#057A55' },
  roleCapsule: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  roleCapsuleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Edit / Delete Icons ──────────────────────────────────────────────
  editIconContainer: {
    padding: 9,
    borderRadius: 12,
    backgroundColor: '#E6F4EA',
  },
  deleteIconContainer: {
    padding: 9,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    marginLeft: 8,
  },

  // ── Profile Photo Upload ─────────────────────────────────────────────
  photoUploadContainer: { position: 'relative' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#057A55',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  editProfileImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#057A55',
  },
  editAvatarPlaceholder: {
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Search Header ─────────────────────────────────────────────────────
  searchHeaderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
  },
  searchBackBtn: { paddingRight: 12 },
  searchBarInput: {
    flex: 1,
    fontSize: 17,
    color: '#fff',
    paddingVertical: 0,
    fontWeight: '500',
  },
  searchClearBtn: { paddingLeft: 12 },
});

export default CompanyListScreen;