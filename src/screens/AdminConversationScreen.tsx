// ADMIN: read-only view of the chat between two users.
// user1's messages on the left, user2's on the right, each bubble shows the sender's name.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, Image, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '../navigation/AppNavigator';
import { CHAT_API_BASE, CHAT_SERVER_URL } from '../config/api';
import { formatClock, formatDayLabel, isSameDay } from '../utils/time';

type RouteProps = RouteProp<RootStackParamList, 'AdminConversation'>;

const PAGE_SIZE = 50;

const fullUrl = (url: string) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${CHAT_SERVER_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const AdminConversationScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token, user1, user2, roomId, roomName } = useRoute<RouteProps>().params;

  // newest first (the list is inverted, so newest shows at the bottom like a normal chat)
  const [messages, setMessages] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (pageToLoad: number) => {
    try {
      if (pageToLoad === 1) setLoading(true); else setLoadingMore(true);
      const params = [
        `user1_id=${user1.id}`,
        `user2_id=${user2.id}`,
        `page=${pageToLoad}`,
        `limit=${PAGE_SIZE}`,
      ];
      if (roomId !== undefined && roomId !== null && roomId !== '') {
        params.push(`room_id=${encodeURIComponent(String(roomId))}`);
      }
      const response = await fetch(`${CHAT_API_BASE}/messages/admin/conversation?${params.join('&')}`, {
        headers: { accept: 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.messages)) {
        setError(data.message || data.error || 'Failed to load chat');
        return;
      }
      setMessages(prev => {
        const merged = pageToLoad === 1 ? data.messages : [...prev, ...data.messages];
        // the same message can be in messages + history; keep one
        const seen = new Set<string>();
        return merged.filter((m: any) => {
          const key = `${m.id}-${m.created_at}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      setHasMore(data.messages.length === PAGE_SIZE);
      setPage(pageToLoad);
    } catch (e) {
      setError('Could not connect to the server');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [token, user1.id, user2.id, roomId]);

  useEffect(() => {
    load(1);
  }, [load]);

  const renderBody = (item: any, isRight: boolean) => {
    const url = item.file_url ? fullUrl(item.file_url) : '';
    return (
      <>
        {item.message_type === 'image' && url ? (
          <TouchableOpacity onPress={() => Linking.openURL(url)}>
            <Image source={{ uri: url }} style={styles.image} />
          </TouchableOpacity>
        ) : null}
        {item.message_type === 'document' && url ? (
          <TouchableOpacity style={styles.doc} onPress={() => Linking.openURL(url)}>
            <MaterialIcons name="insert-drive-file" size={20} color={isRight ? '#fff' : '#057A55'} />
            <Text style={[styles.docText, isRight && { color: '#fff' }]} numberOfLines={1}>
              {decodeURIComponent(url.split('/').pop() || 'Document')}
            </Text>
          </TouchableOpacity>
        ) : null}
        {item.message ? (
          <Text style={[styles.msgText, isRight && { color: '#fff' }]}>{item.message}</Text>
        ) : null}
      </>
    );
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isRight = String(item.sender_id) === String(user2.id);
    const senderName = isRight ? user2.name : user1.name;
    // inverted list: the "previous" (older) message is the next index
    const older = messages[index + 1];
    const showDay = !older || !isSameDay(older.created_at, item.created_at);
    return (
      <View>
        {showDay && (
          <View style={styles.dayWrap}><Text style={styles.day}>{formatDayLabel(item.created_at)}</Text></View>
        )}
        <View style={[styles.bubbleRow, isRight ? styles.right : styles.left]}>
          <View style={[styles.bubble, isRight ? styles.bubbleRight : styles.bubbleLeft]}>
            <Text style={[styles.sender, isRight && { color: '#D1FAE5' }]}>{senderName}</Text>
            {renderBody(item, isRight)}
            <Text style={[styles.time, isRight && { color: 'rgba(255,255,255,0.75)' }]}>
              {formatClock(item.created_at)}{item.status ? `  ·  ${item.status}` : ''}
            </Text>
          </View>
        </View>
      </View>
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
            <Text style={styles.headerTitle} numberOfLines={1}>{user1.name}  ↔  {user2.name}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {roomName ? `${roomName} · ` : ''}Read-only (admin view)
            </Text>
          </View>
          <MaterialIcons name="visibility" size={22} color="rgba(255,255,255,0.85)" />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#057A55" /></View>
      ) : messages.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name={error ? 'error-outline' : 'chat-bubble-outline'} size={56} color="#94A3B8" />
          <Text style={styles.emptyText}>{error || 'No messages between these users'}</Text>
        </View>
      ) : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(item, i) => `${item.id}-${i}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 10 }}
          onEndReachedThreshold={0.3}
          onEndReached={() => { if (hasMore && !loadingMore) load(page + 1); }}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#057A55" style={{ margin: 12 }} /> : null}
        />
      )}

      <View style={styles.footer}>
        <MaterialIcons name="lock" size={14} color="#64748B" />
        <Text style={styles.footerText}>Admin can only view this chat, not send messages</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ECE5DD' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  iconBtn: { padding: 6, marginRight: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { marginTop: 10, color: '#64748B', fontSize: 15, textAlign: 'center' },
  dayWrap: { alignItems: 'center', marginVertical: 8 },
  day: { backgroundColor: 'rgba(255,255,255,0.9)', color: '#475569', fontSize: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  bubbleRow: { flexDirection: 'row', marginVertical: 3 },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  bubbleLeft: { backgroundColor: '#fff', borderTopLeftRadius: 2 },
  bubbleRight: { backgroundColor: '#057A55', borderTopRightRadius: 2 },
  sender: { fontSize: 12, fontWeight: '700', color: '#057A55', marginBottom: 2 },
  msgText: { fontSize: 15, color: '#0F172A' },
  time: { fontSize: 10, color: '#64748B', alignSelf: 'flex-end', marginTop: 3 },
  image: { width: 200, height: 200, borderRadius: 8, marginVertical: 4, backgroundColor: '#CBD5E1' },
  doc: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  docText: { marginLeft: 6, color: '#057A55', textDecorationLine: 'underline', flexShrink: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, backgroundColor: '#F8FAFC' },
  footerText: { marginLeft: 6, fontSize: 12, color: '#64748B' },
});

export default AdminConversationScreen;
