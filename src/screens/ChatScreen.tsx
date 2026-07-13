import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  StatusBar,
  ActivityIndicator,
  ImageBackground,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { io, Socket } from 'socket.io-client';
import { launchImageLibrary } from 'react-native-image-picker';
import { pick } from '@react-native-documents/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import RNPrint from 'react-native-print';
const LOG_PREFIX = '[ChatScreen]';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SOCKET_URL = 'http://187.127.154.235:5000';
const API_BASE_URL = `${SOCKET_URL}/api`;

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type NavigationProp = StackNavigationProp<RootStackParamList, 'Chat'>;

const ChatScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ChatScreenRouteProp>();
  const { contact, token, userId, room } = route.params;

  // ─── messages are stored chronologically: index 0 = oldest, last = newest ──
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [socketStatus, setSocketStatus] = useState('Connecting...');
  const [menuVisible, setMenuVisible] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);
  // Track whether we've done the initial scroll-to-bottom
  const initialScrollDone = useRef(false);
const log = {
  info: (...args: any[]) => console.log(LOG_PREFIX, 'ℹ️', ...args),
  warn: (...args: any[]) => console.warn(LOG_PREFIX, '⚠️', ...args),
  error: (...args: any[]) => console.error(LOG_PREFIX, '❌', ...args),
};
  const contactId = useMemo(() => parseInt(contact.id, 10), [contact.id]);
  const roomId = useMemo(
    () =>
      room?.id?.toString() ||
      [userId, contactId].sort((a, b) => a - b).join('_'),
    [room?.id, userId, contactId]
  );

  // ─── SOCKET SETUP ──────────────────────────────────────────────────────────

const reconnectAttempts = useRef(0);
const MAX_RECONNECT_ATTEMPTS = 5;

