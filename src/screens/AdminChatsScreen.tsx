// ADMIN: list of every conversation between two users (optionally for one company).
// Tap a conversation to read it (read-only) in AdminConversationScreen.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, TextInput, RefreshControl, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '../navigation/AppNavigator';
import { CHAT_API_BASE } from '../config/api';
import { formatListTime } from '../utils/time';

type RouteProps = RouteProp<RootStackParamList, 'AdminChats'>;
type NavProps = StackNavigationProp<RootStackParamList, 'AdminChats'>;

const displayName = (name: any, customId: any, id: any) => name || customId || `User #${id}`;

const lastMessagePreview = (c: any) => {
  if (c.last_message_type === 'image') return '📷 Photo';
  if (c.last_message_type === 'document') return '📎 Document';
  return c.last_message || '';
};

const Avatar = ({ name, image }: { name: string; image?: string }) => (
  <View style={styles.avatar}>
    {image ? (
      <Image source={{ uri: image }} style={styles.avatarImg} />
    ) : (
      <Text style={styles.avatarText}>{(name || 'U').charAt(0).toUpperCase()}</Text>
    )}
  </View>
);

const AdminChatsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProps>();
  const { token } = useRoute<RouteProps>().params;

  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any>(null); // null = all companies
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const headers = { accept: 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${CHAT_API_BASE}/rooms`, { headers })
      .then(r => r.json())
      .then(data => Array.isArray(data) && setRooms(data))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchConversations = useCallback(async (isPull = false) => {
    try {
      if (isPull) setRefreshing(true); else setLoading(true);
      setError('');
      const qs = selectedRoom ? `?room_id=${encodeURIComponent(selectedRoom.id)}` : '';
      const response = await fetch(`${CHAT_API_BASE}/messages/admin/conversations${qs}`, { headers });
      const data = await response.json();
      if (response.ok && Array.isArray(data.conversations)) {
        setConversations(data.conversations);
      } else {
        setError(data.message || data.error || 'Failed to load chats');
      }
    } catch (e) {
      setError('Could not connect to the server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, token]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? conversations.filter(c =>
        [c.user1_name, c.user1_custom_id, c.user2_name, c.user2_custom_id, c.room_name]
          .some(v => String(v || '').toLowerCase().includes(q)))
    : conversations;

  const renderItem = ({ item }: { item: any }) => {
    const n1 = displayName(item.user1_name, item.user1_custom_id, item.user1_id);
    const n2 = displayName(item.user2_name, item.user2_custom_id, item.user2_id);
    const lastBy = String(item.last_sender_id) === String(item.user1_id) ? n1 : n2;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('AdminConversation', {
          token,
          user1: { id: item.user1_id, name: n1, image: item.user1_image },
          user2: { id: item.user2_id, name: n2, image: item.user2_image },
          roomId: item.room_id,
          roomName: item.room_name,
        })}
      >
        <View style={styles.avatarPair}>
          <Avatar name={n1} image={item.user1_image} />
          <View style={styles.avatarSecond}><Avatar name={n2} image={item.user2_image} /></View>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.row}>
            <Text style={styles.names} numberOfLines={1}>{n1}  ↔  {n2}</Text>
            <Text style={styles.time}>{formatListTime(item.last_message_time)}</Text>
          </View>
          <Text style={styles.preview} numberOfLines={1}>
            <Text style={styles.previewBy}>{lastBy}: </Text>{lastMessagePreview(item)}
          </Text>
          <View style={styles.row}>
            <Text style={styles.company} numberOfLines={1}>
              {item.room_name ? `🏢 ${item.room_name}` : 'Direct chat'}
            </Text>
            <Text style={styles.count}>{item.total_messages} msgs</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#044E3A', '#057A55', '#0E9F6E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>All Chats</Text>
            <Text style={styles.headerSubtitle}>See the chat between any two users</Text>
          </View>
        </View>
        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color="rgba(255,255,255,0.8)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search user or company..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.chipsWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
          data={[{ id: null, room_name: 'All companies' }, ...rooms]}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => {
            const active = (selectedRoom?.id ?? null) === item.id;
            return (
              <TouchableOpacity
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedRoom(item.id === null ? null : item)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.room_name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#057A55" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => `${item.room_id}-${item.user1_id}-${item.user2_id}`}
          renderItem={renderItem}
          contentContainerStyle={[{ padding: 12 }, filtered.length === 0 && { flexGrow: 1 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchConversations(true)} colors={['#057A55']} tintColor="#057A55" />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialIcons name={error ? 'error-outline' : 'forum'} size={56} color="#94A3B8" />
              <Text style={styles.emptyText}>{error || (q ? 'No matching chats' : 'No chats yet')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  iconBtn: { padding: 6, marginRight: 8 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginBottom: 14, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)' },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 8, paddingHorizontal: 8, fontSize: 15 },
  chipsWrap: { paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive: { backgroundColor: '#057A55', borderColor: '#057A55' },
  chipText: { color: '#334155', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, elevation: 1 },
  avatarPair: { width: 62, height: 48, marginRight: 12 },
  avatarSecond: { position: 'absolute', left: 22, top: 8, borderWidth: 2, borderColor: '#fff', borderRadius: 22 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 40, height: 40 },
  avatarText: { color: '#057A55', fontWeight: '800', fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  names: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0F172A', marginRight: 8 },
  time: { fontSize: 11, color: '#64748B' },
  preview: { fontSize: 13, color: '#475569', marginVertical: 3 },
  previewBy: { fontWeight: '700', color: '#334155' },
  company: { flex: 1, fontSize: 12, color: '#057A55', marginRight: 8 },
  count: { fontSize: 11, color: '#94A3B8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { marginTop: 10, color: '#64748B', fontSize: 15, textAlign: 'center' },
});

export default AdminChatsScreen;
