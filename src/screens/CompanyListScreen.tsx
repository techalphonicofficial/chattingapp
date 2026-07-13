import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, Alert, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { RootStackParamList } from '../navigation/AppNavigator';

type CompanyListRouteProp = RouteProp<RootStackParamList, 'CompanyListScreen'>;
type NavigationProp = StackNavigationProp<RootStackParamList, 'CompanyListScreen'>;

const CompanyListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CompanyListRouteProp>();
  const { token, role, userId } = route.params;

  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
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
        // If it's a remote URL, send it. If it's a new local image, we might need a different approach,
        // but for now, matching the curl's JSON structure is priority.
        profile_image: (editUserProfileImage && editUserProfileImage.uri && editUserProfileImage.uri.startsWith('http')) 
          ? editUserProfileImage.uri 
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
        Alert.alert('Success', 'User updated successfully!');
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

  const pickEditProfileImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 1,
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
    <TouchableOpacity style={styles.companyItem} onPress={() => handleCompanySelect(item)}>
      <View style={styles.logoPlaceholder}>
        <Text style={styles.logoText}>
          {item.room_name?.charAt(0).toUpperCase() || 'R'}
        </Text>
      </View>
      <View style={styles.info}>
        <View style={styles.listRow}>
          <Text style={styles.name}>{item.room_name}</Text>
          <Text style={styles.time}>
            {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </Text>
        </View>
        <View style={styles.listRow}>
          {/* <Text style={styles.msg} numberOfLines={1}>
            {item.room_type === 'private' ? '🔒 Private Room' : '💬 Public Room'}
          </Text> */}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <>
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0052CC" />
      <View style={{ height: insets.top, backgroundColor: '#0052CC' }} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Company</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('OrderList', { token })}
            style={styles.headerIconBtn}
          >
            <MaterialIcons name="shopping-bag" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.headerIconBtn}>
            <MaterialIcons name="logout" size={24} color="#fff" />
          </TouchableOpacity>
          {role === 'admin' && (
            <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerIconBtn}>
              <MaterialIcons name="more-vert" size={26} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

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
          <ActivityIndicator size="large" color="#0052CC" />

        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRoomItem}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No rooms found</Text>
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
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Create Company</Text>

              <Text style={styles.modalLabel}>Company Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter company name"
                placeholderTextColor="#999"
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
                  style={[styles.modalCreate, creating && { opacity: 0.6 }]}
                  onPress={handleCreateRoom}
                  disabled={creating}
                >
                  {creating
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.modalCreateText}>Create</Text>
                  }
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
            <Text style={styles.modalTitle}>Map User</Text>
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
              <ActivityIndicator color="#0052CC" style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={allUsers}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
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
                      <Text style={styles.mapUserRole}>Role: {item.role || 'employee'}</Text>
                    </View>
                    {selectedMapUsers.includes(item.id) && (
                      <MaterialIcons name="check-circle" size={24} color="#0052CC" />
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
              style={[
                styles.modalCreate,
                (!selectedMapRoom || selectedMapUsers.length === 0 || mapping) && { opacity: 0.6 }
              ]}
              onPress={handleMapUser}
              disabled={!selectedMapRoom || selectedMapUsers.length === 0 || mapping}
            >
              {mapping ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalCreateText}>
                  {selectedMapUsers.length > 1 ? `Map ${selectedMapUsers.length} Users` : 'Map User'}
                </Text>
              )}
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
            <Text style={styles.modalTitle}>Edit User Mapping</Text>
          </View>

          <View style={{ paddingHorizontal: 25, flex: 1 }}>
            <Text style={styles.modalLabel}>Select User</Text>
            {loadingUsers ? (
              <ActivityIndicator color="#0052CC" style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={allUsers}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
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
                      <Text style={styles.mapUserRole}>Role: {item.role || 'employee'}</Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => openPermissionEdit(item)}
                      style={styles.editIconContainer}
                    >
                      <MaterialIcons name="edit" size={22} color="#0052CC" />
                    </TouchableOpacity>
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
          <View style={[styles.modalCard, { width: '90%', paddingBottom: 30, height: 'auto', borderRadius: 20, marginBottom: 'auto', marginTop: 'auto', maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Edit User Details</Text>
              
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <TouchableOpacity onPress={pickEditProfileImage}>
                  {editUserProfileImage ? (
                    <Image source={{ uri: editUserProfileImage.uri }} style={styles.editProfileImage} />
                  ) : (
                    <View style={[styles.editProfileImage, styles.editAvatarPlaceholder]}>
                      <MaterialIcons name="add-a-photo" size={30} color="#0052CC" />
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={{ marginTop: 8, color: '#0052CC', fontWeight: '600' }}>Change Photo</Text>
              </View>

              <Text style={styles.modalLabel}>Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editUserName}
                onChangeText={setEditUserName}
                placeholder="Enter name"
              />

              <Text style={styles.modalLabel}>User ID</Text>
              <TextInput
                style={styles.modalInput}
                value={editUserCustomId}
                onChangeText={setEditUserCustomId}
                placeholder="Enter user id"
              />

              <Text style={styles.modalLabel}>Mobile Number</Text>
              <TextInput
                style={styles.modalInput}
                value={editUserMobile}
                onChangeText={setEditUserMobile}
                placeholder="Enter mobile number"
                keyboardType="phone-pad"
              />

              <Text style={styles.modalLabel}>Passkey (Leave empty if no change)</Text>
              <TextInput
                style={styles.modalInput}
                value={editUserPasskey}
                onChangeText={setEditUserPasskey}
                placeholder="Enter new passkey"
                secureTextEntry
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, paddingVertical: 5 }}>
                <Text style={[styles.modalLabel, { marginTop: 0 }]}>Can View Previous Messages</Text>
                <Switch
                  value={canViewPrevMessages === 1}
                  onValueChange={(value) => setCanViewPrevMessages(value ? 1 : 0)}
                  trackColor={{ false: '#767577', true: '#0052CC' }}
                  thumbColor={canViewPrevMessages === 1 ? '#fff' : '#f4f3f4'}
                />
              </View>

              <View style={[styles.modalActions, { marginTop: 30 }]}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setPermissionModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalCreate, updating && { opacity: 0.6 }]}
                  onPress={handleUpdateUser}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.modalCreateText}>Update</Text>
                  )}
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
  container: { flex: 1, backgroundColor: '#fff' },
  header: { 
    padding: 18, 
    backgroundColor: '#0052CC',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { marginLeft: 12, padding: 4 },
  companyItem: { flexDirection: 'row', padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#eee', alignItems: 'center' },
  logoPlaceholder: { 
    width: 55, 
    height: 55, 
    borderRadius: 30, 
    backgroundColor: '#007AFF', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  logoText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  info: { flex: 1, marginLeft: 15 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: 'bold', color: '#000' },
  time: { fontSize: 12, color: '#666' },
  msg: { fontSize: 14, color: '#666', marginTop: 3, flex: 0.9 },
  badge: { backgroundColor: '#3B82F6', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#666', fontSize: 16 },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContainer: {
    position: 'absolute',
    right: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 5,
    minWidth: 170,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginHorizontal: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 25,
    paddingBottom: 40,
    width: '100%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#000', marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 12 },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
  },
  typeRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  typeBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  typeBtnActive: { borderColor: '#0052CC', backgroundColor: '#F0F7FF' },

  typeBtnText: { fontSize: 14, color: '#666', fontWeight: '600' },
  typeBtnTextActive: { color: '#0052CC' },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancel: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  modalCancelText: { color: '#666', fontWeight: '700', fontSize: 15 },
  modalCreate: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#0052CC',
    alignItems: 'center',
    elevation: 3,
  },
  modalCreateText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  mapChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    height: 40,
  },
  mapChipActive: {
    backgroundColor: '#F0F7FF',
    borderColor: '#0052CC',
  },
  mapChipText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  mapChipTextActive: {
    color: '#0052CC',
  },
  mapUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    marginBottom: 10,
  },
  mapUserItemActive: {
    borderColor: '#0052CC',
    backgroundColor: '#F8FBFF',
  },
  mapUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0052CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mapUserAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  mapUserImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  mapUserName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  mapUserNameActive: {
    color: '#0052CC',
  },
  mapUserRole: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  editIconContainer: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0F7FF',
  },
  editProfileImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#0052CC',
  },
  editAvatarPlaceholder: {
    backgroundColor: '#E1F0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CompanyListScreen;