useEffect(() => {
  if (socketRef.current?.connected) {
    log.info('Socket already connected, skipping init');
    return;
  }

  log.info('Creating socket...', { roomId });

  const socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    secure: true,
    path: '/socket.io/',
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,        // wait 1s before first retry
    reconnectionDelayMax: 5000,     // cap retry delay at 5s
    timeout: 20000,
    forceNew: false,                // reuse engine if possible
    autoConnect: true,
  });

  socketRef.current = socket;

  // ── Lifecycle events ──────────────────────────────────────────────────────
  socket.on('connect', () => {
    reconnectAttempts.current = 0;
    setIsConnected(true);
    setSocketStatus('Online');
    log.info('Connected', { id: socket.id, transport: socket.io.engine.transport.name });
    socket.emit('join_room', roomId);
    markMessagesAsRead();
  });

  socket.on('disconnect', (reason) => {
    setIsConnected(false);
    setSocketStatus(reason === 'io server disconnect' ? 'Disconnected' : 'Reconnecting...');
    log.warn('Disconnected', { reason });

    // Server intentionally closed → reconnect manually
    if (reason === 'io server disconnect') {
      socket.connect();
    }
  });

  socket.on('reconnect', (attempt) => {
    log.info('Reconnected after attempts:', attempt);
    setSocketStatus('Online');
    socket.emit('join_room', roomId);   // re-join room after reconnect
    markMessagesAsRead();
  });

  socket.on('reconnect_attempt', (attempt) => {
    reconnectAttempts.current = attempt;
    setSocketStatus(`Reconnecting (${attempt}/${MAX_RECONNECT_ATTEMPTS})...`);
    log.info('Reconnect attempt:', attempt);
  });

  socket.on('reconnect_failed', () => {
    setSocketStatus('Connection failed');
    log.error('All reconnect attempts exhausted');
    Alert.alert(
      'Connection Lost',
      'Unable to reconnect. Please check your internet and try again.',
      [{ text: 'Retry', onPress: () => socket.connect() }, { text: 'Cancel' }]
    );
  });

  socket.on('reconnect_error', (err) => {
    log.warn('Reconnect error:', err?.message);
  });

  // ── Detailed connect error logging ────────────────────────────────────────
  socket.on('connect_error', (err) => {
    const anyErr = err as any;
    log.error('Connect error', {
      message:     err?.message,
      description: anyErr?.description,
      context:     anyErr?.context,
      type:        anyErr?.type,
    });

    const isAuthError = err?.message?.toLowerCase().includes('auth');
    if (isAuthError) {
      setSocketStatus('Auth error');
      socket.disconnect();     // don't keep retrying on auth failures
    }
  });

  socket.io.on('upgrade_error', (err: any) => {
    log.warn('Transport upgrade error', { message: err?.message, type: err?.type });
  });

  socket.io.on('upgrade', () => {
    log.info('Transport upgraded to:', socket.io.engine.transport.name);
  });

  // ── Message events ────────────────────────────────────────────────────────
  socket.on('receive_message', (newMessage: any) => {
    if (!newMessage?.id) return;
    log.info('Message received:', newMessage.id);

    setMessages((prev) => {
      // Deduplicate
      if (prev.some((m) => m.id === newMessage.id)) {
        log.warn('Duplicate message ignored:', newMessage.id);
        return prev;
      }

      // Replace matching optimistic bubble sent by us
      if (Number(newMessage.sender_id) === Number(userId)) {
        const optimisticIndex = prev.findIndex(
          (m) => m.is_optimistic && m.message === newMessage.message
        );
        if (optimisticIndex !== -1) {
          const updated = [...prev];
          updated[optimisticIndex] = { ...newMessage, is_optimistic: false };
          return updated;
        }
      }

      return [...prev, newMessage];
    });

    if (Number(newMessage.sender_id) !== Number(userId)) {
      markMessagesAsRead();
    }

    scrollToBottom();
  });

  socket.on('messages_read', (data: any) => {
    if (data?.room_id !== roomId) return;
    log.info('Messages read event:', data);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.sender_id === userId ? { ...msg, is_read: true, status: 'read' } : msg
      )
    );
  });

  // ── Initial data load ─────────────────────────────────────────────────────
  fetchMessages(1);
  markMessagesAsRead();

  // ── Cleanup ───────────────────────────────────────────────────────────────
  return () => {
    log.info('Cleaning up socket...');
    socket.off('connect');
    socket.off('disconnect');
    socket.off('reconnect');
    socket.off('reconnect_attempt');
    socket.off('reconnect_failed');
    socket.off('reconnect_error');
    socket.off('connect_error');
    socket.off('receive_message');
    socket.off('messages_read');
    socket.disconnect();
    socketRef.current = null;
    reconnectAttempts.current = 0;
  };
}, [roomId]);

  // ─── SCROLL TO BOTTOM HELPER ───────────────────────────────────────────────
  const scrollToBottom = (animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 100);
  };

  // ─── MARK MESSAGES AS READ ─────────────────────────────────────────────────
  const markMessagesAsRead = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/messages/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          accept: '*/*',
        },
        body: JSON.stringify({ room_id: roomId.toString() }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          socketRef.current?.emit('mark_read', {
            room_id: roomId,
            user_id: userId,
          });
        }
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // ─── FETCH MESSAGES (PAGINATED) ────────────────────────────────────────────
  // API returns newest-first (page 1 = latest 20 msgs).
  // We reverse them so array is chronological (oldest → newest).
  // On "load more" (older pages) we prepend to the front of the array.
  const fetchMessages = async (pageNum = 1) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await fetch(
        `${API_BASE_URL}/messages/chat-with/${contactId}?page=${pageNum}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status && Array.isArray(data.messages)) {
          const newMessages = data.messages; // newest-first from API
          setHasMore(newMessages.length >= 20);

          if (pageNum === 1) {
            // Reverse so index-0 = oldest, last = newest → renders top-to-bottom correctly
            const chronological = [...newMessages].reverse();
            setMessages(chronological);
            setPage(1);
            // Scroll to bottom after first load
            initialScrollDone.current = false;
          } else {
            // Older messages → prepend at the front (top of list)
            const olderChronological = [...newMessages].reverse();
            setMessages((prev) => [...olderChronological, ...prev]);
            setPage(pageNum);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Called when user is near the top of the list → load older messages
  const loadMoreMessages = () => {
    if (!loadingMore && hasMore) {
      fetchMessages(page + 1);
    }
  };

  // ─── FETCH ALL MESSAGES FOR PDF EXPORT ────────────────────────────────────
  const fetchAllMessagesForExport = async (): Promise<any[]> => {
    const allMessages: any[] = [];
    let currentPage = 1;
    let morePages = true;
    const limit = 20;

    while (morePages) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/messages/chat-with/${contactId}?page=${currentPage}&limit=${limit}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!response.ok) break;

        const data = await response.json();

        if (
          data.status &&
          Array.isArray(data.messages) &&
          data.messages.length > 0
        ) {
          allMessages.push(...data.messages);
          morePages = data.messages.length >= limit;
          if (morePages) currentPage++;
        } else {
          morePages = false;
        }
      } catch (error) {
        console.error('Error fetching page for export:', error);
        morePages = false;
      }
    }

    return allMessages;
  };

  // ─── BUILD HTML FOR PDF ────────────────────────────────────────────────────
  const buildChatHTML = (sortedMessages: any[]): string => {
    let html = `
      <html>
        <head>
          <meta charset="UTF-8"/>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; padding: 20px; background: #ECE5DD; }
            .chat-header {
              text-align: center; font-size: 20px; margin-bottom: 20px;
              font-weight: bold; color: #075E54; padding-bottom: 10px;
              border-bottom: 2px solid #075E54;
            }
            .date-divider {
              text-align: center; font-size: 12px; color: #666;
              margin: 16px 0 8px; background: #cde; border-radius: 8px;
              padding: 3px 10px; display: inline-block; width: 100%;
            }
            .message-wrapper { width: 100%; margin-bottom: 6px; overflow: hidden; }
            .bubble {
              max-width: 72%; padding: 8px 12px; border-radius: 10px;
              word-wrap: break-word; display: inline-block;
            }
            .bubble.me { background-color: #DCF8C6; float: right; border-top-right-radius: 0; }
            .bubble.them { background-color: #ffffff; float: left; border-top-left-radius: 0; }
            .message-text { font-size: 14px; color: #111; margin-bottom: 4px; }
            .attachment-label { font-size: 13px; color: #555; font-style: italic; margin-bottom: 4px; }
            .meta { font-size: 10px; color: #888; text-align: right; }
            .clearfix::after { content: ''; display: table; clear: both; }
          </style>
        </head>
        <body>
          <div class="chat-header">
            Chat with ${escapeHtml(contact.name || contact.user_id || 'Unknown')}
          </div>
    `;

    let lastDate = '';

    sortedMessages.forEach((msg) => {
      const isMe = String(msg.sender_id) === String(userId);
      const msgDate = new Date(msg.created_at || Date.now());
      const dateLabel = msgDate.toLocaleDateString([], {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const time = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (dateLabel !== lastDate) {
        html += `<div class="clearfix"></div><div class="date-divider">${dateLabel}</div>`;
        lastDate = dateLabel;
      }

      const side = isMe ? 'me' : 'them';
      const ticks = isMe
        ? msg.is_read || msg.status === 'read' ? ' ✓✓' : ' ✓'
        : '';

      html += `<div class="message-wrapper clearfix">`;
      html += `<div class="bubble ${side}">`;
      if (msg.file_url) html += `<p class="attachment-label">📎 [Attachment]</p>`;
      if (msg.message?.trim()) html += `<p class="message-text">${escapeHtml(msg.message)}</p>`;
      html += `<div class="meta">${time}${ticks}</div>`;
      html += `</div></div>`;
    });

    html += `<div class="clearfix"></div></body></html>`;
    return html;
  };

  const escapeHtml = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // ─── EXPORT CHAT AS PDF ────────────────────────────────────────────────────
  const exportChatAsPDF = async () => {
    try {
      setExportingPDF(true);
      setMenuVisible(false);

      const allMessages = await fetchAllMessagesForExport();
      if (allMessages.length === 0) {
        Alert.alert('No Messages', 'There are no messages to export.');
        return;
      }

      // allMessages from API is newest-first → reverse for chronological order
      const sortedMessages = [...allMessages].reverse();
      const htmlContent = buildChatHTML(sortedMessages);
      await RNPrint.print({ html: htmlContent });
    } catch (error: any) {
      Alert.alert('❌ Export Failed', `Reason: ${error?.message || 'Unknown error'}`);
    } finally {
      setExportingPDF(false);
    }
  };

  // ─── PICK IMAGE ────────────────────────────────────────────────────────────
  const pickImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1 });
    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      await sendMessage(null, {
        uri: asset.uri,
        type: asset.type,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        message_type: 'image',
      });
    }
  };

  // ─── PICK DOCUMENT ─────────────────────────────────────────────────────────
  const pickDocument = async () => {
    try {
      const [res] = await pick({ type: ['*/*'] });
      if (res) {
        await sendMessage(null, {
          uri: res.uri,
          type: res.type,
          name: res.name,
          message_type: 'document',
        });
      }
    } catch (err) {
      // User cancelled — do nothing
    }
  };

  // ─── SEND MESSAGE ──────────────────────────────────────────────────────────
  const sendMessage = async (overriddenText?: string | null, fileData?: any) => {
    const text = overriddenText !== undefined ? overriddenText : inputText.trim();
    if (!text && !fileData) return;

    let optimisticMsg: any = null;

    if (!fileData) {
      optimisticMsg = {
        id: `temp-${Date.now()}`,
        sender_id: userId,
        receiver_id: contactId,
        room_id: roomId,
        message: text || '',
        message_type: 'text',
        created_at: new Date().toISOString(),
        is_optimistic: true,
        status: 'sending',
      };
      // Append at END (bottom of chat = newest)
      setMessages((prev) => [...prev, optimisticMsg]);
      setInputText('');
      scrollToBottom();
    }

    const formData = new FormData();
    formData.append('room_id', roomId.toString());
    formData.append('receiver_id', contactId.toString());
    formData.append('message', text || '');
    formData.append('message_type', fileData ? fileData.message_type : 'text');

    if (fileData) {
      formData.append('file', {
        uri: fileData.uri,
        type: fileData.type,
        name: fileData.name,
      });
    } else {
      formData.append('file', '');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/messages/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          accept: '*/*',
        },
        body: formData,
      });

      const result = await response.json();

      if (result && result.id && optimisticMsg) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMsg.id ? { ...result, is_optimistic: false } : m
          )
        );
      } else if (result && result.id) {
        setMessages((prev) =>
          prev.some((m) => m.id === result.id) ? prev : [...prev, result]
        );
      }
    } catch (error) {
      console.error('Send error:', error);
      if (!fileData && optimisticMsg) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setInputText(text || '');
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
    }
  };

  // ─── RENDER MESSAGE BUBBLE ─────────────────────────────────────────────────
  const renderMessage = ({ item }: any) => {
    const isMe = String(item.sender_id) === String(userId);
    const isRead = item.is_read || item.status === 'read';
    const isSending = item.is_optimistic;

    return (
      <View
        style={[
          styles.messageBubble,
          isMe ? styles.myMessage : styles.theirMessage,
        ]}
      >
        {item.file_url && (
          <TouchableOpacity activeOpacity={0.8}>
            <Image
              source={{ uri: item.file_url }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}
        {item.message ? (
          <Text style={styles.messageText}>{item.message}</Text>
        ) : null}
        <View style={styles.messageFooter}>
          <Text style={styles.timestamp}>
            {new Date(item.created_at || Date.now()).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          {isMe && (
            <Text
              style={[
                styles.ticks,
                isSending
                  ? styles.sendingTicks
                  : isRead
                  ? styles.readTicks
                  : styles.sentTicks,
              ]}
            >
              {isSending ? '🕐' : '✓✓'}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0052CC" />
      <View style={{ height: insets.top, backgroundColor: '#0052CC' }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        {contact.profile_image ? (
          <Image
            source={{ uri: contact.profile_image }}
            style={styles.headerAvatar}
          />
        ) : (
          <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {(contact.name || contact.user_id || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>
            {contact.name || contact.user_id || 'Unknown'}
          </Text>
          <Text style={[styles.headerStatus, isConnected && { color: '#87CEFA' }]}>
            {socketStatus}
          </Text>
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.hIcon}
            onPress={() => setMenuVisible(true)}
          >
            <MaterialIcons name="more-vert" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Dropdown Menu ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}
          activeOpacity={1}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={exportChatAsPDF}
              disabled={exportingPDF}
            >
              {exportingPDF ? (
                <View style={styles.menuLoadingRow}>
                  <ActivityIndicator size="small" color="#0052CC" />
                  <Text
                    style={[styles.menuItemText, { marginLeft: 8, color: '#0052CC' }]}
                  >
                    Exporting...
                  </Text>
                </View>
              ) : (
                <Text style={styles.menuItemText}>📄 Export Chat as PDF</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Chat Background + Messages ── */}
      <ImageBackground
        source={{
          uri: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png',
        }}
        style={styles.chatBackground}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 60}
        >
          {loading ? (
            <ActivityIndicator
              size="large"
              color="#075E54"
              style={{ flex: 1 }}
            />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item, index) =>
                item.id?.toString() || `msg-${index}`
              }
              // ── NOT inverted — normal top-to-bottom order ──
              // Oldest messages at top, newest at bottom (WhatsApp style)
              contentContainerStyle={{ padding: 10, paddingBottom: 10 }}
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === 'android'}
              keyboardDismissMode="on-drag"
              // Scroll to bottom once after initial load
              onContentSizeChange={() => {
                if (!initialScrollDone.current && messages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                  initialScrollDone.current = true;
                }
              }}
              // Load older messages when user scrolls to the very top
              onScroll={({ nativeEvent }) => {
                if (nativeEvent.contentOffset.y <= 0 && hasMore && !loadingMore) {
                  loadMoreMessages();
                }
              }}
              scrollEventThrottle={200}
              // Show spinner at the top while loading older messages
              ListHeaderComponent={() =>
                loadingMore ? (
                  <ActivityIndicator
                    size="small"
                    color="#0052CC"
                    style={{ marginVertical: 10 }}
                  />
                ) : hasMore ? (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={loadMoreMessages}
                    disabled={loadingMore}
                  >
                    <Text style={styles.loadMoreText}>Load older messages</Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          )}

          {/* ── Input Area ── */}
          <View style={[styles.inputArea, { marginBottom: insets.bottom + 10 }]}>
            <View style={styles.inputContainer}>
              <TouchableOpacity style={styles.emojiBtn}>
                <MaterialCommunityIcons
                  name="emoticon-outline"
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#999"
                value={inputText}
                onChangeText={setInputText}
                multiline
              />

              <TouchableOpacity
                style={styles.attachBtn}
                onPress={() => {
                  Alert.alert('Attach File', 'Choose attachment type', [
                    { text: 'Image', onPress: pickImage },
                    { text: 'Document', onPress: pickDocument },
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                }}
              >
                <MaterialCommunityIcons
                  name="paperclip"
                  size={24}
                  color="#666"
                  style={styles.attachIcon}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => sendMessage()}
            >
              {inputText.trim() ? (
                <MaterialIcons name="send" size={24} color="#fff" />
              ) : (
                <MaterialIcons name="mic" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0052CC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#0052CC',
  },
  backBtn: { paddingRight: 5 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerInfo: { flex: 1, marginLeft: 10 },
  headerName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  headerStatus: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  headerIcons: { flexDirection: 'row' },
  hIcon: { marginLeft: 15 },
  chatBackground: { flex: 1, backgroundColor: '#E5DDD5' },
  messageBubble: {
    maxWidth: '80%',
    padding: 8,
    borderRadius: 12,
    marginBottom: 5,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 5,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#E1F0FF',
    borderTopRightRadius: 0,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderTopLeftRadius: 0,
  },
  messageText: { fontSize: 15, color: '#000' },
  messageFooter: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: 2,
  },
  timestamp: { fontSize: 10, color: '#999' },
  ticks: { fontSize: 14, marginLeft: 3, letterSpacing: -4 },
  readTicks: { color: '#007AFF' },
  sentTicks: { color: '#999' },
  sendingTicks: { color: '#ccc', fontSize: 11, letterSpacing: 0 },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 25,
    alignItems: 'center',
    paddingHorizontal: 10,
    elevation: 2,
    marginRight: 5,
  },
  emojiBtn: { padding: 5 },
  input: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
    color: '#000',
    maxHeight: 100,
  },
  attachBtn: { padding: 5 },
  attachIcon: { transform: [{ rotate: '-45deg' }] },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0052CC',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  avatarPlaceholder: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  loadMoreBtn: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    color: '#0052CC',
    fontSize: 14,
    fontWeight: '600',
  },
  menuOverlay: { flex: 1, backgroundColor: 'transparent' },
  menuContainer: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    minWidth: 200,
  },
  menuItem: { padding: 15, paddingHorizontal: 20 },
  menuLoadingRow: { flexDirection: 'row', alignItems: 'center' },
  menuItemText: { fontSize: 15, color: '#000' },
});

export default ChatScreen;