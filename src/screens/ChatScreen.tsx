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
  Keyboard,
  Linking,
  Animated,
  PermissionsAndroid,
  KeyboardEvent,
  LayoutChangeEvent,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { CHAT_SERVER_URL } from '../config/api';
import { formatClock, formatDayLabel, isSameDay } from '../utils/time';
import { setActiveChatUser } from '../services/notificationService';
import { playSentSound, playReceivedSound } from '../services/soundService';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { io, Socket } from 'socket.io-client';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { pick } from '@react-native-documents/picker';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import RNPrint from 'react-native-print';
import {
  startListening,
  stopListening,
  destroy,
  addSpeechResultsListener,
  addSpeechErrorListener,
} from '@reactxnative/react-native-voice';
const LOG_PREFIX = '[ChatScreen]';

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SOCKET_URL = CHAT_SERVER_URL;
const API_BASE_URL = `${SOCKET_URL}/api`;

// Space between the message input bar and the open keyboard
const KEYBOARD_GAP = 8;

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
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [socketStatus, setSocketStatus] = useState('Connecting...');
  const [menuVisible, setMenuVisible] = useState(false);
  const [attachmentModalVisible, setAttachmentModalVisible] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // Android keyboard handling: with targetSdk 35+/36 the app is edge-to-edge, so
  // adjustResize no longer shrinks the screen and the keyboard covered the input bar.
  // We measure how much the screen actually shrank and pad only the part it didn't.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const baseHeightRef = useRef(Dimensions.get('window').height);
  const keyboardOpenRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);
  // Track whether we've done the initial scroll-to-bottom
  const initialScrollDone = useRef(false);
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;
  const sendMessageRef = useRef<(text?: string | null, file?: any) => Promise<void>>(() => Promise.resolve());
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

  // ─── PUSH: no notification popup for the chat that is open on screen ─────
  useFocusEffect(
    React.useCallback(() => {
      setActiveChatUser(contactId);
      return () => setActiveChatUser(null);
    }, [contactId])
  );

  // ─── KEYBOARD LISTENERS ──────────────────────────────────────────────────
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      keyboardOpenRef.current = true;
      setKeyboardHeight(e?.endCoordinates?.height || 0);
      setKeyboardVisible(true);
      scrollToBottom(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardOpenRef.current = false;
      setKeyboardHeight(0);
      setKeyboardVisible(false);
    });

    // Rotation / window size change: reset to new window height
    const dimSub = Dimensions.addEventListener('change', () => {
      baseHeightRef.current = Dimensions.get('window').height;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      dimSub.remove();
    };
  }, []);

  // ─── VOICE TO TEXT (SPEECH RECOGNITION) ──────────────────────────────────
  useEffect(() => {
    const resultsSub = addSpeechResultsListener((spokenText: string) => {
      log.info('Speech recognized:', spokenText);
      setIsListening(false);
      const text = spokenText ? spokenText.trim() : '';
      if (text) {
        const currentInput = inputTextRef.current.trim();
        const fullMessage = currentInput ? `${currentInput} ${text}` : text;
        setInputText('');
        sendMessageRef.current(fullMessage);
      }
    });

    const errorSub = addSpeechErrorListener((errCode: number) => {
      log.warn('Speech error code:', errCode);
      setIsListening(false);
      if (errCode === 7) {
        Alert.alert('Voice Recognition', 'Aapki aawaaz samajh nahi aayi, kripya dobara bolein.');
      } else if (errCode === 9) {
        Alert.alert('Permission Denied', 'Microphone permission allow karein.');
      }
    });

    return () => {
      resultsSub?.remove?.();
      errorSub?.remove?.();
      try {
        stopListening();
        destroy();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const requestAudioPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (hasPermission) return true;

        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Chattingapp needs microphone access to convert voice to text.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Audio permission error:', err);
        return false;
      }
    }
    return true;
  };

  const handleVoicePress = async () => {
    if (isListening) {
      try {
        stopListening();
      } catch (err) {
        console.warn('Error stopping voice:', err);
      }
      setIsListening(false);
    } else {
      const hasPermission = await requestAudioPermission();
      if (!hasPermission) {
        Alert.alert('Permission Denied', 'Microphone permission is required for voice typing.');
        return;
      }
      try {
        setIsListening(true);
        startListening();
      } catch (err) {
        console.error('Error starting voice recognition:', err);
        setIsListening(false);
        Alert.alert('Voice Error', 'Could not start voice recognition.');
      }
    }
  };

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
    transports: ['polling', 'websocket'],
    secure: true,
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,        // wait 1s before first retry
    reconnectionDelayMax: 5000,     // cap retry delay at 5s
    timeout: 20000,
    forceNew: true,
    autoConnect: true,
    auth: {
      token: token,
    },
    extraHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  socketRef.current = socket;

  // ── Lifecycle events ──────────────────────────────────────────────────────
  const handleConnect = () => {
    reconnectAttempts.current = 0;
    setIsConnected(true);
    setSocketStatus('Online');
    log.info('Connected', { id: socket.id, transport: socket.io?.engine?.transport?.name });
    socket.emit('join_room', roomId);
    markMessagesAsRead();
  };

  socket.on('connect', handleConnect);

  // If already connected immediately on mount/reuse
  if (socket.connected) {
    handleConnect();
  } else {
    socket.connect();
  }

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
    setIsConnected(true);
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
    setIsConnected(false);
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
      setIsConnected(false);
      setSocketStatus('Auth error');
      socket.disconnect();     // don't keep retrying on auth failures
    } else {
      setIsConnected(false);
      setSocketStatus('Reconnecting...');
    }
  });

  (socket.io as any).on('upgrade_error', (err: any) => {
    log.warn('Transport upgrade error', { message: err?.message, type: err?.type });
  });

  (socket.io as any).on('upgrade', () => {
    log.info('Transport upgraded to:', socket.io.engine.transport.name);
  });

  // ── Message events ────────────────────────────────────────────────────────
  socket.on('receive_message', (newMessage: any) => {
    if (!newMessage?.id) return;

    // Only messages of THIS conversation (me <-> this contact) belong on this screen.
    // Without this check a message from someone else showed up in whichever chat was open,
    // and replying there saved the reply against the wrong person.
    const msgSender = Number(newMessage.sender_id);
    const msgReceiver = Number(newMessage.receiver_id);
    const me = Number(userId);
    const isThisChat =
      (msgSender === me && msgReceiver === contactId) ||
      (msgSender === contactId && msgReceiver === me);
    if (!isThisChat) {
      log.info('Message for another chat ignored:', newMessage.id);
      return;
    }

    log.info('Message received:', newMessage.id);

    // Play WhatsApp-like incoming message sound if received from the other contact
    if (msgSender !== me) {
      playReceivedSound();
    }

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

  // Backend emits 'message_status_update' when the contact has read my messages
  socket.on('message_status_update', (data: any) => {
    if (data?.status !== 'read') return;
    if (String(data?.room_id) !== String(roomId)) return;
    if (String(data?.reader_id) !== String(contactId)) return;
    log.info('Messages read event:', data);
    setMessages((prev) =>
      prev.map((msg) =>
        String(msg.sender_id) === String(userId) && String(msg.receiver_id) === String(contactId)
          ? { ...msg, is_read: true, status: 'read' }
          : msg
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
    socket.off('message_status_update');
    socket.disconnect();
    socketRef.current = null;
    reconnectAttempts.current = 0;
  };
}, [roomId, token]);

  // ─── SCROLL TO BOTTOM HELPER ───────────────────────────────────────────────
  const scrollToBottom = (animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 100);
  };

  // ─── MARK MESSAGES AS READ ─────────────────────────────────────────────────
  const markMessagesAsRead = async () => {
    try {
      // Backend route is /messages/mark-read; it also notifies the contact over the socket.
      // other_user_id limits it to this conversation instead of the whole company room.
      const response = await fetch(`${API_BASE_URL}/messages/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          accept: '*/*',
        },
        body: JSON.stringify({ room_id: roomId.toString(), other_user_id: contactId }),
      });

      if (!response.ok) {
        log.warn('Mark as read failed with status', response.status);
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
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
        loadingMoreRef.current = true;
      }

      const response = await fetch(
        `${API_BASE_URL}/messages/chat-with/${contactId}?page=${pageNum}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status && Array.isArray(data.messages)) {
          const newMessages = data.messages; // newest-first from API
          const moreAvailable = newMessages.length >= 20;
          setHasMore(moreAvailable);
          hasMoreRef.current = moreAvailable;

          if (pageNum === 1) {
            // Reverse so index-0 = oldest, last = newest → renders top-to-bottom correctly
            const chronological = [...newMessages].reverse();
            setMessages(chronological);
            setPage(1);
            pageRef.current = 1;
            // Scroll to bottom after first load
            initialScrollDone.current = false;
          } else {
            // Older messages → prepend at the front (top of list)
            const olderChronological = [...newMessages].reverse();
            setMessages((prev) => [...olderChronological, ...prev]);
            setPage(pageNum);
            pageRef.current = pageNum;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  };

  // Auto-called when user scrolls near the top of the chat → loads older messages smoothly
  const loadMoreMessages = () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    fetchMessages(pageRef.current + 1);
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
      const msgDate = msg.created_at || new Date().toISOString();
      const dateLabel = formatDayLabel(msgDate);
      const time = formatClock(msgDate);

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

  // ─── FILE & URL HELPERS ──────────────────────────────────────────────────
  const getFullUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${SOCKET_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const getFileName = (url: string) => {
    if (!url) return 'Attachment';
    try {
      const clean = decodeURIComponent(url.split('?')[0]);
      const parts = clean.split('/');
      return parts[parts.length - 1] || 'Attachment';
    } catch {
      return 'Attachment';
    }
  };

  const getFileTypeInfo = (urlOrName: string) => {
    const clean = (urlOrName || '').toLowerCase().split('?')[0];
    const ext = clean.substring(clean.lastIndexOf('.') + 1);

    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)) {
      return { type: 'image', ext: ext.toUpperCase(), icon: 'image', color: '#10B981' };
    }
    if (ext === 'pdf') {
      return { type: 'pdf', ext: 'PDF', icon: 'file-pdf-box', color: '#EF4444' };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return { type: 'zip', ext: ext.toUpperCase(), icon: 'folder-zip', color: '#F59E0B' };
    }
    if (['doc', 'docx'].includes(ext)) {
      return { type: 'doc', ext: 'DOC', icon: 'file-word-box', color: '#2563EB' };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return { type: 'sheet', ext: 'XLS', icon: 'file-excel-box', color: '#059669' };
    }
    if (['ppt', 'pptx'].includes(ext)) {
      return { type: 'presentation', ext: 'PPT', icon: 'file-powerpoint-box', color: '#EA580C' };
    }
    if (['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext)) {
      return { type: 'audio', ext: 'AUDIO', icon: 'music-box', color: '#7C3AED' };
    }
    if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) {
      return { type: 'video', ext: 'VIDEO', icon: 'video-box', color: '#DB2777' };
    }
    return { type: 'file', ext: ext ? ext.toUpperCase() : 'FILE', icon: 'file-document-outline', color: '#4B5563' };
  };

  const openAttachment = async (url: string) => {
    const fullUrl = getFullUrl(url);
    if (!fullUrl) return;
    const fileInfo = getFileTypeInfo(fullUrl);
    if (fileInfo.type === 'image') {
      setPreviewImage(fullUrl);
      return;
    }
    try {
      await Linking.openURL(fullUrl);
    } catch (e) {
      Alert.alert('Open File', `Could not open file directly.\nURL: ${fullUrl}`);
    }
  };

  // ─── PICK IMAGE (GALLERY) ──────────────────────────────────────────────────
  const pickImage = async () => {
    setAttachmentModalVisible(false);
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await sendMessage(null, {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `image_${Date.now()}.jpg`,
          message_type: 'image',
        });
      }
    } catch (err) {
      console.error('Gallery pick error:', err);
    }
  };

  // ─── PICK CAMERA ────────────────────────────────────────────────────────────
  const pickCamera = async () => {
    setAttachmentModalVisible(false);
    try {
      const result = await launchCamera({ mediaType: 'photo', quality: 0.9 });
      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        await sendMessage(null, {
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `camera_${Date.now()}.jpg`,
          message_type: 'image',
        });
      }
    } catch (err) {
      console.error('Camera capture error:', err);
    }
  };

  // ─── PICK DOCUMENT (PDF, ZIP, DOC, ETC.) ───────────────────────────────────
  const pickDocument = async () => {
    setAttachmentModalVisible(false);
    try {
      const [res] = await pick({ type: ['*/*'] });
      if (res) {
        const fileName = res.name || `doc_${Date.now()}`;
        await sendMessage(null, {
          uri: res.uri,
          type: res.type || 'application/octet-stream',
          name: fileName,
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

    // Play WhatsApp-like outgoing message sound
    playSentSound();

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

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.id) {
        throw new Error(result?.error || result?.message || `Server error (${response.status})`);
      }

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
    } catch (error: any) {
      console.error('Send error:', error);
      if (!fileData && optimisticMsg) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        setInputText(text || '');
      }
      Alert.alert('Message not sent', error?.message || 'Failed to send message. Please try again.');
    }
  };
  sendMessageRef.current = sendMessage;

  // ─── RENDER MESSAGE BUBBLE ─────────────────────────────────────────────────
  const renderMessage = ({ item, index }: any) => {
    const isMe = String(item.sender_id) === String(userId);
    const isRead = item.is_read || item.status === 'read';
    const isSending = item.is_optimistic;
    const fullFileUrl = item.file_url ? getFullUrl(item.file_url) : null;
    const fileInfo = fullFileUrl ? getFileTypeInfo(fullFileUrl) : null;
    // WhatsApp style day chip ("Today", "Yesterday", ...) above the first message of each day
    const createdAt = item.created_at || new Date().toISOString();
    const prev = index > 0 ? messages[index - 1] : null;
    const showDayChip = !prev || !isSameDay(prev.created_at || new Date().toISOString(), createdAt);

    return (
      <>
      {showDayChip ? (
        <View style={styles.dayChipWrap}>
          <Text style={styles.dayChip}>{formatDayLabel(createdAt)}</Text>
        </View>
      ) : null}
      <View
        style={[
          styles.messageBubble,
          isMe ? styles.myMessage : styles.theirMessage,
        ]}
      >
        {fullFileUrl && fileInfo && (
          fileInfo.type === 'image' ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setPreviewImage(fullFileUrl)}
            >
              <Image
                source={{ uri: fullFileUrl }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.documentCard,
                isMe ? styles.documentCardMe : styles.documentCardThem,
              ]}
              onPress={() => openAttachment(fullFileUrl)}
            >
              <View style={[styles.docIconCircle, { backgroundColor: fileInfo.color }]}>
                <MaterialCommunityIcons name={fileInfo.icon} size={26} color="#fff" />
              </View>
              <View style={styles.docInfo}>
                <Text
                  style={[styles.docName, isMe ? styles.docNameMe : styles.docNameThem]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {getFileName(fullFileUrl)}
                </Text>
                <View style={styles.docMetaRow}>
                  <Text style={styles.docBadge}>{fileInfo.ext}</Text>
                  <Text style={[styles.docActionText, isMe && { color: '#047857' }]}>
                    Tap to open
                  </Text>
                </View>
              </View>
              <View style={styles.docDownloadBtn}>
                <MaterialCommunityIcons
                  name="download"
                  size={20}
                  color={isMe ? '#057A55' : '#64748B'}
                />
              </View>
            </TouchableOpacity>
          )
        )}
        {item.message ? (
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
            {item.message}
          </Text>
        ) : null}
        <View style={styles.messageFooter}>
          <Text style={[styles.timestamp, isMe && { color: '#047857' }]}>
            {formatClock(createdAt)}
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
      </>
    );
  };

  // Android keyboard handling:
  // If Android OS already resized the window (adjustResize), windowShrink >= 120, so 0 extra padding needed.
  // If Android OS did NOT resize the window (Android 15+ edge-to-edge), we lift the input bar by the keyboard height.
  // Including insets.bottom prevents the navigation bar from cutting off the input bar on phones with gesture/nav bars.
  const windowShrink =
    keyboardVisible && baseHeightRef.current > 0
      ? Math.max(0, baseHeightRef.current - containerHeight)
      : 0;

  const isWindowResizedByOS = windowShrink >= 120;

  const androidKeyboardPadding =
    Platform.OS === 'android' && keyboardVisible
      ? isWindowResizedByOS
        ? 0
        : Math.max(0, keyboardHeight + (insets.bottom > 0 ? insets.bottom : 0) - windowShrink)
      : 0;

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <View
      style={styles.container}
      onLayout={({ nativeEvent }: LayoutChangeEvent) => {
        const h = nativeEvent.layout.height;
        if (!keyboardOpenRef.current && h > 0) {
          baseHeightRef.current = Math.max(baseHeightRef.current, h);
        }
        setContainerHeight(h);
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#075E54" translucent={false} />
      {/* Safe area: keep the header BELOW the status bar (time / network / battery).
          Needed on Android too: with targetSdk 35+ the app is edge-to-edge and draws under it. */}
      <View style={{ height: insets.top, backgroundColor: '#075E54' }} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.avatarWrap}>
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
          {isConnected && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>
            {contact.name || contact.user_id || 'Unknown'}
          </Text>
          <Text style={[styles.headerStatus, isConnected && { color: '#A7F3D0' }]}>
            {isConnected ? 'Online' : socketStatus}
          </Text>
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.hIcon}
            onPress={() => setMenuVisible(true)}
          >
            <MaterialIcons name="more-vert" size={24} color="#fff" />
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
          <View style={[styles.menuContainer, { top: insets.top + 50 }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={exportChatAsPDF}
              disabled={exportingPDF}
            >
              {exportingPDF ? (
                <View style={styles.menuLoadingRow}>
                  <ActivityIndicator size="small" color="#057A55" />
                  <Text
                    style={[styles.menuItemText, { marginLeft: 8, color: '#057A55' }]}
                  >
                    Exporting...
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons name="picture-as-pdf" size={20} color="#057A55" style={{ marginRight: 10 }} />
                  <Text style={styles.menuItemText}>Export Chat as PDF</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Chat Messages Body ── */}
      <ImageBackground
        source={require('./techalphonic_logo.png')}
        style={styles.chatBackground}
        imageStyle={{ opacity: 0.03, resizeMode: 'center' }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1, paddingBottom: androidKeyboardPadding }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#057A55" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
              renderItem={renderMessage}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
              maintainVisibleContentPosition={{
                minIndexForVisible: 1,
              }}
              onLayout={() => {
                if (!initialScrollDone.current) {
                  scrollToBottom(false);
                  initialScrollDone.current = true;
                }
              }}
              onContentSizeChange={() => {
                if (!initialScrollDone.current) {
                  scrollToBottom(false);
                  initialScrollDone.current = true;
                }
              }}
              onScroll={({ nativeEvent }) => {
                // Auto-fetch older messages when scrolling within 180px of top
                if (nativeEvent.contentOffset.y <= 180 && hasMoreRef.current && !loadingMoreRef.current) {
                  loadMoreMessages();
                }
              }}
              scrollEventThrottle={16}
              ListHeaderComponent={() =>
                loadingMore ? (
                  <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                    <ActivityIndicator
                      size="small"
                      color="#057A55"
                    />
                  </View>
                ) : null
              }
            />
          )}

          {/* ── Input Area ── */}
          <View
            style={[
              styles.inputArea,
              // Keyboard open: leave a clear gap between the input bar and the keyboard
              { marginBottom: keyboardVisible ? KEYBOARD_GAP : (insets.bottom > 0 ? insets.bottom + 4 : 8) },
            ]}
          >
            <View style={styles.inputContainer}>
              <TouchableOpacity style={styles.emojiBtn}>
                <MaterialCommunityIcons
                  name="emoticon-outline"
                  size={24}
                  color="#64748B"
                />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder={isListening ? 'Listening... Speak now' : 'Type a message...'}
                placeholderTextColor={isListening ? '#E53E3E' : '#94A3B8'}
                value={inputText}
                onChangeText={setInputText}
                onFocus={() => scrollToBottom(true)}
                multiline
              />

              <TouchableOpacity
                style={styles.attachBtn}
                onPress={() => {
                  Keyboard.dismiss();
                  setAttachmentModalVisible(true);
                }}
              >
                <MaterialCommunityIcons
                  name="paperclip"
                  size={22}
                  color="#64748B"
                  style={styles.attachIcon}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.sendBtn,
                isListening && styles.sendBtnListening,
              ]}
              onPress={() => {
                if (isListening) {
                  handleVoicePress();
                } else if (inputText.trim()) {
                  sendMessage();
                } else {
                  handleVoicePress();
                }
              }}
              activeOpacity={0.8}
            >
              {isListening ? (
                <MaterialIcons name="mic" size={24} color="#fff" />
              ) : inputText.trim() ? (
                <MaterialIcons name="send" size={22} color="#fff" />
              ) : (
                <MaterialIcons name="mic" size={22} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* ── WhatsApp-Style Attachment Bottom Sheet ── */}
        <Modal
          visible={attachmentModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAttachmentModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.attachmentOverlay}
            activeOpacity={1}
            onPress={() => setAttachmentModalVisible(false)}
          >
            <View
              style={[
                styles.attachmentPanel,
                { paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24 },
              ]}
            >
              <View style={styles.attachmentHandle} />
              <Text style={styles.attachmentTitle}>Share Content</Text>

              <View style={styles.attachmentGrid}>
                {/* Document (PDF, ZIP, DOC, etc.) */}
                <TouchableOpacity
                  style={styles.attachmentItem}
                  onPress={pickDocument}
                  activeOpacity={0.7}
                >
                  <View style={[styles.attachmentCircle, { backgroundColor: '#5F66CD' }]}>
                    <MaterialCommunityIcons name="file-document" size={28} color="#fff" />
                  </View>
                  <Text style={styles.attachmentLabel}>Document</Text>
                  <Text style={styles.attachmentSubLabel}>PDF, ZIP, Docs</Text>
                </TouchableOpacity>

                {/* Camera */}
                <TouchableOpacity
                  style={styles.attachmentItem}
                  onPress={pickCamera}
                  activeOpacity={0.7}
                >
                  <View style={[styles.attachmentCircle, { backgroundColor: '#D3396D' }]}>
                    <MaterialCommunityIcons name="camera" size={28} color="#fff" />
                  </View>
                  <Text style={styles.attachmentLabel}>Camera</Text>
                  <Text style={styles.attachmentSubLabel}>Take photo</Text>
                </TouchableOpacity>

                {/* Gallery */}
                <TouchableOpacity
                  style={styles.attachmentItem}
                  onPress={pickImage}
                  activeOpacity={0.7}
                >
                  <View style={[styles.attachmentCircle, { backgroundColor: '#AC44CF' }]}>
                    <MaterialCommunityIcons name="image" size={28} color="#fff" />
                  </View>
                  <Text style={styles.attachmentLabel}>Gallery</Text>
                  <Text style={styles.attachmentSubLabel}>Photos</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* ── WhatsApp Style Fullscreen Image Viewer Modal ── */}
        <Modal
          visible={!!previewImage}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewImage(null)}
          statusBarTranslucent
        >
          <View style={styles.imageViewerContainer}>
            <View style={[styles.imageViewerHeader, { paddingTop: Math.max(insets.top, 14) }]}>
              <TouchableOpacity
                style={styles.imageViewerCloseBtn}
                onPress={() => setPreviewImage(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.imageViewerInfo}>
                <Text style={styles.imageViewerTitle} numberOfLines={1}>
                  {contact.name || contact.user_id || 'Photo'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.imageViewerBody}
              activeOpacity={1}
              onPress={() => setPreviewImage(null)}
            >
              {previewImage ? (
                <Image
                  source={{ uri: previewImage }}
                  style={styles.imageViewerImage}
                  resizeMode="contain"
                />
              ) : null}
            </TouchableOpacity>
          </View>
        </Modal>
      </ImageBackground>
    </View>
  );
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#075E54' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#075E54',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backBtn: { paddingRight: 6, paddingVertical: 4 },
  avatarWrap: { position: 'relative' },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#25D366',
    borderWidth: 2,
    borderColor: '#075E54',
  },
  headerInfo: { flex: 1, marginLeft: 10 },
  headerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  headerStatus: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 12 },
  headerIcons: { flexDirection: 'row' },
  hIcon: { paddingLeft: 12 },
  // WhatsApp classic beige/grey wallpaper
  chatBackground: { flex: 1, backgroundColor: '#ECE5DD' },
  messageBubble: {
    maxWidth: '80%',
    paddingTop: 6,
    paddingBottom: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  messageImage: {
    width: 220,
    height: 200,
    borderRadius: 6,
    marginBottom: 4,
  },
  // WhatsApp green bubble for sender
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6',
    borderTopRightRadius: 0,
  },
  // White bubble for receiver
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 0,
  },
  messageText: { fontSize: 15, color: '#000' },
  myMessageText: { color: '#000' },
  theirMessageText: { color: '#000' },
  messageFooter: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginTop: 1,
  },
  timestamp: { fontSize: 11, color: '#8696A0' },
  dayChipWrap: { alignItems: 'center', marginVertical: 8 },
  dayChip: {
    fontSize: 12,
    color: '#54656F',
    backgroundColor: '#E1F2FB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 1,
  },
  ticks: { fontSize: 14, marginLeft: 2, letterSpacing: -4 },
  readTicks: { color: '#53BDEB' },
  sentTicks: { color: '#8696A0' },
  sendingTicks: { color: '#ccc', fontSize: 11, letterSpacing: 0 },
  // Input row at bottom
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: '#ECE5DD',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 24,
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 44,
    elevation: 1,
    marginRight: 6,
  },
  emojiBtn: { padding: 2, marginRight: 4 },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
    maxHeight: 120,
  },
  attachBtn: { padding: 4, marginLeft: 4 },
  attachIcon: { transform: [{ rotate: '-45deg' }] },
  // WhatsApp green mic/send button
  sendBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  sendBtnListening: {
    backgroundColor: '#E53935',
  },
  avatarPlaceholder: {
    backgroundColor: '#128C7E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  loadMoreBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    marginVertical: 8,
    elevation: 1,
  },
  loadMoreText: {
    color: '#075E54',
    fontSize: 13,
    fontWeight: '600',
  },
  menuOverlay: { flex: 1, backgroundColor: 'transparent' },
  menuContainer: {
    position: 'absolute',
    top: 50,
    right: 6,
    backgroundColor: '#fff',
    borderRadius: 6,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    minWidth: 200,
  },
  menuItem: { padding: 14, paddingHorizontal: 18 },
  menuLoadingRow: { flexDirection: 'row', alignItems: 'center' },
  menuItemText: { fontSize: 15, color: '#000' },

  // ── Document Card Styles ──
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    width: 240,
    maxWidth: '100%',
  },
  documentCardMe: {
    backgroundColor: 'rgba(5, 122, 85, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(5, 122, 85, 0.2)',
  },
  documentCardThem: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  docInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  docName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  docNameMe: {
    color: '#064E3A',
  },
  docNameThem: {
    color: '#0F172A',
  },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  docBadge: {
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    color: '#475569',
    marginRight: 6,
  },
  docActionText: {
    fontSize: 11,
    color: '#64748B',
  },
  docDownloadBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
    marginLeft: 4,
  },

  // ── Attachment Sheet Styles ──
  attachmentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  attachmentPanel: {
    backgroundColor: '#F7F7F7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingHorizontal: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  attachmentHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C2C2C2',
    alignSelf: 'center',
    marginBottom: 14,
  },
  attachmentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A4A4A',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  attachmentGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 6,
    paddingBottom: 10,
  },
  attachmentItem: {
    alignItems: 'center',
    width: 80,
  },
  attachmentCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    marginBottom: 8,
  },
  attachmentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A4A4A',
  },
  attachmentSubLabel: {
    fontSize: 10,
    color: '#8696A0',
    marginTop: 2,
  },
  // WhatsApp Style Fullscreen Image Viewer
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  imageViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  imageViewerCloseBtn: {
    padding: 6,
    marginRight: 10,
  },
  imageViewerInfo: {
    flex: 1,
  },
  imageViewerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  imageViewerBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
});

export default ChatScreen